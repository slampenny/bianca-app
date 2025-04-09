// app/store/paymentsSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { Invoice } from '../services/api/api.types';
import { paymentApi } from 'app/services/api';

interface PaymentState {
  payment: Invoice | null;
  payments: Invoice[];
}

const initialState: PaymentState = {
  payment: null,
  payments: [],
};

export const paymentsSlice = createSlice({
  name: 'payment',
  initialState,
  reducers: {
    setPayment: (state, action: PayloadAction<Invoice | null>) => {
      console.log('[paymentsSlice] setPayment called with:', action.payload);
      state.payment = action.payload;
    },
    clearPayment: (state) => {
      console.log('[paymentsSlice] clearPayment called');
      state.payment = null;
    },
    setPayments: (state, action: PayloadAction<Invoice[]>) => {
      console.log('[paymentsSlice] setPayments called');
      state.payments = action.payload;
    },
    clearPayments: (state) => {
      console.log('[paymentsSlice] clearPayments called');
      state.payments = [];
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(paymentApi.endpoints.createInvoiceFromConversations.matchFulfilled, (state, { payload }) => {
      console.log('[paymentsSlice] createInvoiceFromConversations.matchFulfilled', payload);
      state.payment = payload;
      state.payments.push(payload);
    });
    builder.addMatcher(paymentApi.endpoints.getInvoicesByPatient.matchFulfilled, (state, { payload }) => {
      console.log('[paymentsSlice] getInvoicesByPatient.matchFulfilled', payload);
      state.payments = payload;
    });
    builder.addMatcher(paymentApi.endpoints.getInvoicesByOrg.matchFulfilled, (state, { payload }) => {
      console.log('[paymentsSlice] getInvoicesByOrg.matchFulfilled', payload);
      state.payments = payload;
    });
  }
});

export const { setPayment, clearPayment, setPayments, clearPayments } = paymentsSlice.actions;
export const getPayment = (state: RootState) => state.payment.payment;
export const getPayments = (state: RootState) => state.payment.payments;

export default paymentsSlice.reducer;
