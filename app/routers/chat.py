from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAIError, RateLimitError
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ChatRequest, ChatResponse
from app.services.chat_service import save_message, get_chat_history
from app.services.graph_service import run_chatbot_graph

router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)


@router.post("", response_model=ChatResponse)
def chat(payload: ChatRequest, db: Session = Depends(get_db)):
    save_message(
        db=db,
        session_id=payload.session_id,
        role="user",
        content=payload.message
    )

    history_message = get_chat_history(
        db=db,
        session_id=payload.session_id,
        limit=6
    )

    history_text = "\n".join([
        f"{message.role}: {message.content}"
        for message in reversed(history_message)
    ])

    try:
        result = run_chatbot_graph(
            question=payload.message,
            chat_history=history_text,
            source=payload.source
        )
        answer = result["answer"]

    except RateLimitError as exc:
        raise HTTPException(
            status_code=503,
            detail="OpenAI quota or rate limit error. Check your API billing/quota.",
        ) from exc
    
    except OpenAIError as exc:
        raise HTTPException(
            status_code=502,
            detail="OpenAI service error while generating the chat response.",
        ) from exc
    
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid chatbot response: {str(exc)}",
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error while generating chat response: {type(exc).__name__}: {str(exc)}",
        ) from exc

    save_message(
        db=db,
        session_id=payload.session_id,
        role="assistant",
        content=answer
    )

    return ChatResponse(
        answer=answer,
        sources=result["sources"]
    )
