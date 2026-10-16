/**
 * ============================================================================
 * F3.2 - KEHADIRAN RINCI DAN DINAMIS PER ORANG (17 Okt 2026)
 * ============================================================================
 *
 * Satu sumber aturan untuk Jadwal Sidang, layar antrian operator, blangko
 * Tunda/Putus, BAS, dan panel ekstensi di SIPP. Fungsi murni: data kehadiran
 * masuk, kalimat dan usulan keluar - tidak ada yang ditulis di sini.
 *
 * SUMBERNYA DUA, DIGABUNG
 * -----------------------
 * 1. Kehadiran rinci ALETA (aleta_bot_antrian_kehadiran): satu baris per orang
 *    - Penggugat I, Kuasa Tergugat, Saksi Penggugat 2 - dicatat petugas lewat
 *    tombol Antrian / meja pengambilan, atau WhatsApp.
 * 2. Kolom waktu aplikasi antrian (pihak_1, pihak_2, saksi): diisi mesin kios.
 *    Hanya tahu SISI, bukan orangnya. Dipakai bila sisi itu tidak punya catatan
 *    rinci - "Penggugat hadir 08.47" tetap benar walau tidak tahu pribadi atau
 *    kuasanya.
 *
 * DIUKUR ATAS DATA NYATA (17 Okt 2026, server, baca-saja)
 * -------------------------------------------------------
 * 212 baris rekaman antrian 28 Sep - 16 Okt (14 hari) dibandingkan dengan
 * perkara_jadwal_sidang.dihadiri_oleh: sisi antrian -> 1/2/3 COCOK 179 dari
 * 184 (97,3%). 27 baris antriannya kosong; SIPP mencatat 4 (15), 1 (9), 2 (3)
 * - jadi antrian kosong BUKAN "tidak hadir" dan tidak diusulkan apa pun.
 * Perkara bersama turut tergugat (66 sidang) dicatat petugas dengan 1/2/3/4,
 * tidak pernah 13/14/15 - usulan utama karena itu tetap 1-4; sandi rinci SIPP
 * hanya disebut sebagai pilihan lain.
 */

import { sebutanPihakPerkara } from "@/lib/sebutan-pihak";

export type KehadiranOrang = {
  /** Kunci baris di ALETA - dipakai menandai pulang / sudah diperiksa. */
  id?: string;
  /** penggugat | pemohon | tergugat | termohon | turut-tergugat | intervenien | saksi */
  peran: string;
  urutanPihak?: string;
  sebagaiKuasa?: boolean;
  nama?: string;
  /** Kolom antrian yang diisi: pihak_1 | pihak_2 | saksi. */
  sisi?: string;
  /** Saksi siapa: pihak_1 | pihak_2 | "" (tidak disebut). */
  saksiUntuk?: string;
  /** "08:47" (HH:MM). */
  jam?: string;
  waktuHadir?: string;
  sumber?: string;
  sebutan?: string;
  /** "" = belum pulang. */
  pulangJam?: string;
  /** "" = belum diperiksa (saksi). */
  diperiksaJam?: string;
};

/** Baris antrian sidang hari itu (bentuk peta antrian bot). */
export type AntrianKehadiran =
  | {
      pihak1?: string | null;
      pihak2?: string | null;
      saksi?: string | null;
      keadaan?: string;
      /** Nomor ruang bila SEDANG disidang (disidang 1..9). */
      diRuang?: number | null;
      selesaiDisidang?: boolean;
      /** Sedang disidang walau nomor ruangnya tidak diketahui. */
      sedangDisidang?: boolean;
      jamPanggil?: string;
    }
  | null
  | undefined;

export type BahanPerkaraHadir = {
  /** Sebutan pihak pertama/kedua: "Penggugat"/"Tergugat" atau "Pemohon"/"Termohon". */
  sebutanSatu?: string;
  sebutanDua?: string;
  /** Permohonan tanpa pihak kedua (itsbat voluntair, dispensasi): tidak ada sisi kedua. */
  tanpaPihakKedua?: boolean;
  /** Saksi yang DIAJUKAN tiap sisi menurut SIPP (perkara_pihak5). */
  saksiDiajukanP?: number;
  saksiDiajukanT?: number;
  namaSaksiP?: string[];
  namaSaksiT?: string[];
  /** Perkara punya turut tergugat / intervensi (SIPP perkara_pihak4 / perkara_pihak3). */
  adaTurut?: boolean;
  adaIntervensi?: boolean;
  /** Jumlah orang pada sisi pertama / kedua (dipakai sandi "sebagian"). */
  jumlahPihak1?: number;
  jumlahPihak2?: number;
};

export type GolonganSisi = {
  hadir: boolean;
  /** Pihaknya sendiri. */
  sendiri: KehadiranOrang[];
  kuasa: KehadiranOrang[];
  /** Jam datang PERTAMA pada sisi ini ("08:47"). */
  jam: string;
  /** true: hanya kolom antrian yang terisi - tidak tahu pribadi atau kuasa. */
  dariAntrianSaja: boolean;
  /** Semua yang hadir pada sisi ini sudah pulang. */
  semuaPulang: boolean;
};

export type KeadaanRuang = "belum" | "menunggu" | "disidang" | "selesai";

export type KehadiranTersusun = {
  pihak1: GolonganSisi;
  pihak2: GolonganSisi;
  turut: GolonganSisi;
  intervensi: GolonganSisi;
  saksiP: KehadiranOrang[];
  saksiT: KehadiranOrang[];
  /** Saksi yang sisinya tidak disebut (catatan lama, atau mesin kios). */
  saksiLain: KehadiranOrang[];
  ruang: KeadaanRuang;
  noRuang: number | null;
  /** Ada sesuatu yang tercatat sama sekali. */
  adaCatatan: boolean;
};

const PERAN_SATU = new Set(["penggugat", "pemohon", "pelawan", "pembanding"]);
const PERAN_DUA = new Set(["tergugat", "termohon", "terlawan", "terbanding"]);

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/** "08:47" / "08:47:12" -> "08.47" (penulisan jam bahasa Indonesia). */
export function jamTitik(jam: string | null | undefined): string {
  const cocok = /^(\d{1,2})[:.](\d{2})/.exec(teks(jam));
  return cocok ? `${cocok[1].padStart(2, "0")}.${cocok[2]}` : "";
}

function golonganKosong(): GolonganSisi {
  return { hadir: false, sendiri: [], kuasa: [], jam: "", dariAntrianSaja: false, semuaPulang: false };
}

function jamTerawal(daftar: KehadiranOrang[]): string {
  const jam = daftar.map((o) => teks(o.jam)).filter(Boolean).sort();
  return jam[0] ?? "";
}

function tutupGolongan(g: GolonganSisi) {
  const semua = [...g.sendiri, ...g.kuasa];
  if (semua.length) {
    g.hadir = true;
    g.jam = jamTerawal(semua);
    g.semuaPulang = semua.every((o) => Boolean(teks(o.pulangJam)));
  }
}

/** Golongan tempat satu orang berdiri. */
export function golonganOrang(orang: KehadiranOrang): "p1" | "p2" | "turut" | "intervensi" | "saksi" | "" {
  const peran = teks(orang.peran).toLowerCase();
  if (peran === "saksi") return "saksi";
  if (peran === "turut-tergugat") return "turut";
  if (peran === "intervenien" || peran === "intervensi") return "intervensi";
  if (PERAN_SATU.has(peran)) return "p1";
  if (PERAN_DUA.has(peran)) return "p2";
  // Peran lama yang tidak dikenali jatuh menurut kolom antriannya.
  if (orang.sisi === "pihak_1") return "p1";
  if (orang.sisi === "pihak_2") return "p2";
  return "";
}

/**
 * Menyusun kehadiran satu sidang dari catatan rinci + kolom antrian.
 * Catatan yang dibatalkan sudah tidak dikirim bot (dibatalkan_pada IS NULL).
 */
export function susunKehadiran(
  hadir: KehadiranOrang[] | null | undefined,
  antrian: AntrianKehadiran
): KehadiranTersusun {
  const hasil: KehadiranTersusun = {
    pihak1: golonganKosong(),
    pihak2: golonganKosong(),
    turut: golonganKosong(),
    intervensi: golonganKosong(),
    saksiP: [],
    saksiT: [],
    saksiLain: [],
    ruang: "belum",
    noRuang: null,
    adaCatatan: false,
  };

  for (const orang of Array.isArray(hadir) ? hadir : []) {
    const gol = golonganOrang(orang);
    if (!gol) continue;
    if (gol === "saksi") {
      if (orang.saksiUntuk === "pihak_1") hasil.saksiP.push(orang);
      else if (orang.saksiUntuk === "pihak_2") hasil.saksiT.push(orang);
      else hasil.saksiLain.push(orang);
      continue;
    }
    const sasaran =
      gol === "p1" ? hasil.pihak1 : gol === "p2" ? hasil.pihak2 : gol === "turut" ? hasil.turut : hasil.intervensi;
    (orang.sebagaiKuasa ? sasaran.kuasa : sasaran.sendiri).push(orang);
  }
  for (const g of [hasil.pihak1, hasil.pihak2, hasil.turut, hasil.intervensi]) tutupGolongan(g);

  // Kolom antrian mengisi sisi yang TIDAK punya catatan rinci (mesin kios).
  const kolom: Array<[GolonganSisi, string | null | undefined]> = [
    [hasil.pihak1, antrian?.pihak1],
    [hasil.pihak2, antrian?.pihak2],
  ];
  // Nilai kolom yang bukan jam (mis. "hadir" dari ringkasan antrian blangko)
  // tetap berarti hadir - hanya jamnya yang tidak diketahui.
  const jamKolom = (nilai: string | null | undefined) => (/^\d{1,2}[:.]\d{2}/.test(teks(nilai)) ? teks(nilai).slice(0, 5) : "");
  for (const [g, jam] of kolom) {
    if (!g.hadir && teks(jam)) {
      g.hadir = true;
      g.jam = jamKolom(jam);
      g.dariAntrianSaja = true;
    }
  }
  const jumlahSaksiRinci = hasil.saksiP.length + hasil.saksiT.length + hasil.saksiLain.length;
  if (jumlahSaksiRinci === 0 && teks(antrian?.saksi)) {
    hasil.saksiLain.push({ peran: "saksi", jam: jamKolom(antrian?.saksi), sumber: "mesin" });
  }

  const diRuang = Number(antrian?.diRuang);
  if (antrian?.selesaiDisidang) hasil.ruang = "selesai";
  else if ((Number.isFinite(diRuang) && diRuang > 0) || antrian?.sedangDisidang) {
    hasil.ruang = "disidang";
    hasil.noRuang = Number.isFinite(diRuang) && diRuang > 0 ? diRuang : null;
  } else if (hasil.pihak1.hadir || hasil.pihak2.hadir || jumlahSaksiRinci > 0 || teks(antrian?.saksi)) {
    hasil.ruang = "menunggu";
  }

  hasil.adaCatatan =
    hasil.pihak1.hadir ||
    hasil.pihak2.hadir ||
    hasil.turut.hadir ||
    hasil.intervensi.hadir ||
    hasil.saksiP.length + hasil.saksiT.length + hasil.saksiLain.length > 0;
  return hasil;
}

// ============================================================================
// RINGKASAN SATU BARIS - "Penggugat hadir 08.47 · Tergugat belum · Saksi P 1/2"
// ============================================================================

export type NadaRingkas = "hijau" | "abu" | "kuning" | "biru" | "merah";

export type PotonganRingkas = { kunci: string; teks: string; nada: NadaRingkas; judul: string };

/** Menyambung kata dengan satu spasi, melewati yang kosong. */
function sambung(...bagian: string[]): string {
  return bagian.filter(Boolean).join(" ");
}

function kalimatSisi(sebutan: string, g: GolonganSisi): { teks: string; judul: string } {
  const jam = jamTitik(g.jam);
  const kata = g.semuaPulang ? "pulang" : "hadir";
  if (g.dariAntrianSaja) {
    return {
      teks: sambung(sebutan, "hadir", jam),
      judul: `${sebutan} mengambil nomor antrian${jam ? ` pukul ${jam}` : ""} (pribadi atau kuasanya tidak tercatat).`,
    };
  }
  const nama = [...g.sendiri, ...g.kuasa]
    .map((o) => `${o.sebutan || (o.sebagaiKuasa ? `Kuasa ${sebutan}` : sebutan)}${o.nama ? ` (${o.nama})` : ""} ${jamTitik(o.jam)}${o.pulangJam ? `, pulang ${jamTitik(o.pulangJam)}` : ""}`)
    .join("; ");
  if (g.sendiri.length && g.kuasa.length) return { teks: sambung(`${sebutan} + kuasa`, kata, jam), judul: nama };
  if (g.kuasa.length) return { teks: sambung(`Kuasa ${sebutan}`, kata, jam), judul: nama };
  return { teks: sambung(sebutan, kata, jam), judul: nama };
}

function kalimatSaksi(label: string, daftar: KehadiranOrang[], diajukan: number, namaDiajukan: string[]) {
  const n = daftar.length;
  const diperiksa = daftar.filter((o) => teks(o.diperiksaJam)).length;
  const angka = diajukan > 0 ? `${n}/${diajukan}` : String(n);
  const rinci = daftar
    .map((o, i) => `${o.nama || namaDiajukan[i] || `saksi ${i + 1}`} hadir ${jamTitik(o.jam)}${o.diperiksaJam ? `, diperiksa ${jamTitik(o.diperiksaJam)}` : ""}`)
    .join("; ");
  const belum = diajukan > n ? `${diajukan - n} belum datang` : "";
  return {
    teks: `${label} ${angka}${diperiksa ? ` (${diperiksa} diperiksa)` : ""}`,
    judul: [rinci, belum].filter(Boolean).join("; ") || `${label}: belum ada yang datang`,
    nada: (n === 0 ? "abu" : diajukan > 0 && n < diajukan ? "kuning" : "hijau") as NadaRingkas,
  };
}

/**
 * Potongan ringkasan satu baris jadwal. Kosong bila tidak ada apa pun yang
 * tercatat DAN tidak ada saksi yang diajukan (tidak menambah baris yang tidak
 * menagih apa pun).
 */
export function ringkasKehadiran(susun: KehadiranTersusun, bahan: BahanPerkaraHadir = {}): PotonganRingkas[] {
  const satu = bahan.sebutanSatu || "Penggugat";
  const dua = bahan.sebutanDua || "Tergugat";
  const diajukanP = Math.max(0, Number(bahan.saksiDiajukanP) || 0);
  const diajukanT = Math.max(0, Number(bahan.saksiDiajukanT) || 0);
  if (!susun.adaCatatan && susun.ruang === "belum") return [];

  const potongan: PotonganRingkas[] = [];
  const sisi = (kunci: string, sebutan: string, g: GolonganSisi) => {
    if (g.hadir) {
      const k = kalimatSisi(sebutan, g);
      potongan.push({ kunci, teks: k.teks, judul: k.judul, nada: g.semuaPulang ? "abu" : "hijau" });
    } else {
      potongan.push({ kunci, teks: `${sebutan} belum`, judul: `${sebutan} belum tercatat hadir hari ini.`, nada: "abu" });
    }
  };
  sisi("p1", satu, susun.pihak1);
  if (!bahan.tanpaPihakKedua) sisi("p2", dua, susun.pihak2);
  if (bahan.adaTurut || susun.turut.hadir) sisi("turut", "Turut Tergugat", susun.turut);
  if (bahan.adaIntervensi || susun.intervensi.hadir) sisi("intervensi", "Intervensi", susun.intervensi);

  if (diajukanP > 0 || susun.saksiP.length) {
    const k = kalimatSaksi(`Saksi ${satu.charAt(0)}`, susun.saksiP, diajukanP, bahan.namaSaksiP ?? []);
    potongan.push({ kunci: "saksiP", ...k });
  }
  if (diajukanT > 0 || susun.saksiT.length) {
    const k = kalimatSaksi(`Saksi ${dua.charAt(0)}`, susun.saksiT, diajukanT, bahan.namaSaksiT ?? []);
    potongan.push({ kunci: "saksiT", ...k });
  }
  if (susun.saksiLain.length) {
    const k = kalimatSaksi("Saksi", susun.saksiLain, 0, []);
    potongan.push({ kunci: "saksiLain", ...k, judul: `${k.judul} (sisi saksi tidak disebut)` });
  }

  if (susun.ruang === "disidang") {
    potongan.push({
      kunci: "ruang",
      teks: susun.noRuang ? `sedang disidang R${susun.noRuang}` : "sedang disidang",
      judul: "Perkara ini sedang disidangkan menurut aplikasi antrian.",
      nada: "biru",
    });
  } else if (susun.ruang === "selesai") {
    potongan.push({ kunci: "ruang", teks: "selesai disidang", judul: "Sidang perkara ini sudah selesai menurut aplikasi antrian.", nada: "abu" });
  }
  return potongan;
}

/** Ringkasan dalam satu kalimat, dipisah " · ". */
export function kalimatRingkas(potongan: PotonganRingkas[]): string {
  return potongan.map((p) => p.teks).join(" · ");
}

// ============================================================================
// STATUS SATU ORANG - datang, di ruang sidang, selesai, pulang, diperiksa
// ============================================================================

export type StatusOrang = { kunci: "datang" | "disidang" | "selesai" | "pulang" | "diperiksa"; label: string };

export function statusOrang(orang: KehadiranOrang, susun: Pick<KehadiranTersusun, "ruang" | "noRuang">): StatusOrang {
  if (teks(orang.pulangJam)) return { kunci: "pulang", label: `pulang ${jamTitik(orang.pulangJam)}` };
  if (teks(orang.diperiksaJam)) return { kunci: "diperiksa", label: `sudah diperiksa ${jamTitik(orang.diperiksaJam)}` };
  if (susun.ruang === "disidang") return { kunci: "disidang", label: susun.noRuang ? `di ruang sidang ${susun.noRuang}` : "di ruang sidang" };
  if (susun.ruang === "selesai") return { kunci: "selesai", label: "sidang selesai" };
  return { kunci: "datang", label: `datang ${jamTitik(orang.jam)}`.trim() };
}

/** Sebutan satu orang memakai sebutan perkara (Pemohon, bukan Penggugat, pada cerai talak). */
export function sebutanOrang(orang: KehadiranOrang, bahan: BahanPerkaraHadir = {}): string {
  const satu = bahan.sebutanSatu || "Penggugat";
  const dua = bahan.sebutanDua || "Tergugat";
  const gol = golonganOrang(orang);
  const urut = teks(orang.urutanPihak);
  let dasar = "";
  if (gol === "p1") dasar = satu;
  else if (gol === "p2") dasar = dua;
  else if (gol === "turut") dasar = "Turut Tergugat";
  else if (gol === "intervensi") dasar = "Intervensi";
  else if (gol === "saksi") {
    const pihak = orang.saksiUntuk === "pihak_1" ? ` ${satu}` : orang.saksiUntuk === "pihak_2" ? ` ${dua}` : "";
    return `Saksi${pihak}${urut ? ` ${urut}` : ""}`;
  }
  const inti = urut ? `${dasar} ${urut}` : dasar;
  return orang.sebagaiKuasa ? `Kuasa ${inti}` : inti;
}

// ============================================================================
// USULAN "DIHADIRI OLEH" SIPP
// ============================================================================

/** Label sandi dihadiri_oleh SIPP (borang jadwal_sidang_p_edit.php). */
export function labelSandiKehadiran(sandi: number, bahan: BahanPerkaraHadir = {}): string {
  const satu = bahan.sebutanSatu || "Penggugat";
  const dua = bahan.sebutanDua || "Tergugat";
  const peta: Record<number, string> = {
    1: "Semua pihak hadir",
    2: `${satu} saja`,
    3: `${dua} saja`,
    4: "Para pihak tidak hadir",
    5: "Intervensi saja",
    7: `${satu} dan Intervensi`,
    8: `${dua} dan Intervensi`,
    9: `${satu} dan ${dua} (Intervensi tidak hadir)`,
    10: `Sebagian ${satu}`,
    11: `Sebagian ${dua}`,
    13: "Turut Tergugat saja",
    14: `${satu} dan Turut Tergugat`,
    15: `${dua} dan Turut Tergugat`,
  };
  return peta[sandi] ?? `pilihan ${sandi}`;
}

export type UsulanDihadiri = {
  /** Usulan utama 1-4 (atau 5/13 bila hanya intervensi/turut yang hadir); null = belum dapat diusulkan. */
  sandi: number | null;
  label: string;
  /** Siapa yang tercatat hadir, untuk ditampilkan di bawah pilihan. */
  alasan: string;
  /** Sandi rinci SIPP bila berbeda dari usulan utama (mis. 14, 9, 10) - hanya disebut. */
  sandiRinci: number | null;
  labelRinci: string;
};

function sebagian(g: GolonganSisi, jumlah: number | undefined): boolean {
  if (!g.hadir || g.dariAntrianSaja || g.kuasa.length > 0) return false;
  const n = Number(jumlah) || 0;
  if (n <= 1) return false;
  const kunci = new Set(g.sendiri.map((o) => teks(o.urutanPihak) || teks(o.nama) || teks(o.id)).filter(Boolean));
  return kunci.size > 0 && kunci.size < n;
}

/**
 * Usulan isian "Dihadiri oleh" SIPP dari kehadiran tercatat.
 *
 * - Belum ada yang tercatat -> null (BUKAN 4): 27 dari 212 sidang terukur
 *   antriannya kosong padahal 9 di antaranya dicatat SIPP "semua hadir".
 * - Kuasa yang hadir menghitung sisinya hadir (sama dengan SIPP & aplikasi
 *   antrian).
 * - Permohonan tanpa pihak kedua: pemohon hadir = semua pihak (1).
 * - Turut tergugat/intervensi tidak mengubah usulan utama (kebiasaan satker:
 *   1-4); sandi rincinya disebut terpisah.
 */
export function usulanDihadiriOleh(susun: KehadiranTersusun, bahan: BahanPerkaraHadir = {}): UsulanDihadiri {
  const P = susun.pihak1.hadir;
  const T = susun.pihak2.hadir && !bahan.tanpaPihakKedua;
  const TT = susun.turut.hadir;
  const IV = susun.intervensi.hadir;
  const adaIV = Boolean(bahan.adaIntervensi) || IV;
  const satu = bahan.sebutanSatu || "Penggugat";
  const dua = bahan.sebutanDua || "Tergugat";

  const siapa: string[] = [];
  const sebutSisi = (sebutan: string, g: GolonganSisi) => {
    if (!g.hadir) return;
    const jam = jamTitik(g.jam);
    if (g.dariAntrianSaja) siapa.push(sambung(sebutan, jam, "(nomor antrian)"));
    else if (g.sendiri.length && g.kuasa.length) siapa.push(sambung(`${sebutan} dan kuasanya`, jam));
    else if (g.kuasa.length) siapa.push(sambung(`kuasa ${sebutan}`, jam));
    else siapa.push(sambung(sebutan, jam));
  };
  sebutSisi(satu, susun.pihak1);
  if (!bahan.tanpaPihakKedua) sebutSisi(dua, susun.pihak2);
  sebutSisi("Turut Tergugat", susun.turut);
  sebutSisi("Intervensi", susun.intervensi);
  let alasan = siapa.length ? `Tercatat hadir: ${siapa.join(", ")}.` : "Belum ada yang tercatat hadir hari ini.";

  let sandi: number | null = null;
  if (bahan.tanpaPihakKedua) sandi = P ? 1 : null;
  else if (P && T) sandi = 1;
  else if (P) sandi = 2;
  else if (T) sandi = 3;
  else if (IV) sandi = 5;
  else if (TT) sandi = 13;

  // Sandi rinci menurut borang SIPP.
  let rinci: number | null = sandi;
  if (!bahan.tanpaPihakKedua) {
    if (P && T) rinci = adaIV && !IV ? 9 : 1;
    else if (P && !T) {
      if (IV) rinci = 7;
      else if (TT) rinci = 14;
      else if (sebagian(susun.pihak1, bahan.jumlahPihak1)) rinci = 10;
    } else if (T && !P) {
      if (IV) rinci = 8;
      else if (TT) rinci = 15;
      else if (sebagian(susun.pihak2, bahan.jumlahPihak2)) rinci = 11;
    }
  }

  // Turut tergugat terdaftar tetapi belum hadir, sedangkan P dan T hadir: SIPP
  // tidak punya pilihannya. Disebut terus terang, bukan disembunyikan di balik
  // "Semua pihak" (66 sidang terukur: petugas satker memilih 1).
  if (sandi === 1 && !bahan.tanpaPihakKedua && bahan.adaTurut && !TT) {
    alasan += ' Turut Tergugat belum tercatat hadir - SIPP tidak punya pilihan "tanpa Turut Tergugat"; petugas selama ini memilih "Semua pihak".';
  }

  return {
    sandi,
    label: sandi === null ? "" : labelSandiKehadiran(sandi, bahan),
    alasan,
    sandiRinci: rinci !== null && rinci !== sandi ? rinci : null,
    labelRinci: rinci !== null && rinci !== sandi ? labelSandiKehadiran(rinci, bahan) : "",
  };
}

// ============================================================================
// USULAN BAS - hadir/tidak per pihak dan saksi yang diperiksa
// ============================================================================

export type UsulanBasSisi = {
  /** true hadir, false tidak hadir, null tidak diketahui. */
  hadir: boolean | null;
  /** Bunyi BAS (daftar bunyi kehadiran ALETA); "" bila tidak diusulkan. */
  bunyi: string;
};

export type UsulanBas = {
  penggugat: UsulanBasSisi;
  tergugat: UsulanBasSisi;
  saksiDiperiksa: Array<{ sisi: "P" | "T" | ""; nama: string; jam: string }>;
  saksiHadirBelumDiperiksa: Array<{ sisi: "P" | "T" | ""; nama: string; jam: string }>;
};

function bunyiSisi(g: GolonganSisi, sidangBerjalan: boolean, sisiLainHadir: boolean): UsulanBasSisi {
  if (g.hadir) {
    if (g.dariAntrianSaja) return { hadir: true, bunyi: "" };
    if (g.sendiri.length && g.kuasa.length) return { hadir: true, bunyi: "hadir didampingi kuasanya" };
    if (g.kuasa.length) return { hadir: true, bunyi: "tidak hadir, diwakili kuasanya" };
    return { hadir: true, bunyi: "hadir secara pribadi" };
  }
  // "Tidak hadir" hanya bila sidangnya sudah berjalan DAN sisi lain tercatat
  // hadir - aturan yang sama dengan aplikasi antrian satker (hanya pihak_1
  // -> "pihak pertama saja"). Tanpa itu: tidak diketahui.
  if (sidangBerjalan && sisiLainHadir) {
    return { hadir: false, bunyi: "tidak hadir dan tidak pula menyuruh orang lain sebagai wakil/kuasanya" };
  }
  return { hadir: null, bunyi: "" };
}

export function usulanBas(susun: KehadiranTersusun, bahan: BahanPerkaraHadir = {}): UsulanBas {
  const berjalan = susun.ruang === "disidang" || susun.ruang === "selesai";
  const sisiSaksi = (o: KehadiranOrang): "P" | "T" | "" =>
    o.saksiUntuk === "pihak_1" ? "P" : o.saksiUntuk === "pihak_2" ? "T" : "";
  const saksi = [...susun.saksiP, ...susun.saksiT, ...susun.saksiLain].filter((o) => o.id || o.nama);
  const bentuk = (o: KehadiranOrang) => ({ sisi: sisiSaksi(o), nama: teks(o.nama), jam: jamTitik(o.jam) });
  return {
    penggugat: bunyiSisi(susun.pihak1, berjalan, susun.pihak2.hadir),
    tergugat: bahan.tanpaPihakKedua ? { hadir: null, bunyi: "" } : bunyiSisi(susun.pihak2, berjalan, susun.pihak1.hadir),
    saksiDiperiksa: saksi.filter((o) => teks(o.diperiksaJam)).map(bentuk),
    saksiHadirBelumDiperiksa: saksi.filter((o) => !teks(o.diperiksaJam)).map(bentuk),
  };
}

// ============================================================================
// BAHAN DARI BARIS JADWAL SIDANG
// ============================================================================

export type BarisJadwalHadir = {
  alurPerkaraId?: number | string | null;
  jenisPerkaraId?: number | string | null;
  jenisPerkara?: string | null;
  nomorPerkara?: string | null;
  pihak?: {
    penggugat?: string[];
    tergugat?: string[];
    turutTergugat?: string[];
    intervensi?: string[];
  } | null;
  saksiPihak1?: number;
  saksiPihak2?: number;
  saksiNamaPihak1?: string[];
  saksiNamaPihak2?: string[];
};

/**
 * Bahan kehadiran dari satu baris jadwal sidang. Bot masih memasukkan turut
 * tergugat ke `tergugat` (pemakai lama) - disaring di sini, sama dengan
 * pihakTampil di layar jadwal.
 */
export function bahanKehadiranDariBaris(baris: BarisJadwalHadir): BahanPerkaraHadir {
  const sebutan = sebutanPihakPerkara({
    alurPerkaraId: baris.alurPerkaraId,
    jenisPerkaraId: baris.jenisPerkaraId,
    jenisPerkaraNama: baris.jenisPerkara,
    nomorPerkara: baris.nomorPerkara,
  });
  const pihak = baris.pihak ?? {};
  const turut = new Set(pihak.turutTergugat ?? []);
  const tergugat = (pihak.tergugat ?? []).filter((n) => !turut.has(n));
  return {
    sebutanSatu: sebutan.satu,
    sebutanDua: sebutan.dua,
    tanpaPihakKedua: Array.isArray(pihak.tergugat) && tergugat.length === 0,
    saksiDiajukanP: Number(baris.saksiPihak1) || 0,
    saksiDiajukanT: Number(baris.saksiPihak2) || 0,
    namaSaksiP: baris.saksiNamaPihak1 ?? [],
    namaSaksiT: baris.saksiNamaPihak2 ?? [],
    adaTurut: turut.size > 0,
    adaIntervensi: (pihak.intervensi ?? []).length > 0,
    jumlahPihak1: (pihak.penggugat ?? []).length,
    jumlahPihak2: tergugat.length,
  };
}

/** Kunci peta kehadiran jadwal - "perkaraId|YYYY-MM-DD" (lihat rute jadwal bot). */
export function kunciKehadiran(perkaraId: string | number, tanggalSidang: string | null | undefined): string {
  return `${String(perkaraId)}|${String(tanggalSidang ?? "").slice(0, 10)}`;
}

/** Bahan dari keadaan satu sidang (blangko Tunda/Putus): sebutan; permohonan Pdt.P tanpa pihak kedua. */
export function bahanKehadiranDariKeadaan(keadaan: {
  alurPerkaraId?: number | string | null;
  jenisPerkaraId?: number | string | null;
  jenisPerkara?: string | null;
  nomorPerkara?: string | null;
}): BahanPerkaraHadir {
  const sebutan = sebutanPihakPerkara({
    alurPerkaraId: keadaan.alurPerkaraId,
    jenisPerkaraId: keadaan.jenisPerkaraId,
    jenisPerkaraNama: keadaan.jenisPerkara,
    nomorPerkara: keadaan.nomorPerkara,
  });
  return {
    sebutanSatu: sebutan.satu,
    sebutanDua: sebutan.dua,
    tanpaPihakKedua: /\/Pdt\.P\//i.test(String(keadaan.nomorPerkara ?? "")),
  };
}

/** Ringkasan antrian blangko (sidangHasilService.ringkasAntrian) -> bentuk antrian kehadiran. */
export function antrianDariRingkas(
  r: { hadirPihak1?: boolean; hadirPihak2?: boolean; keadaan?: string; ruanganId?: number | null } | null | undefined
): AntrianKehadiran {
  if (!r) return null;
  return {
    pihak1: r.hadirPihak1 ? "hadir" : "",
    pihak2: r.hadirPihak2 ? "hadir" : "",
    diRuang: r.keadaan === "disidang" ? Number(r.ruanganId) || null : null,
    sedangDisidang: r.keadaan === "disidang",
    selesaiDisidang: r.keadaan === "selesai",
  };
}

// ============================================================================
// BENTUK UNTUK EKSTENSI DI SIPP (jendela Tunda / Edit Jadwal)
// ============================================================================

export type KehadiranUntukJendela = {
  /** Usulan "Dihadiri oleh" utama (1-4, atau 5/13); null = belum dapat diusulkan. */
  sandi: number | null;
  label: string;
  alasan: string;
  sandiRinci: number | null;
  labelRinci: string;
  /** "Penggugat hadir 08.47 · Tergugat belum · Saksi P 1/2". */
  ringkas: string;
  orang: Array<{ sebutan: string; nama: string; jam: string; status: string }>;
  /** Usulan BAS per pihak. */
  bas: { penggugat: string; tergugat: string; saksiDiperiksa: string[] };
};

/**
 * Kehadiran satu sidang dalam bentuk datar untuk panel ekstensi: kalimat
 * sudah jadi, sandi sudah dihitung - ekstensi tidak menyalin aturannya.
 * null bila tidak ada apa pun yang tercatat.
 */
export function kehadiranUntukJendela(
  hadir: KehadiranOrang[] | null | undefined,
  antrian: AntrianKehadiran,
  bahan: BahanPerkaraHadir
): KehadiranUntukJendela | null {
  const susun = susunKehadiran(hadir ?? [], antrian);
  if (!susun.adaCatatan) return null;
  const usul = usulanDihadiriOleh(susun, bahan);
  const bas = usulanBas(susun, bahan);
  return {
    ...usul,
    ringkas: kalimatRingkas(ringkasKehadiran(susun, bahan)),
    orang: (hadir ?? []).map((o) => ({
      sebutan: sebutanOrang(o, bahan),
      nama: teks(o.nama),
      jam: jamTitik(o.jam),
      status: statusOrang(o, susun).label,
    })),
    bas: {
      penggugat: bas.penggugat.bunyi,
      tergugat: bas.tergugat.bunyi,
      saksiDiperiksa: bas.saksiDiperiksa.map((x) => x.nama).filter(Boolean),
    },
  };
}
