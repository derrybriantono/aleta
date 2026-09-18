/**
 * ============================================================================
 * JEJAK ALETA HARUS MENYEBUT NOMOR PERKARANYA
 * ============================================================================
 *
 * Diukur pada basis data peladen kantor, 17 September 2026: keenam puluh empat
 * baris `aleta_bot_jejak_penetapan` menyimpan nomor perkara "[object Object]".
 * Sebabnya satu baris: pemanggil meneruskan `rencana.perkara` - yang berbentuk
 * `{ perkaraId, nomorPerkara }` - ke kolom teks, dan String() atas obyek tidak
 * pernah melempar galat. Tabel yang justru dibuat supaya perbuatan ALETA dapat
 * ditelusuri per perkara karena itu tidak dapat ditelusuri per perkara.
 *
 * Penjaga di sini menahan dua sisinya sekaligus: pemanggil mengirim nomornya,
 * dan layanan tetap memulangkan nomor walau yang dikirim bungkusnya.
 *
 * Satu cacat sepupu ikut dijaga: keterangan bongkar menempelkan kolom DATE apa
 * adanya, sehingga jejaknya berbunyi "tanggal Tue Sep 15 2026 00:00:00
 * GMT+0000" - kalimat Inggris di dalam catatan berbahasa Indonesia yang dibaca
 * atasan. `tanggalIso` sudah ada di berkas yang sama; ia hanya tidak dipakai.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");

function baca(jalur: string): string {
  return readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");
}

const jejak = baca("aleta_bot/services/jejakAletaService.js");
const gerbang = baca("aleta_bot/routes/internalGatewayRoutes.js");
const tulis = baca("aleta_bot/services/penetapanTulisService.js");

/**
 * Memotong fungsi puncak dari sumbernya - bentuk yang sama dengan
 * ekstensi-jalan-keluar-dijalankan.test.ts: fungsi puncak dibuka di kolom nol
 * dan ditutup "}" di kolom nol pula.
 */
function potongFungsi(isi: string, nama: string[]): string {
  const baris = isi.split("\n");
  const hasil: string[] = [];
  const ketemu = new Set<string>();

  for (let i = 0; i < baris.length; i += 1) {
    const cocok = baris[i].match(/^(?:async )?function ([A-Za-z_$][\w$]*)\(/);
    if (!cocok || !nama.includes(cocok[1])) continue;
    let j = i;
    while (j < baris.length && baris[j] !== "}") j += 1;
    if (j >= baris.length) throw new Error(`penutup fungsi ${cocok[1]} tidak ditemukan`);
    hasil.push(baris.slice(i, j + 1).join("\n"));
    ketemu.add(cocok[1]);
  }

  const hilang = nama.filter((n) => !ketemu.has(n));
  if (hilang.length) throw new Error(`fungsi tidak ditemukan: ${hilang.join(", ")}`);
  return hasil.join("\n\n");
}

function muatNomor(): (nilai: unknown) => string {
  const sumber = potongFungsi(jejak, ["potong", "nomorPerkaraSaja"]);
  const buat = new Function(`${sumber}\nreturn nomorPerkaraSaja;`);
  return buat() as (nilai: unknown) => string;
}

describe("nomor perkara pada jejak ALETA", () => {
  it("membongkar bungkus rencana - bukan '[object Object]'", () => {
    const nomorPerkaraSaja = muatNomor();
    const hasil = nomorPerkaraSaja({
      perkaraId: 10119,
      nomorPerkara: "567/Pdt.G/2026/PA.Dgl",
    });
    expect(hasil).toBe("567/Pdt.G/2026/PA.Dgl");
    expect(hasil).not.toContain("object Object");
  });

  it("teks biasa tetap lewat apa adanya, dan yang kosong jadi kosong", () => {
    const nomorPerkaraSaja = muatNomor();
    expect(nomorPerkaraSaja("574/Pdt.G/2026/PA.Dgl")).toBe("574/Pdt.G/2026/PA.Dgl");
    expect(nomorPerkaraSaja(null)).toBe("");
    expect(nomorPerkaraSaja(undefined)).toBe("");
    expect(nomorPerkaraSaja({})).toBe("");
  });

  it("obyek tanpa nomor pun tidak pernah menghasilkan '[object Object]'", () => {
    const nomorPerkaraSaja = muatNomor();
    expect(nomorPerkaraSaja({ perkaraId: 10119 })).toBe("");
  });

  it("kolomnya dipotong 120 aksara, sepanjang kolom tabelnya", () => {
    const nomorPerkaraSaja = muatNomor();
    expect(nomorPerkaraSaja("x".repeat(400))).toHaveLength(120);
  });

  it("INSERT jejak memakai nomorPerkaraSaja, bukan potong mentah", () => {
    expect(jejak).toContain("nomorPerkaraSaja(j.nomorPerkara)");
    expect(jejak).not.toContain("potong(j.nomorPerkara, 120)");
  });

  it("gerbang tidak lagi meneruskan obyek rencana.perkara", () => {
    // Dituntut SIFATNYA, bukan jumlahnya.
    //
    // Dahulu tuntutan ini berbunyi `toBe(3)` - jumlah pemanggil pada hari ia
    // ditulis. Ia menyala merah ketika penulis penundaan sidang dan penulis
    // putusan menambah dua pemanggil yang KEDUANYA sudah benar. Tuntutan yang
    // menghitung pemanggil menghukum kode yang bertambah, bukan kode yang
    // keliru - dan yang dijaga di sini memang bukan berapa banyak yang
    // memanggil, melainkan tidak ada satu pun yang meneruskan obyeknya.
    expect(gerbang).not.toContain("nomorPerkara: rencana.perkara,");
    expect(gerbang).not.toMatch(/nomorPerkara:\s*rencana\.perkara\s*[,}]/);

    const semua = gerbang.match(/nomorPerkara: [^,\n]+/g) || [];
    const dariRencana = semua.filter((b) => b.includes("rencana.perkara"));
    expect(dariRencana.length).toBeGreaterThanOrEqual(3);
    for (const baris of dariRencana) {
      expect(baris, baris).toBe('nomorPerkara: (rencana.perkara && rencana.perkara.nomorPerkara) || ""');
    }
  });
});

describe("keterangan bongkar berbahasa Indonesia", () => {
  it("keempat kalimatnya melewatkan tanggal lewat tanggalIso", () => {
    for (const potongan of [
      "membongkar majelis hakim tanggal ${tanggalIso(perkara.pmh)}",
      "membongkar panitera pengganti tanggal ${tanggalIso(perkara.ppp)}",
      "membongkar juru sita tanggal ${tanggalIso(perkara.pjs)}",
      "membongkar penetapan hari sidang tanggal ${tanggalIso(perkara.phs)}",
    ]) {
      expect(tulis).toContain(potongan);
    }
  });

  it("tidak ada lagi kolom DATE yang ditempel mentah ke keterangan", () => {
    for (const mentah of [
      "tanggal ${perkara.pmh}",
      "tanggal ${perkara.ppp}",
      "tanggal ${perkara.pjs}",
      "tanggal ${perkara.phs}",
    ]) {
      expect(tulis).not.toContain(mentah);
    }
  });
});
