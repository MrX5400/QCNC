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
