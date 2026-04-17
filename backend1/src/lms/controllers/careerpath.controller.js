const careerpathService = require('../services/careerpath.service');
const { sendSuccess, sendError, sendNotFound } = require('../lms.response.helper');

async function getCareerPath(req, res) {
  try {
    const cp = await careerpathService.fetchCareerPath(req.user.id);
    return sendSuccess(res, cp);
  } catch (error) {
    return sendError(res, error);
  }
}

async function startMission(req, res) {
  try {
    const cp = await careerpathService.startMission(req.user.id);
    return sendSuccess(res, cp, 'Mission started');
  } catch (error) {
    return sendError(res, error);
  }
}

async function addRoadmapItem(req, res) {
  try {
    const cp = await careerpathService.addRoadmapItem(req.user.id, req.body);
    return sendSuccess(res, cp, 'Item added to roadmap');
  } catch (error) {
    return sendError(res, error);
  }
}

async function updateRoadmapItem(req, res) {
  try {
    const cp = await careerpathService.updateRoadmapItem(req.user.id, req.params.itemId, req.body);
    return sendSuccess(res, cp, 'Item updated');
  } catch (error) {
    return sendError(res, error);
  }
}

async function removeRoadmapItem(req, res) {
  try {
    const cp = await careerpathService.removeRoadmapItem(req.user.id, req.params.itemId);
    return sendSuccess(res, cp, 'Item removed');
  } catch (error) {
    return sendError(res, error);
  }
}

async function getPlannedItem(req, res) {
  try {
    const item = await careerpathService.fetchPlannedItem(req.user.id, req.params.itemId);
    if (!item) return sendNotFound(res, 'Item not found');
    return sendSuccess(res, item);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getNextAction(req, res) {
  try {
    const action = await careerpathService.fetchNextAction(req.user.id);
    if (!action) return sendSuccess(res, null, 'No next action immediately available'); // Graceful return
    return sendSuccess(res, action);
  } catch (error) {
    return sendError(res, error);
  }
}

async function updateCareerPath(req, res) {
  try {
    const cp = await careerpathService.upsertCareerPath(req.user.id, req.body);
    return sendSuccess(res, cp, 'Career path updated');
  } catch (error) {
    return sendError(res, error);
  }
}

async function setGoal(req, res) {
  try {
    const cp = await careerpathService.setLmsGoal(req.user.id, req.body.goal);
    return sendSuccess(res, cp, 'Goal set and mission started');
  } catch (error) {
    return sendError(res, error);
  }
}

async function recommendGoal(req, res) {
  try {
    const query = req.query.q || '';
    const recommendations = await careerpathService.fetchGoalRecommendations(query);
    return sendSuccess(res, recommendations);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  getCareerPath, startMission, addRoadmapItem, updateRoadmapItem, removeRoadmapItem, getPlannedItem, getNextAction, updateCareerPath, setGoal, recommendGoal
};
