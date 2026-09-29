import { createHash } from "node:crypto";

import { BAGIAN_FITUR_EKSTENSI, DAFTAR_FITUR_EKSTENSI } from "@/lib/daftar-fitur-ekstensi";
import { roles as defaultRoles } from "@/lib/mock-data";
import {
  BATAS_BITA_SETELAN,
  GalatSetelan,
  KUNCI_PENGATURAN_SINKRON,
  KUNCI_SETELAN,
  LABEL_MODE_TAMPILAN,
  bersihkanFitur,
  fiturTakDikenal,
  kunciSetelanSah,
  lingkupTampilanSah,
  modeTampilanSah,
  normalkanSetelan,
  pecahkanTampilan,
  type KunciSetelan,
  type LingkupTampilan,
  type ModeTampilan,
  type PenerapanTampilan,
  type SumberTampilan,
  type TampilanBerlaku,
} from "@/lib/tampilan-ekstensi";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { bolehMenyuntingAkses } from "@/server/modules/aleta-ecourt/akses";
import { getUsersFromDb, requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * TAMPILAN EKSTENSI YANG DITERAPKAN, DAN SETELAN PRIBADI EKSTENSI
 * ============================================================================
 *
 * Satu-satunya modul yang menyentuh aleta_ekstensi_tampilan dan
 * aleta_ekstensi_setelan (migrasi 0052). Aturan pemecahannya ada di
 * src/lib/tampilan-ekstensi.ts sebagai fungsi murni; di sini hanya membaca,
 * memeriksa kewenangan, menyimpan, dan mencatat audit.
 *
 * ============================================================================
 * KEWENANGAN - SAMA DENGAN HALAMAN AKSES EKSTENSI
 * ============================================================================
 *
 * Membaca daftar penerapan: Super Admin dan Admin (pastikanAdminIstimewa di
 * rute). Menerapkan dan menghapus: HANYA Super Admin (bolehMenyuntingAkses) -
 * menerapkan tampilan mengubah layar kerja setiap orang yang terkena, dan itu
 * perbuatan yang sama beratnya dengan memberi kewenangan.
 *
 * Tampilan dan setelan milik pengguna sendiri dibaca oleh siapa saja yang
 * masuk - selalu tentang PEMANGGILNYA, tidak pernah tentang orang lain.
 */

type BarisTampilan = {
  lingkup: string;
  sasaran: string;
  mode: string;
  fitur: string;
  catatan: string | null;
  diubah_oleh: string;
  diubah_pada: string;
};

function uraiJson(teks: string | null | undefined): unknown {
  try {
    return JSON.parse(String(teks ?? ""));
  } catch {
    return null;
  }
}

/**
 * Seluruh penerapan. Baris yang lingkup atau modenya tidak sah (disunting
 * tangan di basis data) dilewati, dan fiturnya dibersihkan lagi saat dibaca -
 * kode yang sudah tidak dikenal tidak ikut terkirim.
 */
export async function bacaPenerapan(db: AletaDatabase): Promise<PenerapanTampilan[]> {
  const baris = await db
    .prepare(
      "SELECT lingkup, sasaran, mode, fitur, catatan, diubah_oleh, diubah_pada FROM aleta_ekstensi_tampilan " +
        "ORDER BY lingkup ASC, sasaran ASC"
    )
    .all<BarisTampilan>();

  const hasil: PenerapanTampilan[] = [];
  for (const b of baris) {
    if (!lingkupTampilanSah(b.lingkup) || !modeTampilanSah(b.mode)) continue;
    hasil.push({
      lingkup: b.lingkup,
      sasaran: String(b.sasaran ?? ""),
      mode: b.mode,
      fitur: bersihkanFitur(uraiJson(b.fitur)),
      catatan: String(b.catatan ?? ""),
      diubahOleh: String(b.diubah_oleh ?? ""),
      diubahPada: String(b.diubah_pada ?? ""),
    });
  }
  return hasil;
}

/**
 * Sidik 16 heksa atas tampilan yang berlaku - ekstensi membandingkannya
 * dengan singgahannya untuk tahu tampilannya berubah tanpa membandingkan isi.
 */
export function versiTampilan(t: TampilanBerlaku): string {
  const kanonik = JSON.stringify({
    mode: t.mode,
    fitur: Object.keys(t.fitur).sort(),
    sumber: t.sumber,
    sasaranSumber: t.sasaranSumber,
    diterapkan: t.diterapkan,
    diubahPada: t.diubahPada,
  });
  return createHash("sha256").update(kanonik).digest("hex").slice(0, 16);
}

const namaPeran = () => new Map<string, string>(defaultRoles.map((p) => [p.id, p.name]));

/** Kalimat sumber untuk layar - "Diterapkan ke peran Hakim", dsb. */
function labelSumber(sumber: SumberTampilan, sasaran: string, peran: Map<string, string>) {
  if (sumber === "pengguna") return "Diterapkan khusus untuk orang ini";
  if (sumber === "peran") return "Diterapkan ke peran " + (peran.get(sasaran) ?? sasaran);
  if (sumber === "semua") return "Diterapkan ke semua pegawai";
  return "Bawaan (belum ada yang diterapkan)";
}

// ============================================================================
// UNTUK EKSTENSI - PEMANGGILNYA SENDIRI
// ============================================================================

export type SetelanTersimpan = { nilai: unknown; diubahPada: string };

export async function bacaSetelanPengguna(
  db: AletaDatabase,
  penggunaId: string
): Promise<Partial<Record<KunciSetelan, SetelanTersimpan>>> {
  const baris = await db
    .prepare("SELECT kunci, nilai, diubah_pada FROM aleta_ekstensi_setelan WHERE pengguna_id = ?")
    .all<{ kunci: string; nilai: string; diubah_pada: string }>(penggunaId);

  const hasil: Partial<Record<KunciSetelan, SetelanTersimpan>> = {};
  for (const b of baris) {
    // Kunci yang pernah diizinkan lalu dicabut dari daftar putih tidak lagi
    // dikirim - daftar putih berlaku saat membaca juga, bukan hanya saat menulis.
    if (!kunciSetelanSah(b.kunci)) continue;
    hasil[b.kunci] = { nilai: uraiJson(b.nilai), diubahPada: String(b.diubah_pada) };
  }
  return hasil;
}

export function keteranganSetelan() {
  return {
    kunci: [...KUNCI_SETELAN],
    batasBita: BATAS_BITA_SETELAN,
    pengaturanSinkron: [...KUNCI_PENGATURAN_SINKRON],
  };
}

/** Jawaban GET /api/aleta-ecourt/ekstensi/tampilan. */
export async function tampilanUntukPengguna(
  db: AletaDatabase,
  pengguna: { id: string; roleId: string; additionalRoleIds?: string[] }
) {
  const tampilan = pecahkanTampilan(await bacaPenerapan(db), pengguna);
  return {
    tampilan: {
      ...tampilan,
      labelMode: LABEL_MODE_TAMPILAN[tampilan.mode],
      labelSumber: labelSumber(tampilan.sumber, tampilan.sasaranSumber, namaPeran()),
    },
    versi: versiTampilan(tampilan),
    setelan: await bacaSetelanPengguna(db, pengguna.id),
    keteranganSetelan: keteranganSetelan(),
    dibuatPada: new Date().toISOString(),
  };
}

/**
 * Menyimpan atau menghapus satu setelan milik PEMANGGILNYA SENDIRI.
 *
 * `nilai === null` menghapus setelannya. `jikaDiubahPada` (boleh tidak ada)
 * adalah penjaga dua PC yang menulis bersamaan: bila diisi dan tidak sama
 * dengan diubah_pada yang tersimpan ('' = belum pernah tersimpan), jawabannya
 * 409 dan tidak ada yang ditimpa. Tanpa ruas itu, yang terakhir menulis menang.
 *
 * Tidak dicatat di audit_logs: ini selera pribadi yang berubah berkali-kali
 * sehari, bukan perubahan administrasi.
 */
export async function simpanSetelanPengguna(
  db: AletaDatabase,
  penggunaId: string,
  masukan: { kunci: unknown; nilai: unknown; jikaDiubahPada?: unknown }
) {
  const sekarang = new Date();
  if (!kunciSetelanSah(masukan.kunci)) {
    throw new ApiError(400, `Kunci setelan tidak diizinkan. Yang diizinkan: ${KUNCI_SETELAN.join(", ")}.`);
  }
  const kunci = masukan.kunci;

  let normal: ReturnType<typeof normalkanSetelan> | null = null;
  if (masukan.nilai !== null) {
    try {
      normal = normalkanSetelan(kunci, masukan.nilai, sekarang);
    } catch (galat) {
      if (galat instanceof GalatSetelan) throw new ApiError(400, galat.message);
      throw galat;
    }
  }

  return withTransaction(db, async (tx) => {
    const lama = await tx
      .prepare("SELECT diubah_pada FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?")
      .all<{ diubah_pada: string }>(penggunaId, kunci);
    const diubahPadaLama = lama[0]?.diubah_pada ?? "";

    if (masukan.jikaDiubahPada !== undefined && masukan.jikaDiubahPada !== null) {
      if (String(masukan.jikaDiubahPada) !== diubahPadaLama) {
        throw new ApiError(
          409,
          "Setelan ini sudah diubah dari PC lain. Muat ulang setelannya lalu ulangi perubahan Anda.",
          { kunci, diubahPadaSekarang: diubahPadaLama || null }
        );
      }
    }

    if (!normal) {
      await tx.prepare("DELETE FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?").run(penggunaId, kunci);
      return { kunci, nilai: null, diubahPada: null, dihapus: true, dibuang: [] as string[] };
    }

    // Cap waktu harus berbeda dari yang lama, walau dua tulisan jatuh pada
    // milidetik yang sama - penjaga jikaDiubahPada bergantung padanya.
    let pada = sekarang.toISOString();
    if (pada <= diubahPadaLama) pada = new Date(new Date(diubahPadaLama).getTime() + 1).toISOString();

    await tx
      .prepare(
        "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada"
      )
      .run(penggunaId, kunci, normal.json, pada);

    return { kunci, nilai: normal.nilai, diubahPada: pada, dihapus: false, dibuang: normal.dibuang };
  });
}

// ============================================================================
// UNTUK HALAMAN ADMIN
// ============================================================================

export type PenerapanDenganLabel = PenerapanTampilan & {
  labelSasaran: string;
  labelMode: string;
  jumlahFitur: number;
  /** false bila peran/orang sasarannya sudah tidak ada - baris itu tidak berlaku bagi siapa pun. */
  sasaranAda: boolean;
};

export type PegawaiTampilan = {
  userId: string;
  nama: string;
  username: string;
  peran: string;
  labelPeran: string;
  mode: ModeTampilan;
  labelMode: string;
  sumber: SumberTampilan;
  sasaranSumber: string;
  labelSumber: string;
  jumlahFitur: number;
};

async function daftarPeran(db: AletaDatabase) {
  const nama = namaPeran();
  const baris = await db.prepare("SELECT id FROM roles ORDER BY id ASC").all<{ id: string }>();
  return baris.map((b) => ({ roleId: b.id, label: nama.get(b.id) ?? b.id }));
}

/**
 * Seluruh yang dibutuhkan halaman admin dalam satu jawaban: penerapan,
 * pilihan peran, daftar fitur (dari server, bukan diketik di layar), dan
 * ringkasan "siapa mendapat apa" yang dihitung dengan aturan yang SAMA
 * dengan yang dipakai ekstensi.
 */
export async function bacaHalamanTampilan(db: AletaDatabase, actor: { roleId?: string | null }) {
  const penerapan = await bacaPenerapan(db);
  const peran = await daftarPeran(db);
  const nama = namaPeran();
  const pengguna = (await getUsersFromDb(db)).filter((u) => u.isActive);
  const penggunaPerId = new Map(pengguna.map((u) => [u.id, u]));
  const peranAda = new Set(peran.map((p) => p.roleId));

  const denganLabel: PenerapanDenganLabel[] = penerapan.map((p) => {
    const orang = p.lingkup === "pengguna" ? penggunaPerId.get(p.sasaran) : undefined;
    const labelSasaran =
      p.lingkup === "semua"
        ? "Semua pegawai"
        : p.lingkup === "peran"
          ? "Peran " + (nama.get(p.sasaran) ?? p.sasaran)
          : orang
            ? orang.name + " (" + (nama.get(String(orang.roleId)) ?? orang.roleId) + ")"
            : "Pengguna " + p.sasaran;
    return {
      ...p,
      labelSasaran,
      labelMode: LABEL_MODE_TAMPILAN[p.mode],
      jumlahFitur: Object.keys(p.fitur).length,
      sasaranAda: p.lingkup === "semua" || (p.lingkup === "peran" ? peranAda.has(p.sasaran) : Boolean(orang)),
    };
  });

  const pegawai: PegawaiTampilan[] = pengguna.map((u) => {
    const t = pecahkanTampilan(penerapan, {
      id: u.id,
      roleId: String(u.roleId),
      additionalRoleIds: u.additionalRoleIds ?? [],
    });
    return {
      userId: u.id,
      nama: u.name,
      username: u.username,
      peran: String(u.roleId),
      labelPeran: nama.get(String(u.roleId)) ?? String(u.roleId),
      mode: t.mode,
      labelMode: LABEL_MODE_TAMPILAN[t.mode],
      sumber: t.sumber,
      sasaranSumber: t.sasaranSumber,
      labelSumber: labelSumber(t.sumber, t.sasaranSumber, nama),
      jumlahFitur: Object.keys(t.fitur).length,
    };
  });

  const jumlah: Record<ModeTampilan, number> = { lama: 0, baru: 0, ui: 0 };
  for (const p of pegawai) jumlah[p.mode] += 1;

  return {
    available: true,
    bolehMenyunting: bolehMenyuntingAkses(actor),
    penerapan: denganLabel,
    peran,
    bagian: BAGIAN_FITUR_EKSTENSI,
    daftarFitur: DAFTAR_FITUR_EKSTENSI,
    mode: (Object.keys(LABEL_MODE_TAMPILAN) as ModeTampilan[]).map((m) => ({ mode: m, label: LABEL_MODE_TAMPILAN[m] })),
    ringkasan: { jumlah, pegawai },
  };
}

/** Pencarian pegawai untuk penerapan per orang - dibatasi dua puluh hasil. */
export async function cariPegawaiTampilan(db: AletaDatabase, kata: string) {
  const bersih = String(kata || "").trim().toLowerCase();
  if (bersih.length < 2) return [];
  const penerapan = await bacaPenerapan(db);
  const nama = namaPeran();
  return (await getUsersFromDb(db))
    .filter((u) => u.isActive)
    .filter((u) => u.name.toLowerCase().includes(bersih) || u.username.toLowerCase().includes(bersih))
    .slice(0, 20)
    .map((u) => {
      const t = pecahkanTampilan(penerapan, {
        id: u.id,
        roleId: String(u.roleId),
        additionalRoleIds: u.additionalRoleIds ?? [],
      });
      return {
        userId: u.id,
        nama: u.name,
        username: u.username,
        labelPeran: nama.get(String(u.roleId)) ?? String(u.roleId),
        mode: t.mode,
        labelMode: LABEL_MODE_TAMPILAN[t.mode],
        sumber: t.sumber,
        labelSumber: labelSumber(t.sumber, t.sasaranSumber, nama),
      };
    });
}

async function pastikanPenyunting(db: AletaDatabase, actorUserId: string | null | undefined) {
  const actor = await requireActorUser(db, actorUserId);
  if (!bolehMenyuntingAkses(actor)) {
    throw new ApiError(403, "Hanya Super Admin yang dapat menerapkan tampilan ekstensi.");
  }
  return actor;
}

/** Memeriksa lingkup + sasaran; mengembalikan sasaran yang sudah dibersihkan. */
async function periksaSasaran(db: AletaDatabase, lingkup: unknown, sasaran: unknown) {
  if (!lingkupTampilanSah(lingkup)) {
    throw new ApiError(400, 'Lingkup harus "semua", "peran", atau "pengguna".');
  }
  const bersih = String(sasaran ?? "").trim();
  if (lingkup === "semua") return { lingkup, sasaran: "" };
  if (!bersih) throw new ApiError(400, lingkup === "peran" ? "Pilih peran sasarannya." : "Pilih pegawai sasarannya.");

  if (lingkup === "peran") {
    const ada = await db.prepare("SELECT id FROM roles WHERE id = ?").all<{ id: string }>(bersih);
    if (ada.length === 0) throw new ApiError(400, "Peran tidak dikenali.");
  } else {
    const ada = await db
      .prepare("SELECT id FROM users WHERE id = ? AND deleted_at IS NULL")
      .all<{ id: string }>(bersih);
    if (ada.length === 0) throw new ApiError(400, "Pengguna tidak dikenali.");
  }
  return { lingkup: lingkup as LingkupTampilan, sasaran: bersih };
}

/**
 * Menerapkan satu tampilan kepada satu sasaran - menimpa penerapan yang sudah
 * ada untuk sasaran yang sama. Kode fitur yang tidak dikenal dibuang dan
 * disebut di `fiturDibuang`.
 */
export async function terapkanTampilan(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { lingkup: unknown; sasaran?: unknown; mode: unknown; fitur?: unknown; catatan?: unknown }
) {
  const actor = await pastikanPenyunting(db, actorUserId);
  const { lingkup, sasaran } = await periksaSasaran(db, masukan.lingkup, masukan.sasaran);
  if (!modeTampilanSah(masukan.mode)) {
    throw new ApiError(400, 'Mode harus "lama", "baru", atau "ui".');
  }
  const mode = masukan.mode;
  const fitur = bersihkanFitur(masukan.fitur);
  const fiturDibuang = fiturTakDikenal(masukan.fitur);
  const catatan = String(masukan.catatan ?? "").trim().slice(0, 400);

  await withTransaction(db, async (tx) => {
    const sebelumnya = (await bacaPenerapan(tx)).find((p) => p.lingkup === lingkup && p.sasaran === sasaran) ?? null;
    const sekarang = new Date().toISOString();

    await tx
      .prepare(
        "INSERT INTO aleta_ekstensi_tampilan (lingkup, sasaran, mode, fitur, catatan, diubah_oleh, diubah_pada) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?) " +
          "ON CONFLICT (lingkup, sasaran) DO UPDATE SET " +
          "mode = excluded.mode, fitur = excluded.fitur, catatan = excluded.catatan, " +
          "diubah_oleh = excluded.diubah_oleh, diubah_pada = excluded.diubah_pada"
      )
      .run(lingkup, sasaran, mode, JSON.stringify(fitur), catatan, actor.id, sekarang);

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_ECOURT_EXTENSION_DISPLAY",
      entityType: "aleta_ekstensi_tampilan",
      entityId: lingkup + ":" + sasaran,
      payload: {
        lingkup,
        sasaran,
        mode,
        fitur: Object.keys(fitur),
        catatan,
        sebelumnya: sebelumnya ? { mode: sebelumnya.mode, fitur: Object.keys(sebelumnya.fitur) } : null,
      },
    });
  });

  return { ...(await bacaHalamanTampilan(db, actor)), fiturDibuang };
}

/**
 * Menghapus satu penerapan - sasarannya kembali mengikuti lingkup yang lebih
 * luas (orang -> peran -> semua -> bawaan Lama). Tercatat di audit beserta
 * isi yang dihapus, supaya "tampilan apa yang dulu diterapkan" tetap terjawab.
 */
export async function hapusPenerapan(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { lingkup: unknown; sasaran?: unknown }
) {
  const actor = await pastikanPenyunting(db, actorUserId);
  if (!lingkupTampilanSah(masukan.lingkup)) {
    throw new ApiError(400, 'Lingkup harus "semua", "peran", atau "pengguna".');
  }
  const lingkup = masukan.lingkup;
  // Sasaran TIDAK diperiksa keberadaannya di sini: penerapan untuk peran atau
  // orang yang sudah tidak ada justru harus dapat dihapus.
  const sasaran = lingkup === "semua" ? "" : String(masukan.sasaran ?? "").trim();

  await withTransaction(db, async (tx) => {
    const lama = (await bacaPenerapan(tx)).find((p) => p.lingkup === lingkup && p.sasaran === sasaran) ?? null;
    if (!lama) throw new ApiError(404, "Penerapan itu tidak ada - mungkin sudah dihapus.");

    await tx
      .prepare("DELETE FROM aleta_ekstensi_tampilan WHERE lingkup = ? AND sasaran = ?")
      .run(lingkup, sasaran);

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "DELETE_ECOURT_EXTENSION_DISPLAY",
      entityType: "aleta_ekstensi_tampilan",
      entityId: lingkup + ":" + sasaran,
      payload: { lingkup, sasaran, dihapus: { mode: lama.mode, fitur: Object.keys(lama.fitur), catatan: lama.catatan } },
    });
  });

  return bacaHalamanTampilan(db, actor);
}
