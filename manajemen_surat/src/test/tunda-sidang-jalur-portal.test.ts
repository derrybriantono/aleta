/**
 * ============================================================================
 * JALAN DARI ANTRIAN SIDANG SAMPAI KE SIPP
 * ============================================================================
 *
 * Layanan penundaannya sudah dijaga `hasil-sidang-tunda.test.ts`. Yang dijaga
 * DI SINI jalannya: kotak nomor perkara -> halaman -> rute portal -> gerbang
 * -> SIPP. Empat lapis, dan tiap lapis punya caranya sendiri untuk diam-diam
 * membatalkan penjagaan lapis sebelumnya.
 *
 * ============================================================================
 * KERING SEBAGAI BAWAAN DI SETIAP LAPIS
 * ============================================================================
 *
 * `kering: false` harus disebut TEGAS di gerbang, di rute portal, dan di layar.
 * Satu lapis saja yang membalik bawaannya membuat tiga lapis lainnya sia-sia:
 * yang ditulis ini `perkara_jadwal_sidang` dan `perkara` pada basis data SIPP
 * yang sedang dipakai petugas, beserta tiga baris `sys_audittrail` yang harus
 * terbaca sebagaimana petugas menuliskannya sendiri.
 *
 * ============================================================================
 * ANTRIAN BOLEH GAGAL, PENUNDAAN TIDAK IKUT BATAL
 * ============================================================================
 *
 * Penundaan sidang adalah catatan resmi; antrian hanya papan panggil di ruang
 * tunggu. Tidak semua perkara mengambil nomor antrian - nol baris karena itu
 * bukan galat, dan gagalnya antrian tidak boleh menarik kembali penundaan yang
 * sudah benar.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const gerbang = baca("aleta_bot/routes/internalGatewayRoutes.js");
// Alur tombol tunda/putus dipindah dari gerbang ke sini (7 Okt 2026, kasus 273).
const alur = baca("aleta_bot/services/sidangHasilAlur.js");
const klien = baca("manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts");
const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang-tunda/route.ts");
// Satu layar untuk kedua hasil sidang. Dahulu dua berkas - `sidang-tunda.tsx`
// dan `sidang-putus.tsx` - dan keduanya dapat terbuka bersamaan, padahal sidang
// tidak dapat ditunda DAN diputus sekaligus.
const layar = baca("manajemen_surat/src/components/portal/hasil-sidang.tsx");
const antrian = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
const pengguna = baca("manajemen_surat/src/components/portal/aleta-ecourt-pengguna.tsx");

describe("kering sebagai bawaan di tiap lapis", () => {
  it("gerbang: kering kecuali disebut tegas sebaliknya", () => {
    expect(alur).toContain("const kering = badan.kering !== false;");
  });

  it("rute portal: kering kecuali disebut tegas sebaliknya", () => {
    expect(rute).toContain("kering: badan.kering !== false,");
  });

  it("layar: tombol tulis baru terbuka sesudah rencananya dibaca", () => {
    expect(layar).toContain("const rencanaKering = hasil?.ok === true && hasil.kering === true;");
    expect(layar).toContain("disabled={!rencanaKering || sibuk || sudahTertulis || atasNama?.ok === false}");
  });

  it("layar tidak pernah mengirim kering:false tanpa tombol yang terkunci", () => {
    // Tiap pemanggilan dengan kering=false berasal dari tombol "Tulis ke
    // SIPP", dan tiap tombol itu terkunci sampai rencananya dibaca. Yang
    // dijaga penguncinya, bukan jumlahnya - berkas ini memuat dua komponen
    // penulis sejak borang ringkas dipakai dari baris antrian.
    const semua = [...layar.matchAll(/kirim\(false\)/g)];
    expect(semua.length).toBeGreaterThan(0);
    for (const cocok of semua) {
      const i = cocok.index ?? 0;
      expect(layar.slice(Math.max(0, i - 400), i)).toContain("rencanaKering");
    }
  });
});

describe("audit trail memakai nama petugas, bukan nama ALETA", () => {
  /**
   * ==========================================================================
   * AKUN DITURUNKAN DARI PERKARANYA, TIDAK PERNAH DIKETIK
   * ==========================================================================
   *
   * Sampai 2.22.0 rute ini MENOLAK permintaan yang tidak menyebut username,
   * dan layarnya menanyakannya. Berkas ini menuntut kebalikannya sekarang -
   * dan pembalikan itu disengaja, bukan pelonggaran.
   *
   * Penundaan ditulis atas nama PANITERA SIDANG perkara itu, dan siapa
   * panitera sidangnya sudah melekat pada perkaranya sejak penetapan.
   * Aplikasi antrian sidang satker membacanya dari `perkara_panitera_pn`
   * (`antrian/php/_fungsi.php`), tidak pernah menanyakannya.
   *
   * Isian yang menanyakannya membuka pintu menulis atas nama orang lain, dan
   * TIDAK ADA satu pun pemeriksaan yang akan menangkapnya: audit trail SIPP
   * hanya mencatat nama yang diberikan kepadanya.
   */
  const layanan = baca("aleta_bot/services/sidangHasilService.js");

  it("layanan membaca panitera sidang dari perkaranya", () => {
    expect(layanan).toContain("async function akunPerkara(perkaraId) {");
    expect(layanan).toContain("FROM perkara_panitera_pn c");
    expect(layanan).toContain("JOIN v_users d ON d.panitera_id = c.panitera_id");
  });

  it("penundaan memakai panitera perkaranya, bukan nama yang dikirim - dan TANPA cadangan", () => {
    // Keputusan pengguna 7 Okt 2026: penginput di SIPP = PP perkara itu, siapa
    // pun yang menekan. PP yang tidak tercatat / ganda / tanpa akun DITOLAK,
    // tidak jatuh diam-diam ke username yang dikirim pemanggil.
    expect(layanan).toContain("const pp = await paniteraSidang(keadaan.perkaraId, keadaan.tanggalSidang);");
    expect(layanan).not.toContain("akunSipp(minta.olehUsername)");
  });

  it("rute TIDAK lagi menolak permintaan tanpa username", () => {
    expect(rute).not.toContain("Akun SIPP yang menuliskannya wajib disebut");
  });

  it("operator portal (penekan + akun SIPP miliknya) tercatat di jejak ALETA; username tidak lagi diteruskan", () => {
    // Dua pertanyaan yang berbeda: siapa yang namanya tercatat di SIPP (PP),
    // dan siapa yang menekan tombolnya di portal (jejak ALETA).
    expect(rute).toContain('operator: actorUserId || "portal"');
    expect(rute).toContain("operatorNama: String(aktor.name || aktor.email || \"\"),");
    expect(rute).toContain("operatorAkunSipp:");
    expect(rute).not.toContain("olehUsername: String(badan.olehUsername");
  });

  it("layar tidak menanyakan akun SIPP sama sekali", () => {
    // Bukan sekadar "tidak wajib" - tidak ada isiannya. Isian yang diisi
    // otomatis masih dapat disunting, dan yang dapat disunting akan disunting.
    expect(layar).not.toMatch(/olehUsername/);
    expect(layar).toContain("Aplikasi antrian membaca panitera");
  });

  it("percobaan yang DITOLAK ikut tercatat di jejak ALETA", () => {
    // sys_audittrail tidak menyimpan percobaan yang gagal - padahal justru itu
    // yang dicari ketika panitera sidang bertanya kenapa penundaannya tidak jadi.
    expect(gerbang).toContain('sidangHasilAlur.jalankanHasilSidang("tunda"');
    expect(alur).toContain('const aksi = jalan === "tunda" ? "tunda" : "putus";');
    expect(alur).toContain("berhasil: false,");
  });
});

describe("antrian digerakkan sesudahnya, dan gagalnya tidak membatalkan penundaan", () => {
  it("antrian hanya disentuh bila penundaannya berhasil", () => {
    // Alurnya di sidangHasilAlur.js sejak 7 Okt 2026.
    expect(alur).toContain("if (hasil.ok) {");
    expect(alur).toContain("antrian = await layanan.setelAntrian({");
  });

  it("status antrian yang disetel adalah SELESAI, bukan angka telanjang", () => {
    expect(alur).toContain("keadaan: layanan.ANTRIAN_SELESAI");
  });

  it("gagalnya antrian tidak mengubah kode balasan penundaan", () => {
    const potongan = alur;
    // Kode balasan ditentukan hasil penundaannya saja.
    expect(potongan).toContain("status: hasil.ok ? 200 : 409");
    expect(potongan).not.toMatch(/antrian\.ok\s*\?\s*200/);
  });

  it("layar menyebut nol baris bukan error", () => {
    expect(layar).toContain("Nol baris bukan error");
    expect(layar).toContain("Catatannya tetap sah dan tetap tersimpan");
  });
});

describe("kotak nomor perkara menjadi pintunya", () => {
  it("prop barunya mendahului pembuka status perkara", () => {
    expect(antrian).toContain("onBukaTunda?: (baris: { nomorPerkara: string; sidangId: string }) => void;");
    const iTunda = antrian.indexOf("{onBukaTunda ? (");
    const iStatus = antrian.indexOf(") : onBukaStatus ? (");
    expect(iTunda).toBeGreaterThan(-1);
    expect(iStatus).toBeGreaterThan(iTunda);
  });

  it("layar lain yang tidak menyediakannya tetap membuka status seperti sediakala", () => {
    // Prop-nya opsional, dan cabang lamanya utuh - bukan diganti.
    expect(antrian).toContain("onClick={() => onBukaStatus(baris.nomorPerkara)}");
  });

  it("sidangId yang dikirim adalah id baris jadwal, yang dibaca keadaanJadwal", () => {
    expect(antrian).toContain("onBukaTunda({ nomorPerkara: baris.nomorPerkara, sidangId: baris.sidangId })");
    expect(pengguna).toContain("/sidang-tunda/${encodeURIComponent(sidangId)}");
  });

  it("alamatnya lewat withBasePath - portal berjalan di bawah /aleta", () => {
    expect(pengguna).toContain("withBasePath(`/sidang-tunda/");
  });
});

describe("bungkus jawaban portal dibuka", () => {
  it("layar membuka { ok, data }, tidak membacanya langsung", () => {
    expect(layar).toContain("async function bukaBungkus<T>(balasan: Response)");
    expect(layar).toContain('?.data ?? ({} as T)');
    // Membaca isi.ok dari bungkusnya SELALU true - cabang gagal tidak pernah
    // menyala, dan penolakan terbaca sebagai keberhasilan.
    expect(layar).not.toMatch(/await\s+balasan\.json\(\)\)\s+as\s+Hasil/);
  });
});

describe("kewenangan dan jalur gerbangnya", () => {
  it("rute menuntut kapabilitas yang sama dengan layar antrian sidang", () => {
    const panel = rute.match(/pastikanKapabilitas\(db, actorUserId, "panel"\)/g) || [];
    // Dua-duanya: yang membaca keadaan sidang, dan yang menuliskannya.
    expect(panel.length).toBe(2);
  });

  it("klien gerbang menyebut kedua alamatnya", () => {
    expect(klien).toContain("/internal/aleta-bot/sidang/keadaan?");
    expect(klien).toContain("/internal/aleta-bot/sidang/tunda");
  });

  it("gerbang menuntut token internal, sama seperti rute penetapan", () => {
    // Sejak keputusan 104 (18 Okt 2026) rute tulis dibungkus manualJamKerja(...) sesudah token, ditulis multibaris.
    expect(gerbang).toMatch(/router\.post\(\s*"\/sidang\/tunda",\s*requireInternalToken,\s*manualJamKerja\(/);
    expect(gerbang).toContain('router.get("/sidang/keadaan", requireInternalToken');
  });
});

describe("tanggal tidak pernah bocor sebagai bahasa Inggris", () => {
  it("tanggal jadwal dilewatkan tanggalIso sebelum masuk teks", () => {
    // Penggerak MySQL memulangkan kolom DATE sebagai obyek Date. Menyisipkannya
    // apa adanya menghasilkan "Tue Mar 09 2027 00:00:00 GMT+0800 (Central
    // Indonesia Time)" - dan itu yang dibaca panitera sidang sebelum menekan
    // tombol tulis. Terjadi sekali, ketahuan hanya karena rencananya
    // dijalankan atas jadwal sungguhan.
    const layanan = baca("aleta_bot/services/sidangHasilService.js");
    expect(layanan).toContain("penetapan.tanggalIso(keadaan.tanggalSidang)");
    expect(layanan).not.toContain("menunda sidang ${keadaan.tanggalSidang}");
  });

  it("pembantunya diekspor dari satu tempat, tidak disalin", () => {
    const penetapan = baca("aleta_bot/services/penetapanTulisService.js");
    expect(penetapan).toContain("  tanggalIso,");
    const layanan = baca("aleta_bot/services/sidangHasilService.js");
    expect(layanan).not.toContain("function tanggalIso(");
  });
});

describe("sidang yang sudah ditunda tidak ditawari blangko", () => {
  it("blangkonya ditutup, bukan dibiarkan terbuka", () => {
    expect(layar).toContain("const sudahDitunda =");
    expect(layar).toContain("melahirkan baris jadwal berganda");
  });
});
