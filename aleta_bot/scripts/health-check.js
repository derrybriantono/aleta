"use strict";

const http = require("http");
require("dotenv").config();

const baseUrl = (process.env.ALETA_BOT_BASE_URL || "http://127.0.0.1:3003").replace(/\/+$/, "");
const token = process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || "";

function requestJson(pathname, { method = "GET", body } = {}) {
  return new Promise((resolve) => {
    const url = new URL(`${baseUrl}${pathname}`);
    const payload = body ? JSON.stringify(body) : "";
    const req = http.request(
      url,
      {
        method,
        timeout: Number(process.env.ALETA_BOT_HEALTH_TIMEOUT_MS || 5000),
        headers: {
          "content-type": "application/json",
          ...(token ? { "x-aleta-internal-token": token } : {}),
          ...(payload ? { "content-length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          let json = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            json = { raw: data.slice(0, 300) };
          }
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, json });
        });
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", (error) => {
      resolve({ ok: false, statusCode: 0, error: error.message });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

function summarizeQueue(result) {
  if (!result || !result.json) return result;
  return {
    ...result,
    json: {
      status: result.json.status,
      stats: result.json.stats || null,
      itemCount: Array.isArray(result.json.items) ? result.json.items.length : 0,
    },
  };
}

async function main() {
  const checks = [];
  checks.push(["whatsapp", await requestJson("/internal/aleta-bot/whatsapp/status")]);
  checks.push(["aiConfig", await requestJson("/internal/aleta-bot/ai-config")]);
  checks.push(["worker", await requestJson("/internal/aleta-bot/worker/status")]);
  checks.push(["deadLetters", await requestJson("/internal/aleta-bot/queue/dead-letters?limit=5")]);
  checks.push(["queue", summarizeQueue(await requestJson("/internal/aleta-bot/queue?limit=5"))]);

  const summary = {
    ok: checks.every(([, result]) => result.ok),
    checkedAt: new Date().toISOString(),
    baseUrl,
    tokenConfigured: Boolean(token),
    checks: Object.fromEntries(checks),
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
