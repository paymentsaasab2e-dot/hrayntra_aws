const { prisma } = require('../../lib/prisma');
const { generateNoteAction } = require('./ai.lms.service');

async function fetchNotes(userId, filters) {
  const { search, type, sourceType, tag } = filters;
  const where = { userId };

  if (search) where.title = { contains: search, mode: 'insensitive' };
  if (type) where.type = type;
  if (sourceType) where.sourceType = sourceType;
  if (tag) where.tags = { has: tag };

  return prisma.lmsNote.findMany({
    where,
    orderBy: { updatedAt: 'desc' }
  });
}

async function fetchRecentNote(userId) {
  const notes = await prisma.lmsNote.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 1
  });
  return notes[0] || null;
}

async function fetchNoteDetail(userId, noteId) {
  return prisma.lmsNote.findUnique({
    where: { id: noteId },
  });
}

async function addNote(userId, payload) {
  const { title, body, type, tags, sourceType, sourceId } = payload;
  return prisma.lmsNote.create({
    data: {
      userId,
      title,
      body,
      type,
      tags: tags || [],
      sourceType,
      sourceId
    }
  });
}

async function editNote(userId, noteId, payload) {
  const { title, body, tags } = payload;
  const note = await fetchNoteDetail(userId, noteId);
  if (!note || note.userId !== userId) throw new Error('Note not found');

  return prisma.lmsNote.update({
    where: { id: noteId },
    data: {
      ...(title !== undefined && { title }),
      ...(body !== undefined && { body }),
      ...(tags !== undefined && { tags })
    }
  });
}

async function removeNote(userId, noteId) {
  const note = await fetchNoteDetail(userId, noteId);
  if (!note || note.userId !== userId) throw new Error('Note not found or unauthorized');

  return prisma.lmsNote.delete({
    where: { id: noteId }
  });
}

async function processAiAction(userId, noteId, action) {
  const note = await fetchNoteDetail(userId, noteId);
  if (!note || note.userId !== userId) throw new Error('Note not found or unauthorized');

  return generateNoteAction(note.body, action);
}

module.exports = {
  fetchNotes,
  fetchRecentNote,
  fetchNoteDetail,
  addNote,
  editNote,
  removeNote,
  processAiAction
};
