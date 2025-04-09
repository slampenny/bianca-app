// app/services/api/__tests__/paymentMethodApi.test.ts
import { EnhancedStore } from '@reduxjs/toolkit';
import { paymentMethodApi, orgApi } from '../';
import { store as appStore, RootState } from '../../../store/store';
import { registerNewOrgAndCaregiver } from '../../../../test/helpers';
import { newCaregiver } from '../../../../test/fixtures/caregiver.fixture';
import { Org, PaymentMethod } from '../api.types';

describe('paymentMethodApi', () => {
  let store: EnhancedStore<RootState>;
  let org: Org;
  let orgId: string;

  beforeEach(async () => {
    store = appStore;
    const testCaregiver = newCaregiver();
    // Create new org and caregiver via helper.
    const response = await registerNewOrgAndCaregiver(
      testCaregiver.name,
      testCaregiver.email,
      testCaregiver.password,
      testCaregiver.phone
    );
    org = response.org;
    orgId = org.id as string;
    console.log(`caregiver role: ${response.caregiver.role}`);
    console.log('Initial Org:', org);
  });

  afterEach(async () => {
    await orgApi.endpoints.deleteOrg.initiate({ orgId })(store.dispatch, store.getState, {});
    jest.clearAllMocks();
  });

  // --- Attach Payment Method Test ---
  it('should attach a payment method and return 201', async () => {
    console.log('Testing: attachPaymentMethod endpoint');
    const result = await paymentMethodApi.endpoints.attachPaymentMethod
      .initiate({ orgId, paymentMethodId: 'pm_card_visa' })(store.dispatch, store.getState, {});
    
    if ('error' in result) {
      throw new Error(`Attach payment method failed: ${JSON.stringify(result.error)}`);
    } else {
      console.log('[paymentMethodSlice] attachPaymentMethod.matchFulfilled', result.data);
      expect(result.data).toMatchObject({
        id: expect.any(String),
        org: orgId,
        stripePaymentMethodId: expect.any(String),
        type: expect.any(String),
        isDefault: expect.any(Boolean),
        brand: expect.any(String),
        last4: expect.any(String),
        expMonth: expect.any(Number),
        expYear: expect.any(Number),
        billingDetails: expect.any(Object),
        metadata: expect.any(Object)
      });
    }
  }, 30000);

  // --- Get All Payment Methods Test ---
  it('should get all payment methods for an org', async () => {
    console.log('Testing: getPaymentMethods endpoint');
    await paymentMethodApi.endpoints.attachPaymentMethod
      .initiate({ orgId, paymentMethodId: 'pm_card_visa' })(store.dispatch, store.getState, {});

    const result = await paymentMethodApi.endpoints.getPaymentMethods
      .initiate(orgId)(store.dispatch, store.getState, {});
    
    if ('error' in result) {
      throw new Error(`Get payment methods failed: ${JSON.stringify(result.error)}`);
    } else {
      const paymentMethods = result.data as PaymentMethod[];
      console.log('[paymentMethodSlice] getPaymentMethods.matchFulfilled', paymentMethods);
      expect(paymentMethods.length).toBeGreaterThan(0);
      expect(paymentMethods[0]).toMatchObject({
        id: expect.any(String),
        org: expect.any(String),
        stripePaymentMethodId: expect.any(String),
        type: expect.any(String),
        isDefault: expect.any(Boolean),
        brand: expect.any(String),
        last4: expect.any(String),
        expMonth: expect.any(Number),
        expYear: expect.any(Number),
        billingDetails: expect.any(Object),
        metadata: expect.any(Object)
      });
    }
  }, 30000);

  // --- Get Payment Method By ID Test ---
  it('should get a payment method by id', async () => {
    console.log('Testing: getPaymentMethod by ID');
    const attachResult = await paymentMethodApi.endpoints.attachPaymentMethod
      .initiate({ orgId, paymentMethodId: 'pm_card_visa' })(store.dispatch, store.getState, {});
    
    if ('error' in attachResult) {
      throw new Error(`Attach payment method failed: ${JSON.stringify(attachResult.error)}`);
    }
    
    const paymentMethodId: string = attachResult.data.id!;
    console.log(`Payment method attached with ID: ${paymentMethodId}`);
    
    const result = await paymentMethodApi.endpoints.getPaymentMethod
      .initiate({ orgId, paymentMethodId })(store.dispatch, store.getState, {});
    
    if ('error' in result) {
      throw new Error(`Get payment method by id failed: ${JSON.stringify(result.error)}`);
    } else {
      console.log('[paymentMethodSlice] getPaymentMethod.matchFulfilled', result.data);
      expect(result.data).toMatchObject({
        id: paymentMethodId,
        org: orgId,
        stripePaymentMethodId: expect.any(String),
        type: expect.any(String),
        isDefault: expect.any(Boolean),
        brand: expect.any(String),
        last4: expect.any(String),
        expMonth: expect.any(Number),
        expYear: expect.any(Number),
        billingDetails: expect.any(Object),
        metadata: expect.any(Object)
      });
    }
  }, 30000);

  // --- Set Default Payment Method Test ---
  it('should set a payment method as default', async () => {
    console.log('Testing: setDefaultPaymentMethod endpoint');
    // Attach the first payment method.
    await paymentMethodApi.endpoints.attachPaymentMethod
      .initiate({ orgId, paymentMethodId: 'pm_card_visa' })(store.dispatch, store.getState, {});
    
    // Attach the second payment method.
    const secondResult = await paymentMethodApi.endpoints.attachPaymentMethod
      .initiate({ orgId, paymentMethodId: 'pm_card_mastercard' })(store.dispatch, store.getState, {});
    
    if ('error' in secondResult) {
      throw new Error(`Attach second payment method failed: ${JSON.stringify(secondResult.error)}`);
    }
    const secondId: string = secondResult.data.id!;
    
    // Re-fetch the organization from the backend.
    const orgResult = await orgApi.endpoints.getOrg
      .initiate({ orgId })(store.dispatch, store.getState, {});
    if ('error' in orgResult) {
      throw new Error(`Failed to fetch organization: ${JSON.stringify(orgResult.error)}`);
    }
    const updatedOrg = orgResult.data!;
    if (!updatedOrg.stripeCustomerId) {
      throw new Error('Organization does not have a stripeCustomerId');
    }
    console.log('Organization stripeCustomerId:', updatedOrg.stripeCustomerId);
    
    // Set the second payment method as default.
    const updateResult = await paymentMethodApi.endpoints.setDefaultPaymentMethod
      .initiate({ orgId, paymentMethodId: secondId })(store.dispatch, store.getState, {});
    
    if ('error' in updateResult) {
      throw new Error(`Set default payment method failed: ${JSON.stringify(updateResult.error)}`);
    } else {
      console.log('[paymentMethodSlice] setDefaultPaymentMethod.matchFulfilled', updateResult.data);
      expect(updateResult.data).toMatchObject({
        id: secondId,
        org: orgId,
        isDefault: true,
      });
    }
  }, 30000);

  // --- Detach Non-Default Payment Method Test ---
  it('should detach a non-default payment method', async () => {
    console.log('Testing: detachPaymentMethod endpoint');
    // Attach the first payment method.
    const firstResult = await paymentMethodApi.endpoints.attachPaymentMethod
      .initiate({ orgId, paymentMethodId: 'pm_card_visa' })(store.dispatch, store.getState, {});
    if ('error' in firstResult) {
      throw new Error(`Attach first payment method failed: ${JSON.stringify(firstResult.error)}`);
    }
    const firstId: string = firstResult.data.id!;
    console.log(`First payment method attached with ID: ${firstId}`);

    // Attach the second payment method.
    const secondResult = await paymentMethodApi.endpoints.attachPaymentMethod
      .initiate({ orgId, paymentMethodId: 'pm_card_mastercard' })(store.dispatch, store.getState, {});
    if ('error' in secondResult) {
      throw new Error(`Attach second payment method failed: ${JSON.stringify(secondResult.error)}`);
    }
    
    // Set the second payment method as default.
    const updateResult = await paymentMethodApi.endpoints.setDefaultPaymentMethod
      .initiate({ orgId, paymentMethodId: secondResult.data.id! })(store.dispatch, store.getState, {});
    if ('error' in updateResult) {
      throw new Error(`Set default payment method failed: ${JSON.stringify(updateResult.error)}`);
    }
    console.log('[paymentMethodApi] setDefaultPaymentMethod result:', updateResult.data);
    
    // Re-fetch the organization to ensure it has an updated stripeCustomerId.
    const orgResult = await orgApi.endpoints.getOrg
      .initiate({ orgId })(store.dispatch, store.getState, {});
    if ('error' in orgResult) {
      throw new Error(`Failed to re-fetch org: ${JSON.stringify(orgResult.error)}`);
    }
    const updatedOrg = orgResult.data!;
    if (!updatedOrg.stripeCustomerId) {
      throw new Error('Organization does not have a stripeCustomerId');
    }
    console.log('Organization stripeCustomerId after default set:', updatedOrg.stripeCustomerId);

    // Detach the first (non-default) payment method.
    const detachResult = await paymentMethodApi.endpoints.detachPaymentMethod
      .initiate({ orgId, paymentMethodId: firstId })(store.dispatch, store.getState, {});
    
    if ('error' in detachResult) {
      throw new Error(`Detach payment method failed: ${JSON.stringify(detachResult.error)}`);
    } else {
      console.log('[paymentMethodApi] Detach result:', detachResult.data);
      expect(detachResult.data).toBeNull();
    }
  }, 30000);
});
