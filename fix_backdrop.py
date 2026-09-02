import re

with open('src/components/ImageTracerLightbox.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Change backdrop
text = text.replace("bg-slate-950/60 backdrop-blur-md", "bg-black/40 backdrop-blur-sm")

with open('src/components/ImageTracerLightbox.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
