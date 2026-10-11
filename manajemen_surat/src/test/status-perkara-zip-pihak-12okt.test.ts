// @vitest-environment node

import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FOLDER_KATEGORI_ARSIP,
  KATEGORI_ARSIP,
  KATEGORI_SEMUA,
  kategoriDariNama,
  uraiKategoriArsip,
} from "@/lib/kategori-zip";

/**
 * ============================================================================
 * STATUS PERKARA, 12 OKTOBER 2026 - butir 10 (ZIP tidak lengkap), 11 (pilih isi
 * ZIP), dan 12 (email, WhatsApp, kesediaan e-Litigasi pada Para Pihak)
 * ============================================================================
 *
 * Yang diuji PERILAKUNYA: penyusun ZIP dijalankan dengan gateway palsu yang
 * meniru bentuk perkara 273/Pdt.G/2026/PA.Dgl (dibaca dari sipp_donggala:
 * 54 relaas, 44 resi, 10 BAS, 6 penetapan, 10 dokumen e-Court), ZIP-nya dibuka,
 * dan layanan bot kontak dijalankan sungguhan.
 *
 * SEBAB ASLI butir 10 (jejak audit 7 Oktober: jumlahBerkas 66, totalByte
 * 209.690.308, jumlahDilewati 74): batas ukuran 200 MB (209.715.200 byte) habis
 * oleh pemindaian relaas/resi, sehingga BAS, penetapan, dan e-Court - yang
 * datang sesudahnya - ditolak "melewati batas ukuran ZIP".
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
type Apa = any;

// ============================================================================
// PEMBACA ZIP (metode simpan apa adanya)
// ============================================================================
function bacaZip(arsip: Buffer): Map<string, Buffer> {
  const isi = new Map<string, Buffer>();
  const letakPenutup = arsip.length - 22;
  if (letakPenutup < 0 || arsip.readUInt32LE(letakPenutup) !== 0x06054b50) {
    throw new Error("penutup ZIP tidak ditemukan");
  }
  const jumlah = arsip.readUInt16LE(letakPenutup + 10);
  let letak = arsip.readUInt32LE(letakPenutup + 16);
  for (let i = 0; i < jumlah; i += 1) {
    if (arsip.readUInt32LE(letak) !== 0x02014b50) throw new Error(`daftar isi rusak pada entri ${i}`);
    const panjangNama = arsip.readUInt16LE(letak + 28);
    const panjangTambahan = arsip.readUInt16LE(letak + 30);
    const panjangKeterangan = arsip.readUInt16LE(letak + 32);
    const besar = arsip.readUInt32LE(letak + 24);
    const letakLokal = arsip.readUInt32LE(letak + 42);
    const nama = arsip.subarray(letak + 46, letak + 46 + panjangNama).toString("utf8");
    const namaLokal = arsip.readUInt16LE(letakLokal + 26);
    const tambahanLokal = arsip.readUInt16LE(letakLokal + 28);
    const awalData = letakLokal + 30 + namaLokal + tambahanLokal;
    isi.set(nama, arsip.subarray(awalData, awalData + besar));
    letak += 46 + panjangNama + panjangTambahan + panjangKeterangan;
  }
  return isi;
}

/** Pengurai CSV yang menghormati kutip. */
function uraiCsv(teks: string): string[][] {
  const bersih = teks.charCodeAt(0) === 0xfeff ? teks.slice(1) : teks;
  const baris: string[][] = [];
  let ruas: string[] = [];
  let kini = "";
  let dalamKutip = false;
  for (let i = 0; i < bersih.length; i += 1) {
    const c = bersih[i];
    if (dalamKutip) {
      if (c === '"') {
        if (bersih[i + 1] === '"') {
          kini += '"';
          i += 1;
        } else dalamKutip = false;
      } else kini += c;
      continue;
    }
    if (c === '"') dalamKutip = true;
    else if (c === ",") {
      ruas.push(kini);
      kini = "";
    } else if (c === "\r") continue;
    else if (c === "\n") {
      ruas.push(kini);
      baris.push(ruas);
      ruas = [];
      kini = "";
    } else kini += c;
  }
  if (kini !== "" || ruas.length > 0) {
    ruas.push(kini);
    baris.push(ruas);
  }
  return baris;
}

// ============================================================================
// GATEWAY PALSU
// ============================================================================
type JawabanBerkas = (jenis: string, id: string, signal?: AbortSignal) => Promise<Response>;

const keadaan = vi.hoisted(() => ({
  status: null as unknown,
  rincian: null as unknown,
  arsip: null as unknown,
  berkasSipp: null as unknown,
  berkasEcourt: null as unknown,
  panggilanSipp: [] as string[],
  panggilanStatus: 0,
  panggilanRincian: 0,
  panggilanArsip: 0,
  kontak: null as unknown,
  audit: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async () => ({ name: "Penguji" }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt_uji" }));
vi.mock("@/server/shared/audit", () => ({
  appendAuditLog: async (_db: unknown, isi: Record<string, unknown>) => {
    keadaan.audit.push(isi);
  },
}));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
// RINGKASAN.txt memakai bentuk status penuh dari bot; di sini statusnya seperlunya.
vi.mock("@/lib/ringkas-status", () => ({
  ringkasStatus: () => ({ keadaan: "", umurKalimat: "", berikutnya: "", majelisKalimat: "", peringatan: [] }),
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewayStatusPerkara: async () => {
    keadaan.panggilanStatus += 1;
    return keadaan.status;
  },
  getGatewayRincianSidang: async () => {
    keadaan.panggilanRincian += 1;
    return keadaan.rincian;
  },
  getGatewayArsipRincian: async () => {
    keadaan.panggilanArsip += 1;
    return keadaan.arsip;
  },
  ambilBerkasSippGateway: async (jenis: string, id: string, signal?: AbortSignal) => {
    keadaan.panggilanSipp.push(`${jenis}:${id}`);
    return (keadaan.berkasSipp as JawabanBerkas)(jenis, id, signal);
  },
  ambilBerkasGateway: async (kunci: string, bentuk: string, signal?: AbortSignal) =>
    (keadaan.berkasEcourt as JawabanBerkas)(kunci, bentuk, signal),
  getGatewayKontakParaPihak: async () => keadaan.kontak,
}));

function jawabBerkas(isi: string | Buffer, namaBerkas: string): Response {
  return new Response((typeof isi === "string" ? new TextEncoder().encode(isi) : isi) as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="${encodeURIComponent(namaBerkas)}"`,
    },
  });
}

const NOMOR = "273/Pdt.G/2026/PA.Dgl";

/** statusPerkara seperlunya: penetapan (6, seperti sipp_donggala) dan arsip kosong. */
function statusPalsu(ubah: Record<string, unknown> = {}) {
  return {
    ok: true,
    identitas: { nomorPerkara: NOMOR, perkaraId: "9729", jenisPerkara: "Cerai Gugat" },
    tahapan: {
      terbaca: true,
      alasan: "",
      tahap: ["PJS", "PMH", "PHS", "PMH", "PPP", "PPP"].map((label, i) => ({
        kunci: `t${i}`,
        label,
        tanggal: `2026-04-2${i}`,
        adaBerkas: true,
        dokumenId: String(2370 + i),
      })),
    },
    ikrarTalak: { terbaca: true, ada: false },
    arsipKeterangan: { terbaca: true, berkasTerbaca: true, alasanBerkas: "", baris: [] },
    ...ubah,
  };
}

/** rincianSidang berbentuk perkara 273: 12+10+9+10+13 relaas, 10 BAS, gugatan. */
function rincian273() {
  const relaas = Array.from({ length: 54 }, (_, i) => ({
    id: String(13329 + i),
    sidangId: "18989",
    tanggalRelaas: `2026-05-${String((i % 28) + 1).padStart(2, "0")}`,
    peran: i % 2 ? "Tergugat" : "Penggugat",
    namaPihak: `Pihak ${i}`,
    // 44 dari 54 berresi - sama dengan sipp_donggala
    adaDokumen: true,
    adaResi: i < 44,
  }));
  const jadwalPerkara = Array.from({ length: 10 }, (_, i) => ({
    urutanSidang: i + 1,
    sidangId: String(18989 + i),
    tanggalSidang: `2026-0${(i % 9) + 1}-10`,
    agenda: i === 7 ? "Pembuktian Penggugat dan Panggil para Tergugat" : `Agenda ${i + 1}`,
    adaBas: true,
  }));
  return {
    ok: true,
    data: {
      ok: true,
      perkaraId: "9729",
      petitum: { ada: true, berkas: "x_petitum.docx" },
      relaas,
      jadwalPerkara,
      putusan: { adaBerkasPutusan: false, adaBerkasAnonim: false, tanggalPutusan: "" },
      dokumenSipp: [],
    },
  };
}

/** Arsip e-Court perkara 273: 10 dokumen, 12 berkas (dari aleta_bot lokal). */
function arsip273() {
  const dok = (documentKey: string, judulDokumen: string, jenisDokumen: string, adaPdf: boolean, adaWord: boolean) => ({
    documentKey,
    judulDokumen,
    jenisDokumen,
    adaPdf,
    adaWord,
  });
  return {
    ok: true,
    data: {
      nomorPerkara: NOMOR,
      dokumen: [
        dok("k1", "Replik Penggugat", "Replik", true, true),
        dok("k2", "KTP", "", true, false),
        dok("k3", "SURAT GUGATAN (Docx/Rtf)", "", false, true),
        dok("k4", "Surat Gugatan", "", true, false),
        dok("k5", "Berita Acara Penyumpahan", "", true, false),
        dok("k6", "Jawaban Para Tergugat 237 G", "Jawaban", true, true),
        dok("k7", "tergugat", "Duplik", true, true),
        dok("k8", "Surat Kuasa Khusus", "", true, false),
        dok("k9", "Kartu Tanda Anggota", "", true, false),
        dok("k10", "Alat Bukti Surat", "", true, false),
      ],
    },
  };
}

async function jalankan(kueri: string) {
  vi.resetModules();
  const mod = await import("@/app/api/aleta-ecourt/berkas-zip/route");
  const permintaan = { nextUrl: new URL(`http://uji.local/api/aleta-ecourt/berkas-zip${kueri}`) };
  return mod.GET(permintaan as unknown as Parameters<typeof mod.GET>[0]);
}

async function ambilZip(kueri: string) {
  const jawaban = await jalankan(kueri);
  expect(jawaban.status, await jawaban.clone().text().catch(() => "")).toBe(200);
  return { isi: bacaZip(Buffer.from(await jawaban.arrayBuffer())), kepala: jawaban.headers };
}

beforeEach(() => {
  keadaan.status = { ok: true, data: statusPalsu() };
  keadaan.rincian = rincian273();
  keadaan.arsip = arsip273();
  keadaan.berkasSipp = async (jenis: string, id: string) => jawabBerkas(`isi ${jenis} ${id}`, `${jenis}-${id}.pdf`);
  keadaan.berkasEcourt = async (kunci: string, bentuk: string) => jawabBerkas(`isi ${kunci} ${bentuk}`, `${kunci}.pdf`);
  keadaan.panggilanSipp = [];
  keadaan.panggilanStatus = 0;
  keadaan.panggilanRincian = 0;
  keadaan.panggilanArsip = 0;
  keadaan.audit = [];
  delete process.env.ALETA_ZIP_MAKS_BERKAS;
  delete process.env.ALETA_ZIP_MAKS_BYTE;
});

afterEach(() => {
  delete process.env.ALETA_ZIP_MAKS_BERKAS;
  delete process.env.ALETA_ZIP_MAKS_BYTE;
});

// ============================================================================
// BUTIR 10 - SEMUA BERKAS MASUK
// ============================================================================
describe("butir 10 - ZIP Status Perkara memuat SEMUA berkas perkara", () => {
  it("batas 200 MB lama TIDAK lagi membuang BAS, penetapan, dan e-Court (regresi 273/Pdt.G/2026/PA.Dgl)", async () => {
    // Tiga relaas 70 MB = 210 MB > 209.715.200 byte: persis yang menghabiskan
    // batas lama pada 7 Oktober 2026 (totalByte 209.690.308).
    const BESAR = Buffer.alloc(70 * 1024 * 1024, 7);
    keadaan.berkasSipp = async (jenis: string, id: string) =>
      jenis === "relaas" && Number(id) < 13332 ? jawabBerkas(BESAR, `relaas-${id}.pdf`) : jawabBerkas(`isi ${jenis} ${id}`, `${jenis}-${id}.pdf`);

    vi.resetModules();
    const { susunArsipPerkara, BATAS_TOTAL_BYTE } = await import("@/server/modules/aleta-ecourt/susun-arsip-perkara");
    const nama: string[] = [];
    let totalAlir = 0;
    const hasil = await susunArsipPerkara({
      nomor: NOMOR,
      sumber: "semua",
      lengkap: true,
      sertakanArsip: false,
      alir: {
        kirim(berkas) {
          nama.push(berkas.nama);
          totalAlir += berkas.isi.byteLength;
        },
      },
    });

    // Bukti bahwa uji ini memang melewati batas lama.
    expect(totalAlir).toBeGreaterThan(BATAS_TOTAL_BYTE);

    // Seluruh 10 BAS, 6 penetapan, gugatan, 54 relaas + 44 resi, dan 12 berkas e-Court ikut.
    expect(nama.filter((x) => x.startsWith("03 BAS/"))).toHaveLength(10);
    expect(nama.filter((x) => x.startsWith("07 Penetapan/"))).toHaveLength(6);
    expect(nama.filter((x) => x.startsWith("01 Gugatan/"))).toHaveLength(1);
    expect(nama.filter((x) => x.startsWith("02 Relaas/") && !x.startsWith("02 Relaas/Resi pos/"))).toHaveLength(54);
    expect(nama.filter((x) => x.startsWith("02 Relaas/Resi pos/"))).toHaveLength(44);
    // 10 dokumen: 3 berbentuk pdf+word (Replik, Jawaban, Duplik) + 7 satu bentuk = 13 berkas.
    expect(nama.filter((x) => x.startsWith("06 e-Court/"))).toHaveLength(13);
    expect(nama.filter((x) => x.startsWith("00 Data SIPP/")).length).toBeGreaterThanOrEqual(26);

    // Tidak satu pun yang gagal diambil, dan tidak satu pun "melewati batas".
    expect(hasil.gagal?.filter((g) => g.status === "gagal")).toEqual([]);
    expect(hasil.dilewati.some((x) => /melewati batas/.test(x))).toBe(false);
    // Daftar isi + keterangan ikut.
    expect(nama).toContain("DAFTAR ISI.txt");
    expect(nama).toContain("DAFTAR ISI.csv");
    expect(nama).toContain("KETERANGAN.txt");
  }, 120_000);

  it("SEBAB ASLI terbukti: dengan batas 200 MB lama yang diberlakukan, BAS dan e-Court ikut terbuang", async () => {
    // Skala 1:10 dari kejadian 7 Oktober: batas 20 MB (bukan 200 MB), dua relaas besar
    // yang menghabiskan jatah sampai ~100 KB di bawah batas, lalu berkas kecil sesudahnya.
    const BATAS = 20 * 1024 * 1024;
    const A = Buffer.alloc(10 * 1024 * 1024, 7);
    const B = Buffer.alloc(BATAS - A.length - 100 * 1024, 7);
    keadaan.berkasSipp = async (jenis: string, id: string) =>
      jenis === "relaas" && id === "13329"
        ? jawabBerkas(A, `relaas-${id}.pdf`)
        : jenis === "relaas" && id === "13357"
          ? jawabBerkas(B, `relaas-${id}.pdf`)
          : jawabBerkas(Buffer.alloc(30 * 1024, 1), `${jenis}-${id}.pdf`);
    vi.resetModules();
    const { susunArsipPerkara } = await import("@/server/modules/aleta-ecourt/susun-arsip-perkara");
    const nama: string[] = [];
    const hasil = await susunArsipPerkara({
      nomor: NOMOR,
      sumber: "semua",
      lengkap: true,
      sertakanArsip: false,
      batasTotalByte: BATAS, // batas bergaya lama
      alir: { kirim: (b) => void nama.push(b.nama) },
    });

    const gagalBatas = (hasil.gagal ?? []).filter((g) => /melewati batas ukuran ZIP/.test(g.sebab));
    expect(gagalBatas.length).toBeGreaterThan(0);
    expect(gagalBatas.some((g) => g.kategori === "bas")).toBe(true);
    expect(nama.filter((x) => x.startsWith("03 BAS/")).length).toBeLessThan(10);
  }, 120_000);

  it("batas jalur alir di bawah batas ZIP32, dan dapat disetel - tidak pernah di atasnya", async () => {
    vi.resetModules();
    process.env.ALETA_ZIP_MAKS_BYTE = String(100 * 1024 * 1024 * 1024);
    const mod = await import("@/server/modules/aleta-ecourt/susun-arsip-perkara");
    expect(mod.BATAS_TOTAL_BYTE_ALIR).toBeLessThan(4 * 1024 * 1024 * 1024);
    expect(mod.BATAS_TOTAL_BYTE_ALIR).toBeGreaterThan(1024 * 1024 * 1024);
    expect(mod.BATAS_BERKAS_ALIR).toBeLessThan(65_535);
    // Jalur yang menampung isi di memori tetap 200 MB.
    expect(mod.BATAS_TOTAL_BYTE).toBe(200 * 1024 * 1024);
  });

  it("DAFTAR ISI.csv memuat yang MASUK dan yang GAGAL beserta sebabnya - tidak hilang diam-diam", async () => {
    keadaan.berkasSipp = async (jenis: string, id: string) => {
      if (jenis === "bas" && id === "18990") {
        return new Response(JSON.stringify({ ok: false, alasan: "berkas_tidak_ditemukan_di_server" }), { status: 404 });
      }
      if (jenis === "relaas" && id === "13329") throw new Error("The operation was aborted");
      return jawabBerkas(`isi ${jenis} ${id}`, `${jenis}-${id}.pdf`);
    };
    keadaan.berkasEcourt = async (kunci: string) => {
      if (kunci === "k5") return new Response("{}", { status: 500 });
      return jawabBerkas(`isi ${kunci}`, `${kunci}.pdf`);
    };

    const { isi } = await ambilZip(`?nomor=${NOMOR}&isi=lengkap`);
    const tabel = uraiCsv(isi.get("DAFTAR ISI.csv")!.toString("utf8"));
    const kepala = tabel[0];
    expect(kepala).toEqual(["kategori", "berkas", "jenis", "tanggal", "asal", "ukuran_byte", "status", "sebab"]);
    const baris = tabel.slice(1).map((r) => Object.fromEntries(kepala.map((k, i) => [k, r[i]])));

    const gagal = baris.filter((r) => r.status === "gagal");
    expect(gagal.map((r) => r.kategori).sort()).toEqual(["bas", "ecourt", "relaas"]);
    const bas = gagal.find((r) => r.kategori === "bas")!;
    // Uraian yang dibaca orang, nomor barisnya, dan kalimat sebabnya.
    expect(bas.berkas).toContain("BAS sidang ke-2");
    expect(bas.berkas).toContain("[bas #18990]");
    expect(bas.sebab).toContain("HTTP 404");
    expect(bas.sebab).toContain("berkas_tidak_ditemukan_di_server");
    expect(bas.sebab).toContain("periksa mount SIPP");
    expect(gagal.find((r) => r.kategori === "relaas")!.sebab).toBe("The operation was aborted");
    expect(gagal.find((r) => r.kategori === "ecourt")!.sebab).toBe("HTTP 500");

    // Yang masuk tercatat "masuk" dengan ukurannya; BAS lain ada.
    const masuk = baris.filter((r) => r.status === "masuk");
    expect(masuk.filter((r) => r.kategori === "bas")).toHaveLength(9);
    expect(Number(masuk.find((r) => r.kategori === "bas")!.ukuran_byte)).toBeGreaterThan(0);

    // KETERANGAN.txt dan DAFTAR ISI.txt menyebutnya juga.
    const keterangan = isi.get("KETERANGAN.txt")!.toString("utf8");
    expect(keterangan).toContain("TIDAK IKUT DIKEMAS:");
    expect(keterangan).toContain("BAS sidang ke-2");
    expect(isi.get("DAFTAR ISI.txt")!.toString("utf8")).toContain("TERCATAT TETAPI TIDAK IKUT (3)");

    // Jejak audit menyebut hitungan dan sebab gagal.
    const a = keadaan.audit.find((x) => x.action === "ECOURT_PERKARA_ZIP_LENGKAP");
    expect((a?.payload as Apa).jumlahGagal).toBe(3);
  });

  it("jalur yang menampung isi (Drive) tetap menyebut berkas yang melewati batas ukuran - dan sebabnya", async () => {
    vi.resetModules();
    const { susunArsipPerkara } = await import("@/server/modules/aleta-ecourt/susun-arsip-perkara");
    keadaan.berkasSipp = async (jenis: string, id: string) => jawabBerkas(Buffer.alloc(600, 1), `${jenis}-${id}.pdf`);
    const hasil = await susunArsipPerkara({
      nomor: NOMOR,
      sumber: "sipp",
      lengkap: false,
      sertakanArsip: false,
      batasTotalByte: 1000,
    });
    const gagal = (hasil.gagal ?? []).filter((g) => g.status === "gagal");
    expect(gagal.length).toBeGreaterThan(0);
    expect(gagal[0].sebab).toContain("melewati batas ukuran ZIP");
    expect(hasil.dilewati.length).toBe((hasil.gagal ?? []).length);
  });

  it("e-Court tersusun per JENIS: subfolder dari jenis resmi, atau dari judul bila jenisnya kosong", async () => {
    const { isi } = await ambilZip(`?nomor=${NOMOR}&isi=lengkap&sumber=ecourt`);
    const ec = [...isi.keys()].filter((x) => x.startsWith("06 e-Court/"));
    const sub = new Set(ec.map((x) => x.split("/")[1]));
    expect(sub).toEqual(
      new Set(["Replik", "Jawaban", "Duplik", "Gugatan dan permohonan", "Surat kuasa", "Alat bukti"])
    );
    expect(ec).toContain("06 e-Court/Replik/01 - Replik Penggugat.pdf");
    expect(ec).toContain("06 e-Court/Replik/01 - Replik Penggugat (word).pdf");
    // KTP, Kartu Tanda Anggota, Berita Acara Penyumpahan, Alat Bukti: kelompok yang sama.
    expect(ec.filter((x) => x.startsWith("06 e-Court/Alat bukti/")).length).toBe(4);
  });
});

// ============================================================================
// BUTIR 11 - PILIH ISI ZIP
// ============================================================================
describe("butir 11 - memilih isi ZIP", () => {
  it("uraiKategoriArsip: kosong = lama, semua = tanpa arsip fisik, kunci asing dibuang, semuanya asing = kosong", () => {
    expect(uraiKategoriArsip(null)).toBeNull();
    expect(uraiKategoriArsip("")).toBeNull();
    expect(uraiKategoriArsip("semua")).toEqual([...KATEGORI_SEMUA]);
    expect(KATEGORI_SEMUA).not.toContain("arsip");
    expect(uraiKategoriArsip("bas, relaas;ecourt")).toEqual(["relaas", "bas", "ecourt"]);
    expect(uraiKategoriArsip("bas,ngawur")).toEqual(["bas"]);
    expect(uraiKategoriArsip("ngawur")).toEqual([]);
    expect(uraiKategoriArsip("semua,arsip")).toEqual([...KATEGORI_ARSIP]);
  });

  it("kategoriDariNama dan folder tiap kategori satu sumber", () => {
    for (const k of KATEGORI_ARSIP) {
      expect(kategoriDariNama(`${FOLDER_KATEGORI_ARSIP[k]}/x.pdf`)).toBe(k);
    }
    expect(kategoriDariNama("RINGKASAN.txt")).toBe("data");
    expect(kategoriDariNama("KETERANGAN.txt")).toBe("umum");
  });

  it("BAS saja: hanya folder 03 BAS (+ daftar isi), relaas tidak ditarik sama sekali", async () => {
    const { isi, kepala } = await ambilZip(`?nomor=${NOMOR}&isi=lengkap&kategori=bas`);
    const nama = [...isi.keys()];
    const berkas = nama.filter((x) => !["DAFTAR ISI.txt", "DAFTAR ISI.csv", "KETERANGAN.txt"].includes(x));
    expect(berkas).toHaveLength(10);
    expect(berkas.every((x) => x.startsWith("03 BAS/"))).toBe(true);
    // Tidak ada data CSV, tidak ada relaas, dan bot tidak ditanyai yang tidak diminta.
    expect(keadaan.panggilanSipp.every((x) => x.startsWith("bas:"))).toBe(true);
    expect(keadaan.panggilanStatus).toBe(0);
    expect(keadaan.panggilanArsip).toBe(0);
    // Nama ZIP menyebut pilihannya; KETERANGAN menyebut kategori yang diminta.
    expect(decodeURIComponent(kepala.get("Content-Disposition")!)).toContain("perkara-273-Pdt.G-2026-PA.Dgl-bas.zip");
    expect(isi.get("KETERANGAN.txt")!.toString("utf8")).toContain("Kategori yang diminta: BAS (berita acara sidang)");
  });

  it("relaas saja (dengan resi pos)", async () => {
    const { isi } = await ambilZip(`?nomor=${NOMOR}&isi=lengkap&kategori=relaas`);
    const berkas = [...isi.keys()].filter((x) => !/^(DAFTAR ISI|KETERANGAN)/.test(x));
    expect(berkas.every((x) => x.startsWith("02 Relaas/"))).toBe(true);
    expect(berkas.filter((x) => x.startsWith("02 Relaas/Resi pos/"))).toHaveLength(44);
    expect(berkas).toHaveLength(54 + 44);
  });

  it("e-Court dan Lainnya (lampiran SIPP) tanpa yang lain; penetapan menarik status perkara tetapi tanpa folder 00", async () => {
    keadaan.rincian = {
      ...(rincian273() as Apa),
      data: { ...(rincian273() as Apa).data, dokumenSipp: [{ id: "55", namaDokumen: "Surat Lain", namaFile: "lain.pdf" }] },
    };
    const a = await ambilZip(`?nomor=${NOMOR}&isi=lengkap&kategori=ecourt,lainnya`);
    const namaA = [...a.isi.keys()].filter((x) => !/^(DAFTAR ISI|KETERANGAN)/.test(x));
    expect(namaA.some((x) => x.startsWith("06 e-Court/"))).toBe(true);
    expect(namaA.some((x) => x.startsWith("05 Lampiran/"))).toBe(true);
    expect(namaA.every((x) => x.startsWith("06 e-Court/") || x.startsWith("05 Lampiran/"))).toBe(true);

    keadaan.panggilanStatus = 0;
    const b = await ambilZip(`?nomor=${NOMOR}&kategori=penetapan`); // tanpa isi=lengkap: tetap lengkap
    const namaB = [...b.isi.keys()].filter((x) => !/^(DAFTAR ISI|KETERANGAN)/.test(x));
    expect(keadaan.panggilanStatus).toBe(1);
    expect(namaB).toHaveLength(6);
    expect(namaB.every((x) => x.startsWith("07 Penetapan/"))).toBe(true);
  });

  it("data SIPP saja: 26 CSV + JSON, tanpa berkas satu pun ditarik", async () => {
    const { isi } = await ambilZip(`?nomor=${NOMOR}&isi=lengkap&kategori=data`);
    const berkas = [...isi.keys()].filter((x) => !/^(DAFTAR ISI|KETERANGAN)/.test(x));
    expect(berkas.every((x) => x.startsWith("00 Data SIPP/") || x === "RINGKASAN.txt")).toBe(true);
    expect(keadaan.panggilanSipp).toEqual([]);
    expect(keadaan.panggilanRincian).toBe(0);
  });

  it("kategori yang tidak dikenali dijawab 400, bukan ZIP kosong; tanpa kategori = perilaku lama", async () => {
    const salah = await jalankan(`?nomor=${NOMOR}&isi=lengkap&kategori=ngawur`);
    expect(salah.status).toBe(400);
    expect((await salah.json()).alasan).toBe("kategori_tidak_dikenali");

    const { isi, kepala } = await ambilZip(`?nomor=${NOMOR}&isi=lengkap`);
    expect(decodeURIComponent(kepala.get("Content-Disposition")!)).toContain("perkara-273-Pdt.G-2026-PA.Dgl.zip");
    expect([...isi.keys()].some((x) => x.startsWith("03 BAS/"))).toBe(true);
    expect([...isi.keys()].some((x) => x.startsWith("00 Data SIPP/"))).toBe(true);
  });

  it("kategori arsip menggantikan arsipFisik=1 (arsip fisik hanya bila disebut)", async () => {
    const { isi } = await ambilZip(`?nomor=${NOMOR}&isi=lengkap&kategori=semua`);
    expect(isi.get("KETERANGAN.txt")!.toString("utf8")).not.toContain("08 Arsip fisik: diminta");
    // Arsip fisik disebut tetapi perkara ini tidak punya berkas pindaian: 404 yang MENJELASKAN,
    // bukan ZIP kosong yang tampak berhasil.
    const dengan = await jalankan(`?nomor=${NOMOR}&isi=lengkap&kategori=arsip`);
    expect(dengan.status).toBe(404);
    expect(JSON.stringify((await dengan.json()).keterangan)).toContain("08 Arsip fisik: diminta");
  });
});

// ============================================================================
// BUTIR 12 - KONTAK PARA PIHAK (layanan bot sungguhan, bahan tiruan)
// ============================================================================
const K: Apa = muat(path.join(AKAR, "aleta_bot/services/kontakEcourtService.js"));

function bahanDua() {
  // Penggugat (SIPP: email + HP), Tergugat (SIPP kosong), kuasa Tergugat (SIPP email saja).
  return K.susunKontak({
    pihak: [
      { pihakKe: 1, urutan: 1, pihakId: 1, nama: "RINA WATI binti AHMAD", email: "Rina.Wati@Yahoo.co.id", telepon: "0852-1111-3333" },
      { pihakKe: 2, urutan: 1, pihakId: 2, nama: "JOKO bin SAMIN", email: "", telepon: "" },
    ],
    kuasa: [{ pihakKe: 2, urutan: 1, pengacaraId: 9, nama: "SITI RAHMAWATI, S.H.", email: "kantor.siti@gmail.com", telepon: "-" }],
    ecourtPihak: [
      { nama: "JOKO bin SAMIN", peran: "Tergugat", email: "joko.samin@gmail.com", telp: "+62 853 4444 5555" },
      { nama: "RINA WATI binti AHMAD", peran: "Penggugat", email: "rina.lain@gmail.com", telp: "" },
    ],
    pengunggah: [],
    dokumen: [],
  });
}

describe("butir 12 - kontak para pihak (susunKontakStatus)", () => {
  it("SIPP lebih dulu dengan tanda sumber; e-Court mengisi yang kosong; yang berbeda disebut juga", () => {
    const orang = K.susunKontakStatus({
      orang: bahanDua().orang,
      ecourtPihak: [
        { nama: "RINA WATI binti AHMAD", peran: "Penggugat", persetujuan: "setuju", terakhirTerlihat: "2026-10-09T01:00:00.000Z" },
        { nama: "JOKO bin SAMIN", peran: "Tergugat", persetujuan: "belum" },
      ],
      ecourtTerbaca: true,
      lewatEcourt: true,
    });
    const rina = orang.find((x: Apa) => x.nama.startsWith("RINA"));
    expect(rina.email).toMatchObject({ nilai: "rina.wati@yahoo.co.id", sumber: "sipp" });
    // e-Court menyebut surel lain: ikut disebut, bukan menimpa.
    expect(rina.email.lain).toEqual([expect.objectContaining({ nilai: "rina.lain@gmail.com", sumber: "ecourt" })]);
    expect(rina.hp).toMatchObject({ nilai: "085211113333", sumber: "sipp", bisaWhatsApp: true });

    const joko = orang.find((x: Apa) => x.nama.startsWith("JOKO"));
    // SIPP kosong -> e-Court (akun), dengan tanda sumber dan keyakinan.
    expect(joko.email).toMatchObject({ nilai: "joko.samin@gmail.com", sumber: "ecourt" });
    expect(joko.email.label).toContain("e-Court");
    expect(joko.hp).toMatchObject({ nilai: "085344445555", sumber: "ecourt", bisaWhatsApp: true });

    const kuasa = orang.find((x: Apa) => x.jenis === "kuasa");
    expect(kuasa.email).toMatchObject({ nilai: "kantor.siti@gmail.com", sumber: "sipp" });
    // "-" di SIPP = kosong, bukan nomor.
    expect(kuasa.hp.nilai).toBe("");
  });

  it("bersedia sidang elektronik: ya / tidak / belum menjawab dari persetujuan e-Court; kuasa tidak berlaku", () => {
    const hitung = (persetujuan: string) =>
      K.susunKontakStatus({
        orang: bahanDua().orang,
        ecourtPihak: [
          { nama: "RINA WATI", peran: "Penggugat", persetujuan: "setuju" },
          // e-Court menulis tanpa "bin": tetap cocok dengan "JOKO bin SAMIN" di SIPP.
          { nama: "JOKO SAMIN", peran: "Tergugat", persetujuan },
        ],
        ecourtTerbaca: true,
        lewatEcourt: true,
      });
    const joko = (p: string) => hitung(p).find((x: Apa) => x.nama.startsWith("JOKO")).elitigasi;
    expect(joko("setuju").status).toBe("ya");
    expect(joko("tidak_setuju").status).toBe("tidak");
    expect(joko("belum").status).toBe("belum");
    expect(joko("setuju").sumber).toBe("ecourt");
    expect(hitung("setuju").find((x: Apa) => x.nama.startsWith("RINA")).elitigasi.status).toBe("ya");
    expect(hitung("setuju").find((x: Apa) => x.jenis === "kuasa").elitigasi.status).toBe("tidak-berlaku");
  });

  it("yang tidak terbaca TIDAK ditebak: bukan perkara e-Court, tabel tak terbaca, pihak belum ditarik", () => {
    const orang = bahanDua().orang;
    const status = (m: Apa) => K.susunKontakStatus({ orang, ...m }).find((x: Apa) => x.nama.startsWith("JOKO")).elitigasi;

    const bukan = status({ ecourtPihak: [], ecourtTerbaca: true, lewatEcourt: false });
    expect(bukan.status).toBe("tidak-diketahui");
    expect(bukan.label).toContain("Bukan perkara e-Court");

    const takTerbaca = status({ ecourtPihak: [], ecourtTerbaca: false, lewatEcourt: true });
    expect(takTerbaca.status).toBe("tidak-diketahui");
    expect(takTerbaca.label).toContain("tidak terbaca");

    const belumDitarik = status({ ecourtPihak: [], ecourtTerbaca: true, lewatEcourt: true });
    expect(belumDitarik.status).toBe("tidak-diketahui");
    expect(belumDitarik.label).toContain("belum terbaca pada persetujuan e-Court");
  });

  it("nomor telepon rumah bukan WhatsApp; isian SIPP tak lazim ditandai, bukan dibuang", () => {
    const orang = K.susunKontakStatus({
      orang: K.susunKontak({
        pihak: [
          { pihakKe: 1, urutan: 1, pihakId: 1, nama: "A", email: "bukan email", telepon: "0451 421234" },
          { pihakKe: 2, urutan: 1, pihakId: 2, nama: "B", email: "0", telepon: "tidak punya" },
        ],
        kuasa: [],
        ecourtPihak: [],
        pengunggah: [],
        dokumen: [],
      }).orang,
      ecourtPihak: [],
      ecourtTerbaca: true,
      lewatEcourt: false,
    });
    const a = orang.find((x: Apa) => x.nama === "A");
    expect(a.hp).toMatchObject({ nilai: "0451421234", jenis: "telepon", bisaWhatsApp: false });
    expect(a.email).toMatchObject({ nilai: "bukan email", lazim: false, sumber: "sipp" });
    const b = orang.find((x: Apa) => x.nama === "B");
    expect(b.email.nilai).toBe(""); // "0" = kosong di SIPP
    expect(b.hp).toMatchObject({ nilai: "tidak punya", lazim: false });
  });
});

describe("butir 12 - rute portal kontak-para-pihak", () => {
  async function panggil(kueri: string) {
    vi.resetModules();
    const mod = await import("@/app/api/aleta-ecourt/kontak-para-pihak/route");
    return mod.GET({ nextUrl: new URL(`http://uji.local/api/aleta-ecourt/kontak-para-pihak${kueri}`) } as never);
  }

  it("meneruskan jawaban bot dan mencatat audit TANPA nilai kontak", async () => {
    keadaan.kontak = {
      ok: true,
      data: {
        ok: true,
        ada: true,
        lewatEcourt: true,
        orang: [
          {
            jenis: "pihak",
            pihakKe: 1,
            urutan: 1,
            nama: "RINA",
            email: { nilai: "rahasia@contoh.id", sumber: "sipp", lain: [] },
            hp: { nilai: "081200000000", sumber: "sipp", lain: [], bisaWhatsApp: true },
            elitigasi: { status: "ya", label: "x", sumber: "ecourt", terakhirTerlihat: null },
          },
        ],
      },
    };
    const jawaban = await panggil(`?nomor=${NOMOR}`);
    const badan = await jawaban.json();
    expect(badan.data.orang[0].email.nilai).toBe("rahasia@contoh.id");
    const a = keadaan.audit.find((x) => x.action === "ECOURT_KONTAK_PIHAK_DILIHAT")!;
    expect(a.entityId).toBe(NOMOR);
    expect(JSON.stringify(a)).not.toContain("rahasia@contoh.id");
    expect(JSON.stringify(a)).not.toContain("081200000000");
    expect((a.payload as Apa).jumlahOrang).toBe(1);
  });

  it("bot mati atau belum diperbarui: dijawab jujur, bukan layar kosong tanpa sebab", async () => {
    keadaan.kontak = { ok: false, error: "gateway tidak terjangkau" };
    const badan = await (await panggil(`?nomor=${NOMOR}`)).json();
    expect(badan.data.ok).toBe(false);
    expect(badan.data.alasan).toContain("gateway tidak terjangkau");
    expect(keadaan.audit).toHaveLength(0);

    const kosong = await (await panggil("")).json();
    expect(kosong.data.alasan).toContain("Nomor perkara wajib diisi");
  });
});
