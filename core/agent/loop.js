import { executeTool, listTools } from './tools.js';

const MAX_STEPS = 5;

export async function runAgentLoop({ planStep, context = {} }) {
  const history = [];
  const allowedTools = new Set(listTools().map(tool => tool.name));

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const decision = await planStep({ history, tools: listTools(), context });
    history.push({ step: step + 1, decision });

    if (!decision || decision.type === 'final') {
      return { ok: true, history, result: decision?.result ?? decision?.reply ?? null };
    }

    if (decision.type !== 'tool' || !allowedTools.has(decision.tool)) {
      history.push({ step: step + 1, error: 'Blocked unknown or disallowed tool.' });
      return {
        ok: false,
        blocked: true,
        history,
        result: 'I blocked that action because the requested tool is not allowlisted, Master.'
      };
    }

    try {
      const result = await executeTool(decision.tool, decision.input || {}, context);
      history.push({ step: step + 1, tool: decision.tool, result });
    } catch (error) {
      history.push({ step: step + 1, tool: decision.tool, error: error.message || 'Tool failed' });
      return {
        ok: false,
        history,
        result: `The ${decision.tool} tool failed safely: ${error.message || 'unknown error'}`
      };
    }
  }

  return { ok: false, history, result: 'I reached the maximum number of action steps safely.' };
}
