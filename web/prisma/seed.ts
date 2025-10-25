import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  // will put the demo users here 
}

main().finally(() => db.$disconnect());
