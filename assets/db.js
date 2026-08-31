/* =============================================================================
   db.js — persistence.

   The application ships with a fixed base graph compiled into the bundle. Every
   change a user makes is recorded as an RDF delta: a list of triples added (and
   occasionally retracted) on top of that base. The delta lives in localStorage,
   so edits survive a reload without any server.

   This is not a workaround, it is how versioned triple stores actually work. A
   named graph of additions layered over an immutable base is the same idea as a
   changeset in a quad store, and it means the whole edit history is itself RDF
   and can be exported alongside the data.

   Because it is browser storage, the delta is per browser and per device. It is
   not shared between users. For shared state you would put the same delta
   behind an HTTP endpoint.
   ========================================================================== */
var DB = (function () {
  'use strict';

  var DELTA_KEY = 'medisem.delta.v1';
  var SESSION_KEY = 'medisem.session.v1';
  var PREFS_KEY = 'medisem.prefs.v1';

  function safeParse(text, fallback) {
    if (!text) return fallback;
    try { return JSON.parse(text); } catch (e) { return fallback; }
  }
  function available() {
    try {
      window.localStorage.setItem('medisem.probe', '1');
      window.localStorage.removeItem('medisem.probe');
      return true;
    } catch (e) { return false; }
  }
  var HAS_STORAGE = available();
  var memory = { delta: [], session: null, prefs: {} };

  function readDelta() {
    if (!HAS_STORAGE) return memory.delta;
    return safeParse(window.localStorage.getItem(DELTA_KEY), []);
  }
  function writeDelta(list) {
    if (!HAS_STORAGE) { memory.delta = list; return; }
    try {
      window.localStorage.setItem(DELTA_KEY, JSON.stringify(list));
    } catch (e) {
      // Quota exhausted. Keep going in memory rather than losing the session.
      memory.delta = list;
      HAS_STORAGE = false;
    }
  }

  /* ---- the changeset ---------------------------------------------------- */

  /**
   * Record new triples. Each entry is [subject, predicate, object] using the
   * same N-Triples term encoding the store uses, plus metadata describing who
   * made the change and when, so the audit trail is queryable.
   */
  function addTriples(triples, meta) {
    var list = readDelta();
    var stamp = new Date().toISOString();
    triples.forEach(function (t) {
      list.push({
        op: 'add', s: t[0], p: t[1], o: t[2],
        at: stamp,
        by: (meta && meta.by) || (currentSession() ? currentSession().accountIri : 'unknown'),
        why: (meta && meta.why) || 'edit'
      });
    });
    writeDelta(list);
    return list.length;
  }

  function retractTriples(triples, meta) {
    var list = readDelta();
    var stamp = new Date().toISOString();
    triples.forEach(function (t) {
      list.push({
        op: 'remove', s: t[0], p: t[1], o: t[2], at: stamp,
        by: (meta && meta.by) || (currentSession() ? currentSession().accountIri : 'unknown'),
        why: (meta && meta.why) || 'edit'
      });
    });
    writeDelta(list);
    return list.length;
  }

  /** Replay the changeset onto a store. Additions first, then retractions. */
  function applyTo(store) {
    var list = readDelta(), added = 0, removed = 0;
    list.forEach(function (e) {
      if (e.op === 'add') { if (store.add(e.s, e.p, e.o)) added++; }
    });
    list.forEach(function (e) {
      if (e.op === 'remove') { if (store.remove && store.remove(e.s, e.p, e.o)) removed++; }
    });
    return { entries: list.length, added: added, removed: removed };
  }

  function deltaEntries() { return readDelta(); }
  function deltaCount() { return readDelta().length; }
  function clearDelta() {
    if (HAS_STORAGE) window.localStorage.removeItem(DELTA_KEY);
    memory.delta = [];
  }

  /** A fresh local identifier for a newly created record. */
  var counter = 0;
  function mintId(prefix) {
    counter++;
    var stamp = Date.now().toString(36).slice(-5).toUpperCase();
    return prefix + '_L' + stamp + counter;
  }

  /* ---- session ---------------------------------------------------------- */
  function currentSession() {
    if (!HAS_STORAGE) return memory.session;
    return safeParse(window.localStorage.getItem(SESSION_KEY), null);
  }
  function setSession(session) {
    if (!HAS_STORAGE) { memory.session = session; return; }
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  function clearSession() {
    if (HAS_STORAGE) window.localStorage.removeItem(SESSION_KEY);
    memory.session = null;
  }

  /* ---- preferences ------------------------------------------------------ */
  function prefs() {
    if (!HAS_STORAGE) return memory.prefs;
    return safeParse(window.localStorage.getItem(PREFS_KEY), {});
  }
  function setPref(key, value) {
    var p = prefs();
    p[key] = value;
    if (HAS_STORAGE) window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    else memory.prefs = p;
  }

  return {
    hasStorage: function () { return HAS_STORAGE; },
    addTriples: addTriples,
    retractTriples: retractTriples,
    applyTo: applyTo,
    deltaEntries: deltaEntries,
    deltaCount: deltaCount,
    clearDelta: clearDelta,
    mintId: mintId,
    currentSession: currentSession,
    setSession: setSession,
    clearSession: clearSession,
    prefs: prefs,
    setPref: setPref
  };
})();
