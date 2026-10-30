/**
 * ============================================================================
 * KARTU TAUTAN AKUN PEGAWAI - ALETA <-> SIPP <-> ABT <-> e-COURT (G4, 30 Okt 2026)
 * ============================================================================
 *
 * Satu baris per pegawai: akun ALETA, akun SIPP tertaut, akun ABT, dan akun
 * e-Court pribadi per peran - masing-masing dengan keadaan cocok / kosong /
 * tidak cocok, dan saran bila ragu. MURNI (tanpa basis data, tanpa jaringan):
 * bahannya disusun server (server/modules/portal/kartu-tautan-akun.ts).
 *
 *   SIPP    dari pratinjau "Tautkan semua ke SIPP" (lib/tautan-akun-sipp.ts) -
 *           aturan pencocokannya TIDAK disalin; kelompok "pasti" (username /
 *           NIP / nama sama persis, satu-satunya calon) DITAUTKAN otomatis oleh
 *           server sebelum kartu disusun (arahan pengguna 30 Okt malam), yang
 *           ragu/ganda ditampilkan dengan calon untuk dipilih admin.
 *   ABT     ABT masuk dengan akun SIPP yang sama (Login.php ABT membaca
 *           v_users SIPP) - jadi keadaannya MENGIKUTI SIPP. Folder blangko
 *           pribadi (abt_menu_grup, mis. "Blangko Derry" = derry_briantono)
 *           dicocokkan menurut kata inti nama, hanya sebagai keterangan.
 *   e-Court akun pribadi per peran (bot ecourtAkunPenggunaService) - surel,
 *           ada/tidaknya sandi, hasil uji masuk, sesi, dan "diisi oleh".
 *           SANDI TIDAK PERNAH ADA DI SINI: bot tidak mengirimnya.
 *
 * Sandi SIPP tetap tidak disimpan di mana pun (rencana-masuk-satu-akun-sipp).
 */

import { kataIntiNama } from "@/lib/nama-pegawai-sipp";
import { namaMirip, namaSama, type BarisTautan, type CalonSipp, type PratinjauTautan } from "@/lib/tautan-akun-sipp";

export type KeadaanTautan = "cocok" | "kosong" | "tidak-cocok" | "perlu-dipilih" | "belum-diuji";

export const LABEL_KEADAAN_TAUTAN: Record<KeadaanTautan, string> = {
  cocok: "Cocok",
  kosong: "Kosong",
  "tidak-cocok": "Tidak cocok",
  "perlu-dipilih": "Perlu dipilih",
  "belum-diuji": "Tersimpan, belum diuji",
};

export const PERAN_ECOURT_LABEL: Record<string, string> = {
  hakim: "Hakim",
  panitera: "Panitera",
  "panitera-pengganti": "Panitera Pengganti",
  "juru-sita": "Juru Sita",
  lainnya: "Lainnya",
};

export type PegawaiKartu = {
  id: string;
  name: string;
  username: string;
  nip?: string | null;
  roleId?: string | null;
  positionId?: string | null;
  additionalRoleIds?: string[] | null;
  isActive?: boolean;
};

export type AkunEcourtKartu = {
  penggunaId: string;
  peran: string;
  email: string;
  adaSandi: boolean;
  diperbaruiPada?: string;
  diujiPada?: string;
  hasilUji?: string;
  diisiOleh?: string;
};

export type SesiEcourtKartu = {
  penggunaId: string;
  peran: string;
  keadaan: "tersambung" | "kedaluwarsa" | "terputus";
  namaAkunEcourt: string;
};

export type GrupBlangkoAbt = { id: number; nama: string; direktori: string };

/** Akun SIPP (sys_users) - tanpa sidik sandi. */
export type AkunSippKartu = { username: string; namaLengkap: string; diblokir: boolean; kedaluwarsa: boolean };

export type SelSipp = {
  keadaan: KeadaanTautan;
  username: string;
  sebab: string;
  /** Calon akun SIPP untuk dipilih admin (hanya "perlu-dipilih"). */
  saran: Array<Pick<CalonSipp, "username" | "namaLengkap" | "dasar" | "keadaan">>;
  /** Tautan ini baru saja dibuat otomatis (cocok pasti) pada pembukaan kartu ini. */
  otomatisBaru: boolean;
};

export type SelAbt = {
  keadaan: KeadaanTautan;
  username: string;
  sebab: string;
  folder: Array<{ nama: string; direktori: string }>;
};

export type SelEcourt = {
  peran: string;
  sebutanPeran: string;
  keadaan: KeadaanTautan;
  email: string;
  adaSandi: boolean;
  hasilUji: string;
  sesi: SesiEcourtKartu["keadaan"] | "";
  namaAkunEcourt: string;
  diisiOleh: string;
  sebab: string;
  diharapkan: boolean;
};

export type BarisKartu = {
  userId: string;
  nama: string;
  usernameAleta: string;
  roleId: string;
  sipp: SelSipp;
  abt: SelAbt;
  ecourt: SelEcourt[];
  /** Ringkas untuk penyaring: ada sel yang tidak cocok / perlu dipilih. */
  perluPerhatian: boolean;
};

export type BahanKartu = {
  pegawai: PegawaiKartu[];
  pratinjau: PratinjauTautan;
  akunEcourt: AkunEcourtKartu[];
  sesiEcourt: SesiEcourtKartu[];
  grupAbt: GrupBlangkoAbt[];
  /** Daftar akun SIPP (untuk memeriksa tautan Super Admin). Kosong/undefined = tidak diperiksa. */
  sipp?: AkunSippKartu[];
  /** userId yang baru ditautkan otomatis pada pembukaan ini. */
  otomatisBaru?: string[];
  /** Peran e-Court yang lazim untuk jabatan seseorang (ecourt-akun-pengguna.peranEcourtDiharapkan). */
  peranDiharapkan: (p: PegawaiKartu) => string[];
};

// ---------------------------------------------------------------------------
// SIPP
// ---------------------------------------------------------------------------

function selSipp(b: BarisTautan | undefined, otomatisBaru: boolean, sipp?: AkunSippKartu[]): SelSipp {
  const kosong: SelSipp = { keadaan: "kosong", username: "", sebab: "Belum ditautkan ke akun SIPP.", saran: [], otomatisBaru: false };
  if (!b) return kosong;
  const saran = (calon: CalonSipp[]) =>
    calon.filter((c) => c.aktif).map((c) => ({ username: c.username, namaLengkap: c.namaLengkap, dasar: c.dasar, keadaan: c.keadaan }));
  switch (b.kelompok) {
    case "sudah":
      return b.masalah
        ? { keadaan: "tidak-cocok", username: b.usernameSipp, sebab: b.masalah, saran: [], otomatisBaru: false }
        : {
            keadaan: "cocok",
            username: b.usernameSipp,
            sebab: otomatisBaru ? "Ditautkan otomatis: nama/NIP sama persis dengan satu-satunya akun SIPP aktif." : b.sebab,
            saran: [],
            otomatisBaru,
          };
    case "pasti": {
      // Ditahan dari penautan otomatis (nama saja + akun SIPP lain bernama mirip), atau ditolak transaksi.
      const tahan = sebabTahanOtomatis(b, sipp);
      const calonUrut = [...b.calon].sort((x, y) => Number(y.username === b.usernameSipp) - Number(x.username === b.usernameSipp));
      const mirip = (sipp ?? [])
        .filter((s) => !s.diblokir && !s.kedaluwarsa && !calonUrut.some((c) => c.username === s.username) && (namaMirip(b.nama, s.namaLengkap) || namaSama(b.nama, s.namaLengkap)))
        .map((s) => ({ username: s.username, namaLengkap: s.namaLengkap, dasar: [] as CalonSipp["dasar"], keadaan: "aktif" as const }));
      return {
        keadaan: "perlu-dipilih",
        username: "",
        sebab: tahan || `${b.sebab} Belum tertaut - pilih untuk menautkan.`,
        saran: [...saran(calonUrut), ...mirip],
        otomatisBaru: false,
      };
    }
    case "ganda":
    case "ragu":
      return { keadaan: "perlu-dipilih", username: "", sebab: b.sebab, saran: saran(b.calon), otomatisBaru: false };
    case "sipp-nonaktif":
      return { keadaan: "tidak-cocok", username: "", sebab: b.sebab, saran: [], otomatisBaru: false };
    case "dicabut":
      return { keadaan: "kosong", username: b.usernameSipp, sebab: b.sebab, saran: [], otomatisBaru: false };
    case "super-admin": {
      if (!b.usernameSipp) return { ...kosong, sebab: "Super Admin: tautan SIPP diatur lewat Manajemen Akun." };
      // Alat massal tidak menilai tautan Super Admin; di sini cukup diperiksa akun SIPP-nya ada dan aktif.
      const s = (sipp ?? []).find((x) => x.username.trim().toLowerCase() === b.usernameSipp.trim().toLowerCase());
      if (sipp && !s) return { keadaan: "tidak-cocok", username: b.usernameSipp, sebab: "Username SIPP tertaut tidak ditemukan di SIPP.", saran: [], otomatisBaru: false };
      if (s && (s.diblokir || s.kedaluwarsa)) {
        return { keadaan: "tidak-cocok", username: b.usernameSipp, sebab: `Akun SIPP tertaut ${s.diblokir ? "DIBLOKIR" : "KEDALUWARSA"}.`, saran: [], otomatisBaru: false };
      }
      return { keadaan: "cocok", username: b.usernameSipp, sebab: "Super Admin: tautan diatur lewat Manajemen Akun.", saran: [], otomatisBaru: false };
    }
    case "nonaktif":
      return { ...kosong, sebab: "Akun ALETA nonaktif." };
    case "tanpa-padanan":
    default:
      return { ...kosong, sebab: b.sebab || kosong.sebab };
  }
}

// ---------------------------------------------------------------------------
// ABT - masuk dengan akun SIPP yang sama; folder blangko pribadi menurut nama
// ---------------------------------------------------------------------------

/** Kata nama yang terlalu umum untuk mengenali folder pribadi. */
const KATA_UMUM_FOLDER = new Set(["blangko", "standar", "lainnya", "kepaniteraan", "jinayat", "putusan", "penetapan", "gugatan", "permohonan", "berita", "acara", "sidang", "mediasi", "ikrar", "talak", "court", "ecourt", "jurusita", "donggala", "daftar", "produk", "sederhana"]);

function kataFolder(g: GrupBlangkoAbt): Set<string> {
  const hasil = new Set<string>();
  for (const sumber of [g.nama, g.direktori.replace(/_/g, " ")]) {
    for (const k of kataIntiNama(String(sumber).replace(/\([^)]*\)/g, " "))) if (k.length >= 4) hasil.add(k);
  }
  return hasil;
}

/**
 * Folder blangko pribadi pegawai: kelompok ABT yang namanya/direktorinya memuat
 * kata inti nama pegawai (>= 4 huruf). "Blangko Derry (Daftar s.d. Produk)" /
 * derry_briantono -> Derry Briantono; "Blangko Fikrianto" -> Fikrianto, S.H.
 * Kata umum folder ("blangko", "standar", "jurusita") saja tidak cukup.
 */
export function folderPribadi(nama: string, grup: GrupBlangkoAbt[]): Array<{ nama: string; direktori: string }> {
  const kata = kataIntiNama(nama).filter((k) => k.length >= 4);
  if (!kata.length) return [];
  const hasil: Array<{ nama: string; direktori: string }> = [];
  for (const g of grup) {
    const kf = kataFolder(g);
    const kenaKata = kata.filter((k) => kf.has(k));
    if (!kenaKata.length) continue;
    // Satu kata saja yang juga kata umum folder tidak cukup; dua kata nama, atau satu kata nama yang tidak umum, cukup.
    const kuat = kenaKata.length >= 2 || kenaKata.some((k) => !KATA_UMUM_FOLDER.has(k));
    if (kuat) hasil.push({ nama: g.nama, direktori: g.direktori });
  }
  return hasil;
}

function selAbt(sipp: SelSipp, nama: string, grup: GrupBlangkoAbt[], calon: CalonSipp | undefined): SelAbt {
  const folder = folderPribadi(nama, grup);
  if (sipp.keadaan === "cocok") {
    if (calon && !calon.aktif) {
      return { keadaan: "tidak-cocok", username: sipp.username, sebab: `Akun SIPP ${calon.keadaan} - ABT ikut tertutup.`, folder };
    }
    return { keadaan: "cocok", username: sipp.username, sebab: "ABT masuk dengan akun SIPP yang sama.", folder };
  }
  if (sipp.keadaan === "tidak-cocok") return { keadaan: "tidak-cocok", username: sipp.username, sebab: "Mengikuti akun SIPP yang belum cocok.", folder };
  return { keadaan: sipp.keadaan === "perlu-dipilih" ? "perlu-dipilih" : "kosong", username: "", sebab: "ABT memakai akun SIPP - tautkan akun SIPP lebih dulu.", folder };
}

// ---------------------------------------------------------------------------
// e-Court
// ---------------------------------------------------------------------------

/** Nama akun e-Court (dari sesi) cocok dengan nama pegawai? true / false / null bila tidak diketahui. */
export function namaEcourtCocok(namaPegawai: string, namaAkunEcourt: string): boolean | null {
  const a = kataIntiNama(namaPegawai).filter((k) => k.length >= 3);
  const b = kataIntiNama(namaAkunEcourt).filter((k) => k.length >= 3);
  if (!a.length || !b.length) return null;
  const setB = new Set(b);
  return a.some((k) => setB.has(k));
}

function selEcourt(p: PegawaiKartu, akun: AkunEcourtKartu[], sesi: SesiEcourtKartu[], diharapkan: string[]): SelEcourt[] {
  const milik = akun.filter((a) => a.penggunaId === p.id);
  const peranSemua = [...new Set([...diharapkan, ...milik.map((a) => a.peran)])];
  return peranSemua.map((peran) => {
    const a = milik.find((x) => x.peran === peran);
    const s = sesi.find((x) => x.penggunaId === p.id && x.peran === peran);
    const dasar = {
      peran,
      sebutanPeran: PERAN_ECOURT_LABEL[peran] ?? peran,
      email: a?.email ?? "",
      adaSandi: Boolean(a?.adaSandi),
      hasilUji: a?.hasilUji ?? "",
      sesi: (s?.keadaan ?? "") as SelEcourt["sesi"],
      namaAkunEcourt: s?.namaAkunEcourt ?? "",
      diisiOleh: a?.diisiOleh ?? "",
      diharapkan: diharapkan.includes(peran),
    };
    if (!a || !a.email || !a.adaSandi) {
      return { ...dasar, keadaan: "kosong" as const, sebab: a?.email ? "Surel tersimpan tanpa sandi." : "Akun e-Court belum diisi." };
    }
    if (a.hasilUji === "ditolak") return { ...dasar, keadaan: "tidak-cocok" as const, sebab: "Uji masuk terakhir DITOLAK e-Court - surel atau sandi salah." };
    const nama = s?.namaAkunEcourt ? namaEcourtCocok(p.name, s.namaAkunEcourt) : null;
    if (nama === false) {
      return { ...dasar, keadaan: "tidak-cocok" as const, sebab: `Nama akun e-Court (${s?.namaAkunEcourt}) tidak sama dengan nama pegawai - periksa apakah akunnya milik orang lain.` };
    }
    if (a.hasilUji === "berhasil" || s?.keadaan === "tersambung") return { ...dasar, keadaan: "cocok" as const, sebab: "" };
    return { ...dasar, keadaan: "belum-diuji" as const, sebab: "Tersimpan; belum pernah diuji masuk." };
  });
}

// ---------------------------------------------------------------------------
// Kartu
// ---------------------------------------------------------------------------

export function susunKartuTautan(bahan: BahanKartu): BarisKartu[] {
  const perAkun = new Map(bahan.pratinjau.baris.map((b) => [b.userId, b]));
  const baru = new Set(bahan.otomatisBaru ?? []);
  const hasil: BarisKartu[] = [];
  for (const p of bahan.pegawai) {
    if (p.isActive === false) continue;
    const b = perAkun.get(p.id);
    const sipp = selSipp(b, baru.has(p.id), bahan.sipp);
    const calon = b?.calon.find((c) => c.username.toLowerCase() === sipp.username.toLowerCase());
    const abt = selAbt(sipp, p.name, bahan.grupAbt, calon);
    const ecourt = selEcourt(p, bahan.akunEcourt, bahan.sesiEcourt, bahan.peranDiharapkan(p));
    const perluPerhatian =
      [sipp.keadaan, abt.keadaan].some((k) => k === "tidak-cocok" || k === "perlu-dipilih") ||
      ecourt.some((e) => e.keadaan === "tidak-cocok" || (e.diharapkan && e.keadaan === "kosong"));
    hasil.push({ userId: p.id, nama: p.name, usernameAleta: p.username, roleId: String(p.roleId ?? ""), sipp, abt, ecourt, perluPerhatian });
  }
  return hasil.sort((a, b) => Number(b.perluPerhatian) - Number(a.perluPerhatian) || a.nama.localeCompare(b.nama, "id"));
}

/**
 * Sebab pasangan "pasti" TIDAK ditautkan otomatis (kosong = boleh). Pasangan yang cocok HANYA lewat nama
 * sedangkan ada akun SIPP aktif lain yang namanya MIRIP dengan pegawai itu (diukur 30 Okt atas data satker:
 * "Tiffany Rachmawati Suranto" = akun kasir, padahal meja1p/meja1g bernama "Tiffany RS") diserahkan ke admin -
 * nama yang sama persis tidak membuktikan akun mana yang dipakai orangnya. Cocok lewat NIP/username,
 * atau ditetapkan pengguna, tetap otomatis.
 */
export function sebabTahanOtomatis(b: BarisTautan, sipp: AkunSippKartu[] | undefined): string {
  if (b.ditetapkanPengguna) return "";
  const pilihan = b.calon.find((c) => c.username.toLowerCase() === b.usernameSipp.toLowerCase());
  if (!pilihan || pilihan.dasar.includes("nip") || pilihan.dasar.includes("username")) return "";
  const lain = (sipp ?? []).filter(
    (s) => !s.diblokir && !s.kedaluwarsa && s.username.toLowerCase() !== b.usernameSipp.toLowerCase() && (namaMirip(b.nama, s.namaLengkap) || namaSama(b.nama, s.namaLengkap))
  );
  return lain.length ? `Cocok lewat nama saja, tetapi akun SIPP aktif lain bernama mirip (${lain.map((s) => s.username).join(", ")}) - pilih sendiri akun yang dipakai pegawai ini.` : "";
}

/** Pilihan "pasti" dari pratinjau yang boleh ditautkan otomatis (bukan Super Admin, akun aktif, satu calon, tidak ditahan). */
export function pilihanOtomatisPasti(pratinjau: PratinjauTautan, sipp?: AkunSippKartu[]): Array<{ userId: string; usernameSipp: string }> {
  return pratinjau.baris
    .filter((b) => b.kelompok === "pasti" && b.usernameSipp && b.roleId !== "super-admin" && !sebabTahanOtomatis(b, sipp))
    .map((b) => ({ userId: b.userId, usernameSipp: b.usernameSipp }));
}

/** Ringkasan untuk kepala kartu. */
export function ringkasKartu(baris: BarisKartu[]) {
  const hitung = (pilih: (b: BarisKartu) => KeadaanTautan[]) => {
    const r: Record<KeadaanTautan, number> = { cocok: 0, kosong: 0, "tidak-cocok": 0, "perlu-dipilih": 0, "belum-diuji": 0 };
    for (const b of baris) for (const k of pilih(b)) r[k] += 1;
    return r;
  };
  return {
    pegawai: baris.length,
    perluPerhatian: baris.filter((b) => b.perluPerhatian).length,
    sipp: hitung((b) => [b.sipp.keadaan]),
    abt: hitung((b) => [b.abt.keadaan]),
    ecourt: hitung((b) => b.ecourt.filter((e) => e.diharapkan || e.adaSandi).map((e) => e.keadaan)),
  };
}
