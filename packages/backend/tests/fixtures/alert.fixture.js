const mongoose = require('mongoose');
const faker = require('faker');
const { Alert } = require('../../src/models');

const alertOne = {
  message: faker.lorem.sentence(),
  importance: 'low',
  alertType: 'system',
  visibility: 'allCaregivers',
  relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours from now
  readBy: [],
};

const alertTwo = {
  message: faker.lorem.sentence(),
  importance: 'high',
  alertType: 'system',
  visibility: 'assignedCaregivers',
  relevanceUntil: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
  readBy: [],
};

const alertThree = {
  message: faker.lorem.sentence(),
  importance: 'urgent',
  alertType: 'system',
  visibility: 'orgAdmin',
  relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 48), // 48 hours from now
  readBy: [],
};

const expiredAlert = {
  message: faker.lorem.sentence(),
  importance: 'medium',
  alertType: 'system',
  visibility: 'allCaregivers',
  relevanceUntil: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
  readBy: [],
};

const insertAlerts = async (sourceObj, createdModel, alerts) => {
  const alertsCreatedByCaregiver = alerts.map((alert) => ({
    ...alert,
    createdBy: sourceObj.id,
    createdModel,
  }));
  return await Alert.insertMany(alertsCreatedByCaregiver);
};

module.exports = {
  alertOne,
  alertTwo,
  alertThree,
  expiredAlert,
  insertAlerts,
};
