const dashboardService = require('../services/dashboard.service');
const { sendSuccess, sendError } = require('../lms.response.helper');

async function getDashboard(req, res) {
  try {
    const data = await dashboardService.fetchDashboardAggregations(req.user.id);
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = { getDashboard };
