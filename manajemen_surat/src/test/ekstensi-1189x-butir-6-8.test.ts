// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * BUTIR 6 (1.189.x) - PUTUSAN OTOMATIS ATAS PUTUSAN YANG SUDAH TERISI DI SIPP
 * ============================================================================
 *
 * konten.js utuh dijalankan di jsdom (pola ekstensi-hak-putusan-tahan-perbarui):
 *   - blangko tertutup + putusan sudah terisi  -> bagian disembunyikan,
 *     keterangan pendek menggantikannya;
 *   - blangko tertutup + belum putus           -> bagian tampil seperti biasa;
 *   - blangko Putusan Akhir dibuka lagi (edit) -> bagian tampil + peringatan
 *     timpa, dan b6KonfirmasiTimpaPutusan meminta konfirmasi.
 *   - status tidak terbaca BUKAN "sudah terisi".
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
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

const NOMOR = "450/Pdt.G/2026/PA.Dgl";
const BLANGKO = ` <div id="popup_form"><form id="frm_putusan"><textarea id="perhum"></textarea><textarea id="amar"></textarea><textarea id="amar_anonim"></textarea><input type="submit" id="simpan" value="Simpan"></form></div>`;

type Status = "terisi" | "belum" | "gagal";

type Tambahan = (url: string, cara: string, badan: unknown) => { status?: number; isi: unknown } | null;

function bukaPanel(opsi: { blangko: boolean; status: Status; jawab?: Tambahan; pesan?: (p: any) => unknown }) {
  const dom = new JSDOM(
    `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten"><h3>Nomor Perkara ${NOMOR}</h3>${opsi.blangko ? BLANGKO : ""}</div></body></html>`,
    { url: "http://192.168.10.10/SIPP/detil_perkara_agama", runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  Object.defineProperty(w.HTMLElement.prototype, "innerText", { configurable: true, get() { return this.textContent; } });
  w.TextDecoder = globalThis.TextDecoder;
  w.Response = globalThis.Response;
  const tanya: string[] = [];
  let jawabKonfirmasi = false;
  w.confirm = (t: string) => {
    tanya.push(String(t));
    return jawabKonfirmasi;
  };
  // Kulit modern (UI Baru) supaya jalur "Putusan otomatis tanpa blangko" ikut.
  const isiSimpan: Record<string, unknown> = { ujiTampilan: "ui", ujiIzinkanNyata: true };
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.189.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: async (p: unknown) => (opsi.pesan ? opsi.pesan(polos(p)) : {}),
    },
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
  const kiriman: Array<{ url: string; cara: string; badan: unknown }> = [];
  w.fetch = async (alamat: string, init?: { method?: string; body?: unknown }) => {
    const url = String(alamat);
    minta.push(url);
    const cara = String((init && init.method) || "GET");
    kiriman.push({ url, cara, badan: init && init.body });
    let status = 200;
    let isi: unknown = { ok: true, data: {} };
    const khusus = opsi.jawab ? opsi.jawab(url, cara, init && init.body) : null;
    if (khusus) {
      status = khusus.status ?? 200;
      isi = khusus.isi;
    } else if (url.includes("/ekstensi/tampilan")) {
      status = 404;
      isi = {};
    } else if (url.includes("/ekstensi/siapa")) isi = { ok: true, data: { nama: "Uji", peran: "Hakim", kapabilitas: null } };
    else if (url.includes("/aleta-bot/sipp-konteks?")) isi = { ok: true, data: { available: true, konteks, pengguna: { nama: "Uji", peran: "Hakim" }, kapabilitas: null } };
    else if (url.includes("/putusan/isian-sipp?")) isi = { ok: true, data: { ada: false, sebab: "Belum ada draf." } };
    else if (url.includes("/aleta-ecourt/status-perkara?")) {
      if (opsi.status === "gagal") {
        status = 503;
        isi = { ok: false, error: { message: "bot mati" } };
      } else {
        const terisi = opsi.status === "terisi";
        isi = {
          ok: true,
          data: {
            status: {
              putusan: { sudahPutus: terisi, tanggalPutusan: terisi ? "2026-10-08" : "" },
              putusanLengkap: terisi ? { tanggalPutusan: "2026-10-08", statusPutusan: "Dikabulkan" } : {},
            },
          },
        };
      }
    }
    const r: any = { ok: status < 300, status, statusText: "", url, redirected: false, headers: { get: () => "application/json" }, json: async () => polos(isi), text: async () => JSON.stringify(isi), clone: () => r };
    return r;
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(baca("panel-alat.js"), ctx, { filename: "panel-alat.js" });
  vm.runInContext(baca("basmassal.js"), ctx, { filename: "basmassal.js" });
  vm.runInContext(baca("konten.js"), ctx, { filename: "konten.js" });
  return {
    d: w.document as Document,
    w,
    minta,
    kiriman,
    tanya,
    setujui: (v: boolean) => (jawabKonfirmasi = v),
    nilai: (e: string) => vm.runInContext(e, ctx),
  };
}

const panel = (h: { d: Document }) =>
  sampai(() => {
    const pn = h.d.getElementById("aleta-panel-sipp");
    return pn && pn.querySelector('[data-kunci="putusanKel"], .aleta-kelompok') ? pn : null;
  }, "panel SIPP");

describe("butir 6: blangko Putusan Akhir terbuka (edit)", () => {
  it("putusan sudah terisi: bagian tampil + peringatan timpa; konfirmasi ditanya, 'tidak' = tidak menulis", async () => {
    const h = bukaPanel({ blangko: true, status: "terisi" });
    const pn = await panel(h);
    const kotak = await sampai(() => pn.querySelector('.aleta-bagian[data-kunci="isiPutusan"]'), "bagian isiPutusan");
    const awas = await sampai(() => kotak.querySelector(".aleta-b6-awas-timpa"), "peringatan timpa");
    expect(String(awas.textContent)).toContain("SUDAH terisi di SIPP (tanggal 2026-10-08, Dikabulkan)");
    expect(String(awas.textContent)).toContain("MENIMPA isi lama");
    expect((kotak as HTMLElement).hidden).toBe(false);

    h.setujui(false);
    expect(await h.nilai(`b6KonfirmasiTimpaPutusan(${JSON.stringify(NOMOR)})`)).toBe(false);
    expect(h.tanya.at(-1)).toContain("Yakin menimpa yang lama?");
    h.setujui(true);
    expect(await h.nilai(`b6KonfirmasiTimpaPutusan(${JSON.stringify(NOMOR)})`)).toBe(true);
  });

  it("belum putus: tanpa peringatan, konfirmasi TIDAK ditanya", async () => {
    const h = bukaPanel({ blangko: true, status: "belum" });
    const pn = await panel(h);
    const kotak = await sampai(() => pn.querySelector('.aleta-bagian[data-kunci="isiPutusan"]'), "bagian isiPutusan");
    await sampai(() => h.minta.some((u) => u.includes("/status-perkara?")), "status dibaca");
    await tunggu(30);
    expect(kotak.querySelector(".aleta-b6-awas-timpa")).toBeNull();
    expect(await h.nilai(`b6KonfirmasiTimpaPutusan(${JSON.stringify(NOMOR)})`)).toBe(true);
    expect(h.tanya).toEqual([]);
  });

  it("tombol Isikan memanggil konfirmasi sebelum mengisi (urutan di kode)", () => {
    const konten = baca("konten.js");
    const iTerap = konten.indexOf('terap.addEventListener("click", async () => {');
    const iKonfirmasi = konten.indexOf("await b6KonfirmasiTimpaPutusan(nomorPerkara)", iTerap);
    const iSebelum = konten.indexOf("const sebelumA30 = a30Nyala ? bacaPutusanSegar(nomorPerkara) : null;", iTerap);
    expect(iTerap).toBeGreaterThan(0);
    expect(iKonfirmasi).toBeGreaterThan(iTerap);
    expect(iKonfirmasi).toBeLessThan(iSebelum);
  });
});

describe("butir 6: blangko tertutup", () => {
  it("putusan sudah terisi: Putusan otomatis disembunyikan, keterangan menggantikannya", async () => {
    const h = bukaPanel({ blangko: false, status: "terisi" });
    const pn = await panel(h);
    const kotak = await sampai(() => pn.querySelector('.aleta-bagian[data-kunci="isiPutusan"]') as HTMLElement | null, "bagian isiPutusan (UI Baru)");
    await sampai(() => kotak.hidden, "bagian disembunyikan");
    expect(kotak.getAttribute("data-aleta-putusan-terisi")).toBe("sembunyi");
    const catatan = pn.querySelector(".aleta-b6-putusan-terisi");
    expect(String(catatan && catatan.textContent)).toContain("sudah terisi di SIPP");
    expect(String(catatan && catatan.textContent)).toContain("buka blangko Putusan Akhir (Edit)");
  });

  it("belum putus: Putusan otomatis tetap tampil", async () => {
    const h = bukaPanel({ blangko: false, status: "belum" });
    const pn = await panel(h);
    const kotak = await sampai(() => pn.querySelector('.aleta-bagian[data-kunci="isiPutusan"]') as HTMLElement | null, "bagian isiPutusan (UI Baru)");
    await sampai(() => h.minta.some((u) => u.includes("/status-perkara?")), "status dibaca");
    await tunggu(30);
    expect(kotak.hidden).toBe(false);
    expect(pn.querySelector(".aleta-b6-putusan-terisi")).toBeNull();
  });

  it("status tidak terbaca BUKAN 'sudah terisi': bagian tetap tampil", async () => {
    const h = bukaPanel({ blangko: false, status: "gagal" });
    const pn = await panel(h);
    const kotak = await sampai(() => pn.querySelector('.aleta-bagian[data-kunci="isiPutusan"]') as HTMLElement | null, "bagian isiPutusan (UI Baru)");
    await sampai(() => h.minta.some((u) => u.includes("/status-perkara?")), "status dibaca");
    await tunggu(30);
    expect(kotak.hidden).toBe(false);
  });
});

// ============================================================================
// BUTIR 7 (1.189.x) - e-Doc penetapan yang SUDAH terupload (jalur blangko ABT)
// ============================================================================
describe("butir 7: e6UnggahEdocPenetapan atas e-Doc yang sudah terupload", () => {
  const PETA_PENETAPAN = {
    butir: [
      { jenis: "pmh", aktif: true, namaBerkas: "@ 1 - PMH.rtf", otomatisUnggah: true },
      { jenis: "phs", aktif: true, namaBerkas: "@ 2 - PHS.rtf", otomatisUnggah: true },
    ],
  };
  const PETA_EDOC = {
    perkara: { perkaraId: "450", nomorPerkara: NOMOR },
    jenis: [
      { jenis: "PMH", tersedia: true, sudahDiunggah: true, terakhirDiunggah: "2026-10-05 09:12:00" },
      { jenis: "PHS", tersedia: true, sudahDiunggah: false },
    ],
  };
  const jawab: Tambahan = (url, cara) => {
    if (url.includes("/penetapan-edoc/peta-penetapan")) return { isi: { ok: true, data: PETA_PENETAPAN } };
    if (url.includes("/penetapan-edoc/peta?")) return { isi: { ok: true, data: PETA_EDOC } };
    if (url.includes("/penetapan-edoc/unggah") && cara === "POST") return { isi: { ok: true, data: { ok: true, berkas: [{ jenis: "phs", ok: true, tandaTangan: "Munifa" }] } } };
    return null;
  };
  const pesan = (p: any) => (p && p.jenis === "relaas-rtf" ? { ok: true, rtfBase64: "e1xydGYxIHVqaX0=" } : {});

  const jalankan = async (h: ReturnType<typeof bukaPanel>, otomatis: boolean) => {
    await panel(h);
    h.nilai("alatSetelJedaSkala(0)");
    h.nilai("globalThis.__kabar = document.createElement('div')");
    return h.nilai(
      `e6UnggahEdocPenetapan({ nomorPerkara: ${JSON.stringify(NOMOR)}, perkaraId: "450", jenis: ["pmh", "phs"], otomatis: ${otomatis}, kering: false, kabar: globalThis.__kabar })`
    );
  };
  const badanUnggah = (h: ReturnType<typeof bukaPanel>) =>
    h.kiriman.filter((k) => k.url.includes("/penetapan-edoc/unggah") && k.cara === "POST").map((k) => JSON.parse(String(k.badan)));

  it("tombol: PMH sudah terupload -> ditanya 'yakin menimpa yang lama?'; Batal = tidak ada POST", async () => {
    const h = bukaPanel({ blangko: false, status: "belum", jawab, pesan });
    h.setujui(false);
    const hasil = await jalankan(h, false);
    expect(hasil.dibatalkan).toBe(true);
    expect(h.tanya.at(-1)).toContain("Penetapan Majelis Hakim (PMH) sudah terupload di e-Doc SIPP - terakhir 2026-10-05 09:12");
    expect(h.tanya.at(-1)).toContain("Yakin menimpa yang lama?");
    expect(badanUnggah(h)).toEqual([]);
    expect(h.nilai("globalThis.__kabar.textContent")).toContain("Dibatalkan - e-Doc lama di SIPP tidak diubah");
  });

  it("tombol: disetujui -> kedua jenis dikirim (menimpa atas persetujuan)", async () => {
    const h = bukaPanel({ blangko: false, status: "belum", jawab, pesan });
    h.setujui(true);
    const hasil = await jalankan(h, false);
    expect(hasil.ok).toBe(true);
    const badan = badanUnggah(h);
    expect(badan).toHaveLength(1);
    expect(badan[0].abt.map((x: { jenis: string }) => x.jenis)).toEqual(["pmh", "phs"]);
  });

  it("otomatis (sesudah penetapan tertulis): PMH yang sudah ada DILEWATI tanpa bertanya, PHS tetap dikirim", async () => {
    const h = bukaPanel({ blangko: false, status: "belum", jawab, pesan });
    const hasil = await jalankan(h, true);
    expect(hasil.ok).toBe(true);
    expect(h.tanya).toEqual([]);
    const badan = badanUnggah(h);
    expect(badan[0].abt.map((x: { jenis: string }) => x.jenis)).toEqual(["phs"]);
    expect(h.nilai("globalThis.__kabar.textContent")).toContain("tidak ditimpa otomatis");
  });

  it("kering (periksa dulu) tidak bertanya apa pun", async () => {
    const h = bukaPanel({ blangko: false, status: "belum", jawab, pesan });
    await panel(h);
    h.nilai("globalThis.__kabar = document.createElement('div')");
    await h.nilai(`e6UnggahEdocPenetapan({ nomorPerkara: ${JSON.stringify(NOMOR)}, perkaraId: "450", jenis: ["pmh"], otomatis: false, kering: true, kabar: globalThis.__kabar })`);
    expect(h.tanya).toEqual([]);
  });
});

// ============================================================================
// BUTIR 8 (1.189.x) - "Tarik dari e-Court" di panel: garis + persen nyata
// ============================================================================
describe("butir 8: kotak permintaan 'Tarik dari e-Court' menggambar kemajuan nyata", () => {
  it("dikerjakan + kemajuan -> garis (aria-valuenow) dan '63% · Mengunduh berkas 2/3'; ditanya berkala sampai selesai", async () => {
    let fase = 0;
    const KEADAAN = [
      { status: "dikerjakan", kemajuan: { tahap: "unduh", persen: 76, teks: "Mengunduh berkas 3/3" } },
      { status: "selesai" },
    ];
    const h = bukaPanel({
      blangko: false,
      status: "belum",
      jawab: (url) => (url.includes("/aleta-bot/ecourt/permintaan?") ? { isi: { ok: true, data: { available: true, keadaan: KEADAAN[fase] } } } : null),
    });
    await panel(h);
    h.nilai(`globalThis.__kp = kotakPermintaan(${JSON.stringify(NOMOR)}, { status: "dikerjakan", kemajuan: { tahap: "unduh", persen: 63, teks: "Mengunduh berkas 2/3" } }); document.body.appendChild(globalThis.__kp);`);
    const kotak = h.nilai("globalThis.__kp") as HTMLElement;
    const garis = kotak.querySelector('.aleta-b8-garis[role="progressbar"]') as HTMLElement;
    expect(garis.style.display).toBe("");
    expect(garis.getAttribute("aria-valuenow")).toBe("63");
    expect(kotak.querySelector(".aleta-permintaan-pesan")!.textContent).toBe("63% · Mengunduh berkas 2/3");
    // Detak berikutnya (3 dtk): kemajuan baru dari bot.
    await sampai(() => garis.getAttribute("aria-valuenow") === "76", "kemajuan 76%", 8000);
    fase = 1;
    // Lalu selesai: garis disembunyikan.
    await sampai(() => garis.style.display === "none", "garis hilang sesudah selesai", 8000);
  }, 20000);
});
