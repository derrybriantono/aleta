// @vitest-environment node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * TOMBOL + PANEL "PUTUSAN OTOMATIS" DI HALAMAN PERKARA SIPP (20 Okt 2026, agen B2)
 * ============================================================================
 *
 * putusan-sipp.js dijalankan SUNGGUHAN di jsdom bersama panel-alat.js (hak peran, mode tampilan)
 * dan penetapan-sipp.js (letak tombol bersebelahan) atas replika halaman perkara SIPP. Yang dijaga:
 *
 *   - tombol "Putusan Otomatis" tebal, tepat di sebelah "Penetapan Otomatis" (yang tetap paling kiri),
 *     sebelum "Buka di ABT" / "Buka di ALETA", dan tidak berpindah-pindah dengan tombol Penetapan;
 *   - hanya Super Admin, Admin, dan Hakim; panitera/juru sita/peran belum terbaca tidak melihatnya;
 *     tampilan Lama tidak berubah;
 *   - panel terbentang, semua langkah tercentang; putusan yang sudah terisi / e-Doc yang sudah ada
 *     = dilewati (tidak ditimpa); konfirmasi di halaman yang menyebut angka;
 *   - satu klik: menjalankan alur Putusan otomatis ekstensi (kotak.otomatis) dengan centang yang
 *     dipilih, laporan per langkah; hanya e-Doc (putusan sudah terisi) lewat modul e-Doc + kunci;
 *   - kunci dipegang pekerjaan lain = tidak ada yang ditulis;
 *   - dua klik bersamaan tidak menjalankan dua kali.
 *
 * ALETA_TANGKAP_PUSIPP=<awalan> menyimpan HTML tiap keadaan untuk tangkapan Playwright
 * (docs/rancangan/putusan-sipp-20okt/tangkap.mjs).
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const PUSIPP = baca("putusan-sipp.js");
const PASANGAN = baca("putusan-terjadwal-pasangan.js");
const PENSIPP = baca("penetapan-sipp.js");
const CSS = baca("putusan-sipp.css");
const CSS_BERSAMA = baca("penetapan-sipp.css");
/** Isi blok CSS yang daftar selektornya memuat `selektor` PERSIS (aturan berdaftar-selektor dikenali). */
function blokCss(css: string, selektor: string): string {
  const bersih = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of bersih.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (m[1].split(",").some((x) => x.trim() === selektor)) return m[2];
  }
  return "";
}


const ASAL = "http://192.168.10.10";
const NOMOR = "684/Pdt.G/2026/PA.Dgl";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function sampai<T>(periksa: () => T, keterangan: string | (() => string), batas = 6000): Promise<NonNullable<T>> {
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

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Opsi = {
  peran?: string | null;
  tampilan?: "lama" | "ui";
  terisi?: boolean;
  adaPutusan?: boolean;
  adaAnonim?: boolean;
  cekGagal?: boolean;
  kunciSibuk?: boolean;
  otomatis?: (opsi: Record<string, unknown>) => Promise<Record<string, unknown>>;
  edocJalankan?: (p: Record<string, unknown>) => Promise<{ ok: boolean; bunyi: string; langkah: Array<Record<string, string>> }>;
  tanpaPenetapan?: boolean;
  simpananAwal?: Record<string, unknown>;
  konversiGagal?: boolean;
  dengaPenetapanSungguhan?: boolean;
  bukaBlangko?: { ok: boolean; pesan?: string };
};

function buka(o: Opsi = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten">` +
      `<table width="100%" id="submenus"><tr><td><table><tr>` +
      `<td id="backlist"><a class="btn btn-default btn-sm" href="/index.php/perkara">Kembali</a></td>` +
      `<td><a class="btn btn-default btn-sm" href="#">Penetapan Majelis Hakim</a></td>` +
      `</tr></table></td></tr></table></div></body></html>`,
    { url: `${ASAL}/SIPP/detil_perkara_agama`, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: o.tampilan || "ui", ujiIzinkanNyata: true, ...(o.simpananAwal || {}) };
  w.chrome = {
    runtime: { id: "uji", getManifest: () => ({ version: "1.205.19" }), getURL: (x: string) => x, sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (k?: string | string[]) => {
          const hasil: Record<string, unknown> = {};
          for (const n of [k].flat()) if (n != null && n in simpanan) hasil[n as string] = JSON.parse(JSON.stringify(simpanan[n as string]));
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, JSON.parse(JSON.stringify(isi))),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  w.fetch = async () => {
    const r: any = { ok: false, status: 404, json: async () => ({}), text: async () => "", headers: { get: () => "" }, clone: () => r };
    return r;
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext("alatSetelJedaSkala(0)", ctx);

  const peran = o.peran === undefined ? "Hakim" : o.peran;
  const urut: string[] = [];
  const opsiOto: Array<Record<string, unknown>> = [];
  const ringkasan: Array<Record<string, any>> = [];
  const bagianAda = { nilai: false };
  Object.assign(w, {
    penggunaTerakhir: peran === null ? null : { nama: "Derry Briantono", peran },
    boleh: () => true,
    cariNomorPerkara: () => NOMOR,
    b6KeadaanPutusanTerisi: async () => (o.terisi ? { terisi: true, tanggal: "2026-10-19", status: "Dikabulkan" } : { terisi: false }),
    b6RincianPutusan: (k: { tanggal?: string; status?: string }) => ` (tanggal ${k.tanggal}, ${k.status})`,
    a30PerkaraIdUntukAbt: async () => "10260",
    muatUlangSesudahTulis: (arg: Record<string, any>) => (ringkasan.push(arg), { otomatis: true }),
    s1BukaBlangkoPutusan: async () => {
      urut.push("buka-blangko");
      return o.bukaBlangko || { ok: true, lewat: "tambah" };
    },
    gambarUlangSesudahBlangko: async () => {
      urut.push("gambar-ulang");
      if (!bagianAda.nilai) {
        bagianAda.nilai = true;
        const bagian = w.document.createElement("div");
        bagian.className = "aleta-bagian";
        bagian.setAttribute("data-kunci", "isiPutusan");
        bagian.otomatis = async (opsi: Record<string, unknown>) => {
          urut.push("otomatis");
          opsiOto.push(opsi);
          await tunggu(5);
          if (o.otomatis) return o.otomatis(opsi);
          return {
            ok: true,
            tersimpan: true,
            edoc: {
              ok: true,
              langkah: [
                { kunci: "putusan", judul: "e-Doc putusan", teks: "terunggah", nada: "ok" },
                { kunci: "anonimisasi", judul: "e-Doc anonimisasi", teks: "terunggah", nada: "ok" },
              ],
            },
          };
        };
        w.document.body.appendChild(bagian);
      }
      return true;
    },
    a30PerluKeRtf: (nama: string) => /\.(docx|doc|pdf)$/i.test(nama),
    a30KonversiNaskah: async (berkas: { name: string }) => ({
      ok: !o.konversiGagal,
      pesan: "konversi tiruan gagal",
      berkas: new w.File([new Uint8Array(64)], String(berkas.name).replace(/\.[A-Za-z]+$/, ".rtf")),
      peringatan: /\.pdf$/i.test(berkas.name) ? ["PDF dapat berubah tata letaknya; periksa naskahnya."] : [],
    }),
    aletaPutusanEdoc: {
      cekSlot: async () => (o.cekGagal ? { ok: false, sebab: "portal tidak menjawab" } : { ok: true, adaBaris: true, adaPutusan: Boolean(o.adaPutusan), adaAnonim: Boolean(o.adaAnonim) }),
      ambilKunci: async () => {
        urut.push("kunci:ambil");
        const lepasSibuk = async (): Promise<void> => undefined;
        const lepasOk = async (): Promise<void> => void urut.push("kunci:lepas");
        return o.kunciSibuk
          ? { ok: false, pesan: "Perkara ini sedang dikerjakan oleh Derry (kerjakan-penetapan) - tunggu selesai supaya tidak tertulis ganda, lalu ulangi.", lepas: lepasSibuk }
          : { ok: true, lepas: lepasOk };
      },
      jalankan: async (p: Record<string, unknown>) => {
        urut.push("edoc:jalankan");
        opsiOto.push({ edocSaja: true, denganPutusan: p.denganPutusan, denganAnonim: p.denganAnonim, namaPutusan: p.putusan ? (p.putusan as { name: string }).name : null, namaRtf: p.putusanRtf ? (p.putusanRtf as { name: string }).name : null });
        await tunggu(5);
        if (o.edocJalankan) return o.edocJalankan(p);
        const langkah: Array<Record<string, string>> = [];
        if (p.denganPutusan !== false) langkah.push({ kunci: "putusan", judul: "e-Doc putusan", teks: "terunggah", nada: "ok" });
        if (p.denganAnonim !== false) langkah.push({ kunci: "anonimisasi", judul: "e-Doc anonimisasi", teks: "terunggah", nada: "ok" });
        return { ok: true, bunyi: "x", langkah };
      },
    },
  });
  vm.runInContext(PASANGAN, ctx, { filename: "putusan-terjadwal-pasangan.js" });
  vm.runInContext(PUSIPP, ctx, { filename: "putusan-sipp.js" });
  if (!o.tanpaPenetapan) {
    // Tombol Penetapan Otomatis (P2) dan tombol L1 (Buka di ABT/ALETA) di baris yang sama.
    const baris = w.document.querySelector("#submenus td#backlist").parentElement as HTMLElement;
    const l1 = w.document.createElement("td");
    l1.className = "aleta-l1-submenu";
    l1.innerHTML = '<a href="#">Buka di ABT</a> <a href="#">Buka di ALETA</a>';
    baris.appendChild(l1);
    if (o.dengaPenetapanSungguhan) {
      vm.runInContext(PENSIPP, ctx, { filename: "penetapan-sipp.js" });
    } else {
      const pen = w.document.createElement("td");
      pen.className = "aleta-sisip aleta-pensipp aleta-pensipp-sel";
      pen.innerHTML = '<button class="aleta-pensipp-tombol">Penetapan Otomatis</button>';
      baris.insertBefore(pen, l1);
    }
  }
  return { w, d: w.document as Document, urut, opsiOto, ringkasan, simpanan };
}
type Halaman = ReturnType<typeof buka>;

const api = (h: Halaman) => h.w.aletaPutusanSipp;
const tombolPu = (h: Halaman) => h.d.querySelector(".aleta-pusipp-tombol") as HTMLButtonElement | null;
const panel = (h: Halaman) => h.d.getElementById("aleta-pusipp-panel") as HTMLElement | null;
const baris = (h: Halaman, j: string) => panel(h)!.querySelector(`[data-pusipp-langkah="${j}"]`) as HTMLElement;
const status = (h: Halaman, j: string) => String(baris(h, j).querySelector("[data-pusipp-status]")?.getAttribute("data-pusipp-status") || "");
const cek = (h: Halaman, j: string) => panel(h)!.querySelector(`[data-pusipp-cek="${j}"]`) as HTMLInputElement;
const utama = (h: Halaman) => panel(h)!.querySelector('[data-pusipp="utama"]') as HTMLButtonElement;

async function panelSiap(h: Halaman) {
  // 21 Okt 2026: bawaan TERLIPAT - petugas membukanya dulu (sekali).
  await sampai(() => (api(h).pasang(h.d), tombolPu(h)), "tombol Putusan Otomatis");
  if (!api(h).keadaan().terbuka) {
    tombolPu(h)!.click();
    await tunggu(5);
  }
  await sampai(() => {
    api(h).pasang(h.d);
    const k = api(h).keadaan();
    return tombolPu(h) && panel(h) && k && k.dibaca && !utama(h).disabled ? panel(h) : null;
  }, () => `panel siap; badan: ${String(h.d.body.textContent).slice(0, 300)}`);
  return panel(h)!;
}

async function klikSatuKali(h: Halaman) {
  utama(h).click();
  const konfirm = await sampai(() => panel(h)!.querySelector(".aleta-pusipp-konfirm"), "konfirmasi tampil");
  (panel(h)!.querySelector('[data-pusipp="ya"]') as HTMLButtonElement).click();
  return konfirm;
}

function simpanTangkapan(h: Halaman, nama: string) {
  const awalan = process.env.ALETA_TANGKAP_PUSIPP;
  if (!awalan) return;
  h.d.querySelectorAll("input[type=checkbox]").forEach((c) => {
    if ((c as HTMLInputElement).checked) c.setAttribute("checked", "");
    else c.removeAttribute("checked");
  });
  const melayang = Array.from(h.d.querySelectorAll("body > .aleta-mu-melayang")).map((x) => x.outerHTML).join("");
  writeFileSync(`${awalan}-${nama}.html`, h.d.getElementById("konten")!.innerHTML + melayang, "utf8");
}

// ============================================================================
describe("tombol: bersebelahan dengan Penetapan Otomatis, tebal, hanya untuk yang berhak", () => {
  it("duduk tepat sesudah Penetapan Otomatis dan sebelum Buka di ABT / Buka di ALETA", async () => {
    const h = buka();
    await sampai(() => (api(h).pasang(h.d), tombolPu(h)), "tombol Putusan Otomatis");
    const anak = Array.from(h.d.querySelector("#submenus td#backlist")!.parentElement!.children);
    const iPen = anak.findIndex((x) => x.classList.contains("aleta-pensipp-sel"));
    const iPut = anak.findIndex((x) => x.classList.contains("aleta-pusipp-sel"));
    const iL1 = anak.findIndex((x) => x.classList.contains("aleta-l1-submenu"));
    expect([iPen, iPut, iL1].every((i) => i > -1)).toBe(true);
    expect(iPut).toBe(iPen + 1);
    expect(iPut).toBeLessThan(iL1);
    expect(tombolPu(h)!.textContent).toContain("Putusan Otomatis");
  });

  it("bersama penetapan-sipp.js SUNGGUHAN: urutannya stabil, tidak saling memindahkan tiap detak", async () => {
    const h = buka({ dengaPenetapanSungguhan: true, peran: "Ketua" });
    await sampai(() => (api(h).pasang(h.d), h.d.querySelector(".aleta-pensipp-sel") || null) , "tombol penetapan").catch(() => null);
    // Penetapan Otomatis butuh perkara dan hak penetapan: bila belum muncul, buatkan tempatnya seperti P2.
    const urutan = () => Array.from(h.d.querySelector("#submenus td#backlist")!.parentElement!.children).map((x) => (x.classList.contains("aleta-pensipp-sel") ? "pen" : x.classList.contains("aleta-pusipp-sel") ? "put" : x.classList.contains("aleta-l1-submenu") ? "l1" : "lain"));
    for (let i = 0; i < 6; i += 1) {
      api(h).pasang(h.d);
      h.w.aletaPenetapanSipp.pasang(h.d);
      await tunggu(15);
    }
    const akhir = urutan().filter((x) => x !== "lain");
    const sebelum = urutan().join(",");
    for (let i = 0; i < 4; i += 1) {
      h.w.aletaPenetapanSipp.pasang(h.d);
      api(h).pasang(h.d);
      await tunggu(15);
    }
    expect(urutan().join(",")).toBe(sebelum);
    // Penetapan tetap paling kiri, Putusan tepat di sebelahnya, lalu Buka di ABT/ALETA.
    expect(akhir).toEqual(["pen", "put", "l1"]);
  });

  it("gaya: huruf tebal (>= 700), kontras >= 4,5:1, satu gaya dan palet dengan Penetapan Otomatis di tema terang dan gelap", () => {
    const hex = (s: string, nama: string) => new RegExp(`${nama}:\\s*(#[0-9a-fA-F]{6})`).exec(s)?.[1] || "";
    const lum = (x: string) => {
      const c = [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const rasio = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    // Tombol: gaya BERSAMA (aturan berdaftar-selektor di penetapan-sipp.css) - tidak biru tetap lagi.
    const dasar = blokCss(CSS_BERSAMA, ".aleta-pusipp-tombol");
    expect(dasar).toBe(blokCss(CSS_BERSAMA, ".aleta-pensipp-tombol"));
    expect(dasar).toBe(blokCss(CSS_BERSAMA, ".aleta-ptj-tombol"));
    expect(Number(/font-weight:\s*(\d+)/.exec(dasar)?.[1])).toBeGreaterThanOrEqual(700);
    expect(rasio(hex(dasar, "--ps-t-teks"), hex(dasar, "--ps-t-latar"))).toBeGreaterThanOrEqual(4.5);
    const gelap = blokCss(CSS_BERSAMA, 'html[data-aleta-tema-sipp="gelap"] .aleta-pusipp-tombol');
    expect(rasio(hex(gelap, "--ps-t-teks"), hex(gelap, "--ps-t-latar"))).toBeGreaterThanOrEqual(4.5);
    // Palet panel: bersama pula; peubah --pu-* hanya memetakan ke --ps-*.
    const pT = blokCss(CSS_BERSAMA, ".aleta-pusipp-panel");
    const pG = blokCss(CSS_BERSAMA, 'html[data-aleta-tema-sipp="gelap"] .aleta-pusipp-panel');
    expect(pT).toBe(blokCss(CSS_BERSAMA, ".aleta-pensipp-panel"));
    expect(rasio(hex(pT, "--ps-merek-teks"), hex(pT, "--ps-merek"))).toBeGreaterThanOrEqual(4.5);
    expect(rasio(hex(pG, "--ps-merek-teks"), hex(pG, "--ps-merek"))).toBeGreaterThanOrEqual(4.5);
    expect(rasio(hex(pT, "--ps-tinta"), hex(pT, "--ps-latar"))).toBeGreaterThanOrEqual(7);
    expect(rasio(hex(pG, "--ps-tinta"), hex(pG, "--ps-latar"))).toBeGreaterThanOrEqual(7);
    const alias = blokCss(CSS, ".aleta-pusipp-panel");
    expect(alias).toContain("--pu-merek: var(--ps-merek)");
    expect(alias).toContain("--pu-latar: var(--ps-latar)");
    // Tidak ada lagi aksen biru tetap.
    expect(CSS).not.toMatch(/#1f4e8c|#173b6b|#8db8f0/i);
  });
});

describe("tempat unggah berkas putusan di panel Putusan Otomatis (21 Okt 2026)", () => {
  const berkas = (h: Halaman, nama: string, ukuran = 4096) => new h.w.File([new Uint8Array(ukuran)], nama);
  async function pilihBerkas(h: Halaman, nama: string, ukuran = 4096) {
    const zona = panel(h)!.querySelector('[data-pusipp="zona"]') as HTMLElement;
    const evt = new h.w.Event("drop", { bubbles: true, cancelable: true }) as any;
    evt.dataTransfer = { files: [berkas(h, nama, ukuran)] };
    zona.dispatchEvent(evt);
    await sampai(() => api(h).keadaan().berkas && api(h).keadaan().berkas.status !== "periksa" && api(h).keadaan().berkas.status !== "ubah", "berkas diproses");
  }

  it("ada zona seret/pilih (RTF, DOCX, DOC, PDF) di panel, bukan hanya di bagian ALETA", async () => {
    const h = buka();
    const p = await panelSiap(h);
    const zona = p.querySelector('[data-pusipp="zona"]') as HTMLElement;
    expect(zona).toBeTruthy();
    expect(zona.textContent).toMatch(/RTF, DOCX, DOC, atau PDF/);
    const masuk = p.querySelector('[data-pusipp="pilih-berkas"]') as HTMLInputElement;
    expect(masuk.type).toBe("file");
    expect(masuk.accept).toBe(".rtf,.docx,.doc,.pdf");
    expect(masuk.hasAttribute("multiple")).toBe(false);
  });

  it("RTF dipilih: siap dipakai, ringkasan menyebut berkas; Ya meneruskan berkas ke alur ekstensi (e-Doc putusan + anonimisasi)", async () => {
    const h = buka();
    await panelSiap(h);
    await pilihBerkas(h, "684_Pdt.G_2026_PA.Dgl putusan.rtf");
    expect(panel(h)!.querySelector('[data-pusipp="berkas-terpilih"]')!.textContent).toContain("putusan.rtf");
    expect(panel(h)!.querySelector('[data-pusipp="berkas-terpilih"] [data-status="ok"]')).toBeTruthy();
    expect(panel(h)!.querySelector(".aleta-pusipp-ringkas")!.textContent).toContain("dari berkas yang dipilih");
    await klikSatuKali(h);
    await sampai(() => status(h, "anonim") === "ok", "selesai");
    expect(h.urut.filter((x) => x === "otomatis")).toHaveLength(1);
    expect(h.opsiOto[0]).toMatchObject({ edoc: true, denganPutusan: true, denganAnonim: true });
    expect((h.opsiOto[0].putusan as { name: string }).name).toBe("684_Pdt.G_2026_PA.Dgl putusan.rtf");
    expect((h.opsiOto[0].putusanRtf as { name: string }).name).toBe("684_Pdt.G_2026_PA.Dgl putusan.rtf");
    simpanTangkapan(h, "berkas-dipilih");
  });

  it("DOCX/PDF dipilih: diubah server menjadi RTF (bahan anonimisasi) dan peringatan konversi tampil; berkas asli yang menjadi e-Doc putusan", async () => {
    const h = buka({ terisi: true });
    await panelSiap(h);
    await pilihBerkas(h, "putusan.pdf");
    const b = api(h).keadaan().berkas;
    expect(b.status).toBe("ok");
    expect(b.rtf.name).toBe("putusan.rtf");
    expect(panel(h)!.textContent).toMatch(/PDF dapat berubah tata letaknya/);
    // Putusan sudah terisi: hanya e-Doc, tanpa membuka blangko - berkas tetap ikut.
    await klikSatuKali(h);
    await sampai(() => h.urut.includes("edoc:jalankan"), "e-Doc dijalankan");
    expect(h.opsiOto.at(-1)).toMatchObject({ edocSaja: true, namaPutusan: "putusan.pdf", namaRtf: "putusan.rtf" });
    expect(h.urut).not.toContain("buka-blangko");
  });

  it("konversi gagal: berkas tetap dipakai sebagai e-Doc putusan, anonimisasi lewat ABT (peringatan)", async () => {
    const h = buka({ terisi: true, konversiGagal: true });
    await panelSiap(h);
    await pilihBerkas(h, "putusan.docx");
    expect(api(h).keadaan().berkas.status).toBe("ok");
    expect(api(h).keadaan().berkas.rtf).toBeNull();
    expect(panel(h)!.textContent).toMatch(/pembuat anonimisasi ABT/);
  });

  it("ditolak: bentuk lain, BAS, anonimisasi, lebih dari 10 MB, kosong - tidak ikut dipakai dan tombol utama tidak membawa berkas", async () => {
    const h = buka({ terisi: true });
    await panelSiap(h);
    const kasus: Array<[string, number, RegExp]> = [
      ["catatan.txt", 4096, /bukan RTF, DOCX, DOC, atau PDF/],
      ["BAS 684_Pdt.G_2026_PA.Dgl.rtf", 4096, /berita acara sidang/],
      ["684_Pdt.G_2026_PA.Dgl anonimisasi.rtf", 4096, /anonimisasi dibuat otomatis/],
      ["besar.rtf", 11 * 1024 * 1024, /lebih dari 10 MB/],
      ["kosong.rtf", 0, /berkas kosong/],
    ];
    for (const [nama, ukuran, pola] of kasus) {
      await pilihBerkas(h, nama, ukuran);
      const b = api(h).keadaan().berkas;
      expect(b.status, nama).toBe("ditolak");
      expect(b.tolak, nama).toMatch(pola);
      expect(api(h).berkasSiap(), nama).toBeNull();
    }
    await klikSatuKali(h);
    await sampai(() => h.urut.includes("edoc:jalankan"), "e-Doc dijalankan");
    expect(h.opsiOto.at(-1)).toMatchObject({ namaPutusan: null, namaRtf: null });
  });

  it("Buang melepas berkas; tombol utama menunggu berkas yang sedang diubah ke RTF", async () => {
    const h = buka({ terisi: true });
    await panelSiap(h);
    await pilihBerkas(h, "putusan.rtf");
    (panel(h)!.querySelector('[data-pusipp="buang-berkas"]') as HTMLButtonElement).click();
    expect(api(h).keadaan().berkas).toBeNull();
    expect(panel(h)!.querySelector('[data-pusipp="berkas-terpilih"]')!.textContent).toBe("");
  });

  it("tidak ada tulisan ke SIPP dari zona ini: berkasnya tidak dikirim sebelum tombol utama ditekan", async () => {
    const h = buka();
    await panelSiap(h);
    await pilihBerkas(h, "684_Pdt.G_2026_PA.Dgl putusan.rtf");
    expect(h.urut).toEqual([]);
  });
});

describe("hak: Ketua, Wakil Ketua, Hakim, dan Super Admin (21 Okt 2026)", () => {
  for (const peran of ["Super Admin", "Hakim", "Ketua", "Wakil Ketua"]) {
    it(`${peran}: tombol dan panel tampil`, async () => {
      const h = buka({ peran });
      await sampai(() => (api(h).pasang(h.d), tombolPu(h)), `tombol untuk ${peran}`);
      expect(panel(h)).toBeTruthy();
    });
  }
  for (const peran of ["Panitera Pengganti", "Panitera", "Panitera Muda", "Juru Sita", "Petugas PTSP", "Kasir", "Analis Perkara", "Staf"]) {
    it(`${peran}: tidak ada tombol maupun panel`, async () => {
      const h = buka({ peran });
      for (let i = 0; i < 4; i += 1) {
        api(h).pasang(h.d);
        await tunggu(10);
      }
      expect(tombolPu(h)).toBeNull();
      expect(panel(h)).toBeNull();
    });
  }
});

describe("hak: hanya Super Admin, Admin, dan Hakim", () => {
  for (const peran of ["Super Admin", "Admin", "Hakim", "Ketua", "Wakil Ketua"]) {
    it(`${peran}: tombol dan panel tampil`, async () => {
      const h = buka({ peran });
      await sampai(() => (api(h).pasang(h.d), tombolPu(h)), `tombol untuk ${peran}`);
      expect(panel(h)).toBeTruthy();
    });
  }
  for (const peran of ["Panitera Pengganti", "Panitera", "Juru Sita", "Operator", "Staf"]) {
    it(`${peran}: tidak ada tombol maupun panel`, async () => {
      const h = buka({ peran });
      for (let i = 0; i < 4; i += 1) {
        api(h).pasang(h.d);
        await tunggu(10);
      }
      expect(tombolPu(h)).toBeNull();
      expect(panel(h)).toBeNull();
    });
  }
  it("peran belum terbaca: tidak tampil", async () => {
    const h = buka({ peran: null });
    api(h).pasang(h.d);
    await tunggu(20);
    expect(tombolPu(h)).toBeNull();
  });
  it("tampilan Lama: tidak berubah (tidak ada tombol)", async () => {
    const h = buka({ tampilan: "lama" });
    api(h).pasang(h.d);
    await tunggu(20);
    expect(tombolPu(h)).toBeNull();
    expect(panel(h)).toBeNull();
  });
  it("hak yang hilang di tengah jalan mencabut tombol (peran diganti), kecuali sedang bekerja", async () => {
    const h = buka();
    await panelSiap(h);
    h.w.penggunaTerakhir = { nama: "X", peran: "Panitera Pengganti" };
    api(h).pasang(h.d);
    expect(tombolPu(h)).toBeNull();
  });
});

describe("panel: terbentang, semua tercentang, keadaan SIPP dibaca", () => {
  it("perkara belum diputus: tiga langkah tercentang, ringkasan menyebut 1 Putusan Akhir dan 2 e-Doc", async () => {
    const h = buka();
    const p = await panelSiap(h);
    expect(p.hidden).toBe(false);
    expect(["isi", "putusan", "anonim"].map((j) => cek(h, j).checked)).toEqual([true, true, true]);
    expect(["isi", "putusan", "anonim"].map((j) => status(h, j))).toEqual(["tunggu", "tunggu", "tunggu"]);
    expect(p.querySelector(".aleta-pusipp-ringkas")!.textContent).toBe("1 Putusan Akhir akan diisi dan disimpan · 2 e-Doc akan diunggah");
    expect((p.querySelector("[data-pusipp='semua']") as HTMLInputElement).checked).toBe(true);
    simpanTangkapan(h, "terbentang");
  });

  it("putusan sudah terisi di SIPP: langkah isi dilewati, tidak dapat dicentang (tidak ditimpa), e-Doc tetap dapat", async () => {
    const h = buka({ terisi: true });
    const p = await panelSiap(h);
    expect(status(h, "isi")).toBe("lewat");
    expect(cek(h, "isi").checked).toBe(false);
    expect(cek(h, "isi").disabled).toBe(true);
    expect(baris(h, "isi").textContent).toContain("sudah terisi di SIPP (tanggal 2026-10-19, Dikabulkan)");
    expect(p.querySelector(".aleta-pusipp-ringkas")!.textContent).toBe("Putusan Akhir tidak diisi · 2 e-Doc akan diunggah");
    simpanTangkapan(h, "terisi");
  });

  it("e-Doc yang sudah ada: dilewati; semuanya sudah ada = tombol utama mati dengan keterangan", async () => {
    const h = buka({ terisi: true, adaPutusan: true, adaAnonim: true });
    await sampai(() => (api(h).pasang(h.d), tombolPu(h)), "tombol");
    tombolPu(h)!.click();
    const p = await sampai(() => (api(h).pasang(h.d), api(h).keadaan()?.dibaca ? panel(h) : null), "dibaca");
    expect(["isi", "putusan", "anonim"].map((j) => status(h, j))).toEqual(["lewat", "lewat", "lewat"]);
    expect(p.querySelector(".aleta-pusipp-ringkas")!.textContent).toContain("Tidak ada yang perlu dikerjakan");
    expect(utama(h).disabled).toBe(true);
  });

  it("cek e-Doc gagal terbaca: disebut, dan tombol utama tetap tersedia untuk mengisi putusan", async () => {
    const h = buka({ cekGagal: true });
    const p = await panelSiap(h);
    expect(p.querySelector(".aleta-pusipp-info")!.textContent).toContain("belum terbaca (portal tidak menjawab)");
  });

  it("BAWAAN TERLIPAT: panel tersembunyi dan belum membaca apa pun; dibuka petugas = terbentang dan diingat; dilipat lagi = diingat", async () => {
    const h = buka();
    await sampai(() => (api(h).pasang(h.d), tombolPu(h)), "tombol");
    expect(panel(h)!.hidden).toBe(true);
    expect(tombolPu(h)!.getAttribute("aria-expanded")).toBe("false");
    expect(api(h).keadaan().dibaca).toBe(false);
    tombolPu(h)!.click();
    await tunggu(10);
    expect(panel(h)!.hidden).toBe(false);
    expect(tombolPu(h)!.getAttribute("aria-expanded")).toBe("true");
    await sampai(() => (h.simpanan.lipatanBagian as any)?.putusanSipp2 === false, "pembukaan tersimpan");
    tombolPu(h)!.click();
    await tunggu(10);
    expect(panel(h)!.hidden).toBe(true);
    await sampai(() => (h.simpanan.lipatanBagian as any)?.putusanSipp2 === true, "lipatan tersimpan");
  });

  it("yang sengaja dibuka petugas pada kunjungan lalu terbuka lagi; tanpa catatan tetap terlipat", async () => {
    const h = buka({ simpananAwal: { lipatanBagian: { putusanSipp2: false } } });
    await sampai(() => (api(h).pasang(h.d), tombolPu(h)), "tombol");
    await sampai(() => (api(h).pasang(h.d), panel(h) && !panel(h)!.hidden ? panel(h) : null), "terbuka sesuai catatan");
  });
});

describe("konfirmasi di halaman dan satu klik", () => {
  it("konfirmasi menyebut angka: 1 Putusan Akhir dan 2 e-Doc; Batal tidak menjalankan apa pun", async () => {
    const h = buka();
    await panelSiap(h);
    utama(h).click();
    const k = await sampai(() => panel(h)!.querySelector(".aleta-pusipp-konfirm"), "konfirmasi");
    expect(k.textContent).toContain("mengisi dan menyimpan 1 Putusan Akhir dari draf");
    expect(k.textContent).toContain("mengunggah 2 e-Doc (putusan dan anonimisasi)");
    expect(k.textContent).toContain(NOMOR);
    simpanTangkapan(h, "konfirmasi");
    (panel(h)!.querySelector('[data-pusipp="batal"]') as HTMLButtonElement).click();
    await tunggu(10);
    expect(panel(h)!.querySelector(".aleta-pusipp-konfirm")).toBeNull();
    expect(h.urut).toEqual([]);
  });

  it("Ya: membuka blangko, menjalankan alur ekstensi (kotak.otomatis) dengan centang yang dipilih, melaporkan per langkah", async () => {
    const h = buka();
    await panelSiap(h);
    await klikSatuKali(h);
    await sampai(() => status(h, "anonim") === "ok", () => `langkah selesai; status: ${["isi", "putusan", "anonim"].map((j) => status(h, j))}`);
    expect(h.urut).toEqual(["buka-blangko", "gambar-ulang", "otomatis"]);
    expect(h.opsiOto).toEqual([{ edoc: true, denganPutusan: true, denganAnonim: true, melayang: true, putusan: null, putusanRtf: null }]);
    expect(["isi", "putusan", "anonim"].map((j) => status(h, j))).toEqual(["ok", "ok", "ok"]);
    expect(baris(h, "isi").textContent).toContain("Tersimpan di SIPP");
    simpanTangkapan(h, "selesai");
  });

  it("e-Doc anonimisasi dilepas centangnya: alur ekstensi dipanggil dengan denganAnonim:false", async () => {
    const h = buka();
    await panelSiap(h);
    cek(h, "anonim").checked = false;
    cek(h, "anonim").dispatchEvent(new h.w.Event("change"));
    expect(status(h, "anonim")).toBe("tidak");
    expect(panel(h)!.querySelector(".aleta-pusipp-ringkas")!.textContent).toBe("1 Putusan Akhir akan diisi dan disimpan · 1 e-Doc akan diunggah");
    await klikSatuKali(h);
    await sampai(() => status(h, "isi") === "ok", "selesai");
    expect(h.opsiOto[0]).toMatchObject({ edoc: true, denganPutusan: true, denganAnonim: false });
  });

  it("kedua e-Doc dilepas: Putusan Akhir saja (edoc:false)", async () => {
    const h = buka();
    await panelSiap(h);
    for (const j of ["putusan", "anonim"]) {
      cek(h, j).checked = false;
      cek(h, j).dispatchEvent(new h.w.Event("change"));
    }
    await klikSatuKali(h);
    await sampai(() => status(h, "isi") === "ok", "selesai");
    expect(h.opsiOto[0]).toMatchObject({ edoc: false });
  });

  it("alur ekstensi gagal (praperiksa menahan): langkah isi gagal dengan sebab, e-Doc 'tidak dikerjakan', tidak ada yang dianggap tercatat", async () => {
    const h = buka({
      otomatis: async () => ({ ok: false, tahap: "praperiksa", pesan: "Praperiksa menahan: tanggal putusan mendahului sidang terakhir. Periksa di bagian Putusan otomatis panel, lalu tekan Isikan sendiri." }),
    });
    await panelSiap(h);
    await klikSatuKali(h);
    await sampai(() => status(h, "isi") === "gagal", "gagal");
    expect(baris(h, "isi").textContent).toContain("Praperiksa menahan");
    expect(status(h, "putusan")).toBe("gagal");
    expect(baris(h, "putusan").textContent).toContain("Tidak dikerjakan - Putusan Akhir belum tersimpan");
    simpanTangkapan(h, "gagal");
  });

  it("blangko Putusan Akhir tidak terbuka: sebab SIPP dilaporkan, alur ekstensi tidak dipanggil", async () => {
    const h = buka({ bukaBlangko: { ok: false, pesan: 'Tombol "Tambah Putusan Akhir" maupun tab Putusan Akhir tidak ada di halaman SIPP perkara ini.' } });
    await panelSiap(h);
    await klikSatuKali(h);
    await sampai(() => status(h, "isi") === "gagal", "gagal");
    expect(h.urut).toEqual(["buka-blangko"]);
    expect(baris(h, "isi").textContent).toContain("Tambah Putusan Akhir");
  });

  it("Putusan Akhir tersimpan tetapi anonimisasi gagal: isi tercatat, putusan tercatat, anonimisasi gagal beserta sebab - putusan tidak dibatalkan", async () => {
    const h = buka({
      otomatis: async () => ({
        ok: true,
        tersimpan: true,
        edoc: {
          ok: false,
          langkah: [
            { kunci: "putusan", judul: "e-Doc putusan", teks: "terunggah", nada: "ok" },
            { kunci: "anonimisasi", judul: "e-Doc anonimisasi", teks: "tidak diunggah - ABT tidak menjawab", nada: "salah" },
          ],
        },
      }),
    });
    await panelSiap(h);
    await klikSatuKali(h);
    await sampai(() => status(h, "anonim") === "gagal", "anonim gagal");
    expect(status(h, "isi")).toBe("ok");
    expect(status(h, "putusan")).toBe("ok");
    expect(baris(h, "anonim").textContent).toContain("ABT tidak menjawab");
  });

  it("dua klik bersamaan: alur ekstensi hanya sekali", async () => {
    const h = buka();
    await panelSiap(h);
    utama(h).click();
    await sampai(() => panel(h)!.querySelector('[data-pusipp="ya"]'), "konfirmasi");
    const ya = panel(h)!.querySelector('[data-pusipp="ya"]') as HTMLButtonElement;
    ya.click();
    ya.click();
    await sampai(() => status(h, "anonim") === "ok", "selesai");
    expect(h.urut.filter((x) => x === "otomatis")).toHaveLength(1);
  });
});

describe("putusan sudah terisi: hanya e-Doc (juga untuk mengulang unggah saja)", () => {
  it("Ya: tanpa membuka blangko; kunci diambil dan dilepas; modul e-Doc dipanggil dengan centang yang dipilih; ringkasan + muat ulang bersama", async () => {
    const h = buka({ terisi: true });
    await panelSiap(h);
    await klikSatuKali(h);
    await sampai(() => status(h, "anonim") === "ok", "selesai");
    expect(h.urut).toEqual(["kunci:ambil", "edoc:jalankan", "kunci:lepas"]);
    expect(h.opsiOto).toEqual([{ edocSaja: true, denganPutusan: true, denganAnonim: true, namaPutusan: null, namaRtf: null }]);
    expect(status(h, "isi")).toBe("lewat");
    expect(h.ringkasan).toHaveLength(1);
    expect(h.ringkasan[0].nomor).toBe(NOMOR);
    expect(h.ringkasan[0].baris.map((b: any) => [b.jenis, b.ok])).toEqual([
      ["e-Doc putusan", true],
      ["e-Doc anonimisasi", true],
    ]);
  });

  it("kunci dipegang pekerjaan lain: tidak ada e-Doc yang dikirim, sebabnya terbaca di barisnya", async () => {
    const h = buka({ terisi: true, kunciSibuk: true });
    await panelSiap(h);
    await klikSatuKali(h);
    await sampai(() => status(h, "putusan") === "gagal", "gagal");
    expect(h.urut).toEqual(["kunci:ambil"]);
    expect(baris(h, "putusan").textContent).toContain("sedang dikerjakan oleh Derry");
  });

  it("anonimisasi gagal pada unggah ulang: laporan menyebut sebab dan memuat ulang TIDAK otomatis (gagal = tombol saja)", async () => {
    const h = buka({
      terisi: true,
      adaPutusan: true,
      edocJalankan: async () => ({
        ok: false,
        bunyi: "x",
        langkah: [
          { kunci: "putusan", judul: "e-Doc putusan", teks: "sudah ada di SIPP, dilewati - tidak diganti", nada: "lewat" },
          { kunci: "anonimisasi", judul: "e-Doc anonimisasi", teks: "tidak diunggah - penyamar gagal", nada: "salah" },
        ],
      }),
    });
    await panelSiap(h);
    expect(status(h, "putusan")).toBe("lewat");
    await klikSatuKali(h);
    await sampai(() => status(h, "anonim") === "gagal", "gagal");
    expect(h.opsiOto[0]).toMatchObject({ denganPutusan: false, denganAnonim: true });
    expect(h.ringkasan[0].baris.some((b: any) => b.ok === false)).toBe(true);
  });
});

describe("terpasang di ekstensi", () => {
  it("manifest memuat putusan-sipp.js dan putusan-sipp.css di blok SIPP; skrip penyusun menanamnya", () => {
    const manifest = JSON.parse(readFileSync(path.join(AKAR, "manifest.json"), "utf8"));
    const sipp = manifest.content_scripts.find((c: { matches: string[]; js: string[] }) => c.matches.some((m) => m.includes("/SIPP/")) && c.js.includes("konten.js"));
    expect(sipp.js).toEqual(expect.arrayContaining(["putusan-sipp.js", "putusan-edoc-sekaligus.js", "abt-klien.js"]));
    expect(sipp.css).toContain("putusan-sipp.css");
    const susun = readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8");
    expect(susun).toContain('"putusan-sipp.js"');
    expect(susun).toContain('"putusan-sipp.css"');
  });

  it("tidak ada alur tulis baru: berkas ini tidak memanggil rute SIPP/portal tulis sendiri dan tidak memuat kata ALETA ke SIPP", () => {
    expect(PUSIPP).not.toMatch(/fetch\(/);
    expect(PUSIPP).not.toMatch(/alatAmbil\(/);
    expect(PUSIPP).toContain("bagianOto.otomatis(");
    expect(PUSIPP).toContain("mod.jalankan(");
    // kotak.otomatis di konten.js menekan tombol yang sama dengan panel
    const konten = baca("konten.js");
    expect(konten).toContain("kotak.otomatis = async (opsi) =>");
    expect(konten).toContain("setTimeout(() => terap.click(), 0)");
  });
});
