/**
 * ============================================================================
 * PENANDA ISIAN "DIISI MANUAL" DAN "OPSIONAL" BLANGKO DERRY (20 Okt 2026, agen S3)
 * ============================================================================
 *
 * Isian popup yang TIDAK mungkin terisi otomatis ditandai terang di kartu "Perlu diisi" - tidak dibiarkan kosong tanpa kabar:
 *
 *   ISIAN_MANUAL    kode -> alasan singkat (bahasa pengguna). Tampil sebagai lencana "diisi manual" dan alasan di ikon ⓘ.
 *                   Hanya dipakai bila tidak ada pengisi yang menemukan nilai untuk perkara itu: pengisi otomatis tetap menang.
 *                   Isinya keputusan/penilaian majelis atau fakta persidangan yang tidak dicatat SIPP.
 *   ISIAN_OPSIONAL  kode -> label bahasa pengguna. Isian tambahan (bila ada) - bukan bagian "Perlu diisi"; layar memindahkannya
 *                   ke bagian tertutup "Isian tambahan (bila ada)".
 *
 * Berkas ini murni data (dibaca pula oleh skrip ukur scripts/isi-sipp-abt/ukur-isi-otomatis-20okt.cjs): dua objek literal
 * sederhana, tanpa ekspresi. Nama ABT tidak diubah; ini hanya tampilan.
 */

export const ISIAN_MANUAL: Record<string, string> = {
  // Keterangan saksi di sidang (tidak ada di SIPP maupun posita)
  "2557": "Jumlah kali saksi pertama melihat dan mendengar pertengkaran diambil dari keterangan saksi di sidang; tidak tercatat di SIPP.",
  "2558": "Jumlah kali saksi kedua melihat dan mendengar pertengkaran diambil dari keterangan saksi di sidang; tidak tercatat di SIPP.",
  // Penilaian majelis
  "7178": "Alasan panggilan dianggap tidak patut adalah penilaian majelis atas relaas panggilan; diisi hakim.",
  "8729": "Penilaian keterangan saksi dan fakta yang tidak terbukti adalah penilaian hakim; tidak dapat diisi otomatis.",
  "9501": "Penilaian jawaban dan bukti Tergugat/Termohon adalah penilaian hakim; tidak dapat diisi otomatis.",
  "9680": "Alasan Tergugat/Termohon tidak menyetujui pencabutan disampaikan di sidang; tidak tercatat di SIPP.",
  "9682": "Fakta atau alasan perkara di luar kewenangan adalah pertimbangan majelis; diisi hakim.",
  "9684": "Fakta atau alasan perkara termasuk kewenangan pengadilan agama adalah pertimbangan majelis; diisi hakim.",
  "9685": "Pokok eksepsi Tergugat/Termohon dibaca dari jawaban yang diucapkan atau diunggah; belum ada jawaban yang dapat dibaca.",
  "9683": "Pihak yang masih terikat perkawinan lain, dan dengan siapa, adalah pertimbangan majelis; diisi hakim.",
  "9772": "Rukun atau syarat nikah yang tidak terbukti adalah penilaian majelis; diisi hakim.",
  "9687": "Penilaian alasan mendesak atau kesulitan yang sah adalah penilaian majelis; diisi hakim bila alasan mendesak terbukti.",
  "8901": "Butir amar kesepakatan perdamaian sebagian disusun majelis dari kesepakatan para pihak.",
  // Surat panitera yang belum dicatat terstruktur
  "8712": "Surat teguran panjar belum dicatat terstruktur di SIPP; ketik nomor dan tanggal dari surat panitera.",
  "8713": "Batas waktu menambah panjar tertulis di surat teguran panitera; tidak ada di SIPP.",
  "8714": "Laporan panitera bahwa panjar tidak ditambah belum dicatat terstruktur di SIPP; ketik nomor dan tanggal dari suratnya.",
  // Fakta sidang ikrar
  "9220": "Keadaan Termohon saat ikrar (suci, haid, atau hamil) disampaikan Termohon di sidang ikrar; tidak tercatat di SIPP.",
};

export const ISIAN_OPSIONAL: Record<string, string> = {
  // #9134# = petunjuk perbaikan permohonan dari majelis pada BAS permohonan (keputusan pengguna 20 Okt: bukan bagian "Perlu diisi").
  "9134": "Petunjuk perbaikan permohonan (bila majelis memberi petunjuk)",
};
