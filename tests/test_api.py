import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from langchain_core.documents import Document

from app.routers import chat as chat_router
from app.routers import knowledge as knowledge_router


def create_client():
    app = FastAPI()

    @app.get("/")
    def root():
        return {"message": "AI Chatbot API is running"}

    def override_get_db():
        yield object()

    app.include_router(chat_router.router)
    app.include_router(knowledge_router.router)
    app.dependency_overrides[chat_router.get_db] = override_get_db
    return TestClient(app)


class ApiTest(unittest.TestCase):
    def setUp(self):
        self.client = create_client()

    def test_root_returns_health_message(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "AI Chatbot API is running"})

    def test_chat_returns_answer_and_sources(self):
        history = [
            SimpleNamespace(role="assistant", content="Halo"),
            SimpleNamespace(role="user", content="Apa isi dokumen?"),
        ]
        graph_result = {
            "answer": "Isi dokumen adalah contoh.",
            "sources": [
                {
                    "title": "manual.pdf",
                    "source": "manual.pdf",
                    "source_type": "pdf",
                    "page": 1,
                    "chunk_index": 0,
                    "relevance_score": 0.91,
                }
            ],
        }

        with (
            patch("app.routers.chat.save_message") as save_message,
            patch("app.routers.chat.get_chat_history", return_value=history),
            patch("app.routers.chat.run_chatbot_graph", return_value=graph_result) as run_graph,
        ):
            response = self.client.post(
                "/chat",
                json={
                    "session_id": "session-1",
                    "message": "Apa isi dokumen?",
                    "source": "manual.pdf",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), graph_result)
        self.assertEqual(save_message.call_count, 2)
        run_graph.assert_called_once_with(
            question="Apa isi dokumen?",
            chat_history="user: Apa isi dokumen?\nassistant: Halo",
            source="manual.pdf",
            mode="auto",
        )

    def test_chat_returns_400_for_invalid_graph_response(self):
        with (
            patch("app.routers.chat.save_message"),
            patch("app.routers.chat.get_chat_history", return_value=[]),
            patch("app.routers.chat.run_chatbot_graph", side_effect=ValueError("bad response")),
        ):
            response = self.client.post(
                "/chat",
                json={"session_id": "session-1", "message": "Halo"},
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Invalid chatbot response: bad response")

    def test_add_knowledge_returns_service_result(self):
        service_result = {
            "message": "Knowledge added successfully",
            "type": "text",
            "chunks": 2,
        }

        with patch(
            "app.routers.knowledge.add_text_to_vector_store",
            return_value=service_result,
        ) as add_text:
            response = self.client.post(
                "/knowledge",
                json={"title": "FAQ", "content": "Konten knowledge"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), service_result)
        add_text.assert_called_once_with(title="FAQ", content="Konten knowledge")

    def test_add_knowledge_returns_500_when_service_fails(self):
        with patch(
            "app.routers.knowledge.add_text_to_vector_store",
            side_effect=RuntimeError("database down"),
        ):
            response = self.client.post(
                "/knowledge",
                json={"title": "FAQ", "content": "Konten knowledge"},
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json()["detail"],
            "Failed to add knowledge: database down",
        )

    def test_upload_pdf_returns_service_result(self):
        service_result = {
            "message": "PDF uploaded successfully",
            "type": "pdf",
            "filename": "manual.pdf",
            "pages": 1,
            "chunks": 3,
        }

        with patch(
            "app.routers.knowledge.add_pdf_to_vector_store",
            new=AsyncMock(return_value=service_result),
        ) as add_pdf:
            response = self.client.post(
                "/knowledge/upload-pdf",
                files={"file": ("manual.pdf", b"%PDF-1.4\n", "application/pdf")},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), service_result)
        add_pdf.assert_awaited_once()

    def test_upload_pdf_returns_400_for_validation_error(self):
        with patch(
            "app.routers.knowledge.add_pdf_to_vector_store",
            new=AsyncMock(side_effect=ValueError("Only PDF files are allowed")),
        ):
            response = self.client.post(
                "/knowledge/upload-pdf",
                files={"file": ("notes.txt", b"not pdf", "text/plain")},
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Only PDF files are allowed")

    def test_debug_search_returns_documents(self):
        docs = [
            Document(
                page_content="Chunk satu",
                metadata={"source": "manual.pdf", "page": 1},
            )
        ]

        with patch(
            "app.routers.knowledge.search_relevant_docs",
            return_value=docs,
        ) as search_docs:
            response = self.client.get("/knowledge/debug-search?query=manual&k=1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "query": "manual",
                "count": 1,
                "results": [
                    {
                        "index": 0,
                        "content": "Chunk satu",
                        "metadata": {"source": "manual.pdf", "page": 1},
                    }
                ],
            },
        )
        search_docs.assert_called_once_with(query="manual", k=1)

    def test_get_sources_returns_service_result(self):
        service_result = {
            "count": 1,
            "sources": [
                {
                    "title": "manual.pdf",
                    "source": "manual.pdf",
                    "source_type": "pdf",
                    "chunks": 3,
                }
            ],
        }

        with patch(
            "app.routers.knowledge.list_knowledge_sources",
            return_value=service_result,
        ):
            response = self.client.get("/knowledge/sources")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), service_result)

    def test_delete_source_returns_service_result(self):
        service_result = {
            "message": "Knowledge source is deleted successfully",
            "source": "manual.pdf",
            "deleted_chunks": 3,
        }

        with patch(
            "app.routers.knowledge.delete_knowledge_by_source",
            return_value=service_result,
        ) as delete_source:
            response = self.client.delete("/knowledge/source?source=manual.pdf")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), service_result)
        delete_source.assert_called_once_with("manual.pdf")

    def test_delete_source_returns_400_for_validation_error(self):
        with patch(
            "app.routers.knowledge.delete_knowledge_by_source",
            side_effect=ValueError("Source is required"),
        ):
            response = self.client.delete("/knowledge/source?source=%20")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Source is required")

    def test_summary_returns_generated_summary(self):
        docs = [
            {"content": "Chunk pertama", "metadata": {"chunk_index": 0}},
            {"content": "Chunk kedua", "metadata": {"chunk_index": 1}},
        ]

        with (
            patch("app.routers.knowledge.get_documents_by_source", return_value=docs) as get_docs,
            patch(
                "app.routers.knowledge.generate_document_summary",
                return_value="Ringkasan dokumen.",
            ) as summarize,
        ):
            response = self.client.get("/knowledge/summary?source=manual.pdf&limit=2")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "source": "manual.pdf",
                "summary": "Ringkasan dokumen.",
                "chunks_used": 2,
            },
        )
        get_docs.assert_called_once_with(source="manual.pdf", limit=2)
        summarize.assert_called_once_with(
            source="manual.pdf",
            context="Chunk 1:\nChunk pertama\n\nChunk 2:\nChunk kedua",
        )

    def test_summary_returns_404_when_source_not_found(self):
        with patch("app.routers.knowledge.get_documents_by_source", return_value=[]):
            response = self.client.get("/knowledge/summary?source=missing.pdf")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Knowledge source not found")


if __name__ == "__main__":
    unittest.main()
