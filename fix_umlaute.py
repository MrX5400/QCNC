import re

with open('src/components/RasterSettingsPanel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix broken umlaute
text = text.replace('Musterfllung', 'Musterfüllung')
text = text.replace('Fllmuster', 'Füllmuster')
text = text.replace('Fllung', 'Füllung')
text = text.replace('Hhe', 'Höhe')
text = text.replace('Höhe', 'Höhe') # Just in case

# Fix the ?? Wellenmuster
text = text.replace('?? Wellenmuster', '〰️ Wellenmuster')

# Wait, there are more. Let's just fix the known ones.
text = text.replace('Kantenglttung', 'Kantenglättung')
text = text.replace('Zielgrsse', 'Zielgröße')
text = text.replace('Schwellenwert', 'Schwellenwert')

with open('src/components/RasterSettingsPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

with open('src/components/ImageTracerLightbox.tsx', 'r', encoding='utf-8') as f:
    text2 = f.read()

text2 = text2.replace('Vergrern', 'Vergrößern')
text2 = text2.replace('Groansicht', 'Großansicht')
text2 = text2.replace('Arbeitsflche', 'Arbeitsfläche')
text2 = text2.replace('hinfgen', 'hinzufügen')
text2 = text2.replace('Hintergrundbild', 'Hintergrundbild')
text2 = text2.replace('Lnge', 'Länge')
text2 = text2.replace('Seitenverhltnis', 'Seitenverhältnis')

with open('src/components/ImageTracerLightbox.tsx', 'w', encoding='utf-8') as f:
    f.write(text2)

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text3 = f.read()

text3 = text3.replace('Vergrern', 'Vergrößern')
text3 = text3.replace('Groansicht', 'Großansicht')
text3 = text3.replace('Arbeitsflche', 'Arbeitsfläche')
text3 = text3.replace('hinzufgen', 'hinzufügen')
text3 = text3.replace('Lnge', 'Länge')
text3 = text3.replace('Seitenverhltnis', 'Seitenverhältnis')
text3 = text3.replace('Fllung', 'Füllung')
text3 = text3.replace('Musterfllung', 'Musterfüllung')
text3 = text3.replace('Schraffur', 'Schraffur')

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(text3)
