---
trigger: glob
globs: "frontend/src/**/*.{ts,tsx,js,jsx,css}"
---
# Next.js (TypeScript) Rules (STRICT)
- Architecture: Default to Server Components. Add `'use client'` ONLY when hooks (`useState`, `useEffect`) or browser events are required.
- Type Safety: Strict TypeScript. NO `any` type; match interfaces with `backend/models/` JSON tags.
- API Fetching: Centralize backend Go Fiber API calls & error handling inside `frontend/src/`. Handle loading & HTTP error states explicitly.
- Styling: Use existing project CSS/PostCSS setup. Keep JSX markup clean & modular.
- Imports: Use path aliases (`@/...`) as configured in `tsconfig.json`.
- Edits: Patch only changed components/hooks. NEVER dump full component files in chat if >50 lines.