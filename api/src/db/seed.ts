import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import Pg from "pg";

const { Pool } = Pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create default user
  const user = await prisma.user.upsert({
    where: { email: "default@example.com" },
    update: {},
    create: {
      id: "default-user",
      email: "default@example.com",
      name: "Default User",
    },
  });
  console.log("Created user:", user.id);

  // Create default workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "Default Workspace",
      slug: "default",
      ownerId: user.id,
      apiKey: "default-api-key-" + Date.now(),
    },
  });
  console.log("Created workspace:", workspace.id);

  console.log("Seeding complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());