// @vitest-environment node
/**
 * ============================================================================
 * BUTIR 38 DAN 39 (5 Okt 2026) - PENETAPAN AWAL LEWAT PANEL SIPP
 * ============================================================================
 *
 * Dijalankan, bukan dibaca. Mesin tulis bot dimuat utuh di atas basis data
 * SIPP tiruan yang MEREKAM tiap pernyataan, lalu rantai PMH -> PPP -> PJS ->
 * PHS untuk perkara 630/Pdt.G/2026/PA.Dgl (perkara_id 10187) dijalankan
 * seperti pada 5 Okt 2026.
 *
 * Butir 39 - yang tertulis di sys_audittrail hari itu (nomor 505555-505570):
 *   - username "fahri" / "Sri Susilowati" (pejabat) padahal yang menekan
 *     tombolnya masuk SIPP sebagai "derry briantono";
 *   - datetime 12:26:22 ... 12:54:22 padahal ditulis ±13.02 (disusun
 *     waktuLangkah, mundur) - layar Audit Trail mengurut menurut datetime,
 *     jadi barisnya terkubur: "tidak ada satu baris pun";
 *   - perkara_panitera_pn/perkara_jurusita "Primary Key" (SIPP: "Foreign Key"),
 *     description yang berbeda kolom dan urutannya dari fetch_description SIPP.
 *
 * Butir 38 - tanggal sidang yang dipilih dari kalender (15 Okt) diganti
 * diam-diam dengan usulan (21 Okt) di idUntukTulis/nilaiUntukBorang ekstensi.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));

// ---------------------------------------------------------------------------
// Basis data SIPP tiruan
// ---------------------------------------------------------------------------

type Baris = Record<string, unknown>;
type Tulisan = { sql: string; params: unknown[] };

const PENGGUNA = [
  { userid: 11, username: "derry briantono", fullname: "Derry Briantono, S.H.", block: 0 },
  { userid: 12, username: "fahri", fullname: "Fahri Saifuddin, S.H.I., M.H.", block: 0 },
  { userid: 13, username: "Sri Susilowati", fullname: "Sri Susilowati, S.H.", block: 0 },
  // Dua akun aktif bernama lengkap sama - persis meja1g/meja1p di satker.
  { userid: 21, username: "meja1g", fullname: "Tiffany RS", block: 0 },
  { userid: 22, username: "meja1p", fullname: "Tiffany RS", block: 0 },
];

const HAKIM: Record<number, Baris> = {
  32: { hakimId: 32, kode: "A", nip: "198208312007041001", nama: "Fahri Saifuddin, S.H.I., M.H.", namaPolos: "Fahri Saifuddin" },
  26: { hakimId: 26, kode: "C1", nip: "197806052005021002", nama: "Himawan Tatura Wijaya, S.H.I.,M.H.", namaPolos: "Himawan Tatura Wijaya" },
  31: { hakimId: 31, kode: "C3", nip: "199401022017121003", nama: "Derry Briantono, S.H.", namaPolos: "Derry Briantono" },
};

function basisSipp() {
  const keadaan = {
    jam: "2026-10-05 13:02:11",
    perkara: {
      perkaraId: 10187,
      nomorPerkara: "630/Pdt.G/2026/PA.Dgl",
      jenisPerkaraId: 347,
      tanggalDaftar: "2026-10-05",
      adaPenetapan: 0 as number,
      pmh: null as string | null,
      ppp: null as string | null,
      pjs: null as string | null,
      phs: null as string | null,
      adaSmartMajelis: 0,
      didaftar: "2026-10-05 09:43:21",
    },
    online: [
      { userid: 11, host: "192.168.9.109" },
      { userid: 21, host: "192.168.9.82" },
    ],
    idBerikutnya: {
      perkara_hakim_pn: 29317,
      perkara_panitera_pn: 10576,
      perkara_jurusita: 10359,
      perkara_jadwal_sidang: 20322,
      perkara_penetapan_hari_sidang: 23722,
    } as Record<string, number>,
  };
  const tulisan: Tulisan[] = [];

  const jawab = (sql: string, params: unknown[]): unknown => {
    const p = params || [];
    const max = /COALESCE\(MAX\(id\), 0\) \+ 1 AS berikutnya FROM (\w+)/.exec(sql);
    if (max) return [{ berikutnya: keadaan.idBerikutnya[max[1]] || 1 }];
    if (/COALESCE\(MAX\(urutan\), 0\) \+ 1/.test(sql)) return [{ berikutnya: 1 }];
    if (/DATE_FORMAT\(NOW\(\)/.test(sql)) return [{ saat: keadaan.jam }];
    if (/FROM perkara p\b/.test(sql)) return [{ ...keadaan.perkara }];
    if (/FROM sys_user_online/.test(sql)) {
      const [nama, host] = p.map(String);
      return keadaan.online
        .filter((o) => o.host === host)
        .map((o) => PENGGUNA.find((u) => u.userid === o.userid)!)
        .filter((u) => u && u.fullname === nama);
    }
    if (/FROM sys_users WHERE username = \?/.test(sql)) return PENGGUNA.filter((u) => u.username === String(p[0]));
    if (/FROM sys_users WHERE TRIM\(fullname\) = \?/.test(sql)) return PENGGUNA.filter((u) => u.fullname === String(p[0]));
    if (/FROM hakim_pn/.test(sql)) return p.map((x) => HAKIM[Number(x)]).filter(Boolean);
    if (/FROM panitera_pn/.test(sql)) return [{ id: 21, kode: "D", nip: "198906242011012009", namaGelar: "Andini Puspita Sari, S.Sy.", nama: "Andini Puspita Sari" }];
    if (/FROM jurusita/.test(sql)) return [{ id: 28, kode: "", nip: "198409012006042002", namaGelar: "Tanty Restianty, A.Md.", nama: "Tanty Restianty" }];
    if (/FROM ruangan_sidang/.test(sql)) return [{ id: 3, nama: "Sidang Keliling Sigi Biromaru", keliling: "1" }];
    if (/FROM ref_majelis_tetap/.test(sql)) return [{ majelisId: 35, kompetensiId: 22, skId: 3, hakim: "32,26,31" }];
    if (/^\s*(INSERT|UPDATE|REPLACE|DELETE)/i.test(sql)) {
      tulisan.push({ sql: sql.replace(/\s+/g, " ").trim(), params: [...p] });
      const ke = /^\s*INSERT INTO (\w+)/i.exec(sql);
      if (ke && keadaan.idBerikutnya[ke[1]] !== undefined) keadaan.idBerikutnya[ke[1]] += 1;
      return { affectedRows: 1, insertId: 0 };
    }
    return [];
  };

  const db = {
    query(sql: string, params: unknown, selesai: (g: unknown, h: unknown) => void) {
      const daftar = Array.isArray(params) ? params : [];
      selesai(null, jawab(String(sql), daftar));
    },
  };
  return { db, keadaan, tulisan };
}

type Layanan = {
  susunRencanaTulis: (m: Record<string, unknown>) => Promise<Record<string, any>>;
  jalankanRencana: (r: unknown, o?: Record<string, unknown>) => Promise<Record<string, any>>;
};

function muatLayanan(db: unknown): Layanan {
  const pasang = (berkas: string, exports: unknown) => {
    const jalur = require_.resolve(path.join(AKAR, "aleta_bot", berkas));
    require_.cache[jalur] = { id: jalur, filename: jalur, loaded: true, exports } as unknown as NodeJS.Module;
  };
  pasang("db_config.js", db);
  const jalurSkema = require_.resolve(path.join(AKAR, "aleta_bot/services/sippSkemaService.js"));
  delete require_.cache[jalurSkema];
  const skema = require_(jalurSkema) as Record<string, unknown>;
  pasang("services/sippSkemaService.js", { ...skema, tabelAda: async () => true });
  const jalur = require_.resolve(path.join(AKAR, "aleta_bot/services/penetapanTulisService.js"));
  delete require_.cache[jalur];
  return require_(jalur) as Layanan;
}

/** Baris sys_audittrail yang SUNGGUH dikirim, dalam urutan nomornya. */
function barisAudit(tulisan: Tulisan[]) {
  return tulisan
    .filter((t) => /^INSERT INTO sys_audittrail/.test(t.sql))
    .map((t) => {
      const [datetime, ipaddress, username, tablename, formname, action, title, description] = t.params.map(String);
      return { datetime, ipaddress, username, tablename, formname, action, title, description };
    });
}

/** Nama kolom pada description, berurutan - fetch_description SIPP. */
const kolomDeskripsi = (d: string) => [...d.matchAll(/<tr><td>([^<]*)<\/td><td>/g)].map((m) => m[1]);
const nilaiDeskripsi = (d: string, kolom: string) => {
  const m = new RegExp(`<tr><td>${kolom}</td><td>([^<]*(?:<\\/?br>[^<]*)*)</td></tr>`).exec(d);
  return m ? m[1] : undefined;
};

const PMH = "TAMBAH PENETAPAN HAKIM/MAJELIS HAKIM";
const PPP = "TAMBAH PENUNJUKAN PANITERA/PANITERA PENGGANTI";
const PJS = "TAMBAH PENUNJUKAN JURUSITA/JURUSITA PENGGANTI";
const PHS = "Tambah Penetapan Sidang Pertama";
const judul = (aksi: string, tabel: string, halaman: string, kunci: string) =>
  `${aksi} table <b>${tabel}</b> dari halaman <b>${halaman}</b> dengan ${kunci}`;

/** Bentuk SIPP yang diharapkan, dibaca dari controller/model SIPP setempat. */
const HARAPAN = [
  { tablename: "perkara_penetapan", action: "INSERT", formname: PMH, title: judul("INSERT", "perkara_penetapan", PMH, "Primary Key [perkara_id=10187]") },
  ...[0, 1, 2].map(() => ({
    tablename: "perkara_hakim_pn",
    action: "INSERT",
    formname: PMH,
    title: judul("INSERT", "perkara_hakim_pn", ` Smart Majelis ${PMH}`, "Primary Key [perkara_id=10187]"),
  })),
  { tablename: "perkara", action: "UPDATE", formname: PMH, title: judul("UPDATE", "perkara", PMH, "Primary Key [perkara_id=10187]") },
  { tablename: "perkara_penetapan", action: "UPDATE", formname: PPP, title: judul("UPDATE", "perkara_penetapan", PPP, "Primary Key [perkara_id=10187]") },
  { tablename: "perkara_panitera_pn", action: "INSERT", formname: PPP, title: judul("INSERT", "perkara_panitera_pn", PPP, "Foreign Key [perkara_id=10187]") },
  { tablename: "perkara", action: "UPDATE", formname: PPP, title: judul("UPDATE", "perkara", PPP, "Primary Key [perkara_id=10187]") },
  { tablename: "perkara_penetapan", action: "UPDATE", formname: PJS, title: judul("UPDATE", "perkara_penetapan", PJS, "Primary Key [perkara_id=10187]") },
  { tablename: "perkara_jurusita", action: "INSERT", formname: PJS, title: judul("INSERT", "perkara_jurusita", PJS, "Foreign Key [perkara_id=10187]") },
  { tablename: "perkara", action: "UPDATE", formname: PJS, title: judul("UPDATE", "perkara", PJS, "Primary Key [perkara_id=10187]") },
  { tablename: "perkara_penetapan", action: "UPDATE", formname: PHS, title: judul("UPDATE", "perkara_penetapan", PHS, "Primary Key [perkara_id=10187]") },
  { tablename: "perkara_jadwal_sidang", action: "INSERT", formname: PHS, title: judul("INSERT", "perkara_jadwal_sidang", PHS, "Primary Key [id=20322]") },
  { tablename: "perkara_penetapan_hari_sidang", action: "INSERT", formname: PHS, title: judul("INSERT", "perkara_penetapan_hari_sidang", PHS, "Primary Key [id=23722]") },
  { tablename: "perkara", action: "UPDATE", formname: PHS, title: judul("UPDATE", "perkara", PHS, "Primary Key [perkara_id=10187]") },
  { tablename: "perkara", action: "UPDATE", formname: PHS, title: judul("UPDATE", "perkara", PHS, "Primary Key [perkara_id=10187]") },
];

/** Jam tiap langkah - maju sungguhan, seperti petugas yang berpindah borang. */
const JAM = {
  pmh: "2026-10-05 13:02:11",
  ppp: "2026-10-05 13:02:29",
  pjs: "2026-10-05 13:02:44",
  phs: "2026-10-05 13:03:07",
};

async function jalankanRantai(olehUsername = "Derry Briantono, S.H.", ip = "192.168.9.109") {
  const sipp = basisSipp();
  const layanan = muatLayanan(sipp.db);
  const dasar = {
    perkaraId: 10187,
    tanggalPenetapan: "2026-10-05",
    olehUsername,
    operator: "SUPER ADMIN DERRY",
    ip,
  };
  const minta: Record<string, Record<string, unknown>> = {
    pmh: { hakimId: [32, 26, 31] },
    ppp: { petugasId: 21 },
    pjs: { petugasId: 28 },
    // Butir 38: tanggal yang DIPILIH dari kalender, bukan usulan 21 Okt.
    phs: { tanggalSidang: "2026-10-15", ruanganId: 3 },
  };
  const hasil: Record<string, any> = {};
  for (const jenis of ["pmh", "ppp", "pjs", "phs"] as const) {
    sipp.keadaan.jam = JAM[jenis];
    const rencana = await layanan.susunRencanaTulis({ ...dasar, jenis, ...minta[jenis], kering: false });
    hasil[jenis] = rencana;
    if (!rencana.ok) break;
    const jalan = await layanan.jalankanRencana(rencana, { kering: false });
    hasil[`${jenis}Jalan`] = jalan;
    if (!jalan.ok) break;
    // Keadaan SIPP sesudah langkah itu tersimpan.
    if (jenis === "pmh") Object.assign(sipp.keadaan.perkara, { pmh: "2026-10-05", adaPenetapan: 10187, adaSmartMajelis: 10187 });
    if (jenis === "ppp") sipp.keadaan.perkara.ppp = "2026-10-05";
    if (jenis === "pjs") sipp.keadaan.perkara.pjs = "2026-10-05";
  }
  return { ...sipp, hasil, audit: barisAudit(sipp.tulisan) };
}

describe("butir 39 - baris audit SIPP untuk penetapan lewat ALETA", () => {
  let r: Awaited<ReturnType<typeof jalankanRantai>>;
  beforeEach(async () => {
    r = await jalankanRantai();
  });

  it("keempat langkah tertulis", () => {
    for (const j of ["pmh", "ppp", "pjs", "phs"]) {
      expect(r.hasil[j]?.ok, `${j}: ${r.hasil[j]?.alasan}`).toBe(true);
      expect(r.hasil[`${j}Jalan`]?.ok, `${j}: ${JSON.stringify(r.hasil[`${j}Jalan`])}`).toBe(true);
    }
  });

  it("16 baris audit, tabel/aksi/halaman/judul dan URUTANNYA persis tulisan SIPP", () => {
    expect(r.audit.map(({ tablename, action, formname, title }) => ({ tablename, action, formname, title }))).toEqual(HARAPAN);
  });

  it("username = akun SIPP petugas yang sedang masuk (derry briantono), tidak pernah pejabat", () => {
    expect(new Set(r.audit.map((x) => x.username))).toEqual(new Set(["derry briantono"]));
    const semua = JSON.stringify(r.tulisan);
    expect(semua).not.toContain('"fahri"');
    expect(semua).not.toContain("Sri Susilowati");
    // Kolom pengguna di tabel datanya pun sama - SIPP menulis session
    // username ke diinput_oleh/diperbaharui_oleh.
    const pengguna = r.tulisan.filter((t) => !/sys_audittrail/.test(t.sql)).flatMap((t) => t.params.filter((x) => x === "derry briantono"));
    expect(pengguna.length).toBeGreaterThan(10);
  });

  it("alamat IP = alamat peramban petugas", () => {
    expect(new Set(r.audit.map((x) => x.ipaddress))).toEqual(new Set(["192.168.9.109"]));
  });

  it("jam = jam basis data SAAT langkah ditulis - tidak disusun, tidak mundur", () => {
    const perLangkah = { pmh: r.audit.slice(0, 5), ppp: r.audit.slice(5, 8), pjs: r.audit.slice(8, 11), phs: r.audit.slice(11) };
    for (const [jenis, baris] of Object.entries(perLangkah)) {
      expect(new Set(baris.map((x) => x.datetime)), jenis).toEqual(new Set([JAM[jenis as keyof typeof JAM]]));
    }
    const jam = r.audit.map((x) => x.datetime);
    expect([...jam].sort()).toEqual(jam);
    // Jam yang dikarang dahulu jatuh di jendela 08:00-14:00 dan mundur dari
    // jam peladen; kini tidak satu pun sebelum jam langkahnya.
    expect(jam.every((x) => x >= JAM.pmh)).toBe(true);
  });

  it("tidak ada kata ALETA di baris audit mana pun", () => {
    for (const b of r.audit) expect(JSON.stringify(b)).not.toMatch(/aleta/i);
  });

  it("description = fetch_description SIPP: kolom dan urutannya", () => {
    const d = r.audit.map((x) => x.description);
    expect(kolomDeskripsi(d[0])).toEqual([
      "perkara_id", "jenis_acara", "penetapan_majelis_hakim", "majelis_hakim_id", "majelis_hakim_kode",
      "majelis_hakim_nama", "majelis_hakim_text", "diinput_oleh", "diinput_tanggal",
    ]);
    // majelis_hakim_nama TANPA gelar, teksnya bergelar - seperti perkara 10186.
    expect(nilaiDeskripsi(d[0], "majelis_hakim_nama")).toBe("Fahri Saifuddin</br>Himawan Tatura Wijaya</br>Derry Briantono");
    expect(kolomDeskripsi(d[1])).toEqual([
      "id", "perkara_id", "tahapan_id", "tanggal_penetapan", "nomor_sk_penetapan", "urutan", "jabatan_hakim_id",
      "jabatan_hakim_nama", "hakim_id", "hakim_kode", "hakim_nip", "hakim_nama", "aktif", "diinput_oleh",
      "diinput_tanggal", "keterangan",
    ]);
    expect([1, 2, 3].map((i) => nilaiDeskripsi(d[i], "id"))).toEqual(["29317", "29318", "29319"]);
    expect(kolomDeskripsi(d[4])).toEqual([
      "tahapan_terakhir_id", "tahapan_terakhir_text", "proses_terakhir_id", "proses_terakhir_text",
      "diperbaharui_oleh", "diperbaharui_tanggal",
    ]);
    expect(kolomDeskripsi(d[5])).toEqual(["penetapan_panitera_pengganti", "panitera_pengganti_id", "panitera_pengganti_text"]);
    expect(kolomDeskripsi(d[6])).toEqual([
      "id", "perkara_id", "tahapan_id", "tanggal_penetapan", "urutan", "panitera_id", "panitera_kode", "panitera_nip",
      "panitera_nama", "aktif", "diinput_oleh", "diinput_tanggal", "keterangan",
    ]);
    expect(nilaiDeskripsi(d[6], "id")).toBe("10576");
    expect(kolomDeskripsi(d[8])).toEqual(["penetapan_jurusita", "jurusita_id", "jurusita_text"]);
    expect(kolomDeskripsi(d[9])).toEqual([
      "id", "perkara_id", "tahapan_id", "tanggal_penetapan", "urutan", "jurusita_id", "jurusita_kode", "jurusita_nip",
      "jurusita_nama", "aktif", "diinput_oleh", "diinput_tanggal",
    ]);
    // jurusita_nama tanpa gelar (insert_penunjukan_juru_sita: ->nama).
    expect(nilaiDeskripsi(d[9], "jurusita_nama")).toBe("Tanty Restianty");
    expect(kolomDeskripsi(d[11])).toEqual(["penetapan_hari_sidang", "sidang_pertama", "diperbaharui_oleh", "diperbaharui_tanggal"]);
    expect(kolomDeskripsi(d[12])).toEqual([
      "perkara_id", "verzet", "keberatan", "tanggal_sidang", "jam_sidang", "ruangan", "ruangan_id", "agenda",
      "sidang_keliling", "ditunda", "id", "diinput_oleh", "diinput_tanggal", "urutan",
    ]);
    expect(nilaiDeskripsi(d[12], "jam_sidang")).toBe("09:00");
    expect(nilaiDeskripsi(d[12], "id")).toBe("20322");
    expect(kolomDeskripsi(d[13])).toEqual([
      "perkara_id", "tahapan_id", "tanggal_penetapan", "tanggal_sidang", "id", "jadwalsidang_id", "diinput_oleh",
      "diinput_tanggal", "keterangan",
    ]);
    expect(nilaiDeskripsi(d[13], "jadwalsidang_id")).toBe("20322");
    expect([d[14], d[15]].map((x) => nilaiDeskripsi(x, "proses_terakhir_id"))).toEqual(["80", "81"]);
  });

  it("butir 38 sampai ke basis data: tanggal sidang yang diminta (15 Okt) yang tertulis", () => {
    const jadwal = r.tulisan.find((t) => /^INSERT INTO perkara_jadwal_sidang/.test(t.sql))!;
    expect(jadwal.params).toContain("2026-10-15");
    expect(jadwal.params).not.toContain("2026-10-21");
    expect(nilaiDeskripsi(r.audit[11].description, "sidang_pertama")).toBe("2026-10-15");
  });

  it("riwayat dan jadwal ditulis dalam bentuk SIPP (keterangan '', agenda bawaan borang)", () => {
    const riwayat = r.tulisan.filter((t) => /^REPLACE INTO perkara_proses/.test(t.sql));
    expect(riwayat.map((t) => t.params[3])).toEqual([20, 30, 40, 80, 81]);
    expect(riwayat.every((t) => t.params[6] === "" && t.params[7] === "derry briantono")).toBe(true);
    const jadwal = r.tulisan.find((t) => /^INSERT INTO perkara_jadwal_sidang/.test(t.sql))!;
    expect(jadwal.sql).not.toMatch(/sampai_jam|sifat_sidang|ikrar_talak/);
    expect(jadwal.params).toContain("Sidang Pertama");
  });
});

describe("butir 39 - akun yang tercatat tidak pernah ditebak", () => {
  it("nama lengkap ganda dipersempit lewat sesi SIPP dari alamat yang sama", async () => {
    const r = await jalankanRantai("Tiffany RS", "192.168.9.82");
    expect(r.hasil.pmh.ok).toBe(true);
    expect(new Set(r.audit.map((x) => x.username))).toEqual(new Set(["meja1g"]));
  });

  it("nama lengkap ganda tanpa sesi yang cocok DITOLAK, tidak dipilihkan", async () => {
    const r = await jalankanRantai("Tiffany RS", "192.168.9.250");
    expect(r.hasil.pmh.ok).toBe(false);
    expect(r.hasil.pmh.alasan).toBe("akun_sipp_ganda");
    expect(r.tulisan).toHaveLength(0);
  });

  it("akun yang tidak ada DITOLAK", async () => {
    const r = await jalankanRantai("Orang Asing", "192.168.9.109");
    expect(r.hasil.pmh.alasan).toBe("akun_sipp_tidak_ketemu");
    expect(r.tulisan).toHaveLength(0);
  });
});

describe("butir 38 - tanggal sidang yang melanggar aturan DITOLAK di bot, tidak diganti", () => {
  it("hari Sabtu ditolak dengan sebabnya", async () => {
    const sipp = basisSipp();
    Object.assign(sipp.keadaan.perkara, { pmh: "2026-10-05", ppp: "2026-10-05", pjs: "2026-10-05", adaPenetapan: 10187 });
    const layanan = muatLayanan(sipp.db);
    const r = await layanan.susunRencanaTulis({
      jenis: "phs",
      perkaraId: 10187,
      tanggalPenetapan: "2026-10-05",
      tanggalSidang: "2026-10-17",
      olehUsername: "derry briantono",
      operator: "x",
      ip: "192.168.9.109",
    });
    expect(r.ok).toBe(false);
    expect(r.alasan).toBe("tanggal_sidang_hari_libur");
  });
});

// ---------------------------------------------------------------------------
// Ekstensi - fungsi dipotong dari konten.js dan dijalankan
// ---------------------------------------------------------------------------

const konten = readFileSync(path.join(AKAR, "ekstensi-sipp/konten.js"), "utf8").replace(/\r\n/g, "\n");

function potong(namaFungsi: string[], namaTetapan: string[]): string {
  const baris = konten.split("\n");
  const hasil: string[] = [];
  for (const n of namaTetapan) {
    const i = baris.findIndex((b) => new RegExp(`^const ${n}\\s*=`).test(b));
    if (i < 0) throw new Error(`tetapan tidak ditemukan: ${n}`);
    let j = i;
    if (!/;\s*$/.test(baris[i])) while (j < baris.length && !/^[\]}];\s*$/.test(baris[j])) j += 1;
    hasil.push(baris.slice(i, j + 1).join("\n"));
  }
  const ketemu = new Set<string>();
  for (let i = 0; i < baris.length; i += 1) {
    const m = baris[i].match(/^(?:async )?function ([A-Za-z_$][\w$]*)\(/);
    if (!m || !namaFungsi.includes(m[1])) continue;
    let j = i;
    while (j < baris.length && baris[j] !== "}") j += 1;
    hasil.push(baris.slice(i, j + 1).join("\n"));
    ketemu.add(m[1]);
  }
  const hilang = namaFungsi.filter((n) => !ketemu.has(n));
  if (hilang.length) throw new Error(`fungsi tidak ditemukan: ${hilang.join(", ")}`);
  return hasil.join("\n\n");
}

const FUNGSI = [
  "idUntukTulis",
  "nilaiUntukBorang",
  "pilihanDari",
  "susunanTerpilih",
  "tanggalSidangTerpilih",
  "masalahTanggalSidang",
  "hariAkhirPekan",
  "sebutTanggal",
  "kalimatAlasan",
  "rantaiPenetapan",
];
const TETAPAN = ["ALETA_API_TULIS", "URUTAN_TULIS", "KALIMAT_ALASAN", "NAMA_HARI"];

type Lingkungan = {
  namaSipp: string;
  kiriman: Array<Record<string, unknown>>;
  jeda: string[];
};

function muatEkstensi(ling: Lingkungan) {
  const buat = new Function(
    "lingkungan",
    `
    const namaPenggunaSipp = () => lingkungan.namaSipp;
    const lupakanStatusPerkara = () => {};
    const alatJedaManusia = async (jenis) => { lingkungan.jeda.push(jenis); return 1; };
    const alatAmbil = async (alamat, opsi) => {
      const badan = JSON.parse(opsi.body);
      lingkungan.kiriman.push(badan);
      return { json: async () => ({ ok: true, langkah: [], atasNama: { username: "x" } }) };
    };
    ${potong(FUNGSI, TETAPAN)}
    return { idUntukTulis, nilaiUntukBorang, masalahTanggalSidang, rantaiPenetapan };
  `
  );
  return buat(ling) as {
    idUntukTulis: (j: string, u: unknown, p?: unknown) => Record<string, unknown> | null;
    nilaiUntukBorang: (f: string, u: unknown, p?: unknown) => Record<string, unknown>;
    masalahTanggalSidang: (u: unknown, p?: unknown) => string;
    rantaiPenetapan: (u: unknown, d: unknown, kering: boolean) => Promise<Array<Record<string, any>>>;
  };
}

const USULAN = {
  tanggalPenetapan: "2026-10-05",
  perkara: { perkaraId: 10187, nomorPerkara: "630/Pdt.G/2026/PA.Dgl" },
  pmh: {
    bentuk: "majelis",
    anggota: [
      { hakimId: 32, nama: "Fahri" },
      { hakimId: 26, nama: "Himawan" },
      { hakimId: 31, nama: "Derry" },
    ],
    hitungan: [],
  },
  ppp: { usulan: { paniteraId: 21, nama: "Andini" }, calon: [] },
  pjs: { usulan: { jurusitaId: 28, nama: "Tanty" }, calon: [] },
  // Hari sidang majelis itu Rabu - 21 Okt usulan, 28 Okt mundur sepekan.
  phs: { usulan: "2026-10-21", calon: [{ tanggal: "2026-10-21" }, { tanggal: "2026-10-28" }] },
};
const RENCANA = {
  langkah: [
    { jenis: "pmh", akun: { username: "fahri" } },
    { jenis: "ppp", akun: { username: "Sri Susilowati" } },
    { jenis: "pjs", akun: { username: "Sri Susilowati" } },
    { jenis: "phs", akun: { username: "fahri" } },
  ],
};

describe("butir 38 - pilihan tangan selalu menang atas usulan (ekstensi)", () => {
  // Dimuat di dalam tiap uji, bukan saat berkas dikumpulkan: pada kode lama
  // fungsinya belum ada, dan yang harus merah ujinya - bukan seluruh berkas.
  let e: ReturnType<typeof muatEkstensi>;
  beforeEach(() => {
    e = muatEkstensi({ namaSipp: "", kiriman: [], jeda: [] });
  });
  const kalender = { phs: "2026-10-15", phsBebas: true, sidkel: true, ruangan: "3" };

  it("tanggal dari kalender (di luar daftar calon) yang dikirim ke mesin tulis", () => {
    expect(e.idUntukTulis("phs", USULAN, kalender)).toEqual({ tanggalSidang: "2026-10-15", ruanganId: 3 });
  });

  it("dan yang diisikan ke borang SIPP", () => {
    expect(e.nilaiUntukBorang("phs", USULAN, kalender).tanggal_sidang).toBe("2026-10-15");
  });

  it("tanpa pilihan, usulan yang dipakai - perilaku lama utuh", () => {
    expect(e.idUntukTulis("phs", USULAN, {})).toEqual({ tanggalSidang: "2026-10-21" });
  });

  it("tanggal yang melanggar aturan dikatakan sebabnya", () => {
    expect(e.masalahTanggalSidang(USULAN, { phs: "2026-10-17" })).toMatch(/Sabtu/);
    expect(e.masalahTanggalSidang(USULAN, { phs: "2026-10-04" })).toMatch(/mendahului/);
    expect(e.masalahTanggalSidang(USULAN, kalender)).toBe("");
  });
});

describe("rantai penetapan di ekstensi (butir 38 + 39)", () => {
  it("mengirim akun SIPP yang sedang masuk, tanggal pilihan, dan berjeda di antara langkah", async () => {
    const ling: Lingkungan = { namaSipp: "Derry Briantono, S.H.", kiriman: [], jeda: [] };
    const e = muatEkstensi(ling);
    const hasil = await e.rantaiPenetapan(
      USULAN,
      { pilihanManual: { phs: "2026-10-15", phsBebas: true }, pejabatDipilih: {}, rencana: RENCANA },
      false
    );
    expect(hasil.map((x) => x.ok)).toEqual([true, true, true, true]);
    expect(ling.kiriman.map((x) => x.olehUsername)).toEqual(Array(4).fill("Derry Briantono, S.H."));
    // Pejabat penanda tangan tetap diteruskan - untuk jejak ALETA saja.
    expect(ling.kiriman.map((x) => x.pejabatUsername)).toEqual(["fahri", "Sri Susilowati", "Sri Susilowati", "fahri"]);
    expect(ling.kiriman[3].tanggalSidang).toBe("2026-10-15");
    expect(ling.jeda).toEqual(["pindah", "pindah", "pindah"]);
  });

  it("uji kering tidak menunggu", async () => {
    const ling: Lingkungan = { namaSipp: "Derry Briantono, S.H.", kiriman: [], jeda: [] };
    await muatEkstensi(ling).rantaiPenetapan(USULAN, { pilihanManual: {}, rencana: RENCANA }, true);
    expect(ling.jeda).toEqual([]);
  });

  it("tanpa akun SIPP yang terbaca, tidak satu pun dikirim", async () => {
    const ling: Lingkungan = { namaSipp: "", kiriman: [], jeda: [] };
    const hasil = await muatEkstensi(ling).rantaiPenetapan(USULAN, { pilihanManual: {}, rencana: RENCANA }, false);
    expect(ling.kiriman).toHaveLength(0);
    expect(hasil[0].alasan).toBe("akun_sipp_belum_terbaca");
    expect(hasil[0].bunyi).toMatch(/Masuk ke SIPP/);
  });

  it("tanggal Sabtu pilihan tangan berhenti di PHS dengan sebabnya - tidak diganti usulan", async () => {
    const ling: Lingkungan = { namaSipp: "Derry Briantono, S.H.", kiriman: [], jeda: [] };
    const hasil = await muatEkstensi(ling).rantaiPenetapan(
      USULAN,
      { pilihanManual: { phs: "2026-10-17", phsBebas: true }, rencana: RENCANA },
      false
    );
    expect(ling.kiriman.map((x) => x.jenis)).toEqual(["pmh", "ppp", "pjs"]);
    const phs = hasil[hasil.length - 1];
    expect(phs.jenis).toBe("phs");
    expect(phs.ok).toBe(false);
    expect(phs.bunyi).toMatch(/Sabtu/);
  });
});

describe("jeda sungguhan di bot sebelum jam diambil", () => {
  it("rute /penetapan/tulis menunggu jedaManusia SEBELUM menyusun rencana, hanya bila tidak kering", () => {
    const rute = readFileSync(path.join(AKAR, "aleta_bot/routes/internalGatewayRoutes.js"), "utf8");
    const bagian = rute.slice(rute.indexOf('router.post("/penetapan/tulis"'), rute.indexOf('router.get("/sidang/keadaan"'));
    const posJeda = bagian.indexOf('if (!kering) await jedaManusiaService.jeda("simpan", { kering });');
    expect(posJeda).toBeGreaterThan(-1);
    expect(posJeda).toBeLessThan(bagian.indexOf("susunRencanaTulis({"));
  });
});
