import re

with open('src/types/cnc.ts', 'r', encoding='utf-8') as f:
    text = f.read()

if "interface VectorPolyline" not in text:
    poly_def = """
export interface VectorPolyline {
  points: { x: number; y: number }[];
  closed: boolean;
  color?: string;
  toolPower?: number;
}
"""
    text += poly_def
    with open('src/types/cnc.ts', 'w', encoding='utf-8') as f:
        f.write(text)
        print("Added VectorPolyline")
