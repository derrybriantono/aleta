"use strict";

/**
 * Pembaca halaman e-Court.
 *
 * Dipisahkan dari run.js supaya bagian yang paling rapuh - pencocokan bentuk
 * halaman situs pemerintah yang bisa berubah sewaktu-waktu - dapat diuji
 * TANPA menyalakan peramban maupun menyentuh jaringan. Seluruh fungsi di sini
 * menerima HTML sebagai teks biasa dan mengembalikan data.
 *
 * Ketika e-Court kelak mengubah tampilannya, berkas INI yang perlu
 * disesuaikan, dan skrip pemeriksaannya akan langsung menunjukkan bagian mana
 * yang tidak lagi cocok.
 */

const { cleanText, normalizeCaseNumber } = require("../../services/ecourtTextService");

const BASE_URL = "https://ecourt.mahkamahagung.go.id";

/** Halaman yang menandakan pengguna BELUM masuk. */
const LOGIN_PATH_PATTERN = /\/Login\b/i;

/**
 * Apakah alamat ini menunjukkan pengguna sudah berhasil masuk?
 *
 * Dipakai run.js untuk menunggu petugas menyelesaikan login manual. Sengaja
 * memakai daftar halaman-setelah-masuk, bukan sekadar "bukan halaman login" -
 * halaman galat atau halaman pendaftaran akun juga bukan halaman login,
 * tetapi bukan berarti sudah masuk.
 */
function isLoggedInUrl(url) {
  const teks = String(url || "");
  if (!teks.startsWith(BASE_URL)) return false;
  if (LOGIN_PATH_PATTERN.test(teks)) return false;
  return /\/(pendaftaran|dashboard|view_detil_pendaftaran|Dashboard|home)/i.test(teks);
}

/** Membentuk alamat lengkap dari tautan yang mungkin relatif. */
function absoluteUrl(href) {
  const teks = String(href || "").trim();
  if (!teks) return "";
  if (/^https?:\/\//i.test(teks)) return teks;
  return `${BASE_URL}/${teks.replace(/^\/+/, "")}`;
}

/**
 * Mengurai tanggal Indonesia yang dipakai e-Court.
 *
 * Contoh nyata dari halaman: "Rabu, 19 Agustus 2026, Jam 08:11:02 WIB." dan
 * "Selasa, 09 Desember 2025 Jam : 11:30 WIB".
 *
 * Mengembalikan null bila tidak dikenali - dan null memang jawaban yang benar
 * di sini. Tanggal yang ditebak salah akan ikut menjadi bahan kunci identitas
 * dokumen, sehingga dokumen yang sama dianggap dokumen baru setiap kali
 * disinkronkan.
 */
const BULAN = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
};

function parseIndonesianDate(value) {
  const teks = cleanText(value);
  if (!teks) return null;

  const cocok = teks.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:[^\d]*(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?/);
  if (!cocok) return null;

  const bulan = BULAN[cocok[2].toLowerCase()];
  if (bulan === undefined) return null;

  const tanggal = new Date(
    Number(cocok[3]),
    bulan,
    Number(cocok[1]),
    Number(cocok[4] || 0),
    Number(cocok[5] || 0),
    Number(cocok[6] || 0)
  );
  return Number.isFinite(tanggal.getTime()) ? tanggal : null;
}

/** Membuang seluruh tag HTML, menyisakan teksnya. */
function stripTags(html) {
  return cleanText(
    String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|td)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  );
}

/**
 * Mengumpulkan tautan detail perkara dari halaman daftar.
 *
 * Halaman daftar memuat banyak tautan lain (menu, navigasi halaman); yang
 * diambil hanya yang mengarah ke view_detil_pendaftaran.
 */
function extractCaseLinks(html) {
  const teks = String(html || "");
  const pola = /href\s*=\s*["']([^"']*view_detil_pendaftaran[^"']*)["']/gi;
  const terlihat = new Set();
  const hasil = [];
  let cocok;
  while ((cocok = pola.exec(teks)) !== null) {
    const url = absoluteUrl(cocok[1]);
    if (!url || terlihat.has(url)) continue;
    terlihat.add(url);
    hasil.push(url);
  }
  return hasil;
}

/** Nomor perkara pada halaman detail, mis. "620/Pdt.G/2025/PA.Dgl". */
function extractCaseNumber(html) {
  const teks = stripTags(html);
  const cocok = teks.match(/\b(\d+\/Pdt\.[A-Za-z.]+\/\d{4}\/PA\.[A-Za-z]+)\b/);
  return cocok ? normalizeCaseNumber(cocok[1]) : "";
}

/** Kode registrasi e-Court, mis. "PA.DGL-20102025DKP". */
function extractRegistrationCode(html) {
  const teks = stripTags(html);
  const cocok = teks.match(/\b(PA\.[A-Z]{2,5}-[A-Z0-9]{6,20})\b/);
  return cocok ? cleanText(cocok[1]) : "";
}

/**
 * Dokumen pendaftaran: daftar berkas yang diunggah pihak saat mendaftar.
 *
 * Bentuknya pada halaman: "Surat Kuasa Sri Astuti Ningsih | Download".
 * Dikembalikan APA ADANYA tanpa penilaian; pengklasifikasilah yang kelak
 * memutuskan bahwa berkas pendaftaran tidak perlu diberitahukan.
 */
function extractRegistrationDocuments(html) {
  const teks = String(html || "");
  const hasil = [];
  const terlihat = new Set();

  // Judul berkas selalu berada tepat sebelum tautan unduhnya.
  const pola = /([^<>|]{3,120}?)\s*\|?\s*<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>\s*Download\s*<\/a>/gi;
  let cocok;
  while ((cocok = pola.exec(teks)) !== null) {
    const judul = stripTags(cocok[1]).replace(/\|$/, "").trim();
    const url = absoluteUrl(cocok[2]);
    if (!judul || !url) continue;
    const kunci = `${judul}|${url}`;
    if (terlihat.has(kunci)) continue;
    terlihat.add(kunci);
    hasil.push({ judul, url });
  }
  return hasil;
}

/**
 * Dokumen persidangan pada tab Persidangan.
 *
 * Bentuk nyata dari halaman e-Court PA Donggala:
 *
 *   Agenda Sidang : Jawaban Tergugat ...
 *   Dokumen diupload oleh : Tergugat - rusman.rusli73@gmail.com
 *   Upload pada : Selasa, 09 Desember 2025 Jam : 11:30 WIB
 *   Status Dokumen: Sudah diverifikasi Majelis/Hakim (Dokumen Valid)
 *   Jenis : Jawaban
 *   Judul Dokumen : Jawaban Tergugat Sri Astuti Ningsih
 *
 * Diurai dari TEKS, bukan dari struktur HTML, karena susunan tag di halaman
 * ini berubah-ubah sedangkan urutan labelnya tetap.
 */
function extractHearingDocuments(html) {
  const teks = stripTags(html);
  const hasil = [];

  // Setiap dokumen dimulai dari label "Dokumen diupload oleh".
  const potongan = teks.split(/Dokumen diupload oleh\s*:/i).slice(1);

  for (const bagian of potongan) {
    // Hanya bagian awal tiap potongan yang berisi keterangan dokumen ini;
    // sisanya sudah masuk dokumen atau agenda berikutnya.
    const kepala = bagian.slice(0, 900);

    const pengunggah = kepala.match(/^\s*([^\n]+?)\s*-\s*([^\s\n]+@[^\s\n]+)/);
    const peran = pengunggah ? cleanText(pengunggah[1]) : "";
    const email = pengunggah ? cleanText(pengunggah[2]) : "";

    const unggahPada = kepala.match(/Upload pada\s*:\s*([^\n]+?)(?=\s*Status Dokumen|\n|$)/i);
    const status = kepala.match(/Status Dokumen\s*:?\s*([^\n]+?)(?=\s*Jenis\s*:|\n|$)/i);
    const jenis = kepala.match(/Jenis\s*:\s*([^\n]+?)(?=\s*Judul Dokumen|\n|$)/i);
    const judul = kepala.match(/Judul Dokumen\s*:\s*([^\n]+?)(?=\s*Dokumen\s*:|\n|$)/i);

    const judulDokumen = judul ? cleanText(judul[1]) : cleanText(jenis ? jenis[1] : "");
    if (!judulDokumen && !email) continue;

    hasil.push({
      judul: judulDokumen,
      jenis: jenis ? cleanText(jenis[1]) : "",
      peranPengunggah: peran,
      emailPengunggah: email,
      diunggahPada: unggahPada ? parseIndonesianDate(unggahPada[1]) : null,
      statusMentah: status ? cleanText(status[1]) : "",
    });
  }

  return hasil;
}

/**
 * Agenda sidang beserta alasan penundaannya.
 *
 * Dipakai sebagai konteks tambahan pada dokumen, bukan untuk memicu apa pun -
 * pemicu agenda sudah ditangani sidangAgendaService.js dari data SIPP.
 */
function extractAgendas(html) {
  const teks = stripTags(html);
  const hasil = [];
  const pola = /Agenda Sidang\s*:\s*([^\n]+?)(?:\s*Silahkan Mengupload|\n|$)/gi;
  let cocok;
  while ((cocok = pola.exec(teks)) !== null) {
    const agenda = cleanText(cocok[1]);
    if (agenda) hasil.push(agenda);
  }
  return hasil;
}

/**
 * Batas waktu unggah berkas persidangan.
 *
 * e-Court menuliskannya begini:
 *
 *   Agenda Sidang : Jawaban Tergugat Silahkan Mengupload Berkas Persidangan
 *   Sebelum : Selasa, 09 Desember 2025 Pukul : 15:00:00 WIB
 *
 * Inilah keterangan paling berguna di seluruh halaman: pihak yang melewatinya
 * kehilangan kesempatan menanggapi. Sebelumnya kalimat ini terbaca lalu
 * dibuang, sehingga pemberitahuan ALETA hanya menyampaikan setengah kabar -
 * "ada dokumen masuk", tanpa "dan tenggatnya kapan".
 *
 * @returns {Array<{ agenda: string, batasWaktu: Date|null, batasWaktuTeks: string }>}
 */
function extractUploadDeadlines(html) {
  const teks = stripTags(html);
  const hasil = [];
  const pola =
    /Agenda Sidang\s*:\s*([^\n]+?)\s*Silahkan Mengupload Berkas Persidangan\s*Sebelum\s*:\s*([^\n]+?)(?:\n|$)/gi;

  let cocok;
  while ((cocok = pola.exec(teks)) !== null) {
    const agenda = cleanText(cocok[1]);
    const batasTeks = cleanText(cocok[2]);
    if (!agenda && !batasTeks) continue;
    hasil.push({
      agenda,
      batasWaktu: parseIndonesianDate(batasTeks),
      batasWaktuTeks: batasTeks,
    });
  }
  return hasil;
}

/** Seluruh isi satu halaman detail perkara. */
function parseCaseDetail(html) {
  return {
    nomorPerkara: extractCaseNumber(html),
    registrasiEcourt: extractRegistrationCode(html),
    dokumenPendaftaran: extractRegistrationDocuments(html),
    dokumenPersidangan: extractHearingDocuments(html),
    agenda: extractAgendas(html),
    batasUnggah: extractUploadDeadlines(html),
  };
}

module.exports = {
  BASE_URL,
  absoluteUrl,
  extractAgendas,
  extractCaseLinks,
  extractCaseNumber,
  extractHearingDocuments,
  extractRegistrationCode,
  extractRegistrationDocuments,
  extractUploadDeadlines,
  isLoggedInUrl,
  parseCaseDetail,
  parseIndonesianDate,
  stripTags,
};
