#!/usr/bin/env node
"use strict";

// Optional cover generator for Agents without a native image-generation tool.
// It deliberately accepts credentials only from environment variables so keys
// never land in command history, generated HTML, manifests, or Git.

const fs = require("fs");
const path = require("path");

function usage() {
  return `Usage:
  node scripts/generate-cover.js --prompt "..." --output /path/to/cover.png [options]

Required environment variables for a real request:
  XHS_IMAGE_API_BASE   OpenAI-compatible API base, e.g. https://api.openai.com/v1
  XHS_IMAGE_API_KEY    API key (environment variable only; never pass it on CLI)
  XHS_IMAGE_MODEL      Image model name, e.g. gpt-image-1

Options:
  --size <WxH>         Default: 1080x1440
  --quality <value>    Optional provider quality value
  --force              Allow overwriting an existing output file
  --dry-run            Validate the request shape without calling the API
  --help               Show this help
`;
}

function parseArgs(argv) {
  const options = { size: "1080x1440", force: false, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (["--prompt", "--output", "--size", "--quality"].includes(arg)) {
      const value = argv[++index];
      if (!value) throw new Error(`${arg} requires a value`);
      options[arg.slice(2)] = value;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function endpointFromBase(apiBase) {
  const base = String(apiBase || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(base)) throw new Error("XHS_IMAGE_API_BASE must be an https URL");
  return /\/images\/generations$/i.test(base) ? base : `${base}/images/generations`;
}

function extensionFromContentType(contentType) {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("webp")) return ".webp";
  if (type.includes("jpeg") || type.includes("jpg")) return ".jpg";
  return ".png";
}

async function readImage(responseData) {
  const item = responseData?.data?.[0];
  if (!item) throw new Error("Image API response has no data[0]");
  if (item.b64_json) return { bytes: Buffer.from(item.b64_json, "base64"), extension: ".png" };
  if (!item.url) throw new Error("Image API response has neither b64_json nor url");
  const download = await fetch(item.url);
  if (!download.ok) throw new Error(`Generated image download failed: HTTP ${download.status}`);
  return {
    bytes: Buffer.from(await download.arrayBuffer()),
    extension: extensionFromContentType(download.headers.get("content-type")),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  if (!options.prompt?.trim()) throw new Error("--prompt is required");
  if (!options.output?.trim()) throw new Error("--output is required");
  if (!/^\d{3,5}x\d{3,5}$/i.test(options.size)) throw new Error("--size must use WxH, for example 1080x1440");

  const apiBase = process.env.XHS_IMAGE_API_BASE || "";
  const model = process.env.XHS_IMAGE_MODEL || "";
  const endpoint = endpointFromBase(apiBase);
  const output = path.resolve(options.output);
  const payload = { model, prompt: options.prompt.trim(), size: options.size, n: 1 };
  if (options.quality) payload.quality = options.quality;

  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify({ ok: true, dryRun: true, endpoint, model: model || "(missing)", output, payload }, null, 2)}\n`);
    return;
  }
  if (!process.env.XHS_IMAGE_API_KEY) throw new Error("Missing XHS_IMAGE_API_KEY. Put the key in an environment variable, not the command line.");
  if (!model) throw new Error("Missing XHS_IMAGE_MODEL");
  if (fs.existsSync(output) && !options.force) throw new Error(`Output already exists: ${output} (use --force to overwrite)`);
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.XHS_IMAGE_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 600);
    throw new Error(`Image API request failed: HTTP ${response.status}${detail ? ` — ${detail}` : ""}`);
  }
  const result = await response.json();
  const image = await readImage(result);
  const finalOutput = path.extname(output) ? output : `${output}${image.extension}`;
  if (fs.existsSync(finalOutput) && !options.force) throw new Error(`Output already exists: ${finalOutput} (use --force to overwrite)`);
  fs.writeFileSync(finalOutput, image.bytes);
  process.stdout.write(`${JSON.stringify({ ok: true, output: finalOutput, model, size: options.size }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`generate-cover: ${error.message}\n`);
  process.exitCode = 1;
});
