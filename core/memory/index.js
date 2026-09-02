const KEY = 'btr1_memory_v1';
const LIMIT = 50;

export function getMemory() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

export function remember(entry) {
  const memory = [...getMemory(), { ...entry, createdAt: new Date().toISOString() }].slice(-LIMIT);
  localStorage.setItem(KEY, JSON.stringify(memory));
  return memory;
}

export function clearMemory() {
  localStorage.removeItem(KEY);
}
