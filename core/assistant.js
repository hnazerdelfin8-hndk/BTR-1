import { think } from './brain/index.js';
import { runAgent } from './agent/index.js';
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
  const result = await runAgent(input);
  const reply = result.reply || 'I could not complete that request, Master.';
  remember({ user: input, assistant: reply });
  return { ...thought, reply, data: result.data, action: result.action, skill: result.skill };
}
