#!/usr/bin/env node
// Copies templates/server-ts into a new folder and fills {{PLACEHOLDERS}}.
// Usage:
//   node scaffold.mjs --name northwind-crm [--title "Northwind CRM"] \
//     [--description "..."] [--env-prefix NORTHWIND_CRM] [--out ./northwind-crm-mcp]
// Refuses to overwrite an existing directory. No dependencies.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.resolve(here, "..", "templates", "server-ts");

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const rawName = arg("--name");
if (!rawName) {
  console.error("Missing --name (e.g. --name northwind-crm)");
  process.exit(2);
}
const NAME = rawName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .replace(/-mcp$/, "");
if (!NAME) {
  console.error("--name must contain letters or digits");
  process.exit(2);
}
const TITLE = arg("--title") ?? NAME.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const ENV_PREFIX = (arg("--env-prefix") ?? NAME.replace(/-/g, "_")).toUpperCase();
const DESCRIPTION = arg("--description") ?? `MCP server for the ${TITLE} API.`;
const out = path.resolve(arg("--out") ?? `${NAME}-mcp`);

if (!/^[A-Z][A-Z0-9_]*$/.test(ENV_PREFIX)) {
  console.error(`Invalid --env-prefix ${ENV_PREFIX}`);
  process.exit(2);
}
if (fs.existsSync(out)) {
  console.error(`Refusing to overwrite existing path: ${out}`);
  process.exit(1);
}

const vars = { NAME, TITLE, ENV_PREFIX, DESCRIPTION };
const TEXT = /\.(ts|mjs|js|json|md|txt|example)$|^gitignore$|^\.env\.example$/;
const RENAME = { gitignore: ".gitignore" }; // npm/plugin packaging can drop dotfiles
const written = [];

function copy(src, dst) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const s = path.join(src, entry.name);
    const d = path.join(dst, RENAME[entry.name] ?? entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copy(s, d);
    } else if (TEXT.test(entry.name)) {
      let text = fs.readFileSync(s, "utf8");
      text = text.replace(/\{\{(NAME|TITLE|ENV_PREFIX|DESCRIPTION)\}\}/g, (_, k) => vars[k]);
      fs.writeFileSync(d, text);
      written.push(path.relative(out, d));
    } else {
      fs.copyFileSync(s, d);
      written.push(path.relative(out, d));
    }
  }
}

fs.mkdirSync(out, { recursive: true });
copy(templateDir, out);

const leftovers = written.filter((f) => /\{\{[A-Z_]+\}\}/.test(fs.readFileSync(path.join(out, f), "utf8")));
console.log(JSON.stringify({ out, vars, files: written, leftoverPlaceholders: leftovers }, null, 2));
if (leftovers.length) process.exit(3);
