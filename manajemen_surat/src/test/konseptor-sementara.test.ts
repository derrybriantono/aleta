import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { bandingkanKonseptor } from "@/lib/konseptor-sementara";

/**
 * ============================================================================
 * KONSEPTOR SEMENTARA - TUNJUKAN TANGAN, DAN SELISIHNYA DENGAN SIPP
 * ============================================================================
 *
 * Yang paling perlu dijaga bukan tombolnya, melainkan satu kekeliruan yang
 * sangat mudah dibuat dan tidak akan berbunyi: menyatakan "berbeda dari SIPP"
 * pada perkara yang SIPP-nya belum punya nama sama sekali.
 *
 * Kekeliruan itu menyalakan penanda merah pada hampir setiap perkara yang
 * naskahnya memang belum diunggah - yaitu pada keadaan yang paling lazim -
 * dan penanda merah yang menyala di mana-mana adalah penanda yang dipelajari
 * orang untuk dilewati.
 */

const AKAR = process.cwd();

describe("bandingkanKonseptor - tiga keadaan yang tampak mirip", () => {
  const TUNJUK = { nama: "Fulan Bin Alan", pengguna: "fulan" };

  it("SIPP belum punya nama: tidak ada yang dapat dibanding", () => {
    for (const sipp of [null, undefined, [], [{ nama: "", pengguna: "" }]]) {
      const hasil = bandingkanKonseptor(TUNJUK, sipp);
      expect(hasil.adaTunjukan).toBe(true);
      expect(hasil.adaSipp).toBe(false);
      expect(hasil.berbeda, "menuduh berbeda padahal SIPP belum mencatat apa pun").toBe(false);
    }
  });

  it("belum ada tunjukan: juga tidak ada yang dapat dibanding", () => {
    for (const tunjuk of [null, undefined, { nama: "" }, { nama: "   " }]) {
      const hasil = bandingkanKonseptor(tunjuk, [{ nama: "Fulan Bin Alan" }]);
      expect(hasil.adaTunjukan).toBe(false);
      expect(hasil.berbeda).toBe(false);
    }
  });

  it("keduanya ada dan sama: tidak dikatakan apa pun", () => {
    expect(bandingkanKonseptor(TUNJUK, [{ nama: "Fulan Bin Alan" }]).berbeda).toBe(false);
  });

  it("keduanya ada dan berbeda: inilah yang ditandai", () => {
    const hasil = bandingkanKonseptor(TUNJUK, [{ nama: "Sarifah Binti Umar" }]);
    expect(hasil.adaSipp).toBe(true);
    expect(hasil.berbeda).toBe(true);
    expect(hasil.namaSipp).toBe("Sarifah Binti Umar");
  });
});

describe("gelar tidak membuat orang yang sama menjadi dua orang", () => {
  it("menyamakan nama bergelar dengan nama telanjang", () => {
    // Nama di SIPP hampir selalu bergelar; yang diketik tangan hampir tidak
    // pernah. Membandingkan mentah akan menandai "berbeda" pada hampir setiap
    // tunjukan yang justru benar.
    for (const [tunjuk, sipp] of [
      ["Fulan Bin Alan", "Drs. H. Fulan Bin Alan, S.H., M.H."],
      ["Drs. Fulan", "Fulan"],
      ["Hj. Sarifah", "Sarifah, S.Ag."],
    ]) {
      expect(
        bandingkanKonseptor({ nama: tunjuk }, [{ nama: sipp }]).berbeda,
        `${tunjuk} vs ${sipp}`
      ).toBe(false);
    }
  });

  it("tetap membedakan orang yang memang berbeda", () => {
    expect(
      bandingkanKonseptor({ nama: "Drs. H. Fulan, S.H." }, [{ nama: "Drs. H. Sarifah, S.H." }])
        .berbeda
    ).toBe(true);
  });
});

describe("naskah yang disentuh beberapa orang", () => {
  it("cukup SALAH SATU nama SIPP yang cocok", () => {
    // Menuntut yang PERTAMA cocok akan menandai "berbeda" pada perkara yang
    // justru dikerjakan orang yang ditunjuk, hanya karena orang lain lebih
    // dahulu menyentuh naskahnya.
    const hasil = bandingkanKonseptor({ nama: "Fulan" }, [
      { nama: "Sarifah" },
      { nama: "Fulan" },
    ]);
    expect(hasil.berbeda).toBe(false);
  });

  it("baru berbeda bila TIDAK SATU pun cocok", () => {
    expect(
      bandingkanKonseptor({ nama: "Fulan" }, [{ nama: "Sarifah" }, { nama: "Umar" }]).berbeda
    ).toBe(true);
  });

  it("username juga dapat mencocokkan bila kedua sisi punya", () => {
    // Nama SIPP kerap tidak terbaca sama sekali - lihat namaTerbaca pada
    // pembacaan konseptor - dan yang tersisa hanya usernamenya.
    expect(
      bandingkanKonseptor({ nama: "Fulan", pengguna: "fulan.pa" }, [
        { nama: "", pengguna: "Fulan.PA" },
      ]).berbeda
    ).toBe(false);
  });
});

describe("aturan bandingnya hidup di @/lib, bukan di @/server", () => {
  it("layar antrian mengimpornya dari @/lib", () => {
    // Komponen klien yang mengimpor modul peladen ikut menyeret kueri basis
    // datanya ke dalam bundel peramban.
    const layar = fs.readFileSync(
      path.join(AKAR, "src/components/portal/aleta-ecourt-sidang.tsx"),
      "utf8"
    );
    expect(layar).toContain('from "@/lib/konseptor-sementara"');
    expect(layar).not.toContain(
      'from "@/server/modules/aleta-ecourt/konseptor-sementara"'
    );
  });

  it("bentuk tunjukannya tidak disalin ke layar", () => {
    const layar = fs.readFileSync(
      path.join(AKAR, "src/components/portal/aleta-ecourt-sidang.tsx"),
      "utf8"
    );
    expect(layar).not.toContain("type KonseptorSementara = {");
  });
});

describe("tabel dan migrasinya", () => {
  it("migrasi 0046 ada dan terdaftar di journal", () => {
    expect(fs.existsSync(path.join(AKAR, "drizzle/0046_konseptor_sementara.sql"))).toBe(true);
    const jurnal = JSON.parse(
      fs.readFileSync(path.join(AKAR, "drizzle/meta/_journal.json"), "utf8")
    ) as { entries: Array<{ idx: number; tag: string }> };
    const punya = jurnal.entries.filter((e) => e.idx === 46);
    // Satu, bukan dua: dua sesi yang mengklaim nomor yang sama akan bentrok
    // diam-diam, dan yang kedua tidak pernah dijalankan.
    expect(punya.length).toBe(1);
    expect(punya[0].tag).toBe("0046_konseptor_sementara");
  });

  it("skema dan migrasinya menyebut kolom yang sama", () => {
    const skema = fs.readFileSync(path.join(AKAR, "src/server/db/schema.ts"), "utf8");
    const migrasi = fs.readFileSync(
      path.join(AKAR, "drizzle/0046_konseptor_sementara.sql"),
      "utf8"
    );
    // Basis data baru dibuat dari schema.ts; yang sudah ada ditambal migrasi.
    // Keduanya menyimpang berarti dua peladen berbentuk beda tanpa berbunyi.
    for (const kolom of [
      "perkara_id",
      "nomor_perkara",
      "nama",
      "pengguna",
      "catatan",
      "ditetapkan_oleh",
      "ditetapkan_at",
    ]) {
      expect(skema).toContain(`aleta_konseptor_sementara`);
      expect(migrasi, `migrasi tidak menyebut ${kolom}`).toContain(kolom);
    }
  });

  it("tidak ada kolom 'aktif' - yang menghentikannya jawaban SIPP, bukan bendera", () => {
    // Bendera yang harus diperbarui oleh sesuatu di luar dirinya adalah
    // bendera yang cepat atau lambat berbohong.
    const migrasi = fs.readFileSync(
      path.join(AKAR, "drizzle/0046_konseptor_sementara.sql"),
      "utf8"
    );
    const badan = migrasi.slice(migrasi.indexOf("CREATE TABLE"));
    expect(badan).not.toMatch(/\baktif\b/);
  });
});

describe("SIPP tidak pernah ditulis dari jalur ini", () => {
  it("rutenya tidak menyentuh jembatan SIPP sama sekali", () => {
    // Tunjukan tangan bukan fakta perkara. Menuliskannya ke jejak tahapan
    // SIPP membuat penunjukan terbaca sebagai pekerjaan yang sudah selesai.
    const rute = fs.readFileSync(
      path.join(AKAR, "src/app/api/aleta-ecourt/konseptor-sementara/route.ts"),
      "utf8"
    );
    expect(rute).not.toContain("whatsapp-gateway-client");
    expect(rute).not.toMatch(/INSERT|UPDATE/);
  });

  it("nama penunjuk diambil dari sesi, tidak dari muatan", () => {
    const rute = fs.readFileSync(
      path.join(AKAR, "src/app/api/aleta-ecourt/konseptor-sementara/route.ts"),
      "utf8"
    );
    expect(rute).toContain("oleh: aktor.name");
    expect(rute).not.toContain("masukan.oleh");
  });
});
