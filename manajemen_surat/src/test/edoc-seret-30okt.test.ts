// @vitest-environment node
/**
 * ============================================================================
 * 30 OKT 2026 (MALAM) - UNGGAH e-Doc DENGAN SERET-LEPAS DI HALAMAN SIPP
 * ============================================================================
 *
 * Permintaan: semua tombol Unggah/Edit E-Doc di SIPP menerima berkas yang dilepas dan menyimpannya lewat halaman unggah SIPP sendiri;
 * klik biasa tetap membuka popup SIPP. Yang dijaga di sini:
 *
 *   1  inventaris: tiap bentuk onclick e-Doc SIPP 7.0.4 dikenali, jenis dari tombol (bukan nama berkas);
 *   2  halaman unggah SIPP dibaca (kolom tersembunyi, "File Tersimpan", batas hanya-PDF, alamat unggah);
 *   3  aturan relaas: titik isian tangan jurusita dikecualikan (kalimat dari 214 render relaas Derry), sisa #nnnn# dan [ ] tetap temuan; TS = JS;
 *   4  kesesuaian ringan: nomor perkara dan tanggal sidang BAS;
 *   5  teks PDF per paragraf (server) + aturan yang sama -> relaas benar tanpa temuan;
 *   6  perilaku ekstensi di jsdom (kode sungguhan, peristiwa seret/lepas sintetis): sorot, simpan dua langkah, ganti, temuan -> Tetap unggah / Batal,
 *      Word -> PDF (BAS bertanda tangan, jenis lain tanpa), saklar Tampilan SIPP, klik tidak disentuh, tanpa kata Aleta.
 *   Seret-lepas di peramban sungguhan: docs/rancangan/edoc-seret-30okt/simulasi.mts.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";

import * as TS from "@/lib/deteksi-sisa-blangko";
import { KATALOG_TAMPILAN_SIPP, pecahkanTampilanSipp, sembunyiUntukEkstensi } from "@/lib/tampilan-sipp";
import { bacaPdfEdoc } from "@/server/modules/aleta-ecourt/edoc-baca-pdf";

const AKAR = path.resolve(process.cwd(), "..");
const EKS = path.join(AKAR, "ekstensi-sipp");
const bacaEks = (b: string) => readFileSync(path.join(EKS, b), "utf8").replace(/\r\n/g, "\n");
const JS = createRequire(import.meta.url)(path.join(EKS, "deteksi-sisa-blangko.js")) as typeof TS;
// Fungsi murni edoc-seret.js dijalankan di jendela jsdom (kode sungguhan).
const DOM_MURNI = new JSDOM("<!doctype html><body></body>", { url: "http://192.168.10.10/SIPP/index.php/x", runScripts: "outside-only" });
(DOM_MURNI.window as any).eval(bacaEks("edoc-seret.js"));
const SERET = (DOM_MURNI.window as any).aletaEdocSeret as Record<string, any>;

// ============================================================================
// 1. Inventaris tombol e-Doc SIPP 7.0.4 (onclick asli dari views SIPP, enc diganti)
// ============================================================================
const ENC = "ZW5jLXNpbXVsYXNp";
const B = "http://192.168.10.10/SIPP/";
const TOMBOL: Array<[string, string, string, string]> = [
  // [onclick, dialog, kode, tempat]
  [`popup_form('${B}fileupload/${ENC}/bas/${ENC}1/2')`, "fileupload", "bas", "Jadwal Sidang - Unggah BAS"],
  [`popup_form('${B}fileupload/${ENC}/relaas/${ENC}1/${ENC}2')`, "fileupload", "relaas", "Pelaksanaan relaas - Upload Relaas / Edit"],
  [`popup_form('${B}fileupload_putusan/${ENC}/putusan')`, "fileupload_putusan", "putusan", "Putusan akhir - Unggah E-Doc"],
  [`popup_form('${B}fileupload_putusan/${ENC}/anonimisasi')`, "fileupload_putusan", "anonimisasi", "Putusan akhir - anonimisasi"],
  [`popup_form('${B}fileupload_putusan/${ENC}/put')`, "fileupload_putusan", "put", "Putusan akhir pengalihan acara - Edit E-Doc"],
  [`popup_form('${B}fileupload/${ENC}/dokpmh/${ENC}7')`, "fileupload", "dokpmh", "Penetapan - PMH"],
  [`popup_form('${B}fileupload/${ENC}/dokppp/${ENC}7')`, "fileupload", "dokppp", "Penetapan - PPP"],
  [`popup_form('${B}fileupload/${ENC}/dokpjs/${ENC}7')`, "fileupload", "dokpjs", "Penetapan - PJS"],
  [`popup_form('${B}fileupload/${ENC}/dokphs/${ENC}7')`, "fileupload", "dokphs", "Penetapan - PHS"],
  [`popup_form('${B}fileupload/${ENC}/datum')`, "fileupload", "datum", "Data umum - gugatan/permohonan"],
  [`popup_form('${B}fileupload/${ENC}/datumpdt')`, "fileupload", "datumpdt", "Data umum - gugatan (pdt)"],
  [`popup_form('${B}fileupload/${ENC}/datum_pb/${ENC}8/${ENC}9')`, "fileupload", "datum_pb", "Data umum - pihak (Unggah)"],
  [`popup_form('${B}fileupload/${ENC}/kppu/${ENC}8/${ENC}9')`, "fileupload", "kppu", "Kewenangan KPPU - Unggah E-Doc"],
  [`popup_form('${B}fileupload/${ENC}/putsela/${ENC}5/2')`, "fileupload", "putsela", "Putusan sela - Edit E-Dokumen"],
  [`popup_form('${B}fileupload/${ENC}/persiapan')`, "fileupload", "persiapan", "Pemeriksaan persiapan - Edit E-Doc"],
  [`popup_form('${B}fileupload/${ENC}/persiapan_proses/${ENC}3/1')`, "fileupload", "persiapan_proses", "Pemeriksaan persiapan - Unggah BAS"],
  [`popup_form('${B}fileupload/${ENC}/penetapan_persiapan')`, "fileupload", "penetapan_persiapan", "Pemeriksaan persiapan - penetapan"],
  [`popup_form('${B}fileupload/${ENC}/penetapan_dismissal_lolos')`, "fileupload", "penetapan_dismissal_lolos", "Dismissal"],
  [`popup_form('${B}fileupload/${ENC}/perbaikangugatan')`, "fileupload", "perbaikangugatan", "Perbaikan gugatan"],
  [`popup_form('${B}fileupload/${ENC}/aktarujuk')`, "fileupload", "aktarujuk", "Akta rujuk"],
  [`popup_form('${B}fileupload/${ENC}/aktacerai')`, "fileupload", "aktacerai", "Akta cerai"],
  [`popup_form('${B}fileupload/${ENC}/penikrar')`, "fileupload", "penikrar", "Ikrar talak"],
  [`popup_form('${B}fileupload/${ENC}/verzet')`, "fileupload", "verzet", "Verzet"],
  [`popup_form('${B}fileupload/${ENC}/keberatan')`, "fileupload", "keberatan", "Keberatan"],
  [`popup_form('${B}fileupload/${ENC}/kalender')`, "fileupload", "kalender", "Court calendar"],
  [`popup_form('${B}fileupload/${ENC}/tuntut')`, "fileupload", "tuntut", "Penuntutan"],
  [`popup_form('${B}fileupload/${ENC}/mkr')`, "fileupload", "mkr", "MKR"],
  [`popup_form('${B}fileupload/${ENC}/reskom')`, "fileupload", "reskom", "Reskrim"],
  [`popup_form('${B}fileupload/${ENC}/pengakuan_bersalah/')`, "fileupload", "pengakuan_bersalah", "Pengakuan bersalah"],
  [`popup_form('${B}fileupload/${ENC}/baspemtambah_20/${ENC}1/${ENC}2')`, "fileupload", "baspemtambah_20", "Banding - BAS tambahan"],
  [`popup_form('${B}fileupload/${ENC}/bapemtambah/${ENC}1/${ENC}2')`, "fileupload", "bapemtambah", "Banding - BAP tambahan"],
  [`popup_form('${B}fileupload/${ENC}/panggil_paksa')`, "fileupload", "panggil_paksa", "Panggilan paksa"],
  [`popup_form('fileupload/${ENC}/pascapailit_laporankurator/${ENC}1/2')`, "fileupload", "pascapailit_laporankurator", "Pasca pailit (alamat relatif)"],
  [`popup_form('fileupload_publisitas/${ENC}/penetapan_publisitas/${ENC}1')`, "fileupload_publisitas", "penetapan_publisitas", "Publisitas pailit"],
];

describe("1. inventaris: onclick e-Doc SIPP 7.0.4 dikenali, jenis dari tombol", () => {
  it("tiap bentuk tombol e-Doc di views SIPP dikenali beserta kode dan dialognya", () => {
    for (const [oc, dialog, kode, tempat] of TOMBOL) {
      const t = SERET.bacaTautan(oc);
      expect(t, tempat).toBeTruthy();
      expect(t.dialog, tempat).toBe(dialog);
      expect(t.kode, tempat).toBe(kode);
      expect(t.enc, tempat).toBe(ENC);
    }
    expect(TOMBOL.length).toBeGreaterThanOrEqual(30);
  });
  it("sisa ruas alamat terbawa (jadwal sidang, pihak) dan alamat relatif tetap dikenali", () => {
    expect(SERET.bacaTautan(TOMBOL[0][0]).sisa).toEqual([`${ENC}1`, "2"]);
    expect(SERET.bacaTautan(TOMBOL[11][0]).sisa).toEqual([`${ENC}8`, `${ENC}9`]);
    expect(SERET.bacaTautan(`popup_form('fileupload/${ENC}/penetapan_persiapan')`).kode).toBe("penetapan_persiapan");
  });
  it("bukan tombol e-Doc: popup lain, tanpa popup_form, alamat tanpa ruas jenis -> null", () => {
    for (const oc of [`popup_form('${B}data_relaas_panggilan/${ENC}/${ENC}1')`, `popup_form('${B}menu_data_persidangan/${ENC}/${ENC}1')`, "alert('x')", "", `popup_form('${B}fileupload/${ENC}')`]) {
      expect(SERET.bacaTautan(oc), oc).toBeNull();
    }
  });
  it("jenis ditentukan dari kode tombol; semua kode inventaris punya nama, kode asing tetap bisa (nama umum, tanpa pemeriksaan)", () => {
    expect(SERET.infoJenis("bas")).toMatchObject({ nama: "BAS", kelompok: "bas", nomor: true, tanggal: true });
    expect(SERET.infoJenis("relaas")).toMatchObject({ kelompok: "relaas", nomor: true, tanggal: false });
    expect(SERET.infoJenis("anonimisasi")).toMatchObject({ kelompok: "putusan" });
    expect(SERET.infoJenis("dokpmh")).toMatchObject({ kelompok: "umum" });
    expect(SERET.infoJenis("datum")).toMatchObject({ kelompok: "", nomor: false });
    expect(SERET.infoJenis("kode-baru-sipp")).toMatchObject({ nama: "e-Doc", kelompok: "" });
    for (const [, , kode] of TOMBOL) expect(SERET.daftarJenis(), kode).toContain(kode);
  });
});

// ============================================================================
// 2. Halaman unggah SIPP (isi popup_form) dibaca
// ============================================================================
const DIALOG_BAS = (opsi: { lama?: string; dari?: string; aksep?: boolean } = {}) => `
<div class="templatepopcentering"><form id="frm_upload_file" method="post" enctype="multipart/form-data" action="http://192.168.10.10/SIPP/fileupload_c/dummy">
<table><tr><td id="first-child" colspan="2">File Tersimpan</td></tr>
<tr><td colspan="2">${opsi.lama ? `<span style='color:#708090;font-weight:bold'>${opsi.lama}</span>` : "<span style='color:red;font-weight:bold'>Dokumen Belum Ada</span>"}</td></tr>
<tr><td colspan="2"><input type="file" name="fileform" id="fileform" ${opsi.aksep === false ? "" : 'accept=".pdf,application/pdf"'}></td></tr>
<tr><td><input type="hidden" name="enc" id="enc" value="${ENC}"><input type="hidden" name="enc1" id="enc1" value="${ENC}1"><input type="hidden" name="from" id="from" value="${opsi.dari || "bas"}"><input type="hidden" name="urutan" id="urutan" value="2">
<input type="button" id="kembali" value="Kembali"><input type="submit" id="simpan" value="Simpan"></td></tr></table></form></div>
<script type="text/javascript">
$('#simpan').hide();
$('#frm_upload_file').SubmitHandling({refresh:'1',setRefresh:1,divRef:'#konten',clicked:1,btnClicked:'.close_form',whenStatus:1,upload:1,urlUpload:"http://192.168.10.10/SIPP/fileupload_c/validatePost"});
</script>`;
const DIALOG_PUTUSAN = (lama = "") => `
<div class="templatepopcentering"><form id="frm_upload_file" method="post" enctype="multipart/form-data" action="http://192.168.10.10/SIPP/fileupload_c/dummy">
<table><tr><td>${lama ? `<span style='color:orange;'>${lama}</span>` : "<span style='color:red;font-weight:bold'>E-Doc Putusan Belum Ada</span>"}</td></tr>
<tr><td><input type="file" name="fileform" id="fileform" value=""></td></tr>
<tr><td><span class="custom-dropdown"><select id="status_publish" name="status_publish"><option value="1" selected>Publikasi</option><option value="0">Tidak Publikasi</option></select></span></td></tr>
<tr><td>Link Putusan <span style='color:red;font-weight:bold'>Putusan Tidak Ada </span></td></tr>
<tr><td><input type="hidden" name="enc" id="enc" value="${ENC}"><input type="hidden" name="form" id="form" value="putusan"><input type="submit" id="simpan" value="Simpan"></td></tr></table></form></div>
<script type="text/javascript">$('#frm_upload_file').SubmitHandling({refresh:'1',setRefresh:1,divRef:'#konten',clicked:1,btnClicked:'#close_form',whenStatus:1,upload:1,urlUpload:"http://192.168.10.10/SIPP/fileupload_putusan_c/validatePost"});</script>`;

describe("2. halaman unggah SIPP dibaca di latar", () => {
  it("BAS (fileupload_v): kolom tersembunyi, belum ada dokumen, hanya PDF, alamat unggah dan wadah segar dari skrip halaman itu sendiri", () => {
    const h = SERET.bacaHalamanUnggah(DIALOG_BAS());
    expect(h).toMatchObject({ ok: true, namaLama: "", hanyaPdf: true, urlUpload: "http://192.168.10.10/SIPP/fileupload_c/validatePost", divRef: "#konten", kode: "bas" });
    expect(Array.from(new (DOM_MURNI.window as any).FormData(h.form).keys()).sort()).toEqual(["enc", "enc1", "fileform", "from", "urutan"]);
  });
  it("dokumen sudah ada: namanya terbaca ('File Tersimpan'); putusan: pilihan publikasi bawaan SIPP ikut dalam formulir", () => {
    expect(SERET.bacaHalamanUnggah(DIALOG_BAS({ lama: "PADgl_2026_PdtG_556_bas_2_1792096162.pdf" })).namaLama).toBe("PADgl_2026_PdtG_556_bas_2_1792096162.pdf");
    const p = SERET.bacaHalamanUnggah(DIALOG_PUTUSAN("PADgl_2026_PdtG_556_put.rtf"));
    expect(p).toMatchObject({ ok: true, namaLama: "PADgl_2026_PdtG_556_put.rtf", hanyaPdf: false, urlUpload: "http://192.168.10.10/SIPP/fileupload_putusan_c/validatePost", kode: "putusan" });
    expect(new (DOM_MURNI.window as any).FormData(p.form).get("status_publish")).toBe("1");
  });
  it("jendela tanpa batas accept: bukan hanya-PDF; halaman login/rusak: ditolak dengan kalimat jelas", () => {
    expect(SERET.bacaHalamanUnggah(DIALOG_BAS({ aksep: false, dari: "datum" })).hanyaPdf).toBe(false);
    const h = SERET.bacaHalamanUnggah("<html><body><form id='login'><input name='user'></form></body></html>");
    expect(h.ok).toBe(false);
    expect(h.pesan).toMatch(/tidak terbaca/);
    expect(SERET.bacaHalamanUnggah("").ok).toBe(false);
  });
});

// ============================================================================
// 3. Aturan relaas: titik isian tangan jurusita bukan sisa blangko
// ============================================================================
const par = (teks: string, nomor = 1) => ({ teks, merah: [] as Array<[number, number]>, halaman: 1, nomor });
const hitung = (teks: string, jenis?: "relaas" | "bas" | "umum" | "putusan") => TS.periksaParagraf([par(teks)], jenis ? { jenis } : undefined).temuan.length;
const hitungJs = (teks: string, jenis?: "relaas" | "bas" | "umum" | "putusan") => JS.periksaParagraf([par(teks)], jenis ? { jenis } : undefined).temuan.length;

// Kalimat NYATA dari render relaas Derry (folder 98 Relaas; perkara 531/537/610/..., Tanty Restianty / Mustini / Mohammad Syukri).
const ISIAN_TANGAN = [
  "Pada hari ini ........ tanggal ........., Saya, Tanty Restianty sebagai Jurusita pada Pengadilan Agama Donggala atas perintah Ketua Majelis dalam perkara Nomor 610/Pdt.G/2026/PA.Dgl Tanggal 21 Agustus 2026;",
  "Pada hari ini ... tanggal ..., Saya, Mohammad Syukri, S.H. sebagai Jurusita pada Pengadilan Agama Donggala atas perintah Ketua Majelis dalam perkara Nomor 531/Pdt.G/2026/PA.Dgl",
  "Pada tanggal ....................",
  "Donggala, ......................",
  "Pemanggilan tersebut telah saya laksanakan di tempat yang bersangkutan dan di sana saya bertemu serta berbicara dengan .............................;",
  "Demikian relaas panggilan ini dibuat dan ditandatangani oleh saya serta ..........................",
  "Pelaksanaan panggilan saya laksanakan di tempat yang bersangkutan dan disana saya ..............................................",
  "Alamat Penerima tidak ditemukan berdasarkan keterangan ............................, lurah/kepala desa/perangkat kelurahan/desa ..............................",
  "Penerima meninggal dunia berdasarkan keterangan ..............., lurah/kepala desa/perangkat kelurahan/desa ...............",
  "Lurah/Kepala Desa menolak bertanda tangan karena ............................",
  "Lain-lain ...........................................................",
  "Pengantaran : Hari ................ / Tanggal ...............",
  ".......................................",
  "... Tanty Restianty",
  "... Mohammad Syukri, S.H.",
  "Nomor : ... Donggala, ........ Sifat : Segera",
  "..................\tJurusita,",
  "Yang menerima, ..........................",
];
const SISA_NYATA = [
  "Nomor : 610/Pdt.G/2026/PA.Dgl tentang Penetapan Nomor 999/Pdt.G/9999/PA.Dgl tanggal ...;", // tanggal penetapan seharusnya terisi
  "Randi Bin Pusri, NIK ..., tempat dan tanggal lahir ..., ..., umur ... tahun, agama ..., pekerjaan ...;", // data pihak kosong
  "..., sebagai Tergugat;", // nama pihak kosong
  "Hari/Tanggal : ..., Pukul : 09.00 WITA", // jadwal sidang seharusnya terisi
  "agar datang menghadap di muka sidang pada Tempat : ...",
  "Bahwa biaya panggilan sejumlah Rp...,00 (... rupiah) via wesel pos.", // biaya (Rp...) - dikecualikan oleh aturan lama hanya bila Rp mengikuti titik
  "Menunjuk ......, Mediator, sebagai Mediator dalam perkara tersebut;",
  "Pemohon #0046# datang menghadap #0015#", // kode ABT tak terganti
  "yang beralamat di [ALAMAT PENERIMA] dan [ ] hadir", // kurung siku
  "Setelah memanggil Pemohon [HURUF ALASAN A], dan [AGAMA PEMOHON]",
];

describe("3. aturan relaas: isian tangan jurusita dikecualikan, sisa blangko sungguhan tetap temuan", () => {
  it("jenis relaas: titik isian tangan (hari/tanggal pelaksanaan, siapa yang ditemui, penerima, keterangan, garis tanda tangan) BUKAN temuan", () => {
    for (const k of ISIAN_TANGAN) expect(hitung(k, "relaas"), k).toBe(0);
  });
  it("jenis lain TIDAK dikecualikan (BAS/putusan tetap menandai titik-titik) - aturan lama tidak berubah", () => {
    for (const k of ISIAN_TANGAN.slice(0, 5)) {
      expect(hitung(k, "bas"), k).toBeGreaterThan(0);
      expect(hitung(k), k).toBeGreaterThan(0);
    }
  });
  it("sisa blangko sungguhan pada relaas tetap temuan: data pihak/penetapan/jadwal kosong, #nnnn#, [ ]", () => {
    for (const k of SISA_NYATA) expect(hitung(k, "relaas"), k).toBeGreaterThan(0);
  });
  it("campuran: titik isian tangan diabaikan, sisa #nnnn# di paragraf yang sama tetap terdeteksi", () => {
    const k = "Pada hari ini ........ tanggal ........., Saya, #0180# sebagai Jurusita";
    expect(hitung(k, "relaas")).toBe(1);
    expect(TS.periksaParagraf([par(k)], { jenis: "relaas" }).temuan[0].jenis).toBe("tanda");
  });
  it("TS dan JS sepakat atas seluruh kalimat di atas, untuk relaas, umum, dan tanpa jenis", () => {
    for (const k of [...ISIAN_TANGAN, ...SISA_NYATA]) {
      for (const j of ["relaas", "umum", "bas", undefined] as const) expect(hitungJs(k, j), `${j}: ${k}`).toBe(hitung(k, j));
    }
  });
  it("jenis umum (penetapan): hanya sinyal kuat - titik/garis tidak menahan; kurung siku, kode, perbaikan, merah tetap", () => {
    expect(hitung("Menimbang bahwa ........ sebagaimana ____ tersebut", "umum")).toBe(0);
    expect(hitung("Menetapkan [NAMA HAKIM] sebagai Ketua", "umum")).toBe(1);
    expect(hitung("Menetapkan #0012# sebagai Ketua", "umum")).toBe(1);
    expect(hitung("perlu di review dulu", "umum")).toBe(1);
  });
  it("jenis temuan baru 'sesuai' punya label dan urutan di dua salinan", () => {
    expect(TS.LABEL.sesuai).toBe(JS.LABEL.sesuai);
    expect(TS.URUTAN_JENIS[0]).toBe("sesuai");
    expect(JS.URUTAN_JENIS[0]).toBe("sesuai");
  });
  it("jenis diteruskan lewat periksaBita (RTF) dan menghasilkan hasil sama di TS dan JS", async () => {
    const rtf = new TextEncoder().encode("{\\rtf1\\ansi Pada hari ini ........ tanggal ........., Saya, Tanty sebagai Jurusita\\par Nama pihak ..., sebagai Tergugat;\\par}");
    for (const M of [TS, JS]) {
      const r = await M.periksaBita(rtf, "relaas.rtf", { jenis: "relaas" });
      expect(r.dibaca).toBe(true);
      expect(r.hasil!.temuan).toHaveLength(1);
      expect(r.hasil!.temuan[0].cocok).toContain("...");
      expect((await M.periksaBita(rtf, "relaas.rtf", { jenis: "bas" })).hasil!.temuan.length).toBe(3);
    }
  });
});

// ============================================================================
// 4. Kesesuaian ringan
// ============================================================================
const P = (t: string, n = 1) => ({ teks: t, merah: [], halaman: 1, nomor: n });
describe("4. kesesuaian: nomor perkara dan tanggal sidang BAS", () => {
  const bas = [P("BERITA ACARA SIDANG"), P("Nomor 556/Pdt.G/2026/PA.Dgl", 2), P("pada hari Kamis tanggal 29 Oktober 2026 dalam perkara antara :", 3)];
  it("sama -> tanpa temuan; nomor lain -> satu temuan jenis sesuai; tanggal lain -> satu temuan", () => {
    const sama = SERET.temuanKesesuaian({ paragraf: bas, periksaNomor: true, periksaTanggal: true, nomorHalaman: "556/Pdt.G/2026/PA.Dgl", tanggalBaris: "2026-10-29" });
    expect(sama).toEqual([]);
    const nomorBeda = SERET.temuanKesesuaian({ paragraf: bas, periksaNomor: true, periksaTanggal: false, nomorHalaman: "557/Pdt.G/2026/PA.Dgl", tanggalBaris: "" });
    expect(nomorBeda).toHaveLength(1);
    expect(nomorBeda[0]).toMatchObject({ jenis: "sesuai", paragraf: 2 });
    expect(nomorBeda[0].cocok).toMatch(/556\/Pdt\.G\/2026.*557\/Pdt\.G\/2026/);
    const tglBeda = SERET.temuanKesesuaian({ paragraf: bas, periksaNomor: true, periksaTanggal: true, nomorHalaman: "556/Pdt.G/2026/PA.Dgl", tanggalBaris: "2026-10-15" });
    expect(tglBeda).toHaveLength(1);
    expect(tglBeda[0].cocok).toMatch(/29 Oktober 2026.*15 Oktober 2026/);
  });
  it("nomor lain di berkas (rujukan putusan lama) tidak menjadi temuan selama nomor halaman ini ada; tidak tahu = tidak menuduh", () => {
    const rujuk = [P("Nomor 556/Pdt.G/2026/PA.Dgl", 1), P("sebagaimana putusan Nomor 12/Pdt.G/2020/PA.Dgl", 2)];
    expect(SERET.temuanKesesuaian({ paragraf: rujuk, periksaNomor: true, nomorHalaman: "556/Pdt.G/2026/PA.Dgl" })).toEqual([]);
    expect(SERET.temuanKesesuaian({ paragraf: bas, periksaNomor: true, nomorHalaman: "" })).toEqual([]); // halaman daftar: nomor tak diketahui
    expect(SERET.temuanKesesuaian({ paragraf: [P("tanpa nomor sama sekali")], periksaNomor: true, nomorHalaman: "556/Pdt.G/2026/PA.Dgl" })).toEqual([]);
    expect(SERET.temuanKesesuaian({ paragraf: bas, periksaTanggal: true, tanggalBaris: "" })).toEqual([]);
    expect(SERET.temuanKesesuaian({ paragraf: bas, periksaNomor: false, periksaTanggal: false, nomorHalaman: "1/Pdt.G/2026" })).toEqual([]);
  });
  it("tanggal baris sidang dibaca dari teks baris tabel Jadwal Sidang", () => {
    expect(SERET.tanggalBarisSidang("2 Kamis, 29 Oktober 2026 09.00 WIB Agenda Sidang : Ikrar Talak Ruang 1")).toBe("2026-10-29");
    expect(SERET.tanggalBarisSidang("tidak ada tanggal")).toBe("");
    expect(SERET.tanggalDalamTeks("5 Mei 2026 dan 17 Agustus 2026")).toEqual(["2026-05-05", "2026-08-17"]);
  });
});

// ============================================================================
// 5. Teks PDF per paragraf (server) + aturan yang sama
// ============================================================================
async function pdfDari(baris: string[]): Promise<Uint8Array> {
  const dok = await PDFDocument.create();
  const huruf = await dok.embedFont(StandardFonts.TimesRoman);
  let hal = dok.addPage([595.28, 841.89]);
  let y = 790;
  for (const b of baris) {
    if (y < 60) {
      hal = dok.addPage([595.28, 841.89]);
      y = 790;
    }
    if (b) hal.drawText(b, { x: 70, y, size: 11, font: huruf, color: rgb(0, 0, 0) });
    y -= 16;
  }
  return await dok.save();
}
/** PDF dari paragraf: tiap paragraf dibungkus ke baris selebar halaman, antar paragraf ada jarak - seperti naskah Word. */
function bungkus(teks: string, lebar = 92): string[] {
  // lebar berbobot seperti huruf sungguhan: titik dan spasi separuh huruf; rangkaian titik panjang tak terpotong dan memaksa baris baru.
  const bobot = (t: string) => Array.from(t).reduce((n, c) => n + (c === "." || c === " " ? 0.5 : 1), 0);
  const hasil: string[] = [];
  let baris = "";
  for (const k of teks.split(" ")) {
    if (baris && bobot(baris) + 0.5 + bobot(k) > lebar) {
      hasil.push(baris);
      baris = k;
    } else baris = baris ? `${baris} ${k}` : k;
  }
  if (baris) hasil.push(baris);
  return hasil;
}
async function pdfDariParagraf(paragraf: string[]): Promise<Uint8Array> {
  const baris: string[] = [];
  for (const p of paragraf) baris.push(...bungkus(p), "");
  return pdfDari(baris);
}
const RELAAS_PARAGRAF = [
  "RELAAS PANGGILAN",
  "Nomor 531/Pdt.G/2026/PA.Dgl",
  "Pada hari ini ........ tanggal ........., Saya, Tanty Restianty sebagai Jurusita pada Pengadilan Agama Donggala atas perintah Ketua Majelis dalam perkara Nomor 531/Pdt.G/2026/PA.Dgl Tanggal 21 Agustus 2026;",
  "TELAH MEMANGGIL",
  "Randi Bin Pusri, NIK 7203122011940002, agama Islam, tempat kediaman di Desa Sibualong, Kecamatan Balaesang, Kabupaten Donggala, sebagai Pemohon;",
  "Hari/Tanggal : Selasa, 08 September 2026",
  "Pukul : 09.00 WITA",
  "Pemanggilan tersebut telah saya laksanakan di tempat yang bersangkutan dan di sana saya bertemu serta berbicara dengan .............................;",
  `Demikian relaas panggilan ini dibuat dan ditandatangani oleh saya serta ${".".repeat(110)}`,
  "Jurusita,",
  ".............................",
  "Tanty Restianty",
];

describe("5. PDF -> paragraf (server) lalu aturan yang sama", () => {
  it("paragraf dari LETAK baris: judul dan 'Nomor ...' berdiri sendiri, kalimat yang terbungkus tetap utuh, baris tabel terpisah", async () => {
    const h = await bacaPdfEdoc(await pdfDariParagraf(RELAAS_PARAGRAF), "relaas.pdf");
    expect(h.paragraf.map((p) => p.teks), JSON.stringify(h.paragraf.map((p) => p.teks))).toEqual(RELAAS_PARAGRAF);
    expect(h.paragraf.map((p) => p.nomor)).toEqual(RELAAS_PARAGRAF.map((_x, k) => k + 1));
    expect(h.jumlahHalaman).toBe(1);
    expect(h.halamanKosong).toEqual([]);
  });
  it("relaas PDF yang benar (isian tangan jurusita) -> 0 temuan; sama untuk PDF yang menyisakan #nnnn# dan [ ] -> temuan", async () => {
    const h = await bacaPdfEdoc(await pdfDariParagraf(RELAAS_PARAGRAF), "relaas.pdf");
    expect(h.ada).toBe(true);
    expect(h.paragraf.length).toBeGreaterThan(5);
    const hasil = JS.periksaParagraf(h.paragraf, { jenis: "relaas" });
    expect(hasil.temuan.map((t) => t.cocok), JSON.stringify(h.paragraf.map((p) => p.teks))).toEqual([]);
    // satu aturan: tanpa pengecualian relaas, PDF yang sama menghasilkan temuan titik-titik
    expect(JS.periksaParagraf(h.paragraf).temuan.length).toBeGreaterThan(0);
    const rusak = await bacaPdfEdoc(await pdfDariParagraf([...RELAAS_PARAGRAF.slice(0, 5), "Randi #0046# sebagai Pemohon [ALAMAT];", ...RELAAS_PARAGRAF.slice(5)]), "relaas.pdf");
    const t = JS.periksaParagraf(rusak.paragraf, { jenis: "relaas" }).temuan;
    expect(t.map((x) => x.jenis).sort()).toEqual(["kurung", "tanda"]);
  });
  it("bukan PDF / kosong / terlalu besar ditolak", async () => {
    await expect(bacaPdfEdoc(new TextEncoder().encode("bukan pdf"), "x.pdf")).rejects.toThrow(/bukan PDF/);
    await expect(bacaPdfEdoc(new Uint8Array(0), "x.pdf")).rejects.toThrow(/kosong/);
  });
});

// ============================================================================
// 6. Perilaku ekstensi di jsdom
// ============================================================================
const ASAL = "http://192.168.10.10";
const HALAMAN = (isi: string) => `<!doctype html><html><body><div id="konten">
  <table><tr id="baris-sidang"><td>2</td><td>Kamis, 29 Oktober 2026</td><td>Ikrar Talak</td><td>
    <a id="t-bas" href="#" onClick="popup_form('${B}fileupload/${ENC}/bas/${ENC}1/2')" class="btn"><i class="fa"></i> Unggah BAS</a></td></tr></table>
  <a id="t-relaas" href="#" onclick="popup_form('${B}fileupload/${ENC}/relaas/${ENC}1/${ENC}2')">Upload Relaas</a>
  <a id="t-putusan" href="#" onclick="popup_form('${B}fileupload_putusan/${ENC}/putusan')">Unggah E-Doc</a>
  <a id="t-pmh" href="#" onclick="popup_form('${B}fileupload/${ENC}/dokpmh/${ENC}7')">Unggah</a>
  <a id="t-datum" href="#" onclick="popup_form('${B}fileupload/${ENC}/datum')">Unggah E-Doc</a>
  <a id="t-lain" href="#" onclick="popup_form('${B}data_relaas_panggilan/${ENC}')">Data relaas</a>
  <span id="di-luar">teks</span>${isi}</div></body></html>`;

const enc = (s: string) => new TextEncoder().encode(s);
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
let LAPOR: () => string = () => "";
async function sampai(periksa: () => unknown, ket: string, batas = 5000) {
  const mulai = Date.now();
  for (;;) {
    let h: unknown;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket} :: ${LAPOR()}`);
    await tunggu(5);
  }
}

type Catatan = { metode: string; url: string; badan: Record<string, string>; berkas?: { nama: string; tipe: string; byte: number } };
type Opsi = {
  dialog?: (url: string) => string;
  uploadJawab?: () => { st: number; msg: string };
  ubahJawab?: () => Record<string, unknown>;
  bacaPdf?: (pdf: Uint8Array) => Promise<unknown>;
  tersembunyi?: boolean;
  nomorHalaman?: string;
  tinjauSisa?: boolean;
};

async function buka(opsi: Opsi = {}) {
  const dom = new JSDOM(HALAMAN(""), { url: `${ASAL}/SIPP/index.php/perkara_detil_agama/${ENC}`, runScripts: "outside-only" });
  const w = dom.window as any;
  const doc = dom.window.document as Document;
  const catatan: Catatan[] = [];
  const portal: string[] = [];
  const dengar: string[] = [];
  const asliTambah = w.EventTarget.prototype.addEventListener;
  w.EventTarget.prototype.addEventListener = function (jenis: string, ...sisa: unknown[]) {
    if (this === doc) dengar.push(String(jenis));
    return asliTambah.call(this, jenis, ...sisa);
  };
  w.fetch = async (url: string, init: any = {}) => {
    const metode = String(init.method || "GET").toUpperCase();
    const c: Catatan = { metode, url: String(url), badan: {} };
    catatan.push(c);
    const json = (x: unknown) => ({ ok: true, status: 200, json: async () => x, text: async () => JSON.stringify(x) });
    if (metode === "GET") {
      const html = opsi.dialog ? opsi.dialog(String(url)) : /fileupload_putusan/.test(String(url)) ? DIALOG_PUTUSAN() : DIALOG_BAS({ dari: /relaas/.test(String(url)) ? "relaas" : /datum/.test(String(url)) ? "datum" : /dokpmh/.test(String(url)) ? "dokpmh" : "bas", aksep: /\/(?:bas|dokpmh)\//.test(String(url)) });
      return { ok: true, status: 200, text: async () => html, json: async () => ({}) };
    }
    const b = init.body;
    if (b instanceof w.URLSearchParams) for (const [k, v] of b.entries()) c.badan[k] = v;
    else if (b && typeof b.entries === "function") {
      for (const [k, v] of b.entries()) {
        if (typeof v === "string") c.badan[k] = v;
        else c.berkas = { nama: v.name, tipe: v.type, byte: v.size };
      }
    }
    if (/validatePost/.test(String(url))) return json(opsi.uploadJawab ? opsi.uploadJawab() : { st: 1, msg: "Penyimpanan Dokumen Elektronik (E-Doc) Berhasil." });
    return json({ st: 1, msg: "ok" });
  };
  w.TextDecoder = TextDecoder; // jsdom tidak membawa TextDecoder/TextEncoder (peramban sungguhan punya)
  w.TextEncoder = TextEncoder;
  w.alatPemilihMilikAleta = () => false;
  w.cariNomorPerkara = () => opsi.nomorHalaman ?? "556/Pdt.G/2026/PA.Dgl";
  w.alatAmbil = async (alamat: string, init: any) => {
    portal.push(String(alamat));
    const jawab = (x: unknown) => ({ ok: true, status: 200, json: async () => ({ ok: true, data: x }) });
    if (/baca-pdf/.test(alamat)) {
      const f = init.body.get("berkas") as File;
      const bita = await new Promise<Uint8Array>((s) => {
        const r = new w.FileReader();
        r.onload = () => s(new Uint8Array(r.result));
        r.readAsArrayBuffer(f);
      });
      return jawab(opsi.bacaPdf ? await opsi.bacaPdf(bita) : await bacaPdfEdoc(bita, "x.pdf"));
    }
    if (/word-ke-pdf/.test(alamat)) {
      const f = init.body.get("berkas") as File;
      const ttd = String(init.body.get("ttd"));
      portal.push(`ubah:${f.name}:ttd=${ttd}`);
      return jawab(opsi.ubahJawab ? opsi.ubahJawab() : { pdfBase64: b64(await pdfDari(["BERITA ACARA SIDANG", "Nomor 556/Pdt.G/2026/PA.Dgl", "pada hari Kamis tanggal 29 Oktober 2026 dalam perkara antara :"])), namaBerkas: f.name.replace(/\.\w+$/, ".pdf"), bentukAsal: "rtf", blokTtd: "ditemukan", penandatangan: ttd === "1" ? [{ peran: "pp", jabatan: "Panitera Pengganti", nama: "Sri Wahyuni, S.H.", status: "terpasang", keterangan: "tanda tangan terpasang" }] : [], peringatan: [] });
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  if (opsi.tersembunyi !== undefined) w.AletaTampilanSipp = { tersembunyi: (k: string) => opsi.tersembunyi === true && k === "semua.seret-edoc" };
  w.eval(bacaEks("deteksi-sisa-blangko.js"));
  w.eval(bacaEks("bas-word-pdf.js"));
  const sebelumSeret = dengar.length;
  w.eval(bacaEks("edoc-seret.js"));
  const dipasang = dengar.slice(sebelumSeret);
  const konten = doc.getElementById("konten")!;
  const segar: number[] = [];
  konten.addEventListener("change", () => segar.push(1));
  const klik: string[] = [];
  for (const id of ["t-bas", "t-relaas", "t-putusan", "t-pmh", "t-datum"]) doc.getElementById(id)!.addEventListener("click", () => klik.push(id));
  LAPOR = () => `kartu=${Array.from(doc.querySelectorAll(".aleta-seret-kartu")).map((k) => k.textContent).join("|")} catatan=${JSON.stringify(catatan.map((c) => c.metode + " " + c.url))} portal=${JSON.stringify(portal)}`;
  return { dom, w, doc, catatan, portal, dipasang, segar, klik };
}
type Lingkungan = Awaited<ReturnType<typeof buka>>;

function berkas(e: Lingkungan, bita: Uint8Array, nama: string, tipe = "") {
  return new e.w.File([bita], nama, { type: tipe });
}
function acara(e: Lingkungan, jenis: string, sasaran: Element, files: File[]) {
  const ev = new e.w.Event(jenis, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "dataTransfer", { value: { types: files.length ? ["Files"] : ["text/plain"], files, dropEffect: "" } });
  sasaran.dispatchEvent(ev);
  return ev as Event;
}
const kartuTeks = (e: Lingkungan) => Array.from(e.doc.querySelectorAll(".aleta-seret-kartu")).map((k) => k.textContent || "").join(" | ");
const tombolDialog = (e: Lingkungan, teks: string) => Array.from(e.doc.querySelectorAll("button")).find((b) => (b.textContent || "").includes(teks)) as HTMLButtonElement | undefined;
const unggahan = (e: Lingkungan) => e.catatan.filter((c) => c.metode === "POST" && /validatePost/.test(c.url));
const PDF_BAS = () => pdfDariParagraf(["BERITA ACARA SIDANG", "Nomor 556/Pdt.G/2026/PA.Dgl", "Pada hari ini Kamis tanggal 29 Oktober 2026 dalam perkara antara :", "Panitera Pengganti", "Sri Wahyuni, S.H."]);

describe("6a. sorot dan jalan pintas - klik tidak disentuh", () => {
  it("hanya pendengar seret-lepas di dokumen; TIDAK ADA pendengar klik/kirim/ubah (jendela unggah SIPP + fitur ALETA di dalamnya tetap seperti dulu)", async () => {
    const e = await buka();
    expect(Array.from(new Set(e.dipasang)).sort()).toEqual(["dragenter", "dragleave", "dragover", "drop"]);
    const ev = new e.w.MouseEvent("click", { bubbles: true, cancelable: true });
    e.doc.getElementById("t-bas")!.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(e.klik).toEqual(["t-bas"]);
    expect(e.catatan).toEqual([]);
  });
  it("berkas diseret di atas tombol e-Doc: peristiwa diterima (dibatalkan), tombol disorot dengan petunjuk jenisnya; tombol lain ditandai siap; di luar tombol tidak diterima", async () => {
    const e = await buka();
    const f = berkas(e, await PDF_BAS(), "BAS.pdf");
    const luar = acara(e, "dragover", e.doc.getElementById("di-luar")!, [f]);
    expect(luar.defaultPrevented).toBe(false);
    expect(e.doc.querySelectorAll(".aleta-seret-siap").length).toBe(5);
    const atas = acara(e, "dragover", e.doc.querySelector("#t-bas i")!, [f]);
    expect(atas.defaultPrevented).toBe(true);
    expect(e.doc.getElementById("t-bas")!.classList.contains("aleta-seret-sorot")).toBe(true);
    expect(e.doc.querySelector(".aleta-seret-petunjuk")!.textContent).toBe("Lepas di sini untuk unggah BAS");
    acara(e, "dragover", e.doc.getElementById("t-relaas")!, [f]);
    expect(e.doc.getElementById("t-bas")!.classList.contains("aleta-seret-sorot")).toBe(false);
    expect(e.doc.querySelector(".aleta-seret-petunjuk")!.textContent).toBe("Lepas di sini untuk unggah relaas");
    const tombolBukan = acara(e, "dragover", e.doc.getElementById("t-lain")!, [f]);
    expect(tombolBukan.defaultPrevented).toBe(false);
    expect(e.doc.querySelector(".aleta-seret-petunjuk")).toBeNull();
  });
  it("yang diseret bukan berkas (teks) tidak ditanggapi", async () => {
    const e = await buka();
    const ev = acara(e, "dragover", e.doc.getElementById("t-bas")!, []);
    expect(ev.defaultPrevented).toBe(false);
    expect(e.doc.querySelector(".aleta-seret-siap")).toBeNull();
  });
});

describe("6b. simpan: PDF langsung lewat halaman unggah SIPP, dua langkah seperti SubmitHandling", () => {
  it("BAS PDF dilepas: halaman unggah dibuka di latar (alamat onclick yang sama), isian ke alamat form lalu berkas ke alamat unggah; nama .pdf; 'Tersimpan di SIPP'; halaman disegarkan", async () => {
    const e = await buka();
    const f = berkas(e, await PDF_BAS(), "BAS sidang 2.pdf", "application/pdf");
    const ev = acara(e, "drop", e.doc.getElementById("t-bas")!, [f]);
    expect(ev.defaultPrevented).toBe(true);
    await sampai(() => /Tersimpan di SIPP/.test(kartuTeks(e)), "tersimpan");
    const gets = e.catatan.filter((c) => c.metode === "GET");
    expect(gets).toHaveLength(1);
    expect(gets[0].url).toBe(`${B}fileupload/${ENC}/bas/${ENC}1/2`);
    const posts = e.catatan.filter((c) => c.metode === "POST");
    expect(posts.map((p) => p.url)).toEqual(["http://192.168.10.10/SIPP/fileupload_c/dummy", "http://192.168.10.10/SIPP/fileupload_c/validatePost"]);
    expect(posts[0].badan).toEqual({ enc: ENC, enc1: `${ENC}1`, from: "bas", urutan: "2" });
    expect(posts[1].badan).toEqual({ enc: ENC, enc1: `${ENC}1`, from: "bas", urutan: "2" });
    expect(posts[1].berkas).toMatchObject({ nama: "BAS sidang 2.pdf", tipe: "application/pdf" });
    expect(kartuTeks(e)).toMatch(/Tersimpan di SIPP: BAS \(BAS sidang 2\.pdf/);
    expect(e.segar.length).toBe(1);
    expect(e.klik).toEqual([]);
    // tidak ada kata Aleta pada yang terkirim ke SIPP
    expect(JSON.stringify(e.catatan)).not.toMatch(/aleta/i);
  });
  it("putusan: isian bawaan halaman unggah (status publikasi) ikut terkirim ke alamat unggah putusan SIPP", async () => {
    const e = await buka();
    acara(e, "drop", e.doc.getElementById("t-putusan")!, [berkas(e, await pdfDari(["PUTUSAN", "Nomor 556/Pdt.G/2026/PA.Dgl", "MENGADILI"]), "putusan.pdf")]);
    await sampai(() => /Tersimpan di SIPP/.test(kartuTeks(e)), "tersimpan");
    const up = unggahan(e)[0];
    expect(up.url).toBe("http://192.168.10.10/SIPP/fileupload_putusan_c/validatePost");
    expect(up.badan).toEqual({ enc: ENC, form: "putusan", status_publish: "1" });
    expect(up.berkas!.nama).toBe("putusan.pdf");
  });
  it("jenis ditentukan dari TOMBOL, bukan nama berkas: berkas bernama 'relaas.pdf' dilepas di tombol penetapan PMH tersimpan sebagai PMH", async () => {
    const e = await buka();
    acara(e, "drop", e.doc.getElementById("t-pmh")!, [berkas(e, await pdfDari(["PENETAPAN", "Nomor 556/Pdt.G/2026/PA.Dgl"]), "relaas.pdf")]);
    await sampai(() => /Tersimpan di SIPP/.test(kartuTeks(e)), "tersimpan");
    expect(unggahan(e)[0].badan.from).toBe("dokpmh");
    expect(kartuTeks(e)).toMatch(/penetapan PMH/);
  });
  it("gugatan/permohonan (tanpa pemeriksaan isi): langsung tersimpan tanpa pembacaan PDF di server", async () => {
    const e = await buka();
    acara(e, "drop", e.doc.getElementById("t-datum")!, [berkas(e, await pdfDari(["GUGATAN ......... [ ] #0001#"]), "gugatan.pdf")]);
    await sampai(() => /Tersimpan di SIPP/.test(kartuTeks(e)), "tersimpan");
    expect(e.portal.some((p) => /baca-pdf/.test(p))).toBe(false);
    expect(unggahan(e)).toHaveLength(1);
  });
  it("SIPP menolak (st 0): sebabnya ditampilkan apa adanya, kartu gagal tidak menutup sendiri, halaman tidak disegarkan", async () => {
    const e = await buka({ uploadJawab: () => ({ st: 0, msg: "Error:<br /> Penyimpanan Dokumen Elektronik (E-Doc)Tidak Berhasil." }) });
    acara(e, "drop", e.doc.getElementById("t-bas")!, [berkas(e, await PDF_BAS(), "BAS.pdf")]);
    await sampai(() => /Gagal menyimpan BAS ke SIPP/.test(kartuTeks(e)), "gagal");
    expect(kartuTeks(e)).toMatch(/Tidak Berhasil/);
    expect(e.segar).toEqual([]);
    expect(e.doc.querySelector(".aleta-seret-kartu.gagal")).toBeTruthy();
  });
  it("lebih dari satu berkas, terlalu besar, atau bukan PDF/Word di jendela hanya-PDF: ditolak dengan alasan, tanpa menghubungi SIPP", async () => {
    const e = await buka();
    acara(e, "drop", e.doc.getElementById("t-bas")!, [berkas(e, enc("a"), "a.pdf"), berkas(e, enc("b"), "b.pdf")]);
    expect(kartuTeks(e)).toMatch(/satu berkas saja/);
    expect(e.catatan).toEqual([]);
    const besar = new Uint8Array(21 * 1024 * 1024);
    acara(e, "drop", e.doc.getElementById("t-bas")!, [berkas(e, besar, "besar.pdf")]);
    await sampai(() => /lebih dari 20 MB/.test(kartuTeks(e)), "ukuran");
    acara(e, "drop", e.doc.getElementById("t-bas")!, [berkas(e, new Uint8Array([0x50, 0x4b, 3, 4, 0, 0, 0, 0, 0, 0]), "rekap.zip")]);
    await sampai(() => /hanya menerima PDF/.test(kartuTeks(e)), "bukan PDF");
    expect(unggahan(e)).toEqual([]);
  });
  it("sesi SIPP habis (halaman unggah berupa halaman login): gagal dengan kalimat jelas, tidak ada kiriman", async () => {
    const e = await buka({ dialog: () => "<html><body><form id='login'></form></body></html>" });
    acara(e, "drop", e.doc.getElementById("t-bas")!, [berkas(e, await PDF_BAS(), "BAS.pdf")]);
    await sampai(() => /tidak terbaca/.test(kartuTeks(e)), "gagal");
    expect(e.catatan.filter((c) => c.metode === "POST")).toEqual([]);
  });
});

describe("6c. sudah ada e-Doc -> tanya ganti", () => {
  const dialogAda = () => DIALOG_BAS({ lama: "PADgl_2026_PdtG_556_bas_2_1792096162.pdf" });
  it("Batal: tidak ada yang terkirim; Ganti: tersimpan", async () => {
    const e = await buka({ dialog: dialogAda });
    acara(e, "drop", e.doc.getElementById("t-bas")!, [berkas(e, await PDF_BAS(), "BAS.pdf")]);
    await sampai(() => tombolDialog(e, "Batal"), "dialog ganti");
    expect(e.doc.querySelector(".aleta-seret-kotak")!.textContent).toMatch(/Ganti dokumen yang sudah ada\?.*PADgl_2026_PdtG_556_bas_2_1792096162\.pdf/);
    tombolDialog(e, "Batal")!.click();
    await sampai(() => /Dibatalkan/.test(kartuTeks(e)), "dibatalkan");
    expect(e.catatan.filter((c) => c.metode === "POST")).toEqual([]);
    acara(e, "drop", e.doc.getElementById("t-bas")!, [berkas(e, await PDF_BAS(), "BAS.pdf")]);
    await sampai(() => tombolDialog(e, "Ganti"), "dialog ganti 2");
    tombolDialog(e, "Ganti")!.click();
    await sampai(() => /Tersimpan di SIPP/.test(kartuTeks(e)), "tersimpan");
    expect(unggahan(e)).toHaveLength(1);
  });
});

describe("6d. periksa isi: temuan -> Tetap unggah / Batal; tanpa temuan -> langsung simpan", () => {
  it("BAS dengan sisa #nnnn# dan '...': satu kotak konfirmasi; Batal = tidak ada yang terkirim; Tetap unggah = tersimpan", async () => {
    const e = await buka();
    const rusak = await pdfDari(["BERITA ACARA SIDANG", "Nomor 556/Pdt.G/2026/PA.Dgl", "Pada hari ini Kamis tanggal 29 Oktober 2026 dalam perkara antara :", "Susunan: #0012# sebagai Ketua Majelis dan ........ sebagai PP;"]);
    acara(e, "drop", e.doc.getElementById("t-bas")!, [berkas(e, rusak, "BAS.pdf")]);
    await sampai(() => tombolDialog(e, "Tetap unggah"), "dialog temuan");
    const teks = e.doc.querySelector(".aleta-sisa-tabir")!.textContent!;
    expect(teks).toMatch(/Ditemukan 2 hal pada BAS/);
    expect(teks).toContain("#0012#");
    tombolDialog(e, "Batal")!.click();
    await sampai(() => /Dibatalkan: tidak ada yang dikirim ke SIPP/.test(kartuTeks(e)), "batal");
    expect(e.catatan.filter((c) => c.metode === "POST")).toEqual([]);
    acara(e, "drop", e.doc.getElementById("t-bas")!, [berkas(e, rusak, "BAS.pdf")]);
    await sampai(() => tombolDialog(e, "Tetap unggah"), "dialog temuan 2");
    tombolDialog(e, "Tetap unggah")!.click();
    await sampai(() => /Tersimpan di SIPP/.test(kartuTeks(e)), "tersimpan");
    expect(unggahan(e)).toHaveLength(1);
  });
  it("BAS yang benar: tanpa dialog, langsung 'Tersimpan di SIPP'", async () => {
    const e = await buka();
    acara(e, "drop", e.doc.getElementById("t-bas")!, [berkas(e, await PDF_BAS(), "BAS.pdf")]);
    await sampai(() => /Tersimpan di SIPP/.test(kartuTeks(e)), "tersimpan");
    expect(e.doc.querySelector(".aleta-sisa-tabir")).toBeNull();
  });
  it("nomor perkara di berkas bukan perkara halaman ini -> temuan kesesuaian (judul 'Isi berkas perlu diperiksa dulu')", async () => {
    const e = await buka({ nomorHalaman: "600/Pdt.G/2026/PA.Dgl" });
    acara(e, "drop", e.doc.getElementById("t-bas")!, [berkas(e, await PDF_BAS(), "BAS.pdf")]);
    await sampai(() => tombolDialog(e, "Tetap unggah"), "dialog");
    const teks = e.doc.querySelector(".aleta-sisa-tabir")!.textContent!;
    expect(teks).toMatch(/Isi berkas perlu diperiksa dulu/);
    expect(teks).toMatch(/Nomor perkara di berkas 556\/Pdt\.G\/2026 berbeda dengan perkara di halaman ini \(600\/Pdt\.G\/2026\/PA\.Dgl\)/);
    tombolDialog(e, "Batal")!.click();
    await sampai(() => /Dibatalkan/.test(kartuTeks(e)), "batal");
  });
  it("tanggal sidang BAS beda dengan baris tempat dilepas -> temuan", async () => {
    const e = await buka();
    e.doc.getElementById("baris-sidang")!.children[1].textContent = "Kamis, 15 Oktober 2026";
    acara(e, "drop", e.doc.getElementById("t-bas")!, [berkas(e, await PDF_BAS(), "BAS.pdf")]);
    await sampai(() => tombolDialog(e, "Tetap unggah"), "dialog");
    expect(e.doc.querySelector(".aleta-sisa-tabir")!.textContent).toMatch(/Tanggal sidang di berkas 29 Oktober 2026 berbeda dengan sidang tempat berkas dilepas \(15 Oktober 2026\)/);
  });
  it("RELAAS yang benar (titik isian tangan jurusita): TIDAK memicu dialog; relaas dengan sisa #nnnn# / [ ]: memicu", async () => {
    const e = await buka({ nomorHalaman: "531/Pdt.G/2026/PA.Dgl" });
    acara(e, "drop", e.doc.getElementById("t-relaas")!, [berkas(e, await pdfDariParagraf(RELAAS_PARAGRAF), "relaas.pdf")]);
    await sampai(() => /Tersimpan di SIPP: relaas/.test(kartuTeks(e)), "tersimpan");
    expect(e.doc.querySelector(".aleta-sisa-tabir")).toBeNull();
    const e2 = await buka({ nomorHalaman: "531/Pdt.G/2026/PA.Dgl" });
    acara(e2, "drop", e2.doc.getElementById("t-relaas")!, [berkas(e2, await pdfDariParagraf([...RELAAS_PARAGRAF.slice(0, 5), "Randi #0046# sebagai Pemohon [ALAMAT];", ...RELAAS_PARAGRAF.slice(5)]), "relaas.pdf")]);
    await sampai(() => tombolDialog(e2, "Tetap unggah"), "dialog");
    expect(e2.doc.querySelector(".aleta-sisa-tabir")!.textContent).toMatch(/Ditemukan 2 hal pada relaas/);
  });
  it("pembaca PDF di server tidak terjangkau: berkas tetap disimpan dan petugas diberi tahu isinya tidak diperiksa", async () => {
    const e = await buka({
      bacaPdf: async () => {
        throw new Error("mati");
      },
    });
    e.w.alatAmbil = async () => ({ ok: false, status: 502, json: async () => ({}) });
    acara(e, "drop", e.doc.getElementById("t-bas")!, [berkas(e, await PDF_BAS(), "BAS.pdf")]);
    await sampai(() => /Tersimpan di SIPP/.test(kartuTeks(e)), "tersimpan");
    expect(kartuTeks(e)).toMatch(/tidak dapat diperiksa/);
  });
});

describe("6e. Word -> PDF lewat pengubah yang sama dengan jendela e-Doc BAS", () => {
  const RTF = enc("{\\rtf1\\ansi BERITA ACARA SIDANG\\par Nomor 556/Pdt.G/2026/PA.Dgl\\par}");
  it("BAS RTF: diubah dengan tanda tangan scan (ttd=1), diunggah sebagai PDF, penanda tangan disebut", async () => {
    const e = await buka();
    acara(e, "drop", e.doc.getElementById("t-bas")!, [berkas(e, RTF, "BAS 2.rtf")]);
    await sampai(() => /Tersimpan di SIPP/.test(kartuTeks(e)), "tersimpan");
    expect(e.portal).toContain("ubah:BAS 2.rtf:ttd=1");
    expect(unggahan(e)[0].berkas).toMatchObject({ nama: "BAS 2.pdf", tipe: "application/pdf" });
    expect(kartuTeks(e)).toMatch(/Panitera Pengganti Sri Wahyuni, S\.H\.: tanda tangan terpasang/);
  });
  it("jenis lain (relaas, penetapan): diubah TANPA tanda tangan (ttd=0) dan petugas diberi tahu alasannya", async () => {
    const e = await buka();
    acara(e, "drop", e.doc.getElementById("t-pmh")!, [berkas(e, enc("{\\rtf1 PENETAPAN Nomor 556/Pdt.G/2026/PA.Dgl\\par}"), "pmh.rtf")]);
    await sampai(() => /Tersimpan di SIPP/.test(kartuTeks(e)), "tersimpan");
    expect(e.portal).toContain("ubah:pmh.rtf:ttd=0");
    expect(unggahan(e)[0].berkas!.nama).toBe("pmh.pdf");
    expect(kartuTeks(e)).toMatch(/Tanda tangan scan tidak dibubuhkan untuk penetapan PMH \(hanya untuk BAS\)/);
  });
  it("kotak tanda tangan yang dimatikan di jendela e-Doc BAS juga berlaku di seret-lepas", async () => {
    const e = await buka();
    // jendela e-Doc BAS: kotak centang tanda tangan dimatikan -> ttdDipilih() false
    const form = e.doc.createElement("form");
    form.innerHTML = `<input type="hidden" name="from" value="bas"><input type="file" name="fileform">`;
    e.doc.body.appendChild(form);
    const input = form.querySelector("input[type=file]") as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [berkas(e, RTF, "x.rtf")], configurable: true });
    input.dispatchEvent(new e.w.Event("change", { bubbles: true }));
    await sampai(() => e.doc.querySelector(".aleta-bwp input[type=checkbox]"), "kotak tanda tangan");
    (e.doc.querySelector(".aleta-bwp input[type=checkbox]") as HTMLInputElement).click();
    expect(e.w.aletaBasWordPdf.ttdDipilih()).toBe(false);
    e.portal.length = 0;
    acara(e, "drop", e.doc.getElementById("t-bas")!, [berkas(e, RTF, "BAS 2.rtf")]);
    await sampai(() => /Tersimpan di SIPP: BAS/.test(kartuTeks(e)), "tersimpan");
    expect(e.portal).toContain("ubah:BAS 2.rtf:ttd=0");
  });
  it("pengubah gagal: alasan ditampilkan, tidak ada yang terkirim ke SIPP", async () => {
    const e = await buka();
    e.w.alatAmbil = async () => ({ ok: false, status: 503, json: async () => ({ ok: false, error: { message: "Konversi di server gagal: soffice belum tersedia" } }) });
    acara(e, "drop", e.doc.getElementById("t-bas")!, [berkas(e, RTF, "BAS.rtf")]);
    await sampai(() => /Tidak tersimpan: tidak dapat diubah ke PDF/.test(kartuTeks(e)), "gagal");
    expect(kartuTeks(e)).toMatch(/soffice belum tersedia/);
    expect(e.catatan.filter((c) => c.metode === "POST")).toEqual([]);
  });
  it("RTF dengan sisa blangko merah/tanda diperiksa dari ASLINYA: dialog muncul sebelum disimpan", async () => {
    const e = await buka();
    acara(e, "drop", e.doc.getElementById("t-bas")!, [berkas(e, enc("{\\rtf1\\ansi Nomor 556/Pdt.G/2026/PA.Dgl\\par Hadir #0046# dan ......\\par}"), "BAS.rtf")]);
    await sampai(() => tombolDialog(e, "Tetap unggah"), "dialog");
    expect(e.doc.querySelector(".aleta-sisa-tabir")!.textContent).toMatch(/#0046#/);
    tombolDialog(e, "Batal")!.click();
    await sampai(() => /Dibatalkan/.test(kartuTeks(e)), "batal");
    expect(e.catatan.filter((c) => c.metode === "POST")).toEqual([]);
  });
});

describe("6f. saklar Tampilan SIPP: Unggah e-Doc dengan seret-lepas", () => {
  it("katalog: elemen ada, nyala bawaan untuk semua golongan, dapat dimatikan pengguna dan aturan admin; penyaringnya menunjuk elemen ekstensi", () => {
    const el = KATALOG_TAMPILAN_SIPP.find((x) => x.kunci === "semua.seret-edoc")!;
    expect(el).toBeTruthy();
    expect(el.halaman).toBe("semua");
    expect(el.jenis).toBe("aksi");
    expect(el.pilih).toEqual([".aleta-seret-petunjuk"]);
    expect(bacaEks("edoc-seret.js")).toContain("aleta-seret-petunjuk");
    for (const golongan of [["pp"], ["hakim"], ["panitera"], ["jurusita"], ["super-admin"], ["admin"], []] as const) {
      const h = pecahkanTampilanSipp({ aturan: [], penggunaId: "u1", golongan }).find((x) => x.kunci === "semua.seret-edoc")!;
      expect(h.tampil, String(golongan)).toBe(true);
      expect(h.terkunci).toBe(false);
    }
    const mati = pecahkanTampilanSipp({ aturan: [], penggunaId: "u1", golongan: ["admin"], pilihan: { "semua.seret-edoc": false } });
    expect(sembunyiUntukEkstensi(mati).map((s) => s.kunci)).toEqual(["semua.seret-edoc"]);
    // peran ganda: yang paling longgar menang (boleh > selalu > tidak) - 'tidak' pada satu golongan tidak menutup golongan lain yang 'selalu'
    const atur = (sasaran: string, mode: "boleh" | "selalu" | "tidak") => ({ tingkat: "admin" as const, lingkup: "peran" as const, sasaran, aturan: { "semua.seret-edoc": { mode, bawaan: true } }, catatan: "", diubahOleh: "a", diubahPada: "2026-10-30T00:00:00.000Z" });
    const ganda = pecahkanTampilanSipp({ aturan: [atur("pp", "tidak"), atur("hakim", "selalu")], penggunaId: "u1", golongan: ["pp", "hakim"] }).find((x) => x.kunci === "semua.seret-edoc")!;
    expect(ganda).toMatchObject({ tampil: true, terkunci: true, mode: "selalu" });
    const tidak = pecahkanTampilanSipp({ aturan: [atur("pp", "tidak")], penggunaId: "u1", golongan: ["pp"] }).find((x) => x.kunci === "semua.seret-edoc")!;
    expect(tidak).toMatchObject({ tampil: false, terkunci: true });
  });
  it("mati (AletaTampilanSipp.tersembunyi): tombol TIDAK menerima seret dan lepas diabaikan (perilaku SIPP asli); menyala: diterima", async () => {
    const mati = await buka({ tersembunyi: true });
    const f = berkas(mati, await PDF_BAS(), "BAS.pdf");
    const ev = acara(mati, "dragover", mati.doc.getElementById("t-bas")!, [f]);
    expect(ev.defaultPrevented).toBe(false);
    expect(mati.doc.querySelector(".aleta-seret-siap")).toBeNull();
    expect(mati.doc.querySelector(".aleta-seret-petunjuk")).toBeNull();
    const lepas = acara(mati, "drop", mati.doc.getElementById("t-bas")!, [f]);
    expect(lepas.defaultPrevented).toBe(false);
    await tunggu(40);
    expect(mati.catatan).toEqual([]);
    // klik tetap membuka popup SIPP (tidak disentuh)
    const klik = new mati.w.MouseEvent("click", { bubbles: true, cancelable: true });
    mati.doc.getElementById("t-bas")!.dispatchEvent(klik);
    expect(mati.klik).toEqual(["t-bas"]);
    const nyala = await buka({ tersembunyi: false });
    expect(acara(nyala, "dragover", nyala.doc.getElementById("t-bas")!, [berkas(nyala, enc("x"), "x.pdf")]).defaultPrevented).toBe(true);
  });
  it("tanpa AletaTampilanSipp, penanda <html data-aleta-tampilan-sembunyi> dipakai; berubah saat berjalan langsung berlaku", async () => {
    const e = await buka();
    const f = berkas(e, enc("x"), "x.pdf");
    expect(acara(e, "dragover", e.doc.getElementById("t-bas")!, [f]).defaultPrevented).toBe(true);
    e.doc.documentElement.setAttribute("data-aleta-tampilan-sembunyi", "semua.panel semua.seret-edoc");
    expect(acara(e, "dragover", e.doc.getElementById("t-bas")!, [f]).defaultPrevented).toBe(false);
    e.doc.documentElement.setAttribute("data-aleta-tampilan-sembunyi", "semua.panel");
    expect(acara(e, "dragover", e.doc.getElementById("t-bas")!, [f]).defaultPrevented).toBe(true);
  });
});

describe("6g. penjaga berkas ekstensi", () => {
  const js = bacaEks("edoc-seret.js");
  // Teks yang tampil = isi tanda kutip di luar komentar, tanpa ungkapan ${...}.
  const tanpaKomentar = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const teksTampil = Array.from(tanpaKomentar.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)).map((m) => m[2].replace(/\$\{[^}]*\}/g, ""));
  it("teks tampilan tanpa angka empat digit telanjang", () => {
    expect(teksTampil.length).toBeGreaterThan(40);
    for (const t of teksTampil) expect(t, t).not.toMatch(/(?<![\w.#/-])\d{4}(?![\w.-])/);
  });
  it("tanpa istilah teknis pada teks tampilan (bukan peladen/borang/galat), tanpa XMLHttpRequest, tanpa sandi", () => {
    for (const t of teksTampil) expect(t, t).not.toMatch(/\b(?:peladen|borang|galat)\b/i);
    expect(js).not.toMatch(/new\s+XMLHttpRequest|password|sandi|api[_-]?key/i);
  });
  it("terpasang di manifest SIPP sesudah bas-word-pdf.js dan deteksi-sisa-blangko.js, tidak di ABT/portal; ikut dikemas; rute baru diizinkan di mode coba dan latihan", () => {
    const manifest = JSON.parse(bacaEks("manifest.json"));
    const sipp = manifest.content_scripts.find((c: any) => c.js.includes("konten.js")).js as string[];
    expect(sipp.indexOf("edoc-seret.js")).toBeGreaterThan(sipp.indexOf("bas-word-pdf.js"));
    expect(sipp.indexOf("edoc-seret.js")).toBeGreaterThan(sipp.indexOf("deteksi-sisa-blangko.js"));
    for (const c of manifest.content_scripts) if (!c.matches.some((m: string) => /SIPP|index\.php/.test(m))) expect(c.js).not.toContain("edoc-seret.js");
    expect(readFileSync(path.join(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8")).toContain('"edoc-seret.js"');
    const alat = bacaEks("panel-alat.js");
    expect((alat.match(/aleta-ecourt\\\/edoc\\\/baca-pdf\(\?:\[\?#\]\|\$\)\//g) ?? []).length).toBe(2);
  });
});
