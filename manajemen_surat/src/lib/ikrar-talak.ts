/**
 * Sidang ikrar talak di Jadwal Sidang (permintaan 18 Okt 2026) - aturan murni,
 * dipakai blangko tunda/putus dan diuji tanpa layar.
 *
 *   (a) Pemohon hadir tetapi belum siap membayar akibat perceraian:
 *       14 hari dari tanggal sidang, jam 09.00, ruang sama.
 *   (b) Pemohon tidak hadir di sidang ikrar:
 *       6 bulan dari tanggal BHT, jam 09.00, ruang sama.
 *
 * Batas ikrar 6 bulan: Pasal 70 ayat (6) UU 7/1989 - dihitung sejak ditetapkan
 * hari sidang penyaksian ikrar talak; tanpa tanggal itu, dari tanggal BHT.
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

export function batasEnamBulanIkrar(bahan: {
  tanggalPenetapanSidangIkrar?: string | null;
  tanggalBht?: string | null;
}): string {
  const dasar =
    String(bahan.tanggalPenetapanSidangIkrar || "").slice(0, 10) || String(bahan.tanggalBht || "").slice(0, 10);
  return POLA_ISO.test(dasar) ? tambahBulanIso(dasar, 6) : "";
}

export type BawaanTundaIkrar = {
  alasan: string;
  agenda: string;
  tanggal: string;
  jam: string;
  /** Kalimat untuk layar: dari mana tanggalnya. */
  penjelasan: string;
  /** true bila tanggal bergeser dari akhir pekan ke Senin. */
  digeser: boolean;
  /** true bila tanggal dasar (BHT) tidak terbaca - tanggal harus diisi petugas. */
  perluDiisi: boolean;
};

export function bawaanTundaIkrar(
  jenis: JenisTundaIkrar,
  bahan: { tanggalSidang: string; tanggalBht?: string | null }
): BawaanTundaIkrar {
  const sidang = String(bahan.tanggalSidang || "").slice(0, 10);
  if (jenis === "belum-siap") {
    const mentah = tambahHariIso(sidang, HARI_TUNDA_IKRAR_BELUM_SIAP);
    const tanggal = keHariKerja(mentah);
    return {
      alasan: ALASAN_IKRAR_BELUM_SIAP,
      agenda: AGENDA_IKRAR,
      tanggal,
      jam: JAM_IKRAR_TUNDA,
      penjelasan: "14 hari dari tanggal sidang ini, pukul 09.00, ruang sama.",
      digeser: Boolean(mentah && tanggal !== mentah),
      perluDiisi: !tanggal,
    };
  }
  const bht = String(bahan.tanggalBht || "").slice(0, 10);
  const mentah = bht ? tambahBulanIso(bht, BULAN_TUNDA_IKRAR_TIDAK_HADIR) : "";
  const tanggal = keHariKerja(mentah);
  return {
    alasan: ALASAN_IKRAR_TIDAK_HADIR,
    agenda: AGENDA_IKRAR,
    tanggal,
    jam: JAM_IKRAR_TUNDA,
    penjelasan: bht
      ? "6 bulan dari tanggal BHT, pukul 09.00, ruang sama."
      : "Tanggal BHT tidak terbaca di SIPP - isi tanggal sidang ikrar berikutnya (bawaan: 6 bulan dari BHT).",
    digeser: Boolean(mentah && tanggal !== mentah),
    perluDiisi: !tanggal,
  };
}

/** Peringatan bila tanggal berikutnya melewati batas 6 bulan ikrar; "" bila aman/tak terhitung. */
export function peringatanBatasIkrar(
  tanggalBerikut: string,
  bahan: { tanggalPenetapanSidangIkrar?: string | null; tanggalBht?: string | null }
): string {
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
