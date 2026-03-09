/**
 * Legacy re-export: use client.service and Client terminology.
 * This file exists for backward compatibility; new code should require('./client.service').
 */
const clientService = require('./client.service');

module.exports = {
  createPatient: clientService.createClient,
  queryPatients: clientService.queryClients,
  getPatientById: clientService.getClientById,
  getPatientByEmail: clientService.getClientByEmail,
  updatePatientById: clientService.updateClientById,
  deletePatientById: clientService.deleteClientById,
  assignCaregiver: clientService.assignCaregiver,
  removeCaregiver: clientService.removeCaregiver,
  getCaregivers: clientService.getCaregivers,
  getActivePatients: clientService.getActiveClients,
  getUnassignedPatients: clientService.getUnassignedClients,
  sendConsentEmailIfRequired: clientService.sendConsentEmailIfRequired,
  checkPatientConsent: clientService.checkClientConsent,
  verifyConsentToken: clientService.verifyConsentToken,
};
