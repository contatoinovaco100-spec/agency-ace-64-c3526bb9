import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { publishingService } from '@/services/publishing';
import type { PublishJob, PublishTarget } from '@/types/social';

/** Jobs + destinos com atualização em tempo real. */
export function usePublishJobs(jobId?: string) {
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [targets, setTargets] = useState<PublishTarget[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [j, t] = await Promise.all([
      publishingService.listJobs(),
      publishingService.listTargets(jobId),
    ]);
    setJobs(j);
    setTargets(t);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const channel = supabase
      .channel('publish-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'publish_targets' }, () => reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'publish_jobs' }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [reload]);

  const targetsOf = (id: string) => targets.filter(t => t.job_id === id);

  return { jobs, targets, targetsOf, loading, reload };
}
