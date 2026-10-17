// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * AUDIT 17 OKT - PEMILIH BERKAS ALETA DAN UNGGAH e-Doc SIPP 7.0.4
 * ============================================================================
 *
 * SubmitHandling SIPP 7.0.4 (resources/js/jquery-sipp-2.js, dimuat
 * views/header.php) dengan upload:1 memeriksa SELURUH $(":file") di halaman,
 * bukan pemilih borangnya: pemilih panel ALETA yang berisi berkas .txt
 * (Data Umum dari berkas gugatan menerima .txt) membuat unggahan e-Doc SIPP
 * ditolak "File Format E-Document Tidak Diizinkan". Jalur galatnya memakai
 * $(":file")[0] - pemilih pertama di halaman.
 *
 *   1. SIPP sungguhan (jQuery 1.8.2 + jquery-sipp-2.js dari D:\Aplikasi\SIPP,
 *      dilewati bila salinannya tidak ada): tanpa penjagaan ditolak; dengan
 *      penjagaan panel-alat.js berkas PDF SIPP terunggah, pemilih ALETA kembali
 *      utuh berikut berkasnya.
 *   2. Penjagaan tanpa SIPP: dilepas selama Simpan, dipasang lagi saat batal.
 */

const AKAR = path.resolve(__dirname, "../../..");
const SIPP = "D:/Aplikasi/SIPP/resources/js";
const ADA_SIPP = existsSync(path.join(SIPP, "jquery-sipp-2.js")) && existsSync(path.join(SIPP, "jquery-1.8.2.min.js"));
const ALAT = readFileSync(path.join(AKAR, "ekstensi-sipp/panel-alat.js"), "utf8");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
type Jendela = any;

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

/** Halaman perkara SIPP: panel ALETA (pemilih berkas berisi .txt) lebih dulu, lalu jendela e-Doc SIPP. */
const HALAMAN = `<!doctype html><html><head></head><body>
<div id="aleta-panel-sipp" class="aleta-panel"><div class="aleta-bagian" data-kunci="dataUmum"><div class="aleta-tetap-kaki"><input type="file" class="aleta-berkas" id="pemilih-aleta" accept=".docx,.doc,.rtf,.pdf,.txt"></div></div></div>
<div id="popup_form" class="popup"><div id="form_pop">
<form id="frm_upload_file" method="post" action="http://127.0.0.1:8056/index.php/fileupload_c/dummy" enctype="multipart/form-data">
<table><tr><td>File Tersimpan</td><td>Dokumen Belum Ada</td></tr>
<tr><td>Upload File</td><td><input type="file" name="fileform" id="fileform"></td></tr>
<tr><td><input type="hidden" name="enc" value="x"><input type="hidden" name="from" value="dokpmh"><input type="submit" id="simpan" value="Simpan"></td></tr></table>
</form></div></div></body></html>`;

function isiBerkas(w: Jendela, el: HTMLInputElement, nama: string, jenis: string) {
  const f = new w.File(["x"], nama, { type: jenis });
  Object.defineProperty(el, "files", { configurable: true, get: () => [f] });
  Object.defineProperty(el, "value", { configurable: true, get: () => `C:\\fakepath\\${nama}`, set: () => undefined });
}

function bukaSipp(jaga: boolean, o: { jalurGalat?: boolean; aletaKosong?: boolean } = {}) {
  const dom = new JSDOM(HALAMAN, { url: "http://127.0.0.1:8056/index.php/perkara_detil_agama/x", runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as Jendela;
  const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(readFileSync(path.join(SIPP, "jquery-1.8.2.min.js"), "latin1"), ctx);
  vm.runInContext("function openLoadingDialog(){}", ctx);
  vm.runInContext(readFileSync(path.join(SIPP, "jquery-sipp-2.js"), "latin1"), ctx);
  if (jaga) {
    vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
    vm.runInContext("alatJagaPemilihBerkasSipp(document);", ctx);
  }
  w.confirm = () => true;
  const panggilan: Array<{ url: string; data: unknown }> = [];
  const galat: string[] = [];
  w.message_error_show = (t: string) => galat.push(String(t));
  w.jQuery.ajax = (a: { url: string; data: unknown; success: (j: unknown) => void; error?: (x: unknown) => void }) => {
    panggilan.push({ url: a.url, data: a.data });
    const pertama = panggilan.length === 1;
    // Jalur galat SIPP: jawaban HTTP gagal yang badannya tetap { st:1 } (mis. peringatan PHP).
    if (pertama && o.jalurGalat && a.error) setTimeout(() => a.error!({ responseText: JSON.stringify({ st: 1, msg: "Data tersimpan" }) }), 15);
    else setTimeout(() => a.success({ st: 1, msg: pertama ? "Data tersimpan" : "Berkas terunggah" }), 15);
  };
  // fileupload_v.php: SubmitHandling borang e-Doc SIPP apa adanya.
  vm.runInContext(
    `$('#frm_upload_file').SubmitHandling({refresh:'1',setRefresh:1,divRef:'#konten',clicked:1,btnClicked:'.close_form',whenStatus:1,upload:1,urlUpload:"http://127.0.0.1:8056/index.php/fileupload_c/validatePost"});`,
    ctx
  );
  if (!o.aletaKosong) isiBerkas(w, w.document.getElementById("pemilih-aleta"), "gugatan.txt", "text/plain");
  isiBerkas(w, w.document.getElementById("fileform"), "PMH.pdf", "application/pdf");
  return { w, d: w.document as Document, panggilan, galat };
}

describe("1. SubmitHandling SIPP 7.0.4 sungguhan", () => {
  const UNGGAH = "http://127.0.0.1:8056/index.php/fileupload_c/validatePost";

  it.skipIf(!ADA_SIPP)("TANPA penjagaan: pemilih panel ALETA berisi .txt -> SIPP menampilkan 'Tidak Diizinkan' untuk PDF yang sah (bukti bug)", async () => {
    const h = bukaSipp(false);
    (h.d.getElementById("simpan") as HTMLInputElement).click();
    await tunggu(120);
    expect(h.galat.join(" ")).toMatch(/Tidak Diizinkan/);
  });

  it.skipIf(!ADA_SIPP)("TANPA penjagaan, jalur galat: pemilih panel ALETA (kosong) yang pertama di halaman -> PDF SIPP tidak diunggah (bukti bug)", async () => {
    const h = bukaSipp(false, { jalurGalat: true, aletaKosong: true });
    (h.d.getElementById("simpan") as HTMLInputElement).click();
    await tunggu(120);
    expect(h.panggilan.map((p) => p.url)).not.toContain(UNGGAH);
  });

  it.skipIf(!ADA_SIPP)("DENGAN penjagaan, jalur galat: PDF SIPP diunggah", async () => {
    const h = bukaSipp(true, { jalurGalat: true, aletaKosong: true });
    (h.d.getElementById("simpan") as HTMLInputElement).click();
    await tunggu(150);
    expect(h.panggilan.map((p) => p.url)).toContain(UNGGAH);
    expect(h.d.getElementById("pemilih-aleta")).not.toBeNull();
  });

  it.skipIf(!ADA_SIPP)("DENGAN penjagaan: PDF SIPP terunggah, pemilih ALETA kembali di tempatnya berikut berkasnya", async () => {
    const h = bukaSipp(true);
    const aleta = h.d.getElementById("pemilih-aleta") as HTMLInputElement;
    const induk = aleta.parentNode;
    (h.d.getElementById("simpan") as HTMLInputElement).click();
    // Selama SIPP bekerja pemilih ALETA tidak ada di dokumen.
    expect(h.d.getElementById("pemilih-aleta")).toBeNull();
    await tunggu(150);
    expect(h.galat).toEqual([]);
    expect(h.panggilan.map((p) => p.url)).toEqual([
      "http://127.0.0.1:8056/index.php/fileupload_c/dummy",
      "http://127.0.0.1:8056/index.php/fileupload_c/validatePost",
    ]);
    expect(h.d.getElementById("pemilih-aleta")).toBe(aleta);
    expect(aleta.parentNode).toBe(induk);
    expect(aleta.files![0].name).toBe("gugatan.txt");
  });
});

describe("2. penjagaan tanpa SIPP", () => {
  function buka() {
    const dom = new JSDOM(HALAMAN, { url: "http://192.168.10.10/SIPP/perkara_detil_agama/x", runScripts: "outside-only" });
    terbuka.push(dom);
    const w = dom.window as Jendela;
    const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
    vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
    const api = vm.runInContext("alatJagaPemilihBerkasSipp(document)", ctx);
    return { w, d: w.document as Document, api };
  }

  it("Simpan dibatalkan (tidak ada jendela pesan SIPP): pemilih ALETA dipasang lagi seketika", async () => {
    const h = buka();
    h.d.getElementById("frm_upload_file")!.addEventListener("submit", (e: Event) => e.preventDefault());
    (h.d.getElementById("simpan") as HTMLInputElement).click();
    expect(h.d.getElementById("pemilih-aleta")).toBeNull();
    await tunggu(10);
    expect(h.d.getElementById("pemilih-aleta")).not.toBeNull();
  });

  it("borang tanpa pemilih berkas SIPP dan borang ALETA tidak disentuh", async () => {
    const h = buka();
    const f = h.d.createElement("form");
    f.id = "frm_putusan";
    f.innerHTML = '<input name="tgl_putusan"><input type="submit" id="s2">';
    f.addEventListener("submit", (e: Event) => e.preventDefault());
    h.d.body.appendChild(f);
    (h.d.getElementById("s2") as HTMLInputElement).click();
    expect(h.d.getElementById("pemilih-aleta")).not.toBeNull();
    expect(h.api.tertahan()).toEqual([]);
  });

  it("jendela pesan SIPP: dipasang lagi begitu pesan SIPP terisi", async () => {
    const h = buka();
    h.d.getElementById("frm_upload_file")!.addEventListener("submit", (e: Event) => {
      e.preventDefault();
      h.d.body.insertAdjacentHTML("beforeend", '<div id="popup_msg"><div id="pesan-container"></div></div>');
    });
    (h.d.getElementById("simpan") as HTMLInputElement).click();
    await tunggu(20);
    expect(h.d.getElementById("pemilih-aleta")).toBeNull();
    h.d.getElementById("pesan-container")!.textContent = "Data Berhasil Disimpan";
    await tunggu(20);
    expect(h.d.getElementById("pemilih-aleta")).not.toBeNull();
  });
});
