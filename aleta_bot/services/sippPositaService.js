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
 * dan dari Abt_model::get_data_variabel, yang untuk data_sipp menjalankan:
 *
 *   select {kolom} as data from {tabel} where perkara_id = ? limit 1
 *
 * terhadap koneksi dbsipp. ABT TIDAK menyimpan salinannya. Rute edit_data
 * miliknya hanya menerima data_teks dan data_tanggal - itu sebabnya ia
 * menjawab "bertipe data_sipp - tidak dapat disunting", dan penolakan itu
 * benar: tidak ada tempat di ABT untuk menyimpannya.
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
 * dapat diperiksa secara mutlak: buang seluruh spasi, tab, dan ganti baris
 * dari kedua teks, lalu bandingkan. Bila hasilnya berbeda walau satu huruf,
 * tulisannya DITOLAK.
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
 *   - batas panjang, supaya kekeliruan di sisi peramban tidak menuliskan
 *     berkas raksasa ke kolom putusan
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
 * Membuang SELURUH ruang kosong.
 *
 * Bukan hanya merapatkan spasi ganda: spasi, tab, ganti baris, dan spasi tak
 * terputus (  - yang dimasukkan penyunting HTML) semuanya dibuang.
 * Perbandingan pada bentuk inilah yang membuktikan tidak ada kata yang
 * ditambah maupun hilang.
 */
function tanpaRuang(teks) {
  return String(teks || "").replace(/[\s ]+/g, "");
}

/**
 * Merapikan posita satu perkara.
 *
 * @param {string|number} perkaraId
 * @param {string} positaBaru teks yang sudah dirapikan di sisi peramban
 * @returns {Promise<{ok: boolean, alasan?: string, sebelum?: string, sesudah?: string}>}
 */
async function rapikanPosita(perkaraId, positaBaru) {
  const id = Number(perkaraId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, alasan: "perkara_id tidak sah." };
  }

  const baru = String(positaBaru || "");
  if (!baru.trim()) {
    return { ok: false, alasan: "Posita baru kosong." };
  }
  if (baru.length > BATAS_HURUF) {
    return { ok: false, alasan: `Posita ${baru.length} huruf melewati batas ${BATAS_HURUF}.` };
  }

  const baris = await runQuery("SELECT posita FROM perkara WHERE perkara_id = ? LIMIT 1", [id]);
  if (!Array.isArray(baris) || baris.length === 0) {
    return { ok: false, alasan: "Perkara tidak ditemukan di SIPP." };
  }
  const lama = String(baris[0].posita || "");
  if (!lama.trim()) {
    // Posita kosong bukan keadaan yang dirapikan - ia keadaan yang diisi, dan
    // mengisinya bukan pekerjaan perapian. Menolak di sini menutup jalan
    // seseorang menuliskan posita baru lewat tombol yang namanya "rapikan".
    return { ok: false, alasan: "Posita di SIPP masih kosong - tidak ada yang dirapikan." };
  }

  // ==========================================================================
  // PAGARNYA: ISI YANG SAMA, HANYA RUANG KOSONGNYA YANG BERBEDA
  // ==========================================================================
  if (tanpaRuang(lama) !== tanpaRuang(baru)) {
    return {
      ok: false,
      alasan:
        "Ditolak: isi positanya berbeda, bukan sekadar penataannya. Perapian hanya " +
        "boleh menyisipkan pemisah - tidak boleh menambah, mengurangi, atau mengubah " +
        "satu huruf pun dari dalil gugatan.",
    };
  }

  if (lama === baru) {
    return { ok: true, tersentuh: 0, sebelum: lama, sesudah: baru, alasan: "sudah rapi" };
  }

  const hasil = await runQuery("UPDATE perkara SET posita = ? WHERE perkara_id = ? LIMIT 1", [
    baru,
    id,
  ]);
  const tersentuh = Number((hasil && hasil.affectedRows) || 0);
  if (tersentuh !== 1) {
    return { ok: false, alasan: `UPDATE menyentuh ${tersentuh} baris, bukan satu.` };
  }

  return { ok: true, tersentuh, sebelum: lama, sesudah: baru };
}

module.exports = { rapikanPosita, tanpaRuang, BATAS_HURUF };
