import re

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    # The actual bytes might be \ufffd or something else if it was read as utf-8.
    text = text.replace('F\ufffdll', 'Füll')
    text = text.replace('H\ufffdhe', 'Höhe')
    text = text.replace('Kantengl\ufffdttung', 'Kantenglättung')
    text = text.replace('Gro\ufffdansicht', 'Großansicht')
    text = text.replace('Vergr\ufffdern', 'Vergrößern')
    text = text.replace('L\ufffdnge', 'Länge')
    text = text.replace('Arbeitsfl\ufffdche', 'Arbeitsfläche')
    text = text.replace('Seitenverh\ufffdltnis', 'Seitenverhältnis')
    text = text.replace('hinzuf\ufffdgen', 'hinzufügen')
    text = text.replace('Au\ufffdenkontur', 'Außenkontur')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)

fix_file('src/components/RasterSettingsPanel.tsx')
fix_file('src/components/ImageTracerLightbox.tsx')
fix_file('src/components/Workspace.tsx')
