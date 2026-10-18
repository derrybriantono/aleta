/**
 * ============================================================================
 * KASIR OTOMATIS 1.189.x - BAGIAN MURNI (tanpa React, tanpa basis data)
 * ============================================================================
 *
 * Diminta pengguna 9 Okt 2026:
 *   1. kasir otomatis per perkara - usulan menurut KEADAAN perkara (mesinnya di
 *      bot: kasirJurnalService.susunUsulan + keadaanPerkara);
 *   2. kasir otomatis massal satu hari - tiap perkara menurut keadaannya,
 *      pratinjau, simpan berurutan dengan jeda manusia, satu gagal tidak
 *      menghentikan yang lain, laporan per perkara (jalankanMassal);
 *   4. rekap pengeluaran harian/mingguan/bulanan/triwulan/semester/tahunan
 *      (rentangPeriode, susunRekap);
 *   5. pengingat tugas kasir - di tab Kasir, checklist milestone, dan widget
 *      ekstensi (butirChecklistKasir).
 *
 * Dipakai portal (kasir-otomatis.tsx, rute kasir/*) dan diuji di
 * kasir-otomatis.test.ts. Ekstensi memakai kembarannya yang ditulis di
 * panel-alat.js (alatKasirRentang) - uji yang sama menuntut jawabannya sama.
 */

import type { UsulanJurnal } from "@/lib/kasir-jurnal";

// ─── Keadaan perkara ─────────────────────────────────────────────────────────

export type KeadaanKasir = { kunci: string; nama: string; lazim: string[] };

// ─── Massal satu hari ────────────────────────────────────────────────────────

export type PerkaraHarian = {
  perkaraId: number;
  nomorPerkara: string;
  jenisPerkara: string;
  sebab: string[];
  keadaan: KeadaanKasir;
  saldo: number;
  saldoAkhir: number;
  usulan: UsulanJurnal[];
  ditawarkan: number;
  catatan: string[];
  perluPeriksa: boolean;
};

export type DaftarHarian = {
  ok: boolean;
  tanggal: string;
  perkara: PerkaraHarian[];
  lengkap: Array<{ perkaraId: number; nomorPerkara: string; jenisPerkara: string; keadaan: KeadaanKasir; sebab: string[] }>;
  gagal: Array<{ perkaraId: number; alasan: string }>;
  terpotong: boolean;
  jumlahCalon: number;
};

export const SEBAB_HARIAN: Record<string, string> = {
  sidang: "bersidang",
  putusan: "diputus",
  ikrar: "ikrar talak",
  "penetapan-hari-sidang": "PHS ditetapkan",
  "surat-ke-pos": "surat panggilan ke Pos",
};

/** Baris yang dikirim ke POST /kasir untuk satu perkara massal - hanya usulan tercentang yang lengkap. */
export function barisMassal(p: Pick<PerkaraHarian, "usulan">) {
  return p.usulan
    .filter((u) => u.pilih && Number(u.jumlah) > 0)
    .map((u) => ({
      tanggal: u.tanggal,
      jenisBiayaId: u.jenisBiayaId,
      pihakKe: u.pihakKe,
      pihakId: u.pihakId,
      uraian: u.uraian,
      jumlah: u.jumlah,
      keterangan: u.keterangan,
      jurusitaId: u.jurusitaId,
    }));
}

/** Perkara yang DICENTANG bawaan dalam massal: yang tidak perlu diperiksa tangan. */
export function centangBawaanMassal(p: Pick<PerkaraHarian, "perluPeriksa" | "usulan">): boolean {
  return !p.perluPeriksa && barisMassal(p).length > 0;
}

export type HasilMassal = {
  perkaraId: number;
  nomorPerkara: string;
  keadaan: "tersimpan" | "sebagian" | "gagal" | "dilewati";
  tersimpan: number;
  pesan: string;
};

/**
 * Menjalankan simpanan massal BERURUTAN: satu perkara satu permintaan, jeda
 * manusia di antaranya, dan kegagalan satu perkara (lempar atau jawaban
 * gagal) dicatat lalu perkara berikutnya tetap dikerjakan. `berhenti()`
 * ditanya sebelum tiap perkara - petugas boleh menghentikan antreannya.
 */
export async function jalankanMassal<T extends { perkaraId: number; nomorPerkara: string }>(
  daftar: T[],
  kirimSatu: (p: T) => Promise<{ ok: boolean; tersimpan: number; pesan: string }>,
  opsi: { jeda?: () => Promise<void>; berhenti?: () => boolean; kabar?: (h: HasilMassal, ke: number) => void } = {}
): Promise<HasilMassal[]> {
  const hasil: HasilMassal[] = [];
  for (let i = 0; i < daftar.length; i += 1) {
    const p = daftar[i];
    if (opsi.berhenti?.()) {
      const h: HasilMassal = { perkaraId: p.perkaraId, nomorPerkara: p.nomorPerkara, keadaan: "dilewati", tersimpan: 0, pesan: "dihentikan petugas" };
      hasil.push(h);
      opsi.kabar?.(h, i);
      continue;
    }
    if (i > 0 && opsi.jeda) await opsi.jeda();
    let h: HasilMassal;
    try {
      const j = await kirimSatu(p);
      h = {
        perkaraId: p.perkaraId,
        nomorPerkara: p.nomorPerkara,
        keadaan: j.ok ? "tersimpan" : j.tersimpan > 0 ? "sebagian" : "gagal",
        tersimpan: j.tersimpan,
        pesan: j.pesan,
      };
    } catch (e) {
      h = { perkaraId: p.perkaraId, nomorPerkara: p.nomorPerkara, keadaan: "gagal", tersimpan: 0, pesan: e instanceof Error ? e.message : String(e) };
    }
    hasil.push(h);
    opsi.kabar?.(h, i);
  }
  return hasil;
}

/**
 * Jeda di antara dua perkara Kasir otomatis, dalam milidetik: 20-150 detik,
 * log-seragam (median ~55 detik).
 *
 * Audit pola 18 Okt 2026 atas sipp_donggala: 3.233 pasang baris jurnal
 * beruntun kasir 2026 pada perkara BERBEDA berjarak p10 20 dtk, p25 35 dtk,
 * median 76 dtk; yang <= 5 dtk hanya 13 (0,4%). Dahulu 1,8-4,2 dtk - sepuluh
 * perkara tercatat dalam satu menit atas akun kasir. Kasir otomatis berjalan
 * sendiri di latar, jadi tidak ada orang yang menunggu jeda ini.
 */
export const JEDA_ANTAR_PERKARA_MS = { min: 20_000, maks: 150_000 } as const;

export function lamaJedaAntarPerkara(acak: () => number = Math.random): number {
  const u = Math.min(Math.max(Number(acak()) || 0, 0), 1);
  const { min, maks } = JEDA_ANTAR_PERKARA_MS;
  return Math.round(min * Math.pow(maks / min, u));
}

/** Menunggu satu jeda antarperkara; `skala` 0 untuk uji. */
export function jedaAntarPerkara(skala = 1): Promise<void> {
  const ms = Math.round(lamaJedaAntarPerkara() * Math.max(0, skala));
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Rekap ───────────────────────────────────────────────────────────────────

export const PERIODE_REKAP = ["harian", "mingguan", "bulanan", "triwulan", "semester", "tahunan"] as const;
export type PeriodeRekap = (typeof PERIODE_REKAP)[number];

export const LABEL_PERIODE: Record<PeriodeRekap, string> = {
  harian: "Harian",
  mingguan: "Mingguan",
  bulanan: "Bulanan",
  triwulan: "Triwulan",
  semester: "Semester",
  tahunan: "Tahunan",
};

const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function isoSah(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return false;
  const [t, b, h] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(t, b - 1, h));
  return d.getUTCFullYear() === t && d.getUTCMonth() === b - 1 && d.getUTCDate() === h;
}

function iso(t: number, b: number, h: number) {
  return new Date(Date.UTC(t, b, h)).toISOString().slice(0, 10);
}

export function tanggalPanjang(isoTanggal: string): string {
  if (!isoSah(isoTanggal)) return isoTanggal || "-";
  const [t, b, h] = isoTanggal.split("-").map(Number);
  return `${h} ${NAMA_BULAN[b - 1]} ${t}`;
}

/**
 * Rentang satu periode yang MEMUAT tanggal itu. Minggu = Senin-Minggu;
 * triwulan I-IV; semester I (Jan-Jun) dan II (Jul-Des).
 */
export function rentangPeriode(periode: PeriodeRekap, tanggal: string): { dari: string; sampai: string; label: string } {
  if (!isoSah(tanggal)) throw new Error("Tanggal rekap tidak sah.");
  const [t, b1, h] = tanggal.split("-").map(Number);
  const b = b1 - 1;
  switch (periode) {
    case "harian":
      return { dari: tanggal, sampai: tanggal, label: `Harian ${tanggalPanjang(tanggal)}` };
    case "mingguan": {
      const hari = new Date(Date.UTC(t, b, h)).getUTCDay();
      const mundur = (hari + 6) % 7;
      const dari = iso(t, b, h - mundur);
      const sampai = iso(t, b, h - mundur + 6);
      return { dari, sampai, label: `Mingguan ${tanggalPanjang(dari)} - ${tanggalPanjang(sampai)}` };
    }
    case "bulanan":
      return { dari: iso(t, b, 1), sampai: iso(t, b + 1, 0), label: `Bulanan ${NAMA_BULAN[b]} ${t}` };
    case "triwulan": {
      const q = Math.floor(b / 3);
      return { dari: iso(t, q * 3, 1), sampai: iso(t, q * 3 + 3, 0), label: `Triwulan ${["I", "II", "III", "IV"][q]} ${t}` };
    }
    case "semester": {
      const s = b < 6 ? 0 : 1;
      return { dari: iso(t, s * 6, 1), sampai: iso(t, s * 6 + 6, 0), label: `Semester ${s ? "II" : "I"} ${t}` };
    }
    case "tahunan":
      return { dari: iso(t, 0, 1), sampai: iso(t, 11, 31), label: `Tahunan ${t}` };
    default:
      throw new Error("Periode rekap tidak dikenal.");
  }
}

export function periodeSah(nilai: unknown): nilai is PeriodeRekap {
  return typeof nilai === "string" && (PERIODE_REKAP as readonly string[]).includes(nilai);
}

/**
 * Nama jenis biaya yang mudah dibaca: bagian sesudah garis miring yang hanya
 * menyebut kedudukan lain atau sarana (Terlawan, Pelawan, Iklan, Radio, ...)
 * dibuang - "Biaya Panggilan Tergugat/Terlawan/Pelawan/Iklan/Radio/Pengumuman"
 * menjadi "Biaya Panggilan Tergugat". Yang bermakna ("Biaya Pendaftaran/PNBP")
 * tetap.
 */
export function namaBiayaRingkas(nama: string): string {
  const potong = String(nama || "").split("/").map((x) => x.trim());
  const buang = /^(terlawan|pelawan|pembantah|terbantah|iklan|radio|pengumuman|penyampaian putusan|termohon melalui iklan)$/i;
  const sisa = [potong[0], ...potong.slice(1).filter((x) => x && !buang.test(x))];
  return sisa.filter(Boolean).join("/");
}

export type RekapMentah = {
  ok: boolean;
  dari: string;
  sampai: string;
  perJenis: Array<{ jenisBiayaId: number; nama: string; kategori: string; kategoriId: number; jenisTransaksi: number; baris: number; jumlah: number; perkara: number }>;
  perPerkara: Array<{ perkaraId: number; nomorPerkara: string; jenisPerkara: string; keluar: number; masuk: number; barisKeluar: number; sisaDikembalikan: number }>;
  perkaraTerpotong: boolean;
  perHari: Array<{ tanggal: string; keluar: number; masuk: number; pnbp: number; baris: number }>;
  setorPnbp: Array<{ tanggal: string; jumlah: number; ntpn: string }>;
  setorTerbaca: boolean;
};

export type RekapKasir = {
  periode: PeriodeRekap;
  label: string;
  dari: string;
  sampai: string;
  pengeluaran: Array<{ jenisBiayaId: number; nama: string; kategori: string; baris: number; perkara: number; jumlah: number; persen: number }>;
  pemasukan: Array<{ jenisBiayaId: number; nama: string; baris: number; jumlah: number }>;
  totalKeluar: number;
  totalMasuk: number;
  totalPnbp: number;
  pnbpDisetor: number;
  sisaDikembalikan: number;
  perPerkara: RekapMentah["perPerkara"];
  perkaraTerpotong: boolean;
  perHari: RekapMentah["perHari"];
  jumlahBarisKeluar: number;
};

/** Rekap mentah bot -> rekap yang dibaca layar dan PDF: diurut terbesar, bertotal, berpersen. */
export function susunRekap(m: RekapMentah, periode: PeriodeRekap, label: string): RekapKasir {
  const keluar = m.perJenis.filter((j) => j.jenisTransaksi < 0);
  const masuk = m.perJenis.filter((j) => j.jenisTransaksi > 0);
  const totalKeluar = keluar.reduce((s, j) => s + j.jumlah, 0);
  const totalMasuk = masuk.reduce((s, j) => s + j.jumlah, 0);
  const totalPnbp = keluar.filter((j) => j.kategoriId === 11).reduce((s, j) => s + j.jumlah, 0);
  const pnbpDisetor = (m.setorPnbp || []).reduce((s, x) => s + (Number(x.jumlah) || 0), 0);
  return {
    periode,
    label,
    dari: m.dari,
    sampai: m.sampai,
    pengeluaran: keluar
      .map((j) => ({
        jenisBiayaId: j.jenisBiayaId,
        nama: namaBiayaRingkas(j.nama),
        kategori: j.kategori,
        baris: j.baris,
        perkara: j.perkara,
        jumlah: j.jumlah,
        persen: totalKeluar > 0 ? Math.round((j.jumlah / totalKeluar) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama)),
    pemasukan: masuk.map((j) => ({ jenisBiayaId: j.jenisBiayaId, nama: namaBiayaRingkas(j.nama), baris: j.baris, jumlah: j.jumlah })).sort((a, b) => b.jumlah - a.jumlah),
    totalKeluar,
    totalMasuk,
    totalPnbp,
    pnbpDisetor,
    sisaDikembalikan: m.perPerkara.reduce((s, p) => s + p.sisaDikembalikan, 0),
    perPerkara: m.perPerkara.filter((p) => p.keluar > 0 || p.masuk > 0),
    perkaraTerpotong: m.perkaraTerpotong,
    perHari: m.perHari,
    jumlahBarisKeluar: keluar.reduce((s, j) => s + j.baris, 0),
  };
}

export function rupiahPenuh(n: number | null | undefined): string {
  const x = Math.round(Number(n) || 0);
  return `${x < 0 ? "-" : ""}Rp${Math.abs(x).toLocaleString("id-ID")}`;
}

// ─── Pengingat ───────────────────────────────────────────────────────────────

export type JenisPengingat = "sisa-panjar" | "belum-dijurnal" | "panjar-kurang" | "pnbp-belum-setor";

export type PengingatKasir = {
  jenis: JenisPengingat;
  perkaraId: number;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggal?: string;
  tenggat: string;
  jumlah: number | null;
  keterangan: string;
};

export type JawabanPengingat = {
  ok: boolean;
  hariIni: string;
  butir: PengingatKasir[];
  ringkas: { sisaPanjar: number; belumDijurnal: number; panjarKurang: number; pnbpBelumSetor: number; lewat: number };
  setorTerbaca: boolean;
};

/** Jadwal Sidang ALETA e-Court dengan dialog Kasir harian terbuka (jangkar #kasir). */
export const ALAMAT_KASIR_PORTAL = "/aleta/aleta-ecourt#kasir";

export const JUDUL_PENGINGAT: Record<JenisPengingat, string> = {
  "sisa-panjar": "Kembalikan sisa panjar",
  "belum-dijurnal": "Jurnal hari putusan belum diisi",
  "panjar-kurang": "Panjar kurang - minta tambahan panjar",
  "pnbp-belum-setor": "Setor PNBP ke kas negara",
};

/** Kelompok checklist: lewat / hari-ini / minggu-ini (tenggat lebih dari 7 hari ke depan tidak ditampilkan). */
export function kelompokTenggat(tenggat: string, hariIni: string): "lewat" | "hari-ini" | "minggu-ini" | null {
  if (!isoSah(tenggat) || !isoSah(hariIni)) return null;
  if (tenggat < hariIni) return "lewat";
  if (tenggat === hariIni) return "hari-ini";
  const sampai = new Date(Date.parse(`${hariIni}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  return tenggat <= sampai ? "minggu-ini" : null;
}

/**
 * Pengingat kasir menjadi butir checklist milestone (bentuk ButirChecklist),
 * supaya widget ekstensi menampilkannya tanpa versi ekstensi baru. Jurnal
 * dikerjakan di tab Biaya Perkara SIPP (halaman "keuangan"); setoran PNBP
 * dicatat di Kasir portal.
 */
export function butirChecklistKasir(j: Pick<JawabanPengingat, "butir" | "hariIni">) {
  const hasil: Array<{
    id: string;
    jenis: string;
    judul: string;
    perkara: { id: string; nomor: string } | null;
    tenggat: string | null;
    kelompok: "lewat" | "hari-ini" | "minggu-ini";
    keterangan: string;
    kerjakan: { tujuan: "sipp"; halaman: "keuangan" } | { tujuan: "aleta"; alamat: string };
  }> = [];
  for (const b of j.butir) {
    const kelompok = kelompokTenggat(b.tenggat, j.hariIni);
    if (!kelompok) continue;
    const pnbp = b.jenis === "pnbp-belum-setor";
    hasil.push({
      id: `kasir.${b.jenis}:${pnbp ? b.tanggal : b.perkaraId}`,
      jenis: `kasir.${b.jenis}`,
      judul: JUDUL_PENGINGAT[b.jenis],
      perkara: pnbp || !b.perkaraId ? null : { id: String(b.perkaraId), nomor: b.nomorPerkara },
      tenggat: b.tenggat,
      kelompok,
      keterangan: b.keterangan,
      kerjakan: pnbp ? { tujuan: "aleta", alamat: ALAMAT_KASIR_PORTAL } : { tujuan: "sipp", halaman: "keuangan" },
    });
  }
  return hasil;
}
