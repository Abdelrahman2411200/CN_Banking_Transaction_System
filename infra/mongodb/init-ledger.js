db = db.getSiblingDB('ledger_db');

db.createCollection('ledger');

// Indexes for performance and idempotency
db.ledger.createIndex({ accountId: 1, timestamp: -1 });
db.ledger.createIndex({ "metadata.kafka_partition": 1, "metadata.kafka_offset": 1 }, { unique: true });

console.log('MongoDB Ledger initialized.');
