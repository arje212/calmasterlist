import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// size: { w, h } in mm for fixed-size output (stickers); omitted = A4 multi-page
export async function downloadElementPdf(el, filename, size) {
  const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
  const img = canvas.toDataURL('image/png');
  if (size) {
    const pdf = new jsPDF({ unit: 'mm', format: [size.w, size.h], orientation: size.w > size.h ? 'landscape' : 'portrait' });
    pdf.addImage(img, 'PNG', 0, 0, size.w, size.h);
    pdf.save(filename);
    return;
  }
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = 210;
  const ph = (canvas.height * pw) / canvas.width;
  let y = 0;
  pdf.addImage(img, 'PNG', 0, y, pw, ph);
  let left = ph - 297;
  while (left > 0) {
    y -= 297;
    pdf.addPage();
    pdf.addImage(img, 'PNG', 0, y, pw, ph);
    left -= 297;
  }
  pdf.save(filename);
}