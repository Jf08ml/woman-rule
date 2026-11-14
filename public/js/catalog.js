// Catálogo de opciones de registro y contenido informativo.
// `icon` es el nombre de un icono del sprite (ver icons.js); `n` repite el icono (intensidad).
export const FLOW = [
  { id: 'spotting', label: 'Manchado', icon: 'dot' },
  { id: 'light', label: 'Ligero', icon: 'droplet', n: 1 },
  { id: 'medium', label: 'Medio', icon: 'droplet', n: 2 },
  { id: 'heavy', label: 'Abundante', icon: 'droplet', n: 3 },
];

export const SYMPTOMS = [
  { id: 'cramps', label: 'Cólicos', icon: 'zap' },
  { id: 'headache', label: 'Dolor de cabeza', icon: 'brain' },
  { id: 'migraine', label: 'Migraña', icon: 'activity' },
  { id: 'tender', label: 'Senos sensibles', icon: 'heart' },
  { id: 'bloating', label: 'Hinchazón', icon: 'circle-dashed' },
  { id: 'acne', label: 'Acné', icon: 'scan-face' },
  { id: 'backache', label: 'Dolor de espalda', icon: 'person-standing' },
  { id: 'fatigue', label: 'Fatiga', icon: 'battery-low' },
  { id: 'nausea', label: 'Náuseas', icon: 'waves' },
  { id: 'cravings', label: 'Antojos', icon: 'cookie' },
  { id: 'insomnia', label: 'Insomnio', icon: 'moon-star' },
  { id: 'dizziness', label: 'Mareo', icon: 'orbit' },
  { id: 'pelvic', label: 'Dolor pélvico', icon: 'target' },
  { id: 'diarrhea', label: 'Diarrea', icon: 'circle-gauge' },
  { id: 'constipation', label: 'Estreñimiento', icon: 'circle-slash' },
  { id: 'hotflash', label: 'Sofocos', icon: 'flame' },
  { id: 'jointpain', label: 'Dolor articular', icon: 'bone' },
  { id: 'fine', label: 'Todo bien', icon: 'thumbs-up' },
];

export const MOODS = [
  { id: 'happy', label: 'Feliz', icon: 'smile' },
  { id: 'calm', label: 'Tranquila', icon: 'leaf' },
  { id: 'energetic', label: 'Con energía', icon: 'battery-full' },
  { id: 'confident', label: 'Segura', icon: 'badge-check' },
  { id: 'libido', label: 'Libido alta', icon: 'flame' },
  { id: 'sensitive', label: 'Sensible', icon: 'feather' },
  { id: 'swings', label: 'Cambios de humor', icon: 'shuffle' },
  { id: 'irritable', label: 'Irritable', icon: 'angry' },
  { id: 'anxious', label: 'Ansiosa', icon: 'annoyed' },
  { id: 'sad', label: 'Triste', icon: 'frown' },
  { id: 'apathetic', label: 'Apática', icon: 'meh' },
  { id: 'stressed', label: 'Estresada', icon: 'cloud-lightning' },
];

export const DISCHARGE = [
  { id: 'none', label: 'Sin flujo', icon: 'circle' },
  { id: 'sticky', label: 'Pegajoso', icon: 'circle-dot' },
  { id: 'creamy', label: 'Cremoso', icon: 'cloud' },
  { id: 'eggwhite', label: 'Clara de huevo', icon: 'egg' },
  { id: 'watery', label: 'Acuoso', icon: 'droplets' },
  { id: 'unusual', label: 'Inusual', icon: 'triangle-alert' },
];

// Intimidad: `log.sex` = 'yes' (sin detalle) | 'protected' | 'unprotected'; `log.solo` = momento a solas.
// Registros antiguos pueden traer sex = 'none' | 'solo'.
export const SEX = [
  { id: 'protected', label: 'Con protección', icon: 'shield' },
  { id: 'unprotected', label: 'Sin protección', icon: 'heart-pulse' },
];
export const madeLove = (log) => ['yes', 'protected', 'unprotected'].includes(log.sex);
export const soloTime = (log) => !!log.solo || log.sex === 'solo';

export const OV_TEST = [
  { id: 'negative', label: 'Negativo', icon: 'minus' },
  { id: 'positive', label: 'Positivo', icon: 'plus' },
];

export const PREG_TEST = [
  { id: 'negative', label: 'Negativo', icon: 'minus' },
  { id: 'faint', label: 'Línea tenue', icon: 'circle-dashed' },
  { id: 'positive', label: 'Positivo', icon: 'plus' },
];

export const label = (list, id) => list.find((x) => x.id === id)?.label ?? id;
export const option = (list, id) => list.find((x) => x.id === id);

export const PHASES = {
  menstrual: {
    name: 'Fase menstrual',
    desc: 'Tu cuerpo elimina el revestimiento del útero. Los niveles de estrógeno y progesterona están bajos.',
    tips: ['Prioriza el descanso y el sueño.', 'El calor local ayuda con los cólicos.', 'Alimentos ricos en hierro: lentejas, espinaca, carnes magras.', 'Movimiento suave: caminar, yoga o estiramientos.'],
  },
  follicular: {
    name: 'Fase folicular',
    desc: 'El estrógeno sube y prepara la ovulación. Muchas personas notan más energía y mejor ánimo.',
    tips: ['Buen momento para entrenamientos más intensos.', 'Tu creatividad y motivación suelen estar altas.', 'Incluye proteínas y verduras frescas.'],
  },
  fertile: {
    name: 'Ventana fértil',
    desc: 'Días con mayor probabilidad de embarazo. El flujo puede volverse transparente y elástico.',
    tips: ['Si buscas embarazo, estos son tus días clave.', 'Si no, usa un método anticonceptivo fiable.', 'Las pruebas de ovulación detectan el pico de LH.'],
  },
  ovulation: {
    name: 'Día de ovulación',
    desc: 'Se libera un óvulo. Es el día de mayor fertilidad estimada del ciclo.',
    tips: ['La temperatura basal sube ligeramente después de ovular.', 'Algunas personas sienten una leve molestia pélvica.'],
  },
  luteal: {
    name: 'Fase lútea',
    desc: 'La progesterona aumenta. Pueden aparecer síntomas premenstruales (SPM) hacia el final.',
    tips: ['Reduce cafeína y sal si notas hinchazón.', 'El magnesio (cacao, frutos secos) puede aliviar el SPM.', 'Sé amable contigo: el ánimo puede variar.'],
  },
  late: {
    name: 'Periodo retrasado',
    desc: 'Tu periodo no ha llegado en la fecha estimada. El estrés, viajes o cambios de rutina pueden retrasarlo.',
    tips: ['Si hubo relaciones sin protección, considera una prueba de embarazo.', 'Si el retraso es frecuente, coméntalo con tu médico.'],
  },
};

// Tamaño aproximado del bebé por semana de embarazo
export const BABY = {
  4: 'una semilla de amapola', 5: 'una semilla de sésamo', 6: 'una lenteja', 7: 'un arándano', 8: 'una frambuesa',
  9: 'una cereza', 10: 'una fresa', 11: 'un higo', 12: 'una lima', 13: 'un limón', 14: 'un melocotón', 15: 'una manzana',
  16: 'un aguacate', 17: 'una pera', 18: 'un pimiento', 19: 'un tomate grande', 20: 'un plátano', 21: 'una zanahoria',
  22: 'una papaya', 23: 'un pomelo', 24: 'una mazorca de maíz', 25: 'una coliflor', 26: 'una lechuga', 27: 'un brócoli grande',
  28: 'una berenjena', 29: 'una calabaza pequeña', 30: 'un repollo', 31: 'un coco', 32: 'una jícama', 33: 'una piña',
  34: 'un melón cantalupo', 35: 'un melón', 36: 'una lechuga romana', 37: 'una acelga', 38: 'un puerro',
  39: 'una sandía pequeña', 40: 'una sandía',
};
export const babyFor = (week) => BABY[Math.min(40, Math.max(4, week))];
