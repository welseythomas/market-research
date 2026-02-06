require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const PdfPrinter = require('pdfmake');
const { buildDocument, tableLayouts } = require('./src/pdf-builder');

const app = express();
const PORT = 3456;

const anthropic = new Anthropic();

// Load system prompt (skip the header lines before the ---)
const systemPromptRaw = fs.readFileSync(path.join(__dirname, 'prompt', 'system-prompt.md'), 'utf-8');
const systemPrompt = systemPromptRaw.split('---').slice(1).join('---').trim();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/examples', express.static(path.join(__dirname, 'examples')));

// ─── Font setup ──────────────────────────────────────────────────
const fontsDir = path.join(__dirname, 'fonts');
const fonts = {
  Roboto: {
    normal: path.join(fontsDir, 'Roboto-Regular.ttf'),
    bold: path.join(fontsDir, 'Roboto-Medium.ttf'),
    italics: path.join(fontsDir, 'Roboto-Italic.ttf'),
    bolditalics: path.join(fontsDir, 'Roboto-MediumItalic.ttf'),
  }
};
const printer = new PdfPrinter(fonts);

// ─── API: Analyze Briefing ───────────────────────────────────────

app.post('/api/analyze', async (req, res) => {
  const text = (req.body.briefing_text || '').trim();

  if (!text) {
    return res.status(400).json({ error: 'Geen briefing tekst ontvangen.' });
  }

  // SSE streaming for real-time progress (same as Vercel function)
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Hier is de klantbriefing. Analyseer deze en genereer de complete offerte als JSON.\n\nGeef ALLEEN het JSON-object terug, geen tekst eromheen.\nWees BEKNOPT in beschrijvingen — korte zinnen, geen herhalingen. Houd de totale JSON compact.\n\n---\n\n${text}`
        }
      ],
    });

    let fullText = '';
    let chunkCount = 0;

    stream.on('text', (delta) => {
      fullText += delta;
      chunkCount++;
      if (chunkCount % 15 === 0) {
        sendEvent({ type: 'progress', chunks: chunkCount });
      }
    });

    await stream.finalMessage();
    sendEvent({ type: 'progress', chunks: chunkCount });

    let jsonStr = fullText;
    const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    jsonStr = jsonStr.trim();

    const proposal = JSON.parse(jsonStr);
    sendEvent({ type: 'complete', data: proposal });
  } catch (err) {
    console.error('Claude API error:', err);
    const errorMsg = err instanceof SyntaxError
      ? 'Claude gaf geen geldig JSON terug. Probeer opnieuw.'
      : 'API fout: ' + err.message;
    sendEvent({ type: 'error', error: errorMsg });
  }

  res.end();
});

// ─── API: Generate PDF ──────────────────────────────────────────

app.post('/api/generate-pdf', (req, res) => {
  const data = req.body;

  if (!data || !data.meta) {
    return res.status(400).json({ error: 'JSON mist het "meta" object.' });
  }

  try {
    const docDefinition = buildDocument(data);
    const pdfDoc = printer.createPdfKitDocument(docDefinition, { tableLayouts });

    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const result = Buffer.concat(chunks);
      const filename = (data.meta.offerte_nummer || 'offerte')
        .toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      res.send(result);
    });
    pdfDoc.on('error', err => {
      res.status(500).json({ error: err.message });
    });
    pdfDoc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ───────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Proposal Generator draait op http://localhost:${PORT}`);
});
