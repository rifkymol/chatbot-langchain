from sqlalchemy.orm import Session
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from app.models import ChatMessage
from app.config import OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_CHAT_MODEL


# llm = ChatOpenAI(model="gpt-5-nano", temperature=0.2)
llm = ChatOpenAI(
    model=OPENAI_CHAT_MODEL,
    api_key=OPENAI_API_KEY,
    base_url=OPENAI_BASE_URL,
    temperature=0.2,
)


def save_message(db: Session, session_id: str, role: str, content: str):
    message = ChatMessage(
        session_id=session_id,
        role=role,
        content=content
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message

def get_chat_history(db: Session, session_id: str, limit: int = 10):
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
        .all()
    )

def generate_answer(question: str,context: str):
    messages = [
        SystemMessage(
            content=(
                "Kamu adalah AI assistant yang menjawab berdasarkan context."
                "Jika jawaban tidak ada di context, bilang bahwa kamu tidak tahu."
            )
        ),
        HumanMessage(
            content=f"""
Context:
{context}

Question:
{question}
"""
        )
    ]

    response = llm.invoke(messages)
    return response.content