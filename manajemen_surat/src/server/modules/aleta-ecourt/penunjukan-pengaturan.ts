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
/**
 * ============================================================================
 * SK YANG SEDANG BERLAKU
 * ============================================================================
 *
 * Keputusan Ketua Pengadilan Agama Donggala
 * Nomor 254/KPA-W19-A5/SK.HK2.6/V/2026, tanggal 27 Agustus 2026, Lampiran I.
 *
 * Dipakai hanya sebagai NILAI AWAL. Begitu ada baris tersimpan, baris itulah
 * yang berlaku - SK berikutnya cukup disunting dari layar pengaturan, tanpa
 * menyentuh kode ini.
 *
 * Kode hakim (A, B, C1, C2, C3) cocok persis dengan hakim_pn di SIPP, jadi ia
 * dapat dipakai menemukan orangnya.
 *
 * Kode panitera TIDAK - lihat catatan panjang pada migrasi 0044. Karena itu
 * paniteraId dibiarkan KOSONG di sini: mengisinya dengan tebakan berarti
 * menetapkan panitera pengganti yang salah pada berkas perkara tanpa berbunyi.
 * Yang mengikatnya ke orang sungguhan adalah layar pengaturan, dan sampai itu
 * dikerjakan panel tetap memakai perhitungan bebannya sendiri.
 */
export const SK_BERLAKU = {
  nomor: "254/KPA-W19-A5/SK.HK2.6/V/2026",
  tanggal: "2026-08-27",
};

const MAJELIS_BAWAAN: Record<
  string,
  { hari: number; paniteraKode: string; hakimKode: string }
> = {
  // Ketua majelis di depan - urutannya menentukan siapa yang menandatangani
  // penetapan hari sidang.
  A: { hari: 3, paniteraKode: "D,D4", hakimKode: "A,C1,C3" }, // Rabu
  B: { hari: 2, paniteraKode: "D1,D5", hakimKode: "B,C2,C3" }, // Selasa
  C1: { hari: 1, paniteraKode: "D2,D3,D6", hakimKode: "C1,C2,C3" }, // Senin
};

export type HariSidangMajelis = {
  majelisKode: string;
  hari: number;
  namaHari: string;
  /** Kode panitera menurut SK - LABEL, bukan penunjuk orang. */
  paniteraKode: string[];
  /**
   * Kode SK beserta orangnya, BERPASANGAN.
   *
   * Dua daftar sejajar - kode di satu kolom, id di kolom lain - bergeser
   * diam-diam begitu satu kode dihapus dari tengah: D4 menjadi milik orang
   * yang seharusnya D5, dan tidak ada yang berbunyi. Karena itu keduanya
   * disimpan sebagai satu nilai, "D=26,D4=21".
   *
   * id 0 berarti kodenya ada di SK tetapi belum diikat ke orang di SIPP.
   */
  panitera: { kode: string; id: number }[];
  /** Kode hakim_pn menurut SK, ketua di depan. */
  hakimKode: string[];
  /**
   * Kode SK beserta AKUN PORTAL-nya, berpasangan - hakim maupun panitera.
   *
   * Hanya hidup di dalam baris majelis, dan itu disengaja: satker meminta
   * "hanya bisa ditautkan apabila masuk majelis, tidak bisa satu per satu".
   * Tautan yang berdiri di luar majelis mana pun tidak berarti apa-apa, sebab
   * yang menyidangkan perkara adalah MAJELIS, bukan orang lepas.
   */
  akun: { kode: string; akunId: string }[];
  skNomor: string;
  skTanggal: string;
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
  /**
   * Hakim bersertifikat ekonomi syariah, menurut kode hakimnya (C1, C2, ...).
   *
   * Perkara ekonomi syariah HANYA boleh diusulkan kepada mereka. Yang lain
   * tetap dapat dipilih manual - yang dibatasi usulannya, bukan haknya.
   *
   * Kosong berarti BELUM DIISI, dan usulannya kembali ke seluruh hakim aktif.
   * Itu disengaja: daftar kosong yang diperlakukan sebagai "tidak ada yang
   * bersertifikat" akan mengosongkan usulan ekonomi syariah sama sekali, dan
   * yang membacanya akan mengira ALETA rusak - bukan mengira daftarnya belum
   * diisi.
   */
  sertifikatEkonomiSyariah: string[];
  /**
   * Rasio beban panitera pengganti, ditulis "nama=angka" dipisah koma.
   *
   * Hakim rasionya dibaca dari ref_majelis_tetap milik SIPP - Smart Majelis
   * sudah menyimpannya di sana. Panitera pengganti TIDAK punya tempat seperti
   * itu di SIPP mana pun, jadi rasionya tinggal di sini.
   *
   * Yang tidak disebut berasio 100, yaitu bagian penuh.
   */
  rasioPanitera: string[];
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

  // Sejauh ini hanya satu orang di pengadilan ini yang bersertifikat ekonomi
  // syariah - Himawan Tatura Wijaya, kode C1. Ditulis sebagai kode, bukan
  // nama: nama berubah ejaannya antar tabel, kode tidak.
  sertifikatEkonomiSyariah: ["C1"],

  // Sri Susilowati berbanding 1 sedangkan yang lain 2 - keputusan pengadilan
  // ini. Ditulis sebagai persentase supaya sebentuk dengan rasio hakim:
  // 50 berbanding 100 adalah perbandingan 1 : 2 yang sama.
  rasioPanitera: ["Sri Susilowati=50"],

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
  sertifikatEkonomiSyariah:
    "Kode hakim bersertifikat ekonomi syariah - hanya mereka yang diusulkan untuk perkara ekonomi syariah. Kosong berarti belum diisi, dan usulannya kembali ke seluruh hakim aktif.",
  rasioPanitera:
    "Rasio beban panitera pengganti, ditulis nama=angka dipisah koma. 50 berarti separuh bagian orang berasio 100. Yang tidak disebut berasio penuh. Rasio hakim tidak diatur di sini - ia dibaca dari Smart Majelis milik SIPP.",
  kolamHakimTunggal:
    'Siapa yang boleh diusulkan jadi hakim tunggal: "hakim" menggugurkan Ketua dan Wakil.',
  polaNomorSk: "Pola nomor SK penetapan. Dikosongkan berarti tidak diisikan.",
  penetapanBerjabatan:
    'Apakah tiap penetapan dikunci pada jabatannya. "longgar" berarti operator dapat mengerjakan keempatnya; "ketat" mengunci PMH pada Ketua, PPP dan PJS pada Panitera, PHS pada ketua majelis.',
  simpanOtomatis:
    'Apakah ALETA ikut menekan tombol Simpan. "mati" berarti pengisian berhenti di blangko yang sudah terisi, dan orang yang menekannya.',
};

type BarisHari = {
  majelis_kode: string;
  hari: number;
  panitera_kode: string;
  hakim_kode: string;
  panitera_id: string;
  akun_id: string;
  sk_nomor: string;
  sk_tanggal: string;
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

/**
 * Pasangan kode-orang panitera, dibaca dari "D=26,D4=21".
 *
 * Kode yang ada di SK tetapi belum tersimpan pasangannya tetap dipulangkan
 * dengan id 0 - supaya layar pengaturan menampilkannya sebagai baris yang
 * MENUNGGU diikat, bukan menghilangkannya seolah SK-nya memang tidak
 * menyebutnya.
 */
function bacaPasanganPanitera(
  tersimpan: string,
  kodeSk: string[]
): { kode: string; id: number }[] {
  const peta = new Map<string, number>();
  for (const potong of tersimpan.split(",")) {
    const [kode, id] = potong.split("=");
    const bersih = String(kode ?? "").trim().toUpperCase();
    const nomor = Number(String(id ?? "").trim());
    if (!bersih) continue;
    peta.set(bersih, Number.isInteger(nomor) && nomor > 0 ? nomor : 0);
  }

  const hasil = kodeSk.map((kode) => ({ kode, id: peta.get(kode) ?? 0 }));
  // Ikatan yang kodenya sudah tidak ada di SK tetap dipulangkan di belakang:
  // membuangnya diam-diam menghapus pekerjaan yang sudah dilakukan seseorang.
  for (const [kode, id] of peta) {
    if (!kodeSk.includes(kode)) hasil.push({ kode, id });
  }
  return hasil;
}

/**
 * Membaca 'A=usr_7f3a,C1=usr_22b1' menjadi pasangan kode SK dengan id akun.
 *
 * Yang tidak berbentuk pasangan DIBUANG di sini, bukan dibiarkan sampai ke
 * berkas perkara: potongan tanpa tanda sama dengan tidak menunjuk siapa pun,
 * dan menyimpannya hanya menunda pertanyaannya sampai ke tempat yang lebih
 * mahal untuk salah.
 */
function bacaPasanganAkun(tersimpan: string): { kode: string; akunId: string }[] {
  const hasil: { kode: string; akunId: string }[] = [];
  const sudah = new Set<string>();
  for (const potong of String(tersimpan ?? "").split(",")) {
    const [kodeMentah, idMentah] = potong.split("=");
    const kode = String(kodeMentah ?? "").trim().toUpperCase();
    const akunId = String(idMentah ?? "").trim();
    if (!kode || !akunId) continue;
    // Kode yang sama disebut dua kali - yang pertama menang, dan yang kedua
    // dibuang tanpa berbunyi. Satu kode menunjuk satu orang.
    if (sudah.has(kode)) continue;
    sudah.add(kode);
    hasil.push({ kode, akunId });
  }
  return hasil;
}

/** Hari sidang tiap majelis, lengkap dengan yang masih memakai bawaan. */
export async function bacaHariSidang(db: AletaDatabase): Promise<HariSidangMajelis[]> {
  const baris = await db
    .prepare(
      "SELECT majelis_kode, hari, panitera_kode, hakim_kode, panitera_id, akun_id, " +
        "sk_nomor, sk_tanggal, keterangan FROM aleta_sipp_hari_sidang"
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
      const kodeHakim = item ? String(item.hakim_kode ?? "") : bawaan?.hakimKode ?? "";
      const daftar = (teks: string) =>
        teks
          .split(",")
          .map((x) => x.trim().toUpperCase())
          .filter((x) => x.length > 0);
      return {
        majelisKode,
        hari: aman,
        namaHari: NAMA_HARI[aman],
        paniteraKode: daftar(kodePp),
        panitera: bacaPasanganPanitera(String(item?.panitera_id ?? ""), daftar(kodePp)),
        akun: bacaPasanganAkun(String(item?.akun_id ?? "")),
        hakimKode: daftar(kodeHakim),
        skNomor: item ? String(item.sk_nomor ?? "") : SK_BERLAKU.nomor,
        skTanggal: item ? String(item.sk_tanggal ?? "") : SK_BERLAKU.tanggal,
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
    sertifikatEkonomiSyariah: daftarAtau(
      peta.get("sertifikatEkonomiSyariah"),
      ATURAN_BAWAAN.sertifikatEkonomiSyariah
    ),
    rasioPanitera: daftarAtau(peta.get("rasioPanitera"), ATURAN_BAWAAN.rasioPanitera),
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
    // Susunan menurut SK - dipakai penyusun usulan untuk mendahulukan majelis
    // yang memang ditetapkan, dan menandainya dengan kodenya.
    susunanSk: hariSidang
      .filter((x) => x.hakimKode.length > 0)
      .map((x) => ({
        majelisKode: x.majelisKode,
        hakimKode: x.hakimKode,
        // Hanya yang sudah terikat orangnya yang dikirim - kode tanpa orang
        // tidak dapat dipakai menunjuk siapa pun.
        panitera: x.panitera.filter((p) => p.id > 0),
        hari: x.hari,
      })),
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
    hakimKode,
    paniteraId,
    akunId,
    skNomor,
    skTanggal,
    keterangan,
  }: {
    actorUserId: string;
    majelisKode: string;
    hari: number;
    paniteraKode?: string;
    hakimKode?: string;
    paniteraId?: string;
    akunId?: string;
    skNomor?: string;
    skTanggal?: string;
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
          "(majelis_kode, hari, panitera_kode, hakim_kode, panitera_id, akun_id, " +
          "sk_nomor, sk_tanggal, keterangan, updated_at, updated_by) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
          "ON CONFLICT(majelis_kode) DO UPDATE SET " +
          "hari = excluded.hari, " +
          "panitera_kode = excluded.panitera_kode, " +
          "hakim_kode = excluded.hakim_kode, " +
          "panitera_id = excluded.panitera_id, " +
          "akun_id = excluded.akun_id, " +
          "sk_nomor = excluded.sk_nomor, " +
          "sk_tanggal = excluded.sk_tanggal, " +
          "keterangan = excluded.keterangan, " +
          "updated_at = excluded.updated_at, " +
          "updated_by = excluded.updated_by"
      )
      .run(
        kode,
        hari,
        String(paniteraKode ?? "").trim().toUpperCase(),
        String(hakimKode ?? "").trim().toUpperCase(),
        // Pasangan "KODE=ID". Yang tidak berbentuk pasangan dibuang di sini,
        // bukan dibiarkan sampai ke berkas perkara.
        String(paniteraId ?? "")
          .split(",")
          .map((potong) => {
            const [kode, id] = potong.split("=");
            const bersih = String(kode ?? "").trim().toUpperCase();
            const nomor = Number(String(id ?? "").trim());
            if (!bersih) return "";
            return `${bersih}=${Number.isInteger(nomor) && nomor > 0 ? nomor : 0}`;
          })
          .filter(Boolean)
          .join(","),
        // Pasangan "KODE=ID AKUN". Berbeda dari panitera_id, id akun portal
        // BUKAN bilangan - ia teks - jadi yang diperiksa keberadaannya, bukan
        // kebilangannya.
        String(akunId ?? "")
          .split(",")
          .map((potong) => {
            const [kodeMentah, idMentah] = potong.split("=");
            const bersih = String(kodeMentah ?? "").trim().toUpperCase();
            const akun = String(idMentah ?? "").trim();
            if (!bersih || !akun) return "";
            return `${bersih}=${akun}`;
          })
          .filter(Boolean)
          .join(","),
        String(skNomor ?? "").trim(),
        String(skTanggal ?? "").trim(),
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
