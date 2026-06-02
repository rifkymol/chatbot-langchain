from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, START, END

from app.services.chat_service import generate_answer
from app.services.vector_service import (
    search_relevant_docs,
    get_visual_documents_by_source,
)

class ChatState(TypedDict):
    question: str
    context: str
    chat_history: str
    source: str | list[str] | None
    mode: str | None
    intent: str
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
            "image_index": metadata.get("image_index"),
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

def detect_intent(question: str, mode: str | None = "auto"):
    allowed_modes = {
        "qa",
        "summary",
        "action_plan",
        "checklist",
        "priority",
    }

    if mode and mode != "auto" and mode in allowed_modes:
        return mode

    lowered_question = question.lower()

    action_keywords = [
        "minta aku ngapain",
        "harus ngapain",
        "apa yang harus dilakukan",
        "langkah apa",
        "next step",
        "action",
        "task",
        "todo",
    ]

    checklist_keywords = [
        "apa saja yang perlu dipersiapkan",
        "perlu disiapkan",
        "checklist",
        "persiapan",
        "siapkan",
    ]

    priority_keywords = [
        "mana dulu",
        "yang dilakukan dulu",
        "prioritas",
        "urutan",
        "sebaiknya dilakukan dulu",
        "mulai dari mana",
    ]

    summary_keywords = [
        "ringkas",
        "ringkasan",
        "summary",
        "isi utama",
        "dokumen ini tentang apa",
    ]

    if any(keyword in lowered_question for keyword in action_keywords):
        return "action_plan"

    if any(keyword in lowered_question for keyword in checklist_keywords):
        return "checklist"

    if any(keyword in lowered_question for keyword in priority_keywords):
        return "priority"

    if any(keyword in lowered_question for keyword in summary_keywords):
        return "summary"

    return "qa"

def detect_intent_node(state: ChatState):
    intent = detect_intent(
        question=state["question"],
        mode=state.get("mode", "auto")
    )

    return {
        "question": state["question"],
        "context": state["context"],
        "chat_history": state["chat_history"],
        "source": state.get("source"),
        "mode": state.get("mode", "auto"),
        "intent": intent,
        "answer": state["answer"],
        "sources": state["sources"],
    }

def is_visual_question(question: str):
    visual_keywords = [
        "gambar",
        "diagram",
        "flowchart",
        "screenshot",
        "tampilan",
        "ui",
        "mockup",
        "chart",
        "grafik",
        "visual",
        "arsitektur",
        "architecture",
        "wireframe",
        "layout",
    ]

    lowered_question = question.lower()

    return any(keyword in lowered_question for keyword in visual_keywords)

def is_visual_question(question: str):
    visual_keywords = [
        "gambar",
        "diagram",
        "flowchart",
        "screenshot",
        "tampilan",
        "ui",
        "mockup",
        "chart",
        "grafik",
        "visual",
        "arsitektur",
        "architecture",
        "wireframe",
        "layout",
        "screen",
        "desain",
        "design",
        "form",
        "table",
        "tabel",
    ]

    lowered_question = question.lower()

    return any(keyword in lowered_question for keyword in visual_keywords)

def retrieve_context_node(state: ChatState):
    question = state["question"]
    intent = state.get("intent", "qa")
    mode = state.get("mode", "auto")

    if is_visual_question(question) and state.get("source"):
        visual_docs = get_visual_documents_by_source(
            source=state.get("source"),
            limit=10,
        )

        if visual_docs:
            context = "\n\n".join([
                f"Source: {doc.metadata.get('source') or doc.metadata.get('title')}\n"
                f"Source Type: {doc.metadata.get('source_type')}\n"
                f"Page: {doc.metadata.get('page')}\n"
                f"Image Index: {doc.metadata.get('image_index')}\n"
                f"Content:\n{doc.page_content}"
                for doc in visual_docs
            ])

            sources = extract_sources(visual_docs)

            return {
                "question": question,
                "context": context,
                "chat_history": state["chat_history"],
                "source": state.get("source"),
                "mode": state.get("mode"),
                "intent": state["intent"],
                "answer": "",
                "sources": sources,
            }

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
            "mode": mode,
            "intent": intent,
            "answer": "Saya tidak menemukan informasi yang relevan di dokumen.",
            "sources": [],
        }

    context = build_context_from_docs(docs)
    sources = extract_sources(docs)

    return {
        "question": question,
        "context": context,
        "chat_history": state["chat_history"],
        "source": state.get("source"),
        "mode": state.get("mode"),
        "intent": state["intent"],
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
        intent=state["intent"],
    )

    return {
        "question": state["question"],
        "context": state["context"],
        "chat_history": state["chat_history"],
        "source": state.get("source"),
        "mode": state.get("mode"),
        "intent": state["intent"],
        "answer": answer,
        "sources": state["sources"]
    }

def build_chat_graph():
    graph = StateGraph(ChatState)
    graph.add_node("detect_intent", detect_intent_node)
    graph.add_node("retrieve_context", retrieve_context_node)
    graph.add_node("generate_answer", generate_answer_node)

    graph.add_edge(START, "detect_intent")
    graph.add_edge("detect_intent", "retrieve_context")

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
    chat_history: str = "",
    source: str | list[str] | None = None,
    mode: str | None = "auto"
):
    result = chat_graph.invoke({
        "question": question,
        "context": "",
        "chat_history": chat_history,
        "source": source,
        "mode": mode,
        "intent": "qa",
        "answer": "",
        "sources": [],
    })

    return {
        "answer": result["answer"],
        "intent": result["intent"],
        "sources": result["sources"],
    }


def build_context_from_docs(docs):
    return "\n\n".join([
        f"Source: {doc.metadata.get('source') or doc.metadata.get('title')}\n"
        f"Source Type: {doc.metadata.get('source_type')}\n"
        f"Page: {doc.metadata.get('page')}\n"
        f"Image Index: {doc.metadata.get('image_index')}\n"
        f"Chunk Index: {doc.metadata.get('chunk_index')}\n"
        f"Content:\n{doc.page_content}"
        for doc in docs
    ])