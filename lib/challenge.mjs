import {randomUUID} from 'node:crypto';
// Only explicit challenge containers are eligible. No body/page fallback.
export const challengeSelectors = [
 'iframe[src*="recaptcha"][src*="bframe"]', 'iframe[src*="hcaptcha"][title*="challenge"]',
 '#captcha-container', '#awswaf-captcha-container',
 'iframe[src*="recaptcha"][src*="anchor"]', 'iframe[src*="challenges.cloudflare.com"]'
];
export async function locateChallenge(page, selectors=challengeSelectors){
 for(const selector of selectors){const locators=page.locator(selector);for(let i=0;i<await locators.count();i++){const locator=locators.nth(i);const box=await locator.boundingBox();const viewport=page.viewportSize();if(box && viewport && box.width>=20 && box.height>=20 && box.width<=800 && box.height<=800 && box.x>=0 && box.y>=0 && box.x+box.width<=viewport.width && box.y+box.height<=viewport.height)return {locator,box};}}
 return null;
}
export async function challengeFrame(page, selectors){
 const target=await locateChallenge(page,selectors);if(!target)return null;
 const png=await target.locator.screenshot({type:'png',timeout:3000,scale:'css'});
 return {...target,id:randomUUID(),at:Date.now(),image:`data:image/png;base64,${png.toString('base64')}`};
}
export async function challengeInput(page, frame, input){
 if(!frame || input.frameId!==frame.id || Date.now()-frame.at>15000)throw Error('Challenge changed. Refresh and try again.');
 const box=await frame.locator.boundingBox();
 if(!box || ['x','y','width','height'].some(k=>Math.abs(box[k]-frame.box[k])>1))throw Error('Challenge moved. Refresh and try again.');
 if(input.kind!=='click')throw Error('Only direct user clicks are supported by this first version.');
 if(!Number.isFinite(input.x)||!Number.isFinite(input.y)||input.x<0||input.y<0||input.x>=box.width||input.y>=box.height)throw Error('Click is outside the challenge.');
 await page.mouse.click(box.x+input.x,box.y+input.y);
}
