const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// Load system prompt at module level (cached between invocations)
let systemPrompt;
try {
  const raw = fs.readFileSync(
    path.join(process.cwd(), 'prompt', 'system-prompt.md'),
    'utf-8'
  );
  systemPrompt = raw.split('---').slice(1).join('---').trim();
} catch (err) {
  console.error('Failed to load system prompt:', err.message);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!systemPrompt) {
    return res.status(500).json({ error: 'Server configuratie fout: system prompt niet gevonden.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server configuratie fout: ANTHROPIC_API_KEY niet ingesteld.' });
  }

  const text = (req.body?.briefing_text || '').trim();
  if (!text) {
    return res.status(400).json({ error: 'Geen briefing tekst ontvangen.' });
  }

  // Use SSE streaming to avoid timeout and show real-time progress
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const anthropic = new Anthropic();

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analyseer deze klantbriefing en genereer de offerte als JSON.\n\nREGELS:\n- Geef ALLEEN het JSON-object, geen markdown codeblokken of tekst eromheen.\n- Maximaal 1-2 zinnen per beschrijving. Geen herhalingen.\n- Arrays (screeningcriteria, kwaliteitsmaatregelen, etc.) max 4-5 items.\n- Houd de totale output zo compact mogelijk.\n\n---\n\n${text}`,
        },
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

    const finalMsg = await stream.finalMessage();
    sendEvent({ type: 'progress', chunks: chunkCount });

    // Extract JSON from response (handle markdown fences, raw JSON, or truncated output)
    let jsonStr = fullText.trim();

    // Strip markdown code fences if present
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    // Find the outermost { ... } if there's extra text around it
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }

    // If output was truncated (stop_reason = max_tokens), try to repair
    if (finalMsg.stop_reason === 'max_tokens') {
      // Close any open strings and structures to attempt valid JSON
      // Count unclosed braces/brackets
      let openBraces = 0, openBrackets = 0, inString = false, escaped = false;
      for (const ch of jsonStr) {
        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') openBraces++;
        if (ch === '}') openBraces--;
        if (ch === '[') openBrackets++;
        if (ch === ']') openBrackets--;
      }
      // Close open string if needed
      if (inString) jsonStr += '"';
      // Remove trailing comma or colon
      jsonStr = jsonStr.replace(/[,:\s]+$/, '');
      // Close brackets and braces
      for (let i = 0; i < openBrackets; i++) jsonStr += ']';
      for (let i = 0; i < openBraces; i++) jsonStr += '}';
    }

    const proposal = JSON.parse(jsonStr);
    sendEvent({ type: 'complete', data: proposal });
  } catch (err) {
    console.error('API error:', err);
    const errorMsg =
      err instanceof SyntaxError
        ? 'Claude gaf geen geldig JSON terug. Probeer opnieuw.'
        : 'API fout: ' + err.message;
    sendEvent({ type: 'error', error: errorMsg });
  }

  res.end();
};
