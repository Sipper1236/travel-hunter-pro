/** Parse exact per-room adult/child counts from the ACV product-listing URL. */
export function vacationListingRoomAllocations(value,roomCount){
 if(typeof value!=='string'||!Number.isSafeInteger(roomCount)||roomCount<1||roomCount>9)return null;
 let url;try{url=new URL(value);}catch{return null;}
 const entries=[...url.searchParams.entries()].filter(([key])=>/^r\d+$/.test(key));
 if(entries.length!==roomCount)return null;
 const allocations=Array.from({length:roomCount},()=>null);
 for(const [key,party] of entries){
  const index=Number(key.slice(1));if(!Number.isSafeInteger(index)||index<0||index>=roomCount||allocations[index])return null;
  let adults=0;const childrenAges=[];
  for(const item of party.split(',')){
   const match=/^(\d+)-(adult|child)-(\d+)$/.exec(item);if(!match)return null;
   const count=Number(match[1]),age=Number(match[3]);if(!Number.isSafeInteger(count)||count<1)return null;
   if(match[2]==='adult'){if(age!==0)return null;adults+=count;}
   else{if(age<2||age>17)return null;for(let child=0;child<count;child++)childrenAges.push(age);}
  }
  if(!Number.isSafeInteger(adults)||adults<1)return null;
  allocations[index]={adults,childrenAges};
 }
 return allocations.every(Boolean)?allocations:null;
}
