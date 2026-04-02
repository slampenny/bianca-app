const express = require('express');
const scimBearerAuth = require('../../middlewares/scimAuth');
const scimController = require('../../controllers/scim.controller');

const router = express.Router();

const v2 = express.Router({ mergeParams: true });
v2.use(scimBearerAuth());

v2.get('/ServiceProviderConfig', scimController.serviceProviderConfig);
v2.get('/ResourceTypes', scimController.resourceTypes);
v2.get('/ResourceTypes/:typeId', scimController.getResourceType);
v2.get('/Users', scimController.listUsers);
v2.get('/Users/:userId', scimController.getUser);
v2.post('/Users', scimController.createUser);
v2.patch('/Users/:userId', scimController.patchUser);
v2.delete('/Users/:userId', scimController.deleteUser);

router.use('/orgs/:orgId/v2', v2);

module.exports = router;
