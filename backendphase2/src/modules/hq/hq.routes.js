import express from 'express';
import { hqController } from './hq.controller.js';

const router = express.Router();

// Setup initial Super Admin credentials directly
// Note: This is an unsecured setup route intended for bootstrap/initialization.
router.post('/setup', hqController.setupSuperAdmin);

export default router;
