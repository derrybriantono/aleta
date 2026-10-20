/**
 * ============================================================================
 * SATU ORANG SATU ENTRI - PEMILIH "LIHAT SEBAGAI" BLANGKO DERRY
 * ============================================================================
 *
 * Nama hakim, panitera pengganti, dan juru sita yang dikirim SIPP ke jadwal
 * sidang berasal dari salinan nama PER PERKARA (perkara_hakim_pn.hakim_nama,
 * perkara_panitera_pn.panitera_nama, perkara_jurusita.jurusita_nama), bukan
 * dari tabel induk. Salinan itu ditulis tangan saat penunjukan, sehingga orang
 * yang sama tercatat dengan ejaan berbeda antar perkara. Terukur atas PA
 * Donggala (20 Okt 2026), tiap baris di bawah ini SATU orang:
 *
 *     "Derry Briantono"                       167 perkara
 *     "Derry Briantono, S.H."                1347 perkara
 *     "Himawan Tatura Wijaya"                 143
 *     "Himawan Tatura Wijaya, S.H.I., M.H."  1215
 *     "Himawan Tatura Wijaya, S.H.I.,M.H."    766
 *     "Himawan Tatura Wijaya. S.H.I.,M.H."    496   (titik, bukan koma)
 *     "Akbar  Ali, S.H.I."                    677   (dua spasi)
 *
 * Pemilih lama menyatukan menurut tulisan penuh, jadi satu orang muncul
 * sebanyak ejaannya. Di sini orang disatukan menurut KUNCI yang sama dengan
 * aturan pencocokan jadwal (potonganNamaPetugas): gelar dan pecahan gelar
 * dibuang, huruf kecil, urutan kata tidak berarti. Dua orang berbeda tetap
 * terpisah ("M. Tang" -> [tang] lawan "Sudarmin H.I.M. Tang" -> [sudarmin,
 * tang]) karena kunci diadu SAMA PERSIS, bukan saling memuat.
 *
 * Yang ditampilkan nama terlengkap (bergelar). Nilainya aman dipakai mencari
 * perkara lewat nama: namaAdaDi (perkara-sendiri) membuang gelar di kedua
 * sisi, jadi nama bergelar mencocoki semua ejaan orang itu.
 *
 * Berkas ini MURNI: tanpa jaringan, tanpa basis data.
 */
import { potonganNamaPetugas } from "@/lib/perkara-sendiri";

/** Gelar tiga huruf ke atas yang lolos penyaring potongan 1-2 huruf pada perkara-sendiri. */
const GELAR_TAMBAHAN = new Set(["kom", "spd", "mpd", "mkom", "sip", "mhum", "mkes", "skm", "apt", "ners"]);

/**
 * Kunci orang: bagian nama sebelum koma pertama (gelar belakang selalu sesudah koma, titik tanpa
 * koma pada "Wijaya. S.H.I." ikut terbuang sebagai pecahan 1-2 huruf), dipecah menjadi potongan
 * nama, diurutkan. "" bila tak ada potongan sama sekali.
 */
export function kunciOrang(nama: string): string {
  const depan = String(nama ?? "").split(",")[0];
  const potong = potonganNamaPetugas(depan).filter((k) => !GELAR_TAMBAHAN.has(k));
  if (potong.length) return [...new Set(potong)].sort().join(" ");
  // Nama pendek seluruhnya (mis. "Ab"): jangan jatuh ke kunci kosong yang menyatukan orang asing.
  return String(nama ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Spasi ganda dibuang dan koma diberi satu spasi sesudahnya. */
export function rapikanNama(nama: string): string {
  return String(nama ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+\./g, ".")
    .trim();
}

/** Nama tanpa gelar belakang (sebelum koma pertama), untuk label ringkas dan uji. */
export function namaTanpaGelar(nama: string): string {
  return rapikanNama(String(nama ?? "").split(",")[0]);
}

/** Jumlah huruf gelar (sesudah koma pertama) - lebih banyak = lebih lengkap. */
function hurufGelar(nama: string): number {
  const bagian = String(nama ?? "").split(",").slice(1).join(",");
  return bagian.replace(/[^A-Za-z]/g, "").length;
}

/** Mutu penulisan: "Wijaya. S.H.I." (titik menggantikan koma) kalah dari "Wijaya, S.H.I.". */
function cacatTulis(nama: string): number {
  let c = 0;
  if (/[A-Za-z]\.\s+[A-Z]\.[A-Z]/.test(nama)) c += 1;
  if (/,\S/.test(nama)) c += 1;
  if (/\s{2,}/.test(nama)) c += 1;
  return c;
}

/** Ejaan yang ditampilkan dari sekumpulan ejaan satu orang: gelar terlengkap, lalu tulisan paling rapi. */
export function namaTerbaik(varian: readonly string[]): string {
  const calon = [...new Set(varian.map((v) => String(v ?? "").trim()).filter(Boolean))];
  if (!calon.length) return "";
  calon.sort((a, b) => {
    const g = hurufGelar(b) - hurufGelar(a);
    if (g) return g;
    const c = cacatTulis(a) - cacatTulis(b);
    if (c) return c;
    return b.length - a.length || a.localeCompare(b, "id");
  });
  return rapikanNama(calon[0]);
}

export type OrangUnik = {
  /** kunciOrang - sama untuk semua ejaan. */
  kunci: string;
  /** Ejaan terlengkap (bergelar), dirapikan. */
  nama: string;
  /** Semua ejaan mentah yang ditemukan (tanpa kembar), untuk dicari lewat nama. */
  varian: string[];
};

/** Menyatukan daftar nama mentah menjadi satu entri per orang, terurut menurut nama. */
export function satukanOrang(nama: readonly string[]): OrangUnik[] {
  const peta = new Map<string, string[]>();
  for (const n of nama) {
    const mentah = String(n ?? "").trim();
    if (!mentah) continue;
    const k = kunciOrang(mentah);
    if (!k) continue;
    if (!peta.has(k)) peta.set(k, []);
    const l = peta.get(k)!;
    if (!l.includes(mentah)) l.push(mentah);
  }
  return [...peta.entries()]
    .map(([kunci, varian]) => ({ kunci, nama: namaTerbaik(varian), varian }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

/** Benar bila dua tulisan nama menunjuk orang yang sama (kunci sama persis). */
export function orangSama(a: string, b: string): boolean {
  const ka = kunciOrang(a);
  return ka !== "" && ka === kunciOrang(b);
}

/** Keadaan SIPP: hanya 'Y' yang aktif; kosong/tak dikenal dianggap aktif (tak ada bukti nonaktif). */
export function sippTidakAktif(aktif: unknown): boolean {
  const t = String(aktif ?? "").trim().toLowerCase();
  return t === "t" || t === "n" || t === "0" || t === "tidak" || t === "false";
}

export type PetugasMaster = { nama: string; aktif?: unknown };

/**
 * Kunci orang yang NONAKTIF menurut daftar induk: ada barisnya dan SEMUA barisnya (ejaan lain, id ganda
 * seperti "Munifa" tiga id) tidak aktif. Satu baris aktif saja membuat orang itu tetap tampil.
 */
export function kunciTidakAktif(master: readonly PetugasMaster[]): Set<string> {
  const ada = new Map<string, boolean>(); // kunci -> masih ada yang aktif
  for (const m of master) {
    const k = kunciOrang(String(m?.nama ?? ""));
    if (!k) continue;
    const aktif = !sippTidakAktif(m?.aktif);
    ada.set(k, (ada.get(k) ?? false) || aktif);
  }
  return new Set([...ada.entries()].filter(([, a]) => !a).map(([k]) => k));
}

export type AkunAleta = { name: string; isActive?: unknown; deletedAt?: unknown };

/**
 * Kunci orang yang akun ALETA-nya hanya yang nonaktif/terhapus. Orang dengan satu akun nonaktif dan
 * satu akun aktif (akun ganda bertitel dan tidak) tetap dianggap aktif.
 */
export function kunciAkunTidakAktif(akun: readonly AkunAleta[]): Set<string> {
  const ada = new Map<string, boolean>();
  for (const a of akun) {
    const k = kunciOrang(String(a?.name ?? ""));
    if (!k) continue;
    const hidup = Number(a?.isActive) !== 0 && a?.isActive !== false && (a?.deletedAt === null || a?.deletedAt === undefined || a?.deletedAt === "");
    ada.set(k, (ada.get(k) ?? false) || hidup);
  }
  return new Set([...ada.entries()].filter(([, h]) => !h).map(([k]) => k));
}

/** Membuang orang yang kuncinya ada di salah satu himpunan nonaktif. */
export function saringAktif(orang: readonly OrangUnik[], ...tidakAktif: ReadonlyArray<ReadonlySet<string> | undefined>): OrangUnik[] {
  return orang.filter((o) => !tidakAktif.some((s) => s && s.has(o.kunci)));
}
