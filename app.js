'use strict';

const D = window.CRINJ_DATA;
const peopleById = new Map(D.participants.map(person => [person.id, person]));
const eventsById = new Map(D.events.map(event => [event.id, event]));
const avatarById = new Map(D.avatars.avatars.map(avatar => [avatar.key, avatar]));
const pastEvents = D.events.filter(event => event.status === 'past').sort((a, b) => b.date.localeCompare(a.date));
const nextEvent = D.events.find(event => event.status === 'planned');
const app = document.getElementById('app');
const state = { sound: false, audio: null, audioBusy: false, selectedBook: 'svetlana', bookLetter: '' };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const nameOf = id => peopleById.get(id)?.displayName || peopleById.get(id)?.sourceName || 'Участник';
const personUrl = (id, tab = '') => `person-${encodeURIComponent(id)}.html${tab ? '?tab=' + encodeURIComponent(tab) : ''}`;
const eventUrl = id => `meeting-${encodeURIComponent(id)}.html`;
const plural = (number, forms) => forms[number % 100 >= 11 && number % 100 <= 14 ? 2 : number % 10 === 1 ? 0 : number % 10 >= 2 && number % 10 <= 4 ? 1 : 2];
const countText = (number, forms) => `${number} ${plural(number, forms)}`;
const visitText = number => countText(number, ['встреча', 'встречи', 'встреч']);
const workText = number => countText(number, ['выступление', 'выступления', 'выступлений']);
const dateOf = value => new Date(value + 'T12:00:00');
const dateFull = value => new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric' }).format(dateOf(value));
const dateShort = value => value.split('-').reverse().join('.');
const monthOf = value => new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' }).formatToParts(dateOf(value)).find(part => part.type === 'month').value;
const recordedTalks = id => D.talks.filter(talk => talk.participantId === id && talk.status === 'recorded');
const talksAt = id => D.talks.filter(talk => talk.eventId === id);
const attendeesAt = id => D.attendance.filter(record => record.eventId === id);
const personVisits = id => D.attendance.filter(record => record.participantId === id && record.status === 'confirmed_attended').sort((a, b) => eventsById.get(b.eventId).date.localeCompare(eventsById.get(a.eventId).date));
const awardsFor = id => pastEvents.flatMap(event => event.awards.filter(award => award.participantId === id).map(award => ({ ...award, event })));

function icon(type, className = '') {
  const shapes = {
    arrow: '<path d="M3 8h10M9 4l4 4-4 4"/>',
    back: '<path d="M13 8H3m4-4L3 8l4 4"/>',
    sound: '<path d="M2 6h3l4-3v10l-4-3H2zM12 5q4 3 0 6"/>',
    mute: '<path d="M2 6h3l4-3v10l-4-3H2zM12 6l3 4m0-4-3 4"/>',
    slide: '<path d="M2 3h12v9H2zM5 15l3-3 3 3M5 6h6M5 9h3"/>',
    star: '<path d="m8 1 2 4 5 1-3 4 1 5-5-2-5 2 1-5-3-4 5-1z"/>',
    cup: '<path d="M5 2h6v5q0 4-3 4T5 7zM5 4H2v2q0 3 4 3m5-5h3v2q0 3-4 3M8 11v3m-3 0h6"/>',
    heart: '<path d="M8 13 2 7V4l2-2h2l2 2 2-2h2l2 2v3z"/>',
    search: '<circle cx="7" cy="7" r="4"/><path d="m10 10 4 4"/>',
    book: '<path d="M3 2h10v12H3zM1 4h4M1 8h4m-4 4h4M7 5h3M7 8h3"/>',
    calendar: '<path d="M2 4h12v10H2zM2 7h12M5 1v5m6-5v5M5 10h1m3 0h1"/>',
    link: '<path d="m6 5 2-2h4l2 2v3l-3 3H8M10 11l-2 2H4l-2-2V8l3-3h3M6 10l4-4"/>',
    close: '<path d="m3 3 10 10M13 3 3 13"/>',
    door: '<path d="M3 15V1h10v14M6 3h5v12H6zM8 9h1"/>',
    spark: '<path d="M8 1v4l4 3-4 3v4l-3-4-4-3 4-3z"/>'
  };
  return `<svg class="icon ${className}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="miter" aria-hidden="true">${shapes[type] || shapes.spark}</svg>`;
}

function avatar(id, className = '') {
  const item = avatarById.get(id);
  if (!item) return '';
  const [x, y, width, height] = item.viewBox.split(' ').map(Number);
  const stageWidth = item.stageWidth || 340;
  const stageHeight = item.stageHeight || 314;
  return `<svg class="avatar ${className}" viewBox="0 0 ${stageWidth} ${stageHeight}" aria-hidden="true"><svg x="${(stageWidth - width) / 2}" y="${stageHeight - height}" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}" overflow="hidden"><image href="${escapeHtml(item.atlas || D.avatars.atlas)}" width="${item.atlasWidth || D.avatars.width}" height="${item.atlasHeight || D.avatars.height}"/></svg></svg>`;
}

function badge(text, type = '') { return `<span class="badge ${type}">${escapeHtml(text)}</span>`; }
function personLink(id, extra = '') { return `<a href="${personUrl(id)}" class="person-link ${extra}">${escapeHtml(nameOf(id))}</a>`; }
function roleOf(person) {
  if (person.id === 'svetlana') return 'Хозяйка вечеров';
  if (person.roles.includes('организатор')) return 'Организаторка';
  if (!person.pastAttendance) return 'Первый вечер впереди';
  return `С нами с ${eventsById.get(person.firstPastEventId)?.date.slice(0, 4) || '2023'} года`;
}
function header(active = '') {
  return `<header class="site-header"><div class="header-inner"><a href="index.html" class="wordmark" aria-label="Кринж-поинт — главная">Кринж-поинт<span aria-hidden="true">♡</span></a><nav class="main-nav" aria-label="Главное меню">${[['index.html', 'home', 'Главная'], ['meetings.html', 'meetings', 'Встречи'], ['people.html', 'people', 'Люди'], ['statistics.html', 'statistics', 'Статистика']].map(([url, key, text]) => `<a href="${url}"${active === key ? ' class="active" aria-current="page"' : ''}>${text}</a>`).join('')}</nav><button class="sound-button" type="button" data-action="sound" aria-pressed="${state.sound}" aria-label="${state.sound ? 'Выключить' : 'Включить'} тихую фоновую мелодию">${icon(state.sound ? 'sound' : 'mute')}<span>Звук: ${state.sound ? 'вкл' : 'выкл'}</span></button></div></header>`;
}
function footer() {
  return `<footer class="site-footer page-width"><div><a href="index.html" class="footer-brand">Кринж-поинт</a><span>Вечера, которые хочется сохранить.</span></div><div class="footer-right"><span class="saved-counter">с 2023 года ${icon('heart')}</span><a href="welcome.html">Постучать в дверь ${icon('door')}</a></div></footer>`;
}
function crumbs(items) { return `<nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="index.html">Главная</a>${items.map(([label, url]) => `<span aria-hidden="true">/</span>${url ? `<a href="${url}">${escapeHtml(label)}</a>` : `<span aria-current="page">${escapeHtml(label)}</span>`}`).join('')}</nav>`; }
function room(title, options = {}) {
  const scene = options.eventId && eventsById.get(options.eventId)?.scene;
  if (scene) return `<div class="room composed-room ${options.small ? 'room-small' : ''}"><img src="${escapeHtml(scene.src)}" width="${scene.width}" height="${scene.height}" alt="${escapeHtml(scene.alt)}"${options.lazy ? ' loading="lazy"' : ''}></div>`;
  return `<div class="room ${options.small ? 'room-small' : ''}"><img src="assets/room.webp" width="1672" height="941" alt="Пиксельная комната Светы: дверь и шкаф слева, проекция и кровать в центре, стол и рисунки справа, клетчатый плед на полу"${options.lazy ? ' loading="lazy"' : ''}><div class="projection-caption"><span>${escapeHtml(title)}</span>${options.home ? '<small>сохранённые вечера ♡</small>' : ''}</div>${options.home ? `<a class="room-sign room-sign-meetings" href="meetings.html">Встречи ${icon('arrow')}</a><a class="room-sign room-sign-people" href="people.html">Люди ${icon('arrow')}</a><a class="room-sign room-sign-awards" href="${eventUrl(pastEvents[0].id)}#awards">Награды ${icon('arrow')}</a>` : ''}</div>`;
}
function personTile(person) {
  return `<a href="${personUrl(person.id)}" class="person-tile ${avatarById.has(person.id) ? 'has-avatar' : 'without-avatar'}">${avatar(person.id)}<div><strong>${escapeHtml(nameOf(person.id))}</strong><span>${person.pastAttendance ? visitText(person.pastAttendance) : 'Первый вечер впереди'}</span></div>${icon('arrow', 'tile-arrow')}</a>`;
}
function homePage() {
  const latest = pastEvents[0];
  const ordered = [...D.participants].sort((a, b) => (a.id === 'svetlana' ? -1 : b.id === 'svetlana' ? 1 : b.pastAttendance - a.pastAttendance || nameOf(a.id).localeCompare(nameOf(b.id), 'ru')));
  return `${header('home')}<main id="main" class="home-main"><section class="home-heading page-width"><div><p class="eyebrow">Домашняя страничка нашей компании</p><h1>Заходи, мы тут<span class="heading-spark" aria-hidden="true">✧</span></h1><p class="intro-copy">Презентации на странные темы. Хорошие люди. Одна квартира.</p></div><div class="home-since"><span class="pixel-heart" aria-hidden="true">♡</span><span>Собираемся с 2023 года</span><small>В гостях у Светы</small></div></section><section class="home-room-section" aria-label="Наша комната">${room('Кринж-поинт', { home: true })}<div class="room-caption page-width"><span>${pastEvents.length} сохранённых вечеров · ${D.participants.filter(person => person.pastAttendance > 0).length} человека уже были с нами</span></div></section><section class="latest-section page-width" aria-labelledby="latest-title"><a href="${eventUrl(latest.id)}" class="latest-thumb" aria-label="Открыть последний вечер — ${escapeHtml(latest.title)}">${room(latest.shortTitle, { small: true, lazy: true, eventId: latest.id })}</a><div><p class="eyebrow">Последний сохранённый вечер</p><h2 id="latest-title"><a href="${eventUrl(latest.id)}">${dateShort(latest.date)} <span>·</span> ${escapeHtml(latest.shortTitle)}</a></h2><p>${latest.attendeesFromRows} человек · ${workText(latest.talkRecordsFromRows)}</p></div><a href="${eventUrl(latest.id)}" class="button pink">Открыть вечер ${icon('arrow')}</a></section><section class="company-section page-width" aria-labelledby="company-title"><div class="section-heading"><div><p class="eyebrow">Знакомые лица</p><h2 id="company-title">Все свои</h2></div><a class="underlined-link" href="people.html">В адресную книжку ${icon('arrow')}</a></div><div class="company-grid">${ordered.map(personTile).join('')}</div></section>${nextEvent ? `<section class="next-evening page-width"><div class="next-icon" aria-hidden="true">${icon('calendar')}</div><div><p class="eyebrow">Ещё один вечер впереди</p><h2>${escapeHtml(nextEvent.title)}</h2><p>${dateFull(nextEvent.date)} · ${nextEvent.attendeesFromRows} человек в планах</p></div><a href="${eventUrl(nextEvent.id)}" class="button">Заглянуть в анонс ${icon('arrow')}</a></section>` : ''}<section class="home-note page-width"><span aria-hidden="true">✧</span><p>Однажды мы будем вспоминать и эти вечера.<br>Пусть у них уже будет свой маленький уголок в интернете.</p><span aria-hidden="true">✧</span></section></main>${footer()}`;
}

function eventTicket(event, compact = false) {
  return `<a class="event-ticket ${compact ? 'compact' : ''}" href="${eventUrl(event.id)}"><div class="ticket-date"><strong>${Number(event.date.slice(8))}</strong><span>${escapeHtml(monthOf(event.date))}</span><small>${event.date.slice(0, 4)}</small></div><div class="ticket-thumb">${room(event.shortTitle, { small: true, lazy: true, eventId: event.id })}</div><div class="ticket-copy"><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(event.summary)}</p><span>${event.attendeesFromRows} человек <i>·</i> ${workText(event.talkRecordsFromRows)}</span></div>${icon('arrow', 'ticket-arrow')}</a>`;
}
function meetingsPage() {
  const params = new URLSearchParams(location.search);
  const selectedYear = params.get('year') || 'all';
  const years = [...new Set(pastEvents.map(event => event.date.slice(0, 4)))];
  const filtered = pastEvents.filter(event => selectedYear === 'all' || event.date.startsWith(selectedYear));
  return `${header('meetings')}<main id="main" class="page-width page-main">${crumbs([['Встречи']])}<div class="page-heading"><div><p class="eyebrow">Наш маленький архив</p><h1>Сохранённые вечера</h1><p>Можно вернуться в любой. Даже если тогда тебя ещё не было.</p></div><div class="archive-stamp"><strong>${String(pastEvents.length).padStart(2, "0")}</strong><span>вечеров<br>с 2023 года</span></div></div>${nextEvent ? `<a class="upcoming-strip" href="${eventUrl(nextEvent.id)}">${icon('calendar')}<span><small>Следующая встреча</small><strong>${dateShort(nextEvent.date)} · ${escapeHtml(nextEvent.title)}</strong></span>${badge('Ещё впереди', 'outline')}${icon('arrow')}</a>` : ''}<nav class="filter-tabs" aria-label="Встречи по годам"><a href="meetings.html"${selectedYear === 'all' ? ' class="selected" aria-current="true"' : ''}>Все вечера</a>${years.map(year => `<a href="meetings.html?year=${year}"${selectedYear === year ? ' class="selected" aria-current="true"' : ''}>${year}</a>`).join('')}</nav><div class="timeline">${filtered.length ? years.filter(year => filtered.some(event => event.date.startsWith(year))).map(year => `<section class="timeline-year"><h2><span>${year}</span></h2><div>${filtered.filter(event => event.date.startsWith(year)).map(event => eventTicket(event)).join('')}</div></section>`).join('') : '<p class="empty-state">В этом году вечеров пока нет.</p>'}</div></main>${footer()}`;
}

function programRow(talk, index) {
  return `<li class="program-row" data-program-row data-search-text="${escapeHtml((talk.title + ' ' + nameOf(talk.participantId)).toLowerCase())}"><span class="program-number">${String(index + 1).padStart(2, '0')}</span><div><button type="button" class="program-talk" data-talk="${escapeHtml(talk.id)}">${escapeHtml(talk.title || 'Тема ещё не записана')}</button><div class="program-author">${personLink(talk.participantId)}${talk.award ? `<span title="${escapeHtml(talk.award)}">${icon('cup')}</span>` : ''}</div></div></li>`;
}
function attendanceCard(record) {
  const person = peopleById.get(record.participantId);
  return `<a href="${personUrl(person.id)}" class="attendee ${avatarById.has(person.id) ? 'has-avatar' : ''}">${avatar(person.id)}<strong>${escapeHtml(nameOf(person.id))}</strong>${record.mode === 'online' ? badge('Онлайн', 'online') : '<span>В комнате</span>'}</a>`;
}
function awardsList(event, personalId = '') {
  const awards = event.awards.filter(award => !personalId || award.participantId === personalId).sort((a, b) => (a.category === 'costume' ? 100 : a.place === 1 ? 0 : a.place || 2) - (b.category === 'costume' ? 100 : b.place === 1 ? 0 : b.place || 2));
  if (!awards.length) return '<p class="quiet-note">В этот вечер награды ещё не отмечали.</p>';
  return `<div class="awards-list">${awards.map(award => `<article class="award-ribbon ${award.category === 'costume' ? 'costume-award' : ''}"><div class="award-icon">${icon(award.category === 'costume' ? 'star' : 'cup')}</div><div><span class="award-label">${escapeHtml(award.label)}</span>${personalId ? '' : `<h3>${personLink(award.participantId)}</h3>`}${award.prize ? `<p>${escapeHtml(award.prize)}</p>` : ''}${award.talkId ? `<button type="button" class="text-button" data-talk="${escapeHtml(award.talkId)}">За выступление ${icon('arrow')}</button>` : ''}</div></article>`).join('')}</div>`;
}
function eventPage(id) {
  const event = eventsById.get(id);
  if (!event) return notFoundPage();
  const planned = event.status === 'planned';
  const talks = talksAt(id);
  const attendees = attendeesAt(id);
  const chronological = [...pastEvents].reverse();
  const current = chronological.findIndex(item => item.id === id);
  const previous = planned ? chronological.at(-1) : chronological[current - 1];
  const following = planned ? null : chronological[current + 1];
  return `${header('meetings')}<main id="main" class="page-width page-main event-page">${crumbs([['Встречи', 'meetings.html'], [event.title]])}<div class="page-heading event-heading"><div><p class="eyebrow">${planned ? 'Этот вечер ещё впереди' : 'Вечер ' + String(Number(id.slice(-2))).padStart(2, '0') + ' · ' + escapeHtml(event.season)}</p><h1>${escapeHtml(event.title)}</h1><p class="event-facts"><time datetime="${event.date}">${dateFull(event.date)}</time><span>·</span>${attendees.length} ${planned ? 'человек в планах' : 'человек'}${event.onlineFromRows ? ` <small>(из них ${event.onlineFromRows} онлайн)</small>` : ''}<span>·</span>${workText(talks.length)}${planned ? ' в планах' : ''}</p></div>${badge(planned ? 'Скоро встретимся' : 'Сохранено ♡', planned ? 'pink-badge' : 'outline')}</div><div class="event-layout"><section class="event-scene" aria-label="Комната встречи">${room(event.shortTitle, { eventId: event.id })}<div class="room-caption"><span>В квартире Светы</span>${event.scene ? `<button type="button" class="text-button room-zoom" data-scene="true" data-photo="${escapeHtml(event.scene.src)}" data-photo-alt="${escapeHtml(event.title + ' — комната встречи')}">Рассмотреть комнату ${icon('search')}</button>` : ''}</div>${planned ? `<div class="event-note"><strong>Пока это анонс.</strong><p>Кто придёт и что будет происходить — сохраним после встречи. А темы уже можно подсмотреть в программе.</p></div>` : `<p class="scene-summary">${escapeHtml(event.summary)}</p>`}</section><aside class="program-panel" aria-labelledby="program-heading"><div class="program-heading"><h2 id="program-heading">${planned ? 'Что готовим' : 'Что смотрели'}</h2><span>${String(talks.length).padStart(2, '0')}</span></div><label class="program-search">${icon('search')}<input type="search" placeholder="Тема или имя" aria-label="Поиск в программе" data-search="program"></label><ol class="program-list">${talks.map(programRow).join('')}</ol><p class="program-empty" hidden>По этому запросу ничего нет.</p><div class="program-footnote">${icon('slide')}<span>Нажми на тему, чтобы открыть карточку выступления.</span></div></aside></div><nav class="event-section-nav" aria-label="Разделы вечера"><a href="#attendees">Кто ${planned ? 'собирается' : 'был'} <span>${attendees.length}</span></a>${!planned ? '<a href="#memories">Что запомнили</a><a href="#awards">Награды</a>' : ''}${event.photos?.length ? '<a href="#photos">Фотографии</a>' : ''}</nav><section class="event-section" id="attendees"><div class="section-heading"><h2>Кто ${planned ? 'собирается' : 'был с нами'}</h2><span class="muted">${attendees.length} человек${event.onlineFromRows ? ' · ' + event.onlineFromRows + ' онлайн' : ''}</span></div><div class="attendee-grid">${attendees.map(attendanceCard).join('')}</div></section>${!planned && event.memories.length ? `<section class="event-section" id="memories"><div class="section-heading"><div><p class="eyebrow">Из летописи компании</p><h2>Что запомнили</h2></div><span class="section-spark" aria-hidden="true">✧</span></div><div class="memories-list">${event.memories.map((memory, index) => `<article class="memory-note"><span class="memory-index">${String(index + 1).padStart(2, '0')}</span><p>${escapeHtml(memory)}</p></article>`).join('')}</div></section>` : ''}${!planned ? `<section class="event-section" id="awards"><div class="section-heading"><div><p class="eyebrow">Маленькая полка этого вечера</p><h2>Кому досталась слава</h2></div>${icon('cup', 'section-cup')}</div>${awardsList(event)}</section>` : ''}${event.photos?.length ? `<section class="event-section" id="photos"><h2>Фотографии вечера</h2><div class="photo-strip">${event.photos.map((photo, index) => `<button type="button" data-photo="${escapeHtml(photo.src)}" data-photo-alt="${escapeHtml(photo.alt || 'Фото вечера ' + (index + 1))}"><img loading="lazy" src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.alt || 'Фото вечера ' + (index + 1))}"></button>`).join('')}</div></section>` : ''}${id === 'party-03' ? '<p class="source-note">В программе сохранены все 8 записанных выступлений. В заметке об этом вечере указано 7 — это расхождение ещё предстоит уточнить.</p>' : ''}<nav class="evening-pagination" aria-label="Другие вечера">${previous ? `<a href="${eventUrl(previous.id)}">${icon('back')}<span><small>Предыдущий вечер</small>${escapeHtml(previous.shortTitle)}</span></a>` : '<span></span>'}<a class="all-evenings" href="meetings.html">Все встречи</a>${following ? `<a href="${eventUrl(following.id)}"><span><small>Следующий вечер</small>${escapeHtml(following.shortTitle)}</span>${icon('arrow')}</a>` : nextEvent && !planned ? `<a href="${eventUrl(nextEvent.id)}"><span><small>Ещё впереди</small>${escapeHtml(nextEvent.title)}</span>${icon('arrow')}</a>` : '<span></span>'}</nav></main>${footer()}`;
}

function personCounters(person) {
  return `<dl class="person-counters"><div><dt>Встречи</dt><dd>${person.pastAttendance}</dd></div><div><dt>Выступления</dt><dd>${person.recordedWorks}</dd></div><div><dt>Награды</dt><dd>${awardsFor(person.id).length}</dd></div></dl>`;
}
function achievements(person, limit = Infinity) {
  const items = (person.achievements || []).slice(0, limit);
  return items.length ? `<div class="achievement-badges">${items.map(item => `<span class="achievement" title="${escapeHtml(item.detail)}">${icon(item.category === 'role' ? 'heart' : item.category === 'costume' ? 'star' : item.category === 'presentation' ? 'cup' : 'spark')}<span>${escapeHtml(item.label)}</span></span>`).join('')}</div>` : '';
}
function sortedPeople(query = '', sort = 'name', letter = '') {
  const search = query.trim().toLocaleLowerCase('ru');
  return D.participants.filter(person => (!search || `${person.displayName} ${person.sourceName}`.toLocaleLowerCase('ru').includes(search)) && (!letter || nameOf(person.id).startsWith(letter))).sort((a, b) => (sort === 'attendance' ? b.pastAttendance - a.pastAttendance : sort === 'talks' ? b.recordedWorks - a.recordedWorks : 0) || nameOf(a.id).localeCompare(nameOf(b.id), 'ru'));
}
function bookRows(people, selected) {
  return people.map((person, index) => `<a class="book-row ${selected === person.id ? 'selected' : ''} ${avatarById.has(person.id) ? 'has-avatar' : ''}" href="people.html?person=${person.id}" data-book-person="${person.id}"${selected === person.id ? ' aria-current="true"' : ''}>${avatarById.has(person.id) ? avatar(person.id) : `<span class="book-row-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>`}<span><strong>${escapeHtml(nameOf(person.id))}</strong><small>${person.pastAttendance ? visitText(person.pastAttendance) : 'Скоро первый вечер'}</small></span>${icon('arrow')}</a>`).join('');
}
function shortTalk(talk, showEvent = true) {
  const event = eventsById.get(talk.eventId);
  return `<article class="short-talk"><span class="talk-icon">${icon('slide')}</span><div><button class="talk-title" type="button" data-talk="${escapeHtml(talk.id)}">${escapeHtml(talk.title || 'Тема ещё не записана')}</button>${showEvent ? `<a class="talk-context" href="${eventUrl(event.id)}">${escapeHtml(event.shortTitle)} · ${dateShort(event.date)}</a>` : ''}</div>${talk.award ? icon('cup', 'talk-cup') : ''}</article>`;
}
function bookPreview(id) {
  const person = peopleById.get(id);
  if (!person) return '<div class="book-empty"><span aria-hidden="true">✧</span><h2>Никого не нашли</h2><p>Попробуй другое имя или сбрось фильтр.</p><button type="button" class="button" data-action="reset-book">Показать всех</button></div>';
  const talks = recordedTalks(id).slice(-2).reverse();
  return `<div class="book-preview-top"><span>Личная карточка</span>${badge(roleOf(person), 'outline')}</div><div class="book-preview-identity ${avatarById.has(id) ? 'has-avatar' : ''}">${avatar(id, 'preview-avatar')}<div><h2>${escapeHtml(nameOf(id))}</h2><p>${person.firstPastEventId ? 'Первый вечер — ' + dateFull(eventsById.get(person.firstPastEventId).date) : 'Пока собирается на первый вечер'}</p>${achievements(person, 3)}</div></div>${personCounters(person)}<div class="book-preview-detail"><div class="mini-heading"><h3>${talks.length ? 'Последние выступления' : 'Знакомство ещё впереди'}</h3>${talks.length ? `<a href="${personUrl(id, 'talks')}">Все ${icon('arrow')}</a>` : ''}</div>${talks.length ? talks.map(talk => shortTalk(talk)).join('') : `<p class="quiet-note">${person.pastAttendance ? 'В архиве пока нет выступлений этого человека.' : 'После первой встречи здесь появится своя история.'}</p>`}</div><div class="book-preview-bottom"><span>${person.online ? 'Был и онлайн-формат ♡' : 'Часть нашей компании ♡'}</span><a href="${personUrl(id)}" class="button pink">Открыть страничку ${icon('arrow')}</a></div>`;
}
function peoplePage() {
  const params = new URLSearchParams(location.search);
  const query = params.get('q') || '';
  const sort = params.get('sort') || 'name';
  const letter = params.get('letter') || '';
  state.bookLetter = letter;
  const filtered = sortedPeople(query, sort, letter);
  const requested = params.get('person') || 'svetlana';
  state.selectedBook = filtered.some(person => person.id === requested) ? requested : filtered[0]?.id || '';
  const letters = [...new Set(D.participants.map(person => nameOf(person.id)[0]))].sort((a, b) => a.localeCompare(b, 'ru'));
  return `${header('people')}<main id="main" class="page-width page-main">${crumbs([['Люди']])}<div class="page-heading"><div><p class="eyebrow">В одной записной книжке</p><h1>Все свои</h1><p>У каждого — своя история, выступления и маленькие достижения.</p></div><div class="book-stamp">${icon('book')}<span>${D.participants.length} имён<br>в нашей компании</span></div></div><div class="address-book"><section class="book-directory" aria-label="Список участников"><div class="book-controls"><label class="search-field">${icon('search')}<input type="search" data-search="people" value="${escapeHtml(query)}" placeholder="Найти по имени" aria-label="Найти участника по имени"></label><label class="sort-control"><span>Порядок</span><select data-sort="people" aria-label="Порядок участников"><option value="name"${sort === 'name' ? ' selected' : ''}>По имени</option><option value="attendance"${sort === 'attendance' ? ' selected' : ''}>Чаще бывали</option><option value="talks"${sort === 'talks' ? ' selected' : ''}>Больше выступали</option></select></label></div><div class="letter-tabs" aria-label="По первой букве"><button type="button" data-letter="" class="${letter === '' ? 'selected' : ''}">Все</button>${letters.map(item => `<button type="button" data-letter="${escapeHtml(item)}" class="${letter === item ? 'selected' : ''}">${escapeHtml(item)}</button>`).join('')}</div><p class="book-count" role="status">${filtered.length} из ${D.participants.length} записей</p><div class="book-list">${bookRows(filtered, state.selectedBook)}</div></section><section class="book-preview" aria-label="Краткая карточка участника">${bookPreview(state.selectedBook)}</section></div></main>${footer()}`;
}

function connectionContent(person) {
  const inviter = person.invitedBy ? peopleById.get(person.invitedBy) : null;
  const brought = D.participants.filter(candidate => candidate.invitedBy === person.id);
  const shared = new Map();
  for (const visit of personVisits(person.id)) for (const record of attendeesAt(visit.eventId)) {
    if (record.participantId !== person.id) shared.set(record.participantId, (shared.get(record.participantId) || 0) + 1);
  }
  const companions = [...shared].sort((a, b) => b[1] - a[1] || nameOf(a[0]).localeCompare(nameOf(b[0]), 'ru')).slice(0, 5);
  return `<section class="profile-section"><div class="section-heading"><h2>Как мы встретились</h2>${icon('link')}</div>${inviter ? `<p class="connection-sentence">В нашу компанию привела ${personLink(inviter.id)}.</p>` : '<p class="quiet-note">Кто привёл в компанию — пока не записано.</p>'}${brought.length ? `<div class="mini-heading"><h3>Пришли следом</h3></div><div class="connection-people">${brought.map(personTile).join('')}</div>` : ''}</section>${companions.length ? `<section class="profile-section"><h2>Чаще всего в одной комнате</h2><div class="companion-list">${companions.map(([id, count]) => `<a href="${personUrl(id)}">${avatar(id)}<strong>${escapeHtml(nameOf(id))}</strong><span>${visitText(count)} вместе</span>${icon('arrow')}</a>`).join('')}</div></section>` : ''}`;
}
function profileOverview(person) {
  const visits = personVisits(person.id);
  const talks = recordedTalks(person.id).slice(-3).reverse();
  const children = D.participants.filter(candidate => candidate.invitedBy === person.id);
  return `<div class="profile-overview-grid"><section class="profile-section"><div class="section-heading"><h2>На полях карточки</h2><span aria-hidden="true">✧</span></div><dl class="profile-facts"><div><dt>Первый вечер</dt><dd>${person.firstPastEventId ? `<a href="${eventUrl(person.firstPastEventId)}">${dateFull(eventsById.get(person.firstPastEventId).date)}</a>` : 'Ещё впереди'}</dd></div><div><dt>Как участвовал${['dima-alina', 'dima-blokhastyi', 'andrey-g', 'vitalya', 'misha'].includes(person.id) ? '' : 'а'}</dt><dd>${person.inPerson ? visitText(person.inPerson) + ' в комнате' : 'Пока только в планах'}${person.online ? ' · ' + person.online + ' онлайн' : ''}</dd></div>${person.invitedBy ? `<div><dt>Кто привёл</dt><dd>${personLink(person.invitedBy)}</dd></div>` : ''}${children.length ? `<div><dt>Привели друзей</dt><dd>${children.map(child => personLink(child.id)).join(', ')}</dd></div>` : ''}</dl>${person.id === 'svetlana' ? '<p class="handwritten-note">Та самая квартира. Та самая хозяйка.<br>И место, куда мы каждый раз возвращаемся ♡</p>' : ''}</section><section class="profile-section"><div class="section-heading"><h2>Последние вечера</h2><a href="${personUrl(person.id, 'meetings')}">Все ${icon('arrow')}</a></div>${visits.length ? visits.slice(0, 3).map(visit => { const event = eventsById.get(visit.eventId); return `<a class="profile-visit" href="${eventUrl(event.id)}"><span class="visit-date">${dateShort(event.date)}</span><strong>${escapeHtml(event.shortTitle)}</strong>${visit.mode === 'online' ? badge('Онлайн', 'online') : icon('arrow')}</a>`; }).join('') : `<p class="quiet-note">${nextEvent ? `Первая встреча пока впереди. <a href="${eventUrl(nextEvent.id)}">Заглянуть в анонс</a>.` : 'Здесь появятся первые воспоминания.'}</p>`}</section></div><section class="profile-section"><div class="section-heading"><h2>Что рассказывали</h2><a href="${personUrl(person.id, 'talks')}">Все выступления ${icon('arrow')}</a></div>${talks.length ? talks.map(talk => shortTalk(talk)).join('') : '<p class="quiet-note">Выступлений в архиве пока нет.</p>'}</section>`;
}
function profileTab(person, tab) {
  if (tab === 'talks') {
    const talks = recordedTalks(person.id).sort((a, b) => eventsById.get(b.eventId).date.localeCompare(eventsById.get(a.eventId).date));
    const planned = D.talks.filter(talk => talk.participantId === person.id && talk.status !== 'recorded');
    return `<section class="profile-section"><div class="section-heading"><h2>Выступления</h2><span class="muted">${workText(talks.length)}</span></div>${talks.length ? talks.map(talk => shortTalk(talk)).join('') : '<p class="quiet-note">Сохранённых выступлений пока нет.</p>'}</section>${planned.length ? `<section class="profile-section planned-talks"><p class="eyebrow">Готовится к следующему вечеру</p>${planned.map(talk => shortTalk(talk)).join('')}</section>` : ''}`;
  }
  if (tab === 'meetings') {
    const visits = personVisits(person.id);
    const planned = D.attendance.filter(record => record.participantId === person.id && record.status === 'planned');
    return `<section class="profile-section"><div class="section-heading"><h2>Личные вечера</h2><span class="muted">${visitText(visits.length)}</span></div>${visits.length ? visits.map(visit => `<div class="personal-meeting">${visit.mode === 'online' ? badge('Участие онлайн', 'online') : ''}${eventTicket(eventsById.get(visit.eventId), true)}</div>`).join('') : '<p class="quiet-note">Первая встреча ещё впереди.</p>'}${planned.length ? `<div class="planned-person-meetings"><h3>Планы</h3>${planned.map(visit => `<a href="${eventUrl(visit.eventId)}">${icon('calendar')} ${escapeHtml(eventsById.get(visit.eventId).title)} · ${dateShort(eventsById.get(visit.eventId).date)} ${badge(visit.mode === 'online' ? 'Планирует онлайн' : 'Планирует прийти', 'outline')}</a>`).join('')}</div>` : ''}</section>`;
  }
  if (tab === 'awards') {
    const relevantEvents = pastEvents.filter(event => event.awards.some(award => award.participantId === person.id));
    return `<section class="profile-section"><div class="section-heading"><h2>Личная полка</h2>${icon('cup', 'section-cup')}</div>${relevantEvents.length ? relevantEvents.map(event => `<div class="personal-awards"><a class="award-event" href="${eventUrl(event.id)}">${escapeHtml(event.shortTitle)} <span>· ${dateShort(event.date)}</span>${icon('arrow')}</a>${awardsList(event, person.id)}</div>`).join('') : '<p class="quiet-note">Пока без наград за выступления. Хорошие вечера в зачёт идут всё равно ♡</p>'}</section>${person.achievements.length ? `<section class="profile-section"><h2>Особые отметки</h2><div class="achievement-details">${person.achievements.map(item => `<article>${icon('star')}<div><h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(item.detail)}</p>${item.eventId ? `<a href="${eventUrl(item.eventId)}">Вспомнить этот вечер ${icon('arrow')}</a>` : ''}</div></article>`).join('')}</div></section>` : ''}`;
  }
  if (tab === 'connections') return connectionContent(person);
  return profileOverview(person);
}
function profilePage(id) {
  const person = peopleById.get(id);
  if (!person) return notFoundPage();
  const requested = new URLSearchParams(location.search).get('tab') || 'profile';
  const tab = ['profile', 'talks', 'meetings', 'awards', 'connections'].includes(requested) ? requested : 'profile';
  const menus = [['profile', 'book', 'Карточка'], ['talks', 'slide', 'Выступления'], ['meetings', 'calendar', 'Встречи'], ['awards', 'cup', 'Награды'], ['connections', 'link', 'Кто кого привёл']];
  return `${header('people')}<main id="main" class="page-width page-main profile-page">${crumbs([['Люди', 'people.html'], [nameOf(id)]])}<div class="profile-layout"><aside class="profile-sidebar" aria-label="Разделы личной страницы">${avatarById.has(id) ? `<div class="profile-sidebar-portrait">${avatar(id)}</div>` : ''}<p class="sidebar-name">${escapeHtml(nameOf(id))}</p><nav>${menus.map(([key, pictogram, text]) => `<a href="${personUrl(id, key === 'profile' ? '' : key)}"${tab === key ? ' class="selected" aria-current="page"' : ''}>${icon(pictogram)}<span>${text}</span>${key === 'talks' ? `<small>${person.recordedWorks}</small>` : key === 'meetings' ? `<small>${person.pastAttendance}</small>` : ''}</a>`).join('')}</nav><a href="people.html?person=${id}" class="back-to-book">${icon('back')} В адресную книжку</a></aside><div class="profile-content"><section class="identity-card"><div class="identity-card-top"><span class="eyebrow">Личная страничка</span>${badge(roleOf(person), 'outline')}</div>${avatar(id, "identity-mobile-avatar")}<h1>${escapeHtml(nameOf(id))}<span class="identity-heart" aria-hidden="true">♡</span></h1>${achievements(person)}${personCounters(person)}</section><div class="profile-tab-content">${profileTab(person, tab)}</div></div></div></main>${footer()}`;
}

function entrySign() {
  return `<svg class="entry-door-sign" viewBox="0 0 300 190" aria-hidden="true"><g shape-rendering="crispEdges"><path d="M150 12h-16v7h-24v7H86v7H62v7H44v12M150 12h16v7h24v7h24v7h24v7h18v12" fill="none" stroke="#be9a65" stroke-width="4"/><path d="M20 51h268v8h8v119h-8v9H20v-9h-8V59h8Z" fill="#492e26" opacity=".45"/><path d="M12 44h268v8h8v119h-8v9H12v-9H4V52h8Z" fill="#6b442e"/><path d="M17 51h258v7h6v107h-6v8H17v-8h-6V58h6Z" fill="#d6a86a"/><path d="M23 58h246v7h5v92h-5v8H23v-8h-5V65h5Z" fill="#fff0cb"/><path d="M23 58h246v7H23Z" fill="#fff9df"/><path d="M23 157h246v8H23Z" fill="#e6c38c"/><path d="M145 3h10v10h-10Z" fill="#533b2e"/><path d="M147 4h5v4h-5Z" fill="#f2c885"/><path d="M29 73h5v-5h5v5h5v5h-5v5h-5v-5h-5ZM256 73h5v-5h5v5h5v5h-5v5h-5v-5h-5Z" fill="#b7786a"/></g><text x="146" y="99" text-anchor="middle" class="entry-sign-title">КРИНЖ ТУТ</text><text x="146" y="127" text-anchor="middle" class="entry-sign-copy">заходи,</text><text x="146" y="150" text-anchor="middle" class="entry-sign-copy">всегда открыто</text></svg>`;
}

function entryVignette(art, source, crop) {
  const core = [[32,80,448,664],[96,56,96,32],[240,56,80,32],[376,56,64,32],[208,0,96,96],[8,128,24,96],[-16,256,48,72],[8,384,24,96],[-16,552,48,96],[8,696,24,48],[480,104,24,80],[480,224,48,72],[480,352,24,144],[480,568,48,72],[480,704,24,40],[32,744,448,48],[8,768,496,48],[-16,792,544,24],[32,816,448,24],[80,840,352,24],[144,864,224,24]];
  const loose = [[-40,160,24,24,.65],[-64,288,24,24,.4],[-16,488,24,24,.7],[-48,584,24,24,.4],[-24,728,24,24,.65],[528,144,24,24,.55],[552,312,32,32,.4],[520,504,24,24,.65],[536,688,24,24,.4],[-16,864,24,24,.6],[488,848,24,24,.6],[56,80,24,24,.65],[384,16,24,24,.45],[104,904,16,16,.35],[416,888,24,24,.4],[240,912,24,24,.5]];
  const tiles = [...core, ...loose].map(([x,y,width,height,opacity=1]) => `<rect${x < -16 || x + width > 528 ? ' class="entry-fragment-far"' : ''} x="${x}" y="${y}" width="${width}" height="${height}" fill="white" opacity="${opacity}"/>`).join('');
  return `<svg class="entry-vignette" viewBox="0 0 ${crop.width} ${crop.height}" role="img" aria-labelledby="entry-scene-title"><title id="entry-scene-title">Пиксельная дверь Светы с лампой и небольшим фрагментом стены и пола; края рассыпаются на прозрачные квадратики.</title><defs><mask id="entry-fragment-mask" maskUnits="userSpaceOnUse" x="-80" y="0" width="672" height="${crop.height}">${tiles}</mask><linearGradient id="entry-light-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe3a0" stop-opacity=".9"/><stop offset=".42" stop-color="#ffc66c" stop-opacity=".45"/><stop offset="1" stop-color="#ffd69a" stop-opacity="0"/></linearGradient><radialGradient id="entry-wall-glow"><stop offset="0" stop-color="#ffda83" stop-opacity=".26"/><stop offset=".5" stop-color="#ffbe4f" stop-opacity=".08"/><stop offset="1" stop-color="#ffbe4f" stop-opacity="0"/></radialGradient></defs><g mask="url(#entry-fragment-mask)"><image href="${art}" x="${-crop.x}" y="${-crop.y}" width="${source.width}" height="${source.height}"/><ellipse class="entry-warmth" cx="438" cy="450" rx="150" ry="380" fill="url(#entry-wall-glow)"/><g class="entry-floor-light"><svg x="146" y="726" width="520" height="176" viewBox="0 0 600 230" preserveAspectRatio="none"><path d="M300 0H338V19H363V39H393V62H424V88H465V119H505V151H551V187H600V230H0V203H44V176H85V149H126V121H166V93H202V66H235V42H268V20H300Z" fill="url(#entry-light-gradient)"/></svg></g></g></svg>`;
}

function welcomePage() {
  const art = 'assets/entry-landing-02.webp';
  const source = { width: 1536, height: 1024 };
  const canvas = { x: 496, y: 0, width: 512, height: 936 };
  const leaf = { x: 95, y: 137, width: 327, height: 594 };
  const placement = `--door-x:${leaf.x / canvas.width * 100}%;--door-y:${leaf.y / canvas.height * 100}%;--door-w:${leaf.width / canvas.width * 100}%;--door-h:${leaf.height / canvas.height * 100}%`;
  return `${header()}<main id="main" class="entry-page"><h1 class="entry-sr-only">У двери Светы</h1><div class="entry-frame"><div class="entry-scene" style="${placement}">${entryVignette(art, source, canvas)}<span class="entry-portal" aria-hidden="true"></span><button type="button" class="entry-door" data-action="enter" aria-label="Кринж тут. Заходи, всегда открыто. Открыть дверь и войти на главную"><span class="entry-door-leaf"><svg class="entry-door-art" viewBox="${leaf.x + canvas.x} ${leaf.y + canvas.y} ${leaf.width} ${leaf.height}" preserveAspectRatio="none" aria-hidden="true"><image href="${art}" width="${source.width}" height="${source.height}"/></svg>${entrySign()}</span></button></div></div></main>`;
}
function notFoundPage() { return `${header()}<main id="main" class="page-width not-found"><span class="error-number" aria-hidden="true">404</span><h1>Кажется, другая комната</h1><p>Здесь пока пусто. Наши люди и вечера — по соседству.</p><a href="index.html" class="button pink">Вернуться к своим ${icon('arrow')}</a></main>${footer()}`; }

function currentRoute() {
  const base = window.CRINJ_BASE_PATH || '/';
  if (!location.pathname.startsWith(base)) return { type: '404' };
  let file;
  try { file = decodeURIComponent(location.pathname.slice(base.length)) || 'index.html'; }
  catch { return { type: '404' }; }
  if (file.includes('/')) return { type: '404' };
  if (file === 'index.html' || file === '') return { type: 'home' };
  if (file === 'meetings.html') return { type: 'meetings' };
  if (file === 'people.html') return { type: 'people' };
  if (file === 'statistics.html') return { type: 'statistics' };
  if (file === 'welcome.html') return { type: 'welcome' };
  const event = file.match(/^meeting-(.+)\.html$/);
  if (event) return { type: 'event', id: event[1] };
  const person = file.match(/^person-(.+)\.html$/);
  if (person) return { type: 'profile', id: person[1] };
  return { type: '404' };
}
function render() {
  const route = currentRoute();
  let title;
  if (route.type === 'home') { app.innerHTML = homePage(); title = 'Заходи, мы тут'; }
  else if (route.type === 'meetings') { app.innerHTML = meetingsPage(); title = 'Сохранённые вечера'; }
  else if (route.type === 'event') { app.innerHTML = eventPage(route.id); title = eventsById.get(route.id)?.title; }
  else if (route.type === 'people') { app.innerHTML = peoplePage(); title = 'Все свои'; }
  else if (route.type === 'statistics') { app.innerHTML = statisticsPage(); title = 'Статистика'; }
  else if (route.type === 'profile') { app.innerHTML = profilePage(route.id); title = nameOf(route.id); }
  else if (route.type === 'welcome') { app.innerHTML = welcomePage(); title = 'У двери'; }
  else { app.innerHTML = notFoundPage(); title = 'Комната не найдена'; }
  document.title = `${title || 'Страница не найдена'} · Кринж-поинт`;
  app.insertAdjacentHTML('beforeend', '<dialog class="detail-dialog" id="detail-dialog" aria-labelledby="dialog-heading"></dialog><div class="toast" role="status" aria-live="polite"></div>');
  document.getElementById('main')?.classList.add('page-enter');
  document.querySelectorAll('[data-letter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.letter === state.bookLetter)));
}
function navigate(url) {
  const next = new URL(url, location.href);
  try { history.pushState(null, '', next.pathname + next.search + next.hash); } catch { location.href = next.href; return; }
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (next.hash) requestAnimationFrame(() => document.getElementById(next.hash.slice(1))?.scrollIntoView());
  else requestAnimationFrame(() => { const heading = document.querySelector('main h1'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); } });
}

function toast(message) {
  const element = document.querySelector('.toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('visible');
  window.setTimeout(() => element.classList.remove('visible'), 3800);
}
function updateBook() {
  const input = document.querySelector('[data-search="people"]');
  const select = document.querySelector('[data-sort="people"]');
  if (!input || !select) return;
  const filtered = sortedPeople(input.value, select.value, state.bookLetter);
  if (!filtered.some(person => person.id === state.selectedBook)) state.selectedBook = filtered[0]?.id || '';
  document.querySelector('.book-list').innerHTML = bookRows(filtered, state.selectedBook);
  document.querySelector('.book-preview').innerHTML = bookPreview(state.selectedBook);
  document.querySelector('.book-count').textContent = `${filtered.length} из ${D.participants.length} записей`;
  document.querySelectorAll('[data-letter]').forEach(button => { button.classList.toggle('selected', button.dataset.letter === state.bookLetter); button.setAttribute('aria-pressed', String(button.dataset.letter === state.bookLetter)); });
  const params = new URLSearchParams();
  if (state.selectedBook) params.set('person', state.selectedBook);
  if (input.value) params.set('q', input.value);
  if (select.value !== 'name') params.set('sort', select.value);
  if (state.bookLetter) params.set('letter', state.bookLetter);
  try { history.replaceState(null, '', 'people.html' + (params.size ? '?' + params.toString() : '')); } catch { /* File previews can restrict history updates. */ }
}
function openTalk(id) {
  const talk = D.talks.find(item => item.id === id);
  if (!talk) return;
  const event = eventsById.get(talk.eventId);
  const dialog = document.getElementById('detail-dialog');
  const planned = event.status === 'planned';
  const safeFileUrl = talk.fileUrl && /^https?:\/\//i.test(talk.fileUrl) ? talk.fileUrl : '';
  dialog.innerHTML = `<div class="dialog-content"><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Закрыть карточку">${icon('close')}</button><p class="eyebrow">${planned ? 'Готовится к вечеру' : 'Из программы вечера'}</p><div class="dialog-slide-icon">${icon('slide')}</div><h2 id="dialog-heading">${escapeHtml(talk.title || 'Тема ещё не записана')}</h2><div class="dialog-person">${avatar(talk.participantId)}<div>${personLink(talk.participantId)}<a href="${eventUrl(event.id)}">${escapeHtml(event.shortTitle)} · ${dateShort(event.date)}</a></div></div>${talk.award ? `<div class="dialog-award">${icon('cup')} ${escapeHtml(talk.award)}</div>` : ''}${safeFileUrl ? `<a href="${escapeHtml(safeFileUrl)}" class="button pink" target="_blank" rel="noopener noreferrer">Открыть презентацию ${icon('arrow')}</a>` : `<p class="file-note">${planned ? 'Вечер ещё впереди — файл появится позже.' : 'Название и автор сохранены. Сам файл пока не добавлен в архив.'}</p>`}<a href="${eventUrl(event.id)}" class="underlined-link">Весь вечер ${icon('arrow')}</a></div>`;
  dialog.showModal();
}
function updateSoundButtons() {
  document.querySelectorAll('[data-action="sound"]').forEach(button => {
    button.innerHTML = icon(state.sound ? 'sound' : 'mute') + `<span>Звук: ${state.sound ? 'вкл' : 'выкл'}</span>`;
    button.setAttribute('aria-pressed', String(state.sound));
    button.setAttribute('aria-label', `${state.sound ? 'Выключить' : 'Включить'} тихую фоновую мелодию`);
  });
}
async function toggleSound() {
  if (state.audioBusy) return;
  state.audioBusy = true;
  try {
    if (!state.audio) {
      state.audio = document.getElementById('background-music');
      if (!state.audio) throw new Error('Background music unavailable');
      state.audio.volume = 0.2;
      const syncSound = () => {
        state.sound = !state.audio.paused && !state.audio.error;
        updateSoundButtons();
      };
      for (const event of ['playing', 'pause', 'ended', 'error']) state.audio.addEventListener(event, syncSound);
    }
    if (state.sound) {
      state.audio.pause();
      state.sound = false;
    } else {
      await state.audio.play();
      state.sound = !state.audio.paused;
    }
  } catch {
    state.audio?.pause();
    state.sound = false;
    toast('Не удалось включить музыку. Попробуй нажать ещё раз.');
  } finally {
    state.audioBusy = false;
    updateSoundButtons();
  }
}

document.addEventListener('click', async event => {
  const element = event.target instanceof Element ? event.target : null;
  if (!element) return;
  if (handleStatisticsClick(element)) return;
  const action = element.closest('[data-action]');
  if (action) {
    if (action.dataset.action === 'sound') await toggleSound();
    else if (action.dataset.action === 'close-dialog') document.getElementById('detail-dialog')?.close();
    else if (action.dataset.action === 'reset-book') {
      document.querySelector('[data-search="people"]').value = '';
      state.bookLetter = '';
      updateBook();
    } else if (action.dataset.action === 'enter') {
      if (action.disabled) return;
      action.disabled = true;
      action.setAttribute('aria-busy', 'true');
      action.classList.add('door-opening');
      window.setTimeout(() => { if (action.isConnected) navigate('index.html'); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 680);
    }
    return;
  }
  const talk = element.closest('[data-talk]');
  if (talk) { openTalk(talk.dataset.talk); return; }
  const photo = element.closest('[data-photo]');
  if (photo) {
    const dialog = document.getElementById('detail-dialog');
    dialog.innerHTML = `<div class="dialog-content photo-dialog ${photo.dataset.scene ? 'scene-dialog' : ''}"><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Закрыть изображение">${icon('close')}</button><h2 id="dialog-heading">${escapeHtml(photo.dataset.photoAlt)}</h2><img src="${escapeHtml(photo.dataset.photo)}" alt="${escapeHtml(photo.dataset.photoAlt)}"></div>`;
    dialog.showModal();
    return;
  }
  const letter = element.closest('[data-letter]');
  if (letter) { state.bookLetter = letter.dataset.letter; updateBook(); return; }
  const bookPerson = element.closest('[data-book-person]');
  if (bookPerson && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    state.selectedBook = bookPerson.dataset.bookPerson;
    document.querySelector('.book-preview').innerHTML = bookPreview(state.selectedBook);
    document.querySelectorAll('[data-book-person]').forEach(row => { row.classList.toggle('selected', row.dataset.bookPerson === state.selectedBook); if (row.dataset.bookPerson === state.selectedBook) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current'); });
    const url = new URL(location.href); url.searchParams.set('person', state.selectedBook);
    try { history.replaceState(null, '', url.pathname + url.search); } catch { /* Optional URL persistence. */ }
    if (matchMedia('(max-width: 760px)').matches) document.querySelector('.book-preview').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    return;
  }
  const link = element.closest('a[href]');
  if (link && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !link.target && !link.hasAttribute('download') && !link.getAttribute('href').startsWith('#')) {
    const url = new URL(link.href, location.href);
    const file = url.pathname.split('/').pop();
    if (url.origin === location.origin && /^(index|people|meetings|statistics|welcome|404|person-.+|meeting-.+)\.html$/.test(file)) { event.preventDefault(); navigate(url.href); }
  }
  if (element.id === 'detail-dialog') element.close();
});
document.addEventListener('input', event => {
  const input = event.target;
  if (input.dataset.search === 'people') updateBook();
  if (input.dataset.search === 'program') {
    const query = input.value.trim().toLocaleLowerCase('ru');
    let found = 0;
    document.querySelectorAll('[data-program-row]').forEach(row => { row.hidden = !row.dataset.searchText.includes(query); if (!row.hidden) found++; });
    document.querySelector('.program-empty').hidden = found > 0;
  }
});
document.addEventListener('change', event => { if (event.target.dataset.sort === 'people') updateBook(); });
window.addEventListener('popstate', () => { render(); if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView()); });
render();
