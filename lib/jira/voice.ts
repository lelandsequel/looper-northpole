/**
 * Ticket voice — deterministic presentation polish for Jira export.
 * Does not change COSMIC artifacts; runs on extracted payload only.
 */
import {
  asActorPhrase,
  goalNeedPhrase,
  sentences,
  stripPeriod,
  storyTitleFromGoal,
  tidy,
  userWantClause,
} from "@/lib/six-d/helpers";

import type { JiraEmitPayload, JiraEpic, JiraStory } from "./types";

const USER_STORY_RE =
  /^As (?:a |an )?(.+?), I need: (.+?) — so that "(.+)" delivers its intended outcome\.?$/;

const USER_STORY_WANT_RE =
  /^As (?:a |an )?(.+?), I want (?:to )?(.+?)\.?$/;

const PILOT_AC_RE =
  /^Given the feature is active in the pilot slice, when the covered workflow runs, then:\s*/i;

const BUDGET_AC_RE =
  /^Given the feature is active, when the affected flow completes, then it satisfies the stated budget \([^)]+\):\s*/i;

const NORMATIVE_AC_RE =
  /^Given the flow described in the intent, when it executes, then the stated requirement holds:\s*/i;

export function polishAcceptanceCriterion(ac: string): string {
  let t = ac.trim();
  for (const re of [PILOT_AC_RE, BUDGET_AC_RE, NORMATIVE_AC_RE]) {
    if (re.test(t)) {
      t = t.replace(re, "");
      break;
    }
  }
  return tidy(stripPeriod(t));
}

export function polishStoryDescription(description: string): string {
  let body = description.trim();
  const acceptIdx = body.indexOf("\n\nAcceptance:");
  if (acceptIdx >= 0) body = body.slice(0, acceptIdx).trim();

  const legacy = body.match(USER_STORY_RE);
  if (legacy) {
    const [, actor, need] = legacy;
    return `${asActorPhrase(actor.trim())}, ${userWantClause(need)}.`;
  }

  const modern = body.match(USER_STORY_WANT_RE);
  if (modern) {
    const [, actor, need] = modern;
    return `${asActorPhrase(actor.trim())}, I want to ${need.trim()}.`;
  }

  const brokenArticle = body.match(/^As a ([aeiou]\w+),/i);
  if (brokenArticle) {
    return body.replace(/^As a /i, "As an ");
  }

  return body;
}

export function polishStoryTitle(title: string): string {
  return storyTitleFromGoal(title);
}

export function polishEpicDescription(description: string): string {
  let t = description
    .replace(/\s*Outcome:\s*[^.]+(\.|$)/gi, "")
    .replace(/\s*\(Area\s+[^)]+\)\s*/gi, "")
    .replace(/\s*Area:\s*[^.]+·\s*Sponsor:\s*[^.]+(\.|$)/gi, "")
    .trim();
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const s of sentences(t)) {
    const key = s.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }
  if (unique.length <= 4) return unique.join(" ");
  return unique.slice(0, 4).join(" ");
}

function polishStory(story: JiraStory): JiraStory {
  return {
    ...story,
    title: polishStoryTitle(story.title),
    description: polishStoryDescription(story.description),
    acceptanceCriteria: story.acceptanceCriteria.map(polishAcceptanceCriterion),
  };
}

function polishEpic(epic: JiraEpic): JiraEpic {
  return {
    ...epic,
    description: polishEpicDescription(epic.description),
  };
}

/** Apply ticket voice to an extracted payload (deterministic). */
export function polishJiraPayload(payload: JiraEmitPayload): JiraEmitPayload {
  return {
    ...payload,
    epic: polishEpic(payload.epic),
    stories: payload.stories.map(polishStory),
  };
}