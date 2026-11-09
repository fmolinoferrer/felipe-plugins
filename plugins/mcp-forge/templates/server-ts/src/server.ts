import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiConfig, ApiError, createItem, getItem, listItems, loadConfig } from "./api.js";
import { ConfirmStore } from "./confirm.js";

export const SERVER_NAME = "{{NAME}}-mcp";
export const SERVER_VERSION = "0.1.0";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

// Errors are returned as tool results (isError: true) so the model can see
// and recover from them, instead of surfacing as protocol errors.
function fail(err: unknown): ToolResult {
  const msg =
    err instanceof ApiError ? err.message : `Error: ${(err as Error)?.message ?? String(err)}`;
  return { content: [{ type: "text", text: msg }], isError: true };
}

// TODO(mcp-forge): replace the example tools below with the approved tool plan.
// Keep the conventions: snake_case verb_noun names, descriptions that say WHEN
// to use the tool, bounded zod schemas with .describe(), annotations, and
// propose_/confirm_ pairs for every write.
export function createServer(cfg: ApiConfig = loadConfig(), confirms = new ConfirmStore()): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  // READ
  server.registerTool(
    "list_items",
    {
      title: "List items",
      description: "List {{TITLE}} items, optionally filtered by a search string. Returns id and name for each.",
      inputSchema: {
        query: z.string().trim().max(200).optional().describe("Optional search text"),
        limit: z.number().int().min(1).max(100).default(20).describe("Max items to return (1-100)"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, limit }) => {
      try {
        return ok({ items: await listItems(cfg, query, limit) });
      } catch (err) {
        return fail(err);
      }
    },
  );

  // READ
  server.registerTool(
    "get_item",
    {
      title: "Get one item",
      description: "Fetch a single {{TITLE}} item by id. Use list_items first if you do not know the id.",
      inputSchema: { id: z.string().trim().min(1).max(100).describe("Item id") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id }) => {
      try {
        return ok(await getItem(cfg, id));
      } catch (err) {
        return fail(err);
      }
    },
  );

  if (!cfg.readOnly) {
    const createSchema = {
      name: z.string().trim().min(1).max(200).describe("Name of the new item"),
      notes: z.string().max(2000).optional().describe("Optional notes"),
    };

    // WRITE step 1: no side effects.
    server.registerTool(
      "propose_create_item",
      {
        title: "Propose creating an item (no changes made)",
        description:
          "Validate and preview creating a {{TITLE}} item. Makes NO changes. Returns a preview and a confirm_token. " +
          "Show the preview to the user and only call confirm_create_item after they explicitly approve.",
        inputSchema: createSchema,
        annotations: { readOnlyHint: true },
      },
      async (input) => {
        const { token, expiresAt } = confirms.propose("create_item", input);
        return ok({
          preview: { action: "POST /items", body: input },
          confirm_token: token,
          expires_at: expiresAt,
          next: "Ask the user to approve, then call confirm_create_item with this confirm_token.",
        });
      },
    );

    // WRITE step 2: executes exactly the previewed payload.
    server.registerTool(
      "confirm_create_item",
      {
        title: "Confirm creating an item",
        description:
          "Execute a create previously previewed by propose_create_item. Requires the confirm_token from that call; " +
          "only use after the user approved the preview. Tokens are single-use and expire after 5 minutes.",
        inputSchema: { confirm_token: z.string().uuid().describe("Token returned by propose_create_item") },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      },
      async ({ confirm_token }) => {
        try {
          const payload = confirms.consume<{ name: string; notes?: string }>("create_item", confirm_token);
          return ok({ created: await createItem(cfg, payload) });
        } catch (err) {
          return fail(err);
        }
      },
    );
  }

  return server;
}
