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

  it("tombol tema memasang penandanya DAHULU, menyimpan belakangan", () => {
    // Menunggu chrome.storage - panggilan lintas proses - membuat tekanan
    // tombol terasa tidak menghasilkan apa-apa, dan yang menekannya menekan
    // sekali lagi, yang justru mengembalikannya.
    for (const [nama, isi] of [["panel-alat", alat], ["konten", konten]] as const) {
      const letakTerap = isi.indexOf("alatTanpaTransisi(() => {");
      expect(letakTerap, `${nama} tidak membungkus pergantiannya`).toBeGreaterThan(0);
    }
    const klik = alat.slice(alat.indexOf('const tema = buat("aleta-tema"'));
    const badan = klik.slice(0, klik.indexOf("\n  });"));
    expect(badan.indexOf("alatTanpaTransisi(")).toBeLessThan(badan.indexOf("chrome.storage.local.set"));
  });
});

// ============================================================================
describe("tema dan palet ikut seketika di seluruh tab", () => {
  it("panel yang dipasang ikut terdaftar, dan pendengarnya dinyalakan sekali", () => {
    expect(alat).toContain("alatDaftarkanPanelTema(panel, pilihan);");
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
    for (const nama of ["alatSelaraskanTema", "alatSelaraskanWarna"]) {
      const badan = alat.slice(alat.indexOf(`function ${nama}(`));
      expect(badan.slice(0, badan.indexOf("\n}\n")), nama).toContain("if (!panel.isConnected) continue;");
    }
  });

  it("panel SIPP menyimpan keadaannya sendiri, jadi ia mendengar sendiri", () => {
    // konten.js memegang temaSekarang dan temaSippMenyala di memori; pendengar
    // umum di panel-alat tidak dapat memperbaruinya, dan keadaan yang basi
    // membuat tekanan berikutnya melompat ke arah yang salah.
    expect(konten).toContain("if (perubahan[KUNCI_TEMA] || perubahan[KUNCI_TEMA_SIPP]) {");
    expect(konten).toContain('temaSekarang = perubahan[KUNCI_TEMA].newValue === "terang" ? "terang" : "gelap";');
    expect(konten).toContain("temaSippMenyala = perubahan[KUNCI_TEMA_SIPP].newValue !== false;");
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
