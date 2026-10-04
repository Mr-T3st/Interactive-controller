(() => {
  'use strict';

  const DATA = globalThis.__BIP_DATA__;
  if (!DATA?.catalog || !DATA?.packs) throw new Error('Interactive catalog data is missing.');

  const CATALOG = DATA.catalog;
  let STORY = null;
  let TRANSLATIONS = {};
  let BUILTIN_SUBTITLES = {};
  const STORAGE_KEY = 'bip2:save';
  const SETTINGS_KEY = 'bip2:settings';
  const SCHEMA_VERSION = 2;
  const PACK_STORAGE_PREFIX = 'ic2:story-pack:';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clone = (value) => typeof globalThis.structuredClone === 'function' ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const basename = (path) => String(path || '').split('/').pop();

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${value.toFixed(unit > 1 ? 2 : 0)} ${units[unit]}`;
  }

  function fnv1a(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36).toUpperCase().padStart(7, '0');
  }

  function safeJsonParse(value, fallback) {
    try { return JSON.parse(value); } catch { return fallback; }
  }

  class SafeStorage {
    constructor() {
      this.memory = new Map();
      this.available = false;
      try {
        const key = 'bip2:test';
        localStorage.setItem(key, '1');
        localStorage.removeItem(key);
        this.available = true;
      } catch {}
    }
    get(key) {
      try { return this.available ? localStorage.getItem(key) : (this.memory.get(key) ?? null); }
      catch { return this.memory.get(key) ?? null; }
    }
    set(key, value) {
      try {
        if (this.available) localStorage.setItem(key, value);
        else this.memory.set(key, value);
      } catch { this.memory.set(key, value); }
    }
    remove(key) {
      try { if (this.available) localStorage.removeItem(key); } catch {}
      this.memory.delete(key);
    }
  }

  class ProgressStore {
    constructor(story) {
      this.story = story;
      this.storage = new SafeStorage();
      this.storageKey = `${STORAGE_KEY}:${story.id}`;
      this.settings = this.loadSettings();
      this.data = this.load();
      this.saveTimer = null;
    }

    defaultSettings() {
      return {
        primarySubtitle: 'en',
        secondarySubtitle: 'off',
        subtitleOffsetMs: 0,
        subtitleFontScale: 1,
        subtitleBgOpacity: 0.14,
        playbackRate: 1,
        volume: 1,
        muted: false,
        developerMode: false
      };
    }

    defaultData() {
      return {
        schemaVersion: SCHEMA_VERSION,
        storyId: this.story.id,
        state: clone(this.story.initialState || {}),
        placeMs: 0,
        currentSegment: this.story.initialSegment,
        history: [],
        decisions: [],
        savedRoutes: [],
        discoveredSegments: [this.story.initialSegment],
        discoveredMoments: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }

    loadSettings() {
      const saved = safeJsonParse(this.storage.get(SETTINGS_KEY), null);
      return { ...this.defaultSettings(), ...(saved || {}) };
    }

    saveSettings() {
      this.storage.set(SETTINGS_KEY, JSON.stringify(this.settings));
    }

    load() {
      const saved = safeJsonParse(this.storage.get(this.storageKey), null);
      if (!saved || saved.schemaVersion !== SCHEMA_VERSION || saved.storyId !== this.story.id) {
        return this.defaultData();
      }
      const fresh = this.defaultData();
      return {
        ...fresh,
        ...saved,
        state: { ...fresh.state, ...(saved.state || {}) },
        history: Array.isArray(saved.history) ? saved.history : [],
        decisions: Array.isArray(saved.decisions) ? saved.decisions : [],
        savedRoutes: Array.isArray(saved.savedRoutes) ? saved.savedRoutes : [],
        discoveredSegments: Array.isArray(saved.discoveredSegments) ? saved.discoveredSegments : fresh.discoveredSegments,
        discoveredMoments: Array.isArray(saved.discoveredMoments) ? saved.discoveredMoments : []
      };
    }

    save(immediate = false) {
      this.data.updatedAt = Date.now();
      if (immediate) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
        this.storage.set(this.storageKey, JSON.stringify(this.data));
        this.saveSettings();
        return;
      }
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.save(true), 400);
    }

    resetProgress() {
      const savedRoutes = Array.isArray(this.data?.savedRoutes) ? this.data.savedRoutes : [];
      this.data = { ...this.defaultData(), savedRoutes };
      this.save(true);
    }

    resetAll() {
      this.data = this.defaultData();
      this.settings = this.defaultSettings();
      this.storage.remove(this.storageKey);
      this.storage.remove(SETTINGS_KEY);
    }

    exportObject() {
      return {
        app: 'Interactive-controller',
        schemaVersion: SCHEMA_VERSION,
        storyId: this.story.id,
        exportedAt: new Date().toISOString(),
        progress: this.data,
        settings: this.settings
      };
    }

    importObject(obj) {
      if (!obj || obj.schemaVersion !== SCHEMA_VERSION || obj.storyId !== this.story.id || !obj.progress) {
        throw new Error('This save file is not compatible with this story build.');
      }
      this.data = { ...this.defaultData(), ...obj.progress };
      this.settings = { ...this.defaultSettings(), ...(obj.settings || {}) };
      this.save(true);
    }
  }

  class StoryEngine {
    constructor(story, store, translations) {
      this.story = story;
      this.store = store;
      this.translations = translations;
      this.segmentEntries = Object.entries(story.segments)
        .map(([id, segment]) => ({ id, ...segment }))
        .sort((a, b) => a.startTimeMs - b.startTimeMs);
    }

    get state() { return this.store.data.state; }

    evaluate(cond) {
      if (cond === undefined || cond === null) return true;
      if (cond === true || cond === false) return cond;
      if (typeof cond === 'string' || typeof cond === 'number') return cond;
      if (!Array.isArray(cond) || cond.length === 0) return true;
      const op = cond[0];
      if (op === 'persistentState') return this.state[cond[1]];
      if (op === 'not') return !this.evaluate(cond[1]);
      if (op === 'and') return cond.slice(1).every((x) => Boolean(this.evaluate(x)));
      if (op === 'or') return cond.slice(1).some((x) => Boolean(this.evaluate(x)));
      if (op === 'eql' && cond.length >= 3) {
        const a = this.evaluate(cond[1]);
        const b = this.evaluate(cond[2]);
        return a == b;
      }
      return true;
    }

    checkPrecondition(id) {
      if (!id) return true;
      const cond = this.story.preconditions[id];
      return cond === undefined ? true : Boolean(this.evaluate(cond));
    }

    resolveSegmentGroup(groupId, visited = new Set()) {
      if (!groupId || visited.has(groupId)) return null;
      visited.add(groupId);
      const group = this.story.segmentGroups[groupId];
      if (!Array.isArray(group)) return null;
      for (const entry of group) {
        if (typeof entry === 'string') {
          if (this.story.segments[entry]) return entry;
          if (this.story.segmentGroups[entry]) {
            const nested = this.resolveSegmentGroup(entry, visited);
            if (nested) return nested;
          }
          continue;
        }
        if (!entry || typeof entry !== 'object') continue;
        if (entry.precondition && !this.checkPrecondition(entry.precondition)) continue;
        if (entry.segment && this.story.segments[entry.segment]) return entry.segment;
        if (entry.segmentGroup) {
          const nested = this.resolveSegmentGroup(entry.segmentGroup, visited);
          if (nested) return nested;
        }
      }
      return null;
    }

    getSegmentId(ms) {
      const list = this.segmentEntries;
      let lo = 0;
      let hi = list.length - 1;
      let found = null;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const seg = list[mid];
        if (ms < seg.startTimeMs) hi = mid - 1;
        else {
          found = seg;
          lo = mid + 1;
        }
      }
      if (!found) return null;
      if (found.endTimeMs !== undefined && ms >= found.endTimeMs) return null;
      return found.id;
    }

    getSegment(id) { return this.story.segments[id] || null; }
    getSegmentStart(id) { return this.story.segments[id]?.startTimeMs ?? 0; }

    activeMoments(segmentId, ms) {
      const moments = this.story.momentsBySegment[segmentId] || [];
      const result = new Map();
      moments.forEach((m, index) => {
        if (ms >= m.startMs && ms < m.endMs && this.evaluate(m.precondition)) {
          result.set(`${segmentId}/${index}`, m);
        }
      });
      return result;
    }

    applyImpression(impression) {
      if (impression?.type !== 'userState') return false;
      const persistent = impression?.data?.persistent;
      if (!persistent || typeof persistent !== 'object') return false;
      let changed = false;
      for (const [key, value] of Object.entries(persistent)) {
        if (this.state[key] !== value) changed = true;
        this.state[key] = value;
      }
      if (changed) this.store.save();
      return changed;
    }

    destinationForChoice(choice) {
      if (!choice) return null;
      if (choice.segmentId && this.story.segments[choice.segmentId]) return choice.segmentId;
      if (choice.sg) return this.resolveSegmentGroup(choice.sg);
      return null;
    }

    translatedChoices(segmentId, moment) {
      const table = this.translations?.en?.[segmentId] || {};
      return (moment.choices || []).map((choice) => ({
        ...choice,
        text: table[choice.id] || choice.text || choice.id || 'Choice'
      }));
    }

    choiceDescription(moment) {
      return this.story.choicePoints?.[moment?.id]?.description || '';
    }
  }

  function parseTimestamp(value) {
    const clean = String(value).trim().replace(',', '.');
    const parts = clean.split(':').map(Number);
    if (parts.some((n) => !Number.isFinite(n))) return null;
    let seconds = 0;
    if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    else return null;
    return Math.round(seconds * 1000);
  }

  function cleanCueText(text) {
    return String(text)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  function parseSubtitle(text, name = 'Subtitle') {
    const source = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
    const blocks = source.split(/\n{2,}/);
    const cues = [];
    for (const block of blocks) {
      const lines = block.split('\n').map((line) => line.trimEnd());
      if (!lines.length) continue;
      if (/^(WEBVTT|NOTE|STYLE|REGION)/.test(lines[0].trim())) continue;
      let timingIndex = lines.findIndex((line) => line.includes('-->'));
      if (timingIndex < 0) continue;
      const timing = lines[timingIndex].match(/([^\s]+)\s+-->\s+([^\s]+)/);
      if (!timing) continue;
      const startMs = parseTimestamp(timing[1]);
      const endMs = parseTimestamp(timing[2]);
      if (startMs === null || endMs === null || endMs <= startMs) continue;
      const cueText = cleanCueText(lines.slice(timingIndex + 1).join('\n'));
      if (!cueText) continue;
      cues.push({ startMs, endMs, text: cueText });
    }
    cues.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
    return {
      name,
      cues,
      coverageMs: cues.length ? Math.max(...cues.map((c) => c.endMs)) : 0
    };
  }

  class SubtitleManager {
    constructor(store) {
      this.store = store;
      this.tracks = new Map();
      this.primaryEl = $('#subtitle-primary');
      this.secondaryEl = $('#subtitle-secondary');
      this.primarySelect = $('#subtitle-primary-select');
      this.secondarySelect = $('#subtitle-secondary-select');
      this.offsetEl = $('#subtitle-offset-value');
      this.sizeEl = $('#subtitle-size-value');
      this.backgroundSlider = $('#subtitle-background-slider');
      this.backgroundValueEl = $('#subtitle-background-value');
      for (const [id, info] of Object.entries(BUILTIN_SUBTITLES)) {
        const parsed = parseSubtitle(info.text, info.label);
        this.tracks.set(id, { id, ...info, ...parsed, builtin: true });
      }
      this.refreshSelects();
      this.syncSettings();
    }

    refreshSelects() {
      const currentPrimary = this.store.settings.primarySubtitle;
      const currentSecondary = this.store.settings.secondarySubtitle;
      const options = [{ id: 'off', label: 'Off' }, ...[...this.tracks.values()].map((t) => ({ id: t.id, label: t.label || t.name }))];
      for (const select of [this.primarySelect, this.secondarySelect]) {
        select.textContent = '';
        for (const option of options) {
          const el = document.createElement('option');
          el.value = option.id;
          el.textContent = option.label;
          select.append(el);
        }
      }
      this.primarySelect.value = this.tracks.has(currentPrimary) ? currentPrimary : 'off';
      this.secondarySelect.value = this.tracks.has(currentSecondary) ? currentSecondary : 'off';
    }

    syncSettings() {
      this.primarySelect.value = this.tracks.has(this.store.settings.primarySubtitle) ? this.store.settings.primarySubtitle : 'off';
      this.secondarySelect.value = this.tracks.has(this.store.settings.secondarySubtitle) ? this.store.settings.secondarySubtitle : 'off';
      this.offsetEl.textContent = `${(this.store.settings.subtitleOffsetMs / 1000).toFixed(1)}s`;
      this.applyAppearance();
    }

    applyAppearance() {
      const scale = clamp(Number(this.store.settings.subtitleFontScale) || 1, 0.7, 1.6);
      const opacity = clamp(Number(this.store.settings.subtitleBgOpacity), 0, 0.65);
      this.store.settings.subtitleFontScale = scale;
      this.store.settings.subtitleBgOpacity = Number.isFinite(opacity) ? opacity : 0.14;
      document.documentElement.style.setProperty('--subtitle-font-scale', String(scale));
      document.documentElement.style.setProperty('--subtitle-bg-opacity', String(this.store.settings.subtitleBgOpacity));
      if (this.sizeEl) this.sizeEl.textContent = `${Math.round(scale * 100)}%`;
      if (this.backgroundSlider) this.backgroundSlider.value = String(this.store.settings.subtitleBgOpacity);
      if (this.backgroundValueEl) this.backgroundValueEl.textContent = `${Math.round(this.store.settings.subtitleBgOpacity * 100)}%`;
    }

    adjustFontScale(delta) {
      this.store.settings.subtitleFontScale = clamp((Number(this.store.settings.subtitleFontScale) || 1) + delta, 0.7, 1.6);
      this.applyAppearance();
      this.store.saveSettings();
    }

    setBackgroundOpacity(value) {
      this.store.settings.subtitleBgOpacity = clamp(Number(value), 0, 0.65);
      this.applyAppearance();
      this.store.saveSettings();
    }

    addExternal(name, text) {
      const id = `external:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
      const parsed = parseSubtitle(text, name);
      const rtl = /(?:persian|farsi|arabic|hebrew|fa\b|ar\b|he\b)/i.test(name);
      this.tracks.set(id, { id, label: name, lang: '', direction: rtl ? 'rtl' : 'ltr', format: 'auto', ...parsed, builtin: false });
      this.refreshSelects();
      return id;
    }

    getTrack(id) { return id && id !== 'off' ? this.tracks.get(id) : null; }

    setPrimary(id) {
      this.store.settings.primarySubtitle = this.tracks.has(id) ? id : 'off';
      this.store.saveSettings();
    }

    setSecondary(id) {
      this.store.settings.secondarySubtitle = this.tracks.has(id) ? id : 'off';
      this.store.saveSettings();
    }

    adjustOffset(deltaMs) {
      this.store.settings.subtitleOffsetMs = clamp((this.store.settings.subtitleOffsetMs || 0) + deltaMs, -30000, 30000);
      this.offsetEl.textContent = `${(this.store.settings.subtitleOffsetMs / 1000).toFixed(1)}s`;
      this.store.saveSettings();
    }

    cueTextAt(track, ms) {
      if (!track?.cues?.length) return '';
      const t = ms + (this.store.settings.subtitleOffsetMs || 0);
      let lo = 0;
      let hi = track.cues.length - 1;
      let index = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (track.cues[mid].startMs <= t) { index = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      if (index < 0) return '';
      const texts = [];
      for (let i = Math.max(0, index - 2); i <= Math.min(track.cues.length - 1, index + 2); i++) {
        const cue = track.cues[i];
        if (cue.startMs <= t && t < cue.endMs) texts.push(cue.text);
      }
      return texts.join('\n');
    }

    render(ms) {
      const primary = this.getTrack(this.store.settings.primarySubtitle);
      const secondary = this.getTrack(this.store.settings.secondarySubtitle);
      this.renderTrack(this.primaryEl, primary, ms);
      this.renderTrack(this.secondaryEl, secondary, ms);
    }

    renderTrack(el, track, ms) {
      const text = track ? this.cueTextAt(track, ms) : '';
      el.textContent = text;
      el.hidden = !text;
      el.dir = track?.direction || 'auto';
      el.lang = track?.lang || '';
    }

    validationSummary(id, expectedMs) {
      const track = this.getTrack(id);
      if (!track) return null;
      const diff = expectedMs - track.coverageMs;
      return {
        name: track.label || track.name,
        coverageMs: track.coverageMs,
        expectedMs,
        complete: track.coverageMs >= expectedMs * 0.95,
        differenceMs: diff
      };
    }
  }

  class InteractivePlayer {
    constructor(engine, store, subtitles) {
      this.engine = engine;
      this.store = store;
      this.subtitles = subtitles;
      this.video = $('#video');
      this.transitionFrame = $('#transition-frame');
      this.timelineSlider = $('#timeline-slider');
      this.player = $('#player');
      this.startScreen = $('#start-screen');
      this.dropZone = $('#drop-zone');
      this.globalDropOverlay = $('#global-drop-overlay');
      this.fileInput = $('#video-file');
      this.choiceOverlay = $('#choice-overlay');
      this.choiceCaption = $('#choice-caption');
      this.choiceButtons = $('#choice-buttons');
      this.choiceProgress = $('#choice-progress-bar');
      this.segmentLabel = $('#segment-label');
      this.timeLabel = $('#time-label');
      this.mediaStatus = $('#media-status');
      this.toast = $('#toast');
      this.lastMs = 0;
      this.lastSegment = null;
      this.currentSegment = null;
      this.lastMoments = new Map();
      this.currentChoiceMoment = null;
      this.currentChoiceMomentKey = null;
      this.pendingChoiceMoment = null;
      this.pendingChoiceSegment = null;
      this.pendingChoiceIndex = -1;
      this.pendingChoiceRecorded = false;
      this.programmaticSeek = false;
      this.timelineDragging = false;
      this.resumeAfterTimelineScrub = false;
      this.storyNavCursor = null;
      this.transitionSerial = 0;
      this.transitionTimer = null;
      this.frameRequest = null;
      this.fallbackTimer = null;
      this.choiceDigits = [];
      this.videoLoaded = false;
      this.dragDepth = 0;
      this.resumeAfterLoad = this.store.data.placeMs > 5000;
      this.lastSavedPlaceSecond = -1;
      this.endingShown = false;
      this.fullscreenControlsTimer = null;
      this.gamepadFrame = null;
      this.gamepadPreviousButtons = [];
      this.gamepadChoiceIndex = 0;
      this.initUI();
      this.bindEvents();
      this.updateResumeMessage();
      this.renderMap();
    }

    initUI() {
      $('#speed-select').value = String(this.store.settings.playbackRate);
      this.video.volume = clamp(Number(this.store.settings.volume) || 1, 0, 1);
      this.video.muted = Boolean(this.store.settings.muted);
      $('#volume-slider').value = String(this.video.volume);
      this.updateMuteButton();
      this.updatePlayButton();
      $('#developer-panel').hidden = !this.store.settings.developerMode;
      this.updatePathCode();
    }

    bindEvents() {
      this.fileInput.addEventListener('change', () => this.loadVideoFile(this.fileInput.files?.[0]));

      const hasDraggedFiles = (event) => Array.from(event.dataTransfer?.types || []).includes('Files');
      const clearDragUI = () => {
        this.dragDepth = 0;
        document.body.classList.remove('file-drag-active');
        this.dropZone.classList.remove('dragging');
        if (this.globalDropOverlay) this.globalDropOverlay.hidden = true;
      };

      document.addEventListener('dragenter', (event) => {
        if (!hasDraggedFiles(event)) return;
        event.preventDefault();
        this.dragDepth += 1;
        document.body.classList.add('file-drag-active');
        this.dropZone.classList.add('dragging');
        if (this.globalDropOverlay) this.globalDropOverlay.hidden = false;
      });
      document.addEventListener('dragover', (event) => {
        if (!hasDraggedFiles(event)) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      });
      document.addEventListener('dragleave', (event) => {
        if (!hasDraggedFiles(event)) return;
        this.dragDepth = Math.max(0, this.dragDepth - 1);
        if (this.dragDepth === 0) clearDragUI();
      });
      document.addEventListener('drop', (event) => {
        if (!hasDraggedFiles(event)) return;
        event.preventDefault();
        clearDragUI();
        const files = [...(event.dataTransfer?.files || [])];
        const file = files.find((item) => /\.(mp4|mkv|m4v|webm)$/i.test(item.name) || item.type.startsWith('video/'));
        if (!file) {
          this.toastMessage('Drop an MP4, MKV, M4V or WebM movie file.', true);
          return;
        }
        this.loadVideoFile(file);
      });

      window.addEventListener('blur', clearDragUI);

      $('#play-button').addEventListener('click', () => this.togglePlay());
      $('#back-button').addEventListener('click', () => this.previousStoryScene());
      $('#rewind-10-button').addEventListener('click', () => this.jumpBack());
      $('#forward-10-button').addEventListener('click', () => this.jumpForward());
      $('#forward-button').addEventListener('click', () => this.nextStoryScene());
      $('#undo-button').addEventListener('click', () => this.rewindLastDecision());
      $('#fullscreen-button').addEventListener('click', () => this.toggleFullscreen());
      $('#restart-button').addEventListener('click', () => this.restartStory(false));
      $('#fresh-start-button').addEventListener('click', () => this.restartStory(true));
      $('#story-map-button').addEventListener('click', () => { this.renderMap(); $('#story-map-dialog').showModal(); });
      $('#story-map-close').addEventListener('click', () => $('#story-map-dialog').close());
      $('#inspector-button').addEventListener('click', () => this.toggleInspector());
      $('#export-save-button').addEventListener('click', () => this.exportSave());
      $('#save-route-button').addEventListener('click', () => this.saveCurrentRoute());
      $('#import-save-file').addEventListener('change', (event) => this.importSave(event.target.files?.[0]));

      this.timelineSlider.addEventListener('pointerdown', () => {
        if (!this.videoLoaded) return;
        this.timelineDragging = true;
        this.resumeAfterTimelineScrub = !this.video.paused;
        if (this.resumeAfterTimelineScrub) this.video.pause();
      });
      this.timelineSlider.addEventListener('input', (event) => {
        if (!this.videoLoaded) return;
        const previewMs = Number(event.target.value) || 0;
        this.updateTimelineVisual(previewMs);
        this.timeLabel.textContent = `${formatTime(previewMs / 1000)} / ${formatTime(this.video.duration)}`;
      });
      this.timelineSlider.addEventListener('change', (event) => {
        if (!this.videoLoaded) return;
        const targetMs = Number(event.target.value) || 0;
        const shouldResume = this.resumeAfterTimelineScrub;
        this.timelineDragging = false;
        this.resumeAfterTimelineScrub = false;
        this.storyNavCursor = null;
        this.seekMs(targetMs, { preservePending: false, smooth: false });
        if (shouldResume) this.video.play().catch(() => {});
      });

      $('#speed-select').addEventListener('change', (event) => this.setPlaybackRate(Number(event.target.value)));
      $('#volume-slider').addEventListener('input', (event) => {
        this.video.volume = clamp(Number(event.target.value), 0, 1);
        this.store.settings.volume = this.video.volume;
        if (this.video.volume > 0 && this.video.muted) {
          this.video.muted = false;
          this.store.settings.muted = false;
        }
        this.updateMuteButton();
        this.store.saveSettings();
      });
      $('#mute-button').addEventListener('click', () => {
        this.video.muted = !this.video.muted;
        this.store.settings.muted = this.video.muted;
        this.updateMuteButton();
        this.store.saveSettings();
      });

      this.subtitles.primarySelect.addEventListener('change', (event) => { this.subtitles.setPrimary(event.target.value); this.renderMediaStatus(); });
      this.subtitles.secondarySelect.addEventListener('change', (event) => this.subtitles.setSecondary(event.target.value));
      $('#subtitle-minus').addEventListener('click', () => this.subtitles.adjustOffset(-100));
      $('#subtitle-plus').addEventListener('click', () => this.subtitles.adjustOffset(100));
      $('#subtitle-size-minus').addEventListener('click', () => this.subtitles.adjustFontScale(-0.1));
      $('#subtitle-size-plus').addEventListener('click', () => this.subtitles.adjustFontScale(0.1));
      $('#subtitle-background-slider').addEventListener('input', (event) => this.subtitles.setBackgroundOpacity(event.target.value));
      $('#subtitle-file').addEventListener('change', async (event) => {
        const files = [...(event.target.files || [])];
        for (const file of files) {
          const id = this.subtitles.addExternal(file.name, await file.text());
          this.subtitles.setPrimary(id);
          this.subtitles.primarySelect.value = id;
          this.toastMessage(`Loaded subtitle: ${file.name}`);
        }
        event.target.value = '';
        this.renderMediaStatus();
      });

      this.video.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
      this.video.addEventListener('play', () => { this.updatePlayButton(); this.startClock(); });
      this.video.addEventListener('pause', () => { this.updatePlayButton(); this.tick(true, false); });
      this.video.addEventListener('seeked', () => {
        this.tick(true, true);
        this.programmaticSeek = false;
        this.finishSmoothTransition();
      });
      this.video.addEventListener('timeupdate', () => this.tick(false, false));
      this.video.addEventListener('ended', () => this.showEndingSummary());
      this.video.addEventListener('error', () => this.onVideoError());
      this.video.addEventListener('dblclick', () => this.toggleFullscreen());
      this.video.addEventListener('click', (event) => this.handleVideoClick(event));

      document.addEventListener('keydown', (event) => this.onKeyDown(event));
      this.player.addEventListener('pointermove', (event) => this.onPlayerPointerMove(event));
      this.player.addEventListener('pointerdown', () => { if (document.fullscreenElement === this.player) this.revealFullscreenControls(1800); });
      document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
      window.addEventListener('gamepadconnected', () => this.startGamepadLoop());
      window.addEventListener('gamepaddisconnected', () => this.ensureGamepadLoopState());
      this.ensureGamepadLoopState();

      if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      }
    }

    updateResumeMessage() {
      const el = $('#resume-message');
      if (this.store.data.placeMs > 5000) {
        el.hidden = false;
        el.textContent = `Saved route found at ${formatTime(this.store.data.placeMs / 1000)}. Select the movie file to resume.`;
      } else el.hidden = true;
    }

    async loadVideoFile(file) {
      if (!file) return;
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['mp4', 'mkv', 'webm', 'm4v'].includes(ext)) {
        this.toastMessage('The selected file does not look like a supported video container.', true);
      }
      if (this.video.src?.startsWith('blob:')) URL.revokeObjectURL(this.video.src);
      this.video.src = URL.createObjectURL(file);
      this.video.dataset.fileName = file.name;
      this.video.dataset.fileSize = String(file.size);
      this.video.dataset.fileType = file.type || ext || 'unknown';
      this.startScreen.hidden = true;
      this.player.hidden = false;
      this.video.load();
    }

    onLoadedMetadata() {
      this.videoLoaded = true;
      const durationMs = Math.max(1, Math.round(this.video.duration * 1000));
      this.timelineSlider.max = String(durationMs);
      this.timelineSlider.value = '0';
      this.updateTimelineVisual(0);
      this.video.playbackRate = Number(this.store.settings.playbackRate) || 1;
      this.renderMediaStatus();
      if (this.resumeAfterLoad && this.store.data.placeMs > 0) {
        this.seekMs(this.store.data.placeMs, { preservePending: false });
        this.toastMessage(`Resumed at ${formatTime(this.store.data.placeMs / 1000)}.`);
      } else {
        this.seekMs(this.engine.getSegmentStart(this.engine.story.initialSegment), { preservePending: false });
      }
      this.video.play().catch(() => this.toastMessage('Press Play to start.'));
      this.startClock();
    }

    onVideoError() {
      const ext = this.video.dataset.fileName?.split('.').pop()?.toUpperCase() || 'video';
      this.mediaStatus.className = 'status-card bad';
      this.mediaStatus.innerHTML = `<strong>${ext} could not be decoded.</strong><span>The container may be readable but its video/audio codec may not be supported by this browser. MP4 with H.264/AAC is the safest option.</span>`;
      this.toastMessage('Browser could not decode this video.', true);
    }

    renderMediaStatus() {
      if (!this.videoLoaded) return;
      const durationMs = Math.round(this.video.duration * 1000);
      const expectedMs = this.engine.story.expectedDurationMs;
      const diff = Math.abs(durationMs - expectedMs);
      const level = diff <= 15000 ? 'good' : diff <= 60000 ? 'warn' : 'bad';
      const verdict = level === 'good' ? 'Timeline compatible' : level === 'warn' ? 'Check synchronization' : 'Likely wrong cut';
      const primary = this.subtitles.validationSummary(this.store.settings.primarySubtitle, expectedMs);
      const subtitleText = primary ? `${primary.name}: ${formatTime(primary.coverageMs / 1000)} ${primary.complete ? '✓' : '⚠'}` : 'Subtitles off';
      this.mediaStatus.className = `status-card ${level}`;
      this.mediaStatus.innerHTML = `
        <strong>${verdict}</strong>
        <span>Movie: ${formatTime(this.video.duration)} · Expected: ${formatTime(expectedMs / 1000)} · Δ ${Math.round(diff / 1000)}s</span>
        <span>${basename(this.video.dataset.fileName)} · ${formatBytes(Number(this.video.dataset.fileSize))}</span>
        <span>Global subtitle: ${subtitleText}</span>`;
    }

    startClock() {
      if ('requestVideoFrameCallback' in this.video) {
        if (this.frameRequest) this.video.cancelVideoFrameCallback(this.frameRequest);
        const frame = (_now, metadata) => {
          this.tick(false, false, Math.round(metadata.mediaTime * 1000));
          if (!this.video.paused && !this.video.ended) this.frameRequest = this.video.requestVideoFrameCallback(frame);
        };
        if (!this.video.paused) this.frameRequest = this.video.requestVideoFrameCallback(frame);
      } else {
        clearInterval(this.fallbackTimer);
        if (!this.video.paused) this.fallbackTimer = setInterval(() => this.tick(false, false), 100);
      }
    }

    tick(force = false, seeked = false, frameMs = null) {
      if (!this.videoLoaded) return;
      const ms = frameMs ?? Math.round(this.video.currentTime * 1000);
      if (!force && Math.abs(ms - this.lastMs) < 30) return;
      const oldMs = this.lastMs;
      this.lastMs = ms;
      this.subtitles.render(ms);
      this.timeLabel.textContent = `${formatTime(ms / 1000)} / ${formatTime(this.video.duration)}`;
      if (!this.timelineDragging) {
        this.timelineSlider.value = String(clamp(ms, 0, Number(this.timelineSlider.max) || ms));
        this.updateTimelineVisual(ms);
      }

      const segmentId = this.engine.getSegmentId(ms) || this.currentSegment || this.engine.story.initialSegment;
      const natural = !seeked && !this.programmaticSeek && ms >= oldMs && (ms - oldMs) < 2500;

      if (this.lastSegment && segmentId !== this.lastSegment && natural) {
        if (this.playNextSegment(this.lastSegment, 'natural-boundary')) return;
      }

      if (segmentId !== this.currentSegment) {
        const from = this.currentSegment;
        this.currentSegment = segmentId;
        this.lastSegment = segmentId;
        this.segmentLabel.textContent = `Segment ${segmentId}`;
        this.store.data.currentSegment = segmentId;
        if (!this.store.data.discoveredSegments.includes(segmentId)) this.store.data.discoveredSegments.push(segmentId);
        if (from && from !== segmentId && this.programmaticSeek) {
        }
        this.updatePathCode();
        this.store.save();
      }

      const active = this.engine.activeMoments(segmentId, ms);
      for (const [key, moment] of this.lastMoments) {
        if (!active.has(key)) this.onMomentEnd(key, moment, seeked || !natural);
      }
      for (const [key, moment] of active) {
        if (!this.lastMoments.has(key)) this.onMomentStart(key, moment, segmentId, seeked || !natural);
        this.onMomentUpdate(key, moment, ms);
      }
      this.lastMoments = active;
      this.savePlace(ms);
      this.renderInspector(ms, active);
    }

    onMomentStart(key, moment, segmentId, nonNatural) {
      if (!this.store.data.discoveredMoments.includes(key)) this.store.data.discoveredMoments.push(key);
      if (!nonNatural) this.engine.applyImpression(moment.impressionData);
      if (moment.choices?.length) this.showChoices(moment, key, segmentId, false);
    }

    onMomentUpdate(_key, moment, ms) {
      if (!moment.choices?.length || this.currentChoiceMoment !== moment) return;
      const start = moment.uiDisplayMS ?? moment.startMs;
      const end = moment.uiHideMS ?? moment.endMs;
      const percent = clamp(100 - ((ms - start) * 100 / Math.max(1, end - start)), 0, 100);
      this.choiceProgress.style.width = `${percent}%`;
    }

    onMomentEnd(key, moment, _nonNatural) {
      if (this.currentChoiceMomentKey === key) this.hideChoices();
      if (moment.choices?.length) this.choiceProgress.style.width = '0%';
    }

    showChoices(moment, key, segmentId, rerender) {
      this.currentChoiceMoment = moment;
      this.currentChoiceMomentKey = key;
      this.pendingChoiceMoment = moment;
      this.pendingChoiceSegment = segmentId;
      if (!rerender) {
        this.pendingChoiceIndex = clamp(Number(moment.defaultChoiceIndex) || 0, 0, Math.max(0, moment.choices.length - 1));
        this.pendingChoiceRecorded = false;
      }
      this.choiceButtons.textContent = '';
      this.choiceDigits = [];
      const description = this.engine.choiceDescription(moment);
      this.choiceCaption.textContent = description;
      this.choiceCaption.hidden = !description;
      const isPhone = moment.type === 'scene:cs_bs_phone' || moment.inputConfig?.hasMultipleChoiceInput;
      this.choiceOverlay.classList.remove('split-mode', 'multi-mode', 'phone-mode');
      if (isPhone) {
        this.choiceOverlay.classList.add('phone-mode');
        this.renderPhoneChoice(moment);
      } else {
        this.choiceOverlay.classList.add(moment.choices.length === 2 ? 'split-mode' : 'multi-mode');
        this.renderNormalChoices(segmentId, moment);
      }
      this.choiceOverlay.hidden = false;
      this.player.classList.add('choice-open');
      this.gamepadChoiceIndex = clamp(this.pendingChoiceIndex, 0, Math.max(0, (moment.choices?.length || 1) - 1));
    }

    renderNormalChoices(segmentId, moment) {
      const choices = this.engine.translatedChoices(segmentId, moment);
      choices.forEach((choice, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'choice-button';
        if (index === this.pendingChoiceIndex) button.classList.add('default-choice');
        button.dataset.choiceIndex = String(index);
        const image = choice.image;
        if (image) {
          const img = document.createElement('img');
          img.src = image;
          img.alt = choice.text || `Choice ${index + 1}`;
          button.append(img);
          const sr = document.createElement('span');
          sr.className = 'sr-only';
          sr.textContent = choice.text || `Choice ${index + 1}`;
          button.append(sr);
        } else {
          const key = document.createElement('span');
          key.className = 'choice-number';
          key.textContent = String(index + 1);
          const text = document.createElement('span');
          text.textContent = choice.text || `Choice ${index + 1}`;
          button.append(key, text);
        }
        button.addEventListener('click', () => this.selectChoice(index));
        this.choiceButtons.append(button);
      });
    }

    renderPhoneChoice(moment) {
      const wrap = document.createElement('div');
      wrap.className = 'phone-choice';
      const digits = document.createElement('div');
      digits.className = 'phone-digits';
      digits.setAttribute('aria-live', 'polite');
      for (let i = 0; i < 5; i++) {
        const slot = document.createElement('span');
        slot.textContent = '–';
        digits.append(slot);
      }
      const keypad = document.createElement('div');
      keypad.className = 'keypad';
      const inputs = moment.inputConfig?.inputs || Array.from({ length: 10 }, (_, i) => ({ value: String(i), text: String(i) }));
      for (const input of inputs) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = input.text ?? input.value;
        button.addEventListener('click', () => {
          if (this.choiceDigits.length >= 5) return;
          this.choiceDigits.push(String(input.value));
          [...digits.children].forEach((slot, index) => { slot.textContent = this.choiceDigits[index] ?? '–'; });
          if (this.choiceDigits.length === 5) {
            const code = this.choiceDigits.join('');
            const sequence = moment.inputConfig?.sequence || this.engine.story.phoneCode;
            const target = code === sequence ? moment.inputConfig?.successSegmentId : moment.inputConfig?.failSegmentId;
            let index = (moment.choices || []).findIndex((choice) => choice.segmentId === target);
            if (index < 0) index = code === sequence ? 0 : 1;
            setTimeout(() => this.selectChoice(index), 180);
          }
        });
        keypad.append(button);
      }
      wrap.append(digits, keypad);
      this.choiceButtons.append(wrap);
    }

    hideChoices() {
      this.choiceOverlay.hidden = true;
      this.choiceOverlay.classList.remove('split-mode', 'multi-mode', 'phone-mode');
      this.player.classList.remove('choice-open');
      this.currentChoiceMoment = null;
      this.currentChoiceMomentKey = null;
      this.gamepadChoiceIndex = 0;
    }

    recordDecision(moment, index, segmentId, automatic = false) {
      if (!moment?.choices?.[index]) return null;
      this.truncateFutureRoute();
      const choices = this.engine.translatedChoices(segmentId, moment);
      const choice = moment.choices[index];
      const decision = {
        id: `${segmentId}:${moment.id || this.currentChoiceMomentKey || 'choice'}:${Date.now()}`,
        segmentId,
        momentId: moment.id || this.currentChoiceMomentKey,
        momentStartMs: moment.startMs,
        choiceIndex: index,
        choiceId: choice.id || null,
        choiceText: choices[index]?.text || choice.text || choice.id || `Choice ${index + 1}`,
        automatic,
        stateBefore: clone(this.store.data.state),
        placeBeforeMs: moment.startMs,
        historyLengthBefore: this.store.data.history.length,
        discoveredLengthBefore: this.store.data.discoveredSegments.length
      };
      this.store.data.decisions.push(decision);
      this.pendingChoiceRecorded = true;
      return decision;
    }

    selectChoice(index) {
      const moment = this.pendingChoiceMoment;
      if (!moment?.choices?.[index]) return;
      const segmentId = this.pendingChoiceSegment || this.currentSegment;
      const choice = moment.choices[index];
      this.pendingChoiceIndex = index;
      this.recordDecision(moment, index, segmentId, false);
      this.engine.applyImpression(choice.impressionData);
      this.store.save(true);
      this.updatePathCode();
      this.renderMap();
      this.hideChoices();
      if (!moment.config?.disableImmediateSceneTransition) this.playNextSegment(segmentId, 'immediate-choice');
    }

    playNextSegment(fromSegment, reason = 'transition') {
      let destination = null;
      let usedChoice = null;
      let usedDecision = null;
      if (this.pendingChoiceMoment && this.pendingChoiceIndex >= 0) {
        const choice = this.pendingChoiceMoment.choices?.[this.pendingChoiceIndex];
        const choiceSegment = this.pendingChoiceSegment || fromSegment;
        if (choice) {
          if (!this.pendingChoiceRecorded) usedDecision = this.recordDecision(this.pendingChoiceMoment, this.pendingChoiceIndex, choiceSegment, true);
          else {
            const momentId = this.pendingChoiceMoment.id || this.currentChoiceMomentKey;
            usedDecision = [...this.store.data.decisions].reverse().find((decision) =>
              decision.segmentId === choiceSegment &&
              decision.choiceIndex === this.pendingChoiceIndex &&
              decision.historyLengthBefore === this.store.data.history.length &&
              (!momentId || !decision.momentId || decision.momentId === momentId)
            ) || null;
          }
          destination = this.engine.destinationForChoice(choice);
          usedChoice = choice;
          this.engine.applyImpression(choice.impressionData);
        }
        this.pendingChoiceIndex = -1;
        this.pendingChoiceMoment = null;
        this.pendingChoiceSegment = null;
        this.pendingChoiceRecorded = false;
        this.updatePathCode();
        this.renderMap();
      }
      if (!destination && fromSegment && this.engine.story.segmentGroups[fromSegment]) {
        destination = this.engine.resolveSegmentGroup(fromSegment);
      }
      if (!destination) destination = this.engine.getSegment(fromSegment)?.defaultNext || null;
      if (!destination) return false;

      this.truncateFutureRoute();
      const beforeState = usedDecision?.stateBefore ? clone(usedDecision.stateBefore) : clone(this.store.data.state);
      const afterState = clone(this.store.data.state);
      this.store.data.history.push({
        from: fromSegment,
        to: destination,
        atMs: Math.round(this.video.currentTime * 1000),
        reason,
        choiceId: usedChoice?.id || null,
        decisionId: usedDecision?.id || null,
        stateBefore: beforeState,
        stateAfter: afterState,
        decisionCountAfter: this.store.data.decisions.length
      });
      this.storyNavCursor = this.store.data.history.length;
      this.store.save();
      this.seekMs(this.engine.getSegmentStart(destination), { preservePending: false, smooth: true });
      return true;
    }

    updateTimelineVisual(ms) {
      const max = Math.max(1, Number(this.timelineSlider.max) || Math.round((this.video.duration || 0) * 1000) || 1);
      const percent = clamp((Number(ms) || 0) * 100 / max, 0, 100);
      this.timelineSlider.style.setProperty('--timeline-progress', `${percent}%`);
    }

    captureTransitionFrame() {
      if (!this.transitionFrame || !this.videoLoaded || this.video.readyState < 2) return false;
      const stage = this.video.parentElement;
      const width = Math.max(2, Math.round(stage.clientWidth));
      const height = Math.max(2, Math.round(stage.clientHeight));
      const videoWidth = this.video.videoWidth || width;
      const videoHeight = this.video.videoHeight || height;
      try {
        this.transitionFrame.width = width;
        this.transitionFrame.height = height;
        const ctx = this.transitionFrame.getContext('2d', { alpha: false });
        if (!ctx) return false;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        const scale = Math.min(width / videoWidth, height / videoHeight);
        const drawWidth = videoWidth * scale;
        const drawHeight = videoHeight * scale;
        const x = (width - drawWidth) / 2;
        const y = (height - drawHeight) / 2;
        ctx.drawImage(this.video, x, y, drawWidth, drawHeight);
        this.transitionFrame.classList.remove('fade-out');
        this.transitionFrame.hidden = false;
        return true;
      } catch {
        this.transitionFrame.hidden = true;
        return false;
      }
    }

    finishSmoothTransition() {
      if (!this.transitionFrame || this.transitionFrame.hidden) return;
      const serial = ++this.transitionSerial;
      clearTimeout(this.transitionTimer);
      const reveal = () => {
        if (serial !== this.transitionSerial || this.transitionFrame.hidden) return;
        requestAnimationFrame(() => {
          if (serial !== this.transitionSerial) return;
          this.transitionFrame.classList.add('fade-out');
          this.transitionTimer = setTimeout(() => {
            if (serial !== this.transitionSerial) return;
            this.transitionFrame.hidden = true;
            this.transitionFrame.classList.remove('fade-out');
          }, 180);
        });
      };
      if ('requestVideoFrameCallback' in this.video) {
        let done = false;
        const fallback = setTimeout(() => { if (!done) reveal(); }, 90);
        this.video.requestVideoFrameCallback(() => {
          done = true;
          clearTimeout(fallback);
          reveal();
        });
      } else {
        setTimeout(reveal, 55);
      }
    }

    seekMs(ms, { preservePending = true, smooth = false } = {}) {
      if (!this.videoLoaded) return;
      const maxMs = Number.isFinite(this.video.duration) ? Math.max(0, this.video.duration * 1000 - 50) : ms;
      this.programmaticSeek = true;
      if (smooth) this.captureTransitionFrame();
      else if (this.transitionFrame) this.transitionFrame.hidden = true;
      if (!preservePending) {
        this.pendingChoiceMoment = null;
        this.pendingChoiceIndex = -1;
        this.pendingChoiceSegment = null;
        this.pendingChoiceRecorded = false;
        this.hideChoices();
      }
      const targetMs = clamp(ms, 0, maxMs);
      this.timelineSlider.value = String(targetMs);
      this.updateTimelineVisual(targetMs);
      this.timeLabel.textContent = `${formatTime(targetMs / 1000)} / ${formatTime(this.video.duration)}`;
      this.video.currentTime = targetMs / 1000;
    }

    seekRelative(deltaMs) {
      if (!this.videoLoaded) return;
      this.storyNavCursor = null;
      const currentMs = Math.round(this.video.currentTime * 1000);
      this.seekMs(currentMs + deltaMs, { preservePending: false, smooth: false });
    }

    jumpForward() { this.seekRelative(10000); }
    jumpBack() { this.seekRelative(-10000); }

    alignStoryCursor() {
      const history = this.store.data.history;
      if (this.storyNavCursor !== null && this.storyNavCursor >= 0 && this.storyNavCursor <= history.length) return;
      const segmentId = this.engine.getSegmentId(Math.round(this.video.currentTime * 1000)) || this.currentSegment;
      let cursor = -1;
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].to === segmentId) { cursor = i + 1; break; }
        if (history[i].from === segmentId) { cursor = i; break; }
      }
      this.storyNavCursor = cursor >= 0 ? cursor : history.length;
    }

    truncateFutureRoute() {
      if (this.storyNavCursor === null) return;
      const history = this.store.data.history;
      const cursor = clamp(this.storyNavCursor, 0, history.length);
      if (cursor >= history.length) return;
      const removedDecisions = this.store.data.decisions.filter((decision) => Number(decision.historyLengthBefore) >= cursor);
      if (removedDecisions.length && removedDecisions[0].stateBefore) this.store.data.state = clone(removedDecisions[0].stateBefore);
      this.store.data.history = history.slice(0, cursor);
      this.store.data.decisions = this.store.data.decisions.filter((decision) => Number(decision.historyLengthBefore) < cursor);
      this.storyNavCursor = this.store.data.history.length;
      this.updatePathCode();
      this.store.save(true);
    }

    previousStoryScene() {
      if (!this.videoLoaded) return;
      this.alignStoryCursor();
      const history = this.store.data.history;
      if (!history.length || this.storyNavCursor <= 0) {
        this.toastMessage('This is the first recorded story scene.');
        return;
      }
      const transition = history[this.storyNavCursor - 1];
      const transitionIndex = this.storyNavCursor - 1;
      let decisionIndex = -1;
      for (let i = this.store.data.decisions.length - 1; i >= 0; i--) {
        const decision = this.store.data.decisions[i];
        if ((transition?.decisionId && decision.id === transition.decisionId) ||
            (!transition?.decisionId && Number(decision.historyLengthBefore) === transitionIndex)) {
          decisionIndex = i;
          break;
        }
      }
      if (decisionIndex >= 0) {
        this.rewindToDecision(decisionIndex);
        return;
      }
      this.storyNavCursor -= 1;
      if (transition?.stateBefore) this.store.data.state = clone(transition.stateBefore);
      this.pendingChoiceMoment = null;
      this.pendingChoiceIndex = -1;
      this.pendingChoiceSegment = null;
      this.pendingChoiceRecorded = false;
      this.lastMoments = new Map();
      this.hideChoices();
      this.store.save(true);
      this.seekMs(this.engine.getSegmentStart(transition.from), { preservePending: false, smooth: true });
      this.toastMessage(`Previous story scene: ${transition.from}`);
    }

    nextStoryScene() {
      if (!this.videoLoaded) return;
      if (this.currentChoiceMoment && !this.choiceOverlay.hidden) {
        this.toastMessage('Choose an option before moving to the next story scene.');
        return;
      }
      this.alignStoryCursor();
      const history = this.store.data.history;
      if (this.storyNavCursor < history.length) {
        const transition = history[this.storyNavCursor];
        if (transition?.stateAfter) this.store.data.state = clone(transition.stateAfter);
        this.storyNavCursor += 1;
        this.lastMoments = new Map();
        this.store.save(true);
        this.seekMs(this.engine.getSegmentStart(transition.to), { preservePending: false, smooth: true });
        this.toastMessage(`Next story scene: ${transition.to}`);
        return;
      }
      const segmentId = this.engine.getSegmentId(Math.round(this.video.currentTime * 1000)) || this.currentSegment;
      if (!this.playNextSegment(segmentId, 'scene-next')) this.toastMessage('No later story scene is available from here.');
    }

    rewindLastDecision() {
      const decisions = this.store.data.decisions;
      if (!decisions.length) {
        this.toastMessage('No previous decision to undo.');
        return;
      }
      this.rewindToDecision(decisions.length - 1);
    }

    rewindToDecision(index) {
      const decision = this.store.data.decisions[index];
      if (!decision) return;
      this.store.data.state = clone(decision.stateBefore);
      this.store.data.decisions = this.store.data.decisions.slice(0, index);
      this.store.data.history = this.store.data.history.slice(0, decision.historyLengthBefore);
      this.store.data.placeMs = decision.momentStartMs;
      this.pendingChoiceMoment = null;
      this.pendingChoiceIndex = -1;
      this.pendingChoiceSegment = null;
      this.pendingChoiceRecorded = false;
      this.lastMoments = new Map();
      this.storyNavCursor = this.store.data.history.length;
      this.store.save(true);
      this.updatePathCode();
      this.renderMap();
      if (this.videoLoaded) {
        this.seekMs(decision.momentStartMs, { preservePending: false, smooth: true });
        const moments = this.engine.story.momentsBySegment[decision.segmentId] || [];
        const momentIndex = moments.findIndex((moment) =>
          moment.choices?.length &&
          (moment.id === decision.momentId || Math.abs(moment.startMs - decision.momentStartMs) <= 5)
        );
        if (momentIndex >= 0) this.showChoices(moments[momentIndex], `${decision.segmentId}/${momentIndex}`, decision.segmentId, false);
      }
      this.toastMessage(`Decision reopened: ${decision.choiceText}`);
    }

    handleVideoClick(event) {
      if (document.fullscreenElement === this.player && !this.player.classList.contains('controls-visible')) {
        const edge = Math.max(150, Math.min(240, window.innerHeight * 0.22));
        if (event.clientY >= window.innerHeight - edge) {
          this.revealFullscreenControls(1900);
          return;
        }
      }
      this.togglePlay();
    }

    updatePlayButton() {
      const button = $('#play-button');
      if (!button) return;
      const playing = this.videoLoaded && !this.video.paused;
      button.dataset.state = playing ? 'playing' : 'paused';
      button.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      button.title = playing ? 'Pause (Space)' : 'Play (Space)';
    }

    updateMuteButton() {
      const button = $('#mute-button');
      if (!button) return;
      const muted = this.video.muted || this.video.volume === 0;
      button.dataset.muted = muted ? 'true' : 'false';
      button.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
      button.title = muted ? 'Unmute (M)' : 'Mute (M)';
    }

    revealFullscreenControls(ms = 1700) {
      if (document.fullscreenElement !== this.player) return;
      this.player.classList.add('controls-visible');
      clearTimeout(this.fullscreenControlsTimer);
      this.fullscreenControlsTimer = setTimeout(() => {
        if (document.fullscreenElement === this.player && !this.timelineDragging) this.player.classList.remove('controls-visible');
      }, ms);
    }

    onPlayerPointerMove(event) {
      if (document.fullscreenElement !== this.player) return;
      const edge = Math.max(150, Math.min(240, window.innerHeight * 0.22));
      if (event.clientY >= window.innerHeight - edge) this.revealFullscreenControls(1900);
      else if (this.player.classList.contains('controls-visible')) {
        clearTimeout(this.fullscreenControlsTimer);
        this.fullscreenControlsTimer = setTimeout(() => {
          if (document.fullscreenElement === this.player && !this.timelineDragging) this.player.classList.remove('controls-visible');
        }, 900);
      }
    }

    onFullscreenChange() {
      const active = document.fullscreenElement === this.player;
      const button = $('#fullscreen-button');
      if (button) {
        button.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Fullscreen');
        button.title = active ? 'Exit fullscreen (F)' : 'Fullscreen (F)';
      }
      clearTimeout(this.fullscreenControlsTimer);
      this.player.classList.toggle('controls-visible', active);
      if (active) this.revealFullscreenControls(1800);
    }

    updateGamepadChoiceFocus() {
      const buttons = $$('.choice-button[data-choice-index]', this.choiceButtons);
      buttons.forEach((button, index) => button.classList.toggle('gamepad-selected', index === this.gamepadChoiceIndex));
    }

    moveGamepadChoice(delta) {
      if (!this.currentChoiceMoment || this.choiceOverlay.hidden || this.currentChoiceMoment.type === 'scene:cs_bs_phone') return false;
      const count = this.currentChoiceMoment.choices?.length || 0;
      if (!count) return false;
      this.gamepadChoiceIndex = (this.gamepadChoiceIndex + delta + count) % count;
      this.updateGamepadChoiceFocus();
      return true;
    }

    activateGamepadChoice() {
      if (!this.currentChoiceMoment || this.choiceOverlay.hidden || this.currentChoiceMoment.type === 'scene:cs_bs_phone') return false;
      if (!this.currentChoiceMoment.choices?.[this.gamepadChoiceIndex]) return false;
      this.selectChoice(this.gamepadChoiceIndex);
      return true;
    }

    startGamepadLoop() {
      if (!navigator.getGamepads || this.gamepadFrame) return;
      const tick = () => {
        this.gamepadFrame = requestAnimationFrame(tick);
        const gamepad = [...(navigator.getGamepads?.() || [])].find(Boolean);
        if (!gamepad) { this.gamepadPreviousButtons = []; return; }
        const pressed = gamepad.buttons.map((button) => Boolean(button?.pressed));
        const edge = (index) => pressed[index] && !this.gamepadPreviousButtons[index];
        const choiceOpen = Boolean(this.currentChoiceMoment && !this.choiceOverlay.hidden);
        if (choiceOpen) {
          if (edge(14)) this.moveGamepadChoice(-1);
          if (edge(15)) this.moveGamepadChoice(1);
          if (edge(0)) this.activateGamepadChoice();
          if (edge(1)) this.rewindLastDecision();
        } else {
          if (edge(0)) this.togglePlay();
          if (edge(14)) this.jumpBack();
          if (edge(15)) this.jumpForward();
          if (edge(12)) this.previousStoryScene();
          if (edge(13)) this.nextStoryScene();
          if (edge(1)) this.rewindLastDecision();
          if (edge(9)) this.toggleFullscreen();
        }
        this.gamepadPreviousButtons = pressed;
      };
      this.gamepadFrame = requestAnimationFrame(tick);
    }

    ensureGamepadLoopState() {
      if (!navigator.getGamepads) return;
      const connected = [...(navigator.getGamepads() || [])].some(Boolean);
      if (connected) this.startGamepadLoop();
      else if (this.gamepadFrame) {
        cancelAnimationFrame(this.gamepadFrame);
        this.gamepadFrame = null;
        this.gamepadPreviousButtons = [];
      }
    }

    togglePlay() {
      if (!this.videoLoaded) return;
      if (this.video.paused) this.video.play().catch(() => {});
      else this.video.pause();
    }

    toggleFullscreen() {
      if (!document.fullscreenElement) this.player.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.().catch(() => {});
    }

    setPlaybackRate(rate) {
      const allowed = [0.5, 0.75, 1, 1.25, 1.5, 2];
      const nearest = allowed.reduce((best, value) => Math.abs(value - rate) < Math.abs(best - rate) ? value : best, 1);
      this.video.playbackRate = nearest;
      this.store.settings.playbackRate = nearest;
      $('#speed-select').value = String(nearest);
      this.store.saveSettings();
      this.toastMessage(`Playback speed ${nearest}×`);
    }

    changeSpeed(direction) {
      const values = [0.5, 0.75, 1, 1.25, 1.5, 2];
      let index = values.indexOf(this.video.playbackRate);
      if (index < 0) index = values.indexOf(1);
      index = clamp(index + direction, 0, values.length - 1);
      this.setPlaybackRate(values[index]);
    }

    restartStory(clearState) {
      if (clearState) this.store.resetProgress();
      else {
        this.store.data.placeMs = 0;
        this.store.data.currentSegment = this.engine.story.initialSegment;
      }
      this.pendingChoiceMoment = null;
      this.pendingChoiceIndex = -1;
      this.pendingChoiceRecorded = false;
      this.lastMoments = new Map();
      this.storyNavCursor = null;
      this.store.save(true);
      this.updatePathCode();
      if (this.videoLoaded) this.seekMs(this.engine.getSegmentStart(this.engine.story.initialSegment), { preservePending: false });
      this.toastMessage(clearState ? 'Story state cleared.' : 'Returned to the beginning.');
    }

    savePlace(ms) {
      const second = Math.floor(ms / 1000);
      if (second === this.lastSavedPlaceSecond) return;
      this.lastSavedPlaceSecond = second;
      this.store.data.placeMs = ms;
      this.store.save();
    }

    pathCode() {
      const path = this.store.data.decisions.map((d) => `${d.momentId}:${d.choiceId ?? d.choiceIndex}`).join('|');
      return `${this.engine.story.codePrefix || 'IC'}-${fnv1a(path || 'start')}`;
    }

    updatePathCode() {
      const code = this.pathCode();
      $('#path-code').textContent = code;
      $('#map-path-code').textContent = code;
      $('#visited-count').textContent = `${new Set(this.store.data.discoveredSegments).size}/${Object.keys(this.engine.story.segments).length}`;
      const decisionCount = $('#map-decision-count');
      if (decisionCount) decisionCount.textContent = String(this.store.data.decisions.length);
    }

    saveCurrentRoute() {
      if (!this.store.data.decisions.length) {
        this.toastMessage('Make at least one decision before saving a route.');
        return;
      }
      const code = this.pathCode();
      const savedRoutes = this.store.data.savedRoutes || (this.store.data.savedRoutes = []);
      const route = {
        id: `route:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
        code,
        savedAt: Date.now(),
        decisionCount: this.store.data.decisions.length,
        decisions: this.store.data.decisions.map((decision) => ({
          segmentId: decision.segmentId,
          momentId: decision.momentId,
          momentStartMs: decision.momentStartMs,
          choiceIndex: decision.choiceIndex,
          choiceId: decision.choiceId,
          choiceText: decision.choiceText
        }))
      };
      savedRoutes.unshift(route);
      if (savedRoutes.length > 30) savedRoutes.length = 30;
      this.store.save(true);
      this.renderMap();
      this.toastMessage(`Saved route ${code}.`);
    }

    deleteSavedRoute(routeId) {
      this.store.data.savedRoutes = (this.store.data.savedRoutes || []).filter((route) => route.id !== routeId);
      this.store.save(true);
      this.renderMap();
    }

    renderMap() {
      this.updatePathCode();
      const decisions = $('#decision-list');
      decisions.textContent = '';
      if (!this.store.data.decisions.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'No decisions recorded yet. Timeline seeking does not create story-history entries.';
        decisions.append(empty);
      } else {
        this.store.data.decisions.forEach((decision, index) => {
          const row = document.createElement('div');
          row.className = 'decision-row';
          const info = document.createElement('div');
          const title = document.createElement('strong');
          title.textContent = `${index + 1}. ${decision.choiceText}`;
          const meta = document.createElement('span');
          meta.textContent = `${decision.segmentId} · ${formatTime(decision.momentStartMs / 1000)}`;
          info.append(title, meta);
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Change from here';
          button.addEventListener('click', () => {
            $('#story-map-dialog').close();
            this.rewindToDecision(index);
          });
          row.append(info, button);
          decisions.append(row);
        });
      }

      const savedList = $('#saved-route-list');
      savedList.textContent = '';
      const routes = this.store.data.savedRoutes || [];
      if (!routes.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'No saved routes yet. Save a route after making decisions to compare later playthroughs.';
        savedList.append(empty);
      } else {
        routes.forEach((route) => {
          const row = document.createElement('div');
          row.className = 'saved-route-row';
          const info = document.createElement('div');
          const title = document.createElement('strong');
          title.textContent = route.code || 'Saved route';
          const meta = document.createElement('span');
          meta.className = 'route-meta';
          const when = route.savedAt ? new Date(route.savedAt).toLocaleString() : 'Saved route';
          meta.textContent = `${route.decisionCount ?? route.decisions?.length ?? 0} decisions · ${when}`;
          info.append(title, meta);
          if (Array.isArray(route.decisions) && route.decisions.length) {
            const details = document.createElement('details');
            details.className = 'saved-route-details';
            const summary = document.createElement('summary');
            summary.textContent = 'View choices';
            const list = document.createElement('ol');
            route.decisions.forEach((decision) => {
              const item = document.createElement('li');
              item.textContent = decision.choiceText || `Choice ${(decision.choiceIndex ?? 0) + 1}`;
              list.append(item);
            });
            details.append(summary, list);
            info.append(details);
          }
          const actions = document.createElement('div');
          actions.className = 'saved-route-actions';
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.textContent = 'Delete';
          remove.addEventListener('click', () => this.deleteSavedRoute(route.id));
          actions.append(remove);
          row.append(info, actions);
          savedList.append(row);
        });
      }
    }

    renderInspector(ms, active) {
      if ($('#developer-panel').hidden) return;
      $('#inspector-time').textContent = `${ms} ms`;
      $('#inspector-segment').textContent = this.currentSegment || '—';
      $('#inspector-moments').textContent = [...active.keys()].join(', ') || '—';
      $('#inspector-pending').textContent = this.pendingChoiceMoment ? `${this.pendingChoiceMoment.id || 'choice'} → ${this.pendingChoiceIndex}` : '—';
      const changed = Object.entries(this.store.data.state).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(this.engine.story.initialState[key]));
      $('#inspector-state').textContent = changed.length ? changed.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join('\n') : 'No state changes yet.';
    }

    toggleInspector() {
      const panel = $('#developer-panel');
      panel.hidden = !panel.hidden;
      this.store.settings.developerMode = !panel.hidden;
      this.store.saveSettings();
      if (!panel.hidden) this.tick(true, false);
    }

    exportSave() {
      const blob = new Blob([JSON.stringify(this.store.exportObject(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.engine.story.id || 'interactive'}-save-${this.pathCode()}.json`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    }

    async importSave(file) {
      if (!file) return;
      try {
        const obj = JSON.parse(await file.text());
        this.store.importObject(obj);
        this.resumeAfterLoad = true;
        this.storyNavCursor = this.store.data.history.length;
        this.subtitles.syncSettings();
          $('#speed-select').value = String(this.store.settings.playbackRate);
        this.updatePathCode();
        this.renderMap();
        if (this.videoLoaded) {
          this.video.playbackRate = this.store.settings.playbackRate;
          this.seekMs(this.store.data.placeMs, { preservePending: false });
        }
        this.toastMessage('Save imported.');
      } catch (error) {
        this.toastMessage(error.message || 'Could not import save.', true);
      }
      $('#import-save-file').value = '';
    }

    showEndingSummary() {
      if (this.endingShown) return;
      this.endingShown = true;
      this.renderMap();
      $('#ending-code').textContent = this.pathCode();
      $('#ending-decisions').textContent = String(this.store.data.decisions.length);
      $('#ending-segments').textContent = String(new Set(this.store.data.discoveredSegments).size);
      $('#ending-dialog').showModal();
    }

    toastMessage(text, isError = false) {
      this.toast.textContent = text;
      this.toast.classList.toggle('error', isError);
      this.toast.hidden = false;
      clearTimeout(this.toast._timer);
      this.toast._timer = setTimeout(() => { this.toast.hidden = true; }, 3200);
    }

    onKeyDown(event) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const key = event.key;
      if (key === ' ' || key === 'Spacebar') { event.preventDefault(); this.togglePlay(); }
      else if (key === 'ArrowLeft') { event.preventDefault(); this.jumpBack(); }
      else if (key === 'ArrowRight') { event.preventDefault(); this.jumpForward(); }
      else if (key === 'ArrowUp') { event.preventDefault(); this.previousStoryScene(); }
      else if (key === 'ArrowDown') { event.preventDefault(); this.nextStoryScene(); }
      else if (key === 'f' || key === 'F') this.toggleFullscreen();
      else if (key === 'r' || key === 'R') this.restartStory(false);
      else if (key === 'u' || key === 'U' || key === 'Backspace') { event.preventDefault(); this.rewindLastDecision(); }
      else if (key === 'd' || key === 'D') this.toggleInspector();
      else if (key === 'm' || key === 'M') $('#mute-button').click();
      else if (key === 's' || key === 'S') {
        const current = this.store.settings.primarySubtitle;
        const next = current === 'off' ? (this.subtitles.tracks.has('en') ? 'en' : [...this.subtitles.tracks.keys()][0]) : 'off';
        this.subtitles.setPrimary(next);
        this.subtitles.primarySelect.value = next;
      }
      else if (key === '0') this.setPlaybackRate(1);
      else if (/^[1-9]$/.test(key) && this.currentChoiceMoment && this.currentChoiceMoment.type !== 'scene:cs_bs_phone') {
        const index = Number(key) - 1;
        if (this.currentChoiceMoment.choices?.[index]) this.selectChoice(index);
      }
    }
  }

  let active = null;
  const categorySelect = $('#category-select');
  const titleSelect = $('#title-select');
  const episodeField = $('#episode-field');
  const episodeSelect = $('#episode-select');
  const selectionNote = $('#catalog-selection-note');
  const packStatus = $('#title-pack-status');
  const packButton = $('#story-pack-button');
  const packInput = $('#story-pack-file');
  const movieInput = $('#video-file');
  const dropZone = $('#drop-zone');
  const dropTitle = $('#drop-zone-title');
  const libraryDialog = $('#interactive-library-dialog');
  const libraryButton = $('#interactive-library-button');
  const librarySummary = $('#library-summary');
  const libraryBody = $('#library-table-body');
  const librarySearch = $('#library-search');
  const libraryCategoryFilter = $('#library-category-filter');
  const libraryStatusFilter = $('#library-status-filter');

  const categories = [...new Set(CATALOG.map((item) => item.category || 'Other'))];

  function packStorageKey(id) { return `${PACK_STORAGE_PREFIX}${id}`; }

  function readStoredPack(id) {
    try { return localStorage.getItem(packStorageKey(id)); } catch { return null; }
  }

  function writeStoredPack(id, text) {
    try { localStorage.setItem(packStorageKey(id), text); return true; } catch { return false; }
  }

  function removeStoredPack(id) {
    try { localStorage.removeItem(packStorageKey(id)); } catch {}
  }

  function catalogStatus(item) {
    if (DATA.packs[item.id] || item.builtin) return { key: 'builtin', label: 'Built-in' };
    if (item.packStatus === 'adapter-required') return { key: 'adapter-required', label: 'Adapter required' };
    const raw = readStoredPack(item.id);
    if (!raw) return { key: 'required', label: 'Pack required' };
    try { validatePack(JSON.parse(raw), item.id); return { key: 'installed', label: 'Installed' }; }
    catch { return { key: 'invalid', label: 'Invalid' }; }
  }

  function statusClass(key) { return `pack-status pack-status-${key}`; }

  function resetSelect(select, placeholder) {
    select.replaceChildren();
    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;
    select.append(option);
  }

  function categoryItems() {
    return CATALOG.filter((item) => (item.category || 'Other') === categorySelect.value);
  }

  function selectedSeriesItems() {
    return categoryItems().filter((item) => item.series === titleSelect.value);
  }

  function selectedCatalogItem() {
    const items = selectedSeriesItems();
    if (!items.length) return null;
    if (items.length === 1) return items[0];
    return items.find((item) => item.id === episodeSelect.value) || null;
  }

  function populateCatalog() {
    for (const category of categories) {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categorySelect.append(option);
    }
  }

  function populateTitles() {
    resetSelect(titleSelect, 'Choose a title…');
    resetSelect(episodeSelect, 'Choose an episode…');
    episodeField.hidden = true;
    titleSelect.disabled = !categorySelect.value;
    const seen = new Set();
    for (const item of categoryItems()) {
      if (seen.has(item.series)) continue;
      seen.add(item.series);
      const option = document.createElement('option');
      option.value = item.series;
      option.textContent = item.series;
      titleSelect.append(option);
    }
  }

  function populateEpisodes() {
    resetSelect(episodeSelect, 'Choose an episode…');
    const items = selectedSeriesItems();
    const episodic = items.length > 1 || items.some((item) => item.episode !== null && item.episode !== undefined);
    episodeField.hidden = !episodic;
    if (!episodic) return;
    for (const item of items) {
      const option = document.createElement('option');
      option.value = item.id;
      const status = catalogStatus(item);
      option.textContent = `${item.episode ? `Episode ${item.episode}` : item.title} · ${status.label}`;
      episodeSelect.append(option);
    }
  }

  function renderCatalogNote(item) {
    if (!item) { selectionNote.hidden = true; selectionNote.textContent = ''; return; }
    const parts = [item.source, item.interactionModel ? `Model: ${item.interactionModel}` : null, item.note].filter(Boolean);
    selectionNote.textContent = parts.join(' · ');
    selectionNote.hidden = !parts.length;
  }

  function renderLibrary() {
    const query = librarySearch.value.trim().toLowerCase();
    const category = libraryCategoryFilter.value;
    const statusFilter = libraryStatusFilter.value;
    const statuses = CATALOG.map((item) => ({ item, status: catalogStatus(item) }));
    const counts = statuses.reduce((acc, entry) => {
      acc[entry.status.key] = (acc[entry.status.key] || 0) + 1;
      return acc;
    }, {});
    const order = [
      ['builtin', 'Built-in'],
      ['installed', 'Installed'],
      ['required', 'Pack required'],
      ['adapter-required', 'Adapter required'],
      ['invalid', 'Invalid']
    ];
    librarySummary.replaceChildren();
    const total = document.createElement('div');
    total.className = 'library-summary-card';
    total.innerHTML = `<strong>${CATALOG.length}</strong><span>Catalog entries</span>`;
    librarySummary.append(total);
    for (const [key, label] of order) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `library-summary-card ${statusClass(key)}`;
      card.innerHTML = `<strong>${counts[key] || 0}</strong><span>${label}</span>`;
      card.addEventListener('click', () => { libraryStatusFilter.value = libraryStatusFilter.value === key ? '' : key; renderLibrary(); });
      librarySummary.append(card);
    }
    const filtered = statuses.filter(({ item, status }) => {
      const haystack = `${item.series || ''} ${item.title || ''} ${item.source || ''}`.toLowerCase();
      return (!query || haystack.includes(query)) && (!category || item.category === category) && (!statusFilter || status.key === statusFilter);
    });
    libraryBody.replaceChildren();
    if (!filtered.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.className = 'library-empty';
      cell.textContent = 'No catalog entries match these filters.';
      row.append(cell);
      libraryBody.append(row);
      return;
    }
    for (const { item, status } of filtered) {
      const row = document.createElement('tr');
      const titleCell = document.createElement('td');
      const titleStrong = document.createElement('strong');
      titleStrong.textContent = item.series || item.title;
      titleCell.append(titleStrong);
      if (item.title !== item.series && !item.episode) {
        const sub = document.createElement('span');
        sub.textContent = item.title;
        titleCell.append(sub);
      }
      const episodeCell = document.createElement('td');
      episodeCell.textContent = item.episode ? `Episode ${item.episode}` : '—';
      const categoryCell = document.createElement('td');
      categoryCell.textContent = item.category || 'Other';
      const engineCell = document.createElement('td');
      engineCell.textContent = item.interactionModel || '—';
      const statusCell = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = statusClass(status.key);
      badge.textContent = status.label;
      statusCell.append(badge);
      const actionCell = document.createElement('td');
      actionCell.className = 'library-row-actions';
      const choose = document.createElement('button');
      choose.type = 'button';
      choose.className = 'library-row-button';
      choose.textContent = 'Select';
      choose.addEventListener('click', () => chooseCatalogById(item.id));
      actionCell.append(choose);
      if (status.key === 'installed' || status.key === 'invalid') {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'library-row-button danger';
        remove.textContent = 'Remove';
        remove.addEventListener('click', () => { removeStoredPack(item.id); renderLibrary(); if (!active && selectedCatalogItem()?.id === item.id) selectCatalogItem(); });
        actionCell.append(remove);
      }
      row.append(titleCell, episodeCell, categoryCell, engineCell, statusCell, actionCell);
      libraryBody.append(row);
    }
  }

  function chooseCatalogById(id) {
    if (active) return;
    const item = CATALOG.find((entry) => entry.id === id);
    if (!item) return;
    categorySelect.value = item.category || 'Other';
    populateTitles();
    titleSelect.value = item.series;
    populateEpisodes();
    if (!episodeField.hidden) episodeSelect.value = item.id;
    selectCatalogItem();
    libraryDialog.close();
    categorySelect.focus();
  }

  function validatePack(pack, catalogId) {
    const story = pack?.story;
    if (!story || typeof story !== 'object') throw new Error('Story Pack must contain a story object.');
    if (!story.id || !story.initialSegment || !story.segments || !story.momentsBySegment) throw new Error('Story Pack is missing required story fields.');
    if (pack.catalogId && pack.catalogId !== catalogId) throw new Error('This Story Pack belongs to a different catalog title.');
    return { story, translations: pack.translations || { en: {} }, subtitles: pack.subtitles || {} };
  }

  function activatePack(pack, item) {
    if (active) return;
    STORY = pack.story;
    TRANSLATIONS = pack.translations || { en: {} };
    BUILTIN_SUBTITLES = pack.subtitles || {};
    if (!STORY.codePrefix) STORY.codePrefix = item.id === 'bandersnatch' ? 'BND' : 'IC';
    const store = new ProgressStore(STORY);
    const engine = new StoryEngine(STORY, store, TRANSLATIONS);
    const subtitles = new SubtitleManager(store);
    const player = new InteractivePlayer(engine, store, subtitles);
    active = { item, store, engine, subtitles, player };
    categorySelect.disabled = true;
    titleSelect.disabled = true;
    episodeSelect.disabled = true;
    packButton.hidden = true;
    movieInput.disabled = false;
    dropZone.classList.remove('is-locked');
    dropTitle.textContent = `Select or drop the master video for ${item.title}`;
    packStatus.textContent = item.builtin ? 'Built-in Story Pack ready.' : 'Story Pack loaded. Movie selection is ready.';
    packStatus.className = 'title-pack-status ready';
    $('#ending-close').addEventListener('click', () => $('#ending-dialog').close());
    $('#ending-rewind').addEventListener('click', () => { $('#ending-dialog').close(); player.rewindLastDecision(); });
    $('#reset-all-button').addEventListener('click', () => {
      if (!confirm(`Reset story progress and player settings for ${item.title}?`)) return;
      store.resetAll();
      location.reload();
    });
    const api = { STORY, store, engine, subtitles, player, catalogItem: item };
    globalThis.InteractiveControler = api;
    if (item.id === 'bandersnatch') globalThis.BandersnatchPlayer = api;
  }

  async function selectCatalogItem() {
    if (active) return;
    const item = selectedCatalogItem();
    renderCatalogNote(item);
    if (!item) {
      packButton.hidden = true;
      movieInput.disabled = true;
      dropZone.classList.add('is-locked');
      dropTitle.textContent = titleSelect.value ? 'Choose an episode' : 'Choose an interactive first';
      packStatus.textContent = titleSelect.value && !episodeField.hidden ? 'Choose an episode to continue.' : 'Choose a category and title to continue.';
      packStatus.className = 'title-pack-status';
      return;
    }
    const builtin = DATA.packs[item.id];
    if (builtin) { activatePack(validatePack(builtin, item.id), item); return; }
    const status = catalogStatus(item);
    movieInput.disabled = true;
    dropZone.classList.add('is-locked');
    dropTitle.textContent = `${item.title} selected`;
    if (status.key === 'adapter-required') {
      packButton.hidden = true;
      packStatus.textContent = 'Catalog entry available, but this interaction model still needs an engine adapter before a Story Pack can run.';
      packStatus.className = 'title-pack-status warning';
      return;
    }
    const stored = readStoredPack(item.id);
    if (stored) {
      try { activatePack(validatePack(JSON.parse(stored), item.id), item); return; }
      catch {
        packButton.hidden = false;
        packStatus.textContent = 'Installed Story Pack is invalid or incompatible. Remove it from Interactive Library or load a verified replacement.';
        packStatus.className = 'title-pack-status warning';
        return;
      }
    }
    packButton.hidden = false;
    packStatus.textContent = 'Catalog entry ready. Exact branching metadata is not bundled; load the verified Story Pack before opening media.';
    packStatus.className = 'title-pack-status warning';
  }

  categorySelect.addEventListener('change', () => {
    populateTitles();
    renderCatalogNote(null);
    selectCatalogItem();
  });
  titleSelect.addEventListener('change', () => {
    populateEpisodes();
    selectCatalogItem();
  });
  episodeSelect.addEventListener('change', selectCatalogItem);
  packInput.addEventListener('change', async () => {
    const file = packInput.files?.[0];
    const item = selectedCatalogItem();
    if (!file || !item) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validated = validatePack(parsed, item.id);
      const saved = writeStoredPack(item.id, text);
      activatePack(validated, item);
      if (!saved) active?.player?.toastMessage('Story Pack loaded for this session, but browser storage could not save it.');
    } catch (error) {
      packStatus.textContent = `Story Pack error: ${error.message}`;
      packStatus.className = 'title-pack-status warning';
      packInput.value = '';
    }
  });
  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    libraryCategoryFilter.append(option);
  }
  libraryButton.addEventListener('click', () => { renderLibrary(); libraryDialog.showModal(); });
  $('#interactive-library-close').addEventListener('click', () => libraryDialog.close());
  librarySearch.addEventListener('input', renderLibrary);
  libraryCategoryFilter.addEventListener('change', renderLibrary);
  libraryStatusFilter.addEventListener('change', renderLibrary);
  populateCatalog();
})();
