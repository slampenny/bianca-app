import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { PaymentMethod } from '../services/api/api.types';
import { paymentMethodApi } from 'app/services/api';

interface PaymentMethodState {
  currentPaymentMethod: PaymentMethod | null;
  paymentMethods: PaymentMethod[];
}

const initialState: PaymentMethodState = {
  currentPaymentMethod: null,
  paymentMethods: [],
};

export const paymentMethodSlice = createSlice({
  name: 'paymentMethod',
  initialState,
  reducers: {
    setCurrentPaymentMethod: (state, action: PayloadAction<PaymentMethod | null>) => {
      console.log('[paymentMethodSlice] setCurrentPaymentMethod called with:', action.payload);
      state.currentPaymentMethod = action.payload;
    },
    clearCurrentPaymentMethod: (state) => {
      console.log('[paymentMethodSlice] clearCurrentPaymentMethod called');
      state.currentPaymentMethod = null;
    },
    setPaymentMethods: (state, action: PayloadAction<PaymentMethod[]>) => {
      console.log('[paymentMethodSlice] setPaymentMethods called');
      state.paymentMethods = action.payload;
    },
    clearPaymentMethods: (state) => {
      console.log('[paymentMethodSlice] clearPaymentMethods called');
      state.paymentMethods = [];
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(paymentMethodApi.endpoints.attachPaymentMethod.matchFulfilled, (state, { payload }) => {
      console.log('[paymentMethodSlice] attachPaymentMethod.matchFulfilled', payload);
      state.currentPaymentMethod = payload;
      state.paymentMethods.push(payload);
    });
    builder.addMatcher(paymentMethodApi.endpoints.getPaymentMethods.matchFulfilled, (state, { payload }) => {
      console.log('[paymentMethodSlice] getPaymentMethods.matchFulfilled', payload);
      state.paymentMethods = payload;
    });
    builder.addMatcher(paymentMethodApi.endpoints.getPaymentMethod.matchFulfilled, (state, { payload }) => {
      console.log('[paymentMethodSlice] getPaymentMethod.matchFulfilled', payload);
      state.currentPaymentMethod = payload;
    });
    builder.addMatcher(paymentMethodApi.endpoints.setDefaultPaymentMethod.matchFulfilled, (state, { payload }) => {
      console.log('[paymentMethodSlice] setDefaultPaymentMethod.matchFulfilled', payload);
      state.paymentMethods = state.paymentMethods.map(pm => pm.id === payload.id ? payload : pm);
      state.currentPaymentMethod = payload;
    });
    builder.addMatcher(paymentMethodApi.endpoints.detachPaymentMethod.matchFulfilled, (state, { meta }) => {
      console.log('[paymentMethodSlice] detachPaymentMethod.matchFulfilled');
      const { paymentMethodId } = meta.arg.originalArgs;
      state.paymentMethods = state.paymentMethods.filter(pm => pm.id !== paymentMethodId);
      if (state.currentPaymentMethod?.id === paymentMethodId) {
        state.currentPaymentMethod = null;
      }
    });
  }
});

export const {
  setCurrentPaymentMethod,
  clearCurrentPaymentMethod,
  setPaymentMethods,
  clearPaymentMethods,
} = paymentMethodSlice.actions;

export const getCurrentPaymentMethod = (state: RootState) => state.paymentMethod.currentPaymentMethod;
export const getPaymentMethods = (state: RootState) => state.paymentMethod.paymentMethods;

export default paymentMethodSlice.reducer;
