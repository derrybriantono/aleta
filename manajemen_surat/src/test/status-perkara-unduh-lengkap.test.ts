// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ruasCsv, tabelCsv } from "@/lib/csv";

/**
 * ============================================================================
 * BUTIR 6 - 25 SEPTEMBER 2026
 * ============================================================================
 *
 * "buat pada status perkara download seluruh data sipp dan file pdf/word/rtf
 * baik dari sipp maupun e-court"
 *
 * ============================================================================
 * KENAPA UJI INI MEMBUKA ZIP-NYA, BUKAN MEMBACA KODENYA
 * ============================================================================
 *
 * Berkas ini dulu berisi 13 uji yang SELURUHNYA expect(teks).toContain(...)
 * atas teks sumber rutenya sendiri - tidak satu byte ZIP pernah diperiksa. Ia
 * akan tetap hijau seandainya seluruh 18 CSV keluar berisi baris kepala saja,
 * seandainya folder "00 Data SIPP" dibuang oleh batas jumlah berkas, dan
 * seandainya tiap ekstensi e-Court ditebak .docx - dan ketiganya memang terjadi
 * sampai 25 September 2026.
 *
 * Karena itu bagian pertama berkas ini MENJALANKAN rutenya: gateway dipalsukan,
 * GET dipanggil, ZIP-nya dibuka entri per entri, dan CSV-nya diurai kembali.
 * Yang tersisa sebagai penjaga teks hanya hal yang memang di luar jangkauan
 * pemanggilan rute - letak tombol di layar, angka pada konfigurasi nginx, dan
 * satu baris di bot.
 */

// ============================================================================
// PEMBACA ZIP - susunZip memakai metode "simpan apa adanya", jadi entri dapat
// dibaca tanpa pustaka: daftar isinya ditelusuri, lalu isinya dipotong dari
// kepala lokalnya. Tanpa ini tidak ada cara membuktikan apa pun tentang ZIP-nya.
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

/**
 * Pengurai CSV yang menghormati kutip - dipakai untuk membuktikan bahwa nilai
 * ber-koma dan ber-baris-baru kembali UTUH, bukan sekadar bahwa tanda kutipnya
 * tertulis. Satu koma yang tidak dikutip menggeser seluruh kolom di kanannya.
 */
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
        } else {
          dalamKutip = false;
        }
      } else {
        kini += c;
      }
      continue;
    }
    if (c === '"') {
      dalamKutip = true;
      continue;
    }
    if (c === ",") {
      ruas.push(kini);
      kini = "";
      continue;
    }
    if (c === "\r") continue;
    if (c === "\n") {
      ruas.push(kini);
      baris.push(ruas);
      ruas = [];
      kini = "";
      continue;
    }
    kini += c;
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
  panggilanEcourt: [] as Array<{ kunci: string; bentuk: string; adaSignal: boolean }>,
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async () => ({ name: "Penguji" }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt_uji" }));
vi.mock("@/server/shared/audit", () => ({ appendAuditLog: async () => undefined }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  // Galat yang ditelan menjadi 500 membuat uji gagal tanpa menyebut sebabnya.
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewayStatusPerkara: async () => keadaan.status,
  getGatewayRincianSidang: async () => keadaan.rincian,
  getGatewayArsipRincian: async () => keadaan.arsip,
  ambilBerkasSippGateway: async (jenis: string, id: string, signal?: AbortSignal) =>
    (keadaan.berkasSipp as JawabanBerkas)(jenis, id, signal),
  ambilBerkasGateway: async (kunci: string, bentuk: string, signal?: AbortSignal) => {
    keadaan.panggilanEcourt.push({ kunci, bentuk, adaSignal: signal instanceof AbortSignal });
    return (keadaan.berkasEcourt as JawabanBerkas)(kunci, bentuk, signal);
  },
}));

/** Jawaban berkas dengan Content-Disposition seperti yang dikirim bot. */
function jawabBerkas(isi: string, namaBerkas: string): Response {
  return new Response(new TextEncoder().encode(isi), {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      // internalGatewayRoutes.js:2309 - encodeURIComponent atas nama aslinya.
      "content-disposition": `attachment; filename="${encodeURIComponent(namaBerkas)}"`,
    },
  });
}

/** statusPerkara sekadarnya, dengan ruas yang benar-benar dibaca rutenya. */
function statusPalsu(ubah: Record<string, unknown> = {}) {
  return {
    ok: true,
    alasan: "",
    identitas: {
      nomorPerkara: "273/Pdt.G/2026/PA.Dgl",
      perkaraId: "90123",
      jenisPerkara: "Cerai Gugat",
      jenisPerkaraLengkap: "Cerai Gugat",
      tanggalDaftar: "2026-01-05",
    },
    umur: {
      hariBerjalan: 120,
      bulanBerjalan: 4,
      sudahPutus: false,
      sebabSelesai: "",
      hariMinutasi: null,
      hariMediasi: 30,
      hariBersih: 90,
    },
    majelis: [{ kode: "H1", nama: "Drs. H. Ahmad", jabatan: "Ketua Majelis" }],
    panitera: [{ kode: "P1", nama: "Siti Aminah" }],
    jurusita: [{ kode: "J1", nama: "Rahmat" }],
    pihak: [{ nama: "Fulanah", pihakKe: 1, jenis: "Penggugat", adaNomor: true, nomorSamar: "08xx" }],
    jadwal: [
      {
        urutanSidang: 1,
        sidangId: "5001",
        tanggalSidang: "2026-02-10",
        jamSidang: "09:00",
        agenda: "Sidang pertama",
        ruangan: "Ruang 1",
        ditunda: true,
        alasanDitunda: "Pihak tidak hadir, dipanggil ulang",
        adaBas: true,
      },
    ],
    // Riwayat penundaan - yang ditanya ketika berkas dikirim ke banding.
    penundaan: [
      {
        tanggalSidang: "2026-02-10",
        agenda: "Sidang pertama",
        alasanDitunda: "Pihak tidak hadir, dipanggil ulang",
      },
    ],
    relaas: [
      {
        id: "7001",
        sidangId: "5001",
        tanggalSidang: "2026-02-10",
        namaPihak: "Fulanah binti Fulan",
        peran: "Penggugat",
        tanggalRelaas: "2026-02-01",
        tanggalKirimPos: "2026-02-02",
        noResiPos: "RS123",
        statusPos: "Diterima",
        retur: false,
        caraRelaas: "Langsung",
        bertemu: true,
        jurusitaNama: "Rahmat",
        // Koma DAN baris baru dalam satu nilai - inilah yang menggeser kolom
        // bila kutipnya hilang.
        ketHasilRelaas: 'Diterima anak, umur 20 tahun\nmenyebut "sudah pisah"',
        adaDokumen: true,
        adaResi: true,
      },
    ],
    panggilan: { pihak: [], ringkasan: {} },
    putusan: {
      sudahPutus: false,
      tanggalPutusan: "",
      statusPutusan: "",
      verstek: false,
      tanggalMinutasi: "",
      tanggalBht: "",
      aktaCerai: null,
    },
    biaya: { panjar: 500000, terpakai: 179500, sisa: 320500, rincian: [] },
    dokumenEcourt: [],
    dokumenSipp: [],
    petitum: { ada: false },
    lewatEcourt: true,
    penilaian: { rinci: [], pengaturan: { hariMinutasi: 14, bulanNol: 5 } },
    penilaianSk: { rinci: [] },
    analisa: {
      garisWaktu: { terbaca: true, alasan: "", titik: [{ kunci: "daftar", label: "Didaftarkan", tanggal: "2026-01-05", hariKe: 0, jenis: "awal" }] },
      jedaSidang: { terbaca: true, alasan: "", baris: [{ dari: "Daftar", ke: "Sidang 1", hari: 36, alasan: "", jenis: "awal" }] },
      ketepatanInput: { terbaca: true, alasan: "", baris: [] },
      ringkasan: { kalimat: [] },
    },
    tahapan: { terbaca: true, alasan: "", tahap: [] },
    upayaHukum: [],
    penanda: { ghaib: false, sumberGhaib: [], instansi: [], perluIzinAtasan: false },
    penetapanKembali: { terbaca: true, alasan: "", adaPenggantian: false, baris: [] },
    durasiMediasi: { terbaca: true, alasan: "", hari: 30 },
    delegasiMasuk: { terbaca: true, alasan: "", baris: [] },
    delegasiKeluar: { terbaca: true, alasan: "", baris: [] },
    arsipKeterangan: { terbaca: true, alasan: "", berkasTerbaca: true, alasanBerkas: "", sudahDiarsipkan: false, baris: [] },
    putusanLengkap: { terbaca: true, ada: false },
    putusanEcourt: { keadaan: "belum_putus", sebutan: "Belum putus", perluTindakan: false, keterangan: "" },
    ikrarTalak: { terbaca: true, ada: false, alasan: "" },
    konseptor: { terbaca: true, alasan: "", baris: [] },
    courtCalendar: { terbaca: true, alasan: "", baris: [] },
    nilaiRelaas: { terbaca: true, alasan: "", sumber: "tanggal input", relaas: [] },
    dokumenRelaas: { terbaca: true, alasan: "", jumlah: 1, berdokumen: 1, berresi: 1 },
    saksiRinci: { terbaca: true, alasan: "", baris: [] },
    mediasi: { terbaca: true, alasan: "", baris: [] },
    pesanSipp: "",
    ...ubah,
  };
}

/** Jawaban rincianSidang sekadarnya - tanpa berkas SIPP sama sekali. */
function rincianPalsu(ubah: Record<string, unknown> = {}) {
  return {
    ok: true,
    data: {
      ok: true,
      perkaraId: "90123",
      petitum: { ada: false, berkas: "" },
      relaas: [],
      jadwalPerkara: [],
      putusan: { adaBerkasPutusan: false, adaBerkasAnonim: false, tanggalPutusan: "" },
      dokumenSipp: [],
      ...ubah,
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
  expect(jawaban.headers.get("Content-Type")).toBe("application/zip");
  return bacaZip(Buffer.from(await jawaban.arrayBuffer()));
}

const NAMA_CSV = [
  "01 identitas.csv",
  "02 pihak.csv",
  "03 majelis-dan-petugas.csv",
  "04 tahapan.csv",
  "05 jadwal-sidang.csv",
  "06 relaas.csv",
  "07 panggilan-per-pihak.csv",
  "08 court-calendar.csv",
  "09 mediasi.csv",
  "10 saksi.csv",
  "11 biaya.csv",
  "12 putusan.csv",
  "13 upaya-hukum.csv",
  "14 delegasi.csv",
  "15 arsip.csv",
  "16 dokumen-ecourt.csv",
  "17 penilaian-kelengkapan.csv",
  "18 penilaian-sk-048-2024.csv",
  // Delapan yang dulu hanya ada di dalam perkara.json.
  "19 penundaan.csv",
  "20 konseptor.csv",
  "21 penetapan-kembali.csv",
  "22 nilai-relaas.csv",
  "23 garis-waktu.csv",
  "24 jeda-sidang.csv",
  "25 ketepatan-input.csv",
  "26 keadaan-lain.csv",
];

describe("butir 6 - ZIP-nya dibuka, bukan kodenya dibaca", () => {
  beforeEach(() => {
    keadaan.status = { ok: true, data: statusPalsu() };
    keadaan.rincian = rincianPalsu();
    keadaan.arsip = { ok: true, data: { nomorPerkara: "273/Pdt.G/2026/PA.Dgl", dokumen: [] } };
    keadaan.berkasSipp = async (jenis: string, id: string) =>
      jawabBerkas(`isi ${jenis} ${id}`, `${jenis}-${id}.pdf`);
    keadaan.berkasEcourt = async (kunci: string, bentuk: string) =>
      jawabBerkas(`isi ${kunci} ${bentuk}`, `${kunci}-${bentuk}.pdf`);
    keadaan.panggilanEcourt = [];
    delete process.env.ALETA_ZIP_TIMEOUT_BERKAS_MS;
    delete process.env.ALETA_ZIP_TIMEOUT_TOTAL_MS;
  });

  afterEach(() => {
    delete process.env.ALETA_ZIP_TIMEOUT_BERKAS_MS;
    delete process.env.ALETA_ZIP_TIMEOUT_TOTAL_MS;
  });

  it("folder 00 Data SIPP memuat perkara.json dan seluruh 26 tabel yang dijanjikan", async () => {
    const isi = await ambilZip("?nomor=273/Pdt.G/2026/PA.Dgl&isi=lengkap");

    for (const nama of NAMA_CSV) {
      expect(isi.has(`00 Data SIPP/${nama}`), `${nama} tidak ada di dalam ZIP`).toBe(true);
    }
    expect(isi.has("00 Data SIPP/perkara.json")).toBe(true);
    expect(isi.has("RINGKASAN.txt")).toBe(true);
    expect(isi.has("DAFTAR ISI.txt")).toBe(true);
    expect(isi.has("KETERANGAN.txt")).toBe(true);

    // JSON-nya jawaban bot APA ADANYA - bukan bentuk yang sudah disaring tipe
    // layar. Yang diperiksa: ia terurai kembali, dan ruas yang tidak pernah
    // tampil di layar pun ada di dalamnya.
    const json = JSON.parse(isi.get("00 Data SIPP/perkara.json")!.toString("utf8"));
    expect(json.identitas.nomorPerkara).toBe("273/Pdt.G/2026/PA.Dgl");
    expect(json.relaas[0].ketHasilRelaas).toContain("sudah pisah");
    expect(json.dokumenRelaas.berresi).toBe(1);
  });

  it("06 relaas.csv memuat BARIS DATA, dan nilai ber-koma kembali utuh", async () => {
    const isi = await ambilZip("?nomor=273/Pdt.G/2026/PA.Dgl&isi=lengkap");
    const tabel = uraiCsv(isi.get("00 Data SIPP/06 relaas.csv")!.toString("utf8"));

    // Bukan hanya kepala: inilah yang dulu tidak pernah diperiksa sama sekali.
    expect(tabel.length).toBeGreaterThan(1);
    expect(tabel[0][0]).toBe("id");
    const baris = tabel[1];
    expect(baris[0]).toBe("7001");
    expect(baris[3]).toBe("Fulanah binti Fulan");
    // Koma, tanda kutip, dan baris baru dalam satu nilai - utuh sesudah diurai,
    // dan kolom di kanannya TIDAK bergeser.
    const kepala = tabel[0];
    expect(baris[kepala.indexOf("ket_hasil")]).toBe(
      'Diterima anak, umur 20 tahun\nmenyebut "sudah pisah"'
    );
    expect(baris[kepala.indexOf("ada_dokumen")]).toBe("ya");
    expect(baris[kepala.indexOf("ada_resi")]).toBe("ya");
  });

  it("19 penundaan.csv memuat sebab sidang ditunda - yang ditanya saat banding", async () => {
    const isi = await ambilZip("?nomor=273/Pdt.G/2026/PA.Dgl&isi=lengkap");
    const tabel = uraiCsv(isi.get("00 Data SIPP/19 penundaan.csv")!.toString("utf8"));

    expect(tabel.length).toBe(2);
    expect(tabel[1]).toEqual(["2026-02-10", "Sidang pertama", "Pihak tidak hadir, dipanggil ulang"]);
  });

  it("03 majelis-dan-petugas.csv: majelis pemeriksa, lalu majelis ikrar talak sebagai peran tersendiri", async () => {
    // Bentuk muatan bot sejak perbaikan majelis ikrar (27 September 2026).
    keadaan.status = {
      ok: true,
      data: statusPalsu({
        sumberMajelis: "pemeriksa",
        ikrar: {
          majelis: [{ id: 9, kode: "H9", nama: "Ulfah", jabatan: "Hakim Ketua", sumber: "penunjukan" }],
          panitera: [{ id: null, kode: "", nama: "Imayanti, S.H.", sumber: "penetapanIkrar" }],
          jurusita: [{ id: 2, kode: "", nama: "Muh. Sam'an", sumber: "penetapanIkrar" }],
        },
      }),
    };
    const isi = await ambilZip("?nomor=273/Pdt.G/2026/PA.Dgl&isi=lengkap");
    const tabel = uraiCsv(isi.get("00 Data SIPP/03 majelis-dan-petugas.csv")!.toString("utf8"));

    expect(tabel.map((b) => b[0])).toEqual([
      "peran",
      "majelis",
      "panitera pengganti",
      "juru sita",
      "majelis ikrar talak",
      "panitera sidang ikrar talak",
      "juru sita ikrar talak",
    ]);
    expect(tabel[1]).toEqual(["majelis", "H1", "Drs. H. Ahmad", "Ketua Majelis"]);
    expect(tabel[4]).toEqual(["majelis ikrar talak", "H9", "Ulfah", "Hakim Ketua"]);
    // Nama ber-koma tetap satu kolom.
    expect(tabel[5]).toEqual(["panitera sidang ikrar talak", "", "Imayanti, S.H.", ""]);
  });

  it("bagian yang bot pulangkan terbaca:false menghasilkan satu baris di KETERANGAN.txt", async () => {
    keadaan.status = {
      ok: true,
      data: statusPalsu({
        // Kalimat sebabnya betul-betul disusun bot:
        // sippTahapanService.js:2828 dan sippStatusPerkaraService.js:1701.
        saksiRinci: {
          terbaca: false,
          alasan: "Kolom identitas saksi tidak ada pada SIPP versi ini.",
          baris: [],
        },
        tahapan: { terbaca: false, alasan: "Tahapan tidak terbaca.", tahap: [] },
        arsipKeterangan: {
          terbaca: false,
          alasan: "Tabel arsip tidak ada pada SIPP versi ini.",
          baris: [],
        },
      }),
    };

    const isi = await ambilZip("?nomor=273/Pdt.G/2026/PA.Dgl&isi=lengkap");
    const keteranganTxt = isi.get("KETERANGAN.txt")!.toString("utf8");

    expect(keteranganTxt).toContain("BAGIAN YANG TIDAK TERBACA");
    expect(keteranganTxt).toContain("10 saksi.csv: Kolom identitas saksi tidak ada pada SIPP versi ini.");
    expect(keteranganTxt).toContain("04 tahapan.csv: Tahapan tidak terbaca.");
    expect(keteranganTxt).toContain("15 arsip.csv: Tabel arsip tidak ada pada SIPP versi ini.");

    // Dan tabelnya tetap IKUT - "tidak terbaca" bukan "tidak dikemas".
    expect(isi.has("00 Data SIPP/10 saksi.csv")).toBe(true);
    expect(uraiCsv(isi.get("00 Data SIPP/10 saksi.csv")!.toString("utf8")).length).toBe(1);
  });

  it("bagian yang terbaca dan memang kosong TIDAK dituduh tidak terbaca", async () => {
    const isi = await ambilZip("?nomor=273/Pdt.G/2026/PA.Dgl&isi=lengkap");
    const keteranganTxt = isi.get("KETERANGAN.txt")!.toString("utf8");

    expect(keteranganTxt).not.toContain("BAGIAN YANG TIDAK TERBACA");
    expect(keteranganTxt).toContain("Seluruh bagian data SIPP terbaca");
  });

  it("keterangan bot tentang kekosongan yang WAJAR pun sampai ke KETERANGAN.txt", async () => {
    // konseptor terbaca:true, baris kosong, tetapi bot menerangkan sebabnya
    // pada `catatan` (sippTahapanService.js:3078). Dulu hilang seluruhnya.
    keadaan.status = {
      ok: true,
      data: statusPalsu({
        konseptor: {
          terbaca: true,
          alasan: "",
          baris: [],
          catatan: "Tahapan putusan tidak tercatat pada perkara_proses.",
        },
      }),
    };

    const isi = await ambilZip("?nomor=273/Pdt.G/2026/PA.Dgl&isi=lengkap");
    expect(isi.get("KETERANGAN.txt")!.toString("utf8")).toContain(
      "20 konseptor.csv: Tahapan putusan tidak tercatat pada perkara_proses."
    );
  });

  it("ekstensi e-Court DIBACA dari Content-Disposition, tidak ditebak .docx", async () => {
    keadaan.arsip = {
      ok: true,
      data: {
        nomorPerkara: "273/Pdt.G/2026/PA.Dgl",
        dokumen: [
          {
            documentKey: "dok-1",
            judulDokumen: "Jawaban Tergugat",
            adaPdf: false,
            adaWord: true,
            tanggalSidang: "2026-02-10",
          },
          {
            documentKey: "dok-2",
            judulDokumen: "Alat Bukti",
            adaPdf: false,
            adaWord: true,
            tanggalSidang: "2026-02-10",
          },
        ],
      },
    };
    // ecourtDocumentService.js:40 menerima .pdf .doc .docx .rtf .odt - dan
    // "word" karena itu tidak berarti .docx.
    keadaan.berkasEcourt = async (kunci: string) =>
      kunci === "dok-1"
        ? jawabBerkas("isi rtf", "Jawaban Tergugat.rtf")
        : jawabBerkas("isi odt", "Alat Bukti.odt");

    const isi = await ambilZip("?nomor=273/Pdt.G/2026/PA.Dgl&sumber=ecourt");
    const nama = [...isi.keys()].filter((x) => x.startsWith("06 e-Court/"));

    expect(nama).toContain("06 e-Court/01 - Jawaban Tergugat.rtf");
    expect(nama).toContain("06 e-Court/02 - Alat Bukti.odt");
    expect(nama.some((x) => x.endsWith(".docx"))).toBe(false);
  });

  it("batas waktu berlaku pada sisi e-Court juga, dan sebabnya disebutkan", async () => {
    // Tanpa parameter signal pada ambilBerkasGateway, uji ini MENGGANTUNG
    // sampai batas waktu vitest - persis seperti permintaan aslinya
    // menggantung melewati batas 120 detik nginx.
    process.env.ALETA_ZIP_TIMEOUT_BERKAS_MS = "60";
    keadaan.arsip = {
      ok: true,
      data: {
        nomorPerkara: "273/Pdt.G/2026/PA.Dgl",
        dokumen: [
          { documentKey: "dok-gantung", judulDokumen: "BAS 2018", adaPdf: true, adaWord: false },
          { documentKey: "dok-baik", judulDokumen: "Replik", adaPdf: true, adaWord: false },
        ],
      },
    };
    keadaan.berkasEcourt = async (kunci: string, _bentuk: string, signal?: AbortSignal) => {
      if (kunci !== "dok-gantung") return jawabBerkas("isi", "Replik.pdf");
      return new Promise<Response>((_selesai, tolak) => {
        signal?.addEventListener("abort", () => tolak(new Error("The operation was aborted")));
      });
    };

    const isi = await ambilZip("?nomor=273/Pdt.G/2026/PA.Dgl&sumber=ecourt");

    // Sinyalnya benar-benar sampai ke klien gateway.
    expect(keadaan.panggilanEcourt.every((x) => x.adaSignal)).toBe(true);
    // Yang menggantung disebutkan, yang lain tetap ikut.
    const keteranganTxt = isi.get("KETERANGAN.txt")!.toString("utf8");
    expect(keteranganTxt).toContain("BAS 2018 (pdf): The operation was aborted");
    expect([...isi.keys()]).toContain("06 e-Court/02 - Replik.pdf");
    // Batas waktu 15 detik, bukan 120 detik bawaan vitest: sinyal yang hilang
    // membuat uji ini MENGGANTUNG, dan diukur 25 September 2026 gantungnya
    // memang penuh sampai batas waktu. Tanpa batas yang lebih pendek, satu
    // kemunduran memperlambat rangkaian uji dua menit sebelum berbunyi.
  }, 15_000);

  it("data SIPP tidak lagi menjadi yang pertama dibuang ketika batas 150 berkas terlampaui", async () => {
    // 200 relaas berdokumen. Sebelum 25 September 2026 folder 00 ditulis
    // PALING AKHIR, jadi 150 slotnya habis oleh relaas dan folder yang diminta
    // pengguna dengan kalimatnya sendiri adalah satu-satunya yang dibuang.
    const relaas = Array.from({ length: 200 }, (_, i) => ({
      id: String(8000 + i),
      tanggalRelaas: `2026-03-${String((i % 28) + 1).padStart(2, "0")}`,
      peran: "Penggugat",
      namaPihak: `Pihak ${i}`,
      adaDokumen: true,
      adaResi: false,
    }));
    keadaan.rincian = rincianPalsu({ relaas });

    const isi = await ambilZip("?nomor=273/Pdt.G/2026/PA.Dgl&isi=lengkap&sumber=sipp");
    const kunci = [...isi.keys()];

    // Seluruh 27 entri data ikut, tanpa kecuali.
    for (const nama of NAMA_CSV) {
      expect(isi.has(`00 Data SIPP/${nama}`), `${nama} dibuang oleh batas berkas`).toBe(true);
    }
    expect(isi.has("00 Data SIPP/perkara.json")).toBe(true);
    expect(isi.has("RINGKASAN.txt")).toBe(true);

    // Dan yang dibuang justru relaas - 150 slot dikurangi 27 data dan 1
    // ringkasan menyisakan 122.
    expect(kunci.filter((x) => x.startsWith("02 Relaas/")).length).toBe(122);
    expect(isi.get("KETERANGAN.txt")!.toString("utf8")).toContain("melewati batas 150 berkas");

    // Urutan entri ZIP mengikuti urutan taruh(), dan taruh() itulah yang
    // menegakkan batasnya. Jadi yang dijaga di sini bukan jumlahnya saja
    // melainkan URUTANNYA: data SIPP ditulis sebelum satu berkas pun ditarik.
    expect(kunci.findIndex((x) => x.startsWith("00 Data SIPP/"))).toBeLessThan(
      kunci.findIndex((x) => x.startsWith("02 Relaas/"))
    );
  });

  it("arsip fisik diminta tetapi tidak terbaca: sebabnya DISEBUTKAN, bukan hilang", async () => {
    // Cabang penjelasnya dulu hanya tercapai ketika arsipFisik TIDAK diminta.
    // Ketika petugas justru mencentangnya dan adaBerkas palsu untuk seluruh
    // baris, lingkaran for berjalan nol kali dan tidak satu kalimat pun keluar.
    keadaan.status = {
      ok: true,
      data: statusPalsu({
        arsipKeterangan: {
          terbaca: true,
          alasan: "",
          berkasTerbaca: false,
          alasanBerkas: "Folder arsip SIPP tidak terbaca dari container ALETA",
          sudahDiarsipkan: true,
          baris: [{ arsipId: "1", nomor: "273/Pdt.G/2026/PA.Dgl", adaBerkas: false }],
        },
      }),
    };

    const isi = await ambilZip("?nomor=273/Pdt.G/2026/PA.Dgl&isi=lengkap&arsipFisik=1");
    const keteranganTxt = isi.get("KETERANGAN.txt")!.toString("utf8");

    expect([...isi.keys()].some((x) => x.startsWith("08 Arsip fisik/"))).toBe(false);
    expect(keteranganTxt).toContain("08 Arsip fisik: diminta, tetapi tidak ada berkas");
    expect(keteranganTxt).toContain("Folder arsip SIPP tidak terbaca dari container ALETA");
  });

  it("arsip fisik diminta pada perkara yang belum diarsipkan: sebabnya lain, dan disebut lain", async () => {
    const isi = await ambilZip("?nomor=273/Pdt.G/2026/PA.Dgl&isi=lengkap&arsipFisik=1");
    expect(isi.get("KETERANGAN.txt")!.toString("utf8")).toContain(
      "perkara ini belum tercatat diarsipkan"
    );
  });

  it("ekstensi berkas SIPP pun dibaca dari nama yang dikirim bot", async () => {
    keadaan.rincian = rincianPalsu({
      jadwalPerkara: [
        { urutanSidang: 1, sidangId: "5001", tanggalSidang: "2026-02-10", agenda: "Pertama", adaBas: true },
      ],
      putusan: { adaBerkasPutusan: true, adaBerkasAnonim: false, tanggalPutusan: "2026-06-01" },
    });
    // Terukur di sipp_donggala: berita acara 8.896 dari 15.248 BUKAN .rtf.
    keadaan.berkasSipp = async (jenis: string) =>
      jenis === "bas" ? jawabBerkas("isi bas", "BAS-1.docx") : jawabBerkas("isi putusan", "Putusan.pdf");

    const isi = await ambilZip("?nomor=273/Pdt.G/2026/PA.Dgl&sumber=sipp");
    const kunci = [...isi.keys()];

    expect(kunci.some((x) => x.startsWith("03 BAS/") && x.endsWith(".docx"))).toBe(true);
    expect(kunci).toContain("04 Putusan/01 - Putusan.pdf");
    expect(kunci.some((x) => x.endsWith(".rtf"))).toBe(false);
  });

  it("tidak ada dua entri bernama sama di dalam satu ZIP", async () => {
    // Sesudah ekstensinya dibaca, pdf dan word satu dokumen dapat bernama sama:
    // ALLOWED_EXTENSIONS bot menerima .pdf untuk KEDUA bentuk. Windows
    // mengeluarkan hanya salah satunya, tanpa peringatan.
    keadaan.arsip = {
      ok: true,
      data: {
        nomorPerkara: "273/Pdt.G/2026/PA.Dgl",
        dokumen: [
          { documentKey: "dok-1", judulDokumen: "Kesimpulan", adaPdf: true, adaWord: true },
        ],
      },
    };
    keadaan.berkasEcourt = async (_kunci: string, bentuk: string) =>
      jawabBerkas(`isi ${bentuk}`, "Kesimpulan.pdf");

    const isi = await ambilZip("?nomor=273/Pdt.G/2026/PA.Dgl&sumber=ecourt");
    const kunci = [...isi.keys()].filter((x) => x.startsWith("06 e-Court/"));

    expect(kunci.length).toBe(2);
    expect(new Set(kunci).size).toBe(2);
    expect(kunci).toContain("06 e-Court/01 - Kesimpulan.pdf");
    expect(kunci).toContain("06 e-Court/01 - Kesimpulan (word).pdf");
  });

  it("DAFTAR ISI menyebut seluruh entri yang benar-benar ada", async () => {
    const isi = await ambilZip("?nomor=273/Pdt.G/2026/PA.Dgl&isi=lengkap");
    const daftar = isi.get("DAFTAR ISI.txt")!.toString("utf8");

    // DAFTAR ISI dan KETERANGAN sendiri tidak masuk daftarnya - keduanya
    // ditaruh sesudah daftarnya disusun.
    const dihitung = [...isi.keys()].filter((x) => x !== "DAFTAR ISI.txt" && x !== "KETERANGAN.txt");
    expect(daftar).toContain(`Jumlah berkas: ${dihitung.length}`);
    for (const nama of dihitung) expect(daftar, nama).toContain(nama);
  });

  it("perkara tanpa berkas dan tanpa data dijawab 404 beserta sebabnya", async () => {
    keadaan.status = { ok: false, error: "gateway mati" };
    keadaan.rincian = { ok: false, error: "gateway mati" };
    keadaan.arsip = { ok: false, error: "gateway mati" };

    const jawaban = await jalankan("?nomor=273/Pdt.G/2026/PA.Dgl&isi=lengkap");
    expect(jawaban.status).toBe(404);
    const badan = await jawaban.json();
    expect(badan.alasan).toBe("tidak_ada_berkas_tersimpan");
    expect(badan.keterangan.join(" ")).toContain("gateway mati");
  });
});

// ============================================================================
// tabelCsv DIJALANKAN LANGSUNG
// ============================================================================
describe("tabelCsv dan ruasCsv", () => {
  it("nilai ber-koma, ber-kutip, DAN ber-baris-baru kembali utuh sesudah diurai", () => {
    const teks = tabelCsv(
      ["nama", "alamat", "keterangan"],
      [
        ["Ahmad", "Jl. Merdeka No. 1, Donggala", "biasa"],
        ['Siti "Aisyah"', "Banawa\nSulteng", 'kata "pisah", lalu\nbaris baru'],
        [null, undefined, 0],
      ]
    );

    // BOM di depan - tanpa itu Excel di Windows membaca UTF-8 sebagai ANSI, dan
    // tiap nama bergelar berubah menjadi aksara yang tidak terbaca.
    expect(teks.charCodeAt(0)).toBe(0xfeff);
    // CRLF, sebab yang membukanya Excel di Windows.
    expect(teks).toContain("\r\n");

    const tabel = uraiCsv(teks);
    expect(tabel[0]).toEqual(["nama", "alamat", "keterangan"]);
    expect(tabel[1]).toEqual(["Ahmad", "Jl. Merdeka No. 1, Donggala", "biasa"]);
    expect(tabel[2]).toEqual([
      'Siti "Aisyah"',
      "Banawa\nSulteng",
      'kata "pisah", lalu\nbaris baru',
    ]);
    // Kosong tetap kosong - "null" dan "undefined" akan terbaca sebagai
    // keterangan yang sungguh tertulis di berkas perkara. Nol tetap "0".
    expect(tabel[3]).toEqual(["", "", "0"]);
    // Dan jumlah kolomnya tidak bergeser sedikit pun walau nilainya ber-koma.
    for (const baris of tabel) expect(baris.length).toBe(3);
  });

  it("ruas tanpa aksara khusus tidak dikutip, yang berkoma dan bertitik-koma dikutip", () => {
    expect(ruasCsv("Ahmad")).toBe("Ahmad");
    expect(ruasCsv(0)).toBe("0");
    expect(ruasCsv(false)).toBe("false");
    expect(ruasCsv(null)).toBe("");
    expect(ruasCsv(undefined)).toBe("");
    expect(ruasCsv("a,b")).toBe('"a,b"');
    // Titik koma ikut dikutip: Excel berbahasa Indonesia memakainya sebagai
    // pemisah ruas, jadi nilai ber-titik-koma akan memecah kolom di sana.
    expect(ruasCsv("a;b")).toBe('"a;b"');
    expect(ruasCsv('a"b')).toBe('"a""b"');
    expect(ruasCsv("a\nb")).toBe('"a\nb"');
  });

  it("tabel tanpa satu baris data pun tetap punya kepala dan diakhiri CRLF", () => {
    const teks = tabelCsv(["a", "b"], []);
    expect(teks).toBe("﻿a,b\r\n");
    expect(uraiCsv(teks)).toEqual([["a", "b"]]);
  });
});

// ============================================================================
// YANG MEMANG DI LUAR JANGKAUAN PEMANGGILAN RUTE
// ============================================================================
const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

describe("butir 6 - yang tidak dapat dibuktikan dengan memanggil rutenya", () => {
  // Penyusun isi ZIP dipisah ke modul bersama sejak 30 Sep 2026 (dipakai juga
  // sinkron Drive) - penjaga membaca rute DAN modulnya.
  const zip =
    baca("manajemen_surat/src/app/api/aleta-ecourt/berkas-zip/route.ts") +
    "\n" +
    baca("manajemen_surat/src/server/modules/aleta-ecourt/susun-arsip-perkara.ts");
  const tombol = baca("manajemen_surat/src/components/portal/tombol-unduh-zip.tsx");
  const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-status-perkara.tsx");
  const bot = baca("aleta_bot/services/sippJadwalSidangService.js");

  it("tombolnya ada di Status Perkara, dan meminta isi lengkap", () => {
    expect(layar).toContain('from "@/components/portal/tombol-unduh-zip"');
    expect(layar).toContain('isi="lengkap"');
    // Di KEPALA layar, bukan tenggelam di bagian ketujuh belas dari dua puluh
    // enam. "majelis" bagian kedua; tombolnya harus berdiri sebelum itu.
    expect(layar.indexOf("<TombolUnduhZip")).toBeGreaterThan(-1);
    expect(layar.indexOf("<TombolUnduhZip")).toBeLessThan(layar.indexOf('kunci="majelis"'));
  });

  it("ruas CSV hanya punya SATU definisi", () => {
    // Rute peladen tidak boleh mengimpor komponen "use client", dan menyalin
    // fungsinya berarti dua definisi yang menyimpang diam-diam pada suntingan
    // berikutnya - salah satunya diperbaiki, yang lain tidak.
    const lib = baca("manajemen_surat/src/lib/csv.ts");
    expect(lib).toContain("export function ruasCsv(");
    expect(lib).toContain("export function tabelCsv(");
    for (const berkas of [
      "manajemen_surat/src/components/portal/aleta-ecourt-riwayat.tsx",
      "manajemen_surat/src/server/modules/aleta-ecourt/susun-arsip-perkara.ts",
    ]) {
      expect(baca(berkas), berkas).not.toContain("function ruasCsv(");
      expect(baca(berkas), berkas).toContain('from "@/lib/csv"');
    }
  });

  it("batas waktu menyeluruh lebih pendek daripada batas nginx", () => {
    // deploy/nginx/aleta.conf baris 15 dan 32: proxy_read_timeout 120s. ZIP
    // dikirim SEKALIGUS di akhir, jadi seluruh penyusunan adalah keheningan
    // bagi nginx - tidak satu byte pun mengalir sampai berkas terakhir selesai.
    const cocok = /ALETA_ZIP_TIMEOUT_TOTAL_MS \|\| (\d[\d_]*)/.exec(zip);
    expect(cocok).toBeTruthy();
    expect(Number(String(cocok![1]).replace(/_/g, ""))).toBeLessThan(120_000);
    for (const konfigurasi of ["deploy/nginx/aleta.conf", "deploy/nginx/aleta-container.conf"]) {
      expect(baca(konfigurasi), konfigurasi).toContain("proxy_read_timeout 120s;");
    }
  });

  it("kedua sisi berkas punya parameter signal, bukan hanya sisi SIPP", () => {
    // Batas waktu sisi e-Court diuji perilakunya di atas; yang dijaga di sini
    // parameternya tidak dihapus lagi dari klien gateway pada suntingan lain.
    const klien = baca("manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts");
    expect(klien).toContain("export async function ambilBerkasGateway(");
    const potong = klien.slice(klien.indexOf("export async function ambilBerkasGateway("));
    expect(potong.slice(0, 2000)).toContain("signal?: AbortSignal");
  });

  it("berkas pindaian arsip hanya ikut bila diminta", () => {
    // Terukur 2 MB sampai 28 MB sebuah - selisih yang menentukan apakah
    // seseorang mengunduhnya sekarang atau menunggu.
    expect(tombol).toContain("arsipFisik");
    expect(tombol).toContain("useState(false)");
    expect(zip).toContain('request.nextUrl.searchParams.get("arsipFisik") === "1"');
  });

  it("unduhan yang BERHASIL ikut tercatat, bukan hanya yang gagal", () => {
    // Satu tekan membawa nama para pihak, alamat pada resi pos, alamat saksi,
    // dan putusan yang belum dianonimkan ke luar portal. Jejaknya dipalsukan
    // pada uji perilaku di atas, jadi keberadaannya dijaga di sini.
    expect(zip).toContain("appendAuditLog(db, {");
    expect(zip).toContain("ECOURT_PERKARA_ZIP_LENGKAP");
    expect(zip).toContain('pastikanKapabilitas(db, actorUserId, "berkas")');
  });

  it('"0" bukan jalur berkas', () => {
    // Diukur pada sipp_donggala: 5.275 dari 8.351 baris ber-doc_resi
    // menyimpan literal "0" pada 2.818 perkara, dan Boolean("0") bernilai
    // true - tombol "Resi" muncul untuk berkas yang tidak pernah ada, dan ZIP
    // menembak 5.275 permintaan yang pasti dijawab 400.
    expect(bot).toContain("adaResi: adaJalurBerkas(row.docResi),");
    expect(bot).toContain("adaDokumen: adaJalurBerkas(row.docRelaas),");
    expect(bot).not.toContain("adaResi: Boolean(cleanText(row.docResi)),");
    expect(bot).not.toContain("adaDokumen: Boolean(cleanText(row.docRelaas)),");
    expect(bot).toContain("function adaJalurBerkas(");
    expect(bot).toContain("5.275");
  });

  it("tanggal yang DIBACA orang bergaya Indonesia, nama berkas tetap ISO", () => {
    // Satu perkara tidak boleh punya dua gaya tanggal - satu di layar, satu di
    // arsipnya. Nama berkas di dalam ZIP tetap ISO: itulah yang membuat
    // penjelajah berkas mengurutkan isinya dengan benar.
    expect(zip).toContain('from "@/lib/tanggal-indonesia"');
    expect(zip).toContain("tanggalHariPanjang(hariIni, hariIni)");
    expect(zip).not.toContain("`Disusun ${new Date().toISOString()}`");
    // Hari ini menurut zona pengadilan, bukan zona peladen yang berjalan UTC.
    expect(zip).toContain("waktuPengadilan().tanggal");
  });
});
