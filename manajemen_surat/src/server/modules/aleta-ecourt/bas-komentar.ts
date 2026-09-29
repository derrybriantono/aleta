import { randomUUID } from "node:crypto";

import {
  BATAS_ISI_KOMENTAR,
  BATAS_KUTIPAN,
  bagianSah,
  kunciLembar,
  kunciSaksiAbt,
  normalkanNomorPerkara,
} from "@/lib/bas-komentar";
import { bacaSaksiAbt, letakSaksiAbt, pihakKumpulan, sebutanSaksi } from "@/lib/keterangan-abt";
import { getEffectivePositionId, getEffectiveRoleId, isPrivilegedAdmin } from "@/lib/permissions";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { semuaLembar } from "@/server/modules/aleta-ecourt/bas-lembar";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { requireActorUser } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * KOMENTAR HAKIM ATAS BAS (KONTRAK TAHAP 6-7 BAGIAN 1)
 * ============================================================================
 *
 * Hakim membaca alur BAS dan keterangan saksi, lalu memilih keterangan yang
 * salah dan menuliskan komentarnya. TIDAK ADA ACC: komentar tidak menahan
 * lembar, naskah, cetak, atau apa pun - panitera tetap bekerja tanpa
 * menunggu. Aturan kunci bagian dan normalisasi nomor ada di
 * src/lib/bas-komentar.ts supaya layar dan ekstensi membaca bentuk yang sama.
 *
 * Satu-satunya jalan SQL ke aleta_bas_komentar ada di berkas ini.
 *
 * ============================================================================
 * SIAPA BOLEH APA
 * ============================================================================
 *
 *   membaca     siapa pun yang boleh melihat perkara (kemampuan "panel" -
 *               dijaga di rute, sama dengan lembar BAS dan berkas perkara)
 *   menulis     hakim, Ketua, Wakil Ketua (jabatannya hakim), Admin, Super Admin
 *   selesai     panitera pengganti, Admin, Super Admin, dan penulisnya
 *
 * Panitera pengganti dikenali dari peran ATAU posisinya: di akun ALETA banyak
 * panitera pengganti berperan "staf" dengan posisi pos-panitera-pengganti
 * (lihat tentukanPeran di checklist-milestone.ts). Memeriksa perannya saja
 * berarti justru orang yang menanggapi komentar tidak dapat menandainya.
 */

export type OrangSingkat = { id: string; nama: string };

export type KomentarBas = {
  id: string;
  nomor: string;
  perkaraId: string | null;
  sidangKe: number | null;
  bagian: string;
  kutipan: string;
  isi: string;
  penulis: OrangSingkat;
  dibuatPada: string;
  selesai: boolean;
  diselesaikanOleh: OrangSingkat | null;
  diselesaikanPada: string | null;
};

type Aktor = Pick<UserPersona, "id" | "roleId" | "positionId"> & Partial<UserPersona>;

const PERAN_HAKIM = new Set(["hakim", "ketua", "wakil-ketua"]);
const POSISI_HAKIM = new Set(["pos-hakim", "pos-ketua", "pos-wakil"]);

function himpunanPeran(aktor: Aktor): Set<string> {
  return new Set(
    [
      String(aktor.roleId ?? ""),
      String(getEffectiveRoleId(aktor as UserPersona) ?? ""),
      ...((aktor.additionalRoleIds ?? []) as string[]).map(String),
    ].filter(Boolean)
  );
}

function himpunanPosisi(aktor: Aktor): Set<string> {
  return new Set(
    [String(aktor.positionId ?? ""), String(getEffectivePositionId(aktor as UserPersona) ?? "")].filter(Boolean)
  );
}

/** Hakim (termasuk Ketua dan Wakil Ketua), Admin, Super Admin. */
export function bolehMenulisKomentar(aktor: Aktor): boolean {
  if (isPrivilegedAdmin(aktor as UserPersona)) return true;
  const peran = himpunanPeran(aktor);
  const posisi = himpunanPosisi(aktor);
  return [...peran].some((p) => PERAN_HAKIM.has(p)) || [...posisi].some((p) => POSISI_HAKIM.has(p));
}

function adalahPaniteraPengganti(aktor: Aktor): boolean {
  return himpunanPeran(aktor).has("panitera-pengganti") || himpunanPosisi(aktor).has("pos-panitera-pengganti");
}

/** Panitera pengganti, Admin, Super Admin, dan penulis komentar itu sendiri. */
export function bolehMenyelesaikan(aktor: Aktor, penulisId: string): boolean {
  if (isPrivilegedAdmin(aktor as UserPersona)) return true;
  if (String(aktor.id) === String(penulisId)) return true;
  return adalahPaniteraPengganti(aktor);
}

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

async function namaPengguna(db: AletaDatabase, ids: string[]): Promise<Map<string, string>> {
  const unik = [...new Set(ids.filter(Boolean))];
  const peta = new Map<string, string>();
  if (unik.length === 0) return peta;
  // Satu kueri IN, bukan JOIN: tanda tanya sebanyak id supaya pg-mem dan
  // Postgres menjalankan bentuk yang sama.
  const baris = await db.queryAll<{ id: string; name: string }>(
    `SELECT id, name FROM users WHERE id IN (${unik.map(() => "?").join(", ")})`,
    unik
  );
  for (const b of baris) peta.set(teks(b.id), teks(b.name));
  return peta;
}

type BarisDb = Record<string, unknown>;

function bentuk(baris: BarisDb, nama: Map<string, string>): KomentarBas {
  const penulisId = teks(baris.penulis_id);
  const olehId = teks(baris.diselesaikan_oleh);
  const selesai = Number(baris.selesai) === 1;
  const sidang = baris.sidang_ke === null || baris.sidang_ke === undefined ? null : Number(baris.sidang_ke);
  return {
    id: teks(baris.id),
    nomor: teks(baris.nomor_perkara),
    perkaraId: teks(baris.perkara_id) || null,
    sidangKe: sidang !== null && Number.isFinite(sidang) ? sidang : null,
    bagian: teks(baris.bagian),
    kutipan: String(baris.kutipan ?? ""),
    isi: String(baris.isi ?? ""),
    penulis: { id: penulisId, nama: nama.get(penulisId) || penulisId },
    dibuatPada: teks(baris.dibuat_pada),
    selesai,
    // Yang menandai tetap disebut walau kemudian dibuka lagi? Tidak: membuka
    // lagi menghapus jejaknya, supaya "diselesaikan oleh X" tidak tertinggal
    // pada komentar yang justru sedang menunggu tanggapan.
    diselesaikanOleh: selesai && olehId ? { id: olehId, nama: nama.get(olehId) || olehId } : null,
    diselesaikanPada: selesai ? teks(baris.diselesaikan_pada) || null : null,
  };
}

async function bentukSemua(db: AletaDatabase, baris: BarisDb[]): Promise<KomentarBas[]> {
  const nama = await namaPengguna(
    db,
    baris.flatMap((b) => [teks(b.penulis_id), teks(b.diselesaikan_oleh)])
  );
  return baris.map((b) => bentuk(b, nama));
}

/**
 * Komentar satu perkara, terlama dahulu - dibaca sebagai percakapan.
 *
 * Dicari lewat nomor; bila hanya perkara_id yang diketahui, lewat itu.
 */
export async function bacaKomentar(
  db: AletaDatabase,
  kunci: { nomor?: unknown; perkaraId?: unknown }
): Promise<KomentarBas[]> {
  const nomor = normalkanNomorPerkara(kunci.nomor);
  const perkaraId = teks(kunci.perkaraId);
  if (!nomor && !perkaraId) {
    throw new ApiError(400, "Sebutkan nomor perkara.");
  }
  const baris = nomor
    ? await db.queryAll<BarisDb>(
        `SELECT * FROM aleta_bas_komentar WHERE nomor_perkara = ? ORDER BY dibuat_pada, id`,
        [nomor]
      )
    : await db.queryAll<BarisDb>(
        `SELECT * FROM aleta_bas_komentar WHERE perkara_id = ? ORDER BY dibuat_pada, id`,
        [perkaraId]
      );
  return bentukSemua(db, baris);
}

async function satuKomentar(db: AletaDatabase, id: string): Promise<KomentarBas | null> {
  const baris = await db.queryOne<BarisDb>(`SELECT * FROM aleta_bas_komentar WHERE id = ?`, [id]);
  if (!baris) return null;
  return (await bentukSemua(db, [baris]))[0];
}

export type MasukanKomentar = {
  nomor?: unknown;
  perkaraId?: unknown;
  sidangKe?: unknown;
  bagian?: unknown;
  kutipan?: unknown;
  isi?: unknown;
};

/**
 * Menulis satu komentar.
 *
 * Kutipan dan isi yang terlalu panjang DITOLAK, bukan dipotong diam-diam:
 * komentar hakim yang terpotong di tengah kalimat dapat berbalik arti, dan
 * penulisnya tidak akan tahu bagian mana yang hilang.
 */
export async function tulisKomentar(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: MasukanKomentar
): Promise<KomentarBas> {
  const aktor = await requireActorUser(db, actorUserId);
  if (!bolehMenulisKomentar(aktor)) {
    throw new ApiError(403, "Komentar BAS ditulis hakim. Panitera menanggapinya dengan menandai komentar selesai.");
  }

  const nomor = normalkanNomorPerkara(masukan.nomor);
  if (!nomor) throw new ApiError(400, "Nomor perkara wajib diisi.");
  if (nomor.length > 80) throw new ApiError(400, "Nomor perkara terlalu panjang.");

  const bagian = teks(masukan.bagian) || "umum";
  if (!bagianSah(bagian)) {
    throw new ApiError(400, "Kunci bagian tidak sah (huruf, angka, dan : _ - . saja, paling panjang 80).");
  }

  const kutipan = String(masukan.kutipan ?? "").trim();
  const isi = String(masukan.isi ?? "").trim();
  if (!isi) throw new ApiError(400, "Isi komentar kosong.");
  if (kutipan.length > BATAS_KUTIPAN) {
    throw new ApiError(400, `Kutipan paling panjang ${BATAS_KUTIPAN} huruf.`);
  }
  if (isi.length > BATAS_ISI_KOMENTAR) {
    throw new ApiError(400, `Komentar paling panjang ${BATAS_ISI_KOMENTAR} huruf.`);
  }

  const perkaraId = teks(masukan.perkaraId);
  if (perkaraId && !/^\d{1,20}$/.test(perkaraId)) throw new ApiError(400, "perkaraId harus angka.");

  let sidangKe: number | null = null;
  if (masukan.sidangKe !== undefined && masukan.sidangKe !== null && teks(masukan.sidangKe) !== "") {
    const n = Number(masukan.sidangKe);
    if (!Number.isInteger(n) || n < 1 || n > 999) throw new ApiError(400, "sidangKe harus bilangan bulat 1-999.");
    sidangKe = n;
  }

  const id = "bkm-" + randomUUID();
  await db.run(
    `INSERT INTO aleta_bas_komentar
       (id, nomor_perkara, perkara_id, sidang_ke, bagian, kutipan, isi, penulis_id, dibuat_pada)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, nomor, perkaraId || null, sidangKe, bagian, kutipan, isi, String(aktor.id), new Date().toISOString()]
  );

  const hasil = await satuKomentar(db, id);
  if (!hasil) throw new Error("Komentar gagal disimpan.");
  return hasil;
}

/** Menandai komentar selesai (sudah ditanggapi) atau membukanya lagi. */
export async function tandaiKomentar(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { id?: unknown; selesai?: unknown }
): Promise<KomentarBas> {
  const aktor = await requireActorUser(db, actorUserId);
  const id = teks(masukan.id);
  if (!id) throw new ApiError(400, "Sebutkan id komentar.");
  if (typeof masukan.selesai !== "boolean") throw new ApiError(400, "selesai harus true atau false.");

  const baris = await db.queryOne<BarisDb>(`SELECT id, penulis_id FROM aleta_bas_komentar WHERE id = ?`, [id]);
  if (!baris) throw new ApiError(404, "Komentar tidak ditemukan.");

  if (!bolehMenyelesaikan(aktor, teks(baris.penulis_id))) {
    throw new ApiError(403, "Yang menandai komentar selesai: panitera pengganti, Admin, Super Admin, atau penulisnya.");
  }

  if (masukan.selesai) {
    await db.run(
      `UPDATE aleta_bas_komentar SET selesai = 1, diselesaikan_oleh = ?, diselesaikan_pada = ? WHERE id = ?`,
      [String(aktor.id), new Date().toISOString(), id]
    );
  } else {
    await db.run(
      `UPDATE aleta_bas_komentar SET selesai = 0, diselesaikan_oleh = '', diselesaikan_pada = '' WHERE id = ?`,
      [id]
    );
  }

  const hasil = await satuKomentar(db, id);
  if (!hasil) throw new ApiError(404, "Komentar tidak ditemukan.");
  return hasil;
}

// ============================================================================
// ALUR BAS UNTUK DIBACA HAKIM
// ============================================================================

export type BarisAlur = { bagian: string; urutan: number; penanya: string; pertanyaan: string; jawaban: string };

export type SaksiAlur = {
  /** "ABT" = abt_keterangan_saksi lewat bot; "ALETA" = lembar alat bantu tulis BAS. */
  sumber: "ABT" | "ALETA";
  kunci: string;
  sebutan: string;
  nama: string;
  keterangan: string;
  baris: BarisAlur[];
};

export type AlurBas = {
  nomorPerkara: string;
  perkaraId: string;
  saksi: SaksiAlur[];
  /** Batas sumber yang harus terbaca hakim - bukan hiasan. */
  batas: string[];
  halangan: string[];
  dibacaPada: string;
};

type JawabanPemeriksaan = { ada?: boolean; sebab?: string; sumber?: string; saksi?: unknown };

/**
 * Alur BAS satu perkara, dari DUA sumber yang sudah ada - tidak ada salinan
 * baru yang harus dijaga sinkron:
 *
 *   1. Lembar BAS ALETA (aleta_bas_lembar/jawaban) - tanya-jawab yang ditulis
 *      panitera lewat Alat Bantu Tulis BAS, versi terakhir yang disimpan.
 *   2. Keterangan saksi di ABT (abt_keterangan_saksi), dibaca jembatan bot
 *      operasi case.pemeriksaanSaksi yang HANYA SELECT - sama persis dengan
 *      yang dipakai berkas perkara dan penyusun naskah BAS.
 *
 * Keduanya ditampilkan berdampingan, TIDAK dilebur. Penyusun naskah memakai
 * lembar ALETA bila ada; tetapi ekstensi kini juga menyimpan keterangan
 * kembali ke ABT, sehingga salah satu dapat lebih baru daripada yang lain.
 * Memilihkan satu untuk hakim berarti menyembunyikan tepat keterangan yang
 * mungkin sedang ia cari.
 *
 * Yang TIDAK ada di sini: BAS yang diketik langsung di Word/ABT tanpa lewat
 * tanya-jawab ABT maupun lembar ALETA. Itu disebut di `batas`.
 */
export async function bacaAlurBas(
  db: AletaDatabase,
  kunci: { perkaraId: string; nomorPerkara?: string }
): Promise<AlurBas> {
  const perkaraId = teks(kunci.perkaraId);
  const dibacaPada = new Date().toISOString();
  const batas = [
    "Yang tampil: lembar BAS ALETA versi terakhir yang disimpan, dan keterangan saksi di ABT (abt_keterangan_saksi) sebagaimana tersimpan saat halaman ini dibuka.",
    "BAS yang diketik langsung di dokumen tanpa lewat tanya-jawab ABT atau lembar ALETA tidak terbaca di sini.",
    "Komentar tidak menahan apa pun - panitera tetap dapat mengerjakan dan mencetak BAS.",
  ];
  const halangan: string[] = [];
  const saksi: SaksiAlur[] = [];

  if (!/^\d{1,20}$/.test(perkaraId)) {
    return { nomorPerkara: teks(kunci.nomorPerkara), perkaraId, saksi, batas, halangan: ["Perkara tidak dikenali."], dibacaPada };
  }

  // Lembar ALETA - basis data portal sendiri, selalu terbaca.
  const lembar = await semuaLembar(db, perkaraId);
  let nomorPerkara = normalkanNomorPerkara(kunci.nomorPerkara);
  for (const item of lembar) {
    if (!nomorPerkara && item.nomorPerkara) nomorPerkara = normalkanNomorPerkara(item.nomorPerkara);
    const pihak = pihakKumpulan(item.kodeKumpulan, item.namaKumpulan);
    saksi.push({
      sumber: "ALETA",
      kunci: `lembar-${pihak}${item.saksiKe}`,
      sebutan: sebutanSaksi(pihak, item.saksiKe),
      nama: item.saksi.nama,
      keterangan:
        `Lembar ${item.kodeKumpulan}${item.namaKumpulan ? " - " + item.namaKumpulan : ""}` +
        (item.tanggalSidang ? `, sidang ${item.tanggalSidang}` : "") +
        (item.diubahAt ? `, terakhir disimpan ${item.diubahAt}` : ""),
      baris: item.baris
        .slice()
        .sort((a, b) => a.urutan - b.urutan)
        .map((b) => ({
          bagian: kunciLembar(pihak, item.saksiKe, b.urutan),
          urutan: b.urutan,
          penanya: "",
          pertanyaan: b.pertanyaan,
          jawaban: b.jawaban,
        })),
    });
  }

  // Rekaman ABT - lewat bot, baca-saja. Gagalnya disebut, tidak ditelan.
  try {
    const jawaban = await callAletaBotSippBridge<JawabanPemeriksaan>("case.pemeriksaanSaksi", { perkaraId });
    if (!jawaban.ok) {
      halangan.push(`APS Badilag - abt_keterangan_saksi tidak terbaca: ${jawaban.error ?? "jembatan bot tidak menjawab"}`);
    } else if (jawaban.data && jawaban.data.ada === false && jawaban.data.sebab) {
      halangan.push(`APS Badilag - ${jawaban.data.sebab}`);
    } else {
      for (const item of bacaSaksiAbt(jawaban.data ?? {})) {
        const letak = letakSaksiAbt(item);
        saksi.push({
          sumber: "ABT",
          kunci: `saksi-${item.saksiKe}`,
          sebutan: `saksi ke-${item.saksiKe} di ABT` + (letak ? ` (${sebutanSaksi(letak.pihak, letak.ke)})` : ""),
          nama: "",
          keterangan: `abt_keterangan_saksi${item.sidangId ? `, sidang_id ${item.sidangId}` : ""}`,
          baris: item.tanyaJawab.map((b) => ({
            bagian: kunciSaksiAbt(item.saksiKe, b.urutan, letak),
            urutan: b.urutan,
            penanya: b.penanya,
            pertanyaan: b.pertanyaan,
            jawaban: b.jawaban,
          })),
        });
      }
    }
  } catch (galat) {
    halangan.push(
      `APS Badilag - abt_keterangan_saksi tidak terbaca: ${galat instanceof Error ? galat.message : "jembatan bot tidak menjawab"}`
    );
  }

  return { nomorPerkara, perkaraId, saksi, batas, halangan, dibacaPada };
}
