from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader
from io import BytesIO


app = FastAPI(title="EchoLearn AI API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ReviewRequest(BaseModel):
    title: str
    notes: str


class ReviewResponse(BaseModel):
    summary: str
    podcast_script: str
    questions: list[str]
    sample_answers: list[str]


def build_mock_review(title: str, notes: str):
    short_notes = notes[:800]

    return {
        "summary": (
            f"Today we are reviewing: {title}. "
            f"The key idea is to understand the main concepts from your study material."
        ),
        "podcast_script": (
            f"Good morning! Welcome back to EchoLearn AI. "
            f"Yesterday, you studied {title}. "
            f"Let's review the most important ideas in simple English. "
            f"Here is a short review based on your notes: {short_notes}. "
            f"Now, try to explain the key ideas out loud in your own words."
        ),
        "questions": [
            f"What was the main topic you learned about {title}?",
            "Can you explain the key idea in simple English?",
            "Why is this concept useful in a real project or interview?",
            "What is one detail you should remember from this material?",
            "How would you explain this topic in a 30-second interview answer?"
        ],
        "sample_answers": [
            f"The main topic was {title}.",
            "The key idea is to understand the concept, not only memorize the words.",
            "It is useful because it helps me explain technical ideas clearly and apply them in real projects.",
            "One important detail is to connect the concept with a concrete example.",
            "In an interview, I would explain the concept clearly, give one example, and mention when I would use it."
        ]
    }


def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(BytesIO(file_bytes))
        text_parts = []

        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

        text = "\n".join(text_parts).strip()
        return text

    except Exception:
        raise HTTPException(status_code=400, detail="Could not read PDF file.")


@app.get("/")
def read_root():
    return {"message": "EchoLearn AI backend is running"}


@app.post("/api/review/generate", response_model=ReviewResponse)
def generate_review(request: ReviewRequest):
    return build_mock_review(request.title, request.notes)


@app.post("/api/review/generate-from-pdf", response_model=ReviewResponse)
async def generate_review_from_pdf(
    title: str = Form(...),
    file: UploadFile = File(...)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    extracted_text = extract_text_from_pdf(file_bytes)

    if not extracted_text:
        raise HTTPException(
            status_code=400,
            detail="No readable text found in this PDF. It may be a scanned PDF."
        )

    return build_mock_review(title, extracted_text)