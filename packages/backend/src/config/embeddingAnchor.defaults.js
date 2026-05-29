/**
 * Default anchor phrases and tree shape for embedding-based detectors.
 * Seeded into Mongo (EmbeddingAnchorPhrase) when the collection is empty; editable via admin API.
 * English phrases below; non-English phrases merged from embeddingAnchor.i18n.js (all supported patient languages).
 */
const { I18N_ANCHORS } = require('./embeddingAnchor.i18n');
const { mergeI18nIntoAnchorTree, SUPPORTED_ANCHOR_LANGUAGES } = require('./embeddingAnchor.mergeI18n');

const ANCHOR_TREE_EN = {
  emergencyDetector: {
    medical_emergency: {
      severity: 'CRITICAL',
      category: 'medical_emergency',
      phrases: [
        'heart attack',
        'myocardial infarction',
        'having a heart attack',
        'stroke right now',
        'severe stroke',
        'cannot breathe emergency',
        'overdose',
        'severe chest pain',
        'crushing chest pain',
      ],
    },
    breathing: {
      severity: 'CRITICAL',
      category: 'medical_emergency',
      phrases: ["can't breathe", 'cannot breathe', 'choking', 'not getting air'],
    },
    self_harm: {
      severity: 'CRITICAL',
      category: 'self_harm',
      phrases: [
        'kill myself',
        'want to die',
        'end my life',
        'suicide',
        'hurt myself on purpose',
        'self harm',
      ],
    },
    physical_acute: {
      severity: 'HIGH',
      category: 'physical_acute',
      phrases: [
        'fell and cannot get up',
        'severe pain right now',
        'unbearable pain',
        'bleeding heavily',
        'passed out',
      ],
    },
    request_urgent: {
      severity: 'MEDIUM',
      category: 'Request',
      phrases: ['call 911 now', 'need an ambulance immediately', 'emergency help right now'],
    },
    third_party_emergency: {
      severity: 'HIGH',
      category: 'medical_emergency',
      phrases: [
        'someone collapsed',
        'roommate not breathing',
        'person next to me unconscious',
        'they are having a heart attack',
      ],
    },
    passive_ideation: {
      severity: 'HIGH',
      category: 'self_harm',
      phrases: [
        'wish I was dead',
        'no point living',
        'better off dead',
        'thoughts of hurting myself',
      ],
    },
  },
  abuseNeglectDetector: {
    physical: {
      injuries: ['hit me', 'slapped me', 'bruises on my arms', 'someone hurt me'],
      fearOfPerson: ['afraid of the aide', 'scared when they come in'],
      punishment: ['punished me', 'taught me a lesson'],
    },
    emotional: {
      emotionalIsolation: ['not allowed to call my daughter', 'forbidden to leave'],
      control: ['controls everything I do', 'won’t let me choose'],
      threats: ['threatened me', 'said they would hurt me'],
      belittling: ['worthless', 'stupid', 'burden to everyone'],
      fearLanguage: ['walking on eggshells', 'afraid to speak'],
    },
    neglect: {
      basicNeeds: [
        'no food for two days',
        'left hungry',
        'no water',
        'no heat in winter',
      ],
      medicalCare: [
        'cannot see a doctor',
        'missed all my medications',
        'no medical care',
      ],
      neglectIsolation: ['no one visits', 'abandoned here'],
      timeAlone: ['alone for weeks', 'no staff for hours'],
    },
  },
  financialExploitationDetector: {
    scamIndicators: [
      'irs demanding payment in gift cards',
      'you won the lottery send fee',
      'grandchild in jail wire money',
      'social security number verify now',
    ],
    urgencyLanguage: [
      'act now or lose everything',
      'do not tell anyone',
      'deadline today only',
      'urgent send money immediately',
    ],
    transferMethods: [
      'wire transfer to this account',
      'buy gift cards and read numbers',
      'bitcoin wallet address',
      'buy bitcoin with my savings',
      'western union payment',
    ],
    helpRequests: [
      'lend me five thousand dollars',
      'need emergency loan today',
      'borrow money from your account',
    ],
    largeAmounts: [
      'send ten thousand dollars',
      'fifty thousand dollar wire',
      'a hundred thousand dollars',
      'hundred grand',
    ],
    relationshipMoney: [
      'new friend online needs money',
      'person I met asked me to send cash',
    ],
  },
  relationshipPatternDetector: {
    newPeople: [
      'I met someone new online who messages me every day',
      'A new person in my life wants me to keep it secret',
      'A stranger I just met is asking for my help',
    ],
    isolation: [
      'Nobody comes to visit me anymore',
      'I am not allowed to see my family or friends',
      'I feel cut off from everyone I know',
    ],
    control: [
      'They control everything I do in this house',
      'I have to ask permission to leave or call anyone',
      'They decide who I am allowed to talk to',
    ],
    dependency: [
      'They are the only one who can help me',
      'I have nobody else to turn to I rely on them for everything',
      'If they leave I have no one I depend on them completely',
    ],
    suspiciousBehavior: [
      'They want me to send money to a new account',
      'They keep asking for my PIN and bank information',
      'They asked me to buy gift cards and read the numbers',
    ],
  },
};

const ANCHOR_TREE = mergeI18nIntoAnchorTree(
  JSON.parse(JSON.stringify(ANCHOR_TREE_EN)),
  I18N_ANCHORS
);

function flattenListFromTree(tree) {
  const list = [];
  const emergency = tree.emergencyDetector;
  Object.keys(emergency).forEach((bucket) => {
    emergency[bucket].phrases.forEach((p) => list.push({ detector: 'emergencyDetector', bucket, phrase: p }));
  });
  const abuse = tree.abuseNeglectDetector;
  Object.keys(abuse).forEach((cat) => {
    Object.keys(abuse[cat]).forEach((bucket) => {
      const arr = abuse[cat][bucket];
      (Array.isArray(arr) ? arr : []).forEach((p) =>
        list.push({ detector: 'abuseNeglectDetector', category: cat, bucket, phrase: p })
      );
    });
  });
  const fin = tree.financialExploitationDetector;
  Object.keys(fin).forEach((bucket) => {
    (fin[bucket] || []).forEach((p) => list.push({ detector: 'financialExploitationDetector', bucket, phrase: p }));
  });
  const rel = tree.relationshipPatternDetector;
  Object.keys(rel).forEach((bucket) => {
    (rel[bucket] || []).forEach((p) => list.push({ detector: 'relationshipPatternDetector', bucket, phrase: p }));
  });
  return list;
}

function countUniquePhrasesInTree(tree) {
  const seen = new Set();
  flattenListFromTree(tree).forEach((x) => seen.add(x.phrase));
  return seen.size;
}

const flattenPhraseList = () => flattenListFromTree(ANCHOR_TREE);
const countUniquePhrases = () => countUniquePhrasesInTree(ANCHOR_TREE);

module.exports = {
  ANCHOR_TREE,
  ANCHOR_TREE_EN,
  I18N_ANCHORS,
  SUPPORTED_ANCHOR_LANGUAGES,
  flattenListFromTree,
  countUniquePhrasesInTree,
  flattenPhraseList,
  countUniquePhrases,
};
