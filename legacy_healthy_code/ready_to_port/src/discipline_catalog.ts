export type CourseChannel = {
  id: "ufcd_programacao" | "uc_ciberseguranca";
  label: string;
  jid: string;
  preferredSubject: string;
};

export type DisciplineCatalogEntry = {
  code: string;
  name: string;
  courseId: CourseChannel["id"];
  courseLabel: string;
  jid: string;
};

const COURSE_BY_ID: Record<CourseChannel["id"], CourseChannel> = {
  ufcd_programacao: {
    id: "ufcd_programacao",
    label: "UFCD - Programacao",
    jid: "120363402446203704@g.us",
    preferredSubject: "EFA Programador/a de Informatica"
  },
  uc_ciberseguranca: {
    id: "uc_ciberseguranca",
    label: "UC - Ciberseguranca",
    jid: "120363407086801381@g.us",
    preferredSubject: "CET Ciberseguranca"
  }
};

export const COURSE_CHANNELS: CourseChannel[] = [COURSE_BY_ID.ufcd_programacao, COURSE_BY_ID.uc_ciberseguranca];

function uc(codeDigits: string, name: string): DisciplineCatalogEntry {
  const c = COURSE_BY_ID.uc_ciberseguranca;
  return { code: `UC${codeDigits}`, name, courseId: c.id, courseLabel: c.label, jid: c.jid };
}

function ufcd(codeDigits: string, name: string): DisciplineCatalogEntry {
  const c = COURSE_BY_ID.ufcd_programacao;
  return { code: `UFCD${codeDigits}`, name, courseId: c.id, courseLabel: c.label, jid: c.jid };
}

export const DISCIPLINE_CATALOG: DisciplineCatalogEntry[] = [
  uc("00245", "Desenvolver algoritmos"),
  uc("00606", "Desenvolver programas em linguagem estruturada"),
  uc("00602", "Modelar bases de dados relacionais"),
  uc("00598", "Efetuar operacoes e calculos matematicos aplicados a projetos da area de informatica"),
  uc("01477", "Aplicar metodos estatisticos"),
  uc("00631", "Planear e instalar a infraestrutura de redes locais"),
  uc("01478", "Configurar redes de computadores"),
  uc("00635", "Configurar servicos de rede"),
  uc("00634", "Instalar, configurar e manter sistema operativo de cliente"),
  uc("00633", "Instalar e parametrizar sistemas operativos de servidor"),
  uc("01479", "Implementar mecanismos de protecao contra ameacas ciberneticas"),
  uc("01484", "Detetar e analisar vulnerabilidades em sistemas de rede"),
  uc("01486", "Gerir sistemas de detecao de intrusos (IDS)"),
  uc("00613", "Gerir politicas de seguranca em sistemas informaticos"),
  uc("01488", "Gerir a seguranca da informacao e criptografia"),
  uc("01476", "Implementar a legislacao relativa a ciberseguranca"),
  uc("01481", "Desenvolver scripts aplicados a ciberseguranca"),
  uc("01482", "Programar scripts de normalizacao e filtragem de logs"),
  uc("01485", "Instalar e configurar ferramentas de analise e recolha de logs e evidencias"),
  uc("01480", "Analisar evidencias de ataques ciberneticos"),
  uc("01483", "Detetar e analisar vulnerabilidades em solucoes web"),
  uc("01487", "Simular cenarios de ciberseguranca e ciberdefesa (wargamming)"),
  uc("00033", "Comunicar e interagir em contexto profissional"),
  uc("00034", "Colaborar e trabalhar em equipa"),
  uc("00616", "Implementar as normas de seguranca e saude no trabalho"),
  uc("00599", "Interagir em ingles nas atividades do setor da informatica"),

  ufcd("0769", "Arquitetura interna do computador"),
  ufcd("0770", "Dispositivos e perifericos"),
  ufcd("0771", "Conexoes de rede"),
  ufcd("0797", "Sistemas operativos - tipologias"),
  ufcd("0798", "Utilitarios"),
  ufcd("0799", "Sistemas de rede local"),
  ufcd("0800", "Servicos adicionais de rede"),
  ufcd("0801", "Administracao de redes locais"),
  ufcd("0802", "Processamento computacional"),
  ufcd("7846", "Informatica - nocoes basicas"),
  ufcd("0804", "Algoritmos"),
  ufcd("0805", "Estruturas de dados"),
  ufcd("0806", "Principios metodologicos de programacao"),
  ufcd("0809", "Programacao em C/C++ - fundamentos"),
  ufcd("0810", "Programacao em C/C++ - avancada"),
  ufcd("0811", "Analise de sistemas"),
  ufcd("10788", "Fundamentos da linguagem SQL"),
  ufcd("3933", "Administracao de bases de dados para programadores"),
  ufcd("0816", "Programacao de sistemas distribuidos - JAVA"),
  ufcd("10791", "Desenvolvimento de aplicacoes web em JAVA"),
  ufcd("3935", "Programacao em C#"),
  ufcd("10792", "Programacao ASP.Net Core MVC"),
  ufcd("10793", "Fundamentos de Python"),
  ufcd("10794", "Programacao avancada com Python"),
  ufcd("10795", "Seguranca no desenvolvimento de software"),
  ufcd("10790", "Projeto de programacao"),
  ufcd("10789", "Metodologias de desenvolvimento de software"),
  ufcd("10871", "Introducao a administracao de sistemas"),
  ufcd("10872", "Administracao de sistemas"),
  ufcd("10672", "Introducao a utilizacao e protecao dos dados pessoais")
];

const DISCIPLINE_BY_CODE = new Map(DISCIPLINE_CATALOG.map((x) => [x.code, x]));

function normalizeToken(s: string): string {
  return String(s ?? "")
    .toUpperCase()
    .replace(/[\s_:/-]+/g, "");
}

function canonicalizeExplicit(raw: string): string | null {
  const n = normalizeToken(raw);
  if (!n) return null;

  if (n.startsWith("UFCD")) {
    const digits = n.slice(4).replace(/\D+/g, "");
    if (!digits) return null;
    const code = `UFCD${digits}`;
    return DISCIPLINE_BY_CODE.has(code) ? code : null;
  }

  if (n.startsWith("UC")) {
    const digits = n.slice(2).replace(/\D+/g, "");
    if (!digits) return null;
    const code = `UC${digits.padStart(5, "0")}`;
    return DISCIPLINE_BY_CODE.has(code) ? code : null;
  }

  return null;
}

function byBareDigits(raw: string): DisciplineCatalogEntry | null {
  const digits = String(raw ?? "").trim().replace(/\D+/g, "");
  if (!digits || (digits.length !== 4 && digits.length !== 5)) return null;
  const matches = DISCIPLINE_CATALOG.filter((x) => x.code.endsWith(digits));
  if (matches.length === 1) return matches[0];
  return null;
}

export function findDisciplineCatalogEntry(
  text: string,
  opts?: {
    allowBareNumeric?: boolean;
  }
): DisciplineCatalogEntry | null {
  const src = String(text ?? "").trim();
  if (!src) return null;

  const explicit = canonicalizeExplicit(src);
  if (explicit) return DISCIPLINE_BY_CODE.get(explicit) ?? null;

  const re = /\b(UFCD\s*[-: ]?\s*\d{4,5}|UC\s*[-: ]?\s*\d{1,5})\b/gi;
  let m: RegExpExecArray | null = re.exec(src);
  while (m) {
    const c = canonicalizeExplicit(m[1]);
    if (c) return DISCIPLINE_BY_CODE.get(c) ?? null;
    m = re.exec(src);
  }

  if (opts?.allowBareNumeric) return byBareDigits(src);
  return null;
}

export function buildLlmDisciplineCatalogContext() {
  const courses = COURSE_CHANNELS.map((x) => ({ label: x.label, jid: x.jid, preferredSubject: x.preferredSubject }));
  const items = DISCIPLINE_CATALOG.map((x) => ({
    code: x.code,
    name: x.name,
    course: x.courseLabel,
    jid: x.jid
  }));
  return { courses, items };
}
