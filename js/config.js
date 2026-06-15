(function () {
  window.PESCA_CONFIG = {
    appName: 'Pesca Culatra',
    timezone: 'Europe/Lisbon',
    refreshMinutes: 45,
    apiKeys: {
      // Opcional: preencher para obter marés reais via serviço externo.
      // Nunca publiques chaves privadas em repositórios públicos.
      worldTides: '',
      stormglass: ''
    },
    coordinates: {
      // Coordenadas aproximadas. Ajustar depois com validação local.
      ria: { lat: 36.9738, lon: -7.8374 },
      atlantico: { lat: 36.9657, lon: -7.8289 },
      ponta: { lat: 36.9584, lon: -7.8048 }
    },
    thresholds: {
      windWarnKmh: 25,
      gustAlertKmh: 35,
      atlanticWaveWarnM: 1.2,
      atlanticWaveAlertM: 1.5,
      strongCurrentAmplitudeM: 2.5
    }
  };
})();
