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
    .replace(/[\s ]+/g, "");
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

function rapikanTeksPosita(teks) {
  let hasil = String(teks || "").replace(/\r\n/g, "\n");

  // Sudah berupa HTML? Jangan sentuh ganti barisnya - ABT sudah mencetaknya
  // rapi lewat </p>, dan menambahkan <br> di sela-selanya menghasilkan baris
  // kosong berganda di dokumen.
  const sudahHtml = /<\/p>|<br\s*\/?>/i.test(hasil);

  // Butir induk: "2017.2. Bahwa" -> "2017.<br>2. Bahwa"
  // Harus didahului tanda baca. Tanpa syarat itu, "berjumlah 15. Bahwa"
  // terpecah menjadi "1" dan butir baru "5.".
  hasil = hasil.replace(
    new RegExp(`([${SEBELUM_BUTIR}])[ \\t]*(\\d{1,2})\\.[ \\t]+(?=[A-Z])`, "g"),
    "$1<br>$2. "
  );

  // Anak butir: "Tergugat.b. Setiap" atau "karena a. Tergugat".
  //
  // Satu lintasan untuk kedua bentuknya - kalau dipisah menjadi dua penggantian
  // berurutan, yang kedua akan mengenai spasi yang baru saja ditulis yang
  // pertama dan menghasilkan dua <br> berturut-turut.
  hasil = hasil.replace(
    new RegExp(`([${SEBELUM_BUTIR}]|[ \\t])[ \\t]*([a-z])\\.[ \\t]+(?=[A-Z])`, "g"),
    (cocok, sebelum, huruf) => {
      // Spasi yang mendahului tidak dituliskan kembali - ia digantikan
      // pemisahnya. Tanda baca dituliskan kembali; ia bagian dari kalimatnya.
      const awal = sebelum === " " || sebelum === "\t" ? "" : sebelum;
      // Tiga spasi, bukan satu: cleanHtmlTagSpecial menerjemahkannya menjadi
      // \tab, sehingga anak butirnya menggantung di bawah induknya.
      return `${awal}<br>   ${huruf}. `;
    }
  );

  // Ganti baris yang SUDAH ada ikut dijadikan pemisah sungguhan - hanya bila
  // positanya belum berupa HTML. Tanpa langkah ini, posita yang di layar SIPP
  // sudah tampak berbaris-baris tetap tercetak sebagai satu gumpalan.
  if (!sudahHtml) {
    hasil = hasil.replace(/\n+/g, "<br>");
  }

  // <br> berganda menjadi paragraf hampa di dokumen cetak, dan paragraf hampa
  // di tengah dalil gugatan terlihat seperti ada butir yang terhapus.
  hasil = hasil.replace(/(?:<br\s*\/?>\s*){2,}/gi, "<br>");

  // Pemisah di ujung tidak memisahkan apa pun.
  return hasil.replace(/^(?:\s|<br\s*\/?>)+/i, "").replace(/(?:\s|<br\s*\/?>)+$/i, "");
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
    return { ok: true, tersentuh: 0, berubah: false, sebelum: lama, sesudah: baru, alasan: "sudah rapi" };
  }

  if (ujiKering) {
    return { ok: true, tersentuh: 0, berubah: true, sebelum: lama, sesudah: baru, alasan: "uji kering" };
  }

  const hasil = await runQuery("UPDATE perkara SET posita = ? WHERE perkara_id = ? LIMIT 1", [
    baru,
    id,
  ]);
  const tersentuh = Number((hasil && hasil.affectedRows) || 0);
  if (tersentuh !== 1) {
    return { ok: false, alasan: `UPDATE menyentuh ${tersentuh} baris, bukan satu.` };
  }

  return { ok: true, tersentuh, berubah: true, sebelum: lama, sesudah: baru };
}

module.exports = { rapikanPosita, rapikanTeksPosita, tanpaRuang, BATAS_HURUF };
