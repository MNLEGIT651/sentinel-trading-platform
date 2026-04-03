# Agent Chat UI Audit — AUD-07

_Created: 2026-07-18_
_Ticket: AUD-07_
_Scope: `apps/web/src/app/(dashboard)/advisor/`, advisor components/hooks/API routes, agent system integration_

---

## 1. Current Capabilities

### Page Structure (`advisor/page.tsx`)

| Feature                    | Status | Notes                                                          |
| -------------------------- | ------ | -------------------------------------------------------------- |
| Page header with icon      | ✅     | Sparkles icon, title, subtitle                                 |
| Investor profile editor    | ✅     | `ProfileEditor` — edit risk tolerance, experience, goals       |
| Memory panel (preferences) | ✅     | `MemoryPanel` — add/edit/confirm/dismiss preferences; timeline |
| Conversation threads       | ✅     | `ThreadList` — create, select, delete threads                  |
| Thread messages            | ✅     | `ThreadMessages` — send/receive messages in a thread           |
| Loading skeleton           | ✅     | `loading.tsx` with skeleton cards and table                    |
| Tabbed layout              | ✅     | Memory tab + Conversations tab                                 |

### Components (`components/advisor/`)

| Component                   | Purpose                                                    | Quality       |
| --------------------------- | ---------------------------------------------------------- | ------------- |
| `thread-messages.tsx`       | Message list + input; POST to API; timestamps              | Good baseline |
| `thread-list.tsx`           | Thread CRUD; relative-time display; create/delete          | Good baseline |
| `profile-editor.tsx`        | Profile form with completeness meter; view/edit toggle     | Solid         |
| `memory-panel.tsx`          | Preferences by category; pending confirmations; timeline   | Solid         |
| `preference-card.tsx`       | Inline edit/confirm/dismiss per preference                 | Solid         |
| `memory-timeline.tsx`       | Audit trail of memory events with icons + relative time    | Solid         |
| `confidence-meter.tsx`      | 0-100% confidence bar with color coding                    | Good          |
| `explanation-section.tsx`   | Fetch + display recommendation explanations                | Good          |
| `explanation-card.tsx`      | Collapsible card: confidence, factors, risks, alternatives | Good          |
| `explanation-factors.tsx`   | Sub-components: FactorList, PreferencesUsed, RiskList      | Good          |
| `pending-confirmations.tsx` | Alert header for pending preference actions                | Good          |

### Hooks (`hooks/queries/`, `hooks/mutations/`)

| Hook                          | Endpoint                                 | Notes                                 |
| ----------------------------- | ---------------------------------------- | ------------------------------------- |
| `useAdvisorThreadsQuery`      | GET `/api/advisor/threads`               | No pagination/filter params exposed   |
| `useAdvisorMessagesQuery`     | GET `/api/advisor/threads/{id}/messages` | Default 50 messages                   |
| `useAdvisorProfileQuery`      | GET `/api/advisor/profile`               | Auto-creates default on first access  |
| `useAdvisorPreferencesQuery`  | GET `/api/advisor/preferences`           | Filters: status, category; max 200    |
| `useAdvisorMemoryEventsQuery` | GET `/api/advisor/memory-events`         | Filter by preferenceId; max 100       |
| `useAgentStatusQuery`         | `agentsClient.getStatus()`               | 5s refetch interval                   |
| `useCreateThreadMutation`     | POST `/api/advisor/threads`              | Invalidates thread list               |
| `useDeleteThreadMutation`     | DELETE `/api/advisor/threads/{id}`       | Invalidates thread list               |
| `useAdvisorProfileMutation`   | PATCH `/api/advisor/profile`             | Invalidates profile + memoryEvents    |
| Preference mutations (5)      | CRUD + confirm/dismiss                   | Invalidate preferences + memoryEvents |

### API Routes (`app/api/advisor/`)

| Route                                   | Methods            | Auth | Rate-Limited |
| --------------------------------------- | ------------------ | ---- | ------------ |
| `/api/advisor/threads`                  | GET, POST          | ✅   | ✅           |
| `/api/advisor/threads/{id}`             | GET, PATCH, DELETE | ✅   | ✅           |
| `/api/advisor/threads/{id}/messages`    | GET, POST          | ✅   | ✅           |
| `/api/advisor/profile`                  | GET, PATCH         | ✅   | ✅           |
| `/api/advisor/preferences`              | GET, POST          | ✅   | ✅           |
| `/api/advisor/preferences/{id}`         | PATCH, DELETE      | ✅   | ✅           |
| `/api/advisor/preferences/{id}/confirm` | POST               | ✅   | ✅           |
| `/api/advisor/preferences/{id}/dismiss` | POST               | ✅   | ✅           |
| `/api/advisor/memory-events`            | GET                | ✅   | ✅           |
| `/api/advisor/context`                  | GET                | ✅   | ✅           |

### Agent System Connection

- Research Analyst workflow (P1) triggered via `POST /api/agents/research/ticker`
- Fire-and-forget: returns `{ job_id, status: 'started' }` immediately
- Results stored in Supabase (`agent_logs`, `agent_recommendations`)
- Web proxy at `/api/agents/[...path]` forwards with JWT auth + correlation ID
- Typed client: `agentsClient` in `apps/web/src/lib/agents-client.ts`
- Orchestrator status polled at 5s interval via `useAgentStatusQuery`

---

## 2. Missing Features — Prioritized by Impact

### P0 — Critical for Production Chat UX

| #   | Gap                                | Impact                                              | Current State                            |
| --- | ---------------------------------- | --------------------------------------------------- | ---------------------------------------- |
| 1   | **No message streaming**           | UI feels dead during long agent responses           | POST/GET cycle only; no SSE or WebSocket |
| 2   | **No markdown rendering**          | Agent responses with code/tables render as raw text | `whitespace-pre-wrap` plain text only    |
| 3   | **No error boundary**              | Unhandled errors crash entire advisor page          | ✅ Fixed in this ticket (`error.tsx`)    |
| 4   | **No retry logic on send failure** | Network flickers lose messages                      | ✅ Fixed in this ticket (retry button)   |
| 5   | **No connection status indicator** | User doesn't know if agents are available           | ✅ Fixed in this ticket (status badge)   |

### P1 — Important for Quality

| #   | Gap                                | Impact                            | Current State              |
| --- | ---------------------------------- | --------------------------------- | -------------------------- |
| 6   | **No optimistic message updates**  | Lag before sent message appears   | Waits for server roundtrip |
| 7   | **No delete confirmation dialog**  | Accidental deletion with no undo  | Delete fires immediately   |
| 8   | **Thread search/filter missing**   | Can't find old conversations      | Sorted by date only        |
| 9   | **No message pagination UI**       | Can't scroll through long threads | Always fetches first 50    |
| 10  | **No auto-scroll on new messages** | ✅ Fixed in this ticket           | Added `scrollIntoView`     |

### P2 — Nice-to-Have for Polish

| #   | Gap                              | Impact                           | Current State                       |
| --- | -------------------------------- | -------------------------------- | ----------------------------------- |
| 11  | **No auto-refetch for threads**  | Multi-tab users see stale data   | No polling interval                 |
| 12  | **Delete button accessibility**  | Hidden until hover               | `opacity-0 group-hover:opacity-100` |
| 13  | **Rolling summary unused**       | Summaries stored but never shown | `rolling_summary` field exists      |
| 14  | **Preference pagination capped** | Power users lose visibility      | Hardcoded 200 limit                 |
| 15  | **Timeline capped at 20 events** | Can't review full history        | No pagination                       |
| 16  | **No batch confirm/dismiss**     | Tedious for many pending prefs   | One-at-a-time only                  |

---

## 3. Recommended Implementation Approach

### Phase 1 — Resilience (this ticket) ✅

1. ✅ Added `error.tsx` error boundary for the advisor route segment
2. ✅ Added retry button on message send failure (content preserved)
3. ✅ Added agent online/offline status badge in page header
4. ✅ Added sending indicator and auto-scroll

### Phase 2 — Rich Message Rendering (next sprint)

1. Integrate `react-markdown` + `remark-gfm` for markdown
2. Add `rehype-highlight` or `shiki` for code syntax highlighting
3. Support citation rendering (link agent source references)
4. Render metadata badges on assistant messages (model, latency, tools)

### Phase 3 — Streaming (requires agent system changes)

1. Extend `/research/ticker` to support SSE (`Accept: text/event-stream`)
2. Add `useStreamingMessage` hook for SSE event consumption
3. Render partial content as tokens arrive
4. Show "thinking" indicator with tool-call labels during processing
5. Structured event protocol: `thinking`, `tool_call`, `tool_result`, `content_delta`, `done`

### Phase 4 — Thread Management Polish

1. Thread search (title substring match)
2. Confirmation dialog for delete (`AlertDialog`)
3. Message pagination with infinite scroll
4. Auto-scroll with "new messages" indicator
5. Display thread rolling summary in list

---

## 4. Agent System Dependencies

| Dependency                      | Status                  | Required For                             |
| ------------------------------- | ----------------------- | ---------------------------------------- |
| Research Analyst workflow (P1)  | ✅ Implemented          | Deep ticker analysis via chat            |
| Agent orchestrator + server     | ✅ Running on port 3001 | All agent communication                  |
| `/api/agents/[...path]` proxy   | ✅ Implemented          | Web-to-agents auth + routing             |
| `agentsClient` typed wrapper    | ✅ Implemented          | React Query integration                  |
| SSE/streaming from agent server | ❌ Not implemented      | Phase 3 streaming responses              |
| Structured event protocol       | ❌ Not designed         | Phase 3 streaming UX                     |
| Research → thread bridge        | ❌ Not implemented      | Show research results in conversation    |
| Research result caching         | ❌ Not implemented      | Avoid duplicate research within cooldown |

### Key Integration Gap

Research results land in `agent_logs`/`agent_recommendations` tables, not in `advisor_threads`/`advisor_messages`. The chat UI and research workflow are disconnected. Integration requires writing research results back as `AdvisorMessage` records with `role: 'assistant'`.

---

## 5. Test Coverage

| Area               | Tests   | Notes                        |
| ------------------ | ------- | ---------------------------- |
| Advisor page       | ❌ None | No unit or integration tests |
| Advisor components | ❌ None | No component tests           |
| Advisor hooks      | ❌ None | No hook tests                |
| Advisor API routes | ❌ None | No route handler tests       |
| Agent integration  | ❌ None | No E2E chat flow tests       |

**Recommendation:** Start with API route tests (highest stability value), then component tests for `ThreadMessages` and `ThreadList`.

---

## 6. Quality Improvements Made (This Ticket)

| Improvement              | File                  | Description                                         |
| ------------------------ | --------------------- | --------------------------------------------------- |
| Route error boundary     | `advisor/error.tsx`   | Catches unhandled errors; shows retry card          |
| Message send retry       | `thread-messages.tsx` | Inline retry button; preserves failed content       |
| Error state for messages | `thread-messages.tsx` | Shows "Failed to load" with retry when query errors |
| Sending indicator        | `thread-messages.tsx` | Animated spinner + "Sending…" text during mutation  |
| Auto-scroll              | `thread-messages.tsx` | Scrolls to bottom on new messages via `useRef`      |
| Agent status badge       | `advisor/page.tsx`    | Shows "Agents Online/Offline" from app store        |
