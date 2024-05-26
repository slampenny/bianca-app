const mongoose = require('mongoose');
const { Alert } = require('../../src/models');
const faker = require('faker');

const alertOne = {
  message: faker.lorem.sentence(),
  importance: 'low',
  visibility: 'allCaregivers',
  relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours from now
  readBy: []
};

const alertTwo = {
  message: faker.lorem.sentence(),
  importance: 'high',
  visibility: 'assignedCaregivers',
  relevanceUntil: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
  readBy: []
};

const alertThree = {
  message: faker.lorem.sentence(),
  importance: 'urgent',
  visibility: 'orgAdmin',
  relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 48), // 48 hours from now
  readBy: []
};

const expiredAlert = {
  message: faker.lorem.sentence(),
  importance: 'medium',
  visibility: 'allCaregivers',
  relevanceUntil: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
  readBy: []
};

const insertAlerts = async (sourceObj, createdModel, alerts) => {
    const alertsCreatedByCaregiver = alerts.map(alert => ({
        ...alert,
        createdBy: sourceObj.id,
        createdModel: createdModel,
    }));
    return await Alert.insertMany(alertsCreatedByCaregiver);
};

module.exports = {
  alertOne,
  alertTwo,
  alertThree,
  expiredAlert,
  insertAlerts
};
