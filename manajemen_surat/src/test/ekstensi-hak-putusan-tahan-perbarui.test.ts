// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { Dunia, jawaban, jalankan, minta, nyalakan } from "./dunia-latar";

/**
 * ============================================================================
 * DUA KEPUTUSAN PENGGUNA 9 OKT 2026 - DIJALANKAN, BUKAN DIBACA TEKSNYA
 * ============================================================================
 *
 * (1) Unggah putusan ke SIPP/e-Court hanya Super Admin, Admin, Hakim
 *     (termasuk Ketua/Wakil). Di ekstensi:
 *       - panel-alat.js menahan setiap permintaan ke rute putusan bagi peran
 *         yang PASTI tidak berhak (403 tiruan berkalimat sama dengan peladen);
 *       - panel SIPP (konten.js utuh di jsdom) tidak menggambar Putusan
 *         otomatis / Unggah putusan ke SIPP bagi PP, juru sita, operator -
 *         kotak terkunci beralasan menggantikannya.
 * (2) Tombol "Perbarui ekstensi" DITAHAN selama antrean massal di tab mana
 *     pun berjalan. latar.js dijalankan di dunia-latar (pekerja MV3 maya yang
 *     dapat dimatikan, chrome.storage.session yang selamat), panel-alat.js di
 *     jsdom untuk sisi pelapornya.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");

const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 5000): Promise<NonNullable<T>> {
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

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(40);
  while (terbuka.length) terbuka.pop()!.window.close();
});

// ============================================================================
// panel-alat.js di jsdom
// ============================================================================
function muatAlat(pengguna: Record<string, unknown> | null) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    url: "http://192.168.10.10/SIPP/detil_perkara_agama",
    runScripts: "outside-only",
  });
  terbuka.push(dom);
  const w = dom.window as any;
  const pesan: any[] = [];
  const minta: string[] = [];
  w.Response = globalThis.Response;
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "0.0.0" }),
      getURL: (x: string) => x,
      sendMessage: async (p: unknown) => {
        pesan.push(polos(p));
        return { ok: true };
      },
    },
    storage: {
      local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener() {} },
    },
  };
  w.fetch = async (alamat: string) => {
    minta.push(String(alamat));
    return { ok: true, status: 200, json: async () => ({ ok: true, data: {} }), clone() { return this; } };
  };
  const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
  // Akun yang masuk - di halaman sungguhan variabel milik konten.js.
  vm.runInContext(`var penggunaTerakhir = ${JSON.stringify(pengguna)};`, ctx);
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  return { w, ctx, pesan, minta, nilai: (e: string) => vm.runInContext(e, ctx) };
}

const RUTE_PUTUSAN = [
  ["POST", "/aleta/api/aleta-ecourt/putusan/unggah-sipp"],
  ["POST", "/aleta/api/aleta-ecourt/putusan/unggah-naskah"],
  ["GET", "/aleta/api/aleta-ecourt/putusan/isian-sipp?nomorPerkara=450%2FPdt.G%2F2026%2FPA.Dgl"],
  ["POST", "/aleta/api/aleta-ecourt/putusan/isian-sipp"],
  ["POST", "/aleta/api/aleta-ecourt/ecourt-putusan/unggah"],
] as const;

describe("(1) panel-alat.js: hak unggah putusan menurut peran", () => {
  it("alatBolehUnggahPutusan: nama dan id peran portal", () => {
    const a = muatAlat(null);
    const boleh = (p: unknown) => a.nilai(`alatBolehUnggahPutusan(${JSON.stringify(p)})`);
    for (const p of ["Super Admin", "Admin", "Hakim", "Ketua", "Wakil Ketua", "super-admin", "hakim", "wakil-ketua"]) expect(boleh(p), p).toBe(true);
    for (const p of ["Panitera Pengganti", "Panitera", "Panitera Muda", "Jurusita", "Juru Sita Pengganti", "Operator", "Analis Perkara", "Staf", "panitera-pengganti", "jurusita", "operator"]) {
      expect(boleh(p), p).toBe(false);
    }
    expect(boleh("")).toBe(null);
    // Jawaban peladen menang atas nama peran.
    expect(boleh({ peran: "Hakim", bolehUnggahPutusan: false })).toBe(false);
    expect(boleh({ peran: "Operator", bolehUnggahPutusan: true })).toBe(true);
  });

  it.each(["Panitera Pengganti", "Jurusita", "Operator", "Panitera"])(
    "%s: setiap rute putusan ditahan 403 di peramban - tidak satu pun berangkat",
    async (peran) => {
      const a = muatAlat({ nama: "Uji", peran });
      for (const [cara, alamat] of RUTE_PUTUSAN) {
        const r = await a.w.fetch(alamat, { method: cara });
        expect(r.status, alamat).toBe(403);
        const isi = await r.json();
        expect(isi.data.alasan).toBe("peran_tidak_boleh_unggah_putusan");
        expect(isi.error.message).toContain("hanya untuk Hakim, Admin, dan Super Admin");
      }
      expect(a.minta.filter((u) => /putusan/.test(u))).toEqual([]);
    }
  );

  it.each(["Hakim", "Super Admin", "Admin", "Wakil Ketua"])("%s: rute putusan BERANGKAT (yang menilai peladen)", async (peran) => {
    const a = muatAlat({ nama: "Uji", peran });
    await a.w.fetch(RUTE_PUTUSAN[2][1], { method: "GET" });
    expect(a.minta).toContain(RUTE_PUTUSAN[2][1]);
  });

  it("peran belum terbaca: tidak ditahan di peramban - peladen yang menolak", async () => {
    const a = muatAlat(null);
    await a.w.fetch(RUTE_PUTUSAN[2][1], { method: "GET" });
    expect(a.minta).toContain(RUTE_PUTUSAN[2][1]);
  });

  it("rute lain (penetapan, konteks) tidak pernah ditahan aturan ini", async () => {
    const a = muatAlat({ nama: "Uji", peran: "Jurusita" });
    await a.w.fetch("/aleta/api/aleta-bot/sipp-konteks?nomor=1", { method: "GET" });
    expect(a.minta).toContain("/aleta/api/aleta-bot/sipp-konteks?nomor=1");
  });
});

// ============================================================================
// Panel SIPP utuh (panel-alat.js + basmassal.js + konten.js) di jsdom
// ============================================================================
const BLANGKO = ` <div id="popup_form"><form id="frm_putusan"><textarea id="perhum"></textarea><textarea id="amar"></textarea><textarea id="amar_anonim"></textarea><input type="submit" id="simpan" value="Simpan"></form></div>`;

function bukaPanel(peran: string, simpanan: Record<string, unknown> = {}) {
  const NOMOR = "450/Pdt.G/2026/PA.Dgl";
  const dom = new JSDOM(
    `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten"><h3>Nomor Perkara ${NOMOR}</h3>${BLANGKO}</div></body></html>`,
    { url: "http://192.168.10.10/SIPP/detil_perkara_agama", runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  Object.defineProperty(w.HTMLElement.prototype, "innerText", { configurable: true, get() { return this.textContent; } });
  w.TextDecoder = globalThis.TextDecoder;
  w.Response = globalThis.Response;
  const isiSimpan: Record<string, unknown> = polos(simpanan);
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.188.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (k?: string | string[] | null) => {
          const d = k == null ? Object.keys(isiSimpan) : [k].flat();
          return Object.fromEntries(d.filter((x) => x in isiSimpan).map((x) => [x, polos(isiSimpan[x])]));
        },
        set: async (o: Record<string, unknown>) => void Object.assign(isiSimpan, polos(o)),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener() {} },
    },
  };
  const konteks = {
    ok: true, nomorPerkara: NOMOR, nomorRegister: "", identitas: { ditemukan: true, jenisPerkara: "Cerai Gugat", jenisPerkaraLengkap: "Cerai Gugat", adaKumulasi: false, kumulasi: [], adaKuasa: false },
    ringkasan: { dokumen: 0 }, dokumen: [], selisih: [], nomorPihak: [], diperiksaPada: new Date().toISOString(), ambangMendesakHari: 3, hakim: null,
  };
  const minta: string[] = [];
  w.fetch = async (alamat: string) => {
    const url = String(alamat);
    minta.push(url);
    let status = 200;
    let isi: unknown = { ok: true, data: {} };
    if (url.includes("/ekstensi/tampilan")) {
      status = 404;
      isi = {};
    } else if (url.includes("/ekstensi/siapa")) isi = { ok: true, data: { nama: "Uji", peran, kapabilitas: null } };
    else if (url.includes("/aleta-bot/sipp-konteks?")) isi = { ok: true, data: { available: true, konteks, pengguna: { nama: "Uji", peran }, kapabilitas: null } };
    else if (url.includes("/putusan/isian-sipp?")) isi = { ok: true, data: { ada: false, sebab: "Belum ada draf." } };
    const r: any = { ok: status < 300, status, statusText: "", url, redirected: false, headers: { get: () => "application/json" }, json: async () => polos(isi), text: async () => JSON.stringify(isi), clone: () => r };
    return r;
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(baca("basmassal.js"), ctx, { filename: "basmassal.js" });
  vm.runInContext(baca("konten.js"), ctx, { filename: "konten.js" });
  return { d: w.document as Document, minta };
}

describe("(1) panel SIPP: bagian putusan menurut peran (konten.js utuh)", () => {
  const panel = (h: { d: Document }) =>
    sampai(() => {
      const pn = h.d.getElementById("aleta-panel-sipp");
      return pn && pn.querySelector('.aleta-kelompok, [data-kunci="putusanKel"]') ? pn : null;
    }, "panel SIPP");

  it.each(["Panitera Pengganti", "Jurusita", "Operator"])("%s: Putusan otomatis dan Unggah putusan ke SIPP TIDAK digambar; kotak terkunci beralasan ada", async (peran) => {
    const h = bukaPanel(peran);
    const pn = await panel(h);
    await tunggu(50);
    expect(pn.querySelector('.aleta-bagian[data-kunci="isiPutusan"]')).toBeNull();
    expect(pn.querySelector('.aleta-bagian[data-kunci="unggahPutusanSipp"]')).toBeNull();
    const kunci = pn.querySelector('[data-aleta-terkunci="unggah-putusan"]');
    expect(kunci, "kotak terkunci").not.toBeNull();
    expect(String(kunci!.textContent)).toContain("hanya untuk Hakim, Admin, dan Super Admin");
    // Draf putusan TIDAK pernah diminta untuk peran ini.
    expect(h.minta.some((u) => u.includes("/putusan/isian-sipp"))).toBe(false);
  });

  it.each(["Hakim", "Super Admin"])("%s: Putusan otomatis dan Unggah putusan ke SIPP tetap ada, tanpa kotak terkunci", async (peran) => {
    const h = bukaPanel(peran);
    const pn = await panel(h);
    await tunggu(50);
    expect(pn.querySelector('.aleta-bagian[data-kunci="isiPutusan"]')).not.toBeNull();
    expect(pn.querySelector('.aleta-bagian[data-kunci="unggahPutusanSipp"]')).not.toBeNull();
    expect(pn.querySelector('[data-aleta-terkunci="unggah-putusan"]')).toBeNull();
  });
});

// ============================================================================
// (2) Pelapor antrean di panel-alat.js
// ============================================================================
describe("(2) alatAntreanKerja melapor ke latar.js", () => {
  it("denyut saat mulai dan tiap maju; selesai sekali saja; pagehide melepas antrean di memori", async () => {
    const a = muatAlat(null);
    a.nilai(`globalThis.__h = alatAntreanKerja("bas-massal", "BAS massal", 4)`);
    a.nilai(`__h.maju(1, 4)`);
    a.nilai(`__h.selesai(); __h.selesai();`);
    const jenis = a.pesan.map((p) => p.jenis);
    expect(jenis).toEqual(["antrean-kerja-denyut", "antrean-kerja-denyut", "antrean-kerja-selesai"]);
    expect(a.pesan[1]).toMatchObject({ sumber: "aleta-panel", antrean: "bas-massal", nama: "BAS massal", selesai: 1, total: 4 });
    expect(a.pesan[2].id).toBe(a.pesan[0].id);

    a.pesan.length = 0;
    a.nilai(`globalThis.__h2 = alatAntreanKerja("penetapan-massal", "penetapan massal", 3)`);
    a.w.dispatchEvent(new a.w.Event("pagehide"));
    expect(a.pesan.map((p) => p.jenis)).toEqual(["antrean-kerja-denyut", "antrean-kerja-selesai"]);
  });

  it("antrean putusan massal SIPP (bertahan antar halaman): id tetap, tidak lepas saat pagehide, lepas bila habis", () => {
    const a = muatAlat(null);
    const antrean = { id: "atr1", tahap: "sipp", butir: [{ keadaan: "selesai" }, { keadaan: "menunggu" }, { keadaan: "jalan" }] };
    a.nilai(`alatLaporAntreanPutusanSipp(${JSON.stringify(antrean)})`);
    a.w.dispatchEvent(new a.w.Event("pagehide"));
    expect(a.pesan).toEqual([
      expect.objectContaining({ jenis: "antrean-kerja-denyut", id: "putusan-massal-sipp:atr1", selesai: 1, total: 3, nama: "putusan massal SIPP" }),
    ]);
    a.nilai(`alatLaporAntreanPutusanSipp(${JSON.stringify({ ...antrean, butir: [{ keadaan: "selesai" }, { keadaan: "gagal" }] })})`);
    expect(a.pesan[1]).toMatchObject({ jenis: "antrean-kerja-selesai", id: "putusan-massal-sipp:atr1" });
  });

  it("setiap antrean massal memakai pelapor ini dan melepasnya", () => {
    const konten = baca("konten.js");
    const abt = baca("abt.js");
    const bas = baca("basmassal.js");
    expect(konten).toContain('alatAntreanKerja("penetapan-massal"');
    expect(konten).toContain("if (lapor) lapor.selesai();");
    expect(konten).toContain('alatAntreanKerja("unggah-naskah-massal"');
    expect(konten).toContain("alatLaporAntreanPutusanSipp(antrean)");
    expect(abt).toContain('alatAntreanKerja("putusan-massal-abt"');
    expect(abt).toContain("if (laporAbt) laporAbt.selesai();");
    expect(bas).toContain('alatAntreanKerja("bas-massal"');
    expect(bas).toContain("if (laporBas) laporBas.selesai();");
  });
});

// ============================================================================
// (2) latar.js - penahan tombol Perbarui / Muat ulang
// ============================================================================
const PENGIRIM_TAB = { tab: { id: 7 }, url: "http://192.168.10.10/SIPP/main" };
const duniaBaru = () => {
  const d = new Dunia((p) => jawaban(404, "", p.alamat));
  d.pembaruan = { status: "update_available", version: "1.999.0" };
  return d;
};

const ANTREAN = [
  ["penetapan-massal", "penetapan massal"],
  ["putusan-massal-sipp", "putusan massal SIPP"],
  ["putusan-massal-abt", "putusan massal ABT"],
  ["bas-massal", "BAS massal"],
  ["unggah-naskah-massal", "unggah naskah putusan massal"],
] as const;

describe("(2) latar.js menahan Perbarui selama antrean massal berjalan", () => {
  it("tanpa antrean: pembaruan dipasang seperti biasa", async () => {
    const dunia = duniaBaru();
    const p = nyalakan(dunia);
    const j = await minta(dunia, p, { jenis: "perbarui" });
    expect(j.keadaan).toBe("dipasang");
  });

  it.each(ANTREAN)("%s berjalan: Perbarui DAN Muat ulang ditahan dengan 'Tunggu antrean ... (x/y)'; lepas sesudah selesai", async (kunci, nama) => {
    const dunia = duniaBaru();
    const p = nyalakan(dunia);
    expect((await minta(dunia, p, { jenis: "antrean-kerja-denyut", id: `${kunci}-1`, antrean: kunci, nama, selesai: 2, total: 5 }, PENGIRIM_TAB)).ok).toBe(true);

    const j = await minta(dunia, p, { jenis: "perbarui" });
    expect(j.ok).toBe(false);
    expect(j.keadaan).toBe("antrean-berjalan");
    expect(j.ditahan).toBe(true);
    expect(j.pesan).toContain(`Tunggu antrean ${nama} selesai (2/5).`);
    expect(j.labelPaksa).toBe("Tetap perbarui - antrean terputus");
    expect(dunia.dimuatUlang).toBe(0);

    const m = await minta(dunia, p, { jenis: "muat-ulang" });
    expect(m.keadaan).toBe("antrean-berjalan");

    await minta(dunia, p, { jenis: "antrean-kerja-selesai", id: `${kunci}-1` });
    const lagi = await minta(dunia, p, { jenis: "perbarui" });
    expect(lagi.keadaan).toBe("dipasang");
  });

  it("'Tetap perbarui' (paksa) tetap tersedia: memasang walau antrean berjalan", async () => {
    const dunia = duniaBaru();
    const p = nyalakan(dunia);
    await minta(dunia, p, { jenis: "antrean-kerja-denyut", id: "bas-1", antrean: "bas-massal", nama: "BAS massal", selesai: 0, total: 3 }, PENGIRIM_TAB);
    const j = await minta(dunia, p, { jenis: "perbarui", paksa: true });
    expect(j.keadaan).toBe("dipasang");
    const m = await minta(dunia, p, { jenis: "muat-ulang", paksa: true });
    expect(m.keadaan).toBe("dimuat_ulang");
  });

  it("tahan pekerja MV3 mati: catatan antrean di chrome.storage.session, pekerja baru tetap menahan", async () => {
    const dunia = duniaBaru();
    const p1 = nyalakan(dunia);
    await minta(dunia, p1, { jenis: "antrean-kerja-denyut", id: "abt-1", antrean: "putusan-massal-abt", nama: "putusan massal ABT", selesai: 1, total: 9 }, PENGIRIM_TAB);
    p1.matikan();
    const p2 = nyalakan(dunia);
    const j = await minta(dunia, p2, { jenis: "perbarui" });
    expect(j.keadaan).toBe("antrean-berjalan");
    expect(j.pesan).toContain("Tunggu antrean putusan massal ABT selesai (1/9).");
  });

  it("antrean macet/ditinggal: 10 menit tanpa denyut = basi, tidak menahan lagi; denyut baru menahan lagi", async () => {
    const dunia = duniaBaru();
    const p = nyalakan(dunia);
    await minta(dunia, p, { jenis: "antrean-kerja-denyut", id: "pen-1", antrean: "penetapan-massal", nama: "penetapan massal", selesai: 3, total: 10 }, PENGIRIM_TAB);
    dunia.jam += 9 * 60 * 1000;
    expect((await minta(dunia, p, { jenis: "perbarui" })).keadaan).toBe("antrean-berjalan");
    dunia.jam += 60 * 1000 + 1;
    expect((await minta(dunia, p, { jenis: "perbarui" })).keadaan).toBe("dipasang");
  });

  it("dua antrean di dua tab: yang terbaru disebut, jumlah yang lain dikatakan", async () => {
    const dunia = duniaBaru();
    const p = nyalakan(dunia);
    await minta(dunia, p, { jenis: "antrean-kerja-denyut", id: "a", antrean: "bas-massal", nama: "BAS massal", selesai: 1, total: 2 }, { tab: { id: 1 } });
    dunia.jam += 1000;
    await minta(dunia, p, { jenis: "antrean-kerja-denyut", id: "b", antrean: "penetapan-massal", nama: "penetapan massal", selesai: 4, total: 8 }, { tab: { id: 2 } });
    const j = await minta(dunia, p, { jenis: "perbarui" });
    expect(j.pesan).toContain("Tunggu antrean penetapan massal selesai (4/8). 1 antrean massal lain juga sedang berjalan.");
  });

  it("putaran relaas tetap menahan dengan keadaan lamanya (tidak berubah)", () => {
    const latar = baca("latar.js");
    expect(latar).toContain("const relaas = await relaasPenghalangMuatUlang();");
    expect(latar).toContain('keadaan: "putaran-relaas-berjalan"');
  });
});

describe("(2) popup, panel ALETA, dan pita mengenali kedua penahan", () => {
  it("ketiganya memperlakukan 'antrean-berjalan' seperti putaran relaas - tekanan kedua memaksa", () => {
    for (const berkas of ["popup.js", "aleta.js", "panel-alat.js"]) {
      const s = baca(berkas);
      expect(s, berkas).toContain('jawab.keadaan === "antrean-berjalan"');
      expect(s, berkas).toContain("jawab.ditahan === true");
    }
    expect(baca("popup.js")).toContain('tombolPerbarui.textContent = jawab.labelPaksa || "Tetap perbarui - putaran cetak hilang"');
  });

  it("jalankan juga: alatJalankanPembaruan menahan dan meminta tekanan kedua", async () => {
    const a = muatAlat(null);
    a.w.chrome.runtime.sendMessage = async (p: any) =>
      p.jenis === "perbarui" && !p.paksa
        ? { ok: false, keadaan: "antrean-berjalan", ditahan: true, labelPaksa: "Tetap perbarui - antrean terputus", pesan: "Tunggu antrean BAS massal selesai (1/3)." }
        : { ok: true, keadaan: "dipasang", pesan: "ok" };
    a.nilai("globalThis.__kabar = []");
    const hasil = await a.nilai("alatJalankanPembaruan(false, (t) => globalThis.__kabar.push(t))");
    expect(hasil.perluPaksa).toBe(true);
    expect(hasil.selesai).toBe(false);
    expect(String(a.nilai("globalThis.__kabar.join(' | ')"))).toContain("Tunggu antrean BAS massal selesai (1/3).");
  });
});
