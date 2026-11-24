/* =========================================================
   OSPE Recall (Surgery Paper-1) — Offline Active Recall Engine
   ========================================================= */
(function () {
  "use strict";

  const STORAGE_KEY = "ospe_recall_surg_p1_v1";

  const RANKS = [
    { level: 1, xp: 0,    name: "Surgical Clerk" },
    { level: 2, xp: 150,  name: "OT Extern" },
    { level: 3, xp: 400,  name: "Junior Intern" },
    { level: 4, xp: 800,  name: "Assistant Surgeon" },
    { level: 5, xp: 1400, name: "Surgical Registrar" },
    { level: 6, xp: 2200, name: "DU Honour Roll" },
    { level: 7, xp: 3200, name: "Chief House Surgeon" },
    { level: 8, xp: 4500, name: "Senior Fellow (FCPS)" },
    { level: 9, xp: 6500, name: "Professor of Surgery" }
  ];

  const BADGES = [
    { id: "first_flip",   ico: "\u26A1", name: "First Recall",        check: (s, d) => d.totalReps >= 1 },
    { id: "xray_hawk",    ico: "\uD83E\uDE7B", name: "Plain X-Ray Hawk",  check: (s, d) => d.stationMastery["ST-01"] >= 50 },
    { id: "contrast_pro", ico: "\uD83D\uDD2C", name: "Contrast Pro",      check: (s, d) => d.stationMastery["ST-02"] >= 50 },
    { id: "inst_master",  ico: "\uD83D\uDD2A", name: "OT Instrument Pro", check: (s, d) => d.stationMastery["ST-05"] >= 50 },
    { id: "tier1_lock",   ico: "\uD83C\uDFAF", name: "Tier-1 Hunter",     check: (s, d) => d.tier1Pct >= 50 },
    { id: "proc_ace",     ico: "\uD83E\uDE7A", name: "Checklist Ace",     check: (s, d) => d.stationMastery["ST-09"] >= 40 && d.stationMastery["ST-10"] >= 40 },
    { id: "streak_3",     ico: "\uD83D\uDD25", name: "3-Day Streak",      check: (s, d) => d.streak >= 3 },
    { id: "century_reps", ico: "\uD83C\uDFC6", name: "100+ Reps Club",    check: (s, d) => d.totalReps >= 100 }
  ];

  const STATIONS = (window.OSPE_DATA && window.OSPE_DATA.stations) || [];
  const CARDS = (window.OSPE_DATA && window.OSPE_DATA.cards) || [];
  const PYQ_SESSIONS = (window.OSPE_DATA && window.OSPE_DATA.pyqSessions) || [];
  const CARD_MAP = new Map(CARDS.map((c) => [c.id, c]));

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

  // ==================== ANONYMOUS TELEMETRY & BLITZ LEADERBOARD ====================
  const STATS_ENDPOINT = "https://script.google.com/macros/s/AKfycbwGwKo3qlTXaMKAnorypveTIm4ZBnSLVNAjHRDPjf0X9FYROLAVhJ9uEGMk4MDMvEoowA/exec";
  const APP_VERSION = "2.0.0";
  const TELEMETRY_QUEUE_MAX = 25;
  const sessionLoggedViews = new Set();
  const sessionLoggedStations = new Set();
  const sessionLoggedPyqYears = new Set();
  let sessionCounted = false;

  const SURGICAL_HALLS = [
    { hall: 1, min: 0,    ico: "⛺", name: "Hall 1 · Ward Tent",         perk: "Entry Novice Tier · Master Station basics" },
    { hall: 2, min: 60,   ico: "🩹", name: "Hall 2 · Dressing Bay",       perk: "Bandage & Asepsis Challenger" },
    { hall: 3, min: 140,  ico: "✂️", name: "Hall 3 · Minor OT",           perk: "Haemostat & Instrument Spotter" },
    { hall: 4, min: 240,  ico: "🧤", name: "Hall 4 · Scrub Citadel",      perk: "Unlocked 60% Sterility Accuracy Title" },
    { hall: 5, min: 380,  ico: "🚑", name: "Hall 5 · Trauma Keep",        perk: "ATLS Shock & Fracture Defender" },
    { hall: 6, min: 560,  ico: "🔭", name: "Hall 6 · Laparoscopy Vault",  perk: "Minimally Invasive Specialist" },
    { hall: 7, min: 780,  ico: "🩻", name: "Hall 7 · Surgical Fortress",  perk: "Radiology & Contrast Read Master" },
    { hall: 8, min: 1050, ico: "⚔️", name: "Hall 8 · Registrar Bastion",  perk: "Tier-1 / Tier-2 Viva Champion" },
    { hall: 9, min: 1380, ico: "👑", name: "Hall 9 · Fellow Sanctum",     perk: "DU Honours Final Prof Contender" },
    { hall: 10, min: 1800, ico: "🏰", name: "Hall 10 · Professor's Citadel", perk: "Supreme Surgery OSPE Grandmaster" }
  ];

  const ARENA_PREFIXES = ["Scalpel", "Forceps", "Retractor", "Suture", "Trocar", "Hemostat", "Bistoury", "Clamp", "Stent", "Lumen"];

  function genAnonId() {
    return "u_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function genArenaId() {
    const p = ARENA_PREFIXES[Math.floor(Math.random() * ARENA_PREFIXES.length)];
    const num = String(1000 + Math.floor(Math.random() * 9000));
    return `${p}-${num}`;
  }

  function getHallForTrophies(trp) {
    let cur = SURGICAL_HALLS[0];
    let next = SURGICAL_HALLS[1] || null;
    for (let i = 0; i < SURGICAL_HALLS.length; i++) {
      if (trp >= SURGICAL_HALLS[i].min) {
        cur = SURGICAL_HALLS[i];
        next = SURGICAL_HALLS[i + 1] || null;
      }
    }
    return { cur, next };
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
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
  }

  function cleanDoctorName(raw) {
    let s = String(raw || "").trim().replace(/\s+/g, " ");
    s = s.replace(/^\(?\s*dr\.?\s*\)?\s*/i, "").trim();
    return s.slice(0, 28);
  }

  function getDoctorDisplayTitle(includeFallback = false) {
    const nm = cleanDoctorName(state.userName);
    if (state.drUnlocked) return nm ? `Dr. ${nm}` : (includeFallback ? "Dr." : "");
    if (nm) return `(Dr.) ${nm}`;
    return includeFallback ? "(Dr.) Aspiring Surgeon" : "";
  }

  function countUnlockedBadges(m) {
    let cnt = 0;
    for (let i = 0; i < BADGES.length; i++) if (BADGES[i].check(state, m)) cnt++;
    return cnt;
  }

  function buildSnapshotParams(includeFull = true) {
    const base = {
      uid: state.uid,
      aid: state.arenaId || "",
      nm: getDoctorDisplayTitle(false) || "Anonymous",
      dr: state.drUnlocked ? "1" : "0",
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
    let topSt = "", wkSt = "", bestPct = -1, worstPct = 101;
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
    const b = state.blitz || {};
    const hallInfo = getHallForTrophies(b.trophies || 0).cur;
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
      trp: String(b.trophies || 0),
      hall: String(hallInfo.hall),
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
    if (!state.pendingCardDeltas || typeof state.pendingCardDeltas !== "object") state.pendingCardDeltas = {};
    if (!state.pendingCardDeltas[cardId]) state.pendingCardDeltas[cardId] = { tr: 0, pr: 0, f: 0, rfc: 0, rfm: 0 };
    if (Object.prototype.hasOwnProperty.call(state.pendingCardDeltas[cardId], field)) state.pendingCardDeltas[cardId][field] += 1;
  }

  function encodeCardDeltas(maxItems = 10) {
    const map = state.pendingCardDeltas || {};
    const keys = Object.keys(map);
    if (!keys.length) return "";
    const packed = [];
    let totalChars = 0;
    for (let i = 0; i < keys.length && packed.length < maxItems; i++) {
      const cid = keys[i], d = map[cid];
      if (!d || (d.tr + d.pr + d.f + d.rfc + d.rfm) === 0) { delete map[cid]; continue; }
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
    fetch(`${STATS_ENDPOINT}?${qsStr}`, { method: "GET", mode: "no-cors", keepalive: true })
      .then(() => { if (typeof onDone === "function") onDone(); })
      .catch(() => {});
  }

  function sendAnalyticsPing(ev, detail, extraParams = {}, options = {}) {
    try {
      if (!STATS_ENDPOINT) return;
      if (typeof extraParams === "function") { options = { onDone: extraParams }; extraParams = {}; }
      const includeFull = options.full !== false;
      const snap = buildSnapshotParams(includeFull);
      const payload = Object.assign(snap, { ev: ev, d: detail || "" }, extraParams || {});
      Object.keys(payload).forEach((k) => {
        if (payload[k] === undefined || payload[k] === null || payload[k] === "") {
          if (k !== "d") delete payload[k];
        }
      });
      enqueueOrSend(new URLSearchParams(payload).toString(), options.onDone);
    } catch { /* silent offline fallback */ }
  }

  function flushTelemetryQueue() {
    try {
      if (!STATS_ENDPOINT || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
      if (!Array.isArray(state.telemetryQueue) || !state.telemetryQueue.length) return;
      const batch = state.telemetryQueue.splice(0, state.telemetryQueue.length);
      saveState();
      batch.forEach((qsStr, idx) => setTimeout(() => enqueueOrSend(qsStr), idx * 400));
    } catch { /* silent offline fallback */ }
  }

  function flushProgressSnapshot(reason = "sync") {
    try {
      const curMins = Math.floor((state.totalStudySec || 0) / 60);
      const unsyncedReps = Math.max(0, (state.totalReps || 0) - (state.syncedReps || 0));
      const unsyncedMins = Math.max(0, curMins - (state.syncedStudyMins || 0));
      const hasDeltas = Object.keys(state.pendingCardDeltas || {}).length > 0;
      if (!unsyncedReps && unsyncedMins < 1 && !hasDeltas) return;
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
      if (Math.floor(state.totalStudySec / 60) - (state.syncedStudyMins || 0) >= 5) {
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
        onDone: () => { state.installSent = true; state.lastOpenPingDay = todayKey(0); saveState(); }
      });
    } else if (state.lastOpenPingDay !== todayKey(0)) {
      state.activeDaysCount = (state.activeDaysCount || 0) + 1;
      saveState();
      sendAnalyticsPing("open", who, {}, {
        full: true,
        onDone: () => { state.lastOpenPingDay = todayKey(0); saveState(); }
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
      totalReps: 0,
      activeDaysCount: 1,
      sessionsCount: 0,
      totalStudySec: 0,
      syncedReps: 0,
      syncedStudyMins: 0,
      pendingCardDeltas: {},
      telemetryQueue: [],
      blitz: {
        trophies: 0,
        bestScore: 0,
        totalCorrect: 0,
        totalWrong: 0,
        rounds: 0,
        bestAcc: 0,
        highestHall: 1
      }
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
      merged.blitz = Object.assign(defaultState().blitz, (parsed && parsed.blitz) || {});
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
    if (rating === "TR") queueCardDelta(cardId, "tr");
    else if (rating === "PR") queueCardDelta(cardId, "pr");
    else queueCardDelta(cardId, "f");
    state.xp += xpGain;
    state.totalReps += 1;
    const tk = todayKey(0);
    state.dailyActivity[tk] = (state.dailyActivity[tk] || 0) + 1;
    saveState();

    const newRank = getRankForXP(state.xp).cur;
    updateHeaderXP();
    if (newRank.level > prevLevel) {
      playTone("rank");
      showDialog("RANK PROMOTION!", `Level ${newRank.level}: ${newRank.name}`, `Congratulations! You reached ${state.xp} XP. Keep drilling high-yield DU Surgery Paper-1 OSPE locks.`);
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
      if (arenaTab === "halls") renderSurgicalHalls();
      else if (arenaTab === "board") renderLeaderboardPanel();
      if (!rfState.questions.length) {
        startRapidFire();
      } else if (!rfState.answered && rfState.idx < rfState.questions.length && document.getElementById("rf-blitz-timer").checked && !rfState.blitzHandle) {
        startRapidFireBlitzTick(rfState.questions[rfState.idx]);
      }
    }
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
              <button class="st-mini-btn" onclick="event.stopPropagation(); OSPE.openStationStudy('${s.id}')">Study All Topic Notes</button>
              <button class="st-mini-btn" onclick="event.stopPropagation(); OSPE.startStationBlitz('${s.id}')">&#9889; 30s Blitz</button>
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

  // ==================== VIEW 3: BLITZ TOURNAMENT ARENA, HALLS & LEADERBOARD ====================
  let arenaTab = "exam";
  let liveLeaderboardRows = null;
  let lbFetching = false;

  const rfState = {
    questions: [],
    idx: 0,
    score: 0,
    wrong: 0,
    streak: 0,
    xpEarned: 0,
    roundTrophyDelta: 0,
    speedHits: 0,
    answered: false,
    missedCardIds: [],
    blitzSeconds: 30,
    blitzHandle: null
  };

  function getCareerAccuracy() {
    const b = state.blitz || {};
    const tot = (b.totalCorrect || 0) + (b.totalWrong || 0);
    return tot ? Math.round(((b.totalCorrect || 0) / tot) * 100) : 0;
  }

  function renderArenaBanner() {
    const b = state.blitz || {};
    const trp = b.trophies || 0;
    const hall = getHallForTrophies(trp).cur;
    const idEl = document.getElementById("arena-id-badge");
    const hallEl = document.getElementById("arena-hall-badge");
    const trpEl = document.getElementById("arena-trophies-val");
    const accEl = document.getElementById("arena-acc-val");
    const rndEl = document.getElementById("arena-rounds-val");
    const poolEl = document.getElementById("arena-pool-pill");
    if (idEl) idEl.textContent = state.arenaId || genArenaId();
    if (hallEl) hallEl.textContent = `${hall.ico} ${hall.name}`;
    if (trpEl) trpEl.textContent = `${trp} 🏆`;
    if (accEl) accEl.textContent = `${getCareerAccuracy()}%`;
    if (rndEl) rndEl.textContent = String(b.rounds || 0);
    if (poolEl) {
      const totalQ = CARDS.reduce((s, c) => s + ((c.rapidFire || []).length), 0);
      poolEl.textContent = `${totalQ} Viva & OSPE MCQs`;
    }
  }

  function setArenaTab(tab) {
    arenaTab = tab;
    document.getElementById("arena-tab-exam").classList.toggle("active", tab === "exam");
    document.getElementById("arena-tab-halls").classList.toggle("active", tab === "halls");
    document.getElementById("arena-tab-board").classList.toggle("active", tab === "board");
    document.getElementById("blitz-exam-panel").classList.toggle("hidden", tab !== "exam");
    document.getElementById("blitz-halls-panel").classList.toggle("hidden", tab !== "halls");
    document.getElementById("blitz-leaderboard-panel").classList.toggle("hidden", tab !== "board");
    if (tab !== "exam") clearInterval(rfState.blitzHandle);
    if (tab === "halls") renderSurgicalHalls();
    if (tab === "board") {
      renderLeaderboardPanel();
      fetchBlitzLeaderboard();
    }
  }

  function renderSurgicalHalls() {
    const b = state.blitz || {};
    const trp = b.trophies || 0;
    const curHall = getHallForTrophies(trp).cur;
    const sumEl = document.getElementById("halls-progress-summary");
    const barEl = document.getElementById("halls-progress-bar");
    if (sumEl) sumEl.textContent = `${trp} / 1800 🏆`;
    if (barEl) barEl.style.width = `${Math.min(100, Math.round((trp / 1800) * 100))}%`;

    const grid = document.getElementById("blitz-halls-grid");
    if (!grid) return;
    grid.innerHTML = SURGICAL_HALLS.map((h) => {
      const unlocked = trp >= h.min;
      const isCur = curHall.hall === h.hall;
      return `
        <div class="hall-card ${isCur ? "current" : unlocked ? "unlocked" : ""}">
          <div class="hall-top">
            <span>${h.ico} Hall ${h.hall}</span>
            <span>${isCur ? "ACTIVE HALL" : unlocked ? "✓ UNLOCKED" : `Need ${h.min} 🏆`}</span>
          </div>
          <div class="hall-title">${escapeHtml(h.name.replace(/^Hall \d+ · /, ""))}</div>
          <div class="hall-perk">${escapeHtml(h.perk)}</div>
        </div>
      `;
    }).join("");
  }

  function getSoloBenchmarkRows() {
    return [
      { arenaId: "Bench-Prof-01", trophies: 1620, hall: 9, bestAcc: 92, rounds: 18 },
      { arenaId: "Bench-Reg-02",  trophies: 920,  hall: 7, bestAcc: 85, rounds: 12 },
      { arenaId: "Bench-Trauma3", trophies: 480,  hall: 5, bestAcc: 78, rounds: 8 },
      { arenaId: "Bench-Intern4", trophies: 190,  hall: 3, bestAcc: 70, rounds: 4 },
      { arenaId: "Bench-Ward-05", trophies: 55,   hall: 1, bestAcc: 60, rounds: 2 }
    ];
  }

  function renderLeaderboardPanel() {
    const tbody = document.getElementById("lb-tbody");
    const stTxt = document.getElementById("lb-status-text");
    if (!tbody) return;
    const b = state.blitz || {};
    const myHall = getHallForTrophies(b.trophies || 0).cur.hall;
    const myRow = {
      arenaId: state.arenaId || genArenaId(),
      trophies: b.trophies || 0,
      hall: myHall,
      bestAcc: b.bestAcc || state.rfBestAcc || 0,
      rounds: b.rounds || 0,
      isYou: true
    };

    const merged = new Map();
    const sourceRows = (Array.isArray(liveLeaderboardRows) && liveLeaderboardRows.length) ? liveLeaderboardRows : [];
    sourceRows.forEach((r) => {
      const aid = String(r.arenaId || "").trim();
      if (!aid) return;
      merged.set(aid, {
        arenaId: aid,
        trophies: Number(r.trophies) || 0,
        hall: Number(r.hall) || getHallForTrophies(Number(r.trophies) || 0).cur.hall,
        bestAcc: Number(r.bestAcc) || 0,
        rounds: Number(r.rounds) || 0,
        isYou: aid === myRow.arenaId
      });
    });

    const otherRealCount = Array.from(merged.keys()).filter((k) => k !== myRow.arenaId && !String(k).startsWith("Bench-")).length;
    if (otherRealCount === 0) {
      getSoloBenchmarkRows().forEach((br) => {
        if (!merged.has(br.arenaId)) merged.set(br.arenaId, br);
      });
    }
    const existingYou = merged.get(myRow.arenaId);
    if (!existingYou || myRow.trophies >= existingYou.trophies) {
      merged.set(myRow.arenaId, myRow);
    } else {
      existingYou.isYou = true;
    }

    const sorted = Array.from(merged.values()).sort((a, bRow) => (bRow.trophies - a.trophies) || (bRow.bestAcc - a.bestAcc));
    if (stTxt) {
      stTxt.textContent = otherRealCount > 0
        ? `Live Global Board (${otherRealCount + 1} real contestants synced) · Your Callsign: ${myRow.arenaId}`
        : (sourceRows.length
          ? `Live Board Connected · Synced ${myRow.arenaId} (Waiting for other classmates' first Blitz sync)`
          : `Offline Solo League Benchmark + Your Score (${myRow.arenaId}) — Connect online to sync.`);
    }

    tbody.innerHTML = sorted.slice(0, 50).map((r, i) => {
      const hObj = SURGICAL_HALLS[Math.max(0, Math.min(SURGICAL_HALLS.length - 1, (r.hall || 1) - 1))];
      return `
        <tr class="lb-row ${r.isYou ? "is-you" : ""}">
          <td>#${i + 1}</td>
          <td><strong>${escapeHtml(r.arenaId)}</strong>${r.isYou ? '<span class="lb-you-tag">YOU</span>' : (String(r.arenaId).startsWith("Bench-") ? ' <span class="muted small">(League Rival)</span>' : "")}</td>
          <td>${hObj.ico} Hall ${hObj.hall}</td>
          <td>${r.bestAcc}%</td>
          <td>${r.rounds}</td>
          <td><strong>${r.trophies} 🏆</strong></td>
        </tr>
      `;
    }).join("");
  }

  function loadLeaderboardJson(baseUrl, onSuccess, onFail) {
    const handlePayload = (data) => {
      const list = Array.isArray(data && data.rows) ? data.rows : (Array.isArray(data && data.entries) ? data.entries : null);
      if (list) {
        onSuccess(list);
        return true;
      }
      return false;
    };

    const jsonpFallback = () => {
      if (typeof document === "undefined") { onFail(); return; }
      const cbName = "__ospeLbCb_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
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

  function fetchBlitzLeaderboard() {
    if (lbFetching || !STATS_ENDPOINT) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    lbFetching = true;
    const b = state.blitz || {};
    const trp = b.trophies || 0;
    const hallInfo = getHallForTrophies(trp).cur;
    const qs = new URLSearchParams({
      action: "leaderboard",
      limit: "50",
      uid: state.uid || "",
      aid: state.arenaId || genArenaId(),
      nm: getDoctorDisplayTitle(false) || "Anonymous",
      trp: String(trp),
      hall: String(hallInfo.hall),
      ht: hallInfo.name,
      acc: String(Math.max(b.bestAcc || 0, getCareerAccuracy())),
      rnd: String(b.rounds || 0),
      pf: getPlatformTag(),
      _: String(Date.now())
    });
    const url = `${STATS_ENDPOINT}?${qs.toString()}`;
    loadLeaderboardJson(
      url,
      (list) => {
        lbFetching = false;
        liveLeaderboardRows = list;
        renderLeaderboardPanel();
      },
      () => {
        lbFetching = false;
      }
    );
  }

  function refreshLeaderboard() {
    showToast("Refreshing global Blitz leaderboard...");
    fetchBlitzLeaderboard();
    renderLeaderboardPanel();
  }

  function startStationBlitz(stationId) {
    setArenaTab("exam");
    const stSel = document.getElementById("rf-station-select");
    const focusSel = document.getElementById("rf-focus-select");
    if (stSel) stSel.value = stationId || "ALL";
    if (focusSel) focusSel.value = "ALL";
    navigate("rapidfire");
    startRapidFire();
  }

  function startRapidFire() {
    clearInterval(rfState.blitzHandle);
    renderArenaBanner();
    const st = document.getElementById("rf-station-select").value;
    const focusSel = document.getElementById("rf-focus-select");
    const focus = focusSel ? focusSel.value : "ALL";
    const countVal = document.getElementById("rf-count-select").value;

    const pool = [];
    CARDS.forEach((c) => {
      if (st !== "ALL" && c.station !== st) return;
      if (focus === "HIGH_YIELD" && c.pyqTier === "TIER-3") return;
      if (focus === "INST_VIVA" && !["ST-05", "ST-06", "ST-09", "ST-10"].includes(c.station) && !String((c.rapidFire || []).map((x) => x.prompt).join(" ")).toLowerCase().includes("viva")) return;
      (c.rapidFire || []).forEach((q) => pool.push({ card: c, q }));
    });

    const fallbackPool = [];
    if (!pool.length) CARDS.forEach((c) => (c.rapidFire || []).forEach((q) => fallbackPool.push({ card: c, q })));
    const shuffled = shuffleArray(pool.length ? pool : fallbackPool);
    const limit = countVal === "ALL" ? shuffled.length : Math.min(shuffled.length, parseInt(countVal, 10) || 20);
    rfState.questions = shuffled.slice(0, limit);
    rfState.idx = 0;
    rfState.score = 0;
    rfState.wrong = 0;
    rfState.streak = 0;
    rfState.xpEarned = 0;
    rfState.roundTrophyDelta = 0;
    rfState.speedHits = 0;
    rfState.missedCardIds = [];

    document.getElementById("rf-summary-card").classList.add("hidden");
    document.getElementById("rf-arena-card").classList.remove("hidden");
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

    document.getElementById("rf-progress-pill").textContent = `Q ${rfState.idx + 1} / ${rfState.questions.length}`;
    document.getElementById("rf-score-pill").textContent = `Correct: ${rfState.score} · Trophy: ${rfState.roundTrophyDelta >= 0 ? "+" : ""}${rfState.roundTrophyDelta} · Streak: ${rfState.streak}`;
    document.getElementById("rf-img").src = imgSrc(c.frontImage);
    document.getElementById("rf-card-station").textContent = `${c.station} · ${c.pyqTier}`;
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

    document.querySelectorAll("#rf-options-list .rf-opt-btn").forEach((b) => {
      b.disabled = true;
      if (b.dataset.correct === "1") b.classList.add("is-correct");
    });

    const fb = document.getElementById("rf-feedback-box");
    fb.classList.remove("hidden", "fb-ok", "fb-err");

    if (isCorrect) {
      rfState.score += 1;
      rfState.streak += 1;
      rfState.xpEarned += 25;
      const isFast = document.getElementById("rf-blitz-timer").checked && rfState.blitzSeconds >= 18;
      if (isFast) rfState.speedHits += 1;
      rfState.roundTrophyDelta += isFast ? 15 : 12;
      playTone("tr");
      queueCardDelta(item.card.id, "rfc");
      recordRating(item.card.id, "TR", 25);
      fb.classList.add("fb-ok");
      fb.innerHTML = `<strong>Correct! +${isFast ? "15 🏆 (Fast!)" : "12 🏆"} · ${escapeHtml(item.card.diagnosis)}</strong><br/>${escapeHtml(item.q.explanation)}`;
    } else {
      if (clickedBtn) clickedBtn.classList.add("is-wrong");
      rfState.wrong += 1;
      rfState.streak = 0;
      rfState.xpEarned += 5;
      rfState.roundTrophyDelta -= 5;
      if (!rfState.missedCardIds.includes(item.card.id)) rfState.missedCardIds.push(item.card.id);
      playTone("f");
      queueCardDelta(item.card.id, "rfm");
      recordRating(item.card.id, "F", 5);
      fb.classList.add("fb-err");
      fb.innerHTML = `<strong>${timedOut ? "Time's Up!" : "Incorrect!"} (-5 🏆) · ${escapeHtml(item.card.diagnosis)}</strong><br/>${escapeHtml(item.q.explanation)}`;
    }

    document.getElementById("rf-score-pill").textContent = `Correct: ${rfState.score} · Trophy: ${rfState.roundTrophyDelta >= 0 ? "+" : ""}${rfState.roundTrophyDelta} · Streak: ${rfState.streak}`;
    document.getElementById("rf-skip-btn").classList.add("hidden");
    document.getElementById("rf-next-btn").classList.remove("hidden");

    const answeredNow = rfState.score + rfState.wrong;
    if (answeredNow === 1 || answeredNow % 2 === 0) {
      const b = state.blitz || {};
      const liveTrp = Math.max(0, (b.trophies || 0) + rfState.roundTrophyDelta);
      const liveHall = getHallForTrophies(liveTrp).cur;
      const liveAcc = Math.round((rfState.score / Math.max(1, answeredNow)) * 100);
      sendAnalyticsPing("blitz_sync", "mid", {
        aid: state.arenaId,
        trp: String(liveTrp),
        hall: String(liveHall.hall),
        ht: liveHall.name,
        acc: String(Math.max(b.bestAcc || 0, liveAcc)),
        rnd: String(Math.max(1, b.rounds || 0)),
        v1: String(liveAcc)
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

    const answeredTotal = Math.max(1, rfState.score + rfState.wrong);
    const total = rfState.questions.length || 1;
    const acc = Math.round((rfState.score / total) * 100);
    if (acc > state.rfBestAcc) state.rfBestAcc = acc;
    state.rfCompletedCount = (state.rfCompletedCount || 0) + 1;

    if (acc >= 80) rfState.roundTrophyDelta += 15;
    if (!state.blitz) state.blitz = defaultState().blitz;
    const prevHall = getHallForTrophies(state.blitz.trophies || 0).cur.hall;
    const newTrophies = Math.max(0, (state.blitz.trophies || 0) + rfState.roundTrophyDelta);
    const appliedDelta = newTrophies - (state.blitz.trophies || 0);
    state.blitz.trophies = newTrophies;
    state.blitz.totalCorrect = (state.blitz.totalCorrect || 0) + rfState.score;
    state.blitz.totalWrong = (state.blitz.totalWrong || 0) + rfState.wrong;
    state.blitz.rounds = (state.blitz.rounds || 0) + 1;
    if (acc > (state.blitz.bestAcc || 0)) state.blitz.bestAcc = acc;
    if (rfState.score > (state.blitz.bestScore || 0)) state.blitz.bestScore = rfState.score;
    const newHallObj = getHallForTrophies(newTrophies).cur;
    if (newHallObj.hall > (state.blitz.highestHall || 1)) state.blitz.highestHall = newHallObj.hall;
    saveState();

    document.getElementById("rf-sum-title").textContent = acc >= 80 ? "Distinctive Mastery!" : acc >= 50 ? "Solid Ward Recall" : "Keep Drilling Weak Stations";
    document.getElementById("rf-sum-acc").textContent = `${acc}%`;
    document.getElementById("rf-sum-correct").textContent = `${rfState.score} ✓ / ${rfState.wrong} ✗`;
    document.getElementById("rf-sum-xp").textContent = `+${rfState.xpEarned} XP`;
    const trophyEl = document.getElementById("rf-sum-trophy-msg");
    if (trophyEl) {
      trophyEl.textContent = `${appliedDelta >= 0 ? "+" : ""}${appliedDelta} Trophies (Total: ${newTrophies} 🏆) · ${newHallObj.ico} ${newHallObj.name}`;
    }

    const reviewBtn = document.getElementById("rf-review-missed-btn");
    reviewBtn.classList.toggle("hidden", rfState.missedCardIds.length === 0);
    renderArenaBanner();

    if (newHallObj.hall > prevHall) {
      playTone("celebrate");
      launchConfetti();
      showDialog("SURGICAL HALL UNLOCKED!", `${newHallObj.ico} ${newHallObj.name}`, `You reached ${newTrophies} Trophies! Unlocked: ${newHallObj.perk}`);
    }

    const stFilter = document.getElementById("rf-station-select").value;
    const focusVal = (document.getElementById("rf-focus-select") || {}).value || "ALL";
    const cd = STATS_ENDPOINT ? encodeCardDeltas(10) : "";
    const extra = {
      aid: state.arenaId,
      trp: String(newTrophies),
      hall: String(newHallObj.hall),
      ht: newHallObj.name,
      acc: String(state.blitz.bestAcc),
      cacc: String(getCareerAccuracy()),
      cor: String(state.blitz.totalCorrect),
      wrg: String(state.blitz.totalWrong),
      rnd: String(state.blitz.rounds),
      bscr: String(state.blitz.bestScore),
      v1: String(acc),
      v2: `${rfState.score}/${rfState.questions.length}`,
      m: `${focusVal}|${answeredTotal}`
    };
    if (cd) extra.cd = cd;
    sendAnalyticsPing("blitz_score", stFilter, extra, { full: true });
    setTimeout(fetchBlitzLeaderboard, 900);
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
    openLightbox(item.card.id, "front");
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
          <h3>OSPE Recall (Surgery P1)</h3>
          <span>All 10 DU Final Prof Stations · High-Yield Tree</span>
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

  // ==================== VIEW 5: REVISION DIRECTORY, STUDY PACK & YEAR-WISE ARCHIVE ====================
  let dirMode = "revision";
  let dirScope = "topic";
  let dirYearFilter = "2026";
  let studyStationId = "ST-01";
  const dirRevealed = new Set();
  const ywRevealed = new Set();

  function setDirectoryScope(scope) {
    dirScope = scope;
    document.getElementById("dir-scope-topic").classList.toggle("active", scope === "topic");
    document.getElementById("dir-scope-study").classList.toggle("active", scope === "study");
    document.getElementById("dir-scope-year").classList.toggle("active", scope === "yearwise");

    const isTopic = scope === "topic";
    const isStudy = scope === "study";
    const isYear = scope === "yearwise";
    document.getElementById("dir-station-select").classList.toggle("hidden", !isTopic);
    document.getElementById("dir-status-select").classList.toggle("hidden", isYear);
    document.getElementById("yw-subject-select").classList.toggle("hidden", !isYear);
    document.getElementById("yw-year-pills").classList.toggle("hidden", !isYear);
    document.getElementById("study-station-pills").classList.toggle("hidden", !isStudy);
    const modeGrp = document.getElementById("dir-mode-group");
    if (modeGrp) modeGrp.classList.toggle("hidden", isStudy);

    if ((isYear || isStudy) && !sessionLoggedViews.has(scope)) {
      sessionLoggedViews.add(scope);
      sendAnalyticsPing("view", scope);
    }
    renderYearPills();
    renderStudyStationPills();
    renderDirectory();
  }

  function renderStudyStationPills() {
    const el = document.getElementById("study-station-pills");
    if (!el) return;
    el.innerHTML = STATIONS.map((s) => `
      <button class="study-st-pill ${studyStationId === s.id ? "active" : ""}" onclick="OSPE.setStudyStation('${s.id}')">${s.code} · ${escapeHtml(s.short)}</button>
    `).join("");
  }

  function setStudyStation(stId) {
    studyStationId = stId || "ST-01";
    sendAnalyticsPing("study_station", studyStationId);
    renderStudyStationPills();
    renderDirectory();
  }

  function openStationStudy(stId) {
    studyStationId = stId || "ST-01";
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
      const status = document.getElementById("dir-status-select").value;
      const stObj = STATIONS.find((s) => s.id === studyStationId) || STATIONS[0];
      const stCards = CARDS.filter((c) => {
        if (c.station !== stObj.id) return false;
        const dom = getCardStats(c.id).dominant;
        if (status === "TIER1" && c.pyqTier !== "TIER-1") return false;
        if (status === "TIER2" && c.pyqTier !== "TIER-2") return false;
        if (status === "STAR" && !isStarred(c)) return false;
        if (["F", "PR", "TR", "NEW"].includes(status) && dom !== status) return false;
        if (q) {
          const hay = [c.diagnosis, c.scenario, c.pearl, ...(c.pyqSessions || []), ...(c.answers || []).flatMap((a) => [a.q, ...a.bullets])].join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      grid.className = "study-pack-wrap";
      document.getElementById("dir-count-label").textContent = `Station Study Pack · ${stObj.code} (${stCards.length} Topics Complete & Untruncated)`;
      const headHtml = `
        <div class="study-pack-head card-surface">
          <div>
            <span class="pill" style="background:${stObj.color};color:#fff;">${stObj.code} · COMPLETE REVISION PACK</span>
            <h3>${escapeHtml(stObj.name)}</h3>
            <span class="small muted">${escapeHtml(stObj.desc)} · All images, Q&amp;As, and Viva Pearls open for rapid pre-exam mastery.</span>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-sm btn-primary" onclick="OSPE.openStation('${stObj.id}')">Practice Station in Recall &rarr;</button>
            <button class="btn btn-sm btn-outline-accent" onclick="OSPE.startStationBlitz('${stObj.id}')">&#9889; Station 30s Blitz</button>
          </div>
        </div>
      `;
      const bodyHtml = stCards.map((c, idx) => {
        const stats = getCardStats(c.id);
        const pyqStr = (c.pyqSessions || []).map((p) => `<span class="pill pill-pyq">${escapeHtml(p)}</span>`).join("");
        const qaHtml = (c.answers || []).map((a) => `
          <div class="study-qa-block">
            <strong>${escapeHtml(a.q)}</strong>
            <ul>${(a.bullets || []).map((b) => `<li>${fmtText(b)}</li>`).join("")}</ul>
          </div>
        `).join("");
        return `
          <div class="study-card-full card-surface dom-${stats.dominant.toLowerCase()}">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div class="meta-badges">
                <span class="pill">${c.station} #${idx + 1}</span>
                <span class="pill ${c.pyqTier === "TIER-1" ? "pill-tier1" : c.pyqTier === "TIER-2" ? "pill-tier2" : ""}">${c.pyqTier}</span>
                ${pyqStr}
              </div>
              <div class="dir-rate-mini">
                <span class="dom-badge is-${stats.dominant.toLowerCase()}">${stats.dominant}</span>
                <button class="mm-r-btn mm-r-f" style="padding:4px 9px;" onclick="OSPE.rateDirCard('${c.id}','F')">F</button>
                <button class="mm-r-btn mm-r-pr" style="padding:4px 9px;" onclick="OSPE.rateDirCard('${c.id}','PR')">PR</button>
                <button class="mm-r-btn mm-r-tr" style="padding:4px 9px;" onclick="OSPE.rateDirCard('${c.id}','TR')">TR</button>
              </div>
            </div>
            <h3 class="dir-dx" style="margin:0;">${escapeHtml(c.diagnosis)}</h3>
            <div class="muted small">${escapeHtml(c.scenario)}</div>
            <div class="study-card-grid">
              <div class="study-img-stack">
                <img class="study-main-img" src="${imgSrc(c.frontImage)}" alt="${escapeHtml(c.diagnosis)}" onclick="OSPE.openLightbox('${c.id}','front')" />
                ${c.backImage ? `<div class="study-back-thumb" onclick="OSPE.openLightbox('${c.id}','back')"><img src="${imgSrc(c.backImage)}" alt="Guide" /><span>Annotated / Comparison Guide (Tap Zoom)</span></div>` : ""}
              </div>
              <div class="study-qa-list">
                ${qaHtml}
                <div class="pearl-callout" style="margin-top:4px;">
                  <div class="pearl-label">DU EXAMINER VIVA PEARL</div>
                  <div>${fmtText(c.pearl)}</div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");
      grid.innerHTML = headHtml + (bodyHtml || `<div class="card-surface empty-state"><h3>No matching cards in ${stObj.code}</h3></div>`);
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
            const hay = [sess.label, String(sess.year), it.subject, `station ${it.stationNo}`, ...(it.askedQuestions || []), c.diagnosis, c.scenario, c.pearl, ...(c.answers || []).flatMap((a) => [a.q, ...a.bullets])].join(" ").toLowerCase();
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
          const hasOrigBadge = Boolean(it.origImage || c.origFrontImage);
          const lbTitle = `${sess.label} · Station ${stNum} — Original Exam Pic`;
          const askedHtml = (it.askedQuestions || []).map((aq) => `<li>${escapeHtml(aq)}</li>`).join("");
          const ansHtml = (c.answers || []).map((a) => `<div style="margin-bottom:6px;"><strong>${escapeHtml(a.q)}</strong><ul>${(a.bullets || []).map((b) => `<li>${fmtText(b)}</li>`).join("")}</ul></div>`).join("");

          return `
            <div class="dir-card card-surface dom-${stats.dominant.toLowerCase()}">
              <div class="dir-card-head">
                <img class="dir-thumb" src="${imgSrc(ywImg)}" alt="Station ${stNum}" onclick="OSPE.openLightbox('${c.id}','front','${escapeHtml(ywImg)}','${escapeHtml(lbTitle)}')" />
                <div style="min-width:0; flex:1;">
                  <div class="meta-badges">
                    <span class="yw-station-tag">Station ${stNum} · ${escapeHtml(it.subject)}</span>
                    <span class="pill ${c.pyqTier === "TIER-1" ? "pill-tier1" : c.pyqTier === "TIER-2" ? "pill-tier2" : ""}">${c.pyqTier}</span>
                    ${hasOrigBadge ? '<span class="pill" style="background:rgba(15,41,74,0.08);font-size:0.68rem;">Original Exam Pic</span>' : ""}
                    <span class="dom-badge is-${stats.dominant.toLowerCase()}" style="margin-left:auto;">${stats.dominant}</span>
                  </div>
                  <h3 class="dir-dx dir-spoiler ${masked ? "masked" : ""}">${escapeHtml(c.diagnosis)}</h3>
                  <div class="small muted">${escapeHtml(c.station)} · ${escapeHtml(c.stationShort)}</div>
                </div>
              </div>
              <div class="yw-asked-box">
                <div class="yw-asked-lbl">DU Asked Questions (6 Marks):</div>
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
                  <button class="mm-r-btn mm-r-f" style="padding:4px 9px;" onclick="OSPE.rateDirCard('${c.id}','F')">F</button>
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
            <div class="dir-grid">${cardsHtml}</div>
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

    if (toggleBtn) toggleBtn.classList.add("hidden");
    grid.className = "dir-grid";
    const st = document.getElementById("dir-station-select").value;
    const status = document.getElementById("dir-status-select").value;
    const filtered = CARDS.filter((c) => {
      if (st !== "ALL" && c.station !== st) return false;
      const dom = getCardStats(c.id).dominant;
      if (status === "TIER1" && c.pyqTier !== "TIER-1") return false;
      if (status === "TIER2" && c.pyqTier !== "TIER-2") return false;
      if (status === "STAR" && !isStarred(c)) return false;
      if (["F", "PR", "TR", "NEW"].includes(status) && dom !== status) return false;
      if (q) {
        const hay = [c.diagnosis, c.scenario, c.pearl, c.station, c.stationShort, ...(c.pyqSessions || []), ...c.questions, ...(c.answers || []).flatMap((a) => [a.q, ...a.bullets])].join(" ").toLowerCase();
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
      const summaryAns = (c.answers || []).slice(0, 2).map((a) => `<div><strong>${escapeHtml(a.q)}</strong><ul>${a.bullets.slice(0, 2).map((b) => `<li>${fmtText(b)}</li>`).join("")}</ul></div>`).join("");

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
              <button class="mm-r-btn mm-r-f" style="padding:4px 9px;" onclick="OSPE.rateDirCard('${c.id}','F')">F</button>
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

    const src = (side === "back" && c && c.backImage) ? c.backImage : (overrideFile || (c ? c.frontImage : ""));
    document.getElementById("lb-img").src = imgSrc(src);
    document.getElementById("lb-title").textContent = (side === "front" && customTitle) ? customTitle : (c ? `${c.station} · ${side === "back" ? "Annotated Reference" : "Station Prompt"}` : "Clinical Reference");
    const toggleBtn = document.getElementById("lb-toggle-side");
    if (c && c.backImage) {
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
    openLightbox(lbState.cardId, lbState.side === "front" ? "back" : "front", lbState.overrideFile, lbState.customTitle);
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
    if (aidEl) aidEl.textContent = state.arenaId || genArenaId();
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
  }

  function confirmReset() {
    const keepUid = state.uid;
    const keepAid = state.arenaId;
    const keepInstallSent = state.installSent;
    const keepLastPing = state.lastOpenPingDay;
    const keepName = state.userName;
    const keepUnlocked = state.drUnlocked;
    const keepProfileDone = state.profileDone;
    state = defaultState();
    state.uid = keepUid;
    state.arenaId = keepAid;
    state.installSent = keepInstallSent;
    state.lastOpenPingDay = keepLastPing;
    state.userName = keepName;
    state.drUnlocked = keepUnlocked;
    state.profileDone = keepProfileDone;
    saveState();
    closeDialog();
    renderDashboard();
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
      setTimeout(fetchBlitzLeaderboard, 2400);
    }
  }

  window.OSPE = {
    navigate,
    toggleTheme,
    toggleMute,
    openStation,
    openStationStudy,
    setStudyStation,
    startStationBlitz,
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
    setArenaTab,
    refreshLeaderboard,
    setMindmapMode,
    selectMindmapStation,
    flipMindmapCard,
    rateMindmapCard,
    zoomMindmap,
    fitMindmap,
    setDirectoryScope,
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
