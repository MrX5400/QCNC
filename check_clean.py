with open('src/components/ImageTracerLightbox.tsx', 'rb') as f:
    text = f.read()

if b'\xc3\x83' in text:
    print("Still double encoded!")
else:
    print("Clean!")
