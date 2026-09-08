import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const nowIso = now.toISOString();
    // Upload + processamento e retries de vídeos grandes podem passar de 10 min.
    const cutoffIso = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

    // 1) Vídeos longos: finaliza containers que já foram aceitos pela Meta e
    //    estão 'publishing' com remote_container_id — sem esperar ficarem
    //    "stuck". O social-publish dá até ~2min por container por ciclo; a
    //    própria Meta recomenda checar ~1x por minuto.
    const { data: containers } = await admin
      .from("publish_targets")
      .select("job_id")
      .eq("status", "publishing")
      .neq("remote_container_id", "");
    const finishIds = [...new Set((containers || []).map((t: any) => t.job_id))].slice(0, 20);

    let finished = 0;
    if (finishIds.length) {
      const backendUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      for (const id of finishIds) {
        try {
          const invokeResponse = await fetch(
            `${backendUrl}/functions/v1/social-publish`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${serviceKey}`,
                "apikey": serviceKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ job_id: id, finish_only: true }),
            },
          );
          if (invokeResponse.ok) finished++;
          else {
            const detail = await invokeResponse.text().catch(() => "");
            console.error(`finish container job ${id} failed: ${invokeResponse.status} ${detail.slice(0, 300)}`);
          }
        } catch (e) {
          console.error(`finish container job ${id} error`, e);
        }
      }
    }

    // 2) Agendados vencidos + jobs travados em 'processing' (publicação antiga
    //    cujo background foi encerrado antes de concluir).
    const [{ data: dueJobs }, { data: stuckJobs }] = await Promise.all([
      admin
        .from("publish_jobs")
        .select("id")
        .eq("status", "scheduled")
        .lte("scheduled_at", nowIso),
      admin
        .from("publish_jobs")
        .select("id")
        .eq("status", "processing")
        .lt("updated_at", cutoffIso),
    ]);

    // Recupera travados: targets 'publishing' SEM container voltam a 'pending'
    // e o job volta para 'scheduled' para ser publicado normalmente. Targets
    // com remote_container_id estão sendo finalizados no passo 1 e ficam como
    // estão (não podem ser recriados — o container já existe na Meta).
    const recoveredIds = new Set<string>();
    for (const job of stuckJobs || []) {
      const { data: pubTargets } = await admin
        .from("publish_targets")
        .select("id, status, remote_container_id")
        .eq("job_id", job.id)
        .in("status", ["publishing", "pending"]);

      const nonContainer = (pubTargets || []).filter((t: any) => !t.remote_container_id);
      const anyPending = nonContainer.some((t: any) => t.status === "pending");
      const toReset = nonContainer.filter((t: any) => t.status === "publishing");
      if (toReset.length) {
        await admin
          .from("publish_targets")
          .update({ status: "pending", error_message: "" })
          .eq("job_id", job.id)
          .in("id", toReset.map((t: any) => t.id));
      }
      if (toReset.length || anyPending) {
        await admin
          .from("publish_jobs")
          .update({ status: "scheduled" })
          .eq("id", job.id);
        recoveredIds.add(job.id);
      }
    }

    const ids = [
      ...(dueJobs || []).map((j: any) => j.id),
      ...recoveredIds,
    ];
    if (!ids.length) {
      return json({ success: true, processed: 0, recovered: recoveredIds.size, finishedContainers: finished });
    }

    let processed = 0;
    let failed = 0;

    for (const id of ids) {
      try {
        const { data: targets } = await admin
          .from("publish_targets")
          .select("id")
          .eq("job_id", id)
          .in("status", ["pending", "failed"]);

        if (!targets?.length) {
          await admin
            .from("publish_jobs")
            .update({ status: "failed" })
            .eq("id", id);
          failed++;
          continue;
        }

        await admin
          .from("publish_jobs")
          .update({ status: "processing" })
          .eq("id", id);

        const backendUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!backendUrl || !serviceKey) throw new Error("Backend environment unavailable");

        // Envia explicitamente a credencial interna. functions.invoke pode
        // preservar o apikey mas substituir Authorization em chamadas função→função.
        const invokeResponse = await fetch(`${backendUrl}/functions/v1/social-publish`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ job_id: id }),
        });

        if (!invokeResponse.ok) {
          const detail = await invokeResponse.text().catch(() => "");
          console.error(`Failed to invoke social-publish for job ${id}: ${invokeResponse.status} ${detail.slice(0, 300)}`);
          await admin
            .from("publish_jobs")
            .update({ status: "scheduled" })
            .eq("id", id);
          failed++;
        } else {
          processed++;
        }
      } catch (e) {
        console.error(`Error processing job ${id}:`, e);
        await admin
          .from("publish_jobs")
          .update({ status: "scheduled" })
          .eq("id", id);
        failed++;
      }
    }

    return json({ success: true, processed, failed, total: ids.length, finishedContainers: finished });
  } catch (e) {
    console.error("process-scheduled-publish error", e);
    return json({ error: String((e as Error).message) }, 500);
  }
});