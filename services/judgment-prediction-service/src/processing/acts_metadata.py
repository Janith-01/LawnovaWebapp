import re

class ActMetadataExtractor:
    def __init__(self):
        pass

    def extract_from_title(self, title: str):
        """
        Parses metadata from Act title.
        Returns tuple (is_amendment, parent_act_key)
        """
        is_amendment = 0
        if "amendment" in title.lower():
            is_amendment = 1
        
        # Simple parent extraction strategy
        parent_act_key = None
        if is_amendment:
            # removing (Amendment) and ... Act
            clean_title = re.sub(r'\(Amendment\).*', '', title, flags=re.IGNORECASE).strip()
            clean_title = re.sub(r'Act.*', '', clean_title, flags=re.IGNORECASE).strip()
            parent_act_key = clean_title.lower().replace(" ", "_")
        else:
            # For principal acts, key is just the title
            clean_title = re.sub(r'Act.*', '', title, flags=re.IGNORECASE).strip()
            parent_act_key = clean_title.lower().replace(" ", "_")
            
        return {
            "is_amendment": is_amendment,
            "parent_act_key": parent_act_key
        }
