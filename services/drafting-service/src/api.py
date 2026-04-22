from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.pipeline import run_pipeline, run_validation


class PromptRequest(BaseModel):
    prompt: str


app = FastAPI(title="Lawnova Drafting Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/draft")
def draft(payload: PromptRequest):
    return run_pipeline(payload.prompt)


@app.post("/validate")
def validate(payload: PromptRequest):
    return run_validation(payload.prompt)
