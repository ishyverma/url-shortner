import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "../db/prisma";
import { redis } from "../db/redis";
import { logger } from "../lib/logger";
import { Prisma } from "@prisma/client";

const links = new Hono();

const createLinkSchema = z.object({
  url: z.string().url(),
  slug: z.string().min(3).max(64).optional(),
  expiresAt: z.string().datetime().optional(),
  password: z.string().optional(),
  tags: z.array(z.string()).optional(),
  domain: z.string().optional(),
});

const updateLinkSchema = z.object({
  url: z.string().url().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  password: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/v1/links - List all links (paginated)
links.get("/", async (c) => {
  let page = parseInt(c.req.query("page") || "1");
  let limit = parseInt(c.req.query("limit") || "20");
  const workspaceId = c.req.query("workspaceId");
  
  if (page < 1) page = 1;
  if (limit < 1) limit = 20;
  if (limit > 100) limit = 100;

  try {
    const where = workspaceId ? { workspaceId } : {};
    
    const [links, total] = await Promise.all([
      prisma.link.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.link.count({ where }),
    ]);

    return c.json({
      data: links,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to fetch links" }, 500);
  }
});

// POST /api/v1/links - Create a new link
links.post("/", async (c) => {
  const body = await c.req.json();
  
  let validated;
  try {
    validated = createLinkSchema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json({ error: err.issues[0]?.message || "Validation error" }, 400);
    }
    return c.json({ error: "Invalid request" }, 400);
  }

  const workspaceId = body.workspaceId;
  const userId = body.userId || "default-user";

  let finalWorkspaceId = workspaceId;
  if (!finalWorkspaceId) {
    let defaultWorkspace = await prisma.workspace.findFirst({ where: { slug: "default" } });
    if (!defaultWorkspace) {
      defaultWorkspace = await prisma.workspace.create({
        data: {
          id: nanoid(),
          name: "Default Workspace",
          slug: "default",
          ownerId: userId,
          apiKey: nanoid(32),
        },
      });
    }
    finalWorkspaceId = defaultWorkspace.id;
  }

  try {
    const slug = validated.slug ? validated.slug.trim() : nanoid(8);
    
    if (!slug || slug.length < 3) {
      return c.json({ error: "Slug must be at least 3 characters" }, 400);
    }
    
    // Check if slug exists
    const existing = await prisma.link.findUnique({ where: { slug } });
    if (existing) {
      return c.json({ error: "Slug already exists" }, 409);
    }

    const link = await prisma.link.create({
      data: {
        id: nanoid(),
        slug,
        originalUrl: validated.url,
        workspaceId: finalWorkspaceId!,
        createdBy: userId || "default-user",
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : undefined,
        password: validated.password,
        tags: validated.tags || [],
        domain: validated.domain || "short.ly",
      },
    });

    const linkData = JSON.stringify({ 
      id: link.id, 
      workspaceId: link.workspaceId, 
      originalUrl: link.originalUrl,
      isActive: link.isActive,
      expiresAt: link.expiresAt?.toISOString() || null
    });
    await redis.setex(`link:${slug}`, 3600, linkData);

    return c.json({ data: link }, 201);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return c.json({ error: "Slug already exists" }, 409);
    }
    logger.error(err);
    return c.json({ error: "Failed to create link" }, 500);
  }
});

// GET /api/v1/links/:slug - Get single link
links.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  try {
    const link = await prisma.link.findUnique({ where: { slug } });
    if (!link) {
      return c.json({ error: "Link not found" }, 404);
    }
    return c.json({ data: link });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to fetch link" }, 500);
  }
});

// PATCH /api/v1/links/:slug - Update link
links.patch("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json();
  
  let validated;
  try {
    validated = updateLinkSchema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json({ error: err.issues[0]?.message || "Validation error" }, 400);
    }
    return c.json({ error: "Invalid request" }, 400);
  }

  try {
    const link = await prisma.link.update({
      where: { slug },
      data: {
        ...(validated.url && { originalUrl: validated.url }),
        ...(validated.expiresAt !== undefined && { expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null }),
        ...(validated.password !== undefined && { password: validated.password }),
        ...(validated.tags && { tags: validated.tags }),
        ...(validated.isActive !== undefined && { isActive: validated.isActive }),
      },
    });

    // Invalidate cache
    await redis.del(`link:${slug}`);

    return c.json({ data: link });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return c.json({ error: "Link not found" }, 404);
    }
    logger.error(err);
    return c.json({ error: "Failed to update link" }, 500);
  }
});

// DELETE /api/v1/links/:slug - Delete link
links.delete("/:slug", async (c) => {
  const slug = c.req.param("slug");

  try {
    const link = await prisma.link.findUnique({ where: { slug } });
    if (!link) {
      return c.json({ error: "Link not found" }, 404);
    }
    await prisma.link.delete({ where: { slug } });
    await redis.del(`link:${slug}`);
    return c.json({ success: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return c.json({ error: "Link not found" }, 404);
    }
    logger.error(err);
    return c.json({ error: "Failed to delete link" }, 500);
  }
});

links.get("/:slug/qr", async (c) => {
  const slug = c.req.param("slug");
  const size = parseInt(c.req.query("size") || "200");
  const format = c.req.query("format") || "png";

  try {
    const link = await prisma.link.findUnique({ where: { slug } });
    if (!link) {
      return c.json({ error: "Link not found" }, 404);
    }

    const QRCode = await import("qrcode");
    const baseUrl = process.env.BASE_URL || "http://localhost:3002";
    const shortUrl = `${baseUrl}/${slug}`;

    let output: string;
    switch (format) {
      case "svg":
        output = await QRCode.toString(shortUrl, { type: "svg", width: Math.min(size, 1000) });
        return c.text(output, 200, { "Content-Type": "image/svg+xml" });
      case "utf8":
        output = await QRCode.toString(shortUrl, { type: "terminal", width: Math.min(Math.floor(size / 8), 50) });
        return c.text(output);
      default:
        const buffer = await QRCode.toBuffer(shortUrl, { 
          width: Math.min(size, 1000),
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" }
        });
        return c.body(new Uint8Array(buffer), 200, {"Content-Type": "image/png"});
    }
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to generate QR code" }, 500);
  }
});

export default links;