import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

import type { BentukKeluar, BentukMasuk, Mesin } from "@/server/modules/aleta-ecourt/zcross/mesin";

/**
 * MESIN UJI Z CROSS (3 Nov 2026) - hanya untuk uji.
 *
 *   sepertiBot(dasar)  RTF -> PDF dirapikan PERSIS seperti jalur cetak bot (rtfSofficeRapi.rapikanUntukSoffice + normalisasi bahasa)
 *                      sebelum diubah mesin dasar (soffice lokal / soffice server). Mesin soffice polos tidak merapikan, padahal PDF
 *                      sungguhan selalu lewat bot.
 *   sofficeServer()    LibreOffice 7.4 MILIK SERVER (container aleta-bot) lewat `ssh aleta` - bita lewat stdin/stdout, folder sementara
 *                      container dihapus sendiri; tidak menulis ke basis data/SIPP/ABT. Hanya dipakai bila ZCROSS_UJI_SOFFICE_JAUH=1
 *                      (laptop pengembang ber-SSH ke server). Versi LibreOffice laptop/cloud (24.x) berbeda perilaku dengan server
 *                      (mis. \pgnstarts diabaikan 7.4, bentuk di paragraf kosong penutup bagian pindah halaman).
 */
const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const rapiSoffice = muat("./services/rtfSofficeRapi.js") as {
  rapikanUntukSoffice: (b: Buffer) => { isi: Buffer; laporan: Record<string, number> };
  rapikanBentukCermin: (s: string) => { rtf: string; diubah: number };
  rapikanKotakNomorHalaman: (s: string) => { rtf: string; diubah: number };
};
const rapiBagian = muat("./services/rtfBentukAkhirBagian.js") as {
  rapikanBentukAkhirBagian: (s: string) => { rtf: string; diubah: number };
  rapikanBentukAkhirBagianBuffer: (b: Buffer) => Buffer;
};
/** Perapian bot sebelum LibreOffice: rtfSofficeRapi + rtfBentukAkhirBagian (urutan sama dengan abtCetakService.rtfKePdf). */
export const rapiBot = {
  ...rapiSoffice,
  ...rapiBagian,
  semua: (b: Buffer): Buffer => rapiBagian.rapikanBentukAkhirBagianBuffer(rapiSoffice.rapikanUntukSoffice(b).isi),
};

const BAHASA_PEMENGGAL_HURUF = new Set([2052, 1028, 3076, 4100, 5124, 1041, 1042, 1054, 1107, 1108, 1109]);
/** Salinan normalkanBahasaRtf (aleta_bot/services/abtCetakService.js - modul itu memuat soffice/profil sehingga tidak diimpor di uji). */
export function normalkanBahasaRtf(isi: Buffer): Buffer {
  if (isi.length < 6 || isi.subarray(0, 5).toString("latin1") !== "{\\rtf") return isi;
  const teks = isi.toString("latin1");
  if (/\\bin\d/.test(teks)) return isi;
  const baru = teks.replace(/\\(lang|langnp|deflang)(\d+)(?!\d)/g, (m, kata: string, n: string) => (BAHASA_PEMENGGAL_HURUF.has(Number(n)) ? `\\${kata}1057` : m));
  return baru === teks ? isi : Buffer.from(baru, "latin1");
}

/** RTF -> PDF lewat perapian bot; perapian lain (mis. versi lama) dapat diberikan untuk pembanding. */
export function sepertiBot(dasar: Mesin, rapikan: (b: Buffer) => Buffer = rapiBot.semua): Mesin {
  return {
    nama: dasar.nama,
    ubah: (bita, dari, ke) => (dari === "rtf" && ke === "pdf" ? dasar.ubah(new Uint8Array(normalkanBahasaRtf(rapikan(Buffer.from(bita)))), dari, ke) : dasar.ubah(bita, dari, ke)),
  };
}

function jalankanJauh(masuk: Buffer, dari: string, ke: string): Promise<Buffer> {
  const skrip = `d=$(mktemp -d /tmp/scz-uji-XXXXXX) && trap "rm -rf $d" EXIT && timeout 60 cat > "$d/m.${dari}" && HOME="$d" timeout 200 soffice --headless --norestore "-env:UserInstallation=file://$d/p" --convert-to ${ke} --outdir "$d/k" "$d/m.${dari}" >/dev/null 2>&1; cat "$d/k/m.${ke}"`;
  return new Promise((resolve, reject) => {
    const anak = execFile("ssh", ["-o", "BatchMode=yes", "aleta", `docker exec -i aleta-bot sh -c '${skrip}'`], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024, timeout: 240000, windowsHide: true }, (e, out, err) => {
      if (e) return reject(new Error(`soffice server gagal: ${String(err || e.message).slice(0, 300)}`));
      const b = out as unknown as Buffer;
      if (!b.length) return reject(new Error(`soffice server: keluaran kosong ${String(err).slice(0, 200)}`));
      resolve(b);
    });
    anak.stdin?.end(masuk);
  });
}

/** soffice 7.4 server (tanpa perapian - bungkus dengan sepertiBot untuk jalur cetak). */
export function sofficeServer(): Mesin {
  return {
    nama: "soffice",
    async ubah(bita: Uint8Array, dari: BentukMasuk, ke: BentukKeluar) {
      const masuk = Buffer.from(bita);
      try {
        return new Uint8Array(await jalankanJauh(masuk, dari, ke));
      } catch (e) {
        if (!/client_loop|Connection reset|closed by remote|kosong/i.test(String(e))) throw e;
        return new Uint8Array(await jalankanJauh(masuk, dari, ke));
      }
    },
  };
}
