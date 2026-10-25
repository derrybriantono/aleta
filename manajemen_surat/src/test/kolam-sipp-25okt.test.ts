// @vitest-environment node
/**
 * Kolam SIPP interaktif terpisah dari latar (K3, rantai F1, 25 Okt 2026).
 *
 * Diuji PERILAKUNYA, bukan teks kodenya:
 *   - bawaan: kueri diteruskan apa adanya ke kolam utama (tanpa getConnection);
 *   - terpisah: konteks layar -> kolam kedua, kerja tanpa tanda -> kolam utama;
 *   - ukuran kolam berubah saat berjalan pada kolam mysql ASLI;
 *   - gagal cepat: batas tunggu, batas antrean (kolam mysql asli menolak antrean ke-3);
 *   - galat kolam penuh BUKAN tanda SIPP rusak (tidak membuka pemutus arus);
 *   - kueri yang melewati batas waktu klien dihentikan di server (KILL QUERY).
 */
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot/package.json"));

process.env.ALETA_BOT_DATA_DIR = path.join(process.env.TEMP || process.env.TMPDIR || "/tmp", "uji-kolam-sipp-25okt");

type Setelan = {
  terpisah: boolean;
  batas: number;
  batasInteraktif: number;
  antreMaksMs: number;
  antreanMaks: number;
  putusKueriLambat: boolean;
};
type Pelaksana = {
  jalankan: (options: unknown, rest: unknown[]) => unknown;
  selarasKolam: () => void;
  status: () => { utama: { batas: number } | null; interaktif: unknown };
  _kedua: () => unknown;
};
type Layanan = {
  bawaan: () => Setelan;
  rapikan: (x: unknown, dasar?: Setelan) => Setelan;
  setelan: () => Setelan;
  terapkan: (x: unknown, o?: { simpan?: boolean }) => Setelan;
  middlewareExpress: () => (req: { path?: string }, res: unknown, next: () => void) => void;
  interaktif: <T>(fn: () => T) => T;
  latar: <T>(fn: () => T) => T;
  jenisSaatIni: () => "interaktif" | "latar";
  jalurLatar: (j: string) => boolean;
  buatPelaksana: (p: Record<string, unknown>) => Pelaksana;
  _setSetelan: (x: unknown) => void;
  _hitung: Record<string, number>;
};

const layanan = require_("./services/kolamSippService.js") as Layanan;
const pemutus = require_("./services/sippCircuitBreakerService.js") as { isDistressError: (e: unknown) => boolean };
const mysql = require_("mysql") as { createPool: (o: Record<string, unknown>) => any };

type Panggilan = { kolam: string; sql: unknown };

/** Kolam tiruan dengan bentuk yang dipakai pelaksana (getConnection, query, config). */
function kolamTiruan(nama: string, catat: Panggilan[], opsi: { tahanSambungan?: boolean; galatKueri?: Error } = {}) {
  const dilepas: number[] = [];
  const antre: Array<(e: unknown, c?: unknown) => void> = [];
  let berikut = 100;
  const kolam = {
    nama,
    config: { connectionLimit: 10, queueLimit: 0, connectionConfig: {} },
    ended: false,
    dilepas,
    antre,
    query(sql: unknown, ...rest: unknown[]) {
      catat.push({ kolam: nama, sql });
      const cb = rest[rest.length - 1] as (e: unknown, r?: unknown) => void;
      if (typeof cb === "function") setImmediate(() => cb(null, [{ dari: nama }]));
    },
    getConnection(cb: (e: unknown, c?: unknown) => void) {
      if (opsi.tahanSambungan) {
        antre.push(cb);
        return;
      }
      const id = ++berikut;
      const hendler: Array<() => void> = [];
      const conn = {
        threadId: id,
        release: () => dilepas.push(id),
        query(sql: unknown, ...rest: unknown[]) {
          catat.push({ kolam: nama, sql });
          const callback = rest[rest.length - 1] as (e: unknown, r?: unknown) => void;
          setImmediate(() => {
            if (opsi.galatKueri) callback(opsi.galatKueri);
            else callback(null, [{ dari: nama }]);
            hendler.forEach((h) => h());
          });
          return { once: (_ev: string, h: () => void) => hendler.push(h) };
        },
      };
      setImmediate(() => cb(null, conn));
    },
    end() {
      kolam.ended = true;
    },
  };
  return kolam;
}

function tunggu(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jalankan(p: Pelaksana, sql: string): Promise<{ galat: any; hasil: any }> {
  return new Promise((resolve) => {
    p.jalankan({ sql, timeout: 17000 }, [(galat: unknown, hasil: unknown) => resolve({ galat, hasil })]);
  });
}

beforeEach(() => {
  layanan._setSetelan({});
  for (const k of Object.keys(layanan._hitung)) layanan._hitung[k] = 0;
});

afterEach(() => {
  layanan._setSetelan({});
});

describe("setelan kolam SIPP", () => {
  it("bawaan = perilaku sekarang: satu kolam, tanpa batas antre, tanpa putus kueri", () => {
    expect(layanan.bawaan()).toEqual({
      terpisah: false,
      batas: 10,
      batasInteraktif: 10,
      antreMaksMs: 0,
      antreanMaks: 0,
      putusKueriLambat: false,
    });
  });

  it("nilai di luar rentang dijepit, sampah jatuh ke bawaan, yang tidak disebut dipertahankan", () => {
    const s = layanan.rapikan({ batas: 999, batasInteraktif: 0, antreMaksMs: -5, antreanMaks: "abc", terpisah: "ya" });
    expect(s.batas).toBe(50);
    expect(s.batasInteraktif).toBe(1);
    expect(s.antreMaksMs).toBe(0);
    expect(s.antreanMaks).toBe(0);
    expect(s.terpisah).toBe(false);
    const dasar = { ...layanan.bawaan(), batas: 7, terpisah: true };
    expect(layanan.rapikan({ antreMaksMs: 3000 }, dasar)).toMatchObject({ batas: 7, terpisah: true, antreMaksMs: 3000 });
  });
});

describe("penandaan layar dan latar", () => {
  it("awalan kerja berat dikenali sebagai latar, layar biasa tidak", () => {
    expect(layanan.jalurLatar("/sinkron/status")).toBe(true);
    expect(layanan.jalurLatar("/ecourt/penarikan/x")).toBe(true);
    expect(layanan.jalurLatar("/ecourt-aksi/pantau-putusan")).toBe(true);
    expect(layanan.jalurLatar("/sipp/penilaian")).toBe(true);
    expect(layanan.jalurLatar("/sipp/jadwal-sidang/hari")).toBe(false);
    expect(layanan.jalurLatar("/sipp/status-perkara")).toBe(false);
    expect(layanan.jalurLatar("/jadwal-sidang")).toBe(false);
    // awalan harus utuh: "/ecourtx" bukan "/ecourt"
    expect(layanan.jalurLatar("/ecourtx")).toBe(false);
  });

  it("middleware menandai permintaan dan tanda bertahan lewat kerja tak serempak", async () => {
    const mw = layanan.middlewareExpress();
    const hasil: string[] = [];
    await new Promise<void>((selesai) => {
      mw({ path: "/sipp/jadwal-sidang/hari" }, {}, () => {
        setTimeout(() => {
          hasil.push(layanan.jenisSaatIni());
          Promise.resolve().then(() => {
            hasil.push(layanan.jenisSaatIni());
            selesai();
          });
        }, 5);
      });
    });
    await new Promise<void>((selesai) => {
      mw({ path: "/sinkron/dorong" }, {}, () => {
        hasil.push(layanan.jenisSaatIni());
        selesai();
      });
    });
    expect(hasil).toEqual(["interaktif", "interaktif", "latar"]);
    // di luar permintaan apa pun: latar
    expect(layanan.jenisSaatIni()).toBe("latar");
    expect(layanan.interaktif(() => layanan.jenisSaatIni())).toBe("interaktif");
    expect(layanan.interaktif(() => layanan.latar(() => layanan.jenisSaatIni()))).toBe("latar");
  });
});

describe("pelaksana kueri", () => {
  it("bawaan: diteruskan ke kueri asli kolam utama, tanpa getConnection dan tanpa kolam kedua", async () => {
    const catat: Panggilan[] = [];
    const utama = kolamTiruan("utama", catat);
    let kedua = 0;
    let getConn = 0;
    const asli = utama.getConnection;
    utama.getConnection = (cb) => {
      getConn += 1;
      return asli.call(utama, cb);
    };
    const p = layanan.buatPelaksana({
      utama,
      queryAsli: utama.query.bind(utama),
      buatKolamKedua: () => {
        kedua += 1;
        return kolamTiruan("kedua", catat);
      },
    });
    const r = await layanan.interaktif(() => jalankan(p, "SELECT 1"));
    expect(r.hasil).toEqual([{ dari: "utama" }]);
    expect(getConn).toBe(0);
    expect(kedua).toBe(0);
    expect(catat.map((c) => c.kolam)).toEqual(["utama"]);
  });

  it("terpisah: layar ke kolam kedua (dibuat malas), kerja latar tetap di kolam utama", async () => {
    const catat: Panggilan[] = [];
    const utama = kolamTiruan("utama", catat);
    let dibuat = 0;
    const p = layanan.buatPelaksana({
      utama,
      queryAsli: utama.query.bind(utama),
      buatKolamKedua: () => {
        dibuat += 1;
        return kolamTiruan("kedua", catat);
      },
    });
    layanan.terapkan({ terpisah: true, batas: 4, batasInteraktif: 12 }, { simpan: false });
    p.selarasKolam();
    expect(dibuat).toBe(0);
    expect(utama.config.connectionLimit).toBe(4);

    const latar = await jalankan(p, "SELECT latar");
    const layar = await layanan.interaktif(() => jalankan(p, "SELECT layar"));
    expect(latar.hasil[0].dari).toBe("utama");
    expect(layar.hasil[0].dari).toBe("kedua");
    expect(dibuat).toBe(1);
    expect((p._kedua() as { config: { connectionLimit: number } }).config.connectionLimit).toBe(12);

    // kerja latar yang dimulai di dalam permintaan layar tetap bisa dikeluarkan
    const dariLatar = await layanan.interaktif(() => layanan.latar(() => jalankan(p, "SELECT x")));
    expect(dariLatar.hasil[0].dari).toBe("utama");
  });

  it("mematikan terpisah menutup kolam kedua dan mengembalikan semua ke kolam utama", async () => {
    const catat: Panggilan[] = [];
    const utama = kolamTiruan("utama", catat);
    const kedua = kolamTiruan("kedua", catat);
    const p = layanan.buatPelaksana({
      utama,
      queryAsli: utama.query.bind(utama),
      buatKolamKedua: () => kedua,
      setTimer: (fn: () => void) => {
        fn();
        return 0;
      },
      hapusTimer: () => undefined,
    });
    layanan.terapkan({ terpisah: true }, { simpan: false });
    await layanan.interaktif(() => jalankan(p, "SELECT 1"));
    expect(p._kedua()).toBe(kedua);
    layanan.terapkan({ terpisah: false }, { simpan: false });
    p.selarasKolam();
    expect(p._kedua()).toBeNull();
    expect(kedua.ended).toBe(true);
    const r = await layanan.interaktif(() => jalankan(p, "SELECT 2"));
    expect(r.hasil[0].dari).toBe("utama");
  });

  it("gagal cepat: menunggu sambungan melewati batas -> galat jelas, sambungan yang telat dilepas lagi", async () => {
    const catat: Panggilan[] = [];
    const utama = kolamTiruan("utama", catat, { tahanSambungan: true });
    const p = layanan.buatPelaksana({ utama, queryAsli: utama.query.bind(utama), buatKolamKedua: () => kolamTiruan("k", catat) });
    layanan.terapkan({ antreMaksMs: 40 }, { simpan: false });
    const r = await jalankan(p, "SELECT 1");
    expect(r.galat.code).toBe("KOLAM_ANTRE_HABIS");
    expect(r.galat.message).toMatch(/SIPP sedang penuh/);
    expect(pemutus.isDistressError(r.galat)).toBe(false);
    expect(layanan._hitung.antreHabis).toBe(1);

    // sambungan datang terlambat: tidak dipakai, langsung dikembalikan
    const conn = { threadId: 5, release: () => utama.dilepas.push(5), query: () => { throw new Error("tidak boleh dipakai"); } };
    utama.antre[0](null, conn);
    expect(utama.dilepas).toEqual([5]);
  });

  it("sambungan didapat sebelum batas tunggu: kueri jalan dan sambungan dilepas sesudah selesai", async () => {
    const catat: Panggilan[] = [];
    const utama = kolamTiruan("utama", catat);
    const p = layanan.buatPelaksana({ utama, queryAsli: utama.query.bind(utama), buatKolamKedua: () => kolamTiruan("k", catat) });
    layanan.terapkan({ antreMaksMs: 5000 }, { simpan: false });
    const r = await jalankan(p, "SELECT 1");
    expect(r.hasil).toEqual([{ dari: "utama" }]);
    await tunggu(5);
    expect(utama.dilepas).toEqual([101]);
  });

  it("kolam mysql ASLI menolak antrean melebihi batas dengan galat yang bukan tanda SIPP rusak", async () => {
    // port 1 ditolak seketika: tidak ada server yang diperlukan untuk menguji antrean.
    const asli = mysql.createPool({ host: "127.0.0.1", port: 1, connectionLimit: 1, connectTimeout: 500 });
    const utama = Object.assign(asli, {});
    const p = layanan.buatPelaksana({
      utama,
      queryAsli: (...a: unknown[]) => (asli.query as (...x: unknown[]) => unknown)(...a),
      buatKolamKedua: () => kolamTiruan("k", []),
    });
    layanan.terapkan({ batas: 1, antreanMaks: 1, antreMaksMs: 3000 }, { simpan: false });
    p.selarasKolam();
    expect(asli.config.connectionLimit).toBe(1);
    expect(asli.config.queueLimit).toBe(1);
    const hasil = await Promise.all([jalankan(p, "SELECT 1"), jalankan(p, "SELECT 2"), jalankan(p, "SELECT 3")]);
    const kode = hasil.map((h) => h.galat && h.galat.code);
    expect(kode.filter((k) => k === "KOLAM_PENUH")).toHaveLength(1);
    const penuh = hasil.find((h) => h.galat && h.galat.code === "KOLAM_PENUH")!;
    expect(pemutus.isDistressError(penuh.galat)).toBe(false);
    expect(layanan._hitung.antrePenuh).toBe(1);
    await new Promise<void>((r) => asli.end(() => r()));
  });

  it("putus kueri lambat: batas waktu klien terlampaui -> KILL QUERY atas utas yang sama", async () => {
    const galatBatas = Object.assign(new Error("Handshake inactivity timeout"), { code: "PROTOCOL_SEQUENCE_TIMEOUT" });
    const catat: Panggilan[] = [];
    const utama = kolamTiruan("utama", catat, { galatKueri: galatBatas });
    const dimatikan: number[] = [];
    const p = layanan.buatPelaksana({
      utama,
      queryAsli: utama.query.bind(utama),
      buatKolamKedua: () => kolamTiruan("k", catat),
      matikan: (_k: unknown, id: number) => dimatikan.push(id),
    });
    layanan.terapkan({ putusKueriLambat: true }, { simpan: false });
    const r = await jalankan(p, "SELECT berat");
    expect(r.galat.code).toBe("PROTOCOL_SEQUENCE_TIMEOUT");
    expect(dimatikan).toEqual([101]);
  });

  it("putus kueri lambat tidak menyentuh galat SQL biasa dan tidak aktif bila dimatikan", async () => {
    const galatSql = Object.assign(new Error("tabel tidak ada"), { code: "ER_NO_SUCH_TABLE" });
    const dimatikan: number[] = [];
    const a = kolamTiruan("utama", [], { galatKueri: galatSql });
    const pa = layanan.buatPelaksana({ utama: a, queryAsli: a.query.bind(a), buatKolamKedua: () => a, matikan: (_k: unknown, id: number) => dimatikan.push(id) });
    layanan.terapkan({ putusKueriLambat: true }, { simpan: false });
    await jalankan(pa, "SELECT 1");
    expect(dimatikan).toEqual([]);

    const galatBatas = Object.assign(new Error("x"), { code: "PROTOCOL_SEQUENCE_TIMEOUT" });
    const b = kolamTiruan("utama", [], { galatKueri: galatBatas });
    const pb = layanan.buatPelaksana({ utama: b, queryAsli: b.query.bind(b), buatKolamKedua: () => b, matikan: (_k: unknown, id: number) => dimatikan.push(id) });
    layanan.terapkan({ putusKueriLambat: false }, { simpan: false });
    await jalankan(pb, "SELECT 1");
    expect(dimatikan).toEqual([]);
  });
});
