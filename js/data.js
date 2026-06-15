(function () {
  const zones = [
    {
      id: 'ria',
      name: 'Sul / Ria Formosa',
      shortName: 'Sul',
      subtitle: 'Ria, canais e zonas abrigadas',
      icon: '〰️',
      color: 'green',
      status: 'Bom',
      fallbackScore: 78,
      bestWindow: '06:40 - 09:10',
      species: ['Dourada', 'Robalo', 'Tainha', 'Linguado', 'Enguia'],
      notes: {
        good: 'Maré a mexer e vento controlado.',
        avoid: 'Evitar estofo da maré.'
      },
      weights: { tide: 35, sea: 10, wind: 20, light: 15, water: 10, moon: 5, pressure: 5 }
    },
    {
      id: 'atlantico',
      name: 'Norte / Atlântico',
      shortName: 'Norte',
      subtitle: 'Praia aberta e mar oceânico',
      icon: '🌊',
      color: 'blue',
      status: 'Moderado',
      fallbackScore: 54,
      bestWindow: '19:30 - 21:00',
      species: ['Robalo', 'Sargo', 'Dourada', 'Linguado'],
      notes: {
        good: 'Boa luz, mas o mar pesa mais.',
        avoid: 'Evitar mar grande e vento forte.'
      },
      weights: { tide: 20, sea: 30, wind: 20, light: 15, water: 8, moon: 4, pressure: 3 }
    },
    {
      id: 'ponta',
      name: 'Ponta da Ilha',
      shortName: 'Ponta',
      subtitle: 'Transição, corrente e maior atenção',
      icon: '⚓',
      color: 'orange',
      status: 'Atenção',
      fallbackScore: 62,
      bestWindow: '10:00 - 12:30',
      species: ['Robalo', 'Sargo', 'Dourada', 'Corvina'],
      notes: {
        good: 'Corrente favorável pode concentrar peixe.',
        avoid: 'Evitar vento forte contra a maré.'
      },
      weights: { tide: 30, sea: 20, wind: 20, light: 15, water: 8, moon: 4, pressure: 3 }
    }
  ];

  const fallback = {
    weather: {
      temperature: 24,
      apparentTemperature: 25,
      windSpeed: 18,
      windDirection: 'NE',
      gusts: 28,
      pressure: 1017,
      comfort: 'Bom',
      note: 'Manhã estável e agradável. Vento moderado.'
    },
    marine: {
      waveHeight: 0.9,
      wavePeriod: 8,
      waveDirection: 'SW',
      waterTemperature: 20,
      current: 'Forte'
    },
    tides: {
      low: '08:40',
      high: '15:05',
      amplitude: 2.6,
      phase: 'A subir'
    },
    moon: {
      phase: 'Lua crescente',
      illumination: 28,
      moonrise: '11:10',
      moonset: '01:20',
      sunrise: '06:40',
      sunset: '19:30',
      lowLightWindow: '05:30 - 07:00 e 18:30 - 20:30'
    }
  };

  window.PESCA_DATA = { zones, fallback };
})();
