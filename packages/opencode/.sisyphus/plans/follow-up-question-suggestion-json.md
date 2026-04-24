# Follow-Up Question Suggestion JSON

## TL;DR
> **Summary**: Produce one strict JSON object with 3-5 concise Korean follow-up prompts that a user could naturally ask next after the full supplied chat history, especially the latest diagnosis summary.
> **Deliverables**:
> - Final response shaped exactly as `{ "follow_ups": ["...", "...", "..."] }`
> - 3-5 Korean user-perspective follow-up prompts
> - Evidence proving JSON validity, chat-history grounding, recency weighting, and intent diversity
> **Effort**: Quick
> **Parallel**: NO
> **Critical Path**: 1 → 2 → 3 → 4

## Context
### Original Request
- Current task: suggest 3-5 relevant follow-up questions or prompts that the user might naturally ask next in this conversation as a user, based on the supplied chat history, and output JSON only.
- Required output shape: `{"follow_ups":["Question 1?","Question 2?","Question 3?"]}`
- Hard constraints from the prompt:
  - write follow-ups from the user's point of view, directed to the assistant
  - keep them concise, clear, and directly related to the discussed topic
  - do not repeat what was already covered
  - use the conversation's primary language
  - return only a JSON object with a single `follow_ups` key

- The supplied chat history is the only source of truth. The visible conversation flow is:
  - user asked for source-code diagnosis without making fixes
  - assistant initially surfaced existing work plans instead of diagnosing
  - user asked for the prior content in Korean
  - assistant explained plan/start-work behavior in Korean
  - user challenged why `source-diagnostic-assessment.md` did not execute immediately and why only planning happened
  - assistant replied that diagnosis had now been executed, reported passing typecheck/LSP checks, reported 29 failing tests in the full suite, grouped several representative failures, concluded `REAL ISSUE`, and explicitly offered to categorize the failures by type next

### Interview Summary
- No interview was performed because automated mode explicitly required immediate plan generation.
- The conversation's operative language is Korean, so the final follow-ups must be Korean.
- The most likely next-turn follow-ups should continue from the latest assistant reply, not from the earlier plan-selection mismatch alone.
- Earlier plan-mode confusion remains relevant only as background; the strongest next prompts should react to the diagnostic findings and the assistant's offer to group failures.

### Metis Review (gaps addressed)
- Fixed the source boundary: use the full visible chat history only; exclude system/developer/tool context and repo state.
- Fixed the anchoring rule: weight the most recent user complaint and the most recent assistant diagnosis summary highest; earlier turns are background only.
- Added explicit no-repeat policy: reject candidates that restate prior visible user/assistant utterances or duplicate each other after normalization.
- Added explicit count policy: target 4 strong follow-ups; emit 3 if only 3 distinct high-quality prompts remain.
- Added explicit mixed-content rule: output must stay Korean, but technical tokens such as file names, test names, and quoted status strings may remain verbatim.

## Work Objectives
### Core Objective
Produce one valid JSON object whose `follow_ups` array contains 3-5 strong Korean follow-up prompts that a user could naturally ask next after this exact chat history, with emphasis on the latest diagnostic summary and offered next step.

### Deliverables
- JSON object exactly shaped as `{ "follow_ups": [string, ...] }`
- 3-5 Korean strings, each phrased as a plausible next user utterance to the assistant
- Evidence files capturing constraint extraction, latest-state summary, candidate generation, filtering, and JSON validation

### Definition of Done (verifiable conditions with commands)
- Final response parses as valid JSON via a local command from `packages/opencode`.
- Parsed top-level keys equal exactly `["follow_ups"]`.
- `follow_ups` is an array of length 3-5.
- Every item is a non-empty Korean user-style follow-up question or prompt.
- Every item is grounded in the visible chat history.
- At least one item reacts to the assistant's diagnosis findings, not just the earlier planning mismatch.
- No two items express the same core intent after normalization and intent-tag review.
- No prose, markdown fences, numbering, comments, or metadata appears outside the JSON object.

### Must Have
- Use only the supplied prompt and visible chat history.
- Favor the latest exchange when deciding what the user would naturally ask next.
- Keep all selected follow-ups concise and directly tied to the conversation.
- Reflect the unresolved user goal: understanding the diagnostic result and what the reported failures mean.
- Include prompts that feel like natural continuations of the assistant's final offer to group or explain failures.
- Output between 3 and 5 items inclusive; prefer 4 if quality allows, otherwise 3.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- Must NOT inspect repository code, run diagnostics, or infer repo facts beyond the shown chat history.
- Must NOT answer the diagnosis request itself.
- Must NOT add keys such as `notes`, `reasoning`, `language`, or `confidence`.
- Must NOT include English or mixed-language follow-ups except for verbatim technical identifiers already visible in the chat history.
- Must NOT focus only on the first plan-selection misfire while ignoring the later diagnostic summary.
- Must NOT include generic filler like `다음은 뭐야?` unless explicitly anchored to the visible exchange.
- Must NOT include two prompts with the same intent phrased differently.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after only; no framework setup.
- QA policy: every task includes explicit evidence and negative checks.
- Evidence path convention: `.sisyphus/evidence/task-{N}-{slug}.{ext}`
- Deterministic contract checks:
  - JSON parses successfully
  - only `follow_ups` exists at top level
  - array length is 3-5
  - every item is a trimmed non-empty string
  - raw output contains no backticks or leading/trailing prose
- Behavioral checks converted to executable review artifacts:
  - assign one intent tag per selected follow-up
  - verify all intent tags are unique
  - verify each follow-up is justified by a visible line/claim in the chat history
  - verify at least one selected item targets the latest diagnosis summary or the offer to group failures
- Normalization rule for no-repeat checks:
  - trim whitespace
  - collapse repeated spaces
  - ignore trailing `?`, `??`, `!`, and surrounding quotes for duplicate detection
  - lowercase Latin characters inside mixed technical strings for comparison only
  - treat paraphrases with the same core ask as duplicates if they share the same intent tag and latest-turn justification

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> This work stays sequential because final JSON quality depends on the exact filtered candidate set.

Wave 1: grounding + candidate generation
- Task 1: extract hard constraints and summarize the latest conversational state
- Task 2: generate a larger Korean candidate pool across distinct intent buckets

Wave 2: filtering + packaging
- Task 3: filter to the final 3-5 follow-ups using recency, relevance, and dedup rules
- Task 4: serialize strict JSON and validate the contract

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | - | 2, 3, 4 |
| 2 | 1 | 3, 4 |
| 3 | 1, 2 | 4 |
| 4 | 1, 2, 3 | F1-F4 |

### Agent Dispatch Summary (wave → task count → categories)
| Wave | Task Count | Categories |
|---|---:|---|
| 1 | 2 | writing |
| 2 | 2 | writing, quick |
| Final Verification | 4 | oracle, unspecified-high, unspecified-high, deep |

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Extract the exact prompt constraints and summarize the latest visible conversation state

  **What to do**: Build a checklist from the current user prompt and the full supplied chat history only. Record the output schema, count limits, language decision, user-perspective requirement, no-extra-text rule, and the latest state of the conversation: the assistant has already reported a mixed diagnosis result and offered to classify failures by type next.
  **Must NOT do**: Do not inspect repository source code, open unrelated sessions, or infer hidden user preferences beyond what is visible.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: constrained reading and summarization of prompt requirements.
  - Skills: `[]` - no specialized skill required.
  - Omitted: `["effect"]` - not relevant to conversational output planning.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2, 3, 4] | Blocked By: []

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `current user prompt (inline)` - authoritative output contract and formatting rules.
  - Pattern: `chat_history (inline)` - authoritative conversation facts and recency order.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Evidence file lists every hard constraint from the prompt with no omissions.
  - [ ] Evidence file explicitly states that Korean is the selected output language.
  - [ ] Evidence file summarizes the latest assistant message as the main anchor for natural next-turn prediction.
  - [ ] Evidence file separates background context (early plan confusion) from latest-turn context (diagnostic results and offered next step).

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Constraint extraction completeness
    Tool: Bash
    Steps: Save the checklist to `.sisyphus/evidence/task-1-constraints.txt` and compare it line-by-line against the current prompt.
    Expected: The file contains source-only, JSON-only, `follow_ups` key, 3-5 count, user POV, concise, no repetition, and Korean-language constraints.
    Evidence: .sisyphus/evidence/task-1-constraints.txt

  Scenario: Latest-state grounding check
    Tool: Bash
    Steps: Save a short summary of the latest visible conversational state to `.sisyphus/evidence/task-1-latest-state.txt`.
    Expected: The summary states that the assistant reported 29 test failures, grouped representative issues, concluded `REAL ISSUE`, and offered further failure categorization.
    Evidence: .sisyphus/evidence/task-1-latest-state.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: []

- [ ] 2. Generate a larger Korean candidate pool across distinct next-turn intents

  **What to do**: Draft 8-10 Korean follow-up candidates from the user's point of view. Candidates must feel like plausible next turns after the assistant's final diagnosis summary. Cover at least these intent buckets: ask to group the 29 failures by type, ask to distinguish real code bugs from environment/Windows issues, ask for the highest-priority failures to inspect first, ask for more detail on a named failing test area, and ask why planning happened earlier before execution.
  **Must NOT do**: Do not generate assistant-voiced text. Do not include candidates about implementation, git, translations, or unrelated repo workflows.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: language generation with controlled variation.
  - Skills: `[]` - no specialized skill required.
  - Omitted: `["effect"]` - not relevant.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [3, 4] | Blocked By: [1]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `chat_history (inline)` - use the actual last user complaint and the final assistant diagnostic summary to determine plausible next questions.
  - Pattern: `current user prompt (inline)` - follow-ups must be concise, directly related, and not repeat covered content.
  - Pattern: `.sisyphus/evidence/task-1-latest-state.txt` - latest-turn anchor for recency weighting.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Candidate pool contains at least 8 items before filtering.
  - [ ] Every candidate is Korean and reads as a user message to the assistant.
  - [ ] At least 4 distinct intent tags are represented across the candidate pool.
  - [ ] At least 5 candidates are anchored to the latest assistant message rather than only the early plan mismatch.
  - [ ] No candidate simply repeats a visible sentence from the chat history.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Candidate pool review
    Tool: Bash
    Steps: Save all candidates with one intent tag each to `.sisyphus/evidence/task-2-candidates.md`.
    Expected: The file contains 8-10 Korean candidates tagged with intents such as `group-failures`, `separate-env-vs-code`, `prioritize-top-failures`, `ask-specific-suite`, or `challenge-earlier-planning`.
    Evidence: .sisyphus/evidence/task-2-candidates.md

  Scenario: Off-topic candidate rejection
    Tool: Bash
    Steps: Save a short reject list to `.sisyphus/evidence/task-2-rejections.txt` for any discarded ideas that drift into implementation, translation, or generic filler.
    Expected: Every rejected candidate has a concrete reason tied to the prompt constraints or chat-history mismatch.
    Evidence: .sisyphus/evidence/task-2-rejections.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: []

- [ ] 3. Filter to the final 3-5 follow-ups with recency weighting and semantic dedup

  **What to do**: Score each candidate against five fixed criteria: direct relevance to the visible exchange, naturalness as the next user turn, recency alignment with the latest assistant message, clarity/conciseness, and uniqueness of intent. Keep the best 3-5 items. Require that the final set include at least one item about interpreting the diagnostic failures and at least one item about how or why the earlier planning-only response happened, unless no non-duplicative wording remains.
  **Must NOT do**: Do not keep two items that differ only in wording. Do not keep weak filler solely to reach five items. Do not let early-turn mismatch prompts crowd out all diagnosis-focused prompts.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: editorial selection with explicit rubric.
  - Skills: `[]` - no specialized skill required.
  - Omitted: `["effect"]` - not relevant.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [4] | Blocked By: [1, 2]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `.sisyphus/evidence/task-1-constraints.txt` - hard requirements to preserve.
  - Pattern: `.sisyphus/evidence/task-1-latest-state.txt` - the latest exchange the final items should prioritize.
  - Pattern: `.sisyphus/evidence/task-2-candidates.md` - full candidate pool with intent tags.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Final set contains 3-5 items inclusive.
  - [ ] Final set contains no duplicate intent tags.
  - [ ] At least one item asks for interpretation, grouping, or prioritization of the reported failures.
  - [ ] At least one item addresses the earlier planning-vs-execution confusion, unless that slot would duplicate a stronger prompt.
  - [ ] Every kept item has a one-line justification tied to a visible part of the chat history.
  - [ ] If only 3 strong items remain, evidence explains why weaker candidates were excluded.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Semantic dedup review
    Tool: Bash
    Steps: Save the kept items, their scores, and their intent tags to `.sisyphus/evidence/task-3-selection.md`.
    Expected: No two kept items share the same intent tag, and at least one kept item is anchored to the latest diagnosis summary.
    Evidence: .sisyphus/evidence/task-3-selection.md

  Scenario: Low-quality padding prevention
    Tool: Bash
    Steps: If fewer than 5 strong items exist, record why weaker candidates were excluded in `.sisyphus/evidence/task-3-padding-check.txt`.
    Expected: The task keeps 3 or 4 items rather than adding low-quality filler.
    Evidence: .sisyphus/evidence/task-3-padding-check.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: []

- [ ] 4. Serialize the final answer as strict JSON and run deterministic contract checks

  **What to do**: Wrap the selected follow-ups into a JSON object with exactly one key, `follow_ups`. Save the raw output to an evidence file and run a deterministic local parse/check command. Also run a raw-text check to ensure no prose, code fences, or trailing commentary exists outside the JSON object.
  **Must NOT do**: Do not add any explanatory text. Do not add comments or markdown. Do not emit a schema different from the required one.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: deterministic packaging and validation.
  - Skills: `[]` - no specialized skill required.
  - Omitted: `["effect"]` - not relevant.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [F1, F2, F3, F4] | Blocked By: [1, 2, 3]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `current user prompt (inline)` - final JSON contract.
  - Pattern: `.sisyphus/evidence/task-3-selection.md` - final approved follow-up set.
  - Pattern: `.sisyphus/evidence/task-1-constraints.txt` - complete checklist of mandatory rules.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Raw final output parses as JSON.
  - [ ] Parsed object has exactly one top-level key, `follow_ups`.
  - [ ] Parsed `follow_ups` array length is between 3 and 5 inclusive.
  - [ ] Every array item is a trimmed non-empty string.
  - [ ] At least one string is anchored to the latest diagnosis result or offer to categorize failures.
  - [ ] Raw final output contains no backticks, markdown fences, or extra prose before or after the JSON.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: JSON parse success
    Tool: Bash
    Steps: Save the final response to `.sisyphus/evidence/task-4-output.json` and run `bun -e "const text = await Bun.file('.sisyphus/evidence/task-4-output.json').text(); const value = JSON.parse(text); const keys = Object.keys(value); if (keys.length !== 1 || keys[0] !== 'follow_ups' || !Array.isArray(value.follow_ups) || value.follow_ups.length < 3 || value.follow_ups.length > 5 || value.follow_ups.some((item) => typeof item !== 'string' || !item.trim())) process.exit(1)"`, saving the result to `.sisyphus/evidence/task-4-parse.txt`.
    Expected: Command exits 0 and confirms the exact schema contract.
    Evidence: .sisyphus/evidence/task-4-parse.txt

  Scenario: Raw output contract check
    Tool: Bash
    Steps: Inspect `.sisyphus/evidence/task-4-output.json` for backticks, markdown headings, or text outside the JSON object and save the checklist to `.sisyphus/evidence/task-4-contract-check.md`.
    Expected: Every contract item passes; any extra prose, extra key, wrong count, or empty string fails the task.
    Evidence: .sisyphus/evidence/task-4-contract-check.md
  ```

  **Commit**: NO | Message: `n/a` | Files: []

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- No repository commit is required because the deliverable is a conversational JSON response, not a source-code change.
- If an execution framework persists artifacts, limit tracked changes to `.sisyphus/evidence/**` only.

## Success Criteria
- The final assistant response is valid JSON only.
- The JSON contains 3-5 concise Korean follow-up prompts a real user could plausibly ask next.
- The prompts are grounded in the full visible chat history, with strongest weighting on the latest diagnosis summary.
- The prompts do not drift into code execution, translation, or unrelated repo workflow.
- Evidence files demonstrate schema compliance, semantic uniqueness, recency alignment, and grounding in the visible chat history.
