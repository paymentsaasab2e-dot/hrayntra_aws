const ROOM_EVENT = {
  JOIN: 'interview-room:join',
  JOINED: 'interview-room:joined',
  JOIN_ERROR: 'interview-room:join-error',
  PARTICIPANT_JOINED: 'interview-room:participant-joined',
  PARTICIPANT_LEFT: 'interview-room:participant-left',
  SIGNAL: 'interview-room:signal',
  CHAT_MESSAGE: 'interview-room:chat-message',
  NOTES_UPDATED: 'interview-room:notes-updated',
  NOTES_UPDATE: 'interview-room:notes-update',
  COMPLETE: 'interview-room:complete',
  MEETING_COMPLETED: 'interview-room:meeting-completed',
};

const { getLiveBundle, saveLiveNotes, appendLiveMessage } = require('../services/interviewLive.service');

const MAX_ROOM_PARTICIPANTS = 2;
const rooms = new Map();

function normalizeRoomId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function getRoomParticipants(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.entries()).map(([socketId, participant]) => ({
    socketId,
    displayName: participant.displayName,
    role: participant.role,
    joinedAt: participant.joinedAt,
  }));
}

function removeParticipant(socket) {
  const joinedRoomId = socket.data?.interviewRoomId;
  if (!joinedRoomId) return;

  const room = rooms.get(joinedRoomId);
  if (!room) return;

  room.delete(socket.id);
  socket.to(joinedRoomId).emit(ROOM_EVENT.PARTICIPANT_LEFT, { socketId: socket.id });

  if (room.size === 0) {
    rooms.delete(joinedRoomId);
  }
}

function registerInterviewRoomSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.on(ROOM_EVENT.JOIN, (payload = {}) => {
      const roomId = normalizeRoomId(payload.roomId);
      if (!roomId) {
        socket.emit(ROOM_EVENT.JOIN_ERROR, { message: 'Invalid room ID.' });
        return;
      }

      removeParticipant(socket);

      const displayName = String(payload.displayName || 'Participant').trim().slice(0, 80);
      const role = String(payload.role || 'guest').trim().toLowerCase();

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
      }

      const room = rooms.get(roomId);
      for (const [id] of room) {
        if (!io.sockets.sockets.get(id)) {
          room.delete(id);
        }
      }
      if (room.size >= MAX_ROOM_PARTICIPANTS) {
        socket.emit(ROOM_EVENT.JOIN_ERROR, { message: 'Room is full. Only 2 participants are allowed.' });
        return;
      }

      socket.join(roomId);
      socket.data.interviewRoomId = roomId;
      room.set(socket.id, {
        displayName: displayName || 'Participant',
        role,
        joinedAt: new Date().toISOString(),
      });

      const otherParticipants = getRoomParticipants(roomId).filter((item) => item.socketId !== socket.id);
      getLiveBundle(roomId)
        .then((bundle) => {
          socket.emit(ROOM_EVENT.JOINED, {
            roomId,
            selfSocketId: socket.id,
            participants: otherParticipants,
            notes: bundle.notes || '',
            messages: bundle.messages || [],
          });
        })
        .catch(() => {
          socket.emit(ROOM_EVENT.JOINED, {
            roomId,
            selfSocketId: socket.id,
            participants: otherParticipants,
            notes: '',
            messages: [],
          });
        });

      socket.to(roomId).emit(ROOM_EVENT.PARTICIPANT_JOINED, {
        socketId: socket.id,
        displayName: displayName || 'Participant',
        role,
      });
    });

    socket.on(ROOM_EVENT.SIGNAL, (payload = {}) => {
      const joinedRoomId = socket.data?.interviewRoomId;
      if (!joinedRoomId) return;

      const targetSocketId = String(payload.to || '').trim();
      if (!targetSocketId) return;

      io.to(targetSocketId).emit(ROOM_EVENT.SIGNAL, {
        from: socket.id,
        description: payload.description || null,
        candidate: payload.candidate || null,
      });
    });

    socket.on(ROOM_EVENT.CHAT_MESSAGE, (payload = {}) => {
      const joinedRoomId = socket.data?.interviewRoomId;
      if (!joinedRoomId) return;

      const message = String(payload.message || '').trim();
      if (!message) return;

      const chatPayload = {
        socketId: socket.id,
        displayName: String(payload.displayName || 'Participant').trim().slice(0, 80) || 'Participant',
        role: String(payload.role || 'guest').trim().toLowerCase() || 'guest',
        message: message.slice(0, 1000),
        createdAt: new Date().toISOString(),
      };

      io.to(joinedRoomId).emit(ROOM_EVENT.CHAT_MESSAGE, chatPayload);
      appendLiveMessage(joinedRoomId, chatPayload).catch((error) => {
        console.warn('[interview-room] failed to persist chat:', error?.message || error);
      });
    });

    socket.on(ROOM_EVENT.NOTES_UPDATE, (payload = {}) => {
      const joinedRoomId = socket.data?.interviewRoomId;
      if (!joinedRoomId) return;
      const notes = String(payload.notes || '').slice(0, 20000);
      io.to(joinedRoomId).emit(ROOM_EVENT.NOTES_UPDATED, {
        notes,
        updatedBy: String(payload.displayName || 'Participant').trim().slice(0, 80) || 'Participant',
        updatedAt: new Date().toISOString(),
      });
      saveLiveNotes(joinedRoomId, notes).catch((error) => {
        console.warn('[interview-room] failed to persist notes:', error?.message || error);
      });
    });

    socket.on(ROOM_EVENT.COMPLETE, (payload = {}) => {
      const joinedRoomId = socket.data?.interviewRoomId;
      if (!joinedRoomId) return;
      io.to(joinedRoomId).emit(ROOM_EVENT.MEETING_COMPLETED, {
        roomId: joinedRoomId,
        completedBy: String(payload.displayName || 'Participant').trim().slice(0, 80) || 'Participant',
        completedAt: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      removeParticipant(socket);
    });
  });
}

module.exports = {
  registerInterviewRoomSocketHandlers,
};
