// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * TUJUH TAMBAHAN 1.107.0 - YANG DIJAGA DARI TIAP SATUNYA
 * ============================================================================
 *
 * Penjaga sumber, sama seperti berkas uji panel di sebelahnya: konten.js hidup
 * di dalam halaman SIPP, dan memalsukan seluruh lingkungan itu lebih mungkin
 * salah daripada kodenya sendiri.
 *
 * Yang dijaga di sini KEPUTUSANNYA - keputusan yang bila terbalik tidak
 * menimbulkan galat apa pun, hanya perilaku yang diam-diam berubah. Tiga di
 * antaranya berakibat pada berkas perkara yang sungguhan, dan ketiganya diberi
 * penjaga tersendiri:
 *
 *   - penetapan massal tidak pernah mencentang sendiri,
 *   - panel luring tidak pernah boleh menulis,
 *   - peta kolom yang ditebak tidak pernah dipasang sendiri.
 */

const akar = path.resolve(process.cwd(), "..");
const konten = () => readFileSync(path.join(akar, "ekstensi-sipp/konten.js"), "utf8");
const jembatan = () => readFileSync(path.join(akar, "ekstensi-sipp/jembatan.js"), "utf8");
const gaya = () => readFileSync(path.join(akar, "ekstensi-sipp/panel.css"), "utf8");

/** Potongan satu fungsi puncak - dibuka di kolom nol, ditutup di kolom nol. */
function potongFungsi(isi: string, nama: string): string {
  const baris = isi.replace(/\r\n/g, "\n").split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  let j = mulai;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}

// ═════════════════════════════════════════════════ 1. penetapan massal
describe("penetapan massal", () => {
  it("tidak ada satu pun perkara yang tercentang sendiri", () => {
    // Menetapkan seluruh halaman hanya karena tombolnya tertekan adalah
    // kesalahan yang tidak dapat dibatalkan dengan satu tekanan pula.
    const badan = potongFungsi(konten(), "bagianPenetapanMassal");
    expect(badan).toContain('centang.type = "checkbox";');
    expect(badan).not.toContain("centang.checked = true;");
  });

  it("dua tekanan - uji kering lebih dulu, baru menuliskannya", () => {
    const badan = potongFungsi(konten(), "bagianPenetapanMassal");
    expect(badan).toContain("await jalankan(true)");
    expect(badan).toContain("await jalankan(false)");
    expect(badan).toContain("sudahDiperiksa");
  });

  it("mengubah centang sesudah diperiksa mengembalikan ke tahap memeriksa", () => {
    // Tanpa itu, tekanan kedua menuliskan perkara yang rencananya tidak pernah
    // diperlihatkan.
    const badan = potongFungsi(konten(), "bagianPenetapanMassal");
    const perbarui = /function perbaruiTombol\(\) \{[\s\S]*?\n  \}/.exec(badan);
    expect(perbarui).not.toBeNull();
    expect(perbarui![0]).toContain("sudahDiperiksa = false;");
  });

  it("berhenti pada kegagalan pertama, dan menyebut yang sudah tertulis", () => {
    const badan = potongFungsi(konten(), "bagianPenetapanMassal");
    expect(badan).toContain("berhentiDi: nomor");
    expect(badan).toContain("sudah tertulis sebelum berhenti");
  });

  it("yang sudah ditetapkan dilewati, bukan dihitung gagal", () => {
    const badan = potongFungsi(konten(), "bagianPenetapanMassal");
    expect(badan).toContain("_sudah_ada$");
    // Yang dilewati hanya perkara yang TIDAK SATU LANGKAH PUN dikerjakan
    // (7 Okt 2026: tahap yang sudah ada tidak lagi dikirim - perkara lengkap
    // dilewati sebelum menulis, dan kegagalan sungguhan lebih dulu dicatat).
    expect(badan).toContain("if (dikerjakan.length === 0) {");
    expect(badan).toContain("sudah lengkap di SIPP - dilewati");
  });

  it("rantai yang TANGGUNG dihitung berhasil, bukan dilewati", () => {
    // Perkara yang PMH-nya sudah ada lalu PPP, PJS, dan PHS-nya baru saja
    // ditulis adalah perkara yang dikerjakan - bukan dilewati. Sebelumnya
    // satu langkah yang sudah ada membuat seluruh perkaranya dihitung
    // dilewati, padahal tiga langkah lainnya benar-benar masuk ke SIPP.
    const badan = potongFungsi(konten(), "bagianPenetapanMassal");
    // 7 Okt 2026: perkara tanggung dihitung berhasil dan disebut tahap yang
    // dikerjakan beserta tahap yang sudah ada sebelumnya.
    expect(badan).toContain("berhasil += 1;");
    expect(badan).toContain("sebutLangkah(sudahAda)} sudah ada)");
  });

  it("yang keempat penetapannya lengkap tidak ditawarkan sama sekali", () => {
    // Daftar yang sebagian besar isinya tidak dapat dikerjakan mengajari
    // orang untuk berhenti membacanya.
    const isi = konten();
    expect(isi).toContain("function langkahKurang(keadaan)");
    expect(potongFungsi(isi, "bagianPenetapanMassal")).toContain("if (kurangPer.size === 0)");
  });

  it("keadaan yang TIDAK diketahui dianggap belum ditetapkan", () => {
    // Menganggapnya lengkap berarti menyembunyikan perkara yang barangkali
    // justru belum ditetapkan sama sekali - kekeliruan yang tidak terlihat
    // siapa pun, sebab yang hilang memang tidak digambar.
    const badan = potongFungsi(konten(), "langkahKurang");
    expect(badan).toContain("if (!keadaan) return [...URUTAN_RANTAI];");
  });

  it("rantainya SATU salinan, dipakai bersama tombol satu perkara", () => {
    // Dua salinan rantai penetapan yang menulis ke SIPP adalah dua tempat yang
    // harus diingat bersamaan setiap kali urutannya berubah.
    const isi = konten();
    expect(isi.split("async function rantaiPenetapan(").length - 1).toBe(1);
    expect(potongFungsi(isi, "tetapkanLewatAleta")).toContain("await rantaiPenetapan(");
  });

  it("hanya digambar bagi yang memang boleh menulis penetapan", () => {
    expect(konten()).toContain('if (boleh("penunjukan") && boleh("kerjakan")) {');
  });
});

// ═════════════════════════════════════════════════ 2. praperiksa
describe("praperiksa yang berbicara manusia", () => {
  it("rapor hanya disusun untuk uji kering", () => {
    // Pada penulisan sungguhan yang dibaca orang hasilnya, bukan ramalannya.
    expect(konten()).toContain(
      "gambarHasilTulis(kabar, hasil, kering, kering ? raporPraperiksa(usulan, data, hasil) : null);"
    );
  });

  it("menyebut siapa, kenapa, dan kapan - bukan cacah pernyataan", () => {
    const badan = potongFungsi(konten(), "raporPraperiksa");
    expect(badan).toContain('label: "Panitera pengganti"');
    expect(badan).toContain('label: "Juru sita"');
    expect(badan).toContain('label: "Hari sidang"');
    expect(badan).toContain("sebab:");
  });

  it("hari sidang yang jatuh di akhir pekan disebutkan", () => {
    const badan = potongFungsi(konten(), "hariAkhirPekan");
    // Dibuat sebagai tanggal SETEMPAT: new Date("2026-09-26") dibaca sebagai
    // tengah malam UTC, dan itu hari yang berbeda di zona sebelah barat.
    expect(badan).toContain("new Date(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3]))");
    expect(badan).toContain("hari === 0 || hari === 6");
  });

  it("sidang yang terlalu dekat dengan pendaftaran disebutkan", () => {
    const isi = konten();
    expect(isi).toContain("const JARAK_SIDANG_MINIMUM = 7;");
    expect(potongFungsi(isi, "raporPraperiksa")).toContain("jarak < JARAK_SIDANG_MINIMUM");
  });

  it("yang sudah ada di SIPP disebut sebagai keadaan, bukan sebagai kegagalan", () => {
    const badan = potongFungsi(konten(), "raporPraperiksa");
    expect(badan).toContain("sudahAda");
    expect(badan).toContain("_sudah_ada$");
  });
});

// ═════════════════════════════════════════════════ 4. bongkar menyeluruh
describe("membatalkan seluruh penetapan", () => {
  it("tetap dua tekanan - rencananya diperlihatkan lebih dulu", () => {
    const badan = potongFungsi(konten(), "tombolBongkarSemua");
    expect(badan).toContain("sudahDiperlihatkan");
    expect(badan).toContain("mintaBongkarSemua(perkaraId, akunPerJenis, true)");
    expect(badan).toContain("mintaBongkarSemua(perkaraId, akunPerJenis, false)");
  });

  it("rantainya diurus bot, bukan empat permintaan dari peramban", () => {
    const badan = potongFungsi(konten(), "mintaBongkarSemua");
    expect(badan).toContain("ALETA_API_HAPUS_SEMUA");
    expect(badan).toContain("await alatAmbil(");
  });

  it("yang berhenti di tengah menyebut sampai mana perkaranya terbongkar", () => {
    expect(potongFungsi(konten(), "tombolBongkarSemua")).toContain(
      "Berhenti sesudah ${berhasil} langkah"
    );
  });
});

// ═════════════════════════════════════════════════ 5. panel luring
describe("panel luring", () => {
  it("SELURUH kewenangan menulis dimatikan, dari satu titik", () => {
    // Usulan majelis dihitung dari giliran dan beban perkara yang berubah tiap
    // hari; menetapkan dari usulan kemarin berarti menuliskan giliran yang
    // sudah tidak berlaku ke dalam berkas perkara yang sungguhan.
    const isi = konten();
    const badan = potongFungsi(isi, "boleh");
    expect(badan).toContain("sedangLuring && KEWENANGAN_MENULIS.includes(kunci)");
    for (const kunci of ["kerjakan", "penunjukan", "data-umum", "penunjukan-otomatis"]) {
      expect(isi).toContain(`"${kunci}"`);
    }
  });

  it("jawaban yang segar mengakhiri keadaan luring", () => {
    // Tanpa ini, satu kegagalan jaringan mematikan tombol Tetapkan sampai
    // halamannya dimuat ulang - dan itu terbaca sebagai kewenangan yang hilang.
    expect(konten()).toContain("sedangLuring = false;");
  });

  it("simpanan dibatasi jumlah dan umurnya", () => {
    const isi = konten();
    expect(isi).toContain("const BATAS_SIMPANAN_KONTEKS = 12;");
    expect(isi).toContain("const UMUR_SIMPANAN_MAKS =");
    expect(potongFungsi(isi, "ambilKonteksLuring")).toContain("umur > UMUR_SIMPANAN_MAKS");
  });

  it("dipakai ketika panggilan sungguhan gagal, DAN sebagai pendahulu", () => {
    // Sejak 1.111.0 ada dua jalan, dan keduanya disengaja:
    //
    //   PENDAHULU  panggilannya masih terbang tetapi sudah lewat 400 ms -
    //              panel digambar dari simpanan supaya ada yang terbaca,
    //              dengan pita yang menyebutkan ia sedang disegarkan.
    //   CADANGAN   panggilannya gagal - panel digambar dari simpanan dengan
    //              pita yang menyebutkan ALETA tidak terjangkau.
    //
    // Yang TIDAK berubah: keduanya mematikan kewenangan menulis sampai
    // jawaban yang segar tiba.
    const isi = konten();
    const segarkan = potongFungsi(isi, "segarkan");
    expect(segarkan).toContain("gambarDariSimpanan(nomor, { menyegarkan: true })");
    expect(segarkan).toContain("await gambarDariSimpanan(nomor)");
    // Cadangannya tetap SESUDAH pemeriksaan jawabannya.
    expect(segarkan.indexOf("await gambarDariSimpanan(nomor)")).toBeGreaterThan(
      segarkan.indexOf("if (!respons.ok)")
    );
    // Dan keduanya sama-sama mematikan tulis - lihat gambarDariSimpanan.
    expect(potongFungsi(isi, "gambarDariSimpanan")).toContain("sedangLuring = true;");
  });

  it("mencoba lagi sendiri, dan berhenti begitu jawabannya datang", () => {
    // Tanpa ini panel yang sekali jatuh ke simpanan TETAP memakai simpanan
    // sampai halamannya berpindah - walau ALETA hidup kembali sedetik
    // kemudian. Penjaga nomorTerakhir yang menahannya.
    const isi = konten();
    expect(isi).toContain("const JEDA_COBA_LURING = 30000;");
    expect(potongFungsi(isi, "mulaiMencobaLagi")).toContain('nomorTerakhir = "";');
    expect(isi).toContain("berhentiMencobaLagi();");
  });

  it("usianya disebutkan, tidak disamarkan sebagai data segar", () => {
    const badan = potongFungsi(konten(), "pitaLuring");
    expect(badan).toContain("usiaData(waktuIso).teks");
    expect(badan).toContain("ALETA tidak terjangkau");
    expect(gaya()).toContain(".aleta-pita-luring");
  });
});

// ═════════════════════════════════════════════════ 8. peta kolom
describe("peta kolom yang mengusulkan dirinya sendiri", () => {
  it("mengusulkan, tidak pernah memasang", () => {
    // Peta yang keliru mengisi kolom yang salah pada formulir yang sungguhan.
    const isi = konten();
    expect(isi).toContain("tombolSalin(");
    expect(isi).not.toContain("simpanPetaKolom(");
    expect(isi).not.toContain("pasangPetaKolom(");
  });

  it("dicocokkan dari ISI kolomnya, bukan dari namanya", () => {
    const badan = potongFungsi(konten(), "usulkanPetaKolom");
    expect(badan).toContain("String(kolom.nilai ||");
    expect(badan).toContain("bakuNilai(isiKolom) === bakuNilai(calon.nilai)");
  });

  it("satu medan hanya diusulkan sekali", () => {
    // Halaman SIPP kerap memuat nama yang sama di dua tempat, dan mengusulkan
    // keduanya berarti menyerahkan pilihan tanpa memberi dasar memilih.
    const badan = potongFungsi(konten(), "usulkanPetaKolom");
    expect(badan).toContain("sudah.has(calon.medan)");
    expect(badan).toContain("sudah.add(calon.medan)");
  });

  it("tanggal dibandingkan sesudah dibakukan, bukan sebagai untai", () => {
    const badan = potongFungsi(konten(), "tanggalBaku");
    expect(badan).toContain("^(\\d{4})-(\\d{2})-(\\d{2})");
    expect(badan).toContain("^(\\d{1,2})[/-](\\d{1,2})[/-](\\d{4})");
  });

  it("jembatan membawa isi kolom sepotong, dan tetap menyaring yang rahasia", () => {
    const isi = jembatan();
    expect(isi).toContain(".slice(0, 200)");
    // Penjaga lama yang tidak boleh ikut hilang: kolom sandi dan tersembunyi
    // tidak pernah dibaca sama sekali.
    expect(isi).toContain('if (jenisMasukan === "hidden" || jenisMasukan === "password") continue;');
    expect(isi).toContain('if (elemen.closest("#aleta-panel")) continue;');
  });
});

// ═════════════════════════════════════════════════ 9. pintasan papan tik
describe("pintasan papan tik", () => {
  it("diabaikan selagi mengetik di kolom isian", () => {
    // Petugas yang sedang mengetik posita tidak sedang meminta panel ditutup.
    const badan = potongFungsi(konten(), "sedangMengetik");
    expect(badan).toContain("simpul.isContentEditable");
    expect(badan).toContain("input, textarea, select");
  });

  it("preventDefault hanya ketika pintasannya dikenali", () => {
    // Tombol yang tidak dikenali diteruskan apa adanya ke SIPP.
    const badan = potongFungsi(konten(), "pintasanPapanTik");
    const baris = badan.split("\n");
    const cegah = baris.filter((b) => b.includes("preventDefault"));
    expect(cegah.length).toBeGreaterThanOrEqual(3);
    // Tidak ada satu pun preventDefault sebelum tombolnya diperiksa.
    expect(badan.indexOf("preventDefault")).toBeGreaterThan(badan.indexOf("const tombol ="));
  });

  it("Alt+Enter menekan tombolnya, tidak melompati pengesahannya", () => {
    const badan = potongFungsi(konten(), "pintasanPapanTik");
    expect(badan).toContain("tetapkan.click()");
    expect(badan).toContain("if (!tetapkan || tetapkan.disabled) return;");
    // Tidak memanggil rantai penetapan sendiri - itu akan melewati tekanan
    // kedua yang menjadi pengesahannya.
    expect(badan).not.toContain("rantaiPenetapan(");
  });

  it("dipasang pada fase tangkap, dan disebutkan di kaki panel", () => {
    const isi = konten();
    expect(isi).toContain('document.addEventListener("keydown", pintasanPapanTik, true);');
    expect(isi).toContain("PINTASAN_PANEL.map((x)");
    expect(gaya()).toContain(".aleta-kaki-pintasan");
  });
});
