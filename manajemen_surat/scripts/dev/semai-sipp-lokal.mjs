/**
 * Menyamakan basis data LOKAL dengan bentuk yang dipakai server, untuk
 * mengerjakan tampilan selagi server kantor mati.
 *
 * =============================================================================
 * DATANYA CONTOH
 * =============================================================================
 *
 * Berkas ini menambah pengguna, kredensial SIPP, dan satu catatan cuti supaya
 * rantai penetap PMH - Ketua, Wakil, PLH - dapat dilihat bekerja di layar.
 * Nilainya DIKARANG. Jangan menyimpulkan keadaan kepegawaian sungguhan darinya.
 *
 * Dua hal yang sengaja TIDAK sungguhan:
 *
 *   - password_hash pengguna baru diisi nilai mati. Mereka ada supaya bentuk
 *     datanya lengkap, BUKAN supaya dapat dipakai masuk. Sandi sungguhan tidak
 *     pernah ditulis berkas ini.
 *
 *   - encrypted_password kredensial SIPP diisi penanda yang memang tidak dapat
 *     dibaca. Yang menentukan tampilan kesiapan hanyalah is_enabled dan
 *     last_verified_status; nilai sandinya tidak pernah dibaca untuk itu. Bila
 *     ada halaman yang benar-benar mencoba memakainya, ia akan berkata "sandi
 *     tidak dapat dibaca" - dan itu jawaban yang jujur.
 *
 * Aman dijalankan berulang: yang sudah ada dilewati.
 *
 *   node scripts/dev/semai-sipp-lokal.mjs
 */

import pg from "pg";

const ALAMAT = process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54329/aleta";
const SEKARANG = new Date().toISOString();

// Nilai mati - bukan sandi apa pun, dan tidak akan pernah cocok.
const SANDI_MATI = "TIDAK-DIPAKAI-DATA-CONTOH-LOKAL";

const PENGGUNA = [
  {
    id: "usr-5ffbc694-2377-4f95-a09e-031cbd4aa557",
    nama: "FAHRI SAIFUDDIN, S.H.I., M.H.",
    nip: "197901012005021001",
    peran: "ketua",
    jabatan: "pos-ketua",
  },
  {
    id: "usr-a81b2690-9e0d-40a2-9b8d-f6da8687a428",
    nama: "SUDARMIN H.I.M. TANG, S.H.I.,M.H",
    nip: "198002022006041002",
    peran: "wakil-ketua",
    jabatan: "pos-wakil",
  },
];

// Akun SIPP -> pemilik ALETA. Cocok dengan yang dijawab jembatan tiruan.
const KREDENSIAL = [
  ["fahri", "usr-5ffbc694-2377-4f95-a09e-031cbd4aa557"],
  ["sudarmin", "usr-a81b2690-9e0d-40a2-9b8d-f6da8687a428"],
  ["Himawan", "usr-donggala-197806052005021002"],
  ["Idris", "usr-donggala-197810072007041001"],
  ["derry briantono", "usr-donggala-199401022017121003"],
  ["Sri Susilowati", "usr-donggala-198609152009042004"],
];

async function main() {
  const c = new pg.Client({ connectionString: ALAMAT });
  await c.connect();
  const lapor = [];

  // --- 1. Pengguna pimpinan --------------------------------------------------
  for (const p of PENGGUNA) {
    const ada = await c.query("select 1 from users where id=$1", [p.id]);
    if (ada.rowCount) {
      lapor.push(`pengguna ${p.nama.split(",")[0]}: sudah ada`);
      continue;
    }
    await c.query(
      `insert into users (id, username, password_hash, name, nip, email, whatsapp_number,
                          role_id, position_id, is_active, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,'',$7,$8,1,$9,$9)`,
      [p.id, p.nip, SANDI_MATI, p.nama, p.nip, `${p.nip}@pa-donggala.local`, p.peran, p.jabatan, SEKARANG]
    );
    lapor.push(`pengguna ${p.nama.split(",")[0]}: DITAMBAHKAN`);
  }

  // --- 2. Profil kepegawaian (jembatan ke catatan cuti) ----------------------
  for (const p of PENGGUNA) {
    const ada = await c.query("select id from employee_profiles where user_id=$1", [p.id]);
    if (ada.rowCount) {
      lapor.push(`profil ${p.nama.split(",")[0]}: sudah ada`);
      continue;
    }
    await c.query(
      "insert into employee_profiles (id, user_id, full_name, created_at, updated_at) values ($1,$2,$3,$4,$4)",
      [`emp-lokal-${p.peran}`, p.id, p.nama, SEKARANG]
    );
    lapor.push(`profil ${p.nama.split(",")[0]}: DITAMBAHKAN`);
  }

  // --- 3. Kredensial SIPP ----------------------------------------------------
  //
  // Ditandai "verified" supaya halaman kesiapan menampilkan keadaan siap - itu
  // yang perlu terlihat saat mengerjakan tampilan. Nilai sandinya mati.
  let dibuat = 0;
  for (const [username, userId] of KREDENSIAL) {
    const ada = await c.query("select 1 from external_app_credentials where app_id='sipp' and lower(external_username)=lower($1)", [username]);
    if (ada.rowCount) continue;
    await c.query(
      `insert into external_app_credentials
         (id, user_id, app_id, external_username, encrypted_password, password_md5_hash,
          is_enabled, last_verified_at, last_verified_status, created_at, updated_at)
       values ($1,$2,'sipp',$3,$4,$4,1,$5,'verified',$5,$5)`,
      [`eac-lokal-${username.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`, userId, username, SANDI_MATI, SEKARANG]
    );
    dibuat += 1;
  }
  lapor.push(`kredensial SIPP: ${dibuat} ditambahkan, ${KREDENSIAL.length - dibuat} sudah ada`);

  // --- 4. Cuti Ketua, supaya rantai Ketua->Wakil terlihat bekerja ------------
  const adaCuti = await c.query("select 1 from hr_leave_requests where id='hlr-lokal-cuti-ketua'");
  if (adaCuti.rowCount) {
    lapor.push("cuti Ketua: sudah ada");
  } else {
    const profil = await c.query("select id from employee_profiles where user_id=$1", [PENGGUNA[0].id]);
    const jenis = await c.query("select id from hr_leave_types limit 1");
    if (profil.rowCount && jenis.rowCount) {
      await c.query(
        `insert into hr_leave_requests
           (id, employee_id, leave_type_id, request_number, start_date, end_date, total_days,
            calculation_type, reason, address_during_leave, contact_during_leave,
            status, current_approval_level, submitted_at, approved_at, created_by, updated_by, created_at, updated_at)
         values ('hlr-lokal-cuti-ketua',$1,$2,'CONTOH/LOKAL/001','2026-09-01','2026-09-12',9,
                 'working_days','Data contoh lokal - Ketua Pengadilan sedang cuti','','',
                 'approved',0,$3,$3,'usr-super','usr-super',$3,$3)`,
        [profil.rows[0].id, jenis.rows[0].id, SEKARANG]
      );
      lapor.push("cuti Ketua 1-12 Sep: DITAMBAHKAN");
    } else {
      lapor.push("cuti Ketua: dilewati (profil atau jenis cuti tidak ada)");
    }
  }

  for (const baris of lapor) console.log("  " + baris);
  await c.end();
}

main().catch((galat) => {
  console.error("GAGAL:", galat.message);
  process.exit(1);
});
