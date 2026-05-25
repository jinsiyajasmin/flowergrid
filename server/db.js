import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const connectDB = async () => {
  await prisma.$connect();
  console.log('✅ PostgreSQL connected');
};

export { prisma };
export default connectDB;
