// Real end-to-end smoke test: spawns the built server and speaks JSON-RPC over stdio.
// Usage: npm run build && node scripts/smoke.mjs
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
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}
function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

try {
  const init = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0.0.1" },
  });
  console.log("initialize ->", init.serverInfo, "protocol", init.protocolVersion);
  notify("notifications/initialized", {});

  const list = await request("tools/list", {});
  const names = list.tools.map((t) => t.name);
  console.log("tools/list ->", names);
  assert(names.includes("geocode") && names.includes("get_forecast"), "expected both tools");

  const geo = await request("tools/call", { name: "geocode", arguments: { name: "Lisbon", count: 1 } });
  assert(!geo.isError, "geocode returned isError: " + geo.content?.[0]?.text);
  const geoData = JSON.parse(geo.content[0].text);
  const top = geoData.results[0];
  console.log("tools/call geocode(Lisbon) ->", top);
  assert(top && Math.abs(top.latitude - 38.7) < 0.5, "Lisbon latitude ~38.7");

  const fc = await request("tools/call", {
    name: "get_forecast",
    arguments: { lat: top.latitude, lon: top.longitude, days: 3 },
  });
  assert(!fc.isError, "get_forecast returned isError: " + fc.content?.[0]?.text);
  const fcData = JSON.parse(fc.content[0].text);
  console.log("tools/call get_forecast ->", {
    timezone: fcData.timezone,
    current: fcData.current,
    daily: fcData.daily,
  });
  assert(fcData.daily.length === 3, "3 daily rows");

  const bad = await request("tools/call", { name: "get_forecast", arguments: { lat: 999, lon: 0 } });
  console.log("tools/call get_forecast(lat=999) -> isError:", bad.isError === true);
  assert(bad.isError === true, "invalid input should be rejected");

  console.log("SMOKE OK");
  child.kill();
  process.exit(0);
} catch (err) {
  console.error("SMOKE FAILED:", err.message);
  child.kill();
  process.exit(1);
}
