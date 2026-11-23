export function googleCalendarResponse(rows,{rpcId='BVAT3'}={}){
 const payload=JSON.stringify([[],rows]);
 const frame=JSON.stringify([['wrb.fr',rpcId,payload]]);
 return `)]}'\n${Buffer.byteLength(frame)}\n${frame}\n`;
}
export function googleCalendarErrorResponse(code){
 const frame=JSON.stringify([['wrb.fr',null,null,null],['e',code,null,null,0]]);
 return `)]}'\n${Buffer.byteLength(frame)}\n${frame}\n`;
}
