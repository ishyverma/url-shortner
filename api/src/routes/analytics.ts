import { Hono } from "hono";
import { prisma } from "../db/prisma";
import { logger } from "../lib/logger";
import { QueryResult } from "pg";

interface AggregatedStats {
  totalClicks: number;
  uniqueClicks: number;
  topCountries: { country: string; clicks: number }[];
  topDevices: { device: string; clicks: number }[];
  topBrowsers: { browser: string; clicks: number }[];
  topReferrers: { refDomain: string; clicks: number }[];
  last24hClicks: number;
  last7dClicks: number;
  last30dClicks: number;
}

interface TimeseriesPoint {
  timestamp: string;
  clicks: number;
  uniqueVisitors: number;
}

const analytics = new Hono();

async function checkTimescaleAvailable(): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<[{ exists: boolean }]>`
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
      ) AS exists
    `;
    return result[0]?.exists ?? false;
  } catch {
    return false;
  }
}

async function getTimescaleStats(linkId: string): Promise<Partial<AggregatedStats>> {
  try {
    const isTimescale = await checkTimescaleAvailable();
    if (!isTimescale) return {};

    const result = await prisma.$queryRawUnsafe(
      `SELECT
        COALESCE(SUM(CASE WHEN bucket >= NOW() - INTERVAL '24 hours' THEN total_clicks ELSE 0 END), 0)::bigint AS last24h,
        COALESCE(SUM(CASE WHEN bucket >= NOW() - INTERVAL '7 days' THEN total_clicks ELSE 0 END), 0)::bigint AS last7d,
        COALESCE(SUM(total_clicks), 0)::bigint AS last30d
      FROM click_stats_daily
      WHERE linkId = $1`,
      linkId
    ) as { last24h: bigint; last7d: bigint; last30d: bigint }[];

    if (result.length === 0) return {};

    return {
      last24hClicks: Number(result[0].last24h),
      last7dClicks: Number(result[0].last7d),
      last30dClicks: Number(result[0].last30d),
    };
  } catch (err) {
    logger.debug({ err }, "TimescaleDB stats not available, using fallback");
    return {};
  }
}

analytics.get("/:slug/stats", async (c) => {
  const slug = c.req.param("slug");

  try {
    const link = await prisma.link.findUnique({
      where: { slug },
      select: { id: true, totalClicks: true, uniqueClicks: true },
    });

    if (!link) {
      return c.json({ error: "Link not found" }, 404);
    }

    const [timescaleStats, countries, devices, browsers, referrers] = await Promise.all([
      getTimescaleStats(link.id),
      prisma.clickEvent.groupBy({
        by: ["country"],
        where: { linkId: link.id, country: { not: null } },
        _count: { country: true },
        orderBy: { _count: { country: "desc" } },
        take: 10,
      }),
      prisma.clickEvent.groupBy({
        by: ["device"],
        where: { linkId: link.id, device: { not: null } },
        _count: { device: true },
        orderBy: { _count: { device: "desc" } },
        take: 10,
      }),
      prisma.clickEvent.groupBy({
        by: ["browser"],
        where: { linkId: link.id, browser: { not: null } },
        _count: { browser: true },
        orderBy: { _count: { browser: "desc" } },
        take: 10,
      }),
      prisma.clickEvent.groupBy({
        by: ["refDomain"],
        where: { linkId: link.id, refDomain: { not: null } },
        _count: { refDomain: true },
        orderBy: { _count: { refDomain: "desc" } },
        take: 10,
      }),
    ]);

    return c.json({
      data: {
        totalClicks: link.totalClicks,
        uniqueClicks: link.uniqueClicks,
        ...timescaleStats,
        topCountries: countries.map(d => ({ country: d.country || "Unknown", clicks: d._count.country })),
        topDevices: devices.map(d => ({ device: d.device || "Unknown", clicks: d._count.device })),
        topBrowsers: browsers.map(d => ({ browser: d.browser || "Unknown", clicks: d._count.browser })),
        topReferrers: referrers.map(d => ({ refDomain: d.refDomain || "Direct", clicks: d._count.refDomain })),
      },
    });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to fetch stats" }, 500);
  }
});

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

analytics.get("/:slug/timeseries", async (c) => {
  const slug = c.req.param("slug");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const interval = c.req.query("interval") || "day";
  const groupBy = c.req.query("groupBy") || "clicks";

  try {
    const link = await prisma.link.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!link) {
      return c.json({ error: "Link not found" }, 404);
    }

    let truncateUnit: string;
    if (interval === "hour") {
      truncateUnit = "hour";
    } else if (interval === "week") {
      truncateUnit = "week";
    } else {
      truncateUnit = "day";
    }

    let events: { bucket: Date; clicks: bigint; unique: bigint }[];
    if (from && to) {
      events = await prisma.$queryRawUnsafe(
        `SELECT DATE_TRUNC('${truncateUnit}', "clickedAt") AS bucket, COUNT(*)::bigint AS clicks, COUNT(DISTINCT "visitorHash")::bigint AS unique FROM "ClickEvent" WHERE "linkId" = $1 AND "clickedAt" >= $2 AND "clickedAt" <= $3 GROUP BY bucket ORDER BY bucket ASC`,
        link.id, new Date(from), new Date(to)
      ) as typeof events;
    } else {
      events = await prisma.$queryRawUnsafe(
        `SELECT DATE_TRUNC('${truncateUnit}', "clickedAt") AS bucket, COUNT(*)::bigint AS clicks, COUNT(DISTINCT "visitorHash")::bigint AS unique FROM "ClickEvent" WHERE "linkId" = $1 GROUP BY bucket ORDER BY bucket ASC`,
        link.id
      ) as typeof events;
    }

    const data: TimeseriesPoint[] = events.map(e => ({
      timestamp: e.bucket.toISOString(),
      clicks: Number(e.clicks),
      uniqueVisitors: Number(e.unique),
    }));

    return c.json({ data, interval, groupBy, source: "raw_query" });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to fetch timeseries" }, 500);
  }
});

analytics.get("/:slug/countries", async (c) => {
  const slug = c.req.param("slug");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);

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
      where: { 
        linkId: link.id,
        country: { not: null },
      },
      _count: { country: true },
      orderBy: { _count: { country: "desc" } },
      take: limit,
    });

    const unknownCount = await prisma.clickEvent.count({
      where: { 
        linkId: link.id,
        OR: [
          { country: null },
          { country: "" },
        ],
      },
    });

    const total = data.reduce((sum, d) => sum + d._count.country, 0) + unknownCount;

    const responseData = data.map(d => ({
      country: d.country,
      clicks: d._count.country,
      percentage: total > 0 ? Math.round((d._count.country / total) * 10000) / 100 : 0,
    }));

    if (unknownCount > 0) {
      responseData.push({
        country: "Unknown",
        clicks: unknownCount,
        percentage: total > 0 ? Math.round((unknownCount / total) * 10000) / 100 : 0,
      });
    }

    return c.json({ data: responseData });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to fetch countries" }, 500);
  }
});

analytics.get("/:slug/devices", async (c) => {
  const slug = c.req.param("slug");
  const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);

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
      take: limit,
    });

    const total = data.reduce((sum, d) => sum + d._count.device, 0);

    return c.json({
      data: data.map(d => ({
        device: d.device || "Unknown",
        clicks: d._count.device,
        percentage: total > 0 ? Math.round((d._count.device / total) * 10000) / 100 : 0,
      })),
    });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to fetch devices" }, 500);
  }
});

analytics.get("/:slug/browsers", async (c) => {
  const slug = c.req.param("slug");
  const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);

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
      take: limit,
    });

    const total = data.reduce((sum, d) => sum + d._count.browser, 0);

    return c.json({
      data: data.map(d => ({
        browser: d.browser || "Unknown",
        clicks: d._count.browser,
        percentage: total > 0 ? Math.round((d._count.browser / total) * 10000) / 100 : 0,
      })),
    });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to fetch browsers" }, 500);
  }
});

analytics.get("/:slug/os", async (c) => {
  const slug = c.req.param("slug");
  const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);

  try {
    const link = await prisma.link.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!link) {
      return c.json({ error: "Link not found" }, 404);
    }

    const data = await prisma.clickEvent.groupBy({
      by: ["os"],
      where: { linkId: link.id, os: { not: null } },
      _count: { os: true },
      orderBy: { _count: { os: "desc" } },
      take: limit,
    });

    const total = data.reduce((sum, d) => sum + d._count.os, 0);

    return c.json({
      data: data.map(d => ({
        os: d.os || "Unknown",
        clicks: d._count.os,
        percentage: total > 0 ? Math.round((d._count.os / total) * 10000) / 100 : 0,
      })),
    });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to fetch OS stats" }, 500);
  }
});

analytics.get("/:slug/referrers", async (c) => {
  const slug = c.req.param("slug");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);

  try {
    const link = await prisma.link.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!link) {
      return c.json({ error: "Link not found" }, 404);
    }

    const data = await prisma.clickEvent.groupBy({
      by: ["refDomain"],
      where: { linkId: link.id, refDomain: { not: null } },
      _count: { refDomain: true },
      orderBy: { _count: { refDomain: "desc" } },
      take: limit,
    });

    return c.json({
      data: data.map(d => ({
        refDomain: d.refDomain || "Unknown",
        clicks: d._count.refDomain,
      })),
    });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to fetch referrers" }, 500);
  }
});

analytics.get("/:slug/utm", async (c) => {
  const slug = c.req.param("slug");
  const source = c.req.query("source");

  try {
    const link = await prisma.link.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!link) {
      return c.json({ error: "Link not found" }, 404);
    }

    const whereClause: { linkId: string; utmSource?: { not: null } | string } = { linkId: link.id };
    if (source) {
      whereClause.utmSource = source;
    } else {
      whereClause.utmSource = { not: null };
    }

    const [utmSources, utmMediums, utmCampaigns] = await Promise.all([
      prisma.clickEvent.groupBy({
        by: ["utmSource"],
        where: { linkId: link.id, utmSource: { not: null } },
        _count: { utmSource: true },
        orderBy: { _count: { utmSource: "desc" } },
        take: 20,
      }),
      prisma.clickEvent.groupBy({
        by: ["utmMedium"],
        where: { linkId: link.id, utmMedium: { not: null } },
        _count: { utmMedium: true },
        orderBy: { _count: { utmMedium: "desc" } },
        take: 20,
      }),
      prisma.clickEvent.groupBy({
        by: ["utmCampaign"],
        where: { linkId: link.id, utmCampaign: { not: null } },
        _count: { utmCampaign: true },
        orderBy: { _count: { utmCampaign: "desc" } },
        take: 20,
      }),
    ]);

    return c.json({
      data: {
        bySource: utmSources.map(d => ({ source: d.utmSource || "Unknown", clicks: d._count.utmSource })),
        byMedium: utmMediums.map(d => ({ medium: d.utmMedium || "Unknown", clicks: d._count.utmMedium })),
        byCampaign: utmCampaigns.map(d => ({ campaign: d.utmCampaign || "Unknown", clicks: d._count.utmCampaign })),
      },
    });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to fetch UTM stats" }, 500);
  }
});

analytics.get("/workspace/:workspaceId", async (c) => {
  const workspaceId = c.req.param("workspaceId");
  const period = c.req.query("period") || "7d";
  const limit = Math.min(parseInt(c.req.query("limit") || "10"), 100);

  try {
    const since = period === "24h" 
      ? new Date(Date.now() - 86400000)
      : period === "30d"
      ? new Date(Date.now() - 30 * 86400000)
      : new Date(Date.now() - 7 * 86400000);

    const [links, totalStats] = await Promise.all([
      prisma.link.findMany({
        where: { workspaceId },
        select: {
          id: true,
          slug: true,
          originalUrl: true,
          totalClicks: true,
          uniqueClicks: true,
          createdAt: true,
        },
        orderBy: { totalClicks: "desc" },
        take: limit,
      }),
      prisma.clickEvent.aggregate({
        where: {
          workspaceId,
          clickedAt: { gte: since },
        },
        _count: { id: true },
      }),
    ]);

    return c.json({
      data: {
        topLinks: links,
        period,
        totalClicks: totalStats._count.id,
        linksCount: links.length,
      },
    });
  } catch (err) {
    logger.error(err);
    return c.json({ error: "Failed to fetch workspace analytics" }, 500);
  }
});

export default analytics;