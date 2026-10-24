// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { bolehPanduanKasir, golonganMenuEkstensi, type PenggunaGolongan } from "@/lib/matriks-peran";

/**
 * ============================================================================
 * PANDUAN LANGKAH KERJA KASIR BERSOROT DI HALAMAN SIPP (T5)
 * ============================================================================
 *
 * ekstensi-sipp/sipp-ide-l1.js + sipp-ide-m1.js + panduan-kasir.js dijalankan
 * SUNGGUHAN di jsdom atas replika halaman jurnal keuangan SIPP 7.0.4 (jendela
 * Tambah Biaya = replika add_biaya_form.php yang sama dengan uji M1). Diperiksa
 * yang TAMPAK: elemen yang disorot, urutannya, dan bahwa elemen yang disembunyikan
 * SIPP (.hide()) dilewati.
 *
 *   A. hak: kasir + Admin/Super Admin saja; sama dengan matriks-peran.ts
 *   B. jurnal per perkara: urutan sorotan, kartu, penutupan
 *   C. jendela Tambah Biaya: urutan, medan tersembunyi dilewati, buka/tutup jendela
 *   D. daftar jurnal
 *   E. tidak menulis ke SIPP; Tampilan Lama; halaman lain; pengamat halaman
 *   F. gaya: token, huruf, tanpa aturan tema gelap; berkas terdaftar
 */

const EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(EKSTENSI, n), "utf8").replace(/\r\n/g, "\n");
const L1 = baca("sipp-ide-l1.js");
const M1 = baca("sipp-ide-m1.js");
const PK = baca("panduan-kasir.js");
const NOMOR = "308/Pdt.G/2026/PA.Dgl";

type Jendela = any;
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 20));
  while (terbuka.length) terbuka.pop()!.window.close();
});
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const KASIR = { nama: "Kasir Contoh", peran: "Analis Keuangan", golonganMenu: ["kasir"] };

const BIAYA = (o: { jurusitaTersembunyi?: boolean } = {}) => `<table><tr><td>Nomor Perkara</td><td>${NOMOR}</td></tr></table>
<form id="frm_add_biaya" method="post" action="http://127.0.0.1:8056/detil_biaya/validateInput"><table>
<tr><td>Tanggal Transaksi</td><td><input id="tgl_transaksi" name="tgl_transaksi" value="16/10/2026" class="datepicker"></td></tr>
<tr><td>Pihak Ke</td><td><select name="fpihak_ke" id="fpihak_ke"><option value="">Pilih Pihak Pembayar</option><option value="1">Penggugat</option></select></td></tr>
<tr><td>Pihak yang membayar</td><td><select name="pihak_pembayar" id="pihak_pembayar"><option value="">Pilih Nama Pihak</option><option value="35048">SITI</option></select></td></tr>
<tr><td>Kategori Biaya</td><td><select name="kategori_biaya" id="kategori_biaya"><option value="">Pilih Kategori Biaya</option><option value="1">Panjar</option></select></td></tr>
<tr><td>Jenis Biaya</td><td><select name="jenis_biaya" id="jenis_biaya"><option value="">Pilih Jenis Biaya</option><option value="1">Panjar Biaya Perkara</option></select></td></tr>
<tr class="rowJurusita" id="baris_jurusita" ${o.jurusitaTersembunyi === false ? "" : 'style="display: none;"'}><td>Jurusita</td><td><select name="jurusita" id="jurusita"><option value=''>Pilih Jurusita</option><option value="7">Juru Sita Contoh</option></select></td></tr>
<tr><td>Uraian</td><td><textarea id="uraian" name="uraian"></textarea></td></tr>
<tr><td>Jumlah</td><td><input type="text" id="jumlah" name="jumlah" value=""></td></tr>
<tr><td><input type="hidden" id="idbiayaperkara" name="idbiayaperkara" value=""><input type="submit" id="simpan_btn" value="Simpan" class="btn"></td></tr></table></form>`;

const JURNAL = (o: { tambahTersembunyi?: boolean; usulan?: boolean } = {}) => `<div id="konten"><h3>BUKU JURNAL KEUANGAN PERKARA GUGATAN TINGKAT PERTAMA</h3><p>Nomor Perkara ${NOMOR}</p>
<a href="http://127.0.0.1:8056/detil_biaya/add_biaya/ENC" id="tbl_tambah" ${o.tambahTersembunyi ? 'style="display:none"' : ""}> Tambah  Biaya </a>
<table id="jurnal"><tr><th>Tanggal</th><th>Uraian</th><th>Pemasukan</th><th>Pengeluaran</th><th>Saldo</th></tr><tr><td>01/10/2026</td><td>Panjar</td><td>250000</td><td></td><td>250000</td></tr></table>
${o.usulan === false ? "" : '<div id="aleta-panel-sipp"><div data-a30-fitur="kasir">Usulan</div></div>'}</div>`;

const DAFTAR = `<div id="konten"><h3>JURNAL KEUANGAN PERKARA PERDATA GUGATAN/PERMOHONAN</h3>
<table><tr><th>No</th><th>Nomor Perkara</th></tr><tr><td>1</td><td>${NOMOR}</td></tr></table>
<div class="aleta-mps-massal" data-mps-massal="kasir-harian">Kasir harian</div></div>`;

function buka(isi: string, o: { jalur?: string; pengguna?: unknown; lama?: boolean; tanpaM1?: boolean } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${isi}</body></html>`, {
    url: `http://192.168.10.10/SIPP/${o.jalur ?? "detil_biaya/ENC"}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as Jendela;
  w.chrome = { storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, onChanged: { addListener() {} } } };
  w.fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) });
  const pengguna = o.pengguna === undefined ? KASIR : o.pengguna;
  w.muatPenggunaAleta = async () => pengguna;
  if (o.lama) w.alatUjiMode = () => "lama";
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(L1, ctx, { filename: "sipp-ide-l1.js" });
  if (!o.tanpaM1) vm.runInContext(M1, ctx, { filename: "sipp-ide-m1.js" });
  vm.runInContext(PK, ctx, { filename: "panduan-kasir.js" });
  return w;
}

const peluncur = (w: Jendela) => w.document.querySelector('[data-pk="peluncur"]');
const kartu = (w: Jendela) => w.document.querySelector('[data-pk="kartu"]');
const sorot = (w: Jendela) => Array.from(w.document.querySelectorAll(".aleta-pk-sorot")) as HTMLElement[];
const klik = (w: Jendela, k: string) => (w.document.querySelector(`[data-pk="${k}"]`) as HTMLElement).click();
const judul = (w: Jendela) => kartu(w).querySelector(".aleta-pk-judul").textContent;
const kepala = (w: Jendela) => kartu(w).querySelector(".aleta-pk-kepala").textContent;

/** Jalankan panduan dari awal sampai selesai; kembalikan id/nama elemen yang disorot tiap langkah. */
function telusuri(w: Jendela): string[] {
  const urut: string[] = [];
  expect(w.aletaPanduanKasir.mulai()).toBeGreaterThan(0);
  for (let i = 0; i < 40 && w.aletaPanduanKasir.keadaan().aktif; i++) {
    const s = sorot(w);
    expect(s.length).toBe(1);
    urut.push(w.aletaPanduanKasir.keadaan().langkah);
    klik(w, "berikut");
  }
  return urut;
}

// ============================================================================
describe("A. hak: kasir + Admin/Super Admin, sama dengan matriks-peran.ts", () => {
  const pengguna: Array<[string, PenggunaGolongan, boolean]> = [
    ["super admin", { roleId: "super-admin" }, true],
    ["admin", { roleId: "admin" }, true],
    ["analis keuangan (kasir)", { roleId: "analis-keuangan" }, true],
    ["bendahara", { roleId: "pelaksana", positionId: "pos-bendahara" }, true],
    ["pelaksana + peran tambahan kasir", { roleId: "pelaksana", additionalRoleIds: ["kasir"] }, true],
    ["hakim", { roleId: "hakim" }, false],
    ["ketua", { roleId: "ketua" }, false],
    ["panitera (boleh menu Kasir, bukan panduan kasir)", { roleId: "panitera" }, false],
    ["panitera pengganti", { roleId: "panitera-pengganti" }, false],
    ["jurusita", { roleId: "jurusita" }, false],
    ["PTSP", { roleId: "operator" }, false],
  ];
  for (const [nama, p, boleh] of pengguna) {
    it(`${nama}: ${boleh ? "boleh" : "tidak"} - ekstensi membaca golonganMenu yang dikirim portal`, () => {
      expect(bolehPanduanKasir(p)).toBe(boleh);
      const w = buka(JURNAL(), { pengguna: { nama: "X", peran: "?", golonganMenu: golonganMenuEkstensi(p) } });
      expect(w.aletaPanduanKasir.murni.bolehPanduan({ nama: "X", peran: "?", golonganMenu: golonganMenuEkstensi(p) })).toBe(boleh);
    });
  }

  it("portal lama tanpa golonganMenu: nama peran / peran tambahan", () => {
    const w = buka(JURNAL());
    const b = w.aletaPanduanKasir.murni.bolehPanduan;
    expect(b({ peran: "Super Admin" })).toBe(true);
    expect(b({ peran: "Admin" })).toBe(true);
    expect(b({ peran: "Analis Keuangan" })).toBe(true);
    expect(b({ peran: "Pelaksana", peranTambahan: ["kasir"] })).toBe(true);
    expect(b({ peran: "Hakim" })).toBe(false);
    expect(b({ peran: "Panitera" })).toBe(false);
    expect(b({ peran: "" })).toBe(false);
    expect(b(null)).toBe(false);
  });

  it("peran lain membuka halaman jurnal: tanpa peluncur, tanpa sorotan", async () => {
    const w = buka(JURNAL(), { pengguna: { nama: "Hj", peran: "Hakim", golonganMenu: ["hakim"] } });
    await tunggu(30);
    expect(peluncur(w)).toBeNull();
    expect(w.aletaPanduanKasir.mulai()).toBe(0);
    expect(sorot(w)).toHaveLength(0);
    expect(w.document.querySelector(".aleta-pk-kartu")).toBeNull();
  });

  it("akun ALETA tak terbaca: tanpa panduan", async () => {
    const w = buka(JURNAL(), { pengguna: null });
    await tunggu(30);
    expect(peluncur(w)).toBeNull();
  });
});

// ============================================================================
describe("B. jurnal per perkara (detil_biaya)", () => {
  it("peluncur muncul; langkah disorot satu per satu berurutan, lalu selesai tanpa sisa sorotan", async () => {
    const w = buka(JURNAL());
    await tunggu(30);
    expect(peluncur(w)).not.toBeNull();
    expect(peluncur(w).hidden).toBe(false);
    expect(kartu(w).hidden).toBe(true);
    peluncur(w).click();
    expect(kartu(w).hidden).toBe(false);
    expect(kepala(w)).toBe("Panduan kasir · langkah 1 dari 4");
    expect(judul(w)).toBe("Pastikan perkaranya");
    expect(sorot(w).map((e) => e.tagName)).toEqual(["H3"]);
    klik(w, "berikut");
    expect(judul(w)).toBe("Baca usulan Kasir ALETA");
    expect(sorot(w)[0].getAttribute("data-a30-fitur")).toBe("kasir");
    klik(w, "berikut");
    expect(judul(w)).toBe("Tekan Tambah Biaya");
    expect(sorot(w)[0].id).toBe("tbl_tambah");
    klik(w, "berikut");
    expect(judul(w)).toBe("Periksa baris jurnal");
    expect(sorot(w)[0].id).toBe("jurnal");
    expect(kartu(w).querySelector('[data-pk="berikut"]').textContent).toBe("Selesai");
    klik(w, "berikut");
    expect(w.aletaPanduanKasir.keadaan().aktif).toBe(false);
    expect(kartu(w).hidden).toBe(true);
    expect(sorot(w)).toHaveLength(0);
  });

  it("Sebelumnya kembali satu langkah; di langkah pertama dimatikan; Tutup melepas sorotan", async () => {
    const w = buka(JURNAL());
    await tunggu(30);
    w.aletaPanduanKasir.mulai();
    expect((kartu(w).querySelector('[data-pk="sebelum"]') as HTMLButtonElement).disabled).toBe(true);
    klik(w, "berikut");
    klik(w, "berikut");
    expect(judul(w)).toBe("Tekan Tambah Biaya");
    klik(w, "sebelum");
    expect(judul(w)).toBe("Baca usulan Kasir ALETA");
    expect(sorot(w)).toHaveLength(1);
    klik(w, "tutup");
    expect(sorot(w)).toHaveLength(0);
    expect(kartu(w).hidden).toBe(true);
  });

  it("tombol yang disembunyikan SIPP (.hide()) tidak disorot - langkahnya dilewati", async () => {
    const w = buka(JURNAL({ tambahTersembunyi: true }));
    await tunggu(30);
    expect(telusuri(w)).toEqual(["nomor", "usulan", "tabel"]);
  });

  it("tanpa tab Kasir ALETA (belum termuat): langkah SIPP saja", async () => {
    const w = buka(JURNAL({ usulan: false }));
    await tunggu(30);
    expect(telusuri(w)).toEqual(["nomor", "tambah", "tabel"]);
  });

  it("peluncur menutup panduan yang sedang berjalan", async () => {
    const w = buka(JURNAL());
    await tunggu(30);
    peluncur(w).click();
    expect(w.aletaPanduanKasir.keadaan().aktif).toBe(true);
    peluncur(w).click();
    expect(w.aletaPanduanKasir.keadaan().aktif).toBe(false);
    expect(sorot(w)).toHaveLength(0);
  });
});

// ============================================================================
describe("B2. tombol Kasir ALETA (T3) - disorot bila ada, dilewati bila tidak", () => {
  const tombolT3 = (w: Jendela, bagian: string) => {
    const wadah = w.document.createElement("div");
    wadah.id = "aleta-kj-wadah";
    wadah.className = "aleta-kj-baris aleta-sisip";
    wadah.innerHTML = '<button type="button" id="aleta-kj-tombol" class="btn btn-sm aleta-kj-tombol aleta-sisip">Kasir ALETA</button>';
    w.document.querySelector(bagian).insertAdjacentElement("afterend", wadah);
    return wadah;
  };

  it("jurnal per perkara: tombol ada -> langkah kedua, menyorot tombol itu", async () => {
    const w = buka(JURNAL());
    await tunggu(30);
    tombolT3(w, "h3");
    w.aletaPanduanKasir.segarkan();
    expect(telusuri(w)).toEqual(["nomor", "kasir-aleta", "usulan", "tambah", "tabel"]);
    w.aletaPanduanKasir.mulai();
    klik(w, "berikut");
    expect(judul(w)).toBe("Tombol Kasir ALETA");
    expect(sorot(w).map((e) => e.id)).toEqual(["aleta-kj-tombol"]);
    expect(kepala(w)).toBe("Panduan kasir · langkah 2 dari 5");
  });

  it("jurnal per perkara: tombol belum ada -> dilewati tanpa galat", async () => {
    const w = buka(JURNAL());
    await tunggu(30);
    expect(telusuri(w)).toEqual(["nomor", "usulan", "tambah", "tabel"]);
  });

  it("tombol disembunyikan -> dilewati", async () => {
    const w = buka(JURNAL());
    await tunggu(30);
    tombolT3(w, "h3").style.display = "none";
    expect(telusuri(w)).toEqual(["nomor", "usulan", "tambah", "tabel"]);
  });

  it("tombol muncul belakangan saat panduan berjalan: langkah ikut bertambah, sorotan tetap satu", async () => {
    const w = buka(JURNAL());
    await tunggu(30);
    w.aletaPanduanKasir.mulai();
    expect(kepala(w)).toContain("dari 4");
    tombolT3(w, "h3");
    await tunggu(300);
    expect(kepala(w)).toBe("Panduan kasir · langkah 1 dari 5");
    expect(sorot(w)).toHaveLength(1);
  });

  it("daftar jurnal: tombol ada -> di antara daftar dan Kasir harian; tidak ada -> dilewati", async () => {
    const w = buka(DAFTAR, { jalur: "jurnal_perkara_list/index" });
    await tunggu(30);
    tombolT3(w, "h3");
    expect(telusuri(w)).toEqual(["daftar", "kasir-aleta-daftar", "harian"]);
    const w2 = buka(DAFTAR, { jalur: "jurnal_perkara_list/index" });
    await tunggu(30);
    expect(telusuri(w2)).toEqual(["daftar", "harian"]);
  });

  it("jendela Tambah Biaya terbuka: tombol T3 tidak ikut dipandu", async () => {
    const w = buka(JURNAL());
    await tunggu(30);
    tombolT3(w, "h3");
    const wadah = w.document.createElement("div");
    wadah.innerHTML = BIAYA();
    w.document.body.appendChild(wadah);
    w.aletaSippIdeM1.pasang(w.document);
    w.aletaPanduanKasir.segarkan();
    expect(telusuri(w)).not.toContain("kasir-aleta");
  });
});

// ============================================================================
describe("C. jendela Tambah Biaya (frm_add_biaya)", () => {
  const sisip = (w: Jendela, isi: string) => {
    const wadah = w.document.createElement("div");
    wadah.id = "form_pop";
    wadah.innerHTML = isi;
    w.document.body.appendChild(wadah);
    return wadah;
  };

  it("jendela terbuka: hanya langkah jendela itu, urut isian SIPP; baris Jurusita tersembunyi dilewati", async () => {
    const w = buka(JURNAL());
    await tunggu(30);
    sisip(w, BIAYA());
    w.aletaSippIdeM1.pasang(w.document);
    w.aletaPanduanKasir.segarkan();
    expect(telusuri(w)).toEqual(["isi", "tanggal", "pihak", "pembayar", "kategori", "jenis", "jumlah", "simpan"]);
  });

  it("baris Jurusita yang ditampakkan SIPP ikut disorot, tepat sesudah Jenis biaya", async () => {
    const w = buka(JURNAL());
    await tunggu(30);
    sisip(w, BIAYA({ jurusitaTersembunyi: false }));
    w.aletaSippIdeM1.pasang(w.document);
    w.aletaPanduanKasir.segarkan();
    expect(telusuri(w)).toEqual(["isi", "tanggal", "pihak", "pembayar", "kategori", "jenis", "jurusita", "jumlah", "simpan"]);
  });

  it("langkah pertama menyorot tombol Isi dengan ALETA milik M1; langkah Simpan menyorot tombol Simpan SIPP", async () => {
    const w = buka(JURNAL());
    await tunggu(30);
    sisip(w, BIAYA());
    w.aletaSippIdeM1.pasang(w.document);
    w.aletaPanduanKasir.segarkan();
    w.aletaPanduanKasir.mulai();
    expect(sorot(w)[0].getAttribute("data-m1")).toBe("isi");
    for (let i = 0; i < 7; i++) klik(w, "berikut");
    expect(judul(w)).toBe("Simpan");
    expect(sorot(w)[0].id).toBe("simpan_btn");
  });

  it("tanpa M1 (pita tak terpasang): langkah Isi dilewati, sisanya tetap", async () => {
    const w = buka(JURNAL(), { tanpaM1: true });
    await tunggu(30);
    sisip(w, BIAYA());
    w.aletaPanduanKasir.segarkan();
    expect(telusuri(w)[0]).toBe("tanggal");
  });

  it("membuka jendela saat panduan berjalan memindahkannya ke langkah jendela; menutupnya kembali ke halaman", async () => {
    const w = buka(JURNAL());
    await tunggu(30);
    w.aletaPanduanKasir.mulai();
    klik(w, "berikut");
    klik(w, "berikut");
    expect(judul(w)).toBe("Tekan Tambah Biaya");
    const wadah = sisip(w, BIAYA());
    w.aletaSippIdeM1.pasang(w.document);
    w.aletaPanduanKasir.segarkan();
    expect(sorot(w)).toHaveLength(1);
    expect(kepala(w)).toBe("Panduan kasir · langkah 1 dari 8");
    expect(judul(w)).toBe("Isi dengan ALETA");
    wadah.remove();
    w.aletaPanduanKasir.segarkan();
    expect(kepala(w)).toBe("Panduan kasir · langkah 1 dari 4");
    expect(judul(w)).toBe("Pastikan perkaranya");
  });

  it("jendela di halaman lain (bukan jurnal) tetap dipandu; jendela yang disembunyikan SIPP tidak", async () => {
    const w = buka("<div id=konten></div>", { jalur: "detil_perkara_agama/ENC" });
    await tunggu(30);
    expect(peluncur(w)).toBeNull();
    const wadah = sisip(w, BIAYA());
    w.aletaSippIdeM1.pasang(w.document);
    w.aletaPanduanKasir.segarkan();
    expect(peluncur(w)).not.toBeNull();
    wadah.style.display = "none";
    w.aletaPanduanKasir.segarkan();
    expect(peluncur(w).hidden).toBe(true);
  });

  it("pengamat halaman: jendela yang dibuka belakangan (AJAX) tertangkap tanpa dipanggil", async () => {
    const w = buka(JURNAL());
    await tunggu(30);
    w.aletaPanduanKasir.mulai();
    expect(kepala(w)).toContain("dari 4");
    sisip(w, BIAYA());
    await tunggu(300);
    expect(kepala(w)).toBe("Panduan kasir · langkah 1 dari 7");
    expect(sorot(w)).toHaveLength(1);
  });
});

// ============================================================================
describe("D. daftar jurnal keuangan", () => {
  it("daftar perkara lalu Kasir harian ALETA", async () => {
    const w = buka(DAFTAR, { jalur: "jurnal_perkara_list/index" });
    await tunggu(30);
    expect(telusuri(w)).toEqual(["daftar", "harian"]);
  });
  it("juga di all_jurnal_perkara", async () => {
    const w = buka(DAFTAR, { jalur: "jurnal_all_perkara/all_jurnal_perkara" });
    await tunggu(30);
    expect(telusuri(w)).toEqual(["daftar", "harian"]);
  });
});

// ============================================================================
describe("E. tidak menulis ke SIPP", () => {
  it("isian jendela Tambah Biaya tidak berubah selama panduan; sorotan terlepas; tanpa tanda ALETA di nilai", async () => {
    const w = buka(JURNAL());
    await tunggu(30);
    const wadah = w.document.createElement("div");
    wadah.innerHTML = BIAYA();
    w.document.body.appendChild(wadah);
    w.aletaPanduanKasir.segarkan();
    const sebelum = w.document.getElementById("frm_add_biaya").outerHTML;
    const nilaiSebelum = Array.from(w.document.querySelectorAll("#frm_add_biaya input, #frm_add_biaya select, #frm_add_biaya textarea")).map((e: any) => e.value);
    let submit = 0;
    w.document.getElementById("frm_add_biaya").addEventListener("submit", () => submit++);
    telusuri(w);
    expect(w.document.getElementById("frm_add_biaya").outerHTML).toBe(sebelum);
    const nilaiSesudah = Array.from(w.document.querySelectorAll("#frm_add_biaya input, #frm_add_biaya select, #frm_add_biaya textarea")).map((e: any) => e.value);
    expect(nilaiSesudah).toEqual(nilaiSebelum);
    expect(nilaiSesudah.join("|")).not.toMatch(/aleta/i);
    expect(submit).toBe(0);
  });

  it("halaman jurnal: markup SIPP utuh sesudah panduan selesai (kecuali sisipan ALETA sendiri)", async () => {
    const w = buka(JURNAL());
    await tunggu(30);
    const salin = () => {
      const k = w.document.getElementById("konten").cloneNode(true) as HTMLElement;
      k.querySelectorAll(".aleta-sisip, #aleta-panel-sipp").forEach((e) => e.remove());
      return k.outerHTML;
    };
    const sebelum = salin();
    telusuri(w);
    expect(salin()).toBe(sebelum);
  });

  it("Tampilan Lama: tidak ada apa pun", async () => {
    const w = buka(JURNAL(), { lama: true });
    await tunggu(30);
    expect(peluncur(w)).toBeNull();
    expect(w.aletaPanduanKasir.mulai()).toBe(0);
  });

  it("halaman SIPP lain (detil perkara): tidak ada peluncur", async () => {
    const w = buka("<div id=konten><h3>DETIL PERKARA</h3></div>", { jalur: "detil_perkara_agama/ENC" });
    await tunggu(30);
    expect(peluncur(w)).toBeNull();
    expect(w.aletaPanduanKasir.mulai()).toBe(0);
  });

  it("jaringan tidak disentuh oleh panduan", async () => {
    const w = buka(JURNAL());
    let minta = 0;
    w.fetch = async () => {
      minta++;
      return { ok: true, status: 200, json: async () => ({}) };
    };
    await tunggu(30);
    telusuri(w);
    expect(minta).toBe(0);
  });
});

// ============================================================================
describe("F. gaya & pendaftaran berkas", () => {
  const gaya = () => {
    const m = /const GAYA = `([\s\S]*?)`;/.exec(PK);
    if (!m) throw new Error("GAYA tidak ditemukan");
    return m[1];
  };

  it("warna hanya dari token --s-* dengan cadangan di dalam var(); tanpa aturan tema gelap", () => {
    const css = gaya();
    expect(css).not.toMatch(/data-aleta-tema/);
    expect(css).not.toMatch(/prefers-color-scheme/);
    const tanpaVar = css.replace(/var\(--s-[a-z0-9-]+,\s*[^)]*\)/g, "");
    // Satu-satunya angka warna di luar var(): bayangan kartu (rgba hitam).
    expect(tanpaVar.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(tanpaVar.match(/rgba?\([^)]*\)/g) ?? []).toEqual(["rgba(0,0,0,.28)"]);
    expect(css.match(/var\(--s-[a-z0-9-]+,/g)!.length).toBeGreaterThanOrEqual(15);
    expect(css).not.toMatch(/var\(--aleta-/);
  });

  it("huruf tidak di bawah 11,5px", () => {
    const ukuran = [...gaya().matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    expect(ukuran.length).toBeGreaterThan(0);
    expect(Math.min(...ukuran)).toBeGreaterThanOrEqual(11.5);
  });

  it("kartu dan peluncur memakai gaya yang dipasang ke halaman", async () => {
    const w = buka(JURNAL());
    await tunggu(30);
    expect(w.document.getElementById("aleta-pk-gaya")).not.toBeNull();
    expect(w.document.querySelectorAll("#aleta-pk-gaya")).toHaveLength(1);
  });

  it("terdaftar di manifest (sesudah sipp-ide-m1.js) dan di susun-ekstensi.mjs", () => {
    const manifest = JSON.parse(baca("manifest.json"));
    const skrip: string[] = manifest.content_scripts.find((c: any) => c.js.includes("sipp-ide-m1.js")).js;
    expect(skrip.indexOf("panduan-kasir.js")).toBeGreaterThan(skrip.indexOf("sipp-ide-m1.js"));
    expect(readFileSync(path.resolve(__dirname, "../../scripts/susun-ekstensi.mjs"), "utf8")).toContain('"panduan-kasir.js"');
  });
});
