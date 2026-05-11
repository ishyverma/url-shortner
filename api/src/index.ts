import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as loggerMiddleware } from "hono/logger";
import { logger } from "./lib/logger";
import { redis } from "./db/redis";
import links from "./routes/links";
import workspaces from "./routes/workspaces";
import analytics from "./routes/analytics";
import redirect from "./routes/redirect";

const app = new Hono();

app.use("*", cors());
app.use("*", loggerMiddleware());

app.get("/", (c) => c.json({ 
  message: "URL Shortener API v1",
  timestamp: new Date().toISOString()
}));

app.get("/health", async (c) => {
  try {
    await redis.ping();
    return c.json({ status: "ok", redis: "connected" });
  } catch {
    return c.json({ status: "error", redis: "disconnected" }, 503);
  }
});

app.route("/api/v1/links", links);
app.route("/api/v1/workspaces", workspaces);
app.route("/api/v1/analytics", analytics);
app.route("/", redirect);

app.notFound((c) => c.json({ error: "Not Found" }, 404));
app.onError((err, c) => {
  if (err instanceof SyntaxError && err.message.includes("JSON")) {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  logger.error(err);
  return c.json({ error: "Internal Server Error" }, 500);
});

const port = parseInt(process.env.PORT || "3002");

logger.info(`Server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};