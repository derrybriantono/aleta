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

describe("menciutkan panel menjadi LENCANA, bukan kotak", () => {
  it("tombol ciut menghasilkan lencana melayang", () => {
    // Bentuk lamanya menyembunyikan isi dan menyisakan KEPALA - sebatang
    // kotak selebar panel yang menutupi kolom di bawahnya tanpa menampilkan
    // satu pun keterangan. Itulah "kotak melayang" yang dilaporkan.
    const isi = konten();
    // ======================================================================
    // SATU BENTUK CIUT, DAN KEADAANNYA DISIMPAN
    // ======================================================================
    //
    // Sampai 1.105.0 panel SIPP punya mode logonya sendiri
    // (aleta-panel-logo) yang keadaannya TIDAK pernah disimpan, sedangkan
    // panel ABT dan panel halaman ALETA memakai aleta-panel-lencana yang
    // menyimpannya. Itu sebab laporan "kadang tidak menciut jadi logo
    // melayang": halaman SIPP mengubah DOM-nya terus-menerus, panelnya
    // digambar ulang, dan panel yang baru lahir terbentang lagi.
    expect(isi).toContain('lipat.title = "Ciutkan menjadi lencana";');
    expect(isi).toContain("ciutkanKeLencana(panel, true);");
    expect(isi).toContain("panel.classList.add(KELAS_LENCANA);");
    // Kelas lamanya benar-benar dibuang, bukan disisakan berdampingan.
    expect(isi).not.toContain('classList.add("aleta-panel-logo")');
    // Tombol berlian yang dulu mengerjakan hal yang sama sudah dibuang -
    // dua tombol yang sama-sama mengecilkan menuntut orang mengingat bedanya.
    expect(isi).not.toContain('buatElemen("button", "aleta-jadilogo"');
  });

  it("keadaan ciut DISIMPAN, dan dipulihkan tiap panel digambar ulang", () => {
    // Inilah sebab laporannya, dan satu-satunya penjaga yang menahannya:
    // menciutnya tidak pernah gagal - ia dibatalkan oleh halaman SIPP yang
    // menggambar ulang panelnya sedetik kemudian.
    const isi = konten();
    expect(isi).toContain("lencana: mau");
    expect(isi).toContain("if (posisi && posisi.lencana) ciutkanKeLencana(panel, true);");
  });

  it("lencana dapat DIGESER - klik dibedakan dari tarikan lewat jarak", () => {
    // Tanpa pembeda, tiap tarikan berakhir dengan lencana yang terbentang
    // kembali, sebab tiap tarikan diakhiri satu klik di atas lencananya.
    const isi = konten();
    expect(isi).toContain('panel.dataset.baruDigeser = "1";');
    expect(isi).toContain('if (panel.dataset.baruDigeser === "1") {');
  });

  it("dan pendengar tarikannya di PANEL, bukan di kepala yang tersembunyi", () => {
    // Pembeda di atas tidak pernah menyala selama pendengarnya di kepala:
    // kepala itu display:none begitu panelnya menjadi lencana, jadi lencana
    // yang dijanjikan dapat digeser sesungguhnya tidak pernah dapat digeser.
    const isi = konten();
    expect(isi).toContain('panel.addEventListener("mousedown"');
    expect(isi).not.toContain('kepala.addEventListener("mousedown"');
    // Pagarnya: panel yang terbentang tetap hanya digeser dari kepalanya.
    expect(isi).toContain('if (!panel.classList.contains(KELAS_LENCANA) && !kepala.contains(peristiwa.target)) return;');
  });

  it("deret tombolnya SATU, dipakai panel perkara dan panel daftar", () => {
    // Panel daftar - dashboard, daftar perkara perdata - dulu hanya punya
    // tema dan tutup. Satu ekstensi dengan dua perilaku pada dua halaman
    // terbaca sebagai ekstensi yang rusak di salah satunya.
    const isi = konten();
    expect(isi).toContain("function pasangTombolKepala(");
    // Tiga kemunculan: satu definisinya, dua pemanggilnya.
    expect(isi.split("pasangTombolKepala(panel, kepala").length - 1).toBe(3);
    expect(isi.split("function pasangTombolKepala").length - 1).toBe(1);
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
    // Kontras dijaga: hijau merek digelapkan untuk latar terang.
    expect(css).toContain("--aleta-merek: #1c6f46;");
  });

  it("gelap adalah bawaan, termasuk lapisannya di halaman SIPP", () => {
    // Sebelumnya lapisan gelap pada SIPP bawaannya mati, dengan alasan yang
    // masih benar: tampilan aplikasi orang lain tidak diubah tanpa diminta.
    // Yang berubah siapa yang meminta - pemakainya sendiri yang memutuskan
    // gelap sebagai bawaan, dan satu tekanan mengembalikannya.
    const isi = konten();
    // Sejak pusat tema (23 Okt 2026) saklarnya dibaca di tema-pusat.js dan
    // konten.js mengikutinya; aturan "!== false" tetap sama.
    expect(isi).toContain("temaSippMenyala = kini.lapisan !== false;");
    const pusat = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/tema-pusat.js"), "utf8");
    expect(pusat).toContain("simpan[KUNCI.lapisan] !== false");
  });

  it("yang pernah mematikan lapisannya tetap mendapati SIPP asli", () => {
    // Dibaca "!== false", bukan "=== true": pembaruan tidak boleh membatalkan
    // pilihan yang sudah dibuat orang.
    const isi = konten();
    expect(isi).not.toContain("simpan[KUNCI_TEMA_SIPP] === true");
    const pusat = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/tema-pusat.js"), "utf8");
    expect(pusat).not.toContain("simpan[KUNCI.lapisan] === true");
  });

  it("tema SIPP tinggal di panel.css, bukan sebagai teks di dalam konten.js", () => {
    // Gaya yang ditulis sebagai teks JavaScript tidak diperiksa siapa pun -
    // satu tanda kurung yang salah baru ketahuan ketika halamannya sudah
    // telanjur aneh. Ia juga berkekhususan rendah, sehingga tiap aturan
    // menuntut !important walau tidak ada yang menyainginya.
    const isi = konten();
    expect(isi).not.toContain("function gayaTemaSipp");
    expect(isi).not.toContain("PENANDA_TEMA_SIPP");
    expect(gaya()).toContain('html[data-aleta-tema-sipp="gelap"]');
  });

  it("mematikannya tidak meninggalkan satu pun gaya yang menempel", () => {
    // Sifat terpenting lapisan ini: SIPP bukan milik kita, dan mencabutnya
    // harus mengembalikan halaman persis seperti semula. Karena seluruh
    // gayanya bergantung pada SATU penanda di elemen html, mencabut penanda
    // itu sudah cukup - tidak ada gaya yang perlu dicari dan dibuang.
    const isi = konten();
    const potong = isi.slice(
      isi.indexOf("function terapkanTemaSipp"),
      isi.indexOf("async function muatTema")
    );
    expect(potong).toContain('akar.removeAttribute("data-aleta-tema-sipp")');
    expect(potong).not.toContain("createElement");
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
    // Kotak ringkasan itu DICABUT: ia membaca pilihan bawaan mesin
    // sementara "Pejabat yang menetapkan" di bawahnya membiarkan pilihan
    // itu diganti - sehingga ringkasannya dapat menyebut nama yang BUKAN
    // yang akan ditulis. Keterangan penetap kini ada pada tiap barisnya
    // dan ikut berubah saat pejabatnya diganti.
    // Komentar dibuang lebih dahulu: kalimat yang menerangkan pencabutan
    // kotak itu menyebut namanya, sehingga penjaga yang melarangnya justru
    // tersandung pada penjelasan pelarangannya sendiri.
    const tanpaKomentar = konten()
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((baris) => !baris.trim().startsWith("//"))
      .join("\n");
    expect(tanpaKomentar).not.toContain("Akan tercatat di SIPP atas nama");
    expect(konten()).toContain("Pejabat yang menetapkan");
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

  it("lencana dan layar penuh dikecualikan", () => {
    // Keduanya memang tidak setinggi isinya, dan menjepitnya akan melawan
    // ukuran yang justru sedang diminta - lencana yang dijepit menjadi logo
    // melayang yang tiba-tiba memanjang.
    const isi = konten();
    const potong = isi.slice(isi.indexOf("function jepitTinggiKeRuangTersisa"));
    expect(potong.slice(0, 900)).toContain("classList.contains(KELAS_LENCANA)");
    expect(potong.slice(0, 900)).toContain('classList.contains("aleta-panel-penuh")');
  });

  it("tingginya separuh layar, dan tidak pernah lebih dari dua pertiga", () => {
    // Sepertiga layar pas ketika panel hanya memuat keterangan pendek. Sejak
    // ia memuat usulan pertimbangan hukum 8.000 aksara beserta kotak
    // suntingnya, sepertiga berarti menggulung terus-menerus untuk membaca
    // satu naskah yang justru harus diperiksa sebagai satu kesatuan.
    //
    // Atapnya tetap ada, dan sebabnya tidak berubah: di bawah panel ada
    // borang yang sedang diisi orang.
    const isi = konten();
    const potong = isi.slice(isi.indexOf("function jepitTinggiKeRuangTersisa"));
    expect(potong.slice(0, 2600)).toContain("Math.round(window.innerHeight / 2)");
    expect(potong.slice(0, 2600)).toContain("Math.round((window.innerHeight * 2) / 3)");
    expect(isi).not.toContain("window.innerHeight * 0.6");
  });
});

describe("kepala panel: akun SIPP, layar penuh, dan lencana", () => {
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

  it("lencana dibentangkan dengan menekan lencananya", () => {
    // Dalam bentuk lencana tidak ada satu pun tombol panel yang terlihat,
    // jadi pendengarnya dipasang pada lencananya sendiri.
    const isi = konten();
    expect(isi).toContain("function pasangLencana(panel) {");
    expect(isi).toContain('lencana.addEventListener("click", bentangkan);');
    expect(isi).toContain("if (!panel.classList.contains(KELAS_LENCANA)) return;");
    // Logonya berkas ekstensi, bukan huruf yang digambar CSS: yang melayang
    // di atas halaman aplikasi lain harus dikenali dalam sekejap.
    expect(isi).toContain('chrome.runtime.getURL("ikon/aleta-32.png")');
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
    expect(potong).toContain('temaSekarang !== "gelap"');
    expect(potong).toContain('akar.setAttribute("data-aleta-tema-sipp", "gelap")');
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
    // Diturunkan sekali lagi dari #f4f6f4: beda empat persen dari putih murni
    // tidak dikenali mata sebagai warna - yang dirasakannya tetap kotak putih
    // menyala di sebelah halaman SIPP yang juga putih.
    // Diturunkan lagi dan dipindah keluarga: batu hangat, bukan abu kehijauan -
    // lihat catatan panjang di panel.css. Abu kehijauan sekeluarga dengan SIPP.
    expect(potong).toContain("--aleta-latar: #ece9e3;");
    expect(potong).not.toContain("--aleta-latar: #ffffff;");
    expect(potong).not.toContain("--aleta-latar: #f4f6f4;");
    expect(potong).not.toContain("--aleta-latar: #e9ede9;");
  });

  it("kartu di dalam panel terang tetap terbaca naik ke depan", () => {
    // Latar-naik dibuat LEBIH TERANG daripada latarnya, kebalikan tema gelap.
    // Tanpa itu kartunya tenggelam alih-alih menonjol.
    const berkas = gaya();
    const potong = berkas.slice(berkas.indexOf('.aleta-panel[data-tema="terang"]'));
    expect(potong).toContain("--aleta-latar-naik: #f6f4ef;");
  });
});

describe("Kerjakan paling atas, sisanya terlipat", () => {
  it("kelompok Kerjakan digambar sebelum Berkas", () => {
    // Panel ini dibuka orang yang sedang MENGERJAKAN perkara. Sebelumnya
    // Kerjakan duduk paling bawah di balik tiga kelompok keterangan.
    const isi = konten();
    expect(isi.indexOf('kelompok("Penetapan", "kerjakan"')).toBeLessThan(
      isi.indexOf('kelompok("Berkas", "berkas"')
    );
  });

  it("hanya Penetapan yang terbuka", () => {
    const isi = konten();
    expect(isi).toContain('kelompok("Penetapan", "kerjakan", false)');
    for (const tertutup of [
      'kelompok("Berkas", "berkas", true)',
      'kelompok("Perkara", "perkara", true)',
    ]) {
      expect(isi, tertutup).toContain(tertutup);
    }
  });

  it("Putusan ikut terbuka bila blangko Putusan Akhir sedang di layar", () => {
    // Satu-satunya kelompok yang lipatannya bergantung keadaan, dan sebabnya
    // sempit: Putusan otomatis duduk di dalamnya. Yang sedang berdiri di
    // layar Putusan Akhir tidak sedang menunggu diminta menekan satu lipatan
    // lagi untuk menemukan alat yang dibukanya justru untuk itu.
    //
    // Di halaman lain ia tetap terlipat seperti dua kelompok keterangan yang
    // lain - tidak ada yang berubah bagi yang hanya membaca perkara.
    const isi = konten();
    expect(isi).toContain('kelompok("Putusan", "putusanKel", !adaBorangPutusan)');
    expect(isi).toContain('const adaBorangPutusan = Boolean(document.querySelector("#frm_putusan"))');
  });
});

describe("posisi panel dapat dikembalikan dari popup Chrome", () => {
  it("popup menghapus kunci posisi KEEMPAT panel, dan tidak lebih", () => {
    // Saklar, tema, dan lipatan menu tidak ikut terhapus: yang hilang dari
    // layar adalah letaknya, dan membuang pengaturan lain sekalian berarti
    // menghukum petugas atas kesalahan yang tidak ia perbuat.
    //
    // Dahulu hanya "posisiPanel" - kunci panel SIPP - sehingga panel ABT dan
    // panel portal ALETA yang terciut lalu terseret ke tepi tidak dapat
    // dikembalikan dari mana pun: tidak dari panelnya (tombolnya ikut
    // menciut), tidak dari sini. 1.155.0 menjangkau keempatnya.
    const isi = popup();
    expect(isi).toContain(".remove(KUNCI_LETAK_PANEL)");
    for (const kunci of ["posisiPanel", "posisiPanelAbt", "posisiPanelAbtMassal", "posisiPanelAleta"]) {
      expect(isi, kunci).toContain(`"${kunci}"`);
    }
    // Tema dan saklar tetap aman.
    expect(isi).not.toContain('.remove("temaPanel")');
    expect(isi).not.toContain('.remove("aktif")');
  });

  it("skrip konten mendengarkan penghapusan itu", () => {
    // Panel yang tergeser keluar layar tidak dapat dikembalikan dari tombol di
    // dalam panel itu sendiri - tombolnya ikut hilang bersama panelnya.
    const isi = konten();
    expect(isi).toContain("perubahan[KUNCI_POSISI].newValue === undefined");
    expect(isi).toContain("kembalikanBawaan(panel);");
  });
});

describe("penanda halaman SIPP dirombak", () => {
  /**
   * Penanda lama menampilkan "5 dokumen e-Court", "1 nomor bermasalah", dan
   * hitungan tenggat mendesak. Ketiganya SUDAH ada di panel ALETA yang terbuka
   * persis di sebelahnya - jadi penandanya tidak menambah apa pun, ia
   * mengulang. Dan ia mengulang di halaman milik orang lain.
   *
   * Aturannya sekarang dua, keduanya harus terpenuhi: tidak ada di halaman
   * SIPP itu, DAN mengubah cara perkara ditangani hari ini.
   */
  it("ghaib ditandai - SIPP menyimpannya tetapi tidak menampilkannya", () => {
    const isi = konten();
    expect(isi).toContain('labelTanda("PIHAK GHAIB", "merah"');
    expect(isi).toContain("if (p.ghaib === true)");
  });

  it("ghaib null TIDAK dianggap tidak-ghaib", () => {
    // null berarti belum dapat dinilai - tidak satu pun sumbernya terbaca.
    // Menyamakannya dengan false berarti menyatakan "tidak ghaib" atas perkara
    // yang sebenarnya belum diperiksa.
    expect(konten()).toContain("p.ghaib === true");
    expect(konten()).not.toContain("if (p.ghaib)");
  });

  it("perlu izin atasan ditandai beserta instansinya", () => {
    const isi = konten();
    expect(isi).toContain("if (p.perluIzinAtasan)");
    expect(isi).toContain("IZIN ATASAN —");
  });

  it("mafqud ditulis sebagai DUGAAN, bukan keterangan resmi", () => {
    // Mafqud tidak punya kolomnya sendiri di SIPP - hanya pencirinya. Penanda
    // yang menyatakan lebih daripada yang diketahui akan dipercaya lebih
    // daripada yang pantas.
    const isi = konten();
    expect(isi).toContain('labelTanda("diduga mafqud"');
    expect(isi).toContain("Ini penanda untuk diperiksa, bukan keterangan resmi.");
  });

  it("hitungan yang sudah ada di panel dibuang", () => {
    // Keterangan, bukan tindakan - dan yang diabaikan pada hari ketiga akan
    // menulari penanda lain ikut diabaikan.
    const isi = konten();
    const potong = isi.slice(isi.indexOf("function tandaiJudul"), isi.indexOf("function tandaiPihak"));
    expect(potong).not.toContain("dokumen e-Court`");
    expect(potong).not.toContain("nomor bermasalah");
    expect(potong).not.toContain("tenggat mendesak");
  });

  it("tenggat e-Court yang LEWAT tetap ditandai", () => {
    // Batas unggah ada di e-Court, bukan di SIPP, dan yang lewat berarti pihak
    // kehilangan kesempatan menanggapi.
    expect(konten()).toContain("tenggat e-Court lewat");
  });

  it("penandanya dikirim bot, bukan ditebak ekstensi", () => {
    const layanan = readFileSync(
      path.resolve(process.cwd(), "../aleta_bot/services/sippKonteksService.js"),
      "utf8"
    );
    expect(layanan).toContain("sippTahapanService.penandaPerkara(perkaraId)");
    expect(layanan).toContain("penanda,");
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
