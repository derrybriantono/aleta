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
const URUTAN_HURUF = ["A", "B", "F", "H"];

/** Gabungan yang benar-benar punya cabang di kueri 4020. */
const GABUNGAN_4020 = new Set(["A", "B", "F", "H", "AB", "AF", "BF", "ABF"]);

function susun8503(daftar) {
  const bersih = Array.from(new Set(daftar.map((x) => String(x || "").trim().toUpperCase())));
  bersih.sort((a, b) => URUTAN_HURUF.indexOf(a) - URUTAN_HURUF.indexOf(b));
  return bersih.join("");
}

function dikenali4020(daftar) {
  return GABUNGAN_4020.has(susun8503(daftar));
}

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
    return { ok: false, pesan: alatPesanGagal(null, respons.status, "Menyambung kata") };
  }

  const luar = await respons.json();
  const isi = luar?.data ?? luar;
  if (!isi?.available) {
    // Pesan dari portal diteruskan apa adanya bila ada - ia menyebut sebab
    // yang lebih tepat daripada kalimat umum, misalnya penolakan pagar isi.
    return { ok: false, pesan: isi?.message || alatPesanGagal(null, 0, "Menyambung kata") };
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
    return { ok: false, pesan: alatPesanGagal(null, respons.status, "Merapikan posita") };
  }

  const luar = await respons.json();
  const isi = luar?.data ?? luar;
  if (!isi?.available) {
    return { ok: false, pesan: isi?.message || alatPesanGagal(null, 0, "Merapikan posita") };
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
async function ambilTanyaJawab(kode) {
  const dicoba = [];
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
    if (baris.length > 0) return { baris, urutan };
  }

  if (galatTerakhir) throw galatTerakhir;
  throw new Error(
    "tidak ada sidang yang memuat keterangan saksi ini - diperiksa urutan 1 sampai " +
      BATAS_URUTAN_SIDANG
  );
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
try {
  chrome.storage.onChanged.addListener((perubahan, wilayah) => {
    if (wilayah !== "local" || !perubahan[KUNCI_SUNTING_LANGSUNG]) return;
    suntingLangsungNyala = perubahan[KUNCI_SUNTING_LANGSUNG].newValue === true;
  });
} catch {
  /* di luar konteks ekstensi */
}

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
async function catatRiwayat(catatan) {
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
    if (!suntingLangsungNyala) return;
    mulaiSunting();
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
      buatElemen("span", "aleta-abt-asal", s.asal === "posita" ? "Posita" : s.saksi ? `Saksi ${s.saksi}` : "SIPP")
    );
    kutip.appendChild(buatElemen("span", "aleta-abt-kalimat", s.kalimat));
    kartu.appendChild(kutip);
  }

  // Nilai dibaca lewat fungsi, bukan disalin sekarang: yang dipakai Terapkan
  // harus yang terbaca SAAT tombol ditekan, termasuk suntingan terakhir.
  pilih.push({
    usulan: u,
    centang,
    nilai: () => nilaiTerkini,
    disunting: () => disunting,
  });
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
  return isi;
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

/** Jenis perkara dari nomornya: Pdt.G gugatan, Pdt.P permohonan. */
function jenisPerkaraDariNomor(nomor) {
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
  const jenis = jenisPerkaraDariNomor(nomor);
  if (jenis) tambah("aleta-id-jenis", "", jenis, "Jenis perkara menurut nomornya.");
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

/** Cermin CIRI_ALASAN di abtUsulanService - kunci alasan yang dikenal portal. */
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
];

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

  // Tombol berbahasa hukum yang resmi: yang menekannya panitera pengganti,
  // bukan pemrogram, dan "8503" tidak berarti apa-apa bagi berita acara.
  // Tombol yang variabel sasarannya tidak ada di blangko ini tidak digambar.
  const petaAwal = barisVariabel();
  const tombolBaris = buatElemen("div", "aleta-abt-aksi");
  const tombolSipp = buatElemen("button", "aleta-permintaan-tombol", "Isi blangko dari SIPP");
  tombolSipp.type = "button";
  const tombolSaksi = buatElemen("button", "aleta-permintaan-tombol", "Susun posita dari keterangan saksi");
  tombolSaksi.type = "button";
  const tombolItsbat = buatElemen("button", "aleta-permintaan-tombol", "Isi dari posita permohonan");
  tombolItsbat.type = "button";
  tombolItsbat.title = "Tanggal dan tempat nikah, wali, saksi nikah, mahar, status, umur, dan anak - dibaca dari posita.";
  tombolItsbat.hidden = !(petaAwal.has("5197") || petaAwal.has("8087"));
  const tombolSdg = buatElemen("button", "aleta-permintaan-tombol", "Susun keterangan saksi 1 & 2");
  tombolSdg.type = "button";
  tombolSdg.title = "Dua keterangan dari satu templat ABT: substansi sama, kalimat berbeda.";
  tombolSdg.hidden = !petaAwal.has(VAR_SAKSI_1);

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
    tombolSdg.hidden = false;
    const saksiKe = saksiKeberapa();
    tombolSdg.title =
      `Menyusun keterangan kedua saksi dari satu templat ABT${saksiKe ? ` - halaman ini saksi ${saksiKe}` : ""}. ` +
      "Keduanya diperlihatkan untuk dibaca sebelum disimpan.";
  }
  tombolBaris.appendChild(tombolSipp);
  tombolBaris.appendChild(tombolSaksi);
  tombolBaris.appendChild(tombolItsbat);
  tombolBaris.appendChild(tombolSdg);
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
  function gambarSepihak(hasil) {
    wadahSepihak.textContent = "";
    const sepihak = (hasil && hasil.ciriSepihak) || [];
    const diluar = (hasil && hasil.ciriDiluarGugatan) || [];
    const belum = (hasil && hasil.ciriBelumTerbukti) || [];
    const terbukti = (hasil && hasil.ciri) || [];
    if (!sepihak.length && !diluar.length && !belum.length && !terbukti.length) return;

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
    if (terbukti.length) {
      kotak.appendChild(
        buatElemen("div", "aleta-abt-naskah", `Siap dipakai - ${terbukti.length} alasan`)
      );
      kotak.appendChild(
        buatElemen(
          "div",
          "aleta-abt-catatan",
          "Dikuatkan KEDUA saksi dan didalilkan dalam gugatan. Inilah yang sudah " +
            "tertulis pada alasan perceraian (5227); tidak ada yang perlu dikerjakan."
        )
      );
      for (const satu of terbukti) {
        const baris = buatElemen("div", "aleta-abt-sanding");
        baris.appendChild(buatElemen("span", "aleta-abt-label", "Terbukti"));
        baris.appendChild(buatElemen("span", "aleta-abt-isi", satu.nama || satu));
        kotak.appendChild(baris);
      }
    }

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

    const kelompok = (judul, keterangan, daftar, label) => {
      if (!daftar.length) return;
      kotak.appendChild(buatElemen("div", "aleta-abt-naskah", judul));
      kotak.appendChild(buatElemen("div", "aleta-abt-catatan", keterangan));
      for (const satu of daftar) {
        const baris = buatElemen("div", "aleta-abt-sanding");
        baris.appendChild(buatElemen("span", "aleta-abt-label", label(satu)));
        baris.appendChild(buatElemen("span", "aleta-abt-isi", satu.nama || satu));
        kotak.appendChild(baris);
      }
    };

    kelompok(
      "Hanya disebut satu saksi",
      "Perlu penguat. Tanyakan kepada saksi yang belum menyebutnya, atau kuatkan " +
        "dengan alat bukti lain sebelum memasukkannya sendiri ke 5227.",
      sepihak,
      (x) => `Saksi ${x.saksi}`
    );

    kelompok(
      "Terbukti, tetapi tidak didalilkan dalam gugatan",
      "Kedua saksi menerangkannya, tetapi gugatannya tidak pernah mendalilkannya. " +
        "Memasukkannya ke pertimbangan berarti memutus melebihi yang dituntut.",
      diluar,
      () => "Di luar gugatan"
    );

    kelompok(
      "Didalilkan dalam gugatan, tetapi belum dikuatkan kedua saksi",
      "Dalil yang masih harus dibuktikan - atau ditolak dengan pertimbangan " +
        "tersendiri. Yang tidak disinggung sama sekali adalah tuntutan yang tidak diadili.",
      belum,
      () => "Belum terbukti"
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

    wadahSepihak.appendChild(kotak);
  }
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
              cara: "centangan huruf alasan",
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

        // ====================================================================
        // GABUNGAN YANG TIDAK DIKENALI KUERI 4020 DISEBUTKAN SEKARANG
        // ====================================================================
        //
        // Bukan sesudahnya, dan bukan dibiarkan. Yang tidak dikenali membuat
        // 4020 berbunyi "TIDAK BENAR QUERY NYA / BELUM ISI ALASAN DI KOLOM
        // ABT" - dan kalimat itu ikut tercetak ke dalam putusan.
        if (!gagal && !dikenali4020(dipilih)) {
          gagal = true;
          pesan =
            `8503 diisi "${isi8503}", tetapi kueri 4020 milik ABT tidak mengenali gabungan ini - ` +
            `ia hanya mengenal A, B, F, H sendiri-sendiri, AB, AF, BF, dan ABF. ` +
            `4020 akan berbunyi "TIDAK BENAR QUERY NYA" dan kalimat itu ikut tercetak. ` +
            `Perbaiki kuerinya di ABT, atau kurangi hurufnya.`;
        }

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
    { tombol: "Alt+A", kunci: "a", nama: "ciutkan / bentangkan panel", jalankan: (p) => alatCiutkan(p, PENANDA_ABT) },
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
    const lama = document.getElementById(PENANDA_ABT);
    if (lama) lama.remove();
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
    // Tombol yang akan ditolak disembunyikan begitu kewenangannya diketahui.
    // Menawarkan tombol lalu menolaknya sesudah ditekan terbaca sebagai
    // kerusakan, bukan sebagai pembatasan yang disengaja.
    if (!bolehAbt("blangko-abt")) {
      for (const tombol of [tombolSipp, tombolSaksi, tombolItsbat, tombolSdg]) tombol.hidden = true;
      kabar.textContent =
        "Peran Anda tidak diberi akses panel blangko ABT. Panel ini hanya menampilkan keterangan.";
    }
    if (!pengguna) return;
    const kepalaBaru = pitaIdentitasAbt(pengguna);
    pitaKepala.replaceWith(kepalaBaru);
    pitaKepala = kepalaBaru;
  });

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
      // Yang menentukan ISI YANG TERBACA SEKARANG, bukan usulan semula -
      // petugas boleh menyuntingnya di kartu sebelum menekan tombol ini.
      const dipilih = pilih.filter((x) => x.centang.checked && x.nilai());
      if (dipilih.length === 0) {
        hasilTerap.textContent = "Tidak ada yang dicentang.";
        return;
      }
      terap.disabled = true;
      let berhasil = 0;
      const gagal = [];
      for (const x of dipilih) {
        hasilTerap.textContent = `Menyimpan ${x.usulan.nama}…`;
        try {
          const nilaiDipakai = x.nilai();
          const sebelum = (barisVariabel().get(x.usulan.kode) || {}).nilai || "";
          const hasil = await simpanVariabel(x.usulan.kode, nilaiDipakai, jatiDiri);
          if (hasil.ok) {
            berhasil += 1;
            // Riwayat menyebut SUNTINGANNYA. Tanpa itu, kalimat yang ditulis
            // petugas sendiri tercatat seolah-olah usulan mesin - dan yang
            // membacanya kelak tidak dapat membedakan mana yang diperiksa
            // manusia dan mana yang lolos begitu saja.
            const asalUsulan =
              x.usulan.sumber && x.usulan.sumber[0] && x.usulan.sumber[0].asal === "posita"
                ? `usulan dari posita permohonan (${x.usulan.keyakinan})`
                : x.usulan.sumber && x.usulan.sumber[0] && x.usulan.sumber[0].saksi
                ? `usulan dari keterangan saksi (${x.usulan.keyakinan})`
                : `usulan dari SIPP (${x.usulan.keyakinan})`;
            void catatRiwayat({
              perkaraId: jatiDiri.perkaraId,
              kode: x.usulan.kode,
              nama: x.usulan.nama,
              sebelum,
              sesudah: nilaiDipakai,
              cara: x.disunting()
                ? x.usulan.nilai
                  ? `${asalUsulan}, disunting petugas sebelum disimpan`
                  : "diketik petugas di panel ALETA"
                : asalUsulan,
              pada: new Date().toISOString(),
            });
            const item = barisVariabel().get(x.usulan.kode);
            if (item) item.selNilai.textContent = nilaiDipakai;
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
      const teks1 = peta.get(VAR_SAKSI_1) ? peta.get(VAR_SAKSI_1).selNilai.innerText : "";
      const teks2 = peta.get(VAR_SAKSI_2) ? peta.get(VAR_SAKSI_2).selNilai.innerText : "";
      if (!teks1.trim() && !teks2.trim()) {
        throw new Error("Keterangan saksi 1 dan saksi 2 masih kosong di halaman ini.");
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
        // Gugatannya - 5227 hanya boleh memuat alasan yang DIDALILKAN dan
        // dibuktikan. innerText cukup di sini: yang dicocokkan kata kuncinya,
        // bukan teksnya yang akan disimpan.
        posita: peta.get(VAR_POSITA) ? peta.get(VAR_POSITA).selNilai.innerText : "",
      });
      const saksi = isiJawaban.saksi || {};
      kabar.textContent =
        `Terbaca ${saksi.butir?.saksi1 || 0} butir dari saksi 1 dan ${saksi.butir?.saksi2 || 0} dari saksi 2.`;
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
      const isiJawaban = await mintaUsulan({
        nomorPerkara: nomorPerkaraAbt(),
        sumber: "itsbat",
        posita,
        pelaku: nilaiVariabel(VAR_PIHAK_PELAKU),
      });
      const itsbat = isiJawaban.itsbat || {};
      if (itsbat.ok === false) throw new Error(itsbat.alasan || "Posita tidak dapat dibaca.");
      kabar.textContent = itsbat.catatan || "";
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
   * SUSUN KETERANGAN DUA SAKSI
   * ==========================================================================
   */
  function gambarPratinjauSdg(hasil, urutan, templat, sudahAda) {
    const kotak = buatElemen("div", "aleta-sdg-hasil");

    const ringkas = [];
    if (hasil.alasan && hasil.alasan.length) {
      ringkas.push(
        `Alasan yang dipakai: ${hasil.alasan.join(", ")}` +
          (hasil.asalAlasan === "posita" ? " (dibaca dari gugatan/permohonan)." : " (dipilih).")
      );
    }
    if (hasil.catatan) ringkas.push(hasil.catatan);
    if (hasil.identik) ringkas.push(`${hasil.identik} jawaban masih sama persis pada kedua saksi - ubah salah satunya.`);
    kotak.appendChild(buatElemen("div", "aleta-abt-catatan", ringkas.join(" ")));

    const perlu = new Set((hasil.perluDiisi || []).map((x) => String(x.no)));
    const dua = buatElemen("div", "aleta-sdg-dua");
    const kolomIsian = [];
    for (const [nomorSaksi, daftar] of [
      [1, hasil.saksi1 || []],
      [2, hasil.saksi2 || []],
    ]) {
      const kolom = buatElemen("div", "aleta-sdg-kolom");
      kolom.appendChild(buatElemen("div", "aleta-sdg-judul", `Saksi ${nomorSaksi}`));
      const isian = [];
      for (const b of daftar) {
        const baris = buatElemen("div", `aleta-sdg-baris${perlu.has(String(b.no)) ? " aleta-sdg-perlu" : ""}`);
        baris.appendChild(buatElemen("div", "aleta-sdg-tanya", `${b.no}. ${b.tanya}`));
        const jawab = document.createElement("textarea");
        jawab.className = "aleta-sdg-jawab";
        jawab.rows = 2;
        jawab.value = b.jawab;
        if (perlu.has(String(b.no))) jawab.title = "Jawaban templat ini masih memuat titik-titik; lengkapi dari keterangan saksi yang sesungguhnya.";
        baris.appendChild(jawab);
        kolom.appendChild(baris);
        isian.push({ no: b.no, tanya: b.tanya, jawab });
      }
      dua.appendChild(kolom);
      kolomIsian.push(isian);
    }
    kotak.appendChild(dua);

    const simpan = buatElemen(
      "button",
      "aleta-permintaan-tombol",
      `Simpan keterangan saksi 1 dan 2 ke ABT (sidang ke-${urutan})`
    );
    simpan.type = "button";
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
    kotak.appendChild(simpan);
    kotak.appendChild(hasilSimpan);

    simpan.addEventListener("click", async () => {
      simpan.disabled = true;
      hasilSimpan.className = "aleta-abt-kabar";
      const gagal = [];
      let tersimpan = 0;
      for (const [i, kodeVar] of [VAR_SAKSI_1, VAR_SAKSI_2].entries()) {
        const baris = kolomIsian[i]
          .map((x, n) => ({ no: String(n + 1), tanya: x.tanya, jawab: x.jawab.value.trim() }))
          .filter((x) => x.jawab);
        hasilSimpan.textContent = `Menyimpan keterangan saksi ${i + 1}…`;
        try {
          const sebelum = nilaiVariabel(kodeVar);
          const r = await kirimTanyaJawab(kodeVar, urutan, baris);
          if (!r.ok) {
            gagal.push(`saksi ${i + 1}: ${r.pesan}`);
            continue;
          }
          tersimpan += 1;
          void catatRiwayat({
            perkaraId: jatiDiri.perkaraId,
            kode: kodeVar,
            nama: `Keterangan saksi ${i + 1}`,
            sebelum,
            sesudah: `${baris.length} tanya-jawab dari templat ${templat}`,
            cara: `disusun ALETA dari templat ${templat}` + (hasil.asalAlasan === "posita" ? " (sama dengan gugatan)" : ""),
            pada: new Date().toISOString(),
          });
        } catch (galat) {
          gagal.push(`saksi ${i + 1}: ${String((galat && galat.message) || galat)}`);
        }
      }
      simpan.disabled = false;
      hasilSimpan.className = gagal.length ? "aleta-abt-kabar aleta-abt-gagal" : "aleta-abt-kabar";
      hasilSimpan.textContent = gagal.length
        ? `${tersimpan} tersimpan, ${gagal.length} gagal — ${gagal.join("; ")}`
        : "Keterangan kedua saksi tersimpan di ABT. Muat ulang halaman supaya isi variabel keterangan saksi ikut berubah.";

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

  function gambarFormSdg(daftarTemplat, urutanAwal, sudahAda) {
    wadahUsulan.textContent = "";
    const form = buatElemen("div", "aleta-sdg-form");

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

    const barisSdg = buatElemen("label", "aleta-sdg-ruas aleta-sdg-centang");
    const centangSdg = document.createElement("input");
    centangSdg.type = "checkbox";
    centangSdg.checked = true;
    barisSdg.appendChild(centangSdg);
    barisSdg.appendChild(document.createTextNode(" Sama dengan gugatan/permohonan - alasan dibaca dari positanya"));
    form.appendChild(barisSdg);

    // ======================================================================
    // MODUS TIAP SAKSI - DUA SAKSI JARANG TAHU HAL YANG SAMA
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
    ];
    const DAFTAR_SUMBER = [
      ["pelaku", "Penggugat/Pemohon"],
      ["lawan", "Tergugat/Termohon"],
      ["keluarga", "keluarga"],
    ];
    const kendaliModus = [];
    for (const nomorSaksi of [1, 2]) {
      const baris = buatElemen("div", "aleta-sdg-modus");
      baris.appendChild(buatElemen("span", "aleta-abt-label", `Saksi ${nomorSaksi}`));
      const pilihModus = document.createElement("select");
      pilihModus.className = "aleta-sdg-pilih";
      for (const [nilai, nama] of DAFTAR_MODUS) {
        const o = document.createElement("option");
        o.value = nilai;
        o.textContent = nama;
        pilihModus.appendChild(o);
      }
      // Bawaan: saksi 1 tahu semuanya, saksi 2 hanya sebagian - bentuk yang
      // paling sering ditemui, dan yang paling sukar dipatahkan.
      pilihModus.value = nomorSaksi === 1 ? "sama" : "sebagian";
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
      pilihSumber.hidden = pilihModus.value !== "dari-cerita";
      baris.appendChild(pilihSumber);

      // Alasan yang diketahui saksi ini - hanya bila "sebagian".
      const kotakSebagian = buatElemen("div", "aleta-sdg-alasan aleta-sdg-alasan-saksi");
      const centangSebagian = [];
      for (const a of DAFTAR_ALASAN_SDG) {
        const label = buatElemen("label", "aleta-sdg-centang");
        const c = document.createElement("input");
        c.type = "checkbox";
        c.value = a;
        label.appendChild(c);
        label.appendChild(document.createTextNode(` ${a}`));
        kotakSebagian.appendChild(label);
        centangSebagian.push(c);
      }
      kotakSebagian.hidden = pilihModus.value !== "sebagian";
      baris.appendChild(kotakSebagian);

      pilihModus.addEventListener("change", () => {
        pilihSumber.hidden = pilihModus.value !== "dari-cerita";
        kotakSebagian.hidden = pilihModus.value !== "sebagian";
      });
      form.appendChild(baris);
      kendaliModus.push({ pilihModus, pilihSumber, centangSebagian });
    }
    const bacaModus = () => {
      const satu = (k) => ({
        modus: k.pilihModus.value,
        sumber: k.pilihSumber.value,
        alasan: k.centangSebagian.filter((c) => c.checked).map((c) => c.value),
      });
      return { saksi1: satu(kendaliModus[0]), saksi2: satu(kendaliModus[1]) };
    };

    const kotakAlasan = buatElemen("div", "aleta-sdg-alasan");
    kotakAlasan.appendChild(buatElemen("div", "aleta-abt-label", "Atau pilih alasan yang diterangkan saksi"));
    const centangAlasan = [];
    for (const a of DAFTAR_ALASAN_SDG) {
      const label = buatElemen("label", "aleta-sdg-centang");
      const c = document.createElement("input");
      c.type = "checkbox";
      c.value = a;
      label.appendChild(c);
      label.appendChild(document.createTextNode(` ${a}`));
      kotakAlasan.appendChild(label);
      centangAlasan.push(c);
    }
    kotakAlasan.hidden = centangSdg.checked;
    centangSdg.addEventListener("change", () => {
      kotakAlasan.hidden = centangSdg.checked;
    });
    form.appendChild(kotakAlasan);

    const susun = buatElemen("button", "aleta-permintaan-tombol", "Susun keterangan kedua saksi");
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
        kabarForm.textContent = "Menyusun dua keterangan…";
        const peta = barisVariabel();
        const isiJawaban = await mintaUsulan({
          nomorPerkara: nomorPerkaraAbt(),
          sumber: "saksi-sdg",
          templat,
          alasan,
          posita: centangSdg.checked && peta.get(VAR_POSITA) ? peta.get(VAR_POSITA).selNilai.innerText : "",
          // Sebutan pihak dari halaman blangko (0046 penggugat/pemohon, 0047
          // tergugat/termohon); di halaman tanya-jawab keduanya kosong dan
          // bot memakai sebutan bawaannya.
          pelaku: (peta.get("0046") || {}).nilai || "",
          lawan: (peta.get("0047") || {}).nilai || "",
          modus: bacaModus(),
        });
        const hasil = isiJawaban.saksiSdg || {};
        if (hasil.ok === false) throw new Error(hasil.alasan === "templat_kosong" ? "Templat kosong." : "Keterangan tidak tersusun.");
        if (centangSdg.checked && !(hasil.alasan || []).length) {
          kabarForm.textContent =
            "Tidak satu pun alasan terbaca dari posita; jawaban tentang penyebab diambil apa adanya dari templat.";
        } else {
          kabarForm.textContent = "";
        }
        const pilihanTemplat = daftarTemplat.find((t) => t.nilai === kodeTemplat);
        wadahPratinjau.appendChild(
          gambarPratinjauSdg(hasil, urutan, pilihanTemplat ? pilihanTemplat.kode : kodeTemplat, urutan === String(urutanAwal) ? sudahAda : 0)
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
      gambarFormSdg(daftarTemplat, urutan, sudahAda);
      kabar.textContent = sudahAda
        ? `Sidang ke-${urutan} sudah memuat ${sudahAda} tanya-jawab saksi 1; menyimpan akan menimpanya.`
        : `Belum ada keterangan saksi tersimpan; akan disimpan pada sidang ke-${urutan}.`;
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
alatDaftarkanPenunjuk("Borang tanya-jawab", ["#tanyajawab", "table.tabel_tanyajawab", "form"], { wajib: false, saat: "halaman tanya-jawab" });

async function pasang() {
  if (sudahDipasang) return;
  const diTanyaJawab = halamanTanyaJawab();
  if (!halamanBlangko() && !diTanyaJawab) return;
  if (!(await sedangAktif())) return;

  // Di halaman tanya-jawab tidak ada satu pun tautan load_form, jadi jati diri
  // perkaranya tidak dapat dibaca dari sana. Ia tidak diperlukan di situ:
  // penyusun keterangan saksi menulis lewat rute tanya-jawab ABT, yang
  // alamatnya dibaca dari alamat halaman ini sendiri (lihat ruasAlamatAbt).
  const jatiDiri = jatiDiriPerkara() || (diTanyaJawab ? { perkaraId: "", perkTemp: "" } : null);
  if (!jatiDiri) return;

  sudahDipasang = true;
  await muatSaklarCetak();
  pasangSunting(jatiDiri);
  const panel = susunPanelAbt(jatiDiri);
  document.body.appendChild(panel);
  pasangPenjagaCetak(jatiDiri, panel.lapor);
}

// Halaman ABT tahu alamat portalnya sendiri - dan petugas yang seharian di
// sini tidak pernah membuka SIPP.
alatCatatAsalPortal();
void pasang();
void pasangMassalAbt();

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
 * Alurnya per perkara, berurutan, dengan jeda:
 *
 *   RTF     GET  abt/preview?a=&b=&c=<perkara_id>     - ABT mengisi blangko
 *   draf    POST /putusan/unggah-naskah                - ALETA memotong amar
 *   PDF     POST /aleta-bot/abt/pdf                    - bot (soffice)
 *   anonim  POST abt/main/anonim                       - ABT menyamarkan nama
 *   PDF²    POST /aleta-bot/abt/pdf                    - anonim menjadi PDF
 *   SIPP    POST /putusan/unggah-sipp   (bila diminta) - berkas + kolom dokumen
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
const BATAS_UNGGAH_MASSAL_MS = 60000;

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

let sudahDipasangMassalAbt = false;

async function pasangMassalAbt() {
  if (sudahDipasangMassalAbt) return;
  if (!halamanBerandaAbt()) return;
  if (!(await sedangAktif())) return;
  sudahDipasangMassalAbt = true;
  await muatPenggunaAleta();
  const panel = await susunPanelMassalAbt();
  document.body.appendChild(panel);
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
    saatTutup: () => panel.remove(),
  });

  const isi = buatElemen("div", "aleta-isi");
  panel.appendChild(isi);

  const peta = await alatMuatPetaBlangkoLengkap();
  const keadaan = { peta, sidang: [], tanggal: alatTanggalIso(new Date()), berhenti: false, sedangJalan: false };

  isi.appendChild(bagianPetaBlangkoAbt(keadaan));
  isi.appendChild(bagianMassalAbt(keadaan));

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
    "aleta-tetap-sebab",
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
      const label = ALAT_JENIS_LAZIM.find((x) => alatKunciJenis(x) === kunci) || (keadaan.peta[kunci] && keadaan.peta[kunci].jenisAsli) || kunci;
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

  // Pilihan pekerjaan - semuanya menyala kecuali unggah ke SIPP, yang
  // MENULIS ke berkas perkara sungguhan dan karena itu diminta secara sadar.
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
    pilihan.appendChild(l);
    return c;
  };
  const cDraf = saklar("Simpan draf ke ALETA", "draf", true, "Amar dan pertimbangan dipotong dari RTF, menjadi draf yang diisikan panel SIPP.");
  const cPdf = saklar("Buat PDF", "pdf", true, "Lewat bot ALETA (soffice). Di komputer tanpa soffice langkah ini gagal dan dicatat.");
  const cAnonim = saklar("Anonimisasi", "anonim", true, "ABT menyamarkan nama pihak; hasilnya RTF, lalu PDF.");
  const cUnggah = saklar("Unggah dokumen ke SIPP", "unggah", false, "PDF putusan dan anonimisasinya ditulis ke berkas perkara SIPP. Dinyalakan sendiri.");
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
  const petaUntuk = (s) => pilihanPer.get(s.nomor) || keadaan.peta[alatKunciJenis(s.jenis)];

  async function muat() {
    daftar.textContent = "";
    neraca.textContent = "";
    centangPer.clear();
    tombolJalan.disabled = true;
    kabar.className = "aleta-abt-kabar";
    kabar.textContent = `Membaca sidang ${keadaan.tanggal}…`;
    try {
      keadaan.sidang = await alatSidangPadaTanggal(keadaan.tanggal);
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
    const belumPutus = keadaan.sidang.filter((s) => !s.sudahPutus);
    kabar.textContent =
      `${keadaan.sidang.length} perkara bersidang; ${belumPutus.length} belum putus dan ditawarkan. ` +
      "Tidak ada yang tercentang sendiri.";
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
        });
        label.appendChild(pilih);
      }
      label.title = s.sudahPutus
        ? "Sudah ada putusan di SIPP - tidak ditawarkan, supaya tidak ganda."
        : alatBlangkoLengkap(peta)
          ? "Boleh dicentang."
          : "Petakan blangko untuk jenis ini dahulu di atas, atau perkara ini dilewati saat dijalankan.";
      daftar.appendChild(label);
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
            ? `${peta.berkas} → RTF${cDraf.checked ? " → draf" : ""}${cPdf.checked ? " → PDF" : ""}${cAnonim.checked ? " → anonim" : ""}${cUnggah.checked ? " → SIPP" : ""}`
            : `DILEWATI: blangko untuk "${s.jenis}" belum dipetakan`
        )
      );
      neraca.appendChild(baris);
      if (alatBlangkoLengkap(peta)) siap += 1;
    }
    tombolJalan.disabled = siap === 0;
    tombolJalan.title = siap ? `Mengerjakan ${siap} perkara berurutan.` : "Tidak ada yang dapat dikerjakan.";
  });

  tombolHenti.addEventListener("click", () => {
    keadaan.berhenti = true;
    tombolHenti.textContent = "Menghentikan sesudah perkara ini…";
  });

  tombolJalan.addEventListener("click", async () => {
    const dipilih = yangDicentang().filter((s) => alatBlangkoLengkap(petaUntuk(s)));
    if (dipilih.length === 0) return;
    keadaan.berhenti = false;
    keadaan.sedangJalan = true;
    tombolJalan.disabled = true;
    tombolRencana.disabled = true;
    tombolHenti.hidden = false;
    tombolHenti.textContent = "Hentikan";
    neraca.textContent = "";

    const antrean = alatBuatAntrean({
      tanggalSidang: keadaan.tanggal,
      tahap: "abt",
      kering: false,
      butir: dipilih.map((s) => ({ nomor: s.nomor, perkaraId: s.perkaraId, jenis: s.jenis })),
    });
    await alatSimpanAntrean(antrean);
    alatCatat("massal", `putusan massal ABT dimulai: ${dipilih.length} perkara, sidang ${keadaan.tanggal}`, "");

    const opsi = { draf: cDraf.checked, pdf: cPdf.checked, anonim: cAnonim.checked, unggah: cUnggah.checked };
    const olehUsername = namaPenggunaAbt();

    for (const butir of antrean.butir) {
      if (keadaan.berhenti) {
        butir.keadaan = "dilewati";
        butir.catatan = "dihentikan";
        continue;
      }
      butir.keadaan = "jalan";
      await alatSimpanAntrean(antrean);
      const baris = buatElemen("div", "aleta-perkakas-baris");
      baris.appendChild(buatElemen("span", "aleta-perkakas-nama", butir.nomor));
      const nilai = buatElemen("span", "aleta-perkakas-nilai", "mengambil RTF…");
      baris.appendChild(nilai);
      neraca.appendChild(baris);

      const peta = petaUntuk(butir);
      const hasil = await kerjakanSatuPerkaraAbt(butir, peta, opsi, olehUsername, (teks) => {
        nilai.textContent = teks;
      });
      butir.keadaan = hasil.ok ? "selesai" : "gagal";
      butir.catatan = hasil.ringkas;
      butir.dokumen = hasil.dokumen;
      baris.classList.add(hasil.ok ? "aleta-perkakas-baik" : "aleta-perkakas-buruk");
      nilai.textContent = hasil.ringkas;
      const tanda = centangPer.get(butir.nomor);
      if (tanda) tanda.tanda.textContent = hasil.ok ? "selesai" : "gagal";
      await alatSimpanAntrean(antrean);
      await alatJeda(ALAT_JEDA_MASSAL_MS);
    }

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
          "Lanjutkan ke SIPP: isian putusan (amar, pertimbangan, status) diisikan ke borang tiap perkara. " +
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
        window.open(`${location.origin}/index.php/dashboard`, "_blank");
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
    tombolHenti.hidden = true;
    tombolRencana.disabled = false;
  });

  keadaan.muatDaftar = muat;
  void muat();
  return kotak;
}

/**
 * Satu perkara, enam langkah, tiap langkah dicatat sendiri.
 *
 * Pulang dengan ringkasan yang menyebut apa yang jadi dan apa yang tidak -
 * "RTF ok · draf v3 · PDF ok · anonim gagal: ABT menjawab 500" - bukan
 * sekadar berhasil/gagal.
 */
async function kerjakanSatuPerkaraAbt(butir, peta, opsi, olehUsername, lapor) {
  const dokumen = { rtf: "", draf: "", pdf: "", anonim: "", anonimPdf: "", unggah: "" };
  const ringkas = [];
  const namaDasar = String(butir.nomor || "putusan").replace(/[\\/:*?"<>|]+/g, "_");

  // 1. RTF dari ABT
  let isiRtf = null;
  try {
    const alamat = alatAlamatPreviewAbt(asalAbt(), peta, butir.perkaraId);
    if (!alamat) throw new Error("blangko belum dipetakan");
    lapor("mengambil RTF dari ABT…");
    const respons = await fetch(alamat, { credentials: "include", cache: "no-store" });
    if (!respons.ok) throw new Error(`ABT menjawab ${respons.status}`);
    isiRtf = await respons.arrayBuffer();
    const awal = new TextDecoder("latin1").decode(new Uint8Array(isiRtf).subarray(0, 5));
    if (!awal.startsWith("{\\rtf")) {
      throw new Error("ABT tidak mengembalikan RTF - token blangko tidak sah atau sesi ABT habis");
    }
    dokumen.rtf = "ok";
    ringkas.push("RTF ok");
    alatCatat("massal", `${butir.nomor}: RTF ${isiRtf.byteLength} bita`, "");
  } catch (galat) {
    dokumen.rtf = `gagal: ${String((galat && galat.message) || galat)}`;
    ringkas.push(dokumen.rtf.replace("gagal", "RTF gagal"));
    alatCatat("massal-galat", `${butir.nomor}: ${dokumen.rtf}`, "");
    return { ok: false, ringkas: ringkas.join(" · "), dokumen };
  }

  // 2. Draf ke ALETA
  if (opsi.draf) {
    try {
      lapor("menyimpan draf ke ALETA…");
      const badan = new FormData();
      badan.append("berkas", new Blob([isiRtf], { type: "application/rtf" }), `${namaDasar}.rtf`);
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

  // 3. PDF putusan
  let pdfPutusan = null;
  if (opsi.pdf) {
    try {
      lapor("mengubah menjadi PDF…");
      pdfPutusan = await ubahKePdf(isiRtf);
      dokumen.pdf = "ok";
      ringkas.push("PDF ok");
    } catch (galat) {
      dokumen.pdf = `gagal: ${String((galat && galat.message) || galat)}`;
      ringkas.push(`PDF ${dokumen.pdf}`);
      alatCatat("massal-galat", `${butir.nomor}: PDF ${dokumen.pdf}`, "");
    }
  }

  // 4. Anonimisasi lewat ABT, 5. PDF-nya
  let pdfAnonim = null;
  if (opsi.anonim) {
    try {
      lapor("meminta ABT menganonimkan…");
      const borang = new FormData();
      borang.set("perkara_id", butir.perkaraId);
      borang.set("perkara_no", butir.nomor);
      borang.set("file_putusan", new Blob([isiRtf], { type: "application/rtf" }), `${namaDasar}.rtf`);
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
      dokumen.anonim = "ok";
      ringkas.push("anonim ok");
      if (opsi.pdf) {
        lapor("mengubah anonim menjadi PDF…");
        pdfAnonim = await ubahKePdf(isi);
        dokumen.anonimPdf = "ok";
      }
    } catch (galat) {
      const pesan = String((galat && galat.message) || galat);
      if (!dokumen.anonim) {
        dokumen.anonim = `gagal: ${pesan}`;
        ringkas.push(`anonim gagal: ${pesan}`);
      } else {
        dokumen.anonimPdf = `gagal: ${pesan}`;
        ringkas.push(`PDF anonim gagal: ${pesan}`);
      }
      alatCatat("massal-galat", `${butir.nomor}: anonim ${pesan}`, "");
    }
  }

  // 6. Unggah ke SIPP - hanya bila diminta, dan hanya bila ada yang diunggah
  if (opsi.unggah) {
    if (!pdfPutusan && !pdfAnonim) {
      dokumen.unggah = "dilewati: tidak ada PDF";
      ringkas.push("SIPP dilewati (tidak ada PDF)");
    } else {
      try {
        lapor("mengunggah ke SIPP…");
        const badan = new FormData();
        badan.append("perkaraId", butir.perkaraId);
        badan.append("nomorPerkara", butir.nomor);
        badan.append("olehUsername", olehUsername || "");
        if (pdfPutusan) badan.append("putusan", pdfPutusan, `${namaDasar}.pdf`);
        if (pdfAnonim) badan.append("anonimisasi", pdfAnonim, `${namaDasar} - anonim.pdf`);
        const respons = await alatAmbil(
          ALETA_API_UNGGAH_SIPP_ABT,
          { method: "POST", body: badan, credentials: "include", batasMs: BATAS_UNGGAH_MASSAL_MS },
          "Mengunggah putusan ke SIPP"
        );
        if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Mengunggah putusan ke SIPP"));
        const luar = await respons.json();
        const jawab = luar && luar.data ? luar.data : luar;
        if (!jawab || !jawab.ok) throw new Error((jawab && (jawab.sebab || jawab.pesan || jawab.alasan)) || "ditolak");
        dokumen.unggah = "ok";
        ringkas.push("SIPP ok");
        alatCatatTindakan({ jenis: "unggah-sipp", penunjuk: butir.nomor, label: `unggah dokumen ${butir.nomor}`, nilaiBaru: "(diunggah)", dapatPulih: false });
      } catch (galat) {
        dokumen.unggah = `gagal: ${String((galat && galat.message) || galat)}`;
        ringkas.push(`SIPP ${dokumen.unggah}`);
        alatCatat("massal-galat", `${butir.nomor}: unggah ${dokumen.unggah}`, "");
      }
    }
  }

  const ok = dokumen.rtf === "ok" && !/gagal/.test(ringkas.join(" "));
  return { ok, ringkas: ringkas.join(" · "), dokumen };
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
