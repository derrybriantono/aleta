// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PEUBAH WARNA YANG TIDAK PERNAH PUNYA NILAI
 * ============================================================================
 *
 * Kegagalan CSS tidak pernah berbunyi. Peubah yang menunjuk dirinya sendiri,
 * atau yang dipakai tanpa pernah didefinisikan, hanya membuat sifat yang
 * memakainya menjadi unset - tidak ada galat, tidak ada yang rusak, hanya
 * warna yang hilang. Itu yang paling lama tidak ketahuan.
 *
 * Dan memang begitu yang terjadi: sejak 1.73.0, ketika sembilan warna garis
 * yang ditulis tetap disatukan menjadi satu peubah, definisinya tertulis
 *
 *     --aleta-garis-kuat: var(--aleta-garis-kuat);
 *
 * sehingga tepi tombol kepala panel, kedua pegangan gulir, tepi kiri baris,
 * garis putus kaki, dan tepi kotak kehilangan warnanya pada tema GELAP - tema
 * bawaannya. Tema terang tidak pernah terkena, sebab di sana nilainya ditulis
 * sungguhan; itu pula sebabnya tidak ada yang menyadarinya selama tiga puluh
 * dua rilis.
 *
 * Dua penjaga di bawah ini menahan keduanya, dan berlaku untuk peubah apa pun
 * yang ditambahkan kelak - bukan hanya yang kebetulan pernah salah.
 */

const berkasGaya = path.resolve(process.cwd(), "../ekstensi-sipp/panel.css");
const gaya = () => readFileSync(berkasGaya, "utf8");

/** Nilai peubah dibaca tanpa komentar - contoh di komentar bukan definisi. */
const tanpaCatatan = () => gaya().replace(/\/\*[\s\S]*?\*\//g, "");

describe("peubah warna panel", () => {
  it("tidak ada peubah yang menunjuk dirinya sendiri", () => {
    const menunjukDiri: string[] = [];
    for (const cocok of tanpaCatatan().matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
      if (cocok[2].includes(`var(${cocok[1]})`)) menunjukDiri.push(cocok[1]);
    }
    expect(menunjukDiri).toEqual([]);
  });

  it("tiap peubah yang dipakai tanpa cadangan punya nilai", () => {
    // var(--x, sesuatu) sengaja dikecualikan: cadangannya memang jawabannya,
    // dan --aleta-skala-huruf justru dipasang saat jalan oleh panel-alat.js.
    const isi = gaya();
    const dipakaiTanpaCadangan = new Set(
      [...isi.matchAll(/var\((--[a-z0-9-]+)\s*\)/gi)].map((x) => x[1])
    );
    const didefinisikan = new Set(
      [...tanpaCatatan().matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((x) => x[1])
    );
    const tanpaNilai = [...dipakaiTanpaCadangan].filter((x) => !didefinisikan.has(x));
    expect(tanpaNilai).toEqual([]);
  });

  it("garis kuat punya nilai pada kedua tema", () => {
    // Satu nilai saja tidak cukup: yang dulu bocor justru sisi gelapnya,
    // sementara sisi terangnya benar - dan karena itu tidak ketahuan.
    // !important dilepas: kulit Modern (1.172.0) memakainya supaya menang atas
    // token sebaris panel portal - nilainya tetap harus warna sungguhan.
    const nilai = [...tanpaCatatan().matchAll(/--aleta-garis-kuat\s*:\s*([^;]+);/gi)].map((x) =>
      x[1].replace(/\s*!important\s*$/i, "").trim()
    );
    expect(nilai.length).toBeGreaterThanOrEqual(2);
    for (const x of nilai) expect(x).toMatch(/^#[0-9a-f]{3,8}$/i);
  });
});
