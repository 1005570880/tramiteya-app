export interface LegalAuthority {
  id: string;
  source: string;
  provision: string;
  rule: string;
  development: string;
  application: string;
  precedent?: string;
  useWhen: string[];
  url: string;
}

/**
 * Biblioteca jurídica estructurada para el motor de tránsito.
 *
 * Regla de diseño: el motor no debe limitarse a citar una norma. Cada entrada
 * contiene (i) regla jurídica, (ii) desarrollo de su alcance, (iii) forma de
 * aplicación al expediente y, cuando existe, (iv) precedente que orienta su
 * interpretación. La IA recibe esta estructura como contexto controlado.
 */
export const TRAFFIC_LEGAL_LIBRARY: LegalAuthority[] = [
  {
    id: "CP-23",
    source: "Constitución Política de Colombia",
    provision: "Artículo 23",
    rule: "Toda persona puede presentar peticiones respetuosas y obtener pronta resolución.",
    development: "El derecho de petición no se satisface con una respuesta aparente o meramente formal. La autoridad debe pronunciarse de manera congruente sobre lo solicitado y, cuando la petición exige verificar actuaciones administrativas, debe suministrar o explicar las razones jurídicas y fácticas de su respuesta.",
    application: "Sustenta que la autoridad identifique el expediente, responda cada solicitud y explique de forma verificable la situación jurídica de la multa, en lugar de limitarse a repetir el estado que aparece en SIMIT.",
    useWhen: ["derecho de petición", "solicitud de expediente", "respuesta de fondo", "congruencia"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4125",
  },
  {
    id: "CP-29",
    source: "Constitución Política de Colombia",
    provision: "Artículo 29",
    rule: "El debido proceso se aplica a toda clase de actuaciones judiciales y administrativas.",
    development: "En materia administrativa sancionatoria comprende, entre otras garantías, legalidad, defensa, contradicción, prueba, presunción de inocencia y posibilidad real de controvertir la imputación. La autoridad debe poder demostrar la regularidad de las etapas esenciales que llevaron a la sanción.",
    application: "Permite exigir el expediente completo, la evidencia, la vinculación del ciudadano, las oportunidades de defensa, la decisión sancionatoria, los recursos y las constancias de notificación.",
    precedent: "La Sentencia C-038 de 2020 reiteró que el poder sancionatorio administrativo está sometido al principio de responsabilidad personal y a las garantías del artículo 29.",
    useWhen: ["notificación", "defensa", "prueba", "actuación sancionatoria", "debido proceso", "culpabilidad"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4125",
  },
  {
    id: "L769-129",
    source: "Ley 769 de 2002",
    provision: "Artículo 129, parágrafos 1 y 2",
    rule: "Las multas no pueden imponerse a persona distinta de quien cometió la infracción; las ayudas tecnológicas constituyen medios de prueba de la ocurrencia de la infracción.",
    development: "La identificación del vehículo o la existencia de una imagen no equivale, por sí sola, a demostrar quién realizó personalmente la conducta cuando la infracción exige imputación personal. La norma preserva la personalidad de la sanción y reconoce valor probatorio a las ayudas tecnológicas, pero no convierte automáticamente al propietario en responsable de toda conducta del conductor.",
    application: "Cuando el registro provenga de fotodetección o la multa esté asociada al propietario sin evidencia suficiente de imputación personal, el expediente debe permitir establecer cómo se individualizó al responsable y qué pruebas sustentaron la decisión.",
    precedent: "La Sentencia C-038 de 2020 declaró inexequible la solidaridad sancionatoria automática entre propietario y conductor prevista en la Ley 1843 de 2017 por desconocer la imputabilidad personal.",
    useWhen: ["fotodetección", "fotomulta", "cámara", "propietario", "imputación personal", "responsabilidad"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=5557",
  },
  {
    id: "L769-136",
    source: "Ley 769 de 2002",
    provision: "Artículo 136",
    rule: "El procedimiento posterior al comparendo depende de si el inculpado acepta o controvierte la infracción; cuando la rechaza, debe comparecer a audiencia pública para el debate probatorio.",
    development: "La norma conecta el comparendo con la fase contravencional. Si hubo controversia, la audiencia es el espacio institucional para decretar y practicar pruebas conducentes y permitir defensa. Por ello, cuando SIMIT ya muestra una multa, la pregunta jurídicamente útil no es asumir que no hubo audiencia, sino reconstruir qué actuación produjo la sanción y cómo se garantizó la defensa.",
    application: "En un registro que ya mutó a multa/sanción, se debe pedir el acta o constancia de la actuación que produjo la decisión y, si hubo controversia, las pruebas y constancias de audiencia correspondientes.",
    useWhen: ["audiencia", "sanción", "comparendo", "defensa", "pruebas"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=5557",
  },
  {
    id: "L769-137",
    source: "Ley 769 de 2002",
    provision: "Artículo 137",
    rule: "En infracciones detectadas por medios que permiten comprobar la identidad del vehículo o conductor se aplican reglas específicas de comunicación, prueba y culminación de la actuación.",
    development: "El procedimiento de fotodetección exige que la prueba de la infracción acompañe el comparendo y que la administración agote las actuaciones necesarias para hacer comparecer al citado. La culminación de la actuación y la imposición de la sanción están condicionadas por las garantías fijadas por la jurisprudencia constitucional.",
    application: "Si el código o la evidencia apunta a fotodetección, el expediente debe contener la prueba técnica, la comunicación, los soportes remitidos y las actuaciones destinadas a garantizar comparecencia y defensa.",
    precedent: "La Sentencia C-530 de 2003 condicionó la constitucionalidad de apartes del procedimiento a que la administración agote los medios para hacer comparecer al citado y a que la sanción solo se imponga cuando esté plenamente comprobado que el citado es el infractor. La Sentencia C-038 de 2020 reforzó el principio de imputación personal.",
    useWhen: ["fotodetección", "fotomulta", "cámara", "notificación", "evidencia tecnológica"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=5557",
  },
  {
    id: "L769-159",
    source: "Ley 769 de 2002",
    provision: "Artículo 159",
    rule: "Las sanciones impuestas por infracciones de tránsito prescriben en tres años contados desde la ocurrencia del hecho; la prescripción debe declararse de oficio y se interrumpe con la notificación del mandamiento de pago.",
    development: "La regla especial de tránsito debe leerse conjuntamente con el régimen de cobro coactivo. El dato decisivo no es la antigüedad del comparendo aislada, sino la línea temporal entre hecho, sanción y mandamiento de pago, especialmente su notificación efectiva. Una vez notificado el mandamiento, el análisis continúa con las reglas del cobro coactivo y las actuaciones posteriores.",
    application: "El motor solo debe activar una hipótesis fuerte de prescripción cuando las fechas permitan hacer el cómputo y debe pedir el mandamiento y su constancia de notificación cuando no estén acreditados. No debe confundir prescripción de la sanción/acción de cobro con caducidad de la actuación contravencional.",
    precedent: "Consejo de Estado, Sección Primera, sentencia de 11 de febrero de 2016, rad. 11001-03-15-000-2015-03248-00(AC): reconoce la aplicación armónica del artículo 159 de la Ley 769 de 2002 con la Ley 1066 de 2006 y el artículo 818 del Estatuto Tributario para el cobro coactivo; tras la notificación del mandamiento el término vuelve a correr conforme a las reglas del cobro.",
    useWhen: ["prescripción", "cobro", "ejecución de multa", "mandamiento de pago", "cobro coactivo"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=5557",
  },
  {
    id: "L1066-5",
    source: "Ley 1066 de 2006",
    provision: "Artículo 5",
    rule: "Las entidades públicas con cartera a su favor deben aplicar el procedimiento de cobro coactivo previsto en el Estatuto Tributario, salvo las particularidades legales aplicables.",
    development: "La norma integra el régimen especial de tránsito con las reglas generales del cobro coactivo. Esta integración es relevante después de que existe una obligación exigible y permite analizar no solo la expedición del mandamiento, sino la actividad posterior de la administración.",
    application: "Sirve para pedir la trazabilidad completa del cobro y revisar si, después del mandamiento, existieron actuaciones con incidencia en el término de prescripción.",
    precedent: "Consejo de Estado, Sección Primera, 11 de febrero de 2016, rad. 11001-03-15-000-2015-03248-00(AC).",
    useWhen: ["cobro coactivo", "prescripción", "mandamiento", "ejecución"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=41249",
  },
  {
    id: "ET-818",
    source: "Estatuto Tributario",
    provision: "Artículo 818",
    rule: "La notificación del mandamiento de pago interrumpe la prescripción de la acción de cobro y, conforme al régimen aplicable, el término vuelve a correr desde el día siguiente a la notificación.",
    development: "En tránsito no se usa aisladamente: opera como regla complementaria del cobro coactivo por remisión de la Ley 1066 de 2006. Por eso el motor debe solicitar evidencia de la fecha y forma de notificación del mandamiento y de las actuaciones posteriores, en vez de calcular prescripción únicamente desde el comparendo.",
    application: "Permite construir una cronología probatoria del cobro y detectar periodos prolongados de inactividad que requieran análisis jurídico.",
    precedent: "Consejo de Estado, Sección Primera, sentencia de 11 de febrero de 2016, rad. 11001-03-15-000-2015-03248-00(AC).",
    useWhen: ["prescripción", "mandamiento de pago", "acción de cobro", "cobro coactivo"],
    url: "https://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario.html",
  },
  {
    id: "L769-161",
    source: "Ley 769 de 2002",
    provision: "Artículo 161",
    rule: "La acción por contravención de tránsito caduca al año desde los hechos; dentro de ese término debe decidirse sobre la imposición de la sanción.",
    development: "La caducidad se refiere a la acción contravencional y al momento en que debe decidirse sobre la imposición de la sanción. Una vez el expediente evidencia que la actuación culminó con una multa o sanción, el análisis debe desplazarse a la legalidad de esa decisión, sus recursos, ejecutoria, notificación, prescripción y cobro. El paso del tiempo desde el comparendo no permite, por sí solo, declarar caducada una actuación ya sancionada.",
    application: "No se debe presentar como ruta principal cuando SIMIT ya evidencia multa/sanción o cuando el identificador y demás datos muestran que la actuación avanzó a una decisión sancionatoria. En esos casos se solicita el acto sancionatorio y su expediente para verificar ejecutoria, notificación y cobro.",
    precedent: "El propio texto vigente del artículo 161 vincula el vencimiento del término con la decisión sobre la imposición de la sanción; por ello el motor distingue entre comparendo pendiente de decisión y multa ya registrada.",
    useWhen: ["caducidad", "comparendo sin sanción acreditada", "actuación contravencional"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=5557",
  },
  {
    id: "CPACA-67-69",
    source: "Ley 1437 de 2011 - CPACA",
    provision: "Artículos 67, 68 y 69",
    rule: "Los actos administrativos particulares deben notificarse conforme a las formas legales; el régimen contempla notificación personal, citación y, cuando proceda, notificación por aviso.",
    development: "La notificación no se acredita con una simple afirmación de la entidad. El expediente debe permitir verificar el acto notificado, el destinatario, el medio utilizado, la fecha y las constancias que demuestren el cumplimiento del procedimiento. El artículo 67 además exige la entrega de copia íntegra del acto y la indicación de recursos y términos, cuando sea aplicable.",
    application: "Cuando SIMIT no muestra la fecha o modalidad de notificación, la petición debe exigir las constancias documentales y no afirmar automáticamente que la notificación fue irregular.",
    useWhen: ["notificación", "notificacion", "aviso", "citación", "recursos", "debido proceso"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=41249",
  },
  {
    id: "CPACA-91",
    source: "Ley 1437 de 2011 - CPACA",
    provision: "Artículo 91",
    rule: "Los actos administrativos en firme pierden obligatoriedad y no pueden ejecutarse, entre otros eventos, cuando al cabo de cinco años de estar en firme la autoridad no ha realizado los actos que le correspondan para ejecutarlos.",
    development: "La pérdida de fuerza ejecutoria no se calcula automáticamente desde la fecha del comparendo. Requiere identificar el acto administrativo ejecutable, su firmeza y las actuaciones de ejecución realizadas durante el periodo legalmente relevante.",
    application: "Si existe una sanción firme antigua, el expediente debe reconstruir la fecha de firmeza y las actuaciones ejecutivas para determinar si esta causal tiene vocación de prosperar.",
    useWhen: ["pérdida de fuerza ejecutoria", "ejecutoriedad", "acto en firme", "cobro"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=41249",
  },
  {
    id: "CPACA-92",
    source: "Ley 1437 de 2011 - CPACA",
    provision: "Artículo 92",
    rule: "El interesado puede oponerse a la ejecución de un acto administrativo alegando la pérdida de fuerza ejecutoria, conforme al trámite previsto por la ley.",
    development: "La norma convierte la pérdida de fuerza ejecutoria en una cuestión susceptible de plantearse frente a la ejecución. El documento debe formularla de manera condicionada cuando aún no se conoce la fecha de firmeza ni la actividad ejecutiva.",
    application: "Sirve para estructurar una solicitud subsidiaria cuando el expediente revele un acto firme cuya ejecución pudo quedar afectada por el transcurso del tiempo y la inactividad administrativa.",
    useWhen: ["pérdida de fuerza ejecutoria", "excepción", "ejecución"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=41249",
  },
  {
    id: "CPACA-93",
    source: "Ley 1437 de 2011 - CPACA",
    provision: "Artículo 93",
    rule: "Los actos administrativos pueden ser revocados directamente en los supuestos legales, entre ellos cuando sean manifiestamente contrarios a la Constitución o la ley, cuando no estén conformes con el interés público o social, o cuando causen agravio injustificado.",
    development: "La revocatoria directa es un mecanismo excepcional y debe plantearse con una causal concreta, no como una fórmula genérica para borrar una multa. Por eso el motor la presenta subsidiariamente y la vincula a la irregularidad que resulte acreditada en el expediente.",
    application: "Si la autoridad acredita un vicio de legalidad, una irregularidad relevante o un supuesto legal de revocación, se solicita que adopte la consecuencia correspondiente; si no, la petición conserva como objetivo principal la reconstrucción documental del caso.",
    useWhen: ["revocatoria directa", "acto contrario a ley", "agravio injustificado", "irregularidad"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=41249",
  },
  {
    id: "CPACA-41",
    source: "Ley 1437 de 2011 - CPACA",
    provision: "Artículo 41",
    rule: "La autoridad debe corregir las irregularidades que se hayan presentado en la actuación administrativa antes de adoptar la decisión definitiva, según el caso.",
    development: "La regla expresa un deber de saneamiento procedimental dentro de la actuación administrativa. No autoriza a inventar una irregularidad: exige identificarla y conectarla con la actuación concreta.",
    application: "Se incorpora como fundamento complementario cuando del expediente resulte una irregularidad procedimental que la administración deba corregir.",
    useWhen: ["irregularidad procedimental", "debido proceso", "saneamiento"],
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=41249",
  },
  {
    id: "CC-C038-2020",
    source: "Corte Constitucional",
    provision: "Sentencia C-038 de 2020",
    rule: "La responsabilidad sancionatoria por infracciones de tránsito detectadas tecnológicamente no puede fundarse en una solidaridad objetiva del propietario por el hecho del conductor.",
    development: "La Corte explicó que el derecho de defensa exige una posibilidad real de controvertir la imputabilidad y que la propiedad del vehículo no basta para demostrar quién realizó personalmente la conducta. La decisión declaró inexequible el parágrafo 1 del artículo 8 de la Ley 1843 de 2017.",
    application: "Si el caso es de fotodetección, el documento debe exigir que la autoridad identifique la base probatoria de la imputación personal y no asumir que la placa equivale a la identidad del infractor.",
    precedent: "Sentencia C-038/20, Sala Plena, 6 de febrero de 2020, M.P. Alejandro Linares Cantillo.",
    useWhen: ["fotodetección", "fotomulta", "cámara", "propietario", "imputación personal", "culpabilidad"],
    url: "https://www.corteconstitucional.gov.co/Relatoria/2020/C-038-20.htm",
  },
  {
    id: "CC-C530-2003",
    source: "Corte Constitucional",
    provision: "Sentencia C-530 de 2003",
    rule: "La vinculación del propietario en determinados supuestos no puede sustituir la necesidad de acreditar su posible responsabilidad personal; la administración debe agotar los medios disponibles para hacer comparecer al citado.",
    development: "El precedente condicionó apartes del régimen de tránsito relacionados con la citación del propietario y la culminación de actuaciones detectadas sin identificación directa del conductor. Es especialmente útil para reconstruir si la autoridad realizó las actuaciones necesarias antes de sancionar.",
    application: "Cuando el expediente muestre una sanción al propietario derivada de una detección tecnológica o una identificación incompleta del conductor, se debe solicitar la prueba de vinculación, citación y acreditación de responsabilidad.",
    useWhen: ["fotodetección", "fotomulta", "propietario", "citación", "notificación"],
    url: "https://www.corteconstitucional.gov.co/relatoria/2003/C-530-03.htm",
  },
  {
    id: "CE-2016-03248",
    source: "Consejo de Estado, Sección Primera",
    provision: "Sentencia de 11 de febrero de 2016, rad. 11001-03-15-000-2015-03248-00(AC)",
    rule: "El cobro coactivo de multas de tránsito se analiza armónicamente con el artículo 159 de la Ley 769 de 2002, la Ley 1066 de 2006 y el artículo 818 del Estatuto Tributario.",
    development: "El Consejo de Estado consideró jurídicamente adecuada la aplicación del régimen general de cobro coactivo en lo no regulado por el Código de Tránsito. Destacó que la notificación del mandamiento de pago interrumpe el término y que, después de ella, el término vuelve a correr conforme a las reglas del Estatuto Tributario.",
    application: "Impone una carga probatoria concreta a la autoridad: identificar el mandamiento, demostrar su notificación y permitir reconstruir las actuaciones posteriores. El motor no debe declarar prescripción sin esa cronología.",
    precedent: "Consejero ponente: Roberto Augusto Serrato Valdés; decisión de 11 de febrero de 2016.",
    useWhen: ["prescripción", "cobro coactivo", "mandamiento de pago", "acción de cobro"],
    url: "https://www.consejodeestado.gov.co/documentos/boletines/PDF/11001-03-15-000-2015-03248-00(AC)",
  },
];

export function selectLegalAuthorities(routes: string[], text = "") {
  const haystack = `${routes.join(" ")} ${text}`.toLowerCase();
  const normalized = haystack.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return TRAFFIC_LEGAL_LIBRARY.filter((item) =>
    item.useWhen.some((keyword) => normalized.includes(keyword.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")))
  );
}
