// @vitest-environment node
/**
 * ============================================================================
 * REGISTER KUASA HUKUM PER PERKARA (3 Nov 2026, migrasi 0132)
 * ============================================================================
 *   1. migrasi 0132 = DDL di schema.ts = urutan penyimpanan; jurnal idx 114 naik dari entri terakhir;
 *   2. aturan murni: satu nama kuasa (tanpa gelar/spasi) = satu register; pihak lain ikut; register BARU hanya
 *      bila tanggal surat kuasa lain; salinan di ekstensi (kuasa-register.js) memberi hasil yang SAMA;
 *   3. server: simpan (upsert per perkara+nama+tanggal), baca, usulan #8539#/#0132# untuk blangko;
 *   4. borang kuasa SIPP di jsdom: dua baris di bawah Tanggal Surat Kuasa bergaya baris SIPP (salinan), tanpa name,
 *      terisi otomatis dari kuasa yang sama, kosong untuk register baru, disimpan SESUDAH SIPP menjawab berhasil.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import { kunciNamaKuasa, pilihRegister, tanggalIso, tanggalTampil, type RegisterKuasa } from "@/lib/register-kuasa";
import { DDL_ALETA_REGISTER_KUASA } from "@/server/db/schema";
import { bacaRegisterKuasa, simpanRegisterKuasa, usulanRegisterKuasa, type BarisRegisterKuasa } from "@/server/modules/aleta-ecourt/register-kuasa";

const AKAR = path.resolve(process.cwd(), "..");
const EKS = path.join(AKAR, "ekstensi-sipp");
const KODE_ASLI = readFileSync(path.join(EKS, "kuasa-register.js"), "utf8");
// Skrip konten dijalankan sebagai skrip biasa (deklarasi menjadi global); eval ketat menyimpannya lokal, jadi arahan ketat dibuang di uji.
const KODE = KODE_ASLI.replace(/^"use strict";/, "");
const SQL = readFileSync(path.join(process.cwd(), "drizzle/0132_aleta_register_kuasa.sql"), "utf8");
const JURNAL = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; when: number; tag: string }> };
const KLIEN = readFileSync(path.join(process.cwd(), "src/server/db/client.ts"), "utf8");

const rapat = (s: string) => s.replace(/--.*$/gm, "").replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")").trim();

describe("migrasi 0132", () => {
  it("SQL = DDL schema.ts; jurnal idx 114 naik; tabel terdaftar di urutan penyimpanan", () => {
    const sqlTabel = /CREATE TABLE IF NOT EXISTS aleta_register_kuasa \([\s\S]*?\n\);/.exec(SQL)![0].replace(/;$/, "");
    expect(rapat(DDL_ALETA_REGISTER_KUASA.tabel[0])).toBe(rapat(sqlTabel));
    expect(rapat(DDL_ALETA_REGISTER_KUASA.indeks[0])).toBe(rapat(/CREATE INDEX IF NOT EXISTS[^;]+/.exec(SQL)![0]));
    const e = JURNAL.entries;
    // Dicari menurut tag (bukan entri terakhir): migrasi sesudahnya (0133 pustaka ALETA ABT) menambah entri di belakang.
    const i = e.findIndex((x) => x.tag === "0132_aleta_register_kuasa");
    const terakhir = e[i];
    expect(terakhir).toMatchObject({ idx: 114, tag: "0132_aleta_register_kuasa" });
    expect(terakhir.when).toBeGreaterThan(e[i - 1].when);
    expect(new Set(e.map((x) => x.idx)).size).toBe(e.length);
    expect(KLIEN).toContain('"aleta_register_kuasa"');
    expect(SQL).not.toMatch(/REFERENCES|FOREIGN KEY/i);
  });
});

describe("aturan murni", () => {
  it("nama kuasa: tanpa gelar, tanda baca, spasi, huruf besar", () => {
    const sama = ["Rahmat Hidayat, S.H.", "RAHMAT HIDAYAT S.H., M.H.", "rahmat  hidayat", "Adv. Rahmat Hidayat, SH", "Rahmat Hidayat S. H."];
    const kunci = new Set(sama.map(kunciNamaKuasa));
    expect([...kunci]).toEqual(["rahmathidayat"]);
    expect(kunciNamaKuasa("Ahmad S. Mardjanu, S.H.")).toBe("ahmadsmardjanu");
    expect(kunciNamaKuasa("Siti Aminah")).not.toBe(kunciNamaKuasa("Siti Aminah Rahman"));
    expect(kunciNamaKuasa("")).toBe("");
  });

  it("tanggal: dd/mm/yyyy dan ISO; tanggal mustahil ditolak", () => {
    expect(tanggalIso("04/11/2026")).toBe("2026-11-04");
    expect(tanggalIso("4-1-2026")).toBe("2026-01-04");
    expect(tanggalIso("2026-11-04")).toBe("2026-11-04");
    expect(tanggalIso("31/02/2026")).toBe("");
    expect(tanggalIso("tgl/bln/tahun")).toBe("");
    expect(tanggalTampil("2026-11-04")).toBe("04/11/2026");
  });

  const R1: RegisterKuasa = { nomorRegister: "12/SK/X/2026", tanggalRegister: "2026-10-02", tanggalSuratKuasa: "2026-10-01" };
  const R2: RegisterKuasa = { nomorRegister: "15/SK/XI/2026", tanggalRegister: "2026-11-03", tanggalSuratKuasa: "2026-11-02" };

  it("pihak lain, kuasa sama: tanpa tanggal -> pakai yang ada; tanggal sama -> register itu; tanggal lain -> BARU", () => {
    expect(pilihRegister([], "01/10/2026")).toEqual({ jenis: "kosong" });
    expect(pilihRegister([R1], "")).toMatchObject({ jenis: "pakai", register: R1, sebab: "belum-ada-tanggal" });
    expect(pilihRegister([R1], "01/10/2026")).toMatchObject({ jenis: "pakai", register: R1, sebab: "sama-tanggal" });
    expect(pilihRegister([R1], "02/11/2026")).toEqual({ jenis: "baru", lain: [R1] });
    expect(pilihRegister([R1, R2], "02/11/2026")).toMatchObject({ jenis: "pakai", register: R2 });
    expect(pilihRegister([R1, R2], "")).toMatchObject({ jenis: "pakai", register: R2 });
  });

  it("register lama tanpa tanggal surat kuasa tidak menjadi pembeda", () => {
    const lama: RegisterKuasa = { nomorRegister: "9/SK/IX/2026", tanggalRegister: "2026-09-02", tanggalSuratKuasa: "" };
    expect(pilihRegister([lama], "05/10/2026")).toMatchObject({ jenis: "pakai", register: lama });
  });
});

describe("usulan untuk blangko (#8539# nomor, #0132# tanggal)", () => {
  const baris = (o: Partial<BarisRegisterKuasa>): BarisRegisterKuasa => ({
    id: "x",
    namaKuasa: "Rahmat Hidayat, S.H.",
    pihakKe: 1,
    pihakNama: "",
    tanggalSuratKuasa: "2026-10-01",
    nomorRegister: "12/SK/X/2026",
    tanggalRegister: "2026-10-02",
    diubahAt: "2026-11-03T01:00:00Z",
    ...o,
  });
  it("kuasa Penggugat -> dua usulan pasti, bertanda utama; Tergugat tidak ikut", () => {
    const u = usulanRegisterKuasa([baris({}), baris({ pihakKe: 2, nomorRegister: "99/SK/X/2026" })]);
    expect(u.map((x) => [x.kode, x.nilai, x.keyakinan, x.utama])).toEqual([
      ["8539", "12/SK/X/2026", "pasti", true],
      ["0132", "02/10/2026", "pasti", true],
    ]);
    expect(u[0].sumber[0].kalimat).not.toMatch(/aleta/i);
  });
  it("lebih dari satu register: yang pertama dipakai, keyakinan cukup, catatan menyebut semuanya", () => {
    const u = usulanRegisterKuasa([baris({}), baris({ nomorRegister: "15/SK/XI/2026", tanggalRegister: "2026-11-03", tanggalSuratKuasa: "2026-11-02" })]);
    expect(u[0]).toMatchObject({ nilai: "12/SK/X/2026", keyakinan: "cukup" });
    expect(u[0].catatan).toContain("15/SK/XI/2026");
  });
  it("tanpa register: tidak ada usulan", () => {
    expect(usulanRegisterKuasa([])).toEqual([]);
    expect(usulanRegisterKuasa([baris({ nomorRegister: "", tanggalRegister: "" })])).toEqual([]);
  });
});


describe("simpan dan baca (pg-mem, SQL migrasi sungguhan)", () => {
  async function siapkan() {
    const mem = newDb();
    mem.public.none(SQL);
    const { Client } = mem.adapters.createPg();
    const c = new Client();
    await c.connect();
    const ubah = (q: string) => {
      let n = 0;
      return q.replace(/\?/g, () => `$${++n}`);
    };
    const db = {
      queryAll: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows,
      run: async (q: string, p: unknown[] = []) => {
        await c.query(ubah(q), p);
      },
    };
    return { db: db as never, baca: async () => (await c.query("SELECT * FROM aleta_register_kuasa ORDER BY id")).rows as Array<Record<string, unknown>> };
  }
  const NOMOR = "273/Pdt.G/2026/PA.Dgl";

  it("satu nama kuasa = satu baris per tanggal surat kuasa; pihak lain (nama ditulis lain) memakai baris yang sama", async () => {
    const { db, baca } = await siapkan();
    await simpanRegisterKuasa(db, "u1", { nomorPerkara: NOMOR, namaKuasa: "Rahmat Hidayat,S.H.", pihakKe: 1, pihakNama: "Bahar Bin Salam", tanggalSuratKuasa: "01/10/2026", nomorRegister: "12/SK/X/2026", tanggalRegister: "02/10/2026" });
    // pihak lain, kuasa sama (nama ditulis berbeda gelar/spasi), surat kuasa tanggal sama -> memperbarui baris yang SAMA
    await simpanRegisterKuasa(db, "u2", { nomorPerkara: NOMOR, namaKuasa: "RAHMAT HIDAYAT, S.H., M.H.", pihakKe: 1, pihakNama: "Gani Bin Umar", tanggalSuratKuasa: "01/10/2026", nomorRegister: "12/SK/X/2026", tanggalRegister: "02/10/2026" });
    expect(await baca()).toHaveLength(1);
    // kuasa ditambahkan pada tanggal lain -> register BARU
    await simpanRegisterKuasa(db, "u1", { nomorPerkara: NOMOR, namaKuasa: "Rahmat Hidayat, S.H.", pihakKe: 1, tanggalSuratKuasa: "05/11/2026", nomorRegister: "20/SK/XI/2026", tanggalRegister: "05/11/2026" });
    const baris = await baca();
    expect(baris).toHaveLength(2);
    expect(baris.map((b) => [b.nomor_register, b.tanggal_surat_kuasa])).toEqual([
      ["20/SK/XI/2026", "2026-11-05"],
      ["12/SK/X/2026", "2026-10-01"],
    ].sort());
    const daftar = await bacaRegisterKuasa(db, NOMOR, "rahmat hidayat");
    expect(daftar.map((d) => d.nomorRegister).sort()).toEqual(["12/SK/X/2026", "20/SK/XI/2026"]);
    expect(pilihRegister(daftar, "01/10/2026")).toMatchObject({ jenis: "pakai", sebab: "sama-tanggal" });
    expect(await bacaRegisterKuasa(db, NOMOR, "Orang Lain")).toEqual([]);
    expect(await bacaRegisterKuasa(db, "bukan nomor", "x")).toEqual([]);
  });

  it("nomor dan tanggal kosong tidak membuat baris; tanggal tak sah dan nomor perkara tak sah ditolak dengan pesan awam", async () => {
    const { db, baca } = await siapkan();
    expect(await simpanRegisterKuasa(db, "u1", { nomorPerkara: NOMOR, namaKuasa: "Rahmat Hidayat", nomorRegister: "", tanggalRegister: "" })).toMatchObject({ disimpan: false });
    expect(await baca()).toHaveLength(0);
    await expect(simpanRegisterKuasa(db, "u1", { nomorPerkara: NOMOR, namaKuasa: "Imam", nomorRegister: "1", tanggalRegister: "31/02/2026" })).rejects.toThrow(/tanggal register/i);
    await expect(simpanRegisterKuasa(db, "u1", { nomorPerkara: "ngawur", namaKuasa: "Imam", nomorRegister: "1" })).rejects.toThrow(/nomor perkara/i);
    await expect(simpanRegisterKuasa(db, "u1", { nomorPerkara: NOMOR, namaKuasa: "S.H.", nomorRegister: "1" })).rejects.toThrow(/nama kuasa/i);
  });
});

// ── Ekstensi ────────────────────────────────────────────────────────────────

const FORM_KUASA = (opsi: { nama?: string; tglSurat?: string; pihakKe?: string } = {}) => `<!doctype html><html><body>
<div id="popup_form" class="popup"><div class="centering" style="width:460px"><div class="detil">
<form id="frm_user" method="post" action="http://192.168.10.10/SIPP/addPengacara/validateInput">
<table id="tableDetilPerkara"><col width="38%"><col width="62%"><tbody>
<tr><td colspan="2">TAMBAH DATA KUASA HUKUM PENGGUGAT</td></tr>
<tr><td>Para Pihak <font color="red">*</font></td><td><input type="checkbox" name="para_pihak[]" value="a" checked> Bahar Bin Salam<br><input type="checkbox" name="para_pihak[]" value="b"> Gani Bin Umar<br></td><input type="hidden" id="pihak_ke" name="pihak_ke" value="${opsi.pihakKe || "1"}"></tr>
<tr><td>Nama <font color="red">*</font></td><td style="padding:0px;padding-left:5px;"><input type="text" id="fullname" name="fullname" value="${opsi.nama ?? "Rahmat Hidayat,S.H."}" class="standard-input" readonly></td></tr>
<tr><td>Nomor Surat Kuasa<font color="red">*</font></td><td style="padding:0px;padding-left:5px;"><input id="nmr_kuasa" name="nmr_kuasa" value="" class="standard-input" maxlength="255"></td></tr>
<tr><td>Tanggal Surat Kuasa<font color="red">*</font></td><td style="padding:0px;padding-left:5px;"><input id="tgl_kuasa" name="tgl_kuasa" value="${opsi.tglSurat ?? ""}" class="datepicker hasDatepicker" maxlength="10" placeholder="tgl/bln/tahun"></td></tr>
<tr><td>Keterangan</td><td><textarea id="keterangan" name="keterangan"></textarea></td></tr>
<tr><td colspan="2"><input type="submit" id="simpan" value="Simpan"></td></tr>
</tbody></table></form></div></div></div></body></html>`;

const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, apa: string, batas = 2500): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${apa}`);
    await tunggu(5);
  }
}

type Daftar = Array<{ nomorRegister: string; tanggalRegister: string; tanggalSuratKuasa: string }>;

function buka(opsi: { daftar?: Daftar; formulir?: Parameters<typeof FORM_KUASA>[0]; modeUi?: boolean; kirimOk?: boolean; kirimStatus?: number } = {}) {
  const dom = new JSDOM(FORM_KUASA(opsi.formulir), { url: "http://192.168.10.10/SIPP/detil_perkara_agama", runScripts: "outside-only" });
  const w = dom.window as any;
  const diminta: string[] = [];
  const jembatan: any[] = [];
  const dikirim: any[] = [];
  w.saksiscanModeUi = () => opsi.modeUi !== false;
  w.saksiscanTampak = () => true;
  w.saksiscanEl = (tag: string, kelas: string, teks?: string) => Object.assign(w.document.createElement(tag), { className: kelas || "", textContent: teks == null ? "" : String(teks) });
  w.saksiscanJembatan = async (p: any) => {
    jembatan.push(p);
    return { ok: true };
  };
  w.cariNomorPerkara = () => "273/Pdt.G/2026/PA.Dgl";
  w.alatAmbil = async (alamat: string) => {
    diminta.push(alamat);
    return { ok: true, status: 200, json: async () => ({ data: { daftar: opsi.daftar || [] } }) };
  };
  w.fetch = async (alamat: string, o: any) => {
    dikirim.push({ alamat, o, badan: o && o.body ? JSON.parse(o.body) : null });
    const status = opsi.kirimStatus ?? (opsi.kirimOk === false ? 500 : 200);
    return { ok: status < 400, status, json: async () => ({}) };
  };
  w.eval(KODE);
  return { dom, w, diminta, jembatan, dikirim, doc: w.document as Document };
}

const baris = (doc: Document, jenis: string) => doc.querySelector(`[data-aleta-register="${jenis}"]`) as HTMLTableRowElement | null;
const isian = (doc: Document, jenis: string) => baris(doc, jenis)!.querySelector("input") as HTMLInputElement;

describe("salinan aturan di ekstensi sama dengan TypeScript", () => {
  const { w } = buka();
  const J = w.eval("({krKunciNama, krTanggalIso, krPilihRegister, krTanggalTampil})");
  it("kunci nama dan tanggal", () => {
    for (const n of ["Rahmat Hidayat, S.H.", "ADV. RAHMAT HIDAYAT SH MH", "Ahmad S. Mardjanu, S.H.", "Dr. H. Ali Murtadha, M.Kn", "", "  "]) expect(J.krKunciNama(n)).toBe(kunciNamaKuasa(n));
    for (const t of ["04/11/2026", "4-1-2026", "2026-11-04", "31/02/2026", "tgl/bln/tahun", "", "01/01/1850"]) expect(J.krTanggalIso(t)).toBe(tanggalIso(t));
    expect(J.krTanggalTampil("2026-11-04")).toBe(tanggalTampil("2026-11-04"));
  });
  it("pilihan register", () => {
    const R1 = { nomorRegister: "12/SK/X/2026", tanggalRegister: "2026-10-02", tanggalSuratKuasa: "2026-10-01" };
    const R2 = { nomorRegister: "15/SK/XI/2026", tanggalRegister: "2026-11-03", tanggalSuratKuasa: "2026-11-02" };
    const lama = { nomorRegister: "9/SK/IX/2026", tanggalRegister: "2026-09-02", tanggalSuratKuasa: "" };
    for (const [d, t] of [[[], "01/10/2026"], [[R1], ""], [[R1], "01/10/2026"], [[R1], "02/11/2026"], [[R1, R2], "02/11/2026"], [[R1, R2], ""], [[lama], "05/10/2026"]] as Array<[any[], string]>) {
      expect(JSON.parse(JSON.stringify(J.krPilihRegister(d, t)))).toEqual(JSON.parse(JSON.stringify(pilihRegister(d, t))));
    }
  });
});

describe("borang kuasa SIPP", () => {
  it("dua baris tepat di bawah Tanggal Surat Kuasa, salinan baris SIPP, tanpa name/id, tidak ikut terkirim", async () => {
    const t = buka();
    await t.w.krPeriksa();
    const nomor = baris(t.doc, "nomor")!;
    const tanggal = baris(t.doc, "tanggal")!;
    const trSurat = (t.doc.querySelector("#tgl_kuasa") as HTMLElement).closest("tr")!;
    expect(trSurat.nextElementSibling).toBe(nomor);
    expect(nomor.nextElementSibling).toBe(tanggal);
    expect(nomor.querySelector("td")!.textContent).toBe("Nomor Register Kuasa");
    expect(tanggal.querySelector("td")!.textContent).toBe("Tanggal Register Kuasa");
    // gaya sama persis dengan baris SIPP di sekitarnya
    const trNomorSurat = (t.doc.querySelector("#nmr_kuasa") as HTMLElement).closest("tr")!;
    expect(nomor.querySelectorAll("td")[1].getAttribute("style")).toBe(trNomorSurat.querySelectorAll("td")[1].getAttribute("style"));
    // bukan kelas aleta-sisip (gayanya menambah latar/jarak) - tampak persis seperti baris SIPP; penanda data-aleta-tanda
    expect(nomor.classList.contains("aleta-sisip")).toBe(false);
    expect(nomor.getAttribute("data-aleta-tanda")).toBe("register");
    expect(trNomorSurat.className).toBe(nomor.className.replace("aleta-reg-baris", "").trim());
    expect(isian(t.doc, "nomor").className).toContain("standard-input");
    expect(isian(t.doc, "tanggal").getAttribute("placeholder")).toBe("tgl/bln/tahun");
    expect(isian(t.doc, "tanggal").className).not.toContain("hasDatepicker");
    for (const j of ["nomor", "tanggal"]) {
      const i = isian(t.doc, j);
      expect(i.hasAttribute("id")).toBe(false);
      expect(i.hasAttribute("name")).toBe(false);
    }
    // tidak ada kata ALETA di label/isian yang tampil
    expect(`${nomor.textContent}${tanggal.textContent}`).not.toMatch(/aleta/i);
    // borang yang dikirim ke SIPP tidak membawa isian baru
    const data = new t.w.FormData(t.doc.querySelector("#frm_user"));
    expect([...data.keys()].filter((k: string) => /regist/i.test(k))).toEqual([]);
    // tidak ditambahkan dua kali
    await t.w.krPeriksa();
    expect(t.doc.querySelectorAll("[data-aleta-register]").length).toBe(2);
  });

  it("kuasa sama untuk pihak lain: nomor & tanggal register diisikan otomatis (tanpa tanggal surat kuasa; lalu tanggal yang sama)", async () => {
    const daftar = [{ nomorRegister: "12/SK/X/2026", tanggalRegister: "2026-10-02", tanggalSuratKuasa: "2026-10-01" }];
    const t = buka({ daftar });
    await t.w.krPeriksa();
    await t.w.krPeriksa();
    await sampai(() => isian(t.doc, "nomor").value === "12/SK/X/2026", "nomor terisi");
    expect(isian(t.doc, "tanggal").value).toBe("02/10/2026");
    expect(t.diminta).toHaveLength(1);
    expect(t.diminta[0]).toContain("/aleta/api/aleta-ecourt/register-kuasa?");
    expect(decodeURIComponent(t.diminta[0])).toContain("nomor=273/Pdt.G/2026/PA.Dgl");
    // tanggal surat kuasa sama: tetap
    (t.doc.querySelector("#tgl_kuasa") as HTMLInputElement).value = "01/10/2026";
    await t.w.krPeriksa();
    expect(isian(t.doc, "nomor").value).toBe("12/SK/X/2026");
    expect(t.diminta).toHaveLength(1); // daftar kuasa itu sudah di simpanan: tidak dibaca ulang
  });

  it("kuasa ditambahkan pada tanggal LAIN: register baru - isian dikosongkan, catatan memberi pilihan memakai yang lama", async () => {
    const daftar = [{ nomorRegister: "12/SK/X/2026", tanggalRegister: "2026-10-02", tanggalSuratKuasa: "2026-10-01" }];
    const t = buka({ daftar });
    await t.w.krPeriksa();
    await sampai(() => isian(t.doc, "nomor").value === "12/SK/X/2026", "terisi");
    (t.doc.querySelector("#tgl_kuasa") as HTMLInputElement).value = "05/11/2026";
    await t.w.krPeriksa();
    expect(isian(t.doc, "nomor").value).toBe("");
    expect(isian(t.doc, "tanggal").value).toBe("");
    const catatan = t.doc.querySelector(".aleta-kr-catatan")!;
    expect(catatan.textContent).toContain("isi register baru");
    // petugas memilih memakai register lama
    (catatan.querySelector("button") as HTMLButtonElement).click();
    expect(isian(t.doc, "nomor").value).toBe("12/SK/X/2026");
  });

  it("isian yang sudah disunting petugas tidak ditimpa", async () => {
    const daftar = [{ nomorRegister: "12/SK/X/2026", tanggalRegister: "2026-10-02", tanggalSuratKuasa: "2026-10-01" }];
    const t = buka({ daftar, formulir: { tglSurat: "01/10/2026" } });
    await t.w.krPeriksa();
    await sampai(() => isian(t.doc, "nomor").value === "12/SK/X/2026", "terisi");
    const n = isian(t.doc, "nomor");
    n.value = "77/SK/X/2026";
    n.dispatchEvent(new t.w.Event("input", { bubbles: true }));
    (t.doc.querySelector("#tgl_kuasa") as HTMLInputElement).value = "05/11/2026";
    await t.w.krPeriksa();
    expect(n.value).toBe("77/SK/X/2026");
  });

  it("garis miring tanggal otomatis seperti isian tanggal SIPP", async () => {
    const t = buka();
    await t.w.krPeriksa();
    const i = isian(t.doc, "tanggal");
    i.value = "04";
    i.dispatchEvent(new t.w.Event("input", { bubbles: true }));
    expect(i.value).toBe("04/");
    i.value = "04/11";
    i.dispatchEvent(new t.w.Event("input", { bubbles: true }));
    expect(i.value).toBe("04/11/");
  });

  async function kirimBorang(t: ReturnType<typeof buka>, nomor: string, tanggal: string) {
    await t.w.krPeriksa();
    isian(t.doc, "nomor").value = nomor;
    isian(t.doc, "tanggal").value = tanggal;
    t.dom.window.document.querySelector("#frm_user")!.dispatchEvent(new t.w.Event("submit", { bubbles: true, cancelable: true }));
    const dengar = [...t.jembatan].reverse().find((j) => j.jenis === "dengar-simpan");
    return dengar;
  }
  const jawabSipp = (t: ReturnType<typeof buka>, bukti: string, isi: Record<string, unknown>) =>
    t.w.dispatchEvent(new t.w.MessageEvent("message", { source: t.w, data: { sumber: "aleta-jembatan-jawab", jenis: "bukti-simpan", id: bukti, ...isi } }));

  it("Simpan: jembatan MENDENGAR jawaban SIPP; hanya st 1 yang dikirim ke ALETA, dengan data borang", async () => {
    const t = buka({ formulir: { tglSurat: "01/10/2026" } });
    const dengar = await kirimBorang(t, "12/SK/X/2026", "02/10/2026");
    expect(dengar).toMatchObject({ jenis: "dengar-simpan", borang: 'form#frm_user[action*="addPengacara/validateInput"]' });
    expect(t.dikirim).toHaveLength(0); // belum: SIPP belum menjawab
    jawabSipp(t, dengar.bukti, { st: 1, pesan: "Berhasil ditambahkan." });
    await sampai(() => t.dikirim.length === 1, "dikirim sesudah SIPP berhasil");
    expect(t.dikirim[0].alamat).toBe("/aleta/api/aleta-ecourt/register-kuasa");
    expect(t.dikirim[0].o.method).toBe("POST");
    expect(t.dikirim[0].badan).toEqual({
      nomorPerkara: "273/Pdt.G/2026/PA.Dgl",
      namaKuasa: "Rahmat Hidayat,S.H.",
      pihakKe: 1,
      pihakNama: "Bahar Bin Salam",
      tanggalSuratKuasa: "01/10/2026",
      nomorRegister: "12/SK/X/2026",
      tanggalRegister: "02/10/2026",
    });
  });

  it("SIPP menolak (st 0) atau tidak menjawab: tidak ada yang disimpan; kedua isian kosong: tidak ada permintaan", async () => {
    const t = buka();
    const d1 = await kirimBorang(t, "12/SK/X/2026", "02/10/2026");
    jawabSipp(t, d1.bukti, { st: 0, pesan: "Peringatan: Format Tanggal Tidak Benar" });
    await tunggu(40);
    expect(t.dikirim).toHaveLength(0);
    const t2 = buka();
    const d2 = await kirimBorang(t2, "", "");
    expect(d2).toBeUndefined();
    expect(t2.dikirim).toHaveLength(0);
  });

  it("pengiriman lama yang dibatalkan tidak menimpa yang baru; jawaban asal popup tanpa st dibaca dari kata 'berhasil'", async () => {
    const t = buka();
    const d1 = await kirimBorang(t, "1/SK/X/2026", "01/10/2026");
    const d2 = await kirimBorang(t, "2/SK/X/2026", "02/10/2026");
    jawabSipp(t, d1.bukti, { st: 1, pesan: "Berhasil ditambahkan." });
    await tunggu(30);
    expect(t.dikirim).toHaveLength(0);
    jawabSipp(t, d2.bukti, { st: null, asal: "popup", pesan: "Penggugat Berhasil ditambahkan." });
    await sampai(() => t.dikirim.length === 1, "dikirim");
    expect(t.dikirim[0].badan.nomorRegister).toBe("2/SK/X/2026");
  });

  it("ALETA gagal tetapi SIPP berhasil: SIPP tetap tersimpan dan petugas diberi tahu dengan bahasa awam", async () => {
    const t = buka({ kirimOk: false });
    const d = await kirimBorang(t, "12/SK/X/2026", "02/10/2026");
    jawabSipp(t, d.bukti, { st: 1, pesan: "Berhasil ditambahkan." });
    const toast = await sampai(() => t.doc.querySelector(".aleta-kr-toast"), "pemberitahuan");
    expect(toast.textContent).toContain("sudah tersimpan di SIPP");
    expect(toast.textContent).toContain("belum tersimpan");
  });

  it("akun tanpa hak panel (403): tidak ada pemberitahuan galat tiap Simpan", async () => {
    const t = buka({ kirimStatus: 403 });
    const d = await kirimBorang(t, "12/SK/X/2026", "02/10/2026");
    jawabSipp(t, d.bukti, { st: 1, pesan: "Berhasil ditambahkan." });
    await sampai(() => t.dikirim.length === 1, "dicoba sekali");
    await tunggu(40);
    expect(t.doc.querySelector(".aleta-kr-toast")).toBeNull();
  });

  it("tanggal register tak sah: tidak dikirim dan petugas diberi tahu", async () => {
    const t = buka();
    const d = await kirimBorang(t, "12/SK/X/2026", "31/02/2026");
    expect(d).toBeUndefined();
    expect(t.doc.querySelector(".aleta-kr-toast")!.textContent).toContain("tidak sah");
  });

  it("tampilan lama (bukan UI Baru): tidak ada baris tambahan", async () => {
    const t = buka({ modeUi: false });
    await t.w.krPeriksa();
    expect(t.doc.querySelectorAll("[data-aleta-register]").length).toBe(0);
  });
});

describe("terpasang", () => {
  it("modul malas, pemicu, daftar latar, daftar tanam, jembatan, rute", () => {
    const malas = readFileSync(path.join(EKS, "modul-malas.js"), "utf8");
    expect(malas).toContain('"kuasa-register": modul(["saksiscan"], ["kuasa-register.js"])');
    expect(malas).toContain("addPengacara/validateInput");
    expect(readFileSync(path.join(EKS, "latar.js"), "utf8")).toContain('"kuasa-register.js"');
    expect(readFileSync(path.join(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8")).toContain('"kuasa-register.js"');
    expect(readFileSync(path.join(EKS, "jembatan.js"), "utf8")).toContain('pesan.jenis === "dengar-simpan"');
    expect(KODE_ASLI.trimEnd().endsWith('.add("kuasa-register.js"); // K11-SELESAI')).toBe(true);
    const rute = readFileSync(path.join(process.cwd(), "src/app/api/aleta-ecourt/register-kuasa/route.ts"), "utf8");
    expect(rute).toContain('pastikanKapabilitas(db, actorUserId, "panel")');
    expect(rute).toContain("export async function POST");
    // SIPP tidak diubah: tidak ada SQL ke SIPP di modul server
    const tanpaKomentar = readFileSync(path.join(process.cwd(), "src/server/modules/aleta-ecourt/register-kuasa.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(tanpaKomentar).not.toMatch(/perkara_pengacara|from sipp|sipp\./i);
  });
});
