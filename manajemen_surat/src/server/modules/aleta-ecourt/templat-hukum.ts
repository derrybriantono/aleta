import { randomUUID } from "node:crypto";

import {
  BATAS_ISI_TEMPLAT,
  BATAS_JUDUL_TEMPLAT,
  BENIH_TEMPLAT,
  jenisTemplatSah,
  kunciTemplatSah,
  type JenisTemplat,
} from "@/lib/templat-hukum";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { bolehMenyuntingAkses } from "@/server/modules/aleta-ecourt/akses";
import { requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * TEMPLAT PERTIMBANGAN & DASAR HUKUM (KONTRAK TAHAP 6-7 BAGIAN 2)
 * ============================================================================
 *
 * Satu-satunya jalan SQL ke aleta_templat_hukum.
 *
 *   membaca      semua pegawai yang masuk
 *   mengubah     Super Admin saja - menambah, menyunting, mengesahkan,
 *                mencabut pengesahan, menghapus; semuanya tercatat di audit
 *
 * ============================================================================
 * SAH DITURUNKAN, BUKAN DISIMPAN SEBAGAI KEADAAN
 * ============================================================================
 *
 * Butir sah bila disahkan_pada terisi. Menyunting judul atau isi selalu
 * mengosongkannya kembali: pengesahan melekat pada KALIMAT yang dibaca
 * pimpinan, dan kalimat yang berubah sesudahnya belum pernah dibacanya.
 * Karena itu menyunting dan mengesahkan tidak dapat digabung dalam satu
 * permintaan - yang disahkan harus yang sudah tersimpan dan terbaca.
 *
 * Ekstensi hanya boleh menyisipkan butir disahkan: true. Yang DRAF tampil
 * bertanda "DRAF - belum disahkan" dengan tombol sisip mati.
 */

export type OrangSingkat = { id: string; nama: string };

export type ButirTemplat = {
  id: string;
  jenis: JenisTemplat;
  kunci: string;
  judul: string;
  isi: string;
  disahkan: boolean;
  disahkanOleh: OrangSingkat | null;
  disahkanPada: string | null;
  diubahPada: string;
  benih: boolean;
};

type BarisDb = Record<string, unknown>;

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

async function namaPengguna(db: AletaDatabase, ids: string[]): Promise<Map<string, string>> {
  const unik = [...new Set(ids.filter(Boolean))];
  const peta = new Map<string, string>();
  if (unik.length === 0) return peta;
  const baris = await db.queryAll<{ id: string; name: string }>(
    `SELECT id, name FROM users WHERE id IN (${unik.map(() => "?").join(", ")})`,
    unik
  );
  for (const b of baris) peta.set(teks(b.id), teks(b.name));
  return peta;
}

function bentuk(b: BarisDb, nama: Map<string, string>): ButirTemplat {
  const pada = teks(b.disahkan_pada);
  const oleh = teks(b.disahkan_oleh);
  return {
    id: teks(b.id),
    jenis: teks(b.jenis) as JenisTemplat,
    kunci: teks(b.kunci),
    judul: String(b.judul ?? ""),
    isi: String(b.isi ?? ""),
    disahkan: Boolean(pada),
    disahkanOleh: pada && oleh ? { id: oleh, nama: nama.get(oleh) || oleh } : null,
    disahkanPada: pada || null,
    diubahPada: teks(b.diubah_pada),
    benih: Number(b.benih) === 1,
  };
}

/**
 * Menanam benih DRAF - id tetap, ON CONFLICT DO NOTHING.
 *
 * Benih yang sudah disunting tidak ditimpa; benih yang dihapus Super Admin
 * tidak tumbuh lagi, karena penghapusannya lunak dan barisnya tetap memegang
 * id itu. Butir hidup lain berkunci sama (dibuat Super Admin sebelum benih
 * sempat tertanam) membuat benihnya dilewati, supaya ekstensi tidak pernah
 * menemukan dua butir untuk satu kunci.
 */
export async function pastikanBenihTemplat(db: AletaDatabase): Promise<number> {
  const pada = new Date().toISOString();
  let ditanam = 0;
  // Seluruh baris, termasuk yang terhapus: id benih yang sudah pernah ada -
  // hidup atau dihapus - tidak ditanam lagi. Diperiksa di sini, tidak
  // mengandalkan RETURNING dari ON CONFLICT DO NOTHING: pg-mem memulangkan
  // barisnya walau tidak ada yang tersisip (terukur di uji templat-hukum).
  const semua = await db.queryAll<BarisDb>(`SELECT id, jenis, kunci, dihapus_pada FROM aleta_templat_hukum`);
  const idAda = new Set(semua.map((b) => teks(b.id)));
  const kunciHidup = new Set(
    semua.filter((b) => !teks(b.dihapus_pada)).map((b) => `${teks(b.jenis)}:${teks(b.kunci)}`)
  );
  for (const benih of BENIH_TEMPLAT) {
    if (idAda.has(benih.id) || kunciHidup.has(`${benih.jenis}:${benih.kunci}`)) continue;
    await db.run(
      `INSERT INTO aleta_templat_hukum
         (id, jenis, kunci, judul, isi, benih, dibuat_oleh, dibuat_pada, diubah_oleh, diubah_pada)
       VALUES (?, ?, ?, ?, ?, 1, 'benih', ?, 'benih', ?)
       ON CONFLICT (id) DO NOTHING`,
      [benih.id, benih.jenis, benih.kunci, benih.judul, benih.isi, pada, pada]
    );
    ditanam += 1;
  }
  return ditanam;
}

const benihTertanam = new WeakMap<AletaDatabase, Promise<unknown>>();

async function pastikanBenihSekali(db: AletaDatabase) {
  let janji = benihTertanam.get(db);
  if (!janji) {
    janji = pastikanBenihTemplat(db).catch((galat) => {
      benihTertanam.delete(db);
      throw galat;
    });
    benihTertanam.set(db, janji);
  }
  await janji;
}

export async function bacaTemplat(db: AletaDatabase, jenis?: unknown): Promise<ButirTemplat[]> {
  await pastikanBenihSekali(db);
  const saring = teks(jenis);
  if (saring && !jenisTemplatSah(saring)) {
    throw new ApiError(400, 'jenis harus "pertimbangan" atau "pasal".');
  }
  const baris = saring
    ? await db.queryAll<BarisDb>(
        `SELECT * FROM aleta_templat_hukum WHERE dihapus_pada = '' AND jenis = ? ORDER BY jenis, kunci, dibuat_pada`,
        [saring]
      )
    : await db.queryAll<BarisDb>(
        `SELECT * FROM aleta_templat_hukum WHERE dihapus_pada = '' ORDER BY jenis, kunci, dibuat_pada`
      );
  const nama = await namaPengguna(db, baris.map((b) => teks(b.disahkan_oleh)));
  return baris.map((b) => bentuk(b, nama));
}

async function pastikanSuperAdmin(db: AletaDatabase, actorUserId: string | null | undefined) {
  const actor = await requireActorUser(db, actorUserId);
  if (!bolehMenyuntingAkses(actor)) {
    throw new ApiError(403, "Hanya Super Admin yang dapat mengubah atau mengesahkan templat hukum.");
  }
  return actor;
}

function periksaJudulIsi(judul: unknown, isi: unknown) {
  const j = teks(judul);
  const i = String(isi ?? "").trim();
  if (!j) throw new ApiError(400, "Judul templat wajib diisi.");
  if (!i) throw new ApiError(400, "Isi templat wajib diisi.");
  if (j.length > BATAS_JUDUL_TEMPLAT) throw new ApiError(400, `Judul paling panjang ${BATAS_JUDUL_TEMPLAT} huruf.`);
  if (i.length > BATAS_ISI_TEMPLAT) throw new ApiError(400, `Isi paling panjang ${BATAS_ISI_TEMPLAT} huruf.`);
  return { judul: j, isi: i };
}

async function satuButir(db: AletaDatabase, id: string): Promise<ButirTemplat | null> {
  const b = await db.queryOne<BarisDb>(`SELECT * FROM aleta_templat_hukum WHERE id = ? AND dihapus_pada = ''`, [id]);
  if (!b) return null;
  const nama = await namaPengguna(db, [teks(b.disahkan_oleh)]);
  return bentuk(b, nama);
}

async function kunciTerpakai(db: AletaDatabase, jenis: string, kunci: string, kecualiId = ""): Promise<boolean> {
  const b = await db.queryAll<{ id: string }>(
    `SELECT id FROM aleta_templat_hukum WHERE jenis = ? AND kunci = ? AND dihapus_pada = ''`,
    [jenis, kunci]
  );
  return b.some((x) => teks(x.id) !== kecualiId);
}

/** Menambah butir baru - selalu DRAF. */
export async function tambahTemplat(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { jenis?: unknown; kunci?: unknown; judul?: unknown; isi?: unknown }
): Promise<ButirTemplat> {
  const actor = await pastikanSuperAdmin(db, actorUserId);
  await pastikanBenihSekali(db);
  if (!jenisTemplatSah(masukan.jenis)) throw new ApiError(400, 'jenis harus "pertimbangan" atau "pasal".');
  const jenis = masukan.jenis;
  const kunci = teks(masukan.kunci);
  if (!kunciTemplatSah(jenis, kunci)) {
    throw new ApiError(
      400,
      jenis === "pasal" ? "Kunci pasal harus satu huruf a sampai k." : "Kunci pertimbangan berupa huruf kecil dan tanda hubung, mis. verstek."
    );
  }
  const { judul, isi } = periksaJudulIsi(masukan.judul, masukan.isi);
  if (await kunciTerpakai(db, jenis, kunci)) {
    throw new ApiError(409, `Sudah ada templat ${jenis} berkunci "${kunci}". Sunting yang ada, atau hapus dulu.`);
  }

  const id = "th-" + randomUUID();
  const pada = new Date().toISOString();
  await withTransaction(db, async (tx) => {
    await tx.run(
      `INSERT INTO aleta_templat_hukum
         (id, jenis, kunci, judul, isi, benih, dibuat_oleh, dibuat_pada, diubah_oleh, diubah_pada)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [id, jenis, kunci, judul, isi, actor.id, pada, actor.id, pada]
    );
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "CREATE_LEGAL_TEMPLATE",
      entityType: "aleta_templat_hukum",
      entityId: id,
      payload: { jenis, kunci, judul },
    });
  });
  const hasil = await satuButir(db, id);
  if (!hasil) throw new Error("Templat gagal disimpan.");
  return hasil;
}

/**
 * Menyunting, mengesahkan, atau mencabut pengesahan satu butir.
 *
 *   {id, sahkan: true}           mengesahkan kalimat yang TERSIMPAN
 *   {id, sahkan: false}          mencabut pengesahan (kembali DRAF)
 *   {id, judul?, isi?, kunci?}   menyunting - selalu kembali DRAF
 */
export async function ubahTemplat(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { id?: unknown; sahkan?: unknown; judul?: unknown; isi?: unknown; kunci?: unknown }
): Promise<ButirTemplat> {
  const actor = await pastikanSuperAdmin(db, actorUserId);
  const id = teks(masukan.id);
  if (!id) throw new ApiError(400, "Sebutkan id templat.");
  const lama = await db.queryOne<BarisDb>(`SELECT * FROM aleta_templat_hukum WHERE id = ? AND dihapus_pada = ''`, [id]);
  if (!lama) throw new ApiError(404, "Templat tidak ditemukan.");

  const menyunting = masukan.judul !== undefined || masukan.isi !== undefined || masukan.kunci !== undefined;
  const mengesahkan = masukan.sahkan !== undefined;
  if (menyunting && mengesahkan) {
    throw new ApiError(
      400,
      "Simpan suntingan dahulu, lalu sahkan. Pengesahan melekat pada kalimat yang sudah tersimpan dan terbaca."
    );
  }
  if (!menyunting && !mengesahkan) throw new ApiError(400, "Tidak ada yang diubah.");

  const pada = new Date().toISOString();
  if (mengesahkan) {
    if (typeof masukan.sahkan !== "boolean") throw new ApiError(400, "sahkan harus true atau false.");
    const sahkan = masukan.sahkan;
    await withTransaction(db, async (tx) => {
      await tx.run(`UPDATE aleta_templat_hukum SET disahkan_oleh = ?, disahkan_pada = ? WHERE id = ?`, [
        sahkan ? actor.id : "",
        sahkan ? pada : "",
        id,
      ]);
      await appendAuditLog(tx, {
        id: await nextPrefixedId(tx, "audit_logs", "adt"),
        actorUserId: actor.id,
        action: sahkan ? "APPROVE_LEGAL_TEMPLATE" : "REVOKE_LEGAL_TEMPLATE",
        entityType: "aleta_templat_hukum",
        entityId: id,
        payload: { jenis: teks(lama.jenis), kunci: teks(lama.kunci), judul: String(lama.judul ?? "") },
      });
    });
  } else {
    const jenis = teks(lama.jenis) as JenisTemplat;
    const kunci = masukan.kunci === undefined ? teks(lama.kunci) : teks(masukan.kunci);
    if (!kunciTemplatSah(jenis, kunci)) throw new ApiError(400, "Kunci templat tidak sah untuk jenisnya.");
    if (await kunciTerpakai(db, jenis, kunci, id)) {
      throw new ApiError(409, `Sudah ada templat ${jenis} berkunci "${kunci}".`);
    }
    const { judul, isi } = periksaJudulIsi(
      masukan.judul === undefined ? lama.judul : masukan.judul,
      masukan.isi === undefined ? lama.isi : masukan.isi
    );
    await withTransaction(db, async (tx) => {
      await tx.run(
        `UPDATE aleta_templat_hukum
            SET kunci = ?, judul = ?, isi = ?, disahkan_oleh = '', disahkan_pada = '', diubah_oleh = ?, diubah_pada = ?
          WHERE id = ?`,
        [kunci, judul, isi, actor.id, pada, id]
      );
      await appendAuditLog(tx, {
        id: await nextPrefixedId(tx, "audit_logs", "adt"),
        actorUserId: actor.id,
        action: "UPDATE_LEGAL_TEMPLATE",
        entityType: "aleta_templat_hukum",
        entityId: id,
        payload: {
          jenis,
          kunci,
          sebelumnya: { kunci: teks(lama.kunci), judul: String(lama.judul ?? ""), isi: String(lama.isi ?? "") },
          pengesahanDicabut: Boolean(teks(lama.disahkan_pada)),
        },
      });
    });
  }

  const hasil = await satuButir(db, id);
  if (!hasil) throw new ApiError(404, "Templat tidak ditemukan.");
  return hasil;
}

/** Menghapus lunak - benih yang dihapus tidak tumbuh lagi. */
export async function hapusTemplat(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  idMentah: unknown
): Promise<{ id: string; dihapus: true }> {
  const actor = await pastikanSuperAdmin(db, actorUserId);
  const id = teks(idMentah);
  if (!id) throw new ApiError(400, "Sebutkan id templat.");
  const lama = await db.queryOne<BarisDb>(`SELECT * FROM aleta_templat_hukum WHERE id = ? AND dihapus_pada = ''`, [id]);
  if (!lama) throw new ApiError(404, "Templat tidak ditemukan.");
  await withTransaction(db, async (tx) => {
    await tx.run(`UPDATE aleta_templat_hukum SET dihapus_pada = ?, diubah_oleh = ? WHERE id = ?`, [
      new Date().toISOString(),
      actor.id,
      id,
    ]);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "DELETE_LEGAL_TEMPLATE",
      entityType: "aleta_templat_hukum",
      entityId: id,
      payload: { jenis: teks(lama.jenis), kunci: teks(lama.kunci), judul: String(lama.judul ?? ""), isi: String(lama.isi ?? "") },
    });
  });
  return { id, dihapus: true };
}
