// @vitest-environment node
/**
 * ============================================================================
 * BUTIR 17 (13 Okt 2026) - PENETAPAN TERCATAT ATAS AKUN SIPP PEJABATNYA
 * ============================================================================
 *
 * Perkara 660/Pdt.G/2026/PA.Dgl (perkara_id 10229): PMH/PPP/PJS/PHS lewat
 * panel tercatat "admin" di Riwayat Perkara karena petugasnya masuk SIPP
 * sebagai admin. Keputusan pengguna: "di riwayat dan sys_audittrail itu tetap
 * pejabatnya yang terinput namanya walaupun yang login akun apapun", dan jam
 * yang tercatat di SIPP "dibuat seperti manusia yang kerja".
 *
 * Mesin tulis bot dijalankan UTUH (tulisRantaiUtuh + susunRencanaHapus) di
 * atas SIPP tiruan yang merekam tiap pernyataan.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));

type Baris = Record<string, any>;
type Tulisan = { sql: string; params: unknown[] };

const PENGGUNA: Baris[] = [
  { userid: 1, username: "admin", fullname: "Super Administrator", block: 0, kedaluwarsa: null },
  { userid: 21, username: "meja1g", fullname: "Tiffany RS", block: 0, kedaluwarsa: null },
  { userid: 22, username: "meja1p", fullname: "Tiffany RS", block: 0, kedaluwarsa: null },
  { userid: 85, username: "fahri", fullname: "Fahri Saifuddin, S.H.I., M.H.", block: 0, kedaluwarsa: null },
  { userid: 86, username: "sudarmin", fullname: "Sudarmin H.I.M. Tang, S.H.I.,M.H", block: 0, kedaluwarsa: null },
  { userid: 81, username: "Sri Susilowati", fullname: "Sri Susilowati, S.H.", block: 0, kedaluwarsa: null },
  { userid: 90, username: "plhpanitera", fullname: "Plh Panitera, S.H.", block: 0, kedaluwarsa: null },
  { userid: 72, username: "Himawan", fullname: "Himawan Tatura Wijaya, S.H.I.,M.H.", block: 0, kedaluwarsa: null },
  { userid: 74, username: "Idris", fullname: "Idris, S.H.I., M.H.", block: 0, kedaluwarsa: null },
  { userid: 83, username: "derry briantono", fullname: "Derry Briantono, S.H.", block: 0, kedaluwarsa: null },
  { userid: 76, username: "Waka062024", fullname: "Akbar Ali, S.H.I.", block: 1, kedaluwarsa: null },
  { userid: 97, username: "kembar1", fullname: "Hakim Kembar", block: 0, kedaluwarsa: null },
  { userid: 98, username: "kembar2", fullname: "Hakim Kembar", block: 0, kedaluwarsa: null },
];
const USER_HAKIM: Array<[number, number]> = [
  [85, 32], [86, 33], [72, 26], [74, 28], [83, 31], [76, 29], [97, 50], [98, 50],
];
const USER_PANITERA: Array<[number, number]> = [[81, 26], [90, 40]];
const HAKIM: Record<number, Baris> = {
  26: { hakimId: 26, kode: "C1", nip: "1", nama: "Himawan Tatura Wijaya, S.H.I.,M.H.", namaPolos: "Himawan Tatura Wijaya" },
  28: { hakimId: 28, kode: "C2", nip: "2", nama: "Idris, S.H.I., M.H.", namaPolos: "Idris" },
  31: { hakimId: 31, kode: "C3", nip: "3", nama: "Derry Briantono, S.H.", namaPolos: "Derry Briantono" },
  50: { hakimId: 50, kode: "K", nip: "5", nama: "Hakim Kembar", namaPolos: "Hakim Kembar" },
};
const PROSES_JENIS: Record<number, string> = { 20: "pmh", 30: "ppp", 40: "pjs", 80: "phs" };

/** Jam: basis data WITA 10:56:26 = UTC 02:56:26 = jam SIPP (WIB) 09:56:26. */
const UTC = "2026-10-13 02:56:26";
const NOW_WITA = "2026-10-13 10:56:26";
const SEKARANG_SIPP = "2026-10-13 09:56:26";
const DAFTAR = "2026-10-13 08:16:25";

function basisSipp() {
  const keadaan = {
    utc: UTC,
    perkara: {
      perkaraId: 10229,
      nomorPerkara: "660/Pdt.G/2026/PA.Dgl",
      jenisPerkaraId: 347,
      tanggalDaftar: "2026-10-13",
      adaPenetapan: 0 as number,
      pmh: null as string | null,
      ppp: null as string | null,
      pjs: null as string | null,
      phs: null as string | null,
      pppId: null as string | null,
      pjsId: null as string | null,
      adaSmartMajelis: 0,
      didaftar: DAFTAR,
    } as Baris,
    majelis: [] as Array<{ hakimId: number; jabatanId: number }>,
    proses: { 10: { oleh: "kasir", waktu: DAFTAR } } as Record<number, { oleh: string; waktu: string }>,
    online: [
      { userid: 1, host: "192.168.9.103" },
      { userid: 21, host: "192.168.9.82" },
    ],
    idBerikutnya: {
      perkara_hakim_pn: 29400,
      perkara_panitera_pn: 10600,
      perkara_jurusita: 10400,
      perkara_jadwal_sidang: 20400,
      perkara_penetapan_hari_sidang: 23800,
    } as Record<string, number>,
  };
  const tulisan: Tulisan[] = [];

  const jawab = (sql: string, p: unknown[]): unknown => {
    if (/^\s*(START TRANSACTION|COMMIT|ROLLBACK)/i.test(sql)) return {};
    if (/UTC_TIMESTAMP/.test(sql)) return [{ utc: keadaan.utc }];
    if (/DATE_FORMAT\(NOW\(\)/.test(sql)) return [{ saat: NOW_WITA }];
    if (/AS lantai/.test(sql)) {
      const semua = Object.values(keadaan.proses).map((x) => x.waktu).sort();
      return [{ lantai: semua[semua.length - 1] }];
    }
    const max = /COALESCE\(MAX\(id\), 0\) \+ 1 AS berikutnya FROM (\w+)/.exec(sql);
    if (max) return [{ berikutnya: keadaan.idBerikutnya[max[1]] || 1 }];
    if (/COALESCE\(MAX\(urutan\), 0\) \+ 1/.test(sql)) return [{ berikutnya: 1 }];
    if (/FROM perkara p\b/.test(sql)) return [{ ...keadaan.perkara }];
    if (/FROM sys_user_online/.test(sql)) {
      const [nama, host] = p.map(String);
      return keadaan.online
        .filter((o) => o.host === host)
        .map((o) => PENGGUNA.find((u) => u.userid === o.userid)!)
        .filter((u) => u && u.fullname === nama);
    }
    if (/FROM user_hakim uh JOIN sys_users/.test(sql)) {
      return USER_HAKIM.filter(([, h]) => h === Number(p[0])).map(([u]) => PENGGUNA.find((x) => x.userid === u)!);
    }
    if (/FROM user_hakim WHERE userid/.test(sql)) {
      const u = Number(p[0]);
      return [
        ...USER_HAKIM.filter(([x]) => x === u).map(([, id]) => ({ jabatan: "hakim", id })),
        ...USER_PANITERA.filter(([x]) => x === u).map(([, id]) => ({ jabatan: "panitera", id })),
      ];
    }
    // Kolasi SIPP latin1_*_ci: tidak membedakan huruf besar-kecil.
    if (/FROM sys_users WHERE username = \?/.test(sql)) {
      return PENGGUNA.filter((u) => u.username.toLowerCase() === String(p[0]).toLowerCase());
    }
    if (/FROM sys_users WHERE TRIM\(fullname\) = \?/.test(sql)) return PENGGUNA.filter((u) => u.fullname === String(p[0]));
    if (/FROM perkara_hakim_pn\s+WHERE/.test(sql) && /^\s*SELECT/i.test(sql)) return keadaan.majelis.map((x) => ({ ...x }));
    if (/SELECT diinput_oleh AS oleh FROM perkara_proses/.test(sql)) {
      const r = keadaan.proses[Number(p[2])];
      return r ? [{ oleh: r.oleh }] : [];
    }
    if (/jadwalsidang_id AS id FROM perkara_penetapan_hari_sidang/.test(sql)) return [{ id: 20400 }];
    if (/FROM hakim_pn/.test(sql)) return p.map((x) => HAKIM[Number(x)]).filter(Boolean);
    if (/FROM panitera_pn/.test(sql)) return [{ id: 21, kode: "D", nip: "9", namaGelar: "Andini Puspita Sari, S.Sy.", nama: "Andini Puspita Sari" }];
    if (/FROM jurusita/.test(sql)) return [{ id: 28, kode: "", nip: "8", namaGelar: "Mustini, A.Md.", nama: "Mustini" }];
    if (/FROM ruangan_sidang/.test(sql)) return [{ id: 3, nama: "Ruang Sidang 1", keliling: "0" }];
    if (/FROM ref_majelis_tetap/.test(sql)) return [];
    if (/^\s*(INSERT|UPDATE|REPLACE|DELETE)/i.test(sql)) {
      const datar = sql.replace(/\s+/g, " ").trim();
      tulisan.push({ sql: datar, params: [...p] });
      const ke = /^\s*INSERT INTO (\w+)/i.exec(sql);
      if (ke && keadaan.idBerikutnya[ke[1]] !== undefined) keadaan.idBerikutnya[ke[1]] += 1;
      if (/^INSERT INTO perkara_hakim_pn/.test(datar)) keadaan.majelis.push({ hakimId: Number(p[8]), jabatanId: Number(p[6]) });
      if (/^DELETE FROM perkara_hakim_pn/.test(datar)) keadaan.majelis = [];
      if (/^REPLACE INTO perkara_proses/.test(datar)) {
        keadaan.proses[Number(p[3])] = { oleh: String(p[7]), waktu: String(p[8]) };
        const j = PROSES_JENIS[Number(p[3])];
        if (j) keadaan.perkara[j] = String(p[5]);
        keadaan.perkara.adaPenetapan = 10229;
      }
      if (/^DELETE FROM perkara_proses/.test(datar)) {
        delete keadaan.proses[Number(p[2])];
        const j = PROSES_JENIS[Number(p[2])];
        if (j) keadaan.perkara[j] = null;
      }
      return { affectedRows: 1, insertId: 0 };
    }
    return [];
  };

  const query = (sql: string, params: unknown, selesai: (g: unknown, h: unknown) => void) =>
    selesai(null, jawab(String(sql), Array.isArray(params) ? params : []));
  const db = { query };
  const sambungan = { query, release() {} };
  return { db, sambungan, keadaan, tulisan };
}

type Layanan = Record<string, any>;

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

/** Pembangkit acak berbenih - ujinya berulang sama, sebarannya tetap acak. */
function acakBerbenih(benih: number) {
  let x = Math.imul((benih ^ 0x9e3779b9) >>> 0, 2654435761) >>> 0 || 1;
  const maju = () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
  };
  for (let i = 0; i < 8; i += 1) maju();
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

const LANGKAH = [
  { jenis: "pmh", hakimId: [26, 28, 31], pejabatUsername: "fahri" },
  { jenis: "ppp", petugasId: 21, pejabatUsername: "Sri Susilowati" },
  { jenis: "pjs", petugasId: 28, pejabatUsername: "Sri Susilowati" },
  { jenis: "phs", tanggalSidang: "2026-10-26", ruanganId: 3, pejabatUsername: "Himawan" },
];

async function tulisRantai(
  olehUsername: string,
  ip: string,
  langkah: Array<Record<string, unknown>> = LANGKAH,
  benih = 7,
  ubah?: (k: ReturnType<typeof basisSipp>["keadaan"]) => void
) {
  const sipp = basisSipp();
  if (ubah) ubah(sipp.keadaan);
  const layanan = muatLayanan(sipp.db);
  const hasil = await layanan.tulisRantaiUtuh(
    { perkaraId: 10229, tanggalPenetapan: "2026-10-13", olehUsername, operator: "SUPER ADMIN DERRY", ip, langkah },
    { ambilSambungan: async () => sipp.sambungan, jeda: async () => 0, acak: acakBerbenih(benih) }
  );
  return { ...sipp, layanan, hasil };
}

function audit(tulisan: Tulisan[]) {
  return tulisan
    .filter((t) => /^INSERT INTO sys_audittrail/.test(t.sql))
    .map((t) => {
      const [datetime, ipaddress, username, tablename, formname] = t.params.map(String);
      return { datetime, ipaddress, username, tablename, formname };
    });
}

function riwayat(tulisan: Tulisan[]) {
  return tulisan
    .filter((t) => /^REPLACE INTO perkara_proses/.test(t.sql))
    .map((t) => ({ prosesId: Number(t.params[3]), oleh: String(t.params[7]), waktu: String(t.params[8]) }));
}

const FORMULIR: Record<string, string> = {
  pmh: "TAMBAH PENETAPAN HAKIM/MAJELIS HAKIM",
  ppp: "TAMBAH PENUNJUKAN PANITERA/PANITERA PENGGANTI",
  pjs: "TAMBAH PENUNJUKAN JURUSITA/JURUSITA PENGGANTI",
  phs: "Tambah Penetapan Sidang Pertama",
};
const PEJABAT: Record<string, string> = { pmh: "fahri", ppp: "Sri Susilowati", pjs: "Sri Susilowati", phs: "Himawan" };

describe("butir 17 - atas akun pejabat, apa pun akun yang masuk", () => {
  for (const [sebut, nama, ip, akunMasuk] of [
    ["admin", "Super Administrator", "192.168.9.103", "admin"],
    ["akun meja", "Tiffany RS", "192.168.9.82", "meja1g"],
    ["pejabat lain (hakim derry)", "Derry Briantono, S.H.", "192.168.9.109", "derry briantono"],
  ] as const) {
    it(`masuk sebagai ${sebut}: Riwayat Perkara, kolom penginput, dan sys_audittrail atas pejabat`, async () => {
      const r = await tulisRantai(nama, ip);
      expect(r.hasil.ok, JSON.stringify(r.hasil).slice(0, 400)).toBe(true);

      const a = audit(r.tulisan);
      expect(a.length).toBe(16);
      for (const [jenis, formulir] of Object.entries(FORMULIR)) {
        const baris = a.filter((x) => x.formname === formulir);
        expect(new Set(baris.map((x) => x.username)), jenis).toEqual(new Set([PEJABAT[jenis]]));
      }
      expect(riwayat(r.tulisan).map((x) => [x.prosesId, x.oleh])).toEqual([
        [20, "fahri"],
        [30, "Sri Susilowati"],
        [40, "Sri Susilowati"],
        [80, "Himawan"],
        [81, "Himawan"],
      ]);
      // Tidak satu pun nilai yang ditulis ke SIPP memuat akun yang masuk.
      for (const t of r.tulisan) expect(t.params, t.sql).not.toContain(akunMasuk);
      // Penekan sebenarnya hanya di rencana -> jejak ALETA.
      for (const satu of r.hasil.hasil) {
        expect(satu.rencana.akunMasuk.username).toBe(akunMasuk);
        expect(satu.rencana.atasNama.username).toBe(PEJABAT[satu.jenis]);
      }
    });
  }

  it("Plh terpilih: PMH atas Wakil (sudarmin), PPP/PJS atas Plh Panitera", async () => {
    const langkah = LANGKAH.map((x) =>
      x.jenis === "pmh" ? { ...x, pejabatUsername: "sudarmin" } : x.jenis === "phs" ? x : { ...x, pejabatUsername: "plhpanitera" }
    );
    const r = await tulisRantai("Super Administrator", "192.168.9.103", langkah);
    expect(r.hasil.ok).toBe(true);
    const a = audit(r.tulisan);
    expect(new Set(a.filter((x) => x.formname === FORMULIR.pmh).map((x) => x.username))).toEqual(new Set(["sudarmin"]));
    expect(new Set(a.filter((x) => x.formname === FORMULIR.ppp || x.formname === FORMULIR.pjs).map((x) => x.username))).toEqual(
      new Set(["plhpanitera"])
    );
  });

  it("PHS tanpa pilihan: ketua majelis yang tercatat (perkara_hakim_pn), dipetakan lewat user_hakim", async () => {
    const langkah = LANGKAH.map((x) => (x.jenis === "phs" ? { ...x, pejabatUsername: "" } : x));
    const r = await tulisRantai("Super Administrator", "192.168.9.103", langkah);
    expect(r.hasil.ok).toBe(true);
    expect(riwayat(r.tulisan).filter((x) => x.prosesId >= 80).map((x) => x.oleh)).toEqual(["Himawan", "Himawan"]);
  });

  it("PHS atas anggota majelis pilihan panel diterima", async () => {
    const langkah = LANGKAH.map((x) => (x.jenis === "phs" ? { ...x, pejabatUsername: "Idris" } : x));
    const r = await tulisRantai("Super Administrator", "192.168.9.103", langkah);
    expect(r.hasil.ok).toBe(true);
    expect(new Set(audit(r.tulisan).filter((x) => x.formname === FORMULIR.phs).map((x) => x.username))).toEqual(new Set(["Idris"]));
  });
});

describe("butir 17 - akun yang tidak pasti DITOLAK, tidak jatuh ke akun yang masuk", () => {
  const kasus: Array<[string, Array<Record<string, unknown>>, string]> = [
    ["pejabat tanpa akun SIPP", [{ ...LANGKAH[0], pejabatUsername: "ketua_baru" }], "akun_pejabat_tidak_ketemu"],
    ["pejabat belum dipilih", [{ ...LANGKAH[0], pejabatUsername: "" }], "pejabat_belum_dipilih"],
    ["akun admin bukan pejabat", [{ ...LANGKAH[0], pejabatUsername: "admin" }], "akun_bukan_pejabat"],
    ["akun pejabat diblokir", [{ ...LANGKAH[0], pejabatUsername: "Waka062024" }], "akun_pejabat_diblokir"],
    ["huruf besar-kecil berbeda tidak dianggap pasti", [{ ...LANGKAH[0], pejabatUsername: "Fahri" }], "akun_pejabat_tidak_ketemu"],
    [
      "PHS atas hakim di luar majelis",
      [LANGKAH[0], { ...LANGKAH[3], pejabatUsername: "sudarmin" }],
      "pejabat_phs_bukan_majelis",
    ],
  ];
  for (const [sebut, langkah, alasan] of kasus) {
    it(`${sebut} -> ${alasan}, nol baris tertulis (rollback)`, async () => {
      const r = await tulisRantai("Super Administrator", "192.168.9.103", langkah);
      expect(r.hasil.ok).toBe(false);
      expect(r.hasil.alasan).toBe(alasan);
      expect(r.hasil.dipulihkan).toBe(true);
      expect(r.tulisan.filter((t) => /admin/.test(JSON.stringify(t.params)))).toHaveLength(0);
    });
  }

  it("ketua majelis dengan dua akun hidup -> akun_ketua_majelis_ganda", async () => {
    const r = await tulisRantai(
      "Super Administrator",
      "192.168.9.103",
      [{ ...LANGKAH[0], hakimId: [50, 28, 31] }, { ...LANGKAH[3], pejabatUsername: "" }]
    );
    expect(r.hasil.alasan).toBe("akun_ketua_majelis_ganda");
    expect(r.hasil.dipulihkan).toBe(true);
  });

  it("akun yang masuk tetap harus pasti - nama lengkap ganda tanpa sesi ditolak seperti sebelumnya", async () => {
    const r = await tulisRantai("Tiffany RS", "192.168.9.250");
    expect(r.hasil.alasan).toBe("akun_sipp_ganda");
  });
});

describe("butir 17 - jam SIPP seperti orang bekerja", () => {
  const detik = (t: string) => Date.parse(`${t.replace(" ", "T")}Z`) / 1000;

  it("jam tiap langkah berbeda, urut, <= jam SIPP sekarang (WIB), >= pendaftaran; riwayat = audit per langkah", async () => {
    const r = await tulisRantai("Super Administrator", "192.168.9.103");
    const rw = riwayat(r.tulisan);
    const jam: Record<string, string> = {};
    for (const x of rw) jam[PROSES_JENIS[x.prosesId] || "phs81"] = x.waktu;
    const urut = [jam.pmh, jam.ppp, jam.pjs, jam.phs];
    expect(new Set(urut).size).toBe(4);
    expect([...urut].sort()).toEqual(urut);
    expect(urut.every((x) => x <= SEKARANG_SIPP && x > DAFTAR)).toBe(true);
    // Bukan NOW() basis data (WITA, satu jam di depan jam SIPP).
    expect(urut.every((x) => x < NOW_WITA)).toBe(true);
    expect(jam.phs81).toBe(jam.phs);
    const a = audit(r.tulisan);
    for (const [jenis, formulir] of Object.entries(FORMULIR)) {
      expect(new Set(a.filter((x) => x.formname === formulir).map((x) => x.datetime)), jenis).toEqual(new Set([jam[jenis]]));
    }
  });

  it("200 rangkaian acak: jeda dalam sebaran terukur, tidak berpola tetap, batas selalu terjaga", () => {
    const { jamRangkaianManusia } = muatLayanan(basisSipp().db);
    const jedaPpp = new Set<number>();
    for (let i = 0; i < 200; i += 1) {
      const h = jamRangkaianManusia({
        urutan: ["pmh", "ppp", "pjs", "phs"],
        sekarang: "2026-10-13 13:40:00",
        lantai: "2026-10-13 08:16:25",
        acak: acakBerbenih(1000 + i),
      });
      const t = ["pmh", "ppp", "pjs", "phs"].map((j) => detik(h.jam[j]));
      expect(t[3]).toBeLessThanOrEqual(detik("2026-10-13 13:40:00"));
      expect(t[0]).toBeGreaterThan(detik("2026-10-13 08:16:25"));
      const [d1, d2, d3] = [t[1] - t[0], t[2] - t[1], t[3] - t[2]];
      expect(d1).toBeGreaterThanOrEqual(90);
      expect(d1).toBeLessThanOrEqual(1800);
      expect(d2).toBeGreaterThanOrEqual(5);
      expect(d2).toBeLessThanOrEqual(45);
      expect(d3).toBeGreaterThanOrEqual(40);
      expect(d3).toBeLessThanOrEqual(900);
      jedaPpp.add(d1);
    }
    // Tidak berpola tetap: jeda PMH->PPP beragam.
    expect(jedaPpp.size).toBeGreaterThan(100);
  });

  it("ruang sempit (baru didaftarkan 3 menit lalu): dirapatkan, tetap urut dan di antara kedua batas", () => {
    const { jamRangkaianManusia } = muatLayanan(basisSipp().db);
    for (let i = 0; i < 50; i += 1) {
      const h = jamRangkaianManusia({
        urutan: ["pmh", "ppp", "pjs", "phs"],
        sekarang: "2026-10-13 10:00:00",
        lantai: "2026-10-13 09:57:00",
        acak: acakBerbenih(i + 1),
      });
      const t = ["pmh", "ppp", "pjs", "phs"].map((j) => detik(h.jam[j]));
      expect(t[0]).toBeGreaterThan(detik("2026-10-13 09:57:00"));
      expect(t[3]).toBeLessThanOrEqual(detik("2026-10-13 10:00:00"));
      expect(t[0] < t[1] && t[1] < t[2] && t[2] < t[3]).toBe(true);
    }
  });

  it("kejadian sebelumnya tercatat DI DEPAN jam SIPP: tidak pernah menulis masa depan", () => {
    const { jamRangkaianManusia } = muatLayanan(basisSipp().db);
    const h = jamRangkaianManusia({
      urutan: ["pmh", "ppp"],
      sekarang: "2026-10-13 09:56:26",
      lantai: "2026-10-13 10:46:14",
      acak: acakBerbenih(3),
    });
    expect(h.jam.ppp).toBe("2026-10-13 09:56:26");
    expect(h.jam.pmh < h.jam.ppp).toBe(true);
    expect(h.catatan).toContain("kejadian_sebelumnya_di_depan_jam_sipp");
  });

  it("ditekan sesudah jam kerja: rangkaiannya berakhir sebelum 16.30 bila lantainya memberi ruang", () => {
    const { jamRangkaianManusia } = muatLayanan(basisSipp().db);
    const h = jamRangkaianManusia({
      urutan: ["pmh", "ppp", "pjs", "phs"],
      sekarang: "2026-10-13 18:20:00",
      lantai: "2026-10-13 08:10:00",
      acak: acakBerbenih(9),
    });
    expect(h.jam.phs <= "2026-10-13 16:30:00").toBe(true);
    expect(h.jam.pmh >= "2026-10-13 07:00:00").toBe(true);
  });

  it("jam SIPP = UTC basis data dalam zona Asia/Jakarta", async () => {
    const sipp = basisSipp();
    const layanan = muatLayanan(sipp.db);
    expect(await layanan.waktuSipp()).toBe(SEKARANG_SIPP);
  });
});

describe("butir 17 - pembatalan atas akun pejabat yang sama", () => {
  async function bongkarSemua(akunMasuk: string, ubah?: (k: Baris) => void) {
    const r = await tulisRantai("Super Administrator", "192.168.9.103");
    expect(r.hasil.ok).toBe(true);
    if (ubah) ubah(r.keadaan);
    const sebelum = r.tulisan.length;
    const jadwal = await r.layanan.jadwalJamSipp(10229, r.layanan.URUTAN_BONGKAR, { saring: "ada", acak: acakBerbenih(5) });
    const hasil: Baris[] = [];
    for (const jenis of r.layanan.URUTAN_BONGKAR) {
      const rencana = await r.layanan.susunRencanaHapus({
        jenis,
        perkaraId: 10229,
        olehUsername: { pmh: "fahri", ppp: "Sri Susilowati", pjs: "Sri Susilowati", phs: "Himawan" }[jenis as string],
        akunSippMasuk: akunMasuk,
        operator: "SUPER ADMIN DERRY",
        ip: "192.168.9.82",
        kering: false,
        saatSipp: jadwal.jam[jenis],
      });
      hasil.push(rencana);
      if (!rencana.ok) break;
      const jalan = await r.layanan.jalankanRencana(rencana, { kering: false });
      expect(jalan.ok).toBe(true);
    }
    return { r, hasil, tulisanBongkar: r.tulisan.slice(sebelum), jadwal };
  }

  it("masuk sebagai meja1g: tiap pembatalan atas akun yang tercatat pada penetapannya", async () => {
    const { hasil, tulisanBongkar } = await bongkarSemua("Tiffany RS");
    expect(hasil.every((x) => x.ok)).toBe(true);
    const a = audit(tulisanBongkar);
    for (const [jenis, formulir] of Object.entries(FORMULIR)) {
      expect(new Set(a.filter((x) => x.formname === formulir).map((x) => x.username)), jenis).toEqual(new Set([PEJABAT[jenis]]));
    }
    for (const t of tulisanBongkar) expect(t.params).not.toContain("meja1g");
    expect(hasil.map((x) => x.akunMasuk.username)).toEqual(["meja1g", "meja1g", "meja1g", "meja1g"]);
  });

  it("jam pembatalan: PHS -> PMH berurutan, berbeda, <= jam SIPP sekarang", async () => {
    const { hasil } = await bongkarSemua("Tiffany RS");
    const jam = hasil.map((x) => x.saat);
    expect(new Set(jam).size).toBe(4);
    expect([...jam].sort()).toEqual(jam);
    expect(jam.every((x) => x <= SEKARANG_SIPP)).toBe(true);
  });

  it("penetapan lama yang tercatat 'admin' (660/Pdt.G/2026): dibatalkan atas pejabat pilihan panel", async () => {
    const { hasil, tulisanBongkar } = await bongkarSemua("Super Administrator", (k) => {
      for (const id of [20, 30, 40, 80, 81]) if (k.proses[id]) k.proses[id].oleh = "admin";
    });
    expect(hasil.every((x) => x.ok)).toBe(true);
    expect(hasil.map((x) => x.atasNama.sumber)).toEqual(["pilihan", "pilihan", "pilihan", "pilihan"]);
    expect(new Set(audit(tulisanBongkar).map((x) => x.username))).toEqual(new Set(["Himawan", "Sri Susilowati", "fahri"]));
    for (const t of tulisanBongkar) expect(t.params).not.toContain("admin");
  });

  it("tercatat bukan pejabat DAN pilihan panel tidak sah -> ditolak", async () => {
    const r = await tulisRantai("Super Administrator", "192.168.9.103");
    r.keadaan.proses[80].oleh = "admin";
    r.keadaan.proses[81].oleh = "admin";
    const rencana = await r.layanan.susunRencanaHapus({
      jenis: "phs",
      perkaraId: 10229,
      olehUsername: "sudarmin",
      akunSippMasuk: "Super Administrator",
      operator: "x",
      ip: "192.168.9.103",
      kering: false,
    });
    expect(rencana.ok).toBe(false);
    expect(rencana.alasan).toBe("pejabat_phs_bukan_majelis");
  });

  it("membongkar sungguhan tanpa akun SIPP yang masuk tetap ditolak (penjagaan lama utuh)", async () => {
    const r = await tulisRantai("Super Administrator", "192.168.9.103");
    const rencana = await r.layanan.susunRencanaHapus({
      jenis: "phs",
      perkaraId: 10229,
      olehUsername: "Himawan",
      akunSippMasuk: "",
      operator: "x",
      kering: false,
    });
    expect(rencana.alasan).toBe("akun_sipp_belum_terbaca");
  });
});

describe("butir 17 - jejak ALETA memuat penekan sebenarnya", () => {
  it("akun_sipp = pejabat, akun_sipp_masuk = penekan, jam_sipp = jam yang dicatat di SIPP", async () => {
    const tangkap: Array<{ sql: string; params: unknown[] }> = [];
    const jalurDb = require_.resolve(path.join(AKAR, "aleta_bot/bot_db_config.js"));
    require_.cache[jalurDb] = {
      id: jalurDb,
      filename: jalurDb,
      loaded: true,
      exports: {
        query(sql: string, params: unknown, selesai: (g: unknown, h: unknown) => void) {
          tangkap.push({ sql: String(sql), params: Array.isArray(params) ? params : [] });
          selesai(null, /SHOW COLUMNS/.test(String(sql)) ? [{ Field: "x" }] : { affectedRows: 1 });
        },
      },
    } as unknown as NodeJS.Module;
    const jalur = require_.resolve(path.join(AKAR, "aleta_bot/services/jejakAletaService.js"));
    delete require_.cache[jalur];
    const jejak = require_(jalur) as { catat: (j: Record<string, unknown>) => Promise<boolean> };
    const ok = await jejak.catat({
      aksi: "tulis",
      jenis: "pmh",
      perkaraId: 10229,
      nomorPerkara: "660/Pdt.G/2026/PA.Dgl",
      tanggalPenetapan: "2026-10-13",
      akunSipp: "fahri",
      namaPejabat: "Fahri Saifuddin, S.H.I., M.H.",
      akunSippMasuk: "admin",
      jamSipp: "2026-10-13 09:31:12",
      operator: "SUPER ADMIN DERRY",
      ip: "192.168.9.103",
      berhasil: true,
      kering: false,
      langkah: [],
    });
    expect(ok).toBe(true);
    const sisip = tangkap.find((x) => /INSERT INTO aleta_bot_jejak_penetapan/.test(x.sql))!;
    expect(sisip.sql.replace(/\s+/g, " ")).toMatch(/akun_sipp, nama_pejabat, akun_sipp_masuk, jam_sipp, operator/);
    expect(sisip.params.slice(6, 11)).toEqual([
      "fahri",
      "Fahri Saifuddin, S.H.I., M.H.",
      "admin",
      "2026-10-13 09:31:12",
      "SUPER ADMIN DERRY",
    ]);
    // waktu = jam SEBENARNYA penekanan, bukan jam SIPP.
    expect(sisip.params[0]).not.toBe("2026-10-13 09:31:12");
  });
});
