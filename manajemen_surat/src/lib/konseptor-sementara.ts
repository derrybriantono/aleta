/**
 * ============================================================================
 * MENYANDINGKAN TUNJUKAN KONSEPTOR DENGAN NAMA DARI SIPP
 * ============================================================================
 *
 * Aturannya di @/lib dan bukan di @/server, sebab yang memakainya dua tempat
 * dengan sifat berbeda: rute peladen, dan layar yang berjalan di peramban.
 * Komponen klien yang mengimpor modul peladen ikut menyeret seluruh isi
 * modul itu ke dalam bundel peramban - termasuk kueri basis datanya.
 *
 * Bentuk tunjukannya juga di sini, supaya kedua sisi menyebut bentuk yang
 * sama dan tidak menyusunnya sendiri-sendiri.
 */

export type KonseptorSementara = {
  perkaraId: string;
  nomorPerkara: string;
  nama: string;
  pengguna: string;
  catatan: string;
  ditetapkanOleh: string;
  ditetapkanAt: string;
};

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/**
 * Menyandingkan tunjukan dengan nama yang SUNGGUH terbaca dari SIPP.
 *
 * ============================================================================
 * "BERBEDA" HANYA BOLEH DIKATAKAN KETIKA KEDUANYA ADA
 * ============================================================================
 *
 * Tiga keadaan yang tampak mirip dan berakibat berbeda:
 *
 *   SIPP belum punya nama   - tunjukan masih berlaku; tidak ada yang dibanding
 *   SIPP punya, sama        - tunjukan terbukti; tidak perlu dikatakan apa-apa
 *   SIPP punya, berbeda     - pekerjaannya berpindah tangan; ini yang ditandai
 *
 * Yang pertama sering disalahartikan sebagai yang ketiga oleh kode yang
 * membandingkan langsung: "" tidak sama dengan "Fulan", dan penanda merah pun
 * menyala pada hampir setiap perkara yang belum diunggah naskahnya.
 *
 * Perbandingannya atas NAMA yang dinormalkan, bukan atas username. Username
 * SIPP kerap tidak terbaca sama sekali - lihat `namaTerbaca` pada pembacaan
 * konseptor - sedangkan yang ditulis tangan di sini memang namanya.
 */
export function bandingkanKonseptor(
  sementara: { nama?: string; pengguna?: string } | null | undefined,
  sipp: Array<{ pengguna?: string; nama?: string }> | null | undefined
): { adaTunjukan: boolean; adaSipp: boolean; berbeda: boolean; namaSipp: string } {
  const namaTunjuk = bakukan(teks(sementara?.nama));
  const penggunaTunjuk = bakukan(teks(sementara?.pengguna));
  const daftar = (sipp ?? []).filter((x) => teks(x?.nama) || teks(x?.pengguna));

  const adaTunjukan = Boolean(namaTunjuk);
  const adaSipp = daftar.length > 0;
  if (!adaTunjukan || !adaSipp) {
    return { adaTunjukan, adaSipp, berbeda: false, namaSipp: teks(daftar[0]?.nama) };
  }

  // Cukup SALAH SATU nama SIPP yang cocok. Naskah yang disentuh beberapa orang
  // meninggalkan beberapa baris, dan menuntut yang pertama cocok akan menandai
  // "berbeda" pada perkara yang justru dikerjakan orang yang ditunjuk.
  const cocok = daftar.some((x) => {
    const n = bakukan(teks(x.nama));
    const p = bakukan(teks(x.pengguna));
    return (n && n === namaTunjuk) || (p && penggunaTunjuk && p === penggunaTunjuk);
  });

  return { adaTunjukan, adaSipp, berbeda: !cocok, namaSipp: teks(daftar[0]?.nama) };
}

/**
 * Membakukan nama untuk dibandingkan - gelar dibuang, huruf disamakan.
 *
 * "Drs. H. Fulan, S.H., M.H." dan "Fulan" adalah orang yang sama, dan penanda
 * yang menyatakan keduanya berbeda akan menyala pada hampir setiap perkara
 * yang ditunjuk dengan benar.
 *
 * ============================================================================
 * POTONGAN SATU HURUF DIBUANG, DAN ITU BUKAN KERAPIAN
 * ============================================================================
 *
 * Titik gelar dipecah menjadi spasi lebih dahulu, sehingga "S.H." menjadi
 * "s h" dan "M.H." menjadi "m h". Daftar gelar tidak akan pernah lengkap
 * menghadapi pecahan seperti itu - ia harus memuat tiap huruf tunggal yang
 * mungkin muncul, dan satu yang terlewat sudah cukup.
 *
 * Yang terlewat pertama kali justru "m" pada M.H.: "Drs. H. Fulan, S.H., M.H."
 * membaku menjadi "fulan m", tidak cocok dengan "fulan", dan penanda "berbeda
 * dari SIPP" menyala pada tunjukan yang sungguh benar.
 *
 * Membuang seluruh potongan satu huruf menutup lubang itu sekaligus. Yang
 * hilang bersamanya hanya inisial nama - dan inisial memang tidak membedakan
 * siapa pun.
 */
function bakukan(nama: string): string {
  return nama
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter((k) => k.length > 1 && !GELAR.has(k))
    .join(" ")
    .trim();
}

const GELAR = new Set([
  "drs",
  "dra",
  "dr",
  "h",
  "hj",
  "s",
  "sh",
  "shi",
  "si",
  "mh",
  "ma",
  "mag",
  "ag",
  "se",
  "st",
  "ir",
  "lc",
  "msi",
  "mkn",
  "spdi",
]);
