import express from 'express';
import router from './routes';

const app = express();
const port = Number(process.env.TRANSFER_SERVICE_PORT ?? process.env.PORT ?? 3002);

app.use(express.json());
app.use(router);

export const server = app.listen(port, () => {
  console.log(`[transfer-service] running on ${port}`);
});

export default app;
