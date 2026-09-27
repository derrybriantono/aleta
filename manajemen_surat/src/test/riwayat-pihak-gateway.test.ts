// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

// Uji mutan menjalankan berkas ini atas SALINAN klien gateway lewat variabel
// ini - berkas aslinya tidak pernah disunting.
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) =>
  process.env.RIWAYAT_GATEWAY_BERKAS ? await import(/* @vite-ignore */ process.env.RIWAYAT_GATEWAY_BERKAS) : await asli()
);

import {
  getGatewayIdentitasPihak,
  getGatewayPetaPerkara,
  getGatewayRiwayatPihak,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";

/**
 * ============================================================================
 * KLIEN GATEWAY: KODE PENOLAKAN BOT, DAN BATAS WAKTU YANG DISEBUT JUJUR
 * ============================================================================
 *
 * Telaah gabungan 2.40.0, dua butir di klien gateway yang sesungguhnya (fetch
 * saja yang ditiru):
 *
 *   1. Jawaban JSON bot yang MENOLAK (400/404/500 beserta `kode`-nya) harus
 *      sampai ke portal sebagai penolakan - status dan kodenya ikut - bukan
 *      diratakan menjadi satu teks yang tidak dapat dibedakan dari "bot tidak
 *      dapat dihubungi". Halaman HTML 404 (rute belum ada di bot versi lama)
 *      TIDAK membawa kode: bot itu memang tidak dapat menjawab.
 *
 *   4. Pesan habis waktu menyebut batas yang SUNGGUH dipakai pemanggilan itu.
 *      Sebelumnya selalu batas bawaan (8000 ms) - padahal riwayat pihak
 *      menunggu 20 detik dan penilaian 60 detik, sehingga petugas membaca
 *      angka yang tidak pernah terjadi.
 */

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function jawab(badan: string, status: number, jenis = "application/json") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(badan, { status, headers: { "Content-Type": jenis } }))
  );
}

describe("penolakan bot sampai ke portal beserta status dan kodenya", () => {
  it("404 perkara tidak ada: error, status 404, kode perkara_tidak_ada", async () => {
    jawab(JSON.stringify({ ok: false, kode: "perkara_tidak_ada", alasan: "Perkara tidak ditemukan di SIPP." }), 404);
    const hasil = await getGatewayRiwayatPihak({ perkaraId: "123" });
    expect(hasil).toEqual({ ok: false, error: "Perkara tidak ditemukan di SIPP.", status: 404, kode: "perkara_tidak_ada" });
  });

  it("400 masukan tidak sah dan 500 SIPP galat membawa kodenya masing-masing", async () => {
    jawab(JSON.stringify({ ok: false, kode: "masukan_tidak_sah", alasan: "perkaraId atau nomorPerkara wajib diisi." }), 400);
    expect(await getGatewayRiwayatPihak({})).toMatchObject({ ok: false, status: 400, kode: "masukan_tidak_sah" });
    jawab(JSON.stringify({ ok: false, kode: "gagal_membaca_sipp", alasan: "Table 'perkara' doesn't exist" }), 500);
    expect(await getGatewayRiwayatPihak({ perkaraId: "1" })).toMatchObject({ ok: false, status: 500, kode: "gagal_membaca_sipp" });
  });

  it("halaman HTML 404 (rute belum ada di bot) tidak membawa kode", async () => {
    jawab("<!DOCTYPE html><html><body>Cannot GET /internal/aleta-bot/sipp/riwayat-pihak</body></html>", 404, "text/html");
    const hasil = await getGatewayRiwayatPihak({ perkaraId: "123" });
    expect(hasil.ok).toBe(false);
    expect(hasil.ok ? undefined : hasil.kode).toBeUndefined();
    expect(hasil.ok ? "" : hasil.error).toMatch(/halaman 404/);
  });

  it("koneksi ditolak: tanpa status dan tanpa kode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const galat = new TypeError("fetch failed") as TypeError & { cause?: { code: string } };
        galat.cause = { code: "ECONNREFUSED" };
        throw galat;
      })
    );
    const hasil = await getGatewayRiwayatPihak({ perkaraId: "123" });
    expect(hasil).toMatchObject({ ok: false });
    expect(hasil.ok ? undefined : [hasil.status, hasil.kode]).toEqual([undefined, undefined]);
  });
});

/** fetch yang tidak pernah menjawab - hanya tunduk pada pembatalan. */
function fetchMenggantung() {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_alamat: string, init?: RequestInit) =>
        new Promise<Response>((_, gagal) => {
          init?.signal?.addEventListener("abort", () => {
            const galat = new Error("This operation was aborted");
            galat.name = "AbortError";
            gagal(galat);
          });
        })
    )
  );
}

async function habisWaktu<T>(janji: Promise<T>, ms: number): Promise<T> {
  let selesai = false;
  void janji.then(() => (selesai = true));
  await vi.advanceTimersByTimeAsync(ms - 1);
  // Belum menyerah sebelum batasnya sendiri.
  expect(selesai).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  return janji;
}

describe("pesan habis waktu menyebut batas yang sungguh dipakai", () => {
  it("riwayat pihak: 20000 ms, bukan batas bawaan", async () => {
    vi.useFakeTimers();
    fetchMenggantung();
    const hasil = await habisWaktu(getGatewayRiwayatPihak({ perkaraId: "1" }), 20_000);
    expect(hasil.ok).toBe(false);
    const pesan = hasil.ok ? "" : hasil.error;
    expect(pesan).toContain("20000");
    expect(pesan).not.toContain("8000ms");
  });

  it("penilaian (peta perkara): 60000 ms", async () => {
    vi.useFakeTimers();
    fetchMenggantung();
    const hasil = await habisWaktu(getGatewayPetaPerkara({ kelompok: "perceraian" }), 60_000);
    expect(hasil.ok ? "" : hasil.error).toContain("60000");
  });

  it("pemanggilan berbatas bawaan tetap menyebut batas bawaan", async () => {
    vi.useFakeTimers();
    fetchMenggantung();
    const bawaan = Number(process.env.ALETA_BOT_GATEWAY_TIMEOUT_MS || 8000);
    const hasil = await habisWaktu(getGatewayIdentitasPihak("1/Pdt.G/2026/PA.Ctt"), bawaan);
    expect(hasil.ok ? "" : hasil.error).toContain(String(bawaan));
  });
});
