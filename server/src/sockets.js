import { v4 as uuid } from 'uuid';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { getGameEngine } from './gameEngine.js';

const JWT_SECRET = process.env.JWT_SECRET || 'aviouter-dev-secret';

function getUserFromSocket(socket) {
  const token = socket.handshake.auth?.token;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function savePrivateMessage(threadUserId, senderRole, senderId, message) {
  const id = uuid();
  const row = {
    id,
    thread_user_id: threadUserId,
    sender_role: senderRole,
    sender_id: senderId,
    message,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO private_chat_messages (id, thread_user_id, sender_role, sender_id, message)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, threadUserId, senderRole, senderId, message);
  return row;
}

export function setupSockets(io) {
  const engine = getGameEngine(io);

  io.on('connection', (socket) => {
    const authUser = getUserFromSocket(socket);
    if (authUser) {
      socket.join(`user:${authUser.id}`);
      socket.join(`private:${authUser.id}`);
      engine.registerViewer(authUser.id);
      if (authUser.role === 'admin') {
        socket.join('admin:dashboard');
        socket.join('admin:support');
      }
    }
    socket.emit('game:state', engine.getState());

    socket.on('disconnect', () => {
      if (authUser) engine.unregisterViewer(authUser.id);
    });

    socket.on('bet:place', (payload, cb) => {
      if (!authUser) return cb?.({ error: 'Login required' });
      const { amount, autoCashout } = payload;
      const result = engine.placeBet(authUser.id, parseInt(amount, 10), autoCashout || null);
      cb?.(result);
    });

    socket.on('bet:cashout', (_, cb) => {
      if (!authUser) return cb?.({ error: 'Login required' });
      const result = engine.cashout(authUser.id);
      cb?.(result);
    });

    socket.on('support:send', (payload, cb) => {
      if (!authUser) return cb?.({ error: 'Login required' });
      const message = (payload?.message || '').trim().slice(0, 500);
      if (!message) return cb?.({ error: 'Empty message' });

      const user = db.prepare('SELECT username, is_blocked FROM users WHERE id = ?').get(authUser.id);
      if (!user || user.is_blocked) return cb?.({ error: 'Cannot send messages' });

      const row = savePrivateMessage(authUser.id, 'user', authUser.id, message);
      io.to(`private:${authUser.id}`).emit('support:message', row);
      io.to('admin:support').emit('support:message', { ...row, username: user.username });
      cb?.({ ok: true });
    });

    socket.on('admin:support:send', (payload, cb) => {
      if (!authUser || authUser.role !== 'admin') return cb?.({ error: 'Admin only' });
      const { userId, message: text } = payload || {};
      const message = (text || '').trim().slice(0, 500);
      if (!userId || !message) return cb?.({ error: 'User and message required' });

      const row = savePrivateMessage(userId, 'admin', authUser.id, message);
      io.to(`private:${userId}`).emit('support:message', row);
      io.to('admin:support').emit('support:message', row);
      cb?.({ ok: true });
    });
  });
}
