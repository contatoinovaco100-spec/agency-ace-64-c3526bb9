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

    const now = new Date().toISOString();

    const { data: jobs, error: fetchErr } = await admin
      .from("publish_jobs")
      .select("id")
      .eq("status", "scheduled")
      .lte("scheduled_at", now);

    if (fetchErr) throw fetchErr;
    if (!jobs?.length) {
      return json({ success: true, processed: 0 });
    }

    let processed = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        const { data: targets } = await admin
          .from("publish_targets")
          .select("id")
          .eq("job_id", job.id)
          .in("status", ["pending", "failed"]);

        if (!targets?.length) {
          await admin
            .from("publish_jobs")
            .update({ status: "failed" })
            .eq("id", job.id);
          failed++;
          continue;
        }

        await admin
          .from("publish_jobs")
          .update({ status: "processing" })
          .eq("id", job.id);

        const { error: invokeErr } = await admin.functions.invoke("social-publish", {
          body: { job_id: job.id },
        });

        if (invokeErr) {
          console.error(`Failed to invoke social-publish for job ${job.id}:`, invokeErr);
          await admin
            .from("publish_jobs")
            .update({ status: "scheduled" })
            .eq("id", job.id);
          failed++;
        } else {
          processed++;
        }
      } catch (e) {
        console.error(`Error processing job ${job.id}:`, e);
        await admin
          .from("publish_jobs")
          .update({ status: "scheduled" })
          .eq("id", job.id);
        failed++;
      }
    }

    return json({ success: true, processed, failed, total: jobs.length });
  } catch (e) {
    console.error("process-scheduled-publish error", e);
    return json({ error: String((e as Error).message) }, 500);
  }
});
