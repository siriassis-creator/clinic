import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Exercise the production transaction logic with an atomic, serialized test store.
// This does not validate deployed Firestore rules or indexes.
const store = new Map(); let serial=0; let queue=Promise.resolve();
const snap=ref=>({exists:()=>store.has(ref.path),data:()=>structuredClone(store.get(ref.path))});
globalThis.__clinicMock={auth:{currentUser:{uid:'test-user'}},db:{},collection:(_db,path)=>({path}),doc:(_db,path,id)=> typeof path==='string'?{path:`${path}/${id}`,id}:{path:`${_db.path}/auto-${++serial}`,id:`auto-${serial}`},runTransaction:(_db,fn)=>{
 const task=queue.then(async()=>{const writes=[];const tx={get:async ref=>snap(ref),set:(ref,value)=>writes.push(()=>store.set(ref.path,structuredClone(value))),update:(ref,value)=>writes.push(()=>store.set(ref.path,{...store.get(ref.path),...structuredClone(value)})),delete:ref=>writes.push(()=>store.delete(ref.path))};const result=await fn(tx);writes.forEach(write=>write());return result;});queue=task.catch(()=>{});return task;
}};
const source=fs.readFileSync(new URL('../src/services/visitWorkflow.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const js=ts.transpileModule('const {auth,db,collection,doc,runTransaction}=globalThis.__clinicMock;\n'+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {startCase,saveCaseDraft,finishCase,validatePrescription}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const patient={id:'p1',cn:'CN1',firstName:'Test',lastName:'Only'};
const med={id:'m1',tradeName:'Test medicine',qtyToGive:2,sellingPrice:10,isService:false};
await test('separate drafts, duplicate patient resumes same case, and stale writes rejected',async()=>{
 const a=await startCase(patient), b=await startCase({...patient,id:'p2',cn:'CN2'});
 const episode=store.get('visits/'+a).episodeId;
 assert.notEqual(a,b);assert.equal(await startCase(patient),a);
 await saveCaseDraft(a,{chiefComplaint:'A',prescriptions:[]},0,episode);
 assert.equal(store.get('visits/'+a).chiefComplaint,'A');assert.equal(store.get('visits/'+b).chiefComplaint,'');
 await assert.rejects(saveCaseDraft(a,{chiefComplaint:'stale'},0,episode),/อุปกรณ์อื่น/);
});
await test('exam does not change stock; shortage rolls back; dispense/payment happen once',async()=>{
 const id=await startCase({...patient,id:'p3'});store.set('pharmacy/m1',{stockQty:'1',expiryDate:'2099-01-01'});
 const episode=store.get('visits/'+id).episodeId;
 await saveCaseDraft(id,{chiefComplaint:'Test',diagnosis:'Test',prescriptions:[med]},0,episode);
 await finishCase(id,'draft',1,episode);assert.equal(store.get('pharmacy/m1').stockQty,'1');
 await assert.rejects(finishCase(id,'awaiting_medicine',2,episode),/ไม่พอ/);
 assert.equal(store.get('visits/'+id).workflowStatus,'awaiting_medicine');assert.equal(store.get('pharmacy/m1').stockQty,'1');
 store.set('pharmacy/m1',{stockQty:'5',expiryDate:'2099-01-01'});
 await finishCase(id,'awaiting_medicine',2,episode);assert.equal(store.get('pharmacy/m1').stockQty,'3');
 await assert.rejects(finishCase(id,'awaiting_medicine',2,episode),/เปลี่ยนแปลง/);assert.equal(store.get('pharmacy/m1').stockQty,'3');
 await finishCase(id,'awaiting_payment',3,episode);assert.equal(store.has('visits/'+id),false);assert.equal(store.get('visits/'+episode).paymentStatus,'paid');
 await assert.rejects(finishCase(id,'awaiting_payment',3,episode),/ปิดแล้ว/);
 const newId=await startCase({...patient,id:'p3'});assert.equal(newId,id);assert.notEqual(store.get('visits/'+newId).episodeId,episode);assert.ok(store.has('visits/'+episode));
});
await test('invalid quantities, negative prices, and duplicate items cannot be confirmed',()=>{
 for (const item of [{...med,qtyToGive:0},{...med,qtyToGive:1.5},{...med,sellingPrice:-1}]) assert.throws(()=>validatePrescription([item]));
 assert.throws(()=>validatePrescription([med,med]));assert.equal(validatePrescription([med]),20);
});
