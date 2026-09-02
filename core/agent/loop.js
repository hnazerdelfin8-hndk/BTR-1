import { executeTool, listTools } from './tools.js';

const MAX_STEPS = 5;

export async function runAgentLoop({ planStep, context = {} }) {
  const history = [];

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const decision = await planStep({ history, tools: listTools(), context });
    history.push({ step: step + 1, decision });

    if (!decision || decision.type === 'final') {
      return { ok: true, history, result: decision?.result ?? decision?.reply ?? null };
    }

    if (decision.type !== 'tool') {
      return { ok: false, history, result: 'The agent produced an invalid action.' };
    }

    const result = await executeTool(decision.tool, decision.input || {}, context);
    history.push({ step: step + 1, tool: decision.tool, result });
  }

  return { ok: false, history, result: 'I reached the maximum number of action steps.' };
}
