from fastapi import APIRouter, File, HTTPException, UploadFile, Query

from app.schemas import KnowledgeRequest
from app.services.vector_service import (
    add_text_to_vector_store,
    add_pdf_to_vector_store,
    search_relevant_docs,
    list_knowledge_sources,
)

router = APIRouter(
    prefix="/knowledge",
    tags=["Knowledge"]
)


@router.post("")
def add_knowledge(payload: KnowledgeRequest):
    try:
        return add_text_to_vector_store(
            title=payload.title,
            content=payload.content
        )
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to add knowledge: {str(error)}"
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
    
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload PDF: {str(error)}"
        )
    
@router.get("/debug-search")
def debug_search(
    query: str = Query(..., description="Search query for vector database"),
    k: int = Query(5, description="Number of chunks to retrieve")
):
    try:
        docs = search_relevant_docs(query=query, k=k)

        return {
            "query": query,
            "count": len(docs),
            "results": [
                {
                    "index": index,
                    "content": doc.page_content,
                    "metadata": doc.metadata
                }
                for index, doc in enumerate(docs)
            ]
        }
    
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to debug search: {str(error)}"
        )
    
@router.get("/sources")
def get_knowledge_sources():
    try:
        return list_knowledge_sources()
    
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list knowledge sources: {str(error)}"
        )