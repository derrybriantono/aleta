import { readFileSync } from "node:fs";
import path from "node:path";

import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

/** Layanan bot dijalankan langsung - keduanya CommonJS. */
const require_ = createRequire(import.meta.url);

/**
 * ============================================================================
 * TEMA HALAMAN ABT, LENCANA, DAN TIGA JALUR SIMPAN
 * ============================================================================
 *
 * Ketiganya lahir dari satu laporan yang sama: panel ALETA di halaman ABT
 * bekerja, tetapi halaman di belakangnya tidak. Temanya tidak dapat
 * dimatikan, warnanya membuat garis dan tulisan lenyap, dan tiga variabel
 * menolak disunting dengan sebab yang benar tetapi tanpa jalan keluar.
 *
 * Yang diuji di sini SIFAT-nya, bukan warnanya satu per satu: bahwa aturannya
 * ada, bahwa jangkarnya benar, dan bahwa jalur simpannya tidak tertukar.
 * Kontras warnanya diukur terpisah, dengan hitungan luminansi.
 */
const akar = (berkas: string) => path.resolve(process.cwd(), "..", "ekstensi-sipp", berkas);
const baca = (berkas: string) => readFileSync(akar(berkas), "utf8");

/** Membuang komentar CSS supaya asersi tidak tertipu oleh catatan sendiri. */
function gayaTanpaCatatan(isi: string) {
  return isi.replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("tema halaman ABT dapat dimatikan", () => {
  it("tombol tema menyentuh HALAMAN, bukan panel saja", () => {
    // Sebelumnya ia hanya membalik data-tema pada panel selebar telapak
    // tangan, sementara halaman di belakangnya tetap gelap. Itulah sebabnya
    // light mode terbaca sebagai tidak berfungsi.
    const isi = baca("panel-alat.js");
    expect(isi).toContain("function alatTerapkanTemaHalaman(");
    expect(isi).toContain("if (pilihan.temaHalaman) alatTerapkanTemaHalaman(baru);");
  });

  it("terang berarti penandanya DILEPAS - bukan diganti nilai lain", () => {
    // ABT harus kembali ke tampilan bawaannya sendiri, bukan ke tema terang
    // buatan ALETA. Melepas penandanya membuat seluruh aturan gelap berhenti
    // berlaku sekaligus, tanpa satu pun aturan tandingan.
    const isi = baca("panel-alat.js");
    const potong = isi.slice(isi.indexOf("function alatTerapkanTemaHalaman"));
    expect(potong).toContain('akar.removeAttribute("data-aleta-tema-sipp")');
  });

  it("panel ABT menyalakannya, panel SIPP tidak", () => {
    // Halaman SIPP sudah punya tombol temanya sendiri di konten.js. Dua
    // tombol yang mengurus penanda yang sama akan saling menimpa.
    expect(baca("abt.js")).toContain("temaHalaman: true,");
  });

  it("salinan sinkron ikut ditulis - itu yang menghapus kelebatnya", () => {
    // chrome.storage hanya asinkron; halaman berikutnya akan lahir dengan
    // tema lama lalu berubah di depan mata. localStorage dibaca tema-awal.js
    // pada document_start, sebelum satu piksel digambar.
    const isi = baca("panel-alat.js");
    expect(isi).toContain('KUNCI_SALINAN_TEMA_HALAMAN = "aleta-tema-sipp"');
    expect(isi).toContain("window.localStorage.setItem(KUNCI_SALINAN_TEMA_HALAMAN");
  });

  it("kuncinya SAMA dengan SIPP - satu tema untuk kedua halaman", () => {
    const awal = baca("tema-awal.js");
    const alat = baca("panel-alat.js");
    const kunciAwal = awal.match(/KUNCI_SALINAN\s*=\s*"([^"]+)"/);
    const kunciAlat = alat.match(/KUNCI_SALINAN_TEMA_HALAMAN\s*=\s*"([^"]+)"/);
    expect(kunciAwal?.[1]).toBe(kunciAlat?.[1]);
  });
});

describe("peta warna ABT", () => {
  const gaya = () => gayaTanpaCatatan(baca("panel.css"));

  it("halaman ABT ditandai pada document_start, bukan sesudah panel muncul", () => {
    // Kalau penandanya menyusul, halaman digambar dulu tanpa peta warnanya -
    // dan itu justru kelebat yang paling menyakitkan.
    const isi = baca("tema-awal.js");
    expect(isi).toContain('window.location.pathname.indexOf("/aps_badilag/") === 0');
    expect(isi).toContain('setAttribute("data-aleta-halaman", "abt")');
  });

  it("aturannya berjangkar pada penanda halaman ABT", () => {
    // Tanpa jangkar itu, aturan ABT ikut berlaku di halaman SIPP - dan
    // sebaliknya. Keduanya berbagi satu berkas gaya.
    const isi = gaya();
    const jumlah = isi.split('data-aleta-halaman="abt"').length - 1;
    expect(jumlah).toBeGreaterThan(10);
  });

  it("warna sel yang ditulis INLINE oleh ABT ikut diatur", () => {
    // Dibaca dari views/abt/view.php: tiap sel ditulis style="color:green" /
    // blue / red / black. Gaya inline mengalahkan berkas gaya mana pun
    // kecuali yang ber-!important, dan pemilihnya harus membaca atribut
    // style - ABT tidak memberi kelas apa pun pada sel-sel itu.
    const isi = gaya();
    for (const warna of ["green", "blue", "red", "black"]) {
      expect(isi, warna).toContain(`[style*="color:${warna}"]`);
    }
  });

  it("elemen ABT yang paling menentukan punya aturannya", () => {
    const isi = gaya();
    for (const pemilih of ["#wrapper", "#content", ".about", "#header", "#cssmenu", ".w3l_header"]) {
      expect(isi, pemilih).toContain(pemilih);
    }
  });

  it("blok kuning 4020 tidak dibiarkan menyala", () => {
    // <mark> bawaan peramban berlatar kuning terang. Di atas halaman gelap ia
    // satu-satunya benda yang menyilaukan.
    expect(gaya()).toContain('data-aleta-halaman="abt"][data-aleta-tema-sipp="gelap"] mark');
  });
});

describe("lencana - panel yang diciutkan", () => {
  it("kepalanya IKUT tersembunyi, bukan disisakan", () => {
    // Yang dulu tersisa: kepala selebar panel semula, kosong, dengan deretan
    // tombol di kanannya. Di layar itu terbaca sebagai panel yang rusak.
    const isi = gayaTanpaCatatan(baca("panel.css"));
    expect(isi).toContain(".aleta-panel-lencana > *:not(.aleta-lencana)");
    expect(isi).toContain("display: none !important;");
  });

  it("dapat digeser lewat lencananya sendiri", () => {
    // Kepalanya tidak dapat dipakai sebagai pegangan saat menciut - ia yang
    // disembunyikan.
    //
    // Yang dituntut SIFATNYA, bukan bentuk pemanggilannya. Sampai 1.157.1
    // tuntutan ini berbunyi `alatPasangGeser(panel, lencana, kunci)` - yaitu
    // pendaftaran KEDUA. Pendaftaran itu ternyata mubazir: alatPasangGeser
    // memasang seluruh pendengarnya pada `panel`, bukan pada argumen keduanya,
    // dan argumen itu hanya dipakai sebagai pagar `kepala.contains(...)` yang
    // sudah korslet sendiri begitu panel menyandang KELAS_LENCANA. Mendaftar
    // dua kali karena itu hanya menggandakan logika geser dan tulisan posisi.
    //
    // Yang menjaga kemampuannya kini pagar itu sendiri.
    const isi = baca("panel-alat.js");
    expect(isi).toContain(
      "if (!panel.classList.contains(KELAS_LENCANA) && !kepala.contains(peristiwa.target)) return;"
    );
    expect(isi).not.toContain("alatPasangGeser(panel, lencana, kunci);");
  });

  it("klik membedakan diri dari tarikan lewat JARAK, bukan waktu", () => {
    // Tanpa pembeda, tiap tarikan berakhir dengan panel yang terbentang
    // kembali - sebab tiap tarikan diakhiri satu pointerup di atas lencananya.
    const isi = baca("panel-alat.js");
    expect(isi).toContain('panel.dataset.baruDigeser = "1";');
    expect(isi).toContain('if (panel.dataset.baruDigeser === "1")');
  });

  it("satu klik dan klik ganda keduanya membentangkan", () => {
    // Pendengarnya pada PANEL, bukan pada lencana - dan itu perbaikan 1.158.0,
    // bukan kelalaian.
    //
    // alatPasangGeser menangkap penunjuk pada panel di setiap pointerdown, dan
    // selama tangkapan itu berlaku peramban membelokkan click serta dblclick ke
    // elemen PENANGKAP. Lencana hanya ANAK panel, jadi dipasang di sana
    // pendengar ini tidak pernah berjalan sekali pun: panel yang diciutkan di
    // halaman ALETA dan ABT tidak dapat dibuka lagi, tanpa satu galat pun
    // tercatat. Terukur dengan klik tetikus sungguhan - sebelum diperbaiki
    // pendengarnya berjalan 0 kali, sesudahnya panel terbentang dan lebarnya
    // pulih 324 piksel.
    const isi = baca("panel-alat.js");
    expect(isi).toContain('panel.addEventListener("click", bentangkan)');
    expect(isi).toContain('panel.addEventListener("dblclick"');
    expect(isi).not.toContain('lencana.addEventListener("click", bentangkan)');
  });

  it("keadaan terciut ikut dipulihkan saat halaman dibuka lagi", () => {
    const isi = baca("panel-alat.js");
    expect(isi).toContain("if (posisiTersimpan && posisiTersimpan.lencana)");
  });

  it("logonya dari berkas ekstensi, bukan huruf yang digambar CSS", () => {
    const isi = baca("panel-alat.js");
    expect(isi).toContain('chrome.runtime.getURL("ikon/aleta-32.png")');
  });
});

describe("penanda tiga berkas di samping CETAK", () => {
  it("hanya digambar ketika saklarnya menyala", () => {
    const isi = baca("abt.js");
    expect(isi).toContain("if (!cetakTigaMenyala) {");
    expect(isi).toContain("if (tanda) tanda.remove();");
  });

  it("disisipkan DI SAMPING tautan, bukan di dalamnya", () => {
    // Menyisipkan anak ke dalam tautan CETAK membuat tekanan pada penandanya
    // ikut mencetak.
    const isi = baca("abt.js");
    expect(isi).toContain("induk.insertBefore(tanda, tautan.nextSibling)");
  });

  it("tidak dapat ditekan", () => {
    // Tekanan yang jatuh sedikit ke kanan dari CETAK akan mengenai penandanya
    // dan tidak terjadi apa-apa - yang terbaca sebagai CETAK yang kadang mati.
    const isi = gayaTanpaCatatan(baca("panel.css"));
    const potong = isi.slice(isi.indexOf(".aleta-cetak-tiga {"));
    expect(potong.slice(0, 700)).toContain("pointer-events: none;");
  });

  it("berubah seketika saat saklarnya diubah dari popup", () => {
    const isi = baca("abt.js");
    // Sejak 1.145.0 ada DUA pendengar onChanged di abt.js - saklar sunting
    // langsung dan saklar cetak tiga berkas. Yang dijaga di sini pendengar
    // yang memang mengurus penanda cetak, bukan yang kebetulan pertama.
    const awal = isi.indexOf("KUNCI_CETAK_TIGA");
    const potong = isi.slice(isi.indexOf("chrome.storage.onChanged.addListener", awal));
    expect(potong.slice(0, 600)).toContain("segarkanPenandaCetak();");
  });
});

describe("tiga jalur simpan yang tidak boleh tertukar", () => {
  const abt = () => baca("abt.js");

  it("posita lewat SIPP, saksi lewat rute tanya-jawab ABT, sisanya edit_data", () => {
    // Ketiganya tampak sama di layar - satu baris teks yang dirapikan -
    // tetapi tersimpan di tiga tempat yang sama sekali berbeda.
    const isi = abt();
    expect(isi).toContain("if (r.kode === VAR_POSITA) {");
    expect(isi).toContain("hasil = await mintaPositaRapi(jatiDiri.perkaraId, false);");
    expect(isi).toContain("hasil = await simpanKeteranganSaksi(r.kode);");
    expect(isi).toContain("hasil = await simpanVariabel(r.kode, r.sesudah, jatiDiri);");
  });

  it("keterangan saksi diambil UTUH lebih dulu - pertanyaannya tidak terlihat di layar", () => {
    // list_keterangan menggambar jawabannya saja, dan rute simpannya
    // MENGHAPUS seluruh baris milik saksi itu lebih dulu. Mengirim balik teks
    // yang tergambar akan menghapus seluruh pertanyaan.
    const isi = abt();
    expect(isi).toContain("async function ambilTanyaJawab(");
    expect(isi).toContain("var\\s+ajax_data");
    const potong = isi.slice(isi.indexOf("async function simpanKeteranganSaksi"));
    expect(potong.indexOf("await ambilTanyaJawab(kode)")).toBeLessThan(
      potong.indexOf('badan.set("data"')
    );
    // Pertanyaannya diteruskan apa adanya.
    expect(potong).toContain("tanya: String((satu && satu.pertanyaan)");
  });

  it("jumlah barisnya diperiksa dari ABT sendiri sesudah menyimpan", () => {
    // Rute simpannya menghapus lalu menulis ulang, dan pagarnya sidang_id -
    // sementara yang digambar variabel 2021 keterangan dari SELURUH sidang.
    const potong = abt().slice(abt().indexOf("async function simpanKeteranganSaksi"));
    expect(potong).toContain("const harapan = sebelum - dibuang;");
    expect(potong).toContain("Periksa apakah saksi ini punya keterangan di sidang lain.");
  });

  it("jawaban 200 dari ABT tidak langsung dianggap berhasil", () => {
    const potong = abt().slice(abt().indexOf("async function simpanKeteranganSaksi"));
    expect(potong).toContain("Tanya\\s*Jawab\\s*Disimpan");
  });

  it("ekstensi tidak menyentuh basis data SIPP - ia lewat portal", () => {
    const isi = abt();
    expect(isi).toContain('ALETA_API_POSITA = "/aleta/api/aleta-bot/sipp/posita"');
    // Teksnya TIDAK dikirim dari peramban - hanya perkaranya. Rute yang
    // menerima teks posita adalah rute yang dapat dititipi posita karangan.
    expect(isi).toContain('body: JSON.stringify({ perkaraId, ujiKering: ujiKering === true })');
    // Pratinjaunya pun dari server, sehingga yang tampil persis yang ditulis.
    expect(isi).toContain("await mintaPositaRapi(jatiDiri.perkaraId, true)");
    expect(isi).not.toContain("UPDATE perkara");
  });
});

describe("pagar tulisan posita ke SIPP", () => {
  const layanan = () =>
    readFileSync(
      path.resolve(process.cwd(), "..", "aleta_bot", "services", "sippPositaService.js"),
      "utf8"
    );

  it("isinya tidak boleh berubah satu huruf pun", () => {
    // Perapian hanya MENYISIPKAN PEMISAH. Karena itu dapat diperiksa secara
    // mutlak: buang seluruh ruang kosong dari kedua teks, lalu bandingkan.
    const isi = layanan();
    expect(isi).toContain("function tanpaRuang(");
    expect(isi).toContain("if (tanpaRuang(lama) !== tanpaRuang(baru))");
  });

  it("posita yang masih kosong TIDAK diisi lewat jalur ini", () => {
    // Mengisi bukan pekerjaan perapian. Menolak di sini menutup jalan
    // seseorang menuliskan posita baru lewat tombol bernama "rapikan".
    expect(layanan()).toContain("Posita di SIPP masih kosong");
  });

  it("perkara_id dikirim terikat, bukan disambung ke dalam kueri", () => {
    const isi = layanan();
    expect(isi).toContain('"UPDATE perkara SET posita = ? WHERE perkara_id = ? LIMIT 1"');
    expect(isi).toContain("Number.isInteger(id)");
  });

  it("tepat satu baris yang boleh tersentuh", () => {
    expect(layanan()).toContain("if (tersentuh !== 1)");
  });

  it("posita lama dikembalikan supaya ada yang dapat dipulihkan", () => {
    expect(layanan()).toContain("sebelum: lama");
  });
});

describe("dua cacat yang dilaporkan dari layar", () => {
  const layanan = () =>
    readFileSync(
      path.resolve(process.cwd(), "..", "aleta_bot", "services", "abtUsulanService.js"),
      "utf8"
    );

  it("sumber 5227 berpasangan - saksi 1 DAN saksi 2, per alasan", () => {
    // Yang dilaporkan: kartu 5227 hanya memperlihatkan Saksi 1, berulang.
    // Sebabnya slice(0, 4) atas [...b1, ...b2] - b1 selalu di depan dan
    // biasanya sudah menyumbang empat kalimat sendiri, sehingga b2 tidak
    // pernah tercapai. Labelnya pun salah: b1.includes(kalimat) menandai
    // kalimat bersamaan bunyi sebagai milik saksi 1.
    const isi = layanan();
    expect(isi).toContain("function sumberBerpasangan(");
    expect(isi).toContain("sumberBerpasangan(ciri, b1, b2)");
    expect(isi).not.toContain("b1.includes(kalimat) ? 1 : 2");
  });

  it("perapian posita tidak lagi dikerjakan di peramban", () => {
    // innerText sel tabel BUKAN isi kolom posita - baris ganda dirapatkan,
    // entitas diterjemahkan, tag dibuang. Merapikannya di peramban lalu
    // membandingkannya dengan kolom di basis data membandingkan dua hal yang
    // berbeda sejak awal, dan itulah penolakan yang dilaporkan.
    const isi = baca("abt.js");
    expect(isi).not.toContain("function rapikanPosita(teks) {");
    expect(isi).toContain("rapikanPosita DIPINDAHKAN ke");
  });

  it("titik antar anak butir ditangkap dan dituliskan kembali", () => {
    // Pola lamanya memakai `\\.?` yang MEMAKAN titik tanpa pernah
    // menuliskannya kembali. Pada posita PA Donggala, titik sesudah
    // "Tergugat" pada "...teman-teman Tergugat.b. Setiap kali..." lenyap.
    const isi = readFileSync(
      path.resolve(process.cwd(), "..", "aleta_bot", "services", "sippPositaService.js"),
      "utf8"
    );
    // Penanda butir kini harus BERDIRI SENDIRI - didahului tanda baca atau
    // spasi, tidak boleh didahului huruf. Tanpa syarat itu, "Usia 5 tahun."
    // terpecah menjadi "tahu" dan butir baru "n.".
    expect(isi).toContain('const SEBELUM_BUTIR = ".;:,)";');
    // Tandanya ikut tertangkap ke dalam ${huruf} - "a." maupun "a)" - dan
    // dituliskan kembali apa adanya. Menuliskan titik di sini akan mengubah
    // "a)" menjadi "a.", yaitu mengganti bentuk penomoran yang dipilih
    // penyusun gugatan.
    expect(isi).toContain("${awal}<br>   ${huruf} ");
  });

  it("pemisahnya <br>, sebab RTF mengabaikan ganti baris", () => {
    // cleanHtmlTagSpecial menerjemahkan <br> dan </p> menjadi \par, dan
    // TIDAK menerjemahkan ganti baris. Diukur: 6.269 dari 8.097 posita di
    // PA Donggala memuat </p> - itulah yang tercetak rapi selama ini.
    const isi = readFileSync(
      path.resolve(process.cwd(), "..", "aleta_bot", "services", "sippPositaService.js"),
      "utf8"
    );
    expect(isi).toContain('/\\n+/g, "<br>"');
    // <br> ikut dibuang pembanding isi - ia pemisah yang boleh disisipkan.
    expect(isi).toContain("<br" + String.fromCharCode(92) + "s*");
  });

  it("uji kering tidak menulis apa pun", () => {
    const isi = readFileSync(
      path.resolve(process.cwd(), "..", "aleta_bot", "services", "sippPositaService.js"),
      "utf8"
    );
    const potong = isi.slice(isi.indexOf("if (ujiKering)"));
    // Baris UPDATE berada SESUDAH keluarnya uji kering.
    expect(isi.indexOf("if (ujiKering)")).toBeLessThan(isi.indexOf("UPDATE perkara SET posita"));
    expect(potong.slice(0, 200)).toContain("berubah: true");
  });
});

describe("kerusakan posita yang sudah terlanjur tersimpan", () => {
  const layanan = require_(
    path.resolve(process.cwd(), "..", "aleta_bot", "services", "sippPositaService.js")
  ) as {
    rapikanTeksPosita: (t: string) => string;
    perbaikiPecahanPalsu: (t: string) => { teks: string; jumlah: number };
    tanpaRuang: (t: string) => string;
  };

  // Apa adanya dari posita 510/Pdt.G/2026/PA.Dgl sesudah versi lama menulis.
  const RUSAK =
    "<div>3. Bahwa anak bernama Mikhayla, Usia 5 tahu\n   n. Saat ini ikut Penggugat;</div>\n" +
    "<div>4. Bahwa tidak harmonis disebabkan karena\n   a. Tergugat mabuk.\n   b. Tergugat memukul;</div>\n" +
    "<div>5. Bahwa pisah rumah kurang lebih 6 bula\n   n. Sejak itu tidak terlaksana;</div>";

  it("kata yang terpecah disambung kembali", () => {
    // "bulan" dan "tahun" terpotong, huruf terakhirnya berdiri sebagai butir.
    // Pagar isi tidak menahannya - tidak ada huruf yang hilang, hanya
    // berpindah baris.
    expect(layanan.perbaikiPecahanPalsu(RUSAK).jumlah).toBe(2);
    const rapi = layanan.rapikanTeksPosita(RUSAK);
    expect(rapi).toContain("Usia 5 tahun. Saat ini");
    expect(rapi).toContain("6 bulan. Sejak itu");
  });

  it("butir a dan b yang SUNGGUHAN tidak ikut disambung", () => {
    // Sesudah terpecah, penanda sungguhan dan pecahan palsu tampak persis
    // sama. Pembedanya hurufnya: penanda butir tidak pernah melewati f.
    const rapi = layanan.rapikanTeksPosita(RUSAK);
    // Pemisahnya <p> sejak 1.123.0; lekukan tiga spasi anak butirnya tetap.
    expect(rapi).toContain("<p>   a. Tergugat mabuk.");
    expect(rapi).toContain("<p>   b. Tergugat memukul;");
  });

  it("<div> diubah jadi <p> - ABT dan SIPP membuang <div> tanpa jejak", () => {
    // cleanHtmlTagSpecial menerjemahkan </p> menjadi \par lalu memanggil
    // filter_var(FILTER_SANITIZE_STRING) yang menyapu sisanya. <div> tidak
    // pernah diterjemahkan - ia hanya lenyap, tanpa pemisah. <br> pun begitu
    // di SIPP; karena itu pemisah akhirnya <p>, yang dimengerti keduanya.
    const rapi = layanan.rapikanTeksPosita(RUSAK);
    expect(rapi).not.toContain("<div");
    expect(rapi).not.toContain("<br>");
    expect(rapi).toContain("</p>");
  });

  it("tidak ada paragraf kosong, dan lekukan anak butir utuh", () => {
    const rapi = layanan.rapikanTeksPosita(RUSAK);
    const baris = rapi
      .split("</p>")
      // Ruang di depan dipangkas: tiap potongan berawalan pembatas kata
      // kendali - satu ganti baris - sebelum <p>-nya.
      .map((x) => x.replace(/^\s*<p[^>]*>/, ""))
      .filter((x) => x.length > 0);
    expect(baris.filter((x) => !x.trim()).length).toBe(0);
    expect(baris.some((x) => x.startsWith("   a. "))).toBe(true);
  });

  it("isi tetap utuh sesudah diperbaiki DAN dirapikan", () => {
    const rapi = layanan.rapikanTeksPosita(RUSAK);
    expect(layanan.tanpaRuang(rapi)).toBe(layanan.tanpaRuang(RUSAK));
  });

  it("posita ber-<p> tidak mendapat baris kosong tambahan", () => {
    // 6.269 dari 8.097 posita memakai <p>. Ganti baris di antara </p> dan
    // <p> berikutnya akan menjadi <br>, dan keduanya menjadi \par.
    const teks = "<p>1. Bahwa satu.</p>\n<p>2. Bahwa dua.</p>";
    expect(layanan.rapikanTeksPosita(teks)).toBe(
      "<p>1. Bahwa satu.</p>\n<p>2. Bahwa dua.</p>"
    );
  });
});
