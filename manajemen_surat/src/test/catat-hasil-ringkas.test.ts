import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { usulanAgendaBerikut } from "@/components/portal/hasil-sidang";

/**
 * ============================================================================
 * TUNDA DAN PUTUS LANGSUNG DARI BARIS ANTRIAN
 * ============================================================================
 *
 * Yang dijaga di sini bukan tampilannya, melainkan dua hal yang bila lepas
 * tidak akan berbunyi sampai sesuatu sudah terlanjur tertulis ke berkas
 * perkara orang:
 *
 *   1. Mesinnya tetap SATU dengan layar Hasil Sidang - alamat dan bentuk
 *      muatan yang sama. Jalan kedua yang disusun sendiri akan menyimpang
 *      diam-diam.
 *   2. Sejak 30 September 2026 (butir 13) borang di baris antrian menulis
 *      LANGSUNG dalam satu tekan, lalu memperlihatkan yang tertulis; langkah
 *      rencana tinggal di layar Hasil Sidang penuh.
 */

const AKAR = process.cwd();
const HASIL = fs.readFileSync(path.join(AKAR, "src/components/portal/hasil-sidang.tsx"), "utf8");
const SIDANG = fs.readFileSync(
  path.join(AKAR, "src/components/portal/aleta-ecourt-sidang.tsx"),
  "utf8"
);

/**
 * Membaca badan satu fungsi tingkat atas.
 *
 * Penutupnya dicari sebagai kurung tutup yang BERDIRI SENDIRI di lajur
 * pertama - "\n}\n". Mencari "\n}" saja memotong di parameter berbentuk
 * objek, yang barisnya berbunyi "}: {" - dan potongan sependek itu tetap
 * lulus sebagian penjaga di bawah, sehingga salahnya tidak berbunyi.
 */
function badan(berkas: string, tandaTangan: string): string {
  const i = berkas.indexOf(tandaTangan);
  expect(i, `tanda tangan tidak ketemu: ${tandaTangan}`).toBeGreaterThan(-1);
  const j = berkas.indexOf("\n}\n", i);
  expect(j).toBeGreaterThan(i);
  const isi = berkas.slice(i, j);
  // Penjaga bagi penjaganya sendiri: badan yang terpotong di parameter
  // panjangnya ratusan huruf, bukan ribuan.
  expect(isi.length, "badan fungsi terpotong terlalu pendek").toBeGreaterThan(2000);
  return isi;
}

describe("usulanAgendaBerikut", () => {
  it("mengusulkan satu langkah sesudah agenda hari ini", () => {
    expect(usulanAgendaBerikut("Pembacaan Gugatan")).toBe("Jawaban");
    expect(usulanAgendaBerikut("Jawaban")).toBe("Replik");
    expect(usulanAgendaBerikut("Kesimpulan")).toBe("Pembacaan Putusan");
  });

  it("tidak peduli huruf besar-kecil dan spasi tepi", () => {
    expect(usulanAgendaBerikut("  jawaban  ")).toBe("Replik");
    expect(usulanAgendaBerikut("PEMBACAAN GUGATAN")).toBe("Jawaban");
  });

  it("diam pada agenda yang tidak dikenali - tidak mengarang", () => {
    // Menebak dari kalimat yang tidak dikenali berarti menuliskan agenda
    // karangan ke jadwal sidang orang.
    for (const a of ["", "Mediasi lanjutan", "Pemeriksaan setempat", "sidang"]) {
      expect(usulanAgendaBerikut(a)).toBe("");
    }
  });

  it("diam pada agenda TERAKHIR - sesudah pembacaan putusan tidak ada berikutnya", () => {
    expect(usulanAgendaBerikut("Pembacaan Putusan")).toBe("");
  });
});

describe("CatatHasilRingkas memakai mesin yang sama dengan Hasil Sidang", () => {
  const ringkas = badan(HASIL, "export function CatatHasilRingkas(");

  it("ada dan diekspor dari berkas yang sama", () => {
    // Sengaja seberkas: dua jalan menulis ke SIPP yang disusun terpisah akan
    // menyimpang diam-diam.
    expect(HASIL).toContain("export function CatatHasilRingkas(");
  });

  it("memakai kedua alamat yang sama, bukan alamat sendiri", () => {
    expect(ringkas).toContain('"/api/aleta-ecourt/sidang-tunda"');
    expect(ringkas).toContain('"/api/aleta-ecourt/sidang-putus"');
  });

  it("mengirim ruangId, dihadiriOleh, dan jamSekarang - seperti blangko lengkapnya", () => {
    for (const ruas of ["ruangId: keadaan.ruanganId", "dihadiriOleh: dihadiri", "jamSekarang: keadaan.jamSidang"]) {
      expect(ringkas).toContain(ruas);
    }
  });

  it("tidak menanyakan akun SIPP kepada siapa pun", () => {
    // Bertanya membuka pintu menulis atas nama orang lain, dan audit trail
    // SIPP hanya mencatat nama yang diberikan kepadanya.
    expect(ringkas).not.toMatch(/username["\s:=]/i);
    expect(ringkas.match(/atasNama/g)?.length ?? 0).toBeGreaterThan(0); // hanya DITAMPILKAN
  });
});

describe("langsung dieksekusi, ringkasannya sesudah menulis (butir 13, 30 Sep 2026)", () => {
  /**
   * Sampai 2.40.1 penjaga di sini menuntut "rencana dahulu, baru tulis".
   * Butir 13 perbaikan 30 September 2026 membaliknya DENGAN SENGAJA: pengguna
   * meminta tombol tunda dan putus di Jadwal Sidang langsung dieksekusi tanpa
   * "Lihat rencana". Yang dijaga sekarang: satu tekan = satu kiriman bertanda
   * kering:false, tidak ada tekan kedua, dan yang tertulis diperlihatkan dari
   * jawaban server (selesai), bukan dari rencana.
   */
  const ringkas = badan(HASIL, "export function CatatHasilRingkas(");

  it("tidak ada lagi langkah Lihat rencana maupun kiriman kering di borang ringkas", () => {
    expect(ringkas).not.toContain("Lihat rencana");
    expect(ringkas).not.toContain("kirim(true)");
    expect(ringkas).not.toContain("kering: true");
    expect(ringkas).not.toContain("rencanaKering");
  });

  it("satu tombol menulis langsung - kedua muatan (tunda & putus) bertanda kering:false", () => {
    expect(ringkas.match(/const kirim = useCallback\(/g)?.length).toBe(1);
    expect(ringkas).toContain("onClick={() => void kirim()}");
    expect(ringkas.match(/kering: false,/g)?.length).toBe(2);
    expect(ringkas).toContain('{sibuk ? "Menulis…" : jalan === "tunda" ? "Tunda sekarang" : "Catat putus"}');
  });

  it("tombolnya mati selama isian belum lengkap atau sedang menulis, dan tekan kedua ditolak", () => {
    expect(ringkas).toContain("disabled={!lengkap || sibuk || atasNama?.ok === false}");
    expect(ringkas).toContain("if (!keadaan || sibuk || sudahTertulis) return;");
  });

  it("sesudah tertulis borangnya berganti ringkasan dari jawaban server", () => {
    expect(ringkas).toContain("if (isi.ok && isi.kering !== true) {");
    expect(ringkas).toContain("(hasil?.selesai ?? []).map(");
    expect(ringkas).toContain('aria-label="Yang ditulis ke SIPP"');
    // Ringkasan itu cabang TERSENDIRI - tidak ada tombol tulis di dalamnya.
    const i = ringkas.indexOf("if (sudahTertulis) {");
    const j = ringkas.indexOf("return (", ringkas.indexOf("return (", i) + 1);
    expect(i).toBeGreaterThan(-1);
    expect(ringkas.slice(i, j)).not.toContain("kirim(");
  });

  it("layar Hasil Sidang penuh tetap memiliki langkah rencananya", () => {
    // Fitur lama tidak dihapus - hanya tidak dipakai tombol di baris antrian.
    const penuh = HASIL.slice(0, HASIL.indexOf("export function CatatHasilRingkas("));
    expect(penuh).toContain("Lihat rencananya");
    expect(penuh).toContain("void kirim(true)");
  });
});

describe("tombolnya di baris antrian", () => {
  it("dipakai dari berkas hasil-sidang, tidak disalin", () => {
    expect(SIDANG).toContain('import { CatatHasilRingkas } from "@/components/portal/hasil-sidang"');
    expect(SIDANG).toContain("<CatatHasilRingkas");
  });

  it("disembunyikan pada sidang yang hasilnya sudah tercatat", () => {
    // Penundaan kedua atas sidang yang sudah diputus menambah baris jadwal
    // yang tidak pernah disidangkan.
    expect(SIDANG).toContain("{sidangSelesai ? null : (");
  });

  it("satu baris saja yang boleh mencatat pada satu waktu", () => {
    // Dua borang tulis-ke-SIPP terbuka bersamaan adalah undangan menekan
    // tombol tulis pada baris yang keliru.
    expect(SIDANG).toContain(
      'const [catat, setCatat] = useState<{ kunci: string; jalan: "tunda" | "putus" } | null>(null);'
    );
    expect(SIDANG).toContain("catat?.kunci === kunci ? (");
  });

  it("kedua tombolnya menyebut dirinya bagi pembaca layar", () => {
    expect(SIDANG).toContain("aria-label={`Tunda sidang ${baris.nomorPerkara}`}");
    expect(SIDANG).toContain("aria-label={`Catat putusan ${baris.nomorPerkara}`}");
  });

  it("tombolnya di SAMPING jenis perkara, bukan di depan nomor", () => {
    // ========================================================================
    // DIMINTA PENGGUNA 22 SEPTEMBER 2026
    // ========================================================================
    //
    // Sebelumnya keduanya berdiri di DEPAN nomor perkara - tempat yang paling
    // dahulu dibaca mata. Akibatnya yang pertama terbaca pada tiap baris bukan
    // perkaranya, melainkan dua tombol yang bentuknya sama persis pada dua
    // puluh tujuh baris; dan nomor perkara, satu-satunya hal yang membedakan
    // baris, terdorong ke kanan sejauh panjang penandanya - sehingga tidak
    // lagi berbaris lurus ke bawah.
    //
    // Dijaga lewat URUTAN TULIS, bukan lewat nama kelas: kelas dapat diganti
    // tanpa memindahkan apa pun, dan yang diminta pengguna letaknya.
    const iNomor = SIDANG.indexOf("{baris.nomorPerkara}");
    const iJenis = SIDANG.indexOf('{baris.jenisPerkara || "—"}');
    const iTunda = SIDANG.indexOf('{ kunci, jalan: "tunda" }');
    expect(iNomor, "nomor perkara tidak ketemu").toBeGreaterThan(-1);
    expect(iJenis, "jenis perkara tidak ketemu").toBeGreaterThan(-1);
    expect(iTunda, "tombol tunda tidak ketemu").toBeGreaterThan(-1);

    expect(iTunda, "tombol tunda mendahului nomor perkara").toBeGreaterThan(iNomor);
    expect(iTunda, "tombol tunda tidak bersebelahan dengan jenis perkara").toBeGreaterThan(iJenis);
  });

  it("keduanya berbagi satu baris dengan jenis perkara", () => {
    // Bukan sekadar berurutan di berkas - keduanya harus benar-benar duduk di
    // dalam pembungkus yang sama, kalau tidak ia turun ke baris sendiri dan
    // justru menambah tinggi tiap baris daftar.
    const i = SIDANG.indexOf('{baris.jenisPerkara || "—"}');
    const blok = SIDANG.slice(Math.max(0, i - 400), i);
    expect(blok).toContain("flex flex-wrap items-center");
  });
});
