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
 *   2. Rencananya tetap ditarik lebih dahulu, dan rencana yang sudah BASI
 *      tidak boleh dapat ditulis.
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

describe("rencana dahulu, dan rencana basi tidak dapat ditulis", () => {
  const ringkas = badan(HASIL, "export function CatatHasilRingkas(");

  it("tombol tulis hanya ada sesudah rencananya di layar", () => {
    // Bukan tombol yang dinonaktifkan - ia belum ada. Tombol tulis yang
    // kelihatan sejak awal mengundang orang mencari cara melewati rencananya.
    //
    // Yang dicari panggilan kirim(false) - satu-satunya yang sungguh menulis -
    // bukan tulisan "Tulis ke SIPP", yang juga muncul di dalam catatan
    // penjelasnya. Penjaga yang menunjuk kalimat catatan akan tetap hijau
    // walau tombolnya dipindahkan ke luar syaratnya.
    // Syarat rencanaKering muncul DUA kali - sekali membungkus panel
    // rencananya, sekali membungkus tombol tulisnya - jadi yang dicari yang
    // TERDEKAT sebelum panggilan tulisnya, bukan yang pertama di berkas.
    const iTulis = ringkas.indexOf("kirim(false)");
    expect(iTulis, "panggilan kirim(false) tidak ketemu").toBeGreaterThan(-1);
    const iSyarat = ringkas.lastIndexOf("{rencanaKering ? (", iTulis);
    expect(iSyarat, "tombol tulis tidak berada di dalam syarat rencanaKering").toBeGreaterThan(-1);
    // Syaratnya belum ditutup di antara keduanya - berarti tombolnya sungguh
    // berada DI DALAM syarat itu, bukan sesudahnya.
    expect(ringkas.slice(iSyarat, iTulis)).not.toContain(") : null}");
  });

  it("rencana basi dikenali dari SIDIK isiannya, bukan dibersihkan belakangan", () => {
    // Membersihkannya lewat useEffect terlambat satu gambar: di antara isian
    // berubah dan efeknya berjalan, tombol "Tulis ke SIPP" masih terpasang
    // memegang rencana yang sudah tidak menggambarkan isiannya - dan tekanan
    // pada saat itu menuliskan sesuatu yang berbeda dari yang diperlihatkan.
    expect(ringkas).toContain("const sidikIsian = JSON.stringify([");
    expect(ringkas).toContain("sidikRencana === sidikIsian");
    // Sidiknya disimpan hanya pada jalan kering - yaitu saat rencananya lahir.
    expect(ringkas).toContain("if (kering) setSidikRencana(sidikIsian);");
  });

  it("SELURUH isian ikut ke dalam sidiknya", () => {
    // Satu isian yang tertinggal dari sidik berarti mengubahnya TIDAK
    // membasikan rencana - dan justru isian itulah yang kemudian tertulis
    // berbeda dari yang diperlihatkan.
    const i = ringkas.indexOf("const sidikIsian = JSON.stringify([");
    const sidik = ringkas.slice(i, ringkas.indexOf("]);", i));
    for (const isian of [
      "jalan",
      "alasanTunda",
      "tanggalBerikut",
      "jamBerikut",
      "agendaBerikut",
      "dihadiri",
      "statusId",
      "tanggalPutus",
      "verstek",
    ]) {
      expect(sidik, `isian ${isian} tidak ikut ke dalam sidik`).toContain(isian);
    }
  });

  it("tidak ada lagi efek yang membersihkan rencana belakangan", () => {
    expect(ringkas).not.toContain("setHasil(null);");
  });

  it("jalan kering dan jalan tulis memakai satu fungsi kirim", () => {
    expect(ringkas).toContain("kirim(true)");
    expect(ringkas).toContain("kirim(false)");
    expect(ringkas.match(/const kirim = useCallback\(/g)?.length).toBe(1);
  });

  it("hanya jalan tulis yang menyatakan sudah tertulis", () => {
    expect(ringkas).toContain("if (isi.ok && kering === false) {");
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
