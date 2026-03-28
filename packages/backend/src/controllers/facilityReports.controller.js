const pick = require('../utils/pick');
const catchAsync = require('../utils/catchAsync');
const { facilityReportsService } = require('../services');

const getCallCompletionLog = catchAsync(async (req, res) => {
  const query = pick(req.query, ['dateFrom', 'dateTo', 'clientId', 'orgId']);
  const data = await facilityReportsService.getCallCompletionLog(req.caregiver, query);
  res.send(data);
});

const getAlertAuditTrail = catchAsync(async (req, res) => {
  const query = pick(req.query, ['dateFrom', 'dateTo', 'orgId']);
  const data = await facilityReportsService.getAlertAuditTrail(req.caregiver, query);
  res.send(data);
});

module.exports = {
  getCallCompletionLog,
  getAlertAuditTrail,
};
