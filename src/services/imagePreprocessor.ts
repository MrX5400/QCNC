export function preprocessImage(imageData: ImageData, settings: any): ImageData {
  const { width, height, data } = imageData;
  const output = new ImageData(width, height);
  const outData = output.data;
  
  const thresh = settings.threshold || 128;
  const invert = settings.invert;
  
  // Background blend setup
  const bgMode = settings.bgBlendMode || 'white';
  const bgR = bgMode === 'black' ? 0 : 255;
  const bgG = bgMode === 'black' ? 0 : 255;
  const bgB = bgMode === 'black' ? 0 : 255;
  
  // 1. Basic adjustments and Alpha Blending
  const tempLum = new Float32Array(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const a = data[i+3] / 255.0;
    
    // Blend with background
    const r = data[i] * a + bgR * (1 - a);
    const g = data[i+1] * a + bgG * (1 - a);
    const b = data[i+2] * a + bgB * (1 - a);
    
    let lum = 0.299 * r + 0.587 * g + 0.114 * b;
    
    if (settings.brightness) {
      lum += settings.brightness;
    }
    if (settings.contrast) {
      const factor = (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast));
      lum = factor * (lum - 128) + 128;
    }
    tempLum[j] = Math.max(0, Math.min(255, lum));
  }
  
  // 2. Blur (Anti-Aliasing)
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
  
  // 3. Thresholding
  for (let i = 0, j = 0; i < outData.length; i += 4, j++) {
    let lum = blurredLum[j];
    
    let isBlack = lum < thresh;
    if (invert) isBlack = !isBlack;
    
    // Ignore outer borders
    if (settings.ignoreBorder) {
      const x = j % width;
      const y = Math.floor(j / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        isBlack = false; // Force white border
      }
    }
    
    const val = isBlack ? 0 : 255;
    outData[i] = val;
    outData[i+1] = val;
    outData[i+2] = val;
    outData[i+3] = 255;
  }
  
  return output;
}
