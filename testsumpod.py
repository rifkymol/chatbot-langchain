from openai import OpenAI

client = OpenAI(
    api_key="",
    base_url="https://ai.sumopod.com/v1"
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "user", "content": "Say hello"}
    ],
    max_tokens=50
)

print(response.choices[0].message.content)