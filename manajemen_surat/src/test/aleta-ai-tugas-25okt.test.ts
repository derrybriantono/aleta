// @vitest-environment node
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { newDb } from "pg-mem";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { hitungHarga } from "@/lib/aleta-ai/biaya";
import type { PermintaanAi } from "@/lib/aleta-ai/penyusun";
import { dataAsliTersisa, Penyamar } from "@/lib/aleta-ai/samaran";
import {
  adaKataAleta,
  bacaRujukan,
  buangRujukanBelumTerverifikasi,
  TANDA_DRAF,
  TANDA_RUJUKAN,
  tandaiRujukan,
  tanpaKataAleta,
  type FormatBerkas,
  type JenisTugas,
} from "@/lib/aleta-ai/tugas";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ALETA_AI_TEMPLAT_KIRIMAN, DDL_ALETA_AI_TUGAS } from "@/server/db/schema";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import { suntikSumberDataAi, type SumberDataAi } from "@/server/modules/aleta-ai/alat";
import { susunBerkas } from "@/server/modules/aleta-ai/berkas-keluaran";
import { GalatKlienAi, suntikKlienAi, type HasilAi, type KlienAi, type OpsiAlir } from "@/server/modules/aleta-ai/klien";
import { konfirmasiKiriman, kirimanUntukAlur, usulkanKiriman } from "@/server/modules/aleta-ai/kiriman";
import { simpanKurs, tanggalLokal } from "@/server/modules/aleta-ai/kurs";
import { bacaPengaturan, bacaTarif, simpanPengaturan } from "@/server/modules/aleta-ai/pengaturan";
import { proyekAktif, unggahProyek } from "@/server/modules/aleta-ai/proyek";
import { saldoPengguna, tahanDana, terapkanMutasi, verifikasiSaldo } from "@/server/modules/aleta-ai/saldo";
import { muatPenyamar } from "@/server/modules/aleta-ai/samaran";
import { jalankanAlatBantu, pelariAntrian, suntikPelariSandbox, type PelariSandbox, type PermintaanSandbox } from "@/server/modules/aleta-ai/sandbox";
import { pilihTemplat } from "@/server/modules/aleta-ai/templat";
import {
  ambilAlihTugas,
  ambilTugas,
  buatTugas,
  cekHakTugas,
  hentikanTugas,
  jalankanTugas,
  PESAN_DIHENTIKAN_SAKLAR,
  saklarDaruratMenyala,
  unduhBerkas,
} from "@/server/modules/aleta-ai/tugas";
import { susunZip } from "@/server/shared/zip";

import { bacaPdfUji, bacaZip, uraiXml } from "./eviden-skp-baca";

/**
 * ============================================================================
 * ALETA Ai TAHAP 3 (T9, 25 Okt 2026): tugas (cowork), berkas keluaran, alat
 * bantu sandbox, kirim ke alur ALETA - SEMUA dengan data & proyek REKAAN dan
 * klien model TIRUAN (tidak ada panggilan API sungguhan)
 * ============================================================================
 *
 *   1. migrasi 0086-0087: jurnal, berkas = schema.ts, pg-mem, cadangan
 *   2. hak per peran x jenis tugas (server menolak, juga lewat rute)
 *   3. penjaga keluaran: rujukan belum terverifikasi, kata "ALETA"
 *   4. berkas keluaran DOCX/RTF/PDF/HTML/XLSX terbuka & memuat tanda draf;
 *      templat dari zip proyek REKAAN
 *   5. sandbox: daftar izin (portal & pelaksana Python sungguhan), batas waktu
 *   6. tugas penuh: UJI KEBOCORAN, berkas data asli, saldo = pemakaian
 *   7. berhenti / lanjut / bertahan (pelari mati), saklar darurat
 *   8. galat & penolakan model: hasil sementara tersimpan, saldo sesuai pemakaian
 *   9. kirim ke alur: pratinjau + konfirmasi, tanpa "ALETA", tanpa rujukan belum
 *      terverifikasi
 */

const ctx = vi.hoisted(() => ({ db: null as unknown, pelaku: null as unknown }));
vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => ctx.db,
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "uji" }));
vi.mock("@/server/modules/aleta-ai/akses", async (asli) => ({
  ...(await asli<typeof import("@/server/modules/aleta-ai/akses")>()),
  pelakuAi: async () => ctx.pelaku,
}));

const jalankanBerkas = promisify(execFile);
const AKAR = path.resolve(process.cwd(), "..");
const PELAKSANA = path.join(AKAR, "sandbox-alat", "pelaksana.py");

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const SEKARANG = new Date("2026-10-25T03:00:00Z");
const pelaku = (id: string, nama: string, peranId: string, extra: Partial<PelakuAi> = {}): PelakuAi => ({ id, nama, peranId, superAdmin: peranId === "super-admin", ...extra });
const HAKIM = pelaku("usr-h1", "Hakim Satu", "hakim");
const KETUA = pelaku("usr-kpa", "Ketua Rekaan", "ketua");
const WAKIL = pelaku("usr-wkpa", "Wakil Rekaan", "wakil-ketua");
const PANITERA = pelaku("usr-pan", "Panitera Kepala", "panitera");
const PANMUD = pelaku("usr-pm", "Panmud Rekaan", "panitera-muda");
const PP = pelaku("usr-pp", "Panitera Alfa", "panitera-pengganti");
const JS = pelaku("usr-js", "Jurusita Beta", "jurusita");
const KASIR = pelaku("usr-ksr", "Kasir Rekaan", "analis-keuangan");
const PTSP = pelaku("usr-ptsp", "Petugas Rekaan", "operator");
const SEKRETARIS = pelaku("usr-sek", "Sekretaris Rekaan", "sekretaris");
const ADMIN = pelaku("usr-adm", "Admin Rekaan", "admin");
const SUPER = pelaku("usr-super", "Super Rekaan", "super-admin");
const SUPER_HAKIM = pelaku("usr-super-h", "Hakim Super Rekaan", "super-admin", { positionId: "pos-hakim" });

// ─── Data rekaan ─────────────────────────────────────────────────────────────

const ASLI = {
  penggugat: "Siti Rekaan binti Ahmad Fiktif",
  penggugatNik: "7203014509900001",
  penggugatAlamat: "Jalan Mawar Rekaan Nomor 7 RT 001",
  tergugat: "Budi Rekaan bin Umar Fiktif",
  tergugatNik: "7203011203880002",
  saksi: "Rahmat Rekaan bin Ahmad",
  saksiNik: "7203015555550009",
  saksiTelepon: "085299990000",
};
const NOMOR = "101/Pdt.G/2026/PA.Dgl";

const PAKET = {
  ditemukan: true,
  perkara: { perkaraId: "1", nomor: NOMOR, jenis: "Cerai Gugat", jenisPerkaraId: "347", alurPerkaraId: "15", tanggalDaftar: "2026-03-02", tahapan: "Persidangan", proses: "Pembuktian" },
  petugas: { majelis: ["Drs. Hakim Satu, M.H.", "Hakim Dua, S.H.I."], ketua: "Drs. Hakim Satu, M.H.", pp: ["Panitera Alfa, S.H."], js: ["Jurusita Beta"] },
  pihak: [
    { pihakKe: 1, urutan: 1, pihakId: 11, nama: ASLI.penggugat, nomor_indentitas: ASLI.penggugatNik, alamat: ASLI.penggugatAlamat, pekerjaan: "Mengurus Rumah Tangga" },
    { pihakKe: 2, urutan: 1, pihakId: 12, nama: ASLI.tergugat, nomor_indentitas: ASLI.tergugatNik, alamat: "Dusun Melati Rekaan RT 003", pekerjaan: "Petani" },
  ],
  jadwal: [{ tanggal: "2026-10-26", agenda: "Pembuktian" }],
  relaas: [],
  putusan: null,
};

const sumberRekaan: SumberDataAi = {
  async jalankan(operasi, parameter) {
    if (operasi !== "perkara.paket") return { ok: true, data: { baris: [] } };
    return { ok: true, data: String(parameter.nomor) === NOMOR ? PAKET : { ditemukan: false } };
  },
};

const PENGETAHUAN_REKAAN = "Rujukan baku: Pasal 116 huruf f Kompilasi Hukum Islam; Pasal 39 ayat (2) UU Nomor 1 Tahun 1974.";

/**
 * Zip proyek REKAAN meniru BENTUK V4.5 (tanpa isi asli): templat HTML yang membaca
 * SATU objek data global lalu menggambar sendiri, dan menyorot penanda V4.5.
 */
const TEMPLAT_SIDANG_REKAAN = `<!doctype html><html><head><meta charset="utf-8"><title>Panduan Sidang Rekaan</title></head><body>
<h1 id="judul"></h1><p id="agenda"></p><ol id="langkah"></ol>
<script>
(function () {
  var d = window.SIDANG || {};
  document.getElementById("judul").textContent = (d.meta && d.meta.judul) || "(tanpa data)";
  document.getElementById("agenda").textContent = d.agenda_berikut || "";
  (d.langkah || []).forEach(function (x) { var li = document.createElement("li"); li.textContent = x; document.getElementById("langkah").appendChild(li); });
  var tampil = ["judul", "agenda", "langkah"].map(function (i) { return document.getElementById(i).textContent; }).join(" ");
  var sorot = tampil.match(/\[(?:placeholder|MASUKKAN|PERLU VERIFIKASI|verifikasi|juz\/hlm)[^\]]*\]/gi) || [];
  document.body.setAttribute("data-sorot", String(sorot.length));
})();
</script></body></html>`;

function zipProyekRekaan(): Buffer {
  return susunZip([
    { nama: "Rekaan_Core_Prompt.md", isi: Buffer.from(`# Core Prompt Rekaan\nAnda asisten hukum rekaan untuk uji. ${PENGETAHUAN_REKAAN}`) },
    { nama: "ALETA_08_Format_Putusan_Rekaan.md", isi: Buffer.from("# Format Putusan Rekaan\nPenanda baris #JUDUL #NOMOR #P #AMAR #TTD.") },
    { nama: "ALETA_13_Template_Panduan_Sidang_Rekaan.html", isi: Buffer.from(TEMPLAT_SIDANG_REKAAN) },
    { nama: "ALETA_18_Template_Komparasi_Rekaan.html", isi: Buffer.from(`<html><body><div id="k"></div><script>document.getElementById("k").textContent = (window.KOMPARASI || {}).kesimpulan || "";</script></body></html>`) },
    { nama: "aleta/aleta_putusan_docx.py", isi: Buffer.from("print('skrip rekaan - tidak disimpan portal')") },
  ]);
}

// ─── Klien model TIRUAN ──────────────────────────────────────────────────────

type Langkah = "rencana" | "susun" | "periksa";
type Skenario = (langkah: Langkah, p: PermintaanAi, opsi: OpsiAlir) => Promise<Partial<HasilAi> | null> | Partial<HasilAi> | null;

const PENGGUNAAN = { masuk: 2000, keluar: 1000, cacheTulis: 0, cacheBaca: 0 };

class KlienTiruan implements KlienAi {
  panggilan: Array<{ langkah: Langkah; p: PermintaanAi }> = [];
  constructor(private skenario: Skenario = () => null) {}
  async alirkan(p: PermintaanAi, opsi: OpsiAlir = {}): Promise<HasilAi> {
    const salinan = JSON.parse(JSON.stringify(p)) as PermintaanAi;
    const isi = JSON.stringify(p.messages);
    const langkah: Langkah = isi.includes("LANGKAH: RENCANA") ? "rencana" : isi.includes("LANGKAH: SUSUN") ? "susun" : "periksa";
    this.panggilan.push({ langkah, p: salinan });
    const khusus = await this.skenario(langkah, salinan, opsi);
    const kode = [...new Set(isi.match(/\[NAMA-\d+\]/g) ?? [])];
    const nik = [...new Set(isi.match(/\[NIK-\d+\]/g) ?? [])];
    const bawaan =
      langkah === "rencana"
        ? "1. Baca data perkara.\n2. Susun duduk perkara.\n3. Periksa amar."
        : `## DUDUK PERKARA\nPenggugat ${kode.at(-2) ?? "[NAMA-1]"} (NIK ${nik.at(-2) ?? "[NIK-1]"}) melawan Tergugat ${kode.at(-1) ?? "[NAMA-2]"}. Saksi ${kode[0] ?? ""} memberi keterangan.\n\n## PERTIMBANGAN HUKUM\nMenimbang Pasal 116 huruf f Kompilasi Hukum Islam dan Pasal 19 huruf f PP Nomor 9 Tahun 1975, disusun dengan ALETA Ai.\n\n| arah | dasar |\n|---|---|\n| dikabulkan | Pasal 116 huruf f KHI |\n\n## AMAR\n1. Mengabulkan gugatan Penggugat.`;
    const teks = khusus?.teks ?? bawaan;
    opsi.onTeks?.(teks);
    return { teks, berhenti: "selesai", model: p.model, penggunaan: PENGGUNAAN, iterasi: [], kategoriTolak: "", dialihkan: false, konten: [{ type: "text", text: teks }], alat: [], ...khusus } as HasilAi;
  }
}

/** Panggilan yang menunggu sampai diputus (sinyal) - untuk uji henti/saklar. */
function tungguPutus(opsi: OpsiAlir, tanda: { mulai: boolean }): Promise<never> {
  tanda.mulai = true;
  return new Promise((_, tolak) => {
    const e = Object.assign(new Error("dibatalkan"), { name: "AbortError" });
    if (opsi.sinyal?.aborted) return tolak(e);
    opsi.sinyal?.addEventListener("abort", () => tolak(e), { once: true });
  });
}

const sampai = async (syarat: () => boolean | Promise<boolean>, batasMs = 5000) => {
  const akhir = Date.now() + batasMs;
  while (!(await syarat())) {
    if (Date.now() > akhir) throw new Error("waktu habis menunggu syarat");
    await new Promise((r) => setTimeout(r, 10));
  }
};

const OPSI = { sekarang: SEKARANG, jedaPantauMs: 15 };

// ─── 1. Migrasi ──────────────────────────────────────────────────────────────

describe("migrasi 0086-0087 - tugas, berkas, templat, kiriman", () => {
  const jurnal = () => JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };

  it("jurnal: 0086 lalu 0087, sesudah 0084/0085, tanpa lubang, when naik", () => {
    const j = jurnal();
    expect(j.entries.map((e) => e.idx)).toEqual(j.entries.map((_, i) => i));
    const a = j.entries.findIndex((e) => e.tag === "0086_aleta_ai_tugas");
    const b = j.entries.findIndex((e) => e.tag === "0087_aleta_ai_templat_kiriman");
    expect(a).toBeGreaterThan(0);
    expect(b).toBe(a + 1);
    expect(/^008[45]_/.test(j.entries[a - 1]!.tag)).toBe(true);
    expect(j.entries[a]!.when).toBeGreaterThan(j.entries[a - 1]!.when);
    expect(j.entries[b]!.when).toBeGreaterThan(j.entries[a]!.when);
  });

  it.each([
    ["0086_aleta_ai_tugas.sql", DDL_ALETA_AI_TUGAS, ["aleta_ai_tugas", "aleta_ai_tugas_langkah", "aleta_ai_berkas"]],
    ["0087_aleta_ai_templat_kiriman.sql", DDL_ALETA_AI_TEMPLAT_KIRIMAN, ["aleta_ai_proyek_berkas", "aleta_ai_kiriman"]],
  ] as const)("%s = DDL schema.ts, jalan di pg-mem, ikut cadangan, tanpa kunci asing/CHECK", (berkas, ddl, tabel) => {
    const teks = readFileSync(path.join(process.cwd(), "drizzle", berkas), "utf8");
    expect(pernyataan(teks)).toEqual([...ddl.tabel, ...ddl.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(teks);
    for (const t of tabel) {
      expect(kosong.public.many(`SELECT * FROM ${t}`)).toEqual([]);
      expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
    }
    expect(/REFERENCES|FOREIGN KEY|CHECK\s*\(/i.test(teks.replace(/--.*$/gm, ""))).toBe(false);
  });
});

// ─── 2. Hak per peran x jenis tugas ─────────────────────────────────────────

describe("hak per peran x jenis tugas (rencana 10.3) - ditegakkan di server", () => {
  const PERAN: Array<[string, PelakuAi]> = [
    ["ketua", KETUA],
    ["wakil", WAKIL],
    ["hakim", HAKIM],
    ["panitera", PANITERA],
    ["panmud", PANMUD],
    ["pp", PP],
    ["js", JS],
    ["kasir", KASIR],
    ["ptsp", PTSP],
    ["sekretaris", SEKRETARIS],
    ["admin", ADMIN],
    ["super-admin", SUPER],
    ["super-admin berjabatan hakim", SUPER_HAKIM],
  ];
  // Urutan PERAN di atas. Draf putusan & komparasi: HANYA Ketua/Wakil/Hakim (golongan atau jabatan).
  const HARAP: Record<JenisTugas, string> = {
    "draf-putusan": "1110000000001",
    "komparasi-arah": "1110000000001",
    "panduan-sidang": "1111110000111",
  };

  it.each(Object.entries(HARAP))("%s", (jenis, harap) => {
    expect(PERAN.map(([, p]) => (cekHakTugas(p, jenis as JenisTugas, null).boleh ? "1" : "0")).join("")).toBe(harap);
  });

  it("timpaan Super Admin pada matriks tidak membuka draf putusan untuk PP (jabatan tetap dijaga)", () => {
    expect(cekHakTugas(PP, "draf-putusan", { "draf-putusan": ["pp", "hakim"] }).boleh).toBe(false);
    expect(cekHakTugas(HAKIM, "draf-putusan", { "draf-putusan": ["pimpinan"] }).boleh).toBe(false);
  });
});

// ─── 3. Penjaga keluaran ─────────────────────────────────────────────────────

describe("penjaga keluaran: rujukan & kata ALETA", () => {
  const naskah = "Menimbang Pasal 116 huruf f Kompilasi Hukum Islam, Pasal 19 huruf f PP Nomor 9 Tahun 1975, dan SEMA Nomor 3 Tahun 2023.";

  it("rujukan yang tertulis di pengetahuan proyek = terverifikasi; lainnya ditandai di draf dan dibuang di berkas resmi", () => {
    expect(bacaRujukan(naskah, PENGETAHUAN_REKAAN).map((r) => [r.teks, r.terverifikasi])).toEqual([
      ["Pasal 116 huruf f Kompilasi Hukum Islam", true],
      ["Pasal 19 huruf f PP Nomor 9 Tahun 1975", false],
      ["SEMA Nomor 3 Tahun 2023", false],
    ]);
    const draf = tandaiRujukan(naskah, PENGETAHUAN_REKAAN);
    expect(draf).toContain(`PP Nomor 9 Tahun 1975 ${TANDA_RUJUKAN}`);
    expect(draf).toContain(`SEMA Nomor 3 Tahun 2023 ${TANDA_RUJUKAN}`);
    expect(draf).not.toContain(`Kompilasi Hukum Islam ${TANDA_RUJUKAN}`);
    const resmi = buangRujukanBelumTerverifikasi(draf, PENGETAHUAN_REKAAN);
    expect(resmi).toContain("Pasal 116 huruf f Kompilasi Hukum Islam");
    expect(resmi).not.toMatch(/PP Nomor 9|SEMA Nomor 3|perlu verifikasi/i);
    // Penanda yang ditulis MODEL (kosakata V4.5): rujukan bertanda dan penanda berisi ikut dibuang; [MASUKKAN ...] tetap.
    const olehModel = "Menurut Pasal 116 huruf f Kompilasi Hukum Islam [PERLU VERIFIKASI] dan [PERLU VERIFIKASI: SEMA 3/2023], nafkah [MASUKKAN jumlah].";
    expect(tandaiRujukan(olehModel, PENGETAHUAN_REKAAN)).toBe(olehModel);
    expect(buangRujukanBelumTerverifikasi(olehModel, PENGETAHUAN_REKAAN)).toBe("Menurut (dasar hukum diisi petugas) dan (dasar hukum diisi petugas), nafkah [MASUKKAN jumlah].");
  });

  it("tanpaKataAleta membuang semua bentuk kata ALETA", () => {
    const h = tanpaKataAleta("Disusun ALETA Ai, dicek aleta dan ALETA_08 untuk Penggugat.");
    expect(adaKataAleta(h)).toBe(false);
    expect(h).toContain("untuk Penggugat");
  });
});

// ─── 3b. Penyamaran teks bebas (keputusan pengguna 24 Okt: "sebisa mungkin") ─

describe("penyamaran teks bebas: nama menurut sebutan, bin/binti, alamat, lahir/umur, NIK berkelompok", () => {
  const CONTOH: Array<[string, string[]]> = [
    ["Saksi Rahmat Rekaan bin Ahmad menerangkan bahwa Penggugat dan Tergugat sering bertengkar.", ["Rahmat Rekaan", "Ahmad"]],
    ["Saksi II: Nurhayati Rekaan, umur 45 tahun, tinggal di Jalan Kenanga Rekaan No. 3 RT 002/RW 001, Kelurahan Talise Rekaan, Kecamatan Mantikulore.", ["Nurhayati Rekaan", "45 tahun", "Kenanga Rekaan", "RT 002", "Talise Rekaan"]],
    ["anak bernama Muhammad Fiktif Rekaan, lahir di Palu, 12 Maret 2015, dan almarhumah Hj. Aminah Rekaan.", ["Muhammad Fiktif Rekaan", "12 Maret 2015", "Aminah Rekaan"]],
    ["Pewaris Haji Umar Rekaan bin La Fiktif meninggalkan ahli waris Andi Rekaan dan istri Wa Ode Rekaan.", ["Umar Rekaan", "La Fiktif", "Andi Rekaan", "Wa Ode Rekaan"]],
    ["NIK 7203 0145 0990 0001, KK 7203011111110001, Sdr. Budi Rekaan, Ibu Sitti Rekaan hadir di Dusun Rekaan Jaya.", ["7203014509900001", "7203011111110001", "Budi Rekaan", "Sitti Rekaan", "Rekaan Jaya"]],
    ["Termohon Konvensi Laode Rekaan dan Pemohon Andi Rekaan Fiktif hadir; Sdri. Rina Rekaan tidak hadir.", ["Laode Rekaan", "Andi Rekaan Fiktif", "Rina Rekaan"]],
  ];

  it.each(CONTOH)("%s", (teks, asli) => {
    const p = new Penyamar();
    const s = p.samarkan(teks);
    expect(dataAsliTersisa(s, asli)).toEqual([]);
    // Dua arah: kode dikembalikan persis.
    expect(p.pulihkan(s)).toBe(teks.replace("7203 0145 0990 0001", "7203014509900001"));
  });

  it("tanpa positif palsu pada istilah pengadilan, sebutan tanpa nama, dan kata biasa", () => {
    const teks =
      "Majelis Hakim Pengadilan Agama Donggala memanggil Penggugat dan Tergugat. Bapak Ketua Majelis membuka sidang; Kuasa Hukum Penggugat hadir. " +
      "Saksi pertama dan saksi kedua disumpah. Perkara berjalan lancar, usia perkawinan 10 tahun, Ibu Kota provinsi. Menimbang Pasal 116 huruf f Kompilasi Hukum Islam.";
    const p = new Penyamar();
    expect(p.samarkan(teks)).toBe(teks);
    expect(p.entri()).toEqual([]);
  });
});

// ─── 4. Berkas keluaran ──────────────────────────────────────────────────────

describe("berkas keluaran DOCX/RTF/PDF/HTML/XLSX: terbuka dan memuat tanda draf", () => {
  const panjang = Array.from({ length: 60 }, (_, i) => `Paragraf ${i + 1} tentang ${ASLI.penggugat} dan pertimbangan yang cukup panjang untuk mengisi halaman.`).join("\n\n");
  const naskah = `## DUDUK PERKARA\nPenggugat ${ASLI.penggugat} melawan ${ASLI.tergugat}.\n\n| arah | dasar |\n|---|---|\n| dikabulkan | Pasal 116 huruf f KHI |\n\n- butir rekaan\n\n${panjang}`;
  const m = (format: FormatBerkas) => ({ format, judul: "Draf Putusan Rekaan", nomorPerkara: NOMOR, naskah, tanggal: "25 Oktober 2026" });

  it("DOCX: zip sah, XML terurai, tanda draf di badan & kepala halaman, data asli", async () => {
    const b = await susunBerkas(m("docx"));
    expect(b.nama).toMatch(/\.docx$/);
    const isi = bacaZip(b.bita);
    const dok = isi.get("word/document.xml")!.toString("utf8");
    expect(uraiXml(dok).documentElement.localName).toBe("document");
    expect(uraiXml(isi.get("word/header1.xml")!.toString("utf8")).documentElement.textContent).toContain(TANDA_DRAF);
    expect(dok).toContain(TANDA_DRAF);
    expect(dok).toContain(ASLI.penggugat);
    expect(dok).toContain("<w:tbl>");
    expect(isi.has("docProps/core.xml")).toBe(false);
  });

  it("RTF: diawali {\\rtf1, kurung seimbang, tanda draf", async () => {
    const t = (await susunBerkas(m("rtf"))).bita.toString("latin1");
    expect(t.startsWith("{\\rtf1")).toBe(true);
    const tanpaLolos = t.replace(/\\[{}\\]/g, "");
    expect((tanpaLolos.match(/\{/g) ?? []).length).toBe((tanpaLolos.match(/\}/g) ?? []).length);
    expect(t).toContain(TANDA_DRAF);
    expect(t).toContain("Siti Rekaan");
  });

  it("PDF: terbaca pdfjs, beberapa halaman, tanda draf di SETIAP halaman, tanpa nama aplikasi", async () => {
    const b = await susunBerkas(m("pdf"));
    const hal = await bacaPdfUji(b.bita);
    expect(hal.length).toBeGreaterThan(1);
    for (const h of hal) expect(h.teks).toContain(TANDA_DRAF);
    expect(hal.map((h) => h.teks).join("\n")).toContain("Siti Rekaan binti Ahmad Fiktif");
    expect(b.bita.toString("latin1")).not.toMatch(/ALETA|pdf-lib/i);
  });

  it("HTML: terurai, banner tanda draf, isi terlolos (tanpa skrip)", async () => {
    const b = await susunBerkas({ ...m("html"), naskah: `${naskah}\n\n<script>alert(1)</script>` });
    const dom = new JSDOM(b.bita.toString("utf8"));
    expect(dom.window.document.querySelector(".tanda-draf")?.textContent).toBe(TANDA_DRAF);
    expect(dom.window.document.querySelector("script")).toBeNull();
    expect(dom.window.document.querySelector("table")?.textContent).toContain("dikabulkan");
  });

  it("XLSX: zip sah, lembar naskah + lembar tabel, tanda draf, tanpa nama aplikasi", async () => {
    const b = await susunBerkas(m("xlsx"));
    const isi = bacaZip(b.bita);
    const semua = [...isi.entries()].filter(([n]) => n.endsWith(".xml")).map(([, v]) => v.toString("utf8"));
    for (const x of semua) expect(uraiXml(x).documentElement).toBeTruthy();
    expect(semua.join("")).toContain(TANDA_DRAF);
    expect([...isi.keys()].filter((n) => n.startsWith("xl/worksheets/sheet"))).toHaveLength(2);
    expect(semua.join("")).not.toMatch(/ALETA/);
  });

  it("naskah berpenanda ALETA_08 (#JUDUL #P #AMAR ...) terbaca di cadangan tanpa tanda pagar", async () => {
    const naskah = `#BISMILLAH Bismillah\n#JUDUL PUTUSAN\n#NOMOR ${NOMOR}\n#P Penggugat ${ASLI.penggugat}.\n#BR\n#AMAR MENGADILI\n#AR 1. Mengabulkan gugatan Penggugat;\n#TTD Hakim Rekaan`;
    const b = await susunBerkas({ ...m("docx"), naskah });
    const dok = bacaZip(b.bita).get("word/document.xml")!.toString("utf8");
    expect(dok).toContain("MENGADILI");
    expect(dok).toContain(`Penggugat ${ASLI.penggugat}.`);
    expect(dok).not.toMatch(/#(JUDUL|AMAR|P|AR|TTD|BR)\b/);
  });

  it("XLSX komparasi: objek KOMPARASI.angka {kolom, baris} menjadi lembar Angka", async () => {
    const objek = { nama: "KOMPARASI", data: { angka: { kolom: ["Komponen", "Arah A", "Arah B"], baris: [["Nafkah iddah", 3000000, 1500000], { Komponen: "Mut'ah", "Arah A": 5000000, "Arah B": 2000000 }] } } };
    const b = await susunBerkas({ ...m("xlsx"), objek });
    const isi = bacaZip(b.bita);
    const lembar = [...isi.keys()].filter((n) => n.startsWith("xl/worksheets/sheet"));
    expect(lembar).toHaveLength(3);
    const semua = [...isi.values()].map((v) => v.toString("utf8")).join("");
    expect(semua).toContain("Nafkah iddah");
    expect(semua).toContain("3000000");
    expect(semua).toMatch(/Mut(?:&apos;|&#39;|')ah/);
  });
});

// ─── 5. Sandbox ──────────────────────────────────────────────────────────────

describe("sandbox alat bantu: hanya daftar izin; model hanya meminta 'alat X masukan Y'", () => {
  let db: AletaDatabase;
  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
  }, 180000);
  afterAll(async () => {
    suntikPelariSandbox(undefined);
    await db?.close();
  });

  it("portal menolak alat di luar daftar TANPA menyentuh sandbox; fitur mati tanpa spool", async () => {
    const dipanggil: PermintaanSandbox[] = [];
    suntikPelariSandbox({ jalankan: async (p) => (dipanggil.push(p), { ok: true, keluaran: {} }) });
    const penyamar = await muatPenyamar(db, "ait-uji-sandbox");
    const k = { db, pelaku: HAKIM, tugasId: "ait-uji-sandbox", penyamar, naskah: () => "" };
    // Alat CETAK (putusan-docx) hanya untuk sistem: model memintanya = ditolak juga.
    for (const alat of ["hapus-semua", "../../bin/sh", "os.system", "", "putusan-docx"]) {
      expect((await jalankanAlatBantu(k, { alat, masukan: {} })).status).toBe("tolak");
    }
    expect((await jalankanAlatBantu(k, { alat: "terbilang", masukan: { kode: { bersarang: true } } })).status).toBe("galat");
    expect(dipanggil).toHaveLength(0);
    const jejak = await db.queryAll<{ hasil: string }>(`SELECT hasil FROM aleta_ai_jejak WHERE aksi = 'alat-bantu' AND hasil = 'tolak'`);
    expect(jejak.length).toBe(5);

    suntikPelariSandbox(null);
    expect((await jalankanAlatBantu(k, { alat: "terbilang", masukan: { angka: 3_000_000 } })).status).toBe("mati");

    // Alat yang diizinkan: hasilnya disamarkan sebelum ke model; naskah ikut sebagai berkas.
    suntikPelariSandbox({ jalankan: async (p) => (dipanggil.push(p), { ok: true, keluaran: { nama: ASLI.penggugat, total: 1_500_000 } }) });
    const h = await jalankanAlatBantu({ ...k, naskah: () => "naskah [NAMA-1]" }, { alat: "cek-konsistensi", masukan: {} });
    expect(h.status).toBe("ok");
    expect(JSON.stringify(h.isi)).not.toContain(ASLI.penggugat);
    expect(dipanggil[0]).toMatchObject({ alat: "cek-konsistensi", berkas: [expect.objectContaining({ nama: "naskah.md" })] });
  });

  it("pelaksana Python SUNGGUHAN lewat folder antrian: skrip izin jalan; alat di luar izin, jalur menaik, dan batas waktu ditolak", async () => {
    const akar = mkdtempSync(path.join(tmpdir(), "sandbox-uji-"));
    const skrip = path.join(akar, "skrip");
    mkdirSync(skrip);
    writeFileSync(path.join(skrip, "kalkulator_rekaan.py"), "import json,sys,os\nm=json.load(sys.stdin)\nopen('keluar/hasil.txt','w').write('ok')\nprint(json.dumps({'nafkah': m['gaji']//3, 'berkas': m['berkas']}))\n");
    writeFileSync(path.join(skrip, "lambat.py"), "import time\ntime.sleep(30)\n");
    writeFileSync(path.join(akar, "rahasia.py"), "print('tidak boleh')\n");
    const izin = path.join(akar, "izin.json");
    writeFileSync(path.join(skrip, "aleta_alat_rekaan.py"), "import json,sys\nprint(json.dumps({'argv': sys.argv[1:]}))\n");
    writeFileSync(
      izin,
      JSON.stringify({
        "kalkulator-nafkah": { skrip: "kalkulator_rekaan.py" },
        "cek-blangko": { skrip: "../rahasia.py" },
        anonim: { skrip: "lambat.py" },
        terbilang: { skrip: "aleta_alat_rekaan.py", argumen: ["terbilang", "{angka}"] },
        "putusan-docx": { skrip: "aleta_alat_rekaan.py", argumen: ["masuk/naskah.txt", "{judul}", "keluar/putusan.{format}"] },
      })
    );
    const spool = path.join(akar, "spool");
    mkdirSync(path.join(spool, "masuk"), { recursive: true });
    const pelari: PelariSandbox = pelariAntrian(spool, 20);
    const env = { ...process.env, SANDBOX_SPOOL: spool, SANDBOX_SKRIP: skrip, SANDBOX_IZIN: izin, SANDBOX_KERJA: akar };
    let urut = 0;
    const jalan = async (alat: string, batasMs = 5000, masukan: Record<string, unknown> = { gaji: 3_000_000 }) => {
      const janji = pelari.jalankan({ id: `uji-${alat}-${++urut}`, alat, masukan, berkas: [{ nama: "naskah.md", bita: Buffer.from("isi") }], batasMs });
      await sampai(() => readdirSync(path.join(spool, "masuk")).some((n) => !n.startsWith(".")));
      await jalankanBerkas("python3", [PELAKSANA, "--sekali"], { env, timeout: 20_000 });
      return janji;
    };
    expect(await jalan("kalkulator-nafkah")).toMatchObject({ ok: true, keluaran: { nafkah: 1_000_000, berkas: ["naskah.md"] }, berkas: [expect.objectContaining({ nama: "hasil.txt" })] });
    expect(await jalan("hapus-semua")).toMatchObject({ ok: false, galat: "Alat di luar daftar izin." });
    expect(await jalan("cek-blangko")).toMatchObject({ ok: false, galat: "Skrip alat tidak tersedia." });
    expect(await jalan("anonim", 1000)).toMatchObject({ ok: false, galat: "Alat melewati batas waktu." });
    // Subperintah TETAP dari izin; "{nama}" diisi masukan; nilai berawalan "-" / format asing / kurang ditolak.
    expect(await jalan("terbilang", 5000, { angka: 1500000 })).toMatchObject({ ok: true, keluaran: { argv: ["terbilang", "1500000"] } });
    expect(await jalan("putusan-docx", 5000, { judul: `${NOMOR} - Cerai Gugat`, format: "rtf" })).toMatchObject({ ok: true, keluaran: { argv: ["masuk/naskah.txt", `${NOMOR} - Cerai Gugat`, "keluar/putusan.rtf"] } });
    expect(await jalan("putusan-docx", 5000, { judul: "--hapus", format: "rtf" })).toMatchObject({ ok: false, galat: "Masukan alat tidak sah: judul" });
    expect(await jalan("putusan-docx", 5000, { judul: "x", format: "exe" })).toMatchObject({ ok: false, galat: "Format tidak sah." });
    expect(await jalan("terbilang", 5000, {})).toMatchObject({ ok: false, galat: "Masukan alat kurang: angka" });
    // Antrian bersih sesudahnya.
    expect(readdirSync(path.join(spool, "masuk"))).toEqual([]);
    expect(readdirSync(path.join(spool, "keluar"))).toEqual([]);
  }, 60_000);

  it("berkas compose/Dockerfile sandbox: tanpa jaringan, baca-saja, batas memori/proses, skrip baca-saja", () => {
    const compose = readFileSync(path.join(AKAR, "sandbox-alat", "docker-compose.yml"), "utf8");
    expect(compose).toMatch(/network_mode:\s*none/);
    expect(compose).toMatch(/read_only:\s*true/);
    expect(compose).toMatch(/mem_limit:/);
    expect(compose).toMatch(/pids_limit:/);
    expect(compose).toMatch(/cap_drop:\s*\[ALL\]/);
    expect(compose).toMatch(/\.\/skrip:\/skrip:ro/);
    expect(readFileSync(path.join(AKAR, "sandbox-alat", "Dockerfile"), "utf8")).toMatch(/^USER 10001$/m);
    expect(readFileSync(path.join(AKAR, "sandbox-alat", ".gitignore"), "utf8")).toMatch(/^skrip\/$/m);
  });
});

// ─── 6-9. Tugas ──────────────────────────────────────────────────────────────

describe("tugas (cowork): kebocoran, berkas, berhenti/lanjut/bertahan, saklar, galat, kiriman", () => {
  let db: AletaDatabase;
  const SALDO_AWAL = 2_000_000;

  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
    ctx.db = db;
    await simpanKurs(db, { tanggal: tanggalLokal(), kurs: 16000, sumber: "uji" });
    await simpanKurs(db, { tanggal: tanggalLokal(SEKARANG), kurs: 16000, sumber: "uji" });
    await unggahProyek(db, SUPER.id, { bita: zipProyekRekaan(), namaBerkas: "rekaan.zip" });
    for (const p of [HAKIM, PP, KETUA]) await terapkanMutasi(db, { penggunaId: p.id, jenis: "isi", jumlahRp: SALDO_AWAL, catatan: "uji" });
    suntikSumberDataAi(sumberRekaan);
  }, 180000);
  afterAll(async () => {
    suntikKlienAi(undefined);
    suntikSumberDataAi(undefined);
    suntikPelariSandbox(undefined);
    await db?.close();
  });
  afterEach(async () => {
    suntikPelariSandbox(undefined);
    if (await saklarDaruratMenyala(db)) await simpanPengaturan(db, SUPER.id, { aktif: true });
  });

  const tugasBaru = async (p: PelakuAi = HAKIM, jenis: JenisTugas = "draf-putusan", format: FormatBerkas = "docx") =>
    (await buatTugas(db, p, { jenis, nomorPerkara: NOMOR, format, instruksi: `Saksi ${ASLI.saksi} NIK ${ASLI.saksiNik} hp ${ASLI.saksiTelepon} menguatkan dalil.` })).id;
  const jalanSampaiAkhir = async (p: PelakuAi, id: string) => jalankanTugas(db, p, await ambilAlihTugas(db, p, id), OPSI);
  const mutasiTugas = (p: PelakuAi, id: string) =>
    db.queryAll<{ jenis: string; jumlah_rp: number; rujukan_id: string }>(`SELECT jenis, jumlah_rp, rujukan_id FROM aleta_ai_mutasi WHERE pengguna_id = ? AND rujukan_id LIKE ? ORDER BY dibuat_at, id`, [p.id, `${id}%`]);
  const hargaUsd = async (usd: number) => {
    const pg = await bacaPengaturan(db);
    return hitungHarga(usd, 16000, { marginPersen: pg.marginPersen, penyanggaKursPersen: pg.penyanggaKursPersen, minimumRp: pg.minimumRp, pembulatanRp: pg.pembulatanRp }).tagihRp;
  };
  const usdLangkah = async (id: string, kode: string) =>
    Number((await db.queryOne<{ u: number }>(`SELECT biaya_usd AS u FROM aleta_ai_tugas_langkah WHERE tugas_id = ? AND kode = ?`, [id, kode]))?.u ?? 0);

  it("templat proyek REKAAN tersimpan dari zip (bukan dari repo); skrip .py tidak disimpan portal", async () => {
    const proyek = (await proyekAktif(db))!;
    const baris = await db.queryAll<{ nama: string; jenis: string }>(`SELECT nama, jenis FROM aleta_ai_proyek_berkas WHERE proyek_id = ? ORDER BY nama`, [proyek.id]);
    expect(baris).toEqual([
      { nama: "ALETA_13_Template_Panduan_Sidang_Rekaan.html", jenis: "html" },
      { nama: "ALETA_18_Template_Komparasi_Rekaan.html", jenis: "html" },
    ]);
    expect(await pilihTemplat(db, proyek.id, /(^|\/)ALETA_10_[^/]*\.html?$/i)).toBeNull();
    expect((await pilihTemplat(db, proyek.id, /(^|\/)ALETA_13_[^/]*\.html?$/i))?.nama).toBe("ALETA_13_Template_Panduan_Sidang_Rekaan.html");
  });

  it("TUGAS PENUH + UJI KEBOCORAN: langkah terlihat, tidak ada data asli ke model, berkas berdata asli & bertanda draf, saldo = pemakaian", async () => {
    const klien = new KlienTiruan();
    suntikKlienAi(klien);
    const id = await tugasBaru(HAKIM, "draf-putusan", "docx");
    const hasil = await jalanSampaiAkhir(HAKIM, id);
    expect(hasil.status).toBe("selesai");

    // Model: Opus high (draf putusan), tiga langkah model, data perkara lewat alat baca-saja.
    expect(klien.panggilan.map((x) => x.langkah)).toEqual(["rencana", "susun", "periksa"]);
    expect(new Set(klien.panggilan.map((x) => `${x.p.model}/${x.p.effort}`))).toEqual(new Set(["claude-opus-5-5/high"]));

    // KEBOCORAN: tidak satu pun nilai asli (pihak dari SIPP rekaan + saksi dari instruksi) keluar ke model.
    const terkirim = JSON.stringify(klien.panggilan.map((x) => x.p));
    // Termasuk nama BEBAS di instruksi ("Saksi Rahmat Rekaan bin Ahmad") - pengenal pola penyamar.
    expect(dataAsliTersisa(terkirim, [...Object.values(ASLI), "Siti Rekaan", "Budi Rekaan", "Jalan Mawar Rekaan", "Dusun Melati Rekaan"])).toEqual([]);
    expect(terkirim).toContain("[NAMA-");
    expect(terkirim).toContain(NOMOR);

    const t = await ambilTugas(db, HAKIM, id);
    expect(t.langkah?.map((l) => `${l.kode}:${l.status}`)).toEqual(["rencana:selesai", "ambil-data:selesai", "susun:selesai", "periksa:selesai", "berkas:selesai"]);
    expect(t.langkah?.filter((l) => l.token > 0).map((l) => l.kode)).toEqual(["rencana", "susun", "periksa"]);
    // Model/effort/token tercatat per langkah dan di aleta_ai_penggunaan (pola yang sama).
    const pakai = await db.queryAll<{ pesan_id: string; jenis: string; model: string; effort: string; token_masuk: number }>(`SELECT pesan_id, jenis, model, effort, token_masuk FROM aleta_ai_penggunaan WHERE percakapan_id = ?`, [id]);
    expect(pakai).toHaveLength(3);
    expect(pakai.every((p) => p.jenis === "tugas" && p.model === "claude-opus-5-5" && p.effort === "high" && Number(p.token_masuk) === 2000)).toBe(true);

    // Berkas: sandbox mati -> DOCX CADANGAN + HTML pratinjau; data ASLI, tanda draf, rujukan belum terverifikasi ditandai.
    expect(t.berkas?.map((b) => [b.format, b.templat])).toEqual([
      ["docx", ""],
      ["html", ""],
    ]);
    expect(t.langkah?.at(-1)?.catatan).toBe("DOCX, HTML; DOCX cadangan");
    const docx = await unduhBerkas(db, HAKIM, id, t.berkas![0]!.id);
    const dok = bacaZip(docx.bita).get("word/document.xml")!.toString("utf8");
    expect(dok).toContain(TANDA_DRAF);
    expect(dok).toContain(ASLI.penggugat);
    expect(dok).toMatch(new RegExp(`${ASLI.saksiNik}|${ASLI.penggugatNik}`));
    expect(dok).not.toMatch(/\[(NAMA|NIK)-\d+\]/);
    expect(dok).toContain(`PP Nomor 9 Tahun 1975 ${TANDA_RUJUKAN}`);
    expect(dok).not.toContain(`Kompilasi Hukum Islam ${TANDA_RUJUKAN}`);
    const html = (await unduhBerkas(db, HAKIM, id, t.berkas![1]!.id)).bita.toString("utf8");
    expect(new JSDOM(html).window.document.querySelector(".tanda-draf")?.textContent).toBe(TANDA_DRAF);
    // Hasil langkah DISIMPAN tersamar; berkas & hasil akhir berdata asli dan terenkripsi.
    const mentah = await db.queryAll<{ hasil: string }>(`SELECT hasil FROM aleta_ai_tugas_langkah WHERE tugas_id = ? AND hasil <> ''`, [id]);
    for (const b of mentah) expect(b.hasil).toMatch(/^enc:v1:/);
    expect((await db.queryOne<{ isi: string }>(`SELECT isi FROM aleta_ai_berkas WHERE tugas_id = ? LIMIT 1`, [id]))!.isi).toMatch(/^enc:v1:/);

    // Saldo: satu tahan untuk jalan ini, dilepas, potong = harga biaya API aktual.
    const usd = (await usdLangkah(id, "rencana")) + (await usdLangkah(id, "susun")) + (await usdLangkah(id, "periksa"));
    const harga = await hargaUsd(usd);
    expect((await mutasiTugas(HAKIM, id)).map((m) => m.jenis)).toEqual(["tahan", "lepas", "potong"]);
    expect((await mutasiTugas(HAKIM, id)).at(-1)!.jumlah_rp).toBe(-harga);
    expect(t.biayaRp).toBe(harga);
    expect((await verifikasiSaldo(db, HAKIM.id)).seimbang).toBe(true);

    // Rahasia musyawarah: pemilik lain / Super Admin tidak dapat membuka.
    await expect(ambilTugas(db, SUPER, id)).rejects.toMatchObject({ status: 404 });
    await expect(unduhBerkas(db, KETUA, id, t.berkas![0]!.id)).rejects.toMatchObject({ status: 404 });
  });

  it("PANDUAN SIDANG: templat HTML V4.5 (rekaan) membaca window.SIDANG berdata asli; penanda V4.5 tersorot; tanpa kode samaran", async () => {
    const klien = new KlienTiruan((langkah, p) => {
      if (langkah === "rencana") return null;
      const kode = [...new Set(JSON.stringify(p.messages).match(/\[NAMA-\d+\]/g) ?? [])];
      const objek = {
        meta: { judul: `Panduan Sidang ${kode.at(-2) ?? ""} melawan ${kode.at(-1) ?? ""}` },
        agenda_berikut: "Pembuktian, dasar Pasal 19 huruf f PP Nomor 9 Tahun 1975",
        langkah: [`Periksa saksi ${kode[0] ?? ""}`, "Nafkah [MASUKKAN jumlah]"],
      };
      return { teks: `## PANDUAN\nPeriksa ${kode.at(-2) ?? ""}.\n\n\`\`\`json\n${JSON.stringify(objek)}\n\`\`\`` };
    });
    suntikKlienAi(klien);
    const id = await tugasBaru(PP, "panduan-sidang", "pdf");
    expect((await jalanSampaiAkhir(PP, id)).status).toBe("selesai");
    expect(JSON.stringify(klien.panggilan.find((x) => x.langkah === "susun")!.p.messages)).toMatch(/blok ```json berisi objek data SIDANG/);
    const t = await ambilTugas(db, PP, id);
    expect(t.berkas?.map((b) => [b.format, b.templat])).toEqual([
      ["pdf", ""],
      ["html", "ALETA_13_Template_Panduan_Sidang_Rekaan.html"],
    ]);
    const html = (await unduhBerkas(db, PP, id, t.berkas![1]!.id)).bita.toString("utf8");
    expect(html.indexOf("window.SIDANG = ")).toBeLessThan(html.indexOf("var d = window.SIDANG"));
    expect(html).not.toMatch(/\[(NAMA|NIK)-\d+\]/);
    const dom = new JSDOM(html, { runScripts: "dangerously" });
    const doc = dom.window.document;
    expect(doc.getElementById("judul")?.textContent).toBe(`Panduan Sidang ${ASLI.penggugat} melawan ${ASLI.tergugat}`);
    expect(doc.querySelectorAll("#langkah li")).toHaveLength(2);
    expect(doc.getElementById("agenda")?.textContent).toContain(`PP Nomor 9 Tahun 1975 ${TANDA_RUJUKAN}`);
    expect(doc.body.getAttribute("data-sorot")).toBe("2"); // [PERLU VERIFIKASI] + [MASUKKAN jumlah]
    expect(doc.querySelector(".tanda-draf")?.textContent).toBe(TANDA_DRAF);
    // Hasil akhir (untuk kiriman) = naskah tanpa blok JSON.
    expect(t.hasil).toContain(`Periksa ${ASLI.penggugat}.`);
    expect(t.hasil).not.toContain("```json");
  });

  it("DRAF PUTUSAN dicetak skrip V4.5 di sandbox (naskah berpenanda + judul '<Nomor> - <Jenis>'), tanda draf dibubuhkan; gagal = cadangan", async () => {
    const naskahModel = (p: PermintaanAi) => {
      const kode = [...new Set(JSON.stringify(p.messages).match(/\[NAMA-\d+\]/g) ?? [])];
      return `#JUDUL PUTUSAN\n#NOMOR ${NOMOR}\n#P Penggugat ${kode.at(-2)} melawan Tergugat ${kode.at(-1)}.\n#AMAR MENGADILI\n#AR Mengabulkan gugatan Penggugat;`;
    };
    suntikKlienAi(new KlienTiruan((langkah, p) => (langkah === "rencana" ? null : { teks: naskahModel(p) })));
    const diminta: PermintaanSandbox[] = [];
    const docxSkrip = susunZip([{ nama: "word/document.xml", isi: Buffer.from(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>PUTUSAN SKRIP REKAAN</w:t></w:r></w:p></w:body></w:document>`) }]);
    suntikPelariSandbox({ jalankan: async (p) => (diminta.push(p), { ok: true, keluaran: {}, berkas: [{ nama: "putusan.docx", bita: docxSkrip }] }) });
    const id = await tugasBaru(HAKIM, "draf-putusan", "docx");
    expect((await jalanSampaiAkhir(HAKIM, id)).status).toBe("selesai");
    expect(diminta).toHaveLength(1);
    expect(diminta[0]).toMatchObject({ alat: "putusan-docx", masukan: { judul: `${NOMOR} - Cerai Gugat`, format: "docx" } });
    const naskahKeSandbox = diminta[0]!.berkas[0]!;
    expect(naskahKeSandbox.nama).toBe("naskah.txt");
    expect(naskahKeSandbox.bita.toString("utf8")).toContain(`#P Penggugat ${ASLI.penggugat} melawan Tergugat ${ASLI.tergugat}.`);
    const t = await ambilTugas(db, HAKIM, id);
    expect(t.berkas?.map((b) => [b.format, b.templat])).toEqual([
      ["docx", "sandbox:putusan-docx"],
      ["html", ""],
    ]);
    const dok = bacaZip((await unduhBerkas(db, HAKIM, id, t.berkas![0]!.id)).bita).get("word/document.xml")!.toString("utf8");
    expect(dok).toContain("PUTUSAN SKRIP REKAAN");
    expect(dok).toContain(TANDA_DRAF);

    // Kiriman Draf H-7: penanda baris tidak ikut.
    const u = await usulkanKiriman(db, HAKIM, id, { tujuan: "draf-h7" });
    expect(u.nilai.teks).toContain(`Penggugat ${ASLI.penggugat} melawan`);
    expect(u.nilai.teks).not.toMatch(/^#/m);

    // Sandbox gagal -> penyusun cadangan, dicatat.
    suntikPelariSandbox({ jalankan: async () => ({ ok: false, galat: "Alat gagal" }) });
    const id2 = await tugasBaru(HAKIM, "draf-putusan", "rtf");
    expect((await jalanSampaiAkhir(HAKIM, id2)).status).toBe("selesai");
    const t2 = await ambilTugas(db, HAKIM, id2);
    expect(t2.berkas?.[0]).toMatchObject({ format: "rtf", templat: "" });
    expect(t2.langkah?.at(-1)?.catatan).toBe("RTF, HTML; RTF cadangan");
    expect((await unduhBerkas(db, HAKIM, id2, t2.berkas![0]!.id)).bita.toString("latin1")).toContain(TANDA_DRAF);
  });

  it("perkara rumit (instruksi waris) -> Opus max; panduan sidang -> Sonnet high; PP ditolak draf putusan", async () => {
    const rumit = await buatTugas(db, HAKIM, { jenis: "draf-putusan", instruksi: "Perkara kewarisan dengan rekonvensi." });
    expect((await db.queryOne<{ model: string; effort: string }>(`SELECT model, effort FROM aleta_ai_tugas WHERE id = ?`, [rumit.id]))).toEqual({ model: "claude-opus-5-5", effort: "max" });
    const panduan = await buatTugas(db, PP, { jenis: "panduan-sidang", nomorPerkara: NOMOR });
    expect((await db.queryOne<{ model: string; effort: string }>(`SELECT model, effort FROM aleta_ai_tugas WHERE id = ?`, [panduan.id]))).toEqual({ model: "claude-sonnet-5-5", effort: "high" });
    await expect(buatTugas(db, PP, { jenis: "draf-putusan" })).rejects.toMatchObject({ status: 403 });
    await expect(buatTugas(db, SUPER, { jenis: "komparasi-arah" })).rejects.toMatchObject({ status: 403 });
    const jejak = await db.queryAll<{ ringkas: string }>(`SELECT ringkas FROM aleta_ai_jejak WHERE aksi = 'tolak-kemampuan' AND pengguna_id = ?`, [PP.id]);
    expect(jejak.map((j) => j.ringkas)).toContain("tugas=draf-putusan");
  });

  it("rute: POST /api/aleta-ai/tugas PP draf putusan 403; hakim 201; GET hanya tugas sendiri + jenis berhak", async () => {
    const { GET, POST } = await import("@/app/api/aleta-ai/tugas/route");
    const kirim = (badan: unknown) => POST(new NextRequest("http://lokal/api/aleta-ai/tugas", { method: "POST", body: JSON.stringify(badan) }));
    ctx.pelaku = PP;
    expect((await kirim({ jenis: "draf-putusan", mulai: false })).status).toBe(403);
    expect((await kirim({ jenis: "komparasi-arah", mulai: false })).status).toBe(403);
    expect((await kirim({ jenis: "panduan-sidang", format: "exe", mulai: false })).status).toBe(400);
    const g = (await (await GET(new NextRequest("http://lokal/api/aleta-ai/tugas"))).json()) as { data: { jenis: Array<{ jenis: string; boleh: boolean }>; tugas: Array<{ id: string }> } };
    expect(Object.fromEntries(g.data.jenis.map((j) => [j.jenis, j.boleh]))).toEqual({ "draf-putusan": false, "panduan-sidang": true, "komparasi-arah": false });
    ctx.pelaku = HAKIM;
    const r = await kirim({ jenis: "draf-putusan", nomorPerkara: NOMOR, mulai: false });
    expect(r.status).toBe(201);
    const { data } = (await r.json()) as { data: { id: string } };
    ctx.pelaku = PP;
    const { GET: GET1 } = await import("@/app/api/aleta-ai/tugas/[id]/route");
    expect((await GET1(new NextRequest(`http://lokal/api/aleta-ai/tugas/${data.id}`), { params: Promise.resolve({ id: data.id }) })).status).toBe(404);
  });

  it("BERHENTI lalu LANJUT: langkah selesai tidak diulang, saldo dipotong per jalan sesuai pemakaian", async () => {
    const tanda = { mulai: false };
    let tahan = true;
    const klien = new KlienTiruan((langkah, _p, opsi) => (langkah === "susun" && tahan ? tungguPutus(opsi, tanda) : null));
    suntikKlienAi(klien);
    const id = await tugasBaru();
    const jalan1 = jalankanTugas(db, HAKIM, await ambilAlihTugas(db, HAKIM, id), OPSI);
    await sampai(() => tanda.mulai);
    await expect(ambilAlihTugas(db, HAKIM, id)).rejects.toMatchObject({ status: 409 }); // satu pelari saja
    await hentikanTugas(db, HAKIM, id);
    const h1 = await jalan1;
    expect(h1.status).toBe("dijeda");
    const t1 = await ambilTugas(db, HAKIM, id);
    expect(t1.langkah?.map((l) => l.status)).toEqual(["selesai", "selesai", "menunggu", "menunggu", "menunggu"]);
    const harga1 = await hargaUsd(await usdLangkah(id, "rencana"));
    expect(t1.biayaRp).toBe(harga1);

    tahan = false;
    const h2 = await jalanSampaiAkhir(HAKIM, id);
    expect(h2.status).toBe("selesai");
    expect(klien.panggilan.filter((x) => x.langkah === "rencana")).toHaveLength(1);
    const m = await mutasiTugas(HAKIM, id);
    expect(m.map((x) => `${x.jenis}@${x.rujukan_id === id ? 1 : x.rujukan_id.split(":")[1]}`)).toEqual(["tahan@1", "lepas@1", "potong@1", "tahan@2", "lepas@2", "potong@2"]);
    const harga2 = await hargaUsd((await usdLangkah(id, "susun")) + (await usdLangkah(id, "periksa")));
    expect(h2.biayaRp).toBe(harga1 + harga2);
    expect((await verifikasiSaldo(db, HAKIM.id)).seimbang).toBe(true);
  });

  it("BERTAHAN: status di tabel; pelari yang mati (denyut basi) diambil alih, tahanannya ditutup, lanjut dari langkah yang belum selesai", async () => {
    const klien = new KlienTiruan();
    suntikKlienAi(klien);
    const id = await tugasBaru();
    // Keadaan sesudah server mati di tengah "susun": jalan 1 menahan dana, rencana & ambil-data selesai.
    const tugas = await ambilAlihTugas(db, HAKIM, id);
    expect(await tahanDana(db, HAKIM.id, 50_000, id)).toBe(true);
    await db.run(`UPDATE aleta_ai_tugas_langkah SET status = 'selesai', hasil = '' WHERE tugas_id = ? AND kode IN ('rencana', 'ambil-data')`, [id]);
    await db.run(`UPDATE aleta_ai_tugas_langkah SET status = 'berjalan' WHERE tugas_id = ? AND kode = 'susun'`, [id]);
    await db.run(`UPDATE aleta_ai_tugas SET usd_segmen = 0.05, detak_at = ? WHERE id = ?`, [new Date(Date.now() - 10 * 60_000).toISOString(), id]);
    expect(Number(tugas.segmen)).toBe(1);
    expect((await ambilTugas(db, HAKIM, id)).terputus).toBe(true);

    const saldoSebelum = await saldoPengguna(db, HAKIM.id);
    const h = await jalanSampaiAkhir(HAKIM, id);
    expect(h.status).toBe("selesai");
    expect(klien.panggilan.map((x) => x.langkah)).toEqual(["susun", "periksa"]);
    const m = await mutasiTugas(HAKIM, id);
    expect(m.filter((x) => x.rujukan_id === id).map((x) => x.jenis)).toEqual(["tahan", "lepas", "potong"]);
    expect(m.filter((x) => x.rujukan_id === id).at(-1)!.jumlah_rp).toBe(-(await hargaUsd(0.05)));
    expect(await saldoPengguna(db, HAKIM.id)).toBeLessThan(saldoSebelum + 50_000);
    expect((await verifikasiSaldo(db, HAKIM.id)).seimbang).toBe(true);
  });

  it("SAKLAR DARURAT menghentikan tugas yang berjalan; hasil sementara tersimpan; saldo sesuai pemakaian; lanjut sesudah saklar hidup", async () => {
    const tanda = { mulai: false };
    let tahan = true;
    suntikKlienAi(new KlienTiruan((langkah, _p, opsi) => (langkah === "periksa" && tahan ? tungguPutus(opsi, tanda) : null)));
    const id = await tugasBaru();
    const jalan = jalankanTugas(db, HAKIM, await ambilAlihTugas(db, HAKIM, id), OPSI);
    await sampai(() => tanda.mulai);
    await simpanPengaturan(db, SUPER.id, { aktif: false });
    expect(await saklarDaruratMenyala(db)).toBe(true);
    const h = await jalan;
    expect(h.status).toBe("dihentikan");
    expect(h.pesan).toBe(PESAN_DIHENTIKAN_SAKLAR);
    const t = await ambilTugas(db, HAKIM, id);
    expect(t.langkah?.map((l) => l.status)).toEqual(["selesai", "selesai", "selesai", "menunggu", "menunggu"]);
    expect(t.langkah?.find((l) => l.kode === "susun")?.ringkas).toContain(ASLI.penggugat);
    expect(t.biayaRp).toBe(await hargaUsd((await usdLangkah(id, "rencana")) + (await usdLangkah(id, "susun"))));

    // Selama saklar mati, lanjut pun langsung berhenti tanpa memanggil model / menahan dana.
    const h2 = await jalanSampaiAkhir(HAKIM, id);
    expect(h2.status).toBe("dihentikan");
    tahan = false;
    await simpanPengaturan(db, SUPER.id, { aktif: true });
    expect((await jalanSampaiAkhir(HAKIM, id)).status).toBe("selesai");
    expect((await verifikasiSaldo(db, HAKIM.id)).seimbang).toBe(true);
  });

  it("SALDO HABIS: berhenti \"saldo habis\" sebelum langkah yang tak tertutup; hasil sementara tersimpan; isi saldo lalu lanjut dari langkah terakhir", async () => {
    const H = pelaku("usr-h-saldo", "Hakim Satu", "hakim");
    // Tanpa saldo: berhenti sebelum memanggil model, tanpa menahan apa pun.
    const awal = new KlienTiruan();
    suntikKlienAi(awal);
    const id = await tugasBaru(H);
    const h0 = await jalanSampaiAkhir(H, id);
    expect(h0.status).toBe("saldo-habis");
    expect(h0.pesan).toMatch(/^Berhenti: saldo habis\./);
    expect(awal.panggilan).toHaveLength(0);

    // Saldo S; "rencana" memakai hampir seluruh S -> sebelum "susun" tahanan tidak dapat ditambah.
    const S = 200_000;
    await terapkanMutasi(db, { penggunaId: H.id, jenis: "isi", jumlahRp: S, catatan: "uji" });
    const pg = await bacaPengaturan(db);
    const tarif = (await bacaTarif(db)).find((x) => x.model === "claude-opus-5-5")!;
    const faktor = 16000 * (1 + pg.penyanggaKursPersen / 100) * (1 + pg.marginPersen / 100);
    const keluar = Math.floor((((S - 700) / faktor) * 1e6) / tarif.keluarPerJuta);
    const klien = new KlienTiruan((langkah) => (langkah === "rencana" ? { penggunaan: { masuk: 0, keluar, cacheTulis: 0, cacheBaca: 0 } } : null));
    suntikKlienAi(klien);
    const h1 = await jalanSampaiAkhir(H, id);
    expect(h1.status).toBe("saldo-habis");
    expect(klien.panggilan.map((x) => x.langkah)).toEqual(["rencana"]);
    const t1 = await ambilTugas(db, H, id);
    expect(t1.langkah?.map((l) => l.status)).toEqual(["selesai", "selesai", "menunggu", "menunggu", "menunggu"]);
    const harga1 = await hargaUsd(await usdLangkah(id, "rencana"));
    expect(harga1).toBeLessThan(S);
    expect(t1.biayaRp).toBe(harga1);
    expect(await saldoPengguna(db, H.id)).toBe(S - harga1);

    // Isi saldo -> jalan baru (tahanan baru) dari langkah "susun"; rencana tidak diulang.
    await terapkanMutasi(db, { penggunaId: H.id, jenis: "isi", jumlahRp: 1_000_000, catatan: "uji" });
    const lanjut = new KlienTiruan();
    suntikKlienAi(lanjut);
    const h2 = await jalanSampaiAkhir(H, id);
    expect(h2.status).toBe("selesai");
    expect(lanjut.panggilan.map((x) => x.langkah)).toEqual(["susun", "periksa"]);
    const m = (await mutasiTugas(H, id)).filter((x) => Number(x.jumlah_rp) !== 0);
    const jalan = [...new Set(m.map((x) => x.rujukan_id))];
    expect(jalan).toHaveLength(2);
    for (const r of jalan) expect(m.filter((x) => x.rujukan_id === r).map((x) => x.jenis)).toEqual(["tahan", "lepas", "potong"]);
    expect((await verifikasiSaldo(db, H.id)).seimbang).toBe(true);
  });

  it("PENOLAKAN model: hasil sementara tersimpan, langkah ditolak tidak ditagih, saldo = pemakaian sebelumnya", async () => {
    const klien = new KlienTiruan((langkah) => (langkah === "susun" ? { teks: "", berhenti: "ditolak", kategoriTolak: "uji" } : null));
    suntikKlienAi(klien);
    const id = await tugasBaru();
    const h = await jalanSampaiAkhir(HAKIM, id);
    expect(h.status).toBe("gagal");
    expect(h.pesan).toMatch(/ditolak oleh pengaman/);
    const t = await ambilTugas(db, HAKIM, id);
    expect(t.langkah?.map((l) => l.status)).toEqual(["selesai", "selesai", "gagal", "menunggu", "menunggu"]);
    expect(t.langkah?.[0]?.ringkas).toContain("Baca data perkara");
    // Panggilan yang ditolak tetap tercatat (token), tetapi tidak ditagih.
    expect(await usdLangkah(id, "susun")).toBeGreaterThan(0);
    expect(t.biayaRp).toBe(await hargaUsd(await usdLangkah(id, "rencana")));
    expect(t.berkas).toEqual([]);
  });

  it("GALAT layanan & BATAS token: galat = gagal dengan hasil sementara; terpotong = naskah sementara disimpan dan tugas berlanjut", async () => {
    suntikKlienAi(new KlienTiruan((langkah) => {
      if (langkah === "periksa") throw new GalatKlienAi("beban", "Layanan AI sedang terlalu padat. Coba lagi sebentar lagi.");
      return null;
    }));
    const id = await tugasBaru();
    const h = await jalanSampaiAkhir(HAKIM, id);
    expect(h).toMatchObject({ status: "gagal", pesan: "Layanan AI sedang terlalu padat. Coba lagi sebentar lagi." });
    expect(h.biayaRp).toBe(await hargaUsd((await usdLangkah(id, "rencana")) + (await usdLangkah(id, "susun"))));
    expect((await ambilTugas(db, HAKIM, id)).langkah?.[2]?.status).toBe("selesai");
    // Dicoba lagi: hanya langkah gagal yang diulang.
    const klien = new KlienTiruan();
    suntikKlienAi(klien);
    expect((await jalanSampaiAkhir(HAKIM, id)).status).toBe("selesai");
    expect(klien.panggilan.map((x) => x.langkah)).toEqual(["periksa"]);

    suntikKlienAi(new KlienTiruan((langkah) => (langkah === "susun" ? { teks: "## AMAR\nSebagian naskah", berhenti: "batas" } : null)));
    const id2 = await tugasBaru();
    expect((await jalanSampaiAkhir(HAKIM, id2)).status).toBe("selesai");
    expect((await ambilTugas(db, HAKIM, id2)).langkah?.find((l) => l.kode === "susun")).toMatchObject({ status: "selesai", catatan: expect.stringMatching(/terpotong/) });
  });

  it("alat bantu dalam tugas: ditawarkan bila sandbox hidup, hasilnya disamarkan ke model", async () => {
    let putaran = 0;
    suntikPelariSandbox({ jalankan: async () => ({ ok: true, keluaran: { nafkah: 1_000_000, untuk: ASLI.penggugat } }) });
    const klien = new KlienTiruan((langkah) =>
      langkah === "susun" && putaran++ === 0 ? { teks: "", berhenti: "alat", alat: [{ id: "tu-1", name: "jalankan_alat_bantu", input: { alat: "terbilang", masukan: { angka: 3_000_000 } } }], konten: [{ type: "tool_use", id: "tu-1", name: "jalankan_alat_bantu", input: {} }] } : null
    );
    suntikKlienAi(klien);
    const id = await tugasBaru();
    expect((await jalanSampaiAkhir(HAKIM, id)).status).toBe("selesai");
    const susun = klien.panggilan.filter((x) => x.langkah === "susun");
    expect(susun[0]!.p.tools?.map((t) => t.name)).toContain("jalankan_alat_bantu");
    const hasilAlat = JSON.stringify(susun[1]!.p.messages.at(-1));
    expect(hasilAlat).toContain("1000000");
    expect(hasilAlat).not.toContain(ASLI.penggugat);
  });

  it("KIRIM KE ALUR: pratinjau + konfirmasi petugas, tanpa kata ALETA, tanpa rujukan belum terverifikasi; hanya pemilik", async () => {
    suntikKlienAi(new KlienTiruan());
    const id = await tugasBaru();
    expect((await jalanSampaiAkhir(HAKIM, id)).status).toBe("selesai");
    await expect(usulkanKiriman(db, HAKIM, id, { tujuan: "bas" })).rejects.toMatchObject({ status: 400 });
    const u = await usulkanKiriman(db, HAKIM, id, { tujuan: "draf-h7" });
    expect(u.status).toBe("menunggu-konfirmasi");
    expect(adaKataAleta(u.nilai.teks!)).toBe(false);
    expect(u.nilai.teks).toContain(ASLI.penggugat);
    expect(u.nilai.teks).toContain("Pasal 116 huruf f Kompilasi Hukum Islam");
    expect(u.nilai.teks).not.toMatch(/PP Nomor 9 Tahun 1975|perlu verifikasi|Draf AI/i);
    // Belum terkirim sebelum dikonfirmasi.
    expect(await kirimanUntukAlur(db, HAKIM, "draf-h7", NOMOR)).toEqual([]);
    await expect(konfirmasiKiriman(db, KETUA, u.id, true)).rejects.toMatchObject({ status: 404 });
    expect((await konfirmasiKiriman(db, HAKIM, u.id, true)).status).toBe("dikonfirmasi");
    await expect(konfirmasiKiriman(db, HAKIM, u.id, true)).rejects.toMatchObject({ status: 409 });
    const alur = await kirimanUntukAlur(db, HAKIM, "draf-h7", NOMOR);
    expect(alur.map((x) => x.id)).toEqual([u.id]);
    expect(await kirimanUntukAlur(db, KETUA, "draf-h7", NOMOR)).toEqual([]);

    // Blangko Derry: isian per penanda, dibersihkan juga.
    const b = await usulkanKiriman(db, HAKIM, id, { tujuan: "blangko-derry", isian: { "#0047#": `${ASLI.tergugat} (ALETA)`, alasan: "Menurut SEMA Nomor 3 Tahun 2023 dan Pasal 116 huruf f Kompilasi Hukum Islam" } });
    expect(b.nilai.isian).toEqual({ "#0047#": `${ASLI.tergugat} ()`, alasan: "Menurut (dasar hukum diisi petugas) dan Pasal 116 huruf f Kompilasi Hukum Islam" });
    await expect(usulkanKiriman(db, HAKIM, id, { tujuan: "blangko-derry", isian: { "<script>": "x" } })).rejects.toMatchObject({ status: 400 });
    expect((await konfirmasiKiriman(db, HAKIM, b.id, false)).status).toBe("dibatalkan");

    // Rute konfirmasi: badan wajib boolean.
    const { POST } = await import("@/app/api/aleta-ai/kiriman/[id]/route");
    ctx.pelaku = HAKIM;
    const salah = await POST(new NextRequest(`http://lokal/api/aleta-ai/kiriman/${u.id}`, { method: "POST", body: "{}" }), { params: Promise.resolve({ id: u.id }) });
    expect(salah.status).toBe(400);
    // Tidak ada tabel SIPP/ABT yang disentuh: semua tulis ALETA Ai ke tabel aleta_ai_*.
    const tulis = await db.queryAll<{ aksi: string }>(`SELECT aksi FROM aleta_ai_jejak WHERE percakapan_id = ? ORDER BY waktu`, [id]);
    expect(tulis.map((x) => x.aksi)).toEqual(expect.arrayContaining(["kiriman.usul", "kiriman.konfirmasi", "kiriman.batal"]));
  });
});
