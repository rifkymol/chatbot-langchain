import os
from dotenv import load_dotenv

load_dotenv()

OPEN_AI_KEY = os.getenv("OPENAI_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "knowledge_base")
