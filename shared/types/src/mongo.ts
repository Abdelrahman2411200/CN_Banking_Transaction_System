import { MongoClient } from 'mongodb';

export const createMongoModule = (
  uri = process.env.MONGODB_URI || 'mongodb://localhost:27017',
  dbName = process.env.MONGODB_DB_NAME || 'banking_events'
) => {
  const mongoClient = new MongoClient(uri);
  let connected = false;

  const connectMongo = async (): Promise<void> => {
    if (!connected) {
      await mongoClient.connect();
      connected = true;
    }
  };

  const getDatabase = () => mongoClient.db(dbName);

  const closeMongo = async (): Promise<void> => {
    if (connected) {
      await mongoClient.close();
      connected = false;
    }
  };

  return {
    connectMongo,
    getDatabase,
    closeMongo,
  };
};
