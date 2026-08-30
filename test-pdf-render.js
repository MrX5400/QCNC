
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function run() {
  const data = new TextEncoder().encode('%PDF-1.1\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 21 >>\nstream\n10 10 m 90 90 l S\nendstream\nendobj\ntrailer\n<< /Root 1 0 R /Size 5 >>\n%%EOF\n');
  const doc = await pdfjs.getDocument({data}).promise;
  const page = await doc.getPage(1);
  const v = page.getViewport({ scale: 1 });
  const realCtx = {
    canvas: { width: 100, height: 100 },
    save: () => {}, restore: () => {}, transform: (...args) => console.log('transform', args), setTransform: () => {},
    moveTo: (x,y) => console.log('moveTo', x, y),
    lineTo: (x,y) => console.log('lineTo', x, y),
    stroke: () => {}, fill: () => {}, beginPath: () => {}
  };
  const proxy = new Proxy(realCtx, {
    get(t, p) { if (typeof t[p] === 'function') return t[p].bind(t); return t[p]; }
  });
  await page.render({ canvasContext: proxy, viewport: v }).promise;
}
run();

