// Structure only: endpoints and registered files. No data lives here (Rule 1).
// Fill READ/ADMIN with the two Apps Script web-app URLs after deployment (Workbench → Connect shows the steps).
window.DB_CONFIG = {
  read: 'https://script.google.com/macros/s/AKfycbyjnWbs8RtvfX9NLkOfuUFlcpl8HOkifxRe3EW56euobWIEzkNO33WrLKI-sWLnO9NF/exec',  // the one deployment (Execute as Me, Anyone)
  admin: 'https://script.google.com/macros/s/AKfycbyjnWbs8RtvfX9NLkOfuUFlcpl8HOkifxRe3EW56euobWIEzkNO33WrLKI-sWLnO9NF/exec', // same URL; staff calls carry a Google ID token
  loginUrl: 'https://script.google.com/a/macros/w5engineering.com/s/AKfycbwSqI7p_AA2gspLuWOJFmAFsQHKJPap950nZmAlwpj2cMccv3AwmziBWBzNGKOfzfSx/exec',        // SECOND deployment URL (Execute as User accessing, W5 only) — staff sign-in where Google's button is not allowed
  googleClientId: '494396704602-ajukp57ceph05cm7aji75c15sf3i3lm8.apps.googleusercontent.com',  // OAuth 2.0 Web client ID (Google Cloud → Credentials). Public by design.
  cachePrefix: 'lds.', // the only storage prefix guard.js allows
  appVersion: '0.1-beta',
  appFiles: ['Shaker Selector.dc.html', 'Workbench.dc.html', 'Inspector.dc.html', 'db-client.js', 'guard.js', 'public-projection.js', 'db-config.js', 'hbk-sheet.js', 'hbk-questions.js', 'HBK Verification Questions.dc.html'],
  siteExtras: ['beta.html', 'hbk.html', 'support.js', 'assets/w5-logo.png', '.nojekyll'], // publishable besides appFiles; index.html has its own path
  scriptFiles: ['server/Code.gs', 'server/Public.gs', 'server/Publish.gs', 'server/appsscript.json'], // pasted into Apps Script by hand → Mark deployed
  publicFiles: ['Shaker Selector.dc.html', 'HBK Verification Questions.dc.html', 'hbk-questions.js', 'db-client.js', 'guard.js', 'public-projection.js', 'db-config.js']
};
