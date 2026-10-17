/**
 * ============================================================================
 * PENGATURAN SIPP & ABT - ATURAN MURNI (dipakai layar dan rute)
 * ============================================================================
 *
 * 16 Oktober 2026 (Tahap H). Halaman admin "Pengaturan SIPP & ABT" mengubah
 * hak menu folder Blangko Derry di ABT, saklar kebijakan yang diturunkan dari
 * hak itu, variabel ABT yang dipakai blangko Derry, dan blangko tanya jawab.
 * Berkas ini memuat yang tidak butuh jaringan: siapa boleh apa, pemeriksa kueri
 * (cermin pagarBaca mesin variabel bot - yang memutus tetap bot), pemeriksa
 * huruf latin1, beda sebelum-sesudah dalam bahasa sehari-hari, dan saklar.
 *
 * Keputusan pengguna 15 Okt 2026: hakim TIDAK melihat menu BAS secara bawaan,
 * pengaturannya ada di menu admin "Pengaturan SIPP & ABT". Saklar di sini
 * tidak punya nilai bawaan sendiri: keadaannya DIBACA dari hak menu ABT saat
 * ini, dan baru berubah bila admin menekan Simpan.
 */

import type { RoleId } from "@/lib/types";

// ---------------------------------------------------------------------------
// Hak
// ---------------------------------------------------------------------------

export type HakPengaturanAbt = {
  lihat: boolean;
  /** Hak menu ABT dan saklar kebijakan - memberi wewenang, jadi Super Admin saja. */
  ubahMenu: boolean;
  /** Kueri variabel (bagian lanjutan) - Super Admin saja. */
  ubahKueri: boolean;
  /** Isian bawaan variabel. */
  ubahBawaan: boolean;
  ubahTemplat: boolean;
};

export function hakPengaturanAbt(roleId: RoleId | string | null | undefined): HakPengaturanAbt {
  const r = String(roleId ?? "");
  const superAdmin = r === "super-admin";
  const admin = superAdmin || r === "admin";
  return { lihat: admin, ubahMenu: superAdmin, ubahKueri: superAdmin, ubahBawaan: admin, ubahTemplat: admin };
}

// ---------------------------------------------------------------------------
// Pemeriksa teks
// ---------------------------------------------------------------------------

const CP1252_TAMBAHAN = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/** Huruf yang akan menjadi "?" di kolom latin1 ABT (paling banyak lima). */
export function hurufDiluarLatin1(teks: string): string[] {
  const hasil: string[] = [];
  for (const h of String(teks ?? "")) {
    const k = h.codePointAt(0) ?? 0;
    const aman = k === 9 || k === 10 || k === 13 || (k >= 32 && k <= 126) || (k >= 0xa0 && k <= 0xff) || CP1252_TAMBAHAN.has(h);
    if (!aman && !hasil.includes(h)) hasil.push(h);
    if (hasil.length >= 5) break;
  }
  return hasil;
}

/** Cermin KATA_TERLARANG aleta_bot/services/abtMesinVariabel.js. */
const KATA_TERLARANG =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|replace\s+into|replace\s+delayed|replace\s+low_priority|rename|call|handler|lock\s+tables|unlock|load_file|load\s+data|into\s+outfile|into\s+dumpfile|sleep|benchmark|get_lock|release_lock|exec|execute|prepare|deallocate|for\s+update|lock\s+in\s+share\s+mode)\b/i;

/**
 * Kutipan dan komentar dibuang dalam SATU sapuan menurut posisinya (audit 17
 * Okt): bila kutipan dibuang lebih dulu, tanda kutip di dalam komentar
 * "menelan" kode di antaranya (`/* ' *\/, LOAD_FILE(..) /* ' *\/`). Komentar
 * `/*! ... *\/` dan `/*M! ... *\/` DIJALANKAN MySQL/MariaDB - ditandai, bukan dibuang.
 * `#` membuka komentar di mana pun; `--` hanya bila diikuti spasi (1--1 aritmetika).
 */
const POLA_SAPU = /'(?:[^'\\]|\\.|'')*'|"(?:[^"\\]|\\.|"")*"|`(?:[^`]|``)*`|\/\*[\s\S]*?(?:\*\/|$)|--(?=\s|$)[^\n]*|#[^\n]*/g;
function kerangkaKueri(sql: string): { kerangka: string; berpelaksana: boolean } {
  let berpelaksana = false;
  const kerangka = sql.replace(POLA_SAPU, (m) => {
    if (m.startsWith("'") || m.startsWith('"')) return "''";
    if (m.startsWith("`")) return "`x`";
    if (/^\/\*M?!/i.test(m)) berpelaksana = true;
    return " ";
  });
  return { kerangka, berpelaksana };
}

export const PANJANG_KUERI_MAKS = 20000;

/**
 * Kueri variabel boleh disimpan? Pulang sebab (bahasa sehari-hari) atau "".
 * Hanya satu SELECT; kata yang menulis/mengunci/menunda ditolak (REPLACE()
 * fungsi teks tetap boleh, REPLACE INTO tidak); titik koma ganda atau di
 * tengah ditolak. Penanda #NNNN# / #perkara_id# diganti 0 dulu.
 */
export function periksaKueriVariabel(sql: string): string {
  const teks = String(sql ?? "").trim();
  if (!teks) return "Kueri kosong.";
  if (teks.length > PANJANG_KUERI_MAKS) return `Kueri terlalu panjang (lebih dari ${PANJANG_KUERI_MAKS} huruf).`;
  const luar = hurufDiluarLatin1(teks);
  if (luar.length) return `Kueri memuat huruf yang tidak dapat disimpan ABT: ${luar.join(" ")}`;
  const siap = teks.replace(/#perkara_id#/g, "0").replace(/#\d{1,6}#/g, "0");
  const sapu = kerangkaKueri(siap);
  if (sapu.berpelaksana) return "Kueri memuat komentar /*! ... */ yang dijalankan MySQL - hapus komentar itu.";
  const kerangka = sapu.kerangka.trim();
  if (/;\s*;/.test(kerangka)) return "Kueri memuat titik koma ganda.";
  const tanpaAkhir = kerangka.replace(/;\s*$/, "");
  if (tanpaAkhir.includes(";")) return "Kueri memuat lebih dari satu perintah (titik koma di tengah).";
  if (!/^\(*\s*select\b/i.test(tanpaAkhir)) return "Kueri harus diawali SELECT (hanya membaca data).";
  const t = tanpaAkhir.match(KATA_TERLARANG);
  if (t) return `Kueri hanya boleh membaca data - memuat kata terlarang "${t[0]}".`;
  return "";
}

// ---------------------------------------------------------------------------
// Hak menu ABT
// ---------------------------------------------------------------------------

export type FolderMenuAbt = {
  id: number;
  nama: string;
  namaAlias: string;
  direktori: string;
  user_grup_id: string | null;
  user_top_id: string | null;
  user_validator: string | null;
  user_cek: number;
  proses_id_min: number;
  proses_id_max: number;
  perkara_id_min: number | null;
  perkara_id_max: number | null;
  perkara_id_referensi: string | null;
  diubah?: string;
};

export type RujukanSipp = { id: number; nama: string };

export type DataMenuAbt = {
  grup: { id: string | number; nama: string; direktori: string } | null;
  folder: FolderMenuAbt[];
  peran: RujukanSipp[];
  proses: RujukanSipp[];
  jenis: RujukanSipp[];
  alur: RujukanSipp[];
  config: Record<string, string>;
};

export const KOLOM_MENU = [
  "user_grup_id",
  "user_top_id",
  "user_validator",
  "user_cek",
  "proses_id_min",
  "proses_id_max",
  "perkara_id_min",
  "perkara_id_max",
  "perkara_id_referensi",
] as const;
export type KolomMenu = (typeof KOLOM_MENU)[number];

export const LABEL_KOLOM_MENU: Record<KolomMenu, string> = {
  user_grup_id: "Peran yang melihat folder",
  user_top_id: "Peran yang selalu boleh (tanpa cek tahapan)",
  user_validator: "Peran pemeriksa BAS",
  user_cek: "Cek penunjukan di perkara",
  proses_id_min: "Tahapan perkara paling awal",
  proses_id_max: "Tahapan perkara paling akhir",
  perkara_id_min: "Jenis perkara (awal rentang)",
  perkara_id_max: "Jenis perkara (akhir rentang)",
  perkara_id_referensi: "Acuan jenis",
};

export const ARTI_CEK: Record<number, string> = {
  0: "Semua perkara (tidak harus ditunjuk)",
  1: "Hanya perkara tempat ia ditunjuk, dan perannya harus cocok",
  2: "Perannya cocok ATAU ia ditunjuk di perkara",
  3: "Hanya perkara tempat ia ditunjuk",
};

const KOLOM_DAFTAR = new Set<KolomMenu>(["user_grup_id", "user_top_id", "user_validator"]);

/** "1|30|30|" -> ["1","30"]. */
export function pecahPeran(daftar: string | null | undefined): string[] {
  const hasil: string[] = [];
  for (const b of String(daftar ?? "").split("|").map((x) => x.trim()).filter(Boolean)) if (!hasil.includes(b)) hasil.push(b);
  return hasil;
}

export function gabungPeran(daftar: string[]): string | null {
  const unik = [...new Set(daftar.map((x) => String(x).trim()).filter(Boolean))];
  return unik.length ? unik.join("|") : null;
}

const samaHimpunan = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function namaPeran(id: string, peran: RujukanSipp[]): string {
  if (id === "1") return "Super Administrator";
  const p = peran.find((x) => String(x.id) === id);
  return p ? p.nama : `Peran ${id}`;
}

export function uraiPeran(daftar: string | null | undefined, peran: RujukanSipp[]): string {
  const ids = pecahPeran(daftar);
  return ids.length ? ids.map((i) => namaPeran(i, peran)).join(", ") : "(tidak ada)";
}

export function uraiTahapan(min: number, max: number, proses: RujukanSipp[]): string {
  const n = (id: number) => proses.find((p) => p.id === id)?.nama ?? `tahap ${id}`;
  return min === max ? n(min) : `${n(min)} s.d. ${n(max)}`;
}

export function uraiJenis(f: Pick<FolderMenuAbt, "perkara_id_min" | "perkara_id_max" | "perkara_id_referensi">, jenis: RujukanSipp[], alur: RujukanSipp[]): string {
  if (f.perkara_id_min === null || f.perkara_id_max === null) return "Semua jenis perkara";
  const sumber = f.perkara_id_referensi === "alur_perkara_id" ? alur : jenis;
  const n = (id: number) => sumber.find((p) => p.id === id)?.nama ?? `nomor ${id}`;
  const awalan = f.perkara_id_referensi === "alur_perkara_id" ? "Alur " : "";
  return f.perkara_id_min === f.perkara_id_max ? `${awalan}${n(f.perkara_id_min)}` : `${awalan}${n(f.perkara_id_min)} s.d. ${n(f.perkara_id_max)}`;
}

export type BedaKolom = { kolom: KolomMenu; label: string; lama: unknown; baru: unknown; lamaTeks: string; baruTeks: string };

function teksKolom(kolom: KolomMenu, nilai: unknown, d: Pick<DataMenuAbt, "peran" | "proses" | "jenis" | "alur">): string {
  if (KOLOM_DAFTAR.has(kolom)) return uraiPeran(nilai as string | null, d.peran);
  if (kolom === "user_cek") return ARTI_CEK[Number(nilai)] ?? String(nilai);
  if (kolom === "proses_id_min" || kolom === "proses_id_max") return uraiTahapan(Number(nilai), Number(nilai), d.proses);
  if (kolom === "perkara_id_referensi") return nilai === "alur_perkara_id" ? "Alur perkara" : nilai === "jenis_perkara_id" ? "Jenis perkara" : "(tidak ada)";
  return nilai === null || nilai === undefined || nilai === "" ? "(kosong)" : String(nilai);
}

/** Kolom yang sungguh berubah (daftar peran dibandingkan sebagai himpunan). */
export function bedaFolder(
  lama: FolderMenuAbt,
  baru: Partial<FolderMenuAbt>,
  d: Pick<DataMenuAbt, "peran" | "proses" | "jenis" | "alur">
): BedaKolom[] {
  const hasil: BedaKolom[] = [];
  for (const k of KOLOM_MENU) {
    if (!(k in baru)) continue;
    const a = lama[k];
    const b = baru[k];
    const berubah = KOLOM_DAFTAR.has(k)
      ? !samaHimpunan(pecahPeran(a as string | null), pecahPeran(b as string | null))
      : String(a ?? "") !== String(b ?? "");
    if (berubah) hasil.push({ kolom: k, label: LABEL_KOLOM_MENU[k], lama: a, baru: b, lamaTeks: teksKolom(k, a, d), baruTeks: teksKolom(k, b, d) });
  }
  return hasil;
}

export type UbahMenu = { id: number; lama: Partial<Record<KolomMenu, unknown>>; baru: Partial<Record<KolomMenu, unknown>> };

/** Susun kiriman simpan dari rancangan layar: hanya kolom yang berubah; lama = nilai yang dimuat. */
export function susunUbahMenu(asal: FolderMenuAbt[], rancangan: Record<number, Partial<FolderMenuAbt>>, d: Pick<DataMenuAbt, "peran" | "proses" | "jenis" | "alur">): UbahMenu[] {
  const hasil: UbahMenu[] = [];
  for (const f of asal) {
    const r = rancangan[f.id];
    if (!r) continue;
    const beda = bedaFolder(f, r, d);
    if (!beda.length) continue;
    hasil.push({
      id: f.id,
      lama: Object.fromEntries(beda.map((x) => [x.kolom, f[x.kolom]])),
      baru: Object.fromEntries(beda.map((x) => [x.kolom, KOLOM_DAFTAR.has(x.kolom) ? gabungPeran(pecahPeran(x.baru as string | null)) : x.baru])),
    });
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// Saklar kebijakan (diturunkan dari hak menu)
// ---------------------------------------------------------------------------

export const PERAN_HAKIM = ["10", "20"] as const; // Ketua/Wakil Ketua, Hakim
export const PERAN_PP = ["500"] as const; // Panitera Pengganti

/**
 * Folder BAS: susunan berpasangan server ("1 Perceraian CG - BAS", sejak 15 Okt)
 * maupun susunan lama ("BAS Alur 01 - ...", masih ada di salinan laptop).
 */
export const folderBas = (f: Pick<FolderMenuAbt, "nama" | "direktori">) => /\bBAS\b/.test(f.direktori) || /\bBAS\b/.test(f.nama);
export const folderPutusan = (f: Pick<FolderMenuAbt, "nama" | "direktori">) => !folderBas(f) && /^putusan\b/i.test(f.nama);

export type KunciSaklar = "hakim-lihat-bas" | "pp-lihat-putusan" | "validasi-bas";

export type SaklarKebijakan = {
  kunci: KunciSaklar;
  judul: string;
  arti: string;
  keadaan: "nyala" | "mati" | "sebagian";
  /** Folder yang disentuh saklar (kosong untuk saklar abt_config). */
  folder: number[];
};

function saklarPeranFolder(
  kunci: KunciSaklar,
  judul: string,
  arti: string,
  folder: FolderMenuAbt[],
  pilih: (f: FolderMenuAbt) => boolean,
  peranUtama: string
): SaklarKebijakan {
  const kena = folder.filter(pilih);
  const punya = kena.filter((f) => pecahPeran(f.user_grup_id).includes(peranUtama)).length;
  return {
    kunci,
    judul,
    arti,
    keadaan: !kena.length || punya === 0 ? "mati" : punya === kena.length ? "nyala" : "sebagian",
    folder: kena.map((f) => f.id),
  };
}

export function susunSaklar(d: Pick<DataMenuAbt, "folder" | "config">): SaklarKebijakan[] {
  const daftar = [
    saklarPeranFolder(
      "hakim-lihat-bas",
      "Hakim boleh membuka folder BAS",
      "Hakim dan Ketua/Wakil Ketua melihat folder BAS Blangko Derry untuk perkara tempat ia ditunjuk. Keputusan 15 Okt 2026: bawaannya tidak.",
      d.folder,
      folderBas,
      "20"
    ),
    saklarPeranFolder(
      "pp-lihat-putusan",
      "Panitera Pengganti boleh membuka folder putusan",
      "Panitera Pengganti melihat folder putusan Blangko Derry (mis. untuk menyiapkan salinan).",
      d.folder,
      folderPutusan,
      "500"
    ),
  ];
  if (d.config && "validasi_data_bas" in d.config) {
    daftar.push({
      kunci: "validasi-bas",
      judul: "BAS harus diperiksa hakim sebelum dicetak",
      arti: "Menyalakan pemeriksaan BAS bawaan ABT (Pengaturan ABT: validasi data BAS).",
      keadaan: d.config.validasi_data_bas === "1" ? "nyala" : "mati",
      folder: [],
    });
  }
  return daftar;
}

/**
 * Rancangan hak menu bila saklar dinyalakan/dimatikan. Hanya user_grup_id
 * folder yang disentuh saklar yang berubah; validator BAS dan cek penunjukan
 * tetap.
 */
export function rancanganSaklar(
  kunci: Exclude<KunciSaklar, "validasi-bas">,
  nyala: boolean,
  folder: FolderMenuAbt[],
  rancangan: Record<number, Partial<FolderMenuAbt>> = {}
): Record<number, Partial<FolderMenuAbt>> {
  const peran: readonly string[] = kunci === "hakim-lihat-bas" ? PERAN_HAKIM : PERAN_PP;
  const pilih = kunci === "hakim-lihat-bas" ? folderBas : folderPutusan;
  const hasil: Record<number, Partial<FolderMenuAbt>> = { ...rancangan };
  for (const f of folder.filter(pilih)) {
    const kini = pecahPeran((hasil[f.id]?.user_grup_id ?? f.user_grup_id) as string | null);
    const baru = nyala ? [...kini, ...peran.filter((p) => !kini.includes(p))] : kini.filter((p) => !peran.includes(p));
    hasil[f.id] = { ...(hasil[f.id] ?? {}), user_grup_id: gabungPeran(baru) };
  }
  return hasil;
}

/**
 * Hak blangko untuk ekstensi (Blangko ABT by Derry Briantono, 16 Okt 2026 malam):
 * saklar "Hakim boleh membuka folder BAS" / "PP boleh membuka folder putusan"
 * sebagai benar/salah ("sebagian" = benar: ABT tetap menyaring per folder) dan
 * hak per folder (nama tampil ABT = nama_alias) untuk "Lihat sebagai akun".
 * Tanpa kueri, validator, maupun rentang tahapan - hanya yang dibutuhkan layar.
 */
export type HakBlangkoEkstensi = {
  ada: true;
  saklar: { hakimBas: boolean; ppPutusan: boolean };
  folder: Array<Pick<FolderMenuAbt, "id" | "nama" | "namaAlias" | "user_grup_id" | "user_top_id">>;
};

export function ringkasHakBlangko(d: Pick<DataMenuAbt, "folder" | "config">): HakBlangkoEkstensi {
  const saklar = susunSaklar(d);
  const nyala = (k: KunciSaklar) => {
    const s = saklar.find((x) => x.kunci === k);
    return Boolean(s && s.keadaan !== "mati");
  };
  return {
    ada: true,
    saklar: { hakimBas: nyala("hakim-lihat-bas"), ppPutusan: nyala("pp-lihat-putusan") },
    folder: (d.folder || []).map((f) => ({ id: f.id, nama: f.nama, namaAlias: f.namaAlias, user_grup_id: f.user_grup_id, user_top_id: f.user_top_id })),
  };
}

/**
 * Daftar peran kosong DIBUKA ABT untuk SEMUA pengguna: Abt_model::menu_cek
 * membaca CONCAT(user_grup_id,'|',user_top_id) - NULL bila salah satu kosong -
 * dan user_grup_id() memulangkan TRUE untuk nilai kosong; akses_pengguna juga
 * meloloskan "semua user" bila user_grup_id kosong. Jadi mengosongkan kolom
 * itu bukan "tidak ada yang boleh" melainkan "semua boleh". Pulang sebab
 * (bahasa sehari-hari) atau "".
 */
export function periksaPeranMenuKosong(ubah: Array<{ id: number; baru: Partial<Record<KolomMenu, unknown>> }>): string {
  for (const u of ubah) {
    for (const k of ["user_grup_id", "user_top_id"] as const) {
      if (!(k in u.baru)) continue;
      if (!pecahPeran(u.baru[k] as string | null).length) {
        return `Folder ${u.id}: "${LABEL_KOLOM_MENU[k]}" tidak boleh kosong - ABT membaca daftar kosong sebagai SEMUA pengguna boleh membuka folder ini. Sisakan sedikitnya Super Administrator.`;
      }
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Variabel & template
// ---------------------------------------------------------------------------

export const ARTI_JENIS_VARIABEL: Record<string, string> = {
  data_sql: "Diambil dari data perkara (rumus)",
  data_sipp: "Diambil dari kolom SIPP",
  data_teks: "Diketik petugas",
  data_tanggal: "Tanggal diketik petugas",
  tanya_jawab: "Tanya jawab",
  multi_sidang: "Dari jadwal sidang",
  tanggal_hari: "Nama hari dari tanggal lain",
  tanggal_hijriah: "Tanggal hijriah dari tanggal lain",
  terbilang: "Angka dibaca dengan huruf",
  qrcode: "Kode QR",
  "": "Teks tetap",
};

export function artiJenisVariabel(jenis: string): string {
  return ARTI_JENIS_VARIABEL[jenis] ?? jenis;
}

export type BarisTemplat = { no?: number; tanya: string; jawab: string };

/** Periksa isi blangko tanya jawab sebelum dikirim - pulang daftar masalah (kosong = aman). */
export function periksaTemplat(baris: BarisTemplat[]): string[] {
  const masalah: string[] = [];
  if (!baris.length) masalah.push("Blangko tanya jawab harus memuat sedikitnya satu pertanyaan.");
  if (baris.length > 200) masalah.push("Paling banyak 200 pertanyaan.");
  baris.forEach((b, i) => {
    if (!String(b.tanya ?? "").trim()) masalah.push(`Pertanyaan nomor ${i + 1} kosong.`);
    const luar = hurufDiluarLatin1(`${b.tanya ?? ""}${b.jawab ?? ""}`);
    if (luar.length) masalah.push(`Nomor ${i + 1} memuat huruf yang tidak dapat disimpan ABT: ${luar.join(" ")}`);
  });
  return masalah;
}

/** Ringkas beda dua isi blangko tanya jawab: "3 pertanyaan diubah, 1 ditambah". */
export function ringkasBedaTemplat(lama: BarisTemplat[], baru: BarisTemplat[]): string {
  let ubah = 0;
  const n = Math.min(lama.length, baru.length);
  for (let i = 0; i < n; i += 1) if (lama[i].tanya !== baru[i].tanya || lama[i].jawab !== baru[i].jawab) ubah += 1;
  const bagian: string[] = [];
  if (ubah) bagian.push(`${ubah} pertanyaan diubah`);
  if (baru.length > lama.length) bagian.push(`${baru.length - lama.length} ditambah`);
  if (lama.length > baru.length) bagian.push(`${lama.length - baru.length} dibuang`);
  return bagian.join(", ") || "tidak ada yang berubah";
}

// "satker" = cabang isian satker kueri 9271-9274; "logo" = jejak paket logo kop (17 Okt 2026).
export const JENIS_SUNTINGAN = ["menu", "variabel", "templat", "satker", "logo"] as const;
export type JenisSuntingan = (typeof JENIS_SUNTINGAN)[number];
