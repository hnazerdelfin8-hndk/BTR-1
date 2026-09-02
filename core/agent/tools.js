const tools = new Map();

export function registerTool(name, definition) {
  if (!name || !definition || typeof definition.execute !== 'function') {
    throw new TypeError('Invalid tool definition');
  }
  tools.set(name, { name, ...definition });
}

export function listTools() {
  return [...tools.values()].map(({ execute, ...tool }) => tool);
}

export async function executeTool(name, input = {}, context = {}) {
  const tool = tools.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  if (typeof tool.execute !== 'function') throw new Error(`Tool is not executable: ${name}`);
  return tool.execute(input, context);
}
