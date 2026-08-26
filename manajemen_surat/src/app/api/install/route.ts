import { NextRequest, NextResponse } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  generateInstallEnv,
  getInstallStatus,
  saveInstallConfig,
  type InstallPayload,
} from "@/server/modules/install/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";

function noStoreJson(payload: unknown, init?: ResponseInit) {
  const response = NextResponse.json(payload, init);
  response.headers.set("Cache-Control", "no-store, private");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export async function GET() {
  const status = await getInstallStatus();
  return noStoreJson({ ok: true, data: status });
}

async function guardInstalledConfigWrite(request: NextRequest) {
  const status = await getInstallStatus();
  if (status.setupRequired) return null;

  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    if (actor.roleId === "super-admin") return null;

    return noStoreJson(
      {
        ok: false,
        error: {
          message: "Konfigurasi instalasi hanya dapat diubah oleh Super Admin setelah setup selesai.",
        },
      },
      { status: 403 }
    );
  } catch {
    return noStoreJson(
      {
        ok: false,
        error: {
          message: "Setup sudah selesai. Login sebagai Super Admin untuk mengubah konfigurasi instalasi.",
        },
      },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => ({}))) as InstallPayload & { dryRun?: boolean };
    const guardResponse = await guardInstalledConfigWrite(request);
    if (guardResponse) return guardResponse;

    if (payload.dryRun) {
      const generated = generateInstallEnv(payload);
      return noStoreJson({
        ok: true,
        data: {
          dryRun: true,
          envPreview: generated.envText
            .split("\n")
            .map((line) =>
              line
                .replace(/^(.*(?:PASSWORD|SECRET|TOKEN|API_KEY).*)=.*$/i, "$1=********")
                .replace(/^(DATABASE_URL=postgres:\/\/[^:]+):[^@]+@/i, "$1:********@")
            )
            .join("\n"),
          summary: generated.summary,
        },
      });
    }

    const result = await saveInstallConfig(payload);
    return noStoreJson({ ok: true, data: result });
  } catch (error) {
    return noStoreJson(
      {
        ok: false,
        error: {
          message: error instanceof Error ? error.message : "Konfigurasi instalasi gagal disimpan.",
        },
      },
      { status: 400 }
    );
  }
}
