/**
 * ============================================================================
 * PENCARIAN PINTAR JADWAL SIDANG DAN JADWAL MEDIASI (JADWAL-3 butir 1, 19 Okt 2026)
 * ============================================================================
 *
 * Satu kotak yang mengenali KATA KUNCI keadaan ("ghaib", "konseptor",
 * "belum bas", "menunggu" ...) dan MEDAN ("hakim: ahmad", "saksi: wiwi"), lalu
 * menyaring baris yang SUDAH termuat. Sisa ketikan yang bukan kata kunci tetap
 * dicari di seluruh kolom seperti semula, dan Enter tetap mencari ke SIPP -
 * hanya sisa itulah yang dikirim, sebab "ghaib" bukan kata yang dikenal SIPP.
 *
 * Seluruh kata kunci dan medan digabung dengan "dan": tiap kata yang ditambah
 * mempersempit daftar. Berkas ini tidak tahu bentuk baris; predikat dan nilai
 * medan diberikan layar pemakainya, sehingga aturannya dapat diuji tanpa layar.
 */

export type KataKunciPintar = {
  kunci: string;
  /** Sebutan pada petunjuk dan lencana kata kunci yang dikenali. */
  label: string;
  /** Frasa yang dikenali (huruf kecil). Yang terpanjang dicocokkan lebih dahulu. */
  frasa: readonly string[];
};

export type MedanPintar = {
  kunci: string;
  label: string;
  /** Awalan yang dikenali sebelum titik dua, mis. "hakim" dalam "hakim: ahmad". */
  alias: readonly string[];
};

export type HasilUraiPintar = {
  /** Kata kunci yang dikenali, urut sesuai daftar. */
  kunci: string[];
  /** Isian medan, mis. { hakim: ["ahmad"] }. */
  medan: Record<string, string[]>;
  /** Ketikan yang tersisa - dicari di seluruh kolom, dan yang dikirim ke SIPP. */
  sisa: string;
};

export const KATA_KUNCI_SIDANG: readonly KataKunciPintar[] = [
  { kunci: "belum-konseptor", label: "belum ada konseptor", frasa: ["belum ada konseptor", "belum konseptor", "tanpa konseptor"] },
  { kunci: "konseptor-sementara", label: "konseptor sementara", frasa: ["konseptor sementara", "deteksi konseptor", "konseptor deteksi"] },
  { kunci: "konseptor", label: "konseptor", frasa: ["ada konseptor", "konseptor"] },
  { kunci: "ghaib", label: "ghaib", frasa: ["ghaib", "gaib", "mafqud"] },
  { kunci: "potensi-verstek", label: "potensi verstek", frasa: ["potensi verstek"] },
  { kunci: "verstek", label: "verstek", frasa: ["verstek"] },
  { kunci: "e-litigasi", label: "e-Litigasi", frasa: ["e-litigasi", "e litigasi", "elitigasi"] },
  { kunci: "sidang-pertama", label: "sidang pertama", frasa: ["sidang pertama"] },
  { kunci: "belum-bas", label: "belum BAS", frasa: ["belum ada bas", "belum bas", "tanpa bas"] },
  { kunci: "belum-tunda", label: "belum tunda", frasa: ["belum ditunda", "belum tunda"] },
  { kunci: "belum-minutasi", label: "belum minutasi", frasa: ["belum minutasi"] },
  { kunci: "hari-putusan", label: "hari putusan", frasa: ["hari putusan"] },
  { kunci: "ikrar-talak", label: "ikrar talak", frasa: ["ikrar talak", "ikrar"] },
  { kunci: "belum-putus", label: "belum putus", frasa: ["belum putus"] },
  { kunci: "sudah-putus", label: "sudah putus", frasa: ["sudah putus"] },
  { kunci: "ditunda", label: "ditunda", frasa: ["ditunda"] },
  { kunci: "kuasa", label: "ada kuasa", frasa: ["ada kuasa", "kuasa hukum", "berkuasa"] },
  { kunci: "prodeo", label: "prodeo", frasa: ["prodeo"] },
  { kunci: "belum-antri", label: "belum ambil antrian", frasa: ["belum ambil antrian", "belum antri", "belum antre"] },
  { kunci: "sedang", label: "sedang disidang", frasa: ["sedang disidang", "sedang sidang", "sedang berjalan", "berjalan"] },
  { kunci: "diskors", label: "diskors", frasa: ["diskors", "skors"] },
  { kunci: "menunggu", label: "menunggu", frasa: ["menunggu"] },
  { kunci: "selesai", label: "selesai", frasa: ["selesai"] },
  { kunci: "tidak-hadir", label: "tidak hadir", frasa: ["tidak hadir", "belum hadir"] },
  { kunci: "hadir", label: "hadir", frasa: ["sudah hadir", "hadir"] },
];

export const MEDAN_SIDANG: readonly MedanPintar[] = [
  { kunci: "nomor", label: "nomor", alias: ["nomor", "no"] },
  { kunci: "pihak", label: "pihak", alias: ["pihak", "penggugat", "tergugat", "pemohon", "termohon"] },
  { kunci: "kuasa", label: "kuasa", alias: ["kuasa"] },
  { kunci: "saksi", label: "saksi", alias: ["saksi"] },
  { kunci: "hakim", label: "hakim", alias: ["hakim", "majelis", "ketua"] },
  { kunci: "pp", label: "PP", alias: ["pp", "panitera"] },
  { kunci: "js", label: "JS", alias: ["js", "jurusita", "juru sita"] },
  { kunci: "mediator", label: "mediator", alias: ["mediator"] },
  { kunci: "konseptor", label: "konseptor", alias: ["konseptor"] },
  { kunci: "jenis", label: "jenis", alias: ["jenis"] },
  { kunci: "agenda", label: "agenda", alias: ["agenda"] },
  { kunci: "ruang", label: "ruang", alias: ["ruang", "ruangan"] },
];

export const KATA_KUNCI_MEDIASI: readonly KataKunciPintar[] = [
  { kunci: "lewat-tenggang", label: "lewat tenggang", frasa: ["lewat tenggang", "lewat batas", "terlambat"] },
  { kunci: "belum-mediator", label: "belum ada mediator", frasa: ["belum ada mediator", "belum mediator", "tanpa mediator"] },
  { kunci: "mediator-hakim", label: "mediator hakim", frasa: ["mediator hakim"] },
  { kunci: "mediator-non-hakim", label: "mediator non hakim", frasa: ["mediator non hakim", "mediator non-hakim", "non hakim"] },
  { kunci: "belum-laporan", label: "belum ada laporan", frasa: ["belum ada laporan", "belum laporan", "belum ada hasil", "belum hasil"] },
  { kunci: "tidak-berhasil", label: "tidak berhasil", frasa: ["tidak berhasil", "gagal"] },
  { kunci: "berhasil", label: "berhasil", frasa: ["berhasil"] },
  { kunci: "ditunda", label: "ditunda", frasa: ["ditunda"] },
  { kunci: "sedang", label: "sedang berjalan", frasa: ["sedang berjalan", "sedang mediasi", "berjalan"] },
  { kunci: "selesai", label: "selesai", frasa: ["selesai"] },
];

export const MEDAN_MEDIASI: readonly MedanPintar[] = [
  { kunci: "nomor", label: "nomor", alias: ["nomor", "no"] },
  { kunci: "pihak", label: "pihak", alias: ["pihak", "penggugat", "tergugat", "pemohon", "termohon"] },
  { kunci: "mediator", label: "mediator", alias: ["mediator"] },
  { kunci: "jenis", label: "jenis", alias: ["jenis"] },
  { kunci: "tempat", label: "tempat", alias: ["tempat", "ruang"] },
  { kunci: "hasil", label: "hasil", alias: ["hasil"] },
];

function rapi(teks: string): string {
  return String(teks ?? "").replace(/\s+/g, " ").trim();
}

function lolos(teks: string): string {
  return teks.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Batas kata: awal/akhir teks, spasi, atau tanda baca - "ghaib," dan "(ghaib)" tetap dikenali. */
function polaFrasa(frasa: string): RegExp {
  return new RegExp(`(^|[\\s,;()])${lolos(frasa).replace(/ /g, "\\s+")}(?=$|[\\s,;()])`, "i");
}

/**
 * Mengurai satu ketikan menjadi kata kunci, medan, dan sisa.
 *
 * Medan dikenali lebih dahulu ("saksi: wiwi" bukan kata kunci), nilainya
 * berjalan sampai medan berikutnya atau akhir ketikan. Sesudah itu kata kunci
 * dicari di sisanya, frasa terpanjang lebih dahulu - "belum ditunda" tidak
 * terbaca sebagai "ditunda".
 */
export function uraiCariPintar(
  teks: string,
  kataKunci: readonly KataKunciPintar[],
  medan: readonly MedanPintar[]
): HasilUraiPintar {
  let sisa = ` ${String(teks ?? "")} `;
  const hasilMedan: Record<string, string[]> = {};

  // --- medan "alias: nilai" ---
  const aliasKe = new Map<string, string>();
  for (const m of medan) for (const a of m.alias) aliasKe.set(a.toLowerCase(), m.kunci);
  const daftarAlias = Array.from(aliasKe.keys()).sort((a, b) => b.length - a.length).map(lolos);
  if (daftarAlias.length > 0) {
    const pola = new RegExp(`(^|\\s)(${daftarAlias.join("|").replace(/ /g, "\\s+")})\\s*:`, "gi");
    const temuan: Array<{ mulai: number; isiMulai: number; kunci: string }> = [];
    for (const t of sisa.matchAll(pola)) {
      const alias = t[2].toLowerCase().replace(/\s+/g, " ");
      const kunci = aliasKe.get(alias);
      if (!kunci || t.index === undefined) continue;
      temuan.push({ mulai: t.index + t[1].length, isiMulai: t.index + t[0].length, kunci });
    }
    if (temuan.length > 0) {
      const potong: string[] = [sisa.slice(0, temuan[0].mulai)];
      temuan.forEach((t, i) => {
        const akhir = i + 1 < temuan.length ? temuan[i + 1].mulai : sisa.length;
        const nilai = rapi(sisa.slice(t.isiMulai, akhir)).toLowerCase();
        if (nilai) (hasilMedan[t.kunci] ??= []).push(nilai);
      });
      sisa = ` ${potong.join(" ")} `;
    }
  }

  // --- kata kunci ---
  const semuaFrasa = kataKunci
    .flatMap((k) => k.frasa.map((f) => ({ kunci: k.kunci, frasa: f.toLowerCase() })))
    .sort((a, b) => b.frasa.length - a.frasa.length);
  const dikenali = new Set<string>();
  for (const { kunci, frasa } of semuaFrasa) {
    const pola = polaFrasa(frasa);
    while (pola.test(sisa)) {
      dikenali.add(kunci);
      sisa = sisa.replace(pola, "$1 ");
    }
  }

  return {
    kunci: kataKunci.filter((k) => dikenali.has(k.kunci)).map((k) => k.kunci),
    medan: hasilMedan,
    sisa: rapi(sisa),
  };
}

export function uraianKosong(urai: HasilUraiPintar): boolean {
  return urai.kunci.length === 0 && Object.keys(urai.medan).length === 0 && !urai.sisa;
}

function memuat(sumber: unknown, dicari: string): boolean {
  const kata = rapi(dicari).toLowerCase();
  if (!kata) return true;
  return String(sumber ?? "").toLowerCase().includes(kata);
}

/**
 * Menyaring satu baris. Kata kunci yang predikatnya tidak disediakan layar
 * diabaikan (tidak menyaring) - lebih baik daftar yang terlalu luas daripada
 * daftar kosong tanpa sebab.
 */
export function cocokCariPintar<T>(
  baris: T,
  urai: HasilUraiPintar,
  opsi: {
    predikat: Readonly<Record<string, (baris: T) => boolean>>;
    nilaiMedan: Readonly<Record<string, (baris: T) => string>>;
    teksBebas: (baris: T) => string;
  }
): boolean {
  for (const kunci of urai.kunci) {
    const p = opsi.predikat[kunci];
    if (p && !p(baris)) return false;
  }
  for (const [kunci, nilai] of Object.entries(urai.medan)) {
    const ambil = opsi.nilaiMedan[kunci];
    if (!ambil) continue;
    const sumber = ambil(baris);
    if (!nilai.every((n) => memuat(sumber, n))) return false;
  }
  if (urai.sisa) {
    // Tiap kata bebas harus ada di salah satu kolom - "ahmad cerai" menemukan
    // perkara cerai milik Ahmad walau kedua kata berada di kolom berbeda.
    const semua = opsi.teksBebas(baris).toLowerCase();
    for (const kata of urai.sisa.toLowerCase().split(" ")) {
      if (kata && !semua.includes(kata)) return false;
    }
  }
  return true;
}

/** Contoh singkat untuk petunjuk di bawah kotak cari. */
export const CONTOH_MEDAN_SIDANG = ["hakim: nama", "pp: nama", "js: nama", "mediator: nama", "saksi: nama", "kuasa: nama", "ruang: 1"];
export const CONTOH_MEDAN_MEDIASI = ["mediator: nama", "pihak: nama", "tempat: ruang", "hasil: berhasil"];
