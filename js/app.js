(() => {
  "use strict";

  const app = document.getElementById("app");
  const tabbar = document.getElementById("tabbar");
  let DATA = null;

  const MONTHS_NL = ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];

  // ---------------- utils ----------------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  const qs = (sel, root = document) => root.querySelector(sel);

  function todayLocalISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function dayNum(dateStr) {
    return parseInt(dateStr.slice(8, 10), 10);
  }

  function shortMonth(dateStr) {
    const m = parseInt(dateStr.slice(5, 7), 10) - 1;
    return MONTHS_NL[m].slice(0, 3);
  }

  function cityById(id) {
    return DATA.cities.find((c) => c.id === id);
  }

  function dayById(date) {
    if (date === DATA.departure.date) return DATA.departure;
    return DATA.days.find((d) => d.date === date);
  }

  function allDaysOrdered() {
    return [...DATA.days, DATA.departure].sort((a, b) => a.date.localeCompare(b.date));
  }

  // ---------------- google maps helpers ----------------
  function routePlaces(stops) {
    const places = (stops || [])
      .filter((s) => !s.transit && s.place)
      .map((s) => s.place);
    // dedupe consecutive duplicates
    return places.filter((p, i) => i === 0 || p !== places[i - 1]);
  }

  function mapsEmbedUrl(places) {
    if (!places.length) return null;
    if (places.length === 1) {
      return `https://www.google.com/maps?q=${encodeURIComponent(places[0])}&output=embed`;
    }
    const origin = encodeURIComponent(places[0]);
    const rest = places.slice(1).map(encodeURIComponent).join("+to:");
    return `https://www.google.com/maps?saddr=${origin}&daddr=${rest}&dirflg=w&output=embed`;
  }

  function mapsOpenUrl(places) {
    if (!places.length) return "#";
    if (places.length === 1) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(places[0])}`;
    }
    const origin = places[0];
    const destination = places[places.length - 1];
    const waypoints = places.slice(1, -1);
    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=walking`;
    if (waypoints.length) url += `&waypoints=${encodeURIComponent(waypoints.join("|"))}`;
    return url;
  }

  // ---------------- header ----------------
  function header({ title, sub, back, plain }) {
    return `
      <header class="page-header ${plain ? "plain" : ""}">
        <div class="header-row">
          ${back ? `<a href="${back}" class="back-btn">‹</a>` : ""}
          <div>
            <div class="header-title">${esc(title)}</div>
            ${sub ? `<div class="header-sub">${esc(sub)}</div>` : ""}
          </div>
        </div>
      </header>`;
  }

  // ---------------- trip status ----------------
  function tripStatus() {
    const today = todayLocalISO();
    const { startDate, endDate } = DATA.meta;
    if (today < startDate) {
      const diffDays = Math.round((new Date(startDate) - new Date(today)) / 86400000);
      return { phase: "before", text: `Nog ${diffDays} ${diffDays === 1 ? "dag" : "dagen"} tot vertrek` };
    }
    if (today > endDate) {
      return { phase: "after", text: "Reis afgelopen — hopelijk een topvakantie gehad" };
    }
    const d = dayById(today);
    if (d) {
      return { phase: "during", text: `Vandaag: ${d.title}`, date: today };
    }
    return { phase: "during", text: "Onderweg vandaag", date: today };
  }

  // ---------------- views ----------------
  function viewHome() {
    const status = tripStatus();
    const cities = [...DATA.cities].sort((a, b) => a.order - b.order);
    return `
      <section class="hero">
        <div class="hero-eyebrow">${esc(DATA.meta.dateRangeLabel)}</div>
        <h1 class="hero-title">${esc(DATA.meta.title)}</h1>
        <p class="hero-subtitle">${esc(DATA.meta.subtitle)}</p>
        <a href="${status.date ? "#/dag/" + status.date : "#/dagen"}" class="status-pill">
          <span class="dot"></span>${esc(status.text)}
        </a>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-num">${DATA.meta.stats.days}</div><div class="stat-label">dagen</div></div>
          <div class="stat-card"><div class="stat-num">${DATA.meta.stats.cities}</div><div class="stat-label">steden</div></div>
          <div class="stat-card"><div class="stat-num">${DATA.meta.stats.hotels}</div><div class="stat-label">hotels</div></div>
          <div class="stat-card"><div class="stat-num">${DATA.meta.stats.freeMoments}</div><div class="stat-label">gratis momenten</div></div>
        </div>
      </section>
      <section class="section">
        <div class="section-title">De reis in één oogopslag</div>
        <p class="section-desc">${esc(DATA.meta.routeIntro)}</p>
        ${cities.map(cityCard).join("")}
      </section>
      <p class="footnote">${esc(DATA.meta.pricesCheckedNote)}</p>
    `;
  }

  function cityCard(c) {
    return `
      <a href="#/stad/${c.id}" class="city-card">
        <span class="city-nights">${c.nights} nachten</span>
        <div class="city-card-top">
          <span class="city-order">${c.order}</span>
          <div>
            <p class="city-name">${esc(c.name)}</p>
            <div class="city-dates">${esc(c.dateRangeLabel)}</div>
          </div>
        </div>
        <div class="city-highlights">${esc(c.highlightsSummary)}</div>
        <span class="city-note">${esc(c.note)}</span>
      </a>`;
  }

  function viewCity(id) {
    const c = cityById(id);
    if (!c) return viewNotFound();
    const days = c.days.map(dayById);
    const h = c.hotel;
    const hotelMapUrl = h ? mapsOpenUrl([h.place]) : null;
    return `
      ${header({ title: c.name, sub: `${c.nights} nachten`, back: "#/" })}
      <section class="section" style="padding-top:18px;">
        <p class="section-desc">${esc(c.description)}</p>
      </section>

      ${h ? `
      <section class="section" style="padding-top:0;">
        <div class="section-title">Hotel</div>
        <a class="hotel-card" href="${hotelMapUrl}" target="_blank" rel="noopener">
          <div class="hotel-card-icon">🏨</div>
          <div class="hotel-card-body">
            <div class="hotel-card-name">${esc(h.name)}</div>
            <div class="hotel-card-area">${esc(h.neighborhood)}</div>
          </div>
          <div class="hotel-card-chevron">↗</div>
        </a>
        ${h.note ? `<p class="hotel-note">${esc(h.note)}</p>` : ""}
        ${c.foodGuide ? `<a href="#/eten/${c.id}" class="hotel-food-link">🍽️ Eten &amp; drinken bij dit hotel →</a>` : ""}
      </section>` : ""}

      <section class="section" style="padding-top:0;">
        <div class="day-group-label">Dagen</div>
        ${days.map(dayRow).join("")}
      </section>
    `;
  }

  function foodGuideSection(fg) {
    const groups = [
      { key: "breakfast", label: "Ontbijt — bakkerijen", img: "images/breakfast.png", items: fg.breakfast },
      { key: "bar", label: "Borrelen in de buurt", img: "images/bar.png", items: fg.bar },
      { key: "dinner", label: "Diner in de buurt", img: "images/dinner.png", items: fg.dinner },
    ];
    return groups.filter((g) => g.items && g.items.length).map((g) => `
      <div class="food-group">
        <div class="food-group-head">
          <img class="food-group-img" src="${g.img}" alt="" loading="lazy" />
          <div class="food-group-label">${esc(g.label)}</div>
          <div class="food-group-count">${g.items.length}</div>
        </div>
        <div class="food-scroll">
          ${g.items.map((it) => `
            <a class="food-card" href="${mapsOpenUrl([it.name + ", " + it.area])}" target="_blank" rel="noopener">
              <div class="food-card-name">${esc(it.name)}</div>
              <div class="food-card-area">${esc(it.area)}</div>
              <div class="food-card-note">${esc(it.note)}</div>
              <div class="food-card-link">Open in Maps ↗</div>
            </a>
          `).join("")}
        </div>
      </div>
    `).join("");
  }

  function viewEten(focusCityId) {
    const cities = [...DATA.cities].sort((a, b) => a.order - b.order).filter((c) => c.foodGuide);
    return `
      ${header({ title: "Eten & drinken", sub: "Ontbijt, borrel en diner rond elk hotel", plain: true })}
      <section class="section" style="padding-top:18px;">
        <p class="section-desc">Check openingstijden vooraf — vooral bakkerijen sluiten vaak vroeg in de middag.</p>
      </section>
      ${cities.map((c) => `
        <section class="section eten-city-section" id="stad-${c.id}" style="padding-top:6px;">
          <div class="eten-city-head">
            <div class="section-title" style="margin-bottom:0;">${esc(c.name)}</div>
            ${c.hotel ? `<div class="eten-city-hotel">🏨 ${esc(c.hotel.name)}</div>` : ""}
          </div>
          ${foodGuideSection(c.foodGuide)}
        </section>
      `).join("")}
    `;
  }

  function viewHighlights() {
    const cities = [...DATA.cities].sort((a, b) => a.order - b.order);
    return `
      ${header({ title: "Highlights", sub: `${DATA.highlights.length} bezienswaardigheden met achtergrondverhaal`, plain: true })}
      <section class="section" style="padding-top:18px;">
        <p class="section-desc">Een paar weetjes bij elke grote stop onderweg.</p>
      </section>
      ${cities.map((c) => {
        const items = DATA.highlights.filter((h) => h.city === c.id);
        if (!items.length) return "";
        return `
        <section class="section" style="padding-top:6px;">
          <div class="section-title">${esc(c.name)}</div>
          ${items.map(highlightCard).join("")}
        </section>`;
      }).join("")}
    `;
  }

  function highlightCard(h) {
    const img = h.photo || `images/highlights/${h.id}.png`;
    const day = dayById(h.date);
    return `
      <a class="highlight-card" href="#/highlight/${h.id}">
        <img class="highlight-card-img" src="${img}" alt="" loading="lazy" />
        <div class="highlight-card-body">
          <div class="highlight-card-name">${esc(h.name)}</div>
          <ul class="highlight-card-facts">
            ${h.facts.slice(0, 2).map((f) => `<li>${esc(f)}</li>`).join("")}
          </ul>
          <div class="highlight-card-day">${day ? `Bezocht op ${esc(day.weekday.toLowerCase())} ${dayNum(h.date)} ${esc(shortMonth(h.date))}` : ""} · Meer weetjes →</div>
        </div>
      </a>
    `;
  }

  // ---------------- highlight hero animations ----------------
  const SCENE_CONFIG = {
    "sagrada-familia": ["rays", "bird"],
    "sant-pau": ["tiles", "sparkle"],
    "park-guell": ["tiles", "sparkle"],
    "casa-vicens": ["tiles", "sparkle"],
    "tibidabo": ["cloud", "bird"],
    "palau-musica": ["sparkle", "glow"],
    "casa-batllo": ["tiles", "sparkle"],
    "la-pedrera": ["cloud", "bird"],
    "font-magica": ["wave", "sparkle"],
    "boqueria": ["sparkle", "dust"],
    "barri-gotic": ["bird", "dust"],
    "torres-serranos": ["flag", "bird"],
    "san-nicolas": ["rays", "sparkle"],
    "valencia-cathedral": ["bird", "rays"],
    "mercado-central": ["sparkle", "dust"],
    "ciudad-artes": ["glow", "tiles"],
    "oceanografic": ["wave", "bubble"],
    "catedral-sevilla": ["rays", "bird"],
    "real-alcazar": ["tiles", "cloud"],
    "casa-pilatos": ["tiles", "dust"],
    "metropol-parasol": ["glow", "tiles"],
    "plaza-espana": ["tiles", "wave"],
    "macarena": ["sparkle", "rays"],
    "torre-oro": ["wave", "sparkle"],
    "alcazaba-malaga": ["flag", "dust"],
    "teatro-romano": ["dust", "rays"],
    "gibralfaro": ["flag", "cloud"],
    "caminito-del-rey": ["cloud", "bird"],
    "catedral-malaga": ["rays", "bird"],
  };

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h >>> 0;
  }

  function makeRand(seed) {
    let s = seed % 2147483647 || 1;
    return () => {
      s = (s * 48271) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function sceneElements(kind, rand) {
    const n1 = (min, span) => min + Math.floor(rand() * span);
    const f1 = (min, span) => min + rand() * span;
    let out = "";
    switch (kind) {
      case "bird": {
        const n = n1(2, 2);
        for (let i = 0; i < n; i++) {
          out += `<svg class="scene-el bird" style="top:${f1(10, 42).toFixed(1)}%; animation-duration:${f1(9, 6).toFixed(1)}s; animation-delay:-${f1(0, 8).toFixed(1)}s;" viewBox="0 0 16 8"><path d="M0 4 Q4 0 8 4 Q12 0 16 4" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="1.6" stroke-linecap="round"/></svg>`;
        }
        return out;
      }
      case "sparkle": {
        const n = n1(6, 4);
        for (let i = 0; i < n; i++) {
          const size = f1(3, 3);
          out += `<span class="scene-el sparkle" style="top:${f1(6, 78).toFixed(1)}%; left:${f1(4, 92).toFixed(1)}%; width:${size.toFixed(1)}px; height:${size.toFixed(1)}px; animation-duration:${f1(1.8, 2).toFixed(1)}s; animation-delay:-${f1(0, 3).toFixed(1)}s;"></span>`;
        }
        return out;
      }
      case "dust": {
        const n = n1(7, 5);
        for (let i = 0; i < n; i++) {
          out += `<span class="scene-el dust" style="left:${f1(4, 92).toFixed(1)}%; animation-duration:${f1(5, 4).toFixed(1)}s; animation-delay:-${f1(0, 6).toFixed(1)}s;"></span>`;
        }
        return out;
      }
      case "bubble": {
        const n = n1(7, 5);
        for (let i = 0; i < n; i++) {
          const size = f1(5, 6);
          out += `<span class="scene-el bubble" style="left:${f1(4, 92).toFixed(1)}%; width:${size.toFixed(1)}px; height:${size.toFixed(1)}px; animation-duration:${f1(4, 4).toFixed(1)}s; animation-delay:-${f1(0, 6).toFixed(1)}s;"></span>`;
        }
        return out;
      }
      case "cloud": {
        const n = n1(2, 2);
        for (let i = 0; i < n; i++) {
          const w = f1(60, 50);
          out += `<span class="scene-el cloud" style="top:${f1(6, 30).toFixed(1)}%; width:${w.toFixed(0)}px; height:${(w * 0.4).toFixed(0)}px; animation-duration:${f1(20, 14).toFixed(1)}s; animation-delay:-${f1(0, 20).toFixed(1)}s;"></span>`;
        }
        return out;
      }
      case "flag": {
        const n = n1(2, 2);
        for (let i = 0; i < n; i++) {
          out += `<span class="scene-el flag" style="top:${f1(8, 18).toFixed(1)}%; left:${f1(15, 70).toFixed(1)}%; animation-duration:${f1(1.8, 1.2).toFixed(1)}s; animation-delay:-${f1(0, 2).toFixed(1)}s;"></span>`;
        }
        return out;
      }
      case "rays":
        return `<span class="scene-el rays" style="animation-duration:${f1(40, 20).toFixed(0)}s;"></span>`;
      case "tiles":
        return `<span class="scene-el tiles" style="--shimmer-dur:${f1(2.8, 1.6).toFixed(1)}s;"></span>`;
      case "glow":
        return `<span class="scene-el glow" style="animation-duration:${f1(2.6, 1.2).toFixed(1)}s;"></span>`;
      case "wave":
        return `<span class="scene-el wave-wrap"><svg class="wave-svg" style="animation-duration:${f1(7, 5).toFixed(1)}s;" viewBox="0 0 800 40" preserveAspectRatio="none"><path d="M0 20 C 50 0, 150 0, 200 20 C 250 40, 350 40, 400 20 C 450 0, 550 0, 600 20 C 650 40, 750 40, 800 20 L800 40 L0 40 Z" fill="rgba(255,255,255,.3)"/></svg></span>`;
      default:
        return "";
    }
  }

  function renderScene(h) {
    const kinds = SCENE_CONFIG[h.id] || ["sparkle", "dust"];
    const rand = makeRand(hashStr(h.id));
    const img = h.photo || `images/highlights/${h.id}.png`;
    const parts = kinds.map((k) => sceneElements(k, rand)).join("");
    return `
      <div class="hero-scene" style="background-image:url('${img}')">
        ${parts}
        <div class="scene-shade"></div>
      </div>`;
  }

  function viewHighlightDetail(id) {
    const h = DATA.highlights.find((x) => x.id === id);
    if (!h) return viewNotFound();
    const city = cityById(h.city);
    const day = dayById(h.date);
    return `
      ${header({ title: h.name, sub: city ? city.name : "", back: "#/highlights" })}
      <section class="section" style="padding-top:18px;">
        ${renderScene(h)}
        <div class="hl-meta-row">
          ${city ? `<span class="hl-chip">${esc(city.name)}</span>` : ""}
          ${day ? `<a href="#/dag/${h.date}" class="hl-chip hl-chip-link">${esc(day.weekday)} ${dayNum(h.date)} ${esc(shortMonth(h.date))} →</a>` : ""}
        </div>
      </section>
      <section class="section" style="padding-top:4px;">
        <div class="info-card hl-tip-card">
          <div class="hl-tip-top">
            <h3>💡 Tip</h3>
            <span class="hl-duration">⏱ ${esc(h.duration)}</span>
          </div>
          <p>${esc(h.tip)}</p>
        </div>
      </section>
      <section class="section" style="padding-top:4px;">
        <div class="section-title">Weetjes</div>
        <ul class="hl-facts-list">
          ${h.facts.map((f) => `<li>${esc(f)}</li>`).join("")}
        </ul>
      </section>
    `;
  }

  function dayRow(d) {
    const today = todayLocalISO();
    const isToday = d.date === today;
    const city = cityById(d.city);
    return `
      <a href="#/dag/${d.date}" class="day-row ${isToday ? "is-today" : ""}">
        <div class="day-date-block">
          <div class="day-date-num">${dayNum(d.date)}</div>
          <div class="day-date-dow">${shortMonth(d.date)}</div>
        </div>
        <div class="day-row-main">
          <div class="day-row-title">${esc(d.title)}${isToday ? '<span class="today-badge">Vandaag</span>' : ""}</div>
          <div class="day-row-sub">${esc(d.weekday)} · ${esc(city ? city.name : "")}</div>
        </div>
        <div class="day-row-chevron">›</div>
      </a>`;
  }

  function viewDaysList() {
    const cities = [...DATA.cities].sort((a, b) => a.order - b.order);
    return `
      ${header({ title: "Alle dagen", sub: DATA.meta.dateRangeLabel, plain: true })}
      <section class="section" style="padding-top:18px;">
        ${cities.map((c) => `
          <div class="day-group-label">${esc(c.name)}</div>
          ${c.days.map((date) => dayRow(dayById(date))).join("")}
        `).join("")}
        <div class="day-group-label">Vertrek</div>
        ${departureRow()}
      </section>
    `;
  }

  function departureRow() {
    const d = DATA.departure;
    const today = todayLocalISO();
    const isToday = d.date === today;
    return `
      <a href="#/vertrek" class="day-row ${isToday ? "is-today" : ""}">
        <div class="day-date-block">
          <div class="day-date-num">${dayNum(d.date)}</div>
          <div class="day-date-dow">${shortMonth(d.date)}</div>
        </div>
        <div class="day-row-main">
          <div class="day-row-title">${esc(d.title)}${isToday ? '<span class="today-badge">Vandaag</span>' : ""}</div>
          <div class="day-row-sub">${esc(d.weekday)} · Málaga (AGP)</div>
        </div>
        <div class="day-row-chevron">›</div>
      </a>`;
  }

  function stopHtml(s, isLast) {
    return `
      <div class="stop ${s.transit ? "is-transit" : ""} ${s.hotel ? "is-hotel" : ""}">
        <div class="stop-rail">
          <div class="stop-dot"></div>
          ${isLast ? "" : '<div class="stop-line"></div>'}
        </div>
        <div class="stop-body">
          <div class="stop-time">${s.hotel ? "🏨 Hotel" : esc(s.time)}</div>
          <div class="stop-name">${esc(s.name)}</div>
          ${s.detail ? `<div class="stop-detail">${esc(s.detail)}</div>` : ""}
          ${s.transit ? '<div class="stop-transit-tag">Onderweg tussen steden</div>' : ""}
        </div>
      </div>`;
  }

  function viewDay(date) {
    const d = dayById(date);
    if (!d) return viewNotFound();
    if (d === DATA.departure) return viewDeparture();
    const city = cityById(d.city);
    const places = routePlaces(d.stops);
    const embed = mapsEmbedUrl(places);
    const openUrl = mapsOpenUrl(places);

    return `
      <header class="page-header">
        <div class="header-row">
          <a href="#/stad/${d.city}" class="back-btn">‹</a>
          <div>
            <div class="header-title">${esc(d.displayDate)}</div>
            <div class="header-sub">${esc(city ? city.name : "")} · ${esc(d.title)}</div>
          </div>
        </div>
        <div class="day-hero-meta">
          <span class="meta-chip">📍 ${esc(d.distance)}</span>
        </div>
      </header>

      <div class="timeline">
        ${d.stops.map((s, i) => stopHtml(s, i === d.stops.length - 1)).join("")}
      </div>

      ${places.length >= 1 ? `
      <div class="map-card">
        <div class="map-card-head">Route van vandaag</div>
        <div class="map-card-sub">Google Maps · ${esc(d.distance)}</div>
        <iframe class="map-embed" src="${embed}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        <div class="map-actions">
          <a class="btn primary" href="${openUrl}" target="_blank" rel="noopener">Open route in Google Maps</a>
        </div>
        <div class="map-card-sub" style="padding-top:0;">Laadt de kaart hierboven niet? De knop opent de route altijd, ook offline gepland.</div>
      </div>` : ""}

      ${d.dinnerTip ? `
      <div class="dinner-tip-card">
        <img class="dinner-tip-img" src="images/dinner.png" alt="" loading="lazy" />
        <div class="dinner-tip-body">
          <div class="dinner-tip-kicker">Etentip voor vanavond</div>
          <div class="dinner-tip-name">${esc(d.dinnerTip.name)}</div>
          <div class="dinner-tip-area">${esc(d.dinnerTip.area)}</div>
          <div class="dinner-tip-note">${esc(d.dinnerTip.note)}</div>
          <a class="dinner-tip-link" href="${mapsOpenUrl([d.dinnerTip.name + ", " + d.dinnerTip.area])}" target="_blank" rel="noopener">Open in Google Maps ↗</a>
        </div>
      </div>` : ""}

      <p class="footnote">Check actuele reistijden en openingstijden in Google Maps.</p>
    `;
  }

  function viewDeparture() {
    const d = DATA.departure;
    return `
      ${header({ title: d.displayDate, sub: "Vertrekdag · Málaga (AGP)", back: "#/stad/malaga" })}
      <section class="section" style="padding-top:18px;">
        <p class="section-desc">${esc(d.intro)}</p>
        ${d.scenarios.map((sc) => `
          <div class="scenario-card">
            <div class="scenario-top">
              <div class="scenario-name">${esc(sc.name)}</div>
              <div class="scenario-time">${esc(sc.timeLabel)}</div>
            </div>
            <div class="scenario-note">${esc(sc.note)}</div>
            <ol class="scenario-steps">
              ${sc.steps.map((st) => `<li>${esc(st)}</li>`).join("")}
            </ol>
          </div>
        `).join("")}
      </section>
      <p class="footnote">${esc(d.footnote)}</p>
    `;
  }

  function viewTickets() {
    const t = DATA.tickets;
    return `
      ${header({ title: "Tickets", sub: t.note, plain: true })}
      <section class="section" style="padding-top:18px;">
        ${t.rows.map((r) => `
          <div class="ticket-row">
            <div class="ticket-row-top">
              <div class="ticket-name">${esc(r.name)}</div>
              <div class="ticket-price">${esc(r.price)}</div>
            </div>
            <div class="ticket-meta ${/GRATIS|altijd/.test(r.free) ? "ticket-free" : ""}">${esc(r.free)}</div>
            <div class="ticket-meta">Boeken: ${esc(r.booking)}</div>
            <div class="ticket-site">${esc(r.site)}</div>
          </div>
        `).join("")}
      </section>
      <p class="footnote">${esc(t.footnote)}</p>

      <section class="section">
        <div class="section-title">Wat wanneer boeken</div>
        <p class="section-desc">${esc(DATA.booking.note)}</p>
        ${DATA.booking.items.map((b) => `
          <div class="booking-row ${b.done ? "is-done" : ""}">
            <div class="booking-check">${b.done ? "✓" : ""}</div>
            <div>
              <div class="booking-name">${esc(b.name)}</div>
              <div class="booking-when">${esc(b.when)}</div>
              <div class="booking-note">${esc(b.note)}</div>
            </div>
          </div>
        `).join("")}
      </section>
      <p class="footnote">${esc(DATA.booking.footnote)}</p>
    `;
  }

  function viewNotFound() {
    return `${header({ title: "Niet gevonden", back: "#/" })}<div class="empty-state">Deze pagina bestaat niet.</div>`;
  }

  // ---------------- router ----------------
  function parseRoute() {
    const hash = location.hash.replace(/^#\/?/, "");
    const [seg, arg] = hash.split("/");
    return { seg: seg || "", arg };
  }

  function render() {
    const { seg, arg } = parseRoute();
    let html = "";
    let tabRoute = seg;
    switch (seg) {
      case "":
        html = viewHome();
        tabRoute = "";
        break;
      case "stad":
        html = viewCity(arg);
        tabRoute = "dagen";
        break;
      case "dagen":
        html = viewDaysList();
        break;
      case "eten":
        html = viewEten(arg);
        break;
      case "highlights":
        html = viewHighlights();
        break;
      case "highlight":
        html = viewHighlightDetail(arg);
        tabRoute = "highlights";
        break;
      case "dag":
        html = viewDay(arg);
        tabRoute = "dagen";
        break;
      case "vertrek":
        html = viewDeparture();
        tabRoute = "dagen";
        break;
      case "tickets":
        html = viewTickets();
        break;
      default:
        html = viewNotFound();
    }
    app.innerHTML = html;
    if (seg === "eten" && arg) {
      const target = document.getElementById(`stad-${arg}`);
      if (target) {
        target.scrollIntoView({ block: "start" });
      } else {
        window.scrollTo(0, 0);
      }
    } else {
      window.scrollTo(0, 0);
    }
    updateTabbar(tabRoute);
  }

  function updateTabbar(route) {
    tabbar.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("is-active", t.dataset.route === route);
    });
  }

  // ---------------- boot ----------------
  function boot() {
    fetch("data/trip.json")
      .then((r) => r.json())
      .then((data) => {
        DATA = data;
        window.addEventListener("hashchange", render);
        render();
      })
      .catch((err) => {
        app.innerHTML = `<div class="empty-state">Kon reisdata niet laden.<br>${esc(err.message)}</div>`;
      });
  }

  document.addEventListener("DOMContentLoaded", boot);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
