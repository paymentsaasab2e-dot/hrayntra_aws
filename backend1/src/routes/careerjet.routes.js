const express = require('express');
const { prisma } = require('../lib/prisma');
const { generateCareerjetFeed } = require('../services/careerjet/feed.service');

const router = express.Router();

async function sendCareerjetXml(req, res) {
  try {
    const { xml } = await generateCareerjetFeed(prisma);
    res.setHeader('Content-Type', 'application/xml; charset=UTF-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(xml);
  } catch (error) {
    console.error('[careerjet-feed] endpoint failed:', error?.message || error);
    return res.status(500).type('text/plain; charset=UTF-8').send('Failed to build Careerjet feed');
  }
}

router.get('/jobs.xml', sendCareerjetXml);

module.exports = router;
module.exports.sendCareerjetXml = sendCareerjetXml;
