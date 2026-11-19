"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceController = void 0;
const performance_service_1 = require("./performance.service");
const logger_1 = require("../../shared/logger");
class PerformanceController {
    static async getAll(req, res) {
        try {
            const filters = {};
            if (req.query.employeeId)
                filters.employeeId = req.query.employeeId;
            if (req.query.status)
                filters.status = req.query.status;
            if (req.query.cycleType)
                filters.cycleType = req.query.cycleType;
            const reviews = await performance_service_1.PerformanceService.getAll(req.orgScope, filters);
            res.status(200).json({ success: true, data: reviews });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async getById(req, res) {
        try {
            const review = await performance_service_1.PerformanceService.getById(req.orgScope, String(req.params.id));
            if (!review)
                return res.status(404).json({ success: false, message: 'Review not found' });
            res.status(200).json({ success: true, data: review });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async compute(req, res) {
        try {
            const { employeeId, cycle, cycleType, managerScore } = req.body;
            if (!employeeId || !cycle) {
                return res.status(400).json({ success: false, message: 'employeeId and cycle are required' });
            }
            const result = await performance_service_1.PerformanceService.computeForEmployee(req.orgScope, employeeId, cycle, cycleType || 'quarterly', managerScore || 0);
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async refresh(req, res) {
        try {
            const review = await performance_service_1.PerformanceService.refreshReview(req.orgScope, String(req.params.id));
            logger_1.logger.info('performance.refresh.success', {
                reviewId: String(req.params.id),
                actorId: req.user?.id,
            });
            res.status(200).json({ success: true, data: review, message: 'Scores refreshed' });
        }
        catch (error) {
            logger_1.logger.error('performance.refresh.failed', {
                reviewId: String(req.params.id),
                actorId: req.user?.id,
                error: error?.message,
            });
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async getAnalytics(req, res) {
        try {
            const cycle = String(req.query.cycle || '');
            const cycleType = String(req.query.cycleType || 'quarterly');
            if (!cycle) {
                return res.status(400).json({ success: false, message: 'cycle query param is required' });
            }
            const analytics = await performance_service_1.PerformanceService.computeTeamAnalytics(req.orgScope, cycle, cycleType);
            res.status(200).json({ success: true, data: analytics });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async getMyReviews(req, res) {
        try {
            const employeeId = req.user?.employeeId;
            if (!employeeId)
                return res.status(400).json({ success: false, message: 'Employee ID required' });
            const reviews = await performance_service_1.PerformanceService.getByEmployee(req.orgScope, employeeId);
            res.status(200).json({ success: true, data: reviews });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async create(req, res) {
        try {
            const review = await performance_service_1.PerformanceService.create(req.orgScope, req.body);
            logger_1.logger.info('performance.create.success', {
                reviewId: review.id,
                employeeId: req.body?.employeeId,
                actorId: req.user?.id,
            });
            res.status(201).json({ success: true, data: review });
        }
        catch (error) {
            logger_1.logger.error('performance.create.failed', {
                employeeId: req.body?.employeeId,
                actorId: req.user?.id,
                error: error?.message,
            });
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async update(req, res) {
        try {
            const review = await performance_service_1.PerformanceService.update(req.orgScope, String(req.params.id), req.body);
            logger_1.logger.info('performance.update.success', {
                reviewId: String(req.params.id),
                actorId: req.user?.id,
            });
            res.status(200).json({ success: true, data: review });
        }
        catch (error) {
            logger_1.logger.error('performance.update.failed', {
                reviewId: String(req.params.id),
                actorId: req.user?.id,
                error: error?.message,
            });
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async submitSelfReview(req, res) {
        try {
            const review = await performance_service_1.PerformanceService.submitSelfReview(req.orgScope, String(req.params.id), req.body);
            logger_1.logger.info('performance.self_review_submitted', {
                reviewId: String(req.params.id),
                employeeId: req.user?.employeeId,
                actorId: req.user?.id,
            });
            res.status(200).json({ success: true, data: review, message: 'Self review submitted' });
        }
        catch (error) {
            logger_1.logger.error('performance.self_review_failed', {
                reviewId: String(req.params.id),
                actorId: req.user?.id,
                error: error?.message,
            });
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async submitManagerReview(req, res) {
        try {
            const managerId = req.user?.id;
            const review = await performance_service_1.PerformanceService.submitManagerReview(req.orgScope, String(req.params.id), {
                ...req.body,
                managerId,
            });
            logger_1.logger.info('approval.performance.review_submitted', {
                reviewId: String(req.params.id),
                managerId,
                rating: req.body?.rating,
            });
            res.status(200).json({ success: true, data: review, message: 'Manager review submitted' });
        }
        catch (error) {
            logger_1.logger.error('approval.performance.review_failed', {
                reviewId: String(req.params.id),
                actorId: req.user?.id,
                error: error?.message,
            });
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async delete(req, res) {
        try {
            await performance_service_1.PerformanceService.delete(req.orgScope, String(req.params.id));
            logger_1.logger.info('performance.delete.success', {
                reviewId: String(req.params.id),
                actorId: req.user?.id,
            });
            res.status(200).json({ success: true, message: 'Review deleted' });
        }
        catch (error) {
            logger_1.logger.error('performance.delete.failed', {
                reviewId: String(req.params.id),
                actorId: req.user?.id,
                error: error?.message,
            });
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
exports.PerformanceController = PerformanceController;
//# sourceMappingURL=performance.controller.js.map