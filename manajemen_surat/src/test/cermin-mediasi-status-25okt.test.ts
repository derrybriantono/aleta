// @vitest-environment node
/**
 * ============================================================================
 * CERMIN: JADWAL MEDIASI + HITUNGAN TAG STATUS PERKARA (A5, 25 Okt 2026)
 * ============================================================================
 *
 *   A. migrasi 0096 = DDL schema.ts, jurnal idx 82, kolom benar-benar ada;
 *   B. aturan murni: rentang lingkup tag (dibandingkan pembanding terpisah), dasar tanggal tertutup,
 *      saklar baru MATI bawaan;
 *   C. Jadwal Mediasi: putaran, hanya selisih yang ditulis, yang hilang dihapus kecuali terpotong/tak
 *      terbaca; UJI PERBANDINGAN rute (cermin = jalur lama); kembali ke SIPP; baca tulisan sendiri;
 *      sisa tenggang dihitung terhadap HARI INI;
 *   D. penanda: selisih anggota, siklus lengkap/terpotong/gagal, dipercepat tulisan;
 *      UJI PERBANDINGAN hitungan tag (dasar x periode) cermin = jalur lama; toleransi tulisan 90 detik;
 *   E. bot: cerminTagService, tanggal dasar tambahan pada ringkasan perkara, rute baru hanya GET.
 *
 * Data rekaan saja. Tidak ada jaringan dan tidak ada SIPP sungguhan.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  KOLOM_DASAR_TANGGAL,
  PENGATURAN_CERMIN_BAWAAN,
  bersihkanKeadaanMediasi,
  bersihkanKeadaanTag,
  bersihkanPengaturanCermin,
  keadaanPemindaiAwal,
  kolomDasarTanggal,
  rentangLingkupTag,
  type PengaturanCermin,
} from "@/lib/cermin";
import { createAletaDatabase, IN_MEMORY_TABLE_PERSISTENCE_ORDER, type AletaDatabase } from "@/server/db/client";
import { DDL_ALETA_CERMIN_PERKARA_TANGGAL } from "@/server/db/schema";
import { getGatewayTagPerkara } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import type { BotCerminLengkap, MediasiSumber, PerkaraSumber } from "@/server/modules/cermin/bot";
import { KUNCI_JEJAK, tulisJejak } from "@/server/modules/cermin/jejak";
import { buangSinggahKesegaran } from "@/server/modules/cermin/kesegaran";
import {
  aturUlangMediasiCermin,
  bacaMediasiDariCermin,
  bolehMediasiDariCermin,
  jendelaMediasi,
  kunciBarisMediasi,
  muatKeadaanMediasi,
  putaranMediasi,
  urutanMediasi,
  type DepsMediasi,
} from "@/server/modules/cermin/mediasi";
import { aturUlangPembaruanCermin } from "@/server/modules/cermin/pembaruan";
import { buangSinggahPengaturanCermin } from "@/server/modules/cermin/pengaturan";
import { simpanKelompokPerkara } from "@/server/modules/cermin/penyimpan";
import { aturTulisCerminTerakhir } from "@/server/modules/cermin/setelah-tulisan";
import { TOLERANSI_TULISAN_TAG_MS, bacaTagDariCermin } from "@/server/modules/cermin/status-cermin";
import { TAG_PER_DETAK, aturUlangTagCermin, gantiAnggotaTag, muatKeadaanTag, putaranTag, type DepsTag } from "@/server/modules/cermin/tag";
import { tandaiTulisan } from "@/server/shared/singgah-singkat";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const muatBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));

let dbRute: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => dbRute };
});

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

// ============================================================================
// A. migrasi 0096
// ============================================================================
describe("A. migrasi 0096", () => {
  const sql = baca("manajemen_surat/drizzle/0096_aleta_cermin_perkara_tanggal.sql");

  it("pernyataan berkas SQL = DDL_ALETA_CERMIN_PERKARA_TANGGAL; tidak ada tabel baru, jadi daftar cadangan tetap utuh", () => {
    expect(pernyataan(sql)).toEqual([...DDL_ALETA_CERMIN_PERKARA_TANGGAL.kolom].map((s) => pernyataan(s)[0]));
    expect(sql).not.toMatch(/CREATE TABLE/i);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_cermin_perkara");
  });

  it("jurnal: 0096 idx 82 sesudah 0090 (idx 81), urut dan tanpa ganda", () => {
    const j = JSON.parse(baca("manajemen_surat/drizzle/meta/_journal.json")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    expect(j.entries.find((x) => x.tag === "0096_aleta_cermin_perkara_tanggal")?.idx).toBe(82);
    expect(j.entries.find((x) => x.tag === "0090_aleta_cermin_perkara")?.idx).toBe(81);
    const idx = j.entries.map((x) => x.idx);
    expect(new Set(idx).size).toBe(idx.length);
    const when = j.entries.map((x) => x.when);
    expect(when).toEqual([...when].sort((a, b) => a - b));
  });

  it("keempat kolom benar-benar ada dan bawaannya kosong (pg-mem)", async () => {
    const db = await createAletaDatabase({ useInMemory: true, seed: false });
    try {
      await db.run("INSERT INTO aleta_cermin_perkara (perkara_id, cermin_diperbarui) VALUES ('1', 'x')");
      const [r] = await db.queryAll<Record<string, string>>("SELECT tanggal_sidang_maks, tanggal_akta, tanggal_relaas, tanggal_ikrar FROM aleta_cermin_perkara");
      expect(r).toEqual({ tanggal_sidang_maks: "", tanggal_akta: "", tanggal_relaas: "", tanggal_ikrar: "" });
    } finally {
      await db.close();
    }
  });
});

// ============================================================================
// B. aturan murni
// ============================================================================
/** Pembanding rentang periode, ditulis terpisah dengan objek Date lokal (bukan aritmetika UTC). */
function rentangAcuan(periode: string, acuan: string): { dari: string; sampai: string } {
  const [y, m, h] = acuan.split("-").map(Number);
  const d = new Date(y, m - 1, h);
  const f = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  if (periode === "hari") return { dari: f(d), sampai: f(d) };
  if (periode === "kemarin") {
    const k = new Date(y, m - 1, h - 1);
    return { dari: f(k), sampai: f(k) };
  }
  if (periode === "tahun") return { dari: `${y}-01-01`, sampai: `${y}-12-31` };
  if (periode === "semester") return m <= 6 ? { dari: `${y}-01-01`, sampai: `${y}-06-30` } : { dari: `${y}-07-01`, sampai: `${y}-12-31` };
  if (periode === "triwulan") {
    const awal = Math.floor((m - 1) / 3) * 3;
    return { dari: f(new Date(y, awal, 1)), sampai: f(new Date(y, awal + 3, 0)) };
  }
  if (periode === "bulan") return { dari: f(new Date(y, m - 1, 1)), sampai: f(new Date(y, m, 0)) };
  // pekan Senin-Minggu
  const hariKe = d.getDay() === 0 ? 7 : d.getDay();
  return { dari: f(new Date(y, m - 1, h - (hariKe - 1))), sampai: f(new Date(y, m - 1, h - (hariKe - 1) + 6)) };
}

describe("B. aturan murni", () => {
  it("rentang lingkup tag = pembanding terpisah untuk tiap periode dan banyak acuan (akhir bulan/tahun, Minggu, Senin)", () => {
    const acuan = ["2026-10-25", "2026-10-26", "2026-01-01", "2026-12-31", "2026-02-28", "2026-03-31", "2026-06-30", "2026-07-01", "2026-11-15"];
    for (const a of acuan) {
      for (const p of ["hari", "kemarin", "tahun", "semester", "triwulan", "bulan", "pekan"]) {
        expect(rentangLingkupTag(p, a, "", "", "2000-01-01"), `${p} ${a}`).toEqual(rentangAcuan(p, a));
      }
    }
  });

  it("total = tanpa saringan; rentang memakai dari/sampai apa adanya; acuan tak sah jatuh ke hari ini", () => {
    expect(rentangLingkupTag("total", "", "", "", "2026-10-25")).toEqual({ dari: "", sampai: "" });
    expect(rentangLingkupTag("", "", "", "", "2026-10-25")).toEqual({ dari: "", sampai: "" });
    expect(rentangLingkupTag("rentang", "", "2026-01-01", "2026-03-31", "2026-10-25")).toEqual({ dari: "2026-01-01", sampai: "2026-03-31" });
    expect(rentangLingkupTag("bulan", "ngawur", "", "", "2026-10-25")).toEqual({ dari: "2026-10-01", sampai: "2026-10-31" });
  });

  it("dasar tanggal himpunan tertutup: kunci asing jatuh ke pendaftaran, tidak pernah nama kolom dari luar", () => {
    expect(Object.keys(KOLOM_DASAR_TANGGAL).sort()).toEqual(["akta", "bht", "daftar", "ikrar", "minutasi", "putus", "relaas", "sidang"]);
    expect(kolomDasarTanggal("putus")).toBe("tanggal_putusan");
    expect(kolomDasarTanggal("sidang")).toBe("tanggal_sidang_maks");
    expect(kolomDasarTanggal("x; DROP TABLE aleta_cermin_perkara")).toBe("tanggal_pendaftaran");
    expect(kolomDasarTanggal("constructor")).toBe("tanggal_pendaftaran");
  });

  it("pengaturan baru: bawaan, dijepit, dan saklar layar tetap MATI", () => {
    expect(PENGATURAN_CERMIN_BAWAAN).toMatchObject({ mediasiHariLalu: 3, mediasiHariDepan: 21, mediasiMenit: 10, selangTagMenit: 10 });
    const p = bersihkanPengaturanCermin({ mediasiHariLalu: 999, mediasiHariDepan: -5, mediasiMenit: 0, selangTagMenit: 99999 })!;
    expect(p).toMatchObject({ mediasiHariLalu: 31, mediasiHariDepan: 0, mediasiMenit: 1, selangTagMenit: 240 });
    expect(p.layar).toEqual({ mediasi: false, status: false, jadwal: false, ekstensi: false, kabar: false });
  });

  it("keadaan mediasi/tag yang rusak jatuh ke awal; daftar dibatasi", () => {
    expect(bersihkanKeadaanMediasi("x").terakhir).toBe("");
    expect(bersihkanKeadaanTag(null).antrian).toEqual([]);
    expect(bersihkanKeadaanTag({ antrian: ["a", 5, "b"], tidakLengkap: "bukan larik" })).toMatchObject({ antrian: ["a", "b"], tidakLengkap: [] });
  });
});

// ============================================================================
// Perlengkapan bersama
// ============================================================================
const HARI = "2026-10-25";
const SEKARANG_MS = Date.parse("2026-10-25T14:00:00Z"); // 22.00 WITA Minggu 25 Okt
let db: AletaDatabase;
let jam = SEKARANG_MS;
let pengaturan: PengaturanCermin;

function pasangPengaturan(p: Omit<Partial<PengaturanCermin>, "layar"> & { layar?: Partial<PengaturanCermin["layar"]> } = {}) {
  pengaturan = {
    ...PENGATURAN_CERMIN_BAWAAN,
    pemindaiAktif: true,
    ...p,
    layar: { ...PENGATURAN_CERMIN_BAWAAN.layar, ...(p.layar ?? {}) },
  };
}
async function simpanPengaturanDb() {
  await db
    .prepare("INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai")
    .run("*sistem*", "sistem:cermin-perkara", JSON.stringify(pengaturan), "x");
  buangSinggahPengaturanCermin();
  buangSinggahKesegaran();
}
async function pemindaianSelesai() {
  const k = keadaanPemindaiAwal();
  k.status = "selesai";
  k.tahap = "selesai";
  k.mulaiPada = new Date(jam - 3_600_000).toISOString();
  k.sidang.awal = "2026-10-01";
  k.sidang.akhir = "2026-11-30";
  await tulisJejak(db, KUNCI_JEJAK.pemindai, k);
}
/** Pembaruan sidang dianggap segar (syarat kesegaran dasar). */
async function pembaruanSegar() {
  const putaran = new Date(jam - 20_000).toISOString();
  await tulisJejak(db, KUNCI_JEJAK.pembaruan, { tanda: "2026-10-25 21:59:00", putaranTerakhir: putaran, panasTerakhir: putaran, antrianTanggal: [], terakhir: null, galat: { terakhir: "", pada: "", beruntun: 0 }, tidakTerbaca: [] });
  buangSinggahKesegaran();
}

beforeEach(async () => {
  dbRute = db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-super";
  jam = SEKARANG_MS;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(jam);
  process.env.ALETA_CERMIN_STATUS_UJI = "1";
  process.env.ALETA_SINGGAH_TAG_MS = "0";
  pasangPengaturan();
  aturUlangPembaruanCermin();
  aturUlangMediasiCermin();
  aturUlangTagCermin();
  aturTulisCerminTerakhir(0);
  buangSinggahPengaturanCermin();
  buangSinggahKesegaran();
  tandaiTulisan();
});
afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.ALETA_CERMIN_STATUS_UJI;
  delete process.env.ALETA_SINGGAH_TAG_MS;
  aturUlangMediasiCermin();
  aturUlangTagCermin();
  aturTulisCerminTerakhir(0);
  await db.close();
  dbRute = null;
});

// ============================================================================
// C. Jadwal Mediasi
// ============================================================================
function mediasi(id: number, perkaraId: number, nomor: string, tanggal: string, jamPertemuan: string, lebih: Record<string, unknown> = {}): MediasiSumber {
  return {
    mediasiId: String(id),
    perkaraId: String(perkaraId),
    nomorPerkara: nomor,
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 15,
    jenisPerkaraId: 345,
    tanggal,
    jam: jamPertemuan,
    sampaiJam: "",
    tempat: "Ruang Mediasi",
    dihadiri: "1",
    ditunda: false,
    mediator: "Mediator Rekaan",
    statusMediator: "Hakim",
    jenisMediasi: "",
    nomorSk: "",
    penetapanMediator: "2026-10-10",
    laporanMediator: "",
    selesai: false,
    hasil: "",
    hasilTeks: "",
    lamaHari: 12,
    tenggatPerma: "2026-11-09",
    sisaHariTenggat: 15,
    lewatTenggang: false,
    pihak: { penggugat: ["Rekaan A"], tergugat: ["Rekaan B"] },
    kumulasi: null,
    kumulasiTerbaca: true,
    ...lebih,
  } as MediasiSumber;
}

const MEDIASI_REKAAN: MediasiSumber[] = [
  mediasi(1, 201, "30/Pdt.G/2026/PA.Rekaan", HARI, "09:00"),
  mediasi(2, 202, "4/Pdt.G/2026/PA.Rekaan", HARI, "09:00"),
  mediasi(3, 203, "100/Pdt.G/2026/PA.Rekaan", HARI, "10:00", { tenggatPerma: "2026-10-20", sisaHariTenggat: -5, lewatTenggang: true }),
  mediasi(4, 204, "7/Pdt.G/2026/PA.Rekaan", "2026-10-26", "08:00"),
  mediasi(5, 205, "8/Pdt.G/2026/PA.Rekaan", "2026-10-24", "13:00", { laporanMediator: "2026-10-24", selesai: true, tenggatPerma: "2026-10-01", sisaHariTenggat: null, lewatTenggang: false }),
];

function urutanSql(daftar: MediasiSumber[]) {
  // Pembanding ORDER BY jalur lama: tanggal, jam, nomor perkara (teks).
  return [...daftar].sort((a, b) => `${a.tanggal}|${a.jam}|${a.nomorPerkara}`.localeCompare(`${b.tanggal}|${b.jam}|${b.nomorPerkara}`));
}

class MediasiPalsu {
  data: MediasiSumber[] = [];
  terbaca = true;
  alasan = "";
  rusak = "";
  potongJikaLebihDari = 0;
  panggilan: string[] = [];
  bot(): Pick<BotCerminLengkap, "mediasi"> {
    return {
      mediasi: async (dari, sampai) => {
        this.panggilan.push(`mediasi:${dari}:${sampai}`);
        if (this.rusak) return { ok: false, error: this.rusak };
        const dalam = urutanSql(this.data.filter((m) => String(m.tanggal) >= dari && String(m.tanggal) <= sampai));
        const lebar = Math.round((Date.parse(sampai) - Date.parse(dari)) / 86_400_000) + 1;
        if (this.potongJikaLebihDari > 0 && lebar > this.potongJikaLebihDari) {
          return { ok: true, data: { dari, sampai, terbaca: this.terbaca, alasan: this.alasan, terpotong: true, mediasi: dalam.slice(0, 1) } };
        }
        return { ok: true, data: { dari, sampai, terbaca: this.terbaca, alasan: this.alasan, terpotong: false, mediasi: dalam } };
      },
    };
  }
}

const depsMediasi = (palsu: MediasiPalsu): DepsMediasi => ({ db: async () => db, bot: palsu.bot(), pengaturan: async () => pengaturan, sekarang: () => new Date(jam) });
const idMediasiCermin = async () => (await db.queryAll<{ id: string }>("SELECT id FROM aleta_cermin_mediasi ORDER BY id")).map((r) => String(r.id));

describe("C. Jadwal Mediasi dari cermin", () => {
  it("kunci baris: mediasiId|tanggal|jam, baris kembar diberi nomor urut", () => {
    const k = kunciBarisMediasi([mediasi(1, 1, "a", HARI, "09:00"), mediasi(1, 1, "a", HARI, "09:00"), mediasi(1, 1, "a", HARI, "09:00"), mediasi(2, 2, "b", HARI, "09:00")]);
    expect(k).toEqual([`1|${HARI}|09:00`, `1|${HARI}|09:00#2`, `1|${HARI}|09:00#3`, `2|${HARI}|09:00`]);
  });

  it("saklar pemindai mati / pemindaian belum selesai: tidak menyentuh bot", async () => {
    const palsu = new MediasiPalsu();
    pasangPengaturan({ pemindaiAktif: false });
    expect((await putaranMediasi(depsMediasi(palsu))).alasan).toBe("mati");
    pasangPengaturan();
    expect((await putaranMediasi(depsMediasi(palsu))).alasan).toBe("menunggu-pemindaian");
    expect(palsu.panggilan).toEqual([]);
  });

  it("putaran menulis jendela mediasi; yang sama tidak ditulis ulang; yang hilang dihapus", async () => {
    await pemindaianSelesai();
    const palsu = new MediasiPalsu();
    palsu.data = [...MEDIASI_REKAAN];
    const r1 = await putaranMediasi(depsMediasi(palsu));
    expect(r1).toMatchObject({ alasan: "ok", baris: 5, ditulis: 5 });
    expect((await muatKeadaanMediasi(db)).terakhir).toBe(new Date(jam).toISOString());
    // Jendela bawaan: 22 Okt .. 15 Nov.
    expect(palsu.panggilan[0]).toBe("mediasi:2026-10-22:2026-11-15");
    jam += 11 * 60_000;
    vi.setSystemTime(jam);
    const r2 = await putaranMediasi(depsMediasi(palsu));
    expect(r2.ditulis).toBe(0);
    palsu.data = palsu.data.filter((m) => m.mediasiId !== "4"); // pertemuan 4 dihapus di SIPP
    jam += 11 * 60_000;
    vi.setSystemTime(jam);
    await putaranMediasi(depsMediasi(palsu));
    expect(await idMediasiCermin()).toEqual([`1|${HARI}|09:00`, `2|${HARI}|09:00`, `3|${HARI}|10:00`, "5|2026-10-24|13:00"]);
    expect((await muatKeadaanMediasi(db)).dihapus).toBe(1);
  });

  it("selang dihormati; paksa melewatinya; galat tidak memajukan 'terakhir' dan jeda bertambah", async () => {
    await pemindaianSelesai();
    const palsu = new MediasiPalsu();
    palsu.data = [...MEDIASI_REKAAN];
    await putaranMediasi(depsMediasi(palsu));
    const n = palsu.panggilan.length;
    jam += 60_000;
    vi.setSystemTime(jam);
    expect((await putaranMediasi(depsMediasi(palsu))).alasan).toBe("menunggu-selang");
    expect(palsu.panggilan.length).toBe(n);
    palsu.rusak = "SIPP mati";
    expect((await putaranMediasi(depsMediasi(palsu), { paksa: true })).alasan).toBe("galat");
    const k = await muatKeadaanMediasi(db);
    expect(k.terakhir).toBe(new Date(SEKARANG_MS).toISOString()); // tidak maju
    expect(k.galat).toMatchObject({ beruntun: 1 });
  });

  it("jadwal mediasi tak terbaca dari SIPP (tabel/kolom tak dikenal) = galat, TIDAK menghapus apa pun", async () => {
    await pemindaianSelesai();
    const palsu = new MediasiPalsu();
    palsu.data = [...MEDIASI_REKAAN];
    await putaranMediasi(depsMediasi(palsu));
    palsu.terbaca = false;
    palsu.alasan = "Tabel perkara_jadwal_mediasi tidak ada";
    palsu.data = [];
    const r = await putaranMediasi(depsMediasi(palsu), { paksa: true });
    expect(r.alasan).toBe("galat");
    expect((await idMediasiCermin()).length).toBe(5);
  });

  it("rentang terpotong dibelah; tidak satu pertemuan pun hilang", async () => {
    await pemindaianSelesai();
    const palsu = new MediasiPalsu();
    palsu.data = [...MEDIASI_REKAAN];
    palsu.potongJikaLebihDari = 1;
    await putaranMediasi(depsMediasi(palsu));
    expect((await idMediasiCermin()).length).toBe(5);
    expect(palsu.panggilan.length).toBeGreaterThan(10);
  });

  // ---- keputusan dan pembacaan -------------------------------------------
  const sekarang = () => new Date(jam);
  it("bolehMediasiDariCermin: saklar mati bawaan; pencarian, rentang tak sah, di luar jendela -> tidak", () => {
    const nyala = { ...PENGATURAN_CERMIN_BAWAAN, layar: { ...PENGATURAN_CERMIN_BAWAAN.layar, mediasi: true } };
    expect(bolehMediasiDariCermin({ dari: HARI, sampai: HARI }, PENGATURAN_CERMIN_BAWAAN, sekarang())).toEqual({ boleh: false, alasan: "saklar-mati" });
    expect(bolehMediasiDariCermin({ dari: HARI, sampai: HARI, cari: "x" }, nyala, sekarang())).toEqual({ boleh: false, alasan: "ada-pencarian" });
    expect(bolehMediasiDariCermin({ dari: "", sampai: "" }, nyala, sekarang())).toEqual({ boleh: false, alasan: "rentang-tidak-sah" });
    expect(bolehMediasiDariCermin({ dari: "2026-10-01", sampai: "2026-10-02" }, nyala, sekarang())).toEqual({ boleh: false, alasan: "di-luar-jendela" });
    expect(bolehMediasiDariCermin({ dari: "2026-10-22", sampai: "2026-11-15" }, nyala, sekarang())).toEqual({ boleh: true, dari: "2026-10-22", sampai: "2026-11-15" });
    expect(jendelaMediasi(sekarang(), nyala)).toEqual({ hari: HARI, dari: "2026-10-22", sampai: "2026-11-15" });
  });

  it("urutanMediasi = ORDER BY jalur lama (tanggal, jam, nomor perkara sebagai teks)", () => {
    const acak = [...MEDIASI_REKAAN].reverse();
    expect(acak.sort(urutanMediasi).map((m) => m.mediasiId)).toEqual(urutanSql(MEDIASI_REKAAN).map((m) => m.mediasiId));
  });

  async function siapMediasi(data = MEDIASI_REKAAN) {
    pasangPengaturan({ layar: { mediasi: true } });
    await simpanPengaturanDb();
    await pemindaianSelesai();
    await pembaruanSegar();
    const palsu = new MediasiPalsu();
    palsu.data = [...data];
    await putaranMediasi(depsMediasi(palsu), { paksa: true });
    buangSinggahKesegaran();
    return palsu;
  }

  it("segar + saklar menyala: dibaca dari cermin dengan tanda; sisa tenggang dihitung terhadap HARI INI, bukan hari baris dihitung", async () => {
    await siapMediasi();
    // Sehari kemudian (Senin 26 Okt 22.00 WITA): cermin baru dihitung 25 Okt; tenggat 2026-11-09 -> sisa 14, bukan 15.
    jam += 24 * 3_600_000;
    vi.setSystemTime(jam);
    await pembaruanSegar();
    await tulisJejak(db, KUNCI_JEJAK.mediasi, { terakhir: new Date(jam - 30_000).toISOString(), dari: "", sampai: "", baris: 5, ditulis: 0, dihapus: 0, ms: 1, galat: { terakhir: "", pada: "", beruntun: 0 }, peringatan: [] });
    const h = await bacaMediasiDariCermin({ dari: "2026-10-23", sampai: "2026-11-15", batas: 200 }, { db: async () => db, pengaturan: async () => pengaturan, sekarang: () => new Date(jam) });
    expect(h).not.toBeNull();
    const per = Object.fromEntries((h!.data.mediasi as MediasiSumber[]).map((m) => [String(m.mediasiId), m]));
    expect(per["1"]).toMatchObject({ sisaHariTenggat: 14, lewatTenggang: false });
    expect(per["3"]).toMatchObject({ sisaHariTenggat: -6, lewatTenggang: true }); // tenggat 20 Okt
    expect(h!.data.cermin.diperbaruiPada).toBe(new Date(jam - 30_000).toISOString());
  });

  it("mediasi yang laporannya sudah masuk tidak pernah lewat tenggang", async () => {
    await siapMediasi();
    const h = await bacaMediasiDariCermin({ dari: "2026-10-24", sampai: "2026-10-24" }, { db: async () => db, pengaturan: async () => pengaturan, sekarang: () => new Date(jam) });
    expect(h!.data.mediasi).toHaveLength(1);
    expect(h!.data.mediasi[0]).toMatchObject({ mediasiId: "5", sisaHariTenggat: null, lewatTenggang: false });
  });

  it("UJI PERBANDINGAN rute: isi dari cermin = isi dari jalur lama (urutan, batas, semua ruas)", async () => {
    const palsu = await siapMediasi();
    let lamaDipanggil = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (masuk: string) => {
        const url = new URL(String(masuk));
        if (!url.pathname.endsWith("/sipp/jadwal-mediasi")) return new Response("{}", { status: 404 });
        lamaDipanggil += 1;
        const dari = url.searchParams.get("dari") || HARI;
        const sampai = url.searchParams.get("sampai") || dari;
        const batas = Number(url.searchParams.get("batas")) || 200;
        const daftar = urutanSql(palsu.data.filter((m) => String(m.tanggal) >= dari && String(m.tanggal) <= sampai)).slice(0, batas);
        return new Response(JSON.stringify({ ok: true, dari, sampai, diperiksaPada: "x", terbaca: true, alasan: "", mediasi: daftar }), { status: 200, headers: { "content-type": "application/json" } });
      })
    );
    const panggil = async (query: string) => {
      const modul = await import("@/app/api/aleta-ecourt/jadwal-mediasi/route");
      const jawaban = await modul.GET(new NextRequest(`http://localhost/api/aleta-ecourt/jadwal-mediasi?${query}`));
      return { status: jawaban.status, isi: (await jawaban.json()) as { data: Record<string, any> } };
    };
    for (const q of ["dari=2026-10-22&sampai=2026-11-15&batas=200", "dari=2026-10-25&sampai=2026-10-25", "dari=2026-10-24&sampai=2026-10-26&batas=3"]) {
      pasangPengaturan({ layar: { mediasi: false } });
      await simpanPengaturanDb();
      const lama = await panggil(q);
      expect(lama.status).toBe(200);
      expect(lama.isi.data.cermin).toBeNull();
      pasangPengaturan({ layar: { mediasi: true } });
      await simpanPengaturanDb();
      const sebelum = lamaDipanggil;
      const baru = await panggil(q);
      expect(lamaDipanggil, `${q}: SIPP tidak ditanya`).toBe(sebelum);
      expect(baru.isi.data.cermin).toMatchObject({ diperbaruiPada: expect.any(String) });
      expect(baru.isi.data.mediasi, q).toEqual(lama.isi.data.mediasi);
      expect(baru.isi.data.dari).toBe(lama.isi.data.dari);
      expect(baru.isi.data.sampai).toBe(lama.isi.data.sampai);
    }
  });

  it("kembali ke SIPP: di luar jendela, pencarian, cermin tertinggal; dan BACA TULISAN SENDIRI", async () => {
    await siapMediasi();
    const deps = { db: async () => db, pengaturan: async () => pengaturan, sekarang: () => new Date(jam) };
    const alasan: string[] = [];
    const catat = (a: string) => alasan.push(a);
    expect(await bacaMediasiDariCermin({ dari: "2026-09-01", sampai: "2026-09-30" }, deps, catat)).toBeNull();
    expect(await bacaMediasiDariCermin({ dari: HARI, sampai: HARI, cari: "Dirman" }, deps, catat)).toBeNull();
    expect(alasan).toEqual(["di-luar-jendela", "ada-pencarian"]);
    // Tulisan terjadi sekarang; jendela mediasi terakhir dihitung SEBELUMNYA -> belum menyusul.
    aturTulisCerminTerakhir(Date.now() + 1);
    expect(await bacaMediasiDariCermin({ dari: HARI, sampai: HARI }, deps, catat)).toBeNull();
    expect(alasan[2]).toBe("cermin-tertinggal");
    // Putaran paksa sesudah tulisan -> menyusul.
    vi.setSystemTime(jam + 2000);
    const palsu = new MediasiPalsu();
    palsu.data = [...MEDIASI_REKAAN];
    await putaranMediasi({ ...depsMediasi(palsu), sekarang: () => new Date(Date.now()) }, { paksa: true });
    jam += 2000;
    await pembaruanSegar();
    expect(await bacaMediasiDariCermin({ dari: HARI, sampai: HARI }, { ...deps, sekarang: () => new Date(Date.now()) })).not.toBeNull();
  });

  it("jadwal mediasi tertinggal (sudah 3 jam tak dihitung) -> jalur lama", async () => {
    await siapMediasi();
    jam += 3 * 3_600_000;
    vi.setSystemTime(jam);
    await pembaruanSegar();
    expect(await bacaMediasiDariCermin({ dari: HARI, sampai: HARI }, { db: async () => db, pengaturan: async () => pengaturan, sekarang: () => new Date(jam) })).toBeNull();
  });
});

// ============================================================================
// D. penanda Status Perkara
// ============================================================================
/** Perkara rekaan dengan semua tanggal dasar; tag = himpunan id (termasuk satu tag "ketiadaan"). */
type PerkaraTag = { id: number; daftar: string; putus: string; bht: string; minutasi: string; sidang: string; akta: string; relaas: string; ikrar: string };
const PERKARA_TAG: PerkaraTag[] = Array.from({ length: 30 }, (_, i) => {
  const id = i + 1;
  const bln = String((i % 12) + 1).padStart(2, "0");
  const tgl = (hari: number) => `2026-${bln}-${String(hari).padStart(2, "0")}`;
  return {
    id,
    daftar: tgl(1 + (i % 28)),
    putus: i % 3 === 0 ? "" : tgl(2 + (i % 27)),
    bht: i % 4 === 0 ? "" : tgl(5 + (i % 24)),
    minutasi: i % 5 === 0 ? "" : tgl(3 + (i % 26)),
    sidang: i % 2 === 0 ? tgl(10 + (i % 18)) : "",
    akta: i % 6 === 0 ? tgl(12 + (i % 16)) : "",
    relaas: i % 7 === 0 ? tgl(8 + (i % 20)) : "",
    ikrar: i % 9 === 0 ? tgl(15 + (i % 13)) : "",
  };
});
const ANGGOTA_TAG: Record<string, number[]> = {
  "ghaib": [1, 4, 9, 16, 25],
  "verstek": [2, 3, 5, 8, 13, 21, 30],
  "tanpa-relaas": PERKARA_TAG.filter((p) => p.relaas === "").map((p) => p.id),
  "prodeo": [7],
  "kosong": [],
};
const KATALOG_TAG = {
  tag: Object.keys(ANGGOTA_TAG).map((kunci) => ({ kunci, label: kunci, kelompok: "uji", nada: "info", judul: kunci, balik: kunci === "tanpa-relaas" })),
  kelompok: [{ kunci: "uji", label: "Uji" }],
  dasar: Object.keys(KOLOM_DASAR_TANGGAL).map((kunci) => ({ kunci, label: kunci })),
  batasId: 20000,
};

class TagPalsu {
  panggilan: string[] = [];
  rusak = new Set<string>();
  terpotong = new Set<string>();
  katalogRusak = "";
  anggota: Record<string, number[]> = { ...ANGGOTA_TAG };
  bot(): Pick<BotCerminLengkap, "tagKatalog" | "tagPerkara"> {
    return {
      tagKatalog: async () => {
        this.panggilan.push("katalog");
        return this.katalogRusak ? { ok: false, error: this.katalogRusak } : { ok: true, data: KATALOG_TAG };
      },
      tagPerkara: async (kunci) => {
        this.panggilan.push(`tag:${kunci}`);
        if (this.rusak.has(kunci)) return { ok: false, error: `gagal ${kunci}` };
        return { ok: true, data: { kunci, perkaraId: (this.anggota[kunci] ?? []).map(String), terpotong: this.terpotong.has(kunci) } };
      },
    };
  }
}
const depsTag = (palsu: TagPalsu): DepsTag => ({ db: async () => db, bot: palsu.bot(), pengaturan: async () => pengaturan, sekarang: () => new Date(jam) });

function perkaraSumber(p: PerkaraTag): PerkaraSumber {
  return {
    perkaraId: String(p.id),
    nomorPerkara: `${p.id}/Pdt.G/2026/PA.Rekaan`,
    jenisPerkaraId: 346,
    jenisPerkaraNama: "Cerai Talak",
    alurPerkaraId: 15,
    tanggalPendaftaran: p.daftar,
    prodeo: 0,
    tahapanTerakhirId: 15,
    tahapanTerakhirText: "Persidangan",
    prosesTerakhirId: 1,
    prosesTerakhirText: "x",
    majelisHakim: "",
    paniteraPengganti: "",
    jurusita: "",
    sidangPertama: "",
    sidangTerakhir: "",
    sidangBerikut: "",
    jumlahSidang: 0,
    tanggalPutusan: p.putus,
    statusPutusan: "",
    putusanVerstek: 0,
    tanggalMinutasi: p.minutasi,
    tanggalBht: p.bht,
    sidangMaks: p.sidang,
    tanggalAkta: p.akta,
    tanggalRelaas: p.relaas,
    tanggalIkrar: p.ikrar,
    sippDiperbarui: "2026-10-20 08:00:00",
  };
}

async function lengkapiSiklus(palsu: TagPalsu) {
  for (let i = 0; i < 40; i++) {
    const r = await putaranTag(depsTag(palsu), { paksa: i === 0 });
    if (r.siklusSelesai) return r;
    if (r.alasan === "galat" || r.alasan === "menunggu-siklus") return r;
  }
  throw new Error("siklus tidak selesai");
}

describe("D. penanda Status Perkara dari cermin", () => {
  it("gantiAnggotaTag: hanya selisih (tambah/hapus), yang sama tidak ditulis ulang", async () => {
    const a = await gantiAnggotaTag(db, "ghaib", ["1", "2", "3"], "t1");
    expect(a).toEqual({ ditambah: 3, dihapus: 0, tetap: 0 });
    const b = await gantiAnggotaTag(db, "ghaib", ["2", "3", "4"], "t2");
    expect(b).toEqual({ ditambah: 1, dihapus: 1, tetap: 2 });
    const c = await gantiAnggotaTag(db, "ghaib", ["2", "3", "4"], "t3");
    expect(c).toEqual({ ditambah: 0, dihapus: 0, tetap: 3 });
    const rows = await db.queryAll<{ perkara_id: string; cermin_diperbarui: string }>("SELECT perkara_id, cermin_diperbarui FROM aleta_cermin_tag WHERE tag_kunci = 'ghaib' ORDER BY perkara_id");
    expect(rows.map((r) => r.perkara_id)).toEqual(["2", "3", "4"]);
    expect(rows.find((r) => r.perkara_id === "2")?.cermin_diperbarui).toBe("t1"); // tidak ditimpa
    await gantiAnggotaTag(db, "prodeo", ["2"], "t4");
    expect((await db.queryAll("SELECT 1 FROM aleta_cermin_tag WHERE tag_kunci = 'prodeo'")).length).toBe(1); // tag lain tidak terganggu
  });

  it("saklar pemindai mati / pemindaian belum selesai: tidak menyentuh bot", async () => {
    const palsu = new TagPalsu();
    pasangPengaturan({ pemindaiAktif: false });
    expect((await putaranTag(depsTag(palsu))).alasan).toBe("mati");
    pasangPengaturan();
    expect((await putaranTag(depsTag(palsu))).alasan).toBe("menunggu-pemindaian");
    expect(palsu.panggilan).toEqual([]);
  });

  it("siklus: katalog disimpan, enam tag per detak, selesai lengkap; siklus berikutnya menunggu selang", async () => {
    await pemindaianSelesai();
    const palsu = new TagPalsu();
    const r1 = await putaranTag(depsTag(palsu), { paksa: true });
    expect(r1).toMatchObject({ alasan: "ok", diproses: Math.min(TAG_PER_DETAK, 5), sisa: 0, siklusSelesai: true });
    const k = await muatKeadaanTag(db);
    expect(k.siklusSelesai).toBe(new Date(jam).toISOString());
    expect(k.siklusSelesaiMulai).toBe(k.siklusMulai);
    expect(k.total).toBe(5);
    expect((await db.queryAll("SELECT 1 FROM aleta_cermin_tag WHERE tag_kunci = 'verstek'")).length).toBe(7);
    // Selang 10 menit.
    const n = palsu.panggilan.length;
    jam += 5 * 60_000;
    vi.setSystemTime(jam);
    expect((await putaranTag(depsTag(palsu))).alasan).toBe("menunggu-siklus");
    expect(palsu.panggilan.length).toBe(n);
    jam += 6 * 60_000;
    vi.setSystemTime(jam);
    expect((await putaranTag(depsTag(palsu))).alasan).toBe("ok");
  });

  it("katalog besar diproses beberapa detak (6 per detak) dan selesai setelah semuanya", async () => {
    await pemindaianSelesai();
    const palsu = new TagPalsu();
    const banyak = { ...KATALOG_TAG, tag: Array.from({ length: 14 }, (_, i) => ({ kunci: `t${i}`, label: `t${i}`, kelompok: "uji", nada: "info", judul: "", balik: false })) };
    palsu.bot = () => ({
      tagKatalog: async () => ({ ok: true, data: banyak }),
      tagPerkara: async (kunci) => {
        palsu.panggilan.push(kunci);
        return { ok: true, data: { kunci, perkaraId: ["1"], terpotong: false } };
      },
    });
    const a = await putaranTag(depsTag(palsu), { paksa: true });
    expect(a).toMatchObject({ diproses: 6, sisa: 8, siklusSelesai: false });
    const b = await putaranTag(depsTag(palsu));
    expect(b).toMatchObject({ diproses: 6, sisa: 2, siklusSelesai: false });
    const c = await putaranTag(depsTag(palsu));
    expect(c).toMatchObject({ diproses: 2, sisa: 0, siklusSelesai: true });
  });

  it("tag terpotong pagu atau gagal: siklus TIDAK lengkap (layar tidak memakainya)", async () => {
    await pemindaianSelesai();
    const palsu = new TagPalsu();
    palsu.terpotong.add("ghaib");
    const r = await putaranTag(depsTag(palsu), { paksa: true });
    expect(r.siklusSelesai).toBe(false);
    let k = await muatKeadaanTag(db);
    expect(k.siklusSelesai).toBe("");
    expect(k.tidakLengkap).toEqual(["ghaib"]);
    palsu.terpotong.clear();
    palsu.rusak.add("prodeo");
    await putaranTag(depsTag(palsu), { paksa: true });
    k = await muatKeadaanTag(db);
    expect(k.gagal).toEqual(["prodeo"]);
    expect(k.siklusSelesai).toBe("");
  });

  it("katalog gagal: galat dengan jeda bertambah; siklus dipercepat tulisan (paling cepat semenit)", async () => {
    await pemindaianSelesai();
    const palsu = new TagPalsu();
    palsu.katalogRusak = "bot mati";
    expect((await putaranTag(depsTag(palsu), { paksa: true })).alasan).toBe("galat");
    expect((await muatKeadaanTag(db)).galat.beruntun).toBe(1);
    palsu.katalogRusak = "";
    jam += 5 * 60_000; // di bawah selang siklus 10 menit
    vi.setSystemTime(jam);
    expect((await putaranTag(depsTag(palsu))).alasan).toBe("menunggu-siklus");
    jam += 20 * 60_000;
    vi.setSystemTime(jam);
    expect((await putaranTag(depsTag(palsu))).alasan).toBe("ok");
    // Sesudah siklus lengkap: tulisan mempercepat siklus berikutnya, tapi tidak lebih cepat dari semenit.
    aturTulisCerminTerakhir(Date.now() + 1);
    jam += 30_000;
    vi.setSystemTime(jam);
    expect((await putaranTag(depsTag(palsu))).alasan).toBe("menunggu-siklus");
    jam += 40_000;
    vi.setSystemTime(jam);
    expect((await putaranTag(depsTag(palsu))).alasan).toBe("ok");
  });

  // ---- UJI PERBANDINGAN ---------------------------------------------------
  /** Jalur lama (pembanding): hitung tag atas himpunan perkara menurut dasar tanggal dan rentang, tanpa kode cermin. */
  function hitungLama(dasar: string, dari: string, sampai: string) {
    const kolom: Record<string, keyof PerkaraTag> = { daftar: "daftar", putus: "putus", bht: "bht", minutasi: "minutasi", sidang: "sidang", akta: "akta", relaas: "relaas", ikrar: "ikrar" };
    const masuk = PERKARA_TAG.filter((p) => {
      if (!dari && !sampai) return true;
      const t = String(p[kolom[dasar] ?? "daftar"]);
      if (!t) return false;
      return (!dari || t >= dari) && (!sampai || t <= sampai);
    }).map((p) => p.id);
    const jumlah: Record<string, number> = {};
    for (const [kunci, ids] of Object.entries(ANGGOTA_TAG)) jumlah[kunci] = ids.filter((id) => masuk.includes(id)).length;
    return { jumlah, lingkup: { dari, sampai, perkara: masuk.length } };
  }

  async function siapTag() {
    pasangPengaturan({ layar: { status: true } });
    await simpanPengaturanDb();
    await pemindaianSelesai();
    await pembaruanSegar();
    await simpanKelompokPerkara(db, PERKARA_TAG.map(perkaraSumber), new Date(jam).toISOString());
    const palsu = new TagPalsu();
    await lengkapiSiklus(palsu);
    buangSinggahKesegaran();
    return palsu;
  }

  function stubBotLama() {
    let dipanggil = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (masuk: string) => {
        const url = new URL(String(masuk));
        if (!url.pathname.endsWith("/status-perkara/tag")) return new Response("{}", { status: 404 });
        dipanggil += 1;
        const dasar = url.searchParams.get("dasarTanggal") || "daftar";
        const periode = url.searchParams.get("periode") || "total";
        // Rentang jalur lama memakai pembanding terpisah (Date lokal), bukan rentangLingkupTag.
        const acuan = url.searchParams.get("acuan") || HARI;
        const r =
          periode === "total"
            ? { dari: "", sampai: "" }
            : periode === "rentang"
              ? { dari: url.searchParams.get("tagDari") || "", sampai: url.searchParams.get("tagSampai") || "" }
              : rentangAcuan(periode, acuan);
        const hasil = hitungLama(dasar, r.dari, r.sampai);
        return new Response(JSON.stringify({ ok: true, katalogSaja: false, ...hasil, ...KATALOG_TAG }), { status: 200, headers: { "content-type": "application/json" } });
      })
    );
    return () => dipanggil;
  }

  it("UJI PERBANDINGAN: hitungan tag dari cermin = jalur lama untuk tiap dasar tanggal x periode", async () => {
    await siapTag();
    const lamaDipanggil = stubBotLama();
    const kombinasi: Array<Record<string, string>> = [];
    for (const dasar of Object.keys(KOLOM_DASAR_TANGGAL)) {
      for (const periode of ["total", "bulan", "triwulan", "semester", "tahun", "pekan", "hari"]) kombinasi.push({ dasarTanggal: dasar, periode, acuan: "2026-06-15" });
      kombinasi.push({ dasarTanggal: dasar, periode: "rentang", tagDari: "2026-03-01", tagSampai: "2026-08-31" });
      kombinasi.push({ dasarTanggal: dasar, periode: "rentang", tagDari: "2026-05-01", tagSampai: "" });
      kombinasi.push({ dasarTanggal: dasar, periode: "rentang", tagDari: "", tagSampai: "2026-04-30" });
    }
    let diperiksa = 0;
    // Lintasan 1: jalur lama (saklar mati). Lintasan 2: cermin (menyala). Hasilnya harus sama.
    pasangPengaturan({ layar: { status: false } });
    await simpanPengaturanDb();
    const lamaSemua = [];
    for (const m of kombinasi) lamaSemua.push(await getGatewayTagPerkara(m));
    expect(lamaDipanggil()).toBe(kombinasi.length);
    pasangPengaturan({ layar: { status: true } });
    await simpanPengaturanDb();
    const sebelumCermin = lamaDipanggil();
    for (const [i, m] of kombinasi.entries()) {
      const lama = lamaSemua[i];
      const baru = await getGatewayTagPerkara(m);
      expect(lamaDipanggil(), `cermin tidak boleh menanyai bot: ${JSON.stringify(m)}`).toBe(sebelumCermin);
      expect(lama.ok && baru.ok).toBe(true);
      if (!lama.ok || !baru.ok) return;
      const dl = lama.data as unknown as Record<string, any>;
      const db_ = baru.data as unknown as Record<string, any>;
      expect(db_.jumlah, JSON.stringify(m)).toEqual(dl.jumlah);
      expect(db_.lingkup, JSON.stringify(m)).toEqual(dl.lingkup);
      expect(db_.tag).toEqual(dl.tag);
      expect(db_.kelompok).toEqual(dl.kelompok);
      expect(db_.dasar).toEqual(dl.dasar);
      expect(db_.cermin).toMatchObject({ diperbaruiPada: expect.any(String) });
      expect(dl.cermin).toBeUndefined();
      diperiksa += 1;
    }
    expect(diperiksa).toBe(kombinasi.length);
    expect(kombinasi.length).toBeGreaterThanOrEqual(80);
  });

  it("kembali ke SIPP: saklar mati, katalogSaja, siklus belum lengkap, tag terpotong, siklus kedaluwarsa", async () => {
    const palsu = await siapTag();
    const lamaDipanggil = stubBotLama();
    const alasan: string[] = [];
    const deps = { db: async () => db, pengaturan: async () => pengaturan, sekarang: () => new Date(jam) };
    const catat = (a: string, r?: string) => alasan.push(r ? `${a}:${r}` : a);
    expect(await bacaTagDariCermin({ periode: "total" }, deps, catat)).not.toBeNull();
    expect(await bacaTagDariCermin({ periode: "total", katalogSaja: "1" }, deps, catat)).toBeNull();
    pasangPengaturan({ layar: { status: false } });
    expect(await bacaTagDariCermin({ periode: "total" }, deps, catat)).toBeNull();
    pasangPengaturan({ layar: { status: true } });
    // Tag terpotong pada siklus berikutnya -> tidak dipakai.
    palsu.terpotong.add("ghaib");
    await putaranTag(depsTag(palsu), { paksa: true });
    await tulisJejak(db, KUNCI_JEJAK.tag, { ...(await muatKeadaanTag(db)), siklusSelesai: new Date(jam).toISOString(), siklusSelesaiMulai: new Date(jam).toISOString() });
    buangSinggahKesegaran();
    expect(await bacaTagDariCermin({ periode: "total" }, deps, catat)).toBeNull();
    expect(alasan.at(-1)).toContain("daftar tag terpotong: ghaib");
    // Siklus lengkap yang sudah tua (2 jam) -> tidak dipakai.
    palsu.terpotong.clear();
    await lengkapiSiklus(palsu);
    jam += 2 * 3_600_000;
    vi.setSystemTime(jam);
    await pembaruanSegar();
    expect(await bacaTagDariCermin({ periode: "total" }, deps, catat)).toBeNull();
    expect(alasan.at(-1)).toContain("siklus penanda lengkap terakhir");
    expect(lamaDipanggil()).toBe(0);
  });

  it("tulisan lewat ALETA: hitungan masih dipakai 90 detik, lewat itu (tanpa siklus baru) kembali ke SIPP", async () => {
    await siapTag();
    const deps = { db: async () => db, pengaturan: async () => pengaturan, sekarang: () => new Date(jam) };
    aturTulisCerminTerakhir(Date.now() + 1);
    expect(await bacaTagDariCermin({ periode: "total" }, deps)).not.toBeNull();
    jam += TOLERANSI_TULISAN_TAG_MS - 5000;
    vi.setSystemTime(jam);
    await pembaruanSegar();
    expect(await bacaTagDariCermin({ periode: "total" }, deps)).not.toBeNull();
    jam += 10_000;
    vi.setSystemTime(jam);
    await pembaruanSegar();
    const alasan: string[] = [];
    expect(await bacaTagDariCermin({ periode: "total" }, deps, (a, r) => alasan.push(`${a}:${r}`))).toBeNull();
    expect(alasan[0]).toContain("menunggu tulisan terakhir masuk penanda");
  });
});

// ============================================================================
// E. bot
// ============================================================================
describe("E. bot", () => {
  const tanpaKomentar = (teks: string) => teks.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const Modul = muatBot("module") as unknown as new (id: string) => { filename: string; loaded: boolean; exports: unknown };
  const dipasang: string[] = [];
  const pasang = (jalur: string, isi: unknown) => {
    const m = new Modul(jalur);
    m.filename = jalur;
    m.loaded = true;
    m.exports = isi;
    (muatBot.cache as Record<string, unknown>)[jalur] = m;
    dipasang.push(jalur);
  };
  afterEach(() => {
    for (const j of dipasang.splice(0)) delete (muatBot.cache as Record<string, unknown>)[j];
  });

  it("rute baru semuanya GET + token; layanan penanda tidak berisi kata kunci tulis", () => {
    const rute = baca("aleta_bot/routes/cerminRoutes.js");
    expect(rute.match(/router\.get\(/g)?.length).toBe(11);
    expect(rute).not.toMatch(/router\.(post|put|patch|delete)\(/);
    for (const jalur of ["/mediasi", "/tag-katalog", "/tag-perkara"]) expect(rute).toContain(`router.get("${jalur}", wajibToken`);
    for (const b of ["aleta_bot/services/cerminTagService.js", "aleta_bot/services/cerminService.js"]) {
      expect(tanpaKomentar(baca(b)), b).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|TRUNCATE|CREATE|GRANT|TRIGGER)\b/);
    }
  });

  it("cerminTagService: katalog membawa 'balik'; perkaraUntukTag menolak tag asing dan menandai daftar terpotong pagu", async () => {
    const jalurTag = muatBot.resolve("./services/tagPerkaraService.js");
    const jalurLayanan = muatBot.resolve("./services/cerminTagService.js");
    pasang(jalurTag, {
      TAG: { ghaib: { label: "Ghaib", kelompok: "pihak", nada: "info", judul: "j", tabel: "x" }, "tanpa-relaas": { label: "Tanpa relaas", kelompok: "mutu", nada: "awas", judul: "j", balik: true } },
      KELOMPOK_TAG: [{ kunci: "pihak", label: "Pihak" }],
      DASAR_TANGGAL: { daftar: { label: "Didaftarkan" }, putus: { label: "Diputus" } },
      BATAS_ID: 3,
      idPerkaraTag: async (kunci: string, lingkup: Record<string, string>) => {
        expect(lingkup).toEqual({ periode: "total" }); // seluruh register, tanpa saringan
        return kunci === "ghaib" ? [5, 4, 3] : [9];
      },
    });
    delete (muatBot.cache as Record<string, unknown>)[jalurLayanan];
    dipasang.push(jalurLayanan);
    const layanan = muatBot(jalurLayanan) as { katalogTag: () => any; perkaraUntukTag: (k: string) => Promise<any> };
    const k = layanan.katalogTag();
    expect(k.tag).toEqual([
      { kunci: "ghaib", label: "Ghaib", kelompok: "pihak", nada: "info", judul: "j", balik: false },
      { kunci: "tanpa-relaas", label: "Tanpa relaas", kelompok: "mutu", nada: "awas", judul: "j", balik: true },
    ]);
    expect(k.dasar).toEqual([{ kunci: "daftar", label: "Didaftarkan" }, { kunci: "putus", label: "Diputus" }]);
    expect(k.batasId).toBe(3);
    expect(await layanan.perkaraUntukTag("ghaib")).toEqual({ ok: true, kunci: "ghaib", perkaraId: ["5", "4", "3"], terpotong: true });
    expect(await layanan.perkaraUntukTag("tanpa-relaas")).toEqual({ ok: true, kunci: "tanpa-relaas", perkaraId: ["9"], terpotong: false });
    expect(await layanan.perkaraUntukTag("constructor")).toMatchObject({ ok: false, error: "tag_tidak_dikenal" });
  });

  it("ringkasan perkara memuat tanggal dasar tambahan (sidang maks, akta, relaas, ikrar) dan MAX minutasi/BHT lintas baris putusan; semua kueri SELECT", async () => {
    const jalurDb = muatBot.resolve("./db_config.js");
    const jalurJadwal = muatBot.resolve("./services/sippJadwalSidangService.js");
    const jalurCermin = muatBot.resolve("./services/cerminService.js");
    const kueri: Array<{ sql: string; params: unknown[] }> = [];
    pasang(jalurDb, {
      query: (sql: string, params: unknown[], cb: (e: unknown, r: unknown) => void) => {
        kueri.push({ sql, params });
        if (/FROM perkara\s+WHERE perkara_id > \?/.test(sql)) return cb(null, [{ perkaraId: 11, nomorPerkara: "11/x", jenisPerkaraId: 346, jenisPerkaraNama: "CT", alurPerkaraId: 15, tanggalPendaftaran: new Date(2026, 0, 2), prodeo: 0, diinput: null, diperbaharui: null, diedit: null }]);
        if (/FROM perkara_putusan/.test(sql)) {
          return cb(null, [
            { perkaraId: 11, tanggalPutusan: new Date(2026, 5, 1), statusNama: "A", verstek: "T", tanggalMinutasi: new Date(2026, 5, 20), tanggalBht: new Date(2026, 6, 30) },
            { perkaraId: 11, tanggalPutusan: new Date(2026, 6, 1), statusNama: "B", verstek: "T", tanggalMinutasi: new Date(2026, 5, 10), tanggalBht: null },
          ]);
        }
        if (/FROM perkara_jadwal_sidang/.test(sql)) return cb(null, [{ perkaraId: 11, jumlah: 3, terakhir: new Date(2026, 2, 1), berikut: new Date(2027, 0, 5), maks: new Date(2027, 0, 5) }]);
        if (/FROM perkara_akta_cerai/.test(sql)) return cb(null, [{ perkaraId: 11, tanggal: new Date(2026, 7, 7) }]);
        if (/FROM perkara_pelaksanaan_relaas/.test(sql)) return cb(null, [{ perkaraId: 11, tanggal: new Date(2026, 8, 8) }]);
        if (/FROM perkara_ikrar_talak/.test(sql)) return cb(null, [{ perkaraId: 11, tanggal: "0000-00-00" }]);
        return cb(null, []);
      },
    });
    pasang(jalurJadwal, { daftarSidang: async () => ({ ok: true, sidang: [] }) });
    delete (muatBot.cache as Record<string, unknown>)[jalurCermin];
    dipasang.push(jalurCermin);
    const cermin = muatBot(jalurCermin) as { kelompokPerkara: (o: Record<string, number>) => Promise<{ perkara: Array<Record<string, unknown>> }> };
    const { perkara } = await cermin.kelompokPerkara({ setelahId: 0, batas: 10 });
    expect(perkara[0]).toMatchObject({
      tanggalMinutasi: "2026-06-20", // terbaru di antara baris putusan, bukan baris terakhir
      tanggalBht: "2026-07-30",
      sidangMaks: "2027-01-05",
      tanggalAkta: "2026-08-07",
      tanggalRelaas: "2026-09-08",
      tanggalIkrar: "", // tanggal nol SIPP
    });
    for (const q of kueri) expect(q.sql.trim(), q.sql).toMatch(/^SELECT\b/i);
    expect(kueri.some((q) => /MAX\(tgl_akta_cerai\)/.test(q.sql))).toBe(true);
  });

  it("mediasiJendela menandai terpotong dan meneruskan 'terbaca'", async () => {
    const jalurDb = muatBot.resolve("./db_config.js");
    const jalurJadwal = muatBot.resolve("./services/sippJadwalSidangService.js");
    const jalurCermin = muatBot.resolve("./services/cerminService.js");
    pasang(jalurDb, { query: (_s: string, _p: unknown, cb: (e: unknown, r: unknown) => void) => cb(null, []) });
    pasang(jalurJadwal, {
      daftarSidang: async () => ({ ok: true, sidang: [] }),
      daftarJadwalMediasi: async ({ batas }: { batas: number }) => ({ dari: "2026-10-22", sampai: "2026-11-15", terbaca: true, alasan: "", mediasi: Array.from({ length: batas }, (_, i) => ({ mediasiId: String(i) })) }),
    });
    delete (muatBot.cache as Record<string, unknown>)[jalurCermin];
    dipasang.push(jalurCermin);
    const cermin = muatBot(jalurCermin) as { mediasiJendela: (o: Record<string, string>) => Promise<Record<string, any>> };
    const r = await cermin.mediasiJendela({ dari: "2026-10-22", sampai: "2026-11-15" });
    expect(r).toMatchObject({ terbaca: true, terpotong: true, dari: "2026-10-22", sampai: "2026-11-15" });
    expect(r.mediasi).toHaveLength(500);
  });
});

// ============================================================================
// F. layar
// ============================================================================
describe("F. tanda Cermin pada Jadwal Mediasi dan Status Perkara", () => {
  it("rute meneruskan 'cermin'; layar menampilkan tanda hanya bila ada", () => {
    expect(baca("manajemen_surat/src/app/api/aleta-ecourt/jadwal-mediasi/route.ts")).toContain("cermin: (hasil.data as { cermin?: { diperbaruiPada: string | null } } | undefined)?.cermin ?? null");
    expect(baca("manajemen_surat/src/app/api/aleta-ecourt/status-perkara/tag/route.ts")).toContain("cermin: (hasil.data as { cermin?: { diperbaruiPada: string | null } }).cermin ?? null");
    const mediasiUi = baca("manajemen_surat/src/components/portal/aleta-ecourt-mediasi.tsx");
    expect(mediasiUi).toContain('data-testid="tanda-cermin-mediasi"');
    expect(mediasiUi).toContain("{cerminMediasi && !memuat ? (");
    const statusUi = baca("manajemen_surat/src/components/portal/aleta-ecourt-status-perkara.tsx");
    expect(statusUi).toContain('data-testid="tanda-cermin-tag"');
    expect(statusUi).toContain("{katalog?.cermin ? (");
    const tampil = baca("manajemen_surat/src/lib/cermin-tampil.ts");
    expect(tampil).toContain("Cermin · diperbarui");
    expect(tampil).not.toMatch(/aleta_cermin|baris_json/);
  });
});
