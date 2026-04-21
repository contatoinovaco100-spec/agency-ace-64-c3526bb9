import{r,j as a,$ as S,k as n,i as j}from"./index-BdsUzRZl.js";import{B as b}from"./button-QmZn2ska.js";import{T as k}from"./textarea-CS4B5y2C.js";import{B as A}from"./badge-BgqDnB4S.js";import{R as I}from"./refresh-cw-CcDTsnnl.js";import{C as R}from"./check-check-Cxe4fR8S.js";import{C as P}from"./copy-e_IeFD2q.js";import{S as D}from"./send-DOpEGFGQ.js";const O=["Crie uma legenda para Instagram sobre produção audiovisual","Faça um roteiro de 60 segundos para apresentação de empresa","Sugira 5 ideias de conteúdo para uma marca de moda","Redija um email de proposta comercial para cliente novo","Liste os diferenciais de uma produtora audiovisual premium"],N={default:"Olá! Sou a Nova, sua assistente inteligente da INOVA Co. Estou aqui para ajudar com roteiros, legendas, estratégias de conteúdo, propostas comerciais e muito mais. Como posso te ajudar hoje? 🚀"};function $(){const[d,l]=r.useState([{id:"0",role:"assistant",content:N.default}]),[c,x]=r.useState(""),[m,f]=r.useState(!1),[C,g]=r.useState(null),h=r.useRef(null);r.useEffect(()=>{var e;(e=h.current)==null||e.scrollIntoView({behavior:"smooth"})},[d]);const w=async e=>{var t,i,o,v,y;const s="AIzaSyAtrnijyQBLdBhZPUhFj_Dv1poQfutFUZg";try{return((y=(v=(o=(i=(t=(await(await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${s}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:`Você é a Nova, assistente da INOVA Co., uma produtora audiovisual premium. Responda em português brasileiro de forma profissional e criativa.

Usuário: ${e}`}]}]})})).json()).candidates)==null?void 0:t[0])==null?void 0:i.content)==null?void 0:o.parts)==null?void 0:v[0])==null?void 0:y.text)||u(e)}catch{return u(e)}return u(e)},u=e=>{const s=e.toLowerCase();return s.includes("legenda")||s.includes("instagram")?`✨ **Legenda para Instagram:**

Transformar uma ideia em realidade audiovisual é o que fazemos todos os dias. 🎬

Da captação à entrega final, cada detalhe é pensado para contar a sua história da forma mais impactante.

💡 Quer elevar o nível do seu conteúdo?

📩 Fale conosco!

#Produção #Audiovisual #Criativo #Conteúdo #Marketing`:s.includes("roteiro")?`🎬 **Roteiro 60s – Apresentação de Empresa:**

**[0–5s]** Hook: "E se eu te dissesse que sua marca pode ser vista por milhares de pessoas todos os dias?"

**[5–20s]** Problema: "A maioria das empresas não sabe como produzir conteúdo de qualidade de forma consistente."

**[20–40s]** Solução: "A INOVA Co. faz isso por você. Planejamos, gravamos, editamos e entregamos tudo no prazo."

**[40–55s]** Prova social: "Mais de 30 clientes já transformaram sua presença digital conosco."

**[55–60s]** CTA: "Clique no link e agende sua consultoria gratuita!"`:s.includes("ideia")||s.includes("conteúdo")?`💡 **5 Ideias de Conteúdo:**

1. 🎭 **Bastidores** – Mostre o processo de criação dos seus produtos
2. 📊 **Antes/Depois** – Transformações do seu negócio
3. 🗣️ **Depoimento de cliente** – Histórias reais geram confiança
4. 🎓 **Tutorial/Dica** – Ensine algo relacionado ao seu nicho
5. 📅 **Rotina da equipe** – Humanize sua marca`:s.includes("email")||s.includes("proposta")?`📧 **Email de Proposta Comercial:**

Assunto: Proposta de Produção de Conteúdo – [Nome da Empresa]

Olá, [Nome]!

Foi um prazer a nossa conversa. Segue a proposta que elaboramos especialmente para a [Empresa].

**O que incluímos:**
• X vídeos/mês de alta qualidade
• Planejamento estratégico de conteúdo
• Edição profissional com identidade visual
• Relatório mensal de resultados

**Investimento:** R$ X.XXX/mês

Estamos à disposição para alinhar detalhes. Quando posso agendar uma apresentação?

Abraços,
Equipe INOVA Co.`:`🤖 Entendi sua pergunta sobre: "${e}"

Como sua assistente de criação de conteúdo, posso ajudar com:

• ✍️ Roteiros e scripts
• 📱 Legendas para redes sociais
• 📊 Estratégias de conteúdo
• 📧 Emails e propostas comerciais
• 💡 Brainstorm de ideias

Faça uma pergunta mais específica para eu criar o conteúdo perfeito para você!`},p=async e=>{const s=e||c.trim();if(!s||m)return;x("");const t={id:crypto.randomUUID(),role:"user",content:s};l(o=>[...o,t]),f(!0);const i=await w(s);l(o=>[...o,{id:crypto.randomUUID(),role:"assistant",content:i}]),f(!1)},E=(e,s)=>{navigator.clipboard.writeText(s),g(e),setTimeout(()=>g(null),2e3)};return a.jsxs("div",{className:"flex flex-col h-[calc(100vh-8rem)] space-y-0",children:[a.jsxs("div",{className:"flex items-center justify-between mb-4",children:[a.jsxs("div",{children:[a.jsxs("h1",{className:"text-2xl font-bold text-foreground flex items-center gap-2",children:[a.jsx(S,{className:"h-6 w-6 text-primary"})," Nova Assistente ",a.jsx(A,{className:"bg-primary/10 text-primary border-primary/30 text-xs",children:"IA"})]}),a.jsx("p",{className:"text-muted-foreground text-sm mt-1",children:"Sua assistente criativa para conteúdo e comunicação"})]}),a.jsxs(b,{variant:"outline",size:"sm",onClick:()=>l([{id:"0",role:"assistant",content:N.default}]),className:"flex items-center gap-2",children:[a.jsx(I,{className:"h-3.5 w-3.5"})," Nova conversa"]})]}),a.jsxs("div",{className:"flex-1 rounded-xl border border-border bg-card overflow-hidden flex flex-col",children:[a.jsxs("div",{className:"flex-1 overflow-y-auto p-4 space-y-4",children:[d.map(e=>a.jsxs("div",{className:n("flex gap-3",e.role==="user"&&"flex-row-reverse"),children:[a.jsx("div",{className:n("h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm",e.role==="assistant"?"bg-primary/20 text-primary":"bg-secondary text-foreground"),children:e.role==="assistant"?a.jsx(j,{className:"h-4 w-4"}):"👤"}),a.jsx("div",{className:n("max-w-[75%] group",e.role==="user"&&"items-end flex flex-col"),children:a.jsxs("div",{className:n("px-4 py-3 rounded-xl text-sm whitespace-pre-line leading-relaxed relative",e.role==="assistant"?"bg-secondary text-foreground rounded-tl-sm":"bg-primary text-primary-foreground rounded-tr-sm"),children:[e.content,e.role==="assistant"&&a.jsx("button",{onClick:()=>E(e.id,e.content),className:"absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/10",children:C===e.id?a.jsx(R,{className:"h-3.5 w-3.5 text-primary"}):a.jsx(P,{className:"h-3.5 w-3.5 text-muted-foreground"})})]})})]},e.id)),m&&a.jsxs("div",{className:"flex gap-3",children:[a.jsx("div",{className:"h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0",children:a.jsx(j,{className:"h-4 w-4 text-primary animate-pulse"})}),a.jsxs("div",{className:"bg-secondary rounded-xl px-4 py-3 flex items-center gap-1",children:[a.jsx("span",{className:"h-2 w-2 rounded-full bg-primary animate-bounce",style:{animationDelay:"0ms"}}),a.jsx("span",{className:"h-2 w-2 rounded-full bg-primary animate-bounce",style:{animationDelay:"150ms"}}),a.jsx("span",{className:"h-2 w-2 rounded-full bg-primary animate-bounce",style:{animationDelay:"300ms"}})]})]}),a.jsx("div",{ref:h})]}),d.length<=1&&a.jsx("div",{className:"px-4 pb-2 flex gap-2 overflow-x-auto",children:O.map((e,s)=>a.jsx("button",{onClick:()=>p(e),className:"flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors bg-card",children:e},s))}),a.jsxs("div",{className:"p-3 border-t border-border flex gap-2",children:[a.jsx(k,{value:c,onChange:e=>x(e.target.value),onKeyDown:e=>{e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),p())},placeholder:"Peça um roteiro, legenda, ideia de conteúdo... (Enter para enviar)",className:"flex-1 min-h-[52px] max-h-32 resize-none"}),a.jsx(b,{onClick:()=>p(),disabled:m||!c.trim(),size:"icon",className:"self-end h-10 w-10",children:a.jsx(D,{className:"h-4 w-4"})})]})]})]})}export{$ as default};
