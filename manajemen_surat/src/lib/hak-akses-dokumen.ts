/**
 * Dokumen docs/hak-akses/MATRIKS-HAK-AKSES-18okt.md DIBANGKITKAN dari peta hak akses
 * (lib/hak-akses-peta.ts) - bukan diketik tangan. Uji hak-akses-peta-18okt.test.ts
 * membandingkan berkasnya dengan keluaran fungsi ini; bila peta berubah, jalankan:
 *
 *   npx tsx scripts/hak-akses-md.ts
 *
 * dari folder manajemen_surat/ (menulis ulang berkas docs/hak-akses/MATRIKS-HAK-AKSES-18okt.md).
 */

import {
  HAK_MENU_ABT,
  KEPUTUSAN_DISETUJUI,
  KEPUTUSAN_MENUNGGU,
  KEWENANGAN_KHUSUS,
  NAMA_GRUP_SIPP,
  LABEL_KELOMPOK,
  LABEL_TINGKAT,
  PERUBAHAN_18OKT,
  URUTAN_KELOMPOK,
  susunPetaHakAkses,
  tingkatButir,
  type ButirPeta,
} from "@/lib/hak-akses-peta";
import {
  GOLONGAN_PERAN,
  LABEL_GOLONGAN,
  PERAN_TAMBAHAN_KASIR_HAK,
  PERAN_TAMBAHAN_MEDIATOR_HAK,
  PERAN_TAMBAHAN_PETUGAS_SIDANG_HAK,
  PERAN_TAMBAHAN_PTSP_HAK,
  golonganDariPeran,
  type GolonganPeran,
} from "@/lib/matriks-peran";
import { roles } from "@/lib/mock-data";

/** Singkatan kolom di dokumen (lebar tabel Markdown terbatas). */
const SINGKATAN: Record<GolonganPeran, string> = {
  "super-admin": "SA",
  admin: "Adm",
  pimpinan: "Pim",
  hakim: "Hak",
  panitera: "Pan",
  panmud: "Pmd",
  pp: "PP",
  jurusita: "JS",
  kasir: "Ksr",
  ptsp: "PTS",
  mediator: "Med",
  "petugas-sidang": "Sdg",
  "analis-perkara": "Anl",
  sekretariat: "Sek",
  ti: "TI",
  pelaksana: "Plk",
};

const LAMBANG = { L: "L", P: "P", U: "U", "-": "-" } as const;

const sel = (teks: string) => teks.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

function tabel(butir: readonly ButirPeta[]): string[] {
  const kepala = ["Fitur", ...GOLONGAN_PERAN.map((g) => SINGKATAN[g])];
  const baris = [`| ${kepala.join(" | ")} |`, `| ${kepala.map((k, i) => (i === 0 ? ":--" : ":-:")).join(" | ")} |`];
  for (const b of butir) {
    baris.push(`| ${sel(b.judul)} | ${GOLONGAN_PERAN.map((g) => LAMBANG[tingkatButir(b, g)]).join(" | ")} |`);
  }
  return baris;
}

function tabelHakMenuAbt(k: string[]) {
  k.push("### Hak menu ABT per folder (kelompok pengguna SIPP)");
  k.push("");
  k.push(
    "Dari salinan lokal ABT (hanya dibaca, paket yang siap; yang berjalan di server dapat berbeda sampai paketnya dipasang). Hak diatur per folder: membuka folder berarti membuka seluruh isinya. Folder terbuka bila tahap perkara di SIPP berada dalam rentang tahap DAN jenis atau alur perkara cocok; Super Admin melewati cek tahap."
  );
  k.push("");
  k.push("| Folder | Tahap SIPP | Kelompok yang membuka | Acc/pemeriksa |");
  k.push("| :-- | :-: | :-- | :-- |");
  const namaGrup = (daftar: readonly number[] | undefined) => (daftar ?? []).map((g) => NAMA_GRUP_SIPP[g] ?? String(g)).join(", ") || "-";
  for (const h of HAK_MENU_ABT) k.push(`| ${sel(h.folder)} | ${h.tahap} | ${namaGrup(h.grup)} | ${namaGrup(h.validator)} |`);
  k.push("");
  for (const h of HAK_MENU_ABT.filter((x) => x.catatan)) k.push(`- **${sel(h.folder)}**: ${sel(h.catatan as string)}`);
  k.push("");
}

export function susunMarkdownHakAkses(): string {
  const peta = susunPetaHakAkses();
  const k: string[] = [];
  k.push("# Matriks hak akses per peran - 18 Oktober 2026");
  k.push("");
  k.push(
    "> Dokumen ini DIBANGKITKAN dari `manajemen_surat/src/lib/hak-akses-peta.ts` (data yang sama dengan halaman portal Pengaturan > Hak akses per peran). Jangan disunting tangan: ubah petanya lalu jalankan `npx tsx scripts/hak-akses-md.ts` dari folder `manajemen_surat/`. Uji `hak-akses-peta-18okt` merah bila dokumen ini menyimpang."
  );
  k.push("");
  k.push("## Cara membaca");
  k.push("");
  k.push(
    `- **${LABEL_TINGKAT.L} (L)**: melihat atau membaca saja. **${LABEL_TINGKAT.P} (P)**: menjalankan fitur dalam tugasnya (membuat, mengisi, mencetak, menarik). **${LABEL_TINGKAT.U} (U)**: mengubah data atau pengaturan satker, atau menulis hasil substantif. **-**: tidak diberi (menu tidak tampil dan rute menjawab 403).`
  );
  k.push("- Super Admin (SA) memegang tingkat tertinggi di SEMUA baris dan semuanya ditampilkan. Admin (Adm) pengelola satker: semua yang matang, kecuali yang tertulis sebaliknya di kolom catatan.");
  k.push("- Satu orang dapat memiliki beberapa golongan (jabatan utama ditambah peran tambahan Kasir, PTSP, mediator, operator, atau meja SIPP): haknya gabungan; peran tambahan hanya menambah.");
  k.push("");
  k.push("### Kolom peran");
  k.push("");
  k.push("| Singkatan | Golongan | Isi |");
  k.push("| :-- | :-- | :-- |");
  const ISI_GOLONGAN: Record<GolonganPeran, string> = {
    "super-admin": "Super Admin",
    admin: "Admin",
    pimpinan: "Ketua dan Wakil Ketua",
    hakim: "Hakim",
    panitera: "Panitera (Wakil Panitera)",
    panmud: "Panitera Muda (gugatan, permohonan, hukum)",
    pp: "Panitera Pengganti",
    jurusita: "Jurusita dan Jurusita Pengganti",
    kasir: "Analis Keuangan; peran tambahan kasir, petugas keuangan perkara, bendahara",
    ptsp: "Operator; petugas PTSP, meja informasi, pendaftaran, operator SIPP/e-Doc; Meja 1 SIPP",
    mediator: "Mediator non-hakim (peran tambahan)",
    "petugas-sidang": "Penjaga sidang; operator antrian, panggilan, dan video sidang",
    "analis-perkara": "Analis perkara, pengelola penanganan perkara, dokumentalis hukum; Meja 2/3 SIPP",
    sekretariat: "Sekretaris, Kepala Subbagian, pejabat struktural, staf umum, kepegawaian, dan keuangan APBN",
    ti: "Pranata Komputer, staf PTIP",
    pelaksana: "Pelaksana, PPPK, dan staf tanpa tugas khusus",
  };
  for (const g of GOLONGAN_PERAN) k.push(`| ${SINGKATAN[g]} | ${LABEL_GOLONGAN[g]} | ${ISI_GOLONGAN[g]} |`);
  k.push("");
  k.push("### Peran akun di portal menjadi golongan");
  k.push("");
  k.push("| Peran akun | Golongan dasar |");
  k.push("| :-- | :-- |");
  for (const r of roles) k.push(`| ${sel(r.name)} | ${LABEL_GOLONGAN[golonganDariPeran(r.id)]} |`);
  k.push("");
  k.push(
    "Jabatan (misalnya Panitera Muda Gugatan, Jurusita Pengganti, Pranata Komputer) dan peran tambahan menggeser golongan: peran tambahan hanya MENAMBAH golongan, tidak pernah mengganti golongan utama dan tidak memberi hak di atas golongan itu."
  );
  k.push("");
  k.push("| Peran tambahan | Menambah golongan |");
  k.push("| :-- | :-- |");
  k.push(`| ${PERAN_TAMBAHAN_KASIR_HAK.join(", ")} | ${LABEL_GOLONGAN.kasir} |`);
  k.push(`| ${PERAN_TAMBAHAN_PTSP_HAK.join(", ")}, operator, petugas_meja_1_* (Meja 1 SIPP) | ${LABEL_GOLONGAN.ptsp} |`);
  k.push(`| petugas_meja_2_*, petugas_meja_3_* (Meja 2 dan 3 SIPP) | ${LABEL_GOLONGAN["analis-perkara"]} |`);
  k.push(`| ${PERAN_TAMBAHAN_MEDIATOR_HAK.join(", ")} | ${LABEL_GOLONGAN.mediator} |`);
  k.push(`| ${PERAN_TAMBAHAN_PETUGAS_SIDANG_HAK.join(", ")}, operator | ${LABEL_GOLONGAN["petugas-sidang"]} |`);
  k.push("");

  for (const kelompok of URUTAN_KELOMPOK) {
    const butir = peta.filter((b) => b.kelompok === kelompok);
    if (butir.length === 0) continue;
    k.push(`## ${LABEL_KELOMPOK[kelompok]}`);
    k.push("");
    k.push(...tabel(butir));
    k.push("");
    const bercatatan = butir.filter((b) => b.catatan);
    if (bercatatan.length) {
      k.push("Catatan kewenangan:");
      k.push("");
      for (const b of bercatatan) k.push(`- **${sel(b.judul)}**: ${sel(b.catatan as string)}`);
      k.push("");
    }
    if (kelompok === "blangko") tabelHakMenuAbt(k);
  }

  k.push("## Kewenangan khusus");
  k.push("");
  for (const w of KEWENANGAN_KHUSUS) k.push(`- **${w.judul}**: ${w.isi}`);
  k.push("");
  k.push("## Perubahan dibanding sebelumnya (18 Okt 2026)");
  k.push("");
  k.push("Tanda: *sesuai keputusan* = sudah diputuskan pengguna; *pilihan baru* = dipilih agen di area yang belum pernah diputuskan, menunggu konfirmasi.");
  k.push("");
  PERUBAHAN_18OKT.forEach((p, i) => {
    k.push(`${i + 1}. **${p.judul}** (${p.keputusan === "baru" ? "pilihan baru" : "sesuai keputusan"})`);
    k.push(`   - Sebelum: ${p.sebelum}`);
    k.push(`   - Sesudah: ${p.sesudah}`);
    k.push(`   - Alasan: ${p.alasan}`);
  });
  k.push("");
  k.push("## Keputusan pengguna 18 Okt 2026 malam (sudah berlaku)");
  k.push("");
  for (const d of KEPUTUSAN_DISETUJUI) k.push(`- **${d.nomor} ${d.judul}**: ${d.isi}`);
  k.push("");
  k.push("## Hal yang menunggu keputusan pengguna");
  k.push("");
  KEPUTUSAN_MENUNGGU.forEach((p, i) => {
    k.push(`${i + 1}. **${p.judul}**`);
    k.push(`   - Keadaan: ${p.keadaan}`);
    k.push(`   - Usul: ${p.usul}`);
  });
  k.push("");
  return k.join("\n");
}
