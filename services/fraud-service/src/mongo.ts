import { createMongoModule } from '@cn-banking/shared-types';

export const { connectMongo, getDatabase, closeMongo } = createMongoModule();
