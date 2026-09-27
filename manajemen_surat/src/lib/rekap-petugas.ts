/**
 * ============================================================================
 * REKAP PETUGAS - ALAMAT, PEMERIKSA MASUKAN, DAN BENTUK DATANYA
 * ============================================================================
 *
 * Diminta pengguna 27 September 2026 (butir 6 dan 9): nama hakim, panitera
 * pengganti, juru sita, dan mediator di layar Status Perkara dapat diklik dan
 * membuka rekap orang itu di halaman baru.
 *
 * ============================================================================
 * ALAMATNYA MEMBAWA PERAN DAN ID SIPP, TIDAK PERNAH NAMA
 * ============================================================================
 *
 * Nama petugas di SIPP berbeda-beda ejaannya antar penunjukan untuk orang yang
 * sama, dan dua orang dapat bernama sama (hakim_pn sipp_donggala memuat
 * "Mazidah" dua kali). Karena itu alamatnya ?peran=hakim&id=26 - dan PERAN
 * wajib ikut: id 28 adalah Idris di hakim_pn, Unun di panitera_pn, dan Tanty
 * di jurusita. Tanpa peran, angka yang sama menunjuk tiga orang.
 *
 * Seluruh hitungannya di bot (rekapPetugasService). Berkas ini hanya menyusun
 * alamat, memeriksa masukan di pintu rute, dan menuliskan angka yang datang.
 */

/** Peran yang dapat direkap. Sama dengan PERAN_REKAP di bot. */
export const PERAN_REKAP = ["hakim", "panitera", "jurusita", "mediator"] as const;
export type PeranRekap = (typeof PERAN_REKAP)[number];

export function peranRekapSah(nilai: unknown): nilai is PeranRekap {
  return typeof nilai === "string" && (PERAN_REKAP as readonly string[]).includes(nilai);
}

/** Sebutan peran di kepala halaman. Mediator disebut lengkap lewat sebutan-mediator. */
export const SEBUTAN_PERAN: Record<PeranRekap, string> = {
  hakim: "Hakim",
  panitera: "Panitera Pengganti",
  jurusita: "Juru Sita",
  mediator: "Mediator",
};

/** Saringan keadaan daftar perkara. Kunci yang kosong berarti seluruhnya. */
export const KEADAAN_SARING = [
  { kunci: "", label: "Semua keadaan" },
  { kunci: "proses", label: "Masih proses" },
  { kunci: "putus", label: "Sudah putus" },
  { kunci: "belum_bht", label: "Putus, belum BHT" },
  { kunci: "bht", label: "Sudah BHT" },
] as const;

/** Pagu baris daftar per halaman - sama dengan BATAS_DAFTAR_MAKS di bot. */
export const BATAS_DAFTAR_MAKS = 200;
export const BATAS_DAFTAR_BAWAAN = 100;

/**
 * Id SIPP yang sah: bilangan bulat positif tanpa tanda maupun pecahan, paling
 * besar batas int(11) unsigned.
 *
 * "12abc" DITOLAK, bukan dibaca 12. parseInt yang murah hati akan membuka
 * rekap orang lain tanpa ada yang menyadari alamatnya salah ketik.
 */
export function bacaIdSipp(nilai: unknown): number | null {
  const teks = String(nilai ?? "").trim();
  if (!/^[1-9]\d{0,9}$/.test(teks)) return null;
  const angka = Number(teks);
  return Number.isSafeInteger(angka) && angka <= 4294967295 ? angka : null;
}

/**
 * Alamat halaman rekap satu orang, TANPA basePath - pemanggilnya yang
 * membungkus dengan withBasePath, sama seperti alamat lain di portal.
 *
 * Kosong bila id-nya tidak sah: nama tanpa id yang terbaca tetap tampil
 * sebagai teks biasa, bukan tautan ke halaman yang pasti menolak.
 */
export function alamatRekapPetugas(peran: PeranRekap, id: unknown): string {
  const sah = bacaIdSipp(id);
  if (!peranRekapSah(peran) || sah === null) return "";
  return `/aleta-ecourt/rekap-petugas?peran=${peran}&id=${sah}`;
}

/**
 * Alamat Status Perkara satu nomor - bentuk yang sama dengan tombol "Salin
 * tautan" di bilah alat Status Perkara, dan yang dibaca layar ALETA e-Court
 * saat dibuka (aleta-ecourt-pengguna).
 */
export function alamatStatusPerkara(nomorPerkara: string): string {
  const nomor = String(nomorPerkara ?? "").trim();
  return nomor ? `/aleta-ecourt?perkara=${encodeURIComponent(nomor)}` : "";
}

// ============================================================================
// PERSENTASE BESERTA PEMBILANG DAN PENYEBUTNYA
// ============================================================================

export type Bagian = { pembilang: number; penyebut: number; persen: number | null };

const angkaId = (n: number) => n.toLocaleString("id-ID");

/** Persen dengan koma desimal Indonesia: 33,3%. null bila tidak terhitung. */
export function teksPersen(persen: number | null | undefined): string {
  if (persen === null || persen === undefined || !Number.isFinite(persen)) return "—";
  return `${persen.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

/**
 * "12 dari 40 · 30%".
 *
 * Penyebut nol ditulis "—": tidak ada yang dihitung, jadi tidak ada persen yang
 * patut disebut. "0%" atas nol perkara menyatakan sesuatu yang tidak pernah
 * diukur, dan "NaN%" menyatakan kerusakan.
 */
export function teksBagian(bagian: Bagian | null | undefined): string {
  if (!bagian || !Number.isFinite(bagian.penyebut) || bagian.penyebut <= 0) return "—";
  return `${angkaId(bagian.pembilang)} dari ${angkaId(bagian.penyebut)} · ${teksPersen(bagian.persen)}`;
}

/** Jumlah hari, atau "—" bila tidak terhitung. */
export function teksHari(hari: number | null | undefined): string {
  if (hari === null || hari === undefined || !Number.isFinite(hari)) return "—";
  return `${hari.toLocaleString("id-ID", { maximumFractionDigits: 1 })} hari`;
}

// ============================================================================
// PEMERIKSA MASUKAN RUTE
// ============================================================================

export type PermintaanRekap = {
  peran: PeranRekap;
  id: number;
  tahun: string;
  keadaan: string;
  kedudukan: string;
  lewati: number;
  batas: number;
};

/**
 * Memeriksa alamat permintaan di pintu rute portal, SEBELUM bot dipanggil.
 *
 * Yang tidak sah ditolak dengan kalimatnya, tidak diganti bawaan diam-diam:
 * "tahun 20255" yang diam-diam menjadi "semua tahun" menjawab pertanyaan yang
 * tidak diajukan. Anggota kedudukan per peran diperiksa bot (daftarnya milik
 * bot); di sini hanya bentuknya.
 */
export function bacaPermintaanRekap(
  p: URLSearchParams
): { ok: true; nilai: PermintaanRekap } | { ok: false; pesan: string } {
  const peran = String(p.get("peran") ?? "").trim().toLowerCase();
  if (!peranRekapSah(peran)) {
    return { ok: false, pesan: "Peran harus salah satu dari hakim, panitera, jurusita, atau mediator." };
  }
  const id = bacaIdSipp(p.get("id"));
  if (id === null) return { ok: false, pesan: "ID SIPP petugas harus bilangan bulat positif." };

  const tahun = String(p.get("tahun") ?? "").trim();
  if (tahun && !(/^\d{4}$/.test(tahun) && Number(tahun) >= 1900 && Number(tahun) <= 2100)) {
    return { ok: false, pesan: "Tahun harus empat angka." };
  }
  const keadaan = String(p.get("keadaan") ?? "").trim().toLowerCase();
  if (keadaan && !KEADAAN_SARING.some((k) => k.kunci === keadaan)) {
    return { ok: false, pesan: "Keadaan harus proses, putus, belum_bht, atau bht." };
  }
  const kedudukan = String(p.get("kedudukan") ?? "").trim();
  if (kedudukan && !/^[A-Za-z]{1,20}$/.test(kedudukan)) {
    return { ok: false, pesan: "Kedudukan tidak dikenal." };
  }
  const lewatiTeks = String(p.get("lewati") ?? "").trim();
  if (lewatiTeks && !/^\d{1,7}$/.test(lewatiTeks)) return { ok: false, pesan: "Lewati harus bilangan bulat." };
  const batasTeks = String(p.get("batas") ?? "").trim();
  if (batasTeks && !/^\d{1,4}$/.test(batasTeks)) return { ok: false, pesan: "Batas harus bilangan bulat." };
  const batas = batasTeks ? Number(batasTeks) : BATAS_DAFTAR_BAWAAN;
  if (batas < 1) return { ok: false, pesan: "Batas paling sedikit satu baris." };

  return {
    ok: true,
    nilai: {
      peran,
      id,
      tahun,
      keadaan,
      kedudukan,
      lewati: lewatiTeks ? Number(lewatiTeks) : 0,
      batas: Math.min(BATAS_DAFTAR_MAKS, batas),
    },
  };
}

// ============================================================================
// BENTUK JAWABAN BOT
// ============================================================================

/** Ringkasan sekumpulan perkara - lihat ringkasPerkara di rekapPetugasService. */
export type RingkasPerkara = {
  jumlah: number;
  keadaan: { proses: Bagian; putus: Bagian; putusBelumBht: Bagian; bht: Bagian };
  hasil: Array<Bagian & { label: string }>;
  lama: {
    dihitung: number;
    tanpaTanggal: number;
    rataHari: number | null;
    medianHari: number | null;
    dalamBatas: Bagian;
    prosesLewatBatas: Bagian;
  };
  verstek: Bagian & { tidakTercatat: number };
  /** null = tidak terbaca (tabelnya tidak ada), bukan nol. */
  ecourt: Bagian | null;
  banding: Bagian | null;
};

export type KelompokRekap = RingkasPerkara & { kunci: string | number; label?: string };

export type BarisRekap = {
  perkaraId: string;
  nomorPerkara: string;
  tanggalDaftar: string;
  tahun: number | null;
  jenisPerkara: string;
  kedudukan: string[];
  keadaan: "proses" | "putus" | "bht";
  tanggalPutusan: string;
  tanggalBht: string;
  statusPutusan: string;
  verstek: boolean | null;
  ecourt: boolean | null;
  banding: boolean | null;
  hariMediasi: number;
  lamaHari: number | null;
  umurHari: number | null;
  mediasi?: {
    sandiHasil: string;
    golongan: string;
    penetapan: string;
    laporan: string;
    lamaHari: number | null;
  };
};

export type RekapPetugas = {
  ok: boolean;
  peran: PeranRekap;
  id: number;
  acuan: string;
  dihitungPada: string;
  dariSinggahan: boolean;
  perkaraTerbaca: boolean;
  /** "indeks" atau "baris" - jalur baca rincian perkara di bot, untuk menelusuri kelambatan. */
  jalurBaca?: string;
  identitas: {
    id: number;
    nama: string;
    namaTerbaca: boolean;
    kode: string;
    aktif: boolean | null;
    sumber: string;
    jabatan: string;
    /** Sandi SIPP apa adanya (H/N/P) - sebutannya lewat lib/sebutan-mediator. */
    statusMediator: string;
    bersertifikat: boolean | null;
    hakimId: number | null;
    idMediator: number[];
  };
  dasar: Record<string, string>;
  ambang: { lamaPerkaraHari: number; mediasiHari: number };
  ringkas: RingkasPerkara;
  diganti: number | null;
  menurutPeran: KelompokRekap[];
  menurutTahun: KelompokRekap[];
  menurutJenis: KelompokRekap[];
  mediasi: {
    jumlah: number;
    perkara: number;
    hasil: Array<Bagian & { kunci: string; label: string }>;
    berhasilRinci: { kesepakatan: Bagian; pencabutan: Bagian };
    lama: {
      dihitung: number;
      rataHari: number | null;
      medianHari: number | null;
      lewatBatas: Bagian;
      berjalanLewatBatas: number;
      batasHari: number;
    };
  } | null;
  relaas: {
    jumlah: number;
    perkara: number;
    cara: Array<Bagian & { sandi: string; cara: string }>;
    pos: { jumlah: number; sampai: Bagian; retur: Bagian; belumDilacak: Bagian };
  } | null;
  sidang: { jumlah: number; perkara: number; lewat: number; akanDatang: number; bas: Bagian } | null;
  daftar: {
    baris: BarisRekap[];
    jumlah: number;
    lewati: number;
    batas: number;
    adaLagi: boolean;
    saringan: { tahun: number | null; keadaan: string; kedudukan: string };
    pilihanTahun: number[];
    pilihanKedudukan: Array<{ kunci: string; label: string; jumlah: number }>;
  };
  terpotong: boolean;
  takTerbaca: Array<{ bagian: string; sebab: string }>;
};
