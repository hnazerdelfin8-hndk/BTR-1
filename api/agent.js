const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY is not configured' });

  const { input = '', skills = [] } = req.body || {};
  if (!input.trim()) return res.status(400).json({ error: 'Input is required' });

  try {
    const plan = await groq({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      messages: [
        {
          role: 'system',
          content: `You are BTR-1, an agentic personal AI assistant. Address the user as Master.
You can plan tasks and choose one safe action at a time. Never claim an action happened unless the server executed it.
Available actions:
- none: answer normally.
- save_skill: create a reusable skill definition when Master asks BTR-1 to create, learn, add, or set up a skill.
- weather: get current weather when explicitly requested.
- web_search: search the web when explicitly requested.
Custom skills are browser-local and may be used as instructions for future conversations.
Return ONLY valid JSON with this shape:
{"action":{"type":"none|save_skill|weather|web_search","skill":null|{"name":"","description":"","trigger":"","instructions":""},"query":""},"reply":""}
For save_skill, make the skill practical and reusable. Do not put executable JavaScript in the skill; store natural-language instructions only.`
        },
        { role: 'user', content: `Master's request: ${input.trim()}\nExisting custom skills:\n${JSON.stringify(skills.slice(-30))}` }
      ],
      temperature: 0.1,
      max_tokens: 900,
      json: true
    });

    const action = normalizeAction(plan.action);

    if (action.type === 'save_skill') {
      return res.status(200).json({ ok: true, action, reply: plan.reply || `I can set up ${action.skill.name} for you, Master.` });
    }

    if (action.type === 'weather') {
      const result = await getWeather(action.query || input);
      const reply = await summarize(input, result);
      return res.status(200).json({ ok: true, action, data: result, reply });
    }

    if (action.type === 'web_search') {
      const result = await webSearch(action.query || input);
      const reply = await summarize(input, result);
      return res.status(200).json({ ok: true, action, data: result, reply });
    }

    return res.status(200).json({ ok: true, action, reply: plan.reply || 'I understand, Master.' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Agent service unavailable' });
  }
}

function normalizeAction(action = {}) {
  const type = ['none', 'save_skill', 'weather', 'web_search'].includes(action.type) ? action.type : 'none';
  return {
    type,
    query: String(action.query || '').trim(),
    skill: type === 'save_skill' && action.skill ? {
      name: String(action.skill.name || '').trim().slice(0, 80),
      description: String(action.skill.description || '').trim().slice(0, 300),
      trigger: String(action.skill.trigger || '').trim().slice(0, 300),
      instructions: String(action.skill.instructions || '').trim().slice(0, 2000)
    } : null
  };
}

async function groq({ model, messages, temperature, max_tokens, json = false }) {
  const body = { model, messages, temperature, max_tokens };
  if (json) body.response_format = { type: 'json_object' };

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'Groq service error');
  const content = data.choices?.[0]?.message?.content || '{}';
  return json ? JSON.parse(content) : content;
}

async function summarize(input, toolResult) {
  return groq({
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    messages: [
      { role: 'system', content: 'You are BTR-1. Give Master a concise, natural answer. Use only the supplied tool result. Never invent missing facts.' },
      { role: 'user', content: `Request: ${input}\nTool result: ${JSON.stringify(toolResult)}` }
    ],
    temperature: 0.2,
    max_tokens: 500
  });
}

async function getWeather(query) {
  const location = extractLocation(query);
  const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`);
  const geoData = await geo.json();
  const place = geoData.results?.[0];
  if (!place) throw new Error(`I could not find the location: ${location}`);

  const weather = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`);
  const data = await weather.json();
  return {
    location: `${place.name}${place.country ? `, ${place.country}` : ''}`,
    temperatureC: data.current?.temperature_2m,
    feelsLikeC: data.current?.apparent_temperature,
    humidity: data.current?.relative_humidity_2m,
    windKph: data.current?.wind_speed_10m,
    weatherCode: data.current?.weather_code
  };
}

function extractLocation(query) {
  const match = query.match(/(?:weather|temperature|forecast)\s+(?:in|at|for)\s+(.+)/i);
  return (match?.[1] || query.replace(/^.*?\b(?:weather|temperature|forecast)\b/i, '').trim() || 'Quezon City').replace(/[?.!]+$/, '').trim();
}

async function webSearch(query) {
  const answer = await groq({
    model: process.env.GROQ_SEARCH_MODEL || 'groq/compound-mini',
    messages: [
      { role: 'system', content: 'Answer the user search request using your available web-search capability. Distinguish uncertainty and keep it concise.' },
      { role: 'user', content: query.trim() }
    ],
    temperature: 0.2,
    max_tokens: 900
  });
  return { answer };
}
