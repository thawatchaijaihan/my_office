import os
import re

directory = r'c:\Users\thawa\Desktop\jaihan\assistant\components\landing'

replacements = [
    (r'from "\./ui/', 'from "@/components/ui/'),
    (r'from "\.\./components/ui/', 'from "@/components/ui/'),
    (r'from "\.\./components/Icons"', 'from "@/components/landing/Icons"'),
    (r'from "\./Icons"', 'from "@/components/landing/Icons"'),
    (r'from "\.\./components/mode-toggle"', 'from "@/components/mode-toggle"'),
    (r'from "\./mode-toggle"', 'from "@/components/mode-toggle"'),
    (r'import\s+(\w+)\s+from\s+["''](?:\.\.\/)+assets\/(.+?)["''];?', r'const \1 = "/assets/\2";'),
]

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            for pattern, subst in replacements:
                new_content = re.sub(pattern, subst, new_content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated: {filepath}")
