const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/#/reports');
  await page.waitForTimeout(2000);
  const data = await page.evaluate(async () => {
    // Need to access Dexie. The app exports `db` in some module, but we can just use native indexedDB
    return new Promise((resolve) => {
      const req = indexedDB.open('COMMAVault');
      req.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('shifts')) {
           resolve({ error: 'No shifts store' });
           return;
        }
        const tx = db.transaction('shifts', 'readonly');
        const store = tx.objectStore('shifts');
        const req2 = store.getAll();
        req2.onsuccess = () => resolve({ shifts: req2.result });
      };
      req.onerror = () => resolve({ error: 'DB open failed' });
    });
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
