const express = require('express');
const { prisma } = require('../lib/prisma');
const { generateAdzunaFeed } = require('../services/adzuna/feed.service');

const router = express.Router();

async function sendAdzunaXml(req, res) {
  try {
    const { xml } = await generateAdzunaFeed(prisma);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    return res.status(200).send(xml);
  } catch (error) {
    console.error('[adzuna-feed] endpoint failed:', error?.message || error);
    return res.status(500).type('text/plain; charset=UTF-8').send('Failed to build Adzuna feed');
  }
}

router.get('/jobs.xml', sendAdzunaXml);

module.exports = router;
module.exports.sendAdzunaXml = sendAdzunaXml;
