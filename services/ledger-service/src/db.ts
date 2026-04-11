import { MongoClient, type Db } from 'mongodb';

const url = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME || 'ledger_db';

let db: Db;
let client: MongoClient;

export async function initDb() {
  client = new MongoClient(url);
  await client.connect();
  db = client.db(dbName);
  console.log('Ledger Service connected to MongoDB');
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function getCollection(name: string) {
  return getDb().collection(name);
}
