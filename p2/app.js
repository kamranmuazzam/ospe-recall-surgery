/* =========================================================
   OSPE Recall (Surgery Paper-2) — Offline Active Recall Engine
   ========================================================= */
(function () {
  "use strict";

  const STORAGE_KEY = "ospe_recall_surg_p2_v1";

  const RANKS = [
    { level: 1, xp: 0,    name: "Clinical Clerk" },
    { level: 2, xp: 150,  name: "Ophthal Extern" },
    { level: 3, xp: 400,  name: "ENT House Officer" },
    { level: 4, xp: 800,  name: "Assistant Surgeon" },
    { level: 5, xp: 1400, name: "Eye-ENT Registrar" },
    { level: 6, xp: 2200, name: "DU Honour Roll" },
    { level: 7, xp: 3200, name: "Microsurgery Fellow" },
    { level: 8, xp: 4500, name: "Senior Fellow (FCPS/MS)" },
    { level: 9, xp: 6500, name: "Professor of Eye & ENT" }
  ];

  const BADGES = [
    { id: "first_flip",   ico: "\u26A1", name: "First Recall",          check: (s, d) => d.totalReps >= 1 },
    { id: "ophth_photos", ico: "\uD83D\uDC41\uFE0F", name: "Eye Lesion Hawk", check: (s, d) => d.stationMastery["ST-01"] >= 50 },
    { id: "eye_drops",    ico: "\uD83D\uDCA7", name: "Eye Drops Pro",         check: (s, d) => d.stationMastery["ST-04"] >= 50 },
    { id: "ophth_inst",   ico: "\uD83D\uDD2C", name: "Ophthal Optics Pro",    check: (s, d) => d.stationMastery["ST-02"] >= 50 && d.stationMastery["ST-03"] >= 40 },
    { id: "ent_inst",     ico: "\uD83D\uDD2A", name: "ENT Instrument Pro",    check: (s, d) => d.stationMastery["ST-08"] >= 50 },
    { id: "ent_xray",     ico: "\uD83E\uDE7B", name: "ENT X-Ray Hawk",        check: (s, d) => d.stationMastery["ST-09"] >= 50 },
    { id: "proc_pta",     ico: "\uD83C\uDFAF", name: "PTA & Checklist Ace",   check: (s, d) => d.stationMastery["ST-05"] >= 40 && d.stationMastery["ST-10"] >= 50 },
    { id: "century_reps", ico: "\uD83C\uDFC6", name: "100+ Reps Club",        check: (s, d) => d.totalReps >= 100 }
  ];

  const STATIONS = (window.OSPE_DATA && window.OSPE_DATA.stations) || [];
  const CARDS = (window.OSPE_DATA && window.OSPE_DATA.cards) || [];
  const PYQ_SESSIONS = (window.OSPE_DATA && window.OSPE_DATA.pyqSessions) || [];
  const AUDIOGRAM_LAB = (window.OSPE_DATA && window.OSPE_DATA.audiogramLab) || {};
  const BLITZ_EXTRAS = (window.OSPE_DATA && window.OSPE_DATA.blitzExtras) || [];
  const CARD_MAP = new Map(CARDS.map((c) => [c.id, c]));

  const SURGICAL_HALLS = [
    { level: 1,  minTrophies: 0,    name: "TH 1 · Eye & ENT Clerk",        perk: "Starting Tent · Ward Basics" },
    { level: 2,  minTrophies: 40,   name: "TH 2 · Snellen & Speculum",      perk: "Unlocked 30s Visual Spotter" },
    { level: 3,  minTrophies: 100,  name: "TH 3 · Slit-Lamp Pavilion",      perk: "Unlocked Eye Drops Tier-1" },
    { level: 4,  minTrophies: 180,  name: "TH 4 · Audiology Suite",         perk: "Unlocked Pure-Tone & ABG Drills" },
    { level: 5,  minTrophies: 290,  name: "TH 5 · Boyle-Davis Theatre",     perk: "Unlocked ENT Operative Blitz" },
    { level: 6,  minTrophies: 430,  name: "TH 6 · Cataract SICS Suite",     perk: "Unlocked Microsurgical Knife Drill" },
    { level: 7,  minTrophies: 600,  name: "TH 7 · Mastoid & X-Ray Wing",    perk: "Unlocked Schüller/Water's Views" },
    { level: 8,  minTrophies: 800,  name: "TH 8 · Honour Blitz Chamber",    perk: "Unlocks Professor-Tier Speed" },
    { level: 9,  minTrophies: 1050, name: "TH 9 · MS Eye-ENT Fortress",     perk: "Elite Final Prof Mastery" },
    { level: 10, minTrophies: 1350, name: "TH 10 · Grand Surgical Hall",    perk: "Supreme DU Distinction Title" }
  ];

  function genArenaId() {
    const prefixes = ["Otoscope", "Speculum", "Keratome", "TuningFork", "Fundus", "Cochlea", "Larynx", "Lachrymal", "Mastoid", "Retina"];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const code = Math.floor(1000 + Math.random() * 9000);
    return `${p}-${code}`;
  }

  function getHallForTrophies(trp = 0) {
    let cur = SURGICAL_HALLS[0];
    let next = SURGICAL_HALLS[1] || null;
    for (let i = 0; i < SURGICAL_HALLS.length; i++) {
      if (trp >= SURGICAL_HALLS[i].minTrophies) {
        cur = SURGICAL_HALLS[i];
        next = SURGICAL_HALLS[i + 1] || null;
      }
    }
    return { cur, next };
  }

  function todayKey(offsetDays = 0) {
    const dt = new Date();
    dt.setDate(dt.getDate() + offsetDays);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtText(str) {
    return escapeHtml(str).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  function imgSrc(file) {
    if (!file) return "";
    if (window.OSPE_DATA && window.OSPE_DATA.imageMap && window.OSPE_DATA.imageMap[file]) {
      return window.OSPE_DATA.imageMap[file];
    }
    return "img/" + file;
  }

  // ==================== ANONYMOUS TELEMETRY (OFFLINE-SAFE) ====================
  const STATS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxKdpqCnfGUaolaZR99aAeWablEsbzglNbeRXP5vDaWViKrf0M6KhmhA091dyeRUtYW/exec";
  const APP_VERSION = "2.0.0";
  const TELEMETRY_QUEUE_MAX = 25;
  const sessionLoggedViews = new Set();
  const sessionLoggedStations = new Set();
  const sessionLoggedQuickModes = new Set();
  const sessionLoggedPyqYears = new Set();
  let sessionLoggedTheme = false;
  let sessionCounted = false;

  function genAnonId() {
    return "u_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function getPlatformTag() {
    return /android_asset/i.test(location.href) ? "APK" : "HTML";
  }

  function getCoarseDeviceClass() {
    const w = typeof window !== "undefined" ? window.innerWidth : 1024;
    if (w < 768) return "Mobile";
    if (w <= 1024) return "Tablet";
    return "Desktop";
  }

  function getCoarseOS() {
    const ua = typeof navigator !== "undefined" ? String(navigator.userAgent || "") : "";
    if (/Android/i.test(ua)) return "Android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
    if (/Win/i.test(ua)) return "Windows";
    if (/Mac/i.test(ua)) return "macOS";
    if (/Linux/i.test(ua)) return "Linux";
    return "Other";
  }

  function getCoarseTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return "";
    }
  }

  function cleanDoctorName(raw) {
    let s = String(raw || "").trim().replace(/\s+/g, " ");
    s = s.replace(/^\(?\s*dr\.?\s*\)?\s*/i, "").trim();
    return s.slice(0, 28);
  }

  function getDoctorDisplayTitle(includeFallback = false) {
    const nm = cleanDoctorName(state.userName);
    if (state.drUnlocked) {
      return nm ? `Dr. ${nm}` : (includeFallback ? "Dr." : "");
    }
    if (nm) return `(Dr.) ${nm}`;
    return includeFallback ? "(Dr.) Aspiring Surgeon" : "";
  }

  function countUnlockedBadges(m) {
    let cnt = 0;
    for (let i = 0; i < BADGES.length; i++) {
      if (BADGES[i].check(state, m)) cnt++;
    }
    return cnt;
  }

  function buildSnapshotParams(includeFull = true) {
    const base = {
      uid: state.uid,
      aid: state.arenaId || "",
      nm: getDoctorDisplayTitle(false) || "Anonymous",
      dr: state.drUnlocked ? "1" : "0",
      trp: String((state.blitz && state.blitz.trophies) || 0),
      hall: getHallForTrophies((state.blitz && state.blitz.trophies) || 0).cur.name,
      pf: getPlatformTag(),
      dv: getCoarseDeviceClass(),
      os: getCoarseOS(),
      tz: getCoarseTimezone(),
      th: state.theme || "light",
      mt: state.muted ? "1" : "0",
      v: APP_VERSION
    };
    if (!includeFull) return base;

    const m = computeDashboardMetrics();
    const { cur } = getRankForXP(state.xp);
    let topSt = "";
    let wkSt = "";
    let bestPct = -1;
    let worstPct = 101;
    const stParts = [];
    STATIONS.forEach((s) => {
      const pct = m.stationMastery[s.id] || 0;
      const stStat = m.stationStats[s.id] || { tr: 0, pr: 0, f: 0 };
      stParts.push(`${s.id}:${pct}`);
      if (stStat.tr + stStat.pr + stStat.f > 0) {
        if (pct > bestPct) { bestPct = pct; topSt = s.id; }
        if (pct < worstPct) { worstPct = pct; wkSt = s.id; }
      }
    });

    return Object.assign(base, {
      xp: String(state.xp || 0),
      rk: `Lv${cur.level} ${cur.name}`,
      ov: String(m.overallPct),
      t1: String(m.tier1Pct),
      tr: String(m.tr),
      pr: String(m.pr),
      f: String(m.f),
      rp: String(state.totalReps || 0),
      sk: String(m.streak || 0),
      rfb: String(state.rfBestAcc || 0),
      rfc: String(state.rfCompletedCount || 0),
      bg: String(countUnlockedBadges(m)),
      ad: String(state.activeDaysCount || Object.keys(state.dailyActivity || {}).length || 1),
      sc: String(state.sessionsCount || 1),
      sm: String(Math.floor((state.totalStudySec || 0) / 60)),
      top: topSt,
      wk: wkSt,
      st: stParts.join(",")
    });
  }

  function queueCardDelta(cardId, field) {
    if (!cardId || !field) return;
    if (!state.pendingCardDeltas || typeof state.pendingCardDeltas !== "object") {
      state.pendingCardDeltas = {};
    }
    if (!state.pendingCardDeltas[cardId]) {
      state.pendingCardDeltas[cardId] = { tr: 0, pr: 0, f: 0, rfc: 0, rfm: 0 };
    }
    if (Object.prototype.hasOwnProperty.call(state.pendingCardDeltas[cardId], field)) {
      state.pendingCardDeltas[cardId][field] += 1;
    }
  }

  function encodeCardDeltas(maxItems = 10) {
    const map = state.pendingCardDeltas || {};
    const keys = Object.keys(map);
    if (!keys.length) return "";
    const packed = [];
    let totalChars = 0;
    for (let i = 0; i < keys.length && packed.length < maxItems; i++) {
      const cid = keys[i];
      const d = map[cid];
      if (!d || (d.tr + d.pr + d.f + d.rfc + d.rfm) === 0) {
        delete map[cid];
        continue;
      }
      const c = CARD_MAP.get(cid);
      const st = c ? c.station : "";
      const dx = c ? String(c.diagnosis || "").replace(/[~|]/g, " ").trim().slice(0, 28) : cid;
      const itemStr = `${cid}~${st}~${d.tr}~${d.pr}~${d.f}~${d.rfc}~${d.rfm}~${dx}`;
      if (totalChars + itemStr.length > 900 && packed.length > 0) break;
      packed.push(itemStr);
      totalChars += itemStr.length + 1;
      delete map[cid];
    }
    return packed.join("|");
  }

  function enqueueOrSend(qsStr, onDone) {
    if (!STATS_ENDPOINT || !qsStr) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      if (!Array.isArray(state.telemetryQueue)) state.telemetryQueue = [];
      state.telemetryQueue.push(qsStr);
      while (state.telemetryQueue.length > TELEMETRY_QUEUE_MAX) state.telemetryQueue.shift();
      saveState();
      return;
    }
    fetch(`${STATS_ENDPOINT}?${qsStr}`, {
      method: "GET",
      mode: "no-cors",
      keepalive: true
    }).then(() => {
      if (typeof onDone === "function") onDone();
    }).catch(() => {});
  }

  function sendAnalyticsPing(ev, detail, extraParams = {}, options = {}) {
    try {
      if (!STATS_ENDPOINT) return;
      const includeFull = options.full !== false;
      const snap = buildSnapshotParams(includeFull);
      const payload = Object.assign(snap, {
        ev: ev,
        d: detail || ""
      }, extraParams || {});
      Object.keys(payload).forEach((k) => {
        if (payload[k] === undefined || payload[k] === null || payload[k] === "") {
          if (k !== "d") delete payload[k];
        }
      });
      const qsStr = new URLSearchParams(payload).toString();
      enqueueOrSend(qsStr, options.onDone);
    } catch { /* silent offline fallback */ }
  }

  function flushTelemetryQueue() {
    try {
      if (!STATS_ENDPOINT) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      if (!Array.isArray(state.telemetryQueue) || !state.telemetryQueue.length) return;
      const batch = state.telemetryQueue.splice(0, state.telemetryQueue.length);
      saveState();
      batch.forEach((qsStr, idx) => {
        setTimeout(() => enqueueOrSend(qsStr), idx * 400);
      });
    } catch { /* silent offline fallback */ }
  }

  function flushProgressSnapshot(reason = "sync") {
    try {
      const curMins = Math.floor((state.totalStudySec || 0) / 60);
      const unsyncedReps = Math.max(0, (state.totalReps || 0) - (state.syncedReps || 0));
      const unsyncedMins = Math.max(0, curMins - (state.syncedStudyMins || 0));
      const hasDeltas = Object.keys(state.pendingCardDeltas || {}).length > 0;
      if (!unsyncedReps && unsyncedMins < 1 && !hasDeltas) return;
      if (!STATS_ENDPOINT) return;

      const cd = encodeCardDeltas(10);
      state.syncedReps = state.totalReps || 0;
      state.syncedStudyMins = curMins;
      saveState();

      const extra = { drp: String(unsyncedReps), dsm: String(unsyncedMins) };
      if (cd) extra.cd = cd;
      sendAnalyticsPing("progress", reason, extra, { full: true });
    } catch { /* silent offline fallback */ }
  }

  function startStudyTimer() {
    setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (welcomeModalOpen) return;
      state.totalStudySec = (state.totalStudySec || 0) + 15;
      if (state.totalStudySec % 30 === 0) saveState();
      const curMins = Math.floor(state.totalStudySec / 60);
      if (curMins - (state.syncedStudyMins || 0) >= 5) {
        flushProgressSnapshot("study_tick");
      }
    }, 15000);
  }

  function trackStartupTelemetry() {
    if (!sessionCounted) {
      sessionCounted = true;
      state.sessionsCount = (state.sessionsCount || 0) + 1;
    }
    const who = getDoctorDisplayTitle(false) || "Anonymous";
    if (!state.installSent) {
      state.activeDaysCount = Math.max(1, state.activeDaysCount || 0);
      saveState();
      sendAnalyticsPing("install", who, {}, {
        full: true,
        onDone: () => {
          state.installSent = true;
          state.lastOpenPingDay = todayKey(0);
          saveState();
        }
      });
    } else if (state.lastOpenPingDay !== todayKey(0)) {
      state.activeDaysCount = (state.activeDaysCount || 0) + 1;
      saveState();
      sendAnalyticsPing("open", who, {}, {
        full: true,
        onDone: () => {
          state.lastOpenPingDay = todayKey(0);
          saveState();
        }
      });
    } else {
      saveState();
    }
    flushTelemetryQueue();
  }

  // ==================== STATE ENGINE ====================
  let state = loadState();
  function defaultState() {
    return {
      uid: genAnonId(),
      arenaId: genArenaId(),
      installSent: false,
      lastOpenPingDay: "",
      userName: "",
      drUnlocked: false,
      profileDone: false,
      xp: 0,
      theme: "light",
      muted: false,
      cardHistory: {},
      manualStars: {},
      dailyActivity: {},
      rfBestAcc: 0,
      rfCompletedCount: 0,
      blitz: {
        trophies: 0,
        bestTrophies: 0,
        rounds: 0,
        correct: 0,
        wrong: 0,
        fastHits: 0
      },
      totalReps: 0,
      totalStudySec: 0,
      syncedStudyMins: 0,
      syncedReps: 0,
      sessionsCount: 0,
      activeDaysCount: 0,
      reportedBadges: [],
      pendingCardDeltas: {},
      telemetryQueue: []
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const merged = Object.assign(defaultState(), parsed || {});
      if (!merged.uid) merged.uid = genAnonId();
      if (!merged.arenaId) merged.arenaId = genArenaId();
      if (!merged.blitz || typeof merged.blitz !== "object") merged.blitz = defaultState().blitz;
      if (!Array.isArray(merged.reportedBadges)) merged.reportedBadges = [];
      if (!merged.pendingCardDeltas || typeof merged.pendingCardDeltas !== "object") merged.pendingCardDeltas = {};
      if (!Array.isArray(merged.telemetryQueue)) merged.telemetryQueue = [];
      return merged;
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore quota errors cleanly */ }
  }

  // Strict max count dominance + most-recent rating tie-breaker
  function getCardStats(cardId) {
    const hist = state.cardHistory[cardId] || [];
    const counts = { TR: 0, PR: 0, F: 0 };
    for (let i = 0; i < hist.length; i++) {
      const r = hist[i];
      if (counts[r] !== undefined) counts[r]++;
    }
    const total = counts.TR + counts.PR + counts.F;
    if (total === 0) return { dominant: "NEW", counts, total, hist };

    const maxCount = Math.max(counts.TR, counts.PR, counts.F);
    const tied = ["F", "PR", "TR"].filter((k) => counts[k] === maxCount);
    let dominant = tied[0];
    if (tied.length > 1) {
      for (let i = hist.length - 1; i >= 0; i--) {
        if (tied.includes(hist[i])) {
          dominant = hist[i];
          break;
        }
      }
    }
    return { dominant, counts, total, hist };
  }

  function isStarred(card) {
    if (Object.prototype.hasOwnProperty.call(state.manualStars, card.id)) {
      return !!state.manualStars[card.id];
    }
    return !!card.autoStar;
  }

  function getRankForXP(xp) {
    let cur = RANKS[0];
    let next = RANKS[1] || null;
    for (let i = 0; i < RANKS.length; i++) {
      if (xp >= RANKS[i].xp) {
        cur = RANKS[i];
        next = RANKS[i + 1] || null;
      }
    }
    return { cur, next };
  }

  function computeStreak() {
    let streak = 0;
    const todayDone = (state.dailyActivity[todayKey(0)] || 0) > 0;
    const startOffset = todayDone ? 0 : -1;
    for (let d = startOffset; d >= -120; d--) {
      if ((state.dailyActivity[todayKey(d)] || 0) > 0) streak++;
      else break;
    }
    return streak;
  }

  // ==================== WEBAUDIO CHIMES (OFFLINE) ====================
  let audioCtx = null;
  function playTone(type) {
    if (state.muted) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;
      const playNote = (freq, start, dur, vol = 0.08) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0.001, now + start);
        gain.gain.exponentialRampToValueAtTime(vol, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.02);
      };
      if (type === "tr") { playNote(523.25, 0, 0.12); playNote(659.25, 0.09, 0.18); }
      else if (type === "pr") { playNote(440, 0, 0.14); }
      else if (type === "f") { playNote(260, 0, 0.18, 0.07); }
      else if (type === "bell") { playNote(587.33, 0, 0.25); playNote(880, 0.18, 0.35); }
      else if (type === "rank") { playNote(523.25, 0, 0.12); playNote(659.25, 0.1, 0.12); playNote(783.99, 0.2, 0.14); playNote(1046.5, 0.32, 0.3); }
      else if (type === "celebrate") {
        playNote(523.25, 0, 0.14, 0.09);
        playNote(659.25, 0.11, 0.14, 0.09);
        playNote(783.99, 0.22, 0.15, 0.09);
        playNote(1046.5, 0.34, 0.36, 0.10);
        playNote(1318.51, 0.46, 0.42, 0.09);
      }
    } catch { /* audio blocked/unavailable */ }
  }

  function recordRating(cardId, rating, xpGain) {
    const prevLevel = getRankForXP(state.xp).cur.level;
    if (!state.cardHistory[cardId]) state.cardHistory[cardId] = [];
    state.cardHistory[cardId].push(rating);
    state.xp += xpGain;
    state.totalReps += 1;
    const tk = todayKey(0);
    state.dailyActivity[tk] = (state.dailyActivity[tk] || 0) + 1;
    queueCardDelta(cardId, rating.toLowerCase());

    const m = computeDashboardMetrics();
    BADGES.forEach((b) => {
      if (b.check(state, m) && !state.reportedBadges.includes(b.id)) {
        state.reportedBadges.push(b.id);
        sendAnalyticsPing("badge_unlock", b.id, { m: b.name });
      }
    });
    saveState();

    const newRank = getRankForXP(state.xp).cur;
    updateHeaderXP();
    if (newRank.level > prevLevel) {
      playTone("rank");
      showDialog("RANK PROMOTION!", `Level ${newRank.level}: ${newRank.name}`, `Congratulations! You reached ${state.xp} XP. Keep drilling high-yield DU Surgery Paper-2 OSPE locks.`);
      sendAnalyticsPing("rank_up", `Level ${newRank.level}`, { m: newRank.name });
    }

    if ((state.totalReps - (state.syncedReps || 0)) >= 15) {
      flushProgressSnapshot("reps");
    }
  }

  // ==================== NAVIGATION & HEADER ====================
  let currentView = "dashboard";
  let lastBackPress = 0;

  function navigate(view) {
    currentView = view;
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
    document.querySelectorAll(".nav-btn, .mnav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));

    if (view !== "recall") stopTimer();
    if (view !== "rapidfire") {
      clearInterval(rfState.blitzHandle);
      rfState.blitzHandle = null;
    }

    if (view === "dashboard") renderDashboard();
    else if (view === "recall") { renderRecallCard(); startTimer(true); }
    else if (view === "rapidfire") {
      renderArenaBanner();
      if (!rfState.questions.length) {
        startRapidFire();
      } else if (!rfState.answered && rfState.idx < rfState.questions.length && document.getElementById("rf-blitz-timer").checked && !rfState.blitzHandle) {
        startRapidFireBlitzTick(rfState.questions[rfState.idx]);
      }
      renderSurgicalHalls();
    }
    else if (view === "audiogram") { renderAudiogramLab(); }
    else if (view === "mindmap") { renderMindmap(); }
    else if (view === "directory") { renderDirectory(); }

    if (view !== "dashboard" && !sessionLoggedViews.has(view)) {
      sessionLoggedViews.add(view);
      sendAnalyticsPing("view", view);
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    const isDark = state.theme === "dark";
    document.getElementById("ico-moon").classList.toggle("hidden", isDark);
    document.getElementById("ico-sun").classList.toggle("hidden", !isDark);
  }

  function toggleTheme() {
    state.theme = state.theme === "light" ? "dark" : "light";
    saveState();
    applyTheme();
    if (!sessionLoggedTheme) {
      sessionLoggedTheme = true;
      sendAnalyticsPing("theme", state.theme);
    }
  }

  function applyMuteUI() {
    document.getElementById("ico-sound-on").classList.toggle("hidden", state.muted);
    document.getElementById("ico-sound-off").classList.toggle("hidden", !state.muted);
  }

  function toggleMute() {
    state.muted = !state.muted;
    saveState();
    applyMuteUI();
  }

  function updateHeaderXP() {
    const { cur } = getRankForXP(state.xp);
    document.getElementById("hdr-rank-name").textContent = cur.name;
    document.getElementById("hdr-xp").textContent = `${state.xp} XP`;
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById("toast-bar");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2300);
  }

  // ==================== VIEW 1: DASHBOARD ====================
  function computeDashboardMetrics() {
    let tr = 0, pr = 0, f = 0, unseen = 0;
    let t1Total = 0, t1Done = 0;
    const stationStats = {};
    STATIONS.forEach((s) => {
      stationStats[s.id] = { total: 0, tr: 0, pr: 0, f: 0, unseen: 0 };
    });

    CARDS.forEach((c) => {
      const dom = getCardStats(c.id).dominant;
      const st = stationStats[c.station];
      if (st) st.total++;
      if (dom === "TR") { tr++; if (st) st.tr++; }
      else if (dom === "PR") { pr++; if (st) st.pr++; }
      else if (dom === "F") { f++; if (st) st.f++; }
      else { unseen++; if (st) st.unseen++; }

      if (c.pyqTier === "TIER-1") {
        t1Total++;
        if (dom === "TR") t1Done++;
      }
    });

    const stationMastery = {};
    STATIONS.forEach((s) => {
      const st = stationStats[s.id];
      stationMastery[s.id] = st.total ? Math.round(((st.tr + st.pr * 0.5) / st.total) * 100) : 0;
    });

    const overallPct = CARDS.length ? Math.round(((tr + pr * 0.5) / CARDS.length) * 100) : 0;
    const tier1Pct = t1Total ? Math.round((t1Done / t1Total) * 100) : 0;
    return { tr, pr, f, unseen, t1Total, t1Done, tier1Pct, overallPct, stationStats, stationMastery, streak: computeStreak(), totalReps: state.totalReps };
  }

  function renderDashboard() {
    renderDoctorBar();
    const m = computeDashboardMetrics();
    const { cur, next } = getRankForXP(state.xp);
    updateHeaderXP();

    document.getElementById("dash-rank-title").textContent = `Level ${cur.level} — ${cur.name}`;
    document.getElementById("dash-streak").textContent = String(m.streak);
    document.getElementById("dash-xp-cur").textContent = `${state.xp} XP`;
    if (next) {
      const span = next.xp - cur.xp;
      const pct = Math.min(100, Math.round(((state.xp - cur.xp) / span) * 100));
      document.getElementById("dash-xp-next").textContent = `${next.xp - state.xp} XP to ${next.name}`;
      document.getElementById("dash-xp-bar").style.width = `${pct}%`;
    } else {
      document.getElementById("dash-xp-next").textContent = "Maximum Rank Reached!";
      document.getElementById("dash-xp-bar").style.width = "100%";
    }

    document.getElementById("dash-tier1-pct").textContent = `${m.tier1Pct}%`;
    document.getElementById("dash-tier1-sub").textContent = `Tier-1 Locks Mastered TR (${m.t1Done} / ${m.t1Total})`;
    document.getElementById("dash-overall-pct").textContent = `${m.overallPct}%`;
    const ring = document.getElementById("dash-overall-ring");
    ring.style.strokeDashoffset = String(213.6 - (213.6 * m.overallPct) / 100);

    document.getElementById("stat-tr-cnt").textContent = String(m.tr);
    document.getElementById("stat-pr-cnt").textContent = String(m.pr);
    document.getElementById("stat-f-cnt").textContent = String(m.f);
    document.getElementById("stat-new-cnt").textContent = String(m.unseen);
    document.getElementById("dash-total-reps").textContent = `${state.totalReps} Total Reps`;

    // 28-Day Heatmap
    const hmEl = document.getElementById("dash-heatmap");
    let hmHtml = "";
    for (let i = -27; i <= 0; i++) {
      const k = todayKey(i);
      const cnt = state.dailyActivity[k] || 0;
      const lv = cnt === 0 ? "" : cnt < 5 ? "lv1" : cnt < 15 ? "lv2" : cnt < 30 ? "lv3" : "lv4";
      hmHtml += `<div class="hm-cell ${lv}" title="${k}: ${cnt} reps"></div>`;
    }
    hmEl.innerHTML = hmHtml;

    // Merit Badges
    let unlockedCnt = 0;
    const badgeHtml = BADGES.map((b) => {
      const ok = b.check(state, m);
      if (ok) unlockedCnt++;
      return `<div class="badge-item ${ok ? "unlocked" : ""}"><span class="badge-ico">${b.ico}</span><span class="badge-name">${escapeHtml(b.name)}</span></div>`;
    }).join("");
    document.getElementById("dash-badges").innerHTML = badgeHtml;
    document.getElementById("dash-badge-count").textContent = `${unlockedCnt} / ${BADGES.length}`;

    // 10 Stations Grid
    const gridEl = document.getElementById("dash-stations-grid");
    gridEl.innerHTML = STATIONS.map((s) => {
      const st = m.stationStats[s.id];
      const t = st.total || 1;
      const pTr = (st.tr / t) * 100;
      const pPr = (st.pr / t) * 100;
      const pF  = (st.f / t) * 100;
      return `
        <div class="station-tile card-surface" onclick="OSPE.openStation('${s.id}')">
          <div>
            <div class="st-top">
              <span class="st-code" style="background:${s.color}">${s.code}</span>
              <span class="st-count">${st.total} Cards</span>
            </div>
            <h3 class="st-title">${escapeHtml(s.name)}</h3>
            <p class="st-desc">${escapeHtml(s.desc)}</p>
          </div>
          <div>
            <div class="st-bar">
              <div class="st-seg-tr" style="width:${pTr}%"></div>
              <div class="st-seg-pr" style="width:${pPr}%"></div>
              <div class="st-seg-f" style="width:${pF}%"></div>
            </div>
            <div class="st-foot">
              <span>${m.stationMastery[s.id]}% Readiness</span>
              <span>TR:${st.tr} · PR:${st.pr} · F:${st.f}</span>
            </div>
            <div class="st-card-actions">
              <button class="st-mini-btn" onclick="event.stopPropagation();OSPE.openStationStudy('${s.id}')">Study Topic Notes</button>
              <button class="st-mini-btn accent" onclick="event.stopPropagation();OSPE.startStationBlitz('${s.id}')">&#9889; 30s Blitz</button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function openStation(stationId) {
    if (!sessionLoggedStations.has(stationId)) {
      sessionLoggedStations.add(stationId);
      sendAnalyticsPing("station", stationId);
    }
    document.getElementById("recall-station-select").value = stationId;
    document.getElementById("recall-tier-select").value = "ALL";
    setRecallMode("seq", true);
    applyRecallFilter();
    navigate("recall");
  }

  function startQuickMode(kind) {
    if (!sessionLoggedQuickModes.has(kind)) {
      sessionLoggedQuickModes.add(kind);
      sendAnalyticsPing("quick_mode", kind);
    }
    const stSel = document.getElementById("recall-station-select");
    const trSel = document.getElementById("recall-tier-select");
    stSel.value = "ALL";
    if (kind === "tier1") { trSel.value = "TIER-1"; setRecallMode("seq", true); }
    else if (kind === "weak") { trSel.value = "F"; setRecallMode("rand", true); }
    else if (kind === "pr") { trSel.value = "PR"; setRecallMode("rand", true); }
    else if (kind === "tr") { trSel.value = "TR"; setRecallMode("rand", true); }
    else if (kind === "new") { trSel.value = "NEW"; setRecallMode("seq", true); }
    else if (kind === "mock10") { trSel.value = "ALL"; setRecallMode("mock", true); }
    applyRecallFilter();
    navigate("recall");
  }

  // ==================== VIEW 2: ACTIVE RECALL ====================
  const recallState = {
    deck: [...CARDS],
    index: 0,
    mode: "seq",
    flipped: false,
    secondsLeft: 300,
    timerRunning: false,
    timerHandle: null
  };

  function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function setRecallMode(mode, skipApply = false) {
    recallState.mode = mode;
    document.getElementById("mode-seq").classList.toggle("active", mode === "seq");
    document.getElementById("mode-rand").classList.toggle("active", mode === "rand");
    document.getElementById("mode-mock").classList.toggle("active", mode === "mock");
    if (!skipApply) applyRecallFilter();
  }

  function applyRecallFilter() {
    const st = document.getElementById("recall-station-select").value;
    const prio = document.getElementById("recall-tier-select").value;

    let pool = [];
    if (recallState.mode === "mock") {
      // Pick 1 authentic card from each of the 10 stations (preferring unseen/weak/Tier-1)
      STATIONS.forEach((s) => {
        const candidates = CARDS.filter((c) => c.station === s.id);
        if (candidates.length) {
          const picked = shuffleArray(candidates)[0];
          pool.push(picked);
        }
      });
    } else {
      pool = CARDS.filter((c) => {
        if (st !== "ALL" && c.station !== st) return false;
        if (prio === "TIER-1" && c.pyqTier !== "TIER-1") return false;
        if (prio === "PYQ" && (!c.pyqSessions || c.pyqSessions.length === 0)) return false;
        if (prio === "STAR" && !isStarred(c)) return false;
        const dom = getCardStats(c.id).dominant;
        if (["F", "PR", "TR", "NEW"].includes(prio) && dom !== prio) return false;
        return true;
      });
      if (recallState.mode === "rand") pool = shuffleArray(pool);
    }

    recallState.deck = pool;
    recallState.index = 0;
    recallState.flipped = false;
    renderRecallCard();
    resetTimer();
  }

  function resetRecallFilters() {
    document.getElementById("recall-station-select").value = "ALL";
    document.getElementById("recall-tier-select").value = "ALL";
    setRecallMode("seq");
  }

  function getCurrentCard() {
    return recallState.deck[recallState.index] || null;
  }

  function renderRecallCard() {
    const empty = document.getElementById("recall-empty-state");
    const stage = document.getElementById("recall-card-stage");
    const c = getCurrentCard();

    document.getElementById("recall-counter").textContent = recallState.deck.length
      ? `${recallState.index + 1} / ${recallState.deck.length}`
      : "0 / 0";

    if (!c) {
      empty.classList.remove("hidden");
      stage.classList.add("hidden");
      return;
    }
    empty.classList.add("hidden");
    stage.classList.remove("hidden");

    const inner = document.getElementById("recall-card-inner");
    const stats = getCardStats(c.id);
    inner.classList.remove("dom-new", "dom-tr", "dom-pr", "dom-f");
    inner.classList.add("dom-" + stats.dominant.toLowerCase());
    inner.classList.toggle("flipped", recallState.flipped);

    // Front Meta Badges
    const tierCls = c.pyqTier === "TIER-1" ? "pill-tier1" : c.pyqTier === "TIER-2" ? "pill-tier2" : "";
    const pyqBadges = (c.pyqSessions || []).slice(0, 4).map((p) => `<span class="pill pill-pyq">${escapeHtml(p)}</span>`).join("");
    document.getElementById("front-badges").innerHTML = `
      <span class="pill">${escapeHtml(c.station)}</span>
      <span class="pill ${tierCls}">${escapeHtml(c.pyqTier)}</span>
      ${pyqBadges}
    `;

    // Dominance Badges + Star
    const domLabel = stats.dominant === "NEW" ? "UNSEEN" : `DOMINANT: ${stats.dominant}`;
    ["front-dom-badge", "back-dom-badge"].forEach((id) => {
      const el = document.getElementById(id);
      el.textContent = domLabel;
      el.className = "dom-badge" + (stats.dominant !== "NEW" ? " is-" + stats.dominant.toLowerCase() : "");
    });

    const starred = isStarred(c);
    ["front-star-btn", "back-star-btn"].forEach((id) => {
      document.getElementById(id).classList.toggle("starred", starred);
    });

    // Front Prompt & Questions
    document.getElementById("front-card-img").src = imgSrc(c.frontImage);
    document.getElementById("front-station-title").textContent = `${c.station} · ${c.stationShort}`;
    document.getElementById("front-scenario").textContent = c.scenario;
    document.getElementById("front-questions-list").innerHTML = c.questions.map((q) => `<li>${escapeHtml(q)}</li>`).join("");

    // Back Answer & Visuals
    document.getElementById("back-station-eyebrow").textContent = `${c.station} · ${c.stationShort} · SOLUTION`;
    document.getElementById("back-diagnosis").textContent = c.diagnosis;
    document.getElementById("back-front-thumb").src = imgSrc(c.frontImage);

    const extraBox = document.getElementById("back-annotated-box");
    if (c.backImage) {
      document.getElementById("back-extra-thumb").src = imgSrc(c.backImage);
      extraBox.classList.remove("hidden");
    } else {
      extraBox.classList.add("hidden");
    }

    document.getElementById("back-answers-list").innerHTML = c.answers.map((blk) => `
      <div class="ans-block">
        <div class="ans-block-title">${escapeHtml(blk.q)}</div>
        <ul class="ans-bullets">
          ${blk.bullets.map((b) => `<li>${fmtText(b)}</li>`).join("")}
        </ul>
      </div>
    `).join("");

    document.getElementById("back-pearl-text").innerHTML = fmtText(c.pearl);
    document.getElementById("back-history-counts").textContent = `TR: ${stats.counts.TR} · PR: ${stats.counts.PR} · F: ${stats.counts.F}`;
  }

  function flipCard(forceState) {
    recallState.flipped = typeof forceState === "boolean" ? forceState : !recallState.flipped;
    document.getElementById("recall-card-inner").classList.toggle("flipped", recallState.flipped);
  }

  function nextCard(isSkip = false) {
    if (!recallState.deck.length) return;
    recallState.index = (recallState.index + 1) % recallState.deck.length;
    recallState.flipped = false;
    renderRecallCard();
    resetTimer();
    if (isSkip) showToast("Skipped to next station");
  }

  function prevCard() {
    if (!recallState.deck.length) return;
    recallState.index = (recallState.index - 1 + recallState.deck.length) % recallState.deck.length;
    recallState.flipped = false;
    renderRecallCard();
    resetTimer();
  }

  function rateCurrentCard(rating) {
    const c = getCurrentCard();
    if (!c) return;
    const xpMap = { F: 10, PR: 20, TR: 35 };
    playTone(rating.toLowerCase());
    recordRating(c.id, rating, xpMap[rating] || 10);
    renderRecallCard();
    setTimeout(() => nextCard(false), 320);
  }

  function toggleCurrentStar(e) {
    if (e) e.stopPropagation();
    const c = getCurrentCard();
    if (!c) return;
    state.manualStars[c.id] = !isStarred(c);
    saveState();
    renderRecallCard();
  }

  // ==================== 5:00 STATION TIMER ====================
  function updateTimerUI() {
    const mins = Math.floor(recallState.secondsLeft / 60);
    const secs = recallState.secondsLeft % 60;
    document.getElementById("recall-timer-text").textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    const fg = document.getElementById("recall-timer-circle");
    const pct = recallState.secondsLeft / 300;
    fg.style.strokeDashoffset = String(113.1 * (1 - pct));
    fg.style.stroke = recallState.secondsLeft <= 30 ? "var(--f-color)" : recallState.secondsLeft <= 90 ? "var(--pr-color)" : "var(--accent)";
  }

  function startTimer(resetFirst = false) {
    stopTimer();
    if (resetFirst) recallState.secondsLeft = 300;
    recallState.timerRunning = true;
    document.getElementById("btn-timer-toggle").textContent = "Pause";
    updateTimerUI();
    recallState.timerHandle = setInterval(() => {
      if (!recallState.timerRunning) return;
      if (recallState.secondsLeft > 0) {
        recallState.secondsLeft--;
        updateTimerUI();
        if (recallState.secondsLeft === 0) {
          stopTimer();
          playTone("bell");
          if (!recallState.flipped) {
            flipCard(true);
            showToast("05:00 OSPE Time Up — Answer Revealed!");
          }
        }
      }
    }, 1000);
  }

  function stopTimer() {
    recallState.timerRunning = false;
    clearInterval(recallState.timerHandle);
    recallState.timerHandle = null;
  }

  function toggleTimer() {
    if (recallState.timerRunning) {
      stopTimer();
      document.getElementById("btn-timer-toggle").textContent = "Resume";
    } else {
      startTimer(false);
    }
  }

  function resetTimer() {
    startTimer(true);
  }

  // ==================== VIEW 3: 30s BLITZ ARENA, HALLS & LEADERBOARD ====================
  const rfState = {
    questions: [],
    idx: 0,
    score: 0,
    streak: 0,
    xpEarned: 0,
    roundTrophies: 0,
    fastCount: 0,
    answered: false,
    missedCardIds: [],
    blitzSeconds: 30,
    blitzHandle: null,
    qStartMs: 0,
    arenaTab: "exam",
    leaderboardRows: null,
    leaderboardSource: ""
  };

  function getArenaAccuracyPct() {
    const b = state.blitz || {};
    const tot = (b.correct || 0) + (b.wrong || 0);
    return tot ? Math.round(((b.correct || 0) / tot) * 100) : (state.rfBestAcc || 0);
  }

  function renderArenaBanner() {
    if (!state.arenaId) { state.arenaId = genArenaId(); saveState(); }
    if (!state.blitz) state.blitz = defaultState().blitz;
    const trp = state.blitz.trophies || 0;
    const { cur, next } = getHallForTrophies(trp);
    const idEl = document.getElementById("arena-id-badge");
    const hallEl = document.getElementById("arena-hall-badge");
    const trpEl = document.getElementById("arena-trophies-val");
    const accEl = document.getElementById("arena-acc-val");
    const rndEl = document.getElementById("arena-rounds-val");
    const poolEl = document.getElementById("arena-pool-pill");
    if (idEl) idEl.textContent = state.arenaId;
    if (hallEl) hallEl.textContent = next ? `${cur.name} · Next: ${next.minTrophies}` : `${cur.name} · MAX`;
    if (trpEl) trpEl.textContent = String(trp);
    if (accEl) accEl.textContent = `${getArenaAccuracyPct()}%`;
    if (rndEl) rndEl.textContent = String(state.blitz.rounds || 0);
    if (poolEl) {
      const cardQCount = CARDS.reduce((sum, c) => sum + ((c.rapidFire || []).length), 0);
      poolEl.textContent = `Blitz Pool: ${cardQCount + BLITZ_EXTRAS.length} MCQs`;
    }
  }

  function setArenaTab(tab) {
    rfState.arenaTab = tab;
    const tExam = document.getElementById("arena-tab-exam");
    const tHalls = document.getElementById("arena-tab-halls");
    const tBoard = document.getElementById("arena-tab-board");
    if (tExam) tExam.classList.toggle("active", tab === "exam");
    if (tHalls) tHalls.classList.toggle("active", tab === "halls");
    if (tBoard) tBoard.classList.toggle("active", tab === "board");

    const pExam = document.getElementById("blitz-exam-panel");
    const pHalls = document.getElementById("blitz-halls-panel");
    const pBoard = document.getElementById("blitz-leaderboard-panel");
    if (pExam) pExam.classList.toggle("hidden", tab !== "exam");
    if (pHalls) pHalls.classList.toggle("hidden", tab !== "halls");
    if (pBoard) pBoard.classList.toggle("hidden", tab !== "board");

    if (tab !== "exam") {
      clearInterval(rfState.blitzHandle);
      rfState.blitzHandle = null;
    } else if (!rfState.answered && rfState.idx < rfState.questions.length && document.getElementById("rf-blitz-timer").checked && !rfState.blitzHandle) {
      startRapidFireBlitzTick(rfState.questions[rfState.idx]);
    }
    if (tab === "halls") renderSurgicalHalls();
    if (tab === "board") refreshLeaderboard(false);
  }

  function startStationBlitz(stationId) {
    const sel = document.getElementById("rf-station-select");
    const foc = document.getElementById("rf-focus-select");
    if (sel) sel.value = stationId;
    if (foc) foc.value = "ALL";
    setArenaTab("exam");
    navigate("rapidfire");
    startRapidFire();
  }

  function renderSurgicalHalls() {
    const trp = (state.blitz && state.blitz.trophies) || 0;
    const { cur, next } = getHallForTrophies(trp);
    const sumEl = document.getElementById("halls-progress-summary");
    const barEl = document.getElementById("halls-progress-bar");
    const gridEl = document.getElementById("blitz-halls-grid");
    if (sumEl) {
      sumEl.textContent = next
        ? `${trp} Trophies · Current: ${cur.name} (${next.minTrophies - trp} more to ${next.name})`
        : `${trp} Trophies · ALL 10 SURGICAL HALLS UNLOCKED!`;
    }
    if (barEl) {
      const topTarget = SURGICAL_HALLS[SURGICAL_HALLS.length - 1].minTrophies;
      const pct = Math.min(100, Math.round((trp / topTarget) * 100));
      barEl.style.width = `${pct}%`;
    }
    if (gridEl) {
      gridEl.innerHTML = SURGICAL_HALLS.map((h) => {
        const unlocked = trp >= h.minTrophies;
        const isCurrent = cur.level === h.level;
        return `
          <div class="hall-card card-surface ${unlocked ? "unlocked" : ""} ${isCurrent ? "current" : ""}">
            <div class="hall-top">
              <span class="pill ${unlocked ? "pill-tier1" : ""}">Hall ${h.level}</span>
              <span class="small muted">${h.minTrophies} &#127942;</span>
            </div>
            <div class="hall-title">${escapeHtml(h.name)}</div>
            <div class="hall-perk">${escapeHtml(h.perk)}</div>
            <div class="small" style="margin-top:6px;font-weight:700;color:${unlocked ? "var(--primary)" : "var(--text-muted)"}">
              ${isCurrent ? "ACTIVE HALL" : unlocked ? "UNLOCKED" : `LOCKED (Need ${h.minTrophies - trp} more)`}
            </div>
          </div>
        `;
      }).join("");
    }
  }

  function buildSoloFallbackLeaderboard() {
    const youTrp = (state.blitz && state.blitz.trophies) || 0;
    const youAcc = getArenaAccuracyPct();
    const { cur } = getHallForTrophies(youTrp);
    const rivals = [
      { aid: "Keratome-8841", hall: "TH 9 · MS Eye-ENT Fortress", trp: 1120, acc: 92, rounds: 19 },
      { aid: "Otoscope-4419", hall: "TH 8 · Honour Blitz Chamber", trp: 860, acc: 89, rounds: 15 },
      { aid: "Cochlea-3172",  hall: "TH 7 · Mastoid & X-Ray Wing", trp: 645, acc: 84, rounds: 11 },
      { aid: "Fundus-5028",   hall: "TH 5 · Boyle-Davis Theatre", trp: 340, acc: 79, rounds: 7 },
      { aid: "Speculum-1904", hall: "TH 3 · Slit-Lamp Pavilion", trp: 135, acc: 74, rounds: 4 },
      { aid: "Lachrymal-6207", hall: "TH 2 · Snellen & Speculum", trp: 55, acc: 68, rounds: 2 }
    ];
    const all = rivals.concat([{
      aid: state.arenaId || "Otoscope-1000",
      hall: cur.name,
      trp: youTrp,
      acc: youAcc,
      rounds: (state.blitz && state.blitz.rounds) || 0,
      isYou: true
    }]);
    all.sort((a, b) => (b.trp - a.trp) || (b.acc - a.acc));
    return all;
  }

  function renderLeaderboardRows(rows, statusMsg) {
    const statusEl = document.getElementById("lb-status-text");
    const tbody = document.getElementById("lb-tbody");
    if (statusEl) statusEl.textContent = statusMsg;
    if (!tbody) return;
    tbody.innerHTML = rows.map((r, idx) => {
      const isYou = r.isYou || (r.aid && r.aid === state.arenaId);
      const isRival = !isYou && !!r.isBench;
      const medal = idx === 0 ? "&#129351; #1" : idx === 1 ? "&#129352; #2" : idx === 2 ? "&#129353; #3" : `#${idx + 1}`;
      return `
        <tr class="lb-row ${isYou ? "is-you" : ""}">
          <td><strong>${medal}</strong></td>
          <td><code>${escapeHtml(r.aid || "Anon")}</code>${isYou ? ' <span class="lb-you-tag">YOU</span>' : (isRival ? ' <span class="muted small">(League Rival)</span>' : "")}</td>
          <td>${escapeHtml(r.hall || getHallForTrophies(Number(r.trp) || 0).cur.name)}</td>
          <td><strong>${Number(r.trp) || 0} &#127942;</strong></td>
          <td>${Number(r.acc) || 0}%</td>
          <td>${Number(r.rounds) || 0}</td>
        </tr>
      `;
    }).join("");
  }

  function loadLeaderboardJson(baseUrl, onSuccess, onFail) {
    const handlePayload = (data) => {
      const list = Array.isArray(data && data.entries) ? data.entries : (Array.isArray(data && data.rows) ? data.rows : null);
      if (list) {
        onSuccess(list);
        return true;
      }
      return false;
    };

    const jsonpFallback = () => {
      if (typeof document === "undefined") { onFail(); return; }
      const cbName = "__ospeLbP2Cb_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
      let settled = false;
      const script = document.createElement("script");
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
        onFail();
      }, 10000);
      window[cbName] = (data) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
        if (!handlePayload(data)) onFail();
      };
      script.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
        onFail();
      };
      script.src = `${baseUrl}&callback=${encodeURIComponent(cbName)}`;
      document.head.appendChild(script);
    };

    fetch(baseUrl, { method: "GET", cache: "no-store" })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("http")))
      .then((data) => {
        if (!handlePayload(data)) jsonpFallback();
      })
      .catch(() => {
        jsonpFallback();
      });
  }

  function refreshLeaderboard(forceToast = false) {
    const statusEl = document.getElementById("lb-status-text");
    const localRows = buildSoloFallbackLeaderboard().map((x) => Object.assign({ isBench: !x.isYou }, x));
    renderLeaderboardRows(localRows, "Syncing live DU Arena rankings...");
    if (!STATS_ENDPOINT || (typeof navigator !== "undefined" && !navigator.onLine)) {
      if (statusEl) statusEl.textContent = `Offline Solo Arena · Your ID: ${state.arenaId} (${(state.blitz && state.blitz.trophies) || 0} Trophies)`;
      return;
    }
    const youTrp = (state.blitz && state.blitz.trophies) || 0;
    const youHall = getHallForTrophies(youTrp).cur.name;
    const qs = new URLSearchParams({
      action: "leaderboard",
      limit: "50",
      uid: state.uid || "",
      aid: state.arenaId || genArenaId(),
      nm: getDoctorDisplayTitle(false) || "Anonymous",
      trp: String(youTrp),
      hall: youHall,
      acc: String(getArenaAccuracyPct()),
      rnd: String((state.blitz && state.blitz.rounds) || 0),
      pf: getPlatformTag(),
      _: String(Date.now())
    });
    const url = `${STATS_ENDPOINT}?${qs.toString()}`;
    loadLeaderboardJson(
      url,
      (list) => {
        const merged = list.map((x) => ({
          aid: x.aid || x.arenaId || "Surg-Anon",
          hall: x.hall || getHallForTrophies(Number(x.trp || x.trophies) || 0).cur.name,
          trp: Number(x.trp !== undefined ? x.trp : x.trophies) || 0,
          acc: Number(x.acc !== undefined ? x.acc : x.bestAcc) || 0,
          rounds: Number(x.rounds) || 0,
          isYou: (x.aid || x.arenaId) === state.arenaId
        }));
        if (!merged.some((x) => x.isYou)) {
          merged.push({
            aid: state.arenaId,
            hall: youHall,
            trp: youTrp,
            acc: getArenaAccuracyPct(),
            rounds: (state.blitz && state.blitz.rounds) || 0,
            isYou: true
          });
        }
        const otherReal = merged.filter((x) => !x.isYou);
        if (otherReal.length === 0) {
          const withBench = merged.concat(localRows.filter((b) => !b.isYou));
          withBench.sort((a, b) => (b.trp - a.trp) || (b.acc - a.acc));
          renderLeaderboardRows(withBench, `Live Board Synced (${state.arenaId}) · Solo Benchmark Mode until other classmates play`);
        } else {
          merged.sort((a, b) => (b.trp - a.trp) || (b.acc - a.acc));
          renderLeaderboardRows(merged, `Live Global Leaderboard · ${merged.length} Real Competitors Synced · Your ID: ${state.arenaId}`);
        }
        if (forceToast) showToast("Leaderboard synced!");
      },
      () => {
        renderLeaderboardRows(localRows, `Solo & Local Benchmark Standings (Update P2 Web App deployment or check connection) · Your ID: ${state.arenaId}`);
      }
    );
  }

  function startRapidFire() {
    clearInterval(rfState.blitzHandle);
    const st = document.getElementById("rf-station-select").value;
    const focusEl = document.getElementById("rf-focus-select");
    const focus = focusEl ? focusEl.value : "ALL";
    const countVal = document.getElementById("rf-count-select").value;

    const pool = [];
    const seenPrompt = new Set();

    CARDS.forEach((c) => {
      if (st !== "ALL" && c.station !== st) return;
      if (focus === "HIGH_YIELD" && c.pyqTier !== "TIER-1" && c.pyqTier !== "TIER-2") return;
      if (focus === "INST_PIC" && !["ST-02", "ST-03", "ST-07", "ST-08"].includes(c.station)) return;
      if (focus === "AUDIO" && c.station !== "ST-10" && !/audiogram|tymp|rinne|weber/i.test(c.diagnosis || "")) return;
      (c.rapidFire || []).forEach((q) => {
        const key = (q.prompt || "").slice(0, 75);
        if (seenPrompt.has(key)) return;
        seenPrompt.add(key);
        pool.push({ card: c, q, customImage: "" });
      });
    });

    BLITZ_EXTRAS.forEach((ex) => {
      const c = CARD_MAP.get(ex.cardId);
      if (!c) return;
      const effStation = ex.station || c.station;
      if (st !== "ALL" && effStation !== st) return;
      if (focus === "HIGH_YIELD" && c.pyqTier !== "TIER-1" && c.pyqTier !== "TIER-2") return;
      if (focus === "INST_PIC" && !String(ex.image || "").startsWith("inst_") && !["ST-02", "ST-03", "ST-07", "ST-08"].includes(effStation)) return;
      if (focus === "AUDIO" && effStation !== "ST-10" && !String(ex.image || "").startsWith("ag_")) return;
      const key = (ex.prompt || "").slice(0, 75);
      if (seenPrompt.has(key)) return;
      seenPrompt.add(key);
      pool.push({
        card: c,
        customImage: ex.image || "",
        q: {
          prompt: ex.prompt,
          options: ex.options,
          correctIndex: ex.correctIndex,
          explanation: ex.explanation
        }
      });
    });

    const shuffled = shuffleArray(pool);
    const limit = countVal === "ALL" ? shuffled.length : Math.min(shuffled.length, parseInt(countVal, 10) || 20);
    rfState.questions = shuffled.slice(0, limit);
    rfState.idx = 0;
    rfState.score = 0;
    rfState.streak = 0;
    rfState.xpEarned = 0;
    rfState.roundTrophies = 0;
    rfState.fastCount = 0;
    rfState.missedCardIds = [];

    document.getElementById("rf-summary-card").classList.add("hidden");
    document.getElementById("rf-arena-card").classList.remove("hidden");
    renderArenaBanner();
    renderRapidFireQuestion();
  }

  function startRapidFireBlitzTick(item) {
    clearInterval(rfState.blitzHandle);
    const timerPill = document.getElementById("rf-timer-pill");
    rfState.blitzHandle = setInterval(() => {
      rfState.blitzSeconds--;
      timerPill.textContent = `${rfState.blitzSeconds}s`;
      if (rfState.blitzSeconds <= 0) {
        clearInterval(rfState.blitzHandle);
        rfState.blitzHandle = null;
        if (!rfState.answered) selectRapidFireOption(null, false, item, true);
      }
    }, 1000);
  }

  function renderRapidFireQuestion() {
    clearInterval(rfState.blitzHandle);
    rfState.blitzHandle = null;
    if (rfState.idx >= rfState.questions.length) {
      finishRapidFire();
      return;
    }

    const item = rfState.questions[rfState.idx];
    const c = item.card;
    const q = item.q;
    rfState.answered = false;
    rfState.qStartMs = Date.now();

    const stimImg = item.customImage || c.frontImage;
    document.getElementById("rf-progress-pill").textContent = `Q ${rfState.idx + 1} / ${rfState.questions.length}`;
    document.getElementById("rf-score-pill").textContent = `Score: ${rfState.score} · +${rfState.roundTrophies} 🏆`;
    document.getElementById("rf-img").src = imgSrc(stimImg);
    document.getElementById("rf-card-station").textContent = `${c.station} · ${c.pyqTier}${item.customImage ? " · SPOTTER" : ""}`;
    document.getElementById("rf-card-hint").textContent = (c.pyqSessions || []).slice(0, 2).join(", ");
    document.getElementById("rf-question-text").textContent = q.prompt;
    document.getElementById("rf-feedback-box").classList.add("hidden");
    document.getElementById("rf-next-btn").classList.add("hidden");
    document.getElementById("rf-skip-btn").classList.remove("hidden");

    const indexedOpts = q.options.map((text, origIdx) => ({ text, isCorrect: origIdx === q.correctIndex }));
    const displayOpts = shuffleArray(indexedOpts);

    const optContainer = document.getElementById("rf-options-list");
    optContainer.innerHTML = "";
    displayOpts.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "rf-opt-btn";
      btn.dataset.correct = opt.isCorrect ? "1" : "0";
      btn.textContent = `${String.fromCharCode(65 + i)}. ${opt.text}`;
      btn.onclick = () => selectRapidFireOption(btn, opt.isCorrect, item);
      optContainer.appendChild(btn);
    });

    const useBlitz = document.getElementById("rf-blitz-timer").checked;
    const timerPill = document.getElementById("rf-timer-pill");
    if (useBlitz) {
      rfState.blitzSeconds = 30;
      timerPill.classList.remove("hidden");
      timerPill.textContent = "30s";
      startRapidFireBlitzTick(item);
    } else {
      timerPill.classList.add("hidden");
    }
  }

  function selectRapidFireOption(clickedBtn, isCorrect, item, timedOut = false) {
    if (rfState.answered) return;
    rfState.answered = true;
    clearInterval(rfState.blitzHandle);

    const elapsedSec = Math.max(1, Math.round((Date.now() - (rfState.qStartMs || Date.now())) / 1000));
    if (!state.blitz) state.blitz = defaultState().blitz;

    const allBtns = document.querySelectorAll("#rf-options-list .rf-opt-btn");
    allBtns.forEach((b) => {
      b.disabled = true;
      if (b.dataset.correct === "1") b.classList.add("is-correct");
    });

    const fb = document.getElementById("rf-feedback-box");
    fb.classList.remove("hidden", "fb-ok", "fb-err");

    if (isCorrect) {
      const fastHit = elapsedSec <= 12;
      const trpGain = fastHit ? 15 : 12;
      rfState.score += 1;
      rfState.streak += 1;
      rfState.xpEarned += 25;
      rfState.roundTrophies += trpGain;
      if (fastHit) { rfState.fastCount++; state.blitz.fastHits = (state.blitz.fastHits || 0) + 1; }
      state.blitz.correct = (state.blitz.correct || 0) + 1;
      state.blitz.trophies = Math.max(0, (state.blitz.trophies || 0) + trpGain);
      if (state.blitz.trophies > (state.blitz.bestTrophies || 0)) state.blitz.bestTrophies = state.blitz.trophies;
      playTone("tr");
      queueCardDelta(item.card.id, "rfc");
      recordRating(item.card.id, "TR", 25);
      fb.classList.add("fb-ok");
      fb.innerHTML = `<strong>Correct! (+${trpGain} 🏆${fastHit ? " Speed Bonus!" : ""} · +25 XP) · ${escapeHtml(item.card.diagnosis)}</strong><br/>${escapeHtml(item.q.explanation)}`;
    } else {
      if (clickedBtn) clickedBtn.classList.add("is-wrong");
      rfState.streak = 0;
      rfState.xpEarned += 5;
      rfState.roundTrophies = Math.max(0, rfState.roundTrophies - 5);
      state.blitz.wrong = (state.blitz.wrong || 0) + 1;
      state.blitz.trophies = Math.max(0, (state.blitz.trophies || 0) - 5);
      if (!rfState.missedCardIds.includes(item.card.id)) rfState.missedCardIds.push(item.card.id);
      playTone("f");
      queueCardDelta(item.card.id, "rfm");
      recordRating(item.card.id, "F", 5);
      fb.classList.add("fb-err");
      fb.innerHTML = `<strong>${timedOut ? "Time's Up!" : "Incorrect!"} (−5 🏆 · Auto-rated F) · ${escapeHtml(item.card.diagnosis)}</strong><br/>${escapeHtml(item.q.explanation)}`;
    }

    saveState();
    renderArenaBanner();
    document.getElementById("rf-score-pill").textContent = `Score: ${rfState.score} · +${rfState.roundTrophies} 🏆`;
    document.getElementById("rf-skip-btn").classList.add("hidden");
    document.getElementById("rf-next-btn").classList.remove("hidden");

    const answeredNow = rfState.score + (rfState.missedCardIds ? 0 : 0) + (rfState.idx + 1 - rfState.score);
    if (answeredNow === 1 || answeredNow % 2 === 0) {
      const trpNow = (state.blitz && state.blitz.trophies) || 0;
      const hallNow = getHallForTrophies(trpNow).cur;
      sendAnalyticsPing("blitz_sync", "mid", {
        aid: state.arenaId,
        trp: String(trpNow),
        hall: hallNow.name,
        acc: String(getArenaAccuracyPct()),
        rnd: String((state.blitz && state.blitz.rounds) || 0),
        v1: String(getArenaAccuracyPct())
      });
    }
  }

  function skipRapidFire() {
    clearInterval(rfState.blitzHandle);
    rfState.idx++;
    renderRapidFireQuestion();
  }

  function nextRapidFire() {
    rfState.idx++;
    renderRapidFireQuestion();
  }

  function finishRapidFire() {
    clearInterval(rfState.blitzHandle);
    document.getElementById("rf-arena-card").classList.add("hidden");
    const sum = document.getElementById("rf-summary-card");
    sum.classList.remove("hidden");

    if (!state.blitz) state.blitz = defaultState().blitz;
    const prevHall = getHallForTrophies(Math.max(0, (state.blitz.trophies || 0) - rfState.roundTrophies)).cur;

    const total = rfState.questions.length || 1;
    const acc = Math.round((rfState.score / total) * 100);
    if (acc > state.rfBestAcc) state.rfBestAcc = acc;
    state.rfCompletedCount = (state.rfCompletedCount || 0) + 1;
    state.blitz.rounds = (state.blitz.rounds || 0) + 1;

    let accBonus = 0;
    if (acc >= 80 && total >= 5) {
      accBonus = 15;
      rfState.roundTrophies += accBonus;
      state.blitz.trophies = (state.blitz.trophies || 0) + accBonus;
    }
    if (state.blitz.trophies > (state.blitz.bestTrophies || 0)) state.blitz.bestTrophies = state.blitz.trophies;
    const newHall = getHallForTrophies(state.blitz.trophies).cur;
    saveState();
    renderArenaBanner();

    document.getElementById("rf-sum-title").textContent = acc >= 80 ? "Distinctive Blitz Mastery!" : acc >= 50 ? "Solid Ward Recall" : "Keep Drilling Weak Stations";
    document.getElementById("rf-sum-acc").textContent = `${acc}%`;
    document.getElementById("rf-sum-correct").textContent = `${rfState.score} / ${rfState.questions.length}`;
    document.getElementById("rf-sum-xp").textContent = `+${rfState.xpEarned} XP`;

    const trpMsgEl = document.getElementById("rf-sum-trophy-msg");
    if (trpMsgEl) {
      let msg = `Round Trophies: +${rfState.roundTrophies} 🏆${accBonus ? " (Includes +15 Precision Bonus!)" : ""} · Fast Hits (<=12s): ${rfState.fastCount}`;
      if (newHall.level > prevHall.level) {
        msg += ` · NEW SURGICAL HALL UNLOCKED: ${newHall.name}!`;
        launchConfetti();
      }
      trpMsgEl.textContent = msg;
    }

    const reviewBtn = document.getElementById("rf-review-missed-btn");
    reviewBtn.classList.toggle("hidden", rfState.missedCardIds.length === 0);

    const stSel = document.getElementById("rf-station-select");
    const stFilter = stSel ? stSel.value : "ALL";
    const blitzChk = document.getElementById("rf-blitz-timer");
    const blitzOn = blitzChk && blitzChk.checked ? "blitz" : "untimed";
    const cd = STATS_ENDPOINT ? encodeCardDeltas(10) : "";
    const extra = {
      v1: String(acc),
      v2: `${rfState.score}/${rfState.questions.length}`,
      m: blitzOn,
      aid: state.arenaId,
      trp: String(state.blitz.trophies || 0),
      hall: newHall.name
    };
    if (cd) extra.cd = cd;
    sendAnalyticsPing("blitz_score", stFilter, extra, { full: true });
  }

  function reviewRapidFireMissed() {
    if (!rfState.missedCardIds.length) return;
    recallState.deck = rfState.missedCardIds.map((id) => CARD_MAP.get(id)).filter(Boolean);
    recallState.index = 0;
    recallState.flipped = false;
    navigate("recall");
  }

  function openLightboxForRapidFire() {
    const item = rfState.questions[rfState.idx];
    if (!item) return;
    if (item.customImage) {
      openLightbox(item.card.id, "front", item.customImage, `${item.card.station} · Visual Blitz Prompt`);
    } else {
      openLightbox(item.card.id, "front");
    }
  }

  // ==================== VIEW 3B: AUDIOGRAM MASTERCLASS LAB ====================
  const agState = {
    tab: "rules",
    acOffset: 45,
    bcOffset: 10,
    notch: "none",
    showAbg: true,
    demoIdx: 0,
    demoAnswers: {},
    demoShowHint: false
  };

  function computePTA(arr) {
    // Average speech frequencies: index 1 (500Hz), 2 (1000Hz), 3 (2000Hz)
    return Math.round(((arr[1] + arr[2] + arr[3]) / 3) * 10) / 10;
  }

  function classifyWhoGrade(pta) {
    if (pta <= 25) return "Normal (<=25 dB)";
    if (pta <= 40) return "Mild (26–40 dB)";
    if (pta <= 60) return "Moderate (41–60 dB)";
    if (pta <= 80) return "Severe (61–80 dB)";
    return "Profound (>=81 dB)";
  }

  function renderAudiogramSvg({ acR, bcR, acL, bcL, showAbg = true, focusEar = "R" }) {
    const freqs = [250, 500, 1000, 2000, 4000, 8000];
    const W = 520, H = 310;
    const padL = 46, padR = 24, padT = 24, padB = 34;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const xAt = (i) => padL + (i / (freqs.length - 1)) * plotW;
    const yAt = (db) => padT + ((Math.max(-10, Math.min(110, db)) + 10) / 120) * plotH;

    let grid = "";
    for (let db = -10; db <= 110; db += 20) {
      const y = yAt(db);
      grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(148,163,184,0.35)" stroke-width="1"/>`;
      grid += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="currentColor" opacity="0.72">${db}</text>`;
    }
    const y25 = yAt(25);
    grid += `<line x1="${padL}" y1="${y25}" x2="${W - padR}" y2="${y25}" stroke="#10b981" stroke-width="1.6" stroke-dasharray="5,4"/>`;
    grid += `<text x="${W - padR - 4}" y="${y25 - 4}" text-anchor="end" font-size="9" font-weight="700" fill="#10b981">Normal Ceiling (25 dB)</text>`;

    freqs.forEach((f, i) => {
      const x = xAt(i);
      grid += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="rgba(148,163,184,0.3)" stroke-width="1"/>`;
      grid += `<text x="${x}" y="${H - 12}" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">${f >= 1000 ? (f / 1000) + "k" : f}Hz</text>`;
    });

    let abgPoly = "";
    const targetAc = focusEar === "L" && acL ? acL : acR;
    const targetBc = focusEar === "L" && bcL ? bcL : bcR;
    if (showAbg && targetAc && targetBc) {
      const acPta = computePTA(targetAc);
      const bcPta = computePTA(targetBc);
      if (acPta - bcPta > 10) {
        const topPts = targetBc.map((d, i) => `${xAt(i)},${yAt(d)}`);
        const botPts = [...targetAc].reverse().map((d, ri) => `${xAt(targetAc.length - 1 - ri)},${yAt(d)}`);
        abgPoly = `<polygon points="${topPts.concat(botPts).join(" ")}" fill="rgba(245,158,11,0.18)" stroke="none"/>`;
      }
    }

    const drawLine = (pts, color, dash = "") => {
      if (!pts || !pts.length) return "";
      const d = pts.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
      return `<polyline fill="none" stroke="${color}" stroke-width="2.2" ${dash ? `stroke-dasharray="${dash}"` : ""} points="${d}"/>`;
    };

    const markers = [];
    if (acL) {
      markers.push(drawLine(acL, "#2563eb", "5,3"));
      acL.forEach((v, i) => {
        const x = xAt(i), y = yAt(v);
        markers.push(`<path d="M${x-5},${y-5} L${x+5},${y+5} M${x+5},${y-5} L${x-5},${y+5}" stroke="#2563eb" stroke-width="2.2"/>`);
      });
    }
    if (bcL) {
      markers.push(drawLine(bcL, "#1d4ed8", "2,4"));
      bcL.forEach((v, i) => {
        const x = xAt(i) + 6, y = yAt(v);
        markers.push(`<path d="M${x-3},${y-6} L${x+4},${y} L${x-3},${y+6}" fill="none" stroke="#1d4ed8" stroke-width="2.2"/>`);
      });
    }
    if (acR) {
      markers.push(drawLine(acR, "#ef4444", ""));
      acR.forEach((v, i) => {
        markers.push(`<circle cx="${xAt(i)}" cy="${yAt(v)}" r="5" fill="#fff" stroke="#ef4444" stroke-width="2.4"/>`);
      });
    }
    if (bcR) {
      markers.push(drawLine(bcR, "#dc2626", "3,3"));
      bcR.forEach((v, i) => {
        const x = xAt(i) - 6, y = yAt(v);
        markers.push(`<path d="M${x+3},${y-6} L${x-4},${y} L${x+3},${y+6}" fill="none" stroke="#dc2626" stroke-width="2.2"/>`);
      });
    }

    return `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;font-family:inherit;">
        <rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" rx="4" fill="rgba(248,250,252,0.03)" stroke="rgba(148,163,184,0.45)"/>
        ${abgPoly}
        ${grid}
        ${markers.join("")}
        <text x="14" y="${padT + plotH / 2}" transform="rotate(-90 14 ${padT + plotH / 2})" text-anchor="middle" font-size="10.5" font-weight="700" fill="currentColor" opacity="0.75">Hearing Level (dB HL)</text>
      </svg>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;font-size:0.78rem;font-weight:700;">
        <span style="color:#ef4444;">&#9675; Right AC (O)</span>
        <span style="color:#dc2626;">&lt; Right BC</span>
        ${acL ? '<span style="color:#2563eb;">&times; Left AC (X)</span>' : ""}
        ${bcL ? '<span style="color:#1d4ed8;">&gt; Left BC</span>' : ""}
        <span style="color:#d97706;">&#9632; Shaded = Air–Bone Gap (ABG)</span>
      </div>
    `;
  }

  function renderTympSvg(curve) {
    const W = 280, H = 165, padL = 34, padR = 12, padT = 14, padB = 26;
    const pW = W - padL - padR, pH = H - padT - padB;
    const xP = (p) => padL + ((p + 350) / 600) * pW;
    const yC = (c) => padT + (1 - Math.min(2.5, Math.max(0, c)) / 2.5) * pH;
    const pathPts = (curve.points || []).map((pt) => `${xP(pt[0])},${yC(pt[1])}`).join(" ");
    const zeroX = xP(0);
    return `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">
        <rect x="${padL}" y="${padT}" width="${pW}" height="${pH}" fill="rgba(148,163,184,0.06)" stroke="rgba(148,163,184,0.35)"/>
        <line x1="${zeroX}" y1="${padT}" x2="${zeroX}" y2="${H - padB}" stroke="rgba(148,163,184,0.5)" stroke-dasharray="3,3"/>
        <text x="${zeroX}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="currentColor">0 daPa</text>
        <text x="${xP(-250)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="currentColor">−250</text>
        <text x="${xP(150)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="currentColor">+150</text>
        <text x="${padL - 5}" y="${yC(0.3) + 3}" text-anchor="end" font-size="9" fill="currentColor">0.3</text>
        <text x="${padL - 5}" y="${yC(1.6) + 3}" text-anchor="end" font-size="9" fill="currentColor">1.6</text>
        <polyline fill="none" stroke="#0d9488" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" points="${pathPts}"/>
      </svg>
    `;
  }

  function getBuilderArrays() {
    const baseAc = agState.acOffset;
    const baseBc = Math.min(baseAc, agState.bcOffset);
    let acR = [baseAc, baseAc, baseAc, baseAc, baseAc, baseAc];
    let bcR = [baseBc, baseBc, baseBc, baseBc, baseBc, baseBc];
    if (agState.notch === "carhart") {
      bcR[3] = Math.min(110, bcR[3] + 20);
      if (acR[0] < bcR[3] + 15) acR = acR.map((v) => Math.max(v, 50));
    } else if (agState.notch === "nihl") {
      acR[4] = Math.min(110, Math.max(acR[4], 55));
      bcR[4] = Math.min(110, Math.max(bcR[4], 50));
    } else if (agState.notch === "slope") {
      acR = acR.map((v, i) => Math.min(110, v + i * 9));
      bcR = bcR.map((v, i) => Math.min(110, v + i * 9));
    }
    const acL = [15, 15, 15, 15, 20, 20];
    const bcL = [10, 10, 10, 10, 15, 15];
    return { acR, bcR, acL, bcL };
  }

  function renderAudiogramLab() {
    setAudiogramTab(agState.tab, true);
  }

  function setAudiogramTab(tab, forceRender = false) {
    agState.tab = tab;
    ["rules", "builder", "demo", "tymp"].forEach((t) => {
      const btn = document.getElementById(`ag-tab-${t}`);
      const pan = document.getElementById(`ag-panel-${t}`);
      if (btn) btn.classList.toggle("active", t === tab);
      if (pan) pan.classList.toggle("hidden", t !== tab);
    });
    if (tab === "rules") renderAgRulesPanel();
    else if (tab === "builder") renderAgBuilderPanel();
    else if (tab === "demo") renderAgDemoPanel();
    else if (tab === "tymp") renderAgTympPanel();
    else if (forceRender) renderAgRulesPanel();
  }

  function renderAgRulesPanel() {
    const el = document.getElementById("ag-panel-rules");
    if (!el) return;
    const eqs = AUDIOGRAM_LAB.equations || [];
    const rules = AUDIOGRAM_LAB.decisionRules || [];
    const refs = AUDIOGRAM_LAB.referenceImages || [];

    el.innerHTML = `
      <div class="ag-eq-grid">
        ${eqs.map((e) => `
          <div class="ag-eq-card card-surface">
            <div class="eyebrow" style="color:var(--primary);">${escapeHtml(e.title)}</div>
            <div class="ag-eq-formula">${escapeHtml(e.formula)}</div>
            <div class="small muted">${escapeHtml(e.note)}</div>
          </div>
        `).join("")}
      </div>
      <div class="card-surface" style="margin-bottom:16px;overflow-x:auto;">
        <h3 style="margin:0 0 10px 0;">4-Row Clinical Identification Matrix</h3>
        <table class="ag-rules-table">
          <thead>
            <tr><th>Hearing Status</th><th>AC (500-2k Hz)</th><th>BC (500-2k Hz)</th><th>Air-Bone Gap</th><th>Rinne / Weber</th><th>Classic Causes</th></tr>
          </thead>
          <tbody>
            ${rules.map((r) => `
              <tr>
                <td><strong style="color:${r.color};">${escapeHtml(r.type)}</strong></td>
                <td>${escapeHtml(r.ac)}</td>
                <td>${escapeHtml(r.bc)}</td>
                <td><strong>${escapeHtml(r.abg)}</strong></td>
                <td class="small">${escapeHtml(r.rinne)} · ${escapeHtml(r.weber)}</td>
                <td class="small muted">${escapeHtml(r.causes)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <h3 style="margin:10px 0;">Reference Plates &amp; Handout Guides (Tap to Zoom)</h3>
      <div class="ag-ref-grid">
        ${refs.map((rf) => `
          <div class="ag-ref-card card-surface" style="cursor:pointer;" onclick="OSPE.openLightbox('C099','front','${escapeHtml(rf.file)}','${escapeHtml(rf.title)}')">
            <img src="${imgSrc(rf.file)}" alt="${escapeHtml(rf.title)}" />
            <div style="font-weight:700;font-size:0.9rem;margin-top:8px;">${escapeHtml(rf.title)}</div>
            <div class="small muted" style="margin-top:3px;">${escapeHtml(rf.caption)}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderAgBuilderPanel() {
    const el = document.getElementById("ag-panel-builder");
    if (!el) return;
    const { acR, bcR, acL, bcL } = getBuilderArrays();
    const acPta = computePTA(acR);
    const bcPta = computePTA(bcR);
    const abg = Math.round((acPta - bcPta) * 10) / 10;
    let dx = "Normal Hearing";
    let dxCol = "#10b981";
    let rinne = "Positive (AC > BC) | Weber Central";
    if (acPta <= 25 && bcPta <= 20) {
      dx = "Normal Right Ear Sensitivity";
      dxCol = "#10b981";
    } else if (bcPta <= 20 && abg > 15) {
      dx = agState.notch === "carhart" ? "Conductive Loss — Classic Otosclerosis Pattern (2 kHz Carhart)" : "Pure Conductive Hearing Loss (CHL)";
      dxCol = "#f59e0b";
      rinne = "Negative on Right (BC > AC) | Weber -> Right (Worse Ear)";
    } else if (bcPta > 20 && abg <= 15) {
      dx = agState.notch === "nihl" ? "Sensorineural Loss — Noise Trauma (4 kHz Dip)" : agState.notch === "slope" ? "High-Frequency Sloping SNHL (Presbycusis)" : "Pure Sensorineural Hearing Loss (SNHL)";
      dxCol = "#3b82f6";
      rinne = "Positive on Right (Reduced Both) | Weber -> Left (Better Ear)";
    } else if (bcPta > 20 && abg > 15) {
      dx = "Mixed Hearing Loss (Both Cochlear & Conductive Components)";
      dxCol = "#ef4444";
      rinne = "Usually Negative | Dual impairment";
    }

    el.innerHTML = `
      <div class="ag-builder-grid">
        <div class="ag-svg-wrap">
          <div class="ag-preset-strip">
            <button class="btn btn-sm btn-soft" onclick="OSPE.applyAudiogramPreset('normal')">Normal</button>
            <button class="btn btn-sm btn-soft" onclick="OSPE.applyAudiogramPreset('ome')">OME / Glue Ear (CHL)</button>
            <button class="btn btn-sm btn-soft" onclick="OSPE.applyAudiogramPreset('oto')">Otosclerosis (2k Carhart)</button>
            <button class="btn btn-sm btn-soft" onclick="OSPE.applyAudiogramPreset('presby')">Presbycusis (SNHL)</button>
            <button class="btn btn-sm btn-soft" onclick="OSPE.applyAudiogramPreset('nihl')">4 kHz NIHL Dip</button>
            <button class="btn btn-sm btn-soft" onclick="OSPE.applyAudiogramPreset('mixed')">Mixed Loss (CSOM)</button>
          </div>
          ${renderAudiogramSvg({ acR, bcR, acL, bcL, showAbg: agState.showAbg, focusEar: "R" })}
        </div>
        <div class="ag-readout-box">
          <div class="eyebrow" style="color:${dxCol};">LIVE EQUATION VERIFIER</div>
          <h3 style="margin:4px 0 8px 0;color:${dxCol};">${escapeHtml(dx)}</h3>
          <div class="small muted" style="margin-bottom:10px;">${escapeHtml(rinne)}</div>
          <div class="ag-eq-card" style="padding:10px 12px;margin-bottom:12px;">
            <div><strong>AC PTA:</strong> ${acPta} dB · <strong>BC PTA:</strong> ${bcPta} dB</div>
            <div style="font-size:1.05rem;margin-top:4px;color:var(--primary);"><strong>ABG = AC − BC = ${acPta} − ${bcPta} = ${abg} dB</strong> ${abg > 15 ? "(Conductive Gap >15!)" : "(No Significant Gap)"}</div>
            <div class="small" style="margin-top:4px;">WHO Grade: <strong>${classifyWhoGrade(acPta)}</strong></div>
          </div>
          <div class="ag-slider-row">
            <div style="display:flex;justify-content:space-between;font-weight:700;font-size:0.86rem;">
              <span>Right Air Conduction (AC)</span><span>${agState.acOffset} dB</span>
            </div>
            <input type="range" min="0" max="95" step="5" value="${agState.acOffset}" oninput="OSPE.updateBuilderSliders(this.value, null, null)" />
          </div>
          <div class="ag-slider-row">
            <div style="display:flex;justify-content:space-between;font-weight:700;font-size:0.86rem;">
              <span>Right Bone Conduction (BC Cochlea)</span><span>${agState.bcOffset} dB</span>
            </div>
            <input type="range" min="0" max="75" step="5" value="${agState.bcOffset}" oninput="OSPE.updateBuilderSliders(null, this.value, null)" />
          </div>
          <div class="ag-slider-row">
            <label class="small" style="font-weight:700;display:block;margin-bottom:4px;">Pattern Overlay:</label>
            <select onchange="OSPE.updateBuilderSliders(null, null, this.value)" style="width:100%;">
              <option value="none" ${agState.notch === "none" ? "selected" : ""}>Flat Baseline Thresholds</option>
              <option value="carhart" ${agState.notch === "carhart" ? "selected" : ""}>2 kHz Carhart's BC Notch (Otosclerosis)</option>
              <option value="nihl" ${agState.notch === "nihl" ? "selected" : ""}>4 kHz Bilateral Acoustic Dip (NIHL)</option>
              <option value="slope" ${agState.notch === "slope" ? "selected" : ""}>Down-Sloping High-Frequency Loss (Presbycusis)</option>
            </select>
          </div>
          <label class="checkbox-pill" style="margin-top:4px;">
            <input type="checkbox" ${agState.showAbg ? "checked" : ""} onchange="OSPE.toggleBuilderGap(this.checked)" />
            <span>Highlight Shaded Air-Bone Gap (ABG)</span>
          </label>
        </div>
      </div>
    `;
  }

  function applyAudiogramPreset(preset) {
    if (preset === "normal") { agState.acOffset = 10; agState.bcOffset = 5; agState.notch = "none"; }
    else if (preset === "ome") { agState.acOffset = 45; agState.bcOffset = 10; agState.notch = "none"; }
    else if (preset === "oto") { agState.acOffset = 50; agState.bcOffset = 10; agState.notch = "carhart"; }
    else if (preset === "presby") { agState.acOffset = 25; agState.bcOffset = 20; agState.notch = "slope"; }
    else if (preset === "nihl") { agState.acOffset = 15; agState.bcOffset = 10; agState.notch = "nihl"; }
    else if (preset === "mixed") { agState.acOffset = 65; agState.bcOffset = 35; agState.notch = "none"; }
    renderAgBuilderPanel();
  }

  function updateBuilderSliders(acVal, bcVal, notchVal) {
    if (acVal !== null) agState.acOffset = parseInt(acVal, 10) || 0;
    if (bcVal !== null) agState.bcOffset = parseInt(bcVal, 10) || 0;
    if (agState.bcOffset > agState.acOffset) agState.bcOffset = agState.acOffset;
    if (notchVal !== null) agState.notch = notchVal;
    renderAgBuilderPanel();
  }

  function toggleBuilderGap(checked) {
    agState.showAbg = !!checked;
    renderAgBuilderPanel();
  }

  function renderAgDemoPanel() {
    const el = document.getElementById("ag-panel-demo");
    if (!el) return;
    const cases = AUDIOGRAM_LAB.demoCases || [];
    if (!cases.length) { el.innerHTML = "<div class='card-surface'>No demo cases loaded.</div>"; return; }
    const idx = Math.max(0, Math.min(cases.length - 1, agState.demoIdx));
    const c = cases[idx];
    const picked = agState.demoAnswers[c.id];
    const answered = typeof picked === "number";

    const solvedCount = Object.keys(agState.demoAnswers).length;
    const correctCount = cases.filter((x) => agState.demoAnswers[x.id] === x.correctIndex).length;

    const acR = c.acR || [], bcR = c.bcR || [], acL = c.acL || null, bcL = c.bcL || null;
    const targetAc = (c.earFocus || "").includes("Left") && acL ? acL : acR;
    const targetBc = (c.earFocus || "").includes("Left") && bcL ? bcL : bcR;
    const ptaAc = computePTA(targetAc), ptaBc = computePTA(targetBc);

    el.innerHTML = `
      <div class="study-station-pills" style="margin-bottom:12px;">
        ${cases.map((x, i) => {
          const ua = agState.demoAnswers[x.id];
          const ok = typeof ua === "number" && ua === x.correctIndex;
          const bad = typeof ua === "number" && ua !== x.correctIndex;
          return `<button class="study-st-pill ${i === idx ? "active" : ""}" style="${ok ? "border-color:#10b981;" : bad ? "border-color:#ef4444;" : ""}" onclick="OSPE.selectDemoCase(${i})">#${i + 1}${ok ? " ✓" : bad ? " ✕" : ""}</button>`;
        }).join("")}
      </div>
      <div class="ag-demo-wrap">
        <div class="ag-svg-wrap">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
            <span class="pill pill-tier1">${escapeHtml(c.id)} · Case ${idx + 1}/${cases.length}</span>
            <span class="pill">${escapeHtml(c.tympType || "Type A")} Tympanogram</span>
            <span class="small muted">Score: ${correctCount}/${solvedCount}</span>
          </div>
          ${renderAudiogramSvg({ acR, bcR, acL, bcL, showAbg: true, focusEar: (c.earFocus || "").includes("Left") ? "L" : "R" })}
        </div>
        <div class="card-surface">
          <h3 style="margin:0 0 6px 0;">${escapeHtml(c.title)}</h3>
          <p class="muted" style="margin:0 0 12px 0;">${escapeHtml(c.stem)}</p>
          <div style="margin-bottom:10px;">
            <button class="btn btn-sm btn-soft" onclick="OSPE.toggleDemoHint()">${agState.demoShowHint ? "Hide Equation Hint" : "Show Equation Hint"}</button>
            ${agState.demoShowHint ? `<div class="pearl-callout" style="margin-top:8px;">Focus (${escapeHtml(c.earFocus || "Right")}): AC PTA = <strong>${ptaAc} dB</strong>, BC PTA = <strong>${ptaBc} dB</strong> &rarr; ABG = <strong>${Math.round((ptaAc - ptaBc) * 10) / 10} dB</strong></div>` : ""}
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${(c.options || []).map((opt, oi) => {
              let cls = "rf-opt-btn";
              if (answered) {
                if (oi === c.correctIndex) cls += " is-correct";
                else if (oi === picked) cls += " is-wrong";
              }
              return `<button class="${cls}" ${answered ? "disabled" : ""} onclick="OSPE.answerDemoCase('${c.id}',${oi})">${String.fromCharCode(65 + oi)}. ${escapeHtml(opt)}</button>`;
            }).join("")}
          </div>
          ${answered ? `
            <div class="rf-feedback ${picked === c.correctIndex ? "fb-ok" : "fb-err"}" style="margin-top:12px;">
              <strong>${picked === c.correctIndex ? "Correct Clinical Interpretation!" : "Review Equation Proof:"}</strong><br/>
              ${escapeHtml(c.proof)}<br/><br/>
              <em>DU Pearl: ${escapeHtml(c.pearl)}</em>
            </div>
          ` : ""}
          <div style="display:flex;justify-content:space-between;margin-top:14px;gap:8px;">
            <button class="btn btn-sm btn-soft" onclick="OSPE.selectDemoCase(${Math.max(0, idx - 1)})">&larr; Prev Case</button>
            <button class="btn btn-sm btn-primary" onclick="OSPE.nextDemoCase()">Next Case &rarr;</button>
          </div>
        </div>
      </div>
    `;
  }

  function selectDemoCase(i) {
    agState.demoIdx = i;
    agState.demoShowHint = false;
    renderAgDemoPanel();
  }

  function toggleDemoHint() {
    agState.demoShowHint = !agState.demoShowHint;
    renderAgDemoPanel();
  }

  function answerDemoCase(caseId, optIdx) {
    const cases = AUDIOGRAM_LAB.demoCases || [];
    const c = cases.find((x) => x.id === caseId);
    if (!c || typeof agState.demoAnswers[caseId] === "number") return;
    agState.demoAnswers[caseId] = optIdx;
    const isRight = optIdx === c.correctIndex;
    playTone(isRight ? "tr" : "f");
    recordRating("C099", isRight ? "TR" : "F", isRight ? 25 : 5);
    renderAgDemoPanel();
  }

  function nextDemoCase() {
    const cases = AUDIOGRAM_LAB.demoCases || [];
    agState.demoIdx = (agState.demoIdx + 1) % Math.max(1, cases.length);
    agState.demoShowHint = false;
    renderAgDemoPanel();
  }

  function renderAgTympPanel() {
    const el = document.getElementById("ag-panel-tymp");
    if (!el) return;
    const curves = AUDIOGRAM_LAB.tympCurves || [];
    el.innerHTML = `
      <div class="ag-tymp-grid">
        ${curves.map((cv) => `
          <div class="ag-tymp-card card-surface">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span class="pill pill-tier1">${escapeHtml(cv.code)}</span>
              <span class="small muted">${escapeHtml(cv.compliance)}</span>
            </div>
            <h3 style="margin:4px 0 2px 0;font-size:1rem;">${escapeHtml(cv.name)}</h3>
            <div class="small muted" style="margin-bottom:6px;">Peak Pressure: ${escapeHtml(cv.pressure)}</div>
            ${renderTympSvg(cv)}
            <div class="small" style="margin-top:8px;"><strong>Diagnosis:</strong> ${escapeHtml(cv.clinical)}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // ==================== VIEW 4: INTERACTIVE MINDMAP ====================
  const mmState = {
    mode: "global",
    stationId: "ST-01",
    tx: 40,
    ty: 40,
    scale: 0.72,
    width: 1800,
    height: 1200,
    panActive: false,
    startX: 0,
    startY: 0,
    pinchDist: 0
  };

  function buildMindmapStationPills() {
    const strip = document.getElementById("mm-station-pills");
    strip.innerHTML = STATIONS.map((s) => `
      <button class="mm-st-pill ${mmState.stationId === s.id ? "active" : ""}" onclick="OSPE.selectMindmapStation('${s.id}')">${s.code}</button>
    `).join("");
  }

  function setMindmapMode(mode) {
    mmState.mode = mode;
    document.getElementById("mm-mode-global").classList.toggle("active", mode === "global");
    document.getElementById("mm-mode-station").classList.toggle("active", mode === "station");
    document.getElementById("mm-station-pills").classList.toggle("hidden", mode === "global");
    renderMindmap();
  }

  function selectMindmapStation(stId) {
    mmState.stationId = stId;
    mmState.mode = "station";
    document.getElementById("mm-mode-global").classList.remove("active");
    document.getElementById("mm-mode-station").classList.add("active");
    buildMindmapStationPills();
    renderMindmap();
  }

  function createMindmapCardHtml(c, x, y) {
    const stats = getCardStats(c.id);
    const shortQ = (c.questions && c.questions[0]) ? c.questions[0] : c.scenario;
    const topAns = (c.answers && c.answers[0] && c.answers[0].bullets) ? c.answers[0].bullets.slice(0, 2).map((b) => `<div>&bull; ${fmtText(b)}</div>`).join("") : "";
    return `
      <div class="mm-node-wrap" style="left:${x}px; top:${y}px;" data-card-id="${c.id}">
        <div class="mm-node-flipper dom-${stats.dominant.toLowerCase()}" id="mm-flip-${c.id}">
          <div class="mm-face mm-face-front" onclick="OSPE.flipMindmapCard('${c.id}', true)">
            <div class="mm-front-row">
              <img class="mm-thumb" src="${imgSrc(c.frontImage)}" alt="${escapeHtml(c.station)}" />
              <div style="min-width:0;">
                <span class="pill ${c.pyqTier === "TIER-1" ? "pill-tier1" : ""}" style="font-size:0.62rem;padding:1px 6px;">${c.station} · ${c.pyqTier}</span>
                <div class="mm-q-title">${escapeHtml(shortQ)}</div>
              </div>
            </div>
            <div class="mm-node-foot">
              <span class="dom-badge is-${stats.dominant.toLowerCase()}">${stats.dominant}</span>
              <span class="muted">Tap to Reveal &rarr;</span>
            </div>
          </div>
          <div class="mm-face mm-face-back">
            <div class="mm-dx-head" title="${escapeHtml(c.diagnosis)}">${escapeHtml(c.diagnosis)}</div>
            <div class="mm-back-ans">${topAns}</div>
            <div class="mm-rate-row">
              <button class="mm-r-btn mm-r-f"  onclick="OSPE.rateMindmapCard('${c.id}','F')">F</button>
              <button class="mm-r-btn mm-r-pr" onclick="OSPE.rateMindmapCard('${c.id}','PR')">PR</button>
              <button class="mm-r-btn mm-r-tr" onclick="OSPE.rateMindmapCard('${c.id}','TR')">TR</button>
              <button class="mm-r-btn mm-r-flip" onclick="OSPE.openLightbox('${c.id}','front')" title="Zoom Image">&#128269;</button>
              <button class="mm-r-btn mm-r-flip" onclick="OSPE.flipMindmapCard('${c.id}', false)" title="Flip Front">&crarr;</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderMindmap() {
    buildMindmapStationPills();
    document.getElementById("mm-station-pills").classList.toggle("hidden", mmState.mode === "global");

    const nodesLayer = document.getElementById("mindmap-nodes-layer");
    const svgEl = document.getElementById("mindmap-svg-lines");
    const connectors = [];
    let html = "";

    if (mmState.mode === "global") {
      // Root hub at left, 10 station hubs in 2 columns / stacked branches with top Tier-1 / key cards
      const hubX = 40;
      const colStX = 360;
      const colCardX = 660;
      let curY = 40;
      const stationNodesMeta = [];

      STATIONS.forEach((s) => {
        const stCards = CARDS.filter((c) => c.station === s.id);
        const tier1First = stCards.filter((c) => c.pyqTier === "TIER-1");
        const previewCards = (tier1First.length ? tier1First : stCards).slice(0, 3);
        const blockH = Math.max(110, previewCards.length * 194);
        const stY = curY + Math.round(blockH / 2) - 36;

        html += `
          <div class="mm-st-node" style="left:${colStX}px; top:${stY}px; border-color:${s.color}" onclick="OSPE.selectMindmapStation('${s.id}')">
            <strong>${s.code} · ${escapeHtml(s.short)}</strong>
            <small>${stCards.length} Cards · Click for Full Station Map &rarr;</small>
          </div>
        `;
        stationNodesMeta.push({ x: colStX, y: stY + 32, color: s.color });

        previewCards.forEach((c, idx) => {
          const cy = curY + idx * 194;
          html += createMindmapCardHtml(c, colCardX, cy);
          connectors.push({ x1: colStX + 220, y1: stY + 32, x2: colCardX, y2: cy + 88, color: s.color });
        });

        curY += blockH + 28;
      });

      const rootY = Math.round(curY / 2) - 45;
      html += `
        <div class="mm-hub" style="left:${hubX}px; top:${rootY}px;">
          <h3>OSPE Recall (Surgery P2)</h3>
          <span>All 10 DU Final Prof Stations · Eye &amp; ENT Tree</span>
        </div>
      `;
      stationNodesMeta.forEach((sn) => {
        connectors.push({ x1: hubX + 240, y1: rootY + 38, x2: sn.x, y2: sn.y, color: sn.color });
      });

      mmState.width = 1000;
      mmState.height = curY + 40;
    } else {
      // Deep-Dive Single Station Map: Station Hub -> All Cards arranged cleanly in 2 vertical rows/columns
      const stObj = STATIONS.find((s) => s.id === mmState.stationId) || STATIONS[0];
      const stCards = CARDS.filter((c) => c.station === stObj.id);
      const perCol = Math.ceil(stCards.length / 2);
      const hubX = 40;
      const col1X = 350;
      const col2X = 680;
      const spacingY = 196;
      const totalH = Math.max(300, perCol * spacingY + 40);
      const hubY = Math.round(totalH / 2) - 45;

      html += `
        <div class="mm-hub" style="left:${hubX}px; top:${hubY}px; background:${stObj.color};">
          <h3>${stObj.code} · ${escapeHtml(stObj.short)}</h3>
          <span>${stCards.length} Complete Cards (Interactive Flip)</span>
        </div>
      `;

      stCards.forEach((c, idx) => {
        const isCol2 = idx >= perCol;
        const row = isCol2 ? idx - perCol : idx;
        const cx = isCol2 ? col2X : col1X;
        const cy = 30 + row * spacingY;
        html += createMindmapCardHtml(c, cx, cy);
        connectors.push({
          x1: hubX + 240, y1: hubY + 40,
          x2: cx, y2: cy + 88,
          color: stObj.color
        });
      });

      mmState.width = 1000;
      mmState.height = totalH + 40;
    }

    nodesLayer.innerHTML = html;
    svgEl.setAttribute("width", String(mmState.width));
    svgEl.setAttribute("height", String(mmState.height));
    svgEl.innerHTML = connectors.map((ln) => {
      const mx = Math.round((ln.x1 + ln.x2) / 2);
      const d = `M ${ln.x1} ${ln.y1} L ${mx} ${ln.y1} L ${mx} ${ln.y2} L ${ln.x2} ${ln.y2}`;
      return `<path d="${d}" fill="none" stroke="${ln.color || "#64748b"}" stroke-width="2.2" stroke-opacity="0.48" />`;
    }).join("");

    fitMindmap();
  }

  function flipMindmapCard(cardId, toBack) {
    const el = document.getElementById("mm-flip-" + cardId);
    if (el) el.classList.toggle("flipped", toBack);
  }

  function rateMindmapCard(cardId, rating) {
    const xpMap = { F: 10, PR: 20, TR: 35 };
    playTone(rating.toLowerCase());
    recordRating(cardId, rating, xpMap[rating] || 10);
    const el = document.getElementById("mm-flip-" + cardId);
    if (el) {
      const dom = getCardStats(cardId).dominant;
      el.classList.remove("dom-new", "dom-tr", "dom-pr", "dom-f");
      el.classList.add("dom-" + dom.toLowerCase());
      const badge = el.querySelector(".mm-face-front .dom-badge");
      if (badge) {
        badge.textContent = dom;
        badge.className = "dom-badge is-" + dom.toLowerCase();
      }
    }
    showToast(`Mindmap rated ${rating}`);
  }

  function updateMindmapTransform() {
    const canvas = document.getElementById("mindmap-canvas");
    canvas.style.transform = `translate(${mmState.tx}px, ${mmState.ty}px) scale(${mmState.scale})`;
    document.getElementById("mm-zoom-pct").textContent = `${Math.round(mmState.scale * 100)}%`;
  }

  function zoomMindmap(delta, cx = null, cy = null) {
    const vp = document.getElementById("mindmap-viewport");
    const rect = vp.getBoundingClientRect();
    const px = cx !== null ? cx - rect.left : rect.width / 2;
    const py = cy !== null ? cy - rect.top : rect.height / 2;
    const oldScale = mmState.scale;
    const nextScale = Math.min(1.6, Math.max(0.28, oldScale + delta));
    const ratio = nextScale / oldScale;
    mmState.tx = px - (px - mmState.tx) * ratio;
    mmState.ty = py - (py - mmState.ty) * ratio;
    mmState.scale = nextScale;
    updateMindmapTransform();
  }

  function fitMindmap() {
    const vp = document.getElementById("mindmap-viewport");
    const w = vp.clientWidth || 800;
    const h = vp.clientHeight || 520;
    const sx = (w - 40) / mmState.width;
    const sy = (h - 40) / mmState.height;
    mmState.scale = Math.min(0.95, Math.max(0.32, Math.min(sx, sy)));
    mmState.tx = Math.max(20, (w - mmState.width * mmState.scale) / 2);
    mmState.ty = 20;
    updateMindmapTransform();
  }

  function initMindmapInteractions() {
    const vp = document.getElementById("mindmap-viewport");
    vp.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoomMindmap(e.deltaY < 0 ? 0.09 : -0.09, e.clientX, e.clientY);
    }, { passive: false });

    vp.addEventListener("mousedown", (e) => {
      if (e.target.closest(".mm-node-wrap, .mm-st-node, .mm-hub")) return;
      mmState.panActive = true;
      mmState.startX = e.clientX - mmState.tx;
      mmState.startY = e.clientY - mmState.ty;
    });
    window.addEventListener("mousemove", (e) => {
      if (!mmState.panActive) return;
      mmState.tx = e.clientX - mmState.startX;
      mmState.ty = e.clientY - mmState.startY;
      updateMindmapTransform();
    });
    window.addEventListener("mouseup", () => { mmState.panActive = false; });

    // Touch pan + 2-finger pinch zoom for Android WebView
    vp.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        if (e.target.closest("button")) return;
        mmState.panActive = true;
        mmState.startX = e.touches[0].clientX - mmState.tx;
        mmState.startY = e.touches[0].clientY - mmState.ty;
      } else if (e.touches.length === 2) {
        mmState.panActive = false;
        mmState.pinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    vp.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1 && mmState.panActive) {
        mmState.tx = e.touches[0].clientX - mmState.startX;
        mmState.ty = e.touches[0].clientY - mmState.startY;
        updateMindmapTransform();
      } else if (e.touches.length === 2) {
        e.preventDefault();
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        if (mmState.pinchDist > 0) zoomMindmap((d - mmState.pinchDist) * 0.004, mx, my);
        mmState.pinchDist = d;
      }
    }, { passive: false });

    vp.addEventListener("touchend", () => { mmState.panActive = false; mmState.pinchDist = 0; });
  }

  // ==================== VIEW 5: REVISION DIRECTORY, STATION STUDY PACK & YEAR-WISE ARCHIVE ====================
  let dirMode = "revision";
  let dirScope = "topic";
  let dirStudyStation = "ST-01";
  let dirYearFilter = "2026";
  const dirRevealed = new Set();
  const ywRevealed = new Set();

  function setDirectoryScope(scope) {
    dirScope = scope;
    document.getElementById("dir-scope-topic").classList.toggle("active", scope === "topic");
    const studyBtn = document.getElementById("dir-scope-study");
    if (studyBtn) studyBtn.classList.toggle("active", scope === "study");
    document.getElementById("dir-scope-year").classList.toggle("active", scope === "yearwise");

    const isTopic = scope === "topic";
    const isStudy = scope === "study";
    const isYear = scope === "yearwise";
    const modeGrp = document.getElementById("dir-mode-group");
    if (modeGrp) modeGrp.classList.toggle("hidden", isStudy);

    document.getElementById("dir-station-select").classList.toggle("hidden", !isTopic);
    document.getElementById("dir-status-select").classList.toggle("hidden", !isTopic);
    document.getElementById("yw-subject-select").classList.toggle("hidden", !isYear);
    document.getElementById("yw-year-pills").classList.toggle("hidden", !isYear);
    const studyPills = document.getElementById("study-station-pills");
    if (studyPills) studyPills.classList.toggle("hidden", !isStudy);

    if (isYear && !sessionLoggedViews.has("yearwise")) {
      sessionLoggedViews.add("yearwise");
      sendAnalyticsPing("view", "yearwise");
    }
    if (isStudy && !sessionLoggedViews.has("study_pack")) {
      sessionLoggedViews.add("study_pack");
      sendAnalyticsPing("view", "study_pack", { m: dirStudyStation });
    }
    if (isYear) renderYearPills();
    if (isStudy) renderStudyStationPills();
    renderDirectory();
  }

  function renderStudyStationPills() {
    const container = document.getElementById("study-station-pills");
    if (!container) return;
    container.innerHTML = STATIONS.map((s) => `
      <button class="study-st-pill ${dirStudyStation === s.id ? "active" : ""}" onclick="OSPE.setStudyStation('${s.id}')">
        <span>${escapeHtml(s.code)} · ${escapeHtml(s.shortName || s.name.replace(/^ST-\d+\s*[·-]\s*/, ""))}</span>
      </button>
    `).join("");
  }

  function setStudyStation(stId) {
    dirStudyStation = stId;
    renderStudyStationPills();
    renderDirectory();
  }

  function openStationStudy(stId) {
    dirStudyStation = stId || "ST-01";
    navigate("directory");
    setDirectoryScope("study");
  }

  function setYearFilter(yr) {
    dirYearFilter = yr;
    if (yr !== "ALL" && !sessionLoggedPyqYears.has(yr)) {
      sessionLoggedPyqYears.add(yr);
      sendAnalyticsPing("pyq_year", yr, { v1: dirMode });
    }
    renderYearPills();
    renderDirectory();
  }

  function renderYearPills() {
    const container = document.getElementById("yw-year-pills");
    if (!container) return;
    const years = Array.from(new Set(PYQ_SESSIONS.map((s) => String(s.year)))).sort((a, b) => Number(b) - Number(a));
    const pills = [`<button class="yw-year-pill ${dirYearFilter === "ALL" ? "active" : ""}" onclick="OSPE.setYearFilter('ALL')">All Years (${PYQ_SESSIONS.length} Papers)</button>`];
    years.forEach((yr) => {
      pills.push(`<button class="yw-year-pill ${dirYearFilter === yr ? "active" : ""}" onclick="OSPE.setYearFilter('${yr}')">${yr}</button>`);
    });
    container.innerHTML = pills.join("");
  }

  function openYearWiseRevision() {
    navigate("directory");
    setDirectoryScope("yearwise");
  }

  function setDirectoryMode(mode) {
    dirMode = mode;
    document.getElementById("dir-mode-rev").classList.toggle("active", mode === "revision");
    document.getElementById("dir-mode-exam").classList.toggle("active", mode === "exam");
    if (mode === "exam" && !sessionLoggedViews.has("exam_masked")) {
      sessionLoggedViews.add("exam_masked");
      sendAnalyticsPing("view", "exam_masked");
    }
    renderDirectory();
  }

  function peekDirectoryCard(cardId) {
    dirRevealed.add(cardId);
    renderDirectory();
  }

  function peekYearWiseItem(itemKey) {
    if (ywRevealed.has(itemKey)) ywRevealed.delete(itemKey);
    else ywRevealed.add(itemKey);
    renderDirectory();
  }

  function toggleRevealAllYearWise() {
    if (dirMode !== "exam") return;
    const allKeys = [];
    PYQ_SESSIONS.forEach((sess) => {
      if (dirYearFilter !== "ALL" && String(sess.year) !== dirYearFilter) return;
      (sess.items || []).forEach((it) => allKeys.push(`${sess.id}:${it.stationNo}:${it.cardId}`));
    });
    const allOpen = allKeys.length > 0 && allKeys.every((k) => ywRevealed.has(k));
    if (allOpen) allKeys.forEach((k) => ywRevealed.delete(k));
    else allKeys.forEach((k) => ywRevealed.add(k));
    renderDirectory();
  }

  function startSessionPaper(sessionId) {
    const sess = PYQ_SESSIONS.find((s) => s.id === sessionId);
    if (!sess || !sess.items || !sess.items.length) return;
    const paperDeck = sess.items.map((it) => {
      const c = CARD_MAP.get(it.cardId);
      if (!c) return null;
      const ywImg = it.origImage || c.origFrontImage || c.frontImage;
      const stNum = String(it.stationNo).padStart(2, "0");
      return Object.assign({}, c, {
        frontImage: ywImg,
        _ywImg: ywImg,
        _ywTitle: `${sess.label} · Station ${stNum} — Original Exam Pic`
      });
    }).filter(Boolean);
    if (!paperDeck.length) return;
    sendAnalyticsPing("pyq_paper", sess.id, { v1: dirMode, m: sess.label });
    document.getElementById("recall-station-select").value = "ALL";
    document.getElementById("recall-tier-select").value = "ALL";
    setRecallMode("seq", true);
    recallState.deck = paperDeck;
    recallState.index = 0;
    recallState.flipped = false;
    navigate("recall");
    showToast(`Loaded ${sess.label} (${paperDeck.length} Stations)`);
  }

  function renderDirectory() {
    const q = (document.getElementById("dir-search-input").value || "").trim().toLowerCase();
    const grid = document.getElementById("dir-grid");
    const toggleBtn = document.getElementById("yw-toggle-all-btn");

    if (dirScope === "study") {
      if (toggleBtn) toggleBtn.classList.add("hidden");
      grid.className = "study-pack-wrap";
      const stObj = STATIONS.find((s) => s.id === dirStudyStation) || STATIONS[0];
      const cardsInSt = CARDS.filter((c) => {
        if (c.station !== dirStudyStation) return false;
        if (!q) return true;
        const hay = [
          c.diagnosis, c.scenario, c.pearl, ...(c.pyqSessions || []),
          ...(c.questions || []), ...(c.answers || []).flatMap((a) => [a.q, ...a.bullets])
        ].join(" ").toLowerCase();
        return hay.includes(q);
      });

      document.getElementById("dir-count-label").textContent =
        `Station Study Pack: ${stObj ? stObj.name : dirStudyStation} (${cardsInSt.length} Complete Topics)`;

      const headerHtml = stObj ? `
        <div class="study-pack-head card-surface">
          <div>
            <span class="pill pill-tier1">${escapeHtml(stObj.code)}</span>
            <h3 style="margin:6px 0 4px 0;">${escapeHtml(stObj.name)} — Complete Revision Notes</h3>
            <p class="small muted" style="margin:0;">${escapeHtml(stObj.desc)}</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-sm btn-soft" onclick="OSPE.openStation('${stObj.id}')">Drill Recall Deck</button>
            <button class="btn btn-sm btn-primary" onclick="OSPE.startStationBlitz('${stObj.id}')">&#9889; 30s Station Blitz</button>
          </div>
        </div>
      ` : "";

      const cardsHtml = cardsInSt.map((c, idx) => {
        const stats = getCardStats(c.id);
        const pyqStr = (c.pyqSessions || []).slice(0, 4).map((p) => `<span class="pill pill-pyq">${escapeHtml(p)}</span>`).join("");
        const tierCls = c.pyqTier === "TIER-1" ? "pill-tier1" : c.pyqTier === "TIER-2" ? "pill-tier2" : "";
        const fullAns = (c.answers || []).map((a) => `
          <div class="study-qa-block">
            <h4>${escapeHtml(a.q)}</h4>
            <ul>${(a.bullets || []).map((b) => `<li>${fmtText(b)}</li>`).join("")}</ul>
          </div>
        `).join("");
        return `
          <div class="study-card-full card-surface dom-${stats.dominant.toLowerCase()}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
              <div>
                <div class="meta-badges">
                  <span class="pill">#${idx + 1} · ${escapeHtml(c.id)}</span>
                  <span class="pill ${tierCls}">${escapeHtml(c.pyqTier)}</span>
                  ${pyqStr}
                </div>
                <h3 style="margin:6px 0 2px 0;">${escapeHtml(c.diagnosis)}</h3>
                <div class="small muted">${escapeHtml(c.scenario)}</div>
              </div>
              <div class="dir-rate-mini">
                <button class="mm-r-btn mm-r-f"  style="padding:5px 10px;" onclick="OSPE.rateDirCard('${c.id}','F')">F</button>
                <button class="mm-r-btn mm-r-pr" style="padding:5px 10px;" onclick="OSPE.rateDirCard('${c.id}','PR')">PR</button>
                <button class="mm-r-btn mm-r-tr" style="padding:5px 10px;" onclick="OSPE.rateDirCard('${c.id}','TR')">TR</button>
              </div>
            </div>
            <div class="study-card-grid">
              <div class="study-img-stack">
                <img class="study-main-img" src="${imgSrc(c.frontImage)}" alt="${escapeHtml(c.diagnosis)}" onclick="OSPE.openLightbox('${c.id}','front')" />
                ${c.backImage ? `<img class="study-back-thumb" src="${imgSrc(c.backImage)}" alt="Annotated Guide" onclick="OSPE.openLightbox('${c.id}','back')" />` : ""}
              </div>
              <div class="study-qa-list">
                ${fullAns}
                <div class="pearl-callout" style="margin-top:4px;">
                  <div class="pearl-label">DU EXAMINER PEARL</div>
                  <p>${fmtText(c.pearl)}</p>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");

      grid.innerHTML = headerHtml + (cardsHtml || `<div class="card-surface empty-state"><h3>No matching notes in this station</h3></div>`);
      return;
    }

    if (dirScope === "yearwise") {
      const subj = document.getElementById("yw-subject-select").value;
      if (toggleBtn) toggleBtn.classList.toggle("hidden", dirMode !== "exam");

      grid.className = "yw-sessions-wrap";
      let totalStationsMatched = 0;
      const visibleKeys = [];
      const sessionHtmlBlocks = [];

      PYQ_SESSIONS.forEach((sess) => {
        if (dirYearFilter !== "ALL" && String(sess.year) !== dirYearFilter) return;
        const matchedItems = (sess.items || []).filter((it) => {
          if (subj !== "ALL" && it.subject !== subj) return false;
          const c = CARD_MAP.get(it.cardId);
          if (!c) return false;
          if (q) {
            const hay = [
              sess.label, String(sess.year), it.subject, `station ${it.stationNo}`,
              ...(it.askedQuestions || []),
              c.diagnosis, c.scenario, c.pearl, c.station, c.stationShort,
              ...(c.answers || []).flatMap((a) => [a.q, ...a.bullets])
            ].join(" ").toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });

        if (!matchedItems.length) return;
        totalStationsMatched += matchedItems.length;

        const cardsHtml = matchedItems.map((it) => {
          const c = CARD_MAP.get(it.cardId);
          const stats = getCardStats(c.id);
          const key = `${sess.id}:${it.stationNo}:${c.id}`;
          visibleKeys.push(key);
          const isPeeked = ywRevealed.has(key);
          const masked = dirMode === "exam" && !isPeeked;
          const stNum = String(it.stationNo).padStart(2, "0");
          const ywImg = it.origImage || c.origFrontImage || c.frontImage;
          const lbTitle = `${sess.label} · Station ${stNum} — Original Exam Pic`;

          const askedHtml = (it.askedQuestions || []).map((aq) => `<li>${escapeHtml(aq)}</li>`).join("");
          const ansHtml = (c.answers || []).map((a) => `
            <div style="margin-bottom:6px;">
              <strong>${escapeHtml(a.q)}</strong>
              <ul>${(a.bullets || []).map((b) => `<li>${fmtText(b)}</li>`).join("")}</ul>
            </div>
          `).join("");

          return `
            <div class="dir-card card-surface dom-${stats.dominant.toLowerCase()}">
              <div class="dir-card-head">
                <img class="dir-thumb" src="${imgSrc(ywImg)}" alt="Station ${stNum}" onclick="OSPE.openLightbox('${c.id}','front','${escapeHtml(ywImg)}','${escapeHtml(lbTitle)}')" />
                <div style="min-width:0; flex:1;">
                  <div class="meta-badges">
                    <span class="yw-station-tag">Station ${stNum} · ${escapeHtml(it.subject)}</span>
                    <span class="pill ${c.pyqTier === "TIER-1" ? "pill-tier1" : ""}">${c.pyqTier}</span>
                    ${it.origImage ? '<span class="pill" style="background:rgba(15,41,74,0.08);font-size:0.68rem;">Original Exam Pic</span>' : ""}
                    <span class="dom-badge is-${stats.dominant.toLowerCase()}" style="margin-left:auto;">${stats.dominant}</span>
                  </div>
                  <h3 class="dir-dx dir-spoiler ${masked ? "masked" : ""}">${escapeHtml(c.diagnosis)}</h3>
                  <div class="small muted">${escapeHtml(c.station)} · ${escapeHtml(c.stationShort)}</div>
                </div>
              </div>

              <div class="yw-asked-box">
                <div class="yw-asked-lbl">DU Asked Questions (4 Marks):</div>
                <ol>${askedHtml}</ol>
              </div>

              <div class="dir-body dir-spoiler ${masked ? "masked" : ""}">
                ${ansHtml}
                <div style="margin-top:6px;"><em>High-Yield Pearl: ${fmtText(c.pearl)}</em></div>
              </div>

              <div class="dir-actions">
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                  ${dirMode === "exam" ? `<button class="btn btn-sm ${masked ? "btn-primary" : "btn-soft"}" onclick="OSPE.peekYearWiseItem('${key}')">${masked ? "Peek Answer" : "Hide Answer"}</button>` : ""}
                  ${!masked ? `<button class="btn btn-sm btn-soft" onclick="OSPE.openCardInRecall('${c.id}')">Active Recall</button>` : ""}
                </div>
                <div class="dir-rate-mini">
                  <button class="mm-r-btn mm-r-f"  style="padding:4px 9px;" onclick="OSPE.rateDirCard('${c.id}','F')">F</button>
                  <button class="mm-r-btn mm-r-pr" style="padding:4px 9px;" onclick="OSPE.rateDirCard('${c.id}','PR')">PR</button>
                  <button class="mm-r-btn mm-r-tr" style="padding:4px 9px;" onclick="OSPE.rateDirCard('${c.id}','TR')">TR</button>
                </div>
              </div>
            </div>
          `;
        }).join("");

        sessionHtmlBlocks.push(`
          <div class="yw-session-block">
            <div class="yw-session-head card-surface">
              <div>
                <span class="pill pill-pyq">${escapeHtml(sess.badge)}</span>
                <h3>${escapeHtml(sess.label)}</h3>
                <span class="small muted">${matchedItems.length} Station${matchedItems.length > 1 ? "s" : ""} shown · DU Final Prof OSPE</span>
              </div>
              <button class="btn btn-sm btn-primary" onclick="OSPE.startSessionPaper('${sess.id}')">Practice Paper in Recall &rarr;</button>
            </div>
            <div class="dir-grid">
              ${cardsHtml}
            </div>
          </div>
        `);
      });

      if (toggleBtn && dirMode === "exam") {
        const allOpen = visibleKeys.length > 0 && visibleKeys.every((k) => ywRevealed.has(k));
        toggleBtn.textContent = allOpen ? "Hide All Answers" : "Reveal All Answers";
      }

      document.getElementById("dir-count-label").textContent =
        `Showing ${sessionHtmlBlocks.length} DU Exam Papers · ${totalStationsMatched} Year-Wise Stations (2026 → 2015) · Mode: ${dirMode === "exam" ? "Exam Masked" : "Revision Open"}`;

      grid.innerHTML = sessionHtmlBlocks.length
        ? sessionHtmlBlocks.join("")
        : `<div class="card-surface empty-state"><h3>No matching papers or stations</h3><p class="muted">Try selecting "All Years" or clearing the search filter.</p></div>`;
      return;
    }

    // Topic / Station Directory Scope
    if (toggleBtn) toggleBtn.classList.add("hidden");
    grid.className = "dir-grid";

    const st = document.getElementById("dir-station-select").value;
    const status = document.getElementById("dir-status-select").value;

    const filtered = CARDS.filter((c) => {
      if (st !== "ALL" && c.station !== st) return false;
      const dom = getCardStats(c.id).dominant;
      if (status === "TIER1" && c.pyqTier !== "TIER-1") return false;
      if (status === "STAR" && !isStarred(c)) return false;
      if (["F", "PR", "TR", "NEW"].includes(status) && dom !== status) return false;
      if (q) {
        const hay = [
          c.diagnosis, c.scenario, c.pearl, c.station, c.stationShort,
          ...(c.pyqSessions || []),
          ...c.questions,
          ...(c.answers || []).flatMap((a) => [a.q, ...a.bullets])
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    document.getElementById("dir-count-label").textContent = `Showing ${filtered.length} of ${CARDS.length} OSPE Topics`;

    grid.innerHTML = filtered.map((c) => {
      const stats = getCardStats(c.id);
      const masked = dirMode === "exam" && !dirRevealed.has(c.id);
      const pyqStr = (c.pyqSessions || []).slice(0, 3).map((p) => `<span class="pill pill-pyq">${escapeHtml(p)}</span>`).join("");
      const tierCls = c.pyqTier === "TIER-1" ? "pill-tier1" : c.pyqTier === "TIER-2" ? "pill-tier2" : "";
      const summaryAns = (c.answers || []).slice(0, 2).map((a) => `
        <div><strong>${escapeHtml(a.q)}</strong><ul>${a.bullets.slice(0, 2).map((b) => `<li>${fmtText(b)}</li>`).join("")}</ul></div>
      `).join("");

      return `
        <div class="dir-card card-surface dom-${stats.dominant.toLowerCase()}">
          <div class="dir-card-head">
            <img class="dir-thumb" src="${imgSrc(c.frontImage)}" alt="${escapeHtml(c.station)}" onclick="OSPE.openLightbox('${c.id}','front')" />
            <div style="min-width:0; flex:1;">
              <div class="meta-badges">
                <span class="pill">${c.station}</span>
                <span class="pill ${tierCls}">${c.pyqTier}</span>
                ${pyqStr}
              </div>
              <h3 class="dir-dx dir-spoiler ${masked ? "masked" : ""}">${escapeHtml(c.diagnosis)}</h3>
              <div class="small muted">${escapeHtml(c.scenario.slice(0, 95))}${c.scenario.length > 95 ? "..." : ""}</div>
            </div>
          </div>
          <div class="dir-body dir-spoiler ${masked ? "masked" : ""}">
            ${summaryAns}
            <div style="margin-top:6px;"><em>Pearl: ${fmtText(c.pearl)}</em></div>
          </div>
          <div class="dir-actions">
            ${masked ? `<button class="btn btn-sm btn-primary" onclick="OSPE.peekDirectoryCard('${c.id}')">Peek Answer</button>` : `<button class="btn btn-sm btn-soft" onclick="OSPE.openCardInRecall('${c.id}')">Open Full Card</button>`}
            <div class="dir-rate-mini">
              <button class="mm-r-btn mm-r-f"  style="padding:4px 9px;" onclick="OSPE.rateDirCard('${c.id}','F')">F</button>
              <button class="mm-r-btn mm-r-pr" style="padding:4px 9px;" onclick="OSPE.rateDirCard('${c.id}','PR')">PR</button>
              <button class="mm-r-btn mm-r-tr" style="padding:4px 9px;" onclick="OSPE.rateDirCard('${c.id}','TR')">TR</button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function rateDirCard(cardId, rating) {
    const xpMap = { F: 10, PR: 20, TR: 35 };
    playTone(rating.toLowerCase());
    recordRating(cardId, rating, xpMap[rating] || 10);
    renderDirectory();
  }

  function openCardInRecall(cardId) {
    const c = CARD_MAP.get(cardId);
    if (!c) return;
    document.getElementById("recall-station-select").value = "ALL";
    document.getElementById("recall-tier-select").value = "ALL";
    setRecallMode("seq", true);
    recallState.deck = [...CARDS];
    recallState.index = Math.max(0, recallState.deck.findIndex((x) => x.id === cardId));
    recallState.flipped = false;
    navigate("recall");
  }

  // ==================== LIGHTBOX IMAGE MODAL ====================
  const lbState = { open: false, cardId: null, side: "front", overrideFile: "", customTitle: "", scale: 1, tx: 0, ty: 0, dragging: false, sx: 0, sy: 0 };

  function openLightbox(cardId, side = "front", overrideFile = "", customTitle = "") {
    const c = CARD_MAP.get(cardId);
    if (!c && !overrideFile) return;
    lbState.open = true;
    lbState.cardId = cardId;
    lbState.side = side;
    lbState.overrideFile = overrideFile || "";
    lbState.customTitle = customTitle || "";
    lbState.scale = 1;
    lbState.tx = 0;
    lbState.ty = 0;

    const src = overrideFile || ((side === "back" && c && c.backImage) ? c.backImage : (c ? c.frontImage : ""));
    document.getElementById("lb-img").src = imgSrc(src);
    document.getElementById("lb-title").textContent = customTitle || (c ? `${c.station} · ${side === "back" ? "Annotated Reference" : "Station Prompt"}` : "Clinical Reference");
    const toggleBtn = document.getElementById("lb-toggle-side");
    if (!overrideFile && c && c.backImage) {
      toggleBtn.classList.remove("hidden");
      toggleBtn.textContent = side === "back" ? "View Front Prompt" : "View Annotated Back";
    } else {
      toggleBtn.classList.add("hidden");
    }

    updateLightboxTransform();
    document.getElementById("lightbox-modal").classList.remove("hidden");
  }

  function openLightboxForCurrent(side) {
    const c = getCurrentCard();
    if (!c) return;
    if (side === "front" && c._ywImg) openLightbox(c.id, "front", c._ywImg, c._ywTitle || "");
    else openLightbox(c.id, side);
  }

  function toggleLightboxSide() {
    if (!lbState.cardId) return;
    openLightbox(lbState.cardId, lbState.side === "front" ? "back" : "front");
  }

  function updateLightboxTransform() {
    document.getElementById("lb-img").style.transform = `translate(${lbState.tx}px, ${lbState.ty}px) scale(${lbState.scale})`;
  }

  function zoomLightbox(delta) {
    lbState.scale = Math.min(4.5, Math.max(0.8, lbState.scale + delta));
    updateLightboxTransform();
  }

  function resetLightboxZoom() {
    lbState.scale = 1;
    lbState.tx = 0;
    lbState.ty = 0;
    updateLightboxTransform();
  }

  function closeLightbox() {
    lbState.open = false;
    document.getElementById("lightbox-modal").classList.add("hidden");
  }

  function initLightboxInteractions() {
    const canvas = document.getElementById("lb-canvas");
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoomLightbox(e.deltaY < 0 ? 0.2 : -0.2);
    }, { passive: false });
    canvas.addEventListener("mousedown", (e) => {
      lbState.dragging = true;
      lbState.sx = e.clientX - lbState.tx;
      lbState.sy = e.clientY - lbState.ty;
    });
    window.addEventListener("mousemove", (e) => {
      if (!lbState.dragging || !lbState.open) return;
      lbState.tx = e.clientX - lbState.sx;
      lbState.ty = e.clientY - lbState.sy;
      updateLightboxTransform();
    });
    window.addEventListener("mouseup", () => { lbState.dragging = false; });

    canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        lbState.dragging = true;
        lbState.sx = e.touches[0].clientX - lbState.tx;
        lbState.sy = e.touches[0].clientY - lbState.ty;
      }
    }, { passive: true });
    canvas.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1 && lbState.dragging) {
        lbState.tx = e.touches[0].clientX - lbState.sx;
        lbState.ty = e.touches[0].clientY - lbState.sy;
        updateLightboxTransform();
      }
    }, { passive: true });
    canvas.addEventListener("touchend", () => { lbState.dragging = false; });
  }

  // ==================== DIALOG MODAL & DATA BACKUP ====================
  let dialogOpen = false;
  function showDialog(eyebrow, title, body, actionsHtml = null, textareaVal = null) {
    dialogOpen = true;
    document.getElementById("dlg-eyebrow").textContent = eyebrow;
    document.getElementById("dlg-title").textContent = title;
    document.getElementById("dlg-body").textContent = body;
    const ta = document.getElementById("dlg-textarea");
    if (textareaVal !== null) {
      ta.value = textareaVal;
      ta.classList.remove("hidden");
    } else {
      ta.classList.add("hidden");
    }
    document.getElementById("dlg-actions").innerHTML = actionsHtml || `<button class="btn btn-primary" onclick="OSPE.closeDialog()">Continue</button>`;
    document.getElementById("dialog-modal").classList.remove("hidden");
  }

  function closeDialog() {
    dialogOpen = false;
    document.getElementById("dialog-modal").classList.add("hidden");
  }

  function exportData() {
    const jsonStr = JSON.stringify(state, null, 2);
    try {
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ospe_recall_surgery_p1_backup_${todayKey(0)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* fallback modal below works everywhere including Android WebView */ }
    showDialog(
      "PROGRESS EXPORT",
      "Backup JSON Ready",
      "A file download was initiated (or copy the JSON string below directly if on Android):",
      `<button class="btn btn-soft" onclick="OSPE.copyExportJson()">Copy JSON</button><button class="btn btn-primary" onclick="OSPE.closeDialog()">Done</button>`,
      jsonStr
    );
  }

  function copyExportJson() {
    const ta = document.getElementById("dlg-textarea");
    ta.select();
    try { navigator.clipboard.writeText(ta.value); } catch { document.execCommand("copy"); }
    showToast("Backup JSON copied!");
  }

  function triggerImport() {
    document.getElementById("import-file-input").click();
  }

  function handleImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result || "{}"));
        if (typeof imported !== "object" || imported === null) throw new Error("Invalid");
        state = Object.assign(defaultState(), imported);
        saveState();
        applyTheme();
        applyMuteUI();
        renderDashboard();
        showToast("Progress imported successfully!");
      } catch {
        showToast("Invalid backup JSON file");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function askReset() {
    showDialog(
      "RESET CONFIRMATION",
      "Reset All Study Progress?",
      "This clears your XP, streak, heatmap, and card F/PR/TR ratings on this device. Export JSON first if you want a backup.",
      `<button class="btn btn-soft" onclick="OSPE.closeDialog()">Cancel</button><button class="btn btn-soft-red" onclick="OSPE.confirmReset()">Confirm Reset</button>`
    );
  }

  // ==================== DOCTOR PROFILE & UNLOCK CELEBRATION ====================
  let welcomeModalOpen = false;
  let drUnlockModalOpen = false;

  function renderDoctorBar() {
    const el = document.getElementById("dash-doctor-bar");
    if (!el) return;
    const nm = cleanDoctorName(state.userName);
    el.classList.toggle("is-unlocked", !!state.drUnlocked);

    if (state.drUnlocked) {
      const display = nm ? `Dr. ${escapeHtml(nm)}` : "Doctor";
      el.innerHTML = `
        <div class="dr-name-group">
          <span class="dr-display-name"><span class="dr-title-unlocked">${display}</span></span>
          <span class="dr-verified-pill">DOCTOR UNLOCKED</span>
        </div>
        <div class="dr-actions-group">
          <button class="dr-edit-btn" onclick="OSPE.openWelcomeModal()" title="Edit Name">&#9998; Edit</button>
          <button class="dr-undo-link" onclick="OSPE.undoDoctorTitle()" title="Undo Dr. unlock">Undo</button>
        </div>
      `;
    } else {
      const display = nm ? escapeHtml(nm) : "Aspiring Surgeon";
      el.innerHTML = `
        <div class="dr-name-group">
          <span class="dr-display-name"><span class="dr-brackets">(Dr.)</span> ${display}</span>
          <button class="dr-edit-btn" onclick="OSPE.openWelcomeModal()" title="Edit Name">&#9998; ${nm ? "Edit" : "Add Name"}</button>
        </div>
        <button class="dr-unlock-cta" onclick="OSPE.unlockDoctorTitle()">&#127891; Passed Exam? Unlock Dr. Status</button>
      `;
    }
  }

  function updateWelcomePreview() {
    const inp = document.getElementById("welcome-name-input");
    const prev = document.getElementById("welcome-live-preview");
    if (!inp || !prev) return;
    const nm = cleanDoctorName(inp.value);
    if (state.drUnlocked) {
      prev.innerHTML = `<span class="dr-title-unlocked">Dr. ${escapeHtml(nm || "Doctor")}</span>`;
    } else {
      prev.innerHTML = `<span class="dr-brackets">(Dr.)</span> ${escapeHtml(nm || "Aspiring Surgeon")}`;
    }
  }

  function openWelcomeModal() {
    welcomeModalOpen = true;
    const modal = document.getElementById("welcome-modal");
    const inp = document.getElementById("welcome-name-input");
    const aidEl = document.getElementById("welcome-arena-id");
    if (aidEl) aidEl.textContent = state.arenaId || "Otoscope-1000";
    if (inp) {
      inp.value = cleanDoctorName(state.userName);
      updateWelcomePreview();
    }
    if (modal) modal.classList.remove("hidden");
    setTimeout(() => { if (inp) inp.focus(); }, 60);
  }

  function closeWelcomeModal() {
    welcomeModalOpen = false;
    const modal = document.getElementById("welcome-modal");
    if (modal) modal.classList.add("hidden");
  }

  function saveWelcomeProfile() {
    const inp = document.getElementById("welcome-name-input");
    const cleaned = cleanDoctorName(inp ? inp.value : "");
    state.userName = cleaned;
    state.profileDone = true;
    saveState();
    closeWelcomeModal();
    renderDashboard();
    playTone("tr");

    const title = getDoctorDisplayTitle(false);
    if (title) {
      showToast(`Welcome aboard, ${title}!`);
    } else {
      showToast("Profile saved — study strong!");
    }

    if (!state.installSent) {
      trackStartupTelemetry();
    } else if (cleaned) {
      sendAnalyticsPing("profile", title);
    }
  }

  function skipWelcomeProfile() {
    state.profileDone = true;
    saveState();
    closeWelcomeModal();
    renderDashboard();
    if (!state.installSent) {
      trackStartupTelemetry();
    }
  }

  function launchConfetti() {
    const layer = document.getElementById("confetti-layer");
    if (!layer) return;
    layer.innerHTML = "";
    layer.classList.remove("hidden");
    const colors = ["#f59e0b", "#10b981", "#1d63dc", "#ec4899", "#eab308", "#06b6d4"];
    for (let i = 0; i < 42; i++) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.backgroundColor = colors[i % colors.length];
      piece.style.animationDelay = `${(Math.random() * 0.65).toFixed(2)}s`;
      piece.style.transform = `rotate(${Math.round(Math.random() * 360)}deg)`;
      layer.appendChild(piece);
    }
    setTimeout(() => {
      layer.classList.add("hidden");
      layer.innerHTML = "";
    }, 3100);
  }

  function unlockDoctorTitle() {
    state.drUnlocked = true;
    state.profileDone = true;
    saveState();
    renderDashboard();
    playTone("celebrate");
    launchConfetti();

    const nm = cleanDoctorName(state.userName);
    const fullDr = nm ? `Dr. ${nm}` : "Doctor";
    const oldDr = nm ? `(Dr.) ${nm}` : "(Dr.)";
    const trEl = document.getElementById("dr-unlock-transform");
    const hlEl = document.getElementById("dr-unlock-headline");
    const msgEl = document.getElementById("dr-unlock-message");
    if (trEl) {
      trEl.innerHTML = `<span class="dr-old-tag">${escapeHtml(oldDr)}</span><span class="dr-arrow">&rarr;</span><span class="dr-new-tag">${escapeHtml(fullDr)}</span>`;
    }
    if (hlEl) hlEl.textContent = `Congratulations, ${fullDr}!`;
    if (msgEl) {
      msgEl.textContent = `You didn't just pass an exam — you earned the sacred trust of every patient you will heal. Every sleepless night, every ward round, and every station you mastered removed those brackets forever. Wear "${fullDr}" with humility, courage, and pride!`;
    }

    drUnlockModalOpen = true;
    const modal = document.getElementById("dr-unlock-modal");
    if (modal) modal.classList.remove("hidden");

    sendAnalyticsPing("dr_unlocked", nm ? `Dr. ${nm}` : "Dr. (Anonymous)");
  }

  function closeDrUnlockModal() {
    drUnlockModalOpen = false;
    const modal = document.getElementById("dr-unlock-modal");
    if (modal) modal.classList.add("hidden");
  }

  function undoDoctorTitle() {
    state.drUnlocked = false;
    saveState();
    closeDrUnlockModal();
    renderDashboard();
    showToast("Brackets restored to (Dr.) — keep pushing toward Final Prof!");
    sendAnalyticsPing("dr_undo", cleanDoctorName(state.userName) || "Anonymous");
  }

  function confirmReset() {
    const keepUid = state.uid;
    const keepArenaId = state.arenaId;
    const keepInstallSent = state.installSent;
    const keepLastPing = state.lastOpenPingDay;
    const keepName = state.userName;
    const keepUnlocked = state.drUnlocked;
    const keepProfileDone = state.profileDone;
    const keepSessions = state.sessionsCount || 0;
    const keepActiveDays = state.activeDaysCount || 0;
    state = defaultState();
    state.uid = keepUid;
    state.arenaId = keepArenaId || genArenaId();
    state.installSent = keepInstallSent;
    state.lastOpenPingDay = keepLastPing;
    state.userName = keepName;
    state.drUnlocked = keepUnlocked;
    state.profileDone = keepProfileDone;
    state.sessionsCount = keepSessions;
    state.activeDaysCount = keepActiveDays;
    saveState();
    closeDialog();
    renderDashboard();
    renderArenaBanner();
    showToast("All progress reset");
  }

  // ==================== KEYBOARD & ANDROID BACK HOOK ====================
  window.handleAndroidBack = function () {
    if (drUnlockModalOpen) { closeDrUnlockModal(); return true; }
    if (welcomeModalOpen && state.profileDone) { closeWelcomeModal(); return true; }
    if (lbState.open) { closeLightbox(); return true; }
    if (dialogOpen) { closeDialog(); return true; }
    if (currentView !== "dashboard") { navigate("dashboard"); return true; }
    return false;
  };

  function initKeyboard() {
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (drUnlockModalOpen) closeDrUnlockModal();
        else if (welcomeModalOpen && state.profileDone) closeWelcomeModal();
        else if (lbState.open) closeLightbox();
        else if (dialogOpen) closeDialog();
        return;
      }
      if (currentView !== "recall" || lbState.open || dialogOpen || welcomeModalOpen || drUnlockModalOpen) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
      if (e.code === "Space") { e.preventDefault(); flipCard(); }
      else if (e.key === "1") rateCurrentCard("F");
      else if (e.key === "2") rateCurrentCard("PR");
      else if (e.key === "3") rateCurrentCard("TR");
      else if (e.key === "ArrowRight") nextCard(true);
      else if (e.key === "ArrowLeft") prevCard();
    });
  }

  // ==================== INIT ====================
  function populateStationDropdowns() {
    const opts = STATIONS.map((s) => `<option value="${s.id}">${s.code} · ${escapeHtml(s.short)}</option>`).join("");
    ["recall-station-select", "rf-station-select", "dir-station-select"].forEach((id) => {
      const sel = document.getElementById(id);
      if (sel) sel.insertAdjacentHTML("beforeend", opts);
    });
  }

  function init() {
    saveState();
    applyTheme();
    applyMuteUI();
    populateStationDropdowns();
    initMindmapInteractions();
    initLightboxInteractions();
    initKeyboard();
    renderDashboard();
    renderArenaBanner();
    startStudyTimer();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          saveState();
          flushProgressSnapshot("bg");
        }
      });
    }
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", () => {
        saveState();
        flushProgressSnapshot("pagehide");
      });
      window.addEventListener("online", flushTelemetryQueue);
    }
    if (!state.profileDone) {
      setTimeout(openWelcomeModal, 260);
    } else {
      setTimeout(trackStartupTelemetry, 1200);
    }
    if (STATS_ENDPOINT && (typeof navigator === "undefined" || navigator.onLine !== false)) {
      setTimeout(() => refreshLeaderboard(false), 2400);
    }
  }

  window.OSPE = {
    navigate,
    toggleTheme,
    toggleMute,
    openStation,
    startQuickMode,
    openWelcomeModal,
    updateWelcomePreview,
    saveWelcomeProfile,
    skipWelcomeProfile,
    unlockDoctorTitle,
    closeDrUnlockModal,
    undoDoctorTitle,
    applyRecallFilter,
    setRecallMode,
    resetRecallFilters,
    flipCard,
    nextCard,
    prevCard,
    rateCurrentCard,
    toggleCurrentStar,
    toggleTimer,
    resetTimer,
    startRapidFire,
    skipRapidFire,
    nextRapidFire,
    reviewRapidFireMissed,
    openLightboxForRapidFire,
    startStationBlitz,
    setArenaTab,
    refreshLeaderboard,
    setAudiogramTab,
    applyAudiogramPreset,
    updateBuilderSliders,
    toggleBuilderGap,
    selectDemoCase,
    answerDemoCase,
    toggleDemoHint,
    nextDemoCase,
    setMindmapMode,
    selectMindmapStation,
    flipMindmapCard,
    rateMindmapCard,
    zoomMindmap,
    fitMindmap,
    setDirectoryScope,
    setStudyStation,
    openStationStudy,
    setYearFilter,
    openYearWiseRevision,
    setDirectoryMode,
    peekDirectoryCard,
    peekYearWiseItem,
    toggleRevealAllYearWise,
    startSessionPaper,
    rateDirCard,
    openCardInRecall,
    renderDirectory,
    openLightbox,
    openLightboxForCurrent,
    toggleLightboxSide,
    zoomLightbox,
    resetLightboxZoom,
    closeLightbox,
    closeDialog,
    exportData,
    copyExportJson,
    triggerImport,
    handleImportFile,
    askReset,
    confirmReset
  };

  document.addEventListener("DOMContentLoaded", init);
})();
