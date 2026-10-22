// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { kehadiranUntukJendela } from "@/lib/kehadiran-rinci"; /* F3.2 */

import {
  cekTanggalSidang,
  dokumenJawaban,
  jadwalDariRincian,
  pesanGagalJendela,
  pilihSidang,
  ringkasPanggilan,
  susunUsulanTunda,
} from "@/lib/sipp-ide-jendela";

// Rute portal sipp-ide/jendela diuji dengan gerbang bot SUNGGUHAN (gatewayFetch,
// panggilBotJadwalSidang); hanya HTTP ke bot yang ditiru (botTiruan, bagian K).
vi.mock("@/server/db/client", async (asli) => ({ ...(await asli<typeof import("@/server/db/client")>()), getDatabase: async () => null }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async () => ({ id: "usr_uji", name: "Penguji", roleId: "role_admin" }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { handleRouteError } = await import("@/server/shared/http");
  return { handleAdminRouteError: (galat: unknown) => handleRouteError(galat) };
});

/**
 * ============================================================================
 * SIPP DENGAN IDE ALETA - GELOMBANG 2, JENDELA SIPP LAINNYA (Tahap M1, 16 Okt 2026)
 * ============================================================================
 *
 * ekstensi-sipp/sipp-ide-l1.js + sipp-ide-m1.js dijalankan SUNGGUHAN di jsdom
 * atas replika jendela SIPP 7.0.4 (bentuknya dari view aslinya:
 * jadwal_sidang_p_tunda.php, jadwal_sidang_p_edit.php, edit_putusan_sela.php,
 * form_add_rekonvensi.php, pelaksanaan_relaas_perdata.php, edit_pelaksanaan.php,
 * pihak_pertama.php, add_biaya_form.php, form_arsip_v.php - dicocokkan dengan
 * HTML 7.0.4 yang diambil dari SIPP setempat). Bahan Tunda disusun MESIN
 * PORTAL yang sama (usulanTundaSidang lewat susunUsulanTunda).
 *
 *   A. pengenal jendela lewat alamat simpan; L1 dipakai ulang
 *   B. Tunda/Edit Jadwal: isi kosong, tawarkan yang ragu, cek libur/sebelum/bentrok/5 bulan
 *   C. Putusan Sela, D. Rekonvensi, E. Relaas, F. Saksi Putusan, G. Jurnal (Kasir), H. Arsip
 *   I. Tampilan Lama, jaringan hanya saat tombol, tanpa tanda ALETA, manifest
 *   J. bahan portal (lib/sipp-ide-jendela.ts)
 */

const EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(EKSTENSI, n), "utf8").replace(/\r\n/g, "\n");
const L1 = baca("sipp-ide-l1.js");
const M1 = baca("sipp-ide-m1.js");
const NOMOR = "308/Pdt.G/2026/PA.Dgl";

type Jendela = any;
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 20));
  while (terbuka.length) terbuka.pop()!.window.close();
});

// ── Data perkara (bentuk jawaban GET /api/aleta-ecourt/sipp-ide/jendela) ────────
const SIDANG = [
  ["101", "2026-06-08", "Sidang Pertama", "mediasi tidak berhasil", 1],
  ["102", "2026-07-06", "Mendengarkan Hasil Mediasi", "Penggugat dan Tergugat Tidak Hadir", 4],
  ["103", "2026-07-22", "jawaban dan gugatan rekonvensi", "Replik dan Jawaban Rekonvensi", 1],
  ["104", "2026-08-26", "pembacaan putusan sela ", "Pembacaan putusan sela", 1],
  ["105", "2026-10-13", "Pembuktian Lanjutan Penggugat", "Pembuktian Lanjutan Penggugat", 1],
  ["106", "2026-10-21", "Pembuktian Tergugat", "", null],
] as const;
const RINCIAN = {
  perkaraId: "9806",
  nomorPerkara: NOMOR,
  jadwalPerkara: SIDANG.map(([sidangId, tanggalSidang, agenda, alasanDitunda, dihadiriOleh], i) => ({
    sidangId,
    tanggalSidang,
    jamSidang: "09:00:00",
    agenda,
    ruangan: "Ruang Sidang 1",
    ditunda: Boolean(alasanDitunda),
    alasanDitunda,
    urutanSidang: i + 1,
    dihadiriOleh,
    adaBas: false,
  })),
};
const JADWAL = jadwalDariRincian(RINCIAN);

function bahan(jendela: string, tambahan: Record<string, unknown> = {}): Record<string, any> {
  return {
    available: true,
    ok: true,
    jendela,
    nomorPerkara: NOMOR,
    perkaraId: "9806",
    jadwal: JADWAL,
    sidang: null,
    putusan: { sudahPutus: false, tanggalPutusan: "", tanggalMinutasi: "", tanggalBht: "" },
    panitera: [{ nama: "Siti Contoh, S.H." }],
    jurusita: [],
    relaas: [],
    ...tambahan,
  };
}

function buka(isi: string, opsi: { halaman?: string; jawab?: (u: URL) => unknown; status?: number; sebelum?: (w: Jendela) => void } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><head></head><body>${opsi.halaman ?? HALAMAN}<div id="popup_form" class="popup"><div id="form_pop">${isi}</div></div></body></html>`,
    { url: "http://127.0.0.1:8056/index.php/perkara_detil_agama/x", runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as Jendela;
  w.__minta = [] as string[];
  w.chrome = { storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, onChanged: { addListener() {} } } };
  w.fetch = async (alamat: string) => {
    const u = new URL(alamat, "http://127.0.0.1:8056");
    w.__minta.push(u.pathname + u.search);
    const d = opsi.jawab ? opsi.jawab(u) : {};
    return { ok: (opsi.status ?? 200) < 400, status: opsi.status ?? 200, json: async () => ({ data: d }) };
  };
  if (opsi.sebelum) opsi.sebelum(w);
  const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(L1, ctx, { filename: "sipp-ide-l1.js" });
  vm.runInContext(M1, ctx, { filename: "sipp-ide-m1.js" });
  return w;
}
const nilai = (w: Jendela, n: string) => (w.document.querySelector(`#form_pop [name="${n}"]`) as HTMLInputElement).value;
const ubah = (w: Jendela, n: string, v: string) => {
  const e = w.document.querySelector(`#form_pop [name="${n}"]`);
  e.value = v;
  e.dispatchEvent(new w.Event("change", { bubbles: true }));
};
const pita = (w: Jendela, kode: string) => w.document.querySelector(`.aleta-m1-pita[data-m1-jendela="${kode}"]`);
const p = (w: Jendela, sel: string) => w.document.querySelector(sel).__aletaM1;
const merah = '<span style="color:red">*</span>';

// ── Replika halaman & jendela 7.0.4 ────────────────────────────────────────
const HALAMAN = `<div id="tabs1"><table id="tableinfo"><tr><td id="first-child">Tanggal Pendaftaran </td><td colspan="2">Senin, 18 Mei. 2026</td></tr><tr><td id="first-child">Nomor Perkara</td><td>${NOMOR}</td></tr></table></div>`;

const TUNDA = (o: { alasan?: string } = {}) => `<div class="centering"><div id="tunda_jadwal_sidang"><div class="detil">
<form id="frm_tunda_jadwal_sidang" method="post" action="http://127.0.0.1:8056/jadwal_sidang_c/validateTunda"><table id="tableDetilPerkara">
<tr><td colspan="2"><strong>PENUNDAAN JADWAL SIDANG</strong></td></tr>
<tr><td colspan="2" class="divider">Informasi Jadwal Sidang Sebelumnya</td></tr>
<tr><td>Tanggal</td><td>Rabu, 21 Okt. 2026<input type='hidden' name='tglsidangsblm' id='tglsidangsblm' value='2026-10-21'></td></tr>
<tr><td>Jam Pelaksanaan${merah}</td><td><input id="jammulaisblm" name="jammulaisblm" class="timepicker" value="09:00" required>&nbsp;s/d&nbsp;<input id='jamselesaisblm' name='jamselesaisblm' value=""></td></tr>
<tr><td>Agenda${merah}</td><td><textarea name="agendasblm" id="agendasblm">Pembuktian Tergugat</textarea></td></tr>
<tr><td>Dihadiri Oleh</td><td><select name="dihadiri_olehsblm" id="dihadiri_olehsblm"><option value="1">Semua Pihak</option><option value="2">Penggugat Saja</option><option value="3">Tergugat Saja</option><option value="10">Sebagian Penggugat</option><option value="11">Sebagian Tergugat</option><option value="4">Para Pihak Tidak Hadir</option></select></td></tr>
<tr><td>Alasan Penundaan${merah}</td><td><textarea name="alasan_tunda" id="alasan_tunda" required>${o.alasan ?? ""}</textarea></td></tr>
<tr><td>Keterangan</td><td><textarea name="keterangan" id="keterangan"></textarea></td><input type="hidden" id='curr_date' value="16/10/2026"></tr>
<tr><td colspan="2" class="divider">Jadwal Sidang Berikutnya</td></tr>
<tr><td>Tanggal${merah}</td><td><input type="text" id="tgl_sidang" name="tgl_sidang" class="datepicker" required></td></tr>
<tr><td>Jam Pelaksanaan${merah}</td><td><input id="jammulai" name="jammulai" class="timepicker" required></td></tr>
<tr><td>Agenda${merah}</td><td><textarea name="agenda" id="agenda" required></textarea></td></tr>
<tr><td colspan="2" class="buttongroup"><input type="hidden" name="encjadwalsidang" value="ZW5j"><input type="hidden" name="enc" value="ZW5j">
<input type="button" id='close_tunda_jadwal_sidang' value="Kembali" class="btn"><input type="submit" id="simpan" value="Simpan" class="btn"></td></tr>
</table></form></div></div></div>`;

const EDIT = `<div class="centering"><form id="frm_edit_jadwal_sidang" method="post" action="http://127.0.0.1:8056/jadwal_sidang_c/validateEdit"><table id="tableDetilPerkara">
<tr><td>Tanggal${merah}</td><td><input type='text' id='tgl_sidang' name='tgl_sidang' class='datepicker' value='21/10/2026' required></td></tr>
<tr><td>Jam Pelaksanaan${merah}</td><td><input id="jammulai" name="jammulai" value="09:00">&nbsp;s/d&nbsp;<input id="jamselesai" name="jamselesai" value=""></td></tr>
<tr><td>Agenda${merah}</td><td><textarea name="agenda" id="agenda">Pembuktian Tergugat</textarea></td></tr>
<tr><td>Dihadiri Oleh</td><td><select name="dihadiri_oleh" id="dihadiri_oleh"><option value="1">Semua Pihak</option><option value="2">Penggugat Saja</option><option value="3">Tergugat Saja</option><option value="4">Para Pihak Tidak Hadir</option></select></td></tr>
<tr><td>Keterangan</td><td><input type="hidden" name="tgljsidangsblm" id="tgljsidangsblm" value="2026-10-13"><textarea name="keterangan" id="keterangan"></textarea></td></tr>
<tr><td colspan="2"><input type="submit" id="simpan" value="Simpan" class="btn"></td></tr></table></form></div>`;

/** SIPP mengisi Tanggal Putusan Sela jendela baru dengan HARI INI (dd/mm/yyyy). */
const HARI_INI_SIPP = (() => {
  const n = new Date();
  return `${String(n.getDate()).padStart(2, "0")}/${String(n.getMonth() + 1).padStart(2, "0")}/${n.getFullYear()}`;
})();
const SELA = (o: { tgl?: string; p1?: string } = {}) => `<form id="frm_sela" method="post" enctype="multipart/form-data" action="http://127.0.0.1:8056/managePutusanSela/validateInput"><table id="tableDetilPerkara">
<tr><td id="first-child">Tanggal Putusan Sela</td><td><input id="tgl_sela" name="tgl_sela" value="${o.tgl ?? HARI_INI_SIPP}" class="datepicker"></td></tr>
<tr><td id="first-child">Hasil Putusan Sela </td><td><select name="is_keberatan" id="is_keberatan"><option value="">Pilih</option><option value="1">Diterima</option><option value="2">Ditolak</option></select></td></tr>
<tr><td id="first-child">Amar Putusan Sela</td><td id="amar_text"><select id="template_amar_Sela"><option value=''>Pilih amar</option></select><textarea name="amar" id="amar" style="display:none"></textarea><div id="cke_amar"><iframe></iframe></div></td></tr>
<tr><td id="first-child">Pemberitahuan Putusan Sela Kepada Penggugat</td><td><input id="tgl_pihak1" name="tgl_pihak1" value="${o.p1 ?? ""}" class="datepicker"></td></tr>
<tr><td id="first-child">Pemberitahuan Putusan Sela Kepada Tergugat</td><td><input id="tgl_pihak2" name="tgl_pihak2" value="" class="datepicker"></td></tr>
<tr><td><input type="hidden" id="enc" name="enc" value="ZW5j"><input type="hidden" id="act" name="act" value="add"><input type="submit" id="simpan" value="Simpan" class="btn"></td></tr></table></form>`;

const REKONVENSI = `<form id="frm_rekonvensi" method="post" action="http://127.0.0.1:8056/rekonv_validate_input/val"><table id="tableDetilPerkara">
<tr><td id="first-child">Tanggal Pendaftaran Rekonvensi<font color="red">*</font></td><td><input id="tgl_pendaftaran" name="tgl_pendaftaran" value="" class="datepicker"></td></tr>
<tr><td id="first-child" colspan="3" class="divider">Pihak Rekonvensi</td></tr>
<tr><td id="first-child" rowspan="3">Penggugat Rekonvensi</td></tr>
<tr><td><input status="ck_pihak2" id="ck_pihak_35049" value="35049_2" name="para_pihak2[]" class="checkbox_status" type="checkbox" >AHMAD CONTOH BIN FULAN</br></td><td class="st_pihak2" id="st_ck_pihak_35049"><select name="pihak_35049" id="pihak_35049"><option value="1">Tergugat</option></select></td></tr>
<tr><td><input status="ck_pihak2" id="ck_pihak_35203" value="35203_4" name="para_pihak2[]" class="checkbox_status" type="checkbox" >Badan Contoh Kabupaten</br></td><td class="st_pihak2" id="st_ck_pihak_35203"><select name="pihak_35203" id="pihak_35203"><option value="1">Turut Tergugat</option></select></td></tr>
<tr><td id="first-child" rowspan="2">Tergugat Rekonvensi</td></tr>
<tr><td><input status="ck_pihak1" id="ck_pihak_35048" value="35048" name="para_pihak1[]" class="checkbox_status" type="checkbox" >SITI CONTOH BINTI FULAN</br></td><td class="st_pihak1" id="st_ck_pihak_35048"><select name="pihak_35048" id="pihak_35048"><option value="1">Penggugat</option></select></td></tr>
<tr><td id="first-child">Isi Petitum</td><td><textarea name="isi_petitum" id="isi_petitum"></textarea></td></tr>
<tr><td><input type="hidden" id="enc" name="enc" value="ZW5j"><input id="simpan" class="btn" type="submit" value="Simpan"></td></tr></table></form>`;

const RELAAS_DAFTAR = `<div class="centering"><div id='keterangan_saksi'><div class="cssTable"><table id='tableDetilPerkara'><tbody><tr><td colspan="2"><strong>PELAKSANAAN PANGGILAN / RELAAS</strong></td></tr></table>
<div style="float:left;">Tanggal Sidang : Senin, 08 Jun. 2026|15<br>Agenda Sidang  : Sidang Pertama</div><div style="float:right;">Panitera Pengganti : Siti Contoh, S.H.</div>
<div><br><div id="divpelaks_relaas"><table id="pelaks_relaas" class="table"><tr><th>No.</th><th>Pihak</th><th>Status Pihak</th><th>Pelaksanaan</th><th>Dokumen Relaas</th></tr>
<tr><td id='data_id1'>1</td><td id='r_pihak1'>SITI CONTOH BINTI FULAN</td><td id='r_spihak1'>Penggugat</td><td class='pelaksanaan' id='r_pelaks1'><br><b>Tanggal Pelaksanaan Relaas</b> : <br></td><td id='r_upload1'>Dokumen Belum Ada</td></tr>
<tr><td id='data_id2'>2</td><td id='r_pihak2'>AHMAD CONTOH BIN FULAN</td><td id='r_spihak2'>Tergugat</td><td class='pelaksanaan' id='r_pelaks2'><b>Surat Tercatat</b><br><b>Tanggal Pelaksanaan Relaas</b> : 02/06/2026<br></td><td id='r_upload2'>Dokumen Belum Ada</td></tr>
<tr><td id='data_id3'>3</td><td id='r_pihak3'>Advokat Contoh, S.H.</td><td id='r_spihak3'>Kuasa Hukum Penggugat</td><td class='pelaksanaan' id='r_pelaks3'><b>Elektronik</b></td><td id='r_upload3'>Dokumen Belum Ada</td></tr>
</table></div></div><div style="text-align:center;"><input type="button" id="close_hasil_relaas" value="Tutup" class="btn btn-danger"></div></div></div></div>`;

const RELAAS_ISI = `<div class="centering"><div id='pihak_pilih'><div class="detil"><form id="frm_relaas" method="post" enctype="multipart/form-data">
<input type="hidden" name="enc" value="ZW5j"><input type="hidden" name="encpihak" value="ZW5j"><input type="hidden" name="encsidang" value="ZW5j">
<table id="tableDetilPerkara"><tbody><tr><td colspan="2"><font>Isi/Edit Pelaksanaan Relaas<br>Pihak: SITI CONTOH BINTI FULAN<br>Tanggal Sidang: 2026-06-08</font></td></tr>
<tr><td>Bertemu/tidak</td><td><select name='bertemu' id='bertemu'><option value=''>- pilih -</option><option value='Y'>Bertemu</option><option value='T'>Tidak Bertemu</option><option value='E'>Panggilan Elektronik</option><option value='S'>Surat Tercatat POS</option></select></td></tr>
<tr class="pos" style="display:none"><td>No Resi POS</td><td><input name='resi_pos' id='resi_pos' type='text'></td></tr>
<tr><td>Tanggal Pelaksanaan Relaas</td><td><input name='tgl_relaas' value='' id='tgl_relaas' type='text' class='datepicker'></td></tr>
<tr><td>Keterangan</td><td><textarea name="ket_relaas"></textarea></td></tr>
<tr><td><input type="submit" value="simpan" id="simpan" class="btn tutups"></td></tr></table></form></div></div></div>`;

const SAKSI = (o: { tersembunyi?: boolean } = {}) => `<form id="frm_user" method="post" action="http://127.0.0.1:8056/addPihak/validateInput"><table id="tableDetilPerkara">
<tr><td>Pihak <font color="red">*</font></td><td><input type="text" id='pihak' name='pihak' value="Saksi" readonly="readonly"></td></tr>
<tr ${o.tersembunyi ? "hidden" : ""}><td>Saksi Putusan<font color="red">*</font></td><td><select name="is_sela" id="is_sela"><option value="-1">- Pilih Salah Satu -</option><option value="0">Akhir</option><option value="1">Sela</option></select></td></tr>
<tr><td>Nama Lengkap <font color="red">*</font></td><td><input type="text" id="fullname" name="fullname" value=""></td></tr>
<tr><td><input type="submit" id="simpan" value="Simpan" class="btn"></td></tr></table></form>`;

const BIAYA = (o: { idbiaya?: string; jenis?: string } = {}) => `<table><tr><td bgcolor='#008C4B'><font color='#fff'>Nomor Perkara</td><td>${NOMOR}</td></tr></table>
<form id="frm_add_biaya" method="post" action="http://127.0.0.1:8056/detil_biaya/validateInput"><table>
<tr><td>Tanggal Transaksi</td><td><input id="tgl_transaksi" name="tgl_transaksi" value="16/10/2026" class="datepicker"></td></tr>
<tr><td>Pihak Ke</td><td><select name="fpihak_ke" id="fpihak_ke"><option value="">Pilih Pihak Pembayar</option><option value="1">Penggugat</option><option value="2">Tergugat</option></select></td></tr>
<tr><td>Pihak yang membayar</td><td><select name="pihak_pembayar" id="pihak_pembayar"><option value="">Pilih Nama Pihak</option><option class="jpembayar" id="1" value="35048">SITI</option><option class="jpembayar" id="2" value="35049">AHMAD</option></select></td></tr>
<tr><td>Kategori Biaya</td><td><select name="kategori_biaya" id="kategori_biaya"><option value="">Pilih Kategori Biaya</option><option value="1">Panjar</option><option value="4">Panggilan</option></select></td></tr>
<tr><td>Jenis Biaya</td><td><select name="jenis_biaya" id="jenis_biaya"><option value="">Pilih Jenis Biaya</option><option class="jBiaya" id="1" jmlbiaya="0" value="1" ${o.jenis === "1" ? "selected" : ""}>Panjar Biaya Perkara</option><option class="jBiaya" id="4" jmlbiaya="0" value="12">Biaya Panggilan Tergugat</option></select></td></tr>
<tr class="rowJurusita"><td>Jurusita</td><td><select name="jurusita" id="jurusita"><option value=''>Pilih Jurusita</option><option value="7">Juru Sita Contoh</option></select></td></tr>
<tr><td>Uraian</td><td><textarea id="uraian" name="uraian"></textarea></td></tr>
<tr><td>Jumlah</td><td><input type="text" id="jumlah" name="jumlah" value="${o.jenis ? "250000" : ""}"></td></tr>
<tr><td>Keterangan</td><td><textarea id="keterangan" name="keterangan"></textarea></td></tr>
<tr><td><input type="hidden" id="idbiayaperkara" name="idbiayaperkara" value="${o.idbiaya ?? ""}"><input type="hidden" id="idperkara" name="idperkara" value="ZW5j"><input type="submit" id="simpan_btn" value="Simpan" class="btn"></td></tr></table></form>`;

const ARSIP = `<form id="frm_add_arsip" method="post" enctype="multipart/form-data" action="http://127.0.0.1:8056/manage_arsip_c/validateInputAddArsip"><table>
<tr><td id="first-child">Nomor Arsip</td><td><input type="text" id="nomor_arsip" name="nomor_arsip" value=""></td></tr>
<tr><td id="first-child">Nomor Perkara</td><td><input type="text" id="nomor_perkara" name="nomor_perkara" value=""></td></tr>
<tr><td id="first-child">Tanggal Masuk</td><td><input id="tgl_masuk_berkas" name="tgl_masuk_berkas" value="" class="datepicker"></td></tr>
<tr><td id="first-child">Staff yang Menyerahkan Berkas</td><td><input id="nama_penyerah" name="nama_penyerah" value=""></td></tr>
<tr><td id="first-child">Petugas yang Menerima Berkas</td><td><input id="nama_penerima" name="nama_penerima" value=""></td></tr>
<tr><td><input type="hidden" id="act" name="act" value="add"><input id="simpan" class="btn" type="submit" value="Simpan"></td></tr></table></form>`;

/** Bahan Tunda dari MESIN PORTAL (usulanTundaSidang) - riwayat 6 sidang, antrian: hanya Penggugat hadir. */
function bahanTunda(o: { antrian?: number } = {}) {
  const sidang = JADWAL.find((s) => s.tanggal === "2026-10-21")!;
  const t = susunUsulanTunda({
    keadaan: { jadwalId: 106, nomorPerkara: NOMOR, tanggalSidang: "2026-10-21", agenda: "Pembuktian Tergugat", dihadiriOleh: null, alurPerkaraId: 1, jenisPerkaraId: 347 },
    riwayat: {
      sidang: JADWAL.map((s) => ({ jadwalId: Number(s.sidangId), tanggal: s.tanggal, agenda: s.agenda, ditunda: s.ditunda, alasan: s.alasan, dihadiriOleh: s.dihadiriOleh, ikrar: false })),
      mediasi: { ada: true, selesai: true, berhasil: false },
    },
    antrian: o.antrian ? { dihadiriOleh: o.antrian } : null,
    kalender: [],
    kontak: null,
  });
  const cek = t.usulan ? cekTanggalSidang(t.usulan.tanggal, { jadwal: JADWAL, kecualiSidangId: "106", rekapHari: [{ tanggal: t.usulan.tanggal, jumlah: 31 }] }) : null;
  return bahan("tunda", { sidang, tunda: { ...t, cek } });
}

// ============================================================================
describe("A. pengenal jendela lewat alamat simpan; L1 dipakai ulang", () => {
  it("tiap jendela 7.0.4 dikenali dengan kodenya; id sama beralamat lain tidak", () => {
    const w = buka(`${TUNDA()}${EDIT}${SELA()}${REKONVENSI}${RELAAS_ISI}${SAKSI()}${BIAYA()}${ARSIP}`);
    const k = (id: string) => (w.aletaSippIdeM1.murni.kenaliJendela(w.document.querySelector(`#${id}`)) || {}).kode;
    expect(["frm_tunda_jadwal_sidang", "frm_edit_jadwal_sidang", "frm_sela", "frm_rekonvensi", "frm_relaas", "frm_user", "frm_add_biaya", "frm_add_arsip"].map(k)).toEqual([
      "tunda",
      "edit",
      "sela",
      "rekonvensi",
      "relaas",
      "saksi",
      "jurnal",
      "arsip",
    ]);
    const lain = w.document.createElement("form");
    lain.id = "frm_tunda_jadwal_sidang";
    lain.setAttribute("action", "http://127.0.0.1:8056/jadwal_mediasi_c/validateTunda");
    expect(w.aletaSippIdeM1.murni.kenaliJendela(lain)).toBeNull();
    // Form Putusan Akhir/Pemberitahuan/Minutasi (frm_putusan) milik L1, bukan M1.
    const putusan = w.document.createElement("form");
    putusan.id = "frm_putusan";
    putusan.setAttribute("action", "http://127.0.0.1:8056/managePutusanAkhir/validateInputPemberitahuan");
    expect(w.aletaSippIdeM1.murni.kenaliJendela(putusan)).toBeNull();
  });

  it("pita tepat di atas form, penghitung memakai hitungKolom L1 (wajib = * merah SIPP)", () => {
    const w = buka(TUNDA());
    expect(w.aletaSippIdeM1.pasang(w.document)).toEqual({ pita: 1, relaas: 0 });
    const f = w.document.querySelector("#frm_tunda_jadwal_sidang");
    expect(f.previousElementSibling).toBe(pita(w, "tunda"));
    const h = w.aletaSippIdeL1.murni.hitungKolom(f);
    expect(pita(w, "tunda").querySelector('[data-m1="hitung"]').textContent).toBe(w.aletaSippIdeL1.murni.kalimatHitung(h));
    // Tujuh kolom bertanda * merah (jam mulai & selesai sidang sebelumnya satu baris).
    expect(h.wajib).toBe(7);
    // Chip kolom wajib kosong tepat sebelum Simpan, type=button tanpa name.
    const chip = f.querySelector('[data-m1="chip"]');
    expect(chip.nextElementSibling.id).toBe("simpan");
    expect(chip.type).toBe("button");
    expect(chip.getAttribute("name")).toBeNull();
    expect(chip.textContent).toBe(`${h.kosong.filter((k: { wajib: boolean }) => k.wajib).length} kolom wajib kosong`);
    expect(h.kosong.filter((k: { wajib: boolean }) => k.wajib).map((k: { label: string }) => k.label)).toEqual(["Jam Pelaksanaan", "Alasan Penundaan", "Tanggal", "Jam Pelaksanaan", "Agenda"]);
    // Pemasangan ulang tidak menggandakan.
    w.aletaSippIdeM1.pasang(w.document);
    expect(w.document.querySelectorAll(".aleta-m1-pita").length).toBe(1);
  });
});

// ============================================================================
describe("B. Tunda & Edit Jadwal Sidang", () => {
  it("Isi dengan ALETA: usulan mesin portal mengisi kolom KOSONG; kehadiran antrian hanya ditawarkan", async () => {
    const data = bahanTunda({ antrian: 2 });
    const w = buka(TUNDA(), { jawab: () => data });
    w.aletaSippIdeM1.pasang(w.document);
    const r = await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_tunda_jadwal_sidang"));
    expect(w.__minta).toEqual([`/aleta/api/aleta-ecourt/sipp-ide/jendela?jendela=tunda&nomor=${encodeURIComponent(NOMOR)}&tanggal=2026-10-21`]);
    const u = data.tunda.usulan!;
    expect(u.alasan).toBeTruthy();
    expect(nilai(w, "alasan_tunda")).toBe(u.alasan);
    expect(nilai(w, "agenda")).toBe(u.agenda);
    expect(nilai(w, "tgl_sidang")).toBe(`${u.tanggal.slice(8)}/${u.tanggal.slice(5, 7)}/${u.tanggal.slice(0, 4)}`);
    expect(nilai(w, "jammulai")).toBe(u.jam);
    expect(r).toEqual({ diisi: 4, sama: 0, tawar: 1, gagal: 0 });
    expect(nilai(w, "dihadiri_olehsblm")).toBe("1");
    w.document.querySelector('[data-m1-usulan="hadir"] [data-m1="pakai"]').click();
    expect(nilai(w, "dihadiri_olehsblm")).toBe("2");
    expect(pita(w, "tunda").querySelector('[data-m1="kabar"]').textContent).toMatch(/4 kolom diisi ALETA · 1 usulan perlu Anda periksa.*Simpan tetap Anda yang menekan/);
  });

  it("F3.2: kehadiran rinci per orang dipakai lebih dulu; siapa dan jamnya tertulis", async () => {
    const data = bahanTunda({ antrian: 2 });
    (data.tunda as Record<string, unknown>).kehadiranRinci = kehadiranUntukJendela(
      [{ id: "b", peran: "tergugat", sebagaiKuasa: true, jam: "09:10", nama: "Budi, S.H." }],
      null,
      { sebutanSatu: "Penggugat", sebutanDua: "Tergugat" }
    );
    const w = buka(TUNDA(), { jawab: () => data });
    w.aletaSippIdeM1.pasang(w.document);
    await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_tunda_jadwal_sidang"));
    const baris = w.document.querySelector('[data-m1-usulan="hadir"]').textContent;
    // Rinci (kuasa Tergugat saja = 3) mengalahkan kolom antrian (2).
    expect(baris).toMatch(/Pihak kedua saja/);
    expect(baris).toMatch(/kuasa Tergugat 09\.10/);
    expect(baris).toMatch(/Penggugat belum · Kuasa Tergugat hadir 09\.10/);
    w.document.querySelector('[data-m1-usulan="hadir"] [data-m1="pakai"]').click();
    expect(nilai(w, "dihadiri_olehsblm")).toBe("3");
  });

  it("isian petugas tidak ditimpa; tanggal usulan yang jatuh pada libur hanya ditawarkan", async () => {
    const data = bahanTunda();
    data.tunda.usulan = { ...data.tunda.usulan!, tanggal: "2026-12-25", tanggalPasti: false };
    data.tunda.cek = cekTanggalSidang("2026-12-25", { jadwal: JADWAL });
    const w = buka(TUNDA({ alasan: "Tergugat minta waktu" }), { jawab: () => data });
    w.aletaSippIdeM1.pasang(w.document);
    await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_tunda_jadwal_sidang"));
    expect(nilai(w, "alasan_tunda")).toBe("Tergugat minta waktu");
    expect(nilai(w, "tgl_sidang")).toBe("");
    const baris = w.document.querySelector('[data-m1-usulan="tanggal"]').textContent;
    expect(baris).toMatch(/libur: Natal/);
    expect(baris).toMatch(/hari kerja terdekat Senin, 28 Des 2026/);
  });

  it("cek lokal tanggal berikut: Sabtu/libur, tidak sesudah sidang sebelumnya, bentrok, lewat 5 bulan (SEMA 2/2014)", async () => {
    const w = buka(TUNDA(), { jawab: () => bahanTunda() });
    w.aletaSippIdeM1.pasang(w.document);
    const cek = () => pita(w, "tunda").querySelector('[data-m1="cek"]').textContent;
    ubah(w, "tgl_sidang", "24/10/2026");
    expect(cek()).toMatch(/jatuh pada hari Sabtu/);
    ubah(w, "tgl_sidang", "20/10/2026");
    expect(cek()).toMatch(/Tidak sesudah sidang sebelumnya \(Rabu, 21 Okt 2026\)/);
    expect(cek()).toMatch(/Melewati 5 bulan sejak pendaftaran \(Senin, 18 Mei 2026; batas Minggu, 18 Okt 2026\)/);
    // Bentrok baru terbaca sesudah jadwal perkara dimuat.
    await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_tunda_jadwal_sidang"));
    ubah(w, "tgl_sidang", "13/10/2026");
    expect(cek()).toMatch(/sudah punya sidang pada Selasa, 13 Okt 2026/);
  });

  it("Edit Jadwal: tanggal awal dipakai mencari sidang, kehadiran antrian ditawarkan, agenda yang sama tidak diubah", async () => {
    const data = bahan("edit", { sidang: JADWAL[5], tunda: { usulan: null, kehadiranAntrian: 3, cek: null } });
    const w = buka(EDIT, { jawab: () => data });
    w.aletaSippIdeM1.pasang(w.document);
    ubah(w, "tgl_sidang", "22/10/2026");
    const r = await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_edit_jadwal_sidang"));
    expect(w.__minta[0]).toMatch(/jendela=edit&.*tanggal=2026-10-21$/);
    expect(r).toEqual({ diisi: 0, sama: 1, tawar: 1, gagal: 0 });
    expect(nilai(w, "dihadiri_oleh")).toBe("1");
    ubah(w, "tgl_sidang", "12/10/2026");
    expect(pita(w, "edit").querySelector('[data-m1="cek"]').textContent).toMatch(/Tidak sesudah sidang sebelumnya \(Selasa, 13 Okt 2026\)/);
  });
});

// ============================================================================
describe("C. Putusan Sela", () => {
  it("tanggal bawaan SIPP (hari ini) tidak ditimpa; pemberitahuan pihak yang HADIR = tanggal putusan sela, diisi pasti", async () => {
    const w = buka(SELA(), { jawab: () => bahan("sela") });
    w.aletaSippIdeM1.pasang(w.document);
    expect(pita(w, "sela").querySelector('[data-m1="penjelas"]').textContent).toMatch(/Pilih amar/);
    const r = await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_sela"));
    expect(nilai(w, "tgl_sela")).toBe(HARI_INI_SIPP);
    // Keputusan pengguna 16 Okt malam: pihak yang hadir saat dibacakan diberitahu pada hari itu juga.
    expect(r).toEqual({ diisi: 2, sama: 0, tawar: 1, gagal: 0 });
    expect([nilai(w, "tgl_pihak1"), nilai(w, "tgl_pihak2")]).toEqual(["26/08/2026", "26/08/2026"]);
    const t = (Array.from(w.document.querySelectorAll("[data-m1-usulan]")) as Element[]).map((x) => x.getAttribute("data-m1-usulan"));
    expect(t).toEqual(["tgl_sela", "tgl_pihak1", "tgl_pihak2"]);
    expect(w.document.querySelector('[data-m1-usulan="tgl_pihak2"]').textContent).toMatch(/Rabu, 26 Agu 2026.*hadir saat putusan sela dibacakan \(Semua Pihak\).*Diisi ALETA/);
    w.document.querySelector('[data-m1-usulan="tgl_sela"] [data-m1="pakai"]').click();
    expect(nilai(w, "tgl_sela")).toBe("26/08/2026");
  });

  it("butir 58 (17 Okt): perkara NON-e-Court juga - pemberitahuan pihak hadir = tanggal baca, diisi pasti", async () => {
    for (const lewatEcourt of [false, true]) {
      const w = buka(SELA(), { jawab: () => bahan("sela", { lewatEcourt }) });
      w.aletaSippIdeM1.pasang(w.document);
      const r = await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_sela"));
      expect(r.diisi, `lewatEcourt=${lewatEcourt}`).toBe(2);
      expect([nilai(w, "tgl_pihak1"), nilai(w, "tgl_pihak2")]).toEqual(["26/08/2026", "26/08/2026"]);
    }
    // Penjaga: aturannya tidak bersyarat jalur pendaftaran.
    const sumber = readFileSync(path.join(EKSTENSI, "sipp-ide-m1.js"), "utf8");
    const mulai = sumber.indexOf("function usulanSela(data, form) {");
    expect(sumber.slice(mulai, sumber.indexOf("\n  }", mulai))).not.toMatch(/ecourt|eCourt|elektronik/i);
  });

  it("hanya pihak yang hadir: kehadiran Penggugat saja -> hanya Penggugat; Sebagian/tidak hadir -> tidak diisi; isian petugas tidak ditimpa", async () => {
    const dengan = (hadir: number | null) =>
      bahan("sela", { jadwal: JADWAL.map((s) => (/putusan sela/.test(s.agenda) ? { ...s, dihadiriOleh: hadir } : s)) });
    const w = buka(SELA(), { jawab: () => dengan(2) });
    w.aletaSippIdeM1.pasang(w.document);
    await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_sela"));
    expect([nilai(w, "tgl_pihak1"), nilai(w, "tgl_pihak2")]).toEqual(["26/08/2026", ""]);
    for (const hadir of [4, 10, null]) {
      const w2 = buka(SELA(), { jawab: () => dengan(hadir) });
      w2.aletaSippIdeM1.pasang(w2.document);
      await w2.aletaSippIdeM1.isiDenganAleta(p(w2, "#frm_sela"));
      expect([nilai(w2, "tgl_pihak1"), nilai(w2, "tgl_pihak2")]).toEqual(["", ""]);
    }
    const w3 = buka(SELA({ p1: "28/08/2026" }), { jawab: () => dengan(1) });
    w3.aletaSippIdeM1.pasang(w3.document);
    await w3.aletaSippIdeM1.isiDenganAleta(p(w3, "#frm_sela"));
    expect([nilai(w3, "tgl_pihak1"), nilai(w3, "tgl_pihak2")]).toEqual(["28/08/2026", "26/08/2026"]);
  });

  it("tanggal bawaan SIPP + pemberitahuan = usulan ALETA: TANPA merah palsu, tanda kuning di kolom Tanggal Putusan Sela; Pakai menghapus tanda", async () => {
    const w = buka(SELA(), { jawab: () => bahan("sela") });
    w.aletaSippIdeM1.pasang(w.document);
    const f = w.document.querySelector("#frm_sela");
    const cek = () => pita(w, "sela").querySelector('[data-m1="cek"]');
    const saran = () => f.querySelector('[data-m1="saran-sela"]');
    expect(saran()).toBeNull(); // sebelum data ALETA dibaca tidak ada usulan
    await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_sela"));
    expect(nilai(w, "tgl_pihak1")).toBe("26/08/2026");
    expect(cek().querySelector(".aleta-m1-merah")).toBeNull();
    expect(cek().textContent).not.toMatch(/Tidak ada sidang perkara ini/);
    expect(saran().previousElementSibling).toBe(f.querySelector('[name="tgl_sela"]'));
    expect(saran().textContent).toBe("ALETA mengusulkan Rabu, 26 Agu 2026 - tekan Pakai Pakai");
    expect((saran().querySelector("button") as HTMLButtonElement).type).toBe("button");
    // Pemberitahuan yang BENAR-BENAR lebih awal dari tanggal usulan tetap merah.
    ubah(w, "tgl_pihak2", "25/08/2026");
    expect(cek().querySelector(".aleta-m1-merah").textContent).toBe("Pemberitahuan Putusan Sela Kepada Tergugat: lebih awal dari tanggal putusan sela.");
    ubah(w, "tgl_pihak2", "26/08/2026");
    expect(cek().querySelector(".aleta-m1-merah")).toBeNull();
    saran().querySelector("button").click();
    expect(nilai(w, "tgl_sela")).toBe("26/08/2026");
    expect(saran()).toBeNull();
    expect(cek().textContent).toBe("");
  });

  it("urutan tanggal: pemberitahuan sebelum putusan sela merah; tanggal tanpa sidang kuning", async () => {
    const w = buka(SELA({ tgl: "26/08/2026", p1: "20/08/2026" }), { jawab: () => bahan("sela") });
    w.aletaSippIdeM1.pasang(w.document);
    await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_sela"));
    const cek = () => pita(w, "sela").querySelector('[data-m1="cek"]');
    expect(cek().querySelector(".aleta-m1-merah").textContent).toBe("Pemberitahuan Putusan Sela Kepada Penggugat: lebih awal dari tanggal putusan sela.");
    ubah(w, "tgl_sela", "27/08/2026");
    expect(cek().textContent).toMatch(/Tidak ada sidang perkara ini pada Kamis, 27 Agu 2026/);
  });
});

// ============================================================================
describe("D. Rekonvensi (I06, W92)", () => {
  it("penjelas bersilang + peringatan; centang hanya pihak satu-satunya (bukan Turut Tergugat); tanggal dari e-Court", async () => {
    const data = bahan("rekonvensi", { jawabanEcourt: dokumenJawaban([{ judulDokumen: "Jawaban dan Gugatan Rekonvensi", tanggalSidang: "2026-07-22T00:00:00.000Z", diunggahPada: "2026-07-21" }]) });
    const w = buka(REKONVENSI, { jawab: () => data });
    w.aletaSippIdeM1.pasang(w.document);
    const pt = pita(w, "rekonvensi");
    expect(pt.querySelector('[data-m1="penjelas"]').textContent).toMatch(/Tergugat konvensi menjadi Penggugat rekonvensi/);
    expect(pt.querySelector('[data-m1="cek"]').textContent).toMatch(/Belum ada Penggugat Rekonvensi.*Belum ada Tergugat Rekonvensi/);
    let klik = 0;
    w.document.querySelector("#frm_rekonvensi").addEventListener("click", (e: Event) => {
      if ((e.target as Element).classList.contains("checkbox_status")) klik += 1;
    });
    const r = await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_rekonvensi"));
    expect(r).toEqual({ diisi: 3, sama: 0, tawar: 0, gagal: 0 });
    const c = (id: string) => (w.document.querySelector(`#ck_pihak_${id}`) as HTMLInputElement).checked;
    expect([c("35049"), c("35048"), c("35203")]).toEqual([true, true, false]);
    expect(klik).toBe(2); // lewat klik: penangan .checkbox_status SIPP ikut berjalan
    expect(nilai(w, "tgl_pendaftaran")).toBe("22/07/2026");
    expect(pt.querySelector('[data-m1="cek"]').textContent).toBe("");
  });

  it("tanpa dokumen e-Court: sidang berangenda jawaban + rekonvensi hanya ditawarkan", async () => {
    const w = buka(REKONVENSI, { jawab: () => bahan("rekonvensi", { jawabanEcourt: [] }) });
    w.aletaSippIdeM1.pasang(w.document);
    await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_rekonvensi"));
    expect(nilai(w, "tgl_pendaftaran")).toBe("");
    expect(w.document.querySelector('[data-m1-usulan="tgl"]').textContent).toMatch(/Rabu, 22 Jul 2026.*jawaban dan gugatan rekonvensi/);
  });
});

// ============================================================================
describe("E. Relaas", () => {
  const PANGGILAN = ringkasPanggilan({
    panggilan: {
      pihak: [
        { nama: "SITI CONTOH BINTI FULAN", peran: "Penggugat", seharusnya: "elektronik", eSummonsTerkirim: true, tanggalPanggilan: "2026-06-02", kepatutan: { dinilai: true, patut: true, selisih: 3, ambang: 3, hariKerja: true, dasarHukum: "Pasal 146 RBg" } },
        { nama: "AHMAD CONTOH BIN FULAN", peran: "Tergugat", seharusnya: "surat_tercatat", eSummonsTerkirim: false, tanggalPanggilan: "2026-05-25", kepatutan: { dinilai: true, patut: false, alasan: "relaas kembali", dasarHukum: "PERMA 7/2022", selisih: 3, ambang: 3, hariKerja: true } },
      ],
    },
  });

  it("daftar pelaksanaan: tanggal kepala berekor |alur terbaca; P/T diberi keterangan kepatutan, kuasa tidak", async () => {
    const w = buka(RELAAS_DAFTAR, { jawab: () => bahan("relaas", { sidang: JADWAL[0], panggilan: PANGGILAN }) });
    expect(w.aletaSippIdeM1.pasang(w.document)).toEqual({ pita: 0, relaas: 1 });
    const t = w.document.querySelector("#pelaks_relaas");
    expect(t.closest("#divpelaks_relaas").previousElementSibling.getAttribute("data-m1-jendela")).toBe("relaas-daftar");
    expect(w.__minta).toEqual([]);
    const r = await w.aletaSippIdeM1.periksaRelaas(t.__aletaM1);
    expect(w.__minta[0]).toBe(`/aleta/api/aleta-ecourt/sipp-ide/jendela?jendela=relaas&nomor=${encodeURIComponent(NOMOR)}&tanggal=2026-06-08`);
    expect(r).toEqual({ n: 2, patut: 1, tidak: 1, belum: 0, lain: 1 });
    const l1 = w.document.querySelector("#r_pelaks1 .aleta-m1-relaas");
    expect(l1.querySelector(".aleta-m1-tanda").className).toBe("aleta-m1-tanda aleta-m1-tanda-hijau");
    expect(l1.querySelector(".aleta-m1-tanda").textContent).toBe("Patut menurut ALETA");
    expect(l1.querySelector(".aleta-m1-tanda .aleta-m1-i").title).toBe("Menurut ALETA panggilan pihak ini patut.");
    expect(l1.textContent).toBe("Patut menurut ALETA3 hari kerja sebelum sidang; saluran elektronik");
    const l2 = w.document.querySelector("#r_pelaks2 .aleta-m1-relaas");
    expect(l2.querySelector(".aleta-m1-tanda-merah").textContent).toBe("Tidak patut menurut ALETA");
    expect(l2.textContent).toMatch(/relaas kembali \(PERMA 7\/2022\); saluran seharusnya surat tercatat$/);
    expect(w.document.querySelector("#r_pelaks3 .aleta-m1-relaas")).toBeNull();
  });

  it("daftar pelaksanaan: HASIL panggilan dari aturan bersama (SEMA 1/2023 / Pasal 718 RBg), retur beserta sebabnya", async () => {
    const sidangId = String(JADWAL[0].sidangId);
    const relaas = [
      { namaPihak: "SITI CONTOH BINTI FULAN", sidangId, kepatutan: { label: "Bertemu (elektronik)", warna: "hijau", keterangan: "Panggilan elektronik.", dasar: "SK KMA 363", retur: false, labelRetur: "" } },
      {
        namaPihak: "AHMAD CONTOH BIN FULAN",
        sidangId,
        kepatutan: { label: "Bertemu orang serumah (ayah kandung)", warna: "hijau", keterangan: "Diterima orang serumah.", dasar: "SEMA 1/2023 angka 3, 6 & 12 huruf c", retur: false, labelRetur: "" },
      },
      // Relaas sidang LAIN tidak dipakai.
      { namaPihak: "AHMAD CONTOH BIN FULAN", sidangId: "lain", kepatutan: { label: "Retur", warna: "merah", retur: true, labelRetur: "Retur pos" } },
    ];
    const w = buka(RELAAS_DAFTAR, { jawab: () => bahan("relaas", { sidang: JADWAL[0], panggilan: PANGGILAN, relaas }) });
    w.aletaSippIdeM1.pasang(w.document);
    await w.aletaSippIdeM1.periksaRelaas(w.document.querySelector("#pelaks_relaas").__aletaM1);
    const l2 = w.document.querySelector("#r_pelaks2 .aleta-m1-relaas");
    const tanda = l2.querySelectorAll(".aleta-m1-tanda");
    expect(tanda[0].textContent).toBe("Bertemu orang serumah (ayah kandung)");
    expect(tanda[0].className).toBe("aleta-m1-tanda aleta-m1-tanda-hijau");
    expect(tanda[0].title).toBe("Diterima orang serumah. Dasar: SEMA 1/2023 angka 3, 6 & 12 huruf c.");
    expect(l2.textContent).not.toMatch(/Tidak Bertemu|Retur pos/);

    const retur = [{ namaPihak: "AHMAD CONTOH BIN FULAN", sidangId, kepatutan: { label: "Alamat tidak ditemukan", warna: "merah", keterangan: "Alamat pihak tidak ditemukan.", dasar: "SEMA 1/2023 angka 9, 10 & 12 huruf e", retur: true, labelRetur: "Retur - alamat tidak ditemukan (SEMA 1/2023 angka 12 huruf e)" } }];
    const w2 = buka(RELAAS_DAFTAR, { jawab: () => bahan("relaas", { sidang: JADWAL[0], panggilan: PANGGILAN, relaas: retur }) });
    w2.aletaSippIdeM1.pasang(w2.document);
    await w2.aletaSippIdeM1.periksaRelaas(w2.document.querySelector("#pelaks_relaas").__aletaM1);
    const t2 = w2.document.querySelectorAll("#r_pelaks2 .aleta-m1-relaas .aleta-m1-tanda");
    expect(t2[0].textContent).toBe("Retur - alamat tidak ditemukan (SEMA 1/2023 angka 12 huruf e)");
    expect(t2[0].className).toBe("aleta-m1-tanda aleta-m1-tanda-merah");
    // Lencana kepatutan tenggang yang lama tetap ada (fitur lama tidak dikurangi).
    expect(t2[1].textContent).toBe("Tidak patut menurut ALETA");
  });

  it("isi pelaksanaan: e-Summons tercatat -> Panggilan Elektronik + tanggalnya; hari kerja sebelum sidang diperiksa", async () => {
    const w = buka(RELAAS_ISI, { jawab: () => bahan("relaas", { sidang: JADWAL[0], panggilan: PANGGILAN }) });
    w.aletaSippIdeM1.pasang(w.document);
    await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_relaas"));
    expect(w.__minta[0]).toMatch(/jendela=relaas&.*tanggal=2026-06-08$/);
    expect(nilai(w, "bertemu")).toBe("E");
    expect(nilai(w, "tgl_relaas")).toBe("02/06/2026");
    const cek = () => pita(w, "relaas").querySelector('[data-m1="cek"]').textContent;
    expect(cek()).toBe("3 hari kerja di antara pelaksanaan dan hari sidang.");
    ubah(w, "tgl_relaas", "04/06/2026");
    expect(cek()).toBe("1 hari kerja sebelum sidang - kurang dari 3 hari kerja (Pasal 146 RBg).");
    ubah(w, "tgl_relaas", "09/06/2026");
    expect(cek()).toMatch(/sesudah hari sidang/);
  });
});

// ============================================================================
describe("F. Saksi Putusan (is_sela, baru di 7.0.4)", () => {
  it("tanpa acara putusan sela -> Akhir diisi; -1 diperingatkan sebelumnya", async () => {
    const tanpaSela = JADWAL.filter((s) => !/sela/i.test(s.agenda));
    const w = buka(SAKSI(), { jawab: () => bahan("saksi", { jadwal: tanpaSela }) });
    w.aletaSippIdeM1.pasang(w.document);
    expect(pita(w, "saksi").querySelector('[data-m1="cek"]').textContent).toMatch(/Saksi Putusan belum dipilih/);
    await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_user"));
    expect(nilai(w, "is_sela")).toBe("0");
    expect(pita(w, "saksi").querySelector('[data-m1="cek"]').textContent).toBe("");
  });

  it("putusan sela sudah dibacakan -> Akhir hanya ditawarkan; baris tersembunyi (non-PA) tidak dipasangi", async () => {
    const w = buka(SAKSI(), { jawab: () => bahan("saksi") });
    w.aletaSippIdeM1.pasang(w.document);
    await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_user"));
    expect(nilai(w, "is_sela")).toBe("-1");
    expect(w.document.querySelector('[data-m1-usulan="is_sela"]').textContent).toMatch(/Akhir.*putusan sela sudah dibacakan Rabu, 26 Agu 2026/);
    const w2 = buka(SAKSI({ tersembunyi: true }));
    expect(w2.aletaSippIdeM1.pasang(w2.document).pita).toBe(0);
  });

  it("Simpan dengan -1 ditanyakan dulu; Batal menahan kiriman, Ya meneruskan", () => {
    const w = buka(SAKSI());
    w.document.addEventListener("submit", w.aletaSippIdeM1.saatKirim, true);
    let jawab = false;
    let ditanya = 0;
    w.confirm = () => {
      ditanya += 1;
      return jawab;
    };
    const kirim = () => {
      const ev = new w.Event("submit", { bubbles: true, cancelable: true });
      w.document.querySelector("#frm_user").dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    expect(kirim()).toBe(true);
    jawab = true;
    expect(kirim()).toBe(false);
    ubah(w, "is_sela", "0");
    expect(kirim()).toBe(false);
    expect(ditanya).toBe(2);
  });

  it("pita L1 sudah ada di form Saksi -> M1 tanpa penghitung kedua", () => {
    const w = buka(SAKSI());
    const f = w.document.querySelector("#frm_user");
    f.__aletaL1 = { pita: w.document.body.appendChild(w.document.createElement("div")) };
    w.aletaSippIdeM1.pasang(w.document);
    expect(pita(w, "saksi").querySelector('[data-m1="hitung"]').textContent).toBe("");
  });
});

// ============================================================================
describe("G. Tambah Biaya - usulan Kasir yang sudah ada", () => {
  const KASIR = {
    available: true,
    ok: true,
    usulan: [
      { kunci: "u1", jenisBiayaId: 12, kategoriId: 4, pihakKe: 2, pihakId: 35049, uraian: "Biaya Panggilan Tergugat", jumlah: 75000, tanggal: "2026-10-13", jurusitaId: 7, peristiwa: "Panggilan ke-2 Tergugat", yakin: "tinggi", pilih: true },
      { kunci: "u2", jenisBiayaId: 12, kategoriId: 4, pihakKe: 2, pihakId: 35049, uraian: "Biaya Panggilan Tergugat", jumlah: 75000, tanggal: "2026-10-14", jurusitaId: 7, peristiwa: "Panggilan ke-3 Tergugat", yakin: "sedang", pilih: true },
      { kunci: "u3", jenisBiayaId: 1, kategoriId: 1, pihakKe: 1, pihakId: 35048, uraian: "Sisa", jumlah: 0, tanggal: "2026-10-14", pilih: true, sisaOtomatis: true },
    ],
  };
  const jawab = (u: URL) => (u.searchParams.get("cari") ? { available: true, ok: true, perkara: [{ perkaraId: 9806, nomorPerkara: NOMOR }] } : KASIR);

  it("nomor dari kepala jendela -> Kasir; transaksi pertama yang pasti masuk urut pihak -> kategori -> jenis -> uraian/jumlah", async () => {
    const w = buka(BIAYA(), { halaman: "", jawab });
    const urutan: string[] = [];
    w.document.querySelector("#frm_add_biaya").addEventListener("change", (e: Event) => urutan.push((e.target as HTMLInputElement).name));
    w.aletaSippIdeM1.pasang(w.document);
    const r = await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_add_biaya"));
    expect(w.__minta).toEqual([`/aleta/api/aleta-ecourt/sidang/kasir?cari=${encodeURIComponent(NOMOR)}`, "/aleta/api/aleta-ecourt/sidang/kasir?perkaraId=9806"]);
    expect(r).toEqual({ diisi: 1, sama: 0, tawar: 1, gagal: 0 });
    expect(["fpihak_ke", "pihak_pembayar", "kategori_biaya", "jenis_biaya", "uraian", "jumlah", "tgl_transaksi", "jurusita"].map((n) => nilai(w, n))).toEqual([
      "2",
      "35049",
      "4",
      "12",
      "Biaya Panggilan Tergugat",
      "75000",
      "13/10/2026",
      "7",
    ]);
    expect(urutan.slice(0, 4)).toEqual(["fpihak_ke", "pihak_pembayar", "kategori_biaya", "jenis_biaya"]);
    // Baris sisa bernilai 0 tidak diusulkan; yang berkeyakinan sedang ditawarkan.
    expect(w.document.querySelectorAll("[data-m1-usulan]").length).toBe(2);
    expect(w.document.querySelector('[data-m1-usulan="kasir-u2"]').textContent).toMatch(/keyakinan Kasir: sedang/);
  });

  it("jendela EDIT transaksi lama tidak diisi otomatis; akun tanpa hak Kasir mendapat kalimat jelas", async () => {
    const w = buka(BIAYA({ idbiaya: "ZW5j", jenis: "1" }), { halaman: "", jawab });
    w.aletaSippIdeM1.pasang(w.document);
    const r = await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_add_biaya"));
    expect(r.diisi).toBe(0);
    expect(nilai(w, "jenis_biaya")).toBe("1");
    const w2 = buka(BIAYA(), { halaman: "", status: 403 });
    w2.aletaSippIdeM1.pasang(w2.document);
    await w2.aletaSippIdeM1.isiDenganAleta(p(w2, "#frm_add_biaya"));
    expect(pita(w2, "jurnal").querySelector('[data-m1="kabar"]').textContent).toBe("Akun ALETA ini tidak berwenang membaca usulan jendela ini.");
  });
});

// ============================================================================
describe("H. Arsip", () => {
  it("tanpa Nomor Perkara tidak meminta apa pun; PP satu-satunya -> penyerah; tanggal BHT ditawarkan", async () => {
    const data = bahan("arsip", { putusan: { sudahPutus: true, tanggalPutusan: "2026-09-01", tanggalMinutasi: "2026-09-01", tanggalBht: "2026-09-16" } });
    const w = buka(ARSIP, { halaman: "", jawab: () => data });
    w.aletaSippIdeM1.pasang(w.document);
    await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_add_arsip"));
    expect(w.__minta).toEqual([]);
    expect(pita(w, "arsip").querySelector('[data-m1="kabar"]').textContent).toMatch(/Isi Nomor Perkara dulu/);
    ubah(w, "nomor_perkara", NOMOR);
    await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_add_arsip"));
    expect(nilai(w, "nama_penyerah")).toBe("Siti Contoh, S.H.");
    expect(nilai(w, "tgl_masuk_berkas")).toBe("");
    expect(w.document.querySelector('[data-m1-usulan="tgl_masuk"]').textContent).toMatch(/Rabu, 16 Sep 2026.*tanggal BHT/);
    ubah(w, "tgl_masuk_berkas", "20/08/2026");
    expect(pita(w, "arsip").querySelector('[data-m1="cek"]').textContent).toMatch(/mendahului tanggal putusan/);
  });
});

// ============================================================================
describe("I. Tampilan Lama, jaringan, tanda ALETA, manifest", () => {
  it("tampilan Lama: tidak ada yang dipasang, yang sudah ada dibersihkan", () => {
    let mode = "ui";
    const w = buka(TUNDA(), { sebelum: (jw) => (jw.alatUjiMode = () => mode) });
    expect(w.aletaSippIdeM1.pasang(w.document).pita).toBe(1);
    mode = "lama";
    expect(w.aletaSippIdeM1.pasang(w.document)).toEqual({ pita: 0, relaas: 0 });
    expect(w.document.querySelectorAll(".aleta-m1").length).toBe(0);
  });

  it("jaringan hanya saat tombol ditekan; isian SIPP tidak memuat kata ALETA; sisipan di form type=button tanpa name", async () => {
    const w = buka(`${TUNDA()}${SELA()}${REKONVENSI}${SAKSI()}${BIAYA()}${ARSIP}`, { jawab: () => bahanTunda({ antrian: 2 }) });
    w.aletaSippIdeM1.pasang(w.document);
    expect(w.__minta).toEqual([]);
    await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_tunda_jadwal_sidang"));
    w.document.querySelector('[data-m1-usulan="hadir"] [data-m1="pakai"]').click();
    const isi = (Array.from(w.document.querySelectorAll("#form_pop form input, #form_pop form textarea, #form_pop form select")) as HTMLInputElement[])
      .filter((e) => !e.closest(".aleta-sisip"))
      .map((e) => e.value)
      .join(" ");
    expect(isi).not.toMatch(/aleta/i);
    for (const b of Array.from(w.document.querySelectorAll("#form_pop form button")) as HTMLButtonElement[]) {
      expect(b.type).toBe("button");
      expect(b.getAttribute("name")).toBeNull();
      expect(b.closest(".aleta-sisip")).not.toBeNull();
    }
  });

  it("rupa seperti rancangan: huruf tidak lebih kecil dari SIPP, lencana bulat berwarna dengan ikon i, tanpa kode teknis di layar", async () => {
    // L1 dan M1: tidak ada ukuran huruf tetap di bawah 13px; pita, tombol, dan tabel mengikuti huruf SIPP.
    for (const sumber of [L1, M1]) {
      const gaya = sumber.slice(sumber.indexOf("const GAYA = `"), sumber.indexOf("`;", sumber.indexOf("const GAYA = `")));
      expect(gaya).not.toMatch(/font-size:\s*(?:[0-9]|1[0-2])(?:\.\d+)?px/);
      expect(gaya).toMatch(/pita\{[^}]*font-family:inherit;font-size:inherit/);
      expect(gaya).toMatch(/border-radius:999px/);
    }
    const w = buka(`${TUNDA()}${SAKSI()}`, { jawab: () => bahanTunda({ antrian: 2 }) });
    w.aletaSippIdeM1.pasang(w.document);
    await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_tunda_jadwal_sidang"));
    const tanda = Array.from(w.document.querySelectorAll(".aleta-m1-pita .aleta-m1-tanda")) as HTMLElement[];
    expect(tanda.length).toBeGreaterThan(0);
    for (const t of tanda) {
      expect(t.querySelector(".aleta-m1-i")).not.toBeNull();
      expect(t.title).not.toBe("");
    }
    expect(pita(w, "tunda").querySelector(".aleta-m1-logo").textContent).toBe("ALETA");
    const layar = (Array.from(w.document.querySelectorAll(".aleta-m1-pita")) as HTMLElement[]).map((x) => x.textContent).join(" ");
    // Kode ide rancangan (A01, I10, W92...), nama kolom SIPP, dan nama fungsi tidak tampil.
    expect(layar).not.toMatch(/\b[A-Z]\d{2}\b|dihadiri_oleh|tgl_sidang|alasan_tunda|is_sela|usulanTunda|undefined|null|NaN/);
  });

  it("manifest: sesudah sipp-ide-l1.js hanya di SIPP; penyusun menanamnya; versi tidak dinaikkan di sini", () => {
    const m = JSON.parse(baca("manifest.json")) as { version: string; content_scripts: Array<{ js?: string[] }> };
    const sipp = m.content_scripts.find((x) => (x.js || []).includes("konten.js"))!.js!;
    expect(sipp.indexOf("sipp-ide-m1.js")).toBeGreaterThan(sipp.indexOf("sipp-ide-l1.js"));
    for (const k of m.content_scripts.filter((x) => !(x.js || []).includes("konten.js"))) expect(k.js || []).not.toContain("sipp-ide-m1.js");
    // Versi dinaikkan sesi rilis (dijaga ekstensi-versi-tanam), bukan dikunci di sini.
    expect(m.version).toMatch(/^\d+\.\d+\.\d+$/);
    const susun = readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8");
    expect(susun.indexOf('"sipp-ide-m1.js",')).toBeGreaterThan(susun.indexOf('"sipp-ide-l1.js",'));
  });
});

// ============================================================================
describe("J. bahan portal (lib/sipp-ide-jendela.ts)", () => {
  it("jadwal dari rincian bot: urut, tanggal 10 huruf, sidang setanggal -> urutan terbesar", () => {
    expect(JADWAL.map((s) => s.tanggal)).toEqual(["2026-06-08", "2026-07-06", "2026-07-22", "2026-08-26", "2026-10-13", "2026-10-21"]);
    expect(JADWAL[5]).toMatchObject({ sidangId: "106", jam: "09:00", ditunda: false, dihadiriOleh: null });
    const dua = jadwalDariRincian({ jadwalPerkara: [...RINCIAN.jadwalPerkara, { ...RINCIAN.jadwalPerkara[5], sidangId: "107", urutanSidang: 9 }] });
    expect(pilihSidang(dua, "2026-10-21")!.sidangId).toBe("107");
    expect(pilihSidang(JADWAL, "2026-10-22")).toBeNull();
    expect(pilihSidang(JADWAL, "")).toBeNull();
  });

  it("cek tanggal: libur nasional, hari kerja terdekat, bentrok perkara, jumlah sidang hari itu", () => {
    expect(cekTanggalSidang("2026-12-25", { jadwal: JADWAL })).toEqual({
      tanggal: "2026-12-25",
      libur: "libur: Natal",
      hariKerjaTerdekat: "2026-12-28",
      bentrokPerkara: false,
      jumlahSidangHariItu: null,
    });
    expect(cekTanggalSidang("2026-10-13", { jadwal: JADWAL, kecualiSidangId: "106", rekapHari: [{ tanggal: "2026-10-13", jumlah: 40 }] })).toMatchObject({
      libur: "",
      bentrokPerkara: true,
      jumlahSidangHariItu: 40,
    });
    expect(cekTanggalSidang("2026-10-13", { jadwal: JADWAL, kecualiSidangId: "105" })!.bentrokPerkara).toBe(false);
  });

  it("susunUsulanTunda = usulanTundaSidang apa adanya + kehadiran antrian; tanggal libur -> tidak pasti; riwayat kosong -> null", () => {
    const b = bahanTunda({ antrian: 2 });
    expect(b.tunda.kehadiranAntrian).toBe(2);
    expect(b.tunda.usulan).toMatchObject({ kehadiran: 2, tanggalPasti: true });
    expect(b.tunda.usulan!.tanggal > "2026-10-21").toBe(true);
    expect(susunUsulanTunda({ keadaan: null, riwayat: null })).toEqual({ usulan: null, kehadiranAntrian: null });
  });

  it("panggilan & dokumen jawaban: hanya kolom yang dipakai, rekonvensi dikenali dari judul", () => {
    const p = ringkasPanggilan({ panggilan: { pihak: [{ nama: "A", peran: "Tergugat", noResiPos: "R1", kepatutan: { dinilai: false } }] } });
    expect(p[0]).toEqual({
      nama: "A",
      peran: "Tergugat",
      seharusnya: "",
      terlaksana: "",
      sandiRelaas: "",
      eSummonsTerkirim: null,
      tanggalPanggilan: "",
      tanggalPelaksanaanRelaas: "",
      patut: null,
      dinilai: false,
      alasanPatut: "",
      dasarHukum: "",
      selisih: null,
      ambang: null,
      hariKerja: false,
    });
    expect(ringkasPanggilan(null)).toEqual([]);
    const d = dokumenJawaban([
      { judulDokumen: "Replik Penggugat", tanggalSidang: "2026-07-29" },
      { judulDokumen: "Duplik Rekonvensi", tanggalSidang: "2026-08-12" },
      { judulDokumen: "Jawaban Tergugat", tanggalSidang: "2026-07-22" },
    ]);
    expect(d.map((x) => [x.judul, x.rekonvensi])).toEqual([
      ["Jawaban Tergugat", false],
      ["Duplik Rekonvensi", true],
    ]);
  });
});

// ============================================================================
// K. Rute portal sipp-ide/jendela -> bot: gerbang sungguhan, HTTP bot ditiru
//    PERSIS seperti rute bot menjawab (internalGatewayRoutes.js,
//    jadwalSidangRoutes.js), lalu jawabannya dipakai ekstensi.
// ============================================================================
type JawabBot = { status: number; isi: unknown } | "putus";
const RINCIAN_BOT = {
  ok: true,
  alasan: "",
  nomorPerkara: NOMOR,
  perkaraId: "9806",
  jenisPerkara: "Cerai Gugat",
  majelis: [{ kode: "3", nama: "Hakim Contoh, S.H.I.", jabatan: "Ketua Majelis" }],
  panitera: [{ kode: "12", nama: "Siti Contoh, S.H." }],
  jurusita: [{ kode: "7", nama: "Juru Sita Contoh" }],
  saksi: { ada: false, jumlahSaksi: 0, jumlahKeterangan: 0, diajukanPihak1: 0, diajukanPihak2: 0, adaDiajukan: false },
  relaas: [
    {
      id: "1",
      namaPihak: "SITI CONTOH BINTI FULAN",
      peran: "Penggugat",
      tanggalRelaas: "2026-06-02",
      tanggalKirimPos: "",
      statusPos: null,
      retur: false,
      bertemu: false,
      caraRelaas: { sandi: "E", cara: "Panggilan elektronik", sampai: true, terbaca: true },
      noResiPos: "",
      jurusitaNama: "Juru Sita Contoh",
      adaDokumen: false,
      adaResi: false,
    },
  ],
  dokumenSipp: [],
  putusan: null,
  lewatEcourt: true,
  jadwalPerkara: RINCIAN.jadwalPerkara.map((s) => ({ ...s, jamSidang: "09:00" })),
};
const KEADAAN_BOT = {
  ok: true,
  keadaan: {
    jadwalId: 106,
    perkaraId: 9806,
    tanggalSidang: "2026-10-21",
    jamSidang: "09:00:00",
    sampaiJam: null,
    agenda: "Pembuktian Tergugat",
    agendaId: null,
    urutan: 6,
    ditunda: "T",
    alasanDitunda: null,
    ruanganId: 1,
    ruangan: "Ruang Sidang 1",
    sidangKeliling: "T",
    sifatSidang: "Y",
    dihadiriOleh: null,
    verzet: null,
    keberatan: null,
    ikrarTalak: "T",
    nomorPerkara: NOMOR,
    alurPerkaraId: 1,
    jenisPerkaraId: 347,
    jenisPerkara: "Cerai Gugat",
  },
  riwayat: {
    sidang: JADWAL.map((s) => ({ jadwalId: Number(s.sidangId), tanggal: s.tanggal, agenda: s.agenda, ditunda: s.ditunda, alasan: s.alasan, dihadiriOleh: s.dihadiriOleh, ikrar: false })),
    mediasi: { ada: true, selesai: true, berhasil: false },
  },
  ruangan: [{ id: 1, nama: "Ruang Sidang 1" }],
  antrian: { jadwalId: 106, ruanganId: 1, keadaan: "selesai", jamMasuk: "09:20:00", hadirPihak1: true, hadirPihak2: false, dihadiriOleh: 2 },
  atasNama: { ok: true, username: "pp_contoh", namaLengkap: "Siti Contoh, S.H.", peran: "panitera sidang" },
};
const KESIAPAN_BOT = {
  ok: true,
  kesiapan: {
    skor: 80,
    keadaan: "perhatian",
    penghambat: [],
    panggilan: {
      pengaturan: { hariElektronik: 3, hariSuratTercatat: 3, hariBiasa: 3 },
      jalur: {},
      lewatEcourt: true,
      sidangId: "101",
      tanggalSidang: "2026-06-08",
      pihak: [
        {
          nama: "SITI CONTOH BINTI FULAN",
          peran: "Penggugat",
          persetujuan: "setuju",
          seharusnya: "elektronik",
          terlaksana: "elektronik",
          sudahDikirim: true,
          belumDipanggil: false,
          salahSaluran: false,
          sandiRelaas: "E",
          eSummonsTerkirim: true,
          terbacaEcourt: true,
          tanggalPanggilan: "2026-06-02",
          diterima: true,
          buktiPenerimaan: "e-Summons",
          noResiPos: "",
          tanggalPelaksanaanRelaas: "2026-06-02",
          kepatutan: { dinilai: true, patut: true, selisih: 3, ambang: 3, hariKerja: true, dasarHukum: "Pasal 146 RBg", jalur: "elektronik", perluDiterima: false, alasan: "" },
        },
      ],
      ringkasan: { jumlahPihak: 1, belumDipanggil: 0, salahSaluran: 0, tidakPatut: 0, penerimaanBelumTerbukti: 0, patut: 1 },
    },
  },
};

const botTiruan = vi.hoisted(() => ({ jawab: null as null | ((jalur: string, q: URLSearchParams) => unknown), minta: [] as string[] }));

function pasangBot(atur: (jalur: string, q: URLSearchParams) => JawabBot | undefined) {
  botTiruan.minta = [];
  vi.stubGlobal("fetch", async (alamat: string) => {
    const u = new URL(alamat);
    botTiruan.minta.push(u.pathname + u.search);
    const j = atur(u.pathname, u.searchParams);
    if (j === "putus") throw Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } });
    const { status, isi } = j || { status: 404, isi: "<html>Cannot GET</html>" };
    return new Response(typeof isi === "string" ? isi : JSON.stringify(isi), { status });
  });
}
function botSehat(jalur: string, q: URLSearchParams): JawabBot | undefined {
  if (jalur === "/internal/aleta-bot/sipp/jadwal-sidang/rincian") {
    return q.get("nomor") === NOMOR ? { status: 200, isi: RINCIAN_BOT } : { status: 400, isi: { ok: false, alasan: "perkara_tidak_ditemukan" } };
  }
  if (jalur === "/internal/aleta-bot/sidang/keadaan") return { status: 200, isi: KEADAAN_BOT };
  if (jalur === "/internal/aleta-bot/jadwal-sidang/kalender") return { status: 200, isi: { ok: true, kalender: [] } };
  if (jalur === "/internal/aleta-bot/jadwal-sidang/pihak-elektronik") {
    return { status: 200, isi: { ok: true, kontak: { ecourtTerbaca: true, sebab: "", penggugat: { adaEmail: true, sumber: "ecourt" }, tergugat: { adaEmail: false, persetujuan: "belum" } } } };
  }
  if (jalur === "/internal/aleta-bot/sipp/jadwal-sidang/kalender") {
    return { status: 200, isi: { ok: true, bulan: q.get("bulan"), awal: "", akhir: "", hari: [{ tanggal: "2026-11-04", jumlah: 31, jumlahDitunda: 0 }] } };
  }
  if (jalur === "/internal/aleta-bot/sipp/jadwal-sidang/kesiapan") return { status: 200, isi: KESIAPAN_BOT };
  if (jalur === "/internal/aleta-bot/ecourt/arsip/rincian") {
    return { status: 200, isi: { ok: true, nomorPerkara: NOMOR, dokumen: [{ documentKey: "k1", judulDokumen: "Jawaban dan Gugatan Rekonvensi", jenisDokumen: "jawaban", tanggalSidang: "2026-07-22", diunggahPada: "2026-07-21T03:00:00.000Z" }] } };
  }
  return undefined;
}

async function mintaRute(q: Record<string, string>) {
  const { GET } = await import("@/app/api/aleta-ecourt/sipp-ide/jendela/route");
  const jawab = await GET(new NextRequest(`http://localhost/aleta/api/aleta-ecourt/sipp-ide/jendela?${new URLSearchParams(q).toString()}`));
  const luar = (await jawab.json()) as { ok: boolean; data: Record<string, any> };
  return { status: jawab.status, data: luar.data };
}

describe("K. rute portal sipp-ide/jendela -> bot (siap pakai)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tunda: rincian -> keadaan sidang -> Court Calendar + kontak -> usulanTundaSidang -> rekap hari; jawaban dipakai ekstensi", async () => {
    pasangBot(botSehat);
    const { status, data } = await mintaRute({ jendela: "tunda", nomor: NOMOR, tanggal: "2026-10-21" });
    expect(status).toBe(200);
    expect(data).toMatchObject({ available: true, ok: true, jendela: "tunda", perkaraId: "9806", sidang: { sidangId: "106", tanggal: "2026-10-21" } });
    expect(data.jadwal).toHaveLength(6);
    expect(botTiruan.minta.map((m) => m.split("?")[0])).toEqual([
      "/internal/aleta-bot/sipp/jadwal-sidang/rincian",
      "/internal/aleta-bot/sidang/keadaan",
      "/internal/aleta-bot/jadwal-sidang/kalender",
      "/internal/aleta-bot/jadwal-sidang/pihak-elektronik",
      // F3.2 (17 Okt 2026): kehadiran rinci per orang sidang ini.
      "/internal/aleta-bot/antrian/kehadiran",
      "/internal/aleta-bot/sipp/jadwal-sidang/kalender",
    ]);
    expect(botTiruan.minta[1]).toBe("/internal/aleta-bot/sidang/keadaan?jadwalId=106");
    expect(data.tunda.kehadiranAntrian).toBe(2);
    // F3.2: tanpa catatan rinci, ringkasan tetap tersusun dari kolom antrian (Penggugat hadir).
    expect(data.tunda.kehadiranRinci).toMatchObject({ sandi: 2, orang: [] });
    expect(data.tunda.usulan).toMatchObject({ kehadiran: 2, tanggalPasti: true });
    expect(data.tunda.cek.tanggal).toBe(data.tunda.usulan.tanggal);
    // Jawaban rute apa adanya -> ekstensi mengisi jendela Tunda.
    const w = buka(TUNDA(), { jawab: () => data });
    w.aletaSippIdeM1.pasang(w.document);
    const r = await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_tunda_jadwal_sidang"));
    expect(r.diisi).toBe(4);
    expect(nilai(w, "alasan_tunda")).toBe(data.tunda.usulan.alasan);
  });

  it("relaas: kesiapan sidang -> kepatutan per pihak; jawaban dipakai daftar pelaksanaan", async () => {
    pasangBot(botSehat);
    const { data } = await mintaRute({ jendela: "relaas", nomor: NOMOR, tanggal: "2026-06-08" });
    expect(botTiruan.minta[1]).toBe(`/internal/aleta-bot/sipp/jadwal-sidang/kesiapan?nomor=${encodeURIComponent(NOMOR).replace(/%20/g, "+")}&sidangId=101&tanggalSidang=2026-06-08&agenda=Sidang+Pertama`);
    expect(data.panggilan).toEqual([
      expect.objectContaining({ nama: "SITI CONTOH BINTI FULAN", seharusnya: "elektronik", eSummonsTerkirim: true, tanggalPanggilan: "2026-06-02", patut: true, ambang: 3, hariKerja: true }),
    ]);
    expect(data.relaas[0]).toEqual({
      namaPihak: "SITI CONTOH BINTI FULAN",
      peran: "Penggugat",
      tanggalRelaas: "2026-06-02",
      bertemu: false,
      cara: "Panggilan elektronik",
      sandi: "E",
      jurusitaNama: "Juru Sita Contoh",
      sidangId: expect.any(String),
      // Hasil panggilan menurut aturan bersama (@/lib/kepatutan-relaas).
      kepatutan: expect.objectContaining({ label: "Bertemu (elektronik)", warna: "hijau", retur: false, labelRetur: "" }),
    });
    const w = buka(RELAAS_DAFTAR, { jawab: () => data });
    w.aletaSippIdeM1.pasang(w.document);
    const t = w.document.querySelector("#pelaks_relaas");
    expect(await w.aletaSippIdeM1.periksaRelaas(t.__aletaM1)).toEqual({ n: 1, patut: 1, tidak: 0, belum: 0, lain: 2 });
    // Kesiapan kosong (bot: ok:false) -> panggilan null -> kalimat awam di layar.
    pasangBot((j, q) => (j.endsWith("/kesiapan") ? { status: 200, isi: { ok: false, kesiapan: null } } : botSehat(j, q)));
    const kosong = await mintaRute({ jendela: "relaas", nomor: NOMOR, tanggal: "2026-06-08" });
    expect(kosong.data.panggilan).toBeNull();
    const w2 = buka(RELAAS_DAFTAR, { jawab: () => kosong.data });
    w2.aletaSippIdeM1.pasang(w2.document);
    const t2 = w2.document.querySelector("#pelaks_relaas");
    await w2.aletaSippIdeM1.periksaRelaas(t2.__aletaM1);
    expect(t2.__aletaM1.kabar.textContent).toBe("Kesiapan sidang ini belum dapat dibaca ALETA.");
  });

  it("rekonvensi & sela & arsip: bagian mahal hanya untuk jendela yang memakainya", async () => {
    pasangBot(botSehat);
    const rek = await mintaRute({ jendela: "rekonvensi", nomor: NOMOR });
    expect(rek.data.jawabanEcourt).toEqual([{ judul: "Jawaban dan Gugatan Rekonvensi", tanggalSidang: "2026-07-22", diunggahPada: "2026-07-21", rekonvensi: true }]);
    expect(botTiruan.minta.map((m) => m.split("?")[0])).toEqual(["/internal/aleta-bot/sipp/jadwal-sidang/rincian", "/internal/aleta-bot/ecourt/arsip/rincian"]);
    for (const jendela of ["sela", "saksi", "arsip"]) {
      pasangBot(botSehat);
      const { data } = await mintaRute({ jendela, nomor: NOMOR });
      expect(botTiruan.minta).toHaveLength(1);
      expect(data).toMatchObject({ ok: true, putusan: null, panitera: [{ nama: "Siti Contoh, S.H." }] });
    }
  });

  it("gagal: perkara tidak ada, bot mati, bot lama (404 HTML), bot galat 500 -> kalimat awam tanpa kode/alamat", async () => {
    const kasus: Array<[string, (j: string, q: URLSearchParams) => JawabBot | undefined, string, boolean]> = [
      ["tidak ada", botSehat, "Perkara ini tidak ditemukan di SIPP menurut ALETA. Periksa nomor perkaranya.", true],
      ["bot mati", () => "putus", "", false],
      ["bot lama", () => undefined, "", false],
      ["galat", () => ({ status: 500, isi: { ok: false, error: "ER_NO_SUCH_TABLE: Table 'SIPP.perkara' doesn't exist" } }), "", false],
    ];
    for (const [, atur, harap, tersambung] of kasus) {
      pasangBot(atur);
      const { status, data } = await mintaRute({ jendela: "tunda", nomor: "999/Pdt.G/2026/PA.Dgl", tanggal: "2026-10-21" });
      expect(status).toBe(200);
      expect(data.ok).toBe(false);
      expect(data.available).toBe(tersambung);
      expect(data.alasan).toBe(harap || pesanGagalJendela("").pesan);
      expect(data.alasan).not.toMatch(/_|HTTP|ECONN|internal|aleta_bot|127\.0|Table|fetch/i);
    }
    // Keadaan sidang tak terbaca: rute tetap menjawab jadwal, usulan tunda null + kalimat awam.
    pasangBot((j, q) => (j === "/internal/aleta-bot/sidang/keadaan" ? { status: 404, isi: { ok: false, alasan: "jadwal_tidak_ketemu" } } : botSehat(j, q)));
    const { data } = await mintaRute({ jendela: "tunda", nomor: NOMOR, tanggal: "2026-10-21" });
    expect(data.ok).toBe(true);
    expect(data.tunda).toEqual({ usulan: null, kehadiranAntrian: null, kehadiranRinci: null, cek: null, alasan: "Data sidang ini belum dapat dibaca ALETA - usulan tunda belum dapat disusun." });
    const w = buka(TUNDA(), { jawab: () => data });
    w.aletaSippIdeM1.pasang(w.document);
    await w.aletaSippIdeM1.isiDenganAleta(p(w, "#frm_tunda_jadwal_sidang"));
    expect(pita(w, "tunda").querySelector('[data-m1="kabar"]').textContent).toBe("Data sidang ini belum dapat dibaca ALETA - usulan tunda belum dapat disusun.");
    // Masukan tidak sah ditolak tanpa memanggil bot.
    pasangBot(botSehat);
    expect((await mintaRute({ jendela: "hapus", nomor: NOMOR })).data.alasan).toBe("Jendela ini belum dibantu ALETA.");
    expect((await mintaRute({ jendela: "tunda", nomor: "" })).data.alasan).toBe("Nomor perkara belum terbaca.");
    expect(botTiruan.minta).toEqual([]);
  });
});
