# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: FastAPI server. Entry point in `backend/main.py`, dependencies in `backend/requirements.txt`, and local config in `backend/.env`.
- `frontend/`: Vite + React app. Source in `frontend/src` (`main.tsx`, `App.tsx`), styles in `frontend/src/index.css`, assets in `frontend/src/assets`, static files in `frontend/public`.
- Tooling config lives in `frontend/vite.config.ts`, `frontend/tailwind.config.js`, `frontend/eslint.config.js`, and `frontend/tsconfig*.json`.

## Build, Test, and Development Commands
Backend (run from `backend/`):
- `python -m venv venv` then activate and `pip install -r requirements.txt`
- `uvicorn main:app --reload` (dev server at `http://localhost:8000`)

Frontend (run from `frontend/`):
- `npm install`
- `npm run dev` (Vite dev server)
- `npm run build` (TypeScript build + Vite bundle)
- `npm run lint` (ESLint)
- `npm run preview` (serve production build)

## Coding Style & Naming Conventions
- Frontend uses TypeScript + React with ESLint recommended rules (`frontend/eslint.config.js`). Keep 2-space indentation, PascalCase components, and camelCase variables. Files follow `App.tsx`-style naming.
- Backend Python follows standard 4-space indentation and snake_case functions.
- No formatter is configured; avoid large reformat-only diffs.

## Testing Guidelines
- No test framework or test folders are configured yet.
- If you add tests, keep them near the layer they cover (for example `backend/tests` or `frontend/src/__tests__`) and add a script to run them.

## Commit & Pull Request Guidelines
- Git history only contains "first commit"; no established convention yet.
- Use short, imperative messages with optional scope, e.g., `frontend: add file viewer`.
- PRs should include a concise summary, run steps, and screenshots for UI changes. Link issues when relevant.

## Security & Configuration
- Backend expects `backend/.env` with `OPENAI_API_KEY`. Do not commit secrets.
- Agent mode can execute shell commands; treat untrusted instructions carefully.
