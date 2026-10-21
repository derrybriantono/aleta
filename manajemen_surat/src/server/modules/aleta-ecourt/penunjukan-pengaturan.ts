import { isPrivilegedAdmin } from "@/lib/permissions";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { bacaSkMajelis } from "@/server/modules/pengaturan-abt/nomor-sk-sumber";
import { tanggalSah } from "@/lib/tanggal-indonesia";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

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
 * Keputusan Ketua Pengadilan Agama Donggala, Lampiran I.
 *
 * NOMOR dan TANGGAL SK-nya TIDAK lagi ditulis di sini (17 Okt 2026): SK BAWAAN
 * ada di kartu "Nomor SK penunjukan" (Integrasi e-Court, modules/pengaturan-abt/
 * nomor-sk-sumber.ts), dibaca juga oleh blangko ABT (#9550#/#9551#). Tiap majelis
 * BOLEH memakai SK sendiri sebagai PENGECUALIAN (kolom sk_nomor/sk_tanggal barisnya,
 * diisi dari layar SK majelis); kosong = ikut SK bawaan. Blangko ABT hanya satu
 * nilai (bawaan) - SK per majelis di blangko belum didukung.
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

/**
 * Nomor SK yang dulu tertanam di kode dan ikut tersimpan di baris majelis lewat layar lama
 * (ejaan "KPA-" dan "/V/" keliru; SK-nya sendiri ".../VIII/2026"). Bukan pengecualian
 * sungguhan - dibaca sebagai "ikut SK bawaan".
 */
const NOMOR_SK_TERTANAM_LAMA = "254/KPA-W19-A5/SK.HK2.6/V/2026";

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
  /** SK yang BERLAKU bagi majelis ini: pengecualiannya bila ada, bila tidak SK bawaan. */
  skNomor: string;
  skTanggal: string;
  /** true = tidak ada pengecualian, ikut SK bawaan (kartu Nomor SK penunjukan). */
  skIkutBawaan: boolean;
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
  /** 0 = dihapus dari SK (drizzle/0079); tidak ada pada basis data yang belum bermigrasi. */
  aktif?: number;
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

/** SK yang berlaku bagi satu majelis: pengecualian di barisnya, atau SK bawaan. */
function skBerlaku(item: BarisHari | undefined, bawaan: { nomor: string; tanggal: string }) {
  const nomor = String(item?.sk_nomor ?? "").trim();
  if (!nomor || nomor === NOMOR_SK_TERTANAM_LAMA) return { skNomor: bawaan.nomor, skTanggal: bawaan.tanggal, skIkutBawaan: true };
  return { skNomor: nomor, skTanggal: String(item?.sk_tanggal ?? "").trim() || bawaan.tanggal, skIkutBawaan: false };
}

/** Hari sidang tiap majelis, lengkap dengan yang masih memakai bawaan. */
export async function bacaHariSidang(db: AletaDatabase): Promise<HariSidangMajelis[]> {
  const kolom =
    "majelis_kode, hari, panitera_kode, hakim_kode, panitera_id, akun_id, sk_nomor, sk_tanggal, keterangan";
  let baris: BarisHari[];
  try {
    baris = await db.prepare(`SELECT ${kolom}, aktif FROM aleta_sipp_hari_sidang`).all<BarisHari>();
  } catch {
    // Basis data yang belum bermigrasi 0079: tanpa kolom aktif, semua baris dianggap aktif.
    baris = await db.prepare(`SELECT ${kolom} FROM aleta_sipp_hari_sidang`).all<BarisHari>();
  }

  const tersimpan = new Map<string, BarisHari>();
  // Majelis yang dihapus dari SK (aktif = 0) tidak tampil, termasuk dari nilai awal di kode.
  const dihapus = new Set<string>();
  for (const item of baris) {
    if (item.aktif !== undefined && item.aktif !== null && Number(item.aktif) === 0) {
      dihapus.add(String(item.majelis_kode));
      continue;
    }
    tersimpan.set(String(item.majelis_kode), item);
  }
  // SK bawaan; kolom sk_* per baris hanya dipakai bila terisi (pengecualian per majelis).
  const sk = await bacaSkMajelis(db);

  // Majelis yang tersimpan tetapi tidak ada di bawaan ikut ditampilkan -
  // majelis baru memang ditambahkan lewat menu, dan menyembunyikannya akan
  // membuat yang baru ditambahkan seolah tidak tersimpan.
  const kode = new Set<string>([...Object.keys(MAJELIS_BAWAAN), ...tersimpan.keys()]);
  for (const k of dihapus) kode.delete(k);

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
        ...skBerlaku(item, sk),
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
 * Pegawai di SK yang perlu diperbarui (20 Okt 2026): akun portal yang ditautkan
 * ke kode SK sudah tidak aktif (mutasi) atau jabatannya berganti sehingga bukan
 * lagi panitera pengganti. Hanya MEMBACA; SK tetap disunting di halaman SK Majelis.
 * Pemeriksaan sisi SIPP (hakim/panitera tidak aktif, akun terblokir) dilakukan bot.
 */
export type PeringatanSk = { majelisKode: string; kode: string; nama: string; alasan: string };

export async function periksaAkunSk(db: AletaDatabase, hariSidang: HariSidangMajelis[]): Promise<PeringatanSk[]> {
  const hasil: PeringatanSk[] = [];
  for (const m of hariSidang) {
    for (const t of m.akun ?? []) {
      let baris:
        | { name: string; role_id: string; additional_role_ids_json: string; is_active: number; deleted_at: string | null }
        | undefined;
      try {
        baris = await db
          .prepare("SELECT name, role_id, additional_role_ids_json, is_active, deleted_at FROM users WHERE id = ?")
          .get(t.akunId);
      } catch {
        continue; // tidak terbaca = tidak tahu, bukan peringatan
      }
      if (!baris) {
        hasil.push({ majelisKode: m.majelisKode, kode: t.kode, nama: "", alasan: "akun portal yang ditautkan sudah tidak ada" });
        continue;
      }
      const nama = String(baris.name ?? "");
      if (Number(baris.is_active) !== 1 || baris.deleted_at) {
        hasil.push({ majelisKode: m.majelisKode, kode: t.kode, nama, alasan: "akun sudah tidak aktif (mutasi)" });
        continue;
      }
      const adalahPanitera = m.panitera.some((p) => p.kode === t.kode) || m.paniteraKode.includes(t.kode);
      if (adalahPanitera) {
        let tambahan: string[] = [];
        try {
          tambahan = JSON.parse(String(baris.additional_role_ids_json || "[]")) as string[];
        } catch {
          tambahan = [];
        }
        const peran = [String(baris.role_id ?? ""), ...tambahan];
        if (!peran.includes("panitera-pengganti")) {
          hasil.push({ majelisKode: m.majelisKode, kode: t.kode, nama, alasan: "jabatannya sekarang bukan lagi panitera pengganti" });
        }
      }
    }
  }
  return hasil;
}

/**
 * Keduanya sekaligus - inilah yang dikirim ke bot bersama nomor perkaranya.
 *
 * Bot tidak menyimpan setelan apa pun sendiri. Ia hanya tahu SIPP, dan
 * menerima aturannya dari pemanggil. Kalau bot ikut menyimpan salinan, ada dua
 * tempat yang harus disunting tiap SK berganti - dan yang kedua pasti terlupa.
 */
/**
 * Nama petugas yang akun portalnya NONAKTIF/terhapus (mutasi) dan tidak punya akun
 * aktif lain bernama sama. Bot memakainya agar panitera pengganti / juru sita yang
 * sudah pindah tidak diusulkan dan tidak tampil di tabel beban. Nama sudah dibersihkan
 * dari gelar (namaBersih); tanpa kata sandi atau data lain.
 */
export async function bacaPetugasNonaktif(db: AletaDatabase): Promise<string[]> {
  const akun = await bacaAkunUntukPeringatan(db);
  const aktif = new Set(akun.filter((a) => a.aktif).map((a) => namaBersih(a.nama)));
  const hasil = new Set<string>();
  for (const a of akun) {
    if (a.aktif) continue;
    const n = namaBersih(a.nama);
    if (n && !aktif.has(n)) hasil.add(n);
  }
  return [...hasil];
}

export async function bacaPengaturanPenunjukan(db: AletaDatabase) {
  const [hariSidang, aturan, skBawaan] = await Promise.all([
    bacaHariSidang(db),
    bacaAturanPenunjukan(db),
    bacaSkMajelis(db),
  ]);
  const peringatanSk = await periksaAkunSk(db, hariSidang);
  const berlaku = await bacaBerlakuMulai(db);
  const petugasNonaktif = await bacaPetugasNonaktif(db);

  return {
    aturan,
    petugasNonaktif,
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
        // SK yang berlaku bagi majelis ini (bawaan atau pengecualian) - ditampilkan di papan.
        skNomor: x.skNomor,
        skTanggal: x.skTanggal,
      })),
    // SK bawaan (Pengaturan > SK majelis): nomor dan tanggal yang tampil di papan dan
    // dipakai memeriksa kesesuaian penetapan.
    sk: { nomor: skBawaan.nomor, tanggal: skBawaan.tanggal, berlaku: berlaku.tanggal, peringatan: peringatanSk },
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
    /**
     * Pengecualian SK majelis ini (17 Okt 2026): nomor DAN tanggal (yyyy-mm-dd) sekaligus;
     * keduanya "" = ikut SK bawaan; tidak dikirim (undefined) = biarkan yang tersimpan.
     */
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

  if (!/^[A-Z0-9]{1,8}$/.test(kode)) {
    throw new ApiError(400, "Kode majelis hanya huruf dan angka, paling banyak 8 (mis. A, B, C1).");
  }

  if (!Number.isInteger(hari) || hari < 0 || hari > 6) {
    throw new ApiError(400, "Hari sidang harus antara 0 (Minggu) dan 6 (Sabtu).");
  }

  // Kode hakim dan panitera: bentuk yang sama dengan yang disaring bot, tanpa kembar.
  for (const [label, teks] of [
    ["hakim", hakimKode],
    ["panitera", paniteraKode],
  ] as const) {
    const daftar = String(teks ?? "")
      .split(",")
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean);
    if (daftar.some((x) => !/^[A-Z0-9]{1,8}$/.test(x))) {
      throw new ApiError(400, `Kode ${label} hanya huruf dan angka, paling banyak 8.`);
    }
    if (new Set(daftar).size !== daftar.length) {
      throw new ApiError(400, `Kode ${label} tidak boleh kembar dalam satu majelis.`);
    }
  }

  const sekarang = new Date().toISOString();
  let sk = { nomor: "", tanggal: "" };
  if (skNomor === undefined && skTanggal === undefined) {
    const lama = await db.prepare("SELECT sk_nomor, sk_tanggal FROM aleta_sipp_hari_sidang WHERE majelis_kode = ?").get<{ sk_nomor: string; sk_tanggal: string }>(kode);
    sk = { nomor: String(lama?.sk_nomor ?? ""), tanggal: String(lama?.sk_tanggal ?? "") };
  } else {
    sk = { nomor: String(skNomor ?? "").replace(/\s+/g, " ").trim(), tanggal: String(skTanggal ?? "").trim() };
    if (Boolean(sk.nomor) !== Boolean(sk.tanggal)) {
      throw new ApiError(400, "Isi nomor dan tanggal SK majelis sekaligus, atau kosongkan keduanya agar ikut SK bawaan.");
    }
    if (sk.nomor.length > 120) throw new ApiError(400, "Nomor SK majelis terlalu panjang (lebih dari 120 huruf).");
    if (sk.tanggal && !tanggalSah(sk.tanggal)) throw new ApiError(400, "Tanggal SK majelis tidak sah.");
  }

  return withTransaction(db, async (tx) => {
    const sebelum = (await bacaHariSidang(tx)).find((x) => x.majelisKode === kode) ?? null;
    const nilai = [
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
      sk.nomor,
      sk.tanggal,
      String(keterangan ?? ""),
      sekarang,
      actor.id,
    ];
    const kolomUmum =
      "majelis_kode, hari, panitera_kode, hakim_kode, panitera_id, akun_id, sk_nomor, sk_tanggal, keterangan, updated_at, updated_by";
    const perbarui =
      "hari = excluded.hari, panitera_kode = excluded.panitera_kode, hakim_kode = excluded.hakim_kode, " +
      "panitera_id = excluded.panitera_id, akun_id = excluded.akun_id, sk_nomor = excluded.sk_nomor, " +
      "sk_tanggal = excluded.sk_tanggal, keterangan = excluded.keterangan, " +
      "updated_at = excluded.updated_at, updated_by = excluded.updated_by";
    try {
      // Menyimpan menghidupkan kembali majelis yang pernah dihapus (aktif = 1).
      await tx
        .prepare(
          `INSERT INTO aleta_sipp_hari_sidang (${kolomUmum}, aktif) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) ` +
            `ON CONFLICT(majelis_kode) DO UPDATE SET ${perbarui}, aktif = 1`
        )
        .run(...nilai);
    } catch (galat) {
      // Basis data yang belum bermigrasi 0079 (tanpa kolom aktif): perilaku lama.
      if (!/aktif/i.test(String((galat as Error)?.message ?? galat))) throw galat;
      await tx
        .prepare(
          `INSERT INTO aleta_sipp_hari_sidang (${kolomUmum}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ` +
            `ON CONFLICT(majelis_kode) DO UPDATE SET ${perbarui}`
        )
        .run(...nilai);
    }

    const sesudahDaftar = await bacaHariSidang(tx);
    const sesudah = sesudahDaftar.find((x) => x.majelisKode === kode) ?? null;
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: sebelum ? "SIMPAN_SK_MAJELIS" : "TAMBAH_SK_MAJELIS",
      entityType: "sk_majelis",
      entityId: kode,
      payload: { sebelum: ringkasMajelis(sebelum), sesudah: ringkasMajelis(sesudah) },
      createdAt: sekarang,
    });

    return sesudahDaftar;
  });
}

/** Ringkasan satu majelis untuk jejak perubahan (tanpa akun portal). */
export function ringkasMajelis(m: HariSidangMajelis | null) {
  if (!m) return null;
  return {
    hari: m.namaHari,
    hakim: m.hakimKode.join(","),
    panitera: m.panitera.map((p) => `${p.kode}=${p.id}`).join(","),
    skNomor: m.skIkutBawaan ? "" : m.skNomor,
    skTanggal: m.skIkutBawaan ? "" : m.skTanggal,
  };
}

/**
 * Menghapus satu majelis dari SK (soft: aktif = 0). Majelis bawaan yang belum
 * pernah disimpan ikut ditandai agar tidak muncul lagi dari nilai awal di kode.
 * Menyimpan majelis itu lagi menghidupkannya kembali.
 */
export async function hapusMajelis(
  db: AletaDatabase,
  { actorUserId, majelisKode }: { actorUserId: string; majelisKode: string }
) {
  const actor = await requireActorUser(db, actorUserId);
  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat menghapus majelis dari SK.");
  }
  const kode = String(majelisKode ?? "").trim().toUpperCase();
  if (!kode) throw new ApiError(400, "Kode majelis tidak boleh kosong.");

  const sekarang = new Date().toISOString();
  return withTransaction(db, async (tx) => {
    const sebelum = (await bacaHariSidang(tx)).find((x) => x.majelisKode === kode) ?? null;
    if (!sebelum) throw new ApiError(404, `Majelis ${kode} tidak ada di SK.`);
    try {
      await tx
        .prepare(
          "INSERT INTO aleta_sipp_hari_sidang (majelis_kode, hari, panitera_kode, hakim_kode, panitera_id, akun_id, " +
            "sk_nomor, sk_tanggal, keterangan, aktif, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?) " +
            "ON CONFLICT(majelis_kode) DO UPDATE SET aktif = 0, updated_at = excluded.updated_at, updated_by = excluded.updated_by"
        )
        .run(
          kode,
          sebelum.hari,
          sebelum.paniteraKode.join(","),
          sebelum.hakimKode.join(","),
          sebelum.panitera.map((p) => `${p.kode}=${p.id}`).join(","),
          sebelum.akun.map((a) => `${a.kode}=${a.akunId}`).join(","),
          sebelum.skIkutBawaan ? "" : sebelum.skNomor,
          sebelum.skIkutBawaan ? "" : sebelum.skTanggal,
          sebelum.keterangan,
          sekarang,
          actor.id
        );
    } catch (galat) {
      if (/aktif/i.test(String((galat as Error)?.message ?? galat))) {
        throw new ApiError(
          409,
          "Penghapusan majelis butuh migrasi 0079 (kolom aktif). Jalankan migrasi di server lebih dahulu."
        );
      }
      throw galat;
    }
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "HAPUS_SK_MAJELIS",
      entityType: "sk_majelis",
      entityId: kode,
      payload: { sebelum: ringkasMajelis(sebelum), sesudah: null },
      createdAt: sekarang,
    });
    return bacaHariSidang(tx);
  });
}

// ---------------------------------------------------------------------------
// "Berlaku mulai" SK
// ---------------------------------------------------------------------------

const KUNCI_BERLAKU_MULAI = "skBerlakuMulai";

/**
 * Tanggal SK mulai berlaku (yyyy-mm-dd). Belum diisi = tanggal SK-nya sendiri.
 * Dipakai bot: majelis SK dinilai bebannya sejak tanggal ini, dan penetapan
 * sebelum tanggal ini tidak dinilai terhadap SK.
 */
export async function bacaBerlakuMulai(db: AletaDatabase): Promise<{ tanggal: string; diisi: boolean }> {
  try {
    const b = await db
      .prepare("SELECT nilai FROM aleta_sipp_aturan_penunjukan WHERE kunci = ?")
      .get<{ nilai: string }>(KUNCI_BERLAKU_MULAI);
    const tanggal = String(b?.nilai ?? "").trim();
    if (tanggal && tanggalSah(tanggal)) return { tanggal, diisi: true };
  } catch {
    /* tidak terbaca = belum diisi */
  }
  const sk = await bacaSkMajelis(db);
  return { tanggal: sk.tanggal, diisi: false };
}

export async function simpanBerlakuMulai(
  db: AletaDatabase,
  { actorUserId, tanggal }: { actorUserId: string; tanggal: string }
) {
  const actor = await requireActorUser(db, actorUserId);
  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat mengubah tanggal SK berlaku.");
  }
  const nilai = String(tanggal ?? "").trim();
  if (nilai && !tanggalSah(nilai)) throw new ApiError(400, "Tanggal berlaku mulai tidak sah.");
  const sekarang = new Date().toISOString();
  const sebelum = await bacaBerlakuMulai(db);
  await withTransaction(db, async (tx) => {
    await tx
      .prepare(
        "INSERT INTO aleta_sipp_aturan_penunjukan (kunci, nilai, keterangan, updated_at, updated_by) VALUES (?, ?, ?, ?, ?) " +
          "ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai, updated_at = excluded.updated_at, updated_by = excluded.updated_by"
      )
      .run(KUNCI_BERLAKU_MULAI, nilai, "Tanggal SK susunan majelis mulai berlaku (kosong = tanggal SK).", sekarang, actor.id);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UBAH_SK_BERLAKU_MULAI",
      entityType: "sk_majelis",
      entityId: "*berlaku-mulai*",
      payload: { sebelum: sebelum.diisi ? sebelum.tanggal : "", sesudah: nilai },
      createdAt: sekarang,
    });
  });
  return bacaBerlakuMulai(db);
}

// ---------------------------------------------------------------------------
// Jejak perubahan
// ---------------------------------------------------------------------------

export type JejakSk = {
  id: string;
  aksi: string;
  majelisKode: string;
  oleh: string;
  pada: string;
  sebelum: unknown;
  sesudah: unknown;
};

/** Perubahan SK terbaru (audit_logs entity 'sk_majelis'), paling baru di depan. */
export async function bacaJejakSk(db: AletaDatabase, batas = 20): Promise<JejakSk[]> {
  try {
    const baris = await db
      .prepare(
        "SELECT a.id, a.action, a.entity_id, a.payload_json, a.created_at, u.name AS nama FROM audit_logs a " +
          "LEFT JOIN users u ON u.id = a.actor_user_id WHERE a.entity_type = 'sk_majelis' " +
          "ORDER BY a.created_at DESC, a.id DESC LIMIT ?"
      )
      .all<{
        id: string;
        action: string;
        entity_id: string;
        payload_json: string | null;
        created_at: string;
        nama: string | null;
      }>(Math.max(1, Math.min(100, batas)));
    return baris.map((b) => {
      let isi: { sebelum?: unknown; sesudah?: unknown } = {};
      try {
        isi = JSON.parse(String(b.payload_json ?? "{}"));
      } catch {
        isi = {};
      }
      return {
        id: String(b.id),
        aksi: String(b.action),
        majelisKode: String(b.entity_id),
        oleh: String(b.nama ?? "-"),
        pada: String(b.created_at),
        sebelum: isi.sebelum ?? null,
        sesudah: isi.sesudah ?? null,
      };
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Peringatan: pegawai di SK yang sudah tidak aktif / jabatannya berubah
// ---------------------------------------------------------------------------

export type PeringatanSkRinci = PeringatanSk & { jenis: "hakim" | "panitera" };

const GELAR = /\b(s\.?\s?h\.?i?|m\.?\s?h\.?i?|s\.?\s?ag|dr|drs|hj?|s\.?\s?kom)\b\.?/gi;
function namaBersih(teks: string) {
  return String(teks ?? "")
    .toLowerCase()
    .replace(/,.*$/, "")
    .replace(GELAR, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Peringatan dari SK terhadap daftar pegawai SIPP yang aktif dan akun portal:
 *   - kode hakim di SK tidak ada di hakim_pn aktif;
 *   - panitera yang diikat sudah tidak aktif di SIPP;
 *   - panitera yang diikat punya akun portal (dicocokkan lewat nama) yang
 *     nonaktif (mutasi) atau berjabatan bukan lagi panitera pengganti.
 * Murni terhadap masukannya (diuji).
 */
export function susunPeringatanSk(input: {
  majelis: HariSidangMajelis[];
  hakimAktif: Array<{ id: number; kode: string; nama: string }>;
  paniteraAktif: Array<{ id: number; kode: string; nama: string }>;
  akun: Array<{ id: string; nama: string; roleId: string; tambahan: string[]; aktif: boolean }>;
  pegawaiTerbaca: boolean;
}): PeringatanSkRinci[] {
  const hasil: PeringatanSkRinci[] = [];
  const { majelis, hakimAktif, paniteraAktif, akun, pegawaiTerbaca } = input;
  const kodeHakim = new Set(hakimAktif.map((h) => String(h.kode || "").toUpperCase()).filter(Boolean));
  const idPanitera = new Map(paniteraAktif.map((p) => [p.id, p]));
  for (const m of majelis) {
    if (pegawaiTerbaca) {
      for (const k of m.hakimKode) {
        if (!kodeHakim.has(k)) {
          hasil.push({ majelisKode: m.majelisKode, kode: k, nama: "", alasan: "hakim dengan kode ini sudah tidak aktif di SIPP", jenis: "hakim" });
        }
      }
    }
    for (const p of m.panitera) {
      if (!(p.id > 0)) continue;
      const orang = idPanitera.get(p.id);
      if (pegawaiTerbaca && !orang) {
        hasil.push({ majelisKode: m.majelisKode, kode: p.kode, nama: "", alasan: "panitera yang diikat sudah tidak aktif di SIPP", jenis: "panitera" });
        continue;
      }
      if (!orang) continue;
      const sama = akun.filter((a) => namaBersih(a.nama) === namaBersih(orang.nama));
      if (sama.length === 0) continue;
      const aktif = sama.filter((a) => a.aktif);
      if (aktif.length === 0) {
        hasil.push({ majelisKode: m.majelisKode, kode: p.kode, nama: orang.nama, alasan: "akun portalnya sudah tidak aktif (mutasi)", jenis: "panitera" });
      } else if (!aktif.some((a) => a.roleId === "panitera-pengganti" || a.tambahan.includes("panitera-pengganti"))) {
        hasil.push({ majelisKode: m.majelisKode, kode: p.kode, nama: orang.nama, alasan: "jabatannya sekarang bukan lagi panitera pengganti", jenis: "panitera" });
      }
    }
  }
  return hasil;
}

/** Daftar akun portal untuk pencocokan nama (tanpa kata sandi). */
export async function bacaAkunUntukPeringatan(db: AletaDatabase) {
  try {
    const baris = await db
      .prepare("SELECT id, name, role_id, additional_role_ids_json, is_active, deleted_at FROM users")
      .all<{
        id: string;
        name: string;
        role_id: string;
        additional_role_ids_json: string;
        is_active: number;
        deleted_at: string | null;
      }>();
    return baris.map((u) => {
      let tambahan: string[] = [];
      try {
        tambahan = JSON.parse(String(u.additional_role_ids_json || "[]")) as string[];
      } catch {
        tambahan = [];
      }
      return {
        id: String(u.id),
        nama: String(u.name ?? ""),
        roleId: String(u.role_id ?? ""),
        tambahan,
        aktif: Number(u.is_active) === 1 && !u.deleted_at,
      };
    });
  } catch {
    return [];
  }
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
