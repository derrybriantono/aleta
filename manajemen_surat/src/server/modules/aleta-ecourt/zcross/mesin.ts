import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * MESIN KONVERSI Z CROSS - satu antarmuka, tiga pelaksana:
 *
 *   word     Microsoft Word lewat PowerShell/COM (laptop Windows; skrip scripts/zcross/word-ubah.ps1)
 *   soffice  LibreOffice headless (server Linux / laptop yang memasangnya)
 *   (bot)    soffice di container bot lewat gerbang - lihat mesin-bot.ts; dipakai portal di server karena container portal tidak memuat soffice
 *
 * Ketiganya hanya mengubah bita -> bita; tidak ada yang disimpan. Letak halaman yang diukur SELALU dari mesin yang sama dengan yang
 * membuat PDF (Word membuat PDF dari Word, soffice dari soffice): tata letak kedua mesin sedikit berbeda, Z mengikuti mesin pembuat PDF.
 */
export type BentukMasuk = "rtf" | "docx" | "doc";
export type BentukKeluar = BentukMasuk | "pdf";

export interface Mesin {
  nama: "word" | "soffice" | "bot" | "uji";
  ubah(bita: Uint8Array, dari: BentukMasuk, ke: BentukKeluar): Promise<Uint8Array>;
}

const BATAS_WAKTU = 180_000;

function jalan(perintah: string, argumen: string[], opsi: { timeout?: number; env?: NodeJS.ProcessEnv } = {}): Promise<{ keluaran: string; galat: string }> {
  return new Promise((resolve, reject) => {
    execFile(perintah, argumen, { timeout: opsi.timeout ?? BATAS_WAKTU, windowsHide: true, env: opsi.env ?? process.env, maxBuffer: 16 * 1024 * 1024 }, (e, out, err) => {
      if (e) {
        const g = new Error(`${perintah}: ${String(err || e.message).slice(0, 400)}`);
        (g as Error & { code?: unknown }).code = (e as NodeJS.ErrnoException).code;
        reject(g);
      } else resolve({ keluaran: String(out), galat: String(err) });
    });
  });
}

async function denganFolder<T>(f: (folder: string) => Promise<T>): Promise<T> {
  const folder = await mkdtemp(path.join(tmpdir(), "zcross-"));
  try {
    return await f(folder);
  } finally {
    await rm(folder, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function lokasiSkripWord(): string {
  const calon = [
    process.env.ZCROSS_SKRIP_WORD,
    path.resolve(process.cwd(), "scripts/zcross/word-ubah.ps1"),
    path.resolve(process.cwd(), "manajemen_surat/scripts/zcross/word-ubah.ps1"),
  ].filter(Boolean) as string[];
  const ada = calon.find((c) => existsSync(c));
  if (!ada) throw new Error("Skrip word-ubah.ps1 tidak ditemukan (atur ZCROSS_SKRIP_WORD).");
  return ada;
}

export function mesinWord(): Mesin {
  return {
    nama: "word",
    ubah: (bita, dari, ke) =>
      denganFolder(async (f) => {
        const masuk = path.join(f, `masuk.${dari}`);
        const keluar = path.join(f, `keluar.${ke}`);
        await writeFile(masuk, bita);
        await jalan("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", lokasiSkripWord(), "-Masuk", masuk, "-Keluar", keluar, "-Format", ke]);
        return new Uint8Array(await readFile(keluar));
      }),
  };
}

const FILTER_SOFFICE: Record<BentukKeluar, string> = { pdf: "pdf", docx: "docx", doc: "doc", rtf: "rtf" };

export function mesinSoffice(soffice = process.env.ALETA_SOFFICE || "soffice"): Mesin {
  return {
    nama: "soffice",
    ubah: (bita, dari, ke) =>
      denganFolder(async (f) => {
        const masuk = path.join(f, `masuk.${dari}`);
        const profil = path.join(f, "profil");
        await writeFile(masuk, bita);
        const keluarFolder = path.join(f, "keluar");
        await jalan(soffice, ["--headless", "--norestore", `-env:UserInstallation=file://${profil.replace(/\\/g, "/")}`, "--convert-to", FILTER_SOFFICE[ke], "--outdir", keluarFolder, masuk], { env: { ...process.env, HOME: f } });
        return new Uint8Array(await readFile(path.join(keluarFolder, `masuk.${ke}`)));
      }),
  };
}

export function adaWord(): boolean {
  if (process.platform !== "win32") return false;
  const dasar = [process.env["ProgramFiles"], process.env["ProgramFiles(x86)"], "C:\\Program Files", "C:\\Program Files (x86)"].filter(Boolean) as string[];
  const rel = ["Microsoft Office\\root\\Office16\\WINWORD.EXE", "Microsoft Office\\Office16\\WINWORD.EXE", "Microsoft Office\\root\\Office15\\WINWORD.EXE", "Microsoft Office\\Office15\\WINWORD.EXE"];
  return dasar.some((d) => rel.some((r) => existsSync(path.join(d, r))));
}

/** Pilihan mesin lokal: ZCROSS_MESIN=word|soffice, selainnya Word di Windows yang punya Word, soffice di lainnya. */
export function pilihMesinLokal(): Mesin {
  const paksa = (process.env.ZCROSS_MESIN || "").toLowerCase();
  if (paksa === "word") return mesinWord();
  if (paksa === "soffice") return mesinSoffice();
  return adaWord() ? mesinWord() : mesinSoffice();
}
