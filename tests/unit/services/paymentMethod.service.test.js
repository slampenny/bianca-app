const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Org, PaymentMethod } = require('../../../src/models');
const paymentMethodService = require('../../../src/services/paymentMethod.service');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');

// Mock the Stripe module completely to avoid real API calls
jest.mock('../../../src/config/stripe', () => ({
  paymentMethods: {
    attach: jest.fn().mockImplementation((pmId) =>
      Promise.resolve({
        id: pmId,
        customer: 'cus_test123',
      })
    ),
    retrieve: jest.fn().mockImplementation((pmId) =>
      Promise.resolve({
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
      })
    ),
    update: jest.fn().mockImplementation((pmId) =>
      Promise.resolve({
        id: pmId,
        billing_details: {
          name: 'Updated Name',
          email: 'updated@example.com',
        },
      })
    ),
    detach: jest.fn().mockImplementation((pmId) => Promise.resolve({ id: pmId })),
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
}));

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('paymentMethodService', () => {
  beforeEach(async () => {
    // Clear mocks and database
    jest.clearAllMocks();
    await PaymentMethod.deleteMany({});
    await Org.deleteMany({});
  });

  describe('Payment Method functions', () => {
    it('should attach a payment method to an organization', async () => {
      const [org] = await insertOrgs([orgOne]);

      // Set a Stripe customer ID on the org
      org.stripeCustomerId = 'cus_test123';
      await org.save();

      // Use a unique payment method ID for this test
      const paymentMethodId = `pm_test_attach_${Date.now()}`;

      // Test attaching a payment method
      const paymentMethod = await paymentMethodService.attachPaymentMethod(org.id, paymentMethodId);

      // Validate the result
      expect(paymentMethod).toBeDefined();
      expect(paymentMethod.stripePaymentMethodId).toBe(paymentMethodId);

      // Verify Stripe API was called correctly
      const stripe = require('../../../src/config/stripe');
      expect(stripe.paymentMethods.attach).toHaveBeenCalledWith(paymentMethodId, {
        customer: 'cus_test123',
      });

      // Verify org was updated with payment method reference
      const updatedOrg = await Org.findById(org.id);
      expect(updatedOrg.paymentMethods.map((id) => id.toString())).toContain(paymentMethod.id);
    });

    it('should get a payment method', async () => {
      const [org] = await insertOrgs([orgOne]);
      org.stripeCustomerId = 'cus_test123';
      await org.save();

      // Use a unique payment method ID for this test
      const paymentMethodId = `pm_test_get_${Date.now()}`;

      // Attach a payment method first
      const createdMethod = await paymentMethodService.attachPaymentMethod(org.id, paymentMethodId);

      // Now test getting it
      const paymentMethod = await paymentMethodService.getPaymentMethod(createdMethod.id);

      // Validate
      expect(paymentMethod).toBeDefined();
      expect(paymentMethod.stripePaymentMethodId).toBe(paymentMethodId);
    });

    it('should update payment method billing details', async () => {
      const [org] = await insertOrgs([orgOne]);
      org.stripeCustomerId = 'cus_test123';
      await org.save();

      // Use a unique payment method ID for this test
      const paymentMethodId = `pm_test_update_${Date.now()}`;

      // Attach a payment method first
      const createdMethod = await paymentMethodService.attachPaymentMethod(org.id, paymentMethodId);

      // Update the billing details
      const updateBody = {
        billingDetails: {
          name: 'Updated Name',
          email: 'updated@example.com',
        },
      };

      const updatedMethod = await paymentMethodService.updatePaymentMethod(createdMethod.id, updateBody);

      // Validate
      expect(updatedMethod).toBeDefined();
      expect(updatedMethod.billingDetails.name).toBe('Updated Name');
      expect(updatedMethod.billingDetails.email).toBe('updated@example.com');

      // Verify Stripe API was called correctly
      const stripe = require('../../../src/config/stripe');
      expect(stripe.paymentMethods.update).toHaveBeenCalled();
    });

    it('should set a payment method as default', async () => {
      const [org] = await insertOrgs([orgOne]);
      org.stripeCustomerId = 'cus_test123';
      await org.save();

      // Use a unique payment method ID for this test
      const paymentMethodId = `pm_test_default_${Date.now()}`;

      // Attach a payment method first
      const createdMethod = await paymentMethodService.attachPaymentMethod(org.id, paymentMethodId);

      // Set as default
      const defaultMethod = await paymentMethodService.setDefaultPaymentMethod(org.id, createdMethod.id);

      // Validate
      expect(defaultMethod).toBeDefined();
      expect(defaultMethod.isDefault).toBe(true);

      // Verify Stripe API was called correctly
      const stripe = require('../../../src/config/stripe');
      expect(stripe.customers.update).toHaveBeenCalledWith('cus_test123', {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    });

    it('should detach a payment method', async () => {
      const [org] = await insertOrgs([orgOne]);
      org.stripeCustomerId = 'cus_test123';
      await org.save();

      // Use unique payment method IDs for this test
      const paymentMethodId1 = `pm_test_detach1_${Date.now()}`;
      const paymentMethodId2 = `pm_test_detach2_${Date.now()}`;

      // Attach the first payment method (will be default)
      const method1 = await paymentMethodService.attachPaymentMethod(org.id, paymentMethodId1);

      // Attach the second payment method
      const method2 = await paymentMethodService.attachPaymentMethod(org.id, paymentMethodId2);

      // Make the first one default (it should already be, but to be safe)
      await paymentMethodService.setDefaultPaymentMethod(org.id, method1.id);

      // Now detach the second one
      await paymentMethodService.detachPaymentMethod(org.id, method2.id);

      // Verify Stripe API was called correctly
      const stripe = require('../../../src/config/stripe');
      expect(stripe.paymentMethods.detach).toHaveBeenCalledWith(paymentMethodId2);

      // Verify org was updated
      const updatedOrg = await Org.findById(org.id);
      const paymentMethodIds = updatedOrg.paymentMethods.map((id) => id.toString());
      expect(paymentMethodIds).toContain(method1.id);
      expect(paymentMethodIds).not.toContain(method2.id);
    });
  });
});
