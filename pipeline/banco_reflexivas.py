"""Banco de preguntas reflexivas (borrador, sin revisión de la comisión).

20 dilemas de segundo nivel: escenarios ambiguos en lenguaje sencillo que piden aplicar el
criterio de los lineamientos, no recordar una frase. Se responden con Sí / No y la explicación
cierra con una pregunta para pensar.

Mismo formato de tupla que banco_preguntas.py:
  (tipo, nivel, enunciado, correcta, explicacion, fragmento, evidencia, conceptos)
  tipo "d" = dilema (Sí / No) · correcta: 0 Sí, 1 No
`construir_preguntas.py` las valida junto con el banco base y las escribe en web/data/questions.json (ids ref-NNN, serie "reflexiva").
"""

ROLES = {
    "GEN": ["estudiante", "profesor", "investigador", "administrativo"],
    "ENS": ["estudiante", "profesor"],
    "CIE": ["investigador", "profesor"],
    "EXT": ["profesor", "investigador", "administrativo"],
    "GES": ["administrativo"],
}

BANCO = {
"GEN": [
 ("d", 3, "Eres profesor y tienes 120 ensayos por calificar. La IA propone una nota para cada uno; tú les das una mirada rápida y las firmas. La decisión final es tuya. ¿Esa revisión es suficiente?", 1,
  "No. Firmar no es lo mismo que supervisar. Los lineamientos piden una supervisión real, con posibilidad de corregir, y no un visto bueno al final. Si casi nunca cambias la nota que propone la IA, la que está calificando es ella. Para pensar: ¿En cuántos casos te habrías atrevido a contradecirla?",
  "GEN-018", "no como una revisión superficial al final del proceso", ["supervision-humana", "evaluacion", "decisiones"]),
 ("d", 3, "Usas IA para casi todo y te va muy bien: entregas a tiempo y con buena calidad. El detalle es que ya no sabrías hacer esas tareas sin ella. Si los resultados son buenos, ¿igual hay un problema?", 0,
  "Sí. Los lineamientos aceptan la IA cuando fortalece tu juicio, no cuando lo reemplaza. Un buen resultado puede esconder que dejaste de desarrollar la capacidad que la tarea buscaba. Para pensar: Si mañana no tuvieras la herramienta, ¿qué parte de lo que haces seguiría siendo tuya?",
  "GEN-012", "no genere dependencia cognitiva ni delegación acrítica de decisiones", ["agencia-humana", "aprendizaje", "competencias"]),
 ("d", 3, "Resumir un artículo publicado con IA no tiene problema. Por lo tanto, resumir con la misma herramienta las actas de un comité disciplinario tampoco debería tenerlo: es exactamente la misma tarea. ¿Es correcto ese razonamiento?", 1,
  "No. La tarea es la misma, pero el riesgo no. Lo que cambia el riesgo es para qué se usa, qué datos entran, cuánto se automatiza y en manos de qué proveedor queda la información. Las actas tienen datos de personas y efectos sobre ellas. Para pensar: Antes de usar IA, ¿te preguntas qué estás haciendo o con qué lo estás haciendo?",
  "GEN-008", "cambia según el propósito del uso, el tipo de datos que intervienen, el grado de automatización", ["riesgo", "datos-personales", "confidencialidad"]),
 ("d", 3, "Quieres ser totalmente transparente con la IA. ¿Deberías documentar con el mismo detalle cada uso, incluso cuando solo corriges la ortografía de un correo?", 1,
  "No. La transparencia es proporcional: cuando la IA solo apoya tareas menores basta con claridad básica, y el detalle crece cuando influye en decisiones, productos o entregables a terceros. Documentar todo igual también oculta lo importante entre lo trivial. Para pensar: ¿Qué usos tuyos de IA alguien necesitaría poder reconstruir después?",
  "GEN-019", "Esta exigencia no implica el mismo nivel de detalle en todos los casos", ["transparencia", "trazabilidad", "niveles-de-uso"]),
 ("d", 3, "Le hiciste una pregunta a la IA con una premisa equivocada y te devolvió una respuesta sesgada que usaste. La herramienta fue la que se equivocó. ¿Parte de la responsabilidad es tuya?", 0,
  "Sí. Los lineamientos dicen que la forma de pedirle cosas a la IA influye en lo que responde y que eso es responsabilidad de quien la usa. La IA tiende a seguir el marco que le das. Para pensar: ¿Revisas tus propias preguntas con el mismo cuidado con que revisas las respuestas?",
  "GEN-019", "reconociendo su impacto en los resultados y la responsabilidad de quien las emplea", ["responsabilidad", "sesgos", "verificacion"]),
],
"ENS": [
 ("d", 3, "Usaste IA solo para entender un tema difícil. Después escribiste el ensayo tú, sin copiar nada del chat. El profesor no pidió declarar nada. ¿Tienes que declararlo?", 1,
  "No, por regla general. Lo que obliga a declarar no es haber usado IA, sino que lo que te dio la IA haya pasado al trabajo que entregas. El profesor puede pedirlo igual. Para pensar: Si la estructura de tu argumento salió de esa conversación, ¿ese uso de verdad se quedó fuera del ensayo?",
  "ENS-037", "No siempre es necesario declarar usos personales de estudio que no pasan al producto final", ["declaracion-de-uso", "aprendizaje", "integridad-academica"]),
 ("d", 3, "Con IA terminas todas las tareas más rápido y tus notas subieron. Pero en los exámenes sin IA te va peor que antes. ¿Es una señal de que algo en tu uso de la IA no está funcionando?", 0,
  "Sí. Los lineamientos proponen una pregunta sencilla: ¿la IA te está ayudando a aprender o está reemplazando una tarea que debías hacer tú? Notas más altas con menos aprendizaje son la segunda. Para pensar: ¿Qué parte del trabajo le pasas a la IA justo cuando la tarea empieza a costarte?",
  "ENS-036", "¿la herramienta está ayudando a aprender, enseñar o decidir mejor, o está reemplazando una tarea que debía hacer una persona?", ["aprendizaje", "agencia-humana", "competencias"]),
 ("d", 3, "La guía del trabajo no dice nada sobre IA. Un compañero razona: «si no lo prohibieron, está permitido». ¿Te corresponde a ti preguntar antes de entregar?", 0,
  "Sí. Los lineamientos piden que cada actividad tenga una regla clara, pero cuando no la tiene, la duda se resuelve antes de entregar, no después. El silencio no es permiso. Para pensar: ¿Qué ganas y qué arriesgas al interpretar el silencio a tu favor?",
  "ENS-039", "Cuando no sea claro si el uso está permitido, la duda debe resolverse antes de entregar la actividad", ["niveles-de-uso", "integridad-academica", "responsabilidad"]),
 ("d", 3, "La IA te da una cita perfecta para tu argumento, pero no la encuentras en ninguna base de datos. Decides borrar la cita y dejar solo la idea, que suena muy razonable. ¿Puedes dejar esa idea en el trabajo como algo sabido?", 1,
  "No. Quitar la cita no vuelve verificable la idea: si no puedes comprobarla, sigue siendo una hipótesis de la IA. Los lineamientos piden tratarla como idea preliminar y buscar respaldo propio. Para pensar: ¿Te convence la idea porque es cierta o porque suena bien y te sirve?",
  "ENS-039", "Si la respuesta presenta coherencia aparente pero no puede ser verificada, hay que tratarla como una idea preliminar", ["alucinaciones", "citas", "verificacion"]),
 ("d", 3, "Le pediste a la IA que solo corrigiera el estilo de tu texto. Cambió tantas frases que ahora suena mejor de lo que tú escribirías, aunque las ideas son tuyas. ¿Deberías declarar ese uso?", 0,
  "Sí. Corregir el estilo es un apoyo menor, pero reescribir apartados ya es un uso que se declara. La línea no la marca lo que le pediste a la IA, sino lo que hizo con tu texto. Para pensar: Si tu profesor te pidiera reescribir un párrafo en voz alta, ¿sonaría como lo que entregaste?",
  "ENS-037", "cuando se usa para redactar o reescribir apartados", ["declaracion-de-uso", "autoria", "integridad-academica"]),
],
"CIE": [
 ("d", 3, "Te piden evaluar el manuscrito de un colega. No quieres que la IA lo juzgue por ti, solo que te ayude a redactar tu concepto, y para eso le pegas el manuscrito. ¿Está bien?", 1,
  "No. El problema no es para qué usas la IA, sino qué le entregas: un manuscrito no publicado es reservado y cargarlo en una herramienta externa rompe la confidencialidad. Podrías usarla para ordenar tus propias notas si no contienen información protegida. Para pensar: ¿De quién es la información que estás pegando?",
  "CIE-070", "no deben cargarse en herramientas abiertas o no autorizadas documentos no publicados, manuscritos", ["revision-por-pares", "confidencialidad", "herramientas-autorizadas"]),
 ("d", 3, "La IA aportó tanto al análisis de tu artículo que te parece deshonesto no darle crédito. ¿Lo honesto es declarar su uso en lugar de ponerla como coautora?", 0,
  "Sí. La honestidad sobre la IA se ejerce declarando su uso, no dándole autoría. Ser autor implica aprobar la versión final y responder por errores, algo que una herramienta no puede hacer. Para pensar: Si alguien encuentra un error en ese análisis, ¿a quién le va a pedir explicaciones?",
  "CIE-069", "La IA no puede figurar como autora o coautora", ["autoria", "declaracion-de-uso", "integridad-cientifica"]),
 ("d", 3, "A tu base de datos le faltan valores. La IA puede completarlos de forma estadísticamente plausible. Si lo justificas en la metodología y dejas registro de cómo lo hiciste, ¿puede ser aceptable?", 0,
  "Sí, puede serlo. Los lineamientos no prohíben completar datos en cualquier caso: lo que debe evitarse es hacerlo sin justificación metodológica y sin trazabilidad. La pregunta no es si se puede, sino si puedes defender el método. Para pensar: ¿Alguien podría reproducir tu resultado sabiendo exactamente qué hizo la IA?",
  "CIE-061", "sin justificación metodológica y sin trazabilidad", ["integridad-cientifica", "trazabilidad", "verificacion"]),
 ("d", 3, "La IA redactó las conclusiones de tu investigación. Tú conoces el tema, las leíste con cuidado y estás de acuerdo con todas. ¿Basta con estar de acuerdo para que sean tus conclusiones?", 1,
  "No. Formular conclusiones es una tarea que los lineamientos consideran no delegable. Estar de acuerdo con un texto no es lo mismo que haber llegado a él: el razonamiento que lleva de los datos a la conclusión es justamente lo que te toca hacer a ti. Para pensar: ¿Habrías llegado a las mismas conclusiones sin haberlas leído antes?",
  "CIE-061", "Delegar en la IA la interpretación final de resultados, la formulación de conclusiones", ["responsabilidad", "integridad-cientifica", "agencia-humana"]),
],
"EXT": [
 ("d", 3, "Resumiste con IA 40 entrevistas de una comunidad. El resumen es claro y preciso con los datos, pero las expresiones propias de la gente desaparecieron. ¿Se perdió algo importante?", 0,
  "Sí. En el trabajo con comunidades, cómo se dice algo también es información. Los lineamientos piden revisar los resúmenes para que no se pierda el sentido de las voces recogidas. Para pensar: ¿La gente entrevistada se reconocería en ese resumen?",
  "EXT-091", "evitar que se pierda el sentido de las voces recogidas", ["comunidades", "verificacion", "calidad"]),
 ("d", 3, "La IA hizo un diagnóstico de las necesidades de una comunidad a partir de encuestas. Tu equipo lo revisó con cuidado y lo encontró coherente. ¿Basta con la revisión de tu equipo para presentarlo como diagnóstico?", 1,
  "No. Los lineamientos piden que una lectura sobre una comunidad no se presente como definitiva si no la validaron los propios participantes. Que tu equipo esté de acuerdo no reemplaza ese diálogo. Para pensar: ¿Quién tiene la última palabra sobre lo que una comunidad necesita?",
  "EXT-091", "no validada por los participantes", ["comunidades", "decisiones", "responsabilidad"]),
 ("d", 3, "Un chatbot responde automáticamente las preguntas de empresas aliadas sobre un convenio. Casi siempre acierta. ¿Necesita revisión humana aunque acierte casi siempre?", 0,
  "Sí. Cuando hay impacto contractual, una sola respuesta equivocada puede comprometer a la universidad, y el «casi siempre» no protege de ese error. Los lineamientos piden revisión humana en esos casos. Para pensar: ¿Qué error de ese chatbot sería el más difícil de deshacer?",
  "EXT-089", "Automatizar respuestas sin revisión humana a aliados, comunidades o usuarios externos, cuando exista impacto contractual", ["automatizacion", "terceros", "supervision-humana"]),
],
"GES": [
 ("d", 3, "La IA ordena 300 hojas de vida y tú entrevistas solo a las 20 primeras. La decisión final de contratar la tomas tú. ¿Hay supervisión humana suficiente?", 1,
  "No. Las 280 personas que nunca viste fueron descartadas por la IA, no por ti. Los lineamientos piden criterios definidos, revisión de sesgos y validación humana cuando la IA apoya la selección. Para pensar: ¿Sabes por qué quedó en el puesto 21 la persona que quedó en el puesto 21?",
  "GES-118", "deberán existir criterios definidos, revisión de sesgos, validación humana", ["supervision-humana", "sesgos", "decisiones"]),
 ("d", 3, "Un sistema marca a algunos estudiantes como «en riesgo de deserción» para ofrecerles apoyo. Nadie sabe bien por qué marca a unos y no a otros, pero los resultados son buenos. ¿Es aceptable mientras funcione?", 1,
  "No. Aunque la intención sea ayudar, la universidad debe poder explicar cómo se produjo esa alerta y qué datos usó. Si nadie sabe por qué marca a alguien, tampoco puede saber a quién deja por fuera. Para pensar: ¿Qué le dirías a un estudiante que pregunta por qué lo marcaron, o por qué no?",
  "GES-123", "La IA no puede convertirse en una caja negra", ["transparencia", "decisiones", "trazabilidad"]),
 ("d", 3, "Tu dependencia encontró una herramienta gratuita de IA que ahorra mucho trabajo. Solo la van a usar con información «no tan sensible». ¿Deben revisarla con las áreas competentes antes de usarla?", 0,
  "Sí. Decidir qué es «no tan sensible» es justamente parte de la revisión, y las herramientas gratuitas suelen tener condiciones sobre lo que hacen con los datos. Los lineamientos piden revisar seguridad, proveedor y alcance antes de usarla en procesos institucionales. Para pensar: Si la herramienta es gratis, ¿con qué estás pagando?",
  "GES-127", "Debe revisar el caso con las áreas competentes antes de usarla en procesos institucionales", ["herramientas-autorizadas", "proveedores", "seguridad-informacion"]),
],
}
