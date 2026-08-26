// @vitest-environment node

/**
 * Pemeriksa isi pesan.
 *
 * Uji yang paling menentukan di berkas ini BUKAN kemampuannya menemukan kata
 * bermasalah, melainkan kemampuannya DIAM pada isi pesan yang sah. Pemeriksa
 * yang berteriak pada kalimat yang benar akan diabaikan orang, dan pemeriksa
 * yang diabaikan sama saja dengan tidak ada.
 */

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  MAX_RECOMMENDED_EMOJI,
  MAX_RECOMMENDED_LENGTH,
  SHORTENER_HOSTS,
  lintTemplateBody,
  summarizeWarnings,
} from "@/lib/aleta-bot-message-linter";
import { listAletaBotTemplateDefaults } from "@/server/modules/aleta-bot/service";

const kode = (body: string) => lintTemplateBody(body).map((item) => item.code);

describe("Isi pesan bawaan tidak memicu peringatan palsu", () => {
  const templates = listAletaBotTemplateDefaults();

  it("ada isi pesan bawaan untuk diperiksa", () => {
    expect(templates.length).toBeGreaterThan(5);
  });

  it("tidak satu pun isi pesan bawaan yang diperingatkan", () => {
    const bermasalah = templates
      .map((template) => ({ id: template.id, warnings: lintTemplateBody(template.body) }))
      .filter((item) => item.warnings.length > 0);

    expect(
      bermasalah.map((item) => `${item.id}: ${item.warnings.map((w) => `${w.code} (${w.samples.join(", ")})`).join("; ")}`)
    ).toEqual([]);
  });
});

describe("Pencocokan per kata utuh, bukan potongan kata", () => {
  it('"menangani" tidak dianggap "menang"', () => {
    // Kasus nyata dari isi pesan ALETA sendiri.
    expect(kode("Majelis yang menangani perkara Anda telah ditetapkan.")).not.toContain("kata_promosi");
  });

  it('"Perseroan Terbatas" tidak dianggap penawaran terbatas', () => {
    expect(kode("Tergugat adalah sebuah Perseroan Terbatas.")).not.toContain("kata_promosi");
  });

  it('"segera" sendirian tidak diperingatkan', () => {
    // Isi pesan pegawai yang sah memang berbunyi begini.
    expect(kode("Disposisi jatuh tempo hari ini. Mohon segera ditindaklanjuti.")).toEqual([]);
  });

  it('"segera transfer" tetap diperingatkan', () => {
    expect(kode("Mohon segera transfer biaya perkara.")).toContain("kata_penipuan");
  });

  it('"berhadiah" tidak sama dengan "hadiah"', () => {
    // Batas kata dijaga di kedua sisi.
    expect(kode("Kata berhadiah tidak berdiri sendiri.")).not.toContain("kata_promosi");
  });
});

describe("Kosakata iklan", () => {
  it("menemukan kata iklan yang berdiri sendiri", () => {
    const hasil = lintTemplateBody("Dapatkan hadiah gratis, buruan klik di sini!");
    const promo = hasil.find((item) => item.code === "kata_promosi");
    expect(promo).toBeTruthy();
    expect(promo?.severity).toBe("tinggi");
    expect(promo?.samples).toEqual(expect.arrayContaining(["hadiah", "gratis", "buruan", "klik di sini"]));
  });

  it("tidak peduli huruf besar-kecil", () => {
    expect(kode("Ada DISKON besar")).toContain("kata_promosi");
  });
});

describe("Kalimat menyerupai penipuan", () => {
  it("menemukan permintaan rekening dan kode", () => {
    for (const teks of [
      "Kirim nomor rekening Anda.",
      "Masukkan kode OTP yang kami kirim.",
      "Silakan verifikasi data Anda di tautan berikut.",
      "Akun Anda diblokir, hubungi kami.",
    ]) {
      expect(kode(teks), teks).toContain("kata_penipuan");
    }
  });

  it("dinilai risiko tinggi", () => {
    const hasil = lintTemplateBody("Segera transfer ke rekening berikut.");
    expect(hasil.find((item) => item.code === "kata_penipuan")?.severity).toBe("tinggi");
  });

  it("penjelasannya mengarahkan ke jalur resmi", () => {
    const hasil = lintTemplateBody("Kirim uang ke nomor rekening ini.");
    expect(hasil.find((item) => item.code === "kata_penipuan")?.fix).toMatch(/bank|PTSP/i);
  });
});

describe("Tautan pemendek", () => {
  it("menemukan pemendek yang dikenal", () => {
    expect(kode("Isi survei di https://s.id/LTYh1")).toContain("pemendek_tautan");
    expect(kode("Cek https://bit.ly/abc123")).toContain("pemendek_tautan");
  });

  it("domain resmi tidak diperingatkan", () => {
    expect(kode("Isi survei di https://pa-donggala.go.id/survei")).toEqual([]);
    expect(kode("Daftar di https://eac.mahkamahagung.go.id/")).toEqual([]);
  });

  it("daftar pemendek sama persis dengan yang dipakai bot", () => {
    // Bila keduanya berbeda, portal memperingatkan tautan yang tidak dicatat
    // bot, atau sebaliknya - dan ketidakcocokan seperti itu membuat keduanya
    // tidak bisa dipercaya.
    const sumber = fs.readFileSync(
      path.resolve(process.cwd(), "..", "aleta_bot", "services", "outgoingChatService.js"),
      "utf8"
    );
    const blok = sumber.match(/const SHORTENER_HOSTS = \[([\s\S]*?)\];/);
    expect(blok, "SHORTENER_HOSTS tidak ditemukan di outgoingChatService.js").toBeTruthy();
    const dariBot = [...blok![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect([...dariBot].sort()).toEqual([...SHORTENER_HOSTS].sort());
  });
});

describe("Bentuk tulisan", () => {
  it("kata kapital semua diperingatkan", () => {
    const hasil = lintTemplateBody("Pesan PENTING sekali untuk Anda.");
    const caps = hasil.find((item) => item.code === "huruf_kapital");
    expect(caps?.samples).toContain("PENTING");
  });

  it("singkatan resmi tidak diperingatkan", () => {
    expect(kode("Silakan ke meja PTSP. Data ada di SIPP. Bawa KTP dan cek WITA.")).toEqual([]);
  });

  it("kata perintah balasan tidak diperingatkan", () => {
    // Kata-kata ini memang harus kapital supaya pihak menyalinnya persis.
    expect(kode("Balas BERHENTI untuk menghentikan. Balas LANJUT untuk mengaktifkan.")).toEqual([]);
  });

  it("variabel tidak ikut dianalisis", () => {
    expect(kode("Halo {{nama_pihak}}, perkara {{nomor_perkara}} sudah terdaftar.")).toEqual([]);
  });

  it("emoji berlebihan diperingatkan", () => {
    expect(kode("Halo 😀😀😀😀😀 selamat datang")).toContain("emoji_berlebihan");
  });

  it("emoji sedikit tidak diperingatkan", () => {
    expect(kode("Halo 😀 selamat datang")).not.toContain("emoji_berlebihan");
    expect(kode("Selamat 😀😀😀 datang")).not.toContain("emoji_berlebihan");
  });

  it("bintang ganda diperingatkan", () => {
    const hasil = lintTemplateBody("Nama: **Ahmad Fauzi**");
    const bintang = hasil.find((item) => item.code === "bintang_ganda");
    expect(bintang?.samples).toContain("**Ahmad Fauzi**");
    expect(bintang?.severity).toBe("rendah");
  });

  it("bintang tunggal tidak diperingatkan", () => {
    expect(kode("Nama: *Ahmad Fauzi*")).toEqual([]);
  });

  it("tanda baca beruntun diperingatkan", () => {
    expect(kode("Penting sekali!!!")).toContain("tanda_baca_beruntun");
    expect(kode("Penting sekali!")).not.toContain("tanda_baca_beruntun");
  });

  it("isi pesan sangat panjang diperingatkan", () => {
    expect(kode(`Pemberitahuan sidang. ${"a".repeat(MAX_RECOMMENDED_LENGTH)}`)).toContain("pesan_terlalu_panjang");
  });
});

describe("Sikap pemeriksa", () => {
  it("isi pesan kosong tidak menghasilkan peringatan", () => {
    expect(lintTemplateBody("")).toEqual([]);
    expect(lintTemplateBody("   ")).toEqual([]);
  });

  it("masukan bukan teks tidak melempar galat", () => {
    expect(() => lintTemplateBody(null as unknown as string)).not.toThrow();
    expect(() => lintTemplateBody(undefined as unknown as string)).not.toThrow();
    expect(lintTemplateBody(null as unknown as string)).toEqual([]);
  });

  it("peringatan terberat berada di urutan pertama", () => {
    const hasil = lintTemplateBody("HADIAH gratis!!! Klik di sini https://s.id/abc 😀😀😀😀");
    expect(hasil.length).toBeGreaterThan(2);
    expect(hasil[0].severity).toBe("tinggi");
    expect(hasil[hasil.length - 1].severity).toBe("rendah");
  });

  it("setiap peringatan menjelaskan alasan dan cara memperbaikinya", () => {
    const hasil = lintTemplateBody("GRATIS!!! klik di sini https://bit.ly/x 😀😀😀😀😀");
    for (const item of hasil) {
      expect(item.label.length, item.code).toBeGreaterThan(5);
      expect(item.detail.length, item.code).toBeGreaterThan(40);
      expect(item.fix.length, item.code).toBeGreaterThan(10);
      expect(item.samples.length, item.code).toBeGreaterThan(0);
    }
  });

  it("ringkasan menghitung per tingkat", () => {
    const hasil = lintTemplateBody("GRATIS!!! https://s.id/abc");
    const ringkas = summarizeWarnings(hasil);
    expect(ringkas.total).toBe(hasil.length);
    expect(ringkas.tinggi + ringkas.sedang + ringkas.rendah).toBe(ringkas.total);
    expect(ringkas.tinggi).toBeGreaterThan(0);
  });

  it("emoji dihitung, bukan ditebak dari panjang", () => {
    expect(MAX_RECOMMENDED_EMOJI).toBeGreaterThan(0);
    expect(MAX_RECOMMENDED_LENGTH).toBeGreaterThan(500);
  });
});
