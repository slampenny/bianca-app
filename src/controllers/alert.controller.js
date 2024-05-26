const express = require('express');
const alertService = require('../services/alert.service');
const catchAsync = require('../utils/catchAsync');
const logger = require('../config/logger');

const createAlert = catchAsync(async (req, res) => {
    const alert = await alertService.createAlert(req.body);
    res.status(201).send(alert);
});

const getAlertById = catchAsync(async (req, res) => {
    const { alertId } = req.params;  // ID of the alert to retrieve
    const caregiverId = req.caregiver.id;  // Assuming the caregiver's ID is stored in req.user._id
    //logger.debug(`Fetching alert with ID: ${alertId} for caregiver with ID: ${caregiverId}`);
    const alert = await alertService.getAlertById(alertId, caregiverId);
    if (!alert) {
        return res.status(404).send({ message: 'Alert not found or no longer relevant' });
    }

    res.status(200).json(alert);
});

const getAlerts = catchAsync(async (req, res) => {
    // Assuming 'showRead' is passed as a query parameter to toggle visibility of read alerts
    const showRead = req.query.showRead === 'true';
    const alerts = await alertService.getAlerts(req.caregiver.id, showRead);
    res.send(alerts);
});

const updateAlert = catchAsync(async (req, res) => {
    const { alertId } = req.params;  // ID of the alert to retrieve
    const alert = await alertService.updateAlertById(alertId, req.body);
    res.send(alert);
});

const markAlertAsRead = catchAsync(async (req, res) => {
    const { alertId } = req.params;  // ID of the alert to retrieve
    const alert = await alertService.markAlertAsRead(alertId, req.caregiver.id);
    res.send(alert);
});

const deleteAlert = catchAsync(async (req, res) => {
    const { alertId } = req.params;  // ID of the alert to retrieve
    await alertService.deleteAlertById(alertId);
    res.status(204).send();
});

module.exports = {
    createAlert,
    getAlertById,
    getAlerts,
    updateAlert,
    markAlertAsRead,
    deleteAlert
};
