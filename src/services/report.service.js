const httpStatus = require('http-status');
const { Report } = require('../models');
const ApiError = require('../utils/ApiError');

const generateReport = async (reportBody) => {
  // Logic for report generation goes here
  const report = new Report(reportBody);
  await report.save();
  return report;
};

const getReportById = async (id) => {
  const report = await Report.findById(id);
  if (!report) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Report not found');
  }
  return report;
};

module.exports = {
  generateReport,
  getReportById,
};
