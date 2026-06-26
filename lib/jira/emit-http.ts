import type { JiraEmitPayload } from "./types";

export type JiraHttpConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
};

export function jiraHttpConfigFromEnv(): JiraHttpConfig | null {
  const baseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, "");
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const projectKey = process.env.JIRA_PROJECT_KEY ?? "HL";
  if (!baseUrl || !email || !apiToken) return null;
  return { baseUrl, email, apiToken, projectKey };
}

function authHeader(cfg: JiraHttpConfig): string {
  const token = Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString("base64");
  return `Basic ${token}`;
}

function plainDescription(text: string) {
  return {
    type: "doc",
    version: 1,
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

async function createIssue(
  cfg: JiraHttpConfig,
  fields: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: authHeader(cfg),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jira create issue failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { key: string };
  return data.key;
}

/**
 * Emit verified epic + stories to Jira Cloud REST API v3.
 * Requires JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN; optional JIRA_PROJECT_KEY.
 */
export async function emitJiraToHttp(
  payload: JiraEmitPayload,
): Promise<{ epicKey: string; storyKeys: string[] }> {
  const cfg = jiraHttpConfigFromEnv();
  if (!cfg) {
    throw new Error(
      "Jira HTTP adapter requires JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN",
    );
  }

  const epicKey = await createIssue(cfg, {
    project: { key: cfg.projectKey },
    summary: payload.epic.title,
    description: plainDescription(payload.epic.description),
    issuetype: { name: "Epic" },
  });

  const storyKeys: string[] = [];
  for (const story of payload.stories) {
    const acBlock = story.acceptanceCriteria.map((ac) => `• ${ac}`).join("\n");
    const description = [
      story.description,
      "",
      "Acceptance criteria:",
      acBlock,
      "",
      `Source: ${story.storyId}`,
      `Spec receipt: ${payload.specReceipt}`,
    ].join("\n");

    const key = await createIssue(cfg, {
      project: { key: cfg.projectKey },
      summary: story.title,
      description: plainDescription(description),
      issuetype: { name: "Story" },
      parent: { key: epicKey },
    });
    storyKeys.push(key);
  }

  return { epicKey, storyKeys };
}