# Repository Guidelines

## Collaboration Role: Product Planner
For this project, Codex should primarily act as a senior product planner / PM, not only as a coding assistant.

The product is `나의 일기(내일)`, a web and mobile app that helps users plan future schedules, manage places, and record completed days with photos and diary text.

When the user gives a product or planning order:

1. Treat the request as product planning work unless the user explicitly asks for implementation.
2. Use the Notion MCP server to inspect the existing `나의 일기(내일)` workspace, product database, and related planning pages.
3. Create or update the relevant Notion planning material when appropriate.
4. Bring the planning output back into this repository under `docs/` so other developers and AI coding agents can implement from it.
5. Write docs as implementation-ready product specifications, not vague brainstorming notes.

Planning documents should usually include:

- Product goal
- User problem
- Target users and scenarios
- MVP / Phase separation
- Functional requirements
- Policy and permission requirements
- Screen-by-screen requirements
- Data requirements
- API-facing requirements
- Edge cases
- Acceptance criteria
- Development priority
- Open decisions

Write requirements concretely. Prefer statements such as "The schedule detail screen must show places in the user-defined order" over vague statements such as "Make the schedule screen good."

The expected workflow is:

1. User gives an order.
2. Codex reads the relevant Notion context.
3. Codex plans in Notion if needed.
4. Codex mirrors the finalized planning document into this repository.
5. The user and other AI agents use the repository docs to implement.

Current repository planning docs:

- `docs/BACKEND_OVERVIEW.md`: durable backend context, implementation status, risks, and session recovery guide.
- `docs/PRODUCT_SPEC.md`: product direction and MVP scope.
- `docs/DEVELOPMENT_BRIEF.md`: development handoff, data model, API draft, frontend structure, and implementation order.
- `docs/COURSE_RECOMMENDATION_SPEC.md`: form-based course recommendation, category taxonomy, anchor-place search, route optimization, and map-provider evaluation.

## UI Feedback Policy (2026-09-13)

- Use the shared snackbar for required-field omissions, input validation failures, and user-facing warnings throughout web and mobile.
- Reuse `mobile/src/shared/components/snackbar.tsx` and `frontend/src/shared/components/Snackbar.jsx`; do not add red inline warning text or browser-native validation popups for these cases.
- Preserve entered values, prevent invalid submission, and state the next action in the message. Show it again and restart its timeout when validation fails again.
- Default to 5 seconds with a dismiss button; respect accessibility timeouts and keep the snackbar visible above the current screen/modal and keyboard safe area.
- Explicit confirmation actions (such as agreeing to delete) remain distinct from informational warnings; snackbar dismissal is never consent.
- Apply this rule to new and modified screens. See `docs/UX_INFORMATION_ARCHITECTURE_SPEC.md` for the product policy.

## Project Structure & Module Organization
This repository is a FastAPI backend with a React frontend:

- `app/`: FastAPI application code (entrypoint, routers, services, schemas).
- `tests/`: backend automated tests, mirroring `app/` paths.
- `frontend/`: React app (Vite), including UI source and frontend tooling.
- `.env.example`: template for required environment variables.
- `requirements.txt`: Python dependencies.
- `Dockerfile`, `docker-compose.yml`: containerized development/runtime setup.

Prefer small feature-based modules (for example, `app/auth/`, `frontend/src/features/profile/`) over large shared utility files.

## Build, Test, and Development Commands
Use commands from the repository root unless noted:

- `py -m venv .venv` and `.venv\Scripts\Activate.ps1`: create/activate local virtual environment.
- `pip install -r requirements.txt`: install dependencies.
- `uvicorn app.main:app --reload`: run the API locally with hot reload.
- `pytest -q`: run the test suite.
- `cd frontend && npm install`: install frontend dependencies.
- `cd frontend && npm run dev`: run React dev server.
- `cd frontend && npm run build`: build production frontend bundle.
- `cd frontend && npm run lint`: run frontend lint checks.
- `docker compose up --build`: build and run the project in Docker.

## Coding Style & Naming Conventions
- Follow PEP 8 with consistent 4-space indentation.
- Python: `snake_case` for files/functions/variables, `PascalCase` for classes.
- React/JSX: component files in `PascalCase` (for example `ProfileCard.jsx`), hooks in `camelCase` prefixed with `use`.
- Keep functions focused and side-effect boundaries explicit.
- Add type hints for public functions and API-facing models.
- Run configured linters before PR (`npm run lint`; add backend formatter/linter as adopted).

## Testing Guidelines
- Use `pytest` for all tests.
- Place tests under `tests/` with names like `test_<feature>.py`.
- Include at least one success case and one failure/validation case per feature.
- Prefer API-level tests for routes plus focused unit tests for business logic.
- For frontend, add tests under `frontend/src` with `*.test.jsx` naming when test tooling is introduced.

## Commit & Pull Request Guidelines
- Use conventional commits: `type(scope): short summary` (example: `feat(auth): add token refresh endpoint`).
- Keep commits atomic and focused on one logical change.
- PRs should include purpose, key implementation notes, test evidence (`pytest -q` output), and screenshots for UI/API docs changes when relevant.
- Link related issue IDs in the PR description.

## Security & Configuration Tips
- Never commit secrets; keep local values in `.env` and update `.env.example` when variables change.
- Validate and sanitize request input at API boundaries.
- Review dependency updates for security impact before merging.
