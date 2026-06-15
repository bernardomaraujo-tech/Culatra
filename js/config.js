window.PESCA_CONFIG = {
  timezone: 'Europe/Lisbon',
  defaultZone: 'ponta',
  defaultTab: 'meteorologia',
  refreshMinutes: 10,
  horizonHours: 72,
  zones: {
    ria: {
      id: 'ria',
      name: 'Norte / Ria Formosa',
      shortName: 'Norte / Ria',
      icon: '〰️',
      color: 'green',
      coords: { lat: 36.9738, lon: -7.8374 },
      type: 'Ria, canais e zonas abrigadas',
      description: 'Face interior, mais influenciada pela maré, corrente nos canais e vento local.',
      bestHint: 'Maré a mexer, vento fraco e pouca luz.',
      avoidHint: 'Evitar estofo da maré e zonas sem movimento de água.',
      species: ['Robalo', 'Dourada', 'Sargo', 'Linguado', 'Choco', 'Lula', 'Polvo'],
      weights: { tide: 35, sea: 10, wind: 20, light: 15, water: 10, moon: 5, pressure: 5 },
      limits: { windWarn: 25, gustWarn: 35, waveWarn: 0.8, waveBlock: 1.2 }
    },
    atlantico: {
      id: 'atlantico',
      name: 'Sul / Atlântico',
      shortName: 'Sul / Atlântico',
      icon: '🌊',
      color: 'blue',
      coords: { lat: 36.9657, lon: -7.8289 },
      type: 'Praia aberta e mar oceânico',
      description: 'Face oceânica, mais influenciada pela ondulação, período, vento e segurança na praia.',
      bestHint: 'Meia maré, onda controlada e nascer ou pôr do sol.',
      avoidHint: 'Evitar mar grande, shorebreak e vento forte de frente.',
      species: ['Robalo', 'Dourada', 'Sargo', 'Corvina', 'Linguado', 'Lula', 'Polvo'],
      weights: { tide: 20, sea: 30, wind: 20, light: 15, water: 8, moon: 4, pressure: 3 },
      limits: { windWarn: 25, gustWarn: 35, waveWarn: 1.2, waveBlock: 1.6 }
    },
    ponta: {
      id: 'ponta',
      name: 'Ponta da Ilha',
      shortName: 'Ponta',
      icon: '⚓',
      color: 'orange',
      coords: { lat: 36.9584, lon: -7.8048 },
      type: 'Transição entre Ria e Atlântico',
      description: 'Zona com potencial, mas mais sensível a corrente, vento contra maré e ondulação.',
      bestHint: 'Corrente favorável, mar controlado e pouca luz.',
      avoidHint: 'Evitar vento forte contra maré, maré viva e corrente excessiva.',
      species: ['Robalo', 'Dourada', 'Sargo', 'Corvina', 'Linguado', 'Lula', 'Polvo'],
      weights: { tide: 30, sea: 20, wind: 20, light: 15, water: 8, moon: 4, pressure: 3 },
      limits: { windWarn: 22, gustWarn: 32, waveWarn: 1.0, waveBlock: 1.4 }
    }
  },
  speciesRules: {
    Robalo: {
      zones: ['ria', 'atlantico', 'ponta'],
      season: [22, 22, 22, 13, 13, 13, 13, 13, 22, 22, 22, 22],
      bestWave: [0.3, 1.3],
      bestWindMax: 24,
      bestLight: true,
      bestTide: ['A subir', 'A descer'],
      bestTideProgress: [[0.45, 0.88], [0.05, 0.45]],
      tideWhy: 'usa corrente e pouca luz para emboscar nas bordas de canal, bocas de esteiro, valas e cuts',
      monthWhy: 'forte no outono/inverno; médio na primavera/verão',
      zoneWhy: {
        ria: 'na Ria rende em bordos de canal, bocas de esteiro e taludes com corrente',
        atlantico: 'na costa procura valas e cortes de praia, sobretudo com pouca luz',
        ponta: 'na Ponta beneficia da mistura de água e corrente, mas exige segurança'
      }
    },
    Dourada: {
      zones: ['ria', 'atlantico', 'ponta'],
      season: [5, 5, 5, 13, 13, 13, 22, 22, 22, 22, 22, 13],
      bestWave: [0.0, 0.9],
      bestWindMax: 22,
      bestLight: false,
      bestTide: ['A subir', 'A descer'],
      bestTideProgress: [[0.15, 0.75], [0.05, 0.35]],
      tideWhy: 'sobe aos flats e fundos vivos na enchente e desce pelos corredores na vazante inicial',
      monthWhy: 'mais forte no verão e outono; média em abr-jun e dezembro',
      zoneWhy: {
        ria: 'na Ria é forte em flats, canais e transições com alimentação',
        atlantico: 'na costa rende em praias com concha, vala e água mais limpa',
        ponta: 'na Ponta aparece ligada à entrada e saída de alimento e corrente'
      }
    },
    Sargo: {
      zones: ['ria', 'atlantico', 'ponta'],
      season: [13, 13, 13, 13, 13, 13, 13, 13, 22, 22, 22, 22],
      bestWave: [0.4, 1.5],
      bestWindMax: 28,
      bestLight: true,
      bestTide: ['A subir', 'A descer'],
      bestTideProgress: [[0.15, 0.80], [0.10, 0.65]],
      tideWhy: 'circula melhor com água a correr, estrutura, espuma e alimento em suspensão',
      monthWhy: 'mais forte no outono e inverno; possível todo o ano',
      zoneWhy: {
        ria: 'na Ria aparece em estrutura, bocas e zonas com corrente',
        atlantico: 'na costa ganha valor com mar a mexer, vala, estrutura e pouca luz',
        ponta: 'na Ponta beneficia de corrente organizada e mistura de fundos'
      }
    },
    Corvina: {
      zones: ['atlantico', 'ponta', 'ria'],
      season: [5, 5, 5, 13, 13, 13, 22, 22, 22, 22, 22, 13],
      bestWave: [0.2, 1.2],
      bestWindMax: 24,
      bestLight: true,
      bestTide: ['A subir', 'A descer'],
      bestTideProgress: [[0.10, 0.55], [0.05, 0.45]],
      tideWhy: 'prefere água mais funda, noite e corrente organizada, sobretudo em vazante inicial ou enchente',
      monthWhy: 'mais forte no verão e outono; média em abr-jun e dezembro',
      zoneWhy: {
        ria: 'na Ria é mais seletiva e ligada a canais fundos e influência de barras',
        atlantico: 'na costa aparece melhor perto de influência de barras e água mais funda',
        ponta: 'na Ponta faz sentido por mistura de barra, profundidade e corrente'
      }
    },
    Linguado: {
      zones: ['ria', 'atlantico', 'ponta'],
      season: [13, 13, 13, 13, 13, 13, 22, 22, 13, 13, 13, 13],
      bestWave: [0.0, 0.8],
      bestWindMax: 20,
      bestLight: false,
      bestTide: ['A subir'],
      bestTideProgress: [[0.25, 0.85]],
      tideWhy: 'prefere enchente e topo da maré em areais limpos e canais arenosos',
      monthWhy: 'mais forte no verão; médio no resto do ano',
      zoneWhy: {
        ria: 'na Ria procura canais arenosos e transições de fundo limpo',
        atlantico: 'na costa aparece em areais, valas calmas e transições de profundidade',
        ponta: 'na Ponta é possível se houver areia limpa e mar controlado'
      }
    },
    Choco: {
      zones: ['ria'],
      season: [13, 13, 13, 22, 22, 22, 22, 22, 13, 13, 13, 5],
      bestWave: [0.0, 0.5],
      bestWindMax: 22,
      bestLight: true,
      bestTide: ['A subir', 'A descer'],
      bestTideProgress: [[0.45, 0.90], [0.05, 0.45]],
      tideWhy: 'funciona com corrente moderada, muitas vezes do fim da enchente ao arranque da vazante',
      monthWhy: 'destaca-se na primavera e início/verão dentro da Ria',
      zoneWhy: {
        ria: 'na Ria rende em bordos de ervas, fundo limpo e corrente moderada',
        atlantico: 'na costa aberta é menos regular do que dentro da Ria',
        ponta: 'na Ponta não é alvo principal face à lógica de costa'
      }
    },
    Lula: {
      zones: ['ria', 'atlantico', 'ponta'],
      season: [5, 5, 5, 13, 13, 13, 13, 13, 22, 22, 22, 13],
      bestWave: [0.0, 0.7],
      bestWindMax: 20,
      bestLight: true,
      bestTide: ['A subir', 'A descer'],
      bestTideProgress: [[0.00, 0.25], [0.00, 0.25]],
      tideWhy: 'melhora na estofa curta e início da corrida, ao fim da tarde/noite',
      monthWhy: 'cresce de interesse do fim do verão ao outono',
      zoneWhy: {
        ria: 'na Ria é lógica em bordos de canal, zonas com luz e água controlável',
        atlantico: 'na costa só ganha valor com mar arrumado, pouca rebentação e noite',
        ponta: 'na Ponta pode aparecer em noites calmas com influência de barra'
      }
    },
    Polvo: {
      zones: ['ria', 'atlantico', 'ponta'],
      season: [13, 13, 13, 13, 13, 13, 13, 13, 22, 22, 22, 22],
      bestWave: [0.0, 0.9],
      bestWindMax: 22,
      bestLight: false,
      bestTide: ['A subir', 'A descer'],
      bestTideProgress: [[0.15, 0.75], [0.15, 0.75]],
      tideWhy: 'prefere corrente fraca a moderada e evita extremos de turbulência',
      monthWhy: 'mais interessante de outono a inverno; médio no resto do ano',
      zoneWhy: {
        ria: 'na Ria aparece em abrigos, taludes e fundos com estrutura',
        atlantico: 'na costa é possível, mas menos regular a pé do que na Ria',
        ponta: 'na Ponta tem lógica em fundos com abrigo e corrente controlada'
      }
    }
  },
  fallback: {
    weather: {
      temperature: 24,
      apparentTemperature: 25,
      humidity: 64,
      precipitationProbability: 8,
      pressure: 1017,
      windSpeed: 18,
      windDirection: 45,
      windDirectionText: 'NE',
      gusts: 28,
      cloudCover: 18
    },
    marine: {
      waveHeight: 0.9,
      wavePeriod: 8,
      waveDirection: 225,
      waveDirectionText: 'SO',
      waterTemperature: 20
    },
    daily: {
      sunrise: '06:40',
      sunset: '20:30'
    },
    tide: {
      low: '08:40',
      high: '15:05',
      lowHeight: 0.7,
      highHeight: 3.3
    }
  }
};
