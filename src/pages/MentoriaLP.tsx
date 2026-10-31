import { useEffect } from "react";

// LP estática da Mentoria Escala Produtora (public/lp-mentoria). O iframe mantém o endereço limpo e o CSS da página isolado do app.
export default function MentoriaLP() {
  useEffect(() => {
    document.title = "Mentoria Escala Produtora | Inova Co.";
  }, []);

  return (
    <iframe
      title="Mentoria Escala Produtora"
      src="/lp-mentoria/index.html"
      className="fixed inset-0 h-full w-full border-0"
    />
  );
}
