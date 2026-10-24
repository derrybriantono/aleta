// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * SIPP DENGAN IDE ALETA - GELOMBANG 1 (Tahap L1, 16 Okt 2026)
 * ============================================================================
 *
 * ekstensi-sipp/sipp-ide-l1.js dijalankan SUNGGUHAN di jsdom atas replika
 * halaman SIPP 7.0.4 (bentuknya dari K-PETA-SIPP.md dan view aslinya:
 * perkara_list.php, detil_perkara_agama.php, edit_putusan_akhir.php,
 * putusan_akhir.php, fileupload_v.php, fileupload_putusan_v.php).
 *
 *   A. J01/J02 di daftar perkara, daftar arsip, dan halaman perkara
 *   B. J01 di ABT: serah terima ke Blangko ABT by Derry Briantono
 *   C. I01 pita + penghitung kolom (wajib = tanda * merah SIPP, .hide() tidak dihitung)
 *   D. I02-I05 Putusan Akhir: berkas -> pemilih panel, usulan dicerminkan, Isikan + e-Doc
 *   E. Cek dobel e-Doc di jendela e-Doc SIPP
 *   F. Tampilan Lama tidak berubah; tidak ada permintaan jaringan; manifest & penyusun
 */

const EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(EKSTENSI, n), "utf8").replace(/\r\n/g, "\n");
const SUMBER = baca("sipp-ide-l1.js");

const ENC = "aWQ9MTAxMTcmbm9tb3I9NTY1X1BkdC5HXzIwMjY";
const NOMOR = "565/Pdt.G/2026/PA.Dgl";
const NOMOR2 = "12/Pdt.P/2026/PA.Dgl";

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 30));
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Jendela = any;

function buka(html: string, opsi: { url?: string; simpanan?: Record<string, unknown>; sebelum?: (w: Jendela) => void } = {}) {
  const dom = new JSDOM(html, {
    url: opsi.url || `http://127.0.0.1:8056/index.php/perkara_detil_agama/${ENC}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as Jendela;
  const simpanan: Record<string, unknown> = { ...(opsi.simpanan || {}) };
  w.__tulisan = [] as Array<Record<string, unknown>>;
  w.__ambil = 0;
  w.chrome = {
    runtime: { getManifest: () => ({ version: "1.201.0" }) },
    storage: {
      local: {
        get: async (k: string[] | string) => {
          const daftar = Array.isArray(k) ? k : [k];
          return Object.fromEntries(daftar.filter((x) => x in simpanan).map((x) => [x, simpanan[x]]));
        },
        set: async (isi: Record<string, unknown>) => {
          w.__tulisan.push(isi);
          Object.assign(simpanan, isi);
        },
        remove: async (k: string) => {
          delete simpanan[k];
        },
      },
      onChanged: { addListener() {} },
    },
  };
  w.__simpanan = simpanan;
  w.fetch = async () => {
    w.__ambil += 1;
    return { ok: true, status: 200, json: async () => ({}) };
  };
  if (opsi.sebelum) opsi.sebelum(w);
  const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(SUMBER, ctx, { filename: "sipp-ide-l1.js" });
  return w;
}

// ── Replika halaman ─────────────────────────────────────────────────────────
const DAFTAR = `<!doctype html><html><head></head><body>
<table id="tablePerkaraAll"><tbody>
<tr><td>No</td><td onclick="sorting(1)">Nomor Perkara</td><td>Tanggal Register</td><td>Klasifikasi Perkara</td><td>Para Pihak</td><td>Tahapan</td><td>Status Perkara</td><td>Lama Proses</td><td>Link</td></tr>
<tr><td>1</td><td>${NOMOR}</td><td align="center">01 Okt 2026</td><td>Cerai Gugat</td><td>Penggugat lawan Tergugat</td><td>Persidangan</td><td>Sidang Pertama</td><td>15 Hari</td><td align="center">[<a href="http://127.0.0.1:8056/index.php/perkara_detil_agama/${ENC}">detil</a>]</td></tr>
<tr><td>2</td><td>${NOMOR2}</td><td align="center">02 Okt 2026</td><td>Dispensasi Kawin</td><td>Pemohon</td><td>Persidangan</td><td>-</td><td>14 Hari</td><td align="center">[<a href="#">detil</a>]</td></tr>
</tbody></table>
<table id="tableArsipAll"><tbody>
<tr><td>No</td><td>Nomor Arsip</td><td>Nomor Perkara</td><td>Aksi</td></tr>
<tr><td>1</td><td>77/AR/2026/PA.Dgl</td><td>${NOMOR}</td><td></td></tr>
</tbody></table>
</body></html>`;

const DETIL = (nomor: string) => `<!doctype html><html><head></head><body>
<table width="100%" id="submenus"><tr><td><table><tr>
  <td id="backlist"><a class="btn btn-default btn-sm" href="/index.php/perkara"><i class="fa fa-reply-all"></i> Kembali</a></td>
  <td><a class="btn btn-default btn-sm" href="#" onClick="popup_form('x')">Penetapan Majelis Hakim</a></td>
</tr></table></td></tr></table>
<div id="tabs1"><table id="tableinfo"><tr><td id="first-child">Nomor Perkara</td><td>${nomor}</td></tr><tr><td id="first-child">Posita</td><td>Putusan 556/Pdt.G/2024/PA.Dgl telah berkekuatan hukum tetap</td></tr></table></div>
</body></html>`;

/** Jendela Putusan Akhir 7.0.4 (edit_putusan_akhir.php) + tab Putusan (putusan_akhir.php) + panel ALETA (bagianIsiPutusan). */
function halamanPutusan(o: { panel?: boolean; edoc?: boolean; aksi?: string; usulan?: boolean; sekaligus?: boolean; terapMati?: boolean } = {}) {
  const aksi = o.aksi || "http://127.0.0.1:8056/index.php/managePutusanAkhir/validateInput";
  const kartu = o.usulan
    ? `<div class="aleta-abt-kartu"><div class="aleta-abt-kartu-kepala"><input type="checkbox" class="aleta-abt-centang" checked><span class="aleta-abt-nama">Pertimbangan Hukum</span></div><textarea class="aleta-abt-isi aleta-sunting">Menimbang, bahwa maksud dan tujuan gugatan Penggugat adalah perceraian.</textarea></div>
<div class="aleta-abt-kartu"><div class="aleta-abt-kartu-kepala"><input type="checkbox" class="aleta-abt-centang" checked><span class="aleta-abt-nama">Status Putusan</span><span class="aleta-tanda aleta-tanda-hijau">disebut naskah</span></div><div class="aleta-abt-sanding"><div class="aleta-abt-kini"><span class="aleta-abt-label">sekarang</span><span class="aleta-abt-isi">(belum dipilih)</span></div><div class="aleta-abt-usul"><span class="aleta-abt-label">usulan</span><span class="aleta-abt-isi">Dikabulkan</span></div></div><div class="aleta-abt-kutipan"><span class="aleta-abt-asal">Putusan</span><span class="aleta-abt-kalimat">Mengabulkan gugatan Penggugat</span></div></div>
<div class="aleta-abt-kartu"><div class="aleta-abt-kartu-kepala"><input type="checkbox" class="aleta-abt-centang"><span class="aleta-abt-nama">Putusan Verstek</span><span class="aleta-tanda aleta-tanda-kuning">mendekati</span></div><div class="aleta-abt-sanding"><div class="aleta-abt-kini"><span class="aleta-abt-label">sekarang</span><span class="aleta-abt-isi">Tidak</span></div><div class="aleta-abt-usul"><span class="aleta-abt-label">usulan</span><span class="aleta-abt-isi">Ya</span></div></div></div>
<div class="aleta-abt-kartu"><div class="aleta-abt-kartu-kepala"><input type="checkbox" class="aleta-abt-centang" disabled><span class="aleta-abt-nama">Keadaan Istri</span><span class="aleta-tanda aleta-tanda-abu">tidak ditemukan</span></div><div class="aleta-abt-sanding"><div class="aleta-abt-kini"><span class="aleta-abt-label">sekarang</span><span class="aleta-abt-isi">(belum dipilih)</span></div></div></div>
<button class="aleta-permintaan-tombol" type="button" id="uji-terap"${o.terapMati ? " disabled" : ""}>Isikan yang dicentang</button><div class="aleta-abt-kabar"></div>`
    : "";
  const panel = o.panel
    ? `<div id="aleta-panel-sipp" class="aleta-panel"><div class="aleta-bagian" data-kunci="isiPutusan"><button class="aleta-bagian-judul" type="button">Putusan otomatis</button><div class="aleta-bagian-isi">
  <div class="aleta-tetap-sebab">Mengambil draf…</div>
  <button class="aleta-permintaan-tombol" type="button" id="uji-ambil">Ambil usulan dari ALETA</button>
  <div class="aleta-abt-kabar">Draf versi 3 (siap).</div>
  <div class="aleta-unggah-naskah"><div class="aleta-tetap-sebab aleta-remeh">Belum ada drafnya?</div><div class="aleta-tetap-kaki"><input type="file" accept=".rtf,.txt,.docx,.doc,.pdf" class="aleta-berkas" id="uji-pemilih"></div>
    <label class="aleta-a30-pilihan aleta-a30-sekaligus" style="display:${o.sekaligus ? "" : "none"}"><input type="checkbox" class="aleta-abt-centang" id="uji-sekaligus" checked><span>Sekali jalan: …</span></label>
    <div class="aleta-unggah-hasil"></div></div>
  <div class="aleta-isian-putusan">${kartu}</div>
</div></div></div>`
    : "";
  const tab = `<div id="tabs10"><table id="tableinfo">
<tr><td id="first-child">E-Doc Putusan Akhir</td><td colspan="2">${o.edoc ? "<a target='_new' href='http://127.0.0.1:8056/resources/file/doc/2026/10/PN1.pdf'>Unduh Dokumen</a>" : "<span style='color:red;font-weight:bold'>Dokumen Belum Ada</span>"}</td><td><a class="btn btn-warning btn-sm">Unggah E-Doc</a></td></tr>
<tr><td id="first-child">E-Doc Putusan Anonimisasi</td><td colspan="2"><span style='color:red;font-weight:bold'>Dokumen Belum Ada</span></td></tr>
</table></div>`;
  return `<!doctype html><html><head></head><body>${panel}${tab}
<div id="popup_form" class="popup"><div id="form_pop"><div class="centering"><div id="pihak_pilih"><div class="detil">
<form id="frm_putusan" method="post" action="${aksi}">
<table id="infoPerkara"><tbody>
<tr><td colspan="2">DATA PUTUSAN AKHIR</td></tr>
<tr><td id="first-child">Pertimbangan Hukum<font color="red">*</font></td><td id="perhum_text"><textarea id="perhum" name="perhum" style="visibility:hidden;display:none"></textarea><div id="cke_perhum" class="cke"><iframe></iframe></div></td></tr>
<tr><td id="first-child">Tanggal Putusan<font color="red">*</font></td><td><input id="tgl_putusan" name="tgl_putusan" value="16/10/2026" class="datepicker"></td></tr>
<tr><td id="first-child">Status Putusan<font color="red">*</font></td><td><span class="custom-dropdown"><select name="status_putusan" id="status_putusan"><option value="-1">Pilih Status Putusan</option><option value="62">Dikabulkan</option><option value="67">Dicabut</option></select></span></td></tr>
<tr id="verstek_tr" style="display: none;"><td id="first-child">Putusan Verstek<font color="red">*</font></td><td><select name="verstek" id="verstek"><option value="T">Tidak</option><option value="Y">Ya</option></select></td></tr>
<tr id="sumber_hukum_tr"><td id="first-child">Sumber Hukum<font color="red">*</font></td><td><input type="checkbox" name="sumber_hukum[]" value="1"> UU 1/1974 <input type="checkbox" name="sumber_hukum[]" value="2"> KHI</td></tr>
<tr id="popup_nusyuz_tr"><td id="first-child">Status Nusyuz</td><td><input type="radio" name="status_nusyuz" value="1"> Nusyuz <input type="radio" name="status_nusyuz" value="0" checked> Tidak Nusyuz</td></tr>
<tr><td id="first-child">Amar Putusan<font color="red">*</font></td><td><select id="template_amar"><option value="">Pilih amar</option></select><textarea id="amar" name="amar" style="display:none"></textarea><div id="cke_amar"><iframe></iframe></div></td></tr>
<tr><td id="first-child">Keterangan</td><td><textarea class="standard-input" id="keterangan" name="keterangan"></textarea>
<input type="hidden" id="enc" name="enc" value="${ENC}"><input type="hidden" id="act" name="act" value="x"></td></tr>
<tr><td colspan="2" align="center"><input type="button" id="close_form_putusan" value="Kembali" class="btn"><input type="submit" id="simpan" value="Simpan" class="btn"><input type="hidden" id="close_form_refresh" value=""></td></tr>
</tbody></table></form></div></div></div></div></div>
</body></html>`;
}

function isiCke(w: Jendela, id: string, teks: string) {
  const f = w.document.querySelector(`#cke_${id} iframe`);
  f.contentDocument.body.textContent = teks;
}

// ============================================================================
// A. J01/J02 - tombol di tiap perkara
// ============================================================================
describe("A. Buka di ABT / Buka di ALETA di tiap perkara", () => {
  it("daftar perkara dan daftar arsip: dua tautan di sel Nomor Perkara, alamatnya tepat, tidak berlipat", () => {
    const w = buka(DAFTAR, { url: "http://127.0.0.1:8056/index.php/perkara_list/x" });
    const api = w.aletaSippIdeL1;
    const r1 = api.pasang(w.document);
    expect(r1.tautan).toBe(3);
    api.pasang(w.document);
    const sel = w.document.querySelectorAll("#tablePerkaraAll tr")[1].children[1];
    expect(sel.querySelectorAll(".aleta-l1-tautan").length).toBe(1);
    const abt = sel.querySelector('[data-l1="abt"]');
    const aleta = sel.querySelector('[data-l1="aleta"]');
    expect(abt.getAttribute("href")).toBe(`http://127.0.0.1:8056/aps_badilag/abt/main/beranda#aleta-bd=${encodeURIComponent(NOMOR)}`);
    expect(aleta.getAttribute("href")).toBe(`http://127.0.0.1:8056/aleta/aleta-ecourt?perkara=${encodeURIComponent(NOMOR)}`);
    expect(abt.target).toBe("_blank");
    // Teks sel SIPP (dibaca konten.js) tetap memuat nomornya saja; sisipan berkelas aleta-sisip.
    expect(sel.querySelector(".aleta-l1-tautan").classList.contains("aleta-sisip")).toBe(true);
    expect(sel.querySelector(".aleta-l1-tautan").textContent).not.toMatch(/\d+\/Pdt/);
    // Arsip: kolom "Nomor Perkara", BUKAN "Nomor Arsip" yang berpola mirip.
    const arsip = w.document.querySelectorAll("#tableArsipAll tr")[1].children;
    expect(arsip[1].querySelector(".aleta-l1-tautan")).toBeNull();
    expect(arsip[2].querySelector('[data-l1="abt"]').getAttribute("href")).toContain(encodeURIComponent(NOMOR));
  });

  it("halaman perkara: dua tombol bergaya SIPP di akhir baris #submenus, nomor dari baris Nomor Perkara (bukan perkara lain di posita)", () => {
    const w = buka(DETIL(NOMOR));
    w.aletaSippIdeL1.pasang(w.document);
    const td = w.document.querySelector("#submenus .aleta-l1-submenu");
    expect(td.tagName).toBe("TD");
    expect(td.previousElementSibling.textContent).toContain("Penetapan Majelis Hakim");
    const tombol = Array.from(td.querySelectorAll("a")) as any[];
    expect(tombol.map((a) => a.textContent)).toEqual(["Buka di ABT", "Buka di ALETA"]);
    expect(tombol.every((a) => a.classList.contains("btn") && a.classList.contains("btn-sm"))).toBe(true);
    expect(tombol[0].getAttribute("href")).toContain(encodeURIComponent(NOMOR));
    expect(tombol[0].getAttribute("href")).not.toContain("556");
  });

  it("nomor belum terbaca: tombol redup; sesudah tab Data Umum termuat alamatnya terisi", () => {
    const w = buka(DETIL("").replace(/<div id="tabs1">[\s\S]*?<\/div>/, '<div id="tabs1"></div>'));
    const api = w.aletaSippIdeL1;
    api.pasang(w.document);
    const abt = w.document.querySelector('.aleta-l1-submenu [data-l1="abt"]');
    expect(abt.getAttribute("aria-disabled")).toBe("true");
    expect(abt.hasAttribute("href")).toBe(false);
    w.document.querySelector("#tabs1").innerHTML = `<table><tr><td id="first-child">Nomor Perkara</td><td>${NOMOR}</td></tr></table>`;
    api.pasang(w.document);
    expect(w.document.querySelectorAll(".aleta-l1-submenu").length).toBe(1);
    expect(abt.getAttribute("href")).toContain(encodeURIComponent(NOMOR));
    expect(abt.hasAttribute("aria-disabled")).toBe(false);
  });

  it("klik Buka di ABT menyimpan serah terima (nomor + waktu) untuk ABT; tidak ada permintaan jaringan", async () => {
    const w = buka(DETIL(NOMOR));
    w.aletaSippIdeL1.pasang(w.document);
    const abt = w.document.querySelector('.aleta-l1-submenu [data-l1="abt"]');
    abt.addEventListener("click", (e: Event) => e.preventDefault()); // jsdom tidak membuka tab
    abt.click();
    await new Promise((r) => setTimeout(r, 5));
    const serah = w.__simpanan[w.aletaSippIdeL1.KUNCI_SERAH];
    expect(serah.nomor).toBe(NOMOR);
    expect(Date.now() - serah.saat).toBeLessThan(5000);
    expect(w.__ambil).toBe(0);
  });
});

// ============================================================================
// B. J01 di ABT
// ============================================================================
const ABT = (derry: boolean) => `<!doctype html><html><head></head><body>
<div id="navbar">${derry ? '<button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel"></div>' : ""}<button class="accordion">Putusan Cerai Gugat</button><div class="panel"></div></div>
<div id="aleta-bd-akar"><button type="button" data-mode="semua">Semua perkara saya</button></div>
</body></html>`;

function derryTiruan(w: Jendela, daftarHari: string[], daftarSemua: string[], siapa = true) {
  const S: any = { aktif: false, pk: null, mode: "hari", panggil: [] as string[] };
  w.aletaBlangkoDerry = {
    keadaan: () => ({ aktif: S.aktif, pk: S.pk, mode: S.mode }),
    siapa: () => (siapa ? { nama: "Hakim" } : null),
    buka: () => {
      S.panggil.push("buka");
      S.aktif = true;
    },
    pilihPerkara: (n: string) => {
      const daftar = S.mode === "semua" ? daftarSemua : daftarHari;
      if (daftar.includes(n)) S.pk = n;
    },
    toast: (t: string) => S.panggil.push(`toast:${t}`),
  };
  w.document.querySelector('[data-mode="semua"]').addEventListener("click", () => {
    S.mode = "semua";
  });
  return S;
}

function jamTiruan() {
  let t = 0;
  return { sekarang: () => t, tunggu: async (ms: number) => void (t += ms) };
}

describe("B. ABT menerima nomor dari SIPP", () => {
  it("hash serah terima dibaca hanya bila bentuknya nomor perkara", () => {
    const w = buka(ABT(true), { url: "http://127.0.0.1:8056/aps_badilag/abt/main/beranda" });
    const { bacaSerahDariHash } = w.aletaSippIdeL1.murni;
    expect(bacaSerahDariHash(`#aleta-bd=${encodeURIComponent(NOMOR)}`)).toBe(NOMOR);
    expect(bacaSerahDariHash("#aleta-bd=%3Cscript%3E")).toBe("");
    expect(bacaSerahDariHash("#lain")).toBe("");
  });

  it("Blangko Derry dibuka lalu perkaranya dipilih; bila tidak ada di 'hari ini', pindah ke Semua perkara saya", async () => {
    const w = buka(ABT(true), { url: "http://127.0.0.1:8056/aps_badilag/abt/main/beranda" });
    const S = derryTiruan(w, [], [NOMOR]);
    const jam = jamTiruan();
    const h = await w.aletaSippIdeL1.serahkanKeDerry(NOMOR, { ...jam, batasMs: 20000 });
    expect(h).toEqual({ ok: true });
    expect(S.panggil[0]).toBe("buka");
    expect(S.mode).toBe("semua");
    expect(S.pk).toBe(NOMOR);
  });

  it("akun ABT tanpa grup Blangko Derry: berhenti dengan sebab tanpa-derry; perkara yang memang tidak ada: tidak-di-daftar", async () => {
    const w = buka(ABT(false), { url: "http://127.0.0.1:8056/aps_badilag/abt/main/beranda" });
    derryTiruan(w, [], []);
    expect(await w.aletaSippIdeL1.serahkanKeDerry(NOMOR, { ...jamTiruan(), batasMs: 20000 })).toEqual({ ok: false, sebab: "tanpa-derry" });
    const w2 = buka(ABT(true), { url: "http://127.0.0.1:8056/aps_badilag/abt/main/beranda" });
    derryTiruan(w2, [], []);
    expect(await w2.aletaSippIdeL1.serahkanKeDerry(NOMOR, { ...jamTiruan(), batasMs: 8000 })).toEqual({ ok: false, sebab: "tidak-di-daftar" });
  });

  it("dimuat di ABT dengan hash: nomor diserahkan, hash dibersihkan, simpanan dihapus", async () => {
    const w = buka(ABT(true), {
      url: `http://127.0.0.1:8056/aps_badilag/abt/main/beranda#aleta-bd=${encodeURIComponent(NOMOR)}`,
      simpanan: { sippIdeL1SerahAbt: { nomor: NOMOR, saat: Date.now() } },
      sebelum: (jw) => derryTiruan(jw, [NOMOR], [NOMOR]),
    });
    for (let i = 0; i < 40 && !w.aletaBlangkoDerry.keadaan().pk; i += 1) await new Promise((r) => setTimeout(r, 50));
    expect(w.aletaBlangkoDerry.keadaan().pk).toBe(NOMOR);
    expect(w.location.hash).toBe("");
    expect(w.__simpanan.sippIdeL1SerahAbt).toBeUndefined();
  });
});

// ============================================================================
// C. I01 - pita & penghitung
// ============================================================================
describe("C. Pita Isi dengan ALETA dan penghitung kolom", () => {
  it("jendela Putusan Akhir dikenali dari ALAMAT simpannya - Pemberitahuan/Minutasi (id form sama) tidak", () => {
    const w = buka(halamanPutusan({ panel: true }));
    const { kenaliJendela } = w.aletaSippIdeL1.murni;
    const f = w.document.querySelector("#frm_putusan");
    expect(kenaliJendela(f).kode).toBe("putusan-akhir");
    f.setAttribute("action", "http://127.0.0.1:8056/index.php/managePutusanAkhir/validateInputPemberitahuan");
    expect(kenaliJendela(f)).toBeNull();
    f.setAttribute("action", "http://127.0.0.1:8056/index.php/managePutusanAkhir/validateInputMinutasi");
    expect(kenaliJendela(f)).toBeNull();
  });

  it("tanpa usulan ALETA (panel tidak memuat Putusan otomatis): pita tidak tampil", () => {
    const w = buka(halamanPutusan({ panel: false }));
    w.aletaSippIdeL1.pasang(w.document);
    const pita = w.document.querySelector(".aleta-l1-pita");
    expect(pita).toBeTruthy();
    expect(pita.hidden).toBe(true);
  });

  it("menghitung kolom tampak: verstek yang di-.hide() tidak ikut, CKEditor dibaca dari bingkainya, wajib dari tanda * merah", () => {
    const w = buka(halamanPutusan({ panel: true }));
    const { hitungKolom, kalimatHitung } = w.aletaSippIdeL1.murni;
    const f = w.document.querySelector("#frm_putusan");
    let h = hitungKolom(f);
    // perhum, tgl, status, sumber_hukum[], nusyuz, amar, keterangan = 7 (verstek tersembunyi; select#template_amar tanpa name bukan kolom)
    expect(h.jumlah).toBe(7);
    expect(h.wajib).toBe(5);
    expect(h.wajibTerisi).toBe(1); // tanggal
    expect(h.kosong.map((k: any) => k.label)).toEqual(expect.arrayContaining(["Pertimbangan Hukum", "Status Putusan", "Sumber Hukum", "Amar Putusan", "Keterangan"]));
    expect(h.kosong.map((k: any) => k.label)).not.toContain("Putusan Verstek");
    isiCke(w, "perhum", "Menimbang, bahwa …");
    f.querySelector('[name="status_putusan"]').value = "62";
    f.querySelectorAll('[name="sumber_hukum[]"]')[1].checked = true;
    h = hitungKolom(f);
    expect(h.wajibTerisi).toBe(4);
    expect(kalimatHitung(h)).toBe("wajib terisi 4 dari 5 · 5 dari 7 kolom terisi");
  });

  it("pita di atas form, chip kolom kosong SEBELUM #simpan bertipe button tanpa name (tidak ikut terkirim)", () => {
    const w = buka(halamanPutusan({ panel: true }));
    w.aletaSippIdeL1.pasang(w.document);
    const f = w.document.querySelector("#frm_putusan");
    const pita = f.previousElementSibling;
    expect(pita.classList.contains("aleta-l1-pita")).toBe(true);
    expect(pita.hidden).toBe(false);
    expect(pita.querySelector('[data-l1="hitung"]').textContent).toBe("wajib terisi 1 dari 5 · 2 dari 7 kolom terisi");
    const chip = f.querySelector('[data-l1="chip"]');
    expect(chip.nextElementSibling.id).toBe("simpan");
    expect(chip.type).toBe("button");
    expect(chip.hasAttribute("name")).toBe(false);
    expect(chip.textContent).toBe("4 kolom wajib kosong");
    // semua tombol sisipan di dalam/sekitar form bertipe button
    for (const b of Array.from(w.document.querySelectorAll(".aleta-l1 button")) as any[]) expect(b.type).toBe("button");
    // tidak ada name pada isian sisipan -> serializeArray SIPP tidak berubah
    expect(Array.from(f.querySelectorAll(".aleta-l1 [name]")).length).toBe(0);
  });

  it("Isi dengan ALETA menekan tombol baca-saja 'Ambil usulan dari ALETA' panel; Loncat ke yang kosong menyorot wajib dulu", () => {
    const w = buka(halamanPutusan({ panel: true }));
    w.aletaSippIdeL1.pasang(w.document);
    let ditekan = 0;
    w.document.querySelector("#uji-ambil").addEventListener("click", () => (ditekan += 1));
    w.document.querySelector('.aleta-l1-pita [data-l1="isi"]').click();
    expect(ditekan).toBe(1);
    w.document.querySelector('.aleta-l1-pita [data-l1="kosong"]').click();
    const kabar = w.document.querySelector('.aleta-l1-pita [data-l1="kabar"]').textContent;
    expect(kabar).toMatch(/^Masih kosong: Pertimbangan Hukum \(wajib\)/);
    expect(kabar.indexOf("Keterangan")).toBeGreaterThan(kabar.indexOf("Amar Putusan (wajib)"));
    expect(w.document.querySelector("#status_putusan").classList.contains("aleta-l1-sorot")).toBe(true);
  });

  it("jendela PMH: pita hanya membuka bagian Penetapan di panel (tidak menekan Tetapkan)", () => {
    const html = `<!doctype html><html><body><div id="aleta-panel-sipp"><div class="aleta-bagian" data-kunci="penunjukan"><button class="aleta-bagian-judul" type="button">Penetapan</button><div class="aleta-bagian-isi" style="display:none"><button type="button" class="aleta-tombol-tetapkan" id="tetapkan">Tetapkan</button></div></div></div>
<div id="form_pop"><form id="frm_majelis" action="http://127.0.0.1:8056/index.php/addMajelis_c/f_validate_input_add"><table><tr><td id="first-child">Tanggal Penetapan<font color="red">*</font></td><td><input name="tgl_penetapan_majelis" value=""></td></tr><tr><td><input type="submit" id="simpan" value="Simpan"></td></tr></table></form></div></body></html>`;
    const w = buka(html);
    w.aletaSippIdeL1.pasang(w.document);
    let tetapkan = 0;
    w.document.querySelector("#tetapkan").addEventListener("click", () => (tetapkan += 1));
    const pita = w.document.querySelector('.aleta-l1-pita[data-l1-jendela="pmh"]');
    expect(pita.hidden).toBe(false);
    pita.querySelector('[data-l1="isi"]').click();
    expect(tetapkan).toBe(0);
    expect(pita.querySelector('[data-l1="kabar"]').textContent).toMatch(/panel kanan/);
  });
});

// ============================================================================
// D. I02-I05 - Putusan Akhir dari berkas
// ============================================================================
function pasangDataTransfer(w: Jendela) {
  // jsdom belum punya DataTransfer; tiruan yang setara untuk satu berkas.
  w.DataTransfer = class {
    _f: unknown[] = [];
    items = { add: (f: unknown) => this._f.push(f) };
    get files() {
      return this._f;
    }
  };
}

describe("D. Putusan Akhir: unggah berkas -> usulan semua kolom -> Isikan + Simpan + e-Doc", () => {
  it("berkas PDF diteruskan ke pemilih naskah Putusan otomatis (jalur baca/konversi/anonim yang sama), bentuk lain ditolak", () => {
    const w = buka(halamanPutusan({ panel: true }), { sebelum: pasangDataTransfer });
    const api = w.aletaSippIdeL1;
    api.pasang(w.document);
    const pemilih = w.document.querySelector("#uji-pemilih");
    let diterima: any = null;
    let berkasDisetel: any = null;
    Object.defineProperty(pemilih, "files", { configurable: true, get: () => berkasDisetel, set: (v) => (berkasDisetel = v) });
    pemilih.addEventListener("change", () => (diterima = pemilih.files && pemilih.files[0]));
    const f = new w.File(["%PDF-1.4"], "putusan 565.pdf", { type: "application/pdf" });
    const pita = w.document.querySelector(".aleta-l1-pita");
    expect(api.teruskanNaskah(pita.__p || w.document.querySelector("#frm_putusan").__aletaL1, f)).toEqual({ ok: true });
    expect(diterima && diterima.name).toBe("putusan 565.pdf");
    expect(pita.querySelector('[data-l1="kabar"]').textContent).toContain("Membaca putusan 565.pdf");
    const salah = new w.File(["x"], "catatan.txt", { type: "text/plain" });
    expect(api.teruskanNaskah(w.document.querySelector("#frm_putusan").__aletaL1, salah)).toEqual({ ok: false, sebab: "bentuk" });
    expect(w.__ambil).toBe(0);
  });

  it("usulan panel dicerminkan di jendela: keyakinan, sekarang -> usulan, selisih, kutipan; centang dua arah", () => {
    const w = buka(halamanPutusan({ panel: true, usulan: true }));
    const api = w.aletaSippIdeL1;
    api.pasang(w.document);
    api.segarkanSemua();
    const baris = Array.from(w.document.querySelectorAll(".aleta-l1-usulan tr")).slice(1) as any[];
    expect(baris.map((tr) => tr.children[1].textContent)).toEqual(["Pertimbangan Hukum", "Status Putusan", "Putusan Verstek", "Keadaan Istri"]);
    expect(baris[0].children[4].textContent).toMatch(/aksara/);
    expect(baris[1].children[2].textContent).toBe("disebut naskah");
    expect(baris[1].children[4].textContent).toContain("Dikabulkan");
    expect(baris[1].children[4].textContent).toContain("Mengabulkan gugatan Penggugat");
    expect(baris[2].children[4].textContent).toContain("berbeda dari isi SIPP sekarang");
    expect(baris[3].querySelector("input").disabled).toBe(true);
    // centang jendela -> panel
    const cVerstek = baris[2].querySelector("input");
    expect(cVerstek.checked).toBe(false);
    cVerstek.checked = true;
    cVerstek.dispatchEvent(new w.Event("change"));
    const kartuPanel = w.document.querySelectorAll(".aleta-isian-putusan > .aleta-abt-kartu")[2].querySelector("input");
    expect(kartuPanel.checked).toBe(true);
    // panel -> jendela
    w.document.querySelectorAll(".aleta-isian-putusan > .aleta-abt-kartu")[1].querySelector("input").checked = false;
    api.segarkanSemua();
    expect(baris[1].querySelector("input").checked).toBe(false);
    const terap = w.document.querySelector('.aleta-l1-pita [data-l1="terap"]');
    expect(terap.disabled).toBe(false);
  });

  it("Isikan, lalu Simpan menekan tombol Isikan panel; tombol ditahan panel = tidak ditekan", () => {
    const w = buka(halamanPutusan({ panel: true, usulan: true }));
    const api = w.aletaSippIdeL1;
    api.pasang(w.document);
    api.segarkanSemua();
    let ditekan = 0;
    w.document.querySelector("#uji-terap").addEventListener("click", () => (ditekan += 1));
    w.document.querySelector('.aleta-l1-pita [data-l1="terap"]').click();
    expect(ditekan).toBe(1);
    const w2 = buka(halamanPutusan({ panel: true, usulan: true, terapMati: true }));
    w2.aletaSippIdeL1.pasang(w2.document);
    expect(w2.aletaSippIdeL1.terapPutusan(w2.document.querySelector("#frm_putusan").__aletaL1)).toEqual({ ok: false, sebab: "ditahan" });
  });

  it("e-Doc putusan SUDAH ada + unggah e-Doc dicentang: ditanya dulu; Batal = tidak ditekan, OK = ditekan", () => {
    const w = buka(halamanPutusan({ panel: true, usulan: true, edoc: true, sekaligus: true }));
    const api = w.aletaSippIdeL1;
    api.pasang(w.document);
    api.segarkanSemua();
    expect(w.document.querySelector('.aleta-l1-pita [data-l1="edoc"]').textContent).toBe("e-Doc di tab Putusan: putusan sudah ada, anonimisasi belum ada.");
    expect(w.document.querySelector('.aleta-l1-pita [data-l1="sekaligus"]').closest("label").hidden).toBe(false);
    let ditekan = 0;
    w.document.querySelector("#uji-terap").addEventListener("click", () => (ditekan += 1));
    const tanya: string[] = [];
    w.confirm = (t: string) => (tanya.push(t), false);
    const p = w.document.querySelector("#frm_putusan").__aletaL1;
    expect(api.terapPutusan(p)).toEqual({ ok: false, sebab: "edoc-sudah-ada" });
    expect(ditekan).toBe(0);
    expect(tanya[0]).toMatch(/e-Doc putusan perkara ini SUDAH ada/);
    w.confirm = () => true;
    expect(api.terapPutusan(p)).toEqual({ ok: true });
    expect(ditekan).toBe(1);
    // Tanpa unggah e-Doc: tidak ditanya.
    w.document.querySelector("#uji-sekaligus").checked = false;
    w.confirm = () => {
      throw new Error("tidak boleh ditanya");
    };
    expect(api.terapPutusan(p)).toEqual({ ok: true });
  });

  it("bacaEdocTabPutusan: tab Putusan belum termuat = tidak terbaca (bukan 'belum ada')", () => {
    const w = buka(halamanPutusan({ panel: true }).replace(/<div id="tabs10">[\s\S]*?<\/table><\/div>/, ""));
    expect(w.aletaSippIdeL1.murni.bacaEdocTabPutusan(w.document)).toEqual({ putusan: "", anonimisasi: "" });
  });
});

// ============================================================================
// E. Cek dobel e-Doc (jendela e-Doc SIPP)
// ============================================================================
const EDOC = (tersimpan: string, from = "dokpmh") => `<!doctype html><html><body><div id="form_pop"><div class="templatepopcentering"><div id="pop"><div class="detil">
<form id="frm_upload_file" method="post" enctype="multipart/form-data" action="http://127.0.0.1:8056/index.php/fileupload_c/dummy">
<table id="tableDetilPerkara">
<tr><td colspan="2">Kelola Dokumen Elektronik (E-Doc)</td></tr>
<tr><td id="first-child" colspan="2">File Tersimpan</td></tr>
<tr><td colspan="2">${tersimpan ? `<span style='color:#708090;font-weight:bold'>${tersimpan}</span>` : "<span style='color:red;font-weight:bold'>Dokumen Belum Ada</span>"}</td></tr>
<tr><td id="first-child" colspan="2">Unggah E-Doc Baru</td></tr>
<tr><td colspan="2"><input type="file" name="fileform" id="fileform" accept=".pdf,application/pdf"></td></tr>
<tr><td colspan="2"><input type="hidden" name="enc" value="${ENC}"><input type="hidden" name="enc1" value=""><input type="hidden" name="from" id="from" value="${from}"><input type="hidden" name="urutan" value="">
<input type="button" id="kembali" value="Kembali">${tersimpan ? '<input type="button" id="hapus" value="Hapus">' : ""}<input type="submit" id="simpan" value="Simpan"></td></tr>
</table></form></div></div></div></div></body></html>`;

function pilihBerkas(w: Jendela, nama: string) {
  const i = w.document.querySelector("#fileform");
  const f = new w.File(["%PDF"], nama, { type: "application/pdf" });
  Object.defineProperty(i, "files", { configurable: true, get: () => [f] });
  i.dispatchEvent(new w.Event("change", { bubbles: true }));
  return f;
}

describe("E. Cek dobel e-Doc PMH/PPP/PJS/PHS/putusan", () => {
  it("membaca File Tersimpan pada kedua bentuk jendela e-Doc SIPP", () => {
    const w = buka(EDOC("PN_PMH_565.pdf"));
    const { bacaEdocJendela } = w.aletaSippIdeL1.murni;
    expect(bacaEdocJendela(w.document.querySelector("#frm_upload_file"))).toMatchObject({ kode: "dokpmh", jenis: "PMH (Penetapan Majelis Hakim)", tersimpan: "PN_PMH_565.pdf", terbaca: true });
    // fileupload_putusan_v.php: label dan isi bersebelahan; "E-Doc Putusan Belum Ada"
    const w2 = buka(`<!doctype html><html><body><form id="frm_upload_file" action="x/fileupload_c/dummy"><table><tr><td id="first-child">File Tersimpan</td><td><span style='color:red;font-weight:bold'>E-Doc Putusan Belum Ada</span></td></tr><tr><td><input type="file" id="fileform" name="fileform"><input type="hidden" name="form" value="putusan"><input type="submit" id="simpan"></td></tr></table></form></body></html>`);
    expect(w2.aletaSippIdeL1.murni.bacaEdocJendela(w2.document.querySelector("#frm_upload_file"))).toMatchObject({ kode: "putusan", jenis: "putusan", tersimpan: "", terbaca: true });
  });

  it("berkas lama ada: pemberitahuan di atas jendela; nama sama = kemungkinan dobel; Simpan ditanya dan Batal menghentikan SubmitHandling SIPP", () => {
    const w = buka(EDOC("PN_PMH_565.pdf"));
    const api = w.aletaSippIdeL1;
    expect(api.pasang(w.document).edoc).toBe(1);
    const f = w.document.querySelector("#frm_upload_file");
    const kotak = f.previousElementSibling;
    expect(kotak.textContent).toContain("e-Doc PMH (Penetapan Majelis Hakim) perkara ini sudah ada di SIPP: PN_PMH_565.pdf");
    pilihBerkas(w, "PN_PMH_565.pdf");
    expect(kotak.querySelector('[data-l1="kabar"]').textContent).toMatch(/kemungkinan berkas yang sama \(dobel\)/);
    // SubmitHandling SIPP dipasang jQuery pada form (fase gelembung) - penjaga ALETA di dokumen fase tangkap.
    w.document.addEventListener("submit", api.saatKirim, true);
    let sippJalan = 0;
    f.addEventListener("submit", (e: Event) => {
      sippJalan += 1;
      e.preventDefault();
    });
    const tanya: string[] = [];
    w.confirm = (t: string) => (tanya.push(t), false);
    const ev1 = new w.Event("submit", { bubbles: true, cancelable: true });
    f.dispatchEvent(ev1);
    expect(tanya.length).toBe(1);
    expect(tanya[0]).toMatch(/MENGGANTI berkas yang lama/);
    expect(sippJalan).toBe(0);
    expect(ev1.defaultPrevented).toBe(true);
    w.confirm = (t: string) => (tanya.push(t), true);
    f.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    expect(sippJalan).toBe(1);
    // berkas yang sama sudah disetujui: tidak ditanya dua kali
    f.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    expect(tanya.length).toBe(2);
    expect(sippJalan).toBe(2);
  });

  it("belum ada berkas lama: tidak ada pemberitahuan dan Simpan tidak ditanya", () => {
    const w = buka(EDOC(""));
    const api = w.aletaSippIdeL1;
    expect(api.pasang(w.document).edoc).toBe(0);
    pilihBerkas(w, "baru.pdf");
    w.confirm = () => {
      throw new Error("tidak boleh ditanya");
    };
    const ev = new w.Event("submit", { bubbles: true, cancelable: true });
    w.document.addEventListener("submit", api.saatKirim, true);
    w.document.querySelector("#frm_upload_file").dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(w.document.querySelector("#frm_upload_file input[type='file']")).toBe(w.document.querySelector("input[type='file']"));
  });
});

// ============================================================================
// F. Tampilan Lama, jaringan, manifest
// ============================================================================
describe("F. Tampilan Lama tetap persis, tanpa jaringan, manifest & penyusun", () => {
  it("tampilan Lama: tidak ada yang dipasang, yang sudah ada dibersihkan", () => {
    let mode = "ui";
    const w = buka(DAFTAR, { sebelum: (jw) => (jw.alatUjiMode = () => mode) });
    // alatUjiMode milik panel-alat.js hidup di lingkup bersama skrip konten - di uji dipasang di window.
    const api = w.aletaSippIdeL1;
    expect(api.pasang(w.document).tautan).toBe(3);
    mode = "lama";
    expect(api.pasang(w.document)).toEqual({ tautan: 0, detil: false, pita: 0, edoc: 0 });
    expect(w.document.querySelectorAll(".aleta-l1").length).toBe(0);
  });

  it("seluruh alur tidak mengirim permintaan jaringan apa pun", () => {
    const w = buka(halamanPutusan({ panel: true, usulan: true, edoc: true, sekaligus: true }));
    const api = w.aletaSippIdeL1;
    api.pasang(w.document);
    api.segarkanSemua();
    w.confirm = () => true;
    w.document.querySelector('.aleta-l1-pita [data-l1="isi"]').click();
    w.document.querySelector('.aleta-l1-pita [data-l1="terap"]').click();
    expect(w.__ambil).toBe(0);
    expect(SUMBER).not.toMatch(/\bfetch\(|XMLHttpRequest|alatAmbil\(/);
  });

  it("manifest: paling belakang di SIPP dan di ABT, tidak di portal; penyusun menanamnya; versi tidak dinaikkan di sini", () => {
    const m = JSON.parse(baca("manifest.json")) as { version: string; content_scripts: Array<{ js?: string[]; matches: string[] }> };
    const sipp = m.content_scripts.find((x) => (x.js || []).includes("konten.js"))!.js!;
    const abt = m.content_scripts.find((x) => (x.js || []).includes("abt.js"))!.js!;
    const portal = m.content_scripts.find((x) => (x.js || []).includes("aleta.js"))!.js!;
    // Gelombang 2 (sipp-ide-m1.js, ...) dimuat SESUDAH L1 - ia memakai penghitung kolom L1.
    const sesudahL1 = sipp.slice(sipp.indexOf("sipp-ide-l1.js") + 1);
    // 19 Okt: penetapan-borang.js (isi otomatis formulir penetapan SIPP) dimuat paling akhir; tidak memakai penghitung kolom L1.
    // 20 Okt: penetapan-sipp.js (tombol/panel Penetapan Otomatis) juga paling akhir; begitu pula (agen B2)
    // abt-klien.js, putusan-edoc-sekaligus.js, dan putusan-sipp.js (tombol/panel Putusan Otomatis);
    // 21 Okt (agen B3): putusan-terjadwal-pasangan.js, putusan-terjadwal.js, putusan-terjadwal-peramban.js (Jadwalkan Putusan).
    // 21 Okt malam: mediasi-arsip.js (Unggah hasil mediasi, tab Mediasi) juga paling akhir.
    expect(sesudahL1.filter((x) => x !== "penetapan-borang.js" && x !== "penetapan-kerja.js" && x !== "penetapan-sipp.js" && x !== "muat-ulang-sipp.js" && x !== "popup-aksi.js" && !["abt-klien.js", "putusan-edoc-sekaligus.js", "putusan-sipp.js", "pratinjau-bas-relaas.js", "mediasi-arsip.js", "putusan-terjadwal-pasangan.js", "putusan-terjadwal.js", "putusan-terjadwal-peramban.js", "menu-atas.js", "ecourt-masuk.js", "aleta-ai-gelembung.js"].includes(x)).every((x) => /^sipp-ide-[a-z0-9]+\.js$/.test(x))).toBe(true);
    expect(sipp.indexOf("sipp-ide-l1.js")).toBeGreaterThan(sipp.indexOf("konten.js"));
    // 19 Okt: abt-gulir.js (gaya gulir menu kiri ABT) boleh sesudahnya - tidak memakai penghitung kolom L1.
    // 23 Okt: aleta-ai-gelembung.js (gelembung chat ALETA Ai) boleh sesudahnya - tidak memakai penghitung kolom L1.
    expect(abt.filter((x) => x !== "abt-gulir.js" && x !== "menu-atas.js" && x !== "aleta-ai-gelembung.js").at(-1)).toBe("sipp-ide-l1.js");
    expect(abt.indexOf("sipp-ide-l1.js")).toBeGreaterThan(abt.indexOf("blangko-derry.js"));
    expect(portal).not.toContain("sipp-ide-l1.js");
    const susun = readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8");
    expect(susun).toContain('"sipp-ide-l1.js",');
  });
});
