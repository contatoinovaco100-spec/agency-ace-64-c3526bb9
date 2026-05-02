import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin
      .from('user_roles').select('role')
      .eq('user_id', userData.user.id).eq('role', 'admin').maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user_id, hard_delete } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (hard_delete) {
      // 1. Buscar nome do funcionário
      const { data: profile } = await admin
        .from('profiles').select('full_name').eq('id', user_id).maybeSingle();
      const employeeName = profile?.full_name || 'Funcionário removido';

      // 2. Preservar tarefas pendentes: marcar assignee com prefixo [Ex-funcionário]
      // para o admin ver e reatribuir. Considera "pendente" = status diferente de Concluído/Finalizado.
      const concludedStatuses = ['Concluído', 'Concluido', 'Finalizado'];
      const exTag = `[Ex-funcionário: ${employeeName}]`;

      const { data: pendingTasks } = await admin
        .from('tasks')
        .select('id, assignee, observations')
        .eq('assignee', employeeName)
        .not('status', 'in', `(${concludedStatuses.map(s => `"${s}"`).join(',')})`);

      let preservedCount = 0;
      if (pendingTasks && pendingTasks.length > 0) {
        for (const t of pendingTasks) {
          const note = `\n\n⚠️ ${new Date().toLocaleDateString('pt-BR')} — Funcionário ${employeeName} foi removido do sistema. Reatribuir esta tarefa.`;
          await admin
            .from('tasks')
            .update({
              assignee: exTag,
              observations: (t.observations || '') + note,
            })
            .eq('id', t.id);
          preservedCount++;
        }
      }

      // 3. Reatribuir também campos de pipeline de vídeo (script_writer, editor, copywriter, director, videomaker)
      const videoFields = ['script_writer', 'editor', 'copywriter', 'director', 'videomaker', 'current_stage_owner'];
      for (const field of videoFields) {
        await admin
          .from('tasks')
          .update({ [field]: exTag })
          .eq(field, employeeName)
          .not('status', 'in', `(${concludedStatuses.map(s => `"${s}"`).join(',')})`);
      }

      // 4. Remover acessos de página (FK não existe, mas limpa)
      await admin.from('user_page_access').delete().eq('user_id', user_id);
      await admin.from('user_roles').delete().eq('user_id', user_id);

      // 5. Por fim, excluir o usuário do auth (cascade remove o profile via trigger ou FK)
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 6. Garantir limpeza do profile caso não haja cascade
      await admin.from('profiles').delete().eq('id', user_id);

      return new Response(JSON.stringify({ success: true, preserved_tasks: preservedCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Soft delete: deactivate
      await admin.from('profiles').update({ is_active: false }).eq('id', user_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
