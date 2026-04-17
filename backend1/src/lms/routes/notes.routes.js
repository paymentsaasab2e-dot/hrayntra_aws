const { Router } = require('express');
const { getNotes, getRecentNote, getNoteDetail, createNote, updateNote, deleteNote, performAiAction } = require('../controllers/notes.controller');
const { validateCreateNote, validateUpdateNote, validateAiAction } = require('../validators/notes.validator');

const router = Router();

router.get('/', getNotes);
router.get('/recent', getRecentNote);
router.get('/:noteId', getNoteDetail);
router.post('/', validateCreateNote, createNote);
router.put('/:noteId', validateUpdateNote, updateNote);
router.delete('/:noteId', deleteNote);
router.post('/:noteId/ai-action', validateAiAction, performAiAction);

module.exports = router;
