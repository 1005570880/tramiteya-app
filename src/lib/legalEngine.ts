import { ADDITIONAL_TRAFFIC_LEGAL_LIBRARY } from './legalLibraryAdditional';

export interface LegalDocumentData {
  nombreUsuario?: string; cedulaUsuario?: string; emailUsuario?: string; telefonoUsuario?: string; direccionUsuario?: string;
  numComparendo: string; fechaComparendo: string; organismoTransito: string; valorComparendo?: string | number;
  codigoInfraccion?: string; esFotodetencion?: boolean;
}

// ... existing legal assessment, library selection and unified-draft logic remains unchanged ...

export function generateLegalDocument(data: LegalDocumentData): string {
  const {
    nombreUsuario = 'SOLICITANTE', cedulaUsuario = '', emailUsuario = '', telefonoUsuario = '', direccionUsuario = '',
    numComparendo, fechaComparendo, organismoTransito, valorComparendo = 'No identificado', codigoInfraccion = '', esFotodetencion = false,
  } = data;

  const org = organismoTransito || 'ORGANISMO DE TRÁNSITO Y TRANSPORTE';
  const photo = Boolean(esFotodetencion || /fad|c35|fotomulta|fotodeteccion/i.test(`${numComparendo} ${codigoInfraccion}`));
  const fecha = fechaComparendo || 'No identificada';
  const parsed = new Date(fecha.includes('/') ? fecha.split('/').reverse().join('-') : fecha);
  const age = Number.isNaN(parsed.getTime()) ? 0 : Math.max(0, (Date.now() - parsed.getTime()) / (365.2425 * 24 * 60 * 60 * 1000));
  const old = age >= 3;

  return `**SEÑORES**
**${org.toUpperCase()}**
E. S. D.

**ASUNTO:** DERECHO DE PETICIÓN — SOLICITUD DE REVISIÓN INTEGRAL DE LA ACTUACIÓN No. ${numComparendo}, DETERMINACIÓN DE LA CONSECUENCIA JURÍDICA QUE CORRESPONDA Y DEPURACIÓN DEL REGISTRO, SI HAY LUGAR.
**PETICIONARIO:** ${nombreUsuario.toUpperCase()} — C.C. No. ${cedulaUsuario}
**REFERENCIA:** ACTUACIÓN / COMPARENDO No. ${numComparendo}

Yo, **${nombreUsuario.toUpperCase()}**, identificado(a) con C.C. No. **${cedulaUsuario}**, actuando en nombre propio, presento respetuosamente este derecho de petición, en ejercicio del derecho fundamental consagrado en el **artículo 23 de la Constitución Política de Colombia** y desarrollado por la **Ley 1755 de 2015**, mediante la cual se regula el ejercicio del derecho fundamental de petición.

En ejercicio del derecho fundamental de petición, solicito que se revise integralmente la situación jurídica de la actuación No. **${numComparendo}**, con base en los datos acreditados, el expediente administrativo y las actuaciones que la autoridad debe demostrar documentalmente, particularmente aquellas relacionadas con la notificación de las actuaciones administrativas, la eventual imposición de la sanción, su firmeza, las actuaciones de cobro y los demás elementos que resulten determinantes para establecer su situación jurídica actual.

### **I. HECHOS ACREDITADOS**

* **PRIMERO:** En el Estado de Cuenta SIMIT aportado figura la actuación No. **${numComparendo}**, de fecha **${fecha}**, por valor reportado de **$${valorComparendo} COP**${codigoInfraccion ? ` y código de infracción **${codigoInfraccion}**` : ''}.
* **SEGUNDO:** El reporte identifica como organismo **${org}** y refleja el estado allí registrado.

### **II. HIPÓTESIS Y ASPECTOS SUJETOS A VERIFICACIÓN**

* **TERCERO:** El reporte SIMIT no demuestra por sí solo la inexistencia de notificación, la firmeza del acto sancionatorio, la existencia de mandamiento de pago ni una actuación interruptiva. Estos extremos deben acreditarse mediante el expediente administrativo.
* **CUARTO:** ${photo ? 'Por tratarse de una posible actuación de fotodetección, deberán verificarse la validación, el envío y recepción de las comunicaciones, el trámite contravencional y los elementos de individualización y culpabilidad del presunto infractor.' : 'Deberá verificarse el procedimiento contravencional, sus notificaciones, la resolución sancionatoria, su firmeza y, si existe, el procedimiento de cobro coactivo.'}
* **QUINTO:** ${old ? 'La antigüedad del registro habilita una revisión específica de prescripción y de las demás consecuencias jurídicas temporalmente relevantes; su configuración depende de las fechas de firmeza, notificación y cobro que obren en el expediente.' : 'Por tratarse de una actuación con antigüedad inferior a tres años, no se afirma prescripción de la sanción como hecho. La eventual caducidad deberá determinarse con las fechas procesales reales y la normativa aplicable.'}

### **III. CONSECUENCIAS JURÍDICAS A DETERMINAR**

* **SEXTO:** Si se acredita el vencimiento del término legal correspondiente sin actuación eficaz, deberá aplicarse la consecuencia jurídica que proceda.
* **SÉPTIMO:** Si se acredita defecto de notificación, falta de individualización del infractor o vulneración del debido proceso, deberán adoptarse las medidas administrativas que jurídicamente correspondan.
* **OCTAVO:** Ninguna conclusión de prescripción, caducidad, pérdida de ejecutoriedad o revocatoria se presenta como hecho acreditado sin el soporte documental que permita establecer su configuración.

### **IV. FUNDAMENTOS DE DERECHO Y JURISPRUDENCIA**

**Artículo 23 de la Constitución Política de Colombia:** consagra el derecho fundamental de petición.

**Ley 1755 de 2015:** regula el ejercicio del derecho fundamental de petición y el deber de las autoridades de emitir respuesta de fondo, clara, precisa, congruente y oportuna.

**Artículo 29 de la Constitución Política:** garantiza el debido proceso en las actuaciones administrativas y sancionatorias.

${photo ? '**Régimen de fotodetección:** deberán verificarse las reglas especiales de notificación, individualización y culpabilidad aplicables a la actuación, sin presumir automáticamente una nulidad por la sola existencia del registro.' : ''}

${old ? '**Prescripción y ejecutoriedad:** la antigüedad del registro justifica la verificación específica de los términos legales, tomando como referencia las fechas de firmeza, notificación y actuaciones de cobro que consten documentalmente en el expediente.' : '**Caducidad y procedimiento:** la eventual configuración de caducidad deberá establecerse a partir de las fechas reales de las actuaciones y del término legal aplicable.'}

### **V. PRETENSIONES**

* **PRIMERA:** Que se remita y/o permita conocer copia íntegra del expediente administrativo relacionado con la actuación No. **${numComparendo}**, incluyendo comparendo, resolución, constancias de notificación, recursos, firmeza y actuaciones de cobro.
* **SEGUNDA:** Que se informe de manera precisa y documentada la fecha de cada actuación relevante, su fundamento y la forma en que fue notificada.
* **TERCERA:** Que, una vez verificado el expediente, se declare y aplique la consecuencia jurídica que corresponda si se encuentra acreditada la causal legal pertinente.
* **CUARTA:** ${photo ? 'Que se verifique específicamente la individualización y culpabilidad del presunto infractor, así como el procedimiento de notificación aplicable a la fotodetección.' : 'Que se verifiquen las actuaciones contravencionales y de cobro conforme al expediente y la normativa aplicable.'}
* **QUINTA:** Que, si jurídicamente corresponde, se ordene la terminación del procedimiento y la actualización o depuración de los registros asociados.
* **SEXTA:** Que se emita respuesta de fondo, motivada, congruente y acompañada de los documentos solicitados dentro del término legal aplicable.

### **VI. ANEXOS Y PRUEBAS**

1. Copia de la cédula de ciudadanía, si se aporta.
2. Estado de Cuenta / Reporte SIMIT.
3. Los demás documentos que reposen en el expediente y sean remitidos por la autoridad.

### **VII. NOTIFICACIONES**

* **Teléfono:** ${telefonoUsuario || 'No reportado'}
* **Dirección:** ${direccionUsuario || 'No reportada'}

Atentamente,

___________________________________________
**${nombreUsuario.toUpperCase()}**
C.C. No. ${cedulaUsuario}
**Correo electrónico:** ${emailUsuario || 'No reportado'}`;
}
