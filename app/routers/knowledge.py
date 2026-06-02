from fastapi import APIRouter, File, HTTPException, UploadFile, Query

from app.schemas import KnowledgeRequest
from app.services.chat_service import (
    generate_document_summary,
    generate_structured_document_summary,
)
from app.services.vector_service import (
    add_text_to_vector_store,
    add_pdf_to_vector_store,
    search_relevant_docs,
    list_knowledge_sources,
    delete_knowledge_by_source,
    get_documents_by_source,
    
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
async def upload_pdf(
    file: UploadFile = File(...),
    analyze_images: bool = Query(False, description="Analyze PDF embedded images using a vision model"),
    max_images: int | None = Query(None, description="Maximum embedded images to analyze"),
    fallback_render_pages: bool = Query(False, description="Render low-text pages if no embedded image analysis is found"),
    max_render_pages: int = Query(3, description="Maximum rendered pages to analyze as fallback"),
):
    try:
        return await add_pdf_to_vector_store(
            file=file,
            analyze_images=analyze_images,
            max_images=max_images,
            fallback_render_pages=fallback_render_pages,
            max_render_pages=max_render_pages,
        )
    
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
    
@router.get("/summary")
def summarize_knowledge_source(
    source: str = Query(..., description="Exact source/title to summarize"),
    limit: int = Query(20, description="Maximum chunks to summarize")
):
    try:
        docs = get_documents_by_source(source=source, limit=limit)

        if not docs:
            raise HTTPException(
                status_code=404,
                detail="Knowledge source not found"
            )
        
        context = "\n\n".join([
            f"Chunk {index + 1}:\n{doc['content']}"
            for index, doc in enumerate(docs)
        ])

        summary = generate_document_summary(
            source=source,
            context=context
        )

        return {
            "source": source,
            "summary": summary,
            "chunks_used": len(docs)
        }
    
    except HTTPException:
        raise

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )
    
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to summarize knowledge source: {str(error)}"
        )
    
@router.get("/structured-summary")
def structured_summary_knowledge_source(
    source: str = Query(..., description="Exact source/title to summarize"),
    limit: int = Query(20, description="Maximum chunks to summarize")
):
    try:
        docs = get_documents_by_source(source=source, limit=limit)

        if not docs:
            raise HTTPException(
                status_code=404,
                detail="Knowledge source not found"
            )

        context = "\n\n".join([
            f"Chunk {index + 1}:\n{doc['content']}"
            for index, doc in enumerate(docs)
        ])

        structured_summary = generate_structured_document_summary(
            source=source,
            context=context
        )

        return {
            "source": source,
            "chunks_used": len(docs),
            **structured_summary
        }

    except HTTPException:
        raise

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create structured summary: {str(error)}"
        )
    
@router.delete("/source")
def delete_knowledge_source(
    source: str = Query(..., description="Exact source/title to delete")
):
    try:
        return delete_knowledge_by_source(source)
    
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )
    
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete knowledge source: {str(error)}"
        )
    