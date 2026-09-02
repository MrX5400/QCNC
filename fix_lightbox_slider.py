import re

with open('src/components/ImageTracerLightbox.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Make the opacity slider always visible in the lightbox footer (except maybe original)
text = text.replace("{activeTab === 'vectors' && (", "{(activeTab === 'vectors' || activeTab === 'split') && (")

with open('src/components/ImageTracerLightbox.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
