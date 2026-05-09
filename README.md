# Planejador Financeiro Web

Front-end em Next.js com MUI e Supabase Auth para controle financeiro mensal.

## Stack

- Next.js com Pages Router
- React
- MUI
- Supabase Auth
- Supabase Postgres com RLS

## Rodando localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Preencha o `.env.local` com:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

## Banco no Supabase

Execute o arquivo `supabase/schema.sql` no SQL Editor do Supabase.

Ele cria:

- `profiles`, conectado ao `auth.users`
- `budget_months`
- `budget_themes`
- `monthly_theme_entries`
- `goals`
- `audit_logs`
- RLS por usuario
- Soft delete em lancamentos
- Auditoria automatica por trigger
- Seeds dos seis temas financeiros

## Fluxo principal

1. Usuario autentica via Supabase Auth.
2. Dashboard abre no mes atual.
3. Sistema cria o mes financeiro caso ele ainda nao exista.
4. Usuario informa salario do mes.
5. Cards de temas exibem totais calculados por lancamentos ativos.
6. Clique em um tema abre a gaveta com lancamentos.
7. Editar altera o lancamento.
8. Cancelar aplica soft delete e mantem o item no historico.
9. Restaurar remove o soft delete.
