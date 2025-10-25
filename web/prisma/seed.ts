// import { PrismaClient } from "@prisma/client";
// const db = new PrismaClient();

// async function main() {
//   // will put the demo users here 
// }

// main().finally(() => db.$disconnect());

// lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
