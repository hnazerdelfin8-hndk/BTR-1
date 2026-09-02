const KEY = 'btr1_reminders_v1';

export function createReminder(input = '') {
  const item = { id: crypto.randomUUID(), text: input, createdAt: new Date().toISOString() };
  const list = JSON.parse(localStorage.getItem(KEY) || '[]');
  list.push(item);
  localStorage.setItem(KEY, JSON.stringify(list));
  return { ok: true, item };
}
