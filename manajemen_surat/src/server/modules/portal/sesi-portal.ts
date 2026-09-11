import { APP_VERSION } from "@/lib/patch-notes";
import { type AletaDatabase } from "@/server/db/client";

/**
 * Masa berlaku sesi portal.
 *
 * ============================================================================
 * DUA MASA BERLAKU, DAN ALASANNYA BUKAN KENYAMANAN
 * ============================================================================
 *
 * Yang mencentang "Simpan login akun" memakai komputernya sendiri dan tidak
 * boleh diputus di tengah pekerjaan: panitera pengganti yang sedang menulis
 * berita acara di ruang sidang kehilangan halamannya ketika sesi habis, dan
 * yang hilang itu pekerjaan, bukan kenyamanan.
 *
 * Yang TIDAK mencentangnya hampir selalu berada di komputer bersama - meja
 * PTSP, komputer ruang sidang, laptop pinjaman. Di sana sesi yang hidup
 * berhari-hari berarti orang berikutnya duduk di depan akun orang sebelumnya,
 * dengan seluruh kewenangannya. Dua jam adalah panjang satu sesi persidangan.
 *
 * ============================================================================
 * PEMBARUAN APLIKASI MEMUTUS KEDUANYA
 * ============================================================================
 *
 * Versi aplikasi dicatat saat masuk. Berbeda berarti sesi itu lahir pada
 * aplikasi yang lain: perambannya masih memegang berkas lama, sedangkan rute
 * yang dipanggilnya bisa jadi sudah berubah bentuk. Gejalanya berupa layar
 * yang gagal di tempat yang tidak berhubungan dengan sebabnya, dan tidak dapat
 * ditirukan siapa pun yang perambannya sudah segar.
 *
 * ============================================================================
 * BELUM BERTANDA BERARTI BELUM DIINGAT
 * ============================================================================
 *
 * Sesi yang tidak punya baris penanda diperlakukan sebagai TIDAK diingat -
 * dua jam. Arah bawaannya sengaja ke sisi yang lebih ketat: penanda dapat
 * hilang karena permintaan penandaan gagal atau karena sesi itu lahir sebelum
 * pembaruan ini, dan tidak satu pun dari itu boleh berakibat sesi yang hidup
 * selamanya di komputer bersama.
 */
export const SESI_TANPA_DIINGAT_DETIK = 2 * 60 * 60;

type BarisSesi = { diingat: number; versi_aplikasi: string };

/** Menandai sesi yang baru dibuat: diingat atau tidak, beserta versi aplikasinya. */
export async function tandaiSesi(
  db: AletaDatabase,
  sessionId: string,
  diingat: boolean
) {
  const id = String(sessionId || "").trim();
  if (!id) return;

  await db
    .prepare(
      "INSERT INTO sesi_portal (session_id, diingat, versi_aplikasi, dibuat_pada) " +
        "VALUES (?, ?, ?, ?) " +
        "ON CONFLICT(session_id) DO UPDATE SET " +
        "diingat = excluded.diingat, versi_aplikasi = excluded.versi_aplikasi"
    )
    .run(id, diingat ? 1 : 0, APP_VERSION, new Date().toISOString());
}

export type PutusanSesi =
  | { berlaku: true; diingat: boolean }
  | { berlaku: false; sebab: "kedaluwarsa" | "versi-berubah" };

/**
 * Apakah sesi ini masih boleh dipakai.
 *
 * @param dibuatPada kapan sesi dibuat, menurut Better Auth
 */
export async function periksaSesi(
  db: AletaDatabase,
  sessionId: string,
  dibuatPada: Date | string | null | undefined,
  sekarang: Date = new Date()
): Promise<PutusanSesi> {
  const baris = await db
    .prepare("SELECT diingat, versi_aplikasi FROM sesi_portal WHERE session_id = ?")
    .all<BarisSesi>(String(sessionId || ""));

  const penanda = baris[0];
  const diingat = penanda ? Number(penanda.diingat) === 1 : false;

  // Versi hanya dibandingkan bila penandanya ada DAN versinya tercatat. Sesi
  // yang lahir sebelum pembaruan ini tidak punya keduanya, dan memutus seluruh
  // pegawai pada saat pemasangan bukan perilaku yang diinginkan siapa pun -
  // dua jam berikutnya sudah cukup untuk membuat semuanya bertanda.
  if (penanda && penanda.versi_aplikasi && penanda.versi_aplikasi !== APP_VERSION) {
    return { berlaku: false, sebab: "versi-berubah" };
  }

  if (diingat) return { berlaku: true, diingat: true };

  const lahir = dibuatPada ? new Date(dibuatPada) : null;
  if (!lahir || Number.isNaN(lahir.getTime())) {
    // Tanpa tanggal lahir yang terbaca, tidak ada dasar menghitung umurnya.
    // Dibiarkan berlaku: Better Auth punya masa berlakunya sendiri sebagai
    // batas terakhir, dan menolak di sini akan mengunci keluar orang yang
    // tidak melakukan kesalahan apa pun.
    return { berlaku: true, diingat: false };
  }

  const umurDetik = (sekarang.getTime() - lahir.getTime()) / 1000;
  if (umurDetik > SESI_TANPA_DIINGAT_DETIK) {
    return { berlaku: false, sebab: "kedaluwarsa" };
  }

  return { berlaku: true, diingat: false };
}

/**
 * Menghapus sesi yang sudah tidak berlaku.
 *
 * Dihapus, bukan sekadar ditolak: sesi yang ditolak tetapi tetap ada membuat
 * peramban mengirim kuki yang sama pada tiap permintaan berikutnya, dan
 * pengguna melihat deretan galat alih-alih satu kali kembali ke halaman masuk.
 */
export async function hapusSesi(db: AletaDatabase, sessionId: string) {
  const id = String(sessionId || "").trim();
  if (!id) return;
  await db.prepare("DELETE FROM sesi_portal WHERE session_id = ?").run(id);
  await db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
}
