import { regulationsKnowledgeBase } from "@/core/knowledge/regulations-db";
import { letterClassificationCatalog, letterOriginSuggestions } from "@/lib/letter-taxonomy";
import { DEFAULT_PANEL_SETTINGS } from "@/lib/panel-settings";
import {
  defaultAIConfig,
  defaultInstitutionIdentity,
  defaultWhatsAppWeb,
  moduleVisibility,
  personas,
  positions,
  roles,
} from "@/lib/mock-data";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { hashSecret } from "@/server/shared/security";

function nowIso() {
  return new Date().toISOString();
}

function json(value: unknown) {
  return JSON.stringify(value ?? []);
}

async function seedKnownRoles(tx: AletaDatabase) {
  for (const role of roles) {
    await tx.prepare(
      `INSERT INTO roles (id, name, description)
       VALUES (?, ?, ?)
       ON CONFLICT (id) DO NOTHING`
    ).run(role.id, role.name, role.description);
  }
}

async function seedDefaultModuleVisibility(tx: AletaDatabase, timestamp: string) {
  for (const visibility of moduleVisibility) {
    for (const [moduleId, enabled] of Object.entries(visibility.modules)) {
      await tx.prepare(
        `INSERT INTO module_visibility_settings (
          role_id, module_id, enabled, updated_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT (role_id, module_id) DO NOTHING`
      ).run(visibility.roleId, moduleId, enabled ? 1 : 0, timestamp);
    }
  }
}

async function seedKnownPositions(tx: AletaDatabase, timestamp: string) {
  for (const position of positions) {
    await tx.prepare(
      `INSERT INTO positions (
        id, name, unit_kerja, level_hierarchy, reports_to_position_id,
        disposition_target_position_ids_json, can_forward_to_leadership,
        deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO NOTHING`
    ).run(
      position.id,
      position.name,
      position.unitKerja,
      position.levelHierarchy,
      null,
      json(position.dispositionTargetPositionIds ?? []),
      position.canForwardToLeadership ? 1 : 0,
      null,
      timestamp,
      timestamp
    );
  }

  for (const position of positions.filter((item) => item.reportsToPositionId)) {
    await tx.prepare(
      `UPDATE positions
       SET reports_to_position_id = COALESCE(reports_to_position_id, ?), updated_at = ?
       WHERE id = ? AND reports_to_position_id IS NULL`
    ).run(position.reportsToPositionId ?? null, timestamp, position.id);
  }
}

export async function seedDatabaseFromFrontendSource(db: AletaDatabase) {
  const roleCount = await db.prepare("SELECT COUNT(*)::int AS count FROM roles").get<{ count: number }>();
  const timestamp = nowIso();

  await withTransaction(db, async (tx) => {
    await seedKnownRoles(tx);
    await seedKnownPositions(tx, timestamp);
    await seedDefaultModuleVisibility(tx, timestamp);

    if ((roleCount?.count ?? 0) > 0) {
      return;
    }

    for (const user of personas) {
      await tx.prepare(
        `INSERT INTO users (
          id, username, password_hash, name, nip, email, email_verified, whatsapp_number, profile_photo_url,
          role_id, position_id, is_active, can_bypass_hierarchy, deleted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        user.id,
        user.username,
        hashSecret(user.password),
        user.name,
        user.nip,
        user.email,
        true,
        user.whatsappNumber,
        user.profilePhotoUrl ?? null,
        user.roleId,
        user.positionId,
        user.isActive ? 1 : 0,
        user.canBypassHierarchy ? 1 : 0,
        null,
        timestamp,
        timestamp
      );

      await tx.prepare(
        `INSERT INTO accounts (
          id, account_id, provider_id, user_id, access_token, refresh_token, id_token,
          access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `acc-${user.id}`,
        user.email,
        "credential",
        user.id,
        null,
        null,
        null,
        null,
        null,
        "email password",
        hashSecret(user.password),
        timestamp,
        timestamp
      );
    }

    let assignmentIndex = 1;
    for (const user of personas.filter((item) => item.actingAssignment)) {
      const assignment = user.actingAssignment!;
      const assignedAt = assignment.assignedAt ?? timestamp;

      await tx.prepare(
        `INSERT INTO acting_assignments (
          id, user_id_pengganti, jabatan_id_target, tipe, role_id_target, assigned_by_user_id,
          authorized_by_user_id, tanggal_mulai, tanggal_selesai, assigned_at, deleted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `asg-${String(assignmentIndex).padStart(3, "0")}`,
        user.id,
        assignment.positionId,
        assignment.type,
        assignment.roleId,
        assignment.assignedByUserId ?? user.id,
        assignment.authorizedByUserId ?? user.id,
        assignment.startDate ?? assignedAt,
        assignment.endDate ?? null,
        assignedAt,
        null,
        assignedAt,
        assignedAt
      );
      assignmentIndex += 1;
    }

    await tx.prepare(
      `INSERT INTO ai_global_settings (
        id, enabled, active_provider_id, active_model_id, active_connection_id, primary_language,
        feature_disposition_ai, feature_mail_intelligence, feature_draft_metadata,
        feature_manajemen_surat_ai, feature_disposisi_ai, feature_flags_json, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      defaultAIConfig.enabled ? 1 : 0,
      defaultAIConfig.providerId,
      defaultAIConfig.modelId,
      defaultAIConfig.activeConnectionId ?? null,
      defaultAIConfig.primaryLanguage,
      defaultAIConfig.featureDispositionAi ? 1 : 0,
      defaultAIConfig.featureMailIntelligence ? 1 : 0,
      defaultAIConfig.featureDraftMetadata ? 1 : 0,
      defaultAIConfig.featureManajemenSuratAi ? 1 : 0,
      defaultAIConfig.featureDisposisiAi ? 1 : 0,
      JSON.stringify(defaultAIConfig.featureFlags),
      timestamp
    );

    await tx.prepare(
      `INSERT INTO whatsapp_web_settings (
        id, phone_number, session_name, status, last_connected_at, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?)`
    ).run(
      defaultWhatsAppWeb.phoneNumber,
      defaultWhatsAppWeb.sessionName,
      defaultWhatsAppWeb.status,
      defaultWhatsAppWeb.lastConnectedAt ?? null,
      timestamp
    );

    await tx.prepare(
      `INSERT INTO institution_identity (
        id, court_name, court_short_name, address, phone_number, mobile_phone, email,
        cs_whatsapp_number, bot_whatsapp_number, instagram, facebook, youtube, website, map_url, logo_url, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      defaultInstitutionIdentity.courtName,
      defaultInstitutionIdentity.courtShortName,
      defaultInstitutionIdentity.address,
      defaultInstitutionIdentity.phoneNumber,
      defaultInstitutionIdentity.mobilePhone,
      defaultInstitutionIdentity.email,
      defaultInstitutionIdentity.csWhatsappNumber ?? "",
      defaultInstitutionIdentity.botWhatsappNumber ?? "",
      defaultInstitutionIdentity.instagram ?? null,
      defaultInstitutionIdentity.facebook ?? null,
      defaultInstitutionIdentity.youtube ?? null,
      defaultInstitutionIdentity.website ?? null,
      defaultInstitutionIdentity.mapUrl ?? null,
      defaultInstitutionIdentity.logoUrl ?? null,
      timestamp
    );

    await tx.prepare(
      `INSERT INTO panel_settings (
        id, footer_mode, portal_cards_json, public_access_json, external_apps_json, updated_by, updated_at
      ) VALUES (1, ?, ?, ?, ?, NULL, ?)`
    ).run(
      DEFAULT_PANEL_SETTINGS.footerMode,
      JSON.stringify(DEFAULT_PANEL_SETTINGS.portalCards),
      JSON.stringify(DEFAULT_PANEL_SETTINGS.publicAccess),
      JSON.stringify(DEFAULT_PANEL_SETTINGS.externalApps),
      timestamp
    );

    for (const entry of regulationsKnowledgeBase) {
      await tx.prepare(
        `INSERT INTO knowledge_base_regulations (
          id, title, source, jurisdiction, module_ids_json, keywords_json, summary, citation,
          recommended_position_ids_json, deleted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        entry.id,
        entry.title,
        entry.source,
        entry.jurisdiction,
        json(entry.moduleIds),
        json(entry.keywords),
        entry.summary,
        entry.citation,
        json(entry.recommendedPositionIds ?? []),
        null,
        timestamp,
        timestamp
      );
    }

    let originIndex = 1;
    for (const origin of letterOriginSuggestions) {
      await tx.prepare(
        "INSERT INTO letter_origin_references (id, label, created_at) VALUES (?, ?, ?)"
      ).run(`origin-${String(originIndex).padStart(3, "0")}`, origin, timestamp);
      originIndex += 1;
    }

    for (const item of letterClassificationCatalog) {
      await tx.prepare(
        `INSERT INTO classification_catalog (
          code, label, category, keywords_json, is_system, deleted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        item.value,
        item.label,
        item.category,
        json(item.keywords),
        1,
        null,
        timestamp,
        timestamp
      );
    }

    // Surat, disposisi, dan audit trail tidak lagi di-seed sebagai data dummy.
    // Workspace akan mulai dari data riil yang diinput pengguna melalui API aplikasi.
  });
}
