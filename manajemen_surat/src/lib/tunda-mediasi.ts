/**
 * ============================================================================
 * TUNDA MEDIASI - ATURAN MURNI (26 Okt 2026)
 * ============================================================================
 *
 * Bahan formulir "Tunda mediasi" di Jadwal Mediasi. Yang ditulis ke SIPP
 * dikerjakan bot (aleta_bot/services/tundaMediasiService.js) persis seperti
 * SIPP sendiri (jadwal_mediasi_m::tunda_mediasi); berkas ini hanya memegang
 * aturan yang dipakai layar DAN rute: siapa yang boleh, usulan tanggal,
 * usulan kehadiran, peringatan tenggang, dan pembaruan baris daftar sesudah
 * tulisan berhasil.
 */
import { golonganPengguna, type PenggunaGolongan } from "@/lib/matriks-peran";
import { namaAdaDi } from "@/lib/perkara-sendiri";
import { namaTiapMediator } from "@/lib/sebutan-mediator";

export const LAINNYA_TUNDA_MEDIASI = "lainnya";

/**
 * Alasan penundaan yang lazim. Alasan TIDAK punya kolom di perkara_jadwal_mediasi
 * (form Tunda SIPP hanya tanggal dan tempat), jadi ia dicatat di riwayat ALETA
 * saja - tidak pernah tertulis ke SIPP.
 */
export const ALASAN_TUNDA_MEDIASI: ReadonlyArray<{ kunci: string; label: string }> = [
  { kunci: "satu-pihak-tidak-hadir", label: "Salah satu pihak tidak hadir" },
  { kunci: "kedua-pihak-tidak-hadir", label: "Kedua pihak tidak hadir" },
  { kunci: "pihak-berunding", label: "Pihak meminta waktu untuk berunding / mempertimbangkan" },
  { kunci: "menunggu-prinsipal", label: "Menunggu kehadiran prinsipal / pemberi kuasa" },
  { kunci: "pihak-berhalangan", label: "Pihak berhalangan (sakit / keperluan mendesak)" },
  { kunci: "mediator-berhalangan", label: "Mediator berhalangan" },
  { kunci: "panggilan-belum-sampai", label: "Panggilan mediasi belum diterima pihak" },
  { kunci: "lanjutan", label: "Mediasi dilanjutkan pada pertemuan berikutnya" },
  { kunci: LAINNYA_TUNDA_MEDIASI, label: "Lainnya (ketik sendiri)" },
];

/** Arti perkara_jadwal_mediasi.dihadiri_oleh - sama dengan blangko Edit Jadwal Mediasi SIPP. */
export const PILIHAN_KEHADIRAN_SIPP: ReadonlyArray<{ nilai: string; label: string }> = [
  { nilai: "1", label: "Semua pihak" },
  { nilai: "2", label: "Penggugat/Pemohon saja" },
  { nilai: "3", label: "Tergugat/Termohon saja" },
  { nilai: "4", label: "Semua pihak tidak hadir" },
];

export type PetugasPerkaraMediasi = {
  /** perkara_mediasi.mediator_text (boleh memuat <br> bila lebih dari satu mediator). */
  mediator?: string;
  majelis?: readonly string[];
  panitera?: readonly string[];
};

/**
 * Siapa yang boleh menunda mediasi satu perkara.
 *
 *   - Super Admin dan Admin: selalu.
 *   - Pimpinan, panitera, panitera muda: mengawasi, jadi boleh (sama dengan
 *     mencatat kehadiran mediasi).
 *   - Hakim, panitera pengganti, mediator: HANYA bila namanya tercatat di
 *     perkara itu - mediator mediasi itu, anggota majelis, atau panitera
 *     pengganti perkaranya. Dicocokkan dengan NAMA (tidak ada NIP yang
 *     menghubungkan akun portal dengan pegawai SIPP), aturan yang sama dengan
 *     "Perkara saya" dan Hasil Mediasi.
 *
 * Aturan golongan (aksi mediasi.tunda) tetap dipasang lebih dulu di rute;
 * fungsi ini hanya menambah kepemilikan perkara bagi golongan pelaksana.
 */
export function bolehTundaMediasi(
  pengguna: (PenggunaGolongan & { name?: string; nama?: string }) | null | undefined,
  petugas: PetugasPerkaraMediasi
): boolean {
  if (!pengguna) return false;
  const golongan = golonganPengguna(pengguna);
  if (golongan.length === 0) return false;
  if (golongan.some((g) => g === "super-admin" || g === "admin" || g === "pimpinan" || g === "panitera" || g === "panmud")) {
    return true;
  }
  const nama = String(pengguna.name ?? pengguna.nama ?? "").trim();
  if (!nama) return false;
  if (namaTiapMediator(petugas.mediator ?? "").some((m) => namaAdaDi(nama, m))) return true;
  if ((petugas.majelis ?? []).some((m) => namaAdaDi(nama, m))) return true;
  if ((petugas.panitera ?? []).some((m) => namaAdaDi(nama, m))) return true;
  return false;
}

/**
 * Usulan kehadiran SIPP dari catatan kehadiran ALETA (empat kedudukan).
 * "" = catatan belum lengkap, tidak menebak.
 */
export function usulanKehadiranSipp(
  baris: ReadonlyArray<{ kedudukan: string; hadir: boolean; belumDicatat?: boolean }> | null | undefined
): string {
  if (!baris || baris.length === 0) return "";
  if (baris.every((b) => b.belumDicatat)) return "";
  const sisi1 = baris.some((b) => (b.kedudukan === "penggugat" || b.kedudukan === "kuasa_penggugat") && b.hadir);
  const sisi2 = baris.some((b) => (b.kedudukan === "tergugat" || b.kedudukan === "kuasa_tergugat") && b.hadir);
  if (sisi1 && sisi2) return "1";
  if (sisi1) return "2";
  if (sisi2) return "3";
  return "4";
}

function tambahHariIso(iso: string, n: number): string {
  const [t, b, h] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(t, b - 1, h + n));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Usulan tanggal pertemuan berikutnya: dua pekan sesudah pertemuan ini (jarak
 * terlazim di satker: 14 hari 62 kali, 7 hari 23 kali dari 150-an penundaan
 * 2025-2026), tidak pernah lebih awal dari besok, dan Sabtu/Minggu digeser ke
 * Senin. Hari libur nasional tidak dihitung di sini - pemilih tanggal yang
 * menolak dan menyebut sebabnya.
 */
export function tanggalUsulanTundaMediasi(tanggalLama: string, hariIni: string): string {
  const dasar = /^\d{4}-\d{2}-\d{2}$/.test(tanggalLama) ? tanggalLama : hariIni;
  let usul = tambahHariIso(dasar, 14);
  const besok = tambahHariIso(/^\d{4}-\d{2}-\d{2}$/.test(hariIni) ? hariIni : dasar, 1);
  if (usul < besok) usul = besok;
  const [t, b, h] = usul.split("-").map(Number);
  const hari = new Date(Date.UTC(t, b - 1, h)).getUTCDay();
  if (hari === 6) usul = tambahHariIso(usul, 2);
  else if (hari === 0) usul = tambahHariIso(usul, 1);
  return usul;
}

/** Peringatan (bukan larangan) bila tanggal berikutnya melewati tenggang 30 hari sejak penetapan mediator. */
export function peringatanTenggangTunda(tanggalBaru: string, tenggat: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalBaru) || !/^\d{4}-\d{2}-\d{2}$/.test(tenggat)) return "";
  if (tanggalBaru <= tenggat) return "";
  return `Tanggal ini melewati batas tenggang mediasi 30 hari sejak penetapan mediator (${tenggat}, PERMA 1/2016 Pasal 24). Penundaan tetap dapat dicatat; pastikan majelis menyetujui perpanjangannya.`;
}

/** Kalimat alasan akhir: pilihan lazim, atau ketikan bila "Lainnya". */
export function alasanTundaMediasi(kunci: string, ketikan: string): string {
  if (kunci === LAINNYA_TUNDA_MEDIASI || !kunci) return ketikan.trim();
  const pilihan = ALASAN_TUNDA_MEDIASI.find((a) => a.kunci === kunci);
  const tambahan = ketikan.trim();
  return pilihan ? (tambahan ? `${pilihan.label} - ${tambahan}` : pilihan.label) : tambahan;
}

export type BarisMediasiTunda = {
  mediasiId: string;
  tanggal: string;
  jam: string;
  sampaiJam: string;
  tempat: string;
  dihadiri: string;
  ditunda: boolean;
};

/**
 * Daftar Jadwal Mediasi sesudah penundaan tertulis ke SIPP - sama dengan yang
 * SIPP kerjakan pada tabelnya:
 *   - SEMUA pertemuan mediasi itu bertanda ditunda dan bertempat pertemuan yang
 *     ditunda (tunda_mediasi SIPP memperbarui seluruh mediasi_id);
 *   - kehadiran pertemuan yang ditunda terisi bila baru diisi dari formulir;
 *   - pertemuan berikutnya MUNCUL bila tanggalnya di rentang yang sedang tampil
 *     (jam, sampai jam, dan kehadiran kosong, ditunda tidak).
 */
export function barisSetelahTundaMediasi<T extends BarisMediasiTunda>(
  daftar: readonly T[],
  asal: { mediasiId: string; tanggal: string },
  baru: { tanggal: string; tempat: string; jam?: string; sampaiJam?: string },
  kehadiranNilai: string,
  rentang: { dari: string; sampai: string }
): T[] {
  const sasaran = daftar.find((x) => x.mediasiId === asal.mediasiId && x.tanggal.slice(0, 10) === asal.tanggal);
  const tempatLama = sasaran ? sasaran.tempat : "";
  const hasil: T[] = daftar.map((x) => {
    if (x.mediasiId !== asal.mediasiId) return x;
    const salinan = { ...x, ditunda: true, tempat: tempatLama || x.tempat };
    if (x.tanggal.slice(0, 10) === asal.tanggal && !x.dihadiri && kehadiranNilai) salinan.dihadiri = kehadiranNilai;
    return salinan;
  });
  const tanggalBaru = baru.tanggal.slice(0, 10);
  const adaDi = hasil.some((x) => x.mediasiId === asal.mediasiId && x.tanggal.slice(0, 10) === tanggalBaru);
  if (sasaran && !adaDi && tanggalBaru >= rentang.dari && tanggalBaru <= rentang.sampai) {
    const baris = {
      ...sasaran,
      tanggal: tanggalBaru,
      tempat: baru.tempat,
      jam: baru.jam || "",
      sampaiJam: baru.sampaiJam || "",
      dihadiri: "",
      ditunda: false,
    };
    // Urutan daftar dari bot (tanggal, jam, nomor perkara) dijaga: sisipkan sebelum
    // baris pertama yang tanggalnya LEBIH LAMBAT, bukan mengurutkan ulang semuanya.
    const letak = hasil.findIndex((x) => x.tanggal.slice(0, 10) > tanggalBaru);
    hasil.splice(letak < 0 ? hasil.length : letak, 0, baris);
  }
  return hasil;
}
