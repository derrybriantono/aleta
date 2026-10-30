import { drafH1Saya, hariKerjaBerikut, sasaranH1, susunDrafH1, type BarisSidangH1, type DrafH1, type SaksiTanyaJawab } from "@/lib/agen-h1-bas";
import { namaAdaDi } from "@/lib/perkara-sendiri";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getGatewayJadwalSidang } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";

/**
 * ============================================================================
 * AGEN H-1 BAS (G2a 2.4) - PENGUMPUL BAHAN, SIMPANAN, PENJADWAL SORE
 * ============================================================================
 *
 * Aturannya di @/lib/agen-h1-bas (murni, diuji). Modul ini:
 *   - membaca jadwal sidang hari kerja berikutnya dan tanya jawab saksi ABT lewat jembatan bot - BACA SAJA;
 *   - menyimpan draf DI MEMORI portal (bukan tabel baru: tidak ada migrasi). Draf hanya pilihan blangko + catatan, murah
 *     dihitung ulang; bila portal berdiri ulang sesudah jam jalan, draf disusun lagi saat pertama diminta (siapkanUntuk);
 *   - menjalankan diri sekali tiap sore HARI KERJA (bawaan 15.30 WITA, env ALETA_AGEN_H1_JAM) dari instrumentation.ts;
 *     dimatikan dengan ALETA_AGEN_H1=0. SIPP dan ABT tidak pernah ditulis.
 */

const teks = (x: unknown) => String(x ?? "").trim();
const BATAS_PERKARA = 120;

export type SumberAgenH1 = {
  jadwal(dari: string, sampai: string): Promise<{ ok: boolean; sidang: BarisSidangH1[]; galat: string }>;
  tanyaJawab(perkaraId: string): Promise<SaksiTanyaJawab[]>;
};

export const SUMBER_H1_BAWAAN: SumberAgenH1 = {
  async jadwal(dari, sampai) {
    const h = await getGatewayJadwalSidang({ dari, sampai, cari: "", batas: 400 });
    if (!h.ok) return { ok: false, sidang: [], galat: teks(h.error) || "ALETA Bot tidak menjawab." };
    return { ok: true, sidang: (h.data?.sidang ?? []) as unknown as BarisSidangH1[], galat: "" };
  },
  async tanyaJawab(perkaraId) {
    try {
      const j = await callAletaBotSippBridge<{ saksi?: SaksiTanyaJawab[] }>("case.pemeriksaanSaksi", { perkaraId }, { timeoutMs: 15000 });
      return j.ok && Array.isArray(j.data?.saksi) ? j.data!.saksi! : [];
    } catch {
      return [];
    }
  },
};

// ============================================================================
// SIMPANAN (memori portal)
// ============================================================================

export type JalanAgenH1 = { tanggal: string; untuk: string; pemicu: string; mulai: string; selesai: string; diperiksa: number; disiapkan: number; tanpaBlangko: number; galat: string };

type Wadah = { draf: Map<string, DrafH1>; jalan: JalanAgenH1[]; berjalan: Promise<JalanAgenH1> | null; detak: NodeJS.Timeout | null; terjadwal: string; coba: Map<string, number> };
const SIMPAN = globalThis as unknown as { __aletaAgenH1?: Wadah };
const wadah = (): Wadah => (SIMPAN.__aletaAgenH1 ??= { draf: new Map(), jalan: [], berjalan: null, detak: null, terjadwal: "", coba: new Map() });

/** Untuk uji: kosongkan simpanan. */
export function bersihkanAgenH1() {
  const w = wadah();
  w.draf.clear();
  w.jalan = [];
  w.berjalan = null;
  w.terjadwal = "";
  w.coba.clear();
}

const kunci = (perkaraId: string, tanggal: string) => `${perkaraId}|${tanggal}`;

/** Draf yang tanggal sidangnya sudah lewat dibuang (simpanan memori tidak tumbuh tanpa batas). */
function rapikan(hariIni: string) {
  const w = wadah();
  for (const [k, d] of w.draf) if (d.tanggalSidang < hariIni) w.draf.delete(k);
  if (w.jalan.length > 20) w.jalan = w.jalan.slice(-20);
}

// ============================================================================
// SATU JALAN
// ============================================================================

/**
 * Menyiapkan draf BAS untuk sidang tanggal `untuk` (bawaan: hari kerja sesudah hari ini). Satu jalan pada satu waktu;
 * permintaan kedua menunggu jalan yang sedang berlangsung.
 */
export async function jalankanAgenH1(opsi: { pemicu: "jadwal" | "tangan" | "permintaan"; untuk?: string; hariIni?: string; sumber?: SumberAgenH1; kini?: Date } = { pemicu: "jadwal" }): Promise<JalanAgenH1> {
  const w = wadah();
  if (w.berjalan) return w.berjalan;
  const kini = opsi.kini ?? new Date();
  const hariIni = opsi.hariIni || waktuPengadilan(kini).tanggal;
  const untuk = opsi.untuk || hariKerjaBerikut(hariIni);
  const sumber = opsi.sumber ?? SUMBER_H1_BAWAAN;
  const kerja = (async () => {
    const jalan: JalanAgenH1 = { tanggal: hariIni, untuk, pemicu: opsi.pemicu, mulai: kini.toISOString(), selesai: "", diperiksa: 0, disiapkan: 0, tanpaBlangko: 0, galat: "" };
    try {
      const j = await sumber.jadwal(untuk, untuk);
      if (!j.ok) jalan.galat = `Jadwal sidang tidak terbaca: ${j.galat}`;
      const lihat = new Set<string>();
      for (const b of j.sidang) {
        if (!sasaranH1(b, untuk)) continue;
        const k = kunci(teks(b.perkaraId), untuk);
        if (lihat.has(k)) continue;
        lihat.add(k);
        if (jalan.diperiksa >= BATAS_PERKARA) break;
        jalan.diperiksa += 1;
        const tanyaJawab = /bukti|saksi|pembuktian/i.test(teks(b.agenda)) ? await sumber.tanyaJawab(teks(b.perkaraId)) : [];
        const d = susunDrafH1(b, { tanyaJawab, kini: new Date() });
        w.draf.set(k, d);
        if (d.blangko) jalan.disiapkan += 1;
        else jalan.tanpaBlangko += 1;
      }
    } catch (e) {
      jalan.galat = teks((e as Error)?.message).slice(0, 300) || "Agen H-1 gagal.";
    } finally {
      jalan.selesai = new Date().toISOString();
      w.jalan.push(jalan);
      rapikan(hariIni);
    }
    return jalan;
  })();
  w.berjalan = kerja;
  try {
    return await kerja;
  } finally {
    w.berjalan = null;
  }
}

/** Sudah ada jalan yang menyiapkan tanggal `untuk`? */
const sudahDisiapkan = (untuk: string) => wadah().jalan.some((j) => j.untuk === untuk && !j.galat);
/** Percobaan yang gagal (bot mati) tidak diulang tiap permintaan: paling sering sekali per lima menit per tanggal. */
const JEDA_COBA_MS = 5 * 60 * 1000;
function bolehCoba(untuk: string, kini: Date): boolean {
  const w = wadah();
  const akhir = w.coba.get(untuk) ?? 0;
  if (kini.getTime() - akhir < JEDA_COBA_MS) return false;
  w.coba.set(untuk, kini.getTime());
  return true;
}

/**
 * Draf untuk perkara-perkara ini pada hari ini atau hari kerja berikutnya. Tanggal yang belum pernah disiapkan (portal baru
 * berdiri) disiapkan dulu - hari ini (sidang hari ini) dan hari kerja berikutnya bila sore sudah lewat jam jalan.
 */
export async function bacaDrafH1(perkaraIds: string[], opsi: { kini?: Date; sumber?: SumberAgenH1; env?: Record<string, string | undefined> } = {}): Promise<Record<string, DrafH1>> {
  const kini = opsi.kini ?? new Date();
  const env = opsi.env ?? process.env;
  if (env.ALETA_AGEN_H1 === "0") return {};
  const { tanggal: hariIni, jam } = waktuPengadilan(kini);
  const tanggal = [hariIni];
  if (jam.slice(0, 5) >= jamAgenH1(env)) tanggal.push(hariKerjaBerikut(hariIni));
  for (const t of tanggal) if (t && !sudahDisiapkan(t) && bolehCoba(t, kini)) await jalankanAgenH1({ pemicu: "permintaan", untuk: t, hariIni, sumber: opsi.sumber, kini });
  const ids = new Set(perkaraIds.map(teks).filter(Boolean));
  const hasil: Record<string, DrafH1> = {};
  for (const d of wadah().draf.values()) {
    if (!ids.has(d.perkaraId) || d.tanggalSidang < hariIni) continue;
    const ada = hasil[d.perkaraId];
    if (!ada || d.tanggalSidang < ada.tanggalSidang) hasil[d.perkaraId] = d;
  }
  return hasil;
}

/** Draf milik akun (PP/majelis; admin semua) untuk hari ini dan hari kerja berikutnya - untuk daftar/widget. */
export async function bacaDrafH1Saya(opsi: { nama: string; lihatSemua: boolean; kini?: Date; sumber?: SumberAgenH1; env?: Record<string, string | undefined> }) {
  const kini = opsi.kini ?? new Date();
  await bacaDrafH1([], opsi); // menyiapkan tanggal yang belum disiapkan
  const hariIni = waktuPengadilan(kini).tanggal;
  const daftar = Array.from(wadah().draf.values()).filter((d) => d.tanggalSidang >= hariIni);
  return { hariIni, draf: drafH1Saya(daftar, { nama: opsi.nama, lihatSemua: opsi.lihatSemua, cocokNama: namaAdaDi }), jalanTerakhir: wadah().jalan.slice(-1)[0] ?? null };
}

export function jalanAgenH1Terakhir(): JalanAgenH1[] {
  return wadah().jalan.slice(-10).reverse();
}

// ============================================================================
// PENJADWAL SORE HARI KERJA
// ============================================================================

/** Jam jalan (WITA) dari env ALETA_AGEN_H1_JAM "HH:MM", bawaan 15.30 (sesudah batas unggah e-Court 15.00, sebelum tunda otomatis 16.30). */
export function jamAgenH1(env: Record<string, string | undefined> = process.env): string {
  const j = teks(env.ALETA_AGEN_H1_JAM);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(j) ? j : "15:30";
}

/** Waktunya jalan: hari kerja, sudah lewat jamnya, dan belum dijalankan terjadwal hari ini. Murni atas masukan. */
export function agenH1JatuhTempo(jam: string, kini: Date, sudahHariIni: boolean, hariKerja: boolean): boolean {
  if (sudahHariIni || !hariKerja) return false;
  return waktuPengadilan(kini).jam.slice(0, 5) >= jam;
}

export async function detakAgenH1(env: Record<string, string | undefined> = process.env, kini = new Date(), sumber?: SumberAgenH1) {
  if (env.ALETA_AGEN_H1 === "0") return null;
  const w = wadah();
  const hariIni = waktuPengadilan(kini).tanggal;
  const { sebabLibur } = await import("@/lib/hari-libur");
  if (!agenH1JatuhTempo(jamAgenH1(env), kini, w.terjadwal === hariIni, !sebabLibur(hariIni))) return null;
  w.terjadwal = hariIni;
  return jalankanAgenH1({ pemicu: "jadwal", hariIni, kini, sumber });
}

/** Dinyalakan instrumentation.ts: detak 10 menit, jalan sekali tiap sore hari kerja sesudah jamnya. */
export function mulaiAgenH1Berkala(env: Record<string, string | undefined> = process.env) {
  if (env.ALETA_AGEN_H1 === "0") return;
  const w = wadah();
  if (w.detak) return;
  const detak = async () => {
    try {
      await detakAgenH1(env);
    } catch (e) {
      console.error("[AGEN H-1 BAS] detak gagal:", e);
    }
  };
  w.detak = setInterval(() => void detak(), 10 * 60 * 1000);
  setTimeout(() => void detak(), 3 * 60 * 1000);
}
