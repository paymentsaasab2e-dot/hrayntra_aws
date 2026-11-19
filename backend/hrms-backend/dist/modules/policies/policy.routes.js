"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../../shared/middleware/auth");
const policy_controller_1 = require("./policy.controller");
const resolve_tenant_1 = require("../../shared/tenant/resolve-tenant");
const router = (0, express_1.Router)();
const uploadRoot = path_1.default.join(process.cwd(), 'uploads', 'policies');
const storage = multer_1.default.diskStorage({
    destination: async (req, _file, cb) => {
        try {
            const user = req.user;
            const tenantId = (await (0, resolve_tenant_1.resolveTenantId)(user)) || 'default';
            const dir = path_1.default.join(uploadRoot, tenantId);
            fs_1.default.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        }
        catch (err) {
            cb(err, uploadRoot);
        }
    },
    filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${safe}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        if (allowed.includes(file.mimetype) || file.originalname.endsWith('.pdf')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only PDF, Word, or text files are allowed'));
        }
    },
});
router.use(auth_1.authMiddleware);
router.get('/active', policy_controller_1.PolicyController.getActive);
router.patch('/active', (0, auth_1.authorize)(['ADMIN', 'HR']), policy_controller_1.PolicyController.updateActive);
router.get('/', (0, auth_1.authorize)(['ADMIN', 'HR']), policy_controller_1.PolicyController.list);
router.get('/:id', (0, auth_1.authorize)(['ADMIN', 'HR']), policy_controller_1.PolicyController.getById);
router.post('/upload', (0, auth_1.authorize)(['ADMIN', 'HR']), upload.single('file'), policy_controller_1.PolicyController.upload);
router.post('/', (0, auth_1.authorize)(['ADMIN', 'HR']), policy_controller_1.PolicyController.createManual);
router.patch('/:id/rules', (0, auth_1.authorize)(['ADMIN', 'HR']), policy_controller_1.PolicyController.updateRules);
router.post('/:id/publish', (0, auth_1.authorize)(['ADMIN', 'HR']), policy_controller_1.PolicyController.publish);
router.post('/versions/:versionId/acknowledge', policy_controller_1.PolicyController.acknowledge);
exports.default = router;
//# sourceMappingURL=policy.routes.js.map