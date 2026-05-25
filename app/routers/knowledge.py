from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas import KnowledgeRequest
from app.services.vector_service import (
    add_text_to_vector_store,
    add_pdf_to_vector_store
)

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

@router.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        return await add_pdf_to_vector_store(file)
    
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )
    
    except Expection as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload PDF: {str(error)}"
        )
