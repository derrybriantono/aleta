/**
 * ============================================================================
 * PENANDA MEDIASI DI KOLOM AGENDA JADWAL SIDANG (6 Okt 2026, butir 7-9)
 * ============================================================================
 *
 *   mediator      kedua belah pihak HADIR PERTAMA KALI pada sidang ini - saat
 *                 majelis wajib memerintahkan mediasi dan menunjuk mediator
 *                 (PERMA 1/2016). Hanya perkara gugatan (bukan gugatan
 *                 sederhana), dan hanya bila mediator belum ditunjuk sebelum
 *                 hari sidang ini. Penanda ini HANYA di sini.
 *   hasil mediasi hanya pada agenda laporan/hasil mediasi - lima hasil SIPP,
 *                 berwarna menurut artinya (hijau berhasil, ... merah tidak
 *                 berhasil, abu tidak dapat dilaksanakan).
 *   Mediasi       perkara ini pernah bermediasi (mediator ditunjuk pada atau
 *                 sebelum hari sidang ini). Tidak pernah = tanpa penanda.
 *
 * "Hadir pertama kali" dibaca dari dua sumber:
 *   1. SIPP: dihadiri_oleh = 1 ("Semua Pihak") - tanggal sidang PERTAMA yang
 *      demikian sama dengan tanggal sidang baris ini;
 *   2. hari ini, sebelum hasil sidangnya dicatat: pihak kesatu DAN kedua sudah
 *      mengambil nomor antrian (waktu ambil per sisi di mesin antrian), dan SIPP
 *      belum pernah mencatat keduanya hadir.
 */

export type MediasiPerkara = {
  ditunjuk: string;
  dimulai: string;
  hasil: string;
  keputusan: string;
  mediator: string;
};

export type BarisMediasi = {
  nomorPerkara: string;
  tanggalSidang: string;
  agenda?: string;
  mediasi?: MediasiPerkara | null;
  mediasiTerbaca?: boolean;
  hadirLengkapPertama?: string;
  hadirLengkapTerbaca?: boolean;
};

export type PenandaMediasi = { kunci: string; label: string; kelas: string; keterangan: string };

/** Agenda laporan hasil mediasi - "Laporan hasil mediasi", "Mendengarkan hasil mediasi", "laporan mediasi", ... ; BUKAN "proses mediasi". */
export function agendaLaporanMediasi(agenda: string | undefined | null): boolean {
  return /(laporan|hasil)\s+(hasil\s+)?mediasi/i.test(String(agenda ?? ""));
}

/** Perkara gugatan yang wajib mediasi - bukan permohonan, bukan gugatan sederhana. */
export function perkaraWajibMediasi(nomorPerkara: string): boolean {
  return /\/Pdt\.G\//i.test(String(nomorPerkara || ""));
}

const tgl = (x: string | undefined | null) => String(x ?? "").slice(0, 10);

/** Mediator perkara ini ditunjuk (atau mediasinya dimulai) pada/sebelum tanggal itu. */
function mediasiSejak(m: MediasiPerkara | null | undefined, tanggal: string): string {
  if (!m) return "";
  const awal = [tgl(m.ditunjuk), tgl(m.dimulai)].filter(Boolean).sort()[0] ?? "";
  return awal && awal <= tanggal ? awal : "";
}

/** Butir 9: pernah mediasi (pada atau sebelum hari sidang ini). */
export function penandaPernahMediasi(baris: BarisMediasi): PenandaMediasi | null {
  if (baris.mediasiTerbaca === false) return null;
  const sejak = mediasiSejak(baris.mediasi, tgl(baris.tanggalSidang));
  if (!sejak) return null;
  const m = baris.mediasi!;
  return {
    kunci: "mediasi",
    label: "Mediasi",
    kelas: "bg-sky-100 text-sky-900 ring-1 ring-sky-300 dark:bg-sky-900/60 dark:text-sky-100 dark:ring-sky-700",
    keterangan: `Perkara ini pernah bermediasi - mediator ditunjuk ${sejak}${m.mediator ? ` (${m.mediator})` : ""}${
      HASIL[m.hasil] ? `; hasil: ${HASIL[m.hasil].label}` : m.hasil ? "" : "; hasil belum dicatat"
    }.`,
  };
}

const HASIL: Record<string, { label: string; kelas: string }> = {
  Y: { label: "berhasil dengan perdamaian", kelas: "bg-emerald-600 text-white" },
  Y1: { label: "berhasil dengan perdamaian", kelas: "bg-emerald-600 text-white" },
  S: { label: "berhasil sebagian", kelas: "bg-lime-500 text-lime-950" },
  Y2: { label: "berhasil dengan pencabutan", kelas: "bg-teal-600 text-white" },
  T: { label: "tidak berhasil", kelas: "bg-rose-600 text-white" },
  D: { label: "tidak dapat dilaksanakan", kelas: "bg-slate-500 text-white" },
};

/** Butir 8: hasil mediasi - hanya pada agenda laporan hasil mediasi. */
export function penandaHasilMediasi(baris: BarisMediasi): PenandaMediasi | null {
  if (baris.mediasiTerbaca === false) return null;
  if (!agendaLaporanMediasi(baris.agenda)) return null;
  const m = baris.mediasi;
  if (!m) return null;
  const h = HASIL[m.hasil];
  if (!h) {
    return {
      kunci: "hasil-mediasi-belum",
      label: "hasil mediasi belum dicatat",
      kelas: "bg-amber-100 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-900/50 dark:text-amber-100 dark:ring-amber-700",
      keterangan: "Agenda laporan hasil mediasi, tetapi hasil mediasinya belum dicatat di SIPP.",
    };
  }
  return {
    kunci: `hasil-mediasi-${m.hasil.toLowerCase()}`,
    label: `mediasi ${h.label}`,
    kelas: h.kelas,
    keterangan: `Hasil mediasi menurut SIPP: ${h.label}${m.keputusan ? ` (diputus ${m.keputusan})` : ""}${
      m.mediator ? `, mediator ${m.mediator}` : ""
    }.`,
  };
}

/** Butir 7: kedua belah pihak hadir pertama kali - perlu mediator. */
export function penandaMediator(
  baris: BarisMediasi,
  hadirHariIni: { pihak1?: string; pihak2?: string } | null | undefined,
  hariIni: string
): PenandaMediasi | null {
  if (!perkaraWajibMediasi(baris.nomorPerkara)) return null;
  if (baris.hadirLengkapTerbaca === false || baris.mediasiTerbaca === false) return null;
  const tanggal = tgl(baris.tanggalSidang);
  // Mediator sudah ditunjuk SEBELUM hari ini: kehadiran pertamanya sudah lewat.
  const sejak = mediasiSejak(baris.mediasi, tanggal);
  if (sejak && sejak < tanggal) return null;

  const pertama = tgl(baris.hadirLengkapPertama);
  let sumber = "";
  if (pertama && pertama === tanggal) {
    sumber = "SIPP mencatat kedua belah pihak hadir pada sidang ini - untuk pertama kalinya.";
  } else if (!pertama || pertama > tanggal) {
    const keduanya = Boolean(hadirHariIni?.pihak1) && Boolean(hadirHariIni?.pihak2);
    if (tanggal === hariIni && keduanya) {
      sumber = `Pihak kesatu (${hadirHariIni!.pihak1}) dan kedua (${hadirHariIni!.pihak2}) sudah mengambil nomor antrian hari ini, dan SIPP belum pernah mencatat keduanya hadir.`;
    }
  }
  if (!sumber) return null;
  return {
    kunci: "mediator",
    label: "mediator",
    kelas: "bg-fuchsia-600 text-white",
    keterangan: `${sumber} Mediasi wajib diperintahkan dan mediator ditunjuk (PERMA 1/2016).`,
  };
}
