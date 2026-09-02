export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message = '', memory = [] } = req.body || {};
  if (!message.trim()) return res.status(400).json({ error: 'Message is required' });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY is not configured' });

  const messages = [
    {
      role: 'system',
      content: 'You are BTR 1, a personal AI assistant. Address the user as Master. Be helpful, concise, practical, and honest. You can assist with planning, learning, productivity, business, technology, music, and everyday tasks.'
    },
    ...memory.slice(-10).flatMap(item => {
      const result = [];
      if (item.user) result.push({ role: 'user', content: item.user });
      if (item.assistant) result.push({ role: 'assistant', content: item.assistant });
      return result;
    }),
    { role: 'user', content: message.trim() }
  ];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
        messages,
        temperature: 0.3,
        max_tokens: 700
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'AI service error' });

    return res.status(200).json({
      ok: true,
      reply: data.choices?.[0]?.message?.content || 'I could not generate a response.'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'AI service unavailable' });
  }
}
