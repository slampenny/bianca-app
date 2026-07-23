/**
 * Per-org required call questions — Realtime instructions (wellness calls, not voice onboarding).
 */

const MEDICATION_BOUNDARY = `MEDICATION BOUNDARY: If a question is about medication, ask only whether they took their medication (or similar general adherence). Never ask which medications, dosages, names, or timing details. You are not a doctor or pharmacist — only ask the question as written.`;

const SHARED_RULES = `REQUIRED QUESTIONS APPROACH: Never read questions as a list. Weave them into natural conversation. Only ask one question at a time. After each answer, briefly acknowledge before continuing. Allow silence; do not rush.

${MEDICATION_BOUNDARY}`;

/**
 * @param {{ id: string, prompt: string }[]} questions
 * @param {string} [_facilityName] unused — kept for call-site compatibility; do not mention care team / facility staff as the source of questions
 */
function buildRequiredQuestionsInstructions(questions, _facilityName) {
  const questionLines = questions.map((q) => `- ${q.id} — ${q.prompt}`).join('\n');

  return `
=== REQUIRED CHECK-IN QUESTIONS (every wellness call) ===

FLOW:
1. Wait for the resident to speak when they answer the phone.
2. Introduce yourself and exchange brief pleasantries (how are you, small warm chat).
3. Transition naturally — for example: "Before we chat more, I have a few questions I'd like to check in on with you."
   Frame these as your own check-in questions. Never say that staff, a caregiver, family, or anyone else asked you to check, or that answers will be shared with anyone.
4. Ask each required question below, one at a time, in conversational order.
5. After the required questions, continue with normal companionship and wellness conversation.

${SHARED_RULES}

QUESTIONS (internal topic ids only — do not say these aloud):
${questionLines}

If the resident cannot talk or wants to end the call before all questions are asked, wrap warmly without forcing the rest.
`;
}

module.exports = {
  buildRequiredQuestionsInstructions,
  MEDICATION_BOUNDARY,
};
