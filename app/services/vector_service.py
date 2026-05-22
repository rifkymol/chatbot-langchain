from langchain_openai import OpenAIEmbeddings
from langchain_postgres import PGVector
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from app.config import DATABASE_URL, COLLECTION_NAME

embeddings = OpenAIEmbeddings()


def get_vector_store():
    return PGVector(
        embeddings=embeddings,
        collection_name=COLLECTION_NAME,
        connection=DATABASE_URL,
        use_jsonb=True,
    )

def add_text_to_vector_store(title: str, content: str):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100
    )

    docs = splitter.split_documents([
        Document(
            page_content=content,
            metadata={"title": title}
        )
    ])

    vector_store = get_vector_store()
    vector_store.add_documents(docs)

    return {
        "message": "Knowledge added successfully",
        "chunks": len(docs)
    }

def search_relevant_docs(query: str, k: int=4):
    vector_store = get_vector_store()
    docs = vector_store.similarity_search(query, k=k)
    return docs