// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Perilaku panel ekstensi SIPP yang tidak boleh hilang diam-diam.
 *
 * ============================================================================
 * KENAPA PENJAGA SUMBER, BUKAN UJI PERILAKU
 * ============================================================================
 *
 * konten.js adalah content script: ia hidup di dalam halaman SIPP, memakai
 * chrome.storage, dan menyusun DOM di atas halaman milik aplikasi lain.
 * Merendernya di node menuntut memalsukan seluruh lingkungan itu, dan palsuan
 * sebesar itu lebih mungkin salah daripada kodenya sendiri.
 *
 * Yang dijaga di sini karena itu KEPUTUSANNYA, dibaca dari berkas sumbernya -
 * keputusan yang bila terbalik tidak menimbulkan galat apa pun, hanya panel
 * yang diam-diam berhenti bekerja seperti yang dijanjikan.
 */

const berkasKonten = path.resolve(process.cwd(), "../ekstensi-sipp/konten.js");
const berkasGaya = path.resolve(process.cwd(), "../ekstensi-sipp/panel.css");

const konten = () => readFileSync(berkasKonten, "utf8");
const berkasPopup = path.resolve(process.cwd(), "../ekstensi-sipp/popup.js");
const popup = () => readFileSync(berkasPopup, "utf8");
const gaya = () => readFileSync(berkasGaya, "utf8");

describe("bagian malas termuat meski sudah terbentang", () => {
  it("tiap bagian malas memuat sendiri saat tergambar terbentang", () => {
    // Keadaan lipatan disimpan antar-sesi. Bila tersimpan sebagai TERBUKA,
    // bagiannya tergambar terbentang tetapi KOSONG - dan baru terisi sesudah
    // ditekan dua kali: sekali menutup, sekali membuka. Terbaca sebagai menu
    // yang rusak, padahal hanya pemuatnya yang tidak pernah dipanggil.
    const isi = konten();
    const pendaftaran = isi.split('kepala.addEventListener("click", muatBagian);').length - 1;
    const pemuatanAwal = isi.split("setTimeout(muatBagian, 0);").length - 1;
    expect(pendaftaran).toBeGreaterThanOrEqual(3);
    // Tiap bagian yang mendaftarkan pemuat HARUS punya pemuatan awalnya.
    expect(pemuatanAwal).toBe(pendaftaran);
  });

  it("tidak ada pemuat malas yang tertinggal tanpa pemuatan awal", () => {
    // Bagian "Penetapan yang dapat Anda tetapkan" dibuang beserta pemuatnya
    // sendiri (setTimeout(muat, 0)). Yang dijaga sekarang: tidak ada sisa
    // pemanggilan ke fungsi yang sudah tidak ada.
    const isi = konten();
    for (const hilang of [
      "bagianMenungguSaya",
      "gambarPenetapanSaya",
      "gambarPetakPenetapan",
      "penetapanMilikSaya",
      "URUTAN_PENETAPAN",
    ]) {
      expect(isi, hilang).not.toContain(hilang);
    }
  });
});

describe("saklar papan benar-benar dapat ditekan", () => {
  it("pilnya tombol, bukan span", () => {
    // Sebelumnya <span> berbentuk tombol tanpa penangan apa pun: menekannya
    // tidak melakukan apa-apa, dan yang membacanya wajar menyimpulkan
    // aplikasinya rusak.
    const isi = konten();
    expect(isi).toContain('const tombol = buatElemen("button", "aleta-saklar-pil", pil.label);');
    expect(isi).toContain("onPilih(pil.nilai)");
  });

  it("pil tanpa penangan dimatikan dan menyebutkan dirinya", () => {
    // Tombol hidup yang diam lebih buruk daripada tombol mati yang jujur.
    const isi = konten();
    expect(isi).toContain("tombol.disabled = true;");
    expect(isi).toContain("belum dapat diubah dari sini");
  });

  it("berpindah ke otomatis membuang pilihan manual", () => {
    // Menyimpannya diam-diam berarti menekan Otomatis lalu tetap mendapat
    // orang yang dipilih tangan - saklar yang berbohong.
    expect(konten()).toContain('if (nilai === "otomatis") data.pilihanManual = {};');
  });
});

describe("pilihan manual benar-benar terbawa ke formulir", () => {
  it("nilaiUntukBorang menerima dan memakai pilihan manual", () => {
    // Kalau tidak, dropdown-nya berubah di layar tetapi yang terisi ke
    // formulir tetap usulan semula - jauh lebih berbahaya daripada tidak ada
    // pilihan manual sama sekali.
    const isi = konten();
    expect(isi).toContain("function nilaiUntukBorang(formulir, usulan, pilihanManual = {})");
    expect(isi).toContain("nilaiUntukBorang(formulir, usulan, (data && data.pilihanManual) || {})");
  });

  it("pencari calon mengenali keempat bentuk pengenal", () => {
    // hakimId sempat tertinggal, dan akibatnya pilihan hakim tidak pernah
    // ketemu di daftarnya lalu diam-diam jatuh kembali ke usulan.
    const isi = konten();
    expect(isi).toContain("x.id ?? x.hakimId ?? x.paniteraId ?? x.jurusitaId ?? x.nama");
  });

  it("pilihan yang tidak ketemu jatuh ke usulan, bukan ke kosong", () => {
    // Penetapan tanpa nama jauh lebih buruk daripada penetapan dengan nama
    // yang diusulkan mesin.
    expect(konten()).toContain("function pilihanDari(daftar, pengenal)");
  });
});

describe("menciutkan panel benar-benar menciutkan", () => {
  it("tinggi terpatok ikut dilepas, dan dikembalikan lagi", () => {
    // Menyembunyikan isinya saja menyisakan kotak kosong sebesar semula,
    // karena tinggi panel terpatok pada gaya inline sesudah diubah ukurannya.
    const isi = konten();
    expect(isi).toContain("tinggiSebelumCiut");
    expect(isi).toContain("panel.style.height = tinggiSebelumCiut;");
    expect(isi).toContain('panel.classList.add("aleta-panel-ciut");');
  });

  it("gayanya ada, dan pegangan tariknya disembunyikan", () => {
    // Pegangan yang dapat ditarik tetapi tidak mengubah apa pun terbaca
    // sebagai kerusakan.
    const css = gaya();
    expect(css).toContain(".aleta-panel-ciut");
    expect(css).toContain(".aleta-panel-ciut .aleta-tarik");
  });
});

describe("panel pulang ke sudut kanan atas", () => {
  it("bawaan menempel di sudut, bukan 90px di bawahnya", () => {
    // Yang menekan tombol kembali-ke-bawaan sedang meminta panelnya pulang ke
    // sudut - bukan ke suatu tempat di bawah sudut, yang terbaca sebagai panel
    // yang gagal pulang.
    const css = gaya();
    expect(css).toContain("top: 12px;");
    expect(css).not.toContain("top: 90px;");
  });
});

describe("tema terang dan gelap", () => {
  it("tema terang menimpa peubah, bukan aturan satu per satu", () => {
    const css = gaya();
    expect(css).toContain('.aleta-panel[data-tema="terang"]');
    // Kontras dijaga: hijau merek digelapkan untuk latar putih.
    expect(css).toContain("--aleta-merek: #1f7a4d;");
  });

  it("tema SIPP bawaannya MATI", () => {
    // Mengubah tampilan aplikasi orang lain tanpa diminta adalah hal terakhir
    // yang boleh dilakukan lapisan bantu.
    const isi = konten();
    expect(isi).toContain("let temaSippMenyala = false;");
    expect(isi).toContain("simpan[KUNCI_TEMA_SIPP] === true");
  });

  it("tema SIPP dipasang sebagai satu style bertanda yang dapat dibuang", () => {
    // Supaya mematikannya tidak meninggalkan gaya yang menempel di elemen.
    const isi = konten();
    expect(isi).toContain('const PENANDA_TEMA_SIPP = "aleta-tema-sipp";');
    expect(isi).toContain("if (lama) lama.remove();");
  });

  it("TIDAK memakai filter invert pada seluruh halaman", () => {
    // Cara itu memang cepat, tetapi ia membalik warna FOTO dan tanda tangan
    // pindaian juga - dan dokumen pengadilan yang warnanya terbalik adalah
    // harga yang terlalu mahal untuk sebuah kenyamanan mata.
    const isi = konten();
    expect(isi).not.toContain("filter: invert");
    expect(isi).not.toContain("invert(1)");
  });
});

describe("bagian \"Penetapan yang dapat Anda tetapkan\" dibuang", () => {
  /**
   * Bagian itu mencocokkan nama pengguna SIPP dengan pejabat yang berwenang,
   * lalu menyebutkan mana yang "urusan Anda". Dasarnya satu anggapan: tiap
   * pejabat membuka SIPP dengan akunnya sendiri.
   *
   * Anggapan itu gugur sejak ALETA menuliskan penetapan atas nama pejabatnya.
   * Siapa yang sedang membuka SIPP tidak lagi menentukan apa pun - operator
   * yang mengerjakan, dan nama pejabat tetap yang tercatat.
   *
   * Yang paling merugikan bila dipertahankan: ia terbaca seperti gerbang izin
   * padahal tidak pernah menahan apa pun sekali pun.
   */
  it("seluruh fungsinya benar-benar hilang, bukan sekadar tidak dipanggil", () => {
    // Fungsi yatim yang ditinggalkan akan dihidupkan lagi orang berikutnya
    // karena disangka masih terpakai.
    const isi = konten();
    for (const hilang of [
      "function bagianMenungguSaya",
      "function gambarPenetapanSaya",
      "function gambarPetakPenetapan",
      "function penetapanMilikSaya",
      "const URUTAN_PENETAPAN",
      "Penetapan yang dapat Anda tetapkan",
    ]) {
      expect(isi, hilang).not.toContain(hilang);
    }
  });

  it("sebab pembuangannya tertulis di sumbernya", () => {
    // Bagian yang hilang tanpa keterangan akan dibangun ulang orang berikutnya
    // yang mengira ia terhapus tidak sengaja.
    expect(konten()).toContain('BAGIAN "PENETAPAN YANG DAPAT ANDA TETAPKAN" DIBUANG');
  });

  it("rute antrean penerusan tidak ikut dimatikan", () => {
    // Yang dibuang gambarannya, bukan alurnya. Rutenya tetap dipakai tombol
    // Teruskan, dan mematikannya sekalian berarti membuang alur yang masih
    // punya pemanggil.
    expect(konten()).toContain("const ALETA_API_ANTREAN =");
  });

  it("penggantinya sudah ada - kotak atas nama siapa penetapan tercatat", () => {
    // Pertanyaannya berganti: dari "boleh tidak saya mengerjakan ini" menjadi
    // "kalau saya tekan sekarang, tercatat atas nama siapa".
    expect(konten()).toContain("Akan tercatat di SIPP atas nama");
  });
});

describe("panel yang baru muncul dapat digulung", () => {
  /**
   * Tingginya dijepit terhadap SELURUH tinggi jendela, sedangkan posisinya
   * dipasang menyusul di mana saja panel terakhir ditinggalkan. Panel setinggi
   * hampir satu layar yang dipasang 300 piksel dari atas karena itu berujung
   * 300 piksel DI BAWAH tepi layar.
   *
   * Yang membingungkan: tidak ada yang tampak rusak. Yang tidak terjadi hanya
   * menggulung - sebab .aleta-isi tidak meluap, kotaknya sendiri cukup tinggi.
   * Yang meluap keluar layar adalah PANELNYA, dan panel ber-overflow:hidden
   * tidak menggulung.
   */
  it("tingginya dijepit ke ruang yang tersisa di bawah posisinya", () => {
    const isi = konten();
    expect(isi).toContain("function jepitTinggiKeRuangTersisa(panel)");
    expect(isi).toContain("window.innerHeight - kotak.top - 12");
  });

  it("dijalankan sesudah posisinya dipasang, bukan sebelum", () => {
    // Dijalankan lebih dulu, ia menjepit terhadap posisi LAMA - dan panelnya
    // tetap menjulur keluar layar sesudah dipindahkan.
    const isi = konten();
    const potong = isi.slice(isi.indexOf("function terapkanPosisi"));
    expect(potong.indexOf('panel.style.top = `${aman.atas}px`')).toBeLessThan(
      potong.lastIndexOf("jepitTinggiKeRuangTersisa(panel);")
    );
  });

  it("ikut dijalankan saat jendela diubah ukurannya", () => {
    // Jendela yang dipendekkan menimbulkan keadaan yang persis sama.
    const isi = konten();
    const potong = isi.slice(
      isi.indexOf("function jagaTetapTerlihat"),
      isi.indexOf('window.addEventListener("resize"')
    );
    expect(potong).toContain("jepitTinggiKeRuangTersisa(panel);");
  });

  it("mode logo dan layar penuh dikecualikan", () => {
    // Keduanya memang tidak setinggi isinya, dan menjepitnya akan melawan
    // ukuran yang justru sedang diminta.
    const isi = konten();
    const potong = isi.slice(isi.indexOf("function jepitTinggiKeRuangTersisa"));
    expect(potong.slice(0, 700)).toContain('classList.contains("aleta-panel-logo")');
    expect(potong.slice(0, 700)).toContain('classList.contains("aleta-panel-penuh")');
  });
});

describe("kepala panel: akun SIPP, layar penuh, dan mode logo", () => {
  it("akun SIPP yang sedang masuk disebut di kepala", () => {
    // Jawaban paling menentukan sebelum menekan apa pun. Selama ini hanya ada
    // di sudut kanan atas SIPP - tertutup panel ini sendiri pada layar sempit.
    const isi = konten();
    expect(isi).toContain("const akunSipp = namaPenggunaSipp();");
    expect(isi).toContain('buatElemen("span", "aleta-akun-sipp", akunSipp)');
  });

  it("tidak menulis apa-apa bila akunnya tidak terbaca", () => {
    // "tidak diketahui" di kepala panel hanya menambah satu kata yang harus
    // dibaca tiap kali tanpa pernah menjawab apa pun.
    expect(konten()).toContain("if (akunSipp) {");
  });

  it("layar penuh melepas gaya inline, lalu memasangnya kembali", () => {
    // Geser dan ubah ukuran menulis gaya INLINE, yang menang atas kelas mana
    // pun. Tanpa dilepas, panel tetap terpaku di tempat lamanya.
    const isi = konten();
    expect(isi).toContain('panel.classList.toggle("aleta-panel-penuh")');
    expect(isi).toContain("} else if (keadaanPanel) {");
    expect(isi).toContain("terapkanPosisi(panel, keadaanPanel);");
  });

  it("mode logo dikembalikan dengan menekan logonya", () => {
    // Dalam bentuk logo tidak ada satu pun tombol yang terlihat, jadi
    // pendengarnya harus di panel - bukan di tombol.
    const isi = konten();
    expect(isi).toContain('panel.classList.add("aleta-panel-logo")');
    expect(isi).toContain('if (!panel.classList.contains("aleta-panel-logo")) return;');
  });
});

describe("tema terang mengembalikan SIPP seperti semula", () => {
  it("lapisan SIPP hanya dipasang pada tema gelap", () => {
    // Lapisan tema hanya masuk akal sebagai keringanan mata, dan keringanan
    // itu hanya perlu ketika halaman putih menyilaukan di sebelah panel gelap.
    const isi = konten();
    const potong = isi.slice(
      isi.indexOf("function terapkanTemaSipp"),
      isi.indexOf("async function muatTema")
    );
    expect(potong).toContain('if (temaSekarang !== "gelap") return;');
    expect(potong).toContain('gayaTemaSipp("gelap")');
  });

  it("keadaan saklarnya disebut apa adanya", () => {
    // Tombol yang berkata "menyala" sementara SIPP tampak tidak berubah
    // membuat yang membacanya menyimpulkan saklarnya rusak.
    expect(konten()).toContain("menyala, tetapi tidak dipasang pada tema terang");
  });

  it("tema terang panel tidak lagi putih murni", () => {
    // #ffffff di atas halaman SIPP yang gelap adalah lompatan kecerahan paling
    // tajam yang mungkin - dan panel ini dibaca berjam-jam.
    const berkas = gaya();
    const potong = berkas.slice(berkas.indexOf('.aleta-panel[data-tema="terang"]'));
    expect(potong.slice(0, 400)).toContain("--aleta-latar: #f4f6f4;");
    expect(potong.slice(0, 400)).not.toContain("--aleta-latar: #ffffff;");
  });
});

describe("Kerjakan paling atas, sisanya terlipat", () => {
  it("kelompok Kerjakan digambar sebelum Berkas", () => {
    // Panel ini dibuka orang yang sedang MENGERJAKAN perkara. Sebelumnya
    // Kerjakan duduk paling bawah di balik tiga kelompok keterangan.
    const isi = konten();
    expect(isi.indexOf('kelompok("Kerjakan", "kerjakan"')).toBeLessThan(
      isi.indexOf('kelompok("Berkas", "berkas"')
    );
  });

  it("hanya Kerjakan yang terbuka", () => {
    const isi = konten();
    expect(isi).toContain('kelompok("Kerjakan", "kerjakan", false)');
    for (const tertutup of [
      'kelompok("Berkas", "berkas", true)',
      'kelompok("Perkara", "perkara", true)',
      'kelompok("Putusan", "putusanKel", true)',
    ]) {
      expect(isi, tertutup).toContain(tertutup);
    }
  });
});

describe("posisi panel dapat dikembalikan dari popup Chrome", () => {
  it("popup menghapus hanya kunci posisinya", () => {
    // Saklar, tema, dan lipatan menu tidak ikut terhapus: yang hilang dari
    // layar adalah letaknya, dan membuang pengaturan lain sekalian berarti
    // menghukum petugas atas kesalahan yang tidak ia perbuat.
    const isi = popup();
    expect(isi).toContain('.remove("posisiPanel")');
  });

  it("skrip konten mendengarkan penghapusan itu", () => {
    // Panel yang tergeser keluar layar tidak dapat dikembalikan dari tombol di
    // dalam panel itu sendiri - tombolnya ikut hilang bersama panelnya.
    const isi = konten();
    expect(isi).toContain("perubahan[KUNCI_POSISI].newValue === undefined");
    expect(isi).toContain("kembalikanBawaan(panel);");
  });
});

// ---------------------------------------------------------------------------
// TAHAP 2 - PETIKAN, PETA KOLOM, BERKAS PER AGENDA, DAN PENANDA HALAMAN
// ---------------------------------------------------------------------------

describe("petikan berkas gugatan menggambar seluruh ruas yang dipetik", () => {
  it("ruas Data Umum perkawinan ikut digambar", () => {
    // Pemetik di server mengembalikan enam belas ruas; daftar di ekstensi dulu
    // hanya menyebut sepuluh. Yang hilang justru ruas Data Umum yang paling
    // dicari saat mendaftarkan perkara perkawinan - dan ruas yang tidak ada di
    // daftar itu lenyap tanpa jejak: tidak ada galat, tidak ada keterangan.
    const isi = konten();
    for (const kunci of [
      "tanggalMenikah",
      "nomorAktaNikah",
      "tanggalAktaNikah",
      "kuaTempatMenikah",
      "obyekSengketa",
      "posita",
      "tanggalSurat",
      "nomorSurat",
    ]) {
      expect(isi, `ruas ${kunci} tidak digambar`).toContain(`${kunci}:`);
    }
  });

  it("daftar petikan sama banyak dengan yang dipetik server", () => {
    // Kalau pemetik menambah ruas dan daftar ini tidak, ruas barunya hilang
    // diam-diam - persis cacat yang baru saja diperbaiki.
    const petik = readFileSync(
      path.resolve(process.cwd(), "src/server/modules/aleta-ecourt/berkas-gugatan.ts"),
      "utf8"
    );
    const tipe = petik.slice(petik.indexOf("export type DataUmum = {"));
    const ruasServer = new Set(
      Array.from(tipe.slice(0, tipe.indexOf("};")).matchAll(/^\s{2}(\w+):/gm)).map((m) => m[1])
    );
    const daftar = konten();
    const blok = daftar.slice(
      daftar.indexOf("const NAMA_PETIKAN = {"),
      daftar.indexOf("function gambarPetikan")
    );
    const ruasEkstensi = new Set(
      Array.from(blok.matchAll(/^\s{2}(\w+):/gm)).map((m) => m[1])
    );
    const hilang = [...ruasServer].filter((x) => !ruasEkstensi.has(x));
    expect(hilang, `ruas dipetik server tetapi tidak digambar: ${hilang.join(", ")}`).toEqual([]);
  });
});

describe("peta kolom formulir menyebut dirinya alat pemasangan", () => {
  it("namanya dan keterangannya tidak lagi menyesatkan", () => {
    // Yang tergambar di sana PENUNJUK kolom, bukan isinya. Tanpa keterangan
    // itu, daftarnya terbaca sebagai fitur yang gagal mengambil data.
    const isi = konten();
    expect(isi).toContain("Peta kolom formulir (sekali pasang)");
    expect(isi).toContain("Ini alat PEMASANGAN, bukan penampil data.");
  });
});

describe("berkas e-Court menempel pada agenda yang menunggunya", () => {
  it("tahapan diperiksa sebelum tanggal", () => {
    // Sebelumnya HANYA tanggal, sehingga baris beragenda Jawaban menerima
    // seluruh berkas yang kebetulan bertanggal sama.
    const isi = konten();
    expect(isi).toContain("const TAHAPAN_BERKAS = [");
    expect(isi).toContain("function berkasUntukAgenda(agendaTeks, dokumen)");
    expect(isi).toContain('kotakSisipan(cocokAgenda, ambang, "cocok agenda")');
  });

  it("duplik rekonvensi diperiksa SEBELUM duplik", () => {
    // Yang belakangan juga cocok dengan yang pertama dan akan merebutnya.
    const isi = konten();
    const blok = isi.slice(isi.indexOf("const TAHAPAN_BERKAS = ["));
    // Dicari lewat nama tahapannya, bukan lewat teks regexnya. Menuliskan
    // ulang pola bertanda miring di dalam uji berarti tanda miringnya harus
    // lolos dua lapis - dan lapis mana pun yang memakannya membuat uji ini
    // mencari teks yang tidak pernah ada lalu lulus tanpa memeriksa apa pun.
    const urutan = Array.from(blok.matchAll(/\{ agenda: \/([^/]+)\//g)).map((m) => m[1]);
    const iRekonvensi = urutan.findIndex((x) => x.includes("rekonvensi"));
    const iDuplik = urutan.findIndex((x) => x.includes("duplik") && !x.includes("rekonvensi"));
    expect(iRekonvensi).toBeGreaterThanOrEqual(0);
    expect(iDuplik).toBeGreaterThanOrEqual(0);
    expect(iRekonvensi).toBeLessThan(iDuplik);
  });

  it("sebab pencocokan disebut di kotaknya", () => {
    // Berkas yang menempel karena agendanya berbeda derajat kepastiannya dari
    // yang menempel karena kebetulan bertanggal sama.
    expect(konten()).toContain("function kotakSisipan(dokumenSehari, ambangHari, sebabCocok");
  });
});

describe("penanda halaman daftar menggambar keenam sinyalnya", () => {
  it("nomor bermasalah dan selisih e-Court ikut digambar", () => {
    // Keduanya TIDAK ADA di layar SIPP mana pun - dan justru keduanya yang
    // paling menjawab kenapa penanda ini ada sama sekali.
    const isi = konten();
    expect(isi).toContain("ringkas.nomorBermasalah > 0");
    expect(isi).toContain("ringkas.selisihGenting > 0");
  });

  it("hijau menuntut keenam sinyal bersih, bukan empat", () => {
    // Menandai perkara hijau sementara nomornya bermasalah adalah kabar baik
    // yang keliru - dan itu lebih merugikan daripada tidak ada kabar.
    const isi = konten();
    const blok = isi.slice(isi.indexOf("ringkas.dokumen > 0 &&"));
    expect(blok.slice(0, 400)).toContain("ringkas.nomorBermasalah === 0");
    expect(blok.slice(0, 400)).toContain("ringkas.selisihGenting === 0");
  });

  it("tiap penanda menerangkan artinya saat disentuh", () => {
    // Penanda yang tidak dapat ditindaklanjuti pada akhirnya diabaikan, dan
    // penanda yang diabaikan sama saja dengan penanda yang tidak ada.
    const isi = konten();
    expect(isi).toContain("function labelTanda(teks, warna, { judul =");
    expect(isi).toContain('span.title = `ALETA: ${judul}`;');
  });
});
