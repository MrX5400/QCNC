import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove the two drawing useEffects completely by searching for their exact starts and removing until next hook
start1 = text.find('// --- Update Processed Image Canvas Preview for Vectorization Menu ---')
if start1 != -1:
    end1 = text.find('// --- High-Resolution Render for Lightbox Modal', start1)
    if end1 != -1:
        text = text[:start1] + text[end1:]

start2 = text.find('// --- Draw Vector Overlay on Thumbnail Preview in Sidebar ---')
if start2 != -1:
    end2 = text.find('// --- High-Resolution Transform Computation ---', start2)
    if end2 != -1:
        text = text[:start2] + text[end2:]

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
