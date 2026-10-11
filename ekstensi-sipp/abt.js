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

/**
 * ============================================================================
 * TOMBOL "INPUT KE ABT" HANYA PADA BLANGKO YANG MEMUAT VARIABEL CERAI
 * ============================================================================
 *
 * Tombol itu menurunkan tujuh variabel dari keterangan saksi, dan ketujuhnya
 * variabel blangko cerai: sejak kapan tidak rukun (0222), sejak kapan pisah
 * (0246), lama pisah (9944), yang meninggalkan (7035), upaya damai (1268),
 * alasan (5227), dan huruf alasan (8503).
 *
 * Dahulu ia tergambar di SETIAP blangko - termasuk dispensasi kawin dan itsbat
 * nikah, yang tidak memuat satu pun dari ketujuhnya. Menekannya di sana
 * menarik keterangan saksi ke bot lalu menjawab "tidak satu pun variabel itu
 * ada di blangko yang sedang dibuka": satu tombol yang menyerupai pekerjaan
 * dan tidak mengerjakan apa pun.
 *
 * Yang menentukan variabel yang SUNGGUH tergambar di halaman (barisVariabel),
 * bukan nama blangkonya - nama blangko berubah menurut satker, variabelnya
 * tidak.
 */
const VARIABEL_CERAI_SAKSI = ["0222", "0246", "9944", "7035", "1268", "5227", "8503"];

/** Blangko yang dibuka memuat sekurang-kurangnya satu variabel cerai? */
function blangkoMemuatVariabelCerai(petaVariabel) {
  if (!petaVariabel || typeof petaVariabel.has !== "function") return false;
  return VARIABEL_CERAI_SAKSI.some((kode) => petaVariabel.has(kode));
}

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
/**
 * "Jenis Perkara" menurut SIPP - perkara.jenis_perkara_nama.
 *
 * Berisi kalimat yang sungguh menerangkan: "Cerai Gugat", "Dispensasi Kawin",
 * "Pengesahan Perkawinan/Istbat Nikah". Bandingkan dengan alur pada nomor
 * perkara, yang hanya memisahkan gugatan dari permohonan.
 */
const VAR_JENIS_PERKARA = "0048";

const VAR_PIHAK_LAWAN = "0046";
const VAR_PIHAK_PELAKU = "0047";

/**
 * ============================================================================
 * 8503 DAN 4020 - SATU DIISI, SATU MENGIKUTI SENDIRI
 * ============================================================================
 *
 * Dibaca dari definisi variabelnya di basis data ABT, bukan ditebak:
 *
 *   8503  data_type = data_teks   -> tersimpan di ABT, dapat disunting
 *   4020  data_type = data_sql    -> DIHITUNG dari kuerinya sendiri
 *
 * Kueri 4020 itu satu CASE panjang atas '#8503#'. Ia tidak menyimpan apa pun;
 * ia membaca 8503 lalu mengembalikan kalimat penyalurnya. Karena itu menulis
 * 4020 mustahil - rute edit_data hanya menerima data_teks dan data_tanggal -
 * dan sekaligus tidak perlu: begitu 8503 terisi, 4020 mengikuti.
 *
 * ============================================================================
 * BENTUK YANG DIKENALI KUERINYA - DISALIN APA ADANYA DARI ABT
 * ============================================================================
 *
 * Tiap cabang kuerinya berupa REGEXP berjangkar. Yang diterima:
 *
 *   A, B, F, H     satu huruf                      ^[Aa]$ ^[Bb]$ ^[Ff]$
 *                  H juga menerima Fasakh / Murtad
 *   AB  BA         dua huruf, urutan bebas         ^(AB|BA|A DAN B|A & B)$
 *   AF  FA
 *   BF  FB
 *   ABF            tiga huruf, SELURUH permutasinya
 *
 * Perhatikan yang TIDAK ada di sana: tidak satu pun cabang menerima H
 * bergabung dengan huruf lain, dan tidak ada ABFH. Gabungan seperti itu jatuh
 * ke cabang ELSE, dan ELSE-nya berbunyi "TIDAK BENAR QUERY NYA / BELUM ISI
 * ALASAN DI KOLOM ABT" - kalimat yang ikut tercetak ke dalam putusan.
 *
 * Karena itu ALETA menyebutkan keadaan itu saat menulis, bukan sesudah
 * putusannya tercetak. Kuerinya sendiri milik ABT dan tidak disentuh.
 *
 * ============================================================================
 * TANPA KOMA DAN TANPA SPASI
 * ============================================================================
 *
 * Dulu ALETA menulis "A, F". Tidak satu pun cabang kuerinya menerima bentuk
 * itu - regexpnya berjangkar, dan "A, F" bukan "AF" maupun "A DAN F".
 * Akibatnya 8503 tampak benar di layar sementara 4020 diam-diam jatuh ke
 * ELSE. Sekarang hurufnya dirapatkan: "AF".
 */
const VAR_HURUF = "8503";

/** Urutan kanonik. Kuerinya menerima urutan bebas; keseragaman untuk manusia. */
const URUTAN_HURUF = ["A", "B", "C", "D", "E", "F", "G", "H"];

/** Huruf yang punya cabang di kueri blangko LAMA (sebelum paket abt-alasan-cdeh). */
const HURUF_LAMA = ["A", "B", "F", "H"];

/** Gabungan yang benar-benar punya cabang di kueri 4020 LAMA. */
const GABUNGAN_4020 = new Set(["A", "B", "F", "H", "AB", "AF", "BF", "ABF"]);

/**
 * ============================================================================
 * PAKET ABT "abt-alasan-cdeh" (6 Okt 2026) - DIBACA DARI HALAMAN, BUKAN DITEBAK
 * ============================================================================
 *
 * Paket itu memberi 4020, 8521, 8522, 8528, dan 8530 cabang umum yang menerima
 * SETIAP huruf A-H dan gabungannya (C, D, E, H dengan pertimbangan yuridis
 * utuh), dan sekaligus mengganti NAMA variabel 8503 menjadi "... GABUNGAN
 * BEBAS ...". Nama itulah penandanya: ia tampil di tabel variabel halaman ABT
 * yang sama, sehingga ekstensi tahu blangko satker mana yang sedang dihadapi
 * tanpa menebak - satker yang belum dipasangi paket tetap diperlakukan dengan
 * daftar lama di atas.
 */
function abtKenalSemuaHuruf() {
  const item = barisVariabel().get(VAR_HURUF);
  return Boolean(item) && /GABUNGAN BEBAS/i.test(item.nama);
}

function susun8503(daftar) {
  const bersih = Array.from(new Set(daftar.map((x) => String(x || "").trim().toUpperCase())));
  bersih.sort((a, b) => URUTAN_HURUF.indexOf(a) - URUTAN_HURUF.indexOf(b));
  return bersih.join("");
}

function dikenali4020(daftar) {
  const isi = susun8503(daftar);
  if (abtKenalSemuaHuruf()) return /^[A-H]+$/.test(isi);
  return GABUNGAN_4020.has(isi);
}

/**
 * ============================================================================
 * TURUNAN 8503 - SATU KESATUAN (7 Okt 2026)
 * ============================================================================
 *
 * Variabel yang kalimatnya disusun kueri ABT dari huruf alasan 8503 (data_sql
 * - dihitung, bukan disimpan). Selama 8503 kosong atau bentuknya tidak
 * dikenali, SEMUANYA berbunyi "TIDAK BENAR QUERY NYA ..." - satu sebab, bukan
 * sembilan kerusakan. Daftar ini disebut pengguna (tangkapan 30, 7 Okt):
 * 8531 dan 8532 (paket abt-alasan-cdeh) serta 8524 dulu tidak ikut, sehingga
 * panel menyebut keduanya "2 variabel berbunyi pesan error" seolah kerusakan
 * sendiri. Urutan di sini tidak berarti apa-apa - tampilan mengikuti urutan
 * baris di halaman.
 */
const TURUNAN_8503 = Object.freeze(["4020", "8524", "8531", "8532", "8529", "8528", "8521", "8522", "8530"]);

/**
 * Variabel "(OTOMATIS)" yang isinya disusun ABT dari kerangka fakta.
 *
 * Selama kerangkanya kosong, keempatnya berbunyi "TIDAK BENAR QUERY NYA" - dan
 * kalimat itu ikut tercetak ke dalam putusan bila tidak ada yang menahannya.
 */
const VAR_OTOMATIS = [
  "8521",
  "8522",
  "8528",
  "8530",
  // ==========================================================================
  // 4020 IKUT DI SINI, DAN BUKAN DI VARIABEL_SASARAN SAJA
  // ==========================================================================
  //
  // Ia data_sql - sama sifatnya dengan keempat di atas: dihitung, bukan
  // disimpan. Bila 8503 kosong atau gabungannya tidak dikenali, ELSE-nya
  // berbunyi "TIDAK BENAR QUERY NYA / BELUM ISI ALASAN DI KOLOM ABT".
  //
  // Dulu ia dimasukkan ke sini sebagai TAMBALAN: ISI_KOSONG berjangkar di
  // kedua ujung, sehingga kalimat galat yang panjang tidak cocok dengannya
  // dan 4020 yang rusak lolos tanpa peringatan. Tambalan itu bekerja untuk
  // 4020 dan tidak untuk variabel turunan lain.
  //
  // Lubangnya kini ditutup di akarnya - lihat keadaanNilai, yang mencari
  // FRASA tanpa jangkar. 4020 tetap di daftar ini, tetapi sekarang karena
  // sifatnya: ia dihitung, bukan disimpan, sama seperti keempat di atas.
  "4020",
];

/**
 * ============================================================================
 * KEADAAN SATU NILAI VARIABEL - SATU ATURAN, TIGA JAWABAN
 * ============================================================================
 *
 * Sebelumnya ada DUA pemeriksaan yang berbeda bentuk untuk pertanyaan yang
 * hampir sama:
 *
 *   ISI_KOSONG   /^(DATA_TIDAK_ADA|TIDAK BENAR QUERY NYA|BELUM ISI|-)?$/i
 *   dan satu regex tanpa jangkar khusus untuk VAR_OTOMATIS
 *
 * Yang pertama BERJANGKAR di kedua ujung. Akibatnya kalimat galat yang panjang
 * tidak pernah cocok dengannya - dan bunyi galat ABT memang panjang:
 *
 *   "TIDAK BENAR QUERY NYA / BELUM ISI ALASAN DI KOLOM ABT"
 *
 * Kalimat itu lolos dari pemeriksaan kekurangan tanpa satu pun peringatan, dan
 * ia IKUT TERCETAK sebagai pertimbangan hukum. Lubangnya ditutup untuk 4020
 * dengan memasukkannya ke daftar VAR_OTOMATIS - tetapi itu tambalan per
 * variabel: variabel turunan lain yang bunyinya sedikit berbeda tetap lolos.
 *
 * Sekarang satu fungsi, dan jawabannya tiga - sebab ketiganya menuntut
 * perlakuan yang berbeda:
 *
 *   "kosong"   belum ada isinya. Wajar pada variabel yang memang tidak
 *              berlaku bagi perkara ini, dan itu sebabnya ia hanya DITANYAKAN,
 *              bukan ditahan.
 *   "galat"    bunyi pesan mesin. Ini yang paling berbahaya dari ketiganya:
 *              ia tampak seperti keterangan, tercetak seperti keterangan, dan
 *              dibaca orang sebagai pertimbangan hukum.
 *   "terisi"   ada isinya.
 *
 * ============================================================================
 * DAFTARNYA DISALIN DARI ABT, BUKAN DIKARANG
 * ============================================================================
 *
 * Tiap bunyi di bawah punya asalnya di kode ABT:
 *
 *   DATA_TIDAK_ADA      Abt_model::data_variabel_detil, ketika data kosong
 *                       atau data_type-nya tidak dikenali
 *   TIDAK_BISA_LOAD     ketika identitas saksi tidak dapat diselesaikan
 *   "..."               cleanHtmlTagSpecial menerjemahkan keduanya menjadi
 *                       titik tiga saat mencetak; di layar ia dapat muncul
 *                       bila variabelnya menyalurkan variabel lain
 *   "0"                 nilai bawaan yang tidak pernah diisi - 6.207 baris
 *                       alasan_ditunda di SIPP berisi ini belaka
 *   "-"                 value_type placeholder
 *
 *   TIDAK BENAR QUERY NYA   cabang ELSE kueri data_sql - 4020 dan sejenisnya
 *   BELUM ISI ALASAN        bagian kedua dari kalimat yang sama
 *
 * Yang dicari FRASA-nya, tidak berjangkar, sehingga kalimat sepanjang apa pun
 * yang memuatnya tetap tertangkap. Frasanya sendiri dipilih cukup panjang
 * supaya tidak menangkap tulisan biasa: "BELUM ISI" saja terlalu pendek dan
 * dapat muncul di dalam keterangan yang sah, sedangkan "BELUM ISI ALASAN"
 * hanya ada di pesan mesin.
 *
 * Bila ABT kelak mengeluarkan bunyi galat yang lain, ia ditambahkan DI SINI -
 * satu tempat - bukan dengan memasukkan nomor variabelnya ke daftar lain.
 */

/** Bunyi yang berarti "belum ada isinya", menurut ABT sendiri. */
const NILAI_KOSONG = new Set(["", "-", "0", "...", "DATA_TIDAK_ADA", "TIDAK_BISA_LOAD"]);

/** Frasa yang berarti "ini pesan mesin", dicari tanpa jangkar. */
const FRASA_GALAT = [/TIDAK BENAR QUERY NYA/i, /BELUM ISI ALASAN/i];

/**
 * @param {string} nilai isi sel variabel apa adanya
 * @returns {"kosong" | "galat" | "terisi"}
 */
function keadaanNilai(nilai) {
  const teks = String(nilai || "").replace(/\s+/g, " ").trim();

  // Galat diperiksa LEBIH DULU. Kalimat galat tidak kosong, jadi urutan yang
  // dibalik akan menggolongkannya "terisi" - dan yang terisi tidak pernah
  // ditanyakan kepada siapa pun.
  if (FRASA_GALAT.some((pola) => pola.test(teks))) return "galat";
  if (NILAI_KOSONG.has(teks.toUpperCase())) return "kosong";
  return "terisi";
}

const ALETA_API_ABT = "/aleta/api/aleta-bot/abt/usulan";
const ALETA_API_POSITA = "/aleta/api/aleta-bot/sipp/posita";

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
function barisVariabel(akar) {
  const hasil = new Map();
  // `akar` (7 Okt): halaman blangko yang dibaca ulang lewat DOMParser - lihat
  // t6BacaUlangTurunan. Tanpa argumen: halaman yang sedang terbuka.
  for (const baris of Array.from((akar || document).querySelectorAll("tr"))) {
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

/**
 * ============================================================================
 * PENYUNTING TANYA-JAWAB SAKSI - HALAMAN TEMPAT PEKERJAANNYA SUNGGUH TERJADI
 * ============================================================================
 *
 * Penyusun keterangan dua saksi sudah ada sejak lama, tetapi HANYA di halaman
 * daftar variabel blangko. Yang mengisi keterangan saksi tidak duduk di sana -
 * ia duduk di abt/tanyajawab_perkara_edit, halaman yang barisnya
 * pertanyaan-jawaban satu per satu, dan di halaman itu ALETA tidak muncul
 * sama sekali.
 *
 * Akibatnya persis seperti yang dilaporkan: "belum ada deteksi otomisasi
 * mengisi keterangan saksi". Kemampuannya ada, tempatnya yang salah - dan
 * kemampuan yang tidak berada di tempat orang mengerjakannya sama saja dengan
 * kemampuan yang tidak ada.
 *
 * Dikenali dari DUA hal sekaligus, bukan dari alamatnya saja: alamat dapat
 * berubah, sedangkan borang tanya-jawab beserta tabel barisnya tidak.
 */
function halamanTanyaJawab() {
  if (!/tanyajawab_perkara_edit/i.test(location.pathname + location.search)) return false;
  return Boolean(document.querySelector(".tbl_user_data, .add_tanyajawab, .row_data"));
}

/**
 * Saksi keberapa yang sedang disunting - dari judul halamannya.
 *
 * "419/Pdt.G/2026/PA.Dgl - TanyaJwb Saksi 1 P : Klinem binti Sarbini"
 *
 * Dipakai hanya untuk menyebutkannya kepada petugas. Yang menentukan variabel
 * mana yang ditulis tetap alamat halamannya sendiri, sebab itulah yang dipakai
 * rute simpan ABT.
 */
function saksiKeberapa() {
  const teks = `${document.title} ${document.body ? document.body.innerText.slice(0, 400) : ""}`;
  const cocok = teks.match(/TanyaJwb\s+Saksi\s+(\d)/i);
  return cocok ? Number(cocok[1]) : 0;
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
  if (!cocok) {
    // Uji 9 Okt: dulu "" ikut diingat. Sesi ABT habis (halaman masuk) membuat
    // variabel itu "bertipe tidak dikenal" sampai halaman dimuat ulang -
    // walau petugas sudah masuk lagi. Yang tidak terbaca tidak diingat.
    const sebab = a3SebabBukanAbt(teks);
    if (sebab) throw new Error(sebab);
    return "";
  }
  const tipe = cocok[1];
  tipeVariabel.set(kode, tipe);
  return tipe;
}

/**
 * Sebab jawaban ABT yang BUKAN yang diminta (uji 9 Okt) - "" bila tidak dikenali.
 *
 *  - Abt_model::get_data_variabel menjalankan die("<h3>ERROR Variabel #x#</h3>")
 *    bila satu kueri data_sql patah: seluruh halaman/pratinjau CETAK berhenti.
 *  - Abt::__construct mengalihkan ke halaman masuk bila sesinya habis - jawaban
 *    200 berisi borang sandi, bukan RTF/"DATA DISIMPAN".
 */
function a3SebabBukanAbt(teks) {
  const t = String(teks || "").slice(0, 6000);
  const galat = t.match(/ERROR\s+Variabel\s*#(\d{3,5})#/i);
  if (galat) {
    return (
      `ABT berhenti menghitung variabel #${galat[1]}# - kuerinya patah, biasanya karena petik (' atau ") ` +
      `atau garis miring terbalik pada isian yang dirujuknya. Perbaiki isian itu di ABT lalu ulangi.`
    );
  }
  if (/type=["']?password|name=["']?password/i.test(t)) return "sesi ABT habis - masuk ulang ke ABT, lalu ulangi.";
  return "";
}

/** Tipe yang benar-benar dapat disimpan lewat rute itu. */
function dapatDisimpan(tipe) {
  return tipe === "data_teks" || tipe === "data_tanggal";
}

/**
 * ============================================================================
 * 1.184.0 (5 Okt, butir 1 & 16): TIPE SELURUH VARIABEL HALAMAN SEKALI JALAN
 * ============================================================================
 *
 * Panel "Isi dari SIPP & input ke ABT" (hakim) dan "... (BAS)" (panitera)
 * sampai 1.183.0 mengusulkan variabel tanpa melihat data_type-nya: Tgl Sidang
 * (multi_sidang), Majelis Hakim (data_sql), Ketua Majelis (data_sql) tampil
 * tercentang padahal ABT menghitungnya sendiri - dan baru gagal saat Input,
 * sesudah satu GET edit_data per variabel. Yang memang diisi tangan di ABT
 * hanya data_teks dan data_tanggal.
 *
 * Kini tipenya dibaca SEKALI untuk seluruh halaman lewat rute kamus portal
 * (jembatan bot -> aps_badilag.abt_variabel), mengisi tipeVariabel yang sama
 * dengan tipeData: daftar usulan tersaring sejak awal, dan Input tidak lagi
 * menanyakan tipe per variabel. Gagal = tipe BELUM diketahui; perilaku lama
 * berlaku (tipeData menanyakannya saat menyimpan).
 */
const ALETA_API_KAMUS = "/aleta/api/aleta-ecourt/kamus";
let tipeHalamanJanji = null;

function muatTipeHalaman() {
  const kode = [...barisVariabel().keys()].filter((x) => !tipeVariabel.has(x));
  if (!kode.length) return Promise.resolve(true);
  if (tipeHalamanJanji) return tipeHalamanJanji;
  tipeHalamanJanji = (async () => {
    let ada = false;
    for (let i = 0; i < kode.length; i += 250) {
      try {
        const alamat = `${ALETA_API_KAMUS}?jenis=${encodeURIComponent(kode.slice(i, i + 250).join(","))}`;
        const respons = await fetch(alamat, { credentials: "include", cache: "no-store" });
        if (!respons.ok) continue;
        const luar = await respons.json();
        const isi = luar && luar.data ? luar.data : luar;
        for (const [k, t] of Object.entries((isi && isi.jenis) || {})) {
          tipeVariabel.set(String(k), String(t || ""));
          ada = true;
        }
      } catch {
        /* tipe belum diketahui - ditanyakan saat menyimpan */
      }
    }
    return ada;
  })().finally(() => {
    tipeHalamanJanji = null;
  });
  return tipeHalamanJanji;
}

/** true = diisi tangan (data_teks/data_tanggal); false = dihitung ABT; null = belum diketahui. */
function a3BolehDiisi(kode) {
  const k = String(kode || "");
  if (!tipeVariabel.has(k)) return null;
  return dapatDisimpan(tipeVariabel.get(k));
}

const A3_BULAN = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];

/**
 * Tanggal untuk variabel data_tanggal ABT: "d/m/Y". Controller edit_data
 * menjalankan tgl_sql() = DateTime::createFromFormat('d/m/Y', ...) - bentuk
 * lain ("2026-10-15", "15 Oktober 2026") tersimpan RUSAK tanpa satu pesan
 * pun. "" bila tidak terbaca (pemanggil menolak menyimpan).
 */
function a3TanggalAbt(nilai) {
  const t = String(nilai || "").trim();
  const dua = (n) => String(n).padStart(2, "0");
  const sah = (h, b, y) => {
    const d = new Date(Number(y), Number(b) - 1, Number(h));
    return d.getFullYear() === Number(y) && d.getMonth() === Number(b) - 1 && d.getDate() === Number(h) ? `${dua(h)}/${dua(b)}/${y}` : "";
  };
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (m) return sah(m[3], m[2], m[1]);
  m = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (m) return sah(m[1], m[2], m[3]);
  m = t.replace(/^[A-Za-z']+,\s*/, "").match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const b = A3_BULAN.findIndex((x) => x.startsWith(m[2].toLowerCase().slice(0, 3)));
    if (b >= 0) return sah(m[1], b + 1, m[3]);
  }
  return "";
}

/**
 * ============================================================================
 * PETIK DAN GARIS MIRING TERBALIK DINETRALKAN SEBELUM MASUK ABT (uji 9 Okt)
 * ============================================================================
 *
 * Abt_model::variabel_var_data mengganti #xxxx# di kueri data_sql dengan isi
 * variabel APA ADANYA (str_replace, tanpa escape). 5227/0222/0246/9944/7035/
 * 1268 masuk literal ber-petik ganda di 8521/8528/8522, dan 8503/9944/0246/
 * 5227/1214 masuk literal ber-petik tunggal di 4020/8522/8529/8530 dst. Satu
 * petik di isian mematahkan kuerinya, dan get_data_variabel lalu menjalankan
 * die("ERROR Variabel #xxxx#") - SELURUH halaman blangko dan pratinjau CETAK
 * perkara itu berhenti, bukan satu variabel saja.
 *
 * Diukur baca-saja di satker (MariaDB 5.5.68, 9 Okt 2026): isian berpetik
 * ganda -> 8521/8522/8528 ER_PARSE_ERROR; berpetik tunggal -> 8522/8529;
 * berakhiran "\" -> 8521/8522/8528. Sesudah dinetralkan: 0 galat. 37 jawaban
 * saksi satker memuat petik ganda dan 89 petik tunggal - bahan usulan 5227.
 *
 * Petik diganti U+2019 (’): TemplateHelper::cleanHtmlTagSpecial ABT sendiri
 * mengubah ’ kembali menjadi ' saat mencetak, jadi cetakannya tetap berpetik.
 * Garis miring terbalik diganti "/". Hanya data_teks - data_tanggal disusun
 * ulang menjadi d/m/Y di bawah.
 */
function a3NetralkanPetik(nilai) {
  return String(nilai == null ? "" : nilai)
    .replace(/\\/g, "/")
    .replace(/["']/g, "’");
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
  // 1.184.0: data_tanggal harus "d/m/Y" (tgl_sql ABT) - selain itu tersimpan rusak.
  let nilaiKirim = nilai;
  if (tipe === "data_tanggal") {
    nilaiKirim = a3TanggalAbt(nilai);
    if (!nilaiKirim) {
      return { ok: false, pesan: `Variabel ${kode} bertipe tanggal - "${nilai}" tidak terbaca sebagai tanggal (contoh 15/10/2026).` };
    }
  } else {
    // Uji 9 Okt: petik/garis miring terbalik mentah mematahkan kueri data_sql
    // yang merujuk variabel ini - lihat a3NetralkanPetik.
    nilaiKirim = a3NetralkanPetik(nilai);
  }

  const badan = new URLSearchParams();
  badan.set("aksi", "Simpan");
  badan.set("value", nilaiKirim);
  badan.set("var_type", tipe);

  // Perbaikan 2 Okt butir 14 (global): jeda seperti manusia sebelum menulis.
  await a2JedaTulis("simpan", alamat);
  const respons = await fetch(alamat, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: badan.toString(),
  });
  if (!respons.ok) return { ok: false, pesan: `ABT menjawab ${respons.status}.` };

  const teks = await respons.text();
  if (/DATA DISIMPAN/i.test(teks)) {
    // Perbaikan 1 Okt butir 10 (UI Baru saja): perkara ini sudah diinput.
    a1CatatInput(jatiDiri);
    // nilaiTersimpan: yang SUNGGUH dikirim (petik dinetralkan / tanggal d/m/Y),
    // supaya layar dan riwayat menyebut isi yang ada di ABT.
    return {
      ok: true,
      pesan:
        tipe !== "data_tanggal" && nilaiKirim !== String(nilai == null ? "" : nilai)
          ? "tersimpan (petik diganti ’ agar kueri ABT tidak patah)"
          : "tersimpan",
      nilaiTersimpan: tipe === "data_tanggal" ? nilai : nilaiKirim,
    };
  }
  if (/DATA TIDAK TERSIMPAN/i.test(teks)) return { ok: false, pesan: "ABT menolak menyimpan." };
  const sebab = a3SebabBukanAbt(teks);
  if (sebab) return { ok: false, pesan: `Belum tersimpan - ${sebab}` };
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
// rapikanPosita DIPINDAHKAN ke aleta_bot/services/sippPositaService.js.
//
// Sebabnya bukan kerapian: yang dirapikan harus teks yang BENAR-BENAR akan
// tersimpan, dan teks itu ada di kolom posita SIPP - bukan innerText sel
// tabel yang tergambar di sini. Dua salinan aturan yang bekerja atas dua teks
// berbeda menghasilkan pratinjau yang tidak pernah cocok dengan hasilnya.
//
// Pratinjaunya kini diminta ke server lewat uji kering - lihat mintaPositaRapi.

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
  // ==========================================================================
  // BENTUK TANPA "BAHWA" - DIPERLUKAN SEJAK PEMBERSIHAN MENYENTUH BASIS DATA
  // ==========================================================================
  //
  // Yang tergambar di halaman selalu berawalan "Bahwa": list_keterangan di
  // ABT menyusunnya sebagai "-   Bahwa " + lcfirst(jawaban). Selama
  // pembersihan hanya menyentuh teks yang tergambar, ketiga pola di atas
  // cukup.
  //
  // Sejak keterangan saksi benar-benar disimpan kembali ke
  // abt_keterangan_saksi, yang dibersihkan adalah kolom jawaban APA ADANYA -
  // dan di sana kata "Bahwa" tidak ada. "Sudah cukup" tertangkap pola ketiga;
  // "tidak sanggup lagi" tidak tertangkap satu pun, dan akan lolos diam-diam.
  /^tidak\s+sanggup\s+lagi\b/i,
  // ==========================================================================
  // DENGAN "SUDAH" DI TENGAHNYA - BENTUK YANG PALING SERING DIPAKAI
  // ==========================================================================
  //
  // "Bahwa sudah tidak sanggup lagi" tidak tertangkap satu pun pola di atas:
  // yang berawalan "bahwa" menuntut "tidak" tepat sesudahnya, dan yang
  // berawalan "tidak" menuntut kalimatnya dimulai dari situ. Kata "sudah" di
  // tengah membuat keduanya meleset.
  //
  // Lolosnya tidak berbunyi - kalimatnya hanya tetap berdiri di dalam putusan,
  // di antara keterangan saksi yang lain, seolah ia fakta yang dibuktikan.
  /^bahwa\s+sudah\s+tidak\s+sanggup\s+lagi\b/i,
  /^sudah\s+tidak\s+sanggup\s+lagi\b/i,
];

/**
 * Uji 9 Okt (data satker, 4.251 jawaban penutup): 2 jawaban berbunyi
 * "Sudah\ncukup;" - penutupnya terbelah baris sehingga tidak satu baris pun
 * cocok POLA_PENUTUP dan ia lolos. Jawaban yang SELURUHNYA hanya kalimat
 * penutup (spasi/baris dirapatkan) dibuang utuh; yang memuat kata lain tetap
 * diperiksa per baris seperti sebelumnya.
 */
const POLA_PENUTUP_UTUH = /^(?:bahwa\s+)?(?:sudah\s+)?(?:cukup|tidak\s+sanggup\s+lagi)\s*[;.]?$/i;

function bersihkanKeteranganSaksi(teks) {
  const rapat = String(teks || "").replace(/^[\s\-–•]+/, "").replace(/\s+/g, " ").trim();
  if (rapat && POLA_PENUTUP_UTUH.test(rapat)) return "";
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

// ─── Posita: dirapikan di SIPP, sebab ABT hanya membacanya ────────────

/**
 * ============================================================================
 * KENAPA 5125 TIDAK DAPAT DISIMPAN LEWAT edit_data
 * ============================================================================
 *
 * Dibaca dari definisi variabelnya di basis data ABT:
 *
 *   5125  POSITA LENGKAP  data_type = data_sipp  tabel = perkara  kolom = posita
 *
 * dan dari Abt_model::get_data_variabel, yang untuk data_sipp menjalankan
 * "select posita as data from perkara where perkara_id = ?" terhadap koneksi
 * SIPP. ABT tidak menyimpan salinannya di mana pun.
 *
 * Karena itu penolakannya - "bertipe data_sipp, tidak dapat disunting" -
 * bukan keterbatasan yang dapat diakali: tidak ada tempat di ABT untuk
 * menyimpannya. Yang dirapikan harus positanya di SIPP, dan begitu ia rapi
 * di sana, ABT membacanya rapi pada pemuatan berikutnya.
 *
 * ============================================================================
 * LEWAT PORTAL, DAN DENGAN PAGAR YANG DAPAT DIBUKTIKAN
 * ============================================================================
 *
 * Ekstensi tidak menyentuh basis data SIPP - ia tidak punya dan tidak boleh
 * punya jalannya. Ia mengirim teks yang sudah dirapikan ke portal ALETA,
 * portal memeriksa sesi dan kewenangan, lalu bot yang menuliskannya.
 *
 * Pagarnya di sisi bot dan mutlak: teks tanpa ruang kosong harus persis sama
 * sebelum dan sesudah. Perapian hanya menyisipkan pemisah antar butir - lihat
 * rapikanPosita - sehingga tidak satu huruf pun dalil gugatan dapat berubah.
 * Bila berbeda walau satu huruf, tulisannya ditolak dan sebabnya disebut.
 */
async function mintaPositaRapi(perkaraId, ujiKering) {
  const respons = await alatAmbil(ALETA_API_POSITA, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    // Teksnya TIDAK dikirim - hanya perkaranya. Bot membaca positanya
    // sendiri dari SIPP dan merapikannya di sana; lihat catatan panjang di
    // sippPositaService.js tentang kenapa mengirim teks dari sini keliru.
    body: JSON.stringify({ perkaraId, ujiKering: ujiKering === true }),
  }, "Merapikan posita");
  if (!respons.ok) {
    // Uji 9 Okt: label kedua fungsi ini dulu tertukar ("Menyambung kata gagal"
    // saat merapikan posita, dan sebaliknya).
    return { ok: false, pesan: alatPesanGagal(null, respons.status, "Merapikan posita") };
  }

  const luar = await respons.json();
  const isi = luar?.data ?? luar;
  if (!isi?.available) {
    // Pesan dari portal diteruskan apa adanya bila ada - ia menyebut sebab
    // yang lebih tepat daripada kalimat umum, misalnya penolakan pagar isi.
    return { ok: false, pesan: isi?.message || alatPesanGagal(null, 0, "Merapikan posita") };
  }

  const disambung = Number(isi.disambung) || 0;
  const ragu = Array.isArray(isi.ragu) ? isi.ragu : [];
  return {
    ok: true,
    berubah: isi.berubah === true,
    disambung,
    ragu,
    sebelum: String(isi.sebelum || ""),
    sesudah: String(isi.sesudah || ""),
    // Perbaikan data disebut TERPISAH dari penataan. Yang satu menyambung
    // kata yang terpecah - kerusakan yang sudah tersimpan - dan yang lain
    // hanya menata barisnya. Menggabungkannya menjadi satu kata "dirapikan"
    // menyembunyikan bahwa positanya baru saja diperbaiki.
    pesan:
      isi.alasan === "sudah rapi"
        ? "positanya memang sudah rapi"
        : ujiKering
          ? disambung
            ? `pratinjau — ${disambung} kata yang terpecah akan disambung kembali`
            : "pratinjau"
          : disambung
            ? `tersimpan di SIPP, ${disambung} kata yang terpecah disambung kembali`
            : "tersimpan di SIPP",
  };
}
/**
 * Menyambung satu pecahan kata yang RAGU, atas perintah petugas.
 *
 * Yang dikirim hanya perkara dan urutan temuannya - bukan teks. Bot yang
 * membaca positanya, menghitung ulang temuannya, dan memutuskan mana yang
 * disambung; lihat catatan di sambungPecahanRagu.
 */
async function sambungPecahanPosita(perkaraId, indeks) {
  const respons = await alatAmbil(ALETA_API_POSITA, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aksi: "sambung", perkaraId, indeks }),
  }, "Menyambung kata");
  if (!respons.ok) {
    return { ok: false, pesan: alatPesanGagal(null, respons.status, "Menyambung kata") };
  }

  const luar = await respons.json();
  const isi = luar?.data ?? luar;
  if (!isi?.available) {
    return { ok: false, pesan: isi?.message || alatPesanGagal(null, 0, "Menyambung kata") };
  }

  return {
    ok: true,
    pesan: `"${isi.disambung || ""}" disambung${isi.sisa ? `, sisa ${isi.sisa} lagi` : ""}.`,
    sisa: Number(isi.sisa) || 0,
  };
}
// ─── Keterangan saksi: disunting lewat rute ABT sendiri ──────────────────────

/**
 * ============================================================================
 * KENAPA 2021 DAN 2022 TIDAK DAPAT DISIMPAN LEWAT edit_data
 * ============================================================================
 *
 * Dibaca dari definisi variabelnya di basis data ABT:
 *
 *   2021  Keterangan Saksi 1 P   data_type = tanya_jawab   referensi = 1197
 *   2022  Keterangan Saksi 2 P   data_type = tanya_jawab   referensi = 1203
 *
 * Rute edit_data hanya menerima data_teks dan data_tanggal - itu sebabnya ia
 * menjawab "bertipe tanya_jawab - tidak dapat disunting". Dan penolakannya
 * benar: tanya_jawab bukan satu kolom teks, melainkan SEKUMPULAN BARIS di
 * tabel abt_keterangan_saksi, masing-masing berisi urutan, pertanyaan, dan
 * jawaban.
 *
 * ABT punya rutenya sendiri untuk itu - abt/tanyajawab_perkara_edit - dan
 * itulah yang dipakai di sini. Bukan basis datanya langsung: rutenya yang
 * menjalankan clean_tag_ket_saksi, mengisi diinput_oleh dari sesi petugas,
 * dan menentukan id barisnya. Menulis langsung ke tabelnya berarti menyalin
 * ketiga aturan itu dan menunggu salah satunya berubah.
 *
 * ============================================================================
 * YANG PALING BERBAHAYA DI SINI: PERTANYAANNYA TIDAK TERLIHAT DI LAYAR
 * ============================================================================
 *
 * Yang tergambar di baris 2021 hanya JAWABANNYA. Dibaca dari list_keterangan
 * di Abt_model.php:
 *
 *   $data .= "-   Bahwa ".replace_ket_saksi(lcfirst($value->jawaban))."<br>";
 *
 * Pertanyaannya tidak ikut. Dan rute simpannya MENGHAPUS SELURUH baris milik
 * saksi itu lebih dulu, lalu menulis ulang dari apa yang dikirim:
 *
 *   DELETE FROM abt_keterangan_saksi WHERE perkara_id=? AND sidang_id=? AND saksi_id=?
 *
 * Jadi mengirim balik teks yang tergambar di layar akan menghapus SELURUH
 * pertanyaan - dan pertanyaannya memang ada: diukur atas seluruh
 * abt_keterangan_saksi, kelompok terbesar berisi 30 baris dan tidak satu pun
 * yang pertanyaannya kosong. Yang hilang adalah separuh berita acara.
 *
 * Karena itu urutannya di sini:
 *
 *   1. AMBIL daftar utuhnya dari halaman penyunting ABT - pertanyaan DAN
 *      jawaban, beserta urutannya
 *   2. BERSIHKAN jawabannya saja
 *   3. KIRIM BALIK daftar utuhnya, pertanyaannya apa adanya
 *
 * Satu langkah tambahan, dan langkah itu yang menjaga berita acaranya tetap
 * berupa tanya-jawab.
 *
 * ============================================================================
 * SATU SIDANG, DAN ITU DIPERIKSA
 * ============================================================================
 *
 * DELETE-nya berpagar sidang_id, sementara yang DIGAMBAR variabel 2021 adalah
 * keterangan dari SELURUH sidang - GetKeteranganPihak dipanggil dengan
 * sidang_id NULL. Bila satu saksi punya keterangan di lebih dari satu sidang,
 * menyimpan satu sidang meninggalkan sidang lain apa adanya, dan yang
 * tergambar sesudahnya campuran keduanya.
 *
 * Diukur: seluruh kelompok (perkara, sidang, saksi) di PA Donggala berisi satu
 * sidang saja. Jadi keadaan itu tidak ada hari ini - tetapi ia mungkin, dan
 * karena itu jumlah baris sebelum dan sesudah dibandingkan; bila tidak cocok,
 * yang disebut bukan "tersimpan" melainkan selisihnya.
 */

/**
 * ============================================================================
 * RUAS ALAMATNYA DIAMBIL DARI TAUTAN CETAK, BUKAN DARI ALAMAT HALAMAN
 * ============================================================================
 *
 * Keempatnya - a, b, c, d - dibutuhkan rute penyunting tanya-jawab, dan yang
 * paling menentukan d: ia cek_sidang, dan controller memakainya untuk
 * menentukan sidang_id. Rute simpannya MENGHAPUS baris berdasarkan sidang_id
 * itu, dan rute bacanya mengambil baris dari sidang itu saja.
 *
 * Alamat halaman main/view tidak selalu membawa d. Bila ia tidak ada -
 * atau berbeda dari yang dipakai ABT sendiri - yang terbaca DAFTAR KOSONG,
 * dan daftar kosong berarti tidak ada satu pun kalimat penutup yang
 * ditemukan. Itulah yang terjadi: panel berkata "tidak ada kalimat penutup
 * yang perlu dibuang" sementara "Bahwa sudah cukup;" jelas ada di layar.
 *
 * Tautan CETAK di halaman itu dibangun ABT sendiri dengan keempat ruasnya
 * lengkap - "abt/preview?a=...&b=...&c=...&e=...&d=<cek_sidang>". Ia karena
 * itu sumber yang benar. Alamat halaman hanya cadangan.
 */
function ruasAlamatAbt() {
  const halaman = new URLSearchParams(location.search);
  const ambil = (kunci) => halaman.get(kunci) || "";

  const tautan = document.querySelector('a[href*="abt/preview"]');
  if (tautan) {
    try {
      const dari = new URL(tautan.href, location.origin).searchParams;
      return {
        a: dari.get("a") || ambil("a"),
        b: dari.get("b") || ambil("b"),
        c: dari.get("c") || ambil("c"),
        d: dari.get("d") || ambil("d"),
      };
    } catch {
      /* tautannya tidak dapat diurai - alamat halaman dipakai */
    }
  }
  return { a: ambil("a"), b: ambil("b"), c: ambil("c"), d: ambil("d") };
}

function alamatTanyaJawab(kode, aksi, urutan) {
  const r = ruasAlamatAbt();
  const q = new URLSearchParams();
  if (aksi) q.set("aksi", "simpan");
  q.set("no_var", kode);
  q.set("a", r.a);
  q.set("b", r.b);
  q.set("c", r.c);
  // Urutan sidang yang ditemukan, bukan yang tertulis di alamat halaman.
  // Membaca dan menulis HARUS memakai urutan yang sama - rute simpannya
  // menghapus berdasarkan sidang_id yang diturunkan darinya.
  q.set("d", urutan !== undefined && urutan !== null && urutan !== "" ? String(urutan) : r.d);
  return `${asalAbt()}/tanyajawab_perkara_edit?${q.toString()}`;
}

/**
 * ============================================================================
 * RUAS d ITU URUTAN SIDANG, BUKAN PENGENAL SIDANG
 * ============================================================================
 *
 * Terbaca dari Abt_model::data_sidang:
 *
 *   data_sidang($perkara_id, $urutan)
 *     -> "... where a.perkara_id=$perkara_id and a.urutan=$urutan order by a.urutan"
 *
 * dan controller memakainya begini:
 *
 *   $sidang_id = $this->Abt_model->data_sidang($perkara_id, $this->input->get("d"))["0"]->id;
 *
 * Jadi d adalah URUTAN - 1, 2, 3 - dan bila ia kosong, filternya hilang
 * sehingga yang terambil baris PERTAMA: sidang urutan satu. Keterangan saksi
 * hampir tidak pernah ada di sidang pertama; ia ada di sidang pembuktian.
 *
 * Itu sebabnya daftarnya kembali KOSONG walau d sudah diambil dari tautan
 * CETAK: nilainya benar sebagai cek_sidang milik halaman itu, tetapi bukan
 * urutan sidang tempat saksi ini diperiksa.
 *
 * ============================================================================
 * DICARI, BUKAN DITEBAK
 * ============================================================================
 *
 * Yang menentukan bukan nomor urutannya melainkan ADA TIDAKNYA keterangan di
 * sana. Karena itu urutannya ditelusuri dari 1 ke atas sampai ditemukan yang
 * daftarnya berisi, dan urutan itulah yang dipakai menyimpan - satu sidang
 * yang sama untuk membaca dan menulis, sebab rute simpannya menghapus
 * berdasarkan sidang_id yang diturunkan dari d.
 *
 * Dimulai dari d milik halaman: pada perkara yang memang sudah berada di
 * sidang pembuktian, ia langsung benar dan tidak ada satu pun permintaan
 * tambahan. Batasnya dua belas - jadwal terpanjang di PA Donggala jauh di
 * bawah itu, dan batas yang ada mencegah penelusuran tak berujung pada
 * perkara yang saksinya memang belum diperiksa.
 */
const BATAS_URUTAN_SIDANG = 12;

async function ambilSatuTanyaJawab(kode, urutan) {
  const respons = await fetch(alamatTanyaJawab(kode, false, urutan), {
    credentials: "include",
    cache: "no-store",
  });
  if (!respons.ok) throw new Error(`ABT menjawab ${respons.status}`);
  const teks = await respons.text();

  const cocok = teks.match(/var\s+ajax_data\s*=\s*(\[[\s\S]*?\])\s*(?:\r?\n|;)/);
  if (!cocok) {
    // Halamannya berubah, atau yang kembali bukan halaman penyunting -
    // misalnya halaman masuk. Menebak bentuknya berarti menulis daftar yang
    // salah ke tempat yang menghapus daftar lama lebih dulu.
    throw new Error("daftar tanya-jawab tidak terbaca dari halaman ABT");
  }
  try {
    const baris = JSON.parse(cocok[1]);
    return Array.isArray(baris) ? baris : [];
  } catch {
    throw new Error("daftar tanya-jawab tidak dapat diurai");
  }
}

/**
 * Mencari sidang yang benar-benar memuat keterangan saksi ini.
 *
 * @returns {Promise<{baris: Array, urutan: string}>}
 */
/** 1.184.0 (butir 16): urutan sidang yang memuat keterangan saksi, per kode - pencarian 1..12 cukup sekali per halaman. */
const a3UrutanSaksi = new Map();

async function ambilTanyaJawab(kode) {
  const dicoba = [];
  const diingat = a3UrutanSaksi.get(String(kode));
  if (diingat) dicoba.push(diingat);
  const bawaan = ruasAlamatAbt().d;
  if (bawaan) dicoba.push(String(bawaan));
  for (let i = 1; i <= BATAS_URUTAN_SIDANG; i += 1) {
    if (!dicoba.includes(String(i))) dicoba.push(String(i));
  }

  let galatTerakhir = null;
  for (const urutan of dicoba) {
    let baris;
    try {
      baris = await ambilSatuTanyaJawab(kode, urutan);
    } catch (galat) {
      // Urutan yang tidak ada membuat controller ABT gagal - itu bukan
      // kegagalan yang perlu menghentikan pencarian, hanya urutan yang
      // habis. Yang disimpan galat terakhir, untuk dilaporkan bila SELURUH
      // urutan gagal.
      galatTerakhir = galat;
      continue;
    }
    if (baris.length > 0) {
      a3UrutanSaksi.set(String(kode), urutan);
      return { baris, urutan };
    }
  }

  if (galatTerakhir) throw galatTerakhir;
  throw new Error(
    "tidak ada sidang yang memuat keterangan saksi ini - diperiksa urutan 1 sampai " +
      BATAS_URUTAN_SIDANG
  );
}

/**
 * ============================================================================
 * KETERANGAN SAKSI DIBACA MENTAH UNTUK "INPUT KE ABT"
 * ============================================================================
 *
 * Yang tergambar di baris 2021/2022 sudah melewati replace_ket_saksi
 * (Abt_model::list_keterangan): str_ireplace 'saya' -> 'saksi', 'ya, ' -> '',
 * dan sebutan pihak dikapitalkan - DI MANA PUN letaknya, juga di tengah kata.
 * "anaknya, dan" menjadi "anakndan", "sayang" menjadi "saksing". Diukur atas
 * keterangan saksi PA Donggala (1.119 perkara, 32.100 baris): 635 baris rusak
 * begitu, dan kalimat sumber usulan berbeda pada 961 perkara - walau nilai
 * usulannya sendiri sama pada 1.119 dari 1.119.
 *
 * Titik baca ABT yang TIDAK melewati replace_ket_saksi ada satu: penyunting
 * tanya-jawab (tanyajawab_perkara_edit -> views/abt/load_tanyajawab.php,
 * ajax_data = GetKeteranganPihak apa adanya, lihat ambilTanyaJawab). Rutenya
 * hanya memakai c (perkara), d (urutan sidang), dan no_var - sehingga ia
 * terbaca juga pada blangko cerai yang TIDAK menggambar 2021/2022 ([01ab],
 * [01a], [02]), yang sampai kini menjawab "masih kosong di halaman ini" walau
 * keterangannya ada di ABT.
 *
 * Bentuknya disusun seperti list_keterangan - "-   Bahwa " + lcfirst(jawaban)
 * per baris, jawaban kosong dilewati, lalu dibaca seperti innerText - supaya
 * pemecah butir bot melihat bentuk yang sama. Hanya replace_ket_saksi yang
 * tidak diterapkan.
 */
function teksSaksiMentah(baris) {
  const html = (Array.isArray(baris) ? baris : [])
    .map((b) => String((b && b.jawaban) || ""))
    // list_keterangan: if($value->jawaban) - "" dan "0" dilewati PHP.
    .filter((j) => j !== "" && j !== "0")
    .map((j) => `-   Bahwa ${j.charAt(0).toLowerCase()}${j.slice(1)}<br>\n`)
    .join("");
  return html
    .replace(/\r?\n/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((x) => x.trim())
    .join("\n")
    .trim();
}

/** Banyaknya butir "- Bahwa" dalam satu keterangan. */
function jumlahButirSaksi(teks) {
  return (String(teks || "").match(/^-\s*Bahwa\b/gim) || []).length;
}

/**
 * Keterangan kedua saksi untuk usulan: mentah dari penyunting tanya-jawab bila
 * terbaca, teks layar bila tidak - dan yang mana yang dipakai DISEBUT.
 *
 * Baris 2021/2022 yang tergambar dan KOSONG berarti ABT tidak punya satu pun
 * jawaban saksi itu di sidang mana pun (list_keterangan membaca seluruh
 * sidang), sehingga tidak ada yang perlu ditanyakan lagi. Penyunting membaca
 * SATU sidang; bila layar memuat lebih banyak butir - keterangan tersebar di
 * lebih dari satu sidang - teks layar yang dipakai, dan hal itu disebut.
 *
 * @param peta barisVariabel() halaman ini
 * @returns {Promise<{teks1: string, teks2: string, catatan: string[]}>}
 */
async function bacaKeteranganSaksiUsulan(peta) {
  const hasil = { teks1: "", teks2: "", catatan: [] };
  const daftarKode = [VAR_SAKSI_1, VAR_SAKSI_2];
  for (let i = 0; i < daftarKode.length; i += 1) {
    const kode = daftarKode[i];
    const kunci = `teks${i + 1}`;
    const baris = peta && typeof peta.get === "function" ? peta.get(kode) : null;
    const layar = baris ? String(baris.selNilai.innerText || "") : "";
    if (baris && !layar.trim()) continue;
    try {
      const { baris: daftar } = await ambilTanyaJawab(kode);
      const mentah = teksSaksiMentah(daftar);
      if (layar.trim() && jumlahButirSaksi(mentah) < jumlahButirSaksi(layar)) {
        hasil[kunci] = layar;
        hasil.catatan.push(`saksi ${i + 1} dibaca dari layar - keterangannya tersebar di lebih dari satu sidang`);
      } else {
        hasil[kunci] = mentah;
      }
    } catch (galat) {
      const pesan = String((galat && galat.message) || galat);
      if (layar.trim()) {
        hasil[kunci] = layar;
        hasil.catatan.push(`saksi ${i + 1} dibaca dari layar - bacaan mentah gagal: ${pesan}`);
      } else {
        hasil.catatan.push(`saksi ${i + 1} tidak terbaca: ${pesan}`);
      }
    }
  }
  return hasil;
}

/**
 * Membersihkan jawaban saksi, lalu menyimpannya kembali lewat rute ABT.
 *
 * Yang dibuang kalimat penutup yang tidak menambah satu fakta pun - lihat
 * POLA_PENUTUP. Pertanyaannya tidak disentuh sama sekali.
 */
async function simpanKeteranganSaksi(kode) {
  const { baris, urutan } = await ambilTanyaJawab(kode);
  const sebelum = baris.length;

  const disimpan = [];
  let dibuang = 0;
  for (const satu of baris) {
    const jawabanAsli = String((satu && satu.jawaban) || "");
    // Dibersihkan sebagai SATU baris - tiap baris tanya-jawab satu jawaban,
    // jadi hasilnya kosong berarti seluruh jawabannya memang kalimat penutup.
    const jawaban = bersihkanKeteranganSaksi(jawabanAsli);
    if (!jawaban.trim()) {
      dibuang += 1;
      continue;
    }
    disimpan.push({
      no: String((satu && satu.urutan_pertanyaan) || disimpan.length + 1),
      tanya: String((satu && satu.pertanyaan) || ""),
      jawab: jawaban,
    });
  }

  if (dibuang === 0) {
    return { ok: true, pesan: "tidak ada kalimat penutup yang perlu dibuang", dibuang: 0 };
  }

  // Urutannya dirapikan ulang HANYA bila ada yang dibuang: nomor yang
  // berlubang - 1, 2, 4, 5 - terbaca sebagai baris yang hilang, bukan baris
  // yang sengaja dibuang.
  disimpan.forEach((satu, i) => {
    satu.no = String(i + 1);
  });

  const badan = new URLSearchParams();
  badan.set("data", JSON.stringify(disimpan));

  await a2JedaTulis("simpan", alamatTanyaJawab(kode, true, urutan));
  const respons = await fetch(alamatTanyaJawab(kode, true, urutan), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: badan.toString(),
  });
  if (!respons.ok) return { ok: false, pesan: `ABT menjawab ${respons.status}.` };

  const jawab = await respons.text();
  if (!/Tanya\s*Jawab\s*Disimpan/i.test(jawab)) {
    // ABT menjawab 200 baik untuk berhasil maupun untuk pesan galat basis
    // datanya. Yang membedakannya hanya kalimatnya.
    return {
      ok: false,
      pesan: `ABT tidak mengatakan tersimpan: ${jawab.replace(/<[^>]*>/g, " ").trim().slice(0, 160)}`,
    };
  }

  // Diperiksa dari ABT sendiri, bukan dipercaya dari jawabannya. Rute
  // simpannya menghapus lalu menulis ulang; bila selisihnya bukan yang
  // diharapkan, ada baris di sidang lain yang tidak ikut - dan itu harus
  // disebut, bukan didiamkan.
  let sesudah = -1;
  try {
    sesudah = (await ambilSatuTanyaJawab(kode, urutan)).length;
  } catch {
    /* pemeriksaannya gagal - disebut sebagai tidak terperiksa, bukan gagal */
  }

  const harapan = sebelum - dibuang;
  if (sesudah >= 0 && sesudah !== harapan) {
    return {
      ok: true,
      pesan:
        `${dibuang} kalimat penutup dibuang, tetapi barisnya kini ${sesudah} - ` +
        `bukan ${harapan}. Periksa apakah saksi ini punya keterangan di sidang lain.`,
      dibuang,
    };
  }

  return {
    ok: true,
    pesan: `${dibuang} kalimat penutup dibuang, ${harapan} baris tersimpan (sidang urutan ${urutan})`,
    dibuang,
  };
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
/**
 * Keadaan saklar sunting langsung, dibaca sekali lalu diikuti perubahannya -
 * sama dengan saklar cetak tiga berkas di bawah. Bawaannya MATI; lihat
 * catatan pada alatSuntingLangsung di panel-alat.js.
 */
let suntingLangsungNyala = false;
void alatSuntingLangsung().then((n) => {
  suntingLangsungNyala = n;
});

/**
 * Membaca ulang saklar sunting langsung dari penyimpanan.
 *
 * Sama sebabnya dengan saklarCetakSekarang: salinan di memori dapat basi
 * tanpa satu pun tanda, dan yang ditentukannya PERBUATAN - menulis langsung
 * ke blangko ABT. Gagal membaca dianggap MATI, bukan menyala: yang ragu tidak
 * menulis apa pun ke berkas orang.
 */
async function suntingLangsungSekarang() {
  try {
    const nyala = await alatSuntingLangsung();
    suntingLangsungNyala = nyala === true;
    return suntingLangsungNyala;
  } catch {
    return false;
  }
}
try {
  chrome.storage.onChanged.addListener((perubahan, wilayah) => {
    if (wilayah !== "local" || !perubahan[KUNCI_SUNTING_LANGSUNG]) return;
    suntingLangsungNyala = perubahan[KUNCI_SUNTING_LANGSUNG].newValue === true;
  });
} catch {
  /* di luar konteks ekstensi */
}

const KUNCI_CETAK_TIGA = "cetakTigaBerkas";

/**
 * Tata letak penyunting keterangan dua saksi: "damping" atau "tumpuk".
 *
 * Bawaannya BERDAMPINGAN - diputuskan pengguna 21 September 2026. Yang
 * menyunting keterangan saksi membandingkan jawaban saksi 1 dengan saksi 2
 * baris demi baris, dan perbandingan itu yang menjadi pekerjaannya.
 *
 * Diingat per peramban, bukan per perkara: pilihannya tentang cara orang itu
 * bekerja, bukan tentang perkaranya. Gagal membacanya jatuh ke bawaan, bukan
 * ke galat - tata letak yang salah tidak pantas menghentikan penyuntingan.
 */
const KUNCI_TATA_SAKSI = "tataLetakSaksi";
let tataSaksi = "damping";

async function muatTataSaksi() {
  try {
    const simpan = await chrome.storage.local.get([KUNCI_TATA_SAKSI]);
    tataSaksi = simpan[KUNCI_TATA_SAKSI] === "tumpuk" ? "tumpuk" : "damping";
  } catch {
    tataSaksi = "damping";
  }
}

function simpanTataSaksi(nilai) {
  tataSaksi = nilai === "tumpuk" ? "tumpuk" : "damping";
  try {
    void chrome.storage.local.set({ [KUNCI_TATA_SAKSI]: tataSaksi });
  } catch {
    // Pilihannya tetap berlaku selama halaman ini terbuka. Yang hilang hanya
    // ingatannya - dan itu tidak pantas menjatuhkan penyuntingan.
  }
}

/* === P5P6 10 Okt === */
/**
 * ============================================================================
 * PARAGRAF KETERANGAN SAKSI (RINGKAS / LENGKAP) + PERINGATAN RINGAN
 * ============================================================================
 *
 * Bot (deteksiSaksiService.lengkapiSusunan) menambahkan dua ruas pada jawaban
 * "Susun keterangan saksi": paragrafSaksi[] - tiap saksi dalam dua gaya,
 * identitasnya dari SIPP di awal paragraf - dan peringatanSaksi[] (saksi di
 * bawah umur, bukan keluarga pada perkara syiqaq, hanya satu saksi).
 *
 *   - Peringatan TIDAK menahan apa pun; tombol simpan tetap seperti semula.
 *   - Paragraf TIDAK disimpan ke ABT. Yang disimpan tetap tanya-jawab (ABT
 *     sendiri mencetaknya menjadi "Bahwa ..."). Paragraf untuk disalin ke
 *     putusan/catatan; ia mengikuti susunan SAAT tombol Susun ditekan.
 *   - Gaya diingat per peramban (chrome.storage.local), bawaannya "lengkap"
 *     (gaya blangko putusan satker). Gagal membaca = bawaan, bukan galat.
 *   - Bot lama tanpa ruas ini: tidak ada yang digambar.
 */
const P6_KUNCI_GAYA = "gayaParagrafSaksi";
let p6GayaParagraf = "lengkap";

async function p6MuatGaya() {
  try {
    const simpan = await chrome.storage.local.get([P6_KUNCI_GAYA]);
    p6GayaParagraf = simpan[P6_KUNCI_GAYA] === "ringkas" ? "ringkas" : "lengkap";
  } catch {
    p6GayaParagraf = "lengkap";
  }
}

function p6SimpanGaya(nilai) {
  p6GayaParagraf = nilai === "ringkas" ? "ringkas" : "lengkap";
  try {
    void chrome.storage.local.set({ [P6_KUNCI_GAYA]: p6GayaParagraf });
  } catch {
    // Pilihan tetap berlaku selama halaman terbuka.
  }
}

function p6El(tag, kelas, teks) {
  const el = document.createElement(tag);
  if (kelas) el.className = kelas;
  if (teks !== undefined && teks !== null) el.textContent = teks;
  return el;
}

/** Salin teks - ABT satker bukan konteks aman (http), jadi clipboard API bisa tidak ada. */
async function p6Salin(teks, area) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(teks);
      return true;
    }
  } catch {
    // jatuh ke cara lama
  }
  try {
    if (area && typeof area.select === "function") {
      area.select();
      return document.execCommand ? document.execCommand("copy") : false;
    }
  } catch {
    // tidak dapat menyalin - petugas memilih teksnya sendiri
  }
  return false;
}

/** Daftar peringatan ringan, atau null bila tidak ada. */
function p6GambarPeringatan(sdg) {
  const daftar = sdg && Array.isArray(sdg.peringatanSaksi) ? sdg.peringatanSaksi : [];
  if (!daftar.length) return null;
  const kotak = p6El("div", "aleta-abt-catatan aleta-p6-peringatan");
  kotak.setAttribute("role", "note");
  kotak.appendChild(p6El("strong", "", "Periksa saksi (peringatan, tidak menahan penyimpanan):"));
  const ul = p6El("ul", "aleta-p6-peringatan-daftar");
  for (const x of daftar) {
    const li = p6El("li", x.tingkat === "ringan" ? "aleta-p6-ringan" : "aleta-p6-info", String(x.pesan || ""));
    li.dataset.kode = String(x.kode || "");
    ul.appendChild(li);
  }
  kotak.appendChild(ul);
  return kotak;
}

/** Paragraf per saksi dengan pengalih gaya Ringkas/Lengkap, atau null bila bot tidak mengirimnya. */
function p6GambarParagraf(sdg) {
  const daftar = sdg && Array.isArray(sdg.paragrafSaksi) ? sdg.paragrafSaksi : [];
  if (!daftar.length) return null;
  const kotak = p6El("div", "aleta-p6-paragraf");
  const kepala = p6El("div", "aleta-p6-kepala");
  kepala.appendChild(p6El("span", "aleta-abt-label", "Paragraf keterangan saksi (untuk putusan)"));
  const pilih = p6El("div", "aleta-p6-gaya");
  pilih.setAttribute("role", "group");
  pilih.setAttribute("aria-label", "Gaya paragraf");
  const tombol = {};
  for (const [gaya, tulisan] of [["ringkas", "Ringkas"], ["lengkap", "Lengkap"]]) {
    const b = p6El("button", "aleta-p6-gaya-tombol", tulisan);
    b.type = "button";
    b.dataset.gaya = gaya;
    tombol[gaya] = b;
    pilih.appendChild(b);
  }
  kepala.appendChild(pilih);
  kotak.appendChild(kepala);
  kotak.appendChild(
    p6El(
      "div",
      "aleta-abt-catatan",
      (sdg.identitasAsal === "sipp" ? "Identitas saksi dari SIPP. " : "Identitas saksi belum terbaca dari SIPP - lengkapi sendiri. ") +
        "Disusun dari jawaban saat tombol Susun ditekan; ubahan di kolom tanya-jawab di atas tidak ikut. Paragraf ini tidak disimpan ke ABT - salin bila perlu."
    )
  );
  const isian = [];
  for (const p of daftar) {
    const satu = p6El("div", "aleta-p6-saksi");
    const hub = p.hubungan && p.hubungan.teks ? ` - ${p.hubungan.teks}` : "";
    satu.appendChild(p6El("div", "aleta-sdg-judul", `${p.label || "Saksi"}${hub}`));
    const area = p6El("textarea", "aleta-p6-teks");
    area.readOnly = true;
    area.rows = 6;
    const salin = p6El("button", "aleta-p6-salin", "Salin");
    salin.type = "button";
    const kabar = p6El("span", "aleta-p6-kabar", "");
    salin.addEventListener("click", async () => {
      const ok = await p6Salin(area.value, area);
      kabar.textContent = ok ? "tersalin" : "pilih teksnya lalu Ctrl+C";
    });
    satu.appendChild(area);
    satu.appendChild(salin);
    satu.appendChild(kabar);
    kotak.appendChild(satu);
    isian.push({ area, p });
  }
  function segarkan() {
    for (const { area, p } of isian) area.value = String((p6GayaParagraf === "ringkas" ? p.ringkas : p.lengkap) || "");
    for (const g of Object.keys(tombol)) tombol[g].setAttribute("aria-pressed", g === p6GayaParagraf ? "true" : "false");
    kotak.dataset.gaya = p6GayaParagraf;
  }
  for (const g of Object.keys(tombol)) {
    tombol[g].addEventListener("click", () => {
      p6SimpanGaya(g);
      segarkan();
    });
  }
  segarkan();
  return kotak;
}
/* === AKHIR P5P6 === */
const ALETA_API_PDF = "/aleta/api/aleta-bot/abt/pdf";

/**
 * Keadaan saklar, dibaca sekali lalu diikuti perubahannya.
 *
 * Bawaannya MATI. Ia mengubah arti tombol milik aplikasi orang lain - satu
 * tekanan yang dulu menghasilkan satu berkas menjadi tiga - dan perubahan
 * sebesar itu tidak pantas diambil sendiri oleh sebuah pembaruan.
 */
let cetakTigaMenyala = false;

/**
 * Membaca ulang saklar dari penyimpanan, bukan dari salinan di memori.
 *
 * Dipakai tepat sebelum tiga berkas diterbitkan. Salinan di memori dapat basi
 * tanpa satu pun tanda - lihat keterangan panjang di pasangPenjagaCetak - dan
 * yang dipertaruhkan bukan kerapian melainkan tiga unduhan yang tidak diminta.
 *
 * Gagal membaca dianggap MATI, bukan menyala. Yang ragu tidak menerbitkan apa
 * pun: petugas masih mendapat blangko ABT-nya, dan itu keadaan yang dapat
 * diperbaiki sendiri. Tiga berkas yang tidak diminta tidak.
 */
async function saklarCetakSekarang() {
  try {
    const simpan = await chrome.storage.local.get([KUNCI_CETAK_TIGA]);
    const nyala = simpan[KUNCI_CETAK_TIGA] === true;
    // Salinannya ikut diluruskan, supaya penanda "3" pada tautan berhenti
    // berbohong pada tekanan berikutnya.
    if (nyala !== cetakTigaMenyala) {
      cetakTigaMenyala = nyala;
      segarkanPenandaCetak();
    }
    return nyala;
  } catch {
    return false;
  }
}

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
      // Penandanya ikut berubah seketika. Tanpa ini, saklar yang baru
      // dinyalakan dari popup meninggalkan halaman yang mengaku masih mati -
      // dan penanda yang berbohong lebih buruk daripada tidak ada penanda.
      segarkanPenandaCetak();
    });
  } catch {
    /* tanpa pendengar, saklarnya berlaku pada pemuatan berikutnya */
  }
}

/** Tautan cara lama - dipakai bila jalur ekstensi tidak tersedia. */
function unduhLewatTautan(blob, nama) {
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

/** Blob menjadi data: URL, supaya dapat dikirim ke pekerja latar. */
function blobKeData(blob) {
  return new Promise((selesai, gagal) => {
    const pembaca = new FileReader();
    pembaca.onload = () => selesai(String(pembaca.result || ""));
    pembaca.onerror = () => gagal(pembaca.error || new Error("berkas tidak terbaca"));
    pembaca.readAsDataURL(blob);
  });
}

/**
 * Menyimpan satu blob sebagai unduhan.
 *
 * ============================================================================
 * DITERBITKAN EKSTENSI, BUKAN HALAMAN
 * ============================================================================
 *
 * Chrome memblokir unduhan yang berasal dari halaman http:// - "Chrome blocked
 * this download because the site isn't using a secure connection". SIPP dan
 * ABT berjalan di http://192.168.10.10, jadi seluruh putusan, anonimisasi, dan
 * PDF yang disusun panel jatuh ke sana: tercoret di riwayat unduhan, dan tiap
 * berkas harus dipaksa satu per satu.
 *
 * Alamat blob TIDAK menolong - ia mewarisi asal halamannya, jadi tetap http.
 * Yang menolong adalah menerbitkannya dari ekstensi; chrome-extension://
 * adalah asal yang tepercaya.
 *
 * Berkasnya sendiri tidak melintasi jaringan lagi: ia sudah ada di memori,
 * diambil lewat fetch yang sama yang dipakai panel untuk membacanya. Yang
 * berpindah hanya siapa yang menuliskannya ke cakram.
 *
 * Bila jalur itu gagal - izin belum diberikan sesudah pembaruan, pekerja latar
 * sedang tidur - ia jatuh ke cara lama. Unduhan yang tertahan peringatan masih
 * jauh lebih baik daripada unduhan yang tidak terjadi.
 */
async function unduhBlob(blob, nama) {
  try {
    const alamat = await blobKeData(blob);
    const jawab = await new Promise((selesai) => {
      try {
        chrome.runtime.sendMessage(
          { sumber: "aleta-panel", jenis: "unduh", nama, alamat },
          (hasil) => {
            void chrome.runtime.lastError;
            selesai(hasil);
          }
        );
      } catch {
        selesai(null);
      }
    });
    if (jawab && jawab.ok) return;
    alatCatat("massal-galat", `unduhan lewat ekstensi gagal: ${(jawab && jawab.pesan) || "tanpa jawaban"}`, "");
  } catch (galat) {
    alatCatat("massal-galat", `unduhan lewat ekstensi gagal: ${String((galat && galat.message) || galat)}`, "");
  }
  unduhLewatTautan(blob, nama);
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
/**
 * ============================================================================
 * STATUS PUTUSAN IKUT PADA NAMANYA - TERMASUK VERSTEK
 * ============================================================================
 *
 * Diminta sejak 15 September: nama berkas menyebut nomor perkara,
 * deskripsinya, status putusannya, dan verstek atau bukan. Dua yang pertama
 * sudah ada; status dan verstek belum, sehingga dua berkas dari perkara yang
 * sama - satu dikabulkan verstek, satu contradictoir - hanya dapat dibedakan
 * dengan membukanya.
 *
 * Sumbernya SIPP, lewat jadwal sidang yang sudah dibaca panel massal
 * (statusPutusan dan verstekPutusan). Pada halaman satu perkara, panel
 * menanyakannya sekali lalu menyimpannya di statusPutusanPerkara.
 *
 * Yang tidak terbaca tidak menambahkan apa pun - nama berkas yang mengarang
 * status putusan jauh lebih berbahaya daripada nama yang pendek.
 */
const statusPutusanPerkara = new Map();

/** "Dikabulkan" + verstek menjadi "Dikabulkan verstek". */
function sebutStatusPutusan(nomorPerkara) {
  const keadaan = statusPutusanPerkara.get(String(nomorPerkara || ""));
  if (!keadaan) return "";
  const status = String(keadaan.statusPutusan || "").trim();
  const verstek = keadaan.verstek ? "verstek" : "";
  // Status yang sudah menyebut verstek tidak diulang: SIPP menulis
  // "DIKABULKAN (verstek)" pada sebagian baris.
  if (verstek && /verstek/i.test(status)) return status;
  return [status, verstek].filter(Boolean).join(" ");
}

/** Jenis perkara menurut daftar sidang - "" bila perkaranya belum dikenal. */
function sebutJenisPerkara(nomorPerkara) {
  const keadaan = statusPutusanPerkara.get(String(nomorPerkara || ""));
  return String((keadaan && keadaan.jenisPerkara) || "").trim();
}

/**
 * ============================================================================
 * NOMOR PERKARA - JENIS PERKARA - STATUS PUTUSAN
 * ============================================================================
 *
 * Bentuk yang diminta satker, dan bentuk yang dipakai seluruh jalur unduhan -
 * lewat panel maupun lewat pendengar unduhan di latar.js.
 *
 * Bentuk sebelumnya menyisipkan ringkasBlangkoAbt() di tempat jenis perkara.
 * Itu bukan jenis perkara melainkan potongan kepala halaman blangko, yang
 * berbunyi lain di tiap halaman dan hilang sama sekali ketika kepalanya tidak
 * terbaca. Jenis perkara kini datang dari daftar sidang - sumber yang sama
 * yang dipakai panel massal - dan dari keterangan perkara pada jalur satu
 * perkara.
 *
 * Penanda jenis berkas hanya ditempelkan bila BUKAN putusan utamanya: tanpa
 * itu berkas anonimisasi bernama persis sama dengan putusannya, dan yang
 * kedua menimpa yang pertama.
 */
function namaBerkas(nomorPerkara, akhiran, jenis) {
  const dasar = String(nomorPerkara || "putusan").replace(/[\\/:*?"<>|]+/g, "_");
  const bagian = [dasar, sebutJenisPerkara(nomorPerkara), sebutStatusPutusan(nomorPerkara)];
  if (jenis && jenis !== "putusan") bagian.push(jenis);
  return `${bagian.filter(Boolean).join(" - ")}.${akhiran}`
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ");
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
  // ==========================================================================
  // PAGAR TERAKHIR - DAN SENGAJA BERLAPIS DENGAN YANG DI PEMANGGILNYA
  // ==========================================================================
  //
  // Pemanggilnya sudah memeriksa saklarnya. Pemeriksaan kedua di sini menjaga
  // pemanggil yang KELAK ditambahkan dan lupa memeriksanya - dan fungsi yang
  // menerbitkan tiga unduhan tanpa diminta adalah fungsi yang tidak boleh
  // bergantung pada kehati-hatian pemanggilnya.
  if (!(await saklarCetakSekarang())) {
    lapor("Cetak tiga berkas sedang dimatikan - tidak ada yang diterbitkan.", true);
    return { rtf: "dimatikan", pdf: "dimatikan", anonim: "dimatikan" };
  }

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
    // Uji 9 Okt: dulu hanya panjangnya yang diperiksa - halaman masuk (sesi
    // ABT habis) atau "ERROR Variabel #x#" tersimpan sebagai putusan .rtf dan
    // ikut dikirim ke konversi PDF. Jalur massal sudah memeriksa ini.
    const awal = new TextDecoder("latin1").decode(new Uint8Array(isiRtf).subarray(0, 5));
    if (!awal.startsWith("{\\rtf")) {
      const sebab = a3SebabBukanAbt(new TextDecoder("latin1").decode(new Uint8Array(isiRtf).subarray(0, 6000)));
      throw new Error(sebab || "ABT tidak mengembalikan RTF");
    }
    unduhBlob(new Blob([isiRtf], { type: "application/rtf" }), namaBerkas(nomor, "rtf", "putusan"));
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
    const respons = await alatAmbil(ALETA_API_PDF, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rtfBase64: base64DariBuffer(isiRtf) }),
    }, "Membuat PDF");
    if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Membuat PDF"));
    const luar = await respons.json();
    const isi = luar?.data ?? luar;
    if (!isi?.available) throw new Error(isi?.message || alatPesanGagal(null, 0, "Membuat PDF"));
    const biner = Uint8Array.from(atob(isi.pdfBase64), (c) => c.charCodeAt(0));
    unduhBlob(new Blob([biner], { type: "application/pdf" }), namaBerkas(nomor, "pdf", "putusan"));
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
    unduhBlob(new Blob([isi], { type: "application/rtf" }), namaBerkas(nomor, "rtf", "anonimisasi"));
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
 * Dahulu disimpan HANYA di penyimpanan ekstensi, dengan batas yang disebut
 * sendiri: riwayatnya hanya ada di peramban ini dan hilang bila datanya
 * dibersihkan. Batas itu punya tiga akibat nyata - hilang saat data peramban
 * dibersihkan, tidak ada pada peramban lain milik orang yang sama, dan tidak
 * terlihat oleh siapa pun selain yang menyuntingnya, sehingga tidak dapat
 * dipakai mengawasi apa pun.
 *
 * Sekarang dicatat di KEDUANYA, dan masing-masing punya tugasnya - lihat
 * catatan pada catatRiwayat di bawah. Yang di peramban tetap yang
 * menggerakkan Urungkan, dan itu bukan peninggalan: ia satu-satunya yang
 * lengkap, dan satu-satunya yang tetap ada ketika jaringan putus.
 */
const KUNCI_RIWAYAT = "abtRiwayat";
const BATAS_RIWAYAT = 200;
const ALETA_API_RIWAYAT = "/aleta/api/aleta-ecourt/abt-riwayat";

/**
 * ============================================================================
 * DICATAT DUA KALI, DAN MASING-MASING PUNYA TUGASNYA
 * ============================================================================
 *
 *   peramban   LENGKAP, ada seketika, dan menggerakkan tombol Urungkan
 *   peladen    BERTAHAN, dapat dibaca orang lain, dan menjadi jejak pengawasan
 *
 * Peramban ditulis LEBIH DAHULU dan tanpa syarat. Menjadikan peladen
 * satu-satunya sumber akan mematikan Urungkan setiap kali jaringan terputus -
 * padahal justru saat sesuatu baru saja salah diterapkanlah tombol itu paling
 * dibutuhkan.
 *
 * Kegagalan mengirim ke peladen karena itu DIAM: penyuntingannya sudah
 * berhasil, salinan lengkapnya sudah tersimpan, dan berteriak tentang jejak
 * pengawasan pada saat itu hanya membuat petugas menyangka suntingannya gagal.
 */
/**
 * 1.184.0 (butir 16): catatan riwayat DIANTRIKAN. Sampai 1.183.0 jeda manusia
 * >= 0,9 detik memisahkan tiap tulisan, sehingga baca-lalu-tulis
 * KUNCI_RIWAYAT tidak pernah bertumpuk. Tanpa jeda, dua catatan beruntun
 * dapat membaca daftar yang sama dan yang kedua menimpa yang pertama.
 */
let a3AntreanRiwayat = Promise.resolve();

function catatRiwayat(catatan) {
  const jalan = a3AntreanRiwayat.then(() => catatRiwayatSatu(catatan));
  a3AntreanRiwayat = jalan.catch(() => {});
  return jalan;
}

async function catatRiwayatSatu(catatan) {
  try {
    const simpan = await chrome.storage.local.get([KUNCI_RIWAYAT]);
    const daftar = Array.isArray(simpan[KUNCI_RIWAYAT]) ? simpan[KUNCI_RIWAYAT] : [];
    daftar.unshift(catatan);
    await chrome.storage.local.set({ [KUNCI_RIWAYAT]: daftar.slice(0, BATAS_RIWAYAT) });
  } catch {
    /* penyimpanan tidak tersedia - perubahannya tetap tersimpan di ABT */
  }

  try {
    await fetch(ALETA_API_RIWAYAT, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(catatan),
    });
  } catch {
    /* jejak pengawasan tertinggal - salinan lengkapnya ada di peramban */
  }
}

/**
 * Riwayat satu perkara, dari kedua tempat sekaligus.
 *
 * Digabung supaya jejak yang dicatat dari peramban LAIN - atau yang sudah
 * terhapus dari peramban ini - tetap terlihat. Yang dari peramban tetap
 * didahulukan pada baris yang sama, sebab hanya ia yang isinya utuh dan hanya
 * ia yang dapat diurungkan.
 */
async function bacaRiwayat(perkaraId) {
  let lokal = [];
  try {
    const simpan = await chrome.storage.local.get([KUNCI_RIWAYAT]);
    const daftar = Array.isArray(simpan[KUNCI_RIWAYAT]) ? simpan[KUNCI_RIWAYAT] : [];
    lokal = daftar.filter((x) => x && x.perkaraId === perkaraId);
  } catch {
    lokal = [];
  }

  let jauh = [];
  try {
    const respons = await fetch(
      `${ALETA_API_RIWAYAT}?perkaraId=${encodeURIComponent(String(perkaraId))}`,
      { credentials: "include", cache: "no-store" }
    );
    if (respons.ok) {
      const luar = await respons.json();
      const isi = luar && luar.data ? luar.data : luar;
      jauh = Array.isArray(isi && isi.daftar) ? isi.daftar : [];
    }
  } catch {
    jauh = [];
  }

  // Dikenali dari waktu dan variabelnya - itulah yang sama pada kedua
  // salinan satu perubahan. Id peladen tidak ada pada salinan peramban, jadi
  // memakainya sebagai pengenal akan menggandakan seluruh baris.
  const sudah = new Set(lokal.map((x) => `${x.pada}|${x.kode}`));
  const gabung = lokal.slice();
  for (const satu of jauh) {
    const kunci = `${satu.pada}|${satu.kode}`;
    if (sudah.has(kunci)) continue;
    sudah.add(kunci);
    // Ditandai supaya terlihat bahwa ia tidak dapat diurungkan dari sini:
    // isinya mungkin dipotong, dan salinan lengkapnya ada di peramban lain.
    gabung.push({ ...satu, dariPeladen: true });
  }

  gabung.sort((a, b) => String(b.pada || "").localeCompare(String(a.pada || "")));
  return gabung;
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
      const tersimpan = String(hasil.nilaiTersimpan ?? ketik.value).trim();
      void catatRiwayat({
        perkaraId: jatiDiri.perkaraId,
        kode: item.kode,
        nama: item.nama,
        sebelum: nilaiLama,
        sesudah: tersimpan,
        cara: "sunting tangan",
        pada: new Date().toISOString(),
      });
      tutup(tersimpan);
      if (typeof sesudahSimpan === "function") sesudahSimpan(item.kode, tersimpan);
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
    item.selNilai.title = "Klik untuk menyunting di tempat. Ctrl+Enter menyimpan, Esc membatalkan.";
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
  // Usulan yang bot sendiri ragukan: 0222 dari dalil posita yang belum
  // dikuatkan saksi, 1268 bila saksi berkata belum pernah ada upaya damai,
  // 5227 dengan ciri yang frasanya belum ada. Sebelum ini ia jatuh ke
  // "tidak ditemukan" - lencana yang menyangkal nilai di sebelahnya.
  ragu: { kelas: "aleta-tanda-kuning", teks: "ragu — periksa dulu" },
  kosong: { kelas: "aleta-tanda-abu", teks: "tidak ditemukan" },
  tidak_ada_sumber: { kelas: "aleta-tanda-abu", teks: "tidak ada sumbernya" },
  // 1.184.0 (butir 2): dibaca mesin dari berkas KTP e-Court - tidak dicentang sendiri.
  ocr: { kelas: "aleta-tanda-kuning", teks: "dari berkas KTP e-Court — periksa" },
};

/**
 * S5=H1 (10 Okt 2026): 0222/0246/9944/5227 dari keterangan saksi membawa DUA
 * tanda yang berbeda arti - lihat tandaiS5 di abtUsulanService.js:
 *   kesepakatan  apa kata para saksi (sama/berbeda/satu saksi/posita)
 *   tingkat      seberapa sering golongan itu sama dengan isian akhir petugas,
 *                terukur atas putusan nyata. "ragu" tidak dicentang sendiri;
 *                hanya "pasti" yang ikut "Input semua yang pasti".
 */
const NADA_KESEPAKATAN = {
  sama: { kelas: "aleta-tanda-hijau", teks: "kedua saksi sama" },
  berbeda: { kelas: "aleta-tanda-merah", teks: "saksi berbeda" },
  "satu saksi": { kelas: "aleta-tanda-kuning", teks: "satu saksi" },
  dihitung: { kelas: "aleta-tanda-kuning", teks: "dihitung dari pisah rumah" },
  posita: { kelas: "aleta-tanda-kuning", teks: "dari posita — belum dikuatkan saksi" },
};
const NADA_TINGKAT = {
  pasti: { kelas: "aleta-tanda-hijau", teks: "yakin: pasti" },
  cukup: { kelas: "aleta-tanda-kuning", teks: "yakin: cukup" },
  ragu: { kelas: "aleta-tanda-abu", teks: "yakin: ragu — periksa" },
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
  // sendiri. Yang berselisih justru yang paling perlu dibaca manusia - dan
  // yang "ragu" pun tidak: nilai yang bot sendiri ragukan (mis. 0222 dari
  // posita) masuk ke blangko hanya bila petugas mencentangnya.
  centang.checked =
    Boolean(u.nilai) && u.keyakinan !== "bentrok" && u.keyakinan !== "ragu" && u.keyakinan !== "ocr" && u.tingkat !== "ragu";
  centang.disabled = !u.nilai;
  kepala.appendChild(centang);
  kepala.appendChild(buatElemen("span", "aleta-abt-kode", u.kode));
  kepala.appendChild(buatElemen("span", "aleta-abt-nama", u.nama));

  // Usulan dari posita (itsbat, perkara lain) berkeyakinan "cukup" - tetapi
  // "satu saksi" di sebelah kalimat posita menyebut sumber yang tidak ada.
  const dariPosita = Array.isArray(u.sumber) && u.sumber.length > 0 && u.sumber.every((s) => s && s.asal === "posita");
  // 9 Okt (KUASA): usulan dari surat gugatan e-Court membawa tanda sumbernya sendiri.
  const dariGugatan = Array.isArray(u.sumber) && u.sumber.length > 0 && u.sumber[0] && u.sumber[0].asal === "gugatan-ecourt";
  const nadaS5 = typeof u.kesepakatan === "string" && u.nilai ? NADA_KESEPAKATAN[u.kesepakatan] : null;
  const nada = nadaS5
    ? nadaS5
    : dariPosita && u.keyakinan === "cukup"
      ? { kelas: "aleta-tanda-kuning", teks: "dari posita" }
      : dariGugatan && u.keyakinan === "cukup"
      ? { kelas: "aleta-tanda-hijau", teks: "dari gugatan e-Court" }
      : dariGugatan && u.keyakinan === "ragu"
      ? { kelas: "aleta-tanda-kuning", teks: "dari gugatan e-Court — periksa" }
      : NADA_KEYAKINAN[u.keyakinan] || NADA_KEYAKINAN.kosong;
  const lencana = buatElemen("span", `aleta-tanda ${nada.kelas}`, nada.teks);
  kepala.appendChild(lencana);
  if (nadaS5 && NADA_TINGKAT[u.tingkat]) {
    const yakin = buatElemen("span", `aleta-tanda aleta-s5-yakin ${NADA_TINGKAT[u.tingkat].kelas}`, NADA_TINGKAT[u.tingkat].teks);
    yakin.dataset.tingkat = u.tingkat;
    yakin.title = `Tingkat yakin menurut ukuran atas putusan yang sudah diputus. Golongan: ${u.dasarTingkat || "-"}.`;
    kepala.appendChild(yakin);
  }
  kartu.appendChild(kepala);

  const sanding = buatElemen("div", "aleta-abt-sanding");
  const kini = buatElemen("div", "aleta-abt-kini");
  kini.appendChild(buatElemen("span", "aleta-abt-label", "sekarang"));
  kini.appendChild(buatElemen("span", "aleta-abt-isi", keadaanSekarang || "(kosong)"));
  sanding.appendChild(kini);

  // ── USULAN YANG DAPAT DISUNTING DI TEMPAT ────────────────────────────────
  //
  // Usulan ALETA tetap usulan. Yang menandatangani perkara ini petugas, dan
  // kalimat yang masuk ke blangko harus kalimat yang ia setujui - bukan
  // kalimat mesin yang kebetulan mendekati. Sebelum ini, satu kata yang
  // kurang tepat berarti usulannya tidak dapat dipakai sama sekali: petugas
  // membatalkan centangnya lalu mengetik ulang seluruh kalimat di borang ABT.
  //
  // Sekali klik, teksnya menjadi kotak isian. Yang tersimpan ke ABT adalah
  // yang terbaca di kotak itu saat Terapkan ditekan - bukan yang diusulkan
  // semula. Usulan yang KOSONG pun dapat diisi begini, dan centangnya menyala
  // sendiri begitu ada isinya: petugas yang tahu jawabannya tidak perlu
  // meninggalkan panel hanya untuk mengetik satu baris.
  let nilaiTerkini = u.nilai || "";
  let disunting = false;

  const usul = buatElemen("div", "aleta-abt-usul");
  usul.appendChild(buatElemen("span", "aleta-abt-label", "usulan"));

  const isi = buatElemen("span", "aleta-abt-isi aleta-abt-isi-sunting", nilaiTerkini || "(kosong - klik untuk mengisi)");
  if (!nilaiTerkini) isi.classList.add("aleta-abt-isi-kosong");
  isi.title = "Klik untuk menyunting sebelum dimasukkan ke ABT";
  isi.tabIndex = 0;
  isi.setAttribute("role", "button");
  isi.setAttribute("aria-label", `Sunting usulan ${u.nama}`);

  // Jalan yang SELALU ada, menyala atau mati saklarnya. Saat menyala ia
  // sekadar jalan kedua; saat mati ia satu-satunya - dan tekanan itulah yang
  // menyatakan kehendak menyunting.
  const tombolSunting = buatElemen("button", "aleta-perkakas-pulih", "Sunting");
  tombolSunting.type = "button";
  tombolSunting.title = "Sunting usulan ini sebelum dimasukkan ke ABT.";
  tombolSunting.addEventListener("click", () => mulaiSunting());

  const tandaSunting = buatElemen("span", "aleta-tanda aleta-tanda-sunting", "disunting");
  tandaSunting.hidden = true;

  /** Menggambar ulang teks yang tampak beserta keadaan centangnya. */
  function segarkanTampilan() {
    isi.textContent = nilaiTerkini || "(kosong - klik untuk mengisi)";
    isi.classList.toggle("aleta-abt-isi-kosong", !nilaiTerkini);
    tandaSunting.hidden = !disunting;
    // Centang mengikuti ADA-TIDAKNYA isi, bukan usulan semula. Kotak yang
    // tidak dapat dicentang padahal sudah diisi petugas adalah kotak yang
    // membuang pekerjaannya.
    centang.disabled = !nilaiTerkini;
    if (!nilaiTerkini) centang.checked = false;
  }

  function mulaiSunting() {
    if (usul.querySelector("textarea")) return;
    const kotak = document.createElement("textarea");
    kotak.className = "aleta-abt-sunting-kotak";
    kotak.value = nilaiTerkini;
    kotak.rows = Math.min(6, Math.max(2, Math.ceil((nilaiTerkini.length || 1) / 60)));
    isi.replaceWith(kotak);
    kotak.focus();
    kotak.setSelectionRange(kotak.value.length, kotak.value.length);

    const selesai = (batal) => {
      if (!batal) {
        const baru = kotak.value.trim();
        if (baru !== nilaiTerkini) {
          nilaiTerkini = baru;
          disunting = baru !== (u.nilai || "");
          // Yang baru diisi sendiri oleh petugas langsung dicentang - ia
          // mengetiknya justru supaya masuk.
          if (nilaiTerkini) centang.checked = true;
        }
      }
      kotak.replaceWith(isi);
      segarkanTampilan();
    };

    kotak.addEventListener("blur", () => selesai(false));
    kotak.addEventListener("keydown", (peristiwa) => {
      // Escape membatalkan, Ctrl+Enter menyelesaikan. Enter biasa dibiarkan
      // membuat baris baru: usulan blangko kerap lebih dari satu kalimat.
      if (peristiwa.key === "Escape") {
        peristiwa.preventDefault();
        selesai(true);
      } else if (peristiwa.key === "Enter" && (peristiwa.ctrlKey || peristiwa.metaKey)) {
        peristiwa.preventDefault();
        selesai(false);
      }
    });
  }

  // ==========================================================================
  // KLIK MENYUNTING HANYA BILA SAKLARNYA MENYALA
  // ==========================================================================
  //
  // Saat mati, nilai tetap dapat disunting - lewat tombol Sunting di baris
  // ini. Yang berubah bukan kemampuannya melainkan seberapa mudah ia terbuka
  // TANPA DIMAKSUD, dan pada halaman tempat naskah putusan disusun perbedaan
  // itu yang menentukan.
  isi.addEventListener("click", () => {
    // Dibaca ULANG dari penyimpanan, bukan dari salinan di memori. Salinan itu
    // dapat basi tanpa satu pun tanda - tab yang dibekukan peramban tidak
    // menerima onChanged, dan ekstensi yang dimuat ulang meninggalkan tab lama
    // tanpa pendengar sama sekali.
    //
    // Menunggu satu putaran tidak terasa oleh yang menekan, dan yang dicegah
    // nyata: penyunting yang terbuka TANPA DIMAKSUD pada halaman tempat naskah
    // putusan disusun.
    void (async () => {
      if (!(await suntingLangsungSekarang())) return;
      mulaiSunting();
    })();
  });
  isi.addEventListener("keydown", (peristiwa) => {
    if (peristiwa.key === "Enter" || peristiwa.key === " ") {
      peristiwa.preventDefault();
      mulaiSunting();
    }
  });

  usul.appendChild(isi);
  // Tombolnya sebelum tandanya: yang dicari mata saat hendak menyunting adalah
  // tombolnya, dan tanda "disunting" baru berarti sesudah ada yang disunting.
  usul.appendChild(tombolSunting);
  usul.appendChild(tandaSunting);
  sanding.appendChild(usul);
  kartu.appendChild(sanding);
  segarkanTampilan();

  // ==========================================================================
  // BUNYI YANG HARUS DIPILIH PETUGAS (pilihan[] dari bot)
  // ==========================================================================
  //
  // 1268 bila saksi berkata "belum/tidak pernah ada upaya damai": bot SENGAJA
  // tidak mengisi nilainya (keputusan pengguna 8) dan menawarkan dua bunyi -
  // bunyi baku "tidak berhasil" dan bunyi "belum ada upaya". Sampai kini
  // pilihan itu dikirim bot tetapi tidak tergambar, sehingga kartu itu hanya
  // berbunyi "(kosong)" dan petugas mengetik ulang kalimat yang sudah ada.
  //
  // Digambar sebagai pilihan tanpa bawaan: tidak satu pun terpilih, dan
  // centangnya mati sampai petugas memilih. Memilih adalah tindakan petugas,
  // jadi centangnya menyala sesudah itu - sama dengan mengetik sendiri.
  let bunyiDipilih = "";
  const daftarBunyi = (Array.isArray(u.pilihan) ? u.pilihan : [])
    .map((p, i) =>
      p && typeof p === "object"
        ? { keadaan: String(p.keadaan || `pilihan ${i + 1}`), nilai: String(p.nilai || "") }
        : { keadaan: `pilihan ${i + 1}`, nilai: String(p || "") }
    )
    .filter((p) => p.nilai);
  if (daftarBunyi.length) {
    const barisPilih = buatElemen("label", "aleta-abt-pilih-bunyi");
    barisPilih.appendChild(buatElemen("span", "aleta-abt-label", "pilih bunyi"));
    const pilihBunyi = document.createElement("select");
    pilihBunyi.className = "aleta-sdg-pilih aleta-abt-pilihan-bunyi";
    const kosong = document.createElement("option");
    kosong.value = "";
    kosong.textContent = "— wajib dipilih petugas —";
    pilihBunyi.appendChild(kosong);
    daftarBunyi.forEach((p, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = `${p.keadaan}: ${p.nilai}`;
      pilihBunyi.appendChild(o);
    });
    pilihBunyi.value = "";
    pilihBunyi.addEventListener("change", () => {
      const p = daftarBunyi[Number(pilihBunyi.value)];
      bunyiDipilih = p ? p.keadaan : "";
      nilaiTerkini = p ? p.nilai : "";
      disunting = false;
      segarkanTampilan();
      if (nilaiTerkini) centang.checked = true;
    });
    barisPilih.appendChild(pilihBunyi);
    kartu.appendChild(barisPilih);
  }

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
    kutip.appendChild(
      buatElemen(
        "span",
        "aleta-abt-asal",
        s.asal === "posita" ? "Posita" : s.asal === "gugatan-ecourt" ? "Gugatan e-Court" : s.saksi ? `Saksi ${s.saksi}` : "SIPP"
      )
    );
    kutip.appendChild(buatElemen("span", "aleta-abt-kalimat", s.kalimat || s.keterangan || ""));
    kartu.appendChild(kutip);
  }

  // Nilai dibaca lewat fungsi, bukan disalin sekarang: yang dipakai Terapkan
  // harus yang terbaca SAAT tombol ditekan, termasuk suntingan terakhir.
  pilih.push({
    usulan: u,
    centang,
    nilai: () => nilaiTerkini,
    disunting: () => disunting,
    bunyiDipilih: () => bunyiDipilih,
  });
  return kartu;
}

/* === KAMUS-DB 10 Okt === */
/**
 * D2 (10 Okt 2026) - JEJAK KOREKSI: usulan yang DITAMPILKAN ALETA dan nilai
 * yang akhirnya disimpan petugas ke ABT, dikirim bersama catatan riwayat ke
 * /api/aleta-ecourt/abt-riwayat (portal menulis aleta_jejak_koreksi). Nilai
 * akhirnya = "sesudah" pada catatan yang sama. Tidak ada tanda apa pun di ABT.
 *
 * kodePola: kode pola kamus deteksi yang melahirkan usulan (bila layanan bot
 * mengisinya pada usulan: u.kodePola). Koreksi yang berulang atas satu kode
 * pola menjadi CALON tinjauan pola di layar Admin (P8).
 */
function d2Koreksi(x, asalUsulan, bunyi, opsi) {
  const u = (x && x.usulan) || {};
  const s0 = Array.isArray(u.sumber) && u.sumber[0] ? u.sumber[0] : null;
  const disunting = typeof x.disunting === "function" && x.disunting();
  return {
    usulan: String(u.nilai || ""),
    sumber: String(asalUsulan || ""),
    kodePola: typeof u.kodePola === "string" ? u.kodePola : "",
    keyakinan: String(u.tingkat || u.keyakinan || ""),
    kalimatSumber: s0 ? String(s0.kalimat || s0.keterangan || "").slice(0, 1000) : "",
    hasil: bunyi && !disunting ? "dipilih" : "",
    jalur: String((opsi && opsi.jalur) || "panel ALETA"),
  };
}
/* === AKHIR KAMUS-DB === */

/**
 * ============================================================================
 * TERAPKAN YANG DICENTANG - SATU PER SATU, BERURUTAN
 * ============================================================================
 *
 * Tiap variabel dikirim SESUDAH yang sebelumnya dijawab ABT: satu permintaan
 * edit_data dalam satu waktu, sehingga satu tombol tidak menumpuk permintaan
 * ke ABT. Tidak ada jeda buatan di antaranya - tunggu yang tidak berguna bagi
 * petugas maupun bagi peladen hanya memperlambat.
 *
 * Satu variabel yang ditolak tidak menghentikan sisanya; penolakannya disebut
 * satu per satu. Riwayat dicatat per variabel, dengan pembedaan antara usulan
 * mesin dan yang disunting petugas.
 *
 * @param dipilih  butir kartu usulan: {usulan, centang, nilai(), disunting()}
 * @param jatiDiri {perkaraId, perkTemp}
 * @param lapor    (teks) => void - kemajuan untuk petugas
 * @returns {Promise<{berhasil: number, gagal: string[]}>}
 */
async function terapkanUsulanBerurutan(dipilih, jatiDiri, lapor, opsi) {
  const kabar = typeof lapor === "function" ? lapor : () => {};
  const ringkasan = { berhasil: 0, gagal: [] };

  for (let i = 0; i < dipilih.length; i += 1) {
    const x = dipilih[i];
    kabar(`Menyimpan ${x.usulan.nama} (${i + 1} dari ${dipilih.length})…`);
    try {
      const nilaiDipakai = x.nilai();
      const sebelum = (barisVariabel().get(x.usulan.kode) || {}).nilai || "";
      const hasil = await simpanVariabel(x.usulan.kode, nilaiDipakai, jatiDiri);
      if (hasil.ok) {
        ringkasan.berhasil += 1;
        // Riwayat menyebut SUNTINGANNYA. Tanpa itu, kalimat yang ditulis
        // petugas sendiri tercatat seolah-olah usulan mesin - dan yang
        // membacanya kelak tidak dapat membedakan mana yang diperiksa
        // manusia dan mana yang lolos begitu saja.
        const asalUsulan =
          x.usulan.sumber && x.usulan.sumber[0] && x.usulan.sumber[0].asal === "ktp-ecourt"
            ? "usulan dari berkas KTP e-Court (dibaca mesin)"
            : x.usulan.sumber && x.usulan.sumber[0] && x.usulan.sumber[0].asal === "gugatan-ecourt"
            ? `usulan dari surat gugatan e-Court (${x.usulan.keyakinan})`
            : x.usulan.sumber && x.usulan.sumber[0] && x.usulan.sumber[0].asal === "posita"
            ? `usulan dari posita permohonan (${x.usulan.keyakinan})`
            : x.usulan.sumber && x.usulan.sumber[0] && x.usulan.sumber[0].saksi
            ? `usulan dari keterangan saksi (${x.usulan.keyakinan})`
            : `usulan dari SIPP (${x.usulan.keyakinan})`;
        const bunyi = typeof x.bunyiDipilih === "function" ? x.bunyiDipilih() : "";
        void catatRiwayat({
          perkaraId: jatiDiri.perkaraId,
          kode: x.usulan.kode,
          nama: x.usulan.nama,
          sebelum,
          sesudah: hasil.nilaiTersimpan ?? nilaiDipakai,
          cara: bunyi && !x.disunting()
            ? `bunyi "${bunyi}" dipilih petugas dari pilihan ALETA (${x.usulan.keyakinan})`
            : x.disunting()
            ? x.usulan.nilai
              ? `${asalUsulan}, disunting petugas sebelum disimpan`
              : "diketik petugas di panel ALETA"
            : asalUsulan,
          pada: new Date().toISOString(),
          /* === KAMUS-DB 10 Okt === D2 jejak koreksi (lihat d2Koreksi) */
          koreksi: d2Koreksi(x, asalUsulan, bunyi, opsi),
          /* === AKHIR KAMUS-DB === */
        });
        const item = barisVariabel().get(x.usulan.kode);
        if (item) item.selNilai.textContent = hasil.nilaiTersimpan ?? nilaiDipakai;
        x.centang.checked = false;
        x.centang.disabled = true;
      } else {
        ringkasan.gagal.push(`${x.usulan.kode}: ${hasil.pesan}`);
      }
    } catch (galat) {
      ringkasan.gagal.push(`${x.usulan.kode}: ${String((galat && galat.message) || galat)}`);
    }
  }
  return ringkasan;
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
  const rusak = [];

  // ==========================================================================
  // GALAT DIPERIKSA PADA SELURUH VARIABEL, BUKAN HANYA YANG TURUNAN
  // ==========================================================================
  //
  // Dulu pemeriksaan galat hanya berjalan atas VAR_OTOMATIS - lima nomor
  // yang didaftarkan tangan. Variabel lain yang mengeluarkan bunyi mesin
  // lolos begitu saja, dan ia ikut tercetak sebagai pertimbangan hukum.
  //
  // Sekarang tiap baris yang tergambar diperiksa, apa pun nomornya - sebab
  // yang menentukan bukan nomor variabelnya melainkan bunyi isinya.
  for (const [kode, item] of peta) {
    // Perbaikan 1 Okt butir 10 (UI Baru saja): variabel yang diisi ABT
    // sendiri sesudah Input belum dihitung error - lihat a1GalatDitunda.
    if (a1GalatDitunda(kode)) continue;
    if (keadaanNilai(item.nilai) === "galat") rusak.push(`${kode} ${item.nama}`);
  }

  // ==========================================================================
  // KOSONG HANYA DIPERIKSA PADA KERANGKA FAKTA, DAN SEBABNYA
  // ==========================================================================
  //
  // Variabel kosong itu WAJAR pada perkara yang memang tidak memerlukannya:
  // 8523 (pertimbangan kuasa) kosong pada perkara tanpa kuasa, 8524
  // (pertimbangan PNS) kosong pada pihak yang bukan PNS. Memeriksa seluruh
  // baris akan menahan hampir tiap pencetakan dengan daftar yang tidak
  // seharusnya diisi - dan penjaga yang selalu berbunyi berhenti dibaca.
  //
  // Yang diperiksa karena itu hanya kerangka faktanya: ketiga belas nomor
  // yang menyuapi variabel otomatis. Kosongnya yang itu memang berarti
  // pertimbangannya tidak punya bahan.
  for (const kode of VARIABEL_SASARAN) {
    const item = peta.get(kode);
    if (!item) continue;
    // Yang bergalat sudah masuk daftar rusak di atas - jangan disebut dua
    // kali dengan dua nama yang berbeda untuk satu keadaan yang sama.
    if (keadaanNilai(item.nilai) === "kosong") kurang.push(`${kode} ${item.nama}`);
  }

  return { kurang, rusak };
}

/**
 * ============================================================================
 * PENANDA TIGA BERKAS DI SAMPING TOMBOL CETAK
 * ============================================================================
 *
 * Saklarnya ada di popup ikon ekstensi - satu jendela yang hampir tidak
 * pernah dibuka. Akibatnya keadaannya tidak dapat diketahui dari halaman
 * tempat tombolnya ditekan: yang menekan CETAK tidak tahu apakah ia akan
 * mendapat satu berkas atau tiga sampai berkasnya benar-benar turun.
 *
 * Untuk tombol yang mengubah arti tombol milik aplikasi lain, itu terbalik.
 * Keadaannya harus terbaca DI SEBELAH tombolnya, sebelum ditekan.
 *
 * Penandanya hanya digambar ketika saklarnya MENYALA. Penanda yang selalu
 * ada - menyala atau tidak - menuntut orang membaca tulisannya untuk tahu
 * keadaannya, dan itu satu langkah lebih banyak daripada yang diperlukan.
 */
const KELAS_PENANDA_CETAK = "aleta-cetak-tiga";

function segarkanPenandaCetak() {
  for (const tautan of Array.from(document.querySelectorAll('a[href*="abt/preview"]'))) {
    const induk = tautan.parentElement || tautan;
    let tanda = induk.querySelector("." + KELAS_PENANDA_CETAK);

    if (!cetakTigaMenyala) {
      if (tanda) tanda.remove();
      continue;
    }
    if (tanda) continue;

    tanda = buatElemen("span", KELAS_PENANDA_CETAK);
    tanda.title =
      "ALETA aktif: satu tekanan CETAK menerbitkan tiga berkas - putusan .rtf, " +
      "PDF hasil konversi, dan anonim .rtf. Matikan dari popup ikon ALETA.";
    // Angka 3 dan lambang berkas: dibaca dalam sekejap, tanpa membaca kata.
    tanda.appendChild(buatElemen("span", "aleta-cetak-tiga-angka", "3"));
    tanda.appendChild(buatElemen("span", "aleta-cetak-tiga-ikon", "🗎"));
    // Disisipkan SESUDAH tautannya, bukan di dalamnya: menyisipkan anak ke
    // dalam tautan CETAK membuat tekanan pada penandanya ikut mencetak.
    if (tautan.nextSibling) induk.insertBefore(tanda, tautan.nextSibling);
    else induk.appendChild(tanda);
  }
}

function pasangPenjagaCetak(jatiDiri, lapor) {
  segarkanPenandaCetak();
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
        // Dialog Tahap 6 (ide abt-5) sudah menanyakan hal yang sama dan
        // petugas mengonfirmasinya - tidak ditanya dua kali. Selalu false
        // dalam tampilan Lama.
        if (t6LewatiPenjagaLama()) return;
        const { kurang, rusak } = periksaKelengkapan();
        if (kurang.length === 0 && rusak.length === 0) return;

        const baris = (daftar) => daftar.map((x) => `  - ${x}`).join("\n");
        const pesan = [
          "ALETA menahan pencetakan sebentar.",
          "",
          rusak.length
            ? `${rusak.length} variabel OTOMATIS masih berbunyi pesan error, dan itu akan IKUT TERCETAK sebagai pertimbangan hukum:\n${baris(rusak)}`
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

      // ====================================================================
      // DITAHAN DULU, DIBUKTIKAN KEMUDIAN - DAN URUTAN ITU DISENGAJA
      // ====================================================================
      //
      // Salinan di memori dapat BASI: tab yang dibekukan peramban tidak
      // menerima chrome.storage.onChanged, panel yang ditutup lalu dibuka
      // melewati muatSaklarCetak, dan ekstensi yang dimuat ulang
      // meninggalkan tab lama tanpa pendengar sama sekali. Pada ketiganya
      // salinannya tetap menyala walau saklarnya sudah dimatikan - dan
      // itulah keluhan 23 September 2026: dimatikan, tetapi tetap tiga
      // berkas.
      //
      // Klik tetap ditahan lebih dulu, sebab menahannya kemudian sudah
      // terlambat - halamannya keburu berpindah. Sesudah ditahan, saklarnya
      // dibaca ULANG dari penyimpanan; bila ternyata mati, tautan ABT-nya
      // dijalankan sendiri sehingga petugas tetap mendapat blangkonya, satu
      // berkas, sebagaimana yang dimintanya.
      peristiwa.preventDefault();
      void (async () => {
        if (await saklarCetakSekarang()) {
          void terbitkanTigaBerkas(tautan.href, jatiDiri, lapor);
          return;
        }
        // Dijalankan seperti tautan biasa - bukan window.open, yang tertahan
        // pemblokir popup, dan bukan location.assign, yang menukar halaman
        // blangko yang sedang dikerjakan petugas dengan halaman unduhan.
        const pengganti = document.createElement("a");
        pengganti.href = tautan.href;
        pengganti.rel = "noopener";
        if (tautan.target) pengganti.target = tautan.target;
        document.body.appendChild(pengganti);
        pengganti.click();
        pengganti.remove();
      })();
    });
  }
}

async function mintaUsulan(muatan) {
  const respons = await alatAmbil(ALETA_API_ABT, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(muatan),
  }, "Membaca usulan");
  if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Membaca usulan"));
  const luar = await respons.json();
  const isi = luar?.data ?? luar;
  if (!isi?.available) throw new Error(isi?.message || alatPesanGagal(null, 0, "Membaca usulan"));
  // Keterangan perkara ditumpangkan pada jawaban ini sejak 2.20.4 - jenis
  // perkara dan status putusannya, yang menyusun nama berkas. Diingat di sini,
  // pada satu tempat yang dilewati SELURUH pemanggil, bukan di tiap pemanggil.
  ingatKeteranganPerkara(muatan?.nomorPerkara, isi?.sipp?.keteranganPerkara);
  return isi;
}

/**
 * Menyimpan jenis perkara dan status putusan satu perkara.
 *
 * Tidak menimpa dengan yang KOSONG: papan massal mengisinya dari daftar
 * sidang, dan permintaan usulan atas perkara yang belum putus tidak boleh
 * menghapus status yang sudah terbaca di sana.
 */
function ingatKeteranganPerkara(nomorPerkara, keterangan) {
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor || !keterangan) return;
  const lama = statusPutusanPerkara.get(nomor) || {};
  statusPutusanPerkara.set(nomor, {
    jenisPerkara: String(keterangan.jenisPerkara || "").trim() || lama.jenisPerkara || "",
    statusPutusan: String(keterangan.statusPutusan || "").trim() || lama.statusPutusan || "",
    verstek: keterangan.verstek === undefined ? Boolean(lama.verstek) : Boolean(keterangan.verstek),
  });
}

/**
 * ============================================================================
 * PITA IDENTITAS PANEL ABT - SAMA BENTUKNYA DENGAN PANEL SIPP
 * ============================================================================
 *
 * Yang diminta petugas: siapa yang masuk ALETA, nomor perkara, jenis perkara,
 * dan seri ekstensi terbaca di kepala DAN di kaki, pada letak dan huruf yang
 * sama di panel mana pun - termasuk panel blangko ABT ini. Kelas dan urutannya
 * persis milik konten.js (pitaIdentitas); yang berbeda hanya sumbernya:
 * halaman ABT tidak menulis akun SIPP di mana pun, jadi ruas itu tidak ada.
 *
 * Nama pengguna ALETA datang dari portal dan datangnya menyusul; pita digambar
 * dulu tanpa nama, lalu digambar ulang begitu jawabannya tiba. Panel tidak
 * menunggu jaringan hanya untuk menuliskan satu nama.
 */
let penggunaAletaAbt = null;
/**
 * Kemampuan ekstensi yang diberikan portal kepada orang ini.
 *
 * Dipakai menyembunyikan tombol yang akan ditolak. Itu KENYAMANAN, bukan
 * penjagaan - rutenya memeriksa ulang sendiri, dan harus, sebab berkas ini
 * berjalan di peramban petugas dan dapat diubah siapa saja yang memasangnya.
 *
 * Selama jawabannya belum tiba, tombolnya dibiarkan tampak. Menyembunyikannya
 * lebih dulu lalu memunculkannya membuat panel berkedip pada setiap pemuatan
 * bagi orang yang justru berwenang - yaitu hampir semua orang yang membuka
 * halaman blangko.
 */
let kapabilitasAletaAbt = null;

function bolehAbt(kunci) {
  if (!kapabilitasAletaAbt) return true;
  return kapabilitasAletaAbt[kunci] !== false;
}

async function muatPenggunaAleta() {
  if (penggunaAletaAbt) return penggunaAletaAbt;
  try {
    const isi = await mintaUsulan({ nomorPerkara: nomorPerkaraAbt(), sumber: "siapa" });
    penggunaAletaAbt = isi && isi.pengguna && isi.pengguna.nama ? isi.pengguna : null;
    kapabilitasAletaAbt = (isi && isi.kapabilitas) || null;
  } catch {
    penggunaAletaAbt = null;
  }
  return penggunaAletaAbt;
}

/**
 * ALUR perkara dari nomornya: Pdt.G gugatan, Pdt.P permohonan.
 *
 * Namanya dulu jenisPerkaraDariNomor, dan nama itu MENJANJIKAN yang tidak
 * dikerjakannya. Yang dibacanya kode pada nomor perkara, dan kode itu hanya
 * memisahkan gugatan dari permohonan - dua alur, bukan jenis.
 *
 * Jenis perkara adalah "Cerai Gugat", "Dispensasi Kawin", "Pengesahan
 * Perkawinan/Istbat Nikah" - dan tidak satu pun dapat diturunkan dari
 * nomornya. Seluruh perkara Pdt.P memakai kode yang sama, entah ia istbat
 * nikah, dispensasi kawin, atau penetapan ahli waris.
 *
 * Dipertahankan sebagai CADANGAN TERAKHIR: perkara yang variabel 0048-nya
 * belum terbaca tetap mendapat sesuatu, walau kasar.
 */
function alurPerkaraDariNomor(nomor) {
  const teks = String(nomor || "");
  if (/Pdt\.G/i.test(teks)) return "Gugatan";
  if (/Pdt\.P/i.test(teks)) return "Permohonan";
  return "";
}

function pitaIdentitasAbt(pengguna) {
  const pita = buatElemen("div", "aleta-identitas-panel");
  const tambah = (kelas, label, teks, judul) => {
    const kotak = buatElemen("span", kelas);
    if (label) kotak.appendChild(buatElemen("span", "aleta-id-label", label));
    kotak.appendChild(document.createTextNode(teks));
    if (judul) kotak.title = judul;
    pita.appendChild(kotak);
  };
  if (pengguna && pengguna.nama) {
    const peran = pengguna.peran ? ` (${pengguna.peran})` : "";
    tambah("aleta-id-akun aleta-id-aleta", "ALETA", String(pengguna.nama), `Masuk ke ALETA sebagai ${pengguna.nama}${peran}.`);
  }
  const nomor = nomorPerkaraAbt();
  if (nomor) tambah("aleta-id-nomor", "", nomor, "Nomor perkara pada blangko yang sedang dibuka.");
  // ==========================================================================
  // JENIS PERKARA, BUKAN ALURNYA
  // ==========================================================================
  //
  // Diminta pengguna 23 September 2026: "ganti dari keterangan di abt ekstensi
  // aleta dari alur perkara (contoh permohonan dan gugatan) jadi jenis perkara
  // (contoh cerai gugat atau dispensasi kawin)".
  //
  // "Permohonan" benar tetapi tidak menerangkan apa pun: seluruh perkara Pdt.P
  // berbunyi begitu, entah istbat nikah, dispensasi kawin, atau penetapan ahli
  // waris. Yang membaca kepala panel sedang memastikan ia membuka blangko yang
  // tepat, dan untuk itu alurnya tidak cukup.
  //
  // Sumbernya berjenjang, dari yang paling pasti:
  //
  //   1. variabel 0048 pada halaman blangko - "Jenis Perkara" menurut SIPP
  //      sendiri (perkara.jenis_perkara_nama). Dibaca langsung dari DOM,
  //      seketika, tanpa satu permintaan jaringan pun.
  //   2. peta keterangan perkara - terisi sesudah ada permintaan ke ALETA,
  //      jadi ia cadangan, bukan sumber utama.
  //   3. alur dari nomornya - kasar, tetapi lebih baik daripada kosong.
  const jenis =
    nilaiVariabel(VAR_JENIS_PERKARA) || sebutJenisPerkara(nomor) || alurPerkaraDariNomor(nomor);
  if (jenis) {
    tambah(
      "aleta-id-jenis",
      "",
      jenis,
      "Jenis perkara menurut SIPP (variabel 0048 pada blangko ini)."
    );
  }
  // Seri ekstensi tidak lagi di pita - ia pindah ke baris kaki, satu
  // tempat untuk ketiga panel.
  return pita;
}

/**
 * ============================================================================
 * KETERANGAN DUA SAKSI YANG "SAMA DENGAN GUGATAN"
 * ============================================================================
 *
 * Templat tanya-jawabnya milik ABT, dan diambil lewat halaman penyunting ABT
 * sendiri: halaman tanyajawab_perkara_edit menawarkan daftar templat untuk
 * jenis perkara ini, dan mengirim load_template=<kode> kepadanya mengembalikan
 * pertanyaan-jawaban templat itu dengan variabel perkaranya SUDAH terganti.
 * ALETA tetap tidak membaca basis data aps_badilag; yang membaca halaman ini
 * adalah peramban petugas, dengan sesi petugas itu sendiri.
 *
 * Portal lalu menyusun dua keterangan dari templat yang satu itu - saksi 1 dan
 * saksi 2 dengan substansi yang sama dan kalimat yang berbeda - dan hasilnya
 * digambar di sini untuk dibaca dan disunting SEBELUM disimpan. Menyimpan
 * memakai rute simpan ABT sendiri, yang menghapus lalu menulis ulang
 * tanya-jawab sidang itu: karena itu sidang yang sudah memuat keterangan
 * disebut terang-terangan sebelum tombolnya ditekan.
 */

/**
 * Cermin CIRI_ALASAN_SDG di abtUsulanService - kunci alasan yang bot ucapkan
 * sebagai keterangan saksi. Tujuh yang terakhir dibuka 26 September 2026
 * (permintaan pengguna 1 dan 7) sesudah bunyinya diambil dari korpus BAS
 * petugas; urutannya ditambahkan di belakang agar urutan sembilan yang lama
 * tidak bergeser.
 */
const DAFTAR_ALASAN_SDG = [
  "perselisihan terus-menerus",
  "kekerasan dalam rumah tangga",
  "tidak memberi nafkah",
  "pihak lain (wanita/pria idaman lain)",
  "cemburu",
  "obat terlarang",
  "judi",
  "mabuk",
  "murtad/pindah agama",
  "temperamental",
  "berkata kasar",
  "bersikap kasar",
  "malas bekerja",
  "tidak memiliki pekerjaan tetap",
  "masalah ekonomi",
  "menikah lagi",
];

/**
 * ============================================================================
 * PILIHAN ALASAN SAKSI - DARI PORTAL, DENGAN CADANGAN ENAM BELAS TERTANAM
 * ============================================================================
 *
 * Daftar bas.saksi.alasan-pilihan dapat ditambah admin di portal (zina,
 * pidana penjara, cacat badan, pelanggaran taklik talak - ciri yang bot sudah
 * kenal). DAFTAR_ALASAN_SDG di atas tetap cadangan terakhir: portal mati dan
 * singgahan kosong berarti perilakunya sama persis dengan sebelum portal ada.
 * Nilainya dicerminkan portal (bawaan-ekstensi.ts) - jangan disunting tanpa
 * menyunting cerminnya.
 *
 * Yang dikirim ke bot KUNCI cirinya; labelnya hanya untuk dibaca petugas.
 *
 * @returns {Promise<{pilihan: {kunci: string, label: string}[], asal: string}>}
 */
async function muatAlasanSdg() {
  const tertanam = DAFTAR_ALASAN_SDG.map((a, urutan) => ({ kunci: a, nilai: a, data: {}, urutan, asal: "bawaan", sidik: "" }));
  const hasil = await alatTipeKeluaran("bas.saksi.alasan-pilihan", { tertanam });
  const pilihan = [];
  const sudah = new Set();
  for (const e of hasil.entri) {
    const kunci = String(e.kunci || "").trim();
    if (!kunci || sudah.has(kunci)) continue;
    sudah.add(kunci);
    pilihan.push({ kunci, label: String(e.nilai || "").trim() || kunci });
  }
  return { pilihan, asal: hasil.asal };
}

/**
 * ============================================================================
 * VARIABEL TANYA-JAWAB TIAP SAKSI - DIBACA DARI aps_badilag.abt_variabel
 * ============================================================================
 *
 * Diverifikasi 26 September 2026 dengan SELECT atas abt_variabel (data_type
 * tanya_jawab) dan variabel referensinya:
 *
 *   2021  Keterangan Saksi 1 P   referensi 1197  saksi_pihak_ke=1 limit 0,1
 *   2022  Keterangan Saksi 2 P   referensi 1203  saksi_pihak_ke=1 limit 1,1
 *   2031  Keterangan Saksi 3 P   referensi 6132  saksi_pihak_ke=1 limit 2,1
 *   6124  TanyaJwb Saksi 4 P     referensi 6144  saksi_pihak_ke=1 limit 3,2
 *   2023  Keterangan Saksi 1 T   referensi 6100  saksi_pihak_ke=2 limit 0,1
 *   2024  Keterangan Saksi 2 T   referensi 6106  saksi_pihak_ke=2 limit 1,1
 *   2032  Keterangan Saksi 3 T   referensi 6138  saksi_pihak_ke=2 limit 2,1
 *
 * Rute penyunting ABT (tanyajawab_perkara_edit) menemukan saksinya lewat
 * NAMA dari variabel referensi itu (GetIdPerkaraPihak), jadi no_var inilah
 * yang menentukan baris saksi mana yang dihapus lalu ditulis ulang.
 *
 * Saksi ke-4 P tidak punya variabel 20xx; yang ada 6124 "TanyaJwb Saksi 4 P"
 * (referensinya 6144 = "Nama Saksi 4 P", yang limit 3,2-nya diambil baris
 * pertamanya oleh data_variabel_detil). Karena itu ia dilayani.
 *
 * YANG SENGAJA TIDAK DIPAKAI: 6122 "TanyaJwb Saksi 3 T" - referensinya 6132,
 * nama saksi 3 PENGGUGAT. Menyimpan lewat variabel itu akan menimpa
 * keterangan saksi yang salah. Saksi 3 T memakai 2032.
 *
 * Bot melayani sampai 4 saksi P dan 2 saksi T; 2032 dicatat untuk
 * kelengkapan pemetaan, tidak ditawarkan di borang.
 */
const VAR_SAKSI_TANYA_JAWAB = Object.freeze({
  P: Object.freeze(["2021", "2022", "2031", "6124"]),
  T: Object.freeze(["2023", "2024", "2032"]),
});

/** Variabel nama tiap saksi (referensi di atas) - dipakai menebak jumlah saksi dari blangko. */
const VAR_NAMA_SAKSI = Object.freeze({
  P: Object.freeze(["1197", "1203", "6132", "6144"]),
  T: Object.freeze(["6100", "6106", "6138"]),
});

/**
 * 1.184.0 (5 Okt, butir 23): "Susun keterangan saksi" juga dari halaman
 * blangko perkara ABT yang memakai variabel tanya-jawab saksi LAIN.
 *
 * Sampai 1.183.0 tombolnya hanya ada bila halaman memuat 2021 (Keterangan
 * Saksi 1 P). Blangko BAS memakai 5058 "TanyaJwb Saksi 1 P" (dan 5059/5060,
 * 6120-6122 untuk T) - petugas harus membuka penyunting tanya-jawab dulu.
 * Padahal ABT menyimpan keterangan saksi per NAMA saksi
 * (Abt_model::GetIdPerkaraPihak - perkara_pihak5 lewat referensi 1197),
 * bukan per nomor variabel: 5058 dan 2021 berbagi data yang sama, jadi
 * penyusun (yang menyimpan lewat no_var 2021) berlaku untuk keduanya.
 */
const A3_VAR_TANYA_JAWAB_SAKSI_LAIN = Object.freeze(["5058", "5059", "5060", "6120", "6121", "6122"]);

function a3BlangkoMemuatSaksi(peta) {
  if (!peta || typeof peta.has !== "function") return false;
  return [VAR_SAKSI_1, VAR_SAKSI_2, ...VAR_SAKSI_TANYA_JAWAB.P, ...VAR_SAKSI_TANYA_JAWAB.T, ...A3_VAR_TANYA_JAWAB_SAKSI_LAIN, ...VAR_NAMA_SAKSI.P, ...VAR_NAMA_SAKSI.T].some((k) =>
    peta.has(k)
  );
}

/** Keterangan saksi 1 P yang tergambar di halaman: 2021, atau 5058 di blangko BAS. */
function a3NilaiSaksi1() {
  return nilaiVariabel(VAR_SAKSI_1) || nilaiVariabel("5058");
}

/** Batas saksi per pihak yang dilayani penyusun bot (K6, keputusan 15). */
const BATAS_SAKSI_SDG = Object.freeze({ P: 4, T: 2 });

/** Variabel tanya-jawab saksi ke-`ke` pihak `pihak` ('P'|'T'), atau "" bila tidak ada. */
function variabelSaksiSdg(pihak, ke) {
  const daftar = VAR_SAKSI_TANYA_JAWAB[pihak === "T" ? "T" : "P"];
  const n = Number(ke);
  return Number.isInteger(n) && n >= 1 && n <= daftar.length ? daftar[n - 1] : "";
}

/**
 * Sebutan pihak yang bercerita kepada saksi, dari sebutan blangko ini sendiri.
 * pelaku = 0047 = Tergugat/Termohon; lawan = 0046 = Penggugat/Pemohon.
 */
function sebutanSumberSdg(kode, pelaku, lawan) {
  if (kode === "keluarga") return "keluarga mereka";
  if (kode === "tergugat") return String(pelaku || "").trim() || "Tergugat";
  return String(lawan || "").trim() || "Penggugat";
}

/**
 * Nama jenis perkara SIPP (perkara.jenis_perkara_nama, variabel 0048) -> id.
 * Dibaca 26 September 2026 dengan SELECT DISTINCT atas sipp_donggala dan
 * sipp. Bentuk bersyarat (data.syarat.jenisPerkaraId) dan perkara lain
 * (abtUsulanLainService.kenaliJenis) membandingkan ID, bukan nama.
 */
const ID_JENIS_PERKARA_SIPP = Object.freeze({
  "izin poligami": "341",
  "pencegahan perkawinan": "342",
  "penolakan perkawinan": "343",
  "pembatalan perkawinan": "344",
  "cerai talak": "346",
  "cerai gugat": "347",
  "harta bersama": "348",
  "penguasaan anak": "349",
  "pengesahan anak": "352",
  perwalian: "354",
  "asal usul anak": "358",
  "istbat nikah": "360",
  "pengesahan perkawinan/istbat nikah": "360",
  "dispensasi kawin": "362",
  "wali adhol": "363",
  kewarisan: "364",
  wasiat: "365",
  wakaf: "367",
  "lain-lain": "369",
  "lain-lain *)": "369",
  "ekonomi syariah": "370",
  "p3hp/penetapan ahli waris": "371",
});

/** Id jenis perkara SIPP dari namanya; nama apa adanya bila tidak dikenal. */
function idJenisPerkaraSipp(nama) {
  const bersih = String(nama || "").replace(/\s+/g, " ").trim();
  return ID_JENIS_PERKARA_SIPP[bersih.toLowerCase()] || bersih;
}

/** alur_perkara_id SIPP dari nomor perkara: 15 gugatan, 16 permohonan, 17 gugatan sederhana. */
function idAlurPerkaraSipp(nomor) {
  const teks = String(nomor || "");
  if (/Pdt\.G\.S\b/i.test(teks)) return "17";
  if (/Pdt\.G\b/i.test(teks)) return "15";
  if (/Pdt\.P\b/i.test(teks)) return "16";
  return "";
}

/**
 * Nilai variabel 1268 yang layak dikirim sebagai upayaDamai (butir 28).
 * ABT menulis "DATA_TIDAK_ADA" untuk variabel yang kuerinya tidak menemukan
 * apa-apa; itu, isian tanpa huruf ("...", "_"), dan variabel yang belum
 * terganti ("#1268#") bukan keterangan - dikirim kosong supaya bot memakai
 * sumber berikutnya.
 */
function nilaiUpayaDamai(nilai) {
  const t = String(nilai == null ? "" : nilai).trim();
  if (!t || /DATA_TIDAK_ADA/i.test(t)) return "";
  if (!/[A-Za-z]/.test(t.replace(/#\d{4}#/g, ""))) return "";
  return t;
}

/**
 * Muatan permintaan 'saksi-sdg' (K6). Fungsi murni - diuji langsung.
 *
 *   saksi  [{pihak 'P'|'T', ke, modus, sumber, alasan[]}] dalam urutan borang
 *
 * sumberNama selalu ikut, untuk ketiga pilihan pencerita: sebutan yang
 * sungguh tertulis di blangko ini, supaya bot tidak menafsirkan kode.
 * modus.saksi1/saksi2 tetap dikirim untuk bot lama yang belum mengenal saksi[].
 */
function susunMuatanSdg(o) {
  const r = o && typeof o === "object" ? o : {};
  const saksi = (Array.isArray(r.saksi) ? r.saksi : []).map((s) => ({
    ke: Number(s.ke),
    pihak: s.pihak === "T" ? "T" : "P",
    modus: String(s.modus || "sama"),
    sumber: String(s.sumber || "penggugat"),
    sumberNama: sebutanSumberSdg(String(s.sumber || "penggugat"), r.pelaku, r.lawan),
    alasan: Array.isArray(s.alasan) ? s.alasan.map(String) : [],
  }));
  const polos = (s) => (s ? { modus: s.modus, sumber: s.sumber, sumberNama: s.sumberNama, alasan: s.alasan } : undefined);
  const saksiP = saksi.filter((s) => s.pihak === "P");
  return {
    nomorPerkara: String(r.nomorPerkara || ""),
    sumber: "saksi-sdg",
    templat: Array.isArray(r.templat) ? r.templat : [],
    kodeKumpulan: String(r.kodeKumpulan || ""),
    jenisPerkara: String(r.jenisPerkara || ""),
    alur: String(r.alur || ""),
    alasan: Array.isArray(r.alasan) ? r.alasan : [],
    posita: String(r.posita || ""),
    pelaku: String(r.pelaku || ""),
    lawan: String(r.lawan || ""),
    // Butir 28: nilai variabel 1268 (Upaya Damai Keluarga) - sumber pertama
    // jawaban pertanyaan upaya rukun. Ruasnya hanya ikut bila berisi, supaya
    // muatan tampilan Lama tetap persis seperti sebelumnya; tanpa ruas ini bot
    // membaca posita lalu mediasi SIPP.
    ...(nilaiUpayaDamai(r.upayaDamai) ? { upayaDamai: nilaiUpayaDamai(r.upayaDamai) } : {}),
    modus: { saksi1: polos(saksiP[0] || saksi[0]), saksi2: polos(saksiP[1] || saksi[1]) },
    saksi,
  };
}

/**
 * Templat MENTAH - sebelum variabelnya diganti ABT - dari penyunting templat
 * ABT (GET tanyajawab_template_edit?kode=..., tanpa aksi: hanya membaca).
 * load_template memberikan jawaban yang sudah terganti ("ibu kandung /
 * tetangga"); hanya dari bentuk mentahnya ("#1241# / #1242#") bot tahu
 * dengan pasti bahwa satu jawaban itu milik DUA saksi.
 *
 * Kode '#<id>' (salinan keterangan saksi lain) tidak punya templat mentah.
 *
 * @returns {Promise<Map<string, string>>} nomor urut -> jawaban mentah
 */
async function muatTemplatMentahAbt(kodeKumpulan) {
  const kode = String(kodeKumpulan || "");
  if (!kode || kode.startsWith("#")) return new Map();
  const respons = await fetch(`${asalAbt()}/tanyajawab_template_edit?kode=${encodeURIComponent(kode)}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!respons.ok) throw new Error(`ABT menjawab ${respons.status}`);
  const teks = await respons.text();
  const cocok = teks.match(/var\s+ajax_data\s*=\s*([[{][\s\S]*?[\]}])\s*(?:\r?\n|;)/);
  if (!cocok) throw new Error("templat mentah tidak terbaca dari halaman ABT");
  let urai;
  try {
    urai = JSON.parse(cocok[1]);
  } catch {
    throw new Error("templat mentah tidak dapat diurai");
  }
  const baris = Array.isArray(urai) ? urai : urai && typeof urai === "object" ? Object.values(urai) : [];
  const peta = new Map();
  baris.forEach((b, i) => {
    const no = String((b && b.urutan_pertanyaan) || i + 1);
    peta.set(no, String((b && b.jawaban) || ""));
  });
  return peta;
}

/**
 * ============================================================================
 * PERKARA LAIN - VARIABEL YANG LULUS GERBANG UKUR
 * ============================================================================
 *
 * Cermin abtUsulanLainService.VARIABEL_SIAP (26 September 2026: dispensasi
 * kawin 0606, 0600, 0607, 0601, 5178; perwalian, asal usul, dan harta bersama
 * belum punya satu pun). Ujinya membandingkan keduanya: bila bot menambah
 * variabel siap, uji merah sampai cermin ini ikut. Yang masuk hanya variabel
 * yang keputusan sumber terukur bot memilih ALETA: lulus gerbang DAN tidak
 * lebih buruk dari bawaan ABT pada perkara yang sama (DK 5178: ALETA 6/7,
 * bawaan #10103# 0/7).
 *
 * Tombol "Isi dari posita permohonan" untuk perkara lain tergambar hanya bila
 * blangko memuat variabel siap MILIK JENIS PERKARANYA (0048). 5178 juga ada
 * di blangko itsbat, perwalian, dan asal usul - di sana tombol ini hanya
 * akan menjawab "belum dilayani" atau kosong, dan tombol yang ditekan lalu
 * menjawab "belum ada aturan" lebih buruk daripada tombol yang tidak ada.
 * Jenis yang tidak terbaca = tidak tergambar.
 */
const VARIABEL_SIAP_POSITA_LAIN = Object.freeze({
  "dispensasi-kawin": Object.freeze(["0606", "0600", "0607", "0601", "5178"]),
  perwalian: Object.freeze([]),
  "asal-usul": Object.freeze([]),
  "harta-bersama": Object.freeze([]),
});

/** Kunci jenis perkara lain dari nama atau id SIPP (cermin kenaliJenis bot); null bila bukan/ tak terbaca. */
const KUNCI_JENIS_LAIN = Object.freeze({ 362: "dispensasi-kawin", 354: "perwalian", 358: "asal-usul", 348: "harta-bersama" });
function kunciJenisLain(namaAtauId) {
  const teks = String(namaAtauId || "").replace(/\s+/g, " ").trim();
  if (!teks) return null;
  const id = idJenisPerkaraSipp(teks);
  if (KUNCI_JENIS_LAIN[id]) return KUNCI_JENIS_LAIN[id];
  if (/dispensasi/i.test(teks)) return "dispensasi-kawin";
  if (/perwalian/i.test(teks)) return "perwalian";
  if (/asal\s*-?\s*usul/i.test(teks)) return "asal-usul";
  if (/harta[\s-]+bersama|gono\s*-?\s*gini/i.test(teks)) return "harta-bersama";
  return null;
}

/* === JENIS3 11 Okt === */
/**
 * Variabel ABT yang dikenali kamus per jenis perkara (aleta_bot/kamus-deteksi/awal/<kelompok>.json,
 * pola berkunci nomor variabel) - cermin, dijaga uji deteksi-semua-jenis-11okt.test.ts. Kunci = id
 * jenis perkara SIPP. Hanya untuk menggambar tombol "Isi dari posita permohonan"; yang diusulkan
 * dan keyakinannya tetap diputuskan bot.
 */
const J3_VARIABEL_JENIS = Object.freeze({
  341: Object.freeze([]),
  348: Object.freeze([]),
  349: Object.freeze([]),
  352: Object.freeze(["5110"]),
  354: Object.freeze(["8171", "5110"]),
  358: Object.freeze(["8171", "1357", "1025"]),
  360: Object.freeze(["8171", "1357", "1025"]),
  362: Object.freeze(["1014", "0604", "2029", "2030"]),
  363: Object.freeze(["1029", "1030", "6087", "1046", "1217"]),
  364: Object.freeze(["1025", "1247", "1509", "8171"]),
  365: Object.freeze(["1025", "1247", "1509", "8171"]),
  370: Object.freeze([]),
  371: Object.freeze(["1025", "1247", "1509", "8171"]),
});

/** Blangko memuat variabel kamus per jenis untuk jenis perkara ini (nama atau id SIPP)? */
function j3BlangkoMemuatVariabelJenis(petaVariabel, namaAtauId) {
  if (!petaVariabel || typeof petaVariabel.has !== "function") return false;
  const id = idJenisPerkaraSipp(String(namaAtauId || "").replace(/\s+/g, " ").trim());
  const daftar = J3_VARIABEL_JENIS[id];
  return Boolean(daftar) && daftar.some((k) => petaVariabel.has(k));
}
/* === AKHIR JENIS3 === */

/** Blangko ini memuat sekurang-kurangnya satu variabel siap MILIK jenis perkara ini? */
function blangkoMemuatVariabelSiapLain(petaVariabel, kunciJenis) {
  if (!petaVariabel || typeof petaVariabel.has !== "function") return false;
  const daftar = VARIABEL_SIAP_POSITA_LAIN[kunciJenis];
  return Boolean(daftar) && daftar.some((k) => petaVariabel.has(k));
}

/**
 * Kabar sesudah "Isi dari posita permohonan" perkara lain - HANYA variabel
 * yang ADA di blangko yang sedang dibuka (blangko Cabut DK tidak memuat
 * 5178, 1666, 1551, 0999; menyebutnya hanya membingungkan).
 *
 * Bawaan ABT disebut apa adanya: ABT MENAWARKAN isian bawaan dari kuerinya
 * di kotak popup, yang baru tersimpan bila petugas membuka dan menyimpannya -
 * bukan "diisi otomatis".
 */
function kabarPositaLain(lain, petaVariabel) {
  const ada = (k) => Boolean(petaVariabel && typeof petaVariabel.has === "function" && petaVariabel.has(k));
  const hasil = lain || {};
  const bawaan = (hasil.bawaanAbt || []).filter((b) => ada(b.kode)).map((b) => `${b.kode} dari kueri #${b.acuan}#`);
  const belum = (hasil.belumSiap || []).filter((b) => ada(b.kode)).map((b) => `${b.kode} (${b.alasan})`);
  return [
    hasil.catatan || "",
    bawaan.length ? `ABT menawarkan isian bawaan, tidak diusulkan ALETA - periksa sebelum menyimpan: ${bawaan.join(", ")}.` : "",
    belum.length ? `Belum lulus gerbang ukur, tidak diusulkan: ${belum.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Daftar templat yang ditawarkan ABT pada halaman penyunting keterangan saksi 1. */
async function daftarTemplatAbt(urutan) {
  const respons = await fetch(alamatTanyaJawab(VAR_SAKSI_1, false, urutan), {
    credentials: "include",
    cache: "no-store",
  });
  if (!respons.ok) throw new Error(`ABT menjawab ${respons.status}`);
  const teks = await respons.text();
  const hasil = [];
  const pola = /<option value='([^']+)'>\s*\(([^)]*)\)\s*([^<]*)<\/option>/g;
  let cocok;
  while ((cocok = pola.exec(teks)) !== null) {
    hasil.push({ nilai: cocok[1], kode: cocok[2].trim(), nama: cocok[3].trim() });
  }
  return hasil;
}

/** Baris templat dengan variabel perkara yang sudah diganti ABT. */
async function muatTemplatAbt(kodeTemplat, urutan) {
  const badan = new URLSearchParams();
  badan.set("load_template", kodeTemplat);
  const respons = await fetch(alamatTanyaJawab(VAR_SAKSI_1, false, urutan), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: badan.toString(),
  });
  if (!respons.ok) throw new Error(`ABT menjawab ${respons.status}`);
  const teks = await respons.text();

  // ==========================================================================
  // TEMPLAT DATANG SEBAGAI OBJEK, KETERANGAN TERSIMPAN SEBAGAI LARIK
  // ==========================================================================
  //
  // Halaman yang sama menuliskan ajax_data dari dua sumber yang berbeda, dan
  // bentuknya tidak sama. Terbaca dari model ABT:
  //
  //   GetKeteranganPihak(...)                    -> larik  [ {...}, {...} ]
  //   replace_array_template(...)                -> OBJEK  { "0":{...}, ... }
  //
  // replace_array_template berakhir "return (object)$data;" - dan itulah yang
  // dipanggil cabang load_template. Pola lama menuntut kurung siku, sehingga
  // membaca keterangan yang SUDAH tersimpan selalu berhasil sementara memuat
  // TEMPLAT selalu gagal dengan "templat tanya-jawab tidak terbaca" - satu
  // fungsi, dua jalur, dan hanya satu yang pernah dicoba.
  //
  // Keduanya kini diterima. Objek berkunci angka diurutkan menurut kuncinya,
  // bukan menurut urutan Object.values: yang menentukan urutan pertanyaan
  // adalah nomornya, dan urutan kunci objek tidak dijamin bahasa mana pun.
  const cocok = teks.match(/var\s+ajax_data\s*=\s*([[{][\s\S]*?[\]}])\s*(?:\r?\n|;)/);
  if (!cocok) throw new Error("templat tanya-jawab tidak terbaca dari halaman ABT");
  let urai;
  try {
    urai = JSON.parse(cocok[1]);
  } catch {
    throw new Error("templat tanya-jawab tidak dapat diurai");
  }
  let baris = [];
  if (Array.isArray(urai)) {
    baris = urai;
  } else if (urai && typeof urai === "object") {
    baris = Object.keys(urai)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => urai[k]);
  }
  if (baris.length === 0) throw new Error("templat itu tidak memuat satu pun pertanyaan.");
  return baris.map((b, i) => ({
    no: String((b && b.urutan_pertanyaan) || i + 1),
    tanya: String((b && b.pertanyaan) || ""),
    jawab: String((b && b.jawaban) || ""),
  }));
}

/** Menulis satu daftar tanya-jawab ke ABT lewat rute simpannya sendiri. */
async function kirimTanyaJawab(kodeVariabel, urutan, baris) {
  const badan = new URLSearchParams();
  badan.set("data", JSON.stringify(baris));
  await a2JedaTulis("simpan", alamatTanyaJawab(kodeVariabel, true, urutan));
  const respons = await fetch(alamatTanyaJawab(kodeVariabel, true, urutan), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: badan.toString(),
  });
  if (!respons.ok) return { ok: false, pesan: `ABT menjawab ${respons.status}.` };
  const jawab = await respons.text();
  if (!/Tanya\s*Jawab\s*Disimpan/i.test(jawab)) {
    return {
      ok: false,
      pesan: `ABT tidak mengatakan tersimpan: ${jawab.replace(/<[^>]*>/g, " ").trim().slice(0, 160)}`,
    };
  }
  return { ok: true, pesan: `${baris.length} tanya-jawab tersimpan.` };
}

/** Templat yang paling mungkin dimaksud, menurut blangko yang dibuka. */
function templatBawaan(daftar, itsbat) {
  const cari = (uji) => daftar.find((t) => uji(String(t.kode).toUpperCase()));
  if (itsbat) return cari((k) => k.startsWith("IN")) || daftar[0];
  return cari((k) => k === "04") || cari((k) => k === "A1") || daftar[0];
}

/**
 * Kartu "Alasan perceraian - yang siap dipakai dan yang belum" dari jawaban
 * usulan saksi. null bila tidak ada satu pun kelompok. Dipakai gambarSepihak
 * (tombol lama) dan rincian ⓘ lapisan perbaikan 30 Sep sore.
 */
function susunKartuAlasan(hasil) {
  const sepihak = (hasil && hasil.ciriSepihak) || [];
  const diluar = (hasil && hasil.ciriDiluarGugatan) || [];
  const belum = (hasil && hasil.ciriBelumTerbukti) || [];
  const terbukti = (hasil && hasil.ciri) || [];
  if (!sepihak.length && !diluar.length && !belum.length && !terbukti.length) return null;

  const kotak = buatElemen("div", "aleta-abt-kartu aleta-abt-kartu-awas");
  // ========================================================================
  // JUDUL YANG MENYEBUT PEKERJAANNYA, BUKAN NOMOR VARIABELNYA
  // ========================================================================
  //
  // "Alasan yang TIDAK masuk 5227, beserta sebabnya" benar menurut kodenya
  // dan hampir tidak berarti apa-apa bagi yang membacanya: 5227 adalah nomor
  // variabel ABT, bukan sesuatu yang dipikirkan hakim saat menimbang. Dan
  // kartunya hanya menyebut yang GAGAL - yang membaca tidak pernah tahu apa
  // yang sebenarnya sudah siap dipakai.
  kotak.appendChild(
    buatElemen("div", "aleta-abt-nama", "Alasan perceraian - yang siap dipakai dan yang belum")
  );

  // Yang SIAP disebut lebih dahulu. Daftar yang seluruhnya berisi kekurangan
  // membuat pembacanya mengira tidak ada yang berhasil.
  // Digambar dengan pembantu yang sama seperti kelompok lain - lihat
  // catatannya di bawah. Dipanggil lebih dahulu supaya yang SIAP berdiri
  // paling atas: daftar yang seluruhnya berisi kekurangan membuat
  // pembacanya mengira tidak ada yang berhasil.
  const gambarKelompokAlasan = [];

  if (!hasil || hasil.gugatanTerbaca !== true) {
    // Disebut apa adanya. Tanpa keterangan ini, "tidak ada yang di luar
    // gugatan" tidak dapat dibedakan dari "gugatannya tidak diperiksa".
    kotak.appendChild(
      buatElemen(
        "div",
        "aleta-abt-catatan",
        "Gugatan (5125) tidak terbaca dari halaman ini, jadi pencocokan dengan " +
          "dalil gugatan TIDAK dijalankan."
      )
    );
  }

  // ========================================================================
  // SATU KELOMPOK SATU BLOK - BUKAN SATU TUMPUKAN PANJANG
  // ========================================================================
  //
  // Empat kelompok sebelumnya dituang berurutan ke dalam satu kartu: judul,
  // keterangan, baris, judul, keterangan, baris - dan dibaca dari layar
  // seluruhnya tampak satu tumpukan yang sama beratnya. Yang siap dipakai
  // tidak terbedakan dari yang belum terbukti, padahal keduanya menuntut
  // tindakan yang berlawanan.
  //
  // Kini tiap kelompok berdiri sebagai bloknya sendiri, berkepala nama dan
  // JUMLAHNYA, dan butirnya berjajar sebagai lencana - bukan baris-baris
  // yang panjangnya berubah-ubah.
  const kelompok = (judul, keterangan, daftar, label, nada) => {
    if (!daftar.length) return;
    const blok = buatElemen("div", `aleta-alasan-kelompok aleta-alasan-${nada || "netral"}`);
    const kepala = buatElemen("div", "aleta-alasan-kepala");
    kepala.appendChild(buatElemen("span", "aleta-alasan-judul", judul));
    kepala.appendChild(buatElemen("span", "aleta-alasan-jumlah", String(daftar.length)));
    blok.appendChild(kepala);
    blok.appendChild(buatElemen("div", "aleta-abt-catatan", keterangan));
    const deret = buatElemen("div", "aleta-alasan-deret");
    for (const satu of daftar) {
      const butir = buatElemen("span", "aleta-alasan-butir");
      butir.appendChild(buatElemen("span", "aleta-alasan-tanda", label(satu)));
      butir.appendChild(buatElemen("span", "aleta-alasan-nama", satu.nama || satu));
      deret.appendChild(butir);
    }
    blok.appendChild(deret);
    kotak.appendChild(blok);
  };

  kelompok(
    "Siap dipakai",
    "Dikuatkan KEDUA saksi dan didalilkan dalam gugatan. Inilah yang sudah " +
      "tertulis pada alasan perceraian (5227); tidak ada yang perlu dikerjakan.",
    terbukti,
    () => "Terbukti",
    "siap"
  );

  kelompok(
    "Hanya disebut satu saksi",
    "Perlu penguat. Tanyakan kepada saksi yang belum menyebutnya, atau kuatkan " +
      "dengan alat bukti lain sebelum memasukkannya sendiri ke 5227.",
    sepihak,
    (x) => `Saksi ${x.saksi}`,
    "sebagian"
  );

  kelompok(
    "Terbukti, tetapi tidak didalilkan dalam gugatan",
    "Kedua saksi menerangkannya, tetapi gugatannya tidak pernah mendalilkannya. " +
      "Memasukkannya ke pertimbangan berarti memutus melebihi yang dituntut.",
    diluar,
    () => "Di luar gugatan",
    "awas"
  );

  kelompok(
    "Didalilkan dalam gugatan, tetapi belum dikuatkan kedua saksi",
    "Dalil yang masih harus dibuktikan - atau ditolak dengan pertimbangan " +
      "tersendiri. Yang tidak disinggung sama sekali adalah tuntutan yang tidak diadili.",
    belum,
    () => "Belum terbukti",
    "belum"
  );

  // ========================================================================
  // SARAN PENUTUP - SATU KALIMAT, DARI ANGKA DI ATASNYA
  // ========================================================================
  //
  // Daftar tanpa penutup menuntut pembacanya menyimpulkan sendiri apa yang
  // harus dikerjakan berikutnya, dan itu justru bagian yang paling mudah
  // keliru: yang "di luar gugatan" dan yang "belum terbukti" menuntut
  // tindakan yang BERLAWANAN - yang satu jangan dipakai, yang lain justru
  // harus diadili.
  //
  // Saran ini usulan, bukan perintah. Yang memutus tetap majelis.
  const saran = [];
  if (terbukti.length) saran.push(`${terbukti.length} alasan sudah siap dipakai`);
  if (sepihak.length) {
    saran.push(
      `${sepihak.length} baru disebut satu saksi - tanyakan kepada saksi satunya atau kuatkan dengan bukti lain`
    );
  }
  if (diluar.length) {
    saran.push(
      `${diluar.length} terbukti tetapi di luar gugatan - JANGAN dimasukkan ke pertimbangan, itu memutus melebihi tuntutan`
    );
  }
  if (belum.length) {
    saran.push(
      `${belum.length} didalilkan tetapi belum terbukti - harus tetap disinggung, dikabulkan atau ditolak dengan pertimbangan sendiri`
    );
  }
  if (saran.length) {
    kotak.appendChild(buatElemen("div", "aleta-abt-naskah", "Yang perlu dikerjakan"));
    kotak.appendChild(
      buatElemen("div", "aleta-abt-catatan", `${saran.join("; ")}. Usulan ALETA - yang memutus tetap majelis.`)
    );
  }

  return kotak;
}

/** Kartu keterangan yang berselisih antar saksi, atau null. */
function susunKartuSelisih(daftar) {
  if (!daftar.length) return null;
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
  return kotak;
}

/**
 * Menuliskan huruf alasan yang dicentang ke 8503 lewat simpanVariabel, lalu
 * memeriksa gabungannya terhadap kueri 4020. Satu penulis untuk tombol lama
 * "Tuliskan huruf alasan" dan tombol "Input ke ABT" perbaikan 30 Sep sore -
 * permintaan, riwayat, dan kalimatnya sama persis.
 *
 * @returns {Promise<{gagal: boolean, pesan: string, isi8503: string}>}
 */
async function tulisHurufAlasan(dipilih, jatiDiri, opsi) {
  // opsi.cara (7 Okt): isian langsung di butir "Isi huruf alasan perceraian
  // (8503)" memakai penulis yang sama, dengan catatan riwayat sendiri.
  const riwayat = { cara: "centangan huruf alasan" };
  if (opsi && opsi.cara) riwayat.cara = String(opsi.cara);
  const isi8503 = susun8503(dipilih);
  const sebelum = (barisVariabel().get(VAR_HURUF) || {}).nilai || "";
  let pesan = "";
  let gagal = false;
  try {
    const hasil = await simpanVariabel(VAR_HURUF, isi8503, jatiDiri);
    if (!hasil.ok) {
      gagal = true;
      pesan = `8503: ${hasil.pesan}`;
    } else {
      void catatRiwayat({
        perkaraId: jatiDiri.perkaraId,
        kode: VAR_HURUF,
        nama: "Alasan perceraian",
        sebelum,
        sesudah: isi8503,
        cara: riwayat.cara,
        pada: new Date().toISOString(),
      });
      const item = barisVariabel().get(VAR_HURUF);
      if (item) item.selNilai.textContent = isi8503;
      pesan = `8503 diisi "${isi8503}". 4020 mengikuti sendiri sesudah halaman disegarkan.`;
    }
  } catch (galat) {
    gagal = true;
    pesan = `8503: ${String((galat && galat.message) || galat)}`;
  }

  // ==========================================================================
  // GABUNGAN YANG TIDAK DIKENALI KUERI 4020 DISEBUTKAN SEKARANG
  // ==========================================================================
  //
  // Bukan sesudahnya, dan bukan dibiarkan. Yang tidak dikenali membuat
  // 4020 berbunyi "TIDAK BENAR QUERY NYA / BELUM ISI ALASAN DI KOLOM
  // ABT" - dan kalimat itu ikut tercetak ke dalam putusan.
  if (!gagal && !dikenali4020(dipilih)) {
    gagal = true;
    pesan = abtKenalSemuaHuruf()
      ? `8503 diisi "${isi8503}", tetapi itu bukan deretan huruf A-H - ` +
        `4020 akan berbunyi "TIDAK BENAR QUERY NYA" dan kalimat itu ikut tercetak.`
      : `8503 diisi "${isi8503}", tetapi kueri 4020 milik ABT tidak mengenali gabungan ini - ` +
        `ia hanya mengenal A, B, F, H sendiri-sendiri, AB, AF, BF, dan ABF (blangko satker ini belum dipasangi paket ABT abt-alasan-cdeh). ` +
        `4020 akan berbunyi "TIDAK BENAR QUERY NYA" dan kalimat itu ikut tercetak. ` +
        `Pasang paketnya di ABT, atau kurangi hurufnya.`;
  }
  return { gagal, pesan, isi8503 };
}

/**
 * Muatan permintaan usulan - satu penyusun untuk tombol lama dan untuk
 * "Isi dari SIPP & input ke ABT" otomatis (perbaikan 30 Sep sore). Urutan
 * ruasnya sama dengan yang dikirim tombol lama sejak dulu.
 */
function muatanUsulanSaksi(peta, bacaan) {
  return {
    nomorPerkara: nomorPerkaraAbt(),
    sumber: "saksi",
    saksi1: bacaan.teks1,
    saksi2: bacaan.teks2,
    // Dibaca dari halaman ini juga. Dipakai menghitung ulang lama pisah:
    // "kira-kira 4 bulan" benar pada hari saksi diperiksa, dan mulai
    // keliru pada sidang berikutnya.
    tanggalSidang: nilaiVariabel(VAR_TGL_SIDANG),
    pelaku: nilaiVariabel(VAR_PIHAK_PELAKU),
    lawan: nilaiVariabel(VAR_PIHAK_LAWAN),
    // Gugatannya - 5227 hanya boleh memuat alasan yang DIDALILKAN dan
    // dibuktikan. innerText cukup di sini: yang dicocokkan kata kuncinya,
    // bukan teksnya yang akan disimpan.
    posita: peta.get(VAR_POSITA) ? peta.get(VAR_POSITA).selNilai.innerText : "",
  };
}

function muatanUsulanItsbat(posita) {
  return {
    nomorPerkara: nomorPerkaraAbt(),
    sumber: "itsbat",
    posita,
    // Sebutan PEMOHON = 0046. Dahulu hanya `pelaku` (0047 = Termohon)
    // yang dikirim, dan bot memakainya sebagai sebutan pemohon - label
    // usulannya "Status Termohon sebelum nikah". `pelaku` tetap dikirim
    // untuk bot lama yang belum membaca `pemohon`.
    pemohon: nilaiVariabel(VAR_PIHAK_LAWAN),
    pelaku: nilaiVariabel(VAR_PIHAK_PELAKU),
  };
}

function muatanUsulanLain(posita, nomor) {
  return {
    nomorPerkara: nomor,
    sumber: "posita-lain",
    posita,
    // Id SIPP bila namanya dikenal - kenaliJenis bot mencocokkan id lebih
    // dulu; nama apa adanya tetap dikenali lewat polanya.
    jenisPerkara: idJenisPerkaraSipp(nilaiVariabel(VAR_JENIS_PERKARA) || sebutJenisPerkara(nomor)),
    alur: idAlurPerkaraSipp(nomor),
    pemohon: nilaiVariabel(VAR_PIHAK_LAWAN),
    pelaku: nilaiVariabel(VAR_PIHAK_PELAKU),
    lawan: nilaiVariabel(VAR_PIHAK_LAWAN),
  };
}

/** Sebab penolakan posita perkara lain yang dikenal - disebut, bukan kodenya. */
const SEBAB_POSITA_LAIN = Object.freeze({
  jenis_perkara_tidak_dilayani: "Jenis perkara ini belum dilayani pengisian dari posita.",
  posita_kosong: "Posita permohonan kosong.",
});

function susunPanelAbt(jatiDiri) {
  const panel = buatElemen("div", "aleta-panel aleta-panel-abt");
  panel.id = PENANDA_ABT;
  panel.setAttribute("data-tema", "gelap");

  const kepala = buatElemen("div", "aleta-kepala");
  // ==========================================================================
  // LOGO DI KEPALA - SAMA DENGAN PANEL SIPP DAN ALETA
  // ==========================================================================
  //
  // Panel ini melayang di atas halaman milik aplikasi lain dan tampilannya
  // menyerupai bagian aplikasi itu sendiri. Logo membuat asalnya terbaca
  // sekilas - siapa yang berbicara di sini - tanpa perlu membaca tulisan apa
  // pun. Panel SIPP dan ALETA sudah memasangnya sejak lama; ABT satu-satunya
  // yang tidak, dan itulah yang membuat ketiganya terasa tiga aplikasi.
  //
  // Diukur pada berkasnya: konten.js 2 pemakaian aleta-logo, aleta.js 1,
  // abt.js NOL.
  //
  // Dibungkus try: di luar konteks ekstensi chrome.runtime tidak ada, dan
  // kepala tanpa logo masih kepala - kepala yang gagal dibangun tidak.
  try {
    const logo = document.createElement("img");
    logo.className = "aleta-logo";
    logo.alt = "";
    logo.src = chrome.runtime.getURL("ikon/aleta-32.png");
    logo.addEventListener("error", () => logo.remove());
    kepala.appendChild(logo);
  } catch {
    /* tanpa logo, kepala tetap utuh */
  }
  kepala.appendChild(buatElemen("span", "aleta-merek", "ALETA"));
  // Pita identitas yang sama dengan panel SIPP - di kepala dan di kaki.
  let pitaKepala = pitaIdentitasAbt(penggunaAletaAbt);
  kepala.appendChild(pitaKepala);
  // Perannya ditandai pada akar panel - dari situlah rel gradasi di tepi atas
  // mengambil warnanya. Sama persis dengan panel SIPP dan ALETA.
  alatTandaiPeranPanel(panel, penggunaAletaAbt && penggunaAletaAbt.peran);
  panel.appendChild(kepala);

  // Geser, ubah ukuran, ciut, layar penuh, kembalikan bawaan, tema, tutup -
  // seluruhnya dari panel-alat.js. Panel ini sebelumnya tidak punya satu pun,
  // dan untuk panel yang menutupi sisi kanan halaman kerja itu berarti
  // satu-satunya jalan keluar adalah menutupnya.
  void alatPasangPanel(panel, kepala, KUNCI_POSISI_ABT, {
    kunciTema: KUNCI_TEMA_PANEL,
    // Tombol temanya mewarnai HALAMAN ABT juga, bukan panelnya saja. Tanpa ini
    // "terang" hanya menerangkan panel selebar telapak tangan sementara
    // halaman di belakangnya tetap gelap - dan itulah sebabnya light mode
    // terbaca sebagai tidak berfungsi.
    temaHalaman: true,
    // × berarti mematikan saklar ALETA, bukan sekadar membuang panel ini dari
    // halaman. Panel yang hanya dibuang tidak dapat dipanggil kembali: berkas
    // ini berjalan sekali, dan tidak ada yang membangunnya ulang sampai
    // halamannya dimuat ulang. Saklarnya tergambar di popup ikon Chrome -
    // satu tekanan di sana mengembalikannya, di sini dan di SIPP sekaligus.
    saatTutup: () => tutupPanelAbt(),
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
    ["aleta-tanda-kuning", "ragu — tidak dicentang sendiri"],
  ]) {
    petunjuk.appendChild(buatElemen("span", `aleta-tanda ${kelas}`, teks));
  }
  isi.appendChild(petunjuk);

  // Tombol berbahasa hukum yang resmi: yang menekannya panitera pengganti,
  // bukan pemrogram, dan "8503" tidak berarti apa-apa bagi berita acara.
  // Tombol yang variabel sasarannya tidak ada di blangko ini tidak digambar.
  const petaAwal = barisVariabel();
  const tombolBaris = buatElemen("div", "aleta-abt-aksi");
  const tombolSipp = buatElemen("button", "aleta-permintaan-tombol", "Isi blangko dari SIPP");
  tombolSipp.type = "button";
  const tombolSaksi = buatElemen("button", "aleta-permintaan-tombol", "Input ke ABT");
  tombolSaksi.type = "button";
  // Hanya pada blangko yang memuat variabel cerai - lihat VARIABEL_CERAI_SAKSI.
  tombolSaksi.hidden = !blangkoMemuatVariabelCerai(petaAwal);
  const tombolItsbat = buatElemen("button", "aleta-permintaan-tombol", "Isi dari posita permohonan");
  tombolItsbat.type = "button";
  tombolItsbat.title = "Tanggal dan tempat nikah, wali, saksi nikah, mahar, status, umur, dan anak - dibaca dari posita.";
  tombolItsbat.hidden = !(petaAwal.has("5197") || petaAwal.has("8087"));
  // Perkara lain (dispensasi kawin, perwalian, asal usul, harta bersama) -
  // hanya pada blangko yang memuat variabel siap milik JENIS perkaranya (0048,
  // atau daftar sidang) - lihat VARIABEL_SIAP_POSITA_LAIN.
  const tombolPositaLain = buatElemen("button", "aleta-permintaan-tombol", "Isi dari posita permohonan");
  tombolPositaLain.type = "button";
  const jenisAwal = (petaAwal.get(VAR_JENIS_PERKARA) || {}).nilai || sebutJenisPerkara(nomorPerkaraAbt());
  tombolPositaLain.hidden = !blangkoMemuatVariabelSiapLain(petaAwal, kunciJenisLain(jenisAwal));
  /* === JENIS3 11 Okt === */
  // Semua jenis non-cerai: tombol juga tergambar bila blangko memuat variabel yang dikenali kamus
  // per jenis (usulan "ragu" tampil tidak tercentang). Itsbat/asal usul tetap lewat tombol itsbat.
  if (tombolPositaLain.hidden && tombolItsbat.hidden && j3BlangkoMemuatVariabelJenis(petaAwal, jenisAwal)) {
    tombolPositaLain.hidden = false;
  }
  /* === AKHIR JENIS3 === */
  if (!tombolPositaLain.hidden && !tombolItsbat.hidden) tombolPositaLain.textContent = "Isi dari posita permohonan (perkara lain)";
  tombolPositaLain.title =
    "Variabel perkara lain yang lulus gerbang ukur (presisi ≥ 0,9 atas isian manusia) dan tidak lebih buruk dari " +
    "isian bawaan ABT - dibaca dari posita. Tidak satu pun tersimpan sebelum dicentang dan diterapkan.";
  const tombolSdg = buatElemen("button", "aleta-permintaan-tombol", "Susun keterangan saksi 1 & 2");
  tombolSdg.type = "button";
  // Tulisannya tetap "saksi 1 & 2" - pintasan Alt+Enter di kaki panel
  // mencocokkan tulisan itu. Borangnya melayani sampai 4 saksi P dan 2 saksi T.
  tombolSdg.title =
    "Keterangan saksi dari satu templat ABT (sampai 4 saksi Penggugat dan 2 saksi Tergugat): substansi sama, kalimat berbeda.";
  // 1.184.0 (butir 23): juga blangko BAS (5058 "TanyaJwb Saksi 1 P") - lihat a3BlangkoMemuatSaksi.
  tombolSdg.hidden = !a3BlangkoMemuatSaksi(petaAwal);

  // ==========================================================================
  // DI HALAMAN TANYA-JAWAB, HANYA INILAH YANG MASUK AKAL
  // ==========================================================================
  //
  // Halaman itu tidak punya satu pun baris variabel: "Isi blangko dari SIPP",
  // "Isi dari posita permohonan", dan perapian posita tidak punya sasaran di
  // sana, dan tombol yang ditekan lalu menjawab "tidak ada apa-apa" lebih
  // buruk daripada tombol yang tidak ada.
  //
  // Yang tersisa justru yang dicari orang di halaman itu - dan ia dipaksa
  // tampak, sebab penjaganya membaca baris variabel yang memang tidak ada.
  const diTanyaJawab = halamanTanyaJawab();
  if (diTanyaJawab) {
    tombolSipp.hidden = true;
    tombolSaksi.hidden = true;
    tombolItsbat.hidden = true;
    tombolPositaLain.hidden = true;
    tombolSdg.hidden = false;
    const saksiKe = saksiKeberapa();
    tombolSdg.title =
      `Menyusun keterangan kedua saksi dari satu templat ABT${saksiKe ? ` - halaman ini saksi ${saksiKe}` : ""}. ` +
      "Keduanya diperlihatkan untuk dibaca sebelum disimpan.";
  }
  tombolBaris.appendChild(tombolSipp);
  tombolBaris.appendChild(tombolSaksi);
  tombolBaris.appendChild(tombolItsbat);
  tombolBaris.appendChild(tombolPositaLain);
  tombolBaris.appendChild(tombolSdg);
  isi.appendChild(tombolBaris);

  const kabar = buatElemen("div", "aleta-abt-kabar");
  isi.appendChild(kabar);

  // ==========================================================================
  // UNGGAH PUTUSAN PERKARA INI - BUTIR 3
  // ==========================================================================
  //
  // Di panel PERKARA, bukan di panel massal. Yang membuka satu perkara di ABT
  // dan hendak mengunggah yang satu itu tidak seharusnya menyusun antrean
  // sehari penuh lebih dahulu lalu mencentang satu baris.
  //
  // Memulangkan null pada halaman yang tidak memuat perkara - lihat di dalam
  // fungsinya. Panel yang tergambar tetapi tidak dapat dipakai hanya menambah
  // tombol yang menolak.
  bagianUnggahSatuAbt(isi);

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

  /**
   * ========================================================================
   * PECAHAN KATA YANG RAGU - DITANYAKAN, SATU KLIK MENYAMBUNG
   * ========================================================================
   *
   * Sesudah kata terpecah, penanda butir yang SUNGGUHAN dan pecahan yang
   * PALSU tampak persis sama:
   *
   *   "...disebabkan karena<br>   a. Tergugat sering..."   penanda butir
   *   "...kewajiban tidak terlaksan<br>   a. Sejak itu..."  pecahan kata
   *
   * Yang membedakan hanya apakah "karena" dan "terlaksan" kata utuh - dan
   * itu menuntut kamus. Perapian karena itu hanya menyambung huruf g-z,
   * yang hampir pasti pecahan; a-f dibiarkan.
   *
   * Dibiarkan TANPA disebut adalah kekurangan yang lain lagi: petugas tidak
   * punya cara tahu ada atau tidak. Karena itu di sini keduanya digambar,
   * dan yang ditulis paling menonjol SAMBUNGANNYA - kata yang akan
   * terbentuk - sebab itulah satu-satunya keterangan yang menjawab
   * pertanyaannya. Hurufnya sendiri tidak menjawab apa pun.
   */
  function gambarRaguPosita(daftar) {
    const kotak = buatElemen("div", "aleta-abt-kartu aleta-abt-kartu-awas");
    kotak.appendChild(
      buatElemen(
        "div",
        "aleta-abt-nama",
        `${daftar.length} kemungkinan kata terpecah pada posita — periksa sendiri`
      )
    );
    kotak.appendChild(
      buatElemen(
        "div",
        "aleta-abt-catatan",
        "Perapian TIDAK menyentuh yang ini: bentuknya sama dengan penanda butir " +
          "a, b, c yang sungguhan. Lihat kata di bawah - bila ia kata yang utuh " +
          "(\"tahun\", \"terlaksana\"), ia pecahan yang perlu disambung. Bila tidak " +
          "(\"karenaa\"), ia penanda butir yang benar - biarkan."
      )
    );

    daftar.forEach((satu, indeks) => {
      const blokRagu = buatElemen("div", "aleta-abt-huruf");
      const kepalaRagu = buatElemen("div", "aleta-abt-sanding");
      kepalaRagu.appendChild(buatElemen("span", "aleta-abt-label", `huruf ${satu.huruf}`));
      kepalaRagu.appendChild(buatElemen("strong", "aleta-abt-isi", satu.sambungan));
      blokRagu.appendChild(kepalaRagu);
      blokRagu.appendChild(buatElemen("div", "aleta-abt-kutipan", satu.konteks));

      const tombol = buatElemen("button", "aleta-permintaan-tombol", "Sambung kata ini");
      tombol.type = "button";
      const kabarRagu = buatElemen("div", "aleta-abt-kabar");
      tombol.addEventListener("click", async () => {
        tombol.disabled = true;
        kabarRagu.className = "aleta-abt-kabar";
        kabarRagu.textContent = "Menyambung…";
        try {
          const hasil = await sambungPecahanPosita(jatiDiri.perkaraId, indeks);
          kabarRagu.className = hasil.ok
            ? "aleta-abt-kabar"
            : "aleta-abt-kabar aleta-abt-gagal";
          kabarRagu.textContent = hasil.pesan;
          if (hasil.ok) {
            void catatRiwayat({
              perkaraId: jatiDiri.perkaraId,
              kode: VAR_POSITA,
              nama: "Posita lengkap",
              sebelum: satu.konteks,
              sesudah: satu.sambungan,
              cara: "sambung pecahan kata",
              pada: new Date().toISOString(),
            });
            // Urutan temuan BERGESER sesudah satu disambung, jadi tombol
            // lain pada daftar ini sudah tidak menunjuk temuan yang sama.
            // Dimatikan seluruhnya, dan petugas menekan Rapikan lagi untuk
            // daftar yang segar - lebih baik daripada tombol yang menyambung
            // kata yang salah.
            for (const lain of Array.from(
              kotak.querySelectorAll("button.aleta-permintaan-tombol")
            )) {
              lain.disabled = true;
            }
            kotak.appendChild(
              buatElemen(
                "div",
                "aleta-abt-catatan",
                "Tekan \"Rapikan posita & keterangan saksi\" lagi untuk daftar yang segar - " +
                  "urutan temuan bergeser sesudah satu disambung."
              )
            );
          } else {
            tombol.disabled = false;
          }
        } catch (galat) {
          kabarRagu.className = "aleta-abt-kabar aleta-abt-gagal";
          kabarRagu.textContent = String((galat && galat.message) || galat);
          tombol.disabled = false;
        }
      });

      blokRagu.appendChild(tombol);
      blokRagu.appendChild(kabarRagu);
      kotak.appendChild(blokRagu);
    });

    wadahRiwayat.appendChild(kotak);
  }
  isi.appendChild(wadahRiwayat);

  // Urutannya disengaja: selisih antar saksi lebih dulu, sebab ia dapat
  // membatalkan seluruh isian di bawahnya. Lalu huruf alasan, lalu usulan.
  const wadahSelisih = buatElemen("div", "aleta-abt-daftar");
  isi.appendChild(wadahSelisih);
  const wadahSepihak = buatElemen("div", "aleta-abt-daftar");
  isi.appendChild(wadahSepihak);
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
  /**
   * ==========================================================================
   * TIGA SARINGAN 5227, DAN KETIGANYA HARUS TERBACA
   * ==========================================================================
   *
   * 5227 disusun dari alasan yang lolos tiga saringan sekaligus:
   *
   *   1. disebut saksi 1
   *   2. disebut saksi 2 juga - keterangan seorang saksi tanpa penguat bukan
   *      alat bukti yang berdiri sendiri
   *   3. DIDALILKAN dalam gugatan - yang diperiksa dan diputus adalah dalil
   *      gugatan; saksi membuktikannya, bukan menambah dalil baru
   *
   * Yang gugur pada saringan kedua dan ketiga TIDAK boleh hilang dari layar,
   * dan keduanya berbeda sama sekali:
   *
   *   hanya satu saksi        perlu penguat - tanyakan kepada saksi lain
   *   di luar gugatan         terbukti, tetapi tidak pernah didalilkan
   *   didalilkan belum terbukti  dalil yang harus dibuktikan atau ditolak
   *
   * Yang terakhir yang paling mahal didiamkan: ia dalil hidup di dalam
   * gugatan, dan putusan yang tidak menyinggungnya meninggalkan tuntutan
   * yang tidak diadili.
   */
  // Isinya disusun susunKartuAlasan / susunKartuSelisih (tingkat atas) - lapisan
  // perbaikan 30 Sep sore memakai penyusun yang sama. DOM-nya tidak berubah.
  function gambarSepihak(hasil) {
    wadahSepihak.textContent = "";
    const kotak = susunKartuAlasan(hasil);
    if (kotak) wadahSepihak.appendChild(kotak);
  }
  function gambarSelisih(daftar) {
    wadahSelisih.textContent = "";
    const kotak = susunKartuSelisih(daftar);
    if (kotak) wadahSelisih.appendChild(kotak);
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
    kotak.appendChild(buatElemen("div", "aleta-abt-nama", "Huruf alasan perceraian"));

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
      // Huruf yang bot tandai centangOtomatis: false (huruf alasan blangko
      // [01], keputusan 11) juga tidak - tanpa ini penanda itu dikirim bot dan
      // tidak dibaca siapa pun.
      if (h.centangOtomatis === false) centang.checked = false;
      kepalaHuruf.appendChild(centang);
      kepalaHuruf.appendChild(buatElemen("span", "aleta-abt-huruf-nama", `Huruf ${h.huruf}`));
      kepalaHuruf.appendChild(
        buatElemen("span", "aleta-abt-huruf-pemicu", `dipicu: ${h.pemicu.join(", ")}`)
      );
      blok.appendChild(kepalaHuruf);

      if (h.syarat) blok.appendChild(buatElemen("div", "aleta-abt-catatan", h.syarat));

      // ======================================================================
      // BUNYI PASAL DILIPAT - DIBUKA BILA MEMANG HENDAK DIBACA
      // ======================================================================
      //
      // Tiap huruf membawa dua kutipan penuh (PP 9/1975 dan KHI) beserta
      // catatan selisih naskahnya. Untuk tiga huruf itu enam paragraf hukum
      // yang bunyinya sudah dihafal siapa pun yang mengerjakannya - dan ia
      // mendorong tombol "Tuliskan huruf alasan" keluar dari layar.
      //
      // Yang dilipat hanya BUNYINYA. Nama pasalnya tetap terbaca pada ringkasan
      // supaya yang memeriksa tahu dasar hukumnya ada tanpa harus membukanya.
      const dasar = h.dasar || [];
      if (dasar.length) {
        const lipat = document.createElement("details");
        lipat.className = "aleta-abt-lipat";
        const ringkas = document.createElement("summary");
        ringkas.className = "aleta-abt-lipat-judul";
        ringkas.textContent = `Dasar hukum (${dasar.length}) - ${dasar
          .map((d) => d.sumber.nama)
          .join(" · ")}`;
        lipat.appendChild(ringkas);
        for (const d of dasar) {
          lipat.appendChild(buatElemen("div", "aleta-abt-naskah", d.sumber.nama));
          lipat.appendChild(buatElemen("div", "aleta-abt-bunyi", d.bunyi));
          if (d.catatanNaskah) {
            lipat.appendChild(buatElemen("div", "aleta-abt-kutipan-sumber", d.catatanNaskah));
          }
        }
        blok.appendChild(lipat);
      }

      kotak.appendChild(blok);
      pilihan.push({ huruf: h.huruf, centang });
    }

    for (const h of belumSiap) {
      kotak.appendChild(buatElemen("div", "aleta-abt-catatan", `huruf ${h.huruf}: ${h.sebab}`));
    }

    if (pilihan.length) {
      const terap = buatElemen("button", "aleta-permintaan-tombol", "Tuliskan huruf alasan");
      terap.type = "button";
      const kabarHuruf = buatElemen("div", "aleta-abt-kabar");
      // ======================================================================
      // TOMBOLNYA BERDIRI DI BARIS TINDAKAN, BERSAMA "TERAPKAN YANG DICENTANG"
      // ======================================================================
      //
      // Sebelumnya ia menutup kartu huruf, jauh di atas daftar usulan - dan
      // yang mengerjakan harus menggulung ke atas untuk menulis hurufnya,
      // lalu turun lagi untuk menerapkan usulannya. Dua tombol yang keduanya
      // berarti "tuliskan ke ABT" pantas berdiri berdampingan.
      //
      // Dititipkan, bukan dipasang: gambarUsulan yang memasangnya, dan ia
      // berjalan sesudah gambarHuruf. Bila ia tidak menggambar apa-apa,
      // tombolnya dikembalikan ke kartunya sendiri - lebih baik di tempat
      // lama daripada tidak ada sama sekali.
      // adaCentang dibaca "Terapkan yang dicentang" dalam tampilan Baru/UI Baru
      // (perbaikan 30 Sep sore butir 6: dua tombol tulis menjadi satu).
      hurufMenunggu = { tombol: terap, kabar: kabarHuruf };
      hurufMenunggu.adaCentang = () => pilihan.some((x) => x.centang.checked);
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

        // Penulisnya satu untuk tombol ini dan tombol "Input ke ABT" lapisan
        // perbaikan 30 Sep sore - lihat tulisHurufAlasan.
        const { gagal, pesan } = await tulisHurufAlasan(dipilih, jatiDiri);

        terap.disabled = false;
        kabarHuruf.className = gagal ? "aleta-abt-kabar aleta-abt-gagal" : "aleta-abt-kabar";
        kabarHuruf.textContent = pesan;
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
  const tombolRiwayat = buatElemen("button", "aleta-abt-batal", "Lihat riwayat perubahan");
  tombolRiwayat.type = "button";
  tombolBaris.appendChild(tombolRiwayat);

  /**
   * Dua perapian yang mengubah teks yang SUDAH ada, bukan mengusulkan yang
   * baru. Karena itu keduanya menampilkan pratinjau lebih dulu: yang diubah
   * bukan kolom kosong, melainkan tulisan yang sudah dibaca dan disetujui.
   */
  const tombolRapikan = buatElemen("button", "aleta-abt-batal", "Rapikan posita & keterangan saksi");
  tombolRapikan.type = "button";
  tombolRapikan.title =
    "Memisahkan butir posita yang menempel, dan membuang kalimat penutup " +
    "keterangan saksi beserta baris kosong di bawahnya.";
  tombolBaris.appendChild(tombolRapikan);

  tombolRapikan.addEventListener("click", async () => {
    wadahRiwayat.textContent = "";
    const peta = barisVariabel();
    const rencana = [];

    // ========================================================================
    // PRATINJAU POSITA DATANG DARI SERVER, BUKAN DARI LAYAR
    // ========================================================================
    //
    // Yang tergambar di baris 5125 innerText satu sel tabel - hasil peramban
    // menggambar HTML: baris ganda dirapatkan, entitas diterjemahkan, tag
    // dibuang. Merapikannya di sini menghasilkan pratinjau atas teks yang
    // BUKAN teks yang tersimpan, dan menyimpannya berarti menimpa posita
    // dengan hasil render peramban.
    //
    // Itulah yang dilaporkan: menekan Terapkan menghasilkan penolakan "isi
    // positanya berbeda" padahal petugas tidak mengubah apa pun.
    //
    // Sekarang bot yang membaca dan merapikannya, dan uji kering
    // mengembalikan sebelum-sesudahnya tanpa menulis apa pun. Pratinjaunya
    // karena itu memperlihatkan yang benar-benar akan tersimpan.
    if (peta.get(VAR_POSITA)) {
      try {
        const uji = await mintaPositaRapi(jatiDiri.perkaraId, true);
        if (uji.ok && uji.berubah) {
          rencana.push({
            kode: VAR_POSITA,
            nama: "Posita lengkap",
            sebelum: uji.sebelum,
            sesudah: uji.sesudah,
          });
        }
        // ====================================================================
        // YANG RAGU DITANYAKAN, BUKAN DITEBAK - DAN BUKAN DIDIAMKAN
        // ====================================================================
        //
        // Pecahan berhuruf a-f tidak dapat dibedakan dari penanda butir yang
        // sungguhan tanpa kamus. Perapian membiarkannya, dan sampai sekarang
        // petugas tidak punya cara tahu ada atau tidak.
        //
        // Yang menentukan penilaiannya SATU hal: apakah "sambungan" - kata
        // yang akan terbentuk bila disambung - kata yang utuh. "tahun" utuh,
        // jadi ia pecahan. "karenaa" tidak, jadi ia penanda butir yang benar.
        // Karena itu sambungannya yang ditulis paling menonjol, bukan
        // hurufnya.
        if (uji.ok && uji.ragu && uji.ragu.length) gambarRaguPosita(uji.ragu);
        if (!uji.ok) {
          // Disebut, bukan didiamkan: posita yang tidak dapat dibaca terbaca
          // sebagai posita yang sudah rapi, dan itu keliru.
          wadahRiwayat.appendChild(
            buatElemen("div", "aleta-abt-kabar aleta-abt-gagal", `Posita: ${uji.pesan}`)
          );
        }
      } catch (galat) {
        wadahRiwayat.appendChild(
          buatElemen(
            "div",
            "aleta-abt-kabar aleta-abt-gagal",
            `Posita tidak dapat diperiksa: ${String((galat && galat.message) || galat)}`
          )
        );
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
          // ================================================================
          // TIGA VARIABEL, TIGA JALUR SIMPAN YANG BERBEDA
          // ================================================================
          //
          // Ketiganya tampak sama di layar - satu baris teks yang dirapikan -
          // tetapi tersimpan di tiga tempat yang sama sekali berbeda:
          //
          //   5125  data_sipp     kolom posita di basis data SIPP
          //   2021  tanya_jawab   baris-baris di abt_keterangan_saksi
          //   2022  tanya_jawab   sama
          //   lain  data_teks     rute edit_data milik ABT
          //
          // Dulu ketiganya dikirim ke edit_data, dan dua yang pertama selalu
          // ditolak: "bertipe data_sipp / tanya_jawab - tidak dapat
          // disunting". Penolakan itu benar - yang salah tempat tujuannya.
          let hasil;
          if (r.kode === VAR_POSITA) {
            hasil = await mintaPositaRapi(jatiDiri.perkaraId, false);
            // Teks lama diambil dari SIPP, bukan dari yang tergambar di
            // halaman - riwayat perubahan harus memuat yang benar-benar ada.
            if (hasil.ok && hasil.sebelum) r.sebelum = hasil.sebelum;
          } else if (r.kode === VAR_SAKSI_1 || r.kode === VAR_SAKSI_2) {
            hasil = await simpanKeteranganSaksi(r.kode);
          } else {
            hasil = await simpanVariabel(r.kode, r.sesudah, jatiDiri);
          }
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
          // Pesannya dari jalur yang benar-benar dipakai, bukan satu kata
          // "Tersimpan" untuk ketiganya - yang menyimpan posita perlu tahu
          // bahwa yang berubah ada di SIPP, bukan di ABT.
          kabarTerap.textContent = hasil.pesan ? `Tersimpan — ${hasil.pesan}.` : "Tersimpan.";
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

      // ======================================================================
      // YANG DARI PELADEN TIDAK DAPAT DIURUNGKAN DARI SINI
      // ======================================================================
      //
      // Jejak di peladen dipotong bila isinya panjang - ia dibuat untuk
      // MELIHAT apa yang berubah, bukan untuk mengembalikannya. Menekan
      // "Kembalikan yang sebelumnya" atas jejak yang terpotong akan menimpa
      // variabelnya dengan potongan, dan hasilnya terlihat seperti keterangan
      // yang utuh.
      //
      // Salinan lengkapnya ada di peramban tempat perubahan itu dikerjakan.
      // Karena itu tombolnya tidak digambar di sini, dan sebabnya disebut -
      // bukan dibiarkan tampak seperti fitur yang rusak.
      if (catatan.dariPeladen) {
        kartu.appendChild(
          buatElemen(
            "div",
            "aleta-abt-kabar",
            catatan.dipotong
              ? "Dicatat dari peramban lain, dan isinya dipotong. Kembalikan dari peramban tempat perubahan ini dikerjakan."
              : "Dicatat dari peramban lain. Kembalikan dari peramban tempat perubahan ini dikerjakan."
          )
        );
        wadahRiwayat.appendChild(kartu);
        continue;
      }

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
  kaki.title = "Usulan dari ALETA. Disimpan lewat tombol simpan ABT sendiri.";
  // Pita identitas TIDAK diulang di kaki - ia sudah di kepala, dua jengkal
  // di atasnya. Sama dengan panel SIPP dan ALETA. Penggantian pita saat
  // pengguna termuat karena itu hanya menyentuh yang di kepala.

  // Kaki yang sama dengan panel SIPP dan ALETA: satu baris, segarkan
  // sebagai ikon di kanan. Panel ini dibangun sekali saat halaman dibuka;
  // tanpa ini, usulan yang baru diubah di ALETA tidak pernah terbaca
  // sampai halaman ABT dimuat ulang - dan memuat ulang halaman ABT
  // membuang isian blangko yang belum disimpan.
  const barisKaki = buatElemen("div", "aleta-kaki-baris");

  // Pintasan yang SUNGGUH ada sasarannya di panel ini. Selain menyebutkannya,
  // barisnya juga yang mendorong ikon segarkan dan nomor seri ke kanan lewat
  // margin otomatisnya - tanpa baris ini keduanya berdiri di kiri.
  const PINTASAN_ABT = [
    // Kuncinya kunci POSISI, bukan id panelnya. Menciut lewat Alt+A dahulu
    // menyimpan keadaannya ke kunci "aleta-panel-abt" - tempat yang tidak
    // pernah dibaca siapa pun - sehingga lencananya tidak pernah pulih, dan
    // tombol "Kembalikan posisi panel" di popup tidak menjangkaunya.
    { tombol: "Alt+A", kunci: "a", nama: "ciutkan / bentangkan panel", jalankan: (p) => alatCiutkan(p, KUNCI_POSISI_ABT) },
    {
      tombol: "Alt+P",
      kunci: "p",
      nama: "isi blangko dari SIPP",
      jalankan: (p) => alatTekanPertama(p, ".aleta-abt-aksi .aleta-permintaan-tombol"),
    },
    {
      tombol: "Alt+R",
      kunci: "r",
      nama: "buka Lihat riwayat perubahan",
      jalankan: (p) => {
        for (const t of Array.from(p.querySelectorAll(".aleta-permintaan-tombol"))) {
          if (/riwayat/i.test(t.textContent || "")) {
            t.click();
            return;
          }
        }
      },
    },
    {
      tombol: "Alt+Enter",
      kunci: "Enter",
      nama: "susun keterangan saksi 1 & 2",
      jalankan: (p) => {
        // Yang sudah tergambar didahulukan: bila borangnya terbuka, Enter
        // menyusun - bukan membuka borang yang sama sekali lagi.
        for (const t of Array.from(p.querySelectorAll(".aleta-permintaan-tombol"))) {
          if (/susun keterangan saksi 1 & 2|susun keterangan kedua saksi/i.test(t.textContent || "") && !t.disabled) {
            t.scrollIntoView({ block: "nearest" });
            t.click();
            return;
          }
        }
        for (const t of Array.from(p.querySelectorAll(".aleta-permintaan-tombol"))) {
          if (/susun keterangan saksi 1 & 2/i.test(t.textContent || "") && !t.disabled && !t.hidden) {
            t.scrollIntoView({ block: "nearest" });
            t.click();
            return;
          }
        }
      },
    },
  ];
  barisKaki.appendChild(alatBarisPintasan(PINTASAN_ABT));
  alatPasangPintasan(PENANDA_ABT, PINTASAN_ABT);

  const segar = buatElemen("button", "aleta-kaki-segar", "↻");
  segar.type = "button";
  segar.setAttribute("aria-label", "Segarkan");
  segar.title = "Segarkan - membaca ulang usulan dari ALETA. Halaman ABT tidak dimuat ulang, dan isian blangko yang belum disimpan tidak hilang.";
  segar.addEventListener("click", () => {
    segar.disabled = true;
    segar.classList.add("aleta-kaki-segar-jalan");
    // ======================================================================
    // MEMBUANG PANELNYA SAJA MEMBUAT TOMBOL INI MENGHAPUS PANEL SELAMANYA
    // ======================================================================
    //
    // Dahulu baris di sini hanya membuang panel lalu memanggil pasang().
    // Tetapi pasang() keluar pada baris pertamanya selama sudahDipasang masih
    // menyala - dan ia menyala sejak panel pertama dibangun. Hasilnya: panel
    // hilang, tidak ada yang menggantikannya, dan satu-satunya jalan kembali
    // adalah memuat ulang halaman ABT - yang membuang isian blangko yang
    // belum tersimpan.
    //
    // buangPanelAbt melakukan keduanya sekaligus: membuang panelnya DAN
    // memadamkan penandanya, sehingga pasang() benar-benar membangun ulang.
    buangPanelAbt();
    void pasang();
  });
  barisKaki.appendChild(segar);
  try {
    const seri = chrome.runtime.getManifest().version;
    if (seri) {
      const versi = buatElemen("span", "aleta-kaki-versi", `v${seri}`);
      versi.title = "Seri ekstensi ALETA yang terpasang.";
      barisKaki.appendChild(versi);
    }
  } catch {
    /* di luar konteks ekstensi */
  }
  kaki.appendChild(barisKaki);
  panel.appendChild(kaki);
  void muatPenggunaAleta().then((pengguna) => {
    // Hak unggah putusan (9 Okt 2026): bagian unggah yang tergambar sebelum
    // peran terbaca diganti kotak terkunci bila perannya tidak berhak.
    abtKunciUnggahBilaTolak(panel);
    // Tombol yang akan ditolak disembunyikan begitu kewenangannya diketahui.
    // Menawarkan tombol lalu menolaknya sesudah ditekan terbaca sebagai
    // kerusakan, bukan sebagai pembatasan yang disengaja.
    if (!bolehAbt("blangko-abt")) {
      for (const tombol of [tombolSipp, tombolSaksi, tombolItsbat, tombolPositaLain, tombolSdg]) tombol.hidden = true;
      kabar.textContent =
        "Peran Anda tidak diberi akses panel blangko ABT. Panel ini hanya menampilkan keterangan.";
    }
    if (!pengguna) return;
    const kepalaBaru = pitaIdentitasAbt(pengguna);
    pitaKepala.replaceWith(kepalaBaru);
    pitaKepala = kepalaBaru;
  });

  /**
   * Tombol "Tuliskan huruf alasan" yang menunggu dipasang di baris tindakan
   * bersama "Terapkan yang dicentang" - lihat catatannya di gambarHuruf.
   */
  let hurufMenunggu = null;

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
      // Tidak ada baris tindakan di sini - tombol hurufnya dipasang sendiri,
      // supaya ia tidak hilang bersama daftar yang kosong.
      if (hurufMenunggu) {
        wadahUsulan.appendChild(hurufMenunggu.tombol);
        hurufMenunggu = null;
      }
      return;
    }

    const terap = buatElemen("button", "aleta-permintaan-tombol", "Terapkan yang dicentang");
    terap.type = "button";
    const hasilTerap = buatElemen("div", "aleta-abt-kabar");
    const barisTindakan = buatElemen("div", "aleta-abt-tindakan");
    barisTindakan.appendChild(terap);
    // Perbaikan 30 Sep sore butir 6 (Baru dan UI Baru saja): "Tuliskan huruf
    // alasan" digabung ke tombol ini - tombol hurufnya tetap di DOM, tidak
    // tampak, dan ditekan oleh tombol ini sesudah usulan diterapkan. Dalam
    // Lama keduanya tetap dua tombol seperti sebelumnya.
    const hurufGabung = hurufMenunggu && typeof soreAktif === "function" && soreAktif() ? hurufMenunggu : null;
    if (hurufMenunggu) {
      barisTindakan.appendChild(hurufMenunggu.tombol);
      hurufMenunggu = null;
    }
    if (hurufGabung) {
      hurufGabung.tombol.setAttribute("data-sore-tampak", "tidak");
      terap.title = "Menerapkan usulan yang dicentang, lalu menuliskan huruf alasan yang dicentang ke 8503.";
    }
    wadahUsulan.appendChild(barisTindakan);
    wadahUsulan.appendChild(hasilTerap);

    terap.addEventListener("click", async () => {
      // Yang menentukan ISI YANG TERBACA SEKARANG, bukan usulan semula -
      // petugas boleh menyuntingnya di kartu sebelum menekan tombol ini.
      const dipilih = pilih.filter((x) => x.centang.checked && x.nilai());
      const hurufIkut = Boolean(hurufGabung && hurufGabung.adaCentang());
      if (hurufIkut && dipilih.length === 0) {
        hasilTerap.textContent = "";
        hurufGabung.tombol.click();
        return;
      }
      if (hurufIkut) {
        // Huruf ditulis SESUDAH usulan selesai - satu permintaan ke ABT dalam
        // satu waktu, sama dengan penerapan berurutan.
        terap.addEventListener("aleta-sore-terap-selesai", () => hurufGabung.tombol.click(), { once: true });
      }
      if (dipilih.length === 0) {
        hasilTerap.textContent = "Tidak ada yang dicentang.";
        return;
      }
      terap.disabled = true;
      hasilTerap.className = "aleta-abt-kabar";
      let ringkasan = null;
      try {
        ringkasan = await terapkanUsulanBerurutan(dipilih, jatiDiri, (teks) => {
          hasilTerap.textContent = teks;
        });
      } catch (galat) {
        // Tidak ditelan: penerapan yang terhenti di tengah disebut.
        hasilTerap.className = "aleta-abt-kabar aleta-abt-gagal";
        hasilTerap.textContent = `Penerapan terhenti: ${String((galat && galat.message) || galat)}`;
      } finally {
        terap.disabled = false;
      }
      if (hurufIkut) terap.dispatchEvent(new CustomEvent("aleta-sore-terap-selesai"));
      if (!ringkasan) return;
      const { berhasil, gagal } = ringkasan;
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
      gambarSepihak(null);
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
      // Mentah dari penyunting tanya-jawab ABT, bukan teks layar yang sudah
      // melewati replace_ket_saksi - lihat bacaKeteranganSaksiUsulan.
      const bacaan = await bacaKeteranganSaksiUsulan(peta);
      const teks1 = bacaan.teks1;
      const teks2 = bacaan.teks2;
      if (!teks1.trim() && !teks2.trim()) {
        throw new Error(
          bacaan.catatan.length
            ? `Keterangan saksi tidak terbaca - ${bacaan.catatan.join("; ")}.`
            : "Keterangan saksi 1 dan saksi 2 masih kosong di halaman ini."
        );
      }
      const isiJawaban = await mintaUsulan(muatanUsulanSaksi(peta, bacaan));
      const saksi = isiJawaban.saksi || {};
      kabar.textContent =
        `Terbaca ${saksi.butir?.saksi1 || 0} butir dari saksi 1 dan ${saksi.butir?.saksi2 || 0} dari saksi 2` +
        (bacaan.catatan.length ? ` (${bacaan.catatan.join("; ")})` : "") +
        ".";
      gambarSelisih(saksi.selisih || []);
      gambarSepihak(saksi);
      gambarHuruf(saksi.huruf || [], saksi.hurufBelumSiap || []);
      gambarUsulan(saksi.usulan || []);
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
    } finally {
      tombolSaksi.disabled = false;
    }
  });

  /**
   * ==========================================================================
   * ISI DARI POSITA PERMOHONAN (ITSBAT NIKAH)
   * ==========================================================================
   */
  tombolItsbat.addEventListener("click", async () => {
    tombolItsbat.disabled = true;
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = "Membaca posita permohonan…";
    try {
      const peta = barisVariabel();
      const posita = peta.get(VAR_POSITA) ? peta.get(VAR_POSITA).selNilai.innerText : "";
      if (!posita.trim()) {
        throw new Error("Posita permohonan masih kosong di halaman ini. Ambil positanya lebih dulu.");
      }
      const isiJawaban = await mintaUsulan(muatanUsulanItsbat(posita));
      const itsbat = isiJawaban.itsbat || {};
      if (itsbat.ok === false) throw new Error(itsbat.alasan || "Posita tidak dapat dibaca.");
      // Bot menyerahkan variabel yang bawaan ABT-nya terukur lebih tepat
      // (bawaanAbt) - disebut sebagai tawaran ABT, sama dengan perkara lain.
      // Bot lama tanpa bawaanAbt: kabarnya tetap catatan saja.
      kabar.textContent = kabarPositaLain(itsbat, peta);
      gambarSelisih([]);
      gambarSepihak(null);
      gambarHuruf([], []);
      gambarUsulan(itsbat.usulan || []);
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
    } finally {
      tombolItsbat.disabled = false;
    }
  });

  /**
   * ==========================================================================
   * ISI DARI POSITA PERMOHONAN - PERKARA LAIN (sumber 'posita-lain')
   * ==========================================================================
   *
   * Hanya variabel yang lulus gerbang ukur yang diusulkan bot; yang belum
   * disebut beserta angkanya, bukan disembunyikan. Penerapannya lewat
   * "Terapkan yang dicentang" yang sama: berurutan, satu edit_data sesudah
   * yang sebelumnya dijawab ABT, tanpa jeda buatan.
   */
  tombolPositaLain.addEventListener("click", async () => {
    tombolPositaLain.disabled = true;
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = "Membaca posita permohonan…";
    try {
      const peta = barisVariabel();
      const posita = peta.get(VAR_POSITA) ? peta.get(VAR_POSITA).selNilai.innerText : "";
      if (!posita.trim()) {
        throw new Error("Posita permohonan masih kosong di halaman ini. Ambil positanya lebih dulu.");
      }
      const nomor = nomorPerkaraAbt();
      const isiJawaban = await mintaUsulan(muatanUsulanLain(posita, nomor));
      const lain = isiJawaban.positaLain || {};
      if (lain.ok === false) {
        throw new Error(SEBAB_POSITA_LAIN[lain.alasan] || lain.alasan || "Posita tidak dapat dibaca.");
      }
      if (!lain.ok) throw new Error("ALETA Bot belum mengenal pengisian perkara lain dari posita.");
      // Hanya variabel blangko ini; bawaan ABT disebut sebagai TAWARAN yang
      // wajib diperiksa - lihat kabarPositaLain.
      kabar.textContent = kabarPositaLain(lain, peta);
      gambarSelisih([]);
      gambarSepihak(null);
      gambarHuruf([], []);
      gambarUsulan(lain.usulan || []);
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
    } finally {
      tombolPositaLain.disabled = false;
    }
  });

  /**
   * ==========================================================================
   * SUSUN KETERANGAN DUA SAKSI
   * ==========================================================================
   */
  /**
   * Pratinjau keterangan N saksi.
   *
   *   hasil      jawaban bot (saksiSdg): saksi[] {ke, pihak, jawaban[{no, tanya,
   *              jawab, perluDiisi, pilihan?, varian{indeks,n,habis}}]}, dan
   *              saksi1/saksi2 untuk bot lama
   *   kolomSaksi [{pihak, ke, kode}] dari borang, dalam urutan yang sama dengan
   *              saksi[] yang dikirim - kode = variabel tanya-jawab tujuan
   */
  function gambarPratinjauSdg(hasil, urutan, templat, sudahAda, kolomSaksi) {
    const kotak = buatElemen("div", "aleta-sdg-hasil");

    const ringkas = [];
    if (hasil.alasan && hasil.alasan.length) {
      ringkas.push(
        `Alasan yang dipakai: ${hasil.alasan.join(", ")}` +
          (hasil.asalAlasan === "posita" ? " (dibaca dari gugatan/permohonan)." : " (dipilih).")
      );
    }
    if (hasil.catatan) ringkas.push(hasil.catatan);
    if (hasil.identik) ringkas.push(`${hasil.identik} jawaban masih sama persis pada saksi 1 dan saksi 2 - ubah salah satunya.`);
    kotak.appendChild(buatElemen("div", "aleta-abt-catatan", ringkas.join(" ")));
    const p6Peringatan = p6GambarPeringatan(hasil); // P5P6 10 Okt
    if (p6Peringatan) kotak.appendChild(p6Peringatan);
    /* === JENIS3 11 Okt === */
    if (hasil.kalimatPokokJenis && hasil.kalimatPokokJenis.ringkas) {
      const pokok = buatElemen(
        "div",
        "aleta-abt-catatan",
        `Pokok keterangan saksi ${hasil.kalimatPokokJenis.nama || ""} (dari posita, hanya fakta terukur - periksa sebelum dipakai): ${hasil.kalimatPokokJenis.ringkas}`
      );
      if (hasil.kalimatPokokJenis.lengkap) {
        const rinci = buatElemen("div", "", hasil.kalimatPokokJenis.lengkap);
        rinci.style.whiteSpace = "pre-wrap";
        pokok.appendChild(rinci);
      }
      kotak.appendChild(pokok);
    }
    /* === AKHIR JENIS3 === */

    const perlu = new Set((hasil.perluDiisi || []).map((x) => String(x.no)));
    const diisiGugatan = new Set((hasil.terisiDariPosita || []).map((x) => String(x.no)));

    // ========================================================================
    // SATU KOLOM PER SAKSI - SAMPAI EMPAT SAKSI P DAN DUA SAKSI T
    // ========================================================================
    //
    // Bot mengirim saksi[] (K6). Bot lama hanya mengirim saksi1/saksi2; saat
    // itu hanya dua kolom pertama yang terisi, dan itu disebut.
    const dariBot = Array.isArray(hasil.saksi) && hasil.saksi.length
      ? hasil.saksi.map((s) => s.jawaban || [])
      : [hasil.saksi1 || [], hasil.saksi2 || []];
    const daftarKolom = (kolomSaksi && kolomSaksi.length ? kolomSaksi : [
      { pihak: "P", ke: 1, kode: VAR_SAKSI_1 },
      { pihak: "P", ke: 2, kode: VAR_SAKSI_2 },
    ]).slice(0, Math.max(1, dariBot.length));
    if (dariBot.length < (kolomSaksi || []).length) {
      kotak.appendChild(
        buatElemen(
          "div",
          "aleta-abt-catatan aleta-abt-gagal",
          `ALETA Bot hanya menyusun ${dariBot.length} dari ${kolomSaksi.length} saksi yang diminta - bot belum mengenal saksi ke-3 dan seterusnya.`
        )
      );
    }

    // ========================================================================
    // KETERANGANNYA DAPAT DIGESER, DISALIN, DITAMBAH, DAN DIHAPUS
    // ========================================================================
    //
    // Templat ABT menyusun enam belas tanya-jawab dengan urutan tetap, dan
    // persidangan tidak pernah persis begitu: satu pertanyaan tidak jadi
    // ditanyakan, satu jawaban sebenarnya milik saksi yang lain, satu hal
    // muncul di luar daftar. Sampai sekarang jalan keluarnya mengetik ulang
    // di kotak yang sudah terisi.
    //
    // Yang disimpan ke ABT selalu dinomori ULANG menurut posisinya
    // (lihat `no: String(n + 1)` pada penyimpanan di bawah), jadi memindahkan
    // dan menghapus baris aman - nomornya mengikuti, bukan tertinggal.
    //
    // MENYEBERANG = DISISIPKAN, bukan menimpa. Diputuskan pengguna 16
    // September 2026: jawaban yang dipindahkan ke saksi seberang menjadi
    // baris TAMBAHAN di sana. Menimpa akan menghapus keterangan yang sudah
    // benar tanpa dapat dibatalkan. Dengan lebih dari dua saksi, "seberang"
    // adalah saksi BERIKUTNYA (saksi terakhir menyeberang ke saksi pertama).
    //
    // JAWABAN BERPILIHAN (pilihan[] dua atau lebih - pilihan berlawanan dari
    // templat, atau hubungan saksi yang templatnya menyebut dua orang) harus
    // DIPILIH petugas sebelum keterangan dapat disimpan. Menyimpan kedua
    // kemungkinan sekaligus membuat saksi menyatakan dua hal yang berlawanan.
    const dataSaksi = dariBot.slice(0, daftarKolom.length).map((daftar) =>
      daftar.map((b) => {
        const pilihan = Array.isArray(b.pilihan) ? b.pilihan.map(String).filter(Boolean) : [];
        const varian = b.varian && typeof b.varian === "object" ? b.varian : null;
        return {
          no: String(b.no),
          tanya: b.tanya,
          jawab: b.jawab,
          pilihan: pilihan.length >= 2 ? pilihan : null,
          dipilih: false,
          habis: Boolean(varian && varian.habis),
          nVarian: varian ? Number(varian.n) || 1 : 0,
        };
      })
    );
    const namaKolom = (k) => `Saksi ${daftarKolom[k].ke} ${daftarKolom[k].pihak}`;
    const seberang = (k) => (k + 1) % dataSaksi.length;

    const dua = buatElemen("div", "aleta-sdg-dua");
    // Dipegang tetap: penyimpan di bawah menutupnya dalam closure, jadi
    // isinya yang diganti, bukan wadahnya.

    // ========================================================================
    // BILAH TATA LETAK - TOMBOLNYA DI UJUNG KANAN
    // ========================================================================
    //
    // Di LUAR `dua`, dan itu bukan kebetulan: gambarKolom() mengosongkan
    // `dua` tiap kali barisnya digeser, disalin, atau dihapus. Tombol yang
    // duduk di dalamnya akan lenyap pada penggeseran pertama.
    const bilahTata = buatElemen("div", "aleta-sdg-tata");
    bilahTata.appendChild(
      buatElemen("span", "aleta-abt-label", `Keterangan ${dataSaksi.length} saksi`)
    );
    const tombolTata = buatElemen("button", "aleta-sdg-tata-tombol");
    tombolTata.type = "button";

    function segarkanTata() {
      const tumpuk = tataSaksi === "tumpuk";
      dua.classList.toggle("aleta-sdg-tumpuk", tumpuk);
      // Tulisannya menyebut yang AKAN terjadi bila ditekan, bukan keadaan
      // sekarang. Tombol yang menyebut keadaan sekarang dibaca separuh orang
      // sebagai keadaan dan separuh lagi sebagai tindakan, dan yang salah
      // membacanya menekannya dua kali lalu menyerah.
      tombolTata.textContent = tumpuk ? "⬍ Jadikan berdampingan" : "⬌ Jadikan atas-bawah";
      tombolTata.title = tumpuk
        ? "Sekarang atas-bawah. Tekan untuk menjajarkan keterangan para saksi berdampingan."
        : "Sekarang berdampingan. Tekan untuk menumpuk keterangan saksi satu di atas yang lain - berguna pada panel sempit.";
      tombolTata.setAttribute("aria-pressed", tumpuk ? "true" : "false");
    }

    tombolTata.addEventListener("click", () => {
      simpanTataSaksi(tataSaksi === "tumpuk" ? "damping" : "tumpuk");
      segarkanTata();
    });
    bilahTata.appendChild(tombolTata);
    segarkanTata();
    const kolomIsian = dataSaksi.map(() => []);
    let sedangDiseret = null;

    const simpan = buatElemen("button", "aleta-permintaan-tombol", "");
    simpan.type = "button";
    const kabarPilih = buatElemen("div", "aleta-abt-catatan aleta-sdg-kabar-pilih");

    /** Jawaban berpilihan yang belum dipilih - penyimpanan tertahan selama ada. */
    function belumDipilih() {
      const belum = [];
      dataSaksi.forEach((daftar, k) => {
        daftar.forEach((b, i) => {
          if (b.pilihan && !b.dipilih) belum.push(`${namaKolom(k)} no. ${i + 1}`);
        });
      });
      return belum;
    }

    function segarkanSimpan() {
      const belum = belumDipilih();
      simpan.disabled = belum.length > 0 || sedangMenyimpan;
      simpan.textContent = `Simpan keterangan ${dataSaksi.length} saksi ke ABT (sidang ke-${urutan})`;
      kabarPilih.hidden = belum.length === 0;
      kabarPilih.textContent = belum.length
        ? `${belum.length} jawaban berpilihan belum dipilih (${belum.join(", ")}). Simpan tertahan sampai semuanya dipilih.`
        : "";
    }
    let sedangMenyimpan = false;

    function pindahkan(dariKolom, dariIndeks, keKolom, keIndeks) {
      const [butir] = dataSaksi[dariKolom].splice(dariIndeks, 1);
      if (!butir) return;
      const batas = Math.max(0, Math.min(keIndeks, dataSaksi[keKolom].length));
      dataSaksi[keKolom].splice(batas, 0, butir);
      gambarKolom();
    }

    function gambarKolom() {
      dua.textContent = "";
      for (let k = 0; k < dataSaksi.length; k += 1) {
        const sb = seberang(k);
        const kolom = buatElemen("div", "aleta-sdg-kolom");
        const kepala = buatElemen("div", "aleta-sdg-judul", namaKolom(k));
        kepala.title = `Disimpan ke variabel ${daftarKolom[k].kode}.`;
        kepala.appendChild(
          buatElemen("span", "aleta-sdg-jumlah", `${dataSaksi[k].length} keterangan`)
        );
        kolom.appendChild(kepala);
        kolomIsian[k].length = 0;

        dataSaksi[k].forEach((b, i) => {
          const tanda = perlu.has(b.no) || (b.pilihan && !b.dipilih)
            ? " aleta-sdg-perlu"
            : diisiGugatan.has(b.no)
              ? " aleta-sdg-dari-gugatan"
              : "";
          const baris = buatElemen("div", `aleta-sdg-baris${tanda}`);
          baris.draggable = true;

          const alat = buatElemen("div", "aleta-sdg-alat");
          alat.appendChild(buatElemen("span", "aleta-sdg-pegangan", "⠿"));
          alat.appendChild(buatElemen("span", "aleta-sdg-nomor", `${i + 1}.`));
          const tanya = buatElemen("div", "aleta-sdg-tanya", b.tanya);
          tanya.contentEditable = "true";
          tanya.title = "Pertanyaannya boleh disunting - yang tersimpan ke ABT yang terbaca di sini.";
          tanya.addEventListener("input", () => {
            b.tanya = tanya.textContent.trim();
          });
          alat.appendChild(tanya);

          const tombol = (teks, judul, kerja) => {
            const tb = buatElemen("button", "aleta-sdg-tombol", teks);
            tb.type = "button";
            tb.title = judul;
            tb.addEventListener("click", kerja);
            alat.appendChild(tb);
          };
          tombol("↑", "Naikkan", () => i > 0 && pindahkan(k, i, k, i - 1));
          tombol("↓", "Turunkan", () => i < dataSaksi[k].length - 1 && pindahkan(k, i, k, i + 1));
          if (dataSaksi.length > 1) {
            tombol("⇄", `Pindahkan ke ${namaKolom(sb)} - disisipkan sebagai baris tambahan`, () =>
              pindahkan(k, i, sb, dataSaksi[sb].length)
            );
            tombol("⧉", `Salin ke ${namaKolom(sb)} - yang ini tetap di tempatnya`, () => {
              dataSaksi[sb].push({ ...b, no: b.no, tanya: b.tanya, jawab: b.jawab });
              gambarKolom();
            });
          }
          tombol("✕", "Hapus keterangan ini", () => {
            dataSaksi[k].splice(i, 1);
            gambarKolom();
          });
          if (b.habis) {
            // Bank kalimat pertanyaan ini lebih sedikit dari jumlah saksi:
            // bentuk kalimat dapat berulang antar saksi. Disebut, bukan
            // disembunyikan - petugas yang memutuskan perlu tidaknya diubah.
            const habis = buatElemen("span", "aleta-tanda aleta-tanda-kuning aleta-sdg-varian-habis", "varian habis");
            habis.title =
              `Bank kalimat pertanyaan ini hanya punya ${b.nVarian || 1} bentuk untuk ${dataSaksi.length} saksi - ` +
              "kalimatnya dapat sama dengan saksi lain. Ubah bila perlu.";
            alat.appendChild(habis);
          }
          baris.appendChild(alat);

          const jawab = document.createElement("textarea");
          jawab.className = "aleta-sdg-jawab";
          jawab.rows = 2;
          jawab.value = b.jawab;
          jawab.addEventListener("input", () => {
            b.jawab = jawab.value;
          });

          if (b.pilihan) {
            // Pilihan tanpa bawaan: tidak satu pun terpilih sampai petugas
            // memilih. "Tulis sendiri" memakai isi kotak apa adanya.
            const pilih = document.createElement("select");
            pilih.className = "aleta-sdg-pilih aleta-sdg-pilihan";
            pilih.title = "Jawaban templat ini berpilihan - pilih yang sesuai keterangan saksi sebelum disimpan.";
            const kosong = document.createElement("option");
            kosong.value = "";
            kosong.textContent = "— pilih jawaban saksi —";
            pilih.appendChild(kosong);
            b.pilihan.forEach((p, n) => {
              const o = document.createElement("option");
              o.value = String(n);
              o.textContent = p;
              pilih.appendChild(o);
            });
            const sendiri = document.createElement("option");
            sendiri.value = "sendiri";
            sendiri.textContent = "Tulis sendiri di kotak di bawah";
            pilih.appendChild(sendiri);
            pilih.value = b.dipilih ? (b.pilihanKe === undefined ? "sendiri" : String(b.pilihanKe)) : "";
            pilih.addEventListener("change", () => {
              if (pilih.value === "") {
                b.dipilih = false;
                b.pilihanKe = undefined;
              } else if (pilih.value === "sendiri") {
                b.dipilih = true;
                b.pilihanKe = undefined;
              } else {
                b.dipilih = true;
                b.pilihanKe = Number(pilih.value);
                b.jawab = b.pilihan[b.pilihanKe];
                jawab.value = b.jawab;
              }
              baris.classList.toggle("aleta-sdg-perlu", !b.dipilih || perlu.has(b.no));
              segarkanSimpan();
            });
            baris.appendChild(pilih);
          }

          if (b.pilihan && !b.dipilih) {
            jawab.title = "Jawaban berpilihan - pilih salah satu di atas sebelum disimpan.";
          } else if (perlu.has(b.no)) {
            jawab.title =
              "Jawaban templat ini masih memuat titik-titik dan tidak terbaca dari gugatan; lengkapi dari keterangan saksi yang sesungguhnya.";
          } else if (diisiGugatan.has(b.no)) {
            jawab.title = "Diisi ALETA dari gugatan - periksa dahulu sebelum disimpan.";
          }
          baris.appendChild(jawab);

          baris.addEventListener("dragstart", (e) => {
            sedangDiseret = { kolom: k, indeks: i };
            baris.classList.add("aleta-sdg-diseret");
            if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
          });
          baris.addEventListener("dragend", () => {
            sedangDiseret = null;
            baris.classList.remove("aleta-sdg-diseret");
          });
          baris.addEventListener("dragover", (e) => {
            if (!sedangDiseret) return;
            e.preventDefault();
            baris.classList.add("aleta-sdg-sasaran");
          });
          baris.addEventListener("dragleave", () => baris.classList.remove("aleta-sdg-sasaran"));
          baris.addEventListener("drop", (e) => {
            e.preventDefault();
            baris.classList.remove("aleta-sdg-sasaran");
            if (!sedangDiseret) return;
            const asal = sedangDiseret;
            sedangDiseret = null;
            if (asal.kolom === k && asal.indeks === i) return;
            pindahkan(asal.kolom, asal.indeks, k, i);
          });

          kolom.appendChild(baris);
          kolomIsian[k].push({ no: b.no, tanya: b.tanya, jawab });
        });

        // Menjatuhkan di ruang kosong kolom berarti "taruh di paling bawah".
        kolom.addEventListener("dragover", (e) => {
          if (sedangDiseret) e.preventDefault();
        });
        kolom.addEventListener("drop", (e) => {
          if (!sedangDiseret) return;
          e.preventDefault();
          const asal = sedangDiseret;
          sedangDiseret = null;
          pindahkan(asal.kolom, asal.indeks, k, dataSaksi[k].length);
        });

        const tambah = buatElemen("button", "aleta-sdg-tambah", "+ Tambah keterangan");
        tambah.type = "button";
        tambah.addEventListener("click", () => {
          dataSaksi[k].push({ no: `t${dataSaksi[k].length + 1}`, tanya: "Pertanyaan baru", jawab: "", pilihan: null, dipilih: false, habis: false, nVarian: 0 });
          gambarKolom();
        });
        kolom.appendChild(tambah);
        dua.appendChild(kolom);
      }
      segarkanSimpan();
    }

    gambarKolom();
    const adaHabis = dataSaksi.some((d) => d.some((b) => b.habis));
    kotak.appendChild(
      buatElemen(
        "div",
        "aleta-abt-catatan",
        "Seret ⠿ untuk memindahkan - ke atas, ke bawah, atau ke kolom saksi lain " +
          "(di sana ia disisipkan sebagai baris tambahan). ⧉ menyalin tanpa memindahkan, " +
          "✕ menghapus. Pertanyaannya sendiri boleh disunting. Nomornya dihitung ulang saat disimpan." +
          (adaHabis ? " Tanda 'varian habis': bentuk kalimat pertanyaan itu lebih sedikit dari jumlah saksi." : "")
      )
    );
    kotak.appendChild(bilahTata);
    kotak.appendChild(dua);

    const hasilSimpan = buatElemen("div", "aleta-abt-kabar");
    if (sudahAda) {
      kotak.appendChild(
        buatElemen(
          "div",
          "aleta-abt-catatan",
          `Sidang ke-${urutan} sudah memuat ${sudahAda} tanya-jawab saksi 1. Menyimpan akan MENIMPANYA - baca dulu sebelum menekan.`
        )
      );
    }
    kotak.appendChild(kabarPilih);
    kotak.appendChild(simpan);
    kotak.appendChild(hasilSimpan);
    const p6Paragraf = p6GambarParagraf(hasil); // P5P6 10 Okt
    if (p6Paragraf) kotak.appendChild(p6Paragraf);
    segarkanSimpan();

    // ========================================================================
    // DISIMPAN BERURUTAN, TANPA JEDA TIRUAN
    // ========================================================================
    //
    // Satu saksi sesudah yang sebelumnya dijawab ABT - satu permintaan simpan
    // dalam satu waktu. Tidak ada tunggu buatan di antaranya: ALETA tidak
    // meniru irama manusia (keputusan 25 September 2026), dan catatan
    // diinput_oleh ABT tetap menyebut akun petugas yang menekan tombol ini.
    simpan.addEventListener("click", async () => {
      const belum = belumDipilih();
      if (belum.length) {
        segarkanSimpan();
        return;
      }
      sedangMenyimpan = true;
      simpan.disabled = true;
      hasilSimpan.className = "aleta-abt-kabar";
      const gagal = [];
      let tersimpan = 0;
      for (let i = 0; i < dataSaksi.length; i += 1) {
        const kodeVar = daftarKolom[i].kode;
        const nama = namaKolom(i);
        if (!kodeVar) {
          gagal.push(`${nama}: tidak ada variabel tanya-jawab untuknya di ABT`);
          continue;
        }
        const baris = kolomIsian[i]
          .map((x, n) => ({ no: String(n + 1), tanya: x.tanya, jawab: x.jawab.value.trim() }))
          .filter((x) => x.jawab);
        hasilSimpan.textContent = `Menyimpan keterangan ${nama} (${i + 1} dari ${dataSaksi.length})…`;
        try {
          const sebelum = nilaiVariabel(kodeVar);
          const r = await kirimTanyaJawab(kodeVar, urutan, baris);
          if (!r.ok) {
            gagal.push(`${nama}: ${r.pesan}`);
            continue;
          }
          tersimpan += 1;
          void catatRiwayat({
            perkaraId: jatiDiri.perkaraId,
            kode: kodeVar,
            nama: `Keterangan ${nama}`,
            sebelum,
            sesudah: `${baris.length} tanya-jawab dari templat ${templat}`,
            cara: `disusun ALETA dari templat ${templat}, diperiksa dan disimpan petugas` + (hasil.asalAlasan === "posita" ? " (sama dengan gugatan)" : ""),
            pada: new Date().toISOString(),
          });
        } catch (galat) {
          gagal.push(`${nama}: ${String((galat && galat.message) || galat)}`);
        }
      }
      sedangMenyimpan = false;
      segarkanSimpan();
      hasilSimpan.className = gagal.length ? "aleta-abt-kabar aleta-abt-gagal" : "aleta-abt-kabar";
      hasilSimpan.textContent = gagal.length
        ? `${tersimpan} tersimpan, ${gagal.length} gagal — ${gagal.join("; ")}`
        : `Keterangan ${tersimpan} saksi tersimpan di ABT. Muat ulang halaman supaya isi variabel keterangan saksi ikut berubah.`;

      // Di halaman penyunting tanya-jawab, barisnya sendiri yang berubah -
      // dan yang membacanya sedang memandang baris itu. Dimuat ulang begitu
      // seluruhnya tersimpan; satu yang gagal berarti pesannya harus tetap
      // terbaca, bukan terhapus oleh pemuatan ulang.
      if (!gagal.length && halamanTanyaJawab()) {
        hasilSimpan.textContent = "Tersimpan. Halaman dimuat ulang…";
        setTimeout(() => location.reload(), 900);
      }
    });

    return kotak;
  }

  function gambarFormSdg(daftarTemplat, urutanAwal, sudahAda, alasanSdg) {
    wadahUsulan.textContent = "";
    const form = buatElemen("div", "aleta-sdg-form");
    const pilihanAlasan =
      alasanSdg && Array.isArray(alasanSdg.pilihan) && alasanSdg.pilihan.length
        ? alasanSdg.pilihan
        : DAFTAR_ALASAN_SDG.map((a) => ({ kunci: a, label: a }));

    const barisTemplat = buatElemen("label", "aleta-sdg-ruas");
    barisTemplat.appendChild(buatElemen("span", "aleta-abt-label", "Templat pertanyaan"));
    const pilihTemplat = document.createElement("select");
    pilihTemplat.className = "aleta-sdg-pilih";
    for (const t of daftarTemplat) {
      const opsi = document.createElement("option");
      opsi.value = t.nilai;
      opsi.textContent = `${t.nama} (${t.kode})`;
      pilihTemplat.appendChild(opsi);
    }
    const bawaan = templatBawaan(daftarTemplat, barisVariabel().has("5197"));
    if (bawaan) pilihTemplat.value = bawaan.nilai;
    barisTemplat.appendChild(pilihTemplat);
    form.appendChild(barisTemplat);

    const barisSidang = buatElemen("label", "aleta-sdg-ruas");
    barisSidang.appendChild(buatElemen("span", "aleta-abt-label", "Disimpan pada sidang ke-"));
    const isiSidang = document.createElement("input");
    isiSidang.type = "number";
    isiSidang.min = "1";
    isiSidang.max = String(BATAS_URUTAN_SIDANG);
    isiSidang.value = String(urutanAwal);
    isiSidang.className = "aleta-sdg-angka";
    barisSidang.appendChild(isiSidang);
    form.appendChild(barisSidang);

    // ======================================================================
    // BANYAK SAKSI - DARI NAMA SAKSI YANG TERCANTUM DI BLANGKO
    // ======================================================================
    //
    // Nama saksi ke-n tiap pihak adalah variabel referensi tanya-jawabnya
    // (VAR_NAMA_SAKSI). Yang terisi di blangko ini menjadi jumlah bawaan;
    // bila tidak satu pun tergambar, bawaannya dua saksi Penggugat seperti
    // semula. Menyimpan untuk saksi yang belum terdaftar di SIPP ditolak ABT
    // sendiri, dan penolakannya disebut per saksi.
    const petaHalaman = barisVariabel();
    const terdaftar = (pihak) =>
      VAR_NAMA_SAKSI[pihak].filter((kode) => petaHalaman.has(kode) && keadaanNilai(nilaiVariabel(kode)) === "terisi").length;
    const adaNamaDiHalaman = (pihak) => VAR_NAMA_SAKSI[pihak].some((kode) => petaHalaman.has(kode));
    const bawaanP = adaNamaDiHalaman("P") ? Math.min(BATAS_SAKSI_SDG.P, Math.max(1, terdaftar("P"))) : 2;
    const bawaanT = adaNamaDiHalaman("T") ? Math.min(BATAS_SAKSI_SDG.T, terdaftar("T")) : 0;

    const barisJumlah = buatElemen("div", "aleta-sdg-ruas aleta-sdg-jumlah-saksi");
    const pilihJumlah = (label, dari, sampai, nilai) => {
      const l = buatElemen("label", "aleta-sdg-ruas");
      l.appendChild(buatElemen("span", "aleta-abt-label", label));
      const s = document.createElement("select");
      s.className = "aleta-sdg-pilih";
      for (let n = dari; n <= sampai; n += 1) {
        const o = document.createElement("option");
        o.value = String(n);
        o.textContent = String(n);
        s.appendChild(o);
      }
      s.value = String(nilai);
      l.appendChild(s);
      barisJumlah.appendChild(l);
      return s;
    };
    const jumlahP = pilihJumlah(`Saksi ${nilaiVariabel(VAR_PIHAK_LAWAN) || "Penggugat"}`, 1, BATAS_SAKSI_SDG.P, bawaanP);
    const jumlahT = pilihJumlah(`Saksi ${nilaiVariabel(VAR_PIHAK_PELAKU) || "Tergugat"}`, 0, BATAS_SAKSI_SDG.T, bawaanT);
    form.appendChild(barisJumlah);

    const barisSdg = buatElemen("label", "aleta-sdg-ruas aleta-sdg-centang");
    const centangSdg = document.createElement("input");
    centangSdg.type = "checkbox";
    centangSdg.checked = true;
    barisSdg.appendChild(centangSdg);
    barisSdg.appendChild(document.createTextNode(" Sama dengan gugatan/permohonan - alasan dibaca dari positanya"));
    form.appendChild(barisSdg);

    // ======================================================================
    // MODUS TIAP SAKSI - SAKSI JARANG TAHU HAL YANG SAMA
    // ======================================================================
    //
    // Tetangga melihat pertengkarannya tetapi tidak tahu sebabnya; orang tua
    // tahu sebabnya dari cerita anaknya tetapi tidak pernah menyaksikan;
    // saudara hanya tahu keduanya sudah pisah rumah. Keterangan yang
    // menyamakan semuanya dapat dipatahkan lawan dengan satu pertanyaan.
    //
    // Yang dipilih di sini menentukan jawaban tiga kelompok pertanyaan -
    // penyebab, menyaksikan, cara mengetahui. Pertanyaan lain tetap dari
    // templat. Bot yang menyusun kalimatnya; panel hanya menyampaikan
    // pilihannya.
    const DAFTAR_MODUS = [
      ["sama", "Tahu seluruh alasan, melihat sendiri"],
      ["sebagian", "Hanya sebagian alasan yang ia ketahui"],
      ["tidak-tahu", "Tahu berselisih & berpisah, tidak tahu sebabnya"],
      ["tidak-melihat", "Tidak pernah menyaksikan pertengkaran"],
      ["dari-cerita", "Tahu dari cerita salah satu pihak"],
      ["tahu-pisah", "Tidak tahu pertengkarannya, hanya tahu sudah pisah"],
    ];
    // ======================================================================
    // KODENYA MENYEBUT PIHAKNYA, BUKAN NAMA RUAS MUATAN
    // ======================================================================
    //
    // Dulu kodenya "pelaku" dan "lawan" - nama ruas yang di panel ini berarti
    // Penggugat dan Tergugat, sedangkan di bot berarti KEBALIKANNYA (pelaku =
    // 0047 = Tergugat/Termohon). Dua arti, satu nama, dan tidak ada satu pun
    // tempat yang memperlihatkan pertukarannya.
    //
    // Sejak 23 September 2026 kodenya menyebut pihaknya langsung, dan nama
    // sebutannya ikut dikirim apa adanya (sumberNama, lihat susunMuatanSdg)
    // supaya bot tidak perlu menafsirkan kode sama sekali.
    const DAFTAR_SUMBER = [
      ["penggugat", "Penggugat/Pemohon"],
      ["tergugat", "Tergugat/Termohon"],
      ["keluarga", "keluarga"],
    ];
    const wadahModus = buatElemen("div", "aleta-sdg-daftar-modus");
    form.appendChild(wadahModus);
    let kendaliModus = [];

    /** Baris modus untuk tiap saksi, digambar ulang tiap jumlahnya berubah. */
    function gambarModus() {
      // Pilihan yang sudah dibuat dipertahankan per saksi.
      const lama = new Map(kendaliModus.map((k) => [`${k.pihak}${k.ke}`, k]));
      wadahModus.textContent = "";
      kendaliModus = [];
      const daftar = [];
      for (let ke = 1; ke <= Number(jumlahP.value); ke += 1) daftar.push({ pihak: "P", ke });
      for (let ke = 1; ke <= Number(jumlahT.value); ke += 1) daftar.push({ pihak: "T", ke });
      daftar.forEach(({ pihak, ke }, urut) => {
        const sebelum = lama.get(`${pihak}${ke}`);
        const baris = buatElemen("div", "aleta-sdg-modus");
        const kode = variabelSaksiSdg(pihak, ke);
        const label = buatElemen("span", "aleta-abt-label", `Saksi ${ke} ${pihak}`);
        label.title = `Disimpan ke variabel ${kode}.`;
        baris.appendChild(label);
        const pilihModus = document.createElement("select");
        pilihModus.className = "aleta-sdg-pilih";
        for (const [nilai, nama] of DAFTAR_MODUS) {
          const o = document.createElement("option");
          o.value = nilai;
          o.textContent = nama;
          pilihModus.appendChild(o);
        }
        // Bawaan: saksi pertama tahu semuanya, yang lain hanya sebagian -
        // bentuk yang paling sering ditemui, dan yang paling sukar dipatahkan.
        pilihModus.value = sebelum ? sebelum.pilihModus.value : urut === 0 ? "sama" : "sebagian";
        baris.appendChild(pilihModus);

        const pilihSumber = document.createElement("select");
        pilihSumber.className = "aleta-sdg-pilih";
        pilihSumber.title = "Siapa yang bercerita kepada saksi ini";
        for (const [nilai, nama] of DAFTAR_SUMBER) {
          const o = document.createElement("option");
          o.value = nilai;
          o.textContent = `cerita dari ${nama}`;
          pilihSumber.appendChild(o);
        }
        if (sebelum) pilihSumber.value = sebelum.pilihSumber.value;
        pilihSumber.hidden = pilihModus.value !== "dari-cerita";
        baris.appendChild(pilihSumber);

        // Alasan yang diketahui saksi ini - hanya bila "sebagian".
        const kotakSebagian = buatElemen("div", "aleta-sdg-alasan aleta-sdg-alasan-saksi");
        const centangSebagian = [];
        const tercentangLama = new Set(sebelum ? sebelum.centangSebagian.filter((c) => c.checked).map((c) => c.value) : []);
        for (const a of pilihanAlasan) {
          const labelAlasan = buatElemen("label", "aleta-sdg-centang");
          const c = document.createElement("input");
          c.type = "checkbox";
          c.value = a.kunci;
          c.checked = tercentangLama.has(a.kunci);
          labelAlasan.appendChild(c);
          labelAlasan.appendChild(document.createTextNode(` ${a.label}`));
          kotakSebagian.appendChild(labelAlasan);
          centangSebagian.push(c);
        }
        kotakSebagian.hidden = pilihModus.value !== "sebagian";
        baris.appendChild(kotakSebagian);

        pilihModus.addEventListener("change", () => {
          pilihSumber.hidden = pilihModus.value !== "dari-cerita";
          kotakSebagian.hidden = pilihModus.value !== "sebagian";
        });
        wadahModus.appendChild(baris);
        kendaliModus.push({ pihak, ke, kode, pilihModus, pilihSumber, centangSebagian });
      });
    }
    jumlahP.addEventListener("change", gambarModus);
    jumlahT.addEventListener("change", gambarModus);
    gambarModus();

    const kotakAlasan = buatElemen("div", "aleta-sdg-alasan");
    kotakAlasan.appendChild(buatElemen("div", "aleta-abt-label", "Atau pilih alasan yang diterangkan saksi"));
    const centangAlasan = [];
    for (const a of pilihanAlasan) {
      const label = buatElemen("label", "aleta-sdg-centang");
      const c = document.createElement("input");
      c.type = "checkbox";
      c.value = a.kunci;
      label.appendChild(c);
      label.appendChild(document.createTextNode(` ${a.label}`));
      kotakAlasan.appendChild(label);
      centangAlasan.push(c);
    }
    kotakAlasan.hidden = centangSdg.checked;
    centangSdg.addEventListener("change", () => {
      kotakAlasan.hidden = centangSdg.checked;
    });
    form.appendChild(kotakAlasan);

    const susun = buatElemen("button", "aleta-permintaan-tombol", "Susun keterangan para saksi");
    susun.type = "button";
    form.appendChild(susun);
    const kabarForm = buatElemen("div", "aleta-abt-kabar");
    form.appendChild(kabarForm);
    wadahUsulan.appendChild(form);

    const wadahPratinjau = buatElemen("div", "aleta-abt-daftar");
    wadahUsulan.appendChild(wadahPratinjau);

    susun.addEventListener("click", async () => {
      susun.disabled = true;
      kabarForm.className = "aleta-abt-kabar";
      kabarForm.textContent = "Mengambil templat dari ABT…";
      wadahPratinjau.textContent = "";
      try {
        const urutan = String(Math.max(1, Number(isiSidang.value) || Number(urutanAwal) || 1));
        const kodeTemplat = pilihTemplat.value;
        const templat = await muatTemplatAbt(kodeTemplat, urutan);
        if (!templat.length) throw new Error("Templat itu kosong di ABT.");
        const alasan = centangSdg.checked ? [] : centangAlasan.filter((c) => c.checked).map((c) => c.value);
        if (!centangSdg.checked && !alasan.length) {
          throw new Error("Pilih sekurang-kurangnya satu alasan, atau centang “sama dengan gugatan”.");
        }
        const pilihanTemplat = daftarTemplat.find((t) => t.nilai === kodeTemplat);
        // Kode kumpulan templat - "A1", "04", "IN1" - ikut menentukan varian
        // kalimat (pemilih ragam K7b). Salinan keterangan saksi lain ('#')
        // memakai nilainya sendiri.
        const kodeKumpulan = pilihanTemplat && pilihanTemplat.kode && pilihanTemplat.kode !== "#" ? pilihanTemplat.kode : kodeTemplat;

        // Templat mentah: hanya dari situ hubungan dua saksi ("#1241# /
        // #1242#") dikenali dengan pasti. Gagal membacanya tidak menghentikan
        // penyusunan - bot lalu menebak dari teks terganti - tetapi disebut.
        const catatanMentah = [];
        let mentah = new Map();
        try {
          mentah = await muatTemplatMentahAbt(kodeTemplat);
        } catch (galat) {
          catatanMentah.push(
            `Templat mentah tidak terbaca (${String((galat && galat.message) || galat)}) - hubungan saksi ditebak dari teks templat.`
          );
        }
        const templatDenganMentah = templat.map((b) => (mentah.has(b.no) ? { ...b, jawabMentah: mentah.get(b.no) } : b));

        kabarForm.textContent = `Menyusun keterangan ${kendaliModus.length} saksi…`;
        const peta = barisVariabel();
        const nomor = nomorPerkaraAbt();
        const muatan = susunMuatanSdg({
          nomorPerkara: nomor,
          templat: templatDenganMentah,
          kodeKumpulan,
          // Id SIPP (syarat bentuk bergender data.syarat.jenisPerkaraId) dan
          // alur_perkara_id - bukan nama, bukan "Gugatan".
          jenisPerkara: idJenisPerkaraSipp(nilaiVariabel(VAR_JENIS_PERKARA) || sebutJenisPerkara(nomor)),
          alur: idAlurPerkaraSipp(nomor),
          alasan,
          posita: centangSdg.checked && peta.get(VAR_POSITA) ? peta.get(VAR_POSITA).selNilai.innerText : "",
          // ================================================================
          // PELAKU = 0047, LAWAN = 0046 - DAN DULU TERTUKAR DI SINI
          // ================================================================
          //
          // Kesepakatannya ditetapkan di puncak berkas ini (VAR_PIHAK_PELAKU =
          // "0047", VAR_PIHAK_LAWAN = "0046") dan dipakai bot di seluruh
          // kalimat bakunya: "pelaku" adalah pihak yang diadukan -
          // Tergugat/Termohon - dan "lawan" adalah pengajunya.
          //
          // Jalur ini satu-satunya yang mengirimnya terbalik. Akibatnya
          // jawaban "siapa yang meninggalkan kediaman bersama" pada panel
          // saksi SDG menyebut pihak yang KELIRU, dan jawaban itu masuk ke
          // berita acara sidang yang ditandatangani.
          //
          // Tetapannya dipakai langsung, bukan nomornya diketik ulang -
          // supaya tidak ada tempat kedua yang dapat tertukar lagi.
          pelaku: (peta.get(VAR_PIHAK_PELAKU) || {}).nilai || "",
          lawan: (peta.get(VAR_PIHAK_LAWAN) || {}).nilai || "",
          // Butir 28 - hanya Baru/UI Baru (gerbang tampilan); Lama tidak berubah.
          upayaDamai: t6Aktif() ? (peta.get("1268") || {}).nilai || "" : "",
          saksi: kendaliModus.map((k) => ({
            pihak: k.pihak,
            ke: kendaliModus.indexOf(k) + 1,
            modus: k.pilihModus.value,
            sumber: k.pilihSumber.value,
            alasan: k.centangSebagian.filter((c) => c.checked).map((c) => c.value),
          })),
        });
        const isiJawaban = await mintaUsulan(muatan);
        const hasil = isiJawaban.saksiSdg || {};
        if (hasil.ok === false) throw new Error(hasil.alasan === "templat_kosong" ? "Templat kosong." : "Keterangan tidak tersusun.");
        const kabarAkhir = [...catatanMentah];
        // JENIS3 11 Okt: perkara non-cerai (hasil.jenisPerkara) memang tidak beralasan perceraian.
        if (centangSdg.checked && !(hasil.alasan || []).length && !hasil.jenisPerkara) {
          kabarAkhir.push("Tidak satu pun alasan terbaca dari posita; jawaban tentang penyebab diambil apa adanya dari templat.");
        }
        if (Array.isArray(isiJawaban.saksiDitolak) && isiJawaban.saksiDitolak.length) {
          kabarAkhir.push(`${isiJawaban.saksiDitolak.length} saksi ditolak penyaring: ${isiJawaban.saksiDitolak.map((x) => x.alasan).join(", ")}.`);
        }
        kabarForm.textContent = kabarAkhir.join(" ");
        wadahPratinjau.appendChild(
          gambarPratinjauSdg(
            hasil,
            urutan,
            pilihanTemplat ? pilihanTemplat.kode : kodeTemplat,
            urutan === String(urutanAwal) ? sudahAda : 0,
            kendaliModus.map((k) => ({ pihak: k.pihak, ke: k.ke, kode: k.kode }))
          )
        );
      } catch (galat) {
        kabarForm.className = "aleta-abt-kabar aleta-abt-gagal";
        kabarForm.textContent = String((galat && galat.message) || galat);
      } finally {
        susun.disabled = false;
      }
    });
  }

  tombolSdg.addEventListener("click", async () => {
    tombolSdg.disabled = true;
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = "Membaca daftar templat ABT…";
    try {
      // Sidang yang dipakai: yang sudah memuat keterangan saksi 1 bila ada -
      // supaya membaca dan menulis menunjuk sidang yang sama - dan bila belum
      // ada, urutan yang tertulis di alamat halaman.
      let urutan = ruasAlamatAbt().d || "1";
      let sudahAda = 0;
      try {
        const ada = await ambilTanyaJawab(VAR_SAKSI_1);
        urutan = String(ada.urutan);
        sudahAda = ada.baris.length;
      } catch {
        /* belum ada keterangan saksi: dipakai urutan dari alamat halaman */
      }
      const daftarTemplat = await daftarTemplatAbt(urutan);
      if (!daftarTemplat.length) {
        throw new Error("ABT tidak menawarkan templat tanya-jawab untuk jenis perkara ini.");
      }
      gambarSelisih([]);
      gambarSepihak(null);
      gambarHuruf([], []);
      // Pilihan alasan dari portal (bas.saksi.alasan-pilihan); sembilan
      // tertanam bila portal dan singgahan tidak menjawab. Gagal membacanya
      // tidak menghentikan borang - tetapi disebut.
      let alasanSdg = null;
      let catatanAlasan = "";
      try {
        alasanSdg = await muatAlasanSdg();
        if (alasanSdg.asal !== "portal") {
          catatanAlasan = ` Pilihan alasan dari ${alasanSdg.asal === "singgahan" ? "salinan terakhir portal" : "daftar tertanam"}.`;
        }
      } catch (galat) {
        catatanAlasan = ` Pilihan alasan portal tidak terbaca (${String((galat && galat.message) || galat)}); dipakai daftar tertanam.`;
      }
      gambarFormSdg(daftarTemplat, urutan, sudahAda, alasanSdg);
      kabar.textContent =
        (sudahAda
          ? `Sidang ke-${urutan} sudah memuat ${sudahAda} tanya-jawab saksi 1; menyimpan akan menimpanya.`
          : `Belum ada keterangan saksi tersimpan; akan disimpan pada sidang ke-${urutan}.`) + catatanAlasan;
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
    } finally {
      tombolSdg.disabled = false;
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

/**
 * Penunjuk yang menentukan di halaman ABT.
 *
 * Halaman blangko dan halaman tanya-jawab memakai kerangka yang sama, jadi
 * yang wajib hanya kerangkanya; sisanya ditandai menurut halamannya.
 */
alatDaftarkanPenunjuk("Kerangka ABT", ["#wrapper", "#content"], { wajib: true });
alatDaftarkanPenunjuk("Menu ABT", ["#cssmenu"], { wajib: true });
alatDaftarkanPenunjuk("Daftar blangko", [".pricing-top", ".pricing_inner_w3ls"], { wajib: false, saat: "halaman blangko" });
alatDaftarkanPenunjuk("Blangko tanya-jawab", ["#tanyajawab", "table.tabel_tanyajawab", "form"], { wajib: false, saat: "halaman tanya-jawab" });

/**
 * Uji 9 Okt: halaman blangko yang dihentikan ABT sendiri - die("<h3>ERROR
 * Variabel #x#</h3>...") - tidak punya tabel, jadi panel tidak lahir dan
 * petugas hanya melihat pesan SQL. Di satker 5 perkara sudah begitu karena
 * isian berpetik (0156 -> 7080 pada 4 perkara, 1214 -> 8529 pada 1 perkara).
 * Yang dikerjakan HANYA menerangkan sebabnya di atas pesan itu - tidak ada
 * yang ditulis ke ABT.
 */
function a3TerangkanHalamanGalat() {
  if (!document.body || document.getElementById("aleta-abt-galat-variabel")) return false;
  if (document.querySelector("#wrapper table td[id]")) return false;
  const teks = String(document.body.textContent || "").slice(0, 6000);
  const m = teks.match(/ERROR\s+Variabel\s*#(\d{3,5})#/i);
  if (!m) return false;
  const kotak = buatElemen("div", "aleta-abt-galat-variabel");
  kotak.id = "aleta-abt-galat-variabel";
  kotak.setAttribute("role", "alert");
  kotak.style.cssText =
    "margin:12px;padding:12px 14px;border:2px solid #b91c1c;border-radius:8px;background:#fef2f2;color:#7f1d1d;font:14px/1.5 system-ui,sans-serif;max-width:860px";
  kotak.appendChild(buatElemen("strong", "", "ALETA: halaman blangko ini dihentikan ABT"));
  kotak.appendChild(buatElemen("div", "", a3SebabBukanAbt(teks)));
  kotak.appendChild(
    buatElemen(
      "div",
      "",
      `Cari isian (data teks) yang dirujuk kueri #${m[1]} dan memuat petik ' atau " - mis. nama kantor kuasa "Partner's" ` +
        `atau nama "Assa'" - lalu ganti petiknya dengan ’ lewat menu edit variabel ABT (atau minta admin ABT). ` +
        "Sesudah itu muat ulang halaman ini."
    )
  );
  document.body.insertBefore(kotak, document.body.firstChild);
  return true;
}

async function pasang() {
  if (sudahDipasang) return;
  const diTanyaJawab = halamanTanyaJawab();
  if (!halamanBlangko() && !diTanyaJawab) {
    try {
      if (/\/abt\//i.test(location.pathname) && (await sedangAktif())) a3TerangkanHalamanGalat();
    } catch {
      /* penerang saja - gagal tidak mengubah apa pun */
    }
    return;
  }
  if (!(await sedangAktif())) return;

  // Di halaman tanya-jawab tidak ada satu pun tautan load_form, jadi jati diri
  // perkaranya tidak dapat dibaca dari sana. Ia tidak diperlukan di situ:
  // penyusun keterangan saksi menulis lewat rute tanya-jawab ABT, yang
  // alamatnya dibaca dari alamat halaman ini sendiri (lihat ruasAlamatAbt).
  const jatiDiri = jatiDiriPerkara() || (diTanyaJawab ? { perkaraId: "", perkTemp: "" } : null);
  if (!jatiDiri) return;

  sudahDipasang = true;
  // Saklar cetak dibaca SEKALI seumur halaman: ia memasang pendengar
  // chrome.storage sendiri, dan memanggilnya lagi saat panel dibangun ulang
  // berarti dua pendengar yang mengerjakan hal yang sama pada tiap perubahan.
  if (!saklarCetakDibaca) {
    saklarCetakDibaca = true;
    await muatSaklarCetak();
    await muatTataSaksi();
    await p6MuatGaya(); // P5P6 10 Okt - gaya paragraf saksi
  }
  pasangSunting(jatiDiri);
  const panel = susunPanelAbt(jatiDiri);
  document.body.appendChild(panel);
  pasangPenjagaCetak(jatiDiri, panel.lapor);
  // Tahap 6: menata panel yang sudah jadi. Dalam tampilan Lama hanya mencatat
  // tanda tampilannya di luar DOM, lalu pulang - lihat blok TAHAP 6.
  t6TataAman(panel, jatiDiri);
  // Perbaikan 30 Sep sore (Baru & UI Baru): menunggu Tahap 6 selesai menata.
  soreTataAman(panel, jatiDiri);
}

let saklarCetakDibaca = false;

/**
 * ============================================================================
 * MENUTUP PANEL BERARTI MEMATIKAN SAKLARNYA - SUPAYA ADA JALAN PULANG
 * ============================================================================
 *
 * Sama persis dengan panel SIPP dan panel portal ALETA. Yang membedakan
 * halaman ini dahulu: × hanya membuang panelnya, dan pasang() tidak pernah
 * dipanggil lagi - sudahDipasang tetap menyala sampai halamannya dimuat
 * ulang. Panel yang ditutup karena menghalangi satu borang karena itu hilang
 * sampai petugas menekan F5, dan kehilangan borang yang sedang diisinya.
 */
function tutupPanelAbt() {
  try {
    void chrome.storage.local.set({ aktif: false });
  } catch {
    /* penyimpanan tidak tersedia: panel tetap ditutup untuk halaman ini */
  }
  buangPanelAbt();
}

/**
 * Membuang kedua panel ABT - panel blangko dan panel putusan massal di
 * halaman depan - beserta penandanya, sehingga keduanya benar-benar dapat
 * dibangun ulang. Penanda yang tertinggal menyala membuat pasang() keluar
 * pada baris pertamanya, dan panelnya tidak pernah kembali.
 */
function buangPanelAbt() {
  for (const panel of Array.from(document.querySelectorAll(".aleta-panel-abt"))) {
    panel.remove();
  }
  sudahDipasang = false;
  sudahDipasangMassalAbt = false;
}

// Saklar dari popup ikon Chrome berlaku seketika di halaman ABT juga.
try {
  chrome.storage.onChanged.addListener((ubah, tempat) => {
    if (tempat !== "local" || !ubah.aktif) return;
    if (ubah.aktif.newValue === false) {
      buangPanelAbt();
      return;
    }
    void pasang();
    void pasangMassalAbt();
  });
} catch {
  /* di luar konteks ekstensi */
}

// Halaman ABT tahu alamat portalnya sendiri - dan petugas yang seharian di
// sini tidak pernah membuka SIPP.
alatCatatAsalPortal();
/**
 * ============================================================================
 * TOMBOL CETAK MILIK ABT SENDIRI MENGHASILKAN "download.rtf"
 * ============================================================================
 *
 * Tiga berkas yang diterbitkan panel sudah bernama nomor perkara. Yang tidak:
 * unduhan dari tombol CETAK milik ABT. Rutenya menjawab tanpa nama berkas yang
 * masuk akal, sehingga Chrome menamainya "download.rtf", "download.pdf",
 * "download (1).rtf" - dan folder unduhan petugas penuh berkas bernama sama
 * yang tidak dapat dibedakan tanpa dibuka satu per satu.
 *
 * ABT tidak dapat diubah dari sini. Yang dapat dikerjakan: memberitahu pekerja
 * latar perkara apa yang sedang terbuka, lalu membiarkannya menamai unduhan
 * bernama umum yang datang dari ABT. Lihat latar.js.
 *
 * Dikirim saat halaman dibuka DAN disegarkan selama petugas masih mengerjakan
 * halaman itu - bukan pada tiap unduhan, sebab unduhan ABT tidak melewati
 * skrip ini sama sekali.
 *
 * Penyegaran itu yang membuat umur lima menit berarti "lima menit sejak
 * terakhir Anda menyentuh halaman ini", bukan "lima menit sejak halaman
 * dibuka". Yang kedua hampir selalu sudah lewat ketika CETAK ditekan:
 * petugas membuka perkara, membaca, menyiapkan blangko, baru mencetak.
 */
function kabarkanKonteksUnduh() {
  const nomor = nomorPerkaraAbt();
  if (!nomor) return;
  try {
    chrome.runtime.sendMessage(
      {
        sumber: "aleta-panel",
        jenis: "konteks-unduh",
        nomor,
        // Dua medan yang menyusun nama berkas, bukan lagi potongan kepala
        // halaman: jenis perkara dan status putusan. Keduanya kosong bila
        // perkaranya belum dikenal - dan nama yang pendek lebih baik daripada
        // nama yang mengarang.
        jenisPerkara: sebutJenisPerkara(nomor),
        statusPutusan: sebutStatusPutusan(nomor),
      },
      () => void chrome.runtime.lastError
    );
  } catch {
    // Pekerja latar sedang tidur atau ekstensi baru dimuat ulang - unduhannya
    // tetap tersimpan, hanya namanya yang tidak berubah.
  }
}

/**
 * ============================================================================
 * DIDEKLARASIKAN DI SINI, DI ATAS PEMANGGILNYA - DAN ITU BUKAN KERAPIAN
 * ============================================================================
 *
 * Dahulu ia berdiri tepat di atas pasangMassalAbt, ratusan baris DI BAWAH
 * pemanggilan ini. Deklarasi `function` terangkat ke atas sehingga
 * pasangMassalAbt sudah dapat dipanggil dari sini; deklarasi `let` TIDAK - ia
 * ada tetapi belum boleh disentuh sampai barisnya sendiri dijalankan.
 *
 * Dan baris pertama pasangMassalAbt justru membacanya:
 *
 *     Uncaught (in promise) ReferenceError:
 *     Cannot access 'sudahDipasangMassalAbt' before initialization
 *
 * Fungsinya async, tetapi badannya berjalan serempak sampai await pertama, dan
 * pembacaan itu ada sebelum await mana pun - jadi ia meledak seketika.
 *
 * Panelnya tetap muncul, dan itulah yang membuatnya tidak pernah terlihat:
 * gelung ulangan di bawah memanggilnya lagi, dan pada panggilan kedua barisnya
 * sudah lewat. Yang tersisa satu error di chrome://extensions tiap halaman ABT
 * dibuka - tanpa satu pun gejala di layar.
 *
 * Itu yang berbahaya. Lencana merah Chrome yang selalu menyala membuat error
 * SUNGGUHAN berikutnya tenggelam; tidak ada yang membuka daftar yang memang
 * selalu merah.
 */
let sudahDipasangMassalAbt = false;

void pasang();
void pasangMassalAbt();
kabarkanKonteksUnduh();

// ==========================================================================
// DISEGARKAN OLEH KEHADIRAN PETUGAS, BUKAN OLEH JAM
// ==========================================================================
//
// Tiap sentuhan pada halaman ini menyegarkan konteksnya, dibatasi sekali tiap
// sepuluh detik supaya tidak menghujani pekerja latar. Yang dipakai peristiwa
// pointerdown - ia mendahului "click", sehingga konteksnya sudah tersimpan
// sebelum tombol CETAK milik ABT sempat menerbitkan unduhannya.
//
// Kembali ke tab ini pun menyegarkan: petugas kerap membuka SIPP di tab lain,
// lalu kembali ke ABT untuk mencetak.
const JEDA_SEGAR_KONTEKS_MS = 10 * 1000;
let segarTerakhir = 0;
function segarkanKonteksUnduh() {
  const sekarang = Date.now();
  if (sekarang - segarTerakhir < JEDA_SEGAR_KONTEKS_MS) return;
  segarTerakhir = sekarang;
  kabarkanKonteksUnduh();
}
document.addEventListener("pointerdown", segarkanKonteksUnduh, true);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") segarkanKonteksUnduh();
});

// ABT memuat sebagian isinya menyusul. Diperiksa beberapa kali, lalu berhenti -
// pengamat yang hidup selamanya pada halaman yang tidak pernah berubah hanya
// menambah kerja tanpa menambah apa pun.
let percobaan = 0;
const jeda = setInterval(() => {
  percobaan += 1;
  void pasang();
  void pasangMassalAbt();
  if ((sudahDipasang && sudahDipasangMassalAbt) || percobaan > 10) clearInterval(jeda);
}, 700);

/*
 * ============================================================================
 * PUTUSAN MASSAL DI ABT - DARI JADWAL SIDANG KE TIGA BERKAS PER PERKARA
 * ============================================================================
 *
 * Halaman blangko ABT (beranda dan daftar per kelompok) selama ini tidak
 * punya panel ALETA sama sekali - panel hanya muncul di halaman variabel satu
 * perkara. Di sinilah pekerjaan massalnya duduk, sebab di sinilah token
 * blangko (a/b) dirender ABT, dan hanya dari halaman ini token itu dapat
 * dibaca tanpa menebak.
 *
 * Alurnya per perkara, berurutan:
 *
 *   RTF     GET  abt/preview?a=&b=&c=<perkara_id>         - ABT mengisi blangko
 *   draf    POST /putusan/unggah-naskah                    - ALETA memotong amar
 *   anonim  POST abt/main/anonim   (bila diunggah/diunduh) - ABT menyamarkan nama
 *   PDF     POST /aleta-bot/abt/pdf (hanya bila diunduh)   - bot (soffice)
 *   SIPP    POST /putusan/unggah-sipp   (bila diminta)     - RTF putusan dan RTF
 *           anonimisasinya dalam satu kiriman
 *
 * TIDAK ADA LAGI KERJA YANG HASILNYA DIBUANG. Sampai 1.167 setelan bawaannya
 * (unggah mati) tetap membuat PDF, anonim, dan PDF anonim - tiga dari lima
 * permintaan per perkara - lalu tidak memakai satu pun, sementara ringkasannya
 * berbunyi "PDF ok · anonim ok". Dan unggah ke SIPP menuntut PDF, padahal
 * 87,7% e-Doc satker berbentuk RTF dan rute unggah-sipp menerima RTF:
 * mematikan PDF membuat unggahannya dilewati ("tidak ada PDF").
 *
 * Satu perkara gagal TIDAK menghentikan sisanya: tiap perkara berdiri
 * sendiri, dan yang gagal dicatat sebabnya di neraca. Ini beda dengan
 * penetapan massal, yang memang berantai.
 *
 * Tidak ada yang tercentang sendiri. Agenda sidang menyodorkan kandidat;
 * yang memutuskan orang.
 */
const PENANDA_MASSAL_ABT = "aleta-panel-abt-massal";
const KUNCI_POSISI_MASSAL_ABT = "posisiPanelAbtMassal";
const ALETA_API_UNGGAH_NASKAH_ABT = "/aleta/api/aleta-ecourt/putusan/unggah-naskah";
const ALETA_API_UNGGAH_SIPP_ABT = "/aleta/api/aleta-ecourt/putusan/unggah-sipp";
/**
 * Harus LEBIH LAMA daripada batas gerbangnya (timeoutMs pada
 * gatewayUnggahPutusanSipp). Dahulu persis sama - tanpa selisih sama sekali -
 * sehingga keduanya menyerah pada saat yang sama, dan yang membatalkan lebih
 * dahulu meninggalkan berkas yang sudah tertulis tanpa barisnya.
 *
 * Urutannya harus menaik dari dalam ke luar (K6): bot 90 detik per konversi,
 * gerbang 120 detik, lalu ekstensi 150 detik. RTF yang kini dikirim apa adanya
 * diubah bot sendiri bila perlu - karena itu gerbangnya dinaikkan, dan batas
 * di sini harus tetap di luarnya.
 */
const BATAS_UNGGAH_MASSAL_MS = 150000;

/** Halaman daftar blangko ABT: ada bilah kelompok di kiri dan kartu berkas di kanan. */
function halamanBerandaAbt() {
  if (halamanBlangko() || halamanTanyaJawab()) return false;
  return Boolean(document.querySelector("#navbar .accordion")) && Boolean(document.querySelector(".pricing_inner_w3ls"));
}

/** Nama pengguna ABT yang sedang masuk - dipakai sebagai olehUsername unggahan. */
function namaPenggunaAbt() {
  const b = document.querySelector("#header .h_right b, .h_right b");
  return b ? String(b.textContent || "").replace(/\s+/g, " ").trim() : "";
}

/**
 * Seluruh berkas blangko yang tergambar di halaman ini, beserta tokennya.
 * Satu kartu = satu blangko; tiap <p><a> di dalamnya = satu berkas RTF.
 */
function berkasBlangkoDiHalaman() {
  const hasil = [];
  for (const kartu of Array.from(document.querySelectorAll(".pricing_inner_w3ls"))) {
    const judul = kartu.querySelector(".pricing-top h3");
    const blangko = judul ? String(judul.textContent || "").replace(/\s+/g, " ").trim() : "";
    if (!blangko) continue;
    for (const tautan of Array.from(kartu.querySelectorAll(".pricing-bottom-bottom a[onclick], .pricing-bottom-bottom a[href*='abt/preview']"))) {
      const token = alatTokenDariTautan(tautan);
      if (!token || !token.a || !token.b) continue;
      const span = tautan.querySelector("span");
      const berkas = String((span || tautan).textContent || "").replace(/^#\s*/, "").replace(/\s+/g, " ").trim();
      if (!berkas) continue;
      hasil.push({ blangko, berkas, a: token.a, b: token.b, d: token.d || "", elemen: tautan });
    }
  }
  return hasil;
}

async function pasangMassalAbt() {
  if (sudahDipasangMassalAbt) return;
  if (!halamanBerandaAbt()) return;
  if (!(await sedangAktif())) return;
  // 1.183.0: submenu berkas yang diklik, untuk mengenali jenis blangko.
  a3CatatMenuBlangko();
  sudahDipasangMassalAbt = true;
  await muatPenggunaAleta();
  const panel = await susunPanelMassalAbt();
  document.body.appendChild(panel);
  // Perbaikan 30 Sep sore (Baru & UI Baru): menu beranda per peran.
  soreTataBerandaAman(panel);
}

async function susunPanelMassalAbt() {
  const panel = buatElemen("div", "aleta-panel aleta-panel-abt aleta-panel-massal");
  panel.id = PENANDA_MASSAL_ABT;
  panel.setAttribute("data-tema", "gelap");
  const kepala = buatElemen("div", "aleta-kepala");
  // ==========================================================================
  // LOGO DI KEPALA - SAMA DENGAN PANEL SIPP DAN ALETA
  // ==========================================================================
  //
  // Panel ini melayang di atas halaman milik aplikasi lain dan tampilannya
  // menyerupai bagian aplikasi itu sendiri. Logo membuat asalnya terbaca
  // sekilas - siapa yang berbicara di sini - tanpa perlu membaca tulisan apa
  // pun. Panel SIPP dan ALETA sudah memasangnya sejak lama; ABT satu-satunya
  // yang tidak, dan itulah yang membuat ketiganya terasa tiga aplikasi.
  //
  // Diukur pada berkasnya: konten.js 2 pemakaian aleta-logo, aleta.js 1,
  // abt.js NOL.
  //
  // Dibungkus try: di luar konteks ekstensi chrome.runtime tidak ada, dan
  // kepala tanpa logo masih kepala - kepala yang gagal dibangun tidak.
  try {
    const logo = document.createElement("img");
    logo.className = "aleta-logo";
    logo.alt = "";
    logo.src = chrome.runtime.getURL("ikon/aleta-32.png");
    logo.addEventListener("error", () => logo.remove());
    kepala.appendChild(logo);
  } catch {
    /* tanpa logo, kepala tetap utuh */
  }
  kepala.appendChild(buatElemen("span", "aleta-merek", "ALETA"));
  kepala.appendChild(buatElemen("span", "aleta-kepala-nama", "Putusan massal · ABT"));
  alatTandaiPeranPanel(panel, penggunaAletaAbt && penggunaAletaAbt.peran);
  panel.appendChild(kepala);
  void alatPasangPanel(panel, kepala, KUNCI_POSISI_MASSAL_ABT, {
    kunciTema: KUNCI_TEMA_PANEL,
    temaHalaman: true,
    peran: penggunaAletaAbt && penggunaAletaAbt.peran,
    // Panel halaman depan ABT. × di sini cukup membuangnya untuk kunjungan
    // ini - tanpa menyentuh saklar induk yang mengatur ketiga halaman -
    // sebab ia lahir kembali sendiri begitu halaman depan ABT dibuka lagi.
    judulTutup: "Tutup panel putusan massal - muncul lagi saat halaman depan ABT dibuka",
    saatTutup: () => {
      panel.remove();
      sudahDipasangMassalAbt = false;
    },
  });

  const isi = buatElemen("div", "aleta-isi");
  panel.appendChild(isi);

  const peta = await alatMuatPetaBlangkoLengkap();
  const keadaan = { peta, sidang: [], tanggal: alatTanggalIso(new Date()), berhenti: false, sedangJalan: false };

  isi.appendChild(bagianPetaBlangkoAbt(keadaan));
  // Keputusan 9 Okt 2026: putusan massal (unggah ke SIPP) hanya Hakim
  // (termasuk Ketua/Wakil), Admin, Super Admin - penggunaAletaAbt sudah
  // terbaca (pasangMassalAbt menunggunya). Pemetaan blangko tetap.
  if (abtTolakUnggahPutusan()) {
    abtPasangKotakTerkunci(isi);
  } else {
    isi.appendChild(bagianMassalAbt(keadaan));
  }

  // ==========================================================================
  // KAKI YANG SAMA DENGAN PANEL SIPP, ALETA, DAN PERKARA ABT
  // ==========================================================================
  //
  // Panel ini satu-satunya yang tidak punya kaki: tanpa baris pintasan, tanpa
  // ikon segarkan, tanpa nomor seri. Yang bekerja berpindah antara tiga panel
  // dalam satu jam, dan bagian bawah yang berbeda-beda membuat tiap panel
  // terasa aplikasi yang lain.
  //
  // Nomor seri di kaki bukan hiasan: ketika ada yang melapor, pertanyaan
  // pertama selalu "seri berapa yang terpasang" - dan di panel inilah
  // pemetaan blangko dikerjakan, tempat laporan paling sering datang.
  //
  // Pintasannya HANYA yang benar-benar bersasaran di panel ini. Menyebut
  // pintasan yang tidak berbuat apa-apa lebih buruk daripada tidak
  // menyebutkannya.
  const kaki = buatElemen("div", "aleta-kaki");
  const barisKaki = buatElemen("div", "aleta-kaki-baris");
  const tekanYangBertulis = (p, pola) => {
    for (const t of Array.from(p.querySelectorAll(".aleta-permintaan-tombol, .aleta-perkakas-aksi"))) {
      if (pola.test(t.textContent || "") && !t.disabled && !t.hidden) {
        t.scrollIntoView({ block: "nearest" });
        t.click();
        return;
      }
    }
  };
  const PINTASAN_MASSAL = [
    {
      tombol: "Alt+A",
      kunci: "a",
      nama: "ciutkan / bentangkan panel",
      jalankan: (p) => alatCiutkan(p, PENANDA_MASSAL_ABT),
    },
    {
      tombol: "Alt+P",
      kunci: "p",
      nama: "periksa dulu - belum dijalankan",
      jalankan: (p) => tekanYangBertulis(p, /periksa dulu/i),
    },
    {
      tombol: "Alt+R",
      kunci: "r",
      nama: "ambil token dari ABT",
      jalankan: (p) => tekanYangBertulis(p, /ambil token dari abt|pemetaan ulang/i),
    },
    {
      tombol: "Alt+Enter",
      kunci: "Enter",
      nama: "jalankan putusan massal",
      jalankan: (p) => tekanYangBertulis(p, /^jalankan$/i),
    },
  ];
  barisKaki.appendChild(alatBarisPintasan(PINTASAN_MASSAL));
  alatPasangPintasan(PENANDA_MASSAL_ABT, PINTASAN_MASSAL);

  const segar = buatElemen("button", "aleta-kaki-segar", "↻");
  segar.type = "button";
  segar.setAttribute("aria-label", "Segarkan");
  segar.title = "Segarkan - menyusun ulang panel dan membaca ulang pemetaan. Halaman ABT tidak dimuat ulang.";
  segar.addEventListener("click", () => {
    segar.disabled = true;
    segar.classList.add("aleta-kaki-segar-jalan");
    const lama = document.getElementById(PENANDA_MASSAL_ABT);
    if (lama) lama.remove();
    void pasangMassalAbt();
  });
  barisKaki.appendChild(segar);

  try {
    const seri = chrome.runtime.getManifest().version;
    if (seri) {
      const versi = buatElemen("span", "aleta-kaki-versi", `v${seri}`);
      versi.title = "Seri ekstensi ALETA yang terpasang.";
      barisKaki.appendChild(versi);
    }
  } catch {
    /* di luar konteks ekstensi */
  }
  kaki.appendChild(barisKaki);
  panel.appendChild(kaki);

  // Pemetaan yang baru bernama - dari popup, atau bawaan cerai - tokennya
  // diambil di latar dari halaman kelompok ABT, lalu daftarnya digambar ulang.
  // Tidak menahan panel: yang membuka panel belum tentu hendak memutus massal.
  void lengkapiTokenPeta(keadaan.peta, () => {}).then((terisi) => {
    if (terisi > 0 && keadaan.gambarPeta) keadaan.gambarPeta();
    if (terisi > 0 && keadaan.muatDaftar) void keadaan.muatDaftar();
  });
  return panel;
}

/* ─── Editor pemetaan blangko ──────────────────────────────────────────── */
function bagianPetaBlangkoAbt(keadaan) {
  const kotak = buatElemen("div", "aleta-bagian");
  const judul = buatElemen("div", "aleta-bagian-judul-statis", "Pemetaan blangko putusan");
  kotak.appendChild(judul);
  const sebab = buatElemen(
    "div",
    "aleta-tetap-sebab aleta-remeh",
    "Jenis perkara → blangko ABT mana yang dipakai. Buka kelompok blangkonya di halaman ini, " +
      "lalu pilih berkasnya dari daftar di bawah; tokennya dibaca dari tautan yang ABT sendiri buat."
  );
  kotak.appendChild(sebab);

  // ==========================================================================
  // YANG SUDAH SELESAI TIDAK PERLU DIPANDANGI SETIAP HARI
  // ==========================================================================
  //
  // Pemetaan adalah pekerjaan sekali jadi: sesudah satu jenis punya berkas dan
  // token, tidak ada lagi yang perlu diputuskan tentangnya. Tetapi barisnya
  // tetap berdiri di paling atas panel, dan pada satker dengan belasan jenis
  // perkara ia mendorong PUTUSAN MASSAL - pekerjaan hariannya - jauh ke bawah
  // layar.
  //
  // Karena itu baris yang lengkap disembunyikan, dan bila SELURUHNYA lengkap
  // bagian ini menyingkir sama sekali, menyisakan satu tombol untuk
  // membukanya kembali. Disembunyikan, bukan dibuang: yang tersimpan tetap
  // utuh dan satu tekanan mengembalikannya.
  const ringkas = buatElemen("div", "aleta-tetap-sebab");
  ringkas.hidden = true;
  kotak.appendChild(ringkas);

  const buka = buatElemen("button", "aleta-perkakas-aksi", "Pemetaan ulang");
  buka.type = "button";
  buka.hidden = true;
  buka.title = "Menampilkan kembali seluruh baris pemetaan, termasuk yang sudah selesai.";
  buka.addEventListener("click", () => {
    keadaan.petaTampilSemua = true;
    gambar();
  });
  kotak.appendChild(buka);

  const tabel = buatElemen("div", "aleta-massal-peta");
  kotak.appendChild(tabel);
  let barisAksiRef = null;

  const berkasDiSini = berkasBlangkoDiHalaman();

  const gambar = () => {
    tabel.textContent = "";
    const jenisSemua = new Set(ALAT_JENIS_LAZIM.map(alatKunciJenis));
    for (const k of Object.keys(keadaan.peta)) jenisSemua.add(k);
    for (const s of keadaan.sidang) if (s.jenis) jenisSemua.add(alatKunciJenis(s.jenis));

    let jumlahLengkap = 0;
    let jumlahSemua = 0;
    for (const kunci of [...jenisSemua].sort()) {
      jumlahSemua += 1;
      // Dihitung dua kali - sekali di sini untuk memutuskan tampil atau tidak,
      // sekali lagi di bawah untuk menyusun tulisannya. Menghitungnya sekali
      // lalu menyimpannya justru membuat keduanya dapat berselisih.
      const sudah = keadaan.peta[kunci] && alatBlangkoLengkap(keadaan.peta[kunci]);
      if (sudah) jumlahLengkap += 1;
      if (sudah && !keadaan.petaTampilSemua) continue;
      const baris = buatElemen("div", "aleta-perkakas-baris");
      const label = kunci.includes("|") && typeof alatSebutKunciPeta === "function"
        ? alatSebutKunciPeta(kunci, keadaan.peta[kunci])
        : ALAT_JENIS_LAZIM.find((x) => alatKunciJenis(x) === kunci) || (keadaan.peta[kunci] && keadaan.peta[kunci].jenisAsli) || kunci;
      const namaJenis = buatElemen("span", "aleta-perkakas-nama", label);
      // Nama lain yang menunjuk baris ini disebut pada judulnya. Tanpa itu,
      // yang mencari "Pengesahan Perkawinan/Istbat Nikah" - nama yang dipakai
      // SIPP pada 403 perkara - tidak menemukan barisnya dan menyimpulkan
      // jenisnya belum didukung.
      const lain = alatNamaLainJenis(kunci);
      if (lain.length > 0) namaJenis.title = `Termasuk nama SIPP: ${lain.join("; ")}`;
      baris.appendChild(namaJenis);
      const ada = keadaan.peta[kunci];
      // Tiga keadaan, disebut apa adanya: lengkap (token ada), bernama saja
      // (token belum diambil - dicari sendiri saat kelompoknya terbaca), belum.
      const lengkap = ada && alatBlangkoLengkap(ada);
      const bernama = ada && alatBlangkoTerpetakan(ada);
      const nilai = buatElemen(
        "span",
        `aleta-perkakas-nilai${lengkap ? "" : " aleta-massal-belum"}`,
        lengkap
          ? `${ada.blangko ? `${ada.blangko} — ` : ""}${ada.berkas}`
          : bernama
            ? `${ada.berkas} — token belum diambil${ada.catatan ? ` (${ada.catatan})` : ""}`
            : "belum dipetakan"
      );
      baris.appendChild(nilai);

      // Nama berkas dapat diketik langsung - untuk blangko yang ada di ABT
      // peladen tetapi belum terbuka di halaman ini.
      const ketik = buatElemen("button", "aleta-perkakas-pulih", "Ketik");
      ketik.type = "button";
      ketik.title = "Ketik nama berkas blangko; tokennya dicari sendiri dari halaman kelompok ABT.";
      ketik.addEventListener("click", () => bukaKetikNama(kunci, label, ada));
      baris.appendChild(ketik);

      const pilih = buatElemen("button", "aleta-perkakas-pulih", "Pilih");
      pilih.type = "button";
      pilih.title = berkasDiSini.length
        ? "Pilih berkas blangko dari halaman ini untuk jenis perkara ini."
        : "Buka kelompok blangkonya lebih dulu (klik salah satu blangko di kiri), lalu tekan Pilih.";
      pilih.disabled = berkasDiSini.length === 0;
      pilih.addEventListener("click", () => bukaPemilihBerkas(kunci, label));
      baris.appendChild(pilih);

      if (ada) {
        const hapus = buatElemen("button", "aleta-perkakas-pulih", "Hapus");
        hapus.type = "button";
        hapus.addEventListener("click", async () => {
          delete keadaan.peta[kunci];
          await alatSimpanPetaBlangko(keadaan.peta);
          alatCatat("massal", `pemetaan blangko dihapus: ${label}`, "");
          gambar();
        });
        baris.appendChild(hapus);
      }
      tabel.appendChild(baris);
    }

    // Jenis yang belum ada di daftar dapat ditambah sendiri.
    const tambah = buatElemen("div", "aleta-massal-tambah");
    const masukan = document.createElement("input");
    masukan.type = "text";
    masukan.className = "aleta-abt-ketik";
    masukan.placeholder = "Jenis perkara lain…";
    const tombol = buatElemen("button", "aleta-perkakas-aksi", "Tambah baris");
    tombol.type = "button";
    tombol.addEventListener("click", () => {
      const k = alatKunciJenis(masukan.value);
      if (!k) return;
      if (!keadaan.peta[k]) keadaan.peta[k] = { jenisAsli: masukan.value.trim() };
      masukan.value = "";
      gambar();
    });
    tambah.appendChild(masukan);
    tambah.appendChild(tombol);
    tabel.appendChild(tambah);

    // ========================================================================
    // TIGA KEADAAN BAGIAN INI, DISEBUT APA ADANYA
    // ========================================================================
    //
    //   tuntas  - seluruh jenis punya token; bagiannya menyingkir, sisa tombol
    //   sebagian- yang selesai disembunyikan, sisanya tetap dikerjakan
    //   terbuka - pengguna menekan "Pemetaan ulang", semuanya tergambar
    //
    // Angkanya SELALU disebut. Bagian yang hilang tanpa keterangan terbaca
    // sebagai kerusakan, bukan sebagai pekerjaan yang sudah selesai.
    const tuntas = jumlahSemua > 0 && jumlahLengkap === jumlahSemua;
    const semua = Boolean(keadaan.petaTampilSemua);

    judul.hidden = tuntas && !semua;
    sebab.hidden = tuntas && !semua;
    tabel.hidden = tuntas && !semua;
    if (barisAksiRef) barisAksiRef.hidden = tuntas && !semua;

    buka.hidden = semua || !tuntas;
    ringkas.hidden = semua || jumlahLengkap === 0;
    if (!ringkas.hidden) {
      ringkas.textContent = tuntas
        ? `Pemetaan blangko putusan selesai - ${jumlahLengkap} jenis perkara sudah bertoken.`
        : `${jumlahLengkap} dari ${jumlahSemua} jenis sudah selesai dan disembunyikan; ` +
          `${jumlahSemua - jumlahLengkap} lagi menunggu.`;
    }

    // Saat semuanya tergambar atas permintaan, jalan kembalinya harus ada -
    // kalau tidak, satu tekanan "Pemetaan ulang" mengunci panel dalam keadaan
    // penuh sampai halaman dimuat ulang.
    if (semua) {
      const tutup = buatElemen("button", "aleta-perkakas-pulih", "Sembunyikan yang selesai");
      tutup.type = "button";
      tutup.addEventListener("click", () => {
        keadaan.petaTampilSemua = false;
        gambar();
      });
      tabel.appendChild(tutup);
    }
  };

  const pemilih = buatElemen("div", "aleta-massal-pemilih");
  pemilih.hidden = true;
  kotak.appendChild(pemilih);

  // Ambil token untuk seluruh baris yang baru bernama - menyusuri kelompok
  // blangko ABT satu per satu; kemajuannya disebut, hasilnya digambar ulang.
  const barisAksi = buatElemen("div", "aleta-abt-aksi");
  const ambil = buatElemen("button", "aleta-perkakas-aksi", "Ambil token dari ABT");
  ambil.type = "button";
  ambil.title = "Mencari tiap berkas yang baru bernama di seluruh kelompok blangko halaman ABT ini.";
  const kabarAmbil = buatElemen("span", "aleta-abt-kabar", "");
  ambil.addEventListener("click", async () => {
    ambil.disabled = true;
    kabarAmbil.textContent = "mencari…";
    try {
      const terisi = await lengkapiTokenPeta(keadaan.peta, (t) => {
        kabarAmbil.textContent = t;
      });
      const belum = Object.values(keadaan.peta).filter((b) => alatBlangkoTerpetakan(b) && !alatBlangkoLengkap(b)).length;
      kabarAmbil.textContent = `${terisi} token terisi${belum ? `, ${belum} berkas tidak ditemukan di ABT ini` : ""}.`;
    } catch (galat) {
      kabarAmbil.textContent = String((galat && galat.message) || galat);
    }
    ambil.disabled = false;
    gambar();
    if (keadaan.muatDaftar) void keadaan.muatDaftar();
  });
  barisAksi.appendChild(ambil);

  // Isi dari pohon blangko portal: set mana untuk jenis apa sudah diputuskan
  // di portal, isi foldernya dibaca bot di peladen. Sesudah nama terisi,
  // tokennya langsung dicari di ABT ini - satu tekanan, dua pekerjaan.
  const dariPohon = buatElemen("button", "aleta-perkakas-aksi", "Isi dari pohon blangko");
  dariPohon.type = "button";
  dariPohon.title =
    "Mengisi baris yang kosong atau bawaan dengan berkas skenario kabul dari set pohon blangko portal. " +
    "Baris yang pernah Anda sunting tidak disentuh.";
  dariPohon.addEventListener("click", async () => {
    dariPohon.disabled = true;
    kabarAmbil.textContent = "membaca pohon blangko dari portal…";
    try {
      const set = await alatAmbilPohonBlangko("");
      keadaan.pohon = set;
      const terisi = alatIsiPetaDariPohon(keadaan.peta, set, {});
      await alatSimpanPetaBlangko(keadaan.peta);
      alatCatat("massal", `pemetaan diisi dari pohon blangko: ${terisi.length} jenis`, terisi.map((x) => `${x.jenis} → ${x.berkas}`).join("; "));
      gambar();
      kabarAmbil.textContent = terisi.length
        ? `${terisi.length} jenis terisi dari pohon - mencari tokennya di ABT…`
        : "Tidak ada baris yang perlu diisi - semua sudah bernama atau pohonnya kosong.";
      if (terisi.length) {
        const token = await lengkapiTokenPeta(keadaan.peta, (t) => {
          kabarAmbil.textContent = t;
        });
        kabarAmbil.textContent = `${terisi.length} jenis terisi dari pohon, ${token} token terisi dari ABT.`;
        gambar();
        if (keadaan.muatDaftar) void keadaan.muatDaftar();
      }
    } catch (galat) {
      kabarAmbil.textContent = String((galat && galat.message) || galat);
    }
    dariPohon.disabled = false;
  });
  barisAksi.appendChild(dariPohon);
  barisAksi.appendChild(kabarAmbil);
  kotak.insertBefore(barisAksi, tabel);
  barisAksiRef = barisAksi;

  function bukaKetikNama(kunci, label, ada) {
    pemilih.textContent = "";
    pemilih.hidden = false;
    pemilih.appendChild(buatElemen("div", "aleta-tetap-sebab", `Nama berkas blangko untuk ${label}:`));
    const masukan = document.createElement("input");
    masukan.type = "text";
    masukan.className = "aleta-abt-ketik aleta-massal-ketik";
    masukan.placeholder = "mis. [01] [Kabul Verstek] Cerai (Format Lengkap)";
    masukan.value = (ada && ada.berkas) || "";
    pemilih.appendChild(masukan);
    if (keadaan.pohon) {
      const daftarNama = document.createElement("datalist");
      daftarNama.id = `aleta-pohon-${kunci.replace(/[^a-z0-9]+/g, "-")}`;
      for (const b of alatBerkasPohonUntukJenis(keadaan.pohon, label)) {
        const o = document.createElement("option");
        o.value = b.berkas;
        o.label = `${b.blangko}${b.kategori ? ` · ${b.kategori}` : ""}`;
        daftarNama.appendChild(o);
      }
      masukan.setAttribute("list", daftarNama.id);
      pemilih.appendChild(daftarNama);
    }
    const simpan = buatElemen("button", "aleta-perkakas-aksi", "Simpan nama");
    simpan.type = "button";
    simpan.addEventListener("click", async () => {
      const nama = masukan.value.replace(/\s+/g, " ").trim();
      if (!nama) return;
      // Nama yang berganti melepas token lama - ia milik berkas yang lain.
      keadaan.peta[kunci] = { jenisAsli: label, berkas: nama, bawaan: false };
      await alatSimpanPetaBlangko(keadaan.peta);
      alatCatat("massal", `pemetaan blangko diketik: ${label} → ${nama}`, "");
      pemilih.hidden = true;
      gambar();
      const hasil = await cariTokenBlangko(nama, (t) => {
        kabarAmbil.textContent = t;
      });
      if (hasil) {
        keadaan.peta[kunci] = { ...alatRapikanBlangko(hasil), jenisAsli: label, bawaan: false };
        await alatSimpanPetaBlangko(keadaan.peta);
        kabarAmbil.textContent = `token ${label} terisi dari ${hasil.blangko}.`;
      } else {
        keadaan.peta[kunci].catatan = "berkas tidak ditemukan di ABT ini";
        kabarAmbil.textContent = `"${nama}" tidak ditemukan di ABT ini - namanya tetap tersimpan.`;
      }
      gambar();
      if (keadaan.muatDaftar) void keadaan.muatDaftar();
    });
    pemilih.appendChild(simpan);
    const batal = buatElemen("button", "aleta-perkakas-aksi", "Batal");
    batal.type = "button";
    batal.addEventListener("click", () => {
      pemilih.hidden = true;
    });
    pemilih.appendChild(batal);
    masukan.focus();
  }

  function bukaPemilihBerkas(kunci, label) {
    pemilih.textContent = "";
    pemilih.hidden = false;
    pemilih.appendChild(buatElemen("div", "aleta-tetap-sebab", `Berkas untuk ${label} — pilih satu:`));
    for (const b of berkasDiSini) {
      const tombol = buatElemen("button", "aleta-massal-berkas", `${b.blangko} — ${b.berkas}`);
      tombol.type = "button";
      tombol.addEventListener("click", async () => {
        keadaan.peta[kunci] = alatRapikanBlangko({ ...b, jenisAsli: label });
        keadaan.peta[kunci].jenisAsli = label;
        await alatSimpanPetaBlangko(keadaan.peta);
        alatCatat("massal", `pemetaan blangko: ${label} → ${b.blangko} / ${b.berkas}`, "");
        pemilih.hidden = true;
        gambar();
      });
      pemilih.appendChild(tombol);
    }
    const batal = buatElemen("button", "aleta-perkakas-aksi", "Batal");
    batal.type = "button";
    batal.addEventListener("click", () => {
      pemilih.hidden = true;
    });
    pemilih.appendChild(batal);
  }

  keadaan.gambarPeta = gambar;
  gambar();
  return kotak;
}

/* ─── Massal ────────────────────────────────────────────────────────────── */
function bagianMassalAbt(keadaan) {
  const kotak = buatElemen("div", "aleta-bagian");
  kotak.appendChild(buatElemen("div", "aleta-bagian-judul-statis", "Putusan massal"));

  const pemilihTanggal = alatPemilihTanggal((t) => {
    keadaan.tanggal = t;
    void muat();
  });
  kotak.appendChild(pemilihTanggal);

  const kabar = buatElemen("div", "aleta-abt-kabar");
  kotak.appendChild(kabar);

  // ==========================================================================
  // CARI, SARING, URUTKAN
  // ==========================================================================
  //
  // Dua puluh perkara sehari sudah melewati satu layar panel, dan yang dicari
  // hampir selalu sebagian kecilnya: yang agendanya pembacaan putusan, yang
  // blangkonya belum siap, atau satu nomor yang diingat sepotong. Tanpa
  // ketiganya, yang mencari menggulung daftar sambil membaca satu per satu -
  // dan pada gulungan kedua ia berhenti membaca.
  //
  // Yang TERCENTANG tidak pernah hilang karena disaring. Saringan mengubah
  // yang TERLIHAT, bukan yang terpilih; centang yang lenyap diam-diam ketika
  // saringan diganti adalah cara paling halus untuk menjalankan perkara yang
  // tidak dimaksudkan - atau melewatkan yang dimaksudkan.
  const bilah = buatElemen("div", "aleta-massal-bilah");
  const cari = document.createElement("input");
  cari.type = "search";
  cari.className = "aleta-massal-cari";
  cari.placeholder = "Cari nomor, jenis, atau agenda…";
  cari.title = "Menyaring daftar di bawah. Yang sudah dicentang tetap terpilih meski tersembunyi.";
  bilah.appendChild(cari);

  const saring = document.createElement("select");
  saring.className = "aleta-massal-saring";
  saring.title = "Tampilkan hanya sebagian perkara.";
  for (const [nilai, teks] of [
    ["semua", "Semua perkara"],
    ["belum", "Belum putus"],
    ["sudah", "Sudah putus"],
    ["siap", "Blangko siap"],
    ["belumBlangko", "Blangko belum dipetakan"],
    ["dicentang", "Yang dicentang saja"],
  ]) {
    const o = document.createElement("option");
    o.value = nilai;
    o.textContent = teks;
    saring.appendChild(o);
  }
  // Perbaikan 1 Okt butir 13-14 (UI Baru saja): saringan "putus / tunda untuk
  // putusan" menjadi bawaan, dan "Hanya majelis saya" / kelompok per hakim.
  const a1Massal = t6Modern() ? a1PasangMassal(keadaan, saring, bilah) : null;
  bilah.appendChild(saring);

  const urut = document.createElement("select");
  urut.className = "aleta-massal-urut";
  urut.title = "Urutan baris pada daftar.";
  for (const [nilai, teks] of [
    ["putus", "Agenda putusan dahulu"],
    ["nomor", "Nomor perkara"],
    ["jenis", "Jenis perkara"],
    ["keadaan", "Belum putus dahulu"],
  ]) {
    const o = document.createElement("option");
    o.value = nilai;
    o.textContent = teks;
    urut.appendChild(o);
  }
  bilah.appendChild(urut);
  kotak.appendChild(bilah);

  const daftar = buatElemen("div", "aleta-massal-daftar");
  kotak.appendChild(daftar);
  // Perbaikan 2 Okt butir 3 (UI Baru): blangko UTAMA di atas daftar.
  const a2Utama = a1Massal
    ? a2PasangBlangkoUtama(kotak, daftar, keadaan, () => {
        lupakanPemeriksaan("Blangko utama diganti");
        gambarDaftar();
      })
    : null;

  // Pilihan pekerjaan. Unggah ke SIPP MENULIS ke berkas perkara sungguhan dan
  // karena itu diminta secara sadar; unduh menaruh berkas di komputer ini dan
  // juga dinyalakan sendiri. PDF dan anonimisasi hanya DIBUAT bila ada yang
  // memakainya - diunduh atau diunggah - dan yang tidak dibuat disebut apa
  // adanya di ringkasan, bukan dilaporkan "ok".
  const pilihan = buatElemen("div", "aleta-massal-pilihan");
  const saklar = (label, kunci, bawaan, judul) => {
    const l = buatElemen("label", "aleta-massal-baris");
    const c = document.createElement("input");
    c.type = "checkbox";
    c.className = "aleta-massal-centang";
    c.checked = bawaan;
    c.dataset.kunci = kunci;
    l.appendChild(c);
    l.appendChild(buatElemen("span", "aleta-massal-nomor", label));
    if (judul) l.title = judul;
    // Rencananya menyebut rantai pekerjaannya - "RTF → draf → PDF → anonim".
    // Mematikan salah satunya sesudah diperiksa membuat rencana itu berbohong.
    c.addEventListener("change", () => lupakanPemeriksaan("Pilihan pekerjaan berubah"));
    pilihan.appendChild(l);
    return c;
  };
  const cDraf = saklar("Simpan draf ke ALETA", "draf", true, "Amar dan pertimbangan dipotong dari RTF, menjadi draf yang diisikan panel SIPP.");
  const cAnonim = saklar(
    "Anonimisasi",
    "anonim",
    true,
    "ABT menyamarkan nama pihak (RTF). Dibuat hanya bila diunggah ke SIPP atau diunduh."
  );
  const cUnduh = saklar(
    "Unduh berkas ke komputer",
    "unduh",
    false,
    "RTF putusan, PDF-nya, dan anonimisasinya diunduh ke folder unduhan. Dinyalakan sendiri."
  );
  const cPdf = saklar(
    "PDF ikut diunduh",
    "pdf",
    true,
    "Lewat bot ALETA (soffice), hanya untuk unduhan - SIPP menerima RTF apa adanya."
  );
  const cUnggah = saklar("Unggah dokumen ke SIPP", "unggah", false, "RTF putusan dan anonimisasinya ditulis ke berkas perkara SIPP dalam satu kiriman. Dinyalakan sendiri.");
  /** Pilihan yang berlaku SEKARANG - dibaca saat diperiksa dan saat dijalankan. */
  const opsiMassal = () => ({
    draf: cDraf.checked,
    pdf: cPdf.checked,
    anonim: cAnonim.checked,
    unduh: cUnduh.checked,
    unggah: cUnggah.checked,
  });
  kotak.appendChild(pilihan);

  const aksi = buatElemen("div", "aleta-abt-aksi");
  // "kering" istilah pemrogram; yang menekannya panitera. Yang perlu dijawab
  // tombol ini satu: apakah menekannya mengubah sesuatu atau tidak.
  const tombolRencana = buatElemen("button", "aleta-permintaan-tombol", "Periksa dulu - belum dijalankan");
  tombolRencana.type = "button";
  const tombolJalan = buatElemen("button", "aleta-permintaan-tombol", "Jalankan");
  tombolJalan.type = "button";
  tombolJalan.disabled = true;
  tombolJalan.title = "Menyala sesudah hasil pemeriksaan di atas dibaca.";
  const tombolHenti = buatElemen("button", "aleta-perkakas-aksi", "Hentikan");
  tombolHenti.type = "button";
  tombolHenti.hidden = true;
  aksi.appendChild(tombolRencana);
  aksi.appendChild(tombolJalan);
  aksi.appendChild(tombolHenti);
  kotak.appendChild(aksi);

  const neraca = buatElemen("div", "aleta-massal-neraca");
  kotak.appendChild(neraca);

  /**
   * ==========================================================================
   * SUDAH DIPERIKSA - DAN APA SAJA YANG MEMBATALKANNYA
   * ==========================================================================
   *
   * Dua tekanan: Periksa menyusun rencananya tanpa menulis apa pun, Jalankan
   * mengerjakannya. Yang menghubungkan keduanya keadaan ini.
   *
   * Sebelum ada penanda ini, rencana yang sudah tergambar TIDAK pernah
   * kedaluwarsa. Petugas memeriksa empat perkara, lalu mencentang tiga lagi,
   * lalu menekan Jalankan - dan ketujuhnya dikerjakan, sementara yang
   * diperlihatkan kepadanya hanya empat. Hal yang sama terjadi bila blangko
   * satu perkara diganti, atau saklar PDF/anonimisasi dimatikan: rencananya
   * menyebut satu hal, yang dikerjakan hal lain. Penetapan massal di panel
   * SIPP sudah lama menjaga ini; panel ABT belum.
   *
   * Yang TIDAK membatalkan: mencari, menyaring, dan mengurutkan. Ketiganya
   * mengubah yang terlihat, bukan yang terpilih - dan yang dijalankan dibaca
   * dari ingatan, bukan dari baris yang tergambar.
   */
  let sudahDiperiksa = false;

  function lupakanPemeriksaan(sebab) {
    // Selagi berjalan, neraca memuat kemajuan tiap perkara. Mengosongkannya
    // di tengah jalan menghapus satu-satunya keterangan tentang apa yang
    // sudah terjadi pada berkas perkara.
    if (keadaan.sedangJalan) return;
    const perluDikatakan = sudahDiperiksa && Boolean(sebab);
    sudahDiperiksa = false;
    tombolJalan.disabled = true;
    tombolJalan.textContent = "Jalankan";
    tombolJalan.title = "Menyala sesudah hasil pemeriksaan di atas dibaca.";
    tombolRencana.textContent = "Periksa dulu - belum dijalankan";
    neraca.textContent = "";
    if (perluDikatakan) {
      neraca.appendChild(
        buatElemen(
          "div",
          "aleta-tetap-sebab",
          `${sebab} - hasil pemeriksaan tadi tidak berlaku lagi. Tekan "Periksa dulu" sekali lagi.`
        )
      );
    }
  }

  const centangPer = new Map();
  /** Nomor perkara yang dicentang - bertahan meski barisnya tersaring keluar. */
  const dicentang = new Set();
  const ringkasTampil = buatElemen("div", "aleta-massal-ringkas", "");
  bilah.appendChild(ringkasTampil);
  for (const medan of [cari, saring, urut]) {
    medan.addEventListener(medan === cari ? "input" : "change", () => gambarDaftar());
    medan.addEventListener("click", (e) => e.stopPropagation());
  }

  // Blangko KHUSUS per perkara - verstek dan contra adalah dua berkas berbeda
  // untuk satu jenis perkara yang sama. Yang dipilih di baris menang atas
  // pemetaan jenisnya; yang tidak dipilih memakai pemetaan jenis.
  const pilihanPer = new Map();
  // Perbaikan 2 Okt sore (P, butir 3): baris pemetaan KHUSUS status putusan menang atas blangko utama.
  const petaUntuk = (s) =>
    pilihanPer.get(s.nomor) || p3PetaStatus(keadaan, s) || (a2Utama && a2Utama.peta()) || p3PetaJenis(keadaan, s);

  async function muat() {
    daftar.textContent = "";
    neraca.textContent = "";
    centangPer.clear();
    lupakanPemeriksaan("");
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = `Membaca sidang ${keadaan.tanggal}…`;
    try {
      keadaan.sidang = a1Massal ? await a1SidangPadaTanggal(keadaan.tanggal) : await alatSidangPadaTanggal(keadaan.tanggal);
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
      return;
    }
    if (keadaan.gambarPeta) keadaan.gambarPeta();
    if (keadaan.sidang.length === 0) {
      kabar.textContent = `Tidak ada sidang pada ${keadaan.tanggal}.`;
      return;
    }
    // Status putusan tiap perkara diingat untuk penamaan berkas - lihat
    // sebutStatusPutusan. Dibaca dari jadwal sidang yang baru saja dimuat,
    // jadi tidak ada permintaan tambahan ke peladen.
    for (const s of keadaan.sidang) {
      statusPutusanPerkara.set(s.nomor, {
        // Jenis perkaranya ikut disimpan sejak 2.20.4: ia bagian tengah nama
        // berkas, dan daftar sidang ini memang sudah memulangkannya. Sebelum
        // ini ia dibuang, lalu tempatnya diisi potongan kepala halaman blangko
        // - yang bukan jenis perkara dan berubah-ubah menurut halamannya.
        jenisPerkara: s.jenis || "",
        statusPutusan: s.statusPutusan || "",
        verstek: Boolean(s.verstek),
      });
    }

    const belumPutus = keadaan.sidang.filter((s) => !s.sudahPutus);
    kabar.textContent =
      `${keadaan.sidang.length} perkara bersidang; ${belumPutus.length} belum putus dan ditawarkan. ` +
      "Tidak ada yang tercentang sendiri.";
    if (a1Massal) a1Massal.saatDimuat(kabar);
    // Perbaikan 2 Okt sore (P, butir 3): status putusan yang dibaca panel SIPP.
    keadaan.statusSipp = await p3BacaStatusSipp();
    // Perbaikan 2 Okt butir 3 (UI Baru): blangko yang dipilih di panel SIPP
    // (agen S, storage blangkoPutusanMassal) dipakai di sini juga.
    if (a2Utama) await a2PakaiBlangkoSipp(keadaan, pilihanPer, a2Utama, kabar);
    gambarDaftar();
    tombolRencana.disabled = false;
  }

  /**
   * ==========================================================================
   * AGENDA YANG MENYEBUT PUTUS BERDIRI DI DEPAN
   * ==========================================================================
   *
   * Pada tanggal sidang mana pun, yang hendak diputus hari itu hanya
   * sebagian - sisanya mediasi, jawaban, pembuktian. Agenda SIPP menyebutnya
   * sendiri ("Pembacaan Putusan", "Musyawarah Majelis - Putusan"), dan itulah
   * satu-satunya petunjuk yang ada sebelum berkasnya dibuka.
   *
   * Ia URUTAN, bukan saringan: agenda tidak dapat dipercaya sebagai penentu -
   * perkara diputus pada agenda yang tertulis "pembuktian" bukan hal aneh -
   * jadi yang lain tetap tergambar, hanya di bawah. Yang memutuskan tetap
   * orang; yang dikerjakan di sini menaruh yang paling mungkin di tempat
   * yang paling dahulu dibaca.
   */
  function agendaPutusan(s) {
    return /putus/i.test(String((s && s.agenda) || ""));
  }

  /** Baris yang TERLIHAT sekarang - hasil pencarian, saringan, dan urutan. */
  function sidangTampil() {
    const kata = String(cari.value || "").trim().toLowerCase();
    const pilihSaring = saring.value || "semua";
    let hasil = keadaan.sidang.slice();

    if (kata) {
      hasil = hasil.filter((s) =>
        [s.nomor, s.jenis, s.agenda].some((x) => String(x || "").toLowerCase().includes(kata))
      );
    }
    if (pilihSaring === "belum") hasil = hasil.filter((s) => !s.sudahPutus);
    else if (pilihSaring === "sudah") hasil = hasil.filter((s) => s.sudahPutus);
    else if (pilihSaring === "siap") hasil = hasil.filter((s) => !s.sudahPutus && alatBlangkoLengkap(petaUntuk(s)));
    else if (pilihSaring === "belumBlangko") hasil = hasil.filter((s) => !s.sudahPutus && !alatBlangkoLengkap(petaUntuk(s)));
    else if (pilihSaring === "dicentang") hasil = hasil.filter((s) => dicentang.has(s.nomor));
    if (a1Massal) hasil = a1Massal.saring(hasil, pilihSaring);

    const nomorUrut = (a, b) => String(a.nomor || "").localeCompare(String(b.nomor || ""), "id", { numeric: true });
    const pilihUrut = urut.value || "putus";
    if (pilihUrut === "nomor") hasil.sort(nomorUrut);
    else if (pilihUrut === "jenis") hasil.sort((a, b) => String(a.jenis || "").localeCompare(String(b.jenis || ""), "id") || nomorUrut(a, b));
    else if (pilihUrut === "keadaan") hasil.sort((a, b) => Number(a.sudahPutus) - Number(b.sudahPutus) || nomorUrut(a, b));
    else hasil.sort((a, b) => Number(agendaPutusan(b)) - Number(agendaPutusan(a)) || Number(a.sudahPutus) - Number(b.sudahPutus) || nomorUrut(a, b));

    return hasil;
  }

  function gambarDaftar() {
    daftar.textContent = "";
    centangPer.clear();
    if (a2Utama) a2Utama.segarkan();
    const tampil = sidangTampil();

    // Yang terpilih tetapi TIDAK terlihat disebut - kalau tidak, menekan
    // Jalankan sesudah menyaring akan mengerjakan perkara yang tidak ada di
    // layar, dan itu persis kejutan yang paling mahal di sini.
    const tersembunyi = [...dicentang].filter((n) => !tampil.some((s) => s.nomor === n)).length;
    ringkasTampil.textContent = tersembunyi
      ? `${tampil.length} dari ${keadaan.sidang.length} tampil · ${dicentang.size} dicentang (${tersembunyi} tidak terlihat)`
      : `${tampil.length} dari ${keadaan.sidang.length} tampil · ${dicentang.size} dicentang`;

    if (tampil.length === 0) {
      daftar.appendChild(buatElemen("div", "aleta-tetap-sebab", "Tidak ada perkara yang cocok dengan pencarian atau saringan ini."));
      return;
    }

    // Perbaikan 1 Okt butir 14 (UI Baru, Admin/Super Admin): baris disusun
    // per hakim ketua majelis - lihat a1Massal.kelompok. null = datar.
    const a1Wadah = a1Massal
      ? a1Massal.kelompok(daftar, tampil, {
          dicentang,
          ubah: (sebab) => {
            lupakanPemeriksaan(sebab);
            gambarDaftar();
          },
        })
      : null;

    for (const s of tampil) {
      const label = buatElemen("label", "aleta-massal-baris");
      const centang = document.createElement("input");
      centang.type = "checkbox";
      centang.className = "aleta-massal-centang";
      centang.disabled = s.sudahPutus;
      // Dipulihkan dari ingatan, bukan dari DOM: barisnya digambar ulang tiap
      // kali saringan berubah, dan tanpa ini tiap pengetikan di kotak cari
      // akan membatalkan seluruh centang.
      centang.checked = dicentang.has(s.nomor);
      centang.addEventListener("change", () => {
        if (centang.checked) dicentang.add(s.nomor);
        else dicentang.delete(s.nomor);
        lupakanPemeriksaan("Centang berubah");
        gambarDaftar();
      });
      label.appendChild(centang);
      label.appendChild(buatElemen("span", "aleta-massal-nomor", s.nomor));
      const peta = petaUntuk(s);
      const ket = [];
      ket.push(s.jenis || "jenis tidak terbaca");
      if (s.agenda) ket.push(s.agenda);
      if (s.ikrar) ket.push("sidang ikrar");
      if (s.ditunda) ket.push("ditunda");
      const keterangan = buatElemen("span", "aleta-massal-keadaan", ket.join(" · "));
      label.appendChild(keterangan);
      const tanda = buatElemen(
        "span",
        `aleta-massal-keadaan ${s.sudahPutus ? "aleta-lencana-aman" : alatBlangkoLengkap(peta) ? "" : "aleta-lencana-mendesak"}`,
        s.sudahPutus ? "sudah putus" : alatBlangkoLengkap(peta) ? `blangko: ${peta.berkas}` : "blangko belum dipetakan"
      );
      label.appendChild(tanda);

      // Pilihan blangko khusus untuk perkara ini.
      if (!s.sudahPutus) {
        const pilih = document.createElement("select");
        pilih.className = "aleta-massal-pilih-berkas";
        pilih.title = "Blangko khusus untuk perkara ini - kosongkan untuk memakai pemetaan jenisnya.";
        const bawaan = document.createElement("option");
        bawaan.value = "";
        bawaan.textContent = "blangko menurut jenis";
        pilih.appendChild(bawaan);
        for (const b of berkasDikenal(keadaan.peta)) {
          const o = document.createElement("option");
          o.value = alatKunciBerkas(b.berkas);
          o.textContent = `${b.blangko ? `${b.blangko} — ` : ""}${b.berkas}${b.a && b.b ? "" : " (token belum)"}`;
          o.dataset.a = b.a || "";
          o.dataset.b = b.b || "";
          o.dataset.d = b.d || "";
          o.dataset.blangko = b.blangko || "";
          o.dataset.berkas = b.berkas;
          pilih.appendChild(o);
        }
        pilih.addEventListener("click", (e) => e.stopPropagation());
        pilih.addEventListener("change", () => {
          const o = pilih.selectedOptions[0];
          if (!o || !o.value) {
            pilihanPer.delete(s.nomor);
          } else {
            pilihanPer.set(
              s.nomor,
              alatRapikanBlangko({ blangko: o.dataset.blangko, berkas: o.dataset.berkas, a: o.dataset.a, b: o.dataset.b, d: o.dataset.d })
            );
          }
          const p = petaUntuk(s);
          tanda.textContent = alatBlangkoLengkap(p) ? `blangko: ${p.berkas}` : "blangko belum siap";
          tanda.className = `aleta-massal-keadaan ${alatBlangkoLengkap(p) ? "" : "aleta-lencana-mendesak"}`;
          lupakanPemeriksaan(`Blangko ${s.nomor} diganti`);
        });
        label.appendChild(pilih);
        // Perbaikan 2 Okt butir 3 (UI Baru): pilihan ini di balik "Blangko berbeda…".
        if (a2Utama) {
          if (pilihanPer.has(s.nomor)) pilih.value = alatKunciBerkas(pilihanPer.get(s.nomor).berkas);
          a2BarisBlangko(label, pilih, s, {
            utama: a2Utama,
            berbeda: pilihanPer.has(s.nomor),
            utamaPerkara: p3PetaStatus(keadaan, s) || (a2Utama && a2Utama.peta()) || p3PetaJenis(keadaan, s),
          });
        }
      }
      label.title = s.sudahPutus
        ? "Sudah ada putusan di SIPP - tidak ditawarkan, supaya tidak ganda."
        : alatBlangkoLengkap(peta)
          ? "Boleh dicentang."
          : "Petakan blangko untuk jenis ini dahulu di atas, atau perkara ini dilewati saat dijalankan.";
      ((a1Wadah && a1Wadah.get(s.nomor)) || daftar).appendChild(label);
      centangPer.set(s.nomor, { centang, sidang: s, tanda });
    }
  }

  /**
   * Yang akan dikerjakan - dibaca dari INGATAN, bukan dari baris yang sedang
   * tergambar. Perkara yang dicentang lalu tersembunyi oleh saringan tetap
   * ikut; jumlahnya disebut pada ringkasan di atas daftar, dan pada hasil
   * pemeriksaan sebelum apa pun dijalankan.
   */
  function yangDicentang() {
    return keadaan.sidang.filter((s) => dicentang.has(s.nomor) && !s.sudahPutus);
  }

  tombolRencana.addEventListener("click", () => {
    const dipilih = yangDicentang();
    neraca.textContent = "";
    if (dipilih.length === 0) {
      neraca.appendChild(buatElemen("div", "aleta-tetap-sebab", "Tidak ada yang dicentang."));
      return;
    }
    neraca.appendChild(buatElemen("div", "aleta-tetap-sebab", `HASIL PEMERIKSAAN - belum ada yang dikerjakan. ${dipilih.length} perkara:`));
    let siap = 0;
    for (const s of dipilih) {
      const peta = petaUntuk(s);
      const baris = buatElemen("div", `aleta-perkakas-baris ${alatBlangkoLengkap(peta) ? "aleta-perkakas-baik" : "aleta-perkakas-buruk"}`);
      baris.appendChild(buatElemen("span", "aleta-perkakas-nama", s.nomor));
      baris.appendChild(
        buatElemen(
          "span",
          "aleta-perkakas-nilai",
          alatBlangkoLengkap(peta)
            ? `${peta.berkas} → ${rantaiMassalAbt(opsiMassal())}`
            : `DILEWATI: blangko untuk "${s.jenis}" belum dipetakan`
        )
      );
      neraca.appendChild(baris);
      if (alatBlangkoLengkap(peta)) siap += 1;
    }
    // ========================================================================
    // KALIMAT YANG MENYURUH MENEKAN JALANKAN
    // ========================================================================
    //
    // Sebelum ini, sesudah diperiksa seluruh yang terlihat berbunyi "belum":
    // tombolnya "Periksa dulu - belum dijalankan", judul hasilnya "belum ada
    // yang dikerjakan". Tidak satu pun menyebut bahwa langkah berikutnya
    // menekan Jalankan - dan satu-satunya petunjuk ada di tooltip tombol itu,
    // yang hanya muncul bila kursor didiamkan di atasnya. Panel ini karena
    // itu terbaca seperti buntu, dan dilaporkan sebagai "tidak bisa dipakai".
    sudahDiperiksa = siap > 0;
    tombolJalan.disabled = siap === 0;
    tombolJalan.textContent = siap ? `Jalankan ${siap} perkara sekarang` : "Jalankan";
    tombolJalan.title = siap ? `Mengerjakan ${siap} perkara berurutan.` : "Tidak ada yang dapat dikerjakan.";
    tombolRencana.textContent = siap ? "Periksa ulang" : "Periksa dulu - belum dijalankan";
    neraca.appendChild(
      buatElemen(
        "div",
        "aleta-tetap-sebab",
        siap
          ? `Belum ada yang ditulis. Tekan "Jalankan ${siap} perkara sekarang" untuk mengerjakannya` +
            (dipilih.length > siap ? `; ${dipilih.length - siap} dilewati karena blangkonya belum dipetakan.` : ".")
          : "Tidak ada yang dapat dikerjakan - blangko perkara yang dicentang belum dipetakan."
      )
    );
  });

  tombolHenti.addEventListener("click", () => {
    // Perkara yang sedang dikerjakan diselesaikan, lalu tidak ada perkara
    // berikutnya - lihat jalankanMassalAbt. Sinyal inilah satu-satunya
    // penanda berhenti; bendera keadaan.berhenti yang dahulu dibaca
    // lingkarannya sudah tidak dibaca siapa pun.
    if (keadaan.pembatal) keadaan.pembatal.abort();
    tombolHenti.textContent = "Menghentikan sesudah perkara ini…";
  });

  tombolJalan.addEventListener("click", async () => {
    // Penjagaan kedua. Tombolnya memang dimatikan tiap kali rencananya basi,
    // tetapi yang menulis ke berkas perkara tidak pantas bergantung pada satu
    // penjagaan saja.
    if (!sudahDiperiksa) return;
    const dipilih = yangDicentang().filter((s) => alatBlangkoLengkap(petaUntuk(s)));
    if (dipilih.length === 0) return;
    // Antrean lama yang belum selesai tidak diganti diam-diam (alatBolehGantiAntrean).
    if (!(await alatBolehGantiAntrean(`tahap ABT sidang ${keadaan.tanggal}`))) {
      neraca.textContent = "Antrean lama dipertahankan - putusan massal ABT tidak dijalankan.";
      return;
    }
    keadaan.sedangJalan = true;
    keadaan.pembatal = new AbortController();
    tombolJalan.disabled = true;
    tombolRencana.disabled = true;
    tombolHenti.hidden = false;
    tombolHenti.textContent = "Hentikan";
    neraca.textContent = "";

    const antrean = alatBuatAntrean({
      tanggalSidang: keadaan.tanggal,
      tahap: "abt",
      asal: "abt",
      kering: false,
      butir: dipilih.map((s) => ({ nomor: s.nomor, perkaraId: s.perkaraId, jenis: s.jenis })),
    });
    await alatSimpanAntrean(antrean);
    alatCatat("massal", `putusan massal ABT dimulai: ${dipilih.length} perkara, sidang ${keadaan.tanggal}`, "");
    // 9 Okt 2026: dilaporkan ke latar.js - tombol "Perbarui ekstensi" ditahan
    // sampai antrean ini berhenti (alatAntreanKerja). Dilepas sesudah
    // perulangan, juga bila ia terhenti oleh lemparan.
    const laporAbt =
      typeof alatAntreanKerja === "function"
        ? alatAntreanKerja("putusan-massal-abt", "putusan massal ABT", antrean.butir.length)
        : null;

    const opsi = opsiMassal();
    const olehUsername = namaPenggunaAbt();

    // Satu baris neraca per perkara, dibuat saat perkara itu mulai disentuh -
    // persiapannya dapat berjalan di dalam jeda sesudah perkara sebelumnya.
    const barisNeraca = new Map();
    const barisUntuk = (butir) => {
      let b = barisNeraca.get(butir.nomor);
      if (!b) {
        const el = buatElemen("div", "aleta-perkakas-baris");
        el.appendChild(buatElemen("span", "aleta-perkakas-nama", butir.nomor));
        const nilai = buatElemen("span", "aleta-perkakas-nilai", "menunggu…");
        el.appendChild(nilai);
        neraca.appendChild(el);
        b = { el, nilai };
        barisNeraca.set(butir.nomor, b);
      }
      return b;
    };

    try {
      await jalankanMassalAbt(antrean.butir, {
        opsi,
        olehUsername,
        petaUntuk,
        sinyalBatal: keadaan.pembatal.signal,
        laporButir: (butir, teks) => {
          barisUntuk(butir).nilai.textContent = teks;
        },
        // Antrean disimpan tiap langkah: keadaannya tetap terbaca walau
        // panelnya dimuat ulang di tengah jalan.
        sesudahLangkah: () => alatSimpanAntrean(antrean),
        sesudahButir: async (butir) => {
          const b = barisUntuk(butir);
          b.el.classList.add(butir.keadaan === "selesai" ? "aleta-perkakas-baik" : "aleta-perkakas-buruk");
          b.nilai.textContent = butir.catatan;
          const tanda = centangPer.get(butir.nomor);
          if (tanda) tanda.tanda.textContent = butir.keadaan === "selesai" ? "selesai" : butir.keadaan === "gagal" ? "gagal" : "dilewati";
          if (laporAbt) {
            const tuntas = antrean.butir.filter((x) => x.keadaan === "selesai" || x.keadaan === "gagal" || x.keadaan === "dilewati").length;
            laporAbt.maju(tuntas, antrean.butir.length);
          }
          await alatSimpanAntrean(antrean);
        },
      });
    } catch (galat) {
      // Tidak ditelan: yang terhenti di tengah disebut di neraca dan di kotak hitam.
      const pesan = String((galat && galat.message) || galat);
      neraca.appendChild(buatElemen("div", "aleta-tetap-sebab aleta-lencana-mendesak", `Putusan massal terhenti: ${pesan}`));
      alatCatat("massal-galat", `putusan massal ABT terhenti: ${pesan}`, "");
    } finally {
      if (laporAbt) laporAbt.selesai();
    }
    await alatSimpanAntrean(antrean);

    const h = alatAntreanRingkas(antrean);
    neraca.appendChild(
      buatElemen(
        "div",
        "aleta-tetap-sebab",
        `Selesai: ${h.selesai} berhasil, ${h.gagal} gagal, ${h.dilewati} dilewati. Rinciannya di kotak hitam (⚙).`
      )
    );
    alatCatat("massal", `putusan massal ABT selesai: ${h.selesai} berhasil, ${h.gagal} gagal, ${h.dilewati} dilewati`, "");

    // Serah terima ke SIPP: drafnya sudah ada, tinggal isian data di borang
    // SIPP. Panel SIPP membaca antrean ini dan menawarkan melanjutkannya.
    if (h.selesai > 0) {
      const serah = buatElemen("div", "aleta-massal-serah");
      serah.appendChild(
        buatElemen(
          "div",
          "aleta-tetap-sebab",
          "Lanjutkan ke SIPP: isian putusan (amar, pertimbangan, status) diisikan ke blangko tiap perkara. " +
            "Otomatis = ALETA menekan Isikan dan Simpan sendiri; Manual = berhenti di tiap perkara supaya Anda periksa dahulu."
        )
      );
      const otomatis = buatElemen("button", "aleta-permintaan-tombol", "Lanjutkan ke SIPP · otomatis");
      otomatis.type = "button";
      const manual = buatElemen("button", "aleta-permintaan-tombol", "Lanjutkan ke SIPP · manual");
      manual.type = "button";
      const serahkan = async (modus) => {
        antrean.tahap = "sipp";
        antrean.modus = modus;
        for (const b of antrean.butir) {
          if (b.keadaan === "selesai") {
            b.keadaan = "menunggu";
            b.catatan = "";
          } else {
            b.keadaan = "dilewati";
          }
        }
        antrean.posisi = 0;
        await alatSimpanAntrean(antrean);
        alatCatat("massal", `antrean diserahkan ke SIPP (${modus})`, "");
        // Antrean SIPP hidup sejak diserahkan - penahan tombol Perbarui ikut.
        if (typeof alatLaporAntreanPutusanSipp === "function") alatLaporAntreanPutusanSipp(antrean);
        window.open(alamatSippDariAbt(), "_blank");
        serah.appendChild(
          buatElemen("div", "aleta-tetap-sebab", "Tab SIPP dibuka. Buka daftar perkara Perdata di sana - panel ALETA akan menawarkan melanjutkan antrean.")
        );
      };
      otomatis.addEventListener("click", () => void serahkan("otomatis"));
      manual.addEventListener("click", () => void serahkan("manual"));
      serah.appendChild(otomatis);
      serah.appendChild(manual);
      neraca.appendChild(serah);
    }

    keadaan.sedangJalan = false;
    keadaan.pembatal = null;
    tombolHenti.hidden = true;
    tombolRencana.disabled = false;
    // Rencananya habis terpakai: menekan Jalankan sekali lagi akan mengulang
    // perkara yang sama - dan yang kedua kalinya menimpa draf serta dokumen
    // yang baru saja dibuat. Hasilnya dibiarkan tampil, jadi keadaannya
    // dikembalikan di sini, bukan lewat lupakanPemeriksaan yang mengosongkan
    // neraca.
    sudahDiperiksa = false;
    tombolJalan.disabled = true;
    tombolJalan.textContent = "Jalankan";
    tombolJalan.title = "Menyala sesudah hasil pemeriksaan di atas dibaca.";
    tombolRencana.textContent = "Periksa dulu - belum dijalankan";
  });

  keadaan.muatDaftar = muat;
  void muat();
  return kotak;
}

/**
 * Satu perkara, tiap langkah dicatat sendiri.
 *
 * Pulang dengan ringkasan yang menyebut apa yang jadi, apa yang tidak, dan apa
 * yang TIDAK DIBUAT - "RTF ok · draf v3 · PDF & anonim tidak dibuat (tidak
 * diunduh maupun diunggah)" atau "RTF ok · draf v3 · anonim ok · SIPP ok
 * (putusan + anonimisasi)" - bukan sekadar berhasil/gagal, dan bukan "ok"
 * untuk berkas yang tidak pernah dipakai.
 */

/**
 * ============================================================================
 * UNGGAH PUTUSAN PERKARA INI - DARI HALAMAN ABT
 * ============================================================================
 *
 * Seluruh rangkaiannya sudah ada di kerjakanSatuPerkaraAbt; yang ditambahkan
 * di sini hanya pintunya bagi perkara yang SEDANG DIBUKA.
 *
 * Tidak satu baris pun logika unggah disalin. Menyalinnya berarti dua jalur
 * yang lambat laun berbeda - dan yang berbeda diam-diam adalah yang menulis ke
 * SIPP.
 *
 * Centangnya sama artinya dengan yang di panel massal: draf, anonimisasi,
 * unggah, dan unduh. Bawaannya draf, anonim, dan unggah menyala - yang
 * membuka satu perkara di ABT hampir selalu hendak mengunggahnya - sedangkan
 * unduh mati. PDF hanya dibuat untuk unduhan: SIPP menerima RTF apa adanya.
 */
function bagianUnggahSatuAbt(isi) {
  const jatiDiri = jatiDiriPerkara();
  const nomor = nomorPerkaraAbt();

  // Halaman ABT yang tidak memuat satu perkara pun tidak diberi panel ini.
  // Panel yang tergambar tetapi tidak dapat dipakai hanya menambah tombol yang
  // menolak - dan yang menekannya menyangka ada yang rusak.
  if (!jatiDiri || !jatiDiri.perkaraId) return null;

  // 1.182.0: bagian ini mengunggah PUTUSAN. Di blangko BAS, relaas, atau
  // pemberitahuan putusan ia tidak boleh ada - lihat a3BukanBlangkoPutusan.
  // 1.183.0: juga PMH/PHS, penunjukan, sampul, akta, formulir, dan submenu
  // daftar ABT yang bukan putusan; yang "ragu" dikunci di UI Baru (di bawah).
  const jenisHalaman = a3JenisBlangkoHalaman();
  if (jenisHalaman === "bukan") return null;

  // Keputusan 9 Okt 2026: unggah putusan ke SIPP HANYA Hakim (termasuk
  // Ketua/Wakil), Admin, Super Admin. Peran yang PASTI tidak berhak tidak
  // diberi bagian ini; yang perannya belum terbaca diberi seperti biasa lalu
  // diganti kotak terkunci begitu akun ALETA-nya terbaca (abtKunciUnggahBilaTolak).
  if (abtTolakUnggahPutusan()) return abtPasangKotakTerkunci(isi);

  const kotak = buatElemen("div", "aleta-abt-bagian");
  kotak.appendChild(buatElemen("div", "aleta-abt-judul", "Unggah putusan perkara ini ke SIPP"));
  kotak.appendChild(
    buatElemen(
      "div",
      "aleta-abt-catatan",
      nomor
        ? `${nomor} - RTF diambil dari blangko ABT, lalu diunggah apa adanya beserta anonimisasinya.`
        : "Nomor perkaranya tidak terbaca dari kepala halaman; unggahannya tetap memakai perkara yang sedang dibuka."
    )
  );

  // ==========================================================================
  // BLANGKONYA DIPILIH, BUKAN DITEBAK DARI HALAMAN
  // ==========================================================================
  //
  // Halaman ABT tidak menyebutkan jenis perkaranya dalam bentuk yang dapat
  // dibaca dengan pasti - yang ada hanya judul dan daftar variabel. Menebaknya
  // dari sana berarti kadang benar dan kadang mengambil blangko perkara lain,
  // dan blangko yang salah menghasilkan putusan yang salah bentuknya.
  //
  // Karena itu dipilih. Daftarnya diisi dari pemetaan yang sudah ada, jadi
  // yang tampil hanya blangko yang memang sudah dipetakan - bukan seluruh
  // blangko ABT yang sebagian belum punya tokennya.
  const barisBlangko = buatElemen("label", "aleta-abt-centang-baris");
  barisBlangko.appendChild(buatElemen("span", "aleta-abt-nama", "Blangko"));
  const pilihBlangko = document.createElement("select");
  pilihBlangko.className = "aleta-sdg-pilih";
  const kosong = document.createElement("option");
  kosong.value = "";
  kosong.textContent = "memuat daftar blangko…";
  pilihBlangko.appendChild(kosong);
  barisBlangko.appendChild(pilihBlangko);
  kotak.appendChild(barisBlangko);

  let petaTerakhir = null;
  void alatMuatPetaBlangkoLengkap().then((peta) => {
    petaTerakhir = peta;
    pilihBlangko.textContent = "";
    const kunci = Object.keys(peta || {}).filter((k) => alatBlangkoLengkap(peta[k]));
    if (kunci.length === 0) {
      const tidakAda = document.createElement("option");
      tidakAda.value = "";
      tidakAda.textContent = "belum ada blangko yang dipetakan";
      pilihBlangko.appendChild(tidakAda);
      return;
    }
    kunci.sort();
    for (const k of kunci) {
      const opsi = document.createElement("option");
      opsi.value = k;
      opsi.textContent =
        typeof alatSebutKunciPeta === "function" ? alatSebutKunciPeta(k, peta[k]) : (peta[k] && peta[k].jenisAsli) || k;
      pilihBlangko.appendChild(opsi);
    }
  }).then(() => {
    // Perbaikan 1 Okt butir 11 (UI Baru saja): blangko HALAMAN INI dipilih
    // sendiri - lihat a1PilihBlangkoHalaman.
    if (!t6Modern()) return;
    // 1.183.0: blangko yang belum dikenali tidak pernah dipilih sendiri -
    // kecuali pemetaan putusan mengenalinya (token atau nama berkas).
    if (jenisHalaman === "ragu" && a3DikenaliPeta(petaTerakhir)) a3BukaUnggah(kotak);
    if (jenisHalaman === "ragu" && !kotak.hasAttribute("data-a3-dibuka")) {
      if (!a3Terkunci(kotak)) a3KunciUnggah(kotak, pilihHalamanIni);
      return;
    }
    a1PilihBlangkoHalaman(pilihBlangko, petaTerakhir);
  });
  const pilihHalamanIni = () => {
    if (t6Modern() && petaTerakhir) a1PilihBlangkoHalaman(pilihBlangko, petaTerakhir);
  };

  const pilihan = {};
  const centang = (kunci, label, bawaan) => {
    const baris = buatElemen("label", "aleta-abt-centang-baris");
    const kotakCentang = document.createElement("input");
    kotakCentang.type = "checkbox";
    kotakCentang.className = "aleta-abt-centang";
    kotakCentang.checked = bawaan;
    baris.appendChild(kotakCentang);
    baris.appendChild(buatElemen("span", "aleta-abt-nama", label));
    kotak.appendChild(baris);
    pilihan[kunci] = kotakCentang;
  };
  centang("draf", "Simpan draf ke ALETA", true);
  centang("anonim", "Anonimisasi", true);
  centang("unggah", "Unggah ke SIPP (putusan dan anonimisasinya)", true);
  centang("unduh", "Unduh RTF, PDF, dan anonim ke komputer", false);

  const tombol = buatElemen("button", "aleta-abt-tombol", "Kerjakan perkara ini");
  tombol.type = "button";
  const kabar = buatElemen("div", "aleta-abt-kabar");
  kotak.appendChild(tombol);
  kotak.appendChild(kabar);

  tombol.addEventListener("click", async () => {
    tombol.disabled = true;
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = "Menyiapkan…";
    try {
      // Penjaga kedua (1.182.0): bagian ini sudah tidak digambar di blangko
      // BAS/relaas, tetapi halaman ABT dapat berganti isi tanpa muat ulang.
      if (a3BukanBlangkoPutusan()) {
        throw new Error("Halaman ini bukan blangko putusan (BAS, relaas, atau pemberitahuan) - putusan tidak diunggah dari sini.");
      }
      if (a3Terkunci(kotak)) {
        throw new Error("Blangko ini belum dikenali sebagai blangko putusan - tekan \"Ini blangko putusan - buka\" lebih dahulu bila memang putusan.");
      }
      // Peta blangko dibaca SEKARANG, bukan disimpan saat panel dibangun:
      // pemetaannya dapat diubah orang di panel lain sementara halaman ini
      // terbuka, dan yang dipakai harus yang berlaku saat tombolnya ditekan.
      const jenis = pilihBlangko.value;
      if (!jenis) throw new Error("Pilih blangko yang dipakai lebih dahulu.");
      // Perbaikan 1 Okt butir 11 (UI Baru saja): blangko halaman ini dan
      // nomor perkara dari variabel 0001 - lihat a1SiapkanUnggahSatu.
      const ui = t6Modern() ? a1SiapkanUnggahSatu(jenis, nomor, pilihan.unggah.checked) : null;
      // Peta dibaca SEKARANG, bukan yang tersimpan saat panel dibangun:
      // pemetaannya dapat disunting di panel lain sementara halaman ini
      // terbuka, dan yang dipakai harus yang berlaku saat tombolnya ditekan.
      const peta = ui && ui.peta ? null : await alatMuatPetaBlangkoLengkap();
      const petaJenis = ui && ui.peta ? ui.peta : peta && peta[jenis];
      if (!petaJenis) {
        throw new Error(`Blangko "${jenis}" sudah tidak ada lagi di pemetaan. Muat ulang halaman.`);
      }
      const butir = { nomor: (ui ? ui.nomor : nomor) || "", perkaraId: jatiDiri.perkaraId, jenis };
      const opsi = {
        draf: pilihan.draf.checked,
        anonim: pilihan.anonim.checked,
        unggah: pilihan.unggah.checked,
        unduh: pilihan.unduh.checked,
        // PDF hanya untuk unduhan - SIPP menerima RTF apa adanya.
        pdf: pilihan.unduh.checked,
      };
      const hasil = await kerjakanSatuPerkaraAbt(
        butir,
        petaJenis,
        opsi,
        namaPenggunaAbt(),
        (teks) => {
          kabar.textContent = teks;
        }
      );
      kabar.className = hasil.ok ? "aleta-abt-kabar" : "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = hasil.ringkas || (hasil.ok ? "selesai" : "gagal");
      if (ui) a1GambarLangkahUnggah(kabar, hasil);
    } catch (galat) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
    } finally {
      tombol.disabled = false;
    }
  });

  // 1.183.0: UI Baru, blangko "ragu" - dikunci sejak lahir; .then di atas
  // membukanya bila pemetaan putusan mengenalinya.
  if (jenisHalaman === "ragu" && t6Modern()) a3KunciUnggah(kotak, pilihHalamanIni);

  isi.appendChild(kotak);
  return kotak;
}

/**
 * ============================================================================
 * HAK UNGGAH PUTUSAN DI PANEL ABT (keputusan 9 Okt 2026)
 * ============================================================================
 *
 * Aturannya satu, di panel-alat.js (alatBolehUnggahPutusan): Hakim (termasuk
 * Ketua/Wakil), Admin, Super Admin. Peladen menolak 403 di rute unggah-sipp,
 * unggah-naskah, dan isian-sipp; pemantau ambil menahan permintaannya. Di sini
 * hanya supaya bagian yang pasti ditolak tidak ditawarkan.
 */
function abtTolakUnggahPutusan() {
  try {
    return typeof alatBolehUnggahPutusan === "function" && alatBolehUnggahPutusan(penggunaAletaAbt) === false;
  } catch {
    return false;
  }
}

/**
 * Kotak terkunci beralasan. Panitera dan juru sita di Baru/UI Baru tidak
 * pernah punya menu unggah putusan di matriks perannya - bagi mereka cukup
 * tidak digambar; peran lain dan tampilan Lama melihat alasannya.
 */
function abtPasangKotakTerkunci(isi) {
  let golongan = "lain";
  try {
    golongan = typeof alatGolonganPeran === "function" ? alatGolonganPeran(penggunaAletaAbt && penggunaAletaAbt.peran) : "lain";
  } catch {
    golongan = "lain";
  }
  if (t6Aktif() && (golongan === "panitera" || golongan === "jurusita")) return null;
  if (typeof alatKotakTerkunciPutusan !== "function") return null;
  const kotak = alatKotakTerkunciPutusan("Unggah putusan perkara ini ke SIPP");
  if (isi) isi.appendChild(kotak);
  return kotak;
}

/**
 * Peran yang terbaca SESUDAH bagian unggah tergambar (muatPenggunaAleta di
 * panel perkara menyusul): bagian itu diganti kotak terkunci. Tidak memanggil
 * portal sendiri - menumpang bacaan akun yang memang sudah berjalan.
 */
function abtKunciUnggahBilaTolak(akar) {
  if (!akar || !abtTolakUnggahPutusan()) return;
  for (const kotak of Array.from(akar.querySelectorAll(".aleta-abt-bagian"))) {
    if (!kotak.isConnected) continue;
    const ganti = abtPasangKotakTerkunci(null);
    if (ganti) kotak.replaceWith(ganti);
    else kotak.remove();
  }
}

/**
 * ============================================================================
 * RANTAI PEKERJAAN SATU PERKARA - DISEBUT SEPERTI YANG SUNGGUH DIKERJAKAN
 * ============================================================================
 *
 * PDF dan anonimisasi hanya dibuat bila ada yang memakainya. Rencana yang
 * menyebut "→ PDF → anonim" padahal hasilnya dibuang adalah rencana yang
 * berbohong - dan itulah yang terjadi sampai 1.167 pada setelan bawaan.
 */

/**
 * Alamat SIPP yang dibuka tombol "Lanjutkan ke SIPP" pada putusan massal ABT.
 *
 * Sampai 26 September 2026 tombolnya membuka `${location.origin}/index.php/dashboard`.
 * Itu SIPP hanya di mesin setempat, tempat SIPP duduk di akar
 * (127.0.0.1/index.php). Di peladen satker SIPP berada di bawah /SIPP/ -
 * lihat manifest.json, yang memasang konten.js hanya pada
 * http://192.168.10.10/SIPP/* dan http://127.0.0.1/index.php/* - jadi
 * tab yang dibuka di kantor adalah alamat di luar SIPP: tanpa panel ALETA,
 * tanpa antrean yang dilanjutkan. Alamat /SIPP/ yang sama dipakai tautan
 * "Buka SIPP" di aleta.js.
 */
function alamatSippDariAbt() {
  if (location.hostname === "127.0.0.1") return `${location.origin}/index.php/dashboard`;
  return `${location.origin}/SIPP/`;
}

/** Anonimisasi dipakai hanya bila diunggah ke SIPP atau diunduh. */
function anonimDipakaiAbt(opsi) {
  const o = opsi || {};
  return Boolean(o.anonim) && (Boolean(o.unggah) || Boolean(o.unduh));
}

function rantaiMassalAbt(opsi) {
  const o = opsi || {};
  const pakaiAnonim = anonimDipakaiAbt(o);
  const rantai = ["RTF"];
  if (o.draf) rantai.push("draf");
  if (pakaiAnonim) rantai.push("anonim");
  if (o.unduh) rantai.push(`unduh (RTF${o.pdf ? ", PDF" : ""}${pakaiAnonim ? ", anonim" : ""})`);
  if (o.unggah) rantai.push(pakaiAnonim ? "SIPP (putusan + anonimisasi)" : "SIPP (putusan)");
  return rantai.join(" → ");
}

/**
 * ============================================================================
 * PERSIAPAN SATU PERKARA - SEMUA YANG TIDAK MENULIS KE SIPP
 * ============================================================================
 *
 *   RTF     GET  abt/preview                    selalu
 *   draf    POST /putusan/unggah-naskah         bila dicentang
 *   anonim  POST abt/main/anonim                bila diunggah ATAU diunduh
 *   PDF     POST /aleta-bot/abt/pdf             hanya bila diunduh
 *   unduh   berkas ke folder unduhan            bila dicentang
 *
 * Dipisah dari unggahannya supaya persiapan perkara berikutnya dapat
 * dikerjakan SELAMA jeda sesudah perkara ini - lihat jalankanMassalAbt.
 *
 * Yang tidak dibuat DISEBUT di ringkasan, bukan dilaporkan "ok".
 */
async function siapkanPerkaraAbt(butir, peta, opsi, lapor) {
  const o = opsi || {};
  const kabar = typeof lapor === "function" ? lapor : () => {};
  const dokumen = { rtf: "", draf: "", anonim: "", pdf: "", unduh: "", unggah: "" };
  const ringkas = [];
  const namaDasar = String(butir.nomor || "putusan").replace(/[\\/:*?"<>|]+/g, "_");
  const siap = { butir, dokumen, ringkas, namaDasar, isiRtf: null, isiAnonim: null, ok: false };

  // 1. RTF dari ABT
  try {
    const alamat = alatAlamatPreviewAbt(asalAbt(), peta, butir.perkaraId);
    if (!alamat) throw new Error("blangko belum dipetakan");
    kabar("mengambil RTF dari ABT…");
    const respons = await fetch(alamat, { credentials: "include", cache: "no-store" });
    if (!respons.ok) throw new Error(`ABT menjawab ${respons.status}`);
    const isiRtf = await respons.arrayBuffer();
    const awal = new TextDecoder("latin1").decode(new Uint8Array(isiRtf).subarray(0, 5));
    if (!awal.startsWith("{\\rtf")) {
      const sebab = a3SebabBukanAbt(new TextDecoder("latin1").decode(new Uint8Array(isiRtf).subarray(0, 6000)));
      throw new Error(sebab || "ABT tidak mengembalikan RTF - token blangko tidak sah atau sesi ABT habis");
    }
    siap.isiRtf = isiRtf;
    dokumen.rtf = "ok";
    ringkas.push("RTF ok");
    alatCatat("massal", `${butir.nomor}: RTF ${isiRtf.byteLength} bita`, "");
  } catch (galat) {
    dokumen.rtf = `gagal: ${String((galat && galat.message) || galat)}`;
    ringkas.push(dokumen.rtf.replace("gagal", "RTF gagal"));
    alatCatat("massal-galat", `${butir.nomor}: ${dokumen.rtf}`, "");
    return siap;
  }
  siap.ok = true;

  // 2. Draf ke ALETA
  if (o.draf) {
    try {
      kabar("menyimpan draf ke ALETA…");
      const badan = new FormData();
      badan.append("berkas", new Blob([siap.isiRtf], { type: "application/rtf" }), `${namaDasar}.rtf`);
      badan.append("nomorPerkara", butir.nomor);
      badan.append("perkaraId", butir.perkaraId);
      const respons = await alatAmbil(
        ALETA_API_UNGGAH_NASKAH_ABT,
        { method: "POST", body: badan, credentials: "include", batasMs: BATAS_UNGGAH_MASSAL_MS },
        "Mengirim naskah putusan"
      );
      if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Mengirim naskah putusan"));
      const luar = await respons.json();
      const jawab = luar && luar.data ? luar.data : luar;
      if (!jawab || !jawab.ok) throw new Error((jawab && jawab.sebab) || "draf ditolak");
      dokumen.draf = `v${jawab.versi}`;
      ringkas.push(`draf v${jawab.versi}`);
    } catch (galat) {
      dokumen.draf = `gagal: ${String((galat && galat.message) || galat)}`;
      ringkas.push(`draf ${dokumen.draf}`);
      alatCatat("massal-galat", `${butir.nomor}: draf ${dokumen.draf}`, "");
    }
  }

  // 3. Anonimisasi lewat ABT - hanya bila ada yang memakainya
  const pakaiAnonim = anonimDipakaiAbt(o);
  if (pakaiAnonim) {
    try {
      kabar("meminta ABT menganonimkan…");
      const borang = new FormData();
      borang.set("perkara_id", butir.perkaraId);
      borang.set("perkara_no", butir.nomor);
      borang.set("file_putusan", new Blob([siap.isiRtf], { type: "application/rtf" }), `${namaDasar}.rtf`);
      const respons = await fetch(`${asalAbt()}/main/anonim`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        body: borang,
      });
      if (!respons.ok) throw new Error(`ABT menjawab ${respons.status}`);
      const isi = await respons.arrayBuffer();
      const awal = new TextDecoder("latin1").decode(new Uint8Array(isi).subarray(0, 5));
      if (!awal.startsWith("{\\rtf")) {
        const teks = new TextDecoder().decode(isi);
        const pesan = teks.match(/Proses Anonim Gagal[^<]*/i);
        throw new Error(pesan ? pesan[0].slice(0, 120) : "ABT tidak mengembalikan RTF");
      }
      siap.isiAnonim = isi;
      dokumen.anonim = "ok";
      ringkas.push("anonim ok");
    } catch (galat) {
      const pesan = String((galat && galat.message) || galat);
      dokumen.anonim = `gagal: ${pesan}`;
      ringkas.push(`anonim gagal: ${pesan}`);
      alatCatat("massal-galat", `${butir.nomor}: anonim ${pesan}`, "");
    }
  }

  // 4. PDF - hanya untuk diunduh; SIPP menerima RTF apa adanya
  let pdfPutusan = null;
  const pakaiPdf = Boolean(o.pdf) && Boolean(o.unduh);
  if (pakaiPdf) {
    try {
      kabar("mengubah menjadi PDF…");
      pdfPutusan = await ubahKePdf(siap.isiRtf);
      dokumen.pdf = "ok";
      ringkas.push("PDF ok");
    } catch (galat) {
      dokumen.pdf = `gagal: ${String((galat && galat.message) || galat)}`;
      ringkas.push(`PDF ${dokumen.pdf}`);
      alatCatat("massal-galat", `${butir.nomor}: PDF ${dokumen.pdf}`, "");
    }
  }

  // 5. Unduh - hasil yang memang diminta
  if (o.unduh) {
    let n = 0;
    try {
      kabar("mengunduh berkas…");
      await unduhBlob(new Blob([siap.isiRtf], { type: "application/rtf" }), namaBerkas(butir.nomor, "rtf", "putusan"));
      n += 1;
      if (pdfPutusan) {
        await unduhBlob(pdfPutusan, namaBerkas(butir.nomor, "pdf", "putusan"));
        n += 1;
      }
      if (siap.isiAnonim) {
        await unduhBlob(new Blob([siap.isiAnonim], { type: "application/rtf" }), namaBerkas(butir.nomor, "rtf", "anonimisasi"));
        n += 1;
      }
      dokumen.unduh = `${n} berkas`;
      ringkas.push(`${n} berkas diunduh`);
    } catch (galat) {
      dokumen.unduh = `gagal sesudah ${n} berkas: ${String((galat && galat.message) || galat)}`;
      ringkas.push(`unduh ${dokumen.unduh}`);
      alatCatat("massal-galat", `${butir.nomor}: unduh ${dokumen.unduh}`, "");
    }
  }

  // Yang dicentang tetapi tidak dibuat karena tidak ada yang memakainya. PDF
  // hanya disebut bila tidak diunggah: bila diunggah, SIPP menerima RTF dan
  // PDF memang bagian dari unduhan saja.
  const tidakDibuat = [];
  if (o.pdf && !pakaiPdf && !o.unggah) tidakDibuat.push("PDF");
  if (o.anonim && !pakaiAnonim) tidakDibuat.push("anonim");
  if (tidakDibuat.length) ringkas.push(`${tidakDibuat.join(" & ")} tidak dibuat (tidak diunduh maupun diunggah)`);
  return siap;
}

/**
 * Tulisan ke SIPP untuk satu perkara: RTF putusan dan - bila dibuat - RTF
 * anonimisasinya, dalam SATU permintaan. Berkasnya RTF apa adanya: 87,7% e-Doc
 * satker berbentuk RTF, rute unggah-sipp memeriksa isinya, dan bot yang
 * mengubahnya bila perlu (keputusan 16). PDF buatan ekstensi tidak lagi
 * menjadi syarat - dahulu mematikan PDF membuat unggahannya dilewati.
 *
 * PENOLAKAN YANG MENYEBUT SLOT ANONIMISASI. Rute unggah-sipp memeriksa isi
 * tiap slot SEBELUM menulis apa pun, dan menolak SELURUH kiriman (409) bila
 * satu slot bermasalah - misalnya anonim ABT yang masih memuat nama pihak.
 * Penolakan itu tidak boleh ikut menahan putusan yang sah: bila slot yang
 * ditolak adalah anonimisasi, putusan dikirim ulang SENDIRIAN (kiriman yang
 * ditolak belum menulis apa pun, jadi tidak ada yang terulang), dan anonimnya
 * disebut TIDAK diunggah beserta sebab dari rute - perkaranya tetap tercatat
 * gagal supaya petugas menyamarkan dan mengunggah anonimnya sendiri.
 *
 * @returns {Promise<boolean>} true bila putusannya masuk
 */
async function unggahBerkasAbt(siap, olehUsername, lapor) {
  const kabar = typeof lapor === "function" ? lapor : () => {};
  const b = siap.butir;
  const denganAnonim = Boolean(siap.isiAnonim);
  const isinya = denganAnonim ? "putusan + anonimisasi" : "putusan";
  try {
    kabar(`mengunggah ${isinya} ke SIPP…`);
    let hasil = await kirimUnggahSippAbt(siap, olehUsername, denganAnonim);
    if (!hasil.ok && denganAnonim && hasil.tolak && hasil.tolak.slot === "anonimisasi") {
      const alasan = hasil.tolak.alasan ? ` (${String(hasil.tolak.alasan).replace(/_/g, " ")})` : "";
      siap.ringkas.push(`kiriman putusan + anonimisasi ditolak rute${alasan}: ${hasil.sebab}`);
      alatCatat("massal-galat", `${b.nomor}: anonimisasi ditolak rute${alasan}: ${hasil.sebab}`, "");
      kabar("anonimisasi ditolak - mengunggah putusan sendirian ke SIPP…");
      hasil = await kirimUnggahSippAbt(siap, olehUsername, false);
      if (!hasil.ok) throw new Error(hasil.sebab);
      siap.dokumen.unggah = `putusan ok; anonimisasi gagal: ditolak rute${alasan}`;
      siap.ringkas.push("SIPP ok (putusan, dikirim ulang tanpa anonimisasi)");
      siap.ringkas.push("anonimisasi gagal: TIDAK diunggah - samarkan lalu unggah sendiri");
      alatCatatTindakan({
        jenis: "unggah-sipp",
        penunjuk: b.nomor,
        label: `unggah putusan ${b.nomor}`,
        nilaiBaru: "(diunggah)",
        dapatPulih: false,
      });
      return true;
    }
    if (!hasil.ok) throw new Error(hasil.sebab);
    siap.dokumen.unggah = "ok";
    siap.ringkas.push(`SIPP ok (${isinya})`);
    alatCatatTindakan({
      jenis: "unggah-sipp",
      penunjuk: b.nomor,
      label: `unggah ${isinya} ${b.nomor}`,
      nilaiBaru: "(diunggah)",
      dapatPulih: false,
    });
    return true;
  } catch (galat) {
    siap.dokumen.unggah = `gagal: ${String((galat && galat.message) || galat)}`;
    siap.ringkas.push(`SIPP ${siap.dokumen.unggah}`);
    alatCatat("massal-galat", `${b.nomor}: unggah ${siap.dokumen.unggah}`, "");
    return false;
  }
}

/**
 * Satu kiriman ke rute unggah-sipp. Jawaban yang menolak dibaca KALIMATNYA
 * (data.sebab, lalu error.message) - bukan hanya angka statusnya - kecuali
 * 401/403, yang kalimat bakunya lebih berguna daripada badan halaman masuk.
 *
 * @returns {Promise<{ok: true, jawab: object} | {ok: false, sebab: string, tolak: object|null}>}
 *   tolak = badan data penolakan 409 rute ({alasan, slot, sebab, nama}) bila ada
 */
async function kirimUnggahSippAbt(siap, olehUsername, denganAnonim) {
  const b = siap.butir;
  const badan = new FormData();
  badan.append("perkaraId", b.perkaraId);
  badan.append("nomorPerkara", b.nomor);
  badan.append("olehUsername", olehUsername || "");
  badan.append("putusan", new Blob([siap.isiRtf], { type: "application/rtf" }), `${siap.namaDasar}.rtf`);
  if (denganAnonim) {
    badan.append("anonimisasi", new Blob([siap.isiAnonim], { type: "application/rtf" }), `${siap.namaDasar} - anonim.rtf`);
  }
  const respons = await alatAmbil(
    ALETA_API_UNGGAH_SIPP_ABT,
    { method: "POST", body: badan, credentials: "include", batasMs: BATAS_UNGGAH_MASSAL_MS },
    "Mengunggah putusan ke SIPP"
  );
  let luar = null;
  let galatBaca = null;
  try {
    luar = await respons.json();
  } catch (galat) {
    galatBaca = galat;
  }
  const jawab = luar && luar.data ? luar.data : luar;
  if (!respons.ok) {
    const bolehBaca = respons.status !== 401 && respons.status !== 403;
    const pesanGalat = luar && luar.error && typeof luar.error === "object" ? luar.error.message : luar && luar.error;
    const kalimat = bolehBaca ? (jawab && (jawab.sebab || jawab.pesan)) || pesanGalat || "" : "";
    const tolak = bolehBaca && jawab && typeof jawab === "object" && jawab.slot ? jawab : null;
    return {
      ok: false,
      sebab: kalimat ? String(kalimat) : alatPesanGagal(null, respons.status, "Mengunggah putusan ke SIPP"),
      tolak,
    };
  }
  if (!jawab) {
    return {
      ok: false,
      sebab: `Jawaban ALETA atas unggahan tidak terbaca: ${String((galatBaca && galatBaca.message) || "kosong")}.`,
      tolak: null,
    };
  }
  if (!jawab.ok) return { ok: false, sebab: String(jawab.sebab || jawab.pesan || jawab.alasan || "ditolak"), tolak: null };
  return { ok: true, jawab };
}

/** Ringkasan satu perkara: berhasil bila RTF ada dan tidak satu langkah pun gagal. */
function hasilPerkaraAbt(siap) {
  const ringkas = siap.ringkas.join(" · ");
  return { ok: Boolean(siap.ok) && !/gagal/.test(ringkas), ringkas, dokumen: siap.dokumen };
}

/**
 * ============================================================================
 * MENJALANKAN PUTUSAN MASSAL ABT - PERSIAPAN DI DALAM JEDA YANG SUDAH ADA
 * ============================================================================
 *
 * Perkara dikerjakan satu per satu, dan di antara dua perkara tetap ada jeda
 * ALAT_JEDA_MASSAL_MS - gunanya memberi napas peladen di antara dua tulisan
 * ke SIPP. Yang berubah: jeda itu tidak lagi menjadi tunggu yang sia-sia.
 *
 *   dahulu    RTF(i) → … → SIPP(i) → jeda → RTF(i+1) → … → SIPP(n) → jeda
 *   sekarang  RTF(i) → … → SIPP(i) → [jeda ∥ persiapan(i+1)] → SIPP(i+1) → …
 *
 * Persiapan perkara berikutnya (pratinjau ABT, draf, anonim ABT - tidak satu
 * pun menulis ke SIPP) berjalan BERSAMAAN dengan jeda itu. Dua tulisan ke SIPP
 * tetap berselang sekurang-kurangnya ALAT_JEDA_MASSAL_MS, permintaan ke ABT
 * tetap satu per satu (persiapan i+1 baru dimulai sesudah tulisan i rampung),
 * dan tidak ada jeda sesudah perkara terakhir.
 *
 * Hentikan berarti "sesudah perkara ini": persiapan yang sudah berjalan di
 * dalam jeda ditunggu dan DISEBUT - drafnya mungkin sudah tersimpan - tetapi
 * tidak diunggah; sisanya dilewati.
 *
 * @param daftar  butir antrean (dimutasi: keadaan, catatan, dokumen)
 * @param alat    {opsi, olehUsername, petaUntuk, sinyalBatal, laporButir,
 *                 sesudahLangkah, sesudahButir}
 */
async function jalankanMassalAbt(daftar, alat) {
  const a = alat || {};
  const opsi = a.opsi || {};
  const { petaUntuk } = a;
  const laporButir = typeof a.laporButir === "function" ? a.laporButir : () => {};
  const sesudahLangkah = typeof a.sesudahLangkah === "function" ? a.sesudahLangkah : async () => {};
  const sesudahButir = typeof a.sesudahButir === "function" ? a.sesudahButir : async () => {};
  const berhenti = () => Boolean(a.sinyalBatal && a.sinyalBatal.aborted);
  /** Persiapan perkara berikutnya yang sudah berjalan di dalam jeda: {butir, janji}. */
  let berikut = null;

  // Tidak pernah menolak: persiapan yang berjalan di dalam jeda baru ditunggu
  // belakangan, dan penolakan yang belum ditunggu terbaca sebagai galat liar.
  // Galatnya tidak ditelan - ia menjadi kegagalan perkara itu, tersebut di
  // ringkasannya dan di kotak hitam.
  const siapkan = async (butir) => {
    try {
      // Blangko khusus perkara ini bila dipilih, bukan pemetaan jenisnya.
      const peta = petaUntuk(butir);
      return await siapkanPerkaraAbt(butir, peta, opsi, (teks) => laporButir(butir, teks));
    } catch (galat) {
      const pesan = String((galat && galat.message) || galat);
      alatCatat("massal-galat", `${butir.nomor}: persiapan terhenti: ${pesan}`, "");
      return {
        butir,
        dokumen: { rtf: `gagal: ${pesan}` },
        ringkas: [`persiapan gagal: ${pesan}`],
        namaDasar: "",
        isiRtf: null,
        isiAnonim: null,
        ok: false,
      };
    }
  };

  for (let i = 0; i < daftar.length; i += 1) {
    const butir = daftar[i];

    if (berhenti()) {
      if (berikut && berikut.butir === butir) {
        // Persiapannya sudah berjalan di dalam jeda: ditunggu, lalu DISEBUT.
        // Tanpa unggah, persiapan itulah seluruh pekerjaannya - perkara ini
        // memang sudah selesai dikerjakan.
        const siapSisa = await berikut.janji;
        berikut = null;
        const hasilSisa = hasilPerkaraAbt(siapSisa);
        if (opsi.unggah) {
          butir.keadaan = "dilewati";
          butir.catatan = `dihentikan sesudah persiapan, belum diunggah: ${hasilSisa.ringkas}`;
        } else {
          butir.keadaan = hasilSisa.ok ? "selesai" : "gagal";
          butir.catatan = hasilSisa.ringkas;
        }
        butir.dokumen = hasilSisa.dokumen;
        await sesudahButir(butir, siapSisa);
        i += 1;
      }
      for (const lewat of daftar.slice(i)) {
        lewat.keadaan = "dilewati";
        lewat.catatan = "dihentikan";
      }
      await sesudahLangkah(butir);
      break;
    }

    butir.keadaan = "jalan";
    await sesudahLangkah(butir);
    let siap;
    if (berikut && berikut.butir === butir) {
      siap = await berikut.janji;
      berikut = null;
    } else {
      siap = await siapkan(butir);
    }
    if (opsi.unggah && siap.ok) await unggahBerkasAbt(siap, a.olehUsername, (teks) => laporButir(butir, teks));

    const hasil = hasilPerkaraAbt(siap);
    butir.keadaan = hasil.ok ? "selesai" : "gagal";
    butir.catatan = hasil.ringkas;
    butir.dokumen = hasil.dokumen;
    await sesudahButir(butir, siap);

    // Tidak ada jeda sesudah perkara terakhir, dan tidak ada sesudah Hentikan.
    if (i >= daftar.length - 1 || berhenti()) continue;
    // Jeda yang sudah ada - napas peladen di antara dua tulisan ke SIPP - dan
    // persiapan perkara berikutnya berjalan BERSAMAAN di dalamnya.
    const lanjut = daftar[i + 1];
    berikut = { butir: lanjut, janji: siapkan(lanjut) };
    await alatJeda(ALAT_JEDA_MASSAL_MS);
  }
}

/**
 * Satu perkara, dari halaman perkara ABT: persiapan, lalu - bila diminta -
 * RTF putusan dan anonimisasinya ke SIPP dalam satu kiriman.
 */
async function kerjakanSatuPerkaraAbt(butir, peta, opsi, olehUsername, lapor) {
  const o = opsi || {};
  const siap = await siapkanPerkaraAbt(butir, peta, o, lapor);
  // Tahap 6 (ide abt-26): anonim diperiksa sebelum diunggah, dan petugas yang
  // memutuskan. t6Aktif() lebih dahulu - dalam tampilan Lama tidak ada satu
  // pun tunggu tambahan di jalur ini.
  if (siap.ok && o.unggah && t6Aktif() && !(await t6PeriksaAnonimSebelumUnggah(siap, lapor))) {
    return hasilPerkaraAbt(siap);
  }
  if (siap.ok && o.unggah) await unggahBerkasAbt(siap, olehUsername, lapor);
  return hasilPerkaraAbt(siap);
}

/** RTF -> PDF lewat bot ALETA. Pulang Blob PDF, atau melempar sebabnya. */
async function ubahKePdf(isiRtf) {
  const respons = await alatAmbil(
    ALETA_API_PDF,
    {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rtfBase64: base64DariBuffer(isiRtf) }),
      batasMs: BATAS_UNGGAH_MASSAL_MS,
    },
    "Membuat PDF"
  );
  if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Membuat PDF"));
  const luar = await respons.json();
  const isi = luar && luar.data ? luar.data : luar;
  if (!isi || !isi.available) throw new Error((isi && isi.message) || "pengubah PDF tidak tersedia");
  const biner = Uint8Array.from(atob(isi.pdfBase64), (c) => c.charCodeAt(0));
  return new Blob([biner], { type: "application/pdf" });
}

/* ─── Token blangko dicari menurut NAMA, dari halaman ABT sendiri ──────────
 *
 * Pemetaan boleh datang hanya dengan nama berkas - dari popup, atau dari
 * bawaan cerai. Tokennya dicari di sini, dengan dua langkah yang sama persis
 * seperti yang dilakukan orang: buka bilah kelompok, buka kelompoknya, baca
 * tautan berkasnya. Bedanya, halaman kelompoknya diambil lewat fetch pada
 * asal yang sama (sesi ABT ikut), bukan digambar.
 *
 * Hasilnya disimpan ke pemetaan supaya pencarian berikutnya tidak perlu
 * menyentuh jaringan; dan halaman kelompok yang sudah dibaca disimpan di
 * memori halaman ini supaya dua berkas dari kelompok yang sama hanya
 * mengambil halamannya sekali.
 */
const BATAS_KELOMPOK_DICARI = 60;
const JEDA_ANTAR_KELOMPOK_MS = 250;
const kelompokTerbaca = new Map(); // a kelompok -> daftar berkas terurai

/** Tautan kelompok dari bilah beranda halaman ini, atau dari HTML beranda bila perlu. */
async function daftarKelompokBlangko() {
  const dariHalaman = alatUraiKelompokDariHtml(document.body ? document.body.innerHTML : "");
  if (dariHalaman.length > 0) return dariHalaman;
  const respons = await fetch(`${asalAbt()}/main/beranda`, { credentials: "include", cache: "no-store" });
  if (!respons.ok) throw new Error(`ABT menjawab ${respons.status} saat membaca bilah kelompok`);
  return alatUraiKelompokDariHtml(await respons.text());
}

async function berkasDalamKelompok(kelompok) {
  if (kelompokTerbaca.has(kelompok.a)) return kelompokTerbaca.get(kelompok.a);
  const alamat = `${asalAbt()}/main/beranda?a=${encodeURIComponent(kelompok.a)}`;
  const respons = await fetch(alamat, { credentials: "include", cache: "no-store" });
  if (!respons.ok) throw new Error(`ABT menjawab ${respons.status} untuk kelompok ${kelompok.kelompok}`);
  const daftar = alatUraiBerkasDariHtml(await respons.text());
  kelompokTerbaca.set(kelompok.a, daftar);
  return daftar;
}

/**
 * Mencari satu berkas menurut namanya di seluruh kelompok blangko.
 * Pulang { blangko, berkas, a, b, d } atau null bila tidak ada di ABT ini.
 *
 * kelompokDiharapkan - nama menu ABT yang seharusnya memuat berkas ini. Nama
 * berkas saja tidak selalu cukup: "[01] [Kabul Verstek] Cerai (Format
 * Lengkap)" berdiri di menu Cerai Gugat DAN Cerai Talak, dan tanpa sebutan
 * ini yang pertamalah yang selalu menang.
 */
async function cariTokenBlangko(namaBerkas, lapor, kelompokDiharapkan) {
  const kunci = alatKunciBerkas(namaBerkas);
  if (!kunci) return null;
  const diminta = alatKunciKelompokBanyak(kelompokDiharapkan);
  const bawa = (x, k) => ({ blangko: x.blangko || k || "", berkas: x.berkas, a: x.a, b: x.b, d: x.d || "" });

  // Yang tergambar di halaman ini lebih dulu - tanpa jaringan. Bila menunya
  // disebut, halaman ini hanya dipakai kalau ia MEMANG menu itu; kalau tidak,
  // pencarian tetap berjalan. Halaman yang kebetulan terbuka bukan jawaban.
  const diHalaman = berkasBlangkoDiHalaman();
  if (diminta.length > 0) {
    const tepatDiSini = alatCocokkanBerkasDiKelompok(diHalaman, namaBerkas, kelompokDiharapkan);
    if (tepatDiSini) return bawa(tepatDiSini);
  } else {
    const diSini = alatCocokkanBerkas(diHalaman, namaBerkas);
    if (diSini) return bawa(diSini);
  }

  const kelompok = alatDahulukanKelompok(await daftarKelompokBlangko(), kelompokDiharapkan).slice(
    0,
    BATAS_KELOMPOK_DICARI
  );
  // ==========================================================================
  // SATU PINDAIAN, DUA JAWABAN - DAN YANG TEPAT TIDAK BOLEH DIDAHULUI
  // ==========================================================================
  //
  // Cadangan (berkas senama di menu mana pun) dipegang DI SINI, bukan di
  // dalam pencocok per kelompok. Sebabnya sederhana dan mahal: pencocok itu
  // hanya melihat satu kelompok, jadi cadangannya akan selalu menang di
  // kelompok pertama yang senama - dan untuk cerai talak, kelompok pertama
  // itu justru Cerai Gugat, yang hendak kita hindari.
  let cadangan = null;
  for (let i = 0; i < kelompok.length; i += 1) {
    const k = kelompok[i];
    if (lapor) lapor(`mencari di ${k.kelompok} (${i + 1}/${kelompok.length})…`);
    let daftar;
    try {
      daftar = await berkasDalamKelompok(k);
    } catch (galat) {
      alatCatat("massal-galat", `kelompok ${k.kelompok}: ${String((galat && galat.message) || galat)}`, "");
      continue;
    }
    if (diminta.length > 0) {
      const tepat = alatCocokkanBerkasDiKelompok(daftar, namaBerkas, kelompokDiharapkan);
      if (tepat) return bawa(tepat, k.kelompok);
      if (!cadangan) {
        const senama = alatCocokkanBerkas(daftar, namaBerkas);
        if (senama) cadangan = bawa(senama, k.kelompok);
      }
    } else {
      const cocok = alatCocokkanBerkas(daftar, namaBerkas);
      if (cocok) return bawa(cocok, k.kelompok);
    }
    if (!kelompokTerbaca.has(k.a)) await alatJeda(JEDA_ANTAR_KELOMPOK_MS);
  }
  return cadangan;
}

/**
 * Melengkapi token untuk baris pemetaan yang baru punya nama. Pulang jumlah
 * yang terisi; yang tidak ketemu dibiarkan bernama saja dan disebut di
 * catatan, bukan dihapus.
 */
async function lengkapiTokenPeta(peta, lapor) {
  let terisi = 0;
  for (const [kunci, baris] of Object.entries(peta)) {
    if (!alatBlangkoTerpetakan(baris) || alatBlangkoLengkap(baris)) continue;
    const diminta = baris.blangkoDiminta || baris.blangko || "";
    const semuaNama = diminta ? [diminta, ...(baris.blangkoLain || [])] : [];
    const hasil = await cariTokenBlangko(baris.berkas, lapor, semuaNama);
    if (!hasil) {
      baris.catatan = "berkas tidak ditemukan di ABT ini";
      continue;
    }
    // Kalau kelompok yang diminta tidak ada di ABT ini, barisnya tetap
    // terisi - tetapi yang membaca layar berhak tahu ia mendarat di menu lain.
    //
    // blangkoDiminta DISIMPAN, dan itu bukan hiasan: tanpanya pemulihan baris
    // di alatMuatPetaBlangkoLengkap akan melihat blangko yang "salah" lagi
    // pada pemuatan berikutnya, melepas tokennya lagi, dan memindai ulang
    // seluruh ABT setiap kali halaman dibuka - berputar tanpa akhir.
    const menuLain =
      diminta && !alatKunciKelompokBanyak(semuaNama).includes(alatKunciKelompok(hasil.blangko));
    peta[kunci] = {
      ...alatRapikanBlangko({ ...hasil }),
      jenisAsli: baris.jenisAsli || kunci,
      bawaan: Boolean(baris.bawaan),
      // Perbaikan 2 Okt sore (P): baris dari Pemetaan blangko server tetap
      // bertanda server, dan baris status tetap menyebut statusnya.
      ...(baris.sumber ? { sumber: baris.sumber } : {}),
      ...(baris.statusAsli ? { statusAsli: baris.statusAsli } : {}),
      ...(diminta ? { blangkoDiminta: diminta } : {}),
      ...(baris.blangkoLain ? { blangkoLain: baris.blangkoLain } : {}),
      ...(menuLain ? { catatan: `diminta dari "${diminta}", yang ada di ABT ini "${hasil.blangko}"` } : {}),
    };
    terisi += 1;
    alatCatat("massal", `token blangko terisi: ${baris.jenisAsli || kunci} → ${hasil.blangko} / ${hasil.berkas}`, "");
  }
  if (terisi > 0) await alatSimpanPetaBlangko(peta);
  return terisi;
}

/** Semua nama berkas yang dikenal di halaman ini: dari pemetaan dan dari kartu yang tergambar. */
function berkasDikenal(peta) {
  const hasil = new Map();
  for (const b of berkasBlangkoDiHalaman()) hasil.set(alatKunciBerkas(b.berkas), { ...b });
  for (const baris of Object.values(peta)) {
    if (!alatBlangkoTerpetakan(baris)) continue;
    const k = alatKunciBerkas(baris.berkas);
    if (!hasil.has(k) || !hasil.get(k).a) hasil.set(k, { blangko: baris.blangko || "", berkas: baris.berkas, a: baris.a || "", b: baris.b || "", d: baris.d || "" });
  }
  return [...hasil.values()];
}

/*
 * ============================================================================
 * TAHAP 6 - PANEL ABT DALAM TAMPILAN BARU DAN UI BARU
 * ============================================================================
 *
 * Rencana "ekstensi dulu", 29 September 2026. Sama dengan Tahap 4 di aleta.js:
 * seluruh blok ini TAMBAHAN yang menumpang pada panel yang sudah jadi. Panel
 * tetap disusun susunPanelAbt persis seperti sebelumnya, lalu blok ini menata
 * dan menambahinya. Sebabnya satu: tampilan Lama harus tetap sama sampai ke
 * DOM, permintaan, dan penyimpanannya, dan cara paling pasti untuk itu adalah
 * tidak menyentuh jalur yang menyusunnya.
 *
 * Tiga pagar, ketiganya ditanyakan ke panel-alat.js (Tahap 1):
 *
 *   tampilan Lama     t6Tata hanya mencatat tanda tampilan (di luar DOM) lalu
 *                     pulang - tidak ada atribut, permintaan, maupun pewaktu
 *   ide abt-N         hanya bila alatFiturNyala("abt-N") - Baru maupun UI Baru
 *   perbaikan D1-D15  hanya dalam UI Baru (alatKulit() === "modern"). Sepuluh
 *                     di antaranya berwujud sama dengan satu ide (lihat
 *                     T6_DESAIN), jadi dalam UI Baru wujud itu hadir walau
 *                     saklar idenya mati
 *
 * Kait ke jalur lama hanya TIGA, dan ketiganya diam dalam tampilan Lama:
 *
 *   pasang()                  memanggil t6TataAman sesudah panel terpasang
 *   penjaga CETAK lama        t6LewatiPenjagaLama() - true hanya sesaat sesudah
 *                             petugas mengonfirmasi dialog Tahap 6 (ide abt-5)
 *   kerjakanSatuPerkaraAbt    t6PeriksaAnonimSebelumUnggah - hanya bila t6Aktif()
 *
 * ============================================================================
 * TIDAK ADA YANG DITAHAN - YANG ADA PERINGATAN DENGAN KONFIRMASI
 * ============================================================================
 *
 * Diputuskan pengguna 29 September 2026: huruf G (abt-5) dan anonimisasi yang
 * belum bersih (abt-26) tidak menahan CETAK maupun unggah. Keduanya membuka
 * dialog yang menyebut apa yang salah dan di mana, dan tombol lanjutnya baru
 * menyala sesudah "Sudah saya periksa" dicentang. Variabel wajib (abt-17) dan
 * komentar hakim (abt-18) lebih ringan lagi: hanya peringatan, tanpa dialog.
 *
 * ============================================================================
 * PERMINTAAN JARINGAN BLOK INI
 * ============================================================================
 *
 *   GET   /aleta/api/aleta-ecourt/abt-wajib?jenis=      abt-17, saat panel lahir
 *   GET   /aleta/api/aleta-ecourt/bas-komentar?nomor=   abt-18, saat panel lahir
 *   PATCH /aleta/api/aleta-ecourt/bas-komentar          abt-18, tombol "Tandai selesai"
 *   GET   /aleta/api/aleta-ecourt/templat-hukum?jenis=pasal   abt-27, saat dibuka
 *   GET   /aleta/api/aleta-ecourt/riwayat-pihak         abt-19, saat ditekan
 *   GET   abt/preview (tautan CETAK itu sendiri)        abt-12/24, saat ditekan
 *   POST  abt/edit_data  lewat simpanVariabel yang sama  abt-9 dan abt-23, saat ditekan
 *
 * Rute yang belum ada di server (404) disebut "belum tersedia di server",
 * dan jawaban 423 mode coba disebut apa adanya - tidak berpura-pura berhasil.
 */
const T6_KUNCI_SEMATAN = "abtVariabelSematan";
const T6_KUNCI_BACA = "abtModeBaca";
const T6_KUNCI_DRAF = "abtDrafSaksi";
const T6_KUNCI_TEMPLAT = "abtTemplatPribadi";
const T6_KUNCI_DITOLAK = "abtAlasanDitolak";
const T6_API_KOMENTAR = "/aleta/api/aleta-ecourt/bas-komentar";
const T6_API_TEMPLAT_HUKUM = "/aleta/api/aleta-ecourt/templat-hukum";
const T6_API_WAJIB = "/aleta/api/aleta-ecourt/abt-wajib";
const T6_API_RIWAYAT_PIHAK = "/aleta/api/aleta-ecourt/riwayat-pihak";
const T6_DRAF_MS = 30 * 1000;
const T6_BATAS_DRAF = 20;
const T6_BATAS_TEMPLAT = 10;
/**
 * Huruf per halaman cetak - perkiraan kasar untuk kertas F4, huruf 12, spasi
 * 1,5. Dipakai untuk "± N halaman" dan letak temuan anonimisasi; keduanya
 * disebut PERKIRAAN di layar, sebab tata letak RTF tidak dapat diukur di sini.
 */
const T6_HURUF_PER_HALAMAN = 2500;
const T6_SEMUA = Array.from({ length: 30 }, (_, i) => `abt-${i + 1}`);
/**
 * Ide yang wujudnya sama dengan satu perbaikan desain, dan karena itu hadir di
 * UI Baru walau saklar idenya mati:
 *
 *   abt-1 D3 kalimat ramah   abt-2 D6 yang tidak berlaku   abt-3 D4 centang unggah
 *   abt-4 D7 segmen keyakinan  abt-5 D8 pita bahaya       abt-7 D9 beda disorot
 *   abt-8 D11 kelompok alasan  abt-10 D2 langkah 1-5      abt-11 D13 bilah kemajuan
 *   abt-12 D12 pratinjau putusan
 */
const T6_DESAIN = new Set(["abt-1", "abt-2", "abt-3", "abt-4", "abt-5", "abt-7", "abt-8", "abt-10", "abt-11", "abt-12"]);
/**
 * Langkah panel ABT (perbaikan 30 September 2026, butir 2-4).
 *
 *   gabung    "Isi dari SIPP" dan "Input ke ABT" menjadi SATU langkah; Rapikan
 *             (pratinjau, tanpa menulis) dijalankan lebih dulu di dalamnya.
 *             Duduk PALING AWAL di DOM dan satu-satunya yang berkelas
 *             aleta-permintaan-tombol - Alt+P tetap berarti "isi dari SIPP".
 *   sdg       hanya panitera sidang/PP (dan Admin/Super Admin) - langkah
 *             putusan hakim tidak memuatnya.
 *   kerjakan  membawa ke bagian Kerjakan, tidak menekannya.
 *
 * `urut` adalah urutan TAMPILNYA (CSS order): susun saksi lebih dulu, sebab
 * "input ke ABT" membaca keterangan saksi yang sudah tersimpan. Tombol lama
 * yang diwakili (Isi blangko dari SIPP, Input ke ABT, Rapikan, Susun
 * keterangan saksi) tetap ada di DOM - dibuka lewat ⋯ di deret langkah.
 */
const T6_LANGKAH = [
  { kunci: "gabung", nama: "Isi dari SIPP & input ke ABT", urut: 2 },
  { kunci: "sdg", nama: "Susun saksi", tombol: "sdg", urut: 1 },
  { kunci: "kerjakan", nama: "Kerjakan", tombol: null, urut: 3 },
];
/** Peran (t6KelasPeran) yang melihat penyusun keterangan saksi. Kosong = belum terbaca. */
const T6_PERAN_SDG = new Set(["super-admin", "admin", "panitera"]);
/**
 * Variabel yang kalimatnya disusun ABT dari huruf alasan 8503 (butir 5).
 * Selama 8503 KOSONG, bunyi "TIDAK BENAR QUERY NYA" pada mereka memang belum
 * waktunya - bukan kerusakan - jadi tidak dimasukkan ke pita error.
 *
 * 7 Okt: = TURUNAN_8503 (ditambah 8524, 8531, 8532 - yang dulu lolos ke pita
 * error sebagai "2 variabel berbunyi pesan error (8531, 8532)").
 */
const T6_TERGANTUNG_8503 = [...TURUNAN_8503];
/** Penjelasan yang lebih panjang dari ini dilipat di balik ⓘ (butir 6). */
const T6_INFO_BATAS = 90;
/**
 * Sumber isian jawaban saksi yang masih kosong (butir 28 bagian B): kata pada
 * PERTANYAAN -> variabel blangko yang isinya boleh ditawarkan. Ditawarkan,
 * tidak pernah diisikan sendiri.
 */
const T6_SUMBER_JAWAB = [
  [/rukun|damai|mendamaikan|merukunkan|menasi[hk]ati/i, "1268", "Upaya Damai Keluarga"],
  [/pisah|berpisah/i, "0246", "Pisah Rumah"],
  [/berapa lama|sudah lama/i, "9944", "Lama Pisah"],
  [/meninggalkan/i, "7035", "Yang Meninggalkan"],
  [/sejak kapan|mulai tidak|mulai sering/i, "0222", "Awal Konflik"],
];
const T6_YAKIN = [
  ["semua", "Semua", "Semua usulan"],
  ["ragu", "Ragu", "ragu — tidak dicentang sendiri; periksa dulu"],
  ["bentrok", "Bentrok", "bentrok — saksi berselisih"],
  ["cukup", "Cukup", "cukup — satu saksi saja (atau dari posita)"],
  ["pasti", "Pasti", "pasti — kedua saksi sama"],
];
/**
 * Kelompok alasan (abt-8, D11). Dicocokkan dengan KATA pada labelnya, bukan
 * dengan daftar tetap: pilihan alasan dapat ditambah admin di portal
 * (bas.saksi.alasan-pilihan), dan yang tidak dikenal jatuh ke "Lainnya" -
 * tidak pernah hilang.
 */
const T6_KELOMPOK_ALASAN = [
  ["Perselisihan", /perselisihan|pertengkaran|cemburu|berkata kasar|cekcok/i],
  ["Ekonomi", /nafkah|malas|pekerjaan|ekonomi|hutang|utang/i],
  ["Perilaku", /kekerasan|temperamental|bersikap kasar|obat|judi|mabuk|pidana|penjara|zina|cacat/i],
  ["Pihak ketiga", /pihak lain|idaman|menikah lagi|poligami|campur tangan/i],
  ["Agama", /murtad|agama/i],
];
/**
 * Tanda "G" - kata kunci alasan yang terbaca di posita (5125). PERKIRAAN dari
 * kata, bukan pembacaan dalil: judulnya menyebut itu, supaya tidak dibaca
 * sebagai kepastian bahwa gugatan mendalilkannya.
 */
const T6_KATA_GUGATAN = [
  [/perselisihan/i, /perselisihan|pertengkaran|bertengkar|cekcok|tidak harmonis|tidak rukun/i],
  [/kekerasan/i, /kekerasan|memukul|dipukul|menampar|menganiaya|kdrt/i],
  [/nafkah/i, /nafkah/i],
  [/pihak lain|idaman/i, /wanita lain|pria lain|laki-laki lain|perempuan lain|idaman lain|selingkuh/i],
  [/cemburu/i, /cemburu/i],
  [/obat/i, /narkoba|obat terlarang|sabu/i],
  [/judi/i, /judi/i],
  [/mabuk/i, /mabuk|minuman keras|miras/i],
  [/murtad|agama/i, /murtad|pindah agama/i],
  [/temperamental/i, /temperamen|emosi|pemarah|mudah marah/i],
  [/berkata kasar/i, /kata-kata kasar|berkata kasar|mencaci|memaki/i],
  [/bersikap kasar/i, /bersikap kasar|sikap kasar|kasar/i],
  [/malas/i, /malas/i],
  [/pekerjaan tetap/i, /pekerjaan tetap|tidak bekerja|pengangguran/i],
  [/ekonomi/i, /ekonomi/i],
  [/menikah lagi/i, /menikah lagi|kawin lagi|poligami/i],
];
/**
 * Kelompok kata sepadan untuk pembuat varian (abt-15). Tiap kelompok berisi
 * bunyi yang sama artinya di keterangan saksi; varian ke-n mengganti tiap
 * bunyi dengan anggota berikutnya dalam kelompoknya. Aturan tertulis, bukan
 * mesin bahasa: kalimat yang tidak memuat satu pun bunyi ini tidak diberi
 * varian, dan itu disebut.
 */
const T6_SEPADAN = [
  ["sering bertengkar", "kerap cekcok", "sering berselisih"],
  ["tidak rukun", "tidak harmonis", "tidak akur"],
  ["tidak memberi nafkah", "tidak menafkahi", "tidak memberikan nafkah"],
  ["pisah rumah", "berpisah tempat tinggal", "tidak lagi serumah"],
  ["melihat sendiri", "menyaksikan sendiri"],
  ["mengetahui", "tahu"],
  ["kurang lebih", "kira-kira", "sekitar"],
  ["bertengkar", "berselisih", "cekcok"],
  ["sudah", "telah"],
  ["karena", "sebab"],
  ["sejak", "semenjak"],
];
/** Pengganti karakter \'80-\'9f windows-1252 - selebihnya sama dengan kodenya. */
const T6_CP1252 = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡",
  0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘",
  0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—", 0x98: "˜",
  0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};
/** Tujuan RTF yang bukan isi naskah - dilewati seluruh kelompoknya. */
const T6_RTF_LEWAT = new Set([
  "fonttbl", "colortbl", "stylesheet", "info", "pict", "object", "header", "footer", "headerl", "headerr",
  "headerf", "footerl", "footerr", "footerf", "themedata", "colorschememapping", "latentstyles", "datastore",
  "xmlnstbl", "listtable", "listoverridetable", "rsidtbl", "generator", "pgdsctbl", "filetbl", "revtbl",
  "fldinst", "bkmkstart", "bkmkend", "mmathPr", "wgrffmtfilter", "pnseclvl", "shp", "nonshppict",
]);

/**
 * Tanda tampilan yang dipakai saat panel disusun. Disimpan di luar elemennya -
 * atribut pada panel akan mengubah DOM tampilan Lama.
 */
const t6TandaPanel = new WeakMap();
/** Keadaan panel yang sedang tertata (satu halaman, satu panel). */
let t6Keadaan = null;
/** Janji penataan Tahap 6 terakhir - ditunggu lapisan perbaikan 30 Sep sore. */
let t6JanjiTata = null;
let t6PendengarTerpasang = false;
/** Klik CETAK berikutnya sudah dikonfirmasi lewat dialog Tahap 6. */
let t6CetakLolos = false;
/** Penjaga CETAK lama dilewati SEKALI - dialog Tahap 6 sudah menanyakannya. */
let t6LewatiLama = false;
/** Tumpukan urungkan/ulangi per perkara (abt-23) - hidup selama halaman terbuka. */
const t6Tumpukan = new Map();
/** Kotak ketik yang terakhir disunting - sasaran "Sisipkan" (abt-27). */
let t6KotakTerakhir = null;
/** field-sizing: content didukung peramban ini (null = belum diperiksa). */
let t6UkurSendiri = null;
/** Penyunting saksi yang simpannya sudah dikonfirmasi lewat dialog jawaban kosong. */
const t6SimpanLolos = new WeakSet();

// ─── Pembungkus fondasi Tahap 1 ──────────────────────────────────────────────

function t6Mode() {
  try {
    return typeof alatUjiMode === "function" ? String(alatUjiMode() || "lama") : "lama";
  } catch {
    return "lama";
  }
}

function t6Aktif() {
  return t6Mode() !== "lama";
}

function t6Modern() {
  try {
    return typeof alatKulit === "function" && alatKulit() === "modern";
  } catch {
    return false;
  }
}

function t6Nyala(kode) {
  try {
    return typeof alatFiturNyala === "function" && alatFiturNyala(kode) === true;
  } catch {
    return false;
  }
}

function t6Coba() {
  try {
    return typeof alatCobaAktif === "function" && alatCobaAktif() === true;
  } catch {
    return false;
  }
}

/** Ide menyala, ATAU perbaikan desain yang sama wujudnya dalam UI Baru. */
function t6Pakai(k, kode) {
  return t6Nyala(kode) || Boolean(k && k.modern && T6_DESAIN.has(kode));
}

/** Ringkasan tampilan: berubah = panel perlu disusun ulang. */
function t6TandaTampilan() {
  const nyala = T6_SEMUA.filter((kode) => t6Nyala(kode)).map((kode) => kode.slice(4));
  return `${t6Mode()}|${t6Modern() ? "modern" : "klasik"}|${nyala.join(",")}`;
}

// ─── Perkakas kecil ──────────────────────────────────────────────────────────

/**
 * Setiap unsur buatan blok ini berkelas "aleta-t6". Dengan kelas itulah
 * pengamat perubahan mengenali tulisannya sendiri dan tidak bereaksi atasnya -
 * tanpa itu hiasan yang ditambahkan memicu hiasan berikutnya tanpa akhir.
 */
function t6El(tag, kelas, teks) {
  return buatElemen(tag, `aleta-t6${kelas ? ` ${kelas}` : ""}`, teks);
}

function t6Tombol(teks, judul, kelas) {
  const b = t6El("button", `aleta-t6-tombol${kelas ? ` ${kelas}` : ""}`, teks);
  b.type = "button";
  if (judul) b.title = judul;
  return b;
}

function t6Pad(n) {
  return String(n).padStart(2, "0");
}

/** "10.41" untuk hari ini, "28-09 14.05" untuk hari lain. */
function t6Jam(iso, denganDetik) {
  const t = new Date(String(iso || ""));
  if (Number.isNaN(t.getTime())) return "";
  const jam = `${t6Pad(t.getHours())}.${t6Pad(t.getMinutes())}${denganDetik ? `.${t6Pad(t.getSeconds())}` : ""}`;
  if (t.toDateString() === new Date().toDateString()) return jam;
  return `${t6Pad(t.getDate())}-${t6Pad(t.getMonth() + 1)} ${jam}`;
}

function t6Angka(n) {
  return (Math.round(n * 10) / 10).toFixed(1).replace(".", ",").replace(/,0$/, "");
}

function t6Pendek(teks, batas) {
  const s = String(teks || "").replace(/\s+/g, " ").trim();
  return s.length > batas ? `${s.slice(0, batas - 1)}…` : s;
}

function t6Baku(teks) {
  return String(teks || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function t6Lolos(teks) {
  return String(teks).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Pola satu kata atau frasa utuh - tidak menempel pada huruf di kiri-kanannya. */
function t6PolaKata(teks, bendera) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${t6Lolos(teks)})(?=$|[^\\p{L}\\p{N}])`, `iu${bendera || ""}`);
}

function t6CatatGalat(galat, ringkas) {
  try {
    if (typeof alatCatat === "function") alatCatat("galat", ringkas || "Tahap 6 panel ABT", String((galat && galat.message) || galat));
  } catch {
    /* panel lama tetap utuh */
  }
}

async function t6Baca(kunci) {
  try {
    return (await chrome.storage.local.get(kunci)) || {};
  } catch {
    return {};
  }
}

function t6Tulis(isi) {
  try {
    Promise.resolve(chrome.storage.local.set(isi)).catch(() => {
      /* berlaku untuk halaman ini saja */
    });
  } catch {
    /* di luar konteks ekstensi */
  }
}

async function t6Tunggu(periksa, batasMs) {
  const mulai = Date.now();
  for (;;) {
    let hasil = null;
    try {
      hasil = periksa();
    } catch {
      hasil = null;
    }
    if (hasil) return hasil;
    if (Date.now() - mulai > batasMs) return null;
    await new Promise((r) => setTimeout(r, 60));
  }
}

/**
 * Satu permintaan ke portal. Pulang { ok, status, data, pesan, belumAda,
 * ditahan } dan TIDAK PERNAH melempar.
 *
 *   404   rutenya belum ada di server ini - disebut "belum tersedia di
 *         server", bukan "gagal": server yang belum dipasang bukan kerusakan
 *   423   ditahan mode coba / mode kering - kalimat penahannya disebut apa
 *         adanya, supaya tidak ada yang mengira tulisannya sudah terkirim
 */
async function t6AmbilJson(jalur, keterangan, opsi) {
  const o = { credentials: "include", cache: "no-store", ...(opsi || {}) };
  let respons;
  try {
    respons = typeof alatAmbil === "function" ? await alatAmbil(jalur, o, keterangan) : await fetch(jalur, o);
  } catch (galat) {
    return { ok: false, status: 0, data: null, belumAda: false, ditahan: false, pesan: String((galat && galat.message) || galat) };
  }
  let badan = null;
  try {
    badan = await respons.json();
  } catch {
    badan = null;
  }
  // mode_coba, mode_kering, dan mode_latihan (Tahap 7) - ketiganya jawaban
  // tiruan panel-alat.js, bukan jawaban server.
  if (respons.status === 423 && badan && /^mode_/.test(String(badan.alasan || ""))) {
    return {
      ok: false,
      status: 423,
      data: null,
      belumAda: false,
      ditahan: true,
      pesan: String(badan.pesan || "Ditahan - tidak ada yang dikirim."),
    };
  }
  if (respons.status === 404) {
    return { ok: false, status: 404, data: null, belumAda: true, ditahan: false, pesan: `${keterangan}: belum tersedia di server ini.` };
  }
  const dariServer = badan && badan.error ? String(badan.error.message || badan.error) : "";
  if (!respons.ok || (badan && badan.ok === false)) {
    const pesan =
      dariServer ||
      (typeof alatPesanGagal === "function" ? alatPesanGagal(null, respons.status, keterangan) : `${keterangan} gagal (status ${respons.status}).`);
    return { ok: false, status: respons.status, data: null, belumAda: false, ditahan: false, pesan };
  }
  const data = badan && typeof badan === "object" && "data" in badan ? badan.data : badan;
  return { ok: true, status: respons.status, data, belumAda: false, ditahan: false, pesan: "" };
}

/** Anak langsung pertama berkelas `kelas` - bukan cucu dari bagian lain. */
function t6Anak(induk, kelas) {
  if (!induk) return null;
  return Array.from(induk.children).find((c) => c.classList.contains(kelas)) || null;
}

function t6Lapor(k, teks, gagal) {
  try {
    if (k && k.panel && typeof k.panel.lapor === "function") k.panel.lapor(teks, gagal);
  } catch {
    /* kabar yang tidak tertulis tidak menghentikan pekerjaannya */
  }
}

/** Melompat ke baris variabel di halaman ABT dan menyorotnya sebentar. */
function t6Lompat(kode) {
  const item = barisVariabel().get(String(kode));
  if (!item) return false;
  try {
    item.baris.scrollIntoView({ block: "center" });
  } catch {
    /* peramban lama tanpa pilihan gulir */
  }
  item.baris.classList.add("aleta-t6-sorot");
  setTimeout(() => item.baris.classList.remove("aleta-t6-sorot"), 1800);
  return true;
}

/** Kode variabel sebagai tombol lompat. */
function t6KepingKode(kode, nama) {
  const b = t6Tombol(nama ? `${kode} ${nama}` : String(kode), `Lompat ke baris ${kode} di blangko`, "aleta-t6-keping");
  b.addEventListener("click", () => t6Lompat(kode));
  return b;
}

/** Tema panel untuk unsur yang hidup di luar panel (dialog, mode sidang). */
function t6TemaPanel() {
  const panel = document.getElementById(PENANDA_ABT);
  return (panel && panel.getAttribute("data-tema")) || "gelap";
}

// ─── Dialog peringatan dengan konfirmasi ─────────────────────────────────────

/**
 * Dialog yang menyebut apa yang salah, dan menunggu keputusan petugas.
 *
 * Tombol lanjutnya MATI sampai kotak "Sudah saya periksa" dicentang: satu
 * tekanan Enter tidak boleh melewati peringatan yang isinya ikut tercetak ke
 * putusan. Esc dan "Batal" selalu dapat ditekan. Pulang true bila dilanjutkan.
 */
function t6Dialog(o) {
  return new Promise((selesai) => {
    const tirai = t6El("div", "aleta-t6-tirai");
    const kotak = t6El("div", "aleta-t6-dialog");
    kotak.setAttribute("role", "alertdialog");
    kotak.setAttribute("aria-modal", "true");
    kotak.setAttribute("data-tema", t6TemaPanel());
    kotak.appendChild(t6El("div", "aleta-t6-dialog-judul", o.judul));
    for (const bagian of o.isi || []) {
      if (!bagian) continue;
      kotak.appendChild(typeof bagian === "string" ? t6El("div", "aleta-t6-dialog-teks", bagian) : bagian);
    }
    let centang = null;
    if (o.centang) {
      const label = t6El("label", "aleta-t6-dialog-centang");
      centang = document.createElement("input");
      centang.type = "checkbox";
      centang.className = "aleta-t6 aleta-t6-dialog-periksa";
      label.appendChild(centang);
      label.appendChild(document.createTextNode(` ${o.centang}`));
      kotak.appendChild(label);
    }
    const baris = t6El("div", "aleta-t6-dialog-baris");
    const tidak = t6Tombol(o.tidak || "Batal", "", "aleta-t6-dialog-tidak");
    const ya = t6Tombol(o.ya || "Lanjutkan", "", "aleta-t6-dialog-ya");
    if (centang) {
      ya.disabled = true;
      centang.addEventListener("change", () => {
        ya.disabled = !centang.checked;
      });
    }
    baris.appendChild(tidak);
    baris.appendChild(ya);
    kotak.appendChild(baris);
    tirai.appendChild(kotak);

    const esc = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      tutup(false);
    };
    function tutup(hasil) {
      document.removeEventListener("keydown", esc, true);
      tirai.remove();
      selesai(hasil);
    }
    ya.addEventListener("click", () => {
      if (!ya.disabled) tutup(true);
    });
    tidak.addEventListener("click", () => tutup(false));
    document.addEventListener("keydown", esc, true);
    document.body.appendChild(tirai);
    try {
      (centang || tidak).focus();
    } catch {
      /* fokus hanya kenyamanan */
    }
  });
}

/** Daftar butir untuk isi dialog. */
function t6DaftarDialog(judul, butir) {
  if (!butir.length) return null;
  const wadah = t6El("div", "aleta-t6-dialog-daftar");
  wadah.appendChild(t6El("div", "aleta-t6-dialog-subjudul", judul));
  const ul = t6El("ul", "aleta-t6-dialog-ul");
  for (const x of butir) ul.appendChild(t6El("li", "", x));
  wadah.appendChild(ul);
  return wadah;
}

// ─── Pendengar sekali seumur halaman ─────────────────────────────────────────

/**
 * Dipasang sekali, dan setiap pendengar memeriksa keadaannya sendiri pada saat
 * dipanggil: dalam tampilan Lama t6Keadaan kosong, jadi semuanya pulang pada
 * baris pertamanya dan tidak ada satu pun yang berubah.
 */
function t6PasangPendengar() {
  if (t6PendengarTerpasang) return;
  t6PendengarTerpasang = true;
  try {
    document.addEventListener("aleta-uji-berubah", t6SaatUjiBerubah);
    document.addEventListener("click", t6SaatKlik, true);
    document.addEventListener("keydown", t6SaatTombol, true);
    document.addEventListener("focusin", t6SaatFokus, true);
  } catch {
    /* tampilannya berganti saat halaman dimuat ulang */
  }
  try {
    chrome.storage.onChanged.addListener(t6SaatSimpanBerubah);
  } catch {
    /* di luar konteks ekstensi */
  }
}

/**
 * Tampilan atau saklar berganti dari popup: panel disusun ulang HANYA bila
 * tandanya berubah. Peristiwa ini juga menyala dalam tampilan Lama (tampilan
 * dari server dibaca ulang) - tandanya sama, jadi tidak ada yang terjadi.
 */
function t6SaatUjiBerubah() {
  const panel = document.getElementById(PENANDA_ABT);
  if (!panel) return;
  if (t6TandaPanel.get(panel) === t6TandaTampilan()) return;
  // Menyusun ulang membuang isi panel - termasuk keterangan saksi yang sedang
  // disunting dan belum disimpan ke ABT. Selama penyunting itu terbuka,
  // pergantiannya ditunda sampai ↻ ditekan, dan itu disebut di kotak kabar
  // panel sendiri.
  if (panel.querySelector(".aleta-sdg-hasil, textarea.aleta-abt-sunting-kotak")) {
    try {
      if (typeof panel.lapor === "function") {
        panel.lapor("Tampilan ALETA berganti. Panel disusun ulang saat ↻ ditekan - keterangan saksi yang sedang disunting tidak dibuang.");
      }
    } catch {
      /* kabar hanya pemberitahuan */
    }
    return;
  }
  t6BangunUlang();
}

function t6BangunUlang() {
  t6Hentikan();
  t6BersihkanHalaman();
  const lama = document.getElementById(PENANDA_ABT);
  if (lama) lama.remove();
  // Sama dengan tombol segarkan di kaki panel: penandanya dipadamkan supaya
  // pasang() benar-benar membangun ulang, bukan keluar pada baris pertamanya.
  sudahDipasang = false;
  void pasang();
}

/** Sisa Tahap 6 di halaman ABT sendiri (bukan di panel) dibuang. */
function t6BersihkanHalaman() {
  for (const el of Array.from(document.querySelectorAll(".aleta-t6-halaman, .aleta-t6-tirai, .aleta-t6-sidang"))) el.remove();
  for (const el of Array.from(document.querySelectorAll(".aleta-t6-sorot"))) el.classList.remove("aleta-t6-sorot");
}

function t6Hentikan() {
  const k = t6Keadaan;
  t6Keadaan = null;
  if (!k) return;
  for (const p of k.pengamat) {
    try {
      p.disconnect();
    } catch {
      /* sudah lepas */
    }
  }
  for (const j of k.pewaktu) {
    clearInterval(j);
    clearTimeout(j);
  }
  k.pengamat.length = 0;
  k.pewaktu.length = 0;
}

function t6SaatFokus(e) {
  if (!t6Keadaan) return;
  const t = e.target;
  if (t && t.matches && t.matches("textarea.aleta-abt-ketik, textarea.aleta-abt-sunting-kotak, textarea.aleta-sdg-jawab")) {
    t6KotakTerakhir = t;
  }
}

/**
 * Klik di halaman, fase tangkap - mendahului pendengar penjaga CETAK lama yang
 * terpasang pada tautannya sendiri.
 */
function t6SaatKlik(e) {
  const k = t6Keadaan;
  if (!k || !t6Aktif()) return;
  const t = e.target instanceof Element ? e.target : null;
  if (!t) return;

  // abt-25: dalam mode baca, klik isi blangko tidak membuka penyunting.
  if (k.baca && t6Nyala("abt-25") && t.closest(".aleta-abt-dapat-disunting") && !t.closest(".aleta-abt-sunting")) {
    e.preventDefault();
    e.stopPropagation();
    t6Lapor(k, "Mode baca menyala - penyunting tidak dibuka. Matikan dengan ▤ di kepala panel.");
    return;
  }

  const tautan = t.closest('a[href*="abt/preview"]');
  if (!tautan) return;
  if (t6CetakLolos) {
    // Klik ulangan sesudah dialog dikonfirmasi: berjalan terus, dan penjaga
    // lama tidak bertanya kedua kalinya atas hal yang sama.
    t6CetakLolos = false;
    t6LewatiLama = true;
    setTimeout(() => {
      t6LewatiLama = false;
    }, 0);
    return;
  }
  if (!t6Pakai(k, "abt-5")) return;
  // Perbaikan 1 Okt butir 10: di UI Baru yang ditunda tidak ikut ditanyakan.
  // 7 Okt: turunan 8503 yang dihimpun menjadi satu butir TETAP ditanyakan -
  // kalimat errornya tetap ikut tercetak sampai 8503 diisi.
  const pilah = t6Modern() ? t6PilahGalat() : null;
  const rusak = pilah ? [...pilah.kesatuan, ...pilah.rusak] : t6DaftarGalat();
  if (!rusak.length) return;
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
  void t6KonfirmasiCetak(k, tautan, rusak);
}

/** Dipanggil penjaga CETAK lama: true = lewati, dialog Tahap 6 sudah bertanya. */
function t6LewatiPenjagaLama() {
  if (!t6LewatiLama) return false;
  t6LewatiLama = false;
  return true;
}

function t6SaatTombol(e) {
  const k = t6Keadaan;
  if (!k || !t6Nyala("abt-23")) return;
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const kunci = String(e.key || "").toLowerCase();
  if (kunci !== "z" && kunci !== "y") return;
  const s = e.target instanceof Element ? e.target : null;
  // Di dalam kotak ketik, Ctrl+Z milik kotak itu sendiri - urungkan ketikan,
  // bukan urungkan simpanan ke ABT.
  if (s && (s.isContentEditable || s.closest('input, textarea, select, [contenteditable="true"]'))) return;
  e.preventDefault();
  const ulang = kunci === "y" || e.shiftKey;
  void (ulang ? t6Ulangi(k) : t6Urungkan(k));
}

/**
 * Simpanan baru di riwayat ABT milik perkara ini masuk ke tumpukan urungkan
 * (abt-23). Yang dicatat pengurungan sendiri tidak ikut - tanpa itu satu
 * Ctrl+Z menumpuk dirinya sendiri dan Ctrl+Z berikutnya membatalkannya.
 */
function t6SaatSimpanBerubah(ubah, tempat) {
  const k = t6Keadaan;
  if (tempat !== "local" || !k || !t6Nyala("abt-23") || !ubah || !ubah[KUNCI_RIWAYAT]) return;
  const baru = Array.isArray(ubah[KUNCI_RIWAYAT].newValue) ? ubah[KUNCI_RIWAYAT].newValue : [];
  const lama = Array.isArray(ubah[KUNCI_RIWAYAT].oldValue) ? ubah[KUNCI_RIWAYAT].oldValue : [];
  const sudah = new Set(lama.map((x) => `${x && x.pada}|${x && x.kode}`));
  const masuk = baru.filter(
    (x) =>
      x &&
      !sudah.has(`${x.pada}|${x.kode}`) &&
      String(x.perkaraId || "") === k.perkaraId &&
      x.cara !== "diurungkan" &&
      x.cara !== "diulang"
  );
  if (!masuk.length) return;
  const t = t6TumpukanDari(k.perkaraId);
  for (const x of masuk.reverse()) t.urung.push(x);
  t.ulang.length = 0;
  t6SegarkanUrung(k);
}

// ─── Penata utama ────────────────────────────────────────────────────────────

/** Dipanggil pasang(). Kegagalannya tidak boleh menggagalkan panel lama. */
function t6TataAman(panel, jatiDiri) {
  try {
    // Janjinya disimpan: lapisan perbaikan 30 Sep sore (sore) menata SESUDAH ini.
    t6JanjiTata = t6Tata(panel, jatiDiri).catch((galat) => t6CatatGalat(galat, "Penataan panel ABT Tahap 6 gagal"));
  } catch (galat) {
    t6CatatGalat(galat, "Penataan panel ABT Tahap 6 gagal");
  }
}

/**
 * Menata panel yang SUDAH disusun jalur lama. Dalam tampilan Lama - dan dalam
 * Baru tanpa satu saklar abt pun - hanya mencatat tanda tampilannya (di luar
 * DOM) lalu pulang.
 */
async function t6Tata(panel, jatiDiri) {
  t6PasangPendengar();
  t6TandaPanel.set(panel, t6TandaTampilan());
  // Panel yang disusun ulang lewat ↻ sesudah tampilan berganti: sisa Tahap 6
  // di halaman ABT (penanda di sebelah CETAK, dialog) ikut dibuang. Dalam
  // tampilan Lama yang tidak pernah berganti tidak ada sisa - tidak ada yang
  // tersentuh.
  const adaSebelumnya = Boolean(t6Keadaan);
  t6Hentikan();
  if (adaSebelumnya) t6BersihkanHalaman();
  if (!t6Aktif()) return;
  const modern = t6Modern();
  if (!modern && !T6_SEMUA.some((kode) => t6Nyala(kode))) return;

  const simpan = await t6Baca([T6_KUNCI_SEMATAN, T6_KUNCI_BACA, T6_KUNCI_DRAF, T6_KUNCI_TEMPLAT, T6_KUNCI_DITOLAK]);
  // Panel dapat sudah diganti selagi penyimpanan dibaca.
  if (document.getElementById(PENANDA_ABT) !== panel) return;

  const isi = t6Anak(panel, "aleta-isi");
  if (!isi) return;
  const aksi = t6Anak(isi, "aleta-abt-aksi");
  const daftar = Array.from(isi.children).filter((c) => c.classList.contains("aleta-abt-daftar"));
  const tombolAksi = aksi ? Array.from(aksi.children) : [];
  const objek = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
  const nomor = nomorPerkaraAbt();
  const k = {
    panel,
    jatiDiri: jatiDiri || { perkaraId: "", perkTemp: "" },
    perkaraId: String((jatiDiri && jatiDiri.perkaraId) || ""),
    nomor,
    jenis: nilaiVariabel(VAR_JENIS_PERKARA) || sebutJenisPerkara(nomor) || "",
    modern,
    isi,
    kepala: t6Anak(panel, "aleta-kepala"),
    kaki: t6Anak(panel, "aleta-kaki"),
    aksi,
    kabar: t6Anak(isi, "aleta-abt-kabar"),
    unggah: t6Anak(isi, "aleta-abt-bagian"),
    petunjuk: t6Anak(isi, "aleta-abt-petunjuk"),
    // Urutan pemasangan di susunPanelAbt: sipp, saksi, itsbat, perkara lain,
    // susun saksi, riwayat, rapikan.
    tombol: {
      sipp: tombolAksi[0] || null,
      saksi: tombolAksi[1] || null,
      itsbat: tombolAksi[2] || null,
      lain: tombolAksi[3] || null,
      sdg: tombolAksi[4] || null,
      riwayat: tombolAksi[5] || null,
      rapikan: tombolAksi[6] || null,
    },
    wadah: { riwayat: daftar[0] || null, selisih: daftar[1] || null, sepihak: daftar[2] || null, huruf: daftar[3] || null, usulan: daftar[4] || null },
    sematan: Array.isArray(simpan[T6_KUNCI_SEMATAN]) ? simpan[T6_KUNCI_SEMATAN].map(String) : [],
    baca: simpan[T6_KUNCI_BACA] === true,
    draf: objek(simpan[T6_KUNCI_DRAF]),
    templat: objek(simpan[T6_KUNCI_TEMPLAT]),
    ditolak: objek(simpan[T6_KUNCI_DITOLAK]),
    pengamat: [],
    pewaktu: [],
    kuasa: null,
    prodeo: null,
    saring: "semua",
    tampilTakBerlaku: false,
    komentar: null,
    wajib: null,
    pasal: null,
    langkah: new Map(),
    langkahSebab: new Map(),
    langkahSemua: false,
    peran: "",
    jurusita: null,
    usulanSipp: null,
    judulSaksi: null,
    alatTerbuka: "",
    drafSidik: "",
    drafPada: "",
  };
  t6Keadaan = k;
  if (modern) panel.setAttribute("data-t6", "ui");

  const atas = t6El("div", "aleta-t6-atas");
  isi.insertBefore(atas, isi.firstChild);
  k.atas = atas;

  if (t6Pakai(k, "abt-5")) t6PasangPitaBahaya(k);
  if (t6Pakai(k, "abt-11")) t6PasangKemajuan(k);
  if (t6Nyala("abt-17")) t6PasangWajib(k);
  // B1 (10 Okt): pengingat SIPP vs ABT sebelum CETAK - UI Baru saja.
  if (modern) t6PasangCekSipp(k);
  if (t6Nyala("abt-18")) t6PasangKomentar(k);
  if (t6Nyala("abt-21") || t6Nyala("abt-22")) t6PasangCari(k);
  if (t6Nyala("abt-29")) t6PasangDrafLama(k);
  if (t6Nyala("abt-25")) t6PasangPitaBaca(k);
  if (t6Pakai(k, "abt-4")) t6PasangSegmen(k);
  if (t6Pakai(k, "abt-10") && aksi) t6PasangLangkah(k);
  if (t6Pakai(k, "abt-1") && k.kabar) t6PasangRamah(k);
  t6PasangAlat(k);
  t6PasangKepala(k);
  if (k.unggah) t6TataUnggah(k);
  t6PasangPengamat(k);
  if (t6Nyala("abt-29")) k.pewaktu.push(setInterval(() => t6SimpanDraf(k), T6_DRAF_MS));
  t6TerapkanBaca(k);

  if (!atas.childElementCount) atas.remove();
  t6SegarkanHalaman(k);
  // Perbaikan 30 September 2026 - hidup di Baru dan UI Baru.
  t6PasangPeran(k);
  t6PasangInfo(k);
}

// ─── abt-5 / D8: pita bahaya galat, dan CETAK dengan konfirmasi ─────────────

function t6DaftarGalat() {
  const hasil = [];
  for (const [kode, item] of barisVariabel()) {
    if (keadaanNilai(item.nilai) === "galat") hasil.push({ kode, nama: item.nama });
  }
  return hasil;
}

/**
 * Huruf alasan pada 8503 yang tidak punya cabang di kueri 4020 blangko ini
 * (C, D, E, G, ...). Kosong bila 8503 bukan deretan huruf - "Fasakh" misalnya.
 * Blangko yang sudah dipasangi paket abt-alasan-cdeh mengenal A-H seluruhnya.
 */
function t6HurufTakBercabang() {
  const isi = nilaiVariabel(VAR_HURUF).toUpperCase().replace(/\bDAN\b/g, "");
  const huruf = isi.replace(/[^A-Z]/g, "");
  if (!huruf || huruf.length > 8 || !/^[A-K]+$/.test(huruf)) return [];
  const dikenal = abtKenalSemuaHuruf() ? URUTAN_HURUF : HURUF_LAMA;
  return Array.from(new Set(huruf.split(""))).filter((h) => !dikenal.includes(h));
}

/**
 * Butir 5 (30 Sep): 8503 ada di blangko ini dan masih KOSONG. Selama itu,
 * T6_TERGANTUNG_8503 yang berbunyi error belum waktunya diisi - sebabnya
 * satu, dan sebab itu disebut sekali, tidak sebagai error.
 */
function t6HurufKosong() {
  const item = barisVariabel().get(VAR_HURUF);
  return Boolean(item) && keadaanNilai(item.nilai) !== "terisi";
}

/**
 * Daftar error dipilah: yang sungguh error, yang menunggu 8503, dan (UI Baru,
 * 7 Okt) `kesatuan` - turunan 8503 yang berbunyi error karena 8503 kosong
 * atau tidak dikenali. Kesatuan tampil sebagai SATU butir "Isi huruf alasan
 * perceraian (8503)", bukan sebagai daftar error per variabel - tetapi tetap
 * ikut ditanyakan saat CETAK (t6SaatKlik).
 */
function t6PilahGalat() {
  const semua = t6DaftarGalat();
  // Perbaikan 1 Okt butir 10 (UI Baru saja): yang ditunda a1GalatDitunda
  // adalah "tunggu" - termasuk saat 8503 sudah berisi.
  if (t6Modern()) {
    const kesatuan = t6Kesatuan8503Aktif() ? semua.filter((x) => TURUNAN_8503.includes(String(x.kode))) : [];
    const sisa = semua.filter((x) => !kesatuan.includes(x));
    const tundaA1 = sisa.filter((x) => a1GalatDitunda(x.kode));
    return { rusak: sisa.filter((x) => !tundaA1.includes(x)), tunggu: tundaA1, kesatuan };
  }
  if (!t6HurufKosong()) return { rusak: semua, tunggu: [], kesatuan: [] };
  const tunggu = semua.filter((x) => T6_TERGANTUNG_8503.includes(String(x.kode)));
  return { rusak: semua.filter((x) => !tunggu.includes(x)), tunggu, kesatuan: [] };
}

function t6PasangPitaBahaya(k) {
  k.pitaBahaya = t6El("div", "aleta-t6-pita-bahaya");
  k.pitaBahaya.setAttribute("role", "alert");
  k.pitaBahaya.hidden = true;
  k.atas.appendChild(k.pitaBahaya);
  // 7 Okt (UI Baru saja): satu butir untuk 8503 dan seluruh turunannya.
  if (k.modern) {
    k.pita8503 = t6El("div", "aleta-t6-pita-8503");
    k.pita8503.hidden = true;
    k.atas.appendChild(k.pita8503);
  }
  k.pitaTunggu = t6El("div", "aleta-t6-pita-tunggu");
  k.pitaTunggu.hidden = true;
  k.atas.appendChild(k.pitaTunggu);
}

function t6SegarkanPitaBahaya(k) {
  const pita = k.pitaBahaya;
  if (!pita) return;
  const { rusak, tunggu, kesatuan } = t6PilahGalat();
  if (k.pita8503) {
    try {
      t6Segarkan8503(k, kesatuan || []);
    } catch (galat) {
      t6CatatGalat(galat, "Butir 8503 panel ABT gagal disegarkan");
    }
  }
  const sidik =
    rusak.map((x) => x.kode).join(",") + "|" + tunggu.map((x) => x.kode).join(",") + "|" + nilaiVariabel(VAR_HURUF) + (t6Modern() ? `|${a1SidikStatus()}` : "");
  if (pita.dataset.sidik === sidik) return;
  pita.dataset.sidik = sidik;
  if (k.pitaTunggu && t6Modern()) {
    a1IsiPitaTunggu(k.pitaTunggu, tunggu);
  } else if (k.pitaTunggu) {
    k.pitaTunggu.textContent = "";
    k.pitaTunggu.hidden = tunggu.length === 0;
    if (tunggu.length) {
      k.pitaTunggu.appendChild(
        t6El(
          "span",
          "",
          `${tunggu.map((x) => x.kode).join(", ")} akan terisi sesudah 8503 (huruf alasan) diisi - bunyi "TIDAK BENAR QUERY NYA" di sana belum dihitung sebagai error. `
        )
      );
      k.pitaTunggu.appendChild(t6KepingKode(VAR_HURUF, "Huruf Alasan"));
    }
  }
  pita.textContent = "";
  pita.hidden = rusak.length === 0;
  if (!rusak.length) return;
  const takBercabang = t6HurufTakBercabang();
  const kode = rusak.map((x) => x.kode).join(", ");
  pita.appendChild(
    t6El(
      "div",
      "aleta-t6-pita-judul",
      takBercabang.length
        ? `Blangko ini belum punya cabang untuk huruf ${takBercabang.join(", ")}. 8503 berisi "${nilaiVariabel(VAR_HURUF)}", sehingga ${kode} berbunyi "TIDAK BENAR QUERY NYA" - dan kalimat itu ikut tercetak ke dalam putusan.`
        : `${rusak.length} variabel berbunyi pesan error (${kode}) - kalimat itu ikut tercetak ke dalam putusan.`
    )
  );
  const keping = t6El("div", "aleta-t6-keping-deret");
  for (const x of rusak) keping.appendChild(t6KepingKode(x.kode, t6Pendek(x.nama, 28)));
  pita.appendChild(keping);
  const cara = document.createElement("details");
  cara.className = "aleta-t6 aleta-t6-pita-cara";
  cara.appendChild(t6El("summary", "", "Lihat cara memperbaiki"));
  cara.appendChild(
    t6El(
      "div",
      "aleta-t6-lembut",
      takBercabang.length
        ? "Tugas ABT satker \"enam baris huruf C/D/E/G\" - kini paket ABT abt-alasan-cdeh (huruf A-H dan gabungannya, beserta pertimbangan C, D, E, H): pasang paket itu di ABT satker (sudah disiapkan, belum terpasang). " +
            "Sampai itu terpasang, isi 8503 hanya dengan A, B, F, H, AB, AF, BF, atau ABF - atau tulis pertimbangannya sendiri di variabel pertimbangan."
        : "Variabel (OTOMATIS) disusun ABT dari kerangka fakta. Lengkapi variabel yang menyuapinya (lihat kartu huruf alasan dan variabel kerangka), lalu muat ulang halaman."
    )
  );
  pita.appendChild(cara);
  pita.appendChild(
    t6El("div", "aleta-t6-lembut", "CETAK tidak ditahan: ia meminta konfirmasi \"Sudah saya periksa\" selama error ini ada.")
  );
}

async function t6KonfirmasiCetak(k, tautan, rusak) {
  const { kurang } = periksaKelengkapan();
  const takBercabang = t6HurufTakBercabang();
  const wajib = t6WajibKosong(k);
  const kesatuan = t6Modern() ? t6PilahGalat().kesatuan : [];
  const ya = await t6Dialog({
    judul: "Sebelum CETAK - kalimat error akan ikut tercetak",
    isi: [
      takBercabang.length
        ? `8503 berisi huruf ${takBercabang.join(", ")} yang belum punya cabang di blangko ini.`
        : "",
      kesatuan.length
        ? `Huruf alasan perceraian (8503) belum diisi atau tidak dikenali ABT - ${kesatuan.map((x) => x.kode).join(", ")} berbunyi "TIDAK BENAR QUERY NYA" dan ikut tercetak. Isi 8503 di panel supaya ABT menyusun seluruhnya.`
        : "",
      t6PilahGalat().tunggu.length
        ? t6Modern()
          ? `${t6PilahGalat().tunggu.map((x) => x.kode).join(", ")} diisi otomatis oleh ABT sesudah Input ke ABT - belum dihitung error. Bila dicetak sekarang, bunyinya tercetak apa adanya.`
          : `8503 (huruf alasan) masih kosong - ${t6PilahGalat().tunggu.map((x) => x.kode).join(", ")} baru terisi sesudah 8503 diisi. Bila dicetak sekarang, kalimatnya tercetak apa adanya.`
        : "",
      t6DaftarDialog(
        `${rusak.length} variabel berbunyi pesan error - kalimatnya ikut tercetak sebagai bagian putusan:`,
        rusak.map((x) => `${x.kode} ${x.nama}`)
      ),
      t6DaftarDialog(`${kurang.length} variabel kerangka masih kosong:`, kurang),
      wajib.length ? t6DaftarDialog(`${wajib.length} variabel wajib masih kosong:`, wajib.map((x) => `${x.kode} ${x.nama}`)) : null,
      "Pencetakan tidak ditahan. Lanjutkan hanya bila isi putusan itu memang sudah Anda periksa.",
    ],
    centang: "Sudah saya periksa",
    ya: "Tetap CETAK",
    tidak: "Batal",
  });
  try {
    if (typeof alatCatat === "function") {
      alatCatat("abt-cetak", ya ? "CETAK dilanjutkan sesudah konfirmasi error" : "CETAK dibatalkan di dialog error", rusak.map((x) => x.kode).join(", "));
    }
  } catch {
    /* kotak hitam hanya catatan */
  }
  if (!ya) return;
  t6CetakLolos = true;
  tautan.click();
}

// ─── 7 Okt: 8503 dan turunannya SATU KESATUAN (UI Baru saja) ────────────────
//
// Keluhan pengguna (tangkapan 30): pita merah menyebut "2 variabel berbunyi
// pesan error (8531, 8532)", padahal 4020, 8524, 8521, 8522, 8528, 8529, 8530,
// 8531, dan 8532 seluruhnya berbunyi "TIDAK BENAR QUERY NYA" karena SATU sebab:
// huruf alasan 8503 belum diisi. Begitu 8503 terisi, kueri ABT menyusun
// semuanya sendiri.
//
// Karena itu, selama 8503 kosong (atau bentuknya tidak dikenali kueri ABT) dan
// sekurang-kurangnya satu turunannya berbunyi error, panel tidak menampilkan
// daftar error per variabel melainkan SATU butir "Isi huruf alasan perceraian
// (8503)" dengan isian langsung. Menyimpannya memakai penulis yang sama dengan
// "Input ke ABT" (tulisHurufAlasan -> simpanVariabel -> abt/edit_data), lalu
// turunannya dihitung ulang dengan membaca ulang halaman blangko yang sama
// (GET, tanpa menulis) dan mengganti isi sel turunannya di tempat - panel
// tidak dimuat ulang, isian lain yang sedang dikerjakan tidak hilang.
//
// Yang TIDAK berubah: CETAK tetap meminta "Sudah saya periksa" selama
// turunannya masih berbunyi error (t6SaatKlik memasukkan `kesatuan`), dan
// usulan huruf yang RAGU tidak pernah diisikan sendiri - ia hanya ditawarkan.

/** Usulan huruf dari analisis saksi terakhir (soreGambarIsi). undefined = belum dibaca. */
let t6UsulanHuruf = undefined;

/** Turunan 8503 yang tergambar di halaman dan berbunyi pesan error. */
function t6TurunanGalat() {
  const peta = barisVariabel();
  return TURUNAN_8503.filter((kode) => peta.has(kode) && keadaanNilai(peta.get(kode).nilai) === "galat");
}

/**
 * Isi 8503 yang dikenali kueri ABT: deretan huruf A-H rapat (blangko berpaket
 * abt-alasan-cdeh), atau salah satu gabungan lama (blangko tanpa paket), atau
 * Fasakh/Murtad. "A, F" TIDAK - regexp ABT berjangkar dan tidak menerima koma.
 */
function t6HurufSah(nilai) {
  if (keadaanNilai(nilai) !== "terisi") return false;
  const baku = String(nilai || "").toUpperCase().replace(/\s+/g, "");
  if (/^(FASAKH|MURTAD)$/.test(baku)) return true;
  if (!/^[A-H]+$/.test(baku)) return false;
  return dikenali4020(baku.split(""));
}

/**
 * Butir satu kesatuan berlaku? Hanya UI Baru, hanya bila baris 8503 ada,
 * 8503 tidak sah, dan sekurang-kurangnya satu turunannya berbunyi error.
 * Huruf yang sah bentuknya tetapi belum bercabang di blangko lama (C, D, E, G
 * tanpa paket) tetap memakai pesan lama "belum punya cabang" - tidak diambil
 * alih di sini.
 */
function t6Kesatuan8503Aktif() {
  if (!t6Modern()) return false;
  const item = barisVariabel().get(VAR_HURUF);
  if (!item) return false;
  if (t6HurufSah(item.nilai)) return false;
  if (t6HurufTakBercabang().length) return false;
  return t6TurunanGalat().length > 0;
}

/**
 * Usulan huruf dari jawaban analisis saksi (sama dengan kartu "Alasan
 * perceraian"). `yakin` = huruf yang di kartu itu tercentang sendiri (tanpa
 * syarat, centangOtomatis tidak false, dan tidak "jangan dipakai"); `ragu` =
 * sisanya, kecuali yang di luar gugatan. null = tidak ada saksi terbaca.
 */
function t6Usulan8503(saksi) {
  if (!saksi || typeof saksi !== "object") return null;
  const yakin = [];
  const ragu = [];
  for (const h of Array.isArray(saksi.huruf) ? saksi.huruf : []) {
    const x = String((h && h.huruf) || "").trim().toUpperCase();
    if (!/^[A-H]$/.test(x)) continue;
    const sebab = soreSebabHuruf(h, saksi);
    if (sebab.nada === "awas") continue;
    if (!h.syarat && h.centangOtomatis !== false) yakin.push(x);
    else ragu.push(x);
  }
  const y = susun8503(yakin);
  return { yakin: y, ragu: susun8503(ragu.filter((x) => !y.includes(x))) };
}

/**
 * Isian 8503 dari ketikan: huruf A-H, boleh berspasi/berkoma/"dan" - disimpan
 * rapat dan berurutan (susun8503). Gabungan yang tidak dikenali kueri blangko
 * ini DITOLAK sebelum ditulis: menyimpannya hanya memindahkan pesan error.
 */
function t6Periksa8503(teks) {
  const baku = String(teks || "").toUpperCase().replace(/\bDAN\b|&|[,;.+/\s]/g, "");
  if (!baku) return { ok: false, isi: "", pesan: "Pilih atau ketik sekurang-kurangnya satu huruf alasan (A sampai H)." };
  if (!/^[A-H]+$/.test(baku)) return { ok: false, isi: "", pesan: "Hanya huruf A sampai H - satu huruf atau gabungannya, mis. F, AF, BF, ABF." };
  const isi = susun8503(baku.split(""));
  if (!dikenali4020(isi.split(""))) {
    return {
      ok: false,
      isi,
      pesan: `Gabungan ${isi} belum punya cabang di blangko satker ini (paket ABT abt-alasan-cdeh belum terpasang) - pakai A, B, F, H, AB, AF, BF, atau ABF.`,
    };
  }
  return { ok: true, isi, pesan: "" };
}

function t6JatiDiri8503(k) {
  const s = soreKeadaan;
  const j = (k && k.jatiDiri && k.jatiDiri.perkaraId ? k.jatiDiri : null) || (s && s.jatiDiri && s.jatiDiri.perkaraId ? s.jatiDiri : null) || jatiDiriPerkara();
  return j && j.perkaraId ? j : null;
}

/** Isi sel ABT diganti dengan sel hasil baca ulang; hiasan ALETA di dalamnya dipertahankan. */
function t6GantiIsiSel(sel, selBaru) {
  const hiasan = (n) => n.nodeType === 1 && /(^|\s)aleta-/.test(String(n.getAttribute("class") || ""));
  for (const n of Array.from(sel.childNodes)) if (!hiasan(n)) n.remove();
  const acuan = sel.firstChild;
  for (const n of Array.from(selBaru.childNodes)) {
    const salin = document.importNode(n, true);
    if (salin.nodeType === 1) {
      if (salin.tagName === "SCRIPT") continue;
      for (const s of Array.from(salin.querySelectorAll("script"))) s.remove();
    }
    sel.insertBefore(salin, acuan);
  }
  const gaya = selBaru.getAttribute("style");
  if (gaya !== null) sel.setAttribute("style", gaya);
}

/**
 * Menghitung ulang turunan 8503 TANPA memuat ulang panel: halaman blangko
 * yang sama dibaca ulang (GET - ABT menghitung data_sql saat halaman
 * disusun), lalu sel 8503 dan turunannya diganti di tempat. Penyunting yang
 * sedang terbuka di sel itu tidak disentuh.
 */
async function t6BacaUlangTurunan() {
  let teks = "";
  try {
    const r = await fetch(location.href, { credentials: "include", cache: "no-store" });
    if (!r.ok) return { ok: false, pesan: `ABT menjawab ${r.status}`, diganti: [], sisa: t6TurunanGalat() };
    teks = await r.text();
  } catch (galat) {
    return { ok: false, pesan: sorePesan(galat), diganti: [], sisa: t6TurunanGalat() };
  }
  let baru = new Map();
  try {
    baru = barisVariabel(new DOMParser().parseFromString(teks, "text/html"));
  } catch {
    baru = new Map();
  }
  if (!baru.size) return { ok: false, pesan: "halaman yang dibaca ulang tidak memuat tabel variabel", diganti: [], sisa: t6TurunanGalat() };
  const kini = barisVariabel();
  const diganti = [];
  for (const kode of [VAR_HURUF, ...TURUNAN_8503]) {
    const a = kini.get(kode);
    const b = baru.get(kode);
    if (!a || !b) continue;
    if (a.selNilai.querySelector(".aleta-abt-sunting")) continue;
    if (a.nilai === b.nilai) continue;
    t6GantiIsiSel(a.selNilai, b.selNilai);
    diganti.push(kode);
  }
  return { ok: true, pesan: "", diganti, sisa: t6TurunanGalat() };
}

function t6KabarHitungUlang(nilai, h) {
  if (!h.ok) {
    return {
      teks: `8503 berisi "${nilai}", tetapi variabel turunannya belum dapat dihitung ulang dari ABT (${h.pesan}). Muat ulang halaman untuk melihat hasilnya.`,
      gagal: true,
      muatUlang: true,
    };
  }
  if (h.sisa.length) {
    return {
      teks: `8503 berisi "${nilai}" dan turunannya sudah dihitung ulang ABT, tetapi ${h.sisa.join(", ")} masih berbunyi pesan error - lihat daftar error di atas.`,
      gagal: true,
    };
  }
  const turunan = h.diganti.filter((x) => x !== VAR_HURUF);
  return {
    teks: `8503 berisi "${nilai}". Variabel turunan dihitung ulang ABT${turunan.length ? ` (${turunan.join(", ")})` : ""} dan sudah terisi - tidak ada lagi pesan error dari 8503.`,
    gagal: false,
  };
}

/** Satu hitung ulang per isi 8503 - tombol Simpan dan pengamat tabel tidak menggandakannya. */
function t6HitungUlangTurunan(k, nilai) {
  if (k.hitungUlang && k.hitungUlang.nilai === nilai) return k.hitungUlang.janji;
  const janji = t6BacaUlangTurunan()
    .catch((galat) => ({ ok: false, pesan: sorePesan(galat), diganti: [], sisa: [] }))
    .then((h) => {
      if (t6Keadaan !== k) return h;
      if (h.ok) {
        // Sama dengan sesudah muat ulang: yang masih berbunyi error kini
        // sungguh error, bukan "belum waktunya" (a1AdaInputTertunda).
        a1Status.inputDiHalamanIni = false;
        a1Status.inputSesudahMuat = true;
      }
      k.kabar8503 = t6KabarHitungUlang(nilai, h);
      t6SegarkanHalaman(k);
      return h;
    });
  k.hitungUlang = { nilai, janji };
  return janji;
}

/**
 * 8503 berubah di halaman ini (Simpan di butir ini, Input ke ABT, atau sunting
 * di tempat) menjadi isi yang sah: turunannya dihitung ulang sendiri. Isi saat
 * halaman dimuat tidak memicu apa pun - ABT baru saja menghitungnya.
 */
function t6PantauGanti8503(k) {
  const nilai = nilaiVariabel(VAR_HURUF);
  if (k.awal8503 === undefined) k.awal8503 = nilai;
  if (nilai === k.awal8503 || !t6HurufSah(nilai)) return;
  if (k.hitungUlang && k.hitungUlang.nilai === nilai) return;
  const peta = barisVariabel();
  if (!TURUNAN_8503.some((kode) => peta.has(kode))) return;
  void t6HitungUlangTurunan(k, nilai);
}

function t6Segarkan8503(k, kesatuan) {
  const kotak = k.pita8503;
  if (!kotak) return;
  t6PantauGanti8503(k);
  const nilai = nilaiVariabel(VAR_HURUF);
  const usulan = t6UsulanHuruf;
  const paket = abtKenalSemuaHuruf();
  const sidik = [
    kesatuan.map((x) => x.kode).join(","),
    nilai,
    usulan === undefined ? "?" : usulan ? `${usulan.yakin}/${usulan.ragu}` : "-",
    paket ? 1 : 0,
    k.kabar8503 ? `${k.kabar8503.gagal ? 1 : 0}${k.kabar8503.teks}` : "",
    k.simpan8503Jalan ? 1 : 0,
  ].join("|");
  if (kotak.dataset.sidik === sidik) return;
  kotak.dataset.sidik = sidik;
  kotak.textContent = "";
  kotak.classList.toggle("aleta-t6-8503-isian", kesatuan.length > 0);

  const gambarKabar = () => {
    const kabar = t6El("div", "aleta-t6-8503-kabar");
    kabar.setAttribute("role", "status");
    if (k.kabar8503) {
      kabar.textContent = k.kabar8503.teks;
      kabar.classList.toggle("aleta-t6-gagal", Boolean(k.kabar8503.gagal));
      if (k.kabar8503.muatUlang) {
        const ulang = t6Tombol("Muat ulang halaman", "Memuat ulang halaman blangko ABT supaya variabel turunan 8503 dihitung ulang", "aleta-t6-kecil aleta-t6-8503-ulang");
        ulang.addEventListener("click", () => location.reload());
        kabar.appendChild(document.createTextNode(" "));
        kabar.appendChild(ulang);
      }
    }
    kabar.hidden = !kabar.textContent;
    return kabar;
  };

  if (!kesatuan.length) {
    // Sesudah 8503 terisi: hanya kabar hasil hitung ulang, bila ada.
    kotak.hidden = !k.kabar8503;
    if (k.kabar8503) kotak.appendChild(gambarKabar());
    return;
  }
  kotak.hidden = false;

  const kosong = keadaanNilai(nilai) !== "terisi";
  kotak.appendChild(t6El("div", "aleta-t6-pita-judul", "Isi huruf alasan perceraian (8503)"));
  kotak.appendChild(
    t6El(
      "div",
      "aleta-t6-lembut",
      kosong
        ? `8503 masih kosong, sehingga ${kesatuan.length} variabel turunannya berbunyi "TIDAK BENAR QUERY NYA" - dan kalimat itu ikut tercetak ke dalam putusan. Cukup isi 8503: ABT menyusun seluruh turunannya sendiri.`
        : `8503 berisi "${nilai}" - bentuk itu tidak dikenali kueri ABT, sehingga ${kesatuan.length} variabel turunannya berbunyi "TIDAK BENAR QUERY NYA". Tulis hurufnya rapat tanpa koma atau spasi (mis. AF).`
    )
  );
  const rinci = document.createElement("details");
  rinci.className = "aleta-t6 aleta-t6-pita-cara";
  rinci.appendChild(t6El("summary", "", `Variabel turunan (${kesatuan.length})`));
  const keping = t6El("div", "aleta-t6-keping-deret");
  for (const x of kesatuan) keping.appendChild(t6KepingKode(x.kode, t6Pendek(x.nama, 28)));
  rinci.appendChild(keping);
  kotak.appendChild(rinci);

  // ── Isian: tombol huruf A-H + kotak ketik, satu nilai ──────────────────
  const hurufKini = kosong ? "" : t6Periksa8503(nilai);
  let awal = "";
  let asalAwal = "";
  if (k.ketik8503 !== undefined) awal = k.ketik8503;
  else if (hurufKini && hurufKini.ok) {
    awal = hurufKini.isi;
    asalAwal = `Diambil dari isi 8503 sekarang ("${nilai}"), dirapatkan - periksa, lalu simpan.`;
  } else if (usulan && usulan.yakin) {
    awal = usulan.yakin;
  }

  const deretHuruf = t6El("div", "aleta-t6-8503-huruf");
  deretHuruf.setAttribute("role", "group");
  deretHuruf.setAttribute("aria-label", "Huruf alasan perceraian");
  const tombolHuruf = new Map();
  for (const h of URUTAN_HURUF) {
    const b = t6Tombol(h, `Huruf ${h}`, "aleta-t6-kecil aleta-t6-8503-tombol-huruf");
    b.setAttribute("data-huruf", h);
    if (!paket && !HURUF_LAMA.includes(h)) {
      b.disabled = true;
      b.title = `Huruf ${h} belum punya cabang di blangko satker ini (paket ABT abt-alasan-cdeh belum terpasang)`;
    }
    deretHuruf.appendChild(b);
    tombolHuruf.set(h, b);
  }
  kotak.appendChild(deretHuruf);

  const baris = t6El("div", "aleta-t6-8503-baris");
  const kotakKetik = document.createElement("input");
  kotakKetik.type = "text";
  kotakKetik.className = "aleta-t6 aleta-t6-8503-ketik";
  kotakKetik.maxLength = 24;
  kotakKetik.placeholder = "mis. F, AF, BF, ABF";
  kotakKetik.setAttribute("aria-label", "Isi 8503 - huruf alasan perceraian");
  kotakKetik.value = awal;
  const simpan = t6Tombol("Simpan ke ABT", "Menyimpan huruf alasan ke variabel 8503 di ABT, lalu menghitung ulang seluruh turunannya", "aleta-t6-8503-simpan");
  baris.appendChild(kotakKetik);
  baris.appendChild(simpan);
  kotak.appendChild(baris);
  const periksa = t6El("div", "aleta-t6-lembut aleta-t6-8503-periksa");
  kotak.appendChild(periksa);

  const segar = () => {
    const p = t6Periksa8503(kotakKetik.value);
    const ada = new Set(String(kotakKetik.value || "").toUpperCase().replace(/[^A-H]/g, "").split(""));
    for (const [h, b] of tombolHuruf) b.setAttribute("aria-pressed", ada.has(h) ? "true" : "false");
    simpan.disabled = Boolean(k.simpan8503Jalan) || !p.ok;
    periksa.textContent = kotakKetik.value.trim() && !p.ok ? p.pesan : p.ok ? `Akan disimpan sebagai "${p.isi}".` : "";
    periksa.classList.toggle("aleta-t6-gagal", Boolean(kotakKetik.value.trim() && !p.ok));
  };
  for (const [h, b] of tombolHuruf) {
    b.addEventListener("click", () => {
      const ada = new Set(String(kotakKetik.value || "").toUpperCase().replace(/[^A-H]/g, "").split("").filter(Boolean));
      if (ada.has(h)) ada.delete(h);
      else ada.add(h);
      kotakKetik.value = susun8503(Array.from(ada));
      k.ketik8503 = kotakKetik.value;
      segar();
    });
  }
  kotakKetik.addEventListener("input", () => {
    k.ketik8503 = kotakKetik.value;
    segar();
  });
  kotakKetik.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!simpan.disabled) simpan.click();
    }
  });

  // ── Usulan ALETA: yakin diisikan (tetap menunggu Simpan), ragu ditawarkan ──
  const usul = t6El("div", "aleta-t6-lembut aleta-t6-8503-usulan");
  const tombolPakai = (huruf, judul) => {
    const pakai = t6Tombol(`Pakai ${huruf}`, judul, "aleta-t6-kecil aleta-t6-8503-pakai");
    pakai.addEventListener("click", () => {
      kotakKetik.value = susun8503([...String(kotakKetik.value || "").toUpperCase().replace(/[^A-H]/g, "").split("").filter(Boolean), ...huruf.split("")]);
      k.ketik8503 = kotakKetik.value;
      segar();
    });
    return pakai;
  };
  if (asalAwal) usul.appendChild(document.createTextNode(`${asalAwal} `));
  if (usulan === undefined) {
    usul.appendChild(
      document.createTextNode("Usulan huruf dari gugatan dan keterangan saksi belum terbaca (\"Isi dari SIPP & input ke ABT\") - isi sendiri sesuai pertimbangan majelis.")
    );
  } else if (!usulan || (!usulan.yakin && !usulan.ragu)) {
    usul.appendChild(document.createTextNode("Huruf alasan tidak terdeteksi dari gugatan maupun keterangan saksi - isi sendiri sesuai pertimbangan majelis."));
  } else {
    if (usulan.yakin) {
      // Diisikan hanya bila kotaknya memang berisi usulan ini (bukan ketikan
      // petugas, bukan isi 8503 sekarang) - dan tetap menunggu Simpan.
      const terisi = !asalAwal && k.ketik8503 === undefined;
      usul.appendChild(
        document.createTextNode(
          terisi
            ? `Usulan ALETA dari gugatan dan keterangan saksi: ${usulan.yakin} - sudah diisikan di kotak, belum tersimpan. Periksa, lalu tekan Simpan ke ABT. `
            : `Usulan ALETA dari gugatan dan keterangan saksi: ${usulan.yakin}. `
        )
      );
      if (!terisi) usul.appendChild(tombolPakai(usulan.yakin, `Menambahkan huruf ${usulan.yakin} ke isian 8503 (belum menyimpan)`));
    }
    if (usulan.ragu) {
      usul.appendChild(document.createTextNode(` Usulan ragu: ${usulan.ragu} - tidak diisikan sendiri; periksa kartu Alasan perceraian lebih dulu. `));
      usul.appendChild(tombolPakai(usulan.ragu, `Menambahkan huruf ${usulan.ragu} ke isian 8503 (belum menyimpan)`));
    }
  }
  kotak.appendChild(usul);
  if (!paket) {
    kotak.appendChild(
      t6El(
        "div",
        "aleta-t6-lembut aleta-teknis",
        "Blangko satker ini belum dipasangi paket ABT abt-alasan-cdeh: hanya A, B, F, H, AB, AF, BF, dan ABF yang dikenali kuerinya."
      )
    );
  }
  kotak.appendChild(gambarKabar());

  simpan.addEventListener("click", async () => {
    const p = t6Periksa8503(kotakKetik.value);
    if (!p.ok || k.simpan8503Jalan) {
      segar();
      return;
    }
    const jati = t6JatiDiri8503(k);
    if (!jati) {
      k.kabar8503 = { teks: "Perkara ini tidak terbaca dari halaman (tombol edit ABT tidak ditemukan) - 8503 tidak disimpan.", gagal: true };
      t6SegarkanHalaman(k);
      return;
    }
    k.simpan8503Jalan = true;
    k.kabar8503 = { teks: `Menyimpan 8503 "${p.isi}" ke ABT…`, gagal: false };
    t6SegarkanHalaman(k);
    let r;
    try {
      r = await tulisHurufAlasan(p.isi.split(""), jati, { cara: "isian huruf alasan di panel (8503 satu kesatuan dengan turunannya)" });
    } catch (galat) {
      r = { gagal: true, pesan: `8503: ${sorePesan(galat)}` };
    }
    if (t6Keadaan !== k) return;
    k.simpan8503Jalan = false;
    if (r.gagal) {
      k.kabar8503 = { teks: r.pesan, gagal: true };
      t6SegarkanHalaman(k);
      return;
    }
    k.ketik8503 = undefined;
    k.kabar8503 = { teks: `8503 diisi "${r.isi8503}". Menghitung ulang variabel turunan dari ABT…`, gagal: false };
    t6SegarkanHalaman(k);
    await t6HitungUlangTurunan(k, nilaiVariabel(VAR_HURUF) || r.isi8503);
  });
  segar();
}

// ─── abt-11 / D13: bilah kemajuan ────────────────────────────────────────────

function t6PasangKemajuan(k) {
  const kotak = t6El("div", "aleta-t6-kemajuan");
  kotak.hidden = true;
  const judul = t6El("div", "aleta-t6-kemajuan-judul");
  const bilah = t6El("div", "aleta-t6-bilah");
  const isiBilah = t6El("div", "aleta-t6-bilah-isi");
  bilah.appendChild(isiBilah);
  const rinci = t6El("div", "aleta-t6-lembut aleta-t6-kemajuan-rinci");
  kotak.appendChild(judul);
  kotak.appendChild(bilah);
  kotak.appendChild(rinci);
  k.atas.appendChild(kotak);
  k.kemajuan = { kotak, judul, isiBilah, rinci };
}

function t6HitungKemajuan() {
  let siap = 0;
  let kosong = 0;
  let galat = 0;
  let tunggu = 0;
  const peta = barisVariabel();
  const hurufKosong = t6HurufKosong();
  for (const [kode, item] of peta) {
    const s = keadaanNilai(item.nilai);
    if (s === "terisi") siap += 1;
    else if (s === "galat" && hurufKosong && T6_TERGANTUNG_8503.includes(String(kode))) tunggu += 1;
    else if (s === "galat") galat += 1;
    else kosong += 1;
  }
  return { total: peta.size, siap, kosong, galat, tunggu };
}

function t6SegarkanKemajuan(k) {
  const m = k.kemajuan;
  if (!m) return;
  const h = t6HitungKemajuan();
  m.kotak.hidden = h.total === 0;
  if (!h.total) return;
  m.judul.textContent = `${h.siap} dari ${h.total} variabel siap`;
  m.isiBilah.style.width = `${Math.round((h.siap / h.total) * 100)}%`;
  m.kotak.classList.toggle("aleta-t6-ada-galat", h.galat > 0);
  const bagian = [];
  if (h.kosong) bagian.push(`${h.kosong} kosong`);
  if (h.galat) bagian.push(`${h.galat} berbunyi error`);
  if (h.tunggu) bagian.push(`${h.tunggu} menunggu 8503`);
  const yakin = k.hitungYakin;
  if (yakin) {
    if (yakin.ragu) bagian.push(`${yakin.ragu} usulan ragu`);
    if (yakin.bentrok) bagian.push(`${yakin.bentrok} usulan bentrok`);
  }
  m.rinci.textContent = bagian.length ? bagian.join(" · ") : "Semua variabel di blangko ini sudah berisi.";
  m.kotak.title = "Dihitung dari baris variabel yang tergambar di halaman blangko ini. Kosong tidak selalu salah - sebagian variabel memang tidak berlaku untuk perkara tertentu.";
}

/** Disegarkan tiap kali tabel variabel di halaman berubah (lihat t6PasangPengamat). */
function t6SegarkanHalaman(k) {
  if (!k || t6Keadaan !== k) return;
  t6SegarkanKemajuan(k);
  t6SegarkanPitaBahaya(k);
  t6SegarkanWajib(k);
  t6SegarkanCekSipp(k);
}

// ─── abt-17: variabel wajib sebelum CETAK ────────────────────────────────────

function t6PasangWajib(k) {
  const kotak = t6El("div", "aleta-t6-wajib");
  kotak.appendChild(t6El("span", "aleta-t6-lembut", "Membaca daftar variabel wajib…"));
  k.atas.appendChild(kotak);
  k.wajibKotak = kotak;
  if (!k.jenis) {
    k.wajib = { ok: false, pesan: "Jenis perkara tidak terbaca dari blangko ini - daftar variabel wajib tidak dapat dipilih.", daftar: [] };
    t6SegarkanWajib(k);
    return;
  }
  void t6AmbilJson(`${T6_API_WAJIB}?jenis=${encodeURIComponent(k.jenis)}`, "Daftar variabel wajib").then((h) => {
    if (t6Keadaan !== k) return;
    const data = h.data || {};
    const daftar = h.ok && Array.isArray(data.variabel) ? data.variabel.filter((x) => x && x.aktif !== false && x.kode) : [];
    k.wajib = { ok: h.ok, pesan: h.pesan, belumAda: h.belumAda, catatan: String(data.catatan || ""), daftar };
    t6SegarkanWajib(k);
  });
}

/** Variabel wajib yang tergambar di blangko ini dan masih kosong / berbunyi galat. */
function t6WajibKosong(k) {
  if (!k || !k.wajib || !k.wajib.ok) return [];
  const peta = barisVariabel();
  const hasil = [];
  for (const v of k.wajib.daftar) {
    const item = peta.get(String(v.kode));
    if (!item) continue;
    if (keadaanNilai(item.nilai) !== "terisi") hasil.push({ kode: String(v.kode), nama: item.nama || String(v.nama || "") });
  }
  return hasil;
}

function t6SegarkanWajib(k) {
  const kotak = k.wajibKotak;
  if (!kotak || !k.wajib) return;
  const kosong = t6WajibKosong(k);
  const sidik = `${k.wajib.ok}|${kosong.map((x) => x.kode).join(",")}`;
  if (kotak.dataset.sidik !== sidik) {
    kotak.dataset.sidik = sidik;
    kotak.textContent = "";
    kotak.classList.toggle("aleta-t6-wajib-kurang", kosong.length > 0);
    if (!k.wajib.ok) {
      kotak.appendChild(t6El("span", "aleta-t6-lembut", k.wajib.belumAda ? "Daftar variabel wajib belum tersedia di server." : k.wajib.pesan));
    } else if (!k.wajib.daftar.length) {
      // Daftar kosong BUKAN "semua terisi": jenis ini belum pernah diukur,
      // dan kalimat server yang menyebut sebabnya dipakai apa adanya.
      kotak.appendChild(t6El("span", "aleta-t6-lembut aleta-t6-info-sumber", k.wajib.catatan || `Belum ada variabel wajib untuk ${k.jenis}.`));
    } else if (!kosong.length) {
      kotak.appendChild(t6El("span", "aleta-t6-lembut", `✓ Variabel wajib untuk ${k.jenis} sudah terisi.`));
    } else {
      kotak.appendChild(t6El("span", "aleta-t6-wajib-judul", `Sebelum CETAK - ${kosong.length} variabel wajib masih kosong:`));
      const deret = t6El("span", "aleta-t6-keping-deret");
      for (const x of kosong) deret.appendChild(t6KepingKode(x.kode, t6Pendek(x.nama, 26)));
      kotak.appendChild(deret);
      kotak.appendChild(t6El("span", "aleta-t6-lembut", "Peringatan saja - CETAK dan \"Kerjakan perkara ini\" tidak ditahan."));
    }
  }
  // Peringatan yang sama di sebelah tombol CETAK ABT dan tombol Kerjakan.
  const judul = kosong.length ? `Variabel wajib masih kosong: ${kosong.map((x) => `${x.kode} ${x.nama}`).join("; ")}` : "";
  for (const tautan of Array.from(document.querySelectorAll('a[href*="abt/preview"]'))) {
    const induk = tautan.parentElement || tautan;
    let tanda = Array.from(induk.children).find((c) => c.classList.contains("aleta-t6-wajib-cetak"));
    if (!kosong.length) {
      if (tanda) tanda.remove();
      continue;
    }
    if (!tanda) {
      tanda = t6El("span", "aleta-t6-halaman aleta-t6-wajib-cetak");
      induk.insertBefore(tanda, tautan.nextSibling);
    }
    tanda.textContent = `⚠ ${kosong.length} wajib kosong`;
    tanda.title = judul;
  }
  if (k.wajibUnggah) {
    k.wajibUnggah.hidden = !kosong.length;
    k.wajibUnggah.textContent = kosong.length ? `⚠ ${kosong.length} variabel wajib masih kosong (${kosong.map((x) => x.kode).join(", ")}) - tidak ditahan.` : "";
  }
  if (k.kakiWajib) {
    k.kakiWajib.hidden = !kosong.length;
    k.kakiWajib.textContent = kosong.length ? `⚠ ${kosong.length} wajib kosong` : "";
    k.kakiWajib.title = judul;
  }
}

// ─── B1 (10 Okt 2026): pengingat SIPP vs ABT sebelum CETAK ──────────────────

/**
 * ============================================================================
 * PENGINGAT, BUKAN PENAHAN - BERBEDA DARI PENAHAN ERROR VARIABEL
 * ============================================================================
 *
 * Rencana B1 (dikerjakan 10 Okt, keputusan pengguna: PENGINGAT saja). Untuk
 * data inti - nama pihak, nomor perkara, majelis/PP/JS, tanggal putusan/
 * penetapan, kuasa, biaya - nilai yang tergambar di blangko ABT dibandingkan
 * dengan SIPP TERKINI. Kamus variabel (D1, portal) yang menunjuk variabel mana
 * mencerminkan kolom SIPP mana, dan portal menghitung nilai SIPP-nya dengan
 * definisi ABT yang sama lewat jembatan baca-saja. Isi halaman ABT TIDAK
 * dikirim ke mana pun: perbandingannya di sini.
 *
 * Beda pada variabel OTOMATIS hampir selalu berarti halaman dibuka sebelum SIPP
 * berubah - "Muat ulang variabel" membaca ulang halaman yang sama (GET, ABT
 * menghitung ulang saat menyusunnya) dan mengganti selnya di tempat. Beda pada
 * isian MANUAL yang meniru SIPP (mis. Nama Advokat Kuasa) disunting petugas di
 * ABT sendiri.
 *
 * CETAK TETAP DAPAT DITEKAN: blok ini tidak memasang pendengar klik apa pun
 * pada tautan CETAK. Penandanya di samping CETAK berkelas sendiri
 * (aleta-t6-cek-sipp-cetak, warna info), terpisah dari penahan error variabel
 * (t6SaatKlik / abt-5) yang tetap meminta "Sudah saya periksa".
 *
 *   GET /aleta/api/aleta-ecourt/abt-cek-sipp?perkaraId=&kode=   saat panel lahir,
 *                                                               "Periksa lagi",
 *                                                               sesudah muat ulang
 */
const T6_API_CEK_SIPP = "/aleta/api/aleta-ecourt/abt-cek-sipp";
const CEK_SIPP_BULAN = Object.freeze({
  januari: 1, jan: 1, februari: 2, pebruari: 2, feb: 2, peb: 2, maret: 3, mar: 3, april: 4, apr: 4,
  mei: 5, may: 5, juni: 6, jun: 6, juli: 7, jul: 7, agustus: 8, agu: 8, agt: 8, aug: 8,
  september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, oct: 10, november: 11, nov: 11, nopember: 11, nop: 11,
  desember: 12, des: 12, dec: 12,
});

function cekSippDuaAngka(n) {
  return String(n).padStart(2, "0");
}

/** Tanggal dalam bentuk apa pun yang lazim di SIPP/ABT -> "YYYY-MM-DD"; "" bila bukan tanggal. */
function cekSippTanggal(nilai) {
  const t = String(nilai == null ? "" : nilai).replace(/\s+/g, " ").trim();
  if (!t) return "";
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (m) return `${m[1]}-${cekSippDuaAngka(m[2])}-${cekSippDuaAngka(m[3])}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${cekSippDuaAngka(m[2])}-${cekSippDuaAngka(m[1])}`;
  // "Senin, 12 Oktober 2026" / "12 Okt 2026" / "Mon Oct 12 2026 00:00:00 GMT+0800"
  m = t.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})(?!\d)/) || t.toLowerCase().match(/^[a-z]{3}\s+([a-z]{3})\s+(\d{1,2})\s+(\d{4})\b/);
  if (!m) return "";
  const terbalik = /^[a-z]/.test(m[1]);
  const hari = terbalik ? m[2] : m[1];
  const bulan = CEK_SIPP_BULAN[terbalik ? m[1] : m[2]];
  if (!bulan) return "";
  const tahun = m[3];
  // Kalimat panjang yang kebetulan memuat tanggal bukan "nilai tanggal".
  if (t.length > 48) return "";
  return `${tahun}-${cekSippDuaAngka(bulan)}-${cekSippDuaAngka(hari)}`;
}

/** Nominal "Rp 1.250.000,-" / "1250000.00" -> angka; null bila bukan nominal. */
function cekSippAngka(nilai) {
  const t = String(nilai == null ? "" : nilai).replace(/\s+/g, "").replace(/,-$/, "").trim();
  if (!/^(rp\.?)?[\d.,]+$/i.test(t)) return null;
  let a = t.replace(/^rp\.?/i, "");
  if (/^\d+\.\d{1,2}$/.test(a)) return Number(a); // 1250000.00 (desimal SIPP)
  if (/,\d{1,2}$/.test(a)) a = a.replace(/,\d{1,2}$/, ""); // 1.250.000,00
  a = a.replace(/[.,]/g, "");
  return /^\d+$/.test(a) ? Number(a) : null;
}

/** Teks dibandingkan tanpa beda huruf besar, spasi, tag, dan tanda baca di ujung. */
function cekSippTeks(nilai) {
  return String(nilai == null ? "" : nilai)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[‘’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s.,;:]+$/, "")
    .toLowerCase();
}

/** Nilai ABT sama dengan nilai SIPP? Tanggal dan nominal dibandingkan menurut artinya. */
function cekSippSama(abt, sipp) {
  const a = cekSippTeks(abt);
  const s = cekSippTeks(sipp);
  if (a === s) return true;
  const ta = cekSippTanggal(abt);
  const ts = cekSippTanggal(sipp);
  if (ta && ts) return ta === ts;
  const na = cekSippAngka(abt);
  const ns = cekSippAngka(sipp);
  if (na !== null && ns !== null) return na === ns;
  return false;
}

/**
 * Membandingkan isi halaman dengan jawaban portal.
 * @param {Map<string, {nilai: string, nama: string}>} peta barisVariabel()
 * @param {Array<object>} butir jawaban abt-cek-sipp
 */
function cekSippBanding(peta, butir) {
  const beda = [];
  let sama = 0;
  let takTerbaca = 0;
  for (const b of Array.isArray(butir) ? butir : []) {
    const item = peta.get(String(b.kode));
    if (!item) continue;
    if (!b.terbaca) {
      takTerbaca += 1;
      continue;
    }
    const keadaan = keadaanNilai(item.nilai);
    // Variabel berbunyi error ditangani penahan error (abt-5) - bukan di sini.
    if (keadaan === "galat") continue;
    const manual = b.status === "manual";
    const sipp = String(b.nilaiSipp == null ? "" : b.nilaiSipp).trim();
    if (keadaan === "kosong") {
      // Isian manual kosong = "kosong = dari SIPP"; otomatis kosong tetapi SIPP
      // sudah berisi = halaman dibuka sebelum SIPP diisi.
      if (manual || !sipp) {
        sama += manual ? 0 : 1;
        continue;
      }
    } else if (cekSippSama(item.nilai, sipp)) {
      sama += 1;
      continue;
    }
    beda.push({
      kode: String(b.kode),
      nama: item.nama || String(b.nama || ""),
      label: String(b.label || b.cermin || ""),
      manual,
      acuan: String(b.acuan || ""),
      nilaiAbt: keadaan === "kosong" ? "" : item.nilai,
      nilaiSipp: sipp,
    });
  }
  return { beda, sama, takTerbaca };
}

function t6PasangCekSipp(k) {
  const kotak = t6El("div", "aleta-t6-cek-sipp");
  k.atas.appendChild(kotak);
  k.cekSippKotak = kotak;
  k.cekSipp = null;
  void t6MuatCekSipp(k);
}

async function t6MuatCekSipp(k) {
  if (!k.cekSippKotak) return;
  if (!/^\d+$/.test(String(k.perkaraId || ""))) {
    k.cekSipp = { ok: false, lembut: true, pesan: "Perkara sementara - tidak dibandingkan dengan SIPP.", butir: [] };
    t6SegarkanCekSipp(k);
    return;
  }
  k.cekSipp = { ok: false, memuat: true, pesan: "Membandingkan data inti blangko dengan SIPP…", butir: [] };
  t6SegarkanCekSipp(k);
  const kode = [...barisVariabel().keys()];
  const h = await t6AmbilJson(
    `${T6_API_CEK_SIPP}?perkaraId=${encodeURIComponent(k.perkaraId)}&kode=${encodeURIComponent(kode.join(","))}`,
    "Pemeriksa data SIPP"
  );
  if (t6Keadaan !== k) return;
  const data = h.data || {};
  k.cekSipp = h.ok
    ? { ok: true, butir: Array.isArray(data.butir) ? data.butir : [], pesan: "" }
    : { ok: false, lembut: true, pesan: h.belumAda ? "Pemeriksa data SIPP belum tersedia di server." : h.pesan, butir: [] };
  t6SegarkanCekSipp(k);
}

/** Hasil perbandingan terkini (dihitung ulang dari halaman tiap kali dipanggil). */
function t6HasilCekSipp(k) {
  if (!k || !k.cekSipp || !k.cekSipp.ok) return null;
  return cekSippBanding(barisVariabel(), k.cekSipp.butir);
}

function t6SegarkanCekSipp(k) {
  const kotak = k && k.cekSippKotak;
  if (!kotak || !k.cekSipp) return;
  const hasil = t6HasilCekSipp(k);
  const beda = hasil ? hasil.beda : [];
  const sidik = JSON.stringify([k.cekSipp.ok, k.cekSipp.memuat || false, k.cekSipp.pesan, beda, hasil && hasil.sama, k.cekSippKabar || ""]);
  if (kotak.dataset.sidik !== sidik) {
    kotak.dataset.sidik = sidik;
    kotak.textContent = "";
    kotak.classList.toggle("aleta-t6-cek-sipp-beda", beda.length > 0);
    if (!k.cekSipp.ok) {
      kotak.appendChild(t6El("span", "aleta-t6-lembut", k.cekSipp.pesan));
    } else if (!beda.length) {
      const n = hasil ? hasil.sama : 0;
      kotak.appendChild(
        t6El("span", "aleta-t6-lembut", n ? `✓ Data inti blangko sama dengan SIPP (${n} diperiksa).` : "Tidak ada data inti SIPP di blangko ini yang dapat dibandingkan.")
      );
    } else {
      kotak.appendChild(t6El("div", "aleta-t6-cek-sipp-judul", `⚠ ${beda.length} data berbeda dengan SIPP`));
      const tabel = t6El("table", "aleta-t6-cek-sipp-rinci");
      const kepala = t6El("tr");
      for (const j of ["Variabel", "Di ABT", "Di SIPP"]) kepala.appendChild(t6El("th", "", j));
      tabel.appendChild(kepala);
      for (const x of beda) {
        const tr = t6El("tr");
        tr.setAttribute("data-kode", x.kode);
        const sel = t6El("td");
        sel.appendChild(t6KepingKode(x.kode, t6Pendek(x.label || x.nama, 30)));
        if (x.manual) sel.appendChild(t6El("div", "aleta-t6-lembut", `isian manual${x.acuan ? ` - SIPP dari #${x.acuan}#` : ""}`));
        tr.appendChild(sel);
        tr.appendChild(t6El("td", "aleta-t6-cek-sipp-abt", x.nilaiAbt ? t6Pendek(x.nilaiAbt, 80) : "(kosong)"));
        tr.appendChild(t6El("td", "aleta-t6-cek-sipp-nilai", x.nilaiSipp ? t6Pendek(x.nilaiSipp, 80) : "(kosong)"));
        tabel.appendChild(tr);
      }
      kotak.appendChild(tabel);
      const aksi = t6El("div", "aleta-t6-cek-sipp-aksi");
      const muat = t6Tombol("Muat ulang variabel", "Baca ulang halaman blangko ini dari ABT (tanpa menulis apa pun) supaya variabel otomatis memakai data SIPP terkini", "aleta-t6-kecil aleta-t6-cek-sipp-muat");
      muat.addEventListener("click", () => void t6CekSippMuatUlang(k, muat));
      const lagi = t6Tombol("Periksa lagi", "Bandingkan sekali lagi dengan SIPP", "aleta-t6-kecil");
      lagi.addEventListener("click", () => void t6MuatCekSipp(k));
      aksi.appendChild(muat);
      aksi.appendChild(lagi);
      kotak.appendChild(aksi);
      const adaManual = beda.some((x) => x.manual);
      kotak.appendChild(
        t6El(
          "div",
          "aleta-t6-lembut",
          "Pengingat saja - CETAK tetap dapat ditekan." + (adaManual ? " Isian manual yang berbeda disunting di ABT." : "")
        )
      );
    }
    if (k.cekSippKabar) kotak.appendChild(t6El("div", "aleta-t6-lembut aleta-t6-cek-sipp-kabar", k.cekSippKabar));
  }
  // Penanda di samping CETAK - info, bukan penahan; tidak ada pendengar klik.
  const judul = beda.map((x) => `${x.kode} ${x.label || x.nama}: ABT "${x.nilaiAbt || "(kosong)"}" / SIPP "${x.nilaiSipp || "(kosong)"}"`).join("\n");
  for (const tautan of Array.from(document.querySelectorAll('a[href*="abt/preview"]'))) {
    const induk = tautan.parentElement || tautan;
    let tanda = Array.from(induk.children).find((c) => c.classList.contains("aleta-t6-cek-sipp-cetak"));
    if (!beda.length) {
      if (tanda) tanda.remove();
      continue;
    }
    if (!tanda) {
      tanda = t6El("span", "aleta-t6-halaman aleta-t6-cek-sipp-cetak");
      induk.insertBefore(tanda, tautan.nextSibling);
    }
    // Ditulis hanya bila berubah - pengamat tabel tidak ikut terpicu sia-sia.
    const tulisan = `ⓘ ${beda.length} beda SIPP`;
    if (tanda.textContent !== tulisan) tanda.textContent = tulisan;
    tanda.title = `Pengingat - CETAK tetap dapat ditekan.\n${judul}`;
  }
}

/**
 * Membaca ulang halaman blangko yang sama (GET - ABT menghitung data_sql dan
 * data_sipp saat menyusunnya) lalu mengganti sel variabel bercermin di
 * tempat, kemudian membandingkan lagi. Tidak menulis apa pun ke ABT.
 */
async function t6CekSippMuatUlang(k, tombol) {
  if (tombol) tombol.disabled = true;
  let teksHalaman = "";
  try {
    const r = await fetch(location.href, { credentials: "include", cache: "no-store" });
    if (!r.ok) throw new Error(`ABT menjawab ${r.status}`);
    teksHalaman = await r.text();
  } catch (e) {
    k.cekSippKabar = `Halaman blangko belum dapat dibaca ulang (${sorePesan(e)}). Muat ulang halaman dengan F5.`;
    if (tombol) tombol.disabled = false;
    t6SegarkanCekSipp(k);
    return;
  }
  let baru = new Map();
  try {
    baru = barisVariabel(new DOMParser().parseFromString(teksHalaman, "text/html"));
  } catch {
    baru = new Map();
  }
  if (t6Keadaan !== k) return;
  const kini = barisVariabel();
  const diganti = [];
  for (const b of (k.cekSipp && k.cekSipp.butir) || []) {
    const kode = String(b.kode);
    const a = kini.get(kode);
    const n = baru.get(kode);
    if (!a || !n || a.nilai === n.nilai) continue;
    if (a.selNilai.querySelector(".aleta-abt-sunting")) continue;
    t6GantiIsiSel(a.selNilai, n.selNilai);
    diganti.push(kode);
  }
  k.cekSippKabar = !baru.size
    ? "Halaman yang dibaca ulang tidak memuat tabel variabel - muat ulang halaman dengan F5."
    : diganti.length
      ? `Variabel dimuat ulang dari ABT: ${diganti.join(", ")}.`
      : "Variabel dimuat ulang dari ABT - tidak ada yang berubah di halaman.";
  await t6MuatCekSipp(k);
  if (tombol) tombol.disabled = false;
}

// ─── abt-18: komentar hakim atas BAS (tanpa acc, tidak menahan apa pun) ─────

/**
 * Keputusan pengguna 29 September 2026: TIDAK ada acc hakim. Hakim membaca
 * alur BAS di portal dan mengomentari bagian yang salah; di sini komentarnya
 * tampil di tempat yang dikomentari, dan panitera pengganti dapat
 * menandainya selesai. Tidak ada tombol yang dimatikan karena komentar.
 */
function t6PasangKomentar(k) {
  const kotak = document.createElement("details");
  kotak.className = "aleta-t6 aleta-t6-komentar";
  const ringkas = t6El("summary", "aleta-t6-komentar-judul", "Komentar hakim - membaca…");
  kotak.appendChild(ringkas);
  const daftar = t6El("div", "aleta-t6-komentar-daftar");
  kotak.appendChild(daftar);
  k.atas.appendChild(kotak);
  k.komentarKotak = { kotak, ringkas, daftar };
  if (!k.nomor) {
    k.komentar = { ok: false, pesan: "Nomor perkara tidak terbaca dari kepala halaman.", daftar: [] };
    t6GambarKomentar(k);
    return;
  }
  void t6AmbilJson(`${T6_API_KOMENTAR}?nomor=${encodeURIComponent(k.nomor)}`, "Komentar hakim").then((h) => {
    if (t6Keadaan !== k) return;
    const data = h.data || {};
    k.komentar = {
      ok: h.ok,
      pesan: h.pesan,
      belumAda: h.belumAda,
      daftar: h.ok && Array.isArray(data.komentar) ? data.komentar : [],
      saya: data.saya && typeof data.saya === "object" ? data.saya : null,
    };
    t6GambarKomentar(k);
    t6HiasSemua(k);
    t6HiasHuruf(k);
  });
}

/**
 * "saksi-p1:3", "saksi-T2:5", "saksi-1:3" -> { pihak, ke, no }.
 *
 * Tanpa huruf pihak (portal tidak tahu letak saksi itu), aturannya sama dengan
 * letakSaksiAbt di portal: ke-1 dan ke-2 = saksi Penggugat, ke-3 dst. TIDAK
 * ditebak (pihak null) - di data Donggala urutan ketiga ABT 37 kali saksi
 * Tergugat, jadi menebak menempelkan komentar ke kolom yang salah.
 */
function t6BacaBagian(bagian) {
  const s = String(bagian || "").replace(/\s+/g, "").toLowerCase();
  let m = /^saksi-([pt])?(\d+):(\d+)$/.exec(s);
  if (m) {
    const ke = Number(m[2]);
    const pihak = m[1] ? m[1].toUpperCase() : ke <= 2 ? "P" : null;
    return { jenis: "saksi", pihak, ke, no: Number(m[3]) };
  }
  m = /^alasan:([a-z])$/.exec(s);
  if (m) return { jenis: "alasan", huruf: m[1].toUpperCase() };
  return { jenis: "umum" };
}

function t6LabelBagian(bagian) {
  const b = t6BacaBagian(bagian);
  if (b.jenis === "saksi") return b.pihak ? `Saksi ${b.ke} ${b.pihak}, pertanyaan ${b.no}` : `Saksi ke-${b.ke} (ABT), pertanyaan ${b.no}`;
  if (b.jenis === "alasan") return `Alasan huruf ${b.huruf}`;
  return "Umum";
}

function t6GambarKomentar(k) {
  const w = k.komentarKotak;
  if (!w) return;
  const kom = k.komentar || { ok: false, daftar: [] };
  w.daftar.textContent = "";
  if (!kom.ok) {
    w.ringkas.textContent = kom.belumAda ? "Komentar hakim - belum tersedia di server" : "Komentar hakim - tidak terbaca";
    w.daftar.appendChild(t6El("div", "aleta-t6-lembut", kom.belumAda ? "Server ini belum mengenal komentar hakim atas BAS." : kom.pesan));
    return;
  }
  const belum = kom.daftar.filter((x) => !x.selesai);
  w.ringkas.textContent = kom.daftar.length
    ? `Komentar hakim · ${belum.length} belum selesai dari ${kom.daftar.length}`
    : "Komentar hakim · belum ada";
  w.kotak.classList.toggle("aleta-t6-ada-komentar", belum.length > 0);
  if (!kom.daftar.length) {
    w.daftar.appendChild(t6El("div", "aleta-t6-lembut", "Hakim belum mengomentari BAS perkara ini. Komentar tidak pernah menahan pekerjaan."));
    return;
  }
  for (const x of kom.daftar) w.daftar.appendChild(t6KartuKomentar(k, x));
}

function t6KartuKomentar(k, x) {
  const kartu = t6El("div", `aleta-t6-komentar-kartu${x.selesai ? " aleta-t6-selesai" : ""}`);
  const kepala = t6El("div", "aleta-t6-komentar-kepala");
  kepala.appendChild(t6El("span", "aleta-t6-lencana aleta-t6-lencana-hakim", "komentar hakim"));
  kepala.appendChild(t6El("span", "aleta-t6-komentar-bagian", t6LabelBagian(x.bagian)));
  if (x.sidangKe) kepala.appendChild(t6El("span", "aleta-t6-lembut", `sidang ke-${x.sidangKe}`));
  kartu.appendChild(kepala);
  if (x.kutipan) kartu.appendChild(t6El("div", "aleta-t6-komentar-kutipan", `“${t6Pendek(x.kutipan, 300)}”`));
  kartu.appendChild(t6El("div", "aleta-t6-komentar-isi", String(x.isi || "")));
  const kaki = t6El("div", "aleta-t6-komentar-kaki");
  const penulis = x.penulis && x.penulis.nama ? x.penulis.nama : "hakim";
  kaki.appendChild(t6El("span", "aleta-t6-lembut", `${penulis}${x.dibuatPada ? ` · ${t6Jam(x.dibuatPada)}` : ""}`));
  if (x.selesai) {
    const oleh = x.diselesaikanOleh && x.diselesaikanOleh.nama ? ` oleh ${x.diselesaikanOleh.nama}` : "";
    kaki.appendChild(t6El("span", "aleta-t6-lencana aleta-t6-lencana-aman", `✓ selesai${oleh}`));
  }
  // Yang boleh menandai: panitera pengganti, admin, dan penulisnya (kontrak
  // Tahap 6-7). Server tetap memeriksa ulang; ini hanya supaya tombol yang
  // pasti ditolak tidak ditawarkan. Server lama tanpa "saya": tombolnya ada.
  const saya = k.komentar && k.komentar.saya;
  const boleh = !saya || saya.bolehMenyelesaikanSemua === true || (x.penulis && String(x.penulis.id) === String(saya.id));
  if (!boleh) {
    kaki.appendChild(t6El("span", "aleta-t6-lembut", x.selesai ? "" : "ditandai selesai oleh panitera pengganti"));
    kartu.appendChild(kaki);
    return kartu;
  }
  const tombol = t6Tombol(x.selesai ? "Buka lagi" : "Tandai selesai", x.selesai ? "Kembalikan komentar ini menjadi belum selesai" : "Tandai komentar ini sudah dikerjakan", "aleta-t6-kecil");
  const kabar = t6El("span", "aleta-t6-lembut");
  tombol.addEventListener("click", async () => {
    tombol.disabled = true;
    kabar.textContent = "Mengirim…";
    const h = await t6AmbilJson(T6_API_KOMENTAR, "Menandai komentar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: x.id, selesai: !x.selesai }),
    });
    tombol.disabled = false;
    if (!h.ok) {
      kabar.className = "aleta-t6 aleta-t6-gagal";
      kabar.textContent =
        h.status === 403 ? "Hanya panitera pengganti, admin, atau penulisnya yang dapat menandai komentar ini." : h.pesan;
      return;
    }
    const baru = h.data && h.data.komentar ? h.data.komentar : { ...x, selesai: !x.selesai };
    if (k.komentar && Array.isArray(k.komentar.daftar)) {
      k.komentar.daftar = k.komentar.daftar.map((y) => (y.id === x.id ? baru : y));
    }
    t6GambarKomentar(k);
    t6HiasSemua(k);
    t6HiasHuruf(k);
  });
  kaki.appendChild(tombol);
  kaki.appendChild(kabar);
  kartu.appendChild(kaki);
  return kartu;
}

// ─── abt-21 / abt-22: cari variabel dan variabel disematkan ──────────────────

function t6PasangCari(k) {
  const kotak = t6El("div", "aleta-t6-cari");
  if (t6Nyala("abt-21")) {
    const masuk = document.createElement("input");
    masuk.type = "search";
    masuk.className = "aleta-t6 aleta-t6-cari-masuk";
    masuk.placeholder = "Cari variabel… #0222 atau \"awal konflik\"";
    masuk.setAttribute("aria-label", "Cari variabel di blangko ini");
    const hasil = t6El("div", "aleta-t6-cari-hasil");
    masuk.addEventListener("input", () => t6GambarCari(k, masuk.value, hasil));
    masuk.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        masuk.value = "";
        t6GambarCari(k, "", hasil);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const pertama = t6CocokVariabel(masuk.value)[0];
        if (pertama) t6Lompat(pertama.kode);
      }
    });
    kotak.appendChild(masuk);
    kotak.appendChild(hasil);
    k.cariHasil = hasil;
    k.cariMasuk = masuk;
  }
  if (t6Nyala("abt-22")) {
    k.sematanKotak = t6El("div", "aleta-t6-sematan");
    kotak.appendChild(k.sematanKotak);
    t6GambarSematan(k);
  }
  k.atas.appendChild(kotak);
}

function t6CocokVariabel(kata) {
  const q = t6Baku(kata).replace(/^#/, "");
  if (!q) return [];
  const hasil = [];
  for (const [kode, item] of barisVariabel()) {
    if (kode.startsWith(q) || item.nama.toLowerCase().includes(q)) hasil.push(item);
    if (hasil.length >= 8) break;
  }
  return hasil;
}

function t6GambarCari(k, kata, wadah) {
  wadah.textContent = "";
  const cocok = t6CocokVariabel(kata);
  if (!kata.trim()) return;
  if (!cocok.length) {
    wadah.appendChild(t6El("div", "aleta-t6-lembut", "Tidak ada variabel yang cocok di blangko ini."));
    return;
  }
  for (const item of cocok) {
    const baris = t6El("div", "aleta-t6-cari-baris");
    const lompat = t6Tombol("", `Lompat ke baris ${item.kode}`, "aleta-t6-cari-lompat");
    lompat.appendChild(t6El("span", "aleta-t6-kode", item.kode));
    lompat.appendChild(t6El("span", "aleta-t6-cari-nama", item.nama));
    lompat.appendChild(t6El("span", "aleta-t6-lembut", t6Pendek(item.nilai, 60)));
    lompat.addEventListener("click", () => t6Lompat(item.kode));
    baris.appendChild(lompat);
    if (t6Nyala("abt-22")) baris.appendChild(t6TombolSemat(k, item.kode));
    if (t6Nyala("abt-9")) baris.appendChild(t6TombolRiwayatVar(k, item.kode, baris));
    wadah.appendChild(baris);
  }
}

function t6TombolSemat(k, kode) {
  const b = t6Tombol("", "", "aleta-t6-bintang");
  b.setAttribute("data-t6-kode", kode);
  const segar = () => {
    const ada = k.sematan.includes(kode);
    b.textContent = ada ? "★" : "☆";
    b.title = ada ? `Lepas sematan ${kode}` : `Sematkan ${kode} - tampil di atas panel, di peramban ini saja`;
    b.setAttribute("aria-pressed", ada ? "true" : "false");
  };
  b.addEventListener("click", () => {
    const ada = k.sematan.includes(kode);
    k.sematan = ada ? k.sematan.filter((x) => x !== kode) : [...k.sematan, kode].slice(-20);
    t6Tulis({ [T6_KUNCI_SEMATAN]: k.sematan });
    t6GambarSematan(k);
    for (const lain of Array.from(document.querySelectorAll(`.aleta-t6-bintang[data-t6-kode="${kode}"]`))) {
      if (typeof lain.aletaSegar === "function") lain.aletaSegar();
    }
  });
  b.aletaSegar = segar;
  segar();
  return b;
}

function t6GambarSematan(k) {
  const w = k.sematanKotak;
  if (!w) return;
  w.textContent = "";
  if (!k.sematan.length) {
    w.appendChild(t6El("span", "aleta-t6-lembut", "Belum ada variabel disematkan - tekan ☆ di hasil cari atau di kartu usulan."));
    return;
  }
  w.appendChild(t6El("span", "aleta-t6-lembut", "Disematkan:"));
  const peta = barisVariabel();
  for (const kode of k.sematan) {
    const item = peta.get(kode);
    const b = t6KepingKode(kode, item ? t6Pendek(item.nama, 24) : "");
    b.textContent = `★ ${b.textContent}`;
    if (!item) {
      b.disabled = true;
      b.title = `${kode} tidak ada di blangko ini`;
    }
    w.appendChild(b);
  }
}

// ─── abt-29: draf keterangan saksi yang tersimpan sendiri ────────────────────

function t6KunciDraf(k) {
  return k.nomor || k.perkaraId || "";
}

function t6PasangDrafLama(k) {
  const entri = k.draf[t6KunciDraf(k)];
  if (!entri || !Array.isArray(entri.kolom) || !entri.kolom.length) return;
  const kotak = t6El("div", "aleta-t6-draf-lama");
  const jumlah = entri.kolom.map((c) => (Array.isArray(c.baris) ? c.baris.length : 0));
  kotak.appendChild(
    t6El(
      "div",
      "",
      `Ada draf keterangan saksi tersimpan ${t6Jam(entri.pada)} (${entri.kolom.length} saksi, ${jumlah.join(" + ")} keterangan). ` +
        "Buka penyunting (langkah 2 lalu \"Susun keterangan para saksi\"), kemudian tekan \"Pulihkan draf\" di atas kolom saksi."
    )
  );
  const lihat = document.createElement("details");
  lihat.className = "aleta-t6";
  lihat.appendChild(t6El("summary", "", "Lihat isi draf"));
  lihat.appendChild(t6El("pre", "aleta-t6-pra", t6TeksDraf(entri)));
  kotak.appendChild(lihat);
  const buang = t6Tombol("Buang draf", "Hapus draf perkara ini dari peramban ini", "aleta-t6-kecil");
  buang.addEventListener("click", () => {
    delete k.draf[t6KunciDraf(k)];
    t6Tulis({ [T6_KUNCI_DRAF]: k.draf });
    kotak.remove();
  });
  kotak.appendChild(buang);
  k.atas.appendChild(kotak);
  k.drafLamaKotak = kotak;
}

function t6TeksDraf(entri) {
  return (entri.kolom || [])
    .map((c) => `${c.judul || "Saksi"}\n${(c.baris || []).map((b, i) => `${i + 1}. ${b.tanya}\n   ${b.jawab}`).join("\n")}`)
    .join("\n\n");
}

/** Isi penyunting keterangan saksi yang sedang terbuka, apa adanya. */
function t6BacaPenyunting(hasil) {
  return Array.from(hasil.querySelectorAll(".aleta-sdg-dua > .aleta-sdg-kolom")).map((kolom) => {
    const judul = kolom.querySelector(".aleta-sdg-judul");
    const teksJudul = judul ? String(judul.firstChild && judul.firstChild.nodeType === 3 ? judul.firstChild.textContent : judul.textContent).trim() : "";
    return {
      judul: teksJudul,
      baris: Array.from(kolom.querySelectorAll(".aleta-sdg-baris")).map((b) => ({
        tanya: String((b.querySelector(".aleta-sdg-tanya") || {}).textContent || "").trim(),
        jawab: String((b.querySelector("textarea.aleta-sdg-jawab") || {}).value || ""),
      })),
    };
  });
}

function t6SimpanDraf(k) {
  if (t6Keadaan !== k) return;
  const hasil = k.wadah.usulan && k.wadah.usulan.querySelector(".aleta-sdg-hasil");
  if (!hasil) return;
  const kolom = t6BacaPenyunting(hasil);
  if (!kolom.length) return;
  const sidik = JSON.stringify(kolom);
  if (sidik === k.drafSidik) return;
  k.drafSidik = sidik;
  const pada = new Date().toISOString();
  k.draf[t6KunciDraf(k)] = { pada, kolom };
  // Yang tertua dibuang lebih dulu - peramban ini bukan arsip.
  const urut = Object.entries(k.draf).sort((a, b) => String(b[1] && b[1].pada).localeCompare(String(a[1] && a[1].pada)));
  k.draf = Object.fromEntries(urut.slice(0, T6_BATAS_DRAF));
  t6Tulis({ [T6_KUNCI_DRAF]: k.draf });
  k.drafPada = pada;
  for (const s of Array.from(k.panel.querySelectorAll(".aleta-t6-draf-status"))) {
    s.textContent = `● tersimpan otomatis ${t6Jam(pada, true)} · tiap 30 detik`;
  }
}

/** Mengisikan draf ke penyunting yang terbuka - lewat peristiwa input, sama dengan mengetik. */
function t6PulihkanDraf(k, hasil) {
  const entri = k.draf[t6KunciDraf(k)];
  if (!entri) return "Tidak ada draf untuk perkara ini.";
  const kolom = Array.from(hasil.querySelectorAll(".aleta-sdg-dua > .aleta-sdg-kolom"));
  let terisi = 0;
  let lebih = 0;
  entri.kolom.forEach((c, i) => {
    const sasaran = kolom[i];
    const baris = sasaran ? Array.from(sasaran.querySelectorAll(".aleta-sdg-baris")) : [];
    (c.baris || []).forEach((b, j) => {
      const el = baris[j];
      if (!el) {
        lebih += 1;
        return;
      }
      const tanya = el.querySelector(".aleta-sdg-tanya");
      const jawab = el.querySelector("textarea.aleta-sdg-jawab");
      if (tanya && b.tanya) {
        tanya.textContent = b.tanya;
        tanya.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (jawab) {
        jawab.value = String(b.jawab || "");
        jawab.dispatchEvent(new Event("input", { bubbles: true }));
      }
      terisi += 1;
    });
  });
  return (
    `${terisi} keterangan dipulihkan dari draf ${t6Jam(entri.pada)}.` +
    (lebih ? ` ${lebih} keterangan draf tidak punya baris di penyunting - tambahkan dengan "+ Tambah keterangan".` : "") +
    " Belum ada yang disimpan ke ABT."
  );
}

// ─── abt-25: mode baca untuk hakim ───────────────────────────────────────────

function t6PasangPitaBaca(k) {
  k.pitaBaca = t6El("div", "aleta-t6-pita-baca", "Mode baca - tombol disembunyikan, klik isi blangko tidak membuka penyunting. Tekan ▤ di kepala panel untuk keluar.");
  k.pitaBaca.hidden = true;
  k.atas.appendChild(k.pitaBaca);
}

function t6TerapkanBaca(k) {
  const nyala = t6Nyala("abt-25") && k.baca;
  if (nyala) k.panel.setAttribute("data-t6-baca", "ya");
  else k.panel.removeAttribute("data-t6-baca");
  if (k.pitaBaca) k.pitaBaca.hidden = !nyala;
  if (k.tombolBaca) {
    k.tombolBaca.setAttribute("aria-pressed", nyala ? "true" : "false");
    k.tombolBaca.title = nyala ? "Keluar dari mode baca" : "Mode baca - panel tanpa tombol, hanya isi dan tandanya (untuk hakim)";
  }
}

// ─── abt-4 / D7: segmen keyakinan berangka ───────────────────────────────────

function t6PasangSegmen(k) {
  const seg = t6El("div", "aleta-t6-segmen");
  seg.setAttribute("role", "toolbar");
  seg.setAttribute("aria-label", "Saring usulan menurut keyakinan");
  seg.hidden = true;
  k.segmenTombol = new Map();
  for (const [kunci, label, arti] of T6_YAKIN) {
    const b = t6Tombol(label, arti, "aleta-t6-segmen-tombol");
    b.setAttribute("data-t6-yakin", kunci);
    b.setAttribute("aria-pressed", kunci === "semua" ? "true" : "false");
    b.appendChild(t6El("span", "aleta-t6-segmen-angka", "0"));
    b.addEventListener("click", () => {
      k.saring = kunci;
      t6TerapkanSaring(k);
    });
    seg.appendChild(b);
    k.segmenTombol.set(kunci, b);
  }
  const takBerlaku = t6Tombol("", "", "aleta-t6-segmen-takberlaku");
  takBerlaku.hidden = true;
  takBerlaku.addEventListener("click", () => {
    k.tampilTakBerlaku = !k.tampilTakBerlaku;
    t6TerapkanSaring(k);
  });
  seg.appendChild(takBerlaku);
  k.segmenTakBerlaku = takBerlaku;
  const catatan = t6El("div", "aleta-t6-lembut aleta-t6-segmen-catatan");
  catatan.hidden = true;
  seg.appendChild(catatan);
  k.segmenCatatan = catatan;
  if (k.petunjuk) {
    k.panel.setAttribute("data-t6-segmen", "ya");
    k.isi.insertBefore(seg, k.petunjuk.nextSibling);
  } else {
    k.atas.appendChild(seg);
  }
  k.segmen = seg;
}

/** Keyakinan satu kartu usulan, dibaca dari lencananya (tulisan kartuUsulan). */
function t6YakinKartu(kartu) {
  const lencana = kartu.querySelector(".aleta-abt-kartu-kepala .aleta-tanda");
  const teks = t6Baku(lencana && lencana.textContent);
  if (teks === "kedua saksi sama") return "pasti";
  if (teks === "satu saksi" || teks === "dari posita") return "cukup";
  if (teks === "saksi berselisih") return "bentrok";
  if (teks.startsWith("ragu")) return "ragu";
  return "kosong";
}

/** Wadah kartu usulan: keterangan saksi, dan "Dari SIPP" bila langkah gabung memindahkannya. */
function t6WadahUsulan(k) {
  return [k.usulanSipp, k.wadah.usulan].filter((w) => w && w.isConnected);
}

function t6KartuUsulan(k) {
  const hasil = [];
  for (const w of t6WadahUsulan(k)) hasil.push(...Array.from(w.children).filter((c) => c.classList.contains("aleta-abt-kartu")));
  return hasil;
}

function t6TerapkanSaring(k) {
  const w = k.wadah.usulan;
  if (!w) return;
  if (k.usulanSipp && k.usulanSipp.isConnected) {
    const s = k.usulanSipp;
    if (k.saring !== "semua") s.setAttribute("data-t6-saring", k.saring);
    else s.removeAttribute("data-t6-saring");
    if (k.tampilTakBerlaku) s.setAttribute("data-t6-tampil-takberlaku", "ya");
    else s.removeAttribute("data-t6-tampil-takberlaku");
  }
  const kartu = t6KartuUsulan(k);
  const hitung = { semua: kartu.length, ragu: 0, bentrok: 0, cukup: 0, pasti: 0 };
  let takBerlaku = 0;
  let tercentangTersembunyi = 0;
  for (const el of kartu) {
    const y = el.getAttribute("data-t6-yakin") || "kosong";
    if (y in hitung && y !== "semua") hitung[y] += 1;
    if (el.getAttribute("data-t6-tak-berlaku") === "ya") takBerlaku += 1;
  }
  k.hitungYakin = hitung;
  if (k.saring !== "semua") w.setAttribute("data-t6-saring", k.saring);
  else w.removeAttribute("data-t6-saring");
  if (k.tampilTakBerlaku) w.setAttribute("data-t6-tampil-takberlaku", "ya");
  else w.removeAttribute("data-t6-tampil-takberlaku");
  for (const el of kartu) {
    const tampak =
      (k.saring === "semua" || el.getAttribute("data-t6-yakin") === k.saring) &&
      (k.tampilTakBerlaku || el.getAttribute("data-t6-tak-berlaku") !== "ya");
    const c = el.querySelector(".aleta-abt-kartu-kepala input.aleta-abt-centang");
    if (!tampak && c && c.checked) tercentangTersembunyi += 1;
  }
  if (k.segmen) {
    k.segmen.hidden = kartu.length === 0;
    for (const [kunci, b] of k.segmenTombol) {
      const angka = b.querySelector(".aleta-t6-segmen-angka");
      if (angka) angka.textContent = String(hitung[kunci] || 0);
      b.setAttribute("aria-pressed", kunci === k.saring ? "true" : "false");
    }
    k.segmenTakBerlaku.hidden = takBerlaku === 0;
    k.segmenTakBerlaku.textContent = k.tampilTakBerlaku ? `Sembunyikan yang tidak berlaku (${takBerlaku})` : `Tampilkan yang tidak berlaku (${takBerlaku})`;
    k.segmenTakBerlaku.setAttribute("aria-pressed", k.tampilTakBerlaku ? "true" : "false");
    // Saringan hanya menyembunyikan tampilan. Yang tercentang tetapi
    // tersembunyi TETAP ikut diterapkan - dan itu harus terbaca, bukan
    // ditemukan sesudah tersimpan.
    k.segmenCatatan.hidden = tercentangTersembunyi === 0;
    k.segmenCatatan.textContent = tercentangTersembunyi
      ? `${tercentangTersembunyi} usulan tercentang sedang tersembunyi saringan - "Terapkan yang dicentang" tetap menerapkannya.`
      : "";
  }
  t6SegarkanKemajuan(k);
}

// ─── abt-10 / D2: langkah bernomor (perbaikan 30 Sep: butir 2, 3, 4) ───────

/**
 * Langkahnya MEWAKILI tombol lama, bukan menggantikannya: tiap langkah
 * menekan tombol lama yang sama, jadi seluruh perilakunya - pesan, penjagaan
 * kewenangan, pintasan Alt+Enter - tetap satu jalur. Tombol lama yang
 * diwakili disembunyikan lewat CSS dan tetap ada di DOM; ⋯ di ujung deret
 * memunculkannya kembali (butir 4: "tombol lama tetap ada").
 *
 * Butir 3: langkah yang sudah bercentang hijau - dan yang belum waktunya -
 * disembunyikan; yang tampak hanya langkah yang sedang dikerjakan. "lihat
 * semua langkah" memperlihatkan seluruhnya, termasuk yang sudah selesai.
 *
 * Langkah "gabung" berkelas aleta-permintaan-tombol dan duduk paling awal di
 * baris tindakan: Alt+P menekan tombol TAMPAK pertama di sana, dan dengan
 * begitu Alt+P tetap berarti "isi blangko dari SIPP".
 */
function t6PasangLangkah(k) {
  const baris = t6El("div", "aleta-t6-langkah");
  baris.setAttribute("role", "list");
  k.langkahTombol = new Map();
  for (const l of T6_LANGKAH) {
    const b = t6Tombol("", "", `aleta-t6-langkah-tombol${l.kunci === "gabung" ? " aleta-permintaan-tombol" : ""}`);
    b.setAttribute("role", "listitem");
    b.setAttribute("data-t6-langkah", l.kunci);
    b.style.order = String(l.urut);
    b.appendChild(t6El("span", "aleta-t6-langkah-no", ""));
    b.appendChild(t6El("span", "aleta-t6-langkah-nama", l.nama));
    b.appendChild(t6El("span", "aleta-t6-langkah-tanda", ""));
    b.addEventListener("click", () => void t6JalankanLangkah(k, l));
    baris.appendChild(b);
    k.langkahTombol.set(l.kunci, b);
  }
  const habis = t6El("span", "aleta-t6-lembut aleta-t6-langkah-habis", "✓ Semua langkah selesai.");
  habis.style.order = "7";
  const semua = t6Tombol("", "", "aleta-t6-kecil aleta-t6-langkah-semua");
  semua.style.order = "8";
  semua.addEventListener("click", () => {
    k.langkahSemua = !k.langkahSemua;
    t6SegarkanLangkah(k);
  });
  const lama = t6Tombol("⋯", "", "aleta-t6-kecil aleta-t6-langkah-lama");
  lama.style.order = "9";
  lama.setAttribute("aria-pressed", "false");
  lama.addEventListener("click", () => {
    const buka = !k.panel.hasAttribute("data-t6-tombol-lama");
    if (buka) k.panel.setAttribute("data-t6-tombol-lama", "ya");
    else k.panel.removeAttribute("data-t6-tombol-lama");
    lama.setAttribute("aria-pressed", buka ? "true" : "false");
    lama.title = t6JudulTombolLama(buka);
  });
  lama.title = t6JudulTombolLama(false);
  baris.appendChild(habis);
  baris.appendChild(semua);
  baris.appendChild(lama);
  k.langkahHabis = habis;
  k.langkahSemuaTombol = semua;
  k.aksi.insertBefore(baris, k.aksi.firstChild);
  for (const kunci of ["sipp", "saksi", "rapikan", "sdg"]) {
    const t = k.tombol[kunci];
    if (t) t.classList.add("aleta-t6-diwakili");
  }
  k.panel.setAttribute("data-t6-langkah", "ya");
  // Keterangan saksi 1 yang sudah terisi di blangko = "Susun saksi" sudah
  // dikerjakan (di sidang itu, atau oleh petugas lain). Ia tetap dapat
  // dijalankan lagi lewat "lihat semua langkah".
  if (!k.langkah.has("sdg") && keadaanNilai(a3NilaiSaksi1()) === "terisi") {
    k.langkah.set("sdg", "selesai");
    k.langkahSebab.set("sdg", "keterangan saksi 1 sudah terisi di blangko");
  }
  t6SegarkanLangkah(k);
}

/**
 * hidden ditulis HANYA bila berubah. Deret langkah hidup di dalam
 * .aleta-abt-aksi, yang diamati atribut hidden-nya (t6PasangPengamat) - dan
 * menulis nilai yang sama pun melahirkan catatan perubahan. Tanpa penjaga
 * ini penyegar langkah memicu dirinya sendiri tanpa akhir.
 */
function t6Tampak(el, tampak) {
  if (el && el.hidden !== !tampak) el.hidden = !tampak;
}

function t6JudulTombolLama(buka) {
  return buka
    ? "Sembunyikan lagi tombol satu per satu"
    : "Tombol satu per satu: Isi blangko dari SIPP, Input ke ABT, Rapikan posita & keterangan saksi, Susun keterangan saksi";
}

/** Tombol lama yang TAMPAK (tidak hidden) - yang hidden milik blangko/peran lain. */
function t6TombolTampak(t) {
  return Boolean(t) && !t.hidden;
}

/** Langkah ini dapat dijalankan di blangko ini, oleh peran ini. */
function t6LangkahAda(k, l) {
  if (l.kunci === "gabung") return t6TombolTampak(k.tombol.sipp) || t6TombolTampak(k.tombol.saksi);
  if (l.kunci === "sdg") return t6BolehSdg(k) && t6TombolTampak(k.tombol.sdg);
  const t = k.unggah ? k.unggah.querySelector("button.aleta-abt-tombol") : null;
  return t6TombolTampak(t);
}

function t6SegarkanLangkah(k) {
  if (!k.langkahTombol) return;
  let nomor = 0;
  let sekarang = null;
  let tersembunyi = 0;
  const urut = [...T6_LANGKAH].sort((a, b) => a.urut - b.urut);
  for (const l of urut) {
    const b = k.langkahTombol.get(l.kunci);
    const ada = t6LangkahAda(k, l);
    const keadaan = k.langkah.get(l.kunci) || "";
    // Susun saksi bagi hakim/juru sita: tidak ada sama sekali, bahkan di
    // "lihat semua langkah" (butir 2). Langkah lain yang tidak tersedia di
    // blangko ini tetap tergambar mati, dengan sebabnya di judulnya.
    t6Tampak(b, !(l.kunci === "sdg" && !t6BolehSdg(k)));
    if (b.hidden) continue;
    if (ada) nomor += 1;
    b.querySelector(".aleta-t6-langkah-no").textContent = ada ? String(nomor) : "–";
    b.disabled = !ada;
    b.classList.toggle("aleta-t6-selesai", keadaan === "selesai");
    b.classList.toggle("aleta-t6-gagal-langkah", keadaan === "gagal");
    b.classList.toggle("aleta-t6-jalan", keadaan === "jalan");
    const kini = ada && keadaan !== "selesai" && !sekarang;
    if (kini) sekarang = l;
    else tersembunyi += 1;
    b.classList.toggle("aleta-t6-sekarang", kini);
    const tanda = b.querySelector(".aleta-t6-langkah-tanda");
    tanda.textContent = keadaan === "selesai" ? "✓" : keadaan === "gagal" ? "✕" : keadaan === "jalan" ? "…" : kini ? "●" : "";
    const sebab = k.langkahSebab.get(l.kunci);
    b.title = !ada
      ? `${l.nama}: tidak tersedia di blangko ini (atau peran Anda tidak diberi aksesnya).`
      : `${l.nama}${t6JudulLangkah(k, l)}${keadaan === "selesai" ? ` (sudah dijalankan${sebab ? ` - ${sebab}` : ""})` : keadaan === "gagal" ? " (terakhir gagal - lihat pesan)" : ""}`;
  }
  if (k.langkahSemua) k.panel.setAttribute("data-t6-langkah-semua", "ya");
  else k.panel.removeAttribute("data-t6-langkah-semua");
  t6Tampak(k.langkahHabis, !sekarang && !k.langkahSemua);
  t6Tampak(k.langkahSemuaTombol, k.langkahSemua || tersembunyi > 0);
  k.langkahSemuaTombol.textContent = k.langkahSemua ? "sembunyikan yang selesai" : `lihat semua langkah (${tersembunyi})`;
  k.langkahSemuaTombol.title = k.langkahSemua
    ? "Tampilkan hanya langkah yang sedang dikerjakan"
    : "Tampilkan juga langkah yang sudah selesai dan yang berikutnya";
  k.langkahSemuaTombol.setAttribute("aria-pressed", k.langkahSemua ? "true" : "false");
}

function t6JudulLangkah(k, l) {
  if (l.kunci === "gabung") {
    return " - Rapikan (pratinjau, tidak menyimpan apa pun), isi blangko dari SIPP, lalu usulan dari keterangan saksi. Tiap usulan tetap dicentang dan diterapkan sendiri.";
  }
  if (l.kunci === "kerjakan") return " - membawa ke bagian Kerjakan: draf, anonim, unggah";
  const t = l.tombol ? k.tombol[l.tombol] : null;
  return t && t.title ? ` - ${t.title}` : "";
}

/** Menekan tombol lama dan menunggu ia hidup lagi. Pulang true bila berhasil. */
async function t6TekanDanTunggu(k, t) {
  t.click();
  await new Promise((r) => setTimeout(r, 50));
  await t6Tunggu(() => !t.disabled, 120000);
  await new Promise((r) => setTimeout(r, 80));
  return !(k.kabar && k.kabar.classList.contains("aleta-abt-gagal") && k.kabar.textContent.trim());
}

async function t6JalankanLangkah(k, l) {
  const b = k.langkahTombol.get(l.kunci);
  if (!b || b.disabled || b.hidden || k.langkah.get(l.kunci) === "jalan") return;
  if (l.kunci === "kerjakan") {
    // Membawa ke bagian Kerjakan, tidak menekannya: pilihannya (draf,
    // anonim, unggah) harus terbaca sebelum tombol yang menulis ke SIPP
    // ditekan.
    // Tanpa bagian Unggah (blangko BAS/relaas, 1.182.0) langkah ini tidak punya tujuan.
    if (!k.unggah) return;
    const t = k.unggah.querySelector("button.aleta-abt-tombol");
    try {
      k.unggah.scrollIntoView({ block: "nearest" });
    } catch {
      /* tanpa gulir */
    }
    t.focus();
    k.langkah.set("kerjakan", "selesai");
    t6SegarkanLangkah(k);
    return;
  }
  if (l.kunci === "sdg") {
    const t = k.tombol.sdg;
    k.langkah.set("sdg", "jalan");
    t6SegarkanLangkah(k);
    const ok = await t6TekanDanTunggu(k, t);
    if (t6Keadaan !== k) return;
    // Borangnya terbuka - langkah ini baru SELESAI saat keterangannya
    // tersimpan ke ABT (lihat t6AmatiSimpanSdg).
    k.langkah.set("sdg", ok ? "" : "gagal");
    k.langkahSebab.delete("sdg");
    t6SegarkanLangkah(k);
    return;
  }
  await t6JalankanGabung(k);
}

/**
 * Butir 4: "Isi dari SIPP" + "Input ke ABT" dalam satu langkah, dengan
 * Rapikan lebih dulu.
 *
 * Rapikan di sini PRATINJAU - sama dengan menekan tombolnya: yang akan
 * diubah digambar dengan tombol "Terapkan"-nya sendiri, dan tidak satu pun
 * tersimpan tanpa ditekan. Posita yang tersimpan di SIPP tidak ditimpa tanpa
 * dibaca.
 *
 * Kedua tombol lama menggambar usulannya ke wadah yang SAMA, dan yang kedua
 * mengosongkan hasil yang pertama. Usulan dari SIPP karena itu dipindah ke
 * wadahnya sendiri sebelum keterangan saksi dibaca - kartu, centang, dan
 * "Terapkan yang dicentang"-nya ikut pindah utuh dengan pendengarnya.
 */
async function t6JalankanGabung(k) {
  // Penyunting keterangan saksi yang belum disimpan akan terhapus oleh
  // gambar usulan berikutnya - ditanyakan, bukan dibuang diam-diam.
  const hasil = k.wadah.usulan && k.wadah.usulan.querySelector(".aleta-sdg-hasil");
  if (hasil && !t6SdgTersimpan(hasil)) {
    const ya = await t6Dialog({
      judul: "Penyunting keterangan saksi masih terbuka",
      isi: ["Keterangan saksi di penyunting belum disimpan ke ABT. Melanjutkan langkah ini menutup penyuntingnya - yang belum disimpan hilang."],
      ya: "Tetap lanjutkan",
      tidak: "Kembali ke penyunting",
    });
    if (!ya || t6Keadaan !== k) return;
  }
  k.langkah.set("gabung", "jalan");
  t6SegarkanLangkah(k);
  let gagal = false;
  // 1. Rapikan - pratinjau di wadah riwayat, tanpa menulis.
  const rapikan = k.tombol.rapikan;
  if (rapikan && !rapikan.hidden && k.wadah.riwayat) {
    rapikan.click();
    await t6Tunggu(() => k.wadah.riwayat.childElementCount > 0, 30000);
    if (t6Keadaan !== k) return;
  }
  // 2. Isi dari SIPP - usulannya dipindah ke wadahnya sendiri.
  if (k.usulanSipp) {
    k.usulanSipp.remove();
    k.usulanSipp = null;
  }
  const sipp = k.tombol.sipp;
  const saksi = k.tombol.saksi;
  if (t6TombolTampak(sipp)) {
    const ok = await t6TekanDanTunggu(k, sipp);
    if (t6Keadaan !== k) return;
    if (!ok) gagal = true;
    if (t6TombolTampak(saksi)) t6PindahUsulanSipp(k, ok);
  }
  // 3. Input ke ABT - usulan dari keterangan saksi.
  if (t6TombolTampak(saksi)) {
    const ok = await t6TekanDanTunggu(k, saksi);
    if (t6Keadaan !== k) return;
    if (!ok) gagal = true;
  }
  t6SegarkanJudulUsulan(k);
  k.langkah.set("gabung", gagal ? "gagal" : "selesai");
  t6SegarkanLangkah(k);
  t6HiasSemua(k);
}

/** Kartu usulan SIPP (dan baris tindakannya) pindah ke wadah "Dari SIPP". */
function t6PindahUsulanSipp(k, ok) {
  const asal = k.wadah.usulan;
  if (!asal || !asal.parentElement) return;
  // Bukan berkelas "aleta-t6": pengamat hiasan tidak boleh menganggap kartu
  // lama di dalamnya tulisan blok ini sendiri.
  const w = buatElemen("div", `${asal.className} aleta-t6-usulan-sipp`.trim());
  const kepala = t6El("div", "aleta-t6-usulan-judul");
  const judul = t6El("span", "", "Dari SIPP");
  const kabar = t6El("span", ok ? "aleta-t6-lembut" : "aleta-t6-gagal", t6KalimatRamah(k.kabar ? k.kabar.textContent : "", !ok));
  const tutup = t6Tombol("×", "Tutup usulan dari SIPP (usulan yang sudah diterapkan tetap tersimpan)", "aleta-t6-kecil aleta-t6-tutup");
  tutup.addEventListener("click", () => {
    w.remove();
    if (k.usulanSipp === w) k.usulanSipp = null;
    t6SegarkanJudulUsulan(k);
    t6TerapkanSaring(k);
  });
  kepala.appendChild(judul);
  kepala.appendChild(kabar);
  kepala.appendChild(tutup);
  w.appendChild(kepala);
  for (const c of Array.from(asal.childNodes)) w.appendChild(c);
  asal.parentElement.insertBefore(w, asal);
  k.usulanSipp = w;
}

/** Judul "Dari keterangan saksi" hanya bila usulan SIPP berdiri di atasnya. */
function t6SegarkanJudulUsulan(k) {
  const asal = k.wadah.usulan;
  if (!asal || !asal.parentElement) return;
  const perlu = Boolean(k.usulanSipp && k.usulanSipp.isConnected) && asal.childElementCount > 0 && !asal.querySelector(".aleta-sdg-form");
  if (perlu && !k.judulSaksi) {
    k.judulSaksi = t6El("div", "aleta-t6-usulan-judul", "Dari keterangan saksi");
    asal.parentElement.insertBefore(k.judulSaksi, asal);
  } else if (!perlu && k.judulSaksi) {
    k.judulSaksi.remove();
    k.judulSaksi = null;
  }
}

// ─── Butir 2: peran - susun saksi hanya untuk panitera sidang/PP ───────────

/**
 * Nama peran portal -> golongan. Panitera diperiksa SEBELUM hakim: "Wakil
 * Panitera" adalah panitera, "Wakil Ketua" hakim. Juru sita sebelum panitera:
 * "Jurusita Pengganti" bukan panitera pengganti.
 */
function t6KelasPeran(peran) {
  const p = String(peran || "").toLowerCase();
  if (!p) return "";
  if (/super/.test(p)) return "super-admin";
  // Kata "admin" di awal kata: "Admin", "adminit" - bukan "Pengadministrasi Umum".
  if (/(^|\s)admin/.test(p)) return "admin";
  if (/juru\s*sita/.test(p)) return "juru-sita";
  if (/panitera|\bpp\b/.test(p)) return "panitera";
  if (/hakim|ketua|wakil/.test(p)) return "hakim";
  return "lain";
}

/** Dari akun ALETA (penggunaAletaAbt.peran), cadangannya data-peran panel. */
function t6PeranSekarang(k) {
  const dariAkun = penggunaAletaAbt && penggunaAletaAbt.peran;
  if (dariAkun) return t6KelasPeran(dariAkun);
  const tanda = k.panel.getAttribute("data-peran") || "";
  return { super: "super-admin", admin: "admin", hakim: "hakim" }[tanda] || "";
}

/**
 * Selama peran belum terbaca, tidak ada yang disembunyikan - sama dengan
 * bolehAbt: menyembunyikan lebih dulu lalu memunculkannya membuat panel
 * berkedip bagi yang justru berwenang.
 */
function t6BolehSdg(k) {
  return !k.peran || T6_PERAN_SDG.has(k.peran);
}

function t6PasangPeran(k) {
  t6TerapkanPeran(k);
  if (k.peran) return;
  // Akun ALETA datang menyusul (muatPenggunaAleta di susunPanelAbt).
  const mulai = Date.now();
  const jam = setInterval(() => {
    if (t6Keadaan !== k) {
      clearInterval(jam);
      return;
    }
    t6TerapkanPeran(k);
    if (k.peran || Date.now() - mulai > 30000) clearInterval(jam);
  }, 250);
  k.pewaktu.push(jam);
}

function t6TerapkanPeran(k) {
  const peran = t6PeranSekarang(k);
  if (!peran || peran === k.peran) return;
  k.peran = peran;
  k.panel.setAttribute("data-t6-peran", peran);
  const boleh = t6BolehSdg(k);
  if (boleh) k.panel.removeAttribute("data-t6-sdg");
  else k.panel.setAttribute("data-t6-sdg", "tidak");
  const sdg = k.tombol.sdg;
  if (sdg && !boleh) {
    // hidden DAN disabled: pintasan Alt+Enter mencari tombol ini lewat
    // tulisannya dan hanya melewati yang mati.
    sdg.hidden = true;
    sdg.disabled = true;
  }
  t6SegarkanLangkah(k);
  t6PasangJurusita(k);
}

// ─── Bagian Juru Sita (jurusita.js milik agen E) ────────────────────────────

/**
 * Relaas panggilan dan pemberitahuan putusan - per perkara dan massal.
 * Isinya disusun jurusita.js; blok ini hanya menyediakan tempatnya. Siapa
 * yang boleh melihatnya diputuskan jurusita.js sendiri (aletaJurusitaBoleh -
 * juru sita, panitera, admin, super admin), supaya panel SIPP dan ABT tidak
 * punya dua daftar peran yang dapat berselisih. Bagiannya dipasang saat
 * dibuka pertama kali, dan disembunyikan bila jurusita.js menolak
 * menggambarnya (aletaJurusitaPasang pulang false).
 */
function t6PasangJurusita(k) {
  if (k.jurusita) return;
  const boleh = globalThis.aletaJurusitaBoleh;
  const pasang = globalThis.aletaJurusitaPasang;
  if (typeof boleh !== "function" || typeof pasang !== "function") return;
  const peranAsli = (penggunaAletaAbt && penggunaAletaAbt.peran) || undefined;
  let izin = false;
  try {
    izin = boleh(peranAsli) === true;
  } catch {
    izin = false;
  }
  if (!izin) return;
  const kotak = document.createElement("details");
  kotak.className = "aleta-t6 aleta-t6-jurusita";
  kotak.appendChild(t6El("summary", "aleta-t6-jurusita-judul", "Juru Sita - relaas panggilan & pemberitahuan putusan"));
  const wadah = t6El("div", "aleta-t6-jurusita-isi");
  kotak.appendChild(wadah);
  let terpasang = false;
  const muat = () => {
    if (!kotak.open || terpasang) return;
    terpasang = true;
    const gagal = (galat) => wadah.appendChild(t6El("div", "aleta-t6-gagal", `Bagian Juru Sita gagal dimuat: ${String((galat && galat.message) || galat)}`));
    try {
      Promise.resolve(pasang(wadah, { situs: "abt", nomorPerkara: k.nomor, perkaraId: k.perkaraId }))
        .then((ada) => {
          if (ada === false) kotak.hidden = true;
        })
        .catch(gagal);
    } catch (galat) {
      gagal(galat);
    }
  };
  kotak.addEventListener("toggle", muat);
  const acuan = k.aksi && k.aksi.parentElement === k.isi ? k.aksi : k.isi.firstChild;
  k.isi.insertBefore(kotak, acuan);
  k.jurusita = kotak;
  k.jurusitaMuat = muat;
  // Juru sita datang ke panel ini untuk relaas - bagiannya langsung terbuka.
  if (k.peran === "juru-sita") {
    kotak.open = true;
    muat();
  }
}

// ─── abt-1 / D3: satu kalimat ramah + Rincian ────────────────────────────────

/**
 * Kalimat untuk petugas dari kalimat untuk pemrogram. Yang teknis TIDAK
 * dibuang: ia tetap utuh di "Rincian" - kotak kabar lama itu sendiri,
 * dipindah ke dalam lipatan.
 */
function t6KalimatRamah(teks, gagal) {
  const s = String(teks || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  let m = /^Terbaca (\d+) butir dari saksi 1 dan (\d+) dari saksi 2/.exec(s);
  if (m) {
    const dariLayar = /dibaca dari layar|bacaan mentah gagal/.test(s);
    return dariLayar
      ? `Keterangan saksi belum tersimpan per sidang di ABT - saksi 1 dan 2 dibaca dari layar (${m[1]} dan ${m[2]} butir).`
      : `Keterangan saksi terbaca: saksi 1 ${m[1]} butir, saksi 2 ${m[2]} butir.`;
  }
  m = /^Kuasa aktif: (\d+)\. Prodeo: (ya|tidak)\./.exec(s);
  if (m) {
    const kuasa = Number(m[1]) ? `${m[1]} kuasa aktif` : "Tidak ada kuasa aktif";
    return `${kuasa} · ${m[2] === "ya" ? "prodeo" : "bukan prodeo"}. Variabel prodeo dan fasakh diisi tangan.`;
  }
  m = /^Sidang ke-(\d+) sudah memuat (\d+) tanya-jawab saksi 1; menyimpan akan menimpanya\./.exec(s);
  if (m) return `Sidang ke-${m[1]} sudah berisi keterangan saksi - menyimpan akan menimpanya.`;
  m = /^Belum ada keterangan saksi tersimpan; akan disimpan pada sidang ke-(\d+)\./.exec(s);
  if (m) return `Belum ada keterangan saksi; akan disimpan pada sidang ke-${m[1]}.`;
  if (s.length <= 140) return s;
  // Kalimat pertama saja - baik kabar biasa maupun galat.
  const pertama = s.split(/(?<=[.;])\s+| - /)[0] || s;
  return t6Pendek(pertama, gagal ? 180 : 140);
}

function t6PasangRamah(k) {
  const ramah = t6El("div", "aleta-t6-ramah");
  ramah.setAttribute("role", "status");
  const rinci = document.createElement("details");
  rinci.className = "aleta-t6 aleta-t6-rincian";
  rinci.appendChild(t6El("summary", "aleta-t6-rincian-judul", "Rincian"));
  k.isi.insertBefore(ramah, k.kabar);
  k.isi.insertBefore(rinci, k.kabar);
  rinci.appendChild(k.kabar);
  k.ramah = ramah;
  k.rincian = rinci;
  const p = new MutationObserver(() => t6SegarkanRamah(k));
  p.observe(k.kabar, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  k.pengamat.push(p);
  t6SegarkanRamah(k);
}

function t6SegarkanRamah(k) {
  if (!k.ramah) return;
  const teks = String(k.kabar.textContent || "").trim();
  const gagal = k.kabar.classList.contains("aleta-abt-gagal");
  const kalimat = t6KalimatRamah(teks, gagal);
  k.ramah.textContent = kalimat;
  k.ramah.hidden = !teks;
  k.ramah.classList.toggle("aleta-t6-gagal", gagal);
  k.rincian.hidden = !teks || kalimat === teks.replace(/\s+/g, " ");
}

// ─── Butir 6: penjelasan panjang dilipat di balik ⓘ ─────────────────────────

/**
 * Penjelasan yang panjang - keterangan kelompok alasan, catatan penyunting
 * saksi, catatan bagian unggah, catatan server - dilipat: yang tampak kalimat
 * pertamanya dan ⓘ; ⓘ membuka dan menutup teks utuhnya.
 *
 * Teks aslinya TIDAK diubah: unsurnya hanya diberi data-t6-info dan
 * disembunyikan CSS, dan ringkasannya unsur Tahap 6 di sebelahnya. Yang
 * membaca unsur itu (penjaga, uji, pembaca layar saat dibuka) membaca teks
 * yang sama. Peringatan dan pesan gagal tidak pernah dilipat - begitu pula
 * kabar yang isinya berganti-ganti.
 */
const T6_INFO_PEMILIH = ".aleta-baris-ket, .aleta-abt-catatan, .aleta-t6-info-sumber, .aleta-t6-belum-tersedia";

function t6RingkasInfo(teks) {
  const s = String(teks || "").replace(/\s+/g, " ").trim();
  // Dipotong pada ". ", "; ", atau " - " - bukan titik dua: "Kirim ke BAS
  // SIPP: belum tersedia" harus tetap membawa "belum tersedia"-nya.
  const m = /^(.{12,}?)(?:([.;])\s| - )/.exec(s);
  const r = m ? `${m[1]}${m[2] === "." ? "." : ""}` : s;
  return t6Pendek(r, 78);
}

function t6LipatInfo(el) {
  if (el.hasAttribute("data-t6-info") || !el.parentNode) return;
  const teks = String(el.textContent || "").replace(/\s+/g, " ").trim();
  if (teks.length <= T6_INFO_BATAS) return;
  if (el.classList.contains("aleta-abt-gagal") || el.classList.contains("aleta-sdg-kabar-pilih")) return;
  if (/MENIMPA|JANGAN|tertahan/.test(teks)) return;
  el.setAttribute("data-t6-info", "tutup");
  const pita = t6El("div", "aleta-t6-info-pita");
  const ringkas = t6El("span", "aleta-t6-info-ringkas", t6RingkasInfo(teks));
  const b = t6Tombol("ⓘ", "Buka penjelasan lengkap", "aleta-t6-info-tombol");
  b.setAttribute("aria-expanded", "false");
  b.addEventListener("click", () => {
    const buka = el.getAttribute("data-t6-info") !== "buka";
    el.setAttribute("data-t6-info", buka ? "buka" : "tutup");
    b.setAttribute("aria-expanded", buka ? "true" : "false");
    b.title = buka ? "Tutup penjelasan lengkap" : "Buka penjelasan lengkap";
    ringkas.hidden = buka;
  });
  pita.appendChild(ringkas);
  pita.appendChild(b);
  el.parentNode.insertBefore(pita, el);
}

function t6LipatSemua(k) {
  if (!k || t6Keadaan !== k) return;
  for (const el of Array.from(k.isi.querySelectorAll(T6_INFO_PEMILIH))) t6LipatInfo(el);
}

function t6PasangInfo(k) {
  let jam = 0;
  const p = new MutationObserver((catatan) => {
    if (t6MilikSendiri(catatan)) return;
    clearTimeout(jam);
    jam = setTimeout(() => t6LipatSemua(k), 60);
  });
  p.observe(k.isi, { childList: true, subtree: true });
  k.pengamat.push(p);
  t6LipatSemua(k);
}

// ─── Bilah alat: pratinjau, konsistensi, perkara sebelumnya, dasar hukum ─────

function t6PasangAlat(k) {
  const alat = [];
  if (t6Pakai(k, "abt-12")) {
    alat.push(["pratinjau", "Pratinjau putusan", "Naskah seperti hasil CETAK, dibaca dari ABT tanpa mengunduh - lengkap dengan kalimat error bila ada", (w) => t6SusunPratinjau(k, w, { naskah: true, perkiraan: t6Nyala("abt-24") })]);
  } else if (t6Nyala("abt-24")) {
    alat.push(["panjang", "Perkiraan panjang", "Perkiraan jumlah halaman putusan dan bagian terpanjangnya", (w) => t6SusunPratinjau(k, w, { naskah: false, perkiraan: true })]);
  }
  if (t6Nyala("abt-13")) alat.push(["konsistensi", "Periksa konsistensi", "Nomor perkara, nama pihak, dan tahun nikah dibandingkan antar variabel", (w) => t6SusunKonsistensi(k, w)]);
  if (t6Nyala("abt-19")) alat.push(["sebelumnya", "Perkara sebelumnya", "Perkara lain para pihak yang sama - dibaca dari SIPP lewat ALETA saat ditekan", (w) => t6SusunPerkaraSebelumnya(k, w)]);
  if (t6Nyala("abt-27")) alat.push(["pasal", "Saran dasar hukum", "Pasal per huruf alasan dari templat hukum ALETA - yang DRAF tidak dapat disisipkan", (w) => t6SusunSaranPasal(k, w)]);
  if (t6Nyala("abt-30")) alat.push(["musyawarah", "Ringkasan musyawarah", "Satu halaman bahan musyawarah majelis dari yang terbaca di panel ini", (w) => t6SusunMusyawarah(k, w)]);
  if (!alat.length) return;

  const bilah = t6El("div", "aleta-t6-alat");
  const wadah = t6El("div", "aleta-t6-wadah-alat");
  k.alatTombol = new Map();
  for (const [nama, label, judul, susun] of alat) {
    const b = t6Tombol(label, judul, "aleta-t6-alat-tombol");
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => t6BukaAlat(k, nama, label, susun, wadah));
    bilah.appendChild(b);
    k.alatTombol.set(nama, b);
  }
  const sesudah = (k.rincian || k.kabar || k.aksi || null);
  const acuan = sesudah ? sesudah.nextSibling : k.isi.firstChild;
  k.isi.insertBefore(bilah, acuan);
  k.isi.insertBefore(wadah, bilah.nextSibling);
  k.wadahAlat = wadah;
}

function t6BukaAlat(k, nama, label, susun, wadah) {
  wadah.textContent = "";
  const tutup = k.alatTerbuka === nama;
  k.alatTerbuka = tutup ? "" : nama;
  for (const [n, b] of k.alatTombol) b.setAttribute("aria-pressed", n === k.alatTerbuka ? "true" : "false");
  if (tutup) return;
  const bagian = t6El("div", "aleta-t6-bagian");
  bagian.setAttribute("data-t6-alat", nama);
  const kepala = t6El("div", "aleta-t6-bagian-kepala");
  kepala.appendChild(t6El("span", "aleta-t6-bagian-judul", label));
  const x = t6Tombol("×", "Tutup", "aleta-t6-kecil aleta-t6-tutup");
  x.addEventListener("click", () => t6BukaAlat(k, nama, label, susun, wadah));
  kepala.appendChild(x);
  bagian.appendChild(kepala);
  const isi = t6El("div", "aleta-t6-bagian-isi");
  bagian.appendChild(isi);
  wadah.appendChild(bagian);
  Promise.resolve()
    .then(() => susun(isi))
    .catch((galat) => {
      isi.appendChild(t6El("div", "aleta-t6-gagal", String((galat && galat.message) || galat)));
    });
}

// ─── Membaca RTF menjadi teks ───────────────────────────────────────────────

function t6Latin1(sumber) {
  if (typeof sumber === "string") return sumber;
  const u = new Uint8Array(sumber);
  let s = "";
  for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
  return s;
}

/**
 * Teks naskah dari RTF - cukup untuk dibaca dan dicari, bukan untuk dicetak.
 * Tabel huruf, warna, gaya, gambar, dan kepala-kaki halaman dilewati; \par
 * menjadi baris baru; \'hh dan \uN diterjemahkan.
 */
function t6TeksRtf(sumber) {
  const s = t6Latin1(sumber);
  const tumpuk = [];
  let lewati = false;
  let ucLewat = 1;
  let buang = 0;
  let hasil = "";
  const tulis = (teks) => {
    if (lewati) return;
    if (buang > 0) {
      buang -= 1;
      return;
    }
    hasil += teks;
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "{") {
      tumpuk.push({ lewati, ucLewat });
      buang = 0;
      i += 1;
      continue;
    }
    if (c === "}") {
      const atas = tumpuk.pop();
      lewati = atas ? atas.lewati : false;
      ucLewat = atas ? atas.ucLewat : 1;
      buang = 0;
      i += 1;
      continue;
    }
    if (c === "\\") {
      const n = s[i + 1];
      if (n === "\\" || n === "{" || n === "}") {
        tulis(n);
        i += 2;
        continue;
      }
      if (n === "'") {
        const kode = parseInt(s.substr(i + 2, 2), 16);
        tulis(Number.isNaN(kode) ? "" : T6_CP1252[kode] || String.fromCharCode(kode));
        i += 4;
        continue;
      }
      if (n === "*") {
        lewati = true;
        i += 2;
        continue;
      }
      if (n === "~") {
        tulis(" ");
        i += 2;
        continue;
      }
      if (n === "\n" || n === "\r") {
        tulis("\n");
        i += 2;
        continue;
      }
      const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(s.slice(i + 1, i + 48));
      if (!m) {
        i += 2;
        continue;
      }
      i += 1 + m[0].length;
      const kata = m[1];
      if (T6_RTF_LEWAT.has(kata)) {
        lewati = true;
        continue;
      }
      if (lewati) continue;
      if (kata === "par" || kata === "line" || kata === "sect" || kata === "page" || kata === "row") {
        buang = 0;
        hasil += "\n";
      } else if (kata === "tab" || kata === "cell") {
        hasil += "\t";
      } else if (kata === "uc") {
        ucLewat = Number(m[2]) || 0;
      } else if (kata === "u") {
        let kode = Number(m[2]) || 0;
        if (kode < 0) kode += 65536;
        hasil += String.fromCharCode(kode);
        // Karakter pengganti sesudah \uN bukan isi naskah.
        buang = ucLewat;
      }
      continue;
    }
    if (c === "\r" || c === "\n") {
      i += 1;
      continue;
    }
    tulis(c);
    i += 1;
  }
  return hasil;
}

function t6Paragraf(teks) {
  return String(teks || "")
    .split("\n")
    .map((x) => x.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean);
}

// ─── abt-12 / D12 dan abt-24: pratinjau putusan dan perkiraan panjang ───────

async function t6BacaNaskahCetak() {
  const tautan = document.querySelector('a[href*="abt/preview"]');
  if (!tautan) throw new Error("Tautan CETAK ABT tidak ditemukan di halaman ini - naskahnya tidak dapat dibaca.");
  const r = await fetch(tautan.href, { credentials: "include", cache: "no-store" });
  if (!r.ok) throw new Error(`ABT menjawab ${r.status}.`);
  const buf = await r.arrayBuffer();
  if (!t6Latin1(new Uint8Array(buf).subarray(0, 5)).startsWith("{\\rtf")) {
    throw new Error("ABT tidak mengembalikan RTF - sesi ABT mungkin habis. Muat ulang halaman ABT.");
  }
  return t6Paragraf(t6TeksRtf(buf));
}

/** Pembagian naskah menurut judul bagiannya - untuk perkiraan panjang. */
function t6BagianNaskah(paragraf) {
  const cari = (pola) => paragraf.findIndex((p) => pola.test(p));
  const duduk = cari(/^(TENTANG\s+)?DUDUK\s+PERKARA/i);
  const timbang = cari(/^(TENTANG\s+)?PERTIMBANGAN\s+HUKUM/i);
  const adili = cari(/^M\s*E\s*N\s*G\s*A\s*D\s*I\s*L\s*I|^M\s*E\s*N\s*E\s*T\s*A\s*P\s*K\s*A\s*N/i);
  const batas = [
    ["Kepala dan identitas", 0],
    ["Duduk perkara", duduk],
    ["Pertimbangan hukum", timbang],
    ["Amar dan penutup", adili],
  ].filter(([, i], n) => n === 0 || i > 0);
  return batas.map(([nama, awal], n) => {
    const akhir = n + 1 < batas.length ? batas[n + 1][1] : paragraf.length;
    const huruf = paragraf.slice(awal, akhir).reduce((j, p) => j + p.length, 0);
    return { nama, huruf };
  });
}

async function t6SusunPratinjau(k, wadah, pilih) {
  const muat = t6El("div", "aleta-t6-lembut", "Membaca naskah dari ABT (sama dengan CETAK, tanpa mengunduh)…");
  wadah.appendChild(muat);
  let paragraf;
  try {
    paragraf = await t6BacaNaskahCetak();
  } catch (galat) {
    muat.className = "aleta-t6 aleta-t6-gagal";
    muat.textContent = String((galat && galat.message) || galat);
    return;
  }
  muat.remove();
  const semua = paragraf.reduce((j, p) => j + p.length, 0);
  const halaman = Math.max(1, semua / T6_HURUF_PER_HALAMAN);
  if (pilih.perkiraan) {
    const bagian = t6BagianNaskah(paragraf);
    const terpanjang = bagian.reduce((a, b) => (b.huruf > a.huruf ? b : a), bagian[0]);
    const kotak = t6El("div", "aleta-t6-perkiraan");
    kotak.appendChild(t6El("strong", "", `Perkiraan ± ${Math.ceil(halaman)} halaman`));
    kotak.appendChild(
      t6El(
        "div",
        "aleta-t6-lembut",
        bagian.map((b) => `${b.nama} ${t6Angka(b.huruf / T6_HURUF_PER_HALAMAN)}${b === terpanjang ? " (terpanjang)" : ""}`).join(" · ")
      )
    );
    kotak.title = `Dihitung dari ${semua} huruf dengan ± ${T6_HURUF_PER_HALAMAN} huruf per halaman - perkiraan, bukan tata letak cetak.`;
    wadah.appendChild(kotak);
  }
  if (!pilih.naskah) return;
  const galat = paragraf.filter((p) => FRASA_GALAT.some((pola) => pola.test(p)) || /DATA_TIDAK_ADA/.test(p)).length;
  wadah.appendChild(
    t6El(
      "div",
      galat ? "aleta-t6-gagal" : "aleta-t6-lembut",
      galat
        ? `${galat} paragraf memuat kalimat error atau DATA_TIDAK_ADA - disorot di bawah. Kalimat itu ikut tercetak.`
        : `Tidak ada kalimat error di naskah. ± ${Math.ceil(halaman)} halaman.`
    )
  );
  const naskah = t6El("div", "aleta-t6-naskah");
  const perbesar = t6Tombol("⤢ Perbesar", "Perbesar kotak pratinjau", "aleta-t6-kecil");
  perbesar.addEventListener("click", () => {
    const besar = naskah.classList.toggle("aleta-t6-naskah-besar");
    perbesar.textContent = besar ? "⤡ Perkecil" : "⤢ Perbesar";
  });
  wadah.appendChild(perbesar);
  let jalan = 0;
  let halamanKe = 1;
  const pola = /TIDAK BENAR QUERY NYA|BELUM ISI ALASAN|DATA_TIDAK_ADA/gi;
  for (const p of paragraf.slice(0, 800)) {
    const el = t6El("p", "aleta-t6-naskah-p");
    let akhir = 0;
    for (const m of p.matchAll(pola)) {
      el.appendChild(document.createTextNode(p.slice(akhir, m.index)));
      el.appendChild(t6El("mark", "aleta-t6-galat-sorot", m[0]));
      akhir = m.index + m[0].length;
    }
    el.appendChild(document.createTextNode(p.slice(akhir)));
    naskah.appendChild(el);
    jalan += p.length;
    if (jalan > halamanKe * T6_HURUF_PER_HALAMAN) {
      halamanKe += 1;
      naskah.appendChild(t6El("div", "aleta-t6-naskah-halaman", `— ± halaman ${halamanKe} —`));
    }
  }
  if (paragraf.length > 800) naskah.appendChild(t6El("div", "aleta-t6-lembut", `… ${paragraf.length - 800} paragraf lagi tidak ditampilkan.`));
  wadah.appendChild(naskah);
}

// ─── abt-13: pemeriksa konsistensi ──────────────────────────────────────────

/** Nama dari kalimat identitas: "Sri Rahayu binti Ikhsan, NIK …" -> inti "Sri Rahayu". */
function t6NamaDariIdentitas(teks) {
  const lengkap = String(teks || "").split(",")[0].replace(/\s+/g, " ").trim();
  if (!lengkap || keadaanNilai(lengkap) !== "terisi" || /\d/.test(lengkap) || lengkap.length > 80) return null;
  const inti = lengkap.split(/\s+(?:bin|binti)\s+/i)[0].trim();
  if (inti.length < 3) return null;
  return { lengkap, inti };
}

/** Tahun nikah dari kalimat yang menyebut pernikahan - posita atau keterangan saksi. */
function t6TahunNikah(teks) {
  const kalimat = String(teks || "").split(/(?<=[.;])\s+|\n/);
  for (const s of kalimat) {
    if (!/menikah|pernikahan|perkawinan|melangsungkan|akad nikah/i.test(s)) continue;
    const m = s.match(/\b(19[5-9]\d|20[0-4]\d)\b/);
    if (m) return { tahun: m[1], kalimat: t6Pendek(s, 140) };
  }
  return null;
}

function t6TeksVariabel(peta, kode) {
  const item = peta.get(kode);
  if (!item) return "";
  return String(item.selNilai.innerText || item.selNilai.textContent || "");
}

function t6PeriksaKonsistensi(k) {
  const peta = barisVariabel();
  const hasil = [];
  const n0001 = (peta.get("0001") || {}).nilai || "";
  if (n0001 && k.nomor) {
    const sama = t6Baku(n0001) === t6Baku(k.nomor);
    hasil.push({
      cocok: sama,
      judul: "Nomor perkara",
      rinci: sama ? `0001 sama dengan kepala halaman (${k.nomor}).` : `0001 berisi ${n0001}, sedangkan panel bekerja untuk ${k.nomor}.`,
      kode: "0001",
    });
  }
  const amar = t6TeksVariabel(peta, "4001");
  for (const [kode, sebut] of [
    ["7047", nilaiVariabel(VAR_PIHAK_LAWAN) || "Penggugat"],
    ["7048", nilaiVariabel(VAR_PIHAK_PELAKU) || "Tergugat"],
  ]) {
    const nama = t6NamaDariIdentitas((peta.get(kode) || {}).nilai);
    if (!nama || !amar.trim()) continue;
    const ada = t6PolaKata(nama.inti).test(amar);
    hasil.push({
      cocok: ada,
      judul: `Nama ${sebut}`,
      rinci: ada ? `"${nama.inti}" (${kode}) juga tertulis di amar 4001.` : `"${nama.inti}" (${kode}) tidak ditemukan di amar 4001.`,
      kode: ada ? kode : "4001",
    });
  }
  const posita = t6TahunNikah(t6TeksVariabel(peta, VAR_POSITA));
  if (posita) {
    for (const [kode, nama] of [
      [VAR_SAKSI_1, "saksi 1"],
      [VAR_SAKSI_2, "saksi 2"],
    ]) {
      const saksi = t6TahunNikah(t6TeksVariabel(peta, kode));
      if (!saksi) continue;
      const sama = saksi.tahun === posita.tahun;
      hasil.push({
        cocok: sama,
        judul: `Tahun nikah: posita dan ${nama}`,
        rinci: sama ? `Keduanya ${posita.tahun}.` : `Posita (5125) ${posita.tahun}, ${nama} (${kode}) menjawab ${saksi.tahun}: "${saksi.kalimat}"`,
        kode,
      });
    }
  }
  return hasil;
}

function t6SusunKonsistensi(k, wadah) {
  const hasil = t6PeriksaKonsistensi(k);
  if (!hasil.length) {
    wadah.appendChild(t6El("div", "aleta-t6-lembut", "Tidak ada yang dapat dibandingkan - nomor perkara, identitas pihak, amar, posita, atau keterangan saksi belum tergambar di blangko ini."));
    return;
  }
  const selisih = hasil.filter((x) => !x.cocok).length;
  wadah.appendChild(t6El("div", selisih ? "aleta-t6-gagal" : "aleta-t6-lembut", `${selisih} selisih · ${hasil.length - selisih} cocok`));
  for (const x of hasil) {
    const baris = t6El("div", `aleta-t6-konsisten ${x.cocok ? "aleta-t6-cocok" : "aleta-t6-selisih"}`);
    baris.appendChild(t6El("span", "aleta-t6-titik", "●"));
    baris.appendChild(t6El("strong", "", `${x.judul}: `));
    baris.appendChild(t6El("span", "", x.rinci));
    if (x.kode) baris.appendChild(t6KepingKode(x.kode));
    wadah.appendChild(baris);
  }
  wadah.appendChild(t6El("div", "aleta-t6-lembut", "Dibandingkan dari isi yang tergambar di halaman ini, dengan kata dan angka - bukan pembacaan makna."));
}

// ─── abt-19: perkara sebelumnya para pihak yang sama ────────────────────────

async function t6SusunPerkaraSebelumnya(k, wadah) {
  if (!k.perkaraId && !k.nomor) {
    wadah.appendChild(t6El("div", "aleta-t6-lembut", "Perkara halaman ini tidak terbaca."));
    return;
  }
  const muat = t6El("div", "aleta-t6-lembut", "Membaca riwayat para pihak…");
  wadah.appendChild(muat);
  const q = new URLSearchParams();
  if (k.perkaraId) q.set("perkaraId", k.perkaraId);
  if (k.nomor) q.set("nomorPerkara", k.nomor);
  const h = await t6AmbilJson(`${T6_API_RIWAYAT_PIHAK}?${q.toString()}`, "Riwayat para pihak");
  muat.remove();
  const data = h.data || {};
  if (!h.ok || data.ok === false) {
    wadah.appendChild(t6El("div", "aleta-t6-gagal", h.ok ? String(data.alasan || "Riwayat para pihak tidak terbaca.") : h.pesan));
    return;
  }
  let ada = 0;
  for (const p of Array.isArray(data.pihak) ? data.pihak : []) {
    const lain = new Map();
    for (const x of [...(p.cerai || []), ...(p.terkait || [])]) {
      if (!x || x.arah === "perkara ini" || !x.nomorPerkara) continue;
      lain.set(x.nomorPerkara, x);
    }
    if (!lain.size) continue;
    ada += lain.size;
    const blok = t6El("div", "aleta-t6-sebelumnya");
    blok.appendChild(t6El("div", "aleta-t6-sebelumnya-judul", `${p.nama || "Pihak"}${p.kedudukan ? ` (${p.kedudukan})` : ""}`));
    for (const x of lain.values()) {
      const bagian = [x.nomorPerkara, x.jenisPerkara, x.keadaan];
      if (x.tanggalPutusan) bagian.push(`putus ${x.tanggalPutusan}`);
      if (x.aktaCerai && x.aktaCerai.nomor) bagian.push(`akta cerai ${x.aktaCerai.nomor}`);
      const baris = t6El("div", "aleta-t6-sebelumnya-baris", bagian.filter(Boolean).join(" · "));
      if (x.dasar && x.dasar.label) baris.appendChild(t6El("span", "aleta-t6-lencana", `dasar: ${x.dasar.label}`));
      if (x.arah) baris.appendChild(t6El("span", "aleta-t6-lembut", ` ${x.arah}`));
      blok.appendChild(baris);
    }
    wadah.appendChild(blok);
  }
  if (!ada) wadah.appendChild(t6El("div", "aleta-t6-lembut", "Tidak ada perkara lain dengan pihak yang sama."));
  wadah.appendChild(t6El("div", "aleta-t6-lembut", "Dasar pencocokan disebut per perkara. Nama saja tidak pernah dipakai; pembacaan ini tercatat di jejak audit ALETA."));
}

// ─── abt-27: saran dasar hukum per huruf alasan ─────────────────────────────

function t6MuatPasal(k) {
  if (!k.pasal) {
    k.pasal = t6AmbilJson(`${T6_API_TEMPLAT_HUKUM}?jenis=pasal`, "Templat dasar hukum").then((h) => ({
      ok: h.ok,
      pesan: h.pesan,
      belumAda: h.belumAda,
      butir: h.ok && h.data && Array.isArray(h.data.butir) ? h.data.butir.filter((b) => b && b.jenis === "pasal") : [],
    }));
  }
  return k.pasal;
}

function t6HurufDari8503() {
  const isi = nilaiVariabel(VAR_HURUF).toUpperCase().replace(/\bDAN\b/g, "");
  const huruf = isi.replace(/[^A-Z]/g, "");
  if (!huruf || huruf.length > 8 || !/^[A-K]+$/.test(huruf)) return [];
  return Array.from(new Set(huruf.split("")));
}

/**
 * Satu butir templat pasal. HANYA yang disahkan yang dapat disisipkan
 * (kontrak Tahap 6-7): yang DRAF tampil bertanda dan tombolnya mati - dasar
 * hukum yang belum disahkan majelis tidak boleh masuk ke naskah dengan satu
 * klik.
 */
function t6KartuPasal(k, b) {
  const kartu = t6El("div", `aleta-t6-pasal${b.disahkan ? "" : " aleta-t6-draf"}`);
  const kepala = t6El("div", "aleta-t6-pasal-kepala");
  kepala.appendChild(t6El("span", "aleta-t6-pasal-huruf", String(b.kunci || "").toUpperCase()));
  kepala.appendChild(t6El("span", "aleta-t6-pasal-judul", String(b.judul || "")));
  kepala.appendChild(
    b.disahkan
      ? t6El("span", "aleta-t6-lencana aleta-t6-lencana-aman", `disahkan${b.disahkanOleh && b.disahkanOleh.nama ? ` · ${b.disahkanOleh.nama}` : ""}`)
      : t6El("span", "aleta-t6-lencana aleta-t6-lencana-draf", "DRAF - belum disahkan")
  );
  kartu.appendChild(kepala);
  kartu.appendChild(t6El("div", "aleta-t6-pasal-isi", String(b.isi || "")));
  const sisip = t6Tombol("Sisipkan", b.disahkan ? "Sisipkan ke kotak yang terakhir disunting, atau salin bila tidak ada" : "Butir DRAF tidak dapat disisipkan - sahkan dahulu di portal (Super Admin)", "aleta-t6-kecil aleta-t6-sisip");
  sisip.disabled = !b.disahkan;
  const kabar = t6El("span", "aleta-t6-lembut");
  sisip.addEventListener("click", async () => {
    if (!b.disahkan) return;
    kabar.textContent = await t6Sisipkan(String(b.isi || ""));
  });
  const baris = t6El("div", "aleta-t6-pasal-kaki");
  baris.appendChild(sisip);
  baris.appendChild(kabar);
  kartu.appendChild(baris);
  return kartu;
}

async function t6Sisipkan(teks) {
  const sasaran = t6KotakTerakhir;
  if (sasaran && sasaran.isConnected && !sasaran.disabled && !sasaran.readOnly) {
    const awal = typeof sasaran.selectionStart === "number" ? sasaran.selectionStart : sasaran.value.length;
    const akhir = typeof sasaran.selectionEnd === "number" ? sasaran.selectionEnd : awal;
    sasaran.value = `${sasaran.value.slice(0, awal)}${teks}${sasaran.value.slice(akhir)}`;
    sasaran.dispatchEvent(new Event("input", { bubbles: true }));
    try {
      sasaran.focus();
    } catch {
      /* fokus hanya kenyamanan */
    }
    return "Disisipkan ke kotak yang terakhir disunting - belum tersimpan sampai kotak itu disimpan.";
  }
  const tersalin = typeof alatSalin === "function" ? await alatSalin(teks) : false;
  return tersalin ? "Disalin - tempel di kotak isian pertimbangan." : "Tidak ada kotak yang sedang disunting, dan papan klip menolak. Buka penyunting variabel dahulu.";
}

async function t6SusunSaranPasal(k, wadah) {
  const muat = t6El("div", "aleta-t6-lembut", "Membaca templat dasar hukum…");
  wadah.appendChild(muat);
  const h = await t6MuatPasal(k);
  muat.remove();
  if (!h.ok) {
    wadah.appendChild(t6El("div", h.belumAda ? "aleta-t6-lembut" : "aleta-t6-gagal", h.belumAda ? "Templat dasar hukum belum tersedia di server." : h.pesan));
    return;
  }
  const huruf = t6HurufDari8503();
  const dipakai = huruf.length ? h.butir.filter((b) => huruf.includes(String(b.kunci || "").toUpperCase())) : h.butir;
  wadah.appendChild(
    t6El(
      "div",
      "aleta-t6-lembut",
      huruf.length
        ? `Untuk huruf ${huruf.join(", ")} (8503). Saran saja - yang memutus dasar hukumnya majelis.`
        : "8503 belum berisi huruf alasan - seluruh huruf ditampilkan. Saran saja - yang memutus dasar hukumnya majelis."
    )
  );
  if (!dipakai.length) {
    wadah.appendChild(t6El("div", "aleta-t6-lembut", "Belum ada templat pasal untuk huruf itu."));
    return;
  }
  for (const b of dipakai) wadah.appendChild(t6KartuPasal(k, b));
}

// ─── abt-30: ringkasan musyawarah majelis ───────────────────────────────────

function t6NamaDiKelompok(wadah, nada) {
  if (!wadah) return [];
  const blok = wadah.querySelector(`.aleta-alasan-kelompok.aleta-alasan-${nada}`);
  if (!blok) return [];
  return Array.from(blok.querySelectorAll(".aleta-alasan-nama")).map((x) => String(x.textContent || "").trim());
}

function t6TeksMusyawarah(k) {
  const peta = barisVariabel();
  const p1 = t6NamaDariIdentitas((peta.get("7047") || {}).nilai);
  const p2 = t6NamaDariIdentitas((peta.get("7048") || {}).nilai);
  const baris = [];
  baris.push("RINGKASAN BAHAN MUSYAWARAH MAJELIS");
  baris.push(`Perkara ${k.nomor || "-"}${k.jenis ? ` · ${k.jenis}` : ""}`);
  if (p1 || p2) baris.push(`${nilaiVariabel(VAR_PIHAK_LAWAN) || "Penggugat"}: ${p1 ? p1.lengkap : "-"} · ${nilaiVariabel(VAR_PIHAK_PELAKU) || "Tergugat"}: ${p2 ? p2.lengkap : "-"}`);
  baris.push("");
  const daftar = (judul, isi) => {
    baris.push(`${judul}:`);
    baris.push(isi.length ? isi.map((x) => `  - ${x}`).join("\n") : "  (tidak ada)");
  };
  const siap = t6NamaDiKelompok(k.wadah.sepihak, "siap");
  const sepihak = t6NamaDiKelompok(k.wadah.sepihak, "sebagian");
  const diluar = t6NamaDiKelompok(k.wadah.sepihak, "awas");
  const belum = t6NamaDiKelompok(k.wadah.sepihak, "belum");
  const adaAlasan = siap.length + sepihak.length + diluar.length + belum.length > 0;
  if (adaAlasan) {
    daftar("Alasan terbukti (kedua saksi, didalilkan)", siap);
    daftar("Baru disebut satu saksi", sepihak);
    daftar("Terbukti tetapi di luar gugatan - jangan dipertimbangkan", diluar);
    daftar("Didalilkan tetapi belum terbukti - harus disinggung", belum);
  } else {
    baris.push("Alasan perceraian belum terbaca - tekan \"Input ke ABT\" (langkah 4) supaya keterangan saksi dianalisis.");
  }
  const selisih = k.wadah.selisih
    ? Array.from(k.wadah.selisih.querySelectorAll(".aleta-abt-naskah")).map((el) => {
        const bunyi = el.nextElementSibling && el.nextElementSibling.classList.contains("aleta-abt-bunyi") ? ` (${el.nextElementSibling.textContent.trim()})` : "";
        return `${el.textContent.trim()}${bunyi}`;
      })
    : [];
  daftar("Selisih keterangan antar saksi", selisih);
  const fakta = t6KartuUsulan(k)
    .filter((el) => el.getAttribute("data-t6-yakin") === "pasti")
    .map((el) => {
      const kode = String((el.querySelector(".aleta-abt-kode") || {}).textContent || "");
      const nama = String((el.querySelector(".aleta-abt-nama") || {}).textContent || "");
      const nilai = String((el.querySelector(".aleta-abt-usul .aleta-abt-isi") || {}).textContent || "");
      return `${kode} ${nama}: ${nilai}`;
    });
  daftar("Fakta yang diterangkan sama oleh kedua saksi", fakta);
  const huruf = nilaiVariabel(VAR_HURUF);
  const alasan = nilaiVariabel("5227");
  if (huruf) baris.push(`Huruf alasan (8503): ${huruf}`);
  if (alasan) baris.push(`Alasan perceraian (5227): ${t6Pendek(alasan, 400)}`);
  if (k.komentar && k.komentar.ok) {
    const terbuka = k.komentar.daftar.filter((x) => !x.selesai);
    if (terbuka.length) daftar("Komentar hakim yang belum selesai", terbuka.map((x) => `${t6LabelBagian(x.bagian)}: ${t6Pendek(x.isi, 160)}`));
  }
  baris.push("");
  baris.push(`Disusun ALETA dari panel ABT, ${t6Jam(new Date().toISOString())}. Bahan musyawarah - bukan putusan; yang memutus majelis.`);
  return baris.join("\n");
}

async function t6SusunMusyawarah(k, wadah) {
  const teks = t6TeksMusyawarah(k);
  wadah.appendChild(t6El("pre", "aleta-t6-pra aleta-t6-musyawarah", teks));
  const salin = t6Tombol("Salin", "Salin ringkasan ke papan klip", "aleta-t6-kecil");
  const kabar = t6El("span", "aleta-t6-lembut");
  salin.addEventListener("click", async () => {
    const ok = typeof alatSalin === "function" ? await alatSalin(teks) : false;
    kabar.textContent = ok ? "Tersalin." : "Papan klip menolak - pilih teksnya lalu Ctrl+C.";
  });
  wadah.appendChild(salin);
  wadah.appendChild(kabar);
}

// ─── Kepala: mode baca (abt-25), urungkan dan ulangi (abt-23) ───────────────

function t6PasangKepala(k) {
  if (!t6Nyala("abt-25") && !t6Nyala("abt-23")) return;
  if (!k.kepala) return;
  const grup = t6El("span", "aleta-t6-kepala-alat");
  if (t6Nyala("abt-23")) {
    k.tombolUrung = t6Tombol("↶", "Urungkan suntingan terakhir (Ctrl+Z)", "aleta-t6-kepala-tombol");
    k.tombolUlang = t6Tombol("↷", "Ulangi (Ctrl+Y)", "aleta-t6-kepala-tombol");
    k.tombolUrung.addEventListener("click", () => void t6Urungkan(k));
    k.tombolUlang.addEventListener("click", () => void t6Ulangi(k));
    grup.appendChild(k.tombolUrung);
    grup.appendChild(k.tombolUlang);
  }
  if (t6Nyala("abt-25")) {
    k.tombolBaca = t6Tombol("▤", "", "aleta-t6-kepala-tombol aleta-t6-tombol-baca");
    k.tombolBaca.addEventListener("click", () => {
      k.baca = !k.baca;
      t6Tulis({ [T6_KUNCI_BACA]: k.baca });
      t6TerapkanBaca(k);
    });
    grup.appendChild(k.tombolBaca);
  }
  const alatKepala = t6Anak(k.kepala, "aleta-alat-kepala");
  if (alatKepala) alatKepala.insertBefore(grup, alatKepala.firstChild);
  else k.kepala.appendChild(grup);
  t6SegarkanUrung(k);
}

function t6TumpukanDari(perkaraId) {
  if (!t6Tumpukan.has(perkaraId)) t6Tumpukan.set(perkaraId, { urung: [], ulang: [] });
  return t6Tumpukan.get(perkaraId);
}

/**
 * Hanya variabel data_teks/data_tanggal yang dapat ditulis ulang lewat
 * edit_data. Posita tersimpan di SIPP, keterangan saksi di tanya-jawab ABT,
 * dan variabel (OTOMATIS) dihitung - ketiganya punya jalurnya sendiri.
 */
function t6DapatDitulisUlang(kode) {
  const k = String(kode || "");
  if (k === VAR_POSITA || VAR_OTOMATIS.includes(k)) return false;
  if (VAR_SAKSI_TANYA_JAWAB.P.includes(k) || VAR_SAKSI_TANYA_JAWAB.T.includes(k)) return false;
  return /^\d{4}$/.test(k);
}

function t6NilaiSimpan(nilai) {
  const s = String(nilai || "").trim();
  return s === "DATA_TIDAK_ADA" || s === "(kosong)" ? "" : s;
}

/** Menulis ke ABT lewat simpanVariabel yang sama dengan sunting tangan. */
async function t6SimpanNilai(k, kode, nilai, cara, sebelum, nama) {
  let hasil;
  try {
    hasil = await simpanVariabel(kode, nilai, k.jatiDiri);
  } catch (galat) {
    hasil = { ok: false, pesan: String((galat && galat.message) || galat) };
  }
  if (!hasil.ok) {
    // simpanVariabel hanya menyebut "ABT menjawab 423." - padahal yang
    // menjawab penahan panel-alat.js, bukan ABT. Disebut mode mana.
    if (/423/.test(String(hasil.pesan))) {
      let latihan = false;
      try {
        latihan = typeof alatLatihanNyala === "function" && alatLatihanNyala() === true;
      } catch {
        latihan = false;
      }
      if (latihan) return { ok: false, pesan: "Ditahan mode latihan - tidak ada yang disimpan ke ABT." };
      if (t6Coba()) return { ok: false, pesan: "Ditahan mode coba - tidak ada yang disimpan ke ABT." };
    }
    return hasil;
  }
  const item = barisVariabel().get(kode);
  const tersimpan = hasil.nilaiTersimpan ?? nilai;
  if (item) item.selNilai.textContent = tersimpan || "DATA_TIDAK_ADA";
  void catatRiwayat({
    perkaraId: k.perkaraId,
    kode,
    nama: nama || (item ? item.nama : ""),
    sebelum: sebelum || "",
    sesudah: tersimpan,
    cara,
    pada: new Date().toISOString(),
  });
  return hasil;
}

async function t6Urungkan(k) {
  const t = t6TumpukanDari(k.perkaraId);
  const e = t.urung[t.urung.length - 1];
  if (!e) {
    t6Lapor(k, "Tidak ada suntingan yang dapat diurungkan di halaman ini.");
    return;
  }
  if (!t6DapatDitulisUlang(e.kode)) {
    t.urung.pop();
    t6SegarkanUrung(k);
    t6Lapor(k, `${e.kode} tidak dapat diurungkan dari sini - pakai "Lihat riwayat perubahan".`, true);
    return;
  }
  const nilai = t6NilaiSimpan(e.sebelum);
  t6Lapor(k, `Mengurungkan ${e.kode}…`);
  const h = await t6SimpanNilai(k, e.kode, nilai, "diurungkan", e.sesudah, e.nama);
  if (!h.ok) {
    t6Lapor(k, `Urungkan ${e.kode} gagal: ${h.pesan}`, true);
    return;
  }
  t.urung.pop();
  t.ulang.push(e);
  t6SegarkanUrung(k);
  t6Lapor(k, `${e.kode} dikembalikan ke isi sebelumnya. Ctrl+Y mengulanginya.`);
}

async function t6Ulangi(k) {
  const t = t6TumpukanDari(k.perkaraId);
  const e = t.ulang[t.ulang.length - 1];
  if (!e) {
    t6Lapor(k, "Tidak ada yang dapat diulangi.");
    return;
  }
  const nilai = t6NilaiSimpan(e.sesudah);
  t6Lapor(k, `Mengulangi ${e.kode}…`);
  const h = await t6SimpanNilai(k, e.kode, nilai, "diulang", e.sebelum, e.nama);
  if (!h.ok) {
    t6Lapor(k, `Ulangi ${e.kode} gagal: ${h.pesan}`, true);
    return;
  }
  t.ulang.pop();
  t.urung.push(e);
  t6SegarkanUrung(k);
  t6Lapor(k, `${e.kode} diulang.`);
}

function t6SegarkanUrung(k) {
  if (!k.tombolUrung) return;
  const t = t6TumpukanDari(k.perkaraId);
  const u = t.urung[t.urung.length - 1];
  const g = t.ulang[t.ulang.length - 1];
  k.tombolUrung.disabled = !u;
  k.tombolUlang.disabled = !g;
  k.tombolUrung.title = u ? `Urungkan ${u.kode} ${u.nama || ""} (Ctrl+Z) - menulis isi sebelumnya ke ABT` : "Belum ada suntingan untuk diurungkan (Ctrl+Z)";
  k.tombolUlang.title = g ? `Ulangi ${g.kode} ${g.nama || ""} (Ctrl+Y)` : "Tidak ada yang dapat diulangi (Ctrl+Y)";
}

// ─── Bagian unggah: centang rapi (abt-3/D4), wajib (abt-17), kaki (D14) ─────

function t6OpsiUnggah(k) {
  const c = Array.from(k.unggah.querySelectorAll("label.aleta-abt-centang-baris input[type=checkbox]"));
  // Urutan pemasangan di bagianUnggahSatuAbt: draf, anonim, unggah, unduh.
  return { draf: Boolean(c[0] && c[0].checked), anonim: Boolean(c[1] && c[1].checked), unggah: Boolean(c[2] && c[2].checked), unduh: Boolean(c[3] && c[3].checked), centang: c };
}

function t6KalimatAkanTerjadi(o) {
  const langkah = [];
  if (o.draf) langkah.push("simpan draf ke ALETA");
  const anonim = o.anonim && (o.unggah || o.unduh);
  if (anonim) langkah.push("buat anonim");
  if (o.unggah) langkah.push(anonim ? "unggah putusan dan anonimnya ke SIPP" : "unggah putusan ke SIPP");
  if (o.unduh) langkah.push(`unduh RTF, PDF${anonim ? ", dan anonim" : ""}`);
  const sisa = [];
  if (!o.unduh) sisa.push("Tidak ada berkas yang diunduh.");
  if (o.anonim && !anonim) sisa.push("Anonim tidak dibuat - tidak diunggah maupun diunduh.");
  if (!langkah.length) return "Yang akan terjadi bila ditekan: hanya RTF dibaca dari ABT - tidak ada yang disimpan, diunggah, atau diunduh.";
  return `Yang akan terjadi bila ditekan: ${langkah.join(", ")}. ${sisa.join(" ")}`.trim();
}

function t6RingkasPilihan(o) {
  const x = [];
  if (o.draf) x.push("Simpan draf");
  if (o.anonim) x.push("Anonim");
  if (o.unggah) x.push("Unggah ke SIPP");
  if (o.unduh) x.push("Unduh");
  return x.length ? x.join(" · ") : "tanpa pilihan";
}

function t6TataUnggah(k) {
  const kotak = k.unggah;
  const tombol = kotak.querySelector("button.aleta-abt-tombol");
  const o = t6OpsiUnggah(k);
  if (t6Pakai(k, "abt-3")) {
    kotak.setAttribute("data-t6-susun", "ya");
    const kalimat = t6El("div", "aleta-t6-akan-terjadi");
    kotak.insertBefore(kalimat, tombol);
    const segar = () => {
      kalimat.textContent = t6KalimatAkanTerjadi(t6OpsiUnggah(k));
    };
    for (const c of o.centang) c.addEventListener("change", segar);
    segar();
  }
  if (t6Nyala("abt-26")) {
    kotak.insertBefore(
      t6El("div", "aleta-t6-lembut aleta-t6-info-sumber", "Sebelum unggah, anonimnya diperiksa: NIK, nama pihak, dan alamat yang masih utuh ditunjukkan letaknya dan diminta konfirmasi."),
      tombol
    );
  }
  if (t6Nyala("abt-17")) {
    k.wajibUnggah = t6El("div", "aleta-t6-wajib-dekat");
    k.wajibUnggah.hidden = true;
    kotak.insertBefore(k.wajibUnggah, tombol);
  }
  if (!k.modern || !tombol) return;
  // D14 dan D4: bagian unggah pindah ke ujung isi panel ("Opsi Kerjakan"),
  // dan tombol utamanya berdiri di kaki panel yang lengket. Tombol di kaki
  // MENEKAN tombol lama - satu jalur kerja, satu penjagaan.
  kotak.classList.add("aleta-t6-opsi-kerjakan");
  k.isi.appendChild(kotak);
  if (!k.kaki) return;
  const utama = t6El("div", "aleta-t6-kaki-utama");
  const ringkas = t6El("span", "aleta-t6-kaki-ringkas");
  const opsi = t6Tombol("Opsi ▾", "Lihat pilihan Kerjakan: draf, anonim, unggah, unduh", "aleta-t6-kecil");
  opsi.addEventListener("click", () => {
    try {
      kotak.scrollIntoView({ block: "nearest" });
    } catch {
      /* tanpa gulir */
    }
    const pertama = t6OpsiUnggah(k).centang[0];
    if (pertama) pertama.focus();
  });
  const kerjakan = t6Tombol("Kerjakan perkara ini", "", "aleta-t6-utama");
  kerjakan.addEventListener("click", () => {
    // 1.183.0: bagian Unggah yang terkunci (blangko belum dikenali) tidak ditekan dari kaki.
    if (!tombol.disabled && !a3Terkunci(kotak)) tombol.click();
  });
  k.kakiWajib = t6El("span", "aleta-t6-kaki-wajib");
  k.kakiWajib.hidden = true;
  const segarKaki = () => {
    const pilihan = t6OpsiUnggah(k);
    ringkas.textContent = t6RingkasPilihan(pilihan);
    kerjakan.title = t6KalimatAkanTerjadi(pilihan);
    kerjakan.disabled = tombol.disabled || a3Terkunci(kotak);
    // 1.183.0: kaki ikut tersembunyi selama bagian Unggah terkunci.
    if (utama.hidden !== a3Terkunci(kotak)) utama.hidden = a3Terkunci(kotak);
  };
  for (const c of o.centang) c.addEventListener("change", segarKaki);
  const p = new MutationObserver(segarKaki);
  p.observe(tombol, { attributes: true, attributeFilter: ["disabled"] });
  k.pengamat.push(p);
  const pKunci = new MutationObserver(segarKaki);
  pKunci.observe(kotak, { attributes: true, attributeFilter: ["data-a3-jenis"] });
  k.pengamat.push(pKunci);
  segarKaki();
  utama.appendChild(ringkas);
  utama.appendChild(opsi);
  utama.appendChild(k.kakiWajib);
  utama.appendChild(kerjakan);
  k.kaki.insertBefore(utama, k.kaki.firstChild);
}

// ─── Pengamat: hiasan mengikuti apa yang digambar jalur lama ─────────────────

/**
 * Kartu usulan, borang dan penyunting keterangan saksi, kartu alasan, dan
 * kartu huruf digambar ulang oleh jalur lama tiap kali tombolnya ditekan -
 * dan penyunting saksi bahkan tiap kali satu baris digeser. Hiasan Tahap 6
 * karena itu dipasang oleh pengamat, bukan sekali: setiap gambar baru dihias
 * lagi, dan yang sudah berhias dikenali dari tandanya.
 *
 * Perubahan yang seluruhnya buatan blok ini diabaikan (t6MilikSendiri) -
 * tanpa itu hiasan memicu hiasan berikutnya tanpa akhir.
 */
function t6MilikSendiri(catatan) {
  return catatan.every((r) => {
    const t = r.target && r.target.nodeType === 1 ? r.target : r.target && r.target.parentElement;
    if (t && t.closest && t.closest(".aleta-t6")) return true;
    const simpul = [...Array.from(r.addedNodes || []), ...Array.from(r.removedNodes || [])];
    return simpul.length > 0 && simpul.every((n) => n.nodeType === 1 && n.classList.contains("aleta-t6"));
  });
}

function t6Amati(k, sasaran, pilihan, kerja, jedaMs) {
  if (!sasaran) return;
  let jam = 0;
  const p = new MutationObserver((catatan) => {
    if (t6MilikSendiri(catatan)) return;
    clearTimeout(jam);
    jam = setTimeout(() => {
      if (t6Keadaan === k) kerja();
    }, jedaMs);
  });
  p.observe(sasaran, pilihan);
  k.pengamat.push(p);
}

function t6PasangPengamat(k) {
  const daftar = { childList: true, subtree: true };
  t6Amati(k, k.wadah.usulan, daftar, () => t6HiasSemua(k), 0);
  t6Amati(k, k.wadah.sepihak, daftar, () => t6HiasSepihak(k), 0);
  t6Amati(k, k.wadah.huruf, daftar, () => t6HiasHuruf(k), 0);
  // Tabel variabel halaman ABT: kemajuan, pita galat, dan variabel wajib
  // disegarkan sesudah sunting di tempat dan penerapan usulan.
  const barisPertama = barisVariabel().values().next().value;
  const tabel = barisPertama && barisPertama.baris.closest("table");
  if (tabel) t6Amati(k, tabel, { childList: true, subtree: true, characterData: true }, () => t6SegarkanHalaman(k), 400);
  if (k.aksi && k.langkahTombol) {
    const p = new MutationObserver(() => t6SegarkanLangkah(k));
    p.observe(k.aksi, { attributes: true, subtree: true, attributeFilter: ["hidden"] });
    k.pengamat.push(p);
  }
  t6HiasSemua(k);
  t6HiasSepihak(k);
  t6HiasHuruf(k);
}

function t6HiasSemua(k) {
  if (t6Keadaan !== k) return;
  t6HiasUsulan(k);
  t6HiasSdg(k);
}

// ─── Kartu usulan: keyakinan, tidak berlaku, tabel, sematan, riwayat ────────

function t6KuasaProdeo(k) {
  const m = /Kuasa aktif:\s*(\d+)\.\s*Prodeo:\s*(ya|tidak)/i.exec(String((k.kabar && k.kabar.textContent) || ""));
  if (m) {
    k.kuasa = Number(m[1]);
    k.prodeo = m[2].toLowerCase() === "ya";
  }
}

/**
 * Kartu yang "memang tidak berlaku" (abt-2, D6): tanpa usulan, dan
 * variabelnya milik kuasa atau prodeo pada perkara yang - menurut SIPP -
 * tanpa kuasa atau bukan prodeo. Selama keadaan itu belum terbaca dari SIPP,
 * tidak ada yang dilipat: melipat berdasarkan tebakan menyembunyikan
 * variabel yang mungkin justru harus diisi.
 */
function t6TakBerlaku(k, kartu) {
  if (kartu.getAttribute("data-t6-yakin") !== "kosong") return false;
  if (!kartu.querySelector(".aleta-abt-usul .aleta-abt-isi-kosong")) return false;
  const nama = String((kartu.querySelector(".aleta-abt-kartu-kepala .aleta-abt-nama") || {}).textContent || "");
  if (/kuasa/i.test(nama) && k.kuasa === 0) return true;
  if (/prodeo/i.test(nama) && k.prodeo === false) return true;
  return false;
}

function t6HiasUsulan(k) {
  const w = k.wadah.usulan;
  if (!w) return;
  const kartu = t6KartuUsulan(k);
  if (!kartu.length) {
    if (k.segmen) k.segmen.hidden = true;
    return;
  }
  w.classList.add("aleta-t6-usulan");
  t6KuasaProdeo(k);
  const pakaiTakBerlaku = t6Pakai(k, "abt-2");
  for (const el of kartu) {
    if (!el.hasAttribute("data-t6-yakin")) el.setAttribute("data-t6-yakin", t6YakinKartu(el));
    if (pakaiTakBerlaku && t6TakBerlaku(k, el)) el.setAttribute("data-t6-tak-berlaku", "ya");
    if (el.hasAttribute("data-t6-hias")) continue;
    el.setAttribute("data-t6-hias", "ya");
    const kepala = el.querySelector(".aleta-abt-kartu-kepala");
    const kode = String((el.querySelector(".aleta-abt-kode") || {}).textContent || "").trim();
    if (!kepala || !kode) continue;
    const kutipan = Array.from(el.children).filter((c) => c.classList.contains("aleta-abt-kutipan"));
    if (k.modern && kutipan.length) {
      // D5: kutipan sumber dilipat di baris tabel - tetap satu klik.
      const sumber = t6Tombol(`sumber (${kutipan.length}) ▸`, "Tampilkan kalimat asal usulan ini", "aleta-t6-kecil aleta-t6-sumber");
      sumber.addEventListener("click", () => {
        const buka = el.toggleAttribute("data-t6-buka");
        sumber.textContent = `sumber (${kutipan.length}) ${buka ? "▾" : "▸"}`;
      });
      kepala.appendChild(sumber);
    }
    if (t6Nyala("abt-22")) kepala.appendChild(t6TombolSemat(k, kode));
    if (t6Nyala("abt-9")) kepala.appendChild(t6TombolRiwayatVar(k, kode, el));
  }
  // Baris ringkas untuk yang dilipat (abt-2) - dibuat ulang tiap gambar baru,
  // sebab gambarUsulan mengosongkan wadahnya.
  let lipat = Array.from(w.children).find((c) => c.classList.contains("aleta-t6-lipat-takberlaku"));
  // Hanya kartu wadah ini - usulan "Dari SIPP" membawa baris lipatnya sendiri.
  const takBerlaku = kartu.filter((el) => el.parentElement === w && el.getAttribute("data-t6-tak-berlaku") === "ya");
  if (pakaiTakBerlaku && takBerlaku.length) {
    if (!lipat) {
      lipat = t6El("div", "aleta-t6-lipat-takberlaku");
      w.insertBefore(lipat, w.firstChild);
    }
    lipat.textContent = "";
    const sebab = [];
    if (k.kuasa === 0) sebab.push("tanpa kuasa");
    if (k.prodeo === false) sebab.push("bukan prodeo");
    lipat.appendChild(
      t6El(
        "span",
        "",
        `${takBerlaku.length} variabel memang tidak berlaku untuk perkara ini (${sebab.join(", ")}): ${takBerlaku
          .map((el) => String((el.querySelector(".aleta-abt-kode") || {}).textContent || ""))
          .join(", ")}`
      )
    );
    const buka = t6Tombol(k.tampilTakBerlaku ? "sembunyikan" : "buka", "Tampilkan kartu yang dilipat", "aleta-t6-kecil");
    buka.addEventListener("click", () => {
      k.tampilTakBerlaku = !k.tampilTakBerlaku;
      t6HiasUsulan(k);
    });
    lipat.appendChild(buka);
  } else if (lipat) {
    lipat.remove();
  }
  t6TerapkanSaring(k);
}

// ─── abt-9: riwayat per variabel dengan tombol pulihkan ─────────────────────

function t6TombolRiwayatVar(k, kode, induk) {
  const b = t6Tombol("⟲", `Riwayat ${kode} - dengan tombol pulihkan`, "aleta-t6-kecil aleta-t6-riwayat-tombol");
  b.addEventListener("click", async () => {
    const ada = Array.from(induk.children).find((c) => c.classList.contains("aleta-t6-riwayat-var"));
    if (ada) {
      ada.remove();
      return;
    }
    const kotak = t6El("div", "aleta-t6-riwayat-var");
    kotak.appendChild(t6El("div", "aleta-t6-lembut", "Membaca riwayat…"));
    induk.appendChild(kotak);
    await t6GambarRiwayatVar(k, kode, kotak);
  });
  return b;
}

async function t6GambarRiwayatVar(k, kode, kotak) {
  let daftar = [];
  try {
    daftar = (await bacaRiwayat(k.perkaraId)).filter((x) => x && String(x.kode) === String(kode));
  } catch {
    daftar = [];
  }
  kotak.textContent = "";
  kotak.appendChild(t6El("div", "aleta-t6-riwayat-judul", `Riwayat ${kode}`));
  if (!daftar.length) {
    kotak.appendChild(t6El("div", "aleta-t6-lembut", "Belum ada perubahan yang tercatat untuk variabel ini."));
    return;
  }
  const dapat = t6DapatDitulisUlang(kode);
  const sekarang = nilaiVariabel(kode);
  const baris = (waktu, siapa, isi, catatan) => {
    const el = t6El("div", "aleta-t6-riwayat-baris");
    el.appendChild(t6El("span", "aleta-t6-lembut", `${waktu} · ${siapa} · `));
    el.appendChild(t6El("span", "", `"${t6Pendek(isi || "(kosong)", 120)}"`));
    if (t6Baku(isi) === t6Baku(sekarang)) {
      el.appendChild(t6El("span", "aleta-t6-lencana", "sekarang"));
    } else if (catatan) {
      el.appendChild(t6El("span", "aleta-t6-lembut", ` ${catatan}`));
    } else if (dapat) {
      const pulih = t6Tombol("pulihkan", `Tulis isi ini kembali ke ${kode} di ABT`, "aleta-t6-kecil");
      const kabar = t6El("span", "aleta-t6-lembut");
      pulih.addEventListener("click", async () => {
        pulih.disabled = true;
        kabar.textContent = "Menyimpan…";
        const h = await t6SimpanNilai(k, kode, t6NilaiSimpan(isi), "dipulihkan dari riwayat", sekarang, "");
        kabar.textContent = h.ok ? "Dipulihkan." : h.pesan;
        if (h.ok) setTimeout(() => void t6GambarRiwayatVar(k, kode, kotak), 300);
        else pulih.disabled = false;
      });
      el.appendChild(pulih);
      el.appendChild(kabar);
    }
    kotak.appendChild(el);
  };
  for (const x of daftar.slice(0, 10)) {
    const catatan = x.dariPeladen ? (x.dipotong ? "(dicatat dari peramban lain, isinya dipotong)" : "(dicatat dari peramban lain)") : "";
    baris(new Date(x.pada).toLocaleString("id-ID"), String(x.cara || ""), x.sesudah, catatan);
  }
  const tertua = daftar[Math.min(daftar.length, 10) - 1];
  if (tertua && !tertua.dariPeladen) baris("sebelum perubahan pertama", "isi awal", tertua.sebelum, "");
  if (!dapat) kotak.appendChild(t6El("div", "aleta-t6-lembut", `${kode} tidak dapat ditulis ulang dari sini - pakai "Lihat riwayat perubahan".`));
}

// ─── abt-6: tombol cepat untuk alasan yang belum terbukti ────────────────────

function t6HiasSepihak(k) {
  if (!t6Nyala("abt-6") || !k.wadah.sepihak) return;
  const blok = k.wadah.sepihak.querySelector(".aleta-alasan-kelompok.aleta-alasan-belum");
  if (!blok) return;
  const ditolak = new Set(Array.isArray(k.ditolak[k.perkaraId]) ? k.ditolak[k.perkaraId] : []);
  for (const butir of Array.from(blok.querySelectorAll(".aleta-alasan-butir"))) {
    if (butir.hasAttribute("data-t6-hias")) continue;
    butir.setAttribute("data-t6-hias", "ya");
    const nama = String((butir.querySelector(".aleta-alasan-nama") || {}).textContent || "").trim();
    if (!nama) continue;
    const alat = t6El("span", "aleta-t6-alasan-alat");
    const tanya = t6Tombol("+ pertanyaan saksi", `Buka penyunting keterangan saksi dengan alasan "${nama}" dicentang`, "aleta-t6-kecil aleta-t6-tanya-saksi");
    tanya.addEventListener("click", () => void t6TambahPertanyaan(k, nama));
    const tolak = t6Tombol("tandai ditolak + pertimbangan", `Salin kalimat pertimbangan penolakan dalil "${nama}"`, "aleta-t6-kecil");
    tolak.addEventListener("click", () => void t6TandaiDitolak(k, nama, butir));
    alat.appendChild(tanya);
    alat.appendChild(tolak);
    butir.appendChild(alat);
    if (ditolak.has(nama)) butir.classList.add("aleta-t6-ditolak");
  }
}

async function t6TambahPertanyaan(k, nama) {
  if (!t6BolehSdg(k)) {
    t6Lapor(k, "Penyusun keterangan saksi hanya untuk panitera sidang/PP.", true);
    return;
  }
  let form = k.wadah.usulan && k.wadah.usulan.querySelector(".aleta-sdg-form");
  if (!form) {
    if (!k.tombol.sdg || k.tombol.sdg.hidden) {
      t6Lapor(k, "Penyusun keterangan saksi tidak tersedia di blangko ini.", true);
      return;
    }
    k.tombol.sdg.click();
    form = await t6Tunggu(() => k.wadah.usulan && k.wadah.usulan.querySelector(".aleta-sdg-form"), 10000);
  }
  if (!form) {
    t6Lapor(k, "Penyunting keterangan saksi tidak terbuka - lihat pesan di atas.", true);
    return;
  }
  const sama = Array.from(form.children).find((c) => c.classList.contains("aleta-sdg-centang"));
  const centangSama = sama && sama.querySelector("input[type=checkbox]");
  if (centangSama && centangSama.checked) {
    centangSama.checked = false;
    centangSama.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const kotak = Array.from(form.children).find((c) => c.classList.contains("aleta-sdg-alasan"));
  const target = kotak
    ? Array.from(kotak.querySelectorAll("input[type=checkbox]")).find(
        (c) => t6Baku(c.value) === t6Baku(nama) || t6Baku(c.parentElement && c.parentElement.textContent) === t6Baku(nama)
      )
    : null;
  if (!target) {
    t6Lapor(k, `Alasan "${nama}" tidak ada di pilihan alasan saksi - pilih yang paling dekat.`, true);
    if (kotak) kotak.scrollIntoView({ block: "nearest" });
    return;
  }
  if (!target.checked) {
    target.checked = true;
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }
  try {
    target.scrollIntoView({ block: "center" });
  } catch {
    /* tanpa gulir */
  }
  // Membuka penyunting mengosongkan kartu alasan (perilaku tombol lama
  // "Susun keterangan saksi") - disebut, supaya tidak terbaca hilang.
  t6Lapor(
    k,
    `Alasan "${nama}" dicentang di penyunting keterangan saksi. Tekan "Susun keterangan para saksi" bila pilihannya sudah benar. ` +
      "Kartu alasan tertutup saat penyunting dibuka - \"Input ke ABT\" menampilkannya lagi."
  );
}

async function t6TandaiDitolak(k, nama, butir) {
  const pengaju = nilaiVariabel(VAR_PIHAK_LAWAN) || "Penggugat";
  const pelaku = nilaiVariabel(VAR_PIHAK_PELAKU) || "Tergugat";
  const kalimat =
    `Menimbang, bahwa dalil ${pengaju} mengenai ${nama} yang dilakukan ${pelaku} tidak dikuatkan oleh keterangan dua orang saksi, ` +
    "oleh karena itu dalil tersebut harus dinyatakan tidak terbukti dan dikesampingkan;";
  const tersalin = typeof alatSalin === "function" ? await alatSalin(kalimat) : false;
  const daftar = new Set(Array.isArray(k.ditolak[k.perkaraId]) ? k.ditolak[k.perkaraId] : []);
  daftar.add(nama);
  k.ditolak[k.perkaraId] = Array.from(daftar);
  t6Tulis({ [T6_KUNCI_DITOLAK]: k.ditolak });
  butir.classList.add("aleta-t6-ditolak");
  t6Lapor(
    k,
    tersalin
      ? `Kalimat pertimbangan penolakan "${nama}" disalin - tempel di variabel pertimbangan hukum lalu periksa. Tanda "ditolak" hanya tersimpan di peramban ini.`
      : `Papan klip menolak. Kalimatnya: ${kalimat}`
  );
}

// ─── abt-27 dan abt-18 di kartu huruf alasan ────────────────────────────────

function t6HiasHuruf(k) {
  const w = k.wadah.huruf;
  if (!w || (!t6Nyala("abt-27") && !t6Nyala("abt-18"))) return;
  for (const blok of Array.from(w.querySelectorAll(".aleta-abt-huruf"))) {
    const nama = blok.querySelector(".aleta-abt-huruf-nama");
    const m = /Huruf\s+([A-K])/i.exec(String((nama && nama.textContent) || ""));
    if (!m) continue;
    const huruf = m[1].toUpperCase();
    for (const lama of Array.from(blok.children).filter((c) => c.classList.contains("aleta-t6-komentar-sisip"))) lama.remove();
    if (t6Nyala("abt-18") && k.komentar && k.komentar.ok) {
      const kom = k.komentar.daftar.filter((x) => {
        const b = t6BacaBagian(x.bagian);
        return b.jenis === "alasan" && b.huruf === huruf;
      });
      if (kom.length) {
        const kotak = t6El("div", "aleta-t6-komentar-sisip");
        for (const x of kom) kotak.appendChild(t6KartuKomentar(k, x));
        blok.appendChild(kotak);
      }
    }
    if (t6Nyala("abt-27") && !Array.from(blok.children).some((c) => c.classList.contains("aleta-t6-pasal-sisip"))) {
      const saran = t6El("div", "aleta-t6-pasal-sisip");
      blok.appendChild(saran);
      // Templat pasal diminta saat DIBUKA, bukan saat panel lahir (kontrak permintaan
      // jaringan Tahap 6): UI Baru lewat ⓘ aturan, tampilan lain lewat tombolnya sendiri.
      const tAturan = blok.querySelector(".aleta-a1-info-aturan");
      const muat = () => {
        if (saran.getAttribute("data-t6-dimuat")) return;
        saran.setAttribute("data-t6-dimuat", "1");
        saran.textContent = "";
        saran.appendChild(t6El("div", "aleta-t6-lembut", "Saran dasar hukum - membaca…"));
        t6IsiPasalHuruf(k, saran, huruf);
      };
      if (k.pasal) {
        muat(); // templat sudah diminta lewat alat "Saran dasar hukum" - pakai yang tersimpan, tanpa permintaan baru
      } else if (tAturan) {
        tAturan.addEventListener("click", muat);
        if (blok.getAttribute("data-a1-aturan") === "buka") muat();
      } else {
        const tMuat = t6El("button", "aleta-t6-lembut", "Dasar hukum huruf " + huruf + " ›");
        tMuat.type = "button";
        tMuat.addEventListener("click", muat);
        saran.appendChild(tMuat);
      }
    }
  }
}

function t6IsiPasalHuruf(k, saran, huruf) {
      void t6MuatPasal(k).then((h) => {
        saran.textContent = "";
        if (!h.ok) {
          saran.appendChild(t6El("div", "aleta-t6-lembut", h.belumAda ? "Saran dasar hukum belum tersedia di server." : h.pesan));
          return;
        }
        const cocok = h.butir.filter((b) => String(b.kunci || "").toUpperCase() === huruf);
        if (!cocok.length) {
          saran.appendChild(t6El("div", "aleta-t6-lembut", `Belum ada templat pasal untuk huruf ${huruf}.`));
          return;
        }
        for (const b of cocok) saran.appendChild(t6KartuPasal(k, b));
      });
}

// ─── Borang dan penyunting keterangan saksi ─────────────────────────────────

function t6HiasSdg(k) {
  const w = k.wadah.usulan;
  if (!w) return;
  const form = w.querySelector(".aleta-sdg-form");
  if (form) t6HiasFormSdg(k, form);
  for (const hasil of Array.from(w.querySelectorAll(".aleta-sdg-hasil"))) t6HiasHasilSdg(k, hasil);
}

/** Alasan yang kata kuncinya terbaca di posita - tanda "G" (perkiraan). */
function t6DidalilkanPosita(label, posita) {
  if (!posita) return false;
  for (const [polaLabel, polaPosita] of T6_KATA_GUGATAN) {
    if (polaLabel.test(label)) return polaPosita.test(posita);
  }
  return false;
}

/**
 * abt-8 / D11: kotak centang alasan dikelompokkan. Labelnya DIPINDAH ke dalam
 * kelompok - kotak centang yang sama, sehingga penyusun lama tetap membaca
 * pilihannya lewat rujukan yang sudah dipegangnya.
 */
function t6KelompokkanAlasan(kotak, posita) {
  if (kotak.hasAttribute("data-t6-kelompok")) return;
  const label = Array.from(kotak.children).filter((c) => c.tagName === "LABEL" && c.classList.contains("aleta-sdg-centang"));
  if (label.length < 4) return;
  kotak.setAttribute("data-t6-kelompok", "ya");
  const kelompok = new Map();
  for (const [nama] of T6_KELOMPOK_ALASAN) kelompok.set(nama, []);
  kelompok.set("Lainnya", []);
  for (const l of label) {
    const teks = String(l.textContent || "");
    const cocok = T6_KELOMPOK_ALASAN.find(([, pola]) => pola.test(teks));
    kelompok.get(cocok ? cocok[0] : "Lainnya").push(l);
    if (t6DidalilkanPosita(teks, posita)) {
      const g = t6El("span", "aleta-t6-tanda-g", "G");
      g.title = "Kata kuncinya terbaca di posita (5125) - perkiraan dari kata, periksa dalilnya sendiri.";
      l.appendChild(g);
    }
  }
  for (const [nama, isi] of kelompok) {
    if (!isi.length) continue;
    const blok = t6El("div", "aleta-t6-kelompok-alasan");
    blok.appendChild(t6El("div", "aleta-t6-kelompok-judul", nama));
    const deret = t6El("div", "aleta-t6-kelompok-deret");
    for (const l of isi) deret.appendChild(l);
    blok.appendChild(deret);
    kotak.appendChild(blok);
  }
}

// ─── Butir 12 & 13 (6 Okt 2026): modus "Hanya sebagian" dan urutan modus ───

/** Urutan label asli tiap kotak centang - dipakai saat dikelompokkan ulang. */
const t6UrutanLabelAlasan = new WeakMap();

/**
 * Butir 12: kotak centang alasan modus "Hanya sebagian alasan yang ia
 * ketahui". Yang tampil langsung hanya alasan yang SESUAI POSITA - sumber yang
 * sama dengan "Alasan yang dipakai: ..." (bot alasanDariPosita, lewat sumber
 * 'alasan-posita'); alasan lain di bawahnya dalam bagian terlipat "Lainnya (di
 * luar posita)". Kotak centangnya tetap yang SAMA (dipindah, tidak disalin),
 * jadi penyusun lama membaca pilihannya lewat rujukan yang sudah dipegangnya.
 * Posita tidak terbaca (atau tidak satu pun alasan cocok) = semua tampil,
 * berkelompok seperti sebelumnya.
 *
 * @param {Set<string>|null} sesuai kunci alasan yang terbaca dari posita
 */
function t6KelompokkanAlasanSaksi(kotak, posita, sesuai) {
  const label = Array.from(kotak.querySelectorAll("label.aleta-sdg-centang"));
  if (label.length < 4) return;
  if (!t6UrutanLabelAlasan.has(kotak)) t6UrutanLabelAlasan.set(kotak, label.slice());
  const urut = t6UrutanLabelAlasan.get(kotak).filter((l) => kotak.contains(l));
  const nilai = (l) => {
    const c = l.querySelector("input[type=checkbox]");
    return c ? String(c.value) : "";
  };
  const pakaiPosita = Boolean(sesuai && sesuai.size && urut.some((l) => sesuai.has(nilai(l))));
  const keadaan = pakaiPosita ? `posita:${[...sesuai].sort().join("|")}` : "ya";
  if (kotak.getAttribute("data-t6-kelompok") === keadaan) return;
  // Susunan sebelumnya dibongkar; label kembali ke kotaknya dalam urutan asli.
  for (const lama of Array.from(kotak.children).filter((c) => c.classList.contains("aleta-t6"))) {
    for (const l of Array.from(lama.querySelectorAll("label.aleta-sdg-centang"))) kotak.appendChild(l);
    lama.remove();
  }
  for (const l of urut) kotak.appendChild(l);
  kotak.setAttribute("data-t6-kelompok", keadaan);

  const blokKelompok = (daftar) => {
    const hasil = [];
    const kelompok = new Map();
    for (const [nama] of T6_KELOMPOK_ALASAN) kelompok.set(nama, []);
    kelompok.set("Lainnya", []);
    for (const l of daftar) {
      const teks = String(l.textContent || "");
      const cocok = T6_KELOMPOK_ALASAN.find(([, pola]) => pola.test(teks));
      kelompok.get(cocok ? cocok[0] : "Lainnya").push(l);
      if (!l.querySelector(".aleta-t6-tanda-g") && t6DidalilkanPosita(teks, posita)) {
        const g = t6El("span", "aleta-t6-tanda-g", "G");
        g.title = "Kata kuncinya terbaca di posita (5125) - perkiraan dari kata, periksa dalilnya sendiri.";
        l.appendChild(g);
      }
    }
    for (const [nama, isi] of kelompok) {
      if (!isi.length) continue;
      const blok = t6El("div", "aleta-t6-kelompok-alasan");
      blok.appendChild(t6El("div", "aleta-t6-kelompok-judul", nama));
      const deret = t6El("div", "aleta-t6-kelompok-deret");
      for (const l of isi) deret.appendChild(l);
      blok.appendChild(deret);
      hasil.push(blok);
    }
    return hasil;
  };

  if (!pakaiPosita) {
    for (const blok of blokKelompok(urut)) kotak.appendChild(blok);
    return;
  }
  const dalam = urut.filter((l) => sesuai.has(nilai(l)));
  const luar = urut.filter((l) => !sesuai.has(nilai(l)));
  const kepala = t6El("div", "aleta-t6-alasan-posita-kepala", `Sesuai posita (${dalam.length})`);
  kepala.title = "Alasan yang terbaca dari posita perkara ini - sumber yang sama dengan \"Alasan yang dipakai\" saat keterangan disusun.";
  kotak.appendChild(kepala);
  for (const blok of blokKelompok(dalam)) kotak.appendChild(blok);
  if (luar.length) {
    const lain = document.createElement("details");
    lain.className = "aleta-t6 aleta-t6-alasan-lain";
    // Yang sudah dicentang tidak boleh tersembunyi di balik lipatan.
    lain.open = luar.some((l) => {
      const c = l.querySelector("input[type=checkbox]");
      return c && c.checked;
    });
    lain.appendChild(t6El("summary", "", `Lainnya (di luar posita) (${luar.length})`));
    for (const blok of blokKelompok(luar)) lain.appendChild(blok);
    kotak.appendChild(lain);
  }
}

/**
 * Alasan dari posita perkara ini - diminta SEKALI per panel (sumber
 * 'alasan-posita'). Selama belum datang, atau gagal (portal/bot lama, mode
 * coba), kotak centang tampil seperti sebelumnya: semua alasan.
 */
function t6MuatAlasanPosita(k) {
  if (k.alasanPosita) return;
  k.alasanPosita = { keadaan: "memuat", sesuai: null };
  void (async () => {
    try {
      const isi = await mintaUsulan({
        nomorPerkara: nomorPerkaraAbt(),
        sumber: "alasan-posita",
        posita: t6TeksVariabel(barisVariabel(), VAR_POSITA),
      });
      const ap = isi && isi.alasanPosita;
      k.alasanPosita =
        ap && ap.ok && Array.isArray(ap.alasan)
          ? { keadaan: "siap", sesuai: new Set(ap.alasan.map(String)), asal: String(ap.asalPosita || "") }
          : { keadaan: "gagal", sesuai: null };
    } catch {
      k.alasanPosita = { keadaan: "gagal", sesuai: null };
    }
    if (t6Keadaan === k) t6HiasSdg(k);
  })();
}

/**
 * Butir 13: "Tidak tahu pertengkarannya, hanya tahu sudah pisah" dipindah
 * TEPAT SESUDAH "Tahu berselisih & berpisah, tidak tahu sebabnya" - keduanya
 * saksi yang tahu pisahnya, dan berdampingan supaya bedanya terbaca sekilas.
 * Hanya urutan opsinya yang berubah; nilai dan pilihan yang sudah dibuat tetap.
 */
function t6UrutkanModusSdg(form) {
  for (const pilih of Array.from(form.querySelectorAll(".aleta-sdg-modus select"))) {
    const tahuPisah = pilih.querySelector('option[value="tahu-pisah"]');
    const tidakTahu = pilih.querySelector('option[value="tidak-tahu"]');
    if (!tahuPisah || !tidakTahu || tidakTahu.nextElementSibling === tahuPisah) continue;
    const nilaiSebelum = pilih.value;
    pilih.insertBefore(tahuPisah, tidakTahu.nextElementSibling);
    pilih.value = nilaiSebelum;
  }
}

function t6HiasFormSdg(k, form) {
  if (t6Pakai(k, "abt-8")) {
    const posita = t6TeksVariabel(barisVariabel(), VAR_POSITA);
    t6UrutkanModusSdg(form);
    t6MuatAlasanPosita(k);
    const sesuai = k.alasanPosita && k.alasanPosita.keadaan === "siap" ? k.alasanPosita.sesuai : null;
    for (const kotak of Array.from(form.querySelectorAll(".aleta-sdg-alasan"))) {
      if (kotak.classList.contains("aleta-sdg-alasan-saksi")) t6KelompokkanAlasanSaksi(kotak, posita, sesuai);
      else t6KelompokkanAlasan(kotak, posita);
    }
  }
  if (form.hasAttribute("data-t6-hias")) return;
  form.setAttribute("data-t6-hias", "ya");
  if (t6Nyala("abt-14")) {
    form.insertBefore(
      t6El(
        "div",
        "aleta-t6-belum-tersedia",
        "Salin dari perkara serupa yang sudah putus: belum tersedia - server belum punya sumber keterangan saksi perkara serupa. Tidak ada yang disalin."
      ),
      form.firstChild
    );
  }
}

function t6KolomSaksi(hasil) {
  return Array.from(hasil.querySelectorAll(".aleta-sdg-dua > .aleta-sdg-kolom")).map((kolom) => {
    const judul = kolom.querySelector(".aleta-sdg-judul");
    const teks = judul ? String(judul.firstChild && judul.firstChild.nodeType === 3 ? judul.firstChild.textContent : judul.textContent) : "";
    const m = /Saksi\s+(\d+)\s+([PT])/i.exec(teks);
    return {
      kolom,
      judul: teks.trim(),
      ke: m ? Number(m[1]) : 0,
      pihak: m ? m[2].toUpperCase() : "P",
      baris: Array.from(kolom.querySelectorAll(".aleta-sdg-baris")),
    };
  });
}

function t6HiasHasilSdg(k, hasil) {
  if (!hasil.hasAttribute("data-t6-hias")) {
    hasil.setAttribute("data-t6-hias", "ya");
    const alat = t6El("div", "aleta-t6-sdg-alat");
    // Butir 20 (30 Sep): yang dipakai tiap kali berdiri di depan; yang
    // jarang - templat pribadi, catatan fitur yang belum tersedia - dilipat
    // di "Lainnya". Tidak ada yang dibuang.
    const lain = document.createElement("details");
    lain.className = "aleta-t6 aleta-t6-sdg-lainnya";
    lain.appendChild(t6El("summary", "", "Lainnya"));
    const isiLain = t6El("div", "aleta-t6-sdg-lainnya-isi");
    lain.appendChild(isiLain);
    if (k.modern) {
      const penuh = t6Tombol("⤢ Layar penuh", "Keterangan para saksi berdampingan di layar penuh, dengan daftar pertanyaan", "aleta-t6-kecil");
      penuh.addEventListener("click", () => {
        const nyala = hasil.classList.toggle("aleta-t6-penuh");
        penuh.textContent = nyala ? "⤡ Keluar layar penuh" : "⤢ Layar penuh";
        t6GambarNavSdg(k, hasil);
        t6TumbuhkanSemua(hasil);
      });
      alat.appendChild(penuh);
    }
    if (t6Nyala("abt-16")) {
      const sidang = t6Tombol("▶ Mode sidang", "Satu pertanyaan per layar, huruf besar - ketik jawaban sambil saksi berbicara", "aleta-t6-kecil");
      sidang.addEventListener("click", () => t6MulaiModeSidang(k, hasil));
      alat.appendChild(sidang);
    }
    if (t6Nyala("abt-28")) isiLain.appendChild(t6AlatTemplatPribadi(k, hasil));
    if (t6Nyala("abt-29")) {
      const status = t6El("span", "aleta-t6-lembut aleta-t6-draf-status", k.drafPada ? `● tersimpan otomatis ${t6Jam(k.drafPada, true)} · tiap 30 detik` : "● tersimpan otomatis tiap 30 detik");
      alat.appendChild(status);
      if (k.draf[t6KunciDraf(k)]) {
        const pulih = t6Tombol("Pulihkan draf", "Isi penyunting ini dengan draf yang tersimpan di peramban", "aleta-t6-kecil");
        const kabar = t6El("span", "aleta-t6-lembut");
        pulih.addEventListener("click", () => {
          kabar.textContent = t6PulihkanDraf(k, hasil);
        });
        alat.appendChild(pulih);
        alat.appendChild(kabar);
      }
    }
    if (t6Nyala("abt-20")) {
      isiLain.appendChild(
        t6El(
          "div",
          "aleta-t6-belum-tersedia",
          "Kirim ke BAS SIPP: belum tersedia - ALETA belum punya jalur tulis berita acara ke SIPP yang aman. Keterangan disimpan ke ABT saja."
        )
      );
    }
    if (isiLain.childElementCount) alat.appendChild(lain);
    if (alat.childElementCount) {
      const tata = hasil.querySelector(".aleta-sdg-tata");
      hasil.insertBefore(alat, tata || hasil.firstChild);
    }
    if (k.modern) {
      const nav = t6El("div", "aleta-t6-sdg-nav");
      hasil.insertBefore(nav, hasil.firstChild);
    }
    // Butir 28 bagian B: berapa jawaban yang sungguh siap, tepat di atas
    // tombol simpan - dan penjaga yang bertanya sebelum menyimpan.
    const simpan = t6TombolSimpanSdg(hasil);
    const siap = t6El("div", "aleta-t6-sdg-siap");
    siap.setAttribute("role", "status");
    if (simpan) hasil.insertBefore(siap, simpan);
    else hasil.appendChild(siap);
    hasil.addEventListener("click", (e) => t6SaatKlikSimpanSdg(k, hasil, e), true);
    // Butir 23: berdampingan = kisi baris-per-pertanyaan (lihat CSS subgrid).
    const dua = hasil.querySelector(".aleta-sdg-dua");
    if (dua) {
      dua.setAttribute("data-t6-sejajar", "ya");
      // Butir 22: tinggi kotak mengikuti isinya. Peramban yang belum
      // mengenal field-sizing diukur ulang saat lebar kolomnya berubah.
      if (!t6KotakTumbuhSendiri() && typeof ResizeObserver === "function") {
        let bingkai = 0;
        const ro = new ResizeObserver(() => {
          cancelAnimationFrame(bingkai);
          bingkai = requestAnimationFrame(() => t6TumbuhkanSemua(hasil));
        });
        ro.observe(dua);
        k.pengamat.push(ro);
      }
    }
  }
  t6HiasBarisSdg(k, hasil);
}
/** Daftar pertanyaan di kiri layar penuh (D9). */
function t6GambarNavSdg(k, hasil) {
  const nav = Array.from(hasil.children).find((c) => c.classList.contains("aleta-t6-sdg-nav"));
  if (!nav) return;
  nav.textContent = "";
  if (!hasil.classList.contains("aleta-t6-penuh")) return;
  const kolom = t6KolomSaksi(hasil);
  const pertama = kolom[0];
  if (!pertama) return;
  nav.appendChild(t6El("div", "aleta-t6-nav-judul", `${pertama.baris.length} pertanyaan`));
  pertama.baris.forEach((b, i) => {
    const t = t6Tombol("", "Tampilkan pertanyaan ini pada semua saksi", "aleta-t6-nav-butir");
    t.appendChild(t6El("span", "aleta-t6-kode", `${i + 1}.`));
    t.appendChild(t6El("span", "", t6Pendek((b.querySelector(".aleta-sdg-tanya") || {}).textContent, 48)));
    if (b.hasAttribute("data-t6-beda")) t.appendChild(t6El("span", "aleta-t6-lencana aleta-t6-lencana-beda", "beda"));
    if (b.querySelector(".aleta-sdg-varian-habis")) t.appendChild(t6El("span", "aleta-t6-lencana", "varian habis"));
    t.addEventListener("click", () => {
      for (const c of t6KolomSaksi(hasil)) {
        const sasaran = c.baris[i];
        if (!sasaran) continue;
        try {
          sasaran.scrollIntoView({ block: "center" });
        } catch {
          /* tanpa gulir */
        }
        sasaran.classList.add("aleta-t6-sorot");
        setTimeout(() => sasaran.classList.remove("aleta-t6-sorot"), 1500);
      }
    });
    nav.appendChild(t);
  });
}

function t6KataDari(teks) {
  return String(teks || "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [];
}

/**
 * abt-7 / D9: kata yang berbeda antara saksi dan saksi berikutnya, per nomor
 * pertanyaan. Kotak ketik tidak dapat mewarnai sebagian isinya, jadi bedanya
 * ditulis di bawah kotak itu sebagai deret kata bersorot.
 */
function t6HitungBeda(k, hasil) {
  const kolom = t6KolomSaksi(hasil);
  if (kolom.length < 2) return;
  kolom.forEach((c, ci) => {
    const lawan = kolom[(ci + 1) % kolom.length];
    c.baris.forEach((b, i) => {
      let garis = Array.from(b.children).find((x) => x.classList.contains("aleta-t6-beda"));
      const jawab = b.querySelector("textarea.aleta-sdg-jawab");
      const lawanJawab = lawan.baris[i] && lawan.baris[i].querySelector("textarea.aleta-sdg-jawab");
      if (!jawab || !lawanJawab) {
        if (garis) garis.remove();
        b.removeAttribute("data-t6-beda");
        return;
      }
      const kata = t6KataDari(jawab.value);
      const kataLawan = new Set(t6KataDari(lawanJawab.value));
      if (!garis) {
        garis = t6El("div", "aleta-t6-beda");
        b.appendChild(garis);
      }
      garis.textContent = "";
      if (!kata.length) {
        b.removeAttribute("data-t6-beda");
        return;
      }
      if (t6Baku(jawab.value) === t6Baku(lawanJawab.value)) {
        b.removeAttribute("data-t6-beda");
        garis.appendChild(t6El("span", "aleta-t6-lencana aleta-t6-lencana-sama", `sama persis dengan ${lawan.judul || "saksi berikutnya"}`));
        return;
      }
      const unik = Array.from(new Set(kata.filter((x) => !kataLawan.has(x))));
      if (!unik.length) {
        b.removeAttribute("data-t6-beda");
        return;
      }
      b.setAttribute("data-t6-beda", "ya");
      garis.appendChild(t6El("span", "aleta-t6-lembut", `beda dengan ${lawan.judul || "saksi berikutnya"}: `));
      for (const x of unik.slice(0, 12)) garis.appendChild(t6El("mark", "aleta-t6-sorot-kata", x));
    });
  });
}

function t6HiasBarisSdg(k, hasil) {
  const beda = t6Pakai(k, "abt-7");
  const kolom = t6KolomSaksi(hasil);
  let jam = 0;
  const hitungNanti = () => {
    clearTimeout(jam);
    jam = setTimeout(() => {
      if (t6Keadaan === k) t6HitungBeda(k, hasil);
    }, 250);
  };
  kolom.forEach((c, ki) => {
    c.baris.forEach((b, i) => {
      const baru = !b.hasAttribute("data-t6-hias");
      b.setAttribute("data-t6-hias", "ya");
      const jawab = b.querySelector("textarea.aleta-sdg-jawab");
      if (baru && beda && jawab) jawab.addEventListener("input", hitungNanti);
      if (baru && jawab) {
        // Butir 22 dan 28: tinggi mengikuti isi; tanda "belum terisi"
        // mengikuti ketikan.
        jawab.addEventListener("input", () => {
          if (t6Keadaan !== k) return;
          t6TumbuhkanKotak(jawab);
          t6TandaiBelum(hasil, b);
          t6SegarkanSiapSdg(hasil);
        });
        setTimeout(() => t6TumbuhkanKotak(jawab), 0);
      }
      if (baru && t6Pakai(k, "abt-7") && b.querySelector(".aleta-sdg-varian-habis")) {
        b.appendChild(
          t6El(
            "div",
            "aleta-t6-lembut aleta-t6-varian-ket aleta-t6-info-sumber",
            "Varian habis: semua bentuk kalimat untuk pertanyaan ini sudah terpakai, jadi bunyinya dapat sama dengan saksi lain."
          )
        );
      }
      if (baru && t6Nyala("abt-15") && jawab) {
        // Butir 20: ✎ duduk di baris pertanyaan, bukan sebaris sendiri.
        const alatBaris = b.querySelector(".aleta-sdg-alat");
        (alatBaris || b).appendChild(t6AlatVarian(jawab));
      }
      if (t6Nyala("abt-18")) t6LencanaKomentarBaris(k, b, c, i);
      t6TandaiBelum(hasil, b, ki, i);
    });
  });
  // Butir 23: tiap kolom saksi merentang baris kisi sebanyak kolom yang
  // terpanjang - pertanyaan bernomor sama pada saksi 1 dan 2 sebaris.
  const dua = hasil.querySelector(".aleta-sdg-dua");
  if (dua) {
    const n = String(Math.max(1, ...kolom.map((c) => c.kolom.children.length)));
    if (dua.style.getPropertyValue("--t6-baris") !== n) dua.style.setProperty("--t6-baris", n);
  }
  if (beda) t6HitungBeda(k, hasil);
  if (hasil.classList.contains("aleta-t6-penuh")) t6GambarNavSdg(k, hasil);
  t6SegarkanSiapSdg(hasil);
}

// ─── Butir 22: kotak keterangan saksi setinggi isinya ───────────────────────

/** field-sizing: content (Chrome 123+) menumbuhkan kotak tanpa bantuan skrip. */
function t6KotakTumbuhSendiri() {
  if (t6UkurSendiri === null) {
    try {
      t6UkurSendiri = typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("field-sizing", "content");
    } catch {
      t6UkurSendiri = false;
    }
  }
  return t6UkurSendiri;
}

function t6TumbuhkanKotak(ta) {
  if (!ta || !ta.isConnected || t6KotakTumbuhSendiri()) return;
  ta.style.height = "auto";
  const tinggi = ta.scrollHeight;
  // Panel yang diciutkan tidak punya tata letak (tinggi 0) - dibiarkan, dan
  // diukur ulang saat kolomnya kembali berukuran.
  if (tinggi > 0) ta.style.height = `${tinggi + 2}px`;
  else ta.style.removeProperty("height");
}

function t6TumbuhkanSemua(hasil) {
  for (const ta of Array.from(hasil.querySelectorAll("textarea.aleta-sdg-jawab"))) t6TumbuhkanKotak(ta);
}

// ─── Butir 28 bagian B: jawaban saksi yang belum terisi ────────────────────

/**
 * Jawaban yang BELUM terisi: kosong, hanya tanda baca ("...;", "…", "_"),
 * titik-titik templat blangko ("Tahun ....;"), atau token #0000# yang belum
 * terganti. Yang begini tidak dihitung siap - bunyinya ikut tercetak ke
 * berita acara apa adanya.
 */
function t6JawabKosong(teks) {
  const s = String(teks || "").replace(/\s+/g, " ").trim();
  if (!s) return true;
  if (!/[\p{L}\p{N}]/u.test(s)) return true;
  if (/\.{3,}|…|_{2,}/.test(s)) return true;
  if (/#\d{4}#/.test(s)) return true;
  return false;
}

/**
 * Isian yang dapat DITAWARKAN untuk satu jawaban kosong: variabel blangko
 * yang sepadan dengan pertanyaannya (T6_SUMBER_JAWAB, mis. 1268 Upaya Damai
 * Keluarga untuk "pernah diupayakan rukun"), dan jawaban saksi lain untuk
 * pertanyaan bernomor sama. Tidak ada yang diisikan sendiri.
 */
function t6TawaranJawab(hasil, b, ki, i) {
  const tanya = String((b.querySelector(".aleta-sdg-tanya") || {}).textContent || "");
  const tawaran = [];
  const peta = barisVariabel();
  for (const [pola, kode, nama] of T6_SUMBER_JAWAB) {
    if (!pola.test(tanya)) continue;
    const item = peta.get(kode);
    if (!item || keadaanNilai(item.nilai) !== "terisi") continue;
    tawaran.push({ label: `${kode} ${nama}`, isi: String(item.nilai).replace(/\s+/g, " ").trim(), cara: "sisip" });
  }
  if (ki !== undefined) {
    t6KolomSaksi(hasil).forEach((c, j) => {
      if (j === ki) return;
      const lain = c.baris[i] && c.baris[i].querySelector("textarea.aleta-sdg-jawab");
      if (lain && !t6JawabKosong(lain.value)) tawaran.push({ label: `${c.judul || `Saksi ${j + 1}`} no. ${i + 1}`, isi: lain.value.trim(), cara: "ganti" });
    });
  }
  // Perbaikan 2 Okt butir 8 (UI Baru): sumber lain yang SUDAH ada - usulan
  // bacaan Isi dari SIPP, lalu butir posita. Tidak ada yang diisikan sendiri.
  if (t6Modern()) {
    for (const t of a2TawaranTambahan(tanya, tawaran.length > 0)) if (!tawaran.some((x) => x.isi === t.isi)) tawaran.push(t);
    return tawaran.slice(0, 5);
  }
  return tawaran.slice(0, 4);
}

/** Menaruh isian tawaran ke kotaknya - lewat peristiwa input, sama dengan mengetik. */
function t6IsiJawab(jawab, t) {
  let nilai;
  if (t.cara === "ganti") {
    nilai = t.isi;
  } else {
    const potongan = t.isi.replace(/[;.\s]+$/, "");
    nilai = /\.{3,}|…|_{2,}/.test(jawab.value) ? jawab.value.replace(/\.{3,}|…|_{2,}/, potongan) : `${potongan};`;
    nilai = nilai.trim();
    nilai = nilai.charAt(0).toUpperCase() + nilai.slice(1);
  }
  jawab.value = nilai;
  jawab.dispatchEvent(new Event("input", { bubbles: true }));
  try {
    jawab.focus();
  } catch {
    /* fokus hanya kenyamanan */
  }
}

function t6TandaiBelum(hasil, b, ki, i) {
  const jawab = b.querySelector("textarea.aleta-sdg-jawab");
  const lama = Array.from(b.children).find((x) => x.classList.contains("aleta-t6-belum"));
  if (!jawab || !t6JawabKosong(jawab.value)) {
    b.removeAttribute("data-t6-belum");
    if (lama) lama.remove();
    if (t6Modern()) a2LepasBelum(hasil, b);
    return;
  }
  b.setAttribute("data-t6-belum", "ya");
  // Letak baris dibaca ulang bila pemanggilnya (ketikan) tidak membawanya.
  let kolom = ki;
  let nomor = i;
  if (kolom === undefined) {
    t6KolomSaksi(hasil).forEach((c, j) => {
      const n = c.baris.indexOf(b);
      if (n >= 0) {
        kolom = j;
        nomor = n;
      }
    });
  }
  const tawaran = t6TawaranJawab(hasil, b, kolom, nomor);
  const sidik = `${jawab.value}|${tawaran.map((t) => t.label).join(",")}`;
  if (lama && lama.getAttribute("data-t6-sidik") === sidik) return;
  if (lama) lama.remove();
  const kotak = t6El("div", "aleta-t6-belum");
  kotak.setAttribute("data-t6-sidik", sidik);
  kotak.appendChild(t6El("span", "aleta-t6-lencana aleta-t6-lencana-belum", "belum terisi"));
  if (tawaran.length) {
    kotak.appendChild(t6El("span", "aleta-t6-lembut", "isi dari:"));
    for (const t of tawaran) {
      const tb = t6Tombol(t.label, `${t.cara === "ganti" ? "Salin jawaban ini" : "Sisipkan isi variabel ini"}: "${t6Pendek(t.isi, 160)}" - periksa lalu ubah bila perlu`, "aleta-t6-kecil aleta-t6-tawaran");
      tb.addEventListener("click", () => t6IsiJawab(jawab, t));
      kotak.appendChild(tb);
    }
  } else {
    kotak.appendChild(t6El("span", "aleta-t6-lembut", "tidak ada sumber di blangko - isi dari keterangan saksi di persidangan."));
  }
  jawab.insertAdjacentElement("afterend", kotak);
  // Perbaikan 2 Okt butir 8 (UI Baru): sunting langsung + tanda "diisi di sidang".
  if (t6Modern()) a2HiasBelum(hasil, b, kotak, jawab);
}

function t6JawabBelum(hasil) {
  const daftar = [];
  for (const c of t6KolomSaksi(hasil)) {
    c.baris.forEach((b, i) => {
      if (!b.hasAttribute("data-t6-belum")) return;
      const tanya = String((b.querySelector(".aleta-sdg-tanya") || {}).textContent || "").trim();
      daftar.push({ saksi: c.judul || "Saksi", no: i + 1, tanya, baris: b });
    });
  }
  return daftar;
}

function t6SegarkanSiapSdg(hasil) {
  const el = Array.from(hasil.children).find((c) => c.classList.contains("aleta-t6-sdg-siap"));
  if (!el) return;
  const semua = hasil.querySelectorAll(".aleta-sdg-dua .aleta-sdg-baris textarea.aleta-sdg-jawab").length;
  const belum = t6JawabBelum(hasil).length;
  const teks = belum
    ? `${semua - belum} dari ${semua} jawaban siap · ${belum} belum terisi (bertanda "belum terisi") - lengkapi sebelum disimpan.`
    : `✓ ${semua} jawaban terisi.`;
  if (el.textContent !== teks) el.textContent = teks;
  el.classList.toggle("aleta-t6-sdg-siap-kurang", belum > 0);
  // Perbaikan 2 Okt butir 8 (UI Baru): jumlahnya juga di ATAS penyunting.
  if (t6Modern()) a2RingkasBelum(hasil);
}

/** Tombol "Simpan keterangan N saksi ke ABT" penyunting ini. */
function t6TombolSimpanSdg(hasil) {
  return Array.from(hasil.children).find((c) => c.tagName === "BUTTON" && /^Simpan keterangan/.test(c.textContent || "")) || null;
}

/** Kotak kabar penyunting berkata tersimpan (bukan gagal). */
function t6SdgTersimpan(hasil) {
  const simpan = t6TombolSimpanSdg(hasil);
  const kabar = simpan && simpan.nextElementSibling;
  if (!kabar || kabar.classList.contains("aleta-abt-gagal")) return false;
  return /tersimpan di ABT|^Tersimpan\./.test(String(kabar.textContent || "").trim());
}

/**
 * Klik simpan penyunting, fase tangkap pada penyuntingnya - mendahului
 * pendengar tombol itu sendiri. Masih ada jawaban yang belum terisi:
 * peringatan dengan konfirmasi "Sudah saya periksa", bukan penahanan.
 */
function t6SaatKlikSimpanSdg(k, hasil, e) {
  const t = e.target instanceof Element ? e.target.closest("button") : null;
  const simpan = t6TombolSimpanSdg(hasil);
  if (!t || t !== simpan || t6Keadaan !== k) return;
  if (t6SimpanLolos.has(hasil)) {
    t6SimpanLolos.delete(hasil);
    t6AmatiSimpanSdg(k, hasil);
    return;
  }
  const belum = t6JawabBelum(hasil);
  if (!belum.length) {
    t6AmatiSimpanSdg(k, hasil);
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
  void t6Dialog({
    judul: "Masih ada jawaban saksi yang belum terisi",
    isi: [
      t6DaftarDialog(
        `${belum.length} jawaban belum terisi:`,
        belum.slice(0, 15).map((x) => `${x.saksi} no. ${x.no}: ${t6Pendek(x.tanya, 90)}`)
      ),
      belum.length > 15 ? `… dan ${belum.length - 15} lagi.` : "",
      "Jawaban yang kosong tidak ikut tersimpan (barisnya dilewati); \"...\", \"_\", dan titik-titik templat tersimpan apa adanya dan ikut tercetak ke berita acara.",
    ],
    centang: "Sudah saya periksa",
    ya: "Tetap simpan",
    tidak: "Kembali mengisi",
  }).then((ya) => {
    if (t6Keadaan !== k) return;
    if (!ya) {
      const pertama = belum[0] && belum[0].baris.querySelector("textarea.aleta-sdg-jawab");
      if (pertama) {
        try {
          pertama.scrollIntoView({ block: "center" });
          pertama.focus();
        } catch {
          /* tanpa gulir */
        }
      }
      return;
    }
    t6SimpanLolos.add(hasil);
    simpan.click();
  });
}

/** Langkah "Susun saksi" selesai saat keterangannya tersimpan ke ABT. */
function t6AmatiSimpanSdg(k, hasil) {
  const simpan = t6TombolSimpanSdg(hasil);
  if (!simpan) return;
  void (async () => {
    await new Promise((r) => setTimeout(r, 30));
    const kabar = simpan.nextElementSibling;
    await t6Tunggu(() => !simpan.disabled && kabar && kabar.textContent.trim() && !/^Menyimpan/.test(kabar.textContent.trim()), 120000);
    if (t6Keadaan !== k) return;
    const ok = t6SdgTersimpan(hasil);
    k.langkah.set("sdg", ok ? "selesai" : "gagal");
    if (ok) k.langkahSebab.set("sdg", "keterangan saksi tersimpan ke ABT");
    t6SegarkanLangkah(k);
  })();
}

// ─── abt-18: komentar hakim di baris keterangan saksi ───────────────────────

function t6LencanaKomentarBaris(k, baris, kolom, i) {
  // Dibuang lalu digambar ulang: komentar dapat berubah (ditandai selesai)
  // tanpa barisnya digambar ulang.
  for (const lama of Array.from(baris.querySelectorAll(".aleta-t6-komentar-baris"))) lama.remove();
  if (!k.komentar || !k.komentar.ok) return;
  const kom = k.komentar.daftar.filter((x) => {
    const b = t6BacaBagian(x.bagian);
    return b.jenis === "saksi" && b.pihak === kolom.pihak && b.ke === kolom.ke && b.no === i + 1;
  });
  if (!kom.length) return;
  const belum = kom.filter((x) => !x.selesai).length;
  const alat = baris.querySelector(".aleta-sdg-alat") || baris;
  const lencana = t6Tombol(
    belum ? `komentar hakim${kom.length > 1 ? ` (${kom.length})` : ""}` : "komentar hakim ✓",
    kom.map((x) => `${(x.penulis && x.penulis.nama) || "hakim"}: ${x.isi}`).join("\n"),
    `aleta-t6-lencana-hakim aleta-t6-komentar-baris${belum ? "" : " aleta-t6-selesai"}`
  );
  lencana.addEventListener("click", () => {
    const ada = Array.from(baris.children).find((c) => c.classList.contains("aleta-t6-komentar-sisip"));
    if (ada) {
      ada.remove();
      return;
    }
    const kotak = t6El("div", "aleta-t6-komentar-sisip aleta-t6-komentar-baris");
    for (const x of kom) kotak.appendChild(t6KartuKomentar(k, x));
    baris.appendChild(kotak);
  });
  alat.appendChild(lencana);
}

// ─── abt-15: pembuat varian kalimat ─────────────────────────────────────────

function t6VarianKalimat(teks) {
  const asal = String(teks || "");
  const frasa = [];
  for (const kelompok of T6_SEPADAN) for (const f of kelompok) frasa.push({ f, kelompok });
  frasa.sort((a, b) => b.f.length - a.f.length);
  const pola = new RegExp(`\\b(${frasa.map((x) => t6Lolos(x.f)).join("|")})\\b`, "gi");
  if (!pola.test(asal)) return [];
  const hasil = [];
  for (let v = 1; v <= 3; v += 1) {
    pola.lastIndex = 0;
    const baru = asal.replace(pola, (cocok) => {
      const x = frasa.find((y) => y.f === cocok.toLowerCase());
      if (!x) return cocok;
      const ganti = x.kelompok[(x.kelompok.indexOf(x.f) + v) % x.kelompok.length];
      return cocok[0] === cocok[0].toUpperCase() ? ganti[0].toUpperCase() + ganti.slice(1) : ganti;
    });
    if (baru !== asal && !hasil.includes(baru)) hasil.push(baru);
  }
  return hasil;
}

function t6AlatVarian(jawab) {
  const wadah = t6El("div", "aleta-t6-varian");
  const b = t6Tombol("✎", "Buat varian - susun kalimat lain yang sama artinya; dipilih, lalu boleh diubah", "aleta-t6-kecil");
  b.setAttribute("aria-label", "Buat varian");
  const pilihan = t6El("div", "aleta-t6-varian-pilihan");
  b.addEventListener("click", () => {
    pilihan.textContent = "";
    const varian = t6VarianKalimat(jawab.value);
    if (!varian.length) {
      pilihan.appendChild(t6El("span", "aleta-t6-lembut", "Tidak ada varian otomatis untuk kalimat ini - ubah sendiri."));
      return;
    }
    for (const v of varian) {
      const opsi = t6Tombol(`"${t6Pendek(v, 140)}"`, "Pakai kalimat ini", "aleta-t6-varian-opsi");
      opsi.addEventListener("click", () => {
        jawab.value = v;
        jawab.dispatchEvent(new Event("input", { bubbles: true }));
        pilihan.textContent = "";
      });
      pilihan.appendChild(opsi);
    }
  });
  wadah.appendChild(b);
  wadah.appendChild(pilihan);
  return wadah;
}

// ─── abt-28: templat pertanyaan pribadi (di peramban ini) ────────────────────

function t6AlatTemplatPribadi(k, hasil) {
  const jenis = k.jenis || "umum";
  const wadah = t6El("span", "aleta-t6-templat");
  const nama = document.createElement("input");
  nama.type = "text";
  nama.className = "aleta-t6 aleta-t6-templat-nama";
  nama.placeholder = "nama templat saya";
  const simpan = t6Tombol("☆ Simpan sebagai templat saya", `Pertanyaan saksi pertama disimpan sebagai templat untuk ${jenis} - di peramban ini`, "aleta-t6-kecil");
  const pilih = document.createElement("select");
  pilih.className = "aleta-t6 aleta-t6-templat-pilih";
  const pakai = t6Tombol("Pakai", "Ganti pertanyaan di penyunting dengan templat ini (jawaban tidak diubah)", "aleta-t6-kecil");
  const kabar = t6El("span", "aleta-t6-lembut");
  const segar = () => {
    pilih.textContent = "";
    const daftar = Array.isArray(k.templat[jenis]) ? k.templat[jenis] : [];
    const kosong = document.createElement("option");
    kosong.value = "";
    kosong.textContent = daftar.length ? "Templat saya ▾" : "belum ada templat saya";
    pilih.appendChild(kosong);
    daftar.forEach((t, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = `${t.nama} (${(t.tanya || []).length})`;
      pilih.appendChild(o);
    });
    pakai.disabled = !daftar.length;
  };
  simpan.addEventListener("click", () => {
    const kolom = t6KolomSaksi(hasil)[0];
    if (!kolom) return;
    const tanya = kolom.baris.map((b) => String((b.querySelector(".aleta-sdg-tanya") || {}).textContent || "").trim()).filter(Boolean);
    if (!tanya.length) {
      kabar.textContent = "Tidak ada pertanyaan untuk disimpan.";
      return;
    }
    const daftar = Array.isArray(k.templat[jenis]) ? k.templat[jenis] : [];
    const namaTemplat = nama.value.trim() || `Templat ${t6Jam(new Date().toISOString())}`;
    k.templat[jenis] = [{ nama: namaTemplat, dibuat: new Date().toISOString(), tanya }, ...daftar.filter((t) => t.nama !== namaTemplat)].slice(0, T6_BATAS_TEMPLAT);
    t6Tulis({ [T6_KUNCI_TEMPLAT]: k.templat });
    nama.value = "";
    kabar.textContent = `Tersimpan: "${namaTemplat}" (${tanya.length} pertanyaan) untuk ${jenis}, di peramban ini.`;
    segar();
  });
  pakai.addEventListener("click", () => {
    const daftar = Array.isArray(k.templat[jenis]) ? k.templat[jenis] : [];
    const t = daftar[Number(pilih.value)];
    if (!t) {
      kabar.textContent = "Pilih templatnya dahulu.";
      return;
    }
    let diganti = 0;
    let kurang = 0;
    for (const c of t6KolomSaksi(hasil)) {
      t.tanya.forEach((q, i) => {
        const b = c.baris[i];
        if (!b) {
          kurang += 1;
          return;
        }
        const el = b.querySelector(".aleta-sdg-tanya");
        if (!el) return;
        el.textContent = q;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        diganti += 1;
      });
    }
    kabar.textContent =
      `${diganti} pertanyaan diganti dari "${t.nama}". Jawaban tidak diubah.` +
      (kurang ? ` ${kurang} pertanyaan templat tidak punya baris - tambahkan dengan "+ Tambah keterangan".` : "");
  });
  segar();
  wadah.appendChild(nama);
  wadah.appendChild(simpan);
  wadah.appendChild(pilih);
  wadah.appendChild(pakai);
  wadah.appendChild(kabar);
  return wadah;
}

// ─── abt-16: mode sidang ────────────────────────────────────────────────────

/**
 * Satu pertanyaan per layar, huruf besar. Kotaknya TERIKAT ke kotak jawaban
 * penyunting: tiap ketikan diteruskan lewat peristiwa input yang sama dengan
 * mengetik langsung, jadi yang tersimpan ke ABT tetap lewat tombol simpan
 * penyunting - mode ini tidak menyimpan apa pun sendiri.
 */
function t6MulaiModeSidang(k, hasil) {
  for (const lama of Array.from(document.querySelectorAll(".aleta-t6-sidang"))) lama.remove();
  const layar = t6El("div", "aleta-t6-sidang");
  layar.setAttribute("data-tema", t6TemaPanel());
  layar.setAttribute("role", "dialog");
  layar.setAttribute("aria-label", "Mode sidang");
  const kepala = t6El("div", "aleta-t6-sidang-kepala");
  const pilihSaksi = document.createElement("select");
  pilihSaksi.className = "aleta-t6 aleta-t6-sidang-saksi";
  t6KolomSaksi(hasil).forEach((c, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = c.judul || `Saksi ${i + 1}`;
    pilihSaksi.appendChild(o);
  });
  const posisi = t6El("span", "aleta-t6-sidang-posisi");
  const tutup = t6Tombol("Selesai", "Keluar dari mode sidang (Esc)", "aleta-t6-kecil");
  kepala.appendChild(t6El("strong", "", "Mode sidang"));
  kepala.appendChild(pilihSaksi);
  kepala.appendChild(posisi);
  kepala.appendChild(tutup);
  const tanya = t6El("div", "aleta-t6-sidang-tanya");
  const jawab = document.createElement("textarea");
  jawab.className = "aleta-t6 aleta-t6-sidang-jawab";
  jawab.rows = 5;
  const kaki = t6El("div", "aleta-t6-sidang-kaki");
  const mundur = t6Tombol("‹ Sebelumnya", "", "");
  const maju = t6Tombol("Berikutnya ›", "Ctrl+Enter", "aleta-t6-utama");
  kaki.appendChild(mundur);
  kaki.appendChild(t6El("span", "aleta-t6-lembut", "Tersimpan ke penyunting saat mengetik - simpan ke ABT tetap lewat tombol simpan penyunting."));
  kaki.appendChild(maju);
  layar.appendChild(kepala);
  layar.appendChild(tanya);
  layar.appendChild(jawab);
  layar.appendChild(kaki);

  let ke = 0;
  const barisSekarang = () => {
    const c = t6KolomSaksi(hasil)[Number(pilihSaksi.value) || 0];
    return { c, b: c ? c.baris[ke] : null };
  };
  const gambar = () => {
    const { c, b } = barisSekarang();
    const n = c ? c.baris.length : 0;
    ke = Math.max(0, Math.min(ke, Math.max(0, n - 1)));
    posisi.textContent = n ? `pertanyaan ${ke + 1} dari ${n}` : "tidak ada pertanyaan";
    tanya.textContent = b ? String((b.querySelector(".aleta-sdg-tanya") || {}).textContent || "") : "";
    const asli = b && b.querySelector("textarea.aleta-sdg-jawab");
    jawab.value = asli ? asli.value : "";
    jawab.disabled = !asli;
    mundur.disabled = ke <= 0;
    maju.disabled = ke >= n - 1;
    try {
      jawab.focus();
    } catch {
      /* fokus hanya kenyamanan */
    }
  };
  jawab.addEventListener("input", () => {
    const { b } = barisSekarang();
    const asli = b && b.querySelector("textarea.aleta-sdg-jawab");
    if (!asli) return;
    asli.value = jawab.value;
    asli.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const tombol = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      selesai();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!maju.disabled) {
        ke += 1;
        gambar();
      }
    }
  };
  function selesai() {
    document.removeEventListener("keydown", tombol, true);
    layar.remove();
  }
  mundur.addEventListener("click", () => {
    ke -= 1;
    gambar();
  });
  maju.addEventListener("click", () => {
    ke += 1;
    gambar();
  });
  pilihSaksi.addEventListener("change", gambar);
  tutup.addEventListener("click", selesai);
  document.addEventListener("keydown", tombol, true);
  document.body.appendChild(layar);
  gambar();
}

// ─── abt-26: pemeriksa anonimisasi sebelum unggah ───────────────────────────

/** Nama pihak, NIK, dan alamat yang tergambar di blangko - bahan pemeriksaan. */
function t6DataPribadi() {
  const peta = barisVariabel();
  const nama = new Map();
  const alamat = new Map();
  const tambahNama = (teks, dari) => {
    const s = String(teks || "").replace(/\s+/g, " ").trim();
    if (s.length >= 3 && !nama.has(s.toLowerCase())) nama.set(s.toLowerCase(), { teks: s, dari });
  };
  for (const kode of ["7047", "7048"]) {
    const item = peta.get(kode);
    if (!item || keadaanNilai(item.nilai) !== "terisi") continue;
    const n = t6NamaDariIdentitas(item.nilai);
    if (n) tambahNama(n.inti, kode);
    const pola = /\b(Desa|Kelurahan|Dusun|Jalan|Jl\.|Lorong|Kampung|Perumahan|Kompleks)\s+([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){0,2})/g;
    for (const m of item.nilai.matchAll(pola)) {
      const tempat = m[2].replace(/[.,]+$/, "");
      if (tempat.length >= 3 && !alamat.has(tempat.toLowerCase())) alamat.set(tempat.toLowerCase(), { teks: tempat, dari: `${kode} (${m[1]})` });
    }
  }
  // Nama pihak pada blangko permohonan (lihat "sebutan bukan nama pihak").
  for (const kode of ["0098", "0102", "0012", "0015"]) {
    const item = peta.get(kode);
    if (!item || keadaanNilai(item.nilai) !== "terisi" || /\d/.test(item.nilai) || item.nilai.length > 60) continue;
    tambahNama(item.nilai.split(/\s+(?:bin|binti)\s+/i)[0], kode);
  }
  return { nama: Array.from(nama.values()), alamat: Array.from(alamat.values()) };
}

/**
 * Data pribadi yang masih utuh di teks anonim - beserta letaknya: paragraf
 * ke berapa, perkiraan halaman, dan potongan kalimat di sekitarnya.
 */
function t6PeriksaAnonim(teks, data) {
  const paragraf = t6Paragraf(teks);
  const temuan = [];
  let jalan = 0;
  const catat = (jenis, kata, p, i, indeks, dari) => {
    const awal = Math.max(0, indeks - 50);
    temuan.push({
      jenis,
      kata,
      dari,
      paragraf: i + 1,
      halaman: Math.floor((jalan + indeks) / T6_HURUF_PER_HALAMAN) + 1,
      konteks: `${awal > 0 ? "…" : ""}${p.slice(awal, indeks + kata.length + 50)}${indeks + kata.length + 50 < p.length ? "…" : ""}`,
    });
  };
  paragraf.forEach((p, i) => {
    for (const m of p.matchAll(/(?<!\d)\d{16}(?!\d)/g)) catat("NIK", m[0], p, i, m.index, "");
    for (const n of data.nama) {
      const m = t6PolaKata(n.teks).exec(p);
      if (m) catat("nama pihak", m[2], p, i, m.index + m[1].length, n.dari);
    }
    for (const a of data.alamat) {
      const m = t6PolaKata(a.teks).exec(p);
      if (m) catat("alamat", m[2], p, i, m.index + m[1].length, a.dari);
    }
    jalan += p.length;
  });
  return { temuan, diperiksa: { nama: data.nama.length, alamat: data.alamat.length } };
}

/**
 * Dipanggil kerjakanSatuPerkaraAbt SEBELUM unggah - hanya bila t6Aktif().
 * Pulang true bila unggah boleh berjalan: anonimnya bersih, tidak ada anonim
 * yang diunggah, saklarnya mati, atau petugas mengonfirmasi sesudah membaca
 * letak temuannya. Keputusan pengguna: peringatan dengan konfirmasi, bukan
 * penahanan.
 */
async function t6PeriksaAnonimSebelumUnggah(siap, lapor) {
  if (!t6Nyala("abt-26") || !siap || !siap.isiAnonim) return true;
  const kabar = typeof lapor === "function" ? lapor : () => {};
  kabar("memeriksa anonimisasi sebelum unggah…");
  let hasil;
  try {
    hasil = t6PeriksaAnonim(t6TeksRtf(siap.isiAnonim), t6DataPribadi());
  } catch (galat) {
    hasil = { temuan: [], galat: String((galat && galat.message) || galat), diperiksa: { nama: 0, alamat: 0 } };
  }
  const ringkasJenis = (jenis) => hasil.temuan.filter((x) => x.jenis === jenis).length;
  if (!hasil.galat && !hasil.temuan.length) {
    siap.ringkas.push(`anonim diperiksa: NIK, ${hasil.diperiksa.nama} nama, ${hasil.diperiksa.alamat} alamat tersamar`);
    return true;
  }
  const daftar = hasil.temuan.slice(0, 12).map((x) => `${x.jenis} "${x.kata}"${x.dari ? ` (dari ${x.dari})` : ""} - paragraf ${x.paragraf}, ± halaman ${x.halaman}: ${x.konteks}`);
  const ya = await t6Dialog({
    judul: "Pemeriksaan anonim sebelum unggah ke SIPP",
    isi: [
      hasil.galat
        ? `Anonim tidak dapat diperiksa (${hasil.galat}). Periksa berkas anonimnya sendiri sebelum melanjutkan.`
        : `${ringkasJenis("NIK") ? `⚠ ${ringkasJenis("NIK")} NIK utuh` : "✓ NIK tersamar"} · ${ringkasJenis("nama pihak") ? `⚠ ${ringkasJenis("nama pihak")} nama pihak utuh` : "✓ nama pihak tersamar"} · ${ringkasJenis("alamat") ? `⚠ ${ringkasJenis("alamat")} alamat utuh` : "✓ alamat tersamar"}`,
      t6DaftarDialog("Masih utuh di berkas anonim:", daftar),
      hasil.temuan.length > 12 ? `… dan ${hasil.temuan.length - 12} lagi.` : "",
      "ALETA tidak mengubah berkas anonim ABT. Bila dibatalkan: samarkan di ABT, lalu tekan \"Kerjakan perkara ini\" lagi.",
    ],
    centang: "Sudah saya periksa",
    ya: "Tetap unggah ke SIPP",
    tidak: "Batalkan unggah",
  });
  siap.ringkas.push(
    ya
      ? `anonim: ${hasil.temuan.length} data pribadi masih utuh - tetap diunggah atas konfirmasi petugas`
      : `unggah ke SIPP dibatalkan petugas: ${hasil.temuan.length} data pribadi masih utuh di anonim`
  );
  try {
    if (typeof alatCatat === "function") alatCatat("abt-anonim", ya ? "unggah dilanjutkan sesudah konfirmasi anonim" : "unggah dibatalkan di pemeriksaan anonim", `${hasil.temuan.length} temuan`);
  } catch {
    /* kotak hitam hanya catatan */
  }
  return ya;
}

/*
 * ============================================================================
 * PERBAIKAN 30 SEP SORE - PANEL ABT SEDERHANA DAN MENU PER PERAN (AGEN T)
 * ============================================================================
 *
 * Sumber: pesan pengguna sesudah memakai 1.175.0 dengan akun hakim (Munifa),
 * juru sita (Mustini), dan Super Admin. Hidup HANYA dalam tampilan Baru dan UI
 * Baru (soreAktif); dalam Lama tidak satu baris pun di bawah ini berjalan, dan
 * panel Lama tetap identik (dijaga ekstensi-abt-tahap6 "SYARAT MUTLAK").
 *
 *   butir 1   menu panel ABT DI DALAM PERKARA mengikuti alatMenuPeran("abt",
 *             "perkara", peran, {ditangani}) - satu matriks untuk panel SIPP
 *             dan ABT (panel-alat.js). Yang tidak termasuk menu peran itu
 *             DISEMBUNYIKAN (data-sore-tampak), tidak dihapus: ⋯ → "Bagian peran
 *             lain" menampilkannya lagi. Peran "lain" (operator, analis, ...) =
 *             susunan lama, tidak dikurangi.
 *   butir 1b  BERANDA ABT: menu massal mengikuti alatMenuPeran("abt","daftar")
 *             - Putusan massal, BAS massal (basmassal.js), Relaas & PBT massal
 *             (jurusita.js). Juru sita tidak lagi melihat Putusan massal.
 *   butir 2   cari variabel, "x dari y variabel siap", variabel wajib, dan
 *             "Komentar hakim · belum ada" pindah ke ⋯ → "Alat variabel".
 *             Komentar yang BERISI tetap tampil sebagai pita kecil.
 *   butir 3   penjelasan teknis diberi kelas aleta-teknis (K5).
 *   butir 4   "Isi dari SIPP" dan "Susun keterangan saksi" berjalan sendiri
 *             saat panel terbuka - sekali per muat halaman, HANYA MEMBACA.
 *             Satu-satunya tombol tulis: "Input ke ABT".
 *   butir 5   alasan perceraian diringkas menjadi kesimpulan pendek dan
 *             digabung ke daftar HURUF - tiap huruf menyebut kenapa ia
 *             terdeteksi. Kartu panjang lama tetap ada di balik ⓘ.
 *   butir 6   "Tuliskan huruf alasan" + "Terapkan yang dicentang" = satu tombol.
 *   butir 7   usulan SIPP, keterangan saksi, dan posita dalam SATU daftar
 *             centang; yang tidak terdeteksi atau sudah sama tidak tampil.
 *
 * Jalur tulis ke ABT TIDAK bertambah: "Input ke ABT" memakai
 * terapkanUsulanBerurutan dan tulisHurufAlasan - jalur yang sama dengan
 * "Terapkan yang dicentang" dan "Tuliskan huruf alasan". Pembacaan otomatis
 * memakai rute baca yang sama dengan tombol lama (POST /abt/usulan ada di
 * ALETA_COBA_BOLEH - hanya menghitung; GET tanya-jawab ABT; GET sipp-konteks).
 * Mode coba, kering, dan latihan tetap menahan tulisan di panel-alat.js;
 * dalam mode kering pembacaan otomatis tidak dijalankan sama sekali, sebab
 * mode itu menahan tiap POST ke portal - ia dijalankan lewat tombolnya.
 */
const SORE_API_KONTEKS = "/aleta/api/aleta-bot/sipp-konteks";
/** Batas menunggu akun ALETA (muatPenggunaAleta) sebelum dianggap "lain". */
const SORE_BATAS_PERAN_MS = 10000;
/** Batas menunggu sipp-konteks untuk penanda "ditangani" hakim/ketua. */
const SORE_BATAS_KONTEKS_MS = 8000;
const SORE_LABEL_MASSAL = Object.freeze({
  "putusan-massal": "Putusan massal",
  "bas-massal": "BAS massal",
  "relaas-pbt-massal": "Relaas & PBT massal",
});
/** Pangkat keyakinan usulan - yang lebih yakin menang bila dua sumber mengusulkan variabel yang sama. */
const SORE_PANGKAT_YAKIN = Object.freeze({ pasti: 5, cukup: 4, ragu: 2, bentrok: 2, kosong: 0, tidak_ada_sumber: 0 });
/** Nama variabel blangko yang memuat nama majelis / PP / JS perkara (penanda "ditangani", K2). */
const SORE_POLA_PENANGAN = Object.freeze({
  hakim: /hakim|majelis/i,
  ketua: /hakim|majelis/i,
  panitera: /panitera/i,
  jurusita: /juru\s*sita|jurusita/i,
});

/** Hasil pembacaan otomatis per halaman: dibangun ulang (↻) tanpa membaca ulang. */
const soreSinggah = new Map();
/** Otomatisasi yang sudah dijalankan pada muat halaman ini (sekali per muat). */
const soreSudahJalan = new Set();
/** Keadaan lapisan untuk panel perkara yang sedang tampil. */
let soreKeadaan = null;

/** Lapisan ini hidup di Baru dan UI Baru - sama dengan Tahap 6. */
function soreAktif() {
  return t6Aktif();
}

function soreEl(tag, kelas, teks) {
  return t6El(tag, `aleta-sore${kelas ? ` ${kelas}` : ""}`, teks);
}

function sorePesan(galat) {
  return String((galat && galat.message) || galat);
}

/**
 * Peran yang BERLAKU. Mode "ganti peran" Super Admin (K1), bila kelak ada di
 * panel-alat.js sebagai alatPeranAktif(), menang atas peran akun.
 */
function sorePeranAktif() {
  try {
    if (typeof alatPeranAktif === "function") {
      const p = alatPeranAktif();
      if (p) return String(p);
    }
  } catch {
    /* tanpa mode ganti peran */
  }
  return String((penggunaAletaAbt && penggunaAletaAbt.peran) || "");
}

function soreMenuPeran(halaman, peran, opsi) {
  try {
    return typeof alatMenuPeran === "function" ? alatMenuPeran("abt", halaman, peran, opsi) : null;
  } catch {
    return null;
  }
}

function soreGolongan(peran) {
  try {
    return typeof alatGolonganPeran === "function" ? alatGolonganPeran(peran) : "lain";
  } catch {
    return "lain";
  }
}

function soreKeringNyala() {
  try {
    return typeof alatKeringNyala === "function" && alatKeringNyala() === true;
  } catch {
    return false;
  }
}

// ─── Penanda "ditangani" (K2) ────────────────────────────────────────────────

/** "Dra. Hj. MUNIFA, S.H." -> "munifa". */
function soreBakuNamaAkun(nama) {
  const depan = String(nama || "").split(",")[0];
  return depan
    .toLowerCase()
    .replace(/\b(drs|dra|dr|hj|h|ir|prof|kh)\.?(?=\s|$)/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function soreBakuTeks(teks) {
  return String(teks || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dari variabel blangko yang SUDAH tergambar: nama akun ALETA tercantum di
 * variabel majelis / panitera / juru sita = true. Tidak ditemukan TIDAK
 * berarti bukan penangannya (nama di blangko dapat bergelar atau disingkat) -
 * pulang undefined, bukan false.
 */
function soreDitanganiDariHalaman(golongan, namaAkun) {
  const pola = SORE_POLA_PENANGAN[golongan];
  const nama = soreBakuNamaAkun(namaAkun);
  if (!pola || nama.length < 4) return undefined;
  for (const [, item] of barisVariabel()) {
    if (!pola.test(String(item.nama || ""))) continue;
    if (keadaanNilai(item.nilai) !== "terisi") continue;
    if (` ${soreBakuTeks(item.nilai)} `.includes(` ${nama} `)) return true;
  }
  return undefined;
}

/**
 * true / false / undefined (tidak pasti = tidak mengurangi). false HANYA dari
 * jawaban bot yang tegas "bukan_anggota_majelis" (sipp-konteks, GET yang sama
 * dengan panel SIPP - diperiksa bot atas majelis SIPP perkara itu).
 */
async function soreDitangani(k) {
  const g = k.golongan;
  if (g === "admin" || g === "lain") return undefined;
  const nama = (penggunaAletaAbt && penggunaAletaAbt.nama) || "";
  if (soreDitanganiDariHalaman(g, nama) === true) return true;
  if ((g === "hakim" || g === "ketua") && k.nomor) {
    const h = await Promise.race([
      t6AmbilJson(`${SORE_API_KONTEKS}?nomor=${encodeURIComponent(k.nomor)}`, "Konteks perkara"),
      new Promise((r) => setTimeout(() => r(null), SORE_BATAS_KONTEKS_MS)),
    ]);
    const hakim = h && h.ok && h.data && h.data.konteks && h.data.konteks.hakim;
    if (hakim && hakim.bolehVerifikasi === true) return true;
    if (hakim && hakim.alasan === "bukan_anggota_majelis") return false;
  }
  return undefined;
}

// ─── Penata utama panel perkara ─────────────────────────────────────────────

/** Dipanggil pasang() sesudah t6TataAman; kegagalannya tidak menggagalkan panel. */
function soreTataAman(panel, jatiDiri) {
  if (!soreAktif()) return;
  try {
    Promise.resolve(t6JanjiTata)
      .then(() => soreTata(panel, jatiDiri))
      .catch((galat) => t6CatatGalat(galat, "Penataan panel ABT perbaikan 30 Sep sore gagal"));
  } catch (galat) {
    t6CatatGalat(galat, "Penataan panel ABT perbaikan 30 Sep sore gagal");
  }
}

function soreHentikan() {
  const k = soreKeadaan;
  soreKeadaan = null;
  if (!k) return;
  for (const p of k.pengamat) {
    try {
      p.disconnect();
    } catch {
      /* sudah lepas */
    }
  }
  for (const j of k.pewaktu) {
    clearInterval(j);
    clearTimeout(j);
  }
  k.pengamat.length = 0;
  k.pewaktu.length = 0;
}

/** Keadaan panel: tombol dan wadah lama dikenali dari susunan susunPanelAbt. */
function soreSusun(panel, jatiDiri, isi) {
  const aksi = t6Anak(isi, "aleta-abt-aksi");
  const lama = aksi ? Array.from(aksi.children).filter((c) => c.tagName === "BUTTON" && !c.classList.contains("aleta-t6")) : [];
  const daftar = Array.from(isi.children).filter((c) => c.classList.contains("aleta-abt-daftar") && !c.classList.contains("aleta-t6-usulan-sipp"));
  return {
    panel,
    jatiDiri: jatiDiri || { perkaraId: "", perkTemp: "" },
    nomor: nomorPerkaraAbt(),
    isi,
    kepala: t6Anak(panel, "aleta-kepala"),
    kaki: t6Anak(panel, "aleta-kaki"),
    aksi,
    kabar: isi.querySelector(".aleta-abt-kabar"),
    tombol: {
      sipp: lama[0] || null,
      saksi: lama[1] || null,
      itsbat: lama[2] || null,
      lain: lama[3] || null,
      sdg: lama[4] || null,
      riwayat: lama[5] || null,
      rapikan: lama[6] || null,
    },
    wadah: { riwayat: daftar[0] || null, selisih: daftar[1] || null, sepihak: daftar[2] || null, huruf: daftar[3] || null, usulan: daftar[4] || null },
    peran: "",
    golongan: "",
    menu: undefined,
    ditangani: undefined,
    buka: { alatVar: false, tombol: false, alat: false, peran: false, rinci: false },
    adaRinci: false,
    klikSendiri: false,
    dibatalkan: false,
    isiJalan: false,
    pengamat: [],
    pewaktu: [],
  };
}

async function soreTata(panel, jatiDiri) {
  if (!soreAktif() || document.getElementById(PENANDA_ABT) !== panel) return;
  soreHentikan();
  const isi = t6Anak(panel, "aleta-isi");
  if (!isi) return;
  const k = soreSusun(panel, jatiDiri, isi);
  soreKeadaan = k;
  panel.setAttribute("data-sore", "ya");
  sorePasangKerja(k);
  sorePantauTombolLama(k);
  sorePasangPengamat(k);
  void sorePasangMenu(k);
  soreSegarkan(k);

  const peran = await soreTungguPeran(k);
  if (soreKeadaan !== k) return;
  k.peran = peran;
  k.golongan = soreGolongan(peran);
  k.menu = soreMenuPeran("perkara", peran, {});
  panel.setAttribute("data-sore-golongan", k.golongan);
  soreSegarkan(k);
  if (k.menu === null) return;

  k.ditangani = await soreDitangani(k);
  if (soreKeadaan !== k) return;
  k.menu = soreMenuPeran("perkara", peran, { ditangani: k.ditangani }) || [];
  if (k.ditangani !== undefined) panel.setAttribute("data-sore-ditangani", k.ditangani ? "ya" : "tidak");
  sorePastikanJurusita(k);
  soreSegarkan(k);
  soreOtomatis(k);
  // Perbaikan 2 Okt sore (P, butir 7): blangko BAS -> Isi dari SIPP & input ke ABT (BAS).
  p7PasangBasAman(k);
}

/** Akun ALETA datang menyusul (muatPenggunaAleta dipanggil susunPanelAbt). */
async function soreTungguPeran(k) {
  const mulai = Date.now();
  // Mode kering menahan POST "siapa" ke portal - akunnya tidak akan datang.
  // Menunggu sepuluh detik hanya membuat panel tampak macet.
  const batas = soreKeringNyala() ? 400 : SORE_BATAS_PERAN_MS;
  while (soreKeadaan === k && !sorePeranAktif() && Date.now() - mulai < batas) {
    await new Promise((r) => setTimeout(r, 100));
  }
  return sorePeranAktif();
}

/** Menu memuat `kunci`, atau "semua" (Admin/Super Admin). */
function sorePunya(k, kunci) {
  return Array.isArray(k.menu) && (k.menu.includes("semua") || k.menu.includes(kunci));
}

/**
 * Bagian Juru Sita bila Tahap 6 tidak sedang menata panel ini (tampilan Baru
 * tanpa saklar abt): tempat yang sama, penyusun yang sama (t6PasangJurusita).
 */
function sorePastikanJurusita(k) {
  if (!sorePunya(k, "jurusita")) return;
  if (k.isi.querySelector(".aleta-t6-jurusita")) return;
  if (t6Keadaan && t6Keadaan.panel === k.panel) return;
  const semu = { isi: k.isi, aksi: k.aksi, nomor: k.nomor, perkaraId: k.jatiDiri.perkaraId || "", peran: t6KelasPeran(k.peran), jurusita: null };
  t6PasangJurusita(semu);
}

// ─── Bagian kerja: Isi dari SIPP & input ke ABT, Susun keterangan saksi ─────

function sorePasangKerja(k) {
  const acuan = k.wadah.selisih || k.wadah.usulan;
  if (!acuan) return;
  const kerjaSusun = soreEl("div", "aleta-sore-kerja");
  kerjaSusun.setAttribute("data-sore-kerja", "susun");
  const kepalaSusun = soreEl("div", "aleta-sore-kerja-kepala");
  kepalaSusun.appendChild(soreEl("span", "aleta-sore-kerja-judul", "Susun keterangan saksi"));
  const ulangSusun = t6Tombol("Susun", "Membuka blangko susun keterangan saksi dan menyusun pratinjaunya - belum menyimpan apa pun ke ABT", "aleta-t6-kecil aleta-sore-jalankan");
  ulangSusun.addEventListener("click", () => {
    a2BukaBagian(k, k.kerjaSusun);
    void soreJalankanSusun(k, { otomatis: false });
  });
  kepalaSusun.appendChild(ulangSusun);
  kerjaSusun.appendChild(kepalaSusun);
  const statusSusun = soreEl("div", "aleta-sore-status");
  statusSusun.setAttribute("role", "status");
  kerjaSusun.appendChild(statusSusun);

  const kerjaIsi = soreEl("div", "aleta-sore-kerja");
  kerjaIsi.setAttribute("data-sore-kerja", "isi");
  const kepalaIsi = soreEl("div", "aleta-sore-kerja-kepala");
  kepalaIsi.appendChild(soreEl("span", "aleta-sore-kerja-judul", "Isi dari SIPP & input ke ABT"));
  const ulangIsi = t6Tombol("Baca ulang", "Membaca ulang SIPP, keterangan saksi, dan posita - hanya membaca, tidak menyimpan apa pun ke ABT", "aleta-t6-kecil aleta-sore-jalankan");
  ulangIsi.addEventListener("click", () => {
    a2BukaBagian(k, k.kerjaIsi);
    void soreJalankanIsi(k, { paksa: true });
  });
  kepalaIsi.appendChild(ulangIsi);
  kerjaIsi.appendChild(kepalaIsi);
  const statusIsi = soreEl("div", "aleta-sore-status");
  statusIsi.setAttribute("role", "status");
  kerjaIsi.appendChild(statusIsi);

  const bukanPenangan = soreEl(
    "div",
    "aleta-sore-bukan-penangan",
    "Anda tidak tercatat sebagai majelis, panitera pengganti, atau juru sita perkara ini - panel ini hanya untuk membaca. Bagian kerjanya tetap dapat dibuka lewat ⋯ → Bagian peran lain."
  );

  k.isi.insertBefore(bukanPenangan, acuan);
  k.isi.insertBefore(kerjaSusun, acuan);
  k.isi.insertBefore(kerjaIsi, acuan);
  k.kerjaSusun = kerjaSusun;
  k.kerjaIsi = kerjaIsi;
  k.statusSusun = statusSusun;
  k.statusIsi = statusIsi;
  k.bukanPenangan = bukanPenangan;
}

function soreStatus(el, teks, gagal) {
  if (!el) return;
  el.textContent = teks || "";
  el.classList.toggle("aleta-t6-gagal", Boolean(gagal));
  el.hidden = !teks;
}

/**
 * Tombol lama yang ditekan petugas (lewat ⋯ atau pintasan) menggambar ke
 * wadah yang sama. Pembacaan otomatis yang masih berjalan lalu tidak
 * menimpanya, dan rincian alasan lama tampil apa adanya.
 */
function sorePantauTombolLama(k) {
  if (!k.aksi) return;
  const lama = new Set(Object.values(k.tombol).filter(Boolean));
  k.aksi.addEventListener(
    "click",
    (e) => {
      const t = e.target instanceof Element ? e.target.closest("button") : null;
      if (!t || k.klikSendiri) return;
      if (!lama.has(t) && !(t.classList && t.classList.contains("aleta-t6-langkah-tombol"))) return;
      k.dibatalkan = true;
      k.adaRinci = false;
      soreSegarkan(k);
    },
    true
  );
}

/** Menekan tombol lama atas nama otomatisasi - tidak dianggap tekanan petugas. */
function soreTekan(k, t) {
  k.klikSendiri = true;
  try {
    t.click();
  } finally {
    k.klikSendiri = false;
  }
}

function soreOtomatis(k) {
  if (sorePunya(k, "isi-input")) {
    void soreJalankanIsi(k, { otomatis: true });
  } else if (sorePunya(k, "susun-saksi")) {
    void soreJalankanSusun(k, { otomatis: true });
  }
}

// ─── Isi dari SIPP & input ke ABT ────────────────────────────────────────────

function soreKunciHalaman(jenis) {
  return `${location.href}|${jenis}`;
}

async function soreJalankanIsi(k, opsi) {
  const o = opsi || {};
  if (k.isiJalan || soreKeadaan !== k) return;
  const kunci = soreKunciHalaman("isi");
  let data = o.paksa ? null : soreSinggah.get(kunci) || null;
  if (!data && o.otomatis && soreKeringNyala()) {
    soreStatus(k.statusIsi, "Mode kering menyala - Isi dari SIPP tidak dijalankan sendiri. Tekan \"Baca ulang\" untuk menjalankannya.");
    return;
  }
  // Tombol lama yang sudah ditekan petugas menang atas pembacaan otomatis
  // yang belum sempat berjalan - hasilnya tidak ditimpa.
  if (o.otomatis && k.dibatalkan) {
    soreStatus(k.statusIsi, "Tombol lama sudah ditekan - hasilnya yang ditampilkan. Tekan \"Baca ulang\" untuk satu daftar.");
    return;
  }
  // Tanpa satu pun sumber di blangko/peran ini (halaman tanya-jawab, akses
  // blangko ABT dicabut): disebut, tanpa satu permintaan pun.
  if (!data && ![k.tombol.sipp, k.tombol.saksi, k.tombol.itsbat, k.tombol.lain].some((t) => t6TombolTampak(t))) {
    soreStatus(k.statusIsi, "Isi dari SIPP tidak tersedia di halaman ini atau untuk akun ini.");
    return;
  }
  k.isiJalan = true;
  if (o.paksa) k.dibatalkan = false;
  try {
    if (!data) {
      soreStatus(k.statusIsi, "Membaca SIPP dan keterangan saksi…");
      soreSudahJalan.add(kunci);
      data = await soreBacaIsi(k);
      soreSinggah.set(kunci, data);
    }
    if (soreKeadaan !== k) return;
    if (k.dibatalkan && !o.paksa) {
      soreStatus(k.statusIsi, "Tombol lama ditekan - hasilnya yang ditampilkan. Tekan \"Baca ulang\" untuk kembali ke satu daftar.");
      return;
    }
    soreGambarIsi(k, data);
  } finally {
    k.isiJalan = false;
  }
}

/** Seluruh pembacaan - rute yang sama dengan tombol lama, tanpa satu tulisan pun. */
async function soreBacaIsi(k) {
  const data = { sipp: null, saksi: null, itsbat: null, lain: null, galat: [], info: [], catatan: [] };
  const posita = () => {
    const peta = barisVariabel();
    return peta.get(VAR_POSITA) ? peta.get(VAR_POSITA).selNilai.innerText : "";
  };
  // 1.184.0 (butir 16): kelima bacaan tidak saling bergantung - dijalankan
  // BERSAMAAN, bukan berurutan. Galat tetap disebut dalam urutan yang sama
  // (SIPP, saksi, posita permohonan, posita perkara lain). Ikut dibaca:
  // tipe seluruh variabel halaman (butir 1) - lihat muatTipeHalaman.
  const galat = { sipp: "", saksi: "", itsbat: "", lain: "" };
  const tugas = [];
  tugas.push(muatTipeHalaman().catch(() => false));
  if (t6TombolTampak(k.tombol.sipp)) {
    tugas.push(
      (async () => {
        const j = await mintaUsulan({ nomorPerkara: nomorPerkaraAbt(), sumber: "sipp" });
        const s = j.sipp || {};
        if (s.ok === false) throw new Error(s.alasan || "SIPP tidak menjawab.");
        data.sipp = s;
      })().catch((g) => {
        galat.sipp = `SIPP: ${sorePesan(g)}`;
      })
    );
  }
  if (t6TombolTampak(k.tombol.saksi)) {
    tugas.push(
      (async () => {
        const peta = barisVariabel();
        const bacaan = await bacaKeteranganSaksiUsulan(peta);
        if (!bacaan.teks1.trim() && !bacaan.teks2.trim()) {
          data.info.push(
            bacaan.catatan.length ? `Keterangan saksi tidak terbaca - ${bacaan.catatan.join("; ")}.` : "Keterangan saksi 1 dan 2 belum ada di blangko ini."
          );
          // S5=H1 (10 Okt 2026): tanpa keterangan saksi, kartu 0222/0246/
          // 9944/5227 tetap diisi dari POSITA - berkeyakinan "ragu", tidak
          // dicentang sendiri, kutipan posita ditampilkan.
          if (!posita().trim()) return;
          data.info.push("Alasan, awal konflik, dan pisah rumah diusulkan dari posita (ragu - periksa sebelum diinput).");
        }
        // Perbaikan 1 Okt butir 9: teks yang sama dengan yang dibaca bot -
        // cadangan "inti keterangan" bila bot belum mengirim intiCiri.
        data.teksSaksi = { 1: bacaan.teks1, 2: bacaan.teks2 };
        const j = await mintaUsulan(muatanUsulanSaksi(peta, bacaan));
        data.saksi = j.saksi || {};
        if (bacaan.catatan.length) data.catatan.push(`Keterangan saksi: ${bacaan.catatan.join("; ")}.`);
      })().catch((g) => {
        galat.saksi = `Keterangan saksi: ${sorePesan(g)}`;
      })
    );
  }
  if (t6TombolTampak(k.tombol.itsbat) && posita().trim()) {
    tugas.push(
      (async () => {
        const j = await mintaUsulan(muatanUsulanItsbat(posita()));
        const it = j.itsbat || {};
        if (it.ok === false) throw new Error(it.alasan || "Posita tidak dapat dibaca.");
        data.itsbat = it;
      })().catch((g) => {
        galat.itsbat = `Posita permohonan: ${sorePesan(g)}`;
      })
    );
  }
  if (t6TombolTampak(k.tombol.lain) && posita().trim()) {
    tugas.push(
      (async () => {
        const j = await mintaUsulan(muatanUsulanLain(posita(), nomorPerkaraAbt()));
        const lain = j.positaLain || {};
        if (lain.ok === false) throw new Error(SEBAB_POSITA_LAIN[lain.alasan] || lain.alasan || "Posita tidak dapat dibaca.");
        if (!lain.ok) throw new Error("ALETA Bot belum mengenal pengisian perkara lain dari posita.");
        data.lain = lain;
      })().catch((g) => {
        galat.lain = `Posita perkara lain: ${sorePesan(g)}`;
      })
    );
  }
  // 1.184.0 (butir 2): #2222#/#0364# dari berkas KTP e-Court.
  if (A3_VAR_TANGGAL_KTP_P.some((k) => barisVariabel().has(k))) {
    tugas.push(
      a3UsulanTanggalKtp(nomorPerkaraAbt())
        .then((r) => {
          data.ktp = { usulan: r.usulan };
          if (r.catatan) data.catatan.push(`Tanggal KTP: ${r.catatan}`);
        })
        .catch((g) => {
          data.catatan.push(`Tanggal KTP dari e-Court: ${sorePesan(g)}`);
        })
    );
  }
  // 9 Okt (KUASA butir 1-4): kantor, alamat kantor, tanggal surat kuasa, dan
  // advokat dari surat gugatan e-Court (+ cadangan SIPP) - lihat a3UsulanKuasa.
  if (A3_VAR_KUASA.some((kode) => barisVariabel().has(kode))) {
    tugas.push(
      a3UsulanKuasa(nomorPerkaraAbt())
        .then((r) => {
          data.kuasa = { usulan: r.usulan, ada: r.ada };
          for (const c of r.catatan) data.catatan.push(`Kuasa hukum: ${c}`);
        })
        .catch((g) => {
          data.catatan.push(`Kuasa hukum dari gugatan e-Court: ${sorePesan(g)}`);
        })
    );
  }
  // Perbaikan 1 Okt butir 8 (UI Baru saja): posita dan keterangan saksi yang
  // RAPI ikut ke daftar Input ke ABT - hanya pratinjau, tidak menulis.
  if (t6Modern()) {
    tugas.push(
      a1BacaRapi(k).then((r) => {
        data.rapi = r;
      })
    );
  }
  /* === P4P7B2 10 Okt === */
  tugas.push(p4BacaGugatan(data));
  /* === AKHIR P4P7B2 === */
  await Promise.all(tugas);
  for (const kunci of ["sipp", "saksi", "itsbat", "lain"]) if (galat[kunci]) data.galat.push(galat[kunci]);
  return data;
}

function soreTerdeteksi(u) {
  if (String((u && u.nilai) || "").trim()) return true;
  return Array.isArray(u && u.pilihan) && u.pilihan.some((p) => (p && typeof p === "object" ? String(p.nilai || "").trim() : String(p || "").trim()));
}

function soreBobot(u) {
  return (soreTerdeteksi(u) ? 10 : 0) + (SORE_PANGKAT_YAKIN[u.keyakinan] || 1);
}

/**
 * Butir 7: satu daftar. Variabel yang diusulkan lebih dari satu sumber tampil
 * sekali - yang paling yakin. Yang tidak terdeteksi (kuasa pada perkara tanpa
 * kuasa, prodeo pada perkara bukan prodeo, ...) dan yang isinya sudah sama di
 * blangko TIDAK tampil; jumlahnya disebut sebagai penjelasan teknis.
 */
function sorePilihUsulan(data) {
  const peta = barisVariabel();
  const perKode = new Map();
  // P4P7B2 10 Okt: data.gugatan = isi berkas e-Court (gugatan, jawaban) - lihat p4BacaGugatan.
  for (const sumber of [data.sipp, data.saksi, data.itsbat, data.lain, data.ktp, data.kuasa, data.gugatan]) {
    for (const u of (sumber && sumber.usulan) || []) {
      if (!u || !u.kode || !peta.has(String(u.kode))) continue;
      const lama = perKode.get(String(u.kode));
      if (!lama || soreBobot(u) > soreBobot(lama)) perKode.set(String(u.kode), u);
    }
  }
  const tampil = [];
  const tidakAda = [];
  const sama = [];
  // 1.184.0 (butir 1): yang dihitung ABT sendiri (data_sql, data_sipp,
  // multi_sidang, ...) tidak diusulkan - simpanVariabel memang menolaknya.
  const dihitung = [];
  for (const [kode, u] of perKode) {
    if (a3BolehDiisi(kode) === false) {
      dihitung.push(kode);
      continue;
    }
    if (!soreTerdeteksi(u)) {
      tidakAda.push(kode);
      continue;
    }
    const kini = (peta.get(kode) || {}).nilai || "";
    if (u.nilai && t6Baku(kini) === t6Baku(u.nilai)) {
      sama.push(kode);
      continue;
    }
    tampil.push(u);
  }
  return { tampil, tidakAda, sama, dihitung };
}

/**
 * 1.184.0 (5 Okt, butir 17): variabel alasan perceraian 0222 sampai 8503
 * WAJIB ada di panel. Yang tidak terdeteksi dari SIPP/keterangan saksi/posita
 * tetap tampil sebagai kartu kosong yang dapat disunting - sampai 1.183.0 ia
 * hanya disebut di "Tidak ditampilkan", dan petugas harus mengetiknya di ABT.
 * 8503 punya bagian sendiri (huruf alasan): kartunya hanya muncul bila bagian
 * itu tidak punya satu pilihan pun, supaya 8503 tidak ditulis dua kali.
 */
const A3_WAJIB_SUNTING = Object.freeze([
  ["0222", "Awal Konflik"],
  ["5227", "Alasan-Alasan Cerai"],
  ["0246", "Pisah Rumah"],
  ["9944", "Lama Pisah"],
  ["7035", "Meninggalkan Kediaman Bersama"],
  ["1268", "Upaya Damai Keluarga"],
  ["8503", "Huruf Alasan Perceraian"],
]);

function a3KartuWajib(tampil, sama, adaHuruf) {
  const peta = barisVariabel();
  const sudah = new Set([...(tampil || []).map((u) => String(u.kode)), ...(sama || []).map(String)]);
  const hasil = [];
  for (const [kode, nama] of A3_WAJIB_SUNTING) {
    if (sudah.has(kode) || !peta.has(kode)) continue;
    if (kode === VAR_HURUF && adaHuruf) continue;
    if (a3BolehDiisi(kode) === false) continue;
    hasil.push({ kode, nama, nilai: "", keyakinan: "kosong", sumber: [], wajib: true });
  }
  return hasil;
}

/** Pemicu huruf -> kelompok alasannya pada jawaban saksi (nama persis, lalu sebagian). */
function soreCariCiri(daftar, pemicu) {
  const p = t6Baku(pemicu);
  const nama = (x) => t6Baku(typeof x === "object" && x ? x.nama : x);
  return (daftar || []).find((x) => nama(x) === p) || (daftar || []).find((x) => nama(x).includes(p) || (p.length > 3 && p.includes(nama(x)))) || null;
}

/**
 * Butir 5: kenapa huruf ini terdeteksi, dalam kalimat pendek. Nadanya:
 *   siap      dikuatkan kedua saksi dan ada di gugatan
 *   sebagian  baru satu saksi / gugatan tidak terbaca
 *   awas      terbukti tetapi tidak ada di gugatan - jangan dipakai
 */
function soreSebabHuruf(h, saksi) {
  const s = saksi || {};
  const bagian = [];
  let nada = "siap";
  const turun = (n) => {
    if (n === "awas" || (n === "sebagian" && nada === "siap")) nada = n;
  };
  for (const p of h.pemicu || []) {
    if (/^lama pisah/i.test(String(p))) {
      bagian.push(`${p} (syarat 2 tahun)`);
      continue;
    }
    if (soreCariCiri(s.ciri, p)) {
      if (s.gugatanTerbaca === true) bagian.push(`${p}: dikuatkan 2 saksi & ada di gugatan`);
      else {
        bagian.push(`${p}: dikuatkan 2 saksi (gugatan tidak terbaca)`);
        turun("sebagian");
      }
      continue;
    }
    if (soreCariCiri(s.ciriDiluarGugatan, p)) {
      bagian.push(`${p}: tidak ada di gugatan - jangan dipakai`);
      turun("awas");
      continue;
    }
    const sepihak = soreCariCiri(s.ciriSepihak, p);
    if (sepihak) {
      bagian.push(`${p}: baru 1 saksi (saksi ${sepihak.saksi})`);
      turun("sebagian");
      continue;
    }
    bagian.push(`${p}: terbaca dari keterangan saksi`);
    turun("sebagian");
  }
  return { teks: bagian.join("; "), nada };
}

/** Kesimpulan pendek alasan perceraian - pengganti kartu panjang di tampilan kerja. */
function soreKesimpulan(saksi) {
  const s = saksi || {};
  const nama = (daftar) => (daftar || []).map((x) => (typeof x === "object" && x ? `${x.nama}${x.saksi ? ` (saksi ${x.saksi})` : ""}` : String(x)));
  const hasil = [];
  if ((s.ciri || []).length) {
    hasil.push(["siap", `Siap dipakai${s.gugatanTerbaca === true ? "" : " (gugatan tidak terbaca)"}: ${nama(s.ciri).join(", ")}`]);
  }
  if ((s.ciriSepihak || []).length) hasil.push(["sebagian", `Baru 1 saksi: ${nama(s.ciriSepihak).join(", ")}`]);
  if ((s.ciriDiluarGugatan || []).length) hasil.push(["awas", `Tidak ada di gugatan - jangan dipakai: ${nama(s.ciriDiluarGugatan).join(", ")}`]);
  if ((s.ciriBelumTerbukti || []).length) hasil.push(["belum", `Ada di gugatan, belum dikuatkan 2 saksi: ${nama(s.ciriBelumTerbukti).join(", ")}`]);
  return hasil;
}

/**
 * Kartu "Alasan perceraian": kesimpulan + daftar huruf bercentang. Kelas huruf
 * sama dengan kartu huruf lama (aleta-abt-huruf, aleta-abt-huruf-nama) supaya
 * hiasan Tahap 6 - komentar hakim per huruf (abt-18), saran pasal (abt-27) -
 * tetap menempel. Kartunya sengaja TIDAK berkelas aleta-t6: pengamat Tahap 6
 * mengabaikan tulisan berkelas itu.
 */
function soreKartuHuruf(k, saksi, pilihan, adaRinci) {
  if (!saksi) return null;
  const huruf = Array.isArray(saksi.huruf) ? saksi.huruf : [];
  const simpul = soreKesimpulan(saksi);
  const tanpaCabang = Array.isArray(saksi.hurufTidakDiusulkan) ? saksi.hurufTidakDiusulkan : [];
  if (!huruf.length && !simpul.length && !tanpaCabang.length) return null;
  const kotak = buatElemen("div", "aleta-abt-kartu aleta-sore-alasan");
  const kepala = buatElemen("div", "aleta-sore-alasan-kepala");
  kepala.appendChild(buatElemen("span", "aleta-abt-nama", "Alasan perceraian"));
  if (adaRinci) {
    const rinci = t6Tombol("ⓘ", "", "aleta-t6-kecil aleta-sore-rinci-tombol");
    const segar = () => {
      rinci.setAttribute("aria-expanded", k.buka.rinci ? "true" : "false");
      rinci.title = k.buka.rinci ? "Tutup rincian alasan" : "Rincian lengkap: yang siap dipakai, yang baru satu saksi, yang di luar gugatan, dan yang belum terbukti";
    };
    rinci.addEventListener("click", () => {
      k.buka.rinci = !k.buka.rinci;
      segar();
      soreSegarkan(k);
    });
    segar();
    kepala.appendChild(rinci);
  }
  kotak.appendChild(kepala);
  if (simpul.length) {
    const daftar = buatElemen("div", "aleta-sore-simpul");
    for (const [nada, teks] of simpul) daftar.appendChild(buatElemen("div", `aleta-sore-simpul-baris aleta-sore-nada-${nada}`, teks));
    kotak.appendChild(daftar);
  }
  for (const h of huruf) {
    const sebab = soreSebabHuruf(h, saksi);
    const blok = buatElemen("div", `aleta-abt-huruf aleta-sore-nada-${sebab.nada}`);
    const label = buatElemen("label", "aleta-abt-huruf-kepala");
    const centang = document.createElement("input");
    centang.type = "checkbox";
    centang.className = "aleta-abt-centang";
    // Aturan centang sendiri SAMA dengan kartu huruf lama; yang "jangan
    // dipakai" tidak pernah tercentang sendiri.
    centang.checked = !h.syarat && h.centangOtomatis !== false && sebab.nada !== "awas";
    label.appendChild(centang);
    label.appendChild(buatElemen("span", "aleta-abt-huruf-nama", `Huruf ${h.huruf}`));
    // Perbaikan 1 Okt butir 9 (UI Baru saja): kesimpulan + ⓘ aturan + ⓘ kenapa.
    if (t6Modern()) {
      blok.appendChild(label);
      a1SusunHuruf(k, blok, label, h, saksi, sebab);
      kotak.appendChild(blok);
      pilihan.push({ huruf: h.huruf, centang });
      continue;
    }
    if (sebab.teks) label.appendChild(buatElemen("span", "aleta-sore-huruf-sebab", sebab.teks));
    blok.appendChild(label);
    if (h.syarat) blok.appendChild(buatElemen("div", "aleta-abt-catatan", h.syarat));
    const dasar = h.dasar || [];
    if (dasar.length) {
      const lipat = document.createElement("details");
      lipat.className = "aleta-abt-lipat";
      const ringkas = document.createElement("summary");
      ringkas.className = "aleta-abt-lipat-judul";
      ringkas.textContent = `Dasar hukum (${dasar.length}) - ${dasar.map((d) => d.sumber.nama).join(" · ")}`;
      lipat.appendChild(ringkas);
      for (const d of dasar) {
        lipat.appendChild(buatElemen("div", "aleta-abt-naskah", d.sumber.nama));
        lipat.appendChild(buatElemen("div", "aleta-abt-bunyi", d.bunyi));
        if (d.catatanNaskah) lipat.appendChild(buatElemen("div", "aleta-abt-kutipan-sumber", d.catatanNaskah));
      }
      blok.appendChild(lipat);
    }
    kotak.appendChild(blok);
    pilihan.push({ huruf: h.huruf, centang });
  }
  for (const x of tanpaCabang) {
    const baris = buatElemen("div", "aleta-abt-catatan aleta-teknis", `Huruf ${x.huruf} (${x.ciri}) tidak diusulkan - blangko ini belum punya cabangnya.`);
    baris.title = String(x.sebab || "");
    kotak.appendChild(baris);
  }
  for (const x of Array.isArray(saksi.hurufBelumSiap) ? saksi.hurufBelumSiap : []) {
    kotak.appendChild(buatElemen("div", "aleta-abt-catatan aleta-teknis", `huruf ${x.huruf}: ${x.sebab}`));
  }
  if (!huruf.length) {
    kotak.appendChild(buatElemen("div", "aleta-t6-lembut", "Tidak ada huruf alasan yang terdeteksi dari keterangan saksi."));
  }
  return kotak;
}

/** Penyunting keterangan saksi yang sedang terbuka tidak pernah ditimpa. */
function soreAdaPekerjaanSaksi(k) {
  return Boolean(k.wadah.usulan && k.wadah.usulan.querySelector(".aleta-sdg-form, .aleta-sdg-hasil"));
}

function soreGambarIsi(k, data) {
  const w = k.wadah;
  if (!w.usulan || !w.huruf || !w.sepihak || !w.selisih) return;
  if (soreAdaPekerjaanSaksi(k)) {
    soreStatus(k.statusIsi, "Penyunting keterangan saksi sedang terbuka - hasil Isi dari SIPP tidak digambar di atasnya. Tekan \"Baca ulang\" sesudah selesai.");
    return;
  }
  // Kuasa dan prodeo dari SIPP - sumber yang sama dengan kabar tombol lama,
  // dibaca hiasan "yang memang tidak berlaku" (abt-2).
  if (data.sipp && t6Keadaan && t6Keadaan.panel === k.panel) {
    t6Keadaan.kuasa = Number(data.sipp.jumlahKuasa || 0);
    t6Keadaan.prodeo = Boolean(data.sipp.prodeo);
  }
  w.selisih.textContent = "";
  const selisih = susunKartuSelisih((data.saksi && data.saksi.selisih) || []);
  if (selisih) w.selisih.appendChild(selisih);

  w.sepihak.textContent = "";
  const rinci = data.saksi ? susunKartuAlasan(data.saksi) : null;
  if (rinci) w.sepihak.appendChild(rinci);
  k.adaRinci = Boolean(rinci);
  k.buka.rinci = false;

  w.huruf.textContent = "";
  const hurufPilihan = [];
  k.a1TeksSaksi = data.teksSaksi || null;
  const kartuHuruf = soreKartuHuruf(k, data.saksi, hurufPilihan, Boolean(rinci));
  if (kartuHuruf) w.huruf.appendChild(kartuHuruf);
  // 7 Okt (UI Baru): usulan huruf yang sama menjadi bawaan isian 8503.
  t6UsulanHuruf = t6Usulan8503(data.saksi);

  w.usulan.textContent = "";
  const pilihan = sorePilihUsulan(data);
  const { sama, dihitung } = pilihan;
  // 1.184.0 (butir 17): variabel alasan perceraian yang tidak terdeteksi tetap punya kartu Sunting.
  // 9 Okt (KUASA): begitu pula variabel kuasa pada perkara ber-kuasa.
  const wajib = [
    ...a3KartuWajib(pilihan.tampil, sama, hurufPilihan.length > 0),
    ...a3KartuKuasaKosong(pilihan.tampil, sama, data),
  ];
  // P4P7B2 10 Okt: bunyi pilihan templat hakim (5227) digabung ke kartunya.
  const tampil = p4GabungPilihan([...pilihan.tampil, ...wajib], data);
  const tidakAda = pilihan.tidakAda.filter((kode) => !wajib.some((u) => u.kode === String(kode)));
  const peta = barisVariabel();
  const pilih = [];
  for (const u of tampil) {
    const item = peta.get(String(u.kode));
    w.usulan.appendChild(kartuUsulan(u, item.nilai, pilih));
    // Blangko yang sudah berisi lain: diganti hanya bila petugas mencentangnya.
    if (keadaanNilai(item.nilai) === "terisi") pilih[pilih.length - 1].centang.checked = false;
  }
  if (tidakAda.length || sama.length || dihitung.length) {
    const bagian = [];
    if (tidakAda.length) bagian.push(`${tidakAda.length} tidak terdeteksi (${tidakAda.join(", ")})`);
    if (sama.length) bagian.push(`${sama.length} sudah sama di blangko (${sama.join(", ")})`);
    if (dihitung.length) bagian.push(`${dihitung.length} dihitung ABT sendiri, bukan isian (${dihitung.join(", ")})`);
    w.usulan.appendChild(soreEl("div", "aleta-t6-lembut aleta-teknis aleta-sore-tak-tampil", `Tidak ditampilkan: ${bagian.join("; ")}.`));
  }
  // P4P7B2 10 Okt: tuntutan, anak, jawab-menjawab, dan kalimat hakim dari berkas e-Court.
  p4GambarEcourt(w.usulan, data);
  // KONTAK-EC 11 Okt: kontak & domisili elektronik dari e-Court (lihat k5GambarKontak).
  if (typeof k5GambarKontak === "function") k5GambarKontak(w.usulan, data);
  // PEKERJAAN 11 Okt: kategori pekerjaan pihak yang dibaca kueri ABT 8510/8524/8533 (lihat pkGambarPekerjaan).
  if (typeof pkGambarPekerjaan === "function") pkGambarPekerjaan(w.usulan, data);
  // Perbaikan 1 Okt butir 8 (UI Baru saja): posita & keterangan saksi rapi.
  const rapiPilihan = t6Modern() ? a1GambarRapi(k, w.usulan, data.rapi) : [];
  soreBarisInput(k, pilih, hurufPilihan, rapiPilihan);

  const ringkas = [];
  if (data.sipp) {
    const kuasa = Number(data.sipp.jumlahKuasa || 0);
    ringkas.push(`${kuasa ? `${kuasa} kuasa aktif` : "tanpa kuasa"} · ${data.sipp.prodeo ? "prodeo" : "bukan prodeo"}`);
  }
  // Perbaikan 2 Okt butir 9: yang dirapikan tidak disebut sebagai yang harus
  // diperiksa (kartunya tidak tampil); rapiPilihan hanya berisi di UI Baru.
  const terisi = tampil.length - wajib.length;
  ringkas.push(
    terisi || hurufPilihan.length || wajib.length
      ? `${terisi} data${hurufPilihan.length ? ` dan ${hurufPilihan.length} huruf alasan` : ""} siap diperiksa${
          wajib.length ? `; ${wajib.length} tidak terdeteksi - isi lewat Sunting (${wajib.map((u) => u.kode).join(", ")})` : ""
        }`
      : rapiPilihan.length
        ? "Tidak ada data baru untuk diinput selain perapian posita/keterangan saksi (ikut tersimpan saat Input ke ABT)"
        : "Tidak ada data baru untuk diinput"
  );
  const gagal = data.galat.length > 0;
  // Kalimat utama (dibaca untuk bertindak), error (tidak pernah disembunyikan),
  // dan catatan cara membaca (penjelasan teknis - K5) berdiri terpisah.
  soreStatus(k.statusIsi, [`${ringkas.join(". ")}.`, ...(data.info || [])].join(" "));
  for (const teks of data.galat) k.statusIsi.appendChild(soreEl("div", "aleta-t6-gagal aleta-sore-galat", teks));
  for (const teks of data.catatan) k.statusIsi.appendChild(soreEl("div", "aleta-t6-lembut aleta-teknis aleta-sore-catatan", teks));
  k.statusIsi.classList.toggle("aleta-sore-ada-galat", gagal);
  k.a1IsiSelesai = true;
  soreSegarkan(k);
  a1SegarkanGalat();
}

/** Butir 4, 6, 7: satu tombol tulis untuk usulan dan huruf alasan. */
function soreBarisInput(k, pilih, hurufPilihan, rapiPilihan) {
  const w = k.wadah.usulan;
  const rapi = Array.isArray(rapiPilihan) ? rapiPilihan : [];
  // Butir 10 (1 Okt): banyaknya yang masih menunggu Input - dibaca a1GalatDitunda.
  k.a1Tertunda = () =>
    pilih.filter((x) => x.centang.checked && !x.centang.disabled && x.nilai()).length +
    hurufPilihan.filter((x) => x.centang.checked && !x.centang.disabled).length +
    rapi.filter((x) => x.centang.checked && !x.centang.disabled).length;
  if (!pilih.length && !hurufPilihan.length && !rapi.length) return;
  const baris = soreEl("div", "aleta-abt-tindakan aleta-sore-tindakan");
  const tombol = buatElemen("button", "aleta-permintaan-tombol aleta-sore-input", "Input ke ABT");
  tombol.type = "button";
  tombol.title = "Menyimpan ke ABT HANYA yang dicentang: data dari SIPP/keterangan saksi/posita, lalu huruf alasan (8503).";
  if (t6Modern() && rapi.length) {
    tombol.title += ` Posita dan keterangan saksi yang dirapikan (${rapi.length}) ikut tersimpan - ⋯ → Lihat yang dirapikan.`;
  }
  const kabar = buatElemen("div", "aleta-abt-kabar");
  baris.appendChild(tombol);
  // S5/H3 (10 Okt 2026): "Input semua yang pasti" - lihat s5BukaPratinjau.
  const tombolPasti = buatElemen("button", "aleta-permintaan-tombol aleta-sore-input-pasti", "Input semua yang pasti");
  tombolPasti.type = "button";
  tombolPasti.title =
    "Menampilkan pratinjau lama → baru untuk SEMUA usulan berkeyakinan pasti, lalu menyimpannya ke ABT sesudah Anda setujui. Yang ragu tetap dicentang manual.";
  baris.appendChild(tombolPasti);
  const wadahPasti = buatElemen("div", "aleta-s5-wadah");
  w.appendChild(baris);
  w.appendChild(kabar);
  w.appendChild(wadahPasti);
  // Perbaikan 2 Okt butir 9 (UI Baru): yang dirapikan tidak tampil, jadi tidak
  // ikut angka di tombol - tetap ikut tersimpan (lihat klik di bawah).
  const rapiTampak = () => !t6Modern() || Boolean(k.a2LihatRapi);
  const hitung = () =>
    pilih.filter((x) => x.centang.checked && x.nilai()).length +
    hurufPilihan.filter((x) => x.centang.checked).length +
    (rapiTampak() ? rapi.filter((x) => x.centang.checked && !x.centang.disabled).length : 0);
  const segar = () => {
    if (!tombol.isConnected) return;
    const n = hitung();
    tombol.textContent = n ? `Input ke ABT (${n})` : "Input ke ABT";
    const pasti = s5DaftarPasti(pilih);
    tombolPasti.hidden = !pasti.length;
    tombolPasti.textContent = `Input semua yang pasti (${pasti.length})`;
    a1SegarkanGalat();
  };
  for (const el of [w, k.wadah.huruf]) {
    if (!el) continue;
    el.addEventListener("change", segar);
    el.addEventListener("focusout", () => setTimeout(segar, 0));
  }
  segar();
  tombolPasti.addEventListener("click", () => {
    s5BukaPratinjau(k, s5DaftarPasti(pilih), wadahPasti, () => {
      segar();
    });
  });
  tombol.addEventListener("click", async () => {
    const dipilih = pilih.filter((x) => x.centang.checked && x.nilai());
    const huruf = hurufPilihan.filter((x) => x.centang.checked);
    const rapiDipilih = rapi.filter((x) => x.centang.checked && !x.centang.disabled);
    if (!dipilih.length && !huruf.length && !rapiDipilih.length) {
      kabar.className = "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = "Belum ada yang dicentang.";
      return;
    }
    tombol.disabled = true;
    kabar.className = "aleta-abt-kabar";
    const bagian = [];
    let gagal = false;
    // 1.184.0 (butir 16): posita SIPP dimulai sekarang, bersamaan dengan tulisan ABT.
    const positaJanji = rapiDipilih.some((r) => r.kode === VAR_POSITA)
      ? mintaPositaRapi(k.jatiDiri.perkaraId, false).catch((g) => ({ ok: false, pesan: sorePesan(g) }))
      : null;
    try {
      if (dipilih.length) {
        const r = await terapkanUsulanBerurutan(
          dipilih,
          k.jatiDiri,
          (teks) => {
            kabar.textContent = teks;
          },
          { jalur: "Input ke ABT" } /* KAMUS-DB 10 Okt: D2 */
        );
        if (r.gagal.length) gagal = true;
        bagian.push(r.gagal.length ? `${r.berhasil} tersimpan, ${r.gagal.length} gagal — ${r.gagal.join("; ")}` : `${r.berhasil} variabel tersimpan`);
      }
      if (huruf.length) {
        kabar.textContent = "Menuliskan huruf alasan…";
        const h = await tulisHurufAlasan(huruf.map((x) => x.huruf), k.jatiDiri);
        bagian.push(h.pesan);
        if (h.gagal) gagal = true;
        else {
          for (const x of huruf) {
            x.centang.checked = false;
            x.centang.disabled = true;
          }
        }
      }
      // Butir 8 (1 Okt, UI Baru): posita dan keterangan saksi rapi - jalur
      // simpan yang sama dengan "Terapkan" pada Rapikan.
      if (rapiDipilih.length) {
        const r = await a1TerapkanRapi(
          k,
          rapiDipilih,
          (teks) => {
            kabar.textContent = teks;
          },
          { positaJanji }
        );
        bagian.push(...r.pesan);
        if (r.gagal) gagal = true;
      }
    } catch (galat) {
      gagal = true;
      bagian.push(`Input terhenti: ${sorePesan(galat)}`);
    } finally {
      tombol.disabled = false;
    }
    kabar.className = gagal ? "aleta-abt-kabar aleta-abt-gagal" : "aleta-abt-kabar";
    kabar.textContent = `${bagian.join(". ")}${gagal ? "" : ". Muat ulang halaman bila variabel otomatis belum ikut berubah."}`;
    if (a1AdaYangMasuk(dipilih, huruf, rapiDipilih)) a1CatatInput(k.jatiDiri);
    segar();
  });
}

// ─── S5/H3: Input semua yang pasti ──────────────────────────────────────────

/**
 * ============================================================================
 * S5/H3 (10 Okt 2026) - "INPUT SEMUA YANG PASTI"
 * ============================================================================
 *
 * Satu tekanan untuk semua usulan berkeyakinan PASTI, tetapi tidak satu pun
 * tertulis sebelum petugas melihat pratinjau lama → baru dan menyetujuinya.
 * Jalur tulisnya tidak bertambah: terapkanUsulanBerurutan -> simpanVariabel
 * (petik ' dan " menjadi ’, garis miring terbalik menjadi /) - sama dengan
 * "Input ke ABT". Sesudahnya halaman blangko dibaca ulang (GET, ABT menyusun
 * ulang) dan tiap variabel diberi tanda hijau bila isinya SUNGGUH terbaca di
 * ABT, merah bila tidak.
 *
 * Yang dihitung pasti:
 *   - usulan bertingkat (0222/0246/9944/5227 dari saksi): HANYA tingkat
 *     "pasti" - golongan yang terukur >= 95% sama dengan isian petugas;
 *   - usulan lain: keyakinan "pasti" yang BUKAN dari keterangan saksi,
 *     posita, atau berkas KTP (mis. data SIPP). 7035/1268 dari saksi tidak
 *     pernah diukur, jadi tidak ikut.
 * Usulan yang sudah disunting petugas tidak ikut (itu bukan lagi usulan
 * mesin - pakai "Input ke ABT"). Yang ragu tetap dicentang manual.
 */
function s5UsulanPasti(u) {
  if (!u || !String(u.nilai || "").trim()) return false;
  if (typeof u.tingkat === "string" && u.tingkat) return u.tingkat === "pasti";
  if (u.keyakinan !== "pasti") return false;
  const sumber = Array.isArray(u.sumber) ? u.sumber : [];
  return !sumber.some((x) => x && (x.saksi || x.asal === "posita" || x.asal === "ktp-ecourt"));
}

/** Butir kartu (lihat kartuUsulan) yang ikut "Input semua yang pasti". */
function s5DaftarPasti(pilih) {
  return (pilih || []).filter(
    (x) => x && x.usulan && s5UsulanPasti(x.usulan) && !x.centang.disabled && !x.disunting() && String(x.nilai() || "").trim()
  );
}

/** Dua isi dianggap sama bila hanya berbeda spasi, besar-kecil huruf, dan jenis petik. */
function s5Sama(a, b) {
  const baku = (x) =>
    String(x == null ? "" : x)
      .replace(/[’‘`"“”]/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  return baku(a) === baku(b);
}

/**
 * Halaman blangko dibaca ulang (GET) dan isi tiap variabel diambil dari
 * sana - bukti bahwa ABT sungguh menyimpannya. Sel di halaman diganti dengan
 * isi baru (hiasan ALETA dipertahankan), penyunting yang terbuka tidak disentuh.
 */
async function s5BacaUlang(kodes) {
  let teks = "";
  try {
    const r = await fetch(location.href, { credentials: "include", cache: "no-store" });
    if (!r.ok) return { ok: false, pesan: `ABT menjawab ${r.status}` };
    teks = await r.text();
  } catch (galat) {
    return { ok: false, pesan: sorePesan(galat) };
  }
  let baru = new Map();
  try {
    baru = barisVariabel(new DOMParser().parseFromString(teks, "text/html"));
  } catch {
    baru = new Map();
  }
  if (!baru.size) return { ok: false, pesan: "halaman yang dibaca ulang tidak memuat tabel variabel" };
  const kini = barisVariabel();
  for (const kode of kodes) {
    const a = kini.get(kode);
    const b = baru.get(kode);
    if (!a || !b || a.selNilai.querySelector(".aleta-abt-sunting") || a.nilai === b.nilai) continue;
    t6GantiIsiSel(a.selNilai, b.selNilai);
  }
  return { ok: true, nilai: new Map(kodes.map((kode) => [kode, baru.has(kode) ? baru.get(kode).nilai : null])) };
}

/**
 * Pratinjau lama → baru. Baris yang blangkonya sudah berisi LAIN tidak
 * dicentang (menimpa isi petugas harus dipilih sendiri); yang kosong dicentang.
 * "Baru" ditampilkan sebagaimana akan tersimpan (petik sudah menjadi ’).
 */
function s5BukaPratinjau(k, daftar, wadah, sesudah) {
  wadah.textContent = "";
  if (!daftar.length) return;
  const kotak = buatElemen("div", "aleta-s5-pratinjau");
  kotak.appendChild(buatElemen("div", "aleta-s5-judul", `Pratinjau: ${daftar.length} usulan pasti akan disimpan ke ABT`));
  const tabel = document.createElement("table");
  tabel.className = "aleta-s5-tabel";
  const kepala = document.createElement("tr");
  for (const judul of ["", "Variabel", "Lama (di ABT)", "Baru", "Hasil"]) kepala.appendChild(buatElemen("th", "", judul));
  tabel.appendChild(kepala);
  const peta = barisVariabel();
  const barisan = [];
  for (const x of daftar) {
    const kode = String(x.usulan.kode);
    const lama = (peta.get(kode) || {}).nilai || "";
    const tr = document.createElement("tr");
    tr.dataset.kode = kode;
    const tdCentang = document.createElement("td");
    const centang = document.createElement("input");
    centang.type = "checkbox";
    centang.className = "aleta-s5-centang";
    const menimpa = keadaanNilai(lama) === "terisi";
    centang.checked = !menimpa;
    tdCentang.appendChild(centang);
    tr.appendChild(tdCentang);
    tr.appendChild(buatElemen("td", "aleta-s5-var", `${kode} ${x.usulan.nama || ""}`.trim()));
    const tdLama = buatElemen("td", "aleta-s5-lama", keadaanNilai(lama) === "kosong" ? "(belum diisi)" : lama);
    if (menimpa) tdLama.appendChild(buatElemen("span", "aleta-tanda aleta-tanda-kuning", "akan ditimpa"));
    tr.appendChild(tdLama);
    tr.appendChild(buatElemen("td", "aleta-s5-baru", a3NetralkanPetik(x.nilai())));
    const hasil = buatElemen("td", "aleta-s5-hasil", "");
    tr.appendChild(hasil);
    tabel.appendChild(tr);
    barisan.push({ x, kode, centang, hasil, tr });
  }
  kotak.appendChild(tabel);
  const tindakan = buatElemen("div", "aleta-abt-tindakan");
  const simpan = buatElemen("button", "aleta-permintaan-tombol aleta-s5-simpan", "");
  simpan.type = "button";
  const batal = buatElemen("button", "aleta-perkakas-pulih aleta-s5-batal", "Batal");
  batal.type = "button";
  tindakan.appendChild(simpan);
  tindakan.appendChild(batal);
  kotak.appendChild(tindakan);
  const kabar = buatElemen("div", "aleta-abt-kabar aleta-s5-kabar");
  kotak.appendChild(kabar);
  wadah.appendChild(kotak);
  const segarTombol = () => {
    const n = barisan.filter((b) => b.centang.checked && !b.centang.disabled).length;
    simpan.textContent = `Ya, simpan ${n} ke ABT`;
    simpan.disabled = !n;
  };
  for (const b of barisan) b.centang.addEventListener("change", segarTombol);
  segarTombol();
  batal.addEventListener("click", () => {
    wadah.textContent = "";
  });
  simpan.addEventListener("click", async () => {
    const dipilih = barisan.filter((b) => b.centang.checked && !b.centang.disabled);
    if (!dipilih.length) return;
    simpan.disabled = true;
    batal.disabled = true;
    for (const b of barisan) b.centang.disabled = true;
    kabar.className = "aleta-abt-kabar aleta-s5-kabar";
    const harap = new Map(dipilih.map((b) => [b.kode, a3NetralkanPetik(b.x.nilai())]));
    let r = { berhasil: 0, gagal: [] };
    try {
      r = await terapkanUsulanBerurutan(
        dipilih.map((b) => b.x),
        k.jatiDiri,
        (teks) => {
          kabar.textContent = teks;
        },
        { jalur: "Input semua yang pasti" } /* KAMUS-DB 10 Okt: D2 */
      );
    } catch (galat) {
      r = { berhasil: 0, gagal: [`Input terhenti: ${sorePesan(galat)}`] };
    }
    kabar.textContent = "Membaca ulang ABT…";
    const baca = await s5BacaUlang(dipilih.map((b) => b.kode));
    let hijau = 0;
    for (const b of dipilih) {
      const gagalIni = r.gagal.find((g) => String(g).startsWith(`${b.kode}:`));
      const terbaca = baca.ok ? baca.nilai.get(b.kode) : null;
      b.tr.classList.remove("aleta-s5-hijau", "aleta-s5-merah");
      if (gagalIni) {
        b.hasil.textContent = `gagal - ${String(gagalIni).slice(b.kode.length + 1).trim()}`;
        b.tr.classList.add("aleta-s5-merah");
      } else if (!baca.ok) {
        b.hasil.textContent = `tersimpan menurut ABT, belum dapat dibaca ulang (${baca.pesan})`;
        b.tr.classList.add("aleta-s5-merah");
      } else if (s5Sama(terbaca, harap.get(b.kode))) {
        b.hasil.textContent = "✓ tersimpan";
        b.tr.classList.add("aleta-s5-hijau");
        hijau += 1;
      } else {
        b.hasil.textContent = `belum terbaca di ABT - isinya "${terbaca == null ? "(tidak ada)" : terbaca}"`;
        b.tr.classList.add("aleta-s5-merah");
      }
    }
    const merah = dipilih.length - hijau;
    kabar.className = merah ? "aleta-abt-kabar aleta-s5-kabar aleta-abt-gagal" : "aleta-abt-kabar aleta-s5-kabar";
    kabar.textContent = merah
      ? `${hijau} dari ${dipilih.length} terbukti tersimpan; ${merah} perlu diperiksa - lihat kolom Hasil.`
      : `${hijau} variabel terbukti tersimpan di ABT (dibaca ulang). Yang ragu tetap menunggu dicentang manual.`;
    if (r.berhasil) a1CatatInput(k.jatiDiri);
    batal.disabled = false;
    batal.textContent = "Tutup";
    if (typeof sesudah === "function") sesudah();
  });
}

// ─── Susun keterangan saksi ─────────────────────────────────────────────────

/**
 * Membuka blangko susun saksi dan menyusun pratinjaunya dengan pilihan
 * bawaannya (templat bawaan, jumlah saksi dari nama yang terdaftar, "sama
 * dengan gugatan"). Yang dibaca: daftar dan isi templat ABT (tanpa aksi=simpan
 * - ALETA_COBA_BOLEH) dan susunan bot. Tulisannya tetap satu tombol di
 * penyuntingnya ("Simpan keterangan N saksi ke ABT"), ditekan petugas.
 */
async function soreJalankanSusun(k, opsi) {
  const o = opsi || {};
  if (k.susunJalan || soreKeadaan !== k) return;
  const kunci = soreKunciHalaman("susun");
  if (o.otomatis && soreSudahJalan.has(kunci)) {
    soreStatus(k.statusSusun, "Sudah disusun sekali pada halaman ini - tekan \"Susun\" untuk menyusun lagi.");
    return;
  }
  const t = k.tombol.sdg;
  // Perbaikan 2 Okt butir 6 (UI Baru): sebab yang benar bagi peran yang tidak berhak.
  const ditolak = a2SusunDitolak(k);
  if (ditolak) {
    soreStatus(k.statusSusun, ditolak);
    return;
  }
  if (!t || t.hidden) {
    soreStatus(k.statusSusun, "Susun keterangan saksi tidak tersedia di blangko ini.");
    return;
  }
  const w = k.wadah.usulan;
  if (w && w.querySelector(".aleta-sdg-hasil")) {
    soreStatus(k.statusSusun, "Penyunting keterangan saksi sudah terbuka di bawah.");
    return;
  }
  // Keterangan saksi yang SUDAH ada tidak disusun ulang sendiri: pratinjau
  // baru atasnya adalah tawaran menimpa, dan itu keputusan petugas. Di halaman
  // tanya-jawab (tempat keterangan itu sedang disunting) juga tidak.
  if (o.otomatis && (!halamanBlangko() || keadaanNilai(a3NilaiSaksi1()) === "terisi")) {
    soreStatus(
      k.statusSusun,
      halamanBlangko()
        ? "Keterangan saksi 1 sudah terisi di blangko - tekan \"Susun\" untuk menyusun ulang."
        : "Tekan \"Susun\" untuk menyusun keterangan para saksi."
    );
    return;
  }
  if (o.otomatis && (k.dibatalkan || (w && w.childElementCount))) {
    soreStatus(k.statusSusun, "Panel sudah dipakai - susun saksi tidak dijalankan sendiri. Tekan \"Susun\" untuk menjalankannya.");
    return;
  }
  if (o.otomatis && soreKeringNyala()) {
    soreStatus(k.statusSusun, "Mode kering menyala - susun saksi tidak dijalankan sendiri. Tekan \"Susun\" untuk menjalankannya.");
    return;
  }
  soreSudahJalan.add(kunci);
  k.susunJalan = true;
  try {
    soreStatus(k.statusSusun, "Membaca templat ABT dan menyusun keterangan saksi…");
    const kabarGagal = () => Boolean(k.kabar && k.kabar.classList.contains("aleta-abt-gagal") && k.kabar.textContent.trim());
    soreTekan(k, t);
    const form = await t6Tunggu(() => (w.querySelector(".aleta-sdg-form") ? w.querySelector(".aleta-sdg-form") : !t.disabled && kabarGagal() ? "gagal" : null), 30000);
    if (soreKeadaan !== k) return;
    if (!form || form === "gagal") {
      soreStatus(k.statusSusun, `Blangko susun saksi tidak terbuka${k.kabar && k.kabar.textContent.trim() ? `: ${k.kabar.textContent.trim()}` : "."}`, true);
      return;
    }
    const susun = Array.from(form.querySelectorAll("button")).find((b) => /^Susun keterangan para saksi$/.test(String(b.textContent || "").trim()));
    if (!susun) return;
    susun.click();
    const hasil = await t6Tunggu(() => {
      if (w.querySelector(".aleta-sdg-hasil")) return "ada";
      const kabarForm = form.querySelector(".aleta-abt-kabar.aleta-abt-gagal");
      return !susun.disabled && kabarForm && kabarForm.textContent.trim() ? "gagal" : null;
    }, 60000);
    if (soreKeadaan !== k) return;
    if (hasil === "ada") {
      soreStatus(k.statusSusun, "Pratinjau keterangan saksi siap di bawah - periksa, lalu tekan \"Simpan keterangan … ke ABT\".");
    } else {
      const kabarForm = form.querySelector(".aleta-abt-kabar");
      soreStatus(k.statusSusun, `Keterangan saksi belum tersusun${kabarForm && kabarForm.textContent.trim() ? `: ${kabarForm.textContent.trim()}` : "."} Pilihannya dapat diubah di blangko di bawah.`, true);
    }
  } finally {
    k.susunJalan = false;
  }
}

// ─── Tampak / tidak: peran, ⋯, penjelasan teknis ─────────────────────────────

function soreTampakkan(el, tampak) {
  if (!el) return;
  if (tampak) {
    if (el.hasAttribute("data-sore-tampak")) el.removeAttribute("data-sore-tampak");
  } else if (el.getAttribute("data-sore-tampak") !== "tidak") {
    el.setAttribute("data-sore-tampak", "tidak");
  }
}

/** Komentar hakim berisi = ada sekurang-kurangnya satu komentar (Tahap 6 abt-18). */
function soreKomentarBerisi(el) {
  const judul = el.querySelector(".aleta-t6-komentar-judul");
  return /\bdari\s+\d+/.test(String((judul && judul.textContent) || ""));
}

/**
 * Daftar [unsur, kelompok[]] yang diatur lapisan ini. Unsur tampak bila
 * SELURUH kelompoknya terbuka:
 *   mati     unsur lapisan ini yang tidak berlaku untuk peran ini (tidak pernah tampak)
 *   peran    di luar menu peran ini - ⋯ → Bagian peran lain
 *   alatVar  cari, sematan, kemajuan, wajib, komentar kosong - ⋯ → Alat variabel
 *   tombol   tombol lama satu per satu dan deret langkah - ⋯ → Tombol satu per satu
 *   alat     bilah alat putusan Tahap 6 - ⋯ → Alat putusan
 *   rinci    kartu alasan panjang - ⓘ di kartu Alasan perceraian
 */
function soreKelola(k) {
  const hasil = [];
  const isi = k.isi;
  const anak = (kelas) => Array.from(isi.querySelectorAll(`.${kelas}`)).filter((el) => k.panel.contains(el));
  const menuTentu = Array.isArray(k.menu);
  const semua = menuTentu && k.menu.includes("semua");
  const peran = (kunci) => (!menuTentu || semua || k.menu.includes(kunci) ? [] : ["peran"]);
  const peranSalah = (daftarKunci) => (!menuTentu || semua || daftarKunci.some((x) => k.menu.includes(x)) ? [] : ["peran"]);

  // Butir 2: alat variabel.
  for (const kelas of ["aleta-t6-kemajuan", "aleta-t6-wajib", "aleta-t6-cari"]) for (const el of anak(kelas)) hasil.push([el, ["alatVar"]]);
  // Perbaikan 1 Okt butir 16 (UI Baru saja): komentar hakim atas BAS hanya
  // untuk majelis dan PP; pita error putusan hanya untuk yang memutus/mengunggah.
  const a1Peran = t6Modern();
  for (const el of anak("aleta-t6-komentar")) {
    const berisi = soreKomentarBerisi(el);
    if (berisi) el.setAttribute("data-sore-pita", "ya");
    else el.removeAttribute("data-sore-pita");
    hasil.push([el, [...(berisi ? [] : ["alatVar"]), ...(a1Peran ? peranSalah(["isi-input", "susun-saksi", "unggah-putusan"]) : [])]]);
  }
  if (a1Peran) {
    for (const kelas of ["aleta-t6-pita-bahaya", "aleta-t6-pita-8503", "aleta-t6-pita-tunggu"]) {
      for (const el of anak(kelas)) hasil.push([el, peranSalah(["isi-input", "unggah-putusan"])]);
    }
  }

  // Tombol lama dan alat - disembunyikan kecuali peran "lain" (susunan lama).
  const lipatTombol = k.menu !== null;
  if (k.aksi) {
    for (const t of Object.values(k.tombol)) if (t) hasil.push([t, lipatTombol ? ["tombol"] : []]);
    const langkah = t6Anak(k.aksi, "aleta-t6-langkah");
    if (langkah) hasil.push([langkah, lipatTombol ? ["tombol"] : []]);
  }
  for (const el of anak("aleta-t6-alat")) hasil.push([el, lipatTombol ? ["alat"] : []]);
  for (const el of anak("aleta-t6-wadah-alat")) hasil.push([el, lipatTombol ? ["alat"] : []]);

  // Butir 1: menu per peran.
  const isiInput = peran("isi-input");
  const mati = (kunci) => (menuTentu && (semua || k.menu.includes(kunci)) ? [] : menuTentu ? ["peran"] : ["mati"]);
  if (k.kerjaIsi) hasil.push([k.kerjaIsi, mati("isi-input")]);
  if (k.kerjaSusun) hasil.push([k.kerjaSusun, mati("susun-saksi")]);
  if (k.bukanPenangan) hasil.push([k.bukanPenangan, menuTentu && k.menu.length === 0 ? [] : ["mati"]]);
  for (const el of [k.wadah.selisih, k.wadah.huruf]) if (el) hasil.push([el, isiInput]);
  if (k.wadah.sepihak) hasil.push([k.wadah.sepihak, [...isiInput, ...(k.adaRinci ? ["rinci"] : [])]]);
  if (k.wadah.usulan) hasil.push([k.wadah.usulan, peranSalah(["isi-input", "susun-saksi"])]);
  for (const el of anak("aleta-t6-usulan-sipp")) hasil.push([el, isiInput]);
  for (const el of anak("aleta-t6-segmen")) hasil.push([el, isiInput]);
  for (const el of Array.from(isi.children).filter((c) => c.classList.contains("aleta-t6-usulan-judul"))) hasil.push([el, isiInput]);
  // Diingat: sesudah alatJadikanLipat (1 Okt butir 1) bagian ini bisa
  // terbungkus lipatan dan bukan lagi anak langsung isi panel.
  const unggah = t6Anak(isi, "aleta-abt-bagian") || k.a1Bagian || null;
  if (unggah) k.a1Bagian = unggah;
  if (unggah) hasil.push([unggah, peran("unggah-putusan")]);
  if (k.kaki) for (const el of Array.from(k.kaki.querySelectorAll(".aleta-t6-kaki-utama"))) hasil.push([el, peran("unggah-putusan")]);
  for (const el of anak("aleta-t6-jurusita")) hasil.push([el, peran("jurusita")]);
  return hasil;
}

function soreTerbuka(k, kelompok) {
  if (kelompok === "mati") return false;
  if (kelompok === "alatVar") return k.buka.alatVar;
  return Boolean(k.buka[kelompok]);
}

function soreSegarkan(k) {
  if (!k || soreKeadaan !== k) return;
  for (const [el, kelompok] of soreKelola(k)) soreTampakkan(el, kelompok.every((x) => soreTerbuka(k, x)));
  soreTandaiTeknis(k.panel);
  soreSegarkanMenu(k);
  // Perbaikan 1 Okt (UI Baru saja): lipat seragam, ⓘ huruf, ⓘ susun saksi.
  if (t6Modern()) a1Segarkan(k);
}

/**
 * Butir 3 / K5: penjelasan teknis diberi kelas aleta-teknis - saklar
 * "Sembunyikan penjelasan teknis" (panel-alat.js, blok W) yang menyembunyikan.
 * Pesan error, peringatan yang meminta tindakan, dan konfirmasi TIDAK
 * ditandai. Pita ringkas ⓘ Tahap 6 di depan unsur itu ikut ditandai, supaya
 * tidak tertinggal tanpa isi.
 */
function soreTandaiTeknis(panel) {
  if (!panel) return;
  const tandai = (el) => {
    if (!el || el.classList.contains("aleta-teknis")) return;
    if (el.classList.contains("aleta-abt-gagal") || el.classList.contains("aleta-t6-gagal")) return;
    el.classList.add("aleta-teknis");
    const depan = el.previousElementSibling;
    if (depan && (depan.classList.contains("aleta-t6-info-pita") || depan.classList.contains("aleta-info-lipat"))) depan.classList.add("aleta-teknis");
  };
  const isi = t6Anak(panel, "aleta-isi");
  if (isi) {
    for (const el of Array.from(isi.children).filter((c) => c.classList.contains("aleta-baris-ket"))) tandai(el);
    for (const el of Array.from(isi.querySelectorAll(".aleta-abt-petunjuk, .aleta-t6-lipat-takberlaku, .aleta-t6-info-sumber, .aleta-t6-rincian, .aleta-remeh"))) tandai(el);
    for (const el of Array.from(isi.querySelectorAll(".aleta-t6-sematan > .aleta-t6-lembut, .aleta-t6-wajib .aleta-t6-lembut, .aleta-t6-komentar-daftar > .aleta-t6-lembut"))) {
      if (/^(Belum ada variabel disematkan|Jenis perkara tidak terbaca|Belum ada variabel wajib|Membaca daftar variabel wajib|Hakim belum mengomentari)/.test(String(el.textContent || "").trim())) tandai(el);
    }
    for (const el of Array.from(isi.querySelectorAll(".aleta-sdg-hasil > .aleta-abt-catatan"))) {
      if (/^Seret ⠿/.test(String(el.textContent || "").trim())) tandai(el);
    }
  }
  for (const el of Array.from(panel.querySelectorAll(".aleta-kaki-pintasan"))) tandai(el);
}

/** Perubahan isi panel (hiasan Tahap 6, gambar tombol lama) -> tata ulang, berjeda. */
function sorePasangPengamat(k) {
  let jam = 0;
  const p = new MutationObserver(() => {
    clearTimeout(jam);
    jam = setTimeout(() => soreSegarkan(k), 60);
  });
  p.observe(k.isi, { childList: true, subtree: true, characterData: true });
  if (k.kaki) p.observe(k.kaki, { childList: true, subtree: true });
  k.pengamat.push(p);
}

// ─── Menu ⋯ ──────────────────────────────────────────────────────────────────

async function sorePasangMenu(k) {
  const tombol = t6Tombol("⋯", "Menu panel: alat variabel, tombol satu per satu, alat putusan, bagian peran lain", "aleta-sore aleta-sore-menu-tombol");
  tombol.setAttribute("aria-expanded", "false");
  const laci = soreEl("div", "aleta-sore-menu");
  laci.setAttribute("role", "menu");
  laci.hidden = true;
  k.menuTombol = tombol;
  k.menuLaci = laci;
  // Sesudah pita-pita Tahap 6 (pita bahaya tetap paling atas).
  const atas = t6Anak(k.isi, "aleta-t6-atas");
  k.isi.insertBefore(laci, atas ? atas.nextSibling : k.isi.firstChild);
  tombol.addEventListener("click", () => {
    laci.hidden = !laci.hidden;
    tombol.setAttribute("aria-expanded", laci.hidden ? "false" : "true");
    soreSegarkanMenu(k);
  });
  laci.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      laci.hidden = true;
      tombol.setAttribute("aria-expanded", "false");
      tombol.focus();
    }
  });
  // Kendali kepala dipasang panel-alat.js secara asinkron.
  const alatKepala = await t6Tunggu(() => (k.kepala ? t6Anak(k.kepala, "aleta-alat-kepala") : null), 3000);
  if (soreKeadaan !== k || !k.kepala) return;
  if (alatKepala) alatKepala.insertBefore(tombol, alatKepala.firstChild);
  else k.kepala.appendChild(tombol);
}

const SORE_BUTIR_MENU = [
  ["alatVar", "Alat variabel", "Cari variabel, sematan, variabel wajib, komentar hakim, dan jumlah variabel siap"],
  ["tombol", "Tombol satu per satu", "Isi blangko dari SIPP, Input ke ABT (lama), Isi dari posita, Susun keterangan saksi, Riwayat, Rapikan"],
  ["alat", "Alat putusan", "Pratinjau putusan, periksa konsistensi, perkara sebelumnya, saran dasar hukum, ringkasan musyawarah"],
  ["peran", "Bagian peran lain", "Bagian yang bukan menu peran Anda di perkara ini - tetap dapat dipakai"],
];

function soreSegarkanMenu(k) {
  const laci = k.menuLaci;
  if (!laci || laci.hidden) return;
  const kelola = soreKelola(k);
  const ada = (kelompok) => kelola.some(([, g]) => g.includes(kelompok));
  const sidik = SORE_BUTIR_MENU.filter(([kunci]) => ada(kunci)).map(([kunci]) => `${kunci}:${k.buka[kunci] ? 1 : 0}`).join("|") + a2SidikMenuRapi(k);
  if (laci.getAttribute("data-sore-sidik") === sidik && laci.childElementCount) return;
  laci.setAttribute("data-sore-sidik", sidik);
  laci.textContent = "";
  for (const [kunci, label, judul] of SORE_BUTIR_MENU) {
    if (!ada(kunci)) continue;
    const b = t6Tombol(label, judul, "aleta-t6-kecil aleta-sore-menu-butir");
    b.setAttribute("role", "menuitemcheckbox");
    b.setAttribute("data-sore-butir", kunci);
    b.setAttribute("aria-pressed", k.buka[kunci] ? "true" : "false");
    b.addEventListener("click", () => {
      k.buka[kunci] = !k.buka[kunci];
      if (kunci === "tombol") {
        // Tombol lama yang diwakili deret langkah Tahap 6 ikut tampak.
        if (k.buka.tombol) k.panel.setAttribute("data-t6-tombol-lama", "ya");
        else k.panel.removeAttribute("data-t6-tombol-lama");
      }
      soreSegarkan(k);
    });
    laci.appendChild(b);
  }
  // Perbaikan 2 Okt butir 9 (UI Baru): yang dirapikan otomatis dapat dilihat.
  a2ButirMenuRapi(k, laci);
  try {
    const saklar = typeof alatSaklarTeknis === "function" ? alatSaklarTeknis() : null;
    if (saklar) laci.appendChild(saklar);
  } catch {
    /* tanpa saklar teknis */
  }
  if (!laci.childElementCount) laci.appendChild(soreEl("div", "aleta-t6-lembut", "Tidak ada bagian tersembunyi di panel ini."));
}

// ─── Beranda ABT: menu massal per peran ─────────────────────────────────────

function soreTataBerandaAman(panel) {
  if (!soreAktif() || !panel) return;
  try {
    soreTataBeranda(panel);
  } catch (galat) {
    t6CatatGalat(galat, "Penataan beranda ABT perbaikan 30 Sep sore gagal");
  }
}

/**
 * Butir 1 (beranda) dan U1-U4. Putusan massal (pemetaan blangko + putusan
 * massal) hanya untuk peran yang menunya memuat "putusan-massal"; BAS massal
 * (globalThis.aletaBasMassalPasang, basmassal.js) dan Relaas & PBT massal
 * (globalThis.aletaJurusitaPasangMassal, jurusita.js) dipasang saat tabnya
 * dibuka pertama kali. Yang fungsinya belum ada dilewati tanpa error. Peran
 * "lain" = susunan lama.
 */
function soreTataBeranda(panel) {
  const isi = t6Anak(panel, "aleta-isi");
  if (!isi) return;
  panel.setAttribute("data-sore", "ya");
  soreTandaiTeknis(panel);
  const peran = sorePeranAktif();
  const menu = soreMenuPeran("daftar", peran, {});
  if (menu === null) return;
  panel.setAttribute("data-sore-golongan", soreGolongan(peran));
  const putusan = Array.from(isi.children).filter((c) => c.classList.contains("aleta-bagian"));
  const fungsi = {
    "bas-massal": globalThis.aletaBasMassalPasang,
    "relaas-pbt-massal": globalThis.aletaJurusitaPasangMassal,
  };
  const tersedia = menu.filter((kunci) => kunci === "putusan-massal" || typeof fungsi[kunci] === "function");
  const nama = t6Anak(t6Anak(panel, "aleta-kepala"), "aleta-kepala-nama");
  if (nama) nama.textContent = tersedia.length === 1 ? `${SORE_LABEL_MASSAL[tersedia[0]]} · ABT` : tersedia.length ? "Kerja massal · ABT" : "Beranda · ABT";

  const wadah = new Map([["putusan-massal", putusan]]);
  for (const el of putusan) el.setAttribute("data-sore-menu", "putusan-massal");
  for (const kunci of tersedia) {
    if (kunci === "putusan-massal") continue;
    const w = soreEl("div", "aleta-sore-massal");
    w.setAttribute("data-sore-menu", kunci);
    isi.appendChild(w);
    wadah.set(kunci, [w]);
  }
  if (!tersedia.length) {
    for (const el of putusan) soreTampakkan(el, false);
    isi.insertBefore(soreEl("div", "aleta-t6-lembut aleta-sore-massal-kosong", "Belum ada menu massal untuk peran Anda di beranda ABT."), isi.firstChild);
    return;
  }
  const terpasang = new Set();
  const tab = new Map();
  const pilih = (kunci) => {
    for (const [kk, daftar] of wadah) for (const el of daftar) soreTampakkan(el, kk === kunci);
    for (const [kk, b] of tab) b.setAttribute("aria-selected", kk === kunci ? "true" : "false");
    if (kunci === "putusan-massal" || terpasang.has(kunci)) return;
    terpasang.add(kunci);
    const w = wadah.get(kunci)[0];
    const gagal = (galat) => w.appendChild(soreEl("div", "aleta-t6-gagal", `${SORE_LABEL_MASSAL[kunci]} gagal dimuat: ${sorePesan(galat)}`));
    try {
      Promise.resolve(fungsi[kunci](w, { situs: "abt" }))
        .then((ok) => {
          if (ok === false && !w.childElementCount) w.appendChild(soreEl("div", "aleta-t6-lembut", `${SORE_LABEL_MASSAL[kunci]} tidak tersedia untuk peran ini.`));
        })
        .catch(gagal);
    } catch (galat) {
      gagal(galat);
    }
  };
  if (t6Modern()) a1JadikanLipatSemua(putusan);
  if (tersedia.length > 1) {
    const bilah = soreEl("div", "aleta-sore-tab");
    bilah.setAttribute("role", "tablist");
    for (const kunci of tersedia) {
      const b = t6Tombol(SORE_LABEL_MASSAL[kunci], "", "aleta-t6-kecil aleta-sore-tab-tombol");
      b.setAttribute("role", "tab");
      b.setAttribute("data-sore-menu", kunci);
      b.addEventListener("click", () => pilih(kunci));
      bilah.appendChild(b);
      tab.set(kunci, b);
    }
    isi.insertBefore(bilah, isi.firstChild);
  }
  pilih(tersedia[0]);
}

/**
 * Tampilan berganti selagi beranda terbuka: panel massal TIDAK disusun ulang
 * sendiri (putusan massal yang sedang berjalan tidak boleh terputus) - ↻ di
 * kaki panel yang menyusunnya ulang, dan itu disebut.
 */
function soreSaatUjiBerubahBeranda() {
  const panel = document.getElementById(PENANDA_MASSAL_ABT);
  if (!panel) return;
  const kini = soreAktif() ? "ya" : null;
  if (panel.getAttribute("data-sore") === kini || panel.querySelector(".aleta-sore-ganti-tampilan")) return;
  const isi = t6Anak(panel, "aleta-isi");
  if (!isi) return;
  isi.insertBefore(buatElemen("div", "aleta-abt-kabar aleta-sore-ganti-tampilan", "Tampilan ALETA berganti - tekan ↻ di kaki panel untuk menyusun ulang panel ini."), isi.firstChild);
}

try {
  document.addEventListener("aleta-uji-berubah", soreSaatUjiBerubahBeranda);
} catch {
  /* tanpa dokumen */
}

/*
 * ============================================================================
 * PERBAIKAN 1 OKT 2026 - PANEL ABT DI UI BARU (AGEN A)
 * ============================================================================
 *
 * Sumber: pesan pengguna sesudah memakai 1.176.0 (tangkapan 125-128). SELURUH
 * blok ini hidup HANYA dalam UI Baru (t6Modern(): alatUjiMode() === "ui").
 * Lama dan Baru tetap seperti 1.176.0 - tiap kait di jalur lama bertanya
 * t6Modern() lebih dahulu (dijaga ekstensi-abt-tahap6 "SYARAT MUTLAK" dan
 * ekstensi-abt-sederhana).
 *
 *   butir 1   bagian panel (Isi dari SIPP, Susun saksi, Unggah, Juru Sita,
 *             Alasan perceraian, bagian beranda) diselaraskan lewat
 *             alatJadikanLipat (agen W, K2) - bila fungsinya sudah ada.
 *   butir 8   posita RAPI dan keterangan saksi RAPI langsung masuk daftar
 *             "Input ke ABT" saat panel terbuka. Pratinjau posita = uji kering
 *             bot (POST tanpa menulis); tulisannya tetap hanya lewat tombol
 *             Input ke ABT, dengan jalur simpan yang sama dengan "Terapkan"
 *             pada Rapikan (mintaPositaRapi / simpanKeteranganSaksi).
 *   butir 9   huruf alasan = KESIMPULAN (keterangan saksi dikaitkan dengan
 *             posita). Pasal dan syarat di balik ⓘ aturan (bawaan tertutup);
 *             inti keterangan tiap saksi di balik ⓘ kenapa (intiCiri dari bot,
 *             cadangan: pencarian kata di keterangan yang sudah dibaca).
 *   butir 10  4020/8521/8522/8528/8529/8530 diisi ABT SENDIRI sesudah
 *             variabel lain diinput - tidak diperingatkan selama masih ada
 *             yang menunggu Input. Diperingatkan bila sesudah Input + muat
 *             ulang masih error. Berlaku untuk pita, dialog CETAK (termasuk
 *             huruf G), dan penjaga CETAK lama.
 *   butir 11  Unggah putusan perkara ini: blangko HALAMAN INI dipilih sendiri
 *             (tautan CETAK), nomor perkara cadangan dari variabel 0001, dan
 *             hasil per langkah. Jalur tulisnya tetap kerjakanSatuPerkaraAbt.
 *   butir 13  putusan massal ABT: bawaan hanya perkara yang hari itu PUTUS
 *             atau DITUNDA untuk putusan / musyawarah (aletaMassalPutusanLayak
 *             agen M bila ada). "Semua perkara" tetap ada di saringan.
 *   butir 14  Super Admin & Admin: daftar dikelompokkan per hakim ketua
 *             majelis, centang "kerjakan semua milik X". Hakim: "Hanya
 *             majelis saya".
 *   butir 15  susun saksi: label sama/beda/varian habis pindah ke ⓘ; tombol
 *             ⟳ ganti keterangan ke alternatif + ↶ urungkan / ↷ ulangi.
 *   butir 16  pita error putusan dan komentar hakim atas BAS mengikuti menu
 *             peran (lihat soreKelola).
 *
 * KUNCI PENYIMPANAN BARU: abtInputSelesai (chrome.storage.local) -
 * {perkaraId: ms terakhir Input ke ABT lewat ALETA}, paling banyak 40 perkara.
 */
const A1_MUAT_MS = Date.now();
const A1_KUNCI_INPUT = "abtInputSelesai";
const A1_BATAS_INPUT = 40;
/** Selama ini sesudah halaman dimuat, penata yang belum selesai = belum tahu (ditunda). */
const A1_TENGGANG_MS = 15000;
const A1_API_SIDANG = "/aleta/api/aleta-ecourt/sidang";
/**
 * Kerangka fakta yang menyuapi kalimat alasan 4020 dkk. BUKAN seluruh
 * VARIABEL_SASARAN: kuasa, prodeo, dan fasakh (0132, 0156, 0661, 0663, 0227)
 * memang kosong pada kebanyakan perkara - menunggu mereka berarti tidak
 * pernah memperingatkan.
 */
const A1_KERANGKA = ["0222", "5227", "0246", "9944", "7035", "1268"];
const A1_BLANGKO_HALAMAN = "__halaman-ini";
const a1Status = { dimuat: false, memuat: false, inputSesudahMuat: false, inputDiHalamanIni: false };
/** Riwayat ⟳ ganti keterangan per kotak jawaban (urungkan/ulangi). */
const a1GantiRiwayat = new WeakMap();

function a1El(tag, kelas, teks) {
  return t6El(tag, `aleta-a1${kelas ? ` ${kelas}` : ""}`, teks);
}

function a1Tombol(teks, judul, kelas) {
  const b = t6Tombol(teks, judul, `aleta-a1-tombol${kelas ? ` ${kelas}` : ""}`);
  b.classList.add("aleta-a1");
  if (judul) b.setAttribute("aria-label", judul);
  return b;
}

function a1Besar(teks) {
  const s = String(teks || "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ─── Butir 1: bentuk lipat seragam (alatJadikanLipat milik agen W) ──────────

/**
 * alatJadikanLipat (panel-alat.js, K2) memberi rupa lipat DI TEMPAT - tanpa
 * membungkus - dan aman dipanggil berulang; kuncinya mengingat buka/tutup per
 * bagian (chrome.storage.local lipatTerbuka, milik agen W). Visibilitas per
 * peran tetap data-sore-tampak pada unsur yang sama.
 */
function a1JadikanLipat(el, kunci, opsi) {
  if (!el || typeof alatJadikanLipat !== "function") return;
  const o = opsi || {};
  try {
    // Perbaikan 2 Okt butir 19 + 7: bawaan buka/tutup dan tag peran (a2).
    alatJadikanLipat(el, { kunci, terbuka: o.terbuka !== false, ...(o.peran ? { peran: o.peran } : {}) });
    if (o.peran) a2TagPeran(el, kunci);
  } catch (galat) {
    t6CatatGalat(galat, "Lipat seragam (alatJadikanLipat) gagal");
  }
}

/** Beranda ABT: bagian Pemetaan blangko dan Putusan massal (milik abt.js). */
function a1JadikanLipatSemua(daftar) {
  for (const el of daftar || []) {
    const judul = el.querySelector(".aleta-bagian-judul-statis");
    const nama = t6Baku((judul && judul.textContent) || "bagian").replace(/[^a-z]+/g, "-");
    // Perbaikan 2 Okt butir 19: Putusan massal = utama (terbuka); pemetaan blangko sekunder.
    a1JadikanLipat(el, `abt-beranda:${nama}`, { terbuka: !/^pemetaan/.test(nama) });
  }
}

// ─── Penata lapisan 1 Okt (dipanggil soreSegarkan) ──────────────────────────

function a1Segarkan(k) {
  if (!k || soreKeadaan !== k || !t6Modern()) return;
  a1MuatStatusInput();
  const lipat = [
    [k.kerjaIsi, "abt:isi-input"],
    [k.kerjaSusun, "abt:susun-saksi"],
    [k.a1Bagian || t6Anak(k.isi, "aleta-abt-bagian"), "abt:unggah-putusan"],
    ...Array.from(k.isi.querySelectorAll(".aleta-t6-jurusita")).map((el) => [el, "abt:jurusita"]),
    ...Array.from(k.isi.querySelectorAll(".aleta-sore-alasan")).map((el) => [el, "abt:alasan"]),
  ];
  // Perbaikan 2 Okt butir 19: lipatan dipasang SESUDAH menu peran diketahui
  // (k.menu bukan undefined) - bawaan buka/tutupnya menurut peran itu.
  if (k.menu !== undefined) {
    for (const [el, kunci] of lipat) {
      if (el && !el.classList.contains("aleta-lipatan")) a1JadikanLipat(el, kunci, { terbuka: a2BukaBawaan(k, kunci), peran: A2_PERAN_BAGIAN[kunci] });
    }
  }
  // Butir 5: isi bagian kerja yang tertutup ikut tersembunyi.
  a2SelaraskanLipat(k);
  // Butir 9: saran pasal abt-27 menempel di blok huruf - ikut ⓘ aturan.
  for (const blok of Array.from(k.isi.querySelectorAll(".aleta-abt-huruf[data-a1-huruf]"))) {
    const buka = blok.getAttribute("data-a1-aturan") === "buka";
    for (const c of Array.from(blok.children)) if (c.classList.contains("aleta-t6-pasal-sisip")) soreTampakkan(c, buka);
  }
  a1HiasSdg(k);
  a1SegarkanGalat();
}

// ─── Butir 10: variabel yang diisi ABT sendiri sesudah Input ────────────────

function a1PerkaraId() {
  const k = soreKeadaan;
  const j = (k && k.jatiDiri && k.jatiDiri.perkaraId ? k.jatiDiri : null) || jatiDiriPerkara() || {};
  return String(j.perkaraId || "");
}

function a1MuatStatusInput() {
  if (a1Status.dimuat || a1Status.memuat || !t6Modern()) return;
  a1Status.memuat = true;
  const id = a1PerkaraId();
  void (async () => {
    try {
      const simpan = await chrome.storage.local.get([A1_KUNCI_INPUT]);
      const peta = simpan && simpan[A1_KUNCI_INPUT] && typeof simpan[A1_KUNCI_INPUT] === "object" ? simpan[A1_KUNCI_INPUT] : {};
      const pada = Number(peta[id] || 0);
      a1Status.inputSesudahMuat = Boolean(id) && pada > 0 && pada < A1_MUAT_MS;
    } catch {
      /* tanpa penyimpanan: dianggap belum pernah diinput lewat ALETA */
    }
    a1Status.dimuat = true;
    a1Status.memuat = false;
    a1SegarkanGalat();
  })();
}

/** Dipanggil sesudah tulisan ke ABT berhasil (UI Baru saja). */
function a1CatatInput(jatiDiri) {
  if (!t6Modern()) return;
  const id = String((jatiDiri && jatiDiri.perkaraId) || a1PerkaraId());
  if (!id) return;
  a1Status.inputDiHalamanIni = true;
  a1SegarkanGalat();
  void (async () => {
    try {
      const simpan = await chrome.storage.local.get([A1_KUNCI_INPUT]);
      const lama = simpan && simpan[A1_KUNCI_INPUT] && typeof simpan[A1_KUNCI_INPUT] === "object" ? simpan[A1_KUNCI_INPUT] : {};
      const baru = { ...lama, [id]: Date.now() };
      const kunci = Object.keys(baru)
        .sort((a, b) => Number(baru[b]) - Number(baru[a]))
        .slice(0, A1_BATAS_INPUT);
      await chrome.storage.local.set({ [A1_KUNCI_INPUT]: Object.fromEntries(kunci.map((x) => [x, baru[x]])) });
    } catch {
      /* penanda hanya penyejuk peringatan - tulisan ABT-nya tetap tersimpan */
    }
  })();
}

/** Ada yang tersimpan dari satu tekanan Input ke ABT (centangnya dimatikan sesudah tersimpan). */
function a1AdaYangMasuk(dipilih, huruf, rapi) {
  return [...(dipilih || []), ...(huruf || []), ...(rapi || [])].some((x) => x && x.centang && x.centang.disabled);
}

/**
 * Masih ada yang menunggu Input ke ABT - selama itu variabel turunan ABT belum
 * waktunya dinilai. Tidak pasti = ditunda HANYA selama tenggang muat; sesudah
 * itu peringatan lama berlaku (lebih baik bertanya sekali lagi daripada diam).
 */
function a1AdaInputTertunda() {
  if (a1Status.inputDiHalamanIni) return true;
  const tenggang = Date.now() - A1_MUAT_MS < A1_TENGGANG_MS;
  if (!a1Status.dimuat) return tenggang;
  if (a1Status.inputSesudahMuat) return false;
  if (t6HurufKosong()) return true;
  const peta = barisVariabel();
  for (const kode of A1_KERANGKA) {
    const item = peta.get(kode);
    if (item && keadaanNilai(item.nilai) === "kosong") return true;
  }
  const k = soreKeadaan;
  if (!k) return tenggang;
  if (k.menu === undefined) return tenggang;
  if (!Array.isArray(k.menu) || !sorePunya(k, "isi-input")) return false;
  if (!k.a1IsiSelesai) return tenggang || k.isiJalan === true;
  return typeof k.a1Tertunda === "function" && k.a1Tertunda() > 0;
}

/** true = bunyi error variabel ini BELUM dihitung (UI Baru saja). */
function a1GalatDitunda(kode) {
  if (!t6Modern()) return false;
  if (!T6_TERGANTUNG_8503.includes(String(kode))) return false;
  // 7 Okt: 8503 kosong/tidak dikenali = turunannya tidak akan terisi oleh
  // Input lain mana pun - ia butir "Isi huruf alasan perceraian (8503)", dan
  // penjaga CETAK (termasuk penjaga lama) tetap menanyakannya.
  if (t6Kesatuan8503Aktif()) return false;
  a1MuatStatusInput();
  return a1AdaInputTertunda();
}

function a1SidikStatus() {
  const k = soreKeadaan;
  return [
    a1Status.dimuat ? 1 : 0,
    a1Status.inputSesudahMuat ? 1 : 0,
    a1Status.inputDiHalamanIni ? 1 : 0,
    k && typeof k.a1Tertunda === "function" ? k.a1Tertunda() : "-",
  ].join("");
}

function a1SegarkanGalat() {
  const k = t6Keadaan;
  if (!k || !k.pitaBahaya || !t6Modern()) return;
  try {
    t6SegarkanPitaBahaya(k);
  } catch (galat) {
    t6CatatGalat(galat, "Pita error panel ABT gagal disegarkan");
  }
}

/** Pita tunggu UI Baru: catatan tenang, bukan peringatan (penjelasan teknis). */
function a1IsiPitaTunggu(pita, tunggu) {
  pita.textContent = "";
  pita.hidden = tunggu.length === 0;
  pita.classList.add("aleta-teknis", "aleta-a1-tunggu");
  if (!tunggu.length) return;
  const kode = tunggu.map((x) => x.kode).join(", ");
  pita.appendChild(
    t6El(
      "span",
      "",
      a1Status.inputDiHalamanIni
        ? `${kode} diisi otomatis oleh ABT dari variabel yang baru diinput - muat ulang halaman untuk memeriksanya. Bila sesudah dimuat ulang masih berbunyi error, ALETA memperingatkannya.`
        : `${kode} diisi otomatis oleh ABT sesudah variabel lain diinput - belum dihitung error. Diperiksa lagi sesudah Input ke ABT dan muat ulang halaman.`
    )
  );
}

// ─── Butir 8: posita dan keterangan saksi rapi masuk daftar Input ke ABT ───

/** Pratinjau saja - posita lewat uji kering bot, keterangan saksi dihitung di sini. */
async function a1BacaRapi(k) {
  const hasil = { butir: [], catatan: [] };
  const peta = barisVariabel();
  const perkaraId = String((k && k.jatiDiri && k.jatiDiri.perkaraId) || "");
  const posita = peta.get(VAR_POSITA);
  if (posita && perkaraId && keadaanNilai(posita.nilai) === "terisi") {
    try {
      const uji = await mintaPositaRapi(perkaraId, true);
      if (uji.ok && uji.berubah) {
        hasil.butir.push({
          kode: VAR_POSITA,
          nama: "Posita lengkap",
          sebelum: uji.sebelum,
          sesudah: uji.sesudah,
          ket: `${uji.disambung ? `${uji.disambung} kata yang terpecah disambung kembali, b` : "B"}utir yang menempel dipisah - disimpan ke posita SIPP (ABT membacanya dari sana); tidak satu kata pun diubah.`,
        });
      }
      if (uji.ok && Array.isArray(uji.ragu) && uji.ragu.length) {
        hasil.catatan.push(`Posita: ${uji.ragu.length} pecahan kata ragu tidak disambung sendiri - putuskan lewat ⋯ → Tombol satu per satu → Rapikan posita & keterangan saksi.`);
      }
      if (!uji.ok) hasil.catatan.push(`Posita rapi tidak dapat dipratinjau: ${uji.pesan}`);
    } catch (galat) {
      hasil.catatan.push(`Posita rapi tidak dapat dipratinjau: ${sorePesan(galat)}`);
    }
  }
  for (const kode of [VAR_SAKSI_1, VAR_SAKSI_2]) {
    const item = peta.get(kode);
    if (!item) continue;
    const asli = String(item.selNilai.innerText || "");
    const bersih = bersihkanKeteranganSaksi(asli);
    if (bersih && bersih !== asli.trim()) {
      hasil.butir.push({
        kode,
        nama: `Keterangan saksi ${kode === VAR_SAKSI_1 ? 1 : 2}`,
        sebelum: asli,
        sesudah: bersih,
        ket: "Kalimat penutup (\"Bahwa sudah cukup\" dan sejenisnya) dibuang - disimpan lewat tanya-jawab ABT; pertanyaannya tidak disentuh.",
      });
    }
  }
  return hasil;
}

/** Kartu "dirapikan" di daftar Input ke ABT - tercentang, tidak menulis apa pun. */
function a1GambarRapi(k, wadah, rapi) {
  if (!rapi || !wadah) return [];
  const pilihan = [];
  // Perbaikan 2 Okt butir 9: kartunya TIDAK tampil - tetap tercentang dan ikut
  // tersimpan saat Input ke ABT; ⋯ → Lihat yang dirapikan membukanya.
  const wadahLuar = wadah;
  k.a2RapiAda = rapi.butir.length > 0;
  if (rapi.butir.length) {
    wadah = buatElemen("div", "aleta-a2-rapi-wadah");
    wadah.hidden = !k.a2LihatRapi;
    k.a2RapiWadah = wadah;
    wadahLuar.appendChild(wadah);
    wadah.appendChild(soreEl("div", "aleta-a1 aleta-a1-rapi-judul", "Dirapikan otomatis - ikut tersimpan saat Input ke ABT"));
    for (const r of rapi.butir) {
      const kartu = buatElemen("div", "aleta-abt-kartu aleta-a1-rapi");
      kartu.setAttribute("data-a1-rapi", r.kode);
      const kepala = buatElemen("label", "aleta-abt-kartu-kepala");
      const centang = document.createElement("input");
      centang.type = "checkbox";
      centang.className = "aleta-abt-centang";
      centang.checked = true;
      kepala.appendChild(centang);
      kepala.appendChild(buatElemen("span", "aleta-a1-kode", r.kode));
      kepala.appendChild(buatElemen("span", "aleta-abt-nama", r.nama));
      kepala.appendChild(buatElemen("span", "aleta-tanda aleta-tanda-hijau", "dirapikan"));
      kartu.appendChild(kepala);
      kartu.appendChild(buatElemen("div", "aleta-abt-catatan aleta-a1-rapi-ket", r.ket));
      kartu.appendChild(buatElemen("pre", "aleta-abt-pratinjau", r.sesudah));
      const sebelum = document.createElement("details");
      sebelum.className = "aleta-abt-lipat aleta-a1-rapi-sebelum";
      sebelum.appendChild(buatElemen("summary", "aleta-abt-lipat-judul", "Sebelum dirapikan"));
      sebelum.appendChild(buatElemen("pre", "aleta-abt-pratinjau", r.sebelum));
      kartu.appendChild(sebelum);
      wadah.appendChild(kartu);
      pilihan.push({ ...r, centang });
    }
  }
  for (const c of rapi.catatan) wadahLuar.appendChild(soreEl("div", "aleta-t6-lembut aleta-a1 aleta-a1-rapi-catatan", c));
  return pilihan;
}

/** Tulisan rapi - jalur yang sama persis dengan "Terapkan" pada Rapikan. */
async function a1TerapkanRapi(k, dipilih, lapor, opsi) {
  const kabar = typeof lapor === "function" ? lapor : () => {};
  // 1.184.0 (butir 16): posita ditulis bot ke SIPP - bukan ABT - jadi boleh
  // sudah dimulai sejak tombol ditekan, bersamaan dengan tulisan ABT.
  const positaJanji = opsi && opsi.positaJanji ? opsi.positaJanji : null;
  const pesan = [];
  let gagal = false;
  for (const r of dipilih) {
    kabar(`Merapikan ${r.nama}…`);
    try {
      let hasil;
      if (r.kode === VAR_POSITA) {
        hasil = await (positaJanji || mintaPositaRapi(k.jatiDiri.perkaraId, false));
        if (hasil.ok && hasil.sebelum) r.sebelum = hasil.sebelum;
      } else {
        hasil = await simpanKeteranganSaksi(r.kode);
      }
      if (!hasil.ok) {
        gagal = true;
        pesan.push(`${r.nama} belum dirapikan: ${hasil.pesan}`);
        continue;
      }
      void catatRiwayat({
        perkaraId: k.jatiDiri.perkaraId,
        kode: r.kode,
        nama: r.nama,
        sebelum: r.sebelum,
        sesudah: r.sesudah,
        cara: "dirapikan (Input ke ABT)",
        pada: new Date().toISOString(),
      });
      const item = barisVariabel().get(r.kode);
      if (item) item.selNilai.textContent = r.sesudah;
      r.centang.checked = false;
      r.centang.disabled = true;
      pesan.push(`${r.nama} dirapikan${hasil.pesan ? ` - ${hasil.pesan}` : ""}`);
    } catch (galat) {
      gagal = true;
      pesan.push(`${r.nama} belum dirapikan: ${sorePesan(galat)}`);
    }
  }
  return { pesan, gagal };
}

// ─── Butir 9: huruf alasan = kesimpulan; ⓘ aturan; ⓘ kenapa ────────────────

/** Satu kalimat kesimpulan per pemicu: keterangan saksi dikaitkan dengan posita. */
function a1KesimpulanHuruf(h, saksi) {
  const s = saksi || {};
  const kalimat = [];
  for (const p of h.pemicu || []) {
    const nama = String(p || "");
    if (/^lama pisah/i.test(nama)) {
      kalimat.push(`Para pihak ${nama.replace(/^lama pisah\s*/i, "berpisah ")} menurut keterangan saksi${h.syarat ? " (syaratnya di ⓘ aturan)" : " (syarat huruf ini: 2 tahun)"}.`);
      continue;
    }
    if (soreCariCiri(s.ciri, nama)) {
      kalimat.push(
        s.gugatanTerbaca === true
          ? `Kedua saksi menerangkan ${nama}, sejalan dengan dalil posita.`
          : `Kedua saksi menerangkan ${nama}; posita tidak terbaca untuk dicocokkan.`
      );
      continue;
    }
    if (soreCariCiri(s.ciriDiluarGugatan, nama)) {
      kalimat.push(`Kedua saksi menerangkan ${nama}, tetapi posita tidak mendalilkannya - jangan dipakai.`);
      continue;
    }
    const sepihak = soreCariCiri(s.ciriSepihak, nama);
    if (sepihak) {
      const dalil = Boolean(soreCariCiri(s.ciriBelumTerbukti, nama));
      kalimat.push(`Hanya saksi ${sepihak.saksi} yang menerangkan ${nama}${dalil ? ", padahal posita mendalilkannya" : ""} - belum dikuatkan dua saksi.`);
      continue;
    }
    kalimat.push(`${a1Besar(nama)} terbaca dari keterangan saksi.`);
  }
  return kalimat.join(" ");
}

/* === P1-P3-S6 10 Okt === */
/**
 * S6: tanda ringkas di kartu huruf - kedua saksi menerangkan SEBAB YANG SAMA untuk
 * huruf ini, berbeda (sebab lain / pelaku bertentangan / lama pisah), atau hanya
 * satu saksi (unus testis nullus testis). Dari h.kesesuaian kiriman ALETA Bot
 * (deteksiAlasanService.kesesuaianHuruf); bot lama tidak mengirimnya -> tanpa tanda.
 */
const NADA_S6 = {
  sama: "aleta-tanda-hijau",
  berbeda: "aleta-tanda-merah",
  "satu saksi": "aleta-tanda-kuning",
  "tidak ada": "aleta-tanda-abu",
};
function a1TandaKesesuaian(h) {
  const k = h && h.kesesuaian;
  if (!k || !NADA_S6[k.status] || !k.label) return null;
  const tanda = buatElemen("span", `aleta-tanda aleta-a1-s6 ${NADA_S6[k.status]}`, k.label);
  tanda.dataset.s6 = k.status;
  const daftar = (x) => (Array.isArray(x) && x.length ? x.join(", ") : "tidak menerangkannya");
  tanda.title = `Saksi 1: ${daftar(k.saksi1)}. Saksi 2: ${daftar(k.saksi2)}. Keterangan satu saksi saja belum cukup (unus testis nullus testis).`;
  return tanda;
}
/* === AKHIR P1-P3-S6 === */

/** Kalimat keterangan yang memuat ciri - cadangan bila bot belum mengirim intiCiri. */
function a1CariKalimat(teks, ciri) {
  const butir = String(teks || "")
    .split(/\n+/)
    .map((x) => x.replace(/^[\s\-–•]+/, "").trim())
    .filter(Boolean);
  if (!butir.length) return "";
  const pasang = T6_KATA_GUGATAN.find(([label]) => label.test(ciri));
  let pola = pasang ? pasang[1] : null;
  if (!pola) {
    const kata = String(ciri || "")
      .split(/[^\p{L}]+/u)
      .filter((x) => x.length >= 5)
      .sort((a, b) => b.length - a.length)[0];
    if (!kata) return "";
    pola = new RegExp(t6Lolos(kata), "i");
  }
  const cocok = butir.find((b) => pola.test(b));
  return cocok ? t6Pendek(cocok, 220) : "";
}

/** Inti keterangan tiap saksi (dan posita) untuk satu huruf - isi ⓘ kenapa. */
function a1IntiKeterangan(k, h, saksi) {
  const s = saksi || {};
  const baris = [];
  const banyak = (h.pemicu || []).length > 1;
  for (const p of h.pemicu || []) {
    const nama = String(p || "");
    if (banyak) baris.push({ judul: a1Besar(nama) });
    if (/^lama pisah/i.test(nama)) {
      baris.push({ teks: "Dihitung dari keterangan saksi tentang pisah rumah - lihat usulan 9944 (Lama Pisah) di daftar Input ke ABT." });
      continue;
    }
    const inti = (Array.isArray(s.intiCiri) ? s.intiCiri : []).find((x) => x && t6Baku(x.ciri) === t6Baku(nama));
    if (inti) {
      baris.push({ teks: `Saksi 1: ${inti.saksi1 ? `"${t6Pendek(inti.saksi1, 220)}"` : "tidak menerangkannya."}` });
      baris.push({ teks: `Saksi 2: ${inti.saksi2 ? `"${t6Pendek(inti.saksi2, 220)}"` : "tidak menerangkannya."}` });
      baris.push({ teks: `Posita: ${inti.posita ? `"${t6Pendek(inti.posita, 220)}"` : s.gugatanTerbaca === true ? "tidak mendalilkannya." : "tidak terbaca."}` });
      continue;
    }
    const teks = (k && k.a1TeksSaksi) || {};
    const tanda = (Array.isArray(s.tandaSepihak) ? s.tandaSepihak : []).find((x) => x && t6Baku(x.ciri) === t6Baku(nama));
    for (const ke of [1, 2]) {
      const dariBot = tanda && Number(tanda.saksi) === ke ? tanda.kalimat : "";
      const kalimat = dariBot || a1CariKalimat(teks[ke], nama);
      baris.push({ teks: `Saksi ${ke}: ${kalimat ? `"${t6Pendek(kalimat, 220)}"` : "tidak ditemukan kalimatnya."}` });
    }
    baris.push({ teks: "(Perkiraan dari kata - ALETA Bot belum mengirim inti keterangan per alasan.)", lembut: true });
  }
  return baris;
}

function a1TombolInfo(jenis, judul) {
  const b = a1Tombol("ⓘ", judul, `aleta-a1-info aleta-a1-info-${jenis}`);
  b.appendChild(a1El("span", "aleta-a1-info-kata", jenis));
  b.setAttribute("aria-expanded", "false");
  return b;
}

/**
 * Menyusun satu blok huruf di UI Baru. Kelas lama (aleta-abt-huruf,
 * aleta-abt-huruf-nama, aleta-sore-huruf-sebab, aleta-abt-centang) tetap -
 * hiasan Tahap 6 (abt-18, abt-27) dan uji lama membacanya.
 */
function a1SusunHuruf(k, blok, label, h, saksi, sebab) {
  blok.setAttribute("data-a1-huruf", String(h.huruf || ""));
  const baris = buatElemen("div", "aleta-a1-huruf-baris");
  blok.insertBefore(baris, label);
  baris.appendChild(label);
  label.appendChild(buatElemen("span", "aleta-a1-simpul-huruf", a1KesimpulanHuruf(h, saksi)));
  const tandaS6 = a1TandaKesesuaian(h); // P1-P3-S6 10 Okt
  if (tandaS6) label.insertBefore(tandaS6, label.lastChild);

  const deret = a1El("span", "aleta-a1-ikon-deret");
  const tAturan = a1TombolInfo("aturan", `Aturan huruf ${h.huruf}: pasal dan syaratnya`);
  const tKenapa = a1TombolInfo("kenapa", `Kenapa huruf ${h.huruf} diambil: inti keterangan tiap saksi`);
  deret.appendChild(tAturan);
  deret.appendChild(tKenapa);
  baris.appendChild(deret);

  const kenapa = a1El("div", "aleta-a1-kenapa");
  kenapa.hidden = true;
  for (const x of a1IntiKeterangan(k, h, saksi)) {
    kenapa.appendChild(a1El("div", x.judul ? "aleta-a1-inti-judul" : `aleta-a1-inti${x.lembut ? " aleta-t6-lembut" : ""}`, x.judul || x.teks));
  }
  if (sebab && sebab.teks) kenapa.appendChild(buatElemen("div", "aleta-sore-huruf-sebab aleta-a1-sebab", sebab.teks));

  const aturan = a1El("div", "aleta-a1-aturan");
  aturan.hidden = true;
  if (h.syarat) aturan.appendChild(buatElemen("div", "aleta-abt-catatan", h.syarat));
  for (const d of h.dasar || []) {
    aturan.appendChild(buatElemen("div", "aleta-abt-naskah", (d.sumber && d.sumber.nama) || ""));
    aturan.appendChild(buatElemen("div", "aleta-abt-bunyi", d.bunyi || ""));
    if (d.catatanNaskah) aturan.appendChild(buatElemen("div", "aleta-abt-kutipan-sumber", d.catatanNaskah));
  }
  if (!h.syarat && !(h.dasar || []).length) aturan.appendChild(a1El("div", "aleta-t6-lembut", "Dasar hukum huruf ini belum dikirim ALETA Bot."));
  blok.appendChild(kenapa);
  blok.appendChild(aturan);

  const alih = (tombol, isi, lain, tombolLain) => {
    isi.hidden = !isi.hidden;
    tombol.setAttribute("aria-expanded", isi.hidden ? "false" : "true");
    // Satu terbuka dalam satu waktu: dua lipatan bersusun di kartu sempit sulit dibaca.
    if (!isi.hidden && !lain.hidden) {
      lain.hidden = true;
      tombolLain.setAttribute("aria-expanded", "false");
    }
    if (aturan.hidden) blok.removeAttribute("data-a1-aturan");
    else blok.setAttribute("data-a1-aturan", "buka");
    for (const c of Array.from(blok.children)) if (c.classList.contains("aleta-t6-pasal-sisip")) soreTampakkan(c, !aturan.hidden);
  };
  tAturan.addEventListener("click", () => alih(tAturan, aturan, kenapa, tKenapa));
  tKenapa.addEventListener("click", () => alih(tKenapa, kenapa, aturan, tAturan));
}

// ─── Butir 15: susun saksi - ⓘ, ⟳ ganti keterangan, ↶ ↷ ────────────────────

function a1HiasSdg(k) {
  for (const hasil of Array.from(k.isi.querySelectorAll(".aleta-sdg-hasil"))) {
    for (const b of Array.from(hasil.querySelectorAll(".aleta-sdg-baris"))) a1HiasBarisSdg(b);
    for (const c of Array.from(hasil.children)) {
      if (!c.classList.contains("aleta-abt-catatan")) continue;
      const teks = String(c.textContent || "");
      if (!teks.includes("Tanda 'varian habis'")) continue;
      c.textContent = teks.replace(
        "Tanda 'varian habis': bentuk kalimat pertanyaan itu lebih sedikit dari jumlah saksi.",
        "ⓘ \"ganti keterangan habis\": bentuk kalimat pertanyaan itu lebih sedikit dari jumlah saksi. ⟳ mengganti keterangan ke kalimat lain yang sama artinya, ↶ ↷ mengurungkan dan mengulanginya."
      );
    }
  }
}

function a1HiasBarisSdg(b) {
  const jawab = b.querySelector("textarea.aleta-sdg-jawab");
  if (!jawab) return;
  const alat = b.querySelector(".aleta-sdg-alat") || b;
  // Label lama tetap di DOM (dibaca hitungan beda Tahap 6); isinya pindah ke ⓘ.
  const garis = Array.from(b.children).find((c) => c.classList.contains("aleta-t6-beda"));
  const habis = b.querySelector(".aleta-sdg-varian-habis");
  const ket = Array.from(b.children).find((c) => c.classList.contains("aleta-t6-varian-ket"));
  for (const el of [garis, habis, ket]) if (el && !el.hidden) el.hidden = true;
  // ✎ abt-15 (saklar): "varian" menjadi "ganti keterangan".
  for (const v of Array.from(b.querySelectorAll(".aleta-t6-varian > .aleta-t6-tombol"))) {
    if (v.getAttribute("aria-label") !== "Buat varian") continue;
    v.setAttribute("aria-label", "Ganti keterangan - pilih dari daftar");
    v.title = "Ganti keterangan - susun kalimat lain yang sama artinya; dipilih, lalu boleh diubah";
  }
  let deret = Array.from(alat.children).find((c) => c.classList.contains("aleta-a1-sdg-deret"));
  let isi = Array.from(b.children).find((c) => c.classList.contains("aleta-a1-sdg-info-isi"));
  if (!deret || !isi) {
    deret = a1El("span", "aleta-a1-sdg-deret");
    const info = a1Tombol("ⓘ", "Catatan keterangan ini: sama atau beda dengan saksi lain, ganti keterangan habis", "aleta-a1-sdg-info");
    info.setAttribute("aria-expanded", "false");
    const ganti = a1Tombol("⟳", "Ganti keterangan ke kalimat lain yang sama artinya", "aleta-a1-ganti");
    const urung = a1Tombol("↶", "Urungkan ganti keterangan", "aleta-a1-urung");
    const ulang = a1Tombol("↷", "Ulangi ganti keterangan", "aleta-a1-ulang");
    deret.appendChild(info);
    deret.appendChild(ganti);
    deret.appendChild(urung);
    deret.appendChild(ulang);
    alat.appendChild(deret);
    isi = a1El("div", "aleta-a1-sdg-info-isi");
    isi.setAttribute("role", "note");
    isi.hidden = true;
    jawab.parentElement.insertBefore(isi, jawab);
    info.addEventListener("click", () => {
      isi.hidden = !isi.hidden;
      info.setAttribute("aria-expanded", isi.hidden ? "false" : "true");
    });
    ganti.addEventListener("click", () => a1GantiKeterangan(b, jawab));
    urung.addEventListener("click", () => a1LangkahGanti(b, jawab, "urung"));
    ulang.addEventListener("click", () => a1LangkahGanti(b, jawab, "ulang"));
  }
  a1SegarkanInfoSdg(b, deret, isi, garis, habis);
  a1SegarkanTombolGanti(b, jawab);
}

function a1SegarkanInfoSdg(b, deret, isi, garis, habis) {
  const info = deret.querySelector(".aleta-a1-sdg-info");
  const baris = [];
  let jenis = "";
  const sama = garis && garis.querySelector(".aleta-t6-lencana-sama");
  if (sama) {
    jenis = "sama";
    baris.push(`${a1Besar(String(sama.textContent || "").trim())} - ⟳ untuk mengganti keterangan.`);
  } else if (garis && b.hasAttribute("data-t6-beda")) {
    jenis = "beda";
    const label = garis.querySelector(".aleta-t6-lembut");
    const kata = Array.from(garis.querySelectorAll(".aleta-t6-sorot-kata")).map((x) => x.textContent);
    baris.push(`${a1Besar(String((label && label.textContent) || "beda dengan saksi lain: ").trim())} ${kata.join(", ")}`.trim());
  }
  if (habis) {
    if (!jenis) jenis = "habis";
    baris.push(`Ganti keterangan habis: ${String(habis.title || "semua bentuk kalimat untuk pertanyaan ini sudah terpakai").replace(/\s*Ubah bila perlu\.?$/, "")} ⟳ menyusun kalimat lain yang sama artinya.`);
  }
  if (!baris.length) baris.push("Tidak ada catatan untuk keterangan ini.");
  const kabar = isi.getAttribute("data-a1-kabar") || "";
  if (kabar) baris.push(kabar);
  const teks = baris.join("\n");
  if (isi.getAttribute("data-a1-teks") !== teks) {
    isi.setAttribute("data-a1-teks", teks);
    isi.textContent = "";
    for (const x of baris) isi.appendChild(a1El("div", "aleta-a1-sdg-info-baris", x));
  }
  if (info && info.getAttribute("data-a1-catatan") !== jenis) {
    if (jenis) info.setAttribute("data-a1-catatan", jenis);
    else info.removeAttribute("data-a1-catatan");
  }
}

function a1RiwayatGanti(jawab) {
  let r = a1GantiRiwayat.get(jawab);
  if (!r) {
    r = { asal: jawab.value, varian: t6VarianKalimat(jawab.value), urung: [], ulang: [] };
    a1GantiRiwayat.set(jawab, r);
  }
  return r;
}

function a1SetelJawab(jawab, nilai) {
  jawab.value = nilai;
  jawab.dispatchEvent(new Event("input", { bubbles: true }));
}

function a1KabarSdg(b, teks) {
  const isi = Array.from(b.children).find((c) => c.classList.contains("aleta-a1-sdg-info-isi"));
  if (!isi) return;
  if (teks) isi.setAttribute("data-a1-kabar", teks);
  else isi.removeAttribute("data-a1-kabar");
  const deret = b.querySelector(".aleta-a1-sdg-deret");
  if (deret) {
    const garis = Array.from(b.children).find((c) => c.classList.contains("aleta-t6-beda"));
    a1SegarkanInfoSdg(b, deret, isi, garis, b.querySelector(".aleta-sdg-varian-habis"));
  }
  if (teks) {
    isi.hidden = false;
    const info = b.querySelector(".aleta-a1-sdg-info");
    if (info) info.setAttribute("aria-expanded", "true");
  }
}

/**
 * ⟳: keterangan berikutnya dari daur [asal, varian 1, varian 2, ...]. Kalimat
 * yang diketik petugas sendiri menjadi asal yang baru - variannya dihitung
 * ulang dari kalimat itu, bukan dari usulan semula.
 */
function a1GantiKeterangan(b, jawab) {
  const r = a1RiwayatGanti(jawab);
  const kini = jawab.value;
  if (kini !== r.asal && !r.varian.includes(kini)) {
    r.asal = kini;
    r.varian = t6VarianKalimat(kini);
  }
  const daur = [r.asal, ...r.varian];
  if (daur.length < 2) {
    a1KabarSdg(b, "Tidak ada keterangan pengganti otomatis untuk kalimat ini - ubah sendiri di kotaknya.");
    return;
  }
  const berikut = daur[(daur.indexOf(kini) + 1) % daur.length];
  r.urung.push(kini);
  r.ulang.length = 0;
  a1SetelJawab(jawab, berikut);
  a1KabarSdg(b, "");
  a1SegarkanTombolGanti(b, jawab);
}

function a1LangkahGanti(b, jawab, arah) {
  const r = a1RiwayatGanti(jawab);
  const dari = arah === "urung" ? r.urung : r.ulang;
  const ke = arah === "urung" ? r.ulang : r.urung;
  if (!dari.length) return;
  ke.push(jawab.value);
  a1SetelJawab(jawab, dari.pop());
  a1SegarkanTombolGanti(b, jawab);
}

function a1SegarkanTombolGanti(b, jawab) {
  const r = a1GantiRiwayat.get(jawab);
  const urung = b.querySelector(".aleta-a1-urung");
  const ulang = b.querySelector(".aleta-a1-ulang");
  const nUrung = r ? r.urung.length : 0;
  const nUlang = r ? r.ulang.length : 0;
  if (urung && urung.disabled !== (nUrung === 0)) urung.disabled = nUrung === 0;
  if (ulang && ulang.disabled !== (nUlang === 0)) ulang.disabled = nUlang === 0;
}

// ─── Butir 11: unggah putusan perkara ini ───────────────────────────────────

/** Token blangko HALAMAN INI dari tautan CETAK (a, b, d). */
function a1TokenHalaman() {
  const t = document.querySelector('a[href*="abt/preview"]');
  if (!t || typeof alatTokenDariTautan !== "function") return null;
  const token = alatTokenDariTautan(t);
  return token && token.a && token.b ? token : null;
}

function a1NomorDariVariabel() {
  const m = String(nilaiVariabel("0001") || "").match(/\d{1,5}\/[A-Za-z.]+\/\d{4}\/[A-Za-z.]+/);
  return m ? m[0] : "";
}

/**
 * Blangko yang dipakai = blangko yang SEDANG DIBUKA. Sampai 1.176.0 yang
 * terpilih baris pertama pemetaan menurut abjad - perkara cerai talak dapat
 * berangkat dengan blangko cerai gugat - dan tanpa pemetaan tombolnya buntu.
 */
function a1PilihBlangkoHalaman(pilih, peta) {
  const token = a1TokenHalaman();
  if (!token || !pilih) return;
  const cocok = Object.keys(peta || {}).find((x) => peta[x] && peta[x].a === token.a && peta[x].b === token.b && alatBlangkoLengkap(peta[x]));
  if (cocok && Array.from(pilih.options).some((o) => o.value === cocok)) {
    pilih.value = cocok;
    pilih.title = "Dipilih sendiri: blangko yang sedang dibuka di halaman ini.";
    return;
  }
  let o = Array.from(pilih.options).find((x) => x.value === A1_BLANGKO_HALAMAN);
  if (!o) {
    o = document.createElement("option");
    o.value = A1_BLANGKO_HALAMAN;
    o.textContent = "Blangko halaman ini (dari tautan CETAK)";
    pilih.insertBefore(o, pilih.firstChild);
  }
  pilih.value = A1_BLANGKO_HALAMAN;
  pilih.title = "Blangko yang sedang dibuka di halaman ini - tokennya dibaca dari tautan CETAK.";
}

/** Dipanggil tombol "Kerjakan perkara ini" (UI Baru): nomor dan peta blangko. */
function a1SiapkanUnggahSatu(jenis, nomor, unggah) {
  const nomorPakai = nomor || a1NomorDariVariabel();
  if (unggah && !nomorPakai) {
    throw new Error("Nomor perkara tidak terbaca dari kepala halaman maupun variabel 0001 - unggah ke SIPP membutuhkannya.");
  }
  if (jenis !== A1_BLANGKO_HALAMAN) return { nomor: nomorPakai, peta: null };
  const t = a1TokenHalaman();
  if (!t) throw new Error("Tautan CETAK halaman ini tidak terbaca - pilih blangko dari daftar.");
  return { nomor: nomorPakai, peta: { a: t.a, b: t.b, d: t.d || "", berkas: "blangko halaman ini", jenisAsli: "blangko halaman ini" } };
}

/** Hasil per langkah di bawah kalimat ringkasnya - yang gagal disebut dengan jalan keluarnya. */
function a1GambarLangkahUnggah(kabar, hasil) {
  const bagian = String((hasil && hasil.ringkas) || "")
    .split(" · ")
    .map((x) => x.trim())
    .filter(Boolean);
  if (!bagian.length) return;
  const daftar = a1El("ul", "aleta-a1-langkah");
  const buruk = /gagal|dibatalkan|ditolak|TIDAK diunggah|tidak dibuat/i;
  for (const x of bagian) daftar.appendChild(a1El("li", buruk.test(x) ? "aleta-a1-langkah-gagal" : "aleta-a1-langkah-ok", `${buruk.test(x) ? "✗" : "✓"} ${x}`));
  kabar.appendChild(daftar);
  const semua = bagian.join(" ");
  const saran = [];
  if (/RTF gagal/i.test(semua)) saran.push("RTF tidak terambil - muat ulang halaman ABT (sesi ABT), lalu ulangi.");
  if (/\b423\b|mode coba/i.test(semua)) saran.push("Mode coba menahan tulisan - nyalakan \"Izinkan tindakan nyata\" untuk benar-benar menyimpan dan mengunggah.");
  if (/anonim[^·]*gagal|anonimisasi gagal/i.test(semua)) saran.push("Anonimisasi ABT gagal - putusan tetap diunggah bila dicentang; samarkan di ABT lalu tekan Kerjakan lagi.");
  for (const s of saran) kabar.appendChild(a1El("div", "aleta-t6-lembut aleta-a1-saran", s));
}

// ─── Butir 13 dan 14: putusan massal ABT ────────────────────────────────────

/** Nama hakim ketua dari "Ketua, S.H., Anggota, M.H." - gelar tidak dipisah dari namanya. */
function a1KetuaMajelis(majelisNama) {
  const potong = String(majelisNama || "")
    .split(/\s*,\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  const gelar = (x) => !/\s/.test(x) && x.length <= 8 && (/\./.test(x) || /^(MA|MH|SH|SHI|Lc|MAg|SAg|MSi|MHI)$/i.test(x));
  const orang = [];
  for (const x of potong) {
    if (orang.length && gelar(x)) orang[orang.length - 1] += `, ${x}`;
    else orang.push(x);
  }
  return orang[0] || "";
}

/** Sama dengan alatSidangPadaTanggal (permintaan yang SAMA), ditambah ruas yang dibuangnya. */
async function a1SidangPadaTanggal(tanggalIso) {
  const q = new URLSearchParams({ dari: tanggalIso, sampai: tanggalIso, batas: "300" });
  const respons = await alatAmbil(`${A1_API_SIDANG}?${q.toString()}`, { credentials: "include", cache: "no-store" }, "Membaca jadwal sidang");
  if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Membaca jadwal sidang"));
  const luar = await respons.json();
  const isi = luar && luar.data ? luar.data : luar;
  if (!isi || isi.available === false) throw new Error((isi && isi.message) || "ALETA belum dapat membaca jadwal sidang.");
  const per = new Map();
  for (const s of Array.isArray(isi.sidang) ? isi.sidang : []) {
    const nomor = String(s.nomorPerkara || "");
    if (!nomor || per.has(nomor)) continue;
    const ketua = a1KetuaMajelis(s.majelisNama);
    per.set(nomor, {
      nomor,
      perkaraId: String(s.perkaraId || ""),
      jenis: String(s.jenisPerkara || ""),
      agenda: String(s.agenda || ""),
      sudahPutus: Boolean(s.sudahPutus),
      statusPutusan: String(s.statusPutusan || ""),
      verstek: Boolean(s.verstekPutusan),
      ditunda: Boolean(s.ditunda),
      ikrar: Boolean(s.sidangIkrarTalak),
      jam: String(s.jamSidang || ""),
      alasanDitunda: String(s.alasanDitunda || ""),
      tanggalPutusan: String(s.tanggalPutusan || ""),
      majelisNama: String(s.majelisNama || ""),
      pengguna: { id: soreBakuNamaAkun(ketua) || "-", nama: ketua || "Majelis belum tercatat" },
      mentah: s,
    });
  }
  return [...per.values()];
}

/**
 * Butir 13: perkara yang hari itu PUTUS, atau DITUNDA untuk putusan /
 * musyawarah majelis. Keterangan (alasan ditunda) yang menentukan; agenda
 * hanya bila keterangannya belum ada. Fungsi agen M (K4) didahulukan.
 */
function a1PutusanLayak(s, tanggal) {
  if (typeof aletaMassalPutusanLayak === "function") {
    try {
      return Boolean(aletaMassalPutusanLayak({ ...(s.mentah || {}), ...s, keterangan: s.alasanDitunda, tanggalSidang: tanggal }));
    } catch {
      /* fungsi agen M menolak bentuk ini - aturan di bawah yang dipakai */
    }
  }
  if (s.sudahPutus && String(s.tanggalPutusan || "").slice(0, 10) === String(tanggal || "")) return true;
  const ket = String(s.alasanDitunda || "").trim().toLowerCase();
  if (/putus|musyawarah/.test(ket)) return !/belum\s+putus|tidak\s+putus/.test(ket);
  if (!ket || ket === "0") return /putus|musyawarah/i.test(String(s.agenda || ""));
  return false;
}

/** [{pengguna, perkara}] - fungsi agen M bila ada (K4), selain itu per hakim ketua. */
function a1Kelompokkan(daftar) {
  if (typeof aletaMassalKelompokkan === "function") {
    try {
      const h = aletaMassalKelompokkan(daftar, "pengguna");
      if (Array.isArray(h) && h.every((g) => g && g.pengguna && Array.isArray(g.perkara))) {
        return h.map((g) => ({
          pengguna: { id: String(g.pengguna.id || g.pengguna.nama || "-"), nama: String(g.pengguna.nama || "Majelis belum tercatat") },
          perkara: g.perkara,
        }));
      }
    } catch {
      /* bentuk lain - dikelompokkan di sini */
    }
  }
  const peta = new Map();
  for (const s of daftar) {
    const p = s.pengguna || { id: "-", nama: "Majelis belum tercatat" };
    if (!peta.has(p.id)) peta.set(p.id, { pengguna: p, perkara: [] });
    peta.get(p.id).perkara.push(s);
  }
  return [...peta.values()].sort((a, b) => (a.pengguna.id === "-") - (b.pengguna.id === "-") || a.pengguna.nama.localeCompare(b.pengguna.nama, "id"));
}

/** Kelompok per hakim (Admin/Super Admin) - pulang nomor → wadah barisnya. */
function a1GambarKelompok(daftar, tampil, opsi) {
  const peta = new Map();
  // Perbaikan 2 Okt butir 19 + 7: kelompok milik akun yang masuk terbuka
  // (tanpa itu: kelompok pertama), yang lain tertutup; tag peran "Hakim".
  const kelompok = a1Kelompokkan(tampil);
  const namaSaya = soreBakuNamaAkun((penggunaAletaAbt && penggunaAletaAbt.nama) || "");
  const adaMilikSaya = kelompok.some((g) => g.pengguna.id === namaSaya);
  for (const [ke, g] of kelompok.entries()) {
    const layak = g.perkara.filter((s) => !s.sudahPutus);
    const nCentang = layak.filter((s) => opsi.dicentang.has(s.nomor)).length;
    let akar = null;
    let isi = null;
    if (typeof alatLipat === "function") {
      try {
        const terbuka = adaMilikSaya ? g.pengguna.id === namaSaya : ke === 0;
        const l = alatLipat(g.pengguna.nama, { kunci: `abt-massal-hakim:${g.pengguna.id}`, terbuka, lencana: String(g.perkara.length), peran: "Hakim" });
        akar = l && l.akar;
        isi = l && l.isi;
      } catch {
        akar = null;
      }
    }
    if (!akar || !isi) {
      akar = buatElemen("div", "aleta-a1-kelompok");
      akar.appendChild(buatElemen("div", "aleta-a1-kelompok-kepala", `${g.pengguna.nama} · ${g.perkara.length} perkara`));
      isi = buatElemen("div", "aleta-a1-kelompok-isi");
      akar.appendChild(isi);
    }
    akar.classList.add("aleta-a1-kelompok");
    akar.setAttribute("data-a1-pengguna", g.pengguna.id);
    const semua = buatElemen("label", "aleta-massal-baris aleta-a1-kelompok-semua");
    const c = document.createElement("input");
    c.type = "checkbox";
    c.className = "aleta-massal-centang";
    c.checked = layak.length > 0 && nCentang === layak.length;
    c.indeterminate = nCentang > 0 && nCentang < layak.length;
    c.disabled = layak.length === 0;
    semua.appendChild(c);
    semua.appendChild(buatElemen("span", "aleta-massal-nomor", `Kerjakan semua milik ${g.pengguna.nama}`));
    semua.appendChild(buatElemen("span", "aleta-massal-keadaan", `${nCentang} dari ${layak.length} dicentang`));
    c.addEventListener("change", () => {
      for (const s of layak) {
        if (c.checked) opsi.dicentang.add(s.nomor);
        else opsi.dicentang.delete(s.nomor);
      }
      opsi.ubah(`Centang milik ${g.pengguna.nama} berubah`);
    });
    isi.appendChild(semua);
    daftar.appendChild(akar);
    for (const s of g.perkara) peta.set(s.nomor, isi);
  }
  return peta;
}

/**
 * Pemasang butir 13-14 di bagian Putusan massal (UI Baru). Pulang kait yang
 * dipanggil bagianMassalAbt: saatDimuat, saring, kelompok.
 */
function a1PasangMassal(keadaan, saring, bilah) {
  const golongan = soreGolongan(sorePeranAktif());
  const admin = golongan === "admin";
  const namaAkun = soreBakuNamaAkun((penggunaAletaAbt && penggunaAletaAbt.nama) || "");
  const opsi = document.createElement("option");
  opsi.value = "layak";
  opsi.textContent = "Putus / tunda untuk putusan";
  saring.insertBefore(opsi, saring.firstChild);
  saring.value = "layak";
  let milik = null;
  if (!admin && (golongan === "hakim" || golongan === "ketua") && namaAkun.length >= 4) {
    const l = buatElemen("label", "aleta-a1-milik");
    milik = document.createElement("input");
    milik.type = "checkbox";
    milik.className = "aleta-massal-centang";
    milik.checked = true;
    l.appendChild(milik);
    l.appendChild(buatElemen("span", "", "Hanya majelis saya"));
    l.title = "Perkara yang majelisnya memuat nama akun Anda. Matikan untuk melihat seluruh majelis.";
    bilah.appendChild(l);
    milik.addEventListener("change", () => saring.dispatchEvent(new Event("change")));
  }
  const punyaSaya = (s) => ` ${soreBakuTeks(s.majelisNama)} `.includes(` ${namaAkun} `);
  return {
    saatDimuat(kabar) {
      const layak = keadaan.sidang.filter((s) => a1PutusanLayak(s, keadaan.tanggal));
      let teks =
        `${keadaan.sidang.length} perkara bersidang; ${layak.length} putus atau ditunda untuk putusan/musyawarah - hanya itu yang ditampilkan ` +
        "(saringan \"Semua perkara\" menampilkan seluruhnya). Tidak ada yang tercentang sendiri.";
      if (milik) {
        const n = keadaan.sidang.filter(punyaSaya).length;
        if (!n && milik.checked) {
          milik.checked = false;
          teks += " Nama Anda tidak terbaca di majelis perkara mana pun pada tanggal ini - seluruh majelis ditampilkan.";
        }
      }
      if (admin) teks += " Dikelompokkan per hakim ketua majelis.";
      kabar.textContent = teks;
    },
    saring(hasil, pilihSaring) {
      let h = hasil;
      if (pilihSaring === "layak") h = h.filter((s) => a1PutusanLayak(s, keadaan.tanggal));
      if (milik && milik.checked) h = h.filter(punyaSaya);
      return h;
    },
    kelompok(daftar, tampil, o) {
      return admin ? a1GambarKelompok(daftar, tampil, o) : null;
    },
  };
}

/*
 * ============================================================================
 * PERBAIKAN 2 OKT 2026 - PANEL ABT (AGEN A)
 * ============================================================================
 *
 * Sumber: pesan pengguna sesudah memakai 1.177.0 (tangkapan 133-135). Tampilan
 * berubah HANYA di UI Baru (t6Modern()); Lama dan Baru tetap seperti 1.177.0
 * (ekstensi-abt-tahap6 "SYARAT MUTLAK", ekstensi-abt-sederhana,
 * ekstensi-abt-1okt). Pengecualian: butir 14 (jeda sebelum menulis) global.
 *
 *   butir 5   ACCORDION MACET. Sebab sebenarnya: kepala "Susun keterangan
 *             saksi" dan "Isi dari SIPP & input ke ABT" dijadikan lipatan
 *             (alatJadikanLipat, asal "kartu") pada div yang HANYA memuat
 *             kepala + baris status. Isinya - penyunting saksi, kartu selisih,
 *             huruf alasan, usulan, Input ke ABT - digambar tombol lama ke
 *             wadah aleta-abt-daftar SESAUDARA di bawahnya (dan wadah usulan
 *             dipakai bergantian oleh keduanya). CSS lipatan menyembunyikan
 *             anak lipatan saja, jadi menutup hanya menyembunyikan status.
 *             Wadahnya tidak dipindah (Tahap 6 dan tombol lama memegangnya
 *             lewat rujukan dan isi.children); sebagai gantinya tiap wadah
 *             diberi pemilik (a2AnggotaBagian) dan diberi data-a2-terlipat
 *             selama pemiliknya tertutup - panel.css blok A2 menyembunyikannya.
 *             Diselaraskan pada peristiwa aleta-lipat-berubah (seketika), pada
 *             perubahan atribut data-terbuka (pemulihan ingatan asinkron), dan
 *             pada tiap penataan ulang (wadah usulan berganti pemilik).
 *   butir 6   Susun keterangan saksi: menu alatMenuPeran "susun-saksi" hanya
 *             golongan panitera (Panitera, Panitera Pengganti, Panitera
 *             Sidang) + Admin/Super Admin ("semua"); Tahap 6 menahan tombolnya
 *             (T6_PERAN_SDG). Yang tidak berhak mendapat kalimat yang benar
 *             ("hanya untuk panitera ...") bukan "tidak tersedia di blangko".
 *   butir 7   tag peran di kepala lipatan (opsi `peran`, agen W): Susun saksi
 *             = Panitera; Isi dari SIPP, Unggah putusan, Alasan = Hakim;
 *             Juru Sita = jurusita.
 *   butir 8   jawaban saksi yang BELUM TERDETEKSI ("...", "…", "_", #0000#):
 *             ringkasan jumlah di atas penyunting (+ "Ke berikutnya", "Hanya
 *             yang belum"), dan per baris: ✎ Sunting (memilih titik-titiknya),
 *             isian dari sumber yang ada (variabel blangko, saksi lain, usulan
 *             bacaan Isi dari SIPP, butir posita), dan "Diisi di sidang"
 *             (tanda pratinjau). Semuanya pratinjau sampai Simpan ditekan.
 *   butir 9   kartu "Dirapikan otomatis" (posita 5125, saksi 2021/2022) TIDAK
 *             tampil; tetap dikerjakan dan tetap tercentang, ikut tersimpan
 *             saat Input ke ABT. Dapat dilihat lewat ⋯ → Lihat yang dirapikan.
 *   butir 3   putusan massal: "Blangko utama" di atas daftar; per perkara
 *             tombol "Blangko berbeda…" (aletaMassalBarisBlangko agen R bila
 *             ada) membuka pilihan blangko perkara itu.
 *   butir 14  tulisan LANGSUNG ke ABT (simpanVariabel, simpanKeteranganSaksi,
 *             kirimTanyaJawab) didahului alatJedaManusia "simpan" (agen W) -
 *             GLOBAL (Lama, Baru, UI Baru). Tulisan lewat bot ALETA (posita
 *             SIPP, unggah putusan) diberi jeda oleh bot (agen E) - tidak
 *             digandakan di sini. Tidak ada penanda ALETA yang disisipkan ke
 *             isian ABT; tooltip sel ABT tidak lagi menyebut ALETA.
 *   butir 19  bawaan buka/tutup per peran: bagian utama terbuka, sekunder
 *             tertutup (lipatan dipasang sesudah menu peran diketahui).
 *             Ingatan buka/tutup orang (lipatTerbuka) tetap menang.
 *
 * Tidak ada kunci penyimpanan, rute, atau jalur tulis baru.
 */
/** Peran pemilik tiap bagian - tag di kepala lipatan (butir 7). */
const A2_PERAN_BAGIAN = Object.freeze({
  "abt:isi-input": "Hakim",
  "abt:susun-saksi": "Panitera",
  "abt:unggah-putusan": "Hakim",
  "abt:alasan": "Hakim",
  "abt:jurusita": "jurusita",
});
/** Bagian UTAMA per golongan (butir 19) - bawaan terbuka; sisanya tertutup. */
const A2_UTAMA = Object.freeze({
  admin: "abt:isi-input",
  ketua: "abt:isi-input",
  hakim: "abt:isi-input",
  panitera: "abt:susun-saksi",
  jurusita: "abt:jurusita",
});
/** Kata tanya yang tidak membedakan butir posita (butir 8, sumber posita). */
const A2_KATA_UMUM = new Set([
  "apakah", "bagaimana", "berapa", "kapan", "siapa", "mengapa", "kenapa", "dimana", "saudara", "saksi",
  "penggugat", "tergugat", "pemohon", "termohon", "mengetahui", "tersebut", "dengan", "antara", "selama",
  "sampai", "sekarang", "pernah", "masih", "sudah", "bahwa", "karena",
]);
/** Tanda "diisi di sidang" per penyunting: kunci baris -> true (pratinjau, tidak disimpan). */
const a2TandaSidang = new WeakMap();

function a2El(tag, kelas, teks) {
  return t6El(tag, `aleta-a2${kelas ? ` ${kelas}` : ""}`, teks);
}

function a2Tombol(teks, judul, kelas) {
  const b = t6Tombol(teks, judul, `aleta-a2-tombol${kelas ? ` ${kelas}` : ""}`);
  b.classList.add("aleta-a2");
  return b;
}

// ─── Butir 14: jeda seperti manusia sebelum menulis (global) ────────────────

/**
 * alatJedaManusia (panel-alat.js, agen W) - tanpa jeda dalam mode kering,
 * latihan, dan coba yang menahan alamat itu. Fungsinya belum ada = tanpa jeda.
 */
async function a2JedaTulis(jenis, alamat) {
  // 1.184.0 (5 Okt 2026, butir 16): TANPA jeda untuk tulisan ke ABT - keputusan
  // pengguna ("Tanpa jeda di ABT"), menggantikan butir 14 (2 Okt) KHUSUS ABT.
  // ±75% waktu "Input ke ABT" adalah jeda 0,9-2,2 detik per variabel. SIPP
  // dan e-Court tetap berjeda (alatJedaManusia di konten.js dan bot). Riwayat
  // ALETA tetap jujur dan lengkap (catatRiwayat). Tulisan ke ABT tetap satu
  // per satu - ABT tidak pernah menerima dua tulisan sekaligus.
  void jenis;
  void alamat;
}

// ─── Butir 19 + 7: bawaan buka/tutup dan tag peran ──────────────────────────

/** Bawaan terbuka bagian `kunci` untuk peran panel ini (ingatan orang tetap menang). */
function a2BukaBawaan(k, kunci) {
  if (!k || !Array.isArray(k.menu)) return true;
  const utama = A2_UTAMA[k.golongan];
  if (!utama) return true;
  // Alasan perceraian duduk di dalam bagian Isi dari SIPP - ikut induknya.
  if (kunci === "abt:alasan") return true;
  return kunci === utama;
}

/** Tag peran di KIRI judul, tepat sesudah panah lipat - sama dengan panel-alat.js dan konten.js (butir 5, 2 Okt sore). */
function a2TagPeran(el, kunci) {
  const peran = A2_PERAN_BAGIAN[kunci];
  const p = el && el.__aletaLipat;
  const kepala = p && p.kepala;
  if (!peran || !kepala) return;
  let tag = kepala.querySelector(":scope > .aleta-lipat-peran");
  if (!tag) {
    tag = a2El("span", "aleta-lipat-peran aleta-a2-peran", peran === "jurusita" ? "Juru Sita" : peran);
    tag.title = `Bagian ini untuk: ${tag.textContent}`;
    kepala.appendChild(tag);
  }
  const judul = kepala.querySelector(":scope > .aleta-sore-kerja-judul, :scope > .aleta-abt-judul, :scope > .aleta-abt-nama");
  if (judul && tag.nextSibling !== judul) kepala.insertBefore(tag, judul);
}

// ─── Butir 5: isi bagian yang tertutup benar-benar tersembunyi ──────────────

/** Wadah sesaudara milik tiap bagian kerja - lihat catatan butir 5. */
function a2AnggotaBagian(k) {
  const isi = [];
  const susun = [];
  const w = k.wadah || {};
  for (const el of [w.selisih, w.sepihak, w.huruf]) if (el) isi.push(el);
  if (w.usulan) (w.usulan.querySelector(".aleta-sdg-form, .aleta-sdg-hasil") ? susun : isi).push(w.usulan);
  for (const el of Array.from(k.isi.children)) {
    if (el.classList.contains("aleta-t6-usulan-sipp") || el.classList.contains("aleta-t6-usulan-judul")) isi.push(el);
  }
  return { isi, susun };
}

function a2Tertutup(el) {
  return Boolean(el && el.classList.contains("aleta-lipatan") && el.getAttribute("data-terbuka") === "tidak");
}

function a2Tandai(daftar, terlipat) {
  for (const el of daftar) {
    if (terlipat) {
      if (el.getAttribute("data-a2-terlipat") !== "ya") el.setAttribute("data-a2-terlipat", "ya");
    } else if (el.hasAttribute("data-a2-terlipat")) {
      el.removeAttribute("data-a2-terlipat");
    }
  }
}

function a2SelaraskanLipat(k) {
  if (!k || soreKeadaan !== k || !t6Modern()) return;
  const { isi, susun } = a2AnggotaBagian(k);
  // Yang tidak lagi dimiliki siapa pun (wadah usulan berganti pemilik) dilepas lebih dahulu.
  a2Tandai(isi, a2Tertutup(k.kerjaIsi));
  a2Tandai(susun, a2Tertutup(k.kerjaSusun));
  a2AmatiLipat(k);
}

/** Sekali per panel: peristiwa lipatan (seketika) dan atribut data-terbuka (pemulihan ingatan). */
function a2AmatiLipat(k) {
  if (k.a2Diamati) return;
  k.a2Diamati = true;
  k.isi.addEventListener("aleta-lipat-berubah", () => a2SelaraskanLipat(k));
  try {
    const p = new MutationObserver(() => a2SelaraskanLipat(k));
    for (const el of [k.kerjaIsi, k.kerjaSusun]) if (el) p.observe(el, { attributes: true, attributeFilter: ["data-terbuka"] });
    // Wadah usulan berganti pemilik (penyunting saksi digambar / diganti
    // usulan) - diselaraskan seketika, tidak menunggu penataan berjeda.
    // Penyelarasan hanya mengubah atribut, jadi pengamat ini tidak berputar.
    if (k.wadah && k.wadah.usulan) p.observe(k.wadah.usulan, { childList: true });
    k.pengamat.push(p);
  } catch {
    /* tanpa pengamat: diselaraskan pada penataan berikutnya */
  }
}

/** Tombol kerja di kepala (Susun, Baca ulang) ditekan: bagiannya dibuka - hasilnya tidak tersembunyi. */
function a2BukaBagian(k, el) {
  if (!t6Modern() || !el) return;
  const p = el.__aletaLipat;
  if (p && typeof p.terbuka === "function" && !p.terbuka()) p.buka(true);
  a2SelaraskanLipat(k);
}

// ─── Butir 6: susun saksi bagi yang tidak berhak ────────────────────────────

/** UI Baru: kalimat bagi peran yang tidak berhak menyusun keterangan saksi; "" = berhak. */
function a2SusunDitolak(k) {
  if (!t6Modern()) return "";
  // Peran dibaca langsung (bukan t6Keadaan.peran yang diisi pewaktu 250 ms
  // Tahap 6 - tombol yang ditekan sebelum pewaktu itu berdetak lolos).
  const kelas = t6KelasPeran(sorePeranAktif() || (k && k.peran) || "");
  if (!kelas || T6_PERAN_SDG.has(kelas)) return "";
  return "Susun keterangan saksi hanya untuk panitera, panitera pengganti, dan Admin.";
}

// ─── Butir 9: kartu dirapikan tidak tampil, tetap dikerjakan ────────────────

/** Butir ⋯ "Lihat yang dirapikan" - hanya bila ada yang dirapikan. */
function a2ButirMenuRapi(k, laci) {
  if (!t6Modern() || !k.a2RapiAda || !k.a2RapiWadah || !k.a2RapiWadah.isConnected) return;
  const lihat = Boolean(k.a2LihatRapi);
  const b = t6Tombol(
    lihat ? "Sembunyikan yang dirapikan" : "Lihat yang dirapikan",
    "Posita dan keterangan saksi yang dirapikan otomatis - ikut tersimpan saat Input ke ABT",
    "aleta-t6-kecil aleta-sore-menu-butir aleta-a2-menu-rapi"
  );
  b.setAttribute("role", "menuitemcheckbox");
  b.setAttribute("aria-pressed", lihat ? "true" : "false");
  b.addEventListener("click", () => {
    k.a2LihatRapi = !k.a2LihatRapi;
    k.a2RapiWadah.hidden = !k.a2LihatRapi;
    // Hitungan di tombol Input ke ABT ikut (pendengar change wadah usulan).
    k.a2RapiWadah.dispatchEvent(new Event("change", { bubbles: true }));
    if (k.menuLaci) k.menuLaci.removeAttribute("data-sore-sidik");
    soreSegarkan(k);
  });
  laci.appendChild(b);
}

function a2SidikMenuRapi(k) {
  return t6Modern() && k.a2RapiAda ? `|a2rapi:${k.a2LihatRapi ? 1 : 0}` : "";
}

// ─── Butir 8: jawaban saksi yang belum terdeteksi ───────────────────────────

function a2KunciBaris(hasil, b) {
  const kolom = t6KolomSaksi(hasil).find((c) => c.baris.includes(b));
  const tanya = t6Baku((b.querySelector(".aleta-sdg-tanya") || {}).textContent);
  return `${kolom ? kolom.judul : "?"}|${tanya}`;
}

function a2Tanda(hasil) {
  let m = a2TandaSidang.get(hasil);
  if (!m) {
    m = new Map();
    a2TandaSidang.set(hasil, m);
  }
  return m;
}

/** Isian tambahan untuk jawaban kosong: usulan bacaan Isi dari SIPP, lalu butir posita. */
function a2TawaranTambahan(tanya, sudah) {
  const tambah = [];
  const peta = barisVariabel();
  const data = soreSinggah.get(soreKunciHalaman("isi"));
  const usulan = [];
  for (const sumber of data ? [data.saksi, data.sipp, data.itsbat, data.lain] : []) for (const u of (sumber && sumber.usulan) || []) usulan.push(u);
  for (const [pola, kode, nama] of T6_SUMBER_JAWAB) {
    if (!pola.test(tanya)) continue;
    const item = peta.get(kode);
    if (item && keadaanNilai(item.nilai) === "terisi") continue;
    const u = usulan.find((x) => x && String(x.kode) === kode && String(x.nilai || "").trim());
    if (u) tambah.push({ label: `${kode} ${nama} (usulan)`, isi: String(u.nilai).replace(/\s+/g, " ").trim(), cara: "sisip" });
  }
  if (!sudah && !tambah.length) {
    const posita = peta.get(VAR_POSITA);
    const teks = posita ? String(posita.selNilai.innerText || "") : "";
    const kata = Array.from(new Set(t6KataDari(tanya).filter((x) => x.length >= 5 && !A2_KATA_UMUM.has(x))));
    if (teks && kata.length) {
      const butir = teks
        .split(/\n+|(?<=;)\s*(?=\d{1,2}\.\s)/)
        .map((x) => x.replace(/^\s*\d{1,2}\.\s*/, "").trim())
        .filter((x) => x.length > 20);
      let terbaik = null;
      let skor = 1;
      for (const x of butir) {
        const ada = new Set(t6KataDari(x));
        const n = kata.filter((w) => ada.has(w)).length;
        if (n > skor) {
          skor = n;
          terbaik = x;
        }
      }
      if (terbaik) tambah.push({ label: "Butir posita (periksa)", isi: t6Pendek(terbaik.replace(/^bahwa\s+/i, ""), 400), cara: "ganti" });
    }
  }
  return tambah;
}

/** Ujung titik-titik di kotak jawaban dipilih - yang diketik langsung menggantikannya. */
function a2SuntingLangsung(jawab) {
  try {
    jawab.focus();
    const m = /\.{3,}|…|_{2,}|#\d{4}#/.exec(jawab.value);
    if (m && typeof jawab.setSelectionRange === "function") jawab.setSelectionRange(m.index, m.index + m[0].length);
    jawab.scrollIntoView({ block: "center" });
  } catch {
    /* fokus hanya kenyamanan */
  }
}

/** Hiasan UI Baru pada kotak "belum terisi" satu baris (dipanggil t6TandaiBelum). */
function a2HiasBelum(hasil, b, kotak, jawab) {
  const kunci = a2KunciBaris(hasil, b);
  const tanda = a2Tanda(hasil);
  const lencana = kotak.querySelector(".aleta-t6-lencana-belum");
  const segar = () => {
    const sidang = tanda.get(kunci) === true;
    if (sidang) b.setAttribute("data-a2-sidang", "ya");
    else b.removeAttribute("data-a2-sidang");
    if (lencana) lencana.textContent = sidang ? "diisi di sidang" : "belum terisi";
    const t = kotak.querySelector(".aleta-a2-sidang");
    if (t) {
      t.textContent = sidang ? "Batalkan tanda sidang" : "Diisi di sidang";
      t.setAttribute("aria-pressed", sidang ? "true" : "false");
    }
  };
  kotak.classList.add("aleta-a2-belum");
  if (!kotak.querySelector(".aleta-a2-sunting")) {
    const deret = a2El("span", "aleta-a2-belum-deret");
    const sunting = a2Tombol("✎ Sunting", "Ketik langsung - titik-titiknya terpilih, yang diketik menggantikannya", "aleta-t6-kecil aleta-a2-sunting");
    sunting.addEventListener("click", () => a2SuntingLangsung(jawab));
    const sidang = a2Tombol("Diisi di sidang", "Tandai: jawaban ini diisi dari keterangan saksi di persidangan. Hanya tanda di layar ini - tidak ada yang disimpan.", "aleta-t6-kecil aleta-a2-sidang");
    sidang.addEventListener("click", () => {
      if (tanda.get(kunci) === true) tanda.delete(kunci);
      else tanda.set(kunci, true);
      segar();
      t6SegarkanSiapSdg(hasil);
    });
    deret.appendChild(sunting);
    deret.appendChild(sidang);
    kotak.insertBefore(deret, lencana ? lencana.nextSibling : kotak.firstChild);
  }
  segar();
}

/** Baris terisi lagi: tanda sidangnya ikut lepas. */
function a2LepasBelum(hasil, b) {
  if (!b.hasAttribute("data-a2-sidang")) return;
  b.removeAttribute("data-a2-sidang");
  a2Tanda(hasil).delete(a2KunciBaris(hasil, b));
}

/** Ringkasan di ATAS penyunting: berapa yang belum, jalan ke sana (dipanggil t6SegarkanSiapSdg). */
function a2RingkasBelum(hasil) {
  let el = Array.from(hasil.children).find((c) => c.classList.contains("aleta-a2-belum-ringkas"));
  const semua = hasil.querySelectorAll(".aleta-sdg-dua .aleta-sdg-baris textarea.aleta-sdg-jawab").length;
  const belumSemua = t6JawabBelum(hasil);
  const sidang = belumSemua.filter((x) => x.baris.hasAttribute("data-a2-sidang"));
  const belum = belumSemua.filter((x) => !x.baris.hasAttribute("data-a2-sidang"));
  if (!el) {
    el = a2El("div", "aleta-a2-belum-ringkas");
    el.setAttribute("role", "status");
    const teks = a2El("span", "aleta-a2-belum-teks");
    const lanjut = a2Tombol("Ke berikutnya ▸", "Ke jawaban berikutnya yang belum terisi", "aleta-t6-kecil aleta-a2-ke-belum");
    const saring = a2Tombol("Hanya yang belum", "Tampilkan hanya baris yang belum terisi - yang lain tetap ada dan tetap disimpan", "aleta-t6-kecil aleta-a2-saring-belum");
    saring.setAttribute("aria-pressed", "false");
    lanjut.addEventListener("click", () => {
      const daftar = t6JawabBelum(hasil).filter((x) => !x.baris.hasAttribute("data-a2-sidang"));
      if (!daftar.length) return;
      const i = (Number(el.getAttribute("data-a2-ke")) + 1) % daftar.length || 0;
      el.setAttribute("data-a2-ke", String(i));
      const sasaran = daftar[i].baris.querySelector("textarea.aleta-sdg-jawab");
      if (sasaran) a2SuntingLangsung(sasaran);
    });
    saring.addEventListener("click", () => {
      const nyala = hasil.getAttribute("data-a2-saring") !== "belum";
      if (nyala) hasil.setAttribute("data-a2-saring", "belum");
      else hasil.removeAttribute("data-a2-saring");
      saring.setAttribute("aria-pressed", nyala ? "true" : "false");
    });
    el.setAttribute("data-a2-ke", "-1");
    el.appendChild(teks);
    el.appendChild(lanjut);
    el.appendChild(saring);
    el.appendChild(a2El("span", "aleta-t6-lembut aleta-teknis aleta-a2-pratinjau", "Masih pratinjau - tidak ada yang tersimpan sebelum Simpan ditekan."));
    const acuan = hasil.querySelector(":scope > .aleta-sdg-tata") || hasil.querySelector(":scope > .aleta-sdg-dua");
    hasil.insertBefore(el, acuan || hasil.firstChild);
  }
  const bagian = [];
  bagian.push(
    belum.length
      ? `${belum.length} dari ${semua} jawaban belum terdeteksi`
      : sidang.length
        ? `${semua - sidang.length} dari ${semua} jawaban terisi`
        : `Semua ${semua} jawaban terisi`
  );
  if (sidang.length) bagian.push(`${sidang.length} ditandai diisi di sidang`);
  const teks = bagian.join(" · ");
  const wadahTeks = el.querySelector(".aleta-a2-belum-teks");
  if (wadahTeks.textContent !== teks) wadahTeks.textContent = teks;
  el.setAttribute("data-a2-belum", String(belum.length));
  el.classList.toggle("aleta-a2-belum-ada", belum.length > 0);
  for (const t of Array.from(el.querySelectorAll(".aleta-a2-ke-belum, .aleta-a2-saring-belum"))) t.disabled = belum.length + sidang.length === 0 && hasil.getAttribute("data-a2-saring") !== "belum";
}

// ─── Butir 3: blangko utama + "Blangko berbeda…" pada putusan massal ────────

/**
 * Bilah "Blangko utama" di atas daftar putusan massal (UI Baru). Pulang
 * { peta() -> baris blangko | null, segarkan(), nama() }. Kosong = blangko
 * menurut pemetaan jenis (perilaku 1.177.0).
 */
function a2PasangBlangkoUtama(kotak, acuan, keadaan, saatGanti) {
  const bilah = buatElemen("label", "aleta-massal-baris aleta-a2-utama");
  bilah.appendChild(buatElemen("span", "aleta-massal-nomor", "Blangko utama"));
  const pilih = document.createElement("select");
  pilih.className = "aleta-massal-pilih-berkas aleta-a2-utama-pilih";
  pilih.title = "Blangko yang dipakai semua perkara yang dicentang. Perkara yang putusannya berbeda: tombol \"Blangko berbeda…\" di barisnya.";
  bilah.appendChild(pilih);
  kotak.insertBefore(bilah, acuan);
  let terpilih = null;
  const segarkan = () => {
    const nilai = pilih.value;
    pilih.textContent = "";
    const bawaan = document.createElement("option");
    bawaan.value = "";
    bawaan.textContent = "menurut pemetaan jenis perkara";
    pilih.appendChild(bawaan);
    for (const b of berkasDikenal(keadaan.peta || {})) {
      const o = document.createElement("option");
      o.value = alatKunciBerkas(b.berkas);
      o.textContent = `${b.blangko ? `${b.blangko} — ` : ""}${b.berkas}${b.a && b.b ? "" : " (token belum)"}`;
      o.dataset.a = b.a || "";
      o.dataset.b = b.b || "";
      o.dataset.d = b.d || "";
      o.dataset.blangko = b.blangko || "";
      o.dataset.berkas = b.berkas;
      pilih.appendChild(o);
    }
    pilih.value = Array.from(pilih.options).some((o) => o.value === nilai) ? nilai : "";
    if (!pilih.value) terpilih = null;
  };
  pilih.addEventListener("click", (e) => e.stopPropagation());
  pilih.addEventListener("change", () => {
    const o = pilih.selectedOptions[0];
    terpilih = o && o.value ? alatRapikanBlangko({ blangko: o.dataset.blangko, berkas: o.dataset.berkas, a: o.dataset.a, b: o.dataset.b, d: o.dataset.d }) : null;
    saatGanti();
  });
  segarkan();
  return {
    peta: () => terpilih,
    segarkan,
    nama: () => (terpilih ? terpilih.berkas : "blangko menurut jenis"),
    pilih,
    /** Dipilih dari luar (blangko utama panel SIPP) - hanya bila belum dipilih di sini. */
    setelBila: (kunci) => {
      if (terpilih || !kunci) return false;
      segarkan();
      const o = Array.from(pilih.options).find((x) => x.value && x.value === alatKunciBerkas(kunci));
      if (!o) return false;
      pilih.value = o.value;
      terpilih = alatRapikanBlangko({ blangko: o.dataset.blangko, berkas: o.dataset.berkas, a: o.dataset.a, b: o.dataset.b, d: o.dataset.d });
      return true;
    },
  };
}

/** chrome.storage.local "blangkoPutusanMassal" (panel SIPP, agen S): { utama, perkara: {nomor: blangko} }. */
const A2_KUNCI_BLANGKO_SIPP = "blangkoPutusanMassal";

/**
 * Blangko putusan massal yang dipilih di panel SIPP (butir 3, agen S) - utama
 * dan pengecualian per perkara - dipakai putusan massal ABT: pengecualian
 * yang dipilih di baris ABT tetap menang; utama hanya bila di sini belum
 * dipilih. Hanya perkara yang ada di daftar hari itu. Disebut di kabar.
 */
async function a2PakaiBlangkoSipp(keadaan, pilihanPer, utama, kabar) {
  let simpan = null;
  try {
    const x = await chrome.storage.local.get([A2_KUNCI_BLANGKO_SIPP]);
    simpan = x && x[A2_KUNCI_BLANGKO_SIPP];
  } catch {
    return;
  }
  if (!simpan || typeof simpan !== "object") return;
  const per = simpan.perkara && typeof simpan.perkara === "object" ? simpan.perkara : {};
  let n = 0;
  for (const s of keadaan.sidang || []) {
    const e = per[s.nomor];
    if (!e || typeof e !== "object" || !e.berkas || pilihanPer.has(s.nomor)) continue;
    pilihanPer.set(s.nomor, alatRapikanBlangko({ blangko: e.blangko, berkas: e.berkas, a: e.a, b: e.b, d: e.d }));
    n += 1;
  }
  const pakaiUtama = typeof simpan.utama === "string" && utama.setelBila(simpan.utama);
  if ((n || pakaiUtama) && kabar) {
    const bagian = [];
    if (pakaiUtama) bagian.push("blangko utama");
    if (n) bagian.push(`${n} pengecualian per perkara`);
    kabar.appendChild(buatElemen("div", "aleta-tetap-sebab aleta-a2-dari-sipp", `Dari pilihan di panel SIPP: ${bagian.join(" dan ")}. Ubah di sini bila perlu.`));
  }
}

/**
 * Baris perkara (UI Baru): pilihan blangko perkara ini disembunyikan di balik
 * "Blangko berbeda…". Pilihannya TETAP select yang sama (pendengar, ingatan
 * pilihanPer, dan pembatalan pemeriksaan tidak berubah).
 */
function a2BarisBlangko(label, pilih, s, opsi) {
  const o = opsi || {};
  const bawaan = pilih.querySelector('option[value=""]');
  if (bawaan) bawaan.textContent = "sama dengan blangko utama";
  pilih.hidden = !o.berbeda;
  const buka = () => {
    pilih.hidden = false;
    try {
      pilih.focus();
    } catch {
      /* fokus hanya kenyamanan */
    }
  };
  pilih.addEventListener("change", () => {
    if (!pilih.value) pilih.hidden = true;
  });
  // Pembantu agen R (K3, basmassal.js) bila ada: barisnya ("Blangko utama: X ·
  // Blangko berbeda… · Ikuti blangko utama"). Pilihannya diteruskan ke select
  // di atas (tetap tersembunyi) - pendengar, pilihanPer, dan pembatalan
  // pemeriksaan tetap satu jalur.
  if (typeof aletaMassalBarisBlangko === "function") {
    try {
      const daftarBlangko = () =>
        Array.from(pilih.options)
          .filter((x) => x.value)
          .map((x) => ({ nilai: x.value, label: x.textContent, berkas: x.dataset.berkas, blangko: x.dataset.blangko, a: x.dataset.a, b: x.dataset.b, d: x.dataset.d }));
      const u = o.utamaPerkara && o.utamaPerkara.berkas ? o.utamaPerkara : null;
      let memulihkan = false;
      const el = aletaMassalBarisBlangko(
        { nomor: s.nomor, nomorPerkara: s.nomor, jenis: s.jenis, perkaraId: s.perkaraId },
        {
          blangkoUtama: u ? { nilai: alatKunciBerkas(u.berkas), label: u.berkas, berkas: u.berkas } : null,
          daftarBlangko,
          onPilih: ({ blangko, bawaan }) => {
            if (memulihkan) return;
            const v = !bawaan && blangko ? alatKunciBerkas(blangko.berkas || blangko.nilai || "") : "";
            pilih.value = Array.from(pilih.options).some((x) => x.value === v) ? v : "";
            pilih.hidden = true;
            pilih.dispatchEvent(new Event("change"));
          },
        }
      );
      if (el && el.nodeType === 1) {
        el.classList.add("aleta-a2-berbeda-baris");
        // Baris ini duduk di dalam <label> perkara: klik pada tulisannya tidak
        // boleh mencentang/melepas perkara itu.
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const t = e.target;
          if (!(t && typeof t.closest === "function" && t.closest("button, select, option"))) e.preventDefault();
        });
        pilih.hidden = true;
        label.appendChild(el);
        // Pengecualian yang sudah ada (baris digambar ulang): keadaan "berbeda" dipulihkan.
        if (o.berbeda && pilih.value) {
          const tb = el.querySelector(".aleta-massal-blangko-beda");
          const ps = el.querySelector(".aleta-massal-blangko-pilih");
          const ke = daftarBlangko().findIndex((b) => b.nilai === pilih.value);
          if (tb && ps && ke >= 0) {
            memulihkan = true;
            try {
              tb.click();
              ps.value = String(ke);
              ps.dispatchEvent(new Event("change"));
            } finally {
              memulihkan = false;
            }
          }
        }
        return el;
      }
    } catch {
      /* pembantu R menolak - tombol di bawah */
    }
  }
  const tombol = buatElemen("button", "aleta-perkakas-aksi aleta-a2-berbeda", "Blangko berbeda…");
  tombol.type = "button";
  tombol.title = `Perkara ${s.nomor} memakai blangko lain dari blangko utama - pilih blangkonya`;
  tombol.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (pilih.hidden) buka();
    else if (!pilih.value) pilih.hidden = true;
  });
  label.insertBefore(tombol, pilih);
  return tombol;
}

/*
 * ============================================================================
 * P7 - BLANGKO BAS: "ISI DARI SIPP & INPUT KE ABT" UNTUK PANITERA SIDANG / PP
 * (PERBAIKAN 2 OKT SORE, AGEN P, BUTIR 7) - HANYA UI BARU
 * ============================================================================
 *
 * Bila blangko yang SEDANG DIBUKA adalah blangko berita acara sidang (judul
 * <h2> views/abt/view.php memuat "BAS"/"Berita Acara", atau halaman memuat
 * tombol validasi_bas ABT), panitera sidang / panitera / PP (menu "isi-bas",
 * matriks alatMenuPeran) - dan Admin/Super Admin ("semua") - mendapat bagian
 * sendiri:
 *
 *   1. Data sidang dari SIPP (GET /aleta-ecourt/sidang?nomor= - rute baca
 *      yang sama dengan tab Juru Sita): tanggal, sidang ke-, agenda,
 *      kehadiran pihak, saksi yang diajukan, majelis, PP, hasil/tunda.
 *   2. Usulan variabel blangko ini: dari bot (POST /aleta-bot/abt/usulan
 *      sumber "sipp" - hitungan saja, ada di ALETA_COBA_BOLEH) DITAMBAH data
 *      sidang di atas untuk variabel yang namanya jelas menyebutnya (tanggal
 *      sidang, sidang ke-, agenda, kehadiran, majelis, PP, alasan tunda).
 *   3. Satu daftar centang (yang terdeteksi tercentang bila variabelnya masih
 *      kosong; yang sudah sama tidak tampil) dan SATU tombol "Input ke ABT".
 *
 * TIDAK ADA YANG DITULIS sebelum tombol ditekan. Penulisnya jalur yang sudah
 * ada: terapkanUsulanBerurutan -> simpanVariabel (edit_data ABT), tunduk pada
 * mode coba, kering, dan latihan di panel-alat.js. Tanpa penanda ALETA di ABT
 * (butir 14): yang ditulis hanya nilai variabelnya; riwayatnya di ALETA.
 *
 * "Susun keterangan saksi" milik panitera TIDAK dikurangi - bagian ini
 * berdiri di sampingnya.
 */
const P7_API_SIDANG = "/aleta/api/aleta-ecourt/sidang";
const P7_POLA_BAS = /\bBAS\b|berita\s+acara/i;
const P7_KELAS = "aleta-p7-bas";
/** Variabel blangko BAS -> data sidang, dari NAMA variabelnya (bukan kodenya: kode berbeda antar set). */
const P7_POLA_VARIABEL = [
  { kunci: "tanggal", pola: /tanggal\s+sidang|tgl\.?\s*sidang|hari\s*(,|\/|dan)?\s*tanggal\s+sidang/i },
  { kunci: "ke", pola: /sidang\s+ke\b|sidang\s+ke-|persidangan\s+ke/i },
  { kunci: "agenda", pola: /agenda/i },
  { kunci: "kehadiran", pola: /kehadiran|yang\s+hadir/i },
  { kunci: "majelis", pola: /ketua\s+majelis|majelis\s+hakim|hakim\s+tunggal/i },
  { kunci: "pp", pola: /panitera\s+pengganti/i },
  { kunci: "tunda", pola: /alasan\s+(penundaan|ditunda|tunda)|ditunda\s+karena/i },
];

/** Nama berkas blangko yang sedang dibuka (judul <h2> view ABT). */
function p7NamaBlangko() {
  const h = document.querySelector("#welcome h2, .about h2") || document.querySelector("h2");
  return String((h && h.textContent) || "").replace(/\s+/g, " ").trim();
}

/** Blangko yang dibuka adalah blangko BAS? */
function p7HalamanBas() {
  if (typeof halamanBlangko === "function" && !halamanBlangko()) return false;
  if (P7_POLA_BAS.test(p7NamaBlangko())) return true;
  return Boolean(document.querySelector('a[onclick*="validasi_bas"]'));
}

/**
 * ============================================================================
 * JENIS BLANGKO HALAMAN INI: PUTUSAN, BUKAN PUTUSAN, ATAU RAGU (1.182/1.183)
 * ============================================================================
 *
 * Sampai 1.181.0 bagian "Unggah putusan perkara ini" dan tombol kaki
 * "Kerjakan perkara ini" tampil di SEMUA halaman blangko ABT, dan bila token
 * blangko tidak cocok dengan pemetaan putusan, a1PilihBlangkoHalaman jatuh ke
 * "Blangko halaman ini (dari tautan CETAK)" - satu klik mengunggah RTF BAS,
 * relaas, PMH, atau sampul berkas sebagai putusan perkara.
 *
 * 1.182.0 menolak BAS/relaas/pemberitahuan dari nama berkas. Diukur 4 Okt atas
 * 812 berkas pustaka blangko ABT setempat: daftar itu masih meloloskan PMH/PHS, Penunjukan PP,
 * Penetapan Mediator, Sampul, Akta Cerai, gugatan, dan formulir mediasi. Nama
 * berkas saja juga tidak cukup untuk MENGENALI putusan - "CG Verstek", "PAW",
 * "Wali Adhal", "IN 2 Pemohon" tidak memuat kata putusan. Folder kelompoknya
 * (putusan_penetapan) terenkripsi di tautan, jadi sumbernya tiga:
 *
 *   1. nama berkas (judul <h2> view ABT) - pola bukan-putusan dan putusan;
 *   2. submenu tempat berkas itu diklik di halaman daftar ABT ("Putusan CG",
 *      "BAS Cerai Verstek", "Relaas dan PBT", "PMH & PHT") - dicatat di
 *      sessionStorage tab ini oleh a3CatatMenuBlangko;
 *   3. pemetaan blangko putusan (token atau nama berkas) - tiba belakangan.
 *
 *   "bukan"   bagian Unggah tidak digambar sama sekali (semua tampilan);
 *   "putusan" seperti biasa;
 *   "ragu"    UI Baru saja: bagian Unggah dan tombol kaki DIKUNCI sampai
 *             pemetaan mengenalinya atau orangnya menyatakan "Ini blangko
 *             putusan". Lama/Baru tidak punya pilihan "Blangko halaman ini" -
 *             yang terunggah di sana selalu blangko putusan yang dipetakan.
 */
// Uji 9 Okt (839 nama berkas di folder blangko ABT satker - nama foldernya
// sengaja tidak ditulis: penjaga abt-usulan "tidak pernah menyentuh folder
// APS Badilag" menyisir teks berkas ini): "Penunjukkan" (dua k),
// penetapan eksekusi/aanmaning/lelang/sita/konsinyasi/titipan/harga limit,
// pengumuman, penahanan/penggeledahan/penyitaan/diversi (jinayat), penetapan
// ketua (prodeo), dan P3HP dulu dianggap PUTUSAN bila halamannya dibuka tanpa
// catatan submenu - tombol Unggah putusan terbuka untuk penetapan eksekusi.
// Tidak satu pun berkas di putusan_penetapan/ ikut tertolak karena tambahan ini.
const A3_POLA_BUKAN_PUTUSAN = /\bBAS\b|berita\s+acara|relaas|panggilan|pemberitahuan|\bPBT\b|\bPMH\b|\bPHS\b|\bPHT\b|\bPJS\b|\bPPP\b|penunjukk?an|penetapan\s+(majelis|hakim|hari|mediator|penahanan|sita|panitera|juru\s*sita|jurusita|ketua)|eksekusi|aanmaning|lelang|konsinyasi|titipan|harga\s+limit|pengangkatan\s+sita|pengumuman|penahanan|penggeledahan|penyitaan|diversi|\bP3HP\b|sampul|daftar\s+isi|akta\s+cerai|formulir|laporan|instrumen|surat\s+keterangan|tanda\s+terima|bukti\s+bayar|panjar|kuasa\s+pengguna|lafal\s+sumpah|persetujuan|pernyataan|permohonan\s+(banding|kasasi|peninjauan|pk\b)|tidak\s+berkekuatan\s+hukum/i;
const A3_POLA_PUTUSAN = /putusan|penetapan|kabul|tolak|verstek|cabut|gugur|tidak\s+dapat\s+diterima|kontradiktur|rekonvensi/i;
/** "(NO)", "[NO]", "NO" - huruf besar saja: "no" kecil bukan niet ontvankelijk. */
const A3_POLA_NO = /(^|[^A-Za-z])NO([^A-Za-z]|$)/;
/** Submenu daftar ABT yang pasti bukan putusan (dicocokkan SESUDAH kata "putusan"). */
const A3_POLA_MENU_BUKAN = /\bBAS\b|berita\s+acara|relaas|\bPBT\b|\bPMH\b|\bPHT\b|P\s*H\s*S|penunjukan|ikrar|mediasi|gugatan|permohonan|formulir|kuasa|akta|PTSP|sampul|jinayat|kepaniteraan/i;
const A3_KUNCI_MENU = "aletaAbtMenuBlangko";

function a3Baku(teks) {
  return String(teks || "").replace(/\s+/g, " ").trim();
}

/** Nama berkas untuk dibandingkan: tanpa ".rtf", huruf kecil, spasi tunggal. */
function a3BakuBerkas(teks) {
  return a3Baku(teks).replace(/^#\s*/, "").replace(/(\.rtf)+$/i, "").toLowerCase();
}

/**
 * Halaman DAFTAR blangko ABT: submenu berkas yang diklik dicatat untuk halaman
 * blangko berikutnya di tab yang sama (klik -> abt/main/cari -> view). Hanya
 * di sessionStorage tab ini - tidak ada yang ditulis ke ABT.
 */
function a3CatatMenuBlangko() {
  if (a3CatatMenuBlangko.dipasang) return;
  a3CatatMenuBlangko.dipasang = true;
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target && e.target.closest ? e.target.closest(".pricing-bottom-bottom a") : null;
      if (!a) return;
      const kartu = a.closest(".pricing_inner_w3ls");
      const judul = kartu ? kartu.querySelector(".pricing-top h3") : null;
      const span = a.querySelector("span");
      const aktif = document.querySelector("#navbar a.active");
      const panelGrup = aktif ? aktif.closest(".panel") : null;
      const tombolGrup = panelGrup ? panelGrup.previousElementSibling : null;
      // Judul kartu = "<submenu><br><jenis perkara> - <nomor>" (beranda.php ABT):
      // yang dinilai hanya submenunya, sebab "Cerai Gugat" bukan nama menu.
      let menu = "";
      for (const n of Array.from((judul && judul.childNodes) || [])) {
        if (n.nodeName === "BR") break;
        menu += n.textContent || "";
      }
      const catatan = {
        berkas: a3Baku((span || a).textContent).replace(/^#\s*/, ""),
        menu: a3Baku(menu),
        grup: tombolGrup && tombolGrup.classList.contains("accordion") ? a3Baku(tombolGrup.textContent) : "",
      };
      try {
        if (catatan.berkas) sessionStorage.setItem(A3_KUNCI_MENU, JSON.stringify(catatan));
      } catch {
        /* tanpa sessionStorage: halaman blangko memakai nama berkas saja */
      }
    },
    true
  );
}

/** Submenu + grup tempat berkas halaman ini dipilih, bila tercatat untuk berkas YANG SAMA. */
function a3MenuHalaman(nama) {
  try {
    const x = JSON.parse(sessionStorage.getItem(A3_KUNCI_MENU) || "null");
    if (x && x.berkas && a3BakuBerkas(x.berkas) === a3BakuBerkas(nama)) return { menu: String(x.menu || ""), grup: String(x.grup || "") };
  } catch {
    /* catatan rusak atau sessionStorage terkunci */
  }
  return null;
}

/** "putusan" | "bukan" | "" dari nama submenu/grup daftar ABT. */
function a3JenisMenu(teks) {
  if (!teks) return "";
  if (/putusan/i.test(teks)) return "putusan";
  return A3_POLA_MENU_BUKAN.test(teks) ? "bukan" : "";
}

/** Jenis blangko halaman ini dari yang terbaca SERENTAK: "bukan" | "putusan" | "ragu". */
function a3JenisBlangkoHalaman() {
  if (p7HalamanBas()) return "bukan";
  const nama = p7NamaBlangko();
  if (A3_POLA_BUKAN_PUTUSAN.test(nama)) return "bukan";
  const asal = a3MenuHalaman(nama);
  if (asal) {
    const menu = a3JenisMenu(asal.menu) || a3JenisMenu(asal.grup);
    if (menu) return menu;
  }
  // Penetapan ikrar talak bukan putusan perkaranya - tetapi ada pula putusan
  // CT yang menyebut ikrar. Tanpa submenu, biar orangnya yang menyatakan.
  if (/ikrar/i.test(nama)) return "ragu";
  if (A3_POLA_PUTUSAN.test(nama) || A3_POLA_NO.test(nama)) return "putusan";
  return "ragu";
}

function a3BukanBlangkoPutusan() {
  return a3JenisBlangkoHalaman() === "bukan";
}

/**
 * ============================================================================
 * 1.184.0 (5 Okt, butir 2): #2222# / #0364# TANGGAL KTP DARI BERKAS KTP e-COURT
 * ============================================================================
 *
 * Kedua variabel bertipe data_tanggal dan selama ini diketik dari fotokopi
 * KTP. Portal (GET /aleta-ecourt/ktp-terbit) membaca PDF KTP perkara dari arsip
 * e-Court ALETA dengan pembaca KTP yang sama dengan "Isi dari foto KTP" dan
 * memulangkan tanggal penerbitannya ("dd/mm/yyyy" - bentuk tgl_sql ABT).
 * Hasil mesin: keyakinan "ocr", TIDAK dicentang sendiri.
 */
const A3_VAR_TANGGAL_KTP_P = Object.freeze(["2222", "0364"]);
const ALETA_API_KTP_TERBIT = "/aleta/api/aleta-ecourt/ktp-terbit";

async function a3UsulanTanggalKtp(nomor) {
  const peta = barisVariabel();
  const kode = A3_VAR_TANGGAL_KTP_P.filter((k) => peta.has(k));
  if (!kode.length || !nomor) return { usulan: [], catatan: "" };
  const respons = await fetch(`${ALETA_API_KTP_TERBIT}?nomor=${encodeURIComponent(nomor)}`, { credentials: "include", cache: "no-store" });
  if (!respons.ok) throw new Error(`server ALETA menjawab ${respons.status}`);
  const luar = await respons.json();
  const isi = luar && luar.data ? luar.data : luar;
  if (!isi || !isi.ada || !isi.tanggal) return { usulan: [], catatan: (isi && isi.sebab) || "Tanggal KTP tidak terbaca dari e-Court." };
  const judul = (isi.sumber && isi.sumber.judul) || "KTP";
  return {
    catatan: "",
    usulan: kode.map((k) => ({
      kode: k,
      nama: "Tanggal KTP Penggugat/Pemohon",
      nilai: String(isi.tanggal),
      keyakinan: "ocr",
      sumber: [{ asal: "ktp-ecourt", keterangan: `dibaca dari berkas "${judul}" e-Court${isi.kota ? `, ${isi.kota}` : ""}` }],
    })),
  };
}

/**
 * 9 Okt 2026 (KUASA butir 1-4): kuasa hukum Penggugat dari SURAT GUGATAN e-Court.
 *
 *   #0156#   Kantor Kuasa         nama kantor di gugatan (mis. "DERRY & PARTNERS"),
 *                                 BUKAN alamat - sampai 1.188.0 diisi alamat advokat SIPP
 *   #0184#   Tgl. Surat Kuasa     "Surat Kuasa Khusus tanggal ..." di gugatan
 *   #8538#  Alamat Kantor Kuasa  sesudah nama kantor di gugatan
 *   #8537#  Nama Advokat         kuasa aktif SIPP (cadangan: gugatan)
 *
 * Portal (GET /aleta-ecourt/kuasa-gugatan) membaca surat gugatan dari arsip
 * e-Court ALETA (lapisan teks Word/PDF, OCR bila pindaian) dan kuasa SIPP
 * lewat bot. Tanda sumber "Gugatan e-Court"; hasil OCR dan cadangan SIPP
 * berkeyakinan "ragu" (tidak dicentang sendiri). #0132# (tanggal REGISTER kuasa
 * khusus) dan #8539# (nomor register) datang dari SIPP lewat usulan bot.
 */
const A3_VAR_KUASA = Object.freeze(["0156", "0184", "8538", "8537"]);
/** Variabel kuasa yang tetap berkartu (kosong, dapat disunting) pada perkara ber-kuasa. */
const A3_VAR_KUASA_KARTU = Object.freeze(["0156", "0184", "8538", "8537", "8539", "0132"]);
const ALETA_API_KUASA = "/aleta/api/aleta-ecourt/kuasa-gugatan";

async function a3UsulanKuasa(nomor) {
  const peta = barisVariabel();
  if (!nomor || !A3_VAR_KUASA.some((k) => peta.has(k))) return { usulan: [], ada: false, catatan: [] };
  const respons = await fetch(`${ALETA_API_KUASA}?nomor=${encodeURIComponent(nomor)}`, { credentials: "include", cache: "no-store" });
  // Server ALETA lama belum punya rutenya: diam, sama dengan sebelum fitur ini.
  if (respons.status === 404) return { usulan: [], ada: false, catatan: [] };
  if (!respons.ok) throw new Error(`server ALETA menjawab ${respons.status}`);
  const luar = await respons.json();
  const isi = luar && luar.data ? luar.data : luar;
  const usulan = (Array.isArray(isi && isi.usulan) ? isi.usulan : []).filter((u) => u && peta.has(String(u.kode)));
  const catatan = (Array.isArray(isi && isi.catatan) ? isi.catatan : []).map(String).filter(Boolean);
  return { usulan, ada: Boolean(isi && isi.ada), catatan };
}

/**
 * Perkara ber-kuasa (gugatan atau SIPP menyebut kuasa): variabel kuasa yang
 * tidak terdeteksi tetap tampil sebagai kartu kosong yang dapat disunting,
 * membawa sebabnya - bukan hanya disebut di "Tidak ditampilkan".
 */
function a3KartuKuasaKosong(tampil, sama, data) {
  const d = data || {};
  const adaKuasa = Boolean(d.kuasa && d.kuasa.ada) || Number((d.sipp && d.sipp.jumlahKuasa) || 0) > 0;
  if (!adaKuasa) return [];
  const peta = barisVariabel();
  const sudah = new Set([...(tampil || []).map((u) => String(u.kode)), ...(sama || []).map(String)]);
  const asal = new Map();
  for (const sumber of [d.sipp, d.kuasa]) {
    for (const u of (sumber && sumber.usulan) || []) if (u && u.kode) asal.set(String(u.kode), u);
  }
  const hasil = [];
  for (const kode of A3_VAR_KUASA_KARTU) {
    if (sudah.has(kode) || !peta.has(kode)) continue;
    if (a3BolehDiisi(kode) === false) continue;
    const u = asal.get(kode) || {};
    hasil.push({
      kode,
      nama: u.nama || (peta.get(kode) || {}).nama || kode,
      nilai: "",
      keyakinan: "kosong",
      sumber: [],
      catatan: u.catatan || "",
      wajib: true,
    });
  }
  return hasil;
}

/* === P4P7B2 10 Okt === */
/**
 * ============================================================================
 * B2 + P4 + P7 (10 Okt 2026): ISI DARI e-COURT KE ABT
 * ============================================================================
 *
 * Portal (GET /aleta-ecourt/isi-gugatan) membaca surat gugatan dan jawaban/
 * replik/duplik/kesimpulan dari arsip e-Court ALETA, bot menimbangnya dengan
 * kamus deteksi. Yang datang ke sini:
 *
 *   usulan    kartu variabel (6055 mut'ah, 6054 iddah, 7120 madliyah, 6071/6072
 *             nafkah anak, 7778 hadhanah, 5110/5111 anak, 0007, 2004, 7084,
 *             9881) - sumber "gugatan-ecourt" dengan kutipan "e-Court: <judul>
 *             hal. n"; semuanya "ragu" (tidak dicentang sendiri) kecuali 9881.
 *             5227 datang sebagai BUNYI PILIHAN templat hakim (pilihan[]) yang
 *             digabung ke kartu 5227 yang sudah ada (p4GabungPilihan).
 *   tuntutan, anak, jawab, kalimat - digambar di lipatan "Dari berkas e-Court"
 *             (p4GambarEcourt): daftar tuntutan + nominal + pihak, anak,
 *             ringkasan jawab-menjawab, dan rangkaian kata hakim untuk disalin.
 *
 * Tidak ada yang ditulis sebelum petugas mencentang dan menekan Input ke ABT.
 */
const P4_VAR_ECOURT = Object.freeze(["6055", "6054", "7120", "6071", "6072", "7778", "5110", "5111", "0007", "2004", "7084", "9881", "5227"]);
const ALETA_API_ISI_GUGATAN = "/aleta/api/aleta-ecourt/isi-gugatan";

/** Dibaca bersama bacaan Isi dari SIPP lainnya. Diam bila server lama belum punya rutenya. */
async function p4BacaGugatan(data) {
  const peta = barisVariabel();
  const nomor = nomorPerkaraAbt();
  // KONTAK-EC 11 Okt: variabel kontak/domisili elektronik (K5_VAR_KONTAK) ikut memicu bacaan e-Court.
  const k5Var = typeof K5_VAR_KONTAK !== "undefined" ? K5_VAR_KONTAK : [];
  if (!nomor || ![...P4_VAR_ECOURT, ...k5Var].some((k) => peta.has(k))) return;
  try {
    const q = new URLSearchParams({ nomor, lawan: nilaiVariabel(VAR_PIHAK_LAWAN) || "", pelaku: nilaiVariabel(VAR_PIHAK_PELAKU) || "" });
    const majelis = String(nilaiVariabel("8554") || "").trim();
    if (/^(?:Majelis Hakim|Hakim|Hakim Tunggal)$/.test(majelis)) q.set("majelis", majelis);
    const respons = await fetch(`${ALETA_API_ISI_GUGATAN}?${q.toString()}`, { credentials: "include", cache: "no-store" });
    if (respons.status === 404) return;
    if (!respons.ok) throw new Error(`server ALETA menjawab ${respons.status}`);
    const luar = await respons.json();
    const isi = luar && luar.data ? luar.data : luar;
    const larik = (k) => (Array.isArray(isi && isi[k]) ? isi[k] : []);
    data.gugatan = {
      usulan: larik("usulan").filter((u) => u && peta.has(String(u.kode))),
      tuntutan: larik("tuntutan"),
      anak: larik("anak"),
      jawab: larik("jawab"),
      kalimat: larik("kalimat"),
      diabaikan: larik("diabaikan"),
      dokumen: larik("dokumen"),
      // KONTAK-EC 11 Okt: email/HP pihak & kuasa dari e-Court (bot kontakEcourtService).
      kontak: isi && isi.kontak && typeof isi.kontak === "object" ? isi.kontak : null,
    };
    for (const c of larik("catatan")) data.catatan.push(`Berkas e-Court: ${String(c)}`);
  } catch (galat) {
    data.catatan.push(`Isi dari berkas e-Court: ${sorePesan(galat)}`);
  }
}

/** Bunyi pilihan 5227 (templat hakim) digabung ke kartu yang sudah tampil - kartu itu tetap miliknya. */
function p4GabungPilihan(tampil, data) {
  const dariEcourt = new Map();
  for (const u of (data && data.gugatan && data.gugatan.usulan) || []) {
    if (u && Array.isArray(u.pilihan) && u.pilihan.length) dariEcourt.set(String(u.kode), u);
  }
  if (!dariEcourt.size) return tampil;
  return (tampil || []).map((u) => {
    const e = dariEcourt.get(String(u && u.kode));
    if (!e || e === u || (Array.isArray(u.pilihan) && u.pilihan.length)) return u;
    return { ...u, pilihan: e.pilihan, sumber: [...(Array.isArray(u.sumber) ? u.sumber : []), ...(e.sumber || [])] };
  });
}

/** Salin teks - clipboard bila ada (SIPP satker bukan konteks aman), selain itu execCommand. */
async function p4Salin(teks) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(teks);
      return true;
    }
  } catch (_galat) {
    /* jatuh ke cara lama */
  }
  const kotak = document.createElement("textarea");
  kotak.value = teks;
  kotak.setAttribute("readonly", "");
  kotak.style.position = "fixed";
  kotak.style.opacity = "0";
  document.body.appendChild(kotak);
  kotak.select();
  let berhasil = false;
  try {
    berhasil = document.execCommand("copy");
  } catch (_galat) {
    berhasil = false;
  }
  kotak.remove();
  return berhasil;
}

function p4Rupiah(n) {
  const x = Math.round(Number(n) || 0);
  return `Rp${String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

/** Lipatan "Dari berkas e-Court" di bawah kartu usulan. */
function p4GambarEcourt(wadah, data) {
  const g = data && data.gugatan;
  if (!wadah || !g) return;
  const adaIsi = g.tuntutan.length || g.anak.length || g.jawab.length || g.kalimat.length;
  if (!adaIsi && !g.dokumen.length) return;
  const kotak = document.createElement("details");
  kotak.className = "aleta-abt-kartu aleta-p4-ecourt";
  const ringkas = [];
  if (g.tuntutan.length) ringkas.push(`${g.tuntutan.length} tuntutan`);
  if (g.anak.length) ringkas.push(`${g.anak.length} anak`);
  if (g.jawab.length) ringkas.push(`${g.jawab.length} jawab-menjawab`);
  if (g.kalimat.length) ringkas.push(`${g.kalimat.length} kalimat hakim`);
  kotak.appendChild(buatElemen("summary", "aleta-abt-nama", `Dari berkas e-Court: ${ringkas.join(" · ") || "tidak ada yang terbaca"}`));
  const lembut = (teks) => kotak.appendChild(buatElemen("div", "aleta-t6-lembut aleta-teknis", teks));
  lembut("Usulan - nominal yang DITUNTUT bukan yang dikabulkan; amar dan dasar hukum diperiksa hakim. Kartu variabel di atas berlabel \"dari gugatan e-Court — periksa\".");

  if (g.tuntutan.length) {
    kotak.appendChild(buatElemen("div", "aleta-abt-nama", "Tuntutan tambahan (accessoir)"));
    for (const t of g.tuntutan) {
      const baris = buatElemen("div", "aleta-abt-kutipan");
      const n = t.nominal || null;
      const nominal = n ? `${p4Rupiah(n.total || n.nilai)}${n.perBulan && n.kali ? ` (${p4Rupiah(n.perBulan)}/bulan × ${n.kali} bulan)` : n.periode === "bulan" ? " per bulan" : n.periode === "hari" ? " per hari" : ""}` : t.benda ? `berupa ${t.benda}` : "tanpa nominal";
      baris.appendChild(buatElemen("span", "aleta-abt-asal", t.label || t.jenis));
      baris.appendChild(
        buatElemen(
          "span",
          "aleta-abt-kalimat",
          `${nominal} · dituntut ${t.penuntut || "?"}${t.rekonvensi ? " (rekonvensi)" : ""}${t.dibebani ? ` kepada ${t.dibebani}` : ""}${n && n.cocokTerbilang === false ? " · angka dan terbilang berbeda - periksa" : ""}`
        )
      );
      baris.appendChild(buatElemen("div", "aleta-t6-lembut", `${t.sumber || "e-Court"}: "${t.kutipan || ""}"`));
      kotak.appendChild(baris);
    }
  }
  if (g.diabaikan.length) {
    kotak.appendChild(buatElemen("div", "aleta-abt-nama", "Bukan tuntutan (kesanggupan / penolakan / dasar hukum)"));
    for (const x of g.diabaikan.slice(0, 6)) {
      kotak.appendChild(buatElemen("div", "aleta-t6-lembut", `${x.sebab || "-"} · ${x.judul || ""}${x.halaman ? ` hal. ${x.halaman}` : ""}: "${x.kutipan || ""}"`));
    }
  }
  if (g.anak.length) {
    kotak.appendChild(buatElemen("div", "aleta-abt-nama", "Anak (tidak dicatat SIPP)"));
    for (const a of g.anak) {
      kotak.appendChild(buatElemen("div", "aleta-abt-kutipan", `${a.nama}${a.umur ? `, umur ${a.umur}` : ""}${a.tanggalLahir ? `, lahir ${a.tanggalLahir}` : ""} - ${a.sumber || "e-Court"}`));
    }
  }
  if (g.jawab.length) {
    kotak.appendChild(buatElemen("div", "aleta-abt-nama", "Jawab-menjawab"));
    for (const j of g.jawab) {
      const lipat = document.createElement("details");
      lipat.appendChild(
        buatElemen("summary", "aleta-abt-kutipan", `${j.judul} (${j.peran}${j.rekonvensi === "ada" ? ", memuat rekonvensi" : ""}) - ${(j.diakui || []).length} dalil diakui, ${(j.dibantah || []).length} dibantah`)
      );
      lipat.appendChild(buatElemen("div", "aleta-t6-lembut", j.ringkas || ""));
      for (const d of j.diakui || []) lipat.appendChild(buatElemen("div", "aleta-abt-kutipan", `diakui: ${d}`));
      for (const d of j.dibantah || []) lipat.appendChild(buatElemen("div", "aleta-abt-kutipan", `dibantah: ${d}`));
      kotak.appendChild(lipat);
    }
  }
  if (g.kalimat.length) {
    kotak.appendChild(buatElemen("div", "aleta-abt-nama", "Rangkaian kata hakim (sunting dulu sebelum dipakai)"));
    for (const k of g.kalimat) {
      const baris = buatElemen("div", "aleta-abt-kutipan aleta-p4-kalimat");
      baris.appendChild(buatElemen("span", "aleta-abt-asal", k.label || k.kode));
      const teks = document.createElement("textarea");
      teks.className = "aleta-abt-sunting-kotak";
      teks.value = k.teks || "";
      teks.rows = Math.min(6, Math.max(2, Math.ceil((teks.value.length || 1) / 90)));
      baris.appendChild(teks);
      const salin = buatElemen("button", "aleta-perkakas-pulih", "Salin");
      salin.type = "button";
      salin.title = "Menyalin kalimat (yang sudah Anda sunting di kotak) - tidak menulis ke ABT";
      salin.addEventListener("click", async () => {
        const berhasil = await p4Salin(teks.value);
        salin.textContent = berhasil ? "Tersalin" : "Gagal - pilih teks lalu Ctrl+C";
        setTimeout(() => {
          salin.textContent = "Salin";
        }, 2000);
      });
      baris.appendChild(salin);
      if (Array.isArray(k.kosong) && k.kosong.length) baris.appendChild(buatElemen("div", "aleta-t6-lembut", `Lengkapi: ${k.kosong.map((x) => `{${x}}`).join(", ")}`));
      kotak.appendChild(baris);
    }
  }
  if (g.dokumen.length) {
    lembut(
      `Berkas dibaca: ${g.dokumen.map((d) => `${d.judul} (${d.terbaca ? `${d.baca === "ocr" ? "OCR" : "teks"}${d.halaman ? `, ${d.halaman} hal.` : ""}` : "tidak terbaca"})`).join("; ")}.`
    );
  }
  wadah.appendChild(kotak);
}
/* === AKHIR P4P7B2 === */

/** Pemetaan blangko putusan mengenali halaman ini: tokennya, atau nama berkasnya. */
function a3DikenaliPeta(peta) {
  const token = a1TokenHalaman();
  const nama = a3BakuBerkas(p7NamaBlangko());
  return Object.keys(peta || {}).some((x) => {
    const b = peta[x];
    if (!b || !alatBlangkoLengkap(b)) return false;
    if (token && b.a === token.a && b.b === token.b) return true;
    return Boolean(nama) && a3BakuBerkas(b.berkas) === nama;
  });
}

function a3Terkunci(kotak) {
  return Boolean(kotak) && kotak.getAttribute("data-a3-jenis") === "ragu";
}

/** Kunci "ragu": isi bagian Unggah disembunyikan, diganti satu kalimat dan satu tombol. */
function a3KunciUnggah(kotak, saatDibuka) {
  kotak.setAttribute("data-a3-jenis", "ragu");
  const nama = p7NamaBlangko();
  const catatan = buatElemen("div", "aleta-abt-catatan aleta-a3-ragu");
  catatan.appendChild(
    buatElemen(
      "div",
      "",
      `Blangko ${nama ? `"${nama}" ` : ""}tidak dikenali sebagai blangko putusan, jadi bagian ini dikunci agar BAS, relaas, atau penetapan lain tidak terunggah sebagai putusan.`
    )
  );
  const buka = buatElemen("button", "aleta-perkakas-aksi aleta-a3-buka", "Ini blangko putusan - buka");
  buka.type = "button";
  buka.title = "Membuka bagian Unggah untuk blangko yang sedang dibuka - belum mengunggah apa pun";
  buka.addEventListener("click", () => a3BukaUnggah(kotak, saatDibuka));
  catatan.appendChild(buka);
  const judul = kotak.querySelector(".aleta-abt-judul");
  kotak.insertBefore(catatan, judul ? judul.nextSibling : kotak.firstChild);
  for (const anak of Array.from(kotak.children)) {
    if (anak === catatan || anak === judul || anak.hidden) continue;
    anak.hidden = true;
    anak.setAttribute("data-a3-sembunyi", "ya");
  }
}

function a3BukaUnggah(kotak, saatDibuka) {
  kotak.setAttribute("data-a3-dibuka", "ya");
  if (!a3Terkunci(kotak)) return;
  kotak.removeAttribute("data-a3-jenis");
  for (const el of Array.from(kotak.querySelectorAll(".aleta-a3-ragu"))) el.remove();
  for (const anak of Array.from(kotak.querySelectorAll('[data-a3-sembunyi="ya"]'))) {
    anak.hidden = false;
    anak.removeAttribute("data-a3-sembunyi");
  }
  if (typeof saatDibuka === "function") saatDibuka();
}

/** Sidang ke- blangko ini: d= tautan CETAK, lalu "BAS <n>" di nama blangko; 0 = tidak terbaca. */
function p7SidangKe() {
  const t = document.querySelector('a[href*="abt/preview"]');
  const d = t ? /[?&]d=(\d+)/.exec(String(t.getAttribute("href") || "")) : null;
  if (d && Number(d[1]) > 0) return Number(d[1]);
  const m = /\bBAS\s*(\d+)/i.exec(p7NamaBlangko());
  return m ? Number(m[1]) : 0;
}

async function p7BacaRincian(nomor) {
  const r = await alatAmbil(`${P7_API_SIDANG}?nomor=${encodeURIComponent(nomor)}`, { credentials: "include", cache: "no-store" }, "Membaca data sidang");
  const luar = await r.json().catch(() => null);
  const isi = luar && luar.data ? luar.data : luar;
  if (!r.ok || !isi || isi.available === false || !isi.sipp) {
    throw new Error((isi && (isi.message || isi.alasan)) || alatPesanGagal(null, r.status, "Membaca data sidang"));
  }
  return isi.sipp;
}

/** Sidang yang di-BAS-kan: urutan dari blangko; tanpa itu sidang terakhir yang tidak di masa depan. */
function p7PilihSidang(rincian, ke) {
  const jadwal = Array.isArray(rincian && rincian.jadwalPerkara) ? rincian.jadwalPerkara : [];
  if (ke > 0) {
    const tepat = jadwal.find((s) => Number(s.urutanSidang) === ke);
    if (tepat) return tepat;
  }
  const hariIni = typeof alatTanggalIso === "function" ? alatTanggalIso(new Date()) : new Date().toISOString().slice(0, 10);
  const lalu = jadwal.filter((s) => String(s.tanggalSidang || "").slice(0, 10) <= hariIni);
  const urut = (lalu.length ? lalu : jadwal).slice().sort((a, b) => Number(a.urutanSidang) - Number(b.urutanSidang));
  return urut[urut.length - 1] || null;
}

/** "Rabu, 1 Oktober 2026" dari YYYY-MM-DD. */
function p7Tanggal(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return String(iso || "");
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  try {
    return t.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch {
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
}

/** Data sidang yang dibaca - { kunci: { label, nilai } }; yang tidak ada tidak disebut. */
function p7DataSidang(rincian, sidang) {
  const data = {};
  const pasang = (kunci, label, nilai) => {
    const n = String(nilai || "").replace(/\s+/g, " ").trim();
    if (n) data[kunci] = { label, nilai: n };
  };
  const permohonan = /\/Pdt\.P\//i.test(String((rincian && rincian.nomorPerkara) || "")) || /cerai\s+talak/i.test(String((rincian && rincian.jenisPerkara) || ""));
  const p = permohonan ? "Pemohon" : "Penggugat";
  const t = permohonan ? "Termohon" : "Tergugat";
  if (sidang) {
    pasang("tanggal", "Tanggal sidang", p7Tanggal(sidang.tanggalSidang));
    pasang("ke", "Sidang ke-", sidang.urutanSidang ? String(sidang.urutanSidang) : "");
    pasang("agenda", "Agenda", sidang.agenda);
    const hadir = { 1: `${p} dan ${t} hadir`, 2: `${p} hadir, ${t} tidak hadir`, 3: `${t} hadir, ${p} tidak hadir`, 4: `${p} dan ${t} tidak hadir` }[Number(sidang.dihadiriOleh)];
    pasang("kehadiran", "Kehadiran pihak", hadir || "");
    pasang("tunda", "Hasil / tunda", sidang.ditunda ? `Ditunda${sidang.alasanDitunda ? ` - ${sidang.alasanDitunda}` : ""}` : "");
  }
  const saksi = rincian && rincian.saksi;
  if (saksi && (Number(saksi.diajukanPihak1) || Number(saksi.diajukanPihak2))) {
    pasang("saksi", "Saksi diajukan", `${p} ${Number(saksi.diajukanPihak1) || 0}, ${t} ${Number(saksi.diajukanPihak2) || 0}`);
  }
  const majelis = Array.isArray(rincian && rincian.majelis) ? rincian.majelis : [];
  const ketua = majelis.find((m) => /ketua/i.test(String(m.jabatan || ""))) || majelis[0];
  pasang("majelis", "Ketua majelis", ketua && ketua.nama);
  const pp = Array.isArray(rincian && rincian.panitera) ? rincian.panitera[0] : null;
  pasang("pp", "Panitera pengganti", pp && pp.nama);
  return data;
}

/** Usulan dari data sidang untuk variabel yang namanya jelas menyebutnya. */
function p7UsulanDariSidang(data, peta) {
  const hasil = [];
  for (const [kode, item] of peta) {
    const cocok = P7_POLA_VARIABEL.find((x) => x.pola.test(String(item.nama || "")));
    if (!cocok || !data[cocok.kunci]) continue;
    hasil.push({
      kode,
      nama: item.nama,
      nilai: data[cocok.kunci].nilai,
      keyakinan: "cukup",
      sumber: [{ asal: "sipp", keterangan: `data sidang: ${data[cocok.kunci].label}` }],
    });
  }
  return hasil;
}

/** Satu daftar: bot lebih dulu, data sidang hanya untuk kode yang tidak diusulkan bot; yang sudah sama dibuang. */
function p7GabungUsulan(dariBot, dariSidang, peta) {
  const per = new Map();
  for (const u of [...(dariBot || []), ...(dariSidang || [])]) {
    if (!u || !u.kode || !peta.has(String(u.kode)) || per.has(String(u.kode))) continue;
    if (!String(u.nilai || "").trim()) continue;
    // 1.184.0 (butir 1): hanya data_teks/data_tanggal - sisanya dihitung ABT.
    if (a3BolehDiisi(u.kode) === false) continue;
    per.set(String(u.kode), u);
  }
  const rapi = (x) => String(x || "").replace(/\s+/g, " ").trim().toLowerCase();
  return [...per.values()].filter((u) => rapi((peta.get(String(u.kode)) || {}).nilai) !== rapi(u.nilai));
}

/**
 * 1.184.0 (butir 1): usulan tambahan untuk variabel data_teks/data_tanggal di
 * blangko BAS - sumber yang sama dengan panel hakim: posita (itsbat, perkara
 * lain) bila 5125 ada di halaman, dan keterangan saksi bila 2021/2022 ada.
 * Variabel alasan perceraian (0222, 0246, 9944, 7035, 1268, 5127, ...) dan
 * data nikah (5197, 1001, 0650/0651, 5178, ...) memang dipakai blangko BAS.
 */
async function p7UsulanTambahan(nomor, catatan) {
  const peta = barisVariabel();
  const posita = peta.get(VAR_POSITA) ? String(peta.get(VAR_POSITA).selNilai.innerText || "") : "";
  const tugas = [];
  if (posita.trim()) {
    tugas.push(
      mintaUsulan(muatanUsulanItsbat(posita))
        .then((j) => (j && j.itsbat && j.itsbat.ok !== false && Array.isArray(j.itsbat.usulan) ? j.itsbat.usulan : []))
        .catch((g) => {
          catatan.push(`Posita permohonan: ${sorePesan(g)}.`);
          return [];
        })
    );
    tugas.push(
      mintaUsulan(muatanUsulanLain(posita, nomor))
        .then((j) => (j && j.positaLain && j.positaLain.ok && Array.isArray(j.positaLain.usulan) ? j.positaLain.usulan : []))
        .catch((g) => {
          catatan.push(`Posita perkara lain: ${sorePesan(g)}.`);
          return [];
        })
    );
  }
  if (A3_VAR_TANGGAL_KTP_P.some((k) => peta.has(k))) {
    tugas.push(
      a3UsulanTanggalKtp(nomor)
        .then((r) => {
          if (r.catatan) catatan.push(`Tanggal KTP: ${r.catatan}`);
          return r.usulan;
        })
        .catch((g) => {
          catatan.push(`Tanggal KTP dari e-Court: ${sorePesan(g)}.`);
          return [];
        })
    );
  }
  if (a3BlangkoMemuatSaksi(peta)) {
    tugas.push(
      (async () => {
        const bacaan = await bacaKeteranganSaksiUsulan(peta);
        if (!bacaan.teks1.trim() && !bacaan.teks2.trim()) return [];
        const j = await mintaUsulan(muatanUsulanSaksi(peta, bacaan));
        return j && j.saksi && Array.isArray(j.saksi.usulan) ? j.saksi.usulan : [];
      })().catch((g) => {
        catatan.push(`Keterangan saksi: ${sorePesan(g)}.`);
        return [];
      })
    );
  }
  return (await Promise.all(tugas)).flat();
}

/** Variabel masih kosong / templat? (yang demikian tercentang sendiri). */
function p7VariabelKosong(item) {
  const n = String((item && item.nilai) || "").trim();
  if (!n) return true;
  try {
    if (typeof keadaanNilai === "function") return keadaanNilai(n) !== "terisi";
  } catch {
    /* cadangan di bawah */
  }
  return /^[-_.\s]*$|DATA_TIDAK_ADA/i.test(n);
}

function p7PasangBasAman(k) {
  try {
    p7PasangBas(k);
  } catch (galat) {
    if (typeof t6CatatGalat === "function") t6CatatGalat(galat, "Bagian BAS (Isi dari SIPP) gagal dipasang");
  }
}

function p7PasangBas(k) {
  if (!k || !k.isi || !t6Modern() || !p7HalamanBas() || !sorePunya(k, "isi-bas")) return;
  for (const lama of Array.from(k.isi.querySelectorAll(`.${P7_KELAS}`))) lama.remove();

  const judul = "Isi dari SIPP & input ke ABT (BAS)";
  let akar;
  let isi;
  if (typeof alatLipat === "function") {
    const l = alatLipat(judul, { kunci: "abt:isi-bas", terbuka: true, kelas: P7_KELAS, peran: "Panitera" });
    akar = l.akar;
    isi = l.isi;
  } else {
    akar = buatElemen("div", `aleta-abt-bagian ${P7_KELAS}`);
    akar.appendChild(buatElemen("div", "aleta-abt-judul", judul));
    isi = akar;
  }
  akar.setAttribute("data-p7", "bas");
  const nama = p7NamaBlangko();
  isi.appendChild(buatElemen("div", "aleta-p7-blangko aleta-teknis", nama ? `Blangko BAS: ${nama}` : "Blangko BAS"));
  const dataKotak = buatElemen("dl", "aleta-p7-data");
  const daftar = buatElemen("div", "aleta-p7-daftar");
  const kabar = buatElemen("div", "aleta-p7-kabar");
  kabar.setAttribute("role", "status");
  const aksi = buatElemen("div", "aleta-p7-aksi");
  const baca = buatElemen("button", "aleta-perkakas-aksi aleta-p7-baca", "Baca ulang");
  baca.type = "button";
  baca.title = "Membaca ulang data sidang SIPP dan usulan variabel - hanya membaca, tidak menyimpan apa pun ke ABT";
  const tombol = buatElemen("button", "aleta-permintaan-tombol aleta-p7-input", "Input ke ABT");
  tombol.type = "button";
  tombol.disabled = true;
  tombol.title = "Menyimpan variabel yang dicentang ke blangko ABT ini, satu per satu";
  aksi.append(tombol, baca);
  isi.append(dataKotak, daftar, aksi, kabar);

  const acuan = k.kerjaSusun || k.kerjaIsi || k.isi.firstChild;
  if (acuan && acuan.parentNode === k.isi) k.isi.insertBefore(akar, acuan);
  else k.isi.appendChild(akar);
  k.kerjaBas = akar;

  let pilih = [];
  const segarkanTombol = () => {
    const n = pilih.filter((x) => x.centang.checked && !x.centang.disabled).length;
    tombol.disabled = n === 0;
    tombol.textContent = n ? `Input ke ABT (${n})` : "Input ke ABT";
  };

  const gambar = (data, usulan, catatan) => {
    dataKotak.textContent = "";
    for (const { label, nilai } of Object.values(data)) {
      dataKotak.append(buatElemen("dt", "", label), buatElemen("dd", "", nilai));
    }
    if (!Object.keys(data).length) dataKotak.appendChild(buatElemen("dd", "aleta-remeh", "Data sidang tidak terbaca dari SIPP."));
    daftar.textContent = "";
    pilih = [];
    const peta = barisVariabel();
    for (const u of usulan) {
      const item = peta.get(String(u.kode));
      const baris = buatElemen("label", "aleta-abt-centang-baris aleta-p7-baris");
      const c = document.createElement("input");
      c.type = "checkbox";
      c.className = "aleta-abt-centang";
      // 1.184.0 (butir 1): yang tipenya belum diketahui tidak dicentang sendiri.
      c.checked = p7VariabelKosong(item) && a3BolehDiisi(u.kode) === true;
      c.addEventListener("change", segarkanTombol);
      baris.appendChild(c);
      const teks = buatElemen("span", "aleta-abt-nama", `${u.nama || u.kode}: ${u.nilai}`);
      teks.title = `Variabel ${u.kode} · sekarang: ${(item && item.nilai) || "(kosong)"}`;
      baris.appendChild(teks);
      daftar.appendChild(baris);
      pilih.push({ usulan: u, centang: c, nilai: () => String(u.nilai), disunting: () => false });
    }
    if (!usulan.length) daftar.appendChild(buatElemen("div", "aleta-remeh", "Tidak ada data baru untuk diinput ke blangko BAS ini."));
    if (catatan.length) daftar.appendChild(buatElemen("div", "aleta-p7-catatan aleta-teknis", catatan.join(" ")));
    segarkanTombol();
  };

  const jalankan = async () => {
    baca.disabled = true;
    tombol.disabled = true;
    kabar.className = "aleta-p7-kabar";
    kabar.textContent = "Membaca data sidang SIPP dan usulan variabel…";
    const nomor = nomorPerkaraAbt() || (typeof a1NomorDariVariabel === "function" ? a1NomorDariVariabel() : "");
    const catatan = [];
    let data = {};
    let dariBot = [];
    try {
      if (!nomor) throw new Error("Nomor perkara tidak terbaca dari kepala halaman.");
      const [rincian, bot, tambahan, tipeAda] = await Promise.all([
        p7BacaRincian(nomor).catch((g) => {
          catatan.push(`Data sidang: ${String((g && g.message) || g)}.`);
          return null;
        }),
        mintaUsulan({ nomorPerkara: nomor, sumber: "sipp" }).catch((g) => {
          catatan.push(`Usulan SIPP: ${String((g && g.message) || g)}.`);
          return null;
        }),
        p7UsulanTambahan(nomor, catatan),
        muatTipeHalaman().catch(() => false),
      ]);
      if (rincian) data = p7DataSidang(rincian, p7PilihSidang(rincian, p7SidangKe()));
      const s = bot && bot.sipp;
      if (s && s.ok !== false && Array.isArray(s.usulan)) dariBot = s.usulan;
      const peta = barisVariabel();
      if (!tipeAda) catatan.push("Tipe variabel ABT belum terbaca - usulan tidak dicentang sendiri; periksa sebelum Input.");
      const dihitung = [...peta.keys()].filter((kode) => a3BolehDiisi(kode) === false).length;
      if (dihitung) catatan.push(`${dihitung} variabel halaman ini dihitung ABT sendiri (data SIPP/kueri/multi sidang) - tidak diusulkan.`);
      gambar(data, p7GabungUsulan([...dariBot, ...tambahan], p7UsulanDariSidang(data, peta), peta), catatan);
      kabar.textContent = "";
    } catch (galat) {
      kabar.className = "aleta-p7-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
    } finally {
      baca.disabled = false;
    }
  };

  baca.addEventListener("click", () => void jalankan());
  tombol.addEventListener("click", async () => {
    const dipilih = pilih.filter((x) => x.centang.checked && !x.centang.disabled);
    if (!dipilih.length) return;
    const jatiDiri = jatiDiriPerkara();
    if (!jatiDiri) {
      kabar.className = "aleta-p7-kabar aleta-abt-gagal";
      kabar.textContent = "Perkara blangko ini tidak terbaca - muat ulang halaman ABT.";
      return;
    }
    tombol.disabled = true;
    baca.disabled = true;
    kabar.className = "aleta-p7-kabar";
    try {
      const h = await terapkanUsulanBerurutan(dipilih, jatiDiri, (t) => {
        kabar.textContent = t;
      });
      kabar.className = h.gagal.length ? "aleta-p7-kabar aleta-abt-gagal" : "aleta-p7-kabar";
      kabar.textContent = `${h.berhasil} variabel tersimpan ke ABT${h.gagal.length ? `; gagal: ${h.gagal.join("; ")}` : "."}`;
    } catch (galat) {
      kabar.className = "aleta-p7-kabar aleta-abt-gagal";
      kabar.textContent = String((galat && galat.message) || galat);
    } finally {
      baca.disabled = false;
      segarkanTombol();
    }
  });

  // Membaca sendiri sekali (hanya membaca). Mode kering menahan POST usulan -
  // dijalankan lewat "Baca ulang" saja, seperti Isi dari SIPP lainnya.
  if (soreKeringNyala()) {
    kabar.textContent = 'Mode kering menyala - tekan "Baca ulang" untuk membaca data sidang.';
  } else {
    void jalankan();
  }
}

/*
 * ============================================================================
 * P3 - PUTUSAN PER STATUS DI PUTUSAN MASSAL ABT (BUTIR 3)
 * ============================================================================
 *
 * Status putusan perkara: dari jadwal sidang yang dibaca panel ini
 * (s.statusPutusan / s.verstek), atau dari panel SIPP yang menyimpannya di
 * "blangkoPutusanMassal".status = { nomor: { statusPutusan, verstek } }.
 * Baris pemetaan KHUSUS status (bukan baris jenis) menang atas blangko utama
 * hari itu; pilihan per perkara tetap menang atas semuanya. Berlaku di semua
 * tampilan - yang berubah hanya blangko yang dipakai, bukan tampilannya.
 */
async function p3BacaStatusSipp() {
  try {
    const x = await chrome.storage.local.get([A2_KUNCI_BLANGKO_SIPP]);
    const simpan = x && x[A2_KUNCI_BLANGKO_SIPP];
    return simpan && simpan.status && typeof simpan.status === "object" ? simpan.status : {};
  } catch {
    return {};
  }
}

/** Baris pemetaan khusus status untuk perkara ini, atau null (= jenis / utama). */
function p3PetaStatus(keadaan, s) {
  if (!keadaan || !s || typeof alatPetaUntukPerkara !== "function") return null;
  const st = (keadaan.statusSipp && keadaan.statusSipp[s.nomor]) || null;
  const statusPutusan = String(s.statusPutusan || (st && st.statusPutusan) || "");
  if (!statusPutusan) return null;
  const h = alatPetaUntukPerkara(keadaan.peta, s.jenis, statusPutusan, Boolean(s.verstek) || Boolean(st && st.verstek));
  return h && h.tingkat !== "jenis" && alatBlangkoTerpetakan(h.baris) ? h.baris : null;
}

/** Baris pemetaan menurut jenis + status (tanpa pilihan per perkara dan utama). */
function p3PetaJenis(keadaan, s) {
  if (typeof alatPetaUntukPerkara !== "function") return keadaan.peta[alatKunciJenis(s.jenis)];
  const st = (keadaan.statusSipp && keadaan.statusSipp[s.nomor]) || null;
  const h = alatPetaUntukPerkara(keadaan.peta, s.jenis, s.statusPutusan || (st && st.statusPutusan) || "", Boolean(s.verstek) || Boolean(st && st.verstek));
  return h ? h.baris : undefined;
}

/* === KONTAK-EC 11 Okt === */
/**
 * ============================================================================
 * KONTAK-EC (11 Okt 2026, agen 5): KONTAK & DOMISILI ELEKTRONIK DARI e-COURT DI PANEL ABT
 * ============================================================================
 *
 * Permintaan pengguna: "buat otomatis abt mengambil data juga dari aleta
 * e-court" dan "deteksi email dan nomor whatsapp dari e-court untuk
 * dimasukkan datanya ke sipp dan abt".
 *
 * Bacaan e-Court (p4BacaGugatan, dijalankan OTOMATIS bersama "Isi dari SIPP")
 * kini juga memulangkan `kontak` - email/HP tiap pihak dan kuasa menurut
 * e-Court dibanding isian SIPP. Variabel ABT kontak bertipe kueri (data_sql),
 * jadi tidak dapat diisi panel: nilainya masuk blangko lewat
 *
 *   8800-8811, 8813 (paket ABT abt-data-ecourt): SIPP lebih dulu, kosong =
 *   ringkasan e-Court berkeyakinan pasti/cukup yang ditulis bot ke database
 *   aleta_bot (server MySQL yang sama dengan SIPP) - terisi walau panel ini
 *   tidak pernah dibuka;
 *   0027/0045/8175/8179/8180/0370/0372 (variabel lama, SIPP saja) - terisi
 *   begitu petugas menyimpan kontaknya di blangko Data Pihak SIPP (lajur
 *   "Kontak dari e-Court" di SIPP menawarkan isiannya).
 *
 * Lipatan ini hanya MENAMPILKAN - tidak menulis apa pun.
 */
const K5_VAR_KONTAK = Object.freeze([
  "0027", "0045", "8175", "8179", "8180", "0370", "0372", "0123", "7139", "8548", "8549",
  "8800", "8801", "8802", "8803", "8804", "8805", "8806", "8807", "8808", "8809", "8810", "8811", "8813",
]);
const K5_ROMAWI = ["", "", " II", " III", " IV", " V"];
const K5_TERHADAP_SIPP = { kosong: "SIPP kosong", sama: "sama dengan SIPP", beda: "BERBEDA dengan SIPP" };

/** Sebutan orang: 0046 = Penggugat/Pemohon (pihak ke-1), 0047 = Tergugat/Termohon (pihak ke-2). */
function k5Sebutan(o) {
  const dasar = Number(o && o.pihakKe) === 1 ? String(nilaiVariabel("0046") || "").trim() || "Penggugat" : String(nilaiVariabel("0047") || "").trim() || "Tergugat";
  const ke = o && o.jenis === "pihak" ? K5_ROMAWI[Number(o.urutan) || 1] || "" : "";
  return o && o.jenis === "kuasa" ? `Kuasa ${dasar}` : `${dasar}${ke}`;
}

/** Baris ringkas satu orang (murni). Kosong bila e-Court tidak mengusulkan apa pun. */
function k5RingkasOrang(o) {
  const bagian = [];
  for (const kolom of ["email", "hp"]) {
    const u = o && o.usulan && o.usulan[kolom];
    if (!u || !u.nilai) continue;
    const label = kolom === "email" ? "email" : u.jenisNomor === "telepon" ? "telepon" : "HP/WA";
    bagian.push(`${label} ${u.nilai} (${K5_TERHADAP_SIPP[u.terhadapSipp] || u.terhadapSipp}; ${u.keyakinan})`);
  }
  return bagian.length ? `${k5Sebutan(o)} - ${o.nama || "?"}: ${bagian.join(" · ")}` : "";
}

/** Lipatan "Kontak & domisili elektronik dari e-Court" di bawah kartu usulan. */
function k5GambarKontak(wadah, data) {
  const k = data && data.gugatan && data.gugatan.kontak;
  if (!wadah || !k || !k.ada) return;
  const orang = Array.isArray(k.orang) ? k.orang : [];
  const baris = orang.map((o) => ({ o, teks: k5RingkasOrang(o) })).filter((x) => x.teks);
  const domisili = k.domisili && typeof k.domisili === "object" ? k.domisili : {};
  const adaDomisili = [1, 2].some((s) => domisili[s] && domisili[s].email);
  if (!baris.length && !adaDomisili) return;
  const kotak = document.createElement("details");
  kotak.className = "aleta-abt-kartu aleta-k5-kontak";
  const kosongSipp = baris.filter((x) => ["email", "hp"].some((c) => x.o.usulan[c] && x.o.usulan[c].terhadapSipp === "kosong")).length;
  kotak.appendChild(
    buatElemen("summary", "aleta-abt-nama", `Kontak & domisili elektronik dari e-Court: ${baris.length} orang${kosongSipp ? ` · ${kosongSipp} belum ada di SIPP` : ""}`)
  );
  for (const x of baris) {
    const el = buatElemen("div", "aleta-abt-kutipan", x.teks);
    const sumber = ["email", "hp"].map((c) => x.o.usulan[c] && x.o.usulan[c].sumber && x.o.usulan[c].sumber[0]).filter(Boolean);
    if (sumber.length) el.title = sumber.map((s) => `${s.label}${s.kutipan ? `: "${s.kutipan}"` : ""}`).join("\n");
    kotak.appendChild(el);
  }
  for (const sisi of [1, 2]) {
    const d = domisili[sisi];
    if (!d || !d.email) continue;
    const sebutan = k5Sebutan({ pihakKe: sisi, jenis: "pihak", urutan: 1 });
    kotak.appendChild(
      buatElemen(
        "div",
        "aleta-abt-kutipan",
        `Domisili elektronik ${sebutan}: ${d.email} (${d.milik === "kuasa" ? "email kuasa" : "email pihak"}, dari ${d.asal === "sipp" ? "SIPP" : "e-Court"}${d.keyakinan && d.asal !== "sipp" ? `, ${d.keyakinan}` : ""})`
      )
    );
  }
  kotak.appendChild(
    buatElemen(
      "div",
      "aleta-t6-lembut aleta-teknis",
      "Masuk ke blangko lewat variabel 8800-8811 (SIPP lebih dulu; kosong = e-Court berkeyakinan cukup). Variabel lama 0027/0045/8179/8180/0370/0372 membaca SIPP saja - simpan kontaknya di SIPP (Data Pihak / Pengacara: lajur \"Kontak dari e-Court\" menawarkan isiannya). Tidak ada yang ditulis dari sini."
    )
  );
  wadah.appendChild(kotak);
}
/* === AKHIR KONTAK-EC === */

/* === PEKERJAAN 11 Okt === */
/**
 * ============================================================================
 * PEKERJAAN (11 Okt 2026, agen 7): KARTU "PEKERJAAN TERBACA" DI PANEL ABT
 * ============================================================================
 *
 * Variabel ABT 8510 (duduk perkara), 8524 (pertimbangan) dan 8533 (BAS) -
 * kalimat izin atasan PNS/POLRI/TNI/BUMN-BUMD/perangkat desa - kini membaca
 * kategori pekerjaan #0046# secara DINAMIS (paket abt-pekerjaan-dinamis):
 * pilihan SIPP baku tetap seperti dulu; "Lain-Lain" dibaca dari uraiannya
 * (PNS/ASN -> PNS, PPPK -> "Aparatur Sipil Negara (PPPK)", Anggota Polri -> POLRI, ...; pensiunan, CPNS, PPPK paruh waktu, honorer,
 * kontrak, swasta -> bukan). Kartu ini MENAMPILKAN hasil baca itu untuk tiap
 * pihak (bot: data.sipp.pekerjaanPihak - aturan yang sama, kamus
 * pekerjaan.json) agar petugas tahu MENGAPA kalimat izin atasan muncul atau
 * tidak. Tidak menulis apa pun.
 */
const PK_ROMAWI = ["", "", " II", " III", " IV", " V"];
const PK_KATEGORI_IZIN = Object.freeze(["PNS", "PPPK", "POLRI", "TNI", "BUMN", "BUMD", "DESA"]);
const PK_KATEGORI_TERGUGAT = Object.freeze(["PNS", "PPPK", "POLRI", "TNI"]);

/** Satu baris kartu (murni). */
function pkBarisPihak(o) {
  if (!o) return "";
  const dasar = Number(o.pihakKe) === 1 ? String(nilaiVariabel("0046") || "").trim() || "Penggugat" : String(nilaiVariabel("0047") || "").trim() || "Tergugat";
  const sebutan = `${dasar}${PK_ROMAWI[Number(o.urutan) || 1] || ""}`;
  const pilihan = o.asal === "pilihan" ? "pilihan SIPP baku" : o.kunci === "KOSONG" ? "kosong di SIPP" : "pilihan SIPP: Lain-Lain";
  const kategori = o.kunci === "BUKAN" || o.kunci === "LAIN" || o.kunci === "KOSONG" ? "" : o.label || o.kunci;
  const isi =
    o.kunci === "KOSONG"
      ? "pekerjaan belum diisi di SIPP"
      : kategori
        ? `${kategori} (dari teks '${o.pekerjaan}', ${pilihan})`
        : `${o.kalimat || o.pekerjaan}`;
  return `${sebutan}${o.nama ? ` - ${o.nama}` : ""}: ${isi}`;
}

/** Kartu lipat "Pekerjaan terbaca" di bawah kartu usulan. */
function pkGambarPekerjaan(wadah, data) {
  const daftar = data && data.sipp && Array.isArray(data.sipp.pekerjaanPihak) ? data.sipp.pekerjaanPihak : [];
  if (!wadah || !daftar.length) return;
  const p1 = daftar.find((o) => Number(o.pihakKe) === 1 && Number(o.urutan) === 1) || null;
  const kotak = document.createElement("details");
  kotak.className = "aleta-abt-kartu aleta-pk-pekerjaan";
  const izin = p1 && PK_KATEGORI_IZIN.includes(p1.kunci);
  const ringkas = p1
    ? `Pekerjaan terbaca: ${p1.kunci === "BUKAN" || p1.kunci === "LAIN" || p1.kunci === "KOSONG" ? p1.kalimat || p1.pekerjaan || "-" : `${p1.label || p1.kunci} (dari teks '${p1.pekerjaan}', ${p1.asal === "pilihan" ? "pilihan SIPP baku" : "pilihan SIPP: Lain-Lain"})`}`
    : "Pekerjaan terbaca";
  kotak.appendChild(buatElemen("summary", "aleta-abt-nama", ringkas));
  for (const o of daftar) kotak.appendChild(buatElemen("div", "aleta-abt-kutipan", pkBarisPihak(o)));
  kotak.appendChild(
    buatElemen(
      "div",
      "aleta-t6-lembut aleta-teknis",
      izin
        ? `Kalimat izin atasan (#8510# duduk perkara, #8524# pertimbangan, #8533# BAS) dipakai untuk ${p1.label || p1.kunci} pada cerai gugat/talak - nomor/tanggal/pejabat surat izin dari SIPP (Izin Cerai). Hanya dibaca, tidak ada yang ditulis dari sini.`
        : "Kalimat izin atasan (#8510#/#8524#/#8533#) TIDAK dipakai untuk pekerjaan #0046# ini. Hanya dibaca, tidak ada yang ditulis dari sini."
    )
  );
  // Keputusan pengguna 11 Okt (5): Tergugat/Termohon PNS/PPPK/POLRI/TNI -> kalimat kewajiban pemberitahuan gugatan
  // kepada atasannya disambung di #8524# (disusun dari PP 45/1990 Pasal 3 - perlu ditinjau hakim).
  const p2 = daftar.find((o) => Number(o.pihakKe) === 2 && Number(o.urutan) === 1) || null;
  if (p2 && PK_KATEGORI_TERGUGAT.includes(p2.kunci)) {
    kotak.appendChild(
      buatElemen(
        "div",
        "aleta-t6-lembut aleta-teknis",
        `#0047# ${p2.label || p2.kunci}: #8524# juga memuat kalimat kewajiban surat permintaan izin atau pemberitahuan adanya gugatan perceraian kepada atasan #0047# (disusun dari PP 10/1983 jo. PP 45/1990 Pasal 3 - mohon ditinjau hakim).`
      )
    );
  }
  wadah.appendChild(kotak);
}
/* === AKHIR PEKERJAAN === */
