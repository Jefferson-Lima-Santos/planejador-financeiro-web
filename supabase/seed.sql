-- Seed minimo para base ja existente.
-- Cria apenas os temas iniciais (nao duplica se ja existir um tema ativo com o mesmo nome).

insert into public.budget_themes
  (name, description, default_percentage_bp, target_behavior, sort_order)
select *
from (
  values
    ('Gastos fixos', 'Aluguel, internet, luz, agua, gas, alimentacao etc', 3500, 'expense_limit', 1),
    ('Cartao de credito', 'Compras, parcelas e despesas pagas no cartao', 2000, 'expense_limit', 2),
    ('Educacao', 'Cursos, faculdade, pos-graduacao, idiomas etc', 1000, 'expense_limit', 3),
    ('Gastos excepcionais', 'Despesas fora do orcamento fixo', 1500, 'expense_limit', 4),
    ('Poupanca para o futuro', 'Dinheiro guardado ou investido', 1000, 'saving_goal', 5),
    ('Gastos livres', 'Demais gastos pessoais', 1000, 'expense_limit', 6)
) as seed(name, description, default_percentage_bp, target_behavior, sort_order)
where not exists (
  select 1
  from public.budget_themes existing
  where lower(existing.name) = lower(seed.name)
    and existing.deleted_at is null
);

update public.budget_themes
set target_behavior = 'saving_goal'
where lower(name) = lower('Poupanca para o futuro');
