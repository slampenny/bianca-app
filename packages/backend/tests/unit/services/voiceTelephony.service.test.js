jest.mock('../../../src/config/config', () => ({
  telephony: {
    provider: 'twilio',
    apiUrl: 'https://api.example.com',
    webhookPathPrefix: '/v1/telephony',
  },
  twilio: {
    apiUrl: 'https://api.example.com',
    phone: '+15551234567',
  },
  env: 'test',
  primaryDomain: 'example.com',
  asterisk: { externalPort: 5061, sipUserName: 'bianca' },
  billing: { minimumBillableDuration: 30, ratePerMinute: 0.05 },
}));

jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockTwilioProvider = {
  initiateCall: jest.fn(),
  hangupCall: jest.fn(),
  handleCallStatus: jest.fn(),
  generateAnswerMarkup: jest.fn().mockReturnValue('<Response/>'),
  generateTestSipMarkup: jest.fn().mockReturnValue('<Response><Dial/></Response>'),
  getAnswerMarkupContentType: jest.fn().mockReturnValue('text/xml'),
  sendStatusWebhookAck: jest.fn(),
  scheduleRetryCall: jest.fn(),
  calculateCallCost: jest.fn().mockReturnValue(1.5),
};

jest.mock('../../../src/services/telephony/providers/twilio.voice.provider', () => {
  return jest.fn().mockImplementation(() => mockTwilioProvider);
});

describe('voiceTelephony.service facade', () => {
  let voiceTelephonyService;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    voiceTelephonyService = require('../../../src/services/telephony/voiceTelephony.service');
    voiceTelephonyService.clearImplementationCache();
  });

  it('exposes active provider id', () => {
    expect(voiceTelephonyService.providerId).toBe('twilio');
  });

  it('delegates initiateCall to the active provider', async () => {
    mockTwilioProvider.initiateCall.mockResolvedValue('CA123');
    await expect(voiceTelephonyService.initiateCall('client-id')).resolves.toBe('CA123');
    expect(mockTwilioProvider.initiateCall).toHaveBeenCalledWith('client-id', undefined);
  });

  it('delegates generateAnswerMarkup and deprecated generateCallTwiML alias', () => {
    const req = { body: { CallSid: 'CA123' }, params: { clientId: 'abc' } };
    expect(voiceTelephonyService.generateAnswerMarkup(req)).toBe('<Response/>');
    expect(voiceTelephonyService.generateCallTwiML(req)).toBe('<Response/>');
    expect(mockTwilioProvider.generateAnswerMarkup).toHaveBeenCalledTimes(2);
  });

  it('delegates webhook response helpers to the provider', () => {
    const res = { type: jest.fn().mockReturnThis(), send: jest.fn() };
    voiceTelephonyService.sendStatusWebhookAck(res);
    expect(mockTwilioProvider.sendStatusWebhookAck).toHaveBeenCalledWith(res);
    expect(voiceTelephonyService.getAnswerMarkupContentType()).toBe('text/xml');
  });
});

describe('telephony.webhooks', () => {
  it('builds provider-agnostic webhook URLs from telephony config', () => {
    const {
      getStartCallWebhookUrl,
      getCallStatusWebhookUrl,
    } = require('../../../src/services/telephony/telephony.webhooks');

    expect(getStartCallWebhookUrl('client-123')).toBe(
      'https://api.example.com/v1/telephony/start-call/client-123'
    );
    expect(getCallStatusWebhookUrl()).toBe('https://api.example.com/v1/telephony/call-status');
  });
});
