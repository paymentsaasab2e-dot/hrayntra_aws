const express = require('express');
const router = express.Router();
const MockInterviewService = require('../services/mockInterviewService');

// Optional auth to link to candidate, else guest
router.post('/start', async (req, res) => {
    try {
        const { topic } = req.body;
        // if using auth middleware: const candidateId = req.user?.id
        // just optional for now
        const candidateId = req.body.candidateId || null;
        if (!topic) return res.status(400).json({ error: "Topic is required" });
        
        const result = await MockInterviewService.startInterview(candidateId, topic);
        res.json(result);
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/next', async (req, res) => {
    try {
        const { interviewId, answerText } = req.body;
        if (!interviewId || !answerText) return res.status(400).json({ error: "Missing required fields" });
        
        const result = await MockInterviewService.nextQuestion(interviewId, answerText);
        res.json(result);
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/result/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await MockInterviewService.getResult(id);
        res.json(result);
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
