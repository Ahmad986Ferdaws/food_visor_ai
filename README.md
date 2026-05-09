# FoodVisor AI

Nutrition recommendation app that uses **three cooperating LLM agents** (context building, recommending, validating), **pgvector-backed RAG**, and async jobs (**Celery** + Redis). Built with **FastAPI** (`backend`) and **Next.js** (`frontend`).

## Architecture (high level)

- **Agent 1 — Context Builder** gathers user/context for the recommendation.
- **Agent 2 — Recommender** proposes meals or plans.
- **Agent 3 — Validator** checks output for consistency and constraints.
- **RAG + embeddings** support retrieval over your knowledge corpus (PostgreSQL + `pgvector`).
- **Workers** offload long-running recommendation flows via Celery.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose  
- Optional (local frontend only): Node.js **20+** and `npm`

## Quick start (Docker)

From the repo root:

1. **Environment**

   ```bash
   cp backend/.env.example backend/.env
   ```

   Edit `backend/.env`: set JWT secret, Anthropic/OpenAI keys, and embedding API key where needed.

2. **Start stack**

   ```bash
   docker compose up --build
   ```

   Services:

   | Service    | Purpose              | Ports        |
   |------------|----------------------|--------------|
   | `postgres` | DB + pgvector        | `5432`       |
   | `redis`    | Celery broker/backend| `6379`       |
   | `api`      | FastAPI + Uvicorn    | `8000`       |
   | `worker`   | Celery worker        | (internal)   |

3. **Database migrations**

   With containers running:

   ```bash
   docker compose exec api alembic upgrade head
   ```

4. **API docs**

   Open [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI).

## Frontend (Next.js)

The UI talks to the API over `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000/v1`).

**Option A — host machine**

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env.local` if the API URL is not default:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/v1
```

**Option B — add a `web` service later**  
Compose currently runs API + worker + DB + Redis only; extend `docker-compose.yml` if you want the app in Docker.

## Environment variables

Authoritative templates live in **`backend/.env.example`**. Important groups:

| Area        | Examples |
|------------|----------|
| App / logs | `APP_ENV`, `LOG_LEVEL` |
| Database   | `DATABASE_URL` (must match Postgres user/password/DB — see Compose) |
| Auth       | `JWT_SECRET`, `JWT_EXPIRATION_MINUTES` |
| CORS       | `FRONTEND_URL` |
| Agents     | `AGENT1_*`, `AGENT2_*`, `AGENT3_*` (Anthropic/OpenAI providers and keys) |
| Embeddings | `EMBEDDING_*`, `EMBEDDING_API_KEY` |
| RAG        | `RAG_TOP_K`, `RAG_CHUNK_SIZE`, etc. |
| Celery     | `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` |

**Do not commit** real secrets — `backend/.env` and frontend env files are gitignored.

## Repository layout

```text
backend/        # FastAPI app, Alembic, Celery orchestration
frontend/       # Next.js 16 App Router UI
docker-compose.yml
```

## Troubleshooting

- **Migrations failing**: ensure Postgres is healthy (`docker compose ps`) and `DATABASE_URL` in `backend/.env` matches Compose credentials (`foodvisor` / `foodvisor_dev` / DB `foodvisor` by default).
- **Recommendation jobs stall**: confirm the **`worker`** service is running and Redis URLs match in `.env`.

## License

Add a `LICENSE` file if you want to publish under a specific license.
