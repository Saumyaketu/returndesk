const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');

// Request collection routes
router.post('/', (req, res, next) => requestController.createRequest(req, res, next));
router.get('/', (req, res, next) => requestController.getRequests(req, res, next));

// Single request routes
router.get('/:id', (req, res, next) => requestController.getRequestById(req, res, next));
router.patch('/:id', (req, res, next) => requestController.updateRequest(req, res, next));
router.delete('/:id', (req, res, next) => requestController.removeRequest(req, res, next));

// Lifecycle state transition route
router.post('/:id/transition', (req, res, next) => requestController.transitionStatus(req, res, next));

// Note sub-resource routes
router.post('/:id/notes', (req, res, next) => requestController.addNote(req, res, next));
router.get('/:id/notes', (req, res, next) => requestController.getNotes(req, res, next));

module.exports = router;
