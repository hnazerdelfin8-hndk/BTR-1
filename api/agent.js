import { registerTool } from '../core/agent/tools.js';
import { runAgentLoop } from '../core/agent/loop.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const ALLOWED_TOOLS = ['weather', 'web_search', 'create_skill_definition', 'run_custom_skill'];

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

registerTool('run_custom_skill', {
  description: 'Run one existing browser-local custom skill using its natural-language instructions.',
  input: { skill: 'object', request: 'string' },
  execute: async ({ skill, request }) => {
    if (!skill || !skill.instructions) throw new Error('Custom skill is missing instructions.');
    const reply = await groq({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      messages: [
        {
          role: 'system',
          content: `You are BTR-1 executing a user-created custom skill. Follow the skill instructions exactly as natural-language guidance. Do not execute code, access secrets, delete data, or claim external actions. Address the user as Master. Keep the answer useful and concise.\nSkill: ${JSON.stringify(skill)}`
        },
        { role: 'user', content: `Master triggered this skill with: ${String(request || '').trim()}` }
      ],
      temperature: 0.2,
      max_tokens: 600
    });
    return { ok: true, reply };
  }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY is not configured' });

  const { input = '', skills = [] } = req.body || {};
  if (!String(input).trim()) return res.status(400).json({ error: 'Input is required' });

  try {
    const request = String(input).trim();
    const safeSkills = Array.isArray(skills) ? skills.slice(-30).map(normalizeSkill) : [];
    const result = await runAgentLoop({
      context: { request, skills: safeSkills },
      planStep: ({ history, tools, context }) => planNextStep({ history, tools, context })
    });

    const finalDecision = [...result.history].reverse().find(item => item.decision?.type === 'final')?.decision;
    const skillTool = [...result.history].reverse().find(item => item.tool === 'create_skill_definition' && item.result?.skill);
    const customTool = [...result.history].reverse().find(item => item.tool === 'run_custom_skill' && item.result?.reply);
    const weatherTool = [...result.history].reverse().find(item => item.tool === 'weather' && item.result);
    const searchTool = [...result.history].reverse().find(item => item.tool === 'web_search' && item.result);

    const action = skillTool
      ? { type: 'save_skill', skill: skillTool.result.skill, query: '' }
      : { type: 'none', query: '', skill: null };

    return res.status(200).json({
      ok: result.ok,
      blocked: Boolean(result.blocked),
      reply: finalDecision?.reply || customTool?.result?.reply || result.result || 'I understand, Master.',
      action,
      data: finalDecision?.data || weatherTool?.result || searchTool?.result || null,
      history: result.history
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Agent service unavailable' });
  }
}

async function planNextStep({ history, tools, context }) {
  const toolNames = tools.filter(tool => ALLOWED_TOOLS.includes(tool.name));
  const transcript = history.map(item => item.decision ? { decision: item.decision } : { tool: item.tool, result: item.result, error: item.error });

  const plan = await groq({
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    messages: [
      {
        role: 'system',
        content: `You are BTR-1, an agentic personal AI assistant. Address the user as Master.\nWork in a loop: understand the request, choose a safe allowlisted tool when needed, inspect its result, then finish. Never claim an action happened unless a tool result proves it.\nAvailable tools:\n${toolNames.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}\nRules:\n- Use weather for explicit weather/temperature/forecast requests. Extract the actual place from the request and pass it as query.\n- Use web_search when Master explicitly asks to search, look up, find online, or current web information is necessary.\n- If Master asks to create, learn, add, or set up a skill, use create_skill_definition first, then finish.\n- If Master triggers an existing custom skill, select the matching skill by name or trigger and use run_custom_skill.\n- Never request arbitrary code execution, file deletion, secrets, or destructive actions.\n- If no tool is needed, finish directly.\nReturn ONLY valid JSON: {"type":"tool","tool":"weather|web_search|create_skill_definition|run_custom_skill","input":{}} OR {"type":"final","reply":"","data":null}.\nFor create_skill_definition input, include name, description, trigger, and natural-language instructions only. For run_custom_skill input, include the complete matching skill object and the current request.`
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

  return normalizeDecision(plan, context.skills);
}

function normalizeDecision(decision = {}, skills = []) {
  if (decision.type === 'tool' && ALLOWED_TOOLS.includes(decision.tool)) {
    const input = decision.input && typeof decision.input === 'object' ? decision.input : {};
    if (decision.tool === 'create_skill_definition') {
      return { type: 'tool', tool: decision.tool, input: normalizeSkill(input) };
    }
    if (decision.tool === 'run_custom_skill') {
      const candidate = input.skill && typeof input.skill === 'object' ? input.skill : findMatchingSkill(skills, input.request);
      if (!candidate) return { type: 'final', reply: 'I could not find a matching custom skill, Master.', data: null };
      return { type: 'tool', tool: decision.tool, input: { skill: normalizeSkill(candidate), request: String(input.request || '').trim() } };
    }
    return { type: 'tool', tool: decision.tool, input: { query: String(input.query || '').trim() } };
  }
  return { type: 'final', reply: String(decision.reply || 'I understand, Master.'), data: decision.data ?? null };
}

function findMatchingSkill(skills, request = '') {
  const text = String(request).toLowerCase();
  return skills.find(skill => {
    const trigger = String(skill.trigger || '').toLowerCase().trim();
    const name = String(skill.name || '').toLowerCase().trim();
    return (trigger && text.includes(trigger)) || (name && text.includes(name));
  });
}

function normalizeSkill(skill = {}) {
  return {
    id: skill.id ? String(skill.id).slice(0, 100) : undefined,
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
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
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
  if (!geo.ok) throw new Error('Weather location service is unavailable.');
  const geoData = await geo.json();
  const place = geoData.results?.[0];
  if (!place) throw new Error(`I could not find the location: ${location}`);
  const weather = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`);
  if (!weather.ok) throw new Error('Weather forecast service is unavailable.');
  const data = await weather.json();
  return {
    location: `${place.name}${place.admin1 ? `, ${place.admin1}` : ''}${place.country ? `, ${place.country}` : ''}`,
    temperatureC: data.current?.temperature_2m,
    feelsLikeC: data.current?.apparent_temperature,
    humidity: data.current?.relative_humidity_2m,
    windKph: data.current?.wind_speed_10m,
    weatherCode: data.current?.weather_code
  };
}

function extractLocation(query) {
  const raw = String(query || '').trim();
  const match = raw.match(/(?:weather|temperature|forecast)\s+(?:in|at|for)\s+(.+)/i);
  let location = match?.[1] || raw.replace(/^.*?\b(?:weather|temperature|forecast)\b/i, '').trim();
  location = location.replace(/\b(today|now|right now|currently|please|pls)\b/gi, ' ').replace(/[?.!]+$/, '').trim();
  return location || 'Quezon City';
}

async function webSearch(query) {
  if (!query.trim()) throw new Error('Search query is empty.');
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
