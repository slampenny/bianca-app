const {
  normalizeTelnyxStatusWebhook,
  extractTexmlRequestFields,
  mapHangupCauseToStatus,
} = require('../../../src/services/telephony/telnyx.webhook');
const { buildAnswerMarkup, isVoicemailAnsweredBy } = require('../../../src/services/telephony/answerMarkup.builder');
const { buildSipUri } = require('../../../src/services/telephony/sipEndpoint');

describe('telnyx.webhook', () => {
  it('normalizes call.hangup to completed with duration', () => {
    const body = {
      data: {
        event_type: 'call.hangup',
        payload: {
          call_control_id: 'v3:test-call-id',
          hangup_cause: 'normal_clearing',
          start_time: '2025-01-01T00:00:00.000Z',
          end_time: '2025-01-01T00:01:30.000Z',
        },
      },
    };

    const normalized = normalizeTelnyxStatusWebhook(body);
    expect(normalized).toEqual({
      callSid: 'v3:test-call-id',
      callStatus: 'completed',
      callDuration: 90,
      answeredBy: null,
    });
  });

  it('normalizes machine detection to answeredBy machine', () => {
    const body = {
      data: {
        event_type: 'call.machine.detection.ended',
        payload: {
          call_control_id: 'v3:amd-call',
          result: 'machine',
        },
      },
    };

    const normalized = normalizeTelnyxStatusWebhook(body);
    expect(normalized.callSid).toBe('v3:amd-call');
    expect(normalized.answeredBy).toBe('machine_end_beep');
    expect(normalized.callStatus).toBeNull();
  });

  it('maps busy hangup cause', () => {
    expect(mapHangupCauseToStatus('user_busy')).toBe('busy');
    expect(mapHangupCauseToStatus('no_answer')).toBe('no-answer');
  });

  it('extracts TeXML request fields from body or query', () => {
    const req = {
      body: { call_control_id: 'v3:from-body', AnsweredBy: 'human' },
      query: {},
      params: { clientId: 'abc' },
    };
    expect(extractTexmlRequestFields(req).callSid).toBe('v3:from-body');
  });
});

describe('answerMarkup.builder', () => {
  it('builds SIP dial markup for human answer', () => {
    const xml = buildAnswerMarkup({
      callSid: 'CA123',
      clientId: 'client-1',
      callerId: '+15551234567',
    });
    expect(xml).toContain('<Dial');
    expect(xml).toContain('callSid=CA123');
    expect(xml).toContain('clientId=client-1');
    expect(isVoicemailAnsweredBy('machine_end_beep')).toBe(true);
  });

  it('builds voicemail hangup markup', () => {
    const xml = buildAnswerMarkup({
      callSid: 'CA123',
      clientId: 'client-1',
      answeredBy: 'machine_end_beep',
      callerId: '+15551234567',
    });
    expect(xml).toContain('<Hangup/>');
    expect(xml).not.toContain('<Dial');
  });
});

describe('sipEndpoint', () => {
  it('builds SIP URI with callSid and clientId', () => {
    const uri = buildSipUri({ callSid: 'CA123', clientId: 'client-1' });
    expect(uri).toContain('callSid=CA123');
    expect(uri).toContain('clientId=client-1');
    expect(uri).toContain('transport=tcp');
  });
});
