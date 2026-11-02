// @vitest-environment node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { afterAll, afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * "CETAK TERLALU LAMBAT" - PROFIL SOFFICE HANGAT PER SLOT (2 NOV 2026, butir 14)
 * ============================================================================
 *
 * Cetak PDF Blangko Derry: RTF -> portal abt/pdf -> bot rtfKePdf (soffice). BAS ber-Z cross = paling sedikit dua konversi (ukur
 * letak Z lewat mesinBot -> rtfKePdf, lalu PDF akhir). Tiap konversi dahulu membuat profil soffice BARU. Kini profil dipakai ulang
 * per slot (sofficeProfilService), eksklusif, dibuang bila konversinya gagal; slot penuh = profil sekali pakai seperti dulu.
 *
 *   A. slot: eksklusif, cadangan saat penuh, generasi baru sesudah gagal, mati lewat env.
 *   B. rtfKePdf dengan execFile tiruan: argumen profil dari slot, konversi gagal membuang profil slot, tiga konversi serentak
 *      tetap serentak (dua slot + satu sekali pakai).
 *   C. soffice SUNGGUHAN (bila terpasang): PDF dari profil hangat = PDF dari profil baru (teks pdftotext, jumlah halaman, gambar
 *      halaman), profil tidak menyimpan judul/isi/nama berkas naskah, konversi serentak berhasil semua.
 */

const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(process.cwd(), "..");
const akarBot = path.join(AKAR, "aleta_bot");
const jalurCetak = require_.resolve(path.join(akarBot, "services/abtCetakService"));
const jalurProfil = require_.resolve(path.join(akarBot, "services/sofficeProfilService"));
const prosesAnak = require_("node:child_process") as { execFile: unknown };
const execFileAsli = prosesAnak.execFile;

type Pinjaman = { url: string; hangat: boolean; folder: string; kembalikan: (sehat: boolean) => void };
type Profil = {
  pinjam: (cadangan: string) => Pinjaman;
  keadaan: () => { jumlah: number; akar: string | null; slot: Array<{ slot: number; sibuk: boolean; generasi: number }> };
  jumlahSlot: () => number;
};
type Cetak = { rtfKePdf: (isi: Buffer) => Promise<{ ok: boolean; pdf?: Buffer; alasan?: string }> };

const envLama = process.env.ALETA_SOFFICE_PROFIL_HANGAT;
function muatSegar(): { profil: Profil; cetak: Cetak } {
  delete require_.cache[jalurCetak];
  delete require_.cache[jalurProfil];
  const profil = require_(jalurProfil) as Profil;
  const cetak = require_(jalurCetak) as Cetak;
  return { profil, cetak };
}

afterEach(() => {
  prosesAnak.execFile = execFileAsli;
  if (envLama === undefined) delete process.env.ALETA_SOFFICE_PROFIL_HANGAT;
  else process.env.ALETA_SOFFICE_PROFIL_HANGAT = envLama;
});
afterAll(() => {
  delete require_.cache[jalurCetak];
  delete require_.cache[jalurProfil];
});

describe("A. slot profil soffice", () => {
  it("eksklusif; slot penuh = profil sekali pakai (cadangan); dikembalikan = dipakai ulang di folder yang sama", () => {
    delete process.env.ALETA_SOFFICE_PROFIL_HANGAT;
    const { profil } = muatSegar();
    expect(profil.jumlahSlot()).toBe(2);
    const a = profil.pinjam("/tmp/cadangan-a/profil");
    const b = profil.pinjam("/tmp/cadangan-b/profil");
    const c = profil.pinjam("/tmp/cadangan-c/profil");
    expect(a.hangat && b.hangat).toBe(true);
    expect(a.folder).not.toBe(b.folder);
    expect(c).toMatchObject({ hangat: false, url: "file:///tmp/cadangan-c/profil" });
    a.kembalikan(true);
    const d = profil.pinjam("/tmp/cadangan-d/profil");
    expect(d.folder).toBe(a.folder);
    expect(d.url).toBe(`file://${a.folder}`);
    b.kembalikan(true);
    d.kembalikan(true);
    c.kembalikan(false);
  });

  it("konversi gagal: slot berganti folder (generasi baru), folder lama tidak dipakai lagi; kembalikan dua kali tidak menggandakan", () => {
    const { profil } = muatSegar();
    const a = profil.pinjam("/tmp/x/profil");
    const lama = a.folder;
    a.kembalikan(false);
    a.kembalikan(false);
    expect(profil.keadaan().slot[0]).toEqual({ slot: 0, sibuk: false, generasi: 1 });
    const b = profil.pinjam("/tmp/y/profil");
    expect(b.hangat).toBe(true);
    expect(b.folder).not.toBe(lama);
    expect(b.folder).toMatch(/slot-0-1$/);
    b.kembalikan(true);
  });

  it("ALETA_SOFFICE_PROFIL_HANGAT=0: selalu profil sekali pakai (perilaku lama)", () => {
    process.env.ALETA_SOFFICE_PROFIL_HANGAT = "0";
    const { profil } = muatSegar();
    expect(profil.jumlahSlot()).toBe(0);
    expect(profil.pinjam("/tmp/z/profil")).toMatchObject({ hangat: false, url: "file:///tmp/z/profil" });
  });
});

// ============================================================================
// B. rtfKePdf di atas execFile tiruan
// ============================================================================
type Panggilan = { argumen: string[]; lepas?: () => void };
/** execFile tiruan; abtCetakService mengambil execFile saat DIMUAT, jadi pasang sebelum muatSegar. `mode.gagal` dapat diubah sesudahnya. */
const mode = { gagal: false };
function pasangTiruan({ gagal = false, tahan = false } = {}) {
  mode.gagal = gagal;
  const panggilan: Panggilan[] = [];
  prosesAnak.execFile = (_b: string, argumen: string[], _o: unknown, balik: (e: Error | null, out?: string, err?: string) => void) => {
    if (argumen[0] === "--version") {
      setImmediate(() => balik(null, "LibreOffice 24.2 (tiruan)\n", ""));
      return {};
    }
    const satu: Panggilan = { argumen };
    panggilan.push(satu);
    const selesai = () => {
      if (mode.gagal) return balik(Object.assign(new Error("Command failed: soffice (tiruan)"), { code: 1 }));
      const asal = argumen[argumen.indexOf("pdf") + 1];
      const keluar = argumen[argumen.indexOf("--outdir") + 1];
      fs.writeFileSync(path.join(keluar, `${path.basename(asal, ".rtf")}.pdf`), "%PDF-1.4\n%tiruan\n");
      balik(null, "", "");
    };
    if (tahan) satu.lepas = selesai;
    else setImmediate(selesai);
    return {};
  };
  return panggilan;
}
const profilDari = (argumen: string[]) => String(argumen.find((a) => a.startsWith("-env:UserInstallation=")) || "").replace("-env:UserInstallation=", "");
const RTF = Buffer.from("{\\rtf1\\ansi Naskah rekaan\\par}", "latin1");

describe("B. rtfKePdf - profil dari slot", () => {
  it("dua konversi berurutan memakai profil slot yang SAMA, di luar folder kerja sekali pakai", async () => {
    delete process.env.ALETA_SOFFICE_PROFIL_HANGAT;
    const panggilan = pasangTiruan();
    const { cetak } = muatSegar();
    expect((await cetak.rtfKePdf(RTF)).ok).toBe(true);
    expect((await cetak.rtfKePdf(RTF)).ok).toBe(true);
    const [p1, p2] = panggilan.map((p) => profilDari(p.argumen));
    expect(p1).toBe(p2);
    expect(p1).toMatch(/aleta-soffice-profil-\d+\/slot-0-0$/);
    const folderKerja = path.dirname(panggilan[0].argumen[panggilan[0].argumen.indexOf("pdf") + 1]);
    expect(p1.startsWith(`file://${folderKerja}`)).toBe(false);
    // Folder kerja (naskah + PDF) tetap dibuang.
    expect(fs.existsSync(folderKerja)).toBe(false);
  });

  it("konversi gagal: profil slot dibuang, konversi berikutnya memakai profil generasi baru", async () => {
    const panggilan = pasangTiruan({ gagal: true });
    const { cetak, profil } = muatSegar();
    const r = await cetak.rtfKePdf(RTF);
    expect(r.ok).toBe(false);
    expect(profil.keadaan().slot[0].generasi).toBe(1);
    mode.gagal = false;
    expect((await cetak.rtfKePdf(RTF)).ok).toBe(true);
    expect(profilDari(panggilan[1].argumen)).not.toBe(profilDari(panggilan[0].argumen));
    expect(profilDari(panggilan[1].argumen)).toMatch(/slot-0-1$/);
  });

  it("tiga konversi serentak tetap serentak: dua slot hangat + satu profil sekali pakai; tidak ada profil yang dipakai bersamaan", async () => {
    const panggilan = pasangTiruan({ tahan: true });
    const { cetak, profil } = muatSegar();
    const janji = [cetak.rtfKePdf(RTF), cetak.rtfKePdf(RTF), cetak.rtfKePdf(RTF)];
    for (let i = 0; i < 50 && panggilan.length < 3; i += 1) await new Promise((r) => setTimeout(r, 5));
    expect(panggilan.length).toBe(3);
    const profilSerentak = panggilan.map((p) => profilDari(p.argumen));
    expect(new Set(profilSerentak).size).toBe(3);
    expect(profilSerentak.filter((p) => /slot-\d-\d$/.test(p)).length).toBe(2);
    expect(profil.keadaan().slot.every((s) => s.sibuk)).toBe(true);
    for (const p of panggilan) p.lepas!();
    expect((await Promise.all(janji)).every((r) => r.ok)).toBe(true);
    expect(profil.keadaan().slot.every((s) => !s.sibuk)).toBe(true);
  });
});

// ============================================================================
// C. soffice sungguhan
// ============================================================================
function adaSoffice() {
  try {
    execFileSync(process.env.ALETA_SOFFICE || "soffice", ["--version"], { stdio: "ignore", timeout: 20000 });
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
const SOFFICE_ADA = adaSoffice();
const BLANGKO = path.join(AKAR, "abt-paket/w3a-blangko-baru-perkawinan/rtf/derry_briantono/1e Kelalaian Kewajiban Suami Istri - BAS/BAS ALUR 04 [6a] BAS 6 P & T Hadir - Pembuktian P (3 Saksi).rtf");

function ringkasPdf(pdf: Buffer) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "uji-cetak-"));
  try {
    const f = path.join(d, "a.pdf");
    fs.writeFileSync(f, pdf);
    const halaman = Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [f]).toString())![1]);
    const teks = execFileSync("pdftotext", ["-layout", f, "-"]).toString();
    execFileSync("pdftoppm", ["-r", "50", "-gray", f, path.join(d, "h")]);
    const gambar = fs.readdirSync(d).filter((n) => n.startsWith("h")).sort().map((n) => fs.readFileSync(path.join(d, n)).toString("base64"));
    return { halaman, teks, gambar };
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
}

describe.skipIf(!SOFFICE_ADA)("C. soffice sungguhan", () => {
  it.skipIf(!fs.existsSync(BLANGKO))(
    "blangko BAS Derry (variabel #nnnn#): PDF profil hangat = PDF profil baru (teks, halaman, gambar); konversi kedua memakai profil yang sama",
    async () => {
      const rtf = fs.readFileSync(BLANGKO);
      process.env.ALETA_SOFFICE_PROFIL_HANGAT = "0";
      const lama = muatSegar();
      const tLama = performance.now();
      const dingin = await lama.cetak.rtfKePdf(rtf);
      const msLama = performance.now() - tLama;
      expect(dingin.ok, dingin.alasan).toBe(true);

      process.env.ALETA_SOFFICE_PROFIL_HANGAT = "2";
      const baru = muatSegar();
      const pertama = await baru.cetak.rtfKePdf(rtf);
      const folderSlot = baru.profil.keadaan().akar!;
      expect(fs.existsSync(path.join(folderSlot, "slot-0-0"))).toBe(true);
      const tHangat = performance.now();
      const hangat = await baru.cetak.rtfKePdf(rtf);
      const msHangat = performance.now() - tHangat;
      expect(pertama.ok && hangat.ok).toBe(true);
      console.info(`[ukur] satu konversi blangko BAS: profil baru ${Math.round(msLama)} ms, profil hangat ${Math.round(msHangat)} ms`);

      const a = ringkasPdf(dingin.pdf!);
      const b = ringkasPdf(hangat.pdf!);
      expect(b.halaman).toBe(a.halaman);
      expect(b.teks).toBe(a.teks);
      expect(b.gambar).toEqual(a.gambar);
      expect(a.teks).toMatch(/#\d{4}#/);
    },
    120000
  );

  it("profil hangat tidak menyimpan judul, penulis, isi, nomor perkara, maupun nama/jalur berkas naskah", async () => {
    process.env.ALETA_SOFFICE_PROFIL_HANGAT = "1";
    const { cetak, profil } = muatSegar();
    const rtf = Buffer.from(
      "{\\rtf1\\ansi{\\info{\\title JUDULREKAANQZ}{\\author PENULISREKAANQZ}{\\subject PERKARAREKAANQZ}}Isi ISIREKAANQZ Nomor 9999/Pdt.G/2099/PA.Uji\\par}",
      "latin1"
    );
    expect((await cetak.rtfKePdf(rtf)).ok).toBe(true);
    expect((await cetak.rtfKePdf(rtf)).ok).toBe(true);
    const folder = path.join(profil.keadaan().akar!, "slot-0-0");
    const temuan: string[] = [];
    let jumlah = 0;
    const telusur = (d: string) => {
      for (const n of fs.readdirSync(d, { withFileTypes: true })) {
        const f = path.join(d, n.name);
        if (n.isDirectory()) telusur(f);
        else {
          jumlah += 1;
          const isi = fs.readFileSync(f).toString("latin1");
          for (const kata of ["REKAANQZ", "9999/Pdt", "putusan.rtf", "aleta-pdf-"]) if (isi.includes(kata)) temuan.push(`${path.relative(folder, f)}: ${kata}`);
        }
      }
    };
    telusur(folder);
    expect(jumlah).toBeGreaterThan(5);
    expect(temuan).toEqual([]);
  }, 120000);

  it("tiga konversi serentak (2 slot + 1 sekali pakai) berhasil semua dan sama isinya", async () => {
    process.env.ALETA_SOFFICE_PROFIL_HANGAT = "2";
    const { cetak } = muatSegar();
    const rtf = Buffer.from("{\\rtf1\\ansi Serentak rekaan satu dua tiga\\par}", "latin1");
    const hasil = await Promise.all([cetak.rtfKePdf(rtf), cetak.rtfKePdf(rtf), cetak.rtfKePdf(rtf)]);
    expect(hasil.map((h) => h.ok)).toEqual([true, true, true]);
    const teks = hasil.map((h) => ringkasPdf(h.pdf!).teks);
    expect(new Set(teks).size).toBe(1);
    expect(teks[0]).toContain("Serentak rekaan satu dua tiga");
  }, 180000);
});
