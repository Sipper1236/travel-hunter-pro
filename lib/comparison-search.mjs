import {compareSeparateTickets} from './separate-tickets.mjs';
import {optimizePassengerSplits,MAX_SPLIT_SEARCHES} from './split-optimizer.mjs';
import {validateComparisonQuery} from './comparison-query.mjs';
import {createFareSession} from './fare-session.mjs';

export async function executeComparison(raw,options={}){
  const input=validateComparisonQuery(raw),limit=input.mode==='segments'?input.searchLimit:MAX_SPLIT_SEARCHES;
  const session=await createFareSession(input,{...options,limit,initialStage:'comparison_starting',progressContext:{mode:input.mode}});
  session.report({});
  let result;
  try{
    result=input.mode==='segments'?await compareSeparateTickets(input,{searcher:session.search,onProgress:session.report}):await optimizePassengerSplits(input,{searcher:session.search,onProgress:session.report,filterOptions:options.filterOptions});
  }catch(error){session.check();if(!session.budgetExhausted)throw error;}
  session.check();
  if(session.budgetExhausted)result={status:'budget_exhausted',exhaustive:false,plans:[],limitation:'The fare request budget was exhausted. Interrupted requests and refreshed stale observations count toward that budget; no complete current comparison is claimed.'};
  return {...result,query:input,coverage:{...result.coverage,...session.coverage}};
}
