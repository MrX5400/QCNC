import { RasterSettings, VectorPolyline } from '../types/cnc';

export interface VectorizeRequest {
  id: string;
  imageData: ImageData;
  settings: RasterSettings;
  width: number;
  height: number;
}

export interface VectorizeResponse {
  id: string;
  polylines: VectorPolyline[];
  bwDataUrl?: string;
  error?: string;
}

let workerInstance: Worker | null = null;
let currentRequestId = 0;
const pendingRequests = new Map<string, { resolve: (val: VectorizeResponse) => void; reject: (err: any) => void }>();

function createWorker() {
  const worker = new Worker(new URL('../workers/trace.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<VectorizeResponse>) => {
    const handler = pendingRequests.get(e.data.id);
    if (handler) {
      if (e.data.error) handler.reject(new Error(e.data.error));
      else handler.resolve(e.data);
      pendingRequests.delete(e.data.id);
    }
  };
  return worker;
}

export async function vectorizeImageAsync(
  imageData: ImageData,
  settings: RasterSettings
): Promise<VectorizeResponse> {
  // If there are pending requests, we aggressively terminate the worker to cancel them.
  // This prevents the Web Worker from queueing up hundreds of expensive trace jobs
  // when the user is rapidly dragging a slider.
  if (pendingRequests.size > 0 && workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    
    // Reject all pending promises with an AbortError so the caller knows they were canceled
    pendingRequests.forEach((handler) => {
      handler.reject(new Error("Aborted"));
    });
    pendingRequests.clear();
  }

  if (!workerInstance) {
    workerInstance = createWorker();
  }

  const reqId = `req_${++currentRequestId}`;
  
  return new Promise((resolve, reject) => {
    pendingRequests.set(reqId, { resolve, reject });
    workerInstance!.postMessage({
      id: reqId,
      imageData,
      settings,
      width: imageData.width,
      height: imageData.height
    } as VectorizeRequest);
  });
}

export function autoDetectImageSettings(imageData: ImageData): Partial<RasterSettings> {
  const data = imageData.data;
  let min = 255, max = 0;
  const hist = new Array(256).fill(0);
  let noiseScore = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    if (gray < min) min = gray;
    if (gray > max) max = gray;
    hist[gray]++;
    
    // check noise (simple high frequency changes)
    if (i > 4 && data.length > i + 4) {
      const prevGray = Math.round(data[i-4] * 0.299 + data[i-3] * 0.587 + data[i-2] * 0.114);
      if (Math.abs(gray - prevGray) > 50) {
        noiseScore++;
      }
    }
  }
  
  const totalPixels = data.length / 4;
  let sumB = 0;
  let wB = 0;
  let maximum = 0;
  let threshold1 = 0;
  let threshold2 = 0;
  
  let totalSum = 0;
  for (let i = 0; i < 256; i++) totalSum += i * hist[i];
  
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (wB === 0) continue;
    const wF = totalPixels - wB;
    if (wF === 0) break;
    
    sumB += (i * hist[i]);
    const mB = sumB / wB;
    const mF = (totalSum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    
    if (varBetween > maximum) {
      maximum = varBetween;
      threshold1 = i;
      threshold2 = i;
    } else if (varBetween === maximum) {
      threshold2 = i;
    }
  }
  
  const threshold = Math.round((threshold1 + threshold2) / 2);
  const contrast = (max - min < 100) ? 30 : 0;
  
  return {
    threshold,
    contrast,
    brightness: 0,
    gamma: 1.0,
  };
}
