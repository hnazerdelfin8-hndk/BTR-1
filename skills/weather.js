export async function weather(input) {
  const response = await fetch('/api/tools', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool: 'weather', query: input })
  });
  if (!response.ok) throw new Error('Weather service unavailable');
  return response.json();
}
