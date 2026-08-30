
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function run() {
  const data = new TextEncoder().encode('%PDF-1.1\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 21 >>\nstream\n10 10 m 90 90 l S\nendstream\nendobj\ntrailer\n<< /Root 1 0 R /Size 5 >>\n%%EOF\n');
  const doc = await pdfjsLib.getDocument({data}).promise;
  const page = await doc.getPage(1);
  const ops = await page.getOperatorList();
  console.log(ops.fnArray);
  console.log(pdfjsLib.OPS.constructPath);
}
run();

