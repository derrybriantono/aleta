"use strict";

/**
 * ============================================================================
 * PESAN UNTUK PETUGAS - TOMBOL TUNDA / PUTUSAN JADWAL SIDANG
 * ============================================================================
 *
 * 7 Okt 2026, perkara 273/Pdt.G/2026/PA.Dgl: tombol TUNDA gagal dan yang
 * sampai ke layar hanya kode "gagal_menulis" - lalu, ketika dicoba lagi,
 * "sidang_sudah_ditunda". Petugas tidak tahu apa yang terjadi, apakah ada
 * yang tersimpan, atau apa yang harus dikerjakan; ia menunda manual di SIPP.
 *
 * Tiap kode penolakan/kegagalan diterjemahkan di sini menjadi kalimat yang
 * menjawab tiga hal: APA yang terjadi, APA yang tersimpan di SIPP, dan APA
 * langkah berikutnya. Kodenya tetap ikut (`kode`) untuk jejak dan uji.
 *
 * Istilah tampilan: "server" (bukan "peladen"), "blangko" (bukan "borang").
 */

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

function daftarNama(nama) {
  const semua = (Array.isArray(nama) ? nama : []).map(bersih).filter(Boolean);
  return semua.length ? ` (${semua.join(", ")})` : "";
}

const KATA_AKSI = { tunda: "Penundaan", putus: "Putusan sidang" };

/**
 * @param {object} hasil  rencana yang ditolak ATAU hasil penjalan yang gagal
 * @param {"tunda"|"putus"} jalan
 * @returns {string} kalimat untuk petugas; "" bila hasilnya berhasil
 */
function pesanHasilSidang(hasil, jalan = "tunda") {
  const h = hasil || {};
  if (h.ok === true) return "";
  const kode = bersih(h.alasan) || "ditolak";
  const aksi = KATA_AKSI[jalan] || "Perubahan";
  const tidakAdaPerubahan = "Tidak ada yang diubah di SIPP.";

  switch (kode) {
    case "jadwal_tidak_ketemu":
      return "Jadwal sidang ini tidak ditemukan di SIPP - mungkin sudah dihapus atau diubah. Muat ulang Jadwal Sidang lalu coba lagi.";
    case "sidang_sudah_ditunda":
      return `Sidang ini sudah tercatat DITUNDA di SIPP dan sidang berikutnya sudah ada. ${tidakAdaPerubahan}`;
    case "tunda_belum_utuh":
      return (
        "Sidang ini tercatat DITUNDA di SIPP" +
        (bersih(h.alasanTercatat) ? ` (alasan: "${bersih(h.alasanTercatat)}")` : "") +
        ", tetapi jadwal sidang berikutnya TIDAK ADA - penundaan sebelumnya hanya tersimpan setengah. " +
        "Lengkapi lewat SIPP (Penundaan Jadwal Sidang / tambah jadwal sidang berikutnya), atau minta admin membereskan barisnya. " +
        tidakAdaPerubahan
      );
    case "sidang_ditunda_tidak_dapat_diputus":
      return (
        "Sidang ini sudah ditunda dan sidang berikutnya sudah dijadwalkan, jadi tidak dapat dicatat diputus dari sini. " +
        "Catat putusannya pada sidang terakhir, atau hapus dulu jadwal berikutnya di SIPP. " +
        tidakAdaPerubahan
      );
    case "panitera_sidang_tidak_ketemu":
      return `Panitera sidang (PP) perkara ini tidak tercatat di SIPP - isi dulu penunjukan PP di SIPP. ${aksi} dicatat atas nama PP perkara, jadi tidak dapat ditulis. ${tidakAdaPerubahan}`;
    case "panitera_sidang_ganda":
      return `Perkara ini punya lebih dari satu panitera sidang (PP) aktif di SIPP${daftarNama(h.nama)}. Nonaktifkan PP yang tidak bertugas di SIPP lalu coba lagi - ALETA tidak memilih salah satunya. ${tidakAdaPerubahan}`;
    case "akun_sipp_pp_tidak_ada":
      return `Panitera sidang perkara ini${daftarNama(h.nama)} tidak punya akun pengguna SIPP, padahal ${aksi.toLowerCase()} dicatat atas nama PP. Buatkan/tautkan akun SIPP-nya lalu coba lagi. ${tidakAdaPerubahan}`;
    case "akun_sipp_pp_diblokir":
      return `Akun SIPP panitera sidang perkara ini${daftarNama(h.nama)} sedang diblokir di SIPP. Aktifkan akunnya atau ganti PP perkara di SIPP lalu coba lagi. ${tidakAdaPerubahan}`;
    case "akun_sipp_pp_ganda":
      return `Panitera sidang perkara ini${daftarNama(h.nama)} punya lebih dari satu akun SIPP aktif - ALETA tidak memilih salah satunya. Blokir akun yang tidak dipakai di SIPP lalu coba lagi. ${tidakAdaPerubahan}`;
    case "panitera_sidang_tidak_terbaca":
      return `Data panitera sidang tidak dapat dibaca dari SIPP saat ini. Coba lagi sebentar. ${tidakAdaPerubahan}`;
    case "alasan_tunda_kosong":
      return "Alasan penundaan wajib diisi.";
    case "agenda_berikut_kosong":
      return "Agenda sidang berikutnya wajib diisi.";
    case "teks_menyebut_aleta":
      // Penjaga bersama (penjagaTandaSipp) menyebut kolomnya; pemeriksaan awal
      // tunda sidang tidak, jadi kalimat umumnya tetap tersedia.
      return (
        bersih(h.pesan) ||
        "Alasan penundaan dan agenda berikutnya tersimpan di SIPP - jangan menyebut kata ALETA di sana. Tulis tanpa kata itu."
      );
    case "tanggal_berikut_tidak_sah":
      return "Tanggal sidang berikutnya belum diisi atau bentuknya tidak sah.";
    case "jam_berikut_tidak_sah":
      return "Jam sidang berikutnya tidak sah (contoh: 09:00).";
    case "tanggal_berikut_tidak_maju":
      return `Tanggal sidang berikutnya${bersih(h.diminta) ? ` (${bersih(h.diminta)})` : ""} harus sesudah hari ini.`;
    case "tanggal_berikut_akhir_pekan":
      return `Tanggal sidang berikutnya${bersih(h.diminta) ? ` (${bersih(h.diminta)})` : ""} jatuh pada Sabtu/Minggu - SIPP juga menolaknya. Pilih hari kerja.`;
    case "tanggal_ikrar_melewati_batas_6_bulan":
      return `Tanggal sidang ikrar berikutnya${bersih(h.diminta) ? ` (${bersih(h.diminta)})` : ""} melewati batas 6 bulan ikrar${bersih(h.batas) ? ` (${bersih(h.batas)})` : ""}, dihitung sejak penetapan hari sidang ikrar (Pasal 70 ayat (6) UU 7/1989). Tidak ada yang tersimpan di SIPP. Pilih tanggal paling lambat pada batas itu.`;
    case "tanggal_berikut_hari_libur":
      return `Tanggal sidang berikutnya hari libur${bersih(h.keterangan) ? ` (${bersih(h.keterangan)})` : ""}. Pilih hari kerja.`;
    case "ruangan_sidang_tidak_dikenal":
      return "Ruang sidang yang dipilih tidak dikenal atau tidak aktif di SIPP. Pilih ruang lain.";
    case "status_putusan_belum_dipilih":
      return "Jenis putusan belum dipilih.";
    case "status_putusan_tidak_dikenal":
      return "Jenis putusan yang dipilih tidak dikenal SIPP.";
    case "tanggal_putus_tidak_sah":
      return "Tanggal putusan tidak sah.";
    case "operator_tidak_disebut":
      return "Permintaan tidak menyebut siapa yang menekan tombolnya - masuk ulang ke ALETA lalu coba lagi.";
    case "server_sipp_tidak_terhubung":
      return `Server SIPP tidak dapat dihubungi${bersih(h.pesan) ? ` (${bersih(h.pesan)})` : ""}. ${tidakAdaPerubahan} Coba lagi sebentar.`;
    case "gagal_menulis":
    case "gagal_menyimpan":
    case "tabel_di_luar_daftar":
    case "id_langkah_sebelumnya_tidak_ada": {
      const pada = h.pada && typeof h.pada === "object" ? h.pada : null;
      const langkah = pada ? bersih(pada.keterangan) || `${bersih(pada.aksi)} ${bersih(pada.tabel)}` : "";
      const teknis = bersih(h.pesan);
      const sebab =
        `SIPP menolak ${langkah ? `langkah "${langkah}"` : "penyimpanannya"}` + (teknis ? ` (${teknis})` : "") + ".";
      if (h.dipulihkan === false) {
        const tertulis = (Array.isArray(h.selesai) ? h.selesai : [])
          .map((x) => bersih(x && (x.keterangan || `${x.aksi} ${x.tabel}`)))
          .filter(Boolean);
        return (
          `${aksi} GAGAL. ${sebab} PERHATIAN: pembatalan otomatis juga gagal, jadi sebagian mungkin sudah tertulis` +
          (tertulis.length ? ` (${tertulis.join("; ")})` : "") +
          ". Periksa jadwal sidang perkara ini di SIPP sebelum mencoba lagi, dan laporkan pesan ini ke admin."
        );
      }
      return (
        `${aksi} TIDAK tersimpan. ${sebab} Semua langkah dibatalkan - data SIPP kembali seperti sebelum tombol ditekan. ` +
        "Coba lagi; bila berulang, catat lewat SIPP dan laporkan pesan ini ke admin."
      );
    }
    // Tunda otomatis 16.30 (22 Okt 2026) - penjagaTundaOtomatis.
    case "sidang_sudah_diberi_hasil":
      return `Hasil sidang ini sudah dicatat petugas${bersih(h.alasanTercatat) ? ` ("${bersih(h.alasanTercatat)}")` : ""} - tunda otomatis tidak menimpanya. ${tidakAdaPerubahan}`;
    case "perkara_sudah_diputus":
      return `Perkara ini sudah diputus - tunda otomatis tidak menulis apa pun. ${tidakAdaPerubahan}`;
    case "jadwal_berubah":
      return `Tanggal sidang ini sudah diubah sejak daftar tunda otomatis disusun - tidak ditulis. ${tidakAdaPerubahan}`;
    case "sidang_ikrar_dilewati":
      return `Sidang ikrar talak tidak ditunda otomatis - pakai tombol ikrar di Jadwal Sidang. ${tidakAdaPerubahan}`;
    case "sudah_ada_jadwal_berikutnya":
      return `Perkara ini sudah punya jadwal sidang berikutnya - tunda otomatis tidak menulis apa pun. ${tidakAdaPerubahan}`;
    case "jadwal_tidak_terbaca":
      return `Jadwal sidang perkara ini tidak dapat dibaca dari SIPP saat ini. ${tidakAdaPerubahan}`;
    case "pihak_tercatat_hadir":
      return `Penggugat/Pemohon tercatat hadir hari ini - tidak diputus otomatis. ${tidakAdaPerubahan}`;
    case "putus_otomatis_dilewati_jenis":
      return `Perlawanan (verzet) atau eksekusi tidak diputus otomatis. ${tidakAdaPerubahan}`;
    case "putus_otomatis_tanpa_putusan_akhir":
      return `Putus otomatis hanya mencatat keterangan putus di jadwal sidang, bukan Putusan Akhir. ${tidakAdaPerubahan}`;
    case "perkara_sedang_dikerjakan":
      return `Petugas sedang mengerjakan perkara ini (atau kuncinya tidak terbaca) - tunda otomatis menunggu, tidak menulis. ${tidakAdaPerubahan}`;
    case "bukan_sidang_ikrar":
      return `Jadwal sidang ini bukan sidang ikrar talak. ${tidakAdaPerubahan}`;
    case "ikrar_belum_dinyatakan_terlaksana":
      return `Keterangan jadwal sidang ini belum menyatakan ikrar talak sudah dilaksanakan, jadi form ikrar tidak diisi. ${tidakAdaPerubahan}`;
    case "penetapan_ikrar_belum_ada":
      return `Perkara ini belum punya penetapan majelis ikrar talak di SIPP - form ikrar belum bisa diisi. ${tidakAdaPerubahan}`;
    case "form_ikrar_sudah_terisi":
      return `Form ikrar talak perkara ini sudah terisi di SIPP pada tanggal sidang ini. ${tidakAdaPerubahan}`;
    case "tanggal_ikrar_lain_sudah_tercatat":
      return `Form ikrar talak sudah berisi tanggal ikrar lain${bersih(h.tercatat) ? ` (${bersih(h.tercatat)})` : ""} - tidak ditimpa. Periksa di SIPP. ${tidakAdaPerubahan}`;
    case "tanggal_ikrar_masa_depan":
      return `Tanggal sidang ikrar${bersih(h.tanggal) ? ` (${bersih(h.tanggal)})` : ""} belum tiba, jadi ikrar belum bisa dinyatakan terlaksana. ${tidakAdaPerubahan}`;
    case "tanggal_ikrar_akhir_pekan":
      return `Tanggal sidang ikrar jatuh pada Sabtu/Minggu - SIPP menolak tanggal ikrar di akhir pekan. ${tidakAdaPerubahan}`;
    case "ketua_majelis_ikrar_tidak_ada":
      return `Ketua majelis ikrar talak perkara ini belum tercatat di SIPP, padahal form ikrar dicatat atas akunnya. ${tidakAdaPerubahan}`;
    case "akun_ketua_majelis_tidak_ada":
    case "akun_ketua_majelis_ganda":
      return `Akun SIPP ketua majelis ikrar${daftarNama(h.nama)} tidak ada atau ganda - ALETA tidak memilih salah satunya. ${tidakAdaPerubahan}`;
    // Tombol PUTUS ikrar tiga status (28 Okt 2026).
    case "panitera_sidang_ikrar_tidak_pasti":
      return `PP ikrar talak perkara ini belum ditetapkan di SIPP, dan PP pemeriksaannya lebih dari satu${daftarNama(h.nama)} - ALETA tidak memilih salah satunya. Isi penetapan PP ikrar di SIPP lalu coba lagi. ${tidakAdaPerubahan}`;
    case "ikrar_belum_dikonfirmasi":
      return "Pilih hasil sidang ikrar dan centang konfirmasinya dulu.";
    case "status_ikrar_tidak_dikenal":
      return `Pilihan hasil sidang ikrar tidak dikenal (hanya Diikrarkan, Pemohon Tidak Hadir, atau Rukun Kembali). ${tidakAdaPerubahan}`;
    case "status_ikrar_lain_sudah_tercatat":
      return `Form ikrar talak perkara ini sudah berstatus "${bersih(h.tercatat)}" di SIPP - tidak ditimpa menjadi "${bersih(h.diminta)}". Ubah lewat SIPP bila memang keliru. ${tidakAdaPerubahan}`;
    case "pemohon_tidak_hadir_tidak_dapat_diikrarkan":
      return `Kehadiran sidang ini tercatat Pemohon tidak hadir, jadi ikrar tidak mungkin diucapkan. Pilih "Pemohon Tidak Hadir" atau tunda sidangnya. ${tidakAdaPerubahan}`;
    case "gugur_hanya_bila_pemohon_tidak_hadir":
      return `"Pemohon Tidak Hadir" hanya dapat dipilih bila kehadiran sidang ini Termohon saja atau para pihak tidak hadir. ${tidakAdaPerubahan}`;
    case "gugur_tenggat_belum_berjalan":
      return `Hari sidang ikrar belum ditetapkan di SIPP, jadi tenggat 6 bulan belum berjalan dan ikrar belum dapat dinyatakan gugur. ${tidakAdaPerubahan}`;
    case "gugur_belum_sidang_terakhir":
      return `Batas 6 bulan ikrar baru ${bersih(h.batas)}. "Pemohon Tidak Hadir" (kekuatan putusan gugur) baru dapat dipilih pada sidang ikrar mulai ${bersih(h.awal)}; sebelum itu tunda sidangnya (Pasal 70 ayat (6) UU 7/1989). ${tidakAdaPerubahan}`;
    case "rukun_kembali_pemohon_tidak_hadir":
      return `"Rukun Kembali" hanya dapat dipilih bila Pemohon hadir dan menyatakan tidak menjatuhkan ikrar talak. Periksa kehadirannya. ${tidakAdaPerubahan}`;
    case "amar_ikrar_tidak_dapat_disusun":
      return `Amar penetapan ikrar tidak dapat disusun karena nomor/tanggal putusan atau nama pengadilan belum terbaca dari SIPP. ${tidakAdaPerubahan}`;
    case "jadwal_berubah_sebelum_ditulis":
    case "form_ikrar_berubah_sebelum_ditulis":
      return `Data sidang ikrar ini berubah tepat sebelum disimpan (tombol ditekan dua kali, atau petugas lain sedang mengisinya di SIPP). ${tidakAdaPerubahan} Muat ulang Jadwal Sidang lalu periksa hasilnya.`;
    default:
      if (/^tanggal_ikrar_mendahului_/.test(kode)) {
        return `Tanggal ikrar mendahului ${kode.replace("tanggal_ikrar_mendahului_", "").replace(/_/g, " ")}${bersih(h.batas) ? ` (${bersih(h.batas)})` : ""} - SIPP menolaknya. ${tidakAdaPerubahan}`;
      }
      return `${aksi} ditolak (${kode}). ${tidakAdaPerubahan}`;
  }
}

module.exports = { pesanHasilSidang };
