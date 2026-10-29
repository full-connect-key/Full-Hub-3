const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const [png, out, x, y, w, h] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--headless","--no-sandbox"] });
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  await p.goto("file://" + path.resolve(png));
  await p.evaluate(({x,y}) => { const i = document.querySelector("img"); i.style.position="absolute"; i.style.left=(-x)+"px"; i.style.top=(-y)+"px"; i.style.maxWidth="none"; document.body.style.margin="0"; }, {x:+x,y:+y});
  await p.waitForTimeout(300);
  await p.screenshot({ path: out });
  await b.close();
  console.log("ok");
})();
