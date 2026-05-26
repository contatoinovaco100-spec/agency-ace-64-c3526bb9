## Objetivo
Garantir que, ao assinar um contrato, o cliente apareça automaticamente na aba **Clientes** em tempo real, com `email`, `escopo` e `valor mensal` corretamente preenchidos.

## Diagnóstico

**1. Mapeamento (já correto na edge function `notify-contract-signed`)**
A criação automática já mapeia:
- `contract.client_email` → `clients.email`
- `contract.scope_description` (com fallback para `contract.services`) → `clients.scope`
- `contract.monthly_value` → `clients.monthly_value`
- `contract.client_name` → `clients.company_name`
- `signer_name` → `clients.contact_name`
- `contract_start_date` = data atual
- `status` = `Ativo`

→ Vou apenas reforçar: usar `contract.scope_description` quando existir, senão `contract.services`, e nunca string vazia para `scope` se houver `plan_name` (adicionar plano como fallback adicional).

**2. Tempo real (faltando)**
`ClientsPage` consome `clients` de `AgencyContext`, que faz um `fetchAll()` apenas uma vez no mount. Não há subscription no canal realtime do Postgres para a tabela `clients`. Por isso, o cliente recém-criado pela edge function só aparece após refresh manual.

## Mudanças

### a) Banco (migration)
Adicionar a tabela `clients` à publicação realtime:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER TABLE public.clients REPLICA IDENTITY FULL;
```

### b) `src/contexts/AgencyContext.tsx`
Adicionar um `useEffect` que cria um channel Supabase escutando `postgres_changes` (`event: '*'`, `schema: 'public'`, `table: 'clients'`):
- `INSERT` → `setAllClients(prev => [...prev, rowToClient(payload.new)])` (com deduplicação por `id`)
- `UPDATE` → substituir item pelo id
- `DELETE` → remover por id
- Cleanup: `supabase.removeChannel(channel)`

### c) `supabase/functions/notify-contract-signed/index.ts`
Pequeno ajuste no fallback do campo `scope` para incluir o `plan_name`:
```ts
scope: contract.scope_description 
  || contract.services 
  || (contract.plan_name ? `Plano ${contract.plan_name}` : ''),
```
E garantir que números venham como `Number(...)` (já está).

## Resultado esperado
- Ao assinar um contrato em `/contract/sign/:id`, a edge function cria o cliente.
- A aba **Clientes** recebe o evento realtime e o cliente novo aparece instantaneamente, com email, escopo e valor mensal corretamente preenchidos.
