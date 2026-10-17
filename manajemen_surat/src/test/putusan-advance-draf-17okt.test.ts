// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bacaRtfDariBita } from "@/lib/baca-rtf";
import { bacaRtfParagraf, periksaParagraf, periksaRtf } from "@/lib/deteksi-sisa-blangko";
import { pecahNaskahResmi } from "@/lib/naskah-putusan-resmi";
import { susunRaporAdvance, type PutusanSerupaMasuk } from "@/lib/putusan-advance";
import { namaBerkasDraf, susunDrafUtuh, tandaPerlu, titikSisipPertimbangan } from "@/lib/putusan-advance-draf";
import { menyebutAleta } from "@/lib/tanda-aleta";

/**
 * Putusan Advance tahap 2 (17 Okt 2026): DRAF PUTUSAN UTUH sesudah pemeriksa.
 * Seluruh data di sini REKAAN (nama, nomor, dan isi perkara) - bukan perkara asli.
 */

const PERT = [
  "Menimbang, bahwa maksud dan tujuan gugatan Penggugat adalah sebagaimana diuraikan di atas;",
  "Menimbang, bahwa Tergugat tidak pernah datang menghadap di persidangan walaupun telah dipanggil secara resmi dan patut;",
  "Menimbang, bahwa Majelis Hakim telah menasihati Penggugat agar rukun kembali dengan Tergugat, tetapi tidak berhasil;",
  // Tanpa "keluarga": unsur keterangan keluarga/orang dekat BELUM dipertimbangkan.
  "Menimbang, bahwa berdasarkan keterangan para saksi, antara Penggugat dan Tergugat terus-menerus terjadi perselisihan dan pertengkaran, telah berpisah tempat tinggal selama satu tahun dan tidak ada harapan akan hidup rukun lagi, sehingga memenuhi Pasal 19 huruf f Peraturan Pemerintah Nomor 9 Tahun 1975 jo. Pasal 116 huruf f Kompilasi Hukum Islam;",
  "Menimbang, bahwa oleh karena itu gugatan Penggugat patut dikabulkan dengan verstek;",
  "Menimbang, bahwa berdasarkan Pasal 89 ayat (1) Undang-Undang Nomor 7 Tahun 1989 sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan Undang-Undang Nomor 50 Tahun 2009, biaya perkara dibebankan kepada Penggugat;",
].join("\n");

const AMAR = [
  "1. Menyatakan Tergugat yang telah dipanggil secara resmi dan patut tidak hadir;",
  "2. Mengabulkan gugatan Penggugat dengan verstek;",
  "3. Menjatuhkan talak satu ba'in sughra Tergugat terhadap Penggugat;",
  "4. Membebankan kepada Penggugat untuk membayar biaya perkara sejumlah Rp300.000,00;",
].join("\n");

const KEPALA = ["P U T U S A N", "Nomor 123/Pdt.G/2026/PA.Dgl", "DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA", "Pengadilan Agama Donggala"];
const IDENTITAS = ["Mawar binti Fulan, umur 30 tahun, agama Islam, pekerjaan ibu rumah tangga, sebagai Penggugat;", "melawan", "Melati bin Fulan, umur 32 tahun, agama Islam, sebagai Tergugat;"];
const DUDUK = ["Bahwa Penggugat dan Tergugat menikah pada tahun 2015;", "Bahwa sejak 2024 Penggugat dan Tergugat sering bertengkar;", "Bahwa Tergugat tidak hadir walaupun telah dipanggil secara resmi dan patut;"];
const PENUTUP = "Demikian diputuskan dalam rapat musyawarah Majelis Hakim pada hari Senin, tanggal 5 Oktober 2026";

function naskah(opsi: { kepala?: boolean; identitas?: boolean; duduk?: boolean; pert?: string; amar?: string; penutup?: boolean } = {}): string {
  const o = { kepala: true, identitas: true, duduk: true, pert: PERT, amar: AMAR, penutup: true, ...opsi };
  return [
    ...(o.kepala ? KEPALA : []),
    ...(o.identitas ? IDENTITAS : []),
    ...(o.duduk ? ["DUDUK PERKARA", ...DUDUK] : []),
    "PERTIMBANGAN HUKUM",
    o.pert,
    "MENGADILI",
    o.amar,
    ...(o.penutup ? [PENUTUP] : []),
  ].join("\n");
}

const SAKSI_LENGKAP = ["Penggugat dan Tergugat sering bertengkar dan berselisih, sudah pisah rumah, keluarga sudah merukunkan tetapi tidak berhasil, tidak ada harapan rukun lagi"];

const BUTIR_PUSTAKA = [{ id: "b1", teks: "Menimbang, bahwa keterangan keluarga dan orang dekat telah didengar sesuai Pasal 76 ayat (1) UU 7/1989;", labelAlasan: ["F"], jumlahPemakaian: 9 }];

function serupa(nomor: string, pert: string, nama: string[] = []): PutusanSerupaMasuk {
  return { nomor, tanggalPutusan: "2026-05-01", tanggalBht: "2026-05-20", pertimbangan: pert, amar: AMAR, nama };
}

function rapor(pert = PERT, tambahan: Record<string, unknown> = {}) {
  return susunRaporAdvance({
    nomorPerkara: "123/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    dudukPerkara: DUDUK.join("\n"),
    pertimbangan: pert,
    amar: AMAR,
    hurufIsian: "F",
    pustaka: BUTIR_PUSTAKA,
    ...tambahan,
  });
}

const teksRtf = (rtf: string) => bacaRtfDariBita(new Uint8Array(Buffer.from(rtf, "latin1")));

// ============================================================================
// Susunan
// ============================================================================
describe("susunan draf utuh", () => {
  it("bagian berurutan: kepala, identitas, duduk perkara, pertimbangan, amar, penutup; isi naskah blangko dibawa apa adanya", () => {
    const d = susunDrafUtuh({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl", naskah: naskah(), rapor: rapor() });
    expect(d.bagian.map((b) => b.kunci)).toEqual(["kepala", "identitas", "dudukPerkara", "pertimbangan", "amar", "penutup"]);
    const dariNaskah = d.bagian.flatMap((b) => b.paragraf).filter((p) => p.asal === "naskah").map((p) => p.teks);
    for (const baris of [...KEPALA, ...IDENTITAS, ...DUDUK, ...AMAR.split("\n"), PENUTUP, ...PERT.split("\n")]) expect(dariNaskah).toContain(baris);
    // Penanda hanya ditulis modul ini; naskah blangko tidak diubah sedikit pun.
    expect(d.bagian.find((b) => b.kunci === "amar")!.paragraf.filter((p) => p.asal === "naskah").map((p) => p.teks)).toEqual(AMAR.split("\n"));
  });

  it("unsur yang belum dipertimbangkan: penanda + alinea contoh pustaka (merah) disisipkan sebelum kalimat kesimpulan", () => {
    const r = rapor();
    const keluarga = r.alasan[0].unsur.find((u) => u.kode === "f-keluarga")!;
    expect(keluarga.dipertimbangkan).toBe(false);
    expect(keluarga.contoh[0].sumber).toBe("pustaka");

    const d = susunDrafUtuh({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl", naskah: naskah(), rapor: r });
    const pert = d.bagian.find((b) => b.kunci === "pertimbangan")!.paragraf;
    const iTanda = pert.findIndex((p) => p.tanda && /keterangan keluarga/.test(p.teks));
    expect(iTanda).toBeGreaterThan(-1);
    const iContoh = pert.findIndex((p) => p.contoh);
    const iKesimpulan = pert.findIndex((p) => /patut dikabulkan dengan verstek/.test(p.teks));
    const iNasihat = pert.findIndex((p) => /menasihati/.test(p.teks));
    expect(iTanda).toBeGreaterThan(iNasihat);
    expect(iContoh).toBe(iTanda + 1);
    expect(iKesimpulan).toBeGreaterThan(iContoh);
    expect(pert[iContoh]).toMatchObject({ merah: true, contoh: true, asal: "susun" });
    expect(pert[iContoh].teks).toBe(BUTIR_PUSTAKA[0].teks);
    expect(pert[iTanda].teks).toMatch(/alinea berikut contoh dari pustaka yang disahkan, sesuaikan dengan fakta perkara/);
    expect(pert[iTanda].teks).toContain("UU 7/1989 Pasal 76 ayat (1)");
    // Unsur yang sudah dibahas (perselisihan, pisah, rukun) tidak mendapat blok.
    expect(pert.filter((p) => p.tanda && /perselisihan|pertengkaran/.test(p.teks))).toHaveLength(0);
  });

  it("tanpa alinea contoh: hanya penanda, tanpa karangan; tanpa temuan tidak ada pasal baru", () => {
    const r = rapor(PERT, { pustaka: [] });
    const d = susunDrafUtuh({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl", naskah: naskah(), rapor: r });
    const pert = d.bagian.find((b) => b.kunci === "pertimbangan")!.paragraf;
    expect(pert.some((p) => p.contoh)).toBe(false);
    expect(pert.find((p) => p.tanda && /keterangan keluarga/.test(p.teks))!.teks).toMatch(/belum ada alinea contoh, tulis dari fakta perkara ini/);

    // Naskah lengkap (semua unsur dibahas): modul tidak menambah satu kata pun yang bukan dari naskah.
    const lengkap = PERT.replace("para saksi", "dua orang saksi dari keluarga Penggugat");
    const d2 = susunDrafUtuh({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl", naskah: naskah({ pert: lengkap }), rapor: rapor(lengkap, { keteranganSaksi: SAKSI_LENGKAP }) });
    const susun = d2.bagian.flatMap((b) => b.paragraf).filter((p) => p.asal === "susun" && !p.tanda);
    expect(susun).toEqual([]);
    expect(d2.jumlahTanda).toBe(0);
  });

  it("dasar hukum tidak dikarang: pasal yang tampil hanya dari katalog unsur, naskah, atau alinea contoh", () => {
    const d = susunDrafUtuh({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl", naskah: naskah(), rapor: rapor() });
    const pasalDiSusun = d.tanda.flatMap((t) => t.teks.match(/Pasal\s+\d+/g) ?? []);
    const sumberSah = `${PERT}\n${AMAR}\n${BUTIR_PUSTAKA[0].teks}\nPasal 76 Pasal 22 Pasal 19 Pasal 116 Pasal 31 Pasal 39 Pasal 65 Pasal 82`;
    for (const p of pasalDiSusun) expect(sumberSah).toContain(p);
  });

  it("isian blangko yang masih kosong ditandai pada bagiannya (saksi 2 di duduk perkara, biaya terpisah bila amar tak memuatnya)", () => {
    const amarTanpaBiaya = AMAR.split("\n").slice(0, 3).join("\n");
    const d = susunDrafUtuh({
      nomorPerkara: "123/Pdt.G/2026/PA.Dgl",
      naskah: naskah({ amar: amarTanpaBiaya }),
      rapor: rapor(),
      isianKosong: [
        { kode: "2022", nama: "Keterangan saksi 2", jenis: "tj" },
        { kode: "8436", nama: "Kesimpulan Penggugat" },
        { kode: "9999", nama: "Biaya perkara" },
        { kode: "8503", nama: "Alasan perceraian" },
      ],
    });
    const per = (k: string) => d.bagian.find((b) => b.kunci === k)!.paragraf.filter((p) => p.tanda).map((p) => p.teks);
    expect(per("dudukPerkara")).toContain("[perlu dilengkapi: Keterangan saksi 2 (isian blangko belum diisi)]");
    expect(per("dudukPerkara")).toContain("[perlu dilengkapi: Kesimpulan Penggugat (isian blangko belum diisi)]");
    expect(per("pertimbangan").join(" ")).toContain("Alasan perceraian (isian blangko belum diisi)");
    expect(per("biaya").join(" ")).toContain("Biaya perkara (isian blangko belum diisi)");
    expect(per("biaya").join(" ")).toContain("pihak yang dibebani dan jumlahnya belum tercantum di amar");
  });

  it("keterangan saksi yang belum memuat unsur ditandai di duduk perkara", () => {
    const r = rapor(PERT, { keteranganSaksi: ["Penggugat dan Tergugat sering bertengkar dan sudah pisah rumah"] });
    const d = susunDrafUtuh({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl", naskah: naskah(), rapor: r });
    const duduk = d.bagian.find((b) => b.kunci === "dudukPerkara")!.paragraf.filter((p) => p.tanda).map((p) => p.teks);
    expect(duduk.some((t) => /keterangan saksi yang menerangkan unsur .* belum ada di BAS/.test(t))).toBe(true);
  });

  it("amar yang berbeda dari pertimbangan: temuan perhatian tentang amar menjadi penanda sesudah amar", () => {
    const amarSalah = AMAR.replace("talak satu ba'in sughra", "talak satu raj'i");
    const r = susunRaporAdvance({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", dudukPerkara: "x", pertimbangan: PERT, amar: amarSalah, hurufIsian: "F" });
    expect(r.temuan.some((t) => t.kode === "talak-cg" && t.tingkat === "perhatian")).toBe(true);
    const d = susunDrafUtuh({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl", naskah: naskah({ amar: amarSalah }), rapor: r });
    const amar = d.bagian.find((b) => b.kunci === "amar")!.paragraf;
    expect(amar.slice(0, 4).every((p) => p.asal === "naskah")).toBe(true);
    expect(amar.slice(4).some((p) => p.tanda && /Cerai gugat dengan talak raj'i/.test(p.teks))).toBe(true);
  });

  it("naskah tanpa bagian-bagiannya: tiap bagian diganti penanda dan dicatat, tidak melempar", () => {
    const d = susunDrafUtuh({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl", naskah: "isi sembarang tanpa judul bagian", rapor: rapor("") });
    const kunci = d.bagian.map((b) => b.kunci);
    expect(kunci).toEqual(expect.arrayContaining(["kepala", "identitas", "dudukPerkara", "pertimbangan", "amar", "penutup"]));
    for (const b of d.bagian) expect(b.paragraf.every((p) => p.tanda || p.asal === "susun")).toBe(true);
    expect(d.catatan.length).toBeGreaterThanOrEqual(4);
    expect(d.jumlahTanda).toBeGreaterThanOrEqual(6);
  });

  it("duduk perkara tak terbaca: bahan isian blangko dikutip tanpa diubah di bawah penanda", () => {
    const d = susunDrafUtuh({
      nomorPerkara: "123/Pdt.G/2026/PA.Dgl",
      naskah: naskah({ duduk: false }),
      rapor: rapor(),
      bahan: [
        { kode: "5125", nama: "Posita gugatan", teks: "Bahwa Penggugat menikah dengan Tergugat tahun 2015", jenis: "teks" },
        { kode: "8436", nama: "Kesimpulan Penggugat", teks: "tetap pada gugatan semula", jenis: "teks" },
        { kode: "8503", nama: "Alasan perceraian", teks: "F", jenis: "teks" },
      ],
    });
    const duduk = d.bagian.find((b) => b.kunci === "dudukPerkara")!.paragraf;
    expect(duduk[0].tanda).toBe(true);
    const isi = duduk.filter((p) => p.asal === "naskah").map((p) => p.teks);
    expect(isi).toEqual(["Posita gugatan: Bahwa Penggugat menikah dengan Tergugat tahun 2015", "Kesimpulan Penggugat: tetap pada gugatan semula"]);
  });

  it("titik sisip: sebelum deretan kalimat kesimpulan di ujung pertimbangan", () => {
    const p = ["Menimbang, a;", "Menimbang, b;", "Menimbang, bahwa gugatan patut dikabulkan;", "Menimbang, bahwa biaya perkara dibebankan kepada Penggugat;"];
    expect(titikSisipPertimbangan(p)).toBe(2);
    expect(titikSisipPertimbangan(["Menimbang, a;", "Menimbang, b;"])).toBe(2);
    expect(titikSisipPertimbangan(["Menimbang, bahwa gugatan patut dikabulkan;"])).toBe(1);
    expect(titikSisipPertimbangan([])).toBe(0);
  });
});

// ============================================================================
// Penanda sejalan dengan deteksi sisa blangko 1.205.1
// ============================================================================
describe("penanda dan deteksi sisa blangko", () => {
  it("bentuk penanda: kurung siku tanpa kurung di dalam, di bawah 200 huruf", () => {
    expect(tandaPerlu("keterangan saksi 2")).toBe("[perlu dilengkapi: keterangan saksi 2]");
    const panjang = tandaPerlu(`${"x".repeat(400)} [dalam] kurung`);
    expect(panjang.length).toBeLessThanOrEqual(200);
    expect(panjang.slice(1, -1)).not.toMatch(/[[\]]/);
    expect(tandaPerlu("  ")).toMatch(/^\[perlu dilengkapi: .+\]$/);
  });

  it("setiap penanda terdeteksi deteksi sisa blangko pada RTF yang dihasilkan, dan jumlah sisa dilaporkan", () => {
    const d = susunDrafUtuh({
      nomorPerkara: "123/Pdt.G/2026/PA.Dgl",
      naskah: naskah(),
      rapor: rapor(),
      isianKosong: [{ kode: "2022", nama: "Keterangan saksi 2", jenis: "tj" }],
    });
    expect(d.jumlahTanda).toBeGreaterThanOrEqual(2);
    const paragraf = bacaRtfParagraf(d.rtf);
    const hasil = periksaParagraf(paragraf);
    for (const t of d.tanda) {
      const par = paragraf.find((p) => p.teks.trim() === t.teks);
      expect(par, t.teks).toBeTruthy();
      expect(hasil.temuan.some((x) => x.paragraf === par!.nomor), t.teks).toBe(true);
      // Merah DAN kurung siku: dua jalur deteksi yang berlaku di ABT/Word.
      expect(par!.merah.length).toBeGreaterThan(0);
    }
    expect(d.sisa.jumlah).toBe(periksaRtf(d.rtf).temuan.length);
    expect(d.sisa.jumlah).toBeGreaterThanOrEqual(d.jumlahTanda);
    expect(d.sisa.rincian.length).toBeGreaterThan(0);
    // Alinea contoh juga merah: dilaporkan, supaya tidak terunggah tanpa disesuaikan.
    expect(paragraf.filter((p) => p.merah.length).length).toBe(d.bagian.flatMap((b) => b.paragraf).filter((p) => p.merah).length);
  });

  it("draf tanpa penanda tidak memunculkan temuan merah atau kurung baru", () => {
    const lengkap = PERT.replace("para saksi", "dua orang saksi dari keluarga Penggugat");
    const d = susunDrafUtuh({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl", naskah: naskah({ pert: lengkap }), rapor: rapor(lengkap, { keteranganSaksi: SAKSI_LENGKAP }) });
    const hasil = periksaRtf(d.rtf);
    expect(hasil.temuan.filter((t) => t.jenis === "merah" || t.jenis === "kurung")).toEqual([]);
    expect(d.ringkas).toMatch(/tidak ada bagian yang bertanda/);
  });
});

// ============================================================================
// RTF
// ============================================================================
describe("berkas RTF", () => {
  it("ASCII murni, tanpa pembuat/penulis, dan judul bagian baku sehingga dapat dipecah kembali", () => {
    const d = susunDrafUtuh({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl", naskah: naskah(), rapor: rapor() });
    expect(d.rtf.startsWith("{\\rtf1")).toBe(true);
    // eslint-disable-next-line no-control-regex
    expect(/^[\x00-\x7f]*$/.test(d.rtf)).toBe(true);
    expect(d.rtf).not.toMatch(/\\author|\\operator|\\company|\\creatim|\\\*\\generator/);
    expect(d.rtf).toContain("{\\info{\\title Draf putusan}}");

    const pecah = pecahNaskahResmi(teksRtf(d.rtf));
    expect(pecah.bagian.kepala).toContain("Nomor 123/Pdt.G/2026/PA.Dgl");
    expect(pecah.bagian.identitas).toContain("Mawar binti Fulan");
    expect(pecah.bagian.dudukPerkara).toContain("Bahwa Penggugat dan Tergugat menikah pada tahun 2015;");
    expect(pecah.bagian.pertimbangan).toContain("Majelis Hakim telah menasihati");
    expect(pecah.bagian.amar).toContain("4. Membebankan kepada Penggugat");
    expect(pecah.bagian.penutup).toContain("Demikian diputuskan");
  });

  it("tanda baca bukan ASCII (apostrof miring, tanda kutip, huruf beraksen) tetap terbaca benar", () => {
    const pertAksen = `${PERT}\nMenimbang, bahwa mut’ah dan “nafkah iddah” diberikan secara patut;`;
    const d = susunDrafUtuh({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl", naskah: naskah({ pert: pertAksen }), rapor: rapor(pertAksen) });
    expect(teksRtf(d.rtf)).toContain("mut’ah dan “nafkah iddah” diberikan");
  });

  it("nama berkas dari nomor perkara tanpa karakter terlarang", () => {
    expect(namaBerkasDraf("123/Pdt.G/2026/PA.Dgl")).toBe("Draf putusan 123_Pdt.G_2026_PA.Dgl.rtf");
    expect(namaBerkasDraf("")).toBe("Draf putusan.rtf");
  });
});

// ============================================================================
// Tanpa tanda aplikasi di SIPP/ABT
// ============================================================================
describe("tanpa tanda aplikasi di naskah", () => {
  it("label sumber, alinea contoh, nama isian, nama berkas, dan properti berkas bersih", () => {
    const r = rapor();
    // Pustaka berlabel aplikasi (label bawaan rapor) dan satu contoh yang isinya menyebutnya.
    expect(r.alasan[0].unsur.find((u) => u.kode === "f-keluarga")!.contoh[0].label).toMatch(/ALETA/);
    const rTercemar = rapor(PERT, { pustaka: [{ ...BUTIR_PUSTAKA[0], teks: `${BUTIR_PUSTAKA[0].teks} Disusun ALETA.` }] });
    for (const lawan of [r, rTercemar]) {
      const d = susunDrafUtuh({
        nomorPerkara: "123/Pdt.G/2026/PA.Dgl",
        naskah: naskah(),
        rapor: lawan,
        isianKosong: [{ kode: "7777", nama: "Catatan A L E T A", jenis: "teks" }],
      });
      expect(menyebutAleta(d.rtf)).toBe(false);
      expect(menyebutAleta(teksRtf(d.rtf))).toBe(false);
      expect(menyebutAleta(d.namaBerkas)).toBe(false);
      expect(menyebutAleta(JSON.stringify(d.bagian))).toBe(false);
      expect(menyebutAleta(JSON.stringify(d.tanda))).toBe(false);
    }
    // Contoh yang menyebutnya tidak dipakai - diganti penanda tanpa alinea contoh.
    const dT = susunDrafUtuh({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl", naskah: naskah(), rapor: rTercemar });
    expect(dT.bagian.flatMap((b) => b.paragraf).some((p) => p.contoh)).toBe(false);
    expect(namaBerkasDraf("123/Aleta/2026")).toBe("Draf putusan.rtf");
  });

  it("nama pihak yang kebetulan memuat kata itu adalah data perkara: dibawa apa adanya", () => {
    const naskahNama = naskah().replace("Mawar binti Fulan", "Aleta binti Fulan");
    const d = susunDrafUtuh({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl", naskah: naskahNama, rapor: rapor() });
    expect(d.bagian.find((b) => b.kunci === "identitas")!.paragraf[0].teks).toContain("Aleta binti Fulan");
    expect(d.bagian.flatMap((b) => b.paragraf).filter((p) => p.asal === "susun" && menyebutAleta(p.teks))).toEqual([]);
  });
});

// ============================================================================
// Rute
// ============================================================================
const keadaan = vi.hoisted(() => ({
  aktor: { id: "usr_uji", name: "Hakim Uji", roleId: "hakim" } as Record<string, unknown>,
  menyala: true,
  serupa: null as unknown,
  butir: [] as unknown[],
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({ queryOne: async () => null, queryAll: async () => [] }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => keadaan.aktor }));
vi.mock("@/server/modules/aleta-ecourt/putusan-advance-akun", () => ({ advanceMenyalaUntuk: async () => keadaan.menyala }));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewaySippPutusanSerupa: async () => ({ ok: true, data: keadaan.serupa }),
}));
vi.mock("@/server/modules/aleta-ecourt/pustaka-pertimbangan", () => ({ cariButir: async () => keadaan.butir }));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleAdminRouteError: (galat: { status?: number; message?: string }) =>
      NextResponse.json({ ok: false, error: { message: String(galat && galat.message) } }, { status: Number(galat && galat.status) || 500 }),
  };
});

function rtfDari(teks: string): string {
  const isi = teks
    .split("\n")
    .map((p) => `{${p.replace(/\\/g, "\\\\").replace(/[{}]/g, (c) => `\\${c}`)}}\\par`)
    .join("\n");
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}\n${isi}\n}`;
}

async function panggil(badan: Record<string, unknown>) {
  const modul = await import("@/app/api/aleta-ecourt/putusan/advance/route");
  const req = new NextRequest("http://localhost/api/aleta-ecourt/putusan/advance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(badan),
  });
  const res = await modul.POST(req);
  return { status: res.status, isi: (await res.json()) as { data?: Record<string, any>; error?: { message: string } } };
}

describe("rute: tindakan draf", () => {
  const dasar = () => ({
    rtfBase64: Buffer.from(rtfDari(naskah()), "latin1").toString("base64"),
    nomorPerkara: "123/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    huruf: "F",
  });

  beforeEach(() => {
    keadaan.aktor = { id: "usr_uji", name: "Hakim Uji", roleId: "hakim" };
    keadaan.menyala = true;
    keadaan.butir = BUTIR_PUSTAKA;
    keadaan.serupa = {
      ok: true,
      perkara: { nomor: "123/Pdt.G/2026/PA.Dgl", jenis: "Cerai Gugat" },
      hakim: { nama: "Hakim Rahasia" },
      kandidat: [1, 2, 3].map((n) => serupa(`${n}/Pdt.G/2025/PA.Dgl`, PERT, ["Siti Rekaan binti Usman", "Ahmad Rekaan bin Lamusu"])),
    };
  });

  afterEach(() => vi.restoreAllMocks());

  it("pemeriksa dihitung ulang di peladen, draf utuh dikirim sebagai RTF base64, nama pembanding tidak bocor", async () => {
    const { status, isi } = await panggil({ ...dasar(), tindakan: "draf", isianKosong: [{ kode: "2022", nama: "Keterangan saksi 2", jenis: "tj" }], bahan: [] });
    expect(status).toBe(200);
    const d = isi.data!;
    expect(d.ok).toBe(true);
    expect(d.ringkasRapor).toMatch(/perhatian/);
    expect(d.draf.rtf).toBeUndefined();
    const rtf = Buffer.from(d.draf.rtfBase64, "base64").toString("latin1");
    expect(rtf.startsWith("{\\rtf1")).toBe(true);
    expect(d.draf.namaBerkas).toBe("Draf putusan 123_Pdt.G_2026_PA.Dgl.rtf");
    expect(d.draf.bagian.map((b: { kunci: string }) => b.kunci)).toContain("pertimbangan");
    expect(d.draf.tanda.some((t: { teks: string }) => /Keterangan saksi 2/.test(t.teks))).toBe(true);
    expect(d.draf.sisa.jumlah).toBeGreaterThan(0);
    expect(JSON.stringify(d)).not.toMatch(/Rekaan|Usman|Lamusu|Hakim Rahasia/);
    expect(menyebutAleta(teksRtf(rtf))).toBe(false);
  });

  it("tanpa tindakan: tetap hanya rapor pemeriksa (tahap 1 tidak berubah)", async () => {
    const { isi } = await panggil(dasar());
    expect(isi.data!.ok).toBe(true);
    expect(isi.data!.rapor).toBeTruthy();
    expect(isi.data!.draf).toBeUndefined();
  });

  it("hak sama dengan Putusan Advance: akun mati dan non-hakim tanpa tautan ditolak 403; Super Admin boleh", async () => {
    keadaan.menyala = false;
    expect((await panggil({ ...dasar(), tindakan: "draf" })).status).toBe(403);
    keadaan.menyala = true;
    keadaan.aktor = { id: "usr_lain", name: "Orang Lain", roleId: "panitera" };
    expect((await panggil({ ...dasar(), tindakan: "draf" })).status).toBe(403);
    keadaan.aktor = { id: "usr_sa", name: "Super", roleId: "super-admin" };
    expect((await panggil({ ...dasar(), tindakan: "draf" })).isi.data!.ok).toBe(true);
  });

  it("naskah kosong ditolak tanpa menyusun apa pun", async () => {
    const { isi } = await panggil({ nomorPerkara: "123/Pdt.G/2026/PA.Dgl", tindakan: "draf" });
    expect(isi.data!.ok).toBe(false);
    expect(isi.data!.draf).toBeUndefined();
  });
});

// ============================================================================
// Ekstensi
// ============================================================================
const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");

describe("ekstensi putusan-advance.js: Susun draf utuh", () => {
  const terbuka: JSDOM[] = [];
  afterEach(() => {
    while (terbuka.length) terbuka.pop()!.window.close();
  });

  const SUSUNAN = { isian: [{ kode: "2022", nama: "Keterangan saksi 2", jenis: "tj", khusus: "" }, { kode: "5125", nama: "Posita", jenis: "teks", khusus: "" }] };

  function siapkan(isi: Record<string, string> = { "8503": "F", "5125": "Bahwa Penggugat ..." }) {
    const dom = new JSDOM(`<!doctype html><html><body><div id="aleta-bd-akar"></div></body></html>`, { url: "http://192.168.10.10/aps_badilag/index.php/abt/main/beranda", runScripts: "outside-only" });
    terbuka.push(dom);
    const w = dom.window as any;
    const alat = new Map<string, () => void>();
    const minta: any[] = [];
    const k: any = { pk: { nomorPerkara: "123/Pdt.G/2026/PA.Dgl", perkaraId: "9" }, blangko: { jenis: "put" }, isi, tj: {}, perlu: ["2022"], susunan: SUSUNAN };
    w.aletaBlangkoDerry = { daftarkanAlat: (id: string, fn: () => void) => alat.set(id, fn), perkaraTerpilih: () => ({ perkara: { nomorPerkara: "123/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat" } }) };
    w.aletaBlangkoDerryIsian = { keadaan: () => k, naskahRtf: async () => new TextEncoder().encode("{\\rtf1 uji}").buffer };
    const draf = {
      namaBerkas: "Draf putusan 123_Pdt.G_2026_PA.Dgl.rtf",
      rtfBase64: Buffer.from("{\\rtf1 draf}").toString("base64"),
      ringkas: "Draf utuh disusun dari 3 bagian; 2 bagian bertanda.",
      jumlahTanda: 2,
      catatan: [],
      sisa: { jumlah: 3, rincian: [{ jenis: "kurung", label: "Kurung siku yang belum diganti", jumlah: 2 }] },
      serupa: [{ nomor: "9/Pdt.G/2025/PA.Dgl" }],
      bagian: [
        { kunci: "kepala", judul: "Kepala putusan", jumlahTanda: 0, paragraf: [{ teks: "P U T U S A N", asal: "naskah", gaya: "judul" }] },
        { kunci: "pertimbangan", judul: "Pertimbangan hukum", jumlahTanda: 1, paragraf: [{ teks: "[perlu dilengkapi: unsur X]", asal: "susun", tanda: true, merah: true }, { teks: "Menimbang, bahwa contoh", asal: "susun", contoh: true, merah: true }] },
      ],
    };
    w.fetch = async (url: string, o: any) => {
      const badan = JSON.parse(o.body);
      minta.push({ url, badan });
      const data = badan.tindakan === "draf" ? { ok: true, draf } : { ok: true, rapor: { ringkas: "0 perhatian, 0 catatan.", perLangkah: {}, temuan: [], alasan: [], serupa: [], kutipan: [], tidakDiperiksa: [] } };
      return { ok: true, status: 200, json: async () => ({ data }) };
    };
    w.eval(baca("putusan-advance.js"));
    alat.get("advance")!();
    return { w, k, minta, kartu: () => w.document.getElementById("bd-advance"), draf };
  }

  it("tombol mati sebelum pemeriksa selesai, aktif sesudahnya, dan mengirim tindakan draf bersama isian kosong", async () => {
    const { w, minta, kartu } = siapkan();
    // Belum ada rapor: tombol tampil tetapi mati, dengan petunjuk.
    expect(kartu().querySelector("[data-pa-draf]").disabled).toBe(true);
    expect(kartu().textContent).toContain("Aktif sesudah pemeriksaan selesai");
    await w.aletaPutusanAdvance.susunDraf();
    expect(minta).toHaveLength(0);

    await w.aletaPutusanAdvance.periksa();
    const tombol = kartu().querySelector("[data-pa-draf]");
    expect(tombol).not.toBeNull();
    expect(tombol.disabled).toBe(false);
    expect(tombol.textContent).toBe("Susun draf utuh");

    await w.aletaPutusanAdvance.susunDraf();
    expect(minta).toHaveLength(2);
    expect(minta[1].url).toBe("/aleta/api/aleta-ecourt/putusan/advance");
    expect(minta[1].badan).toMatchObject({
      tindakan: "draf",
      nomorPerkara: "123/Pdt.G/2026/PA.Dgl",
      huruf: "F",
      isianKosong: [{ kode: "2022", nama: "Keterangan saksi 2", jenis: "tj" }],
      bahan: [{ kode: "5125", nama: "Posita", teks: "Bahwa Penggugat ...", jenis: "teks" }],
    });
    expect(Buffer.from(minta[1].badan.rtfBase64, "base64").toString("latin1")).toBe("{\\rtf1 uji}");
  });

  it("pratinjau menampilkan penanda merah, alinea contoh, peringatan sisa blangko, dan tombol unduh", async () => {
    const { w, kartu } = siapkan();
    await w.aletaPutusanAdvance.periksa();
    await w.aletaPutusanAdvance.susunDraf();
    const k = kartu();
    expect(k.querySelector("[data-pa-pratinjau]")).not.toBeNull();
    expect(k.querySelector("[data-pa-tanda]").textContent).toBe("[perlu dilengkapi: unsur X]");
    expect(k.querySelector("[data-pa-contoh]").textContent).toContain("Menimbang, bahwa contoh");
    expect(k.textContent).toContain("peringatan akan muncul: 3 sisa blangko");
    expect(k.textContent).toContain("Pertimbangan hukum · 1 perlu dilengkapi");
    expect(k.textContent).toContain("9/Pdt.G/2025/PA.Dgl");
    expect(k.querySelector("[data-pa-unduh]").textContent).toBe("Unduh draf (Word)");
    // Tanpa label teknis di layar.
    expect(k.textContent).not.toMatch(/template|base64|JSON|endpoint/i);
  });

  it("isian berubah sesudah pemeriksaan: tombol mati dan diminta periksa ulang; periksa ulang membukanya lagi", async () => {
    const { w, k, minta, kartu } = siapkan();
    await w.aletaPutusanAdvance.periksa();
    k.isi["8503"] = "B";
    w.aletaPutusanAdvance.bukaKartu();
    expect(kartu().querySelector("[data-pa-draf]").disabled).toBe(true);
    expect(kartu().textContent).toContain("periksa ulang dulu");
    await w.aletaPutusanAdvance.susunDraf();
    expect(minta.filter((m) => m.badan.tindakan === "draf")).toHaveLength(0);
    expect(w.aletaPutusanAdvance.keadaan().drafGalat).toMatch(/Periksa draf lagi dulu/);

    await w.aletaPutusanAdvance.periksa();
    expect(kartu().querySelector("[data-pa-draf]").disabled).toBe(false);
  });

  it("unduh: berkas RTF dengan nama dari portal, tanpa panggilan jaringan lagi", async () => {
    const { w, minta } = siapkan();
    await w.aletaPutusanAdvance.periksa();
    await w.aletaPutusanAdvance.susunDraf();
    const diunduh: Array<{ nama: string; href: string }> = [];
    w.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      diunduh.push({ nama: this.download, href: this.href });
    };
    w.URL.createObjectURL = () => "blob:uji";
    w.URL.revokeObjectURL = () => undefined;
    const sebelum = minta.length;
    w.aletaPutusanAdvance.unduhDraf();
    expect(diunduh).toEqual([{ nama: "Draf putusan 123_Pdt.G_2026_PA.Dgl.rtf", href: "blob:uji" }]);
    expect(minta).toHaveLength(sebelum);
  });

  it("hanya membaca dan menunjuk satu rute; kode baru tidak memanggil simpan/unggah ke ABT atau SIPP", () => {
    const isi = baca("putusan-advance.js");
    expect(isi).not.toMatch(/klienAbt\(|\.simpan\w*\(|unggah\w*\(|tanyajawab_perkara_edit|method:\s*"(?:PUT|DELETE|PATCH)"/i);
    expect([...new Set(isi.match(/\/aleta\/api\/[a-z0-9/-]+/g))]).toEqual(["/aleta/api/aleta-ecourt/putusan/advance"]);
    expect(isi).toContain("Susun draf utuh");
    expect(isi).toContain("data-pa-draf");
  });
});
