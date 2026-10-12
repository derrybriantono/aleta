/**
 * ============================================================================
 * PENANDA "PERNAH DISKORS" (12 Okt 2026, butir 25 - agen L)
 * ============================================================================
 *
 * Lencana "diskors" yang lama (LencanaDiskors) hanya muncul selama sidangnya
 * MASIH diskors: begitu perkara dipanggil lagi atau ditandai selesai ia hilang,
 * dan tidak ada jejak bahwa sidang itu pernah terputus - padahal panitera yang
 * membuat berita acara perlu tahu. Penanda ini tetap ada:
 *
 *   (a) sidang pada tanggal baris ini pernah diskors - walau sekarang sudah
 *       berjalan lagi atau selesai ("Diskors HH:MM" bila tanggal itu hari ini);
 *   (b) sidang SEBELUMNYA perkara ini pernah diskors ("Pernah diskors").
 *
 * Sumbernya tabel aleta_bot_sidang_skors milik bot, yang tidak pernah
 * menghapus: tiap skors satu baris dan melanjutkan hanya mengisi
 * dilanjutkan_pada. Bot memulangkan riwayatnya di `riwayatSkors` pada
 * GET /sidang/selesai (jendela 400 hari). Bot lama (tanpa ruas itu) tetap
 * memberi penanda untuk skors yang masih berlaku lewat peta `skors` biasa.
 *
 * Fungsi murni - diuji di src/test/pernah-diskors-12okt.test.tsx.
 */
import type { CatatanSkors } from "@/lib/jadwal-sidang-2okt";

/** Satu skors dari riwayat bot. Waktu berbentuk "YYYY-MM-DD HH:MM:SS". */
export type RiwayatSkorsItem = {
  tanggalSidang: string;
  diskorsPada?: string;
  /** Kosong = belum dilanjutkan. */
  dilanjutkanPada?: string;
  alasan?: string;
  oleh?: string;
};

/** perkaraId -> riwayat skors, dari yang terlama ke yang terbaru. */
export type PetaRiwayatSkors = Record<string, RiwayatSkorsItem[]>;

export type PenandaPernahDiskors = {
  /** Teks pendek di bawah tombol Selesai. */
  label: string;
  /** Keterangan lengkap (title). */
  keterangan: string;
  /** Skors terjadi pada tanggal sidang baris ini. */
  hariSidangIni: boolean;
};

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function rapi(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/** "2026-10-05" -> "5 Okt 2026". Selain bentuk itu dikembalikan apa adanya. */
export function tanggalSingkat(tanggal: string): string {
  const c = /^(\d{4})-(\d{2})-(\d{2})/.exec(rapi(tanggal));
  if (!c) return rapi(tanggal);
  return `${Number(c[3])} ${BULAN[Number(c[2]) - 1] ?? c[2]} ${c[1]}`;
}

/** "HH:MM" dari "YYYY-MM-DD HH:MM:SS" atau "HH:MM". */
function jam(teks: string | undefined): string {
  const c = /(\d{1,2}):(\d{2})/.exec(rapi(teks));
  return c ? `${c[1].padStart(2, "0")}:${c[2]}` : "";
}

function menitAntara(dari: string, sampai: string): number | null {
  const p = (t: string) => {
    const c = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(rapi(t));
    return c ? Date.UTC(Number(c[1]), Number(c[2]) - 1, Number(c[3]), Number(c[4]), Number(c[5])) : null;
  };
  const a = p(dari);
  const b = p(sampai);
  if (a === null || b === null || b < a) return null;
  return Math.round((b - a) / 60000);
}

/** 25 -> "25 menit"; 95 -> "1 jam 35 menit"; 0 -> "kurang dari semenit". */
export function lamaSingkat(menit: number): string {
  if (menit <= 0) return "kurang dari semenit";
  if (menit < 60) return `${menit} menit`;
  const j = Math.floor(menit / 60);
  const m = menit % 60;
  return m ? `${j} jam ${m} menit` : `${j} jam`;
}

function kalimatSkors(s: RiwayatSkorsItem, hariIni: string): string {
  const awal = s.tanggalSidang === hariIni ? "hari ini" : `tanggal ${tanggalSingkat(s.tanggalSidang)}`;
  const j = jam(s.diskorsPada);
  const bagian = [`Sidang ${awal} diskors${j ? ` pukul ${j}` : ""}`];
  const diskors = rapi(s.diskorsPada);
  const lanjut = rapi(s.dilanjutkanPada);
  if (lanjut) {
    const menit = diskors ? menitAntara(diskors, lanjut) : null;
    bagian.push(`dilanjutkan${jam(lanjut) ? ` pukul ${jam(lanjut)}` : ""}${menit !== null ? ` (diskors ${lamaSingkat(menit)})` : ""}`);
  } else {
    bagian.push("belum dilanjutkan");
  }
  if (rapi(s.alasan)) bagian.push(`catatan: ${rapi(s.alasan)}`);
  if (rapi(s.oleh)) bagian.push(`oleh ${rapi(s.oleh)}`);
  return `${bagian.join(", ")}.`;
}

/**
 * Penanda "pernah diskors" untuk satu baris jadwal, atau null bila sidang itu
 * maupun sidang sebelumnya tidak pernah diskors.
 *
 * @param riwayat  riwayat dari bot (boleh kosong untuk bot lama)
 * @param aktif    catatan skors yang BERLAKU untuk baris ini (peta `skors` lama) -
 *                 cadangan bagi bot yang belum memulangkan riwayat
 * @param hariIni  "YYYY-MM-DD" hari ini menurut peramban/bot
 */
export function penandaPernahDiskors(opsi: {
  riwayat: PetaRiwayatSkors | null | undefined;
  aktif?: CatatanSkors | null;
  baris: { perkaraId: string | number; tanggalSidang: string };
  hariIni: string;
}): PenandaPernahDiskors | null {
  const id = rapi(opsi.baris.perkaraId);
  const tanggal = rapi(opsi.baris.tanggalSidang).slice(0, 10);
  const daftar: RiwayatSkorsItem[] = [...(opsi.riwayat?.[id] ?? [])].map((x) => ({
    ...x,
    tanggalSidang: rapi(x.tanggalSidang).slice(0, 10),
  }));

  // Bot lama: skors yang masih berlaku tetap dihitung.
  const aktif = opsi.aktif;
  if (aktif && !daftar.some((x) => x.tanggalSidang === tanggal && rapi(x.diskorsPada) === rapi(aktif.diskorsPada))) {
    daftar.push({
      tanggalSidang: rapi(aktif.tanggalSidang).slice(0, 10) || tanggal,
      diskorsPada: aktif.diskorsPada,
      alasan: aktif.alasan,
      oleh: aktif.oleh,
    });
  }

  // Hanya sidang pada atau sebelum tanggal baris ini; urut dari yang terlama.
  const relevan = daftar
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.tanggalSidang) && x.tanggalSidang <= tanggal)
    .sort((a, b) => (a.tanggalSidang + rapi(a.diskorsPada)).localeCompare(b.tanggalSidang + rapi(b.diskorsPada)));
  if (relevan.length === 0) return null;

  const sehari = relevan.filter((x) => x.tanggalSidang === tanggal);
  const terbaru = sehari[sehari.length - 1];
  const hariSidangIni = sehari.length > 0;
  const label =
    hariSidangIni && tanggal === opsi.hariIni && jam(terbaru.diskorsPada) ? `Diskors ${jam(terbaru.diskorsPada)}` : "Pernah diskors";

  // Terbaru dulu di keterangan; paling banyak empat kalimat.
  const keterangan = [...relevan]
    .reverse()
    .slice(0, 4)
    .map((x) => kalimatSkors(x, opsi.hariIni))
    .join("\n");
  return { label, keterangan, hariSidangIni };
}
