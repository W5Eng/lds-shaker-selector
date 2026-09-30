// db-client.js — the ONE way any page reads or writes the server document (Rule 9).
// Reads: public-get (no token) for the public surface; get (signed-in domain user) for internal apps.
// Writes are STAGED locally as ops and sent with push(). Cache: one localStorage key under DB_CONFIG.cachePrefix.
(function (root) {
  var cfg = root.DB_CONFIG || {};
  var state = { db: null, mode: 'public', pending: [], subs: [], ready: null, err: null, polling: null, me: null, idToken: null };
  var CACHE = (cfg.cachePrefix || 'lds.') + 'db.cache';

  function call(endpoint, body) {
    if (!endpoint) return Promise.reject(new Error('Database not connected — open the Workbench → Connect.'));
    if (state.idToken) body.idToken = state.idToken; // held in memory only, never stored
    return fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' })
      .then(function (r) { return r.text(); })
      .then(function (t) { var j; try { j = JSON.parse(t); } catch (e) { throw new Error('Server returned non-JSON (check deployment access)'); } if (j.error) throw new Error(j.error); return j; });
  }
  function emit() { state.subs.forEach(function (f) { try { f(state.db, state); } catch (e) { console.error(e); } }); }
  function readCache() { try { return JSON.parse(localStorage.getItem(CACHE)); } catch (e) { return null; } }
  function writeCache(db) { try { localStorage.setItem(CACHE, JSON.stringify(db)); } catch (e) {} }

  function applyOps(db, ops) {
    ops.forEach(function (op) {
      var rows = db[op.table] = db[op.table] || [];
      var i = -1; for (var k = 0; k < rows.length; k++) if (rows[k].id === op.id) { i = k; break; }
      if (op.delete) { if (i >= 0) rows.splice(i, 1); return; }
      if (i < 0) rows.push(Object.assign({ id: op.id }, op.patch));
      else if (op.replace) rows[i] = Object.assign({ id: op.id }, op.patch);
      else Object.assign(rows[i], op.patch);
    });
  }

  var DB = {
    setIdToken: function (t) { state.idToken = t || null; state.ready = null; },
    signedIn: function () { return !!state.idToken; },
    configure: function (o) { Object.assign(cfg, o || {}); if (o && o.mode) state.mode = o.mode; return DB; },
    connected: function () { return !!(state.mode === 'staff' ? cfg.admin : cfg.read); },
    endpoint: function () { return state.mode === 'staff' ? cfg.admin : cfg.read; },
    ready: function () {
      if (state.ready) return state.ready;
      var cached = readCache(); if (cached) { state.db = cached; emit(); }
      var action = state.mode === 'staff' ? 'get' : 'public-get';
      state.ready = call(DB.endpoint(), { action: action }).then(function (j) {
        state.db = j.db; state.me = j.me || null; state.err = null; writeCache(j.db); emit(); DB.poll(); return state.db;
      }).catch(function (e) { state.err = e.message; emit(); if (cached) return cached; throw e; });
      return state.ready;
    },
    refresh: function () { state.ready = null; return DB.ready(); },
    poll: function (ms) {
      clearInterval(state.polling);
      state.polling = setInterval(function () {
        var action = state.mode === 'staff' ? 'since' : 'public-since';
        call(DB.endpoint(), { action: action, version: state.db && state.db.version }).then(function (j) {
          if (j.db) { state.db = j.db; writeCache(j.db); if (state.pending.length) applyOps(state.db, state.pending); emit(); }
        }).catch(function () {});
      }, ms || 30000);
    },
    data: function () { return state.db; },
    me: function () { return state.me; },
    error: function () { return state.err; },
    subscribe: function (f) { state.subs.push(f); if (state.db) f(state.db, state); return function () { state.subs = state.subs.filter(function (x) { return x !== f; }); }; },
    mutate: function (ops, desc) { ops = Array.isArray(ops) ? ops : [ops]; ops.forEach(function (o) { o.desc = desc; }); state.pending = state.pending.concat(ops); if (state.db) applyOps(state.db, ops); emit(); return DB; },
    pending: function () { return state.pending.slice(); },
    discard: function () { state.pending = []; return DB.refresh(); },
    push: function (desc) {
      if (!state.pending.length) return Promise.resolve(state.db);
      var ops = state.pending; state.pending = [];
      return call(cfg.admin, { action: 'mutate', ops: ops, desc: desc || ops.map(function (o) { return o.desc; }).filter(Boolean).join('; '), base: state.db && state.db.version })
        .then(function (j) { state.db = j.db; writeCache(j.db); emit(); return j.db; })
        .catch(function (e) { state.pending = ops.concat(state.pending); state.err = e.message; emit(); throw e; });
    },
    checkpoint: function (label) { return call(cfg.admin, { action: 'checkpoint', label: label }); },
    history: function () { return call(cfg.admin, { action: 'history' }); },
    activate: function (id) { return call(cfg.admin, { action: 'activate', id: id }).then(function (j) { state.db = j.db; writeCache(j.db); emit(); return j.db; }); },
    seed: function (doc) { return call(cfg.admin, { action: 'seed', doc: doc }).then(function (j) { state.db = j.db; writeCache(j.db); emit(); return j.db; }); },
    publish: function (payload) { return call(cfg.admin, Object.assign({ action: 'publish' }, payload)); },
    feedback: function (fb) { return call(cfg.read || cfg.admin, { action: 'feedback', feedback: fb }); },
    ping: function (which) { return call(which === 'admin' ? cfg.admin : cfg.read, { action: 'ping' }); }
  };
  root.DB = DB;
})(window);
