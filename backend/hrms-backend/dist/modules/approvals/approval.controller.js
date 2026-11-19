"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalController = void 0;
const approval_service_1 = require("./approval.service");
class ApprovalController {
    static async getInbox(req, res) {
        try {
            const user = req.user;
            const inbox = await approval_service_1.ApprovalService.getInboxEnriched(req.orgScope, user);
            res.status(200).json({ data: inbox });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async act(req, res) {
        try {
            const user = req.user;
            const { action, remark, approvedLWD } = req.body;
            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({ message: 'action must be approve or reject' });
            }
            const result = await approval_service_1.ApprovalService.actOnRequest(String(req.params.id), action, user, req.orgScope, remark, approvedLWD);
            res.status(200).json(result);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
}
exports.ApprovalController = ApprovalController;
//# sourceMappingURL=approval.controller.js.map