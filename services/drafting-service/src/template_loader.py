from jinja2 import Environment, FileSystemLoader

from config import TEMPLATES_DIR


TEMPLATE_MAP = {
    ("AFFIDAVIT", "en"): "affidavit_en.j2",
    ("AFFIDAVIT", "si"): "affidavit_si.j2",
    ("CONTRACT", "en"): "contract_en.j2",
    ("CONTRACT", "si"): "contract_si.j2",
    ("PETITION", "en"): "petition_en.j2",
    ("PETITION", "si"): "petition_si.j2",
}

ENV = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=False,
    trim_blocks=False,
    lstrip_blocks=False,
)


def load_template(doc_type: str, language: str) -> str:
    template_name = TEMPLATE_MAP[(doc_type, language)]
    source, _, _ = ENV.loader.get_source(ENV, template_name)
    return source
