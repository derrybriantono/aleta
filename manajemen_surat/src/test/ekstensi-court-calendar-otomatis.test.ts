// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { HARI_TUNDA_MEDIASI, jamSidangBerikut } from "@/lib/bawaan-tunda";

/**
 * ============================================================================
 * BUTIR 29 - COURT CALENDAR OTOMATIS DI PANEL SIPP (panitera sidang, PP, admin)
 * ============================================================================
 *
 * Dijaga dengan MENJALANKAN panel-alat.js dan konten.js UTUH di jsdom:
 *
 *   penyusun   ccSusun (murni) atas perkara karangan berkeadaan nyata: belum
 *              sidang, verstek, cerai talak e-Litigasi sesudah mediasi gagal,
 *              libur Natal, itsbat/dispensasi/permohonan/gugatan sederhana,
 *              sidang yang belum tercatat di Court Calendar, dan baris yang
 *              sudah ada di SIPP (tidak disusun ulang).
 *   satu mesin angka tunda mediasi dan jam sore SAMA dengan @/lib/bawaan-tunda.
 *   menu       hanya Baru/UI Baru, hanya panitera/admin, tag "Panitera"; Lama
 *              dan Hakim tanpa bagian ini.
 *   menulis    "Input semua ke SIPP" (dua tekanan) mengirim POST blangko SIPP
 *              sendiri (manage_court_calendar/validateInput) dengan medan
 *              blangkonya, melewati baris yang sudah ada, lalu MEMBACA ULANG
 *              daftar SIPP; penolakan SIPP disebut per baris; mode coba dan
 *              mode kering tidak mengirim apa pun.
 *
 * ALETA_UJI_KONTEN menunjuk SALINAN konten.js untuk pembukti gigitan.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const KONTEN = () => (process.env.ALETA_UJI_KONTEN ? readFileSync(process.env.ALETA_UJI_KONTEN, "utf8") : baca("konten.js"));
const ALAT = baca("panel-alat.js");

const ASAL = "http://192.168.10.10";
const DASAR = `${ASAL}/SIPP/`;
const ENC = "YWJjZGVmZ2hpams9";
const NOMOR = "450/Pdt.G/2026/PA.Dgl";

const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 4000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${keterangan}`);
    await tunggu(10);
  }
}

// ----------------------------------------------------------------------------
// SIPP tiruan: list_view, blangko court_calendar_v, validateInput
// ----------------------------------------------------------------------------
type BarisCc = { tanggal: string; jam: string; agenda: string; keterangan: string };
const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function teksTanggalSipp(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const hari = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${NAMA_HARI[hari]}, ${String(d).padStart(2, "0")} ${NAMA_BULAN[m - 1]} ${y}`;
}

function htmlDaftar(baris: BarisCc[]) {
  const isi = baris.length
    ? baris
        .map(
          (b, i) => `<tr><td align="center">${i + 1}</td><td>${teksTanggalSipp(b.tanggal)}</td><td>Pukul : ${b.jam} s.d selesai</td>` +
            `<td align="left">${b.agenda || "-"}</td><td align="left">${b.keterangan || "-"}</td><td align="center"><a href="#">Edit</a></td></tr>`
        )
        .join("")
    : '<tr><td colspan="8" align="center">Tidak Ada Pencatatan Rencana Sidang</td></tr>';
  return `<div id='infoPerkara'><a href="#" onClick="popup_form('${DASAR}tambah_court_calendar/tambah/${ENC}')" class="btn">Tambah Court Calender</a></div>
<div class="cssTable"><table id="tableinfo"><tbody><tr><td>NO</td><td>Tanggal</td><td>Pukul</td><td>Agenda/Acara Sidang</td><td>Keterangan</td><td>Link</td></tr>${isi}</tbody></table></div>`;
}

const HTML_BLANGKO = `<div class="centering"><div id='frm_court_calendar'><form id="frm_input_cc" method="post" action="${DASAR}manage_court_calendar/validateInput">
<table><tbody><tr><td>Nomor Perkara</td><td><span>${NOMOR}</span></td></tr>
<tr><td>Tanggal Persidangan</td><td><input id="tgl_sidang" name="tgl_sidang" value="" class="datepicker"></td></tr>
<tr><td>Jam</td><td><input id="jamSidang" name="jamSidang" value=""></td></tr>
<tr><td>Agenda</td><td><textarea id="agenda_sidang" name="agenda_sidang"></textarea></td></tr>
<tr><td>Keterangan</td><td><textarea id="keterangan" name="keterangan"></textarea></td></tr>
<tr><td colspan="2"><input type="button" id="close_frm_cc" value="Kembali"><input type="submit" id="simpan" value="Simpan"></td></tr>
<input type="hidden" id="nomor_perkara" name="nomor_perkara" value="${NOMOR}">
<input type="hidden" id="curr_date" value="05/10/2026">
<input type="hidden" name='enc' value='${ENC}'>
</tbody></table></form></div></div>`;

function hariKe(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function isoDariSipp(tgl: string) {
  const [d, m, y] = tgl.split("/");
  return `${y}-${m}-${d}`;
}

function tambahHari(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function hariIniLokal() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/** Selasa kerja pertama >= hari ini + n. */
function selasaDepan(n: number) {
  let t = tambahHari(hariIniLokal(), n);
  while (hariKe(t) !== 2) t = tambahHari(t, 1);
  return t;
}

// ----------------------------------------------------------------------------
// Halaman detail perkara SIPP + portal tiruan
// ----------------------------------------------------------------------------
type Kiriman = { url: string; cara: string; badan: string };

type Halaman = {
  dom: JSDOM;
  w: any;
  d: Document;
  ctx: vm.Context;
  kiriman: Kiriman[];
  sipp: BarisCc[];
};

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Opsi = {
  simpanan?: Record<string, unknown>;
  peran?: string;
  jenisPerkara?: string;
  status?: Record<string, unknown>;
  sipp?: BarisCc[];
  /** Tanggal (ISO) yang ditolak validateInput dengan st 0. */
  tolak?: string[];
  /** validateInput menjawab st 1 tetapi tidak menyimpan. */
  hilang?: boolean;
};

function statusBawaan(sidangPertama: string) {
  return {
    majelis: [],
    panitera: [{ nama: "Munifa" }],
    jurusita: [],
    ikrar: null,
    sumberMajelis: "pemeriksa",
    putusan: { sudahPutus: false },
    putusanLengkap: {},
    penilaianSk: { rinci: [] },
    jadwal: [],
    mediasi: { terbaca: true, baris: [] },
    lewatEcourt: true,
    courtCalendar: { terbaca: true, baris: [] },
    tahapan: {
      terbaca: true,
      sidangPertama,
      tahap: [
        { kunci: "pendaftaran", terbaca: true, tanggal: tambahHari(sidangPertama, -13) },
        { kunci: "pmh", terbaca: true, tanggal: tambahHari(sidangPertama, -12) },
        { kunci: "ppp", terbaca: true, tanggal: tambahHari(sidangPertama, -12) },
        { kunci: "pjs", terbaca: true, tanggal: tambahHari(sidangPertama, -12) },
        { kunci: "phs", terbaca: true, tanggal: tambahHari(sidangPertama, -11) },
      ],
    },
  };
}

function buka(p: Opsi = {}): Halaman {
  const peran = p.peran ?? "Panitera Pengganti";
  const dom = new JSDOM(
    `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten"><h3>Nomor Perkara ${NOMOR}</h3>
<div id="usual2"><ul><li class='tab'><a class='tabs27' href="#tabs27">Court Calendar</a></li></ul><div id="tabs27"></div></div></div>
<script type="text/javascript">
  $('#tabs1').load('${DASAR}open_dataumum/${ENC}');
  $('#tabs27').load('${DASAR}court_calendar/${ENC}');
</script></body></html>`,
    { url: `${ASAL}/SIPP/detil_perkara_agama`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return this.textContent;
    },
  });
  w.TextDecoder = globalThis.TextDecoder;
  w.Response = globalThis.Response;
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const pendengar: Array<(u: Record<string, unknown>, wilayah: string) => void> = [];
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.183.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          const ubah: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(isi)) {
            ubah[k] = { oldValue: simpanan[k], newValue: polos(v) };
            simpanan[k] = polos(v);
          }
          setTimeout(() => {
            for (const f of [...pendengar]) f(polos(ubah), "local");
          }, 0);
        },
        remove: async (kunci: string | string[]) => {
          for (const k of [kunci].flat()) delete simpanan[k];
        },
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: any) => void pendengar.push(f) },
    },
  };
  const sipp: BarisCc[] = polos(p.sipp ?? []);
  const kiriman: Kiriman[] = [];
  const status = p.status ?? statusBawaan(selasaDepan(7));
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: string }) => {
    const url = String(alamat);
    const cara = String((opsi && opsi.method) || "GET").toUpperCase();
    kiriman.push({ url, cara, badan: String((opsi && opsi.body) || "") });
    let st = 200;
    let isi: unknown = { ok: true, data: {} };
    if (url.includes("/api/aleta-ecourt/ekstensi/tampilan")) {
      st = 404;
      isi = {};
    } else if (url.includes("/aleta-ecourt/ekstensi/siapa")) {
      isi = { ok: true, data: { nama: "Munifa", peran, kapabilitas: null } };
    } else if (url.includes("/aleta-bot/sipp-konteks?")) {
      isi = {
        ok: true,
        data: {
          available: true,
          konteks: {
            ok: true,
            nomorPerkara: NOMOR,
            nomorRegister: "",
            identitas: { ditemukan: true, jenisPerkara: p.jenisPerkara ?? "Cerai Gugat", jenisPerkaraLengkap: p.jenisPerkara ?? "Cerai Gugat", adaKumulasi: false, kumulasi: [], adaKuasa: false },
            ringkasan: { dokumen: 0 },
            dokumen: [],
            selisih: [],
            nomorPihak: [],
            diperiksaPada: new Date().toISOString(),
            ambangMendesakHari: 3,
            hakim: null,
          },
          pengguna: { nama: "Munifa", peran },
          kapabilitas: null,
        },
      };
    } else if (url.includes("/aleta-ecourt/status-perkara?")) {
      isi = { ok: true, data: { available: true, status } };
    } else if (url === `${DASAR}court_calendar/${ENC}`) {
      isi = htmlDaftar(sipp);
    } else if (url === `${DASAR}tambah_court_calendar/tambah/${ENC}`) {
      isi = HTML_BLANGKO;
    } else if (url === `${DASAR}manage_court_calendar/validateInput` && cara === "POST") {
      const b = new URLSearchParams(String((opsi && opsi.body) || ""));
      const tanggal = isoDariSipp(String(b.get("tgl_sidang") || "01/01/1970"));
      if (b.get("enc") !== ENC || b.get("nomor_perkara") !== NOMOR) isi = { st: 0, msg: "Data Perkara Tidak Ditemukan." };
      else if ([0, 6].includes(hariKe(tanggal))) isi = { st: 0, msg: "<strong>Peringatan:</strong><br /> Tidak Dapat Memilih Tanggal Dihari Libur, Sabtu dan Minggu." };
      else if ((p.tolak ?? []).includes(tanggal)) isi = { st: 0, msg: "<strong>Peringatan:</strong><br /> Tidak Berhasil" };
      else {
        if (!p.hilang) sipp.push({ tanggal, jam: String(b.get("jamSidang")), agenda: String(b.get("agenda_sidang")), keterangan: String(b.get("keterangan") || "") });
        isi = { st: 1, msg: "Data Berhasil Disimpan" };
      }
    }
    const teks = typeof isi === "string" ? isi : JSON.stringify(isi);
    const r: any = {
      ok: st >= 200 && st < 300,
      status: st,
      statusText: "",
      url,
      redirected: false,
      headers: { get: () => (typeof isi === "string" ? "text/html" : "application/json") },
      json: async () => JSON.parse(teks),
      text: async () => teks,
      clone: () => r,
    };
    return r;
  };
  const pmAsli = w.postMessage.bind(w);
  w.postMessage = (data: any, asal: string) => {
    if (data && data.sumber === "aleta-jembatan") {
      const { id } = data;
      setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data: { sumber: "aleta-jembatan-jawab", id, ok: true, medan: [] }, source: w })), 0);
      return;
    }
    return pmAsli(data, asal);
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(`${KONTEN()}\n;\nif (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0);`, ctx, { filename: "konten.js" });
  return { dom, w, d: w.document, ctx, kiriman, sipp };
}

const UI = { ujiTampilan: "ui", ujiIzinkanNyata: true };
const BARU = { ujiTampilan: "baru", ujiIzinkanNyata: true };
const panelDari = (h: Halaman) => h.d.getElementById("aleta-panel-sipp") as any;
const siapUi = (h: Halaman) =>
  sampai(() => {
    const pn = panelDari(h);
    return pn && pn.getAttribute("data-t7") === "ui" && pn.querySelector(".aleta-t7-tab") && pn.getAttribute("data-t7-tab") ? pn : null;
  }, "panel UI Baru bertab");
const siapLama = (h: Halaman) => sampai(() => panelDari(h) && panelDari(h).querySelector(".aleta-kelompok") && panelDari(h), "panel Lama");
const bagianCc = (pn: any) => pn.querySelector('.aleta-bagian[data-kunci="courtCalendarOtomatis"]');

/** Membuka bagian Court Calendar otomatis dan menunggu susunannya. */
async function bukaCc(h: Halaman) {
  const pn = await siapUi(h);
  const tab = pn.querySelector('.aleta-t7-tab[data-t7-ke="perkara"]');
  if (tab) tab.click();
  const kotak = await sampai(() => bagianCc(pn), "bagian Court Calendar otomatis ada");
  kotak.querySelector(".aleta-bagian-judul").click();
  await sampai(() => kotak.querySelector(".aleta-cc-input") && !kotak.querySelector(".aleta-cc-input").disabled, "susunan siap diinput");
  return kotak;
}

const barisUi = (kotak: any) =>
  Array.from(kotak.querySelectorAll(".aleta-cc-baris")).map((el: any) => ({
    pilih: el.querySelector(".aleta-cc-pilih").checked,
    agenda: el.querySelector(".aleta-cc-agenda").value,
    tanggal: el.querySelector(".aleta-cc-tanggal").value,
    jam: el.querySelector(".aleta-cc-jam").value,
    keterangan: el.querySelector(".aleta-cc-ket").value,
    keadaan: (el.querySelector(".aleta-cc-keadaan") || { textContent: "" }).textContent,
  }));

const kirimanSimpan = (h: Halaman) => h.kiriman.filter((k) => k.cara === "POST" && k.url.includes("manage_court_calendar"));

// ============================================================================
// PENYUSUN MURNI
// ============================================================================
function penyusun() {
  const h = buka({ simpanan: {} });
  return {
    susun: (m: Record<string, unknown>) => polos(h.w.ccSusun(m)),
    nilai: (ungkapan: string) => vm.runInContext(ungkapan, h.ctx),
    w: h.w,
  };
}

const ringkas = (hasil: any) => hasil.baris.map((b: any) => `${b.tanggal} ${b.jam} ${b.agenda} [${b.keterangan}] ${b.asal}${b.pilih ? "" : " (tidak dipilih)"}`);

describe("ccSusun - susunan dari keadaan perkara", () => {
  it("cerai gugat belum sidang: sidang pertama menurut PHS + pemeriksaan pokok 14 hari kemudian", () => {
    const { susun } = penyusun();
    const hasil = susun({
      nomorPerkara: NOMOR,
      jenisPerkara: "Cerai Gugat",
      tanggalDaftar: "2026-09-30",
      sidangPertama: "2026-10-13",
      hariIni: "2026-10-05",
      jadwal: [],
      kalender: [],
    });
    expect(hasil.jalur).toBe("awal");
    expect(ringkas(hasil)).toEqual([
      "2026-10-13 09:00 Sidang Pertama, Pemeriksaan Identitas, Penasihatan [] rencana",
      "2026-10-27 09:00 Pemeriksaan Pokok Perkara [] rencana",
    ]);
  });

  it("cerai gugat, Tergugat tidak pernah hadir: satu sidang verstek, digeser per pekan karena 14 harinya sudah lewat", () => {
    const { susun } = penyusun();
    const hasil = susun({
      nomorPerkara: NOMOR,
      jenisPerkara: "Cerai Gugat",
      sidangPertama: "2026-09-15",
      hariIni: "2026-10-05",
      jadwal: [{ tanggal: "2026-09-15", jam: "09:00", agenda: "Sidang Pertama", dihadiriOleh: 2 }],
      kalender: [{ tanggal: "2026-09-15", jam: "09:00", agenda: "Sidang Pertama", keterangan: "" }],
    });
    expect(hasil.jalur).toBe("verstek");
    // 15 Sep + 14 = 29 Sep (sudah lewat) -> per pekan sampai >= 8 Okt -> Selasa 13 Okt: hari majelis tetap.
    expect(ringkas(hasil)).toEqual([
      "2026-10-13 09:00 Pembacaan Gugatan, Pembuktian Penggugat, Musyawarah Majelis dan Pembacaan Putusan [] rencana",
    ]);
    expect(hasil.baris[0].catatan).toMatch(/digeser/);
  });

  it("cerai talak e-Court, kedua pihak hadir, mediasi gagal: rantai e-Litigasi 15.00 sampai putusan, lalu ikrar 35 hari", () => {
    const { susun } = penyusun();
    const hasil = susun({
      nomorPerkara: "210/Pdt.G/2026/PA.Dgl",
      jenisPerkara: "Cerai Talak",
      hariIni: "2026-09-23",
      ecourt: true,
      jadwal: [
        { tanggal: "2026-09-01", jam: "09:00", agenda: "Sidang Pertama", dihadiriOleh: 1 },
        { tanggal: "2026-09-22", jam: "09:00", agenda: "Mendengar Laporan Hasil Mediasi", dihadiriOleh: 1 },
      ],
      kalender: [
        { tanggal: "2026-09-01", jam: "09:00", agenda: "Sidang Pertama", keterangan: "" },
        { tanggal: "2026-09-22", jam: "09:00", agenda: "Mendengar Laporan Hasil Mediasi", keterangan: "" },
      ],
      mediasi: { baris: [{ berhasil: false, tanggalLaporan: "2026-09-20" }] },
    });
    expect(hasil.jalur).toBe("litigasi");
    expect(hasil.sebutan).toEqual({ satu: "Pemohon", dua: "Termohon" });
    expect(ringkas(hasil)).toEqual([
      "2026-09-25 15:00 Jawaban Termohon [Elitigasi] rencana",
      "2026-09-29 15:00 Replik Pemohon [Elitigasi] rencana",
      "2026-10-02 15:00 Duplik Termohon [Elitigasi] rencana",
      "2026-10-07 09:00 Pembuktian Pemohon [] rencana",
      "2026-10-14 09:00 Pembuktian Termohon [] rencana",
      "2026-10-16 15:00 Kesimpulan Pemohon dan Termohon [Elitigasi] rencana",
      "2026-10-22 09:00 Musyawarah Majelis dan Pembacaan Putusan [Elitigasi] rencana",
      "2026-11-26 09:00 Sidang Ikrar Talak [] rencana",
    ]);
  });

  it("kedua pihak hadir di sidang pertama, mediasi berjalan: laporan mediasi 21 hari (aturan tunda), perkara biasa tanpa Elitigasi", () => {
    const { susun } = penyusun();
    const hasil = susun({
      nomorPerkara: NOMOR,
      jenisPerkara: "Cerai Gugat",
      hariIni: "2026-10-06",
      ecourt: false,
      jadwal: [{ tanggal: "2026-10-06", jam: "09:00", agenda: "Sidang Pertama", dihadiriOleh: 1 }],
      kalender: [],
      mediasi: { baris: [{ berhasil: false, tanggalLaporan: "" }] },
    });
    expect(hasil.jalur).toBe("litigasi");
    expect(hasil.baris[0]).toMatchObject({ tanggal: "2026-10-06", asal: "terjadwal", pilih: true, agenda: "Sidang Pertama" });
    expect(hasil.baris[1]).toMatchObject({ tanggal: "2026-10-27", agenda: "Mendengar Laporan Hasil Mediasi", jam: "09:00", keterangan: "" });
    expect(hasil.baris[2]).toMatchObject({ tanggal: "2026-10-30", agenda: "Jawaban Tergugat", jam: "15:00", keterangan: "" });
    expect(hasil.baris.at(-1)).toMatchObject({ agenda: "Musyawarah Majelis dan Pembacaan Putusan" });
  });

  it("libur: 14 hari sesudah Kamis 10 Des 2026 jatuh pada cuti bersama Natal -> Senin 28 Des", () => {
    const { susun } = penyusun();
    const hasil = susun({ nomorPerkara: NOMOR, jenisPerkara: "Cerai Gugat", sidangPertama: "2026-12-10", hariIni: "2026-12-01", jadwal: [], kalender: [] });
    expect(hasil.baris.map((b: any) => b.tanggal)).toEqual(["2026-12-10", "2026-12-28"]);
  });

  it("itsbat (Pdt.P) tanpa PHS: satu sidang, 21 hari sesudah pendaftaran (median), disebut perkiraan; kalender berisi = tidak ada baris kedua", () => {
    const { susun } = penyusun();
    const dasar = { nomorPerkara: "612/Pdt.P/2026/PA.Dgl", jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", tanggalDaftar: "2026-10-05", hariIni: "2026-10-05", jadwal: [] };
    const hasil = susun({ ...dasar, kalender: [] });
    expect(hasil.golongan).toBe("itsbat");
    expect(ringkas(hasil)).toEqual(["2026-10-26 09:00 Sidang Pertama, Pemeriksaan Identitas, Pembacaan Permohonan, Pembuktian dan Pembacaan Penetapan [] rencana"]);
    expect(hasil.baris[0].catatan).toMatch(/perkiraan/);
    const sudah = susun({ ...dasar, kalender: [{ tanggal: "2026-10-26", jam: "09:00", agenda: "Sidang Pertama", keterangan: "" }] });
    expect(sudah.baris).toEqual([]);
    expect(sudah.catatan.join(" ")).toMatch(/sudah memuat/);
  });

  it("dispensasi, permohonan lain, dan gugatan sederhana: langkah sepekan", () => {
    const { susun } = penyusun();
    const dis = susun({ nomorPerkara: "77/Pdt.P/2026/PA.Dgl", jenisPerkara: "Dispensasi Kawin", sidangPertama: "2026-10-14", hariIni: "2026-10-05", jadwal: [], kalender: [] });
    expect(ringkas(dis)).toEqual([
      "2026-10-14 09:00 Sidang Pertama, Pemeriksaan Identitas, Penasihatan, Pemeriksaan Pokok Perkara dan Pembuktian [] rencana",
      "2026-10-21 09:00 Musyawarah Majelis dan Pembacaan Penetapan [] rencana",
    ]);
    const lain = susun({ nomorPerkara: "80/Pdt.P/2026/PA.Dgl", jenisPerkara: "Perwalian", sidangPertama: "2026-10-12", hariIni: "2026-10-05", jadwal: [], kalender: [] });
    expect(lain.baris.map((b: any) => `${b.tanggal} ${b.agenda}`)).toEqual([
      "2026-10-12 Sidang Pertama, Pemeriksaan Identitas dan Pembacaan Permohonan",
      "2026-10-19 Pembuktian Pemohon",
      "2026-10-26 Musyawarah Majelis dan Pembacaan Penetapan",
    ]);
    const gs = susun({ nomorPerkara: "5/Pdt.G.S/2026/PA.Dgl", jenisPerkara: "Ekonomi Syariah", sidangPertama: "2026-10-13", hariIni: "2026-10-05", jadwal: [], kalender: [] });
    expect(gs.golongan).toBe("sederhana");
    expect(ringkas(gs)).toEqual([
      "2026-10-13 09:00 Sidang Pertama dan Upaya Perdamaian [] rencana",
      "2026-10-20 15:00 Jawaban Tergugat [] rencana",
      "2026-10-27 09:00 Pembuktian [] rencana",
      "2026-11-03 09:00 Pembacaan Putusan [] rencana",
    ]);
  });

  it("sidang yang belum tercatat di Court Calendar: mendatang dicentang, lampau ditawarkan tanpa centang; yang sudah sampai putusan tidak direncanakan lagi", () => {
    const { susun } = penyusun();
    const hasil = susun({
      nomorPerkara: NOMOR,
      jenisPerkara: "Cerai Gugat",
      hariIni: "2026-10-05",
      jadwal: [
        { tanggal: "2026-09-15", jam: "09:00", agenda: "Sidang Pertama", dihadiriOleh: 2 },
        { tanggal: "2026-10-13", jam: "09:30", agenda: "Pembacaan Gugatan, Pembuktian dan Pembacaan Putusan", dihadiriOleh: null },
      ],
      kalender: [],
    });
    expect(ringkas(hasil)).toEqual([
      "2026-09-15 09:00 Sidang Pertama [] riwayat (tidak dipilih)",
      "2026-10-13 09:30 Pembacaan Gugatan, Pembuktian dan Pembacaan Putusan [] terjadwal",
    ]);
  });

  it("Court Calendar SIPP yang sudah memuat rencana TIDAK disusun ulang; rencana berikutnya mulai sesudah baris terakhirnya", () => {
    const { susun } = penyusun();
    const hasil = susun({
      nomorPerkara: NOMOR,
      jenisPerkara: "Cerai Gugat",
      sidangPertama: "2026-10-13",
      hariIni: "2026-10-05",
      jadwal: [],
      kalender: [
        { tanggal: "2026-10-13", jam: "09:00", agenda: "Sidang Pertama", keterangan: "" },
        { tanggal: "2026-10-27", jam: "09:00", agenda: "Pemeriksaan Pokok Perkara", keterangan: "" },
      ],
    });
    expect(hasil.baris).toEqual([]);
    expect(hasil.sudahAda).toHaveLength(2);
  });

  it("izin poligami (Pdt.G) bersebutan Pemohon/Termohon; Court Calendar tidak terbaca disebut", () => {
    const { susun } = penyusun();
    const hasil = susun({ nomorPerkara: "33/Pdt.G/2026/PA.Dgl", jenisPerkara: "Izin Poligami", sidangPertama: "2026-10-13", hariIni: "2026-10-05", jadwal: [], kalender: null });
    expect(hasil.sebutan).toEqual({ satu: "Pemohon", dua: "Termohon" });
    expect(hasil.catatan.join(" ")).toMatch(/belum terbaca/);
  });
});

describe("satu mesin dengan aturan tunda sidang (@/lib/bawaan-tunda)", () => {
  it("laporan mediasi = HARI_TUNDA_MEDIASI dan jam sore = jamSidangBerikut", () => {
    const { nilai } = penyusun();
    expect(nilai("CC_HARI.laporanMediasi")).toBe(HARI_TUNDA_MEDIASI);
    for (const agenda of [
      "Jawaban Tergugat",
      "Replik Penggugat",
      "Duplik Tergugat",
      "Kesimpulan Penggugat dan Tergugat",
      "Pembuktian Penggugat",
      "Pembuktian Tergugat",
      "Musyawarah Majelis dan Pembacaan Putusan",
      "Mendengar Laporan Hasil Mediasi",
      "Sidang Ikrar Talak",
    ]) {
      const jamCc = nilai(`CC_TAHAP_SORE.includes(ccTahap(${JSON.stringify(agenda)})) ? CC_JAM_SORE : CC_JAM_PAGI`);
      expect(`${agenda}: ${jamCc}`).toBe(`${agenda}: ${jamSidangBerikut(agenda)}`);
    }
  });
});

// ============================================================================
// MENU
// ============================================================================
describe("menu: Baru/UI Baru, panitera dan admin", () => {
  it("tampilan Lama: tidak ada bagian Court Calendar otomatis, tidak ada GET ke SIPP", async () => {
    const h = buka({ peran: "Panitera Pengganti" });
    const pn = await siapLama(h);
    await tunggu(40);
    expect(bagianCc(pn)).toBeNull();
    expect(h.kiriman.some((k) => k.url.includes("court_calendar"))).toBe(false);
  });

  it("UI Baru, Hakim: tidak ada bagian ini", async () => {
    const h = buka({ simpanan: UI, peran: "Hakim" });
    const pn = await siapUi(h);
    await tunggu(40);
    expect(bagianCc(pn)).toBeNull();
  });

  it("UI Baru, Panitera Pengganti: di tab Perkara, bertag Panitera, terlipat dan tidak membaca SIPP sebelum dibuka", async () => {
    const h = buka({ simpanan: UI, peran: "Panitera Pengganti" });
    const pn = await siapUi(h);
    const kotak = await sampai(() => bagianCc(pn), "bagian ada");
    expect(kotak.closest('.aleta-kelompok[data-kunci="perkara"]')).not.toBeNull();
    await sampai(() => kotak.querySelector(".aleta-lipat-peran"), "tag peran");
    expect(kotak.querySelector(".aleta-lipat-peran").textContent).toBe("Panitera");
    expect(kotak.querySelector(".aleta-bagian-isi").style.display).toBe("none");
    expect(h.kiriman.some((k) => k.url.includes("court_calendar"))).toBe(false);
  });

  it("Baru, Super Admin: bagian ada", async () => {
    const h = buka({ simpanan: BARU, peran: "Super Admin" });
    const pn = await sampai(() => panelDari(h) && panelDari(h).getAttribute("data-t7-a30") === "baru" && panelDari(h), "panel Baru");
    expect(bagianCc(pn)).not.toBeNull();
  });
});

// ============================================================================
// MENULIS KE SIPP
// ============================================================================
describe("Input semua ke SIPP", () => {
  it("dua tekanan; POST blangko SIPP sendiri per baris; baris yang sudah ada dilewati; daftar dibaca ulang", async () => {
    const pertama = selasaDepan(7);
    const h = buka({
      simpanan: UI,
      status: statusBawaan(pertama),
      sipp: [{ tanggal: pertama, jam: "09:00", agenda: "Sidang Pertama", keterangan: "" }],
    });
    const kotak = await bukaCc(h);
    // Sidang pertama sudah di SIPP -> hanya pemeriksaan pokok yang disusun.
    const awal = barisUi(kotak);
    expect(awal).toHaveLength(1);
    expect(awal[0]).toMatchObject({ pilih: true, agenda: "Pemeriksaan Pokok Perkara", jam: "09:00" });
    expect(kotak.querySelector(".aleta-cc-ada").textContent).toMatch(/Sudah di Court Calendar SIPP \(1\)/);

    // Disunting petugas + satu baris tambahan.
    const agenda = kotak.querySelector(".aleta-cc-agenda");
    agenda.value = "Pemeriksaan Pokok Perkara dan Pembuktian";
    agenda.dispatchEvent(new h.w.Event("input"));
    kotak.querySelector(".aleta-cc-tambah").click();
    const baru = Array.from(kotak.querySelectorAll(".aleta-cc-baris")).at(-1) as any;
    const agendaBaru = baru.querySelector(".aleta-cc-agenda");
    agendaBaru.value = "Musyawarah Majelis dan Pembacaan Putusan";
    agendaBaru.dispatchEvent(new h.w.Event("input"));
    const ket = baru.querySelector(".aleta-cc-ket");
    ket.value = "Elitigasi";
    ket.dispatchEvent(new h.w.Event("input"));

    const tombol = kotak.querySelector(".aleta-cc-input");
    expect(tombol.textContent).toBe("Input semua ke SIPP (2 baris)");
    tombol.click();
    await tunggu(20);
    expect(kirimanSimpan(h)).toHaveLength(0);
    expect(tombol.textContent).toMatch(/Tekan sekali lagi/);
    tombol.click();

    await sampai(() => /tersimpan dan terbaca ulang/.test(kotak.querySelector(".aleta-cc-kabar").textContent), "selesai");
    const kirim = kirimanSimpan(h);
    expect(kirim).toHaveLength(2);
    // 14 hari sesudah sidang pertama (maju ke hari kerja bila libur).
    const pokok = awal[0].tanggal;
    expect(pokok >= tambahHari(pertama, 14) && pokok <= tambahHari(pertama, 21)).toBe(true);
    const b1 = new URLSearchParams(kirim[0].badan);
    expect([...b1.keys()]).toEqual(["tgl_sidang", "jamSidang", "agenda_sidang", "keterangan", "nomor_perkara", "enc"]);
    expect(Object.fromEntries(b1)).toEqual({
      tgl_sidang: pokok.split("-").reverse().join("/"),
      jamSidang: "09:00",
      agenda_sidang: "Pemeriksaan Pokok Perkara dan Pembuktian",
      keterangan: "",
      nomor_perkara: NOMOR,
      enc: ENC,
    });
    expect(new URLSearchParams(kirim[1].badan).get("keterangan")).toBe("Elitigasi");
    // Tanpa tanda ALETA di apa pun yang terkirim ke SIPP.
    expect(kirim.map((k) => k.badan).join(" ")).not.toMatch(/aleta/i);
    // Dibaca ulang SESUDAH kiriman terakhir.
    const iTerakhir = h.kiriman.lastIndexOf(kirim[1]);
    expect(h.kiriman.slice(iTerakhir + 1).some((k) => k.cara === "GET" && k.url === `${DASAR}court_calendar/${ENC}`)).toBe(true);
    expect(h.sipp).toHaveLength(3);
    expect(barisUi(kotak).map((b) => b.keadaan)).toEqual(["tersimpan", "tersimpan"]);
    expect(kotak.querySelector(".aleta-cc-ada").textContent).toMatch(/\(3\)/);
    // Tombol tidak lagi menawarkan yang sudah tersimpan.
    expect(kotak.querySelector(".aleta-cc-input").disabled).toBe(true);
  });

  it("17 Okt: baris pertama langsung; jeda 'simpan' hanya sebelum baris kedua dst (jarak antar tulisan database)", async () => {
    const pertama = selasaDepan(7);
    const h = buka({ simpanan: UI, status: statusBawaan(pertama), sipp: [{ tanggal: pertama, jam: "09:00", agenda: "Sidang Pertama", keterangan: "" }] });
    const jeda: Array<{ jenis: string; ke: number }> = [];
    h.w.alatJedaManusia = async (jenis: string) => {
      jeda.push({ jenis, ke: kirimanSimpan(h).length });
      return 0;
    };
    const kotak = await bukaCc(h);
    kotak.querySelector(".aleta-cc-tambah").click();
    const baru = Array.from(kotak.querySelectorAll(".aleta-cc-baris")).at(-1) as any;
    const agendaBaru = baru.querySelector(".aleta-cc-agenda");
    agendaBaru.value = "Musyawarah Majelis";
    agendaBaru.dispatchEvent(new h.w.Event("input"));
    const tombol = kotak.querySelector(".aleta-cc-input");
    tombol.click();
    await tunggu(20);
    tombol.click();
    await sampai(() => /tersimpan dan terbaca ulang/.test(kotak.querySelector(".aleta-cc-kabar").textContent), "selesai");
    expect(kirimanSimpan(h)).toHaveLength(2);
    // Satu jeda saja, diminta sesudah 1 POST (yaitu sebelum POST kedua); tak ada jeda "klik" di depan baris pertama.
    expect(jeda).toEqual([{ jenis: "simpan", ke: 1 }]);
  });

  it("penolakan SIPP disebut per baris, baris lain tetap dikirim; jawaban 'tersimpan' yang tidak terbaca ulang TIDAK disebut tersimpan", async () => {
    const pertama = selasaDepan(7);
    const h = buka({ simpanan: UI, status: statusBawaan(pertama), tolak: [pertama] });
    const kotak = await bukaCc(h);
    expect(barisUi(kotak)).toHaveLength(2);
    kotak.querySelector(".aleta-cc-input").click();
    kotak.querySelector(".aleta-cc-input").click();
    await sampai(() => /ditolak/.test(kotak.querySelector(".aleta-cc-kabar").textContent), "selesai");
    expect(kirimanSimpan(h)).toHaveLength(2);
    const ui = barisUi(kotak);
    expect(ui.map((b) => b.keadaan)).toEqual(["ditolak", "tersimpan"]);
    expect(kotak.querySelector(".aleta-cc-baris .aleta-cc-catatan").textContent).toMatch(/Tidak Berhasil/);

    const h2 = buka({ simpanan: UI, status: statusBawaan(pertama), hilang: true });
    const kotak2 = await bukaCc(h2);
    kotak2.querySelector(".aleta-cc-input").click();
    kotak2.querySelector(".aleta-cc-input").click();
    await sampai(() => /belum terbaca ulang/.test(kotak2.querySelector(".aleta-cc-kabar").textContent), "selesai");
    expect(barisUi(kotak2).map((b) => b.keadaan)).toEqual(["belum terbaca ulang", "belum terbaca ulang"]);
  });

  it("tanggal Sabtu/Minggu tidak dapat dipilih (18 Okt 2026) dan tidak pernah dikirim", async () => {
    const pertama = selasaDepan(7);
    const h = buka({ simpanan: UI, status: statusBawaan(pertama) });
    const kotak = await bukaCc(h);
    const tgl = kotak.querySelectorAll(".aleta-cc-tanggal")[1];
    let sabtu = tambahHari(pertama, 14);
    while (hariKe(sabtu) !== 6) sabtu = tambahHari(sabtu, 1);
    const semula = tgl.value;
    tgl.value = sabtu;
    tgl.dispatchEvent(new h.w.Event("change"));
    // Ditolak saat dipilih: tanggal lama kembali, sebabnya disebut.
    expect(tgl.value).toBe(semula);
    expect(kotak.querySelectorAll(".aleta-cc-catatan")[1].textContent).toMatch(/hari Sabtu - tidak dapat dipilih/);
    kotak.querySelector(".aleta-cc-input").click();
    kotak.querySelector(".aleta-cc-input").click();
    await sampai(() => barisUi(kotak).every((b) => b.keadaan === "tersimpan"), "selesai");
    const sebutSabtu = sabtu.split("-").reverse().join("/");
    expect(kirimanSimpan(h).some((k) => k.badan.includes(sebutSabtu) || k.badan.includes(encodeURIComponent(sebutSabtu)))).toBe(false);
  });

  it("mode coba (UI Baru tanpa izin tindakan nyata): tidak satu POST pun sampai ke SIPP", async () => {
    const h = buka({ simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: false }, peran: "Super Admin" });
    const kotak = await bukaCc(h);
    kotak.querySelector(".aleta-cc-input").click();
    kotak.querySelector(".aleta-cc-input").click();
    await sampai(() => /mode coba/.test(kotak.querySelector(".aleta-cc-kabar").textContent), "ditahan");
    expect(kirimanSimpan(h)).toHaveLength(0);
    expect(h.sipp).toHaveLength(0);
  });

  it("mode kering: tidak ada yang dikirim ke SIPP", async () => {
    const h = buka({ simpanan: { ...UI, modeKering: true }, peran: "Super Admin" });
    const kotak = await bukaCc(h);
    await sampai(() => h.w.alatKeringNyala && h.w.alatKeringNyala(), "kering menyala");
    kotak.querySelector(".aleta-cc-input").click();
    kotak.querySelector(".aleta-cc-input").click();
    await sampai(() => /Mode kering/.test(kotak.querySelector(".aleta-cc-kabar").textContent), "ditahan");
    expect(kirimanSimpan(h)).toHaveLength(0);
  });
});
