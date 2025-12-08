// Centralized Stripe mock
const mockStripe = jest.fn().mockImplementation(() => ({
  paymentMethods: {
    attach: jest.fn().mockImplementation((pmId) => Promise.resolve({
      id: pmId,
      customer: 'cus_test123',
      type: 'card',
      card: {
        brand: 'visa',
        last4: '4242',
        exp_month: 12,
        exp_year: 2025,
      },
      billing_details: {
        name: 'Test User',
        email: 'test@example.com',
      },
    })),
    retrieve: jest.fn().mockImplementation((pmId) => Promise.resolve({
      id: pmId,
      type: 'card',
      card: {
        brand: 'visa',
        last4: '4242',
        exp_month: 12,
        exp_year: 2025,
      },
      billing_details: {
        name: 'Test User',
        email: 'test@example.com',
      },
    })),
    update: jest.fn().mockImplementation((pmId, data) => Promise.resolve({
      id: pmId,
      billing_details: data.billing_details || {
        name: 'Updated Name',
        email: 'updated@example.com',
      },
    })),
    detach: jest.fn().mockImplementation((pmId) => Promise.resolve({
      id: pmId,
      deleted: true,
    })),
    create: jest.fn().mockResolvedValue({
      id: 'pm_test_123',
      type: 'card',
    }),
  },
  customers: {
    create: jest.fn().mockResolvedValue({
      id: 'cus_test123',
      name: 'Test Org',
    }),
    update: jest.fn().mockResolvedValue({
      id: 'cus_test123',
      invoice_settings: {
        default_payment_method: 'pm_test123',
      },
    }),
    retrieve: jest.fn().mockResolvedValue({
      id: 'cus_test123',
      invoice_settings: {
        default_payment_method: 'pm_test123',
      },
    }),
  },
  // Add test helpers for development/test environments
  getTestCards: jest.fn(() => ({
    visa: {
      number: '4242424242424242',
      exp_month: 12,
      exp_year: new Date().getFullYear() + 1,
      cvc: '123',
    },
  })),
  createTestPaymentMethod: jest.fn().mockResolvedValue({
    id: 'pm_test_123',
    type: 'card',
  }),
}));

module.exports = mockStripe;
