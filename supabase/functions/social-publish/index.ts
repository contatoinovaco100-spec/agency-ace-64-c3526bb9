import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getAdapter } from "../_shared/platforms/registry.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BUCKET = "instagram-media";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: claimsData, error: claimsError } = await anon.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { job_id } = await req.json().catch(() => ({}));
    if (!job_id || typeof job_id !== "string") return json({ error: "job_id obrigatório" }, 400);

    const { data: job } = await admin
      .from("publish_jobs").select("*").eq("id", job_id).maybeSingle();
    if (!job) return json({ error: "Job não encontrado" }, 404);

    const { data: targets } = await admin
      .from("publish_targets").select("*").eq("job_id", job_id).in("status", ["pending", "failed"]);
    if (!targets?.length) return json({ error: "Nenhum destino pendente" }, 400);

    // URL assinada única (o vídeo é enviado uma só vez para o Storage)
    let mediaUrl = job.media_url as string;
    if (job.media_path) {
      const { data: signed } = await admin.storage
        .from(BUCKET).createSignedUrl(job.media_path, 60 * 60 * 6);
      if (signed?.signedUrl) mediaUrl = signed.signedUrl;
    }
    if (!mediaUrl) return json({ error: "Mídia não encontrada" }, 400);

    await admin.from("publish_jobs").update({ status: "processing" }).eq("id", job_id);

    const run = async () => {
      await Promise.allSettled((targets || []).map(async (target: any) => {
        try {
          await admin.from("publish_targets")
            .update({ status: "publishing", error_message: "" }).eq("id", target.id);

          const { data: acc } = await admin
            .from("social_accounts").select("*").eq("id", target.account_id).maybeSingle();
          if (!acc) throw new Error("Conta desconectada");

          const { data: secret } = await admin
            .from("social_account_secrets").select("access_token, refresh_token")
            .eq("account_id", acc.id).maybeSingle();
          if (!secret?.access_token) throw new Error("Token indisponível — reconecte a conta");

          const adapter = getAdapter(acc.platform);
          const result = await adapter.publish(
            {
              id: acc.id,
              externalId: acc.external_id || "",
              username: acc.username,
              accessToken: secret.access_token,
              refreshToken: secret.refresh_token,
            },
            {
              mediaUrl,
              mediaType: (job.media_type === "image" ? "image" : "video"),
              caption: job.caption || "",
              firstComment: job.first_comment || "",
              thumbnailUrl: job.thumbnail_url || "",
            },
          );

          await admin.from("publish_targets").update({
            status: "published",
            remote_post_id: result.remotePostId,
            permalink: result.permalink,
            published_at: new Date().toISOString(),
          }).eq("id", target.id);
        } catch (e) {
          const message = String((e as Error).message || e);
          console.error(`publish target ${target.id} failed:`, message);
          await admin.from("publish_targets").update({
            status: "failed",
            error_message: message.slice(0, 500),
          }).eq("id", target.id);
        }
      }));

      const { data: finals } = await admin
        .from("publish_targets").select("status").eq("job_id", job_id);
      const published = (finals || []).filter((t: any) => t.status === "published").length;
      const failed = (finals || []).filter((t: any) => t.status === "failed").length;
      const status = failed === 0 ? "published" : published === 0 ? "failed" : "partial";
      await admin.from("publish_jobs").update({ status }).eq("id", job_id);
    };

    // @ts-ignore EdgeRuntime existe no runtime do Supabase
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(run());
    } else {
      run();
    }

    return json({ success: true, targets: targets.length });
  } catch (e) {
    console.error("social-publish error", e);
    return json({ error: String((e as Error).message) }, 500);
  }
});
