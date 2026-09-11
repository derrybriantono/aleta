import type {
  AletaBotKirimSaatLengkap,
  AletaBotNotification,
  AletaBotPesanNonaktif,
} from "@/lib/aleta-bot-types";

/**
 * ============================================================================
 * KATALOG PESAN ALETA BOT - SATU KUNCI, SATU SAKLAR
 * ============================================================================
 *
 * Setiap pesan yang berangkat dari bot membawa satu kunci pemberitahuan
 * (notificationKey). Saklar per pesan bekerja pada kunci itu: kunci yang
 * masuk daftar pesanNonaktif tidak dikirim, dan gerbangnya ada di
 * messageService bot sehingga berlaku untuk seluruh jalur.
 *
 * Katalog ini yang memberi NAMA pada tiap kunci di layar. Daftarnya disusun
 * dari kunci yang benar-benar dipakai kode bot - bukan dari daftar fungsi
 * legacy, yang kuncinya berbeda dan sudah dinonaktifkan oleh mode pengambil-
 * alihan registri.
 *
 * Notifikasi buatan admin dari registri (aleta_bot_notifications) ikut
 * ditambahkan saat layar disusun, lewat gabungkanKatalogPesanBot.
 */

export type SaluranPesanBot = "pegawai" | "pihak";

export type ButirKatalogPesanBot = {
  key: string;
  saluran: SaluranPesanBot;
  nama: string;
  keterangan: string;
  sumber: "kelengkapan" | "registri" | "ecourt" | "portal" | "antrian" | "sistem";
};

export const KATALOG_PESAN_BOT: ButirKatalogPesanBot[] = [
  // --- Pihak berperkara ---------------------------------------------------
  {
    key: "pihak-baru-lengkap",
    saluran: "pihak",
    nama: "Perkara baru (setelah lengkap)",
    keterangan:
      "Pemberitahuan pendaftaran kepada para pihak dan kuasanya, dikirim setelah PMH, PHS, dan jadwal sidang pertama terisi.",
    sumber: "kelengkapan",
  },
  {
    key: "pihak-hari-sidang",
    saluran: "pihak",
    nama: "Pengingat hari sidang",
    keterangan: "Pengingat kepada pihak pada hari sidang, atau beberapa hari sebelumnya.",
    sumber: "registri",
  },
  {
    key: "pihak-sisa-panjar",
    saluran: "pihak",
    nama: "Sisa panjar biaya perkara",
    keterangan: "Pemberitahuan sisa panjar atau kekurangan biaya perkara.",
    sumber: "registri",
  },
  {
    key: "pihak-akta-cerai",
    saluran: "pihak",
    nama: "Akta cerai terbit",
    keterangan: "Pemberitahuan bahwa akta cerai sudah dapat diambil.",
    sumber: "registri",
  },
  {
    key: "pihak-dokumen-sipp",
    saluran: "pihak",
    nama: "Dokumen perkara dari SIPP",
    keterangan: "Pengiriman salinan dokumen perkara (gugatan/permohonan) kepada pihak.",
    sumber: "sistem",
  },
  {
    key: "pihak-berkas-putusan",
    saluran: "pihak",
    nama: "Salinan putusan",
    keterangan: "Pengiriman salinan putusan yang sudah tersedia.",
    sumber: "sistem",
  },
  {
    key: "ecourt-dokumen-baru",
    saluran: "pihak",
    nama: "Dokumen e-Court baru",
    keterangan: "Pemberitahuan dokumen e-Court (jawaban, replik, duplik) yang diverifikasi majelis.",
    sumber: "ecourt",
  },
  {
    key: "antrian-hampir-giliran",
    saluran: "pihak",
    nama: "Antrean sidang hampir giliran",
    keterangan: "Pemberitahuan kepada pihak yang antrean sidangnya hampir dipanggil.",
    sumber: "antrian",
  },
  {
    key: "verifikasi-nomor",
    saluran: "pihak",
    nama: "Verifikasi nomor pihak",
    keterangan:
      "Pertanyaan konfirmasi kepada nomor yang belum pernah dikonfirmasi, sebelum dokumen apa pun dikirim ke sana.",
    sumber: "sistem",
  },

  // --- Pegawai ------------------------------------------------------------
  {
    key: "pegawai-penugasan-lengkap",
    saluran: "pegawai",
    nama: "Penugasan perkara (setelah lengkap)",
    keterangan:
      "Pemberitahuan kepada hakim majelis, panitera pengganti, dan juru sita yang ditunjuk, setelah PMH, PPP, PJS, PHS, dan jadwal sidang pertama terisi.",
    sumber: "kelengkapan",
  },
  {
    key: "pegawai-penjaga-sidang-hari-ini",
    saluran: "pegawai",
    nama: "Jadwal sidang hari ini",
    keterangan: "Ringkasan jadwal sidang dan mediasi hari ini kepada petugas.",
    sumber: "registri",
  },
  {
    key: "pegawai-kasir-harian",
    saluran: "pegawai",
    nama: "Pengingat kasir harian",
    keterangan: "Pengingat sisa panjar kepada kasir setiap hari kerja.",
    sumber: "registri",
  },
  {
    key: "disposition_deadline_h_minus_1",
    saluran: "pegawai",
    nama: "Tenggat disposisi H-1",
    keterangan: "Pengingat disposisi surat yang jatuh tempo besok.",
    sumber: "portal",
  },
  {
    key: "ecourt_sesi_habis",
    saluran: "pegawai",
    nama: "Sesi e-Court berakhir",
    keterangan: "Pemberitahuan kepada admin bahwa sesi e-Court perlu dimasuki ulang.",
    sumber: "ecourt",
  },
];

/**
 * Katalog lengkap untuk layar: katalog tetap ditambah notifikasi registri
 * buatan admin yang belum ada di sana. Registri memakai id notifikasinya
 * sebagai kunci, dan kategorinya menentukan salurannya.
 */
export function gabungkanKatalogPesanBot(
  notifikasi: Array<Pick<AletaBotNotification, "id" | "name" | "category" | "description">> = []
): ButirKatalogPesanBot[] {
  const hasil = [...KATALOG_PESAN_BOT];
  const dikenal = new Set(hasil.map((butir) => butir.key));
  for (const satu of notifikasi) {
    const key = String(satu.id || "").trim();
    if (!key || dikenal.has(key)) continue;
    dikenal.add(key);
    hasil.push({
      key,
      saluran: satu.category === "employee" ? "pegawai" : "pihak",
      nama: satu.name || key,
      keterangan: satu.description || "Notifikasi registri buatan admin.",
      sumber: "registri",
    });
  }
  return hasil;
}

export const BAWAAN_KIRIM_SAAT_LENGKAP: AletaBotKirimSaatLengkap = {
  enabled: false,
  pegawai: true,
  pihak: true,
  jendelaHari: 14,
  intervalMenit: 15,
};

function angkaDalamRentang(nilai: unknown, bawaan: number, minimum: number, maksimum: number) {
  const angka = Number(nilai);
  if (!Number.isFinite(angka)) return bawaan;
  return Math.min(maksimum, Math.max(minimum, Math.round(angka)));
}

/**
 * Merapikan setelan kirim-saat-lengkap dari masukan apa pun.
 *
 * Saklar universal dibaca MATI kecuali disetel menyala secara tegas -
 * kebalikan saklar saluran, yang dibaca menyala kecuali dimatikan. Yang
 * pertama memulai jalur kirim baru; yang kedua hanya menyaring jalur yang
 * sudah ada.
 */
export function rapikanKirimSaatLengkap(masukan: unknown): AletaBotKirimSaatLengkap {
  const sumber = (masukan && typeof masukan === "object" ? masukan : {}) as Record<string, unknown>;
  return {
    enabled: sumber.enabled === true,
    pegawai: sumber.pegawai !== false,
    pihak: sumber.pihak !== false,
    jendelaHari: angkaDalamRentang(sumber.jendelaHari, BAWAAN_KIRIM_SAAT_LENGKAP.jendelaHari, 1, 90),
    intervalMenit: angkaDalamRentang(sumber.intervalMenit, BAWAAN_KIRIM_SAAT_LENGKAP.intervalMenit, 5, 240),
  };
}

function daftarKunci(nilai: unknown): string[] {
  if (!Array.isArray(nilai)) return [];
  const hasil = new Set<string>();
  for (const satu of nilai) {
    const kunci = String(satu ?? "").trim().slice(0, 120);
    if (kunci) hasil.add(kunci);
  }
  return [...hasil].slice(0, 200);
}

export function rapikanPesanNonaktif(masukan: unknown): AletaBotPesanNonaktif {
  const sumber = (masukan && typeof masukan === "object" ? masukan : {}) as Record<string, unknown>;
  return {
    pegawai: daftarKunci(sumber.pegawai),
    pihak: daftarKunci(sumber.pihak),
  };
}

function bacaJson(teks: string | null | undefined): unknown {
  if (!teks) return {};
  try {
    return JSON.parse(teks);
  } catch {
    return {};
  }
}

export function bacaJsonKirimSaatLengkap(teks: string | null | undefined): AletaBotKirimSaatLengkap {
  return rapikanKirimSaatLengkap(bacaJson(teks));
}

export function bacaJsonPesanNonaktif(teks: string | null | undefined): AletaBotPesanNonaktif {
  return rapikanPesanNonaktif(bacaJson(teks));
}

/** Apakah kunci ini dimatikan untuk saluran itu? */
export function pesanDimatikan(
  daftar: AletaBotPesanNonaktif | null | undefined,
  key: string,
  saluran: SaluranPesanBot
): boolean {
  if (!daftar) return false;
  const kumpulan = saluran === "pegawai" ? daftar.pegawai : daftar.pihak;
  return Array.isArray(kumpulan) && kumpulan.includes(key);
}

/** Salinan daftar dengan satu kunci dinyalakan atau dimatikan. */
export function setelPesan(
  daftar: AletaBotPesanNonaktif,
  key: string,
  saluran: SaluranPesanBot,
  aktif: boolean
): AletaBotPesanNonaktif {
  const rapi = rapikanPesanNonaktif(daftar);
  const kumpulan = rapi[saluran].filter((satu) => satu !== key);
  if (!aktif) kumpulan.push(key);
  return { ...rapi, [saluran]: kumpulan };
}
