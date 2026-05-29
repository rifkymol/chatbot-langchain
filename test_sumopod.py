from openai import OpenAI

client = OpenAI(
    api_key="",
    base_url="https://ai.sumopod.com/v1"
)

response = client.embeddings.create(
    model="text-embedding-3-small",
    input="test embedding"
)

print(len(response.data[0].embedding))