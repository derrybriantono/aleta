import {
  AMBANG_WAJIB,
  BATAS_SIMPAN,
  MINIMAL_PERKARA,
  cocokkanJenis,
  kodeVariabel,
  kunciJenis,
  persenTerisi,
  susunHasilUkur,
  type HasilUkurBot,
} from "@/lib/abt-wajib";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { bolehMenyuntingAkses } from "@/server/modules/aleta-ecourt/akses";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * VARIABEL WAJIB ABT SEBELUM CETAK (KONTRAK TAHAP 6-7 BAGIAN 3)
 * ============================================================================
 *
 * Satu-satunya jalan SQL ke aleta_abt_variabel_wajib.
 *
 *   membaca      semua pegawai yang masuk (ekstensi, sebelum CETAK di ABT)
 *   mengubah     Super Admin - menyalakan/mematikan, menambah kode, ukur ulang
 *
 * ============================================================================
 * DARI MANA DAFTARNYA
 * ============================================================================
 *
 * "Ukur ulang" meminta jembatan bot operasi abt.ukurVariabelTerisi - HANYA
 * SELECT atas abt_data_teks/abt_data_tanggal perkara yang sudah diputus.
 * Hasilnya disimpan di sini; ekstensi tidak pernah menunggu pengukuran.
 * Ambang (90%, minimal 10 putusan, simpan >= 50%) diterapkan portal lewat
 * src/lib/abt-wajib.ts supaya satu tempat yang menentukannya.
 *
 * Saklar yang pernah disentuh Super Admin (ditetapkan_admin = 1) TIDAK
 * ditimpa ukur ulang - hanya angkanya yang diperbarui. Tanpa itu, variabel
 * yang sengaja dimatikan karena sering berbunyi palsu akan menyala lagi
 * diam-diam tiap kali seseorang menekan Ukur ulang.
 */

export type VariabelWajib = {
  kode: string;
  nama: string | null;
  sumber: "ukur" | "admin";
  persenTerisi: number | null;
  aktif: boolean;
  jumlahPerkara: number | null;
  jumlahTerisi: number | null;
  ditetapkanAdmin: boolean;
};

export type WajibJenis = {
  jenis: string;
  jenisNama: string;
  variabel: VariabelWajib[];
  diukurPada: string | null;
  catatan: string;
};

type BarisDb = Record<string, unknown>;

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

function angkaAtauNull(nilai: unknown): number | null {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  const n = Number(nilai);
  return Number.isFinite(n) ? n : null;
}

function bentuk(b: BarisDb): VariabelWajib {
  const n = angkaAtauNull(b.jumlah_perkara);
  const t = angkaAtauNull(b.jumlah_terisi);
  return {
    kode: teks(b.kode),
    nama: teks(b.nama) || null,
    sumber: teks(b.sumber) === "admin" ? "admin" : "ukur",
    persenTerisi: persenTerisi(t, n),
    aktif: Number(b.aktif) === 1,
    jumlahPerkara: n,
    jumlahTerisi: t,
    ditetapkanAdmin: Number(b.ditetapkan_admin) === 1,
  };
}

const CATATAN_DASAR =
  `Peringatan saja - CETAK tidak ditahan. Diukur dari putusan: persen perkara jenis ini yang sudah diputus ` +
  `dan mengisi variabel itu di ABT, sejak variabel itu mulai dipakai. Wajib bila >= ${Math.round(AMBANG_WAJIB * 100)}% ` +
  `dari sedikitnya ${MINIMAL_PERKARA} putusan; Super Admin dapat menyalakan atau mematikannya.`;

async function jenisTersimpan(db: AletaDatabase): Promise<string[]> {
  const baris = await db.queryAll<{ jenis: string }>(`SELECT DISTINCT jenis FROM aleta_abt_variabel_wajib`);
  return baris.map((b) => teks(b.jenis)).filter(Boolean);
}

/** Daftar satu jenis perkara untuk ekstensi. */
export async function bacaWajib(db: AletaDatabase, jenisDiminta: unknown): Promise<WajibJenis> {
  const diminta = teks(jenisDiminta);
  if (!diminta) throw new ApiError(400, "Sebutkan jenis perkara.");
  const jenis = cocokkanJenis(diminta, await jenisTersimpan(db));
  if (!jenis) {
    return {
      jenis: diminta,
      jenisNama: diminta,
      variabel: [],
      diukurPada: null,
      catatan:
        "Belum ada variabel wajib untuk jenis perkara ini - belum pernah diukur, tidak ada variabel yang " +
        `mencapai ${Math.round(BATAS_SIMPAN * 100)}%, atau namanya tidak cocok. ` +
        CATATAN_DASAR,
    };
  }
  const baris = await db.queryAll<BarisDb>(
    `SELECT * FROM aleta_abt_variabel_wajib WHERE jenis = ? ORDER BY aktif DESC, kode`,
    [jenis]
  );
  const variabel = baris.map(bentuk).sort((a, b) => {
    if (a.aktif !== b.aktif) return a.aktif ? -1 : 1;
    return (b.persenTerisi ?? -1) - (a.persenTerisi ?? -1) || a.kode.localeCompare(b.kode);
  });
  const diukur = baris.map((b) => teks(b.diukur_pada)).filter(Boolean).sort();
  return {
    jenis,
    jenisNama: teks(baris.find((b) => teks(b.jenis_nama))?.jenis_nama) || diminta,
    variabel,
    diukurPada: diukur.length ? diukur[diukur.length - 1] : null,
    catatan: CATATAN_DASAR,
  };
}

/** Ringkasan semua jenis - untuk kartu admin. */
export async function daftarWajib(db: AletaDatabase): Promise<WajibJenis[]> {
  const semua = await jenisTersimpan(db);
  const hasil: WajibJenis[] = [];
  for (const jenis of semua) hasil.push(await bacaWajib(db, jenis));
  return hasil.sort((a, b) => b.variabel.length - a.variabel.length || a.jenisNama.localeCompare(b.jenisNama));
}

async function pastikanSuperAdmin(db: AletaDatabase, actorUserId: string | null | undefined) {
  const actor = await requireActorUser(db, actorUserId);
  if (!bolehMenyuntingAkses(actor)) {
    throw new ApiError(403, "Hanya Super Admin yang dapat mengubah variabel wajib ABT.");
  }
  return actor;
}

/**
 * Super Admin menyalakan/mematikan kode per jenis. Kode yang belum ada
 * ditambahkan bersumber 'admin'. Tiap kode yang disentuh menjadi
 * ditetapkan_admin = 1 - ukur ulang tidak menimpanya lagi.
 */
export async function simpanWajib(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { jenis?: unknown; variabel?: unknown }
): Promise<WajibJenis> {
  const actor = await pastikanSuperAdmin(db, actorUserId);
  const jenisNamaMentah = teks(masukan.jenis);
  if (!jenisNamaMentah) throw new ApiError(400, "Sebutkan jenis perkara.");
  if (jenisNamaMentah.length > 120) throw new ApiError(400, "Nama jenis perkara terlalu panjang.");
  const daftar = Array.isArray(masukan.variabel) ? masukan.variabel : null;
  if (!daftar || daftar.length === 0) throw new ApiError(400, "variabel harus larik [{kode, aktif}].");
  if (daftar.length > 200) throw new ApiError(400, "Paling banyak 200 variabel sekali simpan.");

  const bersih: Array<{ kode: string; aktif: boolean }> = [];
  for (const item of daftar) {
    const v = (item ?? {}) as { kode?: unknown; aktif?: unknown };
    const kode = kodeVariabel(v.kode);
    if (!kode) throw new ApiError(400, `Kode variabel tidak sah: ${String(v.kode ?? "")}`);
    if (typeof v.aktif !== "boolean") throw new ApiError(400, `aktif untuk ${kode} harus true atau false.`);
    bersih.push({ kode, aktif: v.aktif });
  }

  // Jenis yang sudah tersimpan dipakai kuncinya, supaya "Istbat Nikah" dari
  // layar tidak membuat jenis kedua di samping "Pengesahan Perkawinan/...".
  const jenis = cocokkanJenis(jenisNamaMentah, await jenisTersimpan(db)) ?? kunciJenis(jenisNamaMentah);
  if (!jenis) throw new ApiError(400, "Jenis perkara tidak sah.");
  const pada = new Date().toISOString();

  await withTransaction(db, async (tx) => {
    for (const { kode, aktif } of bersih) {
      const ada = await tx.queryOne<BarisDb>(`SELECT kode FROM aleta_abt_variabel_wajib WHERE jenis = ? AND kode = ?`, [
        jenis,
        kode,
      ]);
      if (ada) {
        await tx.run(
          `UPDATE aleta_abt_variabel_wajib SET aktif = ?, ditetapkan_admin = 1, diubah_oleh = ?, diubah_pada = ?
            WHERE jenis = ? AND kode = ?`,
          [aktif ? 1 : 0, actor.id, pada, jenis, kode]
        );
      } else {
        await tx.run(
          `INSERT INTO aleta_abt_variabel_wajib
             (jenis, kode, jenis_nama, nama, sumber, aktif, ditetapkan_admin, diubah_oleh, diubah_pada)
           VALUES (?, ?, ?, '', 'admin', ?, 1, ?, ?)`,
          [jenis, kode, jenisNamaMentah, aktif ? 1 : 0, actor.id, pada]
        );
      }
    }
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_ABT_REQUIRED_VARIABLES",
      entityType: "aleta_abt_variabel_wajib",
      entityId: jenis,
      payload: { jenis, variabel: bersih },
    });
  });

  return bacaWajib(db, jenis);
}

/**
 * Menerapkan hasil ukur bot. Dipisah dari pemanggilan bot supaya dapat diuji
 * dengan hasil ukur sungguhan tanpa jembatan.
 */
export async function terapkanHasilUkur(
  db: AletaDatabase,
  actorId: string,
  hasil: HasilUkurBot
): Promise<{ disimpan: number; dihapus: number; jenis: number; diukurPada: string }> {
  const baris = susunHasilUkur(hasil);
  const diukurPada = teks(hasil.diukurPada) || new Date().toISOString();
  const pada = new Date().toISOString();
  let dihapus = 0;

  await withTransaction(db, async (tx) => {
    const lama = await tx.queryAll<BarisDb>(
      `SELECT jenis, kode, nama, sumber, aktif, ditetapkan_admin FROM aleta_abt_variabel_wajib`
    );
    const baru = new Set(baris.map((b) => `${b.jenis}\u0000${b.kode}`));

    // Hasil ukur lama yang tidak lagi lolos dan belum pernah disentuh Super
    // Admin dibuang; yang pernah disentuh tetap, dengan angka lamanya.
    for (const b of lama) {
      const kunci = `${teks(b.jenis)}\u0000${teks(b.kode)}`;
      if (baru.has(kunci)) continue;
      if (teks(b.sumber) === "ukur" && Number(b.ditetapkan_admin) !== 1) {
        await tx.run(`DELETE FROM aleta_abt_variabel_wajib WHERE jenis = ? AND kode = ?`, [teks(b.jenis), teks(b.kode)]);
        dihapus += 1;
      }
    }

    const lamaPeta = new Map(lama.map((b) => [`${teks(b.jenis)}\u0000${teks(b.kode)}`, b]));
    for (const b of baris) {
      const ada = lamaPeta.get(`${b.jenis}\u0000${b.kode}`);
      if (ada) {
        // Nilai dihitung di sini, bukan dengan CASE atas parameter di SQL:
        // pg-mem dan Postgres menebak jenis parameter di dalam CASE secara
        // berbeda, dan yang gagal di salah satunya mematikan mode cadangan.
        const dipegangAdmin = Number(ada.ditetapkan_admin) === 1;
        const aktif = dipegangAdmin ? (Number(ada.aktif) === 1 ? 1 : 0) : b.aktifBawaan ? 1 : 0;
        const nama = b.nama || teks(ada.nama);
        await tx.run(
          `UPDATE aleta_abt_variabel_wajib
              SET jenis_nama = ?, nama = ?, jumlah_perkara = ?, jumlah_terisi = ?, diukur_pada = ?, diubah_pada = ?,
                  aktif = ?
            WHERE jenis = ? AND kode = ?`,
          [b.jenisNama, nama, b.jumlahPerkara, b.jumlahTerisi, diukurPada, pada, aktif, b.jenis, b.kode]
        );
      } else {
        await tx.run(
          `INSERT INTO aleta_abt_variabel_wajib
             (jenis, kode, jenis_nama, nama, sumber, jumlah_perkara, jumlah_terisi, aktif, ditetapkan_admin,
              diukur_pada, diubah_oleh, diubah_pada)
           VALUES (?, ?, ?, ?, 'ukur', ?, ?, ?, 0, ?, ?, ?)`,
          [b.jenis, b.kode, b.jenisNama, b.nama, b.jumlahPerkara, b.jumlahTerisi, b.aktifBawaan ? 1 : 0, diukurPada, actorId, pada]
        );
      }
    }

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actorId,
      action: "MEASURE_ABT_REQUIRED_VARIABLES",
      entityType: "aleta_abt_variabel_wajib",
      entityId: "ukur-ulang",
      payload: { disimpan: baris.length, dihapus, diukurPada, jumlahPerkaraDasar: hasil.jumlahPerkaraDasar ?? null },
    });
  });

  return { disimpan: baris.length, dihapus, jenis: new Set(baris.map((b) => b.jenis)).size, diukurPada };
}

/** Super Admin: ukur ulang lewat jembatan bot (SELECT saja), lalu simpan. */
export async function ukurUlangWajib(db: AletaDatabase, actorUserId: string | null | undefined) {
  const actor = await pastikanSuperAdmin(db, actorUserId);
  // Empat kueri atas seluruh isian ABT - lebih lama dari bacaan biasa.
  const jawaban = await callAletaBotSippBridge<HasilUkurBot>("abt.ukurVariabelTerisi", {}, { timeoutMs: 60000 });
  // Sebab teknisnya di `details`, bukan di pesan: pesan yang memuat
  // ECONNREFUSED dan sejenisnya diganti penyaring galat menjadi kalimat umum,
  // dan "daftar lama tidak diubah" - yang paling perlu dibaca - ikut hilang.
  if (!jawaban.ok) {
    throw new ApiError(502, "Pengukuran belum dapat dijalankan: jembatan ke APS Badilag tidak menjawab. Daftar lama tidak diubah.", {
      sebab: jawaban.error ?? "",
    });
  }
  const data = jawaban.data ?? {};
  if (data.ada === false) {
    throw new ApiError(502, "Pengukuran belum dapat dijalankan: APS Badilag tidak terbaca. Daftar lama tidak diubah.", {
      sebab: data.sebab ?? "",
    });
  }
  return terapkanHasilUkur(db, String(actor.id), data);
}
