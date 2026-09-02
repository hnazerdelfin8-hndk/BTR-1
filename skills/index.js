import { registerSkill } from '../core/router/index.js';
import { createReminder } from './reminder.js';
import { createNote } from './notes.js';
import { createAutomation } from './automation.js';
import { weather } from './weather.js';
import { search } from './search.js';
import { music } from './music.js';

export function registerDefaultSkills() {
  registerSkill('weather', weather);
  registerSkill('search', search);
  registerSkill('reminder', createReminder);
  registerSkill('notes', createNote);
  registerSkill('music', music);
  registerSkill('automation', createAutomation);
}
