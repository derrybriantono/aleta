// @vitest-environment node
/**
 * ============================================================================
 * CERMIN PERKARA - DASAR (C0, A2, 25 Okt 2026)
 * ============================================================================
 *
 *   A. migrasi 0090 = DDL schema.ts = daftar cadangan = jurnal; tabel benar-benar dibuat (pg-mem);
 *   B. aturan murni (src/lib/cermin.ts): saklar MATI bawaan, jendela jam, kemajuan, perkiraan selesai;
 *   C. pemindai: saklar mati = tidak menyentuh bot, jendela malam, berhenti/lanjut dari titik terakhir
 *      (juga sesudah "mulai ulang proses"), jeda antar kelompok, galat beruntun menghentikan dan
 *      bertambah jeda, jendela terpotong mengecil tanpa baris hilang, pemindaian ulang tidak menulis;
 *   D. bot (cerminService + cerminRoutes) HANYA SELECT/GET - tidak ada satu pun tulisan ke SIPP;
 *   E. rute admin: hak (pegawai 403, Admin melihat, hanya Super Admin mengubah), saklar tersimpan + audit.
 *
 * Data rekaan saja. Tidak ada jaringan dan tidak ada SIPP sungguhan.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LAYAR_CERMIN,
  PENGATURAN_CERMIN_BAWAAN,
  bersihkanKeadaanPemindai,
  bersihkanPengaturanCermin,
  dalamJendelaJam,
  keadaanPemindaiAwal,
  perkiraanSelesai,
  persenKemajuan,
  tambahHari,
} from "@/lib/cermin";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ALETA_CERMIN_PERKARA } from "@/server/db/schema";
import type { BotCermin, JendelaSidang, PerkaraSumber, SidangSumber } from "@/server/modules/cermin/bot";
import { bacaPengaturanCerminTersimpan, buangSinggahPengaturanCermin, layarMembacaCermin } from "@/server/modules/cermin/pengaturan";
import {
  aturUlangPemindaiCermin,
  jedaSesudahGalatMs,
  lanjutkanPemindai,
  muatKeadaanPemindai,
  putaranPemindai,
  ulangPemindai,
  type DepsPemindai,
} from "@/server/modules/cermin/pemindai";
import { hitunganCermin } from "@/server/modules/cermin/penyimpan";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const muatBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

// ============================================================================
// A. migrasi
// ============================================================================
describe("A. migrasi 0090 - tiga tempat pendaftaran sama", () => {
  const sql = baca("manajemen_surat/drizzle/0090_aleta_cermin_perkara.sql");
  const TABEL = ["aleta_cermin_perkara", "aleta_cermin_sidang", "aleta_cermin_pihak", "aleta_cermin_mediasi", "aleta_cermin_tag", "aleta_cermin_jejak"];

  it("pernyataan berkas SQL = DDL_ALETA_CERMIN_PERKARA (schema.ts)", () => {
    expect(pernyataan(sql)).toEqual([...DDL_ALETA_CERMIN_PERKARA.tabel, ...DDL_ALETA_CERMIN_PERKARA.indeks].map((s) => pernyataan(s)[0]));
  });

  it("keenam tabel ikut cadangan JSON dan benar-benar dibuat (pg-mem)", async () => {
    for (const t of TABEL) expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER, t).toContain(t);
    const db = await createAletaDatabase({ useInMemory: true, seed: false });
    try {
      const baris = await db.queryAll<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
      for (const t of TABEL) expect(baris.map((b) => b.table_name), t).toContain(t);
    } finally {
      await db.close();
    }
  });

  it("jurnal: 0090 memakai idx 81 sesudah 0088 (idx 80); idx tidak ganda dan urut", () => {
    const j = JSON.parse(baca("manajemen_surat/drizzle/meta/_journal.json")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    const e = j.entries.find((x) => x.tag === "0090_aleta_cermin_perkara");
    expect(e?.idx).toBe(81);
    const idx = j.entries.map((x) => x.idx);
    expect(new Set(idx).size).toBe(idx.length);
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
    const when = j.entries.map((x) => x.when);
    expect(when).toEqual([...when].sort((a, b) => a - b));
  });

  it("tanpa kunci asing dan tanpa trigger/ubahan skema SIPP di berkas migrasi", () => {
    expect(sql).not.toMatch(/REFERENCES|FOREIGN KEY|CREATE TRIGGER/i);
  });
});

// ============================================================================
// B. aturan murni
// ============================================================================
describe("B. aturan murni", () => {
  it("SEMUA saklar mati bawaan, termasuk tiap layar", () => {
    expect(PENGATURAN_CERMIN_BAWAAN.pemindaiAktif).toBe(false);
    for (const l of LAYAR_CERMIN) expect(PENGATURAN_CERMIN_BAWAAN.layar[l], l).toBe(false);
    const dari = bersihkanPengaturanCermin({})!;
    expect(dari.pemindaiAktif).toBe(false);
    for (const l of LAYAR_CERMIN) expect(dari.layar[l], l).toBe(false);
    // Hanya `true` yang sungguh menyalakan; "ya"/1 tidak.
    expect(bersihkanPengaturanCermin({ pemindaiAktif: "ya", layar: { jadwal: 1 } })!.pemindaiAktif).toBe(false);
    expect(bersihkanPengaturanCermin({ layar: { jadwal: true } })!.layar.jadwal).toBe(true);
    expect(bersihkanPengaturanCermin(null)).toBeNull();
    expect(bersihkanPengaturanCermin([])).toBeNull();
  });

  it("angka dijepit dan jam yang tidak sah jatuh ke bawaan", () => {
    const p = bersihkanPengaturanCermin({ ukuranKelompok: 99999, jedaDetik: 0, jendelaMulai: "25:99", jendelaSelesai: "07:15" })!;
    expect(p.ukuranKelompok).toBe(500);
    expect(p.jedaDetik).toBe(2);
    expect(p.jendelaMulai).toBe("18:00");
    expect(p.jendelaSelesai).toBe("07:15");
  });

  it("jendela jam melewati tengah malam; mulai = selesai berarti sepanjang hari", () => {
    expect(dalamJendelaJam("18:00", "18:00", "06:30")).toBe(true);
    expect(dalamJendelaJam("23:59", "18:00", "06:30")).toBe(true);
    expect(dalamJendelaJam("00:00", "18:00", "06:30")).toBe(true);
    expect(dalamJendelaJam("06:29", "18:00", "06:30")).toBe(true);
    expect(dalamJendelaJam("06:30", "18:00", "06:30")).toBe(false);
    expect(dalamJendelaJam("12:00", "18:00", "06:30")).toBe(false);
    expect(dalamJendelaJam("17:59", "18:00", "06:30")).toBe(false);
    expect(dalamJendelaJam("09:00", "08:00", "17:00")).toBe(true);
    expect(dalamJendelaJam("12:00", "00:00", "00:00")).toBe(true);
    expect(dalamJendelaJam("ngawur", "18:00", "06:30")).toBe(false);
  });

  it("tambahHari tanpa pergeseran zona, melewati akhir bulan dan tahun", () => {
    expect(tambahHari("2026-10-25", 7)).toBe("2026-11-01");
    expect(tambahHari("2026-12-31", 1)).toBe("2027-01-01");
    expect(tambahHari("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("kemajuan: 0 saat belum mulai, 100 saat selesai, dibobot perkara + sidang, tak melewati 99 sebelum selesai", () => {
    const k = keadaanPemindaiAwal();
    expect(persenKemajuan(k)).toBe(0);
    k.perkara.total = 800;
    k.sidang.total = 200;
    k.status = "berjalan";
    k.perkara.diproses = 400;
    expect(persenKemajuan(k)).toBe(40);
    k.tahap = "sidang";
    k.sidang.diproses = 100;
    expect(persenKemajuan(k)).toBe(90);
    k.sidang.diproses = 200;
    expect(persenKemajuan(k)).toBe(99);
    k.tahap = "selesai";
    k.status = "selesai";
    expect(persenKemajuan(k)).toBe(100);
  });

  it("perkiraan selesai melompati jam tidur: sisa kerja dijajarkan ke jendela malam berikutnya", () => {
    const k = keadaanPemindaiAwal();
    k.status = "berjalan";
    k.perkara.total = 10_000;
    k.perkara.diproses = 1_000;
    k.aktifMs = 600_000; // 10 menit aktif untuk 1.000 baris -> 90 menit lagi
    // 22:00 WITA = 14:00 UTC; 90 menit aktif habis 23:30 WITA (15:30 UTC), masih dalam jendela.
    const a = perkiraanSelesai(k, new Date("2026-10-25T14:00:00Z"), { mulai: "18:00", selesai: "06:30" });
    expect(a).toBe("2026-10-25T15:30:00.000Z");
    // 05:30 WITA (21:30 UTC): hanya 60 menit tersisa di jendela, 30 menit lagi diteruskan malam berikutnya 18:00 WITA (10:00 UTC).
    const b = perkiraanSelesai(k, new Date("2026-10-25T21:30:00Z"), { mulai: "18:00", selesai: "06:30" });
    expect(b).toBe("2026-10-26T10:30:00.000Z");
    // Data belum cukup / sudah selesai -> null.
    expect(perkiraanSelesai(keadaanPemindaiAwal(), new Date(), { mulai: "18:00", selesai: "06:30" })).toBeNull();
    k.status = "selesai";
    expect(perkiraanSelesai(k, new Date(), { mulai: "18:00", selesai: "06:30" })).toBeNull();
  });

  it("keadaan tersimpan yang rusak jatuh ke keadaan awal", () => {
    expect(bersihkanKeadaanPemindai(null).status).toBe("belum");
    expect(bersihkanKeadaanPemindai("rusak").tahap).toBe("perkara");
    const k = bersihkanKeadaanPemindai({ status: "ngawur", tahap: "ngawur", perkara: { kursor: -5, total: "x" } });
    expect(k.status).toBe("belum");
    expect(k.tahap).toBe("perkara");
    expect(k.perkara.kursor).toBe(0);
    expect(k.perkara.total).toBe(0);
  });
});

// ============================================================================
// C. pemindai
// ============================================================================
const MALAM = "2026-10-25T14:00:00.000Z"; // 22.00 WITA, dalam jendela
const SIANG = "2026-10-25T03:00:00.000Z"; // 11.00 WITA, di luar jendela

function perkaraRekaan(id: number): PerkaraSumber {
  return {
    perkaraId: String(id),
    nomorPerkara: `${id}/Pdt.G/2026/PA.Rekaan`,
    jenisPerkaraId: 346,
    jenisPerkaraNama: "Cerai Talak",
    alurPerkaraId: 15,
    tanggalPendaftaran: "2026-01-02",
    prodeo: 0,
    tahapanTerakhirId: 15,
    tahapanTerakhirText: "Persidangan",
    prosesTerakhirId: 130,
    prosesTerakhirText: "Sidang Pertama",
    majelisHakim: "Hakim Rekaan",
    paniteraPengganti: "PP Rekaan",
    jurusita: "JS Rekaan",
    sidangPertama: "2026-02-01",
    sidangTerakhir: "2026-03-01",
    sidangBerikut: "",
    jumlahSidang: 2,
    tanggalPutusan: "",
    statusPutusan: "",
    putusanVerstek: 0,
    tanggalMinutasi: "",
    tanggalBht: "",
    sippDiperbarui: "2026-10-01 08:00:00",
  };
}

function botRekaan(opsi: { perkara?: number; hariSidang?: number; batasBaris?: number } = {}) {
  const jumlahPerkara = opsi.perkara ?? 650;
  const hari = opsi.hariSidang ?? 20;
  const batasBaris = opsi.batasBaris ?? 3;
  const semuaSidang: SidangSumber[] = [];
  for (let h = 0; h < hari; h++) {
    for (let k = 0; k < 2; k++) {
      const tgl = tambahHari("2026-01-01", h);
      const id = h * 2 + k + 1;
      semuaSidang.push({
        sidangId: String(1000 + id),
        perkaraId: String((id % jumlahPerkara) + 1),
        tanggalSidang: tgl,
        jamSidang: k === 0 ? "09:00:00" : "10:30:00",
        ruangan: "Ruang Sidang 1",
        agenda: "Pembuktian",
        ditunda: 0,
        sippDiperbarui: "2026-10-01 08:00:00",
        baris: { sidangId: String(1000 + id), nomorPerkara: `${id}/Pdt.G/2026/PA.Rekaan`, tanggalSidang: tgl, pihak: { penggugat: ["Rekaan A"], tergugat: ["Rekaan B"] } },
      });
    }
  }
  const panggilan: string[] = [];
  const bot: BotCermin = {
    ringkasan: async () => {
      panggilan.push("ringkasan");
      return {
        ok: true,
        data: {
          perkara: { jumlah: jumlahPerkara, terkecil: 1, terbesar: jumlahPerkara },
          sidang: { jumlah: semuaSidang.length, awal: "2026-01-01", akhir: tambahHari("2026-01-01", hari - 1) },
          hariIni: "2026-10-25",
        },
      };
    },
    perkara: async (setelahId, batas) => {
      panggilan.push(`perkara:${setelahId}:${batas}`);
      const daftar: PerkaraSumber[] = [];
      for (let id = setelahId + 1; id <= jumlahPerkara && daftar.length < batas; id++) daftar.push(perkaraRekaan(id));
      return { ok: true, data: { perkara: daftar, terakhirId: daftar.length ? Number(daftar[daftar.length - 1].perkaraId) : setelahId, habis: daftar.length < batas } };
    },
    sidang: async (dari, sampai) => {
      panggilan.push(`sidang:${dari}:${sampai}`);
      const dalam = semuaSidang.filter((s) => s.tanggalSidang >= dari && s.tanggalSidang <= sampai);
      const lebar = Math.round((Date.parse(sampai) - Date.parse(dari)) / 86_400_000) + 1;
      // Jendela lebih dari sehari yang melebihi batas baris terpotong; sehari penuh tidak.
      if (lebar > 1 && dalam.length > batasBaris) {
        return { ok: true, data: { dari, sampai, terpotong: true, sidang: dalam.slice(0, batasBaris) } satisfies JendelaSidang };
      }
      return { ok: true, data: { dari, sampai, terpotong: false, sidang: dalam } satisfies JendelaSidang };
    },
  };
  return { bot, panggilan, semuaSidang };
}

describe("C. pemindai awal", () => {
  let db: AletaDatabase;
  let jam: number;
  let pengaturan = { ...PENGATURAN_CERMIN_BAWAAN, pemindaiAktif: true, jedaDetik: 15 };

  const deps = (bot: BotCermin): DepsPemindai => ({
    db: async () => db,
    bot,
    pengaturan: async () => pengaturan,
    sekarang: () => new Date(jam),
  });
  /** Maju melewati jeda lalu satu putaran. */
  const putar = async (bot: BotCermin, opsi: { paksa?: boolean } = {}) => {
    jam += 20_000;
    return putaranPemindai(deps(bot), opsi);
  };

  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
    aturUlangPemindaiCermin();
    jam = Date.parse(MALAM);
    pengaturan = { ...PENGATURAN_CERMIN_BAWAAN, pemindaiAktif: true, jedaDetik: 15, ukuranKelompok: 300 };
  });
  afterEach(async () => {
    aturUlangPemindaiCermin();
    await db.close();
  });

  it("saklar pemindai MATI: tidak ada satu pun panggilan ke bot dan tidak ada yang ditulis", async () => {
    const { bot, panggilan } = botRekaan();
    pengaturan = { ...pengaturan, pemindaiAktif: false };
    const r = await putar(bot);
    expect(r.alasan).toBe("mati");
    expect(panggilan).toEqual([]);
    expect((await hitunganCermin(db)).perkara).toBe(0);
    expect((await muatKeadaanPemindai(db)).status).toBe("belum");
  });

  it("di luar jendela jam: berhenti ('jeda'), tidak menyentuh bot, lanjut malam berikutnya", async () => {
    const { bot, panggilan } = botRekaan();
    expect((await putar(bot)).alasan).toBe("ok"); // 22.00: kelompok pertama
    const sebelum = panggilan.length;
    jam = Date.parse(SIANG) + 86_400_000;
    const r = await putaranPemindai(deps(bot));
    expect(r.alasan).toBe("luar-jendela");
    expect(panggilan.length).toBe(sebelum);
    expect((await muatKeadaanPemindai(db)).status).toBe("jeda");
    // Malam berikutnya melanjutkan dari titik terakhir, bukan dari awal.
    jam = Date.parse(MALAM) + 2 * 86_400_000;
    const lanjut = await putaranPemindai(deps(bot));
    expect(lanjut.alasan).toBe("ok");
    expect(panggilan[panggilan.length - 1]).toBe("perkara:300:300");
  });

  it("memindai SELURUH perkara dan sidang berkelompok, lalu selesai; tidak ada baris ganda", async () => {
    const { bot, semuaSidang } = botRekaan();
    let putaran = 0;
    while (putaran++ < 200) {
      const r = await putar(bot);
      if (r.alasan === "selesai") break;
      expect(["ok", "selesai"]).toContain(r.alasan);
    }
    const k = await muatKeadaanPemindai(db);
    expect(k.status).toBe("selesai");
    expect(k.tahap).toBe("selesai");
    expect(persenKemajuan(k)).toBe(100);
    const h = await hitunganCermin(db);
    expect(h.perkara).toBe(650);
    expect(h.sidang).toBe(semuaSidang.length);
    // Satu baris per perkara/sidang (kunci utama), isinya persis dari bot.
    const satu = await db.queryAll<{ nomor_perkara: string; jenis_perkara_id: number; majelis_hakim: string }>(
      "SELECT nomor_perkara, jenis_perkara_id, majelis_hakim FROM aleta_cermin_perkara WHERE perkara_id = ?",
      ["7"]
    );
    expect(satu).toEqual([{ nomor_perkara: "7/Pdt.G/2026/PA.Rekaan", jenis_perkara_id: 346, majelis_hakim: "Hakim Rekaan" }]);
  });

  it("isi layar dari cermin = baris yang disusun bot (baris_json persis sama)", async () => {
    const { bot, semuaSidang } = botRekaan({ perkara: 100, hariSidang: 3, batasBaris: 99 });
    for (let i = 0; i < 20; i++) if ((await putar(bot)).alasan === "selesai") break;
    for (const s of semuaSidang) {
      const [r] = await db.queryAll<{ baris_json: string; tanggal_sidang: string }>("SELECT baris_json, tanggal_sidang FROM aleta_cermin_sidang WHERE sidang_id = ?", [s.sidangId]);
      expect(JSON.parse(r.baris_json)).toEqual(s.baris);
      expect(r.tanggal_sidang).toBe(s.tanggalSidang);
    }
  });

  it("berhenti lalu lanjut dari titik terakhir - juga sesudah proses dimulai ulang (ingatan proses hilang)", async () => {
    const a = botRekaan();
    await putar(a.bot); // 1..300
    await putar(a.bot); // 301..600
    const k1 = await muatKeadaanPemindai(db);
    expect(k1.perkara.kursor).toBe(600);
    expect(k1.perkara.diproses).toBe(600);

    aturUlangPemindaiCermin(); // proses portal mulai ulang
    const b = botRekaan();
    const r = await putar(b.bot);
    expect(r.alasan).toBe("ok");
    // Kelompok pertama sesudah mulai ulang meminta setelah id 600, bukan 0; ringkasan tidak ditanya lagi.
    expect(b.panggilan[0]).toBe("perkara:600:300");
    expect(b.panggilan).not.toContain("ringkasan");
    const k2 = await muatKeadaanPemindai(db);
    expect(k2.perkara.diproses).toBe(650);
    expect(k2.tahap).toBe("sidang");
    expect(k2.mulaiPada).toBe(k1.mulaiPada);
  });

  it("jeda antar kelompok dihormati: putaran terlalu cepat menunggu, tanpa menyentuh bot", async () => {
    const { bot, panggilan } = botRekaan();
    expect((await putar(bot)).alasan).toBe("ok");
    const n = panggilan.length;
    jam += 5_000; // jeda 15 dtk belum lewat
    expect((await putaranPemindai(deps(bot))).alasan).toBe("menunggu-jeda");
    expect(panggilan.length).toBe(n);
    jam += 11_000;
    expect((await putaranPemindai(deps(bot))).alasan).toBe("ok");
  });

  it("jendela sidang terpotong mengecil dan diulang - tidak satu sidang pun hilang", async () => {
    const { bot, panggilan, semuaSidang } = botRekaan({ perkara: 50, hariSidang: 20, batasBaris: 3 });
    for (let i = 0; i < 300; i++) if ((await putar(bot)).alasan === "selesai") break;
    expect((await muatKeadaanPemindai(db)).status).toBe("selesai");
    expect((await hitunganCermin(db)).sidang).toBe(semuaSidang.length);
    // Ada jendela yang memang dicoba lebih lebar lalu dikecilkan.
    expect(panggilan.some((p) => p === "sidang:2026-01-01:2026-01-07")).toBe(true);
    expect(panggilan.some((p) => p === "sidang:2026-01-01:2026-01-03")).toBe(true);
  });

  it("pemindaian ulang tidak menulis baris yang tidak berubah (sidik sama)", async () => {
    const a = botRekaan({ perkara: 100, hariSidang: 2, batasBaris: 99 });
    for (let i = 0; i < 10; i++) if ((await putar(a.bot)).alasan === "selesai") break;
    const [sebelum] = await db.queryAll<{ cermin_diperbarui: string }>("SELECT cermin_diperbarui FROM aleta_cermin_perkara WHERE perkara_id = '5'");
    await ulangPemindai(db);
    jam += 3_600_000;
    for (let i = 0; i < 10; i++) if ((await putar(a.bot)).alasan === "selesai") break;
    const [sesudah] = await db.queryAll<{ cermin_diperbarui: string }>("SELECT cermin_diperbarui FROM aleta_cermin_perkara WHERE perkara_id = '5'");
    expect(sesudah.cermin_diperbarui).toBe(sebelum.cermin_diperbarui);
    expect((await hitunganCermin(db)).perkara).toBe(100);
  });

  it("perkara yang berubah di SIPP diperbarui pada pemindaian ulang", async () => {
    const a = botRekaan({ perkara: 20, hariSidang: 1, batasBaris: 99 });
    for (let i = 0; i < 10; i++) if ((await putar(a.bot)).alasan === "selesai") break;
    const asli = a.bot.perkara;
    a.bot.perkara = async (setelah, batas) => {
      const r = await asli(setelah, batas);
      if (r.ok) r.data.perkara = r.data.perkara.map((p) => (p.perkaraId === "3" ? { ...p, tanggalPutusan: "2026-10-20", statusPutusan: "Dikabulkan" } : p));
      return r;
    };
    await ulangPemindai(db);
    for (let i = 0; i < 10; i++) if ((await putar(a.bot)).alasan === "selesai") break;
    const [r] = await db.queryAll<{ tanggal_putusan: string; status_putusan: string }>("SELECT tanggal_putusan, status_putusan FROM aleta_cermin_perkara WHERE perkara_id = '3'");
    expect(r).toEqual({ tanggal_putusan: "2026-10-20", status_putusan: "Dikabulkan" });
  });

  it("galat bot: jeda bertambah, lima galat beruntun menghentikan pemindai, 'lanjutkan' menjalankannya lagi", async () => {
    const a = botRekaan();
    const rusak: BotCermin = { ...a.bot, perkara: async () => ({ ok: false, error: "SIPP tidak menjawab" }) };
    expect(jedaSesudahGalatMs(15, 0)).toBe(15_000);
    expect(jedaSesudahGalatMs(15, 1)).toBe(30_000);
    expect(jedaSesudahGalatMs(15, 3)).toBe(120_000);
    expect(jedaSesudahGalatMs(15, 20)).toBe(600_000);

    // Satu putaran sukses lebih dulu supaya keadaan tersimpan (status 'berjalan').
    expect((await putar(a.bot)).alasan).toBe("ok");
    let beruntun = 0;
    for (let i = 0; i < 12 && beruntun < 5; i++) {
      jam += 700_000; // melewati jeda terpanjang
      const r = await putaranPemindai(deps(rusak));
      if (r.alasan === "galat") beruntun += 1;
    }
    const k = await muatKeadaanPemindai(db);
    expect(k.status).toBe("galat");
    expect(k.galat.beruntun).toBe(5);
    expect(k.galat.terakhir).toContain("SIPP tidak menjawab");
    // Titik terakhir tidak bergeser oleh galat.
    expect(k.perkara.kursor).toBe(300);

    jam += 700_000;
    const dipanggil = a.panggilan.length;
    expect((await putaranPemindai(deps(a.bot))).alasan).toBe("galat-berhenti");
    expect(a.panggilan.length).toBe(dipanggil); // berhenti = tidak menekan SIPP lagi

    await lanjutkanPemindai(db);
    jam += 700_000;
    expect((await putaranPemindai(deps(a.bot))).alasan).toBe("ok");
    expect((await muatKeadaanPemindai(db)).galat.beruntun).toBe(0);
  });

  it("putaran bersamaan di satu proses tidak bertumpuk", async () => {
    const a = botRekaan();
    const lambat: BotCermin = {
      ...a.bot,
      perkara: async (s, b) => {
        await new Promise((r) => setTimeout(r, 30));
        return a.bot.perkara(s, b);
      },
    };
    jam += 20_000;
    const [x, y] = await Promise.all([putaranPemindai(deps(lambat)), putaranPemindai(deps(lambat))]);
    expect([x.alasan, y.alasan].sort()).toEqual(["ok", "sibuk"]);
  });

  it("tombol Super Admin (paksa) melewati saklar dan jendela jam", async () => {
    const a = botRekaan();
    pengaturan = { ...pengaturan, pemindaiAktif: false };
    jam = Date.parse(SIANG);
    const r = await putaranPemindai(deps(a.bot), { paksa: true });
    expect(r.alasan).toBe("ok");
    expect((await hitunganCermin(db)).perkara).toBe(300);
  });
});

// ============================================================================
// D. bot: hanya membaca
// ============================================================================
describe("D. bot - tidak ada satu pun tulisan ke SIPP", () => {
  const tanpaKomentar = (teks: string) => teks.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("cerminService.js dan cerminRoutes.js: tanpa kata kunci tulis/skema SQL dan tanpa rute selain GET", () => {
    for (const b of ["aleta_bot/services/cerminService.js", "aleta_bot/services/cerminPembaruanService.js", "aleta_bot/routes/cerminRoutes.js"]) {
      const kode = tanpaKomentar(baca(b));
      expect(kode, b).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|TRUNCATE|CREATE|GRANT|TRIGGER)\b/);
      expect(kode, b).not.toMatch(/router\.(post|put|patch|delete)\(/);
      expect(kode, b).not.toMatch(/v_pihak_perkara/);
    }
    const rute = baca("aleta_bot/routes/cerminRoutes.js");
    expect(rute.match(/router\.get\(/g)?.length).toBe(7);
    expect(rute.match(/wajibToken/g)!.length).toBeGreaterThanOrEqual(8); // definisi + tujuh rute
  });

  it("dipasang di /internal/aleta-bot/cermin", () => {
    expect(baca("aleta_bot/app.js")).toContain('app.use("/internal/aleta-bot/cermin", require("./routes/cerminRoutes"));');
  });

  it("perilaku: setiap kueri ke SIPP berawalan SELECT, berparameter, dan berbatas", async () => {
    const jalurDb = muatBot.resolve("./db_config.js");
    const jalurJadwal = muatBot.resolve("./services/sippJadwalSidangService.js");
    const jalurCermin = muatBot.resolve("./services/cerminService.js");
    const Modul = muatBot("module") as unknown as new (id: string) => { filename: string; loaded: boolean; exports: unknown };
    const pasang = (jalur: string, isi: unknown) => {
      const m = new Modul(jalur);
      m.filename = jalur;
      m.loaded = true;
      m.exports = isi;
      (muatBot.cache as Record<string, unknown>)[jalur] = m;
    };
    const kueri: Array<{ sql: string; params: unknown[] }> = [];
    pasang(jalurDb, {
      query: (sql: string, params: unknown[], cb: (e: unknown, r: unknown) => void) => {
        kueri.push({ sql, params });
        if (/FROM perkara\s+WHERE perkara_id > \?/.test(sql)) {
          return cb(null, [
            { perkaraId: 11, nomorPerkara: "11/Pdt.G/2026/PA.Rekaan", jenisPerkaraId: 346, jenisPerkaraNama: "Cerai Talak", alurPerkaraId: 15, tanggalPendaftaran: new Date(2026, 0, 2), prodeo: 0, tahapanTerakhirId: 15, tahapanTerakhirText: "Persidangan", prosesTerakhirId: 1, prosesTerakhirText: "Sidang", diinput: new Date(2026, 0, 2, 8, 0, 0), diperbaharui: new Date("invalid"), diedit: null },
            { perkaraId: 12, nomorPerkara: "12/Pdt.G/2026/PA.Rekaan", jenisPerkaraId: 345, jenisPerkaraNama: "Cerai Gugat", alurPerkaraId: 15, tanggalPendaftaran: "0000-00-00", prodeo: 1, tahapanTerakhirId: null, tahapanTerakhirText: "", prosesTerakhirId: null, prosesTerakhirText: "", diinput: null, diperbaharui: null, diedit: null },
          ]);
        }
        if (/FROM perkara_penetapan/.test(sql)) return cb(null, [{ perkaraId: 11, majelis: " Hakim Rekaan ", panitera: "PP", jurusita: "JS", sidangPertama: new Date(2026, 1, 1), diinput: null, diperbaharui: new Date(2026, 9, 1, 9, 30, 15), diedit: null }]);
        if (/FROM perkara_putusan/.test(sql)) {
          return cb(null, [
            { perkaraId: 11, tanggalPutusan: new Date(2026, 5, 1), statusNama: "Dicabut", verstek: "T", tanggalMinutasi: null, tanggalBht: null, diinput: null, diperbaharui: null, diedit: null },
            { perkaraId: 11, tanggalPutusan: new Date(2026, 6, 1), statusNama: "Dikabulkan", verstek: "Y", tanggalMinutasi: new Date(2026, 6, 5), tanggalBht: new Date(2026, 6, 20), diinput: null, diperbaharui: null, diedit: null },
          ]);
        }
        if (/FROM perkara_jadwal_sidang/.test(sql) && /GROUP BY perkara_id/.test(sql)) {
          return cb(null, [{ perkaraId: 11, jumlah: 4, terakhir: new Date(2026, 2, 3), berikut: null, diinput: null, diperbaharui: null, diedit: null }]);
        }
        return cb(null, []);
      },
    });
    pasang(jalurJadwal, { daftarSidang: async () => ({ ok: true, sidang: [] }) });
    delete (muatBot.cache as Record<string, unknown>)[jalurCermin];
    try {
      const cermin = muatBot(jalurCermin) as {
        kelompokPerkara: (o: { setelahId: number; batas: number }) => Promise<{ perkara: Array<Record<string, unknown>>; terakhirId: number; habis: boolean }>;
        ringkasanSumber: () => Promise<unknown>;
        sidangJendela: (o: { dari: string; sampai: string }) => Promise<unknown>;
        BATAS_PERKARA: number;
      };
      const k = await cermin.kelompokPerkara({ setelahId: 10, batas: 9999 });
      await cermin.ringkasanSumber();
      await cermin.sidangJendela({ dari: "2026-01-01", sampai: "2026-01-07" });

      expect(kueri.length).toBeGreaterThan(4);
      for (const q of kueri) {
        expect(q.sql.trim(), q.sql).toMatch(/^SELECT\b/i);
        expect(q.sql, q.sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP)\b/i);
      }
      // Batas kelompok dijepit di sisi bot (500) walau diminta 9999; setelahId menjadi parameter, bukan teks.
      const dasar = kueri.find((q) => /FROM perkara\s+WHERE perkara_id > \?/.test(q.sql))!;
      expect(dasar.params).toEqual([10, 500]);
      expect(dasar.sql).not.toMatch(/>\s*10/);

      expect(k.terakhirId).toBe(12);
      expect(k.habis).toBe(true);
      const [satu, dua] = k.perkara;
      expect(satu).toMatchObject({
        perkaraId: "11",
        tanggalPendaftaran: "2026-01-02",
        majelisHakim: "Hakim Rekaan",
        sidangPertama: "2026-02-01",
        sidangTerakhir: "2026-03-03",
        sidangBerikut: "",
        jumlahSidang: 4,
        // Putusan TERAKHIR yang dipakai (urut naik -> menimpa), bukan yang pertama.
        statusPutusan: "Dikabulkan",
        tanggalPutusan: "2026-07-01",
        putusanVerstek: 1,
        tanggalMinutasi: "2026-07-05",
        tanggalBht: "2026-07-20",
      });
      // Waktu SIPP terbaru dari semua tabel; Date rusak diabaikan.
      expect(satu.sippDiperbarui).toBe("2026-10-01 09:30:15");
      // Tanggal nol SIPP tidak jadi "NaN-NaN-NaN".
      expect(dua).toMatchObject({ perkaraId: "12", tanggalPendaftaran: "", prodeo: 1, sippDiperbarui: "", tanggalPutusan: "", jumlahSidang: 0 });
    } finally {
      for (const j of [jalurDb, jalurJadwal, jalurCermin]) delete (muatBot.cache as Record<string, unknown>)[j];
    }
  });
});

// ============================================================================
// E. rute admin
// ============================================================================
let dbRute: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => dbRute };
});

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, any>; error?: { message: string } } };
async function panggil(cara: "GET" | "PUT" | "POST", badan?: unknown): Promise<Hasil> {
  const modul = await import("@/app/api/admin/cermin-perkara/route");
  const req = new NextRequest("http://localhost/api/admin/cermin-perkara", {
    method: cara,
    headers: badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: badan !== undefined ? JSON.stringify(badan) : undefined,
  });
  const jawaban = await (modul as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara](req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

describe("E. rute admin Pemantau Cermin Perkara", () => {
  beforeAll(() => {
    process.env.ALETA_CERMIN_PEMINDAI = "0";
  });
  beforeEach(async () => {
    dbRute = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    aturUlangPemindaiCermin();
    buangSinggahPengaturanCermin();
  });
  afterEach(async () => {
    buangSinggahPengaturanCermin();
    await dbRute?.close();
    dbRute = null;
  });
  afterAll(() => {
    delete process.env.ALETA_CERMIN_PEMINDAI;
  });

  it("tanpa sesi 401; pegawai biasa 403 untuk membaca, menyimpan, dan menjalankan", async () => {
    aktor = null;
    expect((await panggil("GET")).status).toBe(401);
    aktor = "usr-hakim";
    expect((await panggil("GET")).status).toBe(403);
    expect((await panggil("PUT", { pemindaiAktif: true })).status).toBe(403);
    expect((await panggil("POST", { aksi: "putaran-sekarang" })).status).toBe(403);
    expect(await bacaPengaturanCerminTersimpan(dbRute as AletaDatabase)).toBeNull();
  });

  it("Admin MELIHAT (semua mati, tidak boleh mengubah); Super Admin boleh mengubah", async () => {
    aktor = "usr-admin";
    const lihat = await panggil("GET");
    expect(lihat.status).toBe(200);
    expect(lihat.isi.data.bolehMengubah).toBe(false);
    expect(lihat.isi.data.pengaturan.pemindaiAktif).toBe(false);
    expect(lihat.isi.data.layar.map((l: { aktif: boolean }) => l.aktif)).toEqual([false, false, false, false]);
    expect(lihat.isi.data.keadaan.status).toBe("belum");
    expect(lihat.isi.data.persen).toBe(0);
    expect((await panggil("PUT", { pemindaiAktif: true })).status).toBe(403);
    expect((await panggil("POST", { aksi: "ulang", konfirmasi: true })).status).toBe(403);

    aktor = "usr-super";
    const super_ = await panggil("GET");
    expect(super_.isi.data.bolehMengubah).toBe(true);
  });

  it("Super Admin menyimpan saklar: tersimpan, tercatat di jejak audit, dan dibaca gerbang layar", async () => {
    const r = await panggil("PUT", { pemindaiAktif: true, layar: { mediasi: true }, ukuranKelompok: 200, jedaDetik: 20 });
    expect(r.status).toBe(200);
    expect(r.isi.data.pengaturan).toMatchObject({ pemindaiAktif: true, ukuranKelompok: 200, jedaDetik: 20 });
    expect(r.isi.data.layar.find((l: { kunci: string }) => l.kunci === "mediasi").aktif).toBe(true);
    expect(r.isi.data.layar.find((l: { kunci: string }) => l.kunci === "jadwal").aktif).toBe(false);
    expect(await layarMembacaCermin("mediasi", dbRute as AletaDatabase)).toBe(true);
    expect(await layarMembacaCermin("jadwal", dbRute as AletaDatabase)).toBe(false);

    const baris = await (dbRute as AletaDatabase).prepare("SELECT action, actor_user_id, payload_json FROM audit_logs WHERE action = ?").all<{ actor_user_id: string; payload_json: string }>("UPDATE_CERMIN_PERKARA");
    expect(baris).toHaveLength(1);
    expect(baris[0].actor_user_id).toBe("usr-super");
    expect(JSON.parse(baris[0].payload_json)).toMatchObject({ pemindaiAktif: true, layar: { mediasi: true, jadwal: false } });
  });

  it("'Matikan semua' (bawaan) menghapus pengaturan; semua layar kembali membaca SIPP", async () => {
    await panggil("PUT", { pemindaiAktif: true, layar: { jadwal: true, status: true } });
    const r = await panggil("PUT", { bawaan: true });
    expect(r.status).toBe(200);
    expect(r.isi.data.pengaturan.pemindaiAktif).toBe(false);
    for (const l of LAYAR_CERMIN) expect(await layarMembacaCermin(l, dbRute as AletaDatabase), l).toBe(false);
    const aksi = await (dbRute as AletaDatabase).prepare("SELECT action FROM audit_logs WHERE action IN (?, ?) ORDER BY created_at").all<{ action: string }>("UPDATE_CERMIN_PERKARA", "RESET_CERMIN_PERKARA");
    expect(aksi.map((a) => a.action)).toEqual(["UPDATE_CERMIN_PERKARA", "RESET_CERMIN_PERKARA"]);
  });

  it("gagal membaca pengaturan = semua layar MATI (jalur lama), bukan nyala", async () => {
    const rusak = { prepare: () => ({ all: async () => { throw new Error("db mati"); } }) } as unknown as AletaDatabase;
    for (const l of LAYAR_CERMIN) expect(await layarMembacaCermin(l, rusak), l).toBe(false);
  });

  it("aksi tidak dikenal 400; mulai ulang menuntut konfirmasi; 'ulang' menghapus kemajuan tanpa menyentuh isi cermin", async () => {
    expect((await panggil("POST", { aksi: "ngawur" })).status).toBe(400);
    expect((await panggil("POST", { aksi: "ulang" })).status).toBe(400);
    const d = dbRute as AletaDatabase;
    await d.run("INSERT INTO aleta_cermin_perkara (perkara_id, cermin_diperbarui) VALUES ('1', 'x')");
    await d.run("INSERT INTO aleta_cermin_jejak (kunci, nilai_json, diperbarui_at) VALUES ('pemindai', ?, 'x')", [JSON.stringify({ status: "berjalan", tahap: "perkara", perkara: { kursor: 5, total: 9, diproses: 5, terbesar: 9 } })]);
    expect((await panggil("GET")).isi.data.keadaan.perkara.kursor).toBe(5);
    expect((await panggil("POST", { aksi: "ulang", konfirmasi: true })).status).toBe(200);
    expect((await panggil("GET")).isi.data.keadaan.status).toBe("belum");
    expect((await hitunganCermin(d)).perkara).toBe(1);
  });
});
