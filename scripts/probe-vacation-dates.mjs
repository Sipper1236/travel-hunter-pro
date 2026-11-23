import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage();page.setDefaultTimeout(15000);
 await page.goto('https://vacations.aircanada.com/en/all-booking-options/flight-hotel/',{waitUntil:'domcontentloaded',timeout:30000});await page.waitForTimeout(8000);
 const cookie=page.getByRole('button',{name:'Accept all',exact:true});if(await cookie.isVisible())await cookie.click();
 const from=page.locator('#flight_hotel_tab-from-input');await from.click();await from.pressSequentially('Halifax',{delay:100});
 await page.locator('#flight_hotel_tab-from-listbox').getByText('Halifax Stanfield Intl. Airport (YHZ)',{exact:true}).click();
 const to=page.locator('#flight_hotel_tab-to-input');await to.click();await to.pressSequentially('Barcelona',{delay:100});await page.waitForTimeout(1500);
 console.log('DESTINATIONS',await page.locator('#flight_hotel_tab-to-listbox').innerText());
 const options=page.locator('#flight_hotel_tab-to-listbox [role=option]');if(await options.count()===1)await options.first().click();
 await page.locator('#flight_hotel_tab-departureDateId').click();
 console.log('DATES',await page.locator('#flight_hotel_tab-departureDateId').evaluate(n=>n.outerHTML));
 console.log('DIALOG',(await page.locator('body').innerText()).slice(0,4500));
 console.log('BUTTONS',JSON.stringify(await page.locator('button').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width).map(n=>({text:n.textContent.trim().slice(0,70),aria:n.getAttribute('aria-label'),title:n.title})))));
}finally{await browser.close();}
