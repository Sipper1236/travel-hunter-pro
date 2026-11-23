import {selectVacationAdults} from '../lib/vacation-form.mjs';
import {chromium} from 'playwright-core';
// Read-only widget discovery; never submits a search or creates a booking.
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage();page.setDefaultTimeout(12000);
 await page.goto('https://vacations.aircanada.com/en/all-booking-options/flight-hotel/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForTimeout(8000);
 const cookie=page.getByRole('button',{name:'Accept all',exact:true});if(await cookie.isVisible())await cookie.click();
 console.log(await selectVacationAdults(page,{adults:1,rooms:1,childrenAges:[]}));
}finally{await browser.close();}
