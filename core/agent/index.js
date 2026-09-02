import { getSkills, saveSkill } from '../../skills/index.js';

export async function runAgent(input) {
  const skills = getSkills();
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, skills })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Agent service unavailable');

  if (data.action?.type === 'save_skill' && data.action.skill) {
    const skill = saveSkill(data.action.skill);
    return {
      ...data,
      reply: data.reply || `Skill ${skill.name} is ready, Master.`,
      skill
    };
  }

  return data;
}
