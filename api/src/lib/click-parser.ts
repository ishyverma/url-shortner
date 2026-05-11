import { Context } from "hono";
import crypto from "crypto";
import { UAParser } from "ua-parser-js";
import geoip from "geoip-lite";

export interface ClickMetadata {
  visitorHash: string;
  device?: string;
  os?: string;
  browser?: string;
  browserVersion?: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: string;
  longitude?: string;
  referrer?: string;
  refDomain?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  isBot?: number;
}

function parseUserAgent(ua: string): { 
  device: string; 
  os: string; 
  browser: string; 
  browserVersion: string;
  isBot: number;
} {
  const parser = new UAParser(ua);
  const result = parser.getResult();
  
  const isBot = /bot|crawl|spider|slurp|bingbot|googlebot|yandex/i.test(ua) ? 1 : 0;
  
  const device = result.device.type || (isBot ? "bot" : "desktop");
  const os = result.os.name ? `${result.os.name} ${result.os.version || ""}`.trim() : "unknown";
  const browser = result.browser.name || "unknown";
  const browserVersion = result.browser.version || "";

  return { device, os, browser, browserVersion, isBot };
}

function getGeoLocation(ip: string): { 
  country?: string; 
  region?: string; 
  city?: string;
  latitude?: string;
  longitude?: string;
} {
  try {
    // Skip private/local IPs
    if (ip === "unknown" || ip.startsWith("127.") || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      return {};
    }
    
    const geo = geoip.lookup(ip);
    if (geo) {
      return {
        country: geo.country,
        region: geo.region,
        city: geo.city,
        latitude: geo.ll[0]?.toString(),
        longitude: geo.ll[1]?.toString(),
      };
    }
  } catch {
    // Geo lookup failed, return empty
  }
  return {};
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function hashVisitor(ip: string, userAgent: string): string {
  const data = `${ip}-${userAgent}`;
  return crypto.createHash("sha256").update(data).digest("hex").substring(0, 16);
}

export function parseClickContext(c: Context): ClickMetadata {
  const ua = c.req.header("user-agent") || "";
  const referer = c.req.header("referer") || "";
  const forwarded = c.req.header("x-forwarded-for") || "";
  const cfIP = c.req.header("cf-connecting-ip") || "";
  const realIP = c.req.header("x-real-ip") || "";
  
  const ip = cfIP || forwarded.split(",")[0].trim() || realIP || "unknown";

  const { device, os, browser, browserVersion, isBot } = parseUserAgent(ua);
  const geo = getGeoLocation(ip);

  let utmSource: string | undefined;
  let utmMedium: string | undefined;
  let utmCampaign: string | undefined;
  let utmTerm: string | undefined;
  let utmContent: string | undefined;

  if (referer) {
    try {
      const url = new URL(referer);
      const params = url.searchParams;
      utmSource = params.get("utm_source") || undefined;
      utmMedium = params.get("utm_medium") || undefined;
      utmCampaign = params.get("utm_campaign") || undefined;
      utmTerm = params.get("utm_term") || undefined;
      utmContent = params.get("utm_content") || undefined;
    } catch {
      // Invalid URL, ignore params
    }
  }

  return {
    visitorHash: hashVisitor(ip, ua),
    device,
    os,
    browser,
    browserVersion,
    ...geo,
    referrer: referer || undefined,
    refDomain: referer ? extractDomain(referer) : undefined,
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent,
    isBot,
  };
}