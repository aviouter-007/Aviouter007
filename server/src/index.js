import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { initDb } from './db.js';
import { createRoutes } from './routes.js';
import { setupSockets } from './sockets.js';
import { getGameEngine } from './gameEngine.js';

dotenv.config();

initDb();

const app = express();
const httpServer = createServer(app);
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const corsOrigin = (origin, cb) => {
  if (!origin || origin.startsWith('http://localhost') || origin.startsWith('capacitor://')) {
    return cb(null, true);
  }
  if (origin.startsWith('http://') || origin.startsWith('https://')) {
    return cb(null, true);
  }
  cb(null, true);
};

const io = new Server(httpServer, {
  cors: { origin: corsOrigin, credentials: true },
});

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

app.get('/api/health', (_, res) => res.json({ ok: true, name: 'Aviouter' }));

const routes = createRoutes(io);
app.use('/api', routes);

setupSockets(io);

const engine = getGameEngine(io);
engine.start();

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
httpServer.listen(PORT, HOST, () => {
  console.log(`Aviouter server running on http://${HOST}:${PORT}`);
  console.log('For Android APK: use this PC LAN IP in the app Server settings');
});
// Trigger server restart
