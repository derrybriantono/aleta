import { biayaUsd, bulatkanKeAtas, hitungHarga, kursEfektif, perkirakanTokenDariKarakter, type ParameterHarga } from "@/lib/aleta-ai/biaya";
import { pilihRute, tabelRuteDari } from "@/lib/aleta-ai/rute";
import type { AletaDatabase } from "@/server/db/client";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import { periksaBatas } from "@/server/modules/aleta-ai/batas";
import { kursBerlaku, type KursBerlaku } from "@/server/modules/aleta-ai/kurs";
import { awalanPromoHabis, statusPromo, type StatusPromo } from "@/server/modules/aleta-ai/promo";
import { bacaPengaturan, bacaRute, bacaTarif, type PengaturanAi } from "@/server/modules/aleta-ai/pengaturan";
import { aletaAiDihentikan } from "@/server/modules/aleta-ai/saklar";
import { saldoPengguna } from "@/server/modules/aleta-ai/saldo";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * ALETA Ai - PERKIRAAN BIAYA SEBELUM JALAN (tahap 4)
 * ============================================================================
 *
 * Rupiah yang ditampilkan SEBELUM giliran/tugas berjalan memakai rumus yang
 * sama dengan biaya aktual (lib/aleta-ai/biaya.ts):
 *
 *   token masuk  = count_tokens (bila ada) atau karakter/4
 *   token keluar = perkiraan keluaran kelompok rute (tabel rute, Super Admin)
 *   perkiraan    = hitungHarga(USD, kurs, margin, MDR) - dibulatkan, minimum
 *   ditahan      = perkiraan x faktorTahan, dibulatkan (penyangga selisih)
 *
 * Pola dana: tahan(perkiraan) -> jalan -> lepas + potong(biaya aktual);
 * selisih kembali ke saldo; gagal = tidak dipotong (saldo.ts).
 *
 * perkirakanBiayaTugas() dipakai tugas panjang (T9): satu perkiraan per tugas,
 * lalu tahanDana(..., {sekali:true}) dengan rujukan tugas itu.
 */

export function parameterHarga(p: PengaturanAi): ParameterHarga {
  return { marginPersen: p.marginPersen, penyanggaKursPersen: p.penyanggaKursPersen, minimumRp: p.minimumRp, pembulatanRp: p.pembulatanRp, mdrPersen: p.mdrPersen };
}

/** Rupiah perkiraan dan dana yang ditahan untuk biaya USD perkiraan. */
export function rupiahPerkiraan(usd: number, kursDasar: number, pengaturan: PengaturanAi, gratis: boolean): { perkiraanRp: number; tahanRp: number; biayaApiRp: number } {
  const harga = hitungHarga(usd, kursDasar, parameterHarga(pengaturan), { gratis });
  const tahanRp = gratis ? 0 : bulatkanKeAtas(harga.hargaRp * pengaturan.faktorTahan, pengaturan.pembulatanRp);
  return { perkiraanRp: harga.tagihRp, tahanRp, biayaApiRp: harga.biayaApiRp };
}

export type PerkiraanBiaya = {
  kelompok: string;
  /** Label tampilan (Cepat/Teliti/Mendalam). Nama model tidak ditampilkan ke pengguna. */
  label: string;
  tokenMasuk: number;
  tokenKeluar: number;
  perkiraanRp: number;
  tahanRp: number;
  kurs: KursBerlaku;
  /** Kurs dasar x (1 + penyangga). */
  kursDipakai: number;
  saldoRp: number;
  gratis: boolean;
  /** Gratis karena program promosi (bukan karena Super Admin): perkiraanRp = 0. */
  promo?: boolean;
  /** Keadaan jatah promosi pengguna ini (null bila tidak ada program/bukan sasaran). */
  statusPromo?: StatusPromo | null;
  /** Saldo cukup DAN batas belum tercapai. */
  bolehJalan: boolean;
  /** Bila tidak boleh jalan: sebabnya, dalam bahasa pengguna. */
  alasan?: string;
};

/** Penilaian bersama: saklar, saldo, batas harian/satker atas perkiraan ini. */
export async function nilaiPerkiraan(
  db: AletaDatabase,
  pelaku: PelakuAi,
  pengaturan: PengaturanAi,
  dasar: { kelompok: string; label: string; tokenMasuk: number; tokenKeluar: number; perkiraanRp: number; tahanRp: number; biayaApiRp: number; kurs: KursBerlaku },
  sekarang: Date = new Date()
): Promise<PerkiraanBiaya> {
  const saldoRp = await saldoPengguna(db, pelaku.id);
  const promo = await statusPromo(db, pelaku, { sekarang, tambahanApiRp: dasar.biayaApiRp });
  const promoBerlaku = promo.berlaku;
  const hasil: PerkiraanBiaya = {
    kelompok: dasar.kelompok,
    label: dasar.label,
    tokenMasuk: dasar.tokenMasuk,
    tokenKeluar: dasar.tokenKeluar,
    perkiraanRp: promoBerlaku ? 0 : dasar.perkiraanRp,
    tahanRp: promoBerlaku ? 0 : dasar.tahanRp,
    kurs: dasar.kurs,
    kursDipakai: kursEfektif(dasar.kurs.kurs, pengaturan.penyanggaKursPersen),
    saldoRp,
    gratis: pelaku.superAdmin || promoBerlaku,
    ...(promoBerlaku ? { promo: true } : {}),
    ...(promo.tampil ? { statusPromo: promo } : {}),
    bolehJalan: true,
  };
  const tolak = (alasan: string): PerkiraanBiaya => ({ ...hasil, bolehJalan: false, alasan });
  if (!pengaturan.aktif || (await aletaAiDihentikan(db))) return tolak("ALETA Ai sedang dimatikan oleh admin.");
  const batas = await periksaBatas(db, pelaku, pengaturan, sekarang, {
    tambahanRp: promoBerlaku ? 0 : dasar.perkiraanRp,
    tambahanToken: dasar.tokenMasuk + dasar.tokenKeluar,
    tambahanApiRp: dasar.biayaApiRp,
    tanpaTagihan: promoBerlaku,
  });
  if (!batas.ok) return tolak(batas.alasan);
  if (!pelaku.superAdmin && !promoBerlaku && saldoRp < dasar.perkiraanRp) {
    return tolak(`${awalanPromoHabis(promo)}Saldo ALETA Ai Anda (Rp${saldoRp.toLocaleString("id-ID")}) tidak cukup (perkiraan Rp${dasar.perkiraanRp.toLocaleString("id-ID")}). Hubungi Super Admin untuk mengisi saldo.`);
  }
  return hasil;
}

/**
 * Perkiraan untuk tugas panjang (T9) atau pemanggil lain yang sudah tahu
 * kelompoknya. `tokenMasuk` (hasil count_tokens) lebih diutamakan daripada
 * `karakterMasuk`; `tokenKeluar` bawaan = perkiraan keluaran kelompok.
 */
export async function perkirakanBiayaTugas(
  db: AletaDatabase,
  pelaku: PelakuAi,
  masukan: { kelompok: string; tokenMasuk?: number; karakterMasuk?: number; tokenKeluar?: number },
  sekarang: Date = new Date()
): Promise<PerkiraanBiaya> {
  const pengaturan = await bacaPengaturan(db);
  const tabel = tabelRuteDari(await bacaRute(db));
  const pilihan = pilihRute(tabel, String(masukan.kelompok ?? "").trim(), pelaku.peranId);
  if (!pilihan.ok) throw new ApiError(403, pilihan.alasan);
  const rute = pilihan.rute;
  const tarif = (await bacaTarif(db)).find((t) => t.model === rute.model);
  const tokenMasuk = Math.max(0, Math.trunc(masukan.tokenMasuk ?? perkirakanTokenDariKarakter(masukan.karakterMasuk ?? 0)));
  const tokenKeluar = Math.max(0, Math.trunc(masukan.tokenKeluar ?? rute.perkiraanKeluaran));
  const usd = tarif ? biayaUsd(tarif, { masuk: tokenMasuk, keluar: tokenKeluar, cacheTulis: 0, cacheBaca: 0 }) : 0;
  const kurs = await kursBerlaku(db, sekarang);
  const rp = rupiahPerkiraan(usd, kurs.kurs, pengaturan, pelaku.superAdmin);
  return nilaiPerkiraan(db, pelaku, pengaturan, { kelompok: rute.kelompok, label: rute.label, tokenMasuk, tokenKeluar, ...rp, kurs }, sekarang);
}
