// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it } from "vitest";

import { bolehKasir } from "@/lib/kasir-jurnal";
import {
  ALAMAT_KASIR_PORTAL,
  PERIODE_REKAP,
  barisMassal,
  butirChecklistKasir,
  centangBawaanMassal,
  jalankanMassal,
  kelompokTenggat,
  namaBiayaRingkas,
  rentangPeriode,
  susunRekap,
  type PerkaraHarian,
  type RekapMentah,
} from "@/lib/kasir-otomatis";
import { SAKLAR_TAMPILAN } from "@/lib/tampilan-antrian-sidang";
import { buatPdfRekapKasir } from "@/server/modules/aleta-ecourt/kasir-rekap-pdf";

/**
 * ============================================================================
 * KASIR OTOMATIS 1.189.x (butir 1-5)
 * ============================================================================
 *
 *   ATURAN PER KEADAAN  atas perkara SUNGGUHAN satker yang dianonimkan
 *                       (src/test/kasir-keadaan-nyata.json, dibangkitkan
 *                       aleta_bot/scripts/ukur-kasir-keadaan.js dari
 *                       sipp_donggala 9 Okt 2026): satu perkara per keadaan,
 *                       usulan = baris yang ditulis kasir. Ketepatan per
 *                       keadaan tercatat di berkas yang sama dan dijaga
 *                       ambangnya.
 *   MASSAL              daftar harian bot (perkara gagal tidak menjatuhkan
 *                       yang lain), centang bawaan, simpan berurutan + jeda,
 *                       satu gagal tidak menghentikan, dapat dihentikan.
 *   HAK PERAN           portal (bolehKasir) = ekstensi (alatBolehKasir); rute
 *                       baru memeriksa sendiri.
 *   REKAP               rentang tiap periode (portal = ekstensi), susunRekap,
 *                       rute bot menolak rentang tidak sah.
 *   PDF                 terbentuk, bertabel, berhalaman banyak bila perlu.
 *   PENGINGAT           susunPengingat (bot) -> butir checklist milestone.
 *   EKSTENSI            tab Kasir di jsdom: Lama tidak menggambar; usulan
 *                       per keadaan tersusun sendiri; simpan dua tekanan;
 *                       mode kering hanya pratinjau.
 */

const AKAR = path.resolve(process.cwd(), "..");
const requireBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const kasir = requireBot(path.join(AKAR, "aleta_bot/services/kasirJurnalService.js"));
const rekapBot = requireBot(path.join(AKAR, "aleta_bot/services/kasirRekapService.js"));
const NYATA = JSON.parse(readFileSync(path.join(process.cwd(), "src/test/kasir-keadaan-nyata.json"), "utf8"));

const JENIS_HARI_PUTUSAN = new Set([157, 152, 404, 260, 29, 389, 151, 14]);
const JENIS_PANGGILAN_PERTAMA = new Set([236, 237, 253, 388, 12, 13, 14, 15]);

type Usul = { jenisBiayaId: number; jumlah: number | null; pilih: boolean; sisaOtomatis: boolean };

function urutJenis(x: Array<{ jenisBiayaId: number }>) {
  return x.map((u) => u.jenisBiayaId).sort((a, b) => a - b);
}

// ============================================================================
// 1. ATURAN PER KEADAAN ATAS DATA NYATA
// ============================================================================
describe("1. kasir otomatis per perkara - aturan per keadaan atas jurnal nyata satker", () => {
  const contoh = Object.entries(NYATA.contoh as Record<string, Array<{ saat: string; keadaan: Record<string, unknown>; harap: Array<{ jenisBiayaId: number; jumlah: number }> }>>);

  it("fixture memuat sekurangnya sepuluh keadaan, termasuk contoh pengguna (verstek) dan baru didaftar", () => {
    const kunci = contoh.map(([k]) => k);
    expect(kunci.length).toBeGreaterThanOrEqual(10);
    for (const k of ["verstek", "contradictoir", "cabut", "gugur", "permohonan", "ikrar", "baru-gugatan", "baru-permohonan"]) expect(kunci).toContain(k);
  });

  for (const [kunciKeadaan, daftar] of contoh) {
    it(`${kunciKeadaan}: usulan tercentang = baris yang ditulis kasir (jenis dan jumlah), keadaan terbaca`, () => {
      for (const c of daftar) {
        const k = JSON.parse(JSON.stringify(c.keadaan));
        const hasil = kasir.susunUsulan(k);
        const keadaan = kasir.keadaanPerkara(k);
        if (c.saat === "hari-putusan") {
          expect(keadaan.kunci, kunciKeadaan).toBe(kunciKeadaan);
          const dipilih = (hasil.usulan as Usul[]).filter((u) => u.pilih && (!u.sisaOtomatis || Number(u.jumlah) > 0) && JENIS_HARI_PUTUSAN.has(u.jenisBiayaId));
          expect(urutJenis(dipilih), kunciKeadaan).toEqual(urutJenis(c.harap));
          const jumlah = (x: Array<{ jenisBiayaId: number; jumlah: number | null }>) => x.map((u) => `${u.jenisBiayaId}|${Number(u.jumlah)}`).sort();
          expect(jumlah(dipilih), kunciKeadaan).toEqual(jumlah(c.harap));
          // Sisa panjar selalu baris terakhir dan menghabiskan saldo.
          const sisa = dipilih.find((u) => u.sisaOtomatis);
          if (sisa) expect(hasil.usulan[hasil.usulan.length - 1].sisaOtomatis).toBe(true);
        } else {
          expect(keadaan.kunci).toBe("baru");
          const dipilih = (hasil.usulan as Usul[]).filter((u) => u.pilih && JENIS_PANGGILAN_PERTAMA.has(u.jenisBiayaId));
          expect(urutJenis(dipilih), kunciKeadaan).toEqual(urutJenis(c.harap));
        }
        expect(keadaan.nama.length).toBeGreaterThan(3);
      }
    });
  }

  it("ketepatan per keadaan yang diukur (Jul 2025 - Sep 2026) tidak turun di bawah ambangnya", () => {
    const r = NYATA.ringkas as Record<string, { perkara: number; jenisTepat: number; presisiBaris: number }>;
    const tepat = (k: string) => r[k].jenisTepat / r[k].perkara;
    expect(r.verstek.perkara).toBeGreaterThan(500);
    expect(tepat("verstek")).toBeGreaterThanOrEqual(0.97);
    expect(tepat("permohonan")).toBeGreaterThanOrEqual(0.99);
    expect(tepat("baru-permohonan")).toBeGreaterThanOrEqual(0.98);
    expect(tepat("baru-gugatan")).toBeGreaterThanOrEqual(0.9);
    expect(tepat("cabut")).toBeGreaterThanOrEqual(0.85);
    expect(tepat("ikrar")).toBeGreaterThanOrEqual(0.84);
    expect(tepat("contradictoir")).toBeGreaterThanOrEqual(0.8);
    expect(tepat("gugur")).toBeGreaterThanOrEqual(0.7);
    // Yang diusulkan hampir selalu memang ditulis kasir.
    for (const k of Object.keys(r)) expect(r[k].presisiBaris, k).toBeGreaterThanOrEqual(0.87);
  });

  it("keadaanPerkara: prodeo, baru, persidangan, putus dari hasil sidang, menunggu ikrar", () => {
    const dasar = { perkara: { alurPerkaraId: 15, jenisPerkaraId: 347 }, hariIni: "2026-10-09", pembiayaan: 1, sidang: [], putusan: null };
    expect(kasir.keadaanPerkara({ ...dasar, pembiayaan: 2 }).kunci).toBe("prodeo");
    expect(kasir.keadaanPerkara(dasar).kunci).toBe("baru");
    expect(kasir.keadaanPerkara({ ...dasar, sidang: [{ id: 1, urutan: 1, tanggal: "2026-10-01", dihadiriOleh: 2, ditunda: true, hasil: "panggil" }] }).kunci).toBe("persidangan");
    expect(kasir.keadaanPerkara({ ...dasar, sidang: [{ id: 1, urutan: 1, tanggal: "2026-10-01", dihadiriOleh: 2, ditunda: false, hasil: "putus DIKABULKAN (VERSTEK)" }] }).kunci).toBe("verstek");
    expect(kasir.keadaanPerkara({ ...dasar, putusan: { tanggal: "2026-10-01", statusId: 93, verstek: "T" } }).kunci).toBe("gugur");
    expect(kasir.keadaanPerkara({ ...dasar, putusan: { tanggal: "2026-10-01", statusId: 85, verstek: "T" } }).kunci).toBe("damai");
    const talak = { ...dasar, perkara: { alurPerkaraId: 15, jenisPerkaraId: 346 }, putusan: { tanggal: "2026-10-01", statusId: 62, verstek: "Y" } };
    expect(kasir.keadaanPerkara(talak).kunci).toBe("menunggu-ikrar");
    expect(kasir.keadaanPerkara({ ...talak, ikrar: { tanggal: "2026-10-08" } }).kunci).toBe("ikrar");
    expect(kasir.KEADAAN_KASIR.verstek.lazim).toEqual(["Redaksi", "Meterai", "Biaya Pemberitahuan", "PNBP Relaas Pemberitahuan Putusan Kepada Tergugat", "Pengembalian Sisa Panjar"]);
  });
});

// ============================================================================
// 2. MASSAL SATU HARI
// ============================================================================
describe("2. kasir otomatis massal satu hari", () => {
  const verstek = NYATA.contoh.verstek[0].keadaan;
  const permohonan = NYATA.contoh.permohonan[0].keadaan;

  it("daftarHarian (bot): calon dari sidang/putusan/ikrar/PHS/surat ke Pos; usulan per keadaan; yang lengkap disebut; satu perkara gagal tidak menjatuhkan yang lain", async () => {
    const kueri = async (sql: string, params: unknown[]) => {
      if (/DATE_FORMAT\(NOW\(\)/.test(sql)) return [{ saat: "2026-10-09 10:00:00" }];
      // 13 Okt 2026: jam yang DITULIS ke SIPP = jam SIPP (WIB).
      if (/UTC_TIMESTAMP/.test(sql)) return [{ saat: "2026-10-09 09:00:00" }];
      if (/GROUP_CONCAT\(DISTINCT x\.sebab/.test(sql)) {
        // Surat ke Pos dibaca hari kerja SEBELUMNYA (Kamis 8 Okt untuk Jumat 9 Okt).
        expect(params.slice(0, 5)).toEqual(["2026-10-09", "2026-10-09", "2026-10-09", "2026-10-09", "2026-10-08"]);
        return [
          { perkaraId: 1, sebab: "putusan,sidang" },
          { perkaraId: 2, sebab: "sidang" },
          { perkaraId: 3, sebab: "ikrar" },
        ];
      }
      throw new Error(`kueri tak terduga ${sql.slice(0, 60)}`);
    };
    const lengkap = JSON.parse(JSON.stringify(permohonan));
    // Jurnal yang sudah ditutup: harapannya sudah tertulis.
    let id = 900000;
    for (const h of NYATA.contoh.permohonan[0].harap) {
      lengkap.jurnal.push({ id: (id += 1), jenisBiayaId: h.jenisBiayaId, jenisTransaksi: -1, jumlah: h.jumlah, tanggal: lengkap.hariIni, pihakId: lengkap.pihak[0].pihakId, pihakKe: 1, uraian: "x" });
    }
    const layanan = kasir.buatLayanan({
      kueri,
      tabelAda: async () => true,
      bacaKeadaan: async (pid: number) => {
        if (Number(pid) === 3) throw new Error("SIPP tidak menjawab");
        return { ok: true, keadaan: JSON.parse(JSON.stringify(Number(pid) === 1 ? verstek : lengkap)) };
      },
    });
    const h = await layanan.daftarHarian("2026-10-09");
    expect(h.ok).toBe(true);
    expect(h.jumlahCalon).toBe(3);
    expect(h.perkara.map((p: PerkaraHarian) => p.perkaraId)).toEqual([verstek.perkara.perkaraId]);
    expect(h.perkara[0].keadaan.kunci).toBe("verstek");
    expect(h.perkara[0].sebab).toEqual(["putusan", "sidang"]);
    expect(urutJenis(h.perkara[0].usulan)).toEqual(urutJenis(NYATA.contoh.verstek[0].harap));
    expect(h.lengkap.map((p: { perkaraId: number }) => p.perkaraId)).toEqual([permohonan.perkara.perkaraId]);
    expect(h.gagal).toEqual([{ perkaraId: 3, alasan: "SIPP tidak menjawab" }]);
  });

  const perkara = (id: number, tambahan: Partial<PerkaraHarian> = {}): PerkaraHarian => ({
    perkaraId: id,
    nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`,
    jenisPerkara: "Cerai Gugat",
    sebab: ["putusan"],
    keadaan: { kunci: "verstek", nama: "Putus verstek", lazim: [] },
    saldo: 100000,
    saldoAkhir: 0,
    ditawarkan: 0,
    catatan: [],
    perluPeriksa: false,
    usulan: [
      { kunci: "u1", jenisBiayaId: 157, kategoriId: 13, jenisTransaksi: -1, pihakKe: 1, pihakId: 9, uraian: "Redaksi", jumlah: 10000, tanggal: "2026-10-09", keterangan: "", jurusitaId: 0, peristiwa: "", dasar: "", yakin: "tinggi", pilih: true, perluResi: false, sisaOtomatis: false },
      { kunci: "u2", jenisBiayaId: 29, kategoriId: 6, jenisTransaksi: -1, pihakKe: 2, pihakId: 8, uraian: "Biaya Pemberitahuan/P", jumlah: null, tanggal: "2026-10-09", keterangan: "", jurusitaId: 0, peristiwa: "", dasar: "", yakin: "sedang", pilih: true, perluResi: false, sisaOtomatis: false },
    ],
    ...tambahan,
  });

  it("baris yang dikirim hanya yang tercentang dan berjumlah; perkara yang perlu diperiksa TIDAK dicentang bawaan", () => {
    const p = perkara(1);
    expect(barisMassal(p).map((b) => b.jenisBiayaId)).toEqual([157]);
    expect(centangBawaanMassal(p)).toBe(true);
    expect(centangBawaanMassal(perkara(2, { perluPeriksa: true }))).toBe(false);
  });

  it("simpan berurutan dengan jeda di ANTARA perkara; satu gagal (lempar atau tolak) tidak menghentikan; laporan per perkara", async () => {
    const urutan: string[] = [];
    const daftar = [perkara(1), perkara(2), perkara(3), perkara(4)];
    const hasil = await jalankanMassal(
      daftar,
      async (p) => {
        urutan.push(`kirim ${p.perkaraId}`);
        if (p.perkaraId === 2) throw new Error("ALETA Bot tidak menjawab dalam batas waktu.");
        if (p.perkaraId === 3) return { ok: false, tersimpan: 0, pesan: "1 ditolak" };
        return { ok: true, tersimpan: 2, pesan: "2 baris tersimpan" };
      },
      { jeda: async () => void urutan.push("jeda") }
    );
    expect(urutan).toEqual(["kirim 1", "jeda", "kirim 2", "jeda", "kirim 3", "jeda", "kirim 4"]);
    expect(hasil.map((h) => [h.perkaraId, h.keadaan])).toEqual([
      [1, "tersimpan"],
      [2, "gagal"],
      [3, "gagal"],
      [4, "tersimpan"],
    ]);
    expect(hasil[1].pesan).toMatch(/batas waktu/);
  });

  it("Hentikan: perkara sisanya dilewati dan disebut", async () => {
    let henti = false;
    const hasil = await jalankanMassal([perkara(1), perkara(2), perkara(3)], async (p) => {
      if (p.perkaraId === 1) henti = true;
      return { ok: true, tersimpan: 1, pesan: "ok" };
    }, { berhenti: () => henti });
    expect(hasil.map((h) => h.keadaan)).toEqual(["tersimpan", "dilewati", "dilewati"]);
  });

  it("POST /kasir massal: jejak ALETA berjenis kasir-jurnal-massal (bukan di SIPP)", () => {
    const rute = readFileSync(path.join(AKAR, "aleta_bot/routes/jadwalSidangRoutes.js"), "utf8");
    expect(rute).toMatch(/jenis: badan\.massal === true \? "kasir-jurnal-massal" : "kasir-jurnal"/);
    const portal = readFileSync(path.join(process.cwd(), "src/app/api/aleta-ecourt/sidang/kasir/route.ts"), "utf8");
    expect(portal).toMatch(/const massal = badan\.massal === true/);
    expect("kasir-jurnal-massal".length).toBeLessThanOrEqual(20);
  });
});

// ============================================================================
// 3. HAK PERAN
// ============================================================================
describe("3. hak peran - portal dan ekstensi sepakat", () => {
  const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
  const alat = readFileSync(path.join(EKSTENSI, "panel-alat.js"), "utf8");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://192.168.10.10/SIPP/", runScripts: "outside-only" });
  const w = dom.window as unknown as { eval: (s: string) => unknown; alatBolehKasir: (p: unknown) => boolean | null; alatKasirRentang: (p: string, t: string) => { dari: string; sampai: string } | null };
  (w as unknown as { chrome: unknown }).chrome = {
    runtime: { id: "x", getManifest: () => ({ version: "1" }), getURL: (x: string) => x, sendMessage: () => undefined },
    storage: { local: { get: async () => ({}), set: async () => undefined }, session: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener: () => undefined } },
  };
  w.eval(`${alat}\n;window.alatBolehKasir = alatBolehKasir; window.alatKasirRentang = alatKasirRentang;`);

  it("Kasir, keuangan, Panitera, Panitera Muda, Admin, Super Admin: boleh; Panitera Pengganti, Hakim, Juru Sita: tidak", () => {
    const kasus: Array<[string, string, string[], boolean]> = [
      ["Super Admin", "super-admin", [], true],
      ["Admin", "admin", [], true],
      ["Panitera", "panitera", [], true],
      ["Panitera Muda", "panitera-muda", [], true],
      ["Analis Keuangan", "analis-keuangan", [], true],
      ["Panitera Pengganti", "panitera-pengganti", [], false],
      ["Hakim", "hakim", [], false],
      ["Jurusita", "jurusita", [], false],
    ];
    for (const [nama, roleId, tambahan, boleh] of kasus) {
      expect(bolehKasir({ roleId, positionId: "", additionalRoleIds: tambahan } as never), roleId).toBe(boleh);
      expect(w.alatBolehKasir({ peran: nama }), nama).toBe(boleh);
    }
    // Peran tambahan kasir pada staf biasa: portal boleh; ekstensi mengikuti jawaban server.
    expect(bolehKasir({ roleId: "staf", positionId: "", additionalRoleIds: ["kasir"] } as never)).toBe(true);
    expect(w.alatBolehKasir({ peran: "Staf Pelaksana", bolehKasir: true })).toBe(true);
    expect(w.alatBolehKasir({ peran: "Admin", bolehKasir: false })).toBe(false);
    expect(w.alatBolehKasir(null)).toBeNull();
  });

  it("tiap rute Kasir baru memeriksa hak sendiri (pastikanHakKasir), sipp-konteks & siapa membawa bolehKasir", () => {
    for (const r of ["harian/route.ts", "rekap/route.ts", "rekap/pdf/route.ts", "pengingat/route.ts"]) {
      const isi = readFileSync(path.join(process.cwd(), "src/app/api/aleta-ecourt/sidang/kasir", r), "utf8");
      expect(isi, r).toMatch(/await pastikanHakKasir\(db, actorUserId\)/);
    }
    for (const r of ["src/app/api/aleta-bot/sipp-konteks/route.ts", "src/app/api/aleta-ecourt/ekstensi/siapa/route.ts"]) {
      expect(readFileSync(path.join(process.cwd(), r), "utf8"), r).toMatch(/bolehKasir: bolehKasir\(actor\)/);
    }
  });

  it("saklar Tampilan Jadwal Sidang untuk tombol Kasir harian; tombol lama tetap", () => {
    expect(SAKLAR_TAMPILAN.find((x) => x.kunci === "tombol-kasir-harian")).toBeDefined();
    expect(SAKLAR_TAMPILAN.find((x) => x.kunci === "tombol-kasir")).toBeDefined();
  });

  // ==========================================================================
  // 4. REKAP PER PERIODE
  // ==========================================================================
  it("4. rentang tiap periode (Senin-Minggu, triwulan, semester) - portal = ekstensi", () => {
    expect(rentangPeriode("harian", "2026-10-08")).toMatchObject({ dari: "2026-10-08", sampai: "2026-10-08" });
    expect(rentangPeriode("mingguan", "2026-10-08")).toMatchObject({ dari: "2026-10-05", sampai: "2026-10-11" });
    expect(rentangPeriode("mingguan", "2026-10-11")).toMatchObject({ dari: "2026-10-05", sampai: "2026-10-11" });
    expect(rentangPeriode("bulanan", "2026-02-10")).toMatchObject({ dari: "2026-02-01", sampai: "2026-02-28" });
    expect(rentangPeriode("triwulan", "2026-10-08")).toMatchObject({ dari: "2026-10-01", sampai: "2026-12-31", label: "Triwulan IV 2026" });
    expect(rentangPeriode("semester", "2026-06-30")).toMatchObject({ dari: "2026-01-01", sampai: "2026-06-30", label: "Semester I 2026" });
    expect(rentangPeriode("semester", "2026-07-01")).toMatchObject({ dari: "2026-07-01", sampai: "2026-12-31" });
    expect(rentangPeriode("tahunan", "2026-10-08")).toMatchObject({ dari: "2026-01-01", sampai: "2026-12-31" });
    for (const t of ["2026-01-01", "2026-03-31", "2026-10-04", "2026-12-31", "2028-02-29"]) {
      for (const p of PERIODE_REKAP) {
        const r = rentangPeriode(p, t);
        expect(w.alatKasirRentang(p, t), `${p} ${t}`).toEqual({ dari: r.dari, sampai: r.sampai });
      }
    }
  });
});

const MENTAH: RekapMentah = {
  ok: true,
  dari: "2026-10-01",
  sampai: "2026-10-31",
  perJenis: [
    { jenisBiayaId: 1, nama: "Panjar Biaya Perkara", kategori: "Panjar Perkara", kategoriId: 1, jenisTransaksi: 1, baris: 3, jumlah: 900000, perkara: 3 },
    { jenisBiayaId: 14, nama: "Biaya Panggilan Tergugat/Terlawan/Pelawan/Iklan/Radio/Pengumuman", kategori: "Panggilan", kategoriId: 4, jenisTransaksi: -1, baris: 4, jumlah: 58000, perkara: 3 },
    { jenisBiayaId: 61, nama: "Biaya Pendaftaran/PNBP", kategori: "PNBP", kategoriId: 11, jenisTransaksi: -1, baris: 3, jumlah: 90000, perkara: 3 },
    { jenisBiayaId: 151, nama: "Pengembalian Sisa Panjar", kategori: "Sisa Panjar", kategoriId: 2, jenisTransaksi: -1, baris: 1, jumlah: 52000, perkara: 1 },
  ],
  perPerkara: Array.from({ length: 140 }, (_, i) => ({ perkaraId: i + 1, nomorPerkara: `${i + 1}/Pdt.G/2026/PA.Dgl`, jenisPerkara: "Cerai Gugat", keluar: 1000, masuk: i < 3 ? 300000 : 0, barisKeluar: 1, sisaDikembalikan: i === 0 ? 52000 : 0 })),
  perkaraTerpotong: false,
  perHari: [
    { tanggal: "2026-10-01", keluar: 100000, masuk: 900000, pnbp: 90000, baris: 7 },
    { tanggal: "2026-10-02", keluar: 100000, masuk: 0, pnbp: 0, baris: 4 },
  ],
  setorPnbp: [{ tanggal: "2026-10-01", jumlah: 60000, ntpn: "" }],
  setorTerbaca: true,
};

describe("4-5. rekap, PDF, pengingat", () => {
  it("susunRekap: pengeluaran diurut terbesar, berpersen, bertotal; nama jenis biaya dirapikan; PNBP dan setorannya", () => {
    const r = susunRekap(MENTAH, "bulanan", "Bulanan Oktober 2026");
    expect(r.pengeluaran.map((j) => j.nama)).toEqual(["Biaya Pendaftaran/PNBP", "Biaya Panggilan Tergugat", "Pengembalian Sisa Panjar"]);
    expect(r.totalKeluar).toBe(200000);
    expect(r.totalMasuk).toBe(900000);
    expect(r.totalPnbp).toBe(90000);
    expect(r.pnbpDisetor).toBe(60000);
    expect(r.pengeluaran[0].persen).toBe(45);
    expect(r.sisaDikembalikan).toBe(52000);
    expect(namaBiayaRingkas("PNBP Relaas Pemberitahuan Putusan Kepada Tergugat/Terlawan/Terbantah")).toBe("PNBP Relaas Pemberitahuan Putusan Kepada Tergugat");
  });

  it("rekap bot: rentang tidak sah atau lebih dari setahun ditolak tanpa membaca SIPP", async () => {
    let dibaca = 0;
    const l = rekapBot.buatLayanan({ kueri: async () => (dibaca += 1, []), kueriAleta: async () => [] });
    expect((await l.rekap({ dari: "2026-10-31", sampai: "2026-10-01" })).ok).toBe(false);
    expect((await l.rekap({ dari: "2025-01-01", sampai: "2026-12-31" })).ok).toBe(false);
    expect(dibaca).toBe(0);
    const ok = await l.rekap({ dari: "2026-10-01", sampai: "2026-10-31" });
    expect(ok.ok).toBe(true);
    expect(dibaca).toBe(3);
  });

  it("5. PDF rekap terbentuk: %PDF, berhalaman lebih dari satu untuk 140 perkara, huruf di luar latin1 tidak menjatuhkannya", async () => {
    const r = susunRekap(MENTAH, "bulanan", "Bulanan Oktober 2026 â€“ uji â€œkutipâ€");
    const isi = await buatPdfRekapKasir(r, { dibuat: new Date(2026, 9, 10, 9, 5), olehNama: "Petugas Kasir âœ“" });
    expect(Buffer.from(isi.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    const doc = await PDFDocument.load(isi);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(doc.getTitle()).toContain("Rekap Pengeluaran Kasir");
    // Rekap kosong pun terbentuk (satu halaman, kalimat "tidak ada").
    const kosong = await buatPdfRekapKasir(susunRekap({ ...MENTAH, perJenis: [], perPerkara: [], perHari: [], setorPnbp: [] }, "harian", "Harian"), { dibuat: new Date() });
    expect((await PDFDocument.load(kosong)).getPageCount()).toBe(1);
  });

  it("5. pengingat (bot): sisa panjar, belum dijurnal, panjar kurang, PNBP belum disetor; prodeo dan cerai talak menunggu ikrar dilewati", () => {
    const j = rekapBot.susunPengingat({
      hariIni: "2026-10-09",
      putus: [
        { perkaraId: 1, nomorPerkara: "1/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 347, statusId: 62, tanggalPutusan: "2026-10-01", tanggalIkrar: null, saldo: 50000, adaSisa: 0, adaPutusan: 1, prodeo: 0, adaPanjar: 1 },
        { perkaraId: 2, nomorPerkara: "2/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 347, statusId: 62, tanggalPutusan: "2026-10-09", tanggalIkrar: null, saldo: 0, adaSisa: 1, adaPutusan: 0, prodeo: 0, adaPanjar: 1 },
        { perkaraId: 3, nomorPerkara: "3/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 347, statusId: 62, tanggalPutusan: "2026-10-02", tanggalIkrar: null, saldo: -14500, adaSisa: 0, adaPutusan: 1, prodeo: 0, adaPanjar: 1 },
        { perkaraId: 4, nomorPerkara: "4/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 346, statusId: 62, tanggalPutusan: "2026-10-02", tanggalIkrar: null, saldo: 80000, adaSisa: 0, adaPutusan: 1, prodeo: 0, adaPanjar: 1 },
        { perkaraId: 5, nomorPerkara: "5/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 347, statusId: 62, tanggalPutusan: "2026-10-02", tanggalIkrar: null, saldo: 80000, adaSisa: 0, adaPutusan: 0, prodeo: 2, adaPanjar: 1 },
      ],
      pnbp: [
        { tanggal: "2026-10-01", jumlah: 90000, baris: 9 },
        { tanggal: "2026-10-02", jumlah: 30000, baris: 3 },
      ],
      setor: { ok: true, baris: [{ tanggal: "2026-10-01" }] },
    });
    expect(j.butir.map((b: { jenis: string; perkaraId: number }) => `${b.jenis}:${b.perkaraId}`).sort()).toEqual(
      ["sisa-panjar:1", "belum-dijurnal:2", "panjar-kurang:3", "pnbp-belum-setor:0"].sort()
    );
    // PNBP Jumat 2 Okt disetor paling lambat hari kerja berikutnya: Senin 5 Okt.
    expect(j.butir.find((b: { jenis: string }) => b.jenis === "pnbp-belum-setor").tenggat).toBe("2026-10-05");
    expect(j.ringkas).toMatchObject({ sisaPanjar: 1, belumDijurnal: 1, panjarKurang: 1, pnbpBelumSetor: 1 });

    // Ke checklist milestone (widget ekstensi): kelompok menurut tenggat, kerjakan keuangan SIPP / Kasir portal.
    const butir = butirChecklistKasir(j);
    expect(butir.find((b) => b.jenis === "kasir.sisa-panjar")).toMatchObject({ kelompok: "lewat", perkara: { id: "1" }, kerjakan: { tujuan: "sipp", halaman: "keuangan" } });
    expect(butir.find((b) => b.jenis === "kasir.belum-dijurnal")).toMatchObject({ kelompok: "hari-ini" });
    expect(butir.find((b) => b.jenis === "kasir.pnbp-belum-setor")).toMatchObject({ perkara: null, kerjakan: { tujuan: "aleta", alamat: ALAMAT_KASIR_PORTAL } });
    expect(new Set(butir.map((b) => b.id)).size).toBe(butir.length);
    expect(kelompokTenggat("2026-10-20", "2026-10-09")).toBeNull();
    expect(kelompokTenggat("2026-10-12", "2026-10-09")).toBe("minggu-ini");
  });

  it("5. pengingat ditempel ke checklist milestone hanya bagi yang MENGERJAKANNYA (kasir/keuangan - bukan admin/panitera, 12 Okt), dan alamat portalnya membuka Kasir harian", () => {
    const modul = readFileSync(path.join(process.cwd(), "src/server/modules/aleta-ecourt/checklist-milestone.ts"), "utf8");
    expect(modul).toMatch(/if \(opsi\.tanpaKasir \|\| !bolehPengingatKasir\(aktor\)\) return jawaban;/);
    expect(ALAMAT_KASIR_PORTAL.startsWith("/aleta/")).toBe(true);
    const halaman = readFileSync(path.join(process.cwd(), "src/components/portal/aleta-ecourt-pengguna.tsx"), "utf8");
    expect(halaman).toMatch(/if \(jangkar === "kasir"\) setMenu\("sidang"\)/);
  });
});

// ============================================================================
// 6. EKSTENSI - TAB KASIR DI JSDOM
// ============================================================================
const EKS = path.join(AKAR, "ekstensi-sipp");
const SUMBER = ["panel-alat.js", "basmassal.js"].map((b) => readFileSync(path.join(EKS, b), "utf8").replace(/\r\n/g, "\n")).join("\n;\n");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 4000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(10);
  }
}
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function bukaEkstensi(p: { mode?: string; kering?: boolean; muatUlang?: boolean } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="wadah"></div></body></html>`, {
    url: "http://192.168.10.10/SIPP/perkara_detil_agama/ENC",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: p.mode ?? "baru", modeKering: Boolean(p.kering) };
  w.chrome = {
    runtime: { id: "x", getManifest: () => ({ version: "1.189.0" }), getURL: (x: string) => x, lastError: undefined, sendMessage: (_m: unknown, b?: (x: unknown) => void) => setTimeout(() => b && b({ ok: true }), 0) },
    storage: {
      local: { get: async (k?: string | string[] | null) => Object.fromEntries((k == null ? Object.keys(simpanan) : [k].flat()).filter((x) => x in simpanan).map((x) => [x, simpanan[x]])), set: async () => undefined, remove: async () => undefined },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const k = JSON.parse(JSON.stringify(NYATA.contoh.verstek[0].keadaan));
  const usulan = kasir.susunUsulan(k);
  const minta: Array<{ url: string; cara: string; badan: any }> = [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: string }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    minta.push({ url, cara, badan: opsi?.body ? JSON.parse(opsi.body) : null });
    if (/\/sidang\/kasir\?perkaraId=/.test(url)) {
      return Response.json({
        ok: true,
        data: {
          available: true,
          ok: true,
          perkara: k.perkara,
          hariIni: k.hariIni,
          saldo: usulan.saldo,
          usulan: usulan.usulan,
          catatan: usulan.catatan,
          keadaan: kasir.keadaanPerkara(k),
          akun: { ok: true, username: "kasir", milik: ["kasir"] },
        },
      });
    }
    if (/\/sidang\/kasir\/pengingat/.test(url)) {
      return Response.json({
        ok: true,
        data: {
          available: true,
          ok: true,
          hariIni: "2026-10-09",
          butir: [
            { jenis: "sisa-panjar", perkaraId: 1, nomorPerkara: "1/Pdt.G/2026/PA.Dgl", jenisPerkara: "", tenggat: "2026-10-01", jumlah: 50000, keterangan: "Saldo panjar Rp50.000 belum dikembalikan." },
            { jenis: "pnbp-belum-setor", perkaraId: 0, nomorPerkara: "", jenisPerkara: "", tanggal: "2026-10-08", tenggat: "2026-10-09", jumlah: 90000, keterangan: "PNBP 2026-10-08" },
          ],
          ringkas: {},
        },
      });
    }
    if (/\/sidang\/kasir\/harian/.test(url)) {
      const pilih = (usulan.usulan as Usul[]).filter((u) => u.pilih && (!u.sisaOtomatis || Number(u.jumlah) > 0));
      return Response.json({
        ok: true,
        data: {
          available: true,
          ok: true,
          tanggal: "2026-10-09",
          perkara: [{ perkaraId: k.perkara.perkaraId, nomorPerkara: k.perkara.nomorPerkara, jenisPerkara: "Cerai Gugat", sebab: ["putusan"], keadaan: kasir.keadaanPerkara(k), saldo: usulan.saldo, saldoAkhir: 0, usulan: pilih, ditawarkan: 0, catatan: [], perluPeriksa: false }],
          lengkap: [],
          gagal: [],
          terpotong: false,
          jumlahCalon: 1,
          akun: { ok: true, username: "kasir" },
        },
      });
    }
    if (/\/sidang\/kasir$/.test(url) && cara === "POST") {
      const b = JSON.parse(String(opsi?.body || "{}"));
      if (b.kering) return Response.json({ ok: true, data: { available: true, ok: true, kering: true, rencana: b.baris.map((_: unknown, i: number) => ({ ke: i, pernyataan: [] })), ditolak: [], dilewati: [] } });
      return Response.json({ ok: true, data: { available: true, ok: true, kering: false, hasil: b.baris.map((_: unknown, i: number) => ({ ke: i, keadaan: "tersimpan", pesan: "tersimpan dan terbaca ulang di jurnal SIPP" })), ringkas: { tersimpan: b.baris.length }, ditolak: [], dilewati: [] } });
    }
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  // Tampilan "baru" dari simpanan = mode coba, yang menahan tiap POST (423).
  // Di satker tampilannya diterapkan server; di sini penahannya dilepas seperti
  // uji BAS massal (tahanPost).
  w.eval(`${SUMBER}\n;window.__mode = () => alatUjiMode(); window.__kering = () => alatKeringNyala(); alatCobaMenahan = () => false;`);
  // Modul muat ulang bersama (20 Okt 2026): navigasi ditangkap, jeda hitung mundur dipendekkan.
  const navigasi: string[] = [];
  if (p.muatUlang) {
    w.aletaUjiPindah = (a: string) => void navigasi.push(a);
    w.eval(readFileSync(path.join(EKS, "muat-ulang-sipp.js"), "utf8"));
    w.aletaMuatUlangSipp.konf.jeda = 250;
  }
  return { w, minta, wadah: w.document.getElementById("wadah") as HTMLElement, k, usulan, navigasi };
}

describe("6. ekstensi - tab Kasir (basmassal.js IIFE)", () => {
  it("tampilan Lama: pulang false, tidak menggambar dan tidak meminta apa pun", async () => {
    const h = bukaEkstensi({ mode: "lama" });
    await tunggu(30);
    expect(await h.w.aletaKasirPasang(h.wadah, { perkaraId: "1" })).toBe(false);
    expect(await h.w.aletaKasirPasangHarian(h.wadah, {})).toBe(false);
    expect(h.wadah.innerHTML).toBe("");
    expect(h.minta.filter((m) => m.url.includes("/kasir"))).toEqual([]);
  });

  it("Baru: usulan menurut keadaan (verstek) tersusun sendiri; Simpan dua tekanan -> satu POST kering:false atas akun SIPP petugas", async () => {
    const h = bukaEkstensi();
    await sampai(() => h.w.__mode() === "baru", "mode baru");
    expect(await h.w.aletaKasirPasang(h.wadah, { perkaraId: String(h.k.perkara.perkaraId) })).toBe(true);
    await sampai(() => h.wadah.querySelector(".aleta-kasir-keadaan"), "keadaan");
    expect(h.wadah.textContent).toContain("Keadaan: Putus verstek");
    // 28 Okt 2026: yang lazim di balik ikon (i), bukan baris teks.
    const ikonLazim = h.wadah.querySelector('.aleta-kasir-info[title*="Lazim pada keadaan ini"]') as HTMLElement;
    expect(ikonLazim.title).toContain("Redaksi, Meterai, Biaya Pemberitahuan");
    expect(h.wadah.textContent).not.toContain("Lazim pada keadaan ini");
    const tercentang = (h.usulan.usulan as Usul[]).filter((u) => u.pilih && (!u.sisaOtomatis || Number(u.jumlah) > 0)).length;
    expect(h.wadah.querySelectorAll(".aleta-kasir-tabel input[type=checkbox]:checked").length).toBe(tercentang);
    const simpan = Array.from(h.wadah.querySelectorAll("button")).find((b) => /Simpan ke SIPP/.test(b.textContent || "")) as HTMLButtonElement;
    simpan.click();
    await tunggu(20);
    expect(h.minta.filter((m) => m.cara === "POST")).toEqual([]);
    expect(simpan.textContent).toMatch(/Tekan sekali lagi/);
    simpan.click();
    await sampai(() => h.minta.some((m) => m.cara === "POST"), "POST");
    const post = h.minta.filter((m) => m.cara === "POST");
    expect(post.length).toBe(1);
    expect(post[0].badan).toMatchObject({ perkaraId: String(h.k.perkara.perkaraId), akunSipp: "kasir", kering: false });
    expect(post[0].badan.baris.length).toBe(tercentang);
    await sampai(() => /tersimpan dan terbaca ulang/.test(h.wadah.textContent || ""), "kabar tersimpan");
    expect(JSON.stringify(post[0].badan)).not.toMatch(/aleta/i);
  });

  it("20 Okt: Simpan per perkara berhasil -> ringkasan lalu muat ulang OTOMATIS sekali, tetap di halaman itu", async () => {
    const h = bukaEkstensi({ muatUlang: true });
    await sampai(() => h.w.__mode() === "baru", "mode baru");
    await h.w.aletaKasirPasang(h.wadah, { perkaraId: String(h.k.perkara.perkaraId) });
    await sampai(() => h.wadah.querySelector(".aleta-kasir-keadaan"), "keadaan");
    const simpan = Array.from(h.wadah.querySelectorAll("button")).find((b) => /Simpan ke SIPP/.test(b.textContent || "")) as HTMLButtonElement;
    simpan.click();
    await tunggu(20);
    simpan.click();
    const notis = await sampai(() => h.wadah.querySelector('[data-mu="muat-ulang"]') as HTMLElement | null, "kotak muat ulang");
    expect(notis.textContent).toContain("Kasir tersimpan di jurnal SIPP.");
    expect(notis.textContent).toMatch(/disegarkan dalam \d+ detik/);
    expect(h.navigasi).toEqual([]);
    await sampai(() => h.navigasi.length === 1, "memuat ulang");
    await tunggu(500);
    expect(h.navigasi).toEqual(["http://192.168.10.10/SIPP/perkara_detil_agama/ENC"]);
    expect(h.wadah.textContent).not.toContain("Muat ulang halaman SIPP");
  });

  it("20 Okt: Kasir massal - TIDAK memuat ulang di tengah antrean; SEKALI di akhir", async () => {
    const h = bukaEkstensi({ muatUlang: true });
    await sampai(() => h.w.__mode() === "baru", "mode baru");
    await h.w.aletaKasirPasangHarian(h.wadah, { situs: "sipp" });
    const massal = Array.from(h.wadah.querySelectorAll("details")).find((d) => /Kasir Manual/.test(d.querySelector("summary")?.textContent || "")) as HTMLDetailsElement;
    massal.open = true;
    massal.dispatchEvent(new h.w.Event("toggle"));
    await sampai(() => massal.querySelector(".aleta-basmassal-baris input[type=checkbox]:checked"), "perkara tercentang");
    const simpan = Array.from(massal.querySelectorAll("button")).find((b) => /Simpan 1 perkara/.test(b.textContent || "")) as HTMLButtonElement;
    simpan.click();
    await tunggu(10);
    (Array.from(massal.querySelectorAll("button")).find((b) => /Tekan sekali lagi/.test(b.textContent || "")) as HTMLButtonElement).click();
    await sampai(() => /Selesai: 1 perkara berhasil/.test(massal.textContent || ""), "laporan");
    const notis = await sampai(() => massal.querySelector('[data-mu="muat-ulang"]') as HTMLElement | null, "kotak muat ulang di akhir");
    expect(notis.textContent).toContain("Kasir Manual selesai.");
    expect(h.minta.filter((m) => m.cara === "POST").length).toBe(1);
    await sampai(() => h.navigasi.length === 1, "memuat ulang sekali");
    await tunggu(500);
    expect(h.navigasi.length).toBe(1);
  });

  it("mode kering: Simpan tidak mengirim apa pun - yang akan disimpan disebut", async () => {
    const h = bukaEkstensi({ kering: true });
    await sampai(() => h.w.__mode() === "baru" && h.w.__kering() === true, "mode baru + kering");
    await h.w.aletaKasirPasang(h.wadah, { perkaraId: String(h.k.perkara.perkaraId) });
    await sampai(() => h.wadah.querySelector(".aleta-kasir-keadaan"), "keadaan");
    const simpan = Array.from(h.wadah.querySelectorAll("button")).find((b) => /Simpan/.test(b.textContent || "")) as HTMLButtonElement;
    expect(simpan.textContent).toMatch(/mode kering/);
    simpan.click();
    await sampai(() => /Mode kering menyala/.test(h.wadah.textContent || ""), "kabar kering");
    expect(h.wadah.textContent).toContain("Redaksi");
    expect(h.minta.filter((m) => m.cara === "POST")).toEqual([]);
  });

  it("Kasir harian: pengingat terbaca sendiri; massal dibaca saat dibuka, tercentang bawaan, Simpan dua tekanan -> POST massal:true", async () => {
    const h = bukaEkstensi();
    await sampai(() => h.w.__mode() === "baru", "mode baru");
    expect(await h.w.aletaKasirPasangHarian(h.wadah, { situs: "sipp" })).toBe(true);
    await sampai(() => /Kembalikan sisa panjar \(1\)/.test(h.wadah.textContent || ""), "pengingat");
    expect(h.wadah.textContent).toContain("Setor PNBP ke kas negara (1)");
    expect(h.minta.some((m) => m.url.includes("/kasir/harian"))).toBe(false);
    const massal = Array.from(h.wadah.querySelectorAll("details")).find((d) => /Kasir Manual/.test(d.querySelector("summary")?.textContent || "")) as HTMLDetailsElement;
    massal.open = true;
    massal.dispatchEvent(new h.w.Event("toggle"));
    await sampai(() => massal.querySelector(".aleta-basmassal-baris input[type=checkbox]:checked"), "perkara tercentang");
    expect(massal.textContent).toContain("Putus verstek");
    const simpan = Array.from(massal.querySelectorAll("button")).find((b) => /Simpan 1 perkara/.test(b.textContent || "")) as HTMLButtonElement;
    simpan.click();
    await tunggu(10);
    expect(h.minta.filter((m) => m.cara === "POST")).toEqual([]);
    (Array.from(massal.querySelectorAll("button")).find((b) => /Tekan sekali lagi/.test(b.textContent || "")) as HTMLButtonElement).click();
    await sampai(() => h.minta.some((m) => m.cara === "POST"), "POST massal");
    expect(h.minta.filter((m) => m.cara === "POST")[0].badan).toMatchObject({ massal: true, kering: false });
    // 28 Okt 2026: akun SIPP tidak dikirim - server menentukan AKUN KASIR.
    expect(h.minta.filter((m) => m.cara === "POST")[0].badan).not.toHaveProperty("akunSipp");
    await sampai(() => /Selesai: 1 perkara berhasil/.test(massal.textContent || ""), "laporan");
    // Rekap: mingguan s.d. tahunan diciutkan.
    const periode = Array.from(h.wadah.querySelectorAll("details[data-periode]")) as HTMLDetailsElement[];
    expect(periode.map((d) => [d.getAttribute("data-periode"), d.open])).toEqual([
      ["harian", true],
      ["mingguan", false],
      ["bulanan", false],
      ["triwulan", false],
      ["semester", false],
      ["tahunan", false],
    ]);
  });

  it("konten.js: tab Kasir (T7_TAB, MPS_KELOMPOK), dibuka saat tab Biaya Perkara SIPP ditekan, dan bagian Kasir di daftar perkara", () => {
    const konten = readFileSync(path.join(EKS, "konten.js"), "utf8");
    expect(konten).toMatch(/\["kasirKel", "Kasir"\]/);
    expect(konten).toMatch(/kasir: "kasirKel"/);
    expect(konten).toMatch(/a\[href\$="#tabs11"\]/);
    expect(konten).toMatch(/data-mps-massal", "kasir-harian"/);
    expect(konten).toMatch(/penggunaTerakhir\.bolehKasir = isi\.bolehKasir/);
  });
});
