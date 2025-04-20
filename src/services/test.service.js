const logger = require('../config/logger');
const { Org, Caregiver, Patient } = require('../models');

const cleanDB = async () => {
  logger.info('Cleaning database...');
  await Org.deleteMany();
  await Caregiver.deleteMany();
  await Patient.deleteMany();

  return true;
};

module.exports = {
  cleanDB,
};
