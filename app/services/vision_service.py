import base64
import io
from typing import List, Tuple

import fitz
from PIL import Image
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.config import (
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    OPENAI_VISION_MODEL,
)


vision_llm = ChatOpenAI(
    model=OPENAI_VISION_MODEL,
    api_key=OPENAI_API_KEY,
    base_url=OPENAI_BASE_URL,
    temperature=0.1,
)


def image_bytes_to_base64_png(image_bytes: bytes) -> str:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def describe_pdf_image(
    image_base64: str,
    page_number: int,
    image_label: str,
) -> str:
    messages = [
        SystemMessage(
            content=(
                "You are a vision-capable document analysis assistant. "
                "Analyze the provided image from a PDF document. "
                "Focus on diagrams, flowcharts, UI screenshots, tables, forms, arrows, labels, layouts, and visual relationships. "
                "Do not invent information that is not visible. "
                "Return the analysis in this exact structure:\n\n"
                "Visual Type: <diagram / flowchart / UI screenshot / table / form / logo / signature / unknown>\n"
                "Detected Text: <important text visible in the image>\n"
                "Description: <what the image explains>\n"
                "Important Elements: <key visual elements, actors, arrows, sections, fields, buttons, columns>\n"
                "Possible User Questions: <questions this visual can answer>\n"
                "Keywords: <comma-separated keywords for retrieval>\n"
            )
        ),
        HumanMessage(
            content=[
                {
                    "type": "text",
                    "text": (
                        f"Analyze this PDF image. "
                        f"Page: {page_number}. Image label: {image_label}."
                    ),
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{image_base64}"
                    },
                },
            ]
        ),
    ]

    response = vision_llm.invoke(messages)
    return response.content


def extract_embedded_images_from_pdf(
    pdf_path: str,
    filename: str,
    max_images: int | None = None,
) -> Tuple[List[Document], int]:
    pdf_document = fitz.open(pdf_path)
    documents: List[Document] = []
    found_images = 0
    analyzed_images = 0
    seen_xrefs = set()

    try:
        for page_index in range(len(pdf_document)):
            page = pdf_document[page_index]
            image_list = page.get_images(full=True)

            for image_index, image_info in enumerate(image_list, start=1):
                found_images += 1

                if max_images is not None and analyzed_images >= max_images:
                    return documents, found_images

                xref = image_info[0]

                if xref in seen_xrefs:
                    continue

                seen_xrefs.add(xref)

                base_image = pdf_document.extract_image(xref)
                image_bytes = base_image.get("image")
                image_width = base_image.get("width", 0)
                image_height = base_image.get("height", 0)
                image_area = image_width * image_height

                if image_width < 300 or image_height < 200 or image_area < 100000:
                    continue

                if not image_bytes:
                    continue

                image_base64 = image_bytes_to_base64_png(image_bytes)

                description = describe_pdf_image(
                    image_base64=image_base64,
                    page_number=page_index + 1,
                    image_label=f"embedded-image-{image_index}",
                )

                if not description or not description.strip():
                    continue

                documents.append(
                    Document(
                        page_content=(
                            f"Visual analysis for embedded image {image_index} "
                            f"on page {page_index + 1} of {filename}:\n"
                            f"{description.strip()}"
                        ),
                        metadata={
                            "title": filename,
                            "source": filename,
                            "source_type": "pdf_image",
                            "page": page_index,
                            "image_index": image_index,
                            "chunk_index": image_index,
                        },
                    )
                )

                analyzed_images += 1

    finally:
        pdf_document.close()

    return documents, found_images


def render_pdf_page_to_base64_png(
    pdf_document,
    page_index: int,
    zoom: float = 2.0,
) -> str:
    page = pdf_document.load_page(page_index)
    matrix = fitz.Matrix(zoom, zoom)
    pixmap = page.get_pixmap(matrix=matrix, alpha=False)
    image_bytes = pixmap.tobytes("png")

    return base64.b64encode(image_bytes).decode("utf-8")


def get_candidate_visual_page_indexes(
    pdf_path: str,
    max_pages: int = 5,
    min_text_length: int = 300,
) -> List[int]:
    pdf_document = fitz.open(pdf_path)
    candidates = []

    visual_keywords = [
        "workflow",
        "diagram",
        "flow",
        "approval",
        "process",
        "architecture",
        "design",
        "ui",
        "screen",
        "form",
        "mockup",
        "wireframe",
    ]

    try:
        for page_index in range(len(pdf_document)):
            page = pdf_document[page_index]
            text = page.get_text("text") or ""
            lowered_text = text.lower().strip()

            text_length = len(lowered_text)

            keyword_score = sum(
                1 for keyword in visual_keywords
                if keyword in lowered_text
            )

            image_count = len(page.get_images(full=True))

            score = 0

            # halaman minim text sering berisi gambar/diagram
            if text_length <= min_text_length:
                score += 3

            # halaman yang punya keyword visual lebih prioritas
            score += keyword_score * 2

            # halaman yang punya image juga prioritas
            score += image_count

            if score > 0:
                candidates.append({
                    "page_index": page_index,
                    "score": score,
                    "text_length": text_length,
                    "image_count": image_count,
                })

        candidates = sorted(
            candidates,
            key=lambda item: item["score"],
            reverse=True
        )

        return [
            item["page_index"]
            for item in candidates[:max_pages]
        ]

    finally:
        pdf_document.close()

def analyze_rendered_pages_to_documents(
    pdf_path: str,
    filename: str,
    max_pages: int = 3,
) -> List[Document]:
    page_indexes = get_candidate_visual_page_indexes(
        pdf_path=pdf_path,
        max_pages=max_pages,
    )

    pdf_document = fitz.open(pdf_path)
    documents: List[Document] = []

    try:
        for page_index in page_indexes:
            image_base64 = render_pdf_page_to_base64_png(
                pdf_document=pdf_document,
                page_index=page_index,
            )

            description = describe_pdf_image(
                image_base64=image_base64,
                page_number=page_index + 1,
                image_label="rendered-page-fallback",
            )

            if not description or not description.strip():
                continue

            documents.append(
                Document(
                    page_content=(
                        f"Visual analysis for rendered page {page_index + 1} "
                        f"of {filename}:\n"
                        f"{description.strip()}"
                    ),
                    metadata={
                        "title": filename,
                        "source": filename,
                        "source_type": "pdf_page_image",
                        "page": page_index,
                        "image_index": None,
                        "chunk_index": page_index,
                    },
                )
            )

    finally:
        pdf_document.close()

    return documents