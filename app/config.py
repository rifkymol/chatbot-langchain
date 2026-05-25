import os
from dotenv import load_dotenv

load_dotenv(override=True)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4.1-nano")
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

DATABASE_URL = os.getenv("DATABASE_URL")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "knowledge_base")


print("OPENAI_BASE_URL:", OPENAI_BASE_URL)
print("OPENAI_CHAT_MODEL:", OPENAI_CHAT_MODEL)
print("OPENAI_EMBEDDING_MODEL:", OPENAI_EMBEDDING_MODEL)
print("OPENAI_API_KEY_LAST4:", OPENAI_API_KEY[-4:] if OPENAI_API_KEY else None)