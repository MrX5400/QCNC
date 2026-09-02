with open('src/components/ImageTracerLightbox.tsx', 'r', encoding='utf-8') as f:
    for line in f:
        if 'schlie?en' in line:
            print(line.strip())
