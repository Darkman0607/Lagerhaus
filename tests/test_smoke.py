"""U01 browser acceptance tests – run from project root: python tests/test_smoke.py"""
import asyncio, json, pathlib, subprocess, time, sys
from playwright.async_api import async_playwright

ROOT=pathlib.Path(__file__).resolve().parents[1]
URL='http://127.0.0.1:8765/'
async def main():
 proc=subprocess.Popen([sys.executable,'-m','http.server','8765','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 problems=[]
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--no-proxy-server','--proxy-bypass-list=*'])
   for mobile,w,h in [('desktop',1440,900),('android',393,852),('small_android',320,640)]:
    page=await browser.new_page(viewport={'width':w,'height':h},device_scale_factor=2 if mobile!='desktop' else 1,is_mobile=mobile!='desktop',has_touch=mobile!='desktop')
    err=[]
    page.on('pageerror',lambda e:err.append(str(e)))
    await page.goto(URL,wait_until='networkidle')
    await page.wait_for_selector('.metric-value')
    assert await page.title()=='Lagerhaus | Dashboard'
    assert await page.locator('.metric-value').all_text_contents()==['0','0','0','0']
    assert await page.locator('body').evaluate('(e) => e.scrollWidth <= innerWidth + 1'),f'Horizontal overflow {mobile}'
    side=page.locator('.sidebar')
    bottom=page.locator('.bottom-nav')
    assert await (bottom if mobile!='desktop' else side).is_visible(),f'Navigation invis {mobile}'
    for target,title in [('warehouse','Lager'),('articles','Artikel'),('shopping','Einkauf'),('more','Mehr'),('dashboard','Dashboard')]:
     await page.locator(('.bottom-nav' if mobile!='desktop' else '.side-nav')+f' [data-nav="{target}"]').click()
     await page.wait_for_function(f"document.title === 'Lagerhaus | {title}'")
     assert await page.locator('h1').text_content()==title
     assert await page.locator('body').evaluate('(e) => e.scrollWidth <= innerWidth + 1'),f'overflow {mobile}:{target}'
    assert not err,f'js errors {mobile}: {err}'
    if mobile=='android':
     await page.goto(URL,wait_until='networkidle')
     await page.wait_for_function("'serviceWorker' in navigator && !!navigator.serviceWorker.controller",timeout=12000)
     await page.screenshot(path=str(ROOT.parent/'screenshot-mobile.png'),full_page=True)
     await page.context.set_offline(True)
     await page.reload(wait_until='load')
     await page.wait_for_selector('.metric-value')
     assert await page.locator('h1').text_content()=='Dashboard','Offline Dashboard unavailable'
     await page.locator('.bottom-nav [data-nav="articles"]').click()
     assert await page.locator('h1').text_content()=='Artikel','Offline modules unavailable'
     await page.context.set_offline(False)
    if mobile=='desktop':
     await page.screenshot(path=str(ROOT.parent/'screenshot-desktop.png'),full_page=True)
    print('PASS',mobile,'5 nav screens, zero data, responsive, no JS errors'+(' offline' if mobile=='android' else ''))
    await page.close()
   await browser.close()
  manifest=json.loads((ROOT/'manifest.webmanifest').read_text())
  assert manifest['display']=='standalone'
  for ico in manifest['icons']:
   assert (ROOT/ico['src']).is_file(),ico['src']
  print('PASS manifest, icon files, install scaffolding')
 finally:
  proc.terminate();proc.wait(timeout=5)
if __name__=='__main__':asyncio.run(main())
