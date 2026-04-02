const httpStatus = require('http-status');
const pick = require('../utils/pick');
const catchAsync = require('../utils/catchAsync');
const { activityService } = require('../services');

const getRecentActivity = catchAsync(async (req, res) => {
  const query = pick(req.query, ['limit', 'orgId', 'sinceDays']);
  const payload = await activityService.getRecentActivity(req.caregiver, {
    limit: query.limit ? Number(query.limit) : undefined,
    orgId: query.orgId,
    sinceDays: query.sinceDays ? Number(query.sinceDays) : undefined,
  });
  res.status(httpStatus.OK).send(payload);
});

const getCallsByHourToday = catchAsync(async (req, res) => {
  const query = pick(req.query, ['orgId']);
  const payload = await activityService.getCallsByHourToday(req.caregiver, {
    orgId: query.orgId,
  });
  res.status(httpStatus.OK).send(payload);
});

module.exports = {
  getRecentActivity,
  getCallsByHourToday,
};
