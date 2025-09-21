const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Org, PaymentMethod } = require('../../../src/models');
const paymentMethodService = require('../../../src/services/paymentMethod.service');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { paymentMethodOne, paymentMethodTwo, insertPaymentMethods } = require('../../fixtures/paymentMethod.fixture');

// Mock Stripe SDK (external dependency)
jest.mock('stripe');

let mongoServer;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  const mongoUri = await mongoServer.getUri();
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('paymentMethodService', () => {
  afterEach(async () => {
    jest.clearAllMocks();
    await Org.deleteMany();
    await PaymentMethod.deleteMany();
  });

  describe('createPaymentMethod', () => {
    it('should create a payment method successfully', async () => {
      const [org] = await insertOrgs([orgOne]);
      const stripePaymentMethodId = 'pm_test_1234567890';

      const result = await paymentMethodService.createPaymentMethod(org._id, stripePaymentMethodId);

      expect(result).toBeDefined();
      expect(result.stripePaymentMethodId).toBe(stripePaymentMethodId);
      expect(result.org.toString()).toBe(org._id.toString());
      expect(result.isDefault).toBe(true); // First payment method should be default
      expect(result.type).toBe('card');
      expect(result.brand).toBe('visa');
      expect(result.last4).toBe('4242');
    });

    it('should throw error when organization does not exist', async () => {
      const nonExistentOrgId = new mongoose.Types.ObjectId();
      const stripePaymentMethodId = 'pm_test_1234567890';

      await expect(paymentMethodService.createPaymentMethod(nonExistentOrgId, stripePaymentMethodId))
        .rejects.toThrow('Organization not found');
    });

    it('should handle Stripe API errors', async () => {
      const [org] = await insertOrgs([orgOne]);
      const stripePaymentMethodId = 'pm_test_1234567890';

      // Mock Stripe to throw an error
      const stripe = require('../../../src/config/stripe');
      stripe.paymentMethods.retrieve.mockRejectedValueOnce(new Error('Stripe API error'));

      await expect(paymentMethodService.createPaymentMethod(org._id, stripePaymentMethodId))
        .rejects.toThrow('Error creating payment method');
    });

    it('should set as default if it is the first payment method', async () => {
      const [org] = await insertOrgs([orgOne]);
      const stripePaymentMethodId = 'pm_test_1234567890';

      const result = await paymentMethodService.createPaymentMethod(org._id, stripePaymentMethodId);

      expect(result.isDefault).toBe(true);
    });

    it('should not set as default if other payment methods exist', async () => {
      const [org] = await insertOrgs([orgOne]);
      
      // Create first payment method
      const firstPaymentMethod = await insertPaymentMethods(org, [paymentMethodOne]);
      
      // Create second payment method
      const stripePaymentMethodId = 'pm_test_1234567890';
      const result = await paymentMethodService.createPaymentMethod(org._id, stripePaymentMethodId);

      expect(result.isDefault).toBe(false);
    });
  });

  describe('getPaymentMethodsByOrg', () => {
    it('should return all payment methods for an organization', async () => {
      const [org] = await insertOrgs([orgOne]);
      await insertPaymentMethods(org, [paymentMethodOne, paymentMethodTwo]);

      const result = await paymentMethodService.getPaymentMethodsByOrg(org._id);

      expect(result).toHaveLength(2);
      expect(result[0].org.toString()).toBe(org._id.toString());
      expect(result[1].org.toString()).toBe(org._id.toString());
    });

    it('should return empty array for organization with no payment methods', async () => {
      const [org] = await insertOrgs([orgOne]);

      const result = await paymentMethodService.getPaymentMethodsByOrg(org._id);

      expect(result).toHaveLength(0);
    });

    it('should return empty array for non-existent organization', async () => {
      const nonExistentOrgId = new mongoose.Types.ObjectId();

      const result = await paymentMethodService.getPaymentMethodsByOrg(nonExistentOrgId);

      expect(result).toHaveLength(0);
    });
  });

  describe('getPaymentMethodById', () => {
    it('should return payment method by ID', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [paymentMethod] = await insertPaymentMethods(org, [paymentMethodOne]);

      const result = await paymentMethodService.getPaymentMethodById(paymentMethod._id);

      expect(result).toBeDefined();
      expect(result._id.toString()).toBe(paymentMethod._id.toString());
      expect(result.stripePaymentMethodId).toBe(paymentMethod.stripePaymentMethodId);
    });

    it('should throw error when payment method does not exist', async () => {
      const nonExistentPaymentMethodId = new mongoose.Types.ObjectId();

      await expect(paymentMethodService.getPaymentMethodById(nonExistentPaymentMethodId))
        .rejects.toThrow('Payment method not found');
    });
  });

  describe('updatePaymentMethod', () => {
    it('should update payment method successfully', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [paymentMethod] = await insertPaymentMethods(org, [paymentMethodOne]);

      const updateData = {
        billingDetails: {
          name: 'Updated Name',
          email: 'updated@example.com',
        },
      };

      const result = await paymentMethodService.updatePaymentMethod(paymentMethod._id, updateData);

      expect(result).toBeDefined();
      expect(result.billingDetails.name).toBe('Updated Name');
      expect(result.billingDetails.email).toBe('updated@example.com');
    });

    it('should throw error when payment method does not exist', async () => {
      const nonExistentPaymentMethodId = new mongoose.Types.ObjectId();
      const updateData = { billingDetails: { name: 'Updated Name' } };

      await expect(paymentMethodService.updatePaymentMethod(nonExistentPaymentMethodId, updateData))
        .rejects.toThrow('Payment method not found');
    });

    it('should handle Stripe API errors during update', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [paymentMethod] = await insertPaymentMethods(org, [paymentMethodOne]);

      const updateData = { billingDetails: { name: 'Updated Name' } };

      // Mock Stripe to throw an error
      const stripe = require('../../../src/config/stripe');
      stripe.paymentMethods.update.mockRejectedValueOnce(new Error('Stripe API error'));

      await expect(paymentMethodService.updatePaymentMethod(paymentMethod._id, updateData))
        .rejects.toThrow('Error updating payment method');
    });
  });

  describe('deletePaymentMethod', () => {
    it('should delete payment method successfully', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [paymentMethod] = await insertPaymentMethods(org, [paymentMethodOne]);

      await paymentMethodService.deletePaymentMethod(paymentMethod._id);

      // Verify payment method is deleted
      const deletedPaymentMethod = await PaymentMethod.findById(paymentMethod._id);
      expect(deletedPaymentMethod).toBeNull();
    });

    it('should throw error when payment method does not exist', async () => {
      const nonExistentPaymentMethodId = new mongoose.Types.ObjectId();

      await expect(paymentMethodService.deletePaymentMethod(nonExistentPaymentMethodId))
        .rejects.toThrow('Payment method not found');
    });

    it('should handle Stripe API errors during deletion', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [paymentMethod] = await insertPaymentMethods(org, [paymentMethodOne]);

      // Mock Stripe to throw an error
      const stripe = require('../../../src/config/stripe');
      stripe.paymentMethods.detach.mockRejectedValueOnce(new Error('Stripe API error'));

      await expect(paymentMethodService.deletePaymentMethod(paymentMethod._id))
        .rejects.toThrow('Error deleting payment method');
    });

    it('should set another payment method as default when deleting the default one', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [paymentMethod1, paymentMethod2] = await insertPaymentMethods(org, [paymentMethodOne, paymentMethodTwo]);

      // Set first payment method as default
      paymentMethod1.isDefault = true;
      await paymentMethod1.save();

      // Delete the default payment method
      await paymentMethodService.deletePaymentMethod(paymentMethod1._id);

      // Verify second payment method is now default
      const updatedPaymentMethod2 = await PaymentMethod.findById(paymentMethod2._id);
      expect(updatedPaymentMethod2.isDefault).toBe(true);
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('should set payment method as default successfully', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [paymentMethod] = await insertPaymentMethods(org, [paymentMethodOne]);

      const result = await paymentMethodService.setDefaultPaymentMethod(org._id, paymentMethod._id);

      expect(result.isDefault).toBe(true);
    });

    it('should throw error when organization does not exist', async () => {
      const nonExistentOrgId = new mongoose.Types.ObjectId();
      const paymentMethodId = new mongoose.Types.ObjectId();

      await expect(paymentMethodService.setDefaultPaymentMethod(nonExistentOrgId, paymentMethodId))
        .rejects.toThrow('Organization not found');
    });

    it('should throw error when payment method does not exist', async () => {
      const [org] = await insertOrgs([orgOne]);
      const nonExistentPaymentMethodId = new mongoose.Types.ObjectId();

      await expect(paymentMethodService.setDefaultPaymentMethod(org._id, nonExistentPaymentMethodId))
        .rejects.toThrow('Payment method not found');
    });

    it('should throw error when payment method belongs to different organization', async () => {
      const [org1] = await insertOrgs([orgOne]);
      const [org2] = await insertOrgs([{ ...orgOne, email: 'org2@example.com' }]);
      const [paymentMethod] = await insertPaymentMethods(org1, [paymentMethodOne]);

      await expect(paymentMethodService.setDefaultPaymentMethod(org2._id, paymentMethod._id))
        .rejects.toThrow('Payment method not found');
    });

    it('should unset other payment methods as default when setting new default', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [paymentMethod1, paymentMethod2] = await insertPaymentMethods(org, [paymentMethodOne, paymentMethodTwo]);

      // Set first payment method as default
      paymentMethod1.isDefault = true;
      await paymentMethod1.save();

      // Set second payment method as default
      await paymentMethodService.setDefaultPaymentMethod(org._id, paymentMethod2._id);

      // Verify first payment method is no longer default
      const updatedPaymentMethod1 = await PaymentMethod.findById(paymentMethod1._id);
      expect(updatedPaymentMethod1.isDefault).toBe(false);

      // Verify second payment method is now default
      const updatedPaymentMethod2 = await PaymentMethod.findById(paymentMethod2._id);
      expect(updatedPaymentMethod2.isDefault).toBe(true);
    });

    it('should handle Stripe API errors during default setting', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [paymentMethod] = await insertPaymentMethods(org, [paymentMethodOne]);

      // Mock Stripe to throw an error
      const stripe = require('../../../src/config/stripe');
      stripe.customers.update.mockRejectedValueOnce(new Error('Stripe API error'));

      await expect(paymentMethodService.setDefaultPaymentMethod(org._id, paymentMethod._id))
        .rejects.toThrow('Error setting default payment method');
    });
  });

  describe('getDefaultPaymentMethod', () => {
    it('should return default payment method for organization', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [paymentMethod] = await insertPaymentMethods(org, [paymentMethodOne]);

      // Set as default
      paymentMethod.isDefault = true;
      await paymentMethod.save();

      const result = await paymentMethodService.getDefaultPaymentMethod(org._id);

      expect(result).toBeDefined();
      expect(result._id.toString()).toBe(paymentMethod._id.toString());
      expect(result.isDefault).toBe(true);
    });

    it('should return null when no default payment method exists', async () => {
      const [org] = await insertOrgs([orgOne]);
      await insertPaymentMethods(org, [paymentMethodOne]); // Not set as default

      const result = await paymentMethodService.getDefaultPaymentMethod(org._id);

      expect(result).toBeNull();
    });

    it('should return null for non-existent organization', async () => {
      const nonExistentOrgId = new mongoose.Types.ObjectId();

      const result = await paymentMethodService.getDefaultPaymentMethod(nonExistentOrgId);

      expect(result).toBeNull();
    });
  });

  describe('Payment method validation', () => {
    it('should validate card payment method data', async () => {
      const [org] = await insertOrgs([orgOne]);
      const stripePaymentMethodId = 'pm_test_1234567890';

      // Mock Stripe to return card data
      const stripe = require('../../../src/config/stripe');
      stripe.paymentMethods.retrieve.mockResolvedValueOnce({
        id: stripePaymentMethodId,
        type: 'card',
        card: {
          brand: 'mastercard',
          last4: '1234',
          exp_month: 6,
          exp_year: 2026,
        },
        billing_details: {
          name: 'Test User',
          email: 'test@example.com',
        },
      });

      const result = await paymentMethodService.createPaymentMethod(org._id, stripePaymentMethodId);

      expect(result.type).toBe('card');
      expect(result.brand).toBe('mastercard');
      expect(result.last4).toBe('1234');
      expect(result.expMonth).toBe(6);
      expect(result.expYear).toBe(2026);
    });

    it('should validate bank account payment method data', async () => {
      const [org] = await insertOrgs([orgOne]);
      const stripePaymentMethodId = 'pm_test_1234567890';

      // Mock Stripe to return bank account data
      const stripe = require('../../../src/config/stripe');
      stripe.paymentMethods.retrieve.mockResolvedValueOnce({
        id: stripePaymentMethodId,
        type: 'us_bank_account',
        us_bank_account: {
          bank_name: 'Test Bank',
          account_type: 'checking',
        },
        billing_details: {
          name: 'Test User',
          email: 'test@example.com',
        },
      });

      const result = await paymentMethodService.createPaymentMethod(org._id, stripePaymentMethodId);

      expect(result.type).toBe('us_bank_account');
      expect(result.bankName).toBe('Test Bank');
      expect(result.accountType).toBe('checking');
    });

    it('should handle unknown payment method types', async () => {
      const [org] = await insertOrgs([orgOne]);
      const stripePaymentMethodId = 'pm_test_1234567890';

      // Mock Stripe to return unknown type
      const stripe = require('../../../src/config/stripe');
      stripe.paymentMethods.retrieve.mockResolvedValueOnce({
        id: stripePaymentMethodId,
        type: 'unknown_type',
        billing_details: {
          name: 'Test User',
          email: 'test@example.com',
        },
      });

      const result = await paymentMethodService.createPaymentMethod(org._id, stripePaymentMethodId);

      expect(result.type).toBe('unknown_type');
      expect(result.brand).toBeUndefined();
      expect(result.bankName).toBeUndefined();
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle duplicate stripe payment method IDs', async () => {
      const [org] = await insertOrgs([orgOne]);
      const stripePaymentMethodId = 'pm_test_duplicate';

      // Create first payment method
      await paymentMethodService.createPaymentMethod(org._id, stripePaymentMethodId);

      // Try to create second payment method with same Stripe ID
      await expect(paymentMethodService.createPaymentMethod(org._id, stripePaymentMethodId))
        .rejects.toThrow();
    });

    it('should handle organization without Stripe customer ID', async () => {
      const [org] = await insertOrgs([orgOne]);
      // Remove Stripe customer ID
      org.stripeCustomerId = undefined;
      await org.save();

      const stripePaymentMethodId = 'pm_test_1234567890';

      // Service should create a Stripe customer and succeed
      const result = await paymentMethodService.createPaymentMethod(org._id, stripePaymentMethodId);
      
      expect(result).toBeDefined();
      expect(result.stripePaymentMethodId).toBe(stripePaymentMethodId);
      expect(result.org.toString()).toBe(org._id.toString());
      
      // Verify the org now has a Stripe customer ID
      const updatedOrg = await Org.findById(org._id);
      expect(updatedOrg.stripeCustomerId).toBeDefined();
    });

    it('should handle payment method with missing billing details', async () => {
      const [org] = await insertOrgs([orgOne]);
      const stripePaymentMethodId = 'pm_test_1234567890';

      // Mock Stripe to return payment method without billing details
      const stripe = require('../../../src/config/stripe');
      stripe.paymentMethods.retrieve.mockResolvedValueOnce({
        id: stripePaymentMethodId,
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
          exp_month: 12,
          exp_year: 2025,
        },
        // No billing_details
      });

      const result = await paymentMethodService.createPaymentMethod(org._id, stripePaymentMethodId);

      expect(result).toBeDefined();
      expect(result.billingDetails).toBeUndefined();
    });
  });
});
