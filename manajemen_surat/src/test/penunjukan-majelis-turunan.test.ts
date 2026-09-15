/**
 * Mengganti majelis menghitung ulang seluruh turunannya - panitera sidang,
 * hari sidang, penanda tangan PHS.
 *
 * Empat keluhan dari satu layar, satu akar:
 *
 *   "otomatis selalu Sudarmin, Fahri tidak pernah dapat"
 *   "pilih manual, panitera tidak berganti mengikuti majelis"
 *   "pilih Fahri, PHS tetap Sudarmin"
 *   "pilih A, hari sidangnya Selasa padahal Rabu"
 *
 * Terukur pada perkara 567: giliran memilih trio dadakan B,C1,C3 yang hanya
 * pernah dipakai 5 kali - mengalahkan ketiga majelis SK (259, 125, 60) - lalu
 * melabelinya "Majelis B" dari kode ketuanya. Panitera, hari sidang, dan
 * penanda tangan PHS lalu mengikuti label palsu itu. Dan pilihan manual tidak
 * pernah menghitung ulang apa pun: usulan disusun sekali, saat papan dibuka.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (p: string) => readFileSync(path.join(AKAR, p), "utf8");

const usul = baca("aleta_bot/services/penunjukanService.js");
const gerbang = baca("aleta_bot/routes/internalGatewayRoutes.js");
const rute = baca("manajemen_surat/src/app/api/aleta-bot/penunjukan/route.ts");
const konten = baca("ekstensi-sipp/konten.js");

function tanpaKomentar(sumber: string) {
  return sumber
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((baris) => !baris.trim().startsWith("//"))
    .join("\n");
}

describe("giliran berjalan di antara majelis SK", () => {
  it("majelis SK dipilih lebih dahulu; susunan dadakan hanya bila SK tidak ada", () => {
    expect(usul).toContain("const majelisSk = lengkap.filter((x) => x.dariSk).sort(urutGiliran);");
    expect(usul).toContain("const giliranMajelis = majelisSk.length > 0 ? majelisSk : lengkap.sort(urutGiliran);");
  });

  it("kode majelis dari SK, bukan dari kode ketuanya", () => {
    // Kode ketua melabeli trio dadakan B,C1,C3 sebagai "Majelis B".
    expect(usul).toContain("function kodeSkUntuk(kodeHakim, susunanSk) {");
    expect(usul).toContain("majelisKode: kodeMajelisUntuk(pilihan.anggota),");
    expect(usul).toContain("majelisKode: kodeMajelisUntuk(anggota),");
    expect(tanpaKomentar(usul)).not.toContain("majelisKode: pilihan.anggota[0].kode,");
    expect(tanpaKomentar(usul)).not.toContain('majelisKode: anggota.length > 0 ? anggota[0].kode : "",');
  });

  it("satker tanpa SK tetap memakai kode ketuanya - hari sidangnya tidak hilang", () => {
    expect(usul).toContain("susunanSk.length > 0\n        ? kodeSkUntuk(anggota.map((x) => x.kode), susunanSk)");
  });
});

describe("majelis pilihan petugas menggantikan giliran", () => {
  it("dibaca dari pengaturan dan disaring ke id bulat positif", () => {
    expect(usul).toContain("const pilihanMajelis = (Array.isArray(pengaturan.pilihanMajelis)");
    expect(usul).toContain("if (pilihanMajelis.length >= 2) {");
  });

  it("MENDAHULUI smart majelis dan giliran", () => {
    const pilihan = usul.indexOf("if (pilihanMajelis.length >= 2) {");
    const smart = usul.indexOf("if (!smart.ada) {");
    expect(pilihan).toBeGreaterThan(0);
    expect(pilihan).toBeLessThan(smart);
  });

  it("hakim yang sudah tidak aktif menggagalkan pilihan, bukan mengurangi majelis", () => {
    // Majelis kurang satu orang lebih buruk daripada jatuh ke giliran.
    expect(usul).toContain("if (anggota.length === pilihanMajelis.length) {");
    expect(usul).toContain("dipilihPetugas: true,");
  });

  it("gerbang bot membatasi lima id", () => {
    expect(gerbang).toContain("kirim.pilihanMajelis");
    expect(gerbang).toContain(".slice(0, 5);");
    expect(gerbang).toContain("      pilihanMajelis,\n    });");
  });

  it("rute portal membacanya dari ?majelis= dan meneruskannya", () => {
    expect(rute).toContain('searchParams.get("majelis")');
    expect(rute).toContain("        pilihanMajelis,\n      },");
  });
});

describe("papan: mengganti majelis memuat ulang, di kedua mode", () => {
  it("pemuat ulang ada, dan menjaga pilihan petugas yang lain", () => {
    expect(konten).toContain("async function muatUlangUsulan(isi, data, hakimId) {");
    expect(konten).toContain("data.usulan = baru.usulan;");
    expect(konten).toContain("data.rencana = baru.rencana;");
    // Pejabat penetap lama menunjuk ketua majelis yang sudah tidak berlaku.
    expect(konten).toContain("data.pejabatDipilih = {};");
  });

  it("nomor perkara dicatat pada pemuatan pertama", () => {
    expect(konten).toContain("data.nomorPerkara = nomor;");
  });

  it("dropdown majelis tergambar di mode otomatis juga", () => {
    expect(konten).toContain('const bolehPilihMajelis = adaSusunan && caraHakim === "majelis"');
    expect(tanpaKomentar(konten)).not.toContain('if (bolehPilihHakim && adaSusunan && caraHakim === "majelis") {');
  });

  it("mengganti majelis mengirim id hakimnya ke server", () => {
    expect(konten).toContain("void muatUlangUsulan(isi, data, terpilih ? terpilih.hakimId : null);");
    expect(konten).toContain("&majelis=${encodeURIComponent(pilihanMajelis.join(\",\"))}");
  });

  it("berpindah ke otomatis melepas majelis pilihan dan memuat ulang", () => {
    // Saklar yang menyimpan pilihan diam-diam berbohong tentang yang akan
    // terjadi.
    expect(konten).toContain("if (data.majelisDipilih) {\n          void muatUlangUsulan(isi, data, null);");
  });
});
