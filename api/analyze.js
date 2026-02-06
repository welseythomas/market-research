const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const anthropic = new Anthropic();

// Load system prompt (skip the header lines before the ---)
const systemPromptRaw = fs.readFileSync(
  path.join(process.cwd(), 'prompt', 'system-prompt.md'),
  'utf-8'
);
const systemPrompt = systemPromptRaw.split('---').slice(1).join('---').trim();

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const text = (req.body.briefing_text || '').trim();

  if (!text) {
    return res.status(400).json({ error: 'Geen briefing tekst ontvangen.' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Hier is de klantbriefing. Analyseer deze en genereer de complete offerte als JSON.\n\nGeef ALLEEN het JSON-object terug, geen tekst eromheen.\n\n---\n\n${text}`,
        },
      ],
    });

    const responseText = message.content[0].text;

    // Extract JSON from response (handle possible markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    jsonStr = jsonStr.trim();

    const proposal = JSON.parse(jsonStr);
    res.json(proposal);
  } catch (err) {
    console.error('Claude API error:', err);
    if (err instanceof SyntaxError) {
      return res.status(500).json({ error: 'Claude gaf geen geldig JSON terug. Probeer opnieuw.' });
    }
    res.status(500).json({ error: 'API fout: ' + err.message });
  }
};
