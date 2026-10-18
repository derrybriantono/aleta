// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Keputusan 18 Okt 2026 (butir 14): saklar #9720# "petitum meminta penyerahan anak" (Penguasaan Anak, jenis 349, folder 6b)
 * terisi otomatis dari PETITUM gugatan e-Court: 1 bila diminta, 0 bila tidak. Isian manual menang (jagaIsianLama).
 * Nomor variabel: D:/aleta-dev/kerja/batch-14okt-sore/i20-bas-perbaikan-18okt/PEMETAAN-ALETA.md bagian 1.
 */
const AKAR = path.resolve(process.cwd(), "..");
const botReq = createRequire(path.join(AKAR, "aleta_bot/package.json"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const G: any = botReq("./services/isiGugatanService.js");

const POSITA = `Bahwa Penggugat dan Tergugat telah bercerai; dari perkawinan itu dikaruniai seorang anak bernama ANAK SATU, umur 5 tahun.
Bahwa kini anak tersebut dibawa dan dikuasai oleh Tergugat tanpa seizin Penggugat.`;

const gugat = (petitum: string) => `${POSITA}\n\nPETITUM\nBerdasarkan hal-hal tersebut di atas, Penggugat mohon kepada Ketua Pengadilan Agama Donggala c.q. Majelis Hakim agar menjatuhkan putusan sebagai berikut:\n${petitum}\n`;

const DENGAN = gugat(`1. Mengabulkan gugatan Penggugat;\n2. Menetapkan anak bernama ANAK SATU berada dalam penguasaan Penggugat;\n3. Menghukum Tergugat untuk menyerahkan anak bernama ANAK SATU kepada Penggugat;\n4. Membebankan biaya perkara kepada Penggugat.`);
const TANPA = gugat(`1. Mengabulkan gugatan Penggugat;\n2. Menetapkan anak bernama ANAK SATU berada dalam penguasaan Penggugat;\n3. Membebankan biaya perkara kepada Penggugat.`);

const susun = (teks: string) =>
  G.susunIsiGugatan({ sebutan: { lawan: "Penggugat", pelaku: "Tergugat" }, dokumen: [{ judul: "Gugatan", peran: "gugatan", teks, penuntutKode: "0046" }] });

describe("butir 14: saklar #9720# dari petitum", () => {
  it("nomor variabel sama dengan pemetaan i20", () => {
    expect(G.VAR.penyerahanAnak).toBe("9720");
  });

  it("petitum meminta penyerahan anak -> 1 (terisi otomatis, isian lama dijaga)", () => {
    const u = susun(DENGAN).usulan.find((x: { kode: string }) => x.kode === "9720");
    expect(u).toMatchObject({ kode: "9720", nilai: "1", keyakinan: "cukup", jagaIsianLama: true });
    expect(JSON.stringify(u)).not.toMatch(/aleta/i);
  });

  it("petitum menyangkut anak tanpa permintaan penyerahan -> 0", () => {
    const u = susun(TANPA).usulan.find((x: { kode: string }) => x.kode === "9720");
    expect(u).toMatchObject({ kode: "9720", nilai: "0", keyakinan: "cukup", jagaIsianLama: true });
  });

  it("variasi bunyi permintaan penyerahan dikenali", () => {
    for (const bunyi of [
      "Memerintahkan Tergugat menyerahkan kembali anak tersebut kepada Penggugat",
      "Menghukum Tergugat untuk segera menyerahkan anak yang bernama ANAK SATU kepada Penggugat",
      "Menetapkan penyerahan anak bernama ANAK SATU kepada Penggugat",
      "Anak yang bernama ANAK SATU diserahkan kepada Penggugat",
    ]) {
      expect(G.saklarPenyerahanAnak(gugat(`1. Mengabulkan gugatan;\n2. ${bunyi};\n3. Biaya perkara.`)), bunyi).toMatchObject({ nilai: "1" });
    }
  });

  it("tanpa petitum terbaca atau petitum tidak menyangkut anak -> tidak ada usulan (jangan menebak 0)", () => {
    expect(G.saklarPenyerahanAnak(POSITA)).toBeNull();
    expect(G.saklarPenyerahanAnak(gugat("1. Mengabulkan gugatan Penggugat;\n2. Menjatuhkan talak satu bain sughra;\n3. Biaya perkara."))).toBeNull();
    expect(susun(POSITA).usulan.some((x: { kode: string }) => x.kode === "9720")).toBe(false);
  });

  it("hanya petitum SURAT GUGATAN yang dibaca (jawaban Tergugat tidak menentukan)", () => {
    const hasil = G.susunIsiGugatan({
      sebutan: { lawan: "Penggugat", pelaku: "Tergugat" },
      dokumen: [
        { judul: "Gugatan", peran: "gugatan", teks: TANPA, penuntutKode: "0046" },
        { judul: "Jawaban", peran: "jawaban", teks: DENGAN, penuntutKode: "0047" },
      ],
    });
    expect(hasil.usulan.find((x: { kode: string }) => x.kode === "9720")).toMatchObject({ nilai: "0" });
  });
});
