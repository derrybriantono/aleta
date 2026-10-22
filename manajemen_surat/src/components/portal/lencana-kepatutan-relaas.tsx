"use client";

/**
 * ============================================================================
 * LENCANA HASIL PANGGILAN - SATU ATURAN (W58, 22 Okt 2026)
 * ============================================================================
 *
 * Dipakai Jadwal Sidang (relaas sidang ini + riwayat panggilan sebelumnya) dan
 * Status Perkara. Aturannya di @/lib/kepatutan-relaas (padanan
 * aleta_bot/services/kepatutanRelaas.js): SEMA 1/2023 angka 12 untuk surat
 * tercatat, Pasal 718 RBg untuk jurusita, elektronik dianggap bertemu.
 *
 * Sebab: surat tercatat 609/Pdt.G/2026 "diterima oleh A/ayah kandung" tampil
 * "Tidak bertemu", padahal penyerahan kepada orang serumah sah (huruf c).
 *
 * Warna: hijau sah, kuning perlu diperiksa, merah tidak sah/retur. Keterangan
 * dan dasar hukumnya pada judul gantung (tanda i).
 */

import { Badge } from "@/components/ui/badge";
import { nilaiRelaas, type KepatutanRelaas } from "@/lib/kepatutan-relaas";
import { cocokNamaPenerimaLawan } from "@/lib/nama-penerima-lawan";

export type BarisKepatutanRelaas = {
  caraRelaas?: { sandi?: string } | null;
  ketHasilRelaas?: string;
  statusPos?: number | null;
  noResiPos?: string;
  tanggalKirimPos?: string;
  tanggalRelaas?: string;
  namaPihak?: string;
  pihakKe?: number | null;
  /** Retur menurut bot (returRelaas.js) - aturan yang sama. */
  retur?: boolean;
};

const VARIAN = { hijau: "success", kuning: "warning", merah: "danger" } as const;

/** Kepatutan satu baris relaas portal, termasuk penanda penerima mirip pihak lawan. */
export function kepatutanBarisRelaas(
  baris: BarisKepatutanRelaas,
  pihak?: Array<{ nama: string; pihakKe: number | null }>
): KepatutanRelaas {
  let k = nilaiRelaas({
    ketTemu: baris.caraRelaas?.sandi,
    statusPos: baris.statusPos,
    hasil: baris.ketHasilRelaas,
    noResiPos: baris.noResiPos,
    tanggalKirimPos: baris.tanggalKirimPos,
    namaPihak: baris.namaPihak,
    pihakKe: baris.pihakKe,
  });
  // Bot lama tanpa frasa SEMA dapat berbeda pendapat: retur dari bot tetap dihormati.
  if (baris.retur && !k.retur) {
    k = {
      ...k,
      retur: true,
      labelRetur: k.labelRetur || (k.jalur === "surat_tercatat" ? "Retur pos" : "Retur"),
      sah: k.sah === true ? null : k.sah,
      warna: k.sah === true ? "kuning" : k.warna,
    };
  }
  // SEMA 1/2023 angka 6 huruf a: penerima tidak boleh pihak lawan. Nama yang
  // MIRIP lawan tidak menuduh (penandanya bertanda tanya) - cukup turun ke kuning.
  if (k.sah === true && pihak && pihak.length) {
    const lawan = cocokNamaPenerimaLawan({ pihakKe: baris.pihakKe, ketHasilRelaas: baris.ketHasilRelaas, pihak });
    if (lawan.cocok) {
      k = {
        ...k,
        sah: null,
        warna: "kuning",
        keterangan: `${k.keterangan} Nama penerima mirip pihak lawan (${lawan.namaLawan}) - penerima tidak boleh pihak lawan (SEMA 1/2023 angka 6 huruf a).`,
      };
    }
  }
  return k;
}

export function judulKepatutan(k: KepatutanRelaas): string {
  return [k.keterangan, k.dasar ? `Dasar: ${k.dasar}.` : ""].filter(Boolean).join(" ");
}

/**
 * Lencana RETUR beserta sebabnya (keputusan pengguna 22 Okt 2026): retur tetap
 * dihitung retur, tetapi tulisannya menyebut sebabnya - "Retur - alamat tidak
 * ditemukan (SEMA 1/2023 angka 12 huruf e)", "Retur - menolak menerima (angka
 * 12 huruf b)", "Retur - FAILED TO DELIVERY", "Retur pos".
 * `varian`: "pita" = kotak merah padat Jadwal Sidang; "lencana" = Badge Status Perkara.
 */
export function LencanaRetur({
  baris,
  varian = "pita",
}: {
  baris: BarisKepatutanRelaas;
  varian?: "pita" | "lencana";
}) {
  const k = kepatutanBarisRelaas(baris);
  const teks = k.labelRetur || "Retur";
  const judul = k.keterangan ? `${k.keterangan}${k.dasar ? ` Dasar: ${k.dasar}.` : ""}` : "Surat panggilan dikembalikan.";
  if (varian === "lencana") {
    return (
      <Badge variant="danger" title={judul} data-retur={k.kunci}>
        {teks}
      </Badge>
    );
  }
  return (
    <span className="rounded bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold text-white" title={judul} data-retur={k.kunci}>
      {teks}
    </span>
  );
}

/**
 * Lencana hasil panggilan. `tanpaRetur`: pemanggil sudah memasang LencanaRetur
 * (yang menyebut sebabnya), sehingga relaas retur tidak diberi lencana kedua.
 */
export function LencanaKepatutanRelaas({
  baris,
  pihak,
  tanpaRetur = false,
}: {
  baris: BarisKepatutanRelaas;
  pihak?: Array<{ nama: string; pihakKe: number | null }>;
  tanpaRetur?: boolean;
}) {
  const k = kepatutanBarisRelaas(baris, pihak);
  // Lencana retur (LencanaRetur) sudah menyebut sebabnya - tidak diulang.
  if (tanpaRetur && k.retur) return null;
  return (
    <Badge variant={VARIAN[k.warna]} title={judulKepatutan(k)} data-kepatutan={k.kunci}>
      {k.label}
      <span aria-hidden className="ml-1 text-[10px] opacity-70">
        ⓘ
      </span>
    </Badge>
  );
}
