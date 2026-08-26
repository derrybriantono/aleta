// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import { getAletaBotSnapshot, previewAletaBotNotificationRecipients } from "@/server/modules/aleta-bot/service";

/**
 * Preview Penerima notifikasi pegawai.
 *
 * Keluhan: preview menampilkan format pesan yang benar TAPI tanpa data nyata
 * (nomor perkara, agenda, jam, ruang). Penyebabnya preview lama memakai contoh
 * aman karena portal tidak punya akses SIPP.
 *
 * Perbaikan: preview kini mengambil DATA NYATA dari runtime bot, difilter dan
 * dirender PER PENERIMA — tiap hakim melihat daftar perkaranya sendiri, tidak
 * tercampur. Bila bot tak terjangkau, jatuh ke contoh aman tanpa error.
 */
let db: AletaDatabase | null = null;
const envAsli = { ...process.env };

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
});

afterEach(async () => {
  await db?.close();
  db = null;
  process.env = { ...envAsli };
  vi.unstubAllGlobals();
});

async function employeeNotificationId() {
  const snap = await getAletaBotSnapshot(db!, "usr-super");
  const notif = snap.notifications.find((n) => n.category === "employee");
  expect(notif).toBeTruthy();
  return notif!.id;
}

describe("preview penerima memakai data nyata per hakim", () => {
  it("menampilkan pesan berisi data masing-masing hakim, tidak tercampur", async () => {
    process.env.WHATSAPP_RUNTIME_MODE = "aleta_bot";

    // Runtime bot dipalsukan mengembalikan preview per penerima dengan DATA
    // NYATA yang BERBEDA untuk tiap hakim.
    const botPreview = {
      ok: true,
      query: {
        id: "q",
        name: "Jadwal Sidang Hari Ini",
        rowCount: 2,
        rows: [],
        recipients: [
          { raw: "6285000000001", normalized: "6285000000001", valid: true, name: "HAKIM SATU", rowIndex: 0 },
          { raw: "6285000000002", normalized: "6285000000002", valid: true, name: "HAKIM DUA", rowIndex: 1 },
        ],
      },
      template: { id: "t", title: "Pengingat", placeholders: [], missingPlaceholders: [], message: "", complete: true },
      recipientMessages: [
        { rowIndex: 0, normalized: "6285000000001", message: "Halo HAKIM SATU. Sidang: 111/Pdt.G/2026/PA.Dgl jam 09:00 R.Sidang 1.", complete: true, missingPlaceholders: [] },
        { rowIndex: 1, normalized: "6285000000002", message: "Halo HAKIM DUA. Sidang: 222/Pdt.G/2026/PA.Dgl jam 10:00 R.Sidang 2.", complete: true, missingPlaceholders: [] },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/manual-send/preview")) {
          return new Response(JSON.stringify({ preview: botPreview }), { status: 200, headers: { "content-type": "application/json" } });
        }
        return new Response(JSON.stringify({ status: true }), { status: 200 });
      })
    );

    const hasil = await previewAletaBotNotificationRecipients(db!, {
      actorUserId: "usr-super",
      notificationId: await employeeNotificationId(),
      limit: 10,
    });

    expect(hasil.items.length).toBe(2);

    const satu = hasil.items.find((i) => i.recipientName === "HAKIM SATU");
    const dua = hasil.items.find((i) => i.recipientName === "HAKIM DUA");
    expect(satu?.messagePreview).toContain("111/Pdt.G/2026/PA.Dgl");
    expect(dua?.messagePreview).toContain("222/Pdt.G/2026/PA.Dgl");

    // Tidak tercampur: pesan hakim satu TIDAK memuat perkara hakim dua.
    expect(satu?.messagePreview).not.toContain("222/Pdt.G/2026/PA.Dgl");
    expect(dua?.messagePreview).not.toContain("111/Pdt.G/2026/PA.Dgl");

    // Nomor tetap disamarkan.
    expect(satu?.recipientNumber).not.toBe("6285000000001");
  });

  it("menandai bila sumber data tidak menghasilkan data (mis. tidak ada sidang)", async () => {
    process.env.WHATSAPP_RUNTIME_MODE = "aleta_bot";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/manual-send/preview")) {
          return new Response(
            JSON.stringify({ preview: { ok: true, query: { id: "q", rows: [], recipients: [] }, template: null, recipientMessages: [] } }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ status: true }), { status: 200 });
      })
    );

    const hasil = await previewAletaBotNotificationRecipients(db!, {
      actorUserId: "usr-super",
      notificationId: await employeeNotificationId(),
    });
    expect(hasil.items.length).toBe(0);
    expect(hasil.warnings.join(" ")).toMatch(/tidak menghasilkan data/i);
  });

  it("jatuh ke contoh aman tanpa error bila bot tidak terjangkau", async () => {
    // Tidak ada stub fetch → panggilan ke runtime bot gagal → fallback contoh.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("fetch failed");
      })
    );

    const hasil = await previewAletaBotNotificationRecipients(db!, {
      actorUserId: "usr-super",
      notificationId: await employeeNotificationId(),
    });
    // Fallback tetap mengembalikan hasil (contoh aman), bukan melempar.
    expect(Array.isArray(hasil.items)).toBe(true);
  });
});
