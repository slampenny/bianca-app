const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createInvoiceFromConversations = {
  params: Joi.object().keys({
    patientId: Joi.string().required().custom(objectId),
  }),
};

const listInvoicesByPatient = {
  params: Joi.object().keys({
    patientId: Joi.string().required().custom(objectId),
  }),
  query: Joi.object().keys({
    status: Joi.string().valid('draft', 'pending', 'paid', 'void', 'overdue'),
    dueDate: Joi.date().iso(),
  }),
};

const listInvoicesByOrg = {
  params: Joi.object().keys({
    orgId: Joi.string().required().custom(objectId),
  }),
  query: Joi.object().keys({
    status: Joi.string().valid('draft', 'pending', 'paid', 'void', 'overdue'),
    dueDate: Joi.date().iso(),
  }),
};

module.exports = {
  createInvoiceFromConversations,
  listInvoicesByPatient,
  listInvoicesByOrg,
};
