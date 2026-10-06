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
 */

export type RencanaCourtCalendar = { tanggal: string; agenda: string };

export type BarisCourtCalendar = {
  tanggalSidang: string;
  agenda?: string;
  lewatEcourt?: boolean;
  urutanSidang?: number;
  courtCalendar?: RencanaCourtCalendar[];
  courtCalendarTerbaca?: boolean;
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

/** null = bukan perkara e-Litigasi / data tidak terbaca - tanpa penanda. */
export function keadaanCourtCalendar(baris: BarisCourtCalendar): KeadaanCourtCalendar | null {
  if (!baris.lewatEcourt) return null;
  if (!(Number(baris.urutanSidang) > 1)) return null;
  if (baris.courtCalendarTerbaca !== true) return null;
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
