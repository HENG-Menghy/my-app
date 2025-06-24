//  /prisma/seed.ts

import prisma from "@/lib/db/prisma";
import z from "zod";

async function main() {}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });