import { TraceStrategy } from '../types/cnc';

/**
 * Preprocesses image data for vectorization.
 *
 * For 'contour' and 'centerline' strategies, performs hard binary thresholding
 * (0 or 255) since ImageTracer and Zhang-Suen thinning require 1-bit input.
 *
 * For 'scanline' and 'pattern' strategies, preserves the full 8-bit grayscale
 * dynamic range (0–255) after brightness, contrast, and gamma adjustments
 * so that laser power modulation and pattern amplitude can use real gradients.
 */
export function preprocessImage(imageData: ImageData, settings: any): ImageData {
  const { width, height, data } = imageData;
  const output = new ImageData(width, height);
  const outData = output.data;

  const thresh = settings.threshold ?? 128;
  const invert = settings.invert;
  const gamma = settings.gamma ?? 1.0;

  // Determine strategy to decide binary vs. grayscale output
  const strategy: TraceStrategy | undefined = settings.traceStrategy;
  const preserveGrayscale = strategy === 'scanline' || strategy === 'pattern';

  // Background blend setup
  const bgMode = settings.bgBlendMode || 'white';
  const bgR = bgMode === 'black' ? 0 : 255;
  const bgG = bgMode === 'black' ? 0 : 255;
  const bgB = bgMode === 'black' ? 0 : 255;

  // 1. Alpha blending, grayscale conversion, brightness & contrast adjustments
  const tempLum = new Float32Array(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const a = data[i + 3] / 255.0;

    // Blend with background
    const r = data[i] * a + bgR * (1 - a);
    const g = data[i + 1] * a + bgG * (1 - a);
    const b = data[i + 2] * a + bgB * (1 - a);

    let lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (settings.brightness) {
      lum += settings.brightness;
    }
    if (settings.contrast) {
      const factor = (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast));
      lum = factor * (lum - 128) + 128;
    }

    // Gamma correction (applied before clamping for maximum dynamic range)
    if (gamma !== 1.0 && gamma > 0.1) {
      lum = Math.max(0, Math.min(255, lum));
      lum = 255 * Math.pow(lum / 255, 1 / gamma);
    }

    tempLum[j] = Math.max(0, Math.min(255, lum));
  }

  // 2. Anti-aliasing blur
  const blurRadius = settings.blurRadius || 0;
  let blurredLum = tempLum;

  if (blurRadius > 0) {
    blurredLum = new Float32Array(width * height);
    const r = Math.round(blurRadius);
    const w = width;
    const h = height;
    // Fast box blur approximation
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              sum += tempLum[ny * w + nx];
              count++;
            }
          }
        }
        blurredLum[y * w + x] = sum / count;
      }
    }
  }

  // 3. Output: either binary (contour/centerline) or grayscale (scanline/pattern)
  for (let i = 0, j = 0; i < outData.length; i += 4, j++) {
    let lum = blurredLum[j];

    // Ignore outer border pixels (force white)
    if (settings.ignoreBorder) {
      const x = j % width;
      const y = Math.floor(j / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        outData[i] = 255;
        outData[i + 1] = 255;
        outData[i + 2] = 255;
        outData[i + 3] = 255;
        continue;
      }
    }

    let val: number;
    if (preserveGrayscale) {
      // Preserve full 8-bit dynamic range for laser/pattern modulation
      val = Math.round(Math.max(0, Math.min(255, lum)));
      if (invert) val = 255 - val;
    } else {
      // Binary thresholding for contour/centerline tracing
      let isBlack = lum < thresh;
      if (invert) isBlack = !isBlack;
      val = isBlack ? 0 : 255;
    }

    outData[i] = val;
    outData[i + 1] = val;
    outData[i + 2] = val;
    outData[i + 3] = 255;
  }

  return output;
}
