export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tool, query = '' } = req.body || {};
  if (!tool) return res.status(400).json({ error: 'Tool is required' });

  try {
    if (tool === 'weather') return await weather(req, res, query);
    if (tool === 'web_search') return await webSearch(req, res, query);
    return res.status(400).json({ error: `Unknown tool: ${tool}` });
  } catch (error) {
    console.error('BTR-1 tool error:', error);
    return res.status(500).json({ error: error.message || 'Tool unavailable' });
  }
}

async function weather(req, res, query) {
  const location = extractLocation(query) || 'Quezon City, Philippines';

  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
  const geoResponse = await fetchWithTimeout(geoUrl, 8000);
  if (!geoResponse.ok) return res.status(502).json({ error: 'Weather location service unavailable' });

  const geo = await geoResponse.json();
  const place = geo.results?.[0];
  if (!place) return res.status(404).json({ error: `I could not find the location: ${location}` });

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`;
  const weatherResponse = await fetchWithTimeout(weatherUrl, 8000);
  if (!weatherResponse.ok) return res.status(502).json({ error: 'Weather service unavailable' });

  const data = await weatherResponse.json();
  const current = data.current;
  if (!current) return res.status(502).json({ error: 'No weather data found' });

  return res.status(200).json({
    ok: true,
    location: [place.name, place.admin1, place.country].filter(Boolean).join(', '),
    temperatureC: Math.round(current.temperature_2m * 10) / 10,
    feelsLikeC: Math.round(current.apparent_temperature * 10) / 10,
    description: weatherDescription(current.weather_code),
    humidity: current.relative_humidity_2m,
    windKph: Math.round(current.wind_speed_10m * 10) / 10
  });
}

function extractLocation(input = '') {
  const text = input.trim();
  if (!text) return '';
  const match = text.match(/(?:weather|temperature|forecast)(?:\s+(?:in|at|for))?\s+(.+)$/i);
  if (match?.[1]) return match[1].replace(/[?.!]+$/, '').trim();
  return text.replace(/^what(?:'s| is)\s+(?:the\s+)?(?:weather|temperature|forecast)\s*(?:like)?\s*/i, '').replace(/[?.!]+$/, '').trim();
}

function weatherDescription(code) {
  const descriptions = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
    55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 80: 'Slight rain showers',
    81: 'Moderate rain showers', 82: 'Violent rain showers', 95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
  };
  return descriptions[code] || 'Current conditions available';
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'BTR-1/1.0' } });
  } finally {
    clearTimeout(timer);
  }
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
      model: process.env.GROQ_SEARCH_MODEL || 'groq/compound-mini',
      messages: [
        { role: 'system', content: 'Answer the search request using web search. Clearly distinguish facts from uncertainty and keep the answer concise.' },
        { role: 'user', content: query.trim() }
      ],
      max_tokens: 900
    })
  });

  const data = await response.json();
  if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'Search service error' });
  return res.status(200).json({ ok: true, answer: data.choices?.[0]?.message?.content || '' });
}
