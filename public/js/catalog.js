// Catálogo de opciones de registro y contenido informativo.
export const FLOW = [
  { id: 'spotting', label: 'Manchado', icon: '·' },
  { id: 'light', label: 'Ligero', icon: '💧' },
  { id: 'medium', label: 'Medio', icon: '💧💧' },
  { id: 'heavy', label: 'Abundante', icon: '💧💧💧' },
];

export const SYMPTOMS = [
  { id: 'cramps', label: 'Cólicos', icon: '⚡' },
  { id: 'headache', label: 'Dolor de cabeza', icon: '🤕' },
  { id: 'migraine', label: 'Migraña', icon: '🌀' },
  { id: 'tender', label: 'Senos sensibles', icon: '🫶' },
  { id: 'bloating', label: 'Hinchazón', icon: '🎈' },
  { id: 'acne', label: 'Acné', icon: '🔴' },
  { id: 'backache', label: 'Dolor de espalda', icon: '🦴' },
  { id: 'fatigue', label: 'Fatiga', icon: '🥱' },
  { id: 'nausea', label: 'Náuseas', icon: '🤢' },
  { id: 'cravings', label: 'Antojos', icon: '🍫' },
  { id: 'insomnia', label: 'Insomnio', icon: '🌙' },
  { id: 'dizziness', label: 'Mareo', icon: '💫' },
  { id: 'pelvic', label: 'Dolor pélvico', icon: '🎯' },
  { id: 'diarrhea', label: 'Diarrea', icon: '🚽' },
  { id: 'constipation', label: 'Estreñimiento', icon: '🧱' },
  { id: 'hotflash', label: 'Sofocos', icon: '🔥' },
  { id: 'jointpain', label: 'Dolor articular', icon: '🦵' },
  { id: 'fine', label: 'Todo bien', icon: '👍' },
];

export const MOODS = [
  { id: 'happy', label: 'Feliz', icon: '😊' },
  { id: 'calm', label: 'Tranquila', icon: '😌' },
  { id: 'energetic', label: 'Con energía', icon: '⚡' },
  { id: 'confident', label: 'Segura', icon: '💪' },
  { id: 'libido', label: 'Libido alta', icon: '🔥' },
  { id: 'sensitive', label: 'Sensible', icon: '🥺' },
  { id: 'swings', label: 'Cambios de humor', icon: '🎢' },
  { id: 'irritable', label: 'Irritable', icon: '😤' },
  { id: 'anxious', label: 'Ansiosa', icon: '😰' },
  { id: 'sad', label: 'Triste', icon: '😢' },
  { id: 'apathetic', label: 'Apática', icon: '😶' },
  { id: 'stressed', label: 'Estresada', icon: '🤯' },
];

export const DISCHARGE = [
  { id: 'none', label: 'Sin flujo', icon: '○' },
  { id: 'sticky', label: 'Pegajoso', icon: '◔' },
  { id: 'creamy', label: 'Cremoso', icon: '◑' },
  { id: 'eggwhite', label: 'Clara de huevo', icon: '🥚' },
  { id: 'watery', label: 'Acuoso', icon: '💦' },
  { id: 'unusual', label: 'Inusual', icon: '⚠️' },
];

export const SEX = [
  { id: 'none', label: 'Sin relaciones', icon: '—' },
  { id: 'protected', label: 'Protegidas', icon: '🛡️' },
  { id: 'unprotected', label: 'Sin protección', icon: '❤️' },
  { id: 'solo', label: 'Masturbación', icon: '✨' },
];

export const OV_TEST = [
  { id: 'negative', label: 'Negativo', icon: '−' },
  { id: 'positive', label: 'Positivo', icon: '+' },
];

export const PREG_TEST = [
  { id: 'negative', label: 'Negativo', icon: '−' },
  { id: 'faint', label: 'Línea tenue', icon: '±' },
  { id: 'positive', label: 'Positivo', icon: '+' },
];

export const label = (list, id) => list.find((x) => x.id === id)?.label ?? id;

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

// Tamaño del bebé por semana de embarazo (aprox.)
export const BABY = {
  4: ['una semilla de amapola', '🌱'], 5: ['una semilla de sésamo', '🌱'], 6: ['una lenteja', '🫘'], 7: ['un arándano', '🫐'],
  8: ['una frambuesa', '🍓'], 9: ['una cereza', '🍒'], 10: ['una fresa', '🍓'], 11: ['un higo', '🫒'], 12: ['una lima', '🍋'],
  13: ['un limón', '🍋'], 14: ['un melocotón', '🍑'], 15: ['una manzana', '🍎'], 16: ['un aguacate', '🥑'], 17: ['una pera', '🍐'],
  18: ['un pimiento', '🫑'], 19: ['un tomate grande', '🍅'], 20: ['un plátano', '🍌'], 21: ['una zanahoria', '🥕'],
  22: ['una papaya', '🥭'], 23: ['un pomelo', '🍊'], 24: ['una mazorca de maíz', '🌽'], 25: ['una coliflor', '🥦'],
  26: ['una lechuga', '🥬'], 27: ['un brócoli grande', '🥦'], 28: ['una berenjena', '🍆'], 29: ['una calabaza pequeña', '🎃'],
  30: ['un repollo', '🥬'], 31: ['un coco', '🥥'], 32: ['una jícama', '🥔'], 33: ['una piña', '🍍'], 34: ['un melón cantalupo', '🍈'],
  35: ['un melón', '🍈'], 36: ['una lechuga romana', '🥬'], 37: ['una acelga', '🥬'], 38: ['un puerro', '🧅'],
  39: ['una sandía pequeña', '🍉'], 40: ['una sandía', '🍉'],
};
export const babyFor = (week) => BABY[Math.min(40, Math.max(4, week))];
