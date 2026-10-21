import {
  KALIMAT_LEWATI,
  SETELAN_BAWAAN,
  bersihkanSetelan,
  jamPemicuHari,
  jatuhTempo,
  nilaiAktif,
  putuskanTundaOtomatis,
  type KeputusanTundaOtomatis,
  type MasukanTundaOtomatis,
  type SetelanTundaOtomatis,
} from "@/lib/tunda-otomatis";
import type { KontakPihak, MediasiRiwayat, RencanaKalender, SidangRiwayat } from "@/lib/bawaan-tunda";
import { hariLibur as tanggalLibur, petaLiburBerlaku, type PetaLibur } from "@/lib/hari-libur";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import type { AletaDatabase } from "@/server/db/client";
import { getGatewayJadwalSidang, postGatewayTundaSidang } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { bacaHariLibur } from "@/server/modules/hari-libur/sumber";

/**
 * ============================================================================
 * TUNDA OTOMATIS 16.30 - PENGUMPUL BAHAN, DAFTAR HARIAN, PENJADWAL, PENULIS
 * ============================================================================
 *
 * Aturannya di @/lib/tunda-otomatis (murni, diuji). Modul ini:
 *
 *   - SETELAN di aleta_ekstensi_setelan (pengguna '*sistem*', kunci
 *     'sistem:tunda-otomatis') - tanpa migrasi, pola yang sama dengan hari
 *     libur. Bawaan: MATI, mode kering. Hanya Super Admin yang mengubahnya
 *     (ditegakkan rute).
 *   - DAFTAR HARIAN di kunci 'sistem:tunda-otomatis:hari:YYYY-MM-DD': tanda
 *     "jangan tunda otomatis" per jadwal (sebelum jam pemicu), lalu hasil jalan
 *     yang dibekukan pada jam pemicu (apa yang ditunda/akan ditunda, ke tanggal
 *     berapa, aturan mana, alasannya, hasil tulisnya).
 *   - BAHAN tiap sidang lewat bot (rute /tunda-otomatis/bahan - hanya membaca).
 *   - MENULIS hanya lewat PENULIS TUNDA YANG SUDAH ADA: rute bot /sidang/tunda
 *     (sidangHasilAlur -> susunRencanaTunda atas akun PP perkara), dengan
 *     `otomatis: true` (penjaga dibaca ulang sesaat sebelum menulis) dan
 *     `jamKerja: "antrekan"` (di luar jam kerja diantrekan ke jam kerja
 *     berikutnya oleh antreanTulisSippService). Mode kering mengirim
 *     `kering: true`: bot menyusun rencananya (akun PP, hari libur, tanggal)
 *     TANPA menulis.
 *   - GUGUR / TIDAK DAPAT DITERIMA tidak pernah ditulis ke SIPP: SIPP hanya
 *     menyimpan hasil itu sebagai "putus ..." (alasan_ditunda lewat borang
 *     Edit Jadwal / Putusan Akhir), yaitu catatan putusan - wewenang majelis.
 *     Keduanya menjadi USULAN di daftar ini + pemberitahuan hakim/PP.
 *   - PENJADWAL: detak 5 menit (instrumentation.ts); jam pemicu 16.30 WITA,
 *     14.00 pada hari sidang keliling aktif (jamTundaOtomatis); satu jalan
 *     terjadwal per tanggal.
 */

const teks = (x: unknown) => String(x ?? "").trim();
const PENGGUNA_SISTEM = "*sistem*";
export const KUNCI_SETELAN = "sistem:tunda-otomatis";
export const kunciHari = (tanggal: string) => `sistem:tunda-otomatis:hari:${tanggal}`;
/** Batas sidang per jalan - satu sore tidak boleh menahan jembatan bot terlalu lama. */
const BATAS_SIDANG = 120;
const UMUR_PRATINJAU_MS = 3 * 60 * 1000;
const TIMEOUT_TULIS_MS = 45_000;

// ============================================================================
// BENTUK
// ============================================================================

export type HasilTulis = {
  status: "kering-lolos" | "kering-ditolak" | "diantrekan" | "tertulis" | "ditolak" | "gagal" | "dibatalkan" | "dilewati";
  pesan: string;
  /** Akun SIPP (PP) atas nama siapa tulisan itu tercatat / akan tercatat. */
  atasNama?: string;
  dikerjakanPada?: string;
  pada: string;
};

export type ButirTundaOtomatis = {
  jadwalId: string;
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalSidang: string;
  agenda: string;
  majelis: string;
  panitera: string;
  keliling: boolean;
  keputusan: KeputusanTundaOtomatis;
  tulis?: HasilTulis;
};

export type JalanHari = {
  pada: string;
  pemicu: "jadwal" | "tangan";
  oleh: string;
  /** Mode saklar saat jalan. */
  mode: "kering" | "tulis";
  jam: string;
  galat: string;
};

export type CatatanHari = {
  tanggal: string;
  batal: Record<string, { oleh: string; nama: string; pada: string }>;
  jalan: JalanHari | null;
  butir: ButirTundaOtomatis[];
};

const CATATAN_KOSONG = (tanggal: string): CatatanHari => ({ tanggal, batal: {}, jalan: null, butir: [] });

// ============================================================================
// SIMPANAN (aleta_ekstensi_setelan)
// ============================================================================

async function bacaKunci<T>(db: AletaDatabase, kunci: string): Promise<T | null> {
  try {
    const b = await db.queryOne<{ nilai: string }>("SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?", [
      PENGGUNA_SISTEM,
      kunci,
    ]);
    return b ? (JSON.parse(String(b.nilai)) as T) : null;
  } catch {
    return null;
  }
}

async function tulisKunci(db: AletaDatabase, kunci: string, nilai: unknown) {
  const sekarang = new Date().toISOString();
  const isi = JSON.stringify(nilai);
  const ada = await db.queryOne<{ kunci: string }>("SELECT kunci FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?", [
    PENGGUNA_SISTEM,
    kunci,
  ]);
  if (ada) {
    await db.run("UPDATE aleta_ekstensi_setelan SET nilai = ?, diubah_pada = ? WHERE pengguna_id = ? AND kunci = ?", [isi, sekarang, PENGGUNA_SISTEM, kunci]);
  } else {
    await db.run("INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?)", [PENGGUNA_SISTEM, kunci, isi, sekarang]);
  }
}

export async function bacaSetelan(db: AletaDatabase): Promise<SetelanTundaOtomatis> {
  return bersihkanSetelan((await bacaKunci(db, KUNCI_SETELAN)) ?? SETELAN_BAWAAN);
}

/** Hanya dipanggil rute yang sudah memastikan Super Admin. */
export async function simpanSetelan(
  db: AletaDatabase,
  aktor: { id: string; name?: string | null },
  badan: Record<string, unknown>,
  ip: string
): Promise<SetelanTundaOtomatis> {
  const lama = await bacaSetelan(db);
  const baru = bersihkanSetelan({
    nyala: typeof badan.nyala === "boolean" ? badan.nyala : lama.nyala,
    kering: typeof badan.kering === "boolean" ? badan.kering : lama.kering,
    jam: badan.jam ?? lama.jam,
    diubahOleh: teks(aktor.name) || aktor.id,
    diubahPada: new Date().toISOString(),
    // Alamat peramban Super Admin saat menyimpan: alamat audit tulisan otomatis
    // (sama dengan Jadwalkan Putusan yang memakai alamat penjadwal).
    ip: /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) ? ip : lama.ip,
  });
  await tulisKunci(db, KUNCI_SETELAN, baru);
  return baru;
}

export async function bacaCatatanHari(db: AletaDatabase, tanggal: string): Promise<CatatanHari> {
  const c = await bacaKunci<Partial<CatatanHari>>(db, kunciHari(tanggal));
  if (!c) return CATATAN_KOSONG(tanggal);
  return {
    tanggal,
    batal: c.batal && typeof c.batal === "object" ? c.batal : {},
    jalan: c.jalan ?? null,
    butir: Array.isArray(c.butir) ? c.butir : [],
  };
}

async function simpanCatatanHari(db: AletaDatabase, c: CatatanHari) {
  await tulisKunci(db, kunciHari(c.tanggal), c);
}

// ============================================================================
// JAM PEMICU (16.30, atau 14.00 pada hari sidang keliling aktif)
// ============================================================================

/**
 * Hari sidang keliling aktif? Tabel aleta_sidang_keliling_hari dibangun fitur
 * saklar Sidang keliling (migrasi 0083). Tabel/baris yang belum ada = tidak.
 */
export async function kelilingAktif(db: AletaDatabase, tanggal: string): Promise<boolean> {
  try {
    const b = await db.queryOne<{ aktif: unknown }>("SELECT aktif FROM aleta_sidang_keliling_hari WHERE tanggal = ?", [tanggal]);
    return b ? nilaiAktif(b.aktif) : false;
  } catch {
    return false;
  }
}

/** Jam pemicu tunda otomatis untuk tanggal itu ("HH:MM" WITA). */
export async function jamTundaOtomatis(db: AletaDatabase, tanggal: string, setelan?: SetelanTundaOtomatis): Promise<string> {
  const s = setelan ?? (await bacaSetelan(db));
  return jamPemicuHari(s, await kelilingAktif(db, tanggal));
}

// ============================================================================
// SUMBER BAHAN (dapat disuntik untuk uji)
// ============================================================================

type BarisJadwal = {
  sidangId: string;
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  alurPerkaraId?: number;
  tanggalSidang: string;
  agenda: string;
  ditunda: boolean;
  alasanDitunda: string;
  sudahPutus: boolean;
  sidangIkrarTalak: boolean;
  majelisNama?: string;
  paniteraNama?: string;
};

export type BahanSidang = {
  ok: boolean;
  alasan?: string;
  keadaan?: Record<string, unknown>;
  riwayat?: { sidang?: SidangRiwayat[]; mediasi?: MediasiRiwayat } | null;
  antrian?: { hadirPihak1?: boolean; hadirPihak2?: boolean; keadaan?: string } | null;
  atasNama?: { ok?: boolean; username?: string; namaLengkap?: string; pesan?: string } | null;
  kalender?: RencanaKalender[] | null;
  kontak?: KontakPihak | null;
  kunci?: { aktif?: boolean; tidakTerbaca?: boolean } | null;
  kelilingBerikut?: string[] | null;
};

export type SumberTundaOtomatis = {
  jadwal(tanggal: string): Promise<{ ok: boolean; sidang: BarisJadwal[]; galat: string }>;
  bahan(jadwalId: string): Promise<BahanSidang>;
  tulis(isi: Record<string, unknown>): Promise<{ ok: boolean; data?: Record<string, unknown>; galat?: string; kode?: string }>;
  antrean(sejak: string): Promise<Array<{ kunci: string; status: string; hasil?: string; jadwal?: string; kalimat?: string }>>;
  batalAntrean(jadwalId: string): Promise<{ ok: boolean; alasan?: string }>;
  libur(db: AletaDatabase): Promise<PetaLibur>;
};

export const SUMBER_BAWAAN: SumberTundaOtomatis = {
  async jadwal(tanggal) {
    const h = await getGatewayJadwalSidang({ dari: tanggal, sampai: tanggal, cari: "", batas: 400 });
    if (!h.ok) return { ok: false, sidang: [], galat: teks(h.error) || "ALETA Bot tidak menjawab." };
    return { ok: true, sidang: (h.data?.sidang ?? []) as unknown as BarisJadwal[], galat: "" };
  },
  async bahan(jadwalId) {
    const h = await panggilBotJadwalSidang<BahanSidang>(`/tunda-otomatis/bahan?${new URLSearchParams({ jadwalId }).toString()}`, { timeoutMs: 20000 });
    return h.ok ? h.data : { ok: false, alasan: h.error };
  },
  async tulis(isi) {
    const h = await postGatewayTundaSidang(isi, { timeoutMs: TIMEOUT_TULIS_MS });
    return h.ok ? { ok: true, data: h.data } : { ok: false, galat: h.error, kode: h.kode, data: h.badan };
  },
  async antrean(sejak) {
    const h = await panggilBotJadwalSidang<{ baris?: Array<{ kunci: string; status: string; hasil?: string; jadwal?: string; kalimat?: string }> }>(
      `/tunda-otomatis/antrean?${new URLSearchParams({ sejak }).toString()}`
    );
    return h.ok && Array.isArray(h.data.baris) ? h.data.baris : [];
  },
  async batalAntrean(jadwalId) {
    const h = await panggilBotJadwalSidang<{ ok?: boolean; alasan?: string }>("/tunda-otomatis/antrean-batal", { method: "POST", body: { jadwalId } });
    return h.ok ? { ok: h.data.ok === true, alasan: teks(h.data.alasan) } : { ok: false, alasan: h.error };
  },
  async libur(db) {
    await bacaHariLibur(db);
    return petaLiburBerlaku();
  },
};

// ============================================================================
// MENYUSUN DAFTAR (tanpa menulis apa pun)
// ============================================================================

const angkaAtauNull = (x: unknown) => (x === null || x === undefined || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));

/** Bahan bot + baris jadwal -> masukan aturan. */
export function masukanDariBahan(
  hariIni: string,
  baris: BarisJadwal,
  bahan: BahanSidang | null,
  batal: CatatanHari["batal"][string] | undefined
): MasukanTundaOtomatis {
  const k = (bahan?.keadaan ?? {}) as Record<string, unknown>;
  return {
    hariIni,
    jadwalId: Number(baris.sidangId),
    perkaraId: baris.perkaraId,
    nomorPerkara: teks(k.nomorPerkara) || baris.nomorPerkara,
    jenisPerkara: teks(k.jenisPerkara) || baris.jenisPerkara,
    alurPerkaraId: angkaAtauNull(k.alurPerkaraId ?? baris.alurPerkaraId),
    jenisPerkaraId: angkaAtauNull(k.jenisPerkaraId),
    tanggalSidang: teks(k.tanggalSidang || baris.tanggalSidang).slice(0, 10),
    agenda: teks(k.agenda ?? baris.agenda),
    ditunda: bahan?.keadaan ? teks(k.ditunda).toUpperCase() === "Y" : baris.ditunda === true,
    alasanDitunda: bahan?.keadaan ? teks(k.alasanDitunda) : teks(baris.alasanDitunda),
    sudahPutus: baris.sudahPutus === true || /^\d{4}-\d{2}-\d{2}/.test(teks(k.tanggalPutusan)),
    ikrar: baris.sidangIkrarTalak === true || teks(k.ikrarTalak).toUpperCase() === "Y",
    verzet: teks(k.verzet).toUpperCase() === "Y",
    sidangKeliling: teks(k.sidangKeliling).toUpperCase() === "Y",
    ruangan: teks(k.ruangan),
    dihadiriOlehSekarang: angkaAtauNull(k.dihadiriOleh),
    antrian: bahan?.antrian ? { hadirPihak1: bahan.antrian.hadirPihak1 === true, hadirPihak2: bahan.antrian.hadirPihak2 === true, keadaan: teks(bahan.antrian.keadaan) } : null,
    riwayat: bahan?.ok && Array.isArray(bahan.riwayat?.sidang) ? bahan.riwayat!.sidang! : null,
    mediasi: bahan?.riwayat?.mediasi ?? null,
    kalender: bahan?.ok && Array.isArray(bahan.kalender) ? bahan.kalender : null,
    kontak: bahan?.kontak ?? null,
    kelilingBerikut: Array.isArray(bahan?.kelilingBerikut) ? bahan!.kelilingBerikut! : null,
    sedangDikerjakan: Boolean(bahan?.kunci?.aktif || bahan?.kunci?.tidakTerbaca),
    ppJelas: bahan?.atasNama ? bahan.atasNama.ok === true : undefined,
    dibatalkan: batal ? { oleh: batal.nama || batal.oleh, pada: batal.pada } : null,
  };
}

/** Sidang yang dapat diputuskan tanpa membaca bahan (sudah selesai/ikrar). */
function cukupDariBaris(b: BarisJadwal): boolean {
  const alasan = teks(b.alasanDitunda);
  return b.ditunda === true || b.sudahPutus === true || b.sidangIkrarTalak === true || (alasan !== "" && alasan !== "0");
}

export async function susunDaftar(
  db: AletaDatabase,
  opsi: { tanggal: string; sumber?: SumberTundaOtomatis; batal?: CatatanHari["batal"] }
): Promise<{ butir: ButirTundaOtomatis[]; galat: string; atasNama: Record<string, string> }> {
  const sumber = opsi.sumber ?? SUMBER_BAWAAN;
  const tanggal = opsi.tanggal;
  const batal = opsi.batal ?? {};
  const j = await sumber.jadwal(tanggal);
  if (!j.ok) return { butir: [], galat: `Jadwal sidang tidak terbaca: ${j.galat}`, atasNama: {} };
  const peta = await sumber.libur(db).catch(() => petaLiburBerlaku());
  const butir: ButirTundaOtomatis[] = [];
  const atasNama: Record<string, string> = {};
  const lihat = new Set<string>();
  for (const b of j.sidang) {
    if (teks(b.tanggalSidang).slice(0, 10) !== tanggal) continue;
    const id = teks(b.sidangId);
    if (!id || lihat.has(id)) continue;
    lihat.add(id);
    if (butir.length >= BATAS_SIDANG) break;
    let bahan: BahanSidang | null = null;
    if (!cukupDariBaris(b) && !batal[id]) {
      try {
        bahan = await sumber.bahan(id);
      } catch (e) {
        bahan = { ok: false, alasan: teks((e as Error)?.message) };
      }
    }
    const m = masukanDariBahan(tanggal, b, bahan, batal[id]);
    const keputusan = putuskanTundaOtomatis(m, peta);
    if (bahan?.atasNama?.ok && bahan.atasNama.namaLengkap) atasNama[id] = teks(bahan.atasNama.namaLengkap);
    butir.push({
      jadwalId: id,
      perkaraId: teks(b.perkaraId),
      nomorPerkara: m.nomorPerkara,
      jenisPerkara: teks(m.jenisPerkara),
      tanggalSidang: tanggal,
      agenda: m.agenda,
      majelis: teks(b.majelisNama),
      panitera: teks(b.paniteraNama),
      keliling: Boolean(m.sidangKeliling),
      keputusan,
    });
  }
  return { butir, galat: "", atasNama };
}

// ============================================================================
// PRATINJAU (sebelum jam pemicu) DAN DAFTAR HARI
// ============================================================================

const SIMPAN = globalThis as unknown as {
  __aletaTundaOtomatis?: { berjalan: Set<string>; detak: NodeJS.Timeout | null; pratinjau: Map<string, { saat: number; isi: Awaited<ReturnType<typeof susunDaftar>> }> };
};
const wadah = () => (SIMPAN.__aletaTundaOtomatis ??= { berjalan: new Set(), detak: null, pratinjau: new Map() });

export type DaftarHari = {
  tanggal: string;
  setelan: SetelanTundaOtomatis;
  jamPemicu: string;
  kelilingAktif: boolean;
  /** "pratinjau" = belum jam pemicu (akan ditunda); "jalan" = daftar yang dibekukan pada jam pemicu. */
  tahap: "pratinjau" | "jalan";
  jalan: JalanHari | null;
  butir: ButirTundaOtomatis[];
  galat: string;
  hariLibur: boolean;
};

export async function bacaDaftarHari(
  db: AletaDatabase,
  opsi: { tanggal?: string; sumber?: SumberTundaOtomatis; segarkan?: boolean; kini?: Date } = {}
): Promise<DaftarHari> {
  const sumber = opsi.sumber ?? SUMBER_BAWAAN;
  const tanggal = opsi.tanggal || waktuPengadilan(opsi.kini).tanggal;
  const setelan = await bacaSetelan(db);
  const keliling = await kelilingAktif(db, tanggal);
  const jamPemicu = jamPemicuHari(setelan, keliling);
  const catatan = await bacaCatatanHari(db, tanggal);
  const dasar = { tanggal, setelan, jamPemicu, kelilingAktif: keliling, hariLibur: tanggalLibur(tanggal) };
  if (catatan.jalan) {
    // Status antrean terbaru (diantrekan -> tertulis/gagal/batal) ditimpakan tanpa menyimpan.
    const antrean = await sumber.antrean(tanggal).catch(() => []);
    const peta = new Map(antrean.map((a) => [teks(a.kunci).replace("sidang-tunda:otomatis:", ""), a]));
    const butir = catatan.butir.map((b) => {
      const a = peta.get(b.jadwalId);
      if (!a || !b.tulis || b.tulis.status !== "diantrekan") return b;
      const status: HasilTulis["status"] = a.status === "selesai" ? "tertulis" : a.status === "gagal" ? "gagal" : a.status === "batal" ? "dibatalkan" : "diantrekan";
      let pesan = b.tulis.pesan;
      if (status !== "diantrekan") {
        try {
          const h = JSON.parse(teks(a.hasil) || "{}") as Record<string, unknown>;
          pesan = teks(h.error || h.pesan || h.alasan) || (status === "tertulis" ? "Tertulis di SIPP." : pesan);
        } catch {
          /* hasil antrean bukan JSON - pesan lama tetap */
        }
      }
      return { ...b, tulis: { ...b.tulis, status, pesan: status === "tertulis" ? "Tertulis di SIPP." : pesan, dikerjakanPada: teks(a.jadwal) || b.tulis.dikerjakanPada } };
    });
    return { ...dasar, tahap: "jalan", jalan: catatan.jalan, butir, galat: catatan.jalan.galat };
  }
  const w = wadah();
  const singgah = w.pratinjau.get(tanggal);
  let isi: Awaited<ReturnType<typeof susunDaftar>> | null = singgah && !opsi.segarkan && Date.now() - singgah.saat < UMUR_PRATINJAU_MS ? singgah.isi : null;
  if (!isi) {
    isi = await susunDaftar(db, { tanggal, sumber, batal: catatan.batal });
    w.pratinjau.set(tanggal, { saat: Date.now(), isi });
  }
  // Tanda "jangan tunda otomatis" terbaru tetap berlaku walau pratinjau dari singgahan.
  const butir = isi.butir.map((b): ButirTundaOtomatis =>
    catatan.batal[b.jadwalId] && b.keputusan.jenis !== "lewati"
      ? { ...b, keputusan: { jenis: "lewati" as const, sebab: "dibatalkan-petugas" as const, penjelasan: `${KALIMAT_LEWATI["dibatalkan-petugas"]} Oleh ${catatan.batal[b.jadwalId].nama || catatan.batal[b.jadwalId].oleh}.` } }
      : b
  );
  return { ...dasar, tahap: "pratinjau", jalan: null, butir, galat: isi.galat };
}

// ============================================================================
// "JANGAN TUNDA OTOMATIS" PER PERKARA
// ============================================================================

export async function tandaiBatal(
  db: AletaDatabase,
  opsi: { tanggal: string; jadwalId: string; oleh: string; nama: string; batal: boolean; sumber?: SumberTundaOtomatis }
): Promise<{ ok: boolean; pesan: string }> {
  const sumber = opsi.sumber ?? SUMBER_BAWAAN;
  const jadwalId = teks(opsi.jadwalId).replace(/\D/g, "");
  if (!jadwalId) return { ok: false, pesan: "Nomor jadwal sidang tidak sah." };
  const c = await bacaCatatanHari(db, opsi.tanggal);
  if (opsi.batal) c.batal[jadwalId] = { oleh: opsi.oleh, nama: opsi.nama, pada: new Date().toISOString() };
  else delete c.batal[jadwalId];
  let pesan = opsi.batal ? "Perkara ini tidak akan ditunda otomatis hari ini." : "Tanda dicabut - perkara ini kembali mengikuti tunda otomatis.";
  if (c.jalan) {
    const b = c.butir.find((x) => x.jadwalId === jadwalId);
    if (opsi.batal && b?.tulis?.status === "diantrekan") {
      const r = await sumber.batalAntrean(jadwalId);
      b.tulis = { ...b.tulis, status: r.ok ? "dibatalkan" : b.tulis.status, pesan: r.ok ? `Dibatalkan oleh ${opsi.nama || opsi.oleh} sebelum ditulis.` : b.tulis.pesan, pada: new Date().toISOString() };
      pesan = r.ok ? "Tundaan otomatis yang diantrekan dibatalkan - tidak ada yang ditulis ke SIPP." : `Tidak dapat dibatalkan (${r.alasan || "sudah dikerjakan"}). Periksa jadwal sidang di SIPP.`;
    } else if (opsi.batal && b?.tulis?.status === "tertulis") {
      pesan = "Tundaan ini SUDAH tertulis di SIPP - ubah lewat SIPP/Jadwal Sidang bila perlu.";
    } else if (!opsi.batal) {
      pesan = "Tanda dicabut. Daftar hari ini sudah dijalankan, jadi perkara ini tidak ditunda otomatis lagi hari ini.";
    }
  }
  await simpanCatatanHari(db, c);
  wadah().pratinjau.delete(opsi.tanggal);
  return { ok: true, pesan };
}

// ============================================================================
// SATU JALAN (jam pemicu)
// ============================================================================

function hasilDariTulis(r: Awaited<ReturnType<SumberTundaOtomatis["tulis"]>>, kering: boolean): HasilTulis {
  const pada = new Date().toISOString();
  const d = (r.data ?? {}) as Record<string, unknown>;
  const atas = d.atasNama && typeof d.atasNama === "object" ? teks((d.atasNama as Record<string, unknown>).namaLengkap || (d.atasNama as Record<string, unknown>).username) : "";
  if (!r.ok) {
    return { status: kering ? "kering-ditolak" : "ditolak", pesan: teks(r.galat) || "Ditolak.", atasNama: atas, pada };
  }
  if (kering) return { status: "kering-lolos", pesan: "Mode kering: rencana tunda lolos pemeriksaan, TIDAK ditulis ke SIPP.", atasNama: atas, pada };
  if (d.diantrekan === true) {
    return { status: "diantrekan", pesan: teks(d.kalimat || d.pesan) || "Diantrekan ke jam kerja berikutnya.", atasNama: atas, dikerjakanPada: teks(d.dikerjakanPada), pada };
  }
  return { status: "tertulis", pesan: "Tertulis di SIPP.", atasNama: atas, pada };
}

export async function jalankanTundaOtomatis(
  db: AletaDatabase,
  opsi: { pemicu: "jadwal" | "tangan"; oleh?: string; tanggal?: string; sumber?: SumberTundaOtomatis; kini?: Date } = { pemicu: "jadwal" }
): Promise<CatatanHari> {
  const w = wadah();
  const sumber = opsi.sumber ?? SUMBER_BAWAAN;
  const tanggal = opsi.tanggal || waktuPengadilan(opsi.kini).tanggal;
  const setelan = await bacaSetelan(db);
  const c = await bacaCatatanHari(db, tanggal);
  if (w.berjalan.has(tanggal)) return { ...c, jalan: c.jalan ?? { pada: new Date().toISOString(), pemicu: opsi.pemicu, oleh: teks(opsi.oleh), mode: setelan.kering ? "kering" : "tulis", jam: "", galat: "Tunda otomatis sedang berjalan." } };
  // Satu jalan per tanggal - jam 14.00 dan 16.30 tidak pernah menjalankannya dua kali.
  if (c.jalan) return c;
  w.berjalan.add(tanggal);
  try {
    const jam = await jamTundaOtomatis(db, tanggal, setelan);
    const mode: JalanHari["mode"] = setelan.kering ? "kering" : "tulis";
    // Penanda jalan DITULIS LEBIH DULU: proses yang mati di tengah tidak mengulang esok detaknya.
    c.jalan = { pada: new Date().toISOString(), pemicu: opsi.pemicu, oleh: teks(opsi.oleh) || "Tunda otomatis", mode, jam, galat: "" };
    await simpanCatatanHari(db, c);
    const daftar = await susunDaftar(db, { tanggal, sumber, batal: c.batal });
    c.butir = daftar.butir;
    c.jalan.galat = daftar.galat;
    await simpanCatatanHari(db, c);
    for (const b of c.butir) {
      if (b.keputusan.jenis !== "tunda") continue;
      const k = b.keputusan;
      const r = await sumber
        .tulis({
          jadwalId: b.jadwalId,
          perkaraId: b.perkaraId,
          alasanTunda: k.alasan,
          tanggalBerikut: k.tanggal,
          jamBerikut: k.jam,
          agendaBerikut: k.agenda,
          dihadiriOleh: k.kehadiran,
          // Penekan untuk jejak ALETA saja (bukan SIPP): siapa yang menyalakan saklarnya.
          operator: "tunda-otomatis",
          operatorNama: `Tunda otomatis ${jam} - saklar oleh ${setelan.diubahOleh || "Super Admin"}`,
          operatorAkunSipp: "",
          ip: setelan.ip,
          kering: setelan.kering,
          otomatis: true,
          tanggalSidangHarap: tanggal,
          jamKerja: "antrekan",
        })
        .catch((e) => ({ ok: false as const, galat: teks((e as Error)?.message) || "ALETA Bot tidak menjawab." }));
      b.tulis = hasilDariTulis(r, setelan.kering);
      await simpanCatatanHari(db, c);
    }
    for (const b of c.butir) {
      if (b.keputusan.jenis === "gugur" || b.keputusan.jenis === "tidak-dapat-diterima") {
        b.tulis = { status: "dilewati", pesan: "Usulan putusan - TIDAK ditulis ke SIPP; disahkan majelis lewat Putusan Otomatis atau tombol Putus.", pada: new Date().toISOString() };
      }
    }
    await simpanCatatanHari(db, c);
  } catch (e) {
    if (c.jalan) {
      c.jalan.galat = teks((e as Error)?.message).slice(0, 300) || "Tunda otomatis gagal.";
      await simpanCatatanHari(db, c).catch(() => undefined);
    }
  } finally {
    w.berjalan.delete(tanggal);
    w.pratinjau.delete(tanggal);
  }
  return c;
}

// ============================================================================
// PENJADWAL
// ============================================================================

export async function detakTundaOtomatis(db: AletaDatabase, opsi: { kini?: Date; sumber?: SumberTundaOtomatis; env?: Record<string, string | undefined> } = {}) {
  const env = opsi.env ?? process.env;
  if (env.ALETA_TUNDA_OTOMATIS === "0") return null;
  const setelan = await bacaSetelan(db);
  // Saklar MATI (bawaan) = tidak ada jalan, tidak ada catatan.
  if (!setelan.nyala) return null;
  const { tanggal, jam } = waktuPengadilan(opsi.kini);
  await bacaHariLibur(db).catch(() => undefined);
  if (tanggalLibur(tanggal)) return null;
  const c = await bacaCatatanHari(db, tanggal);
  const pemicu = await jamTundaOtomatis(db, tanggal, setelan);
  if (!jatuhTempo(pemicu, jam, Boolean(c.jalan))) return null;
  return jalankanTundaOtomatis(db, { pemicu: "jadwal", tanggal, sumber: opsi.sumber, kini: opsi.kini });
}

/** Dinyalakan instrumentation.ts: detak 5 menit. Matikan dengan ALETA_TUNDA_OTOMATIS=0 (atau saklarnya). */
export function mulaiTundaOtomatisBerkala(getDb: () => Promise<AletaDatabase>, env: Record<string, string | undefined> = process.env) {
  if (env.ALETA_TUNDA_OTOMATIS === "0") return;
  const w = wadah();
  if (w.detak) return;
  const detak = async () => {
    try {
      await detakTundaOtomatis(await getDb(), { env });
    } catch (e) {
      console.error("[TUNDA OTOMATIS] detak gagal:", e);
    }
  };
  w.detak = setInterval(() => void detak(), 5 * 60 * 1000);
  setTimeout(() => void detak(), 90 * 1000);
}

// ============================================================================
// PEMBERITAHUAN (sumber tugas portal /api/tasks)
// ============================================================================

export type PemberitahuanTunda = { id: string; judul: string; uraian: string; waktu: string; penting: boolean };

/**
 * Pemberitahuan hasil jalan hari ini untuk satu akun: usulan GUGUR/TIDAK DAPAT
 * DITERIMA (penting) dan tundaan otomatis pada perkara yang majelis/PP-nya
 * akun itu. Admin/Super Admin: satu ringkasan. Hanya membaca basis data ALETA.
 */
export async function pemberitahuanTundaOtomatis(
  db: AletaDatabase,
  opsi: { nama: string; lihatSemua: boolean; cocokNama: (nama: string, baris: string) => boolean; kini?: Date }
): Promise<PemberitahuanTunda[]> {
  const tanggal = waktuPengadilan(opsi.kini).tanggal;
  const c = await bacaCatatanHari(db, tanggal);
  if (!c.jalan) return [];
  const hasil: PemberitahuanTunda[] = [];
  const kering = c.jalan.mode === "kering";
  const milik = (b: ButirTundaOtomatis) => opsi.cocokNama(opsi.nama, b.majelis) || opsi.cocokNama(opsi.nama, b.panitera);
  for (const b of c.butir) {
    const k = b.keputusan;
    if (k.jenis === "lewati") continue;
    if (!milik(b)) continue;
    if (k.jenis === "tunda") {
      hasil.push({
        id: `tunda-otomatis:${tanggal}:${b.jadwalId}`,
        judul: `${kering ? "Mode kering - akan ditunda" : "Ditunda otomatis"}: ${b.nomorPerkara} ke ${k.tanggal}`,
        uraian: `${k.penjelasan} ${b.tulis ? b.tulis.pesan : ""}`.trim(),
        waktu: c.jalan.pada,
        penting: false,
      });
    } else {
      hasil.push({
        id: `tunda-otomatis:${tanggal}:${b.jadwalId}`,
        judul: `Usulan putusan ${k.usulanStatus}: ${b.nomorPerkara}`,
        uraian: `${k.penjelasan} Tidak ada yang ditulis ke SIPP.`,
        waktu: c.jalan.pada,
        penting: true,
      });
    }
  }
  if (opsi.lihatSemua && hasil.length === 0) {
    const tunda = c.butir.filter((b) => b.keputusan.jenis === "tunda").length;
    const usul = c.butir.filter((b) => b.keputusan.jenis === "gugur" || b.keputusan.jenis === "tidak-dapat-diterima").length;
    if (tunda + usul > 0) {
      hasil.push({
        id: `tunda-otomatis:${tanggal}:ringkasan`,
        judul: `Tunda otomatis ${c.jalan.jam.replace(":", ".")}${kering ? " (mode kering)" : ""}: ${tunda} tunda, ${usul} usulan putusan`,
        uraian: "Rinciannya di Jadwal Sidang, bagian Tunda otomatis.",
        waktu: c.jalan.pada,
        penting: usul > 0,
      });
    }
  }
  return hasil;
}
