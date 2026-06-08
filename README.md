# Intent Harness

Every product team makes hundreds of decisions about what their product does, what it doesn't do, and why. Some get written down. Most live in people's heads, in Slack threads, in the memory of whoever was in the room when the call was made.

When people leave the team, when AI starts writing code, when a new developer joins six months later — that knowledge evaporates. The product drifts. People relitigate decisions that were already made. Code gets written that contradicts things the team decided long ago.

The harness keeps that from happening.

---

## What it is

A structured way of recording product decisions in your GitHub repo — with automated agents that do the mechanical work, and a clear rule that keeps humans accountable for what actually matters.

It treats your decisions as the real asset, not your code. Code changes constantly. The decision that *"admins can export team status to CSV, but we're not including historical timestamps because we don't store them"* — that's what explains why the code is the way it is. Without it, the code is just behavior with no story behind it.

---

## What it stores

Six kinds of records, each capturing a different kind of truth:

**Jobs** — why the product exists from a user's perspective. *"Team admins need visibility into who hasn't completed onboarding so they can report to leadership."* Everything else anchors to this.

**Requirements** — what the system actually does. Small, specific, testable. *"An admin can export a CSV containing each current member's name, email, and completion status."* One behavior per record.

**Decisions** — what you explicitly chose not to do, and why. This is the one most systems miss entirely. *"We don't include historical timestamps in the export because we don't store them at the member level. Revisit if leadership reporting requires trend data."* Without this, the next developer who touches that code doesn't know whether the missing timestamps are an oversight or a deliberate call.

**Design principles** — how things should feel. *"Incomplete onboarding should feel like momentum, not failure. Don't use red indicators. Don't use language like 'missing' or 'failed'."* Not a spec — a quality the product is trying to embody.

**Domains** — who owns what. Auth, Onboarding, Billing — stable named areas with a team behind them. When someone leaves, you reassign the domain, not every individual record they ever touched.

**Design specs** — a pointer to the Figma design for a specific screen, connected to the requirement it serves.

---

## How it works day to day

**For a product owner**, the workflow starts with a GitHub Issue, written the way you'd write any issue — plain language, no special format:

> *"Admins need to be able to export team onboarding status to CSV for leadership reporting."*

The spec agent responds within a minute. It reads your existing requirement graph for context, asks at most two clarifying questions, and drafts the relevant records — including any explicit decisions about what the feature won't do. You read the draft, correct anything wrong in plain language, say "looks good," and the agent opens a PR. You review and merge. Merging is your approval. The records become canonical.

**For a designer**, the workflow is dropping a Figma link in a PR comment. The agent reads the frame metadata, infers which requirement it serves, asks one or two questions about interaction details, drafts a design spec record, and commits it on approval.

**For a developer**, the workflow is writing one line next to the code that implements a requirement:

```typescript
// req: req_cv3p8x
export async function exportOnboardingCsv(teamId: string) {
```

The trace agent reads these annotations and keeps the traceability map current automatically.

**Six months later**, a new team member runs one command and gets a complete answer to: why does this requirement exist, what job does it serve, what did we explicitly decide not to do, who made those calls, and what would need to change to revisit them. Without asking anyone. Without digging through Slack.

---

## The one rule that makes it trustworthy

**Agents draft. Humans approve.**

An agent can propose any record. It can draft requirements, generate acceptance criteria, flag conflicts, surface gaps. But it cannot make anything canonical. The only way a record becomes product truth is when a human merges the PR containing it. The GitHub username of the person who merged is permanently recorded on the record.

This matters especially now that AI can generate code and behavior at scale. Without this rule, AI-generated product truth is indistinguishable from human-approved product truth. With it, the provenance is always clear and a person is always accountable.

---

## If your product already exists

The harness doesn't ask you to document everything before you can start. It has an ingest agent that reads your existing documentation — Notion exports, markdown specs, meeting notes, whatever you have — and turns it into structured records for you to review.

It identifies the domains your product touches and asks you to confirm the list. Then it processes each domain separately and opens one PR per domain. Behaviors it's confident about are marked clearly. Things it found contradictory or vague are flagged for careful review. You correct what's wrong, remove what was hallucinated, and merge what's right.

From that point, new work goes through the normal flow. Old code gets annotated as developers touch it.

```bash
intent ingest --from=./docs/
intent ingest --from=https://your-notion-export-url
cat spec.md | intent ingest
```

---

## Getting started

**Prerequisites:** Node.js 18+, a GitHub repo, an Anthropic API key.

```bash
npm install -g intent-harness
cd your-repo
intent init
```

Add three secrets to your GitHub repo (Settings → Secrets → Actions):

| Secret | Purpose |
|---|---|
| `INTENT_HARNESS_KEY` | Anthropic API key — powers all agent calls |
| `INTENT_HARNESS_TOKEN` | GitHub personal access token (repo scope) — for agent commits and PRs |
| `FIGMA_ACCESS_TOKEN` | Optional — enables automatic Figma frame metadata |

Push the scaffolded files. The agents and CI workflows go live immediately.

---

## CLI reference

```bash
intent init                          Set up a new project
intent upgrade                       Update to latest version (never touches your records)
intent domains                       List all domains — start here if you're new
intent validate                      Run the same checks CI runs, locally
intent narrate <id>                  Why does this requirement exist?
intent narrate <id> --mode=domain    Full overview of a domain
intent ingest --from=<source>        Turn existing documentation into requirement records
intent trace                         Scan source code and update traceability
intent test [req_id]                 Generate acceptance criteria
intent decisions                     Run conflict, gap, and revisit checks
```

---

## What the automated checks do

Every PR runs three gates:

**Schema validation** — every record in the PR is well-formed. Hard fail.

**Graph integrity** — every ID reference resolves to a real record. Hard fail. A `req:` annotation pointing to a non-existent requirement fails CI — broken traceability is not a warning.

**PR fields** — the PR references at least one requirement ID, or explicitly states this is a non-behavior change. Hard fail.

These run automatically. You don't think about them until they tell you something is wrong.

---

## What runs automatically in the background

The decision agent runs every Monday. It checks for requirements that have been approved but never implemented past the threshold you configure, and opens a GitHub Issue listing them — not as a failure, but as a prompt. It also resurfaces old decisions once a year and asks whether the conditions that prompted them have changed.

The trace agent runs after every merge that touches source files. It updates which requirements have code backing them and which don't.

---

## Questions this repo should always answer

- What does this product do?
- What does it explicitly not do, and why?
- Why does this requirement exist?
- What would have to change for us to reconsider this decision?
- Who was accountable for this product truth?

If any of these require remembering a conversation, the repo is under-specified. Fix it by adding the missing record.

---

## License

MIT
