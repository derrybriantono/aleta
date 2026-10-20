// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 - SARAN BLANGKO UNTUK SEMUA JENIS PERKARA DAN SEMUA KATEGORI
 * ============================================================================
 *
 * Temuan hakim: perkara selain cerai (contoh 228/Pdt.P/2026/PA.Dgl, itsbat nikah voluntair, sidang ke-2 beragenda Pembuktian) tidak
 * mendapat saran putusan, relaas, maupun PTSP. Yang dijaga di sini adalah PERILAKU fungsi saran (masukan keadaan perkara -> blangko yang
 * disarankan), bukan tulisan kodenya:
 *   A  putusan/penetapan: sidang yang belum memutus tetap mendapat blangko yang lazim, per jenis, bertanda perkiraan;
 *   B  yang sudah ada tidak berubah (status tercatat, agenda memutus, sidang ikrar);
 *   C  BAS: agenda pembuktian sidang lanjutan -> pemeriksaan saksi; alternatif sidang lanjutan lebih dulu;
 *   D  relaas: voluntair tanpa Termohon, pihak menurut kehadiran, pengumuman itsbat menurut jumlah Pemohon;
 *   E  PTSP: penetapan menurut keadaan (perkara baru, petugas belum tertunjuk, ditunda, ikrar, mediasi, sita);
 *   F  jaminan tidak kosong untuk semua jenis x sidang x agenda; bahan masukan dari baris jadwal;
 *   G  ekstensi: ruas ptsp diteruskan, nama berkas saran dicocokkan toleran.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { masukanRekomendasiDariBaris, rekomendasiBlangko, type MasukanRekomendasi } from "@/lib/rekomendasi-blangko";
import { perkaraVoluntair, saranBlangkoLengkap, sebutanPihak, sisiTidakHadir, statusDariTeks } from "@/lib/saran-blangko-semua";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (rel: string) => readFileSync(path.join(AKAR, rel), "utf8").replace(/\r\n/g, "\n");

type Jenis = { nama: string; nomor: string; id: number; alur: number; menuPutusan: string; kabul: RegExp; menuBas: string };
const P = "Pdt.P";
const G = "Pdt.G";
const jenis = (nama: string, kode: string, id: number, menuPutusan: string, kabul: RegExp, menuBas: string): Jenis => ({
  nama,
  nomor: `77/${kode}/2026/PA.Dgl`,
  id,
  alur: kode === P ? 16 : 15,
  menuPutusan,
  kabul,
  menuBas,
});
const JENIS: Jenis[] = [
  jenis("Cerai Gugat", G, 347, "Putusan Cerai Gugat", /\[Kabul/, "Cerai Gugat - BAS"),
  jenis("Cerai Talak", G, 346, "Putusan Cerai Talak", /\[Kabul/, "Cerai Talak - BAS"),
  jenis("Pengesahan Perkawinan/Istbat Nikah", P, 360, "Putusan Itsbat Nikah", /\[01\] \[Kabul\] IN/, "Itsbat Nikah - BAS"),
  jenis("Pengesahan Perkawinan/Istbat Nikah", G, 360, "Putusan Itsbat Nikah Kontensius", /\[01\] \[Kabul\] IN Kontensius/, "Itsbat Nikah Kontensius - BAS"),
  jenis("Dispensasi Kawin", P, 362, "Putusan Dispensasi Kawin", /\[01\] \[Kabul\] DK/, "Dispensasi Kawin - BAS"),
  jenis("Perwalian", P, 354, "Putusan Perwalian", /Perwalian Anak oleh ortu kandung Kabul/, "Perwalian - BAS"),
  jenis("Wali Adhol", P, 363, "Putusan Wali Adhal", /\[01\] \[Kabul\] Wali Adhal/, "Wali Adhal - BAS"),
  jenis("Asal Usul Anak", P, 358, "Putusan Asal Usul Anak", /\[01\] \[Kabul\] AUA/, "Asal Usul Anak - BAS"),
  jenis("P3HP/Penetapan Ahli Waris", P, 371, "Putusan Penetapan Ahli Waris (P3HP)", /\[01\] \[Kabul\] PAW/, "Penetapan Ahli Waris (P3HP) - BAS"),
  jenis("Harta Bersama", G, 348, "Putusan Harta Bersama", /\[Kabul\] HB/, "Harta Bersama - BAS"),
  jenis("Kewarisan", G, 364, "Putusan Kewarisan", /\[01\] \[Kabul\] Kewarisan/, "Kewarisan - BAS"),
  jenis("Izin Poligami", G, 341, "Putusan Izin Poligami", /\[01\] \[Kabul\] Izin Poligami/, "Izin Poligami - BAS"),
  jenis("Lain-Lain", P, 369, "Putusan Lain-Lain (Pengangkatan Anak)", /\[01\] \[Kabul\] Pengangkatan Anak/, "Lain-Lain (Pengangkatan Anak) - BAS"),
  jenis("Lain-Lain", G, 369, "Putusan Hak Asuh Anak (Hadhanah)", /\[Kabul\] Hak Asuh/, "Hak Asuh Anak (Hadhanah) - BAS"),
  jenis("Pembatalan Perkawinan", G, 344, "Putusan Pembatalan Perkawinan", /\[01\] \[Kabul\] Pembatalan Perkawinan/, "Pembatalan Perkawinan - BAS"),
  jenis("Pencegahan Perkawinan", P, 342, "Putusan Pencegahan Perkawinan", /\[01\] \[Kabul\] Pencegahan Perkawinan/, "Pencegahan Perkawinan - BAS"),
  jenis("Wasiat", G, 365, "Putusan Wasiat", /\[01\] \[Kabul\] Wasiat/, "Wasiat - BAS"),
];

/** Sidang ke-n yang hasilnya BELUM tercatat (dihadiri_oleh kosong), kehadiran sidang sebelumnya `hadirSebelumnya`. */
const sidang = (j: Jenis, ekstra: Partial<MasukanRekomendasi> = {}): MasukanRekomendasi => ({
  jenisPerkara: j.nama,
  nomorPerkara: j.nomor,
  urutanSidang: 2,
  dihadiriOleh: null,
  hadirSebelumnya: 1,
  agenda: "Pembuktian",
  jenisPerkaraId: j.id,
  alurPerkaraId: j.alur,
  ...ekstra,
});
const berkas = (r: { berkas: string }) => r.berkas;

// ----------------------------------------------------------------------------
describe("A. putusan/penetapan: sidang yang belum memutus tetap disarankan blangko yang lazim", () => {
  it("contoh pengguna - 228/Pdt.P/2026 itsbat nikah voluntair sidang ke-2 (Pembuktian): sebelumnya kosong, kini [01] Kabul IN utama + tolak/NO/cabut alternatif", () => {
    const m: MasukanRekomendasi = {
      jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah",
      nomorPerkara: "228/Pdt.P/2026/PA.Dgl",
      urutanSidang: 2,
      dihadiriOleh: null,
      hadirSebelumnya: 1,
      agenda: "Pembuktian",
      lewatEcourt: true,
      jenisPerkaraId: 360,
      alurPerkaraId: 16,
      jumlahPemohon: 2,
      jumlahTermohon: 0,
      ditunda: false,
    };
    expect(rekomendasiBlangko(m).putusan).toEqual([]); // keadaan lama: tab Putusan kosong
    const h = saranBlangkoLengkap(m);
    expect(h.putusan[0]).toMatchObject({ jenis: "putusan", menu: "Putusan Itsbat Nikah", folder: "derry_briantono/2 Itsbat Nikah", berkas: "[01] [Kabul] IN.rtf", utama: true, perkiraan: true, keyakinan: "perkiraan" });
    expect(h.putusan[0].alasan).toContain("Sidang ke-2 (Pembuktian) belum tercatat putus");
    const alt = h.putusan.slice(1);
    expect(alt.every((r) => !r.utama && r.perkiraan)).toBe(true);
    expect(alt.map((r) => r.label)).toEqual(expect.arrayContaining([expect.stringMatching(/\[03\] \[Tolak\] IN/), expect.stringMatching(/\[99\] \[NO\] IN/), expect.stringMatching(/\[98\] \[Cabut\] IN/)]));
    // BAS sidang ke-2 itsbat: pemeriksaan saksi lebih dulu, lalu sidang lanjutan/penetapan sebelum varian sidang 1.
    expect(h.bas[0].berkas).toMatch(/\[2\] Sidang Lanjutan - Pemeriksaan 2 Saksi, Tunda Pembacaan Penetapan/);
    expect(h.bas[0].utama).toBe(true);
    const urutan = h.bas.map((r) => /\[(\w+)\]\s/.exec(r.berkas.replace(/^BAS ALUR \d+ [^[]*/, ""))?.[1]);
    expect(urutan.indexOf("3")).toBeLessThan(urutan.indexOf("1a"));
    expect(urutan.indexOf("2b")).toBeLessThan(urutan.indexOf("1a"));
  });

  it.each(JENIS.map((j) => [`${j.nama} (${j.nomor.split("/")[1]})`, j] as const))("%s: blangko kabul jenisnya disarankan pada sidang ke-2 Pembuktian, di kelompok putusan yang benar", (_n, j) => {
    const h = saranBlangkoLengkap(sidang(j));
    expect(h.putusan.length).toBeGreaterThan(0);
    const utama = h.putusan[0];
    expect(utama.utama).toBe(true);
    expect(utama.menu).toBe(j.menuPutusan);
    expect(utama.berkas).toMatch(j.kabul);
    expect(utama.perkiraan).toBe(true);
    expect(utama.keyakinan).toBe("perkiraan");
    expect(utama.folder.startsWith("derry_briantono/")).toBe(true);
    // Hanya satu yang utama; alternatif di kelompok jenis yang sama (tidak dapat diterima permohonan sebagian jenis ada di kelompok umum 9b).
    expect(h.putusan.filter((r) => r.utama)).toHaveLength(1);
    expect(h.putusan.every((r) => r.menu === j.menuPutusan || r.menu === "Putusan Permohonan Umum (Cabut/Gugur/NO)")).toBe(true);
  });

  it("cerai berkumulasi itsbat nikah: blangko putusan kumulasi (folder 1c), bukan blangko cerai biasa", () => {
    const j = JENIS[0];
    const h = saranBlangkoLengkap(sidang(j, { kumulasi: [{ kode: "itsbat-nikah" }] }));
    expect(h.putusan[0].menu).toBe("Putusan Cerai Kumulasi Itsbat Nikah");
    expect(h.putusan[0].folder).toBe("derry_briantono/1c Perceraian Kumulasi Itsbat Nikah");
    expect(h.putusan[0].berkas).toMatch(/CG Kumulasi Itsbat Nikah - Kontradiktoir/);
    expect(h.putusan.some((r) => /Tolak\] Putusan CG Kumulasi Itsbat Nikah/.test(r.berkas))).toBe(true);
    const talak = saranBlangkoLengkap(sidang(JENIS[1], { kumulasi: [{ kode: "itsbat-nikah" }] }));
    expect(talak.putusan[0].berkas).toMatch(/CT Kumulasi Itsbat Nikah - Kontradiktoir/);
  });

  it("verstek diperkirakan HANYA bila Tergugat belum pernah hadir dan sidang ini/sebelumnya dihadiri Penggugat saja", () => {
    const cg = JENIS[0];
    const verstek = saranBlangkoLengkap(sidang(cg, { hadirSebelumnya: 2, tergugatPernahHadir: false }));
    expect(verstek.putusan[0].berkas).toMatch(/Kabul Verstek/);
    expect(verstek.putusan[0].alasan).toContain("diperkirakan verstek");
    const kontradiktor = saranBlangkoLengkap(sidang(cg, { hadirSebelumnya: 1, tergugatPernahHadir: true }));
    expect(kontradiktor.putusan[0].berkas).not.toMatch(/Verstek/);
    const pernahHadir = saranBlangkoLengkap(sidang(cg, { hadirSebelumnya: 2, tergugatPernahHadir: true }));
    expect(pernahHadir.putusan[0].berkas).not.toMatch(/Verstek/);
    // Permohonan voluntair tidak punya Tergugat: tidak pernah verstek.
    const itsbat = saranBlangkoLengkap(sidang(JENIS[2], { hadirSebelumnya: 2, tergugatPernahHadir: false }));
    expect(itsbat.putusan[0].alasan).not.toContain("verstek");
    // Sidang pertama yang kehadirannya belum tercatat tidak menebak verstek.
    expect(saranBlangkoLengkap(sidang(cg, { urutanSidang: 1, hadirSebelumnya: null, dihadiriOleh: null, tergugatPernahHadir: false })).putusan[0].berkas).not.toMatch(/Verstek/);
  });

  it("kata pada agenda menentukan status utama: cabut / gugur / tidak dapat diterima / ditolak; jenis tanpa blangkonya tidak mengaku status itu", () => {
    const dk = JENIS.find((j) => j.nama === "Dispensasi Kawin")!;
    expect(saranBlangkoLengkap(sidang(dk, { agenda: "Pemohon mencabut permohonan" })).putusan[0].berkas).toMatch(/\[98\] \[Cabut\] DK/);
    expect(saranBlangkoLengkap(sidang(dk, { agenda: "Pemohon tidak hadir - gugur" })).putusan[0].berkas).toMatch(/\[Gugur\] DK/);
    expect(saranBlangkoLengkap(sidang(dk, { agenda: "Permohonan tidak dapat diterima" })).putusan[0].berkas).toMatch(/\[NO\] DK/);
    expect(saranBlangkoLengkap(sidang(dk, { agenda: "Putusan: permohonan ditolak" })).putusan[0]).toBeDefined();
    const hb = JENIS.find((j) => j.nama === "Harta Bersama")!;
    const damai = saranBlangkoLengkap(sidang(hb, { agenda: "Akta perdamaian" }));
    expect(damai.putusan[0].berkas).toMatch(/Perdamaian\] Akta Perdamaian/);
    // Penggugat-nya tidak punya blangko perdamaian (dispensasi kawin): jatuh ke kabul, bukan mengaku perdamaian.
    const dkDamai = saranBlangkoLengkap(sidang(dk, { agenda: "Akta perdamaian" }));
    expect(dkDamai.putusan[0].berkas).toMatch(/\[Kabul\] DK/);
    expect(dkDamai.putusan[0].alasan).toContain("dikabulkan");
  });

  it("penolakan perkawinan kini punya blangko putusan sendiri (W3a 21 Okt, folder 5c); sidang ikrar talak tidak diberi putusan cadangan", () => {
    const tolak = saranBlangkoLengkap({ jenisPerkara: "Penolakan Perkawinan", nomorPerkara: "5/Pdt.P/2026/PA.Dgl", urutanSidang: 1, agenda: "Sidang Pertama" });
    expect(tolak.putusan.length).toBeGreaterThan(0);
    expect(tolak.putusan.every((p) => p.folder.includes("5c Penolakan Perkawinan"))).toBe(true);
    // tetap ada relaas dan PTSP umum
    expect(tolak.relaas.length).toBeGreaterThan(0);
    expect(tolak.ptsp!.length).toBeGreaterThan(0);
    const ikrar = saranBlangkoLengkap({ jenisPerkara: "Cerai Talak", nomorPerkara: "9/Pdt.G/2026/PA.Dgl", urutanSidang: 5, dihadiriOleh: 3, agenda: "Sidang Ikrar Talak", sidangIkrarTalak: true });
    expect(ikrar.putusan).toEqual([]); // Pemohon tidak hadir: belum ada penetapan ikrar (aturan lama dipertahankan)
  });
});

// ----------------------------------------------------------------------------
describe("B. saran yang sudah ada tidak berubah", () => {
  const SEBELUM = (m: MasukanRekomendasi) => rekomendasiBlangko(m);
  it("status tercatat / agenda memutus: putusan, BAS dan relaas sama persis dengan keluaran lama (hanya ditambah keyakinan)", () => {
    const kasus: MasukanRekomendasi[] = [
      sidang(JENIS[0], { agenda: "Putusan", dihadiriOleh: 2, sudahPutus: true, statusPutusan: "Dikabulkan (verstek)", verstekPutusan: true }),
      sidang(JENIS[2], { agenda: "Musyawarah Majelis" }),
      sidang(JENIS[4], { agenda: "Pembacaan Putusan", dihadiriOleh: 3, sudahPutus: true, statusPutusan: "Dikabulkan" }),
      sidang(JENIS[0], { agenda: "Panggil Tergugat", dihadiriOleh: 2, ditunda: true, alasanDitunda: "T tidak hadir, panggil lagi" }),
    ];
    for (const m of kasus) {
      const lama = SEBELUM(m);
      const baru = saranBlangkoLengkap(m);
      const tanpaKeyakinan = (daftar: ReturnType<typeof SEBELUM>["bas"]) => daftar.map(({ keyakinan: _k, ...sisa }) => sisa);
      for (const k of ["bas", "putusan", "relaas"] as const) {
        if (lama[k].length) expect(tanpaKeyakinan(baru[k])).toEqual(tanpaKeyakinan(lama[k]));
      }
    }
  });
  it("kategori yang sudah berisi tidak ditimpa cadangan (relaas sidang ditunda tetap panggilan menurut kehadiran)", () => {
    const m = sidang(JENIS[0], { dihadiriOleh: 2, ditunda: true, agenda: "Panggil Tergugat" });
    const h = saranBlangkoLengkap(m);
    expect(h.relaas.map(berkas)).toEqual(rekomendasiBlangko(m).relaas.map(berkas));
    expect(h.relaas[0].alasan).toBe("Panggilan sidang lanjutan kepada pihak yang tidak hadir.");
    expect(h.relaas[0].keyakinan).toBe("pasti");
  });
});

// ----------------------------------------------------------------------------
describe("C. BAS", () => {
  it("itsbat nikah sidang 1 (Sidang Pertama) tetap BAS 1x sidang; sidang 2+ pembuktian -> pemeriksaan saksi, bukan pembacaan penetapan", () => {
    const j = JENIS[2];
    expect(saranBlangkoLengkap(sidang(j, { urutanSidang: 1, agenda: "Sidang Pertama", hadirSebelumnya: null })).bas[0].berkas).toMatch(/\[1\] BAS 1 IN - Kabul/);
    expect(saranBlangkoLengkap(sidang(j, { agenda: "Pembuktian" })).bas[0].berkas).toMatch(/\[2\] Sidang Lanjutan/);
    // agenda yang memutus tetap pembacaan penetapan
    expect(saranBlangkoLengkap(sidang(j, { agenda: "Pembacaan Penetapan" })).bas[0].berkas).toMatch(/\[3\] Sidang Terakhir/);
    expect(saranBlangkoLengkap(sidang(j, { agenda: "Pemeriksaan saksi" })).bas[0].berkas).toMatch(/\[2\] Sidang Lanjutan/);
  });
  it.each(JENIS.map((j) => [`${j.nama} (${j.nomor.split("/")[1]})`, j] as const))("%s: BAS ada untuk sidang 1, 2 dan 3, di kelompok BAS jenisnya", (_n, j) => {
    for (const u of [1, 2, 3]) {
      const h = saranBlangkoLengkap(sidang(j, { urutanSidang: u, hadirSebelumnya: u > 1 ? 1 : null, agenda: u === 1 ? "Sidang Pertama" : "Pembuktian" }));
      expect(h.bas.length).toBeGreaterThan(0);
      expect(h.bas.filter((r) => r.utama).length).toBeGreaterThanOrEqual(1);
      expect(h.bas[0].menu).toMatch(/BAS$/);
    }
  });
});

// ----------------------------------------------------------------------------
describe("D. relaas (juru sita)", () => {
  it("sandi kehadiran: permohonan hanya punya Pemohon; gugatan menurut sandi SIPP; kosong = tidak diketahui", () => {
    expect(sisiTidakHadir(null, false)).toBeNull();
    expect(sisiTidakHadir(1, false)).toEqual([]);
    expect(sisiTidakHadir(2, false)).toEqual(["kedua"]);
    expect(sisiTidakHadir(3, false)).toEqual(["pertama"]);
    expect(sisiTidakHadir(4, false)).toEqual(["pertama", "kedua"]);
    expect(sisiTidakHadir(1, true)).toEqual([]);
    expect(sisiTidakHadir(2, true)).toEqual([]);
    expect(sisiTidakHadir(3, true)).toEqual(["pertama"]);
    expect(sisiTidakHadir(4, true)).toEqual(["pertama"]);
    expect(sisiTidakHadir(9, false)).toBeNull();
  });
  it("voluntair dikenali dari nomor Pdt.P atau alur 16; sebutan pihak menurut jenis", () => {
    expect(perkaraVoluntair({ nomorPerkara: "1/Pdt.P/2026/PA.Dgl" })).toBe(true);
    expect(perkaraVoluntair({ nomorPerkara: "1/Pdt.G/2026/PA.Dgl", alurPerkaraId: 16 })).toBe(false);
    expect(perkaraVoluntair({ alurPerkaraId: 16 })).toBe(true);
    expect(perkaraVoluntair({})).toBe(false);
    expect(sebutanPihak({ jenisPerkara: "Cerai Talak", nomorPerkara: "1/Pdt.G/2026/PA.Dgl" }, "kedua")).toBe("Termohon");
    expect(sebutanPihak({ jenisPerkara: "Cerai Gugat", nomorPerkara: "1/Pdt.G/2026/PA.Dgl" }, "pertama")).toBe("Penggugat");
    expect(sebutanPihak({ jenisPerkara: "Perwalian", nomorPerkara: "1/Pdt.P/2026/PA.Dgl" }, "kedua")).toBe("Pemohon");
  });
  it("itsbat voluntair sidang 1: panggilan Pemohon (e-Court) + pengumuman menurut jumlah Pemohon; tanpa blangko Termohon", () => {
    const j = JENIS[2];
    const dua = saranBlangkoLengkap(sidang(j, { urutanSidang: 1, hadirSebelumnya: null, agenda: "Sidang Pertama", jumlahPemohon: 2, lewatEcourt: true })).relaas;
    expect(dua[0]).toMatchObject({ utama: true });
    expect(dua[0].berkas).toMatch(/Panggilan Sidang P \(e-Court\)/);
    expect(dua.some((r) => /Pengumuman Permohonan Itsbat Nikah \(2 Pemohon\)/.test(r.berkas))).toBe(true);
    expect(dua.some((r) => /\bT\b/.test(r.berkas.replace(/\.rtf$/, "")) && /Panggilan/.test(r.berkas))).toBe(false);
    const satu = saranBlangkoLengkap(sidang(j, { urutanSidang: 1, hadirSebelumnya: null, agenda: "Sidang Pertama", jumlahPemohon: 1 })).relaas;
    expect(satu.some((r) => /Pengumuman Permohonan Itsbat Nikah \(1 Pemohon\)/.test(r.berkas))).toBe(true);
    // jenis permohonan lain: tanpa pengumuman itsbat
    const dk = saranBlangkoLengkap(sidang(JENIS[4], { urutanSidang: 1, hadirSebelumnya: null, agenda: "Sidang Pertama" })).relaas;
    expect(dk.some((r) => /Pengumuman/.test(r.berkas))).toBe(false);
    expect(dk[0].berkas).toMatch(/Panggilan Sidang Pertama P/);
  });
  it("gugatan sidang 1: panggilan Penggugat DAN Tergugat masing-masing blangko pihaknya", () => {
    const h = saranBlangkoLengkap(sidang(JENIS[0], { urutanSidang: 1, hadirSebelumnya: null, agenda: "Sidang Pertama", lewatEcourt: false })).relaas;
    expect(h.map(berkas)).toEqual(expect.arrayContaining([expect.stringMatching(/Sidang Pertama P\.rtf/), expect.stringMatching(/Sidang Pertama T\.rtf/)]));
  });
  it("sidang lanjutan: pihak yang tidak hadir pada sidang sebelumnya; voluntair selalu Pemohon; kehadiran sidang ini (bila ada) menang", () => {
    const cg = JENIS[0];
    const t = saranBlangkoLengkap(sidang(cg, { hadirSebelumnya: 2, lewatEcourt: false })).relaas;
    expect(t[0].berkas).toMatch(/\(Sidang Lanjutan\)|Sidang T/);
    expect(t[0].berkas).toMatch(/\bT\b/);
    expect(t[0].alasan).toContain("Tergugat");
    expect(t[0].alasan).toContain("sidang sebelumnya");
    const p = saranBlangkoLengkap(sidang(cg, { hadirSebelumnya: 3, lewatEcourt: false })).relaas;
    expect(p[0].berkas).toMatch(/Sidang P \(Sidang Lanjutan\)/);
    expect(p[0].alasan).toContain("Penggugat");
    // kehadiran sidang ini tercatat (4 = tidak ada) tetapi belum ditandai ditunda: kedua pihak
    const keduanya = saranBlangkoLengkap(sidang(cg, { dihadiriOleh: 4, hadirSebelumnya: 1, lewatEcourt: false, ditunda: false })).relaas;
    expect(keduanya.map(berkas)).toEqual(expect.arrayContaining([expect.stringMatching(/Sidang P \(Sidang Lanjutan\)/), expect.stringMatching(/Sidang T \(Sidang Lanjutan\)/)]));
    expect(keduanya[0].keyakinan).toBe("pasti");
    // voluntair, Pemohon tidak hadir
    const vol = saranBlangkoLengkap(sidang(JENIS[4], { dihadiriOleh: 4, ditunda: false, lewatEcourt: false })).relaas;
    expect(vol[0].berkas).toMatch(/Sidang P \(Sidang Lanjutan\)/);
    expect(vol.some((r) => /Sidang T/.test(r.berkas))).toBe(false);
  });
  it("agenda memutus: pemberitahuan putusan/penetapan kepada pihak yang tidak hadir; perkara voluntair hanya Pemohon", () => {
    const g = saranBlangkoLengkap(sidang(JENIS[0], { agenda: "Putusan", hadirSebelumnya: 2, lewatEcourt: false })).relaas;
    expect(g[0].berkas).toMatch(/Pemberitahuan Putusan T/);
    const v = saranBlangkoLengkap(sidang(JENIS[5], { agenda: "Pembacaan Penetapan", hadirSebelumnya: 3, lewatEcourt: false })).relaas;
    expect(v[0].berkas).toMatch(/Pemberitahuan Putusan P/);
    expect(v.some((r) => /Pemberitahuan Putusan T/.test(r.berkas))).toBe(false);
  });
  it("kehadiran sidang ini tercatat lengkap (semua hadir): tidak ada relaas (keputusan lama dipertahankan); belum tercatat tetapi sidang sebelumnya lengkap: saran bersyarat", () => {
    expect(saranBlangkoLengkap(sidang(JENIS[0], { agenda: "Putusan", dihadiriOleh: 1, sudahPutus: true, statusPutusan: "Ditolak", lewatEcourt: false })).relaas).toEqual([]);
    expect(saranBlangkoLengkap(sidang(JENIS[2], { dihadiriOleh: 2, lewatEcourt: false })).relaas).toEqual([]); // voluntair: Pemohon hadir
    const h = saranBlangkoLengkap(sidang(JENIS[0], { dihadiriOleh: null, hadirSebelumnya: 1, lewatEcourt: false })).relaas;
    expect(h.length).toBeGreaterThan(0);
    expect(h[0].alasan).toContain("hanya bila");
    expect(h[0].keyakinan).toBe("perkiraan");
  });
  it("cerai talak: sidang ikrar yang belum tercatat -> panggilan ikrar; sudah putus kabul -> panggilan ikrar sebagai alternatif", () => {
    const ikrar = saranBlangkoLengkap({ jenisPerkara: "Cerai Talak", nomorPerkara: "9/Pdt.G/2026/PA.Dgl", urutanSidang: 6, dihadiriOleh: 1, agenda: "Sidang Ikrar Talak", sidangIkrarTalak: true, sudahPutus: true, statusPutusan: "Dikabulkan" });
    expect(ikrar.relaas[0].berkas).toMatch(/Panggilan Ikrar Talak P dan T/);
    const putus = saranBlangkoLengkap({ jenisPerkara: "Cerai Talak", nomorPerkara: "9/Pdt.G/2026/PA.Dgl", urutanSidang: 3, dihadiriOleh: null, hadirSebelumnya: 2, agenda: "Putusan", sudahPutus: true, statusPutusan: "Dikabulkan" });
    expect(putus.relaas.some((r) => /Panggilan Ikrar Talak/.test(r.berkas))).toBe(true);
    expect(putus.relaas[0].utama).toBe(true);
    expect(putus.relaas[0].berkas).toMatch(/Pemberitahuan Putusan T/); // pemberitahuan putusan kepada Termohon lebih dulu; panggilan ikrar menyusul
  });
  it("pencegahan perkawinan (jenis 342): panggilan memakai blangko Pemohon khusus", () => {
    const j = JENIS.find((x) => x.id === 342)!;
    const h = saranBlangkoLengkap(sidang(j, { urutanSidang: 1, hadirSebelumnya: null, agenda: "Sidang Pertama" })).relaas;
    expect(h[0].berkas).toMatch(/11\.1/);
  });
});

// ----------------------------------------------------------------------------
describe("E. PTSP (penetapan)", () => {
  const ptsp = (m: MasukanRekomendasi) => saranBlangkoLengkap(m).ptsp!;
  const PTSP_FOLDER = "derry_briantono/99 PTSP";
  it("perkara baru menuju sidang pertama: gabungan PMH-PHS lebih dulu; semua di folder PTSP", () => {
    const h = ptsp(sidang(JENIS[2], { urutanSidang: 1, hadirSebelumnya: null, agenda: "Sidang Pertama" }));
    expect(h[0]).toMatchObject({ jenis: "ptsp", berkas: "@ 0 - PMH - PHS.rtf", utama: true, folder: PTSP_FOLDER });
    expect(h.every((r) => r.jenis === "ptsp" && r.folder === PTSP_FOLDER)).toBe(true);
    expect(h.map(berkas)).toEqual(expect.arrayContaining(["@ 2 - PHS.rtf", "@ 1 - PMH.rtf", "@ 0a - PPP.rtf", "@ 0b - PJS.rtf"]));
    expect(h[0].alias).toContain("Form PTSP");
  });
  it("petugas belum tertunjuk didahulukan: majelis -> PMH, panitera -> PPP, juru sita -> PJS", () => {
    expect(ptsp(sidang(JENIS[0], { majelisAda: false, paniteraAda: true, jurusitaAda: true }))[0].berkas).toBe("@ 1 - PMH.rtf");
    expect(ptsp(sidang(JENIS[0], { majelisAda: true, paniteraAda: false, jurusitaAda: true }))[0].berkas).toBe("@ 0a - PPP.rtf");
    expect(ptsp(sidang(JENIS[0], { majelisAda: true, paniteraAda: true, jurusitaAda: false }))[0].berkas).toBe("@ 0b - PJS.rtf");
    const semua = ptsp(sidang(JENIS[0], { majelisAda: false, paniteraAda: false, jurusitaAda: false }));
    expect(semua.slice(0, 3).map(berkas)).toEqual(["@ 1 - PMH.rtf", "@ 0a - PPP.rtf", "@ 0b - PJS.rtf"]);
    expect(semua[0].keyakinan).toBe("pasti");
  });
  it("sidang ditunda: penetapan hari sidang pasti; sidang lanjutan belum tercatat: perkiraan", () => {
    const ditunda = ptsp(sidang(JENIS[0], { ditunda: true, dihadiriOleh: 2 }));
    expect(ditunda[0]).toMatchObject({ berkas: "@ 2 - PHS.rtf", perkiraan: false, keyakinan: "pasti" });
    const belum = ptsp(sidang(JENIS[0]));
    expect(belum[0]).toMatchObject({ berkas: "@ 2 - PHS.rtf", perkiraan: true });
  });
  it("sidang ikrar talak: PHS ikrar (lanjutan bila ditunda); mediasi: penunjukan mediator; perkara bersita: PHS sita ikut", () => {
    const ikrar = ptsp({ jenisPerkara: "Cerai Talak", nomorPerkara: "9/Pdt.G/2026/PA.Dgl", urutanSidang: 6, dihadiriOleh: 1, agenda: "Sidang Ikrar Talak", sidangIkrarTalak: true });
    expect(ikrar[0].berkas).toBe("@ 3a - PHS Ikrar Talak.rtf");
    const lanjut = ptsp({ jenisPerkara: "Cerai Talak", nomorPerkara: "9/Pdt.G/2026/PA.Dgl", urutanSidang: 7, dihadiriOleh: 3, agenda: "Sidang Ikrar Talak", sidangIkrarTalak: true, ditunda: true });
    expect(lanjut[0].berkas).toBe("@ 3b - PHS Ikrar Talak Lanjutan.rtf");
    const mediasi = ptsp(sidang(JENIS[0], { urutanSidang: 1, hadirSebelumnya: null, agenda: "Mediasi" }));
    expect(mediasi[0].berkas).toBe("@ 4 - Penetapan Penunjukan Mediator.rtf");
    const laporan = ptsp(sidang(JENIS[0], { agenda: "Laporan hasil mediasi" }));
    expect(laporan[0].berkas).not.toMatch(/Mediator/);
    const sita = ptsp(sidang(JENIS[9], { bersita: true }));
    expect(sita.map(berkas)).toEqual(expect.arrayContaining(["@ 2a - PHS - Sita Dikabulkan.rtf", "@ 2b - PHS - Sita Ditolak.rtf"]));
    expect(ptsp(sidang(JENIS[9])).some((r) => /Sita/.test(r.berkas))).toBe(false);
  });
});

// ----------------------------------------------------------------------------
describe("F. jaminan tidak kosong dan bahan masukan dari baris jadwal", () => {
  const AGENDA = ["Sidang Pertama", "Pembuktian", "Mediasi", "Musyawarah Majelis", "Pembacaan Putusan", "Panggil Tergugat", "Kesimpulan", "Jawaban"];
  it("semua jenis x sidang ke-1..3 x agenda x kehadiran: putusan, BAS, relaas dan PTSP tidak pernah kosong; tepat satu utama putusan", () => {
    let diperiksa = 0;
    for (const j of JENIS) {
      for (const u of [1, 2, 3]) {
        for (const agenda of AGENDA) {
          for (const hadir of [null, 1, 2, 4]) {
            const h = saranBlangkoLengkap(sidang(j, { urutanSidang: u, agenda, dihadiriOleh: hadir, hadirSebelumnya: u > 1 ? 2 : null }));
            const pesan = `${j.nama}/${j.nomor.split("/")[1]} sidang ${u} "${agenda}" hadir=${hadir}`;
            expect(h.putusan.length, `putusan ${pesan}`).toBeGreaterThan(0);
            // Kecuali kehadiran sidang ini tercatat lengkap (1 = semua hadir; permohonan: 1 atau 2): tidak ada yang dipanggil.
            const lengkapHadir = hadir === 1 || (hadir === 2 && perkaraVoluntair(sidang(j)));
            if (!lengkapHadir) expect(h.relaas.length, `relaas ${pesan}`).toBeGreaterThan(0);
            else expect(h.relaas, `relaas ${pesan}`).toEqual([]);
            expect(h.ptsp!.length, `ptsp ${pesan}`).toBeGreaterThan(0);
            expect(h.bas.length, `bas ${pesan}`).toBeGreaterThan(0);
            expect(h.putusan.filter((r) => r.utama).length, `utama putusan ${pesan}`).toBeLessThanOrEqual(1);
            for (const k of ["bas", "putusan", "relaas", "ptsp"] as const) for (const r of h[k] ?? []) expect(["pasti", "cukup", "perkiraan"]).toContain(r.keyakinan);
            diperiksa += 1;
          }
        }
      }
    }
    expect(diperiksa).toBe(JENIS.length * 3 * AGENDA.length * 4);
  });
  it("alasan tidak memuat istilah teknis yang disaring tampilan (folder, alur, kode berkas, .rtf, peta, tingkat)", () => {
    const larang = /\bfolder\b|\balur\b|salinan|\.rtf|\[[0-9a-z]+\]|katalog|\bkode\b|\bpeta\b|tingkat/i;
    for (const j of JENIS) {
      const h = saranBlangkoLengkap(sidang(j));
      for (const r of [...h.putusan, ...h.relaas, ...(h.ptsp ?? [])]) expect(r.alasan, `${j.nama}: ${r.alasan}`).not.toMatch(larang);
    }
  });
  it("tanpa jenis perkara: kosong semua (tidak menebak)", () => {
    const h = saranBlangkoLengkap({ jenisPerkara: "" });
    expect([h.bas, h.putusan, h.relaas, h.ptsp]).toEqual([[], [], [], []]);
  });
  it("masukanRekomendasiDariBaris membawa alur, jumlah pihak, dan petugas tertunjuk; ruas yang tak terkirim dibiarkan kosong", () => {
    const m = masukanRekomendasiDariBaris({
      jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah",
      nomorPerkara: "228/Pdt.P/2026/PA.Dgl",
      alurPerkaraId: 16,
      pihak: { penggugat: ["A", "B"], tergugat: [] },
      majelisNama: "Drs. X",
      paniteraNama: "",
      jurusitaNama: "Y",
    });
    expect(m).toMatchObject({ alurPerkaraId: 16, jumlahPemohon: 2, jumlahTermohon: 0, majelisAda: true, paniteraAda: false, jurusitaAda: true });
    const kosong = masukanRekomendasiDariBaris({ jenisPerkara: "Cerai Gugat" });
    expect(kosong.jumlahPemohon).toBeUndefined();
    expect(kosong.majelisAda).toBeUndefined();
    expect(kosong.paniteraAda).toBeUndefined();
    expect(kosong.alurPerkaraId).toBeNull();
  });
  it("statusDariTeks: kata biasa pada agenda -> status; 'no.' dalam kalimat bukan NO", () => {
    expect(statusDariTeks("Pemohon mencabut")).toBe("Dicabut");
    expect(statusDariTeks("perkara gugur")).toBe("Digugurkan");
    expect(statusDariTeks("Putusan NO")).toBe("Tidak Dapat Diterima");
    expect(statusDariTeks("tidak dapat diterima")).toBe("Tidak Dapat Diterima");
    expect(statusDariTeks("Putusan: ditolak")).toBe("Ditolak");
    expect(statusDariTeks("Akta perdamaian")).toBe("Perdamaian");
    expect(statusDariTeks("Pembuktian")).toBeNull();
    expect(statusDariTeks("lihat no. 12 pada berkas")).toBeNull();
  });
});

// ----------------------------------------------------------------------------
describe("G. ekstensi: ruas ptsp diteruskan dan nama berkas saran dicocokkan toleran", () => {
  const sumber = baca("ekstensi-sipp/blangko-derry-isian.js");
  // Irisan murni: dari JENIS_DARI_PORTAL sampai kunciSidangSaran, dijalankan sungguhan dengan pembantu minimal.
  const a = sumber.indexOf("const JENIS_DARI_PORTAL");
  const b = sumber.indexOf("const kunciSidangSaran");
  const irisan = sumber.slice(a, b);
  const potong = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  // eslint-disable-next-line no-new-func
  const murni = new Function("potong", `${irisan}\n return { saranDariPortal, samaBerkasSaran, kelompokUntukSaran, JENIS_DARI_PORTAL };`)(potong) as {
    saranDariPortal: (hasil: unknown, menu: unknown[], opsi: Record<string, unknown>) => Array<{ berkas: string; kelompok: string; jenis: string; alasan: string; utama: boolean }>;
    samaBerkasSaran: (x: string, y: string) => boolean;
    JENIS_DARI_PORTAL: Record<string, string>;
  };

  it("saranDariPortal meneruskan ruas ptsp sebagai jenis 'ptsp' dengan kelompok dari menu/alias; portal lama tanpa ruas ptsp tidak menghasilkan saran PTSP", () => {
    const hasil = saranBlangkoLengkap(sidang(JENIS[2], { urutanSidang: 1, hadirSebelumnya: null, agenda: "Sidang Pertama" }));
    const polos = JSON.parse(JSON.stringify(hasil));
    const menu = [{ nama: "Putusan Itsbat Nikah" }, { nama: "Itsbat Nikah - BAS" }, { nama: "Form PTSP" }, { nama: "Relaas dan PBT (Blangko Derry)" }];
    const out = murni.saranDariPortal(polos, menu, { urutan: 1, jenis: ["ptsp", "put"] });
    const ptspOut = out.filter((x) => x.jenis === "ptsp");
    expect(ptspOut[0]).toMatchObject({ berkas: "@ 0 - PMH - PHS", kelompok: "Form PTSP", utama: true });
    expect(ptspOut[0].alasan).toContain("(perkiraan, periksa kembali)");
    // jenis yang boleh dipakai akun (opsi.jenis) lebih dulu: BAS dan relaas menyusul sesudah seluruh ptsp/put
    const terakhirBoleh = Math.max(...out.map((x, i) => (["ptsp", "put"].includes(x.jenis) ? i : -1)));
    const pertamaLain = out.findIndex((x) => x.jenis === "bas" || x.jenis === "rel");
    expect(pertamaLain).toBeGreaterThan(terakhirBoleh);
    // batas alternatif per jenis tetap tiga
    for (const j of ["put", "bas", "rel", "ptsp"]) expect(out.filter((x) => x.jenis === j && !x.utama).length).toBeLessThanOrEqual(3);
    const lama = JSON.parse(JSON.stringify({ ...hasil, ptsp: undefined }));
    expect(murni.saranDariPortal(lama, menu, {}).some((x) => x.jenis === "ptsp")).toBe(false);
    expect(murni.JENIS_DARI_PORTAL).toEqual({ putusan: "put", bas: "bas", relaas: "rel", ptsp: "ptsp" });
  });
  it("samaBerkasSaran: tanpa .rtf, spasi ganda, dan huruf besar-kecil tidak dibedakan; berkas berbeda tetap berbeda", () => {
    expect(murni.samaBerkasSaran("[01] [Kabul] IN.rtf", "[01] [Kabul] IN")).toBe(true);
    expect(murni.samaBerkasSaran("[01]  [Kabul] IN", "[01] [kabul] in.RTF")).toBe(true);
    expect(murni.samaBerkasSaran("[01] [Kabul] IN", "[03] [Tolak] IN")).toBe(false);
    expect(murni.samaBerkasSaran("", "")).toBe(false);
  });
  it("rute jadwal sidang memakai saran lengkap untuk ?rekomendasi=1 (bukan rekomendasi lama)", () => {
    const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang/route.ts");
    expect(rute).toMatch(/rekomendasiBlangko:\s*saranBlangkoLengkap\(/);
    expect(rute).not.toMatch(/rekomendasiBlangko:\s*rekomendasiBlangko\(/);
  });
});
