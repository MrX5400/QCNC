import re
with open('src/components/ImageTracerLightbox.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.findall(r'.{0,10}[???????].{0,10}', text)
for x in m:
    print(repr(x))
