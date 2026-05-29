# AI Chatbot API!

FastAPI chatbot API using LangChain, LangGraph, PostgreSQL, and pgvector.

## Features

- Chat endpoint with session-based message storage
- Knowledge ingestion endpoint
- Vector search with PostgreSQL pgvector
- RAG flow: retrieve relevant context, then generate an answer with OpenAI

## Requirements

- Python 3.13+
- Docker Desktop
- OpenAI API key with available quota

## Environment

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your_openai_api_key
DATABASE_URL=postgresql+psycopg://chatbot_user:chatbot_password@localhost:5432/chatbot_db
COLLECTION_NAME=knowledge_base
```

## Run Locally

Start PostgreSQL with pgvector:

```bash
docker compose up -d
```

Create and activate a virtual environment:

```bash
python -m venv venv
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the API:

```bash
uvicorn app.main:app --reload
```

Open the API docs:

```text
http://127.0.0.1:8000/docs
```

## Endpoints

### Health Check

```http
GET /
```

### Add Knowledge

```http
POST /knowledge
```

Example body:

```json
{
  "title": "POINTS",
  "content": "POINTS is a customer reward system..."
}
```

### Chat

```http
POST /chat
```

Example body:

```json
{
  "session_id": "user_001",
  "message": "Apa itu POINTS?"
}
```

Example response:

```json
{
  "answer": "..."
}
```

## Notes

- If `/chat` returns `503`, check your OpenAI API billing/quota.
- Chat messages are stored in PostgreSQL.
- Knowledge content is split into chunks before being stored in pgvector.
