# System Power Module

Modulo responsavel por impedir deep sleep quando o sistema precisa de continuar operacional.

## Escopo

- wake lock / sleep inhibitor
- politica persistente de energia
- integracao com GUI para ativar/desativar

## Nota

Se o core app correr em `LXD`, a execucao concreta desta responsabilidade deve acontecer via `lume-hub-host`.

## Contrato host

No host Linux, o bloqueio de suspensao/hibernacao e real e segue o contrato operacional importado do WA-Notify:

```bash
/usr/bin/systemd-inhibit --what=sleep --mode=block --why=Keep-LumeHub-online <keep-alive>
```

O ficheiro de estado em `runtime/host/state/sleep-inhibitor.json` e apenas evidencia persistente do processo ativo. Nao deve ser tratado como substituto do inibidor real.
