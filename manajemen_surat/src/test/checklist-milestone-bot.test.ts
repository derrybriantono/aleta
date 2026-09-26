// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PEMBACA FAKTA CHECKLIST DI BOT - URUTAN NILAI DAN LINGKUP
 * ============================================================================
 *
 * Yang dijaga di sini adalah dua kekeliruan yang TIDAK BERBUNYI:
 *
 *   1. urutan nilai yang bergeser dari urutan tanda tanyanya - kuerinya tetap
 *      jalan, hanya saja yang terbaca perkara orang lain atau rentang tanggal
 *      yang salah;
 *   2. id pejabat yang kosong dibaca sebagai "seluruh satker" - hakim yang
 *      belum tertaut tiba-tiba memikul seluruh perkara pengadilan.
 *
 * Modulnya dijalankan sungguhan (createRequire) dengan db_config dan
 * botDbService tiruan yang mencatat tiap kueri; tidak ada MySQL yang disentuh.
 * Kebenaran SQL-nya atas SIPP sungguhan diukur terpisah atas sipp_donggala.
 */

const AKAR_BOT = path.resolve(__dirname, "../../../aleta_bot");
const muat = createRequire(path.join(AKAR_BOT, "package.json"));

type Kueri = { sql: string; nilai: unknown[] };
let catatan: Kueri[] = [];
let jawab: (sql: string) => unknown[] = () => [];

function bersihkanCache() {
  for (const kunci of Object.keys(muat.cache)) {
    if (kunci.startsWith(AKAR_BOT) && !kunci.includes("node_modules")) delete muat.cache[kunci];
  }
}

function pasangTiruan() {
  const dbPalsu = {
    query(sql: string, nilai: unknown[] | ((e: unknown, r: unknown) => void), cb?: (e: unknown, r: unknown) => void) {
      const selesai = typeof nilai === "function" ? nilai : cb;
      const daftar = Array.isArray(nilai) ? nilai : [];
      catatan.push({ sql: String(sql), nilai: daftar });
      // jawab() boleh melempar - itu kueri yang gagal di MySQL.
      let hasil: unknown[];
      try {
        hasil = jawab(String(sql));
      } catch (galat) {
        selesai?.(galat, null);
        return;
      }
      selesai?.(null, hasil);
    },
  };
  const botDbPalsu = {
    query: async (sql: string, nilai: unknown[] = []) => {
      catatan.push({ sql: `BOTDB ${sql}`, nilai });
      return [];
    },
    fromMysqlDate: () => null,
    toMysqlDate: () => null,
  };
  for (const [relatif, isi] of [
    ["./db_config", dbPalsu],
    ["./services/botDbService", botDbPalsu],
  ] as const) {
    const berkas = muat.resolve(relatif);
    muat.cache[berkas] = { id: berkas, filename: berkas, loaded: true, exports: isi } as unknown as NodeJS.Module;
  }
}

type Layanan = {
  PERAN_SAH: string[];
  bacaFakta: (m: Record<string, string>) => Promise<{
    ok: boolean;
    error?: string;
    fakta: Record<string, unknown[]>;
    gagal: Record<string, string>;
    catatan?: string[];
    id: Record<string, number[]>;
  }>;
  koleksi: Record<string, (...a: unknown[]) => Promise<unknown[]>>;
  _uji: { daftarId: (x: string) => number[]; geser: (a: string, n: number) => string };
};

// Uji mutan menjalankan berkas ini atas SALINAN layanannya (bersebelahan,
// supaya require relatifnya tetap benar) lewat CHECKLIST_BOT_BERKAS.
const BERKAS_LAYANAN = process.env.CHECKLIST_BOT_BERKAS || "./services/checklistMilestoneService.js";

function layanan(): Layanan {
  return muat(BERKAS_LAYANAN) as Layanan;
}

// Sama, untuk dua perubahan opt-in di sippJadwalSidangService (penanda sidang
// ikrar, pelapor kegagalan durasi) - mutannya dijalankan atas SALINAN.
const BERKAS_JADWAL = process.env.SIPP_JADWAL_BERKAS || "./services/sippJadwalSidangService.js";

type Jadwal = {
  keadaanPanggilanSidang: (d: unknown[]) => Promise<Record<string, { wajibDipanggil: number[]; belumDipanggil: number }>>;
  durasiBanyakPerkara: (id: unknown[], opsi?: unknown) => Promise<Record<string, unknown>>;
};

function jadwal(): Jadwal {
  return muat(BERKAS_JADWAL) as Jadwal;
}

/** Satu baris sidang seperti keluaran kueri utama koleksiSidang. */
function barisSidang(ubah: Record<string, unknown> = {}) {
  return {
    sidangId: 501,
    perkaraId: 9001,
    nomorPerkara: "9001/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Talak",
    alurPerkaraId: 15,
    tanggalSidang: "2026-09-12",
    jamSidang: "09:00:00",
    agenda: "Pemeriksaan",
    urutan: 3,
    ditunda: "T",
    alasanDitunda: null,
    dihadiriOleh: null,
    edocBas: null,
    ikrarTalak: "T",
    jabatanSaya: null,
    ...ubah,
  };
}

/**
 * SIPP tiruan untuk satu perkara cerai talak: sidang putus 11 Agustus
 * dihadiri SEMUA pihak (dihadiri_oleh 1), sidang 501 pada 12 September dan
 * lanjutannya 502 pada 19 September (bendera/agenda sama dengan 501; 501
 * ditandai dihadiri semua supaya 502 pun "tidak wajib" menurut kehadiran),
 * kedua sisi pihak ada, belum ada relaas sama sekali.
 */
function jawabPerkaraIkrar(ubah: Record<string, unknown> = {}) {
  const penanda = { ikrarTalak: ubah.ikrarTalak ?? "T", agenda: ubah.agenda ?? "Pemeriksaan" };
  return (sql: string): unknown[] => {
    if (sql.includes("FROM perkara_jadwal_sidang j") && sql.includes("BETWEEN ? AND ?")) return [barisSidang(ubah)];
    if (sql.includes("j.ikrar_talak AS ikrarTalak, j.agenda AS agenda")) {
      return [
        { sidangId: 400, perkaraId: 9001, tanggalSidang: "2026-08-11", ikrarTalak: "T", agenda: "Pembacaan putusan" },
        { sidangId: 501, perkaraId: 9001, tanggalSidang: "2026-09-12", ...penanda },
        { sidangId: 502, perkaraId: 9001, tanggalSidang: "2026-09-19", ...penanda },
      ];
    }
    if (sql.includes("j.dihadiri_oleh AS dihadiriOleh")) {
      return [
        { sidangId: 400, perkaraId: 9001, tanggalSidang: "2026-08-11", dihadiriOleh: 1 },
        { sidangId: 501, perkaraId: 9001, tanggalSidang: "2026-09-12", dihadiriOleh: 1 },
        { sidangId: 502, perkaraId: 9001, tanggalSidang: "2026-09-19", dihadiriOleh: null },
      ];
    }
    if (sql.includes("GROUP BY vp.perkara_id, vp.pihak_ke")) {
      return [
        { perkaraId: 9001, pihakKe: 1 },
        { perkaraId: 9001, pihakKe: 2 },
      ];
    }
    return [];
  };
}

/** Nilai tiap tanda tanya dipasangkan dengan potongan SQL sebelum tanda tanya itu. */
function pasangan(k: Kueri): Array<{ konteks: string; nilai: unknown }> {
  const bagian = k.sql.split("?");
  expect(bagian.length - 1, k.sql).toBe(k.nilai.length);
  return k.nilai.map((nilai, i) => ({ konteks: bagian[i].replace(/\s+/g, " ").slice(-60), nilai }));
}

beforeEach(() => {
  catatan = [];
  jawab = () => [];
  bersihkanCache();
  pasangTiruan();
});

afterEach(() => {
  bersihkanCache();
});

describe("checklistMilestoneService (bot)", () => {
  it("peran yang tidak dikenal ditolak tanpa kueri", async () => {
    const h = await layanan().bacaFakta({ peran: "semua", acuan: "2026-09-10" });
    expect(h.ok).toBe(false);
    expect(catatan).toEqual([]);
  });

  it("id pejabat disaring: bukan angka dibuang, ganda dirapatkan", () => {
    expect(layanan()._uji.daftarId("26, 26,x,0,-3, 33,")).toEqual([26, 33]);
  });

  it("hakim tanpa id: tidak satu pun kueri SIPP berlingkup perorangan dijalankan", async () => {
    const h = await layanan().bacaFakta({ peran: "hakim", acuan: "2026-09-10", hakim: "" });
    expect(h.ok).toBe(true);
    const sipp = catatan.filter((k) => !k.sql.startsWith("BOTDB"));
    expect(sipp).toEqual([]);
    expect(h.fakta.sidang).toEqual([]);
    expect(h.fakta.berjalan).toEqual([]);
  });

  it("perkara tambahan hakim yang belum tertaut: tidak ada 'IN ()' di kueri mana pun", async () => {
    // Ditemukan uji ujung-ke-ujung atas sipp_donggala: kolom jabatan menyusun
    // "hakim_id IN ()" dan MariaDB menolaknya (ER_PARSE_ERROR), sehingga
    // tunjukan konseptor dan titipan PHS hilang tanpa jejak di layar.
    await layanan().bacaFakta({ peran: "hakim", acuan: "2026-09-10", hakim: "", perkara: "700,701" });
    const tambahan = catatan.find((k) => k.sql.includes("FROM perkara p") && k.sql.includes("perkara_putusan pu"));
    expect(tambahan).toBeDefined();
    for (const k of catatan) expect(k.sql).not.toMatch(/IN \(\s*\)/);
    expect(pasangan(tambahan as Kueri).map((x) => x.nilai)).toEqual([700, 701]);
  });

  it("sidang hakim: urutan nilai = id jabatan, rentang tanggal, id lingkup, lalu acuan pengurut jarak", async () => {
    await layanan().koleksi.koleksiSidang(
      { jenis: "hakim", id: [26, 33] },
      { dari: "2026-08-11", sampai: "2026-09-17", acuan: "2026-09-10" }
    );
    const utama = catatan.find((k) => k.sql.includes("FROM perkara_jadwal_sidang j") && k.sql.includes("BETWEEN"));
    expect(utama).toBeDefined();
    const p = pasangan(utama as Kueri);
    expect(p.map((x) => x.nilai)).toEqual([26, 33, "2026-08-11", "2026-09-17", 26, 33, "2026-09-10"]);
    expect(p[0].konteks).toMatch(/jh\.hakim_id IN \($/);
    expect(p[2].konteks).toMatch(/BETWEEN $/);
    expect(p[4].konteks).toMatch(/lh\.hakim_id IN \($/);
    // Yang terpotong batas baris adalah sidang TERJAUH dari hari acuan.
    expect(p[6].konteks).toMatch(/ORDER BY ABS\(DATEDIFF\(j\.tanggal_sidang, $/);
    expect((utama as Kueri).sql).toMatch(/LIMIT 1501/);
  });

  it("peta panggilan yang gagal dilaporkan ke gagal tingkat atas ('sidang.panggilan'), bukan hanya ditandai per baris", async () => {
    jawab = (sql) => {
      if (sql.includes("r.sidang_id IN")) throw new Error("ER_LOCK_WAIT_TIMEOUT");
      if (sql.includes("FROM perkara_jadwal_sidang j") && sql.includes("BETWEEN ? AND ?")) return [barisSidang()];
      return [];
    };
    const h = await layanan().bacaFakta({ peran: "jurusita", acuan: "2026-09-10", jurusita: "22" });
    expect(h.gagal["sidang.panggilan"]).toMatch(/ER_LOCK_WAIT_TIMEOUT/);
    expect(h.gagal.sidang).toBeUndefined();
    expect(h.fakta.sidang[0]).toMatchObject({ panggilanTerbaca: false, panggilan: null });
  });

  it("umur perkara yang gagal dibaca: baris berjalan tetap pulang bertanda durasiTerbaca=false, kegagalannya di gagal['berjalan.durasi']", async () => {
    jawab = (sql) => {
      if (sql.includes("GROUP BY p.perkara_id, p.tanggal_pendaftaran")) throw new Error("ER_QUERY_INTERRUPTED");
      if (sql.includes("p.tanggal_pendaftaran AS tanggalDaftar") && sql.includes("pu.tanggal_putusan IS NULL")) {
        return [{ perkaraId: 77, nomorPerkara: "77/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalDaftar: "2026-03-01", jabatanSaya: null }];
      }
      return [];
    };
    const h = await layanan().bacaFakta({ peran: "ketua", acuan: "2026-09-10" });
    expect(h.gagal["berjalan.durasi"]).toMatch(/^perkara: ER_QUERY_INTERRUPTED/);
    expect(h.gagal.berjalan).toBeUndefined();
    expect(h.fakta.berjalan).toEqual([expect.objectContaining({ perkaraId: "77", durasiTerbaca: false })]);
  });

  it("durasiBanyakPerkara: kegagalan dikabarkan hanya kepada pemanggil yang meminta; pemakai lain tetap menerima peta kosong", async () => {
    jawab = (sql) => {
      if (sql.includes("GROUP BY p.perkara_id, p.tanggal_pendaftaran")) throw new Error("ER_QUERY_INTERRUPTED");
      return [];
    };
    expect(await jadwal().durasiBanyakPerkara([11, 12])).toEqual({});
    const dicatat: string[] = [];
    const hasil = await jadwal().durasiBanyakPerkara([11, 12], {
      catatGagal: (bagian: string, galat: Error) => dicatat.push(`${bagian}:${galat.message}`),
    });
    expect(hasil).toEqual({});
    expect(dicatat).toEqual(["perkara:ER_QUERY_INTERRUPTED"]);
  });

  it("sidang ikrar talak: panggilannya menuntut KEDUA pihak walau semua hadir saat putusan; sidang biasa tidak berubah", async () => {
    jawab = jawabPerkaraIkrar({ ikrarTalak: "Y", agenda: "SIDANG IKRAR TALAK" });
    const ikrar = await layanan().bacaFakta({ peran: "jurusita", acuan: "2026-09-10", jurusita: "22" });
    expect(ikrar.fakta.sidang[0]).toMatchObject({
      panggilan: { wajibDipanggil: [1, 2], sisiBelumDipanggil: [1, 2], belumDipanggil: 2 },
      // Lanjutannya pun sidang ikrar: portal menagihnya walau perkaranya putus.
      sidangBerikutId: "502",
      sidangBerikutIkrar: true,
      panggilanBerikut: { wajibDipanggil: [1, 2], belumDipanggil: 2 },
    });

    jawab = jawabPerkaraIkrar({ ikrarTalak: "T", agenda: "Pembuktian" });
    const biasa = await layanan().bacaFakta({ peran: "jurusita", acuan: "2026-09-10", jurusita: "22" });
    expect(biasa.fakta.sidang[0]).toMatchObject({
      panggilan: { wajibDipanggil: [], belumDipanggil: 0 },
      sidangBerikutIkrar: false,
      panggilanBerikut: { wajibDipanggil: [], belumDipanggil: 0 },
    });
  });

  it("keadaanPanggilanSidang: penanda wajibSemuaSisi menuntut kedua sisi; tanpa penanda aturannya tetap bagi pemakai lain", async () => {
    jawab = jawabPerkaraIkrar();
    const dengan = await jadwal().keadaanPanggilanSidang([{ sidangId: 501, perkaraId: 9001, wajibSemuaSisi: true }]);
    expect(dengan["501"]).toMatchObject({ wajibDipanggil: [1, 2], belumDipanggil: 2 });
    const tanpa = await jadwal().keadaanPanggilanSidang([{ sidangId: 501, perkaraId: 9001 }]);
    expect(tanpa["501"]).toMatchObject({ wajibDipanggil: [], belumDipanggil: 0 });
  });

  it("koleksi yang melampaui batas baris: yang terbuang yang TERTUA, urutan naik dikembalikan, dan pemotongannya disebut", async () => {
    const geser = layanan()._uji.geser;
    jawab = (sql) => {
      if (!sql.includes("pu.putusan_verstek AS verstek")) return [];
      // Urutan yang dipulangkan MySQL untuk ORDER BY ... DESC.
      return Array.from({ length: 1501 }, (_, i) => ({
        perkaraId: 100000 - i,
        nomorPerkara: `${100000 - i}/Pdt.G/2026/PA.Dgl`,
        tanggalPutusan: geser("2026-09-10", -Math.floor(i / 5)),
        statusPutusanId: 62,
        dihadiriSaatPutus: 1,
      }));
    };
    const h = await layanan().bacaFakta({ peran: "panitera", acuan: "2026-09-10" });
    const kueri = catatan.find((k) => k.sql.includes("pu.putusan_verstek AS verstek")) as Kueri;
    expect(kueri.sql).toMatch(/ORDER BY pu\.tanggal_putusan DESC, pu\.perkara_id DESC\s+LIMIT 1501/);
    const putusan = h.fakta.putusan as Array<{ perkaraId: string; tanggalPutusan: string }>;
    expect(putusan).toHaveLength(1500);
    expect(putusan.map((p) => p.perkaraId)).not.toContain("98500");
    expect(putusan[0]).toMatchObject({ perkaraId: "98501", tanggalPutusan: geser("2026-09-10", -299) });
    expect(putusan.at(-1)?.tanggalPutusan).toBe("2026-09-10");
    expect(h.catatan).toEqual([expect.stringMatching(/^Koleksi putusan melebihi 1500 baris; hanya 1500 putusan terbaru yang dinilai/)]);
  });

  it("peta pelengkap dibaca bertahap 500 perkara: perkara ke-501 tidak kehilangan putusan dan sidang lanjutannya", async () => {
    jawab = (sql) => {
      if (sql.includes("FROM perkara_jadwal_sidang j") && sql.includes("BETWEEN ? AND ?")) {
        return Array.from({ length: 600 }, (_, i) => barisSidang({ sidangId: 1000 + i, perkaraId: 5000 + i }));
      }
      return [];
    };
    await layanan().koleksi.koleksiSidang({ jenis: "satker", id: [] }, { dari: "2026-09-01", sampai: "2026-09-10", acuan: "2026-09-10" });
    const berikut = catatan.filter((k) => k.sql.includes("j.ikrar_talak AS ikrarTalak, j.agenda AS agenda"));
    expect(berikut.map((k) => k.nilai.length)).toEqual([500, 100]);
    expect(new Set(berikut.flatMap((k) => k.nilai)).size).toBe(600);
    const putusan = catatan.filter((k) => k.sql.includes("MAX(pu.tanggal_putusan) AS tanggalPutusan"));
    expect(putusan.map((k) => k.nilai.length)).toEqual([500, 100]);
  });

  it("putusan panitera pengganti: lingkup lewat perkara_panitera_pn aktif, tanpa kolom jabatan", async () => {
    await layanan().koleksi.koleksiPutusan({ jenis: "panitera", id: [28] }, { dari: "2026-07-12", sampai: "2026-09-10" });
    const k = catatan.find((x) => x.sql.includes("FROM perkara_putusan pu")) as Kueri;
    expect(k.sql).toMatch(/perkara_panitera_pn lp[\s\S]*lp\.aktif = 'Y'[\s\S]*lp\.panitera_id IN/);
    expect(pasangan(k).map((x) => x.nilai)).toEqual(["2026-07-12", "2026-09-10", 28]);
  });

  it("ikrar: nilai acuan, jabatan, status dikabulkan, rentang BHT, ambang ikrar, lingkup - berurutan", async () => {
    await layanan().koleksi.koleksiIkrar({ jenis: "hakim", id: [26] }, { acuan: "2026-09-10" });
    const k = catatan.find((x) => x.sql.includes("perkara_ikrar_talak it")) as Kueri;
    expect(pasangan(k).map((x) => x.nilai)).toEqual([
      "2026-09-10",
      26,
      62,
      "2024-09-10",
      "2026-09-10",
      "2026-09-03",
      26,
    ]);
  });

  it("mediasi disambung lewat mediator.hakim_id, bukan mediator_id = hakim_id", async () => {
    await layanan().koleksi.koleksiMediasi([26], { acuan: "2026-09-10" });
    const k = catatan.find((x) => x.sql.includes("FROM perkara_mediasi m")) as Kueri;
    expect(k.sql).toMatch(/JOIN mediator md ON md\.id = m\.mediator_id/);
    expect(k.sql).toMatch(/md\.hakim_id IN \(\?\)/);
    expect(pasangan(k).map((x) => x.nilai)).toEqual([26, "2026-05-13", "2026-09-10"]);
  });

  it("peran satker tidak membawa syarat lingkup perorangan", async () => {
    const h = await layanan().bacaFakta({ peran: "ketua", acuan: "2026-09-10" });
    expect(h.ok).toBe(true);
    const sipp = catatan.filter((k) => !k.sql.startsWith("BOTDB"));
    expect(sipp.length).toBeGreaterThan(0);
    for (const k of sipp) expect(k.sql).not.toMatch(/lh\.hakim_id|lp\.panitera_id|lj\.jurusita_id/);
  });

  it("hanya SELECT yang dikirim ke SIPP", async () => {
    for (const peran of layanan().PERAN_SAH) {
      await layanan().bacaFakta({ peran, acuan: "2026-09-10", hakim: "26", panitera: "28", jurusita: "22", perkara: "700,701" });
    }
    const sipp = catatan.filter((k) => !k.sql.startsWith("BOTDB"));
    expect(sipp.length).toBeGreaterThan(10);
    for (const k of catatan) expect(k.sql.replace(/^BOTDB /, "").trim()).toMatch(/^(SELECT|SHOW)\b/i);
  });
});
