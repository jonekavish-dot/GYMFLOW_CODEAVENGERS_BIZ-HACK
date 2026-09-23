// Gemini class recommendations via Firebase AI Logic — the Gemini key stays on
// Google's side instead of shipping in client JS.
// One-time: Console → Build → AI Logic → Get started → "Gemini Developer API".
import { getAI, getGenerativeModel, GoogleAIBackend } from '../../core/sdk/ai.js';
import { app } from '../../core/firebase.js';

let model;
function getModel() {
  model ??= getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), { model: 'gemini-2.5-flash' });
  return model;
}

/**
 * @param {string} goals free-text member goals
 * @param {Array<{id:string,title:string,trainer:string,tags?:string[]}>} classes upcoming classes
 * @returns {Promise<Array<{classId:string, reason:string}>>}
 */
export async function recommendClasses(goals, classes) {
  const catalogue = classes.map((c) => `- id=${c.id} | ${c.title} | trainer ${c.trainer} | ${(c.tags || []).join(', ')}`).join('\n');
  const prompt = `You are a gym coach. Member goals: "${goals}".
Upcoming classes:
${catalogue}

Pick up to 3 classes that best fit the goals. Reply with JSON only:
[{"classId": "<id>", "reason": "<one sentence>"}]`;
  const res = await getModel().generateContent(prompt);
  const text = res.response.text().replace(/```json|```/g, '').trim();
  const ids = new Set(classes.map((c) => c.id));
  return JSON.parse(text).filter((r) => ids.has(r.classId));
}
