import express from 'express';
import { sendError, sendResponse } from '../../utils/response.js';
import { getTenantJobByApiKey, listTenantJobsByApiKey } from './tenant-jobs.service.js';

const router = express.Router();

router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

router.get('/', async (req, res) => {
  try {
    const data = await listTenantJobsByApiKey(req);
    return sendResponse(res, 200, 'OK', data);
  } catch (error) {
    return sendError(res, error.statusCode || 400, error.message, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = String(req.params?.id || '').trim();
    const data = id.startsWith('hryj_')
      ? await listTenantJobsByApiKey(req)
      : await getTenantJobByApiKey(req);
    return sendResponse(res, 200, 'OK', data);
  } catch (error) {
    return sendError(res, error.statusCode || 400, error.message, error);
  }
});

export default router;
