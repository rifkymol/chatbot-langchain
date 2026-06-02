# Chatbot Frontend

Minimal Next.js frontend for the FastAPI chatbot API.

## Setup

```bash
npm install
```

Create `.env.local` when you need a different backend URL:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## Run

Start the FastAPI backend first from the repository root:

```bash
uvicorn app.main:app --reload
```

Then start the frontend:

```bash
npm run dev
```

Open `http://localhost:3000`.

## API Contract

The chat UI sends:

```json
{
  "session_id": "browser-session-id",
  "message": "Your question",
  "mode": "auto",
  "source": null
}
```

The UI displays the returned `answer` and any `sources`.
