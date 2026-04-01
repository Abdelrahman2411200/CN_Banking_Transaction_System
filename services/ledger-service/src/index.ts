import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { Decimal128, type Document } from 'mongodb';
import { closeMongo, connectMongo, getDatabase } from './mongo';
import { startLedgerConsumer, stopLedgerConsumer } from './consumer';
import type { LedgerEntryDocument } from './consumer';

const app = express();
const PORT = Number(process.env.LEDGER_SERVICE_PORT || 3003);

const accountIdSchema = z.object({ accountId: z.string().uuid() });
const transferIdSchema = z.object({ transferId: z.string().uuid() });
const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const toNumber = (value: Decimal128): number => Number(value.toString());
const ZERO_DECIMAL = Decimal128.fromString('0');

interface LedgerStatsAggregation extends Document {
  totalDebits: Decimal128;
  totalCredits: Decimal128;
  entryCount: number;
}

app.use(express.json({ limit: '100kb' }));
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = req.header('x-request-id') || randomUUID();
  res.setHeader('x-request-id', requestId);
  next();
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { status: 'ok' } });
});

app.get('/v1/ledger/:accountId', async (req: Request, res: Response) => {
  const params = accountIdSchema.safeParse(req.params);
  const query = listQuerySchema.safeParse(req.query);

  if (!params.success || !query.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid ledger query' },
    });
  }

  const { page, limit, from, to } = query.data;
  const filter: Record<string, unknown> = { accountId: params.data.accountId };

  if (from || to) {
    filter.createdAt = {};
    if (from) {
      (filter.createdAt as Record<string, unknown>).$gte = new Date(from);
    }
    if (to) {
      (filter.createdAt as Record<string, unknown>).$lte = new Date(to);
    }
  }

  const entries = await getDatabase()
    .collection<LedgerEntryDocument>('ledger_entries')
    .find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return res.status(200).json({ success: true, data: entries });
});

app.get('/v1/ledger/transfer/:transferId', async (req: Request, res: Response) => {
  const params = transferIdSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid transfer id' },
    });
  }

  const entries = await getDatabase()
    .collection<LedgerEntryDocument>('ledger_entries')
    .find({ transferId: params.data.transferId })
    .sort({ createdAt: 1 })
    .toArray();

  return res.status(200).json({ success: true, data: entries });
});

app.get('/v1/ledger/stats/:accountId', async (req: Request, res: Response) => {
  const params = accountIdSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid account id' },
    });
  }

  const [stats] = await getDatabase()
    .collection<LedgerEntryDocument>('ledger_entries')
    .aggregate<LedgerStatsAggregation>([
      { $match: { accountId: params.data.accountId } },
      {
        $group: {
          _id: null,
          totalDebits: {
            $sum: {
              $cond: [{ $eq: ['$entryType', 'debit'] }, '$amount', ZERO_DECIMAL],
            },
          },
          totalCredits: {
            $sum: {
              $cond: [{ $eq: ['$entryType', 'credit'] }, '$amount', ZERO_DECIMAL],
            },
          },
          entryCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          totalDebits: 1,
          totalCredits: 1,
          entryCount: 1,
        },
      },
    ])
    .toArray();

  const totalDebits = stats ? toNumber(stats.totalDebits) : 0;
  const totalCredits = stats ? toNumber(stats.totalCredits) : 0;

  return res.status(200).json({
    success: true,
    data: {
      totalDebits,
      totalCredits,
      net: totalCredits - totalDebits,
      entryCount: stats?.entryCount || 0,
    },
  });
});

const startServer = (): Server =>
  app.listen(PORT, () => {
    console.log(`Ledger Service listening on port ${PORT}`);
  });

const shutdown = (server: Server, signal: string): void => {
  console.log(`${signal} received, shutting down ledger-service`);
  server.close(async () => {
    await stopLedgerConsumer();
    await closeMongo();
    process.exit(0);
  });
};

if (require.main === module) {
  void connectMongo()
    .then(async () => {
      await startLedgerConsumer();
      const server = startServer();
      process.on('SIGTERM', () => shutdown(server, 'SIGTERM'));
      process.on('SIGINT', () => shutdown(server, 'SIGINT'));
    })
    .catch((error: unknown) => {
      console.error('Failed to bootstrap ledger-service', error);
      process.exit(1);
    });
}

export { app, startServer };
