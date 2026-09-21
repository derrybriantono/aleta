/**
 * ============================================================================
 * PANGGILAN YANG DITERIMA PIHAK LAWAN
 * ============================================================================
 *
 * Panggilan sidang untuk TERGUGAT yang ternyata diterima orang bernama sama
 * dengan PENGGUGAT - dan sebaliknya - adalah keadaan yang layak dilihat hakim
 * sebelum ia menjatuhkan verstek: tergugatnya boleh jadi tidak pernah sungguh
 * tahu ada sidang, dan putusan di atas panggilan seperti itu rapuh.
 *
 * ============================================================================
 * SIPP TIDAK PUNYA KOLOM NAMA PENERIMA - DAN ITU MENENTUKAN SEGALANYA
 * ============================================================================
 *
 * Tabel perkara_pelaksanaan_relaas hanya tujuh belas kolom, dan tidak satu pun
 * bernama "penerima". Nama penerima hanya dapat muncul di dalam kalimat bebas
 * `ket_hasil_relaas`. Kolom itu SEHAT - terisi 13.580 dari 14.495 baris
 * (93,7%) - tetapi isinya sebagian besar SEBUTAN PERAN, bukan nama orang:
 * "panggilan sidang" 788 kali, "Panggilan Elektronik" 782, "Bertemu Penggugat"
 * dan seterusnya.
 *
 * Akibatnya terukur, dan harus dikatakan apa adanya. Dari 14.495 relaas
 * satker, 13.580 berketerangan; 11.150 di antaranya sungguh DAPAT DINILAI -
 * pihaknya terkenal dan lawannya punya potongan nama yang layak dibanding.
 * Penanda ini menyala pada 10 di antaranya: 0,09%. Ia BUKAN penanda yang
 * bekerja tiap hari.
 *
 * Nyalanya yang jarang justru pantas. Kesepuluhnya panggilan untuk TERGUGAT
 * yang diterima orang bernama sama dengan PENGGUGAT, dan delapan di antaranya
 * menyebut "serumah" - penggugat perceraian yang disebut tinggal serumah
 * dengan tergugat adalah pertentangan di dalam berkasnya sendiri. Empat
 * perkaranya bertanda putusan VERSTEK; tiga dari empat itu berakhir
 * dikabulkan, yang keempat dicabut. Peringatan yang menyala sepuluh kali dalam
 * sebelas ribu baris adalah peringatan yang layak dibaca tiap kali menyala,
 * bukan yang dipelajari orang untuk diabaikan.
 *
 * ============================================================================
 * AMBANG 0,85 - DIUKUR, BUKAN DIPILIH KARENA ANGKANYA BULAT
 * ============================================================================
 *
 * Sapuan ambang atas seluruh relaas satker, (relaas/perkara) yang menyala:
 *
 *     1,00 -> 9/8     0,95 -> 9/8     0,90 -> 9/8     0,85 -> 10/9
 *     0,80 -> 18/17   0,75 -> 33/28   0,70 -> 37/32   0,65 -> 50/40
 *
 * Ada JURANG KOSONG antara 0,833 dan 0,875, dan tidak ada satu pun nilai di
 * antaranya. Tangkapan benar yang paling rendah kemiripannya `alfianty` lawan
 * `alfianti` (0,875) - "nama yang agak mirip", persis keadaan yang diminta
 * ditangkap. Tangkapan SALAH yang paling tinggi 0,833 (`nadira` lawan
 * `hadira`). Ambang 0,85 duduk di tengah jurang itu.
 *
 * Di bawahnya tidak ada yang dibeli: pada 0,80 muncul delapan tangkapan baru,
 * dan kedelapannya orang lain - `nadira`/`hadira`, `ervina`/`ervin`,
 * `rahman`/`rahmat`, `andi`/`andri`, `andi`/`randi`, `retna`/`ratna`, dan
 * bahkan `anwar` pada kalimat "PAKET AKAN DIANTAR ULANG". Di atasnya tidak ada
 * yang dihemat: 0,90 dan 0,95 memberi hasil yang sama persis dengan 1,00.
 *
 * ============================================================================
 * YANG SENGAJA TIDAK DICOCOKKAN
 * ============================================================================
 *
 * NASAB - kata sesudah "bin" atau "binti", yaitu nama AYAH - dibuang seluruhnya.
 * Diukur: bila ikut dicocokkan, tangkapan naik dari 10 relaas / 9 perkara
 * menjadi 13 relaas / 11 perkara, dan ketiga tambahannya SALAH. Yang paling
 * terang perkara 148/Pdt.G/2025 - "diterima oleh bakri" menyala karena
 * lawannya bernama "Ria Artini Binti Bakri"; Bakri itu ayahnya, bukan dia.
 *
 * SEBUTAN PERAN - "penggugat", "tergugat", "pemohon" dan sejenisnya - tidak
 * pernah diperlakukan sebagai nama. Jurusita menulis peran jauh lebih sering
 * daripada nama, dan mencocokkannya akan menyalakan hampir seluruh berkas.
 *
 * GELAR dibuang: S.H., S.H.I., M.H., Drs., H., Hj. dan sejenisnya menempel
 * pada nama tanpa menjadi bagian dari orangnya.
 *
 * POTONGAN PENDEK - kurang dari empat huruf - dibuang. "Ali" akan menyala pada
 * "alias", dan "Ani" pada "bani".
 */

/** Gelar dan sebutan yang menempel pada nama tanpa menjadi bagian orangnya. */
const GELAR = new Set([
  "drs",
  "dr",
  "h",
  "hj",
  "sh",
  "shi",
  "mh",
  "ma",
  "mag",
  "spdi",
  "se",
  "st",
  "ir",
  "lc",
  "msi",
  "mkn",
]);

/** Sebutan peran - ditulis jurusita jauh lebih sering daripada nama. */
const SEBUTAN = new Set([
  "penggugat",
  "tergugat",
  "pemohon",
  "termohon",
  "pelawan",
  "terlawan",
  "pembanding",
  "terbanding",
  "pemberi",
  "penerima",
  "kuasa",
  "hukum",
  "anak",
  "istri",
  "suami",
  "ayah",
  "ibu",
  "orang",
  "tua",
  "saudara",
  "saudari",
  "tetangga",
  "ketua",
  "kepala",
  "desa",
  "kelurahan",
  "lurah",
  "rukun",
  "warga",
  "sidang",
  "panggilan",
  "relaas",
  "elektronik",
  "bertemu",
  "serumah",
  "alamat",
  "rumah",
]);

/** Membuang tag HTML dan entitas yang sungguh ada di kolom ini. */
export function bersihkanKeterangan(teks: string): string {
  return String(teks || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;?/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[^0-9a-zA-ZÀ-ɏ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Potongan inti sebuah nama pihak - alias dipecah, nasab dan gelar dibuang.
 *
 * Satu nama dapat memulangkan beberapa potongan: "Delvayana Haryadin alias
 * Delvayana binti Haryadin" memberi "delvayana" dan "haryadin" dari alias
 * pertama, tetapi TIDAK memberi "haryadin" dari alias kedua - di sana ia nama
 * ayah.
 */
export function potonganNama(nama: string): string[] {
  const hasil = new Set<string>();
  for (const bagian of String(nama || "").split(/\balias\b/i)) {
    // Nasab: semua yang datang sesudah bin/binti dibuang, sebab itu nama ayah.
    const tanpaNasab = bagian.split(/\b(?:bin|binti|bt|br)\b/i)[0];
    for (const kata of bersihkanKeterangan(tanpaNasab).split(" ")) {
      if (kata.length < 4) continue;
      if (GELAR.has(kata)) continue;
      if (SEBUTAN.has(kata)) continue;
      hasil.add(kata);
    }
  }
  return [...hasil];
}

/** Jarak sunting - dipakai menghitung kemiripan dua kata. */
function jarakSunting(a: string, b: string): number {
  if (a === b) return 0;
  const baris = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let sebelumnya = baris[0];
    baris[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const simpan = baris[j];
      baris[j] = Math.min(
        baris[j] + 1,
        baris[j - 1] + 1,
        sebelumnya + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      sebelumnya = simpan;
    }
  }
  return baris[b.length];
}

/** Kemiripan 0..1 - satu berarti sama persis. */
export function kemiripan(a: string, b: string): number {
  const panjang = Math.max(a.length, b.length);
  if (panjang === 0) return 1;
  return 1 - jarakSunting(a, b) / panjang;
}

export const AMBANG_MIRIP = 0.85;

export type PenerimaLawan = {
  /** Benar bila keterangan relaas memuat nama pihak di sisi LAWAN. */
  cocok: boolean;
  /** Nama pihak lawan yang cocok - untuk disebut pada judul gantungnya. */
  namaLawan: string;
  /** Kata pada keterangan relaas yang memicunya - supaya dapat diperiksa. */
  kataPemicu: string;
};

const KOSONG: PenerimaLawan = { cocok: false, namaLawan: "", kataPemicu: "" };

/**
 * Memeriksa satu baris relaas terhadap daftar pihak perkaranya.
 *
 * Tidak menyimpulkan apa pun tentang sah-tidaknya panggilan - yang dipulangkan
 * hanya bahwa NAMAnya cocok. Boleh jadi kebetulan senama, dan penanda yang
 * menyebut namanya saja tidak dapat disalahkan karena itu.
 */
export function cocokNamaPenerimaLawan(masukan: {
  pihakKe?: number | null;
  ketHasilRelaas?: string;
  pihak: Array<{ nama: string; pihakKe?: number | null }>;
}): PenerimaLawan {
  const ke = Number(masukan.pihakKe || 0);
  // Tanpa tahu relaas ini untuk pihak yang mana, tidak ada "lawan" yang dapat
  // dibandingkan - dan menebaknya berarti menyalakan penanda merah atas dasar
  // tebakan.
  if (ke !== 1 && ke !== 2) return KOSONG;

  const teks = bersihkanKeterangan(masukan.ketHasilRelaas || "");
  if (!teks) return KOSONG;

  const lawanKe = ke === 1 ? 2 : 1;
  const kataTeks = teks.split(" ").filter((x) => x.length >= 4);
  if (kataTeks.length === 0) return KOSONG;

  for (const pihak of masukan.pihak || []) {
    if (Number(pihak.pihakKe || 0) !== lawanKe) continue;
    for (const potongan of potonganNama(pihak.nama)) {
      for (const kata of kataTeks) {
        if (kemiripan(potongan, kata) >= AMBANG_MIRIP) {
          return { cocok: true, namaLawan: pihak.nama, kataPemicu: kata };
        }
      }
    }
  }
  return KOSONG;
}
