/**
 * ============================================================================
 * 23 OKT 2026 (T8) - ISIAN OTOMATIS "Tambah Referensi Data Pihak"
 * ============================================================================
 *
 * pihak-lengkap.js di atas tiruan form#frm_ref_pihak (jsdom + jembatan.js):
 * hanya kolom KOSONG yang terisi, nilai yang ada tidak ditimpa, yang ragu
 * menjadi usulan klik, kolom tersembunyi tidak disentuh, Simpan tidak ditekan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (b: string) => readFileSync(path.join(AKAR, "ekstensi-sipp", b), "utf8").replace(/\r\n/g, "\n");
const SUMBER_JEMBATAN = baca("jembatan.js");
const SUMBER_PENJAGA = baca("penjaga-tanda.js");
const SUMBER_PL = baca("pihak-lengkap.js");

const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 6000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(20);
  }
}



const ASAL = "http://192.168.10.10";
const HARI_INI = (() => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
})();

type Isi = { nama?: string; tgl?: string; umur?: string; jk?: string; agama?: string; kawin?: string; warga?: string; wargaTersembunyi?: boolean; aksi?: string; lajurSaksi?: boolean };
function halaman(o: Isi = {}) {
  const sel = (id: string, awal: string, opsi: string, nilai = "") =>
    `<select id="${id}" name="${id}"><option value="">${awal}</option>${opsi.replace(`value="${nilai}"`, `value="${nilai}" selected`)}</select>`;
  return `
<div id="popup_pihak" class="popup" style="display:block">
  ${o.lajurSaksi ? '<div class="aleta-c2-sbantu aleta-c2-sbantu-ref"></div>' : ""}
  <form id="frm_ref_pihak" method="post" action="${ASAL}/SIPP/pihak_list/validateInput">
    <table><tbody>
      <tr><td><input type="hidden" id="act_frm_ref_pihak" name="act" value="${o.aksi || "add"}">
        <input id="pihak_fullname" name="pihak_fullname" value="${o.nama || ""}"></td></tr>
      <tr><td><input id="pihak_tgl_lahir" name="pihak_tgl_lahir" value="${o.tgl ?? HARI_INI}"><input id="pihak_umur" name="pihak_umur" value="${o.umur || ""}"></td></tr>
      <tr><td><span class="custom-dropdown"><select id="pihak_jenis_identitas" name="pihak_jenis_identitas"><option value="">Pilih Identitas</option><option value="4">KTP</option></select></span>
        <input id="pihak_no_identitas" name="pihak_no_identitas" value=""><input id="pihak_no_tlp" name="pihak_no_tlp" value=""></td></tr>
      <tr><td>${sel("pihak_jenis_kelamin", "Pilih Jenis Kelamin", '<option value="1">Laki Laki</option><option value="2">Perempuan</option>', o.jk)}</td></tr>
      <tr><td>${sel("pihak_agama", "Pilih Agama", '<option value="1">Islam</option><option value="2">Protestan</option>', o.agama)}</td></tr>
      <tr><td>${sel("pihak_status_kawin", "Pilih", '<option value="1">Kawin</option><option value="2">Belum Kawin</option>', o.kawin)}</td></tr>
      <tr><td><span ${o.wargaTersembunyi ? 'style="display:none"' : ""}>${sel("pihak_warga_negara", "Pilih", '<option value="1">Indonesia</option><option value="2">Asing</option>', o.warga)}</span></td></tr>
      <tr><td><textarea id="pihak_alamat" name="pihak_alamat"></textarea></td></tr>
      <tr><td><input type="submit" id="simpan_btn" value="Simpan"></td></tr>
    </tbody></table>
  </form>
</div>`;
}
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function bukaSipp(halaman: string) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${halaman}</body></html>`, {
    url: `${ASAL}/SIPP/detil_perkara_agama`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  w.chrome = { runtime: { id: "aleta-uji", getURL: (x: string) => x, lastError: undefined } };
  const minta: string[] = [];
  w.fetch = async (alamat: string) => {
    const url = String(alamat);
    minta.push(url);
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.postMessage = (data: unknown) => setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data, source: w })), 0);
  let simpan = 0;
  let simpanDicegah = 0;
  w.document.getElementById("simpan_btn").addEventListener("click", (e: Event) => {
    simpan += 1;
    if (e.defaultPrevented) simpanDicegah += 1;
  });
  w.document.getElementById("frm_ref_pihak").addEventListener("submit", (e: Event) => e.preventDefault());
  w.ALETA_PL_JEDA = { detak: 60, ketik: 150 };
  w.eval(SUMBER_PENJAGA);
  w.eval(SUMBER_JEMBATAN);
  w.eval(SUMBER_PL);
  return { w, doc: w.document as Document, minta, simpan: () => simpan, simpanDicegah: () => simpanDicegah };
}

type Halaman = ReturnType<typeof bukaSipp>;
const nilai = (h: Halaman, id: string) => (h.doc.getElementById(id) as HTMLInputElement).value;
const kotak = (h: Halaman) => h.doc.querySelector(".aleta-pl-isian") as HTMLElement | null;
const chip = (h: Halaman, awalan: string) => Array.from(h.doc.querySelectorAll(".aleta-pl-isian button")).find((t) => (t.textContent || "").startsWith(awalan)) as HTMLButtonElement | undefined;
const PL = (h: Halaman) => (h.w as any).AletaPihakLengkap;

describe("T8. bagian murni", () => {
  const h = bukaSipp(halaman());
  it("jenis kelamin dari bin/binti pada nama; ragu = kosong", () => {
    expect(PL(h).jenisKelaminDariNama("AHMAD BIN SALEH")).toBe("L");
    expect(PL(h).jenisKelaminDariNama("Siti Aminah binti Ahmad")).toBe("P");
    expect(PL(h).jenisKelaminDariNama("SITI BINTANG")).toBe("");
    expect(PL(h).jenisKelaminDariNama("RUBINA")).toBe("");
    expect(PL(h).jenisKelaminDariNama("ANDI BIN ALI BINTI")).toBe("");
  });
  it("umur dari tanggal lahir; tanggal bawaan SIPP (hari ini), masa depan, dan ngawur tidak dihitung", () => {
    const kini = new Date(2026, 9, 23);
    expect(PL(h).umurDariTanggal("22/10/1990", kini)).toBe("36");
    expect(PL(h).umurDariTanggal("24/10/1990", kini)).toBe("35");
    expect(PL(h).umurDariTanggal("23/10/2026", kini)).toBe("");
    expect(PL(h).umurDariTanggal("01/01/2030", kini)).toBe("");
    expect(PL(h).umurDariTanggal("31/02/1990", kini)).toBe("");
    expect(PL(h).umurDariTanggal("", kini)).toBe("");
  });
});

describe("T8. blangko Tambah", () => {
  it("mengisi hanya yang kosong: jenis kelamin, umur, warga negara; agama menjadi usulan; Simpan tidak ditekan", async () => {
    const h = bukaSipp(halaman({ nama: "SITI AMINAH BINTI AHMAD", tgl: "05/03/1990" }));
    await sampai(() => nilai(h, "pihak_jenis_kelamin") === "2", "jenis kelamin Perempuan");
    await sampai(() => nilai(h, "pihak_umur") !== "", "umur terisi");
    expect(Number(nilai(h, "pihak_umur"))).toBeGreaterThanOrEqual(36);
    await sampai(() => nilai(h, "pihak_warga_negara") === "1", "warga negara Indonesia");
    expect(nilai(h, "pihak_agama")).toBe("");
    const usul = await sampai(() => chip(h, "Usulan Agama: Islam"), "usulan agama tampil");
    usul.click();
    await sampai(() => nilai(h, "pihak_agama") === "1", "agama terisi setelah klik");
    expect(kotak(h)!.textContent).toMatch(/Jenis kelamin: Perempuan - terisi otomatis \(binti pada nama\)/);
    expect(h.simpan()).toBe(0);
    // tidak ada kata "Aleta" pada nilai yang diisikan ke form SIPP
    for (const id of ["pihak_jenis_kelamin", "pihak_umur", "pihak_warga_negara", "pihak_agama"]) expect(nilai(h, id)).not.toMatch(/aleta/i);
  });

  it("nilai yang sudah ada tidak ditimpa", async () => {
    const h = bukaSipp(halaman({ nama: "SITI BINTI AHMAD", tgl: "05/03/1990", umur: "40", jk: "1", warga: "2", agama: "2" }));
    await tunggu(900);
    expect(nilai(h, "pihak_jenis_kelamin")).toBe("1");
    expect(nilai(h, "pihak_umur")).toBe("40");
    expect(nilai(h, "pihak_warga_negara")).toBe("2");
    expect(nilai(h, "pihak_agama")).toBe("2");
    expect(chip(h, "Usulan Agama")).toBeUndefined();
  });

  it("tanggal lahir bawaan SIPP (hari ini) tidak menghasilkan umur; nama tanpa bin/binti tidak menebak jenis kelamin", async () => {
    const h = bukaSipp(halaman({ nama: "ANDI WIJAYA" }));
    await tunggu(900);
    expect(nilai(h, "pihak_umur")).toBe("");
    expect(nilai(h, "pihak_jenis_kelamin")).toBe("");
    expect(nilai(h, "pihak_warga_negara")).toBe("1"); // warga negara tidak bergantung pada nama
  });

  it("Batalkan mengosongkan lagi dan kolom itu tidak diisi ulang", async () => {
    const h = bukaSipp(halaman({ nama: "ANDI BIN ALI" }));
    await sampai(() => nilai(h, "pihak_jenis_kelamin") === "1", "Laki Laki dari bin");
    const batal = await sampai(() => kotak(h)!.querySelector("button"), "tombol Batalkan");
    expect(batal.textContent).toBe("Batalkan");
    (batal as HTMLButtonElement).click();
    await sampai(() => nilai(h, "pihak_jenis_kelamin") === "", "dikosongkan");
    await tunggu(900);
    expect(nilai(h, "pihak_jenis_kelamin")).toBe("");
  });

  it("isian yang diubah petugas sesudahnya tidak disentuh lagi", async () => {
    const h = bukaSipp(halaman({ nama: "ANDI BIN ALI" }));
    await sampai(() => nilai(h, "pihak_jenis_kelamin") === "1", "Laki Laki dari bin");
    const sel = h.doc.getElementById("pihak_jenis_kelamin") as HTMLSelectElement;
    sel.value = "2";
    await tunggu(900);
    expect(nilai(h, "pihak_jenis_kelamin")).toBe("2");
  });

  it("kolom yang disembunyikan SIPP (.hide) tidak diisi", async () => {
    const h = bukaSipp(halaman({ nama: "ANDI BIN ALI", wargaTersembunyi: true }));
    await sampai(() => nilai(h, "pihak_jenis_kelamin") === "1", "kolom tampak tetap terisi");
    await tunggu(500);
    expect(nilai(h, "pihak_warga_negara")).toBe("");
  });

  it("di alur saksi, agama dan status kawin tetap milik lajur saksi (tidak ada usulan ganda)", async () => {
    const h = bukaSipp(halaman({ nama: "ANDI BIN ALI", tgl: "05/03/2012", lajurSaksi: true }));
    await sampai(() => nilai(h, "pihak_jenis_kelamin") === "1", "jenis kelamin tetap terisi dari nama");
    await tunggu(500);
    expect(chip(h, "Usulan Agama")).toBeUndefined();
    expect(chip(h, "Usulan Status kawin")).toBeUndefined();
  });

  it("anak di bawah 17 tahun: status kawin 'Belum Kawin' hanya usulan, tidak diisi", async () => {
    const h = bukaSipp(halaman({ nama: "ANDI", tgl: "05/03/2012" }));
    const usul = await sampai(() => chip(h, "Usulan Status kawin: Belum Kawin"), "usulan tampil");
    expect(nilai(h, "pihak_status_kawin")).toBe("");
    usul.click();
    await sampai(() => nilai(h, "pihak_status_kawin") === "2", "terisi setelah klik");
  });
});

describe("T8. blangko Edit", () => {
  it("tidak mengisi otomatis; yang dapat dideteksi menjadi usulan klik", async () => {
    const h = bukaSipp(halaman({ nama: "ANDI BIN ALI", tgl: "05/03/1990", aksi: "updt" }));
    const usul = await sampai(() => chip(h, "Usulan Jenis kelamin: Laki Laki"), "usulan tampil");
    await tunggu(500);
    expect(nilai(h, "pihak_jenis_kelamin")).toBe("");
    expect(nilai(h, "pihak_umur")).toBe("");
    usul.click();
    await sampai(() => nilai(h, "pihak_jenis_kelamin") === "1", "terisi setelah klik");
    expect(h.simpan()).toBe(0);
  });
});

describe("T8. pengingat merah tetap hanya untuk nilai SK yang kosong", () => {
  it("jenis identitas, nomor identitas, telepon kosong = merah; bentuk NIK/telepon tidak diperiksa", async () => {
    const h = bukaSipp(halaman({ nama: "ANDI BIN ALI" }));
    await sampai(() => h.doc.querySelectorAll(".aleta-pl-ingat:not([hidden])").length === 3, "tiga pengingat");
    (h.doc.getElementById("pihak_no_identitas") as HTMLInputElement).value = "123";
    (h.doc.getElementById("pihak_no_tlp") as HTMLInputElement).value = "abc";
    await sampai(() => h.doc.querySelectorAll(".aleta-pl-ingat:not([hidden])").length === 1, "tinggal jenis identitas");
  });
});
