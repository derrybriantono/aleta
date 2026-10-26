// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  MUAT_PIHAK,
  TURUT_SEBARIS,
  bersihkanPihak,
  gabungLampiran,
  jumlahDariDaftar,
  perluLampiran,
  pihakBanyak,
  romawi,
  type PihakLampiran,
} from "@/lib/lampiran-pihak";
import {
  barisDepanSampul,
  barisTurut,
  bersihkanAnak,
  bersihkanObjek,
  bersihkanSidang,
  kolomPihakSampul,
  muatPihakSampul,
  susunLampiran,
  type BahanLampiran,
} from "@/lib/lampiran-sampul";

/**
 * Sampul cetak awal versi 6: pihak banyak (dua kolom nama bernomor romawi, batas tampil 8 per sisi berlawanan / 12 permohonan, turut tergugat tiga
 * sebaris) dan Lampiran Daftar Para Pihak di halaman kedua RTF hanya bila perlu; deteksi ciri susulan di bot (baca saja, data rekaan).
 */

const AKAR = path.resolve(__dirname, "../../..");
const bot: any = createRequire(import.meta.url)(path.join(AKAR, "aleta_bot/services/berkasPerkaraService.js"));

const pihak = (sisi: 1 | 2 | 3 | 4, n: number): PihakLampiran[] => Array.from({ length: n }, (_, i) => ({ sisi, urutan: i + 1, nama: `Nama ${sisi}-${i + 1}`, alamat: `Alamat ${i + 1}` }));

describe("pihak banyak dan lampiran", () => {
  it("angka romawi", () => {
    expect([1, 2, 4, 9, 14, 19, 40, 49].map(romawi)).toEqual(["I", "II", "IV", "IX", "XIV", "XIX", "XL", "XLIX"]);
  });

  it("batas: lampiran bila melebihi muat sampul, ada intervensi, atau turut tergugat lebih dari tiga", () => {
    expect(MUAT_PIHAK).toEqual({ lawan: 8, permohonan: 12 });
    expect(TURUT_SEBARIS).toBe(3);
    const j = (p1: number, p2 = 0, p3 = 0, p4 = 0) => ({ p1, p2, p3, p4 });
    expect(pihakBanyak(j(1, 1))).toBe(false);
    expect(pihakBanyak(j(2, 1))).toBe(true);
    expect(pihakBanyak(j(1, 1, 0, 1))).toBe(true);
    expect(perluLampiran(j(8, 8), true)).toBe(false);
    expect(perluLampiran(j(9, 1), true)).toBe(true);
    expect(perluLampiran(j(1, 9), true)).toBe(true);
    expect(perluLampiran(j(12), false)).toBe(false);
    expect(perluLampiran(j(13), false)).toBe(true);
    expect(perluLampiran(j(2, 2, 0, 3), true)).toBe(false);
    expect(perluLampiran(j(2, 2, 0, 4), true)).toBe(true);
    expect(perluLampiran(j(2, 2, 1, 0), true)).toBe(true);
  });

  it("menyaring kiriman klien: sisi sah, teks pendek, tanpa kontrol, tanpa nama aplikasi", () => {
    const h = bersihkanPihak([
      { sisi: 1, urutan: 1, nama: "  A\u0000B  ", alamat: "Jl. X" },
      { sisi: 5, nama: "salah sisi" },
      { sisi: 2, nama: "" },
      { sisi: 2, nama: "ada aleta", alamat: "x" },
      { sisi: 4, urutan: 2, nama: "T", alamat: "alamat aleta" },
      "bukan objek",
    ]);
    expect(h).toEqual([
      { sisi: 1, urutan: 1, nama: "A B", alamat: "Jl. X" },
      { sisi: 4, urutan: 2, nama: "T", alamat: "" },
    ]);
    expect(bersihkanPihak("x")).toEqual([]);
    expect(bersihkanPihak(Array.from({ length: 900 }, (_, i) => ({ sisi: 1, urutan: i + 1, nama: `n${i}` }))).length).toBe(500);
    expect(jumlahDariDaftar([...pihak(1, 3), ...pihak(4, 2)])).toEqual({ p1: 3, p2: 0, p3: 0, p4: 2 });
  });

  it("muat pihak: permohonan 12; berlawanan 8, atau 6 bila info khas sudah dua baris", () => {
    expect(muatPihakSampul(false, 5)).toBe(12);
    expect(muatPihakSampul(true, 0)).toBe(8);
    expect(muatPihakSampul(true, 1)).toBe(8);
    expect(muatPihakSampul(true, 2)).toBe(6);
  });

  it("kolom pihak sampul: nama bernomor romawi dua kolom, lebih dari muat dipotong dengan rujukan lampiran", () => {
    const k = kolomPihakSampul(pihak(1, 5), 8, 1);
    expect(k.kiri).toBe("II. Nama 1-2\nIII. Nama 1-3");
    expect(k.kanan).toBe("IV. Nama 1-4\nV. Nama 1-5");
    expect(k.sisa).toBe(0);
    const lebih = kolomPihakSampul(pihak(1, 14), 8, 1);
    expect(lebih.kiri.split("\n")).toHaveLength(3);          // 6 nama sesudah pihak I (muat 8 - 2): kiri 3
    expect(lebih.kanan).toContain("VII. Nama 1-7");
    expect(lebih.kanan).toContain("dan 7 lainnya - lengkap di Lampiran 1 Daftar Para Pihak");
    expect(lebih.sisa).toBe(7);
    expect(kolomPihakSampul(pihak(1, 1), 8, 1)).toEqual({ kiri: "", kanan: "", sisa: 0 });
    expect(barisTurut(pihak(4, 2), 1)).toBe("TURUT TERGUGAT (2)  I. Nama 4-1  -  II. Nama 4-2");
    expect(barisTurut(pihak(4, 5), 2)).toContain("dan 2 lainnya (Lampiran 2)");
    expect(barisTurut([], 1)).toBe("");
  });

  const bahan = (o: Partial<BahanLampiran> = {}): BahanLampiran => ({ nomor: "64/Pdt.G/2026/PA.Cth", lebar: 10506, lawan: true, pihak: [], anak: [], objek: [], riwayat: [], barisRiwayat: 15, ...o });

  it("lampiran HANYA bila perlu: tanpa syarat terpenuhi tidak ada lampiran dan kaki kosong", () => {
    const h = susunLampiran(bahan({ pihak: [...pihak(1, 6), ...pihak(2, 6), ...pihak(4, 3)], anak: [{ nama: "A", umur: "5", diasuh: "P" }], objek: [{ nama: "Tanah", letak: "x" }, { nama: "Rumah", letak: "y" }] }));
    expect(h.daftar).toEqual([]);
    expect(h.bagianRtf).toBe("");
    expect(h.kaki).toBe("");
    expect(h.barisDepan).toEqual(["Anak: A (5 th, diasuh Penggugat)", "Objek sengketa: Tanah; Rumah"]);
    expect(h.muatPihak).toBe(6);   // info khas (anak + objek) sudah dua baris: muat berlawanan 6; enam nama per sisi masih muat
  });

  it("info khas dua baris menurunkan muat berlawanan ke 6: delapan nama per sisi lalu perlu lampiran pihak", () => {
    const h = susunLampiran(bahan({ pihak: [...pihak(1, 8), ...pihak(2, 2)], anak: [{ nama: "A", umur: "", diasuh: "" }], objek: [{ nama: "Tanah", letak: "" }] }));
    expect(h.muatPihak).toBe(6);
    expect(h.daftar.map((d) => d.kunci)).toEqual(["pihak"]);
    expect(h.daftar[0].alasan).toContain("pihak I berjumlah 8 orang");
    expect(h.daftar[0].alasan).toContain("muat di sampul 6");
  });

  it("empat lampiran bernomor berurutan, alasan di subjudul, rujukan di baris depan dan kaki", () => {
    const sidang = Array.from({ length: 19 }, (_, i) => ({ ke: i + 1, tanggal: "2026-03-12", hadir: "P T", agenda: `Sidang ${i + 1}`, alasan: "" }));
    const h = susunLampiran(
      bahan({
        pihak: [...pihak(1, 10), ...pihak(2, 2), ...pihak(4, 4)],
        anak: [1, 2, 3, 4].map((i) => ({ nama: `Anak ${i}`, umur: String(i), diasuh: i % 2 ? ("P" as const) : ("T" as const) })),
        objek: [1, 2, 3].map((i) => ({ nama: `Objek ${i}`, letak: `Letak ${i}` })),
        riwayat: sidang,
        sebutan: { 1: "Penggugat", 2: "Tergugat" },
      })
    );
    expect(h.daftar.map((d) => [d.nomor, d.kunci])).toEqual([[1, "pihak"], [2, "objek"], [3, "anak"], [4, "riwayat"]]);
    expect(h.barisDepan).toEqual(["Anak: 4 anak - rincian di Lampiran 3", "Objek sengketa: 3 objek - rincian di Lampiran 2"]);
    expect(h.kaki).toBe("Lampiran (4): 1. DAFTAR PARA PIHAK; 2. DAFTAR OBJEK SENGKETA; 3. DAFTAR ANAK; 4. RIWAYAT SIDANG lanjutan");
    const r = h.bagianRtf;
    expect(r.startsWith("\\page")).toBe(true);
    for (const t of ["LAMPIRAN 1 - DAFTAR PARA PIHAK", "LAMPIRAN 2 - DAFTAR OBJEK SENGKETA", "LAMPIRAN 3 - DAFTAR ANAK", "LAMPIRAN 4 - RIWAYAT SIDANG (LANJUTAN)"]) expect(r).toContain(t);
    expect(r).toContain("Halaman 2 sampul berkas - dicetak karena pihak I berjumlah 10 orang");
    expect(r).toContain("PENGGUGAT (10)");
    expect(r).toContain("TURUT TERGUGAT (4)");
    expect(r).toContain("Penggugat X");
    expect(r).toContain("Turut Tergugat IV");
    expect(r).toContain("Letak 3");
    expect(r).toContain("DIASUH OLEH");
    expect(r).toContain("4 th");
    // riwayat lanjutan: sidang 16-19 diisi, baris sisa kosong sampai 15 baris, nomor melanjutkan 16
    expect((r.match(/Sidang 1[6-9]/g) ?? []).length).toBe(4);
    expect(r).not.toContain("Sidang 15");
    expect(r).toContain("12 Maret 2026");
    expect(r.toLowerCase()).not.toContain("aleta");
  });

  it("riwayat lanjutan hanya bila sidang melebihi baris sampul; lebih dari 15 sisa menjadi halaman bertingkat", () => {
    const sidang = (n: number) => Array.from({ length: n }, (_, i) => ({ ke: i + 1, tanggal: "2026-03-12", hadir: "P", agenda: "a", alasan: "" }));
    expect(susunLampiran(bahan({ riwayat: sidang(15) })).daftar).toEqual([]);
    const satu = susunLampiran(bahan({ riwayat: sidang(16) }));
    expect(satu.daftar.map((d) => d.kunci)).toEqual(["riwayat"]);
    const banyak = susunLampiran(bahan({ riwayat: sidang(40) }));
    expect(banyak.bagianRtf).toContain("(LANJUTAN 2/2)");
    expect(banyak.bagianRtf).toContain("(LANJUTAN 1/2)");
  });

  it("saringan klien: anak, objek, sidang; teks bernama aplikasi dan kontrol dibuang", () => {
    expect(bersihkanAnak([{ nama: " Anak\u0000 Satu ", umur: "7", diasuh: "T" }, { nama: "aleta" }, { nama: "" }, { nama: "B", umur: "tujuh", diasuh: "?" }])).toEqual([
      { nama: "Anak Satu", umur: "7", diasuh: "T" },
      { nama: "B", umur: "", diasuh: "" },
    ]);
    expect(bersihkanObjek([{ nama: "Tanah", letak: "Jl. A", ket: "diminta sita" }, { nama: "x", letak: "aleta" }])).toEqual([
      { nama: "Tanah", letak: "Jl. A", ket: "diminta sita" },
      { nama: "x", letak: "", ket: "" },
    ]);
    expect(bersihkanSidang([{ ke: 3, tanggal: "2026-01-01", hadir: "P T", agenda: "a", alasan: "b" }, { ke: 0 }])).toHaveLength(1);
    expect(barisDepanSampul([], [], {}, { p: "Penggugat", t: "Tergugat" })).toEqual([]);
  });

  it("gabung: bagian kedua masuk sebelum kurung tutup dokumen", () => {
    const utama = "{\\rtf1\\ansi isi}\n";
    const gabung = gabungLampiran(utama, "\\page LAMP");
    expect(gabung).toBe("{\\rtf1\\ansi isi\\page LAMP}\n");
    expect(gabungLampiran("bukan rtf}", "x")).toBe("bukan rtf}");
  });
});

describe("deteksi ciri susulan (bot, murni)", () => {
  const d = (b: Record<string, unknown>) => bot.deteksiSusulan(b);

  it("tanpa data: tidak ada yang dicentang", () => {
    expect(d({})).toEqual({});
  });

  it("permintaan sita: petitum atau posita menyebut sita; Jurusita bukan sita", () => {
    expect(d({ petitum: "menetapkan sita jaminan atas rumah" })).toHaveProperty("sita", "petitum/posita");
    expect(d({ petitum: "conservatoir beslag" })).toHaveProperty("sita");
    expect(d({ petitum: "jurusita menyampaikan" })).toEqual({});
    expect(d({ proses: ["Jurusita Pengganti"] })).toEqual({});
    expect(d({ proses: ["Penetapan Sita"] })).toHaveProperty("sita", "proses SIPP");
  });

  it("eksepsi, rekonvensi, mediasi, putusan sela dari sumber yang ada (e-Court/SIPP) dan agenda", () => {
    const h = d({ eksepsi: true, rekonvensi: true, mediasi: true, sela: true });
    expect(h).toMatchObject({ eksepsi: "jawaban e-Court", rekonvensi: "perkara_rekonvensi / jawaban e-Court", mediasi: "perkara_mediasi", sela: "putusan sela SIPP" });
    expect(d({ agenda: ["Duplik Rekonvensi"] })).toHaveProperty("rekonvensi", "agenda sidang");
    expect(d({ agenda: ["Jawaban dan eksepsi Tergugat"] })).toHaveProperty("eksepsi", "agenda sidang");
    expect(d({ agenda: ["Pembacaan Putusan Sela"] })).toHaveProperty("sela");
  });

  it("pemeriksaan setempat, perubahan gugatan, perbaikan permohonan, tambahan panjar, pencabutan, anak, pengumuman", () => {
    expect(d({ setempatBiaya: true })).toHaveProperty("setempat", "biaya pemeriksaan setempat");
    expect(d({ agenda: ["Pelaksanaan pemeriksaan setempat"] })).toHaveProperty("setempat", "agenda sidang");
    expect(d({ agenda: ["Descente"] })).toHaveProperty("setempat");
    expect(d({ agenda: ["perbaikan gugatan Penggugat"] })).toHaveProperty("ubah");
    expect(d({ namaEcourt: ["Perubahan Gugatan.pdf"] })).toHaveProperty("ubah", "agenda/e-Court");
    expect(d({ agenda: ["perbaikan surat permohonan"] })).toHaveProperty("perbaikan");
    expect(d({ tambahanPanjar: true })).toHaveProperty("panjar", "biaya perkara");
    expect(d({ statusPutusanId: 67 })).toHaveProperty("cabut", "status putusan");
    expect(d({ statusPutusanId: 62 })).toEqual({});
    expect(d({ agenda: ["SIDANG PERTAMA, penasihatan, dicabut"] })).toHaveProperty("cabut", "agenda sidang");
    expect(d({ agenda: ["Mendengar keterangan anak dan calon pasangan"] })).toHaveProperty("anak");
    expect(d({ agenda: ["Pengumuman itsbat nikah"] })).toHaveProperty("umum");
    // sumber pertama yang menang; tidak menghapus yang lain
    expect(Object.keys(bot.deteksiSusulan({ eksepsi: true, agenda: ["eksepsi"] }))).toEqual(["eksepsi"]);
  });
});
