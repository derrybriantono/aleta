/**
 * ============================================================================
 * KASIR - JURNAL KEUANGAN PERKARA DARI JADWAL SIDANG (6 Okt 2026)
 * ============================================================================
 *
 * Bagian layar yang murni (tanpa React): siapa yang boleh, hitung saldo/sisa
 * seperti Buku Jurnal Keuangan SIPP, dan pagar isian yang sama dengan
 * validateInput SIPP. Mesin usulannya di bot (aleta_bot/services/
 * kasirJurnalService.js) - hitungSisaOtomatis di sini KEMBARANNYA, diuji
 * berdampingan di kasir-jurnal.test.ts.
 */

import { getEffectivePositionId, getEffectiveRoleId, isPrivilegedAdmin } from "@/lib/permissions";
import type { UserPersona } from "@/lib/types";

/**
 * Peran yang boleh membuka Kasir.
 *
 * Mengikuti peran yang ADA di portal: peran tambahan Keuangan Perkara/Keuangan
 * (user-additional-roles: kasir, petugas_keuangan_perkara, bendahara_*),
 * peran analis-keuangan dan jabatan bendahara/analis keuangan, golongan
 * PANITERA (panitera, panitera muda - atasan kasir yang memeriksa jurnal),
 * dan admin. Panitera pengganti, hakim, juru sita tidak - jurnal keuangan
 * bukan pekerjaan mereka.
 */
export const PERAN_TAMBAHAN_KASIR: readonly string[] = [
  "kasir",
  "petugas_keuangan_perkara",
  "bendahara_penerimaan",
  "bendahara_pengeluaran",
];
export const PERAN_KASIR: readonly string[] = ["analis-keuangan", "panitera", "panitera-muda"];
const POSISI_KASIR = /^pos-(bendahara|analis-keuangan|panitera$|panitera-muda)/;

type PenggunaHak = Pick<UserPersona, "roleId" | "positionId"> &
  Partial<Pick<UserPersona, "additionalRoleIds" | "actingAssignment">>;

export function bolehKasir(pengguna: PenggunaHak | null | undefined): boolean {
  if (!pengguna) return false;
  const persona = pengguna as UserPersona;
  if (isPrivilegedAdmin(persona)) return true;
  const peran = new Set<string>([
    String(getEffectiveRoleId(persona) ?? pengguna.roleId ?? ""),
    String(pengguna.roleId ?? ""),
  ]);
  if (peran.has("admin") || peran.has("super-admin")) return true;
  if (PERAN_KASIR.some((p) => peran.has(p))) return true;
  const tambahan = new Set((pengguna.additionalRoleIds ?? []).map((x) => String(x).toLowerCase()));
  if (PERAN_TAMBAHAN_KASIR.some((p) => tambahan.has(p))) return true;
  const posisi = String(getEffectivePositionId(persona) ?? pengguna.positionId ?? "");
  return POSISI_KASIR.test(posisi);
}

// ─── Bentuk data (jawaban bot) ───────────────────────────────────────────────

export type BarisJurnal = {
  id: number;
  jenisBiayaId: number;
  kategoriId: number;
  jenisTransaksi: number;
  pihakId: number | null;
  pihakKe: number | null;
  tanggal: string;
  uraian: string;
  jumlah: number;
  keterangan: string;
  diinputOleh: string;
  namaPihak: string;
  jurusita: string;
  urutan: number;
};

export type UsulanJurnal = {
  kunci: string;
  jenisBiayaId: number;
  kategoriId: number;
  jenisTransaksi: number;
  pihakKe: number;
  pihakId: number;
  uraian: string;
  jumlah: number | null;
  tanggal: string;
  keterangan: string;
  jurusitaId: number;
  peristiwa: string;
  dasar: string;
  yakin: "tinggi" | "sedang" | "rendah";
  pilih: boolean;
  perluResi: boolean;
  sisaOtomatis: boolean;
  manual?: boolean;
};

export type JenisBiayaKasir = { id: number; nama: string; kategoriId: number; kategori: string; jenisTransaksi: number; jumlahBawaan: number };
export type PihakKasir = { id: number; ke: number; pihakId: number; nama: string; urutan: number };

/** Saldo jurnal yang sudah ada - pemasukan dikurangi pengeluaran. */
export function saldoJurnal(jurnal: Pick<BarisJurnal, "jenisTransaksi" | "jumlah">[]): number {
  return jurnal.reduce((s, b) => s + (Number(b.jenisTransaksi) || 0) * (Number(b.jumlah) || 0), 0);
}

/**
 * Pengembalian Sisa Panjar = saldo jurnal + seluruh usulan tercentang sebelum
 * baris sisa (kembaran hitungSisaOtomatis di bot). Mengubah jumlah baris
 * sisaOtomatis; pulang saldo akhir.
 */
export function hitungSisaOtomatis(usulan: UsulanJurnal[], saldoAwal: number): number {
  let saldo = Number(saldoAwal) || 0;
  for (const u of usulan) {
    if (u.sisaOtomatis) {
      u.jumlah = saldo;
      if (u.pilih && saldo > 0) saldo = 0;
      continue;
    }
    if (!u.pilih) continue;
    saldo += (Number(u.jenisTransaksi) || -1) * (Number(u.jumlah) || 0);
  }
  return saldo;
}

/** Baris gabungan untuk tabel pratinjau: jurnal lama + usulan tercentang, berurut seperti SIPP. */
export type BarisTampil = {
  kunci: string;
  baru: boolean;
  tanggal: string;
  uraian: string;
  pihak: string;
  pemasukan: number;
  pengeluaran: number;
  sisa: number;
  keterangan: string;
};

const AKHIRAN_PIHAK: Record<number, string> = { 1: "(P)", 2: "(T)", 3: "(I)", 4: "(TT)" };

export function susunTampilan(
  jurnal: BarisJurnal[],
  usulan: UsulanJurnal[],
  pihak: PihakKasir[],
  namaJurusita: (id: number) => string
): BarisTampil[] {
  const nama = (pihakId: number | null, ke: number | null, cadangan = "") => {
    const p = pihak.find((x) => x.pihakId === Number(pihakId));
    const n = p?.nama || cadangan;
    return n ? `${n}${ke ? AKHIRAN_PIHAK[ke] ?? "" : ""}` : "";
  };
  const lama = jurnal.map((b, i) => ({
    urut: [b.tanggal, 0, b.id, i] as const,
    baris: {
      kunci: `j${b.id}`,
      baru: false,
      tanggal: b.tanggal,
      uraian: b.uraian,
      pihak: nama(b.pihakId, b.pihakKe, b.namaPihak),
      jenisTransaksi: b.jenisTransaksi,
      jumlah: b.jumlah,
      keterangan: `${b.keterangan}${b.jurusita ? `${b.keterangan ? " " : ""}(${b.jurusita})` : ""}`,
    },
  }));
  const baru = usulan
    .filter((u) => u.pilih && (u.sisaOtomatis ? Number(u.jumlah) > 0 : true))
    .map((u, i) => ({
      urut: [u.tanggal, 1, i, i] as const,
      baris: {
        kunci: u.kunci,
        baru: true,
        tanggal: u.tanggal,
        uraian: u.uraian,
        pihak: nama(u.pihakId, u.pihakKe),
        jenisTransaksi: u.jenisTransaksi,
        jumlah: Number(u.jumlah) || 0,
        keterangan: `${u.keterangan}${u.jurusitaId ? `${u.keterangan ? " " : ""}(${namaJurusita(u.jurusitaId)})` : ""}`,
      },
    }));
  // SIPP: ORDER BY tanggal_transaksi, id - baris baru lahir dengan id terbesar.
  const semua = [...lama, ...baru].sort(
    (a, b) => a.urut[0].localeCompare(b.urut[0]) || a.urut[1] - b.urut[1] || a.urut[2] - b.urut[2]
  );
  let sisa = 0;
  return semua.map(({ baris }) => {
    const masuk = baris.jenisTransaksi > 0 ? baris.jumlah : 0;
    const keluar = baris.jenisTransaksi < 0 ? baris.jumlah : 0;
    sisa += masuk - keluar;
    return {
      kunci: baris.kunci,
      baru: baris.baru,
      tanggal: baris.tanggal,
      uraian: baris.uraian,
      pihak: baris.pihak,
      pemasukan: masuk,
      pengeluaran: keluar,
      sisa,
      keterangan: baris.keterangan,
    };
  });
}

function isoSah(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [t, b, h] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(t, b - 1, h));
  return d.getUTCFullYear() === t && d.getUTCMonth() === b - 1 && d.getUTCDate() === h;
}

/**
 * Pagar satu baris - urutan dan bunyi pesan validateInput SIPP. "" bila lolos.
 * Bot memeriksa ulang; ini supaya layar menandai merah sebelum ditekan.
 */
export function periksaBarisKasir(
  u: Pick<UsulanJurnal, "tanggal" | "jenisBiayaId" | "uraian" | "jumlah" | "pihakId" | "pihakKe">,
  bahan: { hariIni: string; tanggalDaftar: string; bebasAkhirPekan?: boolean }
): string {
  if (!isoSah(u.tanggal)) return "Tanggal Transaksi wajib diisi (tgl/bln/tahun).";
  if (!Number(u.jenisBiayaId)) return "Jenis Biaya wajib dipilih.";
  if (!String(u.uraian || "").trim()) return "Uraian wajib diisi.";
  if (!(Number(u.jumlah) > 0)) return "Jumlah wajib diisi.";
  if (!Number(u.pihakId) || !Number(u.pihakKe)) return "Pihak yang membayar wajib dipilih.";
  if (bahan.hariIni && u.tanggal > bahan.hariIni) return "Tanggal Transaksi Tidak Boleh Melebihi Hari Ini.";
  if (bahan.tanggalDaftar && u.tanggal < bahan.tanggalDaftar) return "Tanggal transaksi tidak boleh kurang dari tanggal pendaftaran";
  if (!bahan.bebasAkhirPekan) {
    const [t, b, h] = u.tanggal.split("-").map(Number);
    const hari = new Date(Date.UTC(t, b - 1, h)).getUTCDay();
    if (hari === 0 || hari === 6) return "Tidak Dapat Memilih Tanggal Transaksi Dihari Libur, Sabtu dan Minggu.";
  }
  return "";
}

/** Uraian yang masih menunggu nomor resi Pos ("Biaya Panggilan Tergugat/"). */
export function uraianTanpaResi(uraian: string): boolean {
  return /\/\s*$/.test(String(uraian || ""));
}

export function rupiah(n: number | null | undefined): string {
  const x = Number(n) || 0;
  return `Rp${Math.round(x).toLocaleString("id-ID")}`;
}
