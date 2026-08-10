import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** Cargo (job_title) do usuário logado, lido de `profiles`. */
export function useJobTitle() {
  const { user } = useAuth();
  const [jobTitle, setJobTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setJobTitle(''); setLoading(false); return; }
    let active = true;
    supabase
      .from('profiles')
      .select('job_title')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setJobTitle((data as any)?.job_title || '');
        setLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  const isEditor = /editor/i.test(jobTitle);
  return { jobTitle, isEditor, loading };
}
