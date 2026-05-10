import { beforeAll, afterAll } from "vitest";

declare global {
  var __serverProcess: { kill: () => void } | undefined;
}

let serverProcess: { kill: () => void } | undefined;

beforeAll(async () => {
  const { spawn } = await import("child_process");
  const path = await import("path");
  
  const serverPath = path.join(process.cwd(), "src", "server.ts");
  
  serverProcess = spawn("bun", ["run", serverPath], {
    stdio: "ignore",
    detached: true,
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  globalThis.__serverProcess = serverProcess;
});

afterAll(() => {
  if (globalThis.__serverProcess) {
    globalThis.__serverProcess.kill();
  }
});