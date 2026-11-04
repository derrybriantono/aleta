// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { PDFDocument, PDFPage } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buatPdfInstrumen, buatPdfPsp } from "@/server/modules/aleta-ecourt/kasir-cetak-pdf";
import { buatPdfSkumEcourt } from "@/server/modules/aleta-ecourt/skum-ecourt-pdf";

/**
 * ============================================================================
 * KASIR ALETA 4 NOV 2026: TAMPILAN BARU SESUAI RANCANGAN (hanya tampilan)
 * ============================================================================
 *
 * Yang dijaga: bilah tab, kartu angka penyaring (Perkara bergerak / Perlu dijurnal / Sudah lengkap), kolom Cari
 * perkara, kepala kartu (nomor, jenis, tahap, status), pita PBT, kaki lengket (baris + total Rupiah, Batal pilih),
 * pintasan rentang Sisa panjar, CSS bertoken, dan kertas PDF (judul, jumlah tugas, paraf, rincian pembayaran).
 * SELURUH data REKAAN.
 */

const AKAR = path.resolve(process.cwd(), "..");
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
const usulan = (kunci: string, uraian: string, jumlah: number, ekstra: Record<string, unknown> = {}) => ({
  kunci, jenisBiayaId: 157, kategoriId: 13, jenisTransaksi: -1, pihakKe: 2, pihakId: 12, uraian, jumlah, tanggal: HARI, keterangan: "", jurusitaId: 0,
  peristiwa: "Putusan", dasar: "kebiasaan", yakin: "tinggi", pilih: true, perluResi: false, sisaOtomatis: false, tersedia: true, ...ekstra,
});

const dom: JSDOM[] = [];
afterEach(async () => {
  await tunggu(60);
  while (dom.length) dom.pop()!.window.close();
});

function buka() {
  const d = new JSDOM(`<!doctype html><html><body><div id="wadah"></div></body></html>`, {
    url: "http://192.168.10.10/SIPP/jurnal_perkara_list/ENC",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  dom.push(d);
  const w = d.window as any;
  w.chrome = {
    runtime: { id: "x", getManifest: () => ({ version: "1.205.0" }), getURL: (x: string) => x, lastError: undefined, sendMessage: (_m: unknown, b?: (x: unknown) => void) => setTimeout(() => b && b({ ok: true }), 0) },
    storage: { local: { get: async () => ({ ujiTampilan: "baru", modeKering: false }), set: async () => undefined, remove: async () => undefined }, session: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener: () => undefined } },
  };
  const akunKasir = { akunKasir: true, ok: true, username: "kasir_uji", nama: "Tiara Rekaan, A.Md.", calon: [], milik: [], dipilih: "", bolehPilih: false };
  const minta: string[] = [];
  w.fetch = async (alamat: string) => {
    const url = String(alamat);
    minta.push(url);
    const data = (isi: unknown) => Response.json({ ok: true, data: isi });
    if (/\/pembayaran-ecourt\?/.test(url)) {
      return data({ ok: true, perkara: { "601/Pdt.G/2026/PA.Xyz": { nomorPerkara: "601/Pdt.G/2026/PA.Xyz", diterimaDari: "Budi Rekaan, S.H.", nomorRekening: "9900112233", atasNama: "", bank: "BNI", panjar: 355000, status: "Sudah dibayar", tanggal: "2026-11-01", jam: "10:12:00", adaSkum: true } } });
    }
    if (/\/kasir\/harian\?/.test(url)) {
      return data({
        available: true, ok: true, tanggal: HARI, hariIni: HARI, jumlahCalon: 4, gagal: [], terpotong: false, akun: akunKasir,
        lengkap: [
          { perkaraId: 603, nomorPerkara: "603/Pdt.G/2026/PA.Xyz", jenisPerkara: "Cerai Talak", keadaan: { nama: "Putus verstek" }, sebab: ["putusan"], saldo: 0 },
          { perkaraId: 604, nomorPerkara: "604/Pdt.G/2026/PA.Xyz", jenisPerkara: "Cerai Gugat", keadaan: { nama: "Menunggu sidang pertama" }, sebab: ["sidang"], saldo: 0 },
        ],
        perkara: [
          { perkaraId: 601, nomorPerkara: "601/Pdt.G/2026/PA.Xyz", jenisPerkara: "Cerai Gugat", keadaan: { nama: "Dalam persidangan" }, sebab: ["sidang"], saldo: 300000, perluPeriksa: false, usulan: [usulan("u1", "Redaksi", 10000), usulan("u2", "Meterai", 10000)], catatan: [] },
          { perkaraId: 602, nomorPerkara: "602/Pdt.G/2026/PA.Xyz", jenisPerkara: "Cerai Talak", keadaan: { nama: "Putus verstek" }, sebab: ["putusan"], saldo: 100000, perluPeriksa: false, usulan: [usulan("u1", "Redaksi", 10000)], catatan: [] },
        ],
      });
    }
    if (/\/kasir\/psp\?/.test(url)) return data({ available: true, ok: true, dari: HARI, sampai: HARI, jumlah: 0, total: 0, daftar: [], rekeningDisembunyikan: false });
    if (/\/kasir\/instrumen\?/.test(url)) return data({ available: true, ok: true, dari: HARI, sampai: HARI, kelompok: [] });
    if (/\/kasir\/otomatis\?/.test(url)) return data({ available: true, ok: true, tanggal: HARI, hariIni: HARI, bolehUbah: true, setelan: { nyala: false, butir: {} }, butirDaftar: [], perkara: [], gagal: [], ringkas: { perkara: 0, akanDiisi: 0, baris: 0 }, akun: akunKasir });
    if (/\/kasir\/pengingat/.test(url)) return data({ available: true, ok: true, hariIni: HARI, butir: [], ringkas: {} });
    if (/\/kasir\/riwayat\?/.test(url)) return data({ available: true, ok: true, jumlah: 0, pekerjaan: [] });
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.eval(`${SUMBER}\n;window.__mode = () => alatUjiMode(); alatCobaMenahan = () => false;`);
  return { w, wadah: w.document.getElementById("wadah") as HTMLElement, minta };
}

async function bukaHariIni() {
  const h = buka();
  await sampai(() => h.w.__mode() === "baru", "mode baru");
  expect(await h.w.aletaKasirPasangHarian(h.wadah, { situs: "sipp" })).toBe(true);
  const manual = h.wadah.querySelector('details[data-kasir-bagian="manual"]') as HTMLDetailsElement;
  await sampai(() => manual.querySelector('[data-perkara="601"] tr[data-usulan="u1"]'), "kartu");
  return { ...h, manual };
}

const tampak = (m: HTMLElement, sel: string) => Array.from(m.querySelectorAll(sel)).filter((e) => !(e as HTMLElement).hidden);

describe("1. kartu angka penyaring, Cari perkara, kepala kartu", () => {
  it("tiga kartu angka berisi hitungan; menekan kartu menyembunyikan yang lain; perkara sudah lengkap tampil ringkas dengan tautan Jurnal SIPP", async () => {
    const { manual, w } = await bukaHariIni();
    const kartu = Array.from(manual.querySelectorAll("button.aleta-kasir-ringkas-kartu")) as HTMLButtonElement[];
    expect(kartu.map((k) => [k.getAttribute("data-saring"), k.querySelector(".aleta-kasir-ringkas-angka")!.textContent, k.querySelector(".aleta-kasir-ringkas-judul")!.textContent])).toEqual([
      ["semua", "4", "Perkara bergerak"],
      ["perlu", "2", "Perlu dijurnal"],
      ["lengkap", "2", "Sudah lengkap"],
    ]);
    expect(kartu[0].getAttribute("aria-pressed")).toBe("true");
    expect(tampak(manual, "[data-kartu]").length).toBe(4);
    kartu[1].click();
    expect(tampak(manual, "[data-kartu]").map((k) => k.getAttribute("data-kartu"))).toEqual(["perlu", "perlu"]);
    expect(kartu[1].getAttribute("aria-pressed")).toBe("true");
    kartu[2].click();
    const lengkap = tampak(manual, "[data-kartu]");
    expect(lengkap.map((k) => k.getAttribute("data-lengkap"))).toEqual(["603", "604"]);
    expect(lengkap[0].textContent).toContain("603/Pdt.G/2026/PA.Xyz");
    expect(lengkap[0].textContent).toContain("Cerai Talak");
    expect(lengkap[0].textContent).toContain("Putus verstek");
    expect(lengkap[0].querySelector(".aleta-kasir-status-lengkap")!.textContent).toBe("Sudah lengkap");
    expect(lengkap[0].querySelector("a.aleta-kasir-kartu-tautan")!.textContent).toBe("Jurnal SIPP");
    // Perkara lengkap tidak punya baris jurnal dan tidak ikut terkirim.
    expect(lengkap[0].querySelector("tr[data-usulan]")).toBeNull();
    void w;
  });

  it("kepala kartu perlu dijurnal: nomor, jenis perkara, tahap, status; Cari perkara menyaring nomor dan nama pembayar tanpa panggilan baru", async () => {
    const { manual, minta } = await bukaHariIni();
    const k601 = manual.querySelector('[data-perkara="601"]') as HTMLElement;
    const kep = k601.querySelector(".aleta-kasir-kartu-kepala") as HTMLElement;
    expect(kep.querySelector(".aleta-kasir-kartu-nomor")!.textContent).toBe("601/Pdt.G/2026/PA.Xyz");
    expect(kep.querySelector(".aleta-kasir-kartu-jenis")!.textContent).toBe("Cerai Gugat");
    expect(kep.querySelector(".aleta-kasir-keadaan")!.textContent).toBe("Dalam persidangan");
    expect(kep.querySelector(".aleta-kasir-status-perlu")!.textContent).toBe("Perlu dijurnal");
    expect(kep.querySelector("a.aleta-kasir-kartu-tautan")!.textContent).toBe("Jurnal SIPP");

    const cari = manual.querySelector("input.aleta-kasir-cari-perkara") as HTMLInputElement;
    const sebelum = minta.length;
    cari.value = "602";
    cari.dispatchEvent(new (manual.ownerDocument.defaultView as any).Event("input", { bubbles: true }));
    expect(tampak(manual, "[data-kartu]").map((k) => k.getAttribute("data-perkara"))).toEqual(["602"]);
    // Nama pembayar e-Court (terbaca sesudah daftar) ikut dicari.
    await sampai(() => (manual.querySelector('[data-perkara="601"]') as HTMLElement).getAttribute("data-cari")!.includes("budi rekaan"), "nama pembayar terbaca");
    cari.value = "budi rekaan";
    cari.dispatchEvent(new (manual.ownerDocument.defaultView as any).Event("input", { bubbles: true }));
    expect(tampak(manual, "[data-kartu]").map((k) => k.getAttribute("data-perkara"))).toEqual(["601"]);
    cari.value = "tidak-ada-yang-cocok";
    cari.dispatchEvent(new (manual.ownerDocument.defaultView as any).Event("input", { bubbles: true }));
    expect(tampak(manual, "[data-kartu]")).toEqual([]);
    expect((manual.querySelector(".aleta-kasir-kosong") as HTMLElement).hidden).toBe(false);
    // Menyaring hanya di layar: tidak ada permintaan ke server sesudah pencarian dimulai (selain pembayaran yang sudah berjalan).
    expect(minta.slice(sebelum).filter((u) => /harian/.test(u))).toEqual([]);
  });
});

describe("2. kaki lengket: baris dan total Rupiah yang akan dijurnal", () => {
  it("jumlah baris + total mengikuti centang baris dan perkara; Batal pilih hanya melepas centang perkara di layar", async () => {
    const { manual, w, minta } = await bukaHariIni();
    const kaki = manual.querySelector(".aleta-kasir-kaki") as HTMLElement;
    const utama = () => Array.from(kaki.querySelectorAll("button")).find((b) => /^Masukkan ke jurnal SIPP/.test(b.textContent || "")) as HTMLButtonElement;
    expect(kaki.querySelector(".aleta-kasir-kaki-baris")!.textContent).toBe("3 baris dipilih untuk dijurnal (2 perkara)");
    expect(kaki.querySelector(".aleta-kasir-kaki-total")!.textContent).toBe("Rp30.000");
    expect(utama().disabled).toBe(false);
    // Lepas centang satu baris -> 2 baris, Rp20.000.
    const cek = manual.querySelector('[data-perkara="601"] tr[data-usulan="u2"] input[type="checkbox"]') as HTMLInputElement;
    cek.checked = false;
    cek.dispatchEvent(new w.Event("change", { bubbles: true }));
    expect(kaki.querySelector(".aleta-kasir-kaki-baris")!.textContent).toBe("2 baris dipilih untuk dijurnal (2 perkara)");
    expect(kaki.querySelector(".aleta-kasir-kaki-total")!.textContent).toBe("Rp20.000");
    // Batal pilih: tidak ada perkara terpilih, tombol utama mati, tidak ada permintaan tulis.
    (Array.from(kaki.querySelectorAll("button")).find((b) => b.textContent === "Batal pilih") as HTMLButtonElement).click();
    const kaki2 = manual.querySelector(".aleta-kasir-kaki") as HTMLElement;
    expect(kaki2.querySelector(".aleta-kasir-kaki-baris")!.textContent).toBe("0 baris dipilih untuk dijurnal");
    expect(kaki2.querySelector(".aleta-kasir-kaki-total")!.textContent).toBe("Rp0");
    expect((Array.from(kaki2.querySelectorAll("button")).find((b) => /^Masukkan ke jurnal SIPP/.test(b.textContent || "")) as HTMLButtonElement).disabled).toBe(true);
    expect(manual.querySelectorAll('.aleta-basmassal-pilih-perkara input:checked').length).toBe(0);
    expect(minta.some((u) => /\/sidang\/kasir$/.test(u))).toBe(false);
    // Kaki lengket berada SESUDAH kotak kabar supaya kabar antrean tetap terlihat di atas kaki.
    expect(manual.querySelector(".aleta-kasir-kaki")!.previousElementSibling).not.toBeNull();
  });
});

describe("2b. penanda sedang menulis di tab", () => {
  it("saat bagian menulis ke SIPP (data-kasir-sibuk) tabnya berpenanda walau tab lain yang tampak", async () => {
    const { manual, wadah } = await bukaHariIni();
    const tabHari = wadah.querySelector('button[data-kasir-tab-ke="hari"]') as HTMLButtonElement;
    expect(tabHari.hasAttribute("data-sibuk")).toBe(false);
    const isi = manual.querySelector(".aleta-kasir-isi") as HTMLElement;
    isi.setAttribute("data-kasir-sibuk", "");
    await sampai(() => tabHari.hasAttribute("data-sibuk"), "penanda sibuk");
    isi.removeAttribute("data-kasir-sibuk");
    await sampai(() => !tabHari.hasAttribute("data-sibuk"), "penanda hilang");
  });
});

describe("3. Sisa panjar: pintasan rentang", () => {
  it("Hari ini / Kemarin / 7 hari hanya mengisi tanggal lalu membaca daftar; Instrumen jurusita memakai bagian yang sama", async () => {
    const h = buka();
    await sampai(() => h.w.__mode() === "baru", "mode baru");
    await h.w.aletaKasirPasangHarian(h.wadah, { situs: "sipp" });
    (h.wadah.querySelector('button[data-kasir-tab-ke="psp"]') as HTMLButtonElement).click();
    const cetak = h.wadah.querySelector('details[data-kasir-bagian="cetak"]') as HTMLDetailsElement;
    expect(cetak.hidden).toBe(false);
    await sampai(() => h.minta.some((u) => /\/kasir\/psp\?/.test(u)), "daftar PSP dibaca");
    const dari = cetak.querySelector('input[aria-label="Dari tanggal"]') as HTMLInputElement;
    const sampaiT = cetak.querySelector('input[aria-label="Sampai tanggal"]') as HTMLInputElement;
    const tombolPintas = (t: string) => Array.from(cetak.querySelectorAll("button.aleta-kasir-pintas-tombol")).find((b) => b.textContent === t) as HTMLButtonElement;
    const hari = sampaiT.value;
    const mundur = (iso: string, n: number) => {
      const d = new Date(`${iso}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - n);
      return d.toISOString().slice(0, 10);
    };
    const n0 = h.minta.filter((u) => /\/kasir\/psp\?/.test(u)).length;
    tombolPintas("7 hari").click();
    expect([dari.value, sampaiT.value]).toEqual([mundur(hari, 6), hari]);
    tombolPintas("Kemarin").click();
    expect([dari.value, sampaiT.value]).toEqual([mundur(hari, 1), mundur(hari, 1)]);
    tombolPintas("Hari ini").click();
    expect([dari.value, sampaiT.value]).toEqual([hari, hari]);
    await sampai(() => h.minta.filter((u) => /\/kasir\/psp\?/.test(u)).length >= n0 + 2, "pembacaan sesudah pintasan");
    const urlPsp = h.minta.filter((u) => /\/kasir\/psp\?/.test(u)).map((u) => decodeURIComponent(u));
    expect(urlPsp.some((u) => u.includes(`dari=${mundur(hari, 6)}&sampai=${hari}`))).toBe(true);
    expect(urlPsp.some((u) => u.includes(`dari=${mundur(hari, 1)}&sampai=${mundur(hari, 1)}`))).toBe(true);
    (h.wadah.querySelector('button[data-kasir-tab-ke="instrumen"]') as HTMLButtonElement).click();
    expect(h.wadah.querySelector(".aleta-kasir-harian")!.getAttribute("data-kasir-tab")).toBe("instrumen");
    expect(cetak.hidden).toBe(false);
    // Hari ini (tab awal) tertutup, hanya satu tab terpilih.
    expect(Array.from(h.wadah.querySelectorAll('button[role="tab"][aria-selected="true"]')).map((b) => b.getAttribute("data-kasir-tab-ke"))).toEqual(["instrumen"]);
  });
});

describe("4. CSS KASIR 4 Nov: bertoken, huruf berskala, bukan di blok ukuran V2 LAYAR", () => {
  it("hanya token --aleta-*, ukuran huruf calc(... * var(--aleta-skala-huruf, 1)) >= 11.5px, terletak sebelum V2 LAYAR", () => {
    const awal = CSS.indexOf("/* === KASIR 4 Nov 2026");
    const akhir = CSS.indexOf("/* === AKHIR KASIR 4 Nov === */");
    expect(awal).toBeGreaterThan(0);
    expect(akhir).toBeGreaterThan(awal);
    expect(akhir).toBeLessThan(CSS.indexOf("V2 LAYAR (18 Okt 2026)"));
    const blok = CSS.slice(awal, akhir);
    expect(blok).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(blok).not.toMatch(/rgba?\(/);
    const ukuran = [...blok.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1]);
    expect(ukuran.length).toBeGreaterThan(10);
    for (const u of ukuran) {
      expect(u).toMatch(/^calc\(\d+(\.\d+)?px \* var\(--aleta-skala-huruf, 1\)\)$/);
      expect(Number(/(\d+(?:\.\d+)?)px/.exec(u)![1])).toBeGreaterThanOrEqual(11.5);
    }
    // Tiap kelas baru yang dipakai skrip ada gayanya.
    for (const kelas of ["aleta-kasir-tab-tombol", "aleta-kasir-ringkas-kartu", "aleta-kasir-kaki", "aleta-kasir-pita-pbt", "aleta-kasir-status-perlu", "aleta-kasir-akun"]) expect(blok).toContain(kelas);
  });
});

// ─── PDF ─────────────────────────────────────────────────────────────────────
async function teksPdf(buat: () => Promise<Uint8Array>): Promise<string[]> {
  const tulisan: string[] = [];
  const asli = PDFPage.prototype.drawText;
  const mata = vi.spyOn(PDFPage.prototype, "drawText").mockImplementation(function (this: PDFPage, teks: string, opsi?: Parameters<PDFPage["drawText"]>[1]) {
    tulisan.push(teks);
    return asli.call(this, teks, opsi);
  });
  try {
    await PDFDocument.load(await buat());
  } finally {
    mata.mockRestore();
  }
  return tulisan;
}

describe("5. kertas PDF mengikuti rancangan", () => {
  it("Instrumen: judul penuh, jumlah tugas, penyerah kasir di kiri dan penerima jurusita di kanan (nama jurusita di kanan)", async () => {
    const teks = await teksPdf(() =>
      buatPdfInstrumen(
        {
          kunci: "js-7", jurusitaId: 7, jurusita: "Eko Rekaan", jumlahPanggilan: 1, jumlahPbt: 1, total: 59000,
          baris: [
            { jurnalId: 1, perkaraId: 1, nomorPerkara: "902/Pdt.G/2026/PA.Xyz", tanggal: HARI, jenisBiayaId: 29, uraian: "Biaya Panggilan", jenis: "Panggilan sidang ke-1", jumlah: 29500, pihak: "Tergugat Rekaan", alamat: "Desa Contoh", jurusitaId: 7, jurusita: "Eko Rekaan", jurusitaDariPerkara: false },
            { jurnalId: 2, perkaraId: 2, nomorPerkara: "906/Pdt.G/2026/PA.Xyz", tanggal: HARI, jenisBiayaId: 29, uraian: "Biaya Pemberitahuan", jenis: "PBT (pemberitahuan isi putusan)", jumlah: 29500, pihak: "Tergugat Dua", alamat: "Desa Lama", jurusitaId: 7, jurusita: "Eko Rekaan", jurusitaDariPerkara: false },
          ],
        },
        { dari: HARI, sampai: HARI }
      )
    );
    expect(teks).toContain("INSTRUMEN BIAYA PANGGILAN DAN PEMBERITAHUAN PUTUSAN");
    expect(teks.some((t) => /^Jumlah tugas: 2 relaas \(1 panggilan, 1 PBT\)$/.test(t))).toBe(true);
    expect(teks).toContain("Yang menyerahkan, Kasir,");
    expect(teks).toContain("Yang menerima, Jurusita,");
    expect(teks).toContain("(Eko Rekaan)");
    expect(teks.join(" ")).toContain("Jumlah diterima jurusita");
  });

  it("PSP: kolom Paraf / bukti transfer dan tanda tangan Panitera + Kasir", async () => {
    const teks = await teksPdf(() =>
      buatPdfPsp({
        ok: true, dari: HARI, sampai: HARI, jumlah: 1, total: 42000,
        daftar: [{ jurnalId: 1, perkaraId: 1, nomorPerkara: "905/Pdt.G/2026/PA.Xyz", tanggal: HARI, jumlah: 42000, penerima: "Ani Rekaan", kuasa: "", ecourt: false, rekening: null }],
      })
    );
    expect(teks).toContain("Paraf / bukti transfer");
    expect(teks).toContain("Sisa panjar");
    expect(teks).toContain("Mengetahui, Panitera,");
  });

  const SKUM = { kop: ["PENGADILAN AGAMA REKAAN", "JL. CONTOH NO. 1"], judul: "SURAT KUASA UNTUK MEMBAYAR ELEKTRONIK (e-SKUM)", nama: "Budi Rekaan", alamat: "Jl. Contoh", telp: "0800", pengantar: "", rincian: [{ no: 1, uraian: "Pendaftaran", jumlah: 30000 }], total: 30000, kodePendaftaran: "PA.XYZ-01112026CT1" };
  it("e-SKUM: Nomor Perkara dan rincian pembayaran; bank/rekening hanya bila diberikan (peran berhak)", async () => {
    const penuh = await teksPdf(() => buatPdfSkumEcourt(SKUM, { nomorPerkara: "902/Pdt.G/2026/PA.Xyz", pembayaran: { status: "Sudah dibayar", tanggal: HARI, jam: "09:12:00", nomorPembayaran: "1984540126", bank: "BNI", nomorRekening: "9900112233" } }));
    expect(penuh).toContain("Nomor Perkara");
    expect(penuh).toContain("902/Pdt.G/2026/PA.Xyz");
    expect(penuh).toContain("Status pembayaran: Sudah dibayar");
    expect(penuh).toContain("Tanggal: Selasa, 3 November 2026 pukul 09:12");
    expect(penuh).toContain("Nomor pembayaran: 1984540126");
    expect(penuh).toContain("Bank: BNI · rekening 9900112233");
    const tanpa = await teksPdf(() => buatPdfSkumEcourt(SKUM, { nomorPerkara: "902/Pdt.G/2026/PA.Xyz", pembayaran: { status: "Sudah dibayar", tanggal: HARI, nomorPembayaran: "1984540126" } }));
    expect(tanpa.some((t) => /9900112233|^Bank:/.test(t))).toBe(false);
    expect(tanpa).toContain("Status pembayaran: Sudah dibayar");
    // Tanpa rincian pembayaran: kertas lama tetap sama (tanpa baris status).
    const lama = await teksPdf(() => buatPdfSkumEcourt(SKUM, {}));
    expect(lama.some((t) => /^Status pembayaran/.test(t))).toBe(false);
    expect(lama).not.toContain("Nomor Perkara");
  });

  it("rute e-SKUM hanya menyertakan bank/rekening untuk peran yang berhak melihatnya", () => {
    const rute = readFileSync(path.join(process.cwd(), "src/app/api/aleta-ecourt/pembayaran-ecourt/skum/route.ts"), "utf8");
    expect(rute).toMatch(/bolehLihatRekening\(aktor as UserPersona\) \? \{ bank: p\.bank, nomorRekening: p\.nomorRekening \} : \{\}/);
  });
});
