import re
import sys

def process_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Dictionary of replacements: { "old_class": "new_class" }
    # Using word boundaries to avoid partial matches
    replacements = {
        r'bg-\[\#1E293B\]': 'bg-white dark:bg-[#1E293B]',
        r'border-slate-700/50': 'border-slate-200 dark:border-slate-700/50',
        r'border-slate-700/30': 'border-slate-200 dark:border-slate-700/30',
        r'border-slate-700': 'border-slate-200 dark:border-slate-700',
        r'border-slate-800': 'border-slate-200 dark:border-slate-800',
        r'text-slate-400': 'text-slate-500 dark:text-slate-400',
        r'text-slate-300': 'text-slate-600 dark:text-slate-300',
        r'text-slate-200': 'text-slate-700 dark:text-slate-200',
        r'text-white': 'text-slate-900 dark:text-white',
        r'bg-slate-800/50': 'bg-slate-50 dark:bg-slate-800/50',
        r'bg-slate-800/80': 'bg-slate-50 dark:bg-slate-800/80',
        r'bg-slate-800': 'bg-slate-100 dark:bg-slate-800',
        r'bg-slate-700/50': 'bg-slate-100 dark:bg-slate-700/50',
        r'bg-slate-700': 'bg-slate-200 dark:bg-slate-700',
        r'hover:bg-slate-800': 'hover:bg-slate-100 dark:hover:bg-slate-800',
        r'hover:bg-slate-700/50': 'hover:bg-slate-100 dark:hover:bg-slate-700/50',
        r'hover:bg-slate-700/30': 'hover:bg-slate-100 dark:hover:bg-slate-700/30',
        r'hover:bg-slate-700': 'hover:bg-slate-200 dark:hover:bg-slate-700',
        r'hover:bg-slate-600': 'hover:bg-slate-300 dark:hover:bg-slate-600',
        r'text-slate-500': 'text-slate-500 dark:text-slate-500', # Keep some things
    }

    # Exception cases where we SHOULD NOT replace text-white
    # e.g., 'text-white' inside buttons or badges with colored backgrounds
    # We'll temporarily mask these before replacing text-white
    
    # Actually, we can just replace text-white inside typography contexts mostly.
    # To be safe, we'll replace text-white with a marker, unless it's preceded by bg-purple, bg-gradient, bg-red, etc.
    # This might be tricky. Let's just do a simpler replacement and assume the specific color backgrounds override text anyway,
    # OR replace only text-white when it's next to text-xl, font-bold, etc.
    
    # Let's do a naive replace first, and then fix known buttons.
    for old, new in replacements.items():
        if old == r'text-white':
            # Only change text-white if it's likely typography
            content = re.sub(r'(?<!bg-\w\w\w-\d\d\d )(?<!to-\w\w\w-\d\d\d )(?<!from-\w\w\w-\d\d\d )\btext-white\b', new, content)
        else:
            content = re.sub(r'\b' + old + r'(?!\w)', new, content)

    # Revert text-slate-900 back to text-white for specific colored buttons
    # like bg-red-600, bg-green-600, bg-purple-600, gradients that use text-white
    # Find combinations like `bg-purple-600 text-slate-900 dark:text-white` and revert to `bg-purple-600 text-white`
    revert_patterns = [
        r'from-[\w]+-\d+\s+to-[\w]+-\d+\s+text-slate-900 dark:text-white',
        r'bg-(?:purple|green|red|blue|indigo)-[56]00\s+text-slate-900 dark:text-white',
        r'bg-gradient-to-[a-z]+\s+from-[\w]+-\d+\s+to-[\w]+-\d+\s+flex\s+items-center\s+justify-center\s+text-slate-900 dark:text-white',
        r'bg-(?:purple|green|red|blue|indigo)-[56]00(?:\/\d+)?\s+hover:bg-[a-z]+-[56]00(?:\/\d+)?\s+text-slate-900 dark:text-white'
    ]
    
    # Also revert for general cases where 'text-slate-900 dark:text-white' is near colored bg
    content = re.sub(r'(bg-(purple|green|red|blue|indigo|amber)-[56]00[^\'"\n]*)text-slate-900 dark:text-white', r'\1text-white', content)
    content = re.sub(r'(from-(purple|green|red|blue|indigo|amber)-[56]00[^\'"\n]*)text-slate-900 dark:text-white', r'\1text-white', content)
    
    # Specific buttons revert
    content = content.replace('text-slate-900 dark:text-white bg-red-600 hover:bg-red-700', 'text-white bg-red-600 hover:bg-red-700')
    content = content.replace('text-slate-900 dark:text-white bg-purple-600 hover:bg-purple-700', 'text-white bg-purple-600 hover:bg-purple-700')
    content = content.replace('bg-green-600 hover:bg-green-700 text-slate-900 dark:text-white', 'bg-green-600 hover:bg-green-700 text-white')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    process_file(r'd:\RE\LawnovaWebapp\web-client\src\pages\mocktrials\MockTrialDashboard.jsx')
