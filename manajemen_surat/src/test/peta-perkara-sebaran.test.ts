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
    // Sejak golongan bulatan dapat dipilih, tiap titik membawa hitungan
    // golongannya (`h`) - tetap HANYA desa yang punya koordinatnya sendiri.
    expect(petaLayar).toContain("if (pos) hasil.push({ t, pos, h });");
    expect(petaLayar).toContain("takBerkoordinat");
    expect(petaLayar).toContain("tidak digeser ke desa terdekat");
  });

  it("jari-jari memakai AKAR jumlahnya - mata membaca luas, bukan jari-jari", () => {
    // Rumusnya pindah ke lib/peta-perkara-ukur.ts dan skalanya kini diukur dari
    // P95 data, bukan dari yang terbesar; perilakunya diuji sungguh-sungguh di
    // peta-perkara-bulatan.test.ts. Yang dijaga di sini: layar memakai fungsi
    // itu, dan rumus lama bertambahan 3 px (merusak kesebandingan luas) tidak
    // kembali.
    const ukur = baca("manajemen_surat/src/lib/peta-perkara-ukur.ts");
    expect(ukur).toContain("skala.rAcuan * Math.sqrt(n / skala.nAcuan)");
    expect(petaLayar).toContain("jariJariBulatan(jml, skala)");
    expect(petaLayar).not.toContain("3 + bagian * 15");
  });

  it("digambar di kanvas, bukan ratusan simpul DOM", () => {
    expect(petaLayar).toContain("preferCanvas: true");
  });

  it("pustaka petanya dimuat dari server sendiri, bukan dari CDN", () => {
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

  it("errornya TIDAK ditelan", () => {
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

  it("hanya baris bersandi Y/T/E yang dihitung - E (elektronik) dianggap bertemu", () => {
    expect(kode).toContain('const SANDI_TEMU = ["Y", "T", "E"];');
    expect(kode).toContain("SUM(r.ket_temu = 'T') AS takTemu");
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
    // `golongan` - golongan bulatan yang diketuk - menggantikan kelompok bila dikenal.
    expect(kode).toContain("async function perkaraDesa(kelompok, kode, dari, sampai, golongan)");
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
    expect(petaLayar).toContain("function kunciKecamatan(t: TitikPerkara)");
    expect(petaLayar).toContain("return `${t.kabupaten}|${t.kecamatan}`;");
  });

  /**
   * ==========================================================================
   * KUNCINYA DISUSUN SATU KALI - DAN KENAPA ITU DIKUNCI DI SINI
   * ==========================================================================
   *
   * Penyusun kunci kecamatan dahulu hanya ada di dalam `digambar`, sedangkan
   * `petaLapis` dan `petaRelaas` tetap berkunci KODE DESA. Di bawah ZUM_DESA
   * tiap pencarian karena itu meleset, `warnaLapisan` memulangkan
   * WARNA_TAK_CUKUP, dan seluruh lapisan selain "perkara" tergambar kelabu
   * seluruhnya.
   *
   * Zum awalnya 9 - di bawah ambang - sehingga peta kelabu itulah yang dilihat
   * orang lebih dahulu, dan kelabu di atas ubinan gelap terbaca sebagai peta
   * yang tidak menggambar apa-apa sama sekali.
   *
   * Kunci yang meleset TIDAK menimbulkan galat: tidak ada yang gagal, tidak
   * ada yang tercatat, hanya warna yang hilang. Karena itu bentuknya yang
   * dikunci di sini - tidak ada cara lain menangkapnya.
   */
  it("nilai lapisan ikut digabung per kecamatan, bukan dicari dengan kode desa", () => {
    expect(petaLayar).toContain("function gabungLapisan(");
    expect(petaLayar).toContain("const petaLapisTampil = useMemo(");
    expect(petaLayar).toContain("const petaRelaasTampil = useMemo(");
    // Ketiganya - lingkaran, nilai lapisan, dan angka relaas - harus memakai
    // penyusun kunci yang SAMA.
    const pemakai = petaLayar.split("kunciKecamatan(x.t)").length - 1;
    expect(pemakai).toBeGreaterThanOrEqual(3);
  });

  it("relaas sekecamatan dijumlahkan pembilang dan penyebutnya", () => {
    // Merata-rata persentase desa menghasilkan angka yang tidak pernah ada:
    // sepuluh dari dua puluh ditambah satu dari sepuluh adalah sebelas dari
    // tiga puluh - 37%, bukan rata-rata 50% dan 10% yang menghasilkan 30%.
    expect(petaLayar).toContain("k.takTemu / k.relaas");
  });

  it("layar penuh punya jalan keluarnya, dan ukurannya dihitung ulang", () => {
    // Tombol tanpa jalan keluar mengurung petanya di layar penuh; dan tanpa
    // invalidateSize ubinannya tertinggal di kotak yang lama sementara sisanya
    // kelabu.
    expect(petaLayar).toContain("requestFullscreen");
    expect(petaLayar).toContain("exitFullscreen");
    expect(petaLayar).toContain('document.addEventListener("fullscreenchange"');
    expect(petaLayar).toContain("peta.invalidateSize();");
    // Penolakan Fullscreen API - halaman di dalam bingkai tanpa
    // allowfullscreen - jatuh ke layar penuh semu, bukan ke tombol yang diam.
    expect(petaLayar).toContain("setPenuhSemu(true)");
    expect(petaLayar).toContain('if (e.key !== "Escape") return;');
  });

  it("pandangan awal hanya disesuaikan SEKALI", () => {
    // Menyesuaikannya tiap gambar ulang membuat peta melompat kembali ke
    // tempat asalnya tiap kali orang berpindah lapisan - tidak dapat dipakai.
    expect(petaLayar).toContain("if (!sudahDipaskan.current) {");
  });
});


describe("sembilan lapisan peta, cincin jarak, dan usulan sidang keliling", () => {
  const lapisan = baca("aleta_bot/services/lapisanPetaService.js");
  const petaLayar = baca("manajemen_surat/src/components/portal/peta-titik-perkara.tsx");
  const kodeLapisan = lapisan
    .split("\n")
    .filter((b) => !/^\s*(\*|\/\/|\/\*)/.test(b))
    .join("\n");

  it("kesembilan lapisan ada di server dan di layar", () => {
    for (const kunci of ["biaya", "faktor", "kehadiran", "berulang", "perubahan", "jurusita"]) {
      expect(kodeLapisan, kunci).toContain(kunci);
      expect(petaLayar, kunci).toContain(`apa: "${kunci}"`);
    }
    expect(kodeLapisan).toContain("async function kelilingAda");
    expect(kodeLapisan).toContain("async function desaKosong");
  });

  it("daftar lapisannya TERTUTUP - nama fungsi tidak datang dari peramban", () => {
    // "constructor" dan "toString" pernah menembus daftar yang tampak tertutup;
    // lihat keterangan PENGERJA pada layanan analisis.
    expect(gerbang).toContain("Object.prototype.hasOwnProperty.call(lapisanPetaService.LAPISAN, apa)");
    expect(lapisan).toContain("Object.create(null)");
  });

  it("kolom tanggal tidak dibungkus fungsi", () => {
    // YEAR(tgl) = ? memaksa MySQL menghitung fungsinya untuk SETIAP baris.
    expect(kodeLapisan).not.toMatch(/WHERE[^`]*YEAR\(/);
    expect(kodeLapisan).toContain("BETWEEN ? AND ?");
  });

  it("jurusita_id pada relaas adalah userid SIPP, bukan id jurusita", () => {
    // ========================================================================
    // PENJAGA INI DULU MENGUNCI SAMBUNGAN YANG SALAH
    // ========================================================================
    //
    // Yang dituntutnya "LEFT JOIN jurusita js ON js.id = r.jurusita_id" -
    // sambungan yang sudah lebih benar daripada pendahulunya (perkara_jurusita,
    // nol dari 14.495), tetapi masih salah.
    //
    // jurusita_id pada perkara_pelaksanaan_relaas adalah sys_users.userid,
    // dibuktikan langsung oleh kode SIPP: data_relaas_c.php menuliskan
    // $this->session->userdata('userid') ke kolom itu. Yang tersimpan userid
    // orang yang MENGINPUT.
    //
    // Terukur:
    //     ke perkara_jurusita        0 dari 14.495  ( 0%)
    //     ke jurusita.id         7.101 dari 14.495  (49%) - 61,6% di antaranya
    //                                                 menyebut ORANG LAIN
    //     ke sys_users.userid   14.490 dari 14.495  (99,97%)
    //
    // Dua juru sita tersibuk - Tanty Restianty 3.279 relaas dan Mustini 2.429 -
    // tidak pernah muncul sama sekali lewat sambungan lama.
    expect(kodeLapisan).toContain("LEFT JOIN sys_users u ON u.userid = r.jurusita_id");
    expect(kodeLapisan, "sambungan ke tabel jurusita tidak boleh kembali").not.toContain(
      "LEFT JOIN jurusita js ON js.id = r.jurusita_id"
    );
    expect(kodeLapisan).not.toContain("js.jurusita_id = r.jurusita_id");
    // Sebabnya tertulis, beserta bukti dari kode SIPP-nya sendiri.
    expect(lapisan).toContain("BUKAN id JURUSITA");
  });

  it("cerita lama 'satu orang lima ejaan' dinyatakan keliru, bukan dihapus", () => {
    // Catatan lama menyimpulkan bahwa empat ejaan pada tabel `jurusita` adalah
    // satu orang yang sama. Kesimpulan itu salah ke arah yang paling
    // merugikan: nama yang disandingkan memang bukan orangnya, dan cerita itu
    // membuat kekeliruannya tampak sudah dipertimbangkan.
    //
    // Yang dijaga: pembantahannya tetap tertulis. Menghapusnya begitu saja
    // membuat orang berikutnya menyimpulkan hal yang sama lagi.
    expect(lapisan).toContain("ITU KELIRU - MEREKA LIMA ORANG YANG BERBEDA");
    expect(lapisan).toContain("2.727");
  });

  it("titik kantor dapat diganti tanpa menyentuh kode", () => {
    expect(petaLayar).toContain("NEXT_PUBLIC_PETA_KANTOR");
    expect(petaLayar).toContain("const CINCIN_KM = [10, 25, 50, 100];");
  });

  it("usulan sidang keliling MENGELUARKAN yang sudah terlayani", () => {
    // Tanpa itu, usulannya akan terus menyebut Sigi Biromaru yang justru sudah
    // 126 kali disidangi.
    expect(petaLayar).toContain("const terlayani =");
    expect(petaLayar).toContain("skor: terlayani ? 0 :");
  });

  it("selisih diwarnai dua rona, bukan satu rona menua", () => {
    // Selisih punya NOL yang berarti - tidak berubah. Satu rona menua
    // menyiratkan nol adalah ujung, padahal ia tengah.
    expect(petaLayar).toContain('if (satuan === "selisih")');
  });

  it("kategori tidak memakai warna yang berputar", () => {
    // Warna yang berputar membuat kategori kesembilan berwarna sama dengan
    // yang pertama, dan pembacanya menyangka keduanya hal yang sama.
    expect(petaLayar).toContain("const WARNA_KATEGORI = [");
    // Dituntut SIFATNYA, bukan nama peubahnya: yang kesembilan harus jatuh ke
    // kelabu, dan tidak boleh ada sisa bagi yang memutarnya kembali ke awal.
    expect(petaLayar).toMatch(/< WARNA_KATEGORI\.length \? WARNA_KATEGORI\[\w+\] : WARNA_TAK_CUKUP/);
    expect(petaLayar).not.toContain("% WARNA_KATEGORI.length");
  });

  it("peta tidak menjanjikan unduhan GAMBAR, dan sebabnya tercatat", () => {
    // Ubinan peta datang dari peladen lain tanpa izin lintas-asal; kanvas yang
    // memuatnya ternoda dan peramban menolak mengubahnya jadi berkas.
    expect(petaLayar).toContain("TIDAK DAPAT DIUNDUH SEBAGAI GAMBAR");
    expect(petaLayar).toContain("ternoda");
    expect(petaLayar).toContain("peta-perkara-${lapisan}.csv");
  });

  it("CSV diberi tanda urutan bita supaya Excel tidak merusak hurufnya", () => {
    // Dituntut sebagai TEKS SUMBER. Tuntutan yang ditulis sebagai untaian biasa
    // akan menguraikan lolosannya lebih dahulu lalu mencari huruf tak terlihat
    // di dalam berkas - yang memang tidak ada di sana.
    expect(petaLayar).toContain(String.raw`"\uFEFF" + teks`);
  });
});

describe("tirai pembanding - dua lapisan pada satu peta", () => {
  const petaLayar = baca("manajemen_surat/src/components/portal/peta-titik-perkara.tsx");

  /**
   * ==========================================================================
   * GUNTINGANNYA PADA KANVAS, BUKAN PADA PANEL - DAN INI PERNAH SALAH
   * ==========================================================================
   *
   * Rancangan pertama menggunting PANEL Leaflet dengan clip-path berpersen.
   * Diuji pada halaman mandiri, hasilnya: SELURUH lingkaran lenyap, kedua sisi,
   * di segala letak tirai.
   *
   *     panelKiri.getBoundingClientRect() -> { width: 0, height: 0 }
   *
   * Panel Leaflet tidak berukuran - anak-anaknya berposisi mutlak. clip-path
   * berpersen pada kotak 0x0 menghasilkan persegi 0x0, yaitu menggunting
   * semuanya. Tanpa galat, tanpa peringatan; yang tampak hanya peta yang
   * lingkarannya hilang - dan itu akan terbaca sebagai "datanya belum ada".
   *
   * Sesudah dipindahkan ke kanvas dan dihitung dalam piksel, tepi guntingan
   * jatuh TEPAT di garis tirai pada lima gabungan zum-geseran-tirai (550,00 /
   * 275,00 / 825,00 / 55,00 / 1.045,00 - ketiga angka tiap baris sama).
   */
  it("digunting pada kanvas dalam piksel, bukan pada panel dalam persen", () => {
    expect(petaLayar).toContain('peta.getPane("aletaKiri")?.querySelector("canvas")');
    expect(petaLayar).toContain("getBoundingClientRect()");
    // Persen pada panel adalah bentuk yang sudah terbukti menggunting semuanya.
    expect(petaLayar).not.toMatch(/getPane\("aleta(Kiri|Kanan)"\)[^\n]*clipPath = `inset\(0 \$\{100 -/);
    expect(petaLayar).toContain("Panel Leaflet TIDAK BERUKURAN");
  });

  it("dihitung ulang ketika petanya bergeser - kanvasnya ikut bergeser", () => {
    expect(petaLayar).toContain('peta.on("move zoom zoomend resize", pasangTirai)');
    expect(petaLayar).toContain('peta.off("move zoom zoomend resize", pasangTirai)');
  });

  it("sisi kanan DIBACA, bukan diketuk", () => {
    // Kanvas sisi kanan menutupi SELURUH peta - bukan hanya separuh kanan -
    // sehingga membiarkannya menerima ketukan merampas ketukan sisi kiri di
    // bagian layar tempat ia bahkan tidak terlihat.
    expect(petaLayar).toContain('panelKanan.style.pointerEvents = "none"');
    expect(petaLayar).toContain("interactive: false");
  });

  it("guntingan kedua sisi dilepas sendiri-sendiri", () => {
    // Ketika tirai dimatikan, lingkaran sisi kanan dihapus lebih dahulu, dan
    // Leaflet mencabut kanvasnya. Pembersihan yang menunggu kedua kanvas ada
    // akan meninggalkan sisi KIRI tergunting selamanya.
    expect(petaLayar).toContain('if (kiri) kiri.style.clipPath = "";');
    expect(petaLayar).toContain('if (kanan) kanan.style.clipPath = "";');
  });

  it("tangga warna kedua sisi disusun dari lapisannya masing-masing", () => {
    for (const nama of ["petaLapisB", "satuanB", "jangkauLapisB", "urutKategoriB", "warnaTitikB"]) {
      expect(petaLayar, nama).toContain(nama);
    }
  });

  it("memilih lapisan sisi kanan berarti MENUKAR, bukan menduakan", () => {
    // Tanpa ini, kedua sisi tirai memuat lapisan yang sama - dan pilihan
    // kanan lenyap dari daftarnya sendiri, meninggalkan kotak pilihan yang
    // tampak kosong.
    expect(petaLayar).toContain("if (l.kunci === lapisanB) setLapisanB(lapisan);");
    expect(petaLayar).toContain("LAPISAN.filter((l) => l.kunci !== lapisan)");
  });

  it("kedua lapisan dibaca satu per satu, bukan berbarengan", () => {
    // Dua kueri berat yang berjalan bersamaan pada SIPP satker membuat
    // keduanya lambat, bukan salah satunya cepat.
    expect(petaLayar).toContain("const kunci = [lapisan, lapisanB].find(");
  });
});

describe("warna lapisan tidak boleh tertinggal di balik useCallback", () => {
  const petaLayar = baca("manajemen_surat/src/components/portal/peta-titik-perkara.tsx");

  /**
   * ==========================================================================
   * DELAPAN LAPISAN 2.25.0 YANG SELURUH DESANYA KELABU
   * ==========================================================================
   *
   * `warnaTitik` dahulu berupa useCallback yang memeluk `petaLapis`, `satuan`,
   * `jangkauLapis`, dan `urutKategori` langsung dari ruang lingkupnya -
   * sementara keempatnya TIDAK ada di daftar kebergantungannya. Urutannya:
   *
   *   1. lapisan "Biaya panggilan" dipilih -> `lapisan` berubah -> warnaTitik
   *      dibuat ulang, memeluk petaLapis yang MASIH KOSONG
   *   2. datanya tiba -> penggambar berjalan lagi (petaLapis ada di
   *      kebergantungan EFEK-nya)
   *   3. tetapi warnaTitik TIDAK dibuat ulang - ia masih memeluk peta kosong
   *
   * Seluruh desa karena itu berwarna kelabu "tidak cukup" pada pemilihan
   * PERTAMA tiap lapisan. Berpindah lapisan lalu kembali membuatnya benar - dan
   * itulah yang membuat cacat ini menyamar sebagai data yang belum lengkap.
   *
   * Ditemukan dengan membaca, lalu dipastikan oleh `npx eslint`, yang
   * menyebutkan tepat kelima nama itu sebagai kebergantungan yang hilang.
   *
   * Bentuk barunya PABRIK: tiap datanya masuk lewat parameter, sehingga tidak
   * ada lagi yang dapat tertinggal.
   */
  it("aturan warnanya menerima datanya sebagai parameter", () => {
    expect(petaLayar).toContain("const buatWarna = useCallback(");
    expect(petaLayar).toContain("function warnaLapisan(");
    // Keempat nama itu tidak boleh lagi dipeluk dari ruang lingkup luar.
    // (Kebergantungannya kini [petaRelaasTampil] saja: warna lapisan "perkara"
    // dibaca dari kelas jenis yang masuk lewat parameter - WARNA_KELAS tetap.)
    const iPabrik = petaLayar.indexOf("const buatWarna = useCallback(");
    const iTutup = petaLayar.indexOf("[petaRelaasTampil]", iPabrik);
    expect(iTutup).toBeGreaterThan(iPabrik);
    const badan = petaLayar.slice(iPabrik, iTutup);
    for (const nama of ["petaLapis", "jangkauLapis", "urutKategori"]) {
      expect(badan, nama).not.toContain(nama);
    }
  });

  it("kedua pemakainya menyebutkan seluruh datanya", () => {
    expect(petaLayar).toContain(
      "[buatWarna, lapisan, petaLapisTampil, satuan, jangkauLapis, urutKategori]"
    );
    expect(petaLayar).toContain(
      "[buatWarna, lapisanB, petaLapisBTampil, satuanB, jangkauLapisB, urutKategoriB]"
    );
  });
});

describe("membandingkan lebih dari dua perkara", () => {
  const banding = baca("manajemen_surat/src/components/portal/banding-perkara.tsx");

  /**
   * Satu pembanding menjawab "kenapa yang ini lebih lama dari yang itu". Yang
   * ditanyakan berikutnya justru "kenapa TIGA perkara majelis ini lebih lama" -
   * dan itu menuntut kolom ketiga dan keempat.
   */
  it("pembandingnya jamak, dan dibatasi", () => {
    expect(banding).toContain("useState<Ringkas[]>([])");
    expect(banding).toContain("const BATAS_BANDING = 4;");
    expect(banding).toContain("lawan.length >= BATAS_BANDING");
  });

  it("selisih dihitung ke perkara yang SEDANG DIBUKA, bukan berantai", () => {
    // Yang dibandingkan orang adalah perkaranya sendiri dengan yang lain,
    // bukan rantai perbandingan antar kolom sebelah.
    expect(banding).toContain("const barisUntuk = useCallback(");
    expect(banding).toContain("(lawanSatu: Ringkas): Baris[]");
    expect(banding).toContain("Selisih selalu dihitung dari perkara INI ke tiap pembanding");
  });

  it("satu susunan baris untuk seluruh kolom, bukan salinan per kolom", () => {
    // Tiga salinan akan menyimpang diam-diam begitu satu butir ditambahkan.
    const iAwal = banding.indexOf("const barisUntuk = useCallback(");
    const iAkhir = banding.indexOf("const tabel = useMemo(");
    expect(iAkhir).toBeGreaterThan(iAwal);
    expect(banding.slice(iAwal, iAkhir).match(/bandingTeks\(|bandingAngka\(/g)?.length).toBeGreaterThan(8);
  });

  it("tiap pembanding dapat dikeluarkan sendiri", () => {
    expect(banding).toContain("lama.filter((x) => x.nomorPerkara !== l.nomorPerkara)");
  });
});

describe("kartu identitas pihak punya jalan ke riwayatnya", () => {
  const ident = baca("manajemen_surat/src/components/portal/identitas-pihak.tsx");
  const bagian = baca("manajemen_surat/src/lib/alat-bagian.ts");
  const analisa = baca("manajemen_surat/src/components/portal/aleta-analisa-perkara.tsx");

  /**
   * Analisis "Riwayat pihak" sudah menghitung perkara lain orang itu sejak
   * lama - lewat NIK, nama, dan tanggal lahir. Yang tidak ada JALANNYA: yang
   * sedang menatap nama seseorang harus menutup kartunya, menggulung ke
   * Analisis lanjutan, membukanya, lalu mencari satu tombol di antara empat
   * puluh satu.
   */
  it("aba-abanya ada, dan analisisnya mendengarkan", () => {
    expect(bagian).toContain('| { jenis: "analisa"; kunci: string }');
    expect(ident).toContain('siarkanAba({ jenis: "analisa", kunci: "pihak" })');
    expect(analisa).toContain('if (aba.jenis !== "analisa") return;');
  });

  it("lewat aba-aba, bukan keadaan yang dinaikkan ke induk", () => {
    // Menaikkannya berarti layar sepanjang dua puluh tujuh bagian digambar
    // ulang seluruhnya tiap kali satu analisis dipilih.
    expect(analisa).toContain("langgananAba((aba) =>");
  });
});
