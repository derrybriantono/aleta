// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Lima keputusan tampilan ekstensi yang lahir dari keluhan nyata di layar.
 *
 * ============================================================================
 * KENAPA PENJAGA SUMBER
 * ============================================================================
 *
 * Sama alasannya dengan ekstensi-panel.test.ts: berkas-berkas ini hidup di
 * dalam halaman SIPP dan di dalam popup peramban. Yang dijaga adalah
 * KEPUTUSANNYA - keputusan yang bila terbalik tidak menimbulkan galat apa pun,
 * hanya tampilan yang diam-diam kembali seperti sebelum dikeluhkan.
 */

const akar = (nama: string) => path.resolve(process.cwd(), `../ekstensi-sipp/${nama}`);
const konten = () => readFileSync(akar("konten.js"), "utf8");
const gaya = () => readFileSync(akar("panel.css"), "utf8");
const popupJs = () => readFileSync(akar("popup.js"), "utf8");
const popupHtml = () => readFileSync(akar("popup.html"), "utf8");

/**
 * panel.css tanpa catatannya.
 *
 * Penjaga yang menyatakan "pemilih ini TIDAK BOLEH ADA lagi" harus membaca
 * aturannya saja. Bentuk lama yang dikutip di dalam catatan - justru untuk
 * menerangkan kenapa ia dibuang - membuat penjaganya berbunyi atas kalimat
 * yang menjelaskan perbaikannya sendiri.
 */
const gayaTanpaCatatan = () => gaya().replace(/\/\*[\s\S]*?\*\//g, "");

/** Isi fungsi tempelPenandaBaris saja, tanpa yang di sekelilingnya. */
function fungsiPenandaBaris() {
  const isi = konten();
  const awal = isi.indexOf("function tempelPenandaBaris(baris, nomor, ringkas, identitas) {");
  expect(awal).toBeGreaterThan(0);
  const akhir = isi.indexOf("\n}\n", awal);
  return isi.slice(awal, akhir);
}

describe("penanda daftar perkara ditempel di bawah nomor perkaranya", () => {
  it("selnya dicari dari nomor perkara, bukan kolom pertama", () => {
    // Kolom pertama adalah nomor URUT - selebar dua angka. Penanda selebar
    // "PIHAK GHAIB" di dalamnya meluber atau terpotong.
    const potong = fungsiPenandaBaris();
    expect(potong).toContain("cariSelNomorPerkara(semuaSel, nomor)");
    expect(potong).not.toContain('const sel = baris.querySelector("td");');
  });

  it("pencarian selnya tidak mematok kolom kedua", () => {
    // Susunan kolom SIPP berbeda antar halaman daftar - pada salah satunya
    // kolom kedua adalah tanggal register.
    const isi = konten();
    const potong = isi.slice(
      isi.indexOf("function cariSelNomorPerkara"),
      isi.indexOf("function barisPerkaraDiHalaman")
    );
    expect(potong).toContain("includes(nomor)");
  });

  it("penandanya masuk ke wadah baris sendiri, bukan menyambung di belakang nomor", () => {
    const potong = fungsiPenandaBaris();
    expect(potong).toContain('buatElemen("div", "aleta-tanda-baris")');
    // Tidak ada lagi yang ditempel langsung ke selnya selain wadah itu.
    expect(potong.split("sel.appendChild(").length - 1).toBe(1);
    expect(potong.split("taruh(").length - 1).toBeGreaterThanOrEqual(11);
  });

  it("wadahnya hanya dibuat bila ada yang digambar", () => {
    // Baris kosong setinggi tiga piksel pada lima puluh baris daftar adalah
    // tabel yang jadi lebih panjang tanpa satu keterangan pun bertambah.
    const potong = fungsiPenandaBaris();
    expect(potong).toContain("let wadah = null;");
    expect(potong).toContain("if (!wadah) {");
  });

  it("wadahnya bertanda, supaya baris yang sudah ditandai tidak ditandai lagi", () => {
    const potong = fungsiPenandaBaris();
    expect(potong).toContain('wadah.setAttribute(TANDA, "1")');
  });

  it("penanda identitas digambar untuk SEMUA perkara yang punya catatan", () => {
    // Keluhan asalnya: perkara 232 ghaib, tetapi daftar perkaranya polos.
    const potong = fungsiPenandaBaris();
    for (const kunci of ["ghaib", "izinAtasan", "verzet", "prodeo", "kuasa"]) {
      expect(potong).toContain(`identitas.${kunci}`);
    }
    // Digambar SEBELUM keluar awal untuk perkara yang belum ditarik ALETA -
    // kalau tidak, hanya perkara yang sudah ditarik yang pernah bertanda.
    expect(potong.indexOf("identitas.ghaib")).toBeLessThan(
      potong.indexOf("if (ringkas === null) return;")
    );
  });
});

describe("lencana tidak boleh menyatu dengan halaman SIPP", () => {
  it("isian pastel dibuang", () => {
    // #fee2e2 dan kawan-kawannya menyatu dengan sel SIPP yang memang sudah
    // putih keabu-abuan. Lencana yang harus dicari adalah lencana yang tidak
    // dibaca.
    const css = gaya();
    expect(css).not.toContain(".aleta-tanda-merah  { background: #fee2e2;");
    expect(css).toContain(".aleta-tanda-merah  { background: #b42318; color: #ffffff;");
  });

  it("punya varian untuk halaman SIPP bertema gelap", () => {
    // Isian pekat di atas latar gelap menjadi kotak gelap di atas kotak gelap.
    const css = gaya();
    for (const warna of ["merah", "kuning", "hijau", "abu"]) {
      expect(css).toContain(`html[data-aleta-tema-sipp="gelap"] .aleta-tanda-${warna}`);
    }
  });

  it("baris penandanya membungkus, tidak memaksa gulir mendatar", () => {
    const css = gaya();
    const potong = css.slice(css.indexOf(".aleta-tanda-baris {"));
    expect(potong.slice(0, 200)).toContain("flex-wrap: wrap;");
  });
});

describe("panel berhenti di tiga per lima layar", () => {
  it("tingginya dibatasi 3/5 tinggi jendela, bukan sampai tepi bawah", () => {
    // Panel setinggi layar penuh menutup seluruh sisi kanan halaman SIPP,
    // termasuk paginasi dan tombol yang letaknya memang di bawah.
    const isi = konten();
    const potong = isi.slice(isi.indexOf("function jepitTinggiKeRuangTersisa"));
    expect(potong.slice(0, 2400)).toContain("window.innerHeight * 0.6");
  });

  it("batasnya tidak pernah melewati ruang yang benar-benar tersisa", () => {
    // Tiga per lima layar tetap dapat menjulur keluar bila panelnya digeser
    // jauh ke bawah - yang menjaga tepi layar tetap sisa.
    const isi = konten();
    const potong = isi.slice(isi.indexOf("function jepitTinggiKeRuangTersisa"));
    expect(potong.slice(0, 2400)).toContain("Math.min(sisa,");
  });

  it("tinggi yang ditarik sendiri petugas tidak ikut dipangkas", () => {
    // Batas ini bawaan, bukan kurungan.
    const isi = konten();
    expect(isi).toContain('panel.dataset.tinggiSendiri = "1";');
    expect(isi).toContain("delete panel.dataset.tinggiSendiri;");
  });
});

describe("popup menyebut versi dan dua akun yang sedang masuk", () => {
  it("ketiganya punya tempatnya di popup", () => {
    const html = popupHtml();
    expect(html).toContain('id="versiEkstensi"');
    expect(html).toContain('id="akunAleta"');
    expect(html).toContain('id="akunSipp"');
  });

  it("versinya dibaca dari manifest yang benar-benar terpasang", () => {
    // Bukan dari angka yang ditulis terpisah - dua tempat pasti berselisih,
    // dan yang kedua pasti terlupa.
    expect(popupJs()).toContain("chrome.runtime.getManifest().version");
  });

  it("versi portal yang lebih baru disebut sebagai perlu diperbarui", () => {
    // Ekstensi yang dimuat unpacked tidak pernah memperbarui dirinya sendiri.
    const js = popupJs();
    expect(js).toContain("bandingVersi(disajikan, terpasang) > 0");
    expect(js).toContain("perlu diperbarui");
  });

  it("akun ALETA ditanyakan ke portal, bukan ditebak dari penyimpanan", () => {
    const js = popupJs();
    expect(js).toContain("/api/aleta-ecourt/ekstensi?info=siapa");
    expect(js).toContain('credentials: "include"');
  });

  it("tanpa sesi disebut belum masuk, bukan dikosongkan", () => {
    const js = popupJs();
    expect(js).toContain("respons.status === 401");
    expect(js).toContain("belum masuk portal ALETA");
  });

  it("akun SIPP dicatat skrip konten dari sapaan di kepala halamannya", () => {
    // Popup berjalan di origin chrome-extension:// dan tidak melihat halaman
    // SIPP sama sekali.
    const isi = konten();
    expect(isi).toContain("function catatAkunSipp()");
    expect(isi).toContain("akunSipp: nama,");
    expect(popupJs()).toContain('.get(["asalPortal", "akunSipp"])');
  });

  it("yang dicatat hanya nama tampilan - tidak ada sandi atau pengenal sesi", () => {
    const isi = konten();
    const potong = isi.slice(
      isi.indexOf("function catatAkunSipp"),
      isi.indexOf("async function segarkan")
    );
    expect(potong).not.toContain("password");
    expect(potong).not.toContain("cookie");
    expect(potong).toContain("namaPenggunaSipp()");
  });
});

describe("tema gelap SIPP: lengkap, dan dapat dicabut utuh", () => {
  it("menggelapkan LATAR, bukan hanya tulisan", () => {
    // Percobaan pertama hanya menerangkan tulisan tanpa menggelapkan latar
    // yang aslinya putih - hasilnya tulisan putih di atas kertas putih.
    // Setengah tema lebih berbahaya daripada tanpa tema: yang tanpa tema
    // masih terbaca.
    const css = gaya();
    for (const pemilih of [
      ".cssTable tr:nth-child(odd)",
      ".cssTable tr:nth-child(even)",
      "#tableDetilPerkara",
      "#infoPerkara",
      "#detil_page",
    ]) {
      expect(css).toContain(pemilih);
    }
  });

  it("warna yang ditanam di atribut dan gaya sebaris ikut ditangani", () => {
    // bgcolor="#FFFFFF" dan style="color:#111" mengalahkan berkas gaya mana
    // pun kecuali dengan !important, dan keduanya hampir selalu berarti
    // "hitam di atas putih".
    const css = gaya();
    expect(css).toContain("font[color]");
    expect(css).toContain('[style*="color"]');
    expect(css).toContain("[bgcolor]");
  });

  it("aturannya dilingkupi ke wadah SIPP, bukan menyapu seluruh dokumen", () => {
    // Panel melayang di atas halaman yang sama. Dilingkupi ke wadah SIPP,
    // panel ALETA - yang bukan keturunan wadah mana pun di daftar itu - tidak
    // perlu dikecualikan sama sekali, dan pencocokannya jauh lebih murah.
    const css = gayaTanpaCatatan();
    expect(css).toContain("#konten input");
    expect(css).toContain(":is(#konten, #atas, #footer, .modal-content) a");
  });

  it("gambar dan pindaian tidak pernah difilter", () => {
    // Dokumen pengadilan yang warnanya berubah adalah harga yang terlalu
    // mahal untuk kenyamanan mata.
    const css = gaya();
    expect(css).not.toContain("filter: invert");
    const potong = css.slice(css.indexOf("TEMA GELAP UNTUK HALAMAN SIPP"));
    expect(potong).toContain("filter: none !important");
  });

  it("seluruh tema bergantung pada SATU penanda", () => {
    // Sifatnya yang paling penting: mencabut penandanya mengembalikan SIPP
    // persis seperti semula. Aturan yang lupa diberi awalan itu akan
    // tertinggal menyala pada tema terang.
    const css = gaya();
    const potong = css.slice(css.indexOf("TEMA GELAP UNTUK HALAMAN SIPP"));
    const pembuka = potong.split("\n").filter((baris) => /^[.#:a-z\[]/i.test(baris.trim()) && baris.includes("{"));
    const tanpaAwalan = pembuka.filter(
      (baris) => !baris.includes("data-aleta-tema-sipp") && !baris.trim().startsWith("html")
    );
    expect(tanpaAwalan).toEqual([]);
  });
});

describe("palet panel: satu tempat, dua tema", () => {
  it("warna redup tidak lagi dipatok, supaya tema terang ikut berubah", () => {
    // #e4ebe6 dipatok pada dua aturan - hampir putih. Pada tema terang itu
    // berarti tulisan hampir putih di atas latar hampir putih.
    const css = gaya();
    const potong = css.slice(0, css.indexOf("TEMA GELAP UNTUK HALAMAN SIPP"));
    for (const warna of ["#869489", "#6e7d74", "#5f6d65", "#e4ebe6", "#1e2926", "#3a4a44"]) {
      expect(potong).not.toContain(warna);
    }
  });

  it("kepala panel ikut tema, tidak dipatok gelap", () => {
    // Dipatok #16211c, kepalanya tetap gelap pada tema terang sementara
    // tulisan di dalamnya mengikuti tema terang - yaitu gelap juga. Nama
    // "ALETA" dan nama akun SIPP tinggal 1,06 dan 2,6 banding satu.
    const css = gaya();
    const potong = css.slice(css.indexOf(".aleta-kepala {"));
    expect(potong.slice(0, 1200)).toContain("background: var(--aleta-latar-naik);");
    expect(potong.slice(0, 1200)).not.toContain("background: #16211c;");
  });

  it("penanda identitas dan chip punya padanan untuk kedua tema", () => {
    const css = gaya();
    for (const kelas of [
      "aleta-tanda-jenis",
      "aleta-tanda-kumulasi",
      "aleta-tanda-kuasa",
      "aleta-tanda-tanpa-kuasa",
      "aleta-chip-merah",
      "aleta-chip-kuning",
      "aleta-chip-abu",
      "aleta-usia-basi",
      "aleta-permintaan-tombol",
    ]) {
      expect(css).toContain(`.aleta-panel[data-tema="terang"] .${kelas}`);
    }
  });
});

describe("halaman daftar perkara tidak lagi kosong dari ALETA", () => {
  it("panel ringkas digambar untuk halaman daftar", () => {
    // Sebelumnya panel HANYA muncul di halaman satu perkara. Di halaman daftar
    // tidak ada apa pun dari ALETA, dan yang membukanya menyimpulkan
    // ekstensinya mati.
    const isi = konten();
    expect(isi).toContain("function susunPanelDaftar(ringkasan)");
    expect(isi).toContain('panel.dataset.mode = "daftar"');
  });

  it("panel daftar punya tombol matikan yang sama dengan panel perkara", () => {
    // Satu aturan di satu tempat: tombolnya dulu disusun sebaris di dalam
    // susunPanel, sehingga panel yang lahir belakangan tidak punya tombolnya.
    const isi = konten();
    expect(isi).toContain("function tombolMatikan()");
    expect(isi.split("tombolMatikan()").length - 1).toBeGreaterThanOrEqual(3);
  });

  it("panel daftar dapat digeser dan diubah ukurannya", () => {
    const isi = konten();
    const potong = isi.slice(
      isi.indexOf("function susunPanelDaftar"),
      isi.indexOf("function susunAjakanMasuk")
    );
    expect(potong).toContain("pasangGeser(panel, kepala)");
    expect(potong).toContain("pasangUbahUkuran(panel)");
  });

  it("penandaan yang dimatikan disebut apa adanya beserta jalan keluarnya", () => {
    // Panel yang hanya berkata "tidak ada penanda" membuat orang mengira tidak
    // ada yang perlu diperiksa.
    const isi = konten();
    expect(isi).toContain("Penandaan baris sedang dimatikan.");
  });

  it("penandaan halaman kini bawaannya menyala", () => {
    // Saklarnya terkubur di popup ikon peramban, dan akibatnya penanda ghaib
    // tidak pernah muncul sama sekali - dua kali dilaporkan sebagai kerusakan.
    const isi = konten();
    expect(isi).toContain("saklar.tandaiHalaman = simpan.tandaiHalaman !== false;");
    expect(popupJs()).toContain("kotakTanda.checked = simpan.tandaiHalaman !== false;");
    expect(popupHtml()).toContain('id="tandaiHalaman" checked');
  });

  it("penyisipan berkas ke tabel SIPP TETAP mati secara bawaan", () => {
    // Ia membuat berkas ALETA tampak seperti berkas SIPP - jauh lebih mudah
    // disalahpahami daripada label yang jelas bukan milik SIPP.
    const isi = konten();
    expect(isi).toContain("saklar.sisipJadwal = simpan.sisipJadwal === true;");
  });
});

describe("yang membuat halaman terasa berat sudah dibuang", () => {
  it("tidak ada lagi pemilih penyapu seluruh dokumen", () => {
    // [style*="color"] tanpa lingkup memaksa pencocokan substring pada atribut
    // style tiap elemen, dan :not() bermajemuk memaksa penelusuran leluhur.
    // Pada daftar berisi lima puluh perkara keduanya berlipat.
    const css = gayaTanpaCatatan();
    expect(css).not.toContain(':is(font[color], [style*="color"]):not(#aleta-panel-sipp *)');
    expect(css).not.toContain("input:not(#aleta-panel-sipp input)");
    expect(css).not.toContain("a:not(#aleta-panel-sipp a)");
  });

  it("penanganan warna sebaris dilingkupi ke wadah SIPP", () => {
    const css = gayaTanpaCatatan();
    expect(css).toContain(":is(#konten, .cssTable, .detil, #detil_page, #infoPerkara");
    expect(css).toContain(':is(font[color], [style*="color"]) {');
  });

  it("popup tidak pernah menggantung menunggu portal", () => {
    const js = popupJs();
    expect(js).toContain("new AbortController()");
    expect(js).toContain("clearTimeout(penghenti)");
  });
});

describe("tema terang berpindah keluarga, bukan sekadar diredupkan", () => {
  it("paletnya batu hangat, bukan abu kehijauan", () => {
    // Abu kehijauan di atas SIPP putih-hijau terbaca sebagai bagian SIPP yang
    // kebetulan lebih gelap - bukan sebagai lapisan milik aplikasi lain.
    const css = gaya();
    const potong = css.slice(css.indexOf('.aleta-panel[data-tema="terang"] {'));
    expect(potong.slice(0, 2600)).toContain("--aleta-latar: #ece9e3;");
    expect(potong.slice(0, 2600)).not.toContain("--aleta-latar: #e9ede9;");
  });

  it("tulisannya tidak hitam murni", () => {
    const css = gaya();
    const potong = css.slice(css.indexOf('.aleta-panel[data-tema="terang"] {'));
    expect(potong.slice(0, 2600)).toContain("--aleta-tulisan: #2b2721;");
    expect(potong.slice(0, 2600)).not.toContain("--aleta-tulisan: #000000;");
  });

  it("garis kepala panel hijau ALETA, bukan goresan gelap", () => {
    // Garis gelap di atas halaman SIPP yang putih tidak berasal dari mana pun.
    const css = gaya();
    expect(css).toContain('.aleta-panel[data-tema="terang"] .aleta-kepala');
    expect(css).toContain("border-bottom-color: #b8d3c3;");
  });

  it("tepinya dipertegas supaya panel terpisah dari kertas SIPP", () => {
    const css = gaya();
    const potong = css.slice(css.indexOf('.aleta-panel[data-tema="terang"] {'));
    expect(potong).toContain("border-color: var(--aleta-garis-kuat);");
  });
});
