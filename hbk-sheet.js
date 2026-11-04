// HBK data-request workbook: build from the live database, read the returned file back as patch ops.
// Structure only (Rule 1): column definitions and layout. Every value comes from the db passed in.
(function (root) {
  if (root.HBKSheet) return;
  var MET = { kN: 0.00444822, mm: 25.4, ms: 0.0254, kg: 0.453592 };
  var STATUS = ['Confirmed', 'Corrected', 'Discontinued', 'Don\u2019t know'];
  var DEFS = [
    { table: 'headExpanders', tab: 'Head expanders', title: 'LDS head expanders',
      blurb: 'One row per standard head expander W5 uses for sizing. Please confirm or correct each value, set Type (guided or unguided), and add any models we are missing \u2014 especially guided head expanders.',
      newRows: 10, newLabel: 'Add missing head expanders below (e.g. guided models, other sizes) \u2014 one per row',
      cols: [
        { key: 'name', label: 'Model / size', w: 34, type: 'text' },
        { key: 'guide', label: 'Type', w: 13, type: 'enum', opts: ['Unguided', 'Guided'], map: { Unguided: 'unguided', Guided: 'guided' } },
        { key: 'wt', label: 'Weight (lb)', w: 11, type: 'num', metric: ['Weight (kg)', MET.kg, '0.0'] },
        { key: 'tb', label: 'Thermal barrier weight (lb)', w: 13, type: 'num', metric: ['Barrier (kg)', MET.kg, '0.0'] },
        { key: 'mode', label: '1st vertical mode (Hz)', w: 12, type: 'num' },
        { key: 'fits', label: 'Fits these shakers', w: 42, type: 'text' }
      ] },
    { table: 'systems', tab: 'Shaker systems', title: 'LDS shaker + amplifier systems',
      blurb: 'One row per shaker/amplifier combination W5 sizes against. Ratings are system ratings (shaker with that amplifier). Please correct anything that differs from the current datasheet, fill the orange cells if you can, and give typical lead times.',
      newRows: 6, newLabel: 'Add missing systems below \u2014 one shaker/amplifier combination per row',
      cols: [
        { key: 'name', label: 'Shaker / amplifier', w: 30, type: 'text' },
        { key: 'phase', label: 'Amplifier power', w: 11, type: 'enum', opts: ['1-phase', '3-phase'], map: { '1-phase': '1ph', '3-phase': '3ph' } },
        { key: 'sine', label: 'Sine force (lbf pk)', w: 11, type: 'num', metric: ['Sine (kN)', MET.kN, '0.00'] },
        { key: 'random', label: 'Random force (lbf rms)', w: 11, type: 'num', metric: ['Random (kN)', MET.kN, '0.00'] },
        { key: 'shock', label: 'Shock force (lbf pk, 2 ms half-sine)', w: 13, type: 'num', metric: ['Shock (kN)', MET.kN, '0.00'] },
        { key: 'disp', label: 'Stroke (in pk-pk)', w: 10, type: 'num', metric: ['Stroke (mm)', MET.mm, '0.0'] },
        { key: 'vel', label: 'Velocity (in/s pk)', w: 10, type: 'num', metric: ['Velocity (m/s)', MET.ms, '0.00'] },
        { key: 'shockVel', label: 'Shock velocity (in/s)', w: 10, type: 'num', metric: ['Shock vel. (m/s)', MET.ms, '0.00'] },
        { key: 'sineAcc', label: 'Max sine accel, bare table (g pk)', w: 12, type: 'num' },
        { key: 'randAcc', label: 'Max random accel, bare table (g rms)', w: 12, type: 'num' },
        { key: 'arm', label: 'Armature weight (lb)', w: 10, type: 'num', metric: ['Armature (kg)', MET.kg, '0.0'] },
        { key: 'load', label: 'Max static payload (lb)', w: 10, type: 'num', metric: ['Payload (kg)', MET.kg, '0'] },
        { key: 'fmin', label: 'Min frequency (Hz)', w: 9, type: 'num' },
        { key: 'fmax', label: 'Max frequency (Hz)', w: 9, type: 'num' },
        { key: 'res', label: 'Armature resonance (Hz)', w: 10, type: 'num' },
        { key: 'dia', label: 'Armature diameter (in)', w: 10, type: 'num', metric: ['Diameter (mm)', MET.mm, '0'] },
        { key: 'leadMin', label: 'Lead time, shortest (weeks)', w: 10, type: 'num' },
        { key: 'leadMax', label: 'Lead time, longest (weeks)', w: 10, type: 'num' },
        { key: 'src', label: 'Datasheet / source', w: 30, type: 'text' }
      ] }
  ];
  var C = { brand: 'FF033E8A', white: 'FFFFFFFF', ink: 'FF16191D', mute: 'FF5A6069', miss: 'FFFFE0B2', chg: 'FFFFF59D', calc: 'FFF0F0F0', add: 'FFE8F0FB', line: 'FFD8D5CF' };
  var fill = function (argb) { return { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } }; };
  var border = { top: { style: 'thin', color: { argb: C.line } }, left: { style: 'thin', color: { argb: C.line } }, bottom: { style: 'thin', color: { argb: C.line } }, right: { style: 'thin', color: { argb: C.line } } };
  var FIRST = 6; // first data row

  function slug(s) { return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function cellVal(v) {
    if (v == null) return null;
    if (typeof v === 'object') {
      if (v.richText) return v.richText.map(function (t) { return t.text; }).join('');
      if ('result' in v) return v.result == null ? null : v.result;
      if (v.text != null) return v.text;
      if (v instanceof Date) return v.toISOString().slice(0, 10);
    }
    return v;
  }
  function specialist(db) {
    var l = (db.links || []).find(function (x) { return x.topic === 'specialist' && /^mailto:/i.test(x.url || ''); });
    return l ? { label: l.label, email: l.url.replace(/^mailto:/i, '').split('?')[0] } : null;
  }
  function layout(def) { // column index (1-based) for each key, plus metric/status/comment columns
    var n = 2, m = [];
    def.cols.forEach(function (c) { m.push({ c: c, col: n++ }); if (c.metric) m.push({ c: c, metric: true, col: n++ }); });
    return { cells: m, status: n, comment: n + 1, last: n + 1 };
  }
  function toSheet(c, v) {
    if (v == null || v === '') return null;
    if (c.type === 'enum') { for (var k in c.map) if (c.map[k] === v) return k; return v; }
    return v;
  }

  function build(ExcelJS, db, opts) {
    opts = opts || {};
    var wb = new ExcelJS.Workbook(); wb.creator = 'W5 Engineering'; wb.created = new Date();
    var sp = specialist(db), today = new Date().toISOString().slice(0, 10);
    var miss = 0, rows = 0;

    var st = wb.addWorksheet('Start here', { views: [{ showGridLines: false }] });
    st.getColumn(1).width = 3; st.getColumn(2).width = 110;
    var line = function (t, o) { var r = st.addRow(['', t]); var c = r.getCell(2); c.alignment = { wrapText: true, vertical: 'top' }; c.font = Object.assign({ name: 'Calibri', size: 12, color: { argb: C.ink } }, o || {}); return r; };
    line('W5 Engineering \u2014 LDS data check for HBK', { size: 18, bold: true, color: { argb: C.brand } }).height = 30;
    line('W5 uses these numbers to size LDS systems for customers on sales calls. Please check them against your current datasheets and correct anything that is wrong or missing. It should take about 20\u201330 minutes.', { size: 12 }).height = 36;
    line('');
    line('How to fill it in', { bold: true, size: 14, color: { argb: C.brand } });
    [
      '1.  Open the "Head expanders" and "Shaker systems" tabs (at the bottom).',
      '2.  White cells show the value W5 has today. If it is wrong, type the correct value over it \u2014 the cell turns yellow so we can see what you changed.',
      '3.  Orange cells are values W5 does not have. Please fill them in if you know them.',
      '4.  Set the Status column on each row: Confirmed, Corrected, Discontinued or Don\u2019t know.',
      '5.  Add any models we are missing (for example guided head expanders) in the light-blue rows at the bottom of each tab.',
      '6.  Use the Comments column for anything else \u2014 limits, options, notes on a value.',
      '7.  Save the file (keep it as .xlsx, do not rename the tabs) and email it back' + (sp ? ' to ' + sp.label + ' \u2014 ' + sp.email : '') + '.'
    ].forEach(function (t) { line(t).height = 32; });
    line('');
    line('Colour key', { bold: true, size: 14, color: { argb: C.brand } });
    [['White', null, 'W5\u2019s current value \u2014 change it if it is wrong'], ['Orange', C.miss, 'Missing \u2014 please fill in if known'], ['Yellow', C.chg, 'You changed this (appears automatically)'], ['Grey', C.calc, 'Metric conversion, calculated for reference \u2014 no need to type here'], ['Light blue', C.add, 'New rows for models W5 does not list yet']].forEach(function (k) {
      var r = line(k[0] + '  \u2014  ' + k[2]); if (k[1]) r.getCell(2).fill = fill(k[1]); r.getCell(2).border = border; r.height = 22;
    });
    line('');
    line('Units', { bold: true, size: 14, color: { argb: C.brand } });
    line('Values are in the units shown in each column heading (lbf, lb, in, in/s). The grey columns next to them show the metric equivalent so you can compare with metric datasheets. If you prefer to answer in metric, write the value and unit in Comments and we will convert it.').height = 48;
    line('');
    line('Prepared ' + today + ' from W5 database version ' + (db.version || '\u2014') + '. Please do not edit the hidden columns.', { size: 10, color: { argb: C.mute } });

    var orig = wb.addWorksheet('_original', { state: 'veryHidden' });

    DEFS.forEach(function (def) {
      var L = layout(def), ws = wb.addWorksheet(def.tab, { views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }] });
      var data = (db[def.table] || []).filter(function (r) { return r.active !== false && !(def.table === 'headExpanders' && !(r.wt > 0)); });
      ws.getColumn(1).width = 4; ws.getColumn(1).hidden = true;
      L.cells.forEach(function (x) { ws.getColumn(x.col).width = x.metric ? 10 : x.c.w; });
      ws.getColumn(L.status).width = 14; ws.getColumn(L.comment).width = 44;
      var lastL = ws.getColumn(L.last).letter;
      ws.mergeCells('B1:' + lastL + '1'); ws.getCell('B1').value = def.title; ws.getCell('B1').font = { size: 16, bold: true, color: { argb: C.brand } }; ws.getRow(1).height = 26;
      ws.mergeCells('B2:' + lastL + '2'); ws.getCell('B2').value = def.blurb; ws.getCell('B2').alignment = { wrapText: true, vertical: 'top' }; ws.getRow(2).height = 34;
      ws.mergeCells('B3:' + lastL + '3'); ws.getCell('B3').value = 'White = our value (type over it if wrong) \u00b7 Orange = missing, please fill \u00b7 Yellow = you changed it \u00b7 Grey = metric, calculated \u00b7 Light blue = new models';
      ws.getCell('B3').font = { size: 10, color: { argb: C.mute } };
      var hr = ws.getRow(4), kr = ws.getRow(5);
      hr.height = 48; kr.hidden = true;
      kr.getCell(1).value = '__keys'; hr.getCell(1).value = 'id';
      L.cells.forEach(function (x) { hr.getCell(x.col).value = x.metric ? x.c.metric[0] : x.c.label; kr.getCell(x.col).value = x.metric ? '__calc' : x.c.key; });
      hr.getCell(L.status).value = 'Status'; kr.getCell(L.status).value = '__status';
      hr.getCell(L.comment).value = 'Comments'; kr.getCell(L.comment).value = '__comment';
      for (var ci = 2; ci <= L.last; ci++) { var h = hr.getCell(ci); h.font = { bold: true, color: { argb: C.white }, size: 10 }; h.fill = fill(C.brand); h.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; h.border = border; }
      L.cells.forEach(function (x) { if (x.metric) { var h = hr.getCell(x.col); h.fill = fill('FF5B7FB5'); } });

      var rowNo = FIRST;
      var writeRow = function (rec, isNew) {
        var r = ws.getRow(rowNo), o = orig.getRow(rowNo);
        r.getCell(1).value = rec ? rec.id : null;
        L.cells.forEach(function (x) {
          var cell = r.getCell(x.col), colL = ws.getColumn(x.col).letter, src = ws.getColumn(x.col - 1).letter;
          cell.border = border; cell.alignment = { vertical: 'middle', wrapText: x.c.type === 'text' };
          if (x.metric) {
            cell.value = { formula: 'IF(ISNUMBER(' + src + rowNo + '),' + src + rowNo + '*' + x.c.metric[1] + ',"")' };
            cell.numFmt = x.c.metric[2]; cell.fill = fill(C.calc); cell.font = { color: { argb: C.mute }, size: 10 };
            return;
          }
          var v = rec ? toSheet(x.c, rec[x.c.key]) : null;
          cell.value = v; o.getCell(x.col).value = v;
          if (isNew) cell.fill = fill(C.add);
          else if (v == null) { cell.fill = fill(C.miss); miss++; }
          if (x.c.type === 'enum') cell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + x.c.opts.join(',') + '"'], showErrorMessage: true, errorTitle: 'Pick from the list', error: 'Choose one of: ' + x.c.opts.join(', ') };
          if (x.c.type === 'num') cell.dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [0], showErrorMessage: true, errorTitle: 'Number only', error: 'Type a number in the unit shown in the heading. Put text in Comments.' };
        });
        var s = r.getCell(L.status), cm = r.getCell(L.comment);
        s.dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + STATUS.join(',') + '"'] };
        [s, cm].forEach(function (c) { c.border = border; c.alignment = { vertical: 'middle', wrapText: true }; if (isNew) c.fill = fill(C.add); });
        r.height = isNew ? 20 : 30; rowNo++; rows++;
      };
      data.forEach(function (rec) { writeRow(rec, false); });
      var firstEdit = ws.getColumn(2).letter;
      // yellow = changed vs. what we sent
      L.cells.forEach(function (x) {
        if (x.metric) return; var colL = ws.getColumn(x.col).letter, ref = colL + FIRST;
        ws.addConditionalFormatting({ ref: colL + FIRST + ':' + colL + (rowNo - 1), rules: [{ type: 'expression', priority: 1, formulae: ['AND(' + ref + '&""<>_original!' + ref + '&"",$A' + FIRST + '<>"")'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.chg } } } }] });
      });
      var sec = ws.getRow(rowNo); sec.getCell(1).value = '__section';
      ws.mergeCells(firstEdit + rowNo + ':' + lastL + rowNo); sec.getCell(2).value = def.newLabel; sec.getCell(2).font = { bold: true, color: { argb: C.brand } }; sec.height = 24; rowNo++;
      for (var n = 0; n < def.newRows; n++) writeRow(null, true);
    });
    return wb.xlsx.writeBuffer().then(function (buf) { return { buffer: buf, missing: miss, rows: rows, filename: 'W5 LDS data check for HBK ' + today + '.xlsx' }; });
  }

  function parse(ExcelJS, buf, db) {
    var wb = new ExcelJS.Workbook();
    return wb.xlsx.load(buf).then(function () {
      var out = { changes: [], adds: [], retire: [], notes: [], warnings: [], sheets: 0 };
      DEFS.forEach(function (def) {
        var ws = wb.getWorksheet(def.tab);
        if (!ws) { out.warnings.push('Tab "' + def.tab + '" not found \u2014 skipped.'); return; }
        out.sheets++;
        var keyRow = null; ws.eachRow({ includeEmpty: false }, function (r, i) { if (!keyRow && String(cellVal(r.getCell(1).value) || '') === '__keys') keyRow = i; });
        if (!keyRow) { out.warnings.push('"' + def.tab + '": this is not the W5 template (hidden key row missing).'); return; }
        var keys = {}; ws.getRow(keyRow).eachCell(function (c, col) { keys[col] = String(cellVal(c.value) || ''); });
        var byKey = {}; def.cols.forEach(function (c) { byKey[c.key] = c; });
        var rows = db[def.table] || [];
        ws.eachRow({ includeEmpty: false }, function (r, i) {
          if (i <= keyRow) return;
          var id = String(cellVal(r.getCell(1).value) || '').trim();
          if (id.indexOf('__') === 0) return;
          var vals = {}, status = '', comment = '', bad = [];
          Object.keys(keys).forEach(function (col) {
            var k = keys[col], raw = cellVal(r.getCell(+col).value);
            if (k === '__status') { status = String(raw || '').trim(); return; }
            if (k === '__comment') { comment = String(raw || '').trim(); return; }
            var c = byKey[k]; if (!c) return;
            if (raw == null || String(raw).trim() === '') { vals[k] = null; return; }
            if (c.type === 'num') { var n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, '').trim()); if (!isFinite(n)) { bad.push(c.label + ' = "' + raw + '"'); return; } vals[k] = n; }
            else if (c.type === 'enum') { var s = String(raw).trim(); vals[k] = c.map[s] || (Object.values(c.map).indexOf(s) >= 0 ? s : null); if (vals[k] == null) bad.push(c.label + ' = "' + raw + '"'); }
            else vals[k] = String(raw).trim();
          });
          var name = vals.name || '';
          if (!id && !name) return;
          var rec = id ? rows.find(function (x) { return x.id === id; }) : null;
          var label = name || (rec && rec.name) || id;
          if (bad.length) out.warnings.push(def.tab + ' \u203a ' + label + ': not read \u2014 ' + bad.join('; '));
          if (id && !rec) { out.warnings.push(def.tab + ' \u203a ' + label + ': row id "' + id + '" is no longer in the database \u2014 skipped.'); return; }
          if (rec) {
            def.cols.forEach(function (c) {
              if (!(c.key in vals)) return;
              var a = rec[c.key] == null || rec[c.key] === '' ? null : rec[c.key], b = vals[c.key];
              var same = c.type === 'num' ? (a == null && b == null) || (a != null && b != null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a))) : String(a == null ? '' : a) === String(b == null ? '' : b);
              if (!same) out.changes.push({ table: def.table, tab: def.tab, id: id, name: label, field: c.key, label: c.label, from: a, to: b, clears: b == null });
            });
            if (/^discontinued$/i.test(status)) out.retire.push({ table: def.table, tab: def.tab, id: id, name: label });
          } else {
            var nid = slug(name), clash = rows.some(function (x) { return x.id === nid; });
            if (clash) { out.warnings.push(def.tab + ' \u203a ' + name + ': a row with id "' + nid + '" already exists \u2014 add it by hand if it is different.'); return; }
            var row = { active: true }; def.cols.forEach(function (c) { if (vals[c.key] != null) row[c.key] = vals[c.key]; });
            if (def.table === 'headExpanders') { if (row.tb == null) row.tb = 0; }
            if (def.table === 'systems') { var parts = name.split(' / '); row.shaker = row.shaker || parts[0]; row.amp = row.amp || (parts[1] || ''); }
            out.adds.push({ table: def.table, tab: def.tab, id: nid, name: name, row: row });
          }
          if (comment || (status && !/^confirmed$/i.test(status))) out.notes.push({ table: def.table, tab: def.tab, id: id || slug(name), name: label, status: status, comment: comment });
        });
      });
      return out;
    });
  }

  function ops(res, pick, who) {
    var o = [], stamp = 'HBK ' + new Date().toISOString().slice(0, 10) + (who ? ' (' + who + ')' : '');
    var byRow = {};
    res.changes.forEach(function (c, i) { if (!pick['c' + i]) return; var k = c.table + '|' + c.id; (byRow[k] = byRow[k] || { table: c.table, id: c.id, patch: {} }).patch[c.field] = c.to; });
    res.retire.forEach(function (r, i) { if (!pick['r' + i]) return; var k = r.table + '|' + r.id; (byRow[k] = byRow[k] || { table: r.table, id: r.id, patch: {} }).patch.active = false; });
    res.notes.forEach(function (n, i) {
      if (!pick['n' + i]) return; var k = n.table + '|' + n.id; var memo = stamp + ': ' + [n.status, n.comment].filter(Boolean).join(' \u2014 ');
      (byRow[k] = byRow[k] || { table: n.table, id: n.id, patch: {} }).memo = memo;
    });
    res.adds.forEach(function (a, i) { if (!pick['a' + i]) return; var k = a.table + '|' + a.id; byRow[k] = Object.assign(byRow[k] || {}, { table: a.table, id: a.id, patch: Object.assign({}, a.row, (byRow[k] || {}).patch) }); });
    Object.keys(byRow).forEach(function (k) { o.push(byRow[k]); });
    return o;
  }

  root.HBKSheet = { DEFS: DEFS, build: build, parse: parse, ops: ops, EXCELJS: 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js' };
})(typeof window !== 'undefined' ? window : this);
