-- Seed minimo para base ja existente.
-- Cria apenas os temas iniciais (nao duplica se ja existir um tema ativo com o mesmo nome).

insert into public.budget_themes
  (name, description, default_percentage_bp, sort_order)
select *
from (
  values
    ('Gastos fixos', 'Aluguel, internet, luz, agua, gas, alimentacao etc', 3500, 1),
    ('Cartao de credito', 'Compras, parcelas e despesas pagas no cartao', 2000, 2),
    ('Educacao', 'Cursos, faculdade, pos-graduacao, idiomas etc', 1000, 3),
    ('Gastos excepcionais', 'Despesas fora do orcamento fixo', 1500, 4),
    ('Poupanca para o futuro', 'Dinheiro guardado ou investido', 1000, 5),
    ('Gastos livres', 'Demais gastos pessoais', 1000, 6)
) as seed(name, description, default_percentage_bp, sort_order)
where not exists (
  select 1
  from public.budget_themes existing
  where lower(existing.name) = lower(seed.name)
    and existing.deleted_at is null
);
