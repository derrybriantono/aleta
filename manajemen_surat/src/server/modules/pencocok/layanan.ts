import {
  PETA_JENIS,
  cocokkanPerkara,
  petugasDariFakta,
  ringkasTemuan,
  type BarisTemuan,
  type FaktaPencocok,
  type RingkasanPencocok,
  type Temuan,
  type Terbaca,
  type Tingkat,
} from "@/lib/pencocok-data";
import { pemilikButir } from "@/lib/tenggat-terjadwal";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import type { AletaDatabase } from "@/server/db/client";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { bacaKunci, tulisKunci } from "@/server/modules/tunda-otomatis/layanan";

/**
 * ============================================================================
 * PENCOCOK DATA SIPP - ABT - e-COURT (N3, 1 Nov 2026) - PENJADWAL, PENYIMPANAN, PERIKSA SATU PERKARA
 * ============================================================================
 *
 * Aturan murninya di @/lib/pencocok-data (diuji tanpa basis data); fakta dibacakan bot (HANYA SELECT). Modul ini:
 *
 *   - PUTARAN MALAM: sekali per tanggal pada jam pemicu (bawaan 22.30 WITA, dapat diatur Super Admin), lewat detak
 *     5 menit di instrumentation.ts. Lingkup = perkara yang belum putus + yang putus dalam `hariPutus` hari terakhir,
 *     dibaca per KELOMPOK (bawaan 100 perkara per panggilan bot - tanpa N+1).
 *   - PERIKSA SATU PERKARA (saat perkara dibuka): fakta satu perkara, cache 10 menit di memori; hasilnya ikut
 *     disimpan bila berubah, sehingga layar Pencocok dan panel selalu sejalan.
 *   - PENYIMPANAN: aleta_pencocok_temuan (0129). Baris yang sidik isinya sama TIDAK ditulis ulang; perkara yang
 *     sudah cocok kehilangan barisnya. Penanda waktu `diperiksa_pada` dinaikkan per kelompok (satu UPDATE).
 *   - Catatan putaran dan setelan di aleta_ekstensi_setelan (pengguna '*sistem*'), tanpa tabel tambahan.
 *
 * TIDAK menulis apa pun ke SIPP/ABT/e-Court. Gagal baca sebuah sumber = aturan terkait diam, bukan menuduh beda.
 */

const teks = (x: unknown) => String(x ?? "").trim();

export const KUNCI_SETELAN_PENCOCOK = "sistem:pencocok";
export const KUNCI_CATATAN_PENCOCOK = "sistem:pencocok:catatan";
/** Perkara per panggilan bot. */
export const KELOMPOK_PERKARA = 100;
/** Cache hasil satu perkara di memori (saat perkara dibuka). */
export const UMUR_CACHE_MS = 10 * 60 * 1000;
const BATAS_CACHE = 400;
/** Temuan perkara yang tidak lagi masuk lingkup dibuang bila lebih tua dari ini. */
const SIMPAN_HARI = 30;

// ============================================================================
// SETELAN & CATATAN
// ============================================================================

export type SetelanPencocok = {
  /** Putaran malam. Bawaan MENYALA: hanya membaca, di luar jam kerja. */
  jadwal: boolean;
  /** HH:MM WITA. */
  jam: string;
  /** Perkara yang putus dalam sekian hari terakhir ikut diperiksa (perkara belum putus selalu ikut). */
  hariPutus: number;
  diubahOleh: string;
  diubahPada: string;
};

export const SETELAN_PENCOCOK_BAWAAN: SetelanPencocok = { jadwal: true, jam: "22:30", hariPutus: 180, diubahOleh: "", diubahPada: "" };

export function jamPencocokSah(jam: unknown): string {
  const m = teks(jam).match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return SETELAN_PENCOCOK_BAWAAN.jam;
  const j = Number(m[1]);
  const mm = Number(m[2]);
  if (j > 23 || mm > 59) return SETELAN_PENCOCOK_BAWAAN.jam;
  return `${String(j).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function bersihkanSetelanPencocok(masukan: unknown): SetelanPencocok {
  const m = (masukan && typeof masukan === "object" ? masukan : {}) as Record<string, unknown>;
  const hari = Math.round(Number(m.hariPutus));
  return {
    jadwal: typeof m.jadwal === "boolean" ? m.jadwal : SETELAN_PENCOCOK_BAWAAN.jadwal,
    jam: jamPencocokSah(m.jam),
    hariPutus: Number.isFinite(hari) ? Math.max(30, Math.min(1500, hari)) : SETELAN_PENCOCOK_BAWAAN.hariPutus,
    diubahOleh: teks(m.diubahOleh).slice(0, 120),
    diubahPada: teks(m.diubahPada).slice(0, 40),
  };
}

export async function bacaSetelanPencocok(db: AletaDatabase): Promise<SetelanPencocok> {
  return bersihkanSetelanPencocok((await bacaKunci(db, KUNCI_SETELAN_PENCOCOK)) ?? SETELAN_PENCOCOK_BAWAAN);
}

/** Hanya dipanggil rute yang sudah memastikan Super Admin. */
export async function simpanSetelanPencocok(db: AletaDatabase, aktor: { id: string; name?: string | null }, badan: Record<string, unknown>): Promise<SetelanPencocok> {
  const lama = await bacaSetelanPencocok(db);
  const baru = bersihkanSetelanPencocok({
    jadwal: typeof badan.jadwal === "boolean" ? badan.jadwal : lama.jadwal,
    jam: badan.jam ?? lama.jam,
    hariPutus: badan.hariPutus ?? lama.hariPutus,
    diubahOleh: teks(aktor.name) || aktor.id,
    diubahPada: new Date().toISOString(),
  });
  await tulisKunci(db, KUNCI_SETELAN_PENCOCOK, baru);
  return baru;
}

export type CatatanPencocok = {
  /** Tanggal WITA putaran ini dijalankan. */
  tanggal: string;
  pada: string;
  selesaiPada: string;
  pemicu: "jadwal" | "tangan";
  oleh: string;
  durasiMs: number;
  /** Perkara yang dibaca dan dinilai. */
  diperiksa: number;
  ringkasan: RingkasanPencocok | null;
  /** Sumber yang tidak terbaca pada sebagian kelompok: nama -> jumlah kelompok. */
  gagal: Record<string, number>;
  /** Putaran terhenti karena galat (bot tidak menjawab dsb.). Kosong = selesai. */
  galat: string;
  lengkap: boolean;
};

export async function bacaCatatanPencocok(db: AletaDatabase): Promise<CatatanPencocok | null> {
  const c = await bacaKunci<CatatanPencocok>(db, KUNCI_CATATAN_PENCOCOK);
  return c && typeof c === "object" ? c : null;
}

// ============================================================================
// SUMBER FAKTA (bot) - dapat diganti pada uji
// ============================================================================

export type HasilLingkup = { ok: true; perkaraId: number[]; berikut: number | null } | { ok: false; galat: string };
export type HasilFakta =
  | { ok: true; fakta: Record<string, FaktaPencocok>; terbaca: Terbaca; gagal: Record<string, string> }
  | { ok: false; galat: string };

export type SumberPencocok = {
  lingkup(opsi: { acuan: string; hariPutus: number; setelahId: number }): Promise<HasilLingkup>;
  fakta(perkaraId: string[], acuan: string): Promise<HasilFakta>;
};

export const SUMBER_PENCOCOK_BAWAAN: SumberPencocok = {
  async lingkup({ acuan, hariPutus, setelahId }) {
    const h = await panggilBotJadwalSidang<{ ok?: boolean; perkaraId?: number[]; berikut?: number | null }>(
      `/pencocok/lingkup?acuan=${encodeURIComponent(acuan)}&hariPutus=${hariPutus}&setelahId=${setelahId}&batas=500`,
      { timeoutMs: 60_000 }
    );
    if (!h.ok) return { ok: false, galat: h.error };
    return { ok: true, perkaraId: Array.isArray(h.data.perkaraId) ? h.data.perkaraId : [], berikut: h.data.berikut ?? null };
  },
  async fakta(perkaraId, acuan) {
    const h = await panggilBotJadwalSidang<{ ok?: boolean; alasan?: string; fakta?: Record<string, FaktaPencocok>; terbaca?: Terbaca; gagal?: Record<string, string> }>(
      `/pencocok/fakta?perkaraId=${perkaraId.map(encodeURIComponent).join(",")}&acuan=${encodeURIComponent(acuan)}`,
      { timeoutMs: 120_000 }
    );
    if (!h.ok) return { ok: false, galat: h.error };
    if (h.data.ok === false) return { ok: false, galat: teks(h.data.alasan) || "ALETA Bot menolak permintaan." };
    return { ok: true, fakta: h.data.fakta ?? {}, terbaca: h.data.terbaca ?? {}, gagal: h.data.gagal ?? {} };
  },
};

// ============================================================================
// PENYIMPANAN
// ============================================================================

type BarisSimpan = {
  perkara_id: string;
  jenis: string;
  nomor_perkara: string;
  tingkat: string;
  ringkas: string;
  sisi: string;
  majelis: string;
  panitera: string;
  sidik: string;
  pertama_terlihat: string;
  diperiksa_pada: string;
};

const sebagaiBaris = (r: BarisSimpan): BarisTemuan => {
  let sisi: BarisTemuan["sisi"] = [];
  try {
    const x = JSON.parse(r.sisi);
    if (Array.isArray(x)) sisi = x;
  } catch {
    sisi = [];
  }
  return {
    perkaraId: r.perkara_id,
    nomorPerkara: r.nomor_perkara,
    jenis: r.jenis,
    tingkat: (r.tingkat === "tinggi" || r.tingkat === "rendah" ? r.tingkat : "sedang") as Tingkat,
    ringkas: r.ringkas,
    sisi,
    majelis: r.majelis,
    panitera: r.panitera,
    diperiksaPada: r.diperiksa_pada,
    pertamaTerlihat: r.pertama_terlihat,
  };
};

const daftarTanya = (n: number) => Array.from({ length: n }, () => "?").join(", ");

/**
 * Menyamakan baris tersimpan sekelompok perkara dengan hasil penilaian. Hanya menulis yang berubah:
 * temuan baru -> INSERT; sidik berbeda -> UPDATE; temuan hilang -> DELETE; yang sama -> hanya penanda waktu
 * (satu UPDATE per kelompok).
 */
export async function simpanTemuanKelompok(
  db: AletaDatabase,
  hasil: Array<{ fakta: Pick<FaktaPencocok, "perkaraId" | "nomorPerkara" | "majelis">; temuan: Temuan[] }>,
  kini: Date
): Promise<{ baru: number; berubah: number; dihapus: number; tetap: number }> {
  const hitung = { baru: 0, berubah: 0, dihapus: 0, tetap: 0 };
  if (!hasil.length) return hitung;
  const pada = kini.toISOString();
  const ids = hasil.map((h) => h.fakta.perkaraId);
  const ada = await db.queryAll<{ perkara_id: string; jenis: string; sidik: string }>(
    `SELECT perkara_id, jenis, sidik FROM aleta_pencocok_temuan WHERE perkara_id IN (${daftarTanya(ids.length)})`,
    ids
  );
  const peta = new Map(ada.map((r) => [`${r.perkara_id}\u0000${r.jenis}`, r.sidik]));
  const dipertahankan = new Set<string>();
  const tetapId = new Set<string>();

  for (const { fakta, temuan } of hasil) {
    const petugas = petugasDariFakta(fakta);
    for (const t of temuan) {
      const kunci = `${fakta.perkaraId}\u0000${t.jenis}`;
      dipertahankan.add(kunci);
      const sidikLama = peta.get(kunci);
      const nilai = [fakta.nomorPerkara, t.tingkat, t.ringkas.slice(0, 1500), JSON.stringify(t.sisi).slice(0, 6000), petugas.majelis.slice(0, 800), petugas.panitera.slice(0, 400), t.sidik, pada];
      if (sidikLama === undefined) {
        await db.run(
          "INSERT INTO aleta_pencocok_temuan (nomor_perkara, tingkat, ringkas, sisi, majelis, panitera, sidik, diperiksa_pada, perkara_id, jenis, pertama_terlihat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [...nilai, fakta.perkaraId, t.jenis, pada]
        );
        hitung.baru += 1;
      } else if (sidikLama !== t.sidik) {
        await db.run(
          "UPDATE aleta_pencocok_temuan SET nomor_perkara = ?, tingkat = ?, ringkas = ?, sisi = ?, majelis = ?, panitera = ?, sidik = ?, diperiksa_pada = ? WHERE perkara_id = ? AND jenis = ?",
          [...nilai, fakta.perkaraId, t.jenis]
        );
        hitung.berubah += 1;
      } else {
        tetapId.add(fakta.perkaraId);
        hitung.tetap += 1;
      }
    }
  }
  for (const r of ada) {
    if (dipertahankan.has(`${r.perkara_id}\u0000${r.jenis}`)) continue;
    await db.run("DELETE FROM aleta_pencocok_temuan WHERE perkara_id = ? AND jenis = ?", [r.perkara_id, r.jenis]);
    hitung.dihapus += 1;
  }
  if (tetapId.size) {
    const daftar = [...tetapId];
    await db.run(`UPDATE aleta_pencocok_temuan SET diperiksa_pada = ? WHERE perkara_id IN (${daftarTanya(daftar.length)})`, [pada, ...daftar]);
  }
  return hitung;
}

/** Hasil pencocokan putusan vs dokumen yang sudah disimpan portal (cocok-putusan), sekelompok perkara, SATU kueri. */
async function cocokPutusanKelompok(db: AletaDatabase, ids: string[]): Promise<Map<string, { keadaan: string; ringkas: string }>> {
  if (!ids.length) return new Map();
  const baris = await db
    .queryAll<{ perkara_id: string; keadaan: string; ringkas: string }>(
      `SELECT perkara_id, keadaan, ringkas FROM aleta_cocok_putusan WHERE keadaan = 'beda' AND perkara_id IN (${daftarTanya(ids.length)})`,
      ids
    )
    .catch(() => []);
  return new Map(baris.map((b) => [b.perkara_id, { keadaan: b.keadaan, ringkas: b.ringkas }]));
}

/** Menilai sekelompok fakta (murni + satu kueri hasil cocok-putusan). */
export async function nilaiKelompok(
  db: AletaDatabase,
  fakta: Record<string, FaktaPencocok>,
  terbaca: Terbaca,
  acuan: string
): Promise<Array<{ fakta: FaktaPencocok; temuan: Temuan[] }>> {
  const daftar = Object.values(fakta);
  const cocok = await cocokPutusanKelompok(db, daftar.map((f) => f.perkaraId));
  return daftar.map((f) => ({ fakta: f, temuan: cocokkanPerkara({ fakta: f, acuan, terbaca, cocokPutusan: cocok.get(f.perkaraId) ?? null }) }));
}

// ============================================================================
// PUTARAN
// ============================================================================

type Wadah = { berjalan: boolean; detak?: ReturnType<typeof setInterval>; cache: Map<string, { sampai: number; temuan: Temuan[]; diperiksaPada: string }> };
function wadah(): Wadah {
  const g = globalThis as unknown as { __pencocokWadah?: Wadah };
  if (!g.__pencocokWadah) g.__pencocokWadah = { berjalan: false, cache: new Map() };
  return g.__pencocokWadah;
}

export function sedangBerjalanPencocok(): boolean {
  return wadah().berjalan;
}

export type OpsiPutaran = {
  pemicu: "jadwal" | "tangan";
  oleh?: string;
  sumber?: SumberPencocok;
  kini?: Date;
  acuan?: string;
  kelompok?: number;
  hariPutus?: number;
};

export async function jalankanPutaran(db: AletaDatabase, opsi: OpsiPutaran): Promise<CatatanPencocok> {
  const w = wadah();
  const sumber = opsi.sumber ?? SUMBER_PENCOCOK_BAWAAN;
  const kini = opsi.kini ?? new Date();
  const acuan = opsi.acuan || waktuPengadilan(kini).tanggal;
  const setelan = await bacaSetelanPencocok(db);
  const hariPutus = opsi.hariPutus ?? setelan.hariPutus;
  const ukuran = Math.max(10, Math.min(200, opsi.kelompok ?? KELOMPOK_PERKARA));
  const c: CatatanPencocok = {
    tanggal: waktuPengadilan(kini).tanggal,
    pada: new Date().toISOString(),
    selesaiPada: "",
    pemicu: opsi.pemicu,
    oleh: teks(opsi.oleh) || "Pencocok data",
    durasiMs: 0,
    diperiksa: 0,
    ringkasan: null,
    gagal: {},
    galat: "",
    lengkap: false,
  };
  if (w.berjalan) return { ...c, galat: "Putaran sebelumnya masih berjalan." };
  w.berjalan = true;
  const mulai = Date.now();
  try {
    const semua: number[] = [];
    let setelah = 0;
    for (let halaman = 0; halaman < 100; halaman += 1) {
      const l = await sumber.lingkup({ acuan, hariPutus, setelahId: setelah });
      if (!l.ok) throw new Error(l.galat);
      semua.push(...l.perkaraId);
      if (l.berikut === null) break;
      setelah = l.berikut;
    }
    const diperiksa = new Set<string>();
    for (let i = 0; i < semua.length; i += ukuran) {
      const bagian = semua.slice(i, i + ukuran).map(String);
      const f = await sumber.fakta(bagian, acuan);
      if (!f.ok) throw new Error(f.galat);
      for (const k of Object.keys(f.gagal)) c.gagal[k] = (c.gagal[k] ?? 0) + 1;
      const nilai = await nilaiKelompok(db, f.fakta, f.terbaca, acuan);
      await simpanTemuanKelompok(db, nilai, new Date());
      for (const n of nilai) diperiksa.add(n.fakta.perkaraId);
    }
    c.diperiksa = diperiksa.size;
    c.lengkap = true;
    await buangYangTidakLagiDiperiksa(db, diperiksa, kini);
    const ada = await db.queryAll<{ perkara_id: string; jenis: string; tingkat: string }>("SELECT perkara_id, jenis, tingkat FROM aleta_pencocok_temuan");
    c.ringkasan = ringkasTemuan(ada.map((r) => ({ perkaraId: r.perkara_id, jenis: r.jenis, tingkat: (r.tingkat as Tingkat) ?? "sedang" })));
    w.cache.clear();
  } catch (e) {
    c.galat = teks((e as Error)?.message).slice(0, 300) || "Pencocok gagal.";
  } finally {
    c.durasiMs = Date.now() - mulai;
    c.selesaiPada = new Date().toISOString();
    w.berjalan = false;
  }
  await tulisKunci(db, KUNCI_CATATAN_PENCOCOK, c).catch(() => undefined);
  return c;
}

/** Perkara yang tidak lagi masuk lingkup (putus lama): barisnya dibuang bila terakhir diperiksa > SIMPAN_HARI hari lalu. */
async function buangYangTidakLagiDiperiksa(db: AletaDatabase, diperiksa: Set<string>, kini: Date) {
  const batas = new Date(kini.getTime() - SIMPAN_HARI * 86_400_000).toISOString();
  const lama = await db.queryAll<{ perkara_id: string }>("SELECT DISTINCT perkara_id FROM aleta_pencocok_temuan WHERE diperiksa_pada < ?", [batas]);
  const hapus = lama.map((r) => r.perkara_id).filter((id) => !diperiksa.has(id));
  for (let i = 0; i < hapus.length; i += 100) {
    const bagian = hapus.slice(i, i + 100);
    await db.run(`DELETE FROM aleta_pencocok_temuan WHERE perkara_id IN (${daftarTanya(bagian.length)})`, bagian);
  }
}

/** Dinyalakan detak 5 menit: sekali per tanggal WITA, sesudah jam pemicu, hanya bila saklar menyala. */
export async function detakPencocok(db: AletaDatabase, opsi: { kini?: Date; sumber?: SumberPencocok; env?: Record<string, string | undefined> } = {}) {
  const env = opsi.env ?? process.env;
  if (env.ALETA_PENCOCOK === "0") return null;
  const setelan = await bacaSetelanPencocok(db);
  if (!setelan.jadwal) return null;
  const { tanggal, jam } = waktuPengadilan(opsi.kini);
  if (jam.slice(0, 5) < setelan.jam) return null;
  const catatan = await bacaCatatanPencocok(db);
  // Sekali per tanggal: putaran yang sudah selesai (atau yang gagal hari ini) tidak diulang oleh detak berikutnya.
  if (catatan && catatan.tanggal === tanggal && catatan.pemicu === "jadwal") return null;
  return jalankanPutaran(db, { pemicu: "jadwal", kini: opsi.kini, sumber: opsi.sumber });
}

export function mulaiPencocokBerkala(getDb: () => Promise<AletaDatabase>, env: Record<string, string | undefined> = process.env) {
  if (env.ALETA_PENCOCOK === "0") return;
  const w = wadah();
  if (w.detak) return;
  const detak = async () => {
    try {
      await detakPencocok(await getDb(), { env });
    } catch (e) {
      console.error("[PENCOCOK] detak gagal:", e);
    }
  };
  w.detak = setInterval(() => void detak(), 5 * 60 * 1000);
  setTimeout(() => void detak(), 150 * 1000);
}

// ============================================================================
// SATU PERKARA (saat dibuka)
// ============================================================================

export type HasilSatuPerkara = { ok: true; perkaraId: string; temuan: Temuan[]; diperiksaPada: string; dariCache: boolean } | { ok: false; galat: string };

export async function periksaSatuPerkara(
  db: AletaDatabase,
  perkaraId: string,
  opsi: { sumber?: SumberPencocok; kini?: Date; acuan?: string; tanpaCache?: boolean } = {}
): Promise<HasilSatuPerkara> {
  const id = teks(perkaraId);
  if (!/^\d{1,12}$/.test(id)) return { ok: false, galat: "Perkara tidak dikenali." };
  const w = wadah();
  const kini = opsi.kini ?? new Date();
  const dicatat = w.cache.get(id);
  if (!opsi.tanpaCache && dicatat && dicatat.sampai > kini.getTime()) return { ok: true, perkaraId: id, temuan: dicatat.temuan, diperiksaPada: dicatat.diperiksaPada, dariCache: true };
  const sumber = opsi.sumber ?? SUMBER_PENCOCOK_BAWAAN;
  const acuan = opsi.acuan || waktuPengadilan(kini).tanggal;
  const f = await sumber.fakta([id], acuan);
  if (!f.ok) return { ok: false, galat: f.galat };
  const nilai = await nilaiKelompok(db, f.fakta, f.terbaca, acuan);
  if (!nilai.length) return { ok: false, galat: "Perkara tidak ditemukan di SIPP." };
  await simpanTemuanKelompok(db, nilai, kini).catch(() => undefined);
  const temuan = nilai[0].temuan;
  const pada = kini.toISOString();
  if (w.cache.size >= BATAS_CACHE) w.cache.delete(w.cache.keys().next().value as string);
  w.cache.set(id, { sampai: kini.getTime() + UMUR_CACHE_MS, temuan, diperiksaPada: pada });
  return { ok: true, perkaraId: id, temuan, diperiksaPada: pada, dariCache: false };
}

// ============================================================================
// DAFTAR (layar Pencocok, Pusat Kesehatan, lonceng)
// ============================================================================

export type SaringanDaftar = {
  tingkat?: string;
  jenis?: string;
  kelompok?: string;
  cari?: string;
  /** Nama akun: hanya perkara yang namanya tercantum (majelis/panitera pengganti). Kosong = semua. */
  milikSaya?: string;
  batas?: number;
};

/**
 * Daftar temuan tersimpan. Penyaringan nama dilakukan di sini (bukan hanya di layar) atas kolom petugas.
 * Satu kueri atas tabel yang kecil (ratusan baris), diurutkan tingkat lalu waktu.
 */
export async function daftarTemuan(db: AletaDatabase, s: SaringanDaftar = {}): Promise<{ baris: BarisTemuan[]; ringkasan: RingkasanPencocok }> {
  const kondisi: string[] = [];
  const nilai: string[] = [];
  if (s.tingkat && ["tinggi", "sedang", "rendah"].includes(s.tingkat)) {
    kondisi.push("tingkat = ?");
    nilai.push(s.tingkat);
  }
  if (s.jenis && PETA_JENIS.has(s.jenis)) {
    kondisi.push("jenis = ?");
    nilai.push(s.jenis);
  }
  const cari = teks(s.cari).toLowerCase();
  if (cari) {
    kondisi.push("LOWER(nomor_perkara) LIKE ?");
    nilai.push(`%${cari.replace(/[%_]/g, "")}%`);
  }
  const rows = await db
    .queryAll<BarisSimpan>(
      `SELECT perkara_id, jenis, nomor_perkara, tingkat, ringkas, sisi, majelis, panitera, sidik, pertama_terlihat, diperiksa_pada
         FROM aleta_pencocok_temuan ${kondisi.length ? `WHERE ${kondisi.join(" AND ")}` : ""}
        ORDER BY CASE tingkat WHEN 'tinggi' THEN 0 WHEN 'sedang' THEN 1 ELSE 2 END, diperiksa_pada DESC, nomor_perkara ASC
        LIMIT 5000`,
      nilai
    )
    .catch(() => [] as BarisSimpan[]);
  let baris = rows.map(sebagaiBaris);
  if (s.kelompok) baris = baris.filter((b) => PETA_JENIS.get(b.jenis)?.kelompok === s.kelompok);
  if (teks(s.milikSaya)) baris = baris.filter((b) => pemilikButir({ majelis: b.majelis, panitera: b.panitera, jurusita: "", mediator: "" }, teks(s.milikSaya)));
  const ringkasan = ringkasTemuan(baris);
  const batas = Math.max(1, Math.min(2000, Math.round(s.batas ?? 500)));
  return { baris: baris.slice(0, batas), ringkasan };
}

// ============================================================================
// KESEHATAN & LONCENG
// ============================================================================

export type RingkasKesehatanPencocok = {
  ringkasan: RingkasanPencocok | null;
  catatan: Pick<CatatanPencocok, "tanggal" | "pada" | "durasiMs" | "diperiksa" | "galat" | "lengkap" | "pemicu"> | null;
  contoh: Array<{ nomorPerkara: string; jenis: string; ringkas: string }>;
};

export async function ringkasKesehatanPencocok(db: AletaDatabase): Promise<RingkasKesehatanPencocok> {
  const { baris, ringkasan } = await daftarTemuan(db, { batas: 12 });
  const c = await bacaCatatanPencocok(db);
  return {
    ringkasan,
    catatan: c ? { tanggal: c.tanggal, pada: c.pada, durasiMs: c.durasiMs, diperiksa: c.diperiksa, galat: c.galat, lengkap: c.lengkap, pemicu: c.pemicu } : null,
    contoh: baris.filter((b) => b.tingkat === "tinggi").slice(0, 12).map((b) => ({ nomorPerkara: b.nomorPerkara, jenis: b.jenis, ringkas: b.ringkas })),
  };
}

/** Pemberitahuan lonceng: temuan TINGGI saja (sisanya dibaca di layar Pencocok). Gagal baca = tidak ada. */
export async function pemberitahuanPencocok(
  db: AletaDatabase,
  opsi: { nama: string; lihatSemua: boolean }
): Promise<Array<{ id: string; judul: string; uraian: string; waktu: string }>> {
  try {
    const { baris } = await daftarTemuan(db, { tingkat: "tinggi", milikSaya: opsi.lihatSemua ? "" : opsi.nama, batas: 2000 });
    if (!baris.length) return [];
    const perkara = new Set(baris.map((b) => b.perkaraId)).size;
    const c = await bacaCatatanPencocok(db);
    return [
      {
        id: `pencocok-${c?.tanggal ?? "x"}`,
        judul: opsi.lihatSemua ? `Pencocok data: ${baris.length} perbedaan penting` : `Pencocok data: ${baris.length} perbedaan penting pada perkara Anda`,
        uraian: `${perkara} perkara datanya berbeda antar SIPP, ABT, dan e-Court (tingkat penting). Buka Pencocok data untuk rinciannya.`,
        waktu: c?.pada ?? new Date().toISOString(),
      },
    ];
  } catch {
    return [];
  }
}
