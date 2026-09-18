/**
 * ============================================================================
 * PETA PERKARA - DAN PETA YANG SENGAJA TIDAK DIBUAT
 * ============================================================================
 *
 * Satker meminta peta perkara yang "dinamis, keren, efisien namun tidak
 * membuat lag dan error". Peta titik memang sempat dibangun dari koordinat
 * `kode_pos`. Dua pengukuran membatalkannya:
 *
 *   1. KOLOMNYA TERTUKAR. `longitude` memuat lintang dan `latitude` memuat
 *      bujur. Dari 2.023 baris Sulawesi Tengah, NOL masuk akal bila dibaca apa
 *      adanya - seluruhnya mendarat di Samudra Atlantik.
 *
 *   2. SESUDAH DITUKAR PUN, KOORDINATNYA SALAH. Keenam belas kabupaten
 *      Sulawesi Tengah masing-masing hanya punya SATU titik, dan sebagian
 *      menunjuk pulau lain:
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
 * Yang dibangun karena itu sebaran BERJENJANG dari kode wilayah resmi.
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

describe("tidak ada peta geografis, dan sebabnya tercatat", () => {
  it("tidak ada satu pun koordinat yang dipakai", () => {
    // Dituntut PEMAKAIANNYA, bukan penyebutannya: kata "lintang" memang harus
    // ada di dalam kalimat yang menerangkan kenapa petanya tidak dibuat, dan
    // tuntutan yang melarang katanya akan menghukum penjelasan itu sendiri.
    // `kode_pos` masih disebut sekali - di dalam kalimat yang diperlihatkan
    // kepada pengguna sebagai alasan. Yang dilarang membacanya sebagai TABEL.
    expect(kode).not.toMatch(/\b(FROM|JOIN)\s+\S*kode_pos/i);
    expect(kode).not.toMatch(/\blongitude\b/);
    expect(kode).not.toMatch(/\blatitude\b/);
    // Tidak ada medan koordinat yang dipulangkan ke layar.
    expect(kode).not.toMatch(/lintang:\s/);
    expect(kode).not.toMatch(/bujur:\s/);
    expect(kode).not.toContain("titik:");
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

  it("tidak ada pustaka peta yang ditambahkan", () => {
    const paket = baca("manajemen_surat/package.json");
    for (const pustaka of ["leaflet", "mapbox-gl", "maplibre-gl", "react-simple-maps", "d3-geo"]) {
      expect(paket, pustaka).not.toContain(`"${pustaka}"`);
    }
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
