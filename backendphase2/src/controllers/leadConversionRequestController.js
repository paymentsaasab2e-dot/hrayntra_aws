import { leadConversionRequestService } from '../services/leadConversionRequest.service.js';

function actorId(req) {
  return req?.user?.id || req?.userWithPermissions?.id;
}

export async function listLeadConversionRequests(req, res) {
  try {
    const box = String(req.query.box || 'inbox').trim().toLowerCase();
    const data = await leadConversionRequestService.list(actorId(req), { box });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('listLeadConversionRequests:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to list requests' });
  }
}

export async function submitLeadConversionRequest(req, res) {
  try {
    const data = await leadConversionRequestService.submit(
      actorId(req),
      req.params.id,
      req.body || {},
    );
    return res.status(201).json({ success: true, data, message: 'Conversion request submitted for approval' });
  } catch (error) {
    console.error('submitLeadConversionRequest:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to submit request' });
  }
}

export async function reviewLeadConversionRequest(req, res) {
  try {
    const data = await leadConversionRequestService.review(actorId(req), req.params.id, req.body || {});
    return res.status(200).json({ success: true, data, message: 'Conversion request updated' });
  } catch (error) {
    console.error('reviewLeadConversionRequest:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to review request' });
  }
}
