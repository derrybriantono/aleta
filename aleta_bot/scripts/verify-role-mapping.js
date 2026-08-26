#!/usr/bin/env node
// =============================================================================
// Verifikasi pencocokan role penerima notifikasi, tanpa database.
//
//   node scripts/verify-role-mapping.js
//
// Ketua dan Wakil Ketua Pengadilan adalah HAKIM juga: mereka memegang perkara
// dan bersidang. Aplikasi lama menyatakan ini dengan mendaftarkan nomor yang
// SAMA di hakimIds sekaligus ketuaId (aleta_bot/whatsapp.js):
//   hakimIds: { "Abdul Salam": "6281245893055@c.us", "Ali": "6281342081382@c.us" }
//   ketuaId:  { "Abdul Salam": "6281245893055@c.us", "Akbar Ali": "6281342081382@c.us" }
//
// Di ALETA satu user hanya punya SATU role utama, jadi keterkaitan itu
// dinyatakan lewat IMPLICIT_ROLE_IDS. Skrip ini menjaga agar:
//   1. Ketua & Wakil Ketua IKUT menerima notifikasi hakim (jadwal sidang), dan
//   2. Hakim biasa TIDAK ikut menerima notifikasi khusus ketua.
// =============================================================================
const scheduler = require("../services/dynamicNotificationSchedulerService");

const { recipientMatchesHints } = scheduler;

let gagal = 0;
function periksa(label, aktual, harapan) {
  const ok = aktual === harapan;
  if (!ok) gagal += 1;
  console.log(`  ${ok ? "OK   " : "GAGAL"}  ${label.padEnd(50)} -> ${aktual}${ok ? "" : ` (harap ${harapan})`}`);
}

// Data meniru akun nyata di Manajemen Akun.
const ketua = { id: "u1", roleId: "ketua", name: "ABDUL SALAM, S.HI. MH.", additionalRoleIds: [] };
const wakilKetua = { id: "u2", roleId: "wakil-ketua", name: "AKBAR ALI, S.H.I.", additionalRoleIds: [] };
const hakim = { id: "u3", roleId: "hakim", name: "DERRY BRIANTONO, S.H.", additionalRoleIds: [] };
const panitera = { id: "u4", roleId: "panitera", name: "SRI SUSILOWATI", additionalRoleIds: [] };
const jurusita = { id: "u5", roleId: "jurusita", name: "FAHRI SAIFUDDIN", additionalRoleIds: [] };

const cocok = (recipient, roleHints) => recipientMatchesHints(recipient, { roleHints });

console.log("Role melekat:", JSON.stringify(scheduler.IMPLICIT_ROLE_IDS));

console.log("\n1. Notifikasi HAKIM (roleHints: [hakim]) — jadwal sidang");
periksa("Ketua IKUT menerima", cocok(ketua, ["hakim"]), true);
periksa("Wakil Ketua IKUT menerima", cocok(wakilKetua, ["hakim"]), true);
periksa("Hakim menerima", cocok(hakim, ["hakim"]), true);
periksa("Panitera TIDAK menerima", cocok(panitera, ["hakim"]), false);
periksa("Jurusita TIDAK menerima", cocok(jurusita, ["hakim"]), false);

console.log("\n2. Notifikasi KETUA (roleHints: [ketua]) — kewenangan pimpinan");
periksa("Ketua menerima", cocok(ketua, ["ketua"]), true);
periksa("Hakim TIDAK menerima", cocok(hakim, ["ketua"]), false);
periksa("Panitera TIDAK menerima", cocok(panitera, ["ketua"]), false);

console.log("\n3. Notifikasi peran lain tidak ikut melebar");
periksa("Ketua TIDAK menerima notifikasi panitera", cocok(ketua, ["panitera"]), false);
periksa("Ketua TIDAK menerima notifikasi jurusita", cocok(ketua, ["jurusita"]), false);
periksa("Panitera menerima notifikasi panitera", cocok(panitera, ["panitera"]), true);
periksa("Jurusita menerima notifikasi jurusita", cocok(jurusita, ["jurusita"]), true);

console.log("\n4. Role tambahan (additionalRoleIds) tetap dihormati");
const paniteraJugaJurusita = {
  id: "u6",
  roleId: "panitera",
  name: "PEGAWAI RANGKAP",
  additionalRoleIds: ["jurusita"],
};
periksa("Rangkap jabatan menerima notifikasi jurusita", cocok(paniteraJugaJurusita, ["jurusita"]), true);

console.log(gagal === 0 ? "\nSEMUA PERIKSAAN LULUS" : `\n${gagal} PERIKSAAN GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
