window.PESCA_CONFIG = {
  timezone: 'Europe/Lisbon',
  defaultZone: 'ponta',
  defaultTab: 'meteorologia',
  refreshMinutes: 10,
  horizonHours: 72,
  zones: {
    ria: {
      id: 'ria',
      name: 'Sul / Ria Formosa',
      shortName: 'Sul / Ria',
      icon: '〰️',
      color: 'green',
      coords: { lat: 36.9738, lon: -7.8374 },
      type: 'Ria, canais e zonas abrigadas',
      description: 'Mais influenciada pela maré, corrente nos canais e vento local.',
      bestHint: 'Maré a mexer, vento fraco e pouca luz.',
      avoidHint: 'Evitar estofo da maré e zonas sem movimento de água.',
      species: ['Dourada', 'Robalo', 'Tainha', 'Linguado', 'Enguia'],
      weights: { tide: 35, sea: 10, wind: 20, light: 15, water: 10, moon: 5, pressure: 5 },
      limits: { windWarn: 25, gustWarn: 35, waveWarn: 0.8, waveBlock: 1.2 }
    },
    atlantico: {
      id: 'atlantico',
      name: 'Norte / Atlântico',
      shortName: 'Norte',
      icon: '🌊',
      color: 'blue',
      coords: { lat: 36.9657, lon: -7.8289 },
      type: 'Praia aberta e mar oceânico',
      description: 'Mais influenciada pela ondulação, período, vento e segurança na praia.',
      bestHint: 'Meia maré, onda controlada e nascer ou pôr do sol.',
      avoidHint: 'Evitar mar grande, shorebreak e vento forte de frente.',
      species: ['Robalo', 'Sargo', 'Dourada', 'Linguado'],
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
      species: ['Robalo', 'Sargo', 'Dourada', 'Corvina'],
      weights: { tide: 30, sea: 20, wind: 20, light: 15, water: 8, moon: 4, pressure: 3 },
      limits: { windWarn: 22, gustWarn: 32, waveWarn: 1.0, waveBlock: 1.4 }
    }
  },
  speciesRules: {
    Robalo: { zones: ['ria', 'atlantico', 'ponta'], bestWave: [0.4, 1.2], bestWindMax: 24, bestLight: true, bestTide: ['A subir', 'A descer'] },
    Sargo: { zones: ['atlantico', 'ponta'], bestWave: [0.5, 1.4], bestWindMax: 28, bestLight: false, bestTide: ['A subir', 'A descer'] },
    Dourada: { zones: ['ria', 'atlantico', 'ponta'], bestWave: [0.0, 0.9], bestWindMax: 22, bestLight: false, bestTide: ['A subir'] },
    Tainha: { zones: ['ria'], bestWave: [0.0, 0.5], bestWindMax: 22, bestLight: false, bestTide: ['A subir', 'A descer'] },
    Linguado: { zones: ['ria', 'atlantico'], bestWave: [0.0, 0.8], bestWindMax: 20, bestLight: true, bestTide: ['A subir'] },
    Enguia: { zones: ['ria'], bestWave: [0.0, 0.4], bestWindMax: 20, bestLight: true, bestTide: ['A subir', 'A descer'] },
    Corvina: { zones: ['ponta'], bestWave: [0.3, 1.0], bestWindMax: 24, bestLight: true, bestTide: ['A subir', 'A descer'] }
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
      waveDirectionText: 'SW',
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
