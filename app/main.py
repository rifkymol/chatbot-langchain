from fastapi import FastAPI

from app.database import Base, engine
from app.routers import chat, knowledge

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Chatbot API",
    description="FastAPI + LangChain + LangGraph + PostgreSQL + pgvector",
    version="1.0.0"
)

app.include_router(chat.router)
app.include_router(knowledge.router)


@app.get("/")
def root():
    return {
        "message": "AI Chatbot API is running"
    }