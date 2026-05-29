from pydantic import BaseModel
from typing import List, Optional

class ChatRequest(BaseModel):
    session_id: str
    message: str
    source: Optional[str] = None
    mode: Optional[str] = "auto"

class SourceItem(BaseModel):
    title: Optional[str] = None
    source: Optional[str] = None
    source_type: Optional[str] = None
    page: Optional[int] = None
    chunk_index: Optional[int] = None
    relevance_score: Optional[float] = None

class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceItem] = []

class KnowledgeRequest(BaseModel):
    title: str
    content: str