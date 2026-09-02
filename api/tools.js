export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tool, query = '' } = req.body || {};
  if (!tool) return res.status(400).json({ error: 'Tool is required' });

  try {
    if (tool === 'weather') return await weather(req, res, query);
    if (tool === 'web_search') return await webSearch(req, res, query);
    return res.status(400).json({ error: `Unknown tool: ${tool}` });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Tool unavailable' });
  }
}

async function weather(req, res, query) {
  const location = query.trim() || 'Quezon City, Philippines';
  const url = `https://wttr.in/${encodeURIComponent(location)}?format=j1`;
  const response = await fetch(url, { headers: { 'User-Agent': 'BTR-1/1.0' } });
  if (!response.ok) return res.status(502).json({ error: 'Weather service unavailable' });
  const data = await response.json();
  const current = data.current_condition?.[0];
  if (!current) return res.status(502).json({ error: 'No weather data found' });
  return res.status(200).json({
    ok: true,
    location,
    temperatureC: current.temp_C,
    feelsLikeC: current.FeelsLikeC,
    description: current.weatherDesc?.[0]?.value || '',
    humidity: current.humidity,
    windKph: current.windspeedKmph
  });
}

async function webSearch(req, res, query) {
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY is not configured' });
  if (!query.trim()) return res.status(400).json({ error: 'Search query is required' });

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.GROQ_SEARCH_MODEL || 'compound-beta-mini',
      messages: [
        { role: 'system', content: 'Answer the search request using available web-search capability. Clearly distinguish facts from uncertainty and keep the answer concise.' },
        { role: 'user', content: query.trim() }
      ],
      temperature: 0.2,
      max_tokens: 900
    })
  });

  const data = await response.json();
  if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'Search service error' });
  return res.status(200).json({ ok: true, answer: data.choices?.[0]?.message?.content || '' });
}
