// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * RIWAYAT PIHAK ATAS SIPP SUNGGUHAN - sipp_donggala SETEMPAT
 * ============================================================================
 *
 * riwayatPihakService DIJALANKAN atas salinan SIPP satker lewat db_config bot
 * yang sesungguhnya (penjaga kueri, pemutus arus - semuanya), lalu jawabannya
 * diadu dengan SQL TERPISAH yang ditulis ulang di sini dengan bentuk berbeda.
 * Tidak ada satu pun pemeriksaan yang membaca teks sumber.
 *
 * Contoh nyata yang dijaga (nomor perkara saja - nama pihak tidak disalin):
 *
 *   275/Pdt.G/2026   penggugat bercerai berakta DUA KALI (275/Pdt.G/2020 dan
 *                    perkara ini) - dengan tergugat yang berbeda
 *   483/Pdt.G/2019   pemohon cerai talak dua kali (179/Pdt.G/2017 dan perkara
 *                    ini); 233/Pdt.G/2016 yang digugurkan TIDAK terhitung
 *   335/Pdt.G/2024   termohon bercerai dua kali; cerai pertamanya
 *                    (67/Pdt.G/2017) hanya terjangkau lewat pasangan nama di
 *                    isbat 612/Pdt.P/2017 - SIPP mengetik tanggal lahir yang
 *                    sama untuk suami dan istri di sana
 *   286/Pdt.G/2023   harta bersama sesudah cerai gugat 478/Pdt.G/2021
 *   77/Pdt.G/2017    harta bersama sesudah cerai talak 240/Pdt.G/2016
 *   106/Pdt.G/2023   sembilan orang berbagi SATU NIK - NIK itu tidak boleh
 *                    menyambungkan siapa pun
 *
 * Bila MySQL setempat tidak dapat dihubungi, bagian ini DILEWATI beserta
 * sebabnya. Kueri yang GAGAL tidak pernah dilewati: ia dilempar apa adanya.
 * SELECT saja - sipp_donggala tidak diubah.
 */

process.env.ALETA_BOT_DB_SIPP_HOST = process.env.ALETA_UJI_SIPP_HOST || "127.0.0.1";
process.env.ALETA_BOT_DB_SIPP_USER = process.env.ALETA_UJI_SIPP_USER || "root";
process.env.ALETA_BOT_DB_SIPP_NAME = process.env.ALETA_UJI_SIPP_NAMA || "sipp_donggala";

const AKAR_BOT = path.resolve(process.cwd(), "../aleta_bot");
const muat = createRequire(path.join(AKAR_BOT, "package.json"));

type Butir = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  pihakKe: number;
  kedudukan: string;
  tanggalDaftar: string;
  keadaan: string;
  aktaCerai: { nomor: string; tanggal: string } | null;
  arah: string;
  dasar: { tingkat: string; label: string; catatan: string };
};
type Riwayat = { pihakId: number; pihakKe: number; nama: string; ceraiBerakta: number; cerai: Butir[]; jumlahTerkait: number; terkait: Butir[] };
type Hasil = { ok: boolean; kode?: string; perkara?: { perkaraId: string; nomorPerkara: string }; pihak: Riwayat[]; waktuMs: number; langkahMs: Record<string, number> };
type Layanan = { riwayatPihak: (m: Record<string, unknown>) => Promise<Hasil> };
type Db = { query: (sql: string, nilai: unknown[], cb: (e: Error | null, r: unknown) => void) => void; end: (cb?: () => void) => void };

let db: Db | null = null;
let layanan: Layanan | null = null;
let siap = false;
let sebabLewat = "";
const waktu: number[] = [];

function sql<T = Record<string, unknown>>(teks: string, nilai: unknown[] = []): Promise<T[]> {
  return new Promise((ok, gagal) => db!.query(teks, nilai, (e, r) => (e ? gagal(e) : ok((r as T[]) || []))));
}

async function riwayat(nomorPerkara: string): Promise<Hasil> {
  const hasil = await layanan!.riwayatPihak({ nomorPerkara });
  expect(hasil.ok, JSON.stringify(hasil).slice(0, 300)).toBe(true);
  waktu.push(hasil.waktuMs);
  return hasil;
}

/** Akta cerai yang terbit, menurut SQL TERPISAH (nomor perkara -> nomor akta). */
async function aktaMenurutSql(nomor: string[]): Promise<Map<string, string>> {
  if (nomor.length === 0) return new Map();
  const baris = await sql<{ nomor: string; akta: string }>(
    `SELECT p.nomor_perkara AS nomor, TRIM(a.nomor_akta_cerai) AS akta
       FROM perkara p, perkara_akta_cerai a
      WHERE a.perkara_id = p.perkara_id
        AND p.nomor_perkara IN (${nomor.map(() => "?").join(",")})
        AND a.tgl_akta_cerai IS NOT NULL
        AND TRIM(IFNULL(a.nomor_akta_cerai, '')) <> ''`,
    nomor
  );
  return new Map(baris.map((b) => [b.nomor, b.akta]));
}

beforeAll(async () => {
  try {
    db = muat("./db_config") as Db;
    const cek = await Promise.race([
      sql<{ n: number }>("SELECT COUNT(*) AS n FROM perkara WHERE nomor_perkara = ?", ["275/Pdt.G/2026/PA.Dgl"]),
      new Promise<never>((_, gagal) => setTimeout(() => gagal(new Error("MySQL tidak menjawab dalam 20 detik")), 20000)),
    ]);
    if (Number(cek[0]?.n) !== 1) {
      sebabLewat = "perkara contoh 275/Pdt.G/2026/PA.Dgl tidak ada di basis data ini";
      return;
    }
    // Uji mutan memuat SALINAN layanannya lewat RIWAYAT_PIHAK_BERKAS.
    layanan = muat(process.env.RIWAYAT_PIHAK_BERKAS || "./services/riwayatPihakService.js") as Layanan;
    siap = true;
  } catch (e) {
    sebabLewat = `MySQL setempat tidak dapat dihubungi: ${(e as Error).message}`;
  }
}, 60000);

afterAll(async () => {
  if (waktu.length) {
    const urut = [...waktu].sort((a, b) => a - b);
    console.info(
      `[riwayat-pihak] ${urut.length} pembacaan: tengah ${urut[Math.floor(urut.length / 2)]} ms, terlama ${urut[urut.length - 1]} ms`
    );
  }
  await new Promise<void>((ok) => (db ? db.end(() => ok()) : ok()));
});

const siapAtauLewat = (ctx: { skip: () => void }) => {
  if (!siap) {
    console.warn(`[riwayat-pihak] dilewati: ${sebabLewat}`);
    ctx.skip();
  }
};

const pihakKe = (h: Hasil, ke: number) => h.pihak.filter((p) => p.pihakKe === ke);

describe("contoh nyata di sipp_donggala", () => {
  it("275/Pdt.G/2026: penggugat bercerai berakta dua kali; aktanya sama dengan SQL terpisah", async (ctx) => {
    siapAtauLewat(ctx);
    const h = await riwayat("275/Pdt.G/2026/PA.Dgl");
    const [penggugat] = pihakKe(h, 1);
    expect(penggugat.ceraiBerakta).toBe(2);
    expect(penggugat.cerai.map((x) => x.nomorPerkara)).toEqual(["275/Pdt.G/2020/PA.Dgl", "275/Pdt.G/2026/PA.Dgl"]);
    expect(penggugat.cerai.map((x) => x.arah)).toEqual(["sebelumnya", "perkara ini"]);
    const akta = await aktaMenurutSql(penggugat.cerai.map((x) => x.nomorPerkara));
    for (const x of penggugat.cerai) expect(x.aktaCerai?.nomor, x.nomorPerkara).toBe(akta.get(x.nomorPerkara));
    // Tergugatnya orang lain - cerai sekali, yaitu perkara ini.
    const [tergugat] = pihakKe(h, 2);
    expect(tergugat.ceraiBerakta).toBe(1);
  });

  it("483/Pdt.G/2019: cerai talak dua kali; perkara yang digugurkan tidak terhitung", async (ctx) => {
    siapAtauLewat(ctx);
    const h = await riwayat("483/Pdt.G/2019/PA.Dgl");
    const [pemohon] = pihakKe(h, 1);
    expect(pemohon.cerai.map((x) => x.nomorPerkara)).toEqual(["179/Pdt.G/2017/PA.Dgl", "483/Pdt.G/2019/PA.Dgl"]);
    const gugur = pemohon.terkait.find((x) => x.nomorPerkara === "233/Pdt.G/2016/PA.Dgl");
    expect(gugur, "233/Pdt.G/2016 tetap perkara terkait").toBeTruthy();
    expect(gugur!.aktaCerai).toBeNull();
    const aktaGugur = await aktaMenurutSql(["233/Pdt.G/2016/PA.Dgl"]);
    expect(aktaGugur.size, "SQL terpisah: 233/Pdt.G/2016 memang tidak berakta").toBe(0);
  });

  it("335/Pdt.G/2024: cerai pertama termohon terjangkau lewat pasangan nama di isbatnya", async (ctx) => {
    siapAtauLewat(ctx);
    const h = await riwayat("335/Pdt.G/2024/PA.Dgl");
    const [termohon] = pihakKe(h, 2);
    expect(termohon.ceraiBerakta).toBe(2);
    const pertama = termohon.cerai.find((x) => x.nomorPerkara === "67/Pdt.G/2017/PA.Dgl");
    expect(pertama?.dasar.tingkat).toBe("pasangan");
    expect(pertama?.dasar.label).toContain("612/Pdt.P/2017/PA.Dgl");
    // Tanggal lahir yang berbeda DISEBUT, tidak disembunyikan.
    expect(pertama?.dasar.catatan).toMatch(/tanggal lahir tercatat berbeda/);
  });

  it("harta bersama tersambung ke perceraian berakta sebelumnya (286/Pdt.G/2023 dan 77/Pdt.G/2017)", async (ctx) => {
    siapAtauLewat(ctx);
    for (const [nomor, cerai, akta] of [
      ["286/Pdt.G/2023/PA.Dgl", "478/Pdt.G/2021/PA.Dgl", "463/AC/2021/PA.Dgl"],
      ["77/Pdt.G/2017/PA.Dgl", "240/Pdt.G/2016/PA.Dgl", "0262/AC/2016/PA.Dgl"],
    ]) {
      const h = await riwayat(nomor);
      const jenis = await sql<{ jenis: string }>("SELECT jenis_perkara_nama AS jenis FROM perkara WHERE nomor_perkara = ?", [nomor]);
      expect(jenis[0].jenis).toMatch(/harta bersama/i);
      for (const ke of [1, 2]) {
        const [orang] = pihakKe(h, ke);
        const temuan = orang.terkait.find((x) => x.nomorPerkara === cerai);
        expect(temuan, `${nomor} pihak ${ke}`).toBeTruthy();
        expect(temuan!.arah).toBe("sebelumnya");
        expect(temuan!.aktaCerai?.nomor).toBe(akta);
        expect(["pihak_id", "nik", "nama_lahir", "pasangan"]).toContain(temuan!.dasar.tingkat);
      }
    }
  });

  it("106/Pdt.G/2023: NIK yang dipakai banyak orang tidak menyambungkan siapa pun", async (ctx) => {
    siapAtauLewat(ctx);
    // SQL terpisah: di perkara ini ada NIK yang dipakai lebih dari satu nama.
    const bersama = await sql<{ nama: number }>(
      `SELECT COUNT(DISTINCT UPPER(TRIM(ph.nama))) AS nama
         FROM perkara p
         JOIN perkara_pihak1 a ON a.perkara_id = p.perkara_id
         JOIN pihak ph ON ph.id = a.pihak_id
        WHERE p.nomor_perkara = ? AND TRIM(ph.nomor_indentitas) REGEXP '^[0-9]{16}$'
        GROUP BY TRIM(ph.nomor_indentitas)
        ORDER BY 1 DESC LIMIT 1`,
      ["106/Pdt.G/2023/PA.Dgl"]
    );
    expect(Number(bersama[0]?.nama)).toBeGreaterThan(3);
    const h = await riwayat("106/Pdt.G/2023/PA.Dgl");
    const lewatNik = h.pihak.flatMap((p) => p.terkait).filter((x) => x.dasar.tingkat === "nik");
    expect(lewatNik).toEqual([]);
  });
});

describe("sifat yang berlaku pada setiap perkara - contoh acak tetap dari register", () => {
  it("cerai = hanya yang berakta menurut SQL terpisah, tidak ada yang terlewat, dasar tidak pernah nama saja", async (ctx) => {
    siapAtauLewat(ctx);
    // Contoh tetap: dua belas perkara cerai, isbat, dan harta bersama diurut
    // CRC32 (sama tiap kali, tidak bergantung pada urutan penyimpanan),
    // DITAMBAH perkara yang pasti punya temuan - supaya sifat di bawah diuji
    // atas temuan sungguhan, termasuk cerai tiga kali (148/Pdt.G/2018: satu
    // orang, tiga istri, tiga akta).
    const acak = await sql<{ nomor: string }>(
      `SELECT p.nomor_perkara AS nomor FROM perkara p
        WHERE p.jenis_perkara_id IN (346, 347, 348, 360)
        ORDER BY CRC32(CONCAT('riwayat-pihak-', p.perkara_id))
        LIMIT 12`
    );
    expect(acak.length).toBe(12);
    const contoh = [
      ...acak,
      ...["148/Pdt.G/2018/PA.Dgl", "242/Pdt.G/2022/PA.Dgl", "402/Pdt.G/2019/PA.Dgl", "612/Pdt.P/2017/PA.Dgl", "637/Pdt.G/2025/PA.Dgl", "506/Pdt.G/2026/PA.Dgl"].map(
        (nomor) => ({ nomor })
      ),
    ];
    const tingkatSah = new Set(["perkara_ini", "pihak_id", "nik", "nama_lahir", "pasangan"]);
    let temuan = 0;
    let ceraiTiga = 0;
    for (const { nomor } of contoh) {
      const h = await riwayat(nomor);
      const semua = h.pihak.flatMap((p) => [...p.cerai, ...p.terkait]);
      temuan += semua.length;
      const akta = await aktaMenurutSql([...new Set([nomor, ...semua.map((x) => x.nomorPerkara)])]);
      const tanggal = await sql<{ nomor: string; daftar: string }>(
        `SELECT nomor_perkara AS nomor, DATE_FORMAT(tanggal_pendaftaran, '%Y-%m-%d') AS daftar
           FROM perkara WHERE nomor_perkara IN (${[nomor, ...semua.map((x) => x.nomorPerkara)].map(() => "?").join(",")})`,
        [nomor, ...semua.map((x) => x.nomorPerkara)]
      );
      const daftar = new Map(tanggal.map((t) => [t.nomor, t.daftar]));
      for (const p of h.pihak) {
        expect(p.ceraiBerakta, `${nomor}`).toBe(p.cerai.length);
        for (const x of p.cerai) {
          expect(akta.get(x.nomorPerkara), `${nomor} -> ${x.nomorPerkara} dihitung cerai tanpa akta`).toBe(x.aktaCerai?.nomor);
          expect([1, 2]).toContain(x.pihakKe);
        }
        // Tidak ada yang terlewat: tiap perkara terkait yang berakta dan
        // orang ini pihak pertama/keduanya MASUK hitungan cerai.
        for (const x of p.terkait) {
          expect(x.nomorPerkara, "perkara ini tidak boleh menjadi perkara terkaitnya sendiri").not.toBe(nomor);
          if (akta.has(x.nomorPerkara) && (x.pihakKe === 1 || x.pihakKe === 2)) {
            expect(p.cerai.map((c) => c.nomorPerkara), `${nomor}: ${x.nomorPerkara} berakta tetapi tidak dihitung`).toContain(x.nomorPerkara);
          }
          // Sebelum/sesudah menurut tanggal pendaftaran dari SQL terpisah.
          const a = daftar.get(x.nomorPerkara) || "";
          const b = daftar.get(nomor) || "";
          if (a && b && a !== b) expect(x.arah, `${nomor} -> ${x.nomorPerkara}`).toBe(a < b ? "sebelumnya" : "sesudahnya");
        }
        for (const x of [...p.cerai, ...p.terkait]) expect(tingkatSah.has(x.dasar.tingkat), x.dasar.tingkat).toBe(true);
        if (akta.has(nomor)) expect(p.cerai.some((c) => c.arah === "perkara ini"), `${nomor} berakta`).toBe(true);
        if (p.ceraiBerakta >= 3) ceraiTiga += 1;
      }
    }
    // Penjaga yang memeriksa daftar kosong selalu hijau.
    expect(temuan).toBeGreaterThan(0);
    // 148/Pdt.G/2018 dan 242/Pdt.G/2022: orang yang sama, cerai berakta tiga kali.
    expect(ceraiTiga).toBeGreaterThanOrEqual(2);
  }, 240000);
});
