/**
 * SK susunan majelis hakim dan panitera sidangnya.
 *
 * Yang dijaga di sini terutama SATU hal: kode panitera pada SK tidak dapat
 * dipakai menunjuk orang di SIPP, dan jalur lama yang mencobanya menghasilkan
 * panitera majelis LAIN tanpa satu pun galat.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (p: string) => readFileSync(path.join(AKAR, p), "utf8");

const pengaturan = baca("manajemen_surat/src/server/modules/aleta-ecourt/penunjukan-pengaturan.ts");
const usul = baca("aleta_bot/services/penunjukanService.js");
const gerbang = baca("aleta_bot/routes/internalGatewayRoutes.js");
const konten = baca("ekstensi-sipp/konten.js");
const migrasi = baca("manajemen_surat/drizzle/0044_sk_susunan_majelis.sql");
const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sk-majelis.tsx");
const jurnal = JSON.parse(baca("manajemen_surat/drizzle/meta/_journal.json")) as {
  entries: { idx: number; tag: string }[];
};

function tanpaKomentar(sumber: string) {
  return sumber
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((baris) => !baris.trim().startsWith("//"))
    .join("\n");
}

describe("migrasi 0044", () => {
  it("terdaftar sekali di jurnal, dan nomornya tidak bertabrakan", () => {
    const empat = jurnal.entries.filter((x) => x.idx === 44);
    expect(empat).toHaveLength(1);
    expect(empat[0].tag).toBe("0044_sk_susunan_majelis");
  });

  it("menambah kolom tanpa membongkar tabel yang sudah terisi", () => {
    // Tabel ini sudah memuat hari sidang tiap majelis sejak 0019. Membuat
    // ulang tabelnya akan menghapus penyuntingan yang sudah dikerjakan orang.
    expect(migrasi).toContain("ADD COLUMN IF NOT EXISTS hakim_kode");
    expect(migrasi).toContain("ADD COLUMN IF NOT EXISTS panitera_id");
    expect(migrasi).not.toContain("DROP TABLE");
    expect(migrasi).not.toContain("CREATE TABLE");
  });

  it("bawaannya kosong - baris lama terbaca sebagai SK belum diisi", () => {
    expect(migrasi).toContain("NOT NULL DEFAULT ''");
  });
});

describe("kode panitera tidak dapat menunjuk orang", () => {
  it("jalur lama yang mencocokkan kode SUDAH DICABUT", () => {
    // paniteraKode "D,D4" dicocokkan dengan panitera_pn.kode memulangkan EMPAT
    // orang - keempatnya berkode "D" - dua di antaranya panitera majelis lain.
    const bersih = tanpaKomentar(usul);
    expect(bersih).not.toContain("kodePp.includes(x.kode)");
    expect(bersih).not.toContain("const kodePp = pmh.majelisKode");
  });

  it("penggantinya menunjuk lewat id, bukan kode", () => {
    expect(usul).toContain("const kodeMenurutSk = new Map(pasanganPp.map((p) => [Number(p.id)");
    expect(usul).toContain("kodeMenurutSk.get(id)");
  });

  it("kodenya tetap dibawa sebagai label", () => {
    expect(usul).toContain("kodeSk");
    expect(konten).toContain("x.kodeSk ? `${x.kodeSk} — ` : \"\"");
  });

  it("disimpan BERPASANGAN, bukan dua daftar sejajar", () => {
    // Daftar sejajar bergeser diam-diam begitu satu kode dihapus dari tengah:
    // D4 menjadi milik orang yang seharusnya D5.
    expect(pengaturan).toContain("function bacaPasanganPanitera(");
    expect(pengaturan).toContain("panitera: { kode: string; id: number }[]");
  });

  it("yang belum diikat tidak dikirim sebagai penunjuk siapa pun", () => {
    expect(pengaturan).toContain("panitera: x.panitera.filter((p) => p.id > 0)");
  });
});

describe("majelis SK didahulukan dan diberi kodenya", () => {
  it("susunan dicocokkan menurut himpunan kode, bukan urutannya", () => {
    // SIPP menyimpan urutan duduk, dan susunan yang sama dapat tercatat dengan
    // ketua di urutan berbeda ketika penetapannya pernah diperbaiki.
    expect(usul).toContain("function tandaiSusunanSk(");
    expect(usul).toContain("const kunciKode = (kode) =>");
    expect(usul).toContain(".sort().join(\"|\")");
  });

  it("yang di luar SK tidak dibuang - hanya turun dan kehilangan kodenya", () => {
    expect(usul).toContain('majelisKode: sk ? sk.majelisKode : ""');
    expect(usul).toContain("if (a.dariSk !== b.dariSk) return a.dariSk ? -1 : 1;");
  });

  it("susunan SK yang belum pernah dipakai tetap ditawarkan", () => {
    // Majelis baru bermula dari nol perkara; daftar yang hanya memuat yang
    // sudah pernah dipakai tidak akan pernah menawarkannya.
    expect(usul).toContain("if (sudah.has(sk.majelisKode)) continue;");
    expect(usul).toContain("perkara: 0,");
  });

  it("susunan yang salah satu hakimnya tidak aktif TIDAK ditawarkan", () => {
    // Menawarkannya berujung penolakan SIPP sesudah tombolnya ditekan.
    expect(usul).toContain("if (anggota.length !== sk.hakimKode.length) continue;");
  });

  it("panel menandai yang di luar SK, dan tidak memberinya kode", () => {
    expect(konten).toContain('x.majelisKode ? `${x.majelisKode} — ` : ""');
    expect(konten).toContain('" · di luar SK"');
  });
});

describe("gerbang menyaring sebelum memakai", () => {
  it("kode hakim dibatasi bentuknya - ia menunjuk orang", () => {
    expect(gerbang).toContain("/^[A-Z0-9]{1,8}$/.test(x)");
  });

  it("pasangan panitera tanpa id yang sah dibuang", () => {
    expect(gerbang).toContain("Number.isInteger(p.id) && p.id > 0");
  });

  it("susunan berhakim kurang dari dua dilewati", () => {
    expect(gerbang).toContain("if (!kode || hakim.length < 2) continue;");
  });
});

describe("layar pengaturannya ada, dan menerangkan sebabnya", () => {
  it("memanggil rute simpan yang sudah lama tidak dipanggil siapa pun", () => {
    expect(layar).toContain('apiPath("/api/aleta-ecourt/sk-majelis")');
    expect(layar).toContain('method: "POST"');
  });

  it("mengirim pasangan kode=id", () => {
    expect(layar).toContain("gabung.panitera.map((p) => `${p.kode}=${p.id}`).join(\",\")");
  });

  it("menghitung sendiri kode yang tabrakan, bukan menyebutnya dari ingatan", () => {
    // Angka yang ditulis tangan di layar menjadi salah begitu datanya berubah.
    expect(layar).toContain("const kodeTabrakan = useMemo(");
    expect(layar).toContain("filter(([, n]) => n > 1)");
  });

  it("botnya mati tidak menggagalkan layar", () => {
    expect(layar).toContain("pegawaiAlasan");
    expect(layar).toContain("belum dapat diikat ke orangnya");
  });

  it("yang belum diikat disebut apa adanya, bukan dibiarkan tampak siap", () => {
    expect(layar).toContain("belum diikat — panel memakai giliran beban");
  });
});
