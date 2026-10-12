/**
 * ============================================================================
 * PENGATURAN & HISTORI PENARIKAN TANGGAL KTP PIHAK (12 Okt 2026, butir 11)
 * ============================================================================
 *
 * Layar Pengaturan > Integrasi e-Court (Admin/Super Admin):
 *
 *   PENGATURAN  nyala/mati penyapu latar, berkas per putaran, jeda. Disimpan di
 *               aleta_ekstensi_setelan (tanpa migrasi), pengguna_id PENGGUNA_SISTEM.
 *               Menang atas env ALETA_KTP_PIHAK_LATAR/BATAS/JEDA_MS dan berlaku
 *               tanpa restart: penyapu (ktp-pihak.ts) membacanya tiap 30 detik.
 *               Tiap perubahan masuk jejak audit (siapa, kapan, nilai).
 *   HISTORI     per nomor perkara: berkas KTP yang sudah ditarik, kapan dibaca,
 *               hasil per pihak, sebab gagal, percobaan ke-n, pemicu. Dibaca dari
 *               bot (aleta_bot_ktp_pihak + aleta_bot_ktp_pihak_riwayat). NIK tidak
 *               pernah dikirim.
 *   BACA ULANG  satu perkara, tanpa membuang tanggal yang sudah ada.
 *
 * TIDAK ADA YANG DITULIS KE SIPP/ABT/e-COURT.
 */
import {
  BATAS_PER_PUTARAN,
  JEDA_DETIK,
  bersihkanPengaturanKtp,
  pengaturanKtpEfektif,
  type PengaturanKtpTersimpan,
} from "@/lib/ktp-pihak-pengaturan";
import type { PerkaraKtpRingkas, RingkasanKtpPihak, RiwayatPerkaraKtp } from "@/lib/ktp-pihak-tampil";
import { getDatabase, type AletaDatabase, withTransaction } from "@/server/db/client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import { depsKtpAsli, keadaanPenyapuKtp, putaranKtpPihak, type DepsKtp } from "@/server/modules/aleta-ecourt/ktp-pihak";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

export const KUNCI_KTP_PENGATURAN = "sistem:ktp-pihak-latar";
/** Bukan id pengguna sungguhan; pola yang sama dengan PENGGUNA_SEMUA pada bawaan tampilan jadwal. */
export const PENGGUNA_SISTEM = "*sistem*";

// ---------------------------------------------------------------------------
// Penyimpanan pengaturan
// ---------------------------------------------------------------------------

export async function bacaPengaturanKtpTersimpan(db: AletaDatabase): Promise<PengaturanKtpTersimpan | null> {
  const baris = await db
    .prepare("SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?")
    .all<{ nilai: string }>(PENGGUNA_SISTEM, KUNCI_KTP_PENGATURAN);
  if (!baris[0]) return null;
  try {
    return bersihkanPengaturanKtp(JSON.parse(baris[0].nilai));
  } catch {
    return null;
  }
}

/** Sumber bagi penyapu latar: dibaca tiap detak, jadi perubahan layar berlaku tanpa restart. */
export async function sumberPengaturanKtp(): Promise<PengaturanKtpTersimpan | null> {
  return bacaPengaturanKtpTersimpan(await getDatabase());
}

/**
 * Simpan pengaturan (masukan berisi) atau kembali ke bawaan server (masukan null).
 * Hanya Super Admin dan Admin.
 */
export async function simpanPengaturanKtp(db: AletaDatabase, actorUserId: string | null | undefined, masukan: unknown | null) {
  const actor = await pastikanAdminIstimewa(db, actorUserId, "mengatur penarikan tanggal KTP");
  const sekarang = new Date().toISOString();
  let isi: PengaturanKtpTersimpan | null = null;
  if (masukan !== null) {
    const x = masukan && typeof masukan === "object" ? (masukan as Record<string, unknown>) : {};
    if (typeof x.aktif !== "boolean") throw new ApiError(400, "Nyala/mati penyapu harus dipilih.");
    const batas = Number(x.batas);
    const jeda = Number(x.jedaDetik);
    if (!Number.isFinite(batas) || batas < BATAS_PER_PUTARAN.min || batas > BATAS_PER_PUTARAN.maks) {
      throw new ApiError(400, `Berkas per putaran harus ${BATAS_PER_PUTARAN.min}-${BATAS_PER_PUTARAN.maks}.`);
    }
    if (!Number.isFinite(jeda) || jeda < JEDA_DETIK.min || jeda > JEDA_DETIK.maks) {
      throw new ApiError(400, `Jeda harus ${JEDA_DETIK.min}-${JEDA_DETIK.maks} detik.`);
    }
    isi = bersihkanPengaturanKtp({ aktif: x.aktif, batas, jedaDetik: jeda, diubahOleh: actor.name ?? actor.id, diubahPada: sekarang });
    if (!isi) throw new ApiError(400, "Pengaturan tidak sah.");
  }

  await withTransaction(db, async (tx) => {
    if (!isi) {
      await tx.prepare("DELETE FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?").run(PENGGUNA_SISTEM, KUNCI_KTP_PENGATURAN);
    } else {
      await tx
        .prepare(
          "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) " +
            "ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada"
        )
        .run(PENGGUNA_SISTEM, KUNCI_KTP_PENGATURAN, JSON.stringify(isi), sekarang);
    }
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: isi ? "UPDATE_KTP_PIHAK_LATAR" : "RESET_KTP_PIHAK_LATAR",
      entityType: "aleta_ekstensi_setelan",
      entityId: `${PENGGUNA_SISTEM}:${KUNCI_KTP_PENGATURAN}`,
      payload: isi ? { aktif: isi.aktif, batas: isi.batas, jedaDetik: isi.jedaDetik } : { kembaliKeBawaanServer: true },
      createdAt: sekarang,
    });
  });
}

// ---------------------------------------------------------------------------
// Bot
// ---------------------------------------------------------------------------

export type HasilBotKtp<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

function alamatBot() {
  return (process.env.ALETA_BOT_BASE_URL || process.env.ALETA_BOT_RUNTIME_URL || "http://127.0.0.1:3003").replace(/\/$/, "");
}

function tokenBot() {
  return process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || "";
}

/** Panggilan ke /internal/aleta-bot/sipp/ktp-pihak<jalur>. Berkas sendiri supaya uji dapat mengganti fetch. */
export async function panggilBotKtp<T = Record<string, unknown>>(
  jalur: string,
  pilihan: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {}
): Promise<HasilBotKtp<T>> {
  const pengendali = new AbortController();
  const penunda = setTimeout(() => pengendali.abort(), pilihan.timeoutMs ?? 20_000);
  try {
    const kepala: Record<string, string> = { "Content-Type": "application/json" };
    const token = tokenBot();
    if (token) kepala["x-aleta-internal-token"] = token;
    const jawaban = await fetch(`${alamatBot()}/internal/aleta-bot/sipp/ktp-pihak${jalur}`, {
      method: pilihan.method ?? "GET",
      headers: kepala,
      body: pilihan.body === undefined ? undefined : JSON.stringify(pilihan.body),
      signal: pengendali.signal,
      cache: "no-store",
    });
    const mentah = await jawaban.text();
    let isi: Record<string, unknown>;
    try {
      isi = JSON.parse(mentah) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        status: jawaban.status,
        error:
          jawaban.status === 404
            ? "ALETA Bot belum punya rute histori KTP - bot perlu dibangun ulang."
            : `ALETA Bot menjawab bukan JSON (HTTP ${jawaban.status}).`,
      };
    }
    if (!jawaban.ok || isi.ok === false) {
      return { ok: false, status: jawaban.status, error: String(isi.error ?? isi.alasan ?? `HTTP ${jawaban.status}`) };
    }
    return { ok: true, data: isi as T };
  } catch (galat) {
    return {
      ok: false,
      error:
        galat instanceof Error && (galat.name === "AbortError" || galat.name === "TimeoutError")
          ? "ALETA Bot tidak menjawab tepat waktu."
          : "ALETA Bot tidak dapat dihubungi.",
    };
  } finally {
    clearTimeout(penunda);
  }
}

// ---------------------------------------------------------------------------
// Jawaban rute
// ---------------------------------------------------------------------------

/** Halaman: pengaturan tersimpan, yang berlaku, bawaan server, keadaan penyapu, dan angka besar. */
export async function bacaHalamanKtp(db: AletaDatabase, actorUserId: string | null | undefined, env: NodeJS.ProcessEnv = process.env) {
  await pastikanAdminIstimewa(db, actorUserId, "melihat penarikan tanggal KTP");
  const tersimpan = await bacaPengaturanKtpTersimpan(db);
  const ringkasan = await panggilBotKtp<{ ringkasan: RingkasanKtpPihak }>("/riwayat/ringkasan");
  return {
    available: true,
    tersimpan,
    efektif: pengaturanKtpEfektif(env, tersimpan),
    bawaanServer: pengaturanKtpEfektif(env, null),
    batas: { perPutaran: BATAS_PER_PUTARAN, jedaDetik: JEDA_DETIK },
    penyapu: keadaanPenyapuKtp(),
    ringkasan: ringkasan.ok ? ringkasan.data.ringkasan : null,
    pesanRingkasan: ringkasan.ok ? "" : ringkasan.error,
  };
}

export async function cariRiwayatKtp(db: AletaDatabase, actorUserId: string | null | undefined, cari: string, mulai: number) {
  await pastikanAdminIstimewa(db, actorUserId, "melihat histori penarikan tanggal KTP");
  const h = await panggilBotKtp<{ perkara: PerkaraKtpRingkas[]; adaLagi: boolean }>(
    `/riwayat?${new URLSearchParams({ cari: cari.slice(0, 80), batas: "30", mulai: String(Math.max(0, mulai)) }).toString()}`
  );
  if (!h.ok) return { available: false, message: h.error, perkara: [] as PerkaraKtpRingkas[], adaLagi: false };
  return { available: true, message: "", perkara: h.data.perkara ?? [], adaLagi: Boolean(h.data.adaLagi) };
}

export async function rincianRiwayatKtp(db: AletaDatabase, actorUserId: string | null | undefined, nomor: string) {
  await pastikanAdminIstimewa(db, actorUserId, "melihat histori penarikan tanggal KTP");
  const nomorBersih = nomor.trim().slice(0, 191);
  if (!nomorBersih) throw new ApiError(400, "Nomor perkara wajib diisi.");
  const h = await panggilBotKtp<RiwayatPerkaraKtp>(`/riwayat/perkara?${new URLSearchParams({ nomor: nomorBersih }).toString()}`);
  if (!h.ok) return { available: false, message: h.error, riwayat: null };
  return { available: true, message: "", riwayat: h.data };
}

/**
 * Baca ulang berkas KTP satu perkara sekarang: bot menandai bacaan lama usang (tanggal tetap
 * dipertahankan sampai bacaan baru berhasil), lalu portal membacanya (paling lama 90 detik).
 * Bila putaran lain sedang berjalan, penandaan tetap berlaku dan penyapu yang membacanya.
 */
export async function bacaUlangKtpPerkara(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  nomor: string,
  deps: DepsKtp = depsKtpAsli
) {
  const actor = await pastikanAdminIstimewa(db, actorUserId, "membaca ulang KTP satu perkara");
  const nomorBersih = nomor.trim().slice(0, 191);
  if (!nomorBersih) throw new ApiError(400, "Nomor perkara wajib diisi.");
  const tanda = await panggilBotKtp<{ ditandai: number }>("/baca-ulang", { method: "POST", body: { nomor: nomorBersih }, timeoutMs: 20_000 });
  if (!tanda.ok) return { available: false, message: tanda.error, dibaca: 0, terbaca: 0, sedangSibuk: false };

  const hasil = await putaranKtpPihak([nomorBersih], deps, { batas: 5, batasMs: 90_000, batasBacaMs: 60_000, pemicu: "manual" });
  const sekarang = new Date().toISOString();
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "REBACA_KTP_PIHAK",
    entityType: "perkara",
    entityId: nomorBersih,
    // Nomor perkara dan hitungan saja - tidak ada NIK/nama.
    payload: { nomorPerkara: nomorBersih, ditandai: tanda.data.ditandai ?? 0, dibaca: hasil?.dibaca ?? 0, terbaca: hasil?.terbaca ?? 0 },
    createdAt: sekarang,
  }).catch(() => undefined);
  return {
    available: true,
    message: "",
    ditandai: tanda.data.ditandai ?? 0,
    dibaca: hasil?.dibaca ?? 0,
    terbaca: hasil?.terbaca ?? 0,
    // null = putaran lain sedang berjalan di proses ini; penyapu berikutnya yang membaca.
    sedangSibuk: hasil === null,
    antrianTerjangkau: hasil ? hasil.antrianTerjangkau : true,
  };
}
