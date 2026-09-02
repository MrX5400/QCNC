import re

with open('src/types/cnc.ts', 'r', encoding='utf-8') as f:
    text = f.read()

settings = """
  // Potrace-equivalent Settings
  turdsize?: number; // Speckel-Filter (Mindestgr\u00f6\u00dfe f\u00fcr Noise-Entfernung)
  alphamax?: number; // Eckenerkennung (0.0 bis 1.33)
  opttolerance?: number; // Kurvenoptimierung (Toleranz)
  turnpolicy?: 'black' | 'white' | 'left' | 'right' | 'minority' | 'majority';
  bgBlendMode?: 'white' | 'black' | 'transparent_threshold';
"""

text = text.replace('  blurRadius?: number;', settings + '\n  blurRadius?: number;')

with open('src/types/cnc.ts', 'w', encoding='utf-8') as f:
    f.write(text)
