// Public.gs — verbatim copy of public-projection.js project(). Keep the two identical (Inspector compares them).
function project(db, audience) {
    audience = audience || 'guest';
    var out = { version: db.version, updatedAt: db.updatedAt };
    var active = function (rows) { return (rows || []).filter(function (r) { return r.active !== false; }); };
    out.systems = active(db.systems).map(function (s) { var c = {}; for (var k in s) if (k !== 'internalNotes') c[k] = s[k]; return c; });
    out.headExpanders = active(db.headExpanders);
    out.kb = active(db.kb).filter(function (k) { return audience === 'staff' || k.audience !== 'staff'; });
    out.links = db.links || [];
    var ge = db.generalExtras || {};
    out.generalExtras = { headroom: ge.headroom, sigma: ge.sigma, betaLabel: ge.betaLabel, appVersion: ge.appVersion };
    if (audience === 'staff') { out.feedback = db.feedback || []; out.releases = db.releases || []; out.generalExtras = ge; }
    return out;
}
