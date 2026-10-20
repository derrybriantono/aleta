// @vitest-environment node
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * W3a-D (21 Okt 2026): jenis HAK-HAK BEKAS ISTRI / KEWAJIBAN BEKAS SUAMI (SIPP 351, Pdt.G).
 *
 * Yang diuji:
 *   1. deteksi hakBekasIstri.js: fakta tegas (putusan/akta cerai, cara putus, tanggal ikrar, iddah, dukhul) dan tuntutan petitum; penilaian majelis
 *      hanya "ragu"; teks tak berkaitan tidak menghasilkan nilai.
 *   2. katalog saksi hak-bekas-istri.json: lolos periksaKatalog, susunSaksi menghasilkan tanya-jawab sesuai keadaan dan dua saksi tidak sama.
 *   3. paket ABT (python w3aD_uji.py): jumlah berkas, variabel, ISIAN/RAMAH/PETA, isi RTF, dan kueri data_sql dijalankan di MariaDB lokal
 *      (dilewati bila MariaDB lokal tidak ada).
 *
 * BATAS: belum ada satu pun perkara jenis 351 di SIPP (0 perkara); posita di bawah SINTETIS bergaya posita PA Donggala, bukan salinan SIPP.
 */

const require_ = createRequire(import.meta.url);
const REPO = path.resolve(process.cwd(), "..");
type Fakta = { nilai: string; kalimat: string; yakin: string; kodePola: string; asal: string };
type Modul = { kunci: string; jenisPerkaraId: number[]; variabel: Array<{ kode: string; deteksi?: boolean }>; deteksi: (posita: string, opsi?: { petitum?: string }) => Record<string, Fakta>; cocokTeks: (t: string) => boolean };
const modul = require_(path.join(REPO, "aleta_bot/services/deteksi/hakBekasIstri.js")) as Modul;

const POSITA_TALAK = `<ol>
<li>Bahwa Penggugat dan Tergugat adalah bekas suami istri yang menikah pada tanggal 12 Maret 2011 di Kecamatan Banawa;</li>
<li>Bahwa selama menikah Penggugat dan Tergugat telah hidup bersama sebagaimana layaknya suami istri dan dikaruniai 2 (dua) orang anak;</li>
<li>Bahwa perkawinan Penggugat dan Tergugat telah putus karena cerai talak berdasarkan putusan Pengadilan Agama Donggala Nomor 100/Pdt.G/2025/PA.Dgl tanggal 3 Maret 2025 yang telah berkekuatan hukum tetap dan Tergugat mengikrarkan talak pada tanggal 20 Maret 2025, sebagaimana Akta Cerai Nomor 50/AC/2025/PA.Dgl tanggal 25 Maret 2025;</li>
<li>Bahwa Penggugat masih dalam masa iddah dan Penggugat tidak pernah berbuat nusyuz terhadap Tergugat;</li>
<li>Bahwa hak-hak Penggugat sebagai bekas istri belum pernah diputus dalam perkara perceraian tersebut;</li>
</ol>`;

const PETITUM_LENGKAP = `<ol>
<li>Mengabulkan gugatan Penggugat;</li>
<li>Menghukum Tergugat membayar nafkah iddah selama 3 bulan sebesar Rp 1.500.000,00 setiap bulan;</li>
<li>Menghukum Tergugat membayar maskan selama iddah sebesar Rp 500.000,- per bulan selama 3 bulan;</li>
<li>Menghukum Tergugat membayar kiswah selama iddah sebesar Rp 900.000,00;</li>
<li>Menghukum Tergugat membayar mut'ah berupa uang sejumlah Rp. 3.000.000,-;</li>
<li>Menghukum Tergugat membayar nafkah madliyah selama 12 bulan sebesar Rp500.000 per bulan;</li>
<li>Menghukum Tergugat melunasi mahar yang masih terhutang sebesar Rp 5.000.000,00;</li>
<li>Menghukum Tergugat membayar nafkah anak sebesar Rp 1.000.000,00 setiap bulan dengan kenaikan 10% setiap tahun;</li>
<li>Menghukum Tergugat membayar semua kewajiban tersebut paling lambat 30 (tiga puluh) hari sejak putusan berkekuatan hukum tetap;</li>
</ol>`;

describe("deteksi hakBekasIstri (351)", () => {
  it("terdaftar untuk jenis 351 dan variabelnya milik jatah 3740-3789 atau variabel lama yang dipakai ulang", () => {
    expect(modul.jenisPerkaraId).toEqual([351]);
    const baru = modul.variabel.map((v) => Number(v.kode)).filter((n) => n < 9000);
    for (const n of baru) expect(n).toBeGreaterThanOrEqual(3740);
    for (const n of baru) expect(n).toBeLessThanOrEqual(3789);
    expect(modul.variabel.map((v) => v.kode)).toEqual(expect.arrayContaining(["9711", "9712", "9713"]));
  });

  it("membaca fakta tegas dari posita: putusan, akta cerai, cara putus, tanggal ikrar, iddah, dukhul", () => {
    const h = modul.deteksi(POSITA_TALAK);
    expect(h["3740"].nilai).toBe("putusan Nomor 100/Pdt.G/2025/PA.Dgl tanggal 03 Maret 2025 yang telah berkekuatan hukum tetap dan Akta Cerai Nomor 50/AC/2025/PA.Dgl tanggal 25 Maret 2025");
    expect(h["3740"].yakin).toBe("cukup");
    expect(h["3741"].nilai).toBe("cerai talak");
    expect(h["3742"].nilai).toBe("20 Maret 2025");
    expect(h["3744"].nilai).toBe("masih berjalan");
    expect(h["3745"].nilai).toContain("bada al dukhul");
    expect(h["3745"].yakin).toBe("cukup");
    for (const k of ["3740", "3741", "3742", "3744", "3745"]) expect(h[k].kalimat.length).toBeGreaterThan(5);
  });

  it("penilaian majelis (nusyuz, nebis in idem, masa iddah) hanya saran ragu, tidak terisi sendiri", () => {
    const h = modul.deteksi(POSITA_TALAK);
    expect(h["3746"].nilai).toContain("tidak ditemukan bukti bahwa #0046# berbuat nusyuz");
    expect(h["3746"].yakin).toBe("ragu");
    expect(h["3747"].nilai).toContain("belum pernah dituntut dan belum pernah diputus");
    expect(h["3747"].yakin).toBe("ragu");
    const iddah = modul.deteksi("Bahwa Penggugat dalam masa iddah selama 3 (tiga) bulan sejak perceraian.");
    expect(iddah["3743"].yakin).toBe("ragu");
  });

  it("cerai gugat, dukhul qobla, iddah berakhir, putusan sudah memutus hak", () => {
    const h = modul.deteksi(
      "Bahwa perkawinan Penggugat dan Tergugat putus karena cerai gugat berdasarkan Akta Cerai Nomor 7/AC/2024/PA.Dgl tanggal 5 Januari 2024; Penggugat dan Tergugat belum pernah berhubungan sebagaimana suami istri (qobla al dukhul); masa iddah Penggugat telah berakhir; nafkah iddah telah diputus dalam putusan perceraian tersebut.",
    );
    expect(h["3741"].nilai).toBe("cerai gugat");
    expect(h["3740"].nilai).toBe("Akta Cerai Nomor 7/AC/2024/PA.Dgl tanggal 05 Januari 2024");
    expect(h["3742"].yakin).toBe("ragu"); // hanya dari tanggal akta cerai
    expect(h["3744"].nilai).toBe("telah berakhir");
    expect(h["3745"].nilai).toContain("qobla al dukhul");
    expect(h["3747"].nilai).toContain("telah diputus dalam perkara perceraian"); // pilihan nebis in idem, tetap saran ragu
    expect(h["3747"].yakin).toBe("ragu");
  });

  it("dua cara putus yang bertentangan tidak diisi; dukhul bertentangan tidak diisi", () => {
    const h = modul.deteksi("Bahwa pada perkara cerai talak dahulu, kemudian ada cerai gugat lain; telah berhubungan layaknya suami istri tetapi qobla al dukhul.");
    expect(h["3741"]).toBeUndefined();
    expect(h["3745"]).toBeUndefined();
  });

  it("tuntutan petitum: tiap hak dengan jumlahnya, semuanya ragu (tuntutan bukan putusan)", () => {
    const h = modul.deteksi(POSITA_TALAK, { petitum: PETITUM_LENGKAP });
    expect(h["9712"].nilai).toBe("Rp4.500.000,00 (3 bulan x Rp1.500.000,00)");
    expect(h["3751"].nilai).toBe("Rp1.500.000,00 (3 bulan x Rp500.000,00)");
    expect(h["3752"].nilai).toBe("Rp900.000,00");
    expect(h["9713"].nilai).toBe("Rp3.000.000,00");
    expect(h["9711"].nilai).toBe("Rp6.000.000,00 (12 bulan x Rp500.000,00)");
    expect(h["3753"].nilai).toBe("Rp5.000.000,00");
    expect(h["9740"].nilai).toBe("Rp1.000.000,00");
    expect(h["9741"].nilai).toBe("10%");
    expect(h["3756"].nilai).toBe("paling lambat 30 (tiga puluh) hari sejak putusan ini berkekuatan hukum tetap");
    for (const k of ["9712", "3751", "3752", "9713", "9711", "3753", "9740", "9741", "3756"]) {
      expect(h[k].yakin).toBe("ragu");
      expect(h[k].asal).toBe("petitum");
    }
  });

  it("klausa dengan beberapa hak dan satu angka tidak ditebak; dengan angka masing-masing dipecah", () => {
    const satu = modul.deteksi("", { petitum: "Menghukum Tergugat membayar nafkah iddah dan mut'ah sebesar Rp 5.000.000,00" });
    expect(satu["9712"]).toBeUndefined();
    expect(satu["9713"]).toBeUndefined();
    const dua = modul.deteksi("", { petitum: "Menghukum Tergugat membayar nafkah iddah sebesar Rp 4.500.000,00 dan mut'ah sebesar Rp 3.000.000,00" });
    expect(dua["9712"].nilai).toBe("Rp4.500.000,00");
    expect(dua["9713"].nilai).toBe("Rp3.000.000,00");
  });

  it("teks yang tidak berkaitan tidak menghasilkan nilai apa pun", () => {
    expect(modul.deteksi("")).toEqual({});
    expect(modul.deteksi("Bahwa Penggugat dan Tergugat menikah pada tanggal 1 Januari 2010 dan hidup rukun sampai sekarang.")).toEqual({});
    expect(modul.deteksi("Bahwa Tergugat menggadaikan sebidang tanah milik Penggugat dengan sertifikat Nomor 123.", { petitum: "Menyatakan gadai batal" })).toEqual({});
    expect(modul.cocokTeks("gugatan nafkah iddah dan mut'ah bagi bekas istri")).toBe(true);
    expect(modul.cocokTeks("permohonan wali adhal")).toBe(false);
  });
});

describe("katalog saksi hak-bekas-istri", () => {
  const AKAR = path.join(REPO, "ekstensi-sipp");
  const Mesin = require_(path.join(AKAR, "saksi-katalog.js")) as any;
  const kat = JSON.parse(readFileSync(path.join(AKAR, "saksi-katalog", "hak-bekas-istri.json"), "utf8"));
  const KAMUS = process.env.ALETA_ABT_VARIABEL || "D:/aleta-dev/kerja/w3a/abt-variabel-w3a.json";
  const variabelAda: Set<string> | null = existsSync(KAMUS) ? new Set(Object.keys(JSON.parse(readFileSync(KAMUS, "utf8")))) : null;

  it("lolos periksaKatalog tanpa galat dan peringatan", () => {
    const r = Mesin.periksaKatalog(kat, { namaBerkas: "hak-bekas-istri.json", variabelAda });
    expect(r.galat).toEqual([]);
    expect(r.peringatan).toEqual([]);
  });

  it("jenis 351, tidak berebut dengan katalog lain, ringkasan memadai", () => {
    expect(kat.syarat.jenisPerkaraId).toEqual(["351"]);
    const ring = Mesin.ringkasKatalog(kat);
    expect(ring.pertanyaan).toBeGreaterThanOrEqual(30);
    expect(kat.blangkoBas.every((b: any) => b.folder === "1f Hak Bekas Istri - BAS")).toBe(true);
    expect(kat.dasarHukum.filter((d: any) => d.status === "terverifikasi").length).toBeGreaterThanOrEqual(8);
  });

  it("susunSaksi: keadaan menentukan butir; saksi 1 dan 2 tidak pernah menjawab sama", () => {
    const keadaan = { kehadiran: "kontradiktoir", caraPutus: "cerai-talak", hakDituntut: ["nafkah-iddah", "mutah", "mahar"], dukhul: "bada", kemampuanTergugat: "mampu" };
    const hasil = Mesin.susunSaksi(kat, {
      keadaan,
      benih: "55/Pdt.G/2026/PA.Dgl",
      saksi: [{ pihak: "P" }, { pihak: "P" }],
      slot: { waktu: "20 Maret 2025", daftar: "rumah orang tuanya", hubungan: "tetangga", lama: "10 tahun", isi: "menolak", penghasilan: "Rp3.000.000,00", sejak: "Januari 2025", pekerjaan: "petani", peristiwa: "pergi" },
      variabel: (kode: string) => ({ "0046": "Penggugat", "0047": "Tergugat", "0104": "pedagang", "8602": "Fulan" }[kode]),
    });
    expect(hasil.saksi).toHaveLength(2);
    const butir = (i: number) => hasil.saksi[i].baris.map((b: any) => b.butir);
    for (const wajib of ["q-kenal", "q-putus-cerai", "q-cara-talak", "q-dukhul", "q-iddah", "q-nusyuz", "q-belum-diputus", "q-pekerjaan-tergugat", "q-mutah".replace("q-mutah", "q-belum-diberi-mutah"), "q-mahar", "q-penutup"]) {
      expect(butir(0), wajib).toContain(wajib);
    }
    for (const tidak of ["q-cara-gugat", "q-qobla", "q-madliyah-lalai", "q-anak-asuh", "q-terbatas", "q-t-nusyuz", "q-keberadaan-tergugat", "q-tinggal-iddah"]) {
      expect(butir(0), tidak).not.toContain(tidak);
    }
    for (let i = 0; i < hasil.saksi[0].baris.length; i += 1) {
      const a = hasil.saksi[0].baris[i];
      const b = hasil.saksi[1].baris.find((x: any) => x.butir === a.butir);
      if (b && a.jenis === b.jenis) expect(a.jawab, a.butir).not.toBe(b.jawab);
    }
  });

  it("keadaan lain: cerai gugat + qobla + madliyah + hadhanah + verstek; saksi Tergugat mendapat butir bantahan", () => {
    const keadaan = { kehadiran: "verstek", caraPutus: "cerai-gugat", hakDituntut: ["nafkah-madliyah", "biaya-hadhanah", "maskan-kiswah"], dukhul: "qobla", kemampuanTergugat: "terbatas" };
    const hasil = Mesin.susunSaksi(kat, {
      keadaan,
      benih: "56/Pdt.G/2026/PA.Dgl",
      saksi: [{ pihak: "P" }, { pihak: "T" }],
      slot: { waktu: "2025", daftar: "rumah ibunya", hubungan: "saudara", lama: "5 tahun", isi: "tidak peduli", penghasilan: "Rp1.000.000,00", sejak: "2024", pekerjaan: "buruh", peristiwa: "pergi" },
      variabel: (kode: string) => ({ "0046": "Penggugat", "0047": "Tergugat", "0104": "buruh", "8602": "Fulan" }[kode]),
    });
    const b0 = hasil.saksi[0].baris.map((b: any) => b.butir);
    const b1 = hasil.saksi[1].baris.map((b: any) => b.butir);
    for (const ada of ["q-cara-gugat", "q-qobla", "q-madliyah-lalai", "q-madliyah-jumlah", "q-anak-asuh", "q-anak-biaya", "q-terbatas", "q-keberadaan-tergugat", "q-tinggal-iddah"]) expect(b0, ada).toContain(ada);
    for (const tidak of ["q-cara-talak", "q-dukhul", "q-mampu", "q-t-nusyuz"]) expect(b0, tidak).not.toContain(tidak);
    expect(b1).toEqual(expect.arrayContaining(["q-t-sudah-bayar", "q-t-nusyuz", "q-t-penghasilan"]));
    expect(b0).not.toContain("q-t-sudah-bayar");
  });

  it("tidak ada kata Aleta dan rujukan perlu-verifikasi tidak tercetak", () => {
    const mentah = readFileSync(path.join(AKAR, "saksi-katalog", "hak-bekas-istri.json"), "utf8");
    expect(mentah).not.toMatch(/aleta/i);
    const pv = kat.dasarHukum.filter((d: any) => d.status === "perlu-verifikasi").map((d: any) => String(d.rujukan).toLowerCase());
    const keluaran = JSON.stringify({ p: kat.pertanyaan, u: kat.jawabanUmum, c: kat.catatanPetugas }).toLowerCase();
    for (const r of pv) expect(keluaran).not.toContain(r);
  });
});

describe("paket ABT hak-bekas-istri (python w3aD_uji.py)", () => {
  const SKRIP = path.join(REPO, "abt-paket/w3a-blangko-baru-perkawinan/sumber/w3aD_uji.py");
  const jalan = spawnSync("python", ["-X", "utf8", SKRIP], { encoding: "utf8", timeout: 240000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
  let hasil: Record<string, { ok: boolean; detail: string }> = {};
  try {
    const baris = (jalan.stdout || "").trim().split(/\r?\n/).filter((l) => l.startsWith("{"));
    hasil = JSON.parse(baris[baris.length - 1] || "{}");
  } catch {
    hasil = {};
  }

  it("skrip uji python berjalan dan mengembalikan hasil", () => {
    expect(jalan.status, (jalan.stderr || "").slice(0, 800)).toBe(0);
    expect(Object.keys(hasil).length).toBeGreaterThanOrEqual(20);
  });

  it("semua pemeriksaan python lolos (15 putusan, 38 BAS, variabel, ISIAN/RAMAH/PETA, isi RTF, kueri SQL)", () => {
    const gagal = Object.entries(hasil).filter(([, v]) => !v.ok).map(([k, v]) => `${k}: ${v.detail}`);
    expect(gagal).toEqual([]);
  });

  it("kueri SQL ikut diuji bila MariaDB lokal ada (bukan dilewati diam-diam)", () => {
    const mysql = "D:/satker asal/website pa bungku/xampp/mysql/bin/mysql.exe";
    if (!existsSync(mysql)) return; // lingkungan tanpa MariaDB lokal
    expect(hasil["sql-dilewati"], "MariaDB ada tetapi kueri dilewati").toBeUndefined();
    expect(hasil["sql-terbilang-acak"]?.ok).toBe(true);
    expect(hasil["sql-jumlah"]?.ok).toBe(true);
  });
});
