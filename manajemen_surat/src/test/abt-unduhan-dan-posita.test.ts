/**
 * Tiga perbaikan dari layar sungguhan:
 *
 *   1. unduhan ABT bernama "download.rtf" - tiga perkara, tiga berkas, satu nama
 *   2. nomor butir posita yang ditelan \par di dalam RTF
 *   3. "Bahwa sudah tidak sanggup lagi" yang lolos dari pembersih penutup saksi
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (p: string) => readFileSync(path.join(AKAR, p), "utf8");

const abt = baca("ekstensi-sipp/abt.js");
const latar = baca("ekstensi-sipp/latar.js");
const posita = baca("aleta_bot/services/sippPositaService.js");

describe("butir 1 - nama berkas unduhan", () => {
  it("nama blangko ikut, sesudah perabotnya dibuang", () => {
    // "[01] [Kabul Verstek] Cerai (Format Lengkap)" memuat tiga keterangan yang
    // dicari orang berbulan-bulan kemudian: jenis perkara, amar, dan verstek.
    expect(abt).toContain("function ringkasBlangkoAbt()");
    expect(abt).toContain("const ket = ringkasBlangkoAbt();");
  });

  it("kepala halaman yang bukan nama blangko TIDAK ditempelkan", () => {
    // Nama berkas yang memuat satu paragraf lebih buruk daripada nama pendek.
    expect(abt).toContain('return teks.length > 60 ? "" : teks;');
  });

  it("ketiga berkas disebut seperti yang dikenal petugas", () => {
    expect(abt).toContain('namaBerkas(nomor, "rtf", "putusan")');
    expect(abt).toContain('namaBerkas(nomor, "pdf", "putusan pdf")');
    expect(abt).toContain('namaBerkas(nomor, "rtf", "anonimisasi")');
  });

  it("unduhan ABT sendiri dinamai pekerja latar", () => {
    expect(latar).toContain("chrome.downloads.onDeterminingFilename.addListener");
    expect(latar).toContain("const POLA_NAMA_UMUM =");
  });

  it("HANYA nama yang benar-benar umum yang diubah", () => {
    // Menimpa nama yang dipilih orang lain jauh lebih merugikan daripada
    // membiarkan satu berkas bernama "download".
    expect(latar).toContain("if (!dariAbt || !baru || !POLA_NAMA_UMUM.test(nama)) return false;");
  });

  it("konteks yang sudah basi tidak dipakai", () => {
    // Nomor perkara dari setengah jam lalu yang ditempelkan ke unduhan perkara
    // lain tidak akan pernah disadari: berkasnya terbuka benar, namanya
    // berbohong.
    expect(latar).toContain("const UMUR_KONTEKS_UNDUH =");
    expect(latar).toContain("Date.now() - konteksAbt.saat < UMUR_KONTEKS_UNDUH");
  });
});

describe("butir 2 - nomor butir yang ditelan \\par", () => {
  it("pemisah disisipkan di antara </p> dan <p>", () => {
    // cleanHtmlTagSpecial: "</p>" -> "\par" TANPA spasi, lalu filter_var
    // menyapu "<p>". Hasilnya "\par2." - kata kendali berparameter 2, dan
    // angkanya lenyap.
    expect(posita).toContain("function pisahkanParagrafRtf(");
    expect(posita).toContain('.replace(/<\\/p>[ \\t]*(?=<p[ >])/gi, "</p>\\n")');
  });

  it("dipakai pada KEDUA cabang - yang sudah HTML dan yang belum", () => {
    // 6.269 dari 8.097 posita PA Donggala sudah berupa HTML, dan justru
    // merekalah yang terkena.
    const kali = posita.split("pisahkanParagrafRtf(").length - 1;
    expect(kali).toBeGreaterThanOrEqual(3);
  });

  it("paragraf hampa dibuang - itulah jarak yang tidak rata", () => {
    expect(posita).toContain("<p[^>]*>(?:\\s|&nbsp;|&#160;)*<\\/p>");
  });

  it("penanda bertingkat dan berkurung dikenali", () => {
    expect(posita).toContain("\\d{1,2}(?:\\.\\d{1,2})+");
    expect(posita).toContain("[.)]");
  });

  it("penandanya ditulis kembali APA ADANYA", () => {
    // Menyeragamkan "1.1" menjadi "1." membuang tingkatan yang ditulis
    // penyusun gugatan dengan sengaja; "a)" bukan "a.".
    expect(posita).toContain("${sebelum}<br>${anak ? \"   \" : \"\"}${penanda} ");
    expect(posita).toContain("${awal}<br>   ${huruf} ");
  });

  it("yang bertingkat dihitung anak lewat angka kedua, bukan lewat titik", () => {
    // Butir induk "1." memuat titik juga.
    expect(posita).toContain("/^\\d+\\.\\d/.test(penanda)");
  });
});

describe("butir 3 - penutup keterangan saksi", () => {
  it('"Bahwa sudah tidak sanggup lagi" ikut dibuang', () => {
    // Lolos dari keempat pola lama: yang berawalan "bahwa" menuntut "tidak"
    // tepat sesudahnya, yang berawalan "tidak" menuntut kalimatnya dimulai
    // dari situ. Kata "sudah" di tengah membuat keduanya meleset.
    expect(abt).toContain("/^bahwa\\s+sudah\\s+tidak\\s+sanggup\\s+lagi\\b/i");
    expect(abt).toContain("/^sudah\\s+tidak\\s+sanggup\\s+lagi\\b/i");
  });

  it("pola lamanya tidak dibuang - keduanya masih dipakai petugas", () => {
    expect(abt).toContain("/^bahwa\\s+sudah\\s+cukup\\b/i");
    expect(abt).toContain("/^tidak\\s+sanggup\\s+lagi\\b/i");
  });

  it("daftarnya tetap tegas, bukan ditebak dari panjang kalimat", () => {
    // Kalimat pendek di tengah keterangan bisa saja fakta yang menentukan.
    expect(abt).toContain("const POLA_PENUTUP = [");
  });
});
