// @vitest-environment node
/**
 * ============================================================================
 * 27 OKT 2026 (agen w104) - KAMUS DAN VARIABEL BLANGKO DERRY UNTUK PERKARA SELAIN CERAI
 * ============================================================================
 *
 * Dijaga:
 *   A. benih kamus per jenis (perwalian, wali adhal, harta bersama, izin poligami, asal usul, ekonomi syariah, kewarisan):
 *      pola dan templat baru terdaftar, contoh tersamarkan menghasilkan fakta yang benar;
 *   B. bunyi keluaran "pokok keterangan saksi" (ringkas + lengkap) kini ada untuk SEMUA jenis itu (dahulu hanya itsbat, DK, PAW);
 *   C. label bahasa mudah + pilihan isian (susunIsian) dan penanda "diisi manual" untuk perkara selain cerai;
 *   D. gerbang isian: status sebelum nikah (1002/1003) diukur dengan pembanding makna dan boleh terisi sendiri sampai "cukup";
 *   E. performa: pola dikompilasi sekali (objek RegExp yang sama dipakai ulang) dan tidak ada pola rawan backtracking
 *      (setiap pola benih baru selesai < 50 ms atas posita 20.000 huruf yang sengaja dibuat sukar).
 *
 * Semua contoh memakai nama samaran (Xxxa, Yyyb, ...); tidak ada data pihak sungguhan.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const AKAR = path.resolve(process.cwd(), "..");
const req = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const J = req("./services/deteksiJenisPerkaraService.js") as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const kamus = req("./services/kamusDeteksi.js") as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gerbang = req("./services/gerbangIsian.js") as any;

const kodeBaru: Record<string, string[]> = {
  perwalian: ["perwalian-nomor-akta-kematian", "perwalian-hubungan-anak", "perwalian-anak-wali-atas", "perwalian-ringkas-pokok", "perwalian-lengkap-pokok"],
  "wali-adhol": ["wali-adhol-alasan-tidak-direstui", "wali-adhol-kua-menolak", "wali-adhol-ringkas-pokok", "wali-adhol-lengkap-pokok"],
  "harta-bersama": ["harta-bersama-jumlah-anak", "harta-bersama-tanggal-nikah", "harta-bersama-ringkas-pokok", "harta-bersama-lengkap-pokok"],
  poligami: ["poligami-tanggal-nikah", "poligami-ringkas-pokok", "poligami-lengkap-pokok"],
  "asal-usul": ["asal-usul-ringkas-pokok", "asal-usul-lengkap-pokok"],
  "ekonomi-syariah": ["ekonomi-syariah-jenis-sengketa", "ekonomi-syariah-ringkas-pokok", "ekonomi-syariah-lengkap-pokok"],
  waris: ["kewarisan-ringkas-pokok", "kewarisan-lengkap-pokok"],
  itsbat: ["itsbat-tempat-tinggal-setelah-nikah"],
};

const POSITA_PERWALIAN = [
  "1. Bahwa anak Xxxa bin Yyyb merupakan Keponakan Kandung dari Pemohon dan selama ini Pemohon telah merawat anak tersebut;",
  "2. Bahwa Almh Zzzc binti Wwwd telah meninggal dunia pada tanggal 02 Februari 2026 dikarenakan sakit sesuai Surat Keterangan Kematian Nomor : 7203-KM-23022026-0006 yang dikeluarkan oleh Dinas Kependudukan;",
  "3. Bahwa oleh karena anak tersebut masih di bawah umur maka Pemohon memohon untuk ditetapkan sebagai wali sah dari Xxxa bin Yyyb, Umur 13 tahun, untuk mengurus pencairan dana BPJS Ketenagakerjaan;",
].join("\n");

const POSITA_WALI_ADHOL = [
  "Bahwa Pemohon bermaksud akan melangsungkan pernikahan dengan seorang laki-laki pilihan yang bernama : Xxxa bin Yyyb, umur 46 tahun, agama Islam;",
  "Bahwa Pemohon dan calon suami telah menyampaikan maksud tersebut kepada Saudara kandung Pemohon yang bernama Zzzc bin Wwwd;",
  "Bahwa niat Pemohon tidak mendapatkan restu dari pihak Saudara Kandung karena calon suami Pemohon tidak mampu memenuhi syarat uang mahar;",
].join("\n");

const POSITA_HB = [
  "1. Bahwa Penggugat dan Tergugat telah melangsungkan pernikahan pada hari Rabu, tanggal 27 Agustus 2014, yang dicatat oleh Pegawai Pencatat Nikah;",
  "2. Bahwa dari pernikahan tersebut, Penggugat dan Tergugat telah dikaruniai 3 (tiga) orang anak perempuan;",
  "3. Bahwa selama perkawinan Penggugat dan Tergugat memperoleh sebidang tanah dan rumah di Desa Anu;",
].join("\n");

const POSITA_POLIGAMI = [
  "Bahwa pada tanggal 18 Juli 2022, Pemohon dengan Termohon telah melangsungkan pernikahan, yang dicatat oleh Pegawai Pencatat Nikah;",
  "Bahwa Pemohon hendak menikah lagi dengan seorang perempuan bernama Xxxa binti Yyyb;",
].join("\n");

const POSITA_ASAL_USUL = [
  "Bahwa pada tanggal 12 Juni 2019 Pemohon I dan Pemohon II melangsungkan pernikahan menurut agama Islam di wilayah hukum Kantor Urusan Agama Kecamatan Anu;",
  "Bahwa setelah pernikahan Pemohon I dan Pemohon II hidup rukun dan telah dikaruniai seorang anak yang bernama Xxxa bin Yyyb yang lahir di Anu pada hari Kamis, tanggal 28 November 2019;",
].join("\n");

const POSITA_EKSYAR = "Bahwa Penggugat dan Tergugat membuat perjanjian pembiayaan murabahah untuk pembelian kendaraan dengan akad Nomor 123/MRB/2024;";

const POSITA_KEWARISAN = [
  "Bahwa Xxxa bin Yyyb telah meninggal dunia pada tanggal 06 Mei 2026 karena sakit di Desa Anu, dalam keadaan beragama Islam;",
  "Bahwa pewaris meninggalkan harta peninggalan berupa sebidang tanah;",
].join("\n");

const POSITA_ITSBAT_KONTENSIUS =
  "Bahwa setelah menikah Xxxa bin Yyyb dan Pemohon bertempat tinggal di rumah bersama di Desa Anu, Kecamatan Itu, Kabupaten Sigi; Bahwa dari pernikahan tersebut telah dikaruniai 2 (dua) orang anak;";

const nilaiFakta = (posita: string, jenis: string, alur = "16") => {
  const { fakta } = J.faktaDariPosita(posita, { jenisPerkara: jenis, alur });
  return Object.fromEntries(Object.entries<{ nilai: unknown }>(fakta).map(([k, v]) => [k, String(v.nilai)]));
};

describe("A. benih kamus perkara selain cerai", () => {
  it("pola dan templat baru terdaftar di kelompoknya dan dibaca lewat kamusDeteksi", () => {
    for (const [kelompok, daftar] of Object.entries(kodeBaru)) {
      const ada = new Set([...kamus.polaKelompok(kelompok).map((p: { kode: string }) => p.kode), ...kamus.templatKelompok(kelompok).map((t: { kode: string }) => t.kode)]);
      for (const kode of daftar) expect(ada.has(kode), `${kelompok}/${kode}`).toBe(true);
    }
  });

  it("perwalian: hubungan anak, nomor akta kematian, nama anak dari kalimat wali", () => {
    const n = nilaiFakta(POSITA_PERWALIAN, "354");
    expect(n["fakta-hubungan-anak"]).toBe("Keponakan Kandung");
    expect(n["fakta-nomor-akta-kematian"]).toBe("7203-KM-23022026-0006");
    expect(n["5110"]).toMatch(/^Xxxa bin Yyyb/);
  });

  it("wali adhal: alasan 'tidak mendapatkan restu ... karena ...' berawalan 'karena'", () => {
    const h = J.usulanJenis(POSITA_WALI_ADHOL, { jenisPerkara: "Wali Adhol", alur: 16 });
    const u = Object.fromEntries(h.usulan.map((x: { kode: string; nilai: string }) => [x.kode, x.nilai]));
    expect(u["6087"]).toBe("karena calon suami Pemohon tidak mampu memenuhi syarat uang mahar");
    expect(u["1029"]).toBe("Xxxa bin Yyyb");
    // semua usulan kamus berstatus ragu (tidak tercentang) - tidak ada pola baru yang "pasti"
    for (const x of h.usulan) expect(x.keyakinan).toBe("ragu");
  });

  it("harta bersama, poligami: tanggal nikah, jumlah anak", () => {
    const hb = nilaiFakta(POSITA_HB, "348", "15");
    expect(hb["fakta-tanggal-nikah"]).toMatch(/27 Agustus 2014/);
    expect(hb["fakta-jumlah-anak"]).toBe("3");
    const pg = nilaiFakta(POSITA_POLIGAMI, "341", "15");
    expect(pg["fakta-tanggal-nikah"]).toMatch(/18 Juli 2022/);
  });

  it("itsbat kontensius: tempat tinggal setelah menikah (1006) berupa saran 'ragu'", () => {
    const h = J.usulanJenis(POSITA_ITSBAT_KONTENSIUS, { jenisPerkara: "360", alur: "15" });
    const u = h.usulan.find((x: { kode: string }) => x.kode === "1006");
    expect(u).toBeTruthy();
    expect(u.nilai).toMatch(/^rumah bersama di Desa Anu, Kecamatan Itu, Kabupaten Sigi/);
    expect(u.keyakinan).toBe("ragu");
  });
});

describe("B. bunyi keluaran pokok keterangan saksi untuk semua jenis", () => {
  const kasus: Array<[string, string, string, string, RegExp]> = [
    ["perwalian", POSITA_PERWALIAN, "354", "16", /memohon agar ditetapkan sebagai wali atas anak/],
    ["wali adhal", POSITA_WALI_ADHOL, "363", "16", /namun wali nikahnya enggan menikahkan/],
    ["harta bersama", POSITA_HB, "348", "15", /memperoleh harta bersama/],
    ["izin poligami", POSITA_POLIGAMI, "341", "15", /bermaksud menikah lagi \(poligami\)/],
    ["asal usul anak", POSITA_ASAL_USUL, "358", "16", /lahir seorang anak/],
    ["ekonomi syariah", POSITA_EKSYAR, "370", "17", /membuat akad/],
    ["kewarisan", POSITA_KEWARISAN, "364", "15", /meninggalkan harta peninggalan/],
  ];
  for (const [nama, posita, jenis, alur, pola] of kasus) {
    it(`${nama}: ringkas dan lengkap terbentuk, berkalimat utuh`, () => {
      const k = J.kalimatPokok({ posita, jenisPerkara: jenis, alur });
      expect(k, nama).toBeTruthy();
      expect(k.ringkas).toMatch(/^Bahwa saksi menerangkan .+;$/);
      expect(k.ringkas).toMatch(pola);
      expect(k.lengkap).toMatch(/^- Bahwa /);
      for (const baris of String(k.lengkap).split("\n")) expect(baris, baris).toMatch(/^- Bahwa .+;$/);
      // tidak ada slot tersisa, tanda kurung siku, atau koma/titik ganda
      for (const t of [k.ringkas, k.lengkap]) {
        expect(t).not.toMatch(/\{|\}|\[|\]/);
        expect(t).not.toMatch(/,\s*,|;\s*;|\bdengan,|\bdengan;/);
      }
    });
  }

  it("fakta berkunci 'fakta-xxx' juga tersedia sebagai slot camelCase pada templat (asal usul: nama dan lahir anak lolos gerbang bila terukur)", () => {
    const fakta = { "fakta-nama-anak": { nilai: "Xxxa bin Yyyb" }, "fakta-lahir-anak": { nilai: "28 November 2019" }, "5197": { nilai: "12 Juni 2019" } };
    const k = J.kalimatPokok({ posita: POSITA_ASAL_USUL, jenisPerkara: "358", alur: "16", fakta, tanpaGerbang: true });
    expect(k.ringkas).toContain("bernama Xxxa bin Yyyb");
    expect(k.ringkas).toContain("pada tanggal 28 November 2019");
    expect(k.ringkas).toContain("telah menikah pada tanggal 12 Juni 2019");
  });

  it("slot {wafat} dirangkai dari fakta wafat; tanpa fakta wafat klausa dibuang", () => {
    const fakta = { "1025": { nilai: "Zzzc binti Wwwd" }, "fakta-tanggal-wafat": { nilai: "02 Februari 2026" }, "fakta-sebab-wafat": { nilai: "sakit" }, "5110": { nilai: "Xxxa bin Yyyb" } };
    const k = J.kalimatPokok({ posita: POSITA_PERWALIAN, jenisPerkara: "354", alur: "16", fakta, tanpaGerbang: true });
    expect(k.ringkas).toContain("sebab Zzzc binti Wwwd telah meninggal dunia pada tanggal 02 Februari 2026 karena sakit");
    expect(k.ringkas).toContain("anak bernama Xxxa bin Yyyb");
    const polos = J.kalimatPokok({ posita: POSITA_PERWALIAN, jenisPerkara: "354", alur: "16", fakta: {}, tanpaGerbang: true });
    expect(polos.ringkas).not.toContain("sebab");
  });

  it("templat lama (itsbat, DK, PAW) tetap menghasilkan kalimat", () => {
    expect(J.kalimatPokok({ posita: POSITA_ITSBAT_KONTENSIUS, jenisPerkara: "360", alur: "16" }).ringkas).toMatch(/telah menikah/);
    expect(J.kalimatPokok({ posita: POSITA_KEWARISAN, jenisPerkara: "371", alur: "16" }).ringkas).toMatch(/ahli warisnya/);
  });
});

describe("C. label dan pilihan isian perkara selain cerai", () => {
  const def = (kode: string, nama: string): Definisi => ({ kode, nama, jenis: "data_teks", sql: "", bawaan: "" });
  const kodeUji = ["1002", "1003", "8171", "2029", "2030", "9203", "9161", "8720", "8622", "8623", "0712", "9207", "9167", "8717", "9701"];
  const katalog = new Map<string, Definisi>(kodeUji.map((k) => [k, def(k, `NAMA GENERIK ${k}`)]));
  const hasil = susunIsian(kodeUji, katalog, { P: "Pemohon", T: "Termohon" });
  const per = (k: string) => hasil.isian.find((i) => i.kode === k)!;

  it("isian yang dulu bernama generik kini berlabel bahasa mudah", () => {
    expect(per("1002").nama).toMatch(/^Status Pemohon sebelum menikah/);
    expect(per("9203").nama).toBe("Hubungan wali nasab dengan Pemohon");
    expect(per("8720").nama).toMatch(/^Huruf alasan poligami/);
    expect(per("8717").nama).toMatch(/^Ahli waris pewaris/);
    expect(per("9701").nama).toMatch(/^Pasangan pewaris yang masih hidup/);
    for (const i of hasil.isian) expect(i.nama, i.kode).not.toMatch(/^NAMA GENERIK/);
  });

  it("pilihan bawaan masuk akal (kosakata petugas yang paling sering tersimpan)", () => {
    expect(per("1002").pilihan).toEqual(expect.arrayContaining(["Jejaka", "Perjaka", "Perawan", "Gadis"]));
    expect(per("2029").pilihan).toEqual(expect.arrayContaining(["Jejaka", "Bujang"]));
    expect(per("2030").pilihan).toEqual(expect.arrayContaining(["Perawan", "Gadis"]));
    expect(per("8171").pilihan[0]).toMatch(/buku nikah/);
    expect(per("9203").pilihan).toEqual(expect.arrayContaining(["ayah kandung", "kakek (ayah dari ayah)"]));
    expect(per("9161").pilihan.join("|")).toMatch(/sita jaminan.*sita marital.*sita revindikasi/);
    expect(per("8622").pilihan).toEqual(expect.arrayContaining(["suami istri", "seorang duda", "seorang janda"]));
    expect(per("0712").pilihan).toEqual(["ayah", "ibu"]);
    expect(per("8720").pilihan).toEqual(expect.arrayContaining(["a", "b", "c"]));
  });

  it("isian yang tak mungkin terisi otomatis ditandai 'diisi manual' beserta alasannya", () => {
    for (const k of ["9207", "9167"]) {
      expect(per(k).manual, k).toBe(true);
      expect(per(k).alasanManual, k).not.toBe("");
    }
    expect(per("1002").manual).toBeFalsy();
  });

  it("label yang sudah ada tidak ditimpa dan tidak ada label teknis (nama tabel/kolom/regex)", () => {
    const sumber = readFileSync(path.join(AKAR, "manajemen_surat", "src", "app", "api", "aleta-ecourt", "blangko-derry", "ramah-w104.ts"), "utf8");
    const label = [...sumber.matchAll(/nm:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
    expect(label.length).toBeGreaterThan(80);
    for (const l of label) expect(l, l).not.toMatch(/\b(?:aleta|abt_|sipp_|perkara_pihak|regex|data_teks|SELECT)\b/i);
  });
});

describe("D. gerbang isian: status sebelum nikah diukur dengan pembanding makna", () => {
  it("1002/1003 dari posita boleh terisi sendiri sampai 'cukup' (tidak 'pasti')", () => {
    const u = (kode: string, keyakinan: string) => ({ kode, nilai: "Jejaka", keyakinan, sumber: [{ saksi: 0, asal: "posita", kalimat: "..." }] });
    const daftar = [u("1002", "cukup"), u("1003", "pasti"), u("1002", "ragu")];
    gerbang.terapkan(daftar, { jenis: "360", gerbang: undefined });
    expect(daftar[0].keyakinan).toBe("cukup");
    expect(daftar[1].keyakinan).toBe("cukup"); // paling tinggi cukup
    expect(daftar[2].keyakinan).toBe("ragu");
  });

  it("berkas ukuran makna konsisten dengan ledger dan hanya memuat yang lulus gerbang", () => {
    const makna = JSON.parse(readFileSync(path.join(AKAR, "docs", "isi-sipp-abt", "UKURAN-GERBANG-MAKNA-27OKT.json"), "utf8"));
    const ledger = JSON.parse(readFileSync(path.join(AKAR, "aleta_bot", "config", "gerbang-isian.json"), "utf8"));
    expect(Object.keys(makna.kode).sort()).toEqual(["1002", "1003"]);
    for (const [kode, e] of Object.entries<{ asal: Record<string, { banding: number; cocok: number; status: string }> }>(makna.kode)) {
      const v = e.asal.posita;
      expect(v.banding).toBeGreaterThanOrEqual(20);
      expect(v.cocok / v.banding).toBeGreaterThanOrEqual(0.9);
      expect(ledger.kode[kode].asal.posita).toMatchObject({ status: "otomatis", pangkatMaks: "cukup", banding: v.banding, cocok: v.cocok });
    }
    // yang di bawah gerbang tidak ikut: pendidikan, pekerjaan calon, tujuan permohonan tetap saran
    for (const k of ["0609@sipp", "0610@sipp", "8171@posita"]) expect(makna.tidakLulus[k], k).toBeTruthy();
    expect(ledger.kode["8171"].asal.posita.status).toBe("saran");
  });
});

describe("E. performa dan keamanan pola", () => {
  it("pola dikompilasi sekali dan dipakai ulang (objek RegExp sama)", () => {
    const a = kamus.polaKelompok("perwalian");
    const b = kamus.polaKelompok("perwalian");
    expect(a.length).toBeGreaterThan(5);
    for (let i = 0; i < a.length; i++) expect(a[i].re).toBe(b[i].re);
  });

  it("pola baru tidak rawan backtracking: posita sukar 20.000 huruf diselesaikan cepat", () => {
    const sukar = `${"Bahwa setelah menikah tinggal ".repeat(300)}${"Xxxa Yyyb Zzzc ".repeat(600)}`.slice(0, 20000);
    const baru = new Set(Object.values(kodeBaru).flat());
    for (const kelompok of Object.keys(kodeBaru)) {
      for (const p of kamus.polaKelompok(kelompok)) {
        if (!baru.has(p.kode)) continue;
        const mulai = process.hrtime.bigint();
        p.re.test(sukar);
        const ms = Number(process.hrtime.bigint() - mulai) / 1e6;
        expect(ms, `${p.kode} ${ms.toFixed(1)} ms`).toBeLessThan(50);
      }
    }
  });
});
