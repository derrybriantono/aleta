import { getEffectiveRoleId } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { ApiError } from "@/server/shared/errors";

import { muatPustakaMesin } from "./service";

/**
 * ============================================================================
 * JALUR ALETA ABT (Tahap 4, 5 Nov 2026) - mesin isian sendiri, HANYA atas permintaan eksplisit dan HANYA Super Admin
 * ============================================================================
 *
 * Pratinjau/cetak lewat mesin variabel yang membaca rumus dari PUSTAKA ALETA (aleta_abt_variabel) dan jatuh ke katalog ABT bila barisnya
 * belum ada, serta memberi tiap isian sumber (SIPP, e-Court, gugatan, saksi, manual) dan keyakinan (pasti, periksa, kosong).
 * Perilaku bawaan pratinjau, panel Blangko Derry, dan BAS massal tidak memanggil berkas ini sama sekali.
 *
 * Penjagaan ada di SERVER (di sini), bukan di tampilan: akun selain Super Admin yang memintanya ditolak 403, bukan diabaikan diam-diam.
 * Hanya membaca: bot memakai mesin variabel yang sama (pagarBaca) - tidak ada tulisan ke SIPP/ABT.
 */

const BATAS_MS = 90_000;

type KeteranganIsian = { noVar: string; kode: string; nama: string; asalRumus: string; sumber: string; keyakinan: "pasti" | "periksa" | "kosong"; status: string; sebab: string; peringatan?: string };

type HasilBot = {
  ok?: boolean;
  sebab?: string;
  berkas?: string;
  jumlahTerisi?: number;
  kosong?: Array<{ noVar: string; nama?: string; sebab?: string; status?: string }>;
  mesinGalat?: string;
  rtfBase64?: string;
  isian?: KeteranganIsian[];
  lolosCetak?: boolean;
  ditahan?: boolean;
  ringkasanKeyakinan?: Record<string, number>;
};

/** Jalur ALETA ABT hanya untuk Super Admin (peran efektif, sehingga "Lihat sebagai akun" tidak membukanya). */
export function bolehJalurAleta(actor: Parameters<typeof getEffectiveRoleId>[0]): boolean {
  return getEffectiveRoleId(actor) === "super-admin";
}

export type PermintaanJalurAleta = { folder: string; berkas: string; perkaraId: string; sidangKe: number; cetakFinal: boolean };

export type JawabanJalurAleta =
  | { ok: true; badan: Record<string, unknown> }
  | { ok: false; status: number; badan: Record<string, unknown> };

export async function isiJalurAleta(actor: Parameters<typeof getEffectiveRoleId>[0], p: PermintaanJalurAleta): Promise<JawabanJalurAleta> {
  if (!bolehJalurAleta(actor)) throw new ApiError(403, "Jalur ALETA ABT sementara hanya untuk Super Admin.");
  const db = await getDatabase();
  const pustaka = await muatPustakaMesin(db);
  const hasil = await callAletaBotSippBridge<HasilBot>(
    "blangko.isi",
    {
      folder: p.folder,
      berkas: p.berkas,
      perkaraId: p.perkaraId,
      sidangKe: p.sidangKe,
      nilai: {},
      cadangan: {},
      tanyaJawabSaksi: {},
      segar: true,
      jalurAleta: { sidik: pustaka.sidik, pustaka: pustaka.pustaka, alias: pustaka.alias },
      ...(p.cetakFinal ? { cetakFinal: true } : {}),
    },
    { timeoutMs: BATAS_MS }
  );
  const data = hasil.data;
  if (!hasil.ok || !data?.ok) return { ok: false, status: 502, badan: { ok: false, alasan: data?.sebab ?? hasil.error ?? "Blangko tidak dapat diisi." } };
  const kosong = (data.kosong ?? []).map((k) => ({ noVar: String(k.noVar ?? ""), nama: String(k.nama ?? ""), sebab: String(k.sebab ?? ""), status: String(k.status ?? "") }));
  const dasar = {
    jalur: "aleta-abt",
    berkas: data.berkas ?? p.berkas,
    jumlahTerisi: data.jumlahTerisi ?? 0,
    kosong,
    mesinGalat: data.mesinGalat ?? "",
    lolosCetak: data.lolosCetak === true,
    ringkasanKeyakinan: data.ringkasanKeyakinan ?? {},
    isian: data.isian ?? [],
    pustakaSidik: pustaka.sidik,
    pustakaBaris: Object.keys(pustaka.pustaka).length,
  };
  // Cetak final: isian kosong TIDAK lolos. Naskah tidak dikirim; yang dikirim daftar yang masih harus diisi.
  if (p.cetakFinal && (data.ditahan === true || data.lolosCetak !== true || !data.rtfBase64)) {
    return { ok: false, status: 409, badan: { ok: false, ditahan: true, alasan: `Cetak final ditahan: ${kosong.length} isian masih kosong${data.mesinGalat ? " dan mesin ragu" : ""}.`, ...dasar } };
  }
  return { ok: true, badan: { ...dasar, rtfBase64: data.rtfBase64 ?? "" } };
}
