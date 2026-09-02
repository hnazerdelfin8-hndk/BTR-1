import { detectIntent } from './intent.js';

export function think(input) {
  const intent = detectIntent(input);
  return { input, intent, requiresSkill: intent !== 'conversation' };
}
