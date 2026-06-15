(() => {
  const CONFIG = window.PESCA_CONFIG;
  const ZONES = CONFIG.zones;
  const zoneList = Object.values(ZONES);

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  const state = {
    zoneId: localStorage.getItem('pesca.zone') || CONFIG.defaultZone,
    tab: localStorage.getItem('pesca.tab') || CONFIG.defaultTab,
    refreshMinutes: Number(localStorage.getItem('pesca.refreshMinutes') || CONFIG.refreshMinutes),
    worldTidesKey: localStorage.getItem('pesca.worldTidesKey') || '',
    manualTide: readJson('pesca.manualTide', null),
    dataByZone: {},
    lastUpdated: null,
    nextRefreshAt: null,
    autoTimer: null,
    tickTimer: null,
    loading: false
  };

  const els = {
    content: $('#content'),
    refreshBtn: $('#refreshBtn'),
    liveStatus: $('#liveStatus'),
    lastUpdated: $('#lastUpdated'),
    nextUpdate: $('#nextUpdate'),
    summaryScore: $('#summaryScore'),
    summaryStatus: $('#summaryStatus'),
    summaryBest: $('#summaryBest'),
    summaryReason: $('#summaryReason'),
    settingsBtn: $('#settingsBtn'),
    settingsDialog: $('#settingsDialog'),
    worldTidesKey: $('#worldTidesKey'),
    refreshInterval: $('#refreshInterval'),
    saveSettings: $('#saveSettings'),
    manualTideBtn: $('#manualTideBtn'),
    tideDialog: $('#tideDialog'),
    manualLow: $('#manualLow'),
    manualHigh: $('#manualHigh'),
    manualLowHeight: $('#manualLowHeight'),
    manualHighHeight: $('#manualHighHeight'),
    saveManualTide: $('#saveManualTide'),
    clearManualTide: $('#clearManualTide')
  };

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function activeZone() {
    return ZONES[state.zoneId] || ZONES.ponta;
  }

  function setStatus(text, tone = 'loading') {
    els.liveStatus.textContent = text;
    els.liveStatus.className = `status status--${tone}`;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function formatTime(dateOrIso) {
    const date = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
    if (!Number.isFinite(date.getTime())) return '--:--';
    return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDateTime(dateOrIso) {
    const date = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
    if (!Number.isFinite(date.getTime())) return '--';
    return date.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function round(n, digits = 0) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return null;
    const p = 10 ** digits;
    return Math.round(Number(n) * p) / p;
  }

  function mean(arr) {
    const valid = arr.filter(n => Number.isFinite(n));
    if (!valid.length) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }

  function dirText(degrees) {
    if (degrees === null || degrees === undefined || Number.isNaN(Number(degrees))) return '--';
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return dirs[Math.round(Number(degrees) / 45) % 8];
  }

  function nearestIndex(times, target = Date.now()) {
    if (!times || !times.length) return 0;
    let best = 0;
    let bestDiff = Infinity;
    times.forEach((t, i) => {
      const diff = Math.abs(new Date(t).getTime() - target);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    });
    return best;
  }

  function startOfCurrentHour() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return now.getTime();
  }

  function upcomingHours(rows, count = 24) {
    const list = (rows || [])
      .filter(row => row && row.time)
      .slice()
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const cutoff = startOfCurrentHour();
    const future = list.filter(row => new Date(row.time).getTime() >= cutoff);
    return (future.length ? future : list).slice(0, count);
  }

  function directionArrowMarkup(degrees, label = '') {
    const value = Number(degrees);
    if (!Number.isFinite(value)) return '<i class="wind-arrow wind-arrow--unknown" aria-hidden="true">•</i>';
    const dir = dirText(value);
    const tooltip = label ? `${label} ${dir}` : dir;
    return `<i class="wind-arrow" style="--deg:${value}deg" title="${tooltip}" aria-label="${tooltip}">↑</i>`;
  }

  function windArrowMarkup(degrees) {
    return directionArrowMarkup(degrees, 'Vento');
  }

  async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function fetchWeather(zone) {
    const params = new URLSearchParams({
      latitude: zone.coords.lat,
      longitude: zone.coords.lon,
      timezone: CONFIG.timezone,
      forecast_days: '7',
      wind_speed_unit: 'kmh',
      hourly: [
        'temperature_2m',
        'apparent_temperature',
        'relative_humidity_2m',
        'precipitation_probability',
        'pressure_msl',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'cloud_cover'
      ].join(','),
      daily: ['sunrise', 'sunset'].join(',')
    });

    const json = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);
    const hourly = json.hourly || {};
    const daily = json.daily || {};
    return {
      hourly: (hourly.time || []).map((time, i) => ({
        time,
        temperature: round(hourly.temperature_2m?.[i], 1),
        apparentTemperature: round(hourly.apparent_temperature?.[i], 1),
        humidity: round(hourly.relative_humidity_2m?.[i]),
        precipitationProbability: round(hourly.precipitation_probability?.[i]),
        pressure: round(hourly.pressure_msl?.[i]),
        windSpeed: round(hourly.wind_speed_10m?.[i]),
        windDirection: round(hourly.wind_direction_10m?.[i]),
        windDirectionText: dirText(hourly.wind_direction_10m?.[i]),
        gusts: round(hourly.wind_gusts_10m?.[i]),
        cloudCover: round(hourly.cloud_cover?.[i])
      })),
      daily: (daily.time || []).map((date, i) => ({
        date,
        sunrise: daily.sunrise?.[i] || null,
        sunset: daily.sunset?.[i] || null
      }))
    };
  }

  async function fetchMarine(zone) {
    const params = new URLSearchParams({
      latitude: zone.coords.lat,
      longitude: zone.coords.lon,
      timezone: CONFIG.timezone,
      forecast_days: '7',
      hourly: ['wave_height', 'wave_direction', 'wave_period', 'sea_surface_temperature'].join(',')
    });
    const json = await fetchJson(`https://marine-api.open-meteo.com/v1/marine?${params}`);
    const hourly = json.hourly || {};
    return (hourly.time || []).map((time, i) => ({
      time,
      waveHeight: round(hourly.wave_height?.[i], 1),
      wavePeriod: round(hourly.wave_period?.[i]),
      waveDirection: round(hourly.wave_direction?.[i]),
      waveDirectionText: dirText(hourly.wave_direction?.[i]),
      waterTemperature: round(hourly.sea_surface_temperature?.[i], 1)
    }));
  }

  async function fetchWorldTides(zone) {
    if (!state.worldTidesKey) return null;
    const params = new URLSearchParams({
      lat: zone.coords.lat,
      lon: zone.coords.lon,
      key: state.worldTidesKey,
      extremes: 'true',
      heights: 'true',
      length: String(7 * 24 * 60 * 60),
      step: String(30 * 60)
    });
    const json = await fetchJson(`https://www.worldtides.info/api/v3?${params}`);
    if (json.error) throw new Error(json.error);
    return {
      source: 'WorldTides',
      extremes: (json.extremes || []).map(item => ({
        time: new Date(item.dt * 1000).toISOString(),
        type: item.type === 'High' ? 'high' : 'low',
        height: round(item.height, 2)
      })),
      heights: (json.heights || []).map(item => ({
        time: new Date(item.dt * 1000).toISOString(),
        height: round(item.height, 2)
      }))
    };
  }

  function estimatedTides() {
    if (state.manualTide) {
      return tidesFromManual(state.manualTide);
    }

    const periodHighHours = 12.4206;
    const anchor = new Date('2026-06-15T15:05:00+01:00');
    const lowOffsetMs = (periodHighHours / 2) * 3600000;
    const start = new Date(Date.now() - 12 * 3600000);
    const end = new Date(Date.now() + 7 * 24 * 3600000);
    const extremes = [];
    let high = new Date(anchor);
    while (high > start) high = new Date(high.getTime() - periodHighHours * 3600000);
    while (high < end) {
      const lowBefore = new Date(high.getTime() - lowOffsetMs);
      const lowAfter = new Date(high.getTime() + lowOffsetMs);
      if (lowBefore >= start && lowBefore <= end) extremes.push({ time: lowBefore.toISOString(), type: 'low', height: CONFIG.fallback.tide.lowHeight });
      if (high >= start && high <= end) extremes.push({ time: high.toISOString(), type: 'high', height: CONFIG.fallback.tide.highHeight });
      if (lowAfter >= start && lowAfter <= end) extremes.push({ time: lowAfter.toISOString(), type: 'low', height: CONFIG.fallback.tide.lowHeight });
      high = new Date(high.getTime() + periodHighHours * 3600000);
    }
    extremes.sort((a, b) => new Date(a.time) - new Date(b.time));
    return {
      source: 'Estimativa local',
      extremes,
      heights: buildTideHeights(extremes, 30)
    };
  }

  function tidesFromManual(manual) {
    const today = new Date();
    const [lh, lm] = manual.low.split(':').map(Number);
    const [hh, hm] = manual.high.split(':').map(Number);
    const low = new Date(today.getFullYear(), today.getMonth(), today.getDate(), lh, lm);
    const high = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hh, hm);
    const extremes = [];
    const periodMs = 12.4206 * 3600000;
    const lowHeight = Number(manual.lowHeight || CONFIG.fallback.tide.lowHeight);
    const highHeight = Number(manual.highHeight || CONFIG.fallback.tide.highHeight);

    for (let i = -6; i <= 14; i++) {
      extremes.push({ time: new Date(low.getTime() + i * periodMs).toISOString(), type: 'low', height: lowHeight });
      extremes.push({ time: new Date(high.getTime() + i * periodMs).toISOString(), type: 'high', height: highHeight });
    }
    extremes.sort((a, b) => new Date(a.time) - new Date(b.time));
    return { source: 'Ajuste manual', extremes, heights: buildTideHeights(extremes, 30) };
  }

  function buildTideHeights(extremes, stepMinutes = 30) {
    if (!extremes.length) return [];
    const start = new Date(Date.now() - 6 * 3600000);
    const end = new Date(Date.now() + 7 * 24 * 3600000);
    const heights = [];
    for (let t = start.getTime(); t <= end.getTime(); t += stepMinutes * 60000) {
      heights.push({ time: new Date(t).toISOString(), height: tideHeightAt(extremes, t) });
    }
    return heights;
  }

  function tideWindow(extremes, target = Date.now()) {
    const sorted = extremes.slice().sort((a, b) => new Date(a.time) - new Date(b.time));
    const previous = [...sorted].reverse().find(e => new Date(e.time).getTime() <= target) || sorted[0];
    const next = sorted.find(e => new Date(e.time).getTime() > target) || sorted[sorted.length - 1];
    return { previous, next };
  }

  function tideHeightAt(extremes, target = Date.now()) {
    const { previous, next } = tideWindow(extremes, target);
    if (!previous || !next || previous.time === next.time) return CONFIG.fallback.tide.lowHeight;
    const pTime = new Date(previous.time).getTime();
    const nTime = new Date(next.time).getTime();
    const x = clamp((target - pTime) / (nTime - pTime), 0, 1);
    const eased = (1 - Math.cos(Math.PI * x)) / 2;
    return round(previous.height + (next.height - previous.height) * eased, 2);
  }

  function tideState(tide, target = Date.now()) {
    const { previous, next } = tideWindow(tide.extremes, target);
    const height = tideHeightAt(tide.extremes, target);
    const phase = previous && next && next.type === 'high' ? 'A subir' : 'A descer';
    const progress = previous && next
      ? clamp((target - new Date(previous.time).getTime()) / (new Date(next.time).getTime() - new Date(previous.time).getTime()), 0, 1)
      : 0;
    const amplitude = previous && next ? Math.abs((next.height || 0) - (previous.height || 0)) : 0;
    const strength = amplitude >= 2.5 ? 'Forte' : amplitude >= 1.6 ? 'Moderada' : 'Fraca';
    return { previous, next, height, phase, progress, amplitude: round(amplitude, 1), strength };
  }

  function moonInfo(date = new Date()) {
    const synodic = 29.530588853;
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
    const days = (date.getTime() - knownNewMoon) / 86400000;
    const age = ((days % synodic) + synodic) % synodic;
    const illumination = round((1 - Math.cos((2 * Math.PI * age) / synodic)) / 2 * 100);
    let phase = 'Lua nova';
    if (age >= 1.85 && age < 5.54) phase = 'Crescente fina';
    else if (age >= 5.54 && age < 9.23) phase = 'Quarto crescente';
    else if (age >= 9.23 && age < 12.92) phase = 'Lua crescente';
    else if (age >= 12.92 && age < 16.61) phase = 'Lua cheia';
    else if (age >= 16.61 && age < 20.30) phase = 'Lua minguante';
    else if (age >= 20.30 && age < 23.99) phase = 'Quarto minguante';
    else if (age >= 23.99 && age < 27.68) phase = 'Minguante fina';
    const tideInfluence = phase.includes('cheia') || phase.includes('nova') ? 'Marés vivas mais prováveis' : 'Influência lunar moderada';
    return { age: round(age, 1), illumination, phase, tideInfluence };
  }

  function closestDaily(daily, time = Date.now()) {
    const dateKey = new Date(time).toISOString().slice(0, 10);
    return daily.find(d => d.date === dateKey) || daily[0] || { sunrise: null, sunset: null };
  }

  function isLowLight(time, daily) {
    const d = closestDaily(daily, new Date(time).getTime());
    const t = new Date(time).getTime();
    const sr = d.sunrise ? new Date(d.sunrise).getTime() : null;
    const ss = d.sunset ? new Date(d.sunset).getTime() : null;
    const windowMs = 90 * 60000;
    return Boolean((sr && Math.abs(t - sr) <= windowMs) || (ss && Math.abs(t - ss) <= windowMs));
  }

  function combineHourly(weatherHourly, marineHourly, daily, tide) {
    const marineByTime = new Map(marineHourly.map(m => [m.time, m]));
    return weatherHourly.slice(0, CONFIG.horizonHours).map(w => {
      const m = marineByTime.get(w.time) || nearestMarine(marineHourly, w.time) || CONFIG.fallback.marine;
      const target = new Date(w.time).getTime();
      const tideNow = tideState(tide, target);
      const moon = moonInfo(new Date(w.time));
      return {
        time: w.time,
        weather: w,
        marine: m,
        tide: tideNow,
        moon,
        lowLight: isLowLight(w.time, daily)
      };
    });
  }

  function nearestMarine(marineHourly, time) {
    if (!marineHourly.length) return null;
    return marineHourly[nearestIndex(marineHourly.map(m => m.time), new Date(time).getTime())];
  }

  function fallbackHourly(zone) {
    const out = [];
    const now = new Date();
    now.setMinutes(0, 0, 0);
    for (let i = 0; i < CONFIG.horizonHours; i++) {
      const date = new Date(now.getTime() + i * 3600000);
      const hour = date.getHours();
      const dayWave = Math.sin((hour - 6) / 24 * 2 * Math.PI);
      const windBonus = zone.id === 'ria' ? -5 : zone.id === 'atlantico' ? 1 : 0;
      out.push({
        time: date.toISOString(),
        temperature: round(CONFIG.fallback.weather.temperature + 3 * dayWave, 1),
        apparentTemperature: round(CONFIG.fallback.weather.apparentTemperature + 3 * dayWave, 1),
        humidity: CONFIG.fallback.weather.humidity,
        precipitationProbability: CONFIG.fallback.weather.precipitationProbability,
        pressure: CONFIG.fallback.weather.pressure,
        windSpeed: CONFIG.fallback.weather.windSpeed + windBonus,
        windDirection: CONFIG.fallback.weather.windDirection,
        windDirectionText: CONFIG.fallback.weather.windDirectionText,
        gusts: CONFIG.fallback.weather.gusts + windBonus,
        cloudCover: CONFIG.fallback.weather.cloudCover
      });
    }
    return out;
  }

  function fallbackMarine(zone) {
    const out = [];
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const baseWave = zone.id === 'ria' ? 0.2 : zone.id === 'atlantico' ? 0.9 : 0.8;
    for (let i = 0; i < CONFIG.horizonHours; i++) {
      const date = new Date(now.getTime() + i * 3600000);
      out.push({
        time: date.toISOString(),
        waveHeight: baseWave,
        wavePeriod: CONFIG.fallback.marine.wavePeriod,
        waveDirection: CONFIG.fallback.marine.waveDirection,
        waveDirectionText: CONFIG.fallback.marine.waveDirectionText,
        waterTemperature: CONFIG.fallback.marine.waterTemperature
      });
    }
    return out;
  }

  function fallbackDaily() {
    const out = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      out.push({
        date: ymd,
        sunrise: `${ymd}T${CONFIG.fallback.daily.sunrise}:00`,
        sunset: `${ymd}T${CONFIG.fallback.daily.sunset}:00`
      });
    }
    return out;
  }

  async function loadZone(zone) {
    let weather, marine, tide, source = [];
    try {
      weather = await fetchWeather(zone);
      source.push('Open-Meteo Weather');
    } catch (e) {
      weather = { hourly: fallbackHourly(zone), daily: fallbackDaily() };
      source.push('Meteorologia fallback');
    }

    try {
      marine = await fetchMarine(zone);
      source.push('Open-Meteo Marine');
    } catch (e) {
      marine = fallbackMarine(zone);
      source.push('Mar fallback');
    }

    try {
      tide = await fetchWorldTides(zone) || estimatedTides();
      source.push(tide.source);
    } catch (e) {
      tide = estimatedTides();
      source.push('Maré estimada');
    }

    const hourly = combineHourly(weather.hourly, marine, weather.daily, tide);
    const scored = hourly.map(item => ({ ...item, score: calculateScore(zone, item, hourly) }));
    return {
      zone,
      source,
      weatherHourly: weather.hourly,
      marineHourly: marine,
      daily: weather.daily,
      tide,
      hourly: scored,
      current: scored[nearestIndex(scored.map(h => h.time))] || scored[0]
    };
  }

  function calculateScore(zone, hour, hourly) {
    const w = zone.weights;
    const parts = {
      tide: scoreTide(zone, hour),
      sea: scoreSea(zone, hour),
      wind: scoreWind(zone, hour),
      light: scoreLight(zone, hour),
      water: scoreWater(zone, hour),
      moon: scoreMoon(hour),
      pressure: scorePressure(hour, hourly)
    };
    const totalWeight = Object.values(w).reduce((a, b) => a + b, 0);
    const score = Math.round(Object.entries(parts).reduce((acc, [key, value]) => acc + value * (w[key] || 0), 0) / totalWeight);
    const status = score >= 75 ? 'Muito bom' : score >= 65 ? 'Bom' : score >= 52 ? 'Moderado' : score >= 40 ? 'Fraco' : 'Evitar';
    const probability = clamp(Math.round(score * 0.92 + (hour.lowLight ? 5 : 0)), 5, 95);
    return { value: score, status, probability, parts };
  }

  function scoreTide(zone, hour) {
    const tide = hour.tide;
    const progress = tide.progress;
    const moving = progress > 0.12 && progress < 0.88;
    let score = moving ? 76 : 35;
    if (progress > 0.22 && progress < 0.62) score += 12;
    if (tide.phase === 'A subir') score += zone.id === 'ria' ? 8 : 4;
    if (zone.id === 'ponta' && tide.strength === 'Forte') score += 5;
    if (zone.id === 'ponta' && tide.strength === 'Forte' && hour.weather.windSpeed > zone.limits.windWarn) score -= 18;
    return clamp(score, 0, 100);
  }

  function scoreSea(zone, hour) {
    const wave = hour.marine.waveHeight ?? CONFIG.fallback.marine.waveHeight;
    const period = hour.marine.wavePeriod ?? CONFIG.fallback.marine.wavePeriod;
    if (zone.id === 'ria') return clamp(92 - wave * 35, 0, 100);
    let score = 82;
    if (wave > zone.limits.waveWarn) score -= (wave - zone.limits.waveWarn) * 45;
    if (wave > zone.limits.waveBlock) score -= 30;
    if (period >= 10 && wave > 1) score -= 10;
    if (wave >= 0.4 && wave <= 1.0 && zone.id !== 'ria') score += 8;
    return clamp(score, 0, 100);
  }

  function scoreWind(zone, hour) {
    const wind = hour.weather.windSpeed ?? CONFIG.fallback.weather.windSpeed;
    const gust = hour.weather.gusts ?? CONFIG.fallback.weather.gusts;
    let score = 95 - wind * 1.8;
    if (gust > zone.limits.gustWarn) score -= 20;
    if (wind > zone.limits.windWarn) score -= 16;
    if (zone.id === 'ponta' && wind > 18 && hour.tide.strength === 'Forte') score -= 10;
    return clamp(score, 0, 100);
  }

  function scoreLight(zone, hour) {
    const h = new Date(hour.time).getHours();
    if (hour.lowLight) return 96;
    if (h >= 5 && h <= 8) return 80;
    if (h >= 18 && h <= 21) return 80;
    if (h >= 12 && h <= 16) return 48;
    return 62;
  }

  function scoreWater(zone, hour) {
    const temp = hour.marine.waterTemperature ?? CONFIG.fallback.marine.waterTemperature;
    if (temp >= 18 && temp <= 23) return 84;
    if (temp >= 15 && temp < 18) return 68;
    if (temp > 23 && temp <= 25) return 68;
    return 54;
  }

  function scoreMoon(hour) {
    const phase = hour.moon.phase;
    if (phase.includes('cheia') || phase.includes('nova')) return 76;
    if (phase.includes('crescente') || phase.includes('minguante')) return 64;
    return 58;
  }

  function scorePressure(hour, hourly) {
    const p = hour.weather.pressure ?? CONFIG.fallback.weather.pressure;
    const idx = hourly.findIndex(h => h.time === hour.time);
    const prev = hourly[idx - 3]?.weather?.pressure;
    if (p >= 1014 && p <= 1024 && (!prev || Math.abs(p - prev) <= 3)) return 78;
    if (p < 1008) return 45;
    return 62;
  }

  function rangeLabel(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) return '--';
    const sameDay = s.toDateString() === e.toDateString();
    return sameDay ? `${formatDateTime(s)} - ${formatTime(e)}` : `${formatDateTime(s)} - ${formatDateTime(e)}`;
  }

  function bestWindows(data, minScore = 65, max = 3) {
    const hours = upcomingHours(data.hourly || [], 24);
    const windowSize = 3;
    const candidates = [];

    for (let i = 0; i <= hours.length - windowSize; i++) {
      const group = hours.slice(i, i + windowSize);
      const score = Math.round(mean(group.map(h => h.score.value)));
      if (score < minScore) continue;
      candidates.push({
        index: i,
        start: group[0].time,
        end: new Date(new Date(group[group.length - 1].time).getTime() + 3600000).toISOString(),
        score,
        reason: explainBestGroup(data.zone, group, data.tide.source)
      });
    }

    const selected = [];
    candidates
      .sort((a, b) => b.score - a.score || new Date(a.start) - new Date(b.start))
      .forEach(candidate => {
        const overlaps = selected.some(item => Math.abs(item.index - candidate.index) < windowSize);
        if (!overlaps && selected.length < max) selected.push(candidate);
      });

    return selected.sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  function avoidWindows(data, max = 3) {
    const hours = upcomingHours(data.hourly || [], 24);
    const windowSize = 2;
    const candidates = [];

    for (let i = 0; i <= hours.length - windowSize; i++) {
      const group = hours.slice(i, i + windowSize);
      const risky = group.some(h => h.score.value < 45 || h.weather.windSpeed > data.zone.limits.windWarn || h.weather.gusts > data.zone.limits.gustWarn || h.marine.waveHeight > data.zone.limits.waveBlock);
      if (!risky) continue;
      candidates.push({
        index: i,
        start: group[0].time,
        end: new Date(new Date(group[group.length - 1].time).getTime() + 3600000).toISOString(),
        score: Math.round(mean(group.map(h => h.score.value))),
        reason: explainAvoid(data.zone, group[Math.floor(group.length / 2)])
      });
    }

    const selected = [];
    candidates
      .sort((a, b) => a.score - b.score || new Date(a.start) - new Date(b.start))
      .forEach(candidate => {
        const overlaps = selected.some(item => Math.abs(item.index - candidate.index) < windowSize);
        if (!overlaps && selected.length < max) selected.push(candidate);
      });

    return selected.sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  function explainBest(zone, hour) {
    return explainBestGroup(zone, [hour]);
  }

  function explainBestGroup(zone, group, tideSource = '') {
    const bits = [];
    const phases = group.map(h => h.tide.phase).filter(Boolean);
    const uniquePhases = Array.from(new Set(phases));
    const avgWind = mean(group.map(h => h.weather.windSpeed || 0));
    const maxWave = Math.max(...group.map(h => h.marine.waveHeight || 0));

    const estimated = String(tideSource || '').toLowerCase().includes('estimativa');
    if (uniquePhases.length === 1 && uniquePhases[0] === 'A subir') bits.push(estimated ? 'maré estimada a subir' : 'maré a subir');
    else if (uniquePhases.length === 1 && uniquePhases[0] === 'A descer') bits.push(estimated ? 'maré estimada a descer' : 'maré a descer');
    else bits.push(estimated ? 'maré estimada a mexer' : 'maré a mexer');

    if (group.some(h => h.lowLight)) bits.push('pouca luz');
    if (avgWind <= zone.limits.windWarn) bits.push('vento controlado');
    if (maxWave <= zone.limits.waveWarn) bits.push('mar controlado');
    return bits.slice(0, 3).join(' + ');
  }

  function explainAvoid(zone, hour) {
    const bits = [];
    if (hour.weather.windSpeed > zone.limits.windWarn) bits.push('vento forte');
    if (hour.weather.gusts > zone.limits.gustWarn) bits.push('rajadas elevadas');
    if (hour.marine.waveHeight > zone.limits.waveWarn) bits.push('onda acima do ideal');
    if (zone.id === 'ponta' && hour.tide.strength === 'Forte') bits.push('corrente forte');
    if (!bits.length) bits.push('score baixo');
    return bits.join(' + ');
  }

  function speciesForecast(zone, hour) {
    const list = zone.species || [];
    return list.map(name => {
      const rule = CONFIG.speciesRules[name];
      if (!rule) return { name, score: 40, status: 'Sem regra', reason: 'Sem regra específica configurada.', tideReason: '' };

      const monthIndex = new Date(hour.time).getMonth();
      const season = Number(rule.season?.[monthIndex] ?? 10);
      const wave = hour.marine.waveHeight ?? 0;
      const wind = hour.weather.windSpeed ?? 0;
      const progress = hour.tide.progress ?? 0;
      const tidePhaseOk = rule.bestTide.includes(hour.tide.phase);
      const tideProgressOk = Array.isArray(rule.bestTideProgress) && rule.bestTideProgress.some(([min, max]) => progress >= min && progress <= max);
      const waveOk = wave >= rule.bestWave[0] && wave <= rule.bestWave[1];
      const windOk = wind <= rule.bestWindMax;
      const lightOk = !rule.bestLight || hour.lowLight;
      const zoneOk = rule.zones.includes(zone.id);

      let score = 28;
      score += zoneOk ? 14 : -18;
      score += season;
      score += tidePhaseOk ? 10 : -6;
      score += tideProgressOk ? 8 : 0;
      score += waveOk ? 10 : -6;
      score += windOk ? 8 : -8;
      score += lightOk ? 8 : -4;
      if (hour.moon.phase.includes('cheia') || hour.moon.phase.includes('nova')) score += 3;
      if (zone.id === 'ponta' && hour.tide.strength === 'Forte' && wind > zone.limits.windWarn) score -= 10;

      score = clamp(Math.round(score), 5, 96);
      const status = score >= 78 ? 'Boa hipótese' : score >= 63 ? 'Possível' : score >= 48 ? 'Fraca' : 'Pouco provável';
      const seasonText = season >= 20 ? 'mês forte' : season >= 12 ? 'mês médio' : 'mês fraco';
      const tideText = tidePhaseOk && tideProgressOk
        ? `${hour.tide.phase.toLowerCase()} no ponto ideal`
        : tidePhaseOk
          ? `${hour.tide.phase.toLowerCase()} compatível`
          : 'maré menos favorável';
      const conditionBits = [];
      conditionBits.push(seasonText);
      conditionBits.push(tideText);
      conditionBits.push(waveOk ? 'mar adequado' : 'mar fora do ideal');
      if (rule.bestLight) conditionBits.push(hour.lowLight ? 'pouca luz favorável' : 'faltava pouca luz');

      return {
        name,
        score,
        status,
        reason: conditionBits.join(' · '),
        tideReason: rule.tideWhy,
        zoneReason: rule.zoneWhy?.[zone.id] || zone.description,
        monthReason: rule.monthWhy
      };
    }).sort((a, b) => b.score - a.score);
  }

  function currentData() {
    return state.dataByZone[state.zoneId];
  }

  async function refreshAll() {
    if (state.loading) return;
    state.loading = true;
    setStatus('A atualizar', 'loading');
    try {
      const results = await Promise.all(zoneList.map(zone => loadZone(zone)));
      results.forEach(data => { state.dataByZone[data.zone.id] = data; });
      state.lastUpdated = new Date();
      state.nextRefreshAt = new Date(Date.now() + state.refreshMinutes * 60000);
      setStatus('Atualizado', 'ok');
      render();
      setupAutoRefresh();
    } catch (e) {
      console.error(e);
      setStatus('Dados fallback', 'warn');
      state.lastUpdated = new Date();
      render();
    } finally {
      state.loading = false;
    }
  }

  function ensureFallbackData() {
    zoneList.forEach(zone => {
      if (state.dataByZone[zone.id]) return;
      const weather = { hourly: fallbackHourly(zone), daily: fallbackDaily() };
      const marine = fallbackMarine(zone);
      const tide = estimatedTides();
      const hourly = combineHourly(weather.hourly, marine, weather.daily, tide).map(item => ({ ...item, score: calculateScore(zone, item, []) }));
      state.dataByZone[zone.id] = {
        zone,
        source: ['Fallback local'],
        weatherHourly: weather.hourly,
        marineHourly: marine,
        daily: weather.daily,
        tide,
        hourly,
        current: hourly[nearestIndex(hourly.map(h => h.time))] || hourly[0]
      };
    });
  }

  function updateHeader() {
    const data = currentData();
    const zone = activeZone();
    const cur = data.current;
    const best = bestWindows(data, 65, 1)[0];
    els.summaryScore.textContent = `${cur.score.value}/100`;
    els.summaryStatus.textContent = cur.score.status;
    els.summaryBest.textContent = best ? `${formatTime(best.start)} - ${formatTime(best.end)}` : 'Sem janela forte';
    els.summaryReason.textContent = best ? best.reason : zone.avoidHint;

    els.lastUpdated.textContent = state.lastUpdated ? `Atualizado ${formatDateTime(state.lastUpdated)}` : 'Dados iniciais';
    els.nextUpdate.textContent = state.nextRefreshAt ? `Auto: ${timeUntil(state.nextRefreshAt)}` : `Auto: ${state.refreshMinutes} min`;

    $$('.zone-chip').forEach(btn => btn.classList.toggle('is-active', btn.dataset.zone === state.zoneId));
    $$('.map-pin').forEach(btn => btn.classList.toggle('is-active', btn.dataset.zone === state.zoneId));
    $$('.tab').forEach(btn => btn.classList.toggle('is-active', btn.dataset.tab === state.tab));
  }

  function timeUntil(date) {
    const ms = Math.max(0, date.getTime() - Date.now());
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${pad(min)}:${pad(sec)}`;
  }

  function render() {
    ensureFallbackData();
    updateHeader();
    if (state.tab === 'meteorologia') renderMeteorologia();
    else if (state.tab === 'mares') renderMares();
    else if (state.tab === 'lua') renderLua();
    else renderPesca();
    requestAnimationFrame(drawCharts);
  }

  function metric(label, value, note = '', tone = '') {
    return `<article class="metric ${tone ? `metric--${tone}` : ''}"><span>${label}</span><strong>${value}</strong>${note ? `<em>${note}</em>` : ''}</article>`;
  }

  function section(title, subtitle, content) {
    return `<section class="panel"><div class="panel__header"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div></div>${content}</section>`;
  }

  function renderMeteorologia() {
    const data = currentData();
    const cur = data.current;
    const zone = data.zone;
    const next24 = upcomingHours(data.hourly, 24);
    const next12 = upcomingHours(data.hourly, 12);
    const avgWind = round(mean(next24.map(h => h.weather.windSpeed)));
    const maxGust = Math.max(...next24.map(h => h.weather.gusts || 0));
    const temps = next24.map(h => h.weather.temperature).filter(Number.isFinite);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const windTone = beachWindTone(cur.weather.windSpeed, cur.weather.gusts);
    const beach = beachDecision(zone, cur, next24);
    const dominantWind = dominantWindDirection(next24);

    els.content.innerHTML = `
      ${section('Tempo de praia', `Estado atual para ${zone.name}. Atualiza automaticamente.`, `
        <div class="beach-hero beach-hero--${beach.tone}">
          <div class="beach-score" style="--score:${beach.score}"><strong>${beach.score}</strong><span>/100</span></div>
          <div>
            <p>Condição para praia</p>
            <strong>${beach.label}</strong>
            <span>${beach.summary}</span>
          </div>
        </div>
        <div class="metrics-grid">
          ${metric('Temperatura', `${cur.weather.temperature} °C`, `sensação ${cur.weather.apparentTemperature} °C`, 'blue')}
          ${metric('Vento agora', `${cur.weather.windSpeed} km/h`, `${cur.weather.windDirectionText} · ${windBeachText(cur.weather.windSpeed)}`, windTone)}
          ${metric('Rajadas', `${cur.weather.gusts} km/h`, cur.weather.gusts > zone.limits.gustWarn ? 'atenção' : 'controladas', cur.weather.gusts > zone.limits.gustWarn ? 'warn' : 'good')}
          ${metric('Chuva', `${cur.weather.precipitationProbability}%`, 'probabilidade', cur.weather.precipitationProbability > 35 ? 'warn' : 'good')}
          ${metric('Humidade', `${cur.weather.humidity}%`, humidityText(cur.weather.humidity), '')}
          ${metric('Pressão', `${cur.weather.pressure} hPa`, pressureText(cur.weather.pressure), 'blue')}
        </div>
      `)}
      ${section('Resumo horário', 'Quadro de leitura rápida com previsão horária das próximas horas.', `
        <div class="table-scroll">
          <table class="meteo-table" aria-label="Resumo horário de meteorologia e mar">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Céu</th>
                <th>Temp.</th>
                <th>Vento</th>
                <th>Dir.<small>vento</small></th>
                <th>Onda</th>
                <th>Dir.<small>ondas</small></th>
                <th>Período<small>vaga</small></th>
              </tr>
            </thead>
            <tbody>
              ${next12.map(hourOverviewRow).join('')}
            </tbody>
          </table>
        </div>
        <p class="table-note">A tabela começa sempre na hora atual e apresenta apenas as próximas horas.</p>
      `)}
      ${section('Próximas 24 horas', 'Gráfico com temperatura e vento.', `
        <div class="chart-legend" aria-label="Legenda do gráfico">
          <span><i class="legend-dot legend-dot--temp"></i>Temperatura °C</span>
          <span><i class="legend-dot legend-dot--wind"></i>Vento km/h</span>
        </div>
        <canvas id="weatherChart" class="chart" height="190"></canvas>
      `)}
      ${section('Direção do vento', 'A direção do vento ao longo do dia ajuda a perceber conforto, abrigo e exposição da praia.', `
        <div class="carousel">
          <button class="carousel-btn" type="button" data-scroll-target="windHours" data-scroll-dir="-1" aria-label="Ver vento anterior">‹</button>
          <div id="windHours" class="wind-strip" tabindex="0">${next24.filter((_, i) => i % 2 === 0).map(hourWindDirection).join('')}</div>
          <button class="carousel-btn" type="button" data-scroll-target="windHours" data-scroll-dir="1" aria-label="Ver próximas direções do vento">›</button>
        </div>
        <div class="decision-list">
          <div><strong>Direção dominante</strong><span>${dominantWind}. Confirma no local porque na ilha pequenas mudanças de direção alteram bastante o conforto.</span></div>
          <div><strong>Vento médio</strong><span>${avgWind} km/h nas próximas 24 h, com rajada máxima prevista de ${maxGust} km/h.</span></div>
        </div>
      `)}
      ${section('Leitura para decisão', '', `
        <div class="decision-list">
          <div><strong>Resumo praia</strong><span>${beach.advice}</span></div>
          <div><strong>Variação térmica</strong><span>${round(minTemp)} °C a ${round(maxTemp)} °C nas próximas 24 h.</span></div>
          <div><strong>Impacto na zona</strong><span>${zone.description}</span></div>
          <div><strong>Nota pesca</strong><span>${weatherDecision(zone, cur)}</span></div>
        </div>
      `)}
    `;
  }

  function weatherDecision(zone, cur) {
    if (cur.weather.gusts > zone.limits.gustWarn) return 'Rajadas elevadas. Só avançar se o local estiver protegido.';
    if (cur.weather.windSpeed > zone.limits.windWarn) return 'Vento acima do ideal. Penaliza conforto e pesca.';
    if (cur.weather.precipitationProbability > 45) return 'Possibilidade de chuva relevante. Preparar alternativa.';
    return 'Condições meteorológicas utilizáveis para pesca casual.';
  }

  function beachDecision(zone, cur, next24) {
    let score = 100;
    const avgWind = mean(next24.map(h => h.weather.windSpeed));
    const maxGust = Math.max(...next24.map(h => h.weather.gusts || 0));
    const rain = cur.weather.precipitationProbability || 0;
    const temp = cur.weather.apparentTemperature || cur.weather.temperature;
    const cloud = cur.weather.cloudCover || 0;
    const referenceWind = Math.max(cur.weather.windSpeed || 0, avgWind || 0);

    // Critério praia: qualquer coisa acima de brisa deixa de ser "bom".
    if (temp < 18) score -= 30;
    else if (temp < 21) score -= 15;
    else if (temp > 32) score -= 18;
    else if (temp > 29) score -= 8;

    if (referenceWind > 30) score -= 48;
    else if (referenceWind >= 23) score -= 35;
    else if (referenceWind >= 15) score -= 22;
    else if (referenceWind >= 9) score -= 8;

    if (maxGust > 35) score -= 32;
    else if (maxGust >= 29) score -= 24;
    else if (maxGust >= 23) score -= 14;
    else if (maxGust >= 19) score -= 6;

    if (rain > 55) score -= 34;
    else if (rain > 35) score -= 18;
    else if (rain > 20) score -= 8;

    if (cloud > 75) score -= 8;
    score = clamp(Math.round(score), 0, 100);

    let label = 'Bom';
    let tone = 'good';
    if (referenceWind > 30 || maxGust > 35 || score < 40) { label = 'Evitar'; tone = 'bad'; }
    else if (referenceWind >= 23 || maxGust >= 29 || score < 55) { label = 'Mau'; tone = 'bad'; }
    else if (referenceWind >= 15 || maxGust >= 23 || score < 72) { label = 'Moderado'; tone = 'warn'; }
    else if (referenceWind >= 9 || maxGust >= 19 || score < 86) { label = 'Bom'; tone = 'blue'; }
    else { label = 'Excelente'; tone = 'good'; }

    const sandRisk = referenceWind >= 23 || maxGust >= 29 ? 'alto' : referenceWind >= 15 || maxGust >= 23 ? 'médio' : 'baixo';

    const summary = label === 'Excelente'
      ? 'Vento fraco, bom conforto para praia.'
      : label === 'Bom'
        ? 'Brisa aceitável para praia.'
        : label === 'Moderado'
          ? 'Já passa de brisa. Pode incomodar na toalha.'
          : label === 'Mau'
            ? 'Provável desconforto e areia a levantar.'
            : 'Demasiado vento para praia confortável.';

    const advice = label === 'Excelente'
      ? `Boa janela para praia. Vento fraco e risco de areia ${sandRisk}.`
      : label === 'Bom'
        ? `Praia recomendável, mas manter atenção a rajadas. Risco de areia ${sandRisk}.`
        : label === 'Moderado'
          ? `Praia possível, mas escolher zona abrigada. Vento já perceptível e risco de areia ${sandRisk}.`
          : label === 'Mau'
            ? `Pouco recomendável para praia. Vento suficiente para levantar areia e tornar a permanência desconfortável.`
            : `Evitar praia exposta. Vento e rajadas demasiado fortes para conforto e segurança.`;

    return { score, label, tone, summary, advice, sandRisk };
  }

  function windBeachText(speed) {
    if (speed > 30) return 'evitar praia';
    if (speed >= 23) return 'levanta areia';
    if (speed >= 15) return 'moderado';
    if (speed >= 9) return 'brisa';
    return 'vento fraco';
  }

  function beachWindTone(speed, gusts = 0) {
    if (speed > 30 || gusts > 35) return 'bad';
    if (speed >= 23 || gusts >= 29) return 'bad';
    if (speed >= 15 || gusts >= 23) return 'warn';
    if (speed >= 9 || gusts >= 19) return 'blue';
    return 'good';
  }

  function humidityText(humidity) {
    if (humidity >= 80) return 'mais abafado';
    if (humidity <= 45) return 'ar seco';
    return 'confortável';
  }

  function dominantWindDirection(hours) {
    const counts = new Map();
    hours.forEach(h => {
      const dir = h.weather.windDirectionText || dirText(h.weather.windDirection);
      if (!dir || dir === '--') return;
      counts.set(dir, (counts.get(dir) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '--';
  }

  function pressureText(p) {
    if (p >= 1014 && p <= 1024) return 'estável';
    if (p < 1008) return 'baixa';
    if (p > 1024) return 'alta';
    return 'normal';
  }

  function hourMiniWeather(h) {
    const dir = h.weather.windDirectionText || dirText(h.weather.windDirection);
    return `<article class="mini-card mini-card--weather"><strong>${formatTime(h.time)}</strong><span>${h.weather.temperature} °C</span><em>${h.weather.windSpeed} km/h</em><small>${windArrowMarkup(h.weather.windDirection)}<b>${dir}</b></small></article>`;
  }

  function hourWindDirection(h) {
    const dir = h.weather.windDirectionText || dirText(h.weather.windDirection);
    return `<article class="wind-card"><strong>${formatTime(h.time)}</strong><span class="wind-dir">${windArrowMarkup(h.weather.windDirection)}<b>${dir}</b></span><em>${h.weather.windSpeed} km/h</em></article>`;
  }


  function weatherSkyIcon(h) {
    const rain = h.weather.precipitationProbability ?? 0;
    const cloud = h.weather.cloudCover ?? 0;
    if (rain >= 40) return '🌧️';
    if (cloud >= 70) return '☁️';
    if (cloud >= 35) return '⛅';
    return '☀️';
  }

  function hourOverviewRow(h) {
    const waveDir = h.marine.waveDirectionText || dirText(h.marine.waveDirection);
    const windDir = h.weather.windDirectionText || dirText(h.weather.windDirection);
    return `<tr>
      <td><strong>${formatTime(h.time)}</strong></td>
      <td class="sky-cell">${weatherSkyIcon(h)}</td>
      <td>${h.weather.temperature ?? '--'} °C</td>
      <td>${h.weather.windSpeed ?? '--'} km/h</td>
      <td><span class="dir-badge">${windArrowMarkup(h.weather.windDirection)}<b>${windDir}</b></span></td>
      <td>${h.marine.waveHeight ?? '--'} m</td>
      <td><span class="dir-badge">${directionArrowMarkup(h.marine.waveDirection, 'Ondulação')}<b>${waveDir}</b></span></td>
      <td>${h.marine.wavePeriod ?? '--'} s</td>
    </tr>`;
  }

  function renderMares() {
    const data = currentData();
    const cur = data.current;
    const tide = tideState(data.tide);
    const nextExtreme = tide.next;
    const prevExtreme = tide.previous;
    const sourceTone = data.tide.source === 'WorldTides' ? 'good' : state.manualTide ? 'blue' : 'warn';
    const extremes = data.tide.extremes.filter(e => new Date(e.time).getTime() > Date.now()).slice(0, 6);

    els.content.innerHTML = `
      ${section('Marés e mar', `Fonte: ${data.tide.source}. A maré influencia diretamente corrente, janelas e score.`, `
        <div class="tide-hero">
          <div class="tide-gauge" style="--progress:${Math.round(tide.progress * 100)}%"><span>${tide.phase}</span><strong>${tide.height} m</strong></div>
          <div class="tide-hero__copy">
            <p>Próximo evento</p>
            <strong>${nextExtreme ? eventShortName(nextExtreme.type) : '--'} · ${nextExtreme ? formatTime(nextExtreme.time) : '--'}</strong>
            <span>${nextExtreme ? `${nextExtreme.height} m` : ''}</span>
          </div>
        </div>
        <div class="metrics-grid">
          ${metric('Último evento', prevExtreme ? `${eventShortName(prevExtreme.type)} ${formatTime(prevExtreme.time)}` : '--', prevExtreme ? `${prevExtreme.height} m` : '', '')}
          ${metric('Próximo evento', nextExtreme ? `${eventShortName(nextExtreme.type)} ${formatTime(nextExtreme.time)}` : '--', nextExtreme ? `${nextExtreme.height} m` : '', '')}
          ${metric('Amplitude', `${tide.amplitude} m`, `corrente ${tide.strength.toLowerCase()}`, tide.strength === 'Forte' ? 'warn' : 'blue')}
          ${metric('Fonte maré', data.tide.source === 'Estimativa local' ? 'Est. local' : data.tide.source, data.tide.source === 'Estimativa local' ? 'validar com IH' : 'ativa', sourceTone)}
        </div>
      `)}
      ${section('Ondulação e água', 'Dados do mar para a zona selecionada.', `
        <div class="metrics-grid">
          ${metric('Onda', `${cur.marine.waveHeight} m`, waveDecision(data.zone, cur), cur.marine.waveHeight > data.zone.limits.waveWarn ? 'warn' : 'good')}
          ${metric('Período', `${cur.marine.wavePeriod} s`, 'intervalo entre vagas', 'blue')}
          ${metric('Direção', cur.marine.waveDirectionText, 'ondulação', '')}
          ${metric('Água', `${cur.marine.waterTemperature} °C`, waterText(cur.marine.waterTemperature), 'blue')}
        </div>
        <canvas id="seaChart" class="chart" height="190"></canvas>
      `)}
      ${section('Próximas marés', 'Eventos previstos ou estimados.', `
        <div class="event-list">${extremes.map(e => `<article><strong>${eventShortName(e.type)}</strong><span>${formatDateTime(e.time)}</span><em>${e.height} m</em></article>`).join('')}</div>
        <div class="decision-list">
          <div><strong>Melhor fase</strong><span>${tide.phase === 'A subir' ? 'Maré a subir. Bom sinal para Ria e Dourada.' : 'Maré a descer. Pode funcionar em canais, pontas e zonas de corrente.'}</span></div>
          <div><strong>Evitar</strong><span>${data.zone.avoidHint}</span></div>
        </div>
      `)}
    `;
  }

  function eventName(type) { return type === 'high' ? 'Preia-mar' : 'Baixa-mar'; }
  function eventShortName(type) { return type === 'high' ? 'PM' : 'BM'; }
  function waveDecision(zone, cur) {
    if (cur.marine.waveHeight > zone.limits.waveBlock) return 'evitar';
    if (cur.marine.waveHeight > zone.limits.waveWarn) return 'atenção';
    return 'controlada';
  }
  function waterText(t) {
    if (t >= 18 && t <= 23) return 'boa faixa';
    if (t > 23) return 'quente';
    return 'fria';
  }

  function renderLua() {
    const data = currentData();
    const cur = data.current;
    const today = closestDaily(data.daily);
    const moon = moonInfo();
    const lowLightWindows = lowLightWindowsForDaily(data.daily).slice(0, 4);

    els.content.innerHTML = `
      ${section('Lua e luz', 'A lua é um fator secundário, mas ajuda a ler marés vivas, luz e atividade.', `
        <div class="moon-card">
          <div class="moon-visual" style="--illumination:${moon.illumination}%"></div>
          <div>
            <p>Fase atual</p>
            <strong>${moon.phase}</strong>
            <span>${moon.illumination}% de luminosidade · idade ${moon.age} dias</span>
          </div>
        </div>
        <div class="metrics-grid">
          ${metric('Nascer do sol', today.sunrise ? formatTime(today.sunrise) : '--', 'janela de baixa luz', 'green')}
          ${metric('Pôr do sol', today.sunset ? formatTime(today.sunset) : '--', 'janela de baixa luz', 'green')}
          ${metric('Influência', moon.tideInfluence, 'efeito indireto na maré', 'blue')}
          ${metric('Estado agora', cur.lowLight ? 'Pouca luz' : 'Luz normal', cur.lowLight ? 'janela boa' : 'menos relevante', cur.lowLight ? 'green' : '')}
        </div>
      `)}
      ${section('Janelas com pouca luz', 'Períodos que tendem a favorecer várias espécies, sobretudo Robalo.', `
        <div class="event-list">${lowLightWindows.map(w => `<article><strong>${w.label}</strong><span>${formatDateTime(w.start)} - ${formatTime(w.end)}</span><em>${w.reason}</em></article>`).join('')}</div>
      `)}
      ${section('Leitura para pesca', '', `
        <div class="decision-list">
          <div><strong>Regra prática</strong><span>Usar a lua como complemento: primeiro maré, mar, vento e luz.</span></div>
          <div><strong>Quando ganha peso</strong><span>Lua nova ou cheia pode reforçar marés vivas; bom para corrente, mas exige mais atenção na Ponta.</span></div>
          <div><strong>Melhor combinação</strong><span>Maré a mexer + nascer/pôr do sol + vento controlado.</span></div>
        </div>
      `)}
    `;
  }

  function lowLightWindowsForDaily(daily) {
    const windows = [];
    daily.forEach(d => {
      if (d.sunrise) {
        const sr = new Date(d.sunrise);
        windows.push({ label: 'Manhã', start: new Date(sr.getTime() - 60 * 60000), end: new Date(sr.getTime() + 90 * 60000), reason: 'nascer do sol' });
      }
      if (d.sunset) {
        const ss = new Date(d.sunset);
        windows.push({ label: 'Fim do dia', start: new Date(ss.getTime() - 90 * 60000), end: new Date(ss.getTime() + 60 * 60000), reason: 'pôr do sol' });
      }
    });
    return windows.filter(w => w.end.getTime() > Date.now());
  }

  function renderPesca() {
    const data = currentData();
    const zone = data.zone;
    const cur = data.current;
    const best = bestWindows(data, 65, 4);
    const avoid = avoidWindows(data, 3);
    const species = speciesForecast(zone, cur);
    const factors = Object.entries(cur.score.parts).map(([key, value]) => ({ key, label: factorLabel(key), value, weight: zone.weights[key] })).sort((a, b) => b.weight - a.weight);

    els.content.innerHTML = `
      ${section('Condições de pesca', `Decisão para ${zone.name}. Score recalculado para as próximas 24h com meteorologia, maré, mar, lua e luz.`, `
        <div class="score-hero score-hero--${zone.color}">
          <div class="score-ring" style="--score:${cur.score.value}"><strong>${cur.score.value}</strong><span>/100</span></div>
          <div class="score-hero__copy">
            <p>${cur.score.status}</p>
            <strong>${cur.score.probability}% probabilidade estimada</strong>
            <span>${explainBest(zone, cur)}</span>
          </div>
        </div>
        <canvas id="scoreChart" class="chart" height="190"></canvas>
      `)}
      ${section('Melhores horas', 'Janelas com score mais alto nas próximas 24 horas.', `
        <div class="event-list event-list--accent">${best.length ? best.map(w => `<article><strong>${rangeLabel(w.start, w.end)}</strong><span>Score médio ${w.score}/100</span><em>${w.reason}</em></article>`).join('') : '<p class="empty">Sem janela forte nas próximas 24 horas.</p>'}</div>
      `)}
      ${section('Horas a evitar', 'Janelas penalizadas por vento, mar, corrente ou score baixo.', `
        <div class="event-list event-list--danger">${avoid.length ? avoid.map(w => `<article><strong>${rangeLabel(w.start, w.end)}</strong><span>Score médio ${w.score}/100</span><em>${w.reason}</em></article>`).join('') : '<p class="empty">Sem períodos críticos relevantes.</p>'}</div>
      `)}
      ${section('Espécies prováveis', 'Probabilidade por espécie, ajustada ao mês, zona e fase da maré.', `
        <div class="species-list species-list--rich">${species.map(s => `<article><div><strong>${s.name}</strong><span>${s.status} · ${s.reason}</span><small>${s.zoneReason}. Maré: ${s.tideReason}. ${s.monthReason}.</small></div><meter min="0" max="100" value="${s.score}"></meter><em>${s.score}%</em></article>`).join('')}</div>
      `)}
      ${section('Peso dos fatores', 'Como a app chegou ao score.', `
        <div class="factor-list">${factors.map(f => `<article><div><strong>${f.label}</strong><span>Peso ${f.weight}%</span></div><div class="bar"><i style="width:${f.value}%"></i></div><em>${Math.round(f.value)}/100</em></article>`).join('')}</div>
        <div class="decision-list">
          <div><strong>Recomendação</strong><span>${recommendationText(zone, cur)}</span></div>
          <div><strong>Zona</strong><span>${zone.bestHint}</span></div>
          <div><strong>Atenção</strong><span>${zone.avoidHint}</span></div>
        </div>
      `)}
    `;
  }

  function factorLabel(key) {
    return { tide: 'Maré', sea: 'Mar', wind: 'Vento', light: 'Hora / luz', water: 'Água', moon: 'Lua', pressure: 'Pressão' }[key] || key;
  }

  function recommendationText(zone, cur) {
    if (cur.score.value >= 75) return 'Boa janela. Faz sentido planear saída, mantendo validação local.';
    if (cur.score.value >= 65) return 'Condições boas, mas confirma vento, corrente e segurança antes de avançar.';
    if (cur.score.value >= 52) return 'Possível, mas não é a janela mais forte. Melhor procurar horário alternativo.';
    return 'Não é recomendado como primeira escolha. Ver melhores janelas ou outra zona.';
  }

  function drawCharts() {
    const data = currentData();
    if (!data) return;
    const weatherCanvas = $('#weatherChart');
    if (weatherCanvas) drawLineChart(weatherCanvas, upcomingHours(data.hourly, 24), [
      { key: h => h.weather.temperature, label: 'Temp' },
      { key: h => h.weather.windSpeed, label: 'Vento' }
    ], { suffix: '', min: null, max: null });

    const seaCanvas = $('#seaChart');
    if (seaCanvas) drawLineChart(seaCanvas, upcomingHours(data.hourly, 48), [
      { key: h => h.marine.waveHeight, label: 'Onda' },
      { key: h => h.tide.height, label: 'Maré' }
    ], { suffix: 'm', min: 0, max: null, annotateExtremaSeries: 1 });

    const scoreCanvas = $('#scoreChart');
    if (scoreCanvas) drawLineChart(scoreCanvas, upcomingHours(data.hourly, 24), [
      { key: h => h.score.value, label: 'Score' }
    ], { suffix: '', min: 0, max: 100 });
  }


  function findSeriesExtrema(rows, getValue) {
    const extrema = [];
    if (!rows || rows.length < 3) return extrema;
    for (let i = 1; i < rows.length - 1; i++) {
      const prev = Number(getValue(rows[i - 1]));
      const curr = Number(getValue(rows[i]));
      const next = Number(getValue(rows[i + 1]));
      if (![prev, curr, next].every(Number.isFinite)) continue;
      const isPeak = curr >= prev && curr >= next && (curr > prev || curr > next);
      const isTrough = curr <= prev && curr <= next && (curr < prev || curr < next);
      if (isPeak || isTrough) extrema.push({ index: i, type: isPeak ? 'peak' : 'trough', value: curr, time: rows[i].time });
    }
    return extrema;
  }

  function drawLineChart(canvas, rows, series, opts = {}) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);
    const padL = 36, padR = 12, padT = 18, padB = 28;
    const values = series.flatMap(s => rows.map(s.key)).filter(v => Number.isFinite(v));
    const min = opts.min !== null && opts.min !== undefined ? opts.min : Math.floor(Math.min(...values) - 2);
    const max = opts.max !== null && opts.max !== undefined ? opts.max : Math.ceil(Math.max(...values) + 2);
    const span = max - min || 1;

    ctx.strokeStyle = '#dbe8ec';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = padT + (h - padT - padB) * i / 4;
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
    }
    ctx.stroke();

    ctx.fillStyle = '#617587';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const value = max - span * i / 4;
      const y = padT + (h - padT - padB) * i / 4;
      ctx.fillText(`${Math.round(value)}${opts.suffix || ''}`, padL - 6, y);
    }

    const colors = ['#14958f', '#f28421', '#2f6eaa'];
    series.forEach((s, si) => {
      ctx.strokeStyle = colors[si % colors.length];
      ctx.lineWidth = 3;
      ctx.beginPath();
      rows.forEach((row, i) => {
        const x = padL + (w - padL - padR) * i / Math.max(1, rows.length - 1);
        const y = padT + (h - padT - padB) * (1 - ((s.key(row) - min) / span));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    if (Number.isInteger(opts.annotateExtremaSeries) && series[opts.annotateExtremaSeries]) {
      const seriesIndex = opts.annotateExtremaSeries;
      const getter = series[seriesIndex].key;
      const extrema = findSeriesExtrema(rows, getter);
      ctx.font = '10px system-ui, sans-serif';
      extrema.forEach(item => {
        const x = padL + (w - padL - padR) * item.index / Math.max(1, rows.length - 1);
        const y = padT + (h - padT - padB) * (1 - ((getter(rows[item.index]) - min) / span));
        const label = `${item.type === 'peak' ? 'PM' : 'BM'} ${formatTime(item.time)}`;
        ctx.fillStyle = '#09233f';
        ctx.textAlign = 'center';
        ctx.textBaseline = item.type === 'peak' ? 'bottom' : 'top';
        const offset = item.type === 'peak' ? -8 : 8;
        ctx.fillText(label, x, y + offset);
        ctx.beginPath();
        ctx.fillStyle = colors[seriesIndex % colors.length];
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.fillStyle = '#617587';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    [0, Math.floor(rows.length / 2), rows.length - 1].forEach(i => {
      if (!rows[i]) return;
      const x = padL + (w - padL - padR) * i / Math.max(1, rows.length - 1);
      ctx.fillText(formatTime(rows[i].time), x, h - padB + 10);
    });
  }

  function setupAutoRefresh() {
    if (state.autoTimer) clearInterval(state.autoTimer);
    state.autoTimer = setInterval(refreshAll, state.refreshMinutes * 60000);
  }

  function setupTick() {
    if (state.tickTimer) clearInterval(state.tickTimer);
    state.tickTimer = setInterval(() => {
      updateHeader();
      if (state.tab === 'mares') renderMares();
    }, 30000);
  }

  function bindEvents() {
    els.refreshBtn.addEventListener('click', refreshAll);
    $$('.zone-chip, .map-pin').forEach(btn => {
      btn.addEventListener('click', () => {
        state.zoneId = btn.dataset.zone;
        localStorage.setItem('pesca.zone', state.zoneId);
        render();
      });
    });
    $$('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        state.tab = btn.dataset.tab;
        localStorage.setItem('pesca.tab', state.tab);
        render();
      });
    });

    document.addEventListener('click', event => {
      const button = event.target.closest('[data-scroll-target]');
      if (!button) return;
      const target = document.getElementById(button.dataset.scrollTarget);
      if (!target) return;
      const direction = Number(button.dataset.scrollDir || 1);
      const amount = Math.max(180, Math.round(target.clientWidth * 0.85));
      target.scrollBy({ left: direction * amount, behavior: 'smooth' });
    });

    els.settingsBtn.addEventListener('click', () => {
      els.worldTidesKey.value = state.worldTidesKey;
      els.refreshInterval.value = String(state.refreshMinutes);
      els.settingsDialog.showModal();
    });
    els.saveSettings.addEventListener('click', () => {
      state.worldTidesKey = els.worldTidesKey.value.trim();
      state.refreshMinutes = Number(els.refreshInterval.value || CONFIG.refreshMinutes);
      localStorage.setItem('pesca.worldTidesKey', state.worldTidesKey);
      localStorage.setItem('pesca.refreshMinutes', String(state.refreshMinutes));
      refreshAll();
    });

    els.manualTideBtn.addEventListener('click', () => {
      const tide = state.manualTide || CONFIG.fallback.tide;
      els.manualLow.value = tide.low || CONFIG.fallback.tide.low;
      els.manualHigh.value = tide.high || CONFIG.fallback.tide.high;
      els.manualLowHeight.value = tide.lowHeight || CONFIG.fallback.tide.lowHeight;
      els.manualHighHeight.value = tide.highHeight || CONFIG.fallback.tide.highHeight;
      els.tideDialog.showModal();
    });
    els.saveManualTide.addEventListener('click', () => {
      state.manualTide = {
        low: els.manualLow.value || CONFIG.fallback.tide.low,
        high: els.manualHigh.value || CONFIG.fallback.tide.high,
        lowHeight: Number(els.manualLowHeight.value || CONFIG.fallback.tide.lowHeight),
        highHeight: Number(els.manualHighHeight.value || CONFIG.fallback.tide.highHeight)
      };
      saveJson('pesca.manualTide', state.manualTide);
      refreshAll();
    });
    els.clearManualTide.addEventListener('click', () => {
      state.manualTide = null;
      localStorage.removeItem('pesca.manualTide');
      els.tideDialog.close();
      refreshAll();
    });
  }

  function init() {
    ensureFallbackData();
    bindEvents();
    setupTick();
    render();
    refreshAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
