# Backend App

Composition root do backend novo.

Aqui devem viver:

- `main.ts`
- bootstrap
- wiring de modulos
- arranque e shutdown

Aqui nao deve viver:

- regras de negocio
- logica de dominio
- detalhes concretos espalhados de integrações
- responsabilidades host-level como deep sleep, autostart ou ownership do OAuth live
