import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// LP da Mentoria Escala Produtora. Depois de trazida para Minhas LPs, a versão editada vem do banco (slug lp-mentoria);
// até lá, vale o arquivo estático em public/lp-mentoria. O iframe mantém o endereço limpo e o CSS isolado do app.
export default function MentoriaLP() {
  const [html, setHtml] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    document.title = "Mentoria Escala Produtora | Inova Co.";
    (async () => {
      const { data } = await supabase.rpc("get_public_landing_page", { _slug: "lp-mentoria" });
      setHtml(data?.[0]?.generated_html || null);
    })();
  }, []);

  if (html === undefined) return <div className="fixed inset-0 bg-[#0b0c0c]" />;

  return (
    <iframe
      title="Mentoria Escala Produtora"
      {...(html
        ? { srcDoc: html, sandbox: "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms" }
        : { src: "/lp-mentoria/index.html" })}
      className="fixed inset-0 h-full w-full border-0"
    />
  );
}
