from fastapi import APIRouter
from app.schemas import KnowledgeRequest
from app.services.vector_service import add_text_to_vector_store

router = APIRouter(
    prefix="/knowledge",
    tags=["Knowledge"]
)


@router.post("")
def add_knowledge(payload: KnowledgeRequest):
    return add_text_to_vector_store(
        title=payload.title,
        content=payload.content
    )

