/**
 * ============================================================================
 * PENCOCOKAN MINGGUAN CERMIN PERKARA (A3, 25 Okt 2026) - Minggu 02.00 WITA
 * ============================================================================
 *
 * Pembaruan berkala hanya melihat baris yang waktunya BERUBAH. Dua hal lolos
 * darinya, dan pencocokan inilah yang menangkapnya:
 *
 *   * data yang DIHAPUS di SIPP (penghapusan tidak terlihat dari kolom waktu)
 *     atau dipindah (sidang);
 *   * baris di tabel besar/tanpa kolom waktu yang berubah tanpa menyentuh
 *     perkara.
 *
 * Caranya: daftar RINGAN (id + waktu) dari bot dibandingkan dengan isi cermin.
 *   perkara - id di cermin tetapi tidak di SIPP dihapus; id di SIPP tetapi tidak
 *             di cermin, atau waktu perkara di SIPP lebih baru dari cermin,
 *             dibaca ulang;
 *   sidang  - per jendela bulan: id sidang di cermin yang tidak ada di SIPP
 *             dihapus; yang baru atau lebih baru di SIPP menandai tanggalnya
 *             untuk dihitung ulang.
 * Selisih diperbaiki dan dicatat di aleta_cermin_jejak ("pencocokan"); layar
 * Pemantau menampilkannya. Cermin dianggap BERSIH bila tidak ada selisih sama
 * sekali - syarat menyalakan layar (lihat TAHAPAN: "pencocokan pertama bersih").
 *
 * Hanya MEMBACA SIPP (rute GET bot); menulis hanya tabel aleta_cermin_*.
 */
import {
  bersihkanKeadaanPencocokan,
  tambahHari,
  type HasilPencocokan,
  type KeadaanPencocokan,
  type PengaturanCermin,
} from "@/lib/cermin";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import type { AletaDatabase } from "@/server/db/client";
import { KUNCI_JEJAK, bacaJejak, tulisJejak } from "@/server/modules/cermin/jejak";
import { muatKeadaanPemindai } from "@/server/modules/cermin/pemindai";
import { gabungAntrianTanggal, muatKeadaanPembaruan, segarkanRentangSidang, type DepsPembaruan } from "@/server/modules/cermin/pembaruan";
import { hapusPerkaraCermin, simpanKelompokPerkara } from "@/server/modules/cermin/penyimpan";

const HALAMAN_PERKARA = 2000;
/** Paling banyak tanggal yang dihitung ulang dalam satu pencocokan; sisanya masuk antrean pembaruan. */
const MAKS_TANGGAL_SEGERA = 60;
const LEBAR_JENDELA_HARI = 31;

export async function muatKeadaanPencocokan(db: AletaDatabase): Promise<KeadaanPencocokan> {
  return bersihkanKeadaanPencocokan(await bacaJejak(db, KUNCI_JEJAK.pencocokan));
}

type Wadah = { jalan: boolean };
const SIMPAN = globalThis as unknown as { __aletaCerminPencocokan?: Wadah };
function wadah(): Wadah {
  SIMPAN.__aletaCerminPencocokan ??= { jalan: false };
  return SIMPAN.__aletaCerminPencocokan;
}
/** Hanya untuk uji. */
export function aturUlangPencocokanCermin() {
  SIMPAN.__aletaCerminPencocokan = { jalan: false };
}

export type HasilJalanPencocokan =
  | { jalan: true; hasil: HasilPencocokan }
  | { jalan: false; alasan: "sibuk" | "menunggu-pemindaian" | "galat"; pesan?: string };

/**
 * Menjalankan satu pencocokan penuh. Tidak berjalan sebelum pemindaian awal
 * selesai, dan tidak bertumpuk. Galat di tengah jalan tidak mencatat hasil
 * (pencocokan diulang pada jadwal berikutnya atau lewat tombol).
 */
export async function jalankanPencocokan(
  deps: DepsPembaruan,
  opsi: { pemicu?: "mingguan" | "tombol" } = {}
): Promise<HasilJalanPencocokan> {
  const w = wadah();
  if (w.jalan) return { jalan: false, alasan: "sibuk" };
  w.jalan = true;
  const mulaiMs = Date.now();
  try {
    const db = await deps.db();
    const pemindai = await muatKeadaanPemindai(db);
    if (pemindai.status !== "selesai") return { jalan: false, alasan: "menunggu-pemindaian" };
    const sekarang = deps.sekarang();
    const iso = sekarang.toISOString();
    const hasil: HasilPencocokan = {
      pada: iso,
      ms: 0,
      perkaraDihapus: 0,
      perkaraDitambah: 0,
      perkaraDiperbaiki: 0,
      sidangDihapus: 0,
      sidangDitambah: 0,
      sidangDiperbaiki: 0,
      tanggalDisegarkan: 0,
      pemicu: opsi.pemicu ?? "mingguan",
      catatan: "",
    };

    // ---- perkara ----------------------------------------------------------
    const cermin = new Map<string, string>();
    for (const r of await db.queryAll<{ perkara_id: string; sipp_diperbarui: string }>("SELECT perkara_id, sipp_diperbarui FROM aleta_cermin_perkara")) {
      cermin.set(String(r.perkara_id), String(r.sipp_diperbarui || ""));
    }
    const dilihat = new Set<string>();
    const perluBaca: string[] = [];
    let kursor = 0;
    for (let halaman = 0; halaman < 200; halaman++) {
      const r = await deps.bot.idPerkara(kursor, HALAMAN_PERKARA);
      if (!r.ok) throw new Error(r.error);
      for (const p of r.data.perkara) {
        const id = String(p.perkaraId);
        dilihat.add(id);
        const waktuCermin = cermin.get(id);
        if (waktuCermin === undefined) {
          hasil.perkaraDitambah += 1;
          perluBaca.push(id);
        } else if (p.waktu && p.waktu > waktuCermin) {
          hasil.perkaraDiperbaiki += 1;
          perluBaca.push(id);
        }
      }
      if (r.data.habis || r.data.terakhirId <= kursor) break;
      kursor = r.data.terakhirId;
    }
    const hapus = [...cermin.keys()].filter((id) => !dilihat.has(id));
    if (hapus.length > 0) {
      await hapusPerkaraCermin(db, hapus);
      hasil.perkaraDihapus = hapus.length;
    }
    for (let mulai = 0; mulai < perluBaca.length; mulai += 500) {
      const detail = await deps.bot.perkaraId(perluBaca.slice(mulai, mulai + 500));
      if (!detail.ok) throw new Error(detail.error);
      await simpanKelompokPerkara(db, detail.data.perkara, iso);
    }

    // ---- sidang -----------------------------------------------------------
    const awal = pemindai.sidang.awal;
    const hariIni = waktuPengadilan(sekarang).tanggal;
    const akhir = [pemindai.sidang.akhir, tambahHari(hariIni, 90)].sort().pop() as string;
    const tanggalPerlu = new Set<string>();
    if (awal) {
      for (let dari = awal; dari <= akhir; dari = tambahHari(dari, LEBAR_JENDELA_HARI)) {
        const sampai = [tambahHari(dari, LEBAR_JENDELA_HARI - 1), akhir].sort()[0];
        const r = await deps.bot.idSidang(dari, sampai);
        if (!r.ok) throw new Error(r.error);
        const lama = new Map<string, { tanggal: string; waktu: string }>();
        for (const x of await db.queryAll<{ sidang_id: string; tanggal_sidang: string; sipp_diperbarui: string }>(
          "SELECT sidang_id, tanggal_sidang, sipp_diperbarui FROM aleta_cermin_sidang WHERE tanggal_sidang >= ? AND tanggal_sidang <= ?",
          [dari, sampai]
        )) {
          lama.set(String(x.sidang_id), { tanggal: String(x.tanggal_sidang), waktu: String(x.sipp_diperbarui || "") });
        }
        const ada = new Set<string>();
        for (const s of r.data.sidang) {
          const id = String(s.sidangId);
          ada.add(id);
          const l = lama.get(id);
          if (!l) {
            hasil.sidangDitambah += 1;
            tanggalPerlu.add(s.tanggalSidang);
          } else if (s.waktu && s.waktu > l.waktu) {
            hasil.sidangDiperbaiki += 1;
            tanggalPerlu.add(s.tanggalSidang);
          }
        }
        const hilang = [...lama.entries()].filter(([id]) => !ada.has(id));
        if (hilang.length > 0) {
          // Hilang di SIPP (dihapus atau dipindah): hapus, dan hitung ulang tanggalnya
          // (sidang yang dipindah muncul di tanggal barunya lewat daftar di atas).
          for (let mulai = 0; mulai < hilang.length; mulai += 500) {
            const bagian = hilang.slice(mulai, mulai + 500).map(([id]) => id);
            await db.run(`DELETE FROM aleta_cermin_sidang WHERE sidang_id IN (${bagian.map(() => "?").join(", ")})`, bagian);
          }
          hasil.sidangDihapus += hilang.length;
          for (const [, l] of hilang) tanggalPerlu.add(l.tanggal);
        }
      }
    }
    const urut = [...tanggalPerlu].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    const segera = urut.slice(0, MAKS_TANGGAL_SEGERA);
    for (const d of segera) {
      await segarkanRentangSidang(deps, d, d, iso);
      hasil.tanggalDisegarkan += 1;
    }
    if (urut.length > segera.length) {
      const pembaruan = await muatKeadaanPembaruan(db);
      pembaruan.antrianTanggal = gabungAntrianTanggal(pembaruan.antrianTanggal, urut.slice(segera.length));
      await tulisJejak(db, KUNCI_JEJAK.pembaruan, pembaruan, iso);
      hasil.catatan = `${urut.length - segera.length} tanggal sidang diantrekan ke pembaruan berkala.`;
    }

    hasil.ms = Date.now() - mulaiMs;
    const keadaan = await muatKeadaanPencocokan(db);
    const riwayat = [...keadaan.riwayat, hasil].slice(-8);
    await tulisJejak(db, KUNCI_JEJAK.pencocokan, { terakhir: hasil, riwayat }, iso);
    return { jalan: true, hasil };
  } catch (galat) {
    return { jalan: false, alasan: "galat", pesan: galat instanceof Error ? galat.message : "pencocokan gagal" };
  } finally {
    w.jalan = false;
  }
}

/** Dipanggil detak: menjalankan pencocokan hanya bila saklar menyala dan Minggu 02.00 WITA telah lewat. */
export async function pencocokanBilaJatuhTempo(
  deps: DepsPembaruan,
  jatuhTempo: (sekarang: Date, terakhirPada: string) => boolean,
  p?: PengaturanCermin
): Promise<HasilJalanPencocokan | null> {
  const pengaturan = p ?? (await deps.pengaturan());
  if (!pengaturan.pemindaiAktif) return null;
  const sekarang = deps.sekarang();
  // Penolakan murah tanpa basis data: bukan Minggu atau belum 02.00 ditolak di jatuhTempo (tanpa terakhirPada).
  if (!jatuhTempo(sekarang, "")) return null;
  const db = await deps.db();
  const keadaan = await muatKeadaanPencocokan(db);
  if (!jatuhTempo(sekarang, keadaan.terakhir?.pada ?? "")) return null;
  return jalankanPencocokan(deps, { pemicu: "mingguan" });
}
