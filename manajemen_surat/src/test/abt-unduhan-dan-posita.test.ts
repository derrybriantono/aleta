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
  it("jenis perkara dari SIPP, bukan dari kepala halaman blangko", () => {
    // Sampai 2.20.3 nama berkas menyisipkan ringkasBlangkoAbt() - potongan
    // kepala halaman seperti "[01] [Kabul Verstek] Cerai (Format Lengkap)".
    // Niatnya benar: di dalamnya memang ada jenis perkara, amar, dan verstek.
    // Tetapi ia kepala HALAMAN, bukan keterangan PERKARA - bunyinya berbeda di
    // tiap halaman blangko dan hilang sama sekali ketika kepalanya tidak
    // terbaca, dan yang tersisa ketika itu nama bawaan peramban.
    //
    // Yang diminta satker: nomor perkara - jenis perkara - status putusan,
    // ketiganya dari SIPP.
    expect(abt).toContain("function sebutJenisPerkara(nomorPerkara)");
    expect(abt).toContain("sebutJenisPerkara(nomorPerkara), sebutStatusPutusan(nomorPerkara)");
    expect(abt).not.toContain("function ringkasBlangkoAbt()");
  });

  it("ketiga berkas dinamai dengan bentuk yang sama", () => {
    // RTF dan PDF putusan hanya berbeda akhirannya - keduanya putusan yang
    // sama, jadi tidak ada penanda tambahan pada namanya. Yang anonim
    // berpenanda, sebab tanpa itu ia menimpa putusannya.
    expect(abt).toContain('namaBerkas(nomor, "rtf", "putusan")');
    expect(abt).toContain('namaBerkas(nomor, "pdf", "putusan")');
    expect(abt).toContain('namaBerkas(nomor, "rtf", "anonimisasi")');
    expect(abt).toContain('if (jenis && jenis !== "putusan") bagian.push(jenis);');
  });

  it("unduhan ABT sendiri dinamai pekerja latar", () => {
    expect(latar).toContain("chrome.downloads.onDeterminingFilename.addListener");
    expect(latar).toContain("const POLA_NAMA_UMUM =");
  });

  it("HANYA nama yang benar-benar umum yang diubah", () => {
    // Menimpa nama yang dipilih orang lain jauh lebih merugikan daripada
    // membiarkan satu berkas bernama "download".
    // Kesegaran konteksnya tidak lagi diperiksa di baris ini: sejak konteksnya
    // dibaca dari penyimpanan (2.19.7), yang di sini hanya yang dapat dijawab
    // SEKETIKA - asal dan bentuk namanya.
    expect(latar).toContain("if (!dariAbt || !segar || !POLA_NAMA_UMUM.test(nama)) return false;");
  });

  it("konteks yang sudah basi tidak dipakai", () => {
    // Nomor perkara dari setengah jam lalu yang ditempelkan ke unduhan perkara
    // lain tidak akan pernah disadari: berkasnya terbuka benar, namanya
    // berbohong.
    expect(latar).toContain("const UMUR_KONTEKS_UNDUH =");
    expect(latar).toContain("Date.now() - Number(konteks.saat || 0) < UMUR_KONTEKS_UNDUH");
  });

  /**
   * ==========================================================================
   * KONTEKSNYA TIDAK BOLEH HIDUP DI INGATAN PEKERJA LATAR
   * ==========================================================================
   *
   * Dilaporkan dari folder unduhan 16 September 2026: enam berkas bernama
   * "download.rtf" dan "download (2).pdf" pada hari yang sama ketika unduhan
   * lewat panel ALETA bernama benar. Sebabnya konteks perkara disimpan pada
   * satu variabel modul di pekerja latar Manifest V3 - dan Chrome mematikan
   * pekerja itu sesudah kira-kira tiga puluh detik menganggur. Halaman
   * mengabarkan konteksnya sekali saat dibuka; ketika CETAK ditekan beberapa
   * menit kemudian, pekerjanya dibangunkan oleh unduhan itu sendiri dengan
   * konteks kosong, dan tidak ada satu pun pesan galat.
   */
  it("konteks disimpan di penyimpanan, bukan di variabel pekerja latar", () => {
    expect(latar).toContain("const KUNCI_KONTEKS_UNDUH =");
    expect(latar).toContain("chrome.storage.session");
    expect(latar).toContain("async function bacaKonteksUnduh()");
    // Bentuk lamanya tidak boleh kembali.
    expect(latar).not.toContain("let konteksAbt = null;");
    expect(latar).not.toContain("konteksAbt.saat");
  });

  it("peramban yang belum mengenal storage.session jatuh ke storage.local", () => {
    expect(latar).toContain("(chrome.storage && chrome.storage.session) || (chrome.storage && chrome.storage.local)");
  });

  it("pendengarnya menjawab SEKETIKA - tidak pernah menunggu penyimpanan", () => {
    // 2.19.7 menjawab menyusul (return true lalu sarankan asinkron). Chrome
    // mengizinkannya dan ujinya hijau, tetapi di peramban petugas hasilnya
    // "Insecure download blocked" pada unduhan ABT yang sebelumnya lewat
    // begitu saja. Unduhan yang tertahan menghentikan pekerjaan; berkas
    // bernama "download" hanya merepotkan.
    const mulai = latar.indexOf("chrome.downloads.onDeterminingFilename.addListener");
    expect(mulai).toBeGreaterThan(-1);
    // Dibatasi sampai pendengar berikutnya: irisan bertakar angka akan memuat
    // kode lain, dan penjaganya lalu menyalahkan yang tidak bersalah.
    const badan = latar.slice(mulai, latar.indexOf("chrome.runtime.onMessage.addListener", mulai));
    expect(badan).not.toContain("bacaKonteksUnduh()");
    expect(badan).not.toContain(".then(");
    expect(badan).toContain("sarankan({ filename: namaUnduhanAbt(nama, konteksIngatan)");
    expect(badan).toContain("conflictAction: \"uniquify\"");
  });

  it("satu keadaan saja yang tidak terpenuhi: namanya dibiarkan, unduhannya jalan terus", () => {
    const mulai = latar.indexOf("chrome.downloads.onDeterminingFilename.addListener");
    const badan = latar.slice(mulai, latar.indexOf("chrome.runtime.onMessage.addListener", mulai));
    expect(badan).toContain("if (!dariAbt || !segar || !POLA_NAMA_UMUM.test(nama)) return false;");
  });

  it("penyimpanan hanya MEMULIHKAN ingatannya, bukan dibaca saat unduhan datang", () => {
    expect(latar).toContain("let konteksIngatan = null;");
    expect(latar).toContain("void bacaKonteksUnduh().then((konteks) => {");
    // Pesan dari halaman mengisi ingatannya lebih dahulu, penyimpanan menyusul.
    const mulai = latar.indexOf('if (pesan.jenis === "konteks-unduh")');
    const badan = latar.slice(mulai, mulai + 700);
    expect(badan.indexOf("konteksIngatan = {")).toBeLessThan(badan.indexOf("simpanKonteksUnduh("));
  });

  it("konteksnya disegarkan selama petugas masih menyentuh halaman ABT", () => {
    // Umur lima menit harus berarti "sejak terakhir Anda menyentuh halaman
    // ini", bukan "sejak halaman dibuka" - yang kedua hampir selalu sudah
    // lewat ketika CETAK ditekan.
    expect(abt).toContain("function segarkanKonteksUnduh()");
    expect(abt).toContain('document.addEventListener("pointerdown", segarkanKonteksUnduh, true);');
    expect(abt).toContain('if (document.visibilityState === "visible") segarkanKonteksUnduh();');
    // Dibatasi supaya tidak menghujani pekerja latar.
    expect(abt).toContain("const JEDA_SEGAR_KONTEKS_MS =");
    expect(abt).toContain("if (sekarang - segarTerakhir < JEDA_SEGAR_KONTEKS_MS) return;");
  });

  it("pointerdown, bukan click - konteksnya harus tersimpan sebelum CETAK menerbitkan unduhan", () => {
    const mulai = abt.indexOf("function segarkanKonteksUnduh()");
    expect(abt.slice(mulai, mulai + 600)).toContain("pointerdown");
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
  it('"tidak sanggup lagi" bukan lagi pola tegas - ia ditentukan oleh pertanyaannya', () => {
    // 17 Okt: 453 "Saya tidak sanggup lagi" di data nyata = jawaban atas "masih sanggup mendamaikan?".
    // Pola tegas tanpa pertanyaan menghapus keterangan perkara; kini lewat adalahKalimatPenutupSaksi(baris, pertanyaan)
    // (perilakunya dijaga penutup-saksi-lentur.test.ts).
    expect(abt).not.toContain("/^bahwa\\s+sudah\\s+tidak\\s+sanggup\\s+lagi[\\s;.,!:]*$/i");
    expect(abt).not.toContain("/^sudah\\s+tidak\\s+sanggup\\s+lagi[\\s;.,!:]*$/i");
    expect(abt).not.toContain("/^tidak\\s+sanggup\\s+lagi[\\s;.,!:]*$/i");
    expect(abt).toContain("function adalahKalimatPenutupSaksi(baris, pertanyaan)");
  });

  it("pola lamanya tidak dibuang - 'sudah cukup' masih dipakai petugas", () => {
    expect(abt).toContain("/^bahwa\\s+sudah\\s+cukup[\\s;.,!:]*$/i");
  });

  it("daftarnya tetap tegas, bukan ditebak dari panjang kalimat", () => {
    // Kalimat pendek di tengah keterangan bisa saja fakta yang menentukan.
    expect(abt).toContain("const POLA_PENUTUP = [");
  });
});
