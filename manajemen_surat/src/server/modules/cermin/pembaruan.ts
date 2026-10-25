/**
 * ============================================================================
 * PEMBARUAN BERKALA CERMIN PERKARA (A3, 25 Okt 2026)
 * ============================================================================
 *
 * Sesudah pemindaian awal SELESAI, cermin dijaga tetap terbaru:
 *
 *   1. SETIAP MENIT (selangPembaruanDetik): bot ditanya perkara mana yang
 *      tersentuh sejak waktu SIPP terakhir (diinput_tanggal/diperbaharui_tanggal).
 *      Hanya perkara itu yang dibaca ulang; perkara baru otomatis masuk. Tanda
 *      waktu disimpan setelah tiap putaran, dengan tumpang tindih 2 menit
 *      (baris yang tersimpan beberapa detik terlambat tidak terlewat).
 *   2. TANGGAL SIDANG yang tersentuh dihitung ulang lewat bot (baris yang SAMA
 *      dengan layar Jadwal Sidang), beberapa tanggal per putaran, sisanya antre.
 *   3. JENDELA PANAS: sidang pada [hari ini - 1, hari ini + 7] dihitung ulang
 *      tiap 3 menit; sebagian bahannya (relaas, kehadiran, saksi, berkas e-Court)
 *      berubah tanpa menyentuh kolom waktu tabel jadwal.
 *   4. TULISAN LEWAT ALETA masuk SEKETIKA: segarkanSegera() dipanggil gerbang
 *      bot sesudah tulisan berhasil, tanpa menunggu putaran berikutnya.
 *
 * SIPP tetap sumber kebenaran; semua ini hanya MEMBACA SIPP (lewat rute GET bot)
 * dan menulis tabel aleta_cermin_*. Gagal = cermin tertinggal dan layar kembali
 * ke SIPP; galat beruntun menambah jeda.
 */
import {
  bersihkanKeadaanPembaruan,
  geserWaktuSipp,
  tambahHari,
  waktuSippDari,
  waktuSippTerbaru,
  type KeadaanPembaruan,
  type PengaturanCermin,
} from "@/lib/cermin";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase, type AletaDatabase } from "@/server/db/client";
import { botCerminAsli, type BotCerminLengkap, type SidangSumber } from "@/server/modules/cermin/bot";
import { KUNCI_JEJAK, bacaJejak, tulisJejak } from "@/server/modules/cermin/jejak";
import { sumberPengaturanCermin } from "@/server/modules/cermin/pengaturan";
import { muatKeadaanPemindai } from "@/server/modules/cermin/pemindai";
import { gantiSidangRentang, hapusPerkaraCermin, simpanKelompokPerkara } from "@/server/modules/cermin/penyimpan";
import { tulisCerminTerakhirMs } from "@/server/modules/cermin/setelah-tulisan";

export type DepsPembaruan = {
  db: () => Promise<AletaDatabase>;
  bot: BotCerminLengkap;
  pengaturan: () => Promise<PengaturanCermin>;
  sekarang: () => Date;
};

export const depsPembaruanAsli: DepsPembaruan = {
  db: getDatabase,
  bot: botCerminAsli,
  pengaturan: sumberPengaturanCermin,
  sekarang: () => new Date(),
};

/** Tumpang tindih bacaan perubahan (detik). */
export const TUMPANG_TINDIH_DETIK = 120;
/** Awal tanda waktu sesudah pemindaian awal: saat pemindai mulai dikurangi ini (detik), supaya perubahan selama pemindaian tertangkap. */
export const MUNDUR_AWAL_DETIK = 600;
const BATAS_PERKARA_PER_PUTARAN = 500;
const MAKS_TANGGAL_PER_PUTARAN = 6;
const MAKS_ANTRIAN_TANGGAL = 400;

export type AlasanPembaruan = "mati" | "menunggu-pemindaian" | "menunggu-selang" | "sibuk" | "ok" | "galat";
export type HasilPembaruan = {
  alasan: AlasanPembaruan;
  perkara?: number;
  tanggal?: number;
  ditulis?: number;
  pesan?: string;
};

type Wadah = {
  jalan: boolean;
  /** Putaran terakhir (ms) - dasar penolakan murah tanpa menyentuh basis data. */
  terakhirMs: number;
  /** Ada permintaan segarkanSegera yang belum dikerjakan. */
  kotor: boolean;
  tanggalKotor: Set<string>;
  /** Pewaktu penggabung tulisan beruntun (satu putaran untuk banyak tulisan). */
  pewaktu: ReturnType<typeof setTimeout> | null;
  segeraMs: number;
  /** Saat (ms) jendela panas terakhir MULAI dihitung ulang dan selesai dengan baik. */
  panasMulaiMs: number;
};
const SIMPAN = globalThis as unknown as { __aletaCerminPembaruan?: Wadah };
const wadahBaru = (): Wadah => ({ jalan: false, terakhirMs: 0, kotor: false, tanggalKotor: new Set(), pewaktu: null, segeraMs: 0, panasMulaiMs: 0 });
function wadah(): Wadah {
  SIMPAN.__aletaCerminPembaruan ??= wadahBaru();
  return SIMPAN.__aletaCerminPembaruan;
}

/** Hanya untuk uji. */
export function aturUlangPembaruanCermin() {
  if (SIMPAN.__aletaCerminPembaruan?.pewaktu) clearTimeout(SIMPAN.__aletaCerminPembaruan.pewaktu);
  SIMPAN.__aletaCerminPembaruan = wadahBaru();
}

export async function muatKeadaanPembaruan(db: AletaDatabase): Promise<KeadaanPembaruan> {
  return bersihkanKeadaanPembaruan(await bacaJejak(db, KUNCI_JEJAK.pembaruan));
}

/** Tanggal WITA hari ini dan jendela panas. */
export function tanggalPanas(sekarang: Date, p: Pick<PengaturanCermin, "panasHariLalu" | "panasHariDepan">) {
  const hari = waktuPengadilan(sekarang).tanggal;
  return { hari, dari: tambahHari(hari, -p.panasHariLalu), sampai: tambahHari(hari, p.panasHariDepan) };
}

/**
 * Membaca sidang satu rentang dari SIPP (lewat bot) dan menggantikannya di
 * cermin. Rentang terpotong batas baris dibelah dua dan diulang; sehari yang
 * tetap terpotong ditulis tanpa menghapus apa pun. Mengembalikan jumlah baris.
 */
export async function segarkanRentangSidang(
  deps: Pick<DepsPembaruan, "bot" | "db">,
  dari: string,
  sampai: string,
  sekarang: string
): Promise<{ baris: number; ditulis: number; dihapus: number; peringatan: string[] }> {
  const hasil = { baris: 0, ditulis: 0, dihapus: 0, peringatan: [] as string[] };
  const r = await deps.bot.sidang(dari, sampai);
  if (!r.ok) throw new Error(r.error);
  if (r.data.terpotong && sampai > dari) {
    // Belah dua pada pertengahan (dari..tengah, tengah+1..sampai).
    const lebar = Math.round((Date.parse(sampai) - Date.parse(dari)) / 86_400_000);
    const tengah = tambahHari(dari, Math.floor(lebar / 2));
    const kiri = await segarkanRentangSidang(deps, dari, tengah, sekarang);
    const kanan = await segarkanRentangSidang(deps, tambahHari(tengah, 1), sampai, sekarang);
    return {
      baris: kiri.baris + kanan.baris,
      ditulis: kiri.ditulis + kanan.ditulis,
      dihapus: kiri.dihapus + kanan.dihapus,
      peringatan: [...kiri.peringatan, ...kanan.peringatan],
    };
  }
  if (r.data.terpotong) hasil.peringatan.push(`${dari}: sehari penuh mencapai batas baris bot (sidang mungkin kurang).`);
  const db = await deps.db();
  const g = await gantiSidangRentang(db, dari, sampai, r.data.sidang as SidangSumber[], { terpotong: r.data.terpotong, sekarang });
  hasil.baris = r.data.sidang.length;
  hasil.ditulis = g.ditulis;
  hasil.dihapus = g.dihapus;
  return hasil;
}

/** Menggabung tanggal ke antrean (unik, urut naik, dibatasi). */
export function gabungAntrianTanggal(antrian: string[], baru: string[]): string[] {
  return [...new Set([...antrian, ...baru])].sort().slice(0, MAKS_ANTRIAN_TANGGAL);
}

/**
 * Satu putaran pembaruan. `paksa` melewati saklar dan selang (tombol/uji);
 * tidak pernah berjalan sebelum pemindaian awal selesai.
 */
export async function putaranPembaruan(deps: DepsPembaruan = depsPembaruanAsli, opsi: { paksa?: boolean } = {}): Promise<HasilPembaruan> {
  const w = wadah();
  if (w.jalan) return { alasan: "sibuk" };
  const sekarang = deps.sekarang();
  w.jalan = true;
  const mulaiMs = Date.now();
  try {
    const p = await deps.pengaturan();
    if (!p.pemindaiAktif && !opsi.paksa) return { alasan: "mati" };
    // Penolakan murah di memori: tanpa menyentuh basis data bila belum waktunya.
    if (!opsi.paksa && w.terakhirMs && sekarang.getTime() - w.terakhirMs < p.selangPembaruanDetik * 1000) {
      return { alasan: "menunggu-selang" };
    }
    const db = await deps.db();
    const pemindai = await muatKeadaanPemindai(db);
    if (pemindai.status !== "selesai") return { alasan: "menunggu-pemindaian" };

    const k = await muatKeadaanPembaruan(db);
    const iso = sekarang.toISOString();
    if (!opsi.paksa && k.putaranTerakhir) {
      const jeda = k.galat.beruntun > 0 ? Math.min(600, p.selangPembaruanDetik * 2 ** k.galat.beruntun) : p.selangPembaruanDetik;
      if (sekarang.getTime() - (Date.parse(k.putaranTerakhir) || 0) < jeda * 1000) {
        w.terakhirMs = Date.parse(k.putaranTerakhir) || 0;
        return { alasan: "menunggu-selang" };
      }
    }

    let perkara = 0;
    let tanggalDibaca = 0;
    let ditulis = 0;
    try {
      if (!k.tanda) {
        const mulai = Date.parse(pemindai.mulaiPada);
        k.tanda = waktuSippDari(new Date(Number.isFinite(mulai) ? mulai - MUNDUR_AWAL_DETIK * 1000 : sekarang.getTime() - MUNDUR_AWAL_DETIK * 1000));
      }
      // 1. Perkara yang tersentuh.
      const sejak = geserWaktuSipp(k.tanda, -TUMPANG_TINDIH_DETIK);
      const r = await deps.bot.perubahan(sejak, BATAS_PERKARA_PER_PUTARAN);
      if (!r.ok) throw new Error(r.error);
      k.tidakTerbaca = r.data.tidakTerbaca.map((t) => `${t.tabel}: ${t.sebab}`).slice(0, 20);
      if (r.data.perkaraId.length > 0) {
        const detail = await deps.bot.perkaraId(r.data.perkaraId);
        if (!detail.ok) throw new Error(detail.error);
        const h = await simpanKelompokPerkara(db, detail.data.perkara, iso);
        ditulis += h.ditulis;
        perkara = detail.data.perkara.length;
        // Perkara yang diminta tetapi tidak dikembalikan sudah tidak ada di SIPP.
        const ada = new Set(detail.data.perkara.map((x) => String(x.perkaraId)));
        const hilang = r.data.perkaraId.filter((id) => !ada.has(String(id)));
        if (hilang.length > 0) await hapusPerkaraCermin(db, hilang);
      }
      k.antrianTanggal = gabungAntrianTanggal(k.antrianTanggal, r.data.tanggalSidang);
      // Tanda maju hanya bila bacaan tidak terpotong (terpotong: lanjut dari waktu baris terakhir yang termuat).
      k.tanda = waktuSippTerbaru(k.tanda, r.data.tandaBaru);

      // 2. Jendela panas.
      const panas = tanggalPanas(sekarang, p);
      const panasJatuhTempo = !k.panasTerakhir || sekarang.getTime() - (Date.parse(k.panasTerakhir) || 0) >= p.panasMenit * 60_000;
      const peringatan: string[] = [];
      if (panasJatuhTempo || w.kotor) {
        const panasMulaiMs = Date.now();
        const h = await segarkanRentangSidang(deps, panas.dari, panas.sampai, iso);
        w.panasMulaiMs = panasMulaiMs;
        ditulis += h.ditulis;
        tanggalDibaca += panas.dari === panas.sampai ? 1 : Math.round((Date.parse(panas.sampai) - Date.parse(panas.dari)) / 86_400_000) + 1;
        peringatan.push(...h.peringatan);
        k.panasTerakhir = iso;
        // Tanggal dalam jendela panas sudah segar - keluarkan dari antrean.
        k.antrianTanggal = k.antrianTanggal.filter((d) => d < panas.dari || d > panas.sampai);
      }
      // Tanggal yang diminta tulisan (segarkanSegera) selagi putaran ini jalan.
      if (w.tanggalKotor.size > 0) {
        k.antrianTanggal = gabungAntrianTanggal(k.antrianTanggal, [...w.tanggalKotor]);
        w.tanggalKotor.clear();
      }
      w.kotor = false;

      // 3. Tanggal antre (beberapa per putaran).
      const diproses = k.antrianTanggal.slice(0, MAKS_TANGGAL_PER_PUTARAN);
      for (const d of diproses) {
        const h = await segarkanRentangSidang(deps, d, d, iso);
        ditulis += h.ditulis;
        tanggalDibaca += 1;
        peringatan.push(...h.peringatan);
      }
      k.antrianTanggal = k.antrianTanggal.slice(diproses.length);

      k.galat.beruntun = 0;
      k.terakhir = { perkara, tanggal: tanggalDibaca, ditulis, ms: Date.now() - mulaiMs, pada: iso };
      k.putaranTerakhir = iso;
      await tulisJejak(db, KUNCI_JEJAK.pembaruan, k, iso);
      w.terakhirMs = sekarang.getTime();
      if (w.kotor) jadwalkanSegera(deps, JEDA_SEGERA_MS);
      return { alasan: "ok", perkara, tanggal: tanggalDibaca, ditulis };
    } catch (galat) {
      const pesan = galat instanceof Error ? galat.message : "pembaruan gagal";
      k.galat = { terakhir: pesan.slice(0, 300), pada: iso, beruntun: k.galat.beruntun + 1 };
      k.putaranTerakhir = iso;
      await tulisJejak(db, KUNCI_JEJAK.pembaruan, k, iso);
      w.terakhirMs = sekarang.getTime();
      return { alasan: "galat", pesan };
    }
  } catch (galat) {
    return { alasan: "galat", pesan: galat instanceof Error ? galat.message : "pembaruan gagal" };
  } finally {
    w.jalan = false;
  }
}

/**
 * Sudah menyusul tulisan terakhir lewat ALETA? Benar bila jendela panas
 * terakhir MULAI dihitung (dan berhasil) sesudah tulisan terakhir. Salah berarti
 * cermin belum memuat tulisan itu: layar yang membaca cermin harus membaca SIPP
 * dulu supaya petugas yang baru menyimpan tidak melihat data sebelum simpanannya.
 */
export function cerminMenyusulTulisan(): boolean {
  return wadah().panasMulaiMs >= tulisCerminTerakhirMs();
}

/** Jeda penggabung tulisan beruntun (ms). */
export const JEDA_SEGERA_MS = 1500;

function jadwalkanSegera(deps: DepsPembaruan, tungguMs: number) {
  const w = wadah();
  if (w.pewaktu) return;
  w.pewaktu = setTimeout(() => {
    w.pewaktu = null;
    w.segeraMs = Date.now();
    void putaranPembaruan(deps, { paksa: true }).catch(() => undefined);
  }, Math.max(0, tungguMs));
  w.pewaktu.unref?.();
}

/**
 * Tulisan lewat ALETA masuk seketika: jendela panas (plus tanggal yang
 * disebutkan) dihitung ulang sekarang, tanpa menunggu selang. Aman dipanggil
 * pada SETIAP tulisan: tulisan beruntun digabung (satu putaran per 1,5 detik),
 * bila putaran sedang jalan ia hanya menandai "kotor" dan putaran ulang
 * dijadwalkan sesudahnya; bila saklar mati atau pemindaian belum selesai,
 * tidak melakukan apa pun.
 */
export async function segarkanSegera(tanggal: string[] = [], deps: DepsPembaruan = depsPembaruanAsli): Promise<HasilPembaruan> {
  const w = wadah();
  const p = await deps.pengaturan();
  if (!p.pemindaiAktif) {
    w.tanggalKotor.clear();
    w.kotor = false;
    return { alasan: "mati" };
  }
  for (const t of tanggal) if (/^\d{4}-\d{2}-\d{2}$/.test(t)) w.tanggalKotor.add(t);
  w.kotor = true;
  if (w.jalan || w.pewaktu) return { alasan: "sibuk" };
  const sejak = Date.now() - w.segeraMs;
  if (sejak >= JEDA_SEGERA_MS) {
    w.segeraMs = Date.now();
    return putaranPembaruan(deps, { paksa: true });
  }
  jadwalkanSegera(deps, JEDA_SEGERA_MS - sejak);
  return { alasan: "menunggu-selang" };
}
