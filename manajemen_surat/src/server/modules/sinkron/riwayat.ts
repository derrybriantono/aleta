import { randomBytes } from "node:crypto";

import { bacaJson, jalurSinkron, tulisJson } from "@/server/modules/sinkron/penyimpanan";

/**
 * Riwayat dan keadaan sinkron - kapan, apa, berapa besar, berhasil/gagal dan
 * sebabnya. Disimpan 300 baris terakhir.
 *
 * Sebab kegagalan disaring dari apa pun yang berbentuk rahasia sebelum
 * ditulis: pesan error dari Google atau fetch dapat memuat token pada URL
 * atau badan jawabannya, dan riwayat ini dibaca Admin di layar.
 */

export type JenisTugas = "cadangan" | "drive-cadangan" | "drive-berkas";

export const SEBUTAN_TUGAS: Record<JenisTugas, string> = {
  cadangan: "Cadangan basis data (server)",
  "drive-cadangan": "Cadangan basis data ke Google Drive",
  "drive-berkas": "Berkas seluruh perkara ke Google Drive",
};

export type BarisRiwayat = {
  id: string;
  tugas: JenisTugas;
  pemicu: "jadwal" | "manual";
  oleh: string;
  mulai: string;
  selesai: string;
  berhasil: boolean;
  byte: number;
  ringkasan: string;
  sebab: string;
  rincian: string[];
};

export type KeadaanSinkron = {
  berjalan: { tugas: JenisTugas; mulai: string; oleh: string; kemajuan: string } | null;
  terakhir: Partial<Record<JenisTugas, { mulai: string; selesai: string; berhasil: boolean }>>;
};

const BATAS_RIWAYAT = 300;

/** Menyamarkan apa pun yang tampak seperti rahasia dalam satu kalimat. */
export function saringRahasia(pesan: unknown): string {
  return String(pesan instanceof Error ? pesan.message : pesan ?? "")
    .replace(/(access_token|refresh_token|client_secret|device_code|assertion|private_key|token|password|sandi)(["'\s:=]+)[^\s"'&,}]+/gi, "$1$2[disamarkan]")
    .replace(/Bearer\s+[A-Za-z0-9._\-~+/=]+/gi, "Bearer [disamarkan]")
    .replace(/ya29\.[A-Za-z0-9._\-]+/g, "[disamarkan]")
    .replace(/1\/\/[A-Za-z0-9._\-]{20,}/g, "[disamarkan]")
    .replace(/aletasnk_[A-Za-z0-9_\-]+/g, "aletasnk_[disamarkan]")
    .replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, "[kunci disamarkan]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

export async function bacaRiwayat(): Promise<BarisRiwayat[]> {
  const isi = await bacaJson<BarisRiwayat[]>(jalurSinkron.riwayat(), []);
  return Array.isArray(isi) ? isi : [];
}

export async function catatRiwayat(baris: Omit<BarisRiwayat, "id">) {
  const semua = await bacaRiwayat();
  const bersih: BarisRiwayat = {
    ...baris,
    id: `snk-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`,
    sebab: saringRahasia(baris.sebab),
    ringkasan: saringRahasia(baris.ringkasan),
    rincian: baris.rincian.slice(0, 50).map(saringRahasia),
  };
  await tulisJson(jalurSinkron.riwayat(), [bersih, ...semua].slice(0, BATAS_RIWAYAT));
  return bersih;
}

export async function bacaKeadaan(): Promise<KeadaanSinkron> {
  const k = await bacaJson<KeadaanSinkron>(jalurSinkron.keadaan(), { berjalan: null, terakhir: {} });
  return { berjalan: k?.berjalan ?? null, terakhir: k?.terakhir ?? {} };
}

export async function tulisKeadaan(k: KeadaanSinkron) {
  await tulisJson(jalurSinkron.keadaan(), k);
}
