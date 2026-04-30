"use strict";

const http = require("http");
require("dotenv").config();

const baseUrl = (process.env.ALETA_BOT_BASE_URL || "http://127.0.0.1:3003").replace(/\/+$/, "");
const token = process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || "";
const timeoutMs = Number(process.env.ALETA_BOT_SMOKE_TIMEOUT_MS || 6000);

function requestJson(pathname, { method = "GET", body, tokenMode = "valid" } = {}) {
  return new Promise((resolve) => {
    const url = new URL(`${baseUrl}${pathname}`);
    const payload = body ? JSON.stringify(body) : "";
    const headers = {
      "content-type": "application/json",
      ...(payload ? { "content-length": Buffer.byteLength(payload) } : {}),
    };
    if (tokenMode === "valid" && token) headers["x-aleta-internal-token"] = token;
    if (tokenMode === "wrong") headers["x-aleta-internal-token"] = "wrong-token-for-smoke-test";

    const req = http.request(
      url,
      { method, timeout: timeoutMs, headers },
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
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (error) => resolve({ ok: false, statusCode: 0, error: error.message }));
    if (payload) req.write(payload);
    req.end();
  });
}

function pass(name, detail = "") {
  return { name, status: "pass", detail };
}

function warn(name, detail = "") {
  return { name, status: "warning", detail };
}

function fail(name, detail = "") {
  return { name, status: "fail", detail };
}

function summarize(result) {
  if (result.ok) return `HTTP ${result.statusCode}`;
  return result.error || result.json?.message || result.json?.error || `HTTP ${result.statusCode}`;
}

async function main() {
  const checks = [];
  const warnings = [];
  const errors = [];

  if (!token) {
    errors.push("ALETA_BOT_INTERNAL_API_TOKEN/ALETA_BOT_INTERNAL_TOKEN belum tersedia untuk smoke test.");
  }

  const noToken = await requestJson("/internal/aleta-bot/whatsapp/status", { tokenMode: "none" });
  checks.push(noToken.statusCode === 401 ? pass("internal_token_missing_guard", "401 tanpa token") : fail("internal_token_missing_guard", summarize(noToken)));

  const wrongToken = await requestJson("/internal/aleta-bot/whatsapp/status", { tokenMode: "wrong" });
  checks.push(wrongToken.statusCode === 403 ? pass("internal_token_wrong_guard", "403 token salah") : fail("internal_token_wrong_guard", summarize(wrongToken)));

  const status = await requestJson("/internal/aleta-bot/whatsapp/status");
  checks.push(status.ok ? pass("whatsapp_status", status.json?.status || "") : fail("whatsapp_status", summarize(status)));
  if (status.ok && status.json?.status !== "connected") {
    warnings.push(`WhatsApp status ${status.json?.status}; ini bukan blocker selama endpoint jelas dan QR/connect tersedia.`);
  }

  const qr = await requestJson("/internal/aleta-bot/whatsapp/qr");
  checks.push(qr.ok ? pass("whatsapp_qr", qr.json?.status || "") : fail("whatsapp_qr", summarize(qr)));
  if (qr.ok && !qr.json?.qr && qr.json?.status !== "connected") {
    warnings.push(qr.json?.message || "QR belum tersedia dari runtime.");
  }

  const connect = await requestJson("/internal/aleta-bot/whatsapp/connect", {
    method: "POST",
    body: { dryRun: true },
  });
  checks.push(connect.ok && connect.json?.dryRun ? pass("whatsapp_connect_dry_run", connect.json?.status || "") : fail("whatsapp_connect_dry_run", summarize(connect)));

  const aiConfig = await requestJson("/internal/aleta-bot/ai-config");
  checks.push(aiConfig.ok ? pass("ai_config", aiConfig.json?.status || "") : fail("ai_config", summarize(aiConfig)));
  if (aiConfig.ok && ["needs_sync", "disabled", "error"].includes(aiConfig.json?.status)) {
    warnings.push(`AI bridge status ${aiConfig.json?.status}.`);
  }

  const worker = await requestJson("/internal/aleta-bot/worker/status");
  checks.push(worker.ok ? pass("worker_status", worker.json?.worker?.enabled ? "enabled" : "disabled") : fail("worker_status", summarize(worker)));

  const deadLetters = await requestJson("/internal/aleta-bot/queue/dead-letters?limit=5");
  checks.push(deadLetters.ok ? pass("dead_letters", `${deadLetters.json?.total ?? 0} item`) : fail("dead_letters", summarize(deadLetters)));

  const queue = await requestJson("/internal/aleta-bot/queue?limit=5");
  checks.push(queue.ok ? pass("queue", `${queue.json?.stats?.pending ?? 0} pending`) : fail("queue", summarize(queue)));

  const testMessage = await requestJson("/internal/aleta-bot/messages/test", {
    method: "POST",
    body: {
      recipientNumber: "6281234567890",
      message: "ALETA Bot smoke test dry-run. Tidak dikirim sungguhan.",
      dryRun: true,
    },
  });
  checks.push(testMessage.ok ? pass("message_test_dry_run", testMessage.json?.status || "ok") : fail("message_test_dry_run", summarize(testMessage)));

  const publicQa = await requestJson("/internal/aleta-bot/public-qa/test", {
    method: "POST",
    body: { question: "halo", senderNumber: "6281234567890", senderName: "Smoke Test" },
  });
  checks.push(publicQa.ok ? pass("public_qa_greeting", publicQa.json?.result?.matchedIntentKey || "ok") : fail("public_qa_greeting", summarize(publicQa)));

  const legacyCommands = await requestJson("/internal/aleta-bot/legacy/commands");
  checks.push(legacyCommands.ok ? pass("legacy_command_catalog", `${legacyCommands.json?.total ?? 0} command`) : fail("legacy_command_catalog", summarize(legacyCommands)));
  if (legacyCommands.ok && Number(legacyCommands.json?.duplicateCount || 0) > 0) {
    warnings.push(`Legacy command duplicate path: ${legacyCommands.json.duplicateCount}.`);
  }

  const legacyNotifications = await requestJson("/internal/aleta-bot/legacy/notifications");
  checks.push(legacyNotifications.ok ? pass("legacy_notification_catalog", `${legacyNotifications.json?.total ?? 0} notification`) : fail("legacy_notification_catalog", summarize(legacyNotifications)));
  if (legacyNotifications.ok && Number(legacyNotifications.json?.duplicateCount || 0) > 0) {
    warnings.push(`Legacy notification duplicate path: ${legacyNotifications.json.duplicateCount}.`);
  }

  checks.push(warn("archive_readiness_checker", "Dihitung di portal dashboard/export karena membutuhkan metadata approval registry."));
  checks.push(warn("export_config_non_secret", "Diuji melalui route portal Super Admin, bukan endpoint runtime aleta_bot."));
  checks.push(warn("maintenance_cleanup_preview", "Diuji melalui route portal Super Admin, bukan endpoint runtime aleta_bot."));

  for (const check of checks) {
    if (check.status === "fail") errors.push(`${check.name}: ${check.detail}`);
  }

  const summary = {
    ok: errors.length === 0,
    checkedAt: new Date().toISOString(),
    baseUrl,
    tokenConfigured: Boolean(token),
    checks,
    warnings,
    errors,
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
