// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { newDb } from "pg-mem";
import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FITUR_SAKSI_KE_BAS_SIPP, KATALOG_FITUR_SATKER, keadaanFitur } from "@/lib/fitur-satker";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_SAKSI_KIRIM_BAS } from "@/server/db/schema";
import { bacaKirimBasPerkara, bersihkanMasukanKirimBas, catatKirimBas, lupakanBersihTerakhir } from "@/server/modules/aleta-ecourt/saksi-ke-bas";
import { KUNCI_FITUR_SATKER } from "@/server/modules/satker/fitur";
import { tulisSetelanSistem } from "@/server/modules/satker/setelan";

/**
 * ============================================================================
 * 25 OKT 2026 - RANTAI C, C6 (U10): KIRIM KETERANGAN SAKSI KE BAS SIPP
 * ============================================================================
 *
 * MENULIS KE SIPP (e-Doc BAS), maka dijaga berlapis: saklar "saksi-ke-bas-sipp" bawaan MATI; pratinjau dulu; persetujuan petugas;
 * keterangan saksi dibaca ulang dari ABT dan e-Doc dibaca ulang dari SIPP tepat sebelum menulis; naskah bertanda aplikasi ditahan;
 * setiap percobaan tercatat (sidik + hitungan). Semua data di bawah REKAAN.
 */

type Apa = any;
const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(AKAR, n), "utf8");
const muat = createRequire(import.meta.url);
const K: Apa = muat(path.join(AKAR, "saksi-ke-bas.js"));

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

// ─── 1. Migrasi, jurnal, saklar ──────────────────────────────────────────────

describe("migrasi 0101, jurnal, saklar", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0101_aleta_saksi_kirim_bas.sql");

  it("jurnal: 0101 sekali di idx 90 (sesudah 0100), tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0101_"))).toEqual([expect.objectContaining({ idx: 90, tag: "0101_aleta_saksi_kirim_bas" })]);
    expect(j.entries[82]?.tag.startsWith("0093_")).toBe(true);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i]?.when).toBeGreaterThan(j.entries[i - 1]?.when ?? 0);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_SAKSI_KIRIM_BAS, berjalan di pg-mem, ikut cadangan", () => {
    const isiSql = readFileSync(SQL, "utf8");
    expect(pernyataan(isiSql)).toEqual([...DDL_SAKSI_KIRIM_BAS.tabel, ...DDL_SAKSI_KIRIM_BAS.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(isiSql);
    expect(kosong.public.many(`SELECT * FROM aleta_saksi_kirim_bas`)).toEqual([]);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_saksi_kirim_bas");
  });

  it("saklar saksi-ke-bas-sipp: bawaan MATI, bagian ekstensi", () => {
    expect(KATALOG_FITUR_SATKER.find((f) => f.kode === FITUR_SAKSI_KE_BAS_SIPP)).toMatchObject({ bawaan: "mati", bagian: "ekstensi" });
    expect(keadaanFitur(FITUR_SAKSI_KE_BAS_SIPP, {}).menyala).toBe(false);
  });
});

// ─── 2. Server ───────────────────────────────────────────────────────────────

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
vi.mock("@/server/db/client", async (asli) => ({ ...(await asli<typeof import("@/server/db/client")>()), getDatabase: async () => db }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

const nyalakan = (d: AletaDatabase) =>
  tulisSetelanSistem(d, KUNCI_FITUR_SATKER, { fitur: { [FITUR_SAKSI_KE_BAS_SIPP]: "stabil" }, diubahOleh: "uji", diubahPada: new Date().toISOString() }, new Date().toISOString());

async function panggil(cara: "GET" | "POST", opsi: { query?: string; badan?: unknown } = {}) {
  const modul = await import("@/app/api/aleta-ecourt/saksi-ke-bas/route");
  const req = new NextRequest("http://localhost/api/x" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const res = await (modul as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara](req);
  return { status: res.status, isi: (await res.json().catch(() => ({}))) as Apa };
}
const CATATAN = { perkaraId: "123", nomorPerkara: "55/Pdt.G/2026/PA.Dgl", sidangId: "9", urutanSidang: 2, tahap: "kirim", hasil: "berhasil", jumlahSaksi: 2, jumlahJawaban: 14, jumlahHilang: 0, ukuran: 40960, sidik: "ab12cd", catatan: "BAS sidang ke-2 masuk ke e-Doc SIPP" };

describe("jejak kirim BAS di portal", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    lupakanBersihTerakhir();
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("masukan disaring: perkara/tahap/hasil sah; nama aplikasi dibuang; angka dibatasi; sidik hanya heksadesimal", () => {
    expect(bersihkanMasukanKirimBas(null)).toBeNull();
    expect(bersihkanMasukanKirimBas({ ...CATATAN, perkaraId: "x" })).toBeNull();
    expect(bersihkanMasukanKirimBas({ ...CATATAN, tahap: "hapus" })).toBeNull();
    expect(bersihkanMasukanKirimBas({ ...CATATAN, hasil: "entah" })).toBeNull();
    const m = bersihkanMasukanKirimBas({ ...CATATAN, catatan: "dikirim oleh ALETA ke SIPP", sidik: "ZZ!", jumlahJawaban: -5, ukuran: "9e99" });
    expect(m).toMatchObject({ sidik: "", jumlahJawaban: 0 });
    expect(m?.catatan).not.toMatch(/aleta/i);
    expect(m?.ukuran).toBeLessThanOrEqual(100_000_000);
  });

  it("saklar MATI: POST tidak menulis apa pun; GET saklar menjawab false", async () => {
    expect((await panggil("GET", { query: "bagian=saklar" })).isi.data).toEqual({ aktif: false });
    const r = await panggil("POST", { badan: CATATAN });
    expect(r.status).toBe(200);
    expect(r.isi.data).toMatchObject({ aktif: false, dicatat: false });
    expect(await db!.queryAll(`SELECT * FROM aleta_saksi_kirim_bas`)).toEqual([]);
    expect((await panggil("GET", { query: "perkaraId=123" })).isi.data).toEqual({ aktif: false, daftar: [] });
  });

  it("saklar MENYALA: tercatat dengan pengguna; dibaca per perkara; masukan tidak sah tidak ditulis", async () => {
    await nyalakan(db!);
    expect((await panggil("GET", { query: "bagian=saklar" })).isi.data).toEqual({ aktif: true });
    const r = await panggil("POST", { badan: CATATAN });
    expect(r.isi.data).toMatchObject({ aktif: true, dicatat: true });
    const tak = await panggil("POST", { badan: { ...CATATAN, hasil: "entah" } });
    expect(tak.isi.data).toMatchObject({ aktif: true, dicatat: false });
    const baris = await bacaKirimBasPerkara(db!, "123");
    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatchObject({ nomor_perkara: "55/Pdt.G/2026/PA.Dgl", tahap: "kirim", hasil: "berhasil", jumlah_saksi: 2, sidik: "ab12cd" });
    expect(String(baris[0].pengguna_nama)).not.toBe("");
    expect((await panggil("GET", { query: "perkaraId=123" })).isi.data.daftar).toHaveLength(1);
    expect(await bacaKirimBasPerkara(db!, "bukan-angka")).toEqual([]);
  });

  it("hak: hakim dan tanpa masuk ditolak (sama dengan unggah BAS)", async () => {
    await nyalakan(db!);
    aktor = "usr-hakim";
    expect((await panggil("POST", { badan: CATATAN })).status).toBe(403);
    expect((await panggil("GET", { query: "perkaraId=123" })).status).toBe(403);
    aktor = null;
    expect([401, 403]).toContain((await panggil("POST", { badan: CATATAN })).status);
    expect(await db!.queryAll(`SELECT * FROM aleta_saksi_kirim_bas`)).toEqual([]);
  });

  it("retensi 2 tahun: catatan lebih tua dibersihkan, yang baru tetap", async () => {
    await nyalakan(db!);
    const lama = new Date(Date.now() - 800 * 86_400_000).toISOString();
    await db!.run(`INSERT INTO aleta_saksi_kirim_bas (id, perkara_id, nomor_perkara, pada) VALUES ('lama', '123', 'x', ?)`, [lama]);
    await catatKirimBas(db!, { id: "usr-super", nama: "Super" }, CATATAN);
    await new Promise((r) => setTimeout(r, 50));
    const sisa = await db!.queryAll<Record<string, unknown>>(`SELECT id FROM aleta_saksi_kirim_bas`);
    expect(sisa.map((s) => s.id)).not.toContain("lama");
    expect(sisa).toHaveLength(1);
  });
});

// ─── 3. Ekstensi: murni ──────────────────────────────────────────────────────

describe("saksi-ke-bas.js: bagian murni", () => {
  it("cariBaris: perkara + urutan sidang; urutan kosong hanya bila satu-satunya; bukan jenis bas diabaikan", () => {
    const d = [
      { jenis: "bas", nomorPerkara: "55/Pdt.G/2026/PA.Dgl", urutan: 1, perkaraId: "1" },
      { jenis: "bas", nomorPerkara: "55/Pdt.G/2026/PA.Dgl", urutan: 2, perkaraId: "1" },
      { jenis: "putusan", nomorPerkara: "55/Pdt.G/2026/PA.Dgl", urutan: 3 },
      { jenis: "bas", nomorPerkara: "60/Pdt.G/2026/PA.Dgl", urutan: 1, perkaraId: "2" },
    ];
    expect(K.cariBaris(d, "55/Pdt.G/2026/PA.Dgl", 2)).toMatchObject({ urutan: 2 });
    expect(K.cariBaris(d, "55 / Pdt.G / 2026 / PA.Dgl", 1)).toMatchObject({ urutan: 1 });
    expect(K.cariBaris(d, "55/Pdt.G/2026/PA.Dgl", 3)).toBeNull();
    expect(K.cariBaris(d, "55/Pdt.G/2026/PA.Dgl", 0)).toBeNull();
    expect(K.cariBaris(d, "60/Pdt.G/2026/PA.Dgl", 0)).toMatchObject({ perkaraId: "2" });
    expect(K.cariBaris([], "x", 1)).toBeNull();
  });

  const SAKSI = [
    { label: "Saksi Penggugat/Pemohon 1", baris: [{ tanya: "Kenal?", jawab: "Ya, saya kenal dengan Penggugat dan Tergugat karena saya tetangganya;" }, { tanya: "Bertengkar?", jawab: "Pernah, tiga kali." }] },
    { label: "Saksi Penggugat/Pemohon 2", baris: [{ tanya: "Kenal?", jawab: "Saya adalah ibu kandung Penggugat." }] },
  ];
  it("periksaSaksiDiNaskah: jawaban yang ada di naskah dihitung, yang tidak ada dilaporkan", () => {
    const naskah = "BERITA ACARA SIDANG ... Ya, saya kenal dengan Penggugat dan Tergugat karena saya tetangganya; Pernah, tiga kali. ";
    const p = K.periksaSaksiDiNaskah(naskah, SAKSI);
    expect(p).toMatchObject({ jumlahSaksi: 2, total: 3, ada: 2 });
    expect(p.hilang).toEqual([expect.objectContaining({ saksi: "Saksi Penggugat/Pemohon 2", no: 1 })]);
    const semua = K.periksaSaksiDiNaskah(`${naskah} Saya adalah ibu kandung Penggugat sendiri.`, SAKSI);
    expect(semua.hilang).toEqual([]);
    const kosong = K.periksaSaksiDiNaskah("x", [{ label: "Saksi T 1", baris: [{ jawab: "  " }] }]);
    expect(kosong).toMatchObject({ jumlahSaksi: 0, total: 0, kosong: ["Saksi T 1"] });
  });

  it("tanda aplikasi dikenali di naskah", () => {
    expect(K.adaTandaAplikasi("dibuat oleh Aleta")).toBe(true);
    expect(K.adaTandaAplikasi("BERITA ACARA SIDANG")).toBe(false);
  });
});

// ─── 4. Ekstensi: alur dengan kait tiruan ────────────────────────────────────

const BARIS = { jenis: "bas", kunci: "bas:9", perkaraId: "123", sidangId: "9", nomorPerkara: "55/Pdt.G/2026/PA.Dgl", urutan: 2, tanggal: "2026-10-26" };
const ABT_SAKSI: Record<string, Array<{ pertanyaan: string; jawaban: string }>> = {
  "P1": [{ pertanyaan: "Kenal?", jawaban: "Ya, saya kenal dengan Penggugat dan Tergugat karena saya tetangganya;" }],
  "P2": [{ pertanyaan: "Kenal?", jawaban: "Saya adalah ibu kandung Penggugat sendiri;" }],
};
const NASKAH_BAIK = "BERITA ACARA SIDANG 55/Pdt.G/2026/PA.Dgl Ya, saya kenal dengan Penggugat dan Tergugat karena saya tetangganya; Saya adalah ibu kandung Penggugat sendiri;";

function buatKait(sisip: Apa = {}) {
  const panggilan = { siapkan: 0, unggah: 0, jejak: [] as Apa[], saksiDibaca: 0 };
  const abt = { ...ABT_SAKSI };
  const kait: Apa = {
    nomorPerkara: () => "55/Pdt.G/2026/PA.Dgl",
    urutanSidang: () => "2",
    daftarBas: async () => [BARIS],
    siapkan: async () => {
      panggilan.siapkan += 1;
      return { keadaan: "siap", halangan: "", catatan: ["2 isian blangko masih kosong di naskah - periksa sebelum diunggah."], rtf: new Uint8Array(40960), ukuran: 40960, nama: "55 - BAS 2.rtf", perlu: { bas: true } };
    },
    unggah: async () => {
      panggilan.unggah += 1;
      return { hasil: "berhasil", catatan: "BAS sidang ke-2 masuk ke e-Doc SIPP", berkas: "x.rtf" };
    },
    teksRtf: () => NASKAH_BAIK,
    bacaSaksi: async (pihak: string, ke: number) => {
      panggilan.saksiDibaca += 1;
      return abt[`${pihak}${ke}`] || null;
    },
    catatJejak: async (e: Apa) => void panggilan.jejak.push(e),
    ...sisip,
  };
  return { kait, panggilan, abt };
}

describe("saksi-ke-bas.js: pratinjau dan kirim", () => {
  it("pratinjau siap: tidak menulis (unggah tidak dipanggil), jawaban saksi ditemukan di naskah", async () => {
    const { kait, panggilan } = buatKait();
    const p = await K.pratinjau(kait);
    expect(p.siap).toBe(true);
    expect(p.halangan).toEqual([]);
    expect(p.periksa).toMatchObject({ jumlahSaksi: 2, total: 2, ada: 2 });
    expect(p.sidik).toMatch(/^[0-9a-f]{8,64}$/);
    expect(panggilan.unggah).toBe(0);
    expect(p.catatan.join(" ")).toMatch(/masih kosong/);
  });

  it("e-Doc BAS sudah ada di SIPP: berhenti sebelum mencetak, tidak pernah diganti dari sini", async () => {
    const { kait, panggilan } = buatKait({ daftarBas: async () => [{ ...BARIS, adaBas: true, jalurBas: "resources/file/doc/2026/10/x.pdf" }] });
    const p = await K.pratinjau(kait);
    expect(p.siap).toBe(false);
    expect(p.dobel).toBe(true);
    expect(p.halangan[0]).toMatch(/sudah ada di SIPP/);
    expect(p.halangan[0]).toMatch(/Ganti/);
    expect(panggilan.siapkan).toBe(0);
    expect((await K.kirim(kait, p)).hasil).toBe("dilewati");
    expect(panggilan.unggah).toBe(0);
  });

  it("sidang tidak ada di daftar hak petugas: halangan jelas, tidak mencetak", async () => {
    const { kait, panggilan } = buatKait({ daftarBas: async () => [] });
    const p = await K.pratinjau(kait);
    expect(p.siap).toBe(false);
    expect(p.halangan[0]).toMatch(/tidak ada dalam daftar BAS/);
    expect(panggilan.siapkan).toBe(0);
  });

  it("belum ada keterangan saksi di ABT: ditahan", async () => {
    const { kait, panggilan } = buatKait({ bacaSaksi: async () => null });
    const p = await K.pratinjau(kait);
    expect(p.siap).toBe(false);
    expect(p.halangan[0]).toMatch(/Belum ada keterangan saksi/);
    expect(panggilan.siapkan).toBe(0);
  });

  it("naskah bertanda aplikasi atau tanpa jawaban saksi: tidak siap", async () => {
    const a = await K.pratinjau(buatKait({ teksRtf: () => `${NASKAH_BAIK} dibuat oleh Aleta` }).kait);
    expect(a.siap).toBe(false);
    expect(a.halangan.join(" ")).toMatch(/tanda aplikasi/);
    const b = await K.pratinjau(buatKait({ teksRtf: () => "BERITA ACARA SIDANG tanpa keterangan" }).kait);
    expect(b.siap).toBe(false);
    expect(b.halangan.join(" ")).toMatch(/2 jawaban saksi tidak ditemukan/);
  });

  it("mesin Unggah massal menolak (hak ABT, validasi hakim, dst.): halamannya diteruskan, tidak siap", async () => {
    const { kait } = buatKait({ siapkan: async () => ({ keadaan: "halangan", halangan: "BAS sidang ke-2 masih menunggu validasi hakim di ABT.", catatan: [] }) });
    const p = await K.pratinjau(kait);
    expect(p.siap).toBe(false);
    expect(p.halangan).toEqual(["BAS sidang ke-2 masih menunggu validasi hakim di ABT."]);
  });

  it("kirim atas pratinjau siap: ABT dibaca ulang, unggah SEKALI, tercatat tanpa isi BAS", async () => {
    const { kait, panggilan } = buatKait();
    const p = await K.pratinjau(kait);
    const bacaSebelum = panggilan.saksiDibaca;
    const h = await K.kirim(kait, p);
    expect(h.hasil).toBe("berhasil");
    expect(panggilan.unggah).toBe(1);
    expect(panggilan.saksiDibaca).toBeGreaterThan(bacaSebelum);
    const e = panggilan.jejak.at(-1);
    expect(e).toMatchObject({ tahap: "kirim", hasil: "berhasil", perkaraId: "123", sidangId: "9", urutanSidang: 2, jumlahSaksi: 2, jumlahJawaban: 2, jumlahHilang: 0 });
    expect(JSON.stringify(e)).not.toMatch(/aleta|kenal dengan/i);
  });

  it("keterangan saksi di ABT berubah sejak pratinjau: dibatalkan, tidak ada yang ditulis, tercatat", async () => {
    const { kait, panggilan, abt } = buatKait();
    const p = await K.pratinjau(kait);
    abt["P2"] = [{ pertanyaan: "Kenal?", jawaban: "Saya adalah tetangga Penggugat." }];
    const h = await K.kirim(kait, p);
    expect(h.hasil).toBe("dibatalkan");
    expect(panggilan.unggah).toBe(0);
    expect(panggilan.jejak.at(-1)).toMatchObject({ tahap: "kirim", hasil: "dibatalkan" });
  });

  it("e-Doc terisi orang lain tepat sebelum menulis (mesin melapor dobel): hasil dobel dicatat", async () => {
    const { kait, panggilan } = buatKait({ unggah: async () => ({ hasil: "dobel", catatan: "e-Doc BAS sudah ada di SIPP - tidak diganti" }) });
    const p = await K.pratinjau(kait);
    expect((await K.kirim(kait, p)).hasil).toBe("dobel");
    expect(panggilan.jejak.at(-1)).toMatchObject({ hasil: "dobel" });
  });

  it("galat tak terduga saat unggah: gagal, tidak melempar, tercatat", async () => {
    const { kait, panggilan } = buatKait({ unggah: async () => { throw new Error("jaringan putus"); } });
    const p = await K.pratinjau(kait);
    const h = await K.kirim(kait, p);
    expect(h.hasil).toBe("gagal");
    expect(panggilan.jejak.at(-1)).toMatchObject({ hasil: "gagal" });
  });
});

// ─── 5. Ekstensi: tombol dan persetujuan ─────────────────────────────────────

const halaman: JSDOM[] = [];
afterEach(() => {
  while (halaman.length) halaman.pop()!.window.close();
});
const tunggu = async (kondisi: () => boolean, pesan: string) => {
  for (let i = 0; i < 300; i += 1) {
    if (kondisi()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`menunggu: ${pesan}`);
};

function pasang(saklar: boolean | "galat", kait: Apa) {
  const dom = new JSDOM("<!doctype html><body><div id='aksi'></div><div id='form'></div></body>", { runScripts: "outside-only" });
  halaman.push(dom);
  const w = dom.window as Apa;
  w.fetch = async () => {
    if (saklar === "galat") return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ ok: true, data: { fitur: { "saksi-ke-bas-sipp": saklar } } }) };
  };
  w.eval(`${baca("saklar-fitur.js")}\n;\n${baca("saksi-ke-bas.js")}`);
  const buat = (tag: string, kelas: string, teks?: string) => {
    const e = w.document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks) e.textContent = teks;
    return e;
  };
  const aksi = w.document.getElementById("aksi");
  const form = w.document.getElementById("form");
  // modul dimuat di jendela jsdom, tetapi `document` yang dipakainya milik jendela itu juga
  const r = w.AletaSaksiKeBas.pasangTombol(aksi, form, kait, buat);
  return { w, aksi, form, ...r };
}

describe("saksi-ke-bas.js: tombol dan persetujuan", () => {
  it("saklar MATI atau gagal bertanya: tombol tetap tersembunyi (perilaku lama)", async () => {
    for (const s of [false, "galat"] as const) {
      const { kait } = buatKait();
      const { tombol } = pasang(s, kait);
      await new Promise((r) => setTimeout(r, 60));
      expect(tombol.hidden).toBe(true);
    }
  });

  it("saklar MENYALA: tombol tampil; pratinjau tampil dulu; Kirim terkunci sampai kotak persetujuan dicentang; tanpa persetujuan tidak menulis", async () => {
    const { kait, panggilan } = buatKait();
    const { tombol, panel } = pasang(true, kait);
    await tunggu(() => tombol.hidden === false, "tombol tampil");
    tombol.click();
    await tunggu(() => Boolean(panel.querySelector("[data-aksi-kirim-bas]")), "pratinjau selesai");
    expect(panel.textContent).toMatch(/Keterangan saksi di ABT: 2 saksi, 2 jawaban; di naskah BAS ditemukan 2, tidak ditemukan 0/);
    expect(panel.textContent).toMatch(/Cuplikan keterangan saksi/);
    const kirimTombol = panel.querySelector("[data-aksi-kirim-bas]");
    expect(kirimTombol.disabled).toBe(true);
    kirimTombol.click();
    await new Promise((r) => setTimeout(r, 40));
    expect(panggilan.unggah).toBe(0);
    // pratinjau tercatat
    await tunggu(() => panggilan.jejak.length >= 1, "jejak pratinjau");
    expect(panggilan.jejak[0]).toMatchObject({ tahap: "pratinjau", hasil: "siap" });
    const cb = panel.querySelector("[data-setuju-kirim-bas]");
    cb.checked = true;
    cb.dispatchEvent(new (panel.ownerDocument.defaultView as Apa).Event("change"));
    expect(kirimTombol.disabled).toBe(false);
    kirimTombol.click();
    await tunggu(() => /Terkirim/.test(panel.textContent), "hasil kirim");
    expect(panggilan.unggah).toBe(1);
    expect(panggilan.jejak.at(-1)).toMatchObject({ tahap: "kirim", hasil: "berhasil" });
  });

  it("pratinjau yang tidak siap: tidak ada kotak persetujuan maupun tombol Kirim", async () => {
    const { kait, panggilan } = buatKait({ daftarBas: async () => [{ ...BARIS, adaBas: true }] });
    const { tombol, panel } = pasang(true, kait);
    await tunggu(() => tombol.hidden === false, "tombol tampil");
    tombol.click();
    await tunggu(() => /sudah ada di SIPP/.test(panel.textContent), "halangan tampil");
    expect(panel.querySelector("[data-aksi-kirim-bas]")).toBeNull();
    expect(panel.querySelector("[data-setuju-kirim-bas]")).toBeNull();
    expect(panggilan.unggah).toBe(0);
    await tunggu(() => panggilan.jejak.length >= 1, "jejak");
    expect(panggilan.jejak[0]).toMatchObject({ tahap: "pratinjau", hasil: "dobel" });
  });
});

// ─── 6. Perekat ──────────────────────────────────────────────────────────────

describe("perekat di ekstensi dan portal", () => {
  it("manifest dan penyusun ekstensi memuat saksi-ke-bas.js sebelum abt.js", () => {
    const m = JSON.parse(baca("manifest.json")) as { content_scripts: Array<{ js: string[] }> };
    const entri = m.content_scripts.find((c) => c.js.includes("saksi-ke-bas.js"));
    expect(entri).toBeTruthy();
    expect(entri!.js.indexOf("saksi-ke-bas.js")).toBeLessThan(entri!.js.indexOf("abt.js"));
    expect(entri!.js.indexOf("saksi-ke-bas.js")).toBeGreaterThan(entri!.js.indexOf("saksi-susun.js"));
    expect(readFileSync(path.join(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8")).toContain('"saksi-ke-bas.js"');
  });

  it("kait di abt.js memakai mesin Unggah massal (cek dobel + rute bas/unggah-sipp), bukan jalur tulis baru; saksi-susun memasang tombol", () => {
    const abt = baca("abt.js");
    const kait = abt.slice(abt.indexOf("function kaitKirimBasSipp()"), abt.indexOf("/* === 17OKT-F41"));
    expect(kait).toContain("f41Mesin()");
    expect(kait).toContain("m().siapkan(");
    expect(kait).toContain("m().unggah(");
    expect(kait).not.toMatch(/unggah-sipp/);
    expect(abt).toContain("kirimBas: kaitKirimBasSipp()");
    expect(baca("saksi-susun.js")).toMatch(/AletaSaksiKeBas\.pasangTombol\(aksi, form, k\.kirimBas, buat\)/);
  });

  it("tidak satu kata nama aplikasi di nilai yang dikirim ke SIPP oleh modul (hanya kata penjaga)", () => {
    const sumber = baca("saksi-ke-bas.js");
    const tulisan = sumber.split("\n").filter((b) => /aleta/i.test(b) && !/^\s*(\*|\/\/|\/\*)/.test(b));
    // hanya pola penjaga /aleta/i dan nama saklar/API/global yang tidak pernah masuk ke SIPP
    for (const b of tulisan) expect(b).toMatch(/\/aleta\/i|\/aleta\/|AletaSa|aleta-ecourt|AletaSaklarFitur|aleta-(?:permintaan|sdg|abt)/);
  });
});
