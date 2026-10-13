// @vitest-environment node
/**
 * ============================================================================
 * PENETAPAN KEMBALI - BENTUK TULISAN SIPP (6 Okt 2026)
 * ============================================================================
 *
 * Dijalankan, bukan dibaca. penetapanKembaliService dimuat utuh di atas basis
 * data SIPP tiruan yang MEREKAM tiap pernyataan, lalu keempat penetapan
 * kembali sungguhan di satker DIULANG dengan masukan yang sama:
 *
 *   PMH  perkara 9988, 2 Sep 2026 10:59:00, fahri, audit 499092-499097,
 *        majelis 32,26,31 -> 33,26,31, keterangan "Ketua Majelis cuti"
 *   PPP  perkara 9992, 7 Sep 2026 07:54:38, Sri Susilowati, 499826-499829,
 *        Andini (21), keterangan "mutasi"
 *   PJS  perkara 9262, 6 Jan 2026 08:46:10, Sri Susilowati, 453406-453409,
 *        Tanty (28)
 *   PHS  perkara 9729, 16 Jul 2026 09:52:31, fahri, 489382-489385, jadwal
 *        19615, phs 23475, "Mediasi Tidak Berhasil"
 *
 * Baris audit yang dihasilkan harus SAMA PERSIS - tabel, aksi, nama halaman,
 * judul, dan description (fetch_description) kata demi kata - dengan baris
 * yang ditulis SIPP sendiri hari itu, dibaca dari sys_audittrail sipp_donggala.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));

type Baris = Record<string, unknown>;
type Tulisan = { sql: string; params: unknown[] };

const PENGGUNA = [
  { userid: 11, username: "derry briantono", fullname: "Derry Briantono, S.H.", block: 0 },
  { userid: 12, username: "fahri", fullname: "Fahri Saifuddin, S.H.I., M.H.", block: 0 },
  { userid: 13, username: "Sri Susilowati", fullname: "Sri Susilowati, S.H.", block: 0 },
];

const HAKIM: Record<number, Baris> = {
  33: { hakimId: 33, kode: "B", nip: "197910092007041001", nama: "Sudarmin H.I.M. Tang, S.H.I.,M.H", namaPolos: "Sudarmin H.I.M. Tang" },
  26: { hakimId: 26, kode: "C1", nip: "197806052005021002", nama: "Himawan Tatura Wijaya, S.H.I.,M.H.", namaPolos: "Himawan Tatura Wijaya" },
  31: { hakimId: 31, kode: "C3", nip: "199401022017121003", nama: "Derry Briantono, S.H.", namaPolos: "Derry Briantono" },
  32: { hakimId: 32, kode: "A", nip: "198208312007041001", nama: "Fahri Saifuddin, S.H.I., M.H.", namaPolos: "Fahri Saifuddin" },
};

type Perkara = {
  perkaraId: number;
  nomorPerkara: string;
  jenisPerkaraId: number;
  alurPerkaraId: number;
  tanggalDaftar: string;
  adaPenetapan: number;
  pmh: string | null;
  majelisHakimId: string;
  ppp: string | null;
  pppId: string;
  pjs: string | null;
  pjsId: string;
  phs: string | null;
  sidangPertama: string | null;
  adaSmartMajelis: number | null;
};

function basisSipp(perkara: Perkara, opsi: { jam: string; id: Record<string, number>; riwayat: Record<number, string>; jadwalTerakhir?: number; urutanJadwal?: number }) {
  const tulisan: Tulisan[] = [];
  const id = { ...opsi.id };
  const jawab = (sql: string, p: unknown[]): unknown => {
    const max = /COALESCE\(MAX\(id\), 0\) \+ 1 AS berikutnya FROM (\w+)/.exec(sql);
    if (max) return [{ berikutnya: id[max[1]] || 1 }];
    if (/DATE_FORMAT\(NOW\(\)/.test(sql)) return [{ saat: opsi.jam }];
    // 13 Okt 2026: jam yang DITULIS = jam SIPP (WIB) = UTC + 7 jam. UTC-nya
    // dijawab sedemikian rupa sehingga jam SIPP = jam baris SIPP yang ditiru.
    if (/UTC_TIMESTAMP/.test(sql)) {
      const d = new Date(Date.parse(`${opsi.jam.replace(" ", "T")}Z`) - 7 * 3600 * 1000);
      return [{ utc: d.toISOString().slice(0, 19).replace("T", " ") }];
    }
    if (/FROM perkara p\b/.test(sql)) return [{ ...perkara }];
    if (/FROM sys_users WHERE username = \?/.test(sql)) return PENGGUNA.filter((u) => u.username === String(p[0]));
    if (/FROM sys_users WHERE TRIM\(fullname\) = \?/.test(sql)) return PENGGUNA.filter((u) => u.fullname === String(p[0]));
    if (/FROM hakim_pn WHERE id IN/.test(sql)) return p.map((x) => HAKIM[Number(x)]).filter(Boolean);
    if (/FROM panitera_pn WHERE id = \?/.test(sql)) return [{ id: Number(p[0]), kode: "D", nip: "198906242011012009", namaGelar: "Andini Puspita Sari, S.Sy.", nama: "Andini Puspita Sari" }];
    if (/FROM jurusita WHERE id = \?/.test(sql)) return [{ id: Number(p[0]), kode: "", nip: "198409012006042002", namaGelar: "Tanty Restianty", nama: "Tanty Restianty" }];
    if (/FROM ruangan_sidang WHERE id = \?/.test(sql)) return [{ id: 1, nama: "Ruang Sidang 1 Dalam Gedung", keliling: "0" }];
    if (/COUNT\(\*\) AS jumlah FROM perkara_penetapan_hari_sidang/.test(sql)) return [{ jumlah: 0 }];
    if (/MAX\(id\) AS id, COALESCE\(MAX\(urutan\), 0\) \+ 1 AS urutan FROM perkara_jadwal_sidang/.test(sql)) {
      return [{ id: opsi.jadwalTerakhir ?? null, urutan: opsi.urutanJadwal ?? 1 }];
    }
    if (/FROM proses_alur_perkara/.test(sql)) return [];
    if (/SELECT tanggal FROM perkara_proses/.test(sql)) {
      const t = opsi.riwayat[Number(p[1])];
      return t ? [{ tanggal: t }] : [];
    }
    if (/FROM perkara_proses WHERE perkara_id = \?\s+ORDER BY tahapan_id DESC/.test(sql)) {
      return [{ tahapanId: 14, tahapanText: "Persidangan", prosesId: 200, prosesText: "Persidangan" }];
    }
    if (/^\s*(INSERT|UPDATE|REPLACE|DELETE)/i.test(sql)) {
      tulisan.push({ sql: sql.replace(/\s+/g, " ").trim(), params: [...p] });
      const ke = /^\s*INSERT INTO (\w+)/i.exec(sql);
      if (ke && id[ke[1]] !== undefined) id[ke[1]] += 1;
      return { affectedRows: 1, insertId: 0 };
    }
    return [];
  };
  const db = {
    query(sql: string, params: unknown, selesai: (g: unknown, h: unknown) => void) {
      selesai(null, jawab(String(sql), Array.isArray(params) ? params : []));
    },
  };
  return { db, tulisan };
}

type Layanan = {
  susunRencanaKembali: (m: Record<string, unknown>) => Promise<Record<string, any>>;
  alasanBersih: (x: unknown) => { ok: boolean; teks?: string; alasan?: string };
};
type Tulis = { jalankanRencana: (r: unknown, o?: Record<string, unknown>) => Promise<Record<string, any>> };

function muat(db: unknown): { kembali: Layanan; tulis: Tulis } {
  const pasang = (berkas: string, exports: unknown) => {
    const jalur = require_.resolve(path.join(AKAR, "aleta_bot", berkas));
    require_.cache[jalur] = { id: jalur, filename: jalur, loaded: true, exports } as unknown as NodeJS.Module;
  };
  pasang("db_config.js", db);
  const jalurSkema = require_.resolve(path.join(AKAR, "aleta_bot/services/sippSkemaService.js"));
  delete require_.cache[jalurSkema];
  const skema = require_(jalurSkema) as Record<string, unknown>;
  pasang("services/sippSkemaService.js", { ...skema, tabelAda: async () => true });
  for (const b of ["services/penetapanTulisService.js", "services/penetapanKembaliService.js"]) {
    delete require_.cache[require_.resolve(path.join(AKAR, "aleta_bot", b))];
  }
  const tulis = require_(path.join(AKAR, "aleta_bot/services/penetapanTulisService.js")) as Tulis;
  const kembali = require_(path.join(AKAR, "aleta_bot/services/penetapanKembaliService.js")) as Layanan;
  return { kembali, tulis };
}

function barisAudit(tulisan: Tulisan[]) {
  return tulisan
    .filter((t) => /^INSERT INTO sys_audittrail/.test(t.sql))
    .map((t) => {
      const [datetime, ipaddress, username, tablename, formname, action, title, description] = t.params.map(String);
      return { datetime, ipaddress, username, tablename, formname, action, title, description };
    });
}

/** fetch_description SIPP - dipakai menyusun ulang description baris audit SUNGGUHAN. */
function deskripsi(kolom: Array<[string, string]>) {
  return (
    '<br><table style="vertical-align:top" cellspacing="0" cellpadding="1" border="1"><tr><th>Nama Kolom</th><th>Nilai</th></tr>' +
    kolom.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("") +
    "</table>"
  );
}

const TAHAPAN = (oleh: string, saat: string): Array<[string, string]> => [
  ["tahapan_terakhir_id", "14"],
  ["tahapan_terakhir_text", "Persidangan"],
  ["proses_terakhir_id", "200"],
  ["proses_terakhir_text", "Persidangan"],
  ["diperbaharui_oleh", oleh],
  ["diperbaharui_tanggal", saat],
];

const dasarPerkara = (x: Partial<Perkara>): Perkara => ({
  perkaraId: 0,
  nomorPerkara: "",
  jenisPerkaraId: 347,
  alurPerkaraId: 15,
  tanggalDaftar: "2026-01-01",
  adaPenetapan: 1,
  pmh: "2026-01-02",
  majelisHakimId: "32,26,31",
  ppp: "2026-01-02",
  pppId: "12",
  pjs: "2026-01-02",
  pjsId: "22",
  phs: "2026-01-02",
  sidangPertama: "2026-01-15",
  adaSmartMajelis: 1,
  ...x,
});

async function jalankan(perkara: Perkara, opsi: Parameters<typeof basisSipp>[1], minta: Record<string, unknown>, kering = false) {
  const sipp = basisSipp(perkara, opsi);
  const { kembali, tulis } = muat(sipp.db);
  const rencana = await kembali.susunRencanaKembali({ perkaraId: perkara.perkaraId, operator: "SUPER ADMIN DERRY", ip: "192.168.9.31", ...minta });
  const jalan = rencana.ok ? await tulis.jalankanRencana(rencana, kering ? {} : { kering: false }) : null;
  return { rencana, jalan, tulisan: sipp.tulisan, audit: barisAudit(sipp.tulisan) };
}

// ---------------------------------------------------------------------------
// PMH - perkara 9988
// ---------------------------------------------------------------------------
describe("PMH kembali = TAMBAH PENETAPAN KEMBALI HAKIM/MAJELIS HAKIM (perkara 9988, audit 499092-499097)", () => {
  const saat = "2026-09-02 10:59:00";
  let r: Awaited<ReturnType<typeof jalankan>>;
  beforeAll(async () => {
  r = await jalankan(
    dasarPerkara({ perkaraId: 9988, nomorPerkara: "470/Pdt.G/2026/PA.Dgl", pmh: "2026-07-30", adaSmartMajelis: 9988 }),
    { jam: saat, id: { perkara_hakim_pn: 28993 }, riwayat: {} },
    { jenis: "pmh", tanggalPenetapan: "2026-09-02", hakimId: [33, 26, 31], alasan: "Ketua Majelis cuti", olehUsername: "fahri" }
  );
  });
  const H = "TAMBAH PENETAPAN KEMBALI HAKIM/MAJELIS HAKIM";

  it("tertulis", () => {
    expect(r.rencana.ok, r.rencana.alasan).toBe(true);
    expect(r.jalan?.ok, JSON.stringify(r.jalan)).toBe(true);
  });

  it("enam baris audit, persis tulisan SIPP kata demi kata", () => {
    const hakim = (id: string, urutan: string, jabId: string, jab: string, hid: string, kode: string, nip: string, nama: string) =>
      deskripsi([
        ["id", id],
        ["perkara_id", "9988"],
        ["tanggal_penetapan", "2026-09-02"],
        ["urutan", urutan],
        ["jabatan_hakim_id", jabId],
        ["jabatan_hakim_nama", jab],
        ["hakim_id", hid],
        ["hakim_kode", kode],
        ["hakim_nip", nip],
        ["hakim_nama", nama],
        ["aktif", "Y"],
        ["diinput_oleh", "fahri"],
        ["diinput_tanggal", saat],
        ["keterangan", "Ketua Majelis cuti"],
      ]);
    const judul = (aksi: string, tabel: string, kunci: string) => `${aksi} table <b>${tabel}</b> dari halaman <b>${H}</b> dengan ${kunci} [perkara_id=9988]`;
    expect(r.audit.map(({ tablename, action, formname, title, description, username, datetime }) => ({ tablename, action, formname, title, description, username, datetime }))).toEqual([
      {
        tablename: "perkara_penetapan",
        action: "UPDATE",
        formname: H,
        title: judul("UPDATE", "perkara_penetapan", "Primary Key"),
        description: deskripsi([
          ["jenis_acara", ""],
          ["penetapan_majelis_hakim", "2026-09-02"],
          ["majelis_hakim_id", "33,26,31"],
          ["majelis_hakim_kode", "B|C1|C3"],
          ["majelis_hakim_nama", "Sudarmin H.I.M. Tang, S.H.I.,M.H</br>Himawan Tatura Wijaya, S.H.I.,M.H.</br>Derry Briantono, S.H."],
          [
            "majelis_hakim_text",
            "Hakim Ketua: Sudarmin H.I.M. Tang, S.H.I.,M.H</br>Hakim Anggota 1: Himawan Tatura Wijaya, S.H.I.,M.H.</br>Hakim Anggota 2: Derry Briantono, S.H.",
          ],
        ]),
        username: "fahri",
        datetime: saat,
      },
      {
        tablename: "perkara_hakim_pn",
        action: "UPDATE",
        formname: H,
        title: judul("UPDATE", "perkara_hakim_pn", "Foreign Key"),
        description: deskripsi([
          ["aktif", "T"],
          ["tanggal_tidak_aktif", "2026-09-02"],
          ["diperbaharui_oleh", "fahri"],
          ["diperbaharui_tanggal", saat],
        ]),
        username: "fahri",
        datetime: saat,
      },
      ...[
        hakim("28993", "1", "1", "Hakim Ketua", "33", "B", "197910092007041001", "Sudarmin H.I.M. Tang"),
        hakim("28994", "2", "2", "Hakim Anggota", "26", "C1", "197806052005021002", "Himawan Tatura Wijaya"),
        hakim("28995", "3", "2", "Hakim Anggota", "31", "C3", "199401022017121003", "Derry Briantono"),
      ].map((description) => ({
        tablename: "perkara_hakim_pn",
        action: "INSERT",
        formname: H,
        title: judul("INSERT", "perkara_hakim_pn", "Foreign Key"),
        description,
        username: "fahri",
        datetime: saat,
      })),
      {
        tablename: "perkara",
        action: "UPDATE",
        formname: H,
        title: judul("UPDATE", "perkara", "Primary Key"),
        description: deskripsi(TAHAPAN("fahri", saat)),
        username: "fahri",
        datetime: saat,
      },
    ]);
  });

  it("data: jenis_acara '0', baris lama dinonaktifkan tanpa saringan tahapan, baris baru tanpa tahapan_id", () => {
    const pen = r.tulisan.find((t) => /^UPDATE perkara_penetapan/.test(t.sql))!;
    expect(pen.params[0]).toBe("0");
    expect(pen.sql).not.toMatch(/diperbaharui_/);
    const non = r.tulisan.find((t) => /^UPDATE perkara_hakim_pn/.test(t.sql))!;
    expect(non.sql).toMatch(/WHERE perkara_id = \? AND aktif = \?$/);
    expect(non.params).toEqual(["T", "2026-09-02", "fahri", saat, 9988, "Y"]);
    const baru = r.tulisan.filter((t) => /^INSERT INTO perkara_hakim_pn/.test(t.sql));
    expect(baru).toHaveLength(3);
    expect(baru.every((t) => !/tahapan_id|nomor_sk_penetapan/.test(t.sql))).toBe(true);
    expect(baru.map((t) => t.params[0])).toEqual([28993, 28994, 28995]);
  });

  it("riwayat proses 21 disisipkan (belum ada), tanpa audit; Smart Majelis status 3 tanpa tanggal, PALING AKHIR, tanpa audit", () => {
    const riwayat = r.tulisan.filter((t) => /perkara_proses/.test(t.sql));
    expect(riwayat).toHaveLength(1);
    expect(riwayat[0].sql).toMatch(/^INSERT INTO perkara_proses/);
    expect(riwayat[0].params.slice(0, 8)).toEqual([9988, 12, "Penetapan", 21, "Penetapan Kembali Majelis Hakim/Hakim", "2026-09-02", "", "fahri"]);
    const sm = r.tulisan[r.tulisan.length - 1];
    expect(sm.sql).toBe("UPDATE perkara_smartmajelis SET hakim_id2 = ?, status = ?, keterangan = ? WHERE perkara_id = ?");
    expect(sm.params).toEqual(["33,26,31", "3", "Ketua Majelis cuti", 9988]);
    expect(r.audit.some((a) => /smartmajelis|perkara_proses/.test(a.tablename))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PPP - perkara 9992 ; PJS - perkara 9262
// ---------------------------------------------------------------------------
describe("PPP kembali = PENUNJUKAN KEMBALI PANITERA/PANITERA PENGGANTI (perkara 9992, audit 499826-499829)", () => {
  const saat = "2026-09-07 07:54:38";
  const H = "PENUNJUKAN KEMBALI PANITERA/PANITERA PENGGANTI";
  let r: Awaited<ReturnType<typeof jalankan>>;
  beforeAll(async () => {
  r = await jalankan(
    dasarPerkara({ perkaraId: 9992, ppp: "2026-08-03", pppId: "26" }),
    { jam: saat, id: { perkara_panitera_pn: 10469 }, riwayat: {} },
    { jenis: "ppp", tanggalPenetapan: "2026-09-07", petugasId: 21, alasan: "mutasi", olehUsername: "Sri Susilowati" }
  );
  });
  const judul = (aksi: string, tabel: string, kunci: string) => `${aksi} table <b>${tabel}</b> dari halaman <b>${H}</b> dengan ${kunci} [perkara_id=9992]`;

  it("empat baris audit persis SIPP", () => {
    expect(r.rencana.ok, r.rencana.alasan).toBe(true);
    expect(r.audit.map(({ tablename, action, formname, title, description }) => ({ tablename, action, formname, title, description }))).toEqual([
      {
        tablename: "perkara_penetapan",
        action: "UPDATE",
        formname: H,
        title: judul("UPDATE", "perkara_penetapan", "Primary Key"),
        description: deskripsi([
          ["penetapan_panitera_pengganti", "2026-09-07"],
          ["panitera_pengganti_id", "21"],
          ["panitera_pengganti_text", "Panitera Pengganti: Andini Puspita Sari, S.Sy."],
        ]),
      },
      {
        tablename: "perkara_panitera_pn",
        action: "UPDATE",
        formname: H,
        title: judul("UPDATE", "perkara_panitera_pn", "Foreign Key"),
        description: deskripsi([
          ["aktif", "T"],
          ["tanggal_tidak_aktif", "2026-09-07"],
          ["diperbaharui_oleh", "Sri Susilowati"],
          ["diperbaharui_tanggal", saat],
        ]),
      },
      {
        tablename: "perkara_panitera_pn",
        action: "INSERT",
        formname: H,
        title: judul("INSERT", "perkara_panitera_pn", "Foreign Key"),
        description: deskripsi([
          ["id", "10469"],
          ["perkara_id", "9992"],
          ["tanggal_penetapan", "2026-09-07"],
          ["urutan", "1"],
          ["panitera_id", "21"],
          ["panitera_kode", "D"],
          ["panitera_nip", "198906242011012009"],
          ["panitera_nama", "Andini Puspita Sari, S.Sy."],
          ["aktif", "Y"],
          ["diinput_oleh", "Sri Susilowati"],
          ["diinput_tanggal", saat],
          ["keterangan", "mutasi"],
        ]),
      },
      { tablename: "perkara", action: "UPDATE", formname: H, title: judul("UPDATE", "perkara", "Primary Key"), description: deskripsi(TAHAPAN("Sri Susilowati", saat)) },
    ]);
    expect(r.tulisan.filter((t) => /perkara_proses/.test(t.sql)).map((t) => t.params[3])).toEqual([31]);
  });
});

describe("PJS kembali = PENUNJUKAN KEMBALI JURUSITA/JURUSITA PENGGANTI (perkara 9262, audit 453406-453409)", () => {
  const saat = "2026-01-06 08:46:10";
  const H = "PENUNJUKAN KEMBALI JURUSITA/JURUSITA PENGGANTI";
  let r: Awaited<ReturnType<typeof jalankan>>;
  beforeAll(async () => {
  r = await jalankan(
    dasarPerkara({ perkaraId: 9262, pjs: "2025-12-29", pjsId: "30" }),
    { jam: saat, id: { perkara_jurusita: 9473 }, riwayat: {} },
    { jenis: "pjs", tanggalPenetapan: "2026-01-06", petugasId: 28, alasan: "Cuti Tahunan", olehUsername: "Sri Susilowati" }
  );
  });
  const judul = (aksi: string, tabel: string, kunci: string) => `${aksi} table <b>${tabel}</b> dari halaman <b>${H}</b> dengan ${kunci} [perkara_id=9262]`;

  it("empat baris audit persis SIPP - teks 'Jurusita: ', tanpa kolom keterangan", () => {
    expect(r.rencana.ok, r.rencana.alasan).toBe(true);
    expect(r.audit.map(({ tablename, action, title, description }) => ({ tablename, action, title, description }))).toEqual([
      {
        tablename: "perkara_penetapan",
        action: "UPDATE",
        title: judul("UPDATE", "perkara_penetapan", "Primary Key"),
        description: deskripsi([
          ["penetapan_jurusita", "2026-01-06"],
          ["jurusita_id", "28"],
          ["jurusita_text", "Jurusita: Tanty Restianty"],
        ]),
      },
      {
        tablename: "perkara_jurusita",
        action: "UPDATE",
        title: judul("UPDATE", "perkara_jurusita", "Foreign Key"),
        description: deskripsi([
          ["aktif", "T"],
          ["tanggal_tidak_aktif", "2026-01-06"],
          ["diperbaharui_oleh", "Sri Susilowati"],
          ["diperbaharui_tanggal", saat],
        ]),
      },
      {
        tablename: "perkara_jurusita",
        action: "INSERT",
        title: judul("INSERT", "perkara_jurusita", "Foreign Key"),
        description: deskripsi([
          ["id", "9473"],
          ["perkara_id", "9262"],
          ["tanggal_penetapan", "2026-01-06"],
          ["urutan", "1"],
          ["jurusita_id", "28"],
          ["jurusita_kode", ""],
          ["jurusita_nip", "198409012006042002"],
          ["jurusita_nama", "Tanty Restianty"],
          ["aktif", "Y"],
          ["diinput_oleh", "Sri Susilowati"],
          ["diinput_tanggal", saat],
        ]),
      },
      { tablename: "perkara", action: "UPDATE", title: judul("UPDATE", "perkara", "Primary Key"), description: deskripsi(TAHAPAN("Sri Susilowati", saat)) },
    ]);
  });

  it("alasan PJS tidak masuk SIPP (borang membuangnya) tetapi ada di rencana untuk jejak ALETA", () => {
    expect(JSON.stringify(r.tulisan)).not.toContain("Cuti Tahunan");
    expect(r.rencana.langkah[0].keterangan).toContain("Cuti Tahunan");
    expect(r.rencana.catatan.join(" ")).toMatch(/tidak disimpan SIPP/);
  });
});

// ---------------------------------------------------------------------------
// PHS - perkara 9729
// ---------------------------------------------------------------------------
describe("PHS kembali = Tambah Penetapan Kembali Sidang Pertama (perkara 9729, audit 489382-489385)", () => {
  const saat = "2026-07-16 09:52:31";
  const H = "Tambah Penetapan Kembali Sidang Pertama";
  let r: Awaited<ReturnType<typeof jalankan>>;
  beforeAll(async () => {
  r = await jalankan(
    dasarPerkara({ perkaraId: 9729, ppp: "2026-04-27", pjs: "2026-04-27", phs: "2026-04-27", sidangPertama: "2026-05-13" }),
    {
      jam: saat,
      id: { perkara_jadwal_sidang: 19615, perkara_penetapan_hari_sidang: 23475 },
      riwayat: { 80: "2026-04-27", 81: "2026-05-13" },
      jadwalTerakhir: 19179,
      urutanJadwal: 3,
    },
    {
      jenis: "phs",
      tanggalPenetapan: "2026-07-16",
      tanggalSidang: "2026-07-29",
      jamSidang: "09:00",
      ruanganId: 1,
      alasan: "Mediasi Tidak Berhasil",
      olehUsername: "fahri",
    }
  );
  });

  it("empat baris audit persis SIPP: jadwal, penetapan hari sidang, perkara x2", () => {
    expect(r.rencana.ok, r.rencana.alasan).toBe(true);
    expect(r.jalan?.ok, JSON.stringify(r.jalan)).toBe(true);
    expect(r.audit.map(({ tablename, action, formname, title, description }) => ({ tablename, action, formname, title, description }))).toEqual([
      {
        tablename: "perkara_jadwal_sidang",
        action: "INSERT",
        formname: H,
        title: `INSERT table <b>perkara_jadwal_sidang</b> dari halaman <b>${H}</b> dengan Primary Key [id=19615]`,
        description: deskripsi([
          ["perkara_id", "9729"],
          ["verzet", "T"],
          ["keberatan", "T"],
          ["tanggal_sidang", "2026-07-29"],
          ["jam_sidang", "09:00"],
          ["ruangan", "Ruang Sidang 1 Dalam Gedung"],
          ["ruangan_id", "1"],
          ["agenda", "Penetapan Kembali Hari Sidang"],
          ["sidang_keliling", "T"],
          ["ditunda", "T"],
          ["id", "19615"],
          ["diinput_oleh", "fahri"],
          ["diinput_tanggal", saat],
          ["urutan", "3"],
        ]),
      },
      {
        tablename: "perkara_penetapan_hari_sidang",
        action: "INSERT",
        formname: H,
        title: `INSERT table <b>perkara_penetapan_hari_sidang</b> dari halaman <b>${H}</b> dengan Primary Key [id=23475]`,
        description: deskripsi([
          ["perkara_id", "9729"],
          ["tahapan_id", "12"],
          ["tanggal_penetapan", "2026-07-16"],
          ["tanggal_sidang", "2026-07-29"],
          ["id", "23475"],
          ["jadwalsidang_id", "19615"],
          ["diinput_oleh", "fahri"],
          ["diinput_tanggal", saat],
          ["keterangan", "Penetapan Kembali Hari Sidang Dengan Alasan Mediasi Tidak Berhasil"],
        ]),
      },
      ...[0, 1].map(() => ({
        tablename: "perkara",
        action: "UPDATE",
        formname: H,
        title: `UPDATE table <b>perkara</b> dari halaman <b>${H}</b> dengan Primary Key [perkara_id=9729]`,
        description: deskripsi(TAHAPAN("fahri", saat)),
      })),
    ]);
  });

  it("jadwal terakhir ditandai ditunda TANPA audit; perkara_penetapan TIDAK disentuh; riwayat 80/81 DIPERBARUI", () => {
    expect(r.tulisan[0].sql).toBe("UPDATE perkara_jadwal_sidang SET ditunda = ?, diperbaharui_oleh = ?, diperbaharui_tanggal = ? WHERE id = ?");
    expect(r.tulisan[0].params).toEqual(["Y", "fahri", saat, 19179]);
    expect(r.tulisan.some((t) => /perkara_penetapan SET|UPDATE perkara_penetapan /.test(t.sql))).toBe(false);
    const riwayat = r.tulisan.filter((t) => /perkara_proses/.test(t.sql));
    expect(riwayat.map((t) => [t.sql.split(" ")[0], t.params[0]])).toEqual([
      ["UPDATE", "2026-07-16"],
      ["UPDATE", "2026-07-29"],
    ]);
    const hs = r.tulisan.find((t) => /^INSERT INTO perkara_penetapan_hari_sidang/.test(t.sql))!;
    expect(hs.params).toContain(19615);
  });
});

// ---------------------------------------------------------------------------
// Penjaga
// ---------------------------------------------------------------------------
describe("penjaga penetapan kembali", () => {
  const saat = "2026-10-06 10:00:00";
  const p = () => dasarPerkara({ perkaraId: 10200, pmh: "2026-10-01", ppp: "2026-10-01", pppId: "21", pjs: "2026-10-01", pjsId: "28", phs: "2026-10-01" });
  const coba = (minta: Record<string, unknown>, perkara = p(), kering = false) =>
    jalankan(perkara, { jam: saat, id: { perkara_hakim_pn: 1, perkara_panitera_pn: 1, perkara_jurusita: 1 }, riwayat: {} }, { tanggalPenetapan: "2026-10-06", alasan: "Cuti Tahunan", olehUsername: "Derry Briantono, S.H.", ...minta }, kering);

  it("KERING bawaan: jalankanRencana tanpa {kering:false} tidak menulis apa pun", async () => {
    const r = await coba({ jenis: "ppp", petugasId: 12 }, p(), true);
    expect(r.rencana.ok).toBe(true);
    expect(r.jalan?.kering).toBe(true);
    expect(r.tulisan).toHaveLength(0);
  });

  it("akun = petugas yang masuk (nama lengkap -> username), bukan pejabat", async () => {
    const r = await coba({ jenis: "pmh", hakimId: [33, 26, 31] });
    expect(new Set(r.audit.map((a) => a.username))).toEqual(new Set(["derry briantono"]));
    expect(JSON.stringify(r.tulisan)).not.toMatch(/aleta/i);
  });

  it("penetapan pertama harus ada", async () => {
    const r = await coba({ jenis: "pjs", petugasId: 30 }, dasarPerkara({ perkaraId: 10200, pjs: null }));
    expect(r.rencana.alasan).toBe("pjs_belum_ada");
    expect(r.tulisan).toHaveLength(0);
  });

  it("tanggal kembali tidak boleh mendahului penetapan sebelumnya, Sabtu/Minggu, atau masa depan", async () => {
    expect((await coba({ jenis: "ppp", petugasId: 12, tanggalPenetapan: "2026-09-30" })).rencana.alasan).toBe("tanggal_kembali_sebelum_penetapan_sebelumnya");
    expect((await coba({ jenis: "ppp", petugasId: 12, tanggalPenetapan: "2026-10-04" })).rencana.alasan).toBe("tanggal_penetapan_hari_libur");
    expect((await coba({ jenis: "ppp", petugasId: 12, tanggalPenetapan: "2026-10-07" })).rencana.alasan).toBe("tanggal_penetapan_masa_depan");
  });

  it("orang/susunan yang sama ditolak", async () => {
    expect((await coba({ jenis: "pjs", petugasId: 28 })).rencana.alasan).toBe("petugas_sama_dengan_sebelumnya");
    expect((await coba({ jenis: "pmh", hakimId: [32, 26, 31] })).rencana.alasan).toBe("susunan_sama_dengan_sebelumnya");
    expect((await coba({ jenis: "pmh", hakimId: [33, 26] })).rencana.alasan).toBe("susunan_hakim_tidak_sah");
  });

  it("alasan wajib dan tidak boleh menyebut ALETA (tertulis di SIPP)", async () => {
    expect((await coba({ jenis: "ppp", petugasId: 12, alasan: "  " })).rencana.alasan).toBe("alasan_kosong");
    expect((await coba({ jenis: "ppp", petugasId: 12, alasan: "diisi lewat Aleta" })).rencana.alasan).toBe("alasan_menyebut_aleta");
  });

  it("hakim tunggal = jabatan 3 'Hakim Tunggal'", async () => {
    const r = await coba({ jenis: "pmh", hakimId: [33] });
    expect(r.rencana.ok).toBe(true);
    const ins = r.tulisan.find((t) => /^INSERT INTO perkara_hakim_pn/.test(t.sql))!;
    expect(ins.params).toContain("Hakim Tunggal");
    expect(r.audit[0].description).toContain("Hakim Tunggal: Sudarmin H.I.M. Tang, S.H.I.,M.H");
  });
});
