/**
 * ============================================================================
 * PETA PERKARA - PETANYA ADA, KOORDINATNYA DARI LUAR SIPP
 * ============================================================================
 *
 * Satker meminta peta perkara yang "dinamis, keren, efisien namun tidak
 * membuat lag dan error", dan kemudian meminta peta sungguhan dengan titik di
 * tiap desa. Keduanya dikerjakan - tetapi koordinatnya TIDAK boleh datang dari
 * SIPP, dan itulah yang dijaga berkas ini.
 *
 * Peta titik sempat dibangun dari koordinat `kode_pos`. Dua pengukuran
 * membatalkan SUMBERNYA - bukan petanya:
 *
 *   1. KOLOMNYA TERTUKAR pada berkas asalnya - `longitude` memuat lintang.
 *
 *   2. DAN SESUDAH DITUKAR PUN SALAH, dengan sebab yang jauh lebih mematikan:
 *      2.023 baris Sulawesi Tengah, 1.917 nama desa - dan hanya SEMBILAN titik
 *      koordinat unik. Satu per kabupaten, disalin ke tiap desa di bawahnya.
 *      Sebagian titik itu pun menunjuk pulau lain:
 *
 *          Banggai          -10,2065 / 120,3529   Laut Sawu, dekat Sumba
 *          Morowali Utara    -4,5536 / 136,0339   PAPUA
 *          Dolo             -10,8471 / 122,8647   selatan Sumba
 *          Marawola (Sigi)    1,1615 / 124,4393   dekat Manado
 *
 * Donggala sendiri benar, dan justru itu yang membuatnya berbahaya: petanya
 * tampak masuk akal bagi yang melihat Donggala, lalu diam-diam salah untuk
 * seluruh kabupaten lain. Peta yang salah lebih buruk daripada tidak ada peta -
 * tidak ada yang memeriksa peta.
 *
 * Sejak 2.24.0 titiknya datang dari OpenStreetMap, dijodohkan sekali di luar
 * portal dan disimpan berkunci kode BPS. Sebaran BERJENJANG dari kode wilayah
 * resmi tetap ada di sebelahnya, dan tidak bergantung pada peta sama sekali.
 *
 * ============================================================================
 * DUA ERA PENGISIAN DATA, SATU NAMA
 * ============================================================================
 *
 *     kode angka   11.213 baris   "72.10.01"
 *     teks nama       583 baris   "Kab. Sigi", "Kota Palu"
 *
 * Dibiarkan apa adanya, "Kabupaten Donggala" muncul dua kali pada daftar yang
 * sama - 1.047 dari baris berkode dan 122 lagi sebagai "(kode Kab. Donggala)".
 * Pembacanya melihat dua tempat padahal tempatnya satu.
 *
 * ============================================================================
 * SATU KUERI, BUKAN TIGA
 * ============================================================================
 *
 *     tiga kueri agregat     9,6 detik (kecamatan), 12,4 detik (kabupaten)
 *     satu kueri baris       4,8 detik seluruh basis data, 0,5 detik setahun
 *
 * Ketiganya dahulu menyusun ulang tabel turunan "satu pihak per perkara" yang
 * sama persis - dan itu saja 2,4 detik tiap kali.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const layanan = baca("aleta_bot/services/petaPerkaraService.js");
const gerbang = baca("aleta_bot/routes/internalGatewayRoutes.js");
const klien = baca("manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts");
const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/peta-perkara/route.ts");
const layar = baca("manajemen_surat/src/components/portal/peta-perkara.tsx");
const status = baca("manajemen_surat/src/components/portal/aleta-ecourt-status-perkara.tsx");

/** Kode saja - supaya tuntutan tidak lulus atas keterangannya sendiri. */
const kode = layanan
  .split("\n")
  .filter((b) => !/^\s*(\*|\/\/|\/\*)/.test(b))
  .join("\n");

describe("petanya ada, tetapi koordinatnya TIDAK boleh datang dari SIPP", () => {
  /**
   * ==========================================================================
   * PEMBALIKAN YANG DISENGAJA, DAN SEBAB PEMBALIKANNYA
   * ==========================================================================
   *
   * Sampai 2.23.0 berkas ini menuntut TIDAK ADA peta sama sekali. Tuntutan itu
   * benar untuk sumber data yang ada waktu itu, dan salah sebagai aturan
   * selamanya: yang tidak boleh bukan "peta", melainkan "koordinat dari
   * kode_pos".
   *
   * Diukur ulang 18 Sep 2026 lewat information_schema: `kode_pos` adalah
   * SATU-SATUNYA tabel di seluruh SIPP yang punya kolom lintang/bujur, dan
   * 2.023 barisnya untuk Sulawesi Tengah hanya memuat SEMBILAN titik - satu
   * per kabupaten, disalin ke tiap desa di bawahnya. 1.917 desa akan menumpuk
   * menjadi 9 titik.
   *
   * Sejak 2.24.0 petanya ada, dan titiknya datang dari OpenStreetMap yang
   * dijodohkan SEKALI di luar portal. Yang dijaga berkas ini karena itu
   * berubah sasaran, bukan dilonggarkan: larangan atas kode_pos tetap penuh,
   * dan bertambah larangan baru yang tidak ada sebelumnya - bahwa desa yang
   * tidak berkoordinat tidak boleh digeser ke tempat terdekat.
   */
  it("tidak ada satu pun koordinat yang dibaca dari SIPP", () => {
    // Dituntut PEMAKAIANNYA, bukan penyebutannya: kata "lintang" memang harus
    // ada di dalam kalimat yang menerangkan dari mana titiknya datang, dan
    // tuntutan yang melarang katanya akan menghukum penjelasan itu sendiri.
    expect(kode).not.toMatch(/\b(FROM|JOIN)\s+\S*kode_pos/i);
    expect(kode).not.toMatch(/\blongitude\b/);
    expect(kode).not.toMatch(/\blatitude\b/);
    // Tidak ada medan koordinat yang dipulangkan layanan ini ke layar. Yang
    // dikirimnya hanya HITUNGAN per kode desa; koordinatnya berkas statis.
    expect(kode).not.toMatch(/lintang:\s/);
    expect(kode).not.toMatch(/bujur:\s/);
    expect(kode).not.toMatch(/\blat\s*:/);
    expect(kode).not.toMatch(/\blon\s*:/);
  });

  it("dinyatakan TEGAS, bukan dibiarkan disimpulkan layar", () => {
    expect(kode).toContain("petaGeografis: false");
    expect(kode).toContain("alasanTanpaPeta:");
  });

  it("angka pengukurannya tercatat di sumbernya", () => {
    expect(layanan).toContain("Morowali Utara    -4,5536 / 136,0339   PAPUA");
    expect(layanan).toContain("Banggai          -10,2065 / 120,3529");
  });

  it("layar menyampaikan sebabnya, bukan diam", () => {
    expect(layar).toContain("hasil.alasanTanpaPeta");
  });

  it("tidak ada pustaka peta yang ditambahkan sebagai kebergantungan", () => {
    // Leaflet DIPAKAI, tetapi dari public/vendor - sama seperti pdf.js. Ia
    // hanya dipakai satu halaman; menambahkannya ke package.json berarti ia
    // ikut ditimbang pada tiap build dan ikut menjadi urusan tiap `npm ci` di
    // peladen, demi satu layar.
    const paket = baca("manajemen_surat/package.json");
    for (const pustaka of ["leaflet", "mapbox-gl", "maplibre-gl", "react-simple-maps", "d3-geo"]) {
      expect(paket, pustaka).not.toContain(`"${pustaka}"`);
    }
  });
});

describe("titik peta - dikunci kode, dijodohkan di luar, dan yang kosong tidak digeser", () => {
  const pemuat = baca("manajemen_surat/src/lib/peta-leaflet.ts");
  const petaLayar = baca("manajemen_surat/src/components/portal/peta-titik-perkara.tsx");

  it("titikDesa dikunci KODE, bukan nama", () => {
    // `kelompokkan` mengunci nama, dan itu benar untuk daftar yang ditelusuri
    // turun. Peta memajang seluruh desa sekaligus tanpa induk, dan di tingkat
    // itu nama berulang: "Labuan" ada enam kali di Sulawesi Tengah, tersebar
    // 1,9 derajat. Dikunci nama, keenamnya menyatu jadi satu titik yang
    // jumlahnya benar untuk enam desa sekaligus dan salah untuk masing-masing.
    expect(kode).toContain("function titikDesa(baris)");
    expect(kode).toContain('const kode = String(b.kodeKelurahan || "").trim();');
    expect(kode).toContain("if (!peta.has(kode)) {");
    expect(kode).toContain("tanpaKode");
  });

  it("dihitung dari baris yang SAMA - bukan kueri ketiga", () => {
    const potongan = kode.slice(kode.indexOf("const daftarFaktor"));
    expect(potongan).toContain("const sebaranTitik = titikDesa(baris);");
    expect(potongan).not.toMatch(/await\s+barisWilayah/);
  });

  it("berkas koordinat berkunci kode BPS, dan dijodohkan di luar portal", () => {
    const berkas = baca("manajemen_surat/public/peta/titik-desa.json");
    const isi = JSON.parse(berkas) as {
      titik: Record<string, [number, number]>;
      cakupan: { desaBerkoordinat: number; desaSeluruhnya: number };
    };
    const kunci = Object.keys(isi.titik);
    expect(kunci.length).toBeGreaterThan(300);
    // Kode wilayah BPS tingkat desa: 72.03.08.1020 - empat ruas.
    for (const k of kunci.slice(0, 40)) {
      expect(k, k).toMatch(/^\d{2}\.\d{2}\.\d{2}\.\d{4}$/);
    }
    // Koordinatnya berada di Indonesia, bukan di laut sebelah mana pun.
    for (const k of kunci.slice(0, 200)) {
      const [lat, lon] = isi.titik[k];
      expect(lat, k).toBeGreaterThan(-11.5);
      expect(lat, k).toBeLessThan(6.5);
      expect(lon, k).toBeGreaterThan(94);
      expect(lon, k).toBeLessThan(142);
    }
  });

  it("desa tanpa koordinat TIDAK digeser ke tempat terdekat", () => {
    // Inilah larangan yang paling mudah dilanggar dengan niat baik: menaruh
    // desa yang tidak berjodoh di pusat kecamatannya membuat petanya terlihat
    // lengkap sambil memindahkan perkara ke desa yang bukan asalnya.
    expect(petaLayar).toContain("const pos = koordinat[t.kode];");
    expect(petaLayar).toContain("if (pos) hasil.push({ t, pos });");
    expect(petaLayar).toContain("takBerkoordinat");
    expect(petaLayar).toContain("tidak digeser ke desa terdekat");
  });

  it("jari-jari memakai AKAR jumlahnya - mata membaca luas, bukan jari-jari", () => {
    expect(petaLayar).toContain("Math.sqrt(jml) / Math.sqrt(terbesar)");
  });

  it("digambar di kanvas, bukan ratusan simpul DOM", () => {
    expect(petaLayar).toContain("preferCanvas: true");
  });

  it("pustaka petanya dimuat dari peladen sendiri, bukan dari CDN", () => {
    // Pengadilan ini bekerja di jaringan yang tidak selalu punya jalan keluar.
    expect(pemuat).toContain('withBasePath("/vendor/leaflet/leaflet.js")');
    expect(pemuat).toContain('withBasePath("/vendor/leaflet/leaflet.css")');
    expect(pemuat).not.toMatch(/https?:\/\/[^\s"']*(unpkg|cdnjs|jsdelivr)/);
  });

  it("berkas pustakanya sungguh ada di repo, bukan hanya alamatnya", () => {
    const js = baca("manajemen_surat/public/vendor/leaflet/leaflet.js");
    const css = baca("manajemen_surat/public/vendor/leaflet/leaflet.css");
    expect(js).toContain("Leaflet 1.9.4");
    expect(js.length).toBeGreaterThan(100_000);
    expect(css).toContain(".leaflet-pane");
  });

  it("penyebutan sumber ubinan tidak dapat dimatikan", () => {
    // Data OpenStreetMap berlisensi ODbL, dan syaratnya menyebut sumber.
    expect(petaLayar).toContain("openstreetmap.org/copyright");
    expect(petaLayar).toContain("attribution: SEBUT");
  });

  it("peta dimuat hanya ketika tabnya dibuka", () => {
    expect(layar).toContain("const LazyPetaTitik = dynamic(");
    expect(layar).toContain('lihat === "peta" ? (');
    expect(layar).toContain("ssr: false");
  });
});

describe("kode wilayah menjadi nama, dua era menyatu", () => {
  it("keempat tingkat punya tabel rujukannya", () => {
    for (const t of ["ref_provinsi_new", "ref_kabupaten_new", "ref_kecamatan_new", "ref_kelurahan_new"]) {
      expect(kode, t).toContain(t);
    }
  });

  it("yang bukan angka dipakai sebagai nama, bukan dibungkus '(kode ...)'", () => {
    expect(kode).toContain('if (/^[0-9]/.test(mentah)) return `(kode ${mentah})`;');
    expect(kode).toContain("return bakukanNamaWilayah(mentah);");
  });

  it("singkatan resminya disamakan supaya tempatnya tidak terpecah", () => {
    expect(kode).toContain("function bakukanNamaWilayah(nama)");
    expect(kode).toContain('.replace(/^Kab\\.?\\s+/i, "Kabupaten ")');
  });

  it("dikelompokkan menurut NAMA - itulah yang menyatukan kedua era", () => {
    expect(kode).toContain("if (!peta.has(nama)) {");
    expect(layanan).toContain("Dikunci NAMA, bukan kode");
  });
});

describe("satu kueri, dikelompokkan di Node", () => {
  it("hanya satu kueri baris untuk wilayah DAN faktor", () => {
    expect(kode).toContain("LEFT JOIN perkara_akta_cerai ac ON ac.perkara_id = satu.perkara_id");
    expect(kode).toContain("LEFT JOIN faktor_perceraian f ON f.id = ac.faktor_perceraian_id");
    // Kueri faktor tersendiri tidak boleh kembali.
    expect(kode).not.toContain("async function sebaranFaktor(");
  });

  it("dikelompokkan di Node, bukan diminta ulang per tingkat", () => {
    expect(kode).toContain("function kelompokkan(baris, tingkat, induk)");
    expect(kode).toContain("function kelompokkanFaktor(baris)");
  });

  it("angka pengukurannya tercatat", () => {
    expect(layanan).toContain("9,6 detik");
    expect(layanan).toContain("0,5 detik");
  });

  it("galatnya TIDAK ditelan", () => {
    // Susunan sebelumnya membungkus tiap kueri dengan `.catch(() => [])`, dan
    // satu kueri faktor yang keliru memulangkan daftar kosong yang terbaca di
    // layar sebagai "tidak ada faktor perceraian" - kalimat yang salah.
    expect(kode).not.toContain(".catch(() => [])");
    expect(kode).toContain('alasan: "gagal_membaca_sipp"');
  });

  it("satu perkara dihitung sekali walau pihaknya banyak", () => {
    expect(kode).toContain("MIN(x.pihak_id) AS pihak_id");
    expect(layanan).toContain("tidak boleh terhitung dua kali pada desanya");
  });
});

describe("jangkauannya disebut, bukan disembunyikan", () => {
  it("berapa yang beralamat ikut dipulangkan", () => {
    expect(kode).toContain("persenBeralamat:");
    expect(kode).toContain("beralamat,");
  });

  it("layar menaruhnya DI ATAS sebarannya", () => {
    const iPeringatan = layar.indexOf("perkara ({hasil.ringkas.persenBeralamat}%) yang alamatnya tercatat");
    const iTabel = layar.indexOf("Sebaran menurut");
    expect(iPeringatan).toBeGreaterThan(-1);
    expect(iPeringatan).toBeLessThan(iTabel);
  });
});

describe("perceraian satu halaman, dibedakan warna", () => {
  it("cerai gugat dan talak digabung dalam satu kelompok", () => {
    expect(kode).toContain('jenis: ["Cerai Gugat", "Cerai Talak"]');
    expect(kode).toContain('penanda: { "Cerai Gugat": "merah", "Cerai Talak": "biru" }');
  });

  it("sebabnya tercatat - bukan sekadar permintaan", () => {
    expect(layanan).toContain("peristiwa yang sama dilihat dari dua pihak");
  });

  it("warnanya SEMANTIK, bukan slot palet kategori", () => {
    // Warna penanda tidak boleh ikut berputar ketika jumlah kategorinya
    // berubah - ia menandai identitas, bukan urutan.
    expect(layar).toContain("const WARNA_PENANDA: Record<string, string>");
    expect(layar).toContain("bukan slot palet kategori");
  });

  it("jenis lain punya halamannya sendiri", () => {
    expect(kode).toContain("function daftarJenis()");
    expect(kode).toContain("if (cerai.has(String(b.jenis))) continue;");
  });
});

describe("penelusuran turun", () => {
  it("disaring induknya, bukan memuat delapan puluh ribu desa", () => {
    expect(kode).toContain("if (induk && indukBaris(b, tingkat) !== induk) continue;");
    expect(kode).toContain("function indukBaris(baris, tingkat)");
  });

  it("jejaknya tumpukan, supaya kembali mundur tepat satu langkah", () => {
    expect(layar).toContain("const [jejak, setJejak]");
    expect(layar).toContain("j.slice(0, -1)");
  });

  it("grafiknya dibatasi dua puluh teratas, dan itu dikatakan", () => {
    expect(layar).toContain("daftar.slice(0, 20)");
    expect(layar).toContain("Grafik menggambar 20 teratas");
  });
});

describe("jalur portal dan kewenangannya", () => {
  it("rute menuntut kapabilitas panel", () => {
    expect(rute).toContain('pastikanKapabilitas(db, actorUserId, "panel")');
  });

  it("memakai batas waktu penilaian, bukan delapan detik bawaan", () => {
    const potongan = klien.slice(klien.indexOf("export async function getGatewayPetaPerkara("));
    expect(potongan).toContain("timeoutMs: TIMEOUT_PENILAIAN_MS");
  });

  it("gerbang punya kedua alamatnya", () => {
    expect(gerbang).toContain('router.get("/sipp/peta-perkara", requireInternalToken');
    expect(gerbang).toContain('router.get("/sipp/peta-perkara/menu", requireInternalToken');
  });

  it("layar membuka bungkus { ok, data }", () => {
    expect(layar).toContain("async function bukaBungkus<T>(balasan: Response)");
  });
});

describe("para pihak pada status perkara - diringkas, bukan digandakan", () => {
  it("bagian yang SUDAH ada yang diciutkan, bukan bagian kedua", () => {
    // Bagian "Para pihak" sudah berdiri sejak lama dan memajang daftar
    // lengkapnya. Menambah bagian kedua berisi hal yang sama membuat satu
    // layar menyebutkan pihak dua kali - dan penjaga urutan bagian, yang
    // memang ada, menangkapnya seketika.
    const pihak = (status.match(/kunci="pihak"/g) || []).length;
    expect(pihak).toBe(1);
    expect(status).not.toContain('kunci="identitas-pihak"');
  });

  it("terciut sebagai bawaan - nama pihak data pribadi", () => {
    const potongan = status.slice(status.indexOf('judul="Para pihak"'), status.indexOf('judul="Para pihak"') + 400);
    expect(potongan).toContain("ciutBawaan");
    expect(status).toContain("nama pihak adalah data pribadi");
  });

  it("kepalanya menyebut hitungan, bukan satu pun nama", () => {
    // Kepala bagian selalu terlihat, juga oleh yang kebetulan lewat di depan
    // meja - menaruh nama di sana membatalkan gunanya bagian itu diciutkan.
    expect(status).toContain("function ringkasPihak(");
    const fungsi = status.slice(
      status.indexOf("function ringkasPihak("),
      status.indexOf("export function AletaEcourtStatusPerkara")
    );
    expect(fungsi).not.toMatch(/\bx\.nama\b/);
    expect(fungsi).toContain("pihak.length");
  });

  it("menyediakan jalan ke peta perkara", () => {
    expect(status).toContain('withBasePath("/peta-perkara")');
    expect(status).toContain("Lihat sebaran perkara sejenis");
  });
});

describe("lapisan panggilan tidak bertemu - dan sandi yang berganti arti", () => {
  /**
   * ==========================================================================
   * KOLOM YANG BERGANTI MAKNA ADALAH CACAT YANG PALING SUKAR KETAHUAN
   * ==========================================================================
   *
   * `perkara_pelaksanaan_relaas.ket_temu` berisi Y/T (bertemu/tidak) sampai
   * 2024, lalu hampir seluruhnya S dan E sejak 2025 - sandi yang menandai
   * SALURAN pengiriman, bukan hasil pertemuan. Terukur: 'T' tinggal 2 baris
   * setahun pada 2025 dan 2026.
   *
   * Dihitung apa adanya, dua tahun terakhir memulangkan 0% tidak bertemu, dan
   * angka itu terbaca sebagai "pelayanan sempurna". Hasilnya masuk akal, dan
   * itulah yang membuatnya berbahaya.
   */
  const petaLayar = baca("manajemen_surat/src/components/portal/peta-titik-perkara.tsx");

  it("hanya baris bersandi Y/T yang dihitung", () => {
    expect(kode).toContain('const SANDI_TEMU = ["Y", "T"];');
    expect(kode).toContain("r.ket_temu IN (");
  });

  it("sebab pembatasannya tercatat di sumbernya, bukan hanya di catatan rilis", () => {
    expect(layanan).toContain("BERGANTI ARTI");
    expect(layanan).toContain("2025");
  });

  it("desa yang relaasnya terlalu sedikit tidak dipersenkan di peta", () => {
    // Tiga relaas yang dua di antaranya gagal bukan "67% gagal" - itu
    // kebetulan, dan mewarnainya seperti desa lain membuat kebetulan terbaca
    // sebagai temuan.
    expect(kode).toContain("const AMBANG_RELAAS = 10;");
    expect(kode).toContain("cukup: relaas >= AMBANG_RELAAS");
    expect(petaLayar).toContain("if (!d || !d.cukup) return WARNA_TAK_CUKUP;");
  });

  it("jangkauannya disebut di layar, bukan disembunyikan", () => {
    expect(petaLayar).toContain("BERGANTI ARTI sejak 2025");
  });

  it("tangga warnanya satu rona - besaran tunggal, bukan kelompok", () => {
    // Merah-kuning-hijau menyiratkan tiga jenis yang berbeda. Yang digambar
    // satu besaran yang bertambah.
    expect(petaLayar).toContain("const TANGGA_RELAAS = [");
    expect(petaLayar).not.toMatch(/TANGGA_RELAAS[\s\S]{0,400}#22c55e/);
  });
});

describe("lingkaran yang diketuk, dan pengelompokan per kecamatan", () => {
  const petaLayar = baca("manajemen_surat/src/components/portal/peta-titik-perkara.tsx");

  it("daftar perkara satu desa dibaca saat diketuk, bukan ikut muatan peta", () => {
    // Sembilan ribu nomor perkara beserta tanggalnya berukuran ratusan
    // kilobita, dan yang dibuka orang paling banyak satu desa.
    expect(kode).toContain("async function perkaraDesa(kelompok, kode, dari, sampai)");
    expect(petaLayar).toContain("lingkar.on(\"click\", () => setDesaDibuka(milik));");
  });

  it("nama pihak TIDAK dikirim utuh ke peta", () => {
    // Peta dibuka di layar yang kerap terlihat orang lain, dan daftar nama
    // orang berperkara per desa adalah hal yang paling tidak boleh terpajang.
    expect(kode).toContain("inisial:");
    expect(kode).not.toMatch(/namaPihak:\s*String\(b\.namaPihak/);
  });

  it("dikelompokkan per KECAMATAN, bukan per petak layar", () => {
    // "Delapan titik yang kebetulan berdekatan pada zum sembilan" bukan satuan
    // yang dikenal siapa pun di pengadilan.
    expect(petaLayar).toContain("const ZUM_DESA = 10;");
    expect(petaLayar).toContain("const kunci = `${x.t.kabupaten}|${x.t.kecamatan}`");
  });

  it("pandangan awal hanya disesuaikan SEKALI", () => {
    // Menyesuaikannya tiap gambar ulang membuat peta melompat kembali ke
    // tempat asalnya tiap kali orang berpindah lapisan - tidak dapat dipakai.
    expect(petaLayar).toContain("if (!sudahDipaskan.current) {");
  });
});
