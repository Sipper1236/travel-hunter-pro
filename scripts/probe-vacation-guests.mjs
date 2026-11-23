import {chromium} from 'playwright-core';
// Read-only widget discovery; never submits a search or creates a booking.
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage();page.setDefaultTimeout(12000);
 await page.goto('https://vacations.aircanada.com/en/all-booking-options/flight-hotel/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForTimeout(8000);
 const cookie=page.getByRole('button',{name:'Accept all',exact:true});if(await cookie.isVisible())await cookie.click();
 const from=page.locator('#flight_hotel_tab-from-input');await from.click();await from.pressSequentially('Halifax',{delay:120});
 await page.waitForTimeout(2000);
 await page.locator('#flight_hotel_tab-Guests').click();
 console.log(JSON.stringify(await page.locator('input,select,button').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width).map(n=>({tag:n.tagName,id:n.id,type:n.type,aria:n.getAttribute('aria-label'),text:n.textContent.trim().slice(0,60),html:n.outerHTML.slice(0,500)}))),null,2));
}finally{await browser.close();}
