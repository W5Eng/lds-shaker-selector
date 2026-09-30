// guard.js — runtime firewall + the scanners the Inspector runs. Name lists are built FROM the database.
(function (root) {
  var cfg = root.DB_CONFIG || {}; var prefix = cfg.cachePrefix || 'lds.';
  var violations = [];
  function badge() {
    var b = document.getElementById('__guard-badge');
    if (!b) { b = document.createElement('div'); b.id = '__guard-badge'; b.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;background:#b3261e;color:#fff;font:12px/1.3 system-ui;padding:6px 10px;border-radius:8px;max-width:60vw'; document.body.appendChild(b); }
    b.textContent = 'Storage rule: ' + violations.length + ' blocked write(s) — ' + violations[violations.length - 1];
  }
  // Deny-by-default storage writes outside the allow-listed prefix.
  try {
    var set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (String(k).indexOf(prefix) !== 0 && String(k).indexOf('__om') !== 0 && String(k).indexOf('dc') !== 0) { violations.push(k); console.warn('[guard] blocked storage write', k); badge(); return; }
      return set.call(this, k, v);
    };
  } catch (e) {}

  var INTERNAL_WORDS = ['token', 'mutate', 'Workbench', 'checkpoint', 'projection', 'admin', 'Inspector', 'generalExtras'];

  function lines(text) { return text.split('\n'); }
  function finding(file, ln, text, rule, what, how, severity) { return { file: file, line: ln + 1, text: text.trim().slice(0, 160), rule: rule, what: what, how: how, severity: severity || 'violation' }; }
  function isComment(l) { return /^\s*(\/\/|\*|\/\*|<!--)/.test(l); }

  var Guard = {
    violations: function () { return violations.slice(); },
    // Rule 1: hardcoded data — tokens built FROM the database
    scanHardcoded: function (files, db) {
      var names = [];
      (db.systems || []).forEach(function (s) { names.push(s.name); });
      (db.headExpanders || []).forEach(function (h) { if (h.name && h.name !== 'None') names.push(h.name); });
      (db.kb || []).forEach(function (k) { if (k.title) names.push(k.title); });
      (db.links || []).forEach(function (l) { if (l.url) names.push(l.url); });
      var out = [];
      Object.keys(files).forEach(function (f) {
        if (/seed\//.test(f)) return;
        lines(files[f]).forEach(function (l, i) {
          if (/data-omelette|__om|support\.js/.test(l)) return; // host-injected, not our code
          var note = isComment(l);
          names.forEach(function (n) { if (n && n.length > 3 && l.indexOf(n) >= 0) out.push(finding(f, i, l, 'Rule 1', 'This file contains "' + n + '", a value that lives in the database. Files hold structure only.', 'Read it from DB.data() at runtime and delete the literal.', note ? 'note' : 'violation')); });
          // fallback literal on a DATABASE field (systems/heads/kb/links/generalExtras), not UI copy
          if (/\b(s|sys|h|he|k|kb|l|link|GE|ge|generalExtras|db)\.(name|shaker|amp|src|title|body|url|label|feedbackEmail|supportPhone|betaLabel)\s*(\|\||\?\?)\s*['"][A-Za-z@][^'"]{2,}['"]/.test(l) && !note) out.push(finding(f, i, l, 'Rule 1', 'A fallback literal (x || "text") invents a value when the database has none.', 'Show an empty state instead of a made-up value.'));
          if (/localStorage\.setItem\(\s*['"](?!lds\.)/.test(l) || /sessionStorage\.setItem\(/.test(l)) out.push(finding(f, i, l, 'Rule 9', 'A storage write outside the allowed "lds." prefix. Storage is a render cache only.', 'Prefix the key with "lds." or remove the write.', note ? 'note' : 'violation'));
          if (/import\(.*(seed|lds-data|\.json)/.test(l) || /fetch\(.*\.(json|md)['")]/.test(l)) out.push(finding(f, i, l, 'Rule 9', 'A page is loading data from a file instead of the server document.', 'Replace with DB.ready() / DB.data().', note ? 'note' : 'violation'));
        });
      });
      return out;
    },
    // Rule 2: internal vocabulary on public files
    scanPublicWords: function (files, publicFiles) {
      var out = [];
      publicFiles.forEach(function (f) {
        if (!files[f] || /db-client|guard|projection|db-config/.test(f)) return;
        lines(files[f]).forEach(function (l, i) {
          INTERNAL_WORDS.forEach(function (w) {
            var re = new RegExp('\\b' + w + '\\b'); if (!re.test(l)) return;
            var inText = /['"`][^'"`]*\b__W__\b[^'"`]*['"`]/.replace ? new RegExp('[\'"`>][^\'"`<]*\\b' + w + '\\b[^\'"`<]*[\'"`<]').test(l) : true;
            out.push(finding(f, i, l, 'Rule 2', '"' + w + '" is internal vocabulary; the public surface is read by outsiders.', 'Reword or move to the Workbench.', inText && !isComment(l) ? 'violation' : 'note'));
          });
        });
      });
      return out;
    },
    // Rule 7: notes read as data
    scanNotes: function (files) {
      var out = [];
      Object.keys(files).forEach(function (f) { lines(files[f]).forEach(function (l, i) { if (/\.notes?\s*(===|==|!==|\.match|\.split|\.includes|\.indexOf|\.test)/.test(l)) out.push(finding(f, i, l, 'Rule 7', 'Code is reading a note to make a decision. Notes are memos.', 'Add a structured field and pick from a closed set.')); }); });
      return out;
    },
    // Rule 8: duplicate ids / missing ids in data
    scanIds: function (db) {
      var out = [];
      ['systems', 'headExpanders', 'kb', 'links', 'feedback', 'releases'].forEach(function (t) {
        var seen = {}; (db[t] || []).forEach(function (r, i) {
          if (!r.id) out.push({ file: t, line: i + 1, text: JSON.stringify(r).slice(0, 120), rule: 'Rule 8', what: 'A row without a stable id cannot be edited safely.', how: 'Workbench → ' + t + ': give it an id.' });
          else if (seen[r.id]) out.push({ file: t, line: i + 1, text: r.id, rule: 'Rule 8', what: 'Two rows share id "' + r.id + '" (twins).', how: 'Workbench → ' + t + ': merge or rename one.' });
          seen[r.id] = 1;
        });
      });
      return out;
    },
    // Rule 3 (domain): a system whose random rating exceeds sine × 1.5 or lead min > max etc.
    scanSoundness: function (db) {
      var out = [];
      (db.systems || []).forEach(function (s) {
        if (s.leadMin && s.leadMax && s.leadMin > s.leadMax) out.push({ file: 'systems', line: s.id, text: s.name, rule: 'Data', what: 'Lead-time minimum is greater than maximum.', how: 'Workbench → Library → ' + s.name + ': fix leadMin/leadMax.' });
        if (!s.sine && !s.random) out.push({ file: 'systems', line: s.id, text: s.name, rule: 'Data', what: 'No force rating at all — this system can never be sized.', how: 'Workbench → Library → ' + s.name + ': enter sine or random force, or deactivate.' });
        if (!s.arm) out.push({ file: 'systems', line: s.id, text: s.name, rule: 'Data', what: 'Missing armature weight — moving mass cannot be computed.', how: 'Workbench → Library → ' + s.name + ': enter armature weight (lb).' });
        if (s.phase !== '1ph' && s.phase !== '3ph') out.push({ file: 'systems', line: s.id, text: s.name, rule: 'Data', what: 'Power phase is not set; the single-phase filter cannot judge this system.', how: 'Workbench → Library → ' + s.name + ': set phase.' });
      });
      return out;
    }
  };
  root.Guard = Guard;
})(window);
