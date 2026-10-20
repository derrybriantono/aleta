/**
 * ============================================================================
 * PANDUAN PEMERIKSAAN SAKSI - BENTUK DATA DAN ATURAN MURNI (SISI LAYAR)
 * ============================================================================
 *
 * Diminta hakim 18 Oktober 2026: pertanyaan saksi dijadikan panduan di Jadwal
 * Sidang dan Status Perkara, "agar memandu saat sidang".
 *
 * Isi pertanyaannya TIDAK ditulis di sini dan tidak disalin dari mana pun:
 * katalog dan mesinnya milik ekstensi (ekstensi-sipp/saksi-katalog*.js) yang
 * dibaca sisi server (server/shared/pandu-saksi.ts) lewat rute
 * /api/aleta-ecourt/pandu-saksi. Berkas ini hanya memuat:
 *   - bentuk jawaban rute (dibaca layar),
 *   - cara menurunkan keadaan dari data sidang yang SUDAH dibaca layar,
 *   - hitungan pokok wajib yang sudah ditanyakan kepada berapa saksi,
 *   - kunci penyimpanan centang di peramban.
 *
 * Berkas ini tidak mengimpor apa pun dari server, jadi aman untuk komponen
 * layar dan tidak membawa katalog (±2,6 MB) ke peramban.
 */

// ─── Bentuk jawaban rute ─────────────────────────────────────────────────────

export type PihakSaksi = "P" | "T";

export type PanduanTanya = {
  id: string;
  teks: string;
  /** inti = pokok; pilihan = bila perlu; tambahan = hanya pada keadaan tertentu. */
  tingkat: string;
  kelompok: string;
};

export type PanduanPokok = {
  id: string;
  judul: string;
  uraian: string;
  /** Unsur pembuktian yang harus ditanyakan. */
  wajib: boolean;
  /** Hanya rujukan yang sudah terverifikasi. */
  dasarHukum: Array<{ rujukan: string; uraian: string }>;
  tanya: PanduanTanya[];
};

export type PanduanPeranKeterangan = {
  kode: string;
  label: string;
  pokok: PanduanPokok[];
};

export type PanduanNilai = { nilai: string; label: string };

export type PanduanIsianKeadaan = {
  kunci: string;
  label: string;
  jamak: boolean;
  nilai: PanduanNilai[];
  /** Nilai yang dipakai sekarang. */
  terpilih: string[];
  /** "otomatis" = diturunkan dari data perkara; "pilihan" = diisi petugas. */
  asal: "otomatis" | "pilihan";
  /** Keadaan ini menggeser pertanyaan saksi, atau pertanyaan keterangan anak/calon/orang tua. */
  untuk: "saksi" | "keterangan";
};

export type PanduanBagianPihak = {
  pihak: PihakSaksi;
  label: string;
  pokok: PanduanPokok[];
  jumlahTanya: number;
};

export type PanduanKeterangan = {
  peran: PanduanPeranKeterangan[];
  /** Ada butir sensitif (sebab dan keadaan pendorong) yang ditahan sampai petugas memintanya. */
  adaButirSensitif: boolean;
  butirSensitifTampil: boolean;
};

export type PanduanTersedia = {
  tersedia: true;
  kunci: string;
  judul: string;
  sebutan: { satu: string; dua: string };
  keadaan: PanduanIsianKeadaan[];
  keadaanDipakai: Record<string, string | string[]>;
  saksi: { P: PanduanBagianPihak; T: PanduanBagianPihak };
  keterangan: PanduanKeterangan | null;
  /** Bagian saksi tergugat perlu dibuka sendiri (harta bersama, kewarisan): isinya berbeda dari saksi penggugat. */
  tergugatBerbeda: boolean;
};

export type PanduanTakAda = {
  tersedia: false;
  alasan: string;
};

export type PanduanSaksi = PanduanTersedia | PanduanTakAda;

export const PESAN_BELUM_ADA_PANDUAN = "Belum ada panduan pertanyaan untuk jenis perkara ini";

// ─── Perkara yang dipandu ────────────────────────────────────────────────────

export type PerkaraPandu = {
  nomorPerkara: string;
  jenisPerkaraId?: number | string | null;
  alurPerkaraId?: number | string | null;
  jenisPerkara?: string | null;
  /** I28 18 Okt: Lain-Lain Pdt.P yang petitum/posita-nya menyebut mafqud (bot); katalog mafqud dikenali lewat nama, jadi kata "mafqud" ditambahkan ke nama yang dikirim. */
  mafqud?: boolean | null;
};

/**
 * Nomor jenis perkara dari NAMA jenisnya - hanya cadangan untuk bot lama yang
 * belum mengirim jenisPerkaraId. Nomor dari SIPP selalu didahulukan. Nama yang
 * tidak dikenal menghasilkan null (dan panduan menjawab "belum ada").
 */
export function jenisPerkaraIdDariNama(nama: string | null | undefined, alur?: number | string | null): number | null {
  const t = String(nama ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return null;
  const alurAngka = Number(alur) || 0;
  if (/cerai\s*talak/.test(t)) return 346;
  if (/cerai\s*gugat/.test(t)) return 347;
  if (/harta\s*bersama/.test(t)) return 348;
  if (/penguasaan\s*anak/.test(t)) return 349;
  // W3b 21 Okt: blangko Derry baru gelombang 3 (dibaca lebih dulu dari "nafkah anak" 743).
  if (/nafkah\s*anak\s*oleh\s*ibu/.test(t)) return 350;
  if (/pencabutan\s*kekuasaan\s*orang\s*tua/.test(t)) return 353;
  if (/pencabutan\s*kekuasaan\s*wali/.test(t)) return 355;
  if (/penunjukan\s*orang\s*lain\s*sebagai\s*wali/.test(t)) return 356;
  if (/ganti\s*rugi\s*terhadap\s*wali/.test(t)) return 357;
  if (/nafkah\s*anak/.test(t)) return 743;
  if (/asal.?usul\s*anak/.test(t)) return 358;
  if (/dispensasi/.test(t)) return 362;
  if (/wali\s*adh[oa]l/.test(t)) return 363;
  if (/perwalian/.test(t)) return 354;
  if (/poligami/.test(t)) return 341;
  if (/pencegahan\s*perkawinan/.test(t)) return 342;
  // W3a 21 Okt: penolakan perkawinan (343), kelalaian atas kewajiban suami/istri (345), hak-hak bekas istri (351), pengesahan anak (352), perkawinan campuran (359), izin kawin (361).
  if (/penolakan\s*perkawinan/.test(t)) return 343;
  if (/kelalaian\s*(?:atas\s*)?kewajiban/.test(t)) return 345;
  if (/bekas\s*istri/.test(t)) return 351;
  if (/pengesahan\s*anak/.test(t)) return 352;
  if (/perkawinan\s*campuran/.test(t)) return 359;
  if (/izin\s*kawin/.test(t)) return 361;
  if (/pembatalan\s*perkawinan/.test(t)) return 344;
  if (/ekonomi\s*syariah/.test(t)) return 370;
  if (/p3hp|penetapan\s*ahli\s*waris/.test(t)) return 371;
  if (/kewarisan|waris/.test(t)) return 364;
  if (/wasiat/.test(t)) return 365;
  if (/hibah/.test(t)) return 366; // I28 18 Okt
  if (/wakaf/.test(t)) return 367;
  if (/istbat|itsbat|isbat|pengesahan\s*perkawinan/.test(t)) return 360;
  if (/hak\s*asuh|hadhanah|hadanah/.test(t)) return 369;
  if (/lain/.test(t) && alurAngka === 16) return 369;
  return null;
}

/** Nomor jenis yang dipakai: nomor dari SIPP bila ada, kalau tidak dari nama jenis. */
export function jenisPerkaraIdPandu(perkara: PerkaraPandu): number | null {
  const langsung = Number(perkara.jenisPerkaraId);
  if (Number.isFinite(langsung) && langsung > 0) return langsung;
  return jenisPerkaraIdDariNama(perkara.jenisPerkara, perkara.alurPerkaraId);
}

// ─── Keadaan dari data sidang ────────────────────────────────────────────────

export type BahanKehadiran = {
  /** perkara_jadwal_sidang.dihadiri_oleh: 1 semua pihak, 2 pihak pertama saja, 3 pihak kedua saja, 4 tidak ada yang hadir. */
  dihadiriOleh?: number | null;
  /** Putusan dijatuhkan tanpa hadirnya tergugat. */
  verstekPutusan?: boolean;
  /** Tergugat pernah hadir pada sidang sebelumnya. */
  tergugatPernahHadir?: boolean;
};

/**
 * Kehadiran Tergugat/Termohon menurut sidang yang dibaca layar. "" = belum
 * dapat ditentukan (semua pihak tidak hadir, hanya tergugat yang hadir, atau
 * kolomnya kosong): panduan lalu memakai bawaan katalog dan petugas boleh
 * mengubahnya.
 */
export function kehadiranDariSidang(bahan: BahanKehadiran): "" | "verstek" | "kontradiktoir" | "t-tidak-hadir-setelah-mediasi" {
  if (bahan.verstekPutusan === true) return "verstek";
  const hadir = bahan.dihadiriOleh;
  if (hadir === 1) return "kontradiktoir";
  if (hadir === 2) return bahan.tergugatPernahHadir === true ? "t-tidak-hadir-setelah-mediasi" : "verstek";
  return "";
}

const KUMULASI_KODE_KE_KATALOG: Readonly<Record<string, string>> = {
  "hak-asuh-anak": "hak-asuh",
  "hak-asuh": "hak-asuh",
  "nafkah-anak": "nafkah-anak",
  "nafkah-iddah": "nafkah-iddah",
  mutah: "mutah",
  "nafkah-madliyah": "nafkah-madliyah",
  "harta-bersama": "harta-bersama",
  "itsbat-nikah": "itsbat-nikah",
};

/** Kumulasi katalog dari kumulasi yang sudah dikenali portal, ditambah rekonvensi bila jawabannya memuat gugatan balik. */
export function kumulasiDariPortal(
  kumulasi: { daftar?: Array<{ kode?: string }> } | null | undefined,
  adaRekonvensi: boolean
): string[] {
  const hasil: string[] = [];
  for (const butir of Array.isArray(kumulasi?.daftar) ? kumulasi.daftar : []) {
    const padanan = KUMULASI_KODE_KE_KATALOG[String(butir?.kode ?? "")];
    if (padanan && !hasil.includes(padanan)) hasil.push(padanan);
  }
  if (adaRekonvensi && !hasil.includes("rekonvensi")) hasil.push("rekonvensi");
  return hasil;
}

/** Keadaan awal panduan dari data sidang. Kunci yang tidak dapat ditentukan tidak dikirim. */
export function keadaanAwalDariSidang(bahan: BahanKehadiran & {
  kumulasi?: { daftar?: Array<{ kode?: string }> } | null;
  adaRekonvensi?: boolean;
}): Record<string, string | string[]> {
  const hasil: Record<string, string | string[]> = {};
  const hadir = kehadiranDariSidang(bahan);
  if (hadir) hasil.kehadiran = hadir;
  const kumulasi = kumulasiDariPortal(bahan.kumulasi, bahan.adaRekonvensi === true);
  if (kumulasi.length > 0) hasil.kumulasi = kumulasi;
  return hasil;
}

// ─── Agenda ──────────────────────────────────────────────────────────────────

/** Agenda yang memeriksa saksi atau membuktikan: panduan ditampilkan menonjol. */
export function agendaPembuktianSaksi(agenda: string | null | undefined): boolean {
  return /pembuktian|saksi|bukti/i.test(String(agenda ?? ""));
}

// ─── Kapan tombol "Pertanyaan saksi" tampil di Jadwal Sidang ─────────────────

/**
 * Tombol "Pertanyaan saksi" di Jadwal Sidang HANYA untuk perkara yang sudah
 * masuk pemeriksaan menurut aplikasi antrian (kolom `disidang`, 18 Okt 2026,
 * permintaan hakim):
 *   - 1..9  sedang disidang di ruang itu;
 *   - 10    selesai disidang hari itu (panitera pengganti masih dapat melengkapi
 *           centang sesudah sidang).
 * NULL (menunggu), tidak ada baris antrian, atau nilai tak dikenal = tidak tampil:
 * perkara yang masih mengantre belum diperiksa.
 */
export function sudahMasukPemeriksaan(disidang: number | null | undefined, tandaManual?: TandaManualPemeriksaan): boolean {
  // Tanda petugas (Tandai sedang berjalan / diskors / Selesai) ikut dihitung walau perkaranya tanpa nomor antrian.
  if (tandaManual && (tandaManual.berjalan || tandaManual.diskors || tandaManual.selesai)) return true;
  if (disidang === null || disidang === undefined) return false;
  const n = Number(disidang);
  return Number.isInteger(n) && n >= 1 && n <= 10;
}

/**
 * Tanda yang diberikan petugas di Jadwal Sidang (diputuskan pengguna 18 Okt 2026): perkara yang ditandai
 * sedang berjalan, diskors, atau selesai dianggap sudah masuk pemeriksaan walau tidak punya nomor antrian.
 * Sidang yang menunggu tanpa tanda apa pun tetap tidak diberi tombol.
 */
export type TandaManualPemeriksaan = { berjalan?: boolean; diskors?: boolean; selesai?: boolean };

// ─── Saksi per pihak ─────────────────────────────────────────────────────────

/** Paling banyak saksi per pihak yang dipandu (sama dengan ekstensi: 5 untuk penggugat, 4 untuk tergugat). */
export const BATAS_SAKSI_PIHAK: Readonly<Record<PihakSaksi, number>> = { P: 5, T: 4 };

export type SaksiPandu = { kunci: string; nama: string };

/**
 * Daftar saksi satu pihak: nama dari SIPP bila ada, minimal dua baris supaya
 * hitungan "dua saksi" tetap bermakna walau namanya belum terdaftar.
 */
export function daftarSaksiPandu(pihak: PihakSaksi, namaSipp: ReadonlyArray<string> | null | undefined, tambahan = 0): SaksiPandu[] {
  const nama = (namaSipp ?? []).map((n) => String(n ?? "").trim()).filter(Boolean);
  const dasar = Math.max(nama.length, 2);
  const jumlah = Math.min(BATAS_SAKSI_PIHAK[pihak], dasar + Math.max(0, tambahan));
  return Array.from({ length: jumlah }, (_, i) => ({
    kunci: `${pihak}${i + 1}`,
    nama: nama[i] ?? `Saksi ${i + 1}`,
  }));
}

// ─── Centang dan hitungan pokok ──────────────────────────────────────────────

/** Centang: kunci "<saksi>|<id butir>" -> true. */
export type CentangPandu = Record<string, boolean>;

export const kunciCentang = (saksiKunci: string, butirId: string) => `${saksiKunci}|${butirId}`;

export type KedudukanPokok = {
  pokok: PanduanPokok;
  /** Banyaknya saksi yang semua butir inti pokok ini sudah tercentang. */
  saksiLengkap: number;
  /** Butir inti pokok ini yang tercentang, dijumlah untuk seluruh saksi. */
  tercentang: number;
  jumlahButirInti: number;
  /** Pokok wajib yang belum lengkap pada sedikitnya dua saksi. */
  kurang: boolean;
};

/** Butir yang dihitung untuk satu pokok: butir inti; bila pokok tak punya butir inti, semua butirnya. */
export function butirHitung(pokok: PanduanPokok): PanduanTanya[] {
  const inti = pokok.tanya.filter((t) => t.tingkat === "inti");
  return inti.length > 0 ? inti : pokok.tanya;
}

export const SAKSI_MINIMAL = 2;

export function hitungPokok(pokok: PanduanPokok[], saksi: ReadonlyArray<SaksiPandu>, centang: CentangPandu): KedudukanPokok[] {
  return pokok.map((p) => {
    const butir = butirHitung(p);
    let saksiLengkap = 0;
    let tercentang = 0;
    for (const s of saksi) {
      const ya = butir.filter((b) => centang[kunciCentang(s.kunci, b.id)] === true).length;
      tercentang += ya;
      if (butir.length > 0 && ya === butir.length) saksiLengkap += 1;
    }
    return {
      pokok: p,
      saksiLengkap,
      tercentang,
      jumlahButirInti: butir.length,
      kurang: p.wajib && butir.length > 0 && saksiLengkap < SAKSI_MINIMAL,
    };
  });
}

/** Kalimat peringatan untuk pokok wajib yang belum lengkap (kosong bila tidak ada). */
export function peringatanPokokWajib(kedudukan: ReadonlyArray<KedudukanPokok>): string[] {
  return kedudukan
    .filter((k) => k.kurang)
    .map((k) => `${k.pokok.judul}: baru lengkap pada ${k.saksiLengkap} dari minimal ${SAKSI_MINIMAL} saksi`);
}

// ─── Penyimpanan di peramban ─────────────────────────────────────────────────

export function kunciSimpanCentang(nomorPerkara: string, sidangId: string): string {
  return `aleta-pandu-saksi:${String(nomorPerkara).trim()}:${String(sidangId || "tanpa-sidang").trim()}`;
}

export type IsiSimpanan = { centang: CentangPandu; tambahan: Record<PihakSaksi, number> };

export const SIMPANAN_KOSONG: IsiSimpanan = { centang: {}, tambahan: { P: 0, T: 0 } };

export function bacaSimpanan(kunci: string): IsiSimpanan {
  try {
    const mentah = window.localStorage.getItem(kunci);
    if (!mentah) return SIMPANAN_KOSONG;
    const nilai = JSON.parse(mentah) as Partial<IsiSimpanan> | null;
    const centang: CentangPandu = {};
    for (const [k, v] of Object.entries(nilai?.centang ?? {})) if (v === true) centang[k] = true;
    const angka = (x: unknown) => Math.min(5, Math.max(0, Number(x) || 0));
    return { centang, tambahan: { P: angka(nilai?.tambahan?.P), T: angka(nilai?.tambahan?.T) } };
  } catch {
    return SIMPANAN_KOSONG;
  }
}

export function tulisSimpanan(kunci: string, isi: IsiSimpanan): void {
  try {
    window.localStorage.setItem(kunci, JSON.stringify(isi));
  } catch {
    /* penyimpanan peramban boleh gagal: panduan tetap berjalan tanpa ingatan */
  }
}

export function hapusSimpanan(kunci: string): void {
  try {
    window.localStorage.removeItem(kunci);
  } catch {
    /* sama seperti di atas */
  }
}

// ─── Kelas layar ─────────────────────────────────────────────────────────────

export type KelasLayar = "ponsel" | "tablet" | "laptop" | "tv";

/** HP < 640, tablet < 1024, laptop < 1600, TV (layar sidang 40-65 inci) >= 1600 piksel. */
export function kelasLayarDariLebar(lebar: number): KelasLayar {
  if (!(lebar > 0)) return "laptop";
  if (lebar < 640) return "ponsel";
  if (lebar < 1024) return "tablet";
  if (lebar < 1600) return "laptop";
  return "tv";
}
