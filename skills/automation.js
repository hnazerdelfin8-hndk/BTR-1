const KEY = 'btr1_automations_v1';

export function createAutomation(input = '') {
  const automation = { id: crypto.randomUUID(), action: input.trim(), createdAt: new Date().toISOString(), enabled: true };
  const list = JSON.parse(localStorage.getItem(KEY) || '[]');
  list.push(automation);
  localStorage.setItem(KEY, JSON.stringify(list));
  return { ok: true, automation };
}

export function getAutomations() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}
