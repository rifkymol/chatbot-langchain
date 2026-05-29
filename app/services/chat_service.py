from sqlalchemy.orm import Session
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
import json

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

def build_system_prompt(intent: str):
    base_rule = (
        "Kamu adalah AI assistant untuk membantu user memahami dan mendiskusikan dokumen. "
        "Jawab hanya berdasarkan context dokumen yang diberikan. "
        "Gunakan chat history hanya untuk memahami maksud pertanyaan lanjutan. "
        "Jika informasi tidak ada di context dokumen, katakan bahwa informasi tersebut tidak ditemukan di dokumen. "
        "Jangan mengarang requirement atau fakta baru di luar dokumen. "
    )

    if intent == "action_plan":
        return (
            base_rule +
            "Fokus jawabanmu pada apa yang diminta dokumen, langkah yang perlu dilakukan, "
            "dan urutan tindakan praktis."
        )

    if intent == "checklist":
        return (
            base_rule +
            "Fokus jawabanmu pada checklist persiapan yang perlu dilakukan user berdasarkan dokumen."
        )

    if intent == "priority":
        return (
            base_rule +
            "Fokus jawabanmu pada prioritas: apa yang sebaiknya dilakukan dulu, berikutnya, dan terakhir."
        )

    if intent == "summary":
        return (
            base_rule +
            "Fokus jawabanmu pada ringkasan isi utama dokumen secara jelas dan padat."
        )

    return (
        base_rule +
        "Jawab pertanyaan user secara langsung berdasarkan dokumen."
    )


def generate_answer(
    question: str,
    context: str,
    chat_history: str = "",
    intent: str = "qa"
):
    messages = [
        SystemMessage(
            content=build_system_prompt(intent)
        ),
        HumanMessage(
            content=f"""
Chat History:
{chat_history}

Context Dokumen:
{context}

Intent:
{intent}

Pertanyaan User:
{question}
"""
        )
    ]

    response = llm.invoke(messages)
    return response.content

def generate_document_summary(source: str, context: str):
    message = [
        SystemMessage(
            content=(
                "kamu adalah AI assistant yang akan merangkum dokumen."
                "Buat ringkasan yang jelas, padat, dan hanya berdasarkan context dokumen"
                "Jangan menambahkan informasi di luar dokumen"
            )
        ),
        HumanMessage(
            content=f"""
Source:
{source}

Context Dokumen:
{context}

Tolong buat ringkasan isi utama dokumen ini!
"""
        )
    ]

    response = llm.invoke(message)
    return response.content

def generate_structured_document_summary(source: str, context: str):
    messages = [
        SystemMessage(
            content=(
                "Kamu adalah AI assistant yang menganalisis dokumen. "
                "Jawab hanya berdasarkan context dokumen. "
                "Jangan menambahkan informasi dari luar dokumen. "
                "Balas hanya dalam format JSON valid tanpa markdown."
            )
        ),
        HumanMessage(
            content=f"""
Source:
{source}

Context Dokumen:
{context}

Buat structured summary dalam format JSON valid dengan struktur berikut:
{{
  "overview": "Ringkasan singkat isi dokumen",
  "main_points": ["poin utama 1", "poin utama 2"],
  "features": ["fitur 1", "fitur 2"],
  "business_logic": ["logic 1", "logic 2"],
  "tech_stack": ["tech 1", "tech 2"],
  "risks_or_notes": ["catatan 1", "catatan 2"]
}}

Jika bagian tertentu tidak ditemukan di dokumen, gunakan array kosong [].
"""
        )
    ]

    response = llm.invoke(messages)
    content = response.content.strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {
            "overview": content,
            "main_points": [],
            "features": [],
            "business_logic": [],
            "tech_stack": [],
            "risks_or_notes": [
                "Model returned non-JSON response, fallback used."
            ]
        }