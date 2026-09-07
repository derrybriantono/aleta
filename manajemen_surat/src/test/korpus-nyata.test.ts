// @vitest-environment node
import { gunzipSync } from "node:zlib";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { alineaBergunaSaja, susunKorpus, susunUlang } from "@/lib/blok-kalimat";
import { kelengkapanDimensi, kunciDimensi, uraikanDimensi } from "@/lib/taksonomi-blangko";

/**
 * Uji lulus Tahap 1, dijalankan terhadap SELURUH pustaka blangko sungguhan.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Satu janji, dan seluruh rencana Kemandirian Blangko bergantung padanya:
 *
 *   TIAP BLANGKO ABT HARUS DAPAT DISUSUN KEMBALI DARI KORPUS, TEPAT KATA DEMI
 *   KATA. Yang tidak bisa harus TERDAFTAR beserta sebabnya, bukan dibiarkan
 *   lewat.
 *
 * Uji dengan contoh buatan tidak dapat membuktikan itu. Blangko sungguhan
 * ditulis manusia selama bertahun-tahun, tidak seragam, dan memuat sisa kendali
 * RTF, gambar tertanam, serta huruf Arab. Karena itu berkas ini bekerja atas
 * tarikan nyata seluruh 807 blangko.
 *
 * ============================================================================
 * BILA TARIKANNYA TIDAK ADA
 * ============================================================================
 *
 * Tarikan ini bukan bagian dari repositori - ia diambil dari server yang memuat
 * APS Badilag. Bila berkasnya tidak ada, uji ini DILEWATI dengan keterangan,
 * bukan dinyatakan lulus: uji yang lulus karena bahannya tidak ada adalah uji
 * yang berbohong.
 */

const JALUR_TARIKAN = process.env.ALETA_KORPUS_TARIKAN ?? "";

type BerkasMentah = { jalur: string; alinea: string[]; penanda: string[]; besarByte: number };

function muatTarikan(): BerkasMentah[] | null {
  if (!JALUR_TARIKAN || !existsSync(JALUR_TARIKAN)) return null;
  const isi = gunzipSync(readFileSync(JALUR_TARIKAN)).toString("utf8");
  return JSON.parse(isi) as BerkasMentah[];
}

const tarikan = muatTarikan();
const adaTarikan = tarikan !== null && tarikan.length > 0;
const jalankan = adaTarikan ? describe : describe.skip;

if (!adaTarikan) {
  // Terlihat di keluaran uji, bukan lenyap tanpa jejak.
  console.warn(
    "[korpus-nyata] DILEWATI - tarikan blangko tidak ada. Setel ALETA_KORPUS_TARIKAN ke berkas korpus-mentah.json.gz."
  );
}

jalankan("menyusun ulang seluruh pustaka blangko", () => {
  const berkas = (tarikan ?? []).map((b) => ({ jalur: b.jalur, alinea: b.alinea }));
  const korpus = susunKorpus(berkas);

  it("tiap blangko tersusun kembali tepat kata demi kata", () => {
    const gagal: Array<{ jalur: string; sebab: string }> = [];

    for (let i = 0; i < berkas.length; i += 1) {
      const susun = korpus.susunan[i];
      const hasil = susunUlang(susun.urutan, korpus.blok);
      if (!hasil.berhasil) {
        gagal.push({ jalur: susun.jalur, sebab: `blok hilang: ${hasil.hilang.join(", ")}` });
        continue;
      }
      const harapan = alineaBergunaSaja(berkas[i].alinea);
      if (hasil.alinea.length !== harapan.length) {
        gagal.push({
          jalur: susun.jalur,
          sebab: `jumlah alinea berbeda: ${hasil.alinea.length} lawan ${harapan.length}`,
        });
        continue;
      }
      for (let j = 0; j < harapan.length; j += 1) {
        if (hasil.alinea[j] !== harapan[j]) {
          gagal.push({ jalur: susun.jalur, sebab: `alinea ke-${j} berbeda` });
          break;
        }
      }
    }

    if (gagal.length > 0) {
      console.error("[korpus-nyata] gagal disusun ulang:", gagal.slice(0, 10));
    }
    expect(gagal).toEqual([]);
  });

  it("korpus benar-benar memampatkan - blok jauh lebih sedikit daripada alinea", () => {
    const totalAlinea = korpus.susunan.reduce((a, s) => a + s.urutan.length, 0);
    // Kalau tidak ada pemampatan sama sekali, berarti tiap alinea unik dan
    // gagasan "satu kerangka dikali matriks keadaan" tidak terbukti.
    expect(korpus.blok.size).toBeLessThan(totalAlinea);
    console.log(
      `[korpus-nyata] ${berkas.length} blangko | ${totalAlinea} alinea terpakai | ${korpus.blok.size} blok unik | ${korpus.pergeseran.length} kelompok pergeseran`
    );
  });

  it("pergeseran terdaftar, tidak digabung diam-diam", () => {
    // Blok yang bentuknya sama tetapi teksnya berbeda HARUS muncul sebagai
    // pergeseran. Nol pergeseran pada 807 blangko yang dirawat tangan selama
    // bertahun-tahun berarti pendeteksinya tidak bekerja.
    expect(korpus.pergeseran.length).toBeGreaterThan(0);
    for (const g of korpus.pergeseran.slice(0, 5)) {
      expect(g.varian.length).toBeGreaterThan(1);
      const sidik = new Set(g.varian.map((v) => v.sidik));
      expect(sidik.size).toBe(g.varian.length);
    }
  });
});

jalankan("taksonomi atas nama berkas sungguhan", () => {
  it("golongan dokumen terbaca untuk hampir seluruh blangko", () => {
    const tanpaJenis: string[] = [];
    for (const b of tarikan ?? []) {
      if (!uraikanDimensi(b.jalur).jenis) tanpaJenis.push(b.jalur);
    }
    const bagian = tanpaJenis.length / (tarikan ?? []).length;
    if (tanpaJenis.length > 0) {
      console.log(`[korpus-nyata] tanpa golongan: ${tanpaJenis.length}`, tanpaJenis.slice(0, 5));
    }
    // Folder pribadi memuat blangko bernama bebas; sebagian memang tidak
    // menyatakan golongannya. Yang dijaga: itu perkecualian, bukan kebiasaan.
    expect(bagian).toBeLessThan(0.2);
  });

  it("dimensi BAS terbaca jauh lebih lengkap daripada rata-rata", () => {
    const bas = (tarikan ?? []).filter((b) => b.jalur.startsWith("berita_acara_sidang/"));
    expect(bas.length).toBeGreaterThan(50);
    const rata = bas.reduce((a, b) => a + kelengkapanDimensi(uraikanDimensi(b.jalur)), 0) / bas.length;
    console.log(`[korpus-nyata] rata-rata dimensi terbaca pada BAS: ${rata.toFixed(2)} dari 8`);
    expect(rata).toBeGreaterThan(2);
  });

  it("matriks keadaan memang berlubang - itulah sebab ABT tidak lengkap", () => {
    const bas = (tarikan ?? []).filter((b) => b.jalur.startsWith("berita_acara_sidang/"));
    const kunci = new Set(bas.map((b) => kunciDimensi(uraikanDimensi(b.jalur))));
    console.log(`[korpus-nyata] ${bas.length} berkas BAS menempati ${kunci.size} sel matriks`);
    // Sel yang ditempati lebih dari satu berkas berarti ada berkas kembar;
    // yang penting di sini: jumlah sel jauh lebih kecil daripada kombinasi yang
    // mungkin, dan itu membuktikan pustaka berkas tidak akan pernah lengkap.
    expect(kunci.size).toBeGreaterThan(5);
    expect(kunci.size).toBeLessThanOrEqual(bas.length);
  });
});
