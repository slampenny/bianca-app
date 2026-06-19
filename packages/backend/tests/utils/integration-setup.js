// Integration test setup utility
// This must be imported BEFORE any other modules to ensure proper mocking

// Mock external job scheduler (npm package)
jest.mock('agenda', () => {
  return jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(),
    stop: jest.fn().mockResolvedValue(),
    define: jest.fn(),
    schedule: jest.fn(),
    every: jest.fn(),
    now: jest.fn(),
    jobs: jest.fn().mockReturnValue([]),
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
    remove: jest.fn(),
    cancel: jest.fn(),
    purge: jest.fn(),
    close: jest.fn()
  }));
});

// Mock OpenAI SDK (external npm package) — real sentiment/required-questions services use openaiSdk
jest.mock('openai', () => {
  const mockConstructor = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                overallSentiment: 'neutral',
                sentimentScore: 0,
                confidence: 0.8,
                clientMood: 'calm',
                keyEmotions: [],
                concernLevel: 'low',
                satisfactionIndicators: { positive: [], negative: [] },
                summary: 'Mocked sentiment for integration tests',
                recommendations: ''
              })
            }
          }]
        })
      }
    },
    embeddings: {
      create: jest.fn().mockResolvedValue({ data: [{ embedding: [1, 0, 0] }] })
    }
  }));
  return {
    __esModule: true,
    default: mockConstructor,
    OpenAI: mockConstructor,
  };
});

// Mock Asterisk ARI client (external npm package)
jest.mock('ari-client', () => jest.fn().mockResolvedValue({
  on: jest.fn(),
  once: jest.fn(),
  start: jest.fn().mockResolvedValue(),
  stop: jest.fn().mockResolvedValue(),
}));

// Mock AWS SDK S3 client (external)
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ ETag: '"mock-etag"' })
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn()
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-presigned-url.com/file')
}));

// Mock LangChain OpenAI (external npm package)
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: 'Mocked LangChain response'
    })
  }))
}));

// Mock Stripe client (external API boundary via config module)
let mockPaymentMethodCounter = 0;
let mockCustomerCounter = 0;

const defaultStripeSubscription = () => ({
  id: 'sub_test123',
  items: { data: [{ id: 'si_test123' }] },
  current_period_start: Math.floor(Date.now() / 1000) - 86400 * 7,
  current_period_end: Math.floor(Date.now() / 1000) + 86400 * 23,
});

jest.mock('../../src/config/stripe', () => ({
  customers: {
    create: jest.fn().mockImplementation(() => {
      mockCustomerCounter++;
      return Promise.resolve({
        id: `cus_mock_customer_${mockCustomerCounter}`,
        name: 'Mock Customer'
      });
    }),
    retrieve: jest.fn().mockResolvedValue({
      id: 'cus_mock_customer_id',
      name: 'Mock Customer'
    }),
    update: jest.fn().mockResolvedValue({
      id: 'cus_mock_customer_id',
      name: 'Mock Customer'
    })
  },
  paymentMethods: {
    attach: jest.fn().mockResolvedValue({}),
    retrieve: jest.fn().mockImplementation(() => {
      mockPaymentMethodCounter++;
      return Promise.resolve({
        id: `pm_mock_payment_method_${mockPaymentMethodCounter}`,
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242'
        }
      });
    }),
    list: jest.fn().mockResolvedValue({
      data: []
    }),
    detach: jest.fn().mockResolvedValue({
      id: 'pm_mock_payment_method_detached'
    })
  },
  invoices: {
    create: jest.fn().mockResolvedValue({
      id: 'in_mock_invoice_id'
    }),
    retrieve: jest.fn().mockResolvedValue({
      id: 'in_mock_invoice_id',
      status: 'paid',
      amount_paid: 0,
      created: Math.floor(Date.now() / 1000),
      due_date: null,
      number: 'INV-000001',
      lines: { data: [] },
      subscription: 'sub_test123',
      status_transitions: {},
    }),
    list: jest.fn().mockResolvedValue({ data: [] }),
  },
  subscriptions: {
    retrieve: jest.fn().mockImplementation(() => Promise.resolve(defaultStripeSubscription())),
    create: jest.fn().mockImplementation(() => Promise.resolve(defaultStripeSubscription())),
  },
  subscriptionItems: {
    listUsageRecordSummaries: jest.fn().mockResolvedValue({ data: [] }),
  },
  billing: {
    meters: {
      list: jest.fn().mockResolvedValue({
        data: [{ id: 'meter_test123', event_name: 'api_requests' }],
      }),
      create: jest.fn().mockResolvedValue({ id: 'meter_test123', event_name: 'api_requests' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'meter_test123', event_name: 'api_requests' }),
    },
    meterEvents: {
      create: jest.fn().mockResolvedValue({ id: 'meter_event_test' }),
    },
  },
}));

// Mock external Twilio library (not our twilioCall / twilioSms services)
jest.mock('twilio', () => {
  const mockTwilio = jest.fn(() => ({
    calls: {
      create: jest.fn().mockResolvedValue({
        sid: 'mock-call-sid-12345',
        status: 'queued'
      }),
      list: jest.fn().mockResolvedValue([]),
      get: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue({
          sid: 'mock-call-sid-12345',
          status: 'completed',
          duration: 120
        })
      })
    },
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'test-sms-sid-123',
        status: 'queued',
      }),
    },
    api: {
      v2010: {
        accounts: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue({ sid: 'test-twilio-account-sid' }),
        }),
      },
    },
  }));

  mockTwilio.twiml = {
    VoiceResponse: jest.fn().mockImplementation(() => ({
      say: jest.fn().mockReturnThis(),
      play: jest.fn().mockReturnThis(),
      gather: jest.fn().mockReturnThis(),
      hangup: jest.fn().mockReturnThis(),
      toString: jest.fn().mockReturnValue('<Response><Say>Hello</Say></Response>')
    }))
  };

  return mockTwilio;
});

// Set required environment variables for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';
process.env.TWILIO_ACCOUNTSID = process.env.TWILIO_ACCOUNTSID || 'test-twilio-account-sid';
process.env.TWILIO_AUTHTOKEN = process.env.TWILIO_AUTHTOKEN || 'test-twilio-auth-token';
process.env.TWILIO_PHONENUMBER = process.env.TWILIO_PHONENUMBER || '+15551234567';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-api-key';

module.exports = {};
