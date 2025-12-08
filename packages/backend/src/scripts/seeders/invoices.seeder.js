const { Invoice } = require('../../models');

/**
 * Seed invoices for an organization
 * @param {Object} org - Organization to seed invoices for
 * @param {Array} paymentMethods - Array of payment methods to use
 * @returns {Promise<Object>} Created invoice
 */
async function seedInvoices(org, paymentMethods = []) {
  console.log('Seeding Invoices for org:', org._id);
  
  if (paymentMethods.length === 0) {
    console.log('No payment methods available, skipping invoice creation');
    return null;
  }
  
  const invoiceData = {
    org: org._id,
    invoiceNumber: `INV-SEED-${Date.now()}`,
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    status: 'pending',
    totalAmount: 100,
    paymentMethod: paymentMethods[0]._id,
    stripePaymentIntentId: 'pi_test',
    stripeInvoiceId: 'in_test',
    notes: 'Dummy invoice seeded for frontend display',
  };
  
  const invoice = await Invoice.create(invoiceData);
  console.log('Seeded Invoice:', invoice.invoiceNumber);
  
  return invoice;
}

module.exports = {
  seedInvoices,
};

