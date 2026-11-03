/**
 * ============================================================================
 * PUSTAKA ALETA ABT - ATURAN MURNI (3 Nov 2026, Tahap 1, migrasi 0133)
 * ============================================================================
 *
 * Blangko ABT by Derry Briantono disalin ke database ALETA sendiri. Berkas ini hanya ATURAN (tanpa basis data,
 * tanpa kripto) supaya dapat diuji dan dipakai layar:
 *
 *   kodeVariabel   kode ALETA ABT "AA" + 5 angka. Diberikan SEKALI saat variabel pertama kali terlihat, lalu
 *                  disimpan: sesudah itu tidak pernah diturunkan lagi dari nomor ABT. Bila nomor asalnya masih
 *                  bebas dipakai sebagai kode (AA01217 untuk #1217#) dipakai itu supaya mudah dibaca; bila sudah
 *                  terpakai, nomor bebas berikutnya mulai AA100000.
 *   rencanaSinkron sinkron SATU ARAH ABT -> ALETA ABT yang tidak pernah menimpa ubahan ALETA ABT.
 *   petaRujukan    #NNNN# asal -> kode ALETA ABT lewat peta server itu (nomor tanpa peta dibiarkan, dicatat).
 */

export const AWALAN_KODE = "AA";
const KODE_SAH = /^AA\d{5,6}$/;

export const nomorBaku = (no: unknown) => String(no ?? "").trim().replace(/^0+(?=\d{4})/, "").padStart(4, "0");

export function kodeSah(kode: unknown): boolean {
  return KODE_SAH.test(String(kode ?? ""));
}

/**
 * Kode untuk nomor-nomor yang BELUM punya peta di server ini. `terpakai` = semua kode yang sudah ada (dari server
 * mana pun). Urutan nomor menentukan pemberian sehingga hasilnya sama setiap dijalankan atas keadaan yang sama.
 */
export function berikanKode(nomorBaru: string[], terpakai: Iterable<string>): Map<string, string> {
  const pakai = new Set(terpakai);
  const hasil = new Map<string, string>();
  let berikut = 100000;
  for (const k of pakai) {
    const n = Number(String(k).slice(AWALAN_KODE.length));
    if (n >= berikut) berikut = n + 1;
  }
  const urut = [...new Set(nomorBaru.map(nomorBaku))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  for (const no of urut) {
    const cermin = `${AWALAN_KODE}${no.padStart(5, "0")}`;
    let kode = /^\d{1,5}$/.test(no) && !pakai.has(cermin) ? cermin : "";
    if (!kode) {
      while (pakai.has(`${AWALAN_KODE}${berikut}`)) berikut += 1;
      kode = `${AWALAN_KODE}${berikut}`;
      berikut += 1;
    }
    pakai.add(kode);
    hasil.set(no, kode);
  }
  return hasil;
}

export type KeadaanBaris = {
  kunci: string;
  /** Sidik isi ABT saat terakhir diambil (md5 berkas / sidik definisi). */
  sidikAsal: string;
  /** Sudah diubah di ALETA ABT (diubah = 1) - tidak boleh ditimpa ABT. */
  diubah: boolean;
  /** 'abt' = salinan dari ABT; 'aleta' = dibuat di ALETA ABT (tidak pernah ditimpa, tidak pernah ditandai hilang). */
  asal: "abt" | "aleta";
  status: "aktif" | "hilang";
  bentrokSidik: string;
};

export type ButirMasuk = { kunci: string; sidik: string };

export type HasilRencana = {
  baru: string[];
  /** Isi ABT berubah dan baris belum diubah di ALETA ABT: ikut diperbarui. */
  berubah: string[];
  /** Sempat hilang di ABT, kini ada lagi (diperbarui bila belum diubah di ALETA ABT). */
  kembali: string[];
  sama: string[];
  /** Baris yang sudah diubah di ALETA ABT sedangkan ABT berbeda: dibiarkan, sidik ABT dicatat. */
  bentrok: string[];
  /** Bentrok yang sidik ABT-nya baru (perlu ditulis); bagian dari `bentrok`. */
  bentrokBaru: string[];
  /** Tidak ada lagi di ABT: ditandai hilang, TIDAK dihapus. */
  hilang: string[];
};

/**
 * Rencana sinkron satu jenis baris. `ada` hanya baris yang memang berasal dari server ini (baris server lain tidak
 * pernah ditandai hilang oleh sinkron server ini). Tidak ada keluaran yang berarti "hapus" atau "timpa ubahan".
 */
export function rencanaSinkron(ada: KeadaanBaris[], masuk: ButirMasuk[]): HasilRencana {
  const hasil: HasilRencana = { baru: [], berubah: [], kembali: [], sama: [], bentrok: [], bentrokBaru: [], hilang: [] };
  const peta = new Map(ada.map((b) => [b.kunci, b]));
  const terlihat = new Set<string>();
  for (const m of masuk) {
    if (terlihat.has(m.kunci)) continue;
    terlihat.add(m.kunci);
    const b = peta.get(m.kunci);
    if (!b) {
      hasil.baru.push(m.kunci);
      continue;
    }
    const terkunci = b.diubah || b.asal === "aleta";
    if (m.sidik === b.sidikAsal && !terkunci) {
      (b.status === "hilang" ? hasil.kembali : hasil.sama).push(m.kunci);
      continue;
    }
    if (terkunci) {
      if (b.asal === "abt" && m.sidik === b.sidikAsal) {
        // ABT belum berubah sejak diambil; ubahan ALETA ABT tetap berlaku.
        (b.status === "hilang" ? hasil.kembali : hasil.sama).push(m.kunci);
        continue;
      }
      hasil.bentrok.push(m.kunci);
      if (b.bentrokSidik !== m.sidik) hasil.bentrokBaru.push(m.kunci);
      continue;
    }
    (b.status === "hilang" ? hasil.kembali : hasil.berubah).push(m.kunci);
  }
  for (const b of ada) {
    if (terlihat.has(b.kunci) || b.asal === "aleta" || b.status === "hilang") continue;
    hasil.hilang.push(b.kunci);
  }
  return hasil;
}

export type HitunganRencana = { baru: number; berubah: number; kembali: number; sama: number; bentrok: number; hilang: number };

export const hitungRencana = (r: HasilRencana): HitunganRencana => ({
  baru: r.baru.length,
  berubah: r.berubah.length,
  kembali: r.kembali.length,
  sama: r.sama.length,
  bentrok: r.bentrok.length,
  hilang: r.hilang.length,
});

/** Nomor ABT -> kode ALETA ABT lewat peta server itu. Nomor yang tidak terpeta dikembalikan terpisah. */
export function petaRujukan(nomor: string[], peta: Map<string, string>): { kode: string[]; takTerpeta: string[] } {
  const kode: string[] = [];
  const takTerpeta: string[] = [];
  for (const n of nomor) {
    const k = peta.get(nomorBaku(n));
    if (k) {
      if (!kode.includes(k)) kode.push(k);
    } else if (!takTerpeta.includes(nomorBaku(n))) takTerpeta.push(nomorBaku(n));
  }
  return { kode, takTerpeta };
}

// ---------------------------------------------------------------------------
// Bentuk data untuk layar
// ---------------------------------------------------------------------------

export type JumlahJenis = { aktif: number; hilang: number; bentrok: number; diubah: number };

export type RingkasanPustaka = {
  berkas: JumlahJenis & { arsip: number; ukuranByte: number };
  variabel: JumlahJenis & { blangko: number; turunan: number };
  menu: JumlahJenis;
  peta: { server: string; jumlah: number }[];
  terakhir: RiwayatSinkron | null;
  sedangJalan: boolean;
  riwayat: RiwayatSinkron[];
  bentrok: { jenis: "berkas" | "variabel" | "menu"; kunci: string; nama: string; pada: string }[];
};

export type RiwayatSinkron = {
  id: string;
  server: string;
  status: "jalan" | "berhasil" | "gagal";
  oleh: string;
  mulaiAt: string;
  selesaiAt: string;
  galat: string;
  ringkasan: {
    berkas?: HitunganRencana & { gagal?: number };
    variabel?: HitunganRencana;
    menu?: HitunganRencana;
    takDikenal?: number;
  };
};
