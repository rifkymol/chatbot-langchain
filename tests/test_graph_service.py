import unittest
from unittest.mock import patch

from app.services.graph_service import retrieve_context_node, run_chatbot_graph


class RetrieveContextNodeTest(unittest.TestCase):
    def test_returns_empty_sources_when_no_docs_are_found(self):
        state = {
            "question": "apa yang tidak ada di dokumen?",
            "context": "",
            "chat_history": "",
            "source": None,
            "answer": "",
            "sources": [],
        }

        with patch("app.services.graph_service.search_relevant_docs", return_value=[]):
            result = retrieve_context_node(state)

        self.assertEqual(
            result["answer"],
            "Saya tidak menemukan informasi yang relevan di dokumen.",
        )
        self.assertEqual(result["context"], "")
        self.assertEqual(result["sources"], [])

    def test_run_chatbot_graph_handles_empty_search_results(self):
        with patch("app.services.graph_service.search_relevant_docs", return_value=[]):
            result = run_chatbot_graph(
                question="apa yang tidak ada di dokumen?",
                chat_history="",
            )

        self.assertEqual(
            result,
            {
                "answer": "Saya tidak menemukan informasi yang relevan di dokumen.",
                "sources": [],
            },
        )


if __name__ == "__main__":
    unittest.main()
