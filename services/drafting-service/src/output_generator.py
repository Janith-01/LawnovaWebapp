from datetime import datetime
from pathlib import Path
from xml.sax.saxutils import escape

from docx import Document
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from config import FONTS_DIR, OUTPUT_DIR


def _ensure_output_dir() -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    return OUTPUT_DIR


def _timestamped_path(doc_type: str, language: str, suffix: str) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{doc_type}_{language}_{timestamp}.{suffix}"
    return _ensure_output_dir() / filename


def _register_pdf_font() -> str:
    preferred_files = [
        FONTS_DIR / "NotoSansSinhala-Regular.ttf",
        FONTS_DIR / "NotoSansSinhala[wdth,wght].ttf",
        FONTS_DIR / "NotoSansSinhhala-Regular.ttf",
    ]

    for candidate in preferred_files:
        if not candidate.exists():
            continue
        try:
            pdfmetrics.registerFont(TTFont("LawnovaSinhala", str(candidate)))
            return "LawnovaSinhala"
        except Exception:
            continue

    for candidate in sorted(FONTS_DIR.glob("*.ttf")) + sorted(FONTS_DIR.glob("*.otf")):
        try:
            pdfmetrics.registerFont(TTFont("LawnovaFallback", str(candidate)))
            return "LawnovaFallback"
        except Exception:
            continue

    return "Helvetica"


def save_as_docx(content: str, doc_type: str, language: str) -> str:
    output_path = _timestamped_path(doc_type, language, "docx")
    document = Document()

    for line in content.splitlines():
        document.add_paragraph(line)

    document.save(output_path)
    return str(output_path)


def save_as_pdf(content: str, doc_type: str, language: str) -> str:
    output_path = _timestamped_path(doc_type, language, "pdf")
    font_name = _register_pdf_font()

    styles = getSampleStyleSheet()
    body_style = ParagraphStyle(
        "DraftBody",
        parent=styles["Normal"],
        fontName=font_name,
        fontSize=11,
        leading=15,
    )

    story = []
    for block in content.split("\n\n"):
        lines = [escape(line) for line in block.splitlines()]
        paragraph_text = "<br/>".join(lines).strip()
        if not paragraph_text:
            story.append(Spacer(1, 8))
            continue
        story.append(Paragraph(paragraph_text, body_style))
        story.append(Spacer(1, 10))

    pdf = SimpleDocTemplate(str(output_path), pagesize=A4)
    pdf.build(story)
    return str(output_path)
