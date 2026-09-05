"use strict";

/**
 * Menguji simpanan sandi e-Court dan pembacaan keadaan sesi.
 *
 * Yang diuji terutama BATASNYA: sandi tidak pernah keluar, berkas yang
 * disunting ditolak, dan "belum diperiksa" tidak pernah dibaca sebagai
 * "kedaluwarsa".
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

// Folder simpanan diarahkan ke folder sementara SEBELUM layanannya dimuat,
// supaya uji ini tidak pernah menyentuh simpanan sungguhan.
const folderUji = fs.mkdtempSync(path.join(os.tmpdir(), "aleta-kredensial-uji-"));
process.env.ALETA_ECOURT_KREDENSIAL_DIR = folderUji;

const kredensial = require("../services/ecourtKredensialService");
const sesiStatus = require("../services/ecourtSesiStatusService");

let jumlah = 0;
let gagal = 0;

function cek(nama, dapat, harap) {
  jumlah += 1;
  if (JSON.stringify(dapat) !== JSON.stringify(harap)) {
    gagal += 1;
    console.log(`  GAGAL: ${nama}`);
    console.log(`         diharap ${JSON.stringify(harap)}, didapat ${JSON.stringify(dapat)}`);
  }
}

console.log("");
console.log("Uji simpanan sandi e-Court dan keadaan sesi");
console.log("");

// ---------------------------------------------------------------------------
console.log("Penyandian");
// ---------------------------------------------------------------------------

const RAHASIA = "sandi-rahasia-pengadilan-2026";
const tersandi = kredensial.sandikan(RAHASIA);
cek("hasil sandi berbentuk tiga bagian", tersandi.split(".").length, 3);
cek("hasil sandi tidak memuat teks aslinya", tersandi.includes(RAHASIA), false);
cek("dibuka kembali menghasilkan yang sama", kredensial.bukaSandi(tersandi), RAHASIA);

// Dua kali menyandi teks yang sama harus berbeda - IV-nya acak. Bila sama,
// orang yang melihat berkasnya tahu dua akun memakai sandi yang sama.
cek("dua penyandian menghasilkan hasil berbeda", kredensial.sandikan(RAHASIA) === tersandi, false);

// Berkas yang disunting harus DITOLAK, bukan menghasilkan sandi keliru yang
// akan dikirim ke e-Court berkali-kali sampai akunnya terkunci.
const bagian = tersandi.split(".");
const isiRusak = Buffer.from(bagian[2], "base64");
isiRusak[0] = isiRusak[0] ^ 0xff;
const disunting = `${bagian[0]}.${bagian[1]}.${isiRusak.toString("base64")}`;
cek("isi yang disunting ditolak, bukan menghasilkan sandi keliru", kredensial.bukaSandi(disunting), "");
cek("bentuk yang tidak dikenali ditolak", kredensial.bukaSandi("bukan-sandi"), "");
cek("kosong ditolak", kredensial.bukaSandi(""), "");

// ---------------------------------------------------------------------------
console.log("Menyimpan dan membuka");
// ---------------------------------------------------------------------------

// Menulis menuntut slot yang tegas. Slot kosong atau salah ketik TIDAK boleh
// diam-diam jatuh ke slot bawaan - sandi satu akun akan tersimpan ke akun lain.
cek(
  "slot kosong ditolak saat menyimpan",
  kredensial.simpan({ slot: "", email: "a@b.c", sandi: "x" }).ok,
  false
);
cek(
  "slot dengan huruf tidak sah ditolak",
  kredensial.simpan({ slot: "Akun Panitera!", email: "a@b.c", sandi: "x" }).ok,
  false
);
cek("slot kosong ditolak saat menghapus", kredensial.hapus({ slot: "" }).ok, false);
cek("slot sah diterima", kredensial.slotUntukMenulis("akun-2"), "akun-2");
cek("slot tidak sah menghasilkan kosong, bukan slot bawaan", kredensial.slotUntukMenulis("!!"), "");
cek(
  "surel kosong ditolak",
  kredensial.simpan({ slot: "utama", email: "", sandi: "x" }).ok,
  false
);

const disimpan = kredensial.simpan({
  slot: "utama",
  email: "panitera@pa-donggala.go.id",
  sandi: RAHASIA,
  olehSiapa: "uji",
});
cek("tersimpan", disimpan.ok, true);
cek("slot itu siap untuk pengisian otomatis", kredensial.siapOtomatis("utama"), true);

const dibuka = kredensial.ambil("utama");
cek("surel terbaca kembali", dibuka.email, "panitera@pa-donggala.go.id");
cek("sandi terbaca kembali", dibuka.sandi, RAHASIA);

// Menyimpan ulang TANPA sandi hanya mengubah surel - bukan menghapus sandinya.
kredensial.simpan({ slot: "utama", email: "kasir@pa-donggala.go.id", sandi: "" });
const setelahUbahSurel = kredensial.ambil("utama");
cek("surel berubah", setelahUbahSurel.email, "kasir@pa-donggala.go.id");
cek("sandi lama tetap ada", setelahUbahSurel.sandi, RAHASIA);

// ---------------------------------------------------------------------------
console.log("Sandi tidak pernah keluar");
// ---------------------------------------------------------------------------

const daftar = kredensial.daftar();
cek("daftar memuat satu slot", daftar.length, 1);
cek("daftar menyebut ada sandi", daftar[0].adaSandi, true);
cek("daftar TIDAK memuat medan sandi", "sandi" in daftar[0], false);
cek(
  "seluruh isi daftar tidak memuat sandinya, bahkan tersandi",
  JSON.stringify(daftar).includes(RAHASIA),
  false
);
cek("daftar memuat surelnya - surel bukan rahasia", daftar[0].email, "kasir@pa-donggala.go.id");

const keadaanSimpanan = kredensial.keadaan();
cek("keadaan tidak memuat sandi", JSON.stringify(keadaanSimpanan).includes(RAHASIA), false);
cek("keadaan menyebut ada kuncinya", keadaanSimpanan.adaKunci, true);
cek("keadaan menyebut jumlah tersimpan", keadaanSimpanan.jumlahTersimpan, 1);

// Berkas di cakram pun tidak boleh memuat sandi dalam bentuk terbaca.
const isiBerkas = fs.readFileSync(path.join(folderUji, "kredensial.json"), "utf8");
cek("berkas simpanan tidak memuat sandi terbaca", isiBerkas.includes(RAHASIA), false);
cek("berkas simpanan memuat surelnya", isiBerkas.includes("kasir@pa-donggala.go.id"), true);

// ---------------------------------------------------------------------------
console.log("Menghapus");
// ---------------------------------------------------------------------------

cek("hapus berhasil", kredensial.hapus({ slot: "utama" }).ok, true);
cek("sesudah dihapus tidak siap otomatis", kredensial.siapOtomatis("utama"), false);
cek("sesudah dihapus tidak dapat dibuka", kredensial.ambil("utama"), null);
cek("menghapus yang tidak ada bukan galat", kredensial.hapus({ slot: "utama" }).ok, true);
cek("slot yang tidak pernah disimpan menghasilkan null", kredensial.ambil("akun-9"), null);

// Slot yang punya surel tetapi TANPA sandi tidak boleh dipakai otomatis:
// mengetikkan surel lalu menekan tombol tanpa sandi hanya menghasilkan
// percobaan gagal.
kredensial.simpan({ slot: "akun-2", email: "hanya@surel.id", sandi: "sekali" });
kredensial.hapus({ slot: "akun-2" });
cek("slot tanpa simpanan tidak siap otomatis", kredensial.siapOtomatis("akun-2"), false);

// ---------------------------------------------------------------------------
console.log("Keadaan sesi - tiga nilai, bukan dua");
// ---------------------------------------------------------------------------

const s = (mentah, diperiksa) => sesiStatus.susunKeadaan(mentah, { diperiksa }).keadaan;

cek("belum pernah login", s({ tersimpan: false }, true), "belum_pernah");
cek("sudah diperiksa dan berlaku", s({ tersimpan: true, berlaku: true }, true), "berlaku");
cek("sudah diperiksa dan mati", s({ tersimpan: true, berlaku: false }, true), "kedaluwarsa");

// Inilah pokok perbaikannya: folder sesi yang ada TIDAK berarti sesinya hidup.
cek(
  "tersimpan tetapi belum diperiksa BUKAN berlaku",
  s({ tersimpan: true, berlaku: null, alasan: "belum_diperiksa" }, false),
  "belum_pasti"
);
cek(
  "tersimpan tetapi belum diperiksa BUKAN kedaluwarsa",
  s({ tersimpan: true, berlaku: null, alasan: "belum_diperiksa" }, false) === "kedaluwarsa",
  false
);
cek(
  "gerbang bukan kedaluwarsa",
  s({ tersimpan: true, berlaku: null, alasan: "gerbang_menunggu_penegasan" }, true),
  "gerbang"
);
cek(
  "gagal memeriksa bukan kedaluwarsa",
  s({ tersimpan: true, berlaku: null, alasan: "gagal_memeriksa: timeout" }, true),
  "belum_pasti"
);

const labelBelum = sesiStatus.susunKeadaan(
  { tersimpan: true, berlaku: null, alasan: "belum_diperiksa" },
  { diperiksa: false }
).label;
cek("labelnya menyebut belum diperiksa", /belum diperiksa/i.test(labelBelum), true);
cek(
  "labelnya TIDAK berbunyi sesi tersimpan begitu saja",
  labelBelum.trim().toLowerCase() === "sesi tersimpan",
  false
);

const berlaku = sesiStatus.susunKeadaan({ tersimpan: true, berlaku: true }, { diperiksa: true });
cek("hanya keadaan berlaku yang bernilai berlaku true", berlaku.berlaku, true);
for (const mentah of [
  { tersimpan: true, berlaku: null, alasan: "belum_diperiksa" },
  { tersimpan: true, berlaku: null, alasan: "gerbang_menunggu_penegasan" },
  { tersimpan: true, berlaku: false },
  { tersimpan: false },
]) {
  cek(
    `keadaan selain berlaku tidak mengaku berlaku (${mentah.alasan || "tanpa sesi"})`,
    sesiStatus.susunKeadaan(mentah, { diperiksa: true }).berlaku,
    false
  );
}

cek("simpanan punya masa segar", sesiStatus.SEGAR_MS > 0, true);

// ---------------------------------------------------------------------------
console.log("Sandi tidak punya jalan keluar lewat rute");
// ---------------------------------------------------------------------------

const sumberRute = fs.readFileSync(path.join(__dirname, "..", "routes", "internalGatewayRoutes.js"), "utf8");
cek(
  "tidak ada rute yang memanggil pembuka sandi",
  /ecourtKredensialService\.ambil\s*\(/.test(sumberRute),
  false
);
cek(
  "tidak ada rute yang memanggil bukaSandi",
  /ecourtKredensialService\.bukaSandi\s*\(/.test(sumberRute),
  false
);
cek(
  "rute daftar memakai daftar() yang tanpa sandi",
  /kredensial: ecourtKredensialService\.daftar\(\)/.test(sumberRute),
  true
);

// Satu-satunya pemanggil ambil() adalah layanan login.
const sumberLogin = fs.readFileSync(
  path.join(__dirname, "..", "services", "ecourtLoginService.js"),
  "utf8"
);
cek(
  "layanan login memanggil ambil() untuk mengisi formulir",
  /ecourtKredensialService\.ambil\(slot\)/.test(sumberLogin),
  true
);
cek(
  "layanan login tidak mengembalikan sandi pada jawabannya",
  /sandi:\s*tersimpan\.sandi/.test(sumberLogin),
  false
);

// Penarikan berkala tidak boleh ditunggu sampai selesai - itulah yang membuat
// layar pengaturan membeku.
cek(
  "rute jalankan putaran tidak menunggu selesai",
  /await ecourtSchedulerService\.jalankanSatuPutaran\(\)/.test(sumberRute),
  false
);
cek(
  "rute jalankan putaran melepas pekerjaannya",
  /void ecourtSchedulerService\.jalankanSatuPutaran\(\)/.test(sumberRute),
  true
);

// Pemeriksaan sesi tidak lagi menunggu jaringan sepi.
cek(
  "pemeriksaan sesi memakai domcontentloaded",
  /waitUntil: "domcontentloaded"/.test(sumberLogin),
  true
);

if (jumlah < 45) {
  gagal += 1;
  console.log(`  GAGAL: skrip hanya menjalankan ${jumlah} pemeriksaan - ada yang tidak berjalan.`);
}

// Membersihkan folder uji.
try {
  fs.rmSync(folderUji, { recursive: true, force: true });
} catch {
  /* biarkan - folder sementara */
}

console.log("");
if (gagal === 0) {
  console.log(`  OK - ${jumlah} pemeriksaan lulus.`);
  console.log("");
  process.exit(0);
} else {
  console.log(`  ${gagal} dari ${jumlah} pemeriksaan GAGAL.`);
  console.log("");
  process.exit(1);
}
