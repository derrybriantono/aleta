import { sebutanPihakPerkara, type BahanSebutan } from "@/lib/sebutan-pihak";

/**
 * ============================================================================
 * BAWAAN ISIAN TUNDA SIDANG - DISIMPULKAN DARI RIWAYAT SIDANG PERKARANYA
 * ============================================================================
 *
 * Perbaikan 30 September 2026, butir 14. Sampai 2.40.1 borang tunda di Jadwal
 * Sidang berbawaan: alasan KOSONG, agenda KOSONG (atau satu langkah sesudah
 * agenda baku), kehadiran "Pihak tidak hadir", tanggal dua pekan. Panitera
 * sidang mengisi empat hal yang hampir selalu sama untuk belasan sidang tiap
 * pagi - padahal jawabannya dapat dibaca dari sidang-sidang sebelumnya.
 *
 * Aturan pengguna:
 *   - alasan: sidang pertama = Panggil Tergugat/Termohon; lainnya mengikuti
 *     riwayat (sidang pertama tergugat tidak hadir -> berikutnya Pembuktian
 *     Lanjutan Penggugat/Pemohon);
 *   - agenda: sidang pertama = Pemeriksaan Pokok Perkara; hadir keduanya +
 *     mediasi -> Jawaban Tergugat/Termohon;
 *   - tanggal: hadir satu pihak -> dua pekan, hari yang sama;
 *   - kehadiran: bawaan Pihak Pertama saja; pernah hadir keduanya -> semua
 *     hadir; hanya tergugat yang pernah hadir -> pihak kedua saja.
 * Semuanya USULAN yang terlihat di kotaknya dan tetap dapat diganti lewat
 * dropdown - tidak ada yang terkirim diam-diam.
 *
 * Sandi kehadiran SIPP (dihadiri_oleh, dari antrian/php/menu.sidang.php):
 *   1 semua pihak, 2 pihak pertama saja, 3 pihak kedua saja, 4 tidak ada.
 *
 * ============================================================================
 * HASIL UKUR - sipp_donggala, penundaan 1 Jul 2025 s.d. 30 Sep 2026
 * ============================================================================
 *
 * Diukur dengan D:/aleta-dev/kerja/perbaikan-30sep/agen-c/ukur-bawaan-tunda.ts
 * atas setiap sidang ditunda (bukan ikrar talak), memakai HANYA riwayat
 * sebelum sidang itu, lalu dibandingkan dengan yang ditulis petugas.
 * Kategori dibandingkan, bukan kalimat: "Tergugat Tidak Hadir" dan "Panggil
 * Tergugat" satu kategori (memanggil pihak kedua). 1.737 penundaan:
 *
 *   kehadiran                        1.385 / 1.736   79,8%
 *   alasan (bawaan murni)            1.044 / 1.737   60,1%
 *   alasan (kehadiran dipilih benar) 1.206 / 1.737   69,4%
 *   agenda sidang berikutnya           944 / 1.737   54,3%
 *     - di luar sidang pertama         689 / 1.082   63,7%
 *     - sidang pertama                 255 /   655   38,9%  (aturan pengguna
 *       "Pemeriksaan Pokok Perkara"; petugas lebih sering menulis "Panggil
 *       Tergugat" 327 kali - aturan pengguna yang dipakai, dropdown tetap ada)
 *   hadir satu pihak: sidang berikut tepat 14 hari   677 / 952   71,1%
 *                     hari yang sama (kelipatan 7)   853 / 952   89,6%
 *
 * Bawaan LAMA (alasan kosong, kehadiran "tidak hadir") cocok 0% untuk alasan
 * dan hanya pada 1.055 dari 20.109 baris untuk kehadiran.
 */

/** Satu sidang terdahulu (atau sidang ini) dari perkara_jadwal_sidang. */
export type SidangRiwayat = {
  jadwalId: number;
  /** YYYY-MM-DD */
  tanggal: string;
  agenda: string;
  ditunda: boolean;
  alasan: string;
  dihadiriOleh: number | null;
  ikrar: boolean;
};

/** Keadaan mediasi perkara dari perkara_mediasi (baris terakhir). */
export type MediasiRiwayat = {
  /** Ada baris mediasi sama sekali (mediator sudah ditunjuk). */
  ada: boolean;
  /** keputusan_mediasi sudah terisi pada atau sebelum sidang ini. */
  selesai: boolean;
  /** hasil_mediasi berhasil (Y1/Y2) atau tanggal mediasi_berhasil terisi. */
  berhasil: boolean;
} | null;

export type MasukanBawaanTunda = {
  jadwalId: number;
  /** YYYY-MM-DD - tanggal sidang yang ditunda. */
  tanggalSidang: string;
  agenda: string;
  /** Kehadiran yang SUDAH tercatat pada sidang ini (1..4), bila ada. */
  dihadiriOlehSekarang?: number | null;
  ikrar?: boolean;
  /** Seluruh sidang perkara ini, urutan bebas - sidang ini boleh ikut. */
  riwayat: SidangRiwayat[];
  mediasi?: MediasiRiwayat;
  /** Bahan sebutan para pihak - alur/jenis perkara lebih dulu, lihat sebutan-pihak.ts. */
  sebutan?: BahanSebutan;
};

export type SebabBawaan =
  | "sidang-pertama"
  | "hadir-keduanya-mediasi-berjalan"
  | "hadir-keduanya-belum-mediasi"
  | "hadir-keduanya-sesudah-mediasi"
  | "tergugat-tidak-pernah-hadir"
  | "hanya-tergugat-hadir"
  | "tidak-ada-yang-hadir"
  | "ikrar-talak"
  | "permohonan";

export type BawaanTunda = {
  /** Sidang ke berapa (tanpa sidang ikrar), dihitung dari riwayat. */
  sidangKe: number;
  alasan: string;
  agenda: string;
  /** YYYY-MM-DD */
  tanggal: string;
  /** Sandi SIPP 1..4. */
  kehadiran: number;
  /** true bila kehadiran diambil dari yang sudah tercatat di SIPP. */
  kehadiranTercatat: boolean;
  sebab: SebabBawaan;
  /** Kalimat pendek untuk layar: dari mana usulan ini datang. */
  penjelasan: string;
};

export const KEHADIRAN_SEMUA = 1;
export const KEHADIRAN_PERTAMA = 2;
export const KEHADIRAN_KEDUA = 3;
export const KEHADIRAN_TIDAK_ADA = 4;

const KEHADIRAN_SAH = new Set([1, 2, 3, 4]);

function kehadiranSah(n: unknown): n is number {
  return typeof n === "number" && KEHADIRAN_SAH.has(n);
}

function tanggalIso(t: string) {
  return String(t || "").slice(0, 10);
}

export function tambahHari(iso: string, hari: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + hari));
  return t.toISOString().slice(0, 10);
}

/**
 * Tahap acara menurut kalimat agenda - untuk rantai jawab-menjawab. Kalimat
 * agenda di SIPP bebas ("jawaban Termohon", "Duplik Tergugat Rekonvensi",
 * "pembuktian tambahan"), jadi yang dibaca kata kuncinya.
 */
export type TahapAcara =
  | "mediasi"
  | "jawaban"
  | "replik"
  | "duplik"
  | "pembuktian-pertama"
  | "pembuktian-kedua"
  | "kesimpulan"
  | "musyawarah"
  | "lain";

export function tahapAgenda(agenda: string): TahapAcara {
  const t = String(agenda || "").toLowerCase();
  if (/musyawarah|pembacaan putusan|baca putusan|putusan/.test(t)) return "musyawarah";
  if (/kesimpulan/.test(t)) return "kesimpulan";
  if (/duplik/.test(t)) return "duplik";
  if (/replik/.test(t)) return "replik";
  if (/jawab/.test(t)) return "jawaban";
  if (/pembuktian|bukti|saksi/.test(t)) {
    return /tergugat|termohon|pihak kedua/.test(t) ? "pembuktian-kedua" : "pembuktian-pertama";
  }
  if (/mediasi|damai|perdamaian/.test(t)) return "mediasi";
  return "lain";
}

function urutkan(riwayat: SidangRiwayat[]) {
  return [...riwayat].sort((a, b) =>
    tanggalIso(a.tanggal) === tanggalIso(b.tanggal)
      ? a.jadwalId - b.jadwalId
      : tanggalIso(a.tanggal) < tanggalIso(b.tanggal)
        ? -1
        : 1
  );
}

/**
 * Usulan isian tunda untuk satu sidang. Fungsi murni: tidak membaca apa pun
 * selain masukannya, sehingga diuji dengan contoh data sungguhan dan diukur
 * atas seluruh penundaan satker dengan aturan yang SAMA.
 *
 * `kehadiranPilihan` (boleh tidak ada) adalah kehadiran yang dipilih petugas
 * di dropdown - alasan dan agenda yang belum disentuh tangan disusun ulang
 * menurutnya.
 */
export function bawaanTunda(masukan: MasukanBawaanTunda, kehadiranPilihan?: number | null): BawaanTunda {
  const pihak = sebutanPihakPerkara(masukan.sebutan ?? {});
  const satu = pihak.satu;
  const dua = pihak.dua;
  const voluntair = pihak.surat === "permohonan" && pihak.dua === "Termohon" && !adaPihakKedua(masukan);

  const semua = urutkan(masukan.riwayat.filter((r) => r.jadwalId !== masukan.jadwalId));
  const sebelum = semua.filter(
    (r) =>
      tanggalIso(r.tanggal) < tanggalIso(masukan.tanggalSidang) ||
      (tanggalIso(r.tanggal) === tanggalIso(masukan.tanggalSidang) && r.jadwalId < masukan.jadwalId)
  );
  const sebelumBiasa = sebelum.filter((r) => !r.ikrar);
  const sidangKe = sebelumBiasa.length + 1;

  const hadirSebelum = sebelumBiasa.map((r) => r.dihadiriOleh).filter(kehadiranSah);
  const pernahKeduanya = hadirSebelum.includes(KEHADIRAN_SEMUA);
  const pernahPertama = hadirSebelum.includes(KEHADIRAN_PERTAMA);
  const pernahKedua = hadirSebelum.includes(KEHADIRAN_KEDUA);

  // ---- Kehadiran --------------------------------------------------------
  let kehadiran: number;
  let kehadiranTercatat = false;
  if (kehadiranSah(kehadiranPilihan)) {
    kehadiran = kehadiranPilihan;
  } else if (kehadiranSah(masukan.dihadiriOlehSekarang)) {
    kehadiran = masukan.dihadiriOlehSekarang;
    kehadiranTercatat = true;
  } else if (voluntair) {
    // Permohonan tanpa pihak kedua: pilihan "pihak pertama/kedua saja" tidak
    // ditawarkan borangnya, jadi bawaannya pemohon hadir = semua hadir.
    kehadiran = KEHADIRAN_SEMUA;
  } else if (pernahKeduanya) {
    kehadiran = KEHADIRAN_SEMUA;
  } else if (pernahKedua && !pernahPertama) {
    kehadiran = KEHADIRAN_KEDUA;
  } else {
    kehadiran = KEHADIRAN_PERTAMA;
  }

  const tanggal = tambahHari(tanggalIso(masukan.tanggalSidang), 14);
  const jadi = (
    alasan: string,
    agenda: string,
    sebab: SebabBawaan,
    penjelasan: string
  ): BawaanTunda => ({ sidangKe, alasan, agenda, tanggal, kehadiran, kehadiranTercatat, sebab, penjelasan });

  // ---- Sidang ikrar talak -------------------------------------------------
  if (masukan.ikrar) {
    return jadi(
      kehadiran === KEHADIRAN_TIDAK_ADA ? `${satu} dan ${dua} tidak hadir` : `${satu} tidak hadir`,
      "SIDANG IKRAR TALAK",
      "ikrar-talak",
      "Sidang ikrar talak - penundaannya memanggil ulang untuk pengucapan ikrar."
    );
  }

  // ---- Permohonan tanpa pihak kedua ---------------------------------------
  if (voluntair) {
    const tahap = tahapAgenda(masukan.agenda);
    const sesudahBukti = tahap === "pembuktian-pertama" || tahap === "pembuktian-kedua" || tahap === "kesimpulan";
    const kalimat =
      tahap === "musyawarah"
        ? "Pembacaan Penetapan"
        : sesudahBukti
          ? "Musyawarah Majelis dan Pembacaan Penetapan"
          : `Pembuktian ${satu}`;
    return jadi(
      kalimat,
      kalimat,
      "permohonan",
      sesudahBukti
        ? "Permohonan tanpa pihak lawan, pembuktian sudah diagendakan - berikutnya penetapan."
        : "Permohonan tanpa pihak lawan - sidang berikutnya pembuktian pemohon."
    );
  }

  const keduanyaHadir = kehadiran === KEHADIRAN_SEMUA || pernahKeduanya;
  const mediasi = masukan.mediasi ?? null;

  // ---- Tidak ada yang hadir ------------------------------------------------
  if (kehadiran === KEHADIRAN_TIDAK_ADA) {
    return jadi(
      `Panggil ${satu} dan ${dua}`,
      `Panggil ${satu} dan ${dua}`,
      "tidak-ada-yang-hadir",
      "Tidak ada pihak yang hadir - kedua pihak dipanggil ulang."
    );
  }

  // ---- Hanya pihak kedua yang hadir ----------------------------------------
  if (kehadiran === KEHADIRAN_KEDUA && !keduanyaHadir) {
    return jadi(
      `Panggil ${satu}`,
      sidangKe === 1 ? "Pemeriksaan Pokok Perkara" : `Panggil ${satu}`,
      "hanya-tergugat-hadir",
      `Hanya ${dua} yang hadir - ${satu} dipanggil ulang.`
    );
  }

  // ---- Keduanya hadir: mediasi, lalu jawab-menjawab ------------------------
  if (keduanyaHadir) {
    if (!mediasi || !mediasi.ada) {
      return jadi(
        "Proses Mediasi",
        "Mendengarkan Laporan Hasil Mediasi",
        "hadir-keduanya-belum-mediasi",
        "Kedua pihak hadir dan mediasinya belum tercatat - sidang ditunda untuk mediasi."
      );
    }
    if (!mediasi.selesai) {
      // Terukur: 91 dari 92 penundaan pada mediasi yang masih berjalan
      // beragenda berikut mediasi/laporan mediasi, bukan jawaban. "Jawaban"
      // baru datang sesudah mediasinya diputus - cabang di bawah.
      return jadi(
        "Proses Mediasi",
        "Mendengarkan Laporan Hasil Mediasi",
        "hadir-keduanya-mediasi-berjalan",
        `Kedua pihak hadir, mediasi masih berjalan - sesudahnya jawaban ${dua}.`
      );
    }
    const berikut = langkahSesudah(tahapAgenda(masukan.agenda), satu, dua);
    return jadi(
      berikut,
      berikut,
      "hadir-keduanya-sesudah-mediasi",
      `Kedua pihak pernah hadir dan mediasi selesai - satu langkah sesudah agenda "${masukan.agenda || "-"}".`
    );
  }

  // ---- Pihak kedua tidak pernah hadir --------------------------------------
  if (sidangKe === 1) {
    return jadi(
      `Panggil ${dua}`,
      "Pemeriksaan Pokok Perkara",
      "sidang-pertama",
      `Sidang pertama, ${dua} tidak hadir - ${dua} dipanggil sekali lagi.`
    );
  }
  // Sidang KEDUA yang pihak keduanya masih belum pernah hadir: panggilan
  // kedua, sama bunyinya dengan sidang pertama. Aturan pengguna menyebut
  // "sidang pertama tergugat tidak hadir -> sidang KETIGA Pembuktian
  // Lanjutan", dan datanya setuju: pada sidang ke-2 petugas menulis
  // "Panggil/Tergugat tidak hadir" 100 kali lawan pembuktian 38 kali.
  if (sidangKe === 2) {
    return jadi(
      `Panggil ${dua}`,
      `Pembuktian ${satu}`,
      "tergugat-tidak-pernah-hadir",
      `${dua} belum pernah hadir - dipanggil sekali lagi sebelum pembuktian ${satu}.`
    );
  }
  return jadi(
    `Pembuktian Lanjutan ${satu}`,
    `Pembuktian Lanjutan ${satu}`,
    "tergugat-tidak-pernah-hadir",
    `${dua} tidak pernah hadir sejak sidang pertama - pemeriksaan berlanjut ke pembuktian ${satu}.`
  );
}

/** Perkara yang punya pihak kedua - gugatan, atau permohonan kontensius (cerai talak). */
function adaPihakKedua(masukan: MasukanBawaanTunda) {
  const nomor = String(masukan.sebutan?.nomorPerkara || "");
  if (/\/Pdt\.G\//i.test(nomor)) return true;
  const hadir = masukan.riwayat.map((r) => r.dihadiriOleh);
  return hadir.includes(KEHADIRAN_PERTAMA) || hadir.includes(KEHADIRAN_KEDUA);
}

/** Rantai acara sesudah mediasi gagal. */
function langkahSesudah(tahap: TahapAcara, satu: string, dua: string) {
  switch (tahap) {
    case "jawaban":
      return `Replik ${satu}`;
    case "replik":
      return `Duplik ${dua}`;
    case "duplik":
      return `Pembuktian ${satu}`;
    case "pembuktian-pertama":
      return `Pembuktian ${dua}`;
    case "pembuktian-kedua":
      return "Kesimpulan";
    case "kesimpulan":
      return "Musyawarah Majelis";
    case "musyawarah":
      return "Pembacaan Putusan";
    default:
      return `Jawaban ${dua}`;
  }
}

/**
 * Pilihan dropdown alasan dan agenda untuk satu perkara - kalimat aturan di
 * atas dengan sebutan para pihak perkaranya, lalu daftar lazim layar lama
 * (tidak ada pilihan lama yang hilang). Tanpa kembar (huruf besar-kecil).
 */
export function pilihanTunda(
  sebutan: BahanSebutan = {},
  alasanLazim: readonly string[] = [],
  agendaLazim: readonly string[] = []
): { alasan: string[]; agenda: string[] } {
  const { satu, dua } = sebutanPihakPerkara(sebutan);
  const unik = (daftar: string[]) => {
    const lihat = new Set<string>();
    return daftar.filter((x) => {
      const k = x.trim().toLowerCase();
      if (!k || lihat.has(k)) return false;
      lihat.add(k);
      return true;
    });
  };
  const alasan = unik([
    `Panggil ${dua}`,
    `${dua} tidak hadir`,
    `Panggil ${satu}`,
    `Panggil ${satu} dan ${dua}`,
    `${satu} tidak hadir`,
    `${satu} dan ${dua} tidak hadir`,
    "Proses Mediasi",
    `Jawaban ${dua}`,
    `Replik ${satu}`,
    `Duplik ${dua}`,
    `Pembuktian ${satu}`,
    `Pembuktian Lanjutan ${satu}`,
    `Pembuktian ${dua}`,
    "Kesimpulan",
    "Musyawarah Majelis",
    "Musyawarah Majelis dan Pembacaan Penetapan",
    ...alasanLazim,
  ]);
  const agenda = unik([
    "Pemeriksaan Pokok Perkara",
    "Mendengarkan Laporan Hasil Mediasi",
    `Jawaban ${dua}`,
    `Replik ${satu}`,
    `Duplik ${dua}`,
    `Pembuktian ${satu}`,
    `Pembuktian Lanjutan ${satu}`,
    `Pembuktian ${dua}`,
    "Kesimpulan",
    "Musyawarah Majelis",
    "Pembacaan Putusan",
    "Musyawarah Majelis dan Pembacaan Penetapan",
    "Pembacaan Penetapan",
    `Panggil ${dua}`,
    `Panggil ${satu}`,
    `Panggil ${satu} dan ${dua}`,
    "SIDANG IKRAR TALAK",
    ...agendaLazim,
  ]);
  return { alasan, agenda };
}
