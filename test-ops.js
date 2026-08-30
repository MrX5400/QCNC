
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function run() {
  const data = new TextEncoder().encode('%PDF-1.1\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 21 >>\nstream\n10 10 m 90 90 l 1 2 3 4 5 6 c S\nendstream\nendobj\ntrailer\n<< /Root 1 0 R /Size 5 >>\n%%EOF\n');
  const doc = await pdfjs.getDocument({data}).promise;
  const page = await doc.getPage(1);
  const ops = await page.getOperatorList();
  console.log('fn:', ops.fnArray);
  console.log('arg0:', ops.argsArray[0][0]);
  console.log('arg1:', ops.argsArray[0][1]);
  console.log('arg2:', ops.argsArray[0][2]);
}
run();

