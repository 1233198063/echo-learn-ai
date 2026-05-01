import json
from io import BytesIO

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel
from pypdf import PdfReader


load_dotenv()

client = OpenAI()

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


def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(BytesIO(file_bytes))
        text_parts = []

        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

        return "\n".join(text_parts).strip()

    except Exception:
        raise HTTPException(status_code=400, detail="Could not read PDF file.")


def trim_study_notes(notes: str, max_chars: int = 12000) -> str:
    """
    Keep the first version simple:
    limit long notes/PDF text to avoid very large API requests.
    Later we can improve this with chunking.
    """
    cleaned = notes.strip()

    if len(cleaned) <= max_chars:
        return cleaned

    return cleaned[:max_chars]


def generate_ai_review(title: str, notes: str) -> ReviewResponse:
    study_text = trim_study_notes(notes)

    if not study_text:
        raise HTTPException(status_code=400, detail="Study material is empty.")

    try:
        response = client.responses.create(
            model="gpt-4o-mini",
            instructions=(
                "You are EchoLearn AI, an English learning and knowledge review assistant. "
                "Your job is to transform study notes into a short English podcast-style review. "
                "Use simple, natural, daily English. "
                "The user is practicing both technical understanding and spoken English. "
                "Make the content clear, encouraging, and interview-friendly."
            ),
            input=f"""
Study topic:
{title}

Study material:
{study_text}

Create a review session with:
1. A concise summary.
2. A 3-5 minute English podcast-style script.
3. Five review questions in English.
4. Five sample answers in simple, natural English.

Important requirements:
- The podcast script should sound like a friendly morning review.
- The questions should help active recall.
- The sample answers should be easy to speak out loud.
- If the topic is technical, include practical interview-style explanations.
- Do not invent details that are not supported by the study material.
""",
            text={
                "format": {
                    "type": "json_schema",
                    "name": "review_response",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "summary": {
                                "type": "string",
                                "description": "A concise summary of the study material.",
                            },
                            "podcast_script": {
                                "type": "string",
                                "description": "A friendly English podcast-style review script.",
                            },
                            "questions": {
                                "type": "array",
                                "description": "Five active recall questions.",
                                "items": {"type": "string"},
                            },
                            "sample_answers": {
                                "type": "array",
                                "description": "Five sample spoken-English answers matching the questions.",
                                "items": {"type": "string"},
                            },
                        },
                        "required": [
                            "summary",
                            "podcast_script",
                            "questions",
                            "sample_answers",
                        ],
                        "additionalProperties": False,
                    },
                }
            },
        )

        data = json.loads(response.output_text)

        return ReviewResponse(
            summary=data["summary"],
            podcast_script=data["podcast_script"],
            questions=data["questions"],
            sample_answers=data["sample_answers"],
        )

    except Exception as error:
        print("OpenAI API error:", error)
        raise HTTPException(
            status_code=500,
            detail="Failed to generate AI review. Please check your OpenAI API key and backend logs.",
        )


@app.get("/")
def read_root():
    return {"message": "EchoLearn AI backend is running"}


@app.post("/api/review/generate", response_model=ReviewResponse)
def generate_review(request: ReviewRequest):
    if not request.title.strip():
        raise HTTPException(status_code=400, detail="Study topic is required.")

    if not request.notes.strip():
        raise HTTPException(status_code=400, detail="Study notes are required.")

    return generate_ai_review(request.title, request.notes)


@app.post("/api/review/generate-from-pdf", response_model=ReviewResponse)
async def generate_review_from_pdf(
    title: str = Form(...),
    file: UploadFile = File(...),
):
    if not title.strip():
        raise HTTPException(status_code=400, detail="Study topic is required.")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    extracted_text = extract_text_from_pdf(file_bytes)

    if not extracted_text:
        raise HTTPException(
            status_code=400,
            detail="No readable text found in this PDF. It may be a scanned PDF.",
        )

    return generate_ai_review(title, extracted_text)