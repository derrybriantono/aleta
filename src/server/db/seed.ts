import { regulationsKnowledgeBase } from "@/core/knowledge/regulations-db";
import { popularAIProviderCatalog } from "@/lib/ai-catalog";
import { letterClassificationCatalog, letterOriginSuggestions } from "@/lib/letter-taxonomy";
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

function getProviderEndpoint(providerId: string) {
  const endpointMap: Record<string, string> = {
    chatgpt: "https://api.openai.com/v1/chat/completions",
    gemini: "https://generativelanguage.googleapis.com/v1beta/models",
    claude: "https://api.anthropic.com/v1/messages",
    perplexity: "https://api.perplexity.ai/chat/completions",
    grok: "https://api.x.ai/v1/chat/completions",
    copilot: "https://api.copilot.microsoft.com",
    deepseek: "https://api.deepseek.com/chat/completions",
    mistral: "https://api.mistral.ai/v1/chat/completions",
    llama: "http://127.0.0.1:11434/api/chat",
    qwen: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
    cohere: "https://api.cohere.com/v2/chat",
    "amazon-q": "https://qbusiness.us-east-1.amazonaws.com",
    watsonx: "https://us-south.ml.cloud.ibm.com/ml/v1/text/generation",
    poe: "https://api.poe.com",
    "meta-ai": "https://ai.meta.com",
    notebooklm: "https://notebooklm.google.com",
    blackbox: "https://api.blackbox.ai",
    "replit-ai": "https://replit.com/agent",
    you: "https://api.you.com",
    "character-ai": "https://plus.character.ai",
  };

  return endpointMap[providerId] ?? "";
}

export async function seedDatabaseFromFrontendSource(db: AletaDatabase) {
  const roleCount = await db.prepare("SELECT COUNT(*)::int AS count FROM roles").get<{ count: number }>();

  if ((roleCount?.count ?? 0) > 0) {
    return;
  }

  const timestamp = nowIso();

  await withTransaction(db, async (tx) => {
    for (const role of roles) {
      await tx.prepare("INSERT INTO roles (id, name, description) VALUES (?, ?, ?)").run(
        role.id,
        role.name,
        role.description
      );
    }

    for (const position of positions) {
      await tx.prepare(
        `INSERT INTO positions (
          id, name, unit_kerja, level_hierarchy, reports_to_position_id,
          disposition_target_position_ids_json, can_forward_to_leadership,
          deleted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
         SET reports_to_position_id = ?, updated_at = ?
         WHERE id = ?`
      ).run(position.reportsToPositionId ?? null, timestamp, position.id);
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
        id, enabled, active_provider_id, active_model_id, primary_language, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?)`
    ).run(
      defaultAIConfig.enabled ? 1 : 0,
      defaultAIConfig.providerId,
      defaultAIConfig.modelId,
      defaultAIConfig.primaryLanguage,
      timestamp
    );

    for (const provider of popularAIProviderCatalog) {
      await tx.prepare(
        `INSERT INTO ai_providers (
          id, name, endpoint_url, api_key, models_json, builtin, connection_status,
          is_active, deleted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        provider.id,
        provider.name,
        getProviderEndpoint(provider.id),
        defaultAIConfig.providers.find((item) => item.id === provider.id)?.apiKey ?? "",
        json(provider.models),
        provider.builtin ? 1 : 0,
        defaultAIConfig.providers.find((item) => item.id === provider.id)?.connectionStatus ??
          provider.connectionStatus ??
          "idle",
        defaultAIConfig.providerId === provider.id ? 1 : 0,
        null,
        timestamp,
        timestamp
      );
    }

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
        instagram, facebook, youtube, website, map_url, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      defaultInstitutionIdentity.courtName,
      defaultInstitutionIdentity.courtShortName,
      defaultInstitutionIdentity.address,
      defaultInstitutionIdentity.phoneNumber,
      defaultInstitutionIdentity.mobilePhone,
      defaultInstitutionIdentity.email,
      defaultInstitutionIdentity.instagram ?? null,
      defaultInstitutionIdentity.facebook ?? null,
      defaultInstitutionIdentity.youtube ?? null,
      defaultInstitutionIdentity.website ?? null,
      defaultInstitutionIdentity.mapUrl ?? null,
      timestamp
    );

    for (const visibility of moduleVisibility) {
      for (const [moduleId, enabled] of Object.entries(visibility.modules)) {
        await tx.prepare(
          `INSERT INTO module_visibility_settings (
            role_id, module_id, enabled, updated_at
          ) VALUES (?, ?, ?, ?)`
        ).run(visibility.roleId, moduleId, enabled ? 1 : 0, timestamp);
      }
    }

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
