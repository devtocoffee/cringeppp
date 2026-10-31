'use strict';

// Drawing: a cozy RPG record screen. Content: scores → growth → inventory → quests.
// Motion: pressed switches, stepped graph changes and a row/column inventory cursor.
const statsMetricLabels = { attendance: 'Посещения', talks: 'Выступления', awards: 'Награды', wins: 'Победы' };
const statsChartLabels = { size: 'Размер встреч', newcomers: 'Новые лица', growth: 'Вся компания' };
let statsDataCache;

function statsGlyph(type, extra = '') {
  const paths = {
    cup: 'M4 1h8v2h3v5h-2v2h-2v2H9v2h3v2H4v-2h3v-2H5v-2H3V8H1V3h3zm0 4H3v2h1zm8 0v2h1V5z',
    heart: 'M2 2h4v2h4V2h4v2h2v5h-2v2h-2v2h-2v2H6v-2H4v-2H2V9H0V4h2z',
    monitor: 'M0 1h16v11h-6v2h3v2H3v-2h3v-2H0zm2 2v7h12V3z',
    lock: 'M4 0h8v2h2v4h2v10H0V6h2V2h2zm2 2v2H4v2h8V4h-2V2zm1 7v4h2V9z',
    slide: 'M0 0h16v12h-6v2h3v2H3v-2h3v-2H0zm2 2v8h12V2zm2 2h8v2H4zm0 3h6v1H4z',
    star: 'M7 0h2v4h2v2h5v2h-3v3h-2v5H9v-3H7v3H5v-5H3V8H0V6h5V4h2z',
    snow: 'M7 0h2v4l3-3 2 2-3 3h5v2h-5l3 3-2 2-3-3v6H7v-6l-3 3-2-2 3-3H0V6h5L2 3l2-2 3 3z'
  };
  return `<svg class="stats-glyph ${extra}" viewBox="0 0 16 16" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="${paths[type] || paths.star}"/></svg>`;
}

function statisticsData() {
  if (statsDataCache) return statsDataCache;
  const events = D.events.filter(event => event.status === 'past').sort((a, b) => a.date.localeCompare(b.date));
  const eventIds = new Set(events.map(event => event.id));
  const visits = D.attendance.filter(visit => eventIds.has(visit.eventId) && visit.status === 'confirmed_attended');
  const talks = D.talks.filter(talk => eventIds.has(talk.eventId) && talk.status === 'recorded');
  const awards = events.flatMap(event => event.awards.map(award => ({ ...award, event })));
  const visitMap = new Map(visits.map(visit => [`${visit.participantId}:${visit.eventId}`, visit]));
  const people = D.participants.filter(person => visits.some(visit => visit.participantId === person.id));
  const first = new Map();
  const seen = new Set();
  const growth = events.map(event => {
    const ids = visits.filter(visit => visit.eventId === event.id).map(visit => visit.participantId);
    const newcomers = ids.filter(id => !seen.has(id));
    ids.forEach(id => { seen.add(id); if (!first.has(id)) first.set(id, event.id); });
    return { event, size: ids.length, newcomers, growth: seen.size, talks: talks.filter(talk => talk.eventId === event.id).length };
  });
  const scores = people.map(person => ({ person, attendance: visits.filter(v => v.participantId === person.id).length, talks: talks.filter(t => t.participantId === person.id).length, awards: awards.filter(a => a.participantId === person.id).length, wins: awards.filter(a => a.participantId === person.id && a.category === 'presentation' && a.place === 1).length }));
  const debutWins = awards.filter(award => award.category === 'presentation' && award.place === 1 && first.get(award.participantId) === award.event.id);
  const doubleTalks = [];
  for (const event of events) for (const person of people) {
    const count = talks.filter(talk => talk.eventId === event.id && talk.participantId === person.id).length;
    if (count > 1) doubleTalks.push({ person, event, count });
  }
  const seasons = [0, 0, 0, 0];
  events.forEach(event => { const m = Number(event.date.slice(5, 7)); seasons[m >= 3 && m <= 5 ? 0 : m >= 6 && m <= 8 ? 1 : m >= 9 && m <= 11 ? 2 : 3]++; });
  statsDataCache = { events, people, visits, talks, awards, visitMap, growth, scores, debutWins, doubleTalks, seasons };
  return statsDataCache;
}

function statisticsOptions() {
  const params = new URLSearchParams(location.search);
  const data = statisticsData();
  return { metric: Object.hasOwn(statsMetricLabels, params.get('metric')) ? params.get('metric') : 'attendance', chart: Object.hasOwn(statsChartLabels, params.get('chart')) ? params.get('chart') : 'size', all: params.get('all') === '1', event: data.events.some(event => event.id === params.get('event')) ? params.get('event') : data.events.at(-1)?.id };
}
function statsSetParameter(key, value) {
  const url = new URL(location.href);
  if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
  try { history.replaceState(null, '', url.pathname + url.search + url.hash); } catch { /* File previews can restrict history. */ }
}
function statsSwitches(kind, labels, value) {
  return `<div class="stats-switches" role="group" aria-label="${kind === 'metric' ? 'Рейтинг по показателю' : 'Что показывает график'}">${Object.entries(labels).map(([key, label]) => `<button type="button" data-stats-control="${kind}" data-stats-value="${key}" aria-pressed="${key === value}"><span class="stats-choice-arrow" aria-hidden="true">▶</span>${label}</button>`).join('')}</div>`;
}
function statsScoreText(metric, value) {
  return metric === 'attendance' ? visitText(value) : metric === 'talks' ? workText(value) : countText(value, metric === 'wins' ? ['победа', 'победы', 'побед'] : ['награда', 'награды', 'наград']);
}
function statsRanking(data, options) {
  const metric = options.metric;
  const sorted = [...data.scores].sort((a, b) => b[metric] - a[metric] || nameOf(a.person.id).localeCompare(nameOf(b.person.id), 'ru'));
  const maximum = sorted[0]?.[metric] || 1;
  const visible = options.all ? sorted : sorted.filter(row => row[metric] > 0).slice(0, 8);
  const leaders = sorted.filter(row => row[metric] === maximum);
  const column = { attendance: 'Встреч', talks: 'Выступлений', awards: 'Наград', wins: 'Побед' }[metric];
  const note = metric === 'wins' ? 'Победы за выступления. Конкурс костюмов отмечен в наградах.' : metric === 'awards' ? 'Именные награды за выступления и костюмы. Подарки всем не считаются отдельными победами.' : metric === 'attendance' ? 'Каждый вечер — одно посещение. Онлайн тоже считается.' : 'Все записанные выступления из программы прошедших встреч.';
  let rank = 0, last = null;
  const rows = visible.map((row, index) => {
    if (row[metric] !== last) { rank = index + 1; last = row[metric]; }
    return `<tr class="${row[metric] === maximum ? 'stats-first-place' : ''}"><td class="stats-rank">${row[metric] ? String(rank).padStart(2, '0') : '—'}</td><th scope="row"><a class="stats-player" href="${personUrl(row.person.id)}"><span class="stats-portrait">${avatar(row.person.id)}</span><span>${escapeHtml(nameOf(row.person.id))}</span></a></th><td class="stats-progress-cell"><span class="stats-score-bar" style="--segments:${maximum}" aria-hidden="true">${Array.from({ length: maximum }, (_, n) => `<i${n < row[metric] ? ' class="filled"' : ''}></i>`).join('')}</span></td><td class="stats-value">${String(row[metric]).padStart(2, '0')}</td></tr>`;
  }).join('');
  return `${statsSwitches('metric', statsMetricLabels, metric)}<div class="stats-record-layout"><div class="stats-score-list"><table class="stats-score-table"><caption class="stats-sr-only">${statsMetricLabels[metric]} — таблица рекордов</caption><thead><tr><th scope="col">Место</th><th scope="col">Участник</th><th scope="col" class="stats-progress-cell">Прогресс</th><th scope="col">${column}</th></tr></thead><tbody>${rows}</tbody></table><div class="stats-table-bottom"><span role="status">${visible.length} из ${data.people.length} участников</span><button class="stats-game-button" type="button" data-stats-control="more" aria-expanded="${options.all}">${options.all ? 'Свернуть таблицу' : 'Все участники'} ${icon(options.all ? 'back' : 'arrow')}</button></div></div><aside class="stats-winners" aria-label="Лидеры выбранного рейтинга">${statsGlyph('cup', 'stats-big-cup')}<h3>${leaders.length > 1 ? 'Делят первое место' : 'Первое место'}</h3><strong class="stats-winning-score">${maximum}<small>${metric === 'attendance' ? 'из ' + data.events.length + ' вечеров' : column.toLowerCase()}</small></strong><div class="stats-winner-cast">${leaders.map(row => `<a href="${personUrl(row.person.id)}"><span class="stats-portrait">${avatar(row.person.id)}</span><span>${escapeHtml(nameOf(row.person.id))}</span></a>`).join('')}</div><p>Одинаковый результат — одинаковое место.</p></aside></div><p class="stats-record-note">${note}</p>`;
}
function statsEventDetails(data, id) {
  const row = data.growth.find(item => item.event.id === id) || data.growth.at(-1);
  if (!row) return '';
  return `<div class="stats-event-stamp">${String(data.events.indexOf(row.event) + 1).padStart(2, '0')}<small>вечер</small></div><div class="stats-event-description"><p class="stats-small-label">${dateFull(row.event.date)}</p><h3><a href="${eventUrl(row.event.id)}">${escapeHtml(row.event.title)} ${icon('arrow')}</a></h3><p>${countText(row.size, ['человек', 'человека', 'человек'])} · ${workText(row.talks)}</p><div class="stats-new-people"><span>${data.events.indexOf(row.event) === 0 ? 'С кого всё началось:' : 'Впервые с нами:'}</span>${row.newcomers.map(id => personLink(id)).join('')}</div></div>`;
}
function statsGrowth(data, options) {
  const valueOf = row => options.chart === 'newcomers' ? row.newcomers.length : row[options.chart];
  const maximum = Math.max(1, ...data.growth.map(valueOf));
  const bars = data.growth.map(row => `<button type="button" class="stats-tower-button ${row.event.id === options.event ? 'selected' : ''}" data-stats-control="event" data-stats-value="${row.event.id}" aria-pressed="${row.event.id === options.event}" aria-label="${escapeHtml(row.event.title)}, ${dateShort(row.event.date)}: ${valueOf(row)}. Показать сведения о встрече" title="${escapeHtml(row.event.title)} · ${row.size} человек · ${row.talks} выступлений"><span class="stats-tower-space"><strong>${valueOf(row)}</strong><span class="stats-tower" style="--tower-height:${Math.round(valueOf(row) / maximum * 174)}px" aria-hidden="true"></span></span><span class="stats-tower-date">${dateShort(row.event.date).slice(0, 5)}<small>${row.event.date.slice(0, 4)}</small></span></button>`).join('');
  const biggest = [...data.growth].sort((a, b) => b.size - a.size)[0];
  const smallest = [...data.growth].sort((a, b) => a.size - b.size)[0];
  const mostNew = [...data.growth.slice(1)].sort((a, b) => b.newcomers.length - a.newcomers.length)[0];
  return `${statsSwitches('chart', statsChartLabels, options.chart)}<div class="stats-chart" aria-label="${statsChartLabels[options.chart]}"><div class="stats-towers">${bars}</div><p class="stats-chart-hint">Выбери столбик — откроется история вечера.</p></div><div class="stats-event-detail" data-stats-event-detail aria-live="polite">${statsEventDetails(data, options.event)}</div><div class="stats-event-records"><span>${statsGlyph('cup')} Самая большая: <a href="${eventUrl(biggest.event.id)}">${escapeHtml(biggest.event.shortTitle)} · ${biggest.size}</a></span><span>${statsGlyph('heart')} Самая камерная: <a href="${eventUrl(smallest.event.id)}">${escapeHtml(smallest.event.shortTitle)} · ${smallest.size}</a></span>${mostNew ? `<span>${statsGlyph('star')} Больше новых лиц: <a href="${eventUrl(mostNew.event.id)}">${escapeHtml(mostNew.event.shortTitle)} · +${mostNew.newcomers.length}</a></span>` : ''}</div>`;
}
function statsInventory(data) {
  const people = [...data.people].sort((a, b) => b.pastAttendance - a.pastAttendance || nameOf(a.id).localeCompare(nameOf(b.id), 'ru'));
  return `<div class="stats-inventory-legend"><span>${statsGlyph('heart')} В комнате</span><span>${statsGlyph('monitor')} Онлайн</span><span><b aria-hidden="true">·</b> Без отметки</span><small>Нажми на клетку, чтобы заглянуть в вечер.</small></div><div class="stats-inventory-scroll" tabindex="0" role="region" aria-label="Посещения: ${countText(data.people.length, ['участник', 'участника', 'участников'])} и ${visitText(data.events.length)}, таблицу можно прокручивать"><table class="stats-matrix"><caption class="stats-sr-only">Кто на каких встречах был. Учтены только прошедшие встречи.</caption><thead><tr><th scope="col">Участники</th>${data.events.map(event => `<th scope="col" data-stats-column="${event.id}"><a href="${eventUrl(event.id)}" title="${escapeHtml(event.title)}">${dateShort(event.date).slice(0, 5)}<small>${event.date.slice(0, 4)}</small></a></th>`).join('')}</tr></thead><tbody>${people.map(person => `<tr><th scope="row"><a href="${personUrl(person.id)}"><span class="stats-mini-portrait">${avatar(person.id)}</span><span>${escapeHtml(nameOf(person.id))}</span></a></th>${data.events.map(event => { const visit = data.visitMap.get(`${person.id}:${event.id}`); const label = visit ? visit.mode === 'online' ? 'Онлайн' : 'В комнате' : 'Нет отметки об участии'; return `<td data-stats-column="${event.id}"><button type="button" class="stats-visit ${visit ? visit.mode : 'absent'}" data-stats-control="visit" data-stats-person="${person.id}" data-stats-value="${event.id}" aria-label="${escapeHtml(nameOf(person.id) + ', ' + dateShort(event.date) + ': ' + label)}" title="${escapeHtml(label)}">${visit ? statsGlyph(visit.mode === 'online' ? 'monitor' : 'heart') : '<span aria-hidden="true">·</span>'}</button></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function statsQuests(data) {
  const always = data.scores.filter(row => row.attendance === data.events.length);
  const doublePeople = [...new Set(data.doubleTalks.map(row => row.person.id))];
  return `<ol class="stats-quest-log"><li><span class="stats-quest-emblem">${statsGlyph('heart')}</span><div><span class="stats-quest-status">Открыто</span><h3>Без единого пропуска</h3><p>${always.map(row => personLink(row.person.id)).join(', ')} — ${data.events.length} из ${data.events.length} вечеров.</p></div><span class="stats-quest-score">${data.events.length}/${data.events.length}</span></li><li><span class="stats-quest-emblem">${statsGlyph('slide')}</span><div><span class="stats-quest-status">Открыто</span><h3>Двойная программа</h3><p>${doublePeople.map(id => personLink(id)).join(', ')} — по два выступления на одном вечере.</p><div class="stats-quest-links">${data.doubleTalks.map(row => `<a href="${eventUrl(row.event.id)}">${escapeHtml(row.event.shortTitle)}</a>`).join('')}</div></div><span class="stats-quest-score">×2</span></li><li><span class="stats-quest-emblem">${statsGlyph('cup')}</span><div><span class="stats-quest-status">Открыто</span><h3>Дебют с победой</h3><p>Пришли на свой первый вечер и сразу победили.</p><div class="stats-debut-winners">${data.debutWins.map(award => `<span>${personLink(award.participantId)}<a href="${eventUrl(award.event.id)}">${escapeHtml(award.event.shortTitle)}</a></span>`).join('')}</div></div><span class="stats-quest-score">${data.debutWins.length}</span></li><li><span class="stats-quest-emblem">${statsGlyph('star')}</span><div><span class="stats-quest-status">Открыто на «Магии»</span><h3>Теперь мы все феечки</h3><p>Вечер, с которого все ушли с призами. И первый конкурс костюмов — его выиграла ${personLink('kristina')}.</p><a href="${eventUrl('party-06')}#memories">Вернуться в магический вечер ${icon('arrow')}</a></div></li></ol><div class="stats-season-levels" aria-label="Встречи по сезонам">${['Весна', 'Лето', 'Осень', 'Зима'].map((name, index) => `<div class="${data.seasons[index] ? 'opened' : 'locked'}">${statsGlyph(data.seasons[index] ? 'star' : 'lock')}<strong>${name}</strong><span>${data.seasons[index] ? visitText(data.seasons[index]) : 'Уровень ещё не открыт'}</span></div>`).join('')}</div>`;
}
function statisticsPage() {
  const data = statisticsData();
  const options = statisticsOptions();
  const counters = [[data.events.length, 'вечеров', 'star'], [data.people.length, 'участника', 'heart'], [data.talks.length, 'выступлений', 'slide'], [data.visits.length, 'посещений', 'cup']];
  return `${header('statistics')}<main id="main" class="page-width page-main statistics-page">${crumbs([['Статистика']])}<div class="stats-page-heading"><div><h1>Статистика</h1><p class="stats-subtitle">Наш кринж в цифрах</p></div><span class="stats-save-label">АРХИВ ${data.events[0].date.slice(0, 4)}—${data.events.at(-1).date.slice(0, 4)}</span></div><dl class="stats-hud">${counters.map(([value, label, glyph]) => `<div><dt>${statsGlyph(glyph)}${label}</dt><dd>${String(value).padStart(2, '0')}</dd></div>`).join('')}</dl><nav class="stats-section-menu" aria-label="Разделы статистики"><a href="#records">Рекорды</a><a href="#growth">Наши вечера</a><a href="#visits">Кто когда был</a><a href="#quests">Достижения</a></nav><section class="stats-game-window stats-record-window" id="records" aria-labelledby="stats-records-title"><div class="stats-window-title"><h2 id="stats-records-title">${statsGlyph('cup')} Таблица рекордов</h2><span>HIGH SCORE</span></div><div data-stats-ranking>${statsRanking(data, options)}</div></section><section class="stats-game-window stats-light-window" id="growth" aria-labelledby="stats-growth-title"><div class="stats-window-title"><h2 id="stats-growth-title">${statsGlyph('star')} Как росли наши вечера</h2><span>${String(data.events.length).padStart(2, '0')} ${plural(data.events.length, ['УРОВЕНЬ', 'УРОВНЯ', 'УРОВНЕЙ'])}</span></div><div data-stats-growth>${statsGrowth(data, options)}</div></section><section class="stats-game-window stats-light-window" id="visits" aria-labelledby="stats-visits-title"><div class="stats-window-title"><h2 id="stats-visits-title">${statsGlyph('heart')} Кто когда был</h2><span>ЛЕТОПИСЬ</span></div>${statsInventory(data)}</section><section class="stats-game-window stats-light-window" id="quests" aria-labelledby="stats-quests-title"><div class="stats-window-title"><h2 id="stats-quests-title">${statsGlyph('star')} Открытые достижения</h2><span>QUEST LOG</span></div>${statsQuests(data)}</section><details class="stats-counting-note"><summary>Как считаются рекорды</summary><p>Только прошедшие встречи. Посещение — один человек на одном вечере; онлайн тоже считается. Будущая встреча и её новые участники появятся в счётчиках после события.</p><p>Выступления считаем по сохранённой программе: на Хэллоуине 2024 в ней 8 работ, хотя в заметке написано 7. Награды — явные именные итоги; победы в отдельной вкладке — за выступления.</p></details><a class="stats-exit" href="meetings.html">${icon('back')} Вернуться в сохранённые вечера</a></main>${footer()}`;
}

function openStatisticsVisit(personId, eventId) {
  const data = statisticsData();
  const event = data.events.find(item => item.id === eventId);
  if (!event || !peopleById.has(personId)) return;
  const visit = data.visitMap.get(`${personId}:${eventId}`);
  const talks = data.talks.filter(talk => talk.participantId === personId && talk.eventId === eventId);
  const label = visit ? visit.mode === 'online' ? 'Онлайн' : 'В комнате' : 'В составе не отмечен(а)';
  const dialog = document.getElementById('detail-dialog');
  dialog.innerHTML = `<div class="dialog-content stats-visit-dialog"><button type="button" class="dialog-close" data-action="close-dialog" aria-label="Закрыть карточку">${icon('close')}</button><p class="eyebrow">Из летописи встреч</p><h2 id="dialog-heading">${escapeHtml(event.title)}</h2><p>${dateFull(event.date)}</p><div class="dialog-person">${avatar(personId)}<div>${personLink(personId)}${badge(label, visit?.mode === 'online' ? 'online' : 'outline')}</div></div>${talks.length ? `<h3>Что рассказывали</h3><ul>${talks.map(talk => `<li>${escapeHtml(talk.title)}</li>`).join('')}</ul>` : visit ? '<p class="quiet-note">В программе этого вечера выступление не записано.</p>' : ''}<a class="button pink" href="${eventUrl(eventId)}">Открыть вечер ${icon('arrow')}</a></div>`;
  dialog.showModal();
}
function handleStatisticsClick(element) {
  const control = element.closest('[data-stats-control]');
  if (!control) return false;
  const kind = control.dataset.statsControl, value = control.dataset.statsValue;
  const data = statisticsData();
  if (kind === 'visit') { openStatisticsVisit(control.dataset.statsPerson, value); return true; }
  if (kind === 'metric' && Object.hasOwn(statsMetricLabels, value)) {
    statsSetParameter('metric', value === 'attendance' ? '' : value);
    document.querySelector('[data-stats-ranking]').innerHTML = statsRanking(data, statisticsOptions());
    document.querySelector(`[data-stats-control="metric"][data-stats-value="${value}"]`)?.focus({ preventScroll: true });
  } else if (kind === 'more') {
    statsSetParameter('all', statisticsOptions().all ? '' : '1');
    document.querySelector('[data-stats-ranking]').innerHTML = statsRanking(data, statisticsOptions());
    document.querySelector('[data-stats-control="more"]')?.focus({ preventScroll: true });
  } else if (kind === 'chart' && Object.hasOwn(statsChartLabels, value)) {
    statsSetParameter('chart', value === 'size' ? '' : value);
    document.querySelector('[data-stats-growth]').innerHTML = statsGrowth(data, statisticsOptions());
    document.querySelector(`[data-stats-control="chart"][data-stats-value="${value}"]`)?.focus({ preventScroll: true });
  } else if (kind === 'event' && data.events.some(event => event.id === value)) {
    statsSetParameter('event', value);
    document.querySelectorAll('[data-stats-control="event"]').forEach(button => { button.classList.toggle('selected', button.dataset.statsValue === value); button.setAttribute('aria-pressed', String(button.dataset.statsValue === value)); });
    document.querySelector('[data-stats-event-detail]').innerHTML = statsEventDetails(data, value);
  }
  return true;
}
function statsInventoryCursor(event) {
  const element = event.target instanceof Element ? event.target : null;
  const cell = element?.closest('.stats-matrix [data-stats-column]');
  if (!cell) return;
  document.querySelectorAll('.stats-matrix [data-stats-column]').forEach(item => item.classList.toggle('stats-column-active', item.dataset.statsColumn === cell.dataset.statsColumn));
}
document.addEventListener('pointerover', statsInventoryCursor);
document.addEventListener('focusin', statsInventoryCursor);
document.addEventListener('pointerout', event => {
  const target = event.target instanceof Element ? event.target : null;
  const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
  if (target?.closest('.stats-matrix') && !related?.closest('.stats-matrix')) document.querySelectorAll('.stats-column-active').forEach(item => item.classList.remove('stats-column-active'));
});
