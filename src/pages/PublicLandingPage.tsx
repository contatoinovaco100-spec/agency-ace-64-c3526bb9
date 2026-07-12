import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function PublicLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [html, setHtml] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await (supabase as any).rpc("get_public_landing_page", { _slug: slug });
      if (error || !data || data.length === 0) {
        setNotFound(true);
      } else {
        const lp = data[0];
        setTitle(lp.title);
        setHtml(lp.generated_html || "");
      }
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (title) document.title = title;
  }, [title]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-black" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Landing page não encontrada</h1>
          <p className="text-sm mt-2 text-gray-600">Verifique o link.</p>
        </div>
      </div>
    );
  }

  // Render inside a sandboxed iframe so the exported Figma HTML keeps its exact SVG/CSS structure.
  return (
    <iframe
      title={title}
      srcDoc={html || ""}
      className="w-full h-screen border-0"
      sandbox="allow-scripts allow-popups allow-forms"
    />
  );
}
