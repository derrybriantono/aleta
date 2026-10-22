import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import * as ts from "@/lib/kepatutan-relaas";

/**
 * W58 (22 Okt 2026): kepatutan relaas menurut SEMA 1/2023 (surat tercatat) dan
 * Pasal 718 RBg / Buku II (jurusita). Kalimatnya contoh NYATA dari
 * ket_hasil_relaas SIPP satker (15.013 baris diukur), nama disamarkan.
 *
 * Contoh pemicu: 609/Pdt.G/2026 surat tercatat "diterima oleh Pak A/ayah
 * kandung" dulu tampil "Tidak bertemu"; seharusnya "Bertemu orang serumah"
 * (angka 12 huruf c).
 */
const require_ = createRequire(import.meta.url);
const bot = (berkas: string) => path.resolve(process.cwd(), "..", "aleta_bot", "services", berkas);
const js = require_(bot("kepatutanRelaas.js")) as { nilaiRelaas: (r: ts.BahanRelaas) => ts.KepatutanRelaas };
const retur = require_(bot("returRelaas.js")) as {
  FRASA_RETUR_POS: string[];
  relaasRetur: (statusPos: unknown, hasil: unknown, ketTemu?: unknown, noResiPos?: unknown) => boolean;
  sqlRetur: (alias: string) => string;
};
const panggilan = require_(bot("ecourtPanggilanService.js")) as {
  bacaRelaas: (r: Record<string, unknown>) => { diterima: boolean | null; tanggalDiterima?: string | null; kepatutan?: ts.KepatutanRelaas };
};

const pos = (hasil: string, lain: Partial<ts.BahanRelaas> = {}): ts.BahanRelaas => ({
  ketTemu: "S",
  noResiPos: "P2609230000001",
  statusPos: null,
  hasil,
  ...lain,
});
const jurusita = (ketTemu: string, hasil: string): ts.BahanRelaas => ({ ketTemu, hasil });

/** [nama contoh, bahan, kunci, sah, warna, huruf] */
const CONTOH: Array<[string, ts.BahanRelaas, ts.KunciKepatutan, boolean | null, string, string]> = [
  // ---- SEMA 1/2023 angka 12 ------------------------------------------------
  ["a langsung", pos("telah diterima langsung oleh pihak penerima", { statusPos: 1 }), "langsung", true, "hijau", "a"],
  ["a yang bersangkutan", pos("diterima oleh ( Budi ) - ( DITERIMA YANG BERSANGKUTAN )"), "langsung", true, "hijau", "a"],
  ["a nama = pihak", pos("Diterima oleh : Sri Astuti", { namaPihak: "SRI ASTUTI binti FULAN" }), "langsung", true, "hijau", "a"],
  ["a salah ketik", pos("ditrima langsung oleh pihak penerima"), "langsung", true, "hijau", "a"],
  [
    "b menolak",
    pos("delivery return ( penerima tidak bersedia menerima atau tidak bersedia menandatangani )", { statusPos: 2 }),
    "menolak",
    null,
    "kuning",
    "b",
  ],
  ["c 609 ayah kandung", pos("diterima oleh Pak Andi/ayah kandung", { statusPos: 1 }), "serumah", true, "hijau", "c"],
  ["c tinggal serumah", pos("telah diterima oleh Rina yang tinggal serumah dengan pihak penerima di rumah"), "serumah", true, "hijau", "c"],
  ["c orang serumah (pos)", pos("Diterima oleh : ibu Ruki (DITERIMA ORANG SERUMAH)"), "serumah", true, "hijau", "c"],
  ["c saudara", pos("diterima oleh Amir/saudara"), "serumah", true, "hijau", "c"],
  ["c resepsionis", pos("diterima oleh Agus resepsionis di apartemen / rumah susun / tempat tinggal lainnya yang sejenis", { statusPos: 1 }), "resepsionis", true, "hijau", "c"],
  ["c istri - periksa lawan", pos("diterima oleh Nur/istri", { statusPos: 1 }), "serumah", null, "kuning", "c"],
  ["c menolak difoto", pos("telah diterima oleh Syarif (penerima menolak untuk diambil foto) yang tinggal serumah dengan pihak", { statusPos: 1 }), "tolak_foto", null, "kuning", "c"],
  ["c penerima pihak lawan", pos("DITERIMA OLEH SRI PIHAK PENGGUGAT", { pihakKe: 2 }), "penerima_lawan", false, "merah", "c"],
  ["d aparat desa", pos("telah diterima oleh Medi (kadus) aparat kelurahan/aparat desa", { statusPos: 1 }), "kepala_desa", true, "hijau", "d"],
  ["d sekdes", pos("diterima oleh Sekdes"), "kepala_desa", true, "hijau", "d"],
  ["e tidak ditemukan", pos("Alamat pihak penerima tidak ditemukan sesuai keterangan aparat kelurahan"), "tidak_ditemukan", false, "merah", "e"],
  ["e tidak dikenal (failed)", pos("failed to delivered | paket tidak berhasil diserahkan dengan keterangan (yang bersangkutan tidak dikenal)"), "tidak_ditemukan", false, "merah", "e"],
  ["f tidak tinggal", pos("pihak penerima tidak tinggal di alamat yang dituju sesuai keterangan ,lurah / kepala desa", { statusPos: 2 }), "tidak_tinggal", false, "merah", "f"],
  ["f pindah", pos("dikembalikan dikantor Pengadilan disebabkan Pihak Tergugat Pindah tempat tinggal"), "tidak_tinggal", false, "merah", "f"],
  ["g meninggal", pos("pihak penerima telah meninggal dunia sesuai keterangan kepala desa"), "meninggal", false, "merah", "g"],
  // ---- retur dan penerimaan yang belum terbaca --------------------------------
  ["retur ditolak aparat desa", pos("paket tidak berhasil diserahkan dengan keterangan (kiriman ditolak aparat kelurahan/aparat desa)", { statusPos: 2 }), "ditolak_desa", false, "merah", ""],
  ["retur tanpa sebab", pos("RETUR", { statusPos: 2 }), "retur", false, "merah", ""],
  ["nama tanpa hubungan", pos("diterima oleh Lisa"), "diterima_lain", null, "kuning", ""],
  ["rekan kerja", pos("diterima oleh rekan kerja Mario"), "diterima_lain", null, "kuning", ""],
  ["lacak pos berhasil", pos("", { statusPos: 1 }), "pos_berhasil", true, "hijau", ""],
  ["belum terbukti", pos("Surat Tercatat"), "belum_terbukti", null, "kuning", ""],
  ["masih di jalan", pos("surat belum sampai"), "belum_sampai", null, "kuning", ""],
  // ---- jurusita: Pasal 718 RBg / Buku II ------------------------------------
  ["Y bertemu", jurusita("Y", "bertemu dan berbicara langsung dengan Pemohon I"), "langsung", true, "hijau", ""],
  [
    "T lewat kantor desa",
    jurusita("T", "tidak bertemu Tergugat, kemudian relaas ini saya teruskan ke kantor desa setempat untuk disampaikan kepada Tergugat"),
    "kepala_desa",
    true,
    "hijau",
    "",
  ],
  ["T sekretaris desa", jurusita("T", "Tidak bertemu Pemohon. Panggilan disampaikan melalui Sekretaris Desa"), "kepala_desa", true, "hijau", ""],
  ["T tidak bertemu saja", jurusita("T", "tidak bertemu dengan Tergugat"), "tidak_bertemu", null, "kuning", ""],
  ["T keluarga", jurusita("T", "tidak bertemu, diterima oleh ibunya"), "keluarga_jurusita", null, "kuning", ""],
  ["T pindah", jurusita("T", "Tidak bertemu Tergugat. Tergugat sudah pindah domisili"), "tidak_tinggal", false, "merah", ""],
  ["T meninggalkan alamat bukan meninggal", jurusita("T", "Tergugat telah meninggalkan alamat tersebut"), "tidak_tinggal", false, "merah", ""],
  ["T meninggal", jurusita("T", "Tidak Bertemu Termohon, disebabkan Karena Termohon Telah Meninggal Dunia."), "meninggal", false, "merah", ""],
  ["N tidak dapat", jurusita("N", "tidak ada yang mengenal tergugat"), "tidak_dapat", false, "merah", ""],
  ["T pengumuman itsbat", jurusita("T", "<b><i>Panggilan dengan cara pengumuman (itsbat terpadu).</i></b>"), "pengumuman", true, "hijau", ""],
  // ---- elektronik dan panggilan umum --------------------------------------------
  ["E elektronik", jurusita("E", "Panggilan Elektronik"), "elektronik", true, "hijau", ""],
  ["W papan pengumuman", jurusita("W", ""), "pengumuman", true, "hijau", ""],
];

describe("kepatutan relaas - SEMA 1/2023 angka 12 dan Pasal 718 RBg", () => {
  for (const [nama, bahan, kunci, sah, warna, huruf] of CONTOH) {
    it(nama, () => {
      const k = ts.nilaiRelaas(bahan);
      expect(k.kunci).toBe(kunci);
      expect(k.sah).toBe(sah);
      expect(k.warna).toBe(warna);
      if (huruf) expect(k.huruf).toBe(huruf);
      expect(k.label.length).toBeGreaterThan(3);
      // Tanpa label teknis: label tidak memuat kunci mentah atau sandi.
      expect(k.label).not.toMatch(/_|ket_temu|status_pos/);
    });
  }

  it("609/Pdt.G/2026: label menyebut hubungannya dan dasar huruf c", () => {
    const k = ts.nilaiRelaas(pos("diterima oleh Pak Andi/ayah kandung"));
    expect(k.label).toBe("Bertemu orang serumah (ayah kandung)");
    expect(k.dasar).toContain("SEMA 1/2023");
    expect(k.dasar).toContain("12 huruf c");
    expect(k.penerima).toBe("andi");
  });

  it("melalui kepala desa tanpa keterangan 2 kali pengantaran tetap sah, dicatat pada keterangan", () => {
    const tanpa = ts.nilaiRelaas(pos("diterima oleh Sekdes"));
    expect(tanpa.keterangan).toMatch(/2 kali\) tidak tertulis/);
    const dengan = ts.nilaiRelaas(pos("diterima kepala desa karena tidak bertemu setelah pengantaran sebanyak 2 (dua) kali"));
    expect(dengan.kunci).toBe("kepala_desa");
    expect(dengan.keterangan).toMatch(/setelah 2 kali pengantaran/);
  });

  it("huruf b/e/f/g surat tercatat = retur; jurusita tidak pernah retur karena kalimatnya", () => {
    for (const [, bahan, kunci] of CONTOH) {
      const k = ts.nilaiRelaas(bahan);
      if (["menolak", "tidak_ditemukan", "tidak_tinggal", "meninggal", "ditolak_desa", "retur"].includes(kunci) && k.jalur === "surat_tercatat") {
        expect(k.retur, String(bahan.hasil)).toBe(true);
      }
      if (k.jalur === "jurusita") expect(k.retur, String(bahan.hasil)).toBe(false);
    }
    // "menolak difoto" bukan menolak menerima - bukan retur.
    expect(ts.nilaiRelaas(pos("telah diterima oleh Fuad (penerima menolak untuk di ambil foto) yang tinggal serumah")).retur).toBe(false);
  });
});

describe("satu aturan: bot (JS) dan portal (TS) sama persis", () => {
  it("keluaran nilaiRelaas sama untuk semua contoh", () => {
    for (const [nama, bahan] of CONTOH) {
      expect(js.nilaiRelaas(bahan), nama).toEqual(ts.nilaiRelaas(bahan));
    }
  });

  it("frasa retur dan relaasRetur sama", () => {
    expect(ts.FRASA_RETUR_POS).toEqual(retur.FRASA_RETUR_POS);
    for (const [, bahan] of CONTOH) {
      expect(ts.relaasRetur(bahan.statusPos, bahan.hasil, bahan.ketTemu, bahan.noResiPos)).toBe(
        retur.relaasRetur(bahan.statusPos, bahan.hasil, bahan.ketTemu, bahan.noResiPos)
      );
    }
  });

  it("penggalan SQL memuat setiap frasa SEMA dan hanya untuk surat tercatat", () => {
    const sql = retur.sqlRetur("r");
    for (const frasa of retur.FRASA_RETUR_POS) expect(sql).toContain(`LIKE '%${frasa}%'`);
    expect(sql).toContain("COALESCE(r.ket_temu, '') = 'S' OR COALESCE(r.no_resi_pos, '') <> ''");
    expect(retur.relaasRetur(null, "tidak bertemu, alamat tidak ditemukan", "T", "")).toBe(false);
    expect(retur.relaasRetur(null, "alamat tidak ditemukan", "S", "P1")).toBe(true);
  });

  it("padanan TS dibentuk dari JS, bukan disunting sendiri", () => {
    const isiTs = readFileSync(path.resolve(process.cwd(), "src", "lib", "kepatutan-relaas.ts"), "utf8");
    const isiJs = readFileSync(bot("kepatutanRelaas.js"), "utf8");
    // Setiap pola di JS ada apa adanya di TS.
    for (const baris of isiJs.split("\n").filter((x) => /^\s*\/.*\/;$/.test(x) || /^const POLA_/.test(x))) {
      expect(isiTs, baris).toContain(baris.replace(/^const /, "").trim());
    }
  });
});

describe("dipakai semua penghitung", () => {
  const baca = (berkas: string) => readFileSync(bot(berkas), "utf8");

  it("bacaRelaas: T lewat kepala desa sampai, surat retur tidak diterima, serumah diterima", () => {
    const t = panggilan.bacaRelaas({ ketTemu: "T", tanggalRelaas: "2026-10-01", ketHasilRelaas: "tidak bertemu, diteruskan ke kantor desa" });
    expect(t.diterima).toBe(true);
    const tSaja = panggilan.bacaRelaas({ ketTemu: "T", tanggalRelaas: "2026-10-01", ketHasilRelaas: "tidak bertemu tergugat" });
    expect(tSaja.diterima).toBe(false);
    const returPos = panggilan.bacaRelaas({ ketTemu: "S", noResiPos: "P1", tanggalRelaas: "2026-10-01", ketHasilRelaas: "alamat tidak ditemukan" });
    expect(returPos.diterima).toBe(false);
    expect(returPos.tanggalDiterima).toBeNull();
    const serumah = panggilan.bacaRelaas({ ketTemu: "S", noResiPos: "P1", tanggalRelaas: "2026-10-01", ketHasilRelaas: "diterima oleh Andi/ayah kandung" });
    expect(serumah.diterima).toBe(true);
    expect(serumah.kepatutan?.kunci).toBe("serumah");
  });

  it("bot: jadwal sidang, panggilan e-Court, dan analisa memakai aturan bersama", () => {
    const jadwal = baca("sippJadwalSidangService.js");
    expect(jadwal).toContain('require("./kepatutanRelaas")');
    expect(jadwal).toContain("kepatutan: nilaiRelaas({");
    // keadaanPanggilanSidang kini membaca keterangan hasil - tanpa itu retur karena kalimat tidak terhitung.
    expect(jadwal).toMatch(/r\.status_pos AS statusPos,\s*r\.ket_hasil_relaas AS ketHasilRelaas/);
    expect(jadwal).toContain("relaasRetur(r.statusPos, r.ketHasilRelaas, r.ketTemu, r.noResiPos)");
    expect(baca("ecourtPanggilanService.js")).toContain('require("./kepatutanRelaas")');
    expect(baca("analisaLanjutService.js")).toContain('require("./kepatutanRelaas")');
    expect(baca("kepatutanRelaas.js")).toContain('require("./returRelaas")');
  });

  it("portal: Jadwal Sidang dan Status Perkara memakai lencana bersama, tidak lagi 'tidak bertemu' karangan", () => {
    const portal = (berkas: string) => readFileSync(path.resolve(process.cwd(), "src", "components", "portal", berkas), "utf8");
    const sidang = portal("aleta-ecourt-sidang.tsx");
    expect(sidang.match(/<LencanaKepatutanRelaas\b/g)?.length).toBe(2);
    expect(sidang).not.toMatch(/<Badge variant="warning">tidak bertemu<\/Badge>/i);
    expect(portal("aleta-ecourt-status-perkara.tsx")).toContain("<LencanaKepatutanRelaas");
    expect(portal("lencana-kepatutan-relaas.tsx")).toContain('from "@/lib/kepatutan-relaas"');
  });
});
