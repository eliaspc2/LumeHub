# Group Files Persistence Adapter

Adapter canonico de persistencia para os schedules do projeto novo.

## Responsabilidade

- ler e escrever workspaces por grupo
- manter calendario mensal canonico por grupo
- manter `weekId` ISO dentro dos registos
- garantir escrita atomica e locking
- expor repositorios disciplinados ao dominio

## Regra

Este adapter substitui a ideia de BD canonica para os schedules.
O desenho escolhido e:

- canonico por grupo
- mensal dentro de cada grupo
- semanal apenas como projection/indice operacional

Se existir algum indice auxiliar no futuro, ele nunca substitui estes ficheiros como fonte de verdade.
