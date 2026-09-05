import { type AletaDatabase } from "@/server/db/client";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { KEADAAN_KREDENSIAL } from "@/server/modules/external-apps/service";

/**
 * Menautkan akun SIPP dengan jabatannya, lalu dengan kredensial ALETA.
 *
 * ============================================================================
 * MASALAH YANG DIPECAHKAN
 * ============================================================================
 *
 * Penetapan Hari Sidang dikerjakan ketua majelis perkara itu. Yang tercatat di
 * perkara_hakim_pn hanyalah hakim_id - sebuah ANGKA. Untuk mengerjakannya,
 * ALETA perlu tahu akun SIPP mana milik angka itu, dan apakah sandinya sudah
 * tersimpan.
 *
 * ============================================================================
 * MENGAPA TIDAK DICOCOKKAN LEWAT NAMA
 * ============================================================================
 *
 * Pernah saya lakukan, dan itu keliru dua kali:
 *
 *   1. Nama di ALETA bergelar lengkap ("SUDARMIN H.I.M. TANG, S.H.I.,M.H"),
 *      di SIPP tidak ("Sudarmin H.I.M. Tang"). Kemiripan nama adalah tebakan,
 *      dan tebakan yang salah di sini berarti penetapan dikerjakan atas nama
 *      hakim yang KELIRU.
 *
 *   2. Penautan yang saya simpulkan dari kebiasaan pemakaian menjawab siapa
 *      yang DULU memegang majelis, bukan siapa sekarang. Majelis B menunjuk
 *      akun Waka062024 pada 96% penetapan, padahal itu Akbar Ali yang kini
 *      diblokir.
 *
 * Sekarang penautannya dibaca dari user_hakim, user_panitera, dan
 * user_jurusita - tabel yang dipakai SIPP sendiri saat orang masuk.
 */

export type AkunJabatanSipp = {
  username: string;
  /** Nama yang DITAMPILKAN SIPP di kepala halaman sesudah masuk. */
  namaLengkap: string;
  /** Peran SIPP-nya: "Ketua/Wakil Ketua", "Hakim", "Panitera/Wakil Panitera". */
  grup: string;
  pejabatId: string;
  kode: string;
  nama: string;
  nip: string;
  aktif: boolean;
  diblokir: boolean;
  kedaluwarsa: boolean;
  terakhirMasuk: string | null;
};

export type PemetaanJabatanSipp = {
  hakim: AkunJabatanSipp[];
  panitera: AkunJabatanSipp[];
  jurusita: AkunJabatanSipp[];
};

export type JenisJabatan = keyof PemetaanJabatanSipp;

export type AkunSiapPakai = AkunJabatanSipp & {
  jabatan: JenisJabatan;
  /** Kredensial SIPP-nya sudah tersimpan di ALETA dan dinyalakan. */
  adaKredensial: boolean;
  /** Hasil uji terakhir: verified, wrong_password, not_tested, dan seterusnya. */
  keadaanKredensial: string;
  /** Nama pemilik akun ALETA yang menyimpan kredensial itu. */
  pemilikAleta: string | null;
  /** Id pengguna ALETA pemiliknya - dipakai mencocokkan penugasan PLH/PLT. */
  pemilikUserId: string | null;
  /** Peran akun ALETA pemiliknya: ketua, wakil-ketua, panitera, hakim, dst. */
  peranAleta: string | null;
  /** Siap dipakai mengerjakan penetapan: akun hidup DAN sandinya sudah teruji. */
  siap: boolean;
  /** Sebab ia belum siap, dalam bahasa yang dapat dibaca petugas. */
  sebabBelumSiap: string;
};

type BarisKredensial = {
  external_username: string;
  is_enabled: number;
  last_verified_status: string;
  id_pemilik: string | null;
  nama_pemilik: string | null;
  peran_pemilik: string | null;
};

/** Nama akun SIPP dicocokkan tanpa membedakan besar-kecil huruf. */
function kunciAkun(username: string) {
  return String(username ?? "").trim().toLowerCase();
}

/**
 * Membaca penautan akun-jabatan dari SIPP, lalu menempelkan keadaan kredensial
 * yang tersimpan di ALETA.
 *
 * Akun yang diblokir dan kedaluwarsa TIDAK dibuang di sini. Petugas yang
 * bertanya "mengapa PHS perkara ini tidak bisa dikerjakan" perlu membaca
 * sebabnya, dan sebab itu hilang bila barisnya disaring lebih dulu.
 */
export async function bacaPemetaanJabatan(db: AletaDatabase): Promise<{
  ok: boolean;
  galat: string;
  akun: AkunSiapPakai[];
}> {
  const jawaban = await callAletaBotSippBridge<PemetaanJabatanSipp>("jabatan.pemetaanAkun", {});
  if (!jawaban.ok || !jawaban.data) {
    return { ok: false, galat: jawaban.error ?? "ALETA Bot tidak merespons.", akun: [] };
  }

  const baris = await db
    .prepare(
      `SELECT c.external_username, c.is_enabled, c.last_verified_status,
        u.id AS id_pemilik, u.name AS nama_pemilik, u.role_id AS peran_pemilik
       FROM external_app_credentials c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.app_id = 'sipp'`
    )
    .all<BarisKredensial>();

  const kredensial = new Map<string, BarisKredensial>();
  for (const item of baris) {
    kredensial.set(kunciAkun(item.external_username), item);
  }

  const akun: AkunSiapPakai[] = [];
  for (const jabatan of ["hakim", "panitera", "jurusita"] as JenisJabatan[]) {
    for (const sumber of jawaban.data[jabatan] ?? []) {
      const cocok = kredensial.get(kunciAkun(sumber.username));
      const adaKredensial = Boolean(cocok && Number(cocok.is_enabled) === 1);
      const keadaanKredensial = cocok?.last_verified_status ?? KEADAAN_KREDENSIAL.BELUM_DIUJI;

      let sebabBelumSiap = "";
      if (sumber.diblokir) sebabBelumSiap = "Akun SIPP diblokir.";
      else if (sumber.kedaluwarsa) sebabBelumSiap = "Akun SIPP sudah kedaluwarsa.";
      else if (!adaKredensial) sebabBelumSiap = "Username dan password SIPP belum diisi di Manajemen Akun.";
      else if (keadaanKredensial === KEADAAN_KREDENSIAL.SANDI_SALAH) sebabBelumSiap = "Password sudah tidak cocok dengan SIPP.";
      else if (keadaanKredensial === KEADAAN_KREDENSIAL.TIDAK_TERDAFTAR) sebabBelumSiap = "Username tidak terdaftar di SIPP.";
      else if (keadaanKredensial === KEADAAN_KREDENSIAL.DIBLOKIR) sebabBelumSiap = "Akun SIPP diblokir.";
      else if (keadaanKredensial !== KEADAAN_KREDENSIAL.SAH) sebabBelumSiap = "Password belum pernah diuji.";

      akun.push({
        ...sumber,
        jabatan,
        adaKredensial,
        keadaanKredensial,
        pemilikAleta: cocok?.nama_pemilik ?? null,
        pemilikUserId: cocok?.id_pemilik ?? null,
        peranAleta: cocok?.peran_pemilik ?? null,
        siap: sebabBelumSiap === "",
        sebabBelumSiap,
      });
    }
  }

  return { ok: true, galat: "", akun };
}

/**
 * Akun SIPP mana yang harus dipakai untuk seorang pejabat.
 *
 * ============================================================================
 * ATURAN PEMILIHANNYA, DAN MENGAPA
 * ============================================================================
 *
 * Satu orang kerap punya beberapa akun SIPP - akun lama yang tidak dihapus
 * ketika ia berpindah satker. Pada data yang berjalan, hakim_id 30 punya tiga.
 *
 * Yang membedakan hanya "block". Untuk tiap kode majelis ternyata tersisa
 * PERSIS SATU akun yang tidak diblokir, sehingga penyaringan itu saja sudah
 * menjawabnya tanpa menebak.
 *
 * Kalau toh nanti tersisa lebih dari satu, yang dipilih adalah yang sandinya
 * SUDAH TERUJI - sebab akun yang belum teruji berarti belum tentu bisa
 * dipakai, dan memilihnya hanya memindahkan kegagalan ke saat penetapan
 * berjalan. Bila masih seri, yang terakhir dipakai orangnya yang menang.
 */
export function pilihAkunPejabat(akun: AkunSiapPakai[], jabatan: JenisJabatan, pejabatId: string) {
  const id = String(pejabatId ?? "").trim();
  if (!id) return null;

  const calon = akun.filter(
    (item) => item.jabatan === jabatan && item.pejabatId === id && !item.diblokir && !item.kedaluwarsa
  );
  if (calon.length === 0) return null;

  const urut = [...calon].sort((a, b) => {
    if (a.siap !== b.siap) return a.siap ? -1 : 1;
    if (a.adaKredensial !== b.adaKredensial) return a.adaKredensial ? -1 : 1;
    return String(b.terakhirMasuk ?? "").localeCompare(String(a.terakhirMasuk ?? ""));
  });

  return urut[0];
}

/**
 * Akun SIPP untuk mengerjakan PHS sebuah perkara.
 *
 * hakimIdKetua dibaca dari perkara_hakim_pn dengan jabatan_hakim_id = 1 -
 * yaitu ketua majelis perkara ITU, bukan ketua majelis menurut daftar SK.
 * Susunan majelis dapat diubah di tengah jalan, dan yang berlaku adalah yang
 * tercatat pada perkaranya.
 */
export async function akunPhsUntukPerkara(db: AletaDatabase, hakimIdKetua: string) {
  const pemetaan = await bacaPemetaanJabatan(db);
  if (!pemetaan.ok) {
    return { ok: false, galat: pemetaan.galat, akun: null as AkunSiapPakai | null };
  }

  const akun = pilihAkunPejabat(pemetaan.akun, "hakim", hakimIdKetua);
  if (!akun) {
    return {
      ok: false,
      galat: `Tidak ada akun SIPP aktif untuk hakim_id ${hakimIdKetua}.`,
      akun: null,
    };
  }

  return { ok: true, galat: akun.siap ? "" : akun.sebabBelumSiap, akun };
}
