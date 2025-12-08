const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { reportService } = require('../services');

const generateReport = catchAsync(async (req, res) => {
  const report = await reportService.generateReport(req.body);
  res.status(httpStatus.CREATED).send(report);
});

const getReport = catchAsync(async (req, res) => {
  const report = await reportService.getReportById(req.params.reportId);
  if (!report) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Report not found');
  }
  res.send(report);
});

module.exports = {
  generateReport,
  getReport,
};
