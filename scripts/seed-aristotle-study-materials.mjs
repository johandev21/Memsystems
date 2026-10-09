import { readFileSync } from 'node:fs';

const NOTEBOOK_ID = 'nma6kpacg5z1ksj50fii8o44';
const BASE_URL = 'http://localhost:4000/api';

const materials = [
  // 1. Study Guide
  {
    kind: 'study_guide',
    title: 'Guía Completa: Fundamentos de la Filosofía Aristotélica',
    content: {
      title: 'Guía Completa: Fundamentos de la Filosofía Aristotélica',
      overview: 'Un recorrido integral y sistemático por los pilares fundamentales del pensamiento de Aristóteles: la metafísica hilemórfica, la física teleológica, la lógica deductiva (Organon) y la ética de las virtudes como camino a la eudaimonía.',
      learningObjectives: [
        'Comprender la doctrina hilemórfica (materia y forma) y las cuatro causas.',
        'Dominar la noción de eudaimonía y la ética del justo medio (mesotes).',
        'Analizar la teleología aristotélica frente al mecanicismo y el idealismo platónico.',
        'Identificar la estructura de los silogismos categóricos y la lógica demostrativa.'
      ],
      format: 'detailed',
      sourceIds: [],
      sections: [
        {
          id: 'sec-metafisica-causas',
          title: '1. Metafísica y la Teoría de las Cuatro Causas',
          explanation: 'Para Aristóteles, el conocimiento auténtico consiste en conocer las causas fundamentales de los entes. Contra el dualismo platónico de las Ideas separadas, Aristóteles propone que la sustancia individual (ousía primera) es una unión inseparable de materia (hyle) y forma (morphe). Para explicar el movimiento y la existencia de cualquier ser, formula cuatro causas: material (de qué está hecho), formal (su estructura o esencia), eficiente (el agente generador) y final (el propósito o telos para el cual existe).',
          keyConcepts: [
            'Ousía (Sustancia): El ente individual concreto que existe por sí mismo.',
            'Hilemorfismo: Doctrina de que toda sustancia natural es un compuesto indisoluble de materia y forma.',
            'Potencia (Dynamis) y Acto (Energeia): Mecanismo ontológico que explica el cambio y movimiento.',
            'Las Cuatro Causas: Material, formal, eficiente y final.'
          ],
          examples: [
            'Estatua de bronce: Bronce (material), figura esculpida (formal), escultor (eficiente), conmemorar o embellecer (final).',
            'Una semilla de roble: Posee la potencia intrínseca de convertirse en el acto de ser un roble maduro guiado por su causa final.'
          ],
          misconceptions: [
            'Confundir causa final con intención antropomórfica: para Aristóteles la naturaleza entera opera teleológicamente sin requerir un diseñador consciente personal.',
            'Pensar que la materia puede existir sin forma: la materia prima es pura indeterminación que solo adquiere realidad cuando está informada.'
          ],
          takeaways: [
            'El ser se dice de muchas maneras, pero primordialmente como sustancia.',
            'El cambio no es ilusión ni generación ex nihilo, sino actualización de potencias preexistentes.',
            'Todo ente natural tiende intrínsecamente hacia la realización plena de su telos.'
          ],
          sourceIds: []
        },
        {
          id: 'sec-etica-virtud',
          title: '2. Ética a Nicómaco y la Doctrina del Término Medio',
          explanation: 'En la Ética a Nicómaco, Aristóteles fundamenta la moral en la búsqueda del bien supremo: la eudaimonía (florecimiento humano o vida buena). La eudaimonía no es un estado pasivo ni mero placer hedónico, sino una actividad del alma en concordancia con la excelencia o virtud (areté) a lo largo de una vida completa. Las virtudes éticas se adquieren mediante la habituación y consisten en un término medio relativo a nosotros (mesotes) entre dos extremos viciosos: uno por defecto y otro por exceso.',
          keyConcepts: [
            'Eudaimonía: La felicidad como realización óptima y florecimiento de las capacidades racionales humanas.',
            'Areté (Virtud): Disposición habitual voluntaria hacia la excelencia en el obrar y en el sentir.',
            'Mesotes (Término Medio): Punto de equilibrio virtuoso equidistante de los vicios del exceso y del defecto.',
            'Frónesis (Prudencia o Sabiduría Práctica): Virtud intelectual que discierne la mejor deliberación en situaciones concretas.'
          ],
          examples: [
            'Valentía: Término medio entre la cobardía (defecto de audacia / exceso de temor) y la temeridad (exceso de audacia / falta de juicio).',
            'Generosidad: Término medio entre la tacañería o avaricia (defecto) y el despilfarro (exceso).'
          ],
          misconceptions: [
            'Interpretar el término medio como mediocridad o tibieza: es una cúspide cualitativa de excelencia y juicio.',
            'Creer que todas las acciones tienen término medio: actos intrínsecamente malos (como el adulterio, el robo o el asesinato) nunca admiten moderación virtuosa.'
          ],
          takeaways: [
            'Nos hacemos justos realizando actos justos; la virtud es fruto del hábito constante y la educación moral.',
            'La sabiduría práctica (frónesis) es indispensable para calibrar el término medio en cada contexto contingente.',
            'La amistad verdadera (filia basada en la virtud) es indispensable para una vida eudaimónica completa.'
          ],
          sourceIds: []
        },
        {
          id: 'sec-politica-ciudad',
          title: '3. La Política y la Naturaleza del Zoon Politikon',
          explanation: 'La ética y la política son inseparables en el pensamiento aristotélico: la ética enseña al individuo a vivir bien, mientras la política diseña la comunidad (polis) donde dicha vida plena es realizable. El ser humano es por naturaleza un animal cívico o político (zoon politikon), dotado del don del lógos (lenguaje racional) para deliberar sobre lo justo y lo conveniente. Una ciudad justa busca el bien común y la educación virtuosa de sus ciudadanos.',
          keyConcepts: [
            'Zoon Politikon: La inclinación ontológica del ser humano a asociarse y realizarse en la polis.',
            'Lógos cívico: La capacidad de discernir y comunicar el bien, el mal, lo justo y lo injusto.',
            'Regímenes Políticos: Monarquía, aristocracia y politeia (formas correctas) frente a tiranía, oligarquía y democracia degenerada (formas desviadas).'
          ],
          examples: [
            'Atenas y Esparta como modelos cívicos examinados en las Constituciones aristotélicas.',
            'La familia como primera comunidad natural que escala a la aldea y culmina autárquicamente en la polis.'
          ],
          misconceptions: [
            'Pensar que la polis es un contrato social artificial: para Aristóteles la ciudad es anterior por naturaleza al individuo, como el cuerpo a sus miembros.',
            'Creer que el objetivo de la política es puramente económico o de seguridad mutua; su meta primordial es el perfeccionamiento moral.'
          ],
          takeaways: [
            'Quien no necesita de la polis o es una bestia o es un dios.',
            'El mejor régimen práctico es la politeia: un gobierno mixto sostenido por una clase media amplia y moderada.',
            'Las leyes no son solo límites punitivos, sino instrumentos formativos para cultivar ciudadanos virtuosos.'
          ],
          sourceIds: []
        }
      ],
      generalKnowledgeSupplement: 'General knowledge supplement: El pensamiento de Aristóteles fue recuperado y reinterpretado en la Edad Media por pensadores como Averroes, Maimónides y Santo Tomás de Aquino, convirtiéndose en el armazón filosófico predominante de la escolástica.',
      citations: []
    }
  },

  // 2. Slides Deck
  {
    kind: 'slides',
    title: 'Aristóteles: Metafísica, Ética del Término Medio y Filosofía Natural',
    content: {
      schemaVersion: 2,
      title: 'Aristóteles: Metafísica, Ética del Término Medio y Filosofía Natural',
      design: {
        preset: 'dark',
        background: '#0B0F17',
        surface: '#151D2C',
        primary: '#38BDF8',
        secondary: '#818CF8',
        text: '#F8FAFC',
        muted: '#94A3B8',
        fontHeading: 'Inter',
        fontBody: 'Inter',
        radius: 'large',
        density: 'balanced',
        decoration: 'geometric'
      },
      slides: [
        {
          id: 'slide-intro',
          role: 'title',
          title: 'Aristóteles de Estagira',
          subtitle: 'El Fundador de la Lógica, el Hilemorfismo y la Ética Virtuosa',
          elements: [
            {
              type: 'text',
              text: 'Una síntesis rigurosa de las tesis ontológicas, éticas y teleológicas que moldearon más de dos milenios de pensamiento filosófico occidental.',
              style: { variant: 'body', align: 'center' }
            }
          ]
        },
        {
          id: 'slide-timeline',
          role: 'timeline',
          title: 'Itinerario Biográfico e Intelectual',
          subtitle: 'Desde la Academia platónica hasta la fundación del Liceo',
          elements: [
            {
              type: 'timeline',
              steps: [
                { title: '384 a.C. - Estagira', body: 'Nace en la Calcídica; hijo de Nicómaco, médico de la corte del rey macedonio Amintas III.' },
                { title: '367-347 a.C. - La Academia', body: 'Discípulo de Platón durante veinte años en Atenas hasta la muerte de su maestro.' },
                { title: '343 a.C. - Macedonia', body: 'Tutor del joven Alejandro Magno en Pela por encargo del rey Filipo II.' },
                { title: '335 a.C. - El Liceo', body: 'Funda su propia escuela peripatética en Atenas, consagrada a la investigación empírica y filosófica.' },
                { title: '322 a.C. - Calcis', body: 'Fallece en la isla de Eubea tras abandonar Atenas para no permitir que atenten dos veces contra la filosofía.' }
              ]
            }
          ]
        },
        {
          id: 'slide-causes',
          role: 'content',
          title: 'La Doctrina de las Cuatro Causas',
          subtitle: 'Todo proceso en la naturaleza responde a cuatro preguntas fundamentales',
          elements: [
            {
              type: 'card-group',
              columns: 2,
              cards: [
                { title: 'Causa Material', body: 'Aquello a partir de lo cual algo llega a ser (el mármol de una estatua, la carne y hueso de un animal).' },
                { title: 'Causa Formal', body: 'La forma, la esencia inteligible o definición de lo que el ente es en sí mismo (la idea geométrica o especie).' },
                { title: 'Causa Eficiente', body: 'El principio inmediato del cambio o reposo; el agente que transforma la potencia en acto.' },
                { title: 'Causa Final (Telos)', body: 'El fin o propósito supremo hacia el que se orienta toda acción o desarrollo natural.' }
              ]
            }
          ]
        },
        {
          id: 'slide-comparison',
          role: 'comparison',
          title: 'Platón vs. Aristóteles: Dos Concepciones Ontológicas',
          subtitle: 'Idealismo Trascendente frente a Realismo Inmanente',
          elements: [
            {
              type: 'comparison',
              left: {
                heading: 'Platón (Idealismo)',
                points: [
                  'Las Ideas existen en un mundo inteligible separado (Topos Uranus).',
                  'El mundo sensible es una copia imperfecta y corruptible.',
                  'El alma recuerda las Ideas eternas mediante anamnesis.',
                  'El cuerpo es cárcel temporal del alma inmortal.'
                ]
              },
              right: {
                heading: 'Aristóteles (Realismo)',
                points: [
                  'Las formas universales existen en las cosas individuales particulares.',
                  'El mundo sensible y físico es real, cognoscible y digno de estudio.',
                  'El conocimiento parte de la experiencia sensible e inducción empírica.',
                  'El alma es la forma vivificante del cuerpo orgánico (hilemorfismo).'
                ]
              }
            }
          ]
        },
        {
          id: 'slide-eudaimonia-process',
          role: 'process',
          title: 'El Sendero Hacia la Eudaimonía',
          subtitle: 'Pasos fundamentales en la formación moral y el florecimiento del alma',
          elements: [
            {
              type: 'process',
              steps: [
                { title: '1. Educación Moral y Guía', body: 'Aprender desde la infancia a gozar y sufrir con lo adecuado mediante el ejemplo cívico.' },
                { title: '2. Habituación Constante', body: 'Repetir deliberadamente acciones virtuosas hasta consolidar estados de carácter (hexeis).' },
                { title: '3. Prudencia Práctica (Frónesis)', body: 'Aplicar la razón para elegir el justo medio ante circunstancias cambiantes y complejas.' },
                { title: '4. Actividad Contemplativa', body: 'Alcanzar el cenit de la felicidad humana en el ejercicio de la razón teórica (theoria).' }
              ]
            }
          ]
        },
        {
          id: 'slide-quote',
          role: 'quote',
          title: 'Sentencia Inmortal sobre la Naturaleza y el Juicio',
          elements: [
            {
              type: 'quote',
              quote: 'Somos lo que hacemos día a día de modo reiterado. La excelencia, por tanto, no es un acto aislado, sino un hábito continuo guiado por la recta razón.',
              attribution: 'Aristóteles, Ética a Nicómaco (Paráfrasis clásica de Will Durant)'
            }
          ]
        }
      ],
      generalKnowledgeSupplement: 'General knowledge supplement: Los textos conservados de Aristóteles son en su mayoría notas de lecciones y tratados esotéricos para sus alumnos en el Liceo, lo que explica su estilo sintético, analítico y sistemático.',
      citations: []
    }
  },

  // 3. Roadmap
  {
    kind: 'roadmap',
    title: 'Ruta de Aprendizaje: Maestría en el Corpus Aristotelicum',
    content: {
      title: 'Ruta de Aprendizaje: Maestría en el Corpus Aristotelicum',
      description: 'Un programa secuencial de 4 fases para dominar desde las herramientas lógicas del Organon hasta los tratados de metafísica, ética, poética y política.',
      phases: [
        {
          id: 'phase-1-organon',
          title: 'Fase 1: El Organon y el Pensamiento Lógico',
          description: 'Establecimiento de las herramientas formales del razonamiento, categorías ontológicas y deducción demostrativa.',
          color: '#38BDF8',
          order: 1,
          topics: [
            {
              id: 'top-categorias',
              title: 'Las Categorías y Términos Simples',
              description: 'Estudio de las diez categorías del ser: sustancia, cantidad, cualidad, relación, lugar, tiempo, posición, hábito, acción y pasión.',
              estimatedMinutes: 90,
              order: 1
            },
            {
              id: 'top-de-interpretatione',
              title: 'De Interpretatione: Proposiciones y Oposición',
              description: 'Análisis de proposiciones afirmativas, negativas, universales y particulares; el cuadrado lógico de oposición.',
              estimatedMinutes: 120,
              order: 2
            },
            {
              id: 'top-analiticos',
              title: 'Primeros y Segundos Analíticos',
              description: 'La teoría formal del silogismo categórico, figuras silogísticas y la demostración científica basada en premisas verdaderas y primeras.',
              estimatedMinutes: 180,
              order: 3
            }
          ]
        },
        {
          id: 'phase-2-filosofia-primera',
          title: 'Fase 2: Filosofía de la Naturaleza y Metafísica',
          description: 'Del estudio de las sustancias naturales sometidas a cambio a los principios del ente en cuanto ente.',
          color: '#818CF8',
          order: 2,
          topics: [
            {
              id: 'top-fisica-movimiento',
              title: 'Física: Materia, Movimiento y Vacío',
              description: 'Definición del movimiento como acto de lo que está en potencia; análisis del tiempo, el lugar y la refutación del vacío.',
              estimatedMinutes: 150,
              order: 1
            },
            {
              id: 'top-metafisica-ousia',
              title: 'Metafísica: La Sustancia y el Primer Motor',
              description: 'El ser en tanto ser; prioridad ontológica de la forma; el Primer Motor Inmóvil como acto puro y pensamiento que se piensa a sí mismo.',
              estimatedMinutes: 240,
              order: 2
            },
            {
              id: 'top-de-anima',
              title: 'De Anima: Las Facultades del Alma',
              description: 'El alma vegetativa, sensitiva e intelectiva; la distinción entre entendimiento pasivo y entendimiento agente.',
              estimatedMinutes: 160,
              order: 3
            }
          ]
        },
        {
          id: 'phase-3-filosofia-practica',
          title: 'Fase 3: Ética, Prudencia y Florecimiento Cívico',
          description: 'Investigación sobre la acción humana, la adquisición de virtudes morales y la organización política de la comunidad.',
          color: '#34D399',
          order: 3,
          topics: [
            {
              id: 'top-etica-nicomaco',
              title: 'Ética a Nicómaco: Eudaimonía y Mesotes',
              description: 'Lectura comentada de los libros I a VI: el bien supremo, las virtudes del carácter y las virtudes dianoéticas.',
              estimatedMinutes: 200,
              order: 1
            },
            {
              id: 'top-amistad-justicia',
              title: 'Justicia y Tipos de Amistad (Filia)',
              description: 'Justicia distributiva y conmutativa; los tres tipos de amistad: por utilidad, por placer y por virtud.',
              estimatedMinutes: 140,
              order: 2
            },
            {
              id: 'top-politica-regimenes',
              title: 'La Política: Estructura de la Polis y Tipología de Gobiernos',
              description: 'La subordinación de la economía a la crematística natural; análisis de constituciones y el ideal de la politeia.',
              estimatedMinutes: 180,
              order: 3
            }
          ]
        },
        {
          id: 'phase-4-filosofia-poiética',
          title: 'Fase 4: Poética, Retórica y Estética de la Mímesis',
          description: 'La producción discursiva, el arte dramático y la teoría de la persuasión.',
          color: '#F472B6',
          order: 4,
          topics: [
            {
              id: 'top-retorica',
              title: 'Retórica: Ethos, Pathos y Logos',
              description: 'Los tres medios de persuasión; los tres géneros de discurso: deliberativo, judicial y epidíctico; el entimema.',
              estimatedMinutes: 150,
              order: 1
            },
            {
              id: 'top-poetica-tragedia',
              title: 'Poética: Mímesis, Hamartía y Catarsis',
              description: 'La tragedia como imitación de una acción elevada; la catarsis de la piedad y el terror mediante el peripecia y anagnórisis.',
              estimatedMinutes: 150,
              order: 2
            }
          ]
        }
      ],
      generalKnowledgeSupplement: 'General knowledge supplement: El corpus aristotélico conservado comprende unas 30 obras divididas tradicionalmente en el Organon, tratados de física/biología, Metafísica, escritos ético-políticos y obras retóricas.',
      citations: []
    }
  },

  // 4. Mind Map
  {
    kind: 'mind_map',
    title: 'Mapa Conceptual: Estructura Sistemática del Pensamiento Aristotélico',
    content: {
      title: 'Mapa Conceptual: Estructura Sistemática del Pensamiento Aristotélico',
      rootId: 'node-root',
      nodes: [
        {
          id: 'node-root',
          label: 'Aristóteles de Estagira',
          color: '#6366F1',
          position: { x: 400, y: 300 }
        },
        {
          id: 'node-ciencias-teoricas',
          label: 'Ciencias Teóricas (Saber por el saber)',
          color: '#3B82F6',
          position: { x: 150, y: 120 }
        },
        {
          id: 'node-metafisica',
          label: 'Metafísica (Filosofía Primera)',
          color: '#3B82F6',
          position: { x: -60, y: 40 }
        },
        {
          id: 'node-cuatro-causas',
          label: 'Las 4 Causas & Hilemorfismo',
          color: '#38BDF8',
          position: { x: -220, y: -20 }
        },
        {
          id: 'node-primer-motor',
          label: 'Primer Motor Inmóvil (Acto Puro)',
          color: '#38BDF8',
          position: { x: -220, y: 80 }
        },
        {
          id: 'node-fisica-anima',
          label: 'Física y Psicología (De Anima)',
          color: '#3B82F6',
          position: { x: 30, y: -40 }
        },
        {
          id: 'node-ciencias-practicas',
          label: 'Ciencias Prácticas (La buena acción)',
          color: '#10B981',
          position: { x: 650, y: 120 }
        },
        {
          id: 'node-etica',
          label: 'Ética a Nicómaco (Eudaimonía)',
          color: '#10B981',
          position: { x: 780, y: 40 }
        },
        {
          id: 'node-termino-medio',
          label: 'Mesotes (Justo Medio) & Frónesis',
          color: '#34D399',
          position: { x: 960, y: -10 }
        },
        {
          id: 'node-politica',
          label: 'Política (Zoon Politikon & Polis)',
          color: '#10B981',
          position: { x: 800, y: 180 }
        },
        {
          id: 'node-ciencias-poieticas',
          label: 'Ciencias Poiéticas (Producción y Arte)',
          color: '#EC4899',
          position: { x: 650, y: 460 }
        },
        {
          id: 'node-poetica',
          label: 'Poética (Tragedia & Catarsis)',
          color: '#F472B6',
          position: { x: 850, y: 440 }
        },
        {
          id: 'node-retorica',
          label: 'Retórica (Ethos, Pathos, Logos)',
          color: '#F472B6',
          position: { x: 850, y: 530 }
        },
        {
          id: 'node-organon',
          label: 'El Organon (Instrumento Lógico previo)',
          color: '#F59E0B',
          position: { x: 150, y: 460 }
        },
        {
          id: 'node-silogismo',
          label: 'Teoría del Silogismo Categórico',
          color: '#FBBF24',
          position: { x: -40, y: 460 }
        },
        {
          id: 'node-categorias-log',
          label: 'Categorías y Proposiciones',
          color: '#FBBF24',
          position: { x: -40, y: 550 }
        }
      ],
      edges: [
        { id: 'e1', sourceId: 'node-root', targetId: 'node-ciencias-teoricas', label: 'Estudia', directed: true },
        { id: 'e2', sourceId: 'node-root', targetId: 'node-ciencias-practicas', label: 'Orienta', directed: true },
        { id: 'e3', sourceId: 'node-root', targetId: 'node-ciencias-poieticas', label: 'Analiza', directed: true },
        { id: 'e4', sourceId: 'node-root', targetId: 'node-organon', label: 'Herramienta', directed: true },
        { id: 'e5', sourceId: 'node-ciencias-teoricas', targetId: 'node-metafisica', label: 'Fundamento', directed: true },
        { id: 'e6', sourceId: 'node-metafisica', targetId: 'node-cuatro-causas', label: 'Estructura', directed: true },
        { id: 'e7', sourceId: 'node-metafisica', targetId: 'node-primer-motor', label: 'Causa suprema', directed: true },
        { id: 'e8', sourceId: 'node-ciencias-teoricas', targetId: 'node-fisica-anima', label: 'Entes móviles', directed: true },
        { id: 'e9', sourceId: 'node-ciencias-practicas', targetId: 'node-etica', label: 'Nivel individual', directed: true },
        { id: 'e10', sourceId: 'node-etica', targetId: 'node-termino-medio', label: 'Criterio', directed: true },
        { id: 'e11', sourceId: 'node-ciencias-practicas', targetId: 'node-politica', label: 'Nivel comunitario', directed: true },
        { id: 'e12', sourceId: 'node-ciencias-poieticas', targetId: 'node-poetica', label: 'Mímesis', directed: true },
        { id: 'e13', sourceId: 'node-ciencias-poieticas', targetId: 'node-retorica', label: 'Discurso', directed: true },
        { id: 'e14', sourceId: 'node-organon', targetId: 'node-silogismo', label: 'Deducción', directed: true },
        { id: 'e15', sourceId: 'node-organon', targetId: 'node-categorias-log', label: 'Gramática ontológica', directed: true }
      ],
      generalKnowledgeSupplement: 'General knowledge supplement: La división tripartita aristotélica del conocimiento en ciencias teóricas, prácticas y poiéticas fue la base organizativa del saber hasta el Renacimiento.',
      citations: []
    }
  },

  // 5. Practice Problems
  {
    kind: 'practice_problems',
    title: 'Problemas Prácticos: Silogística Aristotélica y Deliberación Ética',
    content: {
      title: 'Problemas Prácticos: Silogística Aristotélica y Deliberación Ética',
      overview: 'Ejercicios guiados paso a paso para resolver problemas reales de deducción silogística formal y calibrar juicios morales mediante la doctrina del justo medio.',
      difficulty: 'medium',
      sourceIds: [],
      problems: [
        {
          id: 'prob-silogismo-barbara',
          prompt: 'Analice la validez formal del siguiente argumento según las reglas de los silogismos aristotélicos de la primera figura:\nPremisa Mayor: "Todos los seres dotados de razón son capaces de deliberación ética."\nPremisa Menor: "Todos los filósofos son seres dotados de razón."\nConclusión propuesta: "Por lo tanto, todos los filósofos son capaces de deliberación ética."\nIdentifique el término medio, los términos mayor y menor, el modo y determine si incurre en alguna falacia formal.',
          givens: [
            'Premisa 1 (Mayor): Todo M es P (Universal Afirmativa "A").',
            'Premisa 2 (Menor): Todo S es M (Universal Afirmativa "A").',
            'Conclusión: Todo S es P (Universal Afirmativa "A").'
          ],
          constraints: [
            'El término medio debe estar distribuido al menos en una premisa.',
            'Ningún término puede tener mayor extensión en la conclusión que en las premisas.',
            'De dos premisas afirmativas se sigue necesariamente conclusión afirmativa.'
          ],
          hints: [
            'Considere la clásica figura silogística mnemotécnica de la primera figura: Barbara (A-A-A).',
            'El término medio (M) aparece en ambas premisas pero debe desaparecer en la conclusión.'
          ],
          steps: [
            {
              id: 'step-identificar-terminos',
              title: 'Paso 1: Identificación de los tres términos',
              explanation: 'Término Menor (S, sujeto de la conclusión): "los filósofos". Término Mayor (P, predicado de la conclusión): "capaces de deliberación ética". Término Medio (M, conector presente en ambas premisas): "seres dotados de razón".',
              sourceIds: []
            },
            {
              id: 'step-determinar-figura-modo',
              title: 'Paso 2: Determinación de la figura y el modo',
              explanation: 'Disposición de términos: M-P (Mayor), S-M (Menor) -> Primera Figura. Cualidad y cantidad de proposiciones: Tres proposiciones universales afirmativas ("A"), lo que corresponde al modo A-A-A (tradicionalmente denominado "Barbara").',
              sourceIds: []
            },
            {
              id: 'step-verificar-reglas',
              title: 'Paso 3: Verificación de las leyes silogísticas',
              explanation: 'El término medio "seres dotados de razón" está distribuido en la premisa mayor. No hay término ilícito porque S y P mantienen exactamente la misma distribución universal en las premisas y la conclusión. No hay premisas negativas.',
              sourceIds: []
            }
          ],
          answer: 'El silogismo es plenamente VÁLIDO. Corresponde a la Primera Figura en el modo "Barbara" (A-A-A). El término medio es "seres dotados de razón", el menor es "filósofos" y el mayor es "capaces de deliberación ética". No incurre en ninguna falacia formal.',
          checklist: [
            'Término medio identificado correctamente.',
            'Primera figura reconocida.',
            'Modo Barbara (A-A-A) deducido.',
            'Distribución de términos verificada.'
          ],
          acceptableAlternatives: [
            'Válido en modo Barbara de la primera figura del Organon aristotélico.',
            'Silogismo categórico válido AAA-1.'
          ],
          sourceIds: []
        },
        {
          id: 'prob-justo-medio-justicia',
          prompt: 'Un magistrado debe dictar sentencia sobre un ciudadano necesitado que sustrajo grano del granero municipal durante una hambruna severa. Aplique la doctrina aristotélica del justo medio (mesotes) y la equidad (epieikeia) para deliberar sobre la pena adecuada, distinguiendo entre la aplicación ciega de la ley y la virtud de la prudencia práctica (frónesis).',
          givens: [
            'La ley municipal estipula pena de destierro y confiscación para cualquier hurto del erario público.',
            'El acusado actuó motivado por el sustento inmediato de sus hijos en estado de inanición evidente.',
            'La ciudad se precia de buscar la justicia comunitaria y la concordia ciudadana.'
          ],
          constraints: [
            'No se puede incurrir en la debilidad de la indulgencia anárquica (defecto de rigor que anula la ley).',
            'No se puede incurrir en la crueldad tiránica de la justicia sumaria inflexible (exceso de rigor).',
            'Debe aplicarse la equidad (epieikeia) como corrección de la justicia legal abstracta.'
          ],
          hints: [
            'Recuerde que en el Libro V de la Ética a Nicómaco, la equidad es superior a la justicia legal abstracta porque adapta la regla general a las irregularidades del caso particular como una regla de plomo de Lesbos.',
            'La frónesis busca el justo medio relativo a las circunstancias y personas concretas.'
          ],
          steps: [
            {
              id: 'step-analisis-extremos',
              title: 'Paso 1: Delimitación de los extremos viciosos',
              explanation: 'Exceso: Aplicar con rigor inflexible la ley general de destierro ignorando la fuerza mayor del hambre extrema, destruyendo al ciudadano. Defecto: Absolver de plano sin ninguna restitución o labor comunitaria, sentando un precedente que debilita el respeto por las normas de la polis.',
              sourceIds: []
            },
            {
              id: 'step-aplicacion-epieikeia',
              title: 'Paso 2: Aplicación del principio de equidad (epieikeia)',
              explanation: 'El legislador redactó la ley pensando en el ladrón común malicioso, no en el padre que busca evitar la muerte por hambruna. La equidad actúa aquí como rectificación de la ley universal ante la particularidad del hecho no previsto.',
              sourceIds: []
            },
            {
              id: 'step-solucion-virtuosa',
              title: 'Paso 3: Determinación prudencial de la sentencia equitativa',
              explanation: 'El magistrado virtuoso conmutará el destierro por un servicio cívico comunitario proporcional cuando las condiciones lo permitan, asegurando que la comunidad asista a la familia y restaurando tanto la justicia como la dignidad de la polis.',
              sourceIds: []
            }
          ],
          answer: 'La solución aristotélica consiste en recurrir a la equidad (epieikeia) guiada por la frónesis: corregir la rigidez de la ley escrita y conmutar la pena de destierro por una medida reparadora proporcional (servicio a la polis y auxilio alimentario), preservando el bien común sin caer ni en la crueldad desmedida ni en la impunidad.',
          checklist: [
            'Reconocimiento de los extremos de exceso y defecto.',
            'Integración de la noción de equidad (epieikeia).',
            'Justificación del dictamen desde el florecimiento de la polis.'
          ],
          acceptableAlternatives: [
            'Sentencia equitativa mediante epieikeia conmutando el castigo legal abstracto por servicio cívico.',
            'Aplicación prudencial del justo medio mediante corrección equitativa de la justicia legal.'
          ],
          sourceIds: []
        }
      ],
      generalKnowledgeSupplement: 'General knowledge supplement: Aristóteles consideraba que el juez debe ser como la "justicia animada" (dikaion empsychon), capaz de escuchar y ponderar lo que la letra fría de la ley no puede anticipar.',
      citations: []
    }
  },

  // 6. Case Study
  {
    kind: 'case_study',
    title: 'Estudio de Caso: La Deliberación del Consejo Médico en Tiempos de Crisis',
    content: {
      title: 'Estudio de Caso: La Deliberación del Consejo Médico en Tiempos de Crisis',
      learningObjectives: [
        'Aplicar la ética de la virtud y la prudencia práctica (frónesis) a decisiones institucionales de alta tensión.',
        'Distinguir entre el utilitarismo del cálculo de resultados y el cultivo del carácter moral aristotélico.',
        'Examinar el impacto de la deliberación cívica y la amistad política en la resolución de dilemas éticos.'
      ],
      scenario: {
        title: 'El Dilema de Asignación del Respirador Sintético en Neo-Tebas',
        setting: 'Un hospital cívico regional en una ciudad moderna afronta una escasez repentina de recursos críticos tras una catástrofe ambiental.',
        narrative: 'La Dra. Helena Ramos preside el comité de bioética del hospital central de Neo-Tebas. Tras un colapso energético que dañó los equipos de soporte vital, queda un único respirador avanzado de última generación. Hay dos pacientes en estado crítico inmediato: Mateo, un prometedor ingeniero de 24 años cuyo trabajo es esencial para restablecer el agua potable en toda la ciudad; y el Dr. Eneas, un renombrado cirujano jubilado de 72 años que ha dedicado 45 años de servicio altruista a la comunidad y que formó a la mayoría de los médicos del hospital. El comité se polariza entre aplicar un estricto algoritmo utilitarista de maximización de vidas futuras o considerar el mérito, la justicia distributiva y la gratitud cívica.',
        isFictional: true
      },
      facts: [
        'Queda exactamente un respirador funcional disponible para dos pacientes con necesidad inmediata.',
        'Mateo (24 años) tiene alta probabilidad de recuperación y sus habilidades técnicas acelerarían la recuperación sanitaria colectiva de la ciudad.',
        'El Dr. Eneas (72 años) tiene menor pronóstico de supervivencia a largo plazo pero representa la máxima encarnación del servicio abnegado a la comunidad.',
        'La política del hospital exige una resolución consensuada y transparente basada en principios éticos fundamentados.'
      ],
      questions: [
        {
          id: 'q-justicia-distributiva',
          prompt: '¿Cómo enfocaría Aristóteles la justicia distributiva (según el Libro V de la Ética a Nicómaco) en la asignación de este bien escaso?',
          hint: 'Considere la proporción geométrica: los bienes se distribuyen según el mérito y la finalidad propia del recurso.'
        },
        {
          id: 'q-fronesis-decision',
          prompt: '¿Qué papel juega la sabiduría práctica (frónesis) de la Dra. Ramos frente a la tentación de delegar la decisión en un algoritmo frío o en una moneda al aire?',
          hint: 'La virtud no consiste en eludir la responsabilidad moral mediante fórmulas matemáticas, sino en sopesar las razones con el alma virtuosa.'
        }
      ],
      analyses: [
        {
          questionId: 'q-justicia-distributiva',
          reasoning: 'Para Aristóteles, la justicia distributiva no es una igualdad aritmética simple (dar a todos lo mismo con independencia de todo), sino proporcional y geométrica (tratar lo igual de manera igual y lo desigual según su proporción). En el caso de las flautas en la Política, Aristóteles argumenta que las mejores flautas deben darse a los mejores flautistas, porque ese es el telos del instrumento. En este caso, el telos del respirador es restaurar la vida de quien mejor pueda realizar la función cívica y humana de la salud en la polis.',
          keyPoints: [
            'Justicia distributiva como proporción geométrica según el mérito y la finalidad.',
            'El telos de la medicina es el florecimiento de la vida en la comunidad.',
            'Evaluar la contribución al bien común de la polis sin caer en la deshumanización cuantitativa.'
          ],
          conceptApplications: [
            {
              concept: 'Justicia Distributiva (Dikaion Dianemetikon)',
              application: 'Distribución proporcional al mérito ético y cívico respecto del telos de la polis.',
              sourceIds: []
            }
          ],
          assumptions: [
            'Se asume que la vida y salud de ambos pacientes poseen dignidad humana intrínseca.',
            'Se presupone que el fin último de la medicina comunitaria es el bienestar y perseverancia de la polis.'
          ],
          tradeoffs: [
            'Priorizar a Mateo maximiza la utilidad técnica externa pero puede parecer ingrato con la trayectoria de Eneas.',
            'Priorizar a Eneas honra la justicia retributiva cívica pero expone a la ciudad a un colapso hídrico prolongado.'
          ],
          alternativePerspectives: [
            {
              viewpoint: 'Enfoque Utilitarista Benthamiano / Singeriano',
              reasoning: 'Calcular los Años de Vida Ajustados por Calidad (QALY) de Mateo frente a Eneas favorece netamente a Mateo por expectativa de vida y utilidad social agregada.',
              sourceIds: []
            },
            {
              viewpoint: 'Enfoque Deontológico Kantiano',
              reasoning: 'Ambos son fines en sí mismos; usar la utilidad futura de Mateo para instrumentalizar la decisión viola el imperativo categórico; exigiría un criterio imparcial ciego.',
              sourceIds: []
            }
          ],
          checklist: [
            'Proporción geométrica aristotélica explicada.',
            'Finalidad (telos) del recurso sanitario integrada.',
            'Perspectivas utilitarista y deontológica contrastadas.'
          ],
          sourceIds: []
        },
        {
          questionId: 'q-fronesis-decision',
          reasoning: 'La frónesis es la capacidad de deliberar rectamente sobre lo que es bueno y conveniente no para una parte, sino para vivir bien en su totalidad. Delegar la decisión en un sorteo o en un algoritmo rígido representaría una claudicación moral (cobardía ética) para evadir el peso del juicio humano. La Dra. Ramos debe convocar la deliberación dialogada del comité (boulé), ponderar el cuadro clínico individual con franqueza y buscar medidas integradas de confort y soporte paliativo máximo para aquel que no reciba el equipo principal.',
          keyPoints: [
            'La prudencia práctica no elude el juicio personal delegándolo en mecanismos ciegos.',
            'La deliberación colectiva en la polis fortalece la concordia y el sentido de justicia compartida.',
            'El cuidado ético abarca la atención compasiva a quien no obtiene el recurso escaso.'
          ],
          conceptApplications: [
            {
              concept: 'Frónesis (Sabiduría Práctica)',
              application: 'Capacidad deliberativa situada que sopesa circunstancias concretas sin fórmulas mecanicistas.',
              sourceIds: []
            }
          ],
          assumptions: [
            'Se presupone que los médicos tienen la competencia moral y el hábito virtuoso para deliberar con templanza.'
          ],
          tradeoffs: [
            'El juicio humano prudente asume el dolor emocional del veredicto pero preserva la agencia moral del equipo.'
          ],
          alternativePerspectives: [
            {
              viewpoint: 'Procedimentalismo Legalista',
              reasoning: 'Proteger a la institución mediante el orden estricto de llegada cronológica (first come, first served) para evitar demandas legales, a costa de ignorar la justicia material.',
              sourceIds: []
            }
          ],
          checklist: [
            'Frónesis analizada frente a la mecanización.',
            'Deliberación ética (bouleusis) descrita.',
            'Trato digno y paliativo asegurado.'
          ],
          sourceIds: []
        }
      ],
      conceptsFocus: 'Frónesis, Justicia Distributiva, Deliberación Ética, Telos Hospitalario',
      sourceIds: [],
      generalKnowledgeSupplement: 'General knowledge supplement: En la bioética contemporánea, pensadores como Edmund Pellegrino y Alasdair MacIntyre han revivido el modelo aristotélico de las virtudes frente a los modelos puramente principialistas o utilitaristas.',
      citations: []
    }
  },

  // 7. Additional Quiz
  {
    kind: 'quiz',
    title: 'Evaluación Avanzada: Metafísica, Lógica y Política de Aristóteles',
    content: {
      title: 'Evaluación Avanzada: Metafísica, Lógica y Política de Aristóteles',
      questions: [
        {
          id: 'q1-hilemorfismo',
          prompt: '¿En qué consiste el principio ontológico del "hilemorfismo" formulado por Aristóteles?',
          topic: 'Metafísica',
          hint: 'Analice la etimología de hyle y morphe.',
          options: [
            {
              id: 'opt1-a',
              text: 'En la afirmación de que toda sustancia sensible corpórea es un compuesto inseparable de materia y forma.',
              explanation: 'Correcto. Para Aristóteles, materia (hyle) y forma (morphe) no existen de modo separado en el mundo sensible, sino unidas formando la sustancia individual (synolon).'
            },
            {
              id: 'opt1-b',
              text: 'En la doctrina de que el alma preexiste en el mundo de las Ideas antes de encarnar en el cuerpo material.',
              explanation: 'Incorrecto. Esa es la teoría platónica de la reminiscencia y la preexistencia del alma, expresamente rechazada por Aristóteles en De Anima.'
            },
            {
              id: 'opt1-c',
              text: 'En la idea de que todo el universo físico está compuesto exclusivamente de átomos indivisibles y vacío.',
              explanation: 'Incorrecto. Esa es la postura atomista de Demócrito y Leucipo, que Aristóteles combatió abiertamente en su Física.'
            },
            {
              id: 'opt1-d',
              text: 'En la concepción de que la materia es una ilusión de los sentidos y solo la mente universal existe realmente.',
              explanation: 'Incorrecto. Esa es una tesis del idealismo inmaterialista o monismo posterior, ajena al realismo empírico aristotélico.'
            }
          ],
          correctOptionId: 'opt1-a'
        },
        {
          id: 'q2-primer-motor',
          prompt: '¿Por qué concibe Aristóteles al "Primer Motor Inmóvil" como "Acto Puro" sin potencia alguna?',
          topic: 'Teología Filosófica',
          hint: 'Considere la relación entre cambio, potencia y regresión al infinito.',
          options: [
            {
              id: 'opt2-a',
              text: 'Porque si tuviese potencia podría dejar de mover o cambiar, lo que requeriría un motor previo y llevaría a una regresión al infinito en la explicación del movimiento.',
              explanation: 'Correcto. Todo lo que está en potencia necesita algo en acto para actualizarse. El principio primero causante del movimiento eterno debe ser acto puro sin mezcla de potencia pasiva.'
            },
            {
              id: 'opt2-b',
              text: 'Porque creó el mundo de la nada en un momento determinado del tiempo mediante un acto de voluntad libre.',
              explanation: 'Incorrecto. Para Aristóteles el universo y el movimiento son eternos, sin creación ex nihilo temporal; el Primer Motor mueve atrayendo como objeto de amor y deseo (causa final).'
            },
            {
              id: 'opt2-c',
              text: 'Porque castiga y premia a los seres humanos según sus actos en la vida terrenal.',
              explanation: 'Incorrecto. El Primer Motor aristotélico es "noesis noeseos" (pensamiento que se piensa a sí mismo), ajeno e indiferente al devenir humano individual.'
            },
            {
              id: 'opt2-d',
              text: 'Porque es una energía mecánica difusa extendida a través del espacio cósmico infinito.',
              explanation: 'Incorrecto. No tiene extensión espacial ni partes materiales; es una sustancia inmaterial enteramente trascendente.'
            }
          ],
          correctOptionId: 'opt2-a'
        },
        {
          id: 'q3-zoon-politikon',
          prompt: '¿Qué cualidad natural distingue al ser humano como "zoon politikon" frente a los animales gregarios?',
          topic: 'Filosofía Política',
          hint: 'Considere el Libro I de la Política y el don del lenguaje racional.',
          options: [
            {
              id: 'opt3-a',
              text: 'La posesión del lógos (lenguaje racional), que le permite discernir y comunicar lo justo, lo injusto, lo bueno y lo conveniente.',
              explanation: 'Correcto. Mientras la voz (phone) de los animales solo expresa placer o dolor, el lógos humano permite la deliberación moral y la fundación de leyes en la polis.'
            },
            {
              id: 'opt3-b',
              text: 'La mayor fuerza física y agresividad territorial para someter a otras tribus vecinas.',
              explanation: 'Incorrecto. Aristóteles sitúa la diferencia en la dimensión moral e intelectual, no en la fuerza física o el instinto bélico.'
            },
            {
              id: 'opt3-c',
              text: 'La capacidad de vivir en soledad absoluta y autosuficiente sin necesidad de convivencia ciudadana.',
              explanation: 'Incorrecto. Aristóteles señala célebremente que quien no puede vivir en sociedad o no necesita nada para su suficiencia es o una bestia o un dios.'
            },
            {
              id: 'opt3-d',
              text: 'El establecimiento de un pacto artificial de no agresión movido por el miedo al estado de naturaleza.',
              explanation: 'Incorrecto. Esa es la teoría contractualista moderna de Thomas Hobbes, contraria a la sociabilidad natural teleológica de Aristóteles.'
            }
          ],
          correctOptionId: 'opt3-a'
        }
      ],
      generalKnowledgeSupplement: 'General knowledge supplement: Aristóteles consideraba la política como la ciencia arquitectónica suprema porque determina qué disciplinas deben enseñarse en la ciudad y ordena todas las actividades hacia el bien supremo común.',
      citations: []
    }
  }
];

async function seed() {
  console.log(`Starting seeding of study materials for notebook: ${NOTEBOOK_ID}`);
  for (const item of materials) {
    try {
      console.log(`Creating study material: [${item.kind}] "${item.title}"...`);
      const res = await fetch(`${BASE_URL}/notebooks/${NOTEBOOK_ID}/study-materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(`Failed to create ${item.title}: ${res.status} - ${text}`);
      } else {
        const data = await res.json();
        console.log(`Created successfully! ID: ${data.id}`);
      }
    } catch (err) {
      console.error(`Error creating ${item.title}:`, err);
    }
  }
  console.log('Seeding finished!');
}

seed();
