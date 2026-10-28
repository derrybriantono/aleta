/**
 * Sidang ikrar talak di Jadwal Sidang (permintaan 18 Okt 2026) - aturan murni,
 * dipakai blangko tunda/putus dan diuji tanpa layar.
 *
 *   (a) Pemohon hadir tetapi belum siap membayar akibat perceraian:
 *       14 hari dari tanggal sidang, jam 09.00, ruang sama - dijepit ke batas
 *       6 bulan bila melewatinya.
 *   (b) Pemohon tidak hadir di sidang ikrar:
 *       sidang berikutnya = batas 6 bulan itu sendiri (penetapan hari sidang
 *       ikrar + 6 bulan), jam 09.00, ruang sama; jatuh di akhir pekan MUNDUR ke
 *       hari kerja (maju akan melewati tenggat).
 *
 * Batas ikrar 6 bulan: Pasal 70 ayat (6) UU 7/1989 (Buku II 2026 hlm. 654-656) -
 * dihitung SEJAK DITETAPKAN HARI SIDANG PENYAKSIAN IKRAR TALAK (kolom SIPP
 * perkara_ikrar_talak.tanggal_penetapan_sidang_ikrar), BUKAN dari BHT (keputusan
 * pengguna no. 91, 18 Okt 2026, mengganti "6 bulan dari BHT"). Tanpa tanggal itu
 * tenggatnya BELUM berjalan: batas = "" dan tidak ada cadangan BHT. Sidang tepat
 * pada tanggal batas masih sah (<= batas).
 */

export type JenisTundaIkrar = "belum-siap" | "tidak-hadir";

export const ALASAN_IKRAR_BELUM_SIAP = "Pemohon belum siap melaksanakan Ikrar Talak";
export const ALASAN_IKRAR_TIDAK_HADIR = "Pemohon tidak hadir Ikrar Talak";
export const AGENDA_IKRAR = "SIDANG IKRAR TALAK";
export const JAM_IKRAR_TUNDA = "09:00";
export const HARI_TUNDA_IKRAR_BELUM_SIAP = 14;
export const BULAN_TUNDA_IKRAR_TIDAK_HADIR = 6;

const POLA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function p2(n: number) {
  return String(n).padStart(2, "0");
}

function dariIso(iso: string) {
  const [t, b, h] = iso.split("-").map(Number);
  return new Date(t, b - 1, h);
}

function keIso(d: Date) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function tambahHariIso(iso: string, hari: number): string {
  if (!POLA_ISO.test(iso)) return "";
  const d = dariIso(iso);
  d.setDate(d.getDate() + hari);
  return keIso(d);
}

/** Tambah bulan kalender; 31 Agustus + 6 bulan = 28/29 Februari (hari terakhir bulan itu). */
export function tambahBulanIso(iso: string, bulan: number): string {
  if (!POLA_ISO.test(iso)) return "";
  const [t, b, h] = iso.split("-").map(Number);
  const d = new Date(t, b - 1 + bulan, h);
  if (d.getDate() !== h) d.setDate(0);
  return keIso(d);
}

/** Sabtu/Minggu bergeser ke Senin berikutnya (SIPP menolak sidang di akhir pekan). */
export function keHariKerja(iso: string): string {
  if (!POLA_ISO.test(iso)) return "";
  const d = dariIso(iso);
  const hari = d.getDay();
  if (hari === 6) d.setDate(d.getDate() + 2);
  if (hari === 0) d.setDate(d.getDate() + 1);
  return keIso(d);
}

/** Sabtu/Minggu mundur ke Jumat (dipakai bila maju akan melewati tenggat). */
export function mundurKeHariKerja(iso: string): string {
  if (!POLA_ISO.test(iso)) return "";
  const d = dariIso(iso);
  const hari = d.getDay();
  if (hari === 6) d.setDate(d.getDate() - 1);
  if (hari === 0) d.setDate(d.getDate() - 2);
  return keIso(d);
}

/**
 * Batas 6 bulan ikrar = penetapan hari sidang ikrar + 6 bulan kalender; "" bila hari
 * sidang ikrar belum ditetapkan. `tanggalBht` diterima agar pemanggil lama tetap
 * tersusun, tetapi SENGAJA diabaikan.
 */
export function batasEnamBulanIkrar(bahan: {
  tanggalPenetapanSidangIkrar?: string | null;
  tanggalBht?: string | null;
}): string {
  const dasar = String(bahan.tanggalPenetapanSidangIkrar || "").slice(0, 10);
  return POLA_ISO.test(dasar) ? tambahBulanIso(dasar, 6) : "";
}

export type BawaanTundaIkrar = {
  alasan: string;
  agenda: string;
  tanggal: string;
  jam: string;
  /** Kalimat untuk layar: dari mana tanggalnya. */
  penjelasan: string;
  /** true bila tanggal bergeser dari akhir pekan ke hari kerja, atau dijepit ke batas. */
  digeser: boolean;
  /** true bila tanggal bawaan tidak dapat disusun - tanggal harus diisi petugas. */
  perluDiisi: boolean;
};

/**
 * Menjaga bawaan agar tidak melampaui batas 6 bulan. Memulangkan bawaan kosong
 * (perluDiisi) bila tenggat sudah lewat dari tanggal sidang ini atau tidak ada
 * hari kerja sesudah sidang ini yang masih dalam batas; selain itu null.
 */
function tenggatHabis(sidang: string, batas: string, tanggal: string): string | null {
  if (!batas || !POLA_ISO.test(sidang)) return null;
  if (batas < sidang) {
    return `Tenggat 6 bulan ikrar (${batas}) sudah lewat dari tanggal sidang ini - kekuatan penetapan hari sidang ikrar gugur (Pasal 70 ayat (6) UU 7/1989); tidak ada sidang ikrar berikutnya yang sah. Periksa blangko [91].`;
  }
  if (tanggal && tanggal <= sidang) {
    return `Tenggat 6 bulan ikrar (${batas}) jatuh pada/tepat sesudah tanggal sidang ini - tidak ada hari kerja berikutnya yang masih dalam batas (Pasal 70 ayat (6) UU 7/1989). Isi tanggal secara manual atau periksa blangko [91].`;
  }
  return null;
}

export function bawaanTundaIkrar(
  jenis: JenisTundaIkrar,
  bahan: { tanggalSidang: string; tanggalBht?: string | null; tanggalPenetapanSidangIkrar?: string | null }
): BawaanTundaIkrar {
  const sidang = String(bahan.tanggalSidang || "").slice(0, 10);
  const batas = batasEnamBulanIkrar(bahan);
  const dasarBaku = { alasan: "", agenda: AGENDA_IKRAR, jam: JAM_IKRAR_TUNDA };

  if (jenis === "belum-siap") {
    const mentah = tambahHariIso(sidang, HARI_TUNDA_IKRAR_BELUM_SIAP);
    let tanggal = keHariKerja(mentah);
    let penjelasan = "14 hari dari tanggal sidang ini, pukul 09.00, ruang sama.";
    let digeser = Boolean(mentah && tanggal !== mentah);
    if (batas && tanggal > batas) {
      const jepit = mundurKeHariKerja(batas);
      const habis = tenggatHabis(sidang, batas, jepit);
      if (habis) {
        return { ...dasarBaku, alasan: ALASAN_IKRAR_BELUM_SIAP, tanggal: "", penjelasan: habis, digeser: false, perluDiisi: true };
      }
      penjelasan = `14 hari dari sidang ini (${tanggal}) melewati batas 6 bulan ikrar (${batas}); tanggal dijepit ke ${jepit}, hari kerja terakhir dalam batas, pukul 09.00, ruang sama.`;
      tanggal = jepit;
      digeser = true;
    }
    return {
      ...dasarBaku,
      alasan: ALASAN_IKRAR_BELUM_SIAP,
      tanggal,
      penjelasan,
      digeser,
      perluDiisi: !tanggal,
    };
  }

  if (!batas) {
    return {
      ...dasarBaku,
      alasan: ALASAN_IKRAR_TIDAK_HADIR,
      tanggal: "",
      penjelasan: "Hari sidang ikrar belum ditetapkan - tenggat 6 bulan belum berjalan; isi tanggal sidang ikrar berikutnya.",
      digeser: false,
      perluDiisi: true,
    };
  }
  const tanggal = mundurKeHariKerja(batas);
  const habis = tenggatHabis(sidang, batas, tanggal);
  if (habis) {
    return { ...dasarBaku, alasan: ALASAN_IKRAR_TIDAK_HADIR, tanggal: "", penjelasan: habis, digeser: false, perluDiisi: true };
  }
  return {
    ...dasarBaku,
    alasan: ALASAN_IKRAR_TIDAK_HADIR,
    tanggal,
    penjelasan:
      tanggal === batas
        ? `Batas 6 bulan sejak penetapan hari sidang ikrar (${batas}), pukul 09.00, ruang sama.`
        : `Batas 6 bulan sejak penetapan hari sidang ikrar (${batas}) jatuh di akhir pekan - dimundurkan ke hari kerja ${tanggal} agar tidak melewati tenggat, pukul 09.00, ruang sama.`,
    digeser: tanggal !== batas,
    perluDiisi: false,
  };
}

/** Peringatan bila tanggal berikutnya melewati batas 6 bulan ikrar; "" bila aman/tak terhitung. */
export function peringatanBatasIkrar(
  tanggalBerikut: string,
  bahan: { tanggalPenetapanSidangIkrar?: string | null; tanggalBht?: string | null }
): string {
  // Tanpa hari sidang ikrar yang ditetapkan, tenggat belum berjalan: tidak ada peringatan.
  const batas = batasEnamBulanIkrar(bahan);
  if (!batas || !POLA_ISO.test(tanggalBerikut)) return "";
  if (tanggalBerikut <= batas) return "";
  return `Tanggal ${tanggalBerikut} melewati batas 6 bulan ikrar (${batas}). Menurut Pasal 70 ayat (6) UU No. 7 Tahun 1989, bila dalam 6 bulan sejak hari sidang ikrar ditetapkan Pemohon tidak datang, kekuatan penetapan gugur.`;
}

/** Hasil sidang / keterangan yang menyatakan ikrar SUDAH dilaksanakan (selaras dengan bot). */
export function ikrarTerlaksanaMenurutTeks(teks: string | null | undefined): boolean {
  const t = String(teks || "").trim();
  if (!t || !/\bikrar\b/i.test(t)) return false;
  return !/\b(belum|tidak|tunda|ditunda|menunggu|panggil|gugur|batal)\b/i.test(t);
}

/**
 * ============================================================================
 * TIGA STATUS PENETAPAN IKRAR (P1/P2/P7, 28 Okt 2026) - CERMIN BOT
 * ============================================================================
 *
 * Teks hasil sidang per status SAMA dengan aleta_bot/services/ikrarTalakService.js
 * STATUS_IKRAR (dijaga uji ikrar-putus-menu-28okt). Status 2/3 tidak pernah
 * terbaca ikrar terlaksana (memuat "tidak"/"gugur" atau tanpa kata "ikrar").
 */
export type StatusIkrar = 1 | 2 | 3;
export const STATUS_IKRAR: Record<StatusIkrar, { nama: string; hasil: string; label: string }> = {
  1: { nama: "Diikrarkan", hasil: "telah ikrar talak", label: "Ikrar telah dilaksanakan" },
  2: { nama: "Pemohon Tidak Hadir", hasil: "Pemohon tidak hadir, ikrar talak gugur", label: "Pemohon tidak hadir - kekuatan putusan gugur" },
  3: { nama: "Rukun Kembali", hasil: "Pemohon dan Termohon rukun kembali", label: "Rukun kembali - Pemohon tidak mengucapkan ikrar" },
};
/** P2: "Pemohon Tidak Hadir" baru boleh pada sidang ikrar terakhir yang masih mungkin (batas - 14 hari). */
export const HARI_SEBELUM_BATAS_GUGUR = 14;

/**
 * Pilihan status yang tersedia di tombol PUTUS sidang ikrar. Murni.
 *   1 selalu (bawaan); 2 bila peran boleh (P7) + Pemohon tidak hadir (3/4) + sidang >= batas - 14 hari;
 *   3 bila peran boleh (P7) + Pemohon hadir (1/2).
 */
export function pilihanStatusIkrar(bahan: {
  bolehStatusBerat: boolean;
  dihadiriOleh?: number | null;
  tanggalSidang?: string | null;
  tanggalPenetapanSidangIkrar?: string | null;
}): { status: StatusIkrar[]; batas: string; awalGugur: string } {
  const batas = batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar: bahan.tanggalPenetapanSidangIkrar });
  const awalGugur = batas ? tambahHariIso(batas, -HARI_SEBELUM_BATAS_GUGUR) : "";
  const h = Number(bahan.dihadiriOleh);
  const tgl = String(bahan.tanggalSidang ?? "").slice(0, 10);
  const status: StatusIkrar[] = [1];
  if (bahan.bolehStatusBerat && (h === 3 || h === 4) && awalGugur && tgl >= awalGugur) status.push(2);
  if (bahan.bolehStatusBerat && (h === 1 || h === 2)) status.push(3);
  return { status, batas, awalGugur };
}
