const { chromium } = require('playwright');
const path = require('path');
(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const file='file://'+path.resolve(__dirname,'layout-preview.html');
  for(const mode of ['a','b','c']){
    await page.goto(file+'?mode='+mode);
    await page.screenshot({path:path.resolve(__dirname,`layout-${mode.toUpperCase()}.png`),fullPage:false});
  }
  await browser.close();
})();
