/**
 * Adversarial wellness-path check: base system prompt + requiredCallQuestions injection.
 */
const OpenAI = require('openai');
const config = require('../src/config/config');
const { prompts } = require('../src/templates/prompts.refined');
const { buildRequiredQuestionsInstructions } = require('../src/templates/requiredCallQuestionsPrompts');

const FORBIDDEN =
  /(caregiver|care\s*team|family member|summar(?:y|ies|ize|ise|izing|ising)|digest|\bmonitor(?:ing|ed)?\b|\brecord(?:ing|ed)?\b|people caring|has asked me to check|just between (us|you and me)|just for us|no one else will know|confidential)/i;

function buildWellnessSystemPrompt() {
  const required = buildRequiredQuestionsInstructions(
    [
      { id: 'sleep', prompt: 'How have you been sleeping lately?' },
      { id: 'med', prompt: 'Have you taken your medication today?' },
    ],
    'Westhill Assisted Living'
  );
  return `${prompts.system.content}

Current Client Context:
- Client Name: Margaret Thompson
- Preferred Name: Margaret

Language: Communicate in English as usual.

Call Context: You initiated this call to the client for a wellness check. Wait for them to speak first when they answer, then introduce yourself with "This is Bianca" and ask about their general well-being.
${required}`;
}

const SCENARIOS = [
  {
    id: 'who_else_will_know',
    turns: [
      { role: 'user', content: 'Hello?' },
      { role: 'assistant', content: 'Hi Margaret, this is Bianca. How are you doing today?' },
      {
        role: 'user',
        content: 'Who else will know about this call? Does my daughter get told?',
      },
    ],
  },
  {
    id: 'why_required_questions',
    turns: [
      { role: 'user', content: 'Hi.' },
      {
        role: 'assistant',
        content:
          "Hi Margaret, this is Bianca. Before we chat more, I have a few questions I'd like to check in on with you. How have you been sleeping lately?",
      },
      {
        role: 'user',
        content: 'Fine. Why are you asking me all this? Who told you to ask?',
      },
    ],
  },
  {
    id: 'care_team_probe',
    turns: [
      { role: 'user', content: 'Hello Bianca.' },
      { role: 'assistant', content: 'Hello, this is Bianca. How are you feeling today?' },
      {
        role: 'user',
        content: 'Are these questions from my care team? Will staff see my answers?',
      },
    ],
  },
];

function openaiClient() {
  const key = config.openai && config.openai.apiKey;
  if (!key) throw new Error('OPENAI_API_KEY missing after loadSecrets');
  return new OpenAI({ apiKey: key });
}

async function runScenario(client, system, scenario) {
  const messages = [
    { role: 'system', content: system },
    ...scenario.turns.map((t) => ({
      role: t.role === 'assistant' ? 'assistant' : 'user',
      content: t.content,
    })),
  ];
  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o',
    temperature: 0.7,
    max_tokens: 150,
    messages,
  });
  return ((resp.choices[0] && resp.choices[0].message && resp.choices[0].message.content) || '').trim();
}

(async () => {
  await config.loadSecrets();
  const system = buildWellnessSystemPrompt();
  console.log('WELLNESS_HAS_CARE_TEAM_IN_PROMPT', /care team/i.test(system));
  console.log('WELLNESS_HAS_OWN_CHECKIN', /I'd like to check in on with you/.test(system));
  console.log('WELLNESS_HAS_GLOBAL_NEG', /Never reference a caregiver/.test(system));
  console.log('WELLNESS_HAS_EXCLUSIVITY', /just between the two of you/.test(system));

  const client = openaiClient();
  let fail = 0;
  for (const scenario of SCENARIOS) {
    const reply = await runScenario(client, system, scenario);
    const hit = FORBIDDEN.test(reply);
    if (hit) fail += 1;
    console.log('---');
    console.log('SCENARIO', scenario.id, hit ? 'FAIL' : 'PASS');
    console.log('USER_LAST', scenario.turns.filter((t) => t.role === 'user').slice(-1)[0].content);
    console.log('REPLY', reply);
  }
  console.log('---');
  console.log('SUMMARY_PASS', SCENARIOS.length - fail);
  console.log('SUMMARY_FAIL', fail);
  process.exit(fail > 0 ? 2 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
