/**
 * ============================================================================
 * PEMINDAI AWAL CERMIN PERKARA (C0, 25 Okt 2026)
 * ============================================================================
 *
 * Membaca seluruh perkara SIPP dalam KELOMPOK KECIL (300 perkara bawaan, jeda
 * 15 detik di antaranya), lalu seluruh jadwal sidang per jendela tanggal
 * (7 hari, mengecil bila terpotong batas baris), dan menyimpannya di tabel
 * aleta_cermin_*. Aturannya:
 *
 *   * HANYA MEMBACA SIPP (lewat bot, rute GET). Tidak ada tulisan ke SIPP/ABT.
 *   * DI LUAR JAM KERJA: jendela 18.00-06.30 WITA (dapat diatur). Di luar
 *     jendela pemindai berhenti ("jeda") dan melanjutkan malam berikutnya.
 *   * BISA DILANJUTKAN: titik terakhir (perkara_id terakhir, tanggal jendela
 *     berikutnya) disimpan di aleta_cermin_jejak setelah TIAP kelompok. Mulai
 *     ulang portal, galat, atau jendela yang berakhir tidak mengulang dari awal.
 *   * SAKLAR MATI BAWAAN (pemindaiAktif). Menyalakannya dari layar Pemantau
 *     Cermin Perkara; layar membaca cermin hanya lewat saklar per layarnya.
 *   * GALAT BERUNTUN: jeda bertambah (eksponensial), dan lima galat beruntun
 *     menghentikan pemindai ("galat") sampai Admin menekan Lanjutkan - SIPP
 *     yang sedang bermasalah tidak ditekan terus.
 *   * Satu putaran = satu kelompok. Dua putaran tidak bertumpuk di satu proses.
 */
import {
  GALAT_BERUNTUN_MAKS,
  LEBAR_JENDELA_BAWAAN,
  bersihkanKeadaanPemindai,
  dalamJendelaJam,
  keadaanPemindaiAwal,
  tambahHari,
  type KeadaanPemindai,
  type PengaturanCermin,
} from "@/lib/cermin";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase, type AletaDatabase } from "@/server/db/client";
import { botCerminAsli, type BotCermin } from "@/server/modules/cermin/bot";
import { KUNCI_JEJAK, bacaJejak, hapusJejak, tulisJejak } from "@/server/modules/cermin/jejak";
import { sumberPengaturanCermin } from "@/server/modules/cermin/pengaturan";
import { simpanJendelaSidang, simpanKelompokPerkara } from "@/server/modules/cermin/penyimpan";

export type DepsPemindai = {
  db: () => Promise<AletaDatabase>;
  bot: BotCermin;
  pengaturan: () => Promise<PengaturanCermin>;
  sekarang: () => Date;
};

export const depsPemindaiAsli: DepsPemindai = {
  db: getDatabase,
  bot: botCerminAsli,
  pengaturan: sumberPengaturanCermin,
  sekarang: () => new Date(),
};

export type AlasanPutaran = "mati" | "selesai" | "luar-jendela" | "galat-berhenti" | "menunggu-jeda" | "sibuk" | "ok" | "galat";

export type HasilPutaran = {
  alasan: AlasanPutaran;
  tahap?: KeadaanPemindai["tahap"];
  status?: KeadaanPemindai["status"];
  diproses?: number;
  ditulis?: number;
  pesan?: string;
};

type Wadah = {
  jalan: boolean;
  detak: NodeJS.Timeout | null;
  terakhir: (HasilPutaran & { pada: string }) | null;
};
const SIMPAN = globalThis as unknown as { __aletaCerminPemindai?: Wadah };
const wadahBaru = (): Wadah => ({ jalan: false, detak: null, terakhir: null });
function wadah(): Wadah {
  SIMPAN.__aletaCerminPemindai ??= wadahBaru();
  return SIMPAN.__aletaCerminPemindai;
}

/** Hanya untuk uji. */
export function aturUlangPemindaiCermin() {
  const w = wadah();
  if (w.detak) clearInterval(w.detak);
  SIMPAN.__aletaCerminPemindai = wadahBaru();
}

/** Keadaan pemindai di proses ini untuk layar Pemantau. */
export function keadaanProsesPemindai() {
  const w = wadah();
  return { menyala: w.detak !== null, sedangMembaca: w.jalan, terakhir: w.terakhir };
}

export async function muatKeadaanPemindai(db: AletaDatabase): Promise<KeadaanPemindai> {
  return bersihkanKeadaanPemindai(await bacaJejak(db, KUNCI_JEJAK.pemindai));
}

/** Mulai ulang pemindaian dari awal (isi cermin tetap; baris yang sama tidak ditulis ulang). */
export async function ulangPemindai(db: AletaDatabase) {
  await hapusJejak(db, KUNCI_JEJAK.pemindai);
}

/** Lanjutkan pemindai yang berhenti karena galat beruntun. */
export async function lanjutkanPemindai(db: AletaDatabase) {
  const k = await muatKeadaanPemindai(db);
  if (k.status !== "galat") return k;
  k.status = "jeda";
  k.galat.beruntun = 0;
  await tulisJejak(db, KUNCI_JEJAK.pemindai, k);
  return k;
}

function dalamJendela(sekarang: Date, p: PengaturanCermin) {
  return dalamJendelaJam(waktuPengadilan(sekarang).jam.slice(0, 5), p.jendelaMulai, p.jendelaSelesai);
}

/** Jeda tambahan setelah galat beruntun: jeda x 2^beruntun, paling lama 10 menit. */
export function jedaSesudahGalatMs(jedaDetik: number, beruntun: number) {
  return Math.min(600_000, jedaDetik * 1000 * 2 ** Math.max(0, beruntun));
}

/**
 * Satu putaran = paling banyak SATU kelompok. `paksa` (tombol Admin) melewati
 * saklar, jendela jam, dan jeda - tetap menolak bila putaran lain sedang jalan.
 */
export async function putaranPemindai(deps: DepsPemindai = depsPemindaiAsli, opsi: { paksa?: boolean } = {}): Promise<HasilPutaran> {
  const w = wadah();
  if (w.jalan) return { alasan: "sibuk" };
  w.jalan = true;
  const mulaiMs = Date.now();
  try {
    const p = await deps.pengaturan();
    if (!p.pemindaiAktif && !opsi.paksa) return { alasan: "mati" };
    const db = await deps.db();
    const k = await muatKeadaanPemindai(db);
    if (k.status === "selesai") return { alasan: "selesai", tahap: k.tahap, status: k.status };
    if (k.status === "galat" && !opsi.paksa) return { alasan: "galat-berhenti", tahap: k.tahap, status: k.status, pesan: k.galat.terakhir };

    const sekarang = deps.sekarang();
    const iso = sekarang.toISOString();
    if (!opsi.paksa) {
      if (!dalamJendela(sekarang, p)) {
        if (k.status === "berjalan") {
          k.status = "jeda";
          await tulisJejak(db, KUNCI_JEJAK.pemindai, k, iso);
        }
        return { alasan: "luar-jendela", tahap: k.tahap, status: k.status };
      }
      // Jeda antar kelompok; sesudah galat, jeda bertambah.
      const jedaMs = k.galat.beruntun > 0 ? jedaSesudahGalatMs(p.jedaDetik, k.galat.beruntun) : p.jedaDetik * 1000;
      // Dasarnya jam yang disuntikkan (putaranTerakhir ditulis dari deps.sekarang), bukan jam dinding.
      const terakhirMs = k.putaranTerakhir ? Date.parse(k.putaranTerakhir) || 0 : 0;
      if (terakhirMs && sekarang.getTime() - terakhirMs < jedaMs) return { alasan: "menunggu-jeda", tahap: k.tahap, status: k.status };
    }

    let diproses = 0;
    let ditulis = 0;
    try {
      if (k.status === "belum") {
        const ring = await deps.bot.ringkasan();
        if (!ring.ok) throw new Error(ring.error);
        k.perkara.total = ring.data.perkara.jumlah;
        k.perkara.terbesar = ring.data.perkara.terbesar;
        k.sidang.awal = ring.data.sidang.awal;
        k.sidang.akhir = ring.data.sidang.akhir;
        k.sidang.kursor = ring.data.sidang.awal;
        k.sidang.total = ring.data.sidang.jumlah;
        k.mulaiPada = iso;
        k.tahap = "perkara";
      }
      k.status = "berjalan";

      if (k.tahap === "perkara") {
        const r = await deps.bot.perkara(k.perkara.kursor, p.ukuranKelompok);
        if (!r.ok) throw new Error(r.error);
        const h = await simpanKelompokPerkara(await deps.db(), r.data.perkara, iso);
        k.perkara.kursor = r.data.terakhirId > k.perkara.kursor ? r.data.terakhirId : k.perkara.kursor;
        k.perkara.diproses += r.data.perkara.length;
        diproses = r.data.perkara.length;
        ditulis = h.ditulis;
        if (r.data.habis) {
          k.tahap = k.sidang.awal && k.sidang.akhir ? "sidang" : "selesai";
        }
      } else if (k.tahap === "sidang") {
        if (!k.sidang.awal || !k.sidang.akhir || !k.sidang.kursor) {
          k.tahap = "selesai";
        } else {
          const dari = k.sidang.kursor;
          const ujung = tambahHari(dari, Math.max(1, k.sidang.lebarHari) - 1);
          const sampai = ujung > k.sidang.akhir ? k.sidang.akhir : ujung;
          const r = await deps.bot.sidang(dari, sampai);
          if (!r.ok) throw new Error(r.error);
          if (r.data.terpotong && k.sidang.lebarHari > 1 && sampai > dari) {
            // Jendela terlalu padat: kecilkan dan ulangi tanpa maju. Tidak ada baris yang hilang diam-diam.
            k.sidang.lebarHari = Math.max(1, Math.floor(k.sidang.lebarHari / 2));
          } else {
            if (r.data.terpotong) {
              k.peringatan = [...k.peringatan, `${dari}: sehari penuh mencapai batas baris bot (sidang mungkin kurang).`].slice(-20);
            }
            const h = await simpanJendelaSidang(await deps.db(), r.data, iso);
            k.sidang.kursor = tambahHari(sampai, 1);
            k.sidang.diproses += r.data.sidang.length;
            diproses = r.data.sidang.length;
            ditulis = h.ditulis;
            // Lebar pulih pelan menuju bawaan.
            k.sidang.lebarHari = Math.min(LEBAR_JENDELA_BAWAAN, k.sidang.lebarHari * 2);
            if (k.sidang.kursor > k.sidang.akhir) k.tahap = "selesai";
          }
        }
      }

      if (k.tahap === "selesai") {
        k.status = "selesai";
        k.selesaiPada = iso;
      }
      k.galat.beruntun = 0;
    } catch (galat) {
      const pesan = galat instanceof Error ? galat.message : "pemindai gagal";
      k.galat = { terakhir: pesan.slice(0, 300), pada: iso, beruntun: k.galat.beruntun + 1 };
      k.status = k.galat.beruntun >= GALAT_BERUNTUN_MAKS ? "galat" : k.status === "belum" ? "belum" : "berjalan";
      k.aktifMs += Date.now() - mulaiMs;
      k.putaranTerakhir = iso;
      await tulisJejak(db, KUNCI_JEJAK.pemindai, k, iso);
      return { alasan: "galat", tahap: k.tahap, status: k.status, pesan };
    }

    k.aktifMs += Date.now() - mulaiMs;
    k.putaranTerakhir = iso;
    await tulisJejak(db, KUNCI_JEJAK.pemindai, k, iso);
    return { alasan: "ok", tahap: k.tahap, status: k.status, diproses, ditulis };
  } catch (galat) {
    return { alasan: "galat", pesan: galat instanceof Error ? galat.message : "pemindai gagal" };
  } finally {
    w.jalan = false;
  }
}

/** Selang antar pemeriksaan detak; jeda sungguhan dari pengaturan (putaranPemindai menimbangnya). */
export const DETAK_PEMINDAI_MS = 5_000;

/**
 * Detak pemindai: tiap beberapa detik memeriksa satu putaran. Dinyalakan
 * instrumentation.ts SEKALI saat portal berdiri; saklar pemindaiAktif dibaca
 * ulang tiap detak (layar menang, tanpa restart). Saklar mati = tidak ada
 * kueri ke bot sama sekali.
 */
export function mulaiPemindaiCerminBerkala(deps: DepsPemindai = depsPemindaiAsli) {
  const w = wadah();
  if (w.detak) return false;
  w.detak = setInterval(() => {
    void putaranPemindai(deps)
      .then((hasil) => {
        if (hasil.alasan !== "mati" && hasil.alasan !== "menunggu-jeda" && hasil.alasan !== "sibuk") {
          wadah().terakhir = { ...hasil, pada: new Date().toISOString() };
        }
      })
      .catch(() => undefined);
  }, DETAK_PEMINDAI_MS);
  w.detak.unref?.();
  return true;
}

export { keadaanPemindaiAwal };
