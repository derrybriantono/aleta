import { isPrivilegedAdmin } from "@/lib/permissions";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";

/**
 * Setelan yang dipakai menyusun usulan penunjukan PMH, PPP, PJS, dan PHS.
 *
 * ============================================================================
 * SUSUNAN MAJELISNYA TIDAK ADA DI SINI
 * ============================================================================
 *
 * SIPP sudah menyimpannya sendiri - ref_sk_majelis_tetap untuk nomor dan
 * tanggal SK, ref_majelis_tetap untuk isinya, ref_kompetensi_majelis untuk
 * kewenangan tiap majelis termasuk ekonomi syariah. Semua itu dibaca langsung,
 * tidak disalin.
 *
 * Yang tinggal di sini hanya yang benar-benar tidak ada di SIPP: hari sidang
 * tiap majelis, dan aturan hitungan yang memang milik pengadilan ini sendiri.
 *
 * ============================================================================
 * SETELAN SELALU PUNYA NILAI, TIDAK PERNAH KOSONG
 * ============================================================================
 *
 * Tiap pembacaan jatuh ke nilai bawaan bila barisnya belum ada atau isinya
 * tidak masuk akal. Papan penunjukan yang menampilkan "belum diatur" pada
 * pemasangan baru hanya akan didiamkan; papan yang langsung menampilkan angka
 * yang benar - dan menyebutkan angka itu dari mana - langsung dipakai.
 */

/** Hari dalam angka JavaScript: 0 Minggu, 1 Senin, ... 6 Sabtu. */
export const NAMA_HARI = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
] as const;

/**
 * Hari sidang menurut SK Ketua PA Donggala 27 Agustus 2026.
 *
 * Dipakai hanya sebagai nilai awal - begitu ada baris tersimpan, baris itulah
 * yang berlaku, sehingga SK berikutnya cukup disunting dari menu.
 */
const MAJELIS_BAWAAN: Record<string, { hari: number; paniteraKode: string }> = {
  A: { hari: 3, paniteraKode: "D,D4" }, // Rabu
  B: { hari: 2, paniteraKode: "D1,D5" }, // Selasa
  C1: { hari: 1, paniteraKode: "D2,D3,D6" }, // Senin
};

export type HariSidangMajelis = {
  majelisKode: string;
  hari: number;
  namaHari: string;
  paniteraKode: string[];
  keterangan: string;
  bawaan: boolean;
};

/**
 * Aturan hitungan.
 *
 * jedaMinimalHari - sidang pertama sekurangnya sekian hari sesudah pendaftaran.
 * ambangNilaiSengketa - sampai sekian rupiah berhakim tunggal, di atasnya
 *   majelis. Hanya berlaku bagi perkara yang memang mengenal ambang itu.
 * klasifikasiHakimTunggal - kata kunci pada jenis perkara yang berhakim
 *   tunggal tanpa memandang nilai.
 * kolamHakimTunggal - "hakim" menggugurkan Ketua dan Wakil dari usulan;
 *   "ketua-wakil" mengikutkan keduanya.
 * polaNomorSk - dikosongkan sampai pengadilan menetapkan polanya.
 */
export type AturanPenunjukan = {
  jedaMinimalHari: number;
  ambangNilaiSengketa: number;
  klasifikasiHakimTunggal: string[];
  kolamHakimTunggal: "hakim" | "ketua-wakil";
  polaNomorSk: string;
  simpanOtomatis: "mati" | "nyala";
  penetapanBerjabatan: "longgar" | "ketat";
};

/**
 * ============================================================================
 * SIMPAN OTOMATIS BAWAANNYA MATI, DAN ITU DISENGAJA
 * ============================================================================
 *
 * ALETA mengisi borang; yang menekan Simpan tetap orang. Itu yang membuat
 * penetapan tetap perbuatan pejabat yang menandatanganinya, bukan keluaran
 * mesin - dan itu pula yang membuat catatan pengisian ada artinya, sebab tiap
 * baris punya orang yang sungguh melihatnya sebelum tercatat.
 *
 * Saklarnya tetap disediakan karena keputusan itu milik pengadilan, bukan
 * milik saya. Yang saya kerjakan: menaruhnya di tempat yang harus dinyalakan
 * dengan sengaja oleh Super Admin, bukan menyalakannya untuk semua orang
 * sekaligus dan berharap ada yang mematikannya.
 */
export const ATURAN_BAWAAN: AturanPenunjukan = {
  jedaMinimalHari: 10,
  ambangNilaiSengketa: 500_000_000,
  klasifikasiHakimTunggal: ["dispensasi kawin", "isbat", "istbat"],
  kolamHakimTunggal: "hakim",
  polaNomorSk: "",
  simpanOtomatis: "mati",

  // ==========================================================================
  // KEEMPAT PENETAPAN DIKERJAKAN OPERATOR - ITU YANG BERLAKU DI SINI
  // ==========================================================================
  //
  // "longgar" berarti siapa pun yang diberi kewenangan mengisi dapat
  // mengerjakan keempat penetapan, tanpa memandang jabatannya. Itu memang
  // cara kerja yang berjalan: penetapan disiapkan operator atas arahan Ketua
  // Pengadilan demi kelancaran proses.
  //
  // "ketat" mengunci tiap penetapan pada jabatannya - PMH hanya Ketua dan
  // Wakil, PPP dan PJS hanya Panitera, PHS hanya ketua majelis. Disediakan
  // bagi pengadilan yang menghendaki itu.
  //
  // Berapa pun setelannya, catatan pengisian TETAP menyebutkan siapa yang
  // benar-benar mengerjakannya dan jabatan mana yang seharusnya. Yang
  // dilonggarkan penjagaannya, bukan kejujuran catatannya.
  penetapanBerjabatan: "longgar",
};

const KETERANGAN_ATURAN: Record<keyof AturanPenunjukan, string> = {
  jedaMinimalHari:
    "Sidang pertama paling cepat sekian hari sesudah tanggal pendaftaran.",
  ambangNilaiSengketa:
    "Batas nilai sengketa yang masih boleh diperiksa hakim tunggal, dalam rupiah.",
  klasifikasiHakimTunggal:
    "Kata kunci pada jenis perkara yang berhakim tunggal tanpa memandang nilai.",
  kolamHakimTunggal:
    'Siapa yang boleh diusulkan jadi hakim tunggal: "hakim" menggugurkan Ketua dan Wakil.',
  polaNomorSk: "Pola nomor SK penetapan. Dikosongkan berarti tidak diisikan.",
  penetapanBerjabatan:
    'Apakah tiap penetapan dikunci pada jabatannya. "longgar" berarti operator dapat mengerjakan keempatnya; "ketat" mengunci PMH pada Ketua, PPP dan PJS pada Panitera, PHS pada ketua majelis.',
  simpanOtomatis:
    'Apakah ALETA ikut menekan tombol Simpan. "mati" berarti pengisian berhenti di borang yang sudah terisi, dan orang yang menekannya.',
};

type BarisHari = {
  majelis_kode: string;
  hari: number;
  panitera_kode: string;
  keterangan: string;
};

type BarisAturan = { kunci: string; nilai: string };

/**
 * Membaca angka yang masih masuk akal, atau nilai bawaannya.
 *
 * Angka negatif dan bukan-angka ditolak diam-diam ke bawaan, bukan dipakai:
 * jeda minus hari akan menetapkan sidang sebelum perkaranya didaftarkan.
 */
function angkaAtau(teks: string | undefined, bawaan: number): number {
  if (teks === undefined) return bawaan;
  const angka = Number(teks);
  if (!Number.isFinite(angka) || angka < 0) return bawaan;
  return Math.floor(angka);
}

function daftarAtau(teks: string | undefined, bawaan: string[]): string[] {
  if (teks === undefined) return bawaan;
  const isi = teks
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter((x) => x.length > 0);
  // Daftar kosong berarti tidak ada perkara yang berhakim tunggal karena
  // jenisnya - itu keadaan yang sah dan disengaja, jadi tidak dikembalikan ke
  // bawaan. Yang dikembalikan hanya barisnya yang memang belum pernah ada.
  return isi;
}

/** Hari sidang tiap majelis, lengkap dengan yang masih memakai bawaan. */
export async function bacaHariSidang(db: AletaDatabase): Promise<HariSidangMajelis[]> {
  const baris = await db
    .prepare(
      "SELECT majelis_kode, hari, panitera_kode, keterangan FROM aleta_sipp_hari_sidang"
    )
    .all<BarisHari>();

  const tersimpan = new Map<string, BarisHari>();
  for (const item of baris) tersimpan.set(String(item.majelis_kode), item);

  // Majelis yang tersimpan tetapi tidak ada di bawaan ikut ditampilkan -
  // majelis baru memang ditambahkan lewat menu, dan menyembunyikannya akan
  // membuat yang baru ditambahkan seolah tidak tersimpan.
  const kode = new Set<string>([...Object.keys(MAJELIS_BAWAAN), ...tersimpan.keys()]);

  return [...kode]
    .sort((a, b) => a.localeCompare(b))
    .map((majelisKode) => {
      const item = tersimpan.get(majelisKode);
      const bawaan = MAJELIS_BAWAAN[majelisKode];
      const hari = item ? Number(item.hari) : bawaan?.hari ?? 1;
      const aman = Number.isInteger(hari) && hari >= 0 && hari <= 6 ? hari : 1;
      const kodePp = item ? String(item.panitera_kode ?? "") : bawaan?.paniteraKode ?? "";
      return {
        majelisKode,
        hari: aman,
        namaHari: NAMA_HARI[aman],
        paniteraKode: kodePp
          .split(",")
          .map((x) => x.trim().toUpperCase())
          .filter((x) => x.length > 0),
        keterangan: item ? String(item.keterangan ?? "") : "",
        bawaan: !item,
      };
    });
}

/** Aturan hitungan yang berlaku, dengan bawaan bagi yang belum diatur. */
export async function bacaAturanPenunjukan(
  db: AletaDatabase
): Promise<AturanPenunjukan> {
  const baris = await db
    .prepare("SELECT kunci, nilai FROM aleta_sipp_aturan_penunjukan")
    .all<BarisAturan>();

  const peta = new Map<string, string>();
  for (const item of baris) peta.set(String(item.kunci), String(item.nilai ?? ""));

  const kolam = peta.get("kolamHakimTunggal");

  return {
    jedaMinimalHari: angkaAtau(peta.get("jedaMinimalHari"), ATURAN_BAWAAN.jedaMinimalHari),
    ambangNilaiSengketa: angkaAtau(
      peta.get("ambangNilaiSengketa"),
      ATURAN_BAWAAN.ambangNilaiSengketa
    ),
    klasifikasiHakimTunggal: daftarAtau(
      peta.get("klasifikasiHakimTunggal"),
      ATURAN_BAWAAN.klasifikasiHakimTunggal
    ),
    kolamHakimTunggal: kolam === "ketua-wakil" ? "ketua-wakil" : "hakim",
    polaNomorSk: peta.get("polaNomorSk") ?? ATURAN_BAWAAN.polaNomorSk,
    // Hanya "nyala" yang menyalakannya. Nilai apa pun yang lain - termasuk
    // yang salah ketik - berarti mati; setelan sepenting ini tidak boleh
    // menyala karena kekeliruan mengetik.
    simpanOtomatis: peta.get("simpanOtomatis") === "nyala" ? "nyala" : "mati",
    // Hanya "ketat" yang mengunci. Nilai lain - termasuk yang salah ketik -
    // berarti longgar, mengikuti cara kerja yang berjalan.
    penetapanBerjabatan: peta.get("penetapanBerjabatan") === "ketat" ? "ketat" : "longgar",
  };
}

/**
 * Keduanya sekaligus - inilah yang dikirim ke bot bersama nomor perkaranya.
 *
 * Bot tidak menyimpan setelan apa pun sendiri. Ia hanya tahu SIPP, dan
 * menerima aturannya dari pemanggil. Kalau bot ikut menyimpan salinan, ada dua
 * tempat yang harus disunting tiap SK berganti - dan yang kedua pasti terlupa.
 */
export async function bacaPengaturanPenunjukan(db: AletaDatabase) {
  const [hariSidang, aturan] = await Promise.all([
    bacaHariSidang(db),
    bacaAturanPenunjukan(db),
  ]);

  return {
    aturan,
    hariSidang: Object.fromEntries(hariSidang.map((x) => [x.majelisKode, x.hari])),
    paniteraMajelis: Object.fromEntries(
      hariSidang.map((x) => [x.majelisKode, x.paniteraKode])
    ),
    hariSidangRinci: hariSidang,
  };
}

/** Menyimpan hari sidang satu majelis. */
export async function simpanHariSidang(
  db: AletaDatabase,
  {
    actorUserId,
    majelisKode,
    hari,
    paniteraKode,
    keterangan,
  }: {
    actorUserId: string;
    majelisKode: string;
    hari: number;
    paniteraKode?: string;
    keterangan?: string;
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat mengubah hari sidang.");
  }

  const kode = String(majelisKode ?? "").trim().toUpperCase();
  if (!kode) {
    throw new ApiError(400, "Kode majelis tidak boleh kosong.");
  }

  if (!Number.isInteger(hari) || hari < 0 || hari > 6) {
    throw new ApiError(400, "Hari sidang harus antara 0 (Minggu) dan 6 (Sabtu).");
  }

  const sekarang = new Date().toISOString();

  return withTransaction(db, async (tx) => {
    await tx
      .prepare(
        "INSERT INTO aleta_sipp_hari_sidang " +
          "(majelis_kode, hari, panitera_kode, keterangan, updated_at, updated_by) " +
          "VALUES (?, ?, ?, ?, ?, ?) " +
          "ON CONFLICT(majelis_kode) DO UPDATE SET " +
          "hari = excluded.hari, " +
          "panitera_kode = excluded.panitera_kode, " +
          "keterangan = excluded.keterangan, " +
          "updated_at = excluded.updated_at, " +
          "updated_by = excluded.updated_by"
      )
      .run(
        kode,
        hari,
        String(paniteraKode ?? "").trim().toUpperCase(),
        String(keterangan ?? ""),
        sekarang,
        actor.id
      );

    return bacaHariSidang(tx);
  });
}

/** Menyimpan satu aturan hitungan. */
export async function simpanAturanPenunjukan(
  db: AletaDatabase,
  {
    actorUserId,
    kunci,
    nilai,
  }: {
    actorUserId: string;
    kunci: string;
    nilai: string;
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat mengubah aturan penunjukan.");
  }

  if (!(kunci in KETERANGAN_ATURAN)) {
    throw new ApiError(400, "Aturan penunjukan tidak dikenali.");
  }

  const sekarang = new Date().toISOString();

  return withTransaction(db, async (tx) => {
    await tx
      .prepare(
        "INSERT INTO aleta_sipp_aturan_penunjukan (kunci, nilai, keterangan, updated_at, updated_by) " +
          "VALUES (?, ?, ?, ?, ?) " +
          "ON CONFLICT(kunci) DO UPDATE SET " +
          "nilai = excluded.nilai, " +
          "updated_at = excluded.updated_at, " +
          "updated_by = excluded.updated_by"
      )
      .run(
        kunci,
        String(nilai ?? ""),
        KETERANGAN_ATURAN[kunci as keyof AturanPenunjukan],
        sekarang,
        actor.id
      );

    return bacaAturanPenunjukan(tx);
  });
}
