"use strict";

/**
 * ============================================================================
 * PENJAGA: `grep -q` DI UJUNG PIPA BERSAMA `pipefail`
 * ============================================================================
 *
 * Gabungan ini memulangkan jawaban PALSU, dan palsunya selalu ke arah yang
 * sama - menyatakan tidak ketemu justru ketika ketemu.
 *
 * Sebabnya: `grep -q` berhenti membaca begitu menemukan yang dicari, lalu
 * menutup masukannya. Penulis di hulu yang masih mengirim mati kena SIGPIPE
 * dengan kode 141. Dengan `set -o pipefail`, kode itulah yang menjadi kode
 * seluruh pipeline - sehingga `if ! ... | grep -q ...` masuk ke cabang
 * "tidak ketemu" tepat pada saat ketemu.
 *
 * Yang membuatnya berbahaya: ia hanya muncul bila masukannya CUKUP PANJANG.
 * Pada masukan pendek, penulis sudah selesai sebelum grep menutup pipanya,
 * kodenya 0, dan semuanya tampak benar. Jadi ia lolos uji kecil, lalu gagal
 * pada data sungguhan.
 *
 * ============================================================================
 * INI BUKAN KEMUNGKINAN, INI SUDAH TERJADI
 * ============================================================================
 *
 * scripts/aleta-deploy-from-git.sh memeriksa apakah bungkusan yang akan
 * dikirim memuat package.json kedua aplikasi. Pemeriksaan itu ditulis:
 *
 *     printf '%s\n' "$ISI_BUNDLE" | grep -qx "$WAJIB"
 *
 * Daftar isinya 2.080 baris - jauh lebih panjang daripada yang dapat ditulis
 * sekaligus. Pemeriksaannya karena itu SELALU gagal, dan penaikan lewat skrip
 * itu tidak pernah dapat selesai sama sekali. Kekeliruannya tidak terlihat
 * sebagai kekeliruan: pesannya berbunyi "paketnya tidak utuh", yang terdengar
 * seperti penjaga yang bekerja.
 *
 * Gantinya here-string - tidak ada pipa, tidak ada yang dapat kena SIGPIPE:
 *
 *     grep -qxF -- "$WAJIB" <<< "$ISI_BUNDLE"
 */

const fs = require("fs");
const path = require("path");

const AKAR = path.resolve(__dirname, "..", "..");
const FOLDER = ["scripts", "aleta_bot/scripts", "manajemen_surat/scripts"];

let lulus = 0;
let gagal = 0;

function cek(nama, syarat, keterangan) {
  if (syarat) {
    lulus += 1;
    return;
  }
  gagal += 1;
  console.log(`  GAGAL  ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
}

/** Seluruh berkas .sh pada folder yang diperiksa. */
function berkasSh() {
  const hasil = [];
  FOLDER.forEach((f) => {
    const dir = path.join(AKAR, f);
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach((nama) => {
      if (!nama.endsWith(".sh")) return;
      const penuh = path.join(dir, nama);
      if (fs.statSync(penuh).isFile()) hasil.push({ jalur: `${f}/${nama}`, penuh });
    });
  });
  return hasil.sort((a, b) => a.jalur.localeCompare(b.jalur));
}

/**
 * Baris yang menyalurkan sesuatu ke grep yang berhenti awal.
 *
 * Yang dicari bukan hanya `grep -q`. `head` juga menutup masukannya lebih
 * awal, dan `grep -m N` berhenti sesudah N kecocokan - keduanya menimbulkan
 * SIGPIPE yang sama. Baris berkomentar tidak dihitung; contoh yang ditulis di
 * dalam keterangan justru berguna sebagai penjelasan.
 */
function barisBerbahaya(isi) {
  const temuan = [];
  isi.split(/\r?\n/).forEach((baris, i) => {
    const bersih = baris.trim();
    if (bersih.startsWith("#")) return;
    if (!bersih.includes("|")) return;

    // Bagian sesudah pipa terakhir - itulah pembaca yang mungkin berhenti awal.
    const sesudahPipa = bersih.slice(bersih.lastIndexOf("|") + 1).trim();
    const berhentiAwal =
      /^grep\b[^|]*\s-[A-Za-z]*q/.test(sesudahPipa) ||
      /^grep\b[^|]*\s-m\s*\d/.test(sesudahPipa) ||
      /^head\b/.test(sesudahPipa);
    if (berhentiAwal) temuan.push({ nomor: i + 1, baris: bersih });
  });
  return temuan;
}

/**
 * ============================================================================
 * YANG SENGAJA DITERIMA, BESERTA SEBABNYA
 * ============================================================================
 *
 * Tidak setiap pipa ke pembaca yang berhenti awal berbahaya. Bahayanya muncul
 * hanya bila penulis di hulu MASIH MENULIS saat pembacanya menutup pipa - dan
 * itu menuntut keluaran yang lebih panjang daripada penyangga pipa.
 *
 * Tempat di bawah menulis beberapa puluh bita saja, atau paling banyak
 * beberapa baris. Penulisnya selesai sebelum pembacanya sempat menutup, jadi
 * SIGPIPE tidak pernah terjadi.
 *
 * Tiap pengecualian menyebutkan SEBABNYA, dan sebabnya harus tentang PANJANG
 * KELUARAN - bukan "sudah lama begitu". Yang tidak tercantum di sini akan
 * menggagalkan penjaga ini, dan memang seharusnya begitu: menambah satu baris
 * ke daftar ini menuntut seseorang berpikir dahulu berapa panjang keluarannya.
 */
const DIKECUALIKAN = {
  "scripts/aleta-deploy-from-git.sh": [
    {
      petunjuk: "APP_VERSION",
      alasan: "sed memulangkan SATU baris versi; selesai jauh sebelum head menutup",
    },
  ],
  "scripts/aleta-update.sh": [
    {
      petunjuk: "maxdepth 1 -mindepth 1 -type d",
      alasan: "isi bungkusan yang sudah dibuka hanya satu folder akar",
    },
    {
      // Kutipnya lolos di dalam sumber shell, jadi petunjuknya nama peubah saja.
      petunjuk: "$key",
      alasan: "sed mengambil satu nilai dari manifest kecil",
    },
    {
      petunjuk: "APP_VERSION",
      alasan: "sed memulangkan SATU baris versi",
    },
  ],
  "scripts/aleta-rollback.sh": [
    {
      // Kutipnya lolos di dalam sumber shell, jadi petunjuknya nama peubah saja.
      petunjuk: "$key",
      alasan: "sed mengambil satu nilai dari manifest kecil",
    },
    {
      petunjuk: "APP_VERSION",
      alasan: "sed memulangkan SATU baris versi",
    },
  ],
  "scripts/aleta-kendali-berkas.sh": [
    {
      petunjuk: "0-9]{4}-[0-9]{2}-[0-9]{2}",
      alasan: "printf menulis satu tanggal - sepuluh bita",
    },
    {
      petunjuk: "^[0-9]+$",
      alasan: "printf menulis satu angka batas - beberapa bita",
    },
  ],
  "scripts/docker-backup-aleta.sh": [
    {
      petunjuk: "docker-compose ps postgres",
      alasan: "keluaran ps satu layanan hanya dua sampai tiga baris",
    },
  ],
};

/** Apakah baris ini sudah tercantum sebagai pengecualian bernalar? */
function dikecualikan(jalur, baris) {
  const daftar = Object.prototype.hasOwnProperty.call(DIKECUALIKAN, jalur)
    ? DIKECUALIKAN[jalur]
    : [];
  return daftar.find((x) => baris.includes(x.petunjuk)) || null;
}

console.log("Pipa ke pembaca yang berhenti awal, bersama pipefail\n");

const berkas = berkasSh();
cek("ada berkas skrip yang diperiksa", berkas.length > 0, "tidak ada berkas .sh ditemukan");

let diperiksa = 0;
const terpakai = new Set();
berkas.forEach(({ jalur, penuh }) => {
  const isi = fs.readFileSync(penuh, "utf8");
  const pakaiPipefail = /set\s+-[A-Za-z]*o?\s*pipefail|set\s+-o\s+pipefail/.test(isi);
  if (!pakaiPipefail) return;

  diperiksa += 1;
  const temuan = barisBerbahaya(isi);
  const belumBernalar = [];
  temuan.forEach((t) => {
    const alasan = dikecualikan(jalur, t.baris);
    if (alasan) {
      terpakai.add(`${jalur}::${alasan.petunjuk}`);
      return;
    }
    belumBernalar.push(t);
  });

  cek(
    `${jalur}: tiap pipa ke pembaca yang berhenti awal punya alasan tertulis`,
    belumBernalar.length === 0,
    belumBernalar.map((t) => `baris ${t.nomor}: ${t.baris.slice(0, 110)}`).join(" | ")
  );
});

// Pengecualian yang sudah tidak menunjuk apa pun harus dicabut. Daftar
// pengecualian yang menumpuk sisa lama perlahan berhenti dibaca orang, dan
// yang berikutnya masuk tanpa dipikirkan.
Object.keys(DIKECUALIKAN).forEach((jalur) => {
  DIKECUALIKAN[jalur].forEach((x) => {
    cek(
      `pengecualian ${jalur} (${x.petunjuk}) masih menunjuk baris yang ada`,
      terpakai.has(`${jalur}::${x.petunjuk}`),
      "barisnya sudah tidak ada - cabut pengecualian ini"
    );
  });
});

cek("ada skrip berpipefail yang diperiksa", diperiksa > 0, "tidak satu pun skrip memakai pipefail");

/* --------------------------------------------------------------------------
 * Pengenalnya benar-benar mengenali - dibuktikan, bukan dijanjikan
 * ------------------------------------------------------------------------ */

console.log("\n== Pengenalnya diuji dengan contoh ==");

const CONTOH = [
  ['printf \'%s\\n\' "$X" | grep -qx "$Y"', true, "grep -qx sesudah pipa"],
  ['cat berkas | grep -q pola', true, "grep -q sesudah pipa"],
  ['docker ps | grep -m 1 nama', true, "grep -m berhenti sesudah N"],
  ['ls | head -5', true, "head menutup masukannya"],
  ['grep -q pola berkas', false, "tanpa pipa - aman"],
  ['printf \'%s\\n\' "$X" | grep -cx "$Y"', false, "grep -c membaca sampai habis"],
  ['printf \'%s\\n\' "$X" | grep -x "$Y" > /dev/null', false, "tanpa -q, dibaca habis"],
  ['# printf | grep -q contoh di dalam komentar', false, "baris berkomentar tidak dihitung"],
  ['grep -qxF -- "$Y" <<< "$X"', false, "here-string, tanpa pipa"],
];

CONTOH.forEach(([baris, harusKetahuan, arti]) => {
  const ketahuan = barisBerbahaya(baris).length > 0;
  cek(`contoh dikenali dengan benar (${arti})`, ketahuan === harusKetahuan, baris);
});

/* --------------------------------------------------------------------------
 * Kekeliruan aslinya tidak boleh kembali
 * ------------------------------------------------------------------------ */

console.log("\n== Skrip penaikan memakai bentuk yang benar ==");

const DEPLOY = path.join(AKAR, "scripts", "aleta-deploy-from-git.sh");
if (fs.existsSync(DEPLOY)) {
  const isi = fs.readFileSync(DEPLOY, "utf8");
  cek(
    "pemeriksaan keutuhan bungkusan memakai here-string",
    /grep -qxF -- "\$WAJIB" <<< "\$ISI_BUNDLE"/.test(isi),
    "bentuk berpipa akan selalu menyatakan bungkusan tidak utuh"
  );
  cek(
    "dan tidak ada lagi bentuk berpipanya",
    !/printf '%s\\n' "\$ISI_BUNDLE" \| grep -q/.test(isi)
  );
} else {
  cek("skrip penaikan ada", false, `${DEPLOY} tidak ditemukan`);
}

console.log(`\n${diperiksa} skrip berpipefail diperiksa.`);
console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal === 0 ? 0 : 1);
