// @vitest-environment node
/**
 * ============================================================================
 * PERBAIKAN 5 OKT 2026 - KARTU KTP, ALUR SAKSI, TAB PTSP, SEMBUL SIPP (jsdom)
 * ============================================================================
 *
 * Berkas ekstensi SUNGGUHAN dijalankan di halaman SIPP tiruan:
 *
 *   E. saksiscan.js + jembatan.js + panel-alat.js
 *        - kartu dapat dibuka tanpa blangko dan TIDAK ikut tertutup bersama
 *          blangko (butir 10); tombol isi membuka blangko yang tepat
 *        - blangko saksi (#frm_user): Cari -> Tambah -> #frm_ref_pihak diisi,
 *          Simpan tidak ditekan; pihak yang sudah ada (nama + tanggal lahir
 *          sama) -> [Pilih] (butir 7)
 *        - zona seret-lepas, PDF dikirim apa adanya, "[object Object]" (9, 12)
 *        - tema kartu mengikuti panel (butir 13)
 *   P. panel-alat.js + basmassal.js + saksiscan.js + konten.js
 *        - tab PTSP: Data Umum pindah ke sana, tautan di Penetapan, kartu KTP
 *          dari tab, menu per peran (butir 11, 12)
 *        - sembul SIPP digeser dari panel berlabuh, kecuali panel > separuh
 *          layar (butir 15)
 *        - rapikan identitas para pihak lewat blangko Edit pihak SIPP (26)
 *
 * Pembukti gigitan: ALETA_UJI_SAKSISCAN dan ALETA_UJI_KONTEN menunjuk salinan
 * berkas lama; ALETA_UJI_PANEL_CSS salinan panel.css lama.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { rapikanAlamat } from "@/lib/alamat-pihak";
import { petikDataUmum } from "@/server/modules/aleta-ecourt/berkas-gugatan";

const AKAR = path.resolve(__dirname, "../../..");
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKSTENSI, b), "utf8").replace(/\r\n/g, "\n");
const dariEnv = (kunci: string, berkas: string) =>
  process.env[kunci] ? readFileSync(process.env[kunci] as string, "utf8").replace(/\r\n/g, "\n") : baca(berkas);
const ALAT = baca("panel-alat.js");
const JEMBATAN = baca("jembatan.js");
const BASMASSAL = baca("basmassal.js");
const SAKSI = dariEnv("ALETA_UJI_SAKSISCAN", "saksiscan.js");
const KONTEN = () => dariEnv("ALETA_UJI_KONTEN", "konten.js");
const CSS = dariEnv("ALETA_UJI_PANEL_CSS", "panel.css");

const ASAL = "http://192.168.10.10";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 6000): Promise<NonNullable<T>> {
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
    await tunggu(15);
  }
}
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

// ============================================================================
// E. saksiscan.js di halaman blangko saksi SIPP
// ============================================================================
const MEDAN = {
  nama: "Siti Aminah",
  nik: "7203094505900001",
  tempatLahir: "Donggala",
  tanggalLahir: "05/05/1990",
  jenisKelamin: "P",
  golonganDarah: "O",
  agama: "Islam",
  statusKawin: "Kawin",
  pekerjaan: "Mengurus Rumah Tangga",
  kewarganegaraan: "WNI",
  alamat: "Jl. Trans Sulawesi",
  rt: "001",
  rw: "002",
  kelurahan: "LABUAN SALUMBONE",
  kecamatan: "LABUAN",
  kabupaten: "",
  provinsi: "SULAWESI TENGAH",
  telepon: "",
  tanggalTerbit: "18/02/2012",
  kotaTerbit: "Donggala",
};
const WIL: Record<string, unknown[]> = {
  "": [{ kode: "72", nama: "Sulawesi Tengah", nilaiSipp: "NS72" }],
  "72": [
    { kode: "72.03", nama: "Kabupaten Donggala", nilaiSipp: "NS7203" },
    { kode: "72.71", nama: "Kota Palu", nilaiSipp: "NS7271" },
  ],
  "72.03": [
    { kode: "72.03.09", nama: "Labuan", nilaiSipp: "NS720309" },
    { kode: "72.03.12", nama: "Sindue Tobata", nilaiSipp: "NS720312" },
  ],
  "72.03.12": [
    { kode: "72.03.12.2001", nama: "Alindau", nilaiSipp: "NS4" },
    { kode: "72.03.12.2002", nama: "Oti", nilaiSipp: "NS5" },
  ],
  "72.71": [{ kode: "72.71.01", nama: "Palu Barat", nilaiSipp: "NS727101" }],
  "72.03.09": [{ kode: "72.03.09.2001", nama: "Labuan Salumbone", nilaiSipp: "NS1" }],
};

const BLANGKO_REF = `
<div id="popup_pihak" class="popup" style="display:none">
  <form id="frm_ref_pihak" method="post" action="/SIPP/pihak_list/validateInput">
    <input type="text" id="pihak_fullname"><input type="text" id="pihak_tempat_lahir"><input id="pihak_tgl_lahir">
    <select id="pihak_jenis_identitas"><option value="">-</option><option value="4">KTP</option></select>
    <input type="text" id="pihak_no_identitas"><input type="text" id="pihak_no_tlp"><textarea id="pihak_alamat"></textarea>
    <select id="prop"><option value="">-</option></select><select id="kab"><option value="">-</option></select>
    <select id="kec"><option value="">-</option></select><select id="kel"><option value="">-</option></select>
    <select id="pihak_jenis_kelamin"><option value="">-</option><option value="1">L</option><option value="2">P</option></select>
    <select id="pihak_agama"><option value="">-</option><option value="1">Islam</option></select>
    <select id="pihak_status_kawin"><option value="">-</option><option value="1">Kawin</option></select>
    <input type="text" id="pihak_umur"><input type="text" id="pihak_email">
    <select id="pihak_pendidikan"><option value="">Pilih Pendidikan</option><option value="3">SLTP/Sederajat</option><option value="4">SLTA/Sederajat</option></select>
    <textarea id="pihak_keterangan"></textarea><input type="submit" id="simpan_btn" value="Simpan">
  </form>
</div>`;

type OpsiE = { blangko?: "saksi" | "tidak"; daftar?: Array<{ nama: string; ttl: string }>; jawabScan?: (badan: string) => { status: number; isi: unknown } };

function bukaSaksi(p: OpsiE = {}) {
  const daftar = (p.daftar || [])
    .map(
      (r, i) =>
        `<tr><td><a href="#" class="pilih" data-i="${i}">[Pilih]</a></td><td><a href="#">[Edit]</a></td><td>${i + 1}</td><td>${r.nama}</td><td>Desa X</td><td>${r.ttl}</td><td>P</td><td>-</td></tr>`
    )
    .join("");
  const saksi =
    p.blangko === "tidak"
      ? ""
      : `<div id="popup_form" class="popup" style="display:block"><div id="form_pop">
          <form id="frm_user" method="post" action="/SIPP/addPihak/validateInput">
            <input type="text" id="fullname" readonly><input type="button" id="cari_saksi" value="Cari">
            <input type="text" id="prop2" readonly><textarea id="alamat" readonly></textarea>
            <input type="submit" id="simpan_saksi" value="Simpan">
          </form></div></div>`;
  const dom = new JSDOM(
    `<!doctype html><html><head></head><body><div id="konten">detil</div>${saksi}
      <div id="popup_form_2nd" class="popup" style="display:none">
        <div id="popup_pihak_list"><input type="button" id="addPihak" value="Tambah">
          <table id="tablePerkaraAll"><tbody><tr><td></td><td></td><td>No</td><td>Nama</td><td>Alamat</td><td>TTL</td><td>JK</td><td>Pek</td></tr>${daftar}</tbody></table>
        </div>${BLANGKO_REF}
      </div></body></html>`,
    { url: `${ASAL}/SIPP/detil_perkara_agama`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const d = w.document as Document;
  // jsdom tanpa tata letak: tombol yang tidak display:none dianggap berkotak.
  w.HTMLElement.prototype.getClientRects = function () {
    return [{}];
  };
  // 21 Okt 2026: panel bawaannya lencana; uji isi/letak panel memakai panel yang disetel TERBUKA (pilihan sesudah keputusan itu).
  const simpanan: Record<string, unknown> = { ujiTampilan: "ui", ujiIzinkanNyata: true, panelBawaanTampil: { aleta: true, sipp: true, abt: true, diubahPada: "2026-10-22T00:00:00.000Z" } };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.184.0" }), getURL: (x: string) => x, sendMessage: () => undefined },
    storage: {
      local: {
        get: async (k?: string | string[] | null) => {
          const daftarK = k == null ? Object.keys(simpanan) : [k].flat();
          return Object.fromEntries(daftarK.filter((x) => x in simpanan).map((x) => [x, polos(simpanan[x])]));
        },
        set: async () => undefined,
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const minta: Array<{ url: string; cara: string; badan: string }> = [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: string }) => {
    const url = String(alamat);
    const badan = String((opsi && opsi.body) || "");
    minta.push({ url, cara: String((opsi && opsi.method) || "GET").toUpperCase(), badan });
    if (url.includes("/ekstensi/siapa")) return Response.json({ ok: true, data: { nama: "Penguji", peran: "Petugas PTSP" } });
    if (url.includes("/aleta-ecourt/wilayah")) {
      const induk = new URL(url, ASAL).searchParams.get("induk") || "";
      return Response.json({ ok: true, data: { ok: true, sandi: { ok: true }, data: WIL[induk] || [] } });
    }
    if (url.includes("/aleta-ecourt/saksi-scan")) {
      if (p.jawabScan) {
        const j = p.jawabScan(badan);
        return Response.json(j.isi, { status: j.status });
      }
      return Response.json({ ok: true, data: { available: true, ok: true, sumber: "teks", medan: MEDAN, nik: { sah: true, kodeKecamatan: "72.03.09" }, catatan: [], terbaca: ["nama"] } });
    }
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.postMessage = (data: unknown) => setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data, source: w })), 0);
  w.Image = class {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    set src(_x: string) {
      setTimeout(() => this.onerror && this.onerror(), 0);
    }
  };
  // Perilaku SIPP: Cari membuka daftar referensi; Tambah membuka #frm_ref_pihak
  // (clearAll); [Pilih] mengisi blangko saksi lalu menutup daftar.
  const kejadian: string[] = [];
  const tampil = (id: string, ya: boolean) => ((d.getElementById(id) as HTMLElement).style.display = ya ? "block" : "none");
  d.getElementById("cari_saksi")?.addEventListener("click", () => {
    kejadian.push("cari");
    tampil("popup_form", false);
    tampil("popup_form_2nd", true);
  });
  d.getElementById("addPihak")!.addEventListener("click", () => {
    kejadian.push("tambah");
    tampil("popup_pihak_list", false);
    tampil("popup_pihak", true);
    for (const el of Array.from(d.querySelectorAll("#popup_pihak input:not([type=submit]), #popup_pihak textarea"))) (el as HTMLInputElement).value = "";
  });
  for (const a of Array.from(d.querySelectorAll("a.pilih"))) {
    a.addEventListener("click", () => {
      kejadian.push(`pilih:${(a as HTMLElement).dataset.i}`);
      (d.getElementById("fullname") as HTMLInputElement).value = p.daftar![Number((a as HTMLElement).dataset.i)].nama;
      tampil("popup_form_2nd", false);
      tampil("popup_form", true);
    });
  }
  for (const id of ["simpan_btn", "simpan_saksi"]) d.getElementById(id)?.addEventListener("click", () => kejadian.push(`simpan:${id}`));
  w.eval(JEMBATAN);
  // Sebagai SKRIP (bukan eval): fungsi tingkat atas berkas "use strict" hanya
  // menjadi milik global bila dijalankan seperti skrip konten.
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(SAKSI, ctx, { filename: "saksiscan.js" });
  return { dom, w, d, minta, kejadian };
}
type HalE = ReturnType<typeof bukaSaksi>;
const kartuDari = (h: HalE) => h.d.querySelector(".aleta-c2-saksi") as HTMLElement | null;

async function bukaKartuDanBaca(h: HalE) {
  const kartu = await sampai(() => {
    if (typeof h.w.saksiscanBuka !== "function") return null;
    return h.w.saksiscanBuka() as HTMLElement;
  }, "kartu dibuka");
  (kartu.querySelector(".aleta-c2-saksi-teks") as HTMLTextAreaElement).value = "NIK : 7203094505900001";
  (kartu.querySelector(".aleta-c2-saksi-baca") as HTMLButtonElement).click();
  await sampai(() => !(kartu.querySelector(".aleta-c2-saksi-tinjau") as HTMLElement).hidden, "tinjau");
  await sampai(() => (kartu.querySelector("select[data-saksi-wilayah='kelurahan']") as HTMLSelectElement).value, "wilayah disimpulkan");
  const centang = kartu.querySelector(".aleta-c2-saksi-sudah") as HTMLInputElement;
  centang.checked = true;
  centang.dispatchEvent(new h.w.Event("change"));
  return kartu;
}

describe("E. saksiscan.js: kartu KTP, alur saksi SIPP, zona seret-lepas", () => {
  it("wilayah: kabupaten TIDAK terbaca diambil dari NIK (cadangan otomatis); kelurahan mirip dipilih; rantai lengkap", async () => {
    const h = bukaSaksi();
    const k = await bukaKartuDanBaca(h);
    const nilai = (t: string) => (k.querySelector(`select[data-saksi-wilayah='${t}']`) as HTMLSelectElement).value;
    expect([nilai("provinsi"), nilai("kabupaten"), nilai("kecamatan"), nilai("kelurahan")]).toEqual(["72", "72.03", "72.03.09", "72.03.09.2001"]);
    expect(k.querySelector("[data-saksi-ket='kabupaten']")!.textContent).toMatch(/tidak terbaca - diambil dari NIK/);
  });

  it("blangko saksi (#frm_user, wilayah readonly): tombol = 'Isi data saksi'; Cari -> Tambah -> #frm_ref_pihak terisi; Simpan TIDAK ditekan", async () => {
    const h = bukaSaksi();
    const k = await bukaKartuDanBaca(h);
    const isi = k.querySelector(".aleta-c2-saksi-isi") as HTMLButtonElement;
    expect(isi.textContent).toMatch(/Isi data saksi/);
    expect(k.querySelector(".aleta-c2-saksi-alur")!.textContent).toMatch(/Cari lalu Tambah/);
    isi.click();
    await sampai(() => /BELUM TERSIMPAN/.test(k.querySelector(".aleta-c2-saksi-status")!.textContent || ""), "selesai isi", 15000);
    expect(h.kejadian).toEqual(["cari", "tambah"]);
    const v = (id: string) => (h.d.getElementById(id) as HTMLInputElement).value;
    expect([v("pihak_fullname"), v("pihak_no_identitas"), v("prop"), v("kab"), v("kec"), v("kel")]).toEqual([
      "Siti Aminah",
      "7203094505900001",
      "NS72",
      "NS7203",
      "NS720309",
      "NS1",
    ]);
    expect(k.querySelector(".aleta-c2-saksi-status")!.textContent).toMatch(/\[Pilih\]/);
    expect(h.d.getElementById("frm_ref_pihak")!.outerHTML).not.toMatch(/aleta/i);
  });

  it("pihak SUDAH ada di referensi (nama + tanggal lahir sama): [Pilih] baris itu, tidak menambah referensi ganda", async () => {
    const h = bukaSaksi({ daftar: [{ nama: "AHMAD", ttl: "Palu, 01-01-1980" }, { nama: "SITI AMINAH", ttl: "Donggala, 05-05-1990" }] });
    const k = await bukaKartuDanBaca(h);
    (k.querySelector(".aleta-c2-saksi-isi") as HTMLButtonElement).click();
    await sampai(() => /sudah ada di referensi SIPP/.test(k.querySelector(".aleta-c2-saksi-status")!.textContent || ""), "dipilih", 15000);
    expect(h.kejadian).toEqual(["cari", "pilih:1"]);
    expect((h.d.getElementById("fullname") as HTMLInputElement).value).toBe("SITI AMINAH");
  });

  it("nama sama tetapi tanggal lahir lain: berhenti dan bertanya; tekan sekali lagi = Tambah baru", async () => {
    const h = bukaSaksi({ daftar: [{ nama: "Siti Aminah", ttl: "Palu, 09-09-1999" }] });
    const k = await bukaKartuDanBaca(h);
    const isi = k.querySelector(".aleta-c2-saksi-isi") as HTMLButtonElement;
    isi.click();
    await sampai(() => /sudah ada di daftar referensi SIPP/.test(k.querySelector(".aleta-c2-saksi-status")!.textContent || ""), "bertanya", 15000);
    expect(h.kejadian).toEqual(["cari"]);
    await sampai(() => !isi.disabled, "tombol hidup lagi");
    isi.click();
    await sampai(() => /BELUM TERSIMPAN/.test(k.querySelector(".aleta-c2-saksi-status")!.textContent || ""), "ditambah", 15000);
    expect(h.kejadian).toEqual(["cari", "tambah"]);
  });

  it("kartu dibuka TANPA blangko dan tidak ikut tertutup saat blangko tertutup; isi tanpa blangko = petunjuk jujur", async () => {
    const h = bukaSaksi();
    const k = await bukaKartuDanBaca(h);
    (h.d.getElementById("popup_form") as HTMLElement).style.display = "none";
    await tunggu(700);
    expect(k.hidden).toBe(false);
    expect((k.querySelector(".aleta-c2-saksi-tinjau") as HTMLElement).hidden).toBe(false);
    expect((k.querySelector(".aleta-c2-saksi-blangko") as HTMLElement).hidden).toBe(false);
    (k.querySelector(".aleta-c2-saksi-isi") as HTMLButtonElement).click();
    await sampai(() => /belum terbuka/.test(k.querySelector(".aleta-c2-saksi-status")!.textContent || ""), "petunjuk");
    expect(h.kejadian).toEqual([]);
  });

  it("zona seret-lepas BESAR (bukan 'Choose File'); PDF diterima dan dikirim APA ADANYA; seret-lepas langsung membaca", async () => {
    const h = bukaSaksi({ blangko: "tidak" });
    const k = await sampai(() => (typeof h.w.saksiscanBuka === "function" ? (h.w.saksiscanBuka() as HTMLElement) : null), "kartu");
    const zona = k.querySelector(".aleta-c2-saksi-zona") as HTMLElement;
    expect(zona).not.toBeNull();
    expect(zona.textContent).toMatch(/Seret foto\/PDF KTP ke sini atau klik untuk memilih/);
    const masukan = k.querySelector(".aleta-c2-saksi-berkas") as HTMLInputElement;
    expect(zona.contains(masukan)).toBe(true);
    expect(masukan.accept).toMatch(/application\/pdf/);
    const dragover = new h.w.Event("dragover", { cancelable: true });
    zona.dispatchEvent(dragover);
    expect(zona.getAttribute("data-sorot")).toBe("ya");
    const pdf = new h.w.File([new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj"))], "ktp.pdf", { type: "application/pdf" });
    const lepas = new h.w.Event("drop", { cancelable: true });
    Object.defineProperty(lepas, "dataTransfer", { value: { files: [pdf] } });
    zona.dispatchEvent(lepas);
    expect(zona.hasAttribute("data-sorot")).toBe(false);
    await sampai(() => h.minta.some((m) => m.cara === "POST"), "terkirim");
    const badan = JSON.parse(h.minta.find((m) => m.cara === "POST")!.badan);
    expect(badan.gambar).toMatch(/^data:application\/pdf;base64,/);
    expect(Buffer.from(badan.gambar.split(",")[1], "base64").toString("latin1")).toBe("%PDF-1.4\n1 0 obj");
  });

  it("galat rute { error: { message } } tampil sebagai kalimat, bukan '[object Object]'", async () => {
    const h = bukaSaksi({
      blangko: "tidak",
      jawabScan: () => ({ status: 413, isi: { ok: false, error: { message: "Berkas terlalu besar. Kecilkan fotonya (paling besar 6 MB).", details: null } } }),
    });
    const k = await sampai(() => (typeof h.w.saksiscanBuka === "function" ? (h.w.saksiscanBuka() as HTMLElement) : null), "kartu");
    (k.querySelector(".aleta-c2-saksi-teks") as HTMLTextAreaElement).value = "NIK : 1";
    (k.querySelector(".aleta-c2-saksi-baca") as HTMLButtonElement).click();
    const status = k.querySelector(".aleta-c2-saksi-status") as HTMLElement;
    await sampai(() => /terlalu besar|object/i.test(status.textContent || ""), "pesan");
    expect(status.textContent).toBe("Berkas terlalu besar. Kecilkan fotonya (paling besar 6 MB).");
  });

  it("tema kartu mengikuti panel ALETA (UI Baru: terang/gelap); CSS kartu memakai token --aleta-* kulit modern", async () => {
    const h = bukaSaksi({ blangko: "tidak" });
    const panel = h.d.createElement("div");
    panel.id = "aleta-panel-sipp";
    panel.setAttribute("data-tema", "terang");
    h.d.body.appendChild(panel);
    const k = await sampai(() => (typeof h.w.saksiscanBuka === "function" ? (h.w.saksiscanBuka() as HTMLElement) : null), "kartu");
    expect(k.getAttribute("data-tema")).toBe("terang");
    panel.removeAttribute("data-tema");
    h.w.saksiscanBuka();
    expect(k.getAttribute("data-tema")).toBe("gelap");
    const aturan = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(aturan).toMatch(/html\[data-aleta-kulit="modern"\] \.aleta-c2-saksi-pemicu \{\s*--c2-latar: var\(--aleta-latar\)/);
    expect(aturan).toMatch(/html\[data-aleta-kulit="modern"\] \.aleta-c2-saksi\[data-tema="terang"\] \{[^}]*--aleta-latar: #ffffff !important/);
  });
});

// ============================================================================
// P. konten.js: tab PTSP, sembul SIPP, rapikan identitas para pihak
// ============================================================================
const NOMOR = "556/Pdt.G/2026/PA.Dgl";
const ALAMAT_P = "Desa Alindau, RT 006 RW 006, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah. Domisili elektronik : iraazra67@gmail.com, Alindau, Sindue Tobata, Kabupaten Donggala, Sulawesi Tengah";
const ALAMAT_T = "Desa Oti (rumah depan kantor Desa Oti), Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah, Oti, Sindue Tobata, Kabupaten Donggala, Sulawesi Tengah";
const TABEL_PIHAK = `
<table class="table_pihak1"><tbody><tr><td>No</td><td>Nama</td><td>Alamat</td><td></td></tr>
<tr><td>1</td><td>IRA AZRA</td><td>${ALAMAT_P}</td><td><a href="#" onclick="popup_form('/SIPP/add_pihak_pertama/E/edit/P1/urt/1/Q')">[Edit]</a></td></tr></tbody></table>
<table class="table_pihak2"><tbody><tr><td>No</td><td>Nama</td><td>Alamat</td><td></td></tr>
<tr><td>1</td><td>ANDI</td><td>${ALAMAT_T}</td><td><a href="#" onclick="popup_form('/SIPP/add_pihak_kedua/E/edit/P2/urt/1/Q')">[Edit]</a></td></tr></tbody></table>`;

type OpsiP = {
  simpanan?: Record<string, unknown>;
  peran?: string;
  html?: string;
  lebar?: number;
  /** Jawaban tambahan untuk fetch (undefined = jawaban bawaan). */
  jawab?: (url: string, cara: string, badan: unknown) => unknown;
  /** Dijalankan sesudah skrip dimuat (memasang perilaku SIPP tiruan). */
  sesudah?: (w: any) => void;
};

function bukaPanel(p: OpsiP = {}) {
  const peran = p.peran ?? "Super Admin";
  const dom = new JSDOM(`<!doctype html><html><head></head><body><div id="konten"><h3>Nomor Perkara ${NOMOR}</h3>${p.html || ""}</div></body></html>`, {
    url: `${ASAL}/SIPP/detil_perkara_agama`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  Object.defineProperty(w, "innerWidth", { configurable: true, value: p.lebar ?? 1600 });
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return this.textContent;
    },
  });
  w.TextDecoder = globalThis.TextDecoder;
  w.Response = globalThis.Response;
  // 21 Okt 2026: panel bawaannya lencana; uji isi/letak panel memakai panel yang disetel TERBUKA (pilihan sesudah keputusan itu).
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? { ujiTampilan: "ui", ujiIzinkanNyata: true, panelBawaanTampil: { aleta: true, sipp: true, abt: true, diubahPada: "2026-10-22T00:00:00.000Z" } });
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.184.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (k?: string | string[] | null) => {
          const daftar = k == null ? Object.keys(simpanan) : [k].flat();
          return Object.fromEntries(daftar.filter((x) => x in simpanan).map((x) => [x, polos(simpanan[x])]));
        },
        set: async (isi: Record<string, unknown>) => Object.assign(simpanan, polos(isi)),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const minta: Array<{ url: string; cara: string; badan: unknown }> = [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    const cara = String((opsi && opsi.method) || "GET").toUpperCase();
    minta.push({ url, cara, badan: opsi && opsi.body });
    let status = 200;
    let isi: unknown = { ok: true, data: {} };
    if (url.includes("/api/aleta-ecourt/ekstensi/tampilan") || url.includes("/penetapan-edoc/")) {
      status = 404;
      isi = {};
    } else if (url.includes("/aleta-ecourt/ekstensi/siapa")) {
      isi = { ok: true, data: { nama: "Penguji", peran, kapabilitas: null } };
    } else if (url.includes("/aleta-bot/sipp-konteks?")) {
      isi = {
        ok: true,
        data: {
          available: true,
          konteks: {
            ok: true,
            nomorPerkara: NOMOR,
            nomorRegister: "",
            identitas: { ditemukan: true, jenisPerkara: "Cerai Gugat", adaKumulasi: false, kumulasi: [], adaKuasa: false },
            ringkasan: { dokumen: 0 },
            dokumen: [],
            selisih: [],
            nomorPihak: [],
            diperiksaPada: new Date().toISOString(),
            ambangMendesakHari: 3,
            hakim: null,
          },
          pengguna: { nama: "Penguji", peran },
          kapabilitas: null,
        },
      };
    } else if (p.jawab && p.jawab(url, cara, opsi && opsi.body) !== undefined) {
      isi = p.jawab(url, cara, opsi && opsi.body);
    } else if (url.includes("/aleta-ecourt/wilayah")) {
      const induk = new URL(url, ASAL).searchParams.get("induk") || "";
      isi = { ok: true, data: { ok: true, sandi: { ok: true }, data: WIL[induk] || [] } };
    } else if (url.includes("/aleta-ecourt/rapikan-alamat")) {
      const daftar = (JSON.parse(String(opsi && opsi.body)) as { alamat: string[] }).alamat;
      isi = { ok: true, data: { hasil: daftar.map((x) => rapikanAlamat(x)) } };
    }
    const r: any = {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      url,
      redirected: false,
      headers: { get: () => "application/json" },
      json: async () => polos(isi),
      text: async () => JSON.stringify(isi ?? {}),
      clone: () => r,
    };
    return r;
  };
  // Jembatan tiruan: [Edit] pihak membuka blangko edit SIPP (#frm_user, Alamat readonly).
  const jembatan: Array<Record<string, unknown>> = [];
  const pmAsli = w.postMessage.bind(w);
  w.postMessage = (data: any, asal: string) => {
    if (data && data.sumber === "aleta-jembatan") {
      const { id, ...pesan } = data;
      jembatan.push(polos(pesan));
      let balas: Record<string, unknown> = { ok: true, medan: [] };
      if (pesan.jenis === "nilai") balas = { ok: true, nilai: "", tampak: true };
      if (pesan.jenis === "pilihan") balas = { ok: true, tampak: false, pilihan: [], nilaiSekarang: "" };
      if (pesan.jenis === "tekan" && /\/edit\//.test(String(pesan.penunjuk))) {
        const lama = w.document.getElementById("popup_form");
        if (lama) lama.remove();
        const div = w.document.createElement("div");
        div.id = "popup_form";
        div.className = "popup";
        div.innerHTML = '<form id="frm_user"><textarea id="alamat" readonly></textarea><input type="submit" value="Simpan"></form>';
        w.document.body.appendChild(div);
        balas = { ok: true };
      }
      else if (pesan.jenis === "tekan") {
        // Tombol/tautan lain: ditekan sungguhan - perilaku SIPP tiruan dipasang lewat p.sesudah.
        const el = w.document.querySelector(pesan.penunjuk);
        if (el) el.click();
        balas = el ? { ok: true } : { ok: false, alasan: "tombol_tidak_ketemu" };
      }
      if (pesan.jenis === "isi") {
        const el = w.document.querySelector(pesan.penunjuk);
        if (el) el.value = pesan.nilai;
        balas = { ok: Boolean(el), terbaca: el ? el.value : "" };
      }
      setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data: { sumber: "aleta-jembatan-jawab", id, ...balas }, source: w })), 0);
      return;
    }
    return pmAsli(data, asal);
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(BASMASSAL, ctx, { filename: "basmassal.js" });
  vm.runInContext(SAKSI, ctx, { filename: "saksiscan.js" });
  vm.runInContext(KONTEN(), ctx, { filename: "konten.js" });
  if (p.sesudah) p.sesudah(w);
  return { dom, w, d: w.document as Document, minta, jembatan };
}
type HalP = ReturnType<typeof bukaPanel>;
const panelDari = (h: HalP) => h.d.getElementById("aleta-panel-sipp") as any;
const siapUi = (h: HalP) =>
  sampai(() => {
    const pn = panelDari(h);
    return pn && pn.getAttribute("data-t7") === "ui" && pn.querySelector(".aleta-t7-tab") ? pn : null;
  }, "panel UI Baru", 10000);
const tabTampak = (pn: any) =>
  Array.from(pn.querySelectorAll(".aleta-t7-tab:not([data-mps-sembunyi])")).map((t: any) => t.getAttribute("data-t7-ke"));

describe("P. konten.js: tab PTSP (butir 11, 12)", () => {
  it("Super Admin: tab PTSP sesudah Penetapan; Data Umum PINDAH ke PTSP (tautan di Penetapan); kartu KTP dibuka dari tab", async () => {
    const h = bukaPanel();
    const pn = await siapUi(h);
    expect(tabTampak(pn).slice(0, 2)).toEqual(["kerjakan", "ptspKel"]);
    expect(pn.querySelector('.aleta-t7-tab[data-t7-ke="ptspKel"]').textContent).toMatch(/PTSP/);
    const ptsp = pn.querySelector('.aleta-isi > .aleta-kelompok[data-kunci="ptspKel"]');
    expect(ptsp.querySelector('.aleta-bagian[data-kunci="dataUmum"]')).not.toBeNull();
    expect(pn.querySelector('.aleta-kelompok[data-kunci="kerjakan"] .aleta-bagian[data-kunci="dataUmum"]')).toBeNull();
    const tautan = pn.querySelector('.aleta-kelompok[data-kunci="kerjakan"] .aleta-p5-tautan-ptsp button');
    tautan.click();
    expect(pn.getAttribute("data-t7-tab")).toBe("ptspKel");
    const ktp = ptsp.querySelector('.aleta-bagian[data-kunci="saksiKtp"]');
    expect(ktp.textContent).toMatch(/Data saksi \/ pihak - isi dari foto KTP/);
    ktp.querySelector(".aleta-p5-ktp-buka").click();
    const kartu = await sampai(() => h.d.querySelector(".aleta-c2-saksi:not([hidden])"), "kartu KTP terbuka");
    expect(kartu.querySelector(".aleta-c2-saksi-zona")).not.toBeNull();
    expect(pn.contains(kartu)).toBe(false);
  });

  it("Operator/PTSP (susunan lama) melihat PTSP; Hakim tidak; Lama tetap Data Umum di Penetapan tanpa PTSP", async () => {
    const op = bukaPanel({ peran: "Petugas PTSP" });
    const pnOp = await siapUi(op);
    expect(tabTampak(pnOp)).toContain("ptspKel");
    expect(pnOp.querySelector('[data-kunci="ptspKel"] [data-kunci="saksiKtp"]')).not.toBeNull();
    const hk = bukaPanel({ peran: "Hakim" });
    const pnHk = await siapUi(hk);
    await tunggu(200);
    expect(tabTampak(pnHk)).not.toContain("ptspKel");
    const lama = bukaPanel({ simpanan: { ujiTampilan: "lama" } });
    const pnL = await sampai(() => panelDari(lama) && panelDari(lama).querySelector(".aleta-kelompok") && panelDari(lama), "panel Lama", 10000);
    await tunggu(300);
    expect(pnL.querySelector('[data-kunci="ptspKel"]')).toBeNull();
    expect(pnL.querySelector('.aleta-kelompok[data-kunci="kerjakan"] .aleta-bagian[data-kunci="dataUmum"]')).not.toBeNull();
  });

  it("CSS: tab PTSP menyembunyikan kelompok lain", () => {
    expect(CSS).toContain('#aleta-panel-sipp[data-t7-tab="ptspKel"] .aleta-isi > .aleta-kelompok:not([data-kunci="ptspKel"])');
  });
});

describe("P. sembul SIPP tidak tertutup panel berlabuh (butir 15)", () => {
  it("panel berlabuh <= separuh layar: area sembul dipersempit ke kiri; > separuh: dibiarkan; kartu KTP kiri ikut dihindari", async () => {
    const h = bukaPanel();
    const pn = await siapUi(h);
    const akar = h.d.documentElement;
    await sampai(() => akar.getAttribute("data-aleta-sipp-labuh") === "kanan", "berlabuh");
    await sampai(() => akar.getAttribute("data-aleta-sembul-geser") === "ya", "sembul digeser");
    expect(akar.style.getPropertyValue("--aleta-sembul-kanan")).toBe("470px");
    // Tuas melebarkan panel melewati separuh layar -> sembul dibiarkan.
    pn.getBoundingClientRect = () => ({ width: 900, right: 1600, left: 700, top: 0, bottom: 900, height: 900 });
    h.w.t7SetelSembul();
    expect(akar.hasAttribute("data-aleta-sembul-geser")).toBe(false);
    pn.getBoundingClientRect = () => ({ width: 470, right: 1600, left: 1130, top: 0, bottom: 900, height: 900 });
    const kartu = h.w.saksiscanBuka();
    kartu.getBoundingClientRect = () => ({ width: 440, right: 452, left: 12, top: 12, bottom: 800, height: 788 });
    h.w.t7SetelSembul();
    expect(akar.getAttribute("data-aleta-sembul-geser")).toBe("ya");
    expect(akar.style.getPropertyValue("--aleta-sembul-kiri")).toBe("464px");
    expect(akar.style.getPropertyValue("--aleta-sembul-kanan")).toBe("470px");
    // Sisa di antara kartu dan panel kurang dari 640px: kartu tidak dihindari.
    pn.getBoundingClientRect = () => ({ width: 520, right: 1600, left: 1080, top: 0, bottom: 900, height: 900 });
    h.w.t7SetelSembul();
    expect(akar.style.getPropertyValue("--aleta-sembul-kiri")).toBe("0px");
    expect(akar.style.getPropertyValue("--aleta-sembul-kanan")).toBe("520px");
    pn.getBoundingClientRect = () => ({ width: 470, right: 1600, left: 1130, top: 0, bottom: 900, height: 900 });
    // Kartu ditutup -> kiri kembali nol (saksiscanTutup mengabari t7SetelSembul).
    (kartu.querySelector(".aleta-c2-saksi-tutup") as HTMLButtonElement).click();
    expect(akar.style.getPropertyValue("--aleta-sembul-kiri")).toBe("0px");
    const aturan = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(aturan).toMatch(/html\[data-aleta-sembul-geser="ya"\] :is\(\.popup, \.popup2nd, #popup-detil\) \{[^}]*width: calc\(100% - var\(--aleta-sembul-kiri, 0px\) - var\(--aleta-sembul-kanan, 0px\)\) !important/);
  });

  it("layar sempit (< 900px, panel mengambang): tidak ada yang digeser", async () => {
    const h = bukaPanel({ lebar: 800 });
    await siapUi(h);
    await tunggu(300);
    expect(h.d.documentElement.hasAttribute("data-aleta-sembul-geser")).toBe(false);
  });
});

describe("P. rapikan identitas para pihak (butir 26)", () => {
  it("alamat sekarang vs usulan; tulis = [Edit] pihak SIPP lalu kolom Alamat diisi; Simpan TIDAK ditekan", async () => {
    const h = bukaPanel({ html: TABEL_PIHAK });
    const pn = await siapUi(h);
    const bagian = await sampai(() => pn.querySelector('.aleta-bagian[data-kunci="rapikanPihak"]'), "bagian rapikan");
    const tombolBaca = Array.from(bagian.querySelectorAll("button")).find((b: any) => /Baca alamat/.test(b.textContent)) as HTMLButtonElement;
    tombolBaca.click();
    await sampai(() => bagian.querySelectorAll(".aleta-p5-usulan").length === 2, "usulan");
    const usulan = Array.from(bagian.querySelectorAll(".aleta-p5-usulan")).map((x: any) => x.textContent);
    expect(usulan).toEqual([
      "Usulan: Desa Alindau, RT 006 RW 006, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah. Domisili elektronik : iraazra67@gmail.com",
      "Usulan: Desa Oti, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah",
    ]);
    const tulis = bagian.querySelector(".aleta-p5-tulis") as HTMLButtonElement;
    expect(tulis.disabled).toBe(false);
    tulis.click();
    await sampai(() => /BELUM TERSIMPAN/.test(bagian.textContent || ""), "terisi");
    expect((h.d.querySelector("form#frm_user #alamat") as HTMLTextAreaElement).value).toBe(
      "Desa Alindau, RT 006 RW 006, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah. Domisili elektronik : iraazra67@gmail.com"
    );
    const tekan = h.jembatan.filter((j) => j.jenis === "tekan").map((j) => String(j.penunjuk));
    expect(tekan).toEqual(['table.table_pihak1 > tbody > tr:nth-child(2) a[onclick*="/edit/"]']);
    expect(h.minta.some((m) => m.url.includes("/rapikan-alamat") && m.cara === "POST")).toBe(true);
    // Alamat orang tidak lewat alamat URL.
    expect(h.minta.some((m) => /Alindau/.test(m.url))).toBe(false);
  });
});

// ============================================================================
// P. para pihak dari berkas gugatan -> blangko pihak SIPP (butir 28)
// ============================================================================
const TEKS_GUGATAN = [
  "Yang bertanda tangan di bawah ini:",
  "SITI AMINAH binti LA ODE, NIK 7203094505900001, tempat dan tanggal lahir Donggala, 5 Mei 1990, agama Islam, pendidikan SLTP, pekerjaan Ibu Rumah Tangga, tempat kediaman di Desa Alindau (rumah depan masjid), RT 006 RW 006, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah, domisili elektronik iraazra67@gmail.com, sebagai Penggugat;",
  "melawan",
  "ANDI SAPUTRA bin MUHAMMAD, umur 34 tahun, agama Islam, pendidikan SLTA, pekerjaan Petani, tempat kediaman di Desa Oti, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah, sebagai Tergugat;",
  "Adapun alasan-alasan gugatan Penggugat adalah sebagai berikut:",
].join("\n");

const LAYAR_DATA_UMUM = `
<a href="#" id="tambah_p1" onclick="popup_form('/SIPP/add_pihak_pertama/E/add')">Tambah Penggugat</a>
<a href="#" id="tambah_p2" onclick="popup_form('/SIPP/add_pihak_kedua/E/add')">Tambah Tergugat</a>
<div id="popup_form_2nd" class="popup" style="display:none">
  <div id="popup_pihak_list"><input type="button" id="addPihak" value="Tambah">
    <table id="tablePerkaraAll"><tbody><tr><td></td><td></td><td>No</td><td>Nama</td><td>Alamat</td><td>TTL</td><td>JK</td><td>Pek</td></tr></tbody></table>
  </div>${BLANGKO_REF}
</div>`;

/** Perilaku SIPP tiruan: Tambah Penggugat -> blangko #frm_user; Cari -> daftar; Tambah -> #frm_ref_pihak. */
function pasangSippPihak(w: any, kejadian: string[]) {
  const d = w.document as Document;
  const tampil = (id: string, ya: boolean) => ((d.getElementById(id) as HTMLElement).style.display = ya ? "block" : "none");
  for (const id of ["tambah_p1", "tambah_p2"]) {
    d.getElementById(id)!.addEventListener("click", () => {
      kejadian.push(id);
      const div = d.createElement("div");
      div.id = "popup_form";
      div.className = "popup";
      div.style.display = "block";
      div.innerHTML = '<form id="frm_user"><input type="text" id="fullname" readonly><input type="button" id="cari_saksi" value="Cari"><input type="submit" id="simpan_saksi" value="Simpan"></form>';
      d.body.appendChild(div);
      d.getElementById("cari_saksi")!.addEventListener("click", () => {
        kejadian.push("cari");
        tampil("popup_form", false);
        tampil("popup_form_2nd", true);
      });
    });
  }
  d.getElementById("addPihak")!.addEventListener("click", () => {
    kejadian.push("tambah");
    tampil("popup_pihak_list", false);
    tampil("popup_pihak", true);
  });
  d.getElementById("simpan_btn")!.addEventListener("click", () => kejadian.push("simpan"));
}

describe("P. para pihak dari berkas gugatan -> Tambah Referensi Data Pihak SIPP (butir 28)", () => {
  it("pratinjau per pihak (terbaca vs kosong); 'Isi pihak ke SIPP' = Tambah Penggugat -> Cari -> Tambah -> blangko terisi; Simpan TIDAK ditekan", async () => {
    const kejadian: string[] = [];
    const h = bukaPanel({
      html: LAYAR_DATA_UMUM,
      jawab: (url, cara) =>
        url.includes("/penunjukan/berkas") && cara === "POST"
          ? { ok: true, data: { ok: true, nama: "gugatan.docx", jenis: "docx", panjangTeks: TEKS_GUGATAN.length, petikan: petikDataUmum(TEKS_GUGATAN) } }
          : undefined,
      sesudah: (w) => pasangSippPihak(w, kejadian),
    });
    const pn = await siapUi(h);
    const masukan = await sampai(() => pn.querySelector('[data-kunci="ptspKel"] .aleta-bagian[data-kunci="dataUmum"] input[type=file]'), "pemilih berkas gugatan");
    Object.defineProperty(masukan, "files", { configurable: true, value: [new h.w.File(["x"], "gugatan.docx")] });
    masukan.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    const kartuPihak = await sampai(() => {
      const k = pn.querySelectorAll(".aleta-p5-pg");
      return k.length === 2 ? Array.from(k) : null;
    }, "pratinjau dua pihak");
    expect((kartuPihak[0] as HTMLElement).textContent).toMatch(/Penggugat: SITI AMINAH binti LA ODE/);
    expect((kartuPihak[0] as HTMLElement).textContent).toMatch(/Domisili elektronikiraazra67@gmail.com/);
    expect((kartuPihak[1] as HTMLElement).textContent).toMatch(/Kosong \(isi sendiri di blangko\): NIK/);

    ((kartuPihak[0] as HTMLElement).querySelector(".aleta-p5-isi-pihak") as HTMLButtonElement).click();
    const kartu = await sampai(() => h.d.querySelector(".aleta-c2-saksi:not([hidden])") as HTMLElement, "kartu");
    await sampai(() => /BELUM TERSIMPAN/.test(kartu.querySelector(".aleta-c2-saksi-status")!.textContent || ""), "terisi", 20000);
    expect(kejadian).toEqual(["tambah_p1", "cari", "tambah"]);
    const v = (id: string) => (h.d.getElementById(id) as HTMLInputElement).value;
    expect({
      nama: v("pihak_fullname"),
      nik: v("pihak_no_identitas"),
      tl: v("pihak_tempat_lahir"),
      tgl: v("pihak_tgl_lahir"),
      alamat: v("pihak_alamat"),
      email: v("pihak_email"),
      pendidikan: v("pihak_pendidikan"),
      wilayah: [v("prop"), v("kab"), v("kec"), v("kel")],
    }).toEqual({
      nama: "SITI AMINAH binti LA ODE",
      nik: "7203094505900001",
      tl: "Donggala",
      tgl: "05/05/1990",
      alamat: "Desa Alindau, RT 006 RW 006, Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah",
      email: "iraazra67@gmail.com",
      pendidikan: "3",
      wilayah: ["NS72", "NS7203", "NS720312", "NS4"],
    });
    expect(kejadian).not.toContain("simpan");
    expect(h.d.getElementById("frm_ref_pihak")!.outerHTML).not.toMatch(/aleta/i);
  });
});

// ============================================================================
describe("P. blok 5 Okt: jalur tulis SIPP yang ada saja, tanpa Simpan", () => {
  const konten = KONTEN();
  const awal = konten.indexOf("PERBAIKAN 5 OKTOBER 2026 - TAB PTSP");
  const blok = awal >= 0 ? konten.slice(awal) : "";

  it("non-GET hanya POST rapikan-alamat (menghitung); pesan jembatan hanya [Edit]/Tambah pihak (tekan) dan isi Alamat; tanpa postMessage sendiri", () => {
    expect(blok.length).toBeGreaterThan(3000);
    expect(blok.match(/method:\s*"[A-Z]+"/g) || []).toEqual(['method: "POST"']);
    expect(blok).toContain('const P5_API_RAPIKAN = "/aleta/api/aleta-ecourt/rapikan-alamat";');
    expect(blok).not.toMatch(/postMessage\(/);
    const pesan = blok.match(/kirimKeJembatan(?:Langsung)?\(\{[^}]*\}/g) || [];
    expect(pesan.length).toBe(3);
    for (const p of pesan) expect(p).toMatch(/jenis: "tekan", penunjuk(?:: pihak\.penunjukEdit)? \}|jenis: "isi", penunjuk: "form#frm_user #alamat"/);
    // Simpan SIPP tidak pernah disebut sebagai penunjuk.
    expect(blok).not.toMatch(/penunjuk:\s*"[^"]*(?:simpan|submit|btn)/i);
  });

  it("mode coba: rapikan-alamat lolos (hanya menghitung) di ALETA_COBA_BOLEH", () => {
    expect(ALAT).toContain("/\\/aleta\\/api\\/aleta-ecourt\\/rapikan-alamat(?:[?#]|$)/");
  });
});
