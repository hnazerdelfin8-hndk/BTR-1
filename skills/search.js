export async function search(input) {
  const response = await fetch('/api/tools', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool: 'web_search', query: input })
  });
  if (!response.ok) throw new Error('Search service unavailable');
  return response.json();
}
