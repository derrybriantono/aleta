import { getDefaultRoleForPosition, isPrivilegedAdmin } from "@/lib/permissions";
import { type RoleId, type UserPersona } from "@/lib/types";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";
import { getPositionByIdFromDb, getUserByIdFromDb, getUsersFromDb, requireActorUser } from "@/server/modules/organization/service";
import { hashSecret } from "@/server/shared/security";

type ManagedUserPayload = {
  username: string;
  password?: string;
  email: string;
  whatsappNumber: string;
  name: string;
  nip: string;
  positionId: string;
  isActive?: boolean;
  profilePhotoUrl?: string;
};

type UserLookupResult = {
  id: string;
  username: string;
  name: string;
  email: string;
  roleId: RoleId;
  positionId: string;
  isActive: boolean;
};

type PasswordRecoveryDraft = {
  userId: string;
  username: string;
  name: string;
  maskedWhatsapp: string;
  whatsappNumber: string;
  otp: string;
  expiresAt: string;
};

export type AdminResetRequest = {
  id: string;
  userId: string;
  username: string;
  name: string;
  nip: string;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  resolvedByUserId: string | null;
  createdAt: string;
  expiresAt: string;
};

function normalizeRequired(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new ApiError(400, `${label} wajib diisi.`);
  }

  return normalized;
}

function normalizeOptional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizePhoneForLookup(value: string | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function maskWhatsappNumber(value: string) {
  if (value.length <= 6) return value;
  return `${value.slice(0, 4)}xxxx${value.slice(-3)}`;
}

function validatePasswordStrength(password: string): void {
  if (password.length < 8) {
    throw new ApiError(400, "Password baru minimal 8 karakter.");
  }
  if (!/[a-zA-Z]/.test(password)) {
    throw new ApiError(400, "Password baru harus mengandung minimal satu huruf.");
  }
  if (!/[0-9]/.test(password)) {
    throw new ApiError(400, "Password baru harus mengandung minimal satu angka.");
  }
}

function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)] ?? set[0];

  const chars = [
    pick(upper),
    pick(upper),
    pick(lower),
    pick(lower),
    pick(digits),
    pick(digits),
    pick(digits),
    pick(digits),
  ];

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j] ?? chars[i]!, chars[i]!];
  }

  return chars.join("");
}

function mapUserForApi(user: UserPersona, password = "") {
  return {
    id: user.id,
    username: user.username,
    password,
    name: user.name,
    nip: user.nip,
    email: user.email,
    whatsappNumber: user.whatsappNumber,
    profilePhotoUrl: user.profilePhotoUrl,
    roleId: user.roleId,
    positionId: user.positionId,
    isActive: user.isActive,
    canBypassHierarchy: user.canBypassHierarchy ?? false,
    actingAssignment: user.actingAssignment ?? null,
  };
}

function mapUserForViewer(viewer: UserPersona, user: UserPersona, password = "") {
  if (viewer.roleId === "super-admin" || viewer.roleId === "admin" || viewer.id === user.id) {
    return mapUserForApi(user, password);
  }

  return {
    ...mapUserForApi(user, password),
    email: "",
    whatsappNumber: "",
    nip: "",
  };
}

async function ensureAdminActor(db: AletaDatabase, actorUserId: string) {
  const actor = await requireActorUser(db, actorUserId);

  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Aksi ini hanya dapat dijalankan oleh Admin atau Super Admin.");
  }

  return actor;
}

function canActorViewManagedUser(actor: UserPersona, user: UserPersona) {
  if (actor.roleId === "super-admin") {
    return true;
  }

  if (actor.roleId === "admin") {
    return user.roleId !== "super-admin";
  }

  return actor.id === user.id;
}

function canActorManageManagedUser(actor: UserPersona, user: UserPersona) {
  if (actor.id === user.id) {
    return true;
  }

  if (actor.roleId === "super-admin") {
    return true;
  }

  if (actor.roleId === "admin") {
    return user.roleId !== "super-admin";
  }

  return false;
}

async function ensureUniqueManagedUserFields(
  db: AletaDatabase,
  payload: {
    username: string;
    email: string;
  },
  excludedUserId?: string
) {
  const duplicateRows = await db.prepare(
    `SELECT id, username, email
     FROM users
     WHERE deleted_at IS NULL
       AND id <> COALESCE(?, '')
       AND (
         LOWER(username) = LOWER(?)
         OR LOWER(email) = LOWER(?)
       )
     LIMIT 10`
  ).all<{ id: string; username: string; email: string }>(
    excludedUserId ?? null,
    payload.username,
    payload.email
  );

  const usernameDuplicate = duplicateRows.find(
    (row) => row.username.toLowerCase() === payload.username.toLowerCase()
  );
  if (usernameDuplicate) {
    throw new ApiError(409, "Username sudah digunakan. Pilih username lain.");
  }

  const emailDuplicate = duplicateRows.find(
    (row) => row.email.toLowerCase() === payload.email.toLowerCase()
  );
  if (emailDuplicate) {
    throw new ApiError(409, "Email sudah digunakan oleh akun lain.");
  }
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
    passwordHash: string | null;
  }
) {
  const existing = await db.prepare(
    `SELECT id, password
     FROM accounts
     WHERE user_id = ? AND provider_id = 'credential'
     LIMIT 1`
  ).get<{ id: string; password: string | null }>(userId);

  const now = new Date().toISOString();

  if (!existing) {
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
      passwordHash,
      now,
      now
    );
    return;
  }

  await db.prepare(
    `UPDATE accounts
     SET account_id = ?, password = ?, updated_at = ?
     WHERE id = ?`
  ).run(email, passwordHash ?? existing.password ?? null, now, existing.id);
}

async function findUserForIdentifier(db: AletaDatabase, identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  if (!normalizedIdentifier) {
    return null;
  }

  const digitsOnly = normalizePhoneForLookup(identifier);
  const users = await getUsersFromDb(db);
  const exactUser = users.find((item) => {
    if (!item.isActive) return false;

    const usernameMatch = item.username.toLowerCase() === normalizedIdentifier;
    const emailMatch = item.email.toLowerCase() === normalizedIdentifier;
    const nipMatch = item.nip.trim() === identifier.trim();
    const fullNameMatch = item.name.toLowerCase() === normalizedIdentifier;
    const phoneMatch = digitsOnly.length >= 8 && normalizePhoneForLookup(item.whatsappNumber) === digitsOnly;

    return usernameMatch || emailMatch || nipMatch || phoneMatch || fullNameMatch;
  });

  if (!exactUser) return null;

  const result: UserLookupResult = {
    id: exactUser.id,
    username: exactUser.username,
    name: exactUser.name,
    email: exactUser.email,
    roleId: exactUser.roleId,
    positionId: exactUser.positionId,
    isActive: exactUser.isActive,
  };

  return result;
}

async function findUserByNip(db: AletaDatabase, nip: string) {
  const normalizedNip = nip.trim();
  if (!normalizedNip) {
    return null;
  }

  return (await getUsersFromDb(db)).find((item) => item.isActive && item.nip === normalizedNip) ?? null;
}

// Lookup active user by any recognized identifier (username, NIP, email, phone, name).
// Full-name matches are rejected if ambiguous (>1 user with the same name).
async function findUserForRecovery(db: AletaDatabase, identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return null;

  const digitsOnly = normalizePhoneForLookup(identifier);
  const activeUsers = (await getUsersFromDb(db)).filter((u) => u.isActive);

  const uniqueMatches = activeUsers.filter((u) => {
    const usernameMatch = u.username.toLowerCase() === normalized;
    const emailMatch = u.email.toLowerCase() === normalized;
    const nipMatch = u.nip.trim() === identifier.trim();
    const phoneMatch = digitsOnly.length >= 8 && normalizePhoneForLookup(u.whatsappNumber) === digitsOnly;
    return usernameMatch || emailMatch || nipMatch || phoneMatch;
  });

  if (uniqueMatches.length === 1) return uniqueMatches[0];
  if (uniqueMatches.length > 1) {
    throw new ApiError(400, "Identitas terlalu umum. Gunakan NIP, username, email, atau nomor WhatsApp.");
  }

  const nameMatches = activeUsers.filter((u) => u.name.toLowerCase() === normalized);
  if (nameMatches.length === 0) return null;
  if (nameMatches.length === 1) return nameMatches[0];
  throw new ApiError(400, "Identitas terlalu umum. Gunakan NIP, username, email, atau nomor WhatsApp.");
}

// Verify identifier without generating OTP. Used when WhatsApp is not ready.
async function verifyRecoveryIdentityInDb(db: AletaDatabase, { identifier }: { identifier: string }) {
  const user = await findUserForRecovery(db, identifier);

  if (!user) {
    throw new ApiError(400, "Data akun tidak ditemukan atau tidak dapat diproses.");
  }

  return {
    userId: user.id,
    name: user.name,
    maskedWhatsapp: maskWhatsappNumber(user.whatsappNumber),
  };
}

export async function listUsersFromDb(db: AletaDatabase, actorUserId: string) {
  const actor = await requireActorUser(db, actorUserId);
  const items = await getUsersFromDb(db);

  const visibleUsers =
    actor.roleId === "super-admin"
      ? items
      : actor.roleId === "admin"
        ? items.filter((user) => user.roleId !== "super-admin")
        : items.filter((user) => user.isActive && user.roleId !== "super-admin");

  return visibleUsers.map((user) => mapUserForViewer(actor, user));
}

export async function getUserForApiById(db: AletaDatabase, actorUserId: string, userId: string) {
  const actor = await requireActorUser(db, actorUserId);
  const user = await getUserByIdFromDb(db, userId);

  if (!user || !canActorViewManagedUser(actor, user)) {
    return null;
  }

  return mapUserForApi(user);
}

export async function lookupUserForLoginInDb(
  db: AletaDatabase,
  {
    identifier,
    username,
    nip,
  }: {
    identifier?: string;
    username?: string;
    nip?: string;
  }
) {
  if (identifier?.trim()) {
    return findUserForIdentifier(db, identifier);
  }

  if (username?.trim()) {
    return findUserForIdentifier(db, username);
  }

  const userByNip = nip?.trim() ? await findUserByNip(db, nip) : null;
  if (!userByNip) return null;

  const result: UserLookupResult = {
    id: userByNip.id,
    username: userByNip.username,
    name: userByNip.name,
    email: userByNip.email,
    roleId: userByNip.roleId,
    positionId: userByNip.positionId,
    isActive: userByNip.isActive,
  };

  return result;
}

export async function createManagedUserInDb(
  db: AletaDatabase,
  actorUserId: string,
  payload: ManagedUserPayload
) {
  const actor = await ensureAdminActor(db, actorUserId);
  const username = normalizeRequired(payload.username, "Username");
  const password = normalizeRequired(payload.password, "Password");
  const email = normalizeRequired(payload.email, "Email");
  const whatsappNumber = normalizeRequired(payload.whatsappNumber, "Nomor WhatsApp");
  const name = normalizeRequired(payload.name, "Nama lengkap");
  const nip = normalizeRequired(payload.nip, "NIP");
  const positionId = normalizeRequired(payload.positionId, "Jabatan");
  const isActive = payload.isActive ?? true;
  const profilePhotoUrl = normalizeOptional(payload.profilePhotoUrl);

  if (!(await getPositionByIdFromDb(db, positionId))) {
    throw new ApiError(400, "Jabatan target tidak ditemukan.");
  }

  await ensureUniqueManagedUserFields(db, { username, email });

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();
    const userId = await nextPrefixedId(tx, "users", "usr");
    const roleId = getDefaultRoleForPosition(positionId);
    const passwordHash = hashSecret(password);

    await tx.prepare(
      `INSERT INTO users (
        id, username, password_hash, name, nip, email, email_verified, whatsapp_number, profile_photo_url,
        role_id, position_id, is_active, can_bypass_hierarchy, deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      username,
      passwordHash,
      name,
      nip,
      email,
      true,
      whatsappNumber,
      profilePhotoUrl,
      roleId,
      positionId,
      isActive ? 1 : 0,
      roleId === "ketua" || roleId === "wakil-ketua" ? 1 : 0,
      null,
      now,
      now
    );

    await upsertCredentialAccount(tx, {
      userId,
      email,
      passwordHash,
    });

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "CREATE_USER",
      entityType: "user",
      entityId: userId,
      payload: {
        username,
        email,
        roleId,
        positionId,
        isActive,
      },
    });

    const user = await getUserByIdFromDb(tx, userId);
    if (!user) {
      throw new ApiError(500, "Akun baru gagal dimuat ulang dari database.");
    }

    return mapUserForApi(user, password);
  });
}

export async function updateManagedUserInDb(
  db: AletaDatabase,
  {
    actorUserId,
    userId,
    payload,
  }: {
    actorUserId: string;
    userId: string;
    payload: Partial<ManagedUserPayload>;
  }
) {
  const actor = await requireActorUser(db, actorUserId);
  const currentUser = await getUserByIdFromDb(db, userId);

  if (!currentUser) {
    throw new ApiError(404, "Akun yang akan diperbarui tidak ditemukan.");
  }

  const isSelfUpdate = actor.id === userId;
  const canManageOthers = isPrivilegedAdmin(actor);

  if (!canActorManageManagedUser(actor, currentUser) || (!isSelfUpdate && !canManageOthers)) {
    throw new ApiError(403, "Anda tidak memiliki hak untuk memperbarui akun ini.");
  }

  const nextUsername = canManageOthers && payload.username !== undefined
    ? normalizeRequired(payload.username, "Username")
    : currentUser.username;
  const nextName = canManageOthers && payload.name !== undefined
    ? normalizeRequired(payload.name, "Nama lengkap")
    : currentUser.name;
  const nextNip = canManageOthers && payload.nip !== undefined
    ? normalizeRequired(payload.nip, "NIP")
    : currentUser.nip;
  const nextPositionId = canManageOthers && payload.positionId !== undefined
    ? normalizeRequired(payload.positionId, "Jabatan")
    : currentUser.positionId;
  const nextEmail = payload.email !== undefined
    ? normalizeRequired(payload.email, "Email")
    : currentUser.email;
  const nextWhatsappNumber = payload.whatsappNumber !== undefined
    ? normalizeRequired(payload.whatsappNumber, "Nomor WhatsApp")
    : currentUser.whatsappNumber;
  const nextProfilePhotoUrl = payload.profilePhotoUrl !== undefined
    ? normalizeOptional(payload.profilePhotoUrl)
    : currentUser.profilePhotoUrl ?? null;
  const nextIsActive = canManageOthers && payload.isActive !== undefined
    ? Boolean(payload.isActive)
    : currentUser.isActive;
  const trimmedPassword = payload.password?.trim() ? payload.password.trim() : "";

  if (isSelfUpdate && payload.isActive === false) {
    throw new ApiError(400, "Akun yang sedang aktif tidak dapat menonaktifkan dirinya sendiri.");
  }

  if (canManageOthers && !(await getPositionByIdFromDb(db, nextPositionId))) {
    throw new ApiError(400, "Jabatan target tidak ditemukan.");
  }

  await ensureUniqueManagedUserFields(
    db,
    {
      username: nextUsername,
      email: nextEmail,
    },
    currentUser.id
  );

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();
    const nextRoleId = getDefaultRoleForPosition(nextPositionId);
    const passwordHash = trimmedPassword ? hashSecret(trimmedPassword) : null;

    await tx.prepare(
      `UPDATE users
       SET username = ?, password_hash = ?, name = ?, nip = ?, email = ?, whatsapp_number = ?, profile_photo_url = ?,
           role_id = ?, position_id = ?, is_active = ?, can_bypass_hierarchy = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`
    ).run(
      nextUsername,
      passwordHash ?? currentUser.password,
      nextName,
      nextNip,
      nextEmail,
      nextWhatsappNumber,
      nextProfilePhotoUrl,
      nextRoleId,
      nextPositionId,
      nextIsActive ? 1 : 0,
      nextRoleId === "ketua" || nextRoleId === "wakil-ketua" ? 1 : 0,
      now,
      currentUser.id
    );

    await upsertCredentialAccount(tx, {
      userId: currentUser.id,
      email: nextEmail,
      passwordHash,
    });

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: isSelfUpdate ? "UPDATE_PROFILE" : "UPDATE_USER",
      entityType: "user",
      entityId: currentUser.id,
      payload: {
        username: nextUsername,
        email: nextEmail,
        positionId: nextPositionId,
        roleId: nextRoleId,
        isActive: nextIsActive,
        passwordChanged: Boolean(trimmedPassword),
      },
    });

    const updatedUser = await getUserByIdFromDb(tx, currentUser.id);
    if (!updatedUser) {
      throw new ApiError(500, "Akun gagal dimuat ulang setelah diperbarui.");
    }

    return mapUserForApi(updatedUser, trimmedPassword);
  });
}

// ─── Password Recovery — Jalur OTP WhatsApp ───────────────────────────────────

export async function checkRecoveryIdentityInDb(
  db: AletaDatabase,
  { identifier }: { identifier: string }
) {
  return verifyRecoveryIdentityInDb(db, { identifier });
}

export async function createPasswordRecoveryDraftInDb(
  db: AletaDatabase,
  { identifier }: { identifier: string }
): Promise<PasswordRecoveryDraft> {
  const user = await findUserForRecovery(db, identifier);

  if (!user) {
    throw new ApiError(400, "Data akun tidak ditemukan atau tidak dapat diproses.");
  }

  return withTransaction(db, async (tx) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const identifier = `password-reset:${user.id}`;
    const verificationId = await nextPrefixedId(tx, "verifications", "vrf");

    await tx.prepare("DELETE FROM verifications WHERE identifier = ?").run(identifier);
    await tx.prepare(
      `INSERT INTO verifications (id, identifier, value, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(verificationId, identifier, otp, expiresAt, now.toISOString(), now.toISOString());

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: user.id,
      action: "REQUEST_PASSWORD_RECOVERY",
      entityType: "user",
      entityId: user.id,
      payload: {
        via: "identifier-whatsapp",
      },
    });

    return {
      userId: user.id,
      username: user.username,
      name: user.name,
      maskedWhatsapp: maskWhatsappNumber(user.whatsappNumber),
      whatsappNumber: user.whatsappNumber,
      otp,
      expiresAt,
    };
  });
}

export async function cleanupPasswordRecoveryOtpInDb(db: AletaDatabase, userId: string) {
  await db.prepare("DELETE FROM verifications WHERE identifier = ?").run(`password-reset:${userId}`);
}

export async function confirmPasswordRecoveryInDb(
  db: AletaDatabase,
  {
    userId,
    otp,
    password,
  }: {
    userId: string;
    otp: string;
    password: string;
  }
) {
  const normalizedPassword = normalizeRequired(password, "Password baru");
  validatePasswordStrength(normalizedPassword);

  const verification = await db.prepare(
    `SELECT id, identifier, value, expires_at
     FROM verifications
     WHERE identifier = ? AND value = ?
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 1`
  ).get<{ id: string; identifier: string; value: string; expires_at: string }>(
    `password-reset:${userId}`,
    otp.trim()
  );

  if (!verification) {
    throw new ApiError(400, "Kode OTP tidak valid.");
  }

  if (new Date(verification.expires_at).getTime() < Date.now()) {
    throw new ApiError(400, "Kode OTP sudah kedaluwarsa. Silakan minta OTP baru.");
  }

  const currentUser = await getUserByIdFromDb(db, userId);
  if (!currentUser || !currentUser.isActive) {
    throw new ApiError(404, "Akun tujuan reset password tidak ditemukan.");
  }

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();
    const passwordHash = hashSecret(normalizedPassword);

    await tx.prepare(
      `UPDATE users
       SET password_hash = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`
    ).run(passwordHash, now, userId);

    await upsertCredentialAccount(tx, {
      userId,
      email: currentUser.email,
      passwordHash,
    });

    await tx.prepare("DELETE FROM verifications WHERE identifier = ?").run(`password-reset:${userId}`);

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: userId,
      action: "CONFIRM_PASSWORD_RECOVERY",
      entityType: "user",
      entityId: userId,
      payload: {
        recoveredAt: now,
        via: "otp-whatsapp",
      },
    });

    return {
      userId,
      updatedAt: now,
    };
  });
}

// ─── Password Recovery — Jalur Bantuan Admin ──────────────────────────────────

export async function createAdminResetRequestInDb(
  db: AletaDatabase,
  { identifier }: { identifier: string }
) {
  const user = await findUserForRecovery(db, identifier);

  if (!user) {
    throw new ApiError(400, "Data akun tidak ditemukan atau tidak dapat diproses.");
  }

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const requestId = await nextPrefixedId(tx, "password_reset_requests", "prr");

    // Replace any existing pending request for this user
    await tx.prepare(
      `DELETE FROM password_reset_requests WHERE user_id = ? AND status = 'pending'`
    ).run(user.id);

    await tx.prepare(
      `INSERT INTO password_reset_requests (id, user_id, status, resolved_by_user_id, note, created_at, updated_at, expires_at)
       VALUES (?, ?, 'pending', NULL, NULL, ?, ?, ?)`
    ).run(requestId, user.id, now, now, expiresAt);

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: user.id,
      action: "REQUEST_ADMIN_PASSWORD_RESET",
      entityType: "user",
      entityId: user.id,
      payload: {
        requestId,
        via: "identifier-admin-request",
      },
    });

    return {
      requestId,
      userId: user.id,
      name: user.name,
    };
  });
}

export async function listAdminResetRequestsInDb(
  db: AletaDatabase,
  actorUserId: string
): Promise<AdminResetRequest[]> {
  await ensureAdminActor(db, actorUserId);

  const rows = await db.prepare(
    `SELECT
       r.id, r.user_id, r.status, r.resolved_by_user_id, r.note, r.created_at, r.expires_at,
       u.username, u.name, u.nip
     FROM password_reset_requests r
     JOIN users u ON u.id = r.user_id
     WHERE r.expires_at > ?
     ORDER BY r.created_at DESC
     LIMIT 50`
  ).all<{
    id: string;
    user_id: string;
    status: string;
    resolved_by_user_id: string | null;
    note: string | null;
    created_at: string;
    expires_at: string;
    username: string;
    name: string;
    nip: string;
  }>(new Date().toISOString());

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    username: row.username,
    name: row.name,
    nip: row.nip,
    status: row.status as AdminResetRequest["status"],
    note: row.note,
    resolvedByUserId: row.resolved_by_user_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

export async function resolveAdminResetRequestInDb(
  db: AletaDatabase,
  {
    actorUserId,
    requestId,
    action,
    note,
  }: {
    actorUserId: string;
    requestId: string;
    action: "approve" | "reject";
    note?: string;
  }
): Promise<{ tempPassword?: string }> {
  const actor = await ensureAdminActor(db, actorUserId);

  const request = await db.prepare(
    `SELECT r.id, r.user_id, r.status, r.expires_at, u.username, u.name, u.email, u.role_id
     FROM password_reset_requests r
     JOIN users u ON u.id = r.user_id
     WHERE r.id = ?
     LIMIT 1`
  ).get<{
    id: string;
    user_id: string;
    status: string;
    expires_at: string;
    username: string;
    name: string;
    email: string;
    role_id: string;
  }>(requestId);

  if (!request) {
    throw new ApiError(404, "Permintaan reset tidak ditemukan.");
  }

  if (request.status !== "pending") {
    throw new ApiError(409, "Permintaan reset ini sudah diproses sebelumnya.");
  }

  if (new Date(request.expires_at).getTime() < Date.now()) {
    throw new ApiError(400, "Permintaan reset sudah kedaluwarsa.");
  }

  // Admin cannot approve/reject super-admin requests unless actor is super-admin
  if (request.role_id === "super-admin" && actor.roleId !== "super-admin") {
    throw new ApiError(403, "Admin tidak dapat memproses permintaan reset untuk Super Admin.");
  }

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();

    if (action === "reject") {
      await tx.prepare(
        `UPDATE password_reset_requests
         SET status = 'rejected', resolved_by_user_id = ?, note = ?, updated_at = ?
         WHERE id = ?`
      ).run(actor.id, note?.trim() || null, now, requestId);

      await appendAuditLog(tx, {
        id: await nextPrefixedId(tx, "audit_logs", "adt"),
        actorUserId: actor.id,
        action: "REJECT_ADMIN_PASSWORD_RESET_REQUEST",
        entityType: "user",
        entityId: request.user_id,
        payload: { requestId, note: note?.trim() || null },
      });

      return {};
    }

    // Approve: generate temp password, reset the user's password
    const tempPassword = generateTempPassword();
    const passwordHash = hashSecret(tempPassword);
    const targetUser = await getUserByIdFromDb(tx, request.user_id);

    if (!targetUser || !targetUser.isActive) {
      throw new ApiError(404, "Akun target tidak ditemukan atau sudah dinonaktifkan.");
    }

    await tx.prepare(
      `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`
    ).run(passwordHash, now, request.user_id);

    await upsertCredentialAccount(tx, {
      userId: request.user_id,
      email: targetUser.email,
      passwordHash,
    });

    await tx.prepare(
      `UPDATE password_reset_requests
       SET status = 'approved', resolved_by_user_id = ?, note = ?, updated_at = ?
       WHERE id = ?`
    ).run(actor.id, note?.trim() || null, now, requestId);

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "APPROVE_ADMIN_PASSWORD_RESET_REQUEST",
      entityType: "user",
      entityId: request.user_id,
      payload: { requestId, note: note?.trim() || null, tempPasswordSet: true },
    });

    return { tempPassword };
  });
}

// ─── Password Recovery — Jalur Reset Manual Admin ─────────────────────────────

export async function adminManualResetPasswordInDb(
  db: AletaDatabase,
  { actorUserId, targetUserId }: { actorUserId: string; targetUserId: string }
): Promise<{ tempPassword: string }> {
  const actor = await ensureAdminActor(db, actorUserId);
  const targetUser = await getUserByIdFromDb(db, targetUserId);

  if (!targetUser) {
    throw new ApiError(404, "Akun yang akan direset tidak ditemukan.");
  }

  if (!canActorManageManagedUser(actor, targetUser)) {
    throw new ApiError(403, "Anda tidak memiliki hak untuk mereset password akun ini.");
  }

  const tempPassword = generateTempPassword();
  const passwordHash = hashSecret(tempPassword);

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();

    await tx.prepare(
      `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`
    ).run(passwordHash, now, targetUserId);

    await upsertCredentialAccount(tx, {
      userId: targetUserId,
      email: targetUser.email,
      passwordHash,
    });

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "ADMIN_MANUAL_RESET_PASSWORD",
      entityType: "user",
      entityId: targetUserId,
      payload: {
        resetAt: now,
        note: "Password sementara dibuat oleh admin. User disarankan segera menggantinya.",
      },
    });

    return { tempPassword };
  });
}
