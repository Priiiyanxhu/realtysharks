import os
import glob

replacements = {
    'text-emerald-500': 'text-[#D4AF37]',
    'bg-emerald-500': 'bg-[#D4AF37]',
    'border-emerald-500': 'border-[#D4AF37]',
    'ring-emerald-500': 'ring-[#D4AF37]',
    'text-emerald-400': 'text-[#D4AF37]',
    'bg-emerald-400': 'bg-[#D4AF37]',
    'text-emerald-300': 'text-[#FACC15]',
    'bg-emerald-600': 'bg-[#FACC15]',
    'text-emerald-100': 'text-[#FACC15]',
    'bg-emerald-700': 'bg-[#FACC15]',
    'border-t-emerald-500': 'border-t-[#D4AF37]',
    'from-emerald-500': 'from-[#D4AF37]',
    'from-emerald-400': 'from-[#D4AF37]',
    'to-emerald-600': 'to-[#FACC15]',
    'focus:shadow-emerald-glow': 'focus:shadow-[0_0_15px_rgba(212,175,55,0.3)]',
}

def fix_file(path):
    with open(path, 'r') as f:
        content = f.read()
    
    new_content = content
    for old, new in replacements.items():
        new_content = new_content.replace(old, new)
        
    if new_content != content:
        with open(path, 'w') as f:
            f.write(new_content)
        print(f"Updated {path}")

for filepath in glob.glob('src/**/*.tsx', recursive=True):
    fix_file(filepath)

