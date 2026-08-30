
import * as pdfjs from 'pdfjs-dist';

async function run() {
  console.log(pdfjs.OPS.moveTo, pdfjs.OPS.lineTo, pdfjs.OPS.curveTo, pdfjs.OPS.rectangle);
}
run();

