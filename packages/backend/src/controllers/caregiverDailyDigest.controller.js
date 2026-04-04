const pick = require('../utils/pick');
const catchAsync = require('../utils/catchAsync');
const { caregiverDailyDigestService } = require('../services');

const createDigest = catchAsync(async (req, res) => {
  const { digestDate } = req.body;
  const digest = await caregiverDailyDigestService.createOrUpdateDigest(req.caregiver, digestDate);
  res.status(httpStatus.OK).send(digest);
});

const listDigests = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['caregiverId', 'digestDate']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await caregiverDailyDigestService.queryDigests(req.caregiver, filter, options);
  res.send(result);
});

const getDigest = catchAsync(async (req, res) => {
  const digest = await caregiverDailyDigestService.getDigestById(req.caregiver, req.params.digestId);
  res.send(digest);
});

module.exports = {
  createDigest,
  listDigests,
  getDigest,
};
