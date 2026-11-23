import {queueComparison} from '../../../../lib/comparison-endpoint.mjs';
export const runtime='nodejs';
export async function POST(request){return queueComparison(request,'segments');}
