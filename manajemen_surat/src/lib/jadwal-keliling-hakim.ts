/**
 * ============================================================================
 * JADWAL SIDANG: SIDANG KELILING PER HARI & SATU HAKIM PER PERKARA (22 Okt 2026)
 * ============================================================================
 *
 * Permintaan hakim 22 Okt 2026. Fungsi murni (tanpa React, tanpa basis data)
 * supaya layar, cetak, dan uji memakai SATU aturan:
 *
 *   1. luarGedung / mayoritasLuarGedung - dasar pop-up "Aktifkan Sidang
 *      keliling?" (bawaannya mati). Yang dihitung: bendera SIPP
 *      perkara_jadwal_sidang.sidang_keliling = 'Y' (bot 22 Okt ke atas), atau
 *      nama ruang yang menyebut keliling / terpadu / luar gedung. Nama yang
 *      tidak dikenali dihitung DALAM gedung - lebih baik pop-up tidak muncul
 *      daripada mengganggu tiap hari karena ruang bernama "1".
 *   2. perluTawarKeliling - pop-up hanya bila: satu tanggal, belum pernah
 *      diputuskan untuk tanggal itu (tidak ada baris), mayoritas di luar
 *      gedung, pengguna berhak, dan belum ditawarkan kepada pengguna ini untuk
 *      tanggal itu.
 *   3. calonHakim - SEMUA hakim aktif satker; hakim majelis perkara itu di
 *      atas sebagai saran (tambahan pengguna 22 Okt: boleh hakim di luar
 *      majelis). Yang tidak aktif/mutasi sudah disaring server.
 *   4. majelisTampil - nama majelis diganti nama hakim yang menyidangkan;
 *      KODE majelis tetap.
 *   5. kelompokPerHakim - bahan cetak terpisah per hakim.
 *   6. daftarPanitera / perkaraPanitera - bahan menu per panitera sidang.
 */

import { kunciOrang } from "@/lib/orang-unik";

export type HakimCalon = { id: number; kode: string; nama: string };

export type PilihanHakimSidang = {
  perkaraId: string;
  hakimId: string;
  hakimNama: string;
  hakimKode: string;
  anggotaMajelis: boolean;
  konseptorDiisi?: boolean;
  dipilihNama?: string;
  waktu?: string;
};

export type BarisJadwalMin = {
  sidangId: string;
  perkaraId: string;
  nomorPerkara: string;
  tanggalSidang: string;
  jamSidang?: string;
  ruangan?: string;
  agenda?: string;
  /** Bendera SIPP sidang_keliling = 'Y' (bot 22 Okt 2026 ke atas). */
  sidangKeliling?: boolean;
  majelisKode: string;
  majelisNama: string;
  paniteraNama: string;
};

/** Jam tunda otomatis pada hari Sidang keliling (dibaca tunda otomatis). */
export const JAM_TUNDA_OTOMATIS_KELILING = "14:00";

const POLA_LUAR_GEDUNG = /keliling|terpadu|luar\s*gedung|di\s*luar\s+gedung|diluar/i;

/** Sidang ini digelar di luar ruang sidang gedung pengadilan. */
export function luarGedung(baris: Pick<BarisJadwalMin, "ruangan" | "sidangKeliling">): boolean {
  if (baris.sidangKeliling === true) return true;
  return POLA_LUAR_GEDUNG.test(String(baris.ruangan ?? ""));
}

/** Lebih dari separuh perkara hari itu di luar gedung. Kosong = tidak. */
export function mayoritasLuarGedung(daftar: ReadonlyArray<Pick<BarisJadwalMin, "ruangan" | "sidangKeliling">>): {
  mayoritas: boolean;
  luar: number;
  jumlah: number;
} {
  const jumlah = daftar.length;
  const luar = daftar.filter(luarGedung).length;
  return { mayoritas: jumlah > 0 && luar * 2 > jumlah, luar, jumlah };
}

/** Kunci penyimpanan peramban: pop-up sekali per tanggal per pengguna. */
export function kunciTawarKeliling(penggunaId: string, tanggal: string): string {
  return `aleta:tawar-keliling:${penggunaId || "anonim"}:${tanggal}`;
}

export function perluTawarKeliling(opsi: {
  satuTanggal: boolean;
  /** Ada baris di aleta_sidang_keliling_hari untuk tanggal itu (sudah diputuskan, nyala atau mati). */
  sudahDiputuskan: boolean;
  bolehUbah: boolean;
  sudahDitawarkan: boolean;
  daftar: ReadonlyArray<Pick<BarisJadwalMin, "ruangan" | "sidangKeliling">>;
}): boolean {
  if (!opsi.satuTanggal || opsi.sudahDiputuskan || !opsi.bolehUbah || opsi.sudahDitawarkan) return false;
  return mayoritasLuarGedung(opsi.daftar).mayoritas;
}

function kataNama(teks: string): Set<string> {
  return new Set(
    String(teks || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((k) => k.length > 1)
  );
}

/**
 * Hakim ini anggota majelis perkara itu. majelisNama dari bot berupa nama yang
 * disambung ", " - dan gelar pun memakai koma, jadi tidak dapat dipecah. Yang
 * dicocokkan: semua kata nama inti hakim (kunciOrang, tanpa gelar) ada di
 * teks majelis.
 */
export function anggotaMajelis(majelisNama: string, hakimNama: string): boolean {
  const inti = kunciOrang(hakimNama).split(" ").filter(Boolean);
  if (inti.length === 0) return false;
  const kata = kataNama(majelisNama);
  return inti.every((k) => kata.has(k));
}

/** Semua hakim aktif; anggota majelis perkara-perkara itu lebih dulu (saran). */
export function calonHakim(
  majelisNama: string | readonly string[],
  daftar: readonly HakimCalon[]
): Array<HakimCalon & { saran: boolean }> {
  const majelis = Array.isArray(majelisNama) ? majelisNama : [majelisNama as string];
  const nilai = (h: HakimCalon) => majelis.filter((m) => anggotaMajelis(m, h.nama)).length;
  return daftar
    .filter((h) => String(h.nama || "").trim())
    .map((h) => ({ ...h, saran: nilai(h) > 0, n: nilai(h) }))
    .sort((a, b) => b.n - a.n || a.nama.localeCompare(b.nama, "id"))
    .map(({ n: _n, ...h }) => h);
}

/** Yang tampil di kolom majelis: kode TETAP, nama diganti hakim yang menyidangkan. */
export function majelisTampil(
  baris: Pick<BarisJadwalMin, "majelisKode" | "majelisNama" | "perkaraId">,
  pilihan: Readonly<Record<string, PilihanHakimSidang>>
): { kode: string; nama: string; diganti: boolean; asli: string } {
  const p = pilihan[String(baris.perkaraId)];
  if (!p || !p.hakimNama) return { kode: baris.majelisKode, nama: baris.majelisNama, diganti: false, asli: baris.majelisNama };
  return { kode: baris.majelisKode, nama: p.hakimNama, diganti: true, asli: baris.majelisNama };
}

export type BagianCetakHakim<T> = { hakim: string; baris: T[] };

/**
 * Bagian cetak per hakim. Perkara tanpa pilihan dikumpulkan di bagian
 * "Majelis (belum dipilih satu hakim)" di akhir. Urutan baris di tiap bagian
 * mengikuti urutan daftar yang sedang tampil.
 */
export function kelompokPerHakim<T extends Pick<BarisJadwalMin, "perkaraId">>(
  daftar: readonly T[],
  pilihan: Readonly<Record<string, PilihanHakimSidang>>
): Array<BagianCetakHakim<T>> {
  const peta = new Map<string, T[]>();
  const tanpa: T[] = [];
  for (const b of daftar) {
    const p = pilihan[String(b.perkaraId)];
    if (!p || !p.hakimNama) {
      tanpa.push(b);
      continue;
    }
    if (!peta.has(p.hakimNama)) peta.set(p.hakimNama, []);
    peta.get(p.hakimNama)!.push(b);
  }
  const hasil = [...peta.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "id"))
    .map(([hakim, baris]) => ({ hakim, baris }));
  if (tanpa.length) hasil.push({ hakim: "", baris: tanpa });
  return hasil;
}

/** Cetak per hakim ditawarkan bila ada pilihan hakim pada perkara yang tampil. */
export function adaPilihanHakim(
  daftar: ReadonlyArray<Pick<BarisJadwalMin, "perkaraId">>,
  pilihan: Readonly<Record<string, PilihanHakimSidang>>
): boolean {
  return daftar.some((b) => Boolean(pilihan[String(b.perkaraId)]?.hakimNama));
}

/** Panitera sidang hari itu beserta jumlah perkaranya, urut nama. */
export function daftarPanitera(daftar: ReadonlyArray<Pick<BarisJadwalMin, "paniteraNama">>): Array<{ nama: string; jumlah: number }> {
  const hitung = new Map<string, number>();
  for (const b of daftar) {
    const n = String(b.paniteraNama || "").trim();
    if (!n) continue;
    hitung.set(n, (hitung.get(n) ?? 0) + 1);
  }
  return [...hitung.entries()].map(([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

/** Perkara satu panitera sidang (tanpa panitera = ""), urutan daftar tetap. */
export function perkaraPanitera<T extends Pick<BarisJadwalMin, "paniteraNama">>(daftar: readonly T[], nama: string): T[] {
  const sasaran = String(nama || "").trim();
  return daftar.filter((b) => String(b.paniteraNama || "").trim() === sasaran);
}
