/**
 * ============================================================================
 * DELAPAN PENILAIAN YANG LULUS UJI TETAPI TIDAK DAPAT DILIHAT SIAPA PUN
 * ============================================================================
 *
 * Mesin penilaiannya sudah lengkap dan hijau: periode, ambang bertanggal,
 * riwayat nilai, kerangka, dan delapan penilaian di atasnya. Seluruhnya lulus
 * uji. Tetapi sampai layar ini ada, tidak seorang pun di pengadilan dapat
 * MELIHAT satu angka pun - dan kode yang lulus uji tetapi tidak dapat dilihat
 * siapa pun bukan pekerjaan yang selesai.
 *
 * Rantainya panjang dan tiap sambungan diam saat putus:
 *
 *     layar  ->  rute portal  ->  klien gerbang  ->  rute bot  ->  layanan
 *
 * Sambungan yang putus tidak menggagalkan kompilasi dan tidak menggagalkan uji
 * mana pun - ia hanya menghasilkan layar kosong di server. Uji ini membaca
 * kelima sambungan dari berkas aslinya.
 *
 * Jalur "/internal/aleta-bot/..." sendiri sudah dijaga uji lain
 * (aleta-bot-jalur-gateway); yang dijaga di sini sambungan di ATAS jalur itu.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = process.cwd();

function baca(berkas: string) {
  return readFileSync(path.join(AKAR, berkas), "utf8");
}

const HALAMAN_SIPP = "src/app/(portal)/aleta-sipp/page.tsx";
const KOMPONEN = "src/components/portal/aleta-penilaian-berjenjang.tsx";
const KLIEN = "src/server/modules/aleta-bot/whatsapp-gateway-client.ts";

/** Ketiga rute portal, beserta fungsi klien gerbang yang wajib dipanggilnya. */
const RUTE = [
  {
    berkas: "src/app/api/aleta-penilaian/daftar/route.ts",
    alamat: "/api/aleta-penilaian/daftar",
    fungsi: ["getGatewayDaftarPenilaian"],
  },
  {
    berkas: "src/app/api/aleta-penilaian/jalankan/route.ts",
    alamat: "/api/aleta-penilaian/jalankan",
    fungsi: ["getGatewayJalankanPenilaian"],
  },
  {
    berkas: "src/app/api/aleta-penilaian/laporan/route.ts",
    alamat: "/api/aleta-penilaian/laporan",
    fungsi: [
      "getGatewayDaftarLaporanPerkara",
      "getGatewayBlangkoLaporanPerkara",
      "postGatewayCatatLaporanPerkara",
    ],
  },
];

describe("layar penilaian berjenjang benar-benar terjangkau", () => {
  const halaman = baca(HALAMAN_SIPP);
  const komponen = baca(KOMPONEN);
  const klien = baca(KLIEN);

  it("halaman ALETA x SIPP memasang tab dan merendernya", () => {
    expect(halaman).toContain(
      'import { AletaPenilaianBerjenjang } from "@/components/portal/aleta-penilaian-berjenjang"'
    );
    expect(halaman).toContain('{ value: "berjenjang", label: "Penilaian Berjenjang" }');
    expect(halaman).toContain('<TabsContent value="berjenjang"');
    expect(halaman).toContain("<AletaPenilaianBerjenjang />");
  });

  it("tab yang dipasang punya isi, dan isinya punya tab", () => {
    // Butir tab tanpa TabsContent menghasilkan tab yang dapat ditekan lalu
    // menampilkan kekosongan; TabsContent tanpa butir tab menghasilkan isi yang
    // tidak pernah dapat dibuka. Keduanya diam.
    const butir = [...halaman.matchAll(/\{ value: "([a-z0-9-]+)", label: "/g)].map((m) => m[1]);
    const isi = [...halaman.matchAll(/<TabsContent value="([a-z0-9-]+)"/g)].map((m) => m[1]);

    expect(butir.length).toBeGreaterThan(10);

    const tanpaIsi = butir.filter((v) => !isi.includes(v));
    const tanpaButir = isi.filter((v) => !butir.includes(v));

    expect(tanpaIsi, `Tab ini dapat ditekan tetapi kosong: ${tanpaIsi.join(", ")}`).toEqual([]);
    expect(
      tanpaButir,
      `Isi tab ini tidak pernah dapat dibuka: ${tanpaButir.join(", ")}`
    ).toEqual([]);
  });

  it("ketiga rute portal ada dan memanggil fungsi klien gerbangnya", () => {
    const kurang: string[] = [];

    for (const r of RUTE) {
      const isi = baca(r.berkas);
      for (const f of r.fungsi) {
        if (!isi.includes(f)) kurang.push(`${r.berkas} tidak memanggil ${f}`);
        if (!klien.includes(`export async function ${f}(`)) {
          kurang.push(`${f} tidak ada pada klien gerbang`);
        }
      }
    }

    expect(kurang, kurang.join("; ")).toEqual([]);
  });

  it("layar memanggil ketiga alamat itu, tidak alamat karangan", () => {
    const dipanggil = [
      ...new Set(
        [...komponen.matchAll(/["`](\/api\/aleta-penilaian[a-z0-9/_-]*)/g)].map((m) => m[1])
      ),
    ];
    expect(dipanggil.length).toBeGreaterThan(0);

    const tersedia = new Set(RUTE.map((r) => r.alamat));
    const hantu = dipanggil.filter((a) => !tersedia.has(a));

    expect(hantu, `Layar memanggil alamat yang tidak punya rute: ${hantu.join(", ")}`).toEqual([]);

    // Rute yang dibuat tetapi tidak pernah dipanggil layar mana pun sama saja
    // dengan tidak dibuat.
    const tidakDipakai = [...tersedia].filter((a) => !dipanggil.includes(a));
    expect(
      tidakDipakai,
      `Rute ini tidak dipanggil layar mana pun: ${tidakDipakai.join(", ")}`
    ).toEqual([]);
  });

  it("setiap pengambilan di layar melewati apiPath", () => {
    // basePath portal /aleta. fetch("/api/...") tanpa apiPath menjawab 404 di
    // server tetapi berhasil di mesin pengembang - kekeliruan yang paling
    // mahal ditemukan.
    expect(komponen).toContain('import { apiPath } from "@/lib/base-path"');

    const telanjang = [...komponen.matchAll(/fetch\(\s*[`"']\//g)];
    expect(
      telanjang.length,
      "ada fetch yang menuju jalur telanjang tanpa apiPath"
    ).toBe(0);
  });

  it("ketiga rute portal menjaga aksesnya", () => {
    const lalai: string[] = [];
    for (const r of RUTE) {
      const isi = baca(r.berkas);
      if (!isi.includes("resolveActorUserId")) lalai.push(`${r.berkas} tidak memeriksa aktor`);
      if (!isi.includes("pastikanKapabilitas")) lalai.push(`${r.berkas} tidak memeriksa kapabilitas`);
      if (!isi.includes("handleAdminRouteError")) lalai.push(`${r.berkas} tidak mencatat galatnya`);
    }
    expect(lalai, lalai.join("; ")).toEqual([]);
  });

  it("nama pencatat laporan diambil dari sesi, bukan dari isian layar", () => {
    // Ruas "dicatat oleh" yang dapat diketik sendiri membuat catatannya tidak
    // dapat ditelusuri - dan catatan yang tidak dapat ditelusuri tidak berguna
    // sebagai bukti ketepatan waktu.
    const rute = baca(RUTE[2].berkas);
    expect(rute).toContain("requireActorUser");
    expect(rute).toContain("dicatatOleh: pencatat.nama");

    // Layar boleh MEMBACA nama pencatat dari jawaban - itu yang membuat
    // petugas melihat atas nama siapa catatannya tersimpan. Yang dilarang
    // MENGIRIMkannya: ruas kiriman ditulis "dicatatOleh:", pembacaan jawaban
    // ditulis "jawab.dicatatOleh".
    expect(komponen).not.toContain("dicatatOleh:");
  });

  it("layar menahan nilai yang belum pantas ditampilkan", () => {
    // Keempat penahan datang dari mesinnya. Layar yang tidak membacanya akan
    // menampilkan seratus persen dari tiga baris seolah itu prestasi.
    const wajib = [
      "bawahLantai",
      "sebabTidakCukup",
      "selisihRingkas",
      "penyandingan",
      // Daftar hari libur yang belum disahkan terhadap SKB. Penilaian tenggang
      // pemanggilan menghitung hari kerja di atasnya.
      "hariLibur",
    ];
    const hilang = wajib.filter((k) => !komponen.includes(k));
    expect(
      hilang,
      `Layar tidak membaca penahan ini: ${hilang.join(", ")}`
    ).toEqual([]);
  });
});
