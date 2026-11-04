/**
 * Teks layar untuk sinkron rekening e-Court (4 Nov 2026): sebab gagal dan status putaran dalam bahasa petugas,
 * tanpa kode teknis. Murni - dipakai kartu di Integrasi e-Court dan diuji tanpa peramban.
 */

/** Sebab gagal (kode dari bot) -> kalimat. Kode tak dikenal = kalimat umum, bukan kodenya. */
export function sebabRekeningTeks(sebab: string): string {
  const s = String(sebab || "").trim();
  if (!s) return "sebab tidak tercatat";
  if (s === "kunci_penyandian_tidak_tersedia") return "kunci penyimpanan aman di server belum tersedia, nomor rekening tidak disimpan";
  if (s === "halaman_bukan_perkara") return "e-Court tidak menampilkan halaman perkara";
  if (s === "tidak_ada_di_daftar_ecourt") return "perkara tidak ditemukan di daftar e-Court";
  if (s === "gagal_beruntun") return "berhenti karena gagal beruntun";
  if (s === "melewati_batas_waktu") return "berhenti karena melewati batas waktu putaran";
  if (s === "daftar_perkara_sipp_tidak_terbaca") return "daftar perkara e-Court dari SIPP tidak terbaca";
  if (s === "daftar_perkara_ecourt_tidak_terbaca") return "daftar perkara di e-Court tidak terbaca";
  if (/^galat_peramban/.test(s)) return "halaman e-Court gagal dibuka";
  if (/^galat_baca/.test(s)) return "halaman e-Court gagal dibaca";
  if (/^simpan_gagal/.test(s)) return "hasil bacaan gagal disimpan";
  if (/sesi/i.test(s)) return "sesi e-Court habis, perlu masuk ulang";
  return "penarikan e-Court berhenti sebelum selesai";
}

/** Status satu putaran sinkron -> label ringkas. */
export function statusPutaranTeks(status: string): string {
  switch (String(status || "")) {
    case "selesai":
      return "Selesai";
    case "dihentikan":
      return "Berhenti sebelum selesai";
    case "sesi_habis":
      return "Sesi e-Court habis";
    case "gagal":
      return "Gagal";
    default:
      return "Tidak diketahui";
  }
}

/** Asal putaran -> label. */
export function sumberPutaranTeks(sumber: string): string {
  return String(sumber || "") === "portal-rekening" ? "Tombol Sinkron rekening" : "Otomatis bersama penarikan berkala";
}
