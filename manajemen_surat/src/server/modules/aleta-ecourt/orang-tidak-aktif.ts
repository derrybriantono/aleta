/**
 * Orang yang tidak ditawarkan di pemilih "Lihat sebagai" Blangko Derry (20 Okt 2026): akun ALETA
 * nonaktif/terhapus (mutasi, pensiun) dan hakim/panitera/juru sita yang tidak aktif di daftar induk SIPP
 * (hakim_pn, panitera_pn, jurusita; kolom aktif 'Y' = aktif, 'T' = tidak). Kunci orang = orang-unik.kunciOrang,
 * jadi "Mannaria" dan "Mannaria, S.H." satu orang.
 *
 * GAGAL-TERBUKA: sumber yang tidak terbaca (bot lama tanpa operasi petugas.statusAktif, basis data) berarti
 * saringan itu tidak berlaku - pemilih hanya kemudahan, dan menyembunyikan orang yang sebenarnya aktif lebih
 * buruk daripada menampilkan orang yang sudah mutasi. Hanya dibaca; tidak ada yang ditulis.
 */
import { kunciAkunTidakAktif, kunciTidakAktif, type PetugasMaster } from "@/lib/orang-unik";
import { type AletaDatabase } from "@/server/db/client";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";

export type TidakAktif = { semua: Set<string>; hakim: Set<string>; pp: Set<string>; js: Set<string> };

const UMUR_MS = 5 * 60 * 1000;
let singgah: { saat: number; hasil: TidakAktif } | null = null;

export function lupakanTidakAktif() {
  singgah = null;
}

type JawabanMaster = { hakim?: PetugasMaster[]; panitera?: PetugasMaster[]; jurusita?: PetugasMaster[] };

export async function bacaTidakAktif(db: AletaDatabase): Promise<TidakAktif> {
  if (singgah && Date.now() - singgah.saat < UMUR_MS) return singgah.hasil;
  const hasil: TidakAktif = { semua: new Set(), hakim: new Set(), pp: new Set(), js: new Set() };
  try {
    const akun = await db.queryAll<{ name: string; is_active: unknown; deleted_at: unknown }>(`SELECT name, is_active, deleted_at FROM users`);
    hasil.semua = kunciAkunTidakAktif(akun.map((a) => ({ name: a.name, isActive: a.is_active, deletedAt: a.deleted_at })));
  } catch {
    /* akun tidak terbaca: saringan akun ALETA tidak berlaku */
  }
  try {
    const j = await callAletaBotSippBridge<JawabanMaster>("petugas.statusAktif", {}, { timeoutMs: 8000 });
    if (j.ok && j.data) {
      hasil.hakim = kunciTidakAktif(Array.isArray(j.data.hakim) ? j.data.hakim : []);
      hasil.pp = kunciTidakAktif(Array.isArray(j.data.panitera) ? j.data.panitera : []);
      hasil.js = kunciTidakAktif(Array.isArray(j.data.jurusita) ? j.data.jurusita : []);
    }
  } catch {
    /* bot lama / tidak menjawab: saringan SIPP tidak berlaku */
  }
  singgah = { saat: Date.now(), hasil };
  return hasil;
}
