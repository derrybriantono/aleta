/**
 * ============================================================================
 * COURT CALENDAR TIDAK SINKRON DENGAN AGENDA SIDANG (6 Okt 2026, butir 21)
 * ============================================================================
 *
 * Khusus perkara e-Litigasi (terdaftar e-Court, sesudah sidang pertama -
 * persetujuan bersidang elektronik baru diketahui pada sidang pertama): Court
 * Calendar adalah jadwal yang dipegang para pihak di e-Court, jadi sidang yang
 * tidak ada di sana - atau tujuannya berbeda - berarti pihak membaca jadwal
 * yang salah.
 *
 * "Tidak harus kalimatnya sama, yang penting tujuannya sama" (pengguna): agenda
 * keduanya ditulis bebas ("jawaban Tergugat" / "Jawaban dari Termohon",
 * "Pemeriksaan Pokok Perkara (Putus Verstek)", "Sidang kedua"...), maka yang
 * dibandingkan TAHAPANNYA. Agenda yang hanya menyebut urutan ("Sidang kedua")
 * atau tidak dikenali tidak dapat dinilai, dan TIDAK dituduh - penanda merah
 * hanya bila ketidaksinkronannya terbukti.
 *
 *   sinkron       ada rencana pada tanggal sidang itu dan tahapannya beririsan
 *                 (atau salah satunya tidak dapat dinilai)
 *   tidak sinkron (a) Court Calendar perkara ini belum dibuat sama sekali;
 *                 (b) tidak ada rencana pada tanggal sidang itu;
 *                 (c) ada rencana pada tanggal itu, tetapi tahapannya berbeda.
 *
 * ============================================================================
 * KAPAN COURT CALENDAR BOLEH DIPERIKSA (perbaikan 6 Okt 2026 sore)
 * ============================================================================
 *
 * "Court calendar ada setelah tundaan setelah agenda sidang laporan hasil
 * mediasi" (pengguna). Jadi sebelum itu Court Calendar yang kosong atau tidak
 * memuat tanggal sidang BUKAN kesalahan. Diukur atas server 6 Okt 2026: 9
 * perkara menyala merah, seluruhnya keliru - verstek yang Tergugatnya tidak
 * pernah hadir (549, 555, 481), sidang mediasi/laporan mediasi itu sendiri
 * (553, 561), ikrar sesudah putus verstek (462), permohonan tanpa mediasi
 * (225, 226 Pdt.P). Sidang baru dinilai bila SELURUHNYA terpenuhi:
 *
 *   (a) kedua belah pihak pernah hadir lengkap (dihadiri_oleh = 1) pada
 *       sidang SEBELUM sidang ini - hadirLengkapPertama;
 *   (b) ada jangkar laporan hasil mediasi SEBELUM tanggal sidang ini:
 *       - laporan mediator tercatat (perkara_mediasi.hasil_mediasi terisi;
 *         tanggalnya tgl_laporan_mediator, cadangannya keputusan_mediasi), atau
 *       - sidang sebelumnya beragenda laporan hasil mediasi - dan karena ada
 *         sidang ini sesudahnya, sidang itu sudah ditunda;
 *   (c) sidang ini sendiri bukan sidang mediasi / laporan hasil mediasi (itu
 *       sidang yang MELAHIRKAN Court Calendar) dan bukan sidang ikrar talak
 *       (sesudah putusan - di luar Court Calendar);
 *   (d) seluruh datanya terbaca. Yang tidak terbaca (bot lama, kueri gagal)
 *       = diam, tidak dituduh.
 *
 * Yang tidak memenuhi: tanpa penanda dan tidak masuk kotak merah.
 */

export type RencanaCourtCalendar = { tanggal: string; agenda: string };

export type BarisCourtCalendar = {
  tanggalSidang: string;
  agenda?: string;
  lewatEcourt?: boolean;
  urutanSidang?: number;
  courtCalendar?: RencanaCourtCalendar[];
  courtCalendarTerbaca?: boolean;
  /** Tanggal sidang pertama yang dihadiri kedua belah pihak ("" = belum pernah). */
  hadirLengkapPertama?: string;
  hadirLengkapTerbaca?: boolean;
  /** Mediasi terakhir perkara ini; hasil terisi = laporan mediator sudah ada. */
  mediasi?: { hasil?: string; keputusan?: string; laporan?: string } | null;
  mediasiTerbaca?: boolean;
  /** Tanggal sidang paling awal yang beragenda laporan hasil mediasi ("" = tidak ada). */
  sidangLaporanMediasi?: string;
  sidangLaporanMediasiTerbaca?: boolean;
  sidangIkrarTalak?: boolean;
};

/** Tahapan yang dikenali, dari yang paling khas ke yang paling umum. */
const TAHAP: Array<[string, RegExp]> = [
  ["laporan-mediasi", /(laporan|hasil)\s+(hasil\s+)?medias/i],
  ["mediasi", /medias|mediator/i],
  ["ikrar", /ikrar/i],
  ["jawaban", /jawab/i],
  ["replik", /replik/i],
  ["duplik", /duplik/i],
  ["pembuktian", /pembukti|bukti|saksi/i],
  ["kesimpulan", /kesimpulan/i],
  ["musyawarah", /musyawarah/i],
  ["putusan", /putus|penetapan|pengucapan|pembacaan\s+(putusan|penetapan)/i],
  ["pokok", /pokok\s+perkara|baca\s+gugatan|pembacaan\s+gugatan|perbaikan\s+gugatan/i],
  ["sidang-pertama", /sidang\s+pertama|identitas|penasihatan|penasehatan|upaya\s+damai/i],
  ["panggil", /panggil/i],
];

/** Tahapan yang disebut satu agenda; kosong = tidak dapat dinilai ("Sidang kedua", tulisan lain). */
export function tahapAgenda(agenda: string | undefined | null): Set<string> {
  const teks = String(agenda ?? "");
  const hasil = new Set<string>();
  for (const [kunci, pola] of TAHAP) if (pola.test(teks)) hasil.add(kunci);
  // "laporan hasil mediasi" bukan sekadar mediasi berjalan.
  if (hasil.has("laporan-mediasi")) hasil.delete("mediasi");
  return hasil;
}

/** Dua agenda bertujuan sama? Yang tidak dapat dinilai dianggap sama (tidak dituduh). */
export function agendaSetujuan(a: string, b: string): boolean {
  const ta = tahapAgenda(a);
  const tb = tahapAgenda(b);
  if (ta.size === 0 || tb.size === 0) return true;
  for (const x of ta) if (tb.has(x)) return true;
  // Pembacaan putusan dan musyawarah sering ditulis berganti untuk sidang yang sama.
  if ((ta.has("putusan") && tb.has("musyawarah")) || (ta.has("musyawarah") && tb.has("putusan"))) return true;
  return false;
}

export type KeadaanCourtCalendar = { sinkron: boolean; sebab: string };

const iso = (x: unknown) => {
  const t = String(x ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
};

/**
 * Jangkar laporan hasil mediasi SEBELUM tanggal sidang ini ("" = belum ada) -
 * syarat (b) di atas. Yang paling awal dipakai.
 */
export function jangkarLaporanMediasi(baris: BarisCourtCalendar): string {
  const tanggal = iso(baris.tanggalSidang);
  if (!tanggal) return "";
  const calon: string[] = [];
  const m = baris.mediasi;
  if (baris.mediasiTerbaca === true && m && String(m.hasil ?? "").trim()) {
    calon.push(iso(m.laporan) || iso(m.keputusan));
  }
  if (baris.sidangLaporanMediasiTerbaca === true) calon.push(iso(baris.sidangLaporanMediasi));
  const sah = calon.filter((t) => t && t < tanggal).sort();
  return sah[0] ?? "";
}

/**
 * Court Calendar sidang ini boleh dinilai? Lihat "KAPAN COURT CALENDAR BOLEH
 * DIPERIKSA" di atas. false = tanpa penanda, tidak masuk kotak merah.
 */
export function courtCalendarDapatDiperiksa(baris: BarisCourtCalendar): boolean {
  const tanggal = iso(baris.tanggalSidang);
  if (!tanggal) return false;
  // (a) pernah hadir lengkap sebelum sidang ini.
  if (baris.hadirLengkapTerbaca !== true) return false;
  const hadir = iso(baris.hadirLengkapPertama);
  if (!hadir || hadir >= tanggal) return false;
  // (c) sidang mediasi / laporan mediasi / ikrar tidak dinilai.
  const tahap = tahapAgenda(baris.agenda);
  if (tahap.has("mediasi") || tahap.has("laporan-mediasi") || tahap.has("ikrar")) return false;
  if (baris.sidangIkrarTalak === true) return false;
  // (b) sesudah laporan hasil mediasi.
  return jangkarLaporanMediasi(baris) !== "";
}

/** null = bukan perkara e-Litigasi / belum waktunya diperiksa / data tidak terbaca - tanpa penanda. */
export function keadaanCourtCalendar(baris: BarisCourtCalendar): KeadaanCourtCalendar | null {
  if (!baris.lewatEcourt) return null;
  if (!(Number(baris.urutanSidang) > 1)) return null;
  if (baris.courtCalendarTerbaca !== true) return null;
  if (!courtCalendarDapatDiperiksa(baris)) return null;
  const tanggal = String(baris.tanggalSidang ?? "").slice(0, 10);
  const daftar = Array.isArray(baris.courtCalendar) ? baris.courtCalendar : [];
  if (daftar.length === 0) {
    return { sinkron: false, sebab: "Court Calendar perkara e-Litigasi ini belum dibuat - para pihak tidak punya jadwal di e-Court." };
  }
  const hariItu = daftar.filter((r) => String(r.tanggal).slice(0, 10) === tanggal);
  if (hariItu.length === 0) {
    const terdekat = daftar.map((r) => r.tanggal).filter(Boolean).join(", ");
    return {
      sinkron: false,
      sebab: `Tidak ada rencana Court Calendar pada tanggal sidang ini (${tanggal}). Rencana yang ada: ${terdekat || "-"}.`,
    };
  }
  if (hariItu.some((r) => agendaSetujuan(r.agenda, baris.agenda ?? ""))) {
    return { sinkron: true, sebab: `Sesuai Court Calendar: "${hariItu[0].agenda}".` };
  }
  return {
    sinkron: false,
    sebab: `Agenda sidang "${baris.agenda ?? ""}" berbeda tujuan dengan Court Calendar pada tanggal itu: "${hariItu
      .map((r) => r.agenda)
      .join('", "')}".`,
  };
}

/** Penanda merah: hanya yang terbukti tidak sinkron. */
export function courtCalendarTidakSinkron(baris: BarisCourtCalendar): boolean {
  const k = keadaanCourtCalendar(baris);
  return Boolean(k && !k.sinkron);
}
