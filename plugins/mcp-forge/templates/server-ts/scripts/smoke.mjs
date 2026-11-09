// End-to-end smoke test: spawns the built server and speaks JSON-RPC over stdio.
// Usage: npm run build && node scripts/smoke.mjs
// Reads only by default. TODO(mcp-forge): add a real read tools/call for this API.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn(process.execPath, [path.join(root, "dist", "index.js")], {
  cwd: root,
  stdio: ["pipe", "pipe", "inherit"],
});

let buf = "";
const pending = new Map();
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

let nextId = 1;
function request(method, params) {
  const id = nextId++;
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 20000);
    pending.set(id, (m) => {
      clearTimeout(t);
      m.error ? reject(new Error(`${method}: ${JSON.stringify(m.error)}`)) : resolve(m.result);
    });
  });
}

try {
  const init = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0.0.1" },
  });
  console.log("initialize ->", init.serverInfo);
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  const list = await request("tools/list", {});
  console.log("tools/list ->", list.tools.map((t) => t.name));
  console.log("SMOKE OK");
  child.kill();
  process.exit(0);
} catch (err) {
  console.error("SMOKE FAILED:", err.message);
  child.kill();
  process.exit(1);
}
