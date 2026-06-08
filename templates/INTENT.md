# Intent Harness

This repo uses a requirement harness. This document explains what that means and how to work with it.

Read this before opening your first PR.

---

## The premise

Requirements are the durable product asset. Code is the disposable implementation layer.

The harness exists to preserve product truth across time, team changes, and AI-assisted development. It does this by making requirements machine-readable, agent-assisted, and human-approved — in that order.

---

## What lives here

Seven record types, each in its own directory under `/requirements/`:

| Type | Directory | What it captures |
|---|---|---|
| `job` | `jobs/` | Why the product exists. Human needs and business goals. |
| `domain` | `domains/` | Who owns what. Survives team attrition. |
| `design-principle` | `design-principles/` | How things should feel. Informs judgment, never blocks. |
| `design-spec` | `design-specs/` | Pointer to Figma + structured metadata. Owned by design. |
| `requirement` | `requirements/` | What the system does. Specific, testable behavioral truth. |
| `decision` | `decisions/` | What we chose not to do and why. With a revisit condition. |

Each record has a permanent opaque ID (`req_cv3p8x`, `dec_8sx1qr`, etc). IDs never change. Titles are mutable. Nothing is ever deleted — only marked superseded.

---

## Status fields

Every requirement and design spec carries three independent status fields:

**`legitimacy`** — has a human approved this as product truth?
- `proposed` — drafted, not yet approved. Agents write this. Not enforced by CI.
- `approved` — canonical. Only set by merging a PR. CI enforces these.
- `superseded` — replaced by a newer record. Still readable for traceability.

**`lifecycle`** — is this still active?
- `active` — currently enforced.
- `historical` — no longer enforced but preserved.

**`implementation`** — has the code caught up?
- `unbuilt` — approved but not yet implemented.
- `partial` — partially implemented.
- `complete` — implementation matches the requirement.

The CI gate enforces: `legitimacy: approved` + `lifecycle: active`. Everything else is informational.

---

## The human accountability rule

**Agents draft. Humans approve.**

An agent can propose a requirement, validate a schema, draft a design spec from a Figma link, surface a conflict, or walk the graph and produce a narrative. An agent cannot approve anything into canonical product truth.

Approval happens exactly one way: a human merges a PR. That merge flips `proposed` to `approved` automatically. No other mechanism exists.

This is not bureaucracy. It is the guarantee that a person was accountable for every piece of product truth in this repo.

---

## How to add a new feature

1. **Open a GitHub Issue** in plain language. Describe the need — not the solution.

2. **The spec agent responds** with clarifying questions (at most two) and a draft of the relevant records: requirements, decisions about exclusions, and a design principle reference if relevant.

3. **You answer and correct**. The spec agent updates the draft.

4. **Say "looks good"**. The spec agent opens a PR with the proposed records.

5. **Design drops a Figma link** in the PR comments if UI is involved. The spec agent drafts a design spec record and asks one or two questions. Design says "looks good."

6. **You review and merge**. Merge is your approval. The records become canonical.

7. **A developer implements**. They annotate their code with `req: req_xxxxxx` comments. The trace agent maps these to requirement records.

---

## How to read context for any record

```bash
# Why does this requirement exist? What constrains it?
node .intent/scripts/narrate.js req_cv3p8x

# Full overview of a domain — jobs, principles, decisions, active work
node .intent/scripts/narrate.js dom_4xkq2m --mode=domain
```

---

## How to validate locally

```bash
node .intent/scripts/validate.js
```

Runs the same three checks as CI:
1. Schema validity — every record matches its type definition
2. Graph integrity — every ID reference points to a real record
3. Enforcement — no approved+active requirements conflict

Run this before pushing. The CI gate will catch it anyway, but it's faster locally.

---

## What the CI gate checks

Every PR runs three automated checks:

**Schema validation** — all records in the PR are valid against their JSON Schema. Hard fail.

**Graph integrity** — every ID reference in the changed records resolves to a real record. Hard fail.

**PR fields** — the PR body references at least one requirement ID, or explicitly states "no requirement change." Hard fail.

**Design system gaps** — design specs without a `design-system-ref` get a `design-system-gap` label. Not a blocker.

---

## Annotating code

When you implement something that corresponds to a requirement, add a comment:

```typescript
// req: req_cv3p8x
export async function exportOnboardingCsv(teamId: string) {
```

```python
# req: req_cv3p8x
def export_onboarding_csv(team_id: str):
```

The trace agent reads these and updates the `traces` field on the requirement record and the `implementation` status. You don't do this manually.

---

## What agents can and cannot do

| Agent | Can | Cannot |
|---|---|---|
| Spec agent | Draft records, validate schema, ask clarifying questions, commit proposed records | Merge PRs, approve records, modify approved records |
| Decision agent | Open issues for conflicts and gaps, draft decision records | Resolve conflicts, close issues |
| Trace agent | Update `traces` and `implementation` fields | Modify any other field on any record |
| Test agent | Generate and update `acceptance-criteria` | Mark requirements as tested or complete |

---

## If two documents conflict

The more specific behavioral contract wins over the more general narrative.

If conflict remains after reading both, open a GitHub Issue and tag it `decision-needed`. Do not resolve it silently. Do not rely on memory or inference.

---

## Updating the harness itself

The harness infrastructure (schemas, scripts, workflows) is versioned separately from your requirement records. To update:

```bash
node .intent/scripts/intent.js upgrade
```

This updates schemas and scripts. It never touches your requirement records. Those belong to your team.

---

## Questions this repo should always be able to answer

- What does this product do?
- What does it explicitly not do, and why?
- Why does this requirement exist?
- What would have to change for us to reconsider this decision?
- What proves this behavior works?
- Who was accountable for this product truth?

If any of these require remembering a conversation, the repo is under-specified. Fix it by adding the missing record.
