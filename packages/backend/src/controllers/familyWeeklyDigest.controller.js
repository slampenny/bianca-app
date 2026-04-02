const httpStatus = require('http-status');
const pick = require('../utils/pick');
const catchAsync = require('../utils/catchAsync');
const { familyWeeklyDigestService } = require('../services');

const previewDigest = catchAsync(async (req, res) => {
  const { clientId, weekStart } = req.body;
  const data = await familyWeeklyDigestService.previewDigest(req.caregiver, clientId, weekStart);
  res.send(data);
});

const createDigest = catchAsync(async (req, res) => {
  const { clientId, weekStart } = req.body;
  const { digest, eligibility } = await familyWeeklyDigestService.createDigest(req.caregiver, clientId, weekStart);
  res.status(httpStatus.CREATED).send({ digest, eligibility });
});

const listDigests = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['clientId']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await familyWeeklyDigestService.queryDigests(req.caregiver, filter, options);
  res.send(result);
});

const getDigest = catchAsync(async (req, res) => {
  const digest = await familyWeeklyDigestService.getDigestById(req.caregiver, req.params.digestId);
  res.send(digest);
});

const sendDigest = catchAsync(async (req, res) => {
  const digest = await familyWeeklyDigestService.sendDigest(req.caregiver, req.params.digestId);
  res.send(digest);
});

module.exports = {
  previewDigest,
  createDigest,
  listDigests,
  getDigest,
  sendDigest,
};
