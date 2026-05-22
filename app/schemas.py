from pydantic import BaseModel

class ChatRequest(BaseModel):
    session_id: str
    message: str

class ChatResponse(BaseModel):
    answer: str

class KnowledgeRequest(BaseModel):
    title: str
    content: str