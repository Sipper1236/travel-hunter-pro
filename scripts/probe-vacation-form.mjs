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
 console.log(JSON.stringify({originValue:await from.inputValue(),suggestions:await page.locator('#flight_hotel_tab-from-listbox').innerText()},null,2));
 await page.locator('#flight_hotel_tab-Guests').click();
 console.log((await page.locator('body').innerText()).slice(0,2500));
}finally{await browser.close();}
