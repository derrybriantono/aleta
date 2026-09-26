import { cerminDaftar, daftarBercermin } from "@/lib/tipe-keluaran/bawaan";
import {
  cerminSebagaiEntri,
  gabungEfektif,
  jsonKanonik,
  sidik as hitungSidik,
  versiDari,
  type BarisGabung,
} from "@/lib/tipe-keluaran/gabung";
import {
  BATAS_DAFTAR,
  DAFTAR_BOT,
  DAFTAR_EKSTENSI,
  DAFTAR_TIPE,
  GOLONGAN_TIPE,
  KUNCI_DAFTAR,
  adalahKunciDaftar,
  type DataEntri,
  type EntriTipe,
  type GolonganTipe,
  type HasilUkur,
  type KunciDaftar,
} from "@/lib/tipe-keluaran/kontrak";
import { GalatDaftarTakTerdaftar, nilaiHasilUkur, pastikanDaftar, validasiEntri } from "@/lib/tipe-keluaran/validasi";
import { getEffectiveRoleId } from "@/lib/permissions";
import { type RoleId } from "@/lib/types";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import { PERAN_PENGACC } from "@/server/modules/aleta-ecourt/bas-acc";
import { getUserByIdFromDb, requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * TIPE KELUARAN - SATU-SATUNYA PINTU KE aleta_tipe_keluaran (K1)
 * ============================================================================
 *
 * Tidak ada SQL ke tabel tipe keluaran di luar berkas ini. Rute, bot, dan
 * ekstensi membaca lewat untukPortal/untukBot/untukEkstensi; layar pengaturan
 * lewat bacaAdmin dan enam tindakan: usul, sahkan, tolak, matikan, nyalakan,
 * ganti. TIDAK ADA fungsi hapus - pertanyaan "sejak kapan kalimat ini
 * berbunyi begini, dan atas perintah siapa" harus tetap terjawab.
 *
 * ============================================================================
 * TABEL KOSONG ATAU TAK TERBACA = PERILAKU HARI INI
 * ============================================================================
 *
 * Nilai bawaan dibaca dari cermin kode (src/lib/tipe-keluaran/bawaan), bukan
 * dari baris tabel. Baris bawaan hanya saklar. Karena itu:
 *   - tabel kosong      -> keluaran = cermin (pastikanBenih lalu menanamnya);
 *   - tabel tak terbaca -> keluaran = cermin dengan asal 'cermin' dan kabar
 *                          yang menyebut galatnya - tidak pernah 500, tidak
 *                          pernah diam: rute ekstensi menjawabnya 503 (K5),
 *                          rute bot mengirim tanpa tipeKeluaran (K6).
 *
 * ============================================================================
 * SETIAP TINDAKAN: TEPAT SATU RIWAYAT DAN SATU AUDIT
 * ============================================================================
 *
 * Perubahan baris, riwayatnya, dan appendAuditLog 'TIPE_KELUARAN_<TINDAKAN>'
 * berada dalam SATU transaksi. Riwayat tanpa perubahan, atau perubahan tanpa
 * riwayat, tidak dapat terjadi.
 *
 * Kewenangan (K13):
 *   usul, ganti, tolak, matikan, nyalakan   Admin atau Super Admin
 *   sahkan                                  Super Admin, atas_perintah wajib;
 *                                           untuk golongan bas/bersama dan
 *                                           kalimat putusan (8, 9) atas_perintah
 *                                           harus ketua/wakil ketua/hakim;
 *                                           daftar 'deteksi' harus lulus ukur.
 *   tolak, matikan, nyalakan                alasan wajib.
 */

type BarisDb = {
  id: string;
  golongan: string;
  daftar: string;
  kunci: string;
  nilai: string;
  data: string;
  asal: string;
  sidik: string;
  aktif: number | string | boolean;
  keadaan: string;
  urutan: number | string;
  versi: number | string;
  menggantikan_id: string | null;
  alasan: string;
  hasil_ukur: string | null;
  dibuat_oleh: string;
  dibuat_at: string;
  disahkan_oleh: string | null;
  atas_perintah: string | null;
  disahkan_at: string | null;
  diubah_at: string;
};

type BarisRiwayatDb = {
  id: string;
  butir_id: string;
  tindakan: string;
  dari: string | null;
  ke: string | null;
  alasan: string;
  oleh: string;
  pada: string;
};

export type TindakanTipe = "usul" | "sahkan" | "tolak" | "matikan" | "nyalakan" | "ganti";
export const TINDAKAN_TIPE: readonly TindakanTipe[] = ["usul", "sahkan", "tolak", "matikan", "nyalakan", "ganti"];

export type RiwayatButir = {
  id: string;
  butirId: string;
  tindakan: string;
  dari: unknown;
  ke: unknown;
  alasan: string;
  oleh: string;
  pada: string;
};

export type ButirTipe = {
  id: string;
  daftar: string;
  kunci: string;
  nilai: string;
  data: DataEntri;
  asal: "bawaan" | "tambahan";
  keadaan: string;
  aktif: boolean;
  urutan: number;
  versi: number;
  alasan: string;
  hasilUkur: unknown;
  dibuatOleh: string;
  disahkanOleh: string | null;
  atasPerintah: string | null;
  sidik: string;
  menggantikanId: string | null;
  /** Id tambahan yang menggantikan butir ini (bila ada). */
  digantiOleh: string | null;
  /** Baris bawaan yang sidiknya tidak lagi ada di cermin kode - diabaikan. */
  yatim: boolean;
  /** Ikut dalam keluaran efektif sekarang. */
  berlaku: boolean;
  riwayat: RiwayatButir[];
};

export type HasilEfektif = {
  asal: "basis-data" | "cermin";
  versi: string;
  dibuatPada: string;
  daftar: Partial<Record<KunciDaftar, EntriTipe[]>>;
  /** Daftar yang diminta tetapi cermin bawaannya belum dirangkai - TIDAK dikirim. */
  tanpaCermin: KunciDaftar[];
  kabar: string[];
};

export type JawabanTindakan = { ok: true; butir: ButirTipe } | { ok: false; alasan: string[] };

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

function pesanGalat(galat: unknown): string {
  return galat instanceof Error ? galat.message : String(galat);
}

function angka(nilai: unknown, cadangan = 0): number {
  const n = Number(nilai);
  return Number.isFinite(n) ? n : cadangan;
}

function bendera(nilai: unknown): boolean {
  return nilai === true || nilai === 1 || nilai === "1" || nilai === "true";
}

function uraiJson(nilai: string | null | undefined): unknown {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  return JSON.parse(nilai);
}

/** Nama daftar yang terdaftar, atau ApiError 400 - tidak pernah jawaban kosong. */
function kunciDaftarAtau400(daftar: unknown): KunciDaftar {
  try {
    return pastikanDaftar(daftar);
  } catch (galat) {
    if (galat instanceof GalatDaftarTakTerdaftar) throw new ApiError(400, galat.message);
    throw galat;
  }
}

function sidikCermin(daftar: KunciDaftar): Map<string, { nilai: string; data: DataEntri; urutan: number }> {
  const hasil = new Map<string, { nilai: string; data: DataEntri; urutan: number }>();
  const cermin = cerminDaftar(daftar);
  if (!cermin) return hasil;
  for (const e of cerminSebagaiEntri(daftar, cermin)) hasil.set(e.sidik, { nilai: e.nilai, data: e.data, urutan: e.urutan });
  return hasil;
}

async function catatRiwayat(
  tx: AletaDatabase,
  isi: { butirId: string; tindakan: string; dari: unknown; ke: unknown; alasan: string; oleh: string; pada: string }
) {
  await tx.run(
    `INSERT INTO aleta_tipe_keluaran_riwayat (id, butir_id, tindakan, dari, ke, alasan, oleh, pada)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      await nextPrefixedId(tx, "aleta_tipe_keluaran_riwayat", "tpr"),
      isi.butirId,
      isi.tindakan,
      isi.dari === null || isi.dari === undefined ? null : jsonKanonik(isi.dari),
      isi.ke === null || isi.ke === undefined ? null : jsonKanonik(isi.ke),
      isi.alasan,
      isi.oleh,
      isi.pada,
    ]
  );
}

async function catatAudit(
  tx: AletaDatabase,
  aktorId: string,
  tindakan: TindakanTipe | "ukur",
  butirId: string,
  payload: Record<string, unknown>,
  pada: string
) {
  await appendAuditLog(tx, {
    id: await nextPrefixedId(tx, "audit_logs", "adt"),
    actorUserId: aktorId,
    action: `TIPE_KELUARAN_${tindakan.toUpperCase()}`,
    entityType: "aleta_tipe_keluaran",
    entityId: butirId,
    payload,
    createdAt: pada,
  });
}

// ============================================================================
// BENIH
// ============================================================================

/**
 * Menanam setiap entri cermin sebagai baris bawaan (asal 'bawaan', keadaan
 * 'disahkan', aktif 1, dibuat_oleh 'benih'). Idempoten: yang sudah ada tidak
 * disentuh, dan ON CONFLICT (daftar, sidik) DO NOTHING menjaga dua proses yang
 * menanam bersamaan. Tiap baris yang benar-benar tertanam mendapat SATU
 * riwayat 'benih'.
 *
 * Baris bawaan yang sidiknya tidak ada lagi di cermin (kode berubah sesudah
 * benih ditanam) ditandai YATIM lewat SATU riwayat 'yatim' - barisnya sendiri
 * tidak diubah, supaya bila nilainya kembali ke kode ia berlaku lagi tanpa
 * campur tangan. Daftar yang cerminnya belum dirangkai tidak dinilai: yatim
 * atau bukan, tidak dapat diketahui.
 */
export async function pastikanBenih(
  db: AletaDatabase
): Promise<{ disisipkan: number; yatimBaru: number; jumlahCermin: number }> {
  const bercermin = daftarBercermin();
  return withTransaction(db, async (tx) => {
    const ada = await tx.queryAll<{ id: string; daftar: string; sidik: string; asal: string }>(
      "SELECT id, daftar, sidik, asal FROM aleta_tipe_keluaran"
    );
    const sudahAda = new Set(ada.map((b) => `${b.daftar}\u0000${b.sidik}`));
    const pada = new Date().toISOString();
    let disisipkan = 0;
    let jumlahCermin = 0;
    const sidikPerDaftar = new Map<string, Set<string>>();

    for (const daftar of bercermin) {
      const entri = cerminSebagaiEntri(daftar, cerminDaftar(daftar) ?? []);
      sidikPerDaftar.set(daftar, new Set(entri.map((e) => e.sidik)));
      jumlahCermin += entri.length;
      const golongan = DAFTAR_TIPE[daftar].golongan;
      for (const e of entri) {
        if (sudahAda.has(`${daftar}\u0000${e.sidik}`)) continue;
        const id = await nextPrefixedId(tx, "aleta_tipe_keluaran", "tpk");
        const tertanam = await tx.queryAll<{ id: string }>(
          `INSERT INTO aleta_tipe_keluaran
             (id, golongan, daftar, kunci, nilai, data, asal, sidik, aktif, keadaan, urutan, versi,
              menggantikan_id, alasan, hasil_ukur, dibuat_oleh, dibuat_at, disahkan_oleh, atas_perintah,
              disahkan_at, diubah_at)
           VALUES (?, ?, ?, ?, ?, ?, 'bawaan', ?, 1, 'disahkan', ?, 1, NULL, '', NULL, 'benih', ?, NULL, NULL, NULL, ?)
           ON CONFLICT (daftar, sidik) DO NOTHING
           RETURNING id`,
          [id, golongan, daftar, e.kunci, e.nilai, jsonKanonik(e.data), e.sidik, e.urutan, pada, pada]
        );
        sudahAda.add(`${daftar}\u0000${e.sidik}`);
        if (tertanam.length !== 1) continue;
        disisipkan += 1;
        await catatRiwayat(tx, {
          butirId: id,
          tindakan: "benih",
          dari: null,
          ke: { kunci: e.kunci, nilai: e.nilai, data: e.data, urutan: e.urutan },
          alasan: "",
          oleh: "benih",
          pada,
        });
      }
    }

    let yatimBaru = 0;
    for (const b of ada) {
      if (b.asal !== "bawaan") continue;
      const dikenal = adalahKunciDaftar(b.daftar);
      if (dikenal && !sidikPerDaftar.has(b.daftar)) continue; // cermin belum dirangkai
      if (dikenal && sidikPerDaftar.get(b.daftar)?.has(b.sidik)) continue;
      const sudah = await tx.queryOne<{ id: string }>(
        "SELECT id FROM aleta_tipe_keluaran_riwayat WHERE butir_id = ? AND tindakan = 'yatim' LIMIT 1",
        [b.id]
      );
      if (sudah) continue;
      await catatRiwayat(tx, {
        butirId: b.id,
        tindakan: "yatim",
        dari: { daftar: b.daftar, sidik: b.sidik },
        ke: null,
        alasan: dikenal
          ? "Sidik baris bawaan ini tidak lagi ada di cermin kode; barisnya diabaikan."
          : "Daftar baris bawaan ini tidak lagi terdaftar; barisnya diabaikan.",
        oleh: "benih",
        pada,
      });
      yatimBaru += 1;
    }

    return { disisipkan, yatimBaru, jumlahCermin };
  });
}

const benihTertanam = new WeakMap<AletaDatabase, Promise<unknown>>();

/** pastikanBenih sekali per basis data per proses; kegagalan tidak disimpan. */
async function pastikanBenihSekali(db: AletaDatabase) {
  let janji = benihTertanam.get(db);
  if (!janji) {
    janji = pastikanBenih(db).catch((galat) => {
      benihTertanam.delete(db);
      throw galat;
    });
    benihTertanam.set(db, janji);
  }
  await janji;
}

// ============================================================================
// BACA EFEKTIF
// ============================================================================

function keBarisGabung(b: BarisDb, kabar: string[]): BarisGabung | null {
  let data: DataEntri = {};
  if (b.asal === "tambahan") {
    try {
      const urai = uraiJson(b.data);
      data = urai && typeof urai === "object" && !Array.isArray(urai) ? (urai as DataEntri) : {};
    } catch (galat) {
      // Tambahan yang datanya rusak TIDAK dikirim - dan tidak diam: kabarnya
      // ikut jawaban dan galatnya tercatat di log peladen.
      kabar.push(`Tambahan ${b.id} (${b.daftar}) diabaikan: data JSON-nya rusak.`);
      console.error("[TIPE KELUARAN] Data JSON tambahan rusak; baris diabaikan.", b.id, galat);
      return null;
    }
  }
  return {
    id: b.id,
    asal: b.asal === "bawaan" ? "bawaan" : "tambahan",
    sidik: b.sidik,
    aktif: bendera(b.aktif),
    keadaan: b.keadaan as BarisGabung["keadaan"],
    kunci: b.kunci,
    nilai: b.nilai,
    data,
    urutan: angka(b.urutan),
    dibuatAt: b.dibuat_at,
  };
}

/**
 * Daftar efektif (K3) untuk daftar-daftar yang diminta.
 *
 * Daftar yang tidak terdaftar -> ApiError 400. Daftar yang cerminnya belum
 * dirangkai -> tidak dikirim (tercantum di tanpaCermin), sehingga pemakainya
 * memakai konstanta tertanamnya. Tabel tak terbaca -> cermin dengan asal
 * 'cermin' dan kabar galatnya.
 */
export async function bacaEfektif(db: AletaDatabase, daftar: readonly unknown[]): Promise<HasilEfektif> {
  const diminta = [...new Set(daftar.map(kunciDaftarAtau400))];
  const bercermin = diminta.filter((d) => cerminDaftar(d) !== null);
  const tanpaCermin = diminta.filter((d) => cerminDaftar(d) === null);
  const kabar: string[] = [];
  if (tanpaCermin.length) {
    kabar.push(
      `Cermin bawaan belum dirangkai untuk ${tanpaCermin.join(", ")}; daftar itu tidak dikirim dan pemakainya memakai konstanta tertanam.`
    );
  }
  const dibuatPada = new Date().toISOString();

  try {
    await pastikanBenihSekali(db);
  } catch (galat) {
    // Benih yang gagal tidak mengubah keluaran (entri cermin tanpa baris tetap
    // berlaku), tetapi harus terlihat.
    kabar.push(`Benih tipe keluaran gagal ditanam: ${pesanGalat(galat)}`);
    console.error("[TIPE KELUARAN] Benih gagal ditanam.", galat);
  }

  let baris: BarisDb[];
  try {
    baris = bercermin.length
      ? await db.queryAll<BarisDb>(
          `SELECT * FROM aleta_tipe_keluaran WHERE daftar IN (${bercermin.map(() => "?").join(", ")})`,
          bercermin
        )
      : [];
  } catch (galat) {
    console.error("[TIPE KELUARAN] Tabel tidak terbaca; keluaran jatuh ke cermin kode.", galat);
    const isi: Partial<Record<KunciDaftar, EntriTipe[]>> = {};
    for (const d of bercermin) isi[d] = cerminSebagaiEntri(d, cerminDaftar(d) ?? [], "cermin");
    return {
      asal: "cermin",
      versi: versiDari(isi),
      dibuatPada,
      daftar: isi,
      tanpaCermin,
      kabar: [...kabar, `Tabel tipe keluaran tidak terbaca - memakai bawaan: ${pesanGalat(galat)}`],
    };
  }

  const isi: Partial<Record<KunciDaftar, EntriTipe[]>> = {};
  for (const d of bercermin) {
    const barisDaftar = baris
      .filter((b) => b.daftar === d)
      .map((b) => keBarisGabung(b, kabar))
      .filter((b): b is BarisGabung => b !== null);
    isi[d] = gabungEfektif(d, cerminDaftar(d) ?? [], barisDaftar).entri;
  }
  return { asal: "basis-data", versi: versiDari(isi), dibuatPada, daftar: isi, tanpaCermin, kabar };
}

/** Empat daftar ekstensi (K5). */
export function untukEkstensi(db: AletaDatabase): Promise<HasilEfektif> {
  return bacaEfektif(db, DAFTAR_EKSTENSI);
}

/** Daftar yang dipakai bot (K6) - yang cerminnya belum dirangkai tidak dikirim. */
export function untukBot(db: AletaDatabase): Promise<HasilEfektif> {
  return bacaEfektif(db, DAFTAR_BOT);
}

/** Daftar yang dipakai portal sendiri. */
export function untukPortal(db: AletaDatabase, daftar: readonly unknown[]): Promise<HasilEfektif> {
  return bacaEfektif(db, daftar);
}

// ============================================================================
// BACA ADMIN (K4 GET)
// ============================================================================

function bentukRiwayat(r: BarisRiwayatDb): RiwayatButir {
  const urai = (x: string | null) => {
    try {
      return uraiJson(x);
    } catch {
      return x;
    }
  };
  return {
    id: r.id,
    butirId: r.butir_id,
    tindakan: r.tindakan,
    dari: urai(r.dari),
    ke: urai(r.ke),
    alasan: r.alasan,
    oleh: r.oleh,
    pada: r.pada,
  };
}

function bentukButir(
  b: BarisDb,
  konteks: {
    cermin: Map<string, { nilai: string; data: DataEntri; urutan: number }>;
    digantiOleh: string | null;
    berlaku: boolean;
    riwayat: RiwayatButir[];
  }
): ButirTipe {
  const dariCermin = b.asal === "bawaan" ? konteks.cermin.get(b.sidik) : undefined;
  let data: DataEntri = {};
  if (dariCermin) data = dariCermin.data;
  else {
    try {
      const urai = uraiJson(b.data);
      data = urai && typeof urai === "object" && !Array.isArray(urai) ? (urai as DataEntri) : {};
    } catch {
      data = { __rusak: b.data };
    }
  }
  let hasilUkur: unknown = null;
  try {
    hasilUkur = uraiJson(b.hasil_ukur);
  } catch {
    hasilUkur = { __rusak: b.hasil_ukur };
  }
  return {
    id: b.id,
    daftar: b.daftar,
    kunci: b.kunci,
    // Nilai bawaan SELALU dari cermin kode; baris yatim menampilkan yang
    // tersimpan karena hanya itu yang tersisa.
    nilai: dariCermin ? dariCermin.nilai : b.nilai,
    data,
    asal: b.asal === "bawaan" ? "bawaan" : "tambahan",
    keadaan: b.keadaan,
    aktif: bendera(b.aktif),
    urutan: angka(b.urutan),
    versi: angka(b.versi, 1),
    alasan: b.alasan,
    hasilUkur,
    dibuatOleh: b.dibuat_oleh,
    disahkanOleh: b.disahkan_oleh,
    atasPerintah: b.atas_perintah,
    sidik: b.sidik,
    menggantikanId: b.menggantikan_id,
    digantiOleh: konteks.digantiOleh,
    yatim: b.asal === "bawaan" && !dariCermin,
    berlaku: konteks.berlaku,
    riwayat: konteks.riwayat,
  };
}

async function riwayatUntuk(db: AletaDatabase, baris: readonly BarisDb[]): Promise<Map<string, RiwayatButir[]>> {
  const hasil = new Map<string, RiwayatButir[]>();
  if (baris.length === 0) return hasil;
  const ids = baris.map((b) => b.id);
  const semua = await db.queryAll<BarisRiwayatDb>(
    `SELECT * FROM aleta_tipe_keluaran_riwayat WHERE butir_id IN (${ids.map(() => "?").join(", ")})
      ORDER BY pada DESC, id DESC`,
    ids
  );
  // Riwayat sebuah butir = riwayatnya sendiri + riwayat penggantinya: butir
  // yang digantikan tidak mendapat baris riwayat tersendiri (satu tindakan,
  // satu baris), tetapi layarnya tetap harus dapat menjawab "diganti apa".
  const penggantiDari = new Map<string, string[]>();
  for (const b of baris) {
    if (!b.menggantikan_id) continue;
    penggantiDari.set(b.menggantikan_id, [...(penggantiDari.get(b.menggantikan_id) ?? []), b.id]);
  }
  for (const b of baris) {
    const milik = new Set([b.id, ...(penggantiDari.get(b.id) ?? [])]);
    hasil.set(
      b.id,
      semua
        .filter((r) => milik.has(r.butir_id))
        .slice(0, 5)
        .map(bentukRiwayat)
    );
  }
  return hasil;
}

/** Isi layar pengaturan satu golongan (K4 GET). Penjagaan peran di rute. */
export async function bacaAdmin(db: AletaDatabase, golongan: unknown) {
  if (!(GOLONGAN_TIPE as readonly unknown[]).includes(golongan)) {
    throw new ApiError(400, `Golongan tipe keluaran harus salah satu dari ${GOLONGAN_TIPE.join(", ")}.`);
  }
  const g = golongan as GolonganTipe;
  await pastikanBenihSekali(db);
  const daftarGolongan = KUNCI_DAFTAR.filter((k) => DAFTAR_TIPE[k].golongan === g);
  const baris = await db.queryAll<BarisDb>(
    "SELECT * FROM aleta_tipe_keluaran WHERE golongan = ? ORDER BY urutan, dibuat_at, id",
    [g]
  );
  const riwayat = await riwayatUntuk(db, baris);
  const efektif = await bacaEfektif(
    db,
    daftarGolongan.filter((d) => cerminDaftar(d) !== null)
  );

  return {
    ok: true as const,
    daftar: daftarGolongan.map((d) => {
      const ketentuan = DAFTAR_TIPE[d];
      const bercermin = cerminDaftar(d) !== null;
      const cermin = sidikCermin(d);
      const barisDaftar = baris.filter((b) => b.daftar === d);
      const sidikBerlaku = new Set((efektif.daftar[d] ?? []).map((e) => e.sidik));
      const digantiOleh = new Map<string, string>();
      for (const b of barisDaftar) {
        if (b.menggantikan_id && b.keadaan === "disahkan") digantiOleh.set(b.menggantikan_id, b.id);
      }
      const bawaan = barisDaftar
        .filter((b) => b.asal === "bawaan")
        .sort((a, b) => {
          const ua = cermin.get(a.sidik)?.urutan ?? Number.MAX_SAFE_INTEGER;
          const ub = cermin.get(b.sidik)?.urutan ?? Number.MAX_SAFE_INTEGER;
          return ua - ub;
        });
      const tambahan = barisDaftar.filter((b) => b.asal !== "bawaan");
      const butir = [...bawaan, ...tambahan].map((b) =>
        bentukButir(b, {
          cermin,
          digantiOleh: digantiOleh.get(b.id) ?? null,
          berlaku:
            sidikBerlaku.has(b.sidik) &&
            (b.asal === "bawaan" ? cermin.has(b.sidik) : b.keadaan === "disahkan" && bendera(b.aktif)),
          riwayat: riwayat.get(b.id) ?? [],
        })
      );
      return {
        daftar: d,
        golongan: ketentuan.golongan,
        jenis: ketentuan.jenis,
        judul: ketentuan.judul,
        bentukKunci: ketentuan.bentukKunci,
        bentukNilai: ketentuan.bentukNilai,
        dapatDitambah: ketentuan.dapatDitambah && bercermin,
        bercermin,
        butuhUkur: ketentuan.jenis === "deteksi",
        butir,
      };
    }),
  };
}

// ============================================================================
// TINDAKAN (K4 POST)
// ============================================================================

async function ambilBaris(tx: AletaDatabase, id: unknown): Promise<BarisDb> {
  const idBersih = teks(id);
  if (!idBersih) throw new ApiError(400, "Butir tipe keluaran harus disebut (id).");
  const baris = await tx.queryOne<BarisDb>("SELECT * FROM aleta_tipe_keluaran WHERE id = ?", [idBersih]);
  if (!baris) throw new ApiError(404, "Butir tipe keluaran tidak ditemukan.");
  return baris;
}

async function butirLengkap(tx: AletaDatabase, id: string): Promise<ButirTipe> {
  const b = await ambilBaris(tx, id);
  const d = adalahKunciDaftar(b.daftar) ? b.daftar : null;
  const cermin = d ? sidikCermin(d) : new Map<string, { nilai: string; data: DataEntri; urutan: number }>();
  const pengganti = await tx.queryOne<{ id: string }>(
    "SELECT id FROM aleta_tipe_keluaran WHERE menggantikan_id = ? AND keadaan = 'disahkan' LIMIT 1",
    [b.id]
  );
  const semuaPengganti = await tx.queryAll<BarisDb>("SELECT * FROM aleta_tipe_keluaran WHERE menggantikan_id = ?", [b.id]);
  const riwayat = await riwayatUntuk(tx, [b, ...semuaPengganti]);
  const berlaku =
    b.asal === "bawaan" ? cermin.has(b.sidik) && bendera(b.aktif) : b.keadaan === "disahkan" && bendera(b.aktif);
  return bentukButir(b, { cermin, digantiOleh: pengganti?.id ?? null, berlaku, riwayat: riwayat.get(b.id) ?? [] });
}

async function pastikanSuperAdmin(db: AletaDatabase, actorUserId: string | null | undefined) {
  const aktor = await requireActorUser(db, actorUserId);
  if (getEffectiveRoleId(aktor) !== "super-admin") {
    throw new ApiError(403, "Hanya Super Admin yang dapat mengesahkan tipe keluaran.");
  }
  return aktor;
}

/** atas_perintah untuk kalimat BAS/putusan harus ketua, wakil ketua, atau hakim. */
async function pastikanPemberiPerintahHakim(tx: AletaDatabase, penggunaId: string) {
  const pengguna = await getUserByIdFromDb(tx, penggunaId);
  if (!pengguna || !pengguna.isActive) {
    throw new ApiError(400, "Pemberi perintah tidak dikenali atau tidak aktif. Sebut id pengguna ketua, wakil ketua, atau hakim.");
  }
  const peran = new Set<string>(
    [String(pengguna.roleId ?? ""), String(getEffectiveRoleId(pengguna) ?? ""), ...(pengguna.additionalRoleIds ?? [])].filter(
      Boolean
    )
  );
  if (!PERAN_PENGACC.some((p: RoleId) => peran.has(p))) {
    throw new ApiError(
      400,
      "Kalimat BAS dan putusan disahkan atas perintah ketua, wakil ketua, atau hakim - bukan peran lain."
    );
  }
}

function kalimatDaftarTanpaCermin(daftar: string) {
  return `Cermin bawaan daftar ${daftar} belum dirangkai; tambahan belum dapat diterima karena akan menggantikan seluruh bawaan tertanamnya.`;
}

export type MasukanUsul = {
  daftar: unknown;
  kunci?: unknown;
  nilai?: unknown;
  data?: unknown;
  alasan?: unknown;
  urutan?: unknown;
};

/** Mengusulkan satu tambahan (keadaan 'usulan'). Admin atau Super Admin. */
export async function usul(db: AletaDatabase, actorUserId: string | null | undefined, masukan: MasukanUsul): Promise<JawabanTindakan> {
  const aktor = await pastikanAdminIstimewa(db, actorUserId, "mengusulkan tipe keluaran");
  const daftar = kunciDaftarAtau400(masukan.daftar);
  const ketentuan = DAFTAR_TIPE[daftar];
  if (!ketentuan.dapatDitambah) throw new ApiError(400, `Daftar ${daftar} tidak menerima tambahan.`);
  if (cerminDaftar(daftar) === null) throw new ApiError(409, kalimatDaftarTanpaCermin(daftar));

  const periksa = validasiEntri(daftar, masukan);
  if (!periksa.ok) return { ok: false, alasan: periksa.alasan };
  const urutan = masukan.urutan === undefined || masukan.urutan === null || masukan.urutan === "" ? 0 : Number(masukan.urutan);
  if (!Number.isInteger(urutan) || urutan < 0 || urutan > 100000) {
    return { ok: false, alasan: ["Urutan harus bilangan bulat 0 sampai 100.000."] };
  }
  await pastikanBenihSekali(db);

  return withTransaction(db, async (tx) => {
    const { kunci, nilai, data } = periksa.entri;
    const s = hitungSidik(daftar, kunci, nilai, data);
    if (sidikCermin(daftar).has(s)) {
      return { ok: false as const, alasan: ["Entri ini sama persis dengan salah satu bawaan - nyalakan bawaannya, bukan menambah."] };
    }
    const kembar = await tx.queryOne<{ id: string; keadaan: string }>(
      "SELECT id, keadaan FROM aleta_tipe_keluaran WHERE daftar = ? AND sidik = ?",
      [daftar, s]
    );
    if (kembar) return { ok: false as const, alasan: [`Entri yang sama sudah ada (${kembar.id}, ${kembar.keadaan}).`] };
    const jumlah = await tx.queryOne<{ n: string | number }>(
      "SELECT COUNT(*) AS n FROM aleta_tipe_keluaran WHERE daftar = ? AND asal = 'tambahan' AND keadaan IN ('usulan', 'disahkan')",
      [daftar]
    );
    if (angka(jumlah?.n) + (cerminDaftar(daftar)?.length ?? 0) >= BATAS_DAFTAR.entriPerDaftar) {
      return {
        ok: false as const,
        alasan: [`Daftar ${daftar} sudah mencapai ${BATAS_DAFTAR.entriPerDaftar} entri - batas yang disaring bot.`],
      };
    }

    const pada = new Date().toISOString();
    const id = await nextPrefixedId(tx, "aleta_tipe_keluaran", "tpk");
    const alasan = teks(masukan.alasan);
    await tx.run(
      `INSERT INTO aleta_tipe_keluaran
         (id, golongan, daftar, kunci, nilai, data, asal, sidik, aktif, keadaan, urutan, versi,
          menggantikan_id, alasan, hasil_ukur, dibuat_oleh, dibuat_at, disahkan_oleh, atas_perintah,
          disahkan_at, diubah_at)
       VALUES (?, ?, ?, ?, ?, ?, 'tambahan', ?, 1, 'usulan', ?, 1, NULL, ?, NULL, ?, ?, NULL, NULL, NULL, ?)`,
      [id, ketentuan.golongan, daftar, kunci, nilai, jsonKanonik(data), s, urutan, alasan, aktor.id, pada, pada]
    );
    await catatRiwayat(tx, { butirId: id, tindakan: "usul", dari: null, ke: { kunci, nilai, data, urutan }, alasan, oleh: aktor.id, pada });
    await catatAudit(tx, aktor.id, "usul", id, { daftar, kunci, nilai, data, alasan }, pada);
    return { ok: true as const, butir: await butirLengkap(tx, id) };
  });
}

/**
 * Mengesahkan usulan - Super Admin, atas perintah yang disebut. Bila usulannya
 * pengganti (menggantikan_id), yang digantikan berhenti berlaku dalam
 * transaksi yang sama: tidak pernah ada saat keduanya berlaku, atau keduanya
 * tidak.
 */
export async function sahkan(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { id: unknown; atasPerintah?: unknown; alasan?: unknown }
): Promise<JawabanTindakan> {
  const aktor = await pastikanSuperAdmin(db, actorUserId);
  const atasPerintah = teks(masukan.atasPerintah);
  if (!atasPerintah) {
    throw new ApiError(400, "Atas perintah siapa butir ini disahkan wajib disebut.");
  }
  await pastikanBenihSekali(db);

  return withTransaction(db, async (tx) => {
    const baris = await ambilBaris(tx, masukan.id);
    if (baris.keadaan !== "usulan") {
      throw new ApiError(409, `Hanya usulan yang dapat disahkan; butir ini berkeadaan '${baris.keadaan}'.`);
    }
    const daftar = kunciDaftarAtau400(baris.daftar);
    const ketentuan = DAFTAR_TIPE[daftar];
    if (cerminDaftar(daftar) === null) throw new ApiError(409, kalimatDaftarTanpaCermin(daftar));
    if (ketentuan.perintahHakim) await pastikanPemberiPerintahHakim(tx, atasPerintah);
    if (ketentuan.jenis === "deteksi") {
      let hasil: unknown = null;
      try {
        hasil = uraiJson(baris.hasil_ukur);
      } catch {
        hasil = null;
      }
      const nilai = nilaiHasilUkur(daftar, hasil);
      if (!nilai.lulus) throw new ApiError(400, nilai.sebab);
    }
    // Diperiksa ulang: aturan dapat mengetat sesudah usulan masuk.
    let data: unknown = {};
    try {
      data = uraiJson(baris.data) ?? {};
    } catch {
      return { ok: false as const, alasan: ["Data usulan ini rusak (bukan JSON)."] };
    }
    const periksa = validasiEntri(daftar, { kunci: baris.kunci, nilai: baris.nilai, data });
    if (!periksa.ok) return { ok: false as const, alasan: periksa.alasan };

    const pada = new Date().toISOString();
    let digantikan: string | null = null;
    if (baris.menggantikan_id) {
      const lama = await ambilBaris(tx, baris.menggantikan_id);
      if (lama.keadaan !== "disahkan") {
        throw new ApiError(
          409,
          `Butir yang hendak digantikan (${lama.id}) berkeadaan '${lama.keadaan}' - tidak dapat digantikan lagi.`
        );
      }
      await tx.run("UPDATE aleta_tipe_keluaran SET keadaan = 'diganti', aktif = 0, diubah_at = ? WHERE id = ?", [pada, lama.id]);
      digantikan = lama.id;
    }
    const alasan = teks(masukan.alasan) || baris.alasan;
    const hasil = await tx.run(
      `UPDATE aleta_tipe_keluaran
          SET keadaan = 'disahkan', aktif = 1, disahkan_oleh = ?, atas_perintah = ?, disahkan_at = ?, alasan = ?, diubah_at = ?
        WHERE id = ? AND keadaan = 'usulan'`,
      [aktor.id, atasPerintah, pada, alasan, pada, baris.id]
    );
    if (hasil.changes !== 1) throw new ApiError(409, "Usulan berubah keadaannya saat disahkan; muat ulang lalu coba lagi.");
    await catatRiwayat(tx, {
      butirId: baris.id,
      tindakan: "sahkan",
      dari: { keadaan: "usulan" },
      ke: { keadaan: "disahkan", atasPerintah, menggantikan: digantikan },
      alasan,
      oleh: aktor.id,
      pada,
    });
    await catatAudit(tx, aktor.id, "sahkan", baris.id, { daftar, atasPerintah, menggantikan: digantikan, alasan }, pada);
    return { ok: true as const, butir: await butirLengkap(tx, baris.id) };
  });
}

/** Menolak usulan. Alasan wajib - usulan yang sama akan datang lagi. */
export async function tolak(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { id: unknown; alasan?: unknown }
): Promise<JawabanTindakan> {
  const aktor = await pastikanAdminIstimewa(db, actorUserId, "menolak usulan tipe keluaran");
  const alasan = teks(masukan.alasan);
  if (!alasan) throw new ApiError(400, "Alasan penolakan wajib diisi.");

  return withTransaction(db, async (tx) => {
    const baris = await ambilBaris(tx, masukan.id);
    if (baris.keadaan !== "usulan") {
      throw new ApiError(409, `Hanya usulan yang dapat ditolak; butir ini berkeadaan '${baris.keadaan}'.`);
    }
    const pada = new Date().toISOString();
    const hasil = await tx.run(
      "UPDATE aleta_tipe_keluaran SET keadaan = 'ditolak', alasan = ?, diubah_at = ? WHERE id = ? AND keadaan = 'usulan'",
      [alasan, pada, baris.id]
    );
    if (hasil.changes !== 1) throw new ApiError(409, "Usulan berubah keadaannya saat ditolak; muat ulang lalu coba lagi.");
    await catatRiwayat(tx, {
      butirId: baris.id,
      tindakan: "tolak",
      dari: { keadaan: "usulan" },
      ke: { keadaan: "ditolak" },
      alasan,
      oleh: aktor.id,
      pada,
    });
    await catatAudit(tx, aktor.id, "tolak", baris.id, { daftar: baris.daftar, alasan }, pada);
    return { ok: true as const, butir: await butirLengkap(tx, baris.id) };
  });
}

/** Mematikan butir yang sah - bawaan maupun tambahan. Alasan wajib. */
export async function matikan(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { id: unknown; alasan?: unknown }
): Promise<JawabanTindakan> {
  const aktor = await pastikanAdminIstimewa(db, actorUserId, "mematikan tipe keluaran");
  const alasan = teks(masukan.alasan);
  if (!alasan) throw new ApiError(400, "Alasan mematikan wajib diisi.");
  await pastikanBenihSekali(db);

  return withTransaction(db, async (tx) => {
    const baris = await ambilBaris(tx, masukan.id);
    if (baris.keadaan !== "disahkan") {
      throw new ApiError(409, `Hanya butir yang sah yang dapat dimatikan; butir ini berkeadaan '${baris.keadaan}'.`);
    }
    if (!bendera(baris.aktif)) throw new ApiError(409, "Butir ini sudah mati.");
    const pada = new Date().toISOString();
    await tx.run("UPDATE aleta_tipe_keluaran SET aktif = 0, alasan = ?, diubah_at = ? WHERE id = ?", [alasan, pada, baris.id]);
    await catatRiwayat(tx, {
      butirId: baris.id,
      tindakan: "matikan",
      dari: { aktif: 1 },
      ke: { aktif: 0 },
      alasan,
      oleh: aktor.id,
      pada,
    });
    await catatAudit(tx, aktor.id, "matikan", baris.id, { daftar: baris.daftar, asal: baris.asal, alasan }, pada);
    return { ok: true as const, butir: await butirLengkap(tx, baris.id) };
  });
}

/**
 * Menyalakan kembali butir yang dimatikan, atau butir yang sudah digantikan
 * bila penggantinya tidak lagi berlaku (jalan kembali dari penggantian).
 * Alasan wajib.
 */
export async function nyalakan(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { id: unknown; alasan?: unknown }
): Promise<JawabanTindakan> {
  const aktor = await pastikanAdminIstimewa(db, actorUserId, "menyalakan tipe keluaran");
  const alasan = teks(masukan.alasan);
  if (!alasan) throw new ApiError(400, "Alasan menyalakan wajib diisi.");
  await pastikanBenihSekali(db);

  return withTransaction(db, async (tx) => {
    const baris = await ambilBaris(tx, masukan.id);
    if (baris.keadaan !== "disahkan" && baris.keadaan !== "diganti") {
      throw new ApiError(409, `Hanya butir yang pernah sah yang dapat dinyalakan; butir ini berkeadaan '${baris.keadaan}'.`);
    }
    if (baris.keadaan === "disahkan" && bendera(baris.aktif)) throw new ApiError(409, "Butir ini sudah menyala.");
    if (baris.asal === "bawaan" && (!adalahKunciDaftar(baris.daftar) || !sidikCermin(baris.daftar).has(baris.sidik))) {
      throw new ApiError(409, "Butir bawaan ini yatim - nilainya tidak lagi ada di kode, jadi tidak dapat berlaku lagi.");
    }
    if (baris.keadaan === "diganti") {
      const pengganti = await tx.queryOne<{ id: string }>(
        "SELECT id FROM aleta_tipe_keluaran WHERE menggantikan_id = ? AND keadaan = 'disahkan' AND aktif = 1 LIMIT 1",
        [baris.id]
      );
      if (pengganti) {
        throw new ApiError(409, `Butir ini digantikan ${pengganti.id} yang masih berlaku - matikan penggantinya lebih dahulu.`);
      }
    }
    const pada = new Date().toISOString();
    await tx.run("UPDATE aleta_tipe_keluaran SET keadaan = 'disahkan', aktif = 1, alasan = ?, diubah_at = ? WHERE id = ?", [
      alasan,
      pada,
      baris.id,
    ]);
    await catatRiwayat(tx, {
      butirId: baris.id,
      tindakan: "nyalakan",
      dari: { aktif: 0, keadaan: baris.keadaan },
      ke: { aktif: 1, keadaan: "disahkan" },
      alasan,
      oleh: aktor.id,
      pada,
    });
    await catatAudit(tx, aktor.id, "nyalakan", baris.id, { daftar: baris.daftar, asal: baris.asal, alasan }, pada);
    return { ok: true as const, butir: await butirLengkap(tx, baris.id) };
  });
}

/**
 * Mengusulkan PENGGANTI butir yang sah (versi + 1, menggantikan_id). Bawaan
 * tidak pernah disunting - ia digantikan. Pengganti masuk sebagai usulan dan
 * baru berlaku ketika disahkan; sampai saat itu yang lama tetap berlaku.
 */
export async function ganti(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { id: unknown; kunci?: unknown; nilai?: unknown; data?: unknown; alasan?: unknown }
): Promise<JawabanTindakan> {
  const aktor = await pastikanAdminIstimewa(db, actorUserId, "mengusulkan pengganti tipe keluaran");
  await pastikanBenihSekali(db);

  return withTransaction(db, async (tx) => {
    const lama = await ambilBaris(tx, masukan.id);
    if (lama.keadaan !== "disahkan") {
      throw new ApiError(409, `Hanya butir yang sah yang dapat diganti; butir ini berkeadaan '${lama.keadaan}'.`);
    }
    const daftar = kunciDaftarAtau400(lama.daftar);
    if (cerminDaftar(daftar) === null) throw new ApiError(409, kalimatDaftarTanpaCermin(daftar));
    const cermin = sidikCermin(daftar);
    if (lama.asal === "bawaan" && !cermin.has(lama.sidik)) {
      throw new ApiError(409, "Butir bawaan ini yatim - tidak ada lagi yang dapat digantikan.");
    }
    if (masukan.kunci !== undefined && masukan.kunci !== null && masukan.kunci !== lama.kunci) {
      return { ok: false as const, alasan: [`Pengganti harus berkunci sama dengan yang digantikan ('${lama.kunci}').`] };
    }
    const periksa = validasiEntri(daftar, { kunci: lama.kunci, nilai: masukan.nilai, data: masukan.data });
    if (!periksa.ok) return { ok: false as const, alasan: periksa.alasan };
    const { kunci, nilai, data } = periksa.entri;
    const s = hitungSidik(daftar, kunci, nilai, data);
    if (s === lama.sidik) return { ok: false as const, alasan: ["Pengganti sama persis dengan yang digantikan."] };
    if (cermin.has(s)) {
      return { ok: false as const, alasan: ["Pengganti sama persis dengan salah satu bawaan - nyalakan bawaannya."] };
    }
    const kembar = await tx.queryOne<{ id: string; keadaan: string }>(
      "SELECT id, keadaan FROM aleta_tipe_keluaran WHERE daftar = ? AND sidik = ?",
      [daftar, s]
    );
    if (kembar) return { ok: false as const, alasan: [`Entri yang sama sudah ada (${kembar.id}, ${kembar.keadaan}).`] };
    const tertunda = await tx.queryOne<{ id: string }>(
      "SELECT id FROM aleta_tipe_keluaran WHERE menggantikan_id = ? AND keadaan = 'usulan' LIMIT 1",
      [lama.id]
    );
    if (tertunda) {
      return { ok: false as const, alasan: [`Sudah ada usulan pengganti ${tertunda.id} yang menunggu disahkan atau ditolak.`] };
    }

    const pada = new Date().toISOString();
    const id = await nextPrefixedId(tx, "aleta_tipe_keluaran", "tpk");
    const versi = angka(lama.versi, 1) + 1;
    const alasan = teks(masukan.alasan);
    const nilaiLama = lama.asal === "bawaan" ? (cermin.get(lama.sidik)?.nilai ?? lama.nilai) : lama.nilai;
    await tx.run(
      `INSERT INTO aleta_tipe_keluaran
         (id, golongan, daftar, kunci, nilai, data, asal, sidik, aktif, keadaan, urutan, versi,
          menggantikan_id, alasan, hasil_ukur, dibuat_oleh, dibuat_at, disahkan_oleh, atas_perintah,
          disahkan_at, diubah_at)
       VALUES (?, ?, ?, ?, ?, ?, 'tambahan', ?, 1, 'usulan', ?, ?, ?, ?, NULL, ?, ?, NULL, NULL, NULL, ?)`,
      [id, DAFTAR_TIPE[daftar].golongan, daftar, kunci, nilai, jsonKanonik(data), s, angka(lama.urutan), versi, lama.id, alasan, aktor.id, pada, pada]
    );
    await catatRiwayat(tx, {
      butirId: id,
      tindakan: "ganti",
      dari: { id: lama.id, nilai: nilaiLama, versi: angka(lama.versi, 1) },
      ke: { id, nilai, data, versi },
      alasan,
      oleh: aktor.id,
      pada,
    });
    await catatAudit(tx, aktor.id, "ganti", id, { daftar, menggantikan: lama.id, nilai, data, alasan }, pada);
    return { ok: true as const, butir: await butirLengkap(tx, id) };
  });
}

// ============================================================================
// GERBANG UKUR (K13) DAN CALON UNTUK PRATINJAU - Tahap 3
// ============================================================================

/**
 * Ambang K13, dari kontrak.ts - satu tempat bagi penjagaan sahkan, penyimpan
 * hasil ukur, dan layar. Diekspor ulang di sini supaya pemakai modul tidak
 * perlu tahu letaknya.
 */
export { AMBANG_UKUR } from "@/lib/tipe-keluaran/kontrak";

/** Satu butir sebagai calon: entri yang AKAN berlaku bila ia disahkan. */
export type CalonTipe = {
  id: string;
  daftar: KunciDaftar;
  keadaan: string;
  /** Bentuk EntriTipe (K3), asal 'tambahan'. */
  entri: EntriTipe;
  /** Sidik butir yang akan digantikannya (bila usulan pengganti). */
  menggantikanSidik: string | null;
};

/**
 * Membaca satu butir sebagai calon. Hanya tambahan - bawaan sudah berlaku,
 * tidak ada yang perlu diukur atau dipratinjau darinya.
 */
export async function bacaCalon(db: AletaDatabase, id: unknown): Promise<CalonTipe> {
  const baris = await ambilBaris(db, id);
  if (baris.asal !== "tambahan") {
    throw new ApiError(400, "Hanya tambahan yang dapat diukur atau dipratinjau; bawaan sudah berlaku dari kode.");
  }
  const daftar = kunciDaftarAtau400(baris.daftar);
  let data: DataEntri = {};
  try {
    const urai = uraiJson(baris.data);
    data = urai && typeof urai === "object" && !Array.isArray(urai) ? (urai as DataEntri) : {};
  } catch {
    throw new ApiError(409, `Data butir ${baris.id} rusak (bukan JSON); tidak dapat diukur.`);
  }
  let menggantikanSidik: string | null = null;
  if (baris.menggantikan_id) {
    const lama = await db.queryOne<{ sidik: string }>("SELECT sidik FROM aleta_tipe_keluaran WHERE id = ?", [
      baris.menggantikan_id,
    ]);
    menggantikanSidik = lama?.sidik ?? null;
  }
  return {
    id: baris.id,
    daftar,
    keadaan: baris.keadaan,
    entri: {
      kunci: baris.kunci,
      nilai: baris.nilai,
      data,
      urutan: angka(baris.urutan),
      asal: "tambahan",
      sidik: baris.sidik,
    },
    menggantikanSidik,
  };
}

/**
 * Daftar efektif SEKARANG dan daftar efektif SEANDAINYA calon disahkan -
 * aturan gabungan yang sama (K3): calon ditumpuk di atas efektif, dan yang
 * digantikannya dibuang. Dipakai ukur (dasar tanpa/dengan) dan pratinjau.
 */
export async function efektifDenganCalon(
  db: AletaDatabase,
  calon: CalonTipe,
  daftar: readonly KunciDaftar[]
): Promise<{ tanpa: HasilEfektif; dengan: Partial<Record<KunciDaftar, EntriTipe[]>>; versiDengan: string }> {
  const diminta = daftar.includes(calon.daftar) ? daftar : [...daftar, calon.daftar];
  const tanpa = await bacaEfektif(db, diminta);
  const dengan: Partial<Record<KunciDaftar, EntriTipe[]>> = { ...tanpa.daftar };
  const lama = (tanpa.daftar[calon.daftar] ?? []).filter(
    (e) => e.sidik !== calon.entri.sidik && e.sidik !== calon.menggantikanSidik
  );
  dengan[calon.daftar] = [...lama, calon.entri];
  return { tanpa, dengan, versiDengan: versiDari(dengan) };
}

/**
 * Menyimpan hasil ukur sebuah USULAN daftar deteksi. Satu riwayat 'ukur' dan
 * satu audit TIPE_KELUARAN_UKUR dalam satu transaksi. Hasil yang tidak lulus
 * TETAP disimpan - "sudah diukur, dan gagal" adalah keterangan, dan sahkan
 * menolaknya dengan sebab yang sama (nilaiHasilUkur).
 */
export async function simpanHasilUkur(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { id: unknown; hasil: HasilUkur }
): Promise<{ ok: true; butir: ButirTipe; penilaian: { lulus: boolean; sebab: string } }> {
  const aktor = await pastikanAdminIstimewa(db, actorUserId, "mengukur tipe keluaran");
  return withTransaction(db, async (tx) => {
    const baris = await ambilBaris(tx, masukan.id);
    if (baris.keadaan !== "usulan") {
      throw new ApiError(409, `Hanya usulan yang diukur; butir ini berkeadaan '${baris.keadaan}'.`);
    }
    const daftar = kunciDaftarAtau400(baris.daftar);
    const ketentuan = DAFTAR_TIPE[daftar];
    if (ketentuan.jenis !== "deteksi" || !ketentuan.ukur) {
      throw new ApiError(400, `Daftar ${daftar} bukan daftar deteksi; tidak ada gerbang ukur.`);
    }
    if (!masukan.hasil || masukan.hasil.jenis !== ketentuan.ukur) {
      throw new ApiError(400, `Hasil ukur harus berjenis '${ketentuan.ukur}'.`);
    }
    const pada = new Date().toISOString();
    const hasil = { ...masukan.hasil, diukurPada: masukan.hasil.diukurPada ?? pada };
    const penilaian = nilaiHasilUkur(daftar, hasil);
    let lamaHasil: unknown = null;
    try {
      lamaHasil = uraiJson(baris.hasil_ukur);
    } catch {
      lamaHasil = { __rusak: baris.hasil_ukur };
    }
    const ubah = await tx.run(
      "UPDATE aleta_tipe_keluaran SET hasil_ukur = ?, diubah_at = ? WHERE id = ? AND keadaan = 'usulan'",
      [jsonKanonik(hasil), pada, baris.id]
    );
    if (ubah.changes !== 1) throw new ApiError(409, "Usulan berubah keadaannya saat diukur; muat ulang lalu coba lagi.");
    const alasan = penilaian.lulus ? "Lulus gerbang ukur." : `Tidak lulus gerbang ukur: ${penilaian.sebab}`;
    await catatRiwayat(tx, { butirId: baris.id, tindakan: "ukur", dari: lamaHasil, ke: hasil, alasan, oleh: aktor.id, pada });
    await catatAudit(tx, aktor.id, "ukur", baris.id, { daftar, hasil, lulus: penilaian.lulus }, pada);
    return { ok: true as const, butir: await butirLengkap(tx, baris.id), penilaian };
  });
}

/**
 * Satu pintu untuk rute POST (K4): {tindakan, daftar, kunci?, nilai?, data?,
 * id?, alasan?, atasPerintah?}. Tindakan di luar enam itu -> 400.
 */
export async function jalankanTindakan(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  badan: Record<string, unknown>
): Promise<JawabanTindakan> {
  const tindakan = teks(badan.tindakan) as TindakanTipe;
  switch (tindakan) {
    case "usul":
      return usul(db, actorUserId, {
        daftar: badan.daftar,
        kunci: badan.kunci,
        nilai: badan.nilai,
        data: badan.data,
        alasan: badan.alasan,
        urutan: badan.urutan,
      });
    case "sahkan":
      return sahkan(db, actorUserId, { id: badan.id, atasPerintah: badan.atasPerintah, alasan: badan.alasan });
    case "tolak":
      return tolak(db, actorUserId, { id: badan.id, alasan: badan.alasan });
    case "matikan":
      return matikan(db, actorUserId, { id: badan.id, alasan: badan.alasan });
    case "nyalakan":
      return nyalakan(db, actorUserId, { id: badan.id, alasan: badan.alasan });
    case "ganti":
      return ganti(db, actorUserId, {
        id: badan.id,
        kunci: badan.kunci,
        nilai: badan.nilai,
        data: badan.data,
        alasan: badan.alasan,
      });
    default:
      throw new ApiError(400, `Tindakan tipe keluaran harus salah satu dari ${TINDAKAN_TIPE.join(", ")}.`);
  }
}
