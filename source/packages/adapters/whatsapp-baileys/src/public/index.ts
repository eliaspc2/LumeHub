export interface WhatsappBaileysAdapterConfig {
  readonly enabled?: boolean;
}

export class WhatsappBaileysAdapter {
  constructor(readonly config: WhatsappBaileysAdapterConfig = {}) {}

  describe(): Readonly<Record<string, unknown>> {
    return {
      adapter: 'whatsapp-baileys',
      enabled: this.config.enabled ?? true,
    };
  }
}
