// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getGatewayOnlineQueueMonitor } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

/**
 * Pemantauan antrian sidang online di halaman ALETA Bot.
 *
 * Yang dijaga di sini adalah hal yang paling mudah salah: membedakan
 * "antriannya memang kosong" dari "statusnya tidak bisa dibaca". Kalau
 * keduanya tampil sama, petugas akan mengira semua baik-baik saja padahal
 * pendaftaran antrian dari pihak sedang gagal total.
 */
const MONITOR_CONTOH = {
  connectionKey: "antrian_sidang",
  commands: ["daftar antrian", "antrian online", "ambil antrian"],
  reachable: true,
  error: "",
  checkedAt: "2026-08-02T01:00:00.000Z",
  totals: { sidangHariIni: 3, sudahAmbilAntrian: 2, pihak1: 1, pihak2: 1 },
  items: [
    {
      nomorPerkara: "10/Pdt.G/2026/PA.Dgl",
      majelisHakimKode: "MJL-1",
      online: true,
      pihak1DaftarPada: "2026-08-02T01:00:00.000Z",
      pihak2DaftarPada: null,
      nomorAntrian: 1,
    },
  ],
};

let permintaan: { url: string; headers: Record<string, string> }[] = [];

beforeEach(() => {
  permintaan = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function pasangGateway(hasil: { status?: number; body: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      permintaan.push({
        url: String(input),
        headers: (init?.headers as Record<string, string>) ?? {},
      });
      return new Response(JSON.stringify(hasil.body), {
        status: hasil.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    })
  );
}

describe("klien pemantauan antrian online", () => {
  it("memanggil endpoint bot dengan batas yang aman", async () => {
    pasangGateway({ body: { ok: true, monitor: MONITOR_CONTOH, logs: [], totalLogs: 0 } });

    await getGatewayOnlineQueueMonitor({ limit: 9999, logLimit: 9999 });

    const url = permintaan[0]?.url ?? "";
    expect(url).toContain("/internal/aleta-bot/antrian-online/monitor");
    // Batas ditegakkan di klien juga, bukan hanya di bot, supaya portal tidak
    // pernah meminta ribuan baris sekaligus.
    expect(url).toContain("limit=500");
    expect(url).toContain("logLimit=200");
  });

  it("memakai nilai bawaan bila tidak diberi batas", async () => {
    pasangGateway({ body: { ok: true, monitor: MONITOR_CONTOH, logs: [], totalLogs: 0 } });

    await getGatewayOnlineQueueMonitor();

    expect(permintaan[0]?.url).toContain("limit=100");
    expect(permintaan[0]?.url).toContain("logLimit=50");
  });

  it("meneruskan data antrian apa adanya", async () => {
    pasangGateway({
      body: {
        ok: true,
        monitor: MONITOR_CONTOH,
        logs: [
          {
            id: 1,
            createdAt: "2026-08-02T01:00:00.000Z",
            severity: "info",
            message: "Pendaftaran antrian online: registered.",
            status: "registered",
            nomorPerkara: "10/Pdt.G/2026/PA.Dgl",
            partySlot: "pihak_1",
            nomorAntrian: 1,
            resolvedBy: "sender_phone",
          },
        ],
        totalLogs: 1,
      },
    });

    const hasil = await getGatewayOnlineQueueMonitor();

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.data.monitor.reachable).toBe(true);
    expect(hasil.data.monitor.totals.sudahAmbilAntrian).toBe(2);
    expect(hasil.data.logs[0]?.status).toBe("registered");
    expect(hasil.data.logs[0]?.resolvedBy).toBe("sender_phone");
  });

  it("basis data antrian putus tetap terbaca sebagai putus, bukan kosong", async () => {
    pasangGateway({
      body: {
        ok: true,
        monitor: {
          ...MONITOR_CONTOH,
          reachable: false,
          error: "connect ECONNREFUSED 10.0.0.5:3306",
          totals: { sidangHariIni: 0, sudahAmbilAntrian: 0, pihak1: 0, pihak2: 0 },
          items: [],
        },
        logs: [],
        totalLogs: 0,
      },
    });

    const hasil = await getGatewayOnlineQueueMonitor();

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    // Inti: daftar kosong DAN reachable=false. Layar harus bisa membedakan ini
    // dari antrian yang memang belum ada isinya.
    expect(hasil.data.monitor.items).toHaveLength(0);
    expect(hasil.data.monitor.reachable).toBe(false);
    expect(hasil.data.monitor.error).toContain("ECONNREFUSED");
  });

  it("bot mati dilaporkan gagal, bukan dianggap antrian kosong", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("fetch failed");
      })
    );

    const hasil = await getGatewayOnlineQueueMonitor();

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.error).toBeTruthy();
  });

  it("respons galat dari bot tidak dianggap berhasil", async () => {
    pasangGateway({
      status: 500,
      body: { ok: false, error: "online_queue_monitor_failed", message: "Pemantauan belum bisa dibaca." },
    });

    const hasil = await getGatewayOnlineQueueMonitor();
    expect(hasil.ok).toBe(false);
  });
});
