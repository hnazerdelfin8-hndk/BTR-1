const KEY = 'btr1_notes_v1';

export function createNote(input = '') {
  const note = { id: crypto.randomUUID(), text: input.trim(), createdAt: new Date().toISOString() };
  const notes = JSON.parse(localStorage.getItem(KEY) || '[]');
  notes.push(note);
  localStorage.setItem(KEY, JSON.stringify(notes));
  return { ok: true, note };
}

export function getNotes() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}
