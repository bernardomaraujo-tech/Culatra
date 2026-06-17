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


  function dayStart(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function minutesOfDay(dateOrIso) {
    const d = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
    return d.getHours() * 60 + d.getMinutes();
  }

  function dateAtMinutes(baseDate, minutes) {
    const base = dayStart(baseDate);
    return new Date(base.getTime() + minutes * 60000);
  }

  function parseTimeToMinutes(isoOrTime, fallback = 6 * 60) {
    if (!isoOrTime) return fallback;
    if (String(isoOrTime).includes('T')) return minutesOfDay(isoOrTime);
    const [h, m] = String(isoOrTime).split(':').map(Number);
    return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : fallback;
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
      forecast_days: '8',
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
      length: String(9 * 24 * 60 * 60),
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
    const end = new Date(Date.now() + 9 * 24 * 3600000);
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
    const end = new Date(Date.now() + 9 * 24 * 3600000);
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



  function solunarPeriodsForDate(daily, date = new Date()) {
    const d = closestDaily(daily, date.getTime());
    const moon = moonInfo(date);
    const sunriseMin = parseTimeToMinutes(d.sunrise, 6 * 60 + 10);
    const sunsetMin = parseTimeToMinutes(d.sunset, 20 * 60 + 50);
    // Estimativa local: a lua nasce cerca de 50 min mais tarde a cada dia lunar.
    const moonriseMin = (sunriseMin + moon.age * 50) % 1440;
    const moonsetMin = moonriseMin + 12 * 60 + 25;
    const upperTransit = moonriseMin + 6 * 60 + 12;
    const lowerTransit = moonriseMin + 18 * 60 + 37;
    const periods = [
      { kind: 'major', label: 'Maior', startMin: lowerTransit - 60, endMin: lowerTransit + 60, reason: 'trânsito lunar oposto' },
      { kind: 'major', label: 'Maior', startMin: upperTransit - 60, endMin: upperTransit + 60, reason: 'trânsito lunar' },
      { kind: 'minor', label: 'Menor', startMin: moonriseMin, endMin: moonriseMin + 60, reason: 'nascer da lua' },
      { kind: 'minor', label: 'Menor', startMin: moonsetMin, endMin: moonsetMin + 60, reason: 'pôr da lua' }
    ];
    const lowLightRanges = [
      [sunriseMin - 75, sunriseMin + 75],
      [sunsetMin - 75, sunsetMin + 75]
    ];
    const spring = moon.phase.includes('cheia') || moon.phase.includes('nova');
    return periods.map(p => {
      const start = dateAtMinutes(date, p.startMin);
      const end = dateAtMinutes(date, p.endMin);
      const lowLightBoost = lowLightRanges.some(([a, b]) => p.startMin <= b && p.endMin >= a);
      let activity = p.kind === 'major' ? 76 : 64;
      if (spring) activity += 7;
      if (lowLightBoost) activity += 9;
      activity = clamp(activity, 0, 96);
      const activityLabel = activity >= 85 ? 'atividade muito alta' : activity >= 72 ? 'atividade alta' : activity >= 58 ? 'atividade média' : 'atividade baixa';
      return { ...p, start, end, activity, activityLabel, lowLightBoost, spring };
    }).sort((a, b) => a.start - b.start);
  }

  function solunarStateAt(time, daily) {
    const target = new Date(time).getTime();
    const day = new Date(time);
    const periods = [
      ...solunarPeriodsForDate(daily, new Date(day.getTime() - 86400000)),
      ...solunarPeriodsForDate(daily, day),
      ...solunarPeriodsForDate(daily, new Date(day.getTime() + 86400000))
    ];
    const active = periods.find(p => target >= p.start.getTime() && target <= p.end.getTime());
    if (active) return { active: true, kind: active.kind, label: active.label, reason: active.reason, activity: active.activity, activityLabel: active.activityLabel };
    const next = periods.find(p => p.start.getTime() > target);
    return { active: false, next };
  }

  function solunarDayActivity(periods, tide) {
    const maxActivity = Math.max(...periods.map(p => p.activity), 0);
    const tideBoost = tideState(tide).strength === 'Forte' ? 5 : tideState(tide).strength === 'Moderada' ? 2 : 0;
    const value = clamp(Math.round(maxActivity + tideBoost), 0, 98);
    const label = value >= 85 ? 'Muito alta' : value >= 72 ? 'Alta' : value >= 58 ? 'Média' : 'Baixa';
    return { value, label };
  }


  function dateOnlyKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function dayLabel(date) {
    const d = date instanceof Date ? date : new Date(date);
    const day = d.toLocaleDateString('pt-PT', { day: '2-digit' });
    const week = d.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '');
    return `${day} ${week}`;
  }

  function minutesOfDay(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.getHours() * 60 + d.getMinutes();
  }

  function eventsForLocalDay(tide, date) {
    const key = dateOnlyKey(date);
    return (tide.extremes || [])
      .filter(e => dateOnlyKey(e.time) === key)
      .sort((a, b) => new Date(a.time) - new Date(b.time))
      .slice(0, 4);
  }

  function tideCoefficientForEvents(events, date = new Date(), source = '') {
    const heights = events.map(e => Number(e.height)).filter(Number.isFinite);
    const range = heights.length >= 2 ? Math.max(...heights) - Math.min(...heights) : null;

    // Índice local de maré inspirado no método SHOM: a força da maré é lida pelo marnel,
    // ou seja, pela diferença entre preia-mar e baixa-mar consecutivas.
    // Na Culatra/Ria Formosa usamos limites locais de referência documentados:
    // marés mortas próximas de 1,3 m e marés vivas próximas de 3,5 m.
    const localNeapRange = 1.3;
    const localSpringRange = 3.5;
    const rangeCoef = range === null
      ? 70
      : clamp(Math.round(20 + ((range - localNeapRange) / (localSpringRange - localNeapRange)) * 100), 20, 120);

    // Proxy harmónico simplificado M2/S2: lua nova/cheia reforçam a amplitude;
    // quartos reduzem-na. Isto replica a lógica spring-neap usada nas previsões
    // harmónicas, sem depender de constituintes locais completos.
    const moon = moonInfo(date);
    const lunarCycle = 29.530588853;
    const phaseAngle = (4 * Math.PI * moon.age) / lunarCycle;
    const springness = (Math.cos(phaseAngle) + 1) / 2;
    const lunarCoef = clamp(Math.round(20 + springness * 100), 20, 120);

    const estimated = !source || source === 'Estimativa local' || source.toLowerCase().includes('estim');
    const value = estimated
      ? clamp(Math.round(rangeCoef * 0.45 + lunarCoef * 0.55), 20, 120)
      : clamp(Math.round(rangeCoef * 0.85 + lunarCoef * 0.15), 20, 120);

    const label = value >= 95 ? 'muito alto' : value >= 70 ? 'alto' : value >= 45 ? 'médio' : 'baixo';
    return { value, label, range: range === null ? null : round(range, 1), lunar: lunarCoef };
  }

  function activityFishIcons(value) {
    if (value >= 85) return '🐟🐟🐟';
    if (value >= 72) return '🐟🐟';
    if (value >= 58) return '🐟';
    return '—';
  }

  function tideEventCell(event) {
    if (!event) return '<span class="muted-cell">—</span>';
    const icon = event.type === 'high' ? '▲' : '▼';
    const cls = event.type === 'high' ? 'tide-up' : 'tide-down';
    return `<span class="tide-event ${cls}"><b>${eventShortName(event.type)} ${formatTime(event.time)}</b><small>${icon} ${event.height} m</small></span>`;
  }

  function tideSolunarCalendarRows(data, days = 7) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: days }, (_, i) => {
      const date = new Date(today.getTime() + i * 86400000);
      const daily = closestDaily(data.daily, date.getTime());
      const events = eventsForLocalDay(data.tide, date);
      const coef = tideCoefficientForEvents(events, date, data.tide.source);
      const periods = solunarPeriodsForDate(data.daily, date);
      const activity = solunarDayActivity(periods, { ...data.tide, extremes: events.length ? events : data.tide.extremes });
      const moon = moonInfo(date);
      return `<tr>
        <td><strong>${dayOnlyLabel(date)}</strong></td>
        <td><span class="moon-mini">${moon.phase}</span><small>${moon.illumination}%</small></td>
        <td><span>☀️ ${daily.sunrise ? formatTime(daily.sunrise) : '--'}</span><small>🌙 ${daily.sunset ? formatTime(daily.sunset) : '--'}</small></td>
        <td>${tideEventCell(events[0])}</td>
        <td>${tideEventCell(events[1])}</td>
        <td>${tideEventCell(events[2])}</td>
        <td>${tideEventCell(events[3])}</td>
        <td><strong>${coef.value}</strong><small>${coef.label}</small></td>
        <td><strong>${activity.label}</strong><small>${activityFishIcons(activity.value)}</small></td>
      </tr>`;
    }).join('');
  }

  function solunarPeriodTable(periods) {
    return `<div class="table-scroll table-scroll--compact">
      <table class="solunar-table" aria-label="Períodos solunares do dia">
        <thead><tr><th>Tipo</th><th>Hora</th><th>Atividade</th><th>Motivo</th></tr></thead>
        <tbody>
          ${periods.map(p => `<tr>
            <td><strong>${p.kind === 'major' ? 'Maior' : 'Menor'}</strong></td>
            <td>${formatTime(p.start)} - ${formatTime(p.end)}</td>
            <td><span class="activity-pill activity-pill--${p.activity >= 85 ? 'high' : p.activity >= 72 ? 'good' : 'mid'}">${p.activityLabel}</span></td>
            <td>${p.reason}${p.lowLightBoost ? '<small> + pouca luz</small>' : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }

  function solunarTimeline(periods, daily, date = new Date()) {
    const d = closestDaily(daily, date.getTime());
    const markers = [];
    if (d.sunrise) markers.push({ label: 'Nascer do sol', icon: '☀️', min: minutesOfDay(d.sunrise), cls: 'sunrise' });
    if (d.sunset) markers.push({ label: 'Pôr do sol', icon: '🌅', min: minutesOfDay(d.sunset), cls: 'sunset' });
    const blocks = [];
    periods.forEach(p => {
      let start = minutesOfDay(p.start);
      let end = minutesOfDay(p.end);
      const add = (a, b) => {
        const left = clamp(a / 1440 * 100, 0, 100);
        const width = clamp((b - a) / 1440 * 100, 0, 100 - left);
        if (width > 0.5) blocks.push(`<span class="activity-block activity-block--${p.kind}" style="left:${left}%;width:${width}%" title="${p.label} ${formatTime(p.start)} - ${formatTime(p.end)}"><b>${p.kind === 'major' ? 'Maior' : 'Menor'}</b></span>`);
      };
      if (end >= start) add(start, end);
      else { add(start, 1440); add(0, end); }
    });
    return `<div class="solunar-timeline" aria-label="Linha de atividade solunar">
      <div class="timeline-hours"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
      <div class="timeline-track">
        ${blocks.join('')}
        ${markers.map(m => `<i class="timeline-marker timeline-marker--${m.cls}" style="left:${clamp(m.min / 1440 * 100, 0, 100)}%" title="${m.label}">${m.icon}</i>`).join('')}
      </div>
      <div class="timeline-legend"><span><i class="legend-box legend-box--major"></i>Período maior</span><span><i class="legend-box legend-box--minor"></i>Período menor</span><span>☀️ nascer/pôr do sol</span></div>
    </div>`;
  }

  function combineHourly(weatherHourly, marineHourly, daily, tide) {
    const marineByTime = new Map(marineHourly.map(m => [m.time, m]));
    return weatherHourly.slice(0, CONFIG.horizonHours).map(w => {
      const m = marineByTime.get(w.time) || nearestMarine(marineHourly, w.time) || CONFIG.fallback.marine;
      const target = new Date(w.time).getTime();
      const tideNow = tideState(tide, target);
      const moon = moonInfo(new Date(w.time));
      const solunar = solunarStateAt(w.time, daily);
      return {
        time: w.time,
        weather: w,
        marine: m,
        tide: tideNow,
        moon,
        solunar,
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
    for (let i = 0; i < 8; i++) {
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
      source.push('Meteorologia estimada');
    }

    try {
      marine = await fetchMarine(zone);
      source.push('Open-Meteo Marine');
    } catch (e) {
      marine = fallbackMarine(zone);
      source.push('Mar estimado');
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
    const solunarBonus = hour.solunar?.active ? (hour.solunar.kind === 'major' ? 6 : 3) : 0;
    const probability = clamp(Math.round(score * 0.92 + (hour.lowLight ? 5 : 0) + solunarBonus), 5, 95);
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
    let score = 62;
    if (hour.lowLight) score = 96;
    else if (h >= 5 && h <= 8) score = 80;
    else if (h >= 18 && h <= 21) score = 80;
    else if (h >= 12 && h <= 16) score = 48;
    if (hour.solunar?.active) score = Math.max(score, hour.solunar.kind === 'major' ? 88 : 76);
    return score;
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

  function bestWindows(data, minScore = 65, max = 3) {
    const hours = upcomingHours(data.hourly || [], 48);
    const groups = [];
    let current = [];
    hours.forEach(h => {
      if (h.score.value >= minScore) current.push(h);
      else if (current.length) { groups.push(current); current = []; }
    });
    if (current.length) groups.push(current);
    return groups
      .map(group => ({
        start: group[0].time,
        end: new Date(new Date(group[group.length - 1].time).getTime() + 3600000).toISOString(),
        score: Math.round(mean(group.map(h => h.score.value))),
        reason: explainBest(activeZone(), group[Math.floor(group.length / 2)])
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, max);
  }

  function avoidWindows(data, max = 3) {
    const groups = [];
    let current = [];
    upcomingHours(data.hourly, 48).forEach(h => {
      const risky = h.score.value < 45 || h.weather.windSpeed > data.zone.limits.windWarn || h.weather.gusts > data.zone.limits.gustWarn || h.marine.waveHeight > data.zone.limits.waveBlock;
      if (risky) current.push(h);
      else if (current.length) { groups.push(current); current = []; }
    });
    if (current.length) groups.push(current);
    return groups.map(group => ({
      start: group[0].time,
      end: new Date(new Date(group[group.length - 1].time).getTime() + 3600000).toISOString(),
      score: Math.round(mean(group.map(h => h.score.value))),
      reason: explainAvoid(data.zone, group[Math.floor(group.length / 2)])
    })).slice(0, max);
  }

  function explainBest(zone, hour) {
    const bits = [];
    if (hour.tide.phase === 'A subir') bits.push('maré a subir'); else bits.push('maré a mexer');
    if (hour.lowLight) bits.push('pouca luz');
    if (hour.solunar?.active) bits.push(hour.solunar.kind === 'major' ? 'período solunar maior' : 'período solunar menor');
    if (hour.weather.windSpeed <= zone.limits.windWarn) bits.push('vento controlado');
    if (hour.marine.waveHeight <= zone.limits.waveWarn) bits.push('mar controlado');
    return bits.slice(0, 3).join(' + ');
  }

  function explainAvoid(zone, hour) {
    const bits = [];
    if (hour.weather.windSpeed > zone.limits.windWarn) bits.push('vento forte');
    if (hour.weather.gusts > zone.limits.gustWarn) bits.push('rajadas elevadas');
    if (hour.marine.waveHeight > zone.limits.waveWarn) bits.push('onda acima do ideal');
    if (zone.id === 'ponta' && hour.tide.strength === 'Forte') bits.push('corrente forte');
    if (!bits.length) bits.push('pontuação baixa');
    return bits.join(' + ');
  }

  function speciesForecast(zone, hour) {
    const month = new Date(hour.time).getMonth() + 1;
    return zone.species.map(name => {
      const rule = CONFIG.speciesRules[name];
      if (!rule) return { name, score: 30, status: 'Pouco provável', detail: 'sem regra definida' };
      let score = 42;
      const notes = [];
      if (rule.zones.includes(zone.id)) { score += 14; notes.push('zona compatível'); }
      else notes.push('zona menos favorável');

      if (rule.strongMonths.includes(month)) { score += 18; notes.push('mês favorável'); }
      else if (rule.mediumMonths.includes(month)) { score += 9; notes.push('mês médio'); }
      else { score -= 8; notes.push('mês desfavorável'); }

      const wave = hour.marine.waveHeight ?? 0;
      if (wave >= rule.bestWave[0] && wave <= rule.bestWave[1]) { score += 10; notes.push('mar compatível'); }
      else if (wave > rule.bestWave[1]) score -= 8;

      if (hour.weather.windSpeed <= rule.bestWindMax) score += 7;
      else score -= 7;

      if (rule.bestLight && hour.lowLight) { score += 10; notes.push('pouca luz'); }
      if (hour.solunar?.active) { score += hour.solunar.kind === 'major' ? 8 : 4; notes.push(hour.solunar.kind === 'major' ? 'solunar maior' : 'solunar menor'); }
      if (rule.bestTide.includes(hour.tide.phase)) { score += 10; notes.push('maré compatível'); }

      if (name === 'Dourada' && hour.tide.phase === 'A subir') score += 8;
      if (name === 'Robalo' && hour.lowLight) score += 10;
      if (name === 'Sargo' && zone.id === 'atlantico' && wave >= 0.6) score += 8;

      const finalScore = clamp(Math.round(score), 0, 96);
      const status = finalScore >= 78 ? 'Boa hipótese' : finalScore >= 62 ? 'Possível' : finalScore >= 48 ? 'Fraca' : 'Pouco provável';
      const detail = `${notes.slice(0, 4).join(' · ')}. ${rule.tideText}. ${rule.placeText}.`;
      return { name, score: finalScore, status, detail };
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
      setStatus('Dados estimados', 'warn');
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
    const next7Days = dailyWeatherSummaries(data, 7);
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
      ${section('Previsão 7 dias', 'Resumo diário para planear praia e permanência na ilha.', `
        <div class="table-scroll">
          <table class="meteo-table meteo-table--daily" aria-label="Previsão meteorológica dos próximos 7 dias">
            <thead>
              <tr>
                <th>Dia</th>
                <th>Céu</th>
                <th>Temp.</th>
                <th>Vento</th>
                <th>Dir.<small>vento</small></th>
                <th>Rajadas</th>
                <th>Chuva</th>
                <th>Praia</th>
              </tr>
            </thead>
            <tbody>
              ${next7Days.map(weatherDayRow).join('')}
            </tbody>
          </table>
        </div>
        <p class="table-note">A avaliação de praia considera temperatura, vento, rajadas, chuva e nebulosidade. Vento acima de brisa penaliza o conforto.</p>
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
      ${section('Câmara em direto', 'Imagem live da Beachcam/MEO da Ilha do Farol/Culatra para validar céu, vento, ondulação e ocupação da praia.', `
        <div class="camera-embed camera-embed--beachcam">
          <iframe title="Câmara Beachcam/MEO da Ilha do Farol/Culatra" src="https://beachcam.meo.pt/livecams/ilha-do-farol-culatra/" width="100%" height="420" frameborder="0" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        </div>
        <div class="camera-actions">
          <a href="https://beachcam.meo.pt/livecams/ilha-do-farol-culatra/" target="_blank" rel="noopener noreferrer">Abrir Beachcam/MEO</a>
          <a href="https://www.windy.com/webcams/1742819697" target="_blank" rel="noopener noreferrer">Alternativa Windy</a>
        </div>
        <p class="table-note">A Beachcam/MEO fica como fonte prioritária. Se o Safari bloquear a incorporação, abre a câmara pelo botão.</p>
      `)}
    `;
  }

  function weatherDecision(zone, cur) {
    if (cur.weather.gusts > zone.limits.gustWarn) return 'Rajadas elevadas. Só avançar se o local estiver protegido.';
    if (cur.weather.windSpeed > zone.limits.windWarn) return 'Vento acima do ideal. Penaliza conforto e pesca.';
    if (cur.weather.precipitationProbability > 45) return 'Possibilidade relevante de chuva. Preparar alternativa.';
    return 'Condições meteorológicas utilizáveis para pesca recreativa.';
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
          ? `Praia possível, mas escolher zona abrigada. Vento já percetível e risco de areia ${sandRisk}.`
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



  function localDateKey(dateOrIso) {
    const date = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
    if (!Number.isFinite(date.getTime())) return '';
    const y = date.toLocaleDateString('sv-SE', { timeZone: CONFIG.timezone });
    return y;
  }

  function dayLabel(dateKey) {
    const date = new Date(`${dateKey}T12:00:00`);
    const today = localDateKey(new Date());
    const tomorrow = localDateKey(new Date(Date.now() + 86400000));
    const weekday = date.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '');
    const day = date.toLocaleDateString('pt-PT', { day: '2-digit' });
    if (dateKey === today) return `Hoje ${day}`;
    if (dateKey === tomorrow) return `Amanhã ${day}`;
    return `${day} ${weekday}`;
  }


  function dayOnlyLabel(value) {
    const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
    if (!Number.isFinite(date.getTime())) return '--';
    return date.toLocaleDateString('pt-PT', { day: '2-digit' });
  }

  function daySkyIcon(summary) {
    if ((summary.rainMax || 0) >= 45) return '🌧️';
    if ((summary.cloudAvg || 0) >= 70) return '☁️';
    if ((summary.cloudAvg || 0) >= 35) return '⛅';
    return '☀️';
  }

  function dailyWeatherSummaries(data, count = 7) {
    const grouped = new Map();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    (data.hourly || []).forEach(h => {
      if (!h?.time) return;
      const key = localDateKey(h.time);
      if (!key) return;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(h);
    });

    let dates = (data.daily || [])
      .map(d => d.date)
      .filter(Boolean)
      .filter(dateKey => new Date(`${dateKey}T12:00:00`).getTime() >= startOfToday.getTime())
      .slice(0, count);

    if (dates.length < count) {
      for (let i = 0; dates.length < count; i++) {
        const d = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() + i);
        const key = dateOnlyKey(d);
        if (!dates.includes(key)) dates.push(key);
      }
    }

    return dates.map(dateKey => {
      let hours = (grouped.get(dateKey) || []).slice();
      if (!hours.length) {
        // Fallback simples para garantir que a tabela mostra sempre os 7 dias.
        const previous = Array.from(grouped.values()).flat().slice(-24);
        hours = previous.length ? previous : (data.hourly || []).slice(0, 24);
      }

      const temps = hours.map(h => h.weather.temperature).filter(Number.isFinite);
      const winds = hours.map(h => h.weather.windSpeed).filter(Number.isFinite);
      const gusts = hours.map(h => h.weather.gusts).filter(Number.isFinite);
      const rains = hours.map(h => h.weather.precipitationProbability).filter(Number.isFinite);
      const clouds = hours.map(h => h.weather.cloudCover).filter(Number.isFinite);
      const apparent = hours.map(h => h.weather.apparentTemperature).filter(Number.isFinite);
      const directions = hours.map(h => h.weather.windDirection).filter(Number.isFinite);
      const direction = meanDirection(directions);
      const windAvg = round(mean(winds));
      const gustMax = Math.max(...gusts, 0);
      const rainMax = Math.max(...rains, 0);
      const cloudAvg = round(mean(clouds));
      const tempMin = round(Math.min(...temps), 1);
      const tempMax = round(Math.max(...temps), 1);
      const apparentMean = round(mean(apparent), 1);
      const beach = beachDecision(data.zone, {
        weather: {
          temperature: mean(temps),
          apparentTemperature: apparentMean || mean(temps),
          windSpeed: windAvg,
          gusts: gustMax,
          precipitationProbability: rainMax,
          cloudCover: cloudAvg
        }
      }, hours);

      return { dateKey, hours, tempMin, tempMax, windAvg, gustMax, rainMax, cloudAvg, direction, directionText: dirText(direction), beach };
    });
  }

  function meanDirection(degrees) {
    const valid = degrees.filter(Number.isFinite);
    if (!valid.length) return null;
    const sum = valid.reduce((acc, deg) => {
      const rad = deg * Math.PI / 180;
      acc.x += Math.sin(rad);
      acc.y += Math.cos(rad);
      return acc;
    }, { x: 0, y: 0 });
    const angle = Math.atan2(sum.x / valid.length, sum.y / valid.length) * 180 / Math.PI;
    return (angle + 360) % 360;
  }

  function weatherDayRow(summary) {
    const toneClass = summary.beach.tone === 'good' ? 'good' : summary.beach.tone === 'blue' ? 'blue' : summary.beach.tone === 'warn' ? 'warn' : 'bad';
    return `<tr>
      <td><strong>${dayOnlyLabel(summary.dateKey)}</strong></td>
      <td class="sky-cell">${daySkyIcon(summary)}</td>
      <td>${summary.tempMin}° / ${summary.tempMax}°</td>
      <td>${summary.windAvg} km/h</td>
      <td><span class="dir-badge">${windArrowMarkup(summary.direction)}<b>${summary.directionText}</b></span></td>
      <td>${summary.gustMax} km/h</td>
      <td>${summary.rainMax}%</td>
      <td><span class="beach-pill beach-pill--${toneClass}">${summary.beach.label}</span></td>
    </tr>`;
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
      ${section('Marés e mar', `Fonte: ${data.tide.source}. A maré influencia diretamente a corrente, as janelas e a pontuação.`, `
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
          <div><strong>Melhor fase</strong><span>${tide.phase === 'A subir' ? 'Maré a subir. Bom sinal para Ria e dourada.' : 'Maré a descer. Pode funcionar em canais, pontas e zonas de corrente.'}</span></div>
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
      ${section('Janelas com pouca luz', 'Períodos que tendem a favorecer várias espécies, sobretudo o robalo.', `
        <div class="event-list">${lowLightWindows.map(w => `<article><strong>${w.label}</strong><span>${formatDateTime(w.start)} - ${formatTime(w.end)}</span><em>${w.reason}</em></article>`).join('')}</div>
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
    const species = speciesForecast(zone, cur);
    const solunarActivity = solunarDayActivity(solunarPeriodsForDate(data.daily, new Date()), data.tide);

    els.content.innerHTML = `
      ${section('Condições de pesca', `Decisão para ${zone.name}. Pontuação recalculada para as próximas 24 h com meteorologia, maré, mar, lua e luz.`, `
        <div class="score-hero score-hero--${zone.color}">
          <div class="score-ring" style="--score:${cur.score.value}"><strong>${cur.score.value}</strong><span>/100</span></div>
          <div class="score-hero__copy">
            <p>${cur.score.status}</p>
            <strong>${cur.score.probability}% probabilidade estimada</strong>
            <span>${explainBest(zone, cur)}</span>
          </div>
        </div>
        <div class="chart-legend" aria-label="Legenda do gráfico de pesca">
          <span><i class="legend-dot legend-dot--score"></i>Pontuação / probabilidade</span>
          <span><i class="legend-dot legend-dot--tide"></i>Maré (m)</span>
        </div>
        <canvas id="scoreChart" class="chart" height="190"></canvas>
      `)}
      ${section('Atividade solunar', `Atividade média do dia: ${solunarActivity.label} (${solunarActivity.value}/100).`, `
        ${solunarPeriodTable(solunarPeriodsForDate(data.daily, new Date()))}
        ${solunarTimeline(solunarPeriodsForDate(data.daily, new Date()), data.daily)}
        <div class="decision-list"><div><strong>Como entra na pontuação</strong><span>Períodos maiores reforçam mais a probabilidade; períodos menores dão um bónus menor. O efeito é combinado com maré, vento, mar e espécie.</span></div></div>
      `)}
      ${section('Previsão 8 dias', 'Tabela de apoio à decisão com hoje + 7 dias: lua, sol, marés, coeficiente e atividade média.', `
        <div class="table-scroll">
          <table class="tide-calendar-table" aria-label="Previsão de pesca para hoje e próximos sete dias">
            <thead><tr><th>Dia</th><th>Lua</th><th>Sol</th><th>1.ª maré</th><th>2.ª maré</th><th>3.ª maré</th><th>4.ª maré</th><th>Coef.</th><th>Ativ.</th></tr></thead>
            <tbody>${tideSolunarCalendarRows(data, 8)}</tbody>
          </table>
        </div>
        <p class="table-note">O coeficiente indica a força estimada da maré. A atividade resulta da combinação entre maré, lua, sol e períodos solunares.</p>
      `)}
      ${section('Espécies prováveis', 'Estimativa por espécie local e condições atuais.', `
        <div class="species-list">${species.map(s => `<article><div><strong>${s.name}</strong><span>${s.status}</span><small>${s.detail}</small></div><meter min="0" max="100" value="${s.score}"></meter><em>${s.score}%</em></article>`).join('')}</div>
      `)}
      ${section('Recomendação', '', `
        <div class="decision-list">
          <div><strong>Leitura prática</strong><span>${recommendationText(zone, cur)}</span></div>
          <div><strong>Zona</strong><span>${zone.bestHint}</span></div>
          <div><strong>Atenção</strong><span>${zone.avoidHint}</span></div>
        </div>
      `)}
      ${section('Playlist', 'Música para acompanhar a leitura das condições e preparar a saída.', `
        <div class="spotify-embed">
          <iframe title="Playlist Spotify" data-testid="embed-iframe" src="https://open.spotify.com/embed/album/011dThtrT1jAIykIA4HEK5?utm_source=generator&theme=0&si=fde696700ea345f5" width="100%" height="352" frameborder="0" allowfullscreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
        </div>
      `)}
    `;
  }

  function factorLabel(key) {
    return { tide: 'Maré', sea: 'Mar', wind: 'Vento', light: 'Hora / luz', water: 'Água', moon: 'Lua', pressure: 'Pressão' }[key] || key;
  }

  function recommendationText(zone, cur) {
    if (cur.score.value >= 75) return 'Boa janela. Faz sentido planear a saída, mantendo a validação no local.';
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
      { key: h => h.score.value, label: 'Pontuação' },
      { key: h => h.tide.height, label: 'Maré' }
    ], {
      suffix: '',
      min: 0,
      max: 100,
      secondarySeries: [1],
      secondarySuffix: 'm',
      secondaryMin: 0,
      secondaryMax: null
    });
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

    const secondaryIdx = new Set(opts.secondarySeries || []);
    const hasSecondary = secondaryIdx.size > 0;
    const padL = 36;
    const padR = hasSecondary ? 40 : 12;
    const padT = 18;
    const padB = 28;

    const primarySeries = series.filter((_, i) => !secondaryIdx.has(i));
    const secondarySeries = series.filter((_, i) => secondaryIdx.has(i));

    const primaryValues = primarySeries.flatMap(s => rows.map(s.key)).filter(v => Number.isFinite(v));
    const primaryMin = opts.min !== null && opts.min !== undefined ? opts.min : Math.floor(Math.min(...primaryValues) - 2);
    const primaryMax = opts.max !== null && opts.max !== undefined ? opts.max : Math.ceil(Math.max(...primaryValues) + 2);
    const primarySpan = primaryMax - primaryMin || 1;

    const secondaryValues = secondarySeries.flatMap(s => rows.map(s.key)).filter(v => Number.isFinite(v));
    const secondaryMin = hasSecondary
      ? (opts.secondaryMin !== null && opts.secondaryMin !== undefined ? opts.secondaryMin : Math.floor(Math.min(...secondaryValues) * 10) / 10)
      : 0;
    const secondaryMax = hasSecondary
      ? (opts.secondaryMax !== null && opts.secondaryMax !== undefined ? opts.secondaryMax : Math.ceil(Math.max(...secondaryValues) + 0.2))
      : 1;
    const secondarySpan = secondaryMax - secondaryMin || 1;

    const yFor = (value, useSecondary = false) => {
      const min = useSecondary ? secondaryMin : primaryMin;
      const span = useSecondary ? secondarySpan : primarySpan;
      return padT + (h - padT - padB) * (1 - ((value - min) / span));
    };

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
      const value = primaryMax - primarySpan * i / 4;
      const y = padT + (h - padT - padB) * i / 4;
      ctx.fillText(`${Math.round(value)}${opts.suffix || ''}`, padL - 6, y);
    }

    if (hasSecondary) {
      ctx.textAlign = 'left';
      for (let i = 0; i <= 4; i++) {
        const value = secondaryMax - secondarySpan * i / 4;
        const y = padT + (h - padT - padB) * i / 4;
        ctx.fillText(`${value.toFixed(1)}${opts.secondarySuffix || ''}`, w - padR + 6, y);
      }
    }

    const colors = ['#14958f', '#f28421', '#2f6eaa'];
    series.forEach((s, si) => {
      const useSecondary = secondaryIdx.has(si);
      ctx.strokeStyle = colors[si % colors.length];
      ctx.lineWidth = useSecondary ? 2.5 : 3;
      if (useSecondary) ctx.setLineDash([7, 5]);
      else ctx.setLineDash([]);
      ctx.beginPath();
      rows.forEach((row, i) => {
        const value = s.key(row);
        const x = padL + (w - padL - padR) * i / Math.max(1, rows.length - 1);
        const y = yFor(value, useSecondary);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    });

    if (Number.isInteger(opts.annotateExtremaSeries) && series[opts.annotateExtremaSeries]) {
      const seriesIndex = opts.annotateExtremaSeries;
      const getter = series[seriesIndex].key;
      const useSecondary = secondaryIdx.has(seriesIndex);
      const extrema = findSeriesExtrema(rows, getter);
      ctx.font = '10px system-ui, sans-serif';
      extrema.forEach(item => {
        const x = padL + (w - padL - padR) * item.index / Math.max(1, rows.length - 1);
        const y = yFor(getter(rows[item.index]), useSecondary);
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
