/**
 * ============================================================================
 * PENJAGA SERVER - ATURAN MURNI (N4, 1 November 2026)
 * ============================================================================
 *
 * Tanpa AI, tanpa input/output: hanya mengubah angka yang SUDAH diukur (Pusat Kesehatan, laporan kapasitas,
 * laporan pemantau di server) menjadi "temuan", memutuskan kapan perlu dikabari, dan menyusun bunyi pesan.
 * Penjaga hanya MENGABARI - tidak ada satu pun fungsi di sini (atau di mesinnya) yang membersihkan,
 * menghapus, atau mengubah setelan server.
 *
 * Mesin penyimpan kejadian dan pengirim: src/server/modules/penjaga-server/layanan.ts.
 */
import { formatUkuran, hitungPersen, warnaKapasitas, type HasilKapasitas, type LaporanHost, type PartisiBot, type SetelanKapasitas } from "@/server/modules/kapasitas/hitung";

export type TingkatKejadian = "peringatan" | "merah";

export type PengaturanPenjaga = {
  /** Kabar untuk kejadian merah. MENYALA bawaan. */
  merahAktif: boolean;
  /** Kabar untuk kejadian peringatan (kuning). Boleh dimatikan Super Admin. */
  peringatanAktif: boolean;
  /** Kejadian merah yang belum selesai diingatkan lagi paling cepat tiap sekian jam. */
  ulangMerahJam: number;
  /** Idem untuk peringatan. */
  ulangPeringatanJam: number;
  /** Malam hari: hanya kejadian merah yang dikabari; peringatan menunggu pagi. */
  jamTenangAktif: boolean;
  /** "HH:MM" WITA. */
  tenangMulai: string;
  tenangSelesai: string;
  /** Kosong = semua Super Admin aktif yang punya nomor WhatsApp. */
  penerimaIds: string[];
  inodeKuning: number;
  inodeMerah: number;
  /** Cadangan terakhir lebih tua dari ini (jam) = peringatan / merah. */
  cadanganPeringatanJam: number;
  cadanganMerahJam: number;
  /** Cadangan terbaru lebih kecil dari persen ini terhadap cadangan-cadangan sebelumnya = peringatan. */
  cadanganUkuranMinPersen: number;
  /** Cadangan lebih kecil dari ini (byte) = peringatan, apa pun perbandingannya. */
  cadanganUkuranMinByte: number;
  sertifikatPeringatanHari: number;
  sertifikatMerahHari: number;
};

export const PENGATURAN_PENJAGA_BAWAAN: PengaturanPenjaga = Object.freeze({
  merahAktif: true,
  peringatanAktif: true,
  ulangMerahJam: 6,
  ulangPeringatanJam: 24,
  jamTenangAktif: true,
  tenangMulai: "21:00",
  tenangSelesai: "05:30",
  penerimaIds: [],
  inodeKuning: 85,
  inodeMerah: 95,
  cadanganPeringatanJam: 36,
  cadanganMerahJam: 72,
  cadanganUkuranMinPersen: 50,
  cadanganUkuranMinByte: 102_400,
  sertifikatPeringatanHari: 14,
  sertifikatMerahHari: 5,
}) as PengaturanPenjaga;

/** Batas angka yang boleh diatur (di luar batas = ditolak). */
export const BATAS_PENJAGA = Object.freeze({
  ulangMerahJam: { min: 1, maks: 48 },
  ulangPeringatanJam: { min: 6, maks: 168 },
  inodeKuning: { min: 50, maks: 95 },
  inodeMerah: { min: 60, maks: 99 },
  cadanganPeringatanJam: { min: 6, maks: 168 },
  cadanganMerahJam: { min: 12, maks: 336 },
  cadanganUkuranMinPersen: { min: 5, maks: 95 },
  cadanganUkuranMinByte: { min: 0, maks: 10_737_418_240 },
  sertifikatPeringatanHari: { min: 3, maks: 90 },
  sertifikatMerahHari: { min: 1, maks: 60 },
});

const POLA_JAM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type HasilPeriksaPengaturan = { ok: true; pengaturan: PengaturanPenjaga } | { ok: false; pesan: string };

/**
 * Masukan sebagian di atas pengaturan sekarang. Angka di luar batas atau jam yang bukan HH:MM ditolak
 * (bukan diam-diam dibetulkan), supaya Super Admin tahu isiannya tidak dipakai.
 */
export function periksaPengaturanPenjaga(masukan: unknown, dasar: PengaturanPenjaga = PENGATURAN_PENJAGA_BAWAAN): HasilPeriksaPengaturan {
  const x = masukan && typeof masukan === "object" && !Array.isArray(masukan) ? (masukan as Record<string, unknown>) : null;
  if (!x) return { ok: false, pesan: "Pengaturan tidak sah." };
  const hasil: PengaturanPenjaga = { ...dasar, penerimaIds: [...dasar.penerimaIds] };

  for (const k of ["merahAktif", "peringatanAktif", "jamTenangAktif"] as const) {
    if (x[k] === undefined) continue;
    if (typeof x[k] !== "boolean") return { ok: false, pesan: "Saklar harus menyala atau mati." };
    hasil[k] = x[k] as boolean;
  }
  for (const k of Object.keys(BATAS_PENJAGA) as Array<keyof typeof BATAS_PENJAGA>) {
    if (x[k] === undefined) continue;
    const n = Number(x[k]);
    const b = BATAS_PENJAGA[k];
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < b.min || n > b.maks) {
      return { ok: false, pesan: `Angka harus bilangan bulat antara ${b.min} dan ${b.maks}.` };
    }
    hasil[k] = n;
  }
  for (const k of ["tenangMulai", "tenangSelesai"] as const) {
    if (x[k] === undefined) continue;
    if (typeof x[k] !== "string" || !POLA_JAM.test(x[k] as string)) return { ok: false, pesan: "Jam harus berbentuk JJ:MM, misalnya 21:00." };
    hasil[k] = x[k] as string;
  }
  if (x.penerimaIds !== undefined) {
    if (!Array.isArray(x.penerimaIds) || x.penerimaIds.length > 50 || x.penerimaIds.some((i) => typeof i !== "string" || !i || i.length > 80)) {
      return { ok: false, pesan: "Daftar penerima tidak sah." };
    }
    hasil.penerimaIds = Array.from(new Set(x.penerimaIds as string[]));
  }
  if (hasil.inodeMerah <= hasil.inodeKuning) return { ok: false, pesan: "Batas merah inode harus lebih besar dari batas kuning." };
  if (hasil.cadanganMerahJam <= hasil.cadanganPeringatanJam) return { ok: false, pesan: "Batas merah cadangan harus lebih lama dari batas peringatan." };
  if (hasil.sertifikatMerahHari >= hasil.sertifikatPeringatanHari) return { ok: false, pesan: "Batas merah sertifikat harus lebih sedikit harinya dari batas peringatan." };
  return { ok: true, pengaturan: hasil };
}

/** Pengaturan tersimpan -> bentuk tepercaya. Isi yang rusak jatuh ke bawaan, tidak melempar. */
export function pengaturanDariTersimpan(mentah: unknown): PengaturanPenjaga {
  const h = periksaPengaturanPenjaga(mentah, PENGATURAN_PENJAGA_BAWAAN);
  if (h.ok) return h.pengaturan;
  // Satu isian buruk jangan membuang semuanya: terapkan isian yang sah satu per satu.
  let sekarang = PENGATURAN_PENJAGA_BAWAAN;
  if (mentah && typeof mentah === "object" && !Array.isArray(mentah)) {
    for (const [k, v] of Object.entries(mentah as Record<string, unknown>)) {
      const c = periksaPengaturanPenjaga({ [k]: v }, sekarang);
      if (c.ok) sekarang = c.pengaturan;
    }
  }
  return sekarang;
}

// ---------------------------------------------------------------------------
// Waktu (WITA = UTC+8)
// ---------------------------------------------------------------------------

const WITA_MS = 8 * 3_600_000;

function menitWita(kini: Date): number {
  const t = new Date(kini.getTime() + WITA_MS);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

function menitDariJam(jam: string): number {
  const [j, m] = jam.split(":").map(Number);
  return j * 60 + m;
}

/** Jam tenang (WITA), termasuk yang melewati tengah malam. Mulai = selesai berarti tidak ada jam tenang. */
export function dalamJamTenang(kini: Date, p: Pick<PengaturanPenjaga, "jamTenangAktif" | "tenangMulai" | "tenangSelesai">): boolean {
  if (!p.jamTenangAktif) return false;
  const a = menitDariJam(p.tenangMulai);
  const b = menitDariJam(p.tenangSelesai);
  if (a === b) return false;
  const m = menitWita(kini);
  return a < b ? m >= a && m < b : m >= a || m < b;
}

export function jamWita(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const t = new Date(d.getTime() + WITA_MS);
  return `${String(t.getUTCHours()).padStart(2, "0")}.${String(t.getUTCMinutes()).padStart(2, "0")} WITA`;
}

export function lamaTeks(dariIso: string, sampaiIso: string): string {
  const menit = Math.max(0, Math.round((new Date(sampaiIso).getTime() - new Date(dariIso).getTime()) / 60_000));
  if (!Number.isFinite(menit)) return "-";
  if (menit < 1) return "kurang dari semenit";
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam < 48) return sisa ? `${jam} jam ${sisa} menit` : `${jam} jam`;
  return `${Math.floor(jam / 24)} hari`;
}

// ---------------------------------------------------------------------------
// Temuan
// ---------------------------------------------------------------------------

export type Temuan = {
  /** kelompok:rincian. Kelompok = sumber ukuran (disk, inode, cadangan, layanan, kontainer, web, sertifikat, temp, pemantau). */
  kunci: string;
  tingkat: TingkatKejadian;
  judul: string;
  uraian: string;
  /** Berapa pemeriksaan berturut-turut sebelum dikabari (layanan: 2, supaya mulai-ulang sesaat tidak membangunkan). */
  butuhBerturut: number;
};

export function kelompokDariKunci(kunci: string): string {
  const i = kunci.indexOf(":");
  return i < 0 ? kunci : kunci.slice(0, i);
}

// ----- laporan pemantau di server (scripts/kapasitas/penjaga-host.sh) -----

export type LaporanPenjagaHost = {
  dibuat: string;
  intervalMenit: number;
  inode: Array<{ titik: string; persen: number }>;
  temp: { jalur: string; titik: string; persen: number; sisaByte: number | null } | null;
  sertifikat: Array<{ nama: string; hariTersisa: number }>;
  kontainer: Array<{ nama: string; keadaan: string; sehat: string }>;
  /** kode 0 = tidak menjawab. null = tidak diperiksa (alamat belum diatur). */
  abtWeb: { kode: number } | null;
  portal: { kode: number } | null;
};

function angkaAman(v: unknown, min: number, maks: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= maks ? n : null;
}

function teksAman(v: unknown, maks: number): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").slice(0, maks) : "";
}

/** Laporan mentah -> bentuk tepercaya; null bila bukan laporan. Isi aneh dibuang, tidak diperbaiki. */
export function bersihkanLaporanPenjagaHost(mentah: unknown): LaporanPenjagaHost | null {
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return null;
  const m = mentah as Record<string, unknown>;
  const dibuat = teksAman(m.dibuat, 40);
  if (!dibuat || Number.isNaN(new Date(dibuat).getTime())) return null;
  const daftar = (v: unknown) => (Array.isArray(v) ? v.slice(0, 60) : []);
  const inode: LaporanPenjagaHost["inode"] = [];
  for (const e of daftar(m.inode)) {
    const o = (e ?? {}) as Record<string, unknown>;
    const persen = angkaAman(o.persen, 0, 100);
    const titik = teksAman(o.titik, 120);
    if (persen !== null && titik) inode.push({ titik, persen });
  }
  const sertifikat: LaporanPenjagaHost["sertifikat"] = [];
  for (const e of daftar(m.sertifikat)) {
    const o = (e ?? {}) as Record<string, unknown>;
    const hari = angkaAman(o.hariTersisa, -3650, 36500);
    const nama = teksAman(o.nama, 120);
    if (hari !== null && nama) sertifikat.push({ nama, hariTersisa: Math.floor(hari) });
  }
  const kontainer: LaporanPenjagaHost["kontainer"] = [];
  for (const e of daftar(m.kontainer)) {
    const o = (e ?? {}) as Record<string, unknown>;
    const nama = teksAman(o.nama, 80);
    if (nama) kontainer.push({ nama, keadaan: teksAman(o.keadaan, 30).toLowerCase(), sehat: teksAman(o.sehat, 30).toLowerCase() });
  }
  const t = m.temp && typeof m.temp === "object" ? (m.temp as Record<string, unknown>) : null;
  const tp = t ? angkaAman(t.persen, 0, 100) : null;
  const kode = (v: unknown) => {
    const o = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    const k = o ? angkaAman(o.kode, 0, 999) : null;
    return k === null ? null : { kode: Math.floor(k) };
  };
  return {
    dibuat,
    intervalMenit: angkaAman(m.intervalMenit, 1, 1440) ?? 10,
    inode,
    temp: t && tp !== null ? { jalur: teksAman(t.jalur, 200), titik: teksAman(t.titik, 120), persen: tp, sisaByte: angkaAman(t.sisaByte, 0, 1e15) } : null,
    sertifikat,
    kontainer,
    abtWeb: kode(m.abtWeb),
    portal: kode(m.portal),
  };
}

// ----- ruang disk -----

function sebutTempat(titik: string, laporan: LaporanHost | null): string {
  const isi: string[] = [];
  if (laporan) {
    const cocok = (kunci: string) => laporan.jalur.some((j) => j.kunci === kunci && j.titik === titik);
    if (cocok("docker")) isi.push("data aplikasi");
    if (cocok("postgres")) isi.push("database");
    if (cocok("aleta-data")) isi.push("unggahan dan cadangan");
  }
  const nama = titik === "/" ? "Tempat penyimpanan utama (/)" : `Tempat penyimpanan ${titik}`;
  return isi.length ? `${nama}, memuat ${isi.join(", ")}` : nama;
}

/**
 * Partisi penting: "/" dan "/home" bila ada di laporan, ditambah partisi yang memuat data Docker, database, dan
 * data ALETA. Tanpa laporan dari server: partisi yang diukur ALETA Bot. Ambang = pengaturan Kapasitas yang sudah ada.
 */
export function temuanDisk(masukan: { laporan: LaporanHost | null; partisiBot: PartisiBot[] | null; kapasitas: Pick<SetelanKapasitas, "ambangKuning" | "ambangMerah"> }): Temuan[] {
  const { laporan, partisiBot, kapasitas } = masukan;
  const daftar: Array<{ titik: string; total: number; terpakai: number; sisa: number }> = [];
  if (laporan) {
    const penting = new Set<string>(["/", "/home"]);
    for (const j of laporan.jalur) if (["docker", "postgres", "aleta-data"].includes(j.kunci) && j.titik) penting.add(j.titik);
    for (const p of laporan.partisi) if (penting.has(p.titik)) daftar.push({ titik: p.titik, total: p.totalByte, terpakai: p.terpakaiByte, sisa: p.sisaByte });
    // Partisi yang memuat data tetapi tidak ada di daftar df penuh (laporan lama): pakai angka jalurnya.
    for (const j of laporan.jalur) {
      if (!j.titik || daftar.some((d) => d.titik === j.titik)) continue;
      if (["docker", "postgres", "aleta-data"].includes(j.kunci) && j.totalByte && j.terpakaiByte !== null) {
        daftar.push({ titik: j.titik, total: j.totalByte, terpakai: j.terpakaiByte, sisa: j.sisaByte ?? Math.max(0, j.totalByte - j.terpakaiByte) });
      }
    }
  } else if (partisiBot) {
    for (const p of partisiBot) {
      if (/^\/(boot|snap|run|sys|proc|dev)/.test(p.titik)) continue;
      daftar.push({ titik: p.titik, total: p.totalByte, terpakai: p.terpakaiByte, sisa: p.sisaByte ?? Math.max(0, p.totalByte - p.terpakaiByte) });
    }
  }
  const hasil: Temuan[] = [];
  for (const d of daftar) {
    const persen = hitungPersen(d.terpakai, d.total);
    const warna = warnaKapasitas(persen, kapasitas);
    if (persen === null || (warna !== "kuning" && warna !== "merah")) continue;
    const merah = warna === "merah";
    const tempat = sebutTempat(d.titik, laporan);
    const p = persen.toLocaleString("id-ID", { maximumFractionDigits: 1 });
    hasil.push({
      kunci: `disk:${d.titik}`,
      tingkat: merah ? "merah" : "peringatan",
      judul: merah ? "Ruang penyimpanan hampir habis" : "Ruang penyimpanan mulai menipis",
      uraian: merah
        ? `${tempat} sudah terpakai ${p}%, tinggal sekitar ${formatUkuran(d.sisa)} (batas merah ${kapasitas.ambangMerah}%). Kalau sampai penuh, ALETA bisa berhenti bekerja.`
        : `${tempat} sudah terpakai ${p}%, sisa sekitar ${formatUkuran(d.sisa)} (batas peringatan ${kapasitas.ambangKuning}%). Belum mendesak, tetapi sebaiknya mulai direncanakan penambahan ruang.`,
      butuhBerturut: 1,
    });
  }
  return hasil;
}

/** Laporan pemantau di server berhenti diperbarui (cron mati/belum dipasang setelah pernah jalan). */
export function temuanPemantauBerhenti(kapasitas: Pick<HasilKapasitas, "sumber" | "basi" | "umurMenit">): Temuan[] {
  if (kapasitas.sumber !== "host" || !kapasitas.basi) return [];
  return [
    {
      kunci: "pemantau:server",
      tingkat: "peringatan",
      judul: "Pemantau di server berhenti",
      uraian: `Pemantau ruang di server tidak memperbarui laporannya sekitar ${kapasitas.umurMenit ?? "?"} menit. Angka ruang yang tampil bisa sudah lama. Mohon dicek apakah jadwal pemantaunya masih jalan.`,
      butuhBerturut: 2,
    },
  ];
}

// ----- laporan pemantau di server: inode, Temp, sertifikat, kontainer, ABT -----

export function temuanHost(
  host: LaporanPenjagaHost | null,
  p: Pick<PengaturanPenjaga, "inodeKuning" | "inodeMerah" | "sertifikatPeringatanHari" | "sertifikatMerahHari">,
  kapasitas: Pick<SetelanKapasitas, "ambangKuning" | "ambangMerah">,
  titikSudahDipantau: ReadonlySet<string>
): Temuan[] {
  if (!host) return [];
  const hasil: Temuan[] = [];
  for (const e of host.inode) {
    if (e.persen < p.inodeKuning) continue;
    const merah = e.persen >= p.inodeMerah;
    hasil.push({
      kunci: `inode:${e.titik}`,
      tingkat: merah ? "merah" : "peringatan",
      judul: merah ? "Jumlah berkas di server hampir penuh" : "Jumlah berkas di server mulai banyak",
      uraian: `Tempat penyimpanan ${e.titik} sudah memakai ${e.persen}% dari jatah jumlah berkasnya, padahal ruangnya mungkin masih lega. ${merah ? "Kalau jatah ini habis, berkas baru tidak bisa dibuat." : "Biasanya ada folder yang menumpuk banyak berkas kecil."}`,
      butuhBerturut: 1,
    });
  }
  const t = host.temp;
  if (t && !titikSudahDipantau.has(t.titik)) {
    const warna = warnaKapasitas(t.persen, kapasitas);
    if (warna === "kuning" || warna === "merah") {
      hasil.push({
        kunci: "temp:sementara",
        tingkat: warna === "merah" ? "merah" : "peringatan",
        judul: warna === "merah" ? "Folder sementara hampir penuh" : "Folder sementara mulai penuh",
        uraian: `Tempat folder sementara (${t.jalur}) sudah terpakai ${t.persen}%. Pembaruan dan pemrosesan berkas bisa gagal bila penuh.`,
        butuhBerturut: 1,
      });
    }
  }
  for (const s of host.sertifikat) {
    if (s.hariTersisa > p.sertifikatPeringatanHari) continue;
    const merah = s.hariTersisa <= p.sertifikatMerahHari;
    hasil.push({
      kunci: `sertifikat:${s.nama}`,
      tingkat: merah ? "merah" : "peringatan",
      judul: s.hariTersisa < 0 ? "Sertifikat keamanan sudah kedaluwarsa" : "Sertifikat keamanan hampir kedaluwarsa",
      uraian:
        s.hariTersisa < 0
          ? `Sertifikat ${s.nama} sudah kedaluwarsa ${Math.abs(s.hariTersisa)} hari lalu. Peramban akan menampilkan peringatan tidak aman. Mohon segera diperpanjang.`
          : `Sertifikat ${s.nama} berlaku ${s.hariTersisa} hari lagi. Mohon diperpanjang sebelum habis.`,
      butuhBerturut: 1,
    });
  }
  for (const k of host.kontainer) {
    const sehat = k.keadaan === "running" && k.sehat !== "unhealthy";
    if (sehat) continue;
    hasil.push({
      kunci: `kontainer:${k.nama}`,
      tingkat: "merah",
      judul: `Layanan ${k.nama} bermasalah`,
      uraian: k.keadaan === "running" ? `Layanan ${k.nama} menyala tetapi dilaporkan tidak sehat.` : `Layanan ${k.nama} tidak berjalan (keadaan: ${k.keadaan || "tidak diketahui"}).`,
      butuhBerturut: 2,
    });
  }
  if (host.abtWeb && host.abtWeb.kode === 0) {
    hasil.push({
      kunci: "web:abt",
      tingkat: "merah",
      judul: "Halaman ABT tidak menjawab",
      uraian: "Halaman ABT (aplikasi blangko) di server tidak menjawab. Pembuatan dan pencetakan blangko dari ABT bisa terhenti.",
      butuhBerturut: 2,
    });
  }
  return hasil;
}

// ----- cadangan basis data -----

export type CatatanCadangan = { selesai: string; berhasil: boolean; byte: number };

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const t = Math.floor(s.length / 2);
  return s.length % 2 ? s[t] : (s[t - 1] + s[t]) / 2;
}

/**
 * Cadangan basis data harian: gagal (merah), tidak terbentuk lagi (peringatan lalu merah), atau terlalu kecil
 * dibanding cadangan sebelumnya (peringatan). Satu kejadian per saat; yang terparah menang.
 * `riwayat` = catatan tugas cadangan, terbaru dulu.
 */
export function temuanCadangan(riwayat: readonly CatatanCadangan[], kini: Date, p: Pick<PengaturanPenjaga, "cadanganPeringatanJam" | "cadanganMerahJam" | "cadanganUkuranMinPersen" | "cadanganUkuranMinByte">): Temuan[] {
  if (riwayat.length === 0) return [];
  const terbaru = riwayat[0];
  const berhasil = riwayat.filter((r) => r.berhasil);
  const terakhirBerhasil = berhasil[0];
  const jamSejak = (iso: string) => (kini.getTime() - new Date(iso).getTime()) / 3_600_000;
  const lama = terakhirBerhasil ? jamSejak(terakhirBerhasil.selesai) : Infinity;

  if (!terbaru.berhasil) {
    return [
      {
        kunci: "cadangan",
        tingkat: "merah",
        judul: "Cadangan data gagal dibuat",
        uraian: terakhirBerhasil
          ? `Cadangan data terakhir gagal. Cadangan yang berhasil terakhir ${lamaTeks(terakhirBerhasil.selesai, kini.toISOString())} lalu. Tanpa cadangan yang baru, data terbaru bisa hilang bila server rusak.`
          : "Cadangan data terakhir gagal dan belum ada cadangan yang berhasil tercatat. Tanpa cadangan, data bisa hilang bila server rusak.",
        butuhBerturut: 1,
      },
    ];
  }
  if (lama > p.cadanganPeringatanJam) {
    const merah = lama > p.cadanganMerahJam;
    return [
      {
        kunci: "cadangan",
        tingkat: merah ? "merah" : "peringatan",
        judul: "Cadangan harian tidak terbentuk",
        uraian: `Cadangan data terakhir yang berhasil sudah ${lamaTeks(terakhirBerhasil.selesai, kini.toISOString())} lalu, padahal seharusnya tiap hari. ${merah ? "Mohon segera dicek jadwal cadangannya." : "Mohon dicek jadwal cadangannya."}`,
        butuhBerturut: 1,
      },
    ];
  }
  if (terakhirBerhasil) {
    const sebelumnya = berhasil.slice(1, 8).map((r) => r.byte).filter((b) => b > 0);
    const mutlak = terakhirBerhasil.byte < p.cadanganUkuranMinByte;
    const dasar = sebelumnya.length >= 2 ? median(sebelumnya) : 0;
    const nisbi = dasar > 0 && terakhirBerhasil.byte < (dasar * p.cadanganUkuranMinPersen) / 100;
    if (mutlak || nisbi) {
      return [
        {
          kunci: "cadangan",
          tingkat: "peringatan",
          judul: "Cadangan data terlalu kecil",
          uraian: nisbi
            ? `Cadangan data terakhir hanya ${formatUkuran(terakhirBerhasil.byte)}, jauh lebih kecil dari biasanya (sekitar ${formatUkuran(dasar)}). Bisa jadi isinya tidak lengkap. Mohon dicek.`
            : `Cadangan data terakhir hanya ${formatUkuran(terakhirBerhasil.byte)}, terlalu kecil untuk cadangan yang lengkap. Mohon dicek.`,
          butuhBerturut: 1,
        },
      ];
    }
  }
  return [];
}

// ----- layanan (dari Pusat Kesehatan) -----

export const NAMA_LAYANAN: Record<string, { nama: string; akibat: string }> = {
  "basis-data": { nama: "Basis data ALETA", akibat: "ALETA tidak bisa menyimpan dan membuka data; layar bisa gagal dimuat." },
  bot: { nama: "ALETA Bot", akibat: "Pesan WhatsApp, penarikan data SIPP, dan sebagian fitur ekstensi bisa terhenti." },
  whatsapp: { nama: "WhatsApp ALETA", akibat: "Pesan WhatsApp tidak terkirim, termasuk kabar dari penjaga ini." },
  sipp: { nama: "Sambungan ke SIPP", akibat: "Data perkara dari SIPP tidak bisa dibaca; jadwal dan pengisian blangko bisa terganggu." },
  abt: { nama: "Sambungan ke ABT", akibat: "Data blangko dari ABT tidak bisa dibaca." },
  antrian: { nama: "Antrian sidang", akibat: "Layar antrian dan panggilan sidang bisa tidak diperbarui." },
  ecourt: { nama: "e-Court", akibat: "Penarikan dari e-Court bisa terhenti (misalnya sesi masuk habis)." },
};

export const KOMPONEN_LAYANAN_DIJAGA = Object.keys(NAMA_LAYANAN);

export function temuanLayanan(komponen: ReadonlyArray<{ kunci: string; warna: string; ringkas: string }>): Temuan[] {
  const hasil: Temuan[] = [];
  for (const k of komponen) {
    const info = NAMA_LAYANAN[k.kunci];
    if (!info || k.warna !== "merah") continue;
    hasil.push({
      kunci: `layanan:${k.kunci}`,
      tingkat: "merah",
      judul: `${info.nama} bermasalah`,
      uraian: `${info.nama} tidak berjalan baik. ${info.akibat} Keterangan: ${k.ringkas.replace(/\s+/g, " ").trim().slice(0, 140)}`,
      butuhBerturut: 2,
    });
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// Keputusan kabar
// ---------------------------------------------------------------------------

export type BarisKejadian = {
  id: string;
  kunci: string;
  tingkat: TingkatKejadian;
  judul: string;
  uraian: string;
  mulaiAt: string;
  berturut: number;
  pulihAt: string;
  kabarAt: string;
  kabarTingkat: string;
  jumlahKabar: number;
  kabarPulihAt: string;
};

/** Tingkat yang dipakai untuk mengabari: merah yang kabarnya dimatikan turun menjadi peringatan (bila peringatan menyala). */
export function tingkatKabar(tingkat: TingkatKejadian, p: Pick<PengaturanPenjaga, "merahAktif" | "peringatanAktif">): TingkatKejadian | null {
  if (tingkat === "merah") return p.merahAktif ? "merah" : p.peringatanAktif ? "peringatan" : null;
  return p.peringatanAktif ? "peringatan" : null;
}

/**
 * Perlukah kejadian yang MASIH BERLANGSUNG dikabari sekarang?
 *  - belum pernah: ya, bila sudah terlihat `butuhBerturut` kali;
 *  - naik dari peringatan ke merah: ya, segera;
 *  - masih berlangsung: ingatkan lagi hanya sesudah jeda (6 jam merah / 24 jam peringatan);
 *  - jam tenang: hanya merah.
 * `butuhBerturut` dihitung pemanggil (dari temuan yang sedang berlaku).
 */
export function perluKabar(baris: BarisKejadian, butuhBerturut: number, kini: Date, p: PengaturanPenjaga): boolean {
  if (baris.pulihAt) return false;
  if (baris.berturut < butuhBerturut) return false;
  const tingkat = tingkatKabar(baris.tingkat, p);
  if (!tingkat) return false;
  if (tingkat === "peringatan" && dalamJamTenang(kini, p)) return false;
  if (!baris.kabarAt) return true;
  if (tingkat === "merah" && baris.kabarTingkat !== "merah") return true;
  const jeda = (tingkat === "merah" ? p.ulangMerahJam : p.ulangPeringatanJam) * 3_600_000;
  return kini.getTime() - new Date(baris.kabarAt).getTime() >= jeda;
}

/**
 * Perlukah kabar "pulih"? Hanya bila kejadian pernah dikabari. Pulih dari kejadian yang dikabari sebagai merah
 * dikirim kapan saja; pulih peringatan menunggu jam tenang selesai.
 */
export function perluKabarPulih(baris: BarisKejadian, kini: Date, p: PengaturanPenjaga): boolean {
  if (!baris.pulihAt || !baris.kabarAt || baris.kabarPulihAt) return false;
  if (baris.kabarTingkat !== "merah" && dalamJamTenang(kini, p)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Bunyi pesan
// ---------------------------------------------------------------------------

export function susunPesanKejadian(baris: Pick<BarisKejadian, "judul" | "uraian" | "mulaiAt" | "jumlahKabar" | "tingkat" | "kabarTingkat">, kini: Date, tingkat: TingkatKejadian): string {
  const kepala = tingkat === "merah" ? "Penjaga server - PERLU DITANGANI" : "Penjaga server - pemberitahuan";
  const ulang = baris.jumlahKabar > 0 && baris.kabarTingkat === tingkat ? `Pengingat ke-${baris.jumlahKabar + 1}. ` : "";
  const naik = baris.jumlahKabar > 0 && baris.kabarTingkat !== tingkat ? "Keadaannya memburuk. " : "";
  return [
    kepala,
    "",
    `${ulang}${naik}${baris.judul}.`,
    baris.uraian,
    "",
    `Terlihat sejak ${jamWita(baris.mulaiAt)}, dikabari ${jamWita(kini)}. Rincian: Admin > Pusat Kesehatan Sistem.`,
  ].join("\n");
}

export function susunPesanPulih(baris: Pick<BarisKejadian, "judul" | "mulaiAt" | "pulihAt">): string {
  return ["Penjaga server - sudah pulih", "", `Kabar baik: "${baris.judul}" sudah kembali normal.`, `Berlangsung ${lamaTeks(baris.mulaiAt, baris.pulihAt)} (${jamWita(baris.mulaiAt)} sampai ${jamWita(baris.pulihAt)}).`].join("\n");
}

/** Banyak kejadian sekaligus (mis. server baru menyala): satu pesan ringkas, bukan hujan pesan. */
export function susunPesanRingkasan(daftar: ReadonlyArray<Pick<BarisKejadian, "judul" | "uraian">>, tingkat: TingkatKejadian, kini: Date): string {
  const kepala = tingkat === "merah" ? "Penjaga server - PERLU DITANGANI" : "Penjaga server - pemberitahuan";
  return [kepala, "", `Ada ${daftar.length} hal yang perlu dilihat (${jamWita(kini)}):`, ...daftar.map((d, i) => `${i + 1}. ${d.judul}. ${d.uraian}`), "", "Rincian: Admin > Pusat Kesehatan Sistem."].join("\n");
}
