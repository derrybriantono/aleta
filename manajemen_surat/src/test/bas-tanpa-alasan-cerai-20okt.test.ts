/**
 * 20 Okt 2026 (temuan pengguna): kartu "Alasan perceraian" (#8503#) tampil di BAS cerai. RTF BAS tidak memuatnya;
 * ia ikut karena #4001# AMAR (dibacakan di BAS sidang putusan verstek) membaca #8503# lewat kueri. Huruf alasan
 * diputus hakim di putusan - di BAS kartunya tidak ditawarkan, tetapi isian lain dan putusan tetap utuh.
 */
import { describe, expect, it } from "vitest";
import { saringIsianBas, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const def = (kode: string, nama: string, jenis: string, sql = ""): Definisi => ({ kode, nama, jenis, sql, bawaan: "" });
const katalog = new Map<string, Definisi>([
  ["4001", def("4001", "AMAR", "query", "SELECT x FROM y WHERE no_var='8503' AND data LIKE '%F%'")],
  ["8503", def("8503", "ALASAN PERCERAIAN", "data_teks")],
  ["7178", def("7178", "TANGGAL PUTUS", "data_tanggal")],
]);

describe("BAS tidak menawarkan alasan perceraian", () => {
  const susunan = susunIsian(["4001", "7178"], katalog);

  it("susunan mentah memang menarik 8503 lewat kueri amar", () => {
    expect(susunan.isian.map((b) => b.kode)).toContain("8503");
  });

  it("di BAS: 8503 dibuang, isian lain tetap", () => {
    const bas = saringIsianBas(susunan, "bas").isian.map((b) => b.kode);
    expect(bas).not.toContain("8503");
    expect(bas).toContain("7178");
  });

  it("di putusan: 8503 tetap ditawarkan ke hakim", () => {
    expect(saringIsianBas(susunan, "put").isian.map((b) => b.kode)).toContain("8503");
  });

  it("rute memakai saringan menurut jenis folder", async () => {
    const { readFileSync } = await import("node:fs");
    const rute = readFileSync("src/app/api/aleta-ecourt/blangko-derry/route.ts", "utf8");
    expect(rute).toContain("saringIsianBas(susunIsian(penanda, peta, sebutan), jenisFolder)");
  });
});
