from typing import TypedDict, List
from langgraph.graph import StateGraph, START, END

from app.services.vector_service import search_relevant_docs
from app.services.chat_service import generate_answer

class ChatState(TypedDict):
    question: str
    context: str
    answer: str


def retrieve_context_node(state: ChatState):
    question = state["question"]

    docs = search_relevant_docs(question)

    context = "\n\n".join([
        doc.page_content for doc in docs
    ])

    return {
        "question": question,
        "context": context,
        "answer": ""
    }

def generate_answer_node(state: ChatState):
    answer = generate_answer(
        question=state["question"],
        context=state["context"]
    )

    return {
        "question": state["question"],
        "context": state["context"],
        "answer": answer
    }

def build_chat_graph():
    graph = StateGraph(ChatState)

    graph.add_node("retrieve_context", retrieve_context_node)
    graph.add_node("generate_answer", generate_answer_node)

    graph.add_edge(START, "retrieve_context")
    graph.add_edge("retrieve_context", "generate_answer")
    graph.add_edge("generate_answer", END)

    return graph.compile()

chat_graph = build_chat_graph()

def run_chatbot_graph(question: str):
    result = chat_graph.invoke({
        "question": question,
        "context": "",
        "answer": ""
    })

    return result["answer"]