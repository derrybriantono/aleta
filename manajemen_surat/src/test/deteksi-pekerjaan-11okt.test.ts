import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * PEKERJAAN (11 Okt 2026, agen 7): pembacaan PNS/POLRI/TNI/BUMN/BUMD yang dinamis.
 *
 * Yang diuji PERILAKUNYA (bukan teks kode):
 *   - kamus kelompok "pekerjaan" lewat kamusDeteksi (lapis database berlaku);
 *   - klasifikasiPekerjaan atas teks pekerjaan NYATA dari SIPP Donggala (NIP dibuang);
 *   - regexSql (Henry Spencer, MariaDB 5.5 satker) SAMA ARTI dengan regex JS, dan ekspresi
 *     CASE dari sqlKategoriPekerjaan - dijalankan oleh peniru SQL kecil, dan bila MySQL laptop ada,
 *     oleh MySQL sungguhan - memberi kategori yang sama dengan JS;
 *   - dariSipp (abtUsulanService) memulangkan pekerjaanPihak;
 *   - kartu panel ABT (blok PEKERJAAN abt.js) dan lajur blangko pihak SIPP (blok PEKERJAAN konten.js) di jsdom.
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
type Apa = any;
const svc: Apa = muat(path.join(AKAR, "aleta_bot/services/pekerjaanPihakService.js"));
const kamus: Apa = muat(path.join(AKAR, "aleta_bot/services/kamusDeteksi.js"));
const benih: Apa = JSON.parse(readFileSync(path.join(AKAR, "aleta_bot/kamus-deteksi/awal/pekerjaan.json"), "utf8"));

afterEach(() => {
  kamus.aturLapisDatabase({ pola: [], templat: [] });
  vi.useRealTimers();
});

/** Teks pekerjaan sungguhan (perkara_pihak1/2 sipp_donggala salinan 9 Okt) -> kategori yang benar menurut pemeriksaan tangan. */
const NYATA: Array<[string, string]> = [
  ["Pegawai Negeri Sipil", "PNS"],
  ["PEGAWAI NEGERI SIPIL ", "PNS"],
  ["POLRI", "POLRI"],
  ["Tentara Nasional Indonesia", "TNI"],
  ["Pegawai BUMN/BUMD", "BUMN"],
  ["Kepala Desa", "DESA"],
  ["PNS", "PNS"],
  ["Pegawai Negeri Sipil (PNS)", "PNS"],
  ["Pegawai Negri Sipil", "PNS"],
  ["Aparatur Sipil Negara", "PNS"],
  ["Aparatur Sipil Negeri", "PNS"],
  ["Pns guru di SDN 24 Dampelas", "PNS"],
  ["CPNS Guru SD Panggalasiang", "PNS"],
  ["PNS (Satuan Pamong Praja Kabupaten Sigi)", "PNS"],
  ["PNS polri di Ditpolair Polda Sulteng", "PNS"],
  ["Bidan (Pegawai Negeri Sipil)", "PNS"],
  ["PPPK (Dinas Pendidikan Luwuk)", "PNS"],
  ["ASN PPPK", "PNS"],
  ["Guru/PPPK", "PNS"],
  ["P3K (Guru SDN 18 Banawa Selatan)", "PNS"],
  ["Pegawai Pemerintahan dengan Perjanjian Kerja (Guru SMAN 1 Rio Pakava, Dinas Pendidikan Provinsi Sulawesi Tengah. NIPPPK. )", "PNS"],
  ["Pegawai Pemerintahan dengan Perjanjian Kerja  Paruh Waktu ( Operatur Layanan  Operasional di Dinas Perindustrian)", "PNS"],
  ["Anggota POLRI", "POLRI"],
  ["Kepolisian RI (POLRI)", "POLRI"],
  ["Anggota POLRI (AIRUD)", "POLRI"],
  ["Karyawan BUMN", "BUMN"],
  ["karyawan pertamina", "BUMN"],
  ["Pegawai Bank BRI", "BUMN"],
  ["Pegawai PT POS", "BUMN"],
  ["Karyawan PT Permodalan Nasioal Madani", "BUMN"],
  ["Karyawan PDAM", "BUMD"],
  ["Karyawan Bank Sulteng Donggala", "BUMD"],
  ["Perangkat Desa Loli Pesua", "DESA"],
  ["Kaur Pemerintahan Kantor Desa Tinggede Selatan", "DESA"],
  ["Sekretaris Desa Batusuya Go'o", "DESA"],
  // penyangkal
  ["Pensiunan PNS", "BUKAN"],
  ["Pensiuanan PNS", "BUKAN"],
  ["Pensiunan TNI AD", "BUKAN"],
  ["Pensiunan POLRI", "BUKAN"],
  ["Mantan PNS", "BUKAN"],
  ["Pegawai PBPNS", "BUKAN"],
  ["Tenaga non ASN", "BUKAN"],
  ["Non-PNS", "BUKAN"],
  ["Honorer", "BUKAN"],
  ["Hononer", "BUKAN"],
  ["Honerer (Guru MTS Al-Khairaat Sigimpu)", "BUKAN"],
  ["Honorer (SATPOL PP KAbupaten Donggala).", "BUKAN"],
  ["Honorarium (RSUD Pendau Tambu)", "BUKAN"],
  ["Tenaga Kontrak di Dinas Kesehatan Kab.Sigi.", "BUKAN"],
  ["Bidan PTT", "BUKAN"],
  ["Buruh Harian Lepas", "BUKAN"],
  ["Polisi Pamong praja", "BUKAN"],
  ["Satpol PP", "BUKAN"],
  ["Karyawan Swasta (PLN Instalasi Listrik)", "BUKAN"],
  ["Swasta (Karyawan Bank BSG)", "BUKAN"],
  ["Security ( Bank Mandiri )", "BUKAN"],
  ["Karyawan (Admin BRI Link)", "BUKAN"],
  ["Operator SPBU ( Pertamina)", "BUKAN"],
  ["Karyawan Kontrak ( PT. Pertamina Lubricants )", "BUKAN"],
  ["Wiraswasta", "BUKAN"],
  // lainnya - sengaja tidak ditebak
  ["Petani", "LAIN"],
  ["Ibu Rumah Tangga", "LAIN"],
  ["Guru SDN 2 Kalukubula", "LAIN"],
  ["Pegawai Badan Kesatuan Bangsa dan Politik", "LAIN"],
  ["Anggota DPRD Kabupaten Donggala", "LAIN"],
  ["Karyawan PT.Mandiri Tunas Finance", "LAIN"],
  ["Honorer ( Guru TK KB Bina Mandiri Lawua )", "BUKAN"],
  ["Bidan Desa", "LAIN"],
  ["Anggota Badan Permusyawaratan Desa Maku", "LAIN"],
  ["Kontraktor", "LAIN"],
  ["Pelaut", "LAIN"],
  ["", "KOSONG"],
  ["   ", "KOSONG"],
];

/** Henry Spencer (MariaDB 5.5) -> RegExp JS: batas kata [[:<:]]/[[:>:]], kelas [[:space:]]. */
function spencerKeJs(s: string): RegExp {
  const js = s
    .split("[[:<:]]").join("(?<![A-Za-z0-9_])(?=[A-Za-z0-9_])")
    .split("[[:>:]]").join("(?<=[A-Za-z0-9_])(?![A-Za-z0-9_])")
    .split("[[:space:]]").join("\\s")
    .split("[:space:]").join("\\s"); // di dalam kurung siku: [[:space:]-] -> [\s-]
  return new RegExp(js, "");
}

describe("kamus kelompok 'pekerjaan' (benih + lapis database)", () => {
  it("termuat lewat kamusDeteksi dengan semua peran; tiap pola punya regexSql tanpa garis miring terbalik", () => {
    const pola = kamus.polaKelompok("pekerjaan");
    expect(new Set(pola.map((p: Apa) => p.peran))).toEqual(new Set(["pilihan", "penyangkal-kuat", "pppk", "penyangkal-lemah", "deteksi"]));
    expect(new Set(pola.map((p: Apa) => p.kunci))).toEqual(new Set(["PNS", "POLRI", "TNI", "BUMN", "BUMD", "DESA", "BUKAN"]));
    for (const p of pola) {
      if (p.peran === "pilihan") expect(Array.isArray(p.samaDengan) && p.samaDengan.length).toBeTruthy();
      else expect(p.regexSql && !/\\/.test(p.regexSql)).toBe(true);
    }
  });

  it("'pasti' hanya bila terukur >= 95% dengan n >= 25 (README); pola n kecil tetap 'ragu'", () => {
    for (const p of benih.pola) {
      // 'pilihan' = pembanding '=' lama (bukan deteksi) - pasti karena hasil lama memang begitu.
      if (p.yakin !== "pasti" || p.peran === "pilihan") continue;
      expect(p.ukur.n, p.kode).toBeGreaterThanOrEqual(25);
      expect(p.ukur.tepat / p.ukur.n, p.kode).toBeGreaterThanOrEqual(0.95);
    }
    const yakin = Object.fromEntries(benih.pola.map((p: Apa) => [p.kode, p.yakin]));
    expect(yakin["pekerjaan-polri"]).toBe("ragu");
    expect(yakin["pekerjaan-bumn"]).toBe("ragu");
    expect(yakin["pekerjaan-pns"]).toBe("pasti");
  });

  it("regexSql SAMA ARTI dengan regex JS atas semua contoh + seluruh teks nyata (huruf kecil, seperti kueri ABT)", () => {
    const teks = [...NYATA.map(([t]) => t), ...benih.pola.flatMap((p: Apa) => [...(p.contohBenar || []), ...(p.contohSalah || [])])];
    for (const p of kamus.polaKelompok("pekerjaan")) {
      if (p.peran === "pilihan") continue;
      const sql = spencerKeJs(p.regexSql);
      for (const t of teks) expect(sql.test(t.toLowerCase()), `${p.kode} :: ${t}`).toBe(p.re.test(t.toLowerCase()));
    }
  });

  it("lapis database berlaku: pola PPPK dinonaktifkan dari Admin -> 'PPPK (Guru)' tidak lagi PNS", () => {
    expect(svc.klasifikasiPekerjaan("PPPK (Guru SDN Berdikari)").kunci).toBe("PNS");
    const asli = benih.pola.find((p: Apa) => p.kode === "pekerjaan-pppk");
    kamus.aturLapisDatabase({ pola: [{ ...asli, kelompok: "pekerjaan", status: "nonaktif" }], templat: [] });
    expect(svc.klasifikasiPekerjaan("PPPK (Guru SDN Berdikari)").kunci).toBe("LAIN");
  });
});

describe("klasifikasiPekerjaan atas teks nyata SIPP", () => {
  it.each(NYATA)("%j -> %s", (teks, harap) => {
    expect(svc.klasifikasiPekerjaan(teks).kunci).toBe(harap);
  });

  it("pilihan SIPP baku (pembanding lama) ditandai pilihanSipp; PPPK disebut asal pppk; penyangkal menyebut golongan + kategori yang disangkal", () => {
    expect(svc.klasifikasiPekerjaan("Pegawai Negeri Sipil")).toMatchObject({ kunci: "PNS", asal: "pilihan", pilihanSipp: true, teksBaku: "Pegawai Negeri Sipil" });
    expect(svc.klasifikasiPekerjaan("ASN Dinas Pendidikan")).toMatchObject({ kunci: "PNS", asal: "teks", pilihanSipp: false, kodePola: "pekerjaan-pns" });
    expect(svc.klasifikasiPekerjaan("PPPK Bidan")).toMatchObject({ kunci: "PNS", asal: "pppk", kodePola: "pekerjaan-pppk", teksBaku: "Pegawai Negeri Sipil" });
    expect(svc.klasifikasiPekerjaan("Pensiunan PNS")).toMatchObject({ kunci: "BUKAN", golongan: "pensiunan", dasar: "PNS" });
    expect(svc.klasifikasiPekerjaan("Istri anggota TNI")).toMatchObject({ kunci: "BUKAN", golongan: "keluarga" });
    expect(svc.klasifikasiPekerjaan("anak polisi")).toMatchObject({ kunci: "BUKAN", golongan: "keluarga" });
    expect(svc.klasifikasiPekerjaan("Karyawan Bank Sulteng")).toMatchObject({ kunci: "BUMD", teksBaku: "Pegawai BUMN/BUMD" });
    expect(svc.klasifikasiPekerjaan(null)).toMatchObject({ kunci: "KOSONG" });
  });

  it("kalimat info untuk panel/lajur", () => {
    expect(svc.kalimatTerbaca("ASN Dinas Pendidikan")).toBe("PNS (dari teks 'ASN Dinas Pendidikan')");
    expect(svc.kalimatTerbaca("PPPK (RS Torabelo)")).toBe("PNS (PPPK, digabung ke PNS) (dari teks 'PPPK (RS Torabelo)')");
    expect(svc.kalimatTerbaca("Pensiunan PNS")).toBe("pensiunan PNS - tidak dibaca sebagai PNS (dari teks 'Pensiunan PNS')");
    expect(svc.kalimatTerbaca("Pegawai Negeri Sipil")).toBe("PNS (teks baku SIPP 'Pegawai Negeri Sipil')");
  });
});

// ── Kueri ABT ────────────────────────────────────────────────────────────

/** Peniru kecil ekspresi CASE dari sqlKategoriPekerjaan: WHEN TRIM(..)='' / x.asli IN (...) / x.t REGEXP '...'. */
function jalankanCase(sql: string, asli: string): string {
  const m = /^CASE (.*) ELSE '(\w+)' END$/.exec(sql);
  if (!m) throw new Error("bentuk CASE tidak dikenal");
  const cabang = m[1].split(/ (?=WHEN )/);
  const t = asli.toLowerCase();
  for (const c of cabang) {
    let x: RegExpExecArray | null;
    if ((x = /^WHEN TRIM\(IFNULL\(x\.asli, ''\)\) = '' THEN '(\w+)'$/.exec(c))) {
      if (!asli.trim()) return x[1];
    } else if ((x = /^WHEN x\.asli IN \((.*)\) THEN '(\w+)'$/.exec(c))) {
      const daftar = x[1].split(/, (?=')/).map((s) => s.slice(1, -1).replace(/''/g, "'"));
      // '=' MySQL latin1_swedish_ci: tanpa beda huruf besar, spasi belakang diabaikan
      if (daftar.some((d) => d.toLowerCase() === asli.replace(/ +$/, "").toLowerCase())) return x[2];
    } else if ((x = /^WHEN x\.t REGEXP '(.*)' THEN '(\w+)'$/.exec(c))) {
      if (spencerKeJs(x[1].replace(/''/g, "'")).test(t)) return x[2];
    } else throw new Error(`cabang tak dikenal: ${c.slice(0, 80)}`);
  }
  return m[2];
}

const MYSQL = "D:/Satker Asal/Website PA Bungku/xampp/mysql/bin/mysql.exe";
const mysqlAda = (() => {
  if (!existsSync(MYSQL)) return false;
  const r = spawnSync(MYSQL, ["-uroot", "-N", "-e", "SELECT 1"], { timeout: 5000 });
  return r.status === 0;
})();

describe("kueri ABT: sqlKategoriPekerjaan (dipakai paket abt-pekerjaan-dinamis untuk 8510/8524/8533/8727)", () => {
  const ekspresi = svc.sqlKategoriPekerjaan("x.asli", "x.t");

  it("aman MariaDB 5.5: tanpa garis miring terbalik, REGEXP Spencer, pilihan baku dibandingkan '=' (IN) seperti kueri lama", () => {
    expect(ekspresi).not.toMatch(/\\/);
    expect(ekspresi).not.toMatch(/\\b|\(\?[:=!<]/);
    expect(ekspresi).toMatch(/^CASE WHEN TRIM\(IFNULL\(x\.asli, ''\)\) = '' THEN 'KOSONG' WHEN x\.asli IN \('Pegawai Negeri Sipil'\) THEN 'PNS'/);
  });

  it("peniru SQL atas ekspresi yang disusun memberi kategori yang SAMA dengan JS untuk semua teks nyata", () => {
    for (const [teks] of NYATA) expect(jalankanCase(ekspresi, teks), teks).toBe(svc.klasifikasiPekerjaan(teks).kunci);
  });

  it.skipIf(!mysqlAda)("MySQL/MariaDB laptop sungguhan menjalankan ekspresinya dan setuju dengan JS (baca saja, tanpa tabel)", () => {
    const pilih = NYATA.map(([teks], i) => {
      const lit = `'${teks.replace(/'/g, "''")}'`;
      return `SELECT ${i} AS i, ${ekspresi} AS k FROM (SELECT ${lit} AS asli, LOWER(CONVERT(${lit} USING utf8)) AS t) x`;
    }).join("\nUNION ALL\n");
    const r = spawnSync(MYSQL, ["-uroot", "--default-character-set=utf8", "-N", "-B"], { input: `${pilih};`, timeout: 20000 });
    expect(String(r.stderr)).toBe("");
    const hasil = new Map(
      String(r.stdout)
        .split(/\r?\n/)
        .filter(Boolean)
        .map((b) => b.split("\t"))
        .map(([i, k]) => [Number(i), k])
    );
    NYATA.forEach(([teks, harap], i) => expect(hasil.get(i), teks).toBe(harap));
  });
});

// ── Bot: dariSipp + bacaPekerjaanPihak ───────────────────────────────────

describe("bot: pekerjaanPihak ikut jawaban 'Isi dari SIPP'", () => {
  it("bacaPekerjaanPihak: pihak pertama & kedua, urut, dengan kategori dan kalimat", async () => {
    const kueri = vi.fn(async () => [
      { pihakKe: 1, urutan: 1, nama: "SITI binti AHMAD", pekerjaan: "PPPK (Guru SDN 2)" },
      { pihakKe: 2, urutan: 1, nama: "BUDI bin HASAN", pekerjaan: "Pensiunan TNI AD" },
    ]);
    const h = await svc.bacaPekerjaanPihak(9001, kueri);
    expect((kueri.mock.calls as Apa)[0][1]).toEqual([9001, 9001]);
    expect(h).toMatchObject([
      { pihakKe: 1, nama: "SITI binti AHMAD", kunci: "PNS", asal: "pppk", kalimat: "PNS (PPPK, digabung ke PNS) (dari teks 'PPPK (Guru SDN 2)')" },
      { pihakKe: 2, kunci: "BUKAN", golongan: "pensiunan", dasar: "TNI" },
    ]);
    expect(await svc.bacaPekerjaanPihak("bukan-angka", kueri)).toEqual([]);
  });

  it("abtUsulanService.dariSipp memulangkan pekerjaanPihak (kueri SIPP ditiru di db.query)", async () => {
    const db: Apa = muat(path.join(AKAR, "aleta_bot/db_config.js"));
    const layanan: Apa = muat(path.join(AKAR, "aleta_bot/services/abtUsulanService.js"));
    const asli = db.query;
    db.query = (sql: string, params: unknown, cb: (e: unknown, r: unknown) => void) => {
      const s = String(sql);
      let r: unknown[] = [];
      if (/FROM perkara p\s+LEFT JOIN perkara_putusan/.test(s)) r = [{ perkara_id: 9001, prodeo: 0, jenisPerkara: "Cerai Gugat", statusPutusan: "", verstek: "", tanggalDaftar: "2026-10-01" }];
      else if (/UNION ALL[\s\S]*perkara_pihak2 a JOIN pihak b/.test(s)) r = [{ pihakKe: 1, urutan: 1, nama: "SITI", pekerjaan: "Aparatur Sipil Negara (BAPPEDA Kabupaten Donggala)" }];
      setImmediate(() => cb(null, r));
    };
    try {
      const j = await layanan.dariSipp("1/Pdt.G/2026/PA.Dgl");
      expect(j.ok).toBe(true);
      expect(j.pekerjaanPihak).toMatchObject([{ pihakKe: 1, kunci: "PNS", asal: "teks", pekerjaan: "Aparatur Sipil Negara (BAPPEDA Kabupaten Donggala)" }]);
    } finally {
      db.query = asli;
    }
  });
});

// ── Ekstensi: kartu panel ABT (abt.js) ───────────────────────────────────

describe("panel ABT: kartu 'Pekerjaan terbaca' (blok PEKERJAAN abt.js)", () => {
  const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/abt.js"), "utf8").replace(/\r\n/g, "\n");
  const a = sumber.indexOf("/* === PEKERJAAN 11 Okt === */");
  const blok = sumber.slice(a, sumber.indexOf("/* === AKHIR PEKERJAAN === */", a));

  function pasang(peta: Record<string, string>) {
    const buatElemen = (tag: string, kelas: string, teks?: string) => {
      const el = document.createElement(tag);
      if (kelas) el.className = kelas;
      if (teks !== undefined && teks !== null) el.textContent = teks;
      return el;
    };
    return new Function("buatElemen", "nilaiVariabel", `${blok}\nreturn { pkGambarPekerjaan };`)(buatElemen, (k: string) => peta[k] || "");
  }

  it("kartu dipanggil soreGambarIsi sesudah lipatan kontak", () => {
    const i = sumber.indexOf('if (typeof k5GambarKontak === "function") k5GambarKontak(w.usulan, data);');
    const j = sumber.indexOf('if (typeof pkGambarPekerjaan === "function") pkGambarPekerjaan(w.usulan, data);');
    expect(i).toBeGreaterThan(0);
    expect(j).toBeGreaterThan(i);
    expect(j - i).toBeLessThan(300);
  });

  it("Lain-Lain yang terbaca PNS: ringkasan menyebut teks + pilihan SIPP, sebutan dua arah, keterangan kalimat izin atasan", () => {
    const p = pasang({ "0046": "Penggugat", "0047": "Tergugat" });
    const wadah = document.createElement("div");
    const pihak = [
      { pihakKe: 1, urutan: 1, nama: "SITI", pekerjaan: "ASN Dinas Pendidikan", ...svc.klasifikasiPekerjaan("ASN Dinas Pendidikan"), kalimat: svc.kalimatTerbaca("ASN Dinas Pendidikan") },
      { pihakKe: 2, urutan: 1, nama: "BUDI", pekerjaan: "Pensiunan PNS", ...svc.klasifikasiPekerjaan("Pensiunan PNS"), kalimat: svc.kalimatTerbaca("Pensiunan PNS") },
    ];
    p.pkGambarPekerjaan(wadah, { sipp: { pekerjaanPihak: pihak } });
    const teks = wadah.textContent || "";
    expect(wadah.querySelector("summary")!.textContent).toBe("Pekerjaan terbaca: PNS (dari teks 'ASN Dinas Pendidikan', pilihan SIPP: Lain-Lain)");
    expect(teks).toContain("Penggugat - SITI: PNS (dari teks 'ASN Dinas Pendidikan', pilihan SIPP: Lain-Lain)");
    expect(teks).toContain("Tergugat - BUDI: pensiunan PNS - tidak dibaca sebagai PNS");
    expect(teks).toContain("Kalimat izin atasan (#8510# duduk perkara, #8524# pertimbangan, #8533# BAS) dipakai untuk PNS");
  });

  it("Penggugat honorer: keterangan bahwa kalimat izin atasan TIDAK dipakai; tanpa data -> tidak ada kartu", () => {
    const p = pasang({ "0046": "Pemohon" });
    const wadah = document.createElement("div");
    p.pkGambarPekerjaan(wadah, { sipp: { pekerjaanPihak: [{ pihakKe: 1, urutan: 1, nama: "A", pekerjaan: "Honorer", ...svc.klasifikasiPekerjaan("Honorer"), kalimat: svc.kalimatTerbaca("Honorer") }] } });
    expect(wadah.textContent).toContain("Pemohon - A: honorer - tidak dibaca sebagai PNS/TNI/POLRI/BUMN/BUMD");
    expect(wadah.textContent).toContain("TIDAK dipakai");
    const kosong = document.createElement("div");
    p.pkGambarPekerjaan(kosong, { sipp: {} });
    expect(kosong.childNodes.length).toBe(0);
  });
});

// ── Ekstensi: lajur blangko pihak SIPP (konten.js) ───────────────────────

describe("lajur 'Pekerjaan terbaca' di blangko Data Pihak SIPP (blok PEKERJAAN konten.js)", () => {
  const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/konten.js"), "utf8").replace(/\r\n/g, "\n");
  const a = sumber.indexOf("/* === PEKERJAAN 11 Okt === */");
  const blok = sumber.slice(a, sumber.indexOf("/* PK mulai */", a));

  function pasang() {
    const jembatan: Apa[] = [];
    const diminta: string[] = [];
    const api = new Function(
      "saksiscanModeUi",
      "saksiscanTampak",
      "saksiscanEl",
      "saksiscanJembatan",
      "alatAmbil",
      `${blok}\nreturn { pkRencana, pkPeriksa };`
    )(
      () => true,
      (el: Apa) => Boolean(el && el.isConnected),
      (tag: string, kelas: string, teks?: string) => {
        const e = document.createElement(tag);
        if (kelas) e.className = kelas;
        if (teks !== undefined && teks !== null) e.textContent = String(teks);
        return e;
      },
      async (pesan: Apa) => {
        jembatan.push(pesan);
        const el = document.querySelector(pesan.penunjuk) as HTMLSelectElement | null;
        if (el) el.value = pesan.nilai;
        return { ok: true };
      },
      // Portal + bot SUNGGUHAN tanpa jaringan: teks dari alamat -> klasifikasi bot.
      async (alamat: string) => {
        diminta.push(alamat);
        const teks = new URL(alamat, "http://x").searchParams.getAll("teks");
        const hasil = teks.map((t) => ({ teks: t, ...svc.klasifikasiPekerjaan(t), kalimat: svc.kalimatTerbaca(t) }));
        return { ok: true, status: 200, json: async () => ({ data: { tersedia: true, hasil } }) };
      }
    );
    return { api, jembatan, diminta };
  }

  function borang(pilihan: string, uraian: string) {
    document.body.innerHTML = `<div id="popup"><form id="frm_ref_pihak"><input id="pihak_fullname" value="SITI">
      <select id="apakahtni"><option value="">Pilih Pekerjaan</option><option value="4">Pegawai BUMN/BUMD</option><option value="3">Pegawai Negeri Sipil</option><option value="5">POLRI</option><option value="1">Tentara Nasional Indonesia</option><option value="2">Lain-Lain</option></select>
      <input id="pihak_pekerjaan" value="${uraian}"></form></div>`;
    (document.querySelector("#apakahtni") as HTMLSelectElement).value = pilihan;
    return document.querySelector("form#frm_ref_pihak") as HTMLFormElement;
  }

  async function tunggu(api: Apa) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-11T08:00:00Z"));
    await api.pkPeriksa();
    vi.setSystemTime(new Date("2026-10-11T08:00:01Z"));
    await api.pkPeriksa();
  }

  it("Lain-Lain + 'PPPK (Guru SDN 2 Banawa)': lajur di LUAR blangko menyebut PNS; tombol mati sampai dicentang; memilih #apakahtni=3 lewat jembatan; Simpan tidak ditekan", async () => {
    const f = borang("2", "PPPK (Guru SDN 2 Banawa)");
    const { api, jembatan, diminta } = pasang();
    await tunggu(api);
    expect(diminta).toEqual(["/aleta/api/aleta-ecourt/pekerjaan-pihak?teks=PPPK+%28Guru+SDN+2+Banawa%29"]);
    const lajur = f.previousElementSibling as HTMLElement;
    expect(lajur.className).toContain("aleta-pk-pekerjaan");
    expect(f.querySelectorAll("[class*='aleta'], [data-aleta]").length).toBe(0);
    expect(lajur.textContent).toContain("Pekerjaan terbaca: PNS (PPPK, digabung ke PNS) (dari teks 'PPPK (Guru SDN 2 Banawa)'), pilihan SIPP: Lain-Lain");
    const tombol = lajur.querySelector("button") as HTMLButtonElement;
    expect(tombol.textContent).toBe('Pilih "Pegawai Negeri Sipil"');
    expect(tombol.disabled).toBe(true);
    tombol.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(jembatan).toEqual([]);
    const centang = lajur.querySelector("input[type=checkbox]") as HTMLInputElement;
    centang.checked = true;
    centang.dispatchEvent(new Event("change"));
    tombol.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(jembatan).toEqual([{ jenis: "isi", penunjuk: "form#frm_ref_pihak #apakahtni", jenisMedan: "pilih", nilai: "3" }]);
    expect((f.querySelector("#apakahtni") as HTMLSelectElement).value).toBe("3");
    expect(jembatan.some((j) => /simpan|submit/i.test(JSON.stringify(j)))).toBe(false);
    // pilihan baku sudah terpilih -> lajur hilang
    await api.pkPeriksa();
    await api.pkPeriksa();
    expect(document.querySelector(".aleta-pk-pekerjaan")).toBeNull();
  });

  it("Anggota Polri -> POLRI (5); Karyawan PDAM -> Pegawai BUMN/BUMD (4); Pensiunan PNS & perangkat desa: keterangan tanpa tombol", () => {
    const { api } = pasang();
    const r = (uraian: string, pilihan: string | null = "2") => api.pkRencana({ pilihan, uraian }, { ...svc.klasifikasiPekerjaan(uraian), kalimat: svc.kalimatTerbaca(uraian) });
    expect(r("Anggota Polri").tombol).toEqual({ nilai: "5", tulisan: "POLRI" });
    expect(r("Karyawan PDAM").tombol).toEqual({ nilai: "4", tulisan: "Pegawai BUMN/BUMD" });
    expect(r("TNI AD").tombol).toEqual({ nilai: "1", tulisan: "Tentara Nasional Indonesia" });
    expect(r("Pensiunan PNS")).toMatchObject({ tampil: true, tombol: null });
    expect(r("Pensiunan PNS").keterangan).toContain("Tetap Lain-Lain");
    expect(r("Perangkat Desa Sipeso")).toMatchObject({ tampil: true, tombol: null });
    expect(r("Petani").tampil).toBe(false);
    expect(r("PNS", "3").tampil).toBe(false); // pilihan baku sudah dipilih
    expect(r("PNS", null)).toMatchObject({ tampil: true, tombol: null }); // blangko tanpa #apakahtni
  });

  it("pilihan baku (Pegawai Negeri Sipil) atau uraian petani: tidak ada lajur dan tidak ada permintaan ke ALETA", async () => {
    borang("3", "");
    const a1 = pasang();
    await tunggu(a1.api);
    expect(document.querySelector(".aleta-pk-pekerjaan")).toBeNull();
    expect(a1.diminta).toEqual([]);
    borang("2", "Petani");
    const a2 = pasang();
    await tunggu(a2.api);
    expect(document.querySelector(".aleta-pk-pekerjaan")).toBeNull();
    expect(a2.diminta).toHaveLength(1);
  });
});
