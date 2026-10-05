/**
 * ============================================================================
 * PANGGIL PETUGAS SIDANG DAN PARA PIHAK - BUTIR 33, 34, 36, 37 (5 OKT 2026)
 * ============================================================================
 *
 * Diminta pengguna: dari Jadwal Sidang, Hasil Sidang, dan Jadwal Mediasi,
 * NAMA petugas (hakim ketua, hakim anggota, panitera pengganti, juru sita,
 * mediator) dan NAMA pihak (penggugat/pemohon, tergugat/termohon, dan kuasa
 * masing-masing - bukan saksi) dapat diklik untuk memanggilnya:
 *
 *   chat WhatsApp    lewat bot WhatsApp ALETA yang sudah ada;
 *   audio speaker    pengumuman suara, diputar layar antrian / papan panggil
 *                    yang tersambung ke pengeras suara (petugas saja).
 *
 * Berkas ini hanya ATURAN MURNI yang dipakai layar dan diuji: saklar tampilan
 * fitur panggil, kalimat pesan dan pengumuman, dan penyamaran nomor. Yang
 * mengirim ada di bot (aleta_bot/services/panggilPetugasService.js), yang
 * memutuskan siapa boleh memanggil ada di rute portal
 * /api/aleta-ecourt/panggil.
 *
 * ============================================================================
 * SAKLARNYA TERSIMPAN SENDIRI, BUKAN DI SAKLAR TAMPILAN JADWAL SIDANG
 * ============================================================================
 *
 * Saklar tampilan Jadwal Sidang (tampilan-antrian-sidang.ts) mengatur PENANDA
 * yang digambar, dan dua tombol mode (lengkap / minimalis) menyalakan atau
 * mematikan seluruhnya sekaligus. Fitur panggil bukan penanda: ia mengirim
 * pesan ke orang sungguhan dan membunyikan pengeras suara. Menyalakan "Mode
 * lengkap" tidak boleh diam-diam menghidupkan audio ruang sidang, dan "Mode
 * minimalis" tidak boleh diam-diam mematikan tombol panggil yang dipakai
 * petugas. Karena itu ketiganya punya simpanan sendiri (KUNCI_SIMPANAN_PANGGIL)
 * yang DIPAKAI BERSAMA oleh Jadwal Sidang, Hasil Sidang, dan Jadwal Mediasi:
 * mematikan chat pihak di satu layar berlaku di layar lain pada peramban yang
 * sama.
 */

export type SaklarPanggil = {
  kunci: KunciSaklarPanggil;
  label: string;
  keterangan: string;
  bawaan: boolean;
};

export type KunciSaklarPanggil = "panggil-petugas-chat" | "panggil-petugas-audio" | "panggil-pihak-chat";

/** Bawaan: chat petugas HIDUP, audio MATI, chat pihak HIDUP (permintaan pengguna, butir 37). */
export const SAKLAR_PANGGIL: SaklarPanggil[] = [
  {
    kunci: "panggil-petugas-chat",
    label: "Panggil petugas (chat WhatsApp)",
    keterangan:
      "Nama hakim, panitera pengganti, juru sita, dan mediator dapat diklik untuk mengirim pesan WhatsApp \"mohon hadir di ruang sidang\" lewat bot ALETA.",
    bawaan: true,
  },
  {
    kunci: "panggil-petugas-audio",
    label: "Panggil petugas (audio speaker)",
    keterangan:
      "Menambah tombol pengumuman suara pada pop-up nama petugas. Suaranya diputar layar antrian atau papan panggil yang tersambung ke pengeras suara (dan perangkat ini bila dipilih). Bawaannya mati.",
    bawaan: false,
  },
  {
    kunci: "panggil-pihak-chat",
    label: "Chat pihak (WhatsApp)",
    keterangan:
      "Nama penggugat/pemohon, tergugat/termohon, dan kuasanya dapat diklik untuk mengirim pemberitahuan WhatsApp dipanggil masuk ruang sidang. Saksi tidak termasuk.",
    bawaan: true,
  },
];

export type PilihanPanggil = Record<KunciSaklarPanggil, boolean>;

export const KUNCI_SIMPANAN_PANGGIL = "aleta.panggil-petugas.saklar";

/** Peristiwa peramban yang memberi tahu seluruh nama-dapat-dipanggil bahwa saklarnya berubah. */
export const PERISTIWA_SAKLAR_PANGGIL = "aleta:saklar-panggil";

export function panggilBawaan(): PilihanPanggil {
  const hasil = {} as PilihanPanggil;
  for (const s of SAKLAR_PANGGIL) hasil[s.kunci] = s.bawaan;
  return hasil;
}

/** Membaca simpanan; yang tidak dikenal dibuang, yang bukan boolean diabaikan. */
export function bacaPanggil(mentah: string | null | undefined): PilihanPanggil {
  const hasil = panggilBawaan();
  if (!mentah) return hasil;
  let urai: unknown;
  try {
    urai = JSON.parse(mentah);
  } catch {
    return hasil;
  }
  if (!urai || typeof urai !== "object" || Array.isArray(urai)) return hasil;
  const isi = urai as Record<string, unknown>;
  for (const s of SAKLAR_PANGGIL) {
    if (typeof isi[s.kunci] === "boolean") hasil[s.kunci] = isi[s.kunci] as boolean;
  }
  return hasil;
}

// ============================================================================
// SASARAN PANGGILAN
// ============================================================================

/** Golongan sasaran yang dapat diklik di layar. */
export type GolonganSasaran = "majelis" | "pp" | "js" | "mediator" | "pihak1" | "pihak2";

export type StatusNomor = "terverifikasi" | "belum-terverifikasi" | "bermasalah" | "tidak-ada";

/** Satu orang yang dapat dipanggil - nomornya TIDAK pernah dikirim utuh ke peramban. */
export type OrangSasaran = {
  kunci: string;
  nama: string;
  peran: string;
  jenis: "petugas" | "pihak";
  nomorTersamar: string;
  statusNomor: StatusNomor;
  keteranganNomor: string;
};

export type KeadaanWhatsApp = {
  /** Bot sungguh akan mengirim (tersambung, tidak dry-run, tidak nonaktif). */
  dapatKirim: boolean;
  /** Kalimat untuk pop-up bila tidak dapat mengirim. */
  alasan: string;
};

export function golonganPetugas(golongan: GolonganSasaran): boolean {
  return golongan === "majelis" || golongan === "pp" || golongan === "js" || golongan === "mediator";
}

/** Apakah nama golongan ini dapat diklik menurut saklarnya. */
export function namaDapatDiklik(pilihan: PilihanPanggil, golongan: GolonganSasaran): boolean {
  if (golonganPetugas(golongan)) return pilihan["panggil-petugas-chat"] || pilihan["panggil-petugas-audio"];
  return pilihan["panggil-pihak-chat"];
}

/** 0812****6789 - cukup untuk mengenali nomornya, tidak cukup untuk menyalinnya. */
export function samarkanNomor(nomor: string | null | undefined): string {
  const angka = String(nomor ?? "").replace(/\D/g, "");
  if (angka.length < 7) return angka ? "****" : "";
  return `${angka.slice(0, 4)}****${angka.slice(-3)}`;
}

/** Sebutan status nomor untuk pop-up. */
export function kalimatStatusNomor(status: StatusNomor): string {
  switch (status) {
    case "terverifikasi":
      return "nomor terverifikasi";
    case "belum-terverifikasi":
      return "nomor belum terverifikasi";
    case "bermasalah":
      return "nomor bermasalah";
    default:
      return "nomor WhatsApp tidak tercatat";
  }
}

// ============================================================================
// KALIMAT - SATU SUMBER UNTUK PORTAL DAN BOT
// ============================================================================
//
// Kalimatnya disusun DI SINI saja - rute portal /api/aleta-ecourt/panggil
// memanggil fungsi yang sama dengan pratinjau di pop-up, lalu mengirim teks
// jadinya ke bot. Bot tidak menyusun kalimat sendiri, jadi pratinjau dan pesan
// yang terkirim tidak dapat menyimpang. Nomor perkara dan ruang yang dipakai
// rute adalah yang dibaca bot dari SIPP bila ada, bukan semata kiriman layar.

export type BahanKalimat = {
  ruang?: string;
  nomorPerkara: string;
  agenda?: string;
  pemanggil: string;
  konteks?: "sidang" | "mediasi";
};

function tempatSidang(bahan: BahanKalimat) {
  const ruang = String(bahan.ruang ?? "").trim();
  if (ruang) return ruang;
  return bahan.konteks === "mediasi" ? "ruang mediasi" : "ruang sidang";
}

/** Pesan WhatsApp untuk PETUGAS (butir 33). */
export function kalimatPesanPetugas(bahan: BahanKalimat): string {
  const agenda = String(bahan.agenda ?? "").trim();
  return `Mohon hadir di ${tempatSidang(bahan)} untuk perkara ${bahan.nomorPerkara}${agenda ? ` (${agenda})` : ""} - dipanggil dari ALETA oleh ${bahan.pemanggil}.`;
}

/** Pesan WhatsApp untuk PIHAK (butir 36). */
export function kalimatPesanPihak(bahan: BahanKalimat & { sebutan?: string }): string {
  const agenda = String(bahan.agenda ?? "").trim();
  const kegiatan = bahan.konteks === "mediasi" ? "mediasi" : "persidangan";
  return `Pemberitahuan persidangan: Saudara${bahan.sebutan ? ` (${bahan.sebutan})` : ""} dipanggil masuk ${tempatSidang(bahan)} untuk ${kegiatan} perkara ${bahan.nomorPerkara}${agenda ? ` (${agenda})` : ""}. Mohon segera menuju ${tempatSidang(bahan)}.`;
}

/** Kalimat pengumuman suara untuk PETUGAS. */
export function kalimatPengumuman(bahan: { peran: string; nama: string; ruang?: string; nomorPerkara: string; konteks?: "sidang" | "mediasi" }): string {
  return `Panggilan untuk ${bahan.peran} ${bahan.nama}, mohon hadir di ${tempatSidang({ ...bahan, pemanggil: "" })} untuk perkara nomor ${bahan.nomorPerkara}.`;
}
