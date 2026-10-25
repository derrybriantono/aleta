import { catatGalat } from "@/server/modules/kesehatan/galat";
import {
  daftarkanLangkahKedua,
  daftarkanPenerimaLaporanKesehatan,
  type LaporanKesehatan,
} from "@/server/modules/keamanan/kait";
import { authenticatorUntukAksiTersedia, periksaKodeAuthenticatorAksi } from "@/server/modules/verifikasi/layanan";

/**
 * ============================================================================
 * PENYAMBUNG KAIT KEAMANAN (gabung rantai E + Bagian 6, 26 Okt 2026)
 * ============================================================================
 *
 * Bagian 6 (pengaman aksi admin, uji pulih cadangan) menyediakan kait di keamanan/kait.ts tanpa bergantung keras
 * pada rantai E. Setelah keduanya digabung, di sinilah kait itu diisi. Dipanggil sekali dari instrumentation.ts;
 * mendaftar dua kali aman (pendaftar diganti). TIDAK mengubah bawaan apa pun:
 *
 *   langkah kedua (E5 -> 6c)   authenticator/kode cadangan; tersedia hanya bila saklar authenticator menyala DAN
 *                              akun sudah mendaftar. Saklar "langkah kedua" di Pengaturan Keamanan tetap MATI bawaan.
 *   laporan kesehatan (6d -> E2)  uji pulih cadangan yang GAGAL masuk Catatan error Pusat kesehatan; hasil baik atau
 *                              peringatan tidak dicatat di sana (sudah ada di layar Uji pulih).
 *
 * TIDAK disambungkan: "luar kantor wajib verifikasi" (6b) - lihat docs/awan/laporan-gabung-rantai-26okt.md.
 */
export function sambungkanKaitKeamanan() {
  daftarkanLangkahKedua({
    nama: "verifikasi-dua-langkah",
    tersedia: async (db, aktor) => authenticatorUntukAksiTersedia(db, aktor.id),
    periksa: async (db, aktor, kode) => periksaKodeAuthenticatorAksi(db, aktor.id, kode),
  });
  daftarkanPenerimaLaporanKesehatan({
    nama: "pusat-kesehatan",
    terima: async (db, laporan: LaporanKesehatan) => {
      if (laporan.tingkat !== "gagal") return;
      await catatGalat(db, {
        sumber: "server",
        jenis: "uji-pulih-cadangan",
        pesan: `${laporan.judul}: ${laporan.rincian}`.slice(0, 500),
        lokasi: "keamanan/uji-pulih",
      });
    },
  });
}

/** Untuk instrumentation.ts: tidak pernah melempar. */
export function sambungkanKaitKeamananAman() {
  try {
    sambungkanKaitKeamanan();
  } catch (galat) {
    console.warn("[KAIT KEAMANAN] tidak tersambung:", galat instanceof Error ? galat.message : "tidak diketahui");
  }
}
