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
      avoidHint: 'Evitar mar grande, rebentação forte junto à praia e vento forte de frente.',
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
      zones: ['ria', 'atlantico', 'ponta'], bestWave: [0.3, 1.3], bestWindMax: 24, bestLight: true, bestTide: ['A subir', 'A descer'],
      strongMonths: [1, 2, 3, 9, 10, 11, 12], mediumMonths: [4, 5, 6, 7, 8],
      tideText: 'última enchente e primeira vazante; usa a corrente para emboscar nas bordas de canal e nas valas',
      placeText: 'na Ria rende em bordos de canal e bocas de esteiro; na costa procura valas, espuma e pouca luz'
    },
    Dourada: {
      zones: ['ria', 'atlantico', 'ponta'], bestWave: [0.0, 0.9], bestWindMax: 22, bestLight: false, bestTide: ['A subir'],
      strongMonths: [7, 8, 9, 10, 11], mediumMonths: [4, 5, 6, 12],
      tideText: 'enchente a correr e início de vazante; sobe aos baixios para se alimentar e desce pelos corredores',
      placeText: 'na Ria procura baixios, canais e fundos vivos; na costa prefere praia com concha, vala e água limpa'
    },
    Sargo: {
      zones: ['ria', 'atlantico', 'ponta'], bestWave: [0.5, 1.4], bestWindMax: 28, bestLight: true, bestTide: ['A subir', 'A descer'],
      strongMonths: [9, 10, 11, 12], mediumMonths: [1, 2, 3, 4, 5, 6, 7, 8],
      tideText: 'água a correr; na costa melhora com mar mexido, espuma e pouca luz',
      placeText: 'procura estrutura, mistura de areia/concha, barras e valas com alimento em suspensão'
    },
    Corvina: {
      zones: ['atlantico', 'ponta'], bestWave: [0.3, 1.0], bestWindMax: 24, bestLight: true, bestTide: ['A subir', 'A descer'],
      strongMonths: [7, 8, 9, 10, 11], mediumMonths: [4, 5, 6, 12],
      tideText: 'vazante inicial e noites de enchente; prefere corrente organizada em água mais funda',
      placeText: 'melhor em influência de barras, canais fundos, cortes e passagens de peixe'
    },
    Linguado: {
      zones: ['ria', 'atlantico', 'ponta'], bestWave: [0.0, 0.8], bestWindMax: 20, bestLight: false, bestTide: ['A subir'],
      strongMonths: [7, 8], mediumMonths: [1, 2, 3, 4, 5, 6, 9, 10, 11, 12],
      tideText: 'enchente e topo da maré; aproveita areais limpos e transições areia/água',
      placeText: 'mais provável em canais arenosos, praia com areia limpa e zonas de transição suave'
    },
    Choco: {
      zones: ['ria'], bestWave: [0.0, 0.5], bestWindMax: 22, bestLight: true, bestTide: ['A subir', 'A descer'],
      strongMonths: [4, 5, 6, 7, 8], mediumMonths: [1, 2, 3, 9, 10, 11],
      tideText: 'corrente moderada, muitas vezes do fim da enchente ao arranque da vazante',
      placeText: 'mais lógico dentro da Ria, em bordos de ervas e fundo limpo, com trabalho junto ao fundo'
    },
    Lula: {
      zones: ['ria', 'atlantico', 'ponta'], bestWave: [0.0, 0.7], bestWindMax: 20, bestLight: true, bestTide: ['A subir', 'A descer'],
      strongMonths: [9, 10, 11], mediumMonths: [4, 5, 6, 7, 8, 12],
      tideText: 'estofa curta e início da corrida, sobretudo ao fim da tarde e de noite',
      placeText: 'na Ria procura bordos de canal e zonas com luz; na costa só com mar calmo e pouca rebentação'
    },
    Polvo: {
      zones: ['ria', 'atlantico', 'ponta'], bestWave: [0.0, 0.9], bestWindMax: 20, bestLight: false, bestTide: ['A subir', 'A descer'],
      strongMonths: [9, 10, 11, 12, 1, 2, 3], mediumMonths: [4, 5, 6, 7, 8],
      tideText: 'corrente fraca a moderada; evita extremos de turbulência',
      placeText: 'precisa de fundos com abrigo, taludes e estrutura; atenção a seletividade e enquadramento legal'
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
