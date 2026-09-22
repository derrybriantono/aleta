import { petaJarakAntarSidang, petaJarakBerikutSidang } from "@/lib/jarak-antar-sidang";

/**
 * ============================================================================
 * MENYUSUN REKAMAN ANTRIAN - BAGIAN YANG TIDAK MENYENTUH BASIS DATA
 * ============================================================================
 *
 * Diminta pengguna 22 September 2026: ALETA menyimpan sendiri urutan antrian
 * sidang, pengambilannya, siapa yang mengambil, dan jarak antara satu perkara
 * dengan perkara berikutnya. Sebab lengkapnya ada di 0048_rekam_antrian.sql.
 *
 * Berkas ini hanya MENYUSUN barisnya - dari daftar sidang dan peta antrian
 * yang sama persis dengan yang dipakai layar. Penulisannya ke basis data ada
 * di server/modules/aleta-ecourt/rekam-antrian.ts.
 *
 * Dipisah begitu supaya perhitungan urutan dan jaraknya - satu-satunya bagian
 * yang dapat salah diam-diam - dapat diuji tanpa satu pun basis data, dan
 * diuji atas angka yang sama dengan yang dilihat orang di layar.
 */

/** Satu baris sidang, sebatas yang diperlukan rekaman. */
export type SidangUntukRekam = {
  perkaraId: string;
  nomorPerkara: string;
  sidangId: string;
  tanggalSidang: string;
  ruangan?: string;
};

/** Satu baris antrian, sebatas yang diperlukan rekaman. */
export type AntrianUntukRekam = {
  nomor: number | null;
  tanggalSidang: string;
  waktuAmbil?: string;
  jamPanggil?: string;
  online?: boolean;
  keadaan?: string;
  namaPetugas?: string;
};

/** Satu baris siap tulis. */
export type BarisRekamAntrian = {
  id: string;
  tanggalSidang: string;
  sidangId: string;
  perkaraId: string;
  nomorPerkara: string;
  ruangan: string;
  nomorAntrian: number | null;
  urutanRuang: number | null;
  waktuAmbil: string;
  jamPanggil: string;
  online: boolean;
  keadaan: string;
  namaPetugas: string;
  jarakSebelumMenit: number | null;
  jarakBerikutMenit: number | null;
};

const teks = (nilai: unknown): string => String(nilai ?? "").trim();

/** Kunci baris - lihat sebabnya di 0048_rekam_antrian.sql. */
export function kunciRekam(tanggalSidang: string, sidangId: string): string {
  return `${teks(tanggalSidang)}|${teks(sidangId)}`;
}

/**
 * Menyusun baris rekaman dari daftar sidang dan peta antrian.
 *
 * ============================================================================
 * YANG BELUM MENGAMBIL NOMOR TETAP DIREKAM
 * ============================================================================
 *
 * Dan itu disengaja. "Perkara ini tidak pernah mengambil nomor antrian"
 * adalah keterangan, bukan ketiadaan keterangan - ia yang menjawab pertanyaan
 * berapa banyak sidang yang berjalan di luar antrian. Merekam hanya yang
 * bernomor membuat angka itu mustahil dihitung, sebab yang hilang tidak
 * terbedakan dari yang belum sempat direkam.
 *
 * Yang TIDAK direkam hanya baris tanpa sidang_id: tanpa itu ia tidak punya
 * kunci, dan baris tanpa kunci akan saling menimpa.
 */
export function susunRekamAntrian(
  sidang: SidangUntukRekam[],
  peta: Record<string, AntrianUntukRekam> | undefined
): BarisRekamAntrian[] {
  const pakai = sidang.filter((x) => teks(x.sidangId) && teks(x.tanggalSidang));

  const antrianBaris = (baris: SidangUntukRekam): AntrianUntukRekam | undefined => {
    const punya = peta?.[teks(baris.perkaraId)];
    if (!punya) return undefined;
    // Aturan yang sama dengan layar: peta antrian berkunci perkara, bukan
    // sidang. Perkara yang bersidang dua kali dalam rentang yang dibuka akan
    // mendapat baris antrian hari LAIN bila tanggalnya tidak diperiksa.
    if (!punya.tanggalSidang || !baris.tanggalSidang) return undefined;
    return punya.tanggalSidang === baris.tanggalSidang ? punya : undefined;
  };

  // ==========================================================================
  // JARAK DIHITUNG PER HARI, BUKAN ATAS SELURUH RENTANG
  // ==========================================================================
  //
  // Rentang seminggu yang dihitung sekaligus menghasilkan "jarak" antara
  // sidang terakhir hari Senin dan sidang pertama hari Selasa - angka yang
  // tidak pernah dialami siapa pun, dan yang akan terbaca sebagai ruang
  // menganggur dua puluh jam.
  const perHari = new Map<string, SidangUntukRekam[]>();
  for (const baris of pakai) {
    const hari = teks(baris.tanggalSidang);
    if (!perHari.has(hari)) perHari.set(hari, []);
    perHari.get(hari)!.push(baris);
  }

  const hasil: BarisRekamAntrian[] = [];
  for (const [, deret] of perHari) {
    const bahan = deret.map((baris) => ({
      kunci: kunciRekam(baris.tanggalSidang, baris.sidangId),
      ruangan: teks(baris.ruangan),
      jamPanggil: teks(antrianBaris(baris)?.jamPanggil),
    }));
    const sebelum = petaJarakAntarSidang(bahan);
    const berikut = petaJarakBerikutSidang(bahan);

    // Urutan di dalam ruang - keberapa perkara ini duduk di ruangnya menurut
    // jam panggil. Yang belum punya jam panggil tidak diberi urutan sama
    // sekali: menaruhnya di nomor terakhir berarti mengaku tahu urutan yang
    // belum ditentukan siapa pun.
    const urutan = new Map<string, number>();
    const perRuang = new Map<string, Array<{ kunci: string; jam: string }>>();
    for (const b of bahan) {
      if (!b.jamPanggil) continue;
      if (!perRuang.has(b.ruangan)) perRuang.set(b.ruangan, []);
      perRuang.get(b.ruangan)!.push({ kunci: b.kunci, jam: b.jamPanggil });
    }
    for (const isi of perRuang.values()) {
      isi.sort((a, b) => a.jam.localeCompare(b.jam));
      isi.forEach((x, i) => urutan.set(x.kunci, i + 1));
    }

    for (const baris of deret) {
      const kunci = kunciRekam(baris.tanggalSidang, baris.sidangId);
      const punya = antrianBaris(baris);
      hasil.push({
        id: kunci,
        tanggalSidang: teks(baris.tanggalSidang),
        sidangId: teks(baris.sidangId),
        perkaraId: teks(baris.perkaraId),
        nomorPerkara: teks(baris.nomorPerkara),
        ruangan: teks(baris.ruangan),
        nomorAntrian: typeof punya?.nomor === "number" ? punya.nomor : null,
        urutanRuang: urutan.get(kunci) ?? null,
        waktuAmbil: teks(punya?.waktuAmbil),
        jamPanggil: teks(punya?.jamPanggil),
        online: Boolean(punya?.online),
        keadaan: teks(punya?.keadaan),
        namaPetugas: teks(punya?.namaPetugas),
        jarakSebelumMenit: sebelum[kunci] ?? null,
        jarakBerikutMenit: berikut[kunci] ?? null,
      });
    }
  }
  return hasil;
}
