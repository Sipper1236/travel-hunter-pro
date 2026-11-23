import test from 'node:test';import assert from 'node:assert/strict';
import {matrixResponseTimeout} from '../lib/ita-matrix.mjs';
test('Matrix response timeout defaults to ninety seconds and accepts a bounded explicit setting',()=>{
 assert.equal(matrixResponseTimeout(undefined),90000);assert.equal(matrixResponseTimeout('120000'),120000);assert.equal(matrixResponseTimeout(45000),45000);
 for(const value of ['oops',0,-1,180001,1000.5])assert.throws(()=>matrixResponseTimeout(value),/Matrix response timeout/);
});
