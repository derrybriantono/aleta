// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * REKAM SUSUNAN HALAMAN SIPP (Tahap K, 16 Okt 2026)
 * ============================================================================
 *
 * Alat Super Admin di laci perkakas: merekam BENTUK halaman SIPP (tag, id,
 * kelas, name, label) untuk dicek di kantor, TANPA nilai isian, nama pihak,
 * NIK, atau data pribadi lain.
 *
 * Yang dijaga, menurut pentingnya:
 *   1. Tidak ada nilai isian, teks pilihan select, isi sel data, maupun angka
 *      panjang (NIK/HP) yang ikut ke JSON - diuji dengan memasukkan data
 *      tiruan yang mencolok ke halaman lalu mencarinya di seluruh rekaman.
 *   2. Kerangka yang dibutuhkan Tahap L-M ikut: form#frm_putusan, name kolom,
 *      id tombol Simpan, label baris td#first-child, jendela popup_form.
 *   3. Panel ALETA sendiri tidak terekam; kolom SIPP yang hanya dihias kelas
 *      aleta-* tetap terekam.
 *   4. Alamat bersandi dan angka di alamat disamarkan.
 *   5. Tombolnya hanya ada di laci perkakas Super Admin.
 *
 * panel-alat.js dijalankan SUNGGUHAN di jsdom.
 */

const EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");
const SUMBER_ALAT = (process.env.ALETA_UJI_ALAT ? readFileSync(process.env.ALETA_UJI_ALAT, "utf8") : readFileSync(path.join(EKSTENSI, "panel-alat.js"), "utf8")).replace(/\r\n/g, "\n");

const NIK = "7203014505900001";
const NAMA_PIHAK = "Siti Rahmawati binti Lamaruddin";
const NAMA_HAKIM = "Drs. Hakim Contoh, M.H.";
const HP = "081234567890";
const ENC = "aWQ9MTAxMTcmbm9tb3I9NTY1X1BkdC5HXzIwMjY";

// Potongan bentuk SIPP 7.0.4: halaman detil + jendela Putusan Akhir (edit_putusan_akhir.php).
const HALAMAN = `<!doctype html><html><head><title>SIPP - Detil Perkara 565/Pdt.G/2026/PA.Dgl</title></head><body>
<table width="100%" id="submenus"><tr>
  <td id="backlist"><a class="btn btn-default btn-sm" href="/index.php/perkara"><i class="fa fa-reply-all"></i> Kembali</a></td>
  <td><a href="#" onClick="popup_form('http://127.0.0.1:8056/index.php/add_majelis/${ENC}')" class="btn btn-default btn-sm">Penetapan Majelis Hakim</a></td>
</tr></table>
<ul class="tabs"><li class="tab"><a href="#tabs1" id="tabInfo" class="selected">Data Umum</a></li><li class="tab"><a class="tabs10" href="#tabs10" id="tabInfo">Putusan</a></li></ul>
<table id="infoPerkara"><tr><td id="first-child">Nama Penggugat</td><td>${NAMA_PIHAK}</td></tr><tr><td id="first-child">NIK</td><td>${NIK}</td></tr><tr><td id="first-child">Telepon</td><td>${HP}</td></tr></table>
<div id="popup_form" class="popup"><div id="form_pop">
  <form id="frm_putusan" method="post" action="http://127.0.0.1:8056/index.php/managePutusanAkhir/save/${ENC}">
    <table id="tableinfo">
      <tr><td id="first-child">Tanggal Putusan</td><td><input type="text" name="tgl_putusan" id="tgl_putusan" value="16/10/2026"></td></tr>
      <tr><td id="first-child">Status Putusan</td><td><select name="status_putusan" class="custom-dropdown__select aleta-terisi"><option value="62">Dikabulkan ${NAMA_PIHAK}</option><option value="-1">Pilih</option></select></td></tr>
      <tr><td id="first-child">Ketua Majelis</td><td><select name="hakim_id"><option value="9">${NAMA_HAKIM}</option></select></td></tr>
      <tr><td id="first-child">Keterangan</td><td><textarea name="keterangan">${NAMA_PIHAK} hadir, NIK ${NIK}</textarea></td></tr>
      <tr><td><input type="hidden" name="enc" value="${ENC}"><input type="button" id="simpan" value="Simpan"><input type="button" id="close_form_putusan" value="Kembali"></td></tr>
    </table>
  </form>
</div></div>
<div class="aleta-panel"><button class="aleta-perkakas-aksi">Rekam & unduh JSON</button><input name="aleta_rahasia" value="${NAMA_PIHAK}"></div>
<script>function refreshDataPutusan(){ $.ajax({ url: 'http://127.0.0.1:8056/index.php/managePutusanAkhir/refresh/${ENC}' }); } $('#tabs10').load('http://127.0.0.1:8056/index.php/add_info_putusan_akhir/${ENC}');</script>
<div class="footer">SIPP Versi 7.0.4</div>
</body></html>`;

const terbuka: JSDOM[] = [];
afterEach(async () => {
  // panel-alat.js memulai bacaan latar (tampilan server) saat dimuat; tunggu sebelum menutup.
  await new Promise((r) => setTimeout(r, 80));
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(html = HALAMAN) {
  const dom = new JSDOM(html, {
    url: "http://127.0.0.1:8056/index.php/perkara_detil_agama/" + ENC,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  w.chrome = {
    runtime: { getManifest: () => ({ version: "1.200.2" }) },
    storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener() {} } },
  };
  w.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
  const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
  return w;
}

describe("rekam susunan halaman SIPP - tanpa data pribadi", () => {
  it("nilai isian, teks pilihan, isi sel data, NIK, HP, dan nama tidak ikut", () => {
    const w = buka();
    const rekaman = w.alatRekamSusunan(w.document, {});
    const json = JSON.stringify(rekaman);
    for (const rahasia of [NIK, NAMA_PIHAK, "Siti", "Lamaruddin", NAMA_HAKIM, "Hakim Contoh", HP, "16/10/2026", ENC, "565/Pdt"]) {
      expect(json, `bocor: ${rahasia}`).not.toContain(rahasia);
    }
    // tidak ada kunci "value"/"nilai" sama sekali
    expect(json).not.toMatch(/"(value|nilai)"\s*:/);
  });

  it("kerangka yang dibutuhkan Tahap L-M ikut terekam", () => {
    const w = buka();
    const r = w.alatRekamSusunan(w.document, {});
    expect(r.jenis).toBe("aleta-rekam-susunan");
    expect(r.situs).toBe("sipp");
    expect(r.versiSipp).toBe("7.0.4");
    expect(r.jendelaTerbuka).toEqual(["popup_form"]);
    const form = r.elemen.find((e: any) => e.tag === "form" && e.id === "frm_putusan");
    expect(form).toBeTruthy();
    expect(form.lapisan).toBe("popup_form");
    expect(form.aksi).toBe("/index.php/managePutusanAkhir/save/<sandi>");
    expect(form.cara).toBe("post");
    const nama = r.elemen.filter((e: any) => e.name).map((e: any) => e.name);
    expect(nama).toEqual(expect.arrayContaining(["tgl_putusan", "status_putusan", "hakim_id", "keterangan", "enc"]));
    const status = r.elemen.find((e: any) => e.name === "status_putusan");
    expect(status.labelBaris).toBe("Status Putusan");
    expect(status.jumlahPilihan).toBe(2);
    expect(status.kelas).toEqual(["custom-dropdown__select"]); // hiasan aleta-* dibuang, kolomnya tetap terekam
    const simpan = r.elemen.find((e: any) => e.id === "simpan");
    expect(simpan.label).toBe("Simpan");
    const tabel = r.elemen.find((e: any) => e.tag === "table" && e.id === "tableinfo");
    expect(tabel.labelBaris).toEqual(["Tanggal Putusan", "Status Putusan", "Ketua Majelis", "Keterangan"]);
    const tombolPmh = r.elemen.find((e: any) => e.label === "Penetapan Majelis Hakim");
    expect(tombolPmh.onclick).toEqual({ fungsi: ["popup_form"], jalur: "/index.php/add_majelis/<sandi>" });
    expect(r.elemen.some((e: any) => e.tag === "a" && e.label === "Putusan" && e.href === "#tabs10")).toBe(true);
    expect(r.fungsiJs).toContain("refreshDataPutusan");
    expect(r.alamatAjax).toEqual(expect.arrayContaining(["/index.php/managePutusanAkhir/refresh/<sandi>", "/index.php/add_info_putusan_akhir/<sandi>"]));
  });

  it("panel ALETA sendiri tidak terekam", () => {
    const w = buka();
    const r = w.alatRekamSusunan(w.document, {});
    expect(r.elemen.some((e: any) => e.name === "aleta_rahasia")).toBe(false);
    expect(r.elemen.some((e: any) => e.label === "Rekam & unduh JSON")).toBe(false);
  });

  it("teks label menyamarkan angka panjang dan surel; alamat menyamarkan sandi dan angka", () => {
    const w = buka();
    expect(w.alatRekamTeks(`Perkara 565/Pdt.G/2026 NIK ${NIK} a@b.co`)).toBe("Perkara 999/Pdt.G/9999 NIK 9999 <surel>");
    expect(w.alatRekamJalur(`/index.php/perkara_detil_agama/${ENC}?x=1`)).toBe("/index.php/perkara_detil_agama/<sandi>");
    expect(w.alatRekamJalur("/index.php/arsip_detail/10117")).toBe("/index.php/arsip_detail/<angka>");
    expect(w.alatRekamNamaBerkas({ situs: "sipp", halaman: "/index.php/perkara_detil_agama/<sandi>", dibuat: "2026-10-16T19:45:00.000Z" })).toBe(
      "rekam-sipp-perkara_detil_agama-20261016-1945.json"
    );
  });

  it("unduhan berupa JSON lewat tautan sementara", () => {
    const w = buka();
    const dibuat: string[] = [];
    w.URL.createObjectURL = () => "blob:uji";
    w.URL.revokeObjectURL = () => {};
    w.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      dibuat.push(this.download);
    };
    const nama = w.alatRekamUnduh(w.alatRekamSusunan(w.document, {}));
    expect(nama).toMatch(/^rekam-sipp-perkara_detil_agama-\d{8}-\d{4}\.json$/);
    expect(dibuat).toEqual([nama]);
  });
});

describe("rekam susunan - hanya di laci perkakas Super Admin", () => {
  it("tombol rekam ada di laci perkakas, dan laci hanya untuk peran super", () => {
    const laci = SUMBER_ALAT.slice(SUMBER_ALAT.indexOf("function alatLaciPerkakas("), SUMBER_ALAT.indexOf("function alatTombolPerkakas("));
    expect(laci).toContain('kelompok("Rekam susunan halaman")');
    expect(laci).toContain("alatRekamSusunan(document");
    expect(laci).toContain("alatRekamUnduh(rekaman)");
    const tombol = SUMBER_ALAT.slice(SUMBER_ALAT.indexOf("function alatTombolPerkakas("), SUMBER_ALAT.indexOf("function alatTombolPerkakas(") + 600);
    expect(tombol).toMatch(/if \(peran !== "super" && !\/super\/i\.test\(peran\)\) return null;/);
  });

  it("perekam tidak pernah membaca .value kolom isian", () => {
    const awal = SUMBER_ALAT.indexOf("function alatRekamTeks(");
    const akhir = SUMBER_ALAT.indexOf("function alatRekamNamaBerkas(");
    const badan = SUMBER_ALAT.slice(awal, akhir);
    expect(badan).not.toMatch(/\.value\b/);
    expect(badan).not.toMatch(/\.innerHTML\b/);
  });
});
