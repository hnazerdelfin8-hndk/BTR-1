export function music(input = '') {
  const query = encodeURIComponent(input.trim());
  return { ok: true, query, url: `https://www.youtube.com/results?search_query=${query}` };
}
