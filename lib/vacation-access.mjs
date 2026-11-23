import {SourceRequestError} from './source-errors.mjs';

const ACCESS_CHALLENGE_TEXT=/(?:\b(?:captcha|recaptcha|hcaptcha|turnstile)\b|security\s+(?:check|challenge)|checking\s+your\s+browser|unusual\s+traffic|automated\s+(?:requests?|traffic)|access\s+denied|request\s+blocked|attention\s+required|are\s+you\s+(?:a\s+)?robot|i(?:'m|\s+am)\s+not\s+a\s+robot|please\s+(?:verify|confirm|prove)\s+(?:that\s+)?you(?:'re|\s+are)\s+(?:a\s+)?human|please\s+(?:verify|confirm|prove)\s+(?:that\s+)?you\s+(?:are\s+)?not\s+(?:a\s+)?robot)/i;
const CHALLENGE_MARKERS='iframe[src*="captcha" i]:visible, iframe[src*="challenge" i]:visible, [id*="captcha" i]:visible, [class*="captcha" i]:visible, [data-sitekey]:visible';
const ACCESS_COOLDOWN_MS=5*60_000;

export function isVacationAccessChallenge({title='',text='',challengeElementCount=0}={}){
 if(!Number.isSafeInteger(challengeElementCount)||challengeElementCount<0)challengeElementCount=0;
 return challengeElementCount>0||ACCESS_CHALLENGE_TEXT.test(`${title}\n${text}`);
}

/** Inspect only visible challenge markers and bounded visible text; never interact with the challenge. */
export async function hasVacationAccessChallenge(page){
 let title='',text='',challengeElementCount=0;
 try{if(typeof page?.title==='function')title=await page.title();}catch{}
 try{if(typeof page?.locator==='function')text=(await page.locator('body').innerText({timeout:1500})).slice(0,16000);}catch{}
 try{if(typeof page?.locator==='function')challengeElementCount=await page.locator(CHALLENGE_MARKERS).count();}catch{}
 return isVacationAccessChallenge({title,text,challengeElementCount});
}

export function vacationAccessChallengeError(policy,now=Date.now()){
 const retryAt=now+ACCESS_COOLDOWN_MS;
 policy?.deferSource('Air Canada Vacations',retryAt,'blocked');
 return new SourceRequestError('Air Canada Vacations presented an access challenge. Search stopped without interacting with the challenge.',{status:'blocked',retryAt,providerCode:'access_challenge'});
}

export function vacationWidgetUnavailableError(kind='package'){
 const message=kind==='location'
  ?'Air Canada Vacations location form did not load. No location query was sent.'
  :'Air Canada Vacations package form did not load. No package search was submitted.';
 return new SourceRequestError(message,{status:'temporarily_unavailable',providerCode:'widget_unavailable'});
}
