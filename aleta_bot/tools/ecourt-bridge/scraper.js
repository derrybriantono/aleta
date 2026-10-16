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
 * Halaman gerbang e-Court: /GateLogin
 *
 * Muncul SETELAH email, sandi, dan captcha diterima - jadi bukan penolakan -
 * tetapi SEBELUM sesi benar-benar terbentuk. Isinya pemberitahuan bahwa akun
 * yang sama sedang dipakai di perangkat lain, dengan dua tombol: Batal dan
 * Lanjut. Sesi baru terbentuk setelah Lanjut ditekan.
 *
 * Halaman ini berbahaya bagi penebakan otomatis: ia TIDAK memuat kolom sandi,
 * sehingga pemeriksaan sesederhana "kolom sandi sudah hilang berarti sudah
 * masuk" akan menyimpulkan berhasil - padahal sesinya masih kosong, dan
 * kegagalannya baru ketahuan jauh kemudian saat jembatan dijalankan.
 */
const GATE_PATH_PATTERN = /[/]GateLogin/i;

/** Apakah alamat ini halaman gerbang yang menunggu penegasan petugas? */
function isGateUrl(url) {
  const teks = String(url || "");
  return teks.startsWith(BASE_URL) && GATE_PATH_PATTERN.test(teks);
}

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
  // Gerbang BUKAN sudah masuk. Sesi baru terbentuk setelah Lanjut ditekan.
  if (GATE_PATH_PATTERN.test(teks)) return false;
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

/**
 * Tanggal saja dalam bentuk YYYY-MM-DD, dibaca dari waktu SETEMPAT.
 *
 * ==========================================================================
 * KENAPA BUKAN toISOString().slice(0, 10)
 * ==========================================================================
 *
 * toISOString mengubahnya ke UTC lebih dulu. Di Makassar (UTC+8), tengah malam
 * tanggal 26 menjadi pukul 16.00 tanggal 25 dalam UTC - sehingga tanggalnya
 * tampil MUNDUR SEHARI begitu diserialkan ke JSON dan dipotong.
 *
 * Untuk tanggal sidang dan tanggal panggilan, salah sehari bukan salah kecil:
 * ia menggeser hitungan kepatutan dan dapat menandai panggilan yang sah
 * sebagai cacat.
 */
function tanggalLokal(nilai) {
  if (!nilai) return "";
  const waktu = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(waktu.getTime())) return "";
  const bulan = String(waktu.getMonth() + 1).padStart(2, "0");
  const hari = String(waktu.getDate()).padStart(2, "0");
  return `${waktu.getFullYear()}-${bulan}-${hari}`;
}

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
 * Membaca berkas pendaftaran beserta judulnya.
 *
 * Bentuk nyatanya sama dengan dokumen persidangan - href pagar dengan
 * pemanggilan view_doc - hanya teks tautannya "Download", bukan "Lihat
 * Dokumen", dan judulnya berada tepat sebelum tautan:
 *
 *     Surat Kuasa Sri Astuti Ningsih | <a href="#" onclick="view_doc(1,138818)">Download</a>
 *     SURAT GUGATAN (Docx/Rtf) <a href="#" onclick="view_doc(51,138818)">Download</a>
 *
 * Fungsi ini semula mencari href biasa lalu memakainya sebagai alamat berkas.
 * Karena href-nya "#", yang tersusun adalah alamat beranda e-Court - dan yang
 * "terunduh" adalah halaman HTML, bukan berkas. Seluruh berkas pendaftaran
 * gagal dengan cara itu, sementara perbaikan pada dokumen persidangan tidak
 * menolong karena bagian ini punya pengurai sendiri.
 */
function extractRegistrationDocuments(html) {
  const teks = String(html || "");
  const hasil = [];
  const terlihat = new Set();

  // Judul berada tepat sebelum tautannya. Pemisah "|" bersifat pilihan, dan
  // ikon di dalam tautan diabaikan.
  const pola =
    /([^<>|]{3,120}?)\s*\|?\s*<a[^>]*onclick\s*=\s*["'][^"']*view_doc\(\s*(\d+)\s*,\s*(\d+)\s*\)[^"']*["'][^>]*>[\s\S]{0,80}?Download\s*<\/a>/gi;

  let cocok;
  while ((cocok = pola.exec(teks)) !== null) {
    const judul = stripTags(cocok[1]).replace(/\|$/, "").trim();
    if (!judul) continue;

    const penanda = { tipe: cocok[2], id: cocok[3] };
    const kunci = `${penanda.tipe}:${penanda.id}`;
    if (terlihat.has(kunci)) continue;
    terlihat.add(kunci);

    // Judul menyebutkan sendiri bila berkasnya Word. Menebak dari nomor jenis
    // dokumen tidak dilakukan: angka itu milik e-Court, artinya dapat berubah
    // tanpa pemberitahuan.
    const format = /\((?:docx?|rtf)[^)]*\)|\b(?:docx?|rtf)\b/i.test(judul) ? "word" : "pdf";

    hasil.push({ judul, url: "", format, penanda });
  }

  return hasil;
}

/**
 * Membaca tautan dokumen dari satu potongan halaman detail.
 *
 * ============================================================================
 * DUA BENTUK, SATU PASANG PENANDA
 * ============================================================================
 *
 * e-Court menuliskan tautan dokumen dalam dua bentuk yang berbeda, dan
 * keduanya memakai penanda yang sama persis:
 *
 *     <a href="#" onclick="view_doc(9,1385073286)">Lihat Dokumen</a>
 *     <a href=".../ViewDoc/tampil_word/9/1385073286">Lihat Dokumen</a>
 *
 * Yang pertama PDF, dijalankan JavaScript. Yang kedua Word, alamatnya langsung
 * dapat dipakai. Angka pertama jenis dokumen, angka kedua id dokumen.
 *
 * Semula fungsi ini hanya mencari href biasa. Bentuk pertama ber-href "#" -
 * dilewati - dan bentuk kedua tertangkap tetapi digolongkan salah. Akibatnya
 * PDF tidak pernah terunduh sama sekali.
 *
 * Yang dikembalikan:
 *
 *     { format: "pdf",  penanda: { tipe: "9", id: "1385073286" } }
 *     { format: "word", url: "https://.../ViewDoc/tampil_word/9/1385073286" }
 *
 * Entri berpenanda perlu ditukar dulu menjadi alamat berkas lewat
 * POST /ViewDoc/index/<tipe>/<id>; entri beralamat langsung dapat diunduh.
 */
function extractDocumentLinks(potonganHtml) {
  const teks = String(potonganHtml || "");
  const hasil = [];
  const terlihat = new Set();

  // Bentuk 1: PDF lewat view_doc(tipe, id).
  const polaViewDoc = /view_doc\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi;
  let cocok;
  while ((cocok = polaViewDoc.exec(teks)) !== null) {
    const kunci = `pdf:${cocok[1]}:${cocok[2]}`;
    if (terlihat.has(kunci)) continue;
    terlihat.add(kunci);
    hasil.push({ format: "pdf", url: "", penanda: { tipe: cocok[1], id: cocok[2] } });
  }

  // Bentuk 2: Word lewat alamat langsung.
  const polaWord = /["']([^"']*ViewDoc\/tampil_word\/(\d+)\/(\d+)[^"']*)["']/gi;
  while ((cocok = polaWord.exec(teks)) !== null) {
    const kunci = `word:${cocok[2]}:${cocok[3]}`;
    if (terlihat.has(kunci)) continue;
    terlihat.add(kunci);
    hasil.push({
      format: "word",
      url: absoluteUrl(cocok[1]),
      penanda: { tipe: cocok[2], id: cocok[3] },
    });
  }

  // Bentuk 3: alamat berkas yang benar-benar langsung, bila e-Court suatu saat
  // menuliskannya begitu. Alamat halaman perkara TIDAK termasuk - tautan
  // ber-href "#" diresolusi peramban menjadi alamat halaman yang sedang
  // dibuka, dan mengambilnya sebagai berkas menghasilkan HTML, bukan berkas.
  const polaBerkas = /["']([^"']*\/storage\/[^"']+\.(pdf|docx?|rtf|odt))["']/gi;
  while ((cocok = polaBerkas.exec(teks)) !== null) {
    const alamat = absoluteUrl(cocok[1]);
    if (terlihat.has(alamat)) continue;
    terlihat.add(alamat);
    hasil.push({
      format: /\.pdf$/i.test(cocok[1]) ? "pdf" : "word",
      url: alamat,
      penanda: null,
    });
  }

  return hasil;
}

/**
 * Kepala satu blok agenda, dibaca SESUDAH "Agenda Sidang :" dipotong.
 *
 * Bentuk aslinya di halaman:
 *
 *   Agenda Sidang : Jawaban Tergugat Silahkan Mengupload Berkas Persidangan
 *   Sebelum : Selasa, 09 Desember 2025 Pukul : 15:00:00 WIB
 *
 * Tanggal dan jam pada baris "Sebelum" itu BUKAN sekadar tenggat: ia tanggal
 * dan jam sidangnya sendiri. Diuji atas perkara 620/Pdt.G/2025/PA.Dgl - dua
 * dari dua blok cocok tepat dengan perkara_jadwal_sidang di SIPP, sampai ke
 * jamnya (15:00, yang hanya dipakai 111 dari 20.109 baris jadwal, jadi
 * kecocokannya bukan kebetulan).
 *
 * Pola pertama menuntut baris "Sebelum" ada. Pola kedua menerima blok yang
 * hanya menyebut nama agendanya - sebagian agenda lama sudah lewat tenggatnya
 * dan e-Court berhenti menuliskan barisnya, dan blok seperti itu tetap punya
 * dokumen yang perlu dikenali agendanya.
 */
function bacaKepalaAgenda(blokHtml) {
  const teks = stripTags(blokHtml).slice(0, 400);

  const penuh = teks.match(
    /^\s*([^\n]+?)\s*Silahkan Mengupload Berkas Persidangan\s*Sebelum\s*:\s*([^\n]+?)(?:\n|$)/i
  );
  if (penuh) {
    const batasTeks = cleanText(penuh[2]);
    return {
      agenda: cleanText(penuh[1]),
      batasWaktu: parseIndonesianDate(batasTeks),
      batasWaktuTeks: batasTeks,
    };
  }

  const hanyaNama = teks.match(/^\s*([^\n]+?)(?:\s*Silahkan Mengupload|\n|$)/i);
  return {
    agenda: hanyaNama ? cleanText(hanyaNama[1]) : "",
    batasWaktu: null,
    batasWaktuTeks: "",
  };
}

/**
 * ============================================================================
 * DUA TINGKAT PEMOTONGAN, BUKAN SATU
 * ============================================================================
 *
 * Halaman perkara e-Court berbentuk berlapis: beberapa BLOK AGENDA, dan di
 * dalam tiap blok beberapa DOKUMEN.
 *
 *   Agenda Sidang : Jawaban Tergugat ... Sebelum : 09 Desember 2025 15:00
 *     Dokumen diupload oleh : Tergugat - ...
 *   Agenda Sidang : Replik Penggugat ... Sebelum : 16 Desember 2025 15:00
 *     Dokumen diupload oleh : Penggugat - ...
 *
 * Dulu pemotongan hanya satu tingkat, pada "Dokumen diupload oleh :". Judul
 * bloknya berdiri di LUAR potongan itu, jadi tiap dokumen keluar tanpa tahu
 * blok mana pemiliknya - dan run.js menutupi kekosongan itu dengan menempelkan
 * agenda TERAKHIR perkara ke SELURUH dokumennya. Akibatnya berkas Jawaban
 * tercatat beragenda "Kesimpulan", dan kolom tanggal sidang tidak pernah
 * terisi sama sekali.
 *
 * Tingkat pertama memotong pada "Agenda Sidang :". Bagian ke-0 - segala yang
 * berdiri sebelum agenda pertama - TIDAK dibuang: dokumen di sana tetap
 * dibaca, hanya tanpa agenda. Membuangnya berarti kehilangan dokumen;
 * memberinya agenda blok pertama berarti menempelkannya pada sidang yang
 * keliru, dan nomor yang keliru di sana lebih buruk daripada kosong.
 *
 * Tingkat kedua memotong isi tiap blok pada "Dokumen diupload oleh :", persis
 * seperti sebelumnya.
 */
function extractHearingDocuments(html) {
  const hasil = [];

  // Pemisahan dilakukan pada HTML MENTAH, bukan teks yang sudah dibuang
  // tagnya. Membuang tag lebih dulu ikut menghapus <a href> - dan itulah
  // sebabnya dokumen persidangan tidak pernah punya alamat unduh sama sekali,
  // sehingga Jawaban, Replik, dan Duplik tidak pernah terunduh.
  const blokHtml = String(html || "").split(/Agenda Sidang\s*:/i);

  for (let nomorBlok = 0; nomorBlok < blokHtml.length; nomorBlok += 1) {
    // Bagian ke-0 berdiri sebelum agenda pertama: ia tidak punya kepala, dan
    // tidak boleh meminjam kepala blok sesudahnya.
    const kepalaBlok =
      nomorBlok === 0
        ? { agenda: "", batasWaktu: null, batasWaktuTeks: "" }
        : bacaKepalaAgenda(blokHtml[nomorBlok]);

    const potonganHtml = blokHtml[nomorBlok].split(/Dokumen diupload oleh\s*:/i).slice(1);

    for (const bagianHtml of potonganHtml) {
      // Berhenti sebelum dokumen berikutnya dimulai, supaya tautan milik
      // dokumen lain tidak ikut terhitung sebagai milik dokumen ini.
      const potonganMilikSendiri = bagianHtml.split(/Dokumen diupload oleh\s*:/i)[0];
      const tautan = extractDocumentLinks(potonganMilikSendiri);
      const bagian = stripTags(potonganMilikSendiri);
      // Hanya bagian awal tiap potongan yang berisi keterangan dokumen ini;
      // sisanya sudah masuk dokumen berikutnya.
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
        tautan,
        // Agenda dan tanggal sidang MILIK BLOKNYA SENDIRI - bukan agenda
        // terakhir perkara. Kosong pada dokumen yang berdiri sebelum blok
        // agenda pertama, dan kekosongan itu disengaja.
        agendaBlok: kepalaBlok.agenda,
        tanggalSidang: kepalaBlok.batasWaktu,
        batasUnggahBlok: kepalaBlok.batasWaktu,
        batasUnggahTeksBlok: kepalaBlok.batasWaktuTeks,
        // Dipertahankan supaya pemanggil lama tetap berjalan.
        // Bidang lama, dipertahankan demi pemanggil yang mungkin masih
        // membacanya. Sejak PDF hanya membawa penanda, yang diisi di sini
        // adalah alamat pertama yang MEMANG ada - bukan alamat kosong milik
        // PDF, yang akan terbaca seolah dokumennya tidak punya berkas.
        url: (tautan.find((x) => x.url) || {}).url || "",
      });
    }
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

/** Judul bagian persetujuan saluran elektronik (ejaan e-Court berubah-ubah: "Para Pihak", "Persetujuan Pihak ... Elektronik"). */
const POLA_JUDUL_PERSETUJUAN = /Persetujuan\s+(?:Para\s+)?Pihak[^<]{0,60}?(?:Saluran|Domisili|Persidangan)\s+Elektronik/i;
/** Judul bagian panggilan elektronik: "Panggilan (e-Summons)", "Panggilan e-Summons", "e-Summons". */
const POLA_JUDUL_PANGGILAN = /Panggilan\s*\(?\s*e\s*-?\s*Summons\s*\)?/i;
const POLA_KEDUDUKAN = /\((Penggugat|Tergugat|Pemohon|Termohon|Pelawan|Terlawan|Pembanding|Terbanding|Turut\s+[A-Za-z]+|Kuasa[^)]*|Intervensi[^)]*)[^)]*\)/i;

/** Satu baris tabel persetujuan berbentuk lain (3-4 sel). null bila tidak meyakinkan. Murni. */
function barisPersetujuanLonggar(sel) {
  if (!Array.isArray(sel) || sel.length < 3) return null;
  const selNama = sel.find((x) => POLA_KEDUDUKAN.test(stripTags(x)));
  if (!selNama) return null;
  const namaMentah = stripTags(selNama);
  const cocokPeran = namaMentah.match(/^([\s\S]*?)\s*\(([^)]+)\)\s*$/);
  const nama = cleanText(cocokPeran ? cocokPeran[1] : namaMentah);
  if (!nama) return null;
  const semua = sel.join(" ");
  const polos = stripTags(semua);
  const email = (polos.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [""])[0];
  const telp = (polos.match(/(?:Telp|HP|WA)\s*\.?\s*:?\s*([0-9+][0-9\s-]{6,})/i) || ["", ""])[1].trim();
  const persetujuan = /fa-check-circle/i.test(semua) ? "setuju" : /fa-times-circle/i.test(semua) ? "tidak_setuju" : "belum";
  return { nama, peran: cleanText(cocokPeran ? cocokPeran[2] : ""), email, telp, persetujuan };
}

/**
 * Diagnosa bagian pihak elektronik satu halaman detail (17 Okt 2026). Murni.
 *
 * Tabel aleta_bot_ecourt_pihak dan _panggilan berisi 0 baris walau penarik
 * membaca 1.037 halaman detail sejak 30 Agu - pembacanya disusun tanpa contoh
 * halaman nyata. Diagnosa ini menjawab sebabnya pada putaran berikutnya tanpa
 * menyimpan isi halaman: apakah judulnya ada, berapa baris & sel tabelnya,
 * dan tab apa saja yang ada di halaman (id tab-pane, bukan isinya).
 */
function diagnosaPihakElektronik(html) {
  const teks = String(html || "");
  const ukurTabel = (pola) => {
    const awal = teks.search(pola);
    if (awal < 0) return { judul: false, baris: 0, sel: [] };
    const potongan = teks.slice(awal);
    const mulai = potongan.search(/<table[^>]*>/i);
    const selesai = potongan.search(/<\/table>/i);
    if (mulai < 0 || selesai < 0) return { judul: true, baris: 0, sel: [], tanpaTabel: true };
    const tabel = potongan.slice(mulai, selesai);
    const baris = [...tabel.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => (m[1].match(/<td[^>]*>/gi) || []).length).filter((n) => n > 0);
    return { judul: true, baris: baris.length, sel: [...new Set(baris)].slice(0, 5) };
  };
  const tab = [...teks.matchAll(/<div[^>]*class\s*=\s*["'][^"']*tab-pane[^"']*["'][^>]*>/gi)]
    .map((m) => (m[0].match(/id\s*=\s*["']([^"']{1,40})["']/i) || ["", ""])[1])
    .filter(Boolean)
    .slice(0, 20);
  return {
    persetujuan: ukurTabel(POLA_JUDUL_PERSETUJUAN),
    panggilan: ukurTabel(POLA_JUDUL_PANGGILAN),
    adaKataSummons: /summons/i.test(teks),
    adaKataPersetujuan: /persetujuan/i.test(teks),
    tab,
  };
}

/**
 * Membaca tabel persetujuan pihak memakai saluran elektronik.
 *
 * ============================================================================
 * INILAH YANG MENENTUKAN CARA MEMANGGIL
 * ============================================================================
 *
 * Pihak yang MENYETUJUI saluran elektronik dipanggil lewat e-Summons. Pihak
 * yang menolak - atau belum menjawab sama sekali - harus dipanggil jurusita
 * lewat surat tercatat. Salah saluran berarti panggilannya tidak sah, dan
 * ketidaksahan itu baru ketahuan di ruang sidang.
 *
 * ============================================================================
 * TIGA KEADAAN, BUKAN DUA
 * ============================================================================
 *
 * e-Court membedakan setuju, tidak setuju, dan BELUM membuat persetujuan.
 * Menggabungkan dua yang terakhir menjadi "tidak setuju" menghilangkan
 * perbedaan yang penting: yang belum menjawab masih dapat diminta menjawab,
 * sedangkan yang menolak sudah selesai urusannya.
 *
 * Penandanya ikon: fa-check-circle untuk setuju, fa-times-circle untuk tidak
 * setuju. Yang tidak beranda salah satunya dibaca sebagai belum menjawab -
 * bukan ditebak, karena menebak persetujuan berarti menebak keabsahan
 * panggilan.
 */
function extractPersetujuanPihak(html) {
  const teks = String(html || "");

  // Tabelnya dicari dari JUDULNYA, bukan dari urutan tabel di halaman.
  // Halaman detail memuat beberapa tabel berkelas sama, dan mengambil "tabel
  // ketiga" akan diam-diam membaca tabel yang keliru begitu e-Court menambah
  // satu bagian di atasnya.
  const awal = teks.search(POLA_JUDUL_PERSETUJUAN);
  if (awal < 0) return [];

  const potongan = teks.slice(awal);
  const tabelMulai = potongan.search(/<table[^>]*>/i);
  if (tabelMulai < 0) return [];

  const tabelSelesai = potongan.search(/<\/table>/i);
  if (tabelSelesai < 0) return [];

  const tabel = potongan.slice(tabelMulai, tabelSelesai);
  const hasil = [];

  const polaBaris = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let baris;
  while ((baris = polaBaris.exec(tabel)) !== null) {
    const isi = baris[1];
    // Baris kepala tabel memakai th - dilewati.
    if (/<th[^>]*>/i.test(isi)) continue;

    const sel = [];
    const polaSel = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let satuSel;
    while ((satuSel = polaSel.exec(isi)) !== null) sel.push(satuSel[1]);
    if (sel.length < 5) {
      // Bentuk lain (17 Okt 2026): 0 baris tersimpan sejak 30 Agu walau 1.037
      // halaman detail terbaca - bentuk tabel nyata belum pernah diukur. Baris
      // 3-4 sel dibaca longgar: nama = sel ber-"(Kedudukan)", surel/telepon/ikon
      // dicari di seluruh baris. Tetap hanya di tabel sesudah judulnya.
      const longgar = barisPersetujuanLonggar(sel);
      if (longgar) hasil.push(longgar);
      continue;
    }

    const namaMentah = stripTags(sel[1]);
    if (!namaMentah) continue;

    // "Bida binti Pakalibu (Penggugat)" - nama dan kedudukannya menyatu.
    const cocokPeran = namaMentah.match(/^([\s\S]*?)\s*\(([^)]+)\)\s*$/);
    const nama = cleanText(cocokPeran ? cocokPeran[1] : namaMentah);
    const peran = cleanText(cocokPeran ? cocokPeran[2] : "");

    const kontak = stripTags(sel[3]);
    const email = (kontak.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [""])[0];
    const telp = (kontak.match(/Telp\s*:\s*([0-9+][0-9\s-]{6,})/i) || ["", ""])[1].trim();

    const selPersetujuan = sel[4] || "";
    const persetujuan = /fa-check-circle/i.test(selPersetujuan)
      ? "setuju"
      : /fa-times-circle/i.test(selPersetujuan)
        ? "tidak_setuju"
        : "belum";

    hasil.push({ nama, peran, email, telp, persetujuan });
  }

  return hasil;
}

/**
 * Membaca tabel Panggilan (e-Summons).
 *
 * Yang dicari bukan sekadar "sudah dipanggil atau belum", melainkan KAPAN
 * panggilannya terkirim. Jarak antara pengiriman dan hari sidang itulah yang
 * menentukan panggilannya patut atau tidak - dan itu tidak dapat dijawab tanpa
 * tanggal pengirimannya.
 */
function extractPanggilanElektronik(html) {
  const teks = String(html || "");

  const awal = teks.search(POLA_JUDUL_PANGGILAN);
  if (awal < 0) return [];

  const potongan = teks.slice(awal);
  const tabelMulai = potongan.search(/<table[^>]*>/i);
  if (tabelMulai < 0) return [];
  const tabelSelesai = potongan.search(/<\/table>/i);
  if (tabelSelesai < 0) return [];

  const tabel = potongan.slice(tabelMulai, tabelSelesai);
  const hasil = [];

  const polaBaris = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let baris;
  while ((baris = polaBaris.exec(tabel)) !== null) {
    const isi = baris[1];
    if (/<th[^>]*>/i.test(isi)) continue;

    const sel = [];
    const polaSel = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let satuSel;
    while ((satuSel = polaSel.exec(isi)) !== null) sel.push(satuSel[1]);
    if (sel.length < 4) continue;

    const jenisTeks = stripTags(sel[1]);
    const pihakTeks = stripTags(sel[2]);
    const dokumenTeks = stripTags(sel[3]);

    const nama = cleanText((pihakTeks.match(/Nama\s*:\s*([^\n]+)/i) || ["", ""])[1]);
    const email = (pihakTeks.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [""])[0];

    const nomorPerkara = cleanText((jenisTeks.match(/Nomor\s*:\s*([^\n]+)/i) || ["", ""])[1]);
    const jenis = cleanText(jenisTeks.split(/\n/)[0]);

    const tanggalSidangTeks = cleanText(
      (jenisTeks.match(/Tgl\.?\s*Sidang\s*:\s*([^\n]+)/i) || ["", ""])[1]
    );
    const kirimTeks = cleanText(
      (dokumenTeks.match(/Pengiriman\s*:\s*([^\n]+)/i) || ["", ""])[1]
    );

    hasil.push({
      jenis,
      nomorPerkara,
      nama,
      email,
      tanggalSidang: tanggalLokal(parseIndonesianDate(tanggalSidangTeks)),
      tanggalSidangTeks,
      // "Rabu, 26 Agustus 2026 Jam : 11:01 WIB" - jamnya dibuang sebelum
      // tanggalnya diurai, karena pengurai tanggal tidak mengenal "Jam :".
      dikirimPada: tanggalLokal(parseIndonesianDate(kirimTeks.replace(/\s*Jam\s*:.*$/i, ""))),
      dikirimPadaTeks: kirimTeks,
      judulDokumen: cleanText(
        (dokumenTeks.match(/Judul\s+Dokumen\s*:\s*([^\n]+)/i) || ["", ""])[1]
      ),
    });
  }

  return hasil;
}

/** Seluruh isi satu halaman detail perkara. */
/**
 * Memotong satu tab dari halaman detail e-Court.
 *
 * Tab-tab e-Court berupa div ber-id di dalam .tab-content. Memotongnya lebih
 * dulu penting: kata "Putusan" muncul di banyak tempat pada halaman ini - pada
 * judul tab, pada amar, pada nama berkas - dan mencarinya di seluruh halaman
 * akan menemukan bagian yang salah.
 */
function potongTab(html, idTab) {
  const teks = String(html || "");
  const pola = new RegExp('<div[^>]*id\\s*=\\s*["\']' + idTab + '["\'][^>]*>', "i");
  const mulai = teks.search(pola);
  if (mulai === -1) return "";

  // Ditutup pada pembuka tab berikutnya; bila tidak ada, sampai akhir halaman.
  const sesudah = teks.slice(mulai + 1);
  const berikut = sesudah.search(/<div[^>]*class\s*=\s*["'][^"']*tab-pane/i);
  return berikut === -1 ? sesudah : sesudah.slice(0, berikut);
}

/** Nilai satu baris tabel e-Court, dicari dari label pada sel kirinya. */
function nilaiBarisTabel(potongan, label) {
  const aman = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pola = new RegExp(
    "<td[^>]*>\\s*" + aman + "\\s*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>",
    "i"
  );
  const cocok = String(potongan || "").match(pola);
  return cocok ? stripTags(cocok[1]).replace(/\s+/g, " ").trim() : "";
}

/**
 * Keadaan putusan menurut e-Court.
 *
 * ============================================================================
 * DUA KEGAGALAN YANG BERBEDA, DAN KEDUANYA DIAM
 * ============================================================================
 *
 * Pertama: perkara sudah diputus di SIPP, tetapi tab Putusan e-Court tidak
 * memuat satu baris pun. Datanya tidak pernah terbentuk di sana, dan tidak ada
 * yang memberitahu siapa pun - petugas baru tahu saat para pihak menanyakan
 * salinan putusannya.
 *
 * Kedua: barisnya ada, tetapi dokumen salinan putusannya belum diunggah, atau
 * sudah diunggah tetapi Panitera belum menandatanganinya secara elektronik.
 * Salinan yang belum ditandatangani tidak dapat diambil para pihak.
 *
 * Yang dikembalikan menyebutkan APA YANG TERBACA, bukan kesimpulannya.
 * Kesimpulan dibentuk layanan pembanding, yang juga memegang keadaan SIPP.
 */
function extractPutusanEcourt(html) {
  const potongan = potongTab(String(html || ""), "detil_putusan");

  // Tab Putusan tidak ada sama sekali pada halaman ini.
  if (!potongan) return { adaTab: false, adaBaris: false, alasan: "tab_putusan_tidak_ada" };

  const ambilNomor = (kata) => {
    const pola = new RegExp(kata + '\\s+NOMOR\\s*:\\s*"?([^"<]{3,120}?)"?\\s*<', "i");
    const cocok = potongan.match(pola);
    return cocok ? cocok[1].trim() : "";
  };

  const nomorPutusan = ambilNomor("INFORMASI\\s+PUTUSAN");
  const nomorSalinan = ambilNomor("SALINAN\\s+PUTUSAN");

  // e-Court menulis tanda hubung pada kolom yang belum terisi. Itu BUKAN
  // nilai, dan memperlakukannya sebagai nilai membuat baris putusan yang
  // kosong tampak sudah ada - lalu perkaranya digolongkan "salinan belum
  // diunggah" padahal yang benar barisnya memang belum terbentuk.
  const bukanStrip = (nilai) => (/^[-–—]+$/.test(String(nilai || "").trim()) ? "" : nilai);

  const tanggalPutusan = bukanStrip(nilaiBarisTabel(potongan, "Tanggal Putusan"));
  const tanggalBht = bukanStrip(nilaiBarisTabel(potongan, "Tanggal BHT"));
  const diunggahOleh = nilaiBarisTabel(potongan, "Diupload Oleh");
  const tanggalUnggah = nilaiBarisTabel(potongan, "Tanggal Upload");
  const panitera = nilaiBarisTabel(potongan, "Panitera");

  // Dokumen salinan putusan: tautan fast_download di dalam baris berlabel
  // "Dokumen Salinan Putusan". Ikon PDF di sebelahnya TIDAK dijadikan penanda -
  // ikon berubah tanpa memberi tahu siapa pun; tautannya tidak.
  const barisDokumen = (() => {
    const cocok = potongan.match(
      /<td[^>]*>\s*Dokumen\s+Salinan\s+Putusan\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i
    );
    return cocok ? cocok[1] : "";
  })();

  const tautanSalinan = (() => {
    const cocok = barisDokumen.match(/<a[^>]*href\s*=\s*["']([^"']*fast_download[^"']*)["']/i);
    return cocok ? cocok[1] : "";
  })();

  // ==========================================================================
  // TANDA TANGAN ELEKTRONIK PANITERA: BARIS PANITERA DAN SATU BARIS SESUDAHNYA
  // ==========================================================================
  //
  // Bagian SALINAN PUTUSAN pada halaman yang berjalan tersusun begini:
  //
  //   Dokumen Salinan Putusan   [PDF] + tombol Edit
  //   Diupload Oleh             arminhidayah86@gmail.com   <- HAKIM pengunggah
  //   Tanggal Upload            Kamis, 09 Juli 2026
  //   Panitera                  SRI SUSILOWATI, S.H.  (v) Telah diperiksa
  //                                                   tanggal 2026-07-13 ...
  //   Salinan Putusan           "hanya dapat melihatnya menggunakan User
  //                              Panitera"
  //
  // Jadi bukti TTE menempel pada baris PANITERA, di sisi kanannya - dan baris
  // itu bukan baris terakhir: masih ada satu baris keterangan di bawahnya.
  //
  // Dijangkarkan pada baris Panitera, bukan dihitung dari ujung tab. Menghitung
  // dari ujung memang menghasilkan jawaban yang sama pada halaman ini, tetapi
  // hanya karena tab Putusan kebetulan tab terakhir; satu baris keterangan yang
  // ditambahkan e-Court di bawahnya sudah cukup menggeser jendelanya, dan yang
  // hilang adalah TTE - kembali melaporkan "belum TTE" atas yang sudah
  // ditandatangani.
  //
  // Barisnya diambil DUA: baris Panitera sendiri, dan satu baris sesudahnya -
  // sebab pada sebagian halaman kalimat itu berdiri sebagai barisnya sendiri
  // alih-alih menempel di sel yang sama.
  //
  // Yang TIDAK boleh: mencarinya di seluruh tab. Bagian INFORMASI PUTUSAN di
  // atas memuat amar putusan dengan teks bebas yang panjang, dan baris
  // "Diupload Oleh" milik hakim - bukan Panitera.
  const barisTabel = potongan.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const indeksPanitera = barisTabel.findIndex((baris) =>
    /<td[^>]*>\s*Panitera\s*<\/td>/i.test(baris)
  );
  // Tanpa baris berlabel Panitera - susunan halaman berubah - dua baris
  // terbawah dipakai sebagai perkiraan terbaik. Tetap jauh lebih sempit
  // daripada seluruh tab.
  const jendelaTte = (indeksPanitera === -1
    ? barisTabel.slice(-2)
    : barisTabel.slice(indeksPanitera, indeksPanitera + 2)
  )
    .map((baris) => stripTags(baris).replace(/\s+/g, " "))
    .join(" | ");

  const POLA_TTE = /Telah\s+diperiksa\s+tanggal\s+([0-9:\-\s]{8,25})/i;
  const diperiksa = String(panitera).match(POLA_TTE) || jendelaTte.match(POLA_TTE);

  // ==========================================================================
  // SUDAH DIUNGGAH BELUM TENTU SUDAH ADA TAUTANNYA
  // ==========================================================================
  //
  // Yang mengunggah salinan putusan adalah HAKIM, dan keterangannya duduk pada
  // baris ke-3 dan ke-4 dari bawah - yaitu baris "Diupload Oleh" dan "Tanggal
  // Upload", tepat di atas bagian Panitera.
  //
  // Sebelumnya "sudah diunggah" hanya dijawab oleh ada-tidaknya tautan
  // fast_download. Padahal kedua baris itu sudah cukup membuktikan salinannya
  // ada - dan pada halaman yang tautannya baru muncul sesudah ditandatangani,
  // bertumpu pada tautan saja membuat perkara yang menunggu TTE Panitera
  // dilaporkan "salinan belum diunggah". Keliru, dan menyesatkan ke arah yang
  // salah: yang ditagih pengunggahnya, padahal yang ditunggu tanda tangan.
  //
  // Dibaca dari LABELNYA, bukan dari nomor barisnya. Pada perkara yang
  // salinannya memang belum diunggah, kedua baris itu tidak ada sama sekali -
  // dan menghitung mundur dari bawah pada tabel yang lebih pendek akan
  // menyambar baris yang tidak ada hubungannya, lalu menyatakan sudah diunggah
  // apa yang belum. Label tidak dapat tergeser seperti itu.
  const adaDokumen = Boolean(tautanSalinan || diunggahOleh || tanggalUnggah);

  // Baris putusan dianggap ADA bila e-Court menyebut nomor atau tanggalnya.
  // Tab yang terbentuk tetapi kosong bukan baris putusan.
  const adaBaris = Boolean(nomorPutusan || tanggalPutusan);

  return {
    adaTab: true,
    adaBaris,
    alasan: adaBaris ? "" : "baris_putusan_kosong",
    nomorPutusan,
    nomorSalinan,
    tanggalPutusanTeks: tanggalPutusan,
    tanggalPutusan: parseIndonesianDate(tanggalPutusan) || tanggalLokal(tanggalPutusan),
    tanggalBhtTeks: tanggalBht,
    dokumenSalinan: {
      ada: adaDokumen,
      judul: stripTags(barisDokumen).replace(/\s+/g, " ").trim(),
      url: tautanSalinan ? absoluteUrl(tautanSalinan) : "",
    },
    // Pengunggah salinan putusan adalah hakim, bukan panitera.
    diunggahOleh,
    tanggalUnggahTeks: tanggalUnggah,
    tanggalUnggah: parseIndonesianDate(tanggalUnggah) || tanggalLokal(tanggalUnggah),
    panitera: {
      nama: panitera.replace(/Telah\s+diperiksa\s+tanggal[\s\S]*$/i, "").trim(),
      sudahTte: Boolean(diperiksa),
      tanggalTte: diperiksa ? diperiksa[1].trim() : "",
    },
  };
}

function parseCaseDetail(html) {
  return {
    nomorPerkara: extractCaseNumber(html),
    registrasiEcourt: extractRegistrationCode(html),
    dokumenPendaftaran: extractRegistrationDocuments(html),
    dokumenPersidangan: extractHearingDocuments(html),
    agenda: extractAgendas(html),
    batasUnggah: extractUploadDeadlines(html),
    persetujuanPihak: extractPersetujuanPihak(html),
    panggilanElektronik: extractPanggilanElektronik(html),
    // Keadaan tab Putusan - termasuk ketiadaannya, yang justru paling
    // perlu diketahui.
    putusanEcourt: extractPutusanEcourt(html),
  };
}

/**
 * ============================================================================
 * MENGGALI ALAMAT BERKAS DARI JAWABAN /ViewDoc
 * ============================================================================
 *
 * Dokumen PDF di e-Court tidak membawa alamatnya sendiri di halaman perkara -
 * yang ada hanya PENANDA. Alamatnya ditanyakan lewat /ViewDoc/index/{tipe}/{id},
 * dan jawaban itulah yang digali di sini.
 *
 * Digali sebagai fungsi murni, terpisah dari peramban, sebab inilah bagian yang
 * paling sering patah ketika e-Court berubah - dan yang tidak dapat diuji sama
 * sekali selama ia terkurung di dalam page.evaluate().
 *
 * ============================================================================
 * EMPAT SEBAB KEGAGALAN, DAN PENAWARNYA
 * ============================================================================
 *
 * 1. GARIS MIRING YANG TERSANDI. Jawaban berbentuk JSON menuliskan alamatnya
 *    dengan garis miring yang didahului garis miring terbalik - itu bawaan
 *    json_encode PHP, bukan kekeliruan e-Court. Pola lama menolak garis miring
 *    terbalik di dalam alamat, sehingga pencarian "/storage/" tidak pernah
 *    cocok pada jawaban yang sebenarnya membawanya. Inilah tersangka utama
 *    gejala "berkas terdeteksi tetapi tidak pernah terunduh": penandanya
 *    ketemu, judulnya ketemu, alamatnya dinyatakan tidak ada.
 *
 * 2. ALAMAT RELATIF. Jawaban dapat berisi "/storage/berkas/xxx.pdf" tanpa nama
 *    host. Pola lama mewajibkan http(s):// di depan, jadi bentuk ini pun
 *    dinyatakan tidak ditemukan. absoluteUrl sudah lama ada di berkas ini dan
 *    tinggal dipakai.
 *
 * 3. JAWABAN YANG DIPOTONG. Pemanggilnya dulu memotong jawaban pada 4.000
 *    huruf SEBELUM menggalinya. Jawaban yang terbungkus tata letak penuh
 *    menaruh alamatnya jauh sesudah itu, dan yang tergali hanya kepala
 *    halaman. Sekarang seluruh jawaban digali; yang dipotong hanya cuplikan
 *    untuk pesan galatnya.
 *
 * 4. PEMERIKSAAN ASAL YANG DAPAT DITIPU. Penjagaan lama berbunyi
 *    alamat.startsWith(BASE_URL) - dan alamat pada host yang namanya DIAWALI
 *    nama host e-Court lolos begitu saja, sebab awalannya memang persis sama.
 *    Sekarang nama hostnya dibandingkan utuh.
 *
 * Yang TIDAK diubah: berkas hanya boleh diambil dari e-Court. Penjagaannya
 * diperketat, bukan dilonggarkan.
 */

/** Berkas yang memang dokumen, dipakai bila jawabannya tidak melewati /storage/. */
const EKSTENSI_BERKAS_ECOURT = /[.](pdf|docx|doc|rtf|odt)(?:$|[?#])/i;

/** Calon alamat: bentuk penuh maupun bentuk relatif yang diawali garis miring. */
const POLA_CALON_ALAMAT = /https?:[/][/][^\s"'<>()\\]+|[/][^\s"'<>()\\]{2,}/g;

/**
 * Apakah alamat ini benar-benar di dalam e-Court?
 *
 * Dibandingkan per NAMA HOST, bukan per awalan teks. Perbandingan awalan
 * meloloskan host lain yang namanya kebetulan diawali nama host e-Court, dan
 * berkas dari host semacam itu akan tersimpan sebagai dokumen resmi perkara.
 */
function diDalamEcourt(alamat) {
  try {
    const url = new URL(String(alamat));
    const asal = new URL(BASE_URL);
    return url.hostname.toLowerCase() === asal.hostname.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * @param {string} teks jawaban /ViewDoc apa adanya, TIDAK dipotong
 * @returns {{ok: true, alamat: string} | {ok: false, alasan: string, cuplikan: string}}
 */
function alamatBerkasDariJawabanViewDoc(teks) {
  // Garis miring yang tersandi dipulihkan LEBIH DAHULU - lihat sebab nomor 1.
  const isi = String(teks || "").split("\\/").join("/");
  const cuplikan = stripTags(isi).replace(/\s+/g, " ").trim().slice(0, 200);

  if (!isi.trim()) return { ok: false, alasan: "jawaban_kosong", cuplikan: "" };

  const calon = (isi.match(POLA_CALON_ALAMAT) || []).map((satu) =>
    // Tanda baca penutup ikut tertangkap ketika alamatnya berada di dalam
    // kalimat atau tanda kutip; ia dibuang, bukan dibiarkan merusak alamatnya.
    satu.replace(/[.,;:!?)\]}'"]+$/, "")
  );

  // Yang melewati /storage/ didahulukan - itu bentuk yang pasti berkas.
  // Ekstensi dokumen menjadi cadangan bila e-Court memindahkan simpanannya,
  // sehingga perpindahan itu tidak seketika menghentikan seluruh penarikan.
  const pilih =
    calon.find((satu) => /[/]storage[/]/i.test(satu)) ||
    calon.find((satu) => EKSTENSI_BERKAS_ECOURT.test(satu));

  if (!pilih) {
    const halamanLogin = LOGIN_PATH_PATTERN.test(isi) || /\b(login|sign in)\b/i.test(cuplikan);
    return {
      ok: false,
      // Sesi habis dan alamat tidak dikenali menuntut tindakan yang berbeda -
      // yang satu login ulang, yang lain memperbaiki penggali ini. Menyebut
      // keduanya dengan satu kata membuat keduanya salah ditangani.
      alasan: halamanLogin ? "sesi_habis" : "alamat_berkas_tidak_ditemukan",
      cuplikan,
    };
  }

  const alamat = absoluteUrl(pilih);
  if (!diDalamEcourt(alamat)) {
    return { ok: false, alasan: "alamat_berkas_di_luar_ecourt", cuplikan: alamat.slice(0, 200) };
  }

  return { ok: true, alamat };
}

module.exports = {
  BASE_URL,
  GATE_PATH_PATTERN,
  LOGIN_PATH_PATTERN,
  absoluteUrl,
  alamatBerkasDariJawabanViewDoc,
  barisPersetujuanLonggar,
  diagnosaPihakElektronik,
  diDalamEcourt,
  extractAgendas,
  extractCaseLinks,
  extractCaseNumber,
  extractDocumentLinks,
  extractHearingDocuments,
  extractRegistrationCode,
  extractPanggilanElektronik,
  extractPutusanEcourt,
  potongTab,
  tanggalLokal,
  extractPersetujuanPihak,
  extractRegistrationDocuments,
  extractUploadDeadlines,
  isGateUrl,
  isLoggedInUrl,
  parseCaseDetail,
  parseIndonesianDate,
  stripTags,
};
