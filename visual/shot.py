import sys, asyncio
from playwright.async_api import async_playwright
# usage: shot.py url out.png width height [scale] [fullpage]
async def main():
    url,out,w,h=sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4])
    scale=float(sys.argv[5]) if len(sys.argv)>5 else 2
    full=len(sys.argv)>6 and sys.argv[6]=='full'
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--allow-file-access-from-files'])
        pg=await b.new_page(viewport={'width':w,'height':h},device_scale_factor=scale)
        await pg.goto(url); await pg.wait_for_timeout(700)
        await pg.evaluate('document.fonts.ready')
        await pg.screenshot(path=out,full_page=full)
        await b.close()
asyncio.run(main())
