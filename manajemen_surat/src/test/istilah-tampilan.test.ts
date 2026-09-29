/**
 * Istilah tampilan: "server" (bukan "peladen") dan "blangko" (bukan "borang").
 *
 * Diminta pengguna 29 September 2026: "ubah semua tampilan yang tulisannya
 * peladen jadi server dan borang menjadi blangko". Yang diganti hanya TULISAN
 * yang tampil - isi string, templat, dan teks JSX. Komentar kode, nama kode,
 * kunci penyimpanan, kelas CSS, nama kolom SQL, dan alamat API (mis.
 * /penunjukan/borang) sengaja tidak diganti.
 *
 * Penjaga ini menyisir berkas ekstensi, portal (bukan uji), dan layanan bot,
 * dengan aturan yang sama dengan alat penggantinya: satu kata tanpa spasi
 * (kunci), SQL, dan potongan kode dalam string dilewati; kemunculan yang
 * menempel ke - _ / . # (kelas, alamat) dilewati.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(__dirname, "../../..");
const POLA = /(^|[^A-Za-z0-9\-_/.#$:=@])(peladen|borang)(nya|mu|ku)?(?![A-Za-z0-9_\-/])/i;

function berkasDari(dir: string, hasil: string[] = []): string[] {
  for (const b of readdirSync(dir, { withFileTypes: true })) {
    if (b.name === "node_modules" || b.name === ".next" || b.name.startsWith(".")) continue;
    if (b.name === "ekstensi-berkas.ts") continue; // dibangkitkan dari ekstensi-sipp/
    const p = path.join(dir, b.name);
    if (b.isDirectory()) {
      if (b.name === "test") continue;
      berkasDari(p, hasil);
    } else if (/\.(js|mjs|ts|tsx)$/.test(b.name) && !/\.(d|test)\.tsx?$/.test(b.name)) hasil.push(p);
  }
  return hasil;
}

function temuan(p: string): string[] {
  const teks = readFileSync(p, "utf8");
  if (!/peladen|borang/i.test(teks)) return [];
  const jenis = p.endsWith(".tsx") ? ts.ScriptKind.TSX : p.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(p, teks, ts.ScriptTarget.Latest, true, jenis);
  const hasil: string[] = [];
  const kunjungi = (node: ts.Node) => {
    const k = node.kind;
    let isi: string | null = null;
    if (k === ts.SyntaxKind.StringLiteral || k === ts.SyntaxKind.NoSubstitutionTemplateLiteral) {
      const ortu = node.parent;
      const kunci =
        ortu &&
        ((ts.isPropertyAssignment(ortu) && ortu.name === node) ||
          ts.isImportDeclaration(ortu) ||
          ts.isExportDeclaration(ortu) ||
          ts.isLiteralTypeNode(ortu));
      if (!kunci) isi = (node as ts.StringLiteral).text;
    } else if (
      k === ts.SyntaxKind.TemplateHead ||
      k === ts.SyntaxKind.TemplateMiddle ||
      k === ts.SyntaxKind.TemplateTail
    ) {
      isi = (node as ts.TemplateLiteralLikeNode).text;
    } else if (k === ts.SyntaxKind.JsxText) {
      isi = node.getText(sf);
    }
    if (isi !== null && k !== ts.SyntaxKind.JsxText) {
      if (!/\s/.test(isi.trim())) isi = null;
      else if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|ON CONFLICT|WHERE|VALUES)\b|\bupdated_at\b|\?\s*[,)]/.test(isi)) isi = null;
      else if (/===|=>|\bif \(|\bconst |\blet |function\b|\.set\(|\.get\(|[{};]\s*$/.test(isi)) isi = null;
    }
    if (isi !== null && POLA.test(isi)) {
      const baris = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      hasil.push(`${path.relative(REPO, p)}:${baris}: ${isi.replace(/\s+/g, " ").slice(0, 100)}`);
    }
    ts.forEachChild(node, kunjungi);
  };
  kunjungi(sf);
  return hasil;
}

describe("istilah tampilan: server dan blangko", () => {
  it("tidak ada tulisan tampilan yang memakai 'peladen' atau 'borang'", () => {
    const akar = [
      path.join(REPO, "ekstensi-sipp"),
      path.join(REPO, "manajemen_surat", "src"),
      path.join(REPO, "aleta_bot", "services"),
      path.join(REPO, "aleta_bot", "routes"),
    ];
    const semua = akar.flatMap((a) => berkasDari(a)).flatMap(temuan);
    expect(semua).toEqual([]);
  });

  it("penyisirnya sungguh menangkap pelanggaran - bukan penjaga yang selalu hijau", () => {
    const dir = mkdtempSync(path.join(process.env.TMP || os.tmpdir(), "istilah-"));
    const contoh = path.join(dir, "contoh.tsx");
    writeFileSync(
      contoh,
      [
        'const a = "Gagal menghubungi peladen.";',
        "const b = `Periksa ${x} borangnya lagi`;",
        "const c = <p>Tutup Borang</p>;",
        'const kunci = "peladen";',
        'const kelas = "aleta-borang aktif";',
        'const sql = "SELECT borang, medan FROM t";',
        "// komentar peladen tidak dihitung",
      ].join("\n")
    );
    try {
      expect(temuan(contoh).length).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("alamat API dan nama kolom yang memuat 'borang' TIDAK ikut berubah", () => {
    // Mengganti alamat atau kolom mematahkan ekstensi yang sudah terpasang di
    // PC lain dan data yang sudah tersimpan - yang diganti hanya tulisannya.
    const konten = readFileSync(path.join(REPO, "ekstensi-sipp", "konten.js"), "utf8");
    expect(konten).toContain('"/aleta/api/aleta-bot/penunjukan/borang"');
    const isian = readFileSync(
      path.join(REPO, "manajemen_surat", "src", "server", "modules", "aleta-ecourt", "penunjukan-pengisian.ts"),
      "utf8"
    );
    expect(isian).toContain("FROM aleta_sipp_borang_medan");
  });
});
