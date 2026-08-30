import express from 'express';
import { jobController } from './job.controller.js';

const router = express.Router();
router.get('/jobs.xml', (req, res) => jobController.getCareerjetFeed(req, res));

export default router;
