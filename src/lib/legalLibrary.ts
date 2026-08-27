export interface LegalAuthority {
  id: string;
  source: string;
  provision: string;
  rule: string;
  useWhen: string[];
  url: string;
}

export const TRAFFIC_LEGAL_LIBRARY: LegalAuthority[] = [
  {
    id: "CP-23",
    source: "Constitución Política de Colombia",
    provision: "Artículo 23",
    rule: "Derecho fundamental de petición y deber de obtener pronta resolución.",
    useWhen: ["derecho de petición", "solicitud de expediente", "solicitud de respuesta de fondo"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4125",
  },
  {
    id: "CP-29",
    source: "Constitución Política de Colombia",
    provision: "Artículo 29",
    rule: "Debido proceso aplicable a actuaciones administrativas, con garantías de defensa, contradicción y prueba.",
    useWhen: ["notificación", "defensa", "prueba", "actuación sancionatoria", "debido proceso"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4125",
  },
  {
    id: "L769-159",
    source: "Ley 769 de 2002",
    provision: "Artículo 159",
    rule: "Regula la ejecución de las sanciones de tránsito y la prescripción allí prevista; el cómputo y sus efectos deben confrontarse con las actuaciones acreditadas en el expediente.",
    useWhen: ["prescripción", "cobro", "ejecución de multa"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=5557",
  },
  {
    id: "L769-161",
    source: "Ley 769 de 2002",
    provision: "Artículo 161",
    rule: "La acción por contravención caduca al año desde los hechos; dentro de ese término debe decidirse sobre la imposición de la sanción. No debe invocarse automáticamente cuando la información ya evidencia una actuación sancionatoria culminada.",
    useWhen: ["caducidad", "comparendo sin sanción acreditada"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=5557",
  },
  {
    id: "L769-136",
    source: "Ley 769 de 2002",
    provision: "Artículo 136",
    rule: "Regula la actuación posterior al comparendo cuando la infracción es aceptada o controvertida y contempla audiencia pública cuando se rechaza la comisión de la infracción.",
    useWhen: ["audiencia", "sanción", "comparendo", "defensa"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=5557",
  },
  {
    id: "L769-137",
    source: "Ley 769 de 2002",
    provision: "Artículo 137",
    rule: "Regula la información y comunicación en infracciones detectadas por medios que permiten comprobar identidad del vehículo o conductor, con garantías de defensa y prueba.",
    useWhen: ["fotodetección", "fotomulta", "cámara", "notificación"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=5557",
  },
  {
    id: "CPACA-41",
    source: "Ley 1437 de 2011 - CPACA",
    provision: "Artículo 41",
    rule: "La autoridad debe corregir irregularidades procedimentales en la actuación administrativa antes de adoptar la decisión definitiva, según el caso.",
    useWhen: ["irregularidad procedimental", "debido proceso"],
    url: "https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=41249",
  },
  {
    id: "CPACA-91",
    source: "Ley 1437 de 2011 - CPACA",
    provision: "Artículo 91",
    rule: "Los actos administrativos en firme pierden obligatoriedad, entre otros eventos, cuando al cabo de cinco años la autoridad no ha realizado los actos que le correspondan para ejecutarlos. La aplicación exige conocer la fecha de firmeza y las actuaciones ejecutivas posteriores.",
    useWhen: ["pérdida de fuerza ejecutoria", "ejecutoriedad", "cobro coactivo", "acto en firme"],
    url: "https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=41249",
  },
  {
    id: "CPACA-92",
    source: "Ley 1437 de 2011 - CPACA",
    provision: "Artículo 92",
    rule: "Regula la excepción de pérdida de ejecutoriedad cuando el interesado se opone a la ejecución alegando dicha pérdida y establece el trámite administrativo correspondiente.",
    useWhen: ["pérdida de fuerza ejecutoria", "excepción"],
    url: "https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=41249",
  },
  {
    id: "CPACA-93",
    source: "Ley 1437 de 2011 - CPACA",
    provision: "Artículo 93",
    rule: "Regula las causales de revocación directa de los actos administrativos.",
    useWhen: ["revocatoria directa", "acto contrario a ley", "agravio injustificado"],
    url: "https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=41249",
  },
  {
    id: "CE-00408-2016",
    source: "Consejo de Estado, sentencia 00408 de 2016",
    provision: "Fuerza ejecutoria y excepción de pérdida de fuerza ejecutoria",
    rule: "La pérdida de fuerza ejecutoria se relaciona con la imposibilidad de ejecutar el acto administrativo; la excepción debe analizarse con los presupuestos y límites jurídicos correspondientes.",
    useWhen: ["pérdida de fuerza ejecutoria", "ejecución de acto"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=78408",
  },
];

export function selectLegalAuthorities(routes: string[], text = "") {
  const haystack = `${routes.join(" ")} ${text}`.toLowerCase();
  return TRAFFIC_LEGAL_LIBRARY.filter((item) =>
    item.useWhen.some((keyword) => haystack.includes(keyword.toLowerCase()))
  );
}
