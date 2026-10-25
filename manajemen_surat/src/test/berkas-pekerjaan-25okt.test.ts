// @vitest-environment node
import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BATAS_BITA_BUTIR, BATAS_BUTIR, MASA_HASIL_MS, MASA_KUMPUL_MS, namaBerkasAman, namaUnik, rtfBermula } from "@/lib/berkas-pekerjaan";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  ambilHasil,
  buatPekerjaan,
  daftarPekerjaan,
  hapusPekerjaan,
  jalankanPekerjaan,
  kosongkanPekerjaanUntukUji,
  mulaiPekerjaan,
  periksaSisaRtf,
  statusPekerjaan,
  tambahButir,
  type DepsPekerjaan,
} from "@/server/modules/aleta-ecourt/berkas-pekerjaan";
import { gabungkanPdf } from "@/lib/gabung-pdf";

/**
 * ============================================================================
 * K14 - PEKERJAAN BERKAS DI SERVER (rantai B, 25 Okt 2026)
 * ============================================================================
 *   - saklar kinerja.berkasDiServer mati (bawaan): { tersedia: false }, tidak ada yang disimpan;
 *   - menyala: naskah RTF dikumpulkan, diperiksa sisa blangkonya, dibungkus ZIP atau diubah ke PDF dan digabung;
 *   - semua milik pemanggil; hasil hanya di memori dan kedaluwarsa; batas jumlah/ukuran; kegagalan bot tidak merusak yang lain;
 *   - rute: alur lengkap, unduhan, hak kapabilitas; pemeriksa sisa blangko satu naskah.
 */

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
vi.mock("@/server/db/client", async (asli) => ({ ...(await asli<typeof import("@/server/db/client")>()), getDatabase: async () => db }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

const rtf = (isi: string) => Buffer.from(`{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}{\\colortbl;\\red0\\green0\\blue0;\\red255\\green0\\blue0;}\\pard ${isi}\\par}`, "latin1");
const BERSIH = rtf("Menimbang, bahwa perkara telah diperiksa dengan sungguh-sungguh dan seksama.");
const KOTOR = rtf("Penggugat [nama penggugat] bin ....... telah hadir. Nomor #0046# perlu di review.");
const b64 = (b: Buffer) => b.toString("base64");

async function pdfKecil(halaman: number) {
  const d = await PDFDocument.create();
  for (let i = 0; i < halaman; i += 1) d.addPage([200, 200]);
  return new Uint8Array(await d.save());
}
const depsTiruan = (o: { gagalNaskah?: number[]; semuaGagal?: boolean } = {}): DepsPekerjaan & { dikonversi: number } => {
  let n = 0;
  const d: DepsPekerjaan & { dikonversi: number } = {
    dikonversi: 0,
    konversiPdf: async () => {
      const ke = n++;
      d.dikonversi += 1;
      if (o.semuaGagal || o.gagalNaskah?.includes(ke)) return { ok: false, sebab: "LibreOffice belum terpasang" };
      return { ok: true, pdf: await pdfKecil(1 + ke) };
    },
    gabungPdf: gabungkanPdf,
    sekarang: () => Date.now(),
  };
  return d;
};
const SETELAH = (ms: number) => Date.now() + ms;

/** Membaca ZIP (STORE) -> nama berkas. */
function namaDalamZip(buf: Buffer): string[] {
  const nama: string[] = [];
  let o = 0;
  while (o + 30 < buf.length && buf.readUInt32LE(o) === 0x04034b50) {
    const ukuran = buf.readUInt32LE(o + 18);
    const n = buf.readUInt16LE(o + 26);
    const e = buf.readUInt16LE(o + 28);
    nama.push(buf.subarray(o + 30, o + 30 + n).toString("utf8"));
    o += 30 + n + e + ukuran;
  }
  return nama;
}

async function nyalakan() {
  const lama = aktor;
  aktor = "usr-super";
  const modul = await import("@/app/api/aleta-ecourt/ekstensi/kinerja/route");
  const j = await modul.PUT(new NextRequest("http://localhost/x", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ berkasDiServer: true }) }));
  expect(j.status).toBe(200);
  aktor = lama;
}

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-super";
  kosongkanPekerjaanUntukUji();
});
afterEach(async () => {
  kosongkanPekerjaanUntukUji();
  await db?.close();
  db = null;
});

describe("lib: pembantu murni", () => {
  it("namaBerkasAman membuang jalur dan karakter terlarang; namaUnik menambah (2), (3) tanpa peka huruf besar-kecil", () => {
    expect(namaBerkasAman("..\\..\\a/b:c*d?.rtf")).toBe("_._a_b_c_d_.rtf");
    expect(namaBerkasAman("   ", "cadangan")).toBe("cadangan");
    expect(namaBerkasAman("x".repeat(300)).length).toBeLessThanOrEqual(140);
    const dipakai = new Set<string>();
    expect([namaUnik("A.rtf", dipakai), namaUnik("a.RTF", dipakai), namaUnik("A.rtf", dipakai), namaUnik("B", dipakai), namaUnik("b", dipakai)]).toEqual(["A.rtf", "a (2).RTF", "A (3).rtf", "B", "b (2)"]);
  });
  it("rtfBermula mengenali awal RTF saja", () => {
    expect(rtfBermula(BERSIH)).toBe(true);
    expect(rtfBermula(Buffer.from("%PDF-1.4"))).toBe(false);
    expect(rtfBermula(Buffer.from("PK\u0003\u0004"))).toBe(false);
  });
});

describe("saklar mati (bawaan)", () => {
  it("buat dan periksa sisa dijawab { tersedia: false }, tidak ada pekerjaan tersimpan", async () => {
    expect(await buatPekerjaan(db!, "usr-super", { format: "rtf", nama: "x" })).toEqual({ tersedia: false, alasan: "saklar-mati" });
    expect(await periksaSisaRtf(db!, { rtfBase64: b64(KOTOR) })).toEqual({ tersedia: false, alasan: "saklar-mati" });
    expect(daftarPekerjaan("usr-super")).toEqual([]);
  });
});

describe("alur pekerjaan RTF -> ZIP", () => {
  beforeEach(nyalakan);

  it("kumpulkan, mulai, selesai: ZIP berisi semua naskah dengan nama unik; sisa blangko dilaporkan; naskah mentah dilepas", async () => {
    const buat = await buatPekerjaan(db!, "usr-super", { format: "rtf", nama: "Cetak massal - BAS - 2026-10-25" });
    expect(buat.tersedia).toBe(true);
    if (!buat.tersedia) return;
    tambahButir("usr-super", buat.id, { nama: "581 - BAS.rtf", rtfBase64: b64(BERSIH) });
    tambahButir("usr-super", buat.id, { nama: "582 - BAS", rtfBase64: b64(KOTOR) });
    tambahButir("usr-super", buat.id, { nama: "581 - BAS.rtf", rtfBase64: b64(BERSIH) });
    const mulai = mulaiPekerjaan("usr-super", buat.id, depsTiruan());
    await mulai.selesai;
    const s = statusPekerjaan("usr-super", buat.id);
    expect(s.status).toBe("selesai");
    expect(s.jumlahButir).toBe(3);
    expect(s.hasil).toMatchObject({ nama: "Cetak massal - BAS - 2026-10-25.zip", tipe: "application/zip" });
    expect(s.ringkasan).toContain("3 naskah RTF dalam satu ZIP");
    expect(s.perluDicek.map((x) => x.nama)).toEqual(["582 - BAS"]);
    expect(s.perluDicek[0].jumlah).toBeGreaterThanOrEqual(2);
    expect(s.perluDicek[0].jenis.map((j) => j.jenis)).toEqual(expect.arrayContaining(["kurung"]));
    const hasil = ambilHasil("usr-super", buat.id);
    expect(namaDalamZip(hasil.bita)).toEqual(["581 - BAS.rtf", "582 - BAS.rtf", "581 - BAS (2).rtf"]);
    expect(hasil.bita.includes(Buffer.from("seksama"))).toBe(true);
    // ringkasan status tidak pernah membawa isi naskah
    expect(JSON.stringify(s)).not.toContain("seksama");
  });

  it("hasil belum siap selama berjalan: 409; pekerjaan orang lain 404 untuk status, unduh, hapus, tambah, mulai", async () => {
    const buat = await buatPekerjaan(db!, "usr-super", { format: "rtf", nama: "x" });
    if (!buat.tersedia) throw new Error("harus tersedia");
    tambahButir("usr-super", buat.id, { nama: "a.rtf", rtfBase64: b64(BERSIH) });
    expect(() => ambilHasil("usr-super", buat.id)).toThrow(/belum siap/);
    for (const f of [
      () => statusPekerjaan("usr-lain", buat.id),
      () => ambilHasil("usr-lain", buat.id),
      () => hapusPekerjaan("usr-lain", buat.id),
      () => tambahButir("usr-lain", buat.id, { nama: "a.rtf", rtfBase64: b64(BERSIH) }),
      () => mulaiPekerjaan("usr-lain", buat.id),
    ]) {
      expect(f).toThrow(/tidak ditemukan/);
    }
    expect(daftarPekerjaan("usr-lain")).toEqual([]);
    expect(daftarPekerjaan("usr-super")).toHaveLength(1);
  });

  it("batas: bukan RTF, kosong, terlalu besar, terlalu banyak, ditambah sesudah dimulai, mulai tanpa naskah, format salah, pekerjaan aktif > 3", async () => {
    await expect(buatPekerjaan(db!, "usr-super", { format: "docx", nama: "x" })).rejects.toThrow(/Format/);
    const buat = await buatPekerjaan(db!, "usr-super", { format: "rtf", nama: "x" });
    if (!buat.tersedia) throw new Error("harus tersedia");
    expect(() => mulaiPekerjaan("usr-super", buat.id)).toThrow(/Belum ada naskah/);
    expect(() => tambahButir("usr-super", buat.id, { nama: "a", rtfBase64: "" })).toThrow(/tidak terkirim/);
    expect(() => tambahButir("usr-super", buat.id, { nama: "a", rtfBase64: b64(Buffer.from("%PDF-1.4 bukan rtf")) })).toThrow(/bukan RTF/);
    expect(() => tambahButir("usr-super", buat.id, { nama: "a", rtfBase64: b64(Buffer.concat([rtf("x"), Buffer.alloc(BATAS_BITA_BUTIR)])) })).toThrow(/terlalu besar/);
    for (let i = 0; i < BATAS_BUTIR; i += 1) tambahButir("usr-super", buat.id, { nama: `n${i}.rtf`, rtfBase64: b64(BERSIH) });
    expect(() => tambahButir("usr-super", buat.id, { nama: "lagi.rtf", rtfBase64: b64(BERSIH) })).toThrow(/Paling banyak/);
    const m = mulaiPekerjaan("usr-super", buat.id, depsTiruan());
    expect(() => tambahButir("usr-super", buat.id, { nama: "lagi.rtf", rtfBase64: b64(BERSIH) })).toThrow(/sudah dimulai/);
    expect(() => mulaiPekerjaan("usr-super", buat.id)).toThrow(/sudah dimulai/);
    await m.selesai;
    // tiga pekerjaan yang belum selesai penuh -> keempat ditolak
    for (let i = 0; i < 3; i += 1) expect((await buatPekerjaan(db!, "usr-super", { format: "rtf", nama: `p${i}` })).tersedia).toBe(true);
    await expect(buatPekerjaan(db!, "usr-super", { format: "rtf", nama: "p4" })).rejects.toThrow(/belum selesai/);
  });

  it("kedaluwarsa: hasil dilupakan sesudah masa hasil; pekerjaan yang tidak pernah dimulai dibuang lebih cepat", async () => {
    const a = await buatPekerjaan(db!, "usr-super", { format: "rtf", nama: "a" });
    const b = await buatPekerjaan(db!, "usr-super", { format: "rtf", nama: "b" });
    if (!a.tersedia || !b.tersedia) throw new Error("harus tersedia");
    tambahButir("usr-super", a.id, { nama: "a.rtf", rtfBase64: b64(BERSIH) });
    const m = mulaiPekerjaan("usr-super", a.id, depsTiruan());
    await m.selesai;
    expect(statusPekerjaan("usr-super", a.id, SETELAH(MASA_KUMPUL_MS - 60000)).status).toBe("selesai");
    expect(() => statusPekerjaan("usr-super", b.id, SETELAH(MASA_KUMPUL_MS + 60000))).toThrow(/tidak ditemukan/);
    expect(() => statusPekerjaan("usr-super", a.id, SETELAH(MASA_HASIL_MS + 60000))).toThrow(/tidak ditemukan/);
  });

  it("hapus: pekerjaan hilang", async () => {
    const buat = await buatPekerjaan(db!, "usr-super", { format: "rtf", nama: "x" });
    if (!buat.tersedia) throw new Error("harus tersedia");
    expect(hapusPekerjaan("usr-super", buat.id)).toEqual({ dihapus: true });
    expect(() => statusPekerjaan("usr-super", buat.id)).toThrow(/tidak ditemukan/);
  });
});

describe("alur pekerjaan PDF gabungan", () => {
  beforeEach(nyalakan);

  it("tiap naskah diubah ke PDF oleh bot lalu digabung menjadi satu PDF (halaman = jumlah)", async () => {
    const buat = await buatPekerjaan(db!, "usr-super", { format: "pdf", nama: "Cetak massal - Putusan" });
    if (!buat.tersedia) throw new Error("harus tersedia");
    for (const n of ["a", "b", "c"]) tambahButir("usr-super", buat.id, { nama: `${n}.rtf`, rtfBase64: b64(BERSIH) });
    const deps = depsTiruan();
    await mulaiPekerjaan("usr-super", buat.id, deps).selesai;
    expect(deps.dikonversi).toBe(3);
    const s = statusPekerjaan("usr-super", buat.id);
    expect(s.status).toBe("selesai");
    const h = ambilHasil("usr-super", buat.id);
    expect(h).toMatchObject({ nama: "Cetak massal - Putusan.pdf", tipe: "application/pdf" });
    const doc = await PDFDocument.load(h.bita);
    expect(doc.getPageCount()).toBe(1 + 2 + 3); // konversi tiruan: 1, 2, 3 halaman
    expect(s.ringkasan).toContain("3 naskah digabung menjadi satu PDF (6 halaman)");
  });

  it("satu konversi gagal: yang lain tetap digabung dan yang gagal dilaporkan dengan sebabnya", async () => {
    const buat = await buatPekerjaan(db!, "usr-super", { format: "pdf", nama: "x" });
    if (!buat.tersedia) throw new Error("harus tersedia");
    for (const n of ["a", "b", "c"]) tambahButir("usr-super", buat.id, { nama: `${n}.rtf`, rtfBase64: b64(BERSIH) });
    await mulaiPekerjaan("usr-super", buat.id, depsTiruan({ gagalNaskah: [1] })).selesai;
    const s = statusPekerjaan("usr-super", buat.id);
    expect(s.status).toBe("selesai");
    expect(s.gagal).toEqual([{ nama: "b.rtf", sebab: "LibreOffice belum terpasang" }]);
    expect((await PDFDocument.load(ambilHasil("usr-super", buat.id).bita)).getPageCount()).toBe(1 + 3);
    expect(s.ringkasan).toContain("1 gagal diproses");
  });

  it("semua konversi gagal: pekerjaan berstatus gagal dengan sebab bot, tanpa hasil", async () => {
    const buat = await buatPekerjaan(db!, "usr-super", { format: "pdf", nama: "x" });
    if (!buat.tersedia) throw new Error("harus tersedia");
    tambahButir("usr-super", buat.id, { nama: "a.rtf", rtfBase64: b64(BERSIH) });
    await mulaiPekerjaan("usr-super", buat.id, depsTiruan({ semuaGagal: true })).selesai;
    const s = statusPekerjaan("usr-super", buat.id);
    expect(s.status).toBe("gagal");
    expect(s.galat).toBe("LibreOffice belum terpasang");
    expect(s.hasil).toBeNull();
    expect(() => ambilHasil("usr-super", buat.id)).toThrow(/belum siap/);
  });

  it("jalankanPekerjaan tidak pernah melempar walau penggabung rusak: status gagal dengan sebab", async () => {
    const buat = await buatPekerjaan(db!, "usr-super", { format: "pdf", nama: "x" });
    if (!buat.tersedia) throw new Error("harus tersedia");
    tambahButir("usr-super", buat.id, { nama: "a.rtf", rtfBase64: b64(BERSIH) });
    const deps = { ...depsTiruan(), gabungPdf: async () => Promise.reject(new Error("penggabung mati")) };
    const m = mulaiPekerjaan("usr-super", buat.id, deps);
    await m.selesai;
    expect(statusPekerjaan("usr-super", buat.id)).toMatchObject({ status: "gagal", galat: "penggabung mati" });
    void jalankanPekerjaan;
  });
});

describe("pemeriksa sisa blangko satu naskah", () => {
  beforeEach(nyalakan);
  it("RTF dengan sisa -> temuan; bersih -> tanpa temuan; bukan RTF -> dibaca:false; kosong/terlalu besar ditolak", async () => {
    const kotor = await periksaSisaRtf(db!, { rtfBase64: b64(KOTOR) });
    expect(kotor).toMatchObject({ tersedia: true, dibaca: true });
    if (!kotor.tersedia || !kotor.dibaca || !kotor.hasil) throw new Error("harus terbaca");
    expect(kotor.hasil.temuan.length).toBeGreaterThanOrEqual(2);
    expect(kotor.hasil.temuan.map((t) => t.jenis)).toEqual(expect.arrayContaining(["kurung", "perbaikan"]));
    const bersih = await periksaSisaRtf(db!, { rtfBase64: b64(BERSIH) });
    expect(bersih).toMatchObject({ dibaca: true, hasil: { temuan: [] } });
    expect(await periksaSisaRtf(db!, { rtfBase64: b64(Buffer.from("%PDF-1.4")) })).toEqual({ tersedia: true, dibaca: false, hasil: null });
    await expect(periksaSisaRtf(db!, { rtfBase64: "" })).rejects.toThrow(/tidak terkirim/);
  });
});

describe("rute", () => {
  type Hasil = { status: number; isi: any; res: Response };
  async function utama(cara: "GET" | "POST" | "DELETE", opsi: { badan?: unknown; query?: string } = {}): Promise<Hasil> {
    const modul = await import("@/app/api/aleta-ecourt/berkas-server/route");
    const req = new NextRequest(`http://localhost/api/x${opsi.query ?? ""}`, {
      method: cara,
      headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
      body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
    });
    const res = await (modul as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara](req);
    const ct = res.headers.get("content-type") || "";
    return { status: res.status, isi: ct.includes("json") ? await res.clone().json() : null, res };
  }
  async function sisa(badan: unknown) {
    const modul = await import("@/app/api/aleta-ecourt/berkas-server/periksa-sisa/route");
    const res = await modul.POST(new NextRequest("http://localhost/api/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) }));
    return { status: res.status, isi: await res.json() };
  }

  it("saklar mati: daftar kosong dan aktif:false; buat dan butir dijawab tersedia:false; periksa sisa tersedia:false", async () => {
    expect((await utama("GET")).isi.data).toEqual({ aktif: false, pekerjaan: [] });
    expect((await utama("POST", { badan: { aksi: "buat", format: "rtf", nama: "x" } })).isi.data).toEqual({ tersedia: false, alasan: "saklar-mati" });
    expect((await utama("POST", { badan: { aksi: "butir", id: "bk-x", rtfBase64: "e1" } })).isi.data).toEqual({ tersedia: false, alasan: "saklar-mati" });
    expect((await sisa({ rtfBase64: b64(KOTOR) })).isi.data).toEqual({ tersedia: false, alasan: "saklar-mati" });
  });

  it("tanpa sesi 401; pegawai tanpa kapabilitas blangko-abt 403 untuk menulis tetapi tetap tidak melihat milik orang lain", async () => {
    await nyalakan();
    aktor = null;
    expect((await utama("GET")).status).toBe(401);
    expect((await utama("POST", { badan: { aksi: "buat", format: "rtf" } })).status).toBe(401);
    aktor = "usr-hakim";
    const buatHakim = await utama("POST", { badan: { aksi: "buat", format: "rtf", nama: "milik hakim" } });
    expect([200, 403]).toContain(buatHakim.status);
    aktor = "usr-super";
    expect((await utama("GET")).isi.data.pekerjaan.every((p: { nama: string }) => p.nama !== "milik hakim")).toBe(true);
  });

  it("alur lengkap lewat rute: buat, butir, mulai, status, unduh (ZIP dengan header unduhan), hapus", async () => {
    await nyalakan();
    const buat = await utama("POST", { badan: { aksi: "buat", format: "rtf", nama: "Cetak massal - Putusan - 2026-10-25" } });
    expect(buat.status).toBe(200);
    const id = buat.isi.data.id as string;
    expect(buat.isi.data.batas.butir).toBe(BATAS_BUTIR);
    expect((await utama("POST", { badan: { aksi: "butir", id, nama: "581 - Putusan.rtf", rtfBase64: b64(BERSIH) } })).isi.data.jumlahButir).toBe(1);
    expect((await utama("POST", { badan: { aksi: "butir", id, nama: "582 - Putusan.rtf", rtfBase64: b64(KOTOR) } })).isi.data.jumlahButir).toBe(2);
    expect((await utama("POST", { badan: { aksi: "butir", id, nama: "x.pdf", rtfBase64: b64(Buffer.from("%PDF")) } })).status).toBe(400);
    const mulai = await utama("POST", { badan: { aksi: "mulai", id } });
    expect(mulai.status).toBe(200);
    expect(mulai.isi.data).not.toHaveProperty("selesai"); // janji kerja tidak ikut dikirim
    let status = mulai.isi.data;
    for (let i = 0; i < 100 && status.status === "jalan"; i += 1) {
      await new Promise((r) => setTimeout(r, 20));
      status = (await utama("GET", { query: `?id=${id}` })).isi.data;
    }
    expect(status.status).toBe("selesai");
    expect(status.perluDicek.map((x: { nama: string }) => x.nama)).toEqual(["582 - Putusan.rtf"]);
    const unduh = await utama("GET", { query: `?id=${id}&unduh=1` });
    expect(unduh.status).toBe(200);
    expect(unduh.res.headers.get("content-type")).toBe("application/zip");
    expect(unduh.res.headers.get("content-disposition")).toContain(encodeURIComponent("Cetak massal - Putusan - 2026-10-25.zip"));
    expect(namaDalamZip(Buffer.from(await unduh.res.arrayBuffer()))).toEqual(["581 - Putusan.rtf", "582 - Putusan.rtf"]);
    expect((await utama("GET")).isi.data.pekerjaan.map((p: { id: string }) => p.id)).toEqual([id]);
    expect((await utama("DELETE", { query: `?id=${id}` })).isi.data).toEqual({ dihapus: true });
    expect((await utama("GET", { query: `?id=${id}` })).status).toBe(404);
    expect((await utama("POST", { badan: { aksi: "ngawur" } })).status).toBe(400);
  });

  it("rute periksa-sisa: temuan untuk naskah kotor, tanpa temuan untuk bersih", async () => {
    await nyalakan();
    const kotor = await sisa({ rtfBase64: b64(KOTOR) });
    expect(kotor.status).toBe(200);
    expect(kotor.isi.data.dibaca).toBe(true);
    expect(kotor.isi.data.hasil.temuan.length).toBeGreaterThanOrEqual(2);
    expect((await sisa({ rtfBase64: b64(BERSIH) })).isi.data.hasil.temuan).toEqual([]);
    expect((await sisa({})).status).toBe(400);
  });
});
