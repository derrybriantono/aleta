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

describe("bongkar berjeda seperti pekerjaan tangan", () => {
  it("jam tiap langkah bongkar dihitung sekali untuk seluruh rangkaian", () => {
    expect(tulis).toContain("async function waktuBongkar(perkaraId) {");
    expect(gerbang).toContain("const jamBongkar = await penetapanTulisService.waktuBongkar(perkaraId);");
    expect(gerbang).toContain("saat: jamBongkar[jenis],");
  });

  it("PMH paling akhir = sekarang; tidak ada baris bertanggal masa depan", () => {
    // Dibalik dari URUTAN_BONGKAR (phs, pjs, ppp, pmh): yang pertama dalam
    // urutan terbalik - pmh - mendapat mundur nol.
    expect(tulis).toContain("const dariAkhir = [...URUTAN_BONGKAR].reverse();");
    expect(tulis).toContain("if (i > 0) mundurMenit += jedaLangkah(benih, i - 1);");
    expect(tulis).toContain("dasar.getTime() - mundurMenit * 60000");
  });

  it("benihnya digeser dari jalur tulis - pola jeda yang identik pun sebuah tanda", () => {
    expect(tulis).toContain("benihDari(Number(perkaraId) * 3 + 1)");
  });

  it("susunRencanaHapus hanya menerima jam yang berbentuk sah", () => {
    // Jam sembarang dari pemanggil tidak boleh sampai ke sys_audittrail.
    expect(tulis).toContain("test(String(minta.saat || \"\"))");
    expect(tulis).toContain(": await waktuBasisData();");
  });

  it("bongkar satu langkah tetap memakai jam basis data sekarang", () => {
    // Tombol "Batalkan penetapan terakhir" tidak mengirim saat - dan memang
    // tidak perlu: satu langkah, satu jam.
    const potong = gerbang.slice(gerbang.indexOf('router.post("/penetapan/hapus"'), gerbang.indexOf('router.post("/penetapan/hapus-semua"'));
    expect(potong).not.toContain("jamBongkar");
  });
});
