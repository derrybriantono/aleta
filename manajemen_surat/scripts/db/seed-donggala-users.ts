import { createAletaDatabase, type AletaDatabase, withTransaction } from "../../src/server/db/client";
import { hashSecret } from "../../src/server/shared/security";

type EmployeeInput = {
  nip: string;
  nama: string;
  jabatan: string;
  unitKerja: string;
  tmtJabatan: string;
  golongan: string;
};

type ExistingUserRow = {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  nip: string | null;
  email: string;
  role_id: string;
  position_id: string;
  is_active: number;
  deleted_at: string | null;
};

type AccountRow = {
  id: string;
  password: string | null;
};

type RolePositionMapping = {
  roleId: string;
  positionId: string;
  canBypassHierarchy: boolean;
  notes: string[];
};

const employees: EmployeeInput[] = [
  { nip: "198109142007041001", nama: "ABDUL SALAM, S.HI. MH.", jabatan: "Ketua Pengadilan Tingkat Pertama Klas IB", unitKerja: "Pengadilan Agama Donggala", tmtJabatan: "01 November 2024", golongan: "IV/b" },
  { nip: "197710132007041001", nama: "AKBAR ALI, S.H.I.", jabatan: "Wakil Ketua Tingkat Pertama", unitKerja: "Pengadilan Agama Donggala", tmtJabatan: "31 Mei 2024", golongan: "IV/b" },
  { nip: "197810072007041001", nama: "IDRIS, S.H.I., M.H.", jabatan: "Hakim Tingkat Pertama", unitKerja: "Pengadilan Agama Donggala", tmtJabatan: "29 September 2023", golongan: "IV/b" },
  { nip: "197806052005021002", nama: "HIMAWAN TATURA WIJAYA, S.H.I.,M.H.", jabatan: "Hakim Tingkat Pertama", unitKerja: "Pengadilan Agama Donggala", tmtJabatan: "13 Februari 2023", golongan: "IV/b" },
  { nip: "198609152009042004", nama: "SRI SUSILOWATI, S.H.", jabatan: "Panitera Tingkat Pertama Klas IB", unitKerja: "Panitera", tmtJabatan: "31 Oktober 2024", golongan: "IV/a" },
  { nip: "197312222003121006", nama: "SUDIRMAN B, S.Ag.,M.H.", jabatan: "Sekretaris Tingkat Pertama Klas IB", unitKerja: "Sekretaris", tmtJabatan: "22 Desember 2017", golongan: "IV/a" },
  { nip: "199401022017121003", nama: "DERRY BRIANTONO, S.H.", jabatan: "Hakim Tingkat Pertama", unitKerja: "Pengadilan Agama Donggala", tmtJabatan: "30 Juni 2025", golongan: "III/c" },
  { nip: "198302202009041005", nama: "HARMAN, S.Kom., M.M.", jabatan: "Kepala Subbagian", unitKerja: "Subbagian Umum dan Keuangan", tmtJabatan: "02 Desember 2024", golongan: "IV/a" },
  { nip: "198009262007042001", nama: "NUNIEK WIDRIYANI, S.H.", jabatan: "Panitera Muda Tingkat Pertama Klas IB", unitKerja: "Panitera Muda Hukum", tmtJabatan: "27 November 2025", golongan: "III/d" },
  { nip: "198001172006041002", nama: "MUHAMMAD RIFA`I, S.H.", jabatan: "Kepala Subbagian", unitKerja: "Subbagian Perencanaan, Teknologi Informasi, dan Pelaporan", tmtJabatan: "02 Desember 2024", golongan: "III/d" },
  { nip: "198604242011011015", nama: "LUKMAN HAKIM, S.E., M.Ak.", jabatan: "Kepala Subbagian", unitKerja: "Subbagian Kepegawaian, Organisasi, dan Tata Laksana", tmtJabatan: "23 Januari 2025", golongan: "III/d" },
  { nip: "196803172003122003", nama: "MANNARIA, S.H.I.", jabatan: "Panitera Muda Tingkat Pertama Klas IB", unitKerja: "Panitera Muda Gugatan", tmtJabatan: "31 Oktober 2024", golongan: "III/d" },
  { nip: "198605142009042007", nama: "SRI WAHYUNI, S.H.", jabatan: "Panitera Muda Tingkat Pertama Klas IB", unitKerja: "Panitera Muda Permohonan", tmtJabatan: "31 Oktober 2024", golongan: "III/c" },
  { nip: "197309012003122001", nama: "MUNIFA, S.H.", jabatan: "Panitera Pengganti Tingkat Pertama", unitKerja: "Panitera", tmtJabatan: "17 Maret 2020", golongan: "III/d" },
  { nip: "198604062006042001", nama: "QADARIYAH, S.H.", jabatan: "Panitera Pengganti Tingkat Pertama", unitKerja: "Panitera", tmtJabatan: "02 November 2020", golongan: "III/d" },
  { nip: "198906242011012009", nama: "ANDINI PUSPITA SARI, S.Sy.", jabatan: "Panitera Pengganti Tingkat Pertama", unitKerja: "Panitera", tmtJabatan: "01 Agustus 2022", golongan: "III/d" },
  { nip: "198208072008012014", nama: "ASRAH RACHMAN, S.H.I.", jabatan: "Panitera Pengganti Tingkat Pertama", unitKerja: "Panitera", tmtJabatan: "31 Mei 2024", golongan: "III/d" },
  { nip: "198307102003122001", nama: "UNUN FIDIYASARI PATANGAI, S.H.", jabatan: "Panitera Pengganti Tingkat Pertama", unitKerja: "Panitera", tmtJabatan: "28 Juli 2025", golongan: "III/c" },
  { nip: "198112162006042003", nama: "RESMI, S.E., Ak.", jabatan: "Analis Pengelolaan Keuangan APBN Ahli Muda", unitKerja: "Sekretaris", tmtJabatan: "30 Agustus 2024", golongan: "III/d" },
  { nip: "198003192006041020", nama: "MOHAMMAD SYUKRI, S.H.", jabatan: "Juru Sita", unitKerja: "Panitera", tmtJabatan: "21 Maret 2023", golongan: "III/c" },
  { nip: "197707032005022002", nama: "MUSTINI", jabatan: "Juru Sita", unitKerja: "Panitera", tmtJabatan: "01 Agustus 2022", golongan: "III/b" },
  { nip: "198409012006042002", nama: "TANTY RESTIANTY", jabatan: "Juru Sita", unitKerja: "Panitera", tmtJabatan: "02 Oktober 2023", golongan: "III/b" },
  { nip: "199703052020121006", nama: "HADI MUAMMAR SALEH, S.T.", jabatan: "Pranata Komputer Ahli Pertama", unitKerja: "Subbagian Perencanaan, Teknologi Informasi, dan Pelaporan", tmtJabatan: "29 Agustus 2022", golongan: "III/b" },
  { nip: "199503222022031005", nama: "LUKMAN ABDUL AZIZ, S.E.", jabatan: "Klerek - Penelaah Teknis Kebijakan", unitKerja: "Subbagian Perencanaan, Teknologi Informasi, dan Pelaporan", tmtJabatan: "02 Oktober 2023", golongan: "III/b" },
  { nip: "199510152019031003", nama: "DONI PRASETYO, S.E.", jabatan: "Operator - Penata Layanan Operasional", unitKerja: "Subbagian Kepegawaian, Organisasi, dan Tata Laksana", tmtJabatan: "02 Oktober 2023", golongan: "III/b" },
  { nip: "199809292024051001", nama: "DHANAR REZAWARA, S.H.", jabatan: "Klerek - Analis Perkara Peradilan", unitKerja: "Panitera Muda Hukum", tmtJabatan: "02 Mei 2025", golongan: "III/a" },
  { nip: "200209212025062005", nama: "DIAH ARUM KUSUMAJATI, S.H.", jabatan: "Klerek - Analis Perkara Peradilan", unitKerja: "Panitera Muda Hukum", tmtJabatan: "01 Juni 2025", golongan: "III/a" },
  { nip: "199807212025061007", nama: "YULIAN CANDRA PURWANA, S.T.", jabatan: "Teknisi Sarana dan Prasarana", unitKerja: "Subbagian Umum dan Keuangan", tmtJabatan: "01 Juni 2025", golongan: "III/a" },
  { nip: "200203272024051001", nama: "AZZAM ZAID MUHARAM, S.H.", jabatan: "Klerek - Analis Perkara Peradilan", unitKerja: "Panitera Muda Gugatan", tmtJabatan: "02 Mei 2025", golongan: "III/a" },
  { nip: "200001072025061006", nama: "FABIAN FADHLILLAH RAMADHAN, S.H.", jabatan: "Klerek - Analis Perkara Peradilan", unitKerja: "Panitera Muda Gugatan", tmtJabatan: "01 Juni 2025", golongan: "III/a" },
  { nip: "199907312022032009", nama: "ADHE DWINA AUDIA AGATHA, A.Md.Ak.", jabatan: "Klerek - Pengolah Data dan Informasi", unitKerja: "Subbagian Umum dan Keuangan", tmtJabatan: "02 Oktober 2023", golongan: "II/d" },
  { nip: "199601092022032007", nama: "RAHMA ANGGOROSIWI YANU PAMUNGKAS, A.Md", jabatan: "Klerek - Pengelola Penanganan Perkara", unitKerja: "Panitera Muda Gugatan", tmtJabatan: "02 Oktober 2023", golongan: "II/d" },
  { nip: "199908012022032015", nama: "TIFFANY RACHMAWATI SURANTO, A.Md.M", jabatan: "Klerek - Pengelola Penanganan Perkara", unitKerja: "Panitera Muda Gugatan", tmtJabatan: "02 Oktober 2023", golongan: "II/d" },
  { nip: "199102182025061004", nama: "FERIZKY RUDIATNA, A.Md.", jabatan: "Klerek - Dokumentalis Hukum", unitKerja: "Panitera Muda Hukum", tmtJabatan: "01 Juni 2025", golongan: "II/c" },
  { nip: "198808252025211036", nama: "SAMSUDDIN S, S.E.", jabatan: "Operator - Penata Layanan Operasional", unitKerja: "Subbagian Kepegawaian, Organisasi, dan Tata Laksana", tmtJabatan: "01 September 2025", golongan: "IX" },
  { nip: "198301192025211024", nama: "SALEH, S.Sy.", jabatan: "Operator - Penata Layanan Operasional", unitKerja: "Subbagian Umum dan Keuangan", tmtJabatan: "01 September 2025", golongan: "IX" },
  { nip: "199109182025212048", nama: "ANGGRALARASATI", jabatan: "Pengadministrasi Perkantoran", unitKerja: "Subbagian Umum dan Keuangan", tmtJabatan: "01 September 2025", golongan: "V" },
  { nip: "199901052025211017", nama: "RAHMAT SANDI", jabatan: "Operator Layanan Operasional", unitKerja: "Subbagian Umum dan Keuangan", tmtJabatan: "01 September 2025", golongan: "V" },
  { nip: "198605272025211044", nama: "FIRDAUS", jabatan: "Operator Layanan Operasional", unitKerja: "Subbagian Umum dan Keuangan", tmtJabatan: "01 September 2025", golongan: "V" },
  { nip: "198402192025211028", nama: "HERDIN S", jabatan: "Pengelola Umum Operasional", unitKerja: "Panitera Muda Hukum", tmtJabatan: "01 September 2025", golongan: "I" },
];

const adminUsernames = new Set(["admin", "superadmin", "adminit"]);
const adminRoles = new Set(["admin", "super-admin"]);

function firstNamePassword(name: string) {
  const firstToken = name.trim().split(/\s+/)[0] ?? "";
  const normalized = firstToken
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

  if (!normalized) {
    throw new Error(`Nama tidak valid untuk password awal: ${name}`);
  }

  return `${normalized}123`;
}

function mapRoleAndPosition(employee: EmployeeInput): RolePositionMapping {
  const jabatan = employee.jabatan.toLowerCase();
  const unit = employee.unitKerja.toLowerCase();
  const notes: string[] = [];

  if (jabatan.includes("ketua pengadilan")) {
    return { roleId: "ketua", positionId: "pos-ketua", canBypassHierarchy: true, notes };
  }

  if (jabatan.includes("wakil ketua")) {
    return { roleId: "wakil-ketua", positionId: "pos-wakil", canBypassHierarchy: true, notes };
  }

  if (jabatan.includes("hakim")) {
    return { roleId: "hakim", positionId: "pos-hakim", canBypassHierarchy: false, notes };
  }

  if (jabatan.includes("panitera tingkat")) {
    return { roleId: "panitera", positionId: "pos-panitera", canBypassHierarchy: false, notes };
  }

  if (jabatan.includes("sekretaris")) {
    return { roleId: "sekretaris", positionId: "pos-sekretaris", canBypassHierarchy: false, notes };
  }

  if (jabatan.includes("kepala subbagian")) {
    if (unit.includes("kepegawaian")) {
      return { roleId: "pejabat-struktural", positionId: "pos-kasubag-kepegawaian", canBypassHierarchy: false, notes };
    }
    if (unit.includes("perencanaan") || unit.includes("teknologi informasi")) {
      notes.push("Tidak ada posisi Kasubag PTIP khusus; memakai posisi Pranata Komputer sebagai posisi terdekat.");
      return { roleId: "pejabat-struktural", positionId: "pos-pranata-komputer", canBypassHierarchy: false, notes };
    }
    return { roleId: "pejabat-struktural", positionId: "pos-kasubag-umum", canBypassHierarchy: false, notes };
  }

  if (jabatan.includes("panitera muda")) {
    if (unit.includes("gugatan")) {
      return { roleId: "pejabat-struktural", positionId: "pos-panitera-muda-gugatan", canBypassHierarchy: false, notes };
    }
    if (unit.includes("permohonan")) {
      return { roleId: "pejabat-struktural", positionId: "pos-panitera-muda-permohonan", canBypassHierarchy: false, notes };
    }
    return { roleId: "pejabat-struktural", positionId: "pos-panitera-muda-hukum", canBypassHierarchy: false, notes };
  }

  if (jabatan.includes("panitera pengganti")) {
    notes.push("Role panitera_pengganti belum tersedia; memakai role panitera dengan posisi Panitera Pengganti.");
    return { roleId: "panitera", positionId: "pos-panitera-pengganti", canBypassHierarchy: false, notes };
  }

  if (jabatan.includes("juru sita")) {
    notes.push("Role jurusita belum tersedia; memakai role staf dengan posisi Jurusita.");
    return { roleId: "staf", positionId: "pos-jurusita", canBypassHierarchy: false, notes };
  }

  if (jabatan.includes("pranata komputer")) {
    return { roleId: "staf", positionId: "pos-pranata-komputer", canBypassHierarchy: false, notes };
  }

  if (jabatan.includes("keuangan")) {
    return { roleId: "staf", positionId: "pos-analis-keuangan", canBypassHierarchy: false, notes };
  }

  if (unit.includes("kepegawaian")) {
    return { roleId: "staf", positionId: "pos-staf-kepegawaian", canBypassHierarchy: false, notes };
  }

  if (unit.includes("hukum") || unit.includes("gugatan") || unit.includes("permohonan") || jabatan.includes("perkara")) {
    return { roleId: "staf", positionId: "pos-analis-perkara", canBypassHierarchy: false, notes };
  }

  if (jabatan.includes("pengadministrasi")) {
    return { roleId: "staf", positionId: "pos-pengadministrasi-umum", canBypassHierarchy: false, notes };
  }

  return { roleId: "staf", positionId: "pos-staf-umum", canBypassHierarchy: false, notes };
}

async function fetchColumnValues(db: AletaDatabase, tableName: string) {
  const rows = await db.prepare(`SELECT id FROM ${tableName}`).all<{ id: string }>();
  return new Set(rows.map((row) => row.id));
}

async function upsertCredentialAccount(
  db: AletaDatabase,
  {
    userId,
    email,
    passwordHash,
  }: {
    userId: string;
    email: string;
    passwordHash?: string | null;
  }
) {
  const now = new Date().toISOString();
  const existing = await db.prepare(
    `SELECT id, password
     FROM accounts
     WHERE user_id = ? AND provider_id = 'credential'
     LIMIT 1`
  ).get<AccountRow>(userId);

  if (existing) {
    await db.prepare(
      `UPDATE accounts
       SET account_id = ?, password = ?, updated_at = ?
       WHERE id = ?`
    ).run(email, passwordHash ?? existing.password ?? null, now, existing.id);
    return;
  }

  await db.prepare(
    `INSERT INTO accounts (
      id, account_id, provider_id, user_id, access_token, refresh_token, id_token,
      access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `acc-${userId}`,
    email,
    "credential",
    userId,
    null,
    null,
    null,
    null,
    null,
    "email password",
    passwordHash ?? null,
    now,
    now
  );
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const resetExistingPasswords = process.argv.includes("--reset-existing-passwords");
  const db = await createAletaDatabase({ seed: true });

  try {
    if (employees.length !== 40) {
      throw new Error(`Data pegawai harus 40 baris, ditemukan ${employees.length}.`);
    }

    const result = await withTransaction(db, async (tx) => {
      const now = new Date().toISOString();
      const targetNips = new Set(employees.map((employee) => employee.nip));
      const roleIds = await fetchColumnValues(tx, "roles");
      const positionIds = await fetchColumnValues(tx, "positions");
      const mappingNotes: string[] = [];

      const staleUsers = await tx.prepare(
        `SELECT id, username, name, role_id
         FROM users
         WHERE deleted_at IS NULL
           AND is_active = 1
           AND username NOT IN (${Array.from(targetNips).map(() => "?").join(",")})
           AND COALESCE(nip, '') NOT IN (${Array.from(targetNips).map(() => "?").join(",")})
           AND LOWER(username) NOT IN ('admin', 'superadmin', 'adminit')
           AND role_id NOT IN ('admin', 'super-admin')`
      ).all<{ id: string; username: string; name: string; role_id: string }>(...targetNips, ...targetNips);

      if (!dryRun && staleUsers.length > 0) {
        await tx.prepare(
          `UPDATE users
           SET is_active = 0, deleted_at = ?, updated_at = ?
           WHERE deleted_at IS NULL
             AND is_active = 1
             AND username NOT IN (${Array.from(targetNips).map(() => "?").join(",")})
             AND COALESCE(nip, '') NOT IN (${Array.from(targetNips).map(() => "?").join(",")})
             AND LOWER(username) NOT IN ('admin', 'superadmin', 'adminit')
             AND role_id NOT IN ('admin', 'super-admin')`
        ).run(now, now, ...targetNips, ...targetNips);
      }

      let created = 0;
      let updated = 0;
      let reactivated = 0;
      let credentialAccountsTouched = 0;

      for (const employee of employees) {
        const mapped = mapRoleAndPosition(employee);
        let roleId = mapped.roleId;
        let positionId = mapped.positionId;

        if (!roleIds.has(roleId)) {
          mappingNotes.push(`${employee.nip} ${employee.nama}: role ${roleId} tidak ada, fallback ke staf.`);
          roleId = "staf";
        }

        if (!positionIds.has(positionId)) {
          mappingNotes.push(`${employee.nip} ${employee.nama}: posisi ${positionId} tidak ada, fallback ke pos-staf-umum.`);
          positionId = "pos-staf-umum";
        }

        for (const note of mapped.notes) {
          mappingNotes.push(`${employee.nip} ${employee.nama}: ${note}`);
        }

        const existing = await tx.prepare(
          `SELECT id, username, password_hash, name, nip, email, role_id, position_id, is_active, deleted_at
           FROM users
           WHERE username = ? OR nip = ?
           ORDER BY CASE WHEN username = ? THEN 0 ELSE 1 END
           LIMIT 1`
        ).get<ExistingUserRow>(employee.nip, employee.nip, employee.nip);

        const email = `${employee.nip}@pa-donggala.local`;
        const passwordHash = hashSecret(firstNamePassword(employee.nama));
        const canBypass = mapped.canBypassHierarchy ? 1 : 0;

        if (existing) {
          if (!dryRun) {
            const nextPasswordHash = resetExistingPasswords ? passwordHash : existing.password_hash;
            await tx.prepare(
              `UPDATE users
               SET username = ?, password_hash = ?, name = ?, nip = ?, email = ?, email_verified = TRUE,
                   whatsapp_number = ?, role_id = ?, position_id = ?, is_active = 1,
                   can_bypass_hierarchy = ?, deleted_at = NULL, updated_at = ?
               WHERE id = ?`
            ).run(
              employee.nip,
              nextPasswordHash,
              employee.nama,
              employee.nip,
              email,
              "",
              roleId,
              positionId,
              canBypass,
              now,
              existing.id
            );
            await upsertCredentialAccount(tx, {
              userId: existing.id,
              email,
              passwordHash: resetExistingPasswords ? passwordHash : null,
            });
            credentialAccountsTouched += 1;
          }
          updated += 1;
          if (!existing.is_active || existing.deleted_at) reactivated += 1;
          continue;
        }

        const userId = `usr-donggala-${employee.nip}`;
        if (!dryRun) {
          await tx.prepare(
            `INSERT INTO users (
              id, username, password_hash, name, nip, email, email_verified, whatsapp_number, profile_photo_url,
              role_id, position_id, is_active, can_bypass_hierarchy, deleted_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, ?, ?, ?, 1, ?, NULL, ?, ?)`
          ).run(
            userId,
            employee.nip,
            passwordHash,
            employee.nama,
            employee.nip,
            email,
            "",
            null,
            roleId,
            positionId,
            canBypass,
            now,
            now
          );

          await upsertCredentialAccount(tx, {
            userId,
            email,
            passwordHash,
          });
          credentialAccountsTouched += 1;
        }
        created += 1;
      }

      const preservedAdmins = await tx.prepare(
        `SELECT username, role_id
         FROM users
         WHERE deleted_at IS NULL
           AND (LOWER(username) IN ('admin', 'superadmin', 'adminit') OR role_id IN ('admin', 'super-admin'))
         ORDER BY role_id, username`
      ).all<{ username: string; role_id: string }>();

      const activeDonggalaUsers = await tx.prepare(
        `SELECT COUNT(*)::int AS count
         FROM users
         WHERE deleted_at IS NULL
           AND is_active = 1
           AND username IN (${Array.from(targetNips).map(() => "?").join(",")})`
      ).get<{ count: number }>(...targetNips);

      return {
        dryRun,
        resetExistingPasswords,
        targetCount: employees.length,
        staleUsers: staleUsers.length,
        created,
        updated,
        reactivated,
        credentialAccountsTouched,
        activeDonggalaUsers: activeDonggalaUsers?.count ?? 0,
        preservedAdmins,
        mappingNotes: Array.from(new Set(mappingNotes)),
      };
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error("[ALETA] Seed pegawai Donggala gagal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
