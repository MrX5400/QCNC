import re

with open('src/components/ImageTracerLightbox.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
'''                <RasterSettingsPanel
                  settings={settings}
                  setSettings={(updater) => {
                    if (typeof updater === 'function') {
                      onSettingsChange(updater(settings));
                    } else {
                      onSettingsChange(updater);
                    }
                  }}
                  imageSize={image ? { w: image.width, h: image.height } : undefined}
                />''',
'''                <RasterSettingsPanel
                  settings={settings}
                  onSettingsChange={onSettingsChange}
                  image={image}
                />'''
)

with open('src/components/ImageTracerLightbox.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
