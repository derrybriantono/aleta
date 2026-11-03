/**
 * ============================================================================
 * STATUS PERKARA - TAMPILAN SEAMLESS (18 Okt 2026)
 * ============================================================================
 *
 * Rancangannya: docs/rancangan/status-perkara-seamless.html. Seamless BUKAN
 * layar lain - ia memakai komponen dan data yang sama dengan tampilan
 * Kompleks (susunan lama) dan hanya mengatur ulang letaknya: kepala ringkas,
 * linimasa, lima kelompok berlipatan, dan kolom ringkasan. Tidak satu fitur
 * pun berpindah ke tempat yang tak terjangkau; daftar di bawah adalah buktinya
 * dan dijaga uji (status-perkara-seamless.test.ts) supaya bagian baru yang
 * ditambahkan kelak tidak lupa diberi kelompok.
 *
 * Berkas ini MURNI (tanpa React, tanpa fetch).
 */

export type TampilanStatus = "kompleks" | "seamless";

/**
 * Bawaan sampai pengguna memilih sendiri. Sejak 18 Okt 2026 (keputusan 99)
 * Seamless; Kompleks tetap dapat dipilih lewat sakelar, dan pilihan pengguna
 * yang sudah tersimpan selalu menang atas bawaan.
 */
export const TAMPILAN_BAWAAN: TampilanStatus = "seamless";

export function kunciTampilanStatus(idPengguna: string | null | undefined): string {
  return `aleta.status-perkara.tampilan.${idPengguna || "tamu"}`;
}

export function tampilanSah(x: unknown): x is TampilanStatus {
  return x === "kompleks" || x === "seamless";
}

export type KelompokSeamless = {
  id: "A" | "B" | "C" | "D" | "E";
  nama: string;
  ikon: string;
  /** Kunci Bagian (lihat `kunci=` pada <Bagian>) yang berada di kelompok ini, urut. */
  bagian: readonly string[];
  /** Mengisi satu baris penuh pada layar yang sangat lebar. */
  lebar?: boolean;
};

/**
 * SEMUA bagian Status Perkara dan kelompoknya. Urutan bagian di dalam
 * kelompok sama dengan urutan di tampilan Kompleks, sehingga membaca dari atas
 * ke bawah tetap berarti hal yang sama pada kedua tampilan.
 */
export const KELOMPOK_SEAMLESS: readonly KelompokSeamless[] = [
  // Urutan rancangan 3 Nov 2026 (keputusan 142): jalannya perkara lebih dulu
  // karena itulah yang sedang diperiksa; pihak dan majelis sudah diringkas di sorotan.
  {
    id: "B",
    nama: "Jalannya perkara",
    ikon: "J",
    bagian: [
      "tahapan",
      "relaas",
      "mediasi",
      "jawaban",
      "sidang",
      "umur-sidang",
      "kalender",
      "saksi",
      "status-pandu-saksi",
      "status-pandu-saksi-pembuktian",
    ],
    lebar: true,
  },
  { id: "A", nama: "Pihak dan majelis", ikon: "P", bagian: ["majelis", "pihak"], lebar: true },
  {
    id: "C",
    nama: "Putusan dan tindak lanjut",
    ikon: "U",
    bagian: ["putusan-lengkap", "putusan", "ikrar", "upaya", "eksekusi", "putusanEcourt", "ecourtAksi"],
  },
  { id: "D", nama: "Berkas, arsip, dan biaya", ikon: "B", bagian: ["berkas", "arsip", "delegasi", "biaya"] },
  {
    id: "E",
    nama: "Penilaian dan analisis",
    ikon: "A",
    bagian: ["rubrik", "sk", "analisa", "analisa-lanjut", "banding-perkara", "prompt-putusan"],
    lebar: true,
  },
] as const;

export function kelompokDariBagian(kunci: string): KelompokSeamless | undefined {
  return KELOMPOK_SEAMLESS.find((g) => g.bagian.includes(kunci));
}

/** Kata lain yang dicari orang untuk satu bagian - ditambahkan pada pencarian judul. */
export const KATA_LAIN_BAGIAN: Readonly<Record<string, string>> = {
  majelis: "hakim ketua panitera jurusita petugas",
  pihak: "penggugat tergugat pemohon termohon kuasa advokat ktp nik kontak whatsapp telepon riwayat peta identitas",
  tahapan: "waktu input diagram",
  sidang: "jadwal agenda tunda penundaan hadir bas berita acara",
  "umur-sidang": "umur lama perkara grafik batas hari sema",
  jawaban: "eksepsi rekonvensi sita marital jaminan jawaban duplik",
  eksekusi: "eksekusi register teguran lelang",
  kalender: "bulan tanggal peristiwa",
  relaas: "panggilan jurusita patut",
  mediasi: "mediator damai",
  saksi: "pemeriksaan sumpah",
  "status-pandu-saksi": "panduan pertanyaan saksi pemeriksaan",
  "status-pandu-saksi-pembuktian": "panduan pertanyaan saksi pemeriksaan pembuktian",
  "putusan-lengkap": "amar pertimbangan",
  putusan: "minutasi bht akta cerai pemberitahuan",
  ikrar: "talak penetapan",
  upaya: "banding kasasi pk",
  putusanEcourt: "tte tanda tangan elektronik",
  ecourtAksi: "e-court verifikasi dokumen jawaban replik duplik sesi",
  arsip: "arsip fisik",
  delegasi: "panggilan luar",
  berkas: "unduh zip gugatan lampiran",
  biaya: "panjar kasir sisa pai",
  rubrik: "nilai skor kelengkapan",
  sk: "dirjen badilag 048 penilaian",
  "analisa-lanjut": "analisis empat puluh satu",
  "banding-perkara": "bandingkan",
  "prompt-putusan": "ai prompt claude perintah project",
  analisa: "garis waktu jeda ketepatan",
};

/** Bagian yang cocok dengan kata cari (judul atau kata lain), paling banyak `batas`. */
export function cariBagianSeamless(
  daftar: ReadonlyArray<{ kunci: string; judul: string }>,
  kata: string,
  batas = 8
): Array<{ kunci: string; judul: string; lewatKataLain: boolean }> {
  const q = kata.trim().toLowerCase();
  if (!q) return [];
  const hasil: Array<{ kunci: string; judul: string; lewatKataLain: boolean }> = [];
  for (const b of daftar) {
    const lewatJudul = b.judul.toLowerCase().includes(q);
    const lewatLain = !lewatJudul && (KATA_LAIN_BAGIAN[b.kunci] ?? "").toLowerCase().includes(q);
    if (lewatJudul || lewatLain) hasil.push({ ...b, lewatKataLain: lewatLain });
    if (hasil.length >= batas) break;
  }
  return hasil;
}

/* ========================================================================== */
/* Linimasa                                                                   */
/* ========================================================================== */

export type PeristiwaLinimasa = {
  tanggal: string;
  jenis: string;
  judul: string;
  ditunda?: boolean;
};

export type TitikLinimasa = {
  kunci: string;
  nama: string;
  /** Tanggal ISO, atau kosong bila belum terjadi. */
  tanggal: string;
  keadaan: "lalu" | "kini" | "depan";
  ditunda: boolean;
  /** Kunci Bagian yang dibuka ketika titiknya diketuk. */
  ke: string;
};

const JENIS_LINIMASA = new Set(["daftar", "mediasi", "sidang", "ikrar", "putusan", "minutasi", "bht", "akta"]);

/**
 * Titik-titik linimasa dari peristiwa yang SUDAH disusun layar (susunPeristiwa)
 * - tidak ada pembacaan baru. Mediasi yang berderet dirangkum satu titik;
 * tiap sidang satu titik; titik putusan, minutasi, dan akta cerai yang belum
 * terjadi tetap digambar sebagai "depan" supaya orang melihat ke mana perkara
 * ini menuju. Titik "kini" adalah sidang terdekat yang belum lewat, atau
 * peristiwa terakhir bila semuanya sudah lewat.
 */
export function susunLinimasa(
  peristiwa: readonly PeristiwaLinimasa[],
  hariIni: string,
  opsi: { sudahPutus: boolean; adaIkrar?: boolean } = { sudahPutus: false }
): TitikLinimasa[] {
  const sumber = peristiwa.filter((p) => JENIS_LINIMASA.has(p.jenis));
  const titik: Omit<TitikLinimasa, "keadaan">[] = [];
  let nomorSidang = 0;
  let mediasiSudah = false;
  for (const p of sumber) {
    if (p.jenis === "sidang") {
      nomorSidang += 1;
      titik.push({ kunci: `sidang-${nomorSidang}`, nama: `Sidang ${nomorSidang}`, tanggal: p.tanggal, ditunda: Boolean(p.ditunda), ke: "sidang" });
    } else if (p.jenis === "mediasi") {
      if (mediasiSudah) continue;
      mediasiSudah = true;
      titik.push({ kunci: "mediasi", nama: "Mediasi", tanggal: p.tanggal, ditunda: false, ke: "mediasi" });
    } else if (p.jenis === "daftar") {
      titik.push({ kunci: "daftar", nama: "Daftar", tanggal: p.tanggal, ditunda: false, ke: "tahapan" });
    } else if (p.jenis === "ikrar") {
      titik.push({ kunci: "ikrar", nama: "Ikrar talak", tanggal: p.tanggal, ditunda: false, ke: "ikrar" });
    } else if (p.jenis === "putusan") {
      titik.push({ kunci: "putusan", nama: p.judul || "Putusan", tanggal: p.tanggal, ditunda: false, ke: "putusan" });
    } else if (p.jenis === "minutasi") {
      titik.push({ kunci: "minutasi", nama: "Minutasi", tanggal: p.tanggal, ditunda: false, ke: "putusan" });
    } else if (p.jenis === "bht") {
      titik.push({ kunci: "bht", nama: "BHT", tanggal: p.tanggal, ditunda: false, ke: "putusan" });
    } else if (p.jenis === "akta") {
      titik.push({ kunci: "akta", nama: "Akta cerai", tanggal: p.tanggal, ditunda: false, ke: "putusan" });
    }
  }

  const ada = (k: string) => titik.some((t) => t.kunci === k);
  if (!opsi.sudahPutus && !ada("putusan")) {
    titik.push({ kunci: "putusan", nama: "Putusan", tanggal: "", ditunda: false, ke: "putusan" });
  }
  if (!ada("minutasi")) titik.push({ kunci: "minutasi", nama: "Minutasi", tanggal: "", ditunda: false, ke: "putusan" });
  if (!ada("akta") && !opsi.adaIkrar) titik.push({ kunci: "akta", nama: "Akta cerai", tanggal: "", ditunda: false, ke: "putusan" });
  titik.push({ kunci: "arsip", nama: "Arsip", tanggal: "", ditunda: false, ke: "arsip" });

  // Titik berurut menurut tanggal; yang belum bertanggal tetap di belakang dengan
  // urutan semula (putusan -> minutasi -> akta -> arsip).
  const bertanggal = titik.filter((t) => t.tanggal).sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0));
  const belum = titik.filter((t) => !t.tanggal);
  const urut = [...bertanggal, ...belum];

  // Titik "kini": sidang pertama yang belum lewat; bila tidak ada, titik bertanggal terakhir.
  let kini = urut.findIndex((t) => t.kunci.startsWith("sidang-") && t.tanggal >= hariIni);
  if (kini < 0) kini = Math.max(0, bertanggal.length - 1);

  return urut.map((t, i) => ({
    ...t,
    keadaan: i < kini ? "lalu" : i === kini ? "kini" : "depan",
  }));
}


/* ========================================================================== */
/* Nama majelis di sorotan                                                    */
/* ========================================================================== */

const GELAR_DEPAN = /^(drs?|dra|prof|ir|h|hj|dr|kh)\.?$/i;

/**
 * Nama tanpa gelar: bagian sebelum koma pertama, dan gelar depan (Drs., H.,
 * Hj., Dr., Prof.) dibuang. Gelar lengkap tetap ada di bagian Majelis dan petugas.
 */
export function namaTanpaGelar(nama: string): string {
  const depan = String(nama ?? "").split(",")[0].trim();
  const kata = depan.split(/\s+/).filter(Boolean);
  while (kata.length > 1 && GELAR_DEPAN.test(kata[0])) kata.shift();
  return kata.join(" ");
}

/** "Ahmad Fauzan (K), Siti Rahmawati, Rizal Pratama" - Ketua ditandai (K). */
export function namaMajelisSingkat(majelis: ReadonlyArray<{ nama: string; jabatan?: string; kedudukan?: string }>): string {
  return majelis
    .map((m) => {
      const ketua = /ketua/i.test(`${m.jabatan ?? ""} ${m.kedudukan ?? ""}`);
      return `${namaTanpaGelar(m.nama)}${ketua ? " (K)" : ""}`;
    })
    .join(", ");
}

/* ========================================================================== */
/* Kelompok dan bagian yang terbuka sendiri menurut tahap perkara             */
/* ========================================================================== */

export type TahapPerkaraTampil = "daftar" | "mediasi" | "sidang" | "pembuktian" | "putus" | "arsip";

/**
 * Tahap perkara menentukan kelompok dan bagian yang terbuka bawaan di Seamless
 * (rancangan 3 Nov 2026, keputusan 2a). Selalu terlipat bawaan, apa pun
 * tahapnya: Majelis dan petugas, Para pihak, Penilaian SIPP SK 048/2024.
 * Pilihan buka-tutup pengguna tetap menang.
 */
export function bukaMenurutTahap(b: {
  sudahPutus: boolean;
  sudahDiarsipkan: boolean;
  adaSidang: boolean;
  mediasiBerjalan: boolean;
  agendaBerikutPembuktian: boolean;
}): { tahap: TahapPerkaraTampil; kelompok: ReadonlySet<string>; bagian: ReadonlySet<string> } {
  if (b.sudahPutus && b.sudahDiarsipkan) {
    return {
      tahap: "arsip",
      kelompok: new Set(["C", "D"]),
      bagian: new Set(["putusan-lengkap", "putusan", "putusanEcourt", "berkas", "arsip"]),
    };
  }
  if (b.sudahPutus) {
    return {
      tahap: "putus",
      kelompok: new Set(["C"]),
      bagian: new Set(["putusan-lengkap", "putusan", "ikrar", "putusanEcourt"]),
    };
  }
  if (b.agendaBerikutPembuktian) {
    return {
      tahap: "pembuktian",
      kelompok: new Set(["B"]),
      bagian: new Set(["sidang", "saksi", "status-pandu-saksi", "status-pandu-saksi-pembuktian"]),
    };
  }
  if (b.mediasiBerjalan) return { tahap: "mediasi", kelompok: new Set(["B"]), bagian: new Set(["mediasi"]) };
  if (b.adaSidang) return { tahap: "sidang", kelompok: new Set(["B"]), bagian: new Set(["sidang"]) };
  return { tahap: "daftar", kelompok: new Set(["B"]), bagian: new Set(["tahapan"]) };
}

/**
 * Pemisah antar-butir pada baris ringkas Status Perkara (arahan Derry 3 Nov 2026:
 * "|" menggantikan "·"). SATU konstanta supaya konsisten di kedua mode.
 */
// Jarak kiri-kanan ~0,58em (spasi biasa + spasi sepertiga em) - tidak mepet, tetap rapi di HP.
export const PEMISAH_RINGKAS = "  |  ";

/** Menyambung butir ringkas dengan pemisah, melewati yang kosong. */
export function gabungRingkas(butir: ReadonlyArray<string | null | undefined | false>): string {
  return butir.filter(Boolean).join(PEMISAH_RINGKAS);
}
