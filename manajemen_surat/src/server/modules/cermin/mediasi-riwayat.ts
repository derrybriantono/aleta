/**
 * ============================================================================
 * PEMINDAI RIWAYAT MEDIASI (5 Nov 2026)
 * ============================================================================
 *
 * Cermin mediasi (mediasi.ts) hanya memuat JENDELA layar (sekitar -3 s.d. +21 hari). Pemindai ini melengkapinya:
 * seluruh perkara_jadwal_mediasi / perkara_mediasi SIPP dibaca bertahap per jendela tanggal (31 hari bawaan,
 * mengecil bila terpotong batas baris) lewat rute bot yang SAMA dengan jendela layar (/cermin/mediasi, hanya
 * SELECT), dan disimpan ke aleta_cermin_mediasi. Pola yang sama dengan pemindai sidang (pemindai.ts):
 *
 *   * saklar `pemindaiAktif` MATI bawaan; mati = tidak ada kueri ke bot sama sekali;
 *   * mulai SESUDAH pemindaian awal (sidang) selesai - tidak dua pemindaian berat sekaligus;
 *   * di luar jam kerja saja (jendela 18.00-06.30 WITA bawaan), berjeda `jedaDetik` antar jendela;
 *   * dapat dilanjutkan: kursor tanggal disimpan di jejak "mediasi-riwayat" tiap jendela;
 *   * lima galat beruntun menghentikannya ("galat") sampai Super Admin menekan lanjutkan;
 *   * `paksa` (tombol Super Admin) melewati saklar, jam, dan jeda;
 *   * diulang seminggu sekali (hasil mediasi/laporan lama dapat berubah di SIPP): rentang dibaca ulang dan hanya
 *     selisih yang ditulis; yang sudah tidak ada di SIPP ditandai terhapus (lembut).
 *
 * Beban ke SIPP: satu bacaan jendela per jeda (15 detik bawaan) hanya di malam hari = paling banyak 4 bacaan
 * jendela per menit selama pemindaian (tiap bacaan: 1 kueri utama + pihak + kumulasi + lama mediasi per perkara
 * di jendela itu), lalu NOL di luar pemindaian; diulang seminggu sekali. Tidak ada tulisan ke SIPP/ABT.
 */
import {
  GALAT_BERUNTUN_MAKS,
  LEBAR_RIWAYAT_MEDIASI_BAWAAN,
  ULANG_RIWAYAT_MEDIASI_HARI,
  bersihkanKeadaanRiwayatMediasi,
  dalamJendelaJam,
  keadaanRiwayatMediasiAwal,
  tambahHari,
  type KeadaanRiwayatMediasi,
  type PengaturanCermin,
} from "@/lib/cermin";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase, type AletaDatabase } from "@/server/db/client";
import { botCerminAsli, type BotCerminLengkap } from "@/server/modules/cermin/bot";
import { KUNCI_JEJAK, bacaJejak, tulisJejak } from "@/server/modules/cermin/jejak";
import { gantiMediasiRentang } from "@/server/modules/cermin/mediasi";
import { muatKeadaanPemindai } from "@/server/modules/cermin/pemindai";
import { sumberPengaturanCermin } from "@/server/modules/cermin/pengaturan";

export type DepsRiwayatMediasi = {
  db: () => Promise<AletaDatabase>;
  bot: Pick<BotCerminLengkap, "ringkasan" | "mediasi">;
  pengaturan: () => Promise<PengaturanCermin>;
  sekarang: () => Date;
};

export const depsRiwayatMediasiAsli: DepsRiwayatMediasi = {
  db: getDatabase,
  bot: botCerminAsli,
  pengaturan: sumberPengaturanCermin,
  sekarang: () => new Date(),
};

export type HasilRiwayatMediasi = {
  alasan: "mati" | "menunggu-pemindaian" | "luar-jendela" | "menunggu-jeda" | "galat-berhenti" | "selesai" | "sibuk" | "ok" | "galat";
  status?: KeadaanRiwayatMediasi["status"];
  diproses?: number;
  ditulis?: number;
  pesan?: string;
};

type Wadah = { jalan: boolean };
const SIMPAN = globalThis as unknown as { __aletaCerminRiwayatMediasi?: Wadah };
function wadah(): Wadah {
  SIMPAN.__aletaCerminRiwayatMediasi ??= { jalan: false };
  return SIMPAN.__aletaCerminRiwayatMediasi;
}
/** Hanya untuk uji. */
export function aturUlangRiwayatMediasi() {
  SIMPAN.__aletaCerminRiwayatMediasi = { jalan: false };
}

export async function muatKeadaanRiwayatMediasi(db: AletaDatabase): Promise<KeadaanRiwayatMediasi> {
  return bersihkanKeadaanRiwayatMediasi(await bacaJejak(db, KUNCI_JEJAK.mediasiRiwayat));
}

/** Lanjutkan yang berhenti karena galat beruntun. */
export async function lanjutkanRiwayatMediasi(db: AletaDatabase) {
  const k = await muatKeadaanRiwayatMediasi(db);
  if (k.status !== "galat") return k;
  k.status = "jeda";
  k.galat.beruntun = 0;
  await tulisJejak(db, KUNCI_JEJAK.mediasiRiwayat, k);
  return k;
}

/**
 * Baca ulang seluruh riwayat dari awal. Isi cermin tetap dan rentang yang pernah lengkap (selesaiPada/Awal/Akhir)
 * tetap berlaku untuk jawaban darurat sampai putaran baru selesai.
 */
export async function ulangRiwayatMediasi(db: AletaDatabase) {
  const k = await muatKeadaanRiwayatMediasi(db);
  const baru = { ...keadaanRiwayatMediasiAwal(), selesaiPada: k.selesaiPada, selesaiAwal: k.selesaiAwal, selesaiAkhir: k.selesaiAkhir };
  await tulisJejak(db, KUNCI_JEJAK.mediasiRiwayat, baru);
  return baru;
}

const dalamJendela = (sekarang: Date, p: PengaturanCermin) => dalamJendelaJam(waktuPengadilan(sekarang).jam.slice(0, 5), p.jendelaMulai, p.jendelaSelesai);

/** Jeda tambahan setelah galat beruntun: jeda x 2^beruntun, paling lama 10 menit (aturan pemindai sidang). */
const jedaSesudahGalatMs = (jedaDetik: number, beruntun: number) => Math.min(600_000, jedaDetik * 1000 * 2 ** Math.max(0, beruntun));

/** Satu putaran = paling banyak SATU jendela tanggal. */
export async function putaranRiwayatMediasi(deps: DepsRiwayatMediasi = depsRiwayatMediasiAsli, opsi: { paksa?: boolean } = {}): Promise<HasilRiwayatMediasi> {
  const w = wadah();
  if (w.jalan) return { alasan: "sibuk" };
  w.jalan = true;
  try {
    const p = await deps.pengaturan();
    if (!p.pemindaiAktif && !opsi.paksa) return { alasan: "mati" };
    const db = await deps.db();
    if ((await muatKeadaanPemindai(db)).status !== "selesai") return { alasan: "menunggu-pemindaian" };
    const k = await muatKeadaanRiwayatMediasi(db);
    const sekarang = deps.sekarang();
    const iso = sekarang.toISOString();

    if (k.status === "selesai") {
      const umurMs = sekarang.getTime() - (Date.parse(k.selesaiPada) || 0);
      const jatuhTempo = !k.selesaiPada || umurMs >= ULANG_RIWAYAT_MEDIASI_HARI * 86_400_000;
      if (!jatuhTempo && !opsi.paksa) return { alasan: "selesai", status: k.status };
      if (!opsi.paksa && !dalamJendela(sekarang, p)) return { alasan: "selesai", status: k.status };
      // Mulai putaran baru: rentang lengkap sebelumnya tetap tercatat sampai yang baru selesai.
      k.status = "belum";
    }
    if (k.status === "galat" && !opsi.paksa) return { alasan: "galat-berhenti", status: k.status, pesan: k.galat.terakhir };

    if (!opsi.paksa) {
      if (!dalamJendela(sekarang, p)) {
        if (k.status === "berjalan") {
          k.status = "jeda";
          await tulisJejak(db, KUNCI_JEJAK.mediasiRiwayat, k, iso);
        }
        return { alasan: "luar-jendela", status: k.status };
      }
      const jedaMs = k.galat.beruntun > 0 ? jedaSesudahGalatMs(p.jedaDetik, k.galat.beruntun) : p.jedaDetik * 1000;
      const terakhirMs = k.putaranTerakhir ? Date.parse(k.putaranTerakhir) || 0 : 0;
      if (terakhirMs && sekarang.getTime() - terakhirMs < jedaMs) return { alasan: "menunggu-jeda", status: k.status };
    }

    let diproses = 0;
    let ditulis = 0;
    try {
      if (k.status === "belum") {
        const ring = await deps.bot.ringkasan();
        if (!ring.ok) throw new Error(ring.error);
        const m = ring.data.mediasi;
        if (m === undefined) throw new Error("ALETA Bot belum mendukung pemindaian riwayat mediasi - bot perlu dibangun ulang.");
        if (m === null) throw new Error("Jadwal mediasi tidak terbaca dari SIPP (tabel atau kolom tidak dikenal).");
        k.awal = m.awal;
        k.akhir = m.akhir;
        k.kursor = m.awal;
        k.total = m.jumlah;
        k.diproses = 0;
        k.mulaiPada = iso;
        k.lebarHari = LEBAR_RIWAYAT_MEDIASI_BAWAAN;
        k.peringatan = [];
        if (m.jumlah === 0 || !m.awal || !m.akhir) {
          // Tidak ada jadwal mediasi di SIPP: tidak ada yang dibaca; riwayat dianggap lengkap (kosong).
          k.status = "selesai";
          k.selesaiPada = iso;
          k.selesaiAwal = "";
          k.selesaiAkhir = "";
          k.kursor = "";
          k.galat.beruntun = 0;
          k.putaranTerakhir = iso;
          await tulisJejak(db, KUNCI_JEJAK.mediasiRiwayat, k, iso);
          return { alasan: "ok", status: k.status, diproses: 0, ditulis: 0 };
        }
      }
      k.status = "berjalan";

      const dari = k.kursor;
      const ujung = tambahHari(dari, Math.max(1, k.lebarHari) - 1);
      const sampai = ujung > k.akhir ? k.akhir : ujung;
      const r = await deps.bot.mediasi(dari, sampai);
      if (!r.ok) throw new Error(r.error);
      if (!r.data.terbaca) throw new Error(r.data.alasan || "jadwal mediasi tidak terbaca dari SIPP");
      if (r.data.terpotong && k.lebarHari > 1 && sampai > dari) {
        // Terlalu padat: kecilkan dan ulangi tanpa maju. Tidak ada baris yang hilang diam-diam.
        k.lebarHari = Math.max(1, Math.floor(k.lebarHari / 2));
      } else {
        if (r.data.terpotong) {
          k.peringatan = [...k.peringatan, `${dari}: sehari penuh mencapai batas baris bot (pertemuan mungkin kurang).`].slice(-20);
        }
        // Yang ada di rentang ini tetapi tidak lagi di SIPP ditandai terhapus - kecuali bacaan terpotong.
        const g = await gantiMediasiRentang(db, dari, sampai, r.data.mediasi, { hapus: !r.data.terpotong, sekarang: iso });
        k.kursor = tambahHari(sampai, 1);
        k.diproses += r.data.mediasi.length;
        diproses = r.data.mediasi.length;
        ditulis = g.ditulis;
        k.lebarHari = Math.min(LEBAR_RIWAYAT_MEDIASI_BAWAAN, k.lebarHari * 2);
        if (k.kursor > k.akhir) {
          k.status = "selesai";
          k.selesaiPada = iso;
          k.selesaiAwal = k.awal;
          k.selesaiAkhir = k.akhir;
        }
      }
      k.galat.beruntun = 0;
    } catch (galat) {
      const pesan = galat instanceof Error ? galat.message : "riwayat mediasi gagal";
      k.galat = { terakhir: pesan.slice(0, 300), pada: iso, beruntun: k.galat.beruntun + 1 };
      k.status = k.galat.beruntun >= GALAT_BERUNTUN_MAKS ? "galat" : k.status === "belum" ? "belum" : "berjalan";
      k.putaranTerakhir = iso;
      await tulisJejak(db, KUNCI_JEJAK.mediasiRiwayat, k, iso);
      return { alasan: "galat", status: k.status, pesan };
    }
    k.putaranTerakhir = iso;
    await tulisJejak(db, KUNCI_JEJAK.mediasiRiwayat, k, iso);
    return { alasan: "ok", status: k.status, diproses, ditulis };
  } catch (galat) {
    return { alasan: "galat", pesan: galat instanceof Error ? galat.message : "riwayat mediasi gagal" };
  } finally {
    w.jalan = false;
  }
}
