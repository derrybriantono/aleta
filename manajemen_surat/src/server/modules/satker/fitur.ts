import { KODE_FITUR_BERKAS_ECOURT } from "@/lib/berkas-ecourt-fitur";
import {
  BAWAAN_DULU_MATI,
  GalatFiturSatker,
  KATALOG_FITUR_SATKER,
  PESAN_FITUR_MATI,
  bersihkanPengaturanFitur,
  keadaanFitur,
  petaKeadaanFitur,
  pilihanDariJejak,
  ringkasUntukKlien,
  susunPengaturanFitur,
  type KeadaanFitur,
  type KonteksFitur,
  type PengaturanFiturSatker,
  type RingkasanFiturKlien,
} from "@/lib/fitur-satker";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { bacaIzinPusat, bacaKanal, bacaPusatTerakhir, bacaSaluranEfektif } from "@/server/modules/satker/kanal";
import { bacaSetelanSistem, tulisSetelanSistem } from "@/server/modules/satker/setelan";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * SAKLAR FITUR PER SATKER - PENYIMPANAN DAN PEMBACAAN (banyak satker, Tahap 0)
 * ============================================================================
 *
 * Aturan (status, saluran, plafon Pusat) ada di lib/fitur-satker.ts; di sini
 * hanya baca/simpan/audit. Disimpan di aleta_ekstensi_setelan (pengguna sistem,
 * kunci sistem:fitur-satker) - pola Putusan Advance per akun, tanpa migrasi.
 *
 * Pembaca GAGAL KE SISI MENYALA: basis data tidak terbaca, setelan rusak, atau
 * belum pernah disimpan = semua fitur menyala seperti sebelum saklar ini ada.
 * Yang menolak hanya status "mati" yang BENAR-BENAR tersimpan (atau plafon
 * Pusat yang benar-benar diterima).
 *
 * Pembaca: portal (pastikanFiturMenyala di rute), ekstensi (ruas fiturSatker
 * pada rute "siapa"), bot (didorong portal saat disimpan -
 * dorongFiturKeBot, lalu dibaca aleta_bot/services/fiturSatkerService.js).
 */

export const KUNCI_FITUR_SATKER = "sistem:fitur-satker";

export async function bacaPengaturanFitur(db: AletaDatabase): Promise<PengaturanFiturSatker | null> {
  const p = bersihkanPengaturanFitur(await bacaSetelanSistem(db, KUNCI_FITUR_SATKER));
  return terapkanMatiSengajaLama(db, p);
}

/**
 * Bawaan yang berubah dari mati ke menyala (BAWAAN_DULU_MATI): pilihan "mati" pada masa bawaan lama tidak tersimpan di setelan, jadi dibaca
 * dari jejak audit UPDATE_FITUR_SATKER terakhir yang menyebut kode itu. Berakhir "mati" = sengaja dimatikan -> tetap mati; tidak ada jejak =
 * belum pernah diatur -> bawaan baru (menyala). Begitu disimpan lagi lewat Fitur Satker, pilihan "mati" tersimpan terang (berbeda dari bawaan baru).
 * Jejak dibaca sekali lalu diingat sampai pengaturan disimpan lagi; gagal membaca jejak = tidak ada jejak.
 */
const jejakLama = new WeakMap<AletaDatabase, Map<string, string | null>>();
async function terapkanMatiSengajaLama(db: AletaDatabase, p: PengaturanFiturSatker | null): Promise<PengaturanFiturSatker | null> {
  let hasil = p;
  let ingat = jejakLama.get(db);
  if (!ingat) {
    ingat = new Map();
    jejakLama.set(db, ingat);
  }
  for (const kode of BAWAAN_DULU_MATI) {
    if (hasil?.fitur[kode]) continue;
    if (!ingat.has(kode)) {
      let terakhir: string | null = null;
      try {
        const baris = await db
          .prepare("SELECT payload_json FROM audit_logs WHERE action = ? AND payload_json LIKE ? ORDER BY created_at DESC, id DESC LIMIT 1")
          .get<{ payload_json: string }>("UPDATE_FITUR_SATKER", `%${kode}%`);
        terakhir = baris ? pilihanDariJejak(baris.payload_json, kode) : null;
      } catch {
        terakhir = null;
      }
      ingat.set(kode, terakhir);
    }
    if (ingat.get(kode) === "mati") hasil = { fitur: { ...(hasil?.fitur ?? {}), [kode]: "mati" }, diubahOleh: hasil?.diubahOleh ?? "", diubahPada: hasil?.diubahPada ?? "" };
  }
  return hasil;
}

/** Konteks lengkap (pengaturan + saluran efektif + plafon Pusat). Tiap bagian gagal ke bawaan. */
export async function bacaKonteksFitur(db: AletaDatabase): Promise<KonteksFitur> {
  const [pengaturan, saluran, izinPusat] = await Promise.all([
    bacaPengaturanFitur(db).catch(() => null),
    bacaSaluranEfektif(db).catch(() => "stabil" as const),
    bacaIzinPusat(db).catch(() => null),
  ]);
  return { pengaturan, saluran, izinPusat };
}

export async function bacaKeadaanFitur(db: AletaDatabase, kode: string): Promise<KeadaanFitur> {
  try {
    return keadaanFitur(kode, await bacaKonteksFitur(db));
  } catch {
    return keadaanFitur(kode, {});
  }
}

export async function fiturMenyala(db: AletaDatabase, kode: string): Promise<boolean> {
  return (await bacaKeadaanFitur(db, kode)).menyala;
}

/** Dipanggil rute sebelum bekerja: melempar 403 berkalimat awam bila fitur dimatikan di satker ini. */
export async function pastikanFiturMenyala(db: AletaDatabase, kode: string): Promise<void> {
  const k = await bacaKeadaanFitur(db, kode);
  if (!k.menyala) throw new ApiError(403, k.sebab ? `${PESAN_FITUR_MATI} (${k.sebab})` : PESAN_FITUR_MATI);
}

/** Ringkasan kode -> status untuk ekstensi dan bot. */
export async function bacaRingkasanFiturKlien(db: AletaDatabase): Promise<RingkasanFiturKlien> {
  try {
    return ringkasUntukKlien(await bacaKonteksFitur(db));
  } catch {
    return ringkasUntukKlien({});
  }
}

export async function bacaLayarFitur(db: AletaDatabase) {
  const konteks = await bacaKontekSafe(db);
  const peta = petaKeadaanFitur(konteks);
  const kanal = await bacaKanal(db).catch(() => null);
  const terakhir = await bacaPusatTerakhir(db).catch(() => null);
  return {
    saluran: konteks.saluran ?? "stabil",
    saluranDipilih: kanal?.saluran ?? "stabil",
    saluranDipaksaPusat: terakhir?.saluranDipaksa ?? null,
    tersimpan: Boolean(konteks.pengaturan),
    diubahOleh: konteks.pengaturan?.diubahOleh ?? "",
    diubahPada: konteks.pengaturan?.diubahPada ?? "",
    terhubungPusat: Boolean(konteks.izinPusat),
    fitur: KATALOG_FITUR_SATKER.map((f) => ({ ...f, ...peta[f.kode] })),
  };
}

async function bacaKontekSafe(db: AletaDatabase): Promise<KonteksFitur> {
  try {
    return await bacaKonteksFitur(db);
  } catch {
    return {};
  }
}

/**
 * Simpan status fitur (Super Admin - dijaga rute). badan: {fitur: {kode: status}} -
 * seluruh peta pilihan; butir yang sama dengan bawaan tidak disimpan. Tercatat di
 * jejak audit beserta daftar yang berubah.
 */
export async function simpanPengaturanFitur(db: AletaDatabase, aktor: { id: string; name?: string | null }, badan: Record<string, unknown>) {
  const kanal = await bacaKanal(db).catch(() => null);
  const saluran = (await bacaSaluranEfektif(db).catch(() => kanal?.saluran ?? "stabil")) as "stabil" | "uji-coba";
  let baruFitur: Record<string, "stabil" | "uji-coba" | "mati">;
  try {
    baruFitur = susunPengaturanFitur(badan.fitur, saluran);
  } catch (e) {
    if (e instanceof GalatFiturSatker) throw new ApiError(400, e.message);
    throw e;
  }
  const lama = (await bacaPengaturanFitur(db))?.fitur ?? {};
  const sekarang = new Date().toISOString();
  const isi: PengaturanFiturSatker = { fitur: baruFitur, diubahOleh: aktor.name || aktor.id, diubahPada: sekarang };

  const berubah: Array<{ kode: string; dari: string; ke: string }> = [];
  for (const f of KATALOG_FITUR_SATKER) {
    const dari = lama[f.kode] ?? f.bawaan;
    const ke = baruFitur[f.kode] ?? f.bawaan;
    if (dari !== ke) berubah.push({ kode: f.kode, dari, ke });
  }

  await withTransaction(db, async (tx) => {
    await tulisSetelanSistem(tx, KUNCI_FITUR_SATKER, isi, sekarang);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.id,
      action: "UPDATE_FITUR_SATKER",
      entityType: "aleta_ekstensi_setelan",
      entityId: `*sistem*:${KUNCI_FITUR_SATKER}`,
      payload: { berubah },
      createdAt: sekarang,
    });
  });
  jejakLama.delete(db);
  const bot = await dorongFiturKeBot(db);
  // D1 (25 Okt 2026): saklar Ketepatan isian berubah -> bot menerima keputusan gerbang yang berlaku (atau melepasnya bila mati).
  if (berubah.some((x) => x.kode === "ketepatan-isian")) {
    try {
      const { dorongGerbangKeBot } = await import("@/server/modules/aleta-ecourt/ketepatan-isian");
      await dorongGerbangKeBot(db);
    } catch {
      /* bot belum menerima: ia memakai berkas gerbang bawaan */
    }
  }
  // G2 (26 Okt 2026): saklar isi otomatis dari berkas e-Court berubah -> singgahan hasil bacaan dibuang agar langsung berlaku.
  if (berubah.some((x) => KODE_FITUR_BERKAS_ECOURT.includes(x.kode))) {
    try {
      const { buangSinggahanIsiGugatan } = await import("@/server/modules/aleta-ecourt/isi-gugatan-singgah");
      buangSinggahanIsiGugatan();
    } catch {
      /* singgahan kedaluwarsa sendiri */
    }
  }
  return { ok: true, berubah: berubah.length, bot, ...(await bacaLayarFitur(db)) };
}

/**
 * Mendorong ringkasan fitur ke bot (POST /internal/aleta-bot/fitur-satker/sinkron).
 * Dicoba SEKALI; bot yang mati/lama tidak menggagalkan penyimpanan - hasilnya
 * disebut di layar ("bot belum menerima"), dan bot tanpa data memakai bawaan
 * menyala. Dipanggil juga saat portal ingin menyegarkan bot.
 */
export async function dorongFiturKeBot(db: AletaDatabase): Promise<{ terkirim: boolean; pesan: string }> {
  try {
    const ringkasan = await bacaRingkasanFiturKlien(db);
    const alamat = (process.env.ALETA_BOT_BASE_URL || process.env.ALETA_BOT_RUNTIME_URL || "http://127.0.0.1:3003").replace(/\/$/, "");
    const token = process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || "";
    const pengendali = new AbortController();
    const penunda = setTimeout(() => pengendali.abort(), 5000);
    try {
      const jawab = await fetch(`${alamat}/internal/aleta-bot/fitur-satker/sinkron`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { "x-aleta-internal-token": token } : {}) },
        body: JSON.stringify(ringkasan),
        signal: pengendali.signal,
        cache: "no-store",
      });
      return jawab.ok ? { terkirim: true, pesan: "Bot sudah menerima." } : { terkirim: false, pesan: `Bot belum menerima (HTTP ${jawab.status}) - bot perlu diperbarui.` };
    } finally {
      clearTimeout(penunda);
    }
  } catch {
    return { terkirim: false, pesan: "Bot belum dapat dihubungi - bot memakai pengaturan terakhirnya (bawaan: semua menyala)." };
  }
}
