// Generates public/samples/sample-agreement.pdf, a two-page sample used by the UI preview.
// It contains anchor tags ({{s:Client}} etc.) so anchor detection can be exercised.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const doc = await PDFDocument.create();
doc.setTitle("Sample Service Agreement");
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const ink = rgb(0.1, 0.1, 0.12);
const muted = rgb(0.4, 0.4, 0.45);

function paragraph(page, text, y, size = 11) {
  const maxWidth = 492;
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth) {
      page.drawText(line, { x: 60, y, size, font, color: ink });
      y -= size * 1.5;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) page.drawText(line, { x: 60, y, size, font, color: ink });
  return y - size * 2.2;
}

// Page 1
const p1 = doc.addPage([612, 792]);
p1.drawText("SAMPLE DOCUMENT - FOR PREVIEW ONLY", { x: 60, y: 740, size: 9, font: bold, color: muted });
p1.drawText("Sample Service Agreement", { x: 60, y: 708, size: 22, font: bold, color: ink });
paragraph(p1, "This sample agreement exists only to demonstrate the document preview, field placement and signing screens of this application. It is not a contract and has no effect.", 670);
paragraph(p1, "1. Services. The Consultant will provide the services described in Schedule A to the Client, within the timelines set out in that schedule.", 560);
paragraph(p1, "2. Fees. The Client will pay the fees described in Schedule B. Invoices are payable within thirty days of receipt.", 490);
paragraph(p1, "3. Confidentiality. Each party will keep the other party's confidential information private and use it only to perform this agreement.", 420);
paragraph(p1, "4. Term. This agreement starts on the date of the last signature and continues until the services are complete, unless ended earlier in writing.", 340);
p1.drawText("Client initials:", { x: 60, y: 120, size: 11, font, color: ink });
p1.drawText("{{i:Client}}", { x: 150, y: 120, size: 11, font, color: ink });
p1.drawText("Page 1 of 2", { x: 500, y: 40, size: 9, font, color: muted });

// Page 2
const p2 = doc.addPage([612, 792]);
paragraph(p2, "5. Acknowledgement. By signing below, each party confirms they have read this sample document.", 720);
p2.drawText("I agree to receive updates by email:", { x: 60, y: 600, size: 11, font, color: ink });
p2.drawText("{{c:Client}}", { x: 260, y: 600, size: 11, font, color: ink });

p2.drawText("Client", { x: 60, y: 520, size: 12, font: bold, color: ink });
p2.drawText("Signature:", { x: 60, y: 480, size: 11, font, color: ink });
p2.drawText("{{s:Client}}", { x: 140, y: 480, size: 11, font, color: ink });
p2.drawText("Date:", { x: 60, y: 440, size: 11, font, color: ink });
p2.drawText("{{d:Client}}", { x: 140, y: 440, size: 11, font, color: ink });

p2.drawText("Consultant", { x: 60, y: 360, size: 12, font: bold, color: ink });
p2.drawText("Signature:", { x: 60, y: 320, size: 11, font, color: ink });
p2.drawText("{{s:Consultant}}", { x: 140, y: 320, size: 11, font, color: ink });
p2.drawText("Date:", { x: 60, y: 280, size: 11, font, color: ink });
p2.drawText("{{d:Consultant}}", { x: 140, y: 280, size: 11, font, color: ink });
p2.drawText("Page 2 of 2", { x: 500, y: 40, size: 9, font, color: muted });

const bytes = await doc.save({ useObjectStreams: false });
const out = join(process.cwd(), "public", "samples", "sample-agreement.pdf");
writeFileSync(out, bytes);
console.log(`Wrote ${out} (${bytes.length} bytes)`);
