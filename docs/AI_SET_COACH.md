# AI Set Coach — Feature Specification

Status: **Initial implementation complete; MiniMax credential required for provider responses**  
Provider: **MiniMax**  
Initial surface: active workout logger only

## 1. Objective

Add an on-demand coaching control to each exercise card during a workout. After completing any set, the user can ask for concise feedback about:

- whether the load and reps were appropriate;
- what weight and rep target to use for the next set;
- whether to repeat, increase, or reduce the load;
- technique-aware reminders and brief encouragement.

This is a set-level assistant, not a general chat interface and not a replacement for the deterministic progression engine.

## 2. User experience

### Placement

Add an `Ask Coach` button in the exercise footer beside `Add set`, volume, e1RM, and PR feedback. It remains available throughout an in-progress session.

### Interaction

1. User completes at least one set.
2. User selects `Ask Coach`.
3. The button enters a loading state: `Reviewing sets…`.
4. A compact coaching panel opens inside the exercise card.
5. The panel gives one primary action, a short explanation, and encouragement.

Example:

> **Use 50 lb again · Aim for 10–12 reps**  
> You reached 12 reps at RIR 2, which is inside the target. Repeat the load and keep the same depth and tempo. Strong set.

### Response display

The panel must contain:

- action badge: `INCREASE`, `REPEAT`, `REDUCE`, `STOP`, or `NO CHANGE`;
- recommended next-set weight, when appropriate;
- recommended rep target;
- explanation limited to two short sentences;
- optional safety warning;
- `Refresh advice` and `Dismiss` controls.

If no set has been completed, disable the button and show: `Complete a set to ask the coach.`

## 3. Coaching inputs

Send only structured training context required for the decision:

- exercise name and equipment;
- prescribed sets, rep range, and RIR range;
- completed sets in the current exercise: weight, reps, RIR, and order;
- remaining prescribed sets;
- prior two completed non-deload sessions for the same progression slot;
- current deterministic progression recommendation;
- whether the current week is a deload;
- latest recovery score and band, if logged;
- configured weight increment;
- bodyweight only for bodyweight exercises.

Do not send free-form workout, recovery, nutrition, or measurement notes in v1. They may contain unnecessary personal information.

## 4. Decision ownership

The existing progression engine remains the source of truth. Before calling MiniMax, the server computes a bounded recommendation:

- candidate next weight;
- allowed action set;
- minimum and maximum reasonable weight;
- target rep range;
- fatigue/deload constraints.

MiniMax explains the result and may choose within the server-provided range. The server validates the response and clamps or rejects values outside that range.

### Loading guardrails

- Never recommend an increase after a set below the prescribed minimum reps.
- Never recommend an increase when reported RIR is below the target.
- Never exceed one configured weight increment between sets.
- Prefer repeating the load when evidence is ambiguous.
- During deloads, never exceed the deterministic deload weight.
- With recovery below 40, do not recommend increasing load.
- `STOP` is the only recommendation when the user reports pain, dizziness, loss of control, or another acute warning signal.
- Never recommend testing a one-rep maximum during a normal workout.

## 5. Response contract

The provider adapter must return this internal shape:

```ts
type SetCoachResponse = {
  action: "INCREASE" | "REPEAT" | "REDUCE" | "STOP" | "NO_CHANGE";
  nextWeight: number | null;
  repMin: number | null;
  repMax: number | null;
  headline: string;
  explanation: string;
  encouragement: string;
  safetyWarning: string | null;
};
```

Validate every response on the server. Invalid JSON, missing fields, out-of-range weights, or unsafe recommendations fall back to a deterministic response generated locally.

## 6. MiniMax integration

### Configuration

```env
MINIMAX_API_KEY=
MINIMAX_MODEL=MiniMax-M3
MINIMAX_API_URL=https://api.minimax.io/v1/text/chatcompletion_v2
```

The key must remain server-side and must never use a `NEXT_PUBLIC_` prefix.

### Transport

Use the MiniMax M3 text-generation endpoint:

```text
POST https://api.minimax.io/v1/text/chatcompletion_v2
Authorization: Bearer $MINIMAX_API_KEY
Content-Type: application/json
```

Keep provider code behind `lib/ai/set-coach-provider.ts` so MiniMax can be replaced without changing workout components or domain logic.

Recommended request behavior:

- non-streaming for the initial release;
- 8-second timeout;
- one retry only for network errors or HTTP 429/5xx;
- short completion limit because the UI requires a concise answer;
- no client-side call to MiniMax;
- redact the API response from production logs.

Prompt M3 for JSON, parse strictly, validate, and fall back locally. Tool calling may be evaluated later if it produces more reliable structured responses.

## 7. Application architecture

### Proposed files

```text
components/workout/SetCoachButton.tsx
components/workout/SetCoachPanel.tsx
lib/actions/set-coach.ts
lib/ai/set-coach-context.ts
lib/ai/set-coach-guardrails.ts
lib/ai/set-coach-provider.ts
lib/ai/set-coach-prompt.ts
```

### Request flow

```text
Ask Coach
  → server action validates session and exercise
  → server loads authoritative set/history/recovery data
  → deterministic guardrails calculate allowed recommendation range
  → provider adapter calls MiniMax
  → server validates and clamps structured response
  → UI renders coaching panel
```

The client sends only `sessionExerciseId`. Weight, reps, history, and targets are reloaded on the server so the user cannot fabricate prompt context.

## 8. Persistence and cost controls

V1 does not need to persist coaching messages. Cache the latest response in component state and request fresh advice only on explicit user action.

- Disable repeated clicks while a request is active.
- Apply a short per-exercise cooldown, recommended 10 seconds.
- Limit response length.
- Show deterministic local advice when the API is unavailable.
- Record aggregate latency/error metrics without logging training data or prompts.

If conversation history is added later, introduce a dedicated `SetCoachEvent` model rather than storing AI text in workout notes.

## 9. Safety and copy rules

- Describe the feature as training feedback, not medical advice.
- Never diagnose an injury or tell the user to train through pain.
- If pain or acute symptoms are reported, advise stopping the set and seeking appropriate professional help.
- Avoid guaranteed outcomes and absolute claims.
- Keep encouragement specific to logged performance; do not fabricate progress.
- Explain uncertainty when RIR is missing or the user has little history.

## 10. Failure states

| Condition | User-facing behavior |
|---|---|
| No completed set | Button disabled |
| API key missing | Show deterministic local recommendation |
| Timeout/network error | `Coach is unavailable; using your logged-set recommendation.` |
| Provider rate limit | Same fallback; allow retry after cooldown |
| Invalid provider output | Discard it and use deterministic fallback |
| Session already completed | Advice remains view-only; no next-set recommendation |

## 11. Acceptance criteria

- `Ask Coach` is available on every in-progress exercise after one completed set.
- Advice uses authoritative server-loaded workout data.
- The response recommends a next weight and reps or explicitly explains why it cannot.
- No recommendation can escape deterministic loading, fatigue, and deload bounds.
- The API key never reaches browser code or rendered HTML.
- The feature remains usable with a deterministic fallback when MiniMax fails.
- Median response latency is measured; initial target is under 5 seconds with MiniMax M3.
- Advice is concise enough to read between sets without scrolling.
- Existing set logging and workout completion remain unaffected if AI is unavailable.

## 12. Out of scope for the initial release

- open-ended chat;
- voice coaching;
- automatic calls after every set;
- autonomous changes to program templates;
- form analysis from video or camera input;
- injury diagnosis or rehabilitation advice;
- long-term AI memory across training blocks.

## 13. Implementation sequence

1. Build and test deterministic set-level recommendation bounds.
2. Add the server-only MiniMax provider adapter and response validation.
3. Add the server action using authoritative database context.
4. Add `Ask Coach` and the inline coaching panel.
5. Add timeout, fallback, cooldown, and error instrumentation.
6. Test first-session, mixed-weight, low-RIR, fatigue, deload, API failure, and completed-session cases.

## References

- [MiniMax M3](https://www.minimax.io/models/text/m3)
- [MiniMax text-generation API](https://platform.minimax.io/docs/api-reference/text-post)
- [MiniMax API-key guidance](https://platform.minimax.io/docs/faq/about-apis)
