import express from 'express';
import router from './routes';

const app = express();
const port = Number(process.env.ACCOUNT_SERVICE_PORT ?? process.env.PORT ?? 3001);

app.use(express.json());
app.use(router);

export const server = app.listen(port, () => {
  console.log(`[account-service] running on ${port}`);
});

export default app;
