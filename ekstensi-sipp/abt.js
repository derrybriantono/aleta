"use strict";

/**
 * ============================================================================
 * ALETA DI HALAMAN BLANGKO ABT
 * ============================================================================
 *
 * ABT menampilkan variabel putusan sebagai tabel empat kolom: nomor variabel,
 * nama, isinya, dan tombol "edit". Menekan "edit" membuka jendela sembul
 * berisi satu textarea, satu tombol Simpan, dan tidak ada yang lain -
 * sehingga mengisi tiga belas variabel berarti membuka dan menutup jendela
 * tiga belas kali, tanpa pernah dapat melihat dua isian bersebelahan.
 *
 * Berkas ini mengerjakan dua hal, dan tidak lebih:
 *
 *   1. MENYUNTING DI TEMPAT. Sel isinya dapat diklik dan langsung diketik di
 *      barisnya sendiri - di hadapan variabel lain, bukan di balik jendela
 *      yang menutupinya.
 *
 *   2. MENGUSULKAN ISIAN. Satu tombol menarik lima variabel dari SIPP, satu
 *      lagi menurunkan enam variabel dari keterangan saksi, masing-masing
 *      dengan kalimat asalnya supaya dapat diperiksa tanpa membaca ulang.
 *
 * ============================================================================
 * MENYIMPAN LEWAT PINTU ABT SENDIRI
 * ============================================================================
 *
 * Penyimpanannya TIDAK menulis ke basis data dan sama sekali tidak menyentuh
 * folder APS Badilag. Ia memanggil rute yang dipakai jendela sembul ABT itu
 * sendiri:
 *
 *   POST abt/edit_data?no_var=XXXX&perkara_id=YYY
 *        aksi=Simpan&value=<isi>&var_type=<tipe>
 *
 * dengan sesi petugas yang sedang membuka halaman. Akibatnya penting: apa pun
 * yang masuk tetap melewati pemeriksaan ABT, tercatat lewat jalur yang sama
 * dengan pengisian tangan, dan atas nama orang yang menekan tombolnya.
 *
 * `var_type` tidak ditebak - ia dibaca dari jendela sembul variabel itu
 * sendiri, sekali, lalu diingat. Menebaknya berarti mengirim tanggal sebagai
 * teks, dan ABT menyimpannya tanpa mengeluh.
 */

const PENANDA_ABT = "aleta-panel-abt";
const TANDA_ABT = "data-aleta-abt";

/** Variabel yang dikenal blangko [01] Kabul Verstek Cerai, menurut urutannya. */
const VARIABEL_SASARAN = [
  "0222",
  "5227",
  "0246",
  "9944",
  "7035",
  "1268",
  "8503",
  "4020",
  "0661",
  "0663",
  "0227",
  "0132",
  "0156",
];

/** Keterangan saksi - sumber bagi enam variabel pertama. */
const VAR_SAKSI_1 = "2021";
const VAR_SAKSI_2 = "2022";
/** Tanggal sidang - dipakai menghitung ulang lama pisah (9944). */
const VAR_TGL_SIDANG = "0033";
/** Posita lengkap - butirnya sering menempel satu sama lain. */
const VAR_POSITA = "5125";
/**
 * Sebutan pihak, apa adanya dari ABT.
 *
 * 0046 berbunyi "Penggugat" atau "Pemohon"; 0047 berbunyi "Tergugat" atau
 * "Termohon". Keduanya dipakai menyusun kalimat 5227, yang diawali pelakunya -
 * jadi keduanya TIDAK ditebak dari klasifikasi perkara, melainkan dibaca dari
 * variabel yang memang menyimpannya.
 */
const VAR_PIHAK_LAWAN = "0046";
const VAR_PIHAK_PELAKU = "0047";

/**
 * Variabel "(OTOMATIS)" yang isinya disusun ABT dari kerangka fakta.
 *
 * Selama kerangkanya kosong, keempatnya berbunyi "TIDAK BENAR QUERY NYA" - dan
 * kalimat itu ikut tercetak ke dalam putusan bila tidak ada yang menahannya.
 */
const VAR_OTOMATIS = ["8521", "8522", "8528", "8530"];

/** Isi yang berarti "belum ada", menurut ABT sendiri. */
const ISI_KOSONG = /^(DATA_TIDAK_ADA|TIDAK BENAR QUERY NYA|BELUM ISI|-)?$/i;

const ALETA_API_ABT = "/aleta/api/aleta-bot/abt/usulan";

/**
 * Posisi panel ABT disimpan di kuncinya SENDIRI.
 *
 * Panel SIPP memakai "posisiPanel". Berbagi kunci berarti menggeser panel di
 * satu aplikasi memindahkan panel di aplikasi lain - dan yang mengalaminya
 * tidak punya cara menduga sebabnya. Temanya justru sebaliknya: satu kunci
 * bersama, sebab yang memilih gelap memilihnya untuk matanya, bukan untuk satu
 * halaman.
 */
const KUNCI_POSISI_ABT = "posisiPanelAbt";
const KUNCI_TEMA_PANEL = "temaPanel";

function buatElemen(tag, kelas, teks) {
  const el = document.createElement(tag);
  if (kelas) el.className = kelas;
  if (teks !== undefined && teks !== null) el.textContent = teks;
  return el;
}

/** Alamat dasar aplikasi ABT, diturunkan dari alamat halaman yang dibuka. */
function asalAbt() {
  const cocok = location.pathname.match(/^(.*?\/abt)\//);
  return cocok ? `${location.origin}${cocok[1]}` : `${location.origin}/aps_badilag/abt`;
}

/**
 * Baris variabel di halaman ABT.
 *
 * Dikenali dari sel pertama yang ber-id empat angka - itulah bentuk yang
 * dipakai view ABT, dan bentuk itu jauh lebih tahan banting daripada urutan
 * kolom: halaman lain di aplikasi yang sama punya tabel dengan jumlah kolom
 * berbeda.
 */
function barisVariabel() {
  const hasil = new Map();
  for (const baris of Array.from(document.querySelectorAll("tr"))) {
    const sel = baris.querySelectorAll("td");
    if (sel.length < 3) continue;
    const kode = String(sel[0].id || "").trim();
    if (!/^\d{4}$/.test(kode)) continue;
    hasil.set(kode, {
      kode,
      baris,
      selNama: sel[1],
      selNilai: sel[2],
      selAksi: sel[3] || null,
      nama: String(sel[1].textContent || "").replace(/\s+/g, " ").trim(),
      nilai: String(sel[2].textContent || "").replace(/\s+/g, " ").trim(),
    });
  }
  return hasil;
}

/**
 * perkara_id dan penanda perkara sementara, dibaca dari tombol edit ABT.
 *
 * Keduanya tidak ada di alamat halaman dalam bentuk yang dapat dibaca -
 * alamatnya tersandi. Yang menyimpannya justru atribut onclick pada tombol
 * edit: load_form('0222','10011','...'). Dibaca dari situ, bukan dari alamat.
 */
function jatiDiriPerkara() {
  for (const tombol of Array.from(document.querySelectorAll("a[onclick]"))) {
    const cocok = String(tombol.getAttribute("onclick") || "").match(
      /load_form\('(\d{4})','([^']*)','([^']*)'\)/
    );
    if (cocok) return { perkaraId: cocok[2], perkTemp: cocok[3] };
  }
  return null;
}

/** Isi satu variabel di halaman, apa adanya. */
function nilaiVariabel(kode) {
  const item = barisVariabel().get(kode);
  return item ? item.nilai : "";
}

/** Nomor perkara dari kepala halaman ABT. */
function nomorPerkaraAbt() {
  const judul = document.querySelector("h3.w3l_header span, h3 span");
  const teks = String((judul && judul.textContent) || document.title || "");
  const cocok = teks.match(/\d{1,5}\/[A-Za-z.]+\/\d{4}\/[A-Za-z.]+/);
  return cocok ? cocok[0] : "";
}

/** Halaman ini benar halaman daftar variabel blangko? */
function halamanBlangko() {
  return barisVariabel().size >= 5 && jatiDiriPerkara() !== null;
}

// ─── Menyimpan lewat rute ABT ────────────────────────────────────────────────

const tipeVariabel = new Map();

/**
 * Membaca tipe data satu variabel dari jendela sembul ABT.
 *
 * Ditanyakan sekali per variabel lalu diingat. Tanpa ini, tanggal dikirim
 * sebagai teks biasa - dan ABT menyimpannya tanpa mengeluh, sehingga
 * kekeliruannya baru terlihat pada dokumen yang sudah tercetak.
 */
async function tipeData(kode, jatiDiri) {
  if (tipeVariabel.has(kode)) return tipeVariabel.get(kode);
  const alamat =
    `${asalAbt()}/edit_data?no_var=${encodeURIComponent(kode)}` +
    `&perkara_id=${encodeURIComponent(jatiDiri.perkaraId)}&e=${encodeURIComponent(jatiDiri.perkTemp)}`;
  const respons = await fetch(alamat, { credentials: "include", cache: "no-store" });
  if (!respons.ok) throw new Error(`ABT menjawab ${respons.status}`);
  const teks = await respons.text();
  const cocok = teks.match(/name="var_type"\s+value="([^"]*)"/);
  const tipe = cocok ? cocok[1] : "";
  tipeVariabel.set(kode, tipe);
  return tipe;
}

/** Tipe yang benar-benar dapat disimpan lewat rute itu. */
function dapatDisimpan(tipe) {
  return tipe === "data_teks" || tipe === "data_tanggal";
}

/**
 * Menyimpan satu variabel.
 *
 * Jawabannya HTML, bukan JSON - ABT memang menjawab begitu. Yang dicari
 * kalimat "DATA DISIMPAN"; apa pun selain itu diperlakukan sebagai gagal,
 * termasuk jawaban 200 yang tidak memuatnya. Mengaku berhasil karena
 * statusnya 200 adalah cara paling halus kehilangan satu isian.
 */
async function simpanVariabel(kode, nilai, jatiDiri) {
  const tipe = await tipeData(kode, jatiDiri);
  if (!dapatDisimpan(tipe)) {
    return { ok: false, pesan: `Variabel ${kode} bertipe ${tipe || "tidak dikenal"} - tidak dapat disunting.` };
  }

  const alamat =
    `${asalAbt()}/edit_data?no_var=${encodeURIComponent(kode)}` +
    `&perkara_id=${encodeURIComponent(jatiDiri.perkaraId)}&e=${encodeURIComponent(jatiDiri.perkTemp)}`;
  const badan = new URLSearchParams();
  badan.set("aksi", "Simpan");
  badan.set("value", nilai);
  badan.set("var_type", tipe);

  const respons = await fetch(alamat, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: badan.toString(),
  });
  if (!respons.ok) return { ok: false, pesan: `ABT menjawab ${respons.status}.` };

  const teks = await respons.text();
  if (/DATA DISIMPAN/i.test(teks)) return { ok: true, pesan: "tersimpan" };
  if (/DATA TIDAK TERSIMPAN/i.test(teks)) return { ok: false, pesan: "ABT menolak menyimpan." };
  return { ok: false, pesan: "Jawaban ABT tidak dikenali - anggap belum tersimpan." };
}

// ─── Merapikan teks yang sudah ada di blangko ────────────────────────────────

/**
 * ============================================================================
 * NOMOR 6 - PENOMORAN POSITA YANG MENEMPEL
 * ============================================================================
 *
 * Posita diketik sebagai satu gumpalan: "... 23 Oktober 2017.2. Bahwa setelah
 * menikah ...". Angka butir berikutnya menempel langsung pada titik butir
 * sebelumnya, tanpa pemisah apa pun.
 *
 * Di layar ABT itu masih terbaca - kolomnya sempit, jadi teksnya membungkus
 * dan angkanya kebetulan jatuh di awal baris. Di dokumen cetak tidak: seluruh
 * posita menjadi satu paragraf panjang, dan pembacanya harus mencari sendiri
 * di mana satu butir berakhir.
 *
 * Yang dikerjakan hanya MENYISIPKAN PEMISAH. Tidak satu kata pun diubah, tidak
 * satu angka pun dinomori ulang - penomoran ulang berarti mengubah rujukan
 * antar butir ("sebagaimana butir 3"), dan itu mengubah isi gugatan.
 *
 * Butir induk dikenali dari pola "<angka>." dan anak butir dari "<huruf>.".
 * Anak butir diberi lekukan supaya tampak menggantung pada induknya.
 */
function rapikanPosita(teks) {
  let hasil = String(teks || "").replace(/\r\n/g, "\n");

  // Butir induk: titik yang langsung diikuti angka lalu titik.
  // "2017.2. Bahwa" -> "2017.\n2. Bahwa"
  hasil = hasil.replace(/([^\s\n])\s*(\d{1,2})\.\s+(?=[A-Z])/g, "$1\n$2. ");

  // Anak butir: "laki-laki,.b. FATHIYAH" -> "laki-laki,\n   b. FATHIYAH"
  hasil = hasil.replace(/([^\s\n])\s*\.?\s*([a-z])\.\s+(?=[A-Z])/g, "$1\n   $2. ");

  // Baris pertama tidak boleh diawali baris kosong, dan tidak ada baris kosong
  // berganda di tengah - keduanya menjadi paragraf hampa di dokumen cetak.
  return hasil
    .split("\n")
    .map((baris) => baris.replace(/\s+$/, ""))
    .filter((baris, i, semua) => baris.trim() !== "" || (i > 0 && semua[i - 1].trim() !== ""))
    .join("\n")
    .trim();
}

/**
 * ============================================================================
 * NOMOR 8 - KALIMAT PENUTUP KETERANGAN SAKSI
 * ============================================================================
 *
 * Petugas mengakhiri tiap keterangan saksi dengan "Bahwa sudah cukup;" atau
 * "Bahwa tidak sanggup lagi;". Kalimat itu catatan pemeriksaan - penanda bahwa
 * saksi selesai - bukan fakta yang dibuktikan. Di dalam putusan ia terbaca
 * seperti keterangan saksi yang berdiri sama dengan yang lain, padahal ia
 * tidak menerangkan apa pun tentang perkaranya.
 *
 * Ikut dibuang: baris kosong dan spasi yang tertinggal di bawahnya. Baris
 * kosong di ujung variabel menjadi paragraf hampa di dokumen cetak, dan
 * paragraf hampa di tengah pertimbangan hukum terlihat seperti ada yang
 * terhapus.
 *
 * Yang TIDAK dibuang: apa pun selain kedua kalimat itu. Daftar penutupnya
 * ditulis tegas di POLA_PENUTUP, bukan ditebak dari panjang kalimat - kalimat
 * pendek di tengah keterangan bisa saja fakta yang menentukan.
 */
const POLA_PENUTUP = [
  /^bahwa\s+sudah\s+cukup\b/i,
  /^bahwa\s+tidak\s+sanggup\s+lagi\b/i,
  /^sudah\s+cukup\b/i,
];

function bersihkanKeteranganSaksi(teks) {
  const baris = String(teks || "").replace(/\r\n/g, "\n").split("\n");
  const disimpan = baris.filter((satu) => {
    const bersih = satu.replace(/^[\s\-–•]+/, "").replace(/\s+/g, " ").trim();
    if (bersih === "") return true; // baris kosong diurus di bawah
    return !POLA_PENUTUP.some((pola) => pola.test(bersih));
  });

  return disimpan
    .map((satu) => satu.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Tiga berkas dari satu tekanan CETAK ─────────────────────────────────────

/**
 * ============================================================================
 * APA YANG SEBENARNYA DILAKUKAN TOMBOL CETAK ABT
 * ============================================================================
 *
 * Dibaca dari kodenya di server - views/abt/preview.php - tombol CETAK adalah
 * tautan biasa ke abt/preview, dan yang dikembalikannya SATU berkas:
 *
 *   header("Content-Type: application/vnd.ms-word");
 *   header("Content-disposition: attachment; filename=\"<no perkara> - <blangko>.rtf\"");
 *
 * RTF, satu-satunya bentuk yang dihasilkan ABT. Tidak ada satu pun rute di ABT
 * yang menghasilkan PDF.
 *
 * Anonimisasi ADA di ABT, tetapi ia menuntut berkasnya DIUNGGAH: rute
 * abt/main/anonim menerima perkara_id, perkara_no, dan file_putusan sebagai
 * multipart, lalu mengembalikan "anonim_<no>.rtf". Petugas karena itu harus
 * mengunduh putusannya lebih dulu, membuka menu lain, lalu mengunggah berkas
 * yang baru saja ia unduh.
 *
 * ============================================================================
 * YANG DIKERJAKAN DI SINI
 * ============================================================================
 *
 * Satu tekanan, tiga berkas, tanpa satu pun langkah manual di antaranya:
 *
 *   1. RTF     diambil dari abt/preview - alamat yang sama dengan tautannya
 *   2. PDF     RTF itu dikirim ke ALETA, dikonversi LibreOffice, kembali
 *   3. ANONIM  RTF itu diunggahkan ke rute anonimisasi ABT sendiri
 *
 * PDF dibuat dari yang BUKAN anonim - itu putusan yang ditandatangani.
 * Anonimnya untuk diunggah ke direktori putusan, dan bentuk yang diminta di
 * sana memang RTF.
 *
 * Urutannya disengaja: RTF lebih dulu dan diunduh SEGERA. Kalau dua langkah
 * berikutnya gagal, yang paling dibutuhkan sudah ada di tangan.
 *
 * ============================================================================
 * DAPAT DIMATIKAN, DAN BAWAANNYA MATI
 * ============================================================================
 *
 * Ia mengubah arti tombol milik aplikasi orang lain: satu tekanan yang dulu
 * menghasilkan satu berkas kini menghasilkan tiga. Perubahan sebesar itu tidak
 * pantas diambil sendiri oleh sebuah pembaruan - saklarnya ada di popup ikon
 * ALETA, dan selama mati, tombol CETAK berperilaku persis seperti semula.
 */
const KUNCI_CETAK_TIGA = "cetakTigaBerkas";
const ALETA_API_PDF = "/aleta/api/aleta-bot/abt/pdf";

/**
 * Keadaan saklar, dibaca sekali lalu diikuti perubahannya.
 *
 * Bawaannya MATI. Ia mengubah arti tombol milik aplikasi orang lain - satu
 * tekanan yang dulu menghasilkan satu berkas menjadi tiga - dan perubahan
 * sebesar itu tidak pantas diambil sendiri oleh sebuah pembaruan.
 */
let cetakTigaMenyala = false;

async function muatSaklarCetak() {
  try {
    const simpan = await chrome.storage.local.get([KUNCI_CETAK_TIGA]);
    cetakTigaMenyala = simpan[KUNCI_CETAK_TIGA] === true;
  } catch {
    cetakTigaMenyala = false;
  }
  try {
    // Diubah dari popup sementara halaman ini terbuka: berlaku seketika,
    // tanpa memuat ulang. Yang baru menyalakannya lalu menekan CETAK tidak
    // seharusnya mendapat satu berkas karena halamannya belum disegarkan.
    chrome.storage.onChanged.addListener((perubahan, wilayah) => {
      if (wilayah !== "local" || !perubahan[KUNCI_CETAK_TIGA]) return;
      cetakTigaMenyala = perubahan[KUNCI_CETAK_TIGA].newValue === true;
    });
  } catch {
    /* tanpa pendengar, saklarnya berlaku pada pemuatan berikutnya */
  }
}

/** Menyimpan satu blob sebagai unduhan, dengan nama yang ditentukan di sini. */
function unduhBlob(blob, nama) {
  const alamat = URL.createObjectURL(blob);
  const tautan = document.createElement("a");
  tautan.href = alamat;
  tautan.download = nama;
  document.body.appendChild(tautan);
  tautan.click();
  tautan.remove();
  // Dilepas menyusul, bukan seketika: sebagian peramban membatalkan unduhan
  // yang alamat blob-nya sudah dicabut sebelum unduhannya benar-benar mulai.
  setTimeout(() => URL.revokeObjectURL(alamat), 30_000);
}

/**
 * Nama berkas, disusun di sini dan bukan diambil dari header ABT.
 *
 * Header ABT menyusunnya dari nomor perkara dan nama blangko, dan nama blangko
 * memuat tanda kurung siku serta garis miring - "[01] [Kabul Verstek] Cerai
 * (Format Lengkap)". Yang bergaris miring tidak dapat menjadi nama berkas di
 * mana pun, dan yang lolos pun menghasilkan tiga berkas dengan nama sepanjang
 * satu baris.
 */
function namaBerkas(nomorPerkara, akhiran, jenis) {
  const dasar = String(nomorPerkara || "putusan").replace(/[\\/:*?"<>|]+/g, "_");
  return jenis ? `${dasar} - ${jenis}.${akhiran}` : `${dasar}.${akhiran}`;
}

function base64DariBuffer(buffer) {
  const byte = new Uint8Array(buffer);
  let biner = "";
  // Dipotong-potong: String.fromCharCode dengan puluhan ribu argumen sekaligus
  // melampaui batas tumpukan pemanggilan pada berkas yang besar.
  const potongan = 0x8000;
  for (let i = 0; i < byte.length; i += potongan) {
    biner += String.fromCharCode.apply(null, byte.subarray(i, i + potongan));
  }
  return btoa(biner);
}

/**
 * Menerbitkan ketiga berkas.
 *
 * Tiap langkah melaporkan keadaannya sendiri, dan kegagalan satu langkah tidak
 * menghentikan langkah lain: yang gagal disebutkan, yang berhasil tetap
 * diunduh. Menghentikan semuanya karena satu kegagalan berarti petugas
 * kehilangan berkas yang sebenarnya sudah siap.
 */
async function terbitkanTigaBerkas(alamatPreview, jatiDiri, lapor) {
  const nomor = nomorPerkaraAbt();
  const hasil = { rtf: "", pdf: "", anonim: "" };

  // ── 1. RTF, dari alamat yang sama dengan tautan CETAK ─────────────────────
  lapor("Mengambil putusan dari ABT…");
  let isiRtf = null;
  try {
    const respons = await fetch(alamatPreview, { credentials: "include", cache: "no-store" });
    if (!respons.ok) throw new Error(`ABT menjawab ${respons.status}`);
    isiRtf = await respons.arrayBuffer();
    if (isiRtf.byteLength < 32) throw new Error("berkasnya kosong");
    unduhBlob(new Blob([isiRtf], { type: "application/rtf" }), namaBerkas(nomor, "rtf"));
    hasil.rtf = "tersimpan";
  } catch (galat) {
    hasil.rtf = `gagal: ${String((galat && galat.message) || galat)}`;
    // Tanpa RTF, dua langkah berikutnya tidak punya bahan sama sekali.
    lapor(`Putusan tidak dapat diambil — ${hasil.rtf}`, true);
    return hasil;
  }

  // ── 2. PDF, dikonversi ALETA dari RTF yang BUKAN anonim ───────────────────
  lapor("Mengubah menjadi PDF…");
  try {
    const respons = await fetch(ALETA_API_PDF, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rtfBase64: base64DariBuffer(isiRtf) }),
    });
    if (respons.status === 401) throw new Error("belum masuk portal ALETA");
    if (!respons.ok) throw new Error(`ALETA menjawab ${respons.status}`);
    const luar = await respons.json();
    const isi = luar?.data ?? luar;
    if (!isi?.available) throw new Error(isi?.message || "ALETA belum dapat menjawab");
    const biner = Uint8Array.from(atob(isi.pdfBase64), (c) => c.charCodeAt(0));
    unduhBlob(new Blob([biner], { type: "application/pdf" }), namaBerkas(nomor, "pdf"));
    hasil.pdf = "tersimpan";
  } catch (galat) {
    hasil.pdf = `gagal: ${String((galat && galat.message) || galat)}`;
  }

  // ── 3. Anonim, lewat rute anonimisasi ABT sendiri ─────────────────────────
  //
  // Dikerjakan ABT, bukan ALETA. Aturan penyamarannya - nama, NIK, alamat,
  // pekerjaan, nomor kutipan akta nikah, surel - sudah ditetapkan di sana, dan
  // menyalinnya ke sini berarti dua aturan yang akan berselisih diam-diam.
  lapor("Meminta ABT menganonimkan…");
  try {
    if (!nomor) throw new Error("nomor perkara tidak terbaca dari halaman");
    const borang = new FormData();
    borang.set("perkara_id", jatiDiri.perkaraId);
    borang.set("perkara_no", nomor);
    borang.set(
      "file_putusan",
      new Blob([isiRtf], { type: "application/rtf" }),
      namaBerkas(nomor, "rtf")
    );
    const respons = await fetch(`${asalAbt()}/main/anonim`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      body: borang,
    });
    if (!respons.ok) throw new Error(`ABT menjawab ${respons.status}`);
    const isi = await respons.arrayBuffer();
    const awal = new TextDecoder("latin1").decode(new Uint8Array(isi).subarray(0, 5));
    // Jawaban ABT dapat berupa RTF anonim ATAU halaman berisi keterangan
    // gagal. Keduanya 200, dan yang membedakannya hanya isinya - halaman HTML
    // yang tersimpan sebagai .rtf adalah kegagalan yang paling sulit dikenali.
    if (!awal.startsWith("{\\rtf")) {
      const teks = new TextDecoder().decode(isi);
      const pesan = teks.match(/Proses Anonim Gagal[^<]*/i);
      throw new Error(pesan ? pesan[0].slice(0, 120) : "ABT tidak mengembalikan berkas RTF");
    }
    unduhBlob(new Blob([isi], { type: "application/rtf" }), namaBerkas(nomor, "rtf", "anonim"));
    hasil.anonim = "tersimpan";
  } catch (galat) {
    hasil.anonim = `gagal: ${String((galat && galat.message) || galat)}`;
  }

  const ringkas = `RTF ${hasil.rtf} · PDF ${hasil.pdf} · anonim ${hasil.anonim}`;
  lapor(ringkas, /gagal/.test(ringkas));
  return hasil;
}

// ─── Riwayat dan urungkan ────────────────────────────────────────────────────

/**
 * ============================================================================
 * TIAP PERUBAHAN DICATAT, DAN DAPAT DIURUNGKAN
 * ============================================================================
 *
 * Tanpa ini, pengisian otomatis yang keliru tidak dapat dibedakan dari ketikan
 * petugas: keduanya hanya berupa teks di dalam kolom, tanpa jejak siapa yang
 * menaruhnya dan apa isinya sebelum itu. Yang menemukan kekeliruan seminggu
 * kemudian tidak punya cara mengembalikannya selain mengingat.
 *
 * Disimpan di penyimpanan ekstensi, bukan di server. Itu keputusan sadar
 * dengan batas yang harus disebut: riwayatnya hanya ada di peramban ini, dan
 * hilang bila datanya dibersihkan. Catatan yang tersimpan di server menuntut
 * tabel baru beserta migrasinya - pantas dikerjakan, tetapi bukan syarat bagi
 * kegunaan yang paling dibutuhkan sekarang, yaitu mengurungkan yang baru saja
 * salah diterapkan.
 */
const KUNCI_RIWAYAT = "abtRiwayat";
const BATAS_RIWAYAT = 200;

async function catatRiwayat(catatan) {
  try {
    const simpan = await chrome.storage.local.get([KUNCI_RIWAYAT]);
    const daftar = Array.isArray(simpan[KUNCI_RIWAYAT]) ? simpan[KUNCI_RIWAYAT] : [];
    daftar.unshift(catatan);
    await chrome.storage.local.set({ [KUNCI_RIWAYAT]: daftar.slice(0, BATAS_RIWAYAT) });
  } catch {
    /* penyimpanan tidak tersedia - perubahannya tetap tersimpan di ABT */
  }
}

async function bacaRiwayat(perkaraId) {
  try {
    const simpan = await chrome.storage.local.get([KUNCI_RIWAYAT]);
    const daftar = Array.isArray(simpan[KUNCI_RIWAYAT]) ? simpan[KUNCI_RIWAYAT] : [];
    return daftar.filter((x) => x && x.perkaraId === perkaraId);
  } catch {
    return [];
  }
}

// ─── Menyunting di tempat ────────────────────────────────────────────────────

/**
 * Mengganti sel isi menjadi kotak ketik, di barisnya sendiri.
 *
 * Inilah yang diminta: menyunting DI HADAPAN tampilan, bukan di balik jendela
 * sembul yang menutupi variabel lain. Nilai lamanya disimpan supaya Batal
 * benar-benar mengembalikan tampilan - bukan sekadar menutup kotaknya.
 */
function sunting(item, jatiDiri, sesudahSimpan) {
  if (item.selNilai.querySelector("textarea")) return;

  const nilaiLama = item.selNilai.textContent.replace(/\s+/g, " ").trim();
  const tampilanLama = item.selNilai.innerHTML;

  const kotak = buatElemen("div", "aleta-abt-sunting");
  kotak.setAttribute(TANDA_ABT, "1");

  const ketik = document.createElement("textarea");
  ketik.className = "aleta-abt-ketik";
  ketik.value = nilaiLama === "DATA_TIDAK_ADA" ? "" : nilaiLama;
  ketik.rows = Math.min(Math.max(Math.ceil(ketik.value.length / 90), 2), 12);
  kotak.appendChild(ketik);

  const kabar = buatElemen("div", "aleta-abt-kabar");
  const baris = buatElemen("div", "aleta-abt-tombol");
  const simpan = buatElemen("button", "aleta-abt-simpan", "Simpan");
  simpan.type = "button";
  const batal = buatElemen("button", "aleta-abt-batal", "Batal");
  batal.type = "button";
  baris.appendChild(simpan);
  baris.appendChild(batal);
  kotak.appendChild(baris);
  kotak.appendChild(kabar);

  item.selNilai.textContent = "";
  item.selNilai.appendChild(kotak);
  ketik.focus();

  const tutup = (isiBaru) => {
    if (isiBaru === undefined) {
      item.selNilai.innerHTML = tampilanLama;
      return;
    }
    item.selNilai.textContent = isiBaru || "DATA_TIDAK_ADA";
  };

  batal.addEventListener("click", () => tutup());

  // Escape membatalkan, Ctrl+Enter menyimpan. Keduanya kebiasaan yang sudah
  // ada di kepala orang; tidak menyediakannya berarti memaksa tangan pindah
  // ke tetikus untuk tiap satu isian.
  ketik.addEventListener("keydown", (peristiwa) => {
    if (peristiwa.key === "Escape") {
      peristiwa.preventDefault();
      tutup();
    }
    if (peristiwa.key === "Enter" && (peristiwa.ctrlKey || peristiwa.metaKey)) {
      peristiwa.preventDefault();
      simpan.click();
    }
  });

  simpan.addEventListener("click", async () => {
    simpan.disabled = true;
    batal.disabled = true;
    kabar.textContent = "Menyimpan…";
    kabar.className = "aleta-abt-kabar";
    try {
      const hasil = await simpanVariabel(item.kode, ketik.value, jatiDiri);
      if (!hasil.ok) {
        kabar.textContent = hasil.pesan;
        kabar.className = "aleta-abt-kabar aleta-abt-gagal";
        simpan.disabled = false;
        batal.disabled = false;
        return;
      }
      void catatRiwayat({
        perkaraId: jatiDiri.perkaraId,
        kode: item.kode,
        nama: item.nama,
        sebelum: nilaiLama,
        sesudah: ketik.value.trim(),
        cara: "sunting tangan",
        pada: new Date().toISOString(),
      });
      tutup(ketik.value.trim());
      if (typeof sesudahSimpan === "function") sesudahSimpan(item.kode, ketik.value.trim());
    } catch (galat) {
      kabar.textContent = String((galat && galat.message) || galat);
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      simpan.disabled = false;
      batal.disabled = false;
    }
  });
}

/**
 * Memasang penyunting pada tiap baris yang memang dapat disunting.
 *
 * Yang menentukan bukan tebakan kita, melainkan ABT sendiri: baris yang tidak
 * punya tombol "edit" adalah baris yang isinya dihitung - data_sipp atau
 * data_sql - dan menyuntingnya hanya akan tertimpa pada pemuatan berikutnya.
 */
function pasangSunting(jatiDiri) {
  for (const item of barisVariabel().values()) {
    if (item.selNilai.getAttribute(TANDA_ABT) === "siap") continue;
    const bisa = item.selAksi && item.selAksi.querySelector("a[onclick]");
    if (!bisa) continue;

    item.selNilai.setAttribute(TANDA_ABT, "siap");
    item.selNilai.classList.add("aleta-abt-dapat-disunting");
    item.selNilai.title = "Klik untuk menyunting di tempat (ALETA). Ctrl+Enter menyimpan, Esc membatalkan.";
    item.selNilai.addEventListener("click", (peristiwa) => {
      if (peristiwa.target.closest(".aleta-abt-sunting")) return;
      sunting(item, jatiDiri);
    });
  }
}

// ─── Panel usulan ────────────────────────────────────────────────────────────

const NADA_KEYAKINAN = {
  pasti: { kelas: "aleta-tanda-hijau", teks: "kedua saksi sama" },
  cukup: { kelas: "aleta-tanda-kuning", teks: "satu saksi" },
  bentrok: { kelas: "aleta-tanda-merah", teks: "saksi berselisih" },
  kosong: { kelas: "aleta-tanda-abu", teks: "tidak ditemukan" },
  tidak_ada_sumber: { kelas: "aleta-tanda-abu", teks: "tidak ada sumbernya" },
};

/**
 * Satu usulan, beserta kalimat yang melahirkannya.
 *
 * Kutipan sumbernya bukan hiasan. Tanpa itu, memeriksa satu usulan berarti
 * membaca ulang dua blok keterangan saksi sepanjang layar - dan yang tidak
 * dapat diperiksa dengan murah pada akhirnya diterima tanpa diperiksa.
 */
function kartuUsulan(u, keadaanSekarang, pilih) {
  const kartu = buatElemen("div", "aleta-abt-kartu");

  const kepala = buatElemen("div", "aleta-abt-kartu-kepala");
  const centang = document.createElement("input");
  centang.type = "checkbox";
  centang.className = "aleta-abt-centang";
  // Hanya yang benar-benar punya nilai DAN tidak bentrok yang dicentang
  // sendiri. Yang berselisih justru yang paling perlu dibaca manusia.
  centang.checked = Boolean(u.nilai) && u.keyakinan !== "bentrok";
  centang.disabled = !u.nilai;
  kepala.appendChild(centang);
  kepala.appendChild(buatElemen("span", "aleta-abt-kode", u.kode));
  kepala.appendChild(buatElemen("span", "aleta-abt-nama", u.nama));

  const nada = NADA_KEYAKINAN[u.keyakinan] || NADA_KEYAKINAN.kosong;
  const lencana = buatElemen("span", `aleta-tanda ${nada.kelas}`, nada.teks);
  kepala.appendChild(lencana);
  kartu.appendChild(kepala);

  const sanding = buatElemen("div", "aleta-abt-sanding");
  const kini = buatElemen("div", "aleta-abt-kini");
  kini.appendChild(buatElemen("span", "aleta-abt-label", "sekarang"));
  kini.appendChild(buatElemen("span", "aleta-abt-isi", keadaanSekarang || "(kosong)"));
  sanding.appendChild(kini);

  if (u.nilai) {
    const usul = buatElemen("div", "aleta-abt-usul");
    usul.appendChild(buatElemen("span", "aleta-abt-label", "usulan"));
    usul.appendChild(buatElemen("span", "aleta-abt-isi", u.nilai));
    sanding.appendChild(usul);
  }
  kartu.appendChild(sanding);

  if (u.bentrok) {
    kartu.appendChild(
      buatElemen(
        "div",
        "aleta-abt-bentrok",
        `Saksi kedua mengatakan "${u.bentrok}". Selisih ini soal pembuktian, bukan soal pengisian.`
      )
    );
  }

  if (u.catatan) kartu.appendChild(buatElemen("div", "aleta-abt-catatan", u.catatan));

  for (const s of u.sumber || []) {
    const kutip = buatElemen("div", "aleta-abt-kutipan");
    kutip.appendChild(buatElemen("span", "aleta-abt-asal", s.saksi ? `Saksi ${s.saksi}` : "SIPP"));
    kutip.appendChild(buatElemen("span", "aleta-abt-kalimat", s.kalimat));
    kartu.appendChild(kutip);
  }

  pilih.push({ usulan: u, centang });
  return kartu;
}

/**
 * ============================================================================
 * NOMOR 8 - PENJAGA SEBELUM CETAK
 * ============================================================================
 *
 * Tombol CETAK di ABT adalah tautan biasa ke abt/preview. Menekannya membuka
 * pratinjau yang siap dicetak, dan tidak ada satu pun pemeriksaan sebelum itu.
 *
 * Dua hal yang harus tertahan di sini:
 *
 *   1. Variabel kerangka yang masih DATA_TIDAK_ADA. Putusan yang tercetak
 *      dengan kalimat itu di dalamnya sudah beredar sebelum ketahuan.
 *   2. Variabel "(OTOMATIS)" yang masih berbunyi "TIDAK BENAR QUERY NYA".
 *      Ini yang paling berbahaya: bunyinya seperti pesan galat mesin, tetapi
 *      ia tercetak sebagai bagian pertimbangan hukum.
 *
 * Penjaganya MENAHAN, lalu bertanya - bukan melarang. Ada perkara yang memang
 * tidak memerlukan sebagian variabel itu (prodeo pada perkara yang bukan
 * prodeo, misalnya), dan yang paling tahu bukan ekstensi ini.
 */
function periksaKelengkapan() {
  const peta = barisVariabel();
  const kurang = [];
  for (const kode of VARIABEL_SASARAN) {
    const item = peta.get(kode);
    if (!item) continue;
    if (ISI_KOSONG.test(item.nilai)) kurang.push(`${kode} ${item.nama}`);
  }
  const rusak = [];
  for (const kode of VAR_OTOMATIS) {
    const item = peta.get(kode);
    if (!item) continue;
    if (/TIDAK BENAR QUERY NYA|BELUM ISI/i.test(item.nilai)) rusak.push(`${kode} ${item.nama}`);
  }
  return { kurang, rusak };
}

function pasangPenjagaCetak(jatiDiri, lapor) {
  for (const tautan of Array.from(document.querySelectorAll('a[href*="abt/preview"]'))) {
    if (tautan.getAttribute(TANDA_ABT) === "jaga") continue;
    tautan.setAttribute(TANDA_ABT, "jaga");

    /**
     * ======================================================================
     * SATU PENDENGAR, DUA PEKERJAAN, DAN URUTANNYA MENENTUKAN
     * ======================================================================
     *
     * Penjaga kelengkapan berjalan LEBIH DULU. Kalau petugas membatalkan di
     * situ, tiga berkas tidak boleh diterbitkan sama sekali - menerbitkan
     * putusan yang barusan ia putuskan belum siap adalah kebalikan dari apa
     * yang diminta.
     *
     * Sesudah ia lolos, dan hanya bila saklarnya menyala, tautannya ditahan
     * dan ketiga berkas diterbitkan dari alamat tautan itu sendiri. Ditahan,
     * sebab membiarkannya berjalan membuat peramban berpindah halaman di
     * tengah dua permintaan yang belum selesai.
     */
    tautan.addEventListener(
      "click",
      (peristiwa) => {
        const { kurang, rusak } = periksaKelengkapan();
        if (kurang.length === 0 && rusak.length === 0) return;

        const baris = (daftar) => daftar.map((x) => `  - ${x}`).join("\n");
        const pesan = [
          "ALETA menahan pencetakan sebentar.",
          "",
          rusak.length
            ? `${rusak.length} variabel OTOMATIS masih berbunyi pesan galat, dan itu akan IKUT TERCETAK sebagai pertimbangan hukum:\n${baris(rusak)}`
            : "",
          kurang.length ? `${kurang.length} variabel kerangka masih kosong:\n${baris(kurang)}` : "",
          "",
          "Tetap lanjutkan ke pratinjau cetak?",
        ]
          .filter(Boolean)
          .join("\n");

        if (!window.confirm(pesan)) {
          peristiwa.preventDefault();
          peristiwa.stopPropagation();
        }
      },
      true
    );

    tautan.addEventListener("click", (peristiwa) => {
      // Sudah dibatalkan penjaga kelengkapan di atas.
      if (peristiwa.defaultPrevented) return;

      // ====================================================================
      // SAKLARNYA DIBACA SEBELUM KLIK, BUKAN DI DALAMNYA
      // ====================================================================
      //
      // chrome.storage hanya asinkron, dan pendengar klik harus memutuskan
      // SEKARANG apakah tautannya ditahan. Membacanya di dalam pendengar
      // berarti tautannya sudah berjalan sebelum jawabannya datang - dan
      // menahannya lebih dulu "untuk sementara" lalu membukanya kembali
      // menghasilkan dua perilaku yang berlomba.
      //
      // Karena itu jawabannya sudah ada sebelum klik: dibaca sekali saat
      // panel dibangun, dan diperbarui sendiri bila saklarnya diubah dari
      // popup - lihat cetakTigaMenyala.
      if (!cetakTigaMenyala) return;

      peristiwa.preventDefault();
      void terbitkanTigaBerkas(tautan.href, jatiDiri, lapor);
    });
  }
}

async function mintaUsulan(muatan) {
  const respons = await fetch(ALETA_API_ABT, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(muatan),
  });
  if (respons.status === 401) throw new Error("Belum masuk portal ALETA.");
  if (!respons.ok) throw new Error(`ALETA menjawab ${respons.status}.`);
  const luar = await respons.json();
  const isi = luar?.data ?? luar;
  if (!isi?.available) throw new Error(isi?.message || "ALETA belum dapat menjawab.");
  return isi;
}

function susunPanelAbt(jatiDiri) {
  const panel = buatElemen("div", "aleta-panel aleta-panel-abt");
  panel.id = PENANDA_ABT;
  panel.setAttribute("data-tema", "gelap");

  const kepala = buatElemen("div", "aleta-kepala");
  kepala.appendChild(buatElemen("span", "aleta-merek", "ALETA"));
  kepala.appendChild(buatElemen("span", "aleta-nomor", nomorPerkaraAbt() || "blangko ABT"));
  panel.appendChild(kepala);

  // Geser, ubah ukuran, ciut, layar penuh, kembalikan bawaan, tema, tutup -
  // seluruhnya dari panel-alat.js. Panel ini sebelumnya tidak punya satu pun,
  // dan untuk panel yang menutupi sisi kanan halaman kerja itu berarti
  // satu-satunya jalan keluar adalah menutupnya.
  void alatPasangPanel(panel, kepala, KUNCI_POSISI_ABT, {
    kunciTema: KUNCI_TEMA_PANEL,
    saatTutup: () => panel.remove(),
  });

  const isi = buatElemen("div", "aleta-isi");

  isi.appendChild(
    buatElemen(
      "div",
      "aleta-baris-ket",
      "Klik isi variabel mana pun untuk menyuntingnya langsung di barisnya. " +
        "Ctrl+Enter menyimpan, Esc membatalkan."
    )
  );

  // NOMOR 3 - arti ketiga warna dinyatakan sekali, bukan ditebak dari
  // warnanya. Lencana tanpa keterangan mengajari orang menebak, dan tebakan
  // yang keliru pada "cukup" berarti satu keterangan saksi dianggap dua.
  const petunjuk = buatElemen("div", "aleta-abt-petunjuk");
  for (const [kelas, teks] of [
    ["aleta-tanda-hijau", "pasti — kedua saksi sama"],
    ["aleta-tanda-kuning", "cukup — satu saksi saja"],
    ["aleta-tanda-merah", "bentrok — saksi berselisih"],
  ]) {
    petunjuk.appendChild(buatElemen("span", `aleta-tanda ${kelas}`, teks));
  }
  isi.appendChild(petunjuk);

  const tombolBaris = buatElemen("div", "aleta-abt-aksi");
  const tombolSipp = buatElemen("button", "aleta-permintaan-tombol", "Tarik 5 dari SIPP");
  tombolSipp.type = "button";
  const tombolSaksi = buatElemen("button", "aleta-permintaan-tombol", "Isi dari Keterangan Saksi");
  tombolSaksi.type = "button";
  tombolBaris.appendChild(tombolSipp);
  tombolBaris.appendChild(tombolSaksi);
  isi.appendChild(tombolBaris);

  const kabar = buatElemen("div", "aleta-abt-kabar");
  isi.appendChild(kabar);

  /**
   * ==========================================================================
   * RIWAYAT DITARUH DI ATAS, BUKAN DI KAKI PANEL
   * ==========================================================================
   *
   * Sebelumnya wadahnya berada PALING BAWAH, sesudah kartu selisih, kartu
   * huruf, dan seluruh kartu usulan. Panel dibatasi tiga per lima layar dan
   * isinya menggulung di dalam dirinya sendiri - jadi menekan "Riwayat
   * perubahan" memang menggambar daftarnya, tetapi menggambarnya di tempat
   * yang tidak terlihat, ratusan piksel di bawah pandangan.
   *
   * Yang menekannya menyimpulkan tombolnya rusak. Ia tidak rusak; ia menjawab
   * di luar layar.
   *
   * Dua perbaikan: wadahnya pindah ke atas - tepat di bawah tombolnya - dan
   * sesudah digambar ia digulung ke pandangan. Yang kedua tetap perlu, sebab
   * panel yang sedang tergulung ke bawah tidak otomatis kembali ke atas.
   */
  const wadahRiwayat = buatElemen("div", "aleta-abt-daftar");
  isi.appendChild(wadahRiwayat);

  // Urutannya disengaja: selisih antar saksi lebih dulu, sebab ia dapat
  // membatalkan seluruh isian di bawahnya. Lalu huruf alasan, lalu usulan.
  const wadahSelisih = buatElemen("div", "aleta-abt-daftar");
  isi.appendChild(wadahSelisih);
  const wadahHuruf = buatElemen("div", "aleta-abt-daftar");
  isi.appendChild(wadahHuruf);
  const wadahUsulan = buatElemen("div", "aleta-abt-daftar");
  isi.appendChild(wadahUsulan);

  /**
   * NOMOR 4 - selisih antara dua saksi.
   *
   * Ditaruh paling atas dan tidak dapat diterapkan dengan tombol apa pun:
   * ini bukan sesuatu yang diperbaiki dengan mengisi kolom, melainkan sesuatu
   * yang harus diketahui hakim sebelum putusan disusun.
   */
  function gambarSelisih(daftar) {
    wadahSelisih.textContent = "";
    if (!daftar.length) return;
    const kotak = buatElemen("div", "aleta-abt-kartu aleta-abt-kartu-awas");
    kotak.appendChild(
      buatElemen("div", "aleta-abt-nama", `${daftar.length} keterangan yang berselisih antar saksi`)
    );
    kotak.appendChild(
      buatElemen(
        "div",
        "aleta-abt-catatan",
        "Selisih ini soal pembuktian, bukan soal pengisian. Tidak ada tombol untuk menyelesaikannya."
      )
    );
    for (const x of daftar) {
      // Tanpa lencana bulat - sebab yang sama seperti pada huruf alasan:
      // lencana yang meregang setinggi barisnya berubah menjadi bulatan besar
      // dan menyisakan sedikit ruang bagi keterangan yang harus dibaca.
      kotak.appendChild(buatElemen("div", "aleta-abt-naskah", x.hal));
      kotak.appendChild(
        buatElemen("div", "aleta-abt-bunyi", `saksi 1: ${x.saksi1}  ·  saksi 2: ${x.saksi2}`)
      );
    }
    wadahSelisih.appendChild(kotak);
  }

  /**
   * ==========================================================================
   * NOMOR 6 - HURUF ALASAN PERCERAIAN, DENGAN CENTANGAN YANG DAPAT DITERAPKAN
   * ==========================================================================
   *
   * Sebelumnya bagian ini hanya MENUNJUK: bunyi pasalnya digambar, dan
   * hurufnya harus diketik sendiri di baris 8503. Alasannya masih benar - satu
   * huruf yang salah mengubah dasar hukum putusan - tetapi harganya ternyata
   * lebih besar daripada manfaatnya: petugas tetap harus mengetik ulang huruf
   * yang sudah terpampang di layar, dan yang diketik ulang bisa salah tulis.
   *
   * Sekarang tiap huruf punya centangannya, dan yang tercentang dituliskan ke
   * 8503 - beserta 4020 yang mengikutinya. Yang TIDAK berubah: manusia yang
   * mencentang. Huruf yang syaratnya belum tentu terpenuhi tidak pernah
   * tercentang sendiri, dan syaratnya tetap tertulis di sebelahnya.
   *
   * ==========================================================================
   * LENCANA BULAT BERISI NAMA PASAL DIBUANG
   * ==========================================================================
   *
   * Nama naskahnya dulu ditaruh di dalam lencana ber-border-radius 999px.
   * Lencana itu flex-item yang meregang setinggi barisnya, sehingga
   * "Pasal 19 PP Nomor 9 Tahun 1975" berubah menjadi bulatan raksasa yang
   * memakan separuh lebar panel - dan bunyi pasalnya, yang justru harus
   * dibaca, tersisa satu kata per baris di sisa ruangnya.
   *
   * Sekarang nama naskahnya jadi keterangan biasa di atas kutipannya, selebar
   * panel, dan bunyi pasalnya mendapat seluruh lebar itu.
   */
  function gambarHuruf(daftar, belumSiap) {
    wadahHuruf.textContent = "";
    if (!daftar.length && !belumSiap.length) return;

    const kotak = buatElemen("div", "aleta-abt-kartu");
    kotak.appendChild(buatElemen("div", "aleta-abt-nama", "8503 — huruf alasan perceraian"));

    const pilihan = [];
    for (const h of daftar) {
      const blok = buatElemen("div", "aleta-abt-huruf");

      const kepalaHuruf = buatElemen("label", "aleta-abt-huruf-kepala");
      const centang = document.createElement("input");
      centang.type = "checkbox";
      centang.className = "aleta-abt-centang";
      // Yang bersyarat tidak pernah tercentang sendiri. Huruf B menuntut dua
      // tahun berturut-turut dan huruf H menuntut akibat ketidakrukunan;
      // keduanya fakta yang dibuktikan di persidangan, bukan kesimpulan dari
      // kata kunci yang muncul di keterangan saksi.
      centang.checked = !h.syarat;
      kepalaHuruf.appendChild(centang);
      kepalaHuruf.appendChild(buatElemen("span", "aleta-abt-huruf-nama", `Huruf ${h.huruf}`));
      kepalaHuruf.appendChild(
        buatElemen("span", "aleta-abt-huruf-pemicu", `dipicu: ${h.pemicu.join(", ")}`)
      );
      blok.appendChild(kepalaHuruf);

      if (h.syarat) blok.appendChild(buatElemen("div", "aleta-abt-catatan", h.syarat));

      for (const d of h.dasar || []) {
        blok.appendChild(buatElemen("div", "aleta-abt-naskah", d.sumber.nama));
        blok.appendChild(buatElemen("div", "aleta-abt-bunyi", d.bunyi));
        if (d.catatanNaskah) {
          blok.appendChild(buatElemen("div", "aleta-abt-kutipan-sumber", d.catatanNaskah));
        }
      }

      kotak.appendChild(blok);
      pilihan.push({ huruf: h.huruf, centang });
    }

    for (const h of belumSiap) {
      kotak.appendChild(buatElemen("div", "aleta-abt-catatan", `huruf ${h.huruf}: ${h.sebab}`));
    }

    if (pilihan.length) {
      const terap = buatElemen("button", "aleta-permintaan-tombol", "Tulis 8503 dan 4020");
      terap.type = "button";
      const kabarHuruf = buatElemen("div", "aleta-abt-kabar");
      kotak.appendChild(terap);
      kotak.appendChild(kabarHuruf);

      terap.addEventListener("click", async () => {
        const dipilih = pilihan.filter((x) => x.centang.checked).map((x) => x.huruf);
        if (dipilih.length === 0) {
          kabarHuruf.className = "aleta-abt-kabar aleta-abt-gagal";
          kabarHuruf.textContent = "Belum ada huruf yang dicentang.";
          return;
        }
        terap.disabled = true;
        kabarHuruf.className = "aleta-abt-kabar";

        // 8503 memuat hurufnya; 4020 adalah penyalur yang mengaktifkan blok
        // kuning yang sesuai, dan bentuknya "alasan <huruf>". Keduanya ditulis
        // sekaligus - menulis salah satunya saja meninggalkan blangko dalam
        // keadaan setengah, dan itu justru keadaan yang paling sulit dikenali.
        const isi8503 = dipilih.join(", ");
        const isi4020 = `alasan ${dipilih.join(" dan ")}`;
        const gagal = [];
        for (const [kode, nilai] of [["8503", isi8503], ["4020", isi4020]]) {
          const sebelum = (barisVariabel().get(kode) || {}).nilai || "";
          try {
            const hasil = await simpanVariabel(kode, nilai, jatiDiri);
            if (!hasil.ok) {
              gagal.push(`${kode}: ${hasil.pesan}`);
              continue;
            }
            void catatRiwayat({
              perkaraId: jatiDiri.perkaraId,
              kode,
              nama: kode === "8503" ? "Alasan perceraian" : "Penyalur alasan",
              sebelum,
              sesudah: nilai,
              cara: "centangan huruf alasan",
              pada: new Date().toISOString(),
            });
            const item = barisVariabel().get(kode);
            if (item) item.selNilai.textContent = nilai;
          } catch (galat) {
            gagal.push(`${kode}: ${String((galat && galat.message) || galat)}`);
          }
        }
        terap.disabled = false;
        kabarHuruf.className = gagal.length ? "aleta-abt-kabar aleta-abt-gagal" : "aleta-abt-kabar";
        kabarHuruf.textContent = gagal.length
          ? gagal.join("; ")
          : `8503 diisi "${isi8503}", 4020 diisi "${isi4020}".`;
      });
    }

    wadahHuruf.appendChild(kotak);
  }

  panel.appendChild(isi);

  /**
   * NOMOR 10 - riwayat perubahan, dengan tombol urungkan.
   *
   * Digambar ulang tiap kali dibuka, bukan disegarkan terus-menerus: yang
   * membukanya sedang mencari satu perubahan tertentu, bukan menonton daftar.
   */
  const tombolRiwayat = buatElemen("button", "aleta-abt-batal", "Riwayat perubahan");
  tombolRiwayat.type = "button";
  tombolBaris.appendChild(tombolRiwayat);

  /**
   * Dua perapian yang mengubah teks yang SUDAH ada, bukan mengusulkan yang
   * baru. Karena itu keduanya menampilkan pratinjau lebih dulu: yang diubah
   * bukan kolom kosong, melainkan tulisan yang sudah dibaca dan disetujui.
   */
  const tombolRapikan = buatElemen("button", "aleta-abt-batal", "Rapikan posita & saksi");
  tombolRapikan.type = "button";
  tombolRapikan.title =
    "Memisahkan butir posita yang menempel, dan membuang kalimat penutup " +
    "keterangan saksi beserta baris kosong di bawahnya.";
  tombolBaris.appendChild(tombolRapikan);

  tombolRapikan.addEventListener("click", async () => {
    wadahRiwayat.textContent = "";
    const peta = barisVariabel();
    const rencana = [];

    const posita = peta.get(VAR_POSITA);
    if (posita) {
      const asli = posita.selNilai.innerText;
      const rapi = rapikanPosita(asli);
      if (rapi && rapi !== asli.trim()) {
        rencana.push({ kode: VAR_POSITA, nama: "Posita lengkap", sebelum: asli, sesudah: rapi });
      }
    }
    for (const kode of [VAR_SAKSI_1, VAR_SAKSI_2]) {
      const item = peta.get(kode);
      if (!item) continue;
      const asli = item.selNilai.innerText;
      const bersih = bersihkanKeteranganSaksi(asli);
      if (bersih && bersih !== asli.trim()) {
        rencana.push({
          kode,
          nama: `Keterangan saksi ${kode === VAR_SAKSI_1 ? 1 : 2}`,
          sebelum: asli,
          sesudah: bersih,
        });
      }
    }

    if (rencana.length === 0) {
      wadahRiwayat.appendChild(
        buatElemen("div", "aleta-kosong", "Tidak ada yang perlu dirapikan di halaman ini.")
      );
      wadahRiwayat.scrollIntoView({ block: "nearest" });
      return;
    }

    for (const r of rencana) {
      const kartu = buatElemen("div", "aleta-abt-kartu");
      const kepalaKartu = buatElemen("div", "aleta-abt-kartu-kepala");
      kepalaKartu.appendChild(buatElemen("span", "aleta-abt-kode", r.kode));
      kepalaKartu.appendChild(buatElemen("span", "aleta-abt-nama", r.nama));
      kartu.appendChild(kepalaKartu);
      kartu.appendChild(buatElemen("div", "aleta-abt-naskah", "sesudah dirapikan"));
      const pratinjau = buatElemen("pre", "aleta-abt-pratinjau", r.sesudah);
      kartu.appendChild(pratinjau);

      const terap = buatElemen("button", "aleta-permintaan-tombol", "Terapkan");
      terap.type = "button";
      const kabarTerap = buatElemen("div", "aleta-abt-kabar");
      terap.addEventListener("click", async () => {
        terap.disabled = true;
        kabarTerap.textContent = "Menyimpan…";
        try {
          const hasil = await simpanVariabel(r.kode, r.sesudah, jatiDiri);
          if (!hasil.ok) {
            kabarTerap.className = "aleta-abt-kabar aleta-abt-gagal";
            kabarTerap.textContent = hasil.pesan;
            terap.disabled = false;
            return;
          }
          void catatRiwayat({
            perkaraId: jatiDiri.perkaraId,
            kode: r.kode,
            nama: r.nama,
            sebelum: r.sebelum,
            sesudah: r.sesudah,
            cara: "dirapikan",
            pada: new Date().toISOString(),
          });
          const item = barisVariabel().get(r.kode);
          if (item) item.selNilai.textContent = r.sesudah;
          kabarTerap.textContent = "Tersimpan.";
        } catch (galat) {
          kabarTerap.className = "aleta-abt-kabar aleta-abt-gagal";
          kabarTerap.textContent = String((galat && galat.message) || galat);
          terap.disabled = false;
        }
      });
      kartu.appendChild(terap);
      kartu.appendChild(kabarTerap);
      wadahRiwayat.appendChild(kartu);
    }
    wadahRiwayat.scrollIntoView({ block: "nearest" });
  });

  tombolRiwayat.addEventListener("click", async () => {
    if (wadahRiwayat.childElementCount > 0) {
      wadahRiwayat.textContent = "";
      return;
    }
    const daftar = await bacaRiwayat(jatiDiri.perkaraId);
    if (!daftar.length) {
      wadahRiwayat.appendChild(
        buatElemen("div", "aleta-kosong", "Belum ada perubahan yang tercatat untuk perkara ini.")
      );
      wadahRiwayat.scrollIntoView({ block: "nearest" });
      return;
    }
    for (const catatan of daftar.slice(0, 25)) {
      const kartu = buatElemen("div", "aleta-abt-kartu");
      const kepalaKartu = buatElemen("div", "aleta-abt-kartu-kepala");
      kepalaKartu.appendChild(buatElemen("span", "aleta-abt-kode", catatan.kode));
      kepalaKartu.appendChild(buatElemen("span", "aleta-abt-nama", catatan.nama || ""));
      kartu.appendChild(kepalaKartu);
      kartu.appendChild(
        buatElemen(
          "div",
          "aleta-abt-catatan",
          `${catatan.cara} — ${new Date(catatan.pada).toLocaleString("id-ID")}`
        )
      );
      const sanding = buatElemen("div", "aleta-abt-sanding");
      const dulu = buatElemen("div", "aleta-abt-kini");
      dulu.appendChild(buatElemen("span", "aleta-abt-label", "sebelum"));
      dulu.appendChild(buatElemen("span", "aleta-abt-isi", catatan.sebelum || "(kosong)"));
      sanding.appendChild(dulu);
      const kini = buatElemen("div", "aleta-abt-usul");
      kini.appendChild(buatElemen("span", "aleta-abt-label", "sesudah"));
      kini.appendChild(buatElemen("span", "aleta-abt-isi", catatan.sesudah || "(kosong)"));
      sanding.appendChild(kini);
      kartu.appendChild(sanding);

      const urung = buatElemen("button", "aleta-abt-batal", "Kembalikan yang sebelumnya");
      urung.type = "button";
      const kabarUrung = buatElemen("div", "aleta-abt-kabar");
      urung.addEventListener("click", async () => {
        urung.disabled = true;
        kabarUrung.textContent = "Mengembalikan…";
        try {
          const hasil = await simpanVariabel(catatan.kode, catatan.sebelum || "", jatiDiri);
          if (!hasil.ok) {
            kabarUrung.className = "aleta-abt-kabar aleta-abt-gagal";
            kabarUrung.textContent = hasil.pesan;
            urung.disabled = false;
            return;
          }
          const item = barisVariabel().get(catatan.kode);
          if (item) item.selNilai.textContent = catatan.sebelum || "DATA_TIDAK_ADA";
          // Pengembalian ikut dicatat. Riwayat yang menghapus jejaknya sendiri
          // saat diurungkan membuat urutan kejadiannya mustahil dibaca ulang.
          void catatRiwayat({
            perkaraId: jatiDiri.perkaraId,
            kode: catatan.kode,
            nama: catatan.nama,
            sebelum: catatan.sesudah,
            sesudah: catatan.sebelum,
            cara: "dikembalikan",
            pada: new Date().toISOString(),
          });
          kabarUrung.textContent = "Sudah dikembalikan.";
        } catch (galat) {
          kabarUrung.className = "aleta-abt-kabar aleta-abt-gagal";
          kabarUrung.textContent = String((galat && galat.message) || galat);
          urung.disabled = false;
        }
      });
      kartu.appendChild(urung);
      kartu.appendChild(kabarUrung);
      wadahRiwayat.appendChild(kartu);
    }
    wadahRiwayat.appendChild(
      buatElemen(
        "div",
        "aleta-abt-catatan",
        "Riwayat ini tersimpan di peramban ini saja, dan hilang bila data situs dibersihkan."
      )
    );
    // Digulung ke pandangan. Tanpa ini, panel yang sedang tergulung ke bawah
    // menggambar daftarnya di luar layar - dan itulah sebab tombolnya dulu
    // tampak tidak berbuat apa-apa.
    wadahRiwayat.scrollIntoView({ block: "nearest" });
  });

  const kaki = buatElemen("div", "aleta-kaki");
  kaki.appendChild(
    buatElemen("span", "aleta-kaki-teks", "Usulan dari ALETA. Disimpan lewat tombol simpan ABT sendiri.")
  );
  panel.appendChild(kaki);

  /** Menggambar daftar usulan beserta tombol penerapnya. */
  function gambarUsulan(daftar) {
    wadahUsulan.textContent = "";
    const pilih = [];
    const peta = barisVariabel();

    let adaYangBisa = false;
    for (const u of daftar) {
      const item = peta.get(u.kode);
      if (!item) continue; // variabel itu tidak ada di blangko yang dibuka
      adaYangBisa = true;
      wadahUsulan.appendChild(kartuUsulan(u, item.nilai, pilih));
    }

    if (!adaYangBisa) {
      wadahUsulan.appendChild(
        buatElemen("div", "aleta-kosong", "Tidak satu pun variabel itu ada di blangko yang sedang dibuka.")
      );
      return;
    }

    const terap = buatElemen("button", "aleta-permintaan-tombol", "Terapkan yang dicentang");
    terap.type = "button";
    const hasilTerap = buatElemen("div", "aleta-abt-kabar");
    wadahUsulan.appendChild(terap);
    wadahUsulan.appendChild(hasilTerap);

    terap.addEventListener("click", async () => {
      const dipilih = pilih.filter((x) => x.centang.checked && x.usulan.nilai);
      if (dipilih.length === 0) {
        hasilTerap.textContent = "Tidak ada yang dicentang.";
        return;
      }
      terap.disabled = true;
      let berhasil = 0;
      const gagal = [];
      for (const x of dipilih) {
        hasilTerap.textContent = `Menyimpan ${x.usulan.kode}…`;
        try {
          const sebelum = (barisVariabel().get(x.usulan.kode) || {}).nilai || "";
          const hasil = await simpanVariabel(x.usulan.kode, x.usulan.nilai, jatiDiri);
          if (hasil.ok) {
            berhasil += 1;
            void catatRiwayat({
              perkaraId: jatiDiri.perkaraId,
              kode: x.usulan.kode,
              nama: x.usulan.nama,
              sebelum,
              sesudah: x.usulan.nilai,
              cara: x.usulan.sumber && x.usulan.sumber[0] && x.usulan.sumber[0].saksi
                ? `usulan dari keterangan saksi (${x.usulan.keyakinan})`
                : `usulan dari SIPP (${x.usulan.keyakinan})`,
              pada: new Date().toISOString(),
            });
            const item = barisVariabel().get(x.usulan.kode);
            if (item) item.selNilai.textContent = x.usulan.nilai;
            x.centang.checked = false;
            x.centang.disabled = true;
          } else {
            gagal.push(`${x.usulan.kode}: ${hasil.pesan}`);
          }
        } catch (galat) {
          gagal.push(`${x.usulan.kode}: ${String((galat && galat.message) || galat)}`);
        }
      }
      terap.disabled = false;
      hasilTerap.className = gagal.length ? "aleta-abt-kabar aleta-abt-gagal" : "aleta-abt-kabar";
      hasilTerap.textContent = gagal.length
        ? `${berhasil} tersimpan, ${gagal.length} gagal — ${gagal.join("; ")}`
        : `${berhasil} variabel tersimpan. Muat ulang halaman bila variabel otomatis belum ikut berubah.`;
    });
  }

  tombolSipp.addEventListener("click", async () => {
    tombolSipp.disabled = true;
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = "Membaca SIPP…";
    try {
      const isiJawaban = await mintaUsulan({ nomorPerkara: nomorPerkaraAbt(), sumber: "sipp" });
      const sipp = isiJawaban.sipp || {};
      if (sipp.ok === false) throw new Error(sipp.alasan || "SIPP tidak menjawab.");
      kabar.textContent =
        `Kuasa aktif: ${sipp.jumlahKuasa || 0}. Prodeo: ${sipp.prodeo ? "ya" : "tidak"}. ` +
        "Tiga variabel prodeo dan fasakh memang tidak disimpan SIPP - disebut apa adanya di bawah.";
      gambarSelisih([]);
      gambarHuruf([], []);
      gambarUsulan(sipp.usulan || []);
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
    } finally {
      tombolSipp.disabled = false;
    }
  });

  tombolSaksi.addEventListener("click", async () => {
    tombolSaksi.disabled = true;
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = "Membaca keterangan saksi…";
    try {
      const peta = barisVariabel();
      const teks1 = peta.get(VAR_SAKSI_1) ? peta.get(VAR_SAKSI_1).selNilai.innerText : "";
      const teks2 = peta.get(VAR_SAKSI_2) ? peta.get(VAR_SAKSI_2).selNilai.innerText : "";
      if (!teks1.trim() && !teks2.trim()) {
        throw new Error("Variabel 2021 dan 2022 masih kosong di halaman ini.");
      }
      const isiJawaban = await mintaUsulan({
        nomorPerkara: nomorPerkaraAbt(),
        sumber: "saksi",
        saksi1: teks1,
        saksi2: teks2,
        // Dibaca dari halaman ini juga. Dipakai menghitung ulang lama pisah:
        // "kira-kira 4 bulan" benar pada hari saksi diperiksa, dan mulai
        // keliru pada sidang berikutnya.
        tanggalSidang: nilaiVariabel(VAR_TGL_SIDANG),
        pelaku: nilaiVariabel(VAR_PIHAK_PELAKU),
        lawan: nilaiVariabel(VAR_PIHAK_LAWAN),
      });
      const saksi = isiJawaban.saksi || {};
      kabar.textContent =
        `Terbaca ${saksi.butir?.saksi1 || 0} butir dari saksi 1 dan ${saksi.butir?.saksi2 || 0} dari saksi 2.`;
      gambarSelisih(saksi.selisih || []);
      gambarHuruf(saksi.huruf || [], saksi.hurufBelumSiap || []);
      gambarUsulan(saksi.usulan || []);
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
    } finally {
      tombolSaksi.disabled = false;
    }
  });


  // Pelapor keadaan dipinjamkan ke penjaga cetak: penerbitan tiga berkas
  // memakan beberapa detik, dan tanpa satu baris yang mengabarkan tahapnya,
  // yang menekan CETAK hanya melihat halaman yang tidak berbuat apa-apa.
  panel.lapor = (teks, gagal) => {
    kabar.className = gagal ? "aleta-abt-kabar aleta-abt-gagal" : "aleta-abt-kabar";
    kabar.textContent = teks;
  };
  return panel;
}

// ─── Pemasangan ──────────────────────────────────────────────────────────────

async function sedangAktif() {
  try {
    const simpan = await chrome.storage.local.get(["aktif"]);
    return simpan.aktif !== false;
  } catch {
    return true;
  }
}

let sudahDipasang = false;

async function pasang() {
  if (sudahDipasang) return;
  if (!halamanBlangko()) return;
  if (!(await sedangAktif())) return;

  const jatiDiri = jatiDiriPerkara();
  if (!jatiDiri) return;

  sudahDipasang = true;
  await muatSaklarCetak();
  pasangSunting(jatiDiri);
  const panel = susunPanelAbt(jatiDiri);
  document.body.appendChild(panel);
  pasangPenjagaCetak(jatiDiri, panel.lapor);
}

void pasang();

// ABT memuat sebagian isinya menyusul. Diperiksa beberapa kali, lalu berhenti -
// pengamat yang hidup selamanya pada halaman yang tidak pernah berubah hanya
// menambah kerja tanpa menambah apa pun.
let percobaan = 0;
const jeda = setInterval(() => {
  percobaan += 1;
  void pasang();
  if (sudahDipasang || percobaan > 10) clearInterval(jeda);
}, 700);
