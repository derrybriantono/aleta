import type { NextRequest } from "next/server";

import { bacaPengaturan, cocokkanTokenLaptop, tulisPengaturan, type TokenLaptop } from "@/server/modules/sinkron/pengaturan";

/**
 * Penjaga rute tarik-laptop: token pembawa dari layar Sinkron & cadangan.
 *
 * Server tidak dapat mendorong ke laptop (laptop di balik NAT dan sering
 * mati), jadi laptop yang MENARIK. Tokennya dapat dicabut kapan saja dari
 * layar; yang tersimpan hanya sidik SHA-256-nya. Percobaan gagal dibatasi per
 * alamat supaya token tidak dapat ditebak beruntun.
 */

const GAGAL = new Map<string, { jumlah: number; sejak: number }>();
const JENDELA_MS = 10 * 60_000;
const BATAS_GAGAL = 20;

function alamat(request: NextRequest) {
  return (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "setempat";
}

export type HasilTokenLaptop = { ok: true; token: TokenLaptop } | { ok: false; status: number; pesan: string };

export async function periksaTokenLaptop(request: NextRequest): Promise<HasilTokenLaptop> {
  const ip = alamat(request);
  const g = GAGAL.get(ip);
  if (g && Date.now() - g.sejak < JENDELA_MS && g.jumlah >= BATAS_GAGAL) {
    return { ok: false, status: 429, pesan: "Terlalu banyak percobaan token yang salah. Coba lagi 10 menit lagi." };
  }
  const kepala = request.headers.get("authorization") || "";
  const token = /^Bearer\s+(\S+)$/i.exec(kepala)?.[1] ?? "";
  const p = await bacaPengaturan();
  if (!p.laptop.aktif) return { ok: false, status: 403, pesan: "Sinkron ke laptop belum diaktifkan di layar Sinkron & cadangan." };
  const cocok = cocokkanTokenLaptop(p, token);
  if (!cocok) {
    const lama = g && Date.now() - g.sejak < JENDELA_MS ? g : { jumlah: 0, sejak: Date.now() };
    GAGAL.set(ip, { jumlah: lama.jumlah + 1, sejak: lama.sejak });
    return { ok: false, status: 401, pesan: "Token laptop tidak sah atau sudah dicabut." };
  }
  GAGAL.delete(ip);
  // "Terakhir dipakai" ditulis paling sering sejam sekali - cukup untuk
  // mengenali laptop yang sudah lama tidak menarik, tanpa menulis tiap unduhan.
  if (!cocok.terakhirDipakai || Date.now() - Date.parse(cocok.terakhirDipakai) > 3_600_000) {
    const terbaru = await bacaPengaturan();
    const t = terbaru.laptop.token.find((x) => x.id === cocok.id);
    if (t) {
      t.terakhirDipakai = new Date().toISOString();
      await tulisPengaturan(terbaru).catch(() => undefined);
    }
  }
  return { ok: true, token: cocok };
}

export function tolakLaptop(h: { status: number; pesan: string }) {
  return Response.json({ ok: false, error: { message: h.pesan } }, { status: h.status, headers: { "Cache-Control": "no-store" } });
}
