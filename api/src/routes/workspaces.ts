import { Hono } from "hono";
import { prisma } from "../db/prisma";
import { nanoid } from "nanoid";
import { logger } from "../lib/logger";
import { Prisma } from "@prisma/client";

const workspaces = new Hono();

// GET /api/v1/workspaces - List workspaces
workspaces.get("/", async (c) => {
  const userId = c.req.query("userId");

  try {
    const where = userId 
      ? { members: { some: { userId } } }
      : {};

    const data = await prisma.workspace.findMany({
      where,
      include: { members: true },
    });

    return c.json({ data });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to fetch workspaces" }, 500);
  }
});

// POST /api/v1/workspaces - Create workspace
workspaces.post("/", async (c) => {
  const body = await c.req.json();
  const { name, slug, ownerId } = body;

  if (!ownerId) {
    return c.json({ error: "ownerId is required" }, 400);
  }

  try {
    const apiKey = nanoid(32);
    const finalSlug = slug || (name || "workspace").toLowerCase().replace(/\s+/g, "-") + "-" + nanoid(6);
    const finalOwnerId = ownerId || "default-user";

    let user = await prisma.user.findUnique({ where: { id: finalOwnerId } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: finalOwnerId,
          email: `${finalOwnerId}@placeholder.local`,
          name: finalOwnerId,
        },
      }).catch(() => null);
    }

    if (!user) {
      const workspace = await prisma.workspace.create({
        data: {
          id: nanoid(),
          name: name || "My Workspace",
          slug: finalSlug,
          ownerId: finalOwnerId,
          apiKey,
        },
      });

      return c.json({ data: workspace }, 201);
    }

    const workspace = await prisma.workspace.create({
      data: {
        id: nanoid(),
        name: name || "My Workspace",
        slug: finalSlug,
        ownerId: user.id,
        apiKey,
        members: {
          create: {
            userId: user.id,
            role: "owner",
          },
        },
      },
    });

    return c.json({ data: workspace }, 201);
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to create workspace" }, 500);
  }
});

// PATCH /api/v1/workspaces/:id - Update workspace
workspaces.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  try {
    const workspace = await prisma.workspace.update({
      where: { id },
      data: body,
    });

    return c.json({ data: workspace });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return c.json({ error: "Workspace not found" }, 404);
    }
    logger.error(err);
    return c.json({ error: "Failed to update workspace" }, 500);
  }
});

// DELETE /api/v1/workspaces/:id - Delete workspace
workspaces.delete("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    await prisma.workspace.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return c.json({ error: "Workspace not found" }, 404);
    }
    logger.error(err);
    return c.json({ error: "Failed to delete workspace" }, 500);
  }
});

// POST /api/v1/workspaces/:id/members - Invite member
workspaces.post("/:id/members", async (c) => {
  const workspaceId = c.req.param("id");
  const { userId, role } = await c.req.json();

  try {
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@placeholder.local`,
          name: userId,
        },
      }).catch(() => null);
    }

    if (!user) {
      return c.json({ error: "Failed to create user" }, 500);
    }

    const member = await prisma.workspaceMember.create({
      data: {
        id: nanoid(),
        workspaceId,
        userId: user.id,
        role: role || "member",
      },
    });

    return c.json({ data: member }, 201);
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to add member" }, 500);
  }
});

// DELETE /api/v1/workspaces/:id/members/:userId - Remove member
workspaces.delete("/:id/members/:userId", async (c) => {
  const workspaceId = c.req.param("id");
  const userId = c.req.param("userId");

  try {
    await prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    return c.json({ success: true });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to remove member" }, 500);
  }
});

// POST /api/v1/workspaces/:id/api-key/rotate - Rotate API key
workspaces.post("/:id/api-key/rotate", async (c) => {
  const id = c.req.param("id");

  try {
    const newApiKey = nanoid(32);

    const workspace = await prisma.workspace.update({
      where: { id },
      data: { apiKey: newApiKey },
    });

    return c.json({ data: { apiKey: workspace.apiKey } });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to rotate API key" }, 500);
  }
});

export default workspaces;