import { crossDepartmentRequestService } from '../services/crossDepartmentRequest.service.js';

function actorId(req) {
  return req?.user?.id || req?.userWithPermissions?.id;
}

export async function getCrossDeptAssignOptions(req, res) {
  try {
    const data = await crossDepartmentRequestService.getAssignOptions(actorId(req), req);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('getCrossDeptAssignOptions:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load options' });
  }
}

export async function listCrossDeptRequests(req, res) {
  try {
    const box = String(req.query.box || 'sent').trim().toLowerCase();
    const data = await crossDepartmentRequestService.list(actorId(req), { box });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('listCrossDeptRequests:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to list requests' });
  }
}

export async function createCrossDeptRequest(req, res) {
  try {
    const data = await crossDepartmentRequestService.create(actorId(req), req.body || {}, req);
    return res.status(201).json({ success: true, data, message: 'Cross-department request created' });
  } catch (error) {
    console.error('createCrossDeptRequest:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to create request' });
  }
}

export async function reviewCrossDeptRequest(req, res) {
  try {
    const data = await crossDepartmentRequestService.review(actorId(req), req.params.id, req.body || {});
    return res.status(200).json({ success: true, data, message: 'Request updated' });
  } catch (error) {
    console.error('reviewCrossDeptRequest:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to review request' });
  }
}

export async function forwardCrossDeptRequest(req, res) {
  try {
    const data = await crossDepartmentRequestService.forward(actorId(req), req.params.id, req.body || {});
    return res.status(200).json({ success: true, data, message: 'Request forwarded' });
  } catch (error) {
    console.error('forwardCrossDeptRequest:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to forward request' });
  }
}
