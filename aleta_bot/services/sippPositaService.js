"use strict";

/**
 * ============================================================================
 * MERAPIKAN POSITA DI SIPP - SATU-SATUNYA CARA ABT IKUT BERUBAH
 * ============================================================================
 *
 * Variabel 5125 "POSITA LENGKAP" di ABT bertipe data_sipp. Dibaca dari
 * definisi variabelnya di basis data aps_badilag:
 *
 *   no_var 5125   data_type = data_sipp   data_tabel = perkara   data_kolom = posita
 *
 * dan dari Abt_model::get_data_variabel, yang untuk data_sipp menjalankan
 * "select {kolom} as data from {tabel} where perkara_id = ? limit 1" terhadap
 * koneksi dbsipp. ABT TIDAK menyimpan salinannya. Rute edit_data miliknya
 * hanya menerima data_teks dan data_tanggal - itu sebabnya ia menjawab
 * "bertipe data_sipp - tidak dapat disunting", dan penolakan itu benar: tidak
 * ada tempat di ABT untuk menyimpannya.
 *
 * Maka satu-satunya cara membuat perapian posita muncul di ABT adalah
 * merapikannya di SIPP. Itu yang dikerjakan di sini.
 *
 * ============================================================================
 * MENULIS KE SIPP - DAN PAGAR YANG MEMBATASINYA
 * ============================================================================
 *
 * SIPP milik pihak ketiga, dan ALETA membacanya. Jalur tulis yang ada
 * sebelumnya - Data Umum pada penetapan - dipagari aturan keras: hanya ruas
 * yang MASIH KOSONG yang diisi, tidak satu pun yang sudah terisi ditimpa.
 *
 * Yang di sini berbeda sifatnya: posita SUDAH terisi, dan justru isinya yang
 * dirapikan. Aturan "hanya yang kosong" tidak dapat dipakai. Karena itu
 * pagarnya diganti dengan pagar yang lebih kuat, dan yang dapat dibuktikan:
 *
 *   ISINYA TIDAK BOLEH BERUBAH SATU HURUF PUN.
 *
 * Perapiannya memang begitu - ia hanya MENYISIPKAN PEMISAH antara butir yang
 * menempel, tidak mengubah satu kata dan tidak menomori ulang. Karena itu
 * dapat diperiksa secara mutlak: buang seluruh ruang kosong dari kedua teks,
 * lalu bandingkan. Bila berbeda walau satu huruf, tulisannya DITOLAK.
 *
 * Pagar itu menutup seluruh kekhawatiran yang pantas ada pada tulisan ke
 * posita: dalil gugatan tidak dapat ditambah, tidak dapat dikurangi, tidak
 * dapat diubah maknanya. Yang berubah hanya di mana barisnya patah.
 *
 * Pagar lainnya:
 *
 *   - perkara_id harus angka, dan dikirim sebagai parameter terikat
 *   - posita lama dikembalikan kepada pemanggil, sehingga ekstensi dapat
 *     menyimpannya di riwayat perubahan sebelum menimpanya
 *   - tepat satu baris yang boleh tersentuh; bila UPDATE menyentuh lebih
 *     dari satu, itu keadaan yang tidak dimengerti dan disebut apa adanya
 *   - uji kering, supaya pratinjaunya memperlihatkan yang BENAR-BENAR akan
 *     ditulis, bukan tebakan sisi peramban
 */

const penjagaTandaSipp = require("./penjagaTandaSipp");
const db = require("../db_config");

/** Posita terpanjang di PA Donggala belasan ribu huruf; ini jauh di atasnya. */
const BATAS_HURUF = 200000;

function runQuery(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (error, hasil) => {
      if (error) reject(error);
      else resolve(hasil);
    });
  });
}

/**
 * Membuang ruang kosong DAN pemisah yang boleh disisipkan perapian.
 *
 * Perapian hanya menambahkan dua hal: ruang kosong dan tag <br>. Perbandingan
 * pada bentuk yang membuang keduanya karena itu membuktikan tidak satu huruf
 * pun kata gugatan yang ditambah, dikurangi, atau diubah.
 *
 * <br> ikut dibuang sejak perapian berhenti memakai ganti baris - lihat
 * catatan panjang di rapikanTeksPosita tentang kenapa ganti baris tidak
 * pernah sampai ke dokumen cetak.
 */
function tanpaRuang(teks) {
  return String(teks || "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<\/?div[^>]*>/gi, "")
    // <p> ikut dibuang sejak perapian memakainya sebagai pemisah butir - lihat
    // paragrafkanButir. Tanpa baris ini pagar isinya menolak perapiannya
    // sendiri: teks yang semula tanpa tag menjadi bertag, dan perbandingannya
    // berselisih walau tidak satu huruf gugatan pun berubah.
    .replace(/<\/?p[^>]*>/gi, "")
    .replace(/[\s ]+/g, "");
}

/**
 * ============================================================================
 * MEMPERBAIKI PECAHAN PALSU YANG SUDAH TERLANJUR TERSIMPAN
 * ============================================================================
 *
 * Versi perapian sebelumnya memecah kata yang berakhir huruf lalu titik, dan
 * pecahannya SUDAH tertulis ke SIPP - ia bukan lagi cacat aturan, melainkan
 * cacat data. Terbaca apa adanya pada posita 510/Pdt.G/2026/PA.Dgl hari ini:
 *
 *   "...pisah rumah selama kurang lebih 6 bula\n   n. Sejak saat itu..."
 *   "...Mikhayla Syahirah binti Dandi, Usia 5 tahu\n   n. Saat ini anak..."
 *
 * "bulan" dan "tahun" terpotong, dan huruf terakhirnya berdiri sebagai butir
 * baru. Pagar isi tidak menahannya - dan memang tidak seharusnya: tidak ada
 * huruf yang hilang, hanya berpindah baris.
 *
 * ============================================================================
 * YANG DIPERBAIKI HANYA YANG PASTI SALAH
 * ============================================================================
 *
 * Sesudah terpecah, penanda butir yang SUNGGUHAN dan pecahan yang PALSU tampak
 * persis sama - keduanya "ganti baris, tiga spasi, satu huruf kecil, titik,
 * spasi, huruf besar":
 *
 *   "...disebabkan karena\n   a. Tergugat sering..."   SUNGGUHAN
 *   "...kurang lebih 6 bula\n   n. Sejak saat itu..."  PALSU
 *
 * Tidak ada cara membedakannya dari bentuknya saja; yang membedakan hanya
 * apakah "karena" dan "bula" itu kata utuh - dan itu menuntut kamus.
 *
 * Yang dipakai di sini pembeda yang tidak menuntut kamus dan tidak pernah
 * salah ke arah yang merusak: HURUFNYA. Penanda butir dalam gugatan tidak
 * pernah melewati f - a, b, c, kadang d. Huruf g sampai z yang berdiri
 * sebagai butir hampir pasti pecahan kata: n dari "bulan" dan "tahun", h dari
 * "rumah", i dari "isteri", t dari "empat".
 *
 * Maka g-z disambung kembali, a-f DIBIARKAN. Membiarkan berarti mungkin ada
 * satu pecahan yang tidak terperbaiki - kekurangan yang disebutkan, dan yang
 * dapat diperbaiki tangan. Menyambung yang a-f berarti merusak daftar butir
 * yang benar - kerusakan yang tidak terlihat sampai putusannya terbaca orang.
 *
 * Berapa yang disambung dikembalikan kepada pemanggil, supaya panel dapat
 * menyebutnya dan petugas tahu positanya baru saja diperbaiki - bukan sekadar
 * dirapikan.
 */

/** Penanda butir yang wajar dalam gugatan. Di luar ini dianggap pecahan kata. */
const HURUF_BUTIR_WAJAR = "a-f";

function perbaikiPecahanPalsu(teks) {
  let jumlah = 0;
  const hasil = String(teks || "").replace(
    new RegExp(
      `([a-z])(?:<br\\s*\\/?>|\\n)[ \\t]*([^${HURUF_BUTIR_WAJAR}a-z]*)([g-z])\\.[ \\t]+(?=[A-Z])`,
      "g"
    ),
    (cocok, sebelum, antara, huruf) => {
      // `antara` harus kosong: bila ada tanda baca di antaranya, yang berdiri
      // di sana memang penanda tersendiri, bukan pecahan kata.
      if (antara) return cocok;
      jumlah += 1;
      return `${sebelum}${huruf}. `;
    }
  );
  return { teks: hasil, jumlah };
}

/**
 * ============================================================================
 * MEMERIKSA KEADAAN SATU POSITA - TANPA MENGUBAH APA PUN
 * ============================================================================
 *
 * Tiga keadaan yang berbeda sebabnya, berbeda cara memperbaikinya, dan
 * berbeda pula siapa yang boleh memutuskannya:
 *
 *   pecahanPasti    kata terpecah pada huruf g-z. Penanda butir dalam gugatan
 *                   tidak pernah melewati f, jadi huruf ini hampir pasti
 *                   pecahan kata: n dari "bulan" dan "tahun", h dari "rumah".
 *                   Disambung sendiri oleh perapian.
 *
 *   pecahanRagu     bentuk yang SAMA, tetapi hurufnya a-f. Tidak dapat
 *                   dibedakan dari penanda butir yang sungguhan tanpa kamus -
 *                   "karena" + "a" dan "terlaksan" + "a" tampak identik.
 *                   TIDAK disentuh; dikembalikan beserta konteksnya supaya
 *                   manusia yang memutuskan.
 *
 *   tanpaPemisah    tidak ada </p>, tidak ada <br>, dan ada butir yang
 *                   menempel. Ia akan tercetak sebagai satu gumpalan di
 *                   dokumen Word - bukan kerusakan buatan siapa pun,
 *                   melainkan cara positanya diketik sejak awal.
 *
 * Fungsi ini MURNI: masuk teks, keluar keterangan. Ia tidak menyentuh basis
 * data, dan tidak dipakai memutuskan apa pun sendiri - ia yang dipakai skrip
 * pemindai untuk melaporkan, dan panel untuk menanyakan.
 */

/** Panjang konteks di kiri dan kanan temuan, supaya cukup dinilai manusia. */
const LEBAR_KONTEKS = 45;

function konteksSekitar(teks, indeks, panjang) {
  const awal = Math.max(0, indeks - LEBAR_KONTEKS);
  const akhir = Math.min(teks.length, indeks + panjang + LEBAR_KONTEKS);
  return (awal > 0 ? "…" : "") + teks.slice(awal, akhir).replace(/\s+/g, " ") + (akhir < teks.length ? "…" : "");
}

/**
 * Mencari bentuk "kata, pemisah, satu huruf, titik, huruf besar".
 *
 * Satu lintasan untuk kedua golongan - pasti dan ragu - sebab keduanya
 * bentuknya persis sama dan hanya hurufnya yang membedakan. Dua lintasan
 * dengan dua pola yang hampir sama adalah dua pola yang akan berselisih.
 */
function cariPecahan(teks) {
  const pola = /([a-z])(?:<br\s*\/?>|\n)[ \t]*([a-z])\.[ \t]+(?=[A-Z])/g;
  const pasti = [];
  const ragu = [];

  let cocok;
  while ((cocok = pola.exec(teks)) !== null) {
    const huruf = cocok[2];
    const temuan = {
      huruf,
      // Kata yang akan terbentuk bila disambung - itu yang dinilai manusia:
      // "bulan" masuk akal, "karenaa" tidak.
      sambungan: `${teks.slice(Math.max(0, cocok.index - 14), cocok.index + 1)}${huruf}`.trim(),
      konteks: konteksSekitar(teks, cocok.index, cocok[0].length),
    };
    if (huruf >= "g") pasti.push(temuan);
    else ragu.push(temuan);
    // exec dengan lookahead tidak memajukan lastIndex melewati huruf besarnya,
    // jadi pencocokan berikutnya tetap dimulai sesudah temuan ini.
  }

  return { pasti, ragu };
}

/** Benar bila positanya akan tercetak menempel: tidak ada pemisah sama sekali. */
function tanpaPemisah(teks) {
  const isi = String(teks || "");
  if (/<\/p>|<br\s*\/?>|<\/?div[^>]*>/i.test(isi)) return false;
  // Ada butir yang menempel? "…2017.2. Bahwa" atau "…karena a. Tergugat".
  return /[.;:,)][ \t]*\d{1,2}\.[ \t]+[A-Z]/.test(isi) || /[ \t][a-z]\.[ \t]+[A-Z]/.test(isi);
}

/**
 * Keterangan lengkap satu posita.
 *
 * @param {string} teks isi kolom posita apa adanya
 */
function periksaPosita(teks) {
  const isi = String(teks || "");
  const { pasti, ragu } = cariPecahan(isi);
  return {
    kosong: !isi.trim(),
    huruf: isi.length,
    pecahanPasti: pasti,
    pecahanRagu: ragu,
    tanpaPemisah: tanpaPemisah(isi),
    // Benar bila perapian akan mengubah sesuatu - dipakai pemindai untuk
    // memisahkan "perlu dirapikan" dari "sudah rapi".
    perluDirapikan: pasti.length > 0 || tanpaPemisah(isi),
  };
}

/**
 * ============================================================================
 * PEMISAHNYA <br>, BUKAN GANTI BARIS - SEBAB RTF TIDAK MENGENAL GANTI BARIS
 * ============================================================================
 *
 * Bentuk pertamanya menyisipkan ganti baris. Positanya lalu tampak rapi di
 * layar ABT dan di SIPP - dan tercetak MENEMPEL persis seperti semula di
 * dokumen Word. Ganti baris tidak pernah sampai ke sana.
 *
 * Sebabnya terbaca dari kode ABT. views/abt/preview.php mengambil berkas
 * blangko RTF lalu menyerahkannya ke variabel_library, yang menjalankan
 * TemplateHelper::cleanHtmlTagSpecial atas tiap nilai variabel. Fungsi itu
 * menerjemahkan:
 *
 *   </p>       ->  \par
 *   <br>       ->  \par
 *   "   "      ->  \tab       (tiga spasi - itu yang dimaksud petunjuk hijau
 *                              di borang ABT, "SPASI 3x berubah menjadi TAB")
 *
 * dan TIDAK menerjemahkan ganti baris sama sekali. Di dalam RTF, ganti baris
 * mentah hanyalah spasi - ia diabaikan. Itu sebabnya positanya tetap menempel.
 *
 * ============================================================================
 * DIUKUR: BEGITULAH MEMANG SIPP MENYIMPANNYA
 * ============================================================================
 *
 * Bukan pilihan yang dikarang. Dari 8.097 posita yang terisi di PA Donggala:
 *
 *   6.269  memuat </p>      - inilah yang tercetak rapi selama ini
 *     517  memuat <br>
 *   8.089  memuat ganti baris, yang tidak berarti apa-apa bagi RTF
 *
 * Perkara 510/Pdt.G/2026/PA.Dgl - yang dilaporkan menempel - tidak memuat
 * satu pun tag: tidak </p>, tidak <br>. Karena itu ia tercetak sebagai satu
 * gumpalan sementara ribuan perkara lain tidak.
 *
 * Maka pemisah yang dipakai di sini <br>: bentuk yang sudah dimengerti ABT,
 * sudah dipakai ratusan posita, dan sudah dirender SIPP sebagai ganti baris di
 * layarnya sendiri.
 *
 * ============================================================================
 * "USIA 5 TAHUN. SAAT INI" - PEMECAHAN PALSU YANG LOLOS DARI PAGAR
 * ============================================================================
 *
 * Pola anak butir yang lama menerima huruf kecil apa pun sebelum titik,
 * termasuk huruf TERAKHIR SEBUAH KATA:
 *
 *   "...Usia 5 tahun. Saat ini anak tersebut..."
 *              ^^^^^^ "n." dibaca sebagai penanda anak butir
 *
 * dan memecahnya menjadi "tahu" lalu butir baru "n. Saat ini". Itu terlihat
 * di dokumen Word yang dilaporkan.
 *
 * Pagar isi TIDAK menangkapnya - dan tidak seharusnya: tidak ada huruf yang
 * hilang, hanya berpindah baris. Yang salah aturannya, bukan penjaganya.
 *
 * Sekarang penanda anak butir harus berdiri sendiri: didahului TANDA BACA atau
 * SPASI, tidak boleh didahului huruf. "tahun." karena itu tidak lagi terpecah,
 * sementara "Tergugat.b." dan "karena a." tetap terpecah.
 *
 * Aturan yang sama dipasang pada butir induk, dan sebabnya sama: "berjumlah
 * 15. Bahwa" jangan sampai terpecah menjadi "1" dan butir "5.".
 */

/** Tanda baca yang boleh mendahului penanda butir. */
const SEBELUM_BUTIR = ".;:,)";

/**
 * ============================================================================
 * <p> PER BUTIR - SEBAB <br> TIDAK PERNAH SAMPAI KE DOKUMEN CETAK SIPP
 * ============================================================================
 *
 * Dibaca dari sumber SIPP di mesin ini, bukan disimpulkan dari tampilannya:
 *
 *   application/views/generate_template/cetak_putusan_agama.php baris 440
 *     #petitum# -> $this->templatehelper->cleanHtmlTagSpecial($petitum)
 *
 *   application/libraries/TemplateHelper.php, cleanHtmlTagSpecial:
 *     "  "      -> " "                                  (dua spasi jadi satu)
 *     "</li>"   -> "</li> \par "
 *     "<li>"    -> "<li> \tab "
 *     "</p>"    -> "\par"
 *     "<p>1."   -> "\pard \qj \li630 \linestarts 1. "
 *     lalu filter_var(FILTER_SANITIZE_STRING) MENYAPU seluruh tag yang tersisa
 *
 * Tiga akibatnya, dan ketiganya terbaca pada dokumen yang dilaporkan:
 *
 *   1. <br> TIDAK ada dalam daftar itu. Ia hanya disapu - tanpa meninggalkan
 *      satu pun pemisah. Posita yang dirapikan dengan <br> karena itu tetap
 *      tercetak menggumpal di putusan yang dicetak SIPP.
 *   2. Lekukan tiga spasi tidak menjadi \tab di sini (aturan itu milik ABT).
 *      Dua spasinya malah runtuh menjadi satu, sehingga anak butir hanya
 *      bergeser satu huruf - persis yang terlihat pada "a. Tergugat".
 *   3. Butir pertama yang berbentuk PERSIS "<p>1." menyalakan \li630 - lekukan
 *      seluruh blok, 630 twip. Sifat paragraf RTF bertahan melewati \par,
 *      jadi satu pemicu di awal melekukkan seluruh daftar positanya. Itulah
 *      sebabnya 6.269 posita yang memakai <p> tercetak rapi selama ini, dan
 *      yang memakai <br> tidak.
 *
 * Maka pemisahnya sekarang <p>...</p>:
 *
 *   - SIPP  : </p> -> \par, dan "<p>1." menyalakan lekukan seluruh blok
 *   - ABT   : </p> -> \par juga (lihat catatan di kepala berkas ini)
 *
 * <br> hanya dimengerti salah satunya; <p> dimengerti keduanya.
 *
 * Anak butir diberi tiga spasi tambahan. Di ABT tiga spasi menjadi \tab,
 * sehingga ia menggantung di bawah induknya. Di SIPP spasi itu runtuh, tetapi
 * \li630 sudah melekukkan seluruh blok - anak butirnya tetap terbaca sebagai
 * anak sebab penanda hurufnya, bukan sebab lekukannya.
 *
 * TIDAK dipakai <li>, walau ia satu-satunya yang menghasilkan \tab di SIPP:
 * ABT tidak menerjemahkannya, dan di sana ia akan disapu tanpa meninggalkan
 * \par - anak butirnya menempel ke butir berikutnya. Menukar cacat di satu
 * mesin dengan cacat di mesin lain bukan perbaikan.
 */

/**
 * ============================================================================
 * ANGKA BUTIR YANG DITELAN RTF - "2. Bahwa" TERCETAK ". Bahwa"
 * ============================================================================
 *
 * Terbaca dari TemplateHelper::cleanHtmlTagSpecial milik ABT sendiri:
 *
 *   baris 18   str_replace("</p>", "\par", $text)        <- TANPA spasi
 *   baris 19   str_replace(" <p",  "<p",    $text)        <- spasi DIBUANG
 *   baris 42   filter_var($text, FILTER_SANITIZE_STRING)  <- <p> disapu
 *
 * Maka `</p><p>2. Bahwa` menjadi `\par2. Bahwa`.
 *
 * Di dalam RTF, kata kendali menyerap parameter angka yang menempel padanya:
 * `\par2` BUKAN `\par` diikuti "2", melainkan kata kendali `\par`
 * berparameter 2 - dan angkanya lenyap. Yang tercetak ". Bahwa".
 *
 * Lebih parah pada paragraf yang berawalan huruf: `\parKedua anak tersebut`
 * dibaca sebagai kata kendali bernama `parKedua` - tidak dikenal, jadi
 * SELURUH katanya dibuang, dan paragrafnya menempel ke paragraf sebelumnya.
 * Itulah "Usia 20 tahunanak tersebut" pada putusan 521/Pdt.G/2026/PA.Dgl.
 *
 * Butir PERTAMA selamat, sebab tidak ada `\par` di depannya - dan itulah yang
 * membuat cacat ini sulit terlihat: nomor 1 selalu benar.
 *
 * <br> TIDAK bermasalah: baris 26 menerjemahkannya menjadi "\par " dengan
 * spasi di belakangnya. Hanya `</p>` yang tidak.
 *
 * Obatnya satu ganti baris di antara `</p>` dan `<p>` berikutnya. Ganti baris
 * adalah pembatas kata kendali yang sah di RTF, dan baris 19 hanya membuang
 * SPASI sebelum `<p>` - bukan ganti baris. Tidak satu huruf pun isi posita
 * berubah; yang ditambahkan hanya pembatas di antara tagnya.
 */
function pisahkanParagrafRtf(html) {
  return String(html || "")
    .replace(/<\/p>[ \t]*(?=<p[ >])/gi, "</p>\n")
    // Paragraf hampa menjadi \par ganda - itulah jarak yang tidak rata di
    // atas dan di bawah butir pada dokumen cetak.
    .replace(/<p[^>]*>(?:\s|&nbsp;|&#160;)*<\/p>/gi, "");
}

/**
 * Penanda butir di awal paragraf.
 *
 * Empat bentuk, dan tiga di antaranya selama ini tidak dikenali sama sekali:
 *
 *   1.     butir induk                  dikenali
 *   b.     anak butir                   dikenali
 *   1.1    butir bertingkat             TIDAK dikenali - dan karena itu tidak
 *          pernah dilekukkan maupun dipecah menjadi paragraf sendiri
 *   a)     anak butir berkurung         TIDAK dikenali
 *   1)     butir induk berkurung        TIDAK dikenali
 *
 * Ketiganya dipakai di dalam gugatan yang disusun advokat, dan posita yang
 * memakainya tercetak sebagai satu gumpalan.
 */
// Bentuk bertingkat ditulis orang TANPA titik di belakangnya - "1.1 Bahwa",
// bukan "1.1. Bahwa" - jadi tandanya pilihan, bukan keharusan.
const POLA_PENANDA = /^(\d{1,2}(?:\.\d{1,2})+[.)]?|(?:\d{1,2}|[a-z])[.)])[ \t]+(?=[A-Z])/;

function paragrafkanButir(teks) {
  const isi = String(teks || "");
  if (!isi.trim()) return isi;

  // Sudah berparagraf? Jangan disusun ulang - yang dikerjakan hanya
  // memastikan butir pertamanya berbentuk "<p>1." supaya \li630 menyala.
  // Menyusun ulang HTML yang sudah rapi berarti mempertaruhkan 6.269 posita
  // yang selama ini tercetak benar demi satu yang tidak.
  if (/<p[ >]/i.test(isi)) {
    return pisahkanParagrafRtf(
      isi.replace(/^<p[^>]*>[ \t]*(?=\d{1,2}\.[ \t])/i, "<p>")
    );
  }

  const potongan = isi
    .split(/<br\s*\/?>/gi)
    .map((satu) => satu.trim())
    .filter(Boolean);
  if (potongan.length === 0) return isi;

  return pisahkanParagrafRtf(
    potongan
      .map((satu) => {
        const penanda = POLA_PENANDA.exec(satu);
        // Anak butir digeser satu lekukan. Yang terhitung anak: penanda huruf
        // ("b.", "a)") DAN penanda bertingkat ("1.1", "2.3") - keduanya
        // bergantung pada butir di atasnya, dan keduanya harus menggantung.
        // Anak butir: penanda huruf ("b.", "a)") ATAU bertingkat ("1.1").
        // Butir induk "1." memuat titik juga, jadi yang dihitung bukan adanya
        // titik melainkan adanya ANGKA KEDUA sesudahnya.
        const anak =
          Boolean(penanda) && (/^[a-z]/.test(penanda[1]) || /^\d+\.\d/.test(penanda[1]));
        return `<p>${anak ? "   " : ""}${satu}</p>`;
      })
      .join("")
  );
}

function rapikanTeksPosita(teks) {
  let hasil = String(teks || "").replace(/\r\n/g, "\n");

  // Pecahan palsu yang SUDAH tersimpan disambung lebih dulu - lihat
  // perbaikiPecahanPalsu. Dikerjakan sebelum apa pun, supaya kata yang
  // tersambung kembali ikut dinilai aturan butir seperti kata utuh lainnya.
  hasil = perbaikiPecahanPalsu(hasil).teks;

  // Sudah berupa HTML? Jangan sentuh ganti barisnya - ABT sudah mencetaknya
  // rapi lewat </p>, dan menambahkan <br> di sela-selanya menghasilkan baris
  // kosong berganda di dokumen.
  // ==========================================================================
  // <div> DIBUANG ABT TANPA MENINGGALKAN JEJAK - JADI IA DIUBAH LEBIH DULU
  // ==========================================================================
  //
  // cleanHtmlTagSpecial menerjemahkan </p> dan <br> menjadi \par, lalu
  // memanggil filter_var(..., FILTER_SANITIZE_STRING) yang MENYAPU seluruh
  // tag yang tersisa. <div> tidak pernah diterjemahkan - ia hanya lenyap,
  // tanpa meninggalkan satu pun pemisah.
  //
  // Posita 510/Pdt.G/2026/PA.Dgl memakai <div>. Itulah sebabnya ia tercetak
  // menempel walau di layar SIPP tampak berbaris-baris: SIPP menggambar
  // <div> sebagai blok, ABT membuangnya.
  hasil = hasil.replace(/<\/div>\s*<div[^>]*>/gi, "<br>");
  hasil = hasil.replace(/<\/?div[^>]*>/gi, "<br>");


  // Butir induk: "2017.2. Bahwa" -> "2017.<br>2. Bahwa"
  // Harus didahului tanda baca. Tanpa syarat itu, "berjumlah 15. Bahwa"
  // terpecah menjadi "1" dan butir baru "5.".
  // Bentuk bertingkat "1.1" ikut dikenali, dan ditulis kembali apa adanya -
  // bukan diubah menjadi "1." yang membuang tingkatannya.
  hasil = hasil.replace(
    new RegExp(
      `([${SEBELUM_BUTIR}])[ \\t]*(\\d{1,2}(?:\\.\\d{1,2})+[.)]?|\\d{1,2}[.)])[ \\t]+(?=[A-Z])`,
      "g"
    ),
    (cocok, sebelum, penanda) => {
      // Penandanya ditulis kembali APA ADANYA - "1.1" tetap "1.1", "2)" tetap
      // "2)". Menyeragamkannya menjadi "1." membuang tingkatan yang justru
      // ditulis penyusun gugatan dengan sengaja.
      const anak = /^\d+\.\d/.test(penanda);
      return `${sebelum}<br>${anak ? "   " : ""}${penanda} `;
    }
  );

  // Anak butir: "Tergugat.b. Setiap" atau "karena a. Tergugat".
  //
  // Satu lintasan untuk kedua bentuknya - kalau dipisah menjadi dua penggantian
  // berurutan, yang kedua akan mengenai spasi yang baru saja ditulis yang
  // pertama dan menghasilkan dua <br> berturut-turut.
  hasil = hasil.replace(
    new RegExp(`([${SEBELUM_BUTIR}]|[ \\t])[ \\t]*([a-z][.)])[ \\t]+(?=[A-Z])`, "g"),
    (cocok, sebelum, huruf) => {
      // Spasi yang mendahului tidak dituliskan kembali - ia digantikan
      // pemisahnya. Tanda baca dituliskan kembali; ia bagian dari kalimatnya.
      const awal = sebelum === " " || sebelum === "\t" ? "" : sebelum;
      // Tiga spasi, bukan satu: cleanHtmlTagSpecial menerjemahkannya menjadi
      // \tab, sehingga anak butirnya menggantung di bawah induknya.
      // "a)" tetap "a)" - menuliskannya kembali sebagai "a." mengubah bentuk
      // penomoran yang dipilih penyusun gugatan.
      return `${awal}<br>   ${huruf} `;
    }
  );

  // Ganti baris yang tersisa dijadikan pemisah sungguhan. Tanpa langkah ini,
  // posita yang di layar SIPP sudah tampak berbaris-baris tetap tercetak
  // sebagai satu gumpalan - ganti baris tidak berarti apa-apa bagi RTF.
  hasil = hasil.replace(/\n+/g, "<br>");

  // <br> berganda menjadi paragraf hampa di dokumen cetak, dan paragraf hampa
  // di tengah dalil gugatan terlihat seperti ada butir yang terhapus.
  // Hanya <br> BERLEBIH yang dibuang, bukan spasi sesudahnya: `\s*` di ujung
  // pola ikut menelan tiga spasi lekukan anak butir, dan anak butirnya lalu
  // rata dengan induknya di dokumen cetak.
  hasil = hasil.replace(/(<br\s*\/?>)(?:\s*<br\s*\/?>)+/gi, "$1");

  // ==========================================================================
  // <br> YANG BERSEBELAHAN DENGAN <p> DIBUANG - KEDUANYA MENJADI \par
  // ==========================================================================
  //
  // 6.269 dari 8.097 posita di PA Donggala memakai <p>. Pada teks itu, tiap
  // ganti baris di antara </p> dan <p> berikutnya baru saja menjadi <br> -
  // dan cleanHtmlTagSpecial menerjemahkan KEDUANYA menjadi \par. Hasilnya
  // satu baris kosong di antara tiap butir, sepanjang seluruh posita.
  hasil = hasil.replace(/<\/p>\s*<br\s*\/?>/gi, "</p>");
  hasil = hasil.replace(/<br\s*\/?>\s*(<p[^>]*>)/gi, "$1");

  // Pemisah di ujung tidak memisahkan apa pun.
  hasil = hasil.replace(/^(?:\s|<br\s*\/?>)+/i, "").replace(/(?:\s|<br\s*\/?>)+$/i, "");

  // Baru di sini <br> menjadi <p> per butir - sesudah seluruh pemecahan
  // selesai, sehingga pemecahnya tetap satu bentuk sepanjang pengerjaan dan
  // hanya bentuk AKHIRNYA yang berubah. Lihat paragrafkanButir.
  return paragrafkanButir(hasil);
}

/**
 * Merapikan posita satu perkara.
 *
 * @param {string|number} perkaraId
 * @param {boolean} ujiKering benar berarti tidak menulis apa pun - hanya
 *   mengembalikan sebelum dan sesudahnya untuk pratinjau
 * @returns {Promise<{ok: boolean, alasan?: string, sebelum?: string, sesudah?: string, berubah?: boolean, tersentuh?: number}>}
 */
async function rapikanPosita(perkaraId, ujiKering) {
  const id = Number(perkaraId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, alasan: "perkara_id tidak sah." };
  }

  const baris = await runQuery("SELECT posita FROM perkara WHERE perkara_id = ? LIMIT 1", [id]);
  if (!Array.isArray(baris) || baris.length === 0) {
    return { ok: false, alasan: "Perkara tidak ditemukan di SIPP." };
  }

  const lama = String(baris[0].posita || "");
  if (!lama.trim()) {
    // Posita kosong bukan keadaan yang dirapikan - ia keadaan yang diisi, dan
    // mengisinya bukan pekerjaan perapian.
    return { ok: false, alasan: "Posita di SIPP masih kosong - tidak ada yang dirapikan." };
  }
  if (lama.length > BATAS_HURUF) {
    return { ok: false, alasan: `Posita ${lama.length} huruf melewati batas ${BATAS_HURUF}.` };
  }

  const baru = rapikanTeksPosita(lama);
  // Berapa pecahan kata yang disambung kembali - disebut terpisah dari
  // "dirapikan", sebab yang satu memperbaiki data yang rusak.
  const disambung = perbaikiPecahanPalsu(lama).jumlah;

  // ==========================================================================
  // PAGARNYA TETAP DIPERIKSA, WALAU KEDUANYA KINI DARI SATU SUMBER
  // ==========================================================================
  //
  // Sesudah perapiannya pindah ke sini, kedua teks berasal dari kolom yang
  // sama - jadi seharusnya mustahil berbeda isinya. "Seharusnya mustahil"
  // persis keadaan yang membuat pemeriksaan dibuang, dan pemeriksaan inilah
  // yang menemukan titik yang hilang. Ia tinggal.
  if (tanpaRuang(lama) !== tanpaRuang(baru)) {
    return {
      ok: false,
      alasan:
        "Ditolak: perapian mengubah isi positanya, bukan hanya penataannya. Ini cacat " +
        "pada aturan perapiannya sendiri - laporkan, jangan dipaksakan.",
    };
  }

  if (lama === baru) {
    return { ok: true, tersentuh: 0, berubah: false, disambung, sebelum: lama, sesudah: baru, alasan: "sudah rapi" };
  }

  if (ujiKering) {
    return { ok: true, tersentuh: 0, berubah: true, disambung, sebelum: lama, sesudah: baru, alasan: "uji kering" };
  }

  // 17 Okt 2026: tidak ada kata ALETA di SIPP. Posita ini diolah dari teks SIPP
  // sendiri (hanya penataan); kemunculan yang sudah ada di asalnya tidak dihitung,
  // yang BERTAMBAH ditahan.
  const tahanTanda = penjagaTandaSipp.periksaIsian({ Posita: baru }, { teksAsal: lama });
  if (!tahanTanda.ok) return { ok: false, alasan: tahanTanda.pesan, kode: tahanTanda.alasan, kolom: tahanTanda.kolom };

  const hasil = await runQuery("UPDATE perkara SET posita = ? WHERE perkara_id = ? LIMIT 1", [
    baru,
    id,
  ]);
  const tersentuh = Number((hasil && hasil.affectedRows) || 0);
  if (tersentuh !== 1) {
    return { ok: false, alasan: `UPDATE menyentuh ${tersentuh} baris, bukan satu.` };
  }

  return { ok: true, tersentuh, berubah: true, disambung, sebelum: lama, sesudah: baru };
}

/**
 * ============================================================================
 * MENYAMBUNG SATU PECAHAN YANG RAGU - ATAS PERINTAH MANUSIA
 * ============================================================================
 *
 * Pecahan berhuruf a-f tidak dapat dibedakan dari penanda butir yang sungguhan
 * tanpa kamus: "karena" + "a" dan "terlaksan" + "a" tampak persis sama. Karena
 * itu perapian TIDAK menyentuhnya, dan panel menanyakannya.
 *
 * Fungsi ini yang menjawab jawaban itu. Yang dikirim peramban hanya nomor
 * perkara dan URUTAN temuannya - bukan teks, dan bukan pula pola. Positanya
 * dibaca ulang di sini, temuannya dihitung ulang di sini, dan yang disambung
 * temuan pada urutan itu.
 *
 * Sebabnya bukan kerapian: rute yang menerima teks adalah rute yang dapat
 * dititipi posita karangan siapa pun yang dapat membuka alat pengembang
 * peramban. Rute yang menerima ANGKA hanya dapat menyambung apa yang memang
 * ada di sana.
 *
 * ============================================================================
 * PAGARNYA SAMA DENGAN PERAPIAN, DAN ITU BUKAN KEBETULAN
 * ============================================================================
 *
 * Menyambung hanya membuang pemisah dan ruang kosong di antara dua bagian
 * kata. Karena itu pagar yang sama berlaku apa adanya: isi tanpa ruang kosong
 * dan tanpa <br> harus persis sama sebelum dan sesudah. Bila berbeda walau
 * satu huruf, tulisannya ditolak - dan itu berarti ada cacat pada fungsi ini,
 * bukan pada positanya.
 */
async function sambungPecahanRagu(perkaraId, indeks) {
  const id = Number(perkaraId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, alasan: "perkara_id tidak sah." };
  }

  const urutan = Number(indeks);
  if (!Number.isInteger(urutan) || urutan < 0) {
    return { ok: false, alasan: "urutan temuan tidak sah." };
  }

  const baris = await runQuery("SELECT posita FROM perkara WHERE perkara_id = ? LIMIT 1", [id]);
  if (!Array.isArray(baris) || baris.length === 0) {
    return { ok: false, alasan: "Perkara tidak ditemukan di SIPP." };
  }

  const lama = String(baris[0].posita || "");
  if (!lama.trim()) return { ok: false, alasan: "Posita di SIPP masih kosong." };

  const { pecahanRagu } = periksaPosita(lama);
  if (pecahanRagu.length === 0) {
    // Bisa jadi sudah disambung orang lain di antara pratinjau dan penekanan
    // tombolnya. Disebut apa adanya, bukan dianggap gagal.
    return { ok: false, alasan: "Tidak ada lagi pecahan yang ragu pada posita ini." };
  }
  if (urutan >= pecahanRagu.length) {
    return {
      ok: false,
      alasan:
        `Temuan ke-${urutan + 1} tidak ada lagi - kini tinggal ${pecahanRagu.length}. ` +
        "Positanya berubah sejak pratinjau; buka ulang panelnya.",
    };
  }

  // Disambung dengan menghitung ulang kemunculannya, bukan dengan mencari
  // teksnya: dua temuan dapat berbunyi sama persis di satu posita, dan
  // mengganti "yang pertama cocok" akan menyambung yang salah.
  let ke = -1;
  const baru = lama.replace(
    /([a-z])(?:<br\s*\/?>|\n)[ \t]*([a-f])\.[ \t]+(?=[A-Z])/g,
    (cocok, sebelum, huruf) => {
      ke += 1;
      return ke === urutan ? `${sebelum}${huruf}. ` : cocok;
    }
  );

  if (baru === lama) return { ok: false, alasan: "Tidak ada yang tersambung." };

  if (tanpaRuang(lama) !== tanpaRuang(baru)) {
    return {
      ok: false,
      alasan:
        "Ditolak: penyambungan mengubah isi positanya. Ini cacat pada aturan " +
        "penyambungnya sendiri - laporkan, jangan dipaksakan.",
    };
  }

  // 17 Okt 2026: tidak ada kata ALETA di SIPP. Posita ini diolah dari teks SIPP
  // sendiri (hanya penataan); kemunculan yang sudah ada di asalnya tidak dihitung,
  // yang BERTAMBAH ditahan.
  const tahanTanda = penjagaTandaSipp.periksaIsian({ Posita: baru }, { teksAsal: lama });
  if (!tahanTanda.ok) return { ok: false, alasan: tahanTanda.pesan, kode: tahanTanda.alasan, kolom: tahanTanda.kolom };

  const hasil = await runQuery("UPDATE perkara SET posita = ? WHERE perkara_id = ? LIMIT 1", [
    baru,
    id,
  ]);
  const tersentuh = Number((hasil && hasil.affectedRows) || 0);
  if (tersentuh !== 1) {
    return { ok: false, alasan: `UPDATE menyentuh ${tersentuh} baris, bukan satu.` };
  }

  return {
    ok: true,
    tersentuh,
    sebelum: lama,
    sesudah: baru,
    disambung: pecahanRagu[urutan].sambungan,
    sisa: periksaPosita(baru).pecahanRagu.length,
  };
}

module.exports = {
  rapikanPosita,
  rapikanTeksPosita,
  perbaikiPecahanPalsu,
  periksaPosita,
  sambungPecahanRagu,
  tanpaRuang,
  BATAS_HURUF,
};
