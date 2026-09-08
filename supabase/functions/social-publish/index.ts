import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
import { getAdapter } from "../_shared/platforms/registry.ts";
import { isContainerPending } from "../_shared/platforms/types.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BUCKET = "instagram-media";

/*
 * Publicação em duas fases:
 *  Phase 0 (finish): targets em 'publishing' com remote_container_id são
 *    finalizados (espera FINISHED da Meta + media_publish). Vídeos longos
 *    ficam aqui por vários ciclos do cron até a Meta terminar de codificar.
 *  Phase 1 (run): targets novos/pendentes são criados, enviados e publicados.
 *    Se a Meta aceitar o container mas ainda estiver processando (vídeo
 *    longo), o id é persistido em remote_container_id e o target entra em
 *    'publishing' para a Phase 0 finalizar depois.
 *
 * Isso permite vídeos grandes/longos sem depender do teto de tempo de uma
 * única Edge Function (Supabase limita cada chamada a ~400s de relógio).
 */

function isAuthMsg(msg: string) {
  return /Token de acesso|OAuthException|Permissão|Reconecte/i.test(msg);
}

type Target = {
  id: string;
  account_id: string | null;
  platform: string;
  status: string;
  remote_container_id?: string;
  attempts?: number;
  error_message?: string;
};

type Account = {
  id: string;
  platform: string;
  external_id: string | null;
  username: string;
};

type Secret = { access_token?: string; refresh_token?: string; expires_at?: string };

function makeInput(job: any, mediaUrl: string, mediaUrls: string[], mediaTypes: Array<"video" | "image">) {
  return {
    mediaUrl,
    mediaUrls,
    mediaTypes,
    mediaType: job.media_type === "image" ? "image" : ("video" as "image" | "video"),
    caption: job.caption || "",
    firstComment: job.first_comment || "",
    thumbnailUrl: job.thumbnail_url || "",
    postType: job.post_type || "auto",
    shareToFeed: job.share_to_feed !== false,
    collaborators: job.collaborators || [],
    locationId: job.location_id || "",
    userTags: job.user_tags || [],
    coverUrl: job.cover_url || "",
    thumbOffset: job.thumb_offset || 0,
    audioName: job.audio_name || "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.replace("Bearer ", "").trim();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Chamadas internas (cron / process-scheduled-publish) usam a service role key.
    const isInternal = token === serviceKey;

    if (!isInternal) {
      // Valida o JWT do usuário usando auth.getUser (getClaims não existe no SDK v2).
      const anon = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
      );
      const { data: userData, error: userError } = await anon.auth.getUser(token);
      if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const globalToken = Deno.env.get("META_ACCESS_TOKEN");

    const body = await req.json().catch(() => ({}));
    const job_id = body.job_id;
    const finishOnly = body.finish_only === true;
    if (!job_id || typeof job_id !== "string") return json({ error: "job_id obrigatório" }, 400);

    const { data: job } = await admin
      .from("publish_jobs").select("*").eq("id", job_id).maybeSingle();
    if (!job) return json({ error: "Job não encontrado" }, 404);

    const targets: Target[] = (await admin
      .from("publish_targets").select("*").eq("job_id", job_id))
      .data || [];

    // URL assinada única (o vídeo é enviado uma só vez para o Storage)
    const signOne = async (path: string) => {
      const { data: signed } = await admin.storage
        .from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
      return signed?.signedUrl || "";
    };

    const paths: string[] = (job.media_paths && job.media_paths.length)
      ? job.media_paths
      : (job.media_path ? [job.media_path] : []);

    const mediaUrls: string[] = [];
    for (const p of paths) {
      const url = await signOne(p);
      if (url) mediaUrls.push(url);
    }
    let mediaUrl = (job.media_url as string) || mediaUrls[0] || "";
    const mediaTypes: Array<"video" | "image"> = paths.map((p) =>
      /\.(mp4|mov|m4v|webm)$/i.test(p) ? "video" : "image"
    );
    if (!mediaUrl && !mediaUrls.length) return json({ error: "Mídia não encontrada" }, 400);
    if (mediaUrls.length) mediaUrl = mediaUrls[0];
    const input = makeInput(job, mediaUrl, mediaUrls, mediaTypes);

    const loadAccountAndSecret = async (target: Target) => {
      const { data: acc } = await admin
        .from("social_accounts").select("*").eq("id", target.account_id).maybeSingle();
      if (!acc) return null;
      const { data: secret } = await admin
        .from("social_account_secrets").select("access_token, refresh_token, expires_at")
        .eq("account_id", acc.id).maybeSingle();
      return { acc: acc as Account, secret: (secret ?? {}) as Secret };
    };

    const initialToken = (acc: Account, secret: Secret) =>
      secret.access_token || (acc.platform === "instagram" ? globalToken || "" : "");

    /** Tenta renovar o token em silêncio (page token via token de usuário).
     *  Devolve o token fresco ou null quando não há como renovar. */
    const tryRefreshToken = async (acc: Account, secret: Secret): Promise<string | null> => {
      const adapter = getAdapter(acc.platform);
      const userToken = secret.refresh_token || "";
      if (!adapter.refreshedToken || !userToken) return null;
      try {
        const fresh = await adapter.refreshedToken(
          { id: acc.id, externalId: acc.external_id || "", username: acc.username, accessToken: userToken, refreshToken: userToken },
          userToken,
        );
        await admin.from("social_account_secrets").update({
          access_token: fresh.accessToken,
          refresh_token: userToken,
          expires_at: fresh.expiresAt ?? secret.expires_at ?? null,
          updated_at: new Date().toISOString(),
        }).eq("account_id", acc.id);
        return fresh.accessToken;
      } catch (refreshErr) {
        console.warn(`refresh token falhou para @${acc.username}:`, String((refreshErr as Error)?.message || refreshErr));
        // token de usuário inválido: sem caminho de renovação → UI precisa refletir
        await admin.from("social_accounts").update({
          status: "expired",
          token_status: "expired",
          token_error: String((refreshErr as Error)?.message || "Refresh token inválido").slice(0, 300),
          token_checked_at: new Date().toISOString(),
        }).eq("id", acc.id);
        return null;
      }
    };

    const savePublished = async (target: Target, result: { remotePostId: string; permalink: string }) => {
      await admin.from("publish_targets").update({
        status: "published",
        remote_post_id: result.remotePostId,
        permalink: result.permalink,
        remote_container_id: "",
        error_message: "",
        published_at: new Date().toISOString(),
      }).eq("id", target.id);
    };

    const markAuthFailed = async (
      target: Target,
      msg = "Token de acesso expirado e a renovação automática não foi possível. Reconecte a conta em Redes Sociais.",
    ) => {
      await admin.from("publish_targets").update({
        status: "failed",
        remote_container_id: "",
        error_message: msg.slice(0, 500),
      }).eq("id", target.id);
      await admin.from("social_accounts").update({
        status: "expired",
        token_status: "expired",
        token_error: msg.slice(0, 300),
        token_checked_at: new Date().toISOString(),
      }).eq("id", target.account_id);
    };

    /** Publica um target com 1 tentativa automática de renovar o token em erros de auth. */
    const publishTarget = async (target: Target): Promise<"published" | "pending" | "failed"> => {
      const hat = await loadAccountAndSecret(target);
      if (!hat) {
        await admin.from("publish_targets").update({
          status: "failed", error_message: "Conta desconectada",
        }).eq("id", target.id);
        return "failed";
      }
      const { acc, secret } = hat;
      if (!acc.external_id) {
        await admin.from("publish_targets").update({
          status: "failed", error_message: "Conta manual — publique manualmente",
        }).eq("id", target.id);
        return "failed";
      }

      const adapter = getAdapter(acc.platform);
      let accessToken = initialToken(acc, secret);
      const ctx = {
        id: acc.id,
        externalId: acc.external_id || "",
        username: acc.username,
        accessToken,
        refreshToken: secret.refresh_token || "",
      };
      const execute = (ctxToken: string) => adapter.publish({ ...ctx, accessToken: ctxToken }, input);

      // Sem token à vista? Tenta renovar com o token de usuário antes de desistir.
      if (!accessToken) {
        const fresh = await tryRefreshToken(acc, secret);
        if (fresh) {
          accessToken = fresh;
          ctx.accessToken = fresh;
        } else {
          await admin.from("publish_targets").update({
            status: "failed",
            error_message: "Token indisponível — reconecte a conta ou configure o token da Meta",
          }).eq("id", target.id);
          return "failed";
        }
      }

      try {
        const result = await execute(accessToken);
        await savePublished(target, result);
        return "published";
      } catch (e: unknown) {
        const msg = String((e as Error)?.message || e);
        // Container aceito mas ainda processando (vídeo longo): persiste para
        // a Phase 0 finalizar em segundo plano.
        if (isContainerPending(e)) {
          const containerId = (e as { containerId: string }).containerId;
          await admin.from("publish_targets").update({
            status: "publishing",
            remote_container_id: containerId,
            error_message: "",
            attempts: (target.attempts || 0) + 1,
          }).eq("id", target.id);
          return "pending";
        }
        if (isAuthMsg(msg)) {
          const fresh = await tryRefreshToken(acc, secret);
          if (fresh) {
            try {
              const retried = await execute(fresh);
              await savePublished(target, retried);
              // token renovado com sucesso → volta a aparecer como conectado
              // e limpa token_status, senão a publicação fica bloqueada com
              // "Reconecte as contas vencidas" mesmo com token funcionando.
              await admin.from("social_accounts").update({
                status: "connected",
                token_status: "ok",
                token_error: null,
                token_checked_at: new Date().toISOString(),
                last_synced_at: new Date().toISOString(),
              }).eq("id", acc.id);
              return "published";
            } catch (retryErr: unknown) {
              const retryMsg = String((retryErr as Error)?.message || retryErr);
              if (isContainerPending(retryErr)) {
                const containerId = (retryErr as { containerId: string }).containerId;
                await admin.from("publish_targets").update({
                  status: "publishing",
                  remote_container_id: containerId,
                  error_message: "",
                  attempts: (target.attempts || 0) + 1,
                }).eq("id", target.id);
                return "pending";
              }
              if (isAuthMsg(retryMsg)) {
                await markAuthFailed(target, retryMsg);
                return "failed";
              }
              await admin.from("publish_targets").update({
                status: "failed",
                error_message: retryMsg.slice(0, 500),
                remote_container_id: "",
              }).eq("id", target.id);
              return "failed";
            }
          }
          await markAuthFailed(target);
          return "failed";
        }
        await admin.from("publish_targets").update({
          status: "failed",
          error_message: msg.slice(0, 500),
          remote_container_id: "",
        }).eq("id", target.id);
        return "failed";
      }
    };

    /** Phase 0 — finaliza containers já aceitos (vídeos longos). */
    const finishTarget = async (target: Target): Promise<boolean> => {
      const hat = await loadAccountAndSecret(target);
      if (!hat) return false;
      const { acc, secret } = hat;
      if (!target.remote_container_id) return false;

      const adapter = getAdapter(acc.platform);
      if (!adapter.finishedContainer) return false;

      let accessToken = initialToken(acc, secret);
      const ctx = {
        id: acc.id,
        externalId: acc.external_id || "",
        username: acc.username,
        accessToken,
        refreshToken: secret.refresh_token || "",
      };
      const execute = (ctxToken: string) =>
        adapter.finishedContainer!(
          { ...ctx, accessToken: ctxToken },
          target.remote_container_id!,
          input,
        );

      if (!accessToken) {
        const fresh = await tryRefreshToken(acc, secret);
        if (fresh) {
          accessToken = fresh;
          ctx.accessToken = fresh;
        } else {
          await markAuthFailed(target);
          return false;
        }
      }

      try {
        const result = await execute(accessToken);
        await savePublished(target, result);
        return true;
      } catch (e: unknown) {
        const msg = String((e as Error)?.message || e);
        if (isContainerPending(e)) {
          // Ainda está processando — deixa para o próximo ciclo do cron.
          await admin.from("publish_targets").update({
            attempts: (target.attempts || 0) + 1,
            error_message: "",
          }).eq("id", target.id);
          return false;
        }
        if (isAuthMsg(msg)) {
          const fresh = await tryRefreshToken(acc, secret);
          if (fresh) {
            try {
              const retried = await execute(fresh);
              await savePublished(target, retried);
              await admin.from("social_accounts").update({
                status: "connected",
                token_status: "ok",
                token_error: null,
                token_checked_at: new Date().toISOString(),
                last_synced_at: new Date().toISOString(),
              }).eq("id", acc.id);
              return true;
            } catch (retryErr: unknown) {
              const retryMsg = String((retryErr as Error)?.message || retryErr);
              if (isContainerPending(retryErr)) {
                await admin.from("publish_targets").update({
                  attempts: (target.attempts || 0) + 1,
                  error_message: "",
                }).eq("id", target.id);
                return false;
              }
              if (isAuthMsg(retryMsg)) {
                await markAuthFailed(target, retryMsg);
                return false;
              }
              await admin.from("publish_targets").update({
                status: "failed",
                error_message: retryMsg.slice(0, 500),
                remote_container_id: "",
              }).eq("id", target.id);
              return false;
            }
          }
          await markAuthFailed(target);
          return false;
        }
        await admin.from("publish_targets").update({
          status: "failed",
          remote_container_id: "",
          error_message: msg.slice(0, 500),
        }).eq("id", target.id);
        return false;
      }
    };

    // Separa: primeira finaliza containers pendentes, depois reclama novos.
    const toFinish = targets.filter((t) =>
      t.status === "publishing" && t.remote_container_id);
    const toRun = targets.filter((t) => ["pending", "failed"].includes(t.status));

    let finishedContainers = 0;
    if (toFinish.length) {
      const results = await Promise.allSettled(toFinish.map(finishTarget));
      finishedContainers = results.filter((r) => r.status === "fulfilled" && r.value).length;
    }

    let ran = 0;
    if (finishOnly) {
      if (!toFinish.length) {
        // nada mais para finalizar — recalcula o status do job
        const { data: finals } = await admin
          .from("publish_targets").select("status").eq("job_id", job_id);
        const sts = (finals || []).map((t: any) => t.status);
        const published = sts.filter((s: string) => s === "published").length;
        const failed = sts.filter((s: string) => s === "failed").length;
        const pending = sts.length - published - failed;
        const status = pending > 0 ? "processing"
          : failed === 0 ? "published"
          : published === 0 ? "failed" : "partial";
        await admin.from("publish_jobs").update({ status }).eq("id", job_id);
      }
      return json({ success: true, finished: finishedContainers, pending: toFinish.length });
    }

    if (toRun.length) {
      // Trava atômica no job — só quem mudar para 'processing' publica.
      const { data: claimedJob } = await admin
        .from("publish_jobs")
        .update({ status: "processing" })
        .eq("id", job_id)
        .in("status", ["pending", "scheduled", "failed", "partial", "processing"])
        .select("id")
        .maybeSingle();
      if (claimedJob) {
        const CONCURRENCY = 6;
        for (let i = 0; i < toRun.length; i += CONCURRENCY) {
          await Promise.allSettled(toRun.slice(i, i + CONCURRENCY).map(async (target) => {
            // Trava atômica por target: cron, clique manual e abas abertas
            // podem disparar o mesmo job ao mesmo tempo.
            const { data: claimed, error: claimError } = await admin
              .from("publish_targets")
              .update({ status: "publishing", error_message: "" })
              .eq("id", target.id)
              .in("status", ["pending", "failed"])
              .select("id")
              .maybeSingle();
            if (claimError) throw claimError;
            if (!claimed) return;
            ran++;
            await publishTarget({ ...target });
          }));
        }
      }
    }

    // Reconcilia o status do job pelos destinos finais/em andamento.
    const { data: finals } = await admin
      .from("publish_targets").select("status").eq("job_id", job_id);
    const sts = (finals || []).map((t: any) => t.status);
    const published = sts.filter((s: string) => s === "published").length;
    const failed = sts.filter((s: string) => s === "failed").length;
    const inFlight = sts.length - published - failed;
    const status = inFlight > 0 ? "processing"
      : failed === 0 ? "published"
      : published === 0 ? "failed" : "partial";
    await admin.from("publish_jobs").update({ status }).eq("id", job_id);

    return json({
      success: true,
      targets: targets.length,
      finished: finishedContainers,
      ran,
      status,
    });
  } catch (e) {
    console.error("social-publish error", e);
    return json({ error: String((e as Error).message) }, 500);
  }
});