// Unit tests (node:test) against the built output with a fake fetch: no network.
// Runs a real MCP client against the server over an in-memory transport.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";
import { ConfirmStore } from "../dist/confirm.js";

const res = (body, status = 200) => ({
  ok: status < 400,
  status,
  statusText: status < 400 ? "OK" : "Error",
  json: async () => body,
  text: async () => JSON.stringify(body),
});

async function connect(fetchImpl, extra = {}) {
  const calls = [];
  const cfg = {
    baseUrl: "https://api.example.test/v1",
    apiKey: "test-key",
    timeoutMs: 1000,
    readOnly: false,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return fetchImpl(url, init);
    },
    ...extra,
  };
  const server = createServer(cfg, new ConfirmStore());
  const client = new Client({ name: "test", version: "0.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, calls };
}
const parse = (r) => JSON.parse(r.content[0].text);

test("tools/list exposes reads and propose/confirm writes", async () => {
  const { client } = await connect(() => res({}));
  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["confirm_create_item", "get_item", "list_items", "propose_create_item"]);
});

test("read-only mode hides write tools", async () => {
  const { client } = await connect(() => res({}), { readOnly: true });
  const names = (await client.listTools()).tools.map((t) => t.name);
  assert.ok(!names.some((n) => n.startsWith("propose_") || n.startsWith("confirm_")));
});

test("propose makes no API call; confirm executes once", async () => {
  const { client, calls } = await connect(() => res({ id: "1", name: "Q4 report" }));
  const p = parse(await client.callTool({ name: "propose_create_item", arguments: { name: "Q4 report" } }));
  assert.equal(calls.length, 0);
  const c = await client.callTool({ name: "confirm_create_item", arguments: { confirm_token: p.confirm_token } });
  assert.ok(!c.isError);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "POST");
  const again = await client.callTool({ name: "confirm_create_item", arguments: { confirm_token: p.confirm_token } });
  assert.equal(again.isError, true, "token must be single-use");
});

test("upstream errors become isError results", async () => {
  const { client } = await connect(() => res({ error: "nope" }, 404));
  const r = await client.callTool({ name: "get_item", arguments: { id: "missing" } });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /404/);
});
