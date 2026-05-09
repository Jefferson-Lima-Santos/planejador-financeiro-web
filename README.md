# Planejador Financeiro Web

Aplicacao web para controle financeiro mensal, feita em Next.js, MUI e Supabase.

O objetivo do projeto e permitir que o usuario acompanhe receitas, gastos por tema, saldo mensal, itens recorrentes e historico de alteracoes sem perder rastreabilidade.

## Stack

- Next.js com Pages Router
- React
- TypeScript
- MUI
- Supabase Auth
- Supabase Postgres
- Row Level Security por usuario
- Auditoria via triggers no banco

## Funcionalidades

- Login e cadastro com Supabase Auth.
- Troca de idioma entre Portugues e Ingles.
- Dashboard mensal abrindo no mes atual.
- Navegacao entre meses anteriores e futuros.
- Receitas multiplas por mes, como salario, bonus, renda extra e reembolso.
- Gastos agrupados por temas financeiros.
- Temas iniciais:
  - Gastos fixos
  - Cartao de credito
  - Educacao
  - Gastos excepcionais
  - Poupanca para o futuro
  - Gastos livres
- Lancamentos ativos e cancelados.
- Soft delete para manter historico de itens cancelados.
- Restauracao de itens cancelados.
- Motivo opcional em alteracoes e cancelamentos.
- Registro de auditoria com valores antigos e novos.
- Itens recorrentes com data final ou sem data final.
- Mascara de valores em reais nos campos monetarios.
- Campos de formulario padronizados com MUI.

## Como O Modelo Funciona

O mes financeiro fica em `budget_months`.

As receitas ficam em `monthly_income_entries`.

Os gastos ficam em `monthly_theme_entries`.

Os temas ficam em `budget_themes`.

As recorrencias ficam em `recurring_entries`.

O total de receita do mes e calculado pela soma das receitas ativas.

O total de cada tema e calculado pela soma dos gastos ativos daquele tema.

O saldo mensal e:

```text
receitas ativas - gastos ativos
```

Itens com `deleted_at` preenchido continuam no banco, mas nao entram nos totais.

## Rodando Localmente

Instale as dependencias:

```bash
npm install
```

Crie o arquivo de ambiente:

```bash
cp .env.example .env.local
```

Preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

Rode o projeto:

```bash
npm run dev -- --port 3000
```

Acesse:

```text
http://localhost:3000
```

## Configurando O Supabase

No Supabase, crie um projeto e configure:

1. `Authentication > Sign In / Providers`
2. Ative o provider de Email.
3. Em desenvolvimento, voce pode desativar confirmacao obrigatoria de e-mail.
4. Va em `Authentication > URL Configuration`.
5. Configure:

```text
Site URL:
http://localhost:3000

Redirect URLs:
http://localhost:3000/**
```

Depois copie as credenciais em `Project Settings > API Keys`:

- Project URL
- anon/public key

## Banco De Dados

Para um banco novo, execute:

```text
supabase/schema.sql
```

No Supabase:

```text
SQL Editor > New query > cole o conteudo > Run
```

Esse arquivo cria:

- `profiles`
- `budget_months`
- `budget_themes`
- `monthly_income_entries`
- `monthly_theme_entries`
- `recurring_entries`
- `goals`
- `audit_logs`
- policies RLS
- triggers de auditoria
- seeds dos temas financeiros

## Patches SQL

Se o banco ja existia antes das ultimas alteracoes, rode os patches conforme necessario:

```text
supabase/fix-rls-auth.sql
supabase/add-income-entries.sql
supabase/add-recurring-and-audit-reasons.sql
```

Ordem recomendada para bases antigas:

1. `fix-rls-auth.sql`
2. `add-income-entries.sql`
3. `add-recurring-and-audit-reasons.sql`

Para um banco zerado, apenas `schema.sql` deve bastar.

## Recorrencias

Receitas e gastos podem ser marcados como recorrentes.

Ao criar um item recorrente, o sistema salva uma regra em `recurring_entries`.

Quando o usuario acessa outro mes, o sistema verifica as regras aplicaveis e cria automaticamente o lancamento daquele mes se ele ainda nao existir.

A recorrencia pode ter:

- Data final definida.
- Sem data final.

## Auditoria

Alteracoes relevantes ficam registradas em `audit_logs`.

A auditoria guarda:

- Usuario
- Tabela alterada
- ID do registro
- Acao
- Motivo opcional
- Valores anteriores
- Valores novos
- Data da alteracao

Exclusoes visuais usam soft delete. O registro permanece salvo e pode ser restaurado.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Validacao Antes De Subir Alteracoes

Fluxo recomendado:

```bash
npm run lint
npm run build
npm audit --omit=dev
```

No Windows, se o `next build` falhar com erro de permissao em `.next/trace`, pare o dev server local e rode o build novamente.
