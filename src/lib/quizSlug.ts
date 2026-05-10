import { supabase } from "@/integrations/supabase/client";

export function slugify(input: string): string {
  return (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]{3,60}$/.test(slug);
}

export async function isClientSlugAvailable(slug: string, ignoreId?: string): Promise<boolean> {
  const q = supabase.from("quiz_clients").select("id").eq("slug", slug).limit(1);
  const { data, error } = await q;
  if (error) return false;
  if (!data || data.length === 0) return true;
  return ignoreId ? data[0].id === ignoreId : false;
}

export async function isQuizSlugAvailable(
  clientId: string,
  slug: string,
  ignoreId?: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("quizzes")
    .select("id")
    .eq("client_id", clientId)
    .eq("slug", slug)
    .limit(1);
  if (error) return false;
  if (!data || data.length === 0) return true;
  return ignoreId ? data[0].id === ignoreId : false;
}
