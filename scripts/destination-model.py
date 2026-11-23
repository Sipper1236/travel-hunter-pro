#!/usr/bin/env python3
"""Local Laya worker: one JSON request and response per line, no network at inference."""
import contextlib
import json
import os
import sys
from pathlib import Path
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
with contextlib.redirect_stdout(sys.stderr):
    import torch
    import laya
    torch.set_num_threads(4)
    agent = laya.load(str(Path(__file__).resolve().parents[1] / '.cache/laya-model'), device='cpu')
question = {'category': {'type': 'choice', 'instructions': 'Classify the geographic entity described in the description.', 'criteria': {
    'airport': 'an airport, aerodrome or airfield', 'city': 'a city, town, village, municipality or metropolitan area',
    'country': 'a sovereign country', 'region': 'a continent, region, province, state or territory', 'other': 'not a geographic place'}}}
preferences = {
    'business': {'type':'noul', 'instructions':'Does the request explicitly ask to travel in business class?'},
    'direct': {'type':'noul', 'instructions':'Does the request explicitly require nonstop or direct flights?'},
    'hotel': {'type':'noul', 'instructions':'Does the request explicitly ask for a hotel or accommodation?'},
    'return_trip': {'type':'noul', 'instructions':'Does the request explicitly ask for a round trip or return flight?'},
    'avoid_self_transfer': {'type':'noul', 'instructions':'Does the request explicitly ask to avoid self transfers or separate tickets?'},
}
print(json.dumps({'ready': True}), flush=True)
for line in sys.stdin:
    req = {}
    try:
        req = json.loads(line)
        descriptions = req['descriptions']
        mode = req.get('mode', 'destination')
        if mode not in ('destination','preferences') or (mode == 'preferences' and len(descriptions) != 1):
            raise ValueError('Invalid task')
        if not isinstance(descriptions, list) or not 1 <= len(descriptions) <= 12 or any(not isinstance(d,str) or len(d)>(600 if mode == 'preferences' else 400) for d in descriptions):
            raise ValueError('Invalid descriptions')
        with contextlib.redirect_stdout(sys.stderr):
            if mode == 'preferences':
                result = agent.predict({'request': descriptions[0]}, preferences)
                answers = result['answers']
            else:
                results = agent.predict_batch([{'description':d} for d in descriptions], question, batch_size=4)
                answers = [r['answers']['category'] for r in results]
        print(json.dumps({'id':req['id'],'answers':answers}), flush=True)
    except Exception as exc:
        print(json.dumps({'id':req.get('id') if isinstance(req,dict) else None,'error':str(exc)}),flush=True)
