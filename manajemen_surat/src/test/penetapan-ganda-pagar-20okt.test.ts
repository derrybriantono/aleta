// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Pagar penetapan ganda di bot (20 Okt 2026, agen P1): tulisRantaiUtuh
 * dijalankan DUA KALI bersamaan atas perkara yang sama pada SIPP tiruan yang
 * meniru kunci baris InnoDB (SELECT ... FOR UPDATE menunggu pemegangnya
 * COMMIT/ROLLBACK, lalu membaca keadaan terbaru). Dengan kunci baris: tepat
 * satu yang menulis, yang lain melewati. Tanpa kunci baris (tiruan dimatikan):
 * keduanya menulis - bukti bahwa ujinya peka terhadap kunci itu.
 *
 * Juga: keadaan separuh (baris pejabat ada, tanggal kosong) tidak ditulis di
 * atasnya, dan satu definisi "ada" dipakai penulis dan penanda.
 */
const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));

type Baris = Record<string, unknown>;
type Tulisan = { sql: string; params: unknown[] };
type Keadaan = { pmh: string | null; ppp: string | null; pjs: string | null; phs: string | null; adaPenetapan: number; adaSmartMajelis: number; nPmh?: number; nPpp?: number; nPjs?: number; nPhs?: number };

const PENGGUNA = [
  { userid: 11, username: "derry briantono", fullname: "Derry Briantono, S.H.", block: 0 },
  // Butir 17 (13 Okt 2026): akun pejabat yang dicatat SIPP.
  { userid: 85, username: "fahri", fullname: "Fahri Saifuddin, S.H.I., M.H.", block: 0 },
  { userid: 81, username: "Sri Susilowati", fullname: "Sri Susilowati, S.H.", block: 0 },
  { userid: 72, username: "Himawan", fullname: "Himawan Tatura Wijaya, S.H.I.,M.H.", block: 0 },
];
const TAUT: Record<number, Array<{ jabatan: string; id: number }>> = {
  85: [{ jabatan: "hakim", id: 32 }],
  81: [{ jabatan: "panitera", id: 26 }],
  72: [{ jabatan: "hakim", id: 26 }],
  11: [{ jabatan: "hakim", id: 31 }],
};
const HAKIM: Record<number, Baris> = {
  32: { hakimId: 32, kode: "A", nip: "198208312007041001", nama: "Fahri Saifuddin, S.H.I., M.H.", namaPolos: "Fahri Saifuddin" },
  26: { hakimId: 26, kode: "C1", nip: "197806052005021002", nama: "Himawan Tatura Wijaya, S.H.I.,M.H.", namaPolos: "Himawan Tatura Wijaya" },
  31: { hakimId: 31, kode: "C3", nip: "199401022017121003", nama: "Derry Briantono, S.H.", namaPolos: "Derry Briantono" },
};

function sippBertransaksi(awal: Partial<Keadaan> = {}, kunciBarisAktif = true) {
  const tetap: Keadaan = { pmh: null, ppp: null, pjs: null, phs: null, adaPenetapan: 0, adaSmartMajelis: 0, ...awal };
  const terkomit: Tulisan[] = [];
  const perintah: string[] = [];
  const kunci = { gagalPada: "" as string }; // pola SQL yang dibuat gagal
  const kunciBaris = { aktif: kunciBarisAktif, pemegang: false, antre: [] as Array<() => void> };
  const idBerikutnya: Record<string, number> = {
    perkara_hakim_pn: 29317,
    perkara_panitera_pn: 10576,
    perkara_jurusita: 10359,
    perkara_jadwal_sidang: 20322,
    perkara_penetapan_hari_sidang: 23722,
  };

  const jawab = (keadaan: Keadaan, tulisan: Tulisan[], sql: string, p: unknown[]): unknown => {
    const max = /COALESCE\(MAX\(id\), 0\) \+ 1 AS berikutnya FROM (\w+)/.exec(sql);
    if (max) return [{ berikutnya: idBerikutnya[max[1]] || 1 }];
    if (/COALESCE\(MAX\(urutan\), 0\) \+ 1/.test(sql)) return [{ berikutnya: 1 }];
    if (/DATE_FORMAT\(NOW\(\)/.test(sql)) return [{ saat: "2026-10-09 09:02:11" }];
    if (/UTC_TIMESTAMP/.test(sql)) return [{ utc: "2026-10-09 01:02:11" }];
    if (/AS lantai/.test(sql)) return [{ lantai: "2026-10-09 07:40:00" }];
    if (/FROM user_hakim WHERE userid/.test(sql)) return TAUT[Number(p[0])] || [];
    if (/FROM user_hakim uh JOIN sys_users/.test(sql)) {
      return PENGGUNA.filter((u) => (TAUT[u.userid] || []).some((t) => t.jabatan === "hakim" && t.id === Number(p[0])));
    }
    // Majelis tercatat: ketua 26 (Himawan) sesudah PMH tertulis.
    if (/FROM perkara_hakim_pn\s+WHERE/.test(sql)) {
      return keadaan.pmh ? [{ hakimId: 26, jabatanId: 1 }, { hakimId: 32, jabatanId: 2 }, { hakimId: 31, jabatanId: 2 }] : [];
    }
    if (/FROM perkara p\b/.test(sql)) {
      return [{ perkaraId: 10222, nomorPerkara: "653/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 347, tanggalDaftar: "2026-10-09", didaftar: "2026-10-09 08:40:00", ...keadaan }];
    }
    if (/FROM sys_user_online/.test(sql)) return [];
    if (/FROM sys_users WHERE username = \?/.test(sql)) return PENGGUNA.filter((u) => u.username === String(p[0]));
    if (/FROM sys_users WHERE TRIM\(fullname\) = \?/.test(sql)) return PENGGUNA.filter((u) => u.fullname === String(p[0]));
    if (/FROM hakim_pn/.test(sql)) return p.map((x) => HAKIM[Number(x)]).filter(Boolean);
    if (/FROM panitera_pn/.test(sql)) return [{ id: 21, kode: "D", nip: "198906242011012009", namaGelar: "Andini Puspita Sari, S.Sy.", nama: "Andini Puspita Sari" }];
    if (/FROM jurusita/.test(sql)) return [{ id: 28, kode: "", nip: "198409012006042002", namaGelar: "Tanty Restianty, A.Md.", nama: "Tanty Restianty" }];
    if (/FROM ruangan_sidang/.test(sql)) return [{ id: 3, nama: "Ruang Sidang Utama", keliling: "0" }];
    if (/FROM ref_majelis_tetap/.test(sql)) return [{ majelisId: 35, kompetensiId: 22, skId: 3, hakim: "26,32,31" }];
    if (/^\s*(INSERT|UPDATE|REPLACE|DELETE)/i.test(sql)) {
      if (kunci.gagalPada && new RegExp(kunci.gagalPada).test(sql)) {
        const g = new Error("Lock wait timeout exceeded; try restarting transaction") as Error & { code: string };
        g.code = "ER_LOCK_WAIT_TIMEOUT";
        throw g;
      }
      tulisan.push({ sql: sql.replace(/\s+/g, " ").trim(), params: [...p] });
      const ke = /^\s*INSERT INTO (\w+)/i.exec(sql);
      if (ke && idBerikutnya[ke[1]] !== undefined) idBerikutnya[ke[1]] += 1;
      // Keadaan perkara_penetapan menurut tulisan (dilihat sambungan ini saja
      // sampai COMMIT).
      if (/^\s*INSERT INTO perkara_penetapan\b/i.test(sql)) Object.assign(keadaan, { pmh: "2026-10-09", adaPenetapan: 10222, adaSmartMajelis: 10222, nPmh: 3 });
      if (/^\s*UPDATE perkara_penetapan\b/i.test(sql) && /penetapan_panitera_pengganti\s*=/.test(sql)) keadaan.ppp = "2026-10-09";
      if (/^\s*UPDATE perkara_penetapan\b/i.test(sql) && /penetapan_jurusita\s*=/.test(sql)) keadaan.pjs = "2026-10-09";
      if (/^\s*UPDATE perkara_penetapan\b/i.test(sql) && /penetapan_hari_sidang\s*=/.test(sql)) keadaan.phs = "2026-10-09";
      return { affectedRows: 1, insertId: 0 };
    }
    return [];
  };

  const db = {
    // Kolam: hanya yang sudah di-COMMIT.
    query(sql: string, params: unknown, selesai: (g: unknown, h: unknown) => void) {
      try {
        selesai(null, jawab({ ...tetap }, [], String(sql), Array.isArray(params) ? params : []));
      } catch (g) {
        selesai(g, null);
      }
    },
    getConnection(selesai: (g: unknown, s: unknown) => void) {
      let lokal: Keadaan = { ...tetap };
      let tertunda: Tulisan[] = [];
      let dalamTransaksi = false;
      let memegang = false;
      const lepasKunciBaris = () => {
        if (memegang) {
          memegang = false;
          kunciBaris.pemegang = false;
          const berikut = kunciBaris.antre.shift();
          if (berikut) berikut();
        }
      };
      const sambungan = {
        dilepas: false,
        query(sql: string, params: unknown, cb: (g: unknown, h: unknown) => void) {
          void (async () => {
            const s = String(sql).trim();
            if (/^START TRANSACTION$/i.test(s)) {
              perintah.push("START");
              dalamTransaksi = true;
              lokal = { ...tetap };
              tertunda = [];
              return cb(null, {});
            }
            if (/FROM perkara WHERE perkara_id = \? FOR UPDATE/i.test(s)) {
              perintah.push("FOR UPDATE");
              if (kunciBaris.aktif) {
                if (kunciBaris.pemegang) await new Promise<void>((lanjut) => kunciBaris.antre.push(lanjut));
                kunciBaris.pemegang = true;
                memegang = true;
                // InnoDB: pembacaan terkunci melihat keadaan TERKINI yang sudah di-COMMIT.
                lokal = { ...tetap };
              }
              return cb(null, [{ perkara_id: 10222 }]);
            }
            if (/^COMMIT$/i.test(s)) {
              perintah.push("COMMIT");
              Object.assign(tetap, lokal);
              terkomit.push(...tertunda);
              tertunda = [];
              dalamTransaksi = false;
              lepasKunciBaris();
              return cb(null, {});
            }
            if (/^ROLLBACK$/i.test(s)) {
              perintah.push("ROLLBACK");
              tertunda = [];
              lokal = { ...tetap };
              dalamTransaksi = false;
              lepasKunciBaris();
              return cb(null, {});
            }
            try {
              // Jeda kecil: memberi kesempatan sambungan lain menyela bila tidak ada kunci baris.
              await new Promise((r) => setTimeout(r, 1));
              const hasil = jawab(lokal, tertunda, String(sql), Array.isArray(params) ? params : []);
              if (!dalamTransaksi) {
                terkomit.push(...tertunda);
                tertunda = [];
                Object.assign(tetap, lokal);
              }
              cb(null, hasil);
            } catch (g) {
              cb(g, null);
            }
          })();
        },
        release() {
          lepasKunciBaris();
          sambungan.dilepas = true;
          perintah.push("RELEASE");
        },
      };
      selesai(null, sambungan);
    },
  };
  return { db, tetap, terkomit, perintah, kunci };
}

type Layanan = {
  tulisRantaiUtuh: (m: Record<string, unknown>, alat?: Record<string, unknown>) => Promise<Record<string, any>>;
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
  for (const b of ["penetapanKeadaanService.js", "penetapanTulisService.js"]) {
    delete require_.cache[require_.resolve(path.join(AKAR, "aleta_bot/services", b))];
  }
  return require_(require_.resolve(path.join(AKAR, "aleta_bot/services/penetapanTulisService.js"))) as Layanan;
}

const minta = () => ({
  perkaraId: 10222,
  tanggalPenetapan: "2026-10-09",
  olehUsername: "Derry Briantono, S.H.",
  operator: "SUPER ADMIN DERRY",
  ip: "192.168.10.33",
  langkah: [
    { jenis: "pmh", hakimId: [26, 32, 31], pejabatUsername: "fahri" },
    { jenis: "ppp", petugasId: 21, pejabatUsername: "Sri Susilowati" },
    { jenis: "pjs", petugasId: 28, pejabatUsername: "Sri Susilowati" },
    { jenis: "phs", tanggalSidang: "2026-10-21", ruanganId: 3 },
  ],
});

const penetapanBaru = (t: Tulisan[]) => t.filter((x) => /^INSERT INTO perkara_penetapan\b/i.test(x.sql)).length;
const hakimBaru = (t: Tulisan[]) => t.filter((x) => /^INSERT INTO perkara_hakim_pn\b/i.test(x.sql)).length;
const alat = { jeda: async () => undefined };

describe("dua rantai bersamaan atas satu perkara", () => {
  it("dengan kunci baris: tepat SATU yang menulis, yang lain melewati semuanya", async () => {
    const sipp = sippBertransaksi({}, true);
    const layanan = muatLayanan(sipp.db);
    const [a, b] = await Promise.all([layanan.tulisRantaiUtuh(minta(), alat), layanan.tulisRantaiUtuh(minta(), alat)]);
    expect(a.ok && b.ok, JSON.stringify([a, b]).slice(0, 500)).toBe(true);
    expect(penetapanBaru(sipp.terkomit)).toBe(1);
    expect(hakimBaru(sipp.terkomit)).toBe(3);
    const pemenang = [a, b].filter((r) => r.hasil.every((x: any) => x.ok === true));
    const pelewat = [a, b].filter((r) => r.hasil.every((x: any) => x.sudahAda === true));
    expect(pemenang).toHaveLength(1);
    expect(pelewat).toHaveLength(1);
    expect(sipp.perintah.filter((x) => x === "FOR UPDATE")).toHaveLength(2);
  });

  it("TANPA kunci baris (tiruan dimatikan): keduanya menulis - ujinya memang peka", async () => {
    const sipp = sippBertransaksi({}, false);
    const layanan = muatLayanan(sipp.db);
    await Promise.all([layanan.tulisRantaiUtuh(minta(), alat), layanan.tulisRantaiUtuh(minta(), alat)]);
    expect(penetapanBaru(sipp.terkomit)).toBe(2);
  });

  it("tiga pekerjaan berpapasan: tetap satu penetapan", async () => {
    const sipp = sippBertransaksi({}, true);
    const layanan = muatLayanan(sipp.db);
    await Promise.all([1, 2, 3].map(() => layanan.tulisRantaiUtuh(minta(), alat)));
    expect(penetapanBaru(sipp.terkomit)).toBe(1);
    expect(hakimBaru(sipp.terkomit)).toBe(3);
  });
});

describe("keadaan separuh tidak ditulis di atasnya", () => {
  it("baris majelis sudah ada tetapi tanggal PMH kosong: pmh_sudah_ada, tidak ditimpa", async () => {
    const sipp = sippBertransaksi({ nPmh: 3 }, true);
    const layanan = muatLayanan(sipp.db);
    const r = await layanan.tulisRantaiUtuh({ ...minta(), langkah: minta().langkah.slice(0, 1) }, alat);
    expect(r.hasil[0]).toMatchObject({ jenis: "pmh", sudahAda: true });
    expect(penetapanBaru(sipp.terkomit)).toBe(0);
    expect(hakimBaru(sipp.terkomit)).toBe(0);
  });
});

describe("satu definisi 'ada' (penetapanKeadaanService)", () => {
  const { bentukKeadaan, keadaanBanyak } = require_(path.join(AKAR, "aleta_bot/services/penetapanKeadaanService.js")) as {
    bentukKeadaan: (b: Record<string, unknown>) => Record<string, any>;
    keadaanBanyak: (p: unknown[], o: { kueri: (s: string, p: unknown[]) => Promise<unknown> }) => Promise<Record<string, any>>;
  };

  it("tanggal terisi ATAU baris ada = ada; tidak sinkron ditandai, tidak dianggap belum ada", () => {
    const k = bentukKeadaan({ perkaraId: 1, pmh: new Date(2026, 9, 20), nPmh: 3, ppp: "2026-10-20", nPpp: 0, nPjs: 1, phs: null, nPhs: 0 });
    expect(k.langkah.pmh).toMatchObject({ ada: true, tanggal: "2026-10-20", baris: 3 });
    expect(k.langkah.ppp.ada).toBe(true);
    expect(k.langkah.pjs.ada).toBe(true);
    expect(k.langkah.phs.ada).toBe(false);
    expect(k.tidakSelaras).toEqual(["ppp", "pjs"]);
    expect(k.sisa).toEqual(["phs"]);
    expect(k.lengkap).toBe(false);
  });

  it("tanggal 0000-00-00 bukan tanggal; sidik berubah bila keadaan berubah", () => {
    const a = bentukKeadaan({ perkaraId: 1, pmh: "0000-00-00" });
    const b = bentukKeadaan({ perkaraId: 1, pmh: "2026-10-20", nPmh: 3 });
    expect(a.langkah.pmh.ada).toBe(false);
    expect(a.sidik).not.toBe(b.sidik);
  });

  it("gagal membaca = ok:false (bukan 'belum ada')", async () => {
    const r = await keadaanBanyak([10222], { kueri: async () => Promise.reject(new Error("putus")) });
    expect(r).toMatchObject({ ok: false, alasan: "keadaan_tidak_terbaca" });
  });

  it("banyak perkara sekaligus (penanda baris daftar) memakai bentuk yang sama", async () => {
    const baris = [
      { perkaraId: 1, nomorPerkara: "1/Pdt.G/2026/PA.Dgl", pmh: "2026-10-01", nPmh: 3, ppp: "2026-10-01", nPpp: 1, pjs: "2026-10-01", nPjs: 1, phs: "2026-10-01", nPhs: 1 },
      { perkaraId: 2, nomorPerkara: "2/Pdt.G/2026/PA.Dgl" },
    ];
    const r = await keadaanBanyak([1, 2], { kueri: async () => baris });
    expect(r.ok).toBe(true);
    expect(r.peta[1].lengkap).toBe(true);
    expect(r.peta[2].sisa).toEqual(["pmh", "ppp", "pjs", "phs"]);
    expect(r.peta["2/Pdt.G/2026/PA.Dgl"].perkaraId).toBe(2);
  });
});
