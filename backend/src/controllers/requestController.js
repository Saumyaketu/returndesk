const requestService = require('../services/requestService');

class RequestController {
  /**
   * POST /api/requests
   * Raise a new return request
   */
  async createRequest(req, res, next) {
    try {
      const result = await requestService.createRequest(req.body);
      res.status(201).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/requests
   * Server-side search, filter, sort, and pagination
   */
  async getRequests(req, res, next) {
    try {
      const result = await requestService.getRequests(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/requests/:id
   * Fetch single request by ID or Reference with chronological notes
   */
  async getRequestById(req, res, next) {
    try {
      const result = await requestService.getRequestById(req.params.id);
      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/requests/:id
   * Edit customer or item details (Rule 4: locked once decided)
   */
  async updateRequest(req, res, next) {
    try {
      const result = await requestService.updateRequest(req.params.id, req.body);
      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/requests/:id/transition
   * Move request lifecycle status (Rule 1 & Rule 2)
   */
  async transitionStatus(req, res, next) {
    try {
      const result = await requestService.transitionStatus(req.params.id, req.body);
      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/requests/:id
   * Rule 5: Non-destructive removal from the desk
   */
  async removeRequest(req, res, next) {
    try {
      const result = await requestService.removeRequest(req.params.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/requests/:id/notes
   * Add a note to a request (allowed at any point in lifecycle)
   */
  async addNote(req, res, next) {
    try {
      const result = await requestService.addNote(req.params.id, req.body);
      res.status(201).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/requests/:id/notes
   * Fetch all notes for a request in chronological order
   */
  async getNotes(req, res, next) {
    try {
      const result = await requestService.getNotes(req.params.id);
      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new RequestController();
