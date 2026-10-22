/**
 * Penjaga identitas untuk menu "E-Court" di bilah atas SIPP (22 Okt 2026).
 *
 * Menu itu hanya boleh membuka e-Court atas nama akun ALETA yang sedang masuk.
 * Komputer bersama dapat berada dalam keadaan: ALETA masuk sebagai A, SIPP
 * terbuka sebagai B. Username SIPP tidak tertulis di halaman SIPP (hanya nama
 * lengkap), jadi sesi SIPP di permintaan ini dibuktikan lewat bot - cara yang
 * sama dengan masuk-dari-sesi-SIPP (masuk-sipp-plugin.ts) - lalu username-nya
 * dicocokkan dengan periksaAkunSippTerbuka: akun SIPP yang tertaut ke pengguna
 * ALETA LAIN ditolak.
 *
 * Gagal membuktikan (tanpa cookie SIPP, bot lambat, sesi tidak terbukti) =
 * TIDAK ADA penjaga, bukan penolakan: pengguna tetap bertindak atas nama akun
 * ALETA-nya sendiri dan username SIPP tidak pernah dipakai memilih akun orang.
 * Tidak ada sandi di jalur ini.
 */

import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { nilaiCookieSesiSipp, type JawabanSesiSipp } from "@/server/modules/portal/masuk-sipp-nama";

const BATAS_TUNGGU_BOT_MS = 6_000;

type PanggilJembatan = (operasi: string, param: Record<string, unknown>, opsi: { timeoutMs?: number }) => Promise<unknown>;

/** Username SIPP dari sesi SIPP di permintaan ini; "" bila tidak terbukti atau tidak terbaca. */
export async function usernameSippDariPermintaan(
  headers: Headers,
  panggil: PanggilJembatan = callAletaBotSippBridge as PanggilJembatan
): Promise<string> {
  const cookie = nilaiCookieSesiSipp(headers.get("cookie") ?? "");
  if (cookie.length === 0) return "";
  try {
    const jawab = (await panggil(
      "user.sesiSipp",
      { cookie, userAgent: headers.get("user-agent") ?? "" },
      { timeoutMs: BATAS_TUNGGU_BOT_MS }
    )) as JawabanSesiSipp;
    if (!jawab || jawab.ok !== true || !jawab.data || jawab.data.terbukti !== true) return "";
    return String(jawab.data.username ?? "").trim();
  } catch {
    return "";
  }
}
