const mongoose = require('mongoose');
const faker = require('faker');
const { Invoice, LineItem } = require('../../src/models');

const invoiceOne = {
  invoiceNumber: `INV-${faker.datatype.number({ min: 10000, max: 99999 })}`,
  issueDate: new Date(),
  status: 'draft',
  dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
  totalAmount: faker.datatype.number({ min: 1000, max: 50000 }),
  notes: 'Regular checkup and consultation',
};

const invoiceTwo = {
  invoiceNumber: `INV-${faker.datatype.number({ min: 10000, max: 99999 })}`,
  issueDate: new Date(),
  status: 'pending',
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  totalAmount: faker.datatype.number({ min: 1000, max: 50000 }),
  notes: 'Follow-up appointments and therapy sessions',
};

const lineItemOne = {
  amount: faker.datatype.number({ min: 500, max: 2000 }),
  description: 'Initial consultation',
  periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  periodEnd: new Date(),
  quantity: 1,
  unitPrice: faker.datatype.number({ min: 500, max: 2000 }),
};

const lineItemTwo = {
  amount: faker.datatype.number({ min: 1000, max: 3000 }),
  description: 'Therapy session',
  periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  periodEnd: new Date(),
  quantity: 2,
  unitPrice: faker.datatype.number({ min: 500, max: 1500 }),
};

/**
 * Create invoices for a patient
 * @param {Patient} patient - Patient to create invoices for
 * @param {Array} invoicesArray - Array of invoice objects
 * @returns {Promise<Array>} - Array of created invoices
 */
const insertInvoices = async (patient, invoicesArray) => {
  const invoices = await Promise.all(
    invoicesArray.map(async (invoice) => {
      const newInvoice = new Invoice({
        ...invoice,
        org: patient.org,
      });
      await newInvoice.save();

      // Create line items for this invoice
      const lineItems = [
        { ...lineItemOne, patientId: patient._id, invoiceId: newInvoice._id },
        { ...lineItemTwo, patientId: patient._id, invoiceId: newInvoice._id },
      ];

      await LineItem.insertMany(lineItems);

      return newInvoice;
    })
  );

  return invoices;
};

module.exports = {
  invoiceOne,
  invoiceTwo,
  lineItemOne,
  lineItemTwo,
  insertInvoices,
};
