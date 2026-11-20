# ProspectAI

ProspectAI helps sales teams find relevant businesses, review evidence-backed research, prioritize prospects, and prepare personalized outreach drafts. Built by Krishna.

## Architecture

- **Frontend:** React 18 + Vite + Lucide, with a responsive dashboard, prospect table, research form, and source-aware lead detail view.
- **API:** FastAPI and Pydantic handle validation, web research, AI analysis, outreach drafts, lead status, and CSV export.
- **Research:** Tavily searches public web sources. OpenAI analyzes only returned source excerpts; the API keeps source URLs and evidence with each lead and rejects citations not in the search results.
- **Storage:** SQLAlchemy persists prospects in SQLite by default. Set `DATABASE_URL` to use another SQLAlchemy-supported database.
- **Human review:** Outreach is only generated and saved as a draft. Approval marks a lead Contacted; the app has no email sending integration.

## Run locally

Requirements: Python 3.10+ and Node.js 18+.

1. Configure the API:

   ```powershell
   cd backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   Copy-Item .env.example .env
   ```

2. Add valid `TAVILY_API_KEY` and `OPENAI_API_KEY` values to `backend/.env`. The API returns a clear configuration error until they are set; it does not use mock or demo research.

3. Start the API from the project root:

   ```powershell
   cd ..
   python -m uvicorn backend.main:app --reload
   ```

4. In a second terminal, start the UI:

   ```powershell
   npm install
   npm run dev
   ```

   Open the Vite URL (normally `http://localhost:5173`). The API is at `http://localhost:8000`; interactive API documentation is at `/docs`.

Optional frontend configuration: set `VITE_API_URL` to the deployed API base URL before building. Configure API `CORS_ORIGINS` to the frontend origin. For hosted deployments, use a persistent database and storage volume; the default SQLite file is local.

## API overview

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | API status and integration configuration |
| `GET` | `/api/dashboard` | Workspace metrics and recent activity |
| `POST` | `/api/research` | Search, analyze, and persist prospects |
| `GET` | `/api/leads` | Search/filter saved prospects |
| `PATCH` | `/api/leads/{id}` | Update lead status |
| `POST` / `PUT` | `/api/leads/{id}/outreach` | Generate or edit an outreach draft |
| `POST` | `/api/leads/{id}/approve` | Approve a saved draft (no external message is sent) |
| `GET` | `/api/leads.csv` | Export prospects |

## Tests

From the project root, install the backend dependencies and run:

```powershell
pip install -r backend/requirements.txt
pip install pytest httpx
python -m pytest backend/tests -q
```

Tests check validation, missing-integration handling, lead-score priority thresholds, and approval without a draft. External provider access is not mocked in application behavior; configure keys to perform real research.

## Deployment

Deploy the API as a Python web service with `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`, set provider keys and `CORS_ORIGINS`, and attach persistent storage or configure a managed database. Build the frontend with `npm run build` and publish `dist/` as a static site. Set `VITE_API_URL` at build time.

The GitHub Pages workflow publishes a frontend-only preview with no sample leads and no API connection. Live research, scoring, and outreach require a separately deployed API with valid provider credentials.

The backend can be deployed as a Docker service on Railway using the root `Dockerfile`. Set `OPENAI_API_KEY`, `TAVILY_API_KEY`, and `CORS_ORIGINS` as service variables; never commit them. Configure `/api/health` as the health check. The default SQLite database is ephemeral on hosted containers, so configure persistent storage or a managed database before relying on saved prospects.
