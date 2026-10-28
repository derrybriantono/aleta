import { type AletaDatabase } from "@/server/db/client";
import { pilihCap } from "@/server/modules/aleta-ecourt/penetapan-edoc";
import { ukuranTimpaUntukBot } from "@/server/modules/aleta-ecourt/ukuran-ttd-cap";

/**
 * e-Doc penetapan ikrar talak sebagai PDF bertanda tangan + cap (keputusan P5b,
 * 28 Okt 2026): cap kantor dan ukuran tanda tangan/cap dari portal (tabel cap
 * 0056 dan kartu "Ukuran tanda tangan & cap"), tanda tangan sah dibaca bot
 * sendiri menurut nama di blok tanda tangan blangko. Peruntukan cap: penetapan
 * Ketua ([91], status 2) memakai cap peruntukan Ketua, selain itu hakim (sama
 * dengan PHS). Gagal membaca = tanpa cap/ukuran - bot tetap membuat e-Doc (RTF
 * cadangan bila tanda tangan tidak dapat dibubuhkan), tidak pernah menolak.
 */
export async function bahanTtdIkrar(db: AletaDatabase, statusIkrar: number) {
  const [cap, atur] = await Promise.all([
    pilihCap(db, statusIkrar === 2 ? "pmh" : "phs").catch(() => null),
    ukuranTimpaUntukBot(db).catch(() => null),
  ]);
  return {
    capIkrar: cap ? { id: cap.id, nama: cap.nama, jenis: cap.jenisBerkas, isiBase64: cap.isi.toString("base64") } : undefined,
    aturTtdIkrar: atur ?? undefined,
  };
}
