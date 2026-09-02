const skills = new Map();

export function registerSkill(name, handler) {
  if (!name || typeof handler !== 'function') throw new TypeError('Invalid skill');
  skills.set(name, handler);
}

export function listSkills() {
  return [...skills.keys()];
}

export async function route(intent, input, context = {}) {
  const handler = skills.get(intent);
  if (!handler) return { handled: false, intent, message: 'No skill registered for this request.' };
  return { handled: true, intent, result: await handler(input, context) };
}
