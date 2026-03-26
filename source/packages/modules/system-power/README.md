# System Power Module

Modulo responsavel por impedir deep sleep quando o sistema precisa de continuar operacional.

## Escopo

- wake lock / sleep inhibitor
- politica persistente de energia
- integracao com GUI para ativar/desativar

## Nota

Se o core app correr em `LXD`, a execucao concreta desta responsabilidade deve acontecer via `lume-hub-host`.
