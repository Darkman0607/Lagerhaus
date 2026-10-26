from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--no-proxy-server'])
    page=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    errs=[]
    page.on('pageerror',lambda e:errs.append(str(e)))
    try:
        page.goto('http://127.0.0.1:8765/#/warehouse',wait_until='domcontentloaded',timeout=10000)
        page.wait_for_selector('#stock-book-form',timeout=10000)
        assert page.locator('#stock-package-form').count()==1
        assert page.locator('#stock-threshold-form').count()==1
        page.screenshot(path='/mnt/data/lagerhaus_u06/smoke_u06_mobile.png',full_page=True)
        print('MOBILE',page.title(),'panel',page.locator('.booking-panel').count(),'errors',errs)
        page.set_viewport_size({'width':1365,'height':850})
        page.screenshot(path='/mnt/data/lagerhaus_u06/smoke_u06_desktop.png',full_page=True)
        print('DESKTOP',page.title(),'errors',errs)
        # UI flow starts by creating a location and then article, booking after; clicking only relevant elements.
    except Exception as e:
        print('BROWSER_BLOCKED',type(e).__name__,str(e)[:500]);raise
    finally:b.close()
