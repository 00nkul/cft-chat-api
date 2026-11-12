import { createApp } from './app';
import { env } from './config/env';
import './config/firestore';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Chat API listening on http://localhost:${env.PORT}`);
});
