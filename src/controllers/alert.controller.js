const express = require('express');
const alertService = require('../services/alert.service');
const catchAsync = require('../utils/catchAsync');

const createAlert = catchAsync(async (req, res) => {
    const alert = await alertService.createAlert(req.body);
    res.status(201).send(alert);
});

const getAlert = catchAsync(async (req, res) => {
    const { alertId } = req.params;  // ID of the alert to retrieve
    const caregiverId = req.caregiver.id;  // Assuming the caregiver's ID is stored in req.user._id

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
    const alert = await alertService.updateAlertById(req.params.id, req.body);
    res.send(alert);
});

const markAlertAsRead = catchAsync(async (req, res) => {
    const alert = await alertService.markAlertAsRead(req.params.id, req.user._id);
    res.send(alert);
});

const deleteAlert = catchAsync(async (req, res) => {
    await alertService.deleteAlertById(req.params.id);
    res.status(204).send();
});

module.exports = {
    createAlert,
    getAlert,
    getAlerts,
    updateAlert,
    markAlertAsRead,
    deleteAlert
};
