/**
 * Ekstensi 1.130.0 - tema yang benar-benar berganti dan tidak tersendat, dan
 * tulisan dasbor yang tidak terbaca.
 *
 * ============================================================================
 * KENAPA ANGKA KONTRAS DITULIS DI SINI
 * ============================================================================
 *
 * Ketiga cacat warna di rilis ini ditemukan dengan MENGUKUR pada replika
 * dasbor - markup dasbor SIPP disalin ke halaman statis, CSS aslinya beserta
 * panel.css dipasang di atasnya, lalu warna terhitung tiap elemen dibaca.
 * Hasilnya mengoreksi dua dugaan sekaligus:
 *
 *   .text-black di daftar RASIO BEBAN PERKARA   1,15 : 1  - tidak terbaca
 *   <font color="red"> angka dasbor             1,12 : 1  - tidak terbaca
 *   <font color="blue"> angka dasbor            1,92 : 1  - tidak terbaca
 *   judul kotak (dikira rusak juga)            11,79 : 1  - ternyata sehat
 *
 * Judul kotaknya tampak sama suramnya di tangkapan layar, dan memang tidak
 * perlu disentuh. Itulah sebabnya angka-angka ini ditulis: yang berikut
 * menyunting berkas ini berhak tahu mana yang diukur dan mana yang ditaksir.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const gaya = readFileSync(path.join(AKAR, "panel.css"), "utf8");
const alat = readFileSync(path.join(AKAR, "panel-alat.js"), "utf8");
const konten = readFileSync(path.join(AKAR, "konten.js"), "utf8");

const tanpaCatatan = gaya.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

function aturan(pemilih: string): string {
  const semua: string[] = [];
  for (const m of tanpaCatatan.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].trim().replace(/\s+/g, " ") === pemilih) semua.push(m[2]);
  }
  if (semua.length === 0) throw new Error(`aturan tidak ditemukan: ${pemilih}`);
  return semua.join("\n");
}

const SIPP = 'html:not([data-aleta-halaman="abt"])[data-aleta-tema-sipp="gelap"]';

// ============================================================================
describe("tema berganti tanpa tersendat", () => {
  it("seluruh transisi dimatikan selama pergantian, lalu dikembalikan", () => {
    // Yang lambat bukan penghitungan gayanya - beberapa milidetik - melainkan
    // ratusan transisi warna yang menyala serentak.
    const badan = alat.slice(alat.indexOf("function alatTanpaTransisi("));
    const fungsi = badan.slice(0, badan.indexOf("\n}\n"));
    expect(fungsi).toContain('akar.classList.add("aleta-ganti-tema")');
    expect(fungsi).toContain('akar.classList.remove("aleta-ganti-tema")');
    // Dua bingkai: satu untuk menghitung gaya baru, satu untuk memastikan
    // sudah tercat sebelum transisi dihidupkan lagi.
    expect(fungsi).toContain("requestAnimationFrame(() => requestAnimationFrame(lepas))");
    // Dikembalikan lewat finally - kalau kerjanya melempar, kelasnya tidak
    // boleh tertinggal dan mematikan animasi halaman selamanya.
    expect(fungsi).toContain("} finally {");
  });

  it("kelasnya mematikan transisi dan animasi, bukan menyembunyikan apa pun", () => {
    const b = aturan(
      "html.aleta-ganti-tema, html.aleta-ganti-tema *, html.aleta-ganti-tema *::before, html.aleta-ganti-tema *::after"
    );
    expect(b).toContain("transition: none !important;");
    expect(b).toContain("animation-duration: 0.001s !important;");
    expect(b).not.toContain("display");
    expect(b).not.toContain("visibility");
  });

  it("tombol tema memasang penandanya DAHULU (sinkron, lewat pusat), menyimpan belakangan", () => {
    // Menunggu chrome.storage - panggilan lintas proses - membuat tekanan
    // tombol terasa tidak menghasilkan apa-apa, dan yang menekannya menekan
    // sekali lagi, yang justru mengembalikannya. Pusat memasang penanda dan
    // menulis salinan localStorage SINKRON di dalam terima(), lalu baru
    // menulis chrome.storage.
    for (const [nama, isi] of [["panel-alat", alat], ["konten", konten]] as const) {
      expect(isi, `${nama} tidak lagi menulis penyimpanan dari klik`).toContain("pusat.pilih(");
    }
    const pusat = readFileSync(path.join(AKAR, "tema-pusat.js"), "utf8");
    const pilih = pusat.slice(pusat.indexOf("function pilih(pilihan)"));
    const badan = pilih.slice(0, pilih.indexOf("\n  }\n"));
    expect(badan.indexOf('terima(p, waktu, "pengguna")')).toBeGreaterThan(0);
    expect(badan.indexOf('terima(p, waktu, "pengguna")')).toBeLessThan(badan.indexOf("tulisKeChrome()"));
    // Dan pergantiannya dibungkus tanpa-transisi di pusat.
    expect(pusat).toContain("if (tampilBerubah) tanpaTransisi(tandai);");
  });
});

// ============================================================================
describe("tema dan palet ikut seketika di seluruh tab", () => {
  it("panel yang dipasang ikut terdaftar beserta KUNCINYA, dan pendengarnya dinyalakan sekali", () => {
    // Kuncinya ikut sejak 1.136.0: tanpa itu alatSelaraskanWarna tidak dapat
    // tahu panel mana yang sudah dilepas dari popup, dan pelepasan yang tidak
    // dikenali berarti warna panel itu tetap ditimpa - persis yang hendak
    // dihindari pelepasannya.
    expect(alat).toContain("alatDaftarkanPanelTema(panel, pilihan, kunci);");
    expect(alat).toContain("alatDengarkanTemaPalet();");
    const badan = alat.slice(alat.indexOf("function alatDengarkanTemaPalet("));
    expect(badan.slice(0, 400)).toContain('const tanda = "__aletaDengarTema";');
    expect(badan.slice(0, 400)).toContain("if (globalThis[tanda]) return;");
  });

  it("palet yang berubah ikut menandai titik aktif dan salinan sinkronnya", () => {
    const badan = alat.slice(alat.indexOf("function alatSelaraskanWarna("));
    const fungsi = badan.slice(0, badan.indexOf("\n}\n"));
    expect(fungsi).toContain("alatTerapkanWarna(panel, nama, false);");
    expect(fungsi).toContain("pemilih.aletaTandai(nama");
    // Tanpa salinan sinkronnya, halaman berikutnya di tab ini lahir dengan
    // warna lama lalu berkelebat.
    expect(fungsi).toContain("window.localStorage.setItem(KUNCI_SALINAN_WARNA");
  });

  it("panel yang sudah dilepas dari halaman dilewati, bukan disentuh", () => {
    // Dua bentuk, satu maksud. alatSelaraskanTema menyaring di dalam loop;
    // alatSelaraskanWarna menyaringnya lebih dulu sebab ia juga harus
    // membuang panel yang warnanya dilepas dari popup. Yang dijaga di sini
    // maksudnya - panel yang sudah tidak ada di halaman tidak disentuh -
    // bukan bentuk penyaringannya.
    const tema = alat.slice(alat.indexOf("function alatSelaraskanTema("));
    expect(tema.slice(0, tema.indexOf("\n}\n"))).toContain("if (!panel.isConnected) continue;");

    const warna = alat.slice(alat.indexOf("function alatSelaraskanWarna("));
    expect(warna.slice(0, warna.indexOf("\n}\n"))).toContain("x.panel.isConnected");
  });

  it("panel yang DILEPAS dari popup tidak ikut berubah warnanya", () => {
    // Itulah arti dilepas. Tanpa penyaringan ini, tombol lepas hanya berlaku
    // sampai seseorang mengganti warna di popup - dan kegagalan seperti itu
    // tidak berbunyi, ia hanya membuat tombolnya tampak tidak berfungsi.
    const warna = alat.slice(alat.indexOf("function alatSelaraskanWarna("));
    const fungsi = warna.slice(0, warna.indexOf("\n}\n"));
    expect(fungsi).toContain("const mandiri = await alatPetaMandiri();");
    expect(fungsi).toContain("!(x.kunci && mandiri[x.kunci] === true)");
  });

  it("SIPP ikut warna dari popup - dulu hanya temanya yang ikut", () => {
    // Panel ABT dan halaman ALETA mendapatkannya lewat alatPasangPanel; panel
    // SIPP dibangun sendiri di konten.js dan tidak pernah memanggilnya, jadi
    // warna palet berhenti di ABT. Yang terbaca dari situ bukan "belum
    // tersambung" melainkan "popupnya tidak berlaku untuk SIPP".
    expect(konten).toContain("if (perubahan[KUNCI_WARNA_GELAP]) {");
    expect(konten).toContain("void alatSelaraskanWarna(nama);");
    // Didaftarkan dengan kuncinya, supaya pelepasan panel SIPP juga dikenali.
    expect(konten).toContain("alatDaftarkanPanelTema(panel, { temaHalaman: false }, KUNCI_POSISI);");
  });

  it("panel SIPP menyimpan keadaannya sendiri, jadi ia mendengar sendiri - lewat pusat", () => {
    // konten.js memegang temaSekarang dan temaSippMenyala di memori; pendengar
    // umum di panel-alat tidak dapat memperbaruinya, dan keadaan yang basi
    // membuat tekanan berikutnya melompat ke arah yang salah. Sumber kabarnya
    // kini pusat tema (sudah menguraikan "ikuti sistem" dan memilih yang lebih
    // baru), bukan pembacaan mentah temaPanel.
    expect(konten).toContain("function ikutiPusatTemaSipp(kabar)");
    expect(konten).toContain('temaSekarang = kabar.resolusi === "terang" ? "terang" : "gelap";');
    expect(konten).toContain("temaSippMenyala = kabar.lapisan !== false;");
    expect(konten).toContain("globalThis.AletaTemaPusat.dengar(ikutiPusatTemaSipp)");
  });
});

// ============================================================================
describe("panel tidak memaksa hitung ulang tata letak tiap gerakan kursor", () => {
  it("letak tepi dibaca paling banyak sekali per bingkai gambar", () => {
    // getBoundingClientRect MEMAKSA tata letak dihitung saat itu juga. Di
    // dalam pointermove ia berjalan puluhan kali per detik, dan di atas
    // halaman SIPP yang tabelnya ribuan sel itu cukup membuat seluruh
    // halaman terasa berat - termasuk yang tidak ada hubungannya dengan panel.
    const badan = alat.slice(alat.indexOf("function alatPasangGulir("));
    const fungsi = badan.slice(0, badan.indexOf("\n}\n"));
    const gerak = fungsi.slice(fungsi.indexOf('panel.addEventListener("pointermove"'));
    const sampaiTutup = gerak.slice(0, gerak.indexOf("\n  });"));
    expect(sampaiTutup).toContain("if (bingkai) return;");
    expect(sampaiTutup).toContain("bingkai = requestAnimationFrame(");
    // Pembacaan tata letaknya berada DI DALAM bingkai, bukan di badan
    // pendengarnya.
    expect(sampaiTutup.indexOf("requestAnimationFrame(")).toBeLessThan(
      sampaiTutup.indexOf("panel.getBoundingClientRect()")
    );
  });
});

// ============================================================================
describe("tulisan dasbor yang tidak terbaca - diukur, bukan ditaksir", () => {
  it(".text-black tidak lagi hitam di atas latar hampir hitam (1,15 : 1)", () => {
    expect(aturan(`${SIPP} :is(.text-black, .text-white)`)).toContain("color: var(--s-tulisan) !important;");
  });

  it("angka dasbor: merah tetap merah, biru tetap biru - artinya tidak diratakan", () => {
    // Merah dan biru MEMBEDAKAN kolom: sisa bulan lalu dan perkara masuk.
    // Meratakan keduanya menjadi satu warna memperbaiki kontras dengan cara
    // membuang keterangan.
    const merah = aturan(`${SIPP} :is(.konten, .h_right, .box-footer) :is(font[color="red"], font[color="#ff0000"])`);
    const biru = aturan(`${SIPP} :is(.konten, .h_right, .box-footer) :is(font[color="blue"], font[color="#0000ff"])`);
    expect(merah).toContain("#ffa79c");
    expect(biru).toContain("#93c9f2");
    expect(merah).not.toBe(biru);
  });

  it("sapaan di bilah atas diberi alas paling gelap, bukan diratakan warnanya", () => {
    // Warna di sapaan membedakan golongan pengguna. Alas gelap membuat
    // ketiganya punya tempat berpijak yang sama di palet mana pun.
    expect(aturan(`${SIPP} .h_right table.badge`)).toContain("background-color: var(--s-mati) !important;");
  });

  it("wadahnya disebut satu per satu, bukan pemilih borong", () => {
    // Alasannya sama seperti aturan font[color] yang sudah ada: pemilih borong
    // menyisir seluruh halaman untuk tiap elemen, dan halaman daftar perkara
    // berisi lima puluh baris.
    for (const warna of ["red", "blue"]) {
      const pemilih = `${SIPP} :is(.konten, .h_right, .box-footer) :is(font[color="${warna}"], font[color="#${warna === "red" ? "ff0000" : "0000ff"}"])`;
      expect(() => aturan(pemilih), warna).not.toThrow();
    }
    expect(gaya).not.toContain('[data-aleta-tema-sipp="gelap"] font[color]');
  });
});
