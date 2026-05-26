from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, START, END

from app.services.vector_service import search_relevant_docs
from app.services.chat_service import generate_answer

class ChatState(TypedDict):
    question: str
    context: str
    chat_history: str
    source: str | None
    answer: str
    sources: List[Dict[str, Any]]

def extract_sources(docs):
    sources = []

    for doc in docs:
        metadata = doc.metadata or {}

        sources.append({
            "title": metadata.get("title"),
            "source": metadata.get("source"),
            "source_type": metadata.get("source_type"),
            "page": metadata.get("page"),
            "chunk_index": metadata.get("chunk_index"),
            "relevance_score": metadata.get("relevance_score"),
        })

    unique_sources = []
    seen = set()

    for source in sources:
        key = (
            source.get("source"),
            source.get("page"),
            source.get("chunk_index")
        )

        if key not in seen:
            seen.add(key)
            unique_sources.append(source)

    return unique_sources

def retrieve_context_node(state: ChatState):
    question = state["question"]

    summary_keywords = [
        "isi utama",
        "ringkas",
        "ringkasan",
        "summary",
        "summarize",
        "jelaskan dokumen",
        "dokumen ini",
    ]

    is_summary_question = any(
        keyword in question.lower()
        for keyword in summary_keywords
    )

    docs = search_relevant_docs(
        query=question,
        k=10 if is_summary_question else 4,
        min_score=0.25,
        source=state.get("source")
    )

    if not docs:
        return {
            "question": question,
            "context": "",
            "chat_history": state["chat_history"],
            "source": state.get("source"),
            "answer": "Saya tidak menemukan informasi yang relevan di dokumen.",
            "sources": [],
        }

    context = "\n\n".join([
        f"Source: {doc.metadata.get('source') or doc.metadata.get('title')}\n"
        f"Page: {doc.metadata.get('page')}\n"
        f"Content:\n{doc.page_content}"
        for doc in docs
    ])

    sources = extract_sources(docs)

    return {
        "question": question,
        "context": context,
        "chat_history": state["chat_history"],
        "answer": "",
        "sources": sources,
    }

def should_generate_answer(state: ChatState):
    if not state["context"]:
        return "end"
    
    return "generate"

def generate_answer_node(state: ChatState):
    answer = generate_answer(
        question=state["question"],
        context=state["context"],
        chat_history=state["chat_history"],
    )

    return {
        "question": state["question"],
        "context": state["context"],
        "chat_history": state["chat_history"],
        "source": state.get("source"),
        "answer": answer,
        "sources": state["sources"]
    }

def build_chat_graph():
    graph = StateGraph(ChatState)
    graph.add_node("retrieve_context", retrieve_context_node)
    graph.add_node("generate_answer", generate_answer_node)
    
    graph.add_edge(START, "retrieve_context")

    graph.add_conditional_edges(
        "retrieve_context",
        should_generate_answer,
        {
            "generate": "generate_answer",
            "end" : END,
        }
    )

    graph.add_edge("generate_answer", END)

    return graph.compile()

chat_graph = build_chat_graph()

def run_chatbot_graph(
    question: str,
    chat_history: str ="",
    source: str | None = None
):
    result = chat_graph.invoke({
        "question": question,
        "context": "",
        "chat_history": chat_history,
        "source": source,
        "answer": "",
        "sources": [],
    })

    return {
        "answer": result["answer"],
        "sources": result["sources"],
    }