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
    default:
      return `${aksi} ditolak (${kode}). ${tidakAdaPerubahan}`;
  }
}

module.exports = { pesanHasilSidang };
