import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { prisma } from "./prisma";
import { logger } from "../lib/logger";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const clickQueue = new Queue("clicks", { connection });

export interface ClickData {
  slug: string;
  linkId: string;
  workspaceId: string;
  visitorHash: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: string;
  longitude?: string;
  device?: string;
  os?: string;
  browser?: string;
  browserVersion?: string;
  referrer?: string;
  refDomain?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

export async function enqueueClick(data: ClickData): Promise<void> {
  await clickQueue.add("click", data, {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  });
}

export function startClickWorker(): Worker {
  const worker = new Worker(
    "clicks",
    async (job: Job<ClickData>) => {
      const data = job.data;

      try {
        const link = await prisma.link.findUnique({ where: { id: data.linkId } });
        if (!link || !link.isActive) {
          logger.debug({ slug: data.slug }, "Link not found or inactive, skipping click");
          return;
        }

        await prisma.clickEvent.create({
          data: {
            id: crypto.randomUUID(),
            linkId: data.linkId,
            workspaceId: data.workspaceId,
            visitorHash: data.visitorHash,
            country: data.country,
            region: data.region,
            city: data.city,
            latitude: data.latitude,
            longitude: data.longitude,
            device: data.device,
            os: data.os,
            browser: data.browser,
            browserVersion: data.browserVersion,
            referrer: data.referrer,
            refDomain: data.refDomain,
            utmSource: data.utmSource,
            utmMedium: data.utmMedium,
            utmCampaign: data.utmCampaign,
            utmTerm: data.utmTerm,
            utmContent: data.utmContent,
          },
        });

        await prisma.link.update({
          where: { id: data.linkId },
          data: { totalClicks: { increment: 1 } },
        });

        logger.debug(`Recorded click for slug: ${data.slug}`);
      } catch (err) {
        logger.error({ err, slug: data.slug }, "Failed to record click");
      }
    },
    { connection, concurrency: 10 }
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Click job failed");
  });

  return worker;
}