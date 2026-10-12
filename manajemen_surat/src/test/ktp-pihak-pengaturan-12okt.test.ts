// @vitest-environment node
/**
 * ============================================================================
 * TANGGAL KTP: STATUS PERKARA (butir 8) + PENGATURAN & HISTORI e-COURT (butir 11) - 12 Okt 2026
 * ============================================================================
 *
 *   A. lib: pengaturan layar MENANG atas env, dibatasi, dibersihkan;
 *   B. lib: pencocokan baris KTP ke nama pihak di daftar Status Perkara, kalimat sebab/keadaan;
 *   C. penyapu latar membaca pengaturan layar tiap detak - nyala/mati/jeda berubah TANPA restart;
 *   D. rute (pg-mem berbenih + bot palsu): hak Admin/Super Admin, simpan + jejak audit, kembali ke
 *      bawaan, baca ulang, histori; rute Status Perkara mengikuti aksi status.data-pihak, NIK tak keluar;
 *   E. bot SUNGGUHAN atas basis data laptop (dilewati bila MySQL mati): riwayat percobaan, hasil per
 *      pihak tanpa NIK, namaSipp, bacaan ulang yang GAGAL tidak menghapus tanggal lama, pencarian nomor.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BATAS_PER_PUTARAN,
  JEDA_DETIK,
  bersihkanPengaturanKtp,
  pengaturanKtpDariEnv,
  pengaturanKtpEfektif,
} from "@/lib/ktp-pihak-pengaturan";
import {
  cariKtpUntukPihak,
  catatanKtpPerkara,
  keteranganTanpaKtp,
  teksSebabKtp,
  type KtpPihakBaris,
  type KtpPihakStatusData,
} from "@/lib/ktp-pihak-tampil";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import type { BerkasKtpAntri, HasilBacaKtpPihak } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import {
  aturUlangKtpPihak,
  keadaanPenyapuKtp,
  mulaiPindaiKtpBerkala,
  pengaturanLatar,
  type DepsKtp,
} from "@/server/modules/aleta-ecourt/ktp-pihak";

type Apa = any;

const AKAR = path.resolve(__dirname, "../../..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));

// ============================================================================
// A. pengaturan
// ============================================================================
describe("A. pengaturan penarikan KTP - layar menang atas env, tanpa restart", () => {
  it("tanpa pengaturan layar: env berlaku (sumber 'env'); tanpa env sama sekali: bawaan kode", () => {
    expect(pengaturanKtpEfektif({}, null)).toEqual({ aktif: true, batas: 2, jedaMs: 120_000, sumber: "bawaan" });
    expect(pengaturanKtpEfektif({ ALETA_KTP_PIHAK_LATAR: "0" }, null)).toMatchObject({ aktif: false, sumber: "env" });
    expect(pengaturanKtpEfektif({ ALETA_KTP_PIHAK_BATAS: "5", ALETA_KTP_PIHAK_JEDA_MS: "60000" }, null)).toEqual({
      aktif: true,
      batas: 5,
      jedaMs: 60_000,
      sumber: "env",
    });
  });

  it("pengaturan layar MENANG atas env, termasuk menyalakan yang dimatikan env", () => {
    const layar = bersihkanPengaturanKtp({ aktif: true, batas: 7, jedaDetik: 45 });
    expect(pengaturanKtpEfektif({ ALETA_KTP_PIHAK_LATAR: "0", ALETA_KTP_PIHAK_BATAS: "1", ALETA_KTP_PIHAK_JEDA_MS: "600000" }, layar)).toEqual({
      aktif: true,
      batas: 7,
      jedaMs: 45_000,
      sumber: "layar",
    });
    const mati = bersihkanPengaturanKtp({ aktif: false, batas: 2, jedaDetik: 120 });
    expect(pengaturanKtpEfektif({}, mati)).toMatchObject({ aktif: false, sumber: "layar" });
  });

  it("angka dijepit ke batas; masukan yang bukan objek / tanpa nyala-mati ditolak (null)", () => {
    expect(bersihkanPengaturanKtp({ aktif: true, batas: 99, jedaDetik: 1 })).toMatchObject({
      batas: BATAS_PER_PUTARAN.maks,
      jedaDetik: JEDA_DETIK.min,
    });
    expect(bersihkanPengaturanKtp({ aktif: true, batas: 0, jedaDetik: 10 ** 9 })).toMatchObject({
      batas: BATAS_PER_PUTARAN.min,
      jedaDetik: JEDA_DETIK.maks,
    });
    expect(bersihkanPengaturanKtp(null)).toBeNull();
    expect(bersihkanPengaturanKtp([])).toBeNull();
    expect(bersihkanPengaturanKtp({ aktif: "ya", batas: 2, jedaDetik: 60 })).toBeNull();
    expect(bersihkanPengaturanKtp({ aktif: true, batas: "x", jedaDetik: 60 })).toBeNull();
  });

  it("pengaturanLatar(env) tetap berperilaku seperti 1.195.0 (dipakai uji lama)", () => {
    expect(pengaturanLatar({} as never)).toEqual({ aktif: true, batas: 2, jedaMs: 120_000 });
    expect(pengaturanKtpDariEnv({ ALETA_KTP_PIHAK_LATAR: "0" }).aktif).toBe(false);
  });
});

// ============================================================================
// B. tampilan Status Perkara
// ============================================================================
const baris = (o: Partial<KtpPihakBaris>): KtpPihakBaris => ({
  cabang: 1,
  urutan: 1,
  peran: "Penggugat",
  nama: "SITI AMINAH",
  tanggalKtp: "18/02/2012",
  tanggalKtpIso: "2012-02-18",
  kota: "Donggala",
  yakin: "cukup",
  cocok: "nik",
  sebab: "",
  sumberBaca: "teks-pdf",
  fileId: "f1",
  ...o,
});
const orang = (nama: string, pihakKe: number | null, jenis = "pihak") => ({ nama, pihakKe, jenis });

describe("B. cariKtpUntukPihak / kalimat keadaan", () => {
  it("dua Pemohon: tiap orang mendapat KTP-nya menurut NAMA SIPP, bukan urutan daftar (daftar tak berurutan)", () => {
    const daftar = [orang("Budi", 1), orang("Siti", 1)];
    const ktp = [
      baris({ urutan: 1, peran: "Pemohon I", nama: "BUDI SANTOSO", namaSipp: "Budi", tanggalKtp: "07/09/2014" }),
      baris({ urutan: 2, peran: "Pemohon II", nama: "SITI AMINAH", namaSipp: "Siti", tanggalKtp: "18/02/2012" }),
    ];
    // daftar status tidak menjamin urutan SIPP: Siti lebih dulu pun tetap Siti
    expect(cariKtpUntukPihak(orang("Siti", 1), [daftar[1], daftar[0]], ktp)?.tanggalKtp).toBe("18/02/2012");
    expect(cariKtpUntukPihak(orang("Budi", 1), daftar, ktp)?.tanggalKtp).toBe("07/09/2014");
  });

  it("nama SIPP dikenal tetapi tidak ada yang sama: bukan orang ini (tidak dipaksa ke KTP milik orang lain)", () => {
    const ktp = [baris({ namaSipp: "Budi" })];
    expect(cariKtpUntukPihak(orang("Siti", 1), [orang("Siti", 1), orang("Budi", 1)], ktp)).toBeNull();
  });

  it("bot lama (tanpa namaSipp): cocok lewat nama pada KTP; atau satu-satunya pihak + satu-satunya KTP; selain itu null", () => {
    const lama = [baris({ nama: "Siti Aminah" })];
    expect(cariKtpUntukPihak(orang("SITI  AMINAH", 1), [orang("SITI AMINAH", 1)], lama)).not.toBeNull();
    const tunggal = [baris({ nama: "S AMINAH" })];
    expect(cariKtpUntukPihak(orang("Siti Aminah", 1), [orang("Siti Aminah", 1)], tunggal)).not.toBeNull();
    // dua pihak sepihak, nama tak cocok -> tidak ditebak
    expect(cariKtpUntukPihak(orang("Siti Aminah", 1), [orang("Siti Aminah", 1), orang("Budi", 1)], tunggal)).toBeNull();
  });

  it("kuasa, saksi (cabang 5/null), dan cabang lain tidak mendapat baris", () => {
    const ktp = [baris({ namaSipp: "Siti" })];
    expect(cariKtpUntukPihak(orang("Siti", 1, "kuasa"), [], ktp)).toBeNull();
    expect(cariKtpUntukPihak(orang("Siti", 5), [], ktp)).toBeNull();
    expect(cariKtpUntukPihak(orang("Siti", null), [], ktp)).toBeNull();
    expect(cariKtpUntukPihak(orang("Siti", 2), [], ktp)).toBeNull();
  });

  const d = (o: Partial<KtpPihakStatusData>): KtpPihakStatusData => ({ ada: false, pihak: [], dokumenKtp: 1, belumDibaca: 0, tidakTerbaca: 0, takBertuan: 0, ...o });

  it("keadaan perkara disebut apa adanya: tak ada KTP, belum dibaca, tidak terbaca, tak bertuan, belum diunduh", () => {
    expect(catatanKtpPerkara(d({ dokumenKtp: 0 }), false)[0]).toMatch(/Tidak ada dokumen KTP/);
    expect(catatanKtpPerkara(d({ belumDibaca: 2 }), false)[0]).toMatch(/2 berkas KTP e-Court belum terbaca/);
    expect(catatanKtpPerkara(d({ belumDibaca: 2 }), true)[0]).toMatch(/sedang\/akan dibaca/);
    expect(catatanKtpPerkara(d({ tidakTerbaca: 1 }), false)[0]).toMatch(/tidak terbaca/);
    expect(catatanKtpPerkara(d({ takBertuan: 1 }), false)[0]).toMatch(/tidak cocok dengan pihak mana pun/);
    expect(catatanKtpPerkara(d({}), false)[0]).toMatch(/belum diunduh/);
    expect(catatanKtpPerkara(d({ ada: true }), false)).toEqual([]);
  });

  it("keterangan singkat per pihak yang belum bertanggal", () => {
    expect(keteranganTanpaKtp(d({ dokumenKtp: 0 }))).toMatch(/tidak ada berkas KTP/);
    expect(keteranganTanpaKtp(d({ belumDibaca: 1 }))).toBe("berkas KTP belum dibaca");
    expect(keteranganTanpaKtp(d({ belumDibaca: 1, sedangDibaca: true }))).toBe("berkas KTP sedang dibaca");
    expect(keteranganTanpaKtp(d({ tidakTerbaca: 1 }))).toMatch(/tidak terbaca/);
    expect(keteranganTanpaKtp(d({ ada: true }))).toMatch(/pihak ini belum/);
  });

  it("kode sebab -> kalimat; kode asing tampil apa adanya; bacaan ulang gagal menyebut tanggal lama dipertahankan", () => {
    expect(teksSebabKtp("ocr_belum_tersedia")).toMatch(/OCR belum terpasang/);
    expect(teksSebabKtp("pihak_ambigu")).toMatch(/lebih dari satu pihak/);
    expect(teksSebabKtp("kode_baru_entah")).toBe("kode baru entah");
    expect(teksSebabKtp("bacaan_ulang_gagal: ocr_gagal")).toMatch(/bacaan ulang gagal.*OCR gagal.*tanggal lama dipertahankan/);
    expect(teksSebabKtp("")).toBe("");
  });
});

// ============================================================================
// C. penyapu latar membaca pengaturan layar tiap detak
// ============================================================================
function depsPalsu() {
  const kirim: HasilBacaKtpPihak[] = [];
  const antrian: Array<[string[], number]> = [];
  const berkas: BerkasKtpAntri[] = [{ fileId: "a", documentKey: "dk", format: "pdf", ukuran: 10, nomorPerkara: "1/Pdt.G/2026/PA.Dgl", judul: "KTP" }];
  const deps: DepsKtp = {
    antrian: async (nomor, batas) => {
      antrian.push([nomor, batas]);
      return { berkas, versi: 1 };
    },
    ambil: async () => Buffer.from("x"),
    kirim: async (h) => {
      kirim.push(...h);
      return true;
    },
    baca: async () => [],
    sekarang: () => Date.now(),
  };
  return { deps, antrian, kirim };
}

describe("C. penyapu latar - pengaturan layar berlaku tanpa restart", () => {
  afterEach(() => {
    aturUlangKtpPihak();
    vi.useRealTimers();
  });

  it("env mematikan, layar menyalakan: detak tetap berdiri dan memakai batas/jeda layar; pemicu 'latar' terkirim", async () => {
    vi.useFakeTimers();
    const { deps, antrian, kirim } = depsPalsu();
    const layar = bersihkanPengaturanKtp({ aktif: true, batas: 4, jedaDetik: 30 });
    expect(mulaiPindaiKtpBerkala(deps, { ALETA_KTP_PIHAK_LATAR: "0" } as never, async () => layar)).toBe(true);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(antrian).toEqual([[[], 4]]);
    expect(kirim[0]).toMatchObject({ fileId: "a", pemicu: "latar" });
    const k = keadaanPenyapuKtp();
    expect(k.menyala).toBe(true);
    expect(k.efektif).toMatchObject({ aktif: true, sumber: "layar", batas: 4 });
    expect(k.terakhir).toMatchObject({ pemicu: "latar", dibaca: 1, antrianTerjangkau: true });
  });

  it("dimatikan dari layar saat berjalan: putaran berikutnya tidak terjadi; dinyalakan lagi: jalan lagi (tanpa restart)", async () => {
    vi.useFakeTimers();
    const { deps, antrian } = depsPalsu();
    let simpanan = bersihkanPengaturanKtp({ aktif: true, batas: 2, jedaDetik: 30 });
    mulaiPindaiKtpBerkala(deps, {} as never, async () => simpanan);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(antrian).toHaveLength(1);
    simpanan = bersihkanPengaturanKtp({ aktif: false, batas: 2, jedaDetik: 30 });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(antrian).toHaveLength(1); // mati
    expect(keadaanPenyapuKtp().efektif?.aktif).toBe(false);
    simpanan = bersihkanPengaturanKtp({ aktif: true, batas: 2, jedaDetik: 30 });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(antrian.length).toBeGreaterThanOrEqual(2);
  });

  it("jeda diubah dari layar: jeda baru yang berlaku (300 dtk tidak menjalankan putaran pada menit pertama)", async () => {
    vi.useFakeTimers();
    const { deps, antrian } = depsPalsu();
    let simpanan = bersihkanPengaturanKtp({ aktif: true, batas: 2, jedaDetik: 30 });
    mulaiPindaiKtpBerkala(deps, {} as never, async () => simpanan);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(antrian).toHaveLength(1);
    simpanan = bersihkanPengaturanKtp({ aktif: true, batas: 2, jedaDetik: 300 });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(antrian).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(antrian).toHaveLength(2);
  });

  it("pengaturan tak terbaca (galat basis data): jatuh ke env, penyapu tidak berhenti", async () => {
    vi.useFakeTimers();
    const { deps, antrian } = depsPalsu();
    mulaiPindaiKtpBerkala(deps, { ALETA_KTP_PIHAK_JEDA_MS: "30000" } as never, async () => {
      throw new Error("db mati");
    });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(antrian).toHaveLength(1);
    expect(keadaanPenyapuKtp().efektif).toMatchObject({ sumber: "env" });
  });
});

// ============================================================================
// D. rute
// ============================================================================
let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

const d = () => db as AletaDatabase;

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, any>; error?: { message: string } } };

async function panggil(
  rute: "pengaturan" | "status",
  cara: "GET" | "PUT" | "POST",
  opsi: { query?: string; badan?: unknown } = {}
): Promise<Hasil> {
  const modul =
    rute === "pengaturan"
      ? await import("@/app/api/aleta-ecourt/ktp-pihak-pengaturan/route")
      : await import("@/app/api/aleta-ecourt/ktp-pihak-status/route");
  const req = new NextRequest("http://localhost/api/x" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const fungsi = (modul as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara];
  const jawaban = await fungsi(req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

const NIK_RAHASIA = "7203094505900001";
let panggilanBot: string[] = [];

function botPalsu(jawab: (url: URL, init?: RequestInit) => unknown) {
  panggilanBot = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (masuk: any, init?: RequestInit) => {
    const url = new URL(String(masuk));
    panggilanBot.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
    return new Response(JSON.stringify(jawab(url, init)), { status: 200, headers: { "content-type": "application/json" } });
  });
}

const RINGKASAN = { perkara: 3, berkas: 5, terbaca: 3, tidakTerbaca: 1, bukanKtp: 0, belumDibaca: 1, pihakBertanggal: 4, terakhirDibaca: "2026-10-12T03:00:00.000Z", percobaanTercatat: 9 };

describe("D. rute pengaturan & histori (pg-mem berbenih)", () => {
  const envAsli = { ...process.env };
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    aturUlangKtpPihak();
    botPalsu((url) => (url.pathname.endsWith("/riwayat/ringkasan") ? { ok: true, ringkasan: RINGKASAN } : { ok: true }));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    process.env = { ...envAsli };
    aturUlangKtpPihak();
    await db?.close();
    db = null;
  });

  it("tanpa sesi 401; pegawai biasa 403 untuk membaca, menyimpan, dan baca ulang", async () => {
    aktor = null;
    expect((await panggil("pengaturan", "GET")).status).toBe(401);
    aktor = "usr-hakim";
    expect((await panggil("pengaturan", "GET")).status).toBe(403);
    expect((await panggil("pengaturan", "GET", { query: "bagian=riwayat&cari=1" })).status).toBe(403);
    expect((await panggil("pengaturan", "GET", { query: "bagian=perkara&nomor=1/Pdt.G/2026/PA.Dgl" })).status).toBe(403);
    expect((await panggil("pengaturan", "PUT", { badan: { aktif: false, batas: 2, jedaDetik: 60 } })).status).toBe(403);
    expect((await panggil("pengaturan", "POST", { badan: { aksi: "baca-ulang", nomor: "1/Pdt.G/2026/PA.Dgl" } })).status).toBe(403);
    expect(panggilanBot.filter((p) => p.startsWith("POST"))).toEqual([]); // tidak ada yang sampai ke bot
  });

  it("Admin DAN Super Admin dapat membaca halaman: tersimpan null, efektif dari env/bawaan, angka ringkas dari bot", async () => {
    for (const siapa of ["usr-admin", "usr-super"]) {
      aktor = siapa;
      const r = await panggil("pengaturan", "GET");
      expect(r.status).toBe(200);
      expect(r.isi.data).toMatchObject({ available: true, tersimpan: null, ringkasan: RINGKASAN });
      expect(r.isi.data.efektif).toMatchObject({ aktif: true, batas: 2, jedaMs: 120_000, sumber: "bawaan" });
      expect(r.isi.data.bawaanServer).toMatchObject({ sumber: "bawaan" });
      expect(r.isi.data.batas.perPutaran).toMatchObject({ min: 1, maks: 10 });
    }
  });

  it("PUT menyimpan: menang atas env (LATAR=0), tampil sebagai 'layar', dibaca penyapu (sumberPengaturanKtp), dan tercatat di jejak audit", async () => {
    process.env.ALETA_KTP_PIHAK_LATAR = "0";
    aktor = "usr-admin";
    const r = await panggil("pengaturan", "PUT", { badan: { aktif: true, batas: 6, jedaDetik: 90 } });
    expect(r.status).toBe(200);
    expect(r.isi.data.efektif).toEqual({ aktif: true, batas: 6, jedaMs: 90_000, sumber: "layar" });
    expect(r.isi.data.bawaanServer).toMatchObject({ aktif: false, sumber: "env" });
    expect(r.isi.data.tersimpan).toMatchObject({ aktif: true, batas: 6, jedaDetik: 90 });

    const { sumberPengaturanKtp } = await import("@/server/modules/aleta-ecourt/ktp-pihak-pengaturan");
    expect(await sumberPengaturanKtp()).toMatchObject({ aktif: true, batas: 6, jedaDetik: 90 });

    const baris = await d().prepare("SELECT action, actor_user_id, payload_json FROM audit_logs WHERE action = ?").all<Apa>("UPDATE_KTP_PIHAK_LATAR");
    expect(baris).toHaveLength(1);
    expect(baris[0].actor_user_id).toBe("usr-admin");
    expect(JSON.parse(baris[0].payload_json)).toMatchObject({ aktif: true, batas: 6, jedaDetik: 90 });
  });

  it("PUT dengan angka di luar batas atau tanpa nyala/mati ditolak 400 dan tidak menyimpan apa pun", async () => {
    for (const badan of [
      { aktif: true, batas: 0, jedaDetik: 60 },
      { aktif: true, batas: 11, jedaDetik: 60 },
      { aktif: true, batas: 2, jedaDetik: 5 },
      { aktif: true, batas: 2, jedaDetik: 10 ** 7 },
      { batas: 2, jedaDetik: 60 },
      { aktif: "ya", batas: 2, jedaDetik: 60 },
    ]) {
      const r = await panggil("pengaturan", "PUT", { badan });
      expect(r.status, JSON.stringify(badan)).toBe(400);
    }
    const { sumberPengaturanKtp } = await import("@/server/modules/aleta-ecourt/ktp-pihak-pengaturan");
    expect(await sumberPengaturanKtp()).toBeNull();
  });

  it("'Pakai bawaan server' menghapus pengaturan layar; env berlaku lagi; tercatat RESET", async () => {
    process.env.ALETA_KTP_PIHAK_LATAR = "0";
    await panggil("pengaturan", "PUT", { badan: { aktif: true, batas: 3, jedaDetik: 60 } });
    const r = await panggil("pengaturan", "PUT", { badan: { bawaan: true } });
    expect(r.status).toBe(200);
    expect(r.isi.data.tersimpan).toBeNull();
    expect(r.isi.data.efektif).toMatchObject({ aktif: false, sumber: "env" });
    const baris = await d().prepare("SELECT action FROM audit_logs WHERE action IN (?, ?) ORDER BY created_at").all<Apa>("UPDATE_KTP_PIHAK_LATAR", "RESET_KTP_PIHAK_LATAR");
    expect(baris.map((b: Apa) => b.action)).toEqual(["UPDATE_KTP_PIHAK_LATAR", "RESET_KTP_PIHAK_LATAR"]);
  });

  it("histori: pencarian dan rincian diteruskan ke bot dengan parameter yang benar (nomor di-encode, cari dipotong)", async () => {
    botPalsu((url) => {
      if (url.pathname.endsWith("/riwayat/perkara")) return { ok: true, nomorPerkara: url.searchParams.get("nomor"), dokumenKtp: 1, berkas: [], belumDibaca: [], percobaan: [] };
      if (url.pathname.endsWith("/riwayat")) return { ok: true, perkara: [{ nomorPerkara: "556/Pdt.G/2026/PA.Dgl", perkaraId: 1, berkas: 1, terbaca: 1, gagal: 0, pihakBertanggal: 1, terakhirDibaca: "2026-10-12T03:00:00.000Z" }], adaLagi: false };
      return { ok: true, ringkasan: RINGKASAN };
    });
    const cari = await panggil("pengaturan", "GET", { query: "bagian=riwayat&cari=556&mulai=30" });
    expect(cari.status).toBe(200);
    expect(cari.isi.data.perkara).toHaveLength(1);
    expect(panggilanBot[0]).toContain("/internal/aleta-bot/sipp/ktp-pihak/riwayat?");
    expect(panggilanBot[0]).toContain("cari=556");
    expect(panggilanBot[0]).toContain("mulai=30");
    const rinci = await panggil("pengaturan", "GET", { query: "bagian=perkara&nomor=" + encodeURIComponent("556/Pdt.G/2026/PA.Dgl") });
    expect(rinci.isi.data.riwayat.nomorPerkara).toBe("556/Pdt.G/2026/PA.Dgl");
    expect((await panggil("pengaturan", "GET", { query: "bagian=perkara&nomor=" })).status).toBe(400);
  });

  it("bot mati / rute belum ada: dijawab 'tidak tersedia' beserta sebab, bukan galat 500", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("<html>404</html>", { status: 404 }));
    const r = await panggil("pengaturan", "GET", { query: "bagian=riwayat&cari=1" });
    expect(r.status).toBe(200);
    expect(r.isi.data).toMatchObject({ available: false, perkara: [] });
    expect(String(r.isi.data.message)).toMatch(/dibangun ulang/);
    const h = await panggil("pengaturan", "GET");
    expect(h.isi.data.ringkasan).toBeNull();
    expect(String(h.isi.data.pesanRingkasan)).toMatch(/dibangun ulang/);
  });

  it("baca ulang: bot menandai, portal membaca dengan pemicu 'manual', jejak audit hanya nomor perkara dan hitungan", async () => {
    botPalsu((url, init) => {
      if (url.pathname.endsWith("/baca-ulang")) return { ok: true, ditandai: 2 };
      if (url.pathname.endsWith("/antrian")) return { ok: true, berkas: [], versi: 1 };
      return { ok: true, ringkasan: RINGKASAN, _badan: init?.body };
    });
    const r = await panggil("pengaturan", "POST", { badan: { aksi: "baca-ulang", nomor: "556/Pdt.G/2026/PA.Dgl" } });
    expect(r.status).toBe(200);
    expect(r.isi.data).toMatchObject({ available: true, ditandai: 2, dibaca: 0, terbaca: 0, sedangSibuk: false });
    expect(panggilanBot[0]).toBe("POST /internal/aleta-bot/sipp/ktp-pihak/baca-ulang");
    expect(panggilanBot[1]).toContain("/internal/aleta-bot/sipp/ktp-pihak/antrian?");
    expect(decodeURIComponent(panggilanBot[1])).toContain("nomor=556/Pdt.G/2026/PA.Dgl");
    expect(keadaanPenyapuKtp().terakhir).toMatchObject({ pemicu: "manual", dibaca: 0 });
    const audit = await d().prepare("SELECT entity_id, payload_json FROM audit_logs WHERE action = ?").all<Apa>("REBACA_KTP_PIHAK");
    expect(audit).toHaveLength(1);
    expect(audit[0].entity_id).toBe("556/Pdt.G/2026/PA.Dgl");
    expect(audit[0].payload_json).not.toMatch(/nik/i);
    expect((await panggil("pengaturan", "POST", { badan: { aksi: "lain", nomor: "1" } })).status).toBe(400);
    expect((await panggil("pengaturan", "POST", { badan: { aksi: "baca-ulang", nomor: "" } })).status).toBe(400);
  });

  // ---- rute Status Perkara -------------------------------------------------
  const DATA_BOT = {
    ok: true,
    ada: true,
    perkaraId: 7,
    nomorPerkara: "556/Pdt.G/2026/PA.Dgl",
    pihak: [
      { cabang: 1, urutan: 1, peran: "Penggugat", nama: "SITI AMINAH", namaSipp: "Siti Aminah", tanggalKtp: "18/02/2012", tanggalKtpIso: "2012-02-18", kota: "Donggala", yakin: "cukup", cocok: "nik", sebab: "", sumberBaca: "teks-pdf", fileId: "f1" },
    ],
    dokumenKtp: 2,
    belumDibaca: 0,
    tidakTerbaca: 0,
    takBertuan: 0,
  };

  it("Status Perkara: hakim 200 (status.data-pihak) dengan tanggal, yakin, sumber; NIK tidak ada; tidak memicu pembacaan OCR", async () => {
    botPalsu((url) => (url.pathname.endsWith("/ktp-pihak/perkara") ? { ...DATA_BOT, nikTersesat: NIK_RAHASIA } : { ok: true }));
    aktor = "usr-hakim";
    const r = await panggil("status", "GET", { query: "nomor=" + encodeURIComponent("556/Pdt.G/2026/PA.Dgl") });
    expect(r.status).toBe(200);
    expect(r.isi.data.pihak[0]).toMatchObject({ peran: "Penggugat", tanggalKtp: "18/02/2012", yakin: "cukup", namaSipp: "Siti Aminah" });
    expect(r.isi.data.catatan).toEqual([]);
    // hanya SATU panggilan ke bot (perkara); tak ada antrian/berkas/baca
    expect(panggilanBot).toHaveLength(1);
    expect(panggilanBot[0]).toContain("/ktp-pihak/perkara?");
  });

  it("Status Perkara: belum dibaca disebut, TANPA memicu pembacaan (berbeda dari rute panel ABT ?tunggu=1)", async () => {
    botPalsu(() => ({ ...DATA_BOT, ada: false, pihak: [], belumDibaca: 2 }));
    aktor = "usr-hakim";
    const r = await panggil("status", "GET", { query: "nomor=556" });
    expect(r.isi.data.catatan[0]).toMatch(/2 berkas KTP e-Court/);
    expect(panggilanBot.some((p) => p.includes("/antrian"))).toBe(false);
    expect(panggilanBot.some((p) => p.includes("/berkas"))).toBe(false);
  });

  it("Status Perkara: peran tanpa aksi status.data-pihak (kepegawaian) 403; tanpa sesi 401; nomor kosong dijawab kosong", async () => {
    botPalsu(() => DATA_BOT);
    aktor = "usr-kepeg";
    expect((await panggil("status", "GET", { query: "nomor=556" })).status).toBe(403);
    aktor = null;
    expect((await panggil("status", "GET", { query: "nomor=556" })).status).toBe(401);
    aktor = "usr-hakim";
    const kosong = await panggil("status", "GET");
    expect(kosong.status).toBe(200);
    expect(kosong.isi.data.ada).toBe(false);
  });

  it("bot tak terjangkau: Status Perkara menerima sebab, bukan 500", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw Object.assign(new Error("x"), { cause: { code: "ECONNREFUSED" } });
    });
    aktor = "usr-hakim";
    const r = await panggil("status", "GET", { query: "nomor=556" });
    expect(r.status).toBe(200);
    expect(r.isi.data).toMatchObject({ ada: false });
    expect(String(r.isi.data.sebab)).toMatch(/tidak terbaca dari ALETA Bot/);
  });
});

// ============================================================================
// E. bot SUNGGUHAN atas basis data laptop
// ============================================================================
async function mysqlHidup(): Promise<boolean> {
  return new Promise((ok) => {
    const s = net.connect({ host: "127.0.0.1", port: 3306 });
    const selesai = (v: boolean) => {
      s.destroy();
      ok(v);
    };
    s.setTimeout(800, () => selesai(false));
    s.on("connect", () => selesai(true));
    s.on("error", () => selesai(false));
  });
}
const dbAda = await mysqlHidup();

describe.skipIf(!dbAda)("E. riwayat & bacaan ulang atas bot sungguhan (aleta_bot + sipp_donggala)", () => {
  const AWAL = "UJI-KTP12-";
  const ROOT = path.join("D:/Aplikasi/aleta/tmp", `ktp-riwayat-uji-${process.pid}`);
  let K: Apa;
  let R: Apa;
  let sipp: (sql: string, p?: unknown[]) => Promise<Apa[]>;
  let bot: (sql: string, p?: unknown[]) => Promise<Apa>;
  let siap = false;
  let ada = false;
  let kembar: Apa;
  const H = (s: string) => (AWAL + "R" + s).padEnd(64, "0").slice(0, 64);

  beforeAll(async () => {
    process.env.ALETA_BOT_DB_SIPP_NAME = process.env.ALETA_BOT_DB_SIPP_NAME || "sipp_donggala";
    process.env.ALETA_BOT_DB_NAME = process.env.ALETA_BOT_DB_NAME || "aleta_bot";
    process.env.ALETA_BOT_ECOURT_DOCUMENT_ROOT = ROOT;
    mkdirSync(ROOT, { recursive: true });
    K = muat(path.join(AKAR, "aleta_bot/services/ktpPihakService.js"));
    R = muat(path.join(AKAR, "aleta_bot/services/ktpPihakRiwayatService.js"));
    sipp = (sql, p) => new Promise((ok, no) => muat(path.join(AKAR, "aleta_bot/db_config.js")).query(sql, p || [], (e: Error, r: Apa[]) => (e ? no(e) : ok(r))));
    bot = (sql, p) => muat(path.join(AKAR, "aleta_bot/services/botDbService.js")).query(sql, p || []);
    try {
      await R.pastikanSkemaRiwayat();
      siap = true;
      await bersihkan();
      kembar = (
        await sipp(
          `SELECT a.pihak_id, MIN(a.perkara_id) p1, MAX(a.perkara_id) p2 FROM perkara_pihak1 a JOIN pihak x ON x.id = a.pihak_id
            WHERE a.urutan = 1 AND LENGTH(x.nomor_indentitas) = 16 AND x.tanggal_lahir IS NOT NULL GROUP BY a.pihak_id HAVING COUNT(DISTINCT a.perkara_id) >= 2 ORDER BY p2 DESC LIMIT 1`
        )
      )[0];
      ada = Boolean(kembar);
    } catch {
      ada = false;
    }
  });

  const perkara = async (id: number) => (await sipp("SELECT perkara_id, nomor_perkara, tanggal_pendaftaran FROM perkara WHERE perkara_id = ?", [id]))[0];
  const pihak = async (id: number) =>
    (await sipp("SELECT pp.nama, p.nomor_indentitas AS nik, p.tanggal_lahir FROM perkara_pihak1 pp JOIN pihak p ON p.id = pp.pihak_id WHERE pp.perkara_id = ? AND pp.urutan = 1", [id]))[0];
  const isoDari = (x: Date | string) =>
    x instanceof Date ? `${String(x.getFullYear()).padStart(4, "0")}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}` : String(x).slice(0, 10);
  const dmyIso = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  const ktpSebelum = (hari: number, ...daftar: Array<Date | string>) => {
    const t = new Date(`${daftar.map(isoDari).sort()[0]}T12:00:00Z`);
    t.setUTCDate(t.getUTCDate() - hari);
    return t.toISOString().slice(0, 10);
  };

  async function buatBerkas(kode: string, nomor: string, perkaraId: number, hash: string) {
    const jalur = path.join(ROOT, `${AWAL}${kode}.pdf`);
    writeFileSync(jalur, Buffer.from("%PDF-1.4\n% berkas KTP uji\n"));
    await bot(
      `INSERT INTO aleta_bot_ecourt_documents (id, document_key, nomor_perkara, perkara_id, nomor_register, registrasi_ecourt, judul_dokumen, jenis_dokumen, peran_pengunggah,
         email_pengunggah, status_verifikasi, agenda, batas_unggah_teks, alasan_tidak_diberitahukan, pertama_terlihat, terakhir_terlihat, updated_at, gagal_beruntun, gagal_sebab, tidak_tersedia_sebab)
       VALUES (?, ?, ?, ?, '', '', 'KTP', '', '', '', 'belum', '', '', '', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP(), 0, '', '')`,
      [AWAL + "D" + kode, AWAL + "DK" + kode, nomor, perkaraId]
    );
    await bot(
      `INSERT INTO aleta_bot_ecourt_files (id, document_key, nomor_perkara, format, jalur_berkas, sidik_jari, ukuran_byte, tipe_isi, diunduh_pada, terakhir_diperiksa)
       VALUES (?, ?, ?, 'pdf', ?, ?, 100, 'application/pdf', UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [AWAL + "F" + kode, AWAL + "DK" + kode, nomor, jalur, hash]
    );
    return AWAL + "F" + kode;
  }

  async function bersihkan() {
    await bot("DELETE FROM aleta_bot_ktp_pihak_riwayat WHERE file_id LIKE ?", [AWAL + "%"]);
    await bot("DELETE FROM aleta_bot_ktp_pihak WHERE file_id LIKE ?", [AWAL + "%"]);
    await bot("DELETE FROM aleta_bot_ecourt_files WHERE id LIKE ?", [AWAL + "%"]);
    await bot("DELETE FROM aleta_bot_ecourt_documents WHERE id LIKE ?", [AWAL + "%"]);
  }

  afterAll(async () => {
    try {
      if (siap) await bersihkan();
    } finally {
      rmSync(ROOT, { recursive: true, force: true });
      for (const f of ["db_config.js", "bot_db_config.js"]) {
        try {
          muat(path.join(AKAR, "aleta_bot", f)).end?.();
        } catch {
          /* kolam sudah tertutup */
        }
      }
    }
  });

  beforeEach(async () => {
    if (siap) await bersihkan();
  });

  const ktpDari = (orang: Apa, tgl: string) => ({
    nik: String(orang.nik),
    nikSah: true,
    nama: String(orang.nama),
    tanggalLahir: dmyIso(isoDari(orang.tanggal_lahir)),
    tanggalTerbit: dmyIso(tgl),
    kotaTerbit: "Donggala",
    sumber: "teks-pdf",
  });

  it("fungsi murni: pola pencarian nomor, pemicu sah, ringkasan hasil tanpa NIK/nama", () => {
    expect(R.polaCariNomor("556")).toBe("556/%");
    expect(R.polaCariNomor("556/Pdt.G")).toBe("%556/Pdt.G%");
    expect(R.polaCariNomor("50%_")).toBe("%50\\%\\_%");
    expect(R.polaCariNomor("  ")).toBe("");
    expect(R.pemicuSah("MANUAL")).toBe("manual");
    expect(R.pemicuSah("asal")).toBe("");
    expect(R.dmyDariIso("2012-02-18")).toBe("18/02/2012");
    expect(R.waktuIso("2026-10-12 03:04:05")).toBe("2026-10-12T03:04:05.000Z");
    const r = R.ringkasHasilBaris([{ peran: "Penggugat", cabang: 1, urutan: 1, tanggalKtpIso: "2012-02-18", yakin: "cukup", cocok: "nik", sebab: "", nik: NIK_RAHASIA, nama: "SITI" }]);
    expect(JSON.stringify(r)).not.toContain(NIK_RAHASIA);
    expect(JSON.stringify(r)).not.toContain("SITI");
    expect(r[0]).toMatchObject({ peran: "Penggugat", tanggalKtp: "18/02/2012", yakin: "cukup" });
  });

  it("simpan mencatat riwayat (pemicu, percobaan, hasil per pihak); riwayatPerkara menjawab tanpa NIK; perkaraKtp membawa namaSipp", async () => {
    if (!ada) return;
    const p = await perkara(Number(kembar.p2));
    const f = await buatBerkas("R1", p.nomor_perkara, p.perkara_id, H("1"));
    const orang = await pihak(p.perkara_id);
    const tgl = ktpSebelum(400, p.tanggal_pendaftaran);
    await K.simpan([{ fileId: f, status: "terbaca", sebab: "", sumber: "teks-pdf", versi: K.VERSI_KTP_PIHAK, pemicu: "manual", ktp: [ktpDari(orang, tgl)] }]);

    const r = await R.riwayatPerkara(p.nomor_perkara);
    expect(r.ok).toBe(true);
    const b = r.berkas.find((x: Apa) => x.fileId === f);
    expect(b).toMatchObject({ status: "terbaca", judul: "KTP", format: "pdf", sumberBaca: "teks-pdf" });
    expect(b.pihak[0]).toMatchObject({ cabang: 1, urutan: 1, tanggalKtp: dmyIso(tgl), yakin: "cukup", cocok: "nik" });
    expect(b.dibacaPada).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/);
    const percobaan = r.percobaan.filter((x: Apa) => x.fileId === f);
    expect(percobaan).toHaveLength(1);
    expect(percobaan[0]).toMatchObject({ pemicu: "manual", status: "terbaca", jumlahKtp: 1, sumberBaca: "teks-pdf" });
    expect(percobaan[0].hasil[0]).toMatchObject({ tanggalKtp: dmyIso(tgl) });
    // NIK dan nama pada KTP tidak pernah keluar dari riwayat
    expect(JSON.stringify(r)).not.toContain(String(orang.nik));
    // perkaraKtp (panel ABT / Status Perkara) membawa nama pihak SIPP untuk pencocokan pasti
    const jawab = await K.perkaraKtp({ nomorPerkara: p.nomor_perkara });
    expect(jawab.pihak[0].namaSipp.replace(/\s+/g, " ")).toBe(String(orang.nama).replace(/\s+/g, " ").trim());
    expect(JSON.stringify(jawab)).not.toContain(String(orang.nik));
  });

  it("gagal dibaca dua kali: percobaan ke-1 dan ke-2 tercatat dengan sebab; berkas menunjukkan percobaan terakhir", async () => {
    if (!ada) return;
    const p = await perkara(Number(kembar.p2));
    const f = await buatBerkas("R2", p.nomor_perkara, p.perkara_id, H("2"));
    await K.simpan([{ fileId: f, status: "tidak_terbaca", sebab: "ocr_gagal", sumber: "", versi: K.VERSI_KTP_PIHAK, pemicu: "latar", ktp: [] }]);
    await K.simpan([{ fileId: f, status: "tidak_terbaca", sebab: "ocr_gagal", sumber: "", versi: K.VERSI_KTP_PIHAK, pemicu: "panel", ktp: [] }]);
    const r = await R.riwayatPerkara(p.nomor_perkara);
    const b = r.berkas.find((x: Apa) => x.fileId === f);
    expect(b).toMatchObject({ status: "tidak_terbaca", sebab: "ocr_gagal", percobaan: 2, pihak: [] });
    const per = r.percobaan.filter((x: Apa) => x.fileId === f);
    expect(per.map((x: Apa) => [x.percobaan, x.pemicu, x.sebab])).toEqual([
      [2, "panel", "ocr_gagal"],
      [1, "latar", "ocr_gagal"],
    ]);
  });

  it("berkas yang belum pernah dibaca tampil di belumDibaca (bukan hilang dari histori)", async () => {
    if (!ada) return;
    const p = await perkara(Number(kembar.p2));
    const f = await buatBerkas("R3", p.nomor_perkara, p.perkara_id, H("3"));
    const r = await R.riwayatPerkara(p.nomor_perkara);
    expect(r.belumDibaca.map((x: Apa) => x.fileId)).toContain(f);
    expect(r.dokumenKtp).toBeGreaterThanOrEqual(1);
  });

  it("BACAAN ULANG yang gagal TIDAK menghapus tanggal lama; dicatat 'bacaan_ulang_gagal' dan tidak diantre terus-menerus; yang berhasil menggantikan", async () => {
    if (!ada) return;
    const p = await perkara(Number(kembar.p2));
    const f = await buatBerkas("R4", p.nomor_perkara, p.perkara_id, H("4"));
    const orang = await pihak(p.perkara_id);
    const lama = ktpSebelum(400, p.tanggal_pendaftaran);
    const baru = ktpSebelum(500, p.tanggal_pendaftaran);
    await K.simpan([{ fileId: f, status: "terbaca", sumber: "teks-pdf", versi: K.VERSI_KTP_PIHAK, ktp: [ktpDari(orang, lama)] }]);
    expect((await K.antrian({ nomor: [p.nomor_perkara], batas: 30 })).filter((x: Apa) => x.fileId === f)).toHaveLength(0);

    // minta baca ulang: berkas masuk antrian lagi, tanggal lama masih ada
    const tanda = await R.bacaUlangPerkara(p.nomor_perkara);
    expect(tanda).toMatchObject({ ok: true });
    expect(tanda.ditandai).toBeGreaterThanOrEqual(1);
    expect((await K.antrian({ nomor: [p.nomor_perkara], batas: 30 })).filter((x: Apa) => x.fileId === f)).toHaveLength(1);
    expect((await K.perkaraKtp({ nomorPerkara: p.nomor_perkara })).pihak[0].tanggalKtp).toBe(dmyIso(lama));

    // bacaan ulang GAGAL: tanggal lama tetap, tidak diantre lagi, kegagalan tercatat
    await K.simpan([{ fileId: f, status: "tidak_terbaca", sebab: "ocr_gagal", sumber: "", versi: K.VERSI_KTP_PIHAK, pemicu: "manual", ktp: [] }]);
    const sesudahGagal = await K.perkaraKtp({ nomorPerkara: p.nomor_perkara });
    expect(sesudahGagal.pihak[0].tanggalKtp).toBe(dmyIso(lama));
    expect((await K.antrian({ nomor: [p.nomor_perkara], batas: 30 })).filter((x: Apa) => x.fileId === f)).toHaveLength(0);
    const r1 = await R.riwayatPerkara(p.nomor_perkara);
    expect(r1.berkas.find((x: Apa) => x.fileId === f)).toMatchObject({ status: "terbaca" });
    expect(r1.percobaan.find((x: Apa) => x.fileId === f && x.status === "tidak_terbaca").sebab).toMatch(/^bacaan_ulang_gagal: ocr_gagal/);

    // bacaan ulang BERHASIL dengan tanggal lain: menggantikan
    await R.bacaUlangPerkara(p.nomor_perkara);
    await K.simpan([{ fileId: f, status: "terbaca", sumber: "ocr", versi: K.VERSI_KTP_PIHAK, pemicu: "manual", ktp: [{ ...ktpDari(orang, baru), sumber: "ocr" }] }]);
    expect((await K.perkaraKtp({ nomorPerkara: p.nomor_perkara })).pihak[0].tanggalKtp).toBe(dmyIso(baru));
  });

  it("berkas berisi sama di perkara lain: disalin dan dicatat dengan pemicu 'salinan'", async () => {
    if (!ada) return;
    const p1 = await perkara(Number(kembar.p1));
    const p2 = await perkara(Number(kembar.p2));
    const f1 = await buatBerkas("R5A", p1.nomor_perkara, p1.perkara_id, H("5"));
    const f2 = await buatBerkas("R5B", p2.nomor_perkara, p2.perkara_id, H("5"));
    const orang = await pihak(p2.perkara_id);
    const tgl = ktpSebelum(400, p1.tanggal_pendaftaran, p2.tanggal_pendaftaran);
    await K.simpan([{ fileId: f2, status: "terbaca", sumber: "teks-pdf", versi: K.VERSI_KTP_PIHAK, pemicu: "latar", ktp: [ktpDari(orang, tgl)] }]);
    const r1 = await R.riwayatPerkara(p1.nomor_perkara);
    const per = r1.percobaan.filter((x: Apa) => x.fileId === f1);
    expect(per).toHaveLength(1);
    expect(per[0].pemicu).toBe("salinan");
    const r2 = await R.riwayatPerkara(p2.nomor_perkara);
    expect(r2.percobaan.find((x: Apa) => x.fileId === f2).pemicu).toBe("latar");
  });

  it("daftarPerkara: cari angka = awalan nomor; cari sebagian teks; tak ada yang cocok = kosong; ringkasan konsisten", async () => {
    if (!ada) return;
    const p = await perkara(Number(kembar.p2));
    const f = await buatBerkas("R6", p.nomor_perkara, p.perkara_id, H("6"));
    const orang = await pihak(p.perkara_id);
    await K.simpan([{ fileId: f, status: "terbaca", sumber: "teks-pdf", versi: K.VERSI_KTP_PIHAK, ktp: [ktpDari(orang, ktpSebelum(400, p.tanggal_pendaftaran))] }]);
    const angka = String(p.nomor_perkara).split("/")[0];
    const a = await R.daftarPerkara({ cari: angka, batas: 100 });
    const ini = a.perkara.find((x: Apa) => x.nomorPerkara === p.nomor_perkara);
    expect(ini).toMatchObject({ berkas: 1, terbaca: 1, gagal: 0, pihakBertanggal: 1 });
    expect(a.perkara.every((x: Apa) => String(x.nomorPerkara).startsWith(`${angka}/`))).toBe(true);
    const b = await R.daftarPerkara({ cari: "/Pdt.", batas: 100 });
    expect(b.perkara.some((x: Apa) => x.nomorPerkara === p.nomor_perkara)).toBe(true);
    expect((await R.daftarPerkara({ cari: "TIDAK-ADA-NOMOR-INI-XYZ" })).perkara).toEqual([]);
    const s = await R.ringkasanRiwayat();
    expect(s.terbaca).toBeGreaterThanOrEqual(1);
    expect(s.berkas).toBeGreaterThanOrEqual(s.terbaca);
    expect(s.belumDibaca).toBeGreaterThanOrEqual(0);
    expect(s.pihakBertanggal).toBeGreaterThanOrEqual(1);
    expect(s.percobaanTercatat).toBeGreaterThanOrEqual(1);
    expect(s.terakhirDibaca).toMatch(/Z$/);
  });
});

