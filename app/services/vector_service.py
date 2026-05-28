import os
import tempfile
from typing import List

from fastapi import UploadFile
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_postgres import PGVector
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy import text

from app.database import engine

from app.config import (
    DATABASE_URL,
    COLLECTION_NAME,
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    OPENAI_EMBEDDING_MODEL,
)
embeddings = OpenAIEmbeddings(
    model=OPENAI_EMBEDDING_MODEL,
    api_key=OPENAI_API_KEY,
    base_url=OPENAI_BASE_URL,
)

def get_vector_store():
    return PGVector(
        embeddings=embeddings,
        collection_name=COLLECTION_NAME,
        connection=DATABASE_URL,
        use_jsonb=True,
        create_extension=True,
    )

def split_documents(documents: List[Document]):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100
    )

    return splitter.split_documents(documents)

def add_text_to_vector_store(title: str, content: str):
    docs = split_documents([
        Document(
            page_content=content,
            metadata={
                "title": title,
                "source_type": "text"
            }
        )
    ])

    vector_store = get_vector_store()
    vector_store.add_documents(docs)

    return {
        "message": "Knowledge added successfully",
        "type": "text",
        "chunks": len(docs)
    }

async def add_pdf_to_vector_store(file: UploadFile):
    if not file.filename.lower().endswith(".pdf"):
        raise ValueError("Only PDF files are allowed")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_file_path = temp_file.name

    try:
        loader = PyPDFLoader(temp_file_path)
        documents = loader.load()

        chunks = split_documents(documents)

        for index, chunk in enumerate(chunks):
            chunk.metadata["title"] = file.filename
            chunk.metadata["source"] = file.filename
            chunk.metadata["source_type"] = "pdf"
            chunk.metadata["chunk_index"] = index
            
        vector_store = get_vector_store()
        vector_store.add_documents(chunks)

        return {
            "message": "PDF uploaded successfully",
            "type": "pdf",
            "filename": file.filename,
            "pages": len(documents),
            "chunks": len(chunks)
        }
    
    finally:
        os.remove(temp_file_path)

def search_relevant_docs(
    query: str,
    k: int=8,
    min_score: float = 0.25,
    source: str | None = None    
):

    vector_store = get_vector_store()

    search_kwargs = build_search_kwargs(
        query=query,
        k=k,
        source=source,
    )

    results = vector_store.similarity_search_with_relevance_scores(
        **search_kwargs
    )

    filtered_docs = []

    for doc, score in results:
        doc.metadata["relevance_score"] = score

        if score >= min_score:
            filtered_docs.append(doc)

    return filtered_docs

def build_search_kwargs(
    query: str,
    k: int=8,
    source: str | None = None
):
    search_kwargs = {
        "query": query,
        "k": k,
    }

    source = source.strip() if source else None

    if source:
        search_kwargs["filter"] = {
            "$or": [
                {"source": {"$eq": source}},
                {"title": {"$eq": source}},
            ]
        }

    return search_kwargs

def list_knowledge_sources():
    with engine.connect() as connection:
        result = connection.execute(text("""
            SELECT
                cmetadata->>'title' AS title,
                cmetadata->>'source' AS source,
                cmetadata->>'source_type' AS source_type,
                COUNT(*) AS chunks
            FROM langchain_pg_embedding
            GROUP BY
                cmetadata->>'title',
                cmetadata->>'source',
                cmetadata->>'source_type'
            ORDER BY title;
        """))

        sources = []

        for row in result:
            item = row._mapping

            sources.append({
                "title": item["title"],
                "source": item["source"],
                "source_type": item["source_type"],
                "chunks": item["chunks"],
            })

    return {
        "count": len(sources),
        "sources": sources
    }

def delete_knowledge_by_source(source: str):
    if not source or not source.strip():
        raise ValueError("Source is required")
    
    source = source.strip()

    with engine.begin() as connection:
        result = connection.execute(
            text("""
                DELETE FROM langchain_pg_embedding
                WHERE cmetadata->>'source' = :source
                OR    cmetadata->>'title' = :source
            """),
            {"source": source}
        )

        deleted_chunks = result.rowcount

    return {
        "message": "Knowledge source is deleted successfully",
        "source": source,
        "deleted_chunks": deleted_chunks
    }

def get_documents_by_source(source: str, limit: int = 20):
    if not source or not source.strip():
        raise ValueError("Source is required")
    
    source = source.strip()

    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    document,
                    cmetadata
                FROM langchain_pg_embedding
                WHERE cmetadata->>'source' = :source
                OR cmetadata->>'title' = :source
                ORDER BY
                    CAST(COALESCE(cmetadata->>'chunk_index', '0') AS INTEGER)
                LIMIT :limit 
        """),
        {
            "source": source,
            "limit": limit
        }
    )
        
    docs = []

    for row in result:
        item = row._mapping

        docs.append({
            "content": item["document"],
            "metadata": item["cmetadata"],
        })

    return docs
