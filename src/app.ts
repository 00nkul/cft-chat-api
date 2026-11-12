import path from 'node:path';
import express from 'express';
import { errorHandler } from './middleware/errorHandler';
import { chatRouter } from './routes/chat.routes';
import { userRouter } from './routes/user.routes';

export function createApp() {
  const app = express();
  app.use(express.json());

  app.use(express.static(path.join(process.cwd(), 'public')));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/chat', chatRouter);
  app.use('/user', userRouter);

  app.use(errorHandler);
  return app;
}
