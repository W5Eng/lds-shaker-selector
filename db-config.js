// Structure only: endpoints and registered files. No data lives here (Rule 1).
// Fill READ/ADMIN with the two Apps Script web-app URLs after deployment (Workbench → Connect shows the steps).
window.DB_CONFIG = {
  read: 'https://script.google.com/macros/s/AKfycbyjnWbs8RtvfX9NLkOfuUFlcpl8HOkifxRe3EW56euobWIEzkNO33WrLKI-sWLnO9NF/exec',  // the one deployment (Execute as Me, Anyone)
  admin: 'https://script.google.com/macros/s/AKfycbyjnWbs8RtvfX9NLkOfuUFlcpl8HOkifxRe3EW56euobWIEzkNO33WrLKI-sWLnO9NF/exec', // same URL; staff calls carry a Google ID token
  googleClientId: '494396704602-ajukp57ceph05cm7aji75c15sf3i3lm8.apps.googleusercontent.com',  // OAuth 2.0 Web client ID (Google Cloud → Credentials). Not a secret.
  cachePrefix: 'lds.', // the only storage prefix guard.js allows
  appVersion: '0.1-beta',
  appFiles: ['Shaker Selector.dc.html', 'Workbench.dc.html', 'Inspector.dc.html', 'db-client.js', 'guard.js', 'public-projection.js', 'db-config.js'],
  publicFiles: ['Shaker Selector.dc.html', 'db-client.js', 'guard.js', 'public-projection.js', 'db-config.js']
};
