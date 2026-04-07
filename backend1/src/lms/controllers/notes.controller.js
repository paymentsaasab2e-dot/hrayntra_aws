const notesService = require('../services/notes.service');
const { sendSuccess, sendError, sendNotFound } = require('../lms.response.helper');

async function getNotes(req, res) {
  try {
    const notes = await notesService.fetchNotes(req.user.id, req.query);
    return sendSuccess(res, notes);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getRecentNote(req, res) {
  try {
    const note = await notesService.fetchRecentNote(req.user.id);
    if (!note) return sendSuccess(res, null); // Return null gently
    return sendSuccess(res, note);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getNoteDetail(req, res) {
  try {
    const note = await notesService.fetchNoteDetail(req.user.id, req.params.noteId);
    if (!note) return sendNotFound(res, 'Note not found');
    return sendSuccess(res, note);
  } catch (error) {
    return sendError(res, error);
  }
}

async function createNote(req, res) {
  try {
    const note = await notesService.addNote(req.user.id, req.body);
    return sendSuccess(res, note, 'Note created');
  } catch (error) {
    return sendError(res, error);
  }
}

async function updateNote(req, res) {
  try {
    const note = await notesService.editNote(req.user.id, req.params.noteId, req.body);
    return sendSuccess(res, note, 'Note updated');
  } catch (error) {
    return sendError(res, error);
  }
}

async function deleteNote(req, res) {
  try {
    await notesService.removeNote(req.user.id, req.params.noteId);
    return sendSuccess(res, null, 'Note deleted');
  } catch (error) {
    return sendError(res, error);
  }
}

async function performAiAction(req, res) {
  try {
    const result = await notesService.processAiAction(req.user.id, req.params.noteId, req.body.action);
    return sendSuccess(res, { content: result });
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  getNotes,
  getRecentNote,
  getNoteDetail,
  createNote,
  updateNote,
  deleteNote,
  performAiAction
};
