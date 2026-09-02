import { registerSkill } from '../core/router/index.js';
import { createReminder } from './reminder.js';
import { createNote } from './notes.js';
import { createAutomation } from './automation.js';
import { weather } from './weather.js';
import { search } from './search.js';
import { music } from './music.js';

const KEY = 'btr1_custom_skills_v1';

export function registerDefaultSkills() {
  registerSkill('weather', weather);
  registerSkill('search', search);
  registerSkill('reminder', createReminder);
  registerSkill('notes', createNote);
  registerSkill('music', music);
  registerSkill('automation', createAutomation);
}

export function getSkills() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

export function saveSkill(skill = {}) {
  const clean = {
    id: skill.id || crypto.randomUUID(),
    name: String(skill.name || 'custom skill').trim(),
    description: String(skill.description || '').trim(),
    trigger: String(skill.trigger || '').trim(),
    instructions: String(skill.instructions || '').trim(),
    createdAt: new Date().toISOString()
  };
  const skills = getSkills().filter(item => item.name.toLowerCase() !== clean.name.toLowerCase());
  skills.push(clean);
  localStorage.setItem(KEY, JSON.stringify(skills));
  return clean;
}

export function deleteSkill(name) {
  const skills = getSkills().filter(item => item.name.toLowerCase() !== String(name).toLowerCase());
  localStorage.setItem(KEY, JSON.stringify(skills));
  return skills;
}
