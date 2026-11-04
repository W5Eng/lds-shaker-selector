// HBK questionnaire — question structure shared by the public form and the Workbench.
// Structure only (Rule 1): numbers shown as "current" come from the database passed in (generalExtras, systems).
(function (root) {
  if (root.HBKQ) return;
  function pct(v) { return v == null ? 'the configured' : Math.round(v * 100) + '%'; }
  function list(db) {
    db = db || {}; var ge = db.generalExtras || {};
    return [
      { code: 'A', title: 'Sizing rules', qs: [
        { id: 'A1', title: 'Headroom', text: 'Today the tool recommends the smallest system whose peak force is at or below ' + pct(ge.headroom) + ' of the datasheet rating. Stroke, velocity and frequency range are pass/fail against the rating, with no margin.',
          opts: ['Agree', 'Use a different force margin', 'Also apply a margin to stroke / velocity'], val: 'Margin you would use (%)' },
        { id: 'A2', title: 'Random peak factor', text: 'Random force = Grms × moving mass. Displacement and velocity peaks are taken at ' + (ge.sigma || 3) + 'σ. LDS random ratings are used as printed on the datasheet (ISO 5344).',
          opts: ['Agree', 'Use a different σ', 'Correct the random rating for payload / armature mass'], val: 'Value or rule' },
        { id: 'A3', title: 'Shock', text: 'Shock force = peak g × moving mass, checked against the datasheet shock rating (which assumes a 2 ms half-sine). Velocity change and stroke are worked out from the customer’s own pulse and checked pass/fail. Long pulses are usually limited by stroke and velocity.',
          opts: ['Agree', 'Use a different rule for long pulses', 'Assume a pre/post-pulse compensation factor'], val: 'Pulse length (ms) or factor' },
        { id: 'A4', title: 'Missing ratings', text: 'When a datasheet gives no random rating, the tool screens against the sine rating; with no shock rating it screens against 2× sine. Both are marked “confirm with HBK”, never shown as a pass.',
          opts: ['Agree', 'Use different ratios', 'Never size those systems for that test'], val: 'Random ≈ __× sine, shock ≈ __× sine' },
        { id: 'A5', title: 'Fixture estimate', text: 'When the fixture weight is unknown, the tool suggests 1.5× the test article weight as a starting estimate and flags it.',
          opts: ['Agree', 'Use a different multiple', 'It depends'], val: 'Multiple or rule' },
        { id: 'A6', title: 'Head expanders', text: 'The tool adds the head expander weight (plus thermal barrier when used) to the moving mass and warns when the test goes above the expander’s first vertical mode. Weights and sizes themselves are in the separate Excel data check.',
          opts: ['Agree', 'Also derate force near the first mode', 'Guided expanders need a different rule'], val: 'Derate above __% of first mode / rule' }
      ] },
      { code: 'B', title: 'Library facts to confirm', qs: [
        { id: 'B1', title: 'V721 or V722', text: 'A recent quote names a V722; the datasheet folder W5 has lists a V721 with matching ratings. Which is the current model name, and are the ratings identical?' },
        { id: 'B2', title: 'Single-phase limit', text: 'With 120/208 V single-phase power, the tool offers only systems with LPA amplifiers. Is that the right cut, and what is the largest system HBK will quote on single phase?' },
        { id: 'B3', title: 'Lead times', text: 'Typical lead time today, in weeks, per shaker family. “Tool today” is what W5 shows salespeople now. Leave blank if it is unchanged.', table: 'lead' },
        { id: 'B4', title: 'Slip-table moving weights', text: 'The tool asks the salesperson for the slip-table moving weight. A standard value per size would remove that question. Please give plate + driver-bar weights for the sizes you quote most.' },
        { id: 'B5', title: 'Weights to double-check', text: 'Not every armature, head expander or slip-table weight was available to W5. Which systems in the current lineup should we double-check?' }
      ] },
      { code: 'C', title: 'Judgment calls the tool should copy', qs: [
        { id: 'C1', title: 'Next family up', text: 'Recent quote: 6 kN, 2 in stroke, slip table and head expander. The tool agrees with HBK’s pick (V830-335 with SPA16K amplifier). Would you ever propose a V850 instead — and what would tip it?' },
        { id: 'C2', title: 'Offering the next size', text: 'Recent quote: 1 kg circuit board, 120 V single-phase only. The tool agrees with the V650 at about 27 Grms bare table; HBK also quoted the next size up. What is your rule for offering the next size — headroom, future payloads or stroke?' },
        { id: 'C3', title: 'Replacing another brand', text: 'On a recent replacement of another manufacturer’s shaker, HBK noted the proposed system could not match the old one’s shock performance. Should the tool warn when a customer is replacing another brand and lists shock? At what threshold?' },
        { id: 'C4', title: 'Isolation', text: 'Air isolation covers most installs; a seismic mass is rare. Please complete the rule: “Air isolation is standard; a seismic mass is needed only when …”' },
        { id: 'C5', title: 'Closed orders for calibration', text: 'Please share 3–5 closed orders with the customer’s test profile (PSD table, sine, shock), test article + fixture weight, head expander / slip table, and the system that shipped. Customer names can be removed.' }
      ] },
      { code: 'D', title: 'Anything else', qs: [
        { id: 'D1', title: 'Other corrections or advice', text: 'Anything else the tool gets wrong, or that a W5 salesperson should always ask before quoting an LDS system.' }
      ] }
    ];
  }
  function families(db) { // lead-time rows built from the systems table
    var m = {};
    ((db && db.systems) || []).filter(function (s) { return s.active !== false; }).forEach(function (s) {
      var f = s.shaker || String(s.name || '').split(' / ')[0]; if (!f) return;
      var r = m[f] = m[f] || { fam: f, mins: [], maxs: [] };
      if (s.leadMin != null) r.mins.push(s.leadMin); if (s.leadMax != null) r.maxs.push(s.leadMax);
    });
    return Object.keys(m).sort(function (a, b) { return a.localeCompare(b, 'en', { numeric: true }); }).map(function (k) {
      var r = m[k]; var lo = r.mins.length ? Math.min.apply(null, r.mins) : null, hi = r.maxs.length ? Math.max.apply(null, r.maxs) : null;
      return { fam: k, today: lo == null && hi == null ? 'not set' : (lo === hi ? String(lo) : (lo == null ? '?' : lo) + '–' + (hi == null ? '?' : hi)) };
    });
  }
  function describe(a) { // one answer → readable text (used for edit records and the Workbench)
    if (!a) return '—';
    if (a.rows) { var t = Object.keys(a.rows).filter(function (k) { return a.rows[k]; }).map(function (k) { return k + ': ' + a.rows[k]; }).join('; '); return [t, a.notes].filter(Boolean).join(' · ') || '—'; }
    return [a.choice, a.value, a.notes].filter(Boolean).join(' · ') || '—';
  }
  root.HBKQ = { list: list, families: families, describe: describe };
})(typeof window !== 'undefined' ? window : this);
