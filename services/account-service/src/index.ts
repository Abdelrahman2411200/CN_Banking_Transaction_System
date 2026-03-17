import express from 'express';
import { router } from './routes';

const app = express();
const PORT = process.env.ACCOUNT_SERVICE_PORT || 3001;

// Middleware
app.use(express.json());

// Routes
app.use('/v1', router);

// Health endpoint at root
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: 'ok' },
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Account Service listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export { app };
