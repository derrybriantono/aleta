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
 * Membuang SELURUH ruang kosong.
 *
 * Bukan hanya merapatkan spasi ganda: spasi, tab, ganti baris, dan spasi tak
 * terputus (yang dimasukkan penyunting HTML) semuanya dibuang. Perbandingan
 * pada bentuk inilah yang membuktikan tidak ada huruf yang ditambah maupun
 * hilang.
 */
function tanpaRuang(teks) {
  return String(teks || "").replace(/[\s ]+/g, "");
}

/**
 * ============================================================================
 * PERAPIANNYA DIKERJAKAN DI SINI, ATAS TEKS MENTAH SIPP
 * ============================================================================
 *
 * Dulu ekstensi yang merapikan lalu mengirimkan hasilnya. Itu keliru, dan
 * kekeliruannya menampakkan diri sebagai penolakan yang membingungkan:
 * petugas hanya menekan Terapkan, dan yang muncul "isi positanya berbeda".
 *
 * Sebabnya teks yang dirapikan ekstensi BUKAN teks yang tersimpan di SIPP. Ia
 * innerText satu sel tabel - hasil peramban menggambar HTML: baris ganda
 * dirapatkan, entitas diterjemahkan, tag dibuang. Membandingkannya dengan isi
 * kolom di basis data membandingkan dua hal yang berbeda sejak awal.
 *
 * Sekarang yang dibaca, dirapikan, dan dibandingkan satu teks yang sama:
 * kolom posita apa adanya. Ekstensi tidak lagi mengirim teks sama sekali - ia
 * hanya menyebut perkaranya. Itu sekaligus menutup kemungkinan peramban
 * mengirimkan posita karangan sendiri.
 *
 * ============================================================================
 * SATU TITIK YANG HILANG - DAN PAGARNYALAH YANG MENEMUKANNYA
 * ============================================================================
 *
 * Pola anak butir yang lama memakai `\.?` untuk memakan titik di antara dua
 * butir, dan tidak pernah menuliskannya kembali. Pada posita yang benar-benar
 * ada di PA Donggala:
 *
 *   "...bersama teman-teman Tergugat.b. Setiap kali terjadi pertengkaran..."
 *
 * titik sesudah "Tergugat" lenyap. Satu huruf, pada dalil gugatan.
 *
 * Pagar "isi tidak boleh berubah" itulah yang menangkapnya - bukan uji, bukan
 * pembacaan ulang. Ia menahan perapian yang cacat sebelum cacatnya sampai ke
 * basis data, dan pesan penolakannya yang membawa persoalan ini ke permukaan.
 * Titiknya kini ditangkap sebagai kelompok tersendiri dan dituliskan kembali.
 */
function rapikanTeksPosita(teks) {
  let hasil = String(teks || "").replace(/\r\n/g, "\n");

  // Butir induk: "2017.2. Bahwa" -> "2017." baris baru "2. Bahwa".
  // Hanya ruang kosong yang termakan di antara $1 dan angkanya.
  hasil = hasil.replace(/([^\s\n])\s*(\d{1,2})\.\s+(?=[A-Z])/g, "$1\n$2. ");

  // Anak butir: "Tergugat.b. Setiap" -> "Tergugat." baris baru "   b. Setiap".
  // Titiknya DITANGKAP sebagai $2 dan dituliskan kembali - lihat catatan di
  // atas. Tanpa itu ia hilang, dan pagar isi menolak seluruh perapiannya.
  hasil = hasil.replace(/([^\s\n])\s*(\.?)\s*([a-z])\.\s+(?=[A-Z])/g, "$1$2\n   $3. ");

  // Baris kosong berganda menjadi paragraf hampa di dokumen cetak, dan
  // paragraf hampa di tengah pertimbangan terlihat seperti ada yang terhapus.
  return hasil
    .split("\n")
    .map((baris) => baris.replace(/\s+$/, ""))
    .filter((baris, i, semua) => baris.trim() !== "" || (i > 0 && semua[i - 1].trim() !== ""))
    .join("\n")
    .trim();
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
