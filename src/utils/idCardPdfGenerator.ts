import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Standard CR80 ID Card dimensions in millimeters (Portrait)
export const CR80_WIDTH_MM = 54;
export const CR80_HEIGHT_MM = 86;

// Standard A4 dimensions in millimeters
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/**
 * Generates an individual standard CR80 plastic ID card PDF (54mm x 86mm)
 * Suitable for direct printing on thermal plastic card printers or high-res single archive.
 */
export async function generateSingleCardPdf(
  element: HTMLElement,
  servantName: string
): Promise<void> {
  // Capture high-DPI canvas
  const canvas = await html2canvas(element, {
    scale: 3, // 3x scale ensures ultra-crisp QR code and Arabic typography
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#1c1917', // Match card background
    logging: false,
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  // Create CR80 sized document (54mm x 86mm portrait)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [CR80_WIDTH_MM, CR80_HEIGHT_MM],
  });

  pdf.addImage(imgData, 'JPEG', 0, 0, CR80_WIDTH_MM, CR80_HEIGHT_MM, undefined, 'FAST');

  // Clean filename for download
  const safeName = servantName.replace(/[\/\\?%*:|"<>]/g, '_').trim();
  pdf.save(`كارنيه_خادم_${safeName}_CR80.pdf`);
}

/**
 * Generates an A4 sheet PDF with multiple CR80 cards arranged in a grid with cut marks.
 * Arranged in 3 columns x 3 rows (up to 9 cards per A4 page).
 */
export async function generateA4SheetPdf(
  cards: { element: HTMLElement; name: string }[],
  churchName: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (cards.length === 0) return;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const cardsPerPage = 6; // 2 columns x 3 rows for comfortable margins and cut lines
  const cols = 2;
  const rows = 3;

  // Calculate grid layout with comfortable margins
  const cardWidth = 54;
  const cardHeight = 86;
  const colGap = 16;
  const rowGap = 7;

  const totalGridWidth = cols * cardWidth + (cols - 1) * colGap; // 108 + 16 = 124mm
  const startX = (A4_WIDTH_MM - totalGridWidth) / 2; // ~43mm margin left & right
  const startY = 16; // Top margin

  for (let i = 0; i < cards.length; i++) {
    const pageIndex = Math.floor(i / cardsPerPage);
    const positionInPage = i % cardsPerPage;

    if (i > 0 && positionInPage === 0) {
      pdf.addPage('a4', 'portrait');
    }

    if (onProgress) {
      onProgress(i + 1, cards.length);
    }

    // Capture the card element at high resolution
    const canvas = await html2canvas(cards[i].element, {
      scale: 2.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#1c1917',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    const col = positionInPage % cols;
    const row = Math.floor(positionInPage / cols);

    const x = startX + col * (cardWidth + colGap);
    const y = startY + row * (cardHeight + rowGap);

    // Draw crop/cut marks around each card for precise slicing
    drawCutMarks(pdf, x, y, cardWidth, cardHeight);

    // Add card image
    pdf.addImage(imgData, 'JPEG', x, y, cardWidth, cardHeight, undefined, 'FAST');

    // Page header on top of each A4 page
    if (positionInPage === 0) {
      pdf.setFontSize(9);
      pdf.setTextColor(120, 120, 120);
      const today = new Date().toLocaleDateString('ar-EG');
      pdf.text(`${churchName} — كشف طباعة كارنيهات الخدام (صفحة ${pageIndex + 1}) — ${today}`, A4_WIDTH_MM / 2, 9, {
        align: 'center',
      });
      pdf.setDrawColor(210, 210, 210);
      pdf.setLineWidth(0.3);
      pdf.line(20, 11, A4_WIDTH_MM - 20, 11);
    }
  }

  const safeChurch = churchName.replace(/[\/\\?%*:|"<>]/g, '_').trim();
  pdf.save(`كروت_خدام_${safeChurch}_A4_جاهز_للطباعة.pdf`);
}

/**
 * Draws subtle crop marks at the 4 corners of a card to facilitate trimming.
 */
function drawCutMarks(pdf: jsPDF, x: number, y: number, w: number, h: number) {
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.2);
  const markLength = 3;

  // Top-left
  pdf.line(x - 2, y, x - 2 - markLength, y);
  pdf.line(x, y - 2, x, y - 2 - markLength);

  // Top-right
  pdf.line(x + w + 2, y, x + w + 2 + markLength, y);
  pdf.line(x + w, y - 2, x + w, y - 2 - markLength);

  // Bottom-left
  pdf.line(x - 2, y + h, x - 2 - markLength, y + h);
  pdf.line(x, y + h + 2, x, y + h + 2 + markLength);

  // Bottom-right
  pdf.line(x + w + 2, y + h, x + w + 2 + markLength, y + h);
  pdf.line(x + w, y + h + 2, x + w, y + h + 2 + markLength);
}
