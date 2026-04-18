# HealAll — Activity Log

Newest entries at the top. Each agent adds one entry at the end of a task. See `CLAUDE.md` → "Before You Finish — Log What You Did" for the format and rules.

---

## 2026-04-19 — CLAUDE.md rework + activity log introduced
**Agent**: coder (sonnet-4.6)
**Scope**: Rewrite `CLAUDE.md` to be less strict / more judgment-based, add a cross-session activity log requirement, provide an improved onboarding prompt for fresh agents.
**Changes**:
- `CLAUDE.md`: replaced blanket NEVER/ALWAYS rules with a "Working Style" section; added "When in Doubt" lookup table, "Likely First Tasks", and "Before You Finish — Log What You Did" section.
- `docs/ACTIVITY_LOG.md`: new file — handoff log for future agents (this entry is the seed).
- Removed dead claude-flow / ruflo MCP config from `.mcp.json`.
- Committed and pushed `backend/app/main.py` (slowapi import fix) + `backend/pyproject.toml` (hatch wheel config) as commit `8375cbb` on `development`.
**Tests**: not run — changes were docs/config only.
**Follow-ups**: none. Next agent should start with the CLAUDE.md "Likely First Tasks" list — most leverage is wiring `GET /v1/feed`.

---
