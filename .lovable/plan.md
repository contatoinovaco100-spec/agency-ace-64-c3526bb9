## O que eu não consigo fazer

Não tenho acesso ao painel de desenvolvedores da Meta — o cadastro do URI de redirecionamento precisa ser feito por você (leva 1 minuto):

1. developers.facebook.com > seu app (ID `2235928767163276`) > Login do Facebook > Configurações
2. Em "URIs de redirecionamento do OAuth válidos", adicionar exatamente:
   `https://inovamarketing.online/redes-sociais`
3. Salvar alterações.


## Problema encontrado no código

Hoje a página `/redes-sociais` monta o redirect com `window.location.origin`. Isso significa que, no preview do editor ou no domínio `.lovable.app`, o URI enviado à Meta é diferente do cadastrado e o login falha com "URL bloqueada / redirect_uri mismatch". Só funcionaria no domínio principal.

## O que vou implementar

1. **Redirect URI canônico fixo**: usar sempre `https://inovamarketing.online/redes-sociais` para Instagram, independentemente de onde a plataforma está aberta. Assim só existe 1 URI para cadastrar na Meta.
2. **Aviso quando fora do domínio oficial**: se o usuário abrir `/redes-sociais` no preview, mostrar um alerta explicando que a conexão precisa ser feita pelo domínio oficial (o retorno do OAuth cai lá).
3. **Retorno do OAuth mais robusto**: ler `code`, `state` e também `error`/`error_description` da URL; se a Meta devolver erro, exibir a mensagem real em vez de falhar em silêncio, e limpar os parâmetros da URL após processar.
4. **Mensagens de erro reais do Graph**: propagar o texto de erro da Meta (ex.: escopo faltando, app em modo de desenvolvimento, conta sem Instagram Business vinculado) para o toast, em vez de "Nenhuma conta encontrada".
5. **Validação do fluxo**: depois que você salvar o URI na Meta, eu testo a função `social-oauth` (geração da URL de autorização e leitura dos logs do retorno) e confirmo se as contas são gravadas corretamente. O clique final de autorização na tela da Meta precisa ser feito por você, já que exige sua sessão Facebook.

## Detalhes técnicos

- `src/pages/SocialAccountsPage.tsx`: constante `CANONICAL_ORIGIN`, tratamento de `error` no callback, `window.history.replaceState` para limpar a query.
- `supabase/functions/social-oauth/index.ts`: retornar detalhe do erro na ação `connect`.
- `supabase/functions/_shared/platforms/instagram.ts`: mensagem específica quando `/me/accounts` não retorna nenhuma página com `instagram_business_account`.
- Requisitos do lado da Meta para publicar: app com Login do Facebook ativo, conta Instagram do tipo Business/Creator vinculada a uma Página, e o usuário como testador/admin enquanto o app estiver em modo de desenvolvimento.
