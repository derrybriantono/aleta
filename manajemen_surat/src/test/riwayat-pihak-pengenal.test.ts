// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PENGENAL ORANG LINTAS PERKARA DAN HITUNGAN CERAI BERAKTA
 * ============================================================================
 *
 * Permintaan pengguna 27 September 2026 - penanda "cerai N×" dan "perkara
 * terkait" di bagian Para pihak Status Perkara. Penanda "pernah cerai" yang
 * keliru merugikan orang, jadi yang dijaga di sini adalah PERILAKU aturannya,
 * satu per satu, atas layanan bot sungguhan (aleta_bot/services/
 * riwayatPihakService.js) - bukan teks sumbernya:
 *
 *   - tiap tingkat pengenal: pihak_id, NIK, nama + tanggal lahir, pasangan;
 *   - NIK tiruan dan NIK yang dipakai orang berbeda DITOLAK;
 *   - NAMA SAJA DITOLAK;
 *   - hanya perceraian yang AKTANYA SUDAH TERBIT yang dihitung, termasuk
 *     perkara ini sendiri;
 *   - sebelum/sesudah, dan tingkat yang lebih pasti menang;
 *   - jawaban rute: 400, 404, 500.
 *
 * db_config diganti tiruan SEBELUM layanan dimuat - kolam mysql sungguhan
 * tidak pernah dibuat. Kebenaran SQL-nya atas SIPP sungguhan diuji terpisah di
 * riwayat-pihak-sipp.test.ts.
 *
 * Uji mutan menjalankan berkas ini atas SALINAN layanannya lewat
 * RIWAYAT_PIHAK_BERKAS. Nama orang di sini karangan.
 */

const AKAR_BOT = path.resolve(process.cwd(), "../aleta_bot");
const muat = createRequire(path.join(AKAR_BOT, "package.json"));

type Kueri = { sql: string; nilai: unknown[] };
const catatan: Kueri[] = [];
let jawab: (sql: string, nilai: unknown[]) => unknown[] = () => [];

function pasangDbTiruan() {
  const dbPalsu = {
    query(sql: string, nilai: unknown[] | ((e: unknown, r: unknown) => void), cb?: (e: unknown, r: unknown) => void) {
      const selesai = typeof nilai === "function" ? nilai : cb;
      const daftar = Array.isArray(nilai) ? nilai : [];
      catatan.push({ sql: String(sql), nilai: daftar });
      let hasil: unknown[];
      try {
        hasil = jawab(String(sql), daftar);
      } catch (galat) {
        selesai?.(galat, null);
        return;
      }
      selesai?.(null, hasil);
    },
  };
  const berkas = muat.resolve("./db_config");
  muat.cache[berkas] = { id: berkas, filename: berkas, loaded: true, exports: dbPalsu } as unknown as NodeJS.Module;
}
pasangDbTiruan();

type Nama = { teks: string; kunci: string; kata: string[] };
type Orang = {
  pihakId: number;
  perkaraId: number;
  pihakKe: number;
  namaTampil: string;
  nama: Nama;
  namaPerkara: Nama;
  nik: string;
  lahir: string;
  jk: string;
};
type Dasar = { tingkat: string; label: string; catatan: string };
type Butir = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  pihakKe: number;
  kedudukan: string;
  tanggalDaftar: string;
  keadaan: string;
  aktaCerai: { nomor: string; tanggal: string } | null;
  arah: string;
  dasar: Dasar;
};
type Riwayat = {
  pihakId: number;
  pihakKe: number;
  nama: string;
  kedudukan: string;
  ceraiBerakta: number;
  cerai: Butir[];
  jumlahTerkait: number;
  terkait: Butir[];
};
type Pasangan = {
  asalPihakId: number;
  perkaraId: number;
  pihakKe: number;
  pihakIdCocok: number;
  pasangan: string;
  berhadapan: boolean;
  lahirBerbeda: boolean;
};
type Layanan = {
  bakuNama: (n: string) => Nama;
  nikSah: (n: unknown) => string;
  orangDari: (b: Record<string, unknown>) => Orang;
  nikTercemar: (d: Orang[]) => Set<string>;
  tingkatOrang: (a: Orang, c: Orang, t?: Set<string>) => { tingkat: string } | null;
  cocokPasangan: (p: Orang[], k: Orang[], id: number) => Pasangan[];
  susunRiwayat: (b: Record<string, unknown>) => Riwayat[];
  jawabRute: (q: Record<string, unknown>) => Promise<{ status: number; body: Record<string, unknown> }>;
};

const BERKAS = process.env.RIWAYAT_PIHAK_BERKAS || path.join(AKAR_BOT, "services/riwayatPihakService.js");
const L = muat(BERKAS) as Layanan;

beforeEach(() => {
  catatan.length = 0;
  jawab = () => [];
});

// NIK karangan yang BENTUKNYA sah: 72 03 14 | 17 05 80 | 0001 (laki-laki
// lahir 17-05-1980) dan 57 05 80 (perempuan, hari + 40).
const NIK_L = "7203141705800001";
const NIK_P = "7203145705800002";

function orang(ubah: Record<string, unknown> = {}): Orang {
  return L.orangDari({ pihakId: 1, pihakKe: 1, nama: "RAHMAT BIN LAMBOGO", jk: "L", ...ubah });
}

// ===========================================================================
// 1. NAMA DIBAKUKAN - YANG DIBUANG HANYA YANG TERBUKTI BUKAN NAMA
// ===========================================================================

describe("nama dibakukan", () => {
  it("gelar dan sapaan dibuang; tanda baca dan spasi tidak membedakan", () => {
    const k = (n: string) => L.bakuNama(n).kunci;
    expect(k("Rahmat, S.Pd.I")).toBe(k("RAHMAT"));
    expect(k("RAHMAT S.PD BIN LAMBOGO")).toBe(k("Rahmat bin Lambogo"));
    expect(k("H. RAHMAT BIN HI. LAMBOGO")).toBe(k("RAHMAT BIN LAMBOGO"));
    expect(k("Drs. Rahmat bin Lambogo, M.Pd")).toBe(k("RAHMAT BIN LAMBOGO"));
    expect(k("Abd.Rahman bin Lahamu")).toBe(k("ABD RAHMAN BIN LAHAMU"));
    // Spasi di dalam nama tidak konsisten antarperkara: NUR AINI = NURAINI.
    expect(k("Nur Aini binti Lahamu")).toBe(k("NURAINI BINTI LAHAMU"));
    expect(k("Sitti Ma'rufah bt. Lahamu")).toBe(k("SITTI MARUFAH BINTI LAHAMU"));
  });

  it("singkatan nama BUKAN gelar - M. SAID bukan SAID, ST. AMINAH bukan AMINAH", () => {
    const k = (n: string) => L.bakuNama(n).kunci;
    // Pola umum "huruf-titik-huruf" akan membuang keduanya lalu menyamakan
    // dua orang berbeda. Terukur: MOH. 462, ABD. 273, M. 103 di sipp_donggala.
    expect(k("M. Said bin Lahamu")).not.toBe(k("SAID BIN LAHAMU"));
    expect(k("M.SAID")).toBe(k("M SAID"));
    expect(k("St. Aminah")).not.toBe(k("AMINAH"));
    expect(k("Moh. Rizal")).toBe(k("MOH RIZAL"));
    expect(k("MOH RIZAL")).not.toBe(k("MUH RIZAL"));
  });
});

// ===========================================================================
// 2. NIK YANG SAH
// ===========================================================================

describe("NIK sah - bentuknya, bukan sekadar panjangnya", () => {
  it("NIK berbentuk sah diterima", () => {
    expect(L.nikSah(NIK_L)).toBe(NIK_L);
    expect(L.nikSah(` ${NIK_P} `)).toBe(NIK_P);
  });

  it("isian tiruan dan bentuk mustahil ditolak", () => {
    for (const buruk of [
      "0000000000000000", // nol semua
      "7777777777777777", // satu angka berulang
      "1234567890123456", // deret naik
      "9876543210987654", // deret turun
      "7203010000000000", // enam nol sesudah kode wilayah
      "7203141705800000", // nomor urut 0000
      "0503141705800001", // kode provinsi 05 tidak ada
      "7200141705800001", // kode kabupaten 00
      "7203143205800001", // hari 32
      "7203147205800001", // hari 72 (perempuan maksimal 71)
      "7203141713800001", // bulan 13
      "720314170580001", // 15 angka
      "72031417058000011", // 17 angka
      "72031417O5800001", // huruf O
      "",
      null,
    ]) {
      expect(L.nikSah(buruk), String(buruk)).toBe("");
    }
  });
});

// ===========================================================================
// 3. TINGKAT PENGENAL
// ===========================================================================

describe("tingkat pengenal", () => {
  it("pihak_id yang sama: orang yang sama menurut SIPP sendiri", () => {
    const a = orang({ pihakId: 7 });
    const c = orang({ pihakId: 7, nama: "NAMA LAIN SAMA SEKALI", jk: "" });
    expect(L.tingkatOrang(a, c)?.tingkat).toBe("pihak_id");
  });

  it("NIK sah sama + tanggal lahir sama: tingkat NIK walau namanya dieja lain", () => {
    const a = orang({ pihakId: 1, nik: NIK_L, lahir: "1980-05-17" });
    const c = orang({ pihakId: 2, nama: "RACHMAT BIN LAMBOGO", nik: NIK_L, lahir: "1980-05-17" });
    expect(L.tingkatOrang(a, c)?.tingkat).toBe("nik");
  });

  it("NIK sama, tanggal lahir kosong: dipakai HANYA bila nama depannya sama", () => {
    const a = orang({ pihakId: 1, nik: NIK_L, lahir: "" });
    expect(L.tingkatOrang(a, orang({ pihakId: 2, nama: "RAHMAT LAMBOGO", nik: NIK_L }))?.tingkat).toBe("nik");
    // Nama berbeda sama sekali, tanpa tanggal lahir yang menguatkan - ditolak.
    expect(L.tingkatOrang(a, orang({ pihakId: 3, nama: "YUSUF BIN TAMBI", nik: NIK_L }))).toBeNull();
  });

  it("NIK sama tetapi tanggal lahir atau jenis kelamin berbeda: DITOLAK", () => {
    const a = orang({ pihakId: 1, nik: NIK_L, lahir: "1980-05-17", jk: "L" });
    expect(L.tingkatOrang(a, orang({ pihakId: 2, nik: NIK_L, lahir: "1975-01-02" }))).toBeNull();
    expect(L.tingkatOrang(a, orang({ pihakId: 3, nik: NIK_L, lahir: "1980-05-17", jk: "P" }))).toBeNull();
  });

  it("NIK tiruan yang sama tidak menyambungkan siapa pun", () => {
    const a = orang({ pihakId: 1, nama: "RAHMAT BIN LAMBOGO", nik: "0000000000000000", lahir: "" });
    const c = orang({ pihakId: 2, nama: "RAHMAT BIN LAMBOGO", nik: "0000000000000000", lahir: "" });
    expect(L.tingkatOrang(a, c)).toBeNull();
    const d = orang({ pihakId: 3, nama: "RAHMAT", nik: "1234567890123456", lahir: "" });
    expect(L.tingkatOrang(orang({ pihakId: 4, nama: "RAHMAT", nik: "1234567890123456" }), d)).toBeNull();
  });

  it("NIK tercemar - dipakai orang yang terbukti berbeda - tidak dipakai mencocokkan siapa pun", () => {
    // Tiga baris satu NIK: dua orang berbeda (nama depan DAN tanggal lahir
    // berbeda) - seperti 106/Pdt.G/2023 yang mencatat sembilan orang satu NIK.
    const pemilik = orang({ pihakId: 1, nama: "HALIMAH BINTI SENDE", jk: "P", nik: NIK_P, lahir: "1980-05-17" });
    const salinan = orang({ pihakId: 2, nama: "BADRIAH BINTI SENDE", jk: "P", nik: NIK_P, lahir: "1954-05-02" });
    const tanpaLahir = orang({ pihakId: 3, nama: "HALIMAH SENDE", jk: "P", nik: NIK_P, lahir: "" });
    const tercemar = L.nikTercemar([pemilik, salinan, tanpaLahir]);
    expect(tercemar.has(NIK_P)).toBe(true);
    // Tanpa pemeriksaan ini baris tanpa tanggal lahir tersambung ke pemilik
    // lewat NIK (nama depannya sama) - dan ke salinannya juga.
    expect(L.tingkatOrang(tanpaLahir, pemilik, new Set())?.tingkat).toBe("nik");
    expect(L.tingkatOrang(tanpaLahir, pemilik, tercemar)).toBeNull();
  });

  it("satu orang yang ejaannya berbeda dengan tanggal lahir sama TIDAK membuat NIK tercemar", () => {
    const a = orang({ pihakId: 1, nama: "LEKMAN BIN PANGADJARI", nik: NIK_L, lahir: "1962-07-17" });
    const b = orang({ pihakId: 2, nama: "LEKMA BIN PANGAJARI", nik: NIK_L, lahir: "1962-07-17" });
    expect(L.nikTercemar([a, b]).size).toBe(0);
    // Jenis kelamin berbeda pada satu NIK: tercemar.
    const c = orang({ pihakId: 3, nama: "LEKMAN", nik: NIK_L, lahir: "", jk: "P" });
    expect(L.nikTercemar([a, c]).has(NIK_L)).toBe(true);
  });

  it("nama + tanggal lahir sama (keduanya ada): tingkat nama_lahir, walau gelarnya berbeda", () => {
    const a = orang({ pihakId: 1, nama: "Rahmat bin Lambogo", lahir: "1980-05-17" });
    const c = orang({ pihakId: 2, nama: "H. RAHMAT S.Pd BIN LAMBOGO", lahir: "1980-05-17" });
    expect(L.tingkatOrang(a, c)?.tingkat).toBe("nama_lahir");
  });

  it("nama + tanggal lahir sama tetapi dua NIK sah berbeda: DITOLAK", () => {
    const a = orang({ pihakId: 1, lahir: "1980-05-17", nik: NIK_L });
    const c = orang({ pihakId: 2, lahir: "1980-05-17", nik: "7203141705800003" });
    expect(L.tingkatOrang(a, c)).toBeNull();
  });

  it("NAMA SAJA DITOLAK - tanpa tanggal lahir, atau tanggal lahirnya berbeda", () => {
    const a = orang({ pihakId: 1, lahir: "" });
    expect(L.tingkatOrang(a, orang({ pihakId: 2, lahir: "" }))).toBeNull();
    expect(L.tingkatOrang(a, orang({ pihakId: 3, lahir: "1980-05-17" }))).toBeNull();
    const b = orang({ pihakId: 4, lahir: "1980-05-17" });
    expect(L.tingkatOrang(b, orang({ pihakId: 5, lahir: "1981-05-17" }))).toBeNull();
  });

  it("nama satu kata dengan tanggal lahir pengganti terlalu lemah; tanggal biasa diterima", () => {
    const a = orang({ pihakId: 1, nama: "USMAN", lahir: "1971-07-01" });
    expect(L.tingkatOrang(a, orang({ pihakId: 2, nama: "USMAN", lahir: "1971-07-01" }))).toBeNull();
    const b = orang({ pihakId: 3, nama: "USMAN", lahir: "1971-03-14" });
    expect(L.tingkatOrang(b, orang({ pihakId: 4, nama: "USMAN", lahir: "1971-03-14" }))?.tingkat).toBe("nama_lahir");
  });
});

// ===========================================================================
// 4. PASANGAN NAMA
// ===========================================================================

describe("pasangan nama", () => {
  const istri = () => orang({ pihakId: 11, pihakKe: 1, nama: "SITTI AMINAH BINTI LAHAMU", jk: "P", perkaraId: 100 });
  const suami = () => orang({ pihakId: 12, pihakKe: 2, nama: "RAHMAT BIN LAMBOGO", jk: "L", perkaraId: 100 });
  const di = (perkaraId: number, pihakId: number, pihakKe: number, nama: string, ubah: Record<string, unknown> = {}) =>
    L.orangDari({ perkaraId, pihakId, pihakKe, nama, namaPerkara: nama, ...ubah });

  it("kedua pihak muncul berhadapan di perkara lain: keduanya tersambung", () => {
    const hasil = L.cocokPasangan(
      [istri(), suami()],
      [di(90, 21, 1, "RAHMAT BIN LAMBOGO"), di(90, 22, 2, "Sitti Aminah binti Lahamu")],
      100
    );
    expect(hasil.map((x) => [x.asalPihakId, x.perkaraId, x.pihakKe, x.pihakIdCocok, x.berhadapan])).toEqual([
      [11, 90, 2, 22, true],
      [12, 90, 1, 21, true],
    ]);
  });

  it("hanya SATU nama yang muncul: tidak tersambung - nama saja bukan pasangan", () => {
    expect(L.cocokPasangan([istri(), suami()], [di(90, 21, 1, "RAHMAT BIN LAMBOGO"), di(90, 23, 2, "ORANG LAIN BINTI X")], 100)).toEqual([]);
  });

  it("pembantah membatalkan: NIK sah berbeda atau jenis kelamin berbeda", () => {
    const nikLain = L.cocokPasangan(
      [orang({ pihakId: 11, pihakKe: 1, nama: "SITTI AMINAH BINTI LAHAMU", jk: "P", nik: NIK_P, perkaraId: 100 }), suami()],
      [di(90, 21, 1, "RAHMAT BIN LAMBOGO"), di(90, 22, 2, "SITTI AMINAH BINTI LAHAMU", { nik: "7203145705800009" })],
      100
    );
    expect(nikLain.filter((x) => x.asalPihakId === 11)).toEqual([]);
    const jkLain = L.cocokPasangan(
      [istri(), suami()],
      [di(90, 21, 1, "RAHMAT BIN LAMBOGO", { jk: "P" }), di(90, 22, 2, "SITTI AMINAH BINTI LAHAMU")],
      100
    );
    expect(jkLain.filter((x) => x.asalPihakId === 12)).toEqual([]);
  });

  it("nama satu kata tidak cukup untuk tingkat pasangan", () => {
    const a = orang({ pihakId: 11, pihakKe: 1, nama: "AMINAH", jk: "P" });
    const b = orang({ pihakId: 12, pihakKe: 2, nama: "RAHMAT", jk: "L" });
    expect(L.cocokPasangan([a, b], [di(90, 21, 1, "RAHMAT"), di(90, 22, 2, "AMINAH")], 100)).toEqual([]);
  });

  it("tanggal lahir berbeda tidak membatalkan, tetapi DICATAT; pihak yang sama sisi disebut", () => {
    const a = orang({ pihakId: 11, pihakKe: 1, nama: "SITTI AMINAH BINTI LAHAMU", jk: "P", lahir: "1990-03-09" });
    const b = orang({ pihakId: 12, pihakKe: 2, nama: "RAHMAT BIN LAMBOGO", jk: "L", lahir: "1988-01-02" });
    const hasil = L.cocokPasangan(
      [a, b],
      [di(90, 21, 1, "RAHMAT BIN LAMBOGO", { lahir: "1994-03-05" }), di(90, 22, 1, "SITTI AMINAH BINTI LAHAMU", { lahir: "1994-03-05" })],
      100
    );
    expect(hasil).toHaveLength(2);
    for (const x of hasil) {
      expect(x.lahirBerbeda).toBe(true);
      expect(x.berhadapan).toBe(false);
    }
  });

  it("perkara ini sendiri dan satu baris untuk dua nama tidak dihitung", () => {
    expect(L.cocokPasangan([istri(), suami()], [di(100, 11, 1, "SITTI AMINAH BINTI LAHAMU"), di(100, 12, 2, "RAHMAT BIN LAMBOGO")], 100)).toEqual([]);
  });
});

// ===========================================================================
// 5. MENYUSUN RIWAYAT - CERAI BERAKTA, SEBELUM/SESUDAH, DASAR
// ===========================================================================

const INI = {
  perkaraId: 100,
  nomorPerkara: "100/Pdt.G/2026/PA.Ctt",
  tanggalDaftar: "2026-03-01",
  alurPerkaraId: 15,
  jenisPerkaraId: 347,
  jenisPerkara: "Cerai Gugat",
};

function keterangan(id: number, ubah: Record<string, unknown> = {}) {
  return {
    perkaraId: id,
    nomorPerkara: `${id}/Pdt.G/2020/PA.Ctt`,
    tanggalDaftar: "2020-01-15",
    alurPerkaraId: 15,
    jenisPerkaraId: 347,
    jenisPerkara: "Cerai Gugat",
    tanggalPutusan: "2020-04-01",
    tanggalCabut: "",
    tanggalGugur: "",
    statusPutusan: "Dikabulkan",
    nomorAkta: "",
    tanggalAkta: "",
    ...ubah,
  };
}

function susun({
  infoIni = {},
  lain = [] as Array<[number, Record<string, unknown>]>,
  kemunculan = [] as Array<{ perkaraId: number; pihakId: number; pihakKe: number }>,
  orangSama = new Map<number, Map<number, string>>(),
  pasangan = [] as Pasangan[],
} = {}) {
  const istri = L.orangDari({ pihakId: 11, pihakKe: 1, nama: "SITTI AMINAH BINTI LAHAMU", jk: "P" });
  const suami = L.orangDari({ pihakId: 12, pihakKe: 2, nama: "RAHMAT BIN LAMBOGO", jk: "L" });
  const info = new Map<number, Record<string, unknown>>([[100, { ...INI, ...infoIni }], ...lain]);
  return L.susunRiwayat({ ini: INI, pihakIni: [istri, suami], orangSama, kemunculan, pasangan, info });
}

describe("cerai berakta dihitung dari aktanya", () => {
  it("hanya perkara yang nomor DAN tanggal aktanya ada; perkara ini ikut bila berakta", () => {
    const [istri] = susun({
      infoIni: { nomorAkta: "12/AC/2026/PA.Ctt", tanggalAkta: "2026-06-01" },
      lain: [
        [90, keterangan(90, { nomorAkta: "50/AC/2020/PA.Ctt", tanggalAkta: "2020-06-10" })],
        [91, keterangan(91, { tanggalPutusan: "", statusPutusan: "", tanggalCabut: "2021-02-01" })], // dicabut
        [92, keterangan(92, { nomorAkta: "77/AC/2022/PA.Ctt", tanggalAkta: "" })], // tanggal akta kosong
        [93, keterangan(93, { nomorAkta: "", tanggalAkta: "2023-01-01" })], // nomor akta kosong
        [94, keterangan(94, { statusPutusan: "Ditolak", nomorAkta: "" })], // ditolak
      ],
      kemunculan: [90, 91, 92, 93, 94].map((perkaraId) => ({ perkaraId, pihakId: 11, pihakKe: 1 })),
    });
    expect(istri.ceraiBerakta).toBe(2);
    expect(istri.cerai.map((x) => [x.nomorPerkara, x.aktaCerai?.nomor, x.arah])).toEqual([
      ["90/Pdt.G/2020/PA.Ctt", "50/AC/2020/PA.Ctt", "sebelumnya"],
      ["100/Pdt.G/2026/PA.Ctt", "12/AC/2026/PA.Ctt", "perkara ini"],
    ]);
    // Yang tidak berakta tetap perkara TERKAIT - hanya tidak dihitung cerai.
    expect(istri.jumlahTerkait).toBe(5);
    expect(istri.terkait.find((x) => x.nomorPerkara.startsWith("91/"))?.keadaan).toBe("Dicabut");
  });

  it("perkara ini yang belum berakta tidak dihitung", () => {
    const [istri] = susun({
      lain: [[90, keterangan(90, { nomorAkta: "50/AC/2020/PA.Ctt", tanggalAkta: "2020-06-10" })]],
      kemunculan: [{ perkaraId: 90, pihakId: 11, pihakKe: 1 }],
    });
    expect(istri.ceraiBerakta).toBe(1);
    expect(istri.cerai.map((x) => x.arah)).toEqual(["sebelumnya"]);
  });

  it("perkara ini yang berakta dihitung untuk KEDUA pihaknya", () => {
    const [istri, suami] = susun({ infoIni: { nomorAkta: "12/AC/2026/PA.Ctt", tanggalAkta: "2026-06-01" } });
    expect(istri.ceraiBerakta).toBe(1);
    expect(suami.ceraiBerakta).toBe(1);
    expect(suami.cerai[0].kedudukan).toBe("Tergugat");
    expect(suami.cerai[0].dasar.tingkat).toBe("perkara_ini");
  });

  it("berakta tetapi orang itu turut tergugat di sana: perkara terkait, BUKAN cerainya", () => {
    const [istri] = susun({
      lain: [[95, keterangan(95, { nomorAkta: "9/AC/2021/PA.Ctt", tanggalAkta: "2021-03-03" })]],
      kemunculan: [{ perkaraId: 95, pihakId: 11, pihakKe: 4 }],
    });
    expect(istri.ceraiBerakta).toBe(0);
    expect(istri.terkait.map((x) => x.kedudukan)).toEqual(["Turut Tergugat"]);
  });
});

describe("sebelum dan sesudah, kedudukan, dan dasar pencocokan", () => {
  it("menurut tanggal pendaftaran; tanggal sama menurut nomor urut SIPP", () => {
    const [istri] = susun({
      lain: [
        [80, keterangan(80, { tanggalDaftar: "2027-01-05", jenisPerkaraId: 348, jenisPerkara: "Harta Bersama", statusPutusan: "" })],
        [99, keterangan(99, { tanggalDaftar: "2026-03-01" })],
        [120, keterangan(120, { tanggalDaftar: "2026-03-01" })],
        [70, keterangan(70, { tanggalDaftar: "2019-02-02" })],
      ],
      kemunculan: [80, 99, 120, 70].map((perkaraId) => ({ perkaraId, pihakId: 11, pihakKe: 1 })),
    });
    expect(istri.terkait.map((x) => [x.perkaraId, x.arah])).toEqual([
      ["70", "sebelumnya"],
      ["99", "sebelumnya"],
      ["120", "sesudahnya"],
      ["80", "sesudahnya"],
    ]);
    expect(istri.terkait.find((x) => x.perkaraId === "80")?.jenisPerkara).toBe("Harta Bersama");
  });

  it("sebutan kedudukan mengikuti jenis perkara di SANA - Pemohon pada cerai talak", () => {
    const [, suami] = susun({
      lain: [[60, keterangan(60, { jenisPerkaraId: 346, jenisPerkara: "Cerai Talak" })]],
      kemunculan: [{ perkaraId: 60, pihakId: 12, pihakKe: 1 }],
    });
    expect(suami.terkait[0].kedudukan).toBe("Pemohon");
    expect(suami.kedudukan).toBe("Tergugat");
  });

  it("jalan yang lebih pasti menang: perkara yang sama lewat NIK dan pasangan tercatat NIK", () => {
    const [istri] = susun({
      lain: [[90, keterangan(90)]],
      orangSama: new Map([[11, new Map([[31, "nik"]])]]),
      kemunculan: [{ perkaraId: 90, pihakId: 31, pihakKe: 1 }],
      pasangan: [
        { asalPihakId: 11, perkaraId: 90, pihakKe: 1, pihakIdCocok: 31, pasangan: "RAHMAT BIN LAMBOGO", berhadapan: true, lahirBerbeda: false },
      ],
    });
    expect(istri.terkait).toHaveLength(1);
    expect(istri.terkait[0].dasar.tingkat).toBe("nik");
    expect(istri.terkait[0].dasar.label).toBe("NIK sama");
  });

  it("baris yang cocok lewat pasangan: kemunculan LAINNYA ikut, perantaranya disebut", () => {
    const [istri, suami] = susun({
      lain: [
        [90, keterangan(90, { nomorPerkara: "90/Pdt.P/2017/PA.Ctt", jenisPerkaraId: 360, alurPerkaraId: 16, jenisPerkara: "Istbat Nikah", statusPutusan: "Dikabulkan" })],
        [91, keterangan(91, { nomorAkta: "5/AC/2017/PA.Ctt", tanggalAkta: "2017-08-01" })],
      ],
      kemunculan: [
        { perkaraId: 90, pihakId: 41, pihakKe: 1 },
        { perkaraId: 91, pihakId: 41, pihakKe: 1 },
      ],
      pasangan: [
        { asalPihakId: 11, perkaraId: 90, pihakKe: 1, pihakIdCocok: 41, pasangan: "RAHMAT BIN LAMBOGO", berhadapan: false, lahirBerbeda: true },
      ],
    });
    expect(istri.terkait.map((x) => x.perkaraId)).toEqual(["90", "91"]);
    const lewat = istri.terkait.find((x) => x.perkaraId === "91")!;
    expect(lewat.dasar.tingkat).toBe("pasangan");
    expect(lewat.dasar.label).toContain("di 90/Pdt.P/2017/PA.Ctt");
    expect(lewat.dasar.catatan).toMatch(/tanggal lahir tercatat berbeda/);
    expect(istri.ceraiBerakta).toBe(1);
    // Suami tidak ikut mendapat temuan milik istri - pasangan dicatat per
    // orang, menurut asalPihakId-nya.
    expect(suami.jumlahTerkait).toBe(0);
    expect(suami.ceraiBerakta).toBe(0);
  });

  it("kemunculan orang yang tidak lolos pengenal tidak pernah menjadi temuan", () => {
    const [istri] = susun({
      lain: [[90, keterangan(90, { nomorAkta: "50/AC/2020/PA.Ctt", tanggalAkta: "2020-06-10" })]],
      // Baris 99 muncul di perkara 90, tetapi tidak ada di orangSama maupun
      // pasangan - misalnya orang senama yang tanggal lahirnya berbeda.
      kemunculan: [{ perkaraId: 90, pihakId: 99, pihakKe: 1 }],
    });
    expect(istri.jumlahTerkait).toBe(0);
    expect(istri.ceraiBerakta).toBe(0);
  });
});

// ===========================================================================
// 6. JAWABAN RUTE
// ===========================================================================

describe("jawaban rute /sipp/riwayat-pihak", () => {
  it("masukan kosong atau tidak sah: 400, tanpa satu kueri pun", async () => {
    for (const q of [{}, { perkaraId: "abc" }, { perkaraId: "0" }, { perkaraId: "-5" }]) {
      const hasil = await L.jawabRute(q);
      expect(hasil.status, JSON.stringify(q)).toBe(400);
      expect(hasil.body.ok).toBe(false);
    }
    expect(catatan).toHaveLength(0);
  });

  it("perkara tidak ada: 404 dengan alasan yang terbaca", async () => {
    jawab = () => [];
    const hasil = await L.jawabRute({ perkaraId: "123456" });
    expect(hasil.status).toBe(404);
    expect(hasil.body).toMatchObject({ ok: false, kode: "perkara_tidak_ada" });
    expect(String(hasil.body.alasan)).toMatch(/tidak ditemukan/);
    // Yang ditanyakan memang perkara itu, lewat id-nya.
    expect(catatan[0].nilai).toEqual([123456]);
  });

  it("SIPP error: 500, errornya disebut - bukan dijadikan daftar kosong", async () => {
    jawab = () => {
      throw new Error("Table 'sipp.perkara' doesn't exist");
    };
    const hasil = await L.jawabRute({ nomorPerkara: "1/Pdt.G/2026/PA.Ctt" });
    expect(hasil.status).toBe(500);
    expect(String(hasil.body.alasan)).toContain("doesn't exist");
  });

  it("perkara tanpa pihak: 200 dengan daftar kosong, tanpa pencarian lanjutan", async () => {
    jawab = (sql) => (/FROM perkara pk\s+WHERE pk\.perkara_id = \?/.test(sql) ? [{ perkaraId: 5, nomorPerkara: "5/Pdt.G/2026/PA.Ctt" }] : []);
    const hasil = await L.jawabRute({ perkaraId: "5" });
    expect(hasil.status).toBe(200);
    expect(hasil.body).toMatchObject({ ok: true, pihak: [] });
    expect(catatan).toHaveLength(2);
  });
});
