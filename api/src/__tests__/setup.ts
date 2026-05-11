import { beforeAll, afterAll } from "vitest";
import { spawn } from "child_process";

let serverProcess: ReturnType<typeof spawn> | undefined;

export async function waitForServer(url: string, maxRetries = 20, delay = 500): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) {
        return true;
      }
    } catch {
      // server not ready yet
    }
    await new Promise(r => setTimeout(r, delay));
  }
  return false;
}

beforeAll(async () => {
  const serverPath = "./src/server.ts";
  const port = process.env.PORT || "3002";
  const serverUrl = `http://localhost:${port}`;

  serverProcess = spawn("bun", ["run", serverPath], {
    stdio: "pipe",
    env: { ...process.env },
  });

  const ready = await waitForServer(serverUrl);
  if (!ready) {
    throw new Error("Server failed to start");
  }
});

afterAll(() => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = undefined;
  }
});