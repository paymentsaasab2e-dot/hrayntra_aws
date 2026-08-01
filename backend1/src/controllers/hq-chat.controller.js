const {
  sendAsHryantra,
  ingestUserReply,
  getThread,
  listInbox,
  pendingForUser,
  markReadByUser,
  markReadByHq,
} = require('../services/hq-chat.service');

async function hqSendMessage(req, res) {
  try {
    const userId = String(req.params.userId || req.body?.userId || '').trim();
    const result = await sendAsHryantra({
      userId,
      text: req.body?.text,
      actionUrl: req.body?.actionUrl,
      hqMeta: req.body?.hqMeta,
      notifyUser: req.body?.notifyUser !== false,
      senderRole: req.body?.senderRole || 'hq',
    });
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.error });
    }
    return res.status(201).json({
      success: true,
      message: 'Message sent as HRYantra',
      data: {
        message: result.message,
        thread: result.thread,
      },
    });
  } catch (error) {
    console.error('hqSendMessage:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send HQ chat message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

function hqGetThread(req, res) {
  try {
    const userId = String(req.params.userId || '').trim();
    const limit = Number(req.query.limit || 200);
    const thread = getThread(userId, { includeMessages: true, messageLimit: limit });
    if (!thread) {
      return res.status(400).json({ success: false, message: 'userId required' });
    }
    return res.json({ success: true, data: thread });
  } catch (error) {
    console.error('hqGetThread:', error);
    return res.status(500).json({ success: false, message: 'Failed to load thread' });
  }
}

function hqListInbox(req, res) {
  try {
    const rows = listInbox({
      limit: req.query.limit,
      q: req.query.q,
    });
    return res.json({
      success: true,
      data: { threads: rows, count: rows.length },
    });
  } catch (error) {
    console.error('hqListInbox:', error);
    return res.status(500).json({ success: false, message: 'Failed to list inbox' });
  }
}

function clientPending(req, res) {
  try {
    const userId = String(req.params.userId || '').trim();
    const since = req.query.since || null;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId required' });
    }
    const data = pendingForUser(userId, since);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('clientPending:', error);
    return res.status(500).json({ success: false, message: 'Failed to load pending messages' });
  }
}

function clientIngestReply(req, res) {
  try {
    const userId = String(req.params.userId || req.body?.userId || '').trim();
    const result = ingestUserReply({
      userId,
      text: req.body?.text,
      mediaUrl: req.body?.mediaUrl,
      mediaType: req.body?.mediaType,
      clientMessageId: req.body?.clientMessageId || req.body?.id,
    });
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.error });
    }
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('clientIngestReply:', error);
    return res.status(500).json({ success: false, message: 'Failed to ingest reply' });
  }
}

function markUserRead(req, res) {
  try {
    const userId = String(req.params.userId || '').trim();
    const result = markReadByUser(userId);
    if (!result.ok) {
      return res.status(404).json({ success: false, message: result.error });
    }
    return res.json({ success: true, data: result.thread });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to mark read' });
  }
}

function markHqRead(req, res) {
  try {
    const userId = String(req.params.userId || '').trim();
    const result = markReadByHq(userId);
    if (!result.ok) {
      return res.status(404).json({ success: false, message: result.error });
    }
    return res.json({ success: true, data: result.thread });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to mark HQ read' });
  }
}

module.exports = {
  hqSendMessage,
  hqGetThread,
  hqListInbox,
  clientPending,
  clientIngestReply,
  markUserRead,
  markHqRead,
};
