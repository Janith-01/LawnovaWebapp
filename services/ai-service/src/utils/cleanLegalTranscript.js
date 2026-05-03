const FILLER_PATTERN = /\b(um+|uh+|ah+|like|so basically|actually)\b/gi;

const LEGAL_AUTOCORRECT_RULES = [
    { pattern: /\bsection\s+3\s*6\s*6\b/gi, replacement: 'Section 366' },
    { pattern: /\bheresy\b/gi, replacement: 'Hearsay' },
    { pattern: /\bsus\s*stained\b/gi, replacement: 'Sustained' },
    { pattern: /\bover\s*ruled\b/gi, replacement: 'Overruled' }
];

export function cleanLegalTranscript(text = '') {
    let cleaned = String(text || '');

    cleaned = cleaned.replace(FILLER_PATTERN, ' ');

    for (const rule of LEGAL_AUTOCORRECT_RULES) {
        cleaned = cleaned.replace(rule.pattern, rule.replacement);
    }

    return cleaned
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .trim();
}

