// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CERMIN_BAS_SAKSI } from "@/lib/tipe-keluaran/bawaan/bawaan-bas-saksi";
import { kelompokTanya } from "@/lib/tipe-keluaran/pemilih-ragam";
import {
  AWAL_BOLEH_DIKECILKAN,
  periksaInvarian,
  ragamkanJawabanContoh,
  susunBankRagam,
  tiruanReplaceKetSaksi,
} from "@/lib/tipe-keluaran/ragam-jawaban";

/**
 * ============================================================================
 * "PAKAI CONTOH" DI LEMBAR BAS PORTAL - DIRAGAMKAN PER SAKSI
 * ============================================================================
 *
 * Sebelum ini tombol "Pakai contoh" menuang kalimat ABT yang sama persis ke
 * lembar saksi pertama dan kedua. Kini contoh diragamkan per saksi lewat
 * pemilih K7b yang sama dengan bot dan bank bawaan-bas-saksi.ts (ditambah
 * tambahan yang disahkan), dan tiap bentuk lolos periksaInvarian SALINAN
 * PORTAL (ragam-jawaban.ts). Yang dijaga berkas ini:
 *
 *   1. salinan portal = bot: periksaInvarian, tiruanReplaceKetSaksi,
 *      AWAL_BOLEH_DIKECILKAN, dan jawaban templat yang tidak dijawab modus;
 *   2. saksi 1 dan 2 berbeda pada pertanyaan pokok yang punya bentuk;
 *      rumusan dan sumpah/identitas tidak diragamkan;
 *   3. stabil: pemanggilan ulang identik;
 *   4. pilihan berlawanan tetap utuh; hubungan dua saksi dipecah;
 *   5. susunLembarTanyaJawab meneruskan saksiKe, membaca tambahan yang
 *      disahkan (untukPortal), dan menyebut pengaturan yang gagal terbaca.
 *
 * Templat di bawah ini kumpulan A1a ABT apa adanya (tanpa nama pihak).
 */

type Bot = {
  periksaInvarian: (d: string, h: string, o?: Record<string, unknown>) => { ok: boolean; pelanggaran: string[] };
  tiruanReplaceKetSaksi: (j: string) => string;
  susunKeteranganSaksiSdg: (o: Record<string, unknown>) => {
    saksi: Array<{ jawaban: Array<{ jawab: string; pilihan?: string[] }> }>;
  };
};
const require_ = createRequire(import.meta.url);
const bot = require_(path.resolve(process.cwd(), "../aleta_bot/services/abtUsulanService.js")) as Bot;
const ragamBot = require_(path.resolve(process.cwd(), "../aleta_bot/services/ragamBasBawaan.js")) as {
  AWAL_BOLEH_DIKECILKAN: string[];
};

const A1A: Array<[string, string]> = [
  ["Apakah saudara kenal dengan #0046#?", "Saya kenal dengan #0046# karena saya adalah ...;"],
  ["Apakah saudara mengetahui maksud #0046# menghadap di persidangan ini?", "#0046# menghadap di persidangan ini untuk mengajukan cerai terhadap suaminya sebagai #0047#;"],
  ["Apakah saudara kenal dengan #0047#?", "Saya kenal dengan #0047# sebagai isteri/suami #0046#;"],
  ["Dimana #0046# dan #0047# tinggal bersama setelah menikah?", "Setelah menikah #0046# dan #0047# tinggal bersama di ...... pernah juga tinggal bersama di ....... dan terakhir tinggal bersama di ...... ;Setelah menikah #0046# dan #0047# tidak pernah tinggal bersama;"],
  ["Apakah #0046# dan #0047# sudah dikarunia anak?", "#0046# dan #0047# sudah dikaruniai ... orang anak, anak tersebut saat ini tinggal dengan #0046# / #0047#;#0046# dan #0047# belum dikaruniai anak;"],
  ["Kenapa #0046# mengajukan cerai terhadap #0047#?", "#0046# mengajukan cerai terhadap #0047# karena sudah tidak rukun dalam rumah tangganya;"],
  ["Apakah antara #0046# dan #0047# sering terjadi perselisihan dan pertengkaran, dan kapan mulainya?", "Antara #0046# dan #0047# sering terjadi perselisihan dan pertengkaran sejak .....;"],
  ["Apa yang biasa menjadi penyebab perselisihan dan pertengkaran antara #0046# dan #0047#?", "Yang biasa menjadi penyebab perselisihan dan pertengkaran antara #0046# dan #0047# adalah karena ........;"],
  ["Apakah saudara pernah melihat atau mendengar langsung #0046# dan #0047# bertengkar?", "Saya pernah melihat dan mendengar langsung #0046# dan #0047# bertengkar, sebanyak .... kali, di ........;Saya tidak pernah melihat dan mendengar langsung #0046# dan #0047# bertengkar, tapi setelah terjadi pertengkaran saya tahu karena .....;"],
  ["Apakah #0046# dan #0047# masih tinggal satu rumah sampai saat ini?", "#0046# dan #0047# sudah pisah tempat tinggal sejak ....., kira-kira sampai sekarang sudah sekitar ........ tahun/bulan;"],
  ["Apakah selama pisah antara #0046# dan #0047# masih ada komunikasi?", "Selama pisah antara #0046# dan #0047# sudah tidak ada komunikasi;"],
  ["Apakah #0047# masih memberikan nafkah kepada #0046#?", "#0047# sudah tidak pernah memberikan nafkah kepada #0046#;"],
  ["Pernahkah ada upaya untuk merukunkan #0046# dan #0047#?", "#0046# dan #0047# sudah pernah diupayakan untuk dirukunkan oleh ...., namun tidak berhasil;Sebelum-sebelumnya #0046# dan #0047# pernah dirukunkan oleh ...., namun kembali lagi cekcok (berselisih);Belum pernah ada upaya untuk merukunkan #0046# dan #0047# karena ....;"],
  ["Apakah masih ada yang ingin saudara sampaikan?", "Sudah cukup;"],
];
const isi = (t: string) => t.replace(/#0046#/g, "Penggugat").replace(/#0047#/g, "Tergugat");
const TEMPLAT = A1A.map(([tanya, jawab], i) => ({ no: String(i + 1), tanya: isi(tanya), jawab: isi(jawab), mentah: jawab }));
const HUBUNGAN = { tanya: "Apakah saudara kenal dengan Penggugat dan Tergugat?", mentah: "Ya, saya mengenal #0046# dan #0047# karena saya adalah #1241# / #1242#;" };
const NOMOR = ["101/Pdt.G/2026/PA.Dgl", "102/Pdt.G/2026/PA.Dgl", "205/Pdt.G/2025/PA.Dgl", "33/Pdt.G/2024/PA.Dgl", "480/Pdt.G/2026/PA.Dgl"];
const bank = susunBankRagam(null);

function contoh(
  no: string,
  ke: number,
  baris: ReadonlyArray<{ tanya: string; jawab: string; mentah: string }> = TEMPLAT,
  pihakSaksi: "P" | "T" = "P"
) {
  return baris.map((b) =>
    ragamkanJawabanContoh({
      tanya: b.tanya, jawab: b.jawab, jawabMentah: b.mentah, nomorPerkara: no, kodeKumpulan: "A1a",
      ke, pihakSaksi, jumlahSaksi: ke, pelaku: "Tergugat", lawan: "Penggugat", bank,
    })
  );
}

describe("salinan portal = bot", () => {
  it("AWAL_BOLEH_DIKECILKAN sama dengan ragamBasBawaan bot", () => {
    expect([...AWAL_BOLEH_DIKECILKAN]).toEqual(ragamBot.AWAL_BOLEH_DIKECILKAN);
  });

  it("periksaInvarian dan tiruanReplaceKetSaksi memutus sama dengan bot atas pasangan yang melanggar dan yang tidak", () => {
    const dasar = "Penggugat dan Tergugat sudah pisah tempat tinggal sejak 2 tahun ....";
    const pasangan: Array<[string, string, Record<string, unknown>?]> = [
      [dasar, "Penggugat dan Tergugat sudah berpisah tempat tinggal sejak 2 tahun ...."],
      [dasar, "Penggugat dan Termohon sudah pisah tempat tinggal sejak 2 tahun ...."],
      [dasar, "Penggugat dan Tergugat sudah pisah tempat tinggal sejak 3 tahun ...."],
      [dasar, "Penggugat dan Tergugat sudah pisah tempat tinggal sejak 2 tahun"],
      [dasar, "Penggugat dan Tergugat tidak pisah tempat tinggal sejak 2 tahun ...."],
      [dasar, "Iya, Penggugat dan Tergugat sudah pisah tempat tinggal sejak 2 tahun ...."],
      [dasar, "Hanya, Penggugat dan Tergugat sudah pisah tempat tinggal sejak 2 tahun ...."],
      [dasar, "Ya, penggugat dan Tergugat sudah pisah tempat tinggal sejak 2 tahun ...."],
      [dasar, "Penggugat dan Tergugat sudah sudah pisah tempat tinggal sejak 2 tahun ...."],
      ["Saya kenal #1241#", "Saya kenal #1242#"],
      ["Demi Allah saya bersumpah", "Demi Allah saya berjanji", { tetap: true }],
      ["di rumah ...", "di kediaman ...", { slot: ["rumah"] }],
    ];
    for (const [d, h, o] of pasangan) {
      expect(periksaInvarian(d, h, o)).toEqual(bot.periksaInvarian(d, h, o));
      expect(tiruanReplaceKetSaksi(h)).toBe(bot.tiruanReplaceKetSaksi(h));
    }
    // Dan pemeriksanya sungguh menangkap: hanya pasangan pertama yang lolos.
    expect(pasangan.map(([d, h, o]) => periksaInvarian(d, h, o).ok)).toEqual([
      true, false, false, false, false, false, false, false, false, false, false, false,
    ]);
  });

  it("jawaban templat yang bot tidak jawab dari modus = bot, untuk 4 saksi x 5 nomor", () => {
    let dibanding = 0;
    for (const no of NOMOR) {
      const hb = bot.susunKeteranganSaksiSdg({
        templat: TEMPLAT.map((b) => ({ no: b.no, tanya: b.tanya, jawab: b.jawab, jawabMentah: b.mentah })),
        alasan: [], posita: "", pelaku: "Tergugat", lawan: "Penggugat", nomorPerkara: no, kodeKumpulan: "A1a",
        saksi: [1, 2, 3, 4].map((ke) => ({ ke, pihak: "P", modus: "sama" })),
      });
      for (const ke of [1, 2, 3, 4]) {
        const hp = contoh(no, ke);
        TEMPLAT.forEach((b, k) => {
          // Bagian pertama jawaban berpilihan = jawaban utama bot.
          const pertama = `${hp[k].jawab.split(";")[0]};`;
          const kel = kelompokTanya(b.tanya);
          if (kel.kelompok === "penyebab" || kel.kelompok === "cara tahu" || kel.kelompok === "menyaksikan") return; // dijawab modus di bot
          dibanding++;
          expect(pertama, `${no} saksi ${ke} #${b.no}`).toBe(hb.saksi[ke - 1].jawaban[k].jawab);
        });
      }
    }
    expect(dibanding).toBeGreaterThan(200);
  });
});

describe("saksi 1 dan saksi 2 tidak diberi contoh kembar", () => {
  it("pertanyaan pokok yang punya bentuk berbeda antar saksi di tiap nomor", () => {
    for (const no of NOMOR) {
      const s1 = contoh(no, 1);
      const s2 = contoh(no, 2);
      // #3 kenal sebagai, #10 pisah sejak - kelompok BENTUK ber-3+ bentuk.
      for (const k of [2, 9]) {
        expect(s1[k].varian.n).toBeGreaterThanOrEqual(2);
        expect(s1[k].jawab, `${no} #${k + 1}`).not.toBe(s2[k].jawab);
      }
    }
  });

  // Butir 27 (5 Oktober 2026, permintaan pengguna): rumusan dan penutup pun
  // berbeda antar saksi - dahulu mengikuti profil manusia (>= 80% sama).
  it("rumusan dan penutup: berbeda antar saksi, tanpa pembuka", () => {
    let sama = 0;
    let n = 0;
    for (const no of NOMOR) {
      const s1 = contoh(no, 1);
      const s2 = contoh(no, 2);
      TEMPLAT.forEach((b, k) => {
        if (s1[k].jenis !== "rumusan") return;
        n++;
        if (s1[k].jawab === s2[k].jawab) sama++;
      });
    }
    expect(n).toBeGreaterThan(0);
    expect(sama / n).toBeLessThanOrEqual(0.05);
  });

  it("lafal sumpah dan identitas tidak disentuh sama sekali", () => {
    const tetap = [
      { tanya: "Apakah saudara bersedia disumpah?", jawab: "Ya, bersedia;", mentah: "" },
      { tanya: "Sebutkan nama lengkap saudara!", jawab: "Nama saya ......;", mentah: "" },
      // Titik di ujung lafal pun tidak diganti ';' - lafal sumpah dikutip utuh.
      {
        tanya: "Saksi mengucapkan sumpah menurut agamanya:",
        jawab: "Demi Allah saya bersumpah bahwa saya akan menerangkan yang benar tidak lain dari yang sebenarnya.",
        mentah: "",
      },
    ];
    for (const no of NOMOR) for (const ke of [1, 2, 3, 4]) {
      const h = contoh(no, ke, tetap);
      expect(h.map((x) => x.jawab)).toEqual(tetap.map((t) => t.jawab));
      expect(h.every((x) => x.jenis === "tetap")).toBe(true);
    }
  });

  it("stabil: memuat ulang lembar yang sama menghasilkan contoh yang sama persis", () => {
    for (const no of NOMOR) for (const ke of [1, 2, 3, 4]) expect(contoh(no, ke)).toEqual(contoh(no, ke));
  });

  it("bentuk tambahan yang menggeser makna tidak pernah ditawarkan - disaring SEBELUM dipilih", () => {
    // Tambahan yang (keliru) disahkan: bentuk sekunci yang membalik makna.
    const bankRusak = susunBankRagam(
      {
        "bas.saksi.bentuk": [
          ...(CERMIN_BAS_SAKSI["bas.saksi.bentuk"] ?? []),
          { kunci: "kenal sebagai", nilai: "saya tidak kenal dengan #0047# sebagai {slot}" },
        ],
      },
      "uji"
    );
    const baris = TEMPLAT[2];
    let dilepas = 0;
    for (const no of NOMOR) for (const ke of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const r = ragamkanJawabanContoh({
        tanya: baris.tanya, jawab: baris.jawab, jawabMentah: baris.mentah, nomorPerkara: no, kodeKumpulan: "A1a",
        ke, pihakSaksi: "P", jumlahSaksi: ke, pelaku: "Tergugat", lawan: "Penggugat", bank: bankRusak,
      });
      dilepas += r.dilepas;
      expect(r.jawab).not.toMatch(/tidak kenal/);
      expect(r.varian.n).toBe(3);
    }
    // Disaring di depan, bukan tertangkap di belakang: tidak satu pun dilepas.
    expect(dilepas).toBe(0);
  });

  it("tiap bagian keluaran lolos periksaInvarian portal DAN bot atas dasarnya", () => {
    for (const no of NOMOR) for (const ke of [1, 2, 3, 4]) {
      contoh(no, ke).forEach((r) => {
        const keluar = r.jawab.split(";").map((x) => x.trim()).filter(Boolean);
        expect(keluar.length).toBe(r.dasar.length);
        r.dasar.forEach((d, i) => {
          expect(periksaInvarian(d, keluar[i]).pelanggaran).toEqual([]);
          expect(bot.periksaInvarian(d, keluar[i]).pelanggaran).toEqual([]);
        });
      });
    }
  });
});

describe("pilihan dan hubungan", () => {
  it("pilihan berlawanan tetap utuh - negasinya tidak hilang", () => {
    for (const no of NOMOR) for (const ke of [1, 2]) {
      const r = contoh(no, ke)[8];
      expect(r.dasar.length).toBe(2);
      expect(r.jawab).toMatch(/pernah melihat[^;]*;.*tidak pernah melihat[^;]*;$/i);
    }
  });

  it("hubungan '#1241# / #1242#' dipecah untuk saksi 1-2, saksi ketiga tetap melihat keduanya", () => {
    const baris = [{ tanya: HUBUNGAN.tanya, jawab: isi(HUBUNGAN.mentah), mentah: HUBUNGAN.mentah }];
    const s1 = contoh(NOMOR[0], 1, baris)[0].jawab;
    const s2 = contoh(NOMOR[0], 2, baris)[0].jawab;
    const s3 = contoh(NOMOR[0], 3, baris)[0].jawab;
    expect(s1).toContain("#1241#");
    expect(s1).not.toContain("#1242#");
    expect(s2).toContain("#1242#");
    expect(s2).not.toContain("#1241#");
    expect(s3).toContain("#1241# / #1242#");
    // Saksi Tergugat juga tidak dipecah - #1241#/#1242# milik saksi Penggugat.
    expect(contoh(NOMOR[0], 1, baris, "T")[0].jawab).toContain("#1241# / #1242#");
  });
});

// ============================================================================
// susunLembarTanyaJawab - rute ke portal
// ============================================================================

const panggil = vi.fn();
const untukPortal = vi.fn();
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({
  callAletaBotSippBridge: (operasi: string, params: Record<string, unknown>) => panggil(operasi, params),
}));
vi.mock("@/server/modules/aleta-ecourt/tipe-keluaran", () => ({
  untukPortal: (db: unknown, daftar: unknown) => untukPortal(db, daftar),
}));
const { susunLembarTanyaJawab } = await import("@/server/modules/aleta-ecourt/bas-tanya-jawab");

function jawabBridge(nomor = NOMOR[0]) {
  panggil.mockImplementation(async (operasi: string) => {
    if (operasi === "case.detail") return { ok: true, data: { nomorPerkara: nomor, jenisPerkara: "Cerai Gugat" } };
    if (operasi === "case.parties")
      return { ok: true, data: [{ role: "Penggugat", name: "xxx binti xxx" }, { role: "Tergugat", name: "xxx bin xxx" }] };
    if (operasi === "abt.tanyaJawab")
      return {
        ok: true,
        data: { ada: true, pertanyaan: A1A.map(([pertanyaan, jawabanBawaan], i) => ({ urutan: i + 1, pertanyaan, jawabanBawaan })), variabel: [] },
      };
    return { ok: true, data: [] };
  });
}

beforeEach(() => {
  panggil.mockReset();
  untukPortal.mockReset();
});

describe("susunLembarTanyaJawab meneruskan saksi", () => {
  it("saksiKe memilih contoh; saksi 1 dan 2 berbeda pada pokok, jawabanAbt tetap contoh ABT", async () => {
    jawabBridge();
    const l1 = await susunLembarTanyaJawab({ perkaraId: "1", kode: "A1a", saksiKe: 1 });
    const l2 = await susunLembarTanyaJawab({ perkaraId: "1", kode: "A1a", saksiKe: 2 });
    expect(l1.saksiKe).toBe(1);
    expect(l2.saksiKe).toBe(2);
    expect(l1.pihakSaksi).toBe("P");
    expect(l1.baris[2].jawabanAbt).toBe(l2.baris[2].jawabanAbt);
    expect(l1.baris[2].jawabanBawaan).not.toBe(l2.baris[2].jawabanBawaan);
    expect(l1.baris[2].jawabanBawaan).toBe(contoh(NOMOR[0], 1)[2].jawab);
    expect(l1.ragam?.asal).toBe("tertanam");
  });

  it("kumpulan A2a dibaca saksi Tergugat", async () => {
    jawabBridge();
    const l = await susunLembarTanyaJawab({ perkaraId: "1", kode: "A2a", saksiKe: 1, namaKumpulan: "Pertanyaan Saksi T CG" });
    expect(l.pihakSaksi).toBe("T");
  });

  it("tambahan yang DISAHKAN ikut dipakai (untukPortal)", async () => {
    // Pengaturan yang mengosongkan pembuka: bank bawaan memberi pembuka pada
    // sebagian contoh, bank dari pengaturan tidak pernah - jadi yang dipakai
    // memang bank dari untukPortal, bukan cermin tertanam.
    untukPortal.mockResolvedValue({
      asal: "basis-data",
      versi: "abcdef0123456789",
      kabar: [],
      daftar: {
        "bas.saksi.pembuka": [],
        "bas.saksi.ragam-kata": CERMIN_BAS_SAKSI["bas.saksi.ragam-kata"],
        "bas.saksi.bentuk": CERMIN_BAS_SAKSI["bas.saksi.bentuk"],
        "bas.saksi.profil": CERMIN_BAS_SAKSI["bas.saksi.profil"],
      },
    });
    const BERPEMBUKA = /^(Ya|Setahu saya|Sepengetahuan saya|Yang saya ketahui), /;
    const hitung = async (db: never | undefined) => {
      let n = 0;
      const semua = [];
      for (const no of NOMOR) {
        jawabBridge(no);
        for (const ke of [1, 2, 3, 4]) {
          const l = await susunLembarTanyaJawab({ perkaraId: no, kode: "A1a", saksiKe: ke, db });
          semua.push(l);
          n += l.baris.filter((b) => BERPEMBUKA.test(b.jawabanBawaan)).length;
        }
      }
      return { n, semua };
    };
    const bawaan = await hitung(undefined);
    const pengaturan = await hitung({} as never);
    expect(bawaan.n).toBeGreaterThan(0);
    expect(pengaturan.n).toBe(0);
    expect(untukPortal.mock.calls[0][1]).toEqual(["bas.saksi.pembuka", "bas.saksi.ragam-kata", "bas.saksi.bentuk", "bas.saksi.profil"]);
    expect(pengaturan.semua[0].ragam?.asal).toBe("portal");
    expect(pengaturan.semua[0].ragam?.versi).toBe("abcdef0123456789");
    expect(bawaan.semua[0].ragam?.asal).toBe("tertanam");
  });

  it("pengaturan yang gagal terbaca disebut di kabar, contoh tetap tersedia", async () => {
    jawabBridge();
    untukPortal.mockRejectedValue(new Error("koneksi putus"));
    const galat = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const l = await susunLembarTanyaJawab({ perkaraId: "1", kode: "A1a", saksiKe: 2, db: {} as never });
    expect(l.ok).toBe(true);
    expect(l.ragam?.asal).toBe("tertanam");
    expect(l.ragam?.kabar.join(" ")).toContain("koneksi putus");
    expect(l.baris[2].jawabanBawaan).toBe(contoh(NOMOR[0], 2)[2].jawab);
    expect(galat).toHaveBeenCalled();
    galat.mockRestore();
  });
});

// ============================================================================
// BENTUK BERSYARAT - PORTAL MENERUSKAN JENIS PERKARA DAN ALUR SEPERTI EKSTENSI
// ============================================================================
//
// Ekstensi (saksi-sdg) mengirim id jenis perkara SIPP dan alur_perkara_id,
// dan bot menyaring bentuk ber-data.syarat dengannya. Dulu "Pakai contoh"
// portal tidak meneruskan keduanya, sehingga SETIAP bentuk bersyarat ditolak
// di portal tetapi dipakai bot - dan bank tertanam tidak punya syarat, jadi
// tidak ada uji yang melihatnya. Di sini seluruh bentuk diberi syarat.

describe("bentuk bersyarat: portal = bot", () => {
  const bersyarat = (syarat: Record<string, unknown>) => ({
    ...CERMIN_BAS_SAKSI,
    "bas.saksi.bentuk": CERMIN_BAS_SAKSI["bas.saksi.bentuk"].map((e) => ({ ...e, data: { ...(e.data ?? {}), syarat } })),
  });

  async function bandingkan(syarat: Record<string, unknown>) {
    const daftar = bersyarat(syarat);
    untukPortal.mockResolvedValue({ asal: "basis-data", versi: "bersyarat0000000", kabar: [], daftar });
    let dibanding = 0;
    let beda = 0;
    const portal: string[] = [];
    for (const no of NOMOR) {
      jawabBridge(no);
      const hb = bot.susunKeteranganSaksiSdg({
        templat: TEMPLAT.map((b) => ({ no: b.no, tanya: b.tanya, jawab: b.jawab, jawabMentah: b.mentah })),
        alasan: [], posita: "", pelaku: "Tergugat", lawan: "Penggugat", nomorPerkara: no, kodeKumpulan: "A1a",
        saksi: [1, 2, 3, 4].map((ke) => ({ ke, pihak: "P", modus: "sama" })),
        // Bentuk yang dikirim ekstensi: idJenisPerkaraSipp + idAlurPerkaraSipp.
        jenisPerkara: "347",
        alur: "15",
        tipeKeluaran: { versi: "bersyarat0000000", daftar },
      });
      for (const ke of [1, 2, 3, 4]) {
        const l = await susunLembarTanyaJawab({ perkaraId: no, kode: "A1a", saksiKe: ke, db: {} as never });
        expect(l.ragam?.asal).toBe("portal");
        TEMPLAT.forEach((b, k) => {
          const kel = kelompokTanya(b.tanya);
          if (kel.kelompok === "penyebab" || kel.kelompok === "cara tahu" || kel.kelompok === "menyaksikan") return;
          const pertama = `${l.baris[k].jawabanBawaan.split(";")[0]};`;
          portal.push(pertama);
          dibanding++;
          if (pertama !== hb.saksi[ke - 1].jawaban[k].jawab) beda++;
        });
      }
    }
    return { dibanding, beda, portal };
  }

  it("syarat cerai gugat + gugatan: contoh portal sama dengan bot untuk perkara cerai gugat", async () => {
    const r = await bandingkan({ jenisPerkaraId: "347", alur: "15" });
    expect(r.dibanding).toBeGreaterThan(200);
    expect(r.beda).toBe(0);
  });

  it("bentuk bersyarat memang terpakai: syarat yang cocok dan yang tidak memberi contoh berbeda", async () => {
    const cocok = await bandingkan({ jenisPerkaraId: "347" });
    const lain = await bandingkan({ jenisPerkaraId: "346" });
    // Syarat cerai talak tidak berlaku untuk perkara cerai gugat - di portal
    // maupun bot - jadi keduanya tetap sama, tetapi berbeda dari yang cocok.
    expect(lain.beda).toBe(0);
    const selisih = cocok.portal.filter((t, i) => t !== lain.portal[i]).length;
    expect(selisih).toBeGreaterThan(0);
  });
});

describe("peta id jenis perkara portal = ekstensi", () => {
  it("ID_JENIS_PERKARA_SIPP dan idAlurPerkaraSipp sama dengan ekstensi-sipp/abt.js", async () => {
    const { readFileSync } = await import("node:fs");
    const { ID_JENIS_PERKARA_SIPP, idJenisPerkaraSipp, idAlurPerkaraSipp } = await import(
      "@/server/modules/aleta-ecourt/bas-tanya-jawab"
    );
    const abt = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/abt.js"), "utf8");
    const blok = abt.match(/const ID_JENIS_PERKARA_SIPP = Object\.freeze\(\{([\s\S]*?)\}\);/);
    expect(blok, "peta di abt.js tidak ditemukan").toBeTruthy();
    const ekstensi: Record<string, string> = {};
    for (const m of (blok?.[1] ?? "").matchAll(/^\s*(?:"([^"]+)"|([a-z-]+)):\s*"(\d+)",?\s*$/gm)) {
      ekstensi[m[1] ?? m[2]] = m[3];
    }
    expect(Object.keys(ekstensi).length).toBeGreaterThan(15);
    expect({ ...ID_JENIS_PERKARA_SIPP }).toEqual(ekstensi);
    expect(idJenisPerkaraSipp("  cerai   gugat ")).toBe("347");
    expect(idJenisPerkaraSipp("Jenis Baru")).toBe("Jenis Baru");
    expect(idAlurPerkaraSipp("12/Pdt.G.S/2026/PA.Dgl")).toBe("17");
    expect(idAlurPerkaraSipp("12/Pdt.G/2026/PA.Dgl")).toBe("15");
    expect(idAlurPerkaraSipp("12/Pdt.P/2026/PA.Dgl")).toBe("16");
    expect(idAlurPerkaraSipp("")).toBe("");
  });
});
