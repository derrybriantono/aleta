// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * ISI OTOMATIS DI BORANG PENETAPAN SIPP (penetapan-borang.js, 19 Okt 2026)
 * ============================================================================
 *
 * Replika borang SIPP 7.0.4 (edit_majelis_v / edit_panitera_v /
 * edit_juru_sita_v / edit_sidang_pertama_v) di jsdom, dengan panel-alat.js,
 * basmassal.js, konten.js, jembatan.js, dan penetapan-borang.js dijalankan
 * UTUH (harness ekstensi-penetapan-satu-klik):
 *
 *   - saran terisi dari usulan bot (sumber yang sama dengan panel);
 *   - majelis dipilih -> PP (SK) dan JS terpaut dimuat ulang dari bot;
 *   - ganti manual menang (juga dibawa ke borang PPP sesudahnya);
 *   - hari libur tidak dapat dipilih (daftar calon & kalender);
 *   - tidak ada kata "ALETA" di nilai borang;
 *   - tidak ada simpan otomatis (Simpan tidak ditekan, tidak ada submit,
 *     tidak ada kiriman tulis).
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const KONTEN = () =>
  (process.env.ALETA_UJI_KONTEN ? readFileSync(process.env.ALETA_UJI_KONTEN, "utf8") : baca("konten.js")).replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const BASMASSAL = baca("basmassal.js");
const JEMBATAN = baca("jembatan.js");
const BORANG = baca("penetapan-borang.js");

const ASAL = "http://192.168.10.10";
const NOMOR = "701/Pdt.G/2026/PA.Dgl";
const AKUN = "Derry Briantono";

const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, keterangan: string | (() => string), batas = 8000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${typeof keterangan === "function" ? keterangan() : keterangan}`);
    await tunggu(10);
  }
}

const HAKIM = [
  { hakimId: 32, nama: "Fahri Saifuddin", kode: "A1", jumlah: 3 },
  { hakimId: 33, nama: "Wakil Ketua", kode: "A2", jumlah: 4 },
  { hakimId: 30, nama: "Hakim Lain", kode: "A3", jumlah: 6 },
  { hakimId: 26, nama: "Himawan Tatura Wijaya", kode: "C1", jumlah: 5 },
  { hakimId: 28, nama: "Idris", kode: "C2", jumlah: 5 },
  { hakimId: 31, nama: "Derry Briantono", kode: "C3", jumlah: 2 },
];
const nama = (id: number) => HAKIM.find((h) => h.hakimId === id)!.nama;
const SUSUNAN = [
  { kunci: "26-33-31", hakimId: [26, 33, 31], majelisKode: "", perkara: 1 },
  { kunci: "32-33-30", hakimId: [32, 33, 30], majelisKode: "A", perkara: 3 },
  { kunci: "26-28-31", hakimId: [26, 28, 31], majelisKode: "C", perkara: 5 },
].map((s) => ({ ...s, anggota: s.hakimId.map((id) => ({ hakimId: id, nama: nama(id) })) }));
const PP = [
  { id: 40, paniteraId: 40, nama: "Budi PP", jumlah: 7 },
  { id: 41, paniteraId: 41, nama: "Sri Susilowati", jumlah: 9 },
  { id: 42, paniteraId: 42, nama: "Joko PP", jumlah: 2 },
];
const JS = [
  { id: 11, jurusitaId: 11, nama: "Rina JS", jumlah: 10 },
  { id: 12, jurusitaId: 12, nama: "Tanty", jumlah: 8 },
  { id: 13, jurusitaId: 13, nama: "Umar JS", jumlah: 12 },
];

type Opsi = { ketuaTercatat?: number; phsUsulan?: string; calonPhs?: string[] };

/** Bentuk usulan bot (usulanPenunjukan) - majelis bawaan A; ?majelis= menyusun ulang PP/JS terpaut. */
function usulanUntuk(majelis: number[] | null, o: Opsi) {
  const anggotaId = majelis || (o.ketuaTercatat === 26 ? [26, 28, 31] : [32, 33, 30]);
  const kodeC = anggotaId[0] === 26;
  const ppUsul = kodeC ? { ...PP[1], kodeSk: "PP-C", dariSk: true } : { ...PP[0], kodeSk: "PP-A", dariSk: true };
  const jsUsul = kodeC ? JS[1] : JS[0];
  const susun = SUSUNAN.find((s) => s.hakimId.join("-") === anggotaId.join("-"));
  const phsUsulan = o.phsUsulan || "2026-12-18";
  const calon = (o.calonPhs || ["2026-12-18", "2026-12-25", "2027-01-01", "2027-01-08"]).map((t, i) => ({
    tanggal: t,
    sebut: t,
    usulan: i === 0,
    pekan: i,
    libur: "",
    jumlahSidang: i,
  }));
  return {
    ok: true,
    perkara: { perkaraId: 10301, nomorPerkara: NOMOR, jenisPerkaraId: 347, tanggalDaftar: "2026-10-15" },
    penetapan: o.ketuaTercatat
      ? { ada: true, pmh: "2026-10-19", ppp: "", pjs: "", phs: "", majelisNama: anggotaId.map(nama).join(", ") }
      : { ada: false, pmh: "", ppp: "", pjs: "", phs: "" },
    tanggalPenetapan: "2026-10-19",
    pmh: {
      bentuk: "majelis",
      majelisKode: susun ? susun.majelisKode : "",
      sebab: susun && susun.majelisKode ? `giliran Majelis ${susun.majelisKode} menurut SK` : "di luar SK",
      anggota: anggotaId.map((id) => ({ hakimId: id, nama: nama(id) })),
      hitungan: HAKIM.map((h) => ({ hakimId: h.hakimId, nama: h.nama, jumlah: h.jumlah })),
      susunanTerpakai: SUSUNAN,
    },
    ppp: {
      usulan: ppUsul,
      calon: [ppUsul, ...PP.filter((p) => p.id !== ppUsul.id)],
      sebab: `panitera sidang Majelis ${kodeC ? "C" : "A"} menurut SK`,
    },
    pjs: { usulan: jsUsul, calon: JS, sebab: "giliran juru sita" },
    phs: { usulan: phsUsulan, sebut: phsUsulan, calon, sebab: "hari sidang majelis" },
    tercatat: { ada: Boolean(o.ketuaTercatat), ketuaHakimId: o.ketuaTercatat || 0 },
  };
}

const opsiHakim = () => `<option value="0">Pilih Nama Hakim</option>` + HAKIM.map((h) => `<option value="${h.hakimId}">${h.nama}</option>`).join("");

const KEPALA_BORANG = (aksi: string) =>
  `<tr><td colspan="2"><strong>${aksi}</strong></td></tr>` +
  `<tr><td id="first-child">Nomor Perkara</td><td><span>${NOMOR}<input type="hidden" name="enc" value="xyz"></span></td></tr>`;

const PMH = (kunci = false) => `
<form id="frm_majelis" class="removeformbottomspace" method="post" action="${ASAL}/SIPP/addMajelis_c/f_validate_input_add">
<table id="tableDetilPerkara"><tbody>
${KEPALA_BORANG("Tambah Penetapan Hakim/Majelis Hakim")}
<tr><td>Tanggal Penetapan</td><td><input id="tgl_penetapan_majelis" name="tgl_penetapan_majelis" class="datepicker" maxlength="10"><input type="hidden" name="ism" id="ism" value="${kunci ? "1" : "4"}"><input type="hidden" name="modelhakim" id="modelhakim"></td></tr>
<tr><td>Majelis Hakim/Hakim Tunggal</td><td><select id="model_hakim" name="pilihan_majelis"><option value="">-pilih-</option><option value="tunggal">Hakim Tunggal</option><option value="majelis">Majelis Hakim</option></select></td></tr>
<tr class="tunggal tgl" style="display:none"><td>Hakim Tunggal</td><td><select id="hakim_tunggal" name="hakim_tunggal">${opsiHakim()}</select></td></tr>
<tr class="majelis"><td>Hakim Ketua</td><td><select id="hakim_ketua" name="hakim_ketua" class="nama_hakim"${kunci ? " disabled" : ""}>${opsiHakim()}</select></td></tr>
<tr class="majelis"><td>Hakim Anggota 1</td><td><select id="hakim_anggota1" name="hakim_anggota1" class="nama_hakim"${kunci ? " disabled" : ""}>${opsiHakim()}</select></td></tr>
<tr class="majelis"><td>Hakim Anggota 2</td><td><select id="hakim_anggota2" name="hakim_anggota2" class="nama_hakim"${kunci ? " disabled" : ""}>${opsiHakim()}</select></td></tr>
<tr class="majelis"><td>Hakim Anggota 3</td><td><select id="hakim_anggota3" name="hakim_anggota3" class="nama_hakim">${opsiHakim()}</select></td></tr>
<tr><td>Keterangan</td><td><textarea id="keterangan" name="keterangan"></textarea></td></tr>
<tr><td></td><td><input type="button" id="tinjau" value="Tinjau"><input type="button" id="close_form_add_majelis" value="Kembali"><input type="submit" id="simpan" value="Simpan" class="btn"></td></tr>
</tbody></table></form>`;

const PPP = () => `
<form id="frm_panitera" method="post" action="${ASAL}/SIPP/addPanitera_c/f_validate_input_add">
<table id="tableDetilPerkara"><tbody>
${KEPALA_BORANG("Tambah Penunjukan Panitera Pengganti")}
<tr><td>Tanggal Penunjukan</td><td><input id="tgl_penunjukan_panitera" name="tgl_penunjukan_panitera" class="datepicker"></td></tr>
<tr><td>Panitera Pengganti</td><td><select id="panitera1" name="panitera1" class="nama_panitera"><option value="0"></option>${PP.map((p) => `<option value="${p.id}">${p.nama}</option>`).join("")}</select></td></tr>
<tr><td></td><td><input type="submit" id="simpan" value="Simpan" class="btn"></td></tr>
</tbody></table></form>`;

const PJS = () => `
<form id="frm_juru_sita" method="post" action="${ASAL}/SIPP/addJuruSita_c/f_validate_input_add">
<table id="tableDetilPerkara"><tbody>
${KEPALA_BORANG("Tambah Penunjukan Jurusita")}
<tr><td>Tanggal Penunjukan</td><td><input id="tgl_penunjukan_juru_sita" name="tgl_penunjukan_juru_sita" class="datepicker"></td></tr>
<tr><td>Jurusita</td><td><select id="juru_sita1" name="juru_sita1" class="nama_jurusita"><option value="0">Pilih Jurusita Pengganti</option>${JS.map((p) => `<option value="${p.id}">${p.nama}</option>`).join("")}</select></td></tr>
<tr><td></td><td><input type="submit" id="simpan" value="Simpan" class="btn"></td></tr>
</tbody></table></form>`;

const RUANG = [
  { id: 1, nama: "Ruang Sidang 1 Dalam Gedung", sifat: "dalam-gedung", dipakai: 120 },
  { id: 2, nama: "Ruang Sidang 2 Dalam Gedung", sifat: "dalam-gedung", dipakai: 40 },
  { id: 7, nama: "Sidang Keliling Sigi Biromaru", sifat: "keliling", dipakai: 18 },
];
const PHS = () => `
<form id="frm_sidang_pertama" method="post" action="${ASAL}/SIPP/addSidangPertama_c/f_validate_input_add">
<table id="tableDetilPerkara"><tbody>
${KEPALA_BORANG("Tambah Penetapan Hari Sidang Pertama")}
<tr><td>Tanggal Penetapan Hari Sidang Pertama</td><td><input id="tgl_penetapan_sidang_pertama" name="tgl_penetapan_sidang_pertama" class="datepicker"></td></tr>
<tr><td>Tanggal Hari Sidang Pertama</td><td><input id="tgl_sidang_pertama" name="tgl_sidang_pertama" class="datepicker"></td></tr>
<tr><td>Jam Sidang Pertama</td><td><input id="jam_sidang_pertama" name="jam_sidang_pertama" maxlength="5"></td></tr>
<tr><td>Agenda Sidang</td><td><textarea name="isi_agenda_sidang" id="isi_agenda_sidang"></textarea></td></tr>
<tr><td>Ruang Sidang</td><td><select name="ruangan" id="ruangan">${RUANG.map((r) => `<option value="${r.id}|${r.nama}">${r.nama}</option>`).join("")}</select></td></tr>
<tr><td></td><td><input type="hidden" id="action" name="action" value="add"><input type="submit" id="simpan" value="Simpan" class="btn"></td></tr>
</tbody></table></form>`;

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Kiriman = { url: string; cara: string; badan: string };

function buka(borang: string, opsi: Opsi = {}, simpanan: Record<string, unknown> = {}) {
  const kepala =
    `<table class="badge"><tr><td>Selamat Datang <font color='red'>${AKUN}</font>` +
    `<br> Anda Login Sebagai <font color='red'>Administrator</font></td></tr></table>`;
  const dom = new JSDOM(
    `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten">${kepala}<div id="popup_form"><div class="centering"><div class="detil">${borang}</div></div></div></div></body></html>`,
    { url: `${ASAL}/SIPP/perkara_detil_agama/xyz/2`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  w.TextDecoder = globalThis.TextDecoder;
  w.Response = globalThis.Response;
  Object.assign(simpanan, { ujiTampilan: simpanan.ujiTampilan ?? "ui", ujiIzinkanNyata: true });
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.11" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, polos(isi)),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const kiriman: Kiriman[] = [];
  w.fetch = async (alamat: string, init?: { method?: string; body?: string }) => {
    const url = String(alamat);
    const cara = String((init && init.method) || "GET").toUpperCase();
    kiriman.push({ url, cara, badan: String((init && init.body) || "") });
    let status = 200;
    let isi: unknown = { ok: true, data: {} };
    if (url.includes("/api/aleta-ecourt/ekstensi/tampilan")) {
      status = 404;
      isi = {};
    } else if (url.includes("/aleta-ecourt/ekstensi/siapa")) {
      isi = { ok: true, data: { nama: "SUPER ADMIN DERRY", peran: "Super Admin", kapabilitas: null } };
    } else if (url.includes("/aleta-bot/penunjukan/ruangan")) {
      isi = { ok: true, data: { ruangan: RUANG } };
    } else if (url.includes("/aleta-bot/penunjukan?")) {
      const q = new URL(url, ASAL).searchParams.get("majelis");
      const majelis = q ? q.split(",").map(Number) : null;
      isi = { ok: true, data: { available: true, usulan: usulanUntuk(majelis, opsi), rencana: { langkah: [] }, bolehOtomatis: true } };
    } else if (url.includes("/api/hari-libur")) {
      isi = { ok: true, data: { tambahan: [] } };
    } else if (url.includes("/aleta-bot/sipp-konteks?")) {
      isi = { ok: true, data: { available: false } };
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
  // jsdom tidak mengisi `source` pada postMessage; jembatan dan konten.js
  // sama-sama memeriksanya. Pesan diantar ulang dengan source = window.
  const tekan: string[] = [];
  w.postMessage = (data: any) => {
    if (data && data.sumber === "aleta-jembatan" && data.jenis === "tekan") tekan.push(String(data.penunjuk));
    setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data, source: w })), 0);
  };
  const simpan = { klik: 0, kirim: 0 };
  w.document.addEventListener("click", (e: Event) => {
    const t = e.target as HTMLElement | null;
    if (t && t.id === "simpan") simpan.klik += 1;
  }, true);
  w.document.addEventListener("submit", (e: Event) => {
    simpan.kirim += 1;
    e.preventDefault();
  }, true);
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext("alatSetelJedaSkala(0)", ctx);
  vm.runInContext(BASMASSAL, ctx, { filename: "basmassal.js" });
  vm.runInContext(KONTEN(), ctx, { filename: "konten.js" });
  vm.runInContext(JEMBATAN, ctx, { filename: "jembatan.js" });
  vm.runInContext(BORANG, ctx, { filename: "penetapan-borang.js" });
  const d = w.document as Document;
  return { w, d, kiriman, tekan, simpan, simpanan };
}

type Uji = ReturnType<typeof buka>;

/** Menekan "Isi otomatis" dan menunggu saran tergambar. */
async function bukaSaran(h: Uji) {
  const t = await sampai(() => {
    h.w.aletaPenetapanBorang.pasang(h.d);
    return h.d.querySelector('[data-pb-buka]') as HTMLButtonElement | null;
  }, "tombol Isi otomatis");
  t.click();
  return sampai(() => h.d.querySelector("[data-pb-terapkan]") as HTMLButtonElement | null, () => `saran; isi: ${String(h.d.querySelector("[data-pb-borang]")?.textContent || "").slice(0, 300)}`);
}
const nilaiBaris = (h: Uji, kunci: string) => String(h.d.querySelector(`[data-pb="${kunci}"] .aleta-pb-nilai`)?.textContent || "").replace(/(Ganti|Tutup)$/, "");
async function ganti(h: Uji, kunci: string, nilai: string) {
  const g = h.d.querySelector(`[data-pb-ganti="${kunci}"]`) as HTMLButtonElement;
  if (!h.d.querySelector(`[data-pb-pilih="${kunci}"]`)) g.click();
  const s = h.d.querySelector(`[data-pb-pilih="${kunci}"]`) as HTMLSelectElement;
  s.value = nilai;
  s.dispatchEvent(new h.w.Event("change", { bubbles: true }));
}
async function terapkan(h: Uji) {
  (h.d.querySelector("[data-pb-terapkan]") as HTMLButtonElement).click();
  return sampai(() => {
    const k = h.d.querySelector("[data-pb-kabar]");
    const t = h.d.querySelector("[data-pb-terapkan]") as HTMLButtonElement | null;
    return k && t && !t.disabled ? String(k.textContent) : "";
  }, "kabar terapkan");
}
const val = (h: Uji, sel: string) => (h.d.querySelector(sel) as HTMLInputElement).value;

/** Tidak ada tulisan: Simpan tidak ditekan, borang tidak dikirim, tidak ada POST/PATCH ke mana pun. */
function tanpaSimpan(h: Uji) {
  expect(h.simpan.klik).toBe(0);
  expect(h.simpan.kirim).toBe(0);
  expect(h.tekan).toEqual([]);
  expect(h.kiriman.filter((k) => k.cara !== "GET").map((k) => `${k.cara} ${k.url}`)).toEqual([]);
  expect(h.kiriman.some((k) => k.url.includes("/penunjukan/tulis") || k.url.includes("/penunjukan/catat"))).toBe(false);
}
/** Tidak ada kata ALETA di nilai mana pun yang terkirim bersama borang. */
function tanpaAleta(h: Uji, idBorang: string) {
  const f = h.d.getElementById(idBorang) as HTMLFormElement;
  for (const e of Array.from(f.elements) as HTMLInputElement[]) {
    if (!e.name) continue;
    expect(String(e.value), e.name).not.toMatch(/aleta/i);
  }
  // Panel saran berdiri di luar <form> - tidak ikut terkirim.
  expect(f.querySelector(".aleta-pb")).toBeNull();
}

describe("borang Penetapan Majelis Hakim", () => {
  it("saran terisi: majelis SK lebih dulu, beban tiap pilihan, PP dan JS terpaut", async () => {
    const h = buka(PMH());
    await bukaSaran(h);
    expect(nilaiBaris(h, "majelis")).toBe("A — Fahri Saifuddin · Wakil Ketua · Hakim Lain");
    expect(nilaiBaris(h, "kursi-0")).toBe("Fahri Saifuddin");
    expect(nilaiBaris(h, "ppp")).toBe("PP-A — Budi PP");
    expect(nilaiBaris(h, "pjs")).toBe("Rina JS");
    (h.d.querySelector('[data-pb-ganti="majelis"]') as HTMLButtonElement).click();
    const opsi = Array.from((h.d.querySelector('[data-pb-pilih="majelis"]') as HTMLSelectElement).options).map((o) => o.textContent);
    // Ber-kode SK di atas, yang di luar SK di bawah dan bertanda.
    expect(opsi[0]).toMatch(/^A — .* — beban 3$/);
    expect(opsi[1]).toMatch(/^C — .* — beban 5$/);
    expect(opsi[2]).toMatch(/di luar SK$/);
    tanpaSimpan(h);
  });

  it("majelis dipilih memicu PP/JS terpaut; ganti manual PP menang; Terapkan hanya mengisi kolom", async () => {
    const simpanan: Record<string, unknown> = {};
    const h = buka(PMH(), {}, simpanan);
    await bukaSaran(h);
    await ganti(h, "majelis", "26-28-31");
    await sampai(() => h.kiriman.some((k) => k.url.includes("majelis=26%2C28%2C31")), "usulan ulang untuk majelis C");
    await sampai(() => nilaiBaris(h, "ppp") === "PP-C — Sri Susilowati", () => `PP terpaut: ${nilaiBaris(h, "ppp")}`);
    expect(nilaiBaris(h, "pjs")).toBe("Tanty");
    expect(nilaiBaris(h, "majelis")).toMatch(/^C — Himawan/);

    // Ganti manual satu per satu walau majelis sudah dipilih.
    await ganti(h, "ppp", "42");
    await sampai(() => nilaiBaris(h, "ppp") === "Joko PP", "PP manual");
    await ganti(h, "pjs", "13");
    await sampai(() => nilaiBaris(h, "pjs") === "Umar JS", "JS manual");

    h.d.getElementById("hakim_anggota3")!.querySelector('option[value="30"]')!.setAttribute("selected", "");
    (h.d.getElementById("hakim_anggota3") as HTMLSelectElement).value = "30";
    const kabar = await terapkan(h);
    expect(kabar).toMatch(/Simpan SIPP sendiri/);
    expect(val(h, "#model_hakim")).toBe("majelis");
    expect([val(h, "#hakim_ketua"), val(h, "#hakim_anggota1"), val(h, "#hakim_anggota2")]).toEqual(["26", "28", "31"]);
    // Sisa kursi ke-4 dikosongkan, supaya majelis tiga orang tidak tersimpan berempat.
    expect(val(h, "#hakim_anggota3")).toBe("0");
    expect(val(h, "#tgl_penetapan_majelis")).toBe("19/10/2026");
    expect(val(h, "#keterangan")).toBe("");
    tanpaSimpan(h);
    tanpaAleta(h, "frm_majelis");

    // Borang PPP sesudahnya (PMH tercatat atas majelis C): PP pilihan tangan dibawa.
    const h2 = buka(PPP(), { ketuaTercatat: 26 }, simpanan);
    await bukaSaran(h2);
    await sampai(() => nilaiBaris(h2, "ppp") === "Joko PP", () => `PP dibawa: ${nilaiBaris(h2, "ppp")}`);
    await terapkan(h2);
    expect(val(h2, "#panitera1")).toBe("42");
    expect(val(h2, "#tgl_penunjukan_panitera")).toBe("19/10/2026");
    tanpaSimpan(h2);
    tanpaAleta(h2, "frm_panitera");
  });

  it("satu kursi diganti: kursi itu menang, PP/JS dipautkan ulang dari bot", async () => {
    const h = buka(PMH());
    await bukaSaran(h);
    await ganti(h, "kursi-0", "26");
    await sampai(() => h.kiriman.some((k) => k.url.includes("majelis=26%2C33%2C30")), "usulan ulang untuk susunan per orang");
    await sampai(() => nilaiBaris(h, "kursi-0") === "Himawan Tatura Wijaya", "ketua baru");
    await terapkan(h);
    expect([val(h, "#hakim_ketua"), val(h, "#hakim_anggota1"), val(h, "#hakim_anggota2")]).toEqual(["26", "33", "30"]);
    tanpaSimpan(h);
  });

  it("kolom dikunci Smart Majelis tidak diisi, Tinjau tidak ditekan, dan sebabnya disebut", async () => {
    const h = buka(PMH(true));
    await bukaSaran(h);
    const kabar = await terapkan(h);
    expect(kabar).toMatch(/dikunci SIPP \(rekomendasi Smart Majelis\)/);
    expect(kabar).toMatch(/tekan Tinjau/);
    expect(val(h, "#hakim_ketua")).toBe("0");
    tanpaSimpan(h);
  });
});

describe("borang Penunjukan Juru Sita", () => {
  it("JS terpaut pada majelis tercatat dapat diganti tangan dan yang tangan menang", async () => {
    const h = buka(PJS(), { ketuaTercatat: 26 });
    await bukaSaran(h);
    expect(nilaiBaris(h, "pjs")).toBe("Tanty");
    await ganti(h, "pjs", "11");
    await sampai(() => nilaiBaris(h, "pjs") === "Rina JS", "JS manual");
    await terapkan(h);
    expect(val(h, "#juru_sita1")).toBe("11");
    tanpaSimpan(h);
    tanpaAleta(h, "frm_juru_sita");
  });
});

describe("borang Penetapan Hari Sidang", () => {
  it("hari libur tidak dapat dipilih (calon & kalender); jam, ruang, sidang keliling terisi; tanpa simpan", async () => {
    const h = buka(PHS(), { ketuaTercatat: 26 });
    await bukaSaran(h);
    expect(nilaiBaris(h, "phs")).toMatch(/18-12-2026/);
    (h.d.querySelector('[data-pb-ganti="phs"]') as HTMLButtonElement).click();
    const opsi = Array.from((h.d.querySelector('[data-pb-pilih="phs"]') as HTMLSelectElement).options);
    const mati = opsi.filter((o) => o.disabled).map((o) => o.value);
    expect(mati).toEqual(["2026-12-25", "2027-01-01"]);
    expect(opsi.find((o) => o.value === "2026-12-25")!.textContent).toMatch(/Natal · tidak dapat dipilih/);

    // Kalender: Sabtu dan Natal ditolak, pilihan lama tetap; hari kerja diterima.
    const kal = () => h.d.querySelector('[data-pb-kalender="phs"]') as HTMLInputElement;
    for (const libur of ["2026-12-19", "2026-12-25", "2026-12-24"]) {
      kal().value = libur;
      kal().dispatchEvent(new h.w.Event("change", { bubbles: true }));
      await sampai(() => /Pilih (tanggal|hari kerja) lain/.test(String(h.d.querySelector("[data-pb-borang]")?.textContent || "")), () => `tolak ${libur}: ${String(h.d.querySelector("[data-pb-borang]")?.textContent || "").slice(0, 900)}`, 2000);
      expect(nilaiBaris(h, "phs")).toMatch(/18-12-2026/);
    }
    kal().value = "2026-12-22";
    kal().dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => /22-12-2026/.test(nilaiBaris(h, "phs")), "tanggal kalender diterima");

    await ganti(h, "jam", "10:00");
    await sampai(() => nilaiBaris(h, "jam") === "10:00", "jam");
    const cek = h.d.querySelector("[data-pb-sidkel]") as HTMLInputElement;
    cek.checked = true;
    cek.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => nilaiBaris(h, "ruangan") === "Sidang Keliling Sigi Biromaru", "ruang keliling");

    const kabar = await terapkan(h);
    expect(kabar).toMatch(/Simpan SIPP sendiri/);
    expect(val(h, "#tgl_penetapan_sidang_pertama")).toBe("19/10/2026");
    expect(val(h, "#tgl_sidang_pertama")).toBe("22/12/2026");
    expect(val(h, "#jam_sidang_pertama")).toBe("10:00");
    expect(val(h, "#ruangan")).toBe("7|Sidang Keliling Sigi Biromaru");
    expect(val(h, "#isi_agenda_sidang")).toBe("Sidang Pertama");
    tanpaSimpan(h);
    tanpaAleta(h, "frm_sidang_pertama");
  });

  it("bawaan tanpa pilihan: jam 09:00, ruang 1 dalam gedung", async () => {
    const h = buka(PHS(), { ketuaTercatat: 26 });
    await bukaSaran(h);
    await terapkan(h);
    expect(val(h, "#tgl_sidang_pertama")).toBe("18/12/2026");
    expect(val(h, "#jam_sidang_pertama")).toBe("09:00");
    expect(val(h, "#ruangan")).toBe("1|Ruang Sidang 1 Dalam Gedung");
    tanpaSimpan(h);
  });

  it("usulan yang jatuh pada hari libur ditahan - tidak ada kolom yang diisi", async () => {
    const h = buka(PHS(), { ketuaTercatat: 26, phsUsulan: "2026-12-25", calonPhs: ["2026-12-25", "2027-01-08"] });
    await bukaSaran(h);
    const kabar = await terapkan(h);
    expect(kabar).toMatch(/Natal/);
    expect(val(h, "#tgl_sidang_pertama")).toBe("");
    tanpaSimpan(h);
  });

  it("teks ber-ALETA tidak pernah diisikan ke borang", async () => {
    const h = buka(PHS(), { ketuaTercatat: 26 });
    await bukaSaran(h);
    const agenda = h.d.querySelector("[data-pb-agenda]") as HTMLInputElement;
    agenda.value = "Sidang Pertama (ALETA)";
    agenda.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    const kabar = await terapkan(h);
    expect(kabar).toMatch(/tidak diisikan ke SIPP/);
    expect(val(h, "#isi_agenda_sidang")).toBe("");
    expect(val(h, "#tgl_sidang_pertama")).toBe("");
    tanpaSimpan(h);
    tanpaAleta(h, "frm_sidang_pertama");
  });
});

describe("tampilan Lama dan borang edit tidak berubah", () => {
  it("tampilan Lama: tidak ada tombol", async () => {
    const h = buka(PMH(), {}, { ujiTampilan: "lama" });
    await tunggu(300);
    expect(h.w.aletaPenetapanBorang.pasang(h.d)).toBe(0);
    expect(h.d.querySelector("[data-pb-borang]")).toBeNull();
  });

  it("borang edit SIPP (f_validate_input_edit) tidak diberi tombol", async () => {
    const h = buka(PMH().replace("f_validate_input_add", "f_validate_input_edit"));
    await tunggu(300);
    expect(h.w.aletaPenetapanBorang.pasang(h.d)).toBe(0);
  });
});
