/**
 * Penetapan kembali dari Jadwal Sidang (6 Okt 2026) - sisi peladen portal.
 *
 *   - panggilBotPenetapanKembali: rute bot /internal/aleta-bot/penetapan-kembali
 *     (penetapanKembaliRoutes.js). Berkas sendiri, sepola jadwal-sidang-gateway:
 *     whatsapp-gateway-client.ts sudah ribuan baris dan disunting banyak tangan.
 *   - calonPenetapKembali: siapa yang dapat DIPILIH sebagai penetap PMH
 *     (Ketua / Wakil / Plh Ketua) dan PPP-PJS (Panitera / Plh Panitera) pada
 *     tanggal penetapan - aturan yang SAMA dengan rencana penetapan awal
 *     (akunPimpinan, akunPanitera, calonPenetap), bukan aturan kedua.
 *
 * Penetap hanya ke jejak ALETA; yang tercatat di SIPP adalah akun SIPP milik
 * petugas yang menekan tombolnya (akunSippPengguna).
 */

import { type AletaDatabase } from "@/server/db/client";
import { pejabatBertugas, yangSedangCuti } from "@/server/modules/aleta-ecourt/pejabat-bertugas";
import { bacaPemetaanJabatan } from "@/server/modules/aleta-ecourt/pemetaan-jabatan";
import {
  type CalonPenetap,
  JABATAN_KETUA,
  JABATAN_PANITERA,
  akunPanitera,
  akunPimpinan,
  calonPenetap,
} from "@/server/modules/aleta-ecourt/rencana-penetapan";

export type HasilBotKembali<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

import { cerminSetelahTulisan } from "@/server/modules/cermin/setelah-tulisan";
import { tandaiTulisan } from "@/server/shared/singgah-singkat";

function alamatBot() {
  return (process.env.ALETA_BOT_BASE_URL || process.env.ALETA_BOT_RUNTIME_URL || "http://127.0.0.1:3003").replace(/\/$/, "");
}

function tokenBot() {
  return process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || "";
}

export async function panggilBotPenetapanKembali<T = Record<string, unknown>>(
  jalur: "/keadaan" | "/tulis",
  badan: unknown,
  timeoutMs = 15_000
): Promise<HasilBotKembali<T>> {
  const pengendali = new AbortController();
  const penunda = setTimeout(() => pengendali.abort(), timeoutMs);
  // Performa muat 19 Okt: tulisan penetapan membuang singgahan jadwal.
  const menulis = jalur === "/tulis";
  if (menulis) tandaiTulisan();
  try {
    const kepala: Record<string, string> = { "Content-Type": "application/json" };
    const token = tokenBot();
    if (token) kepala["x-aleta-internal-token"] = token;
    const jawaban = await fetch(`${alamatBot()}/internal/aleta-bot/penetapan-kembali${jalur}`, {
      method: "POST",
      headers: kepala,
      body: JSON.stringify(badan ?? {}),
      signal: pengendali.signal,
      cache: "no-store",
    });
    const teks = await jawaban.text();
    let isi: Record<string, unknown>;
    try {
      isi = JSON.parse(teks) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        status: jawaban.status,
        error:
          jawaban.status === 404
            ? "ALETA Bot belum punya rute Penetapan kembali - bot perlu dibangun ulang."
            : `ALETA Bot menjawab bukan JSON (HTTP ${jawaban.status}).`,
      };
    }
    // 400/409 berbentuk JSON = penolakan bot beserta alasannya: itu DATA.
    if (!jawaban.ok && jawaban.status !== 400 && jawaban.status !== 409) {
      return { ok: false, status: jawaban.status, error: String(isi.error || isi.alasan || `HTTP ${jawaban.status}`) };
    }
    return { ok: true, data: isi as T };
  } catch (galat) {
    return {
      ok: false,
      error:
        galat instanceof Error && galat.name === "AbortError"
          ? "ALETA Bot tidak menjawab dalam batas waktu."
          : galat instanceof Error
            ? galat.message
            : "ALETA Bot belum dapat dihubungi.",
    };
  } finally {
    clearTimeout(penunda);
    if (menulis) {
      tandaiTulisan();
      // A3: tulisan masuk cermin seketika (lihat cermin/setelah-tulisan.ts).
      cerminSetelahTulisan(undefined, badan);
    }
  }
}

export type CalonPenetapKembali = {
  pmh: CalonPenetap[];
  /** PPP dan PJS berbagi daftar: keduanya ditetapkan Panitera / Plh Panitera. */
  panitera: CalonPenetap[];
  catatan: string[];
};

/**
 * Calon penetap pada satu tanggal. Pilihan OTOMATIS di urutan pertama
 * (Ketua bila hadir, lalu Wakil, lalu Plh; Panitera, lalu Plh Panitera).
 * Pemegang Plh yang di SIPP bukan grup pimpinan/kepaniteraan tetap ikut,
 * sebab calonPenetap hanya menyisir grup jabatannya.
 */
export async function calonPenetapKembali(db: AletaDatabase, tanggal: string): Promise<CalonPenetapKembali> {
  const pemetaan = await bacaPemetaanJabatan(db);
  if (!pemetaan.ok) {
    return {
      pmh: [],
      panitera: [],
      catatan: [`Pemetaan jabatan SIPP tidak terbaca (${pemetaan.galat}) - ketik nama penetap secara manual.`],
    };
  }
  const hari = /^\d{4}-\d{2}-\d{2}$/.test(tanggal) ? tanggal : new Date().toISOString().slice(0, 10);
  const [plhKetua, plhPanitera, sedangCuti] = await Promise.all([
    pejabatBertugas(db, JABATAN_KETUA, hari),
    pejabatBertugas(db, JABATAN_PANITERA, hari),
    yangSedangCuti(db, hari),
  ]);
  const pimpinan = akunPimpinan(pemetaan.akun, { penunjukan: plhKetua, sedangCuti });
  const panitera = akunPanitera(pemetaan.akun, { penunjukan: plhPanitera, sedangCuti });

  const lengkapi = (daftar: CalonPenetap[], terpilih: typeof pimpinan): CalonPenetap[] => {
    const a = terpilih.akun;
    if (!a || daftar.some((x) => x.username === a.username)) return daftar;
    return [
      { username: a.username, namaLengkap: a.namaLengkap, sebutan: terpilih.sebutan, siap: a.siap, sebab: a.sebabBelumSiap, otomatis: true },
      ...daftar.map((x) => ({ ...x, otomatis: false })),
    ];
  };

  return {
    pmh: lengkapi(calonPenetap(pemetaan.akun, "pimpinan", pimpinan.akun, pimpinan.sebutan), pimpinan),
    panitera: lengkapi(calonPenetap(pemetaan.akun, "panitera", panitera.akun, panitera.sebutan), panitera),
    catatan: [...pimpinan.catatan, ...panitera.catatan],
  };
}
