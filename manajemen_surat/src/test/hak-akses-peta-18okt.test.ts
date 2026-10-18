// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { jenisDokumenAkun } from "@/app/api/aleta-ecourt/blangko-derry/susun";
import {
  KEPUTUSAN_MENUNGGU,
  HAK_MENU_ABT,
  KEWENANGAN_KHUSUS,
  MENU_EKSTENSI,
  NAMA_GRUP_SIPP,
  PERUBAHAN_18OKT,
  SAKLAR_POPUP_RELEVAN,
  URUTAN_TINGKAT,
  butirUntukGolongan,
  modulTercakup,
  petaUntukPembaca,
  susunPetaHakAkses,
  tingkatButir,
  type ButirPeta,
} from "@/lib/hak-akses-peta";
import { susunMarkdownHakAkses } from "@/lib/hak-akses-dokumen";
import { AKSI, ATURAN_APLIKASI, GOLONGAN_PERAN, TAB_ECOURT, type GolonganPeran } from "@/lib/matriks-peran";
import { modules, portalApps } from "@/lib/mock-data";
import { KODE_IDE_L2 } from "@/lib/sipp-ide-l2";

/**
 * ============================================================================
 * PETA HAK AKSES PER PERAN - 18 Okt 2026
 * ============================================================================
 *
 *   1. kelengkapan: tiap fitur/menu/aksi/tab/aplikasi/menu ekstensi/penanda/blangko punya butir;
 *   2. Super Admin memegang tingkat tertinggi di SETIAP butir (dan semuanya ditampilkan);
 *   3. peran lain sesuai keputusan (unggah putusan, relaas, kasir, BAS, susun saksi, data pribadi, ...);
 *   4. cermin tabel menu ekstensi dan saklar popup SAMA dengan panel-alat.js / popup.js sungguhan;
 *   5. dokumen docs/hak-akses/MATRIKS-HAK-AKSES-18okt.md = keluaran peta (tidak menyimpang);
 *   6. teks yang dibaca pegawai tanpa label teknis.
 */

const AKAR = path.resolve(__dirname, "../../..");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");

const PETA = susunPetaHakAkses();
const butir = (id: string): ButirPeta => {
  const b = PETA.find((x) => x.id === id);
  if (!b) throw new Error(`butir ${id} tidak ada`);
  return b;
};
const siapa = (id: string): GolonganPeran[] => GOLONGAN_PERAN.filter((g) => Boolean(butir(id).hak[g]));
const tanpaPengelola = (daftar: GolonganPeran[]) => daftar.filter((g) => g !== "super-admin" && g !== "admin").sort();

// ════════════════════════════════════════════════════════════════════════════
describe("1. kelengkapan: tiap fitur punya butir", () => {
  it("tiap kunci AKSI, aplikasi, dan tab e-Court punya butir", () => {
    for (const k of Object.keys(AKSI)) expect(PETA.some((b) => b.id === `aksi.${k}`), `aksi ${k}`).toBe(true);
    for (const a of ATURAN_APLIKASI) expect(PETA.some((b) => b.id === `aplikasi.${a.id}`), `aplikasi ${a.id}`).toBe(true);
    for (const t of Object.keys(TAB_ECOURT)) expect(PETA.some((b) => b.id === `tab.${t}`), `tab ${t}`).toBe(true);
  });

  it("tiap aplikasi portal dan tiap menu samping tercakup (menu baru tanpa butir = merah)", () => {
    const aplikasiAda = new Set(ATURAN_APLIKASI.map((a) => a.id));
    // Aplikasi portal di luar matriks (tautan luar) tetap harus dikenali oleh peta.
    for (const a of portalApps) expect(aplikasiAda.has(a.id), `aplikasi portal ${a.id}`).toBe(true);
    const tercakup = modulTercakup();
    for (const m of modules) expect(tercakup.has(m.id), `menu samping ${m.id} belum punya butir hak akses`).toBe(true);
  });

  it("tiap menu ekstensi, penanda SIPP, saklar popup, dan jenis blangko punya butir", () => {
    for (const situs of ["sipp", "abt"] as const) {
      for (const halaman of ["perkara", "daftar"] as const) {
        const kunci = new Set<string>();
        for (const daftar of Object.values(MENU_EKSTENSI[situs][halaman])) for (const k of daftar) kunci.add(k);
        for (const k of kunci) expect(PETA.some((b) => b.id === `ekstensi.${situs}.${halaman}.${k}`), `${situs}.${halaman}.${k}`).toBe(true);
      }
    }
    for (const kode of KODE_IDE_L2) expect(PETA.some((b) => b.id === `penanda.${kode}`), `penanda ${kode}`).toBe(true);
    for (const j of ["put", "bas", "rel", "ptsp"]) expect(PETA.some((b) => b.id === `blangko.${j}`), `blangko ${j}`).toBe(true);
  });

  it("id butir unik dan hanya memakai tingkat yang dikenal", () => {
    const ids = PETA.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of PETA) for (const t of Object.values(b.hak)) expect(URUTAN_TINGKAT).toContain(t);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("2. Super Admin memegang dan melihat semua", () => {
  it("setiap butir: Super Admin ada dan tidak pernah di bawah golongan lain", () => {
    for (const b of PETA) {
      const sa = b.hak["super-admin"];
      expect(sa, `${b.id} tanpa Super Admin`).toBeDefined();
      for (const [g, t] of Object.entries(b.hak)) {
        expect(URUTAN_TINGKAT.indexOf(sa!), `${b.id}: Super Admin di bawah ${g}`).toBeGreaterThanOrEqual(URUTAN_TINGKAT.indexOf(t!));
      }
    }
  });

  it("butirUntukGolongan('super-admin') = seluruh peta; tidak ada peran lain yang melihat lebih banyak", () => {
    expect(butirUntukGolongan("super-admin").length).toBe(PETA.length);
    for (const g of GOLONGAN_PERAN) expect(butirUntukGolongan(g).length).toBeLessThanOrEqual(PETA.length);
  });

  it("Admin tidak melihat lebih dari Super Admin dan tidak memegang yang khusus Super Admin", () => {
    for (const b of PETA) {
      if (b.hak.admin) expect(URUTAN_TINGKAT.indexOf(b.hak["super-admin"]!)).toBeGreaterThanOrEqual(URUTAN_TINGKAT.indexOf(b.hak.admin));
    }
    for (const id of [
      "aplikasi.audit-trail",
      "aplikasi.aleta-sipp",
      "pengaturan.akses-menu",
      "pengaturan.fitur-satker",
      "pengaturan.sinkron-kembaran",
      "pengaturan.database",
      "pengaturan.ai",
      "fitur.lihat-sebagai",
      "fitur.bas-acc",
    ]) {
      expect(butir(id).hak.admin, id).toBeUndefined();
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("3. peran lain sesuai keputusan", () => {
  it("unggah putusan: hanya hakim, Ketua/Wakil, Admin, Super Admin (9 Okt)", () => {
    expect(tanpaPengelola(siapa("aksi.putusan.unggah"))).toEqual(["hakim", "pimpinan"]);
    expect(tanpaPengelola(siapa("fitur.unggah-massal-putusan"))).toEqual(["hakim", "pimpinan"]);
  });

  it("BAS: dibaca majelis dan kepaniteraan, ditulis hakim + kepaniteraan; kasir, PTSP, juru sita tidak", () => {
    expect(tanpaPengelola(siapa("aksi.bas.baca"))).toEqual(["analis-perkara", "hakim", "panitera", "panmud", "pimpinan", "pp"]);
    expect(tanpaPengelola(siapa("aksi.bas.tulis"))).toEqual(["analis-perkara", "hakim", "panitera", "panmud", "pp"]);
    for (const g of ["kasir", "ptsp", "jurusita", "mediator", "sekretariat", "ti", "pelaksana", "petugas-sidang"] as GolonganPeran[]) {
      expect(butir("aksi.bas.baca").hak[g], g).toBeUndefined();
    }
  });

  it("acc BAS: Ketua/Wakil, hakim, dan Super Admin; Admin dan panitera tidak", () => {
    expect(siapa("fitur.bas-acc").sort()).toEqual(["hakim", "pimpinan", "super-admin"]);
  });

  it("relaas khusus juru sita; blangko putusan hakim; BAS kepaniteraan; PTSP hanya PTSP", () => {
    expect(tanpaPengelola(siapa("blangko.rel"))).toEqual(["jurusita"]);
    expect(tanpaPengelola(siapa("blangko.put"))).toEqual(["hakim", "pimpinan"]);
    expect(tanpaPengelola(siapa("blangko.bas"))).toEqual(["analis-perkara", "panitera", "panmud", "pp"]);
    expect(tanpaPengelola(siapa("blangko.ptsp"))).toEqual(["ptsp"]);
    expect(tanpaPengelola(siapa("aksi.sidang.cetak-relaas"))).toEqual(["jurusita"]);
  });

  it("blangko × peran = jenisDokumenAkun (sumber penjaga), termasuk saklar", () => {
    const jenis = { put: "blangko.put", bas: "blangko.bas", rel: "blangko.rel", ptsp: "blangko.ptsp" } as const;
    for (const g of GOLONGAN_PERAN) {
      if (g === "super-admin" || g === "admin") continue;
      const boleh = jenisDokumenAkun({ admin: false, golongan: [g], saklar: null });
      for (const [j, id] of Object.entries(jenis)) {
        expect(Boolean(butir(id).hak[g]), `${id} untuk ${g}`).toBe((boleh as string[]).includes(j));
      }
    }
    // saklar hanya menambah: hakim -> BAS, PP -> putusan; relaas tidak pernah terbuka lewat saklar.
    expect(jenisDokumenAkun({ admin: false, golongan: ["hakim"], saklar: { hakimBas: true } })).toContain("bas");
    expect(jenisDokumenAkun({ admin: false, golongan: ["pp"], saklar: { ppPutusan: true, hakimBas: true } })).not.toContain("rel");
  });

  it("Kasir hanya kasir, panitera, panmud (+Admin); PP, hakim, juru sita tidak", () => {
    expect(tanpaPengelola(siapa("aksi.sidang.kasir"))).toEqual(["kasir", "panitera", "panmud"]);
    expect(butir("ekstensi.sipp.perkara.kasir").hak.panitera).toBe("P");
    expect(butir("ekstensi.sipp.perkara.kasir").hak.pp).toBeUndefined();
  });

  it("data pribadi pihak: hanya yang melayani perkara; kesekretariatan, TI, pelaksana, petugas sidang tidak", () => {
    const boleh = tanpaPengelola(siapa("aksi.status.data-pihak"));
    for (const g of ["sekretariat", "ti", "pelaksana", "petugas-sidang"] as GolonganPeran[]) expect(boleh).not.toContain(g);
    for (const g of ["pimpinan", "hakim", "panitera", "pp", "jurusita", "kasir", "ptsp", "mediator"] as GolonganPeran[]) expect(boleh).toContain(g);
  });

  it("susun saksi: kepaniteraan; panduan pertanyaan saksi: majelis dan kepaniteraan; juru sita dan kasir tidak", () => {
    expect(tanpaPengelola(siapa("fitur.susun-saksi"))).toEqual(["analis-perkara", "panitera", "panmud", "pp"]);
    expect(tanpaPengelola(siapa("aksi.pandu.saksi"))).toEqual(["hakim", "panitera", "panmud", "pimpinan", "pp"]);
    expect(butir("aksi.saksi.susun").hak.jurusita).toBeUndefined();
    expect(butir("aksi.saksi.susun").hak.kasir).toBeUndefined();
  });

  it("penetapan atas akun pejabat; ikrar talak mengikuti tunda/putus; SKP: semua melihat miliknya sendiri", () => {
    expect(tanpaPengelola(siapa("fitur.penetapan-penunjukan"))).toEqual(["pimpinan", "ptsp"]);
    expect(butir("ekstensi.sipp.perkara.penetapan").hak.hakim).toBeUndefined();
    expect(tanpaPengelola(siapa("fitur.ikrar-talak"))).toEqual(tanpaPengelola(siapa("aksi.sidang.tunda-putus")));
    expect(tanpaPengelola(siapa("fitur.skp-sendiri")).length).toBe(14);
  });

  it("Blangko Saya: tahap awal ditandai; Kasir/PTSP/juru sita tidak pernah", () => {
    const b = butir("blangko.saya");
    expect(b.catatan).toMatch(/Tahap awal/);
    for (const g of ["kasir", "ptsp", "jurusita", "mediator", "sekretariat"] as GolonganPeran[]) expect(b.hak[g]).toBeUndefined();
    expect(butir("aplikasi.blangko-saya").catatan).toMatch(/Tahap awal/);
  });

  it("riwayat login WhatsApp dan sesi e-Court semua akun: Super Admin ubah, Admin lihat, lainnya tidak", () => {
    const b = butir("fitur.sesi-ecourt-semua");
    expect(b.hak["super-admin"]).toBe("U");
    expect(b.hak.admin).toBe("L");
    expect(tanpaPengelola(siapa("fitur.sesi-ecourt-semua"))).toEqual([]);
  });

  it("halaman Hak akses per peran: Super Admin lengkap, Admin hanya lihat", () => {
    const b = butir("pengaturan.hak-akses");
    expect(b.hak["super-admin"]).toBe("U");
    expect(b.hak.admin).toBe("L");
    expect(tanpaPengelola(siapa("pengaturan.hak-akses"))).toEqual([]);
  });

  it("isi lengkap draf H-7 tidak untuk juru sita", () => {
    expect(butir("fitur.draf-h7").hak.jurusita).toBeUndefined();
  });

  it("hak menu ABT: tiap folder memuat Super Admin (grup 1), tiap kelompok bernama, relaas hanya jurusita", () => {
    expect(HAK_MENU_ABT.length).toBeGreaterThanOrEqual(10);
    for (const h of HAK_MENU_ABT) {
      expect(h.grup, h.folder).toContain(1);
      for (const g of [...h.grup, ...(h.validator ?? [])]) expect(NAMA_GRUP_SIPP[g], `${h.folder}: grup ${g} tanpa nama`).toBeTruthy();
    }
    const relaas = HAK_MENU_ABT.find((h) => /98 Relaas/.test(h.folder))!;
    expect(relaas.grup.filter((g) => g !== 1)).toEqual([600]);
    const putusan = HAK_MENU_ABT.find((h) => /^Putusan per jenis/.test(h.folder))!;
    expect(putusan.grup).toEqual([1, 10, 20]);
    const bas = HAK_MENU_ABT.find((h) => /^BAS per jenis/.test(h.folder))!;
    expect(bas.validator).toEqual([10, 20]);
    expect(bas.grup).not.toContain(600);
  });

  it("Audit Trail hanya Super Admin; ubin Admin disembunyikan oleh matriks", async () => {
    const { bawaanAplikasiGolongan, tingkatAplikasi } = await import("@/lib/matriks-peran");
    expect(bawaanAplikasiGolongan(["admin"], "audit-trail")).toBe(false);
    expect(bawaanAplikasiGolongan(["super-admin"], "audit-trail")).toBe(true);
    expect(tingkatAplikasi({ roleId: "admin" }, "audit-trail")).toBeNull();
    expect(tingkatAplikasi({ roleId: "super-admin" }, "audit-trail")).toBe("CRUD");
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("4. cermin sama dengan ekstensi sungguhan", () => {
  const terbuka: JSDOM[] = [];
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 60));
    while (terbuka.length) terbuka.pop()!.window.close();
  });

  it("MENU_EKSTENSI = ALAT_MENU_PERAN di panel-alat.js (dijalankan sungguhan)", () => {
    const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
      url: "http://192.168.10.10/SIPP/detil_perkara_agama",
      runScripts: "outside-only",
    });
    terbuka.push(dom);
    const w = dom.window as unknown as Record<string, unknown>;
    w.chrome = {
      runtime: { id: "aleta-uji", getManifest: () => ({ version: "0.0.0" }), getURL: (x: string) => x, sendMessage: async () => ({}) },
      storage: {
        local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined },
        session: { get: async () => ({}), set: async () => undefined },
        onChanged: { addListener() {} },
      },
    };
    w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), clone() { return this; } });
    const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
    vm.runInContext(baca("ekstensi-sipp/panel-alat.js"), ctx, { filename: "panel-alat.js" });
    const nyata = JSON.parse(vm.runInContext("JSON.stringify(ALAT_MENU_PERAN)", ctx)) as unknown;
    expect(JSON.parse(JSON.stringify(MENU_EKSTENSI))).toEqual(nyata);
  });

  it("SAKLAR_POPUP_RELEVAN = PROFIL_GOLONGAN.relevan di popup.js", () => {
    const sumber = baca("ekstensi-sipp/popup.js");
    const mulai = sumber.indexOf("const PROFIL_GOLONGAN = {");
    expect(mulai).toBeGreaterThan(0);
    const akhir = sumber.indexOf("\n};", mulai);
    const blok = sumber.slice(mulai + "const PROFIL_GOLONGAN = ".length, akhir + 2);
    const profil = new Function(`return ${blok}`)() as Record<string, { relevan: string[] }>;
    const dariPopup = Object.fromEntries(Object.entries(profil).map(([k, v]) => [k, v.relevan]));
    expect(JSON.parse(JSON.stringify(SAKLAR_POPUP_RELEVAN))).toEqual(dariPopup);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("5. dokumen dan teks", () => {
  it("MATRIKS-HAK-AKSES-18okt.md = keluaran peta (jalankan: npx tsx scripts/hak-akses-md.ts di manajemen_surat/)", () => {
    const berkas = baca("docs/hak-akses/MATRIKS-HAK-AKSES-18okt.md");
    expect(berkas).toBe(susunMarkdownHakAkses());
  });

  it("dokumen memuat tabel fitur × peran, blangko, kewenangan khusus, perubahan, dan keputusan menunggu", () => {
    const md = susunMarkdownHakAkses();
    expect(md).toMatch(/\| Fitur \| SA \| Adm \|/);
    expect(md).toMatch(/## Blangko\n/);
    expect(md).toMatch(/## Kewenangan khusus/);
    expect(md).toMatch(/## Perubahan dibanding sebelumnya/);
    expect(md).toMatch(/## Hal yang menunggu keputusan pengguna/);
    expect(PERUBAHAN_18OKT.length).toBeGreaterThanOrEqual(8);
    expect(KEWENANGAN_KHUSUS.length).toBeGreaterThanOrEqual(10);
    expect(KEPUTUSAN_MENUNGGU.length).toBeGreaterThanOrEqual(1);
  });

  it("teks yang dibaca pegawai tanpa label teknis (alamat rute, berkas, fungsi)", () => {
    const teknis = /\/api\/|\.tsx?\b|\.js\b|_id\b|ATURAN_|AKSI\.|\w+\([^)]*\)/;
    for (const b of PETA) {
      for (const teks of [b.judul, b.keterangan, b.catatan ?? ""]) expect(teks, `${b.id}: "${teks}"`).not.toMatch(teknis);
    }
    for (const p of PERUBAHAN_18OKT) for (const teks of [p.judul, p.sebelum, p.sesudah, p.alasan]) expect(teks).not.toMatch(/\/api\/|\.tsx?\b/);
    for (const k of KEWENANGAN_KHUSUS) expect(`${k.judul} ${k.isi}`).not.toMatch(/\/api\/|\.tsx?\b|_id\b/);
  });

  it("Admin tidak menerima kunci/rute teknis; Super Admin menerimanya", () => {
    const admin = petaUntukPembaca(false);
    expect(admin.every((b) => b.sumber === undefined && b.rute === undefined)).toBe(true);
    const sa = petaUntukPembaca(true);
    expect(sa.some((b) => Boolean(b.sumber))).toBe(true);
    expect(sa.some((b) => (b.rute?.length ?? 0) > 0)).toBe(true);
    expect(tingkatButir(sa[0], "super-admin")).not.toBe("-");
  });
});
