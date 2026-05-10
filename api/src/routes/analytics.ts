import { Hono } from "hono";
import { prisma } from "../db/prisma";
import { logger } from "../lib/logger";

const analytics = new Hono();

// GET /api/v1/analytics/:slug - Aggregate stats
analytics.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  try {
    const link = await prisma.link.findUnique({
      where: { slug },
      select: { totalClicks: true, uniqueClicks: true },
    });

    if (!link) {
      return c.json({ error: "Link not found" }, 404);
    }

    return c.json({
      data: {
        totalClicks: link.totalClicks,
        uniqueClicks: link.uniqueClicks,
      },
    });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to fetch analytics" }, 500);
  }
});

// GET /api/v1/analytics/:slug/timeseries - Clicks over time
analytics.get("/:slug/timeseries", async (c) => {
  const slug = c.req.param("slug");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const interval = c.req.query("interval") || "day";

  try {
    const link = await prisma.link.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!link) {
      return c.json({ error: "Link not found" }, 404);
    }

    const bucket = interval === "hour" ? "hour" : "day";

    const events = await prisma.clickEvent.findMany({
      where: {
        linkId: link.id,
        ...(from && { clickedAt: { gte: new Date(from) } }),
        ...(to && { clickedAt: { lte: new Date(to) } }),
      },
      select: {
        clickedAt: true,
      },
      orderBy: { clickedAt: "asc" },
    });

    // Aggregate by interval
    const aggregated = events.reduce((acc, event) => {
      const key = new Date(event.clickedAt).toISOString().split("T")[0];
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const data = Object.entries(aggregated).map(([date, clicks]) => ({
      date,
      clicks,
    }));

    return c.json({ data });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to fetch timeseries" }, 500);
  }
});

// GET /api/v1/analytics/:slug/countries - Geo breakdown
analytics.get("/:slug/countries", async (c) => {
  const slug = c.req.param("slug");

  try {
    const link = await prisma.link.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!link) {
      return c.json({ error: "Link not found" }, 404);
    }

    const data = await prisma.clickEvent.groupBy({
      by: ["country"],
      where: { linkId: link.id, country: { not: null } },
      _count: { country: true },
      orderBy: { _count: { country: "desc" } },
      take: 20,
    });

    return c.json({
      data: data.map((d) => ({
        country: d.country,
        clicks: d._count.country,
      })),
    });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to fetch countries" }, 500);
  }
});

// GET /api/v1/analytics/:slug/devices - Device breakdown
analytics.get("/:slug/devices", async (c) => {
  const slug = c.req.param("slug");

  try {
    const link = await prisma.link.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!link) {
      return c.json({ error: "Link not found" }, 404);
    }

    const data = await prisma.clickEvent.groupBy({
      by: ["device"],
      where: { linkId: link.id, device: { not: null } },
      _count: { device: true },
      orderBy: { _count: { device: "desc" } },
    });

    return c.json({
      data: data.map((d) => ({
        device: d.device,
        clicks: d._count.device,
      })),
    });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to fetch devices" }, 500);
  }
});

// GET /api/v1/analytics/:slug/browsers - Browser breakdown
analytics.get("/:slug/browsers", async (c) => {
  const slug = c.req.param("slug");

  try {
    const link = await prisma.link.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!link) {
      return c.json({ error: "Link not found" }, 404);
    }

    const data = await prisma.clickEvent.groupBy({
      by: ["browser"],
      where: { linkId: link.id, browser: { not: null } },
      _count: { browser: true },
      orderBy: { _count: { browser: "desc" } },
    });

    return c.json({
      data: data.map((d) => ({
        browser: d.browser,
        clicks: d._count.browser,
      })),
    });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to fetch browsers" }, 500);
  }
});

export default analytics;