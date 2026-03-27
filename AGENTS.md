# AGENTS.md

Ponto de entrada para qualquer agente/LLM que trabalhe neste novo projeto.

## Ordem de leitura obrigatoria

1. `/home/eliaspc/Documentos/lume-hub/README.md`
2. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_rewrite_master_prompt.md`
3. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_modular_implementation_spec.md`
4. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_implementation_waves.md`
5. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_gap_audit.md`
6. `/home/eliaspc/Documentos/lume-hub/docs/deployment/lume_hub_lxd_runtime_plan.md`
7. `/home/eliaspc/Documentos/lume-hub/runtime/lxd/README.md`

## Regras rapidas

- O codigo novo vive em `source/`.
- Nao desenvolver diretamente dentro de `runtime/`.
- `runtime/` e destino operacional de build/publicacao, nao fonte de verdade.
- `legacy_healthy_code/` ficou reduzida a referencia residual, nao arquitetura canonica.
- consultar `legacy_healthy_code/reference_engines/` apenas quando o comportamento ainda nao estiver portado nem explicado no codigo novo
- Se um modulo atual for aproveitado, deve ser portado para a estrutura modular nova em vez de ser simplesmente colado para dentro do backend.
- O sistema deve nascer modular, com `apps/`, `foundation/`, `adapters/`, `modules/` e `ui-modules/`.
- O bootstrap tem de continuar fino; a logica de negocio nao deve voltar a acumular-se em `server.ts` ou equivalente.
- O OAuth Codex deve sair do host em `/home/eliaspc/.codex/auth.json` e aparecer no runtime em `/codex/auth.json`.
- O ficheiro OAuth live gerido pelo projeto e o mesmo que o Codex usa.
- Se existirem contas secundarias, o roteamento deve ser feito por um modulo tipo `codex_auth_router`, nunca por hacks dispersos.
- O conceito de semana ISO deve ser de primeira classe no dominio.
- A fonte canonica dos schedules deve ser por grupo.
- Dentro de cada grupo, o calendario canonico deve ser mensal.
- `week_id` ISO continua obrigatorio dentro dos registos e para operacao.
- O sistema deve suportar numero variavel de avisos por evento.
- O default de avisos do sistema e `24h antes` e `30 min antes`, com suporte a horarios fixos.
- Os estados visiveis do envio devem ser `pending`, `waiting_confirmation` e `sent`.
- Nao reinstalar `LXD` automaticamente neste host; o host teve `lxd` removido de proposito. So preparar estrutura e instrucoes, salvo pedido explicito do utilizador.
- Qualquer deploy futuro em `LXD` deve tratar `source/` e `runtime/` como camadas separadas.
- Deep sleep/wake lock do PC e responsabilidade do produto, num modulo proprio.
- Persistencia de arranque no PC e responsabilidade do produto, num modulo proprio.
- Quando estas responsabilidades forem host-level, elas devem viver preferencialmente no deployable `lume-hub-host`.

## Regras de implementacao

- Cada modulo deve ter a sua propria sub-pasta.
- Preferir POO com contratos e factories.
- Dependencias externas devem entrar por adapters locais.
- O app backend deve ser composicao de modulos, nao o lugar onde a logica mora.
- O `lume-hub-host` deve concentrar integracoes locais com o PC.
- Se um modulo puder ser desenvolvido em paralelo, manter API publica minima e clara.
- Sempre que o projeto abrir uma nova ronda de waves, essa ronda deve terminar com uma wave final de limpeza.
- Essa wave final de limpeza existe para:
  - remover stubs e scaffolds que tenham ficado supersedidos
  - apagar documentacao obsoleta
  - retirar artefactos, helpers e codigo morto que ja nao acrescentem valor
  - garantir que o repositorio fecha cada ronda mais limpo do que abriu

## Regras sobre o legado

- `legacy_healthy_code/reference_engines/` contem o pouco legado que ainda vale como consulta.
- esse legado deve ser usado apenas para perceber comportamento, nunca como base literal do runtime novo.
- se um comportamento nao estiver vivo no codigo novo, preferir a arquitetura atual e o `gap_audit` antes de tentar ressuscitar o desenho antigo.

## Preferencias operacionais

- Se o projeto vier a ser inicializado como Git, manter a disciplina de `commit` e `push` no fim de alteracoes validadas, salvo instrucao em contrario.
- Quando houver duvida entre copiar comportamento antigo e seguir a arquitetura nova, a arquitetura nova ganha.
