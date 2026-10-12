/**
 * ============================================================================
 * PANGGIL SAKSI DARI JADWAL SIDANG (12 Okt 2026, butir 4)
 * ============================================================================
 *
 * Permintaan pengguna: "tambahkan panggilan saksi persidangan di jadwal sidang
 * (dengan cara di klik nama saksinya, bisa dipilih saksi yang mana)".
 *
 * Mekanisme panggilnya TIDAK dibuat baru: pop-up membaca sasaran dari
 * /api/aleta-ecourt/panggil/sasaran (golongan saksi1/saksi2 = saksi yang
 * diajukan penggugat/pemohon dan tergugat/termohon) lalu memanggil satu per
 * satu lewat POST /api/aleta-ecourt/panggil - rute yang sama, hak yang sama
 * (sidang.antrian), riwayat dan jeda anti-ganda yang sama dengan memanggil
 * pihak. Berkas ini hanya aturan MURNI pemilihan saksinya.
 *
 * Yang dipilih satu, beberapa, atau semua saksi satu pihak; mengklik nama
 * memilih saksi itu lebih dulu.
 */

import type { StatusNomor } from "@/lib/panggil-petugas";

export type GolonganSaksi = "saksi1" | "saksi2";

/** Satu saksi pada daftar sasaran (nomor tersamar saja - tidak pernah utuh). */
export type SaksiSasaran = {
  kunci: string;
  nama: string;
  golongan: GolonganSaksi;
  peran: string;
  nomorTersamar: string;
  statusNomor: StatusNomor;
  keteranganNomor: string;
};

type OrangMentah = { kunci?: unknown; nama?: unknown; golongan?: unknown; peran?: unknown; nomorTersamar?: unknown; statusNomor?: unknown; keteranganNomor?: unknown };

/** Menyaring jawaban sasaran menjadi saksi saja, urutan dari bot dipertahankan. */
export function saksiDariSasaran(orang: ReadonlyArray<OrangMentah>): SaksiSasaran[] {
  const hasil: SaksiSasaran[] = [];
  for (const o of orang) {
    if (o.golongan !== "saksi1" && o.golongan !== "saksi2") continue;
    const kunci = String(o.kunci ?? "");
    const nama = String(o.nama ?? "");
    if (!kunci || !nama) continue;
    hasil.push({
      kunci,
      nama,
      golongan: o.golongan,
      peran: String(o.peran ?? "Saksi"),
      nomorTersamar: String(o.nomorTersamar ?? ""),
      statusNomor: (String(o.statusNomor ?? "tidak-ada") as StatusNomor),
      keteranganNomor: String(o.keteranganNomor ?? ""),
    });
  }
  return hasil;
}

function kunciNama(nama: string): string {
  return nama.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Saksi yang terpilih lebih dulu: yang namanya diklik. Nama di baris jadwal
 * dan nama di sasaran berasal dari kolom yang sama (perkara_pihak5.nama),
 * jadi pencocokannya lewat nama; bila ada dua saksi sebernama keduanya terpilih
 * pada sisi yang diklik saja (sisi dari baris, bukan tebakan).
 */
export function pilihanAwal(
  saksi: ReadonlyArray<SaksiSasaran>,
  namaKlik: string,
  golonganKlik: GolonganSaksi
): Set<string> {
  const k = kunciNama(namaKlik);
  const hasil = new Set<string>();
  if (!k) return hasil;
  for (const s of saksi) {
    if (s.golongan === golonganKlik && kunciNama(s.nama) === k) hasil.add(s.kunci);
  }
  return hasil;
}

/** Menambah atau mencabut satu saksi dari pilihan (mengembalikan himpunan baru). */
export function ubahPilihan(pilihan: ReadonlySet<string>, kunci: string): Set<string> {
  const baru = new Set(pilihan);
  if (baru.has(kunci)) baru.delete(kunci);
  else baru.add(kunci);
  return baru;
}

/** Semua saksi satu pihak sudah terpilih? */
export function semuaTerpilih(
  saksi: ReadonlyArray<SaksiSasaran>,
  pilihan: ReadonlySet<string>,
  golongan: GolonganSaksi
): boolean {
  const sisi = saksi.filter((s) => s.golongan === golongan);
  return sisi.length > 0 && sisi.every((s) => pilihan.has(s.kunci));
}

/**
 * "Pilih semua" satu pihak: bila semuanya sudah terpilih, justru dikosongkan
 * (tombol yang sama bolak-balik). Pilihan pihak lainnya tidak disentuh.
 */
export function pilihSemuaSatuPihak(
  saksi: ReadonlyArray<SaksiSasaran>,
  pilihan: ReadonlySet<string>,
  golongan: GolonganSaksi
): Set<string> {
  const baru = new Set(pilihan);
  const sisi = saksi.filter((s) => s.golongan === golongan);
  if (semuaTerpilih(saksi, pilihan, golongan)) {
    for (const s of sisi) baru.delete(s.kunci);
  } else {
    for (const s of sisi) baru.add(s.kunci);
  }
  return baru;
}

/** Saksi yang akan dipanggil, dalam urutan daftar (penggugat dulu, lalu tergugat). */
export function urutanPanggil(saksi: ReadonlyArray<SaksiSasaran>, pilihan: ReadonlySet<string>): SaksiSasaran[] {
  return saksi.filter((s) => pilihan.has(s.kunci));
}

export type HasilPanggilSaksi = { ok: boolean; hasil: string };

/** Ringkasan untuk satu kalimat di bawah tombol: "2 diantre, 1 perlu persetujuan, 1 gagal". */
export function ringkasHasilPanggil(hasil: ReadonlyArray<HasilPanggilSaksi>): string {
  const berhasil = hasil.filter((h) => h.ok).length;
  const persetujuan = hasil.filter((h) => h.hasil === "perlu_persetujuan").length;
  const gagal = hasil.length - berhasil - persetujuan;
  const bagian: string[] = [];
  if (berhasil > 0) bagian.push(`${berhasil} berhasil`);
  if (persetujuan > 0) bagian.push(`${persetujuan} menunggu persetujuan`);
  if (gagal > 0) bagian.push(`${gagal} tidak terkirim`);
  return bagian.join(", ");
}
