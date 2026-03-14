import express from 'express';
import router from './routes';

const app = express();
const PORT = parseInt(process.env.PORT || '3002', 10);

app.use(express.json());
app.use(router);

export const server = app.listen(PORT, () => {
  console.log(`[transfer-service] Running on port ${PORT}`);
});

export default app;
