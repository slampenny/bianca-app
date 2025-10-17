// Integration test setup utility
// This must be imported BEFORE any other modules to ensure proper mocking

// Mock external services that cause timeouts in integration tests
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

// Mock services that might try to connect to external APIs
jest.mock('../../src/services/email.service', () => ({
  sendResetPasswordEmail: jest.fn().mockResolvedValue(),
  sendVerificationEmail: jest.fn().mockResolvedValue(),
  isReady: jest.fn().mockReturnValue(true),
  getStatus: jest.fn().mockReturnValue('Mocked service')
}));

jest.mock('../../src/services/ari.client', () => ({
  getAriClientInstance: jest.fn().mockReturnValue({
    isConnected: false,
    connect: jest.fn().mockResolvedValue(),
    disconnect: jest.fn().mockResolvedValue()
  })
}));

// Mock other external services that might cause issues
jest.mock('../../src/services/sns.service', () => ({
  sendSMS: jest.fn().mockResolvedValue({ success: true }),
  isConfigured: jest.fn().mockReturnValue(false)
}));

// Removed mock of our own twilioCall.service - we want to test our service, just mock external Twilio library

// Mock OpenAI services
jest.mock('../../src/services/openai.realtime.service', () => ({
  getOpenAIRealtimeServiceInstance: jest.fn().mockReturnValue({
    initialize: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(),
    isConnectionReady: jest.fn().mockReturnValue(false)
  })
}));

jest.mock('../../src/services/openai.sentiment.service', () => ({
  getOpenAISentimentServiceInstance: jest.fn().mockReturnValue({
    analyzeConversationSentiment: jest.fn().mockResolvedValue({
      sentiment: 'positive',
      confidence: 0.8,
      reasoning: 'Mocked sentiment analysis'
    })
  })
}));

// Mock S3 service to prevent AWS connection attempts
jest.mock('../../src/services/s3.service', () => ({
  uploadFile: jest.fn().mockResolvedValue({
    ETag: '"mock-etag"',
    Location: 'https://mock-bucket.s3.amazonaws.com/mock-key'
  }),
  getPresignedUrl: jest.fn().mockResolvedValue('https://mock-presigned-url.com/file')
}));

// Mock LangChain API to prevent OpenAI API calls
jest.mock('../../src/api/langChainAPI', () => ({
  langChainAPI: {
    summarizeConversation: jest.fn().mockResolvedValue('Mocked conversation summary'),
    extractUserInformation: jest.fn().mockResolvedValue('Mocked user information'),
    processConversation: jest.fn().mockResolvedValue({
      summary: 'Mocked conversation summary',
      userInformation: 'Mocked user information',
      timestamp: new Date().toISOString()
    })
  }
}));

// Don't mock payment.service - we want to test our own business logic

// Mock AWS SDK S3 client directly
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ ETag: '"mock-etag"' })
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn()
}));

// Mock AWS S3 presigner
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-presigned-url.com/file')
}));

// Mock LangChain OpenAI to prevent API calls
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: 'Mocked LangChain response'
    })
  }))
}));

// Mock OpenAI sentiment service
jest.mock('../../src/services/openai.sentiment.service', () => ({
  getOpenAISentimentServiceInstance: jest.fn().mockReturnValue({
    analyzeConversationSentiment: jest.fn().mockResolvedValue({
      success: true,
      data: {
        overallSentiment: 'negative',
        sentimentScore: -0.5,
        confidence: 0.8,
        patientMood: 'anxious and concerned',
        keyEmotions: ['anxiety', 'concern'],
        concernLevel: 'medium',
        satisfactionIndicators: {
          positive: [],
          negative: ['expressed worry', 'mentioned anxiety']
        },
        summary: 'Patient shows negative sentiment with moderate confidence',
        recommendations: 'Consider additional support'
      }
    }),
    validateSentimentData: jest.fn().mockImplementation((data) => {
      const validSentiments = ['positive', 'negative', 'neutral'];
      const isValid = validSentiments.includes(data.overallSentiment) && 
                     data.sentimentScore >= -1 && data.sentimentScore <= 1 &&
                     data.confidence >= 0 && data.confidence <= 1;
      return {
        isValid,
        errors: isValid ? [] : ['Invalid sentiment data']
      };
    })
  })
}));

// Mock Stripe configuration and client with unique IDs
let mockPaymentMethodCounter = 0;
let mockCustomerCounter = 0;

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
    })
  }
}));

// Don't mock paymentMethod.service - we want to test our own business logic

// Mock network utilities to prevent external IP lookups
jest.mock('../../src/utils/network.utils', () => ({
  getNetworkIPs: jest.fn().mockResolvedValue({
    publicIp: '127.0.0.1',
    privateIp: '127.0.0.1'
  })
}));

// Don't mock our own business logic services - only mock infrastructure/external dependencies
// Mock infrastructure services that connect to external systems or cause timeouts
jest.mock('../../src/services/rtp.sender.service', () => ({
  startRTPSender: jest.fn().mockResolvedValue(),
  stopRTPSender: jest.fn().mockResolvedValue(),
  sendAudio: jest.fn().mockResolvedValue()
}));

jest.mock('../../src/services/rtp.listener.service', () => ({
  startRTPListener: jest.fn().mockResolvedValue(),
  stopRTPListener: jest.fn().mockResolvedValue()
}));

jest.mock('../../src/services/channel.tracker', () => ({
  trackChannel: jest.fn().mockResolvedValue(),
  untrackChannel: jest.fn().mockResolvedValue(),
  getChannelStatus: jest.fn().mockReturnValue('active'),
  initialize: jest.fn().mockResolvedValue()
}));

jest.mock('../../src/services/port.manager.service', () => ({
  allocatePort: jest.fn().mockResolvedValue(20000),
  releasePort: jest.fn().mockResolvedValue(),
  getAvailablePorts: jest.fn().mockReturnValue([20000, 20001, 20002]),
  initialize: jest.fn().mockResolvedValue(),
  destroy: jest.fn().mockResolvedValue()
}));

jest.mock('../../src/services/audio.diagnostic.service', () => ({
  diagnoseAudio: jest.fn().mockResolvedValue({
    status: 'healthy'
  })
}));

// Mock external Twilio library (not our service)
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
    }
  }));
  
  // Add twiml as a property of the constructor function
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

// Don't mock emergencyProcessor - integration tests need the real implementation
// jest.mock('../../src/services/emergencyProcessor.service', () => ({
//   processEmergency: jest.fn().mockResolvedValue({
//     processed: true
//   }),
//   initialize: jest.fn().mockResolvedValue()
// }));

// Set required environment variables for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';
process.env.TWILIO_ACCOUNTSID = process.env.TWILIO_ACCOUNTSID || 'test-twilio-account-sid';
process.env.TWILIO_AUTHTOKEN = process.env.TWILIO_AUTHTOKEN || 'test-twilio-auth-token';

module.exports = {
  // This file is imported for its side effects (mocking)
  // No exports needed
};
