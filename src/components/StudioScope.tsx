/**
 * "Estúdio": editores que produzem conteúdo para clientes (diagnóstico, LP, quiz, vídeo, whiteboard)
 * ficam sempre no tema escuro, como um software de edição. Assim a prévia mostra exatamente o que o
 * cliente vai ver, independentemente do tema escolhido na plataforma.
 */
export function StudioScope({ children }: { children: React.ReactNode }) {
  return <div className="dark rounded-xl bg-background p-3 text-foreground ring-1 ring-border sm:p-4">{children}</div>;
}
