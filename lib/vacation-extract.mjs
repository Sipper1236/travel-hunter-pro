import {call,saveSite} from 'api-anything';
// Extraction discovery: dollar symbols alone are insufficient currency evidence.
export async function inspectVacationCards(html){
 const name='travel-hunter-vacation-cards';
 saveSite({name,displayName:'Air Canada Vacations observed listing',baseUrl:'https://vacations.aircanada.com',operations:[{name:'extract',readOnly:true,minTier:1,params:[],slots:[],volatile:[],request:{method:'GET',url:'https://vacations.aircanada.com/en/packages/product-listing',headers:{}},trigger:{url:'https://vacations.aircanada.com/en/packages/product-listing'},response:{format:'html',html:{items:'.hotel-item',fields:{name:'.hotel-name',stars:'.hotel-rating .stars',city:'.hotel-city',mealPlan:'.hotel-plan',inclusions:'.package-includes',totalText:'.price-total .price',perAdultText:'.price-per .vacv-price',taxText:'.price-taxes',cancellationText:'.non-refundable-rate'}}}}]});
 const result=await call(name,'extract',{}, {maxTier:1,fetchImpl:async()=>new Response(html,{status:200,headers:{'Content-Type':'text/html'}})});
 if(!result.ok||!Array.isArray(result.data))throw Error('Vacation result markup could not be extracted.');
 return {status:'currency_unverified',offers:[],observations:result.data,limitation:'Raw observed card text only. Currency and query-specific flight details require verification before these become priced offers.'};
}
