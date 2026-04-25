const express = require('express');
const multer = require('multer');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { minimumNecessaryMiddleware } = require('../../middlewares/minimumNecessary');
const config = require('../../config/config');

const upload = multer({ dest: config.multer.dest });
const clientValidation = require('../../validations/client.validation');
const clientController = require('../../controllers/client.controller');

const router = express.Router();

router
  .route('/')
  .post(
    auth('createAny:client'),
    validate(clientValidation.createClient),
    clientController.createClient
  )
  .get(
    auth('readOwn:client', 'readAny:client'),
    minimumNecessaryMiddleware('client'),
    validate(clientValidation.getClients),
    clientController.getClients
  );

router
  .route('/onboarding-rollups')
  .get(
    auth('readOwn:client', 'readAny:client'),
    minimumNecessaryMiddleware('clientOnboarding'),
    validate(clientValidation.getClientsOnboardingRollups),
    clientController.getClientsOnboardingRollups
  );

router
  .route('/unassigned')
  .get(
    auth('readOwn:client', 'readAny:client'),
    minimumNecessaryMiddleware('client'),
    validate(clientValidation.getUnassignedClients),
    clientController.getUnassignedClients
  );

router
  .route('/assign-unassigned')
  .post(
    auth('updateOwn:client', 'updateAny:client'),
    validate(clientValidation.assignUnassignedClients),
    clientController.assignUnassignedClients
  );

router
  .route('/:clientId')
  .get(
    auth('readOwn:client', 'readAny:client'),
    minimumNecessaryMiddleware('client'),
    validate(clientValidation.getClient),
    clientController.getClient
  )
  .patch(
    auth('updateOwn:client', 'updateAny:client'),
    validate(clientValidation.updateClient),
    clientController.updateClient
  )
  .delete(
    auth('deleteOwn:client', 'deleteAny:client'),
    validate(clientValidation.deleteClient),
    clientController.deleteClient
  );

router
  .route('/:clientId/avatar')
  .post(auth('updateOwn:client', 'updateAny:client'), upload.single('avatar'), clientController.uploadClientAvatar)
  .patch(auth('updateOwn:client', 'updateAny:client'), upload.single('avatar'), clientController.uploadClientAvatar);

router
  .route('/:clientId/caregivers/:caregiverId')
  .post(auth('updateAny:client'), clientController.assignCaregiver)
  .delete(auth('deleteAny:client'), clientController.removeCaregiver);

router
  .route('/:clientId/calls')
  .get(
    auth('readOwn:client', 'readAny:client'),
    minimumNecessaryMiddleware('conversation'),
    validate(clientValidation.getCallsByClient),
    clientController.getCallsByClient
  );

router
  .route('/:clientId/conversations')
  .get(
    auth('readOwn:client', 'readAny:client'),
    minimumNecessaryMiddleware('conversation'),
    validate(clientValidation.getConversationsByClient),
    clientController.getConversationsByClient
  );

router
  .route('/:clientId/onboarding')
  .get(
    auth('readOwn:client', 'readAny:client'),
    minimumNecessaryMiddleware('clientOnboarding'),
    validate(clientValidation.getClientOnboarding),
    clientController.getClientOnboarding
  );

router
  .route('/:clientId/caregivers')
  .get(auth('readAny:caregiver'), validate(clientValidation.getCaregivers), clientController.getCaregivers);

router
  .route('/consent/verify')
  .post(clientController.verifyConsent)
  .get(clientController.verifyConsent);

module.exports = router;
