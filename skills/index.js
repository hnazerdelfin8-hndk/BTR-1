import { registerSkill } from '../core/router/index.js';
import { createReminder } from './reminder.js';
import { createNote } from './notes.js';
import { createAutomation } from './automation.js';

export function registerDefaultSkills() {
  registerSkill('reminder', createReminder);
  registerSkill('notes', createNote);
  registerSkill('automation', createAutomation);
}
