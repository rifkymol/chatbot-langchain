from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.database import Base, engine
from app.routers import chat, knowledge

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Chatbot API",
    description="FastAPI + LangChain + LangGraph + PostgreSQL + pgvector",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(knowledge.router)


@app.get("/")
def root():
    return {
        "message": "AI Chatbot API is running"
    }
