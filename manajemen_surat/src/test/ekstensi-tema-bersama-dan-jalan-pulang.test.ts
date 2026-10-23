/**
 * ============================================================================
 * LIMA PERBAIKAN EKSTENSI 1.155.0 - DIJAGA MAKSUDNYA, BUKAN BENTUK TULISANNYA
 * ============================================================================
 *
 * Kelimanya satu keluarga: panel yang tidak dapat disingkirkan, dan panel yang
 * sudah disingkirkan lalu tidak dapat dipanggil kembali.
 *
 *   2. tingkap sembul SIPP putih di tengah halaman gelap
 *   3. Escape dan klik ganda tidak menciutkan panel di SIPP maupun ABT
 *   4. panel yang ditutup atau terciut tidak dapat dibuka lagi
 *   5. tema popup, tema widget, dan tema portal tidak saling mengenal
 *   6. tanggal yang dipilih dari kalender tidak tampak di daftar hari sidang
 *
 * Butir 1 - pengisian Data Umum - sengaja TIDAK di sini: borangnya baru ada
 * di dokumen sesudah tombol Data Umum ditekan, dan itu pekerjaan tersendiri.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (n: string) => readFileSync(path.join(AKAR, n), "utf8");

const alat = baca("panel-alat.js");
const konten = baca("konten.js");
const abt = baca("abt.js");
const aleta = baca("aleta.js");
const popupJs = baca("popup.js");
const popupHtml = baca("popup.html");
const gaya = baca("panel.css");

describe("2 - putih yang tersisa di tingkap sembul SIPP: daftar select2", () => {
  it("select2 disebut - sebelumnya nol kemunculan di seluruh berkas gaya", () => {
    // Diukur pada replika markup edit_data_umum.php dengan panel.css yang
    // TERPASANG: badan tingkapnya sudah gelap (blok "gelombang ketiga" yang
    // menyasar [style*="background:white"] mengerjakannya), tetapi kotak dan
    // daftar select2 masih rgb(255,255,255) - dan kotak carinya putih di atas
    // putih. select2 menyatakan putihnya lewat KELAS, bukan gaya sebaris,
    // sehingga gelombang ketiga tidak menjangkaunya.
    expect(gaya).toContain(".select2-dropdown");
    expect(gaya).toContain(".select2-search__field");
    expect(gaya).toContain(".select2-results__option");
  });

  it("halaman ABT dikecualikan dengan tegas - tiap aturannya, bukan sebagiannya", () => {
    // Keduanya berbagi satu penanda tema; peta warna SIPP tidak boleh
    // menyentuh satu pun elemen ABT. Diperiksa per ATURAN, bukan per baris:
    // pemilih yang panjang ditulis berbilah-bilah, dan baris yang menyebut
    // select2 belum tentu baris yang membawa pagarnya.
    const tanpaKomentar = gaya.replace(/\/\*[\s\S]*?\*\//g, "");
    const aturan = tanpaKomentar.split("}");
    const menyebut = aturan.filter((a) => a.includes(".select2-"));
    expect(menyebut.length).toBeGreaterThan(0);
    for (const a of menyebut) {
      const pemilih = a.slice(0, a.indexOf("{")).trim();
      expect(pemilih, pemilih).toContain(':not([data-aleta-halaman="abt"])');
    }
  });

  it("baris yang disorot tetap dapat dibedakan", () => {
    // Bentuk pertamanya menyebut satu kelas saja, dan kalah bobot oleh aturan
    // .select2-results__option di atasnya: sorot dan baris biasa keduanya
    // terukur rgb(23,33,28). Daftar yang tidak menunjukkan baris mana yang
    // sedang disorot membuat tombol panah tidak dapat dipakai sama sekali.
    expect(gaya).toContain(".select2-results__option.select2-results__option--highlighted");
  });

  it("tidak mengulang aturan yang sudah ada", () => {
    // Aturan permukaan untuk badan tingkapnya sengaja TIDAK ditambahkan -
    // gelombang ketiga sudah mengerjakannya, dan pada berkas sepanjang ini
    // aturan yang mengulang adalah aturan yang kelak berselisih.
    expect(gaya).not.toContain("#popup_form, #popup_form_2nd, #popup_form_3rd, #popup_form_4th, #popup-detil) :is(");
  });
});

describe("3 - dua jalan keluar, di ketiga halaman", () => {
  it("panel SIPP akhirnya memasangnya", () => {
    // alatPasangJalanKeluar hanya dipanggil dari alatPasangPanel - satu-
    // satunya pintu yang TIDAK dilewati panel SIPP, yang menyusun kepala dan
    // geser-ubah-ukurannya sendiri.
    expect(konten).toContain("alatPasangJalanKeluar(panel, KUNCI_POSISI, {");
    expect(konten).toContain("ciutkan: () => ciutkanKeLencana(panel, true),");
  });

  it("isian milik HALAMAN tidak lagi membungkam Escape", () => {
    const fungsi = alat.slice(alat.indexOf("const sedangMenyunting = "));
    expect(fungsi.slice(0, 600)).toContain("if (!panel.contains(fokus)) return false;");
  });

  it("tingkap halaman yang terbuka tetap memegang Escape-nya sendiri", () => {
    expect(alat).toContain("function alatTingkapHalamanTerbuka(");
    expect(alat).toContain("if (alatTingkapHalamanTerbuka()) return;");
  });
});

describe("4 - jalan pulang untuk panel yang sudah disingkirkan", () => {
  it("× di ABT dan di portal berarti mematikan saklarnya, seperti di SIPP", () => {
    expect(abt).toContain("function tutupPanelAbt()");
    expect(abt).toContain("saatTutup: () => tutupPanelAbt(),");
    expect(aleta).toContain("function tutupPanel()");
    expect(aleta).toContain("saatTutup: () => tutupPanel(),");
    for (const isi of [abt, aleta]) {
      expect(isi).toContain("chrome.storage.local.set({ aktif: false })");
    }
  });

  it("ketiganya mendengarkan saklar itu - kalau tidak, mencentangnya tidak berbuat apa-apa", () => {
    // Panel SIPP sudah sejak lama; ABT dan portal baru sekarang. Tanpa
    // pendengarnya, saklar yang dinyalakan kembali hanya berlaku pada halaman
    // yang dibuka SESUDAHNYA - dan halaman yang sedang dikerjakan orang tetap
    // kosong sampai ia menekan F5.
    for (const [nama, isi] of [
      ["abt.js", abt],
      ["aleta.js", aleta],
      ["konten.js", konten],
    ] as const) {
      expect(isi, nama).toContain("chrome.storage.onChanged.addListener(");
    }
    expect(abt).toContain("!ubah.aktif) return;");
    expect(aleta).toContain("!ubah.aktif) return;");
    expect(abt).toContain("void pasang();");
    expect(abt).toContain("void pasangMassalAbt();");
    expect(aleta).toContain("void pasangPortal();");
    expect(konten).toContain("if (perubahan.aktif) {");
  });

  it("penanda pemasangan ABT dipadamkan saat panelnya dibuang", () => {
    // pasang() keluar pada baris pertamanya selama sudahDipasang masih
    // menyala. Tanpa memadamkannya, tombol segarkan di kaki panel MENGHAPUS
    // panel selamanya - ia membuang panelnya lalu memanggil pasang() yang
    // langsung keluar.
    const fungsi = abt.slice(abt.indexOf("function buangPanelAbt()"));
    const badan = fungsi.slice(0, fungsi.indexOf("\n}\n"));
    expect(badan).toContain("sudahDipasang = false;");
    expect(badan).toContain("sudahDipasangMassalAbt = false;");
    expect(abt).toContain("buangPanelAbt();\n    void pasang();");
  });

  it("Alt+A di ABT menyimpan keadaannya ke kunci POSISI, bukan ke id panel", () => {
    // Menciut lewat Alt+A dahulu menulis ke kunci "aleta-panel-abt" - tempat
    // yang tidak pernah dibaca siapa pun - sehingga lencananya tidak pernah
    // pulih dan tombol "Kembalikan posisi panel" tidak menjangkaunya.
    expect(abt).toContain("jalankan: (p) => alatCiutkan(p, KUNCI_POSISI_ABT)");
    expect(abt).not.toContain("alatCiutkan(p, PENANDA_ABT)");
  });

  it("panel ABT dan portal mengembalikan diri saat kunci letaknya dihapus", () => {
    // Panel SIPP sudah punya pendengarnya sendiri di konten.js; kedua panel
    // ini selama ini tidak punya jalan pulang sama sekali.
    expect(alat).toContain("function alatPasangPemulihPosisi(");
    expect(alat).toContain("alatPasangPemulihPosisi(panel, kunci);");
    const fungsi = alat.slice(alat.indexOf("function alatPasangPemulihPosisi("));
    const badan = fungsi.slice(0, fungsi.indexOf("\n}\n"));
    // Dibentangkan lagi, bukan sekadar dipindahkan: yang menekan tombol itu
    // sedang mencari panel yang hilang dari pandangannya, dan lencana di
    // pojok bukan jawaban atas pencarian itu.
    expect(badan).toContain("panel.classList.remove(KELAS_LENCANA");
    expect(badan).toContain("alatKembalikanBawaan(panel, kunci);");
  });

  it("popup menyebut jalan pulangnya di tempat yang dicari orang", () => {
    expect(popupHtml).toContain("Menekan × di kepala panel mematikan saklar ini");
  });
});

describe("5 - satu tema untuk popup, widget, SIPP, ABT, dan portal", () => {
  // 23 Okt 2026: pilihan tema kini terang | gelap | sistem, disimpan bersama
  // waktunya (pilihanTema + pilihanTemaWaktu); temaPanel tinggal CERMIN hasil
  // uraian. Perilakunya diuji sungguhan di tema-tanpa-kedip-23okt.test.ts;
  // di sini yang dijaga hanya sambungan antar berkasnya.
  it("popup membaca DAN menulis pilihan + waktunya, dan menjaga cermin temaPanel", () => {
    expect(popupJs).toContain('const KUNCI_TEMA_PILIHAN = "pilihanTema";');
    expect(popupJs).toContain('const KUNCI_TEMA_PANEL = "temaPanel";');
    expect(popupJs).toContain("penyimpanan.set(pusat.tulisanChrome(temaPopup, temaWaktu, temaPopupBerlaku()))");
    // Pilihan yang sama dengan yang berlaku tidak menulis apa pun.
    expect(popupJs).toContain("if (!URUTAN_TEMA.includes(pilihan) || pilihan === temaPopup) return;");
  });

  it("popup ikut berubah ketika temanya diganti dari panel, yang lebih baru menang", () => {
    expect(popupJs).toContain("if (tempat !== \"local\" || !(ubah[KUNCI_TEMA_PILIHAN] || ubah[KUNCI_TEMA_WAKTU])) return;");
    expect(popupJs).toContain("pusat.chromeMenang({ pilihan: p, waktu: t }, { pilihan: temaPopup, waktu: temaWaktu })");
    expect(popupJs).toContain("terapkanTemaPopup();");
  });

  it('atribut popup selalu tegas dan "sistem" ditanyakan ke jendelanya sendiri', () => {
    // Membiarkannya tanpa atribut menyerahkan warnanya kepada peramban - dan
    // itulah jendela putih di atas SIPP yang gelap.
    expect(popupJs).toContain("const berlaku = temaPopupBerlaku();");
    expect(popupJs).toContain("return pusat.resolusiDari(temaPopup, pusat.sistemGelap());");
    expect(popupJs).not.toContain('akar.removeAttribute("data-tema")');
  });

  it("jendelanya lahir gelap, tidak menunggu penyimpanan yang asinkron", () => {
    // chrome.storage hanya asinkron: janji yang paling cepat pun selesai
    // sesudah gambar pertama, dan jendela ini lahir putih lalu berubah gelap
    // tepat di depan mata tiap kali ikonnya ditekan.
    expect(popupHtml).toContain('<html lang="id" data-tema="gelap">');
  });

  it("portal ALETA disambungkan dua arah lewat pusat, dengan penanda asal dan waktu", () => {
    const pusat = readFileSync(path.join(AKAR, "tema-pusat.js"), "utf8");
    // Portal -> chrome: atribut salinan yang ditulis portal diamati pusat.
    expect(pusat).toContain('jembatan: "data-aleta-tema-salinan"');
    // chrome -> portal: satu peristiwa DOM, hanya bila ada yang berubah.
    expect(pusat).toContain('new akar.CustomEvent("aleta-ekstensi-tema"');
    expect(pusat).toContain("if (kini.ada && kini.pilihan === p && kini.waktu === t && kini.resolusi === resolusi) return false;");
    // Panel portal tidak lagi memegang jembatan sendiri.
    expect(aleta).not.toContain("temaBersamaTerakhir");
  });

  it("pemuatan pertama tidak memaksakan bawaan ke portal orang", () => {
    // Bila chrome belum pernah mencatat pilihan, halaman yang sudah punya
    // salinan menjadi sumbernya (diadopsi, bukan dipaksakan); dan yang LEBIH
    // BARU menang di kedua arah.
    const pusat = readFileSync(path.join(AKAR, "tema-pusat.js"), "utf8");
    const fungsi = pusat.slice(pusat.indexOf("function selarasDenganChrome("));
    const badan = fungsi.slice(0, fungsi.indexOf("\n  }\n"));
    expect(badan).toContain("if (lokal) tulisKeChrome();");
    expect(badan).toContain("if (chromeMenang(dariC, lokal))");
    expect(badan).toContain("lokal.waktu > dariC.waktu");
  });
});

describe("6 - tanggal kalender ikut tampak di daftar hari sidang", () => {
  it("disisipkan sebagai baris tambahan, bukan menimpa calon majelisnya", () => {
    expect(konten).toContain("const dariKalender = String(pilihanManual.phs || \"\");");
    expect(konten).toContain("dipilih dari kalender");
    expect(konten).toContain("calonTampil.unshift({");
    // Keempat hari sidang majelis tetap dapat dipilih kembali dengan satu
    // gerakan yang sama.
    const potong = konten.slice(konten.indexOf("const calonTampil = phs.calon.map("));
    expect(potong.slice(0, 900)).toContain("phs.calon.map(");
  });

  it("memilih kembali hari majelis menutup saklar kalendernya", () => {
    // Dua pilihan yang berselisih di layar - kotak kalender berisi satu
    // tanggal sementara daftarnya menunjuk tanggal lain - lebih buruk
    // daripada satu pilihan yang jelas.
    const potong = konten.slice(konten.indexOf("const calonTampil = phs.calon.map("));
    expect(potong.slice(0, 1800)).toContain("pilihanManual.phsBebas = false;");
  });
});
