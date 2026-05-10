import { beforeStart } from "vitest/setup";
import { spawn } from "bun";
import { resolve } from "path";

const serverPath = resolve(__dirname, "../src/server.ts");

let serverProcess: any;

beforeStart(async () => {
  const proc = spawn(["bun", "run", serverPath], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  
  proc.stdout?.pipeTo?.(new WritableStream({
    write(chunk) {
      process.stdout.write(chunk);
    }
  }));
  
  proc.stderr?.pipeTo?.(new WritableStream({
    write(chunk) {
      process.stderr.write(chunk);
    }
  }));

  await new Promise(r => setTimeout(r, 2000));
  
  globalThis.__serverProcess = proc;
});

after(() => {
  if (globalThis.__serverProcess) {
    globalThis.__serverProcess.kill();
  }
});