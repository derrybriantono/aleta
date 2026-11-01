import { type NextRequest } from "next/server";

import { KATALOG_JENIS, KELOMPOK_JUDUL, PETA_JENIS } from "@/lib/pencocok-data";
import { getDatabase } from "@/server/db/client";
import { bolehMenyuntingAkses, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaCatatanPencocok,
  bacaSetelanPencocok,
  daftarTemuan,
  jalankanPutaran,
  periksaSatuPerkara,
  sedangBerjalanPencocok,
  simpanSetelanPencocok,
} from "@/server/modules/pencocok/layanan";
import { lihatSemuaTenggat } from "@/server/modules/penjaga-tenggat/layanan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * PENCOCOK DATA SIPP - ABT - e-COURT (N3, 1 Nov 2026) - HANYA MEMBACA DAN MENANDAI
 * ============================================================================
 *
 *   GET ?perkaraId=N          temuan SATU perkara (saat perkara dibuka; cache 10 menit; ringan). Kemampuan "panel".
 *   GET ?tingkat&jenis&kelompok&cari&batas
 *                             daftar temuan tersimpan (putaran malam + pembukaan perkara). Orang yang bukan admin/
 *                             pimpinan/panitera/panmud HANYA menerima perkara yang namanya tercantum - disaring di sini.
 *   POST { aksi: "setelan", jadwal?, jam?, hariPutus? }   hanya Super Admin
 *   POST { aksi: "jalankan" }                              hanya Super Admin; berjalan di latar, tidak ditunggu
 *
 * Tidak ada rute yang menulis ke SIPP/ABT/e-Court. Perbaikan tetap lewat tombol yang sudah ada.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    const q = request.nextUrl.searchParams;

    const perkaraId = String(q.get("perkaraId") || "").trim();
    if (perkaraId) {
      const h = await periksaSatuPerkara(db, perkaraId, { tanpaCache: q.get("segar") === "1" });
      if (!h.ok) return ok({ tersedia: false, alasan: h.galat, temuan: [] });
      return ok({
        tersedia: true,
        perkaraId: h.perkaraId,
        diperiksaPada: h.diperiksaPada,
        dariCache: h.dariCache,
        temuan: h.temuan.map((t) => ({ ...t, judul: PETA_JENIS.get(t.jenis)?.judul ?? t.jenis, saran: PETA_JENIS.get(t.jenis)?.saran ?? "", sumber: PETA_JENIS.get(t.jenis)?.sumber ?? "" })),
      });
    }

    const semua = lihatSemuaTenggat(aktor);
    const kelola = bolehMenyuntingAkses(aktor);
    const { baris, ringkasan } = await daftarTemuan(db, {
      tingkat: q.get("tingkat") || undefined,
      jenis: q.get("jenis") || undefined,
      kelompok: q.get("kelompok") || undefined,
      cari: q.get("cari") || undefined,
      milikSaya: semua ? (q.get("milikSaya") === "1" ? String(aktor.name || "") : "") : String(aktor.name || ""),
      batas: Number(q.get("batas")) || 500,
    });
    const catatan = await bacaCatatanPencocok(db);
    return ok({
      tersedia: true,
      lihatSemua: semua,
      bolehKelola: kelola,
      sedangBerjalan: sedangBerjalanPencocok(),
      ringkasan,
      baris: baris.map((b) => ({ ...b, judul: PETA_JENIS.get(b.jenis)?.judul ?? b.jenis, saran: PETA_JENIS.get(b.jenis)?.saran ?? "", sumber: PETA_JENIS.get(b.jenis)?.sumber ?? "" })),
      jenis: KATALOG_JENIS.map((j) => ({ kode: j.kode, kelompok: j.kelompok, judul: j.judul, tingkat: j.tingkat, sumber: j.sumber })),
      kelompok: KELOMPOK_JUDUL,
      catatan: catatan
        ? { tanggal: catatan.tanggal, pada: catatan.pada, selesaiPada: catatan.selesaiPada, pemicu: catatan.pemicu, oleh: catatan.oleh, durasiMs: catatan.durasiMs, diperiksa: catatan.diperiksa, gagal: catatan.gagal, galat: catatan.galat, lengkap: catatan.lengkap }
        : null,
      setelan: kelola ? await bacaSetelanPencocok(db) : null,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "PENCOCOK_BACA_FAILED", feature: "aleta_ecourt", entityId: "pencocok" });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    if (!bolehMenyuntingAkses(aktor)) throw new ApiError(403, "Pengaturan Pencocok data hanya dapat diubah Super Admin.");
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const aksi = String(badan.aksi || "");
    const nama = String(aktor.name || aktor.email || aktor.id);
    if (aksi === "setelan") {
      return ok({ ok: true, setelan: await simpanSetelanPencocok(db, { id: aktor.id, name: nama }, badan) });
    }
    if (aksi === "jalankan") {
      if (sedangBerjalanPencocok()) return ok({ ok: true, dimulai: false, alasan: "Putaran sebelumnya masih berjalan." });
      // Berjalan di latar: satu putaran penuh dapat memakan puluhan detik; permintaan pengguna tidak menunggunya.
      const basis = db;
      void jalankanPutaran(basis, { pemicu: "tangan", oleh: nama }).catch((e) => console.error("[PENCOCOK] putaran tangan gagal:", e));
      return ok({ ok: true, dimulai: true });
    }
    throw new ApiError(400, "Aksi tidak dikenal.");
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "PENCOCOK_UBAH_FAILED", feature: "aleta_ecourt", entityId: "pencocok" });
  }
}
