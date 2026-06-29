# LOOPER + NORTHPOLE: The Deterministic Prioritization OS

**From unstructured intake to a ranked, capacity-allocated, and audit-ready build queue—mathematically.**

---

### The Problem: The Unvetted "Front Door"

In any large enterprise, high-value initiatives and critical-path fixes originate from dozens of channels—executive memos, support tickets, hallway conversations, and strategic off-sites. With no single, structured intake, these ideas arrive as unvetted, unstructured free text. The result is a prioritization process based on tribal knowledge, political capital, and subjective "gut feelings," leading to:

-   **Duplicate Work:** Multiple teams unknowingly building the same solution (e.g., three different "mortgage calculators").
-   **Opaque Rankings:** No one can mathematically defend why one multi-million dollar project is ranked above another.
-   **No Audit Trail:** When a project fails or a mandate is missed, there is no immutable record of the original request, the evidence provided, or the scoring decision.

---

### The Solution: A Two-Part Deterministic System

LOOPER + NORTHPOLE replaces subjective chaos with a two-stage system that runs on mathematical rigor and cryptographic receipts.

#### **Part 1: LOOPER — The Prioritization Engine**

LOOPER transforms raw ideas into a mathematically ranked, evidence-enforced, and fully auditable portfolio backlog.

1.  **Guided Intake (`/intake/guided`):** A conversational, multi-step wizard that guides business users through the process of structuring their request. It helps them classify value, quantify impact, and, most critically, **enforces that all financial claims are backed by a cited source** before the submission is even accepted.

2.  **The CADMUS Gate (`/lib/cadmus`):** A deterministic validation engine that acts as the front door. It structurally refuses any submission that is incomplete or lacks the required evidence for its claims. No source, no entry.

3.  **The Agility Engine (`/lib/agility`):** The heart of LOOPER. It takes the validated, structured initiative and runs it through a deterministic scoring algorithm to produce a defensible priority score.

4.  **The Ledger (`/lib/store`):** Every valid submission, every refusal, and every re-prioritization event is cryptographically signed and chained into an immutable, append-only ledger inspired by **COSMIC LUNA**. This provides a complete, tamper-evident audit trail of every decision.

#### **Part 2: NORTHPOLE — The Build Engine**

NORTHPOLE takes the top-ranked, funded initiatives from the LOOPER queue and orchestrates their journey from idea to audited, production-ready code.

1.  **6D COSMIC Spec:** The funded initiative is run through the **6D Workbench**, which deterministically generates a full technical specification, including user stories, acceptance criteria, and non-functional requirements.

2.  **The Build Loop (REFUSE → RESOLVE → RECOMPUTE):** The spec is handed to a builder (a human team or an AI agent). The output is run against a suite of automated validators. If it fails, the system **refuses** the build and hands back a structured list of required fixes. The builder **resolves** the issues and re-submits. This loop continues until the build is perfect or the round-budget is exhausted.

3.  **STRATA Audit:** The final, validated build artifact is audited by a **STRATA**-like engine to certify its correctness and seal the final receipt on the ledger.

---

### The Scoring Algorithm: RICE + 3-Year NPV

The Agility Engine runs on a modified RICE framework where "Impact" is driven by a conservative 3-Year Net Present Value (NPV) calculation. **There is no LLM involved in the scoring path.**

#### **1. RICE Score Formula**

The final priority score is calculated as:

```
Score = (Reach * Impact * Delivery_Confidence) / Effort
```

-   **Reach:** The number of customers, users, or transactions affected per year. *(Sourced from intake.)*
-   **Impact:** A normalized score derived from the 3-Year NPV. *(See formula below.)*
-   **Delivery Confidence:** A probability (0.5, 0.8, 1.0) of the team's ability to ship the feature successfully. *(Sourced from intake.)*
-   **Effort:** The total number of "team-weeks" required to complete the project. *(Sourced from intake.)*

#### **2. Impact Score (from 3-Year NPV)**

`Impact` is not a subjective guess. It is the log-scaled 3-Year NPV, ensuring that a $10M project is significantly more impactful than a $1M project, but not so overwhelmingly that it starves all smaller initiatives.

```
Impact_Score = ln(1 + 3_Year_NPV)
```

#### **3. 3-Year NPV Formula (The Core Financials)**

The NPV is calculated over a 3-year horizon with a standard discount rate (`r = 0.10`). All financial claims must be sourced to pass the CADMUS gate.

```
3_Year_NPV = Σ [ (Net_Cash_Flow_t) / (1 + r)^t ]  (for t = 1 to 3)
```

Where `Net_Cash_Flow_t` for each year is:

```
(Revenue_t * (1 - COGS)) + Cost_Savings_t + (Cost_Avoidance * pAvoid_t) + (Risk_Reduction * pRisk_t) + Customer_Impact_t - Ongoing_TCO_t
```

---

### The Deterministic Guarantee

The entire LOOPER + NORTHPOLE system is built on the **JourdanLabs "Receipts over Fluency"** principle. By keeping the scoring and validation paths 100% deterministic and free of LLM "vibes," the system provides what enterprise AI demands: **a mathematically sound, defensible, and fully auditable record of every decision from intake to deployment.**
