export interface LegalDocumentData {
  nombreUsuario?: string;
  cedulaUsuario?: string;
  emailUsuario?: string;
  telefonoUsuario?: string;
  direccionUsuario?: string;
  numComparendo: string;
  fechaComparendo: string;
  organismoTransito: string;
  valorComparendo?: string | number;
  codigoInfraccion?: string;
  esFotodetencion?: boolean;
}

export function generateLegalDocument(data: LegalDocumentData): string {
  const {
    nombreUsuario = 'JACOB ELIAS ARRIETA FLOREZ',
    cedulaUsuario = '37312647',
    emailUsuario = 'arrietabogado@gmail.com',
    telefonoUsuario = '',
    direccionUsuario = '',
    numComparendo,
    fechaComparendo,
    organismoTransito,
    valorComparendo = '798.853',
    codigoInfraccion = '',
    esFotodetencion = false,
  } = data;

  const fechaHecho = new Date(fechaComparendo || Date.now());
  const hoy = new Date();
  const diffAnios = (hoy.getTime() - fechaHecho.getTime()) / (1000 * 60 * 60 * 24 * 365);
  const esReciente = diffAnios < 3;
  const esFotomulta = esFotodetencion || numComparendo.includes('FAD') || codigoInfraccion === 'C35';

  return `**SEÑORES**
**${(organismoTransito || 'ORGANISMO DE TRÁNSITO Y TRANSPORTE').toUpperCase()}**
E. S. D.

**ASUNTO:** DERECHO DE PETICIÓN — SOLICITUD DE DECLARATORIA DE ${esReciente ? 'INVALIDEZ DE NOTIFICACIÓN, CADUCIDAD Y/O REVOCATORIA DIRECTA' : 'PRESCRIPCIÓN DE LA SANCIÓN Y ACCIÓN DE COBRO'} Y DEPURACIÓN DEFINITIVA DEL REGISTRO SIMIT.
**PETICIONARIO:** ${nombreUsuario.toUpperCase()} — C.C. No. ${cedulaUsuario}
**REFERENCIA:** ACTUACIÓN / COMPARENDO No. ${numComparendo}

Yo, **${nombreUsuario.toUpperCase()}**, mayor de edad, identificado(a) con la cédula de ciudadanía número **${cedulaUsuario}**, domiciliado(a) en la ciudad de ${direccionUsuario || 'la jurisdicción'}, actuando en nombre propio y en ejercicio del Derecho Fundamental de Petición consagrado en el Artículo 23 de la Constitución Política de Colombia, concordante con la Ley 1437 de 2011 (CPACA), me dirijo respetuosamente a su Despacho para formular la presente solicitud con base en los siguientes:

### **I. HECHOS**

* **PRIMERO:** En la plataforma SIMIT e historial de su entidad figura a mi nombre el comparendo / orden No. **${numComparendo}**, de fecha de ocurrencia del **${fechaComparendo}**, por un valor reportado de **$${valorComparendo} COP** ${codigoInfraccion ? `(Infracción: ${codigoInfraccion})` : ''}.
* **SEGUNDO:** Que dicho registro se encuentra en estado activo o pendiente de cobro sin que el suscrito haya sido notificado de forma personal, idónea y oportuna de los actos administrativos que componen el procedimiento contravencional, ni del correspondiente mandamiento de pago dentro de los términos perentorios fijados por la ley.
* **TERCERO:** Que a la fecha de presentación de este escrito, la administración no ha demostrado documentalmente la existencia de actuaciones interruptivas legalmente surtidas e idóneamente notificadas que desvirtúen la indebida notificación o la pérdida de ejecutoriedad.
${esReciente 
  ? '* **CUARTO:** Que al tratarse de una actuación de reciente fecha, han transcurrido los términos del Artículo 161 de la Ley 769 de 2002 para la caducidad de la acción sancionatoria sin que se haya demostrado la celebración de audiencia pública garantizando el pleno derecho a la defensa.' 
  : '* **CUARTO:** Que han transcurrido más de tres (3) años desde la fecha de ocurrencia de los hechos sin que se haya notificado el mandamiento de pago en debida forma, configurándose la prescripción de la sanción establecida en el Artículo 159 del Código Nacional de Tránsito.'}

### **II. FUNDAMENTOS DE DERECHO Y JURISPRUDENCIA**

**A. GARANTÍA CONSTITUCIONAL DEL DEBIDO PROCESO (ART. 29 C.P.):**
* La presunción de inocencia y el debido proceso rigen toda actuación contravencional. Corresponde a la autoridad probar la culpabilidad e individualización del infractor.
* **Sentencia T-051 de 2016 (Corte Constitucional):** Establece que la falta de notificación personal del comparendo o de la resolución sancionatoria vulnera de manera flagrante el derecho a la defensa y a la contradicción, haciendo inoponibles los efectos del acto administrativo.

**B. RÉGIMEN DE CADUCIDAD Y PRESCRIPCIÓN (LEY 769 DE 2002 Y LEY 2161 DE 2021):**
* **Artículo 161 de la Ley 769 de 2002 (Caducidad):** Ocurre la caducidad si en el término de ley no se realiza la audiencia pública y se dicta resolución sancionatoria en firme.
* **Artículo 159 de la Ley 769 de 2002 (Modificado por Ley 2161 de 2021):** La sanción prescribe a los tres (3) años. La interrupción por cobro coactivo sólo surte efectos si el mandamiento de pago es notificado formalmente al ejecutado.
* **Artículo 817 del Estatuto Tributario y Art. 91 del CPACA:** Exigen la culminación de la acción de cobro dentro de los términos legales, so pena de operar la pérdida de ejecutoriedad de la obligación.

${esFotomulta ? `**C. JURISPRUDENCIA ESPECIAL DE AYUDAS TECNOLÓGICAS (FOTOMULTAS):**
* **Sentencia C-038 de 2020 (Corte Constitucional):** Declaró inconstitucional la responsabilidad solidaria entre el propietario y el conductor. La carga de identificar plenamente al infractor recae exclusivamente sobre la autoridad; no se puede sancionar al propietario por la sola titularidad del vehículo.
* **Sentencia C-530 de 2003 (Corte Constitucional):** Prohíbe de forma categórica la imposición de responsabilidad objetiva en materia contravencional.
* **Artículo 8 de la Ley 1843 de 2017:** Exige el envío de la citación por correo certificado dentro de los tres (3) días hábiles siguientes a la validación, so pena de nulidad por indebida notificación.` : ''}

### **III. PRETENSIONES**

* **PRIMERA:** Que se declare la **${esReciente ? 'INVALIDEZ DE LA NOTIFICACIÓN, REVOCATORIA DIRECTA Y/O CADUCIDAD' : 'PRESCRIPCIÓN DE LA SANCIÓN Y/O ACCIÓN DE COBRO'}** de la actuación No. **${numComparendo}**.
* **SEGUNDA:** Que se decrete la terminación inmediata del proceso administrativo contravencional y el archivo definitivo del expediente.
* **TERCERA:** ${esFotomulta ? 'Que se aplique el precedente de la **Sentencia C-038 de 2020** de la Corte Constitucional y se exonere al suscrito al no constar prueba de la autoría e identificación del conductor.' : 'Que se dejen sin efectos las actuaciones derivadas de la indebida notificación o vencimiento de términos.'}
* **CUARTA:** Que se ordene de forma inmediata la **CANCELACIÓN, ELIMINACIÓN Y DEPURACIÓN DEFINITIVA** del registro de la obligación No. **${numComparendo}** en las plataformas SIMIT, RUNT y sistemas internos de su organismo de tránsito.
* **QUINTA:** Que se me expida y remita al correo electrónico la copia del acto administrativo motivado mediante el cual se resuelva esta petición junto con el paz y salvo correspondiente.

### **IV. ANEXOS Y PRUEBAS**
1. Copia de la Cédula de Ciudadanía del peticionario.
2. Estado de Cuenta / Reporte del sistema SIMIT.

### **V. NOTIFICACIONES**
* **Correo Electrónico:** ${emailUsuario}
* **Teléfono:** ${telefonoUsuario || 'No reportado'}

Atentamente,

___________________________________________
**${nombreUsuario.toUpperCase()}**
C.C. No. ${cedulaUsuario}`;
}
