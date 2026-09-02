import { registerTool } from '../core/agent/tools.js';
import { runAgentLoop } from '../core/agent/loop.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const ALLOWED_TOOLS = ['weather', 'web_search', 'create_skill_definition'];

registerTool('weather', {
  description: 'Get current weather for a location.',
  input: { query: 'string' },
  execute: async ({ query }) => getWeather(String(query || 'Quezon City'))
});

registerTool('web_search', {
  description: 'Search the web for current information when the user explicitly asks to search/look up/find online.',
  input: { query: 'string' },
  execute: async ({ query }) => webSearch(String(query || ''))
});

registerTool('create_skill_definition', {
  description: 'Prepare a reusable natural-language custom skill definition. Never creates executable code.',
  input: { name: 'string', description: 'string', trigger: 'string', instructions: 'string' },
  execute: async ({ name, description, trigger, instructions }) => ({
    ok: true,
    skill: normalizeSkill({ name, description, trigger, instructions })
  })
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY is not configured' });

  const { input = '', skills = [] } = req.body || {};
  if (!String(input).trim()) return res.status(400).json({ error: 'Input is required' });

  try {
    const request = String(input).trim();
    const result = await runAgentLoop({
      context: { request, skills: Array.isArray(skills) ? skills.slice(-30) : [] },
      planStep: ({ history, tools, context }) => planNextStep({ history, tools, context })
    });

    const finalDecision = [...result.history].reverse().find(item => item.decision?.type === 'final')?.decision;
    const skillTool = [...result.history].reverse().find(item => item.tool === 'create_skill_definition' && item.result?.skill);
    const action = skillTool
      ? { type: 'save_skill', skill: skillTool.result.skill, query: '' }
      : { type: 'none', query: '', skill: null };

    return res.status(200).json({
      ok: result.ok,
      reply: finalDecision?.reply || result.result || 'I understand, Master.',
      action,
      data: finalDecision?.data || null,
      history: result.history
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Agent service unavailable' });
  }
}

async function planNextStep({ history, tools, context }) {
  const toolNames = tools.filter(tool => ALLOWED_TOOLS.includes(tool.name));
  const transcript = history.map(item => {
    if (item.decision) return { decision: item.decision };
    return { tool: item.tool, result: item.result };
  });

  const plan = await groq({
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    messages: [
      {
        role: 'system',
        content: `You are BTR-1, an agentic personal AI assistant. Address the user as Master.
Work in a loop: understand the request, choose a safe allowlisted tool when needed, inspect its result, then finish.
Never claim a tool action happened unless a tool result proves it.
Available tools:
${toolNames.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}
Rules:
- Use weather only for an explicit weather/temperature/forecast request.
- Use web_search only when Master explicitly asks to search, look up, find online, or when current web information is necessary.
- If Master asks you to create, learn, add, or set up a skill, use create_skill_definition first, then finish.
- Never request arbitrary code execution, file deletion, secrets, or destructive actions.
- If no tool is needed, finish directly.
Return ONLY valid JSON:
{"type":"tool","tool":"weather|web_search|create_skill_definition","input":{}} OR {"type":"final","reply":"","data":null}
For create_skill_definition input, include name, description, trigger, and natural-language instructions only.`
      },
      {
        role: 'user',
        content: `Master's request: ${context.request}\nExisting custom skills:\n${JSON.stringify(context.skills)}\nAgent history:\n${JSON.stringify(transcript)}`
      }
    ],
    temperature: 0.1,
    max_tokens: 900,
    json: true
  });

  return normalizeDecision(plan);
}

function normalizeDecision(decision = {}) {
  if (decision.type === 'tool' && ALLOWED_TOOLS.includes(decision.tool)) {
    const input = decision.input && typeof decision.input === 'object' ? decision.input : {};
    if (decision.tool === 'create_skill_definition') {
      return {
        type: 'tool',
        tool: decision.tool,
        input: normalizeSkill(input)
      };
    }
    return {
      type: 'tool',
      tool: decision.tool,
      input: { query: String(input.query || '').trim() }
    };
  }

  return {
    type: 'final',
    reply: String(decision.reply || 'I understand, Master.'),
    data: decision.data ?? null
  };
}

function normalizeSkill(skill = {}) {
  return {
    name: String(skill.name || 'custom skill').trim().slice(0, 80),
    description: String(skill.description || '').trim().slice(0, 300),
    trigger: String(skill.trigger || '').trim().slice(0, 300),
    instructions: String(skill.instructions || '').trim().slice(0, 2000)
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
