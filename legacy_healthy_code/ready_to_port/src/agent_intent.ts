export function isLikelyAgentInstruction(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  if (/^!/.test(t)) return true;
  if (/\bdaqui\s+a\s+\d{1,4}\s*(min|mins|minuto|minutos)\b/i.test(t)) return true;
  if (/^\s*(as|às)\s+\d{1,2}:\d{2}\b/i.test(t)) return true;
  if (/\bw\d{1,2}y\d{4}\b/i.test(t)) return true;
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(t)) return true;
  if (/\b\d{1,2}:\d{2}\b/.test(t) && /\b(amanh[ãa]|hoje|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)\b/i.test(t)) {
    return true;
  }
  return /\b(agenda|agendar|agendamento|agendamentos|lembrete|lembrar|lembra|recorda|recordar|remind|reminder|schedule|cria|criar|adiciona|adicionar|muda|mudar|altera|alterar|corrige|corrigir|reorganiza|reorganizar|move|mover|apaga|apagar|remove|remover|ativa|ativar|desativa|desativar|editar|edita|update|delete|enable|disable|semana|semanas|evento|eventos)\b/i.test(
    t
  );
}
