// Regression checks for the narrow backend transitive patch, no database or network.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const require=createRequire(import.meta.url),qs=require(process.env.HMS_SECURITY_TEST_QS??'qs'),uuid=require(process.env.HMS_SECURITY_TEST_UUID??'uuid');
test('hostile isBuffer property cannot make query serialization call a non-function',()=>{
 const input=JSON.parse('{"a":{"constructor":{"isBuffer":"x"}}}');
 assert.equal(qs.stringify(input),'a%5Bconstructor%5D%5BisBuffer%5D=x');
});
test('comma arrays obey configured arrayLimit for bracket keys',()=>{
 assert.throws(()=>qs.parse('a[]=1,2,3,4',{comma:true,arrayLimit:3,throwOnLimitExceeded:true}),RangeError);
});
test('Express extended parsing semantics remain supported',()=>{
 assert.deepEqual(qs.parse('doctor_id=fictional&page=2&nested[x]=y',{allowPrototypes:true}),{doctor_id:'fictional',page:'2',nested:{x:'y'}});
});
test('uuid v5 rejects undersized caller buffers, v4 keeps ordinary generation',()=>{
 assert.throws(()=>uuid.v5('fictional','6ba7b810-9dad-11d1-80b4-00c04fd430c8',new Uint8Array(8),4),RangeError);
 assert.equal(uuid.validate(uuid.v4()),true);
});
