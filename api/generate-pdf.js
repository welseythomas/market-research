const path = require('path');
const PdfPrinter = require('pdfmake');
const { buildDocument, tableLayouts } = require('../src/pdf-builder');

// Font setup
const fontsDir = path.join(process.cwd(), 'fonts');
const fonts = {
  Roboto: {
    normal: path.join(fontsDir, 'Roboto-Regular.ttf'),
    bold: path.join(fontsDir, 'Roboto-Medium.ttf'),
    italics: path.join(fontsDir, 'Roboto-Italic.ttf'),
    bolditalics: path.join(fontsDir, 'Roboto-MediumItalic.ttf'),
  },
};
const printer = new PdfPrinter(fonts);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const data = req.body;

  if (!data || !data.meta) {
    return res.status(400).json({ error: 'JSON mist het "meta" object.' });
  }

  try {
    const docDefinition = buildDocument(data);
    const pdfDoc = printer.createPdfKitDocument(docDefinition, { tableLayouts });

    const chunks = [];
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const result = Buffer.concat(chunks);
      const filename = (data.meta.offerte_nummer || 'offerte')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      res.send(result);
    });
    pdfDoc.on('error', (err) => {
      res.status(500).json({ error: err.message });
    });
    pdfDoc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
