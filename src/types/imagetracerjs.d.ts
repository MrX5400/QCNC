declare module 'imagetracerjs' {
  export interface Tracedata {
    layers: Array<Array<{
      segments: Array<{
        type: 'L' | 'Q';
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        x3?: number;
        y3?: number;
      }>;
    }>>;
  }

  export function imagedataToTracedata(imageData: ImageData, options: any): Tracedata;
  export function imagedataToSVG(imageData: ImageData, options: any): string;
}
