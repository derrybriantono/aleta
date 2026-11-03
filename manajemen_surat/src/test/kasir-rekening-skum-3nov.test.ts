// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { PDFDocument, PDFPage, StandardFonts } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * KASIR 3 NOV 2026: REKENING PENGGUNA e-COURT, CETAK e-SKUM, UI KARTU KASIR
 * ============================================================================
 *
 * Permintaan Derry:
 *   1. nomor rekening pengguna (biasanya Penggugat/Pemohon) di data pihak Status Perkara dan di Kasir;
 *   2. cetak e-SKUM e-Court dari Kasir ALETA (kolom JUMLAH tidak terpotong);
 *   3. UI Kasir ALETA mudah dipahami (tipografi berjenjang, Rupiah bertitik rata kanan, kolom sejajar).
 *
 * SELURUH data di sini REKAAN - bukan nama, rekening, email, atau alamat pihak sungguhan.
 */

const keadaan = vi.hoisted(() => ({
  aktor: null as Record<string, unknown> | null,
  bayar: {} as Record<string, unknown>,
  gatewayGagal: false,
}));

vi.mock("@/server/db/client", () => ({
  getDatabase: async () => ({ queryOne: async () => null, queryAll: async () => [] }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/audit", () => ({ appendAuditLog: async () => undefined }));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt_uji" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async () => {
    if (!keadaan.aktor) throw Object.assign(new Error("tanpa aktor"), { status: 401 });
    return keadaan.aktor;
  },
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleAdminRouteError: (galat: { status?: number; message?: string }) =>
      NextResponse.json({ ok: false, error: { message: String(galat && galat.message) } }, { status: Number(galat && galat.status) || 500 }),
  };
});
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewayPembayaranEcourt: async (nomor: string[]) =>
    keadaan.gatewayGagal
      ? { ok: false, error: "putus" }
      : { ok: true, data: { ok: true, perkara: Object.fromEntries(nomor.filter((n) => n in keadaan.bayar).map((n) => [n, keadaan.bayar[n]])) } },
}));

import {
  angkaSkum,
  bolehRekeningPenuh,
  pembayaranUntukPeran,
  pemilikPembayaran,
  rupiahTitik,
  samarkanRekening,
  tanggalIndonesia,
  type PembayaranEcourt,
} from "@/lib/pembayaran-ecourt";
import type { UserPersona } from "@/lib/types";
import { buatPdfSkumEcourt } from "@/server/modules/aleta-ecourt/skum-ecourt-pdf";

const AKAR = path.resolve(process.cwd(), "..");
const requireBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const pembaca = requireBot(path.join(AKAR, "aleta_bot/tools/ecourt-bridge/pembayaranEcourt.js"));
const scraper = requireBot(path.join(AKAR, "aleta_bot/tools/ecourt-bridge/scraper.js"));

// ─── HTML REKAAN halaman detil pendaftaran e-Court ───────────────────────────
const HTML_DETIL = `
<div class="tab-pane" id="pendaftaran">
  <h3>Pembayaran (e-Payment)</h3>
  <p><b>Bukti Pembayaran dapat diunduh</b> <a class="btn btn-warning">Cetak</a></p>
  <table class="table">
    <tr><td>Diterima Dari</td><td>Budi Rekaan S. H<br>[Nomor Rekening Pengguna :9900112233] [A.n :budi.rekaan@contoh.test] [Pada Bank :B N I]</td></tr>
    <tr><td>Nomor Pendaftaran Online</td><td><i>PA.XYZ-01022026CT1</i></td></tr>
    <tr><td>Nomor Pembayaran</td><td><i>11112222333344</i></td></tr>
    <tr><td>Panjar Perkara</td><td><i>Rp. 355,000.00</i> <a class="btn btn-warning" data-toggle="modal" href="#modal-skum">Lihat SKUM</a></td></tr>
    <tr><td>Status Pembayaran</td><td><i>Sudah dibayar</i></td></tr>
    <tr><td>Tanggal Pembayaran</td><td><i>Kamis, 14 Mei 2026</i></td></tr>
    <tr><td>Jam Pembayaran</td><td><i>16:18:27 WIB (Zona Waktu Pembayaran berdasarkan lokasi server di Mahkamah Agung)</i></td></tr>
  </table>
  <h3>Tambah Panjar</h3>
  <table><tr><th>No.</th><th>Nama</th></tr><tr><td colspan="2">Belum ada data untuk tambah panjar di perkara ini.</td></tr></table>
</div>
<div class="modal" id="modal-skum"><div class="modal-body">
  <button class="btn">Cetak</button>
  <h3>PENGADILAN AGAMA REKAAN</h3>
  <p>JL. CONTOH NO. 1 KOTA REKAAN</p>
  <p>0000 - 11111</p>
  <h4>SURAT KUASA UNTUK MEMBAYAR ELEKTRONIK (e-SKUM)</h4>
  <p>Kami Yang bertanda tangan di bawah ini :</p>
  <table>
    <tr><td>Nama</td><td>: Budi Rekaan S. H</td></tr>
    <tr><td>Alamat</td><td>: Jl. Contoh Panjang Sekali No. 30 Kelurahan Rekaan Timur, Kecamatan Rekaan, Kota Rekaan, Provinsi Contoh</td></tr>
    <tr><td>Telp/HP</td><td>: 080000000000</td></tr>
  </table>
  <p>Membayar Biaya Panjar Perkara untuk itu kami memberi kuasa kepada Panitera PENGADILAN AGAMA REKAAN untuk membayar segala pengeluaran yang diwajibkan atas perkara tersebut dengan rincian :</p>
  <img alt="PA.XYZ-01022026CT1">
  <table>
    <tr><th>URAIAN PEMBAYARAN</th><th></th><th>JUMLAH</th></tr>
    <tr><td>1. Pendaftaran</td><td>Rp.</td><td>30.000,00</td></tr>
    <tr><td>2. Biaya Proses</td><td>Rp.</td><td>100.000,00</td></tr>
    <tr><td>3. Panggilan Penggugat</td><td>Rp.</td><td>0,00</td></tr>
    <tr><td>4. Panggilan Tergugat</td><td>Rp.</td><td>145.000,00</td></tr>
    <tr><td>5. Redaksi</td><td>Rp.</td><td>10.000,00</td></tr>
    <tr><td>6. Meterai</td><td>Rp.</td><td>10.000,00</td></tr>
    <tr><td>7. PNBP Relaas Panggilan Pertama Penggugat/Pemohon dan Tergugat/Termohon dan PBT</td><td>Rp.</td><td>60.000,00</td></tr>
  </table>
  <div class="row"><div>Total yang harus di bayarkan (Rp.)</div><div>355.000,00</div></div>
</div></div>`;

describe("1. pembaca e-Court (bot): e-Payment dan e-SKUM dari HTML rekaan", () => {
  it("bagian Pembayaran (e-Payment): pembayar, rekening pengguna, atas nama, bank, panjar, tanggal, jam", () => {
    const p = pembaca.extractPembayaranEcourt(HTML_DETIL);
    expect(p).toEqual({
      diterimaDari: "Budi Rekaan S. H",
      nomorRekening: "9900112233",
      atasNama: "budi.rekaan@contoh.test",
      bank: "BNI",
      nomorPendaftaranOnline: "PA.XYZ-01022026CT1",
      nomorPembayaran: "11112222333344",
      panjar: 355000,
      status: "Sudah dibayar",
      tanggal: "2026-05-14",
      jam: "16:18:27",
    });
    expect(pembaca.extractPembayaranEcourt("<h3>Data Pihak</h3><p>tanpa pembayaran</p>")).toBeNull();
  });

  it("e-SKUM: kop, identitas, 7 rincian bernomor, total, kode pendaftaran", () => {
    const s = pembaca.extractSkumEcourt(HTML_DETIL);
    expect(s.kop).toEqual(["PENGADILAN AGAMA REKAAN", "JL. CONTOH NO. 1 KOTA REKAAN", "0000 - 11111"]);
    expect(s.judul).toBe("SURAT KUASA UNTUK MEMBAYAR ELEKTRONIK (e-SKUM)");
    expect(s.nama).toBe("Budi Rekaan S. H");
    expect(s.telp).toBe("080000000000");
    expect(s.alamat).toMatch(/^Jl\. Contoh Panjang/);
    expect(s.rincian.map((r: { no: number; jumlah: number }) => [r.no, r.jumlah])).toEqual([
      [1, 30000], [2, 100000], [3, 0], [4, 145000], [5, 10000], [6, 10000], [7, 60000],
    ]);
    expect(s.rincian[6].uraian).toBe("PNBP Relaas Panggilan Pertama Penggugat/Pemohon dan Tergugat/Termohon dan PBT");
    expect(s.total).toBe(355000);
    expect(s.kodePendaftaran).toBe("PA.XYZ-01022026CT1");
  });

  it("angka Rupiah dua bentuk e-Court; parseCaseDetail membawa pembayaran & skum; alamat SKUM hanya dari tautan 'skum'", () => {
    expect(pembaca.angkaRupiah("Rp. 355,000.00")).toBe(355000);
    expect(pembaca.angkaRupiah("30.000,00")).toBe(30000);
    expect(pembaca.angkaRupiah("0,00")).toBe(0);
    expect(pembaca.angkaRupiah("29.500")).toBe(29500);
    const d = scraper.parseCaseDetail(HTML_DETIL);
    expect(d.pembayaran.nomorRekening).toBe("9900112233");
    expect(d.skum.total).toBe(355000);
    expect(pembaca.alamatSkumEcourt('<a href="/Pendaftaran/skum/abc123">Lihat SKUM</a>', scraper.absoluteUrl)).toMatch(/\/Pendaftaran\/skum\/abc123$/);
    expect(pembaca.alamatSkumEcourt('<a href="#modal-skum">Lihat SKUM</a>')).toBe("");
  });
});

// ─── lib ─────────────────────────────────────────────────────────────────────
function akun(roleId: string, positionId = "", additionalRoleIds: string[] = []): UserPersona {
  return { id: `usr-${roleId}-${positionId}`, username: roleId, password: "", name: `Uji ${roleId}`, email: `${roleId}@uji.lokal`, roleId, positionId, additionalRoleIds, isActive: true } as unknown as UserPersona;
}
const AKUN = {
  superadmin: akun("super-admin", "pos-pranata-komputer"),
  admin: akun("admin", "pos-pranata-komputer"),
  kasir: akun("pelaksana", "pos-staf-umum", ["kasir"]),
  panitera: akun("panitera", "pos-panitera"),
  panmud: akun("panitera-muda", "pos-panitera-muda-gugatan"),
  hakim: akun("hakim", "pos-hakim"),
  pp: akun("panitera-pengganti", "pos-panitera-pengganti"),
  ptsp: akun("pelaksana", "pos-ptsp", ["petugas_ptsp"]),
  sekretaris: akun("sekretaris", "pos-sekretaris"),
  staf: akun("pelaksana", "pos-staf-umum"),
};

const BAYAR: PembayaranEcourt = {
  nomorPerkara: "12/Pdt.G/2026/PA.Xyz",
  diterimaDari: "Budi Rekaan S. H",
  nomorRekening: "9900112233",
  atasNama: "budi.rekaan@contoh.test",
  bank: "BNI",
  nomorPendaftaranOnline: "PA.XYZ-01022026CT1",
  nomorPembayaran: "11112222333344",
  panjar: 355000,
  status: "Sudah dibayar",
  tanggal: "2026-05-14",
  jam: "16:18:27",
  skum: pembaca.extractSkumEcourt(HTML_DETIL),
};

describe("2. rekening penuh hanya untuk peran keuangan perkara; lainnya tersamar", () => {
  it("penuh: kasir, panitera, panmud, Admin, Super Admin; tidak: hakim, PP, PTSP, sekretaris", () => {
    for (const k of ["kasir", "panitera", "panmud", "admin", "superadmin"] as const) expect(bolehRekeningPenuh(AKUN[k]), k).toBe(true);
    for (const k of ["hakim", "pp", "ptsp", "sekretaris", "staf"] as const) expect(bolehRekeningPenuh(AKUN[k]), k).toBe(false);
  });

  it("tersamar = ****1234, tanpa email atas-nama dan nomor pembayaran; isi SKUM tidak ikut", () => {
    expect(samarkanRekening("9900112233")).toBe("****2233");
    expect(samarkanRekening("")).toBe("");
    const t = pembayaranUntukPeran(BAYAR, false);
    expect(t).toMatchObject({ nomorRekening: "****2233", atasNama: "", nomorPembayaran: "", bank: "BNI", diterimaDari: "Budi Rekaan S. H", penuh: false, adaSkum: true });
    expect(JSON.stringify(t)).not.toContain("9900112233");
    expect(JSON.stringify(t)).not.toContain("contoh.test");
    expect(t).not.toHaveProperty("skum");
    expect(pembayaranUntukPeran(BAYAR, true)).toMatchObject({ nomorRekening: "9900112233", atasNama: "budi.rekaan@contoh.test", penuh: true });
  });

  it("pembayar dicocokkan ke pihak/kuasa (gelar diabaikan); tidak cocok = pihak pertama", () => {
    const orang = [
      { nama: "Siti Rekaan binti Ahmad", jenis: "pihak", pihakKe: 1 },
      { nama: "Budi Rekaan, S.H.", jenis: "kuasa", pihakKe: 1 },
      { nama: "Andi Rekaan", jenis: "pihak", pihakKe: 2 },
    ];
    expect(pemilikPembayaran("Budi Rekaan S. H", orang)).toMatchObject({ orang: orang[1], cocok: true, kuasa: true });
    expect(pemilikPembayaran("Siti Rekaan", orang)).toMatchObject({ orang: orang[0], cocok: true, kuasa: false });
    expect(pemilikPembayaran("Orang Lain", orang)).toMatchObject({ orang: orang[0], cocok: false });
  });

  it("format: Rp29.500, 355.000,00 (bentuk e-SKUM), tanggal Indonesia", () => {
    expect(rupiahTitik(29500)).toBe("Rp29.500");
    expect(rupiahTitik(1250000)).toBe("Rp1.250.000");
    expect(rupiahTitik(null)).toBe("-");
    expect(angkaSkum(355000)).toBe("355.000,00");
    expect(tanggalIndonesia("2026-05-14")).toBe("14 Mei 2026");
  });
});

// ─── rute ────────────────────────────────────────────────────────────────────
afterEach(() => {
  keadaan.aktor = null;
  keadaan.bayar = {};
  keadaan.gatewayGagal = false;
});

const minta = (url: string) => new NextRequest(`http://127.0.0.1:3000/aleta${url}`);
const N = "12/Pdt.G/2026/PA.Xyz";

describe("3. rute pembayaran-ecourt dan e-SKUM PDF", () => {
  it("kasir menerima rekening utuh; hakim tersamar; sekretaris/staf 403", async () => {
    const { GET } = await import("@/app/api/aleta-ecourt/pembayaran-ecourt/route");
    keadaan.bayar = { [N]: BAYAR };
    keadaan.aktor = AKUN.kasir as unknown as Record<string, unknown>;
    let r = await GET(minta(`/api/aleta-ecourt/pembayaran-ecourt?nomor=${encodeURIComponent(N)}`));
    let isi = (await r.json()).data;
    expect(r.status).toBe(200);
    expect(isi.penuh).toBe(true);
    expect(isi.perkara[N].nomorRekening).toBe("9900112233");

    keadaan.aktor = AKUN.hakim as unknown as Record<string, unknown>;
    r = await GET(minta(`/api/aleta-ecourt/pembayaran-ecourt?nomor=${encodeURIComponent(N)}`));
    isi = (await r.json()).data;
    expect(isi.penuh).toBe(false);
    expect(isi.perkara[N].nomorRekening).toBe("****2233");
    expect(JSON.stringify(isi)).not.toContain("9900112233");

    for (const k of ["sekretaris", "staf"] as const) {
      keadaan.aktor = AKUN[k] as unknown as Record<string, unknown>;
      expect((await GET(minta(`/api/aleta-ecourt/pembayaran-ecourt?nomor=${encodeURIComponent(N)}`))).status, k).toBe(403);
    }
  });

  it("e-SKUM: kasir mengunduh PDF; hakim 403; belum terbaca / e-Court tak terjangkau = kabar tanpa label teknis", async () => {
    const { GET } = await import("@/app/api/aleta-ecourt/pembayaran-ecourt/skum/route");
    keadaan.bayar = { [N]: BAYAR };
    keadaan.aktor = AKUN.kasir as unknown as Record<string, unknown>;
    const r = await GET(minta(`/api/aleta-ecourt/pembayaran-ecourt/skum?nomor=${encodeURIComponent(N)}&kertas=F4`));
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toContain("e-SKUM 12-Pdt.G-2026-PA.Xyz.pdf");
    const pdf = await PDFDocument.load(new Uint8Array(await r.arrayBuffer()));
    expect(Math.round(pdf.getPage(0).getHeight())).toBe(935); // F4

    keadaan.aktor = AKUN.hakim as unknown as Record<string, unknown>;
    expect((await GET(minta(`/api/aleta-ecourt/pembayaran-ecourt/skum?nomor=${encodeURIComponent(N)}`))).status).toBe(403);

    keadaan.aktor = AKUN.kasir as unknown as Record<string, unknown>;
    keadaan.bayar = { [N]: { ...BAYAR, skum: null } };
    let isi = (await (await GET(minta(`/api/aleta-ecourt/pembayaran-ecourt/skum?nomor=${encodeURIComponent(N)}`))).json()).data;
    expect(isi.ok).toBe(false);
    expect(isi.alasan).toContain("e-SKUM perkara ini belum terbaca dari e-Court");
    keadaan.gatewayGagal = true;
    isi = (await (await GET(minta(`/api/aleta-ecourt/pembayaran-ecourt/skum?nomor=${encodeURIComponent(N)}`))).json()).data;
    expect(isi.alasan).toBe("e-Court belum dapat dibaca saat ini. Coba lagi beberapa saat lagi.");
    expect(isi.alasan).not.toMatch(/gateway|bot|HTTP|ECONN/i);
  });

  it("PDF e-SKUM A4: semua teks (termasuk kolom JUMLAH dan total) di dalam margin kanan - tidak terpotong", async () => {
    const tulisan: Array<{ teks: string; x: number; lebar: number }> = [];
    const asli = PDFPage.prototype.drawText;
    const mata = vi.spyOn(PDFPage.prototype, "drawText").mockImplementation(function (this: PDFPage, teks: string, opsi?: Parameters<PDFPage["drawText"]>[1]) {
      const huruf = opsi?.font;
      if (huruf && opsi) tulisan.push({ teks, x: Number(opsi.x), lebar: huruf.widthOfTextAtSize(teks, Number(opsi.size)) });
      return asli.call(this, teks, opsi);
    });
    try {
      const pdf = await PDFDocument.load(await buatPdfSkumEcourt(BAYAR.skum!, { kertas: "A4" }));
      const lebarKertas = pdf.getPage(0).getWidth();
      expect(Math.round(lebarKertas)).toBe(595);
      expect(tulisan.length).toBeGreaterThan(20);
      for (const t of tulisan) expect(t.x + t.lebar, t.teks).toBeLessThanOrEqual(lebarKertas - 40);
      const teks = tulisan.map((t) => t.teks);
      for (const j of ["30.000,00", "100.000,00", "0,00", "145.000,00", "60.000,00", "355.000,00", "JUMLAH"]) expect(teks).toContain(j);
      // Uraian rincian 7 yang panjang dipatah, tidak menabrak kolom Rp.
      const rp = Math.min(...tulisan.filter((t) => t.teks === "Rp.").map((t) => t.x));
      for (const t of tulisan.filter((x) => /^7\.|Tergugat\/Termohon|PBT$/.test(x.teks))) expect(t.x + t.lebar).toBeLessThan(rp);
    } finally {
      mata.mockRestore();
    }
    void StandardFonts;
  });
});

// ─── ekstensi: kartu Kasir Manual (jsdom) ────────────────────────────────────
const EKS = path.join(AKAR, "ekstensi-sipp");
const SUMBER = ["panel-alat.js", "basmassal.js"].map((b) => readFileSync(path.join(EKS, b), "utf8").replace(/\r\n/g, "\n")).join("\n;\n");
const CSS = readFileSync(path.join(EKS, "panel.css"), "utf8").replace(/\r\n/g, "\n");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 4000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(10);
  }
}
const HARI = "2026-11-03";
const usulan = () => [
  { kunci: "u1", jenisBiayaId: 29, kategoriId: 6, jenisTransaksi: -1, pihakKe: 2, pihakId: 12, uraian: "Biaya Panggilan Tergugat", jumlah: 29500, tanggal: HARI, keterangan: "", jurusitaId: 0, peristiwa: "Panggilan pertama", dasar: "tarif", yakin: "tinggi", pilih: true, perluResi: true, sisaOtomatis: false, tersedia: true },
];

function bukaKartu(opsi: { tersamar?: boolean; skum?: boolean } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="wadah"></div></body></html>`, {
    url: "http://192.168.10.10/SIPP/jurnal_perkara_list/ENC",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "baru", modeKering: false };
  w.chrome = {
    runtime: { id: "x", getManifest: () => ({ version: "1.205.0" }), getURL: (x: string) => x, lastError: undefined, sendMessage: (_m: unknown, b?: (x: unknown) => void) => setTimeout(() => b && b({ ok: true }), 0) },
    storage: {
      local: { get: async () => ({ ...simpanan }), set: async (o: Record<string, unknown>) => Object.assign(simpanan, o), remove: async () => undefined },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const akunKasir = { akunKasir: true, ok: true, username: "kasir_uji", nama: "Kasir Uji", calon: [], milik: [], dipilih: "", bolehPilih: false };
  const dimintaUrl: string[] = [];
  w.fetch = async (alamat: string) => {
    const url = String(alamat);
    dimintaUrl.push(url);
    const data = (isi: unknown) => Response.json({ ok: true, data: isi });
    if (/\/pembayaran-ecourt\/skum\?/.test(url)) {
      return opsi.skum === false
        ? data({ ok: false, alasan: "e-SKUM perkara ini belum terbaca dari e-Court. Tekan \"Tarik data\" di halaman perkara SIPP, tunggu sebentar, lalu cetak lagi." })
        : new Response(new Uint8Array([37, 80, 68, 70]), { headers: { "content-type": "application/pdf" } });
    }
    if (/\/pembayaran-ecourt\?/.test(url)) {
      const t = pembayaranUntukPeran({ ...BAYAR, nomorPerkara: "601/Pdt.G/2026/PA.Xyz" }, !opsi.tersamar);
      return data({ ok: true, penuh: !opsi.tersamar, perkara: { "601/Pdt.G/2026/PA.Xyz": t } });
    }
    if (/\/kasir\/harian\?/.test(url)) {
      return data({
        available: true, ok: true, tanggal: HARI, hariIni: HARI, jumlahCalon: 2, lengkap: [], gagal: [], terpotong: false, akun: akunKasir,
        perkara: [
          { perkaraId: 601, nomorPerkara: "601/Pdt.G/2026/PA.Xyz", keadaan: { nama: "Dalam persidangan" }, sebab: ["sidang"], saldo: 300000, perluPeriksa: true, usulan: usulan(), catatan: [] },
          { perkaraId: 602, nomorPerkara: "602/Pdt.G/2026/PA.Xyz", keadaan: { nama: "Putus verstek" }, sebab: ["putusan"], saldo: 100000, perluPeriksa: false, usulan: usulan(), catatan: [] },
        ],
      });
    }
    if (/\/kasir\/otomatis\?/.test(url)) return data({ available: true, ok: true, tanggal: HARI, hariIni: HARI, bolehUbah: true, setelan: { nyala: false, butir: {} }, butirDaftar: [], perkara: [], gagal: [], ringkas: { perkara: 0, akanDiisi: 0, baris: 0 }, akun: akunKasir });
    if (/\/kasir\/pengingat/.test(url)) return data({ available: true, ok: true, hariIni: HARI, butir: [], ringkas: {} });
    if (/\/kasir\/riwayat\?/.test(url)) return data({ available: true, ok: true, jumlah: 0, pekerjaan: [] });
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.eval(`${SUMBER}\n;window.__mode = () => alatUjiMode(); alatCobaMenahan = () => false; window.__unduh = []; alatUnduh = async (b, n) => { window.__unduh.push(n); return { ok: true }; };`);
  return { w, dom, wadah: w.document.getElementById("wadah") as HTMLElement, dimintaUrl };
}

async function bukaManual(h: ReturnType<typeof bukaKartu>) {
  await sampai(() => h.w.__mode() === "baru", "mode baru");
  expect(await h.w.aletaKasirPasangHarian(h.wadah, { situs: "sipp" })).toBe(true);
  const manual = h.wadah.querySelector('details[data-kasir-bagian="manual"]') as HTMLDetailsElement;
  manual.open = true;
  manual.dispatchEvent(new h.w.Event("toggle"));
  await sampai(() => manual.querySelector('[data-perkara="601"] tr[data-usulan="u1"]'), "kartu");
  return manual;
}

describe("4. kartu Kasir Manual: pembayar e-Court, Cetak SKUM di kepala kartu, kolom sejajar, Rupiah bertitik", () => {
  it("rekening pembayar di bawah nomor perkara (penuh untuk kasir), tombol Cetak SKUM di kepala kartu, PDF diunduh", async () => {
    const h = bukaKartu();
    const manual = await bukaManual(h);
    const kartu = manual.querySelector('[data-perkara="601"]') as HTMLElement;
    const bayar = await sampai(() => kartu.querySelector(".aleta-kasir-pembayar:not([hidden]) [data-rekening]"), "rekening");
    expect(bayar.textContent).toBe("BNI 9900112233");
    const kepala = kartu.querySelector(".aleta-kasir-kartu-kepala") as HTMLElement;
    // Urutan: kepala kartu (nomor) lalu baris pembayar tepat di bawahnya.
    expect(kepala.nextElementSibling?.classList.contains("aleta-kasir-pembayar")).toBe(true);
    expect(kartu.querySelector(".aleta-kasir-pembayar")!.textContent).toContain("Panjar Rp355.000");
    expect(kartu.querySelector(".aleta-kasir-pembayar")!.textContent).toContain("dibayar 14 Mei 2026 16:18");
    const skum = kepala.querySelector("button.aleta-kasir-cetak-skum") as HTMLButtonElement;
    expect(skum.textContent).toBe("Cetak SKUM e-Court");
    (kepala.querySelector("select.aleta-kasir-kertas") as HTMLSelectElement).value = "F4";
    skum.click();
    await sampai(() => h.w.__unduh.length, "unduhan");
    expect(h.w.__unduh[0]).toBe("e-SKUM 601-Pdt.G-2026-PA.Xyz.pdf");
    expect(h.dimintaUrl.find((u) => /skum\?/.test(u))).toContain("kertas=F4");
    // Perkara tanpa pembayaran e-Court: tidak ada baris pembayar dan tombol SKUM.
    const lain = manual.querySelector('[data-perkara="602"]') as HTMLElement;
    expect((lain.querySelector(".aleta-kasir-pembayar") as HTMLElement).hidden).toBe(true);
    expect((lain.querySelector(".aleta-kasir-kartu-skum") as HTMLElement).hidden).toBe(true);
    h.dom.window.close();
  });

  it("peran di luar keuangan perkara: rekening tersamar, tanpa email; SKUM belum terbaca = kabar jelas", async () => {
    const h = bukaKartu({ tersamar: true, skum: false });
    const manual = await bukaManual(h);
    const kartu = manual.querySelector('[data-perkara="601"]') as HTMLElement;
    const rek = await sampai(() => kartu.querySelector("[data-rekening]"), "rekening");
    expect(rek.textContent).toBe("BNI ****2233");
    expect(kartu.textContent).not.toContain("contoh.test");
    (kartu.querySelector("button.aleta-kasir-cetak-skum") as HTMLButtonElement).click();
    const kabar = await sampai(
      () => Array.from(kartu.querySelectorAll(".aleta-kasir-pembayar-kabar .aleta-basmassal-kabar")).find((k) => /belum terbaca/.test(k.textContent || "")),
      "kabar"
    );
    expect(kabar.textContent).toContain("e-SKUM perkara ini belum terbaca dari e-Court");
    expect(kabar.textContent).not.toMatch(/HTTP|gateway|404/);
    h.dom.window.close();
  });

  it("kolom bertajuk Tanggal | Uraian | Nominal; nominal 'Rp' + 29.500 rata kanan; isian nomor resi langsung di baris", async () => {
    const h = bukaKartu();
    const manual = await bukaManual(h);
    const kartu = manual.querySelector('[data-perkara="601"]') as HTMLElement;
    expect(Array.from(kartu.querySelectorAll("thead th")).map((t) => t.textContent)).toEqual(["", "Tanggal", "Uraian", "Nominal", ""]);
    const tr = kartu.querySelector('tr[data-usulan="u1"]') as HTMLTableRowElement;
    const nominal = tr.querySelector("input.aleta-kasir-nominal") as HTMLInputElement;
    expect(nominal.value).toBe("29.500");
    expect(tr.querySelector(".aleta-kasir-rp-awalan")!.textContent).toBe("Rp");
    nominal.value = "Rp 1.250.000";
    nominal.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect(nominal.value).toBe("1.250.000");
    // Resi: peringatan ringkas + isian; "Pakai" melengkapi uraian menjadi <uraian>/<resi>.
    const peringat = tr.querySelector(".aleta-kasir-resi") as HTMLElement;
    expect(peringat.hidden).toBe(false);
    expect(peringat.textContent).toContain("Nomor resi Pos belum ada");
    const resi = peringat.querySelector("input.aleta-kasir-resi-isian") as HTMLInputElement;
    resi.value = "RR000111222ID";
    (peringat.querySelector("button.aleta-kasir-resi-pakai") as HTMLButtonElement).click();
    expect((tr.querySelector("input.aleta-kasir-uraian") as HTMLInputElement).value).toBe("Biaya Panggilan Tergugat/RR000111222ID");
    expect(peringat.hidden).toBe(true);
    h.dom.window.close();
  });

  it("CSS kartu baru: hanya token warna, ukuran huruf ikut skala (>= 11.5px), bukan di blok akhir V2 LAYAR", () => {
    const awal = CSS.indexOf("/* === KASIR 3 Nov 2026");
    const akhir = CSS.indexOf("/* === AKHIR KASIR 3 Nov === */");
    expect(awal).toBeGreaterThan(0);
    expect(akhir).toBeGreaterThan(awal);
    expect(akhir).toBeLessThan(CSS.indexOf("V2 LAYAR (18 Okt 2026)"));
    const blok = CSS.slice(awal, akhir);
    expect(blok).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const ukuran = [...blok.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1]);
    expect(ukuran.length).toBeGreaterThan(5);
    for (const u of ukuran) {
      expect(u).toMatch(/^calc\(\d+(\.\d+)?px \* var\(--aleta-skala-huruf, 1\)\)$/);
      expect(Number(/(\d+(?:\.\d+)?)px/.exec(u)![1])).toBeGreaterThanOrEqual(11.5);
    }
  });
});
