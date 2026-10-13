/**
 * Dua perbaikan dari satu tangkapan layar Audit Trail:
 *
 *   1. PHS ikut ditawarkan pada "Pejabat yang menetapkan" - calonnya anggota
 *      majelis perkara itu saja, ketua di depan.
 *   2. Bongkar berjeda seperti pekerjaan tangan: empat belas baris audit
 *      berdetik sama atas nama tiga akun adalah tanda pekerjaan mesin.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (p: string) => readFileSync(path.join(AKAR, p), "utf8");

const rencana = baca("manajemen_surat/src/server/modules/aleta-ecourt/rencana-penetapan.ts");
const tulis = baca("aleta_bot/services/penetapanTulisService.js");
const gerbang = baca("aleta_bot/routes/internalGatewayRoutes.js");

describe("PHS boleh dipilih penanda tangannya", () => {
  it("calonnya anggota majelis perkara itu, bukan seluruh hakim", () => {
    // Membuka seluruh hakim membuat PHS dapat tercatat atas nama hakim yang
    // tidak duduk di majelisnya.
    expect(rencana).toContain("function calonPhs(");
    expect(rencana).toContain("calon = calonPhs(akunPemetaan, usulan.pmh.anggotaHakimId, idKetuaPhs);");
  });

  it("ketua majelis tetap yang otomatis; anggota disebut apa adanya", () => {
    expect(rencana).toContain('sebutan: id === ketuaHakimId ? "Ketua Majelis" : "Hakim Anggota",');
    expect(rencana).toContain("otomatis: id === ketuaHakimId,");
  });

  it("akun yang diblokir atau kedaluwarsa tidak ditawarkan", () => {
    const fungsi = rencana.slice(rencana.indexOf("function calonPhs("));
    expect(fungsi.slice(0, 900)).toContain("!x!.diblokir && !x!.kedaluwarsa");
  });

  it("calonPenetap untuk hakim tetap kosong - jalurnya bukan di sana", () => {
    expect(rencana).toContain('if (jabatan === "hakim") return [];');
  });
});

describe("bongkar: akun pejabat yang sama, jam SIPP seperti orang bekerja (butir 17)", () => {
  const hapus = gerbang.slice(
    gerbang.indexOf('router.post("/penetapan/hapus"'),
    gerbang.indexOf('router.post("/penetapan/hapus-semua"')
  );
  const semua = gerbang.slice(gerbang.indexOf('router.post("/penetapan/hapus-semua"'));
  const susun = tulis.slice(tulis.indexOf("async function susunRencanaHapus(minta) {"));

  it("rangkaian bongkar-semua disusun SEKALI dan diserahkan per langkah", () => {
    expect(semua).not.toContain("waktuBongkar(");
    expect(semua).toContain("penetapanTulisService.jadwalJamSipp(perkaraId, penetapanTulisService.URUTAN_BONGKAR");
    expect(semua).toContain('saatSipp: jadwal.jam[jenis] || "",');
    expect(susun).toContain("jamSippSah(minta.saatSipp)");
  });

  it("jeda sungguhan sebelum tiap tulisan, tidak pada uji kering", () => {
    expect(hapus).toContain('if (!kering) await jedaManusiaService.jeda("simpan", { kering });');
    expect(semua).toContain('if (!kering) await jedaManusiaService.jeda("simpan", { kering });');
  });

  it("dicatat atas akun pejabat (akunPembatalan); akun yang masuk tetap wajib untuk membongkar sungguhan", () => {
    expect(hapus).toContain('akunSippMasuk: String(badan.akunSippMasuk || ""),');
    expect(semua).toContain("akunSippMasuk,");
    expect(susun).toContain("const akun = await akunPembatalan(jenis, perkara.perkaraId, minta.olehUsername);");
    expect(susun).toContain('return { ok: false, alasan: "akun_sipp_belum_terbaca" };');
  });

  it("ekstensi mengirim nama akun SIPP yang masuk pada kedua jalur bongkar", () => {
    const konten = baca("ekstensi-sipp/konten.js");
    expect(konten).toContain("JSON.stringify({ jenis, perkaraId, olehUsername, akunSippMasuk: namaPenggunaSipp(), kering })");
    expect(konten).toContain("JSON.stringify({ perkaraId, akunPerJenis, akunSippMasuk: namaPenggunaSipp(), kering })");
  });
});
