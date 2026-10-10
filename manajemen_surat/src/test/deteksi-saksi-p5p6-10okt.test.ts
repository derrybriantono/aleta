// @vitest-environment node
/**
 * ============================================================================
 * 10 OKT 2026 - P5 DETEKSI IDENTITAS & HUBUNGAN SAKSI, P6 RANGKAIAN KATA
 * ============================================================================
 *
 *   A. Benih kamus agen 2 (saksi-hubungan, saksi-identitas, kalimat-saksi):
 *      contoh cocok/tidak cocok, "pasti" hanya dengan ukuran >= 95% n >= 30.
 *   B. Hubungan dari KALIMAT jawaban saksi: jebakan "sebagai suami Penggugat",
 *      frasa bertingkat tidak dikenali, lalu kesepakatan atas pasangan NYATA
 *      jawaban kenal ABT - Keterangan saksi SIPP (fixtures/deteksi-saksi-p5p6.json,
 *      sampel tak berat sebelah dari tools/ukur-deteksi-saksi.js).
 *   C. Lapis database kamus: pola baru dikenali, "nonaktif" mematikan benih.
 *   D. Baris identitas gaya putusan diurai per medan; sumpah/janji.
 *   E. Paragraf: gaya lengkap = blangko putusan derry (identitas di awal,
 *      "- Bahwa ..." seperti cetakan ABT), gaya ringkas satu paragraf;
 *      penutup "Sudah cukup" dibuang; sebutan salah dibetulkan; petik utuh.
 *   F. Peringatan ringan: satu saksi, di bawah umur, syiqaq bukan keluarga.
 *   G. Rute /abt/usulan SUNGGUHAN: saksiSdg membawa paragrafSaksi +
 *      peringatanSaksi, tanya-jawab tidak berubah.
 *   H. Ekstensi abt.js: pengalih Ringkas/Lengkap dan daftar peringatan (jsdom).
 *   I. Ekstensi saksiscan.js: kamus hubungan memperkaya tebakan jenis kelamin
 *      dan usulan alamat, tanpa kamus perilaku lama tetap.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../..");
const BOT = path.join(AKAR, "aleta_bot");
const requireBot = createRequire(path.join(BOT, "package.json"));

type Hub = { kunci: string; golongan: string; jk: string; kode: string; yakin: string; yakinGolongan?: string } | null;
type Pola = {
  kode: string;
  kunci: string;
  jenis?: string;
  regex: string;
  flags?: string;
  status: string;
  yakin: string;
  contohBenar?: string[];
  contohSalah?: string[];
  ukur: { n: number; tepat: number; salahTangkap: number };
};
type Paragraf = {
  label: string;
  pihak: string;
  urutPihak: number;
  lengkap: string;
  ringkas: string;
  identitas: { umur: number | null; nama: string; sumpah: string };
  hubungan: { teks: string; kunci: string; golongan: string; asal: string; sebutanSalah?: string; kodePola: string } | null;
  dibuangPenutup: number;
  kodePola: string;
  kodePolaGaya: { lengkap: string; ringkas: string };
};
type Peringatan = { kode: string; tingkat: string; pesan: string; saksi?: string; kodePola?: string };

const kamus = requireBot("./services/kamusDeteksi") as {
  polaKelompok: (k: string) => (Pola & { re: RegExp })[];
  templatKelompok: (k: string) => { kode: string; teks: string; gaya?: string }[];
  aturLapisDatabase: (x: { pola?: unknown[]; templat?: unknown[] }) => void;
  lupakan: () => void;
};
const d = requireBot("./services/deteksiSaksiService") as {
  deteksiHubungan: (t: string, o?: { bentuk?: string }) => Hub;
  deteksiIdentitas: (t: string) => {
    nama: string;
    umur: number | null;
    agama: string;
    pendidikan: string;
    pekerjaan: string;
    alamat: string;
    hubungan: { teks: string; kunci?: string } | null;
    disumpah: boolean | null;
    bawahUmur: boolean | null;
  };
  hubunganSetara: (a: string, b: string) => boolean;
  kamusHubunganRingkas: () => { dasar: string; golongan: string; jk: string; regex: string }[];
  umurPada: (a: unknown, b: unknown) => number | null;
  isiTemplat: (t: string, n: Record<string, unknown>) => string;
  susunParagrafSaksi: (s: unknown, id: unknown, o?: Record<string, unknown>) => Paragraf;
  peringatanSaksi: (p: Paragraf[], o?: Record<string, unknown>) => Peringatan[];
  lengkapiSusunan: (h: unknown, o?: Record<string, unknown>) => { paragrafSaksi: Paragraf[]; peringatanSaksi: Peringatan[]; identitasAsal: string };
};
const { kelompokTanya } = requireBot("./services/pemilihRagam") as { kelompokTanya: (t: string) => { kelompok: string } };
const layananSaksi = requireBot("./services/abtUsulanService") as { susunKeteranganSaksiSdg: (o: unknown) => any };

const NYATA = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "deteksi-saksi-p5p6.json"), "utf8")) as {
  ringkasan: { keduanya: number; setara: number; golonganSama: number };
  pasangan: { jawaban: string; label: string }[];
};

afterEach(() => kamus.lupakan());

// ============================================================================
// A. BENIH
// ============================================================================
describe("A. benih kamus agen 2", () => {
  const KELOMPOK = ["saksi-hubungan", "saksi-identitas"];

  it("tiap contohBenar cocok dan tiap contohSalah tidak cocok", () => {
    for (const g of KELOMPOK) {
      const pola = kamus.polaKelompok(g);
      expect(pola.length, g).toBeGreaterThan(5);
      for (const p of pola) {
        for (const c of p.contohBenar || []) expect(p.re.test(c), `${p.kode} harus cocok: ${c}`).toBe(true);
        for (const c of p.contohSalah || []) expect(p.re.test(c), `${p.kode} tidak boleh cocok: ${c}`).toBe(false);
      }
    }
  });

  it('status: belum terukur (n=0) = "draf", terukur = "aktif"', () => {
    for (const g of KELOMPOK) {
      const benih = JSON.parse(readFileSync(path.join(BOT, "kamus-deteksi", "awal", `${g}.json`), "utf8")) as { pola: Pola[] };
      for (const p of benih.pola) expect(p.status, p.kode).toBe(p.ukur.n > 0 ? "aktif" : "draf");
      expect(benih.pola.some((p) => p.status === "draf")).toBe(g === "saksi-identitas" || g === "saksi-hubungan");
    }
  });

  it('"pasti" HANYA dengan ukuran atas data nyata: n >= 30 dan tepat >= 95%', () => {
    let pasti = 0;
    for (const g of KELOMPOK) {
      for (const p of kamus.polaKelompok(g)) {
        expect(["pasti", "ragu", "draf"]).toContain(p.yakin);
        expect(p.ukur.tepat + p.ukur.salahTangkap).toBe(p.ukur.n);
        if (p.yakin === "pasti") {
          pasti += 1;
          expect(p.ukur.n, p.kode).toBeGreaterThanOrEqual(30);
          expect(p.ukur.tepat / p.ukur.n, p.kode).toBeGreaterThanOrEqual(0.95);
        }
      }
    }
    expect(pasti).toBeGreaterThan(0);
  });

  it("templat kalimat-saksi memuat kedua gaya dan bagian pembuka/kenal/fakta/upaya/penutup", () => {
    const t = kamus.templatKelompok("kalimat-saksi");
    const kode = t.map((x) => x.kode);
    for (const k of ["saksi-pembuka-lengkap", "saksi-pembuka-ringkas", "saksi-kenal", "saksi-fakta-pisah", "saksi-upaya-damai", "saksi-penutup-tanggapan"]) {
      expect(kode).toContain(k);
    }
    expect(t.find((x) => x.kode === "saksi-pembuka-lengkap")!.gaya).toBe("lengkap");
    expect(t.find((x) => x.kode === "saksi-pembuka-ringkas")!.gaya).toBe("ringkas");
  });
});

// ============================================================================
// B. HUBUNGAN DARI KALIMAT
// ============================================================================
describe("B. hubungan dari jawaban saksi", () => {
  it("jawaban kenal yang menyebut hubungan SAKSI dikenali", () => {
    const h = (t: string) => d.deteksiHubungan(t, { bentuk: "kalimat" });
    expect(h("Saya kenal dengan Penggugat karena saya adalah Ibu Kandung Penggugat;")).toMatchObject({ kunci: "Ibu Kandung", golongan: "keluarga", jk: "P" });
    expect(h("Ya, saya kenal dengan Penggugat dan Tergugat karena saya adalah ipar Penggugat.;")!.kunci).toBe("Ipar");
    expect(h("Saya kenal dengan Pemohon karena saya adalah sepupu satu kali Pemohon")!.kunci).toBe("Sepupu Satu Kali");
    expect(h("kenal karena saya tetangga Penggugat")).toMatchObject({ kunci: "Tetangga", golongan: "dekat" });
  });

  it('JEBAKAN: "kenal dengan Tergugat sebagai suami Penggugat" bukan hubungan saksi', () => {
    const h = (t: string) => d.deteksiHubungan(t, { bentuk: "kalimat" });
    expect(h("Saya kenal dengan Tergugat sebagai suami Penggugat;")).toBeNull();
    expect(h("Saya kenal dengan Termohon sebagai isteri Pemohon;")).toBeNull();
    expect(h("Saya kenal dengan Tergugat sebagai kaka ipar saya;")).toBeNull();
    expect(h("Ya, saya kenal dengan Tergugat yang bernama X, Tergugat adalah suami dari sepupu saya;")).toBeNull();
  });

  it("frasa bertingkat tidak dikenali - tidak dikenal lebih baik daripada salah sebut", () => {
    expect(d.deteksiHubungan("Saya kenal dengan Penggugat karena saya adalah sepupu paman Penggugat;", { bentuk: "kalimat" })).toBeNull();
    expect(d.deteksiHubungan("Saya kenal dengan para Pemohon karena saya adalah paman anak para Pemohon;", { bentuk: "kalimat" })).toBeNull();
    expect(d.deteksiHubungan("Kakek calon suami anak Pemohon", { bentuk: "label" })).toBeNull();
    expect(d.deteksiHubungan("itsbat nikah", { bentuk: "label" })).toBeNull();
  });

  it("label SIPP dengan ragam tulis diseragamkan", () => {
    const l = (t: string) => d.deteksiHubungan(t, { bentuk: "label" })?.kunci;
    expect(l("sepupu 1x penggugat.")).toBe("Sepupu Satu Kali");
    expect(l("sepupu 2 x")).toBe("Sepupu Dua Kali");
    expect(l("kemanakan penggugat.")).toBe("Keponakan");
    expect(l("bapak kandung pemohon i")).toBe("Ayah Kandung");
    expect(l("om penggugat")).toBe("Paman");
    expect(l("penggugat anak kandung")).toBe("Anak Kandung");
    expect(l("tetangga/pegawai syara")).toBe("Tetangga");
  });

  it("pasangan NYATA (jawaban kenal ABT vs Keterangan saksi SIPP): setara >= 88%, golongan sama >= 95%", () => {
    let keduanya = 0;
    let setara = 0;
    let golongan = 0;
    for (const p of NYATA.pasangan) {
      const a = d.deteksiHubungan(p.jawaban, { bentuk: "kalimat" });
      const b = d.deteksiHubungan(p.label, { bentuk: "label" });
      if (!a || !b) continue;
      keduanya += 1;
      if (d.hubunganSetara(a.kunci, b.kunci)) setara += 1;
      if (a.golongan === b.golongan) golongan += 1;
    }
    expect(keduanya).toBeGreaterThan(300);
    expect(setara / keduanya).toBeGreaterThanOrEqual(0.88);
    expect(golongan / keduanya).toBeGreaterThanOrEqual(0.95);
    // Ringkasan seluruh data (n=1.857) dari skrip ukur ikut dijaga.
    expect(NYATA.ringkasan.keduanya).toBeGreaterThan(1500);
    expect(NYATA.ringkasan.golonganSama / NYATA.ringkasan.keduanya).toBeGreaterThanOrEqual(0.95);
  });

  it("golongan keluarga dari istilah besar berkeyakinan pasti (diukur), tetangga tidak", () => {
    expect(d.deteksiHubungan("ibu kandung", { bentuk: "label" })!.yakinGolongan).toBe("pasti");
    expect(d.deteksiHubungan("tetangga", { bentuk: "label" })!.yakinGolongan).toBe("ragu");
  });

  it("payung tidak menyalahkan yang lebih rinci, dua rincian berbeda tetap salah", () => {
    expect(d.hubunganSetara("Saudara Kandung", "Kakak Kandung")).toBe(true);
    expect(d.hubunganSetara("Sepupu", "Sepupu Dua Kali")).toBe(true);
    expect(d.hubunganSetara("Keluarga", "Paman")).toBe(true);
    expect(d.hubunganSetara("Paman", "Keponakan")).toBe(false);
    expect(d.hubunganSetara("Keluarga", "Tetangga")).toBe(false);
  });
});

// ============================================================================
// C. LAPIS DATABASE
// ============================================================================
describe("C. lapis database kamus berlaku tanpa rilis", () => {
  it("istilah baru dari database dikenali; status nonaktif mematikan benih", () => {
    expect(d.deteksiHubungan("bidan desa", { bentuk: "label" })).toBeNull();
    kamus.aturLapisDatabase({
      pola: [
        { kelompok: "saksi-hubungan", kode: "hub-bidan-desa", kunci: "Bidan Desa", jenis: "istilah", golongan: "lain", jk: "P", regex: "^bidan\\s+desa$", flags: "i", status: "aktif", yakin: "ragu", ukur: { n: 0, tepat: 0, salahTangkap: 0 } },
        { kelompok: "saksi-hubungan", kode: "hub-tetangga", kunci: "Tetangga", regex: "^tetangga$", status: "nonaktif", yakin: "ragu" },
      ],
    });
    expect(d.deteksiHubungan("Bidan Desa Penggugat", { bentuk: "label" })).toMatchObject({ kunci: "Bidan Desa", golongan: "lain" });
    expect(d.deteksiHubungan("tetangga penggugat", { bentuk: "label" })).toBeNull();
    expect(d.kamusHubunganRingkas().map((x) => x.dasar)).toContain("Bidan Desa");
  });
});

// ============================================================================
// D. BARIS IDENTITAS
// ============================================================================
describe("D. baris identitas gaya putusan", () => {
  const BARIS =
    "1.\tHASNAH BINTI LATIF, umur 45 tahun, agama Islam, pendidikan SLTP, pekerjaan Mengurus Rumah Tangga, bertempat tinggal di Desa Lalombi, Kecamatan Banawa Selatan, Kabupaten Donggala, saksi mengaku sebagai Ibu Kandung Penggugat, di bawah sumpahnya telah memberikan keterangan di muka persidangan yang pada pokoknya sebagai berikut:";

  it("tiap medan terurai, alamat berkoma utuh, hubungan dikenali", () => {
    const h = d.deteksiIdentitas(BARIS);
    expect(h).toMatchObject({
      nama: "HASNAH BINTI LATIF",
      umur: 45,
      agama: "Islam",
      pendidikan: "SLTP",
      pekerjaan: "Mengurus Rumah Tangga",
      alamat: "Desa Lalombi, Kecamatan Banawa Selatan, Kabupaten Donggala",
      disumpah: true,
      bawahUmur: false,
    });
    expect(h.hubungan).toMatchObject({ teks: "Ibu Kandung Penggugat", kunci: "Ibu Kandung" });
  });

  it('pola "draf" (belum terukur) TIDAK dipakai; diaktifkan lewat lapis database baru berlaku', () => {
    const BARIS_TIDAK = "ANDI BIN LATIF, umur 14 tahun, agama Islam, saksi tersebut tidak disumpah karena masih di bawah umur";
    const h = d.deteksiIdentitas(BARIS_TIDAK);
    expect(h.umur).toBe(14);
    // idn-sumpah-tidak berstatus draf: "tidak disumpah" tidak dibaca sama sekali.
    expect(h.disumpah).toBeNull();
    expect(h.bawahUmur).toBe(true); // dari umur 14, bukan dari pola kata (draf)
    // Dibaca dari berkas benih langsung: pemuat kamus boleh saja sudah menyaring draf.
    const benih = JSON.parse(readFileSync(path.join(BOT, "kamus-deteksi", "awal", "saksi-identitas.json"), "utf8")) as { pola: Pola[] };
    const draf = benih.pola.find((p) => p.kode === "idn-sumpah-tidak")!;
    expect(draf.status).toBe("draf");
    kamus.aturLapisDatabase({ pola: [{ ...draf, kelompok: "saksi-identitas", status: "aktif" }] });
    expect(d.deteksiIdentitas(BARIS_TIDAK).disumpah).toBe(false);
  });

  it("teks bukan identitas tidak menghasilkan medan", () => {
    const kosong = d.deteksiIdentitas("Tergugat tidak mempunyai pekerjaan tetap sehingga sering bertengkar");
    expect(kosong.pekerjaan).toBe("");
    expect(kosong.nama).toBe("");
  });

  it("umur meniru get_umur SIPP", () => {
    expect(d.umurPada("1980-10-11", "2026-10-10")).toBe(45);
    expect(d.umurPada("1980-10-10", "2026-10-10")).toBe(46);
    expect(d.umurPada("0000-00-00", "2026-10-10")).toBeNull();
    expect(d.umurPada(null, "2026-10-10")).toBeNull();
  });
});

// ============================================================================
// E. PARAGRAF
// ============================================================================
const JAWABAN = [
  { tanya: "Apakah saksi kenal dengan Penggugat dan Tergugat?", jawab: "Saya kenal dengan Penggugat dan Tergugat karena saya adalah ibu kandung Penggugat;" },
  { tanya: "Apakah saksi mengetahui maksud Penggugat menghadap di persidangan?", jawab: "Penggugat hendak bercerai dengan Tergugat;" },
  { tanya: "Bagaimana keadaan rumah tangga Penggugat dan Tergugat?", jawab: "Sejak Maret 2024 rumah tangga Penggugat dan Tergugat tidak rukun karena Tergugat 'jarang' pulang;" },
  { tanya: "Apakah Penggugat dan Tergugat sudah berpisah tempat tinggal?", jawab: "Ya, Penggugat dan Tergugat sudah pisah sejak Mei 2025;" },
  { tanya: "Apakah saksi pernah merukunkan Penggugat dan Tergugat?", jawab: 'Saya sudah merukunkan keduanya namun tidak berhasil ("tidak mau");' },
  { tanya: "Apakah masih ada keterangan yang saksi akan sampaikan?", jawab: "Sudah cukup;" },
];
const IDENTITAS_P1 = {
  nama: "HASNAH BINTI LATIF",
  umur: 45,
  agama: "Islam",
  pendidikan: "SLTP",
  pekerjaan: "Mengurus Rumah Tangga",
  alamat: "Desa Lalombi, Kecamatan Banawa Selatan;",
  keterangan: "Ibu Kandung Penggugat",
};
const OPSI = { lawan: "Penggugat", pelaku: "Tergugat", kelompokTanya };

describe("E. paragraf keterangan saksi", () => {
  it("gaya LENGKAP = blangko putusan: identitas di awal, butir seperti cetakan ABT, penutup dibuang", () => {
    const p = d.susunParagrafSaksi({ ke: 1, pihak: "P", urutPihak: 1, jawaban: JAWABAN }, IDENTITAS_P1, OPSI);
    const baris = p.lengkap.split("\n");
    expect(baris[0]).toBe(
      "1. HASNAH BINTI LATIF, umur 45 tahun, agama Islam, pendidikan SLTP, pekerjaan Mengurus Rumah Tangga, bertempat tinggal di Desa Lalombi, Kecamatan Banawa Selatan, saksi mengaku sebagai Ibu Kandung Penggugat, di bawah sumpahnya telah memberikan keterangan di muka persidangan yang pada pokoknya sebagai berikut:"
    );
    expect(baris[1]).toBe("- Bahwa saksi kenal dengan Penggugat dan Tergugat karena saksi adalah ibu kandung Penggugat;");
    // ABT membuang "ya, " (replace_ket_saksi) - pratinjau harus sama dengan cetakan.
    expect(baris[4]).toBe("- Bahwa Penggugat dan Tergugat sudah pisah sejak Mei 2025;");
    expect(p.lengkap).not.toMatch(/cukup/i);
    expect(p.dibuangPenutup).toBe(1);
    expect(baris).toHaveLength(6);
    // Jejak koreksi (agen 4): tiap hasil kamus membawa kodePola pemicunya.
    expect(p.kodePola).toBe("saksi-pembuka-lengkap");
    expect(p.kodePolaGaya).toEqual({ lengkap: "saksi-pembuka-lengkap", ringkas: "saksi-pembuka-ringkas" });
    expect(p.hubungan!.kodePola).toBe("hub-ibu-kandung");
  });

  it("gaya RINGKAS = satu paragraf; petik di jawaban utuh; maksud & penutup tidak ikut", () => {
    const p = d.susunParagrafSaksi({ ke: 1, pihak: "P", urutPihak: 1, jawaban: JAWABAN }, IDENTITAS_P1, OPSI);
    expect(p.ringkas).not.toContain("\n");
    expect(p.ringkas.startsWith("Bahwa saksi I Penggugat, HASNAH BINTI LATIF, umur 45 tahun, Ibu Kandung Penggugat, di bawah sumpah pada pokoknya menerangkan bahwa saksi kenal dengan Penggugat")).toBe(true);
    expect(p.ringkas).toContain("'jarang'");
    expect(p.ringkas).toContain('("tidak mau")');
    expect(p.ringkas).not.toMatch(/hendak bercerai/);
    expect(p.ringkas).not.toMatch(/cukup/i);
    expect(p.ringkas.endsWith(";")).toBe(true);
    expect(p.ringkas).toMatch(/, dan saksi sudah merukunkan/);
  });

  it("Protestan/Katolik berjanji (variabel ABT 2041); tanpa identitas pembuka tetap utuh", () => {
    const p = d.susunParagrafSaksi({ ke: 2, pihak: "P", urutPihak: 2, jawaban: JAWABAN.slice(0, 2) }, { ...IDENTITAS_P1, agama: "Protestan" }, OPSI);
    expect(p.lengkap).toContain("di bawah janjinya telah memberikan keterangan");
    expect(p.lengkap.startsWith("2. ")).toBe(true);
    const tanpa = d.susunParagrafSaksi({ ke: 1, pihak: "T", urutPihak: 1, jawaban: JAWABAN.slice(2, 3) }, null, OPSI);
    expect(tanpa.lengkap.split("\n")[0]).toBe("1. Saksi I Tergugat, di bawah sumpahnya telah memberikan keterangan di muka persidangan yang pada pokoknya sebagai berikut:");
    // Tanpa keterangan SIPP dan tanpa jawaban kenal: kalimat kenal dari templat, tanpa hubungan karangan.
    expect(tanpa.ringkas).toContain("menerangkan bahwa saksi kenal dengan Penggugat dan Tergugat, ");
    expect(tanpa.hubungan).toBeNull();
  });

  it("hubungan dari jawaban kenal bila Keterangan SIPP kosong; sebutan salah dibetulkan menurut jenis perkara", () => {
    const dariJawab = d.susunParagrafSaksi({ ke: 1, pihak: "P", urutPihak: 1, jawaban: JAWABAN }, { ...IDENTITAS_P1, keterangan: "" }, OPSI);
    expect(dariJawab.hubungan).toMatchObject({ teks: "Ibu Kandung Penggugat", asal: "jawaban" });
    // Cerai talak: "Sepupu Penggugat" di SIPP (jebakan /Pdt.G/ beralur permohonan).
    const ct = d.susunParagrafSaksi(
      { ke: 1, pihak: "P", urutPihak: 1, jawaban: [{ tanya: "Apakah saksi kenal?", jawab: "Saya kenal dengan Pemohon;" }] },
      { ...IDENTITAS_P1, keterangan: "Sepupu Penggugat" },
      { lawan: "Pemohon", pelaku: "Termohon", kelompokTanya }
    );
    expect(ct.hubungan).toMatchObject({ teks: "Sepupu Pemohon", sebutanSalah: "penggugat" });
    expect(ct.lengkap).toContain("saksi mengaku sebagai Sepupu Pemohon,");
  });

  it("penutup tanggapan pihak HANYA bila diminta", () => {
    const tanpa = d.susunParagrafSaksi({ ke: 1, pihak: "P", urutPihak: 1, jawaban: JAWABAN }, IDENTITAS_P1, OPSI);
    expect(tanpa.lengkap).not.toContain("membenarkan");
    const dengan = d.susunParagrafSaksi({ ke: 1, pihak: "P", urutPihak: 1, jawaban: JAWABAN }, IDENTITAS_P1, { ...OPSI, penutup: "tanggapan" });
    expect(dengan.lengkap.split("\n").pop()).toBe("Bahwa atas keterangan saksi tersebut, Penggugat menyatakan membenarkan dan tidak keberatan;");
  });

  it("isiTemplat membuang [ ... ] yang isiannya kosong", () => {
    expect(d.isiTemplat("A[, umur {u} tahun][, {h}].", { u: "40", h: "" })).toBe("A, umur 40 tahun.");
  });
});

// ============================================================================
// F. PERINGATAN
// ============================================================================
describe("F. peringatan ringan", () => {
  const satu = (id: Record<string, unknown>, urut = 1, pihak = "P") => d.susunParagrafSaksi({ ke: urut, pihak, urutPihak: urut, jawaban: JAWABAN.slice(1, 3) }, id, OPSI);
  const kode = (xs: Peringatan[]) => xs.map((x) => x.kode);

  it("dua saksi keluarga dewasa pada perkara perselisihan: tidak ada peringatan ringan", () => {
    const p = [satu(IDENTITAS_P1, 1), satu({ ...IDENTITAS_P1, nama: "B", keterangan: "Paman Penggugat" }, 2)];
    expect(d.peringatanSaksi(p, { alasan: ["perselisihan terus-menerus"] }).filter((x) => x.tingkat === "ringan")).toEqual([]);
  });

  it("hanya satu saksi -> unus testis", () => {
    const w = d.peringatanSaksi([satu(IDENTITAS_P1)], { alasan: [] });
    expect(kode(w)).toContain("satu-saksi");
    expect(w.find((x) => x.kode === "satu-saksi")!.pesan).toMatch(/unus testis/);
  });

  it("di bawah 15 tahun dan 15-17 tahun dibedakan; umur kosong = info", () => {
    const w = d.peringatanSaksi([satu({ ...IDENTITAS_P1, umur: 14 }, 1), satu({ ...IDENTITAS_P1, umur: 16 }, 2), satu({ ...IDENTITAS_P1, umur: null }, 3)], {});
    expect(w.find((x) => x.kode === "bawah-umur")).toMatchObject({ tingkat: "ringan", saksi: "Saksi 1 P" });
    expect(w.find((x) => x.kode === "belum-dewasa")).toMatchObject({ tingkat: "ringan", saksi: "Saksi 2 P" });
    expect(w.find((x) => x.kode === "umur-kosong")).toMatchObject({ tingkat: "info", saksi: "Saksi 3 P" });
  });

  it("perkara syiqaq: saksi bukan keluarga disebut dengan Pasal 76 UU 7/1989; bukan syiqaq tidak", () => {
    const p = [satu(IDENTITAS_P1, 1), satu({ ...IDENTITAS_P1, keterangan: "Tetangga Penggugat" }, 2)];
    const w = d.peringatanSaksi(p, { alasan: ["perselisihan terus-menerus"] });
    const s = w.find((x) => x.kode === "syiqaq-bukan-keluarga")!;
    expect(s).toMatchObject({ tingkat: "ringan", saksi: "Saksi 2 P", kodePola: "hub-tetangga" });
    expect(s.pesan).toMatch(/Pasal 76 ayat \(1\) UU 7\/1989/);
    expect(kode(d.peringatanSaksi(p, { alasan: ["tidak memberi nafkah"] }))).not.toContain("syiqaq-bukan-keluarga");
    const duaTetangga = [satu({ ...IDENTITAS_P1, keterangan: "Tetangga" }, 1), satu({ ...IDENTITAS_P1, keterangan: "Teman" }, 2)];
    expect(kode(d.peringatanSaksi(duaTetangga, { alasan: ["perselisihan terus-menerus"] }))).toContain("syiqaq-tanpa-keluarga");
  });
});

// ============================================================================
// G. RUTE BOT SUNGGUHAN
// ============================================================================
const BERKAS_RUTE = path.join(BOT, "routes", "internalGatewayRoutes.js");
const require_ = createRequire(BERKAS_RUTE);
let penanganBot: (body: unknown) => Promise<{ status: number; json: any }>;
const IDENTITAS_SIPP = [
  { pihak: "P", urutPihak: 1, ...IDENTITAS_P1 },
  { pihak: "P", urutPihak: 2, nama: "ANDI BIN LATIF", umur: 16, agama: "Islam", pendidikan: "SLTA", pekerjaan: "Pelajar", alamat: "Desa Lalombi", keterangan: "Tetangga Penggugat" },
];

beforeAll(() => {
  const isi = readFileSync(BERKAS_RUTE, "utf8");
  const tanda = isi.indexOf("// PENYARING MASUKAN /abt/usulan (kontrak K6)");
  const awal = isi.lastIndexOf("\n// ====", tanda);
  const akhir = isi.indexOf('router.post("/abt/pdf"');
  if (!(tanda > 0 && awal > 0 && akhir > tanda)) throw new Error("Potongan rute /abt/usulan tidak ditemukan.");
  const rute: Record<string, (req: unknown, res: unknown) => Promise<void>> = {};
  const konteks = vm.createContext({
    // SIPP tidak ada di uji: identitas saksi diganti tiruan pada SATU-SATUNYA pintunya.
    require: (p: string) =>
      p.endsWith("saksiBantuService") ? { identitasSaksiBerbatas: async () => IDENTITAS_SIPP } : require_(p),
    abtUsulanService: require_("../services/abtUsulanService"),
    requireInternalToken: () => undefined,
    router: { post: (jalur: string, _p: unknown, f: (req: unknown, res: unknown) => Promise<void>) => void (rute[jalur] = f) },
    console,
  });
  vm.runInContext(isi.slice(awal, akhir), konteks, { filename: "internalGatewayRoutes.js#abt-usulan" });
  const f = rute["/abt/usulan"];
  penanganBot = async (body) => {
    let status = 200;
    let json: any = null;
    await f({ body: JSON.parse(JSON.stringify(body)) }, { status: (s: number) => ((status = s), { json: (j: any) => void (json = j) }), json: (j: any) => void (json = j) });
    return { status, json };
  };
});

const TEMPLAT = [
  { no: "1", tanya: "Apakah saksi kenal dengan Penggugat dan Tergugat?", jawab: "Ya, saya kenal dengan Penggugat dan Tergugat karena saya adalah ibu kandung Penggugat / tetangga Penggugat;" },
  { no: "2", tanya: "Bagaimana keadaan rumah tangga Penggugat dan Tergugat?", jawab: "Rumah tangga Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran;" },
  { no: "3", tanya: "Apakah masih ada keterangan yang saksi akan sampaikan?", jawab: "Sudah cukup;" },
];

describe("G. rute /abt/usulan sungguhan", () => {
  it("saksiSdg membawa paragrafSaksi + peringatanSaksi; tanya-jawab sama persis dengan susunan tanpa P6", async () => {
    const badan = {
      sumber: "saksi-sdg",
      nomorPerkara: "123/Pdt.G/2026/PA.Dgl",
      templat: TEMPLAT,
      alasan: ["perselisihan terus-menerus"],
      pelaku: "Tergugat",
      lawan: "Penggugat",
    };
    const bot = await penanganBot(badan);
    const sdg = bot.json.saksiSdg;
    expect(sdg.ok).toBe(true);
    expect(sdg.identitasAsal).toBe("sipp");
    expect(sdg.paragrafSaksi).toHaveLength(2);
    expect(sdg.paragrafSaksi[0].lengkap.startsWith("1. HASNAH BINTI LATIF, umur 45 tahun")).toBe(true);
    expect(sdg.paragrafSaksi[1].lengkap.startsWith("2. ANDI BIN LATIF, umur 16 tahun")).toBe(true);
    const kodePeringatan = sdg.peringatanSaksi.map((x: Peringatan) => x.kode);
    expect(kodePeringatan).toContain("belum-dewasa");
    expect(kodePeringatan).toContain("syiqaq-bukan-keluarga");
    // Tanya-jawab yang disimpan ke ABT tidak disentuh P6.
    const langsung = layananSaksi.susunKeteranganSaksiSdg({
      templat: TEMPLAT,
      alasan: badan.alasan,
      pelaku: "Tergugat",
      lawan: "Penggugat",
      nomorPerkara: badan.nomorPerkara,
      kodeKumpulan: "",
      jenisPerkara: "",
      alur: "",
      modus: { saksi1: undefined, saksi2: undefined },
      upayaDamai: "",
      posita: "",
      tanggalSidang: "",
    });
    expect(sdg.saksi.map((s: any) => s.jawaban)).toEqual(langsung.saksi.map((s: any) => s.jawaban));
  });

  it("lengkapiSusunan atas susunan yang gagal tidak menambah apa pun", () => {
    expect(d.lengkapiSusunan({ ok: false })).toEqual({});
  });
});

// ============================================================================
// H. EKSTENSI abt.js - BLOK P5P6 DIJALANKAN DI JSDOM
// ============================================================================
function blokP6(): { dom: JSDOM; m: any; disimpan: Record<string, unknown> } {
  const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp", "abt.js"), "utf8").replace(/\r\n/g, "\n");
  const awal = sumber.indexOf("/* === P5P6 10 Okt === */");
  const akhir = sumber.indexOf("/* === AKHIR P5P6 === */", awal);
  expect(awal).toBeGreaterThan(0);
  expect(akhir).toBeGreaterThan(awal);
  const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
  const disimpan: Record<string, unknown> = {};
  (dom.window as any).chrome = {
    storage: {
      local: {
        get: async () => ({}),
        set: async (x: Record<string, unknown>) => Object.assign(disimpan, x),
      },
    },
  };
  dom.window.eval(
    `${sumber.slice(awal, akhir)}\n;window.__m = { p6GambarParagraf, p6GambarPeringatan, p6MuatGaya, p6SimpanGaya, get gaya() { return p6GayaParagraf; } };`
  );
  return { dom, m: (dom.window as any).__m, disimpan };
}

describe("H. panel ABT: pengalih gaya dan peringatan", () => {
  const sdg = {
    identitasAsal: "sipp",
    paragrafSaksi: [
      { label: "Saksi 1 P", hubungan: { teks: "Ibu Kandung Penggugat" }, lengkap: "1. HASNAH ... sebagai berikut:\n- Bahwa saksi kenal;", ringkas: "Bahwa saksi I Penggugat, HASNAH, ... menerangkan bahwa saksi kenal;" },
      { label: "Saksi 2 P", hubungan: null, lengkap: "2. ANDI ...", ringkas: "Bahwa saksi II Penggugat, ANDI ..." },
    ],
    peringatanSaksi: [
      { kode: "belum-dewasa", tingkat: "ringan", pesan: "Saksi 2 P berumur 16 tahun (belum dewasa)", saksi: "Saksi 2 P" },
      { kode: "umur-kosong", tingkat: "info", pesan: "Umur ..." },
    ],
  };

  it("bawaan Lengkap; menekan Ringkas mengganti isi tiap saksi dan mengingatnya", async () => {
    const { dom, m, disimpan } = blokP6();
    await m.p6MuatGaya();
    const el = m.p6GambarParagraf(sdg);
    dom.window.document.body.appendChild(el);
    const area = Array.from(el.querySelectorAll("textarea")) as HTMLTextAreaElement[];
    expect(area).toHaveLength(2);
    expect(area[0].value).toBe(sdg.paragrafSaksi[0].lengkap);
    expect(area[0].readOnly).toBe(true);
    const tombol = (g: string) => el.querySelector(`button[data-gaya="${g}"]`) as HTMLButtonElement;
    expect(tombol("lengkap").getAttribute("aria-pressed")).toBe("true");
    tombol("ringkas").click();
    expect(area[0].value).toBe(sdg.paragrafSaksi[0].ringkas);
    expect(area[1].value).toBe(sdg.paragrafSaksi[1].ringkas);
    expect(tombol("ringkas").getAttribute("aria-pressed")).toBe("true");
    expect(disimpan).toEqual({ gayaParagrafSaksi: "ringkas" });
    expect(el.textContent).toContain("Saksi 1 P - Ibu Kandung Penggugat");
    expect(el.textContent).toContain("tidak disimpan ke ABT");
  });

  it("peringatan tergambar per butir dengan tingkatnya; tanpa ruas bot = tidak ada yang digambar", () => {
    const { m } = blokP6();
    const w = m.p6GambarPeringatan(sdg);
    const li = Array.from(w.querySelectorAll("li")) as HTMLElement[];
    expect(li.map((x) => x.dataset.kode)).toEqual(["belum-dewasa", "umur-kosong"]);
    expect(li[0].className).toBe("aleta-p6-ringan");
    expect(li[1].className).toBe("aleta-p6-info");
    expect(w.textContent).toContain("tidak menahan penyimpanan");
    expect(m.p6GambarParagraf({ saksi: [] })).toBeNull();
    expect(m.p6GambarPeringatan({})).toBeNull();
  });

  it("panel memasang keduanya di gambarPratinjauSdg, tombol simpan tidak dikaitkan dengan peringatan", () => {
    const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp", "abt.js"), "utf8");
    const i = sumber.indexOf("function gambarPratinjauSdg(");
    const badan = sumber.slice(i, sumber.indexOf("function gambarFormSdg(", i));
    expect(badan).toContain("p6GambarPeringatan(hasil)");
    expect(badan).toContain("p6GambarParagraf(hasil)");
    expect(badan).not.toMatch(/peringatanSaksi[^\n]*disabled/);
  });
});

// ============================================================================
// I. EKSTENSI saksiscan.js - KAMUS MEMPERKAYA TEBAKAN
// ============================================================================
describe("I. tebakan blangko saksi SIPP diperkaya kamus hubungan", () => {
  function murni() {
    const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp", "saksiscan.js"), "utf8").replace(/\r\n/g, "\n");
    const k: Record<string, unknown> = { console, globalThis: {} };
    vm.createContext(k);
    vm.runInContext(`var document = {}; ${sumber}\n;this.__m = { saksibantuUsulan, saksibantuJkHubungan, saksibantuKeluarga, saksibantuUrai };`, k);
    return k.__m as {
      saksibantuUsulan: (x: Record<string, unknown>) => { medan: string; tulisan: string }[];
      saksibantuJkHubungan: (d: string, k?: unknown) => string;
      saksibantuKeluarga: (d: string, k?: unknown) => boolean;
      saksibantuUrai: (t: string) => { dasar: string };
    };
  }
  const m = murni();
  const KAMUS = d.kamusHubunganRingkas();

  it('"Mama Kandung" (tidak dikenal aturan lama) -> jenis kelamin Perempuan + usulan alamat keluarga', () => {
    const dasar = m.saksibantuUrai("mama kandung penggugat").dasar;
    expect(dasar).toBe("Mama Kandung");
    expect(m.saksibantuJkHubungan(dasar)).toBe("");
    expect(m.saksibantuJkHubungan(dasar, KAMUS)).toBe("P");
    const isian = { agama: "1", jenisKelamin: "", pekerjaan: "", apakahTni: null, statusKawin: "", umur: 50, alamat: "", hubungan: dasar, alamatPihak: "Desa Lalombi", sebutanPihak: "Penggugat" };
    const lama = m.saksibantuUsulan(isian).map((u) => u.medan);
    const usulanBaru = m.saksibantuUsulan({ ...isian, kamusHubungan: KAMUS }) as unknown as { medan: string; kuat: boolean; kodePola?: string }[];
    const baru = usulanBaru.map((u) => u.medan);
    expect(lama).not.toContain("jenisKelamin");
    expect(baru).toContain("jenisKelamin");
    expect(lama).not.toContain("alamat");
    expect(baru).toContain("alamat");
    // Belum terukur untuk jenis kelamin: usulan klik, TIDAK diisi otomatis; membawa kodePola.
    const jk = usulanBaru.find((u) => u.medan === "jenisKelamin")!;
    expect(jk.kuat).toBe(false);
    expect(jk.kodePola).toBe("hub-ibu-kandung");
    expect(usulanBaru.find((u) => u.medan === "alamat")!.kodePola).toBe("hub-ibu-kandung");
  });

  it("tebakan aturan lama (terukur 98,7%) tetap kuat dan tanpa kodePola kamus", () => {
    const isian = { agama: "1", jenisKelamin: "", pekerjaan: "", apakahTni: null, statusKawin: "", umur: 50, alamat: "", hubungan: "Ibu Kandung", alamatPihak: "Desa Lalombi", sebutanPihak: "Penggugat", kamusHubungan: KAMUS };
    const u = m.saksibantuUsulan(isian) as unknown as { medan: string; kuat: boolean; kodePola?: string }[];
    const jk = u.find((x) => x.medan === "jenisKelamin")!;
    expect(jk.kuat).toBe(true);
    expect(jk.kodePola).toBeUndefined();
    expect(u.find((x) => x.medan === "alamat")!.kodePola).toBeUndefined();
  });

  it("kamus tidak mengurangi: tetangga tetap bukan keluarga, ibu tetap Perempuan; pola rusak diabaikan", () => {
    expect(m.saksibantuKeluarga("Tetangga", KAMUS)).toBe(false);
    expect(m.saksibantuJkHubungan("Ibu Kandung", KAMUS)).toBe("P");
    expect(m.saksibantuKeluarga("Aparat Desa", [{ dasar: "x", regex: "(", golongan: "keluarga" }])).toBe(false);
  });
});
