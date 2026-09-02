export function detectIntent(input = '') {
  const text = input.toLowerCase().trim();
  if (/\b(weather|temperature|forecast)\b/.test(text)) return 'weather';
  if (/\b(search|look up|find online|google)\b/.test(text)) return 'search';
  if (/\b(remind|reminder)\b/.test(text)) return 'reminder';
  if (/\b(note|remember this|write this down)\b/.test(text)) return 'notes';
  if (/\b(play|music|song|spotify|youtube music)\b/.test(text)) return 'music';
  if (/\b(schedule|automate|automation|every day|every week)\b/.test(text)) return 'automation';
  return 'conversation';
}
