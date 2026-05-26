import json
import unittest

from app.services.vector_service import build_search_kwargs


class BuildSearchKwargsTest(unittest.TestCase):
    def test_source_filter_is_json_serializable(self):
        search_kwargs = build_search_kwargs(
            query="apa isi dokumen?",
            k=4,
            source="manual.pdf",
        )

        self.assertEqual(
            search_kwargs["filter"],
            {
                "$or": [
                    {"source": {"$eq": "manual.pdf"}},
                    {"title": {"$eq": "manual.pdf"}},
                ]
            },
        )
        json.dumps(search_kwargs["filter"])

    def test_blank_source_does_not_add_filter(self):
        search_kwargs = build_search_kwargs(
            query="apa isi dokumen?",
            k=4,
            source="   ",
        )

        self.assertNotIn("filter", search_kwargs)


if __name__ == "__main__":
    unittest.main()
