# Lume Hub LLM Kickoff Prompt

Usa este prompt para por outra LLM a trabalhar no projeto novo.

```text
Trabalha no projeto /home/eliaspc/Documentos/lume-hub.

Antes de mexer em codigo, le obrigatoriamente:
1. /home/eliaspc/Documentos/lume-hub/AGENTS.md
2. /home/eliaspc/Documentos/lume-hub/README.md
3. /home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_rewrite_master_prompt.md
4. /home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_modular_implementation_spec.md
5. /home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_implementation_waves.md

Regras obrigatorias:
- implementar em /home/eliaspc/Documentos/lume-hub/source
- nao desenvolver dentro de runtime/
- tratar runtime/ como destino de build/publicacao
- seguir as waves por ordem
- atualizar docs locais quando fizeres mudancas estruturais
- validar no fim de cada wave

Decisoes ja fechadas:
- dois deployables: lume-hub-backend e lume-hub-host
- o projeto gere o mesmo /home/eliaspc/.codex/auth.json usado pelo Codex
- schedules canonicos em pastas por grupo com calendario mensal
- `week_id` ISO continua obrigatorio dentro dos registos
- avisos variaveis por evento
- defaults de aviso: 24h antes e 30 min antes
- estados visiveis: pending, waiting_confirmation, sent
- watchdog baseado em atraso em minutos sobre sendAt
- o sistema deve escalar para muitos grupos, sem assumir um conjunto pequeno fixo
- uma pessoa/remetente pode mapear para `N` grupos destino com fan-out controlado
- a idempotencia de distribuicao deve distinguir `mensagem origem + grupo destino`
- o sistema deve distinguir `app owner` e `group owner`
- o calendario deve ter ACL explicita com niveis `group`, `group_owner` e `app_owner`
- os modos canonicos de ACL do calendario devem ser `read` e `read_write`

Tarefa inicial:
- implementa a Wave 0 completa
- depois implementa a Wave 1
- para no fim da Wave 1 e resume exatamente:
  - o que ficou feito
  - que ficheiros criaste/alteraste
  - como validar
  - o que falta para a Wave 2
```
