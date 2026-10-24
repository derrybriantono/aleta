/**
 * ============================================================================
 * 23 OKT 2026 (T7) - "Hubungan saksi" JUGA di "Tambah Referensi Data Pihak"
 * ============================================================================
 *
 * Saat petugas menekan [Cari] pada blangko saksi, SIPP menyembunyikan
 * form#frm_user dan menampilkan form#frm_ref_pihak. Kotak hubungan kini ada di
 * lajur usulan blangko itu juga; pilihannya SATU dengan kotak di blangko saksi
 * (Keterangan saksi terisi, jenis kelamin diusulkan dari hubungan).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (b: string) => readFileSync(path.join(AKAR, "ekstensi-sipp", b), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_JEMBATAN = baca("jembatan.js");
const SUMBER_SAKSI = baca("saksiscan.js");

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

const HALAMAN = `
<div id="konten">detil perkara</div>
<div id="popup_form" class="popup" style="display:block">
  <form id="frm_user" method="post" action="${ASAL}/SIPP/addPihak/validateInput">
    <table><tbody>
      <tr><td>Yang Menghadirkan</td><td><select name="saksi_pihak_ke" id="saksi_pihak_ke"><option value="1">Pemohon</option><option value="2">Termohon</option></select></td></tr>
      <tr><td>Nama</td><td><input id="fullname" name="fullname" value="" readonly><input type="button" value="Cari"></td></tr>
      <tr><td>Keterangan</td><td><textarea id="keterangan" name="keterangan"></textarea>
        <input type="hidden" id="pihak_ke" name="pihak_ke" value="13"></td></tr>
      <tr><td colspan="2"><input type="submit" id="simpan" value="Simpan"></td></tr>
    </tbody></table>
  </form>
</div>
<div id="popup_pihak" class="popup" style="display:none">
  <div class="detil">
    <form id="frm_ref_pihak" method="post" action="${ASAL}/SIPP/pihak_list/validateInput">
      <table><tbody>
        <tr><td><input type="hidden" id="act_frm_ref_pihak" name="act" value="add">
          <input id="pihak_fullname" name="pihak_fullname" value=""></td></tr>
        <tr><td><input id="pihak_tgl_lahir" name="pihak_tgl_lahir" value="${HARI_INI}"><input id="pihak_umur" name="pihak_umur" value=""></td></tr>
        <tr><td><input id="pihak_no_identitas" name="pihak_no_identitas" value=""></td></tr>
        <tr><td><textarea id="pihak_alamat" name="pihak_alamat"></textarea></td></tr>
        <tr><td><select id="pihak_jenis_kelamin" name="pihak_jenis_kelamin"><option value="">Pilih Jenis Kelamin</option><option value="1">Laki Laki</option><option value="2">Perempuan</option></select></td></tr>
        <tr><td><select id="pihak_agama" name="pihak_agama"><option value="">Pilih Agama</option><option value="1">Islam</option><option value="2">Protestan</option></select></td></tr>
        <tr><td><select id="apakahtni" name="apakahtni"><option value="">Pilih</option><option value="1">TNI</option><option value="2">Lain-Lain</option><option value="3">PNS</option></select>
          <input id="pihak_pekerjaan" name="pihak_pekerjaan" value=""></td></tr>
        <tr><td><select id="pihak_status_kawin" name="pihak_status_kawin"><option value="">Pilih</option><option value="1">Kawin</option><option value="2">Belum Kawin</option></select></td></tr>
        <tr><td><select id="pihak_pendidikan" name="pihak_pendidikan"><option value="">Pilih</option><option value="4">SLTA</option></select></td></tr>
        <tr><td><input type="button" id="back_pihak" value="Kembali"><input type="submit" id="simpan_btn" value="Simpan"></td></tr>
      </tbody></table>
    </form>
  </div>
</div>`;

const KONTEKS_CERAI_TALAK = {
  ok: true,
  perkara: { nomor: "608/Pdt.G/2026/PA.Dgl", jenis: "Cerai Talak", alurPerkaraId: 15, jenisPerkaraId: 346 },
  sebutan: { satu: "Pemohon", dua: "Termohon", sumber: "jenis" },
  pihakPertama: [{ urutan: 1, nama: "ANDI", alamat: "Desa Lalombi, Kecamatan Banawa Selatan" }],
  pihakKedua: [{ urutan: 1, nama: "BUNGA", alamat: "Desa Lalombi" }],
  saksi: [{ urutan: 1, nama: "EFENDI BIN TAHIR", keterangan: "Sepupu Penggugat" }],
};

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function bukaSipp(halaman = HALAMAN) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${halaman}</body></html>`, {
    url: `${ASAL}/SIPP/detil_perkara_agama`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "ui", ujiIzinkanNyata: true };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.189.0" }), getURL: (x: string) => x, lastError: undefined, sendMessage: () => undefined },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = simpanan[k];
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, isi),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const minta: Array<{ url: string; cara: string; badan: string }> = [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: string }) => {
    const url = String(alamat);
    const cara = String((opsi && opsi.method) || "GET").toUpperCase();
    minta.push({ url, cara, badan: String((opsi && opsi.body) || "") });
    if (url.includes("/ekstensi/siapa")) return Response.json({ ok: true, data: { nama: "Penguji", peran: "Panitera Pengganti" } });
    if (url.includes("/aleta-ecourt/saksi-bantu") && cara === "GET") {
      return Response.json({
        ok: true,
        data: {
          available: true,
          ok: true,
          bolehKelola: true,
          hubungan: [
            { kunci: "portal:saksi-hubungan:tetangga", teks: "Tetangga", kelompok: "lain", bawaan: true, aktif: true, jumlah: 574 },
            { kunci: "portal:saksi-hubungan:ibu-kandung", teks: "Ibu Kandung", kelompok: "keluarga", bawaan: true, aktif: true, jumlah: 370 },
          ],
          konteks: KONTEKS_CERAI_TALAK,
          konteksAlasan: "",
        },
      });
    }
    if (url.includes("/aleta-ecourt/saksi-bantu") && cara === "POST") {
      return Response.json({
        ok: true,
        data: {
          available: true,
          ok: true,
          calon: [
            {
              pihakId: "4202", tingkat: "pasti", dasar: "nama dan tanggal lahir sama", nama: "EFENDI BIN TAHIR", tempatLahir: "Donggala",
              tanggalLahir: "27-03-1963", jenisKelamin: "Laki-laki", alamat: "Desa Lalombi", pekerjaan: "", nikTerisi: false,
              jumlahPerkaraSaksi: 3, saksiDiPerkaraIni: false, urutanDiPerkaraIni: null, kurangWajib: ["Pekerjaan"], kurang: ["NIK"],
            },
          ],
        },
      });
    }
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.postMessage = (data: unknown) => setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data, source: w })), 0);
  let simpanDitekan = 0;
  let dikirim = 0;
  for (const id of ["simpan", "simpan_btn"]) w.document.getElementById(id).addEventListener("click", () => (simpanDitekan += 1));
  for (const id of ["frm_user", "frm_ref_pihak"]) {
    w.document.getElementById(id).addEventListener("submit", (e: Event) => {
      dikirim += 1;
      e.preventDefault();
    });
  }
  w.eval(SUMBER_JEMBATAN);
  // cariNomorPerkara milik konten.js - di sini cukup tiruannya.
  w.eval(`function cariNomorPerkara() { return "608/Pdt.G/2026/PA.Dgl"; }\n${SUMBER_ALAT}\n;\n${SUMBER_SAKSI}`);
  const doc = w.document as Document;
  return { w, doc, minta, simpan: () => simpanDitekan, kirim: () => dikirim };
}
type Halaman = ReturnType<typeof bukaSipp>;

const el = <T extends Element>(h: Halaman, s: string) => h.doc.querySelector(s) as T;
const nilai = (h: Halaman, s: string) => (h.doc.querySelector(s) as HTMLInputElement).value;
function pilih(h: Halaman, s: string, v: string) {
  const sel = el<HTMLSelectElement>(h, s);
  sel.value = v;
  sel.dispatchEvent(new h.w.Event("change", { bubbles: true }));
}

async function kotakSiap(h: Halaman) {
  const kotak = await sampai(() => el<HTMLElement>(h, "#frm_user .aleta-c2-sbantu"), "kotak hubungan terpasang");
  await sampai(() => (kotak.querySelector(".aleta-c2-sbantu-hub") as HTMLSelectElement).options.length > 2, "daftar hubungan dimuat");
  await sampai(() => (kotak.querySelector(".aleta-c2-sbantu-sasaran") as HTMLSelectElement).options.length === 3, "sebutan dimuat");
  return kotak;
}


const HALAMAN_REF = HALAMAN.replace('id="popup_form" class="popup" style="display:block"', 'id="popup_form" class="popup" style="display:none"').replace(
  'id="popup_pihak" class="popup" style="display:none"',
  'id="popup_pihak" class="popup" style="display:block"'
);

async function kotakRefSiap(h: Halaman) {
  const kotak = await sampai(() => el<HTMLElement>(h, "#frm_ref_pihak, .aleta-c2-sbantu-ref .aleta-c2-sbantu") && h.doc.querySelector(".aleta-c2-sbantu-ref .aleta-c2-sbantu") as HTMLElement, "kotak hubungan di blangko referensi");
  await sampai(() => (kotak.querySelector(".aleta-c2-sbantu-hub") as HTMLSelectElement).options.length > 2, "daftar hubungan dimuat");
  await sampai(() => (kotak.querySelector(".aleta-c2-sbantu-sasaran") as HTMLSelectElement).options.length === 3, "sebutan dimuat");
  return kotak;
}

describe("T7. hubungan saksi di Tambah Referensi Data Pihak", () => {
  it("memilih hubungan di blangko referensi mengisi Keterangan saksi dan jenis kelamin; Simpan tidak ditekan", async () => {
    const h = bukaSipp(HALAMAN_REF);
    const kotak = await kotakRefSiap(h);
    expect(kotak.querySelector(".aleta-c2-sbantu-judul")!.textContent).toBe("Hubungan saksi (ALETA)");
    pilih(h, ".aleta-c2-sbantu-ref .aleta-c2-sbantu-hub", "Ibu Kandung");
    await sampai(() => nilai(h, "#keterangan") === "Ibu Kandung Pemohon", "Keterangan saksi terisi dari kotak di blangko referensi");
    await sampai(() => nilai(h, "#pihak_jenis_kelamin") === "2", "jenis kelamin Perempuan diusulkan dari hubungan");
    expect(nilai(h, "#pihak_agama")).toBe("1");
    expect(h.simpan()).toBe(0);
    expect(h.kirim()).toBe(0);
  });

  it("Keterangan yang sudah berisi tidak ditimpa tanpa persetujuan", async () => {
    const h = bukaSipp(HALAMAN_REF);
    el<HTMLTextAreaElement>(h, "#keterangan").value = "Tetangga Termohon";
    const kotak = await kotakRefSiap(h);
    pilih(h, ".aleta-c2-sbantu-ref .aleta-c2-sbantu-hub", "Ibu Kandung");
    const ganti = kotak.querySelector(".aleta-c2-sbantu-ganti") as HTMLButtonElement;
    await sampai(() => !ganti.hidden, "tawaran ganti tampil");
    expect(nilai(h, "#keterangan")).toBe("Tetangga Termohon");
    ganti.click();
    await sampai(() => nilai(h, "#keterangan") === "Ibu Kandung Termohon", "diganti setelah klik (pihak ikut Keterangan lama)");
  });

  it("pilihan bersama: kotak di blangko saksi ikut menampilkan pilihan dari blangko referensi", async () => {
    const h = bukaSipp(HALAMAN_REF);
    await kotakRefSiap(h);
    pilih(h, ".aleta-c2-sbantu-ref .aleta-c2-sbantu-hub", "Tetangga");
    await sampai(() => nilai(h, "#keterangan") === "Tetangga Pemohon", "keterangan terisi");
    // petugas kembali ke blangko saksi (SIPP menampilkannya lagi)
    (h.doc.getElementById("popup_form") as HTMLElement).style.display = "block";
    (h.doc.getElementById("popup_pihak") as HTMLElement).style.display = "none";
    const kotakSaksi = await sampai(() => el<HTMLElement>(h, "#frm_user .aleta-c2-sbantu"), "kotak blangko saksi");
    await sampai(() => (kotakSaksi.querySelector(".aleta-c2-sbantu-hub") as HTMLSelectElement).value === "Tetangga", "pilihan terbawa");
    expect(kotakSaksi.querySelector(".aleta-c2-sbantu-hasil")!.textContent).toBe("Hasil: Tetangga Pemohon");
  });

  it("tanpa blangko saksi (Tambah Data Pihak biasa) tidak ada kotak hubungan", async () => {
    const h = bukaSipp(HALAMAN_REF.replace('<input type="hidden" id="pihak_ke" name="pihak_ke" value="13">', '<input type="hidden" id="pihak_ke" name="pihak_ke" value="1">'));
    await tunggu(1500);
    expect(h.doc.querySelector(".aleta-c2-sbantu")).toBeNull();
  });
});
