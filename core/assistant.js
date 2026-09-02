import { think } from './brain/index.js';
import { route } from './router/index.js';
import { registerDefaultSkills } from '../skills/index.js';
import { getMemory, remember } from './memory/index.js';

let initialized = false;

function init() {
  if (!initialized) {
    registerDefaultSkills();
    initialized = true;
  }
}

export async function runAssistant(input) {
  init();
  const thought = think(input);

  if (thought.requiresSkill) {
    const routed = await route(thought.intent, input, { memory: getMemory() });
    if (routed.handled) {
      const reply = formatSkillResult(thought.intent, routed.result);
      remember({ user: input, assistant: reply });
      return { ...thought, reply, data: routed.result };
    }
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: input, memory: getMemory() })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'AI service unavailable');

  remember({ user: input, assistant: data.reply });
  return { ...thought, reply: data.reply };
}

function formatSkillResult(intent, result) {
  if (intent === 'weather') {
    return `${result.location}: ${result.temperatureC}°C, ${result.description}. Feels like ${result.feelsLikeC}°C, humidity ${result.humidity}%.`;
  }
  if (intent === 'search') return result.answer || 'I could not find an answer.';
  if (intent === 'music') return `Opening music search for ${result.query}.`;
  if (intent === 'reminder') return `Reminder saved: ${result.item?.text || 'your reminder'}.`;
  if (intent === 'notes') return `Note saved: ${result.note?.text || 'your note'}.`;
  if (intent === 'automation') return `Automation saved: ${result.automation?.action || 'your automation'}.`;
  return 'Done, Master.';
}
