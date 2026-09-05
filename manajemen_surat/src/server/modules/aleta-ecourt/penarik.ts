import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";

import type { Bagian, Sistem } from "@/server/modules/aleta-ecourt/berkas-perkara";

/**
 * BENTUK BAKU PENARIK - menambah sumber jadi pekerjaan sehari.
 *
 * ============================================================================
 * SATU DAFTAR, BUKAN SEPULUH PEMANGGILAN YANG TERSEBAR
 * ============================================================================
 *
 * Sebelumnya tiap bagian berkas ditulis sebagai satu pemanggilan tersendiri di
 * dalam perakit. Menambah sumber berarti menyunting perakitnya, dan yang lupa
 * disunting bukan pemanggilannya melainkan hal-hal di sekitarnya: nama
 * sistemnya, tabel asalnya, bentuk kosongnya, dan penyebutan halangannya.
 *
 * Di sini seluruh keterangan itu berdiri berdampingan pada satu baris daftar.
 * Menambah sumber berarti menambah satu baris - dan satu baris yang kurang
 * lengkap tidak dapat lolos, karena bentuknya menuntut seluruh medannya.
 *
 * ============================================================================
 * PENARIK BUKAN PEMANGGILAN
 * ============================================================================
 *
 * Yang dinyatakan tiap penarik bukan "panggil operasi ini", melainkan: bagian
 * apa yang diisinya, dari sistem mana, dari tabel mana, apa bentuk kosongnya,
 * dan apakah kegagalannya perlu disebut kepada petugas.
 *
 * Perbedaannya menentukan: sumber yang tidak wajib ada - jurusita pada perkara
 * yang belum dipanggil - tidak boleh muncul sebagai halangan, karena halangan
 * yang selalu muncul berhenti dibaca.
 */

export type Penarik<T = unknown> = {
  /** Nama medan pada berkas perkara. */
  kunci: string;
  operasi: string;
  sistem: Sistem;
  /** Tabel atau operasi asalnya, untuk ditelusuri kembali. */
  sumber: string;
  bawaan: T;
  /**
   * Kegagalan sumber ini disebut kepada petugas.
   *
   * Dinyalakan hanya untuk sumber yang ketiadaannya benar-benar menghalangi
   * pekerjaan. Jurusita yang belum ditunjuk adalah keadaan biasa, bukan
   * halangan - dan daftar halangan yang selalu berisi berhenti dibaca.
   */
  wartakanGagal: boolean;
};

/**
 * Sumber berkas perkara.
 *
 * Urutannya urutan tampil di layar, bukan urutan pengambilan - seluruhnya
 * diambil bersamaan.
 */
export const PENARIK: Penarik[] = [
  { kunci: "identitas", operasi: "case.detail", sistem: "SIPP", sumber: "perkara", bawaan: null, wartakanGagal: true },
  { kunci: "paraPihak", operasi: "case.parties", sistem: "SIPP", sumber: "perkara_pihak", bawaan: [], wartakanGagal: true },
  { kunci: "majelis", operasi: "case.judges", sistem: "SIPP", sumber: "perkara_hakim_pn", bawaan: [], wartakanGagal: true },
  { kunci: "panitera", operasi: "case.panitera", sistem: "SIPP", sumber: "perkara_panitera_pn", bawaan: [], wartakanGagal: false },
  { kunci: "jurusita", operasi: "case.jurusita", sistem: "SIPP", sumber: "perkara_jurusita", bawaan: [], wartakanGagal: false },
  { kunci: "riwayatSidang", operasi: "case.schedule", sistem: "SIPP", sumber: "perkara_jadwal_sidang", bawaan: [], wartakanGagal: true },
  { kunci: "saksiTercatat", operasi: "case.witnesses", sistem: "SIPP", sumber: "perkara_saksi", bawaan: [], wartakanGagal: false },
  {
    kunci: "pemeriksaanSaksi",
    operasi: "case.pemeriksaanSaksi",
    sistem: "APS Badilag",
    sumber: "abt_keterangan_saksi",
    bawaan: null,
    wartakanGagal: true,
  },
  { kunci: "putusan", operasi: "case.decision", sistem: "SIPP", sumber: "perkara_putusan", bawaan: null, wartakanGagal: false },
  {
    kunci: "pertimbangan",
    operasi: "case.pertimbangan",
    sistem: "SIPP",
    sumber: "perkara_pertimbangan_hukum",
    bawaan: null,
    wartakanGagal: true,
  },
];

/**
 * Menjalankan satu penarik tanpa menjatuhkan sisanya.
 *
 * Satu sumber yang mati TIDAK boleh mengosongkan seluruh berkas. Petugas yang
 * membuka perkara saat ABT sedang mati tetap harus melihat data SIPP-nya.
 */
export async function jalankanPenarik(penarik: Penarik, perkaraId: string): Promise<Bagian<unknown>> {
  const diambil = new Date().toISOString();
  const asal = { sistem: penarik.sistem, sumber: penarik.sumber, diambil };

  try {
    const jawaban = await callAletaBotSippBridge<unknown>(penarik.operasi, { perkaraId });
    if (!jawaban.ok) {
      return { ada: false, nilai: penarik.bawaan, asal, galat: jawaban.error ?? "tidak terbaca" };
    }
    const nilai = jawaban.data ?? penarik.bawaan;
    const berisi = Array.isArray(nilai) ? nilai.length > 0 : Boolean(nilai);
    return { ada: berisi, nilai, asal, galat: "" };
  } catch (galat) {
    return {
      ada: false,
      nilai: penarik.bawaan,
      asal,
      galat: galat instanceof Error ? galat.message : "tidak terbaca",
    };
  }
}

/** Menjalankan seluruh penarik BERSAMAAN, hasilnya berkunci nama medan. */
export async function jalankanSemuaPenarik(perkaraId: string): Promise<Record<string, Bagian<unknown>>> {
  const hasil = await Promise.all(PENARIK.map((penarik) => jalankanPenarik(penarik, perkaraId)));

  const peta: Record<string, Bagian<unknown>> = {};
  PENARIK.forEach((penarik, urutan) => {
    peta[penarik.kunci] = hasil[urutan];
  });
  return peta;
}

/** Halangan yang perlu disebut kepada petugas, dengan nama sistem dan tabelnya. */
export function halanganPenarik(bagian: Record<string, Bagian<unknown>>): string[] {
  return PENARIK.filter((penarik) => penarik.wartakanGagal && bagian[penarik.kunci]?.galat)
    .map((penarik) => `${penarik.sistem} - ${penarik.sumber}: ${bagian[penarik.kunci].galat}`);
}
