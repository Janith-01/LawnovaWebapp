import re
import logging

logger = logging.getLogger(__name__)

class JudgmentMetadataExtractor:
    def __init__(self):
        pass

    def extract(self, text: str) -> dict:
        """
        Extracts metadata from judgment text.
        Returns a dictionary suitable for JudgmentMetadata model.
        """
        if not text:
            return {}

        metadata = {
            "presiding_judge": None,
            "other_judges": None,
            "counsel_petitioner": None,
            "counsel_respondent": None,
            "keywords": None
        }

        # 1. Extract Judges (Before: ...)
        before_match = re.search(r'(BEFORE|PRESENT)\s*:\s*(.*?)(?=(COUNSEL|APPEARANCES|ARGUED|DECIDED|Date|Case No))', text, re.DOTALL | re.IGNORECASE)
        if before_match:
            judges_block = before_match.group(2).strip()
            # Split by comma or newline and clean
            judge_names = [j.strip() for j in re.split(r'[,\n]', judges_block) if j.strip()]
            
            # Simple heuristic: First one is presiding
            if judge_names:
                metadata["presiding_judge"] = judge_names[0]
                if len(judge_names) > 1:
                    metadata["other_judges"] = ", ".join(judge_names[1:])
        
        # 2. Extract Counsel
        counsel_match = re.search(r'(COUNSEL|APPEARANCES)\s*:\s*(.*?)(?=(ARGUED|DECIDED|Date|Case No|Before|Judgment))', text, re.DOTALL | re.IGNORECASE)
        if counsel_match:
            counsel_block = counsel_match.group(2).strip()
            metadata["counsel_petitioner"] = counsel_block
            
            # Refined split attempts
            # split_match = re.split(r'(?i)(for\s+(?:the\s+)?(?:Respondent|Defendant|Accused))', counsel_block)
            # if len(split_match) > 1:
            #     metadata["counsel_petitioner"] = split_match[0].strip()
            #     metadata["counsel_respondent"] = "".join(split_match[1:]).strip()

        # 3. Keywords (Placeholder)
        # Could look for "Keywords:" section
        keywords_match = re.search(r'(?i)Keywords\s*:\s*(.*?)(?=\n)', text)
        if keywords_match:
            metadata["keywords"] = keywords_match.group(1).strip()

        return metadata
