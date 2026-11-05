// @vitest-environment node
/**
 * ============================================================================
 * PINDAH KE ALETA ABT PER JENIS PERKARA (5 Nov 2026, Tahap 8) - DATA REKAAN
 * ============================================================================
 *   1. keluarga blangko: tiap folder masuk TEPAT SATU keluarga; folder asing tidak ditebak;
 *   2. saklar: bawaan semua mati, hanya `true` yang menyala, kunci asing dibuang;
 *   3. syarat: tanpa pengukuran atau tanpa cukup cetak berdampingan saklar menolak menyala; mematikan selalu boleh;
 *   4. perlindungan panel Blangko ABT by Derry Briantono: selama saklar mati keputusan membuka ALETA ABT SELALU "tidak"
 *      (juga bagi Super Admin dan bagi folder yang tidak dikenal), dan kode ekstensi tidak menyentuh rute baru;
 *   5. hanya angka yang tersimpan: tidak ada isi naskah atau nama pihak.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import { SYARAT_CETAK, SYARAT_HARI_TANPA_MERAH } from "@/lib/aleta-abt-berdampingan";
import {
  FOLDER_BUKAN_BLANGKO,
  KELUARGA_PINDAH,
  bersihkanLaporanUkur,
  bersihkanSetelanPindah,
  bukaAletaAbtUntukFolder,
  hitungBerdampinganKeluarga,
  keluargaDariFolder,
  keluargaSah,
  nilaiKesiapan,
  pesanSyaratBelum,
  type UkurKeluarga,
} from "@/lib/aleta-abt-pindah";
import { bacaKeadaanPindah, bacaLaporanUkur, bacaSetelanPindah, simpanLaporanUkur, ubahSaklarPindah } from "@/server/modules/aleta-abt-pindah/service";

const AKAR = path.resolve(__dirname, "../..");
const SQL_0137 = readFileSync(path.join(AKAR, "drizzle/0137_aleta_abt_alur_berdampingan.sql"), "utf8");
const KINI = new Date("2026-11-20T00:00:00.000Z");

const ukur = (lain: Partial<UkurKeluarga> = {}): UkurKeluarga => ({
  kunci: "cerai-gugat",
  perkara: 5,
  naskah: 685,
  alinea: 90000,
  identik: 89000,
  dijelaskan: 1000,
  belumDijelaskan: 0,
  isianNilai: 5000,
  isianCocok: 5000,
  isianDijelaskan: 0,
  sebabBelum: "",
  ...lain,
});

/** n baris cetak berdampingan rekaan: hasil, folder, waktu, jawaban pemilik. */
const baris = (n: number, hasil: "hijau" | "kuning" | "merah" | "belum-diukur", folder: string, waktu = "2026-11-01T00:00:00.000Z", jawaban: "" | "dijelaskan" = "") =>
  Array.from({ length: n }, () => ({ waktu, folder, hasil, jawaban }));

describe("keluarga blangko", () => {
  it("tiap folder tepat satu keluarga; kunci unik; nama tidak kosong", () => {
    const lihat = new Map<string, string>();
    for (const k of KELUARGA_PINDAH) {
      expect(k.nama.trim().length).toBeGreaterThan(0);
      expect(k.folder.length).toBeGreaterThan(0);
      for (const f of k.folder) {
        expect(lihat.has(f.toLowerCase()), `folder ${f} dobel di ${k.kunci} dan ${lihat.get(f.toLowerCase())}`).toBe(false);
        lihat.set(f.toLowerCase(), k.kunci);
      }
    }
    expect(new Set(KELUARGA_PINDAH.map((k) => k.kunci)).size).toBe(KELUARGA_PINDAH.length);
  });

  it("folder dikenal dipetakan; folder asing tidak ditebak", () => {
    expect(keluargaDariFolder("1 Perceraian CG")).toBe("cerai-gugat");
    expect(keluargaDariFolder("1 Perceraian CG - BAS")).toBe("cerai-gugat");
    expect(keluargaDariFolder("  1a  Perceraian CT - bas ")).toBe("cerai-talak");
    expect(keluargaDariFolder("2a Itsbat Nikah Kontensius")).toBe("itsbat-nikah");
    expect(keluargaDariFolder("99 PTSP")).toBe("dokumen-umum");
    expect(keluargaDariFolder("ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)")).toBe("dokumen-umum");
    expect(keluargaDariFolder("Folder Baru Entah Apa")).toBeNull();
    expect(keluargaDariFolder("")).toBeNull();
    expect(keluargaDariFolder(undefined)).toBeNull();
    expect(keluargaSah("cerai-gugat")).toBe(true);
    expect(keluargaSah("__proto__")).toBe(false);
  });

  it("jenis perkara pengukur: keluarga bukan-umum punya pola jenis SIPP, keluarga umum tidak", () => {
    for (const k of KELUARGA_PINDAH) {
      if (k.umum) expect(k.jenisSipp).toHaveLength(0);
      else expect(k.jenisSipp.length, k.kunci).toBeGreaterThan(0);
    }
  });

  it("semua folder blangko pada pohon Derry (bila ada di mesin ini) terpetakan, selain yang memang bukan blangko", () => {
    const pohon = process.env.POHON || "D:/aleta-dev/kerja/audit-abt-4nov/pohon/derry_briantono";
    let folder: string[] = [];
    try {
      folder = readdirSync(pohon, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      return; // pohon tidak ada di mesin ini: cukup uji di atas
    }
    const tak = folder.filter((f) => !keluargaDariFolder(f) && !FOLDER_BUKAN_BLANGKO.includes(f));
    expect(tak).toEqual([]);
  });
});

describe("saklar", () => {
  it("bawaan semua mati; hanya true persis yang menyala; kunci asing dibuang", () => {
    const kosong = bersihkanSetelanPindah(null);
    expect(Object.keys(kosong.keluarga)).toHaveLength(KELUARGA_PINDAH.length);
    expect(Object.values(kosong.keluarga).every((s) => s.aktif === false)).toBe(true);
    const campur = bersihkanSetelanPindah({ keluarga: { "cerai-gugat": { aktif: "true" }, "cerai-talak": { aktif: 1 }, kewarisan: { aktif: true, diubahOleh: "Derry" }, "tidak-ada": { aktif: true } } });
    expect(campur.keluarga["cerai-gugat"].aktif).toBe(false);
    expect(campur.keluarga["cerai-talak"].aktif).toBe(false);
    expect(campur.keluarga.kewarisan).toMatchObject({ aktif: true, diubahOleh: "Derry" });
    expect(campur.keluarga["tidak-ada"]).toBeUndefined();
    expect(bersihkanSetelanPindah("rusak").keluarga["cerai-gugat"].aktif).toBe(false);
  });
});

describe("syarat kesiapan", () => {
  const gugat = KELUARGA_PINDAH.find((k) => k.kunci === "cerai-gugat")!;

  const CG = "1 Perceraian CG";

  it("hanya bila pengukuran bersih DAN cetak berdampingan cukup, tanpa merah, dan cukup hari", () => {
    const cukup = baris(SYARAT_CETAK, "hijau", CG, "2026-11-01T00:00:00.000Z");
    const k = nilaiKesiapan(gugat, { ukur: ukur(), berdampingan: cukup, aktif: false }, KINI);
    expect(k.siap).toBe(true);
    expect(k.cetak).toBe(SYARAT_CETAK);
    expect(k.hariTanpaMerah).toBeGreaterThanOrEqual(SYARAT_HARI_TANPA_MERAH);
    expect(k.persenNaskah).toBeCloseTo(100, 5);
  });

  it("belum terukur: tidak siap meski cetak berdampingan sempurna", () => {
    const cukup = baris(SYARAT_CETAK + 5, "hijau", CG, "2026-10-01T00:00:00.000Z");
    for (const u of [null, ukur({ perkara: 0, naskah: 0, alinea: 0, sebabBelum: "tidak ada perkara jenis ini di salinan uji" })]) {
      const k = nilaiKesiapan(gugat, { ukur: u, berdampingan: cukup, aktif: false }, KINI);
      expect(k.siap).toBe(false);
      expect(k.persenNaskah).toBeNull();
      expect(k.syarat[0].lulus).toBe(false);
      expect(k.syarat[0].keterangan).toMatch(/Belum terukur/);
    }
  });

  it("alinea beda yang belum dijelaskan menahan; cetak kurang menahan; merah menahan; hari kurang menahan", () => {
    const sepuluh = baris(10, "hijau", CG, "2026-10-01T00:00:00.000Z");
    const penuh = baris(SYARAT_CETAK, "hijau", CG, "2026-10-01T00:00:00.000Z");
    expect(nilaiKesiapan(gugat, { ukur: ukur({ belumDijelaskan: 3 }), berdampingan: penuh, aktif: false }, KINI)).toMatchObject({ siap: false });
    const kurang = nilaiKesiapan(gugat, { ukur: ukur(), berdampingan: sepuluh, aktif: false }, KINI);
    expect(kurang.siap).toBe(false);
    expect(kurang.syarat[1].keterangan).toBe(`Baru 10 cetak dibandingkan; kurang ${SYARAT_CETAK - 10}.`);
    const merah = [...penuh, ...baris(1, "merah", `${CG} - BAS`, "2026-11-18T00:00:00.000Z")];
    expect(nilaiKesiapan(gugat, { ukur: ukur(), berdampingan: merah, aktif: false }, KINI)).toMatchObject({ siap: false, merah: 1 });
    // merah yang sudah dijawab pemilik dihitung kuning; harinya dihitung dari cetak pertama (bukan dari merah itu)
    const dijawab = [...penuh, ...baris(1, "merah", CG, "2026-11-18T00:00:00.000Z", "dijelaskan")];
    const k = nilaiKesiapan(gugat, { ukur: ukur(), berdampingan: dijawab, aktif: false }, KINI);
    expect(k).toMatchObject({ siap: true, merah: 0, kuning: 1 });
    const barusan = baris(SYARAT_CETAK, "hijau", CG, "2026-11-15T00:00:00.000Z");
    expect(nilaiKesiapan(gugat, { ukur: ukur(), berdampingan: barusan, aktif: false }, KINI).siap).toBe(false);
  });

  it("cetak jenis lain dan folder asing tidak dihitung untuk keluarga ini; belum diukur tidak dihitung cetak", () => {
    const campur = [...baris(40, "hijau", "1a Perceraian CT", "2026-10-01T00:00:00.000Z"), ...baris(5, "hijau", "Entah", "2026-10-01T00:00:00.000Z"), ...baris(9, "belum-diukur", CG, "2026-10-01T00:00:00.000Z")];
    const k = nilaiKesiapan(gugat, { ukur: ukur(), berdampingan: campur, aktif: false }, KINI);
    expect(k.cetak).toBe(0);
    expect(k.belumDiukur).toBe(9);
    expect(k.siap).toBe(false);
  });

  it("pesan penolakan menyebut syarat yang belum, dengan bahasa sehari-hari", () => {
    const k = nilaiKesiapan(gugat, { ukur: null, berdampingan: [], aktif: false }, KINI);
    const pesan = pesanSyaratBelum(k);
    expect(pesan).toContain("Cerai gugat");
    expect(pesan).toContain("Belum terukur");
    expect(pesan).toContain(`${SYARAT_CETAK} cetak`);
    expect(pesan).not.toMatch(/renderer|md5|skrip|mesin|JSON|API/);
  });

  it("hitungBerdampinganKeluarga: tanpa baris -> nol", () => {
    expect(hitungBerdampinganKeluarga([], KINI)).toEqual({ cetak: 0, hijau: 0, kuning: 0, merah: 0, belumDiukur: 0, hariTanpaMerah: 0 });
  });
});

describe("hasil pengukuran masuk sebagai angka", () => {
  it("menyaring: keluarga asing dibuang, angka negatif/aneh menjadi nol, teks dipotong; bukan hasil pengukur ditolak", () => {
    const l = bersihkanLaporanUkur({
      dibuat: "2026-11-05T10:00:00Z",
      keterangan: "uji",
      keluarga: [
        { kunci: "cerai-gugat", perkara: 5, naskah: "685", alinea: -4, identik: NaN, dijelaskan: 3, belumDijelaskan: 0, isianNilai: 10, isianCocok: 10, sebabBelum: "x".repeat(500), nama: "Tidak Ikut" },
        { kunci: "tidak-ada", perkara: 1 },
        { kunci: "cerai-gugat", perkara: 99 },
      ],
    })!;
    expect(l.keluarga).toHaveLength(1);
    expect(l.keluarga[0]).toMatchObject({ kunci: "cerai-gugat", perkara: 5, naskah: 685, alinea: 0, identik: 0, dijelaskan: 3 });
    expect(l.keluarga[0].sebabBelum.length).toBe(160);
    expect(Object.keys(l.keluarga[0]).sort()).toEqual(["alinea", "belumDijelaskan", "dijelaskan", "identik", "isianCocok", "isianDijelaskan", "isianNilai", "kunci", "naskah", "perkara", "sebabBelum"]);
    expect(bersihkanLaporanUkur(null)).toBeNull();
    expect(bersihkanLaporanUkur({ keluarga: [] })).toBeNull();
    expect(bersihkanLaporanUkur({ keluarga: [{ kunci: "tidak-ada" }] })).toBeNull();
  });
});

describe("perlindungan panel Blangko ABT by Derry Briantono", () => {
  it("selama saklar mati keputusan membuka ALETA ABT selalu tidak, untuk setiap folder blangko dan setiap folder asing", () => {
    const mati = bersihkanSetelanPindah(null);
    for (const k of KELUARGA_PINDAH) for (const f of k.folder) expect(bukaAletaAbtUntukFolder(mati, f, {}), f).toBe(false);
    for (const f of ["", "tidak dikenal", null, undefined, 42, "__proto__"]) expect(bukaAletaAbtUntukFolder(mati, f, {})).toBe(false);
  });

  it("menyala hanya untuk folder keluarga yang menyala; lingkungan ALETA_ABT_PINDAH=0 mematikan semuanya", () => {
    const s = bersihkanSetelanPindah({ keluarga: { "cerai-talak": { aktif: true } } });
    expect(bukaAletaAbtUntukFolder(s, "1a Perceraian CT", {})).toBe(true);
    expect(bukaAletaAbtUntukFolder(s, "1a Perceraian CT - BAS", {})).toBe(true);
    expect(bukaAletaAbtUntukFolder(s, "1 Perceraian CG", {})).toBe(false);
    expect(bukaAletaAbtUntukFolder(s, "1a Perceraian CT", { ALETA_ABT_PINDAH: "0" })).toBe(false);
  });

  it("ekstensi tidak memuat rute atau layar kesiapan pindah (ekstensi-sipp tidak disentuh Tahap 8)", () => {
    const dir = path.join(AKAR, "..", "ekstensi-sipp");
    const berkas = readdirSync(dir).filter((n) => /\.(js|json|html)$/i.test(n));
    expect(berkas.length).toBeGreaterThan(10);
    for (const n of berkas) {
      const isi = readFileSync(path.join(dir, n), "utf8");
      expect(isi.includes("/api/aleta-abt/pindah"), n).toBe(false);
      expect(isi.includes("aleta-abt/kesiapan"), n).toBe(false);
      expect(isi.includes("bukaAletaAbtUntukFolder"), n).toBe(false);
    }
  });

  it("modul pindah tidak dipakai jalur mana pun selain rute dan layarnya sendiri (cetak, panel, BAS massal tidak membacanya)", () => {
    const akarSrc = path.join(AKAR, "src");
    const pemakai: string[] = [];
    const telusuri = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) telusuri(p);
        else if (/\.(ts|tsx)$/.test(e.name) && !p.includes(`${path.sep}test${path.sep}`)) {
          const isi = readFileSync(p, "utf8");
          if (/aleta-abt-pindah/.test(isi)) pemakai.push(path.relative(akarSrc, p).split(path.sep).join("/"));
        }
      }
    };
    telusuri(akarSrc);
    expect(pemakai.sort()).toEqual(
      [
        "app/api/aleta-abt/pindah/route.ts",
        "components/portal/kesiapan-aleta-abt.tsx",
        "server/modules/aleta-abt-pindah/service.ts",
      ].sort()
    );
  });
});

// ─── layanan + pg-mem ───────────────────────────────────────────────────────────────────────────────────────────
async function siapkan() {
  const mem = newDb();
  mem.public.none(SQL_0137);
  mem.public.none("CREATE TABLE IF NOT EXISTS aleta_ekstensi_setelan (pengguna_id TEXT NOT NULL, kunci TEXT NOT NULL, nilai TEXT NOT NULL, diubah_pada TEXT NOT NULL, PRIMARY KEY (pengguna_id, kunci))");
  const { Client } = mem.adapters.createPg();
  const c = new Client();
  await c.connect();
  const ubah = (q: string) => {
    let n = 0;
    return q.replace(/\?/g, () => `$${++n}`);
  };
  const db = {
    queryAll: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows,
    queryOne: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows[0] ?? null,
    run: async (q: string, p: unknown[] = []) => {
      await c.query(ubah(q), p);
    },
  };
  const cetak = async (n: number, folder: string, hasil: string, waktu: string) => {
    for (let i = 0; i < n; i += 1) {
      await db.run("INSERT INTO aleta_abt_berdampingan (id, waktu, folder, hasil) VALUES (?, ?, ?, ?)", [`b-${folder}-${hasil}-${waktu}-${i}`, waktu, folder, hasil]);
    }
  };
  return { db: db as never, cetak, baca: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows as Array<Record<string, unknown>> };
}

const AKTOR = { id: "u1", name: "Derry" };
const LAPORAN = {
  dibuat: "2026-11-05T10:00:00Z",
  keterangan: "uji",
  keluarga: [
    { kunci: "cerai-gugat", perkara: 5, naskah: 685, alinea: 90000, identik: 89000, dijelaskan: 1000, belumDijelaskan: 0, isianNilai: 5000, isianCocok: 5000 },
    { kunci: "cerai-talak", perkara: 5, naskah: 555, alinea: 80000, identik: 79000, dijelaskan: 900, belumDijelaskan: 100, isianNilai: 5000, isianCocok: 4990 },
    { kunci: "hibah", perkara: 0, naskah: 0, sebabBelum: "tidak ada perkara jenis ini di salinan uji" },
  ],
};

describe("layanan saklar", () => {
  it("bawaan: semua mati, belum ada hasil pengukuran, tidak satu pun siap", async () => {
    const { db } = await siapkan();
    const s = await bacaSetelanPindah(db, {});
    expect(Object.values(s.keluarga).every((x) => !x.aktif)).toBe(true);
    const keadaan = await bacaKeadaanPindah(db, KINI, {});
    expect(keadaan.keluarga).toHaveLength(KELUARGA_PINDAH.length);
    expect(keadaan).toMatchObject({ menyala: 0, siap: 0, terukur: 0 });
    expect(keadaan.laporan.ada).toBe(false);
  });

  it("menolak menyala tanpa syarat (409, alasan terbaca), tidak mengubah apa pun, dan mematikan selalu boleh", async () => {
    const { db, baca } = await siapkan();
    await expect(ubahSaklarPindah(db, AKTOR, "cerai-gugat", true, KINI, {})).rejects.toMatchObject({ status: 409 });
    await expect(ubahSaklarPindah(db, AKTOR, "cerai-gugat", true, KINI, {})).rejects.toThrow(/Belum terukur/);
    expect(await baca("SELECT kunci FROM aleta_ekstensi_setelan")).toHaveLength(0);
    await expect(ubahSaklarPindah(db, AKTOR, "tidak-ada", true, KINI, {})).rejects.toMatchObject({ status: 400 });
    // mematikan yang sudah mati: boleh, tanpa syarat
    expect(await ubahSaklarPindah(db, AKTOR, "cerai-gugat", false, KINI, {})).toMatchObject({ keluarga: "cerai-gugat", aktif: false, diubahOleh: "Derry" });
  });

  it("jenis yang belum terukur atau punya beda belum dijelaskan tetap ditolak walau cetak berdampingannya sempurna", async () => {
    const { db, cetak } = await siapkan();
    await simpanLaporanUkur(db, AKTOR, LAPORAN);
    await cetak(35, "1a Perceraian CT", "hijau", "2026-10-01T00:00:00.000Z");
    await cetak(35, "4d Hibah", "hijau", "2026-10-01T00:00:00.000Z");
    await expect(ubahSaklarPindah(db, AKTOR, "cerai-talak", true, KINI, {})).rejects.toThrow(/100 paragraf naskah beda dan belum dijelaskan/);
    await expect(ubahSaklarPindah(db, AKTOR, "hibah", true, KINI, {})).rejects.toThrow(/Belum terukur: tidak ada perkara/);
  });

  it("menyala bila semua syarat terpenuhi, tercatat siapa dan kapan, tidak mengubah jenis lain; lalu dapat dimatikan", async () => {
    const { db, cetak } = await siapkan();
    await simpanLaporanUkur(db, AKTOR, LAPORAN);
    await cetak(31, "1 Perceraian CG", "hijau", "2026-10-01T00:00:00.000Z");
    await cetak(2, "1 Perceraian CG - BAS", "kuning", "2026-10-02T00:00:00.000Z");
    const h = await ubahSaklarPindah(db, AKTOR, "cerai-gugat", true, KINI, {});
    expect(h).toMatchObject({ keluarga: "cerai-gugat", aktif: true, diubahOleh: "Derry", diubahPada: KINI.toISOString() });
    const s = await bacaSetelanPindah(db, {});
    expect(s.keluarga["cerai-gugat"].aktif).toBe(true);
    expect(Object.entries(s.keluarga).filter(([, v]) => v.aktif).map(([k]) => k)).toEqual(["cerai-gugat"]);
    expect(bukaAletaAbtUntukFolder(s, "1 Perceraian CG", {})).toBe(true);
    expect(bukaAletaAbtUntukFolder(s, "1a Perceraian CT", {})).toBe(false);
    const keadaan = await bacaKeadaanPindah(db, KINI, {});
    expect(keadaan).toMatchObject({ menyala: 1, siap: 1, terukur: 2 });
    expect(keadaan.keluarga.find((k) => k.kunci === "cerai-gugat")).toMatchObject({ cetak: 33, kuning: 2, siap: true, aktif: true });
    expect(await ubahSaklarPindah(db, AKTOR, "cerai-gugat", false, KINI, {})).toMatchObject({ aktif: false });
    expect((await bacaSetelanPindah(db, {})).keluarga["cerai-gugat"].aktif).toBe(false);
  });

  it("lingkungan ALETA_ABT_PINDAH=0: menolak menyalakan walau syarat terpenuhi, dan menyala yang tersimpan tidak berlaku", async () => {
    const { db, cetak } = await siapkan();
    await simpanLaporanUkur(db, AKTOR, LAPORAN);
    await cetak(31, "1 Perceraian CG", "hijau", "2026-10-01T00:00:00.000Z");
    await expect(ubahSaklarPindah(db, AKTOR, "cerai-gugat", true, KINI, { ALETA_ABT_PINDAH: "0" })).rejects.toMatchObject({ status: 409 });
    await ubahSaklarPindah(db, AKTOR, "cerai-gugat", true, KINI, {});
    const mati = await bacaSetelanPindah(db, { ALETA_ABT_PINDAH: "0" });
    expect(mati.dimatikanServer).toBe(true);
    expect(mati.keluarga["cerai-gugat"].aktif).toBe(false);
    expect((await bacaKeadaanPindah(db, KINI, { ALETA_ABT_PINDAH: "0" })).menyala).toBe(0);
  });

  it("hasil pengukuran yang bukan hasil pengukur ditolak 400 dan tidak tersimpan; yang sah tersimpan sebagai angka saja", async () => {
    const { db, baca } = await siapkan();
    await expect(simpanLaporanUkur(db, AKTOR, { sembarang: true })).rejects.toMatchObject({ status: 400 });
    await expect(simpanLaporanUkur(db, AKTOR, "teks")).rejects.toMatchObject({ status: 400 });
    expect(await bacaLaporanUkur(db)).toBeNull();
    const r = await simpanLaporanUkur(db, AKTOR, { ...LAPORAN, keluarga: [...LAPORAN.keluarga, { kunci: "wasiat", perkara: 1, naskah: 50, alinea: 100, identik: 100, nama: "Budi Santoso", posita: "isi gugatan rahasia" }] });
    expect(r).toMatchObject({ keluarga: 4, terukur: 3 });
    const tersimpan = JSON.stringify(await baca("SELECT nilai FROM aleta_ekstensi_setelan"));
    expect(tersimpan).not.toContain("Budi");
    expect(tersimpan).not.toContain("rahasia");
  });
});
