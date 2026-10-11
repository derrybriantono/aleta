/**
 * ============================================================================
 * MENCOCOKKAN PEGAWAI SIPP DENGAN AKUN ALETA LEWAT NAMA (11 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: "aleta belum bisa deteksi akun sipp nya di aleta, coba
 * kamu samakan atau cocokkan dengan nama di sipp". Dari 66 akun ALETA salinan
 * server 9 Okt, hanya 12 yang punya tautan SIPP di Manajemen Akun - sisanya
 * tidak pernah dikenali walau sudah masuk SIPP.
 *
 * Modul ini MURNI (tanpa basis data, tanpa jaringan): ia hanya menjawab "akun
 * ALETA mana yang namanya sama dengan pegawai SIPP ini", dengan jawaban
 * yakin / ganda / tidak-cocok. Dipakai pemutus masuk (masuk-sipp-nama.ts) dan
 * skrip ukur atas data nyata - satu salinan aturan.
 *
 * ============================================================================
 * NAMA BUKAN BUKTI IDENTITAS
 * ============================================================================
 *
 * Kecocokan nama di sini hanya MEMILIH akun ALETA. Siapa orangnya dibuktikan
 * lebih dulu di tempat lain: sesi SIPP yang cookie-nya diperiksa bot dengan
 * kunci SIPP (HMAC + sandi), atau password SIPP yang cocok dengan sidik
 * sys_users. Tanpa bukti itu, nama tidak pernah dipakai.
 *
 * ============================================================================
 * SAMA, BUKAN MIRIP
 * ============================================================================
 *
 * Yang dibandingkan adalah KUNCI nama: huruf kecil, tanpa gelar depan/belakang
 * (Drs., Dra., H., Hj., S.H., S.H.I., M.H., M.Ag., ...), tanpa tanda baca dan
 * spasi, dengan ejaan nama Arab dan ejaan lama dilipat ("Muh."/"Moh."/
 * "Mochammad" = Muhammad, "Sitti" = "Siti", "Achmad" = "Ahmad", "Abd." =
 * "Abdul", "oe" = "u", huruf kembar = tunggal). Dua kunci harus SAMA PERSIS -
 * bukan sebagian kata. "Idris" tidak cocok dengan "Muh. Idris". Kesalahan yang
 * dipilih adalah tidak mengenali (pegawai menautkan sendiri), bukan masuk ke
 * akun orang lain.
 *
 * NIP menguatkan dan membantah: NIP sama = cocok walau ejaan nama berbeda;
 * NIP keduanya ada tetapi berbeda = BUKAN orang yang sama walau namanya sama.
 */

/** Gelar/sebutan di DEPAN nama. Dibandingkan sesudah titik dibuang. */
export const GELAR_DEPAN = new Set([
  "dr", "dra", "drs", "hj", "h", "hc", "ir", "prof", "kh", "k", "ust", "ustadz", "ustaz", "ustadzah", "ustazah",
  "tgh", "tg", "ny", "nn", "sdr", "sdri", "bpk", "ibu", "hajjah", "haji",
]);

/** Gelar di BELAKANG nama yang kadang ditulis tanpa koma/titik. */
export const GELAR_BELAKANG = new Set([
  "sh", "shi", "mh", "mhi", "mag", "sag", "sy", "ssy", "lc", "ma", "mm", "se", "si", "amd", "sthi", "skom",
  "spd", "mpd", "ssos", "msi", "mkn", "llm", "phd", "sip", "mhum", "shum", "sth", "mth", "st", "mt", "sak",
  "mak", "ssi", "spdi", "mpdi", "sei", "mei", "ak", "cpa", "skm", "mkes", "ssit", "skep", "ners", "amdkep",
  "smb", "mba", "msc", "bsc", "mesy", "sesy", "mpsi", "spsi", "ssyi",
]);

/** Ejaan nama Arab yang lazim ditulis berbeda, dilipat ke satu bentuk. */
const LIPAT_KATA: Record<string, string> = {
  muh: "muhamad",
  moh: "muhamad",
  mohd: "muhamad",
  muhd: "muhamad",
  moch: "muhamad",
  mochd: "muhamad",
  mhd: "muhamad",
  abd: "abdul",
  abdl: "abdul",
  abdoel: "abdul",
  nurul: "nurul",
  noor: "nur",
  nuur: "nur",
};

/** Satu kata (huruf kecil, tanpa tanda baca) ke bentuk ejaan baku-nya. */
export function lipatEjaan(kata: string): string {
  let k = kata;
  if (LIPAT_KATA[k]) return LIPAT_KATA[k];
  k = k
    .replace(/oe/g, "u")
    .replace(/dj/g, "j")
    .replace(/tj/g, "c")
    .replace(/ch/g, "h")
    .replace(/ph/g, "f")
    .replace(/q/g, "k")
    .replace(/y$/g, "i")
    .replace(/([a-z])\1+/g, "$1");
  if (LIPAT_KATA[k]) return LIPAT_KATA[k];
  // Muhammad, Muhamad, Mohammad, Mohamed, Muhammed, Mochammad -> muhamad.
  if (/^m[ou]h?am[ae]d$/.test(k)) return "muhamad";
  if (/^ahm[ae]d$/.test(k)) return "ahmad";
  return k;
}

/**
 * Kata-kata inti nama: gelar dibuang, ejaan dilipat, urutan dipertahankan.
 *
 *   "Dra. Hj. Munifa, S.H.I., M.H."         -> ["munifa"]
 *   "FAHRI SAIFUDDIN, S.H.I., M.H."         -> ["fahri", "saifudin"]
 *   "Muh. Idris S.H."                       -> ["muhamad", "idris"]
 *   "Uji ALETA - Super Admin (lokal)"       -> ["uji", "aleta", "super", "admin"]
 */
export function kataIntiNama(nama: unknown): string[] {
  let teks = String(nama ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // keterangan dalam kurung bukan nama: "(lokal)", "(Plh)"
    .replace(/\([^)]*\)/g, " ")
    .replace(/[‘’‛`´']/g, "");
  // Gelar belakang ditulis sesudah koma pertama.
  teks = teks.split(",")[0];
  const hasil: string[] = [];
  for (const mentah of teks.split(/[\s\-_/]+/)) {
    if (!mentah) continue;
    const tanpaUjung = mentah.replace(/^\.+|\.+$/g, "");
    // Titik DI TENGAH kata = singkatan gelar (S.H.I, M.Ag, S.Kom).
    if (tanpaUjung.includes(".")) {
      const rapat = tanpaUjung.replace(/\./g, "");
      if (GELAR_BELAKANG.has(rapat) || GELAR_DEPAN.has(rapat)) continue;
      // Inisial bertitik ("H.I.M.") tetap disimpan sebagai satu kata rapat.
      if (/^[a-z]+$/.test(rapat)) hasil.push(rapat);
      continue;
    }
    const kata = tanpaUjung.replace(/[^a-z]/g, "");
    if (!kata) continue;
    if (GELAR_DEPAN.has(kata) && hasil.length === 0) continue;
    if (GELAR_BELAKANG.has(kata) && hasil.length > 0) continue;
    hasil.push(lipatEjaan(kata));
  }
  return hasil;
}

/** Kunci pembanding: kata inti dirapatkan ("Nur Hidayah" = "Nurhidayah"). */
export function kunciNama(nama: unknown): string {
  return kataIntiNama(nama).join("");
}

/** Kunci yang terlalu pendek tidak pernah dipakai mencocokkan ("Ali", "Ani"). */
export const PANJANG_KUNCI_MINIMUM = 4;

export function rapikanNip(nip: unknown): string {
  const angka = String(nip ?? "").replace(/\D/g, "");
  return angka.length >= 9 ? angka : "";
}

// ============================================================================
// PENCOCOKAN
// ============================================================================

export type PegawaiSipp = {
  sippUserId: string;
  username: string;
  /** sys_users.fullname - yang tertulis di kepala halaman SIPP. */
  namaLengkap: string;
  /** Nama & NIP pejabat tertaut (user_hakim / user_panitera / user_jurusita). */
  pejabat: Array<{ jabatan: string; nama: string; nip?: string }>;
};

export type AkunAletaCalon = {
  id: string;
  name: string;
  nip?: string | null;
  roleId: string;
  isActive: boolean;
};

export type CocokNama =
  | { jenis: "yakin"; userId: string; dasar: "nama" | "nip" | "nama+nip"; namaSipp: string; namaAleta: string }
  | { jenis: "ganda"; calon: string[] }
  | { jenis: "tidak-cocok" };

/** NIP akun ALETA: kolom nip, atau angka di belakang id "usr-<satker>-<NIP>". */
export function nipAkunAleta(akun: Pick<AkunAletaCalon, "id" | "nip">): string {
  const dariKolom = rapikanNip(akun.nip);
  if (dariKolom) return dariKolom;
  const cocok = /-(\d{18})$/.exec(String(akun.id ?? ""));
  return cocok ? cocok[1] : "";
}

/**
 * Akun ALETA aktif yang namanya (atau NIP-nya) sama dengan pegawai SIPP ini.
 *
 * - NIP sama        -> calon kuat, walau ejaan namanya berbeda.
 * - NIP berbeda     -> BUKAN calon, walau namanya sama.
 * - kunci nama sama -> calon (bila tidak dibantah NIP).
 *
 * Yakin hanya bila TUNGGAL. Bila lebih dari satu dan tepat satu di antaranya
 * cocok NIP, yang ber-NIP sama itulah orangnya. Selebihnya ganda.
 */
export function cocokkanPegawaiSipp(pegawai: PegawaiSipp, akunAleta: AkunAletaCalon[]): CocokNama {
  const namaSipp = [pegawai.namaLengkap, ...pegawai.pejabat.map((p) => p.nama)].filter((x) => String(x ?? "").trim());
  const kunciSipp = new Set(namaSipp.map(kunciNama).filter((k) => k.length >= PANJANG_KUNCI_MINIMUM));
  const nipSipp = new Set(pegawai.pejabat.map((p) => rapikanNip(p.nip)).filter(Boolean));

  type Calon = { akun: AkunAletaCalon; nama: boolean; nip: boolean; namaSipp: string };
  const calon: Calon[] = [];
  for (const akun of akunAleta) {
    if (!akun.isActive) continue;
    const nipAleta = nipAkunAleta(akun);
    const nipSama = Boolean(nipAleta) && nipSipp.has(nipAleta);
    const nipBeda = Boolean(nipAleta) && nipSipp.size > 0 && !nipSama;
    if (nipBeda) continue;
    const kunciAleta = kunciNama(akun.name);
    const namaSama = kunciAleta.length >= PANJANG_KUNCI_MINIMUM && kunciSipp.has(kunciAleta);
    if (!namaSama && !nipSama) continue;
    const sebut = namaSipp.find((n) => kunciNama(n) === kunciAleta) ?? namaSipp[0] ?? "";
    calon.push({ akun, nama: namaSama, nip: nipSama, namaSipp: sebut });
  }

  const pilih = (c: Calon): CocokNama => ({
    jenis: "yakin",
    userId: c.akun.id,
    dasar: c.nama && c.nip ? "nama+nip" : c.nip ? "nip" : "nama",
    namaSipp: c.namaSipp,
    namaAleta: c.akun.name,
  });

  if (calon.length === 0) return { jenis: "tidak-cocok" };
  if (calon.length === 1) return pilih(calon[0]);
  const berNip = calon.filter((c) => c.nip);
  if (berNip.length === 1) return pilih(berNip[0]);
  return { jenis: "ganda", calon: calon.map((c) => c.akun.id) };
}
