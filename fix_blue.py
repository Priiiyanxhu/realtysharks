import os

replacements = {
    'bg-blue-50': 'bg-[#D4AF37]/10',
    'border-blue-100': 'border-[#D4AF37]/20',
    'active:bg-blue-900': 'active:bg-[#FACC15]',
    'to-blue-500/20': 'to-[#0B1120]/50'
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

fix_file('src/app/page.tsx')
fix_file('src/app/(app)/testbed/page.tsx')

