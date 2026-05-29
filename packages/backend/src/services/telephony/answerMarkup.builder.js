const { buildSipUri } = require('./sipEndpoint');

const VOICEMAIL_ANSWERED_BY = new Set([
  'machine_start',
  'machine_end',
  'machine_end_beep',
  'machine_end_silence',
  'machine',
]);

function isVoicemailAnsweredBy(answeredBy) {
  return answeredBy && VOICEMAIL_ANSWERED_BY.has(answeredBy);
}

/**
 * Build TeXML/TwiML-compatible XML for answer or test SIP dial.
 * @param {object} options
 * @param {string} options.callSid
 * @param {string} options.clientId
 * @param {string|null} [options.answeredBy]
 * @param {string} options.callerId
 * @param {boolean} [options.recordCalls]
 * @param {number} [options.dialTimeout]
 * @param {string} [options.testIntroSay]
 */
function buildAnswerMarkup({
  callSid,
  clientId,
  answeredBy = null,
  callerId,
  recordCalls = false,
  dialTimeout = 20,
  testIntroSay = null,
}) {
  if (isVoicemailAnsweredBy(answeredBy)) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">Hello, this is a wellness check from your care team. We're calling to check on you. Please call us back at your convenience. Thank you and have a good day.</Say>
  <Hangup/>
</Response>`;
  }

  const sipUri = buildSipUri({ callSid, clientId });
  const recordAttr = recordCalls ? ' record="record-from-answer"' : '';
  const intro = testIntroSay
    ? `<Say>${escapeXml(testIntroSay)}</Say>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${intro}
  <Dial callerId="${escapeXml(callerId)}" timeout="${dialTimeout}" timeLimit="1800"${recordAttr}>
    <Sip>${escapeXml(sipUri)}</Sip>
  </Dial>
</Response>`;
}

function buildErrorMarkup() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">I'm sorry, we're experiencing technical difficulties. Please try again later.</Say>
  <Hangup/>
</Response>`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  VOICEMAIL_ANSWERED_BY,
  isVoicemailAnsweredBy,
  buildAnswerMarkup,
  buildErrorMarkup,
};
