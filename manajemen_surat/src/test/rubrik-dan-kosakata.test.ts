// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { lintTemplateBody } from "@/lib/aleta-bot-message-linter";

/**
 * ============================================================================
 * DUA KETERBATASAN BERSEBAB SAMA - B-10
 * ============================================================================
 *
 * 1.31.0: "Bobot skor ditetapkan aplikasi dan belum dapat diubah pengadilan."
 * 1.15.0: "Daftar kosakata belum dapat disunting dari portal - penambahan kata
 *          baru masih lewat pembaruan aplikasi."
 *
 * Keduanya memaksa PEMASANGAN VERSI BARU untuk perubahan yang sifatnya
 * pengaturan. Satu kata baru pada kosakata berarti satu putaran
 * paket-unggah-pasang untuk satu baris teks - dan itulah sebabnya kosakatanya
 * jarang bertambah, padahal kosakata penipuan yang paling cepat berubah di
 * dunia nyata.
 */

const require_ = createRequire(import.meta.url);
const akarBot = path.resolve(process.cwd(), "../aleta_bot");

type Pengaturan = {
  ambangBaik: number;
  ambangPerhatian: number;
  bulanPenuh: number;
  bulanNol: number;
};

const penilaian = require_(path.join(akarBot, "services/penilaianPerkaraService.js")) as {
  BAWAAN: Pengaturan & { bobot: Record<string, number> };
  BUTIR: Array<{ kunci: string; bobot: number }>;
  predikat: (skor: number, pengaturan?: Partial<Pengaturan>) => string;
  saveSettings: (muatan: Record<string, unknown>) => { ok: boolean; alasan?: string };
};

const kosakata = require_(path.join(akarBot, "services/kosakataService.js")) as {
  BATAS_JUMLAH: number;
  BATAS_PANJANG: number;
  JENIS: Record<string, unknown>;
  bersihkan: (daftar: unknown) => string[];
};

describe("ambang predikat dapat diubah pengadilan", () => {
  it("bawaannya tetap 85 dan 60", () => {
    // Bawaan yang bergeser diam-diam akan mengubah predikat SELURUH perkara
    // yang sudah pernah dinilai, surut ke belakang, tanpa seorang pun memintanya.
    expect(penilaian.BAWAAN.ambangBaik).toBe(85);
    expect(penilaian.BAWAAN.ambangPerhatian).toBe(60);
  });

  it("batasnya tepat di angkanya, bukan di atasnya", () => {
    // Tepat 85 harus "baik". Ambang yang meleset satu angka menggeser
    // perkara yang persis di batas - dan perkara yang persis di batas
    // justru yang paling sering dipersoalkan.
    expect(penilaian.predikat(85)).toBe("baik");
    expect(penilaian.predikat(84)).toBe("perhatian");
    expect(penilaian.predikat(60)).toBe("perhatian");
    expect(penilaian.predikat(59)).toBe("kurang");
  });

  it("ambang yang diubah benar-benar dipakai", () => {
    const longgar = { ambangBaik: 70, ambangPerhatian: 40 };
    expect(penilaian.predikat(72, longgar)).toBe("baik");
    expect(penilaian.predikat(45, longgar)).toBe("perhatian");
    expect(penilaian.predikat(39, longgar)).toBe("kurang");
  });

  it("ambang terbalik DITOLAK, tidak diterima diam-diam", () => {
    // Kalau perhatian >= baik, golongan tengah tidak akan pernah terpakai -
    // dan tidak ada satu pun galat yang muncul. Yang terjadi hanya seluruh
    // perkara terbagi dua, dan yang mengaturnya menyangka golongan tengahnya
    // memang kosong.
    const hasil = penilaian.saveSettings({ ambangBaik: 50, ambangPerhatian: 80 });
    expect(hasil.ok).toBe(false);
    expect(hasil.alasan).toBe("ambang_perhatian_harus_lebih_kecil");

    const sama = penilaian.saveSettings({ ambangBaik: 70, ambangPerhatian: 70 });
    expect(sama.ok).toBe(false);
  });

  it("tidak ada lagi ambang yang dipakai langsung dari kode", () => {
    // Yang dijaga PEMAKAIANNYA, bukan hurufnya. Bentuk lamanya masih dikutip
    // di dalam komentar - dan memang harus: di situlah tercatat apa yang
    // dahulu terjadi dan kenapa diubah. Menjaga hurufnya akan menghukum
    // orang yang menerangkan keputusannya, persis kekeliruan yang sudah
    // pernah membuat uji sidebar e-Court gagal atas komentar.
    const isi = readFileSync(path.join(akarBot, "services/penilaianPerkaraService.js"), "utf8");
    expect(isi).not.toContain('keadaan: skor >= 85');
    expect(isi).toContain("keadaan: predikat(skor, pengaturan)");
  });
});

describe("kosakata pemeriksa pesan dapat ditambah", () => {
  it("dirapikan, dikecilkan hurufnya, dan tidak kembar", () => {
    // Pemeriksanya membandingkan dalam huruf kecil. Butir bertulisan besar
    // tidak akan pernah cocok, dan ketidakcocokan itu tidak menampakkan
    // dirinya sendiri.
    expect(kosakata.bersihkan(["  KODE   OTP ", "kode otp", "Transfer Sekarang"])).toEqual([
      "kode otp",
      "transfer sekarang",
    ]);
  });

  it("butir sependek dua huruf dibuang", () => {
    // Butir sependek itu cocok dengan hampir seluruh pesan, dan peringatan
    // yang selalu berbunyi berhenti dibaca.
    expect(kosakata.bersihkan(["ab", "x", "", "  "])).toEqual([]);
  });

  it("jumlah dan panjangnya dibatasi", () => {
    const banyak = Array.from({ length: kosakata.BATAS_JUMLAH + 50 }, (_, i) => `frasa-uji-${i}`);
    expect(kosakata.bersihkan(banyak)).toHaveLength(kosakata.BATAS_JUMLAH);

    const panjang = "a".repeat(kosakata.BATAS_PANJANG + 40);
    expect(kosakata.bersihkan([panjang])[0]).toHaveLength(kosakata.BATAS_PANJANG);
  });

  it("ketiga jenisnya dikenali", () => {
    expect(Object.keys(kosakata.JENIS).sort()).toEqual(["pemendek", "phishing", "promosi"]);
  });
});

describe("pemeriksa pesan memakai kosakata tambahan", () => {
  const pesanUji = "Mohon segera lakukan setoran ganti rugi ke petugas kami.";

  it("tanpa tambahan, frasa itu lolos", () => {
    const warnings = lintTemplateBody(pesanUji);
    expect(warnings.some((w) => w.code === "frasa_penipuan")).toBe(false);
  });

  it("dengan tambahan, frasa itu tertangkap", () => {
    const warnings = lintTemplateBody(pesanUji, { phishing: ["setoran ganti rugi"] });
    const temuan = warnings.find((w) => w.samples.includes("setoran ganti rugi"));
    expect(temuan, "frasa tambahan seharusnya tertangkap").toBeTruthy();
  });

  it("daftar bawaan TETAP berlaku walau tambahannya kosong", () => {
    // Inilah jaminan yang paling penting. Kalau menambahkan daftar kosong
    // dapat mematikan daftar bawaan, maka layar yang baru dibuka - dengan
    // seluruh kotak masih kosong - akan mematikan seluruh pemeriksaannya.
    const warnings = lintTemplateBody("Kirim kode otp Anda sekarang juga.", {
      phishing: [],
      promosi: [],
      pemendek: [],
    });
    expect(warnings.some((w) => w.samples.includes("kode otp"))).toBe(true);
  });

  it("bawaan tidak dapat dihapus lewat tambahan", () => {
    // Menambahkan frasa yang sama tidak menggandakannya, dan tidak ada jalan
    // apa pun untuk mengurangi. Daftar penipuan memuat "kode otp" dan "segera
    // transfer"; membolehkan penghapusan berarti membuka jalan bagi pesan yang
    // paling berbahaya - yang mengatasnamakan pengadilan dan meminta uang.
    const warnings = lintTemplateBody("Kirim kode otp Anda.", { phishing: ["kode otp"] });
    const temuan = warnings.filter((w) => w.samples.includes("kode otp"));
    expect(temuan).toHaveLength(1);
    expect(temuan[0].samples.filter((x) => x === "kode otp")).toHaveLength(1);
  });

  it("pemendek tambahan ikut dikenali", () => {
    const warnings = lintTemplateBody("Buka https://contoh.link/abc untuk melihat berkas.", {
      pemendek: ["contoh.link"],
    });
    expect(warnings.some((w) => w.code === "pemendek_tautan")).toBe(true);
  });
});

describe("jalannya sampai ke layar, bukan berhenti di mesin", () => {
  const akar = path.resolve(process.cwd(), "..");

  it("rubrik punya rute portal beserta pemanggilnya", () => {
    // Rute bot untuk rubrik sudah lama ada, tetapi TIDAK ADA satu pun jalan
    // dari portal menuju ke sana - sehingga "dapat diubah pengadilan" benar
    // bagi mesin dan tidak benar bagi orang yang memakainya. Rute bot tanpa
    // pemanggil tidak ketahuan dari mana pun: penjaga keselarasan gerbang
    // memeriksa portal yang meminta alamat tak ada, bukan sebaliknya.
    const klien = readFileSync(
      path.join(akar, "manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts"),
      "utf8"
    );
    expect(klien).toContain("/internal/aleta-bot/sipp/penilaian/pengaturan");
    expect(klien).toContain("/internal/aleta-bot/kosakata");

    const layar = readFileSync(
      path.join(akar, "manajemen_surat/src/components/portal/aleta-penilaian-berjenjang.tsx"),
      "utf8"
    );
    expect(layar).toContain("/api/aleta-ecourt/rubrik");
    expect(layar).toContain("<RubrikPenilaian />");
  });

  it("kosakata punya layarnya, dan pemeriksa isi pesan memakainya", () => {
    const layarBot = readFileSync(
      path.join(akar, "manajemen_surat/src/components/portal/aleta-bot-admin.tsx"),
      "utf8"
    );
    expect(layarBot).toContain("<KosakataPemeriksaPesan />");
    // Kedua pemeriksa - lencana pada kartu dan daftar peringatan - harus
    // sama-sama memakainya. Yang satu memakai dan yang lain tidak berarti
    // satu kartu berlencana aman sementara isinya berperingatan.
    expect(layarBot.split("lintTemplateBody(body, tambahan)")).toHaveLength(3);
  });

  it("mengubah keduanya menuntut admin istimewa", () => {
    // Bobot dan ambang menentukan perkara siapa yang disebut kurang; kosakata
    // menentukan pesan mana yang diperingatkan sebelum dikirim atas nama
    // pengadilan. Keduanya kewenangan pimpinan, bukan siapa saja yang
    // kebetulan dapat membuka layarnya.
    for (const rute of ["src/app/api/aleta-ecourt/rubrik/route.ts", "src/app/api/aleta-bot/kosakata/route.ts"]) {
      const isi = readFileSync(path.join(akar, "manajemen_surat", rute), "utf8");
      expect(isi, rute).toContain("pastikanAdminIstimewa");
      // Nama pengubahnya dari SESI, bukan dari badan permintaan - yang
      // dikirim layar dapat ditulis apa saja.
      expect(isi, rute).toContain("requireActorUser");
      expect(isi, rute).not.toContain("badan.olehSiapa");
    }
  });
});
