import Anthropic from '@anthropic-ai/sdk';

const CATEGORIES = [
  'Medical Records', 'Police Report', 'Photos', 'Bills and Invoices',
  'Correspondence', 'Expert Reports', 'Deposition', 'Other'
];

export async function classifyExhibit(fileName, textContent) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('ANTHROPIC_API_KEY not set — skipping AI classification');
    return { category: 'Other', confidence: 0, summary: 'AI classification unavailable' };
  }

  const client = new Anthropic({ apiKey });

  const prompt = `You are a legal document classifier for a personal injury law firm.
Given a file name and any extracted text, classify this document.

File name: ${fileName}
${textContent ? `Extracted text (first 2000 chars): ${textContent.slice(0, 2000)}` : 'No text content available.'}

Respond with ONLY valid JSON, no markdown:
{
  "category": "<one of: ${CATEGORIES.join(', ')}>",
  "confidence": <number 0-100>,
  "summary": "<one sentence describing what this document appears to be>"
}`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim();
    const result = JSON.parse(text);

    if (!CATEGORIES.includes(result.category)) {
      result.category = 'Other';
    }
    result.confidence = Math.max(0, Math.min(100, Math.round(result.confidence)));

    return result;
  } catch (err) {
    console.error('AI classification failed:', err.message);
    return { category: 'Other', confidence: 0, summary: 'Classification failed' };
  }
}
