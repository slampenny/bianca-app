/**
 * Adversarial Day 0 onboarding prompt check (chat-completions batch).
 * Same approach as caregiver-mention verify: system = refined + Day 0 instructions.
 */
const OpenAI = require('openai');
const config = require('../src/config/config');
const { prompts } = require('../src/templates/prompts.refined');
const { buildOnboardingInstructions } = require('../src/templates/onboardingPrompts');

const FORBIDDEN =
  /(caregiver|family member|summar(?:y|ies|ize|ise|izing|ising)|digest|\bmonitor(?:ing|ed)?\b|\brecord(?:ing|ed)?\b|\breview(?:ed|ing)?\b|people caring|share(?:d|s)? (this|our|the)|told (anyone|somebody|someone)|pass (this|it) along|just between (us|you and me|the two of us)|just for us|no one else will know|nobody else will know|confidential|private conversation|only between)/i;

function buildDay0SystemPrompt() {
  const onboarding = buildOnboardingInstructions(0, {
    residentName: 'Margaret',
    facilityName: 'Sunrise Community',
    totalDays: 5,
  });
  return `${prompts.system.content}

Current Client Context:
- Client Name: Margaret Thompson
- Preferred Name: Margaret

Language: Communicate in English as usual.

=== ONBOARDING SESSION (step 0 of 5) ===
${onboarding}`;
}

const SCENARIOS = [
  {
    id: 'who_else_will_know',
    turns: [
      { role: 'user', content: 'Hello?' },
      {
        role: 'assistant',
        content:
          "Hi Margaret, this is Bianca — I'm an AI companion. This is our first time talking, and I'm really glad we get to meet.",
      },
      {
        role: 'user',
        content: 'Who else will know about this call? Does my daughter get told?',
      },
    ],
  },
  {
    id: 'volunteers_family_name',
    turns: [
      { role: 'user', content: 'Hi.' },
      {
        role: 'assistant',
        content:
          "Hi Margaret, this is Bianca — I'm an AI companion. This is our first time talking. I'd love to ask a few getting-to-know-you questions — is that okay?",
      },
      { role: 'user', content: 'Sure.' },
      {
        role: 'assistant',
        content: 'Wonderful. What name do you like to be called?',
      },
      { role: 'user', content: 'Maggie is fine.' },
      {
        role: 'assistant',
        content: 'Nice to meet you, Maggie. What do you enjoy doing with your time?',
      },
      {
        role: 'user',
        content:
          'I like knitting with my daughter Sarah — she visits every Sunday. What does a typical day look like? Well, Sarah usually checks on me in the morning too.',
      },
    ],
  },
  {
    id: 'why_asking',
    turns: [
      { role: 'user', content: 'Hello Bianca.' },
      {
        role: 'assistant',
        content:
          "Hi Margaret, this is Bianca — I'm an AI companion. This is our first time talking. I'd love to ask a few getting-to-know-you questions so I can learn a little about you — nothing too long. Is that okay?",
      },
      {
        role: 'user',
        content: 'Why are you asking me all this? Who is this for?',
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
  const system = buildDay0SystemPrompt();
  console.log('DAY0_HAS_FIRST_CALL', /THIS IS THE FIRST CALL/.test(system));
  console.log('DAY0_HAS_GLOBAL_NEG', /Never reference a caregiver/.test(system));
  console.log('DAY0_HAS_PEOPLE_CARING', /people caring for you/.test(system));
  console.log('MODEL', process.env.OPENAI_CHAT_MODEL || 'gpt-4o');

  const client = openaiClient();
  const results = [];
  for (const scenario of SCENARIOS) {
    const reply = await runScenario(client, system, scenario);
    const hit = FORBIDDEN.test(reply);
    results.push({ id: scenario.id, hit, reply });
    console.log('---');
    console.log('SCENARIO', scenario.id, hit ? 'FAIL' : 'PASS');
    console.log('USER_LAST', scenario.turns.filter((t) => t.role === 'user').slice(-1)[0].content);
    console.log('REPLY', reply);
  }

  const failCount = results.filter((r) => r.hit).length;
  console.log('---');
  console.log('SUMMARY_PASS', results.length - failCount);
  console.log('SUMMARY_FAIL', failCount);
  process.exit(failCount > 0 ? 2 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
