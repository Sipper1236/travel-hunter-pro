import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {selectVacationLocation,selectVacationDates,selectVacationAdults} from '../lib/vacation-form.mjs';
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage();page.setDefaultTimeout(20000);
 await page.goto('https://vacations.aircanada.com/en/all-booking-options/flight-hotel/',{waitUntil:'domcontentloaded',timeout:30000});await page.waitForTimeout(8000);
 const cookie=page.getByRole('button',{name:'Accept all',exact:true});if(await cookie.isVisible())await cookie.click();
 console.log(await selectVacationLocation(page,{kind:'from',searchText:'Halifax',exactLabel:'Halifax Stanfield Intl. Airport (YHZ)'}));
 console.log(await selectVacationLocation(page,{kind:'to',searchText:'Barcelona',exactLabel:'Barcelona, Spain'}));
 console.log(await selectVacationDates(page,{departure:'2027-04-15',returnDate:'2027-04-25'}));
 console.log(await selectVacationAdults(page,{adults:1,rooms:1,childrenAges:[]}));
 await page.locator('#flight_hotel_tab').getByRole('button',{name:'Search',exact:true}).click();
 await page.waitForTimeout(15000);
 await mkdir('.cache/vacation-probe',{recursive:true});
 await writeFile('.cache/vacation-probe/context.json',JSON.stringify({listingUrl:page.url(),observedAt:new Date().toISOString(),query:{origin:'YHZ',destinationLabel:'Barcelona, Spain',date:'2027-04-15',returnDate:'2027-04-25',adults:1,rooms:1,childrenAges:[]}}),{mode:0o600});
 await writeFile('.cache/vacation-probe/result.html',await page.content(),{mode:0o600});
 await writeFile('.cache/vacation-probe/result.txt',await page.locator('body').innerText(),{mode:0o600});
 console.log('RESULT',JSON.stringify({url:page.url().split('?')[0],text:(await page.locator('body').innerText()).slice(0,1800)},null,2));

}finally{await browser.close();}
