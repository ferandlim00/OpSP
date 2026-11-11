# Stack
- Backend: Go (Fiber) | Layered Architecture
- Frontend: Next.js (TypeScript, PostCSS)
- Database: MySQL (manual/raw parameterized SQL queries, NO auto-generators)

# Primary Focus Directories (Check Here First)
1. BE Handlers: `backend/handlers/` (HTTP req/res, validation)
2. BE Services: `backend/services/` (Core business logic)
3. FE Source: `frontend/src/` (Pages, components, API hooks/fetchers)

# Secondary Map (Read ONLY when needed)
- Entry/Config: `backend/cmd/`, `backend/config/`
- Routing & Auth: `backend/routes/`, `backend/middleware/`
- Data & DB: `backend/models/`, `backend/repositories/`
- Helpers: `backend/utils/`

# Token & Scan Guardrails (STRICT)
- NEVER read/scan/grep: `frontend/node_modules/`, `frontend/.next/`, `frontend/public/`, `backend/uploads/`, `*.lock`, `package-lock.json`, `go.sum`, `*.tsbuildinfo`, `.env`
- Max file reads/turn: 4 files. Do NOT run full-repo search; jump directly to Focus Directories above.
- Cross-layer tasks: Trace `routes` -> `handlers` -> `services` -> `repositories` sequentially.
- Output style: Telegraphic, technical, zero fluff/pleasantries.
- Code edits: Apply targeted diffs/patches only. NEVER rewrite entire files in chat.

# Commands
- BE Test (targeted): `cd backend && go test ./services/...`
- FE Check: `cd frontend && npm run lint`