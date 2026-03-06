import re
import json

class FeatureExtractor:
    def determine_outcome(self, verdict_text: str) -> str:
        """
        Classifies verdict into ALLOWED, DISMISSED, or OTHER.
        """
        if not verdict_text:
            return None
            
        text = verdict_text.lower()
        
        # Priority to exact phrases
        if "appeal is dismissed" in text or "appeal dismissed" in text:
            return "DISMISSED"
        if "application is dismissed" in text or "application dismissed" in text:
            return "DISMISSED"
            
        if "appeal is allowed" in text or "appeal allowed" in text:
            return "ALLOWED"
        if "application is allowed" in text or "application allowed" in text:
            return "ALLOWED"
        if "set aside" in text and "judgment" in text:
             return "ALLOWED" # Usually "Judgment is set aside" implies allowed
             
        return "OTHER"

    def extract_citations(self, analysis_text: str) -> str:
        """
        Extracts legal citations from analysis text.
        Returns JSON list of strings.
        """
        if not analysis_text:
            return json.dumps([])
            
        citations = []
        
        # Patterns
        # 1. SC Appeal / SC FR
        # SC Appeal 12/2005, SC/Appeal/12/2005
        # SC FR 123/2000
        # CA Appeal ...
        
        patterns = [
            r'SC\s*Appeal\s*(?:No\.?)?\s*[\d/]+',
            r'SC\s*/\s*Appeal\s*/\s*[\d/]+',
            r'SC\s*FR\s*(?:No\.?)?\s*[\d/]+',
            r'SC\s*/\s*FR\s*/\s*[\d/]+',
            r'CA\s*Appeal\s*(?:No\.?)?\s*[\d/]+',
            r'Act\s*,?\s*No\.?\s*\d+\s*of\s*\d+',
            r'\d+\s*NLR\s*\d+', # New Law Reports
            r'\d+\s*SLR\s*\d+'  # Sri Lanka Law Reports
        ]
        
        for pat in patterns:
            matches = re.finditer(pat, analysis_text, re.IGNORECASE)
            for m in matches:
                # Cleanup
                cite = m.group(0).strip()
                # Remove punctuation at end if any
                if cite[-1] in [".", ","]:
                    cite = cite[:-1]
                citations.append(cite)
                
        # Deduplicate preserving order
        unique_cites = list(dict.fromkeys(citations))
        return json.dumps(unique_cites)
