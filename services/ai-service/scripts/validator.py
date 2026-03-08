import re

# Requirement 1: Stage Validator logic with required keywords
STAGE_KEYWORDS = {
    'Opening Statements': ['burden of proof', 'facts', 'prosecution', 'introductory', 'evidence', 'case', 'opening', 'defense'],
    'Direct Examination': ['testimony', 'evidence', 'witness', 'truth', 'recall', 'incident', 'happened', 'please state'],
    'Cross Examination': ['objection', 'relevance', 'impeach', 'contradict', 'recollection', 'leading', 'false', 'isn\'t it true'],
    'Closing Arguments': ['guilty', 'innocent', 'verdict', 'justice', 'reasonable doubt', 'conclusion', 'summary', 'thank you'],
    'Deliberation': ['jury', 'discussion', 'decision', 'consensus', 'deliberate', 'weighing', 'points']
}

def validate_stage_context(transcript_text, current_stage):
    """
    Checks if the transcript_text contains any of the required keywords for the current stage.
    Returns: (bool success, list found_keywords)
    """
    if not current_stage or current_stage not in STAGE_KEYWORDS:
        # Default to success if stage is unknown to avoid false penalties
        return True, []
        
    required = STAGE_KEYWORDS[current_stage]
    text_lower = transcript_text.lower()
    
    found = []
    for word in required:
        if re.search(r'\b' + re.escape(word) + r'\b', text_lower):
            found.append(word)
            
    # Penalty Trigger: If no keywords are found
    success = len(found) > 0
    return success, found
