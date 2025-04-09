// invoice.fixture.ts
import { InvoiceStatus } from '../../app/services/api/api.types';

export function newInvoice(
  status: InvoiceStatus = 'draft',
  totalAmount: number = 100,
  notes: string = 'Test invoice'
): {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  totalAmount: number;
  notes: string;
} {
  const invoiceNumber = `INV-${Math.floor(Math.random() * 10000)}`;
  const issueDate = new Date().toISOString();
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return { invoiceNumber, issueDate, dueDate, status, totalAmount, notes };
}
