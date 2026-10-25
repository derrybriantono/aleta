/**
 * ============================================================================
 * SAKLAR KINERJA EKSTENSI & PORTAL (K12/K16, rantai B, 25 Okt 2026)
 * ============================================================================
 *
 * Saklar milik Super Admin untuk perubahan yang hanya meringankan PC tua dan
 * tidak mengubah isi pekerjaan. SEMUANYA MATI BAWAAN: dengan semua mati,
 * ekstensi dan portal berjalan persis seperti sebelum rantai B.
 *
 * Disimpan di aleta_ekstensi_setelan (pengguna_id "*sistem*", tanpa migrasi)
 * dan dikirim ke ekstensi bersama GET /ekstensi/tampilan (ruas `kinerja`).
 */

export const KUNCI_KINERJA = "sistem:kinerja-ekstensi";

export type SaklarKinerja = {
  /** K12: satu MutationObserver, interval jadi kejadian, tab tersembunyi berhenti, satu tab per PC untuk putusan terjadwal. */
  pengamatTunggal: boolean;
  /** K16: komputer sederhana (memori <= 4 GB atau <= 2 inti) otomatis memakai mode ringan; pilihan pengguna tetap menang. */
  modeRinganOtomatis: boolean;
  /** K15: antrean cetak/relaas massal dan catatan putusan terjadwal disalin ke Postgres supaya dapat dilanjutkan sesudah Chrome ditutup. */
  antreanDiServer: boolean;
  /** K14: cetak massal (ZIP/PDF gabungan) dan pemeriksa sisa blangko dikerjakan server; peramban menerima hasil jadi. Jalur lama tetap sebagai cadangan. */
  berkasDiServer: boolean;
  /** U16: perkara terakhir dan versi ekstensi per PC disimpan di server per pengguna; mengikuti petugas ke PC lain. */
  konteksDiServer: boolean;
};

export const SAKLAR_KINERJA_BAWAAN: Readonly<SaklarKinerja> = Object.freeze({
  pengamatTunggal: false,
  modeRinganOtomatis: false,
  antreanDiServer: false,
  berkasDiServer: false,
  konteksDiServer: false,
});

export const KETERANGAN_KINERJA: Readonly<Record<keyof SaklarKinerja, { judul: string; isi: string }>> = {
  pengamatTunggal: {
    judul: "Pengamat tunggal di ekstensi",
    isi: "Belasan pengamat halaman dan puluhan pewaktu di ekstensi disatukan, berhenti di tab yang tersembunyi, dan putusan terjadwal ditanyakan oleh satu tab per PC. Meringankan PC tua; tidak mengubah isi pekerjaan. Berlaku di tab yang sudah terbuka paling lambat lima menit sesudah disimpan.",
  },
  modeRinganOtomatis: {
    judul: "Mode ringan otomatis untuk PC tua",
    isi: "Komputer dengan memori 4 GB atau kurang, atau 2 inti, otomatis mematikan hiasan (animasi, transisi, kabur latar) dan memperlambat pewaktu di ekstensi dan portal. Pengguna tetap bisa memilih sendiri nyala atau mati, dan pilihan itu menang. Tidak ada fungsi yang dikurangi.",
  },
  antreanDiServer: {
    judul: "Antrean kerja peramban disalin ke server",
    isi: "Antrean cetak massal, relaas massal, dan catatan putusan terjadwal disalin ke basis data (hanya keadaan pengerjaan: nomor perkara, nama berkas, status; tanpa isi putusan atau NIK). Sesudah Chrome ditutup atau komputer diganti, pemiliknya ditawari melanjutkan; tidak ada yang dijalankan sendiri. Mati = antrean hanya di peramban seperti dulu.",
  },
  berkasDiServer: {
    judul: "Berkas cetak massal dikerjakan server",
    isi: "Cetak massal Blangko Derry (ZIP RTF atau PDF gabungan) dan pemeriksaan sisa blangko dikerjakan server; peramban cukup mengirim naskah satu per satu lalu menerima hasil jadi, dan boleh ditutup selagi server bekerja. Hasil disimpan di memori server paling lama dua jam dan tidak pernah ditulis ke disk atau basis data. Bila server gagal, jalur lama di peramban dipakai. Mati = seperti dulu.",
  },
  konteksDiServer: {
    judul: "Perkara terakhir dan versi ekstensi mengikuti pengguna",
    isi: "Daftar perkara yang terakhir dibuka di SIPP (hanya nomor, jenis, dan pintu masuknya; tanpa isi perkara atau NIK) disimpan per pengguna di server, jadi muncul juga di PC lain. Versi ekstensi tiap PC dicatat supaya ekstensi memperingatkan bila PC lain memakai versi yang berbeda. Mati = hanya di PC masing-masing seperti dulu.",
  },
};

/** Hanya kunci yang dikenal dan hanya boolean sejati; selainnya jatuh ke bawaan (mati). */
export function bersihkanKinerja(x: unknown): SaklarKinerja {
  const sumber = x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
  const hasil = { ...SAKLAR_KINERJA_BAWAAN } as SaklarKinerja;
  for (const k of Object.keys(SAKLAR_KINERJA_BAWAAN) as Array<keyof SaklarKinerja>) {
    if (sumber[k] === true) hasil[k] = true;
  }
  return hasil;
}
