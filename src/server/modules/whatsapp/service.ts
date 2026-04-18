import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode";
import fs from "node:fs";

import { getDatabase } from "@/server/db/client";
import { whatsappWebSettings } from "@/server/db/drizzle-schema";
import { getWhatsAppSettingsFromDb } from "@/server/modules/settings/service";
import { eq } from "drizzle-orm";

type WhatsAppConnectionStatus =
  | "inactive"
  | "initializing"
  | "qr"
  | "authenticated"
  | "ready"
  | "failed";

class WhatsAppService {
  private client: Client | null = null;
  private qrCode: string | null = null;
  private connectionStatus: WhatsAppConnectionStatus = "inactive";
  private isInitializing = false;
  private sessionName = "aleta-session";

  private resolveBrowserExecutablePath() {
    const candidatePaths = [
      process.env.WHATSAPP_CHROME_PATH,
      process.env.CHROME_PATH,
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ].filter((value): value is string => Boolean(value?.trim()));

    for (const candidate of candidatePaths) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    try {
      // Reuse the already-installed Playwright browser in local workspace if available.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { chromium } = require("playwright");
      const executablePath = chromium?.executablePath?.();
      if (typeof executablePath === "string" && executablePath && fs.existsSync(executablePath)) {
        return executablePath;
      }
    } catch {
      // Ignore optional runtime dependency resolution failure.
    }

    return undefined;
  }

  async initialize() {
    if (this.isInitializing) return;

    const settings = await getWhatsAppSettingsFromDb(await getDatabase()).catch(() => null);
    const nextSessionName =
      settings?.sessionName?.trim().replace(/\s+/g, "-").toLowerCase() || "aleta-session";

    if (this.connectionStatus === "ready" && this.client && this.sessionName === nextSessionName) {
      return;
    }

    if (this.client && this.sessionName !== nextSessionName) {
      try {
        await this.client.destroy();
      } catch {
        // ignore stale client cleanup failures
      }
      this.client = null;
      this.qrCode = null;
      this.connectionStatus = "inactive";
    }

    this.isInitializing = true;
    this.connectionStatus = "initializing";
    this.sessionName = nextSessionName;

    try {
      const executablePath = this.resolveBrowserExecutablePath();
      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: this.sessionName,
        }),
        puppeteer: {
          headless: true,
          executablePath,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
      });

      this.client.on("qr", async (qr) => {
        this.qrCode = await qrcode.toDataURL(qr);
        this.connectionStatus = "qr";
        await this.updateStatusInDb("inactive");
      });

      this.client.on("authenticated", async () => {
        this.connectionStatus = "authenticated";
        this.qrCode = null;
      });

      this.client.on("ready", async () => {
        this.connectionStatus = "ready";
        this.qrCode = null;
        await this.updateStatusInDb("active");
      });

      this.client.on("auth_failure", async (message) => {
        this.connectionStatus = "failed";
        this.qrCode = null;
        await this.updateStatusInDb("failed");
        console.error("[WhatsApp] Auth failure:", message);
      });

      this.client.on("disconnected", async (reason) => {
        this.connectionStatus = "inactive";
        this.qrCode = null;
        await this.updateStatusInDb("inactive");
        console.warn("[WhatsApp] Disconnected:", reason);
      });

      await this.client.initialize();
    } catch (error) {
      this.connectionStatus = "failed";
      this.qrCode = null;
      await this.updateStatusInDb("failed");
      console.error("[WhatsApp] Initialization error:", error);
    } finally {
      this.isInitializing = false;
    }
  }

  getQrCode() {
    return this.qrCode;
  }

  getStatus() {
    return this.connectionStatus;
  }

  async sendMessage(to: string, message: string) {
    if (this.connectionStatus !== "ready" || !this.client) {
      throw new Error("WhatsApp client belum siap. Hubungkan sesi QR terlebih dahulu.");
    }

    const chatId = to.includes("@c.us") ? to : `${to.replace(/\D/g, "")}@c.us`;
    return this.client.sendMessage(chatId, message);
  }

  private async updateStatusInDb(status: "active" | "inactive" | "failed") {
    try {
      const db = await getDatabase();
      const now = new Date().toISOString();

      await db.getOrm()
        .update(whatsappWebSettings)
        .set({
          status,
          lastConnectedAt: status === "active" ? now : undefined,
          updatedAt: now,
        })
        .where(eq(whatsappWebSettings.id, 1));
    } catch (error) {
      console.error("[WhatsApp] Failed to update status in DB:", error);
    }
  }
}

const globalForWhatsApp = global as unknown as { whatsappService: WhatsAppService };

export const whatsappService = globalForWhatsApp.whatsappService || new WhatsAppService();

if (process.env.NODE_ENV !== "production") {
  globalForWhatsApp.whatsappService = whatsappService;
}
