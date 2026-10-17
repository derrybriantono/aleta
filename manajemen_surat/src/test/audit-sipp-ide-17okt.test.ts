// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * AUDIT 17 OKT 2026 - EKSTENSI ALETA DI SIPP, POPUP, DAN WIDGET (1.201-1.205)
 * ============================================================================
 *
 * Tiap uji di sini MERAH pada a2e3618 (rilis 1.205.0) dan hijau sesudah
 * perbaikannya. Skrip ekstensi dijalankan SUNGGUHAN di jsdom.
 *
 *   A. Detak pita L1 (tiap detik) menulis ulang teks yang sama - pengamat
 *      konten.js menganggapnya perubahan SIPP dan menyegarkan panel tiap detik.
 *   B. L1/M1 yang dimuat saat ALETA MATI tidak pernah memasang pengamatnya:
 *      dinyalakan dari popup, jendela SIPP sesudahnya tanpa pita/penjaga.
 *   C. Berpindah Lama <-> UI Baru (aleta-uji-berubah) tidak diikuti L1/M1/M2;
 *      L2 (penanda) tampil dan meminta portal di Tampilan Lama.
 *   D. Judul tombol "Buka di ABT/ALETA" tetap "Nomor perkara belum terbaca"
 *      sesudah nomornya terbaca.
 *   E. Serah terima J01 ke ABT hilang di halaman masuk ABT / halaman APS.
 *   F. Saklar penanda SIPP (ideL2*) tidak ikut setelan per akun.
 *   G. Widget kehadiran menyebut "Tidak ada sidang Anda hari ini" saat jadwal
 *      sidang tidak terbaca (portal available:false).
 *   H. Penanda "Dokumen e-Court belum diverifikasi" masih "perlu dicek" padahal
 *      dasarnya sudah dipastikan pengguna (keputusan 17 Okt butir 31).
 */

const AKAR = path.resolve(__dirname, "../../..");
const EKSTENSI = path.join(AKAR, "ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(EKSTENSI, n), "utf8").replace(/\r\n/g, "\n");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 4000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(10);
  }
}
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

const NOMOR = "565/Pdt.G/2026/PA.Dgl";
type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;
type Jendela = any;

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

/** Halaman SIPP/ABT tiruan + chrome.storage yang menyiarkan onChanged + fetch penghitung. */
function buka(html: string, o: { url: string; simpanan?: Record<string, unknown>; skrip: string[]; mode?: () => string }) {
  const dom = new JSDOM(html, { url: o.url, runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as Jendela;
  const simpanan: Record<string, unknown> = polos({ ...(o.simpanan || {}) });
  const pendengar: Array<(u: Ubah, wil: string) => void> = [];
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.0" }) },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          const ubah: Ubah = {};
          for (const [k, v] of Object.entries(isi)) {
            ubah[k] = { oldValue: simpanan[k], newValue: polos(v) };
            simpanan[k] = polos(v);
          }
          setTimeout(() => pendengar.forEach((f) => f(polos(ubah), "local")), 0);
        },
        remove: async (kunci: string | string[]) => {
          const ubah: Ubah = {};
          for (const k of [kunci].flat()) {
            ubah[k] = { oldValue: simpanan[k] };
            delete simpanan[k];
          }
          setTimeout(() => pendengar.forEach((f) => f(ubah, "local")), 0);
        },
      },
      onChanged: { addListener: (f: (u: Ubah, wil: string) => void) => void pendengar.push(f) },
    },
  };
  const minta: string[] = [];
  w.fetch = async (alamat: string) => {
    minta.push(String(alamat));
    return { ok: true, status: 200, json: async () => ({ ok: true, data: { tersedia: true, boleh: [], perkara: {} } }) };
  };
  if (o.mode) w.alatUjiMode = o.mode;
  const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
  for (const s of o.skrip) vm.runInContext(baca(s), ctx, { filename: s });
  return { w, d: w.document as Document, simpanan, minta, ubah: (isi: Record<string, unknown>) => w.chrome.storage.local.set(isi) };
}

/** Panel ALETA (bagian Putusan otomatis) + jendela Putusan Akhir SIPP 7.0.4. */
const PANEL_PUTUSAN = `<div id="aleta-panel-sipp" class="aleta-panel"><div class="aleta-bagian" data-kunci="isiPutusan"><div class="aleta-bagian-isi">
<button class="aleta-permintaan-tombol" type="button">Ambil usulan dari ALETA</button>
<div class="aleta-unggah-naskah"><div class="aleta-tetap-kaki"><input type="file" accept=".rtf,.docx,.doc,.pdf" class="aleta-berkas"></div></div>
<div class="aleta-isian-putusan"></div></div></div></div>`;
const FORM_PUTUSAN = `<div id="popup_form" class="popup"><div id="form_pop">
<form id="frm_putusan" method="post" action="http://192.168.10.10/SIPP/managePutusanAkhir/validateInput"><table><tbody>
<tr><td id="first-child">Tanggal Putusan<font color="red">*</font></td><td><input id="tgl_putusan" name="tgl_putusan" value=""></td></tr>
<tr><td id="first-child">Keterangan</td><td><textarea id="keterangan" name="keterangan"></textarea></td></tr>
<tr><td colspan="2"><input type="submit" id="simpan" value="Simpan" class="btn"></td></tr>
</tbody></table></form></div></div>`;
const FORM_TUNDA = `<div id="popup_form_2nd" class="popup"><div id="form_pop_2nd">
<form id="frm_tunda_jadwal_sidang" method="post" action="http://192.168.10.10/SIPP/jadwal_sidang_c/validateTunda"><table><tbody>
<tr><td id="first-child">Tanggal Sidang<font color="red">*</font></td><td><input name="tgl_sidang" value=""></td></tr>
<tr><td colspan="2"><input type="submit" id="simpan" value="Simpan" class="btn"></td></tr>
</tbody></table></form></div></div>`;
const URL_DETIL = "http://192.168.10.10/SIPP/perkara_detil_agama/aWQ9MTAxMTc";

// ============================================================================
// A. Detak L1 tidak boleh memicu penyegaran konten.js tiap detik
// ============================================================================
describe("A. detak pita L1 dan pengamat konten.js", () => {
  const KONTEN = baca("konten.js");
  const potong = (nama: string) => {
    const i = KONTEN.indexOf(`function ${nama}(`);
    const j = KONTEN.indexOf("\n}\n", i);
    return KONTEN.slice(i, j + 2);
  };
  // Penyaring pengamat konten.js APA ADANYA (elemenAleta + perubahanDariAleta).
  const PENYARING = `var PENANDA = "aleta-panel-sipp"; var TANDA = "data-aleta-tanda";\n${potong("elemenAleta")}\n${potong("perubahanDariAleta")}\nwindow.__dariAleta = perubahanDariAleta;`;

  it("jendela Putusan Akhir terbuka: tidak ada 'perubahan SIPP' tiap detik selama petugas diam", async () => {
    const h = buka(`<!doctype html><html><head></head><body>${PANEL_PUTUSAN}${FORM_PUTUSAN}</body></html>`, { url: URL_DETIL, skrip: ["sipp-ide-l1.js"] });
    const ctx = (terbuka[terbuka.length - 1] as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
    vm.runInContext(PENYARING, ctx);
    await sampai(() => h.d.querySelector(".aleta-l1-pita"), "pita L1 terpasang");
    await tunggu(1200);
    let picu = 0;
    new h.w.MutationObserver((daftar: MutationRecord[]) => {
      if (daftar.some((p) => !h.w.__dariAleta(p))) picu += 1;
    }).observe(h.d.body, { childList: true, subtree: true });
    await tunggu(2600);
    expect(picu).toBe(0);
    // Penghitungnya tetap hidup: kolom diisi -> teksnya berubah.
    const sebelum = h.d.querySelector('[data-l1="hitung"]')!.textContent;
    const tgl = h.d.querySelector("#tgl_putusan") as HTMLInputElement;
    tgl.value = "16/10/2026";
    tgl.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    expect(h.d.querySelector('[data-l1="hitung"]')!.textContent).not.toBe(sebelum);
  }, 10000);
});

