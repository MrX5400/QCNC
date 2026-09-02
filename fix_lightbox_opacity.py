import re

with open('src/components/ImageTracerLightbox.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_opacity1 = "style={{ opacity: activeTab === 'vectors' ? tracerBgOpacity / 100 : 1 }}"
new_opacity1 = "style={{ opacity: activeTab === 'original' ? 1 : tracerBgOpacity / 100 }}"

old_opacity2 = "style={{ clipPath: activeTab === 'split' ? `inset(0 0 0 ${splitPos}%)` : 'none' }}"
new_opacity2 = "style={{ clipPath: activeTab === 'split' ? `inset(0 0 0 ${splitPos}%)` : 'none', opacity: activeTab === 'threshold' ? 1 : tracerBgOpacity / 100 }}"

text = text.replace(old_opacity1, new_opacity1)
text = text.replace(old_opacity2, new_opacity2)

with open('src/components/ImageTracerLightbox.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

