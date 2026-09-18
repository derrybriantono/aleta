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
const klien = baca("manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts");
const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang-tunda/route.ts");
const layar = baca("manajemen_surat/src/components/portal/sidang-tunda.tsx");
const antrian = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
const pengguna = baca("manajemen_surat/src/components/portal/aleta-ecourt-pengguna.tsx");

describe("kering sebagai bawaan di tiap lapis", () => {
  it("gerbang: kering kecuali disebut tegas sebaliknya", () => {
    expect(gerbang).toContain("const kering = badan.kering !== false;");
  });

  it("rute portal: kering kecuali disebut tegas sebaliknya", () => {
    expect(rute).toContain("kering: badan.kering !== false,");
  });

  it("layar: tombol tulis baru terbuka sesudah rencananya dibaca", () => {
    expect(layar).toContain("const rencanaKering = hasil?.ok === true && hasil.kering === true;");
    expect(layar).toContain("disabled={!rencanaKering || sibuk || sudahTertulis}");
  });

  it("layar tidak pernah mengirim kering:false tanpa tombol keduanya", () => {
    // Satu-satunya pemanggilan dengan kering=false adalah tombol "Tulis ke
    // SIPP", dan tombol itu sendiri terkunci sampai rencananya dibaca.
    const kirimFalse = layar.match(/kirim\(false\)/g) || [];
    expect(kirimFalse.length).toBe(1);
  });
});

describe("audit trail memakai nama petugas, bukan nama ALETA", () => {
  it("akun SIPP wajib disebut, dan rute menolak bila kosong", () => {
    expect(rute).toContain("Akun SIPP yang menuliskannya wajib disebut");
  });

  it("operator portal disimpan terpisah dari akun SIPP", () => {
    // Dua pertanyaan yang berbeda: siapa yang namanya tercatat di SIPP, dan
    // siapa yang menekan tombolnya di portal.
    expect(rute).toContain('operator: actorUserId || "portal"');
    expect(rute).toContain("olehUsername,");
  });

  it("layar menerangkan nama siapa yang akan muncul", () => {
    expect(layar).toContain("Nama inilah yang muncul pada audit trail SIPP");
    expect(layar).toContain("ALETA tidak pernah menulis atas nama dirinya sendiri");
  });

  it("percobaan yang DITOLAK ikut tercatat di jejak ALETA", () => {
    // sys_audittrail tidak menyimpan percobaan yang gagal - padahal justru itu
    // yang dicari ketika panitera sidang bertanya kenapa penundaannya tidak jadi.
    const potongan = gerbang.slice(gerbang.indexOf('router.post("/sidang/tunda"'));
    expect(potongan).toContain('aksi: "tunda"');
    expect(potongan).toContain("berhasil: false,");
  });
});

describe("antrian digerakkan sesudahnya, dan gagalnya tidak membatalkan penundaan", () => {
  it("antrian hanya disentuh bila penundaannya berhasil", () => {
    const potongan = gerbang.slice(gerbang.indexOf('router.post("/sidang/tunda"'));
    expect(potongan).toContain("if (hasil.ok) {");
    expect(potongan).toContain("sidangHasilService.setelAntrian({");
  });

  it("status antrian yang disetel adalah SELESAI, bukan angka telanjang", () => {
    expect(gerbang).toContain("keadaan: sidangHasilService.ANTRIAN_SELESAI");
  });

  it("gagalnya antrian tidak mengubah kode balasan penundaan", () => {
    const potongan = gerbang.slice(gerbang.indexOf('router.post("/sidang/tunda"'));
    // Kode balasan ditentukan hasil penundaannya saja.
    expect(potongan).toContain("res.status(hasil.ok ? 200 : 409)");
    expect(potongan).not.toMatch(/antrian\.ok\s*\?\s*200/);
  });

  it("layar menyebut nol baris bukan galat", () => {
    expect(layar).toContain("Nol baris bukan galat");
    expect(layar).toContain("Penundaannya tetap sah dan tetap tercatat");
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
    expect(gerbang).toContain('router.post("/sidang/tunda", requireInternalToken');
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

describe("sidang yang sudah ditunda tidak ditawari borang", () => {
  it("borangnya ditutup, bukan dibiarkan terbuka", () => {
    expect(layar).toContain("const sudahDitunda =");
    expect(layar).toContain("melahirkan baris jadwal berganda");
  });
});
