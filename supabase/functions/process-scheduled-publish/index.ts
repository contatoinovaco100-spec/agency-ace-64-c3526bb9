import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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

    // Agendados vencidos + jobs travados em 'processing' (publicação antiga
    // cujo background foi encerrado antes de concluir).
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

    // Recupera travados: targets 'publishing' voltam a 'pending' e o job
    // volta para 'scheduled' para ser publicado normalmente.
    const recoveredIds: string[] = [];
    for (const job of stuckJobs || []) {
      await admin
        .from("publish_targets")
        .update({ status: "pending", error_message: "" })
        .eq("job_id", job.id)
        .in("status", ["publishing"]);
      await admin
        .from("publish_jobs")
        .update({ status: "scheduled" })
        .eq("id", job.id);
      recoveredIds.push(job.id);
    }

    const ids = [
      ...(dueJobs || []).map((j: any) => j.id),
      ...recoveredIds,
    ];
    if (!ids.length) {
      return json({ success: true, processed: 0, recovered: recoveredIds.length });
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

    return json({ success: true, processed, failed, total: ids.length });
  } catch (e) {
    console.error("process-scheduled-publish error", e);
    return json({ error: String((e as Error).message) }, 500);
  }
});
