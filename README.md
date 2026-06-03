# AI Chatbot API

Full-stack RAG chatbot app with a FastAPI backend and a minimal Next.js frontend.

The backend stores chat history, ingests text/PDF knowledge, searches relevant chunks with pgvector, and generates answers with OpenAI through LangChain/LangGraph. The frontend provides a simple chatbot UI with PDF upload, knowledge source selection, multi-source filtering, and knowledge deletion.

## Stack

Backend:

- Python 3.13+
- FastAPI
- LangChain
- LangGraph
- OpenAI API
- PostgreSQL
- pgvector
- SQLAlchemy
- PyPDF / PyMuPDF

Frontend:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- lucide-react icons

Infrastructure and tooling:

- Docker Compose for PostgreSQL + pgvector
- Uvicorn for the backend dev server
- npm for the frontend dev server
- Python `unittest`
- ESLint

## Project Structure

```text
.
├── app/                 # FastAPI backend
│   ├── routers/         # API routes
│   ├── services/        # Chat, graph, and vector services
│   ├── main.py          # FastAPI app entrypoint
│   └── schemas.py       # Request/response models
├── frontend/            # Next.js frontend
├── tests/               # Backend unit/API tests
├── docker-compose.yml   # PostgreSQL + pgvector
├── requirements.txt     # Python dependencies
└── README.md
```

## Requirements

- Python 3.13+
- Node.js 20.9+
- npm
- Docker Desktop
- OpenAI API key with available quota

## Environment

Create a backend `.env` file in the project root:

```env
OPENAI_API_KEY=your_openai_api_key
DATABASE_URL=postgresql+psycopg://chatbot_user:chatbot_password@localhost:5432/chatbot_db
COLLECTION_NAME=knowledge_base
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001
```

Optional OpenAI model overrides:

```env
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_CHAT_MODEL=gpt-4.1-nano
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

Create a frontend env file at `frontend/.env.local` if you need to change the API URL:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## Run Locally

Start PostgreSQL with pgvector:

```bash
docker compose up -d
```

Create and activate a Python virtual environment:

```bash
python -m venv venv
venv\Scripts\activate
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

Start the backend:

```bash
uvicorn app.main:app --reload
```

The backend runs at:

```text
http://127.0.0.1:8000
```

Open API docs:

```text
http://127.0.0.1:8000/docs
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

Start the frontend:

```bash
npm run dev
```

The frontend runs at:

```text
http://127.0.0.1:3000
```

## Frontend Features

- Minimal chatbot interface.
- Fixed-height chat panel with internal scroll for long conversations.
- Custom mode dropdown.
- Multi-source knowledge filtering.
- PDF upload for adding knowledge.
- Knowledge list with duplicate PDF names collapsed.
- Knowledge delete action.
- Success/error status popup for upload and delete actions.

## API Endpoints

Health check:

```http
GET /
```

Chat:

```http
POST /chat
```

Example body:

```json
{
  "session_id": "user_001",
  "message": "Apa isi dokumen ini?",
  "mode": "auto",
  "source": ["manual.pdf", "faq.pdf"]
}
```

Example response:

```json
{
  "answer": "...",
  "intent": "qa",
  "sources": []
}
```

Add text knowledge:

```http
POST /knowledge
```

Upload PDF knowledge:

```http
POST /knowledge/upload-pdf
```

Optional upload query params:

```text
analyze_images=false
max_images=
fallback_render_pages=false
max_render_pages=3
```

List knowledge sources:

```http
GET /knowledge/sources
```

Delete a knowledge source:

```http
DELETE /knowledge/source?source=manual.pdf
```

Summarize a knowledge source:

```http
GET /knowledge/summary?source=manual.pdf
GET /knowledge/structured-summary?source=manual.pdf
```

Debug vector search:

```http
GET /knowledge/debug-search?query=manual&k=5
```

## Chat Modes

Supported mode values:

- `auto`
- `qa`
- `summary`
- `action_plan`
- `checklist`
- `priority`

When `auto` is used, the backend detects the intent from the question.

## Verification

Run backend tests:

```bash
.\venv\Scripts\python.exe -m unittest tests.test_api tests.test_graph_service tests.test_vector_service
```

Run backend syntax checks:

```bash
.\venv\Scripts\python.exe -m py_compile app\main.py app\config.py app\routers\chat.py app\routers\knowledge.py app\services\graph_service.py app\services\vector_service.py
```

Run frontend lint and build:

```bash
cd frontend
npm run lint
npm run build
```

## Notes

- If `/chat` returns `503`, check OpenAI billing/quota.
- Chat messages are stored in PostgreSQL.
- Knowledge content is split into chunks before being stored in pgvector.
- The frontend calls the backend URL from `NEXT_PUBLIC_API_BASE_URL`.
- If the frontend cannot call the backend, check `CORS_ORIGINS` in the backend `.env`.
