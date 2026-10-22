/**
 * ============================================================================
 * 22 OKT 2026 (W50) - C. ISI DENGAN TAB (alamat, pekerjaan Lain-Lain)
 *                     D. PENGINGAT MERAH (jenis identitas, nomor identitas, telepon)
 * ============================================================================
 *
 * pihak-lengkap.js di atas tiruan "Tambah Referensi Data Pihak" SIPP
 * (form#frm_ref_pihak) dengan jembatan.js dan data wilayah sungguhan-rupa:
 *
 *   C. usulan bentuk lengkap dan baku tampil samar di bawah kolom, Tab
 *      menerimanya; Tab tanpa usulan = Tab biasa; tidak menimpa tanpa
 *      kecocokan yakin; sinkron dropdown wilayah tetap jalan sesudah Tab.
 *   D. aturan SAMA dengan penilaian bot (SK Tabel 2 I.12: tiga isian dihitung
 *      terisi - aleta_bot/services/sippTahapanService.js) + bentuk NIK/telepon;
 *      hanya mengingatkan, tidak menahan Simpan.
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
const SUMBER_BOT = readFileSync(path.join(AKAR, "aleta_bot", "services", "sippTahapanService.js"), "utf8");

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

type W = { kode: string; nama: string; nilaiSipp: string };
const WILAYAH: Record<string, W[]> = {
  "": [{ kode: "72", nama: "SULAWESI TENGAH", nilaiSipp: "S72" }],
  "72": [
    { kode: "72.03", nama: "KAB. DONGGALA", nilaiSipp: "S7203" },
    { kode: "72.71", nama: "KOTA PALU", nilaiSipp: "S7271" },
  ],
  "72.03": [
    { kode: "72.03.09", nama: "LABUAN", nilaiSipp: "S720309" },
    { kode: "72.03.11", nama: "SINDUE", nilaiSipp: "S720311" },
  ],
  "72.03.11": [{ kode: "72.03.11.2001", nama: "DALAKA", nilaiSipp: "D2001" }],
};

const HALAMAN = `
<table id="daftar_pihak"><thead><tr><th>Nama</th><th>Alamat</th><th>Pekerjaan</th></tr></thead><tbody>
  <tr><td>ANDI</td><td>Jalan Trans Sulawesi No. 5, Desa Lalombi</td><td>Tukang Jahit</td></tr>
  <tr><td>BUNGA</td><td>Dusun Tompe, Desa Lalombi</td><td>Tukang Jahit</td></tr>
</tbody></table>
<div id="popup_pihak" class="popup" style="display:block">
  <form id="frm_ref_pihak" method="post" action="${ASAL}/SIPP/pihak_list/validateInput">
    <table><tbody>
      <tr><td><input id="pihak_fullname" name="pihak_fullname" value=""></td></tr>
      <tr id="baris_identitas"><td><span class="custom-dropdown"><select id="pihak_jenis_identitas" name="pihak_jenis_identitas">
        <option value="">Pilih Identitas</option><option value="2">Kartu Keluarga</option><option value="4">KTP</option><option value="5">Paspor</option></select></span></td></tr>
      <tr><td><input id="pihak_no_identitas" name="pihak_no_identitas" value=""></td></tr>
      <tr><td><input id="pihak_no_tlp" name="pihak_no_tlp" value=""></td></tr>
      <tr><td><textarea id="pihak_alamat" name="pihak_alamat"></textarea></td></tr>
      <tr><td><select name="prop" id="prop"><option value="">- Cari/Pilih Propinsi -</option></select></td></tr>
      <tr><td><select name="kab" id="kab"><option value="">- Cari/Pilih Kabupaten/Kota -</option></select></td></tr>
      <tr><td><select name="kec" id="kec"><option value="">- Cari/Pilih Kecamatan -</option></select></td></tr>
      <tr><td><select name="kel" id="kel"><option value="">- Cari/Pilih Kelurahan/Desa -</option></select></td></tr>
      <tr id="baris_pekerjaan"><td><input type="text" id="pihak_pekerjaan" name="pihak_pekerjaan" value="" placeholder="Isikan Pekerjaan Di Sini"></td></tr>
      <tr><td><input type="submit" id="simpan_btn" value="Simpan"></td></tr>
    </tbody></table>
  </form>
</div>`;

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
  w.chrome = { runtime: { id: "aleta-uji", getURL: (x: string) => x, lastError: undefined } };
  const minta: string[] = [];
  w.fetch = async (alamat: string) => {
    const url = String(alamat);
    minta.push(url);
    if (url.includes("/aleta-ecourt/wilayah")) {
      const induk = new URL(url, ASAL).searchParams.get("induk") || "";
      await tunggu(10);
      return Response.json({ ok: true, data: { ok: true, sandi: { ok: true }, data: WILAYAH[induk] || [] } });
    }
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

const el = <T extends HTMLElement>(h: Halaman, id: string) => h.doc.getElementById(id) as T;
function isi(h: Halaman, id: string, nilai: string) {
  const e = el<HTMLInputElement>(h, id);
  e.focus();
  e.value = nilai;
  try {
    e.setSelectionRange(nilai.length, nilai.length);
  } catch {
    /* select tidak punya caret */
  }
  e.dispatchEvent(new h.w.Event("input", { bubbles: true }));
}
/** Tekan Tab; true bila halaman memakainya (usulan diterima), false bila dibiarkan Tab biasa. */
function tekanTab(h: Halaman, id: string) {
  const e = el<HTMLElement>(h, id);
  const k = new h.w.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  e.dispatchEvent(k);
  return k.defaultPrevented as boolean;
}
const saranTeks = (h: Halaman, id: string) => {
  const kotak = el<HTMLElement>(h, id).nextElementSibling as HTMLElement | null;
  return kotak && kotak.classList.contains("aleta-pl-saran") && !kotak.hidden ? kotak.textContent || "" : "";
};

const PL = () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only" });
  const w = dom.window as any;
  w.ALETA_PIHAK_LENGKAP_MANUAL = true;
  w.eval(SUMBER_PL);
  return { pl: w.AletaPihakLengkap, tutup: () => w.close() };
};

/* ─────────────────────────── C. murni ─────────────────────────── */

describe("C. bentuk baku (murni)", () => {
  it("singkatan dipanjangkan dan huruf besar-kecil dirapikan", () => {
    const { pl, tutup } = PL();
    expect(pl.bakuAlamat("jl trans sulawesi no 5 ds dalaka kec sindue kab donggala prov sulawesi tengah")).toBe(
      "Jalan Trans Sulawesi No 5 Desa Dalaka Kecamatan Sindue Kabupaten Donggala Provinsi Sulawesi Tengah"
    );
    expect(pl.bakuAlamat("JL. MAWAR NO.7, KEL. BALAROA , KEC. PALU BARAT")).toBe("Jalan Mawar No.7, Kelurahan Balaroa, Kecamatan Palu Barat");
    expect(pl.bakuAlamat("dsn tompe ds lalombi")).toBe("Dusun Tompe Desa Lalombi");
    tutup();
  });

  it("RT/RW dirapikan dalam berbagai tulisan", () => {
    const { pl, tutup } = PL();
    expect(pl.bakuAlamat("jl mawar rt.02/rw.03")).toBe("Jalan Mawar RT 02/RW 03");
    expect(pl.bakuAlamat("jl mawar rt 3 rw 4")).toBe("Jalan Mawar RT 3/RW 4");
    expect(pl.bakuAlamat("jl mawar RT/RW 002/005")).toBe("Jalan Mawar RT 002/RW 005");
    tutup();
  });

  it("pekerjaan: baku, alias, awalan; banyak kecocokan = daftar kecil, bukan Tab", () => {
    const { pl, tutup } = PL();
    expect(pl.saranPekerjaan("wiraswasta", []).unik).toBe("Wiraswasta");
    expect(pl.saranPekerjaan("wiras", []).unik).toBe("Wiraswasta");
    expect(pl.saranPekerjaan("irt", []).unik).toBe("Mengurus Rumah Tangga");
    expect(pl.saranPekerjaan("swasta", []).unik).toBe("Karyawan Swasta");
    expect(pl.saranPekerjaan("nelay", []).unik).toBe("Nelayan");
    expect(pl.saranPekerjaan("Wiraswasta", []).unik).toBe(""); // sudah baku
    const banyak = pl.saranPekerjaan("karyawan", []);
    expect(banyak.unik).toBe("");
    expect(banyak.pilihan).toEqual(["Karyawan Swasta", "Karyawan Honorer"]);
    expect(pl.saranPekerjaan("xqz", [])).toEqual({ unik: "", pilihan: [] });
    // nilai yang sudah ada di SIPP ikut menjadi sumber
    expect(pl.saranPekerjaan("tukang jah", ["tukang jahit", "Tukang Jahit"]).unik).toBe("Tukang Jahit");
    tutup();
  });

  it("alamat: frasa terakhir dilengkapi hanya bila tepat satu kelompok kosakata cocok; selebihnya tidak menebak", () => {
    const { pl, tutup } = PL();
    expect(pl.saranAlamat("jl. trans sul", ["Trans Sulawesi"])).toBe("Jalan Trans Sulawesi");
    expect(pl.saranAlamat("jl mawar dsn tom", ["Tompe"])).toBe("Jalan Mawar Dusun Tompe");
    // dua kemungkinan -> hanya dibakukan, tidak dilengkapi
    expect(pl.saranAlamat("jl mawar desa lal", ["Lalombi", "Lalundu"])).toBe("Jalan Mawar Desa Lal");
    // sudah baku, tak ada yang perlu diubah -> tanpa usulan
    expect(pl.saranAlamat("Jalan Mawar No. 5", [])).toBe("");
    // spasi di ujung = Tab biasa, bukan melengkapi
    expect(pl.saranAlamat("Jalan Mawar ", ["Mawar Indah"])).toBe("");
    tutup();
  });
});

/* ─────────────────────────── C. halaman ─────────────────────────── */

describe("C. Tab di halaman SIPP tiruan", () => {
  it("alamat: usulan tampil samar, Tab menerimanya; Tab kedua pindah kolom", async () => {
    const h = bukaSipp();
    isi(h, "pihak_alamat", "jl mawar rt 2 rw 3 ds lalombi");
    await sampai(() => saranTeks(h, "pihak_alamat"), "usulan tampil");
    expect(saranTeks(h, "pihak_alamat")).toContain("Jalan Mawar RT 2/RW 3 Desa Lalombi");
    expect(el<HTMLTextAreaElement>(h, "pihak_alamat").value).toBe("jl mawar rt 2 rw 3 ds lalombi"); // belum diterapkan
    expect(tekanTab(h, "pihak_alamat")).toBe(true);
    expect(el<HTMLTextAreaElement>(h, "pihak_alamat").value).toBe("Jalan Mawar RT 2/RW 3 Desa Lalombi");
    expect(tekanTab(h, "pihak_alamat")).toBe(false); // sudah baku: Tab biasa
    expect(saranTeks(h, "pihak_alamat")).toBe("");
    expect(h.simpan()).toBe(0);
  });

  it("alamat: melengkapi dari alamat lain di tabel SIPP halaman itu (dibaca saja)", async () => {
    const h = bukaSipp();
    isi(h, "pihak_alamat", "Jalan Trans Sul");
    await sampai(() => saranTeks(h, "pihak_alamat").includes("Jalan Trans Sulawesi"), "usulan dari tabel");
    expect(tekanTab(h, "pihak_alamat")).toBe(true);
    expect(el<HTMLTextAreaElement>(h, "pihak_alamat").value).toBe("Jalan Trans Sulawesi");
    // tabel tidak berubah
    expect(h.doc.querySelectorAll("#daftar_pihak tbody tr").length).toBe(2);
  });

  it("alamat: tanpa usulan atau caret bukan di ujung = Tab biasa; tidak menimpa ketikan", async () => {
    const h = bukaSipp();
    isi(h, "pihak_alamat", "Jalan Mawar No. 5");
    expect(tekanTab(h, "pihak_alamat")).toBe(false);
    expect(el<HTMLTextAreaElement>(h, "pihak_alamat").value).toBe("Jalan Mawar No. 5");

    isi(h, "pihak_alamat", "jl mawar");
    el<HTMLTextAreaElement>(h, "pihak_alamat").setSelectionRange(2, 2); // mengedit di tengah
    expect(tekanTab(h, "pihak_alamat")).toBe(false);
    expect(el<HTMLTextAreaElement>(h, "pihak_alamat").value).toBe("jl mawar");

    isi(h, "pihak_alamat", "");
    expect(tekanTab(h, "pihak_alamat")).toBe(false);
  });

  it("alamat: setelah Tab, sinkron dropdown wilayah tetap jalan; sisa provinsi ditambahkan ke alamat", async () => {
    const h = bukaSipp();
    isi(h, "pihak_alamat", "jl mawar ds dalaka kec sindue kab donggala");
    expect(tekanTab(h, "pihak_alamat")).toBe(true);
    expect(el<HTMLTextAreaElement>(h, "pihak_alamat").value).toBe("Jalan Mawar Desa Dalaka Kecamatan Sindue Kabupaten Donggala");
    await sampai(() => (el<HTMLSelectElement>(h, "kel").value === "D2001"), "dropdown terisi sesudah Tab");
    expect(el<HTMLSelectElement>(h, "prop").value).toBe("S72");
    el<HTMLTextAreaElement>(h, "pihak_alamat").blur();
    await sampai(() => el<HTMLTextAreaElement>(h, "pihak_alamat").value.endsWith(", Provinsi Sulawesi Tengah"), "provinsi di kanan alamat");
    expect(el<HTMLTextAreaElement>(h, "pihak_alamat").value).toBe(
      "Jalan Mawar Desa Dalaka Kecamatan Sindue Kabupaten Donggala, Provinsi Sulawesi Tengah"
    );
  });

  it("pekerjaan Lain-Lain: Tab menerima bentuk baku; banyak kecocokan = daftar kecil dan Tab biasa; nilai tak dikenal tidak ditimpa", async () => {
    const h = bukaSipp();
    isi(h, "pihak_pekerjaan", "wiras");
    await sampai(() => saranTeks(h, "pihak_pekerjaan").includes("Wiraswasta"), "usulan pekerjaan");
    expect(tekanTab(h, "pihak_pekerjaan")).toBe(true);
    expect(el<HTMLInputElement>(h, "pihak_pekerjaan").value).toBe("Wiraswasta");
    expect(tekanTab(h, "pihak_pekerjaan")).toBe(false);

    isi(h, "pihak_pekerjaan", "karyawan");
    const kotak = await sampai(() => {
      const k = el(h, "pihak_pekerjaan").nextElementSibling as HTMLElement;
      return k && !k.hidden && k.querySelectorAll("button").length === 2 ? k : null;
    }, "daftar kecil");
    expect(tekanTab(h, "pihak_pekerjaan")).toBe(false);
    expect(el<HTMLInputElement>(h, "pihak_pekerjaan").value).toBe("karyawan");
    (kotak.querySelectorAll("button")[0] as HTMLButtonElement).click();
    expect(el<HTMLInputElement>(h, "pihak_pekerjaan").value).toBe("Karyawan Swasta");

    isi(h, "pihak_pekerjaan", "pembuat gerabah");
    expect(tekanTab(h, "pihak_pekerjaan")).toBe(false);
    expect(el<HTMLInputElement>(h, "pihak_pekerjaan").value).toBe("pembuat gerabah");
    // nilai SIPP yang sudah ada jadi sumber
    isi(h, "pihak_pekerjaan", "tukang jah");
    expect(tekanTab(h, "pihak_pekerjaan")).toBe(true);
    expect(el<HTMLInputElement>(h, "pihak_pekerjaan").value).toBe("Tukang Jahit");
    for (const id of ["pihak_pekerjaan", "pihak_alamat"]) expect(el<HTMLInputElement>(h, id).value).not.toMatch(/aleta/i);
  });

  it("pekerjaan tersembunyi SIPP (belum memilih Lain-Lain): tidak ada usulan", async () => {
    const h = bukaSipp();
    el(h, "baris_pekerjaan").style.display = "none";
    isi(h, "pihak_pekerjaan", "wiras");
    await tunggu(300);
    expect(saranTeks(h, "pihak_pekerjaan")).toBe("");
  });
});

/* ─────────────────────────── D. pengingat merah ─────────────────────────── */

describe("D. aturan pengingat (murni) - satu sumber dengan bot", () => {
  it("bot menilai TIGA isian ini terisi atau tidak (SK Tabel 2 I.12); pengingat memakai tiga yang sama", () => {
    expect(SUMBER_BOT).toMatch(/SK Tabel 2 I\.12/);
    expect(SUMBER_BOT).toMatch(/jenis identitas, nomor identitas, dan nomor telepon/);
    const { pl, tutup } = PL();
    const kosong = pl.periksaIdentitas({ jenis: "", nomor: "", telp: "" });
    expect(kosong.map((m: any) => m.medan)).toEqual(["jenis", "nomor", "telp"]);
    expect(kosong.map((m: any) => m.pesan)).toEqual([
      "Jenis identitas belum dipilih.",
      "Nomor identitas belum diisi.",
      "Nomor telepon belum diisi.",
    ]);
    tutup();
  });

  it("bentuk: NIK KTP dan nomor KK 16 angka; paspor bebas bila wajar; telepon Indonesia", () => {
    const { pl, tutup } = PL();
    const pesan = (x: any) => pl.periksaIdentitas(x).map((m: any) => m.pesan);
    expect(pesan({ jenis: "4", nomor: "720301123456", telp: "081234567890" })).toEqual(["NIK KTP harus 16 angka (sekarang 12)."]);
    expect(pesan({ jenis: "4", nomor: "7203011234560001", telp: "081234567890" })).toEqual([]);
    expect(pesan({ jenis: "4", nomor: "7203 0112 3456 0001", telp: "+6281234567890" })).toEqual([]);
    expect(pesan({ jenis: "2", nomor: "7203011234560", telp: "08123456789" })).toEqual(["Nomor KK harus 16 angka (sekarang 13)."]);
    expect(pesan({ jenis: "5", nomor: "B1234567", telp: "6281234567890" })).toEqual([]);
    expect(pesan({ jenis: "5", nomor: "-", telp: "081234567890" })).toEqual(["Nomor identitas tampak tidak wajar."]);
    expect(pesan({ jenis: "4", nomor: "7203011234560001", telp: "123" })[0]).toMatch(/^Nomor telepon tampak tidak wajar/);
    expect(pesan({ jenis: "4", nomor: "7203011234560001", telp: "08123" })[0]).toMatch(/tidak wajar/);
    // medan yang tidak ada/tersembunyi tidak diperiksa
    expect(pl.periksaIdentitas({ jenisAda: false, nomorAda: false, telpAda: false, jenis: "", nomor: "", telp: "" })).toEqual([]);
    tutup();
  });
});

describe("D. pengingat merah di halaman", () => {
  const merah = (h: Halaman, id: string) => el(h, id).classList.contains("aleta-pl-merah");
  const pesanDi = (h: Halaman, id: string) => {
    const jangkar = el(h, id).closest("span.custom-dropdown") || el(h, id);
    const k = jangkar.nextElementSibling as HTMLElement | null;
    return k && k.classList.contains("aleta-pl-ingat") && !k.hidden ? k.textContent || "" : "";
  };

  it("kosong = merah dengan kalimat singkat; terisi benar = hilang; Simpan tidak ditahan", async () => {
    const h = bukaSipp();
    await sampai(() => merah(h, "pihak_no_tlp"), "pengingat tampil");
    expect(merah(h, "pihak_jenis_identitas")).toBe(true);
    expect(merah(h, "pihak_no_identitas")).toBe(true);
    expect(pesanDi(h, "pihak_jenis_identitas")).toBe("Jenis identitas belum dipilih.");
    expect(pesanDi(h, "pihak_no_identitas")).toBe("Nomor identitas belum diisi.");
    expect(pesanDi(h, "pihak_no_tlp")).toBe("Nomor telepon belum diisi.");

    const jenis = el<HTMLSelectElement>(h, "pihak_jenis_identitas");
    jenis.value = "4";
    jenis.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    isi(h, "pihak_no_identitas", "72030112345");
    isi(h, "pihak_no_tlp", "0812");
    await sampai(() => !merah(h, "pihak_jenis_identitas") && pesanDi(h, "pihak_no_identitas").startsWith("NIK KTP harus 16 angka"), "jenis benar, NIK salah");
    expect(pesanDi(h, "pihak_no_tlp")).toMatch(/tidak wajar/);

    isi(h, "pihak_no_identitas", "7203011234560001");
    isi(h, "pihak_no_tlp", "081234567890");
    await sampai(() => !merah(h, "pihak_no_identitas") && !merah(h, "pihak_no_tlp"), "semua benar");
    expect(pesanDi(h, "pihak_no_identitas")).toBe("");
    expect(pesanDi(h, "pihak_no_tlp")).toBe("");

    // tombol Simpan SIPP sendiri tidak ditahan ataupun ditekan oleh ekstensi
    isi(h, "pihak_no_tlp", "");
    await sampai(() => merah(h, "pihak_no_tlp"), "merah lagi");
    el<HTMLInputElement>(h, "simpan_btn").click();
    expect(h.simpan()).toBe(1);
    expect(h.simpanDicegah()).toBe(0);
  });

  it("medan yang disembunyikan SIPP (badan hukum) tidak diingatkan", async () => {
    const h = bukaSipp();
    el(h, "baris_identitas").style.display = "none";
    await tunggu(400);
    expect(merah(h, "pihak_jenis_identitas")).toBe(false);
    expect(pesanDi(h, "pihak_jenis_identitas")).toBe("");
    await sampai(() => merah(h, "pihak_no_tlp"), "telepon tetap diingatkan");
  });

  it("teks pengingat tidak memuat kata Aleta", async () => {
    const h = bukaSipp();
    await sampai(() => merah(h, "pihak_no_tlp"), "tampil");
    const semua = Array.from(h.doc.querySelectorAll(".aleta-pl-ingat")).map((k) => k.textContent).join(" ");
    expect(semua).not.toMatch(/aleta/i);
  });
});
