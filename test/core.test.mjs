import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvasClient,canvasOrigin,text} from '../src/core.mjs';
import {createServer} from '../src/server.mjs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
const origin='https://school.instructure.com';
const fixture=(data,headers={})=>new Response(JSON.stringify(data),{headers});
test('rejects unsafe origins and credentials in URLs',()=>{for(const value of ['http://school.instructure.com','https://localhost','https://127.0.0.1','https://secret@school.instructure.com','https://school.instructure.com/path'])assert.throws(()=>canvasOrigin(value));});
test('assignment packet reads fresh status and syllabus concurrently, without exposing credentials',async()=>{
 const calls=[];const client=createCanvasClient({origin,token:'private-token',fetchImpl:async(url,options)=>{calls.push({url:String(url),options});return fixture(url.pathname.endsWith('/assignments/8')?{id:8,name:'Essay',description:'<p>Use two sources.</p>',due_at:'2026-10-01T07:00:00Z',lock_at:'2026-10-03T07:00:00Z',submission:{workflow_state:'submitted',submitted_at:'2026-09-29T06:53:00Z',user_id:123,body:'private body'},rubric:[{points:10,description:'Evidence'}]}:{id:4,name:'Classics',syllabus_body:'Late work accepted.'});}});
 const result=await client.get_assignment_context({courseId:'4',assignmentId:'8'});
 assert.equal(calls.length,2);assert.equal(result.data.assignment.submission.workflow_state,'submitted');assert.equal(result.data.assignment.submission.body,undefined);assert.ok(result.checkedAt);assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.cache,'no-store');assert.ok(!JSON.stringify(result).includes('private-token'));assert.notEqual(result.data.assignment.due_at,result.data.assignment.lock_at);
});
test('pagination is explicit, not silently described as exhaustive',async()=>{const client=createCanvasClient({origin,token:'x',fetchImpl:async()=>fixture([{id:2,name:'x'}],{link:'<https://evil.invalid/>; rel="next"'})});const r=await client.list_courses();assert.equal(r.nextPage,2);assert.equal(r.source,origin+'/api/v1/courses');});
test('rejects arbitrary URL, path and malformed numeric arguments before making requests',async()=>{let calls=0;const client=createCanvasClient({origin,token:'x',fetchImpl:async()=>{calls++;return fixture([])}});await assert.rejects(client.list_assignments({courseId:'../users'}));await assert.rejects(client.read_page({courseId:'1',pageSlug:'../../users'}));await assert.rejects(client.list_courses({page:-1}));assert.equal(calls,0);});
test('upstream errors never leak school response bodies',async()=>{const client=createCanvasClient({origin,token:'x',fetchImpl:async()=>new Response('secret stacktrace',{status:401})});await assert.rejects(client.list_courses(),e=>e.status===401&&!e.message.includes('secret'));});
test('oversized response is rejected',async()=>{const client=createCanvasClient({origin,token:'x',fetchImpl:async()=>fixture('x'.repeat(2_000_001))});await assert.rejects(client.list_courses(),/size limit/);});
test('teacher text reports truncation',()=>assert.match(text('x'.repeat(100),10),/Truncated/));
test('real MCP initialization, tools/list and tools/call succeed with only read tools',async()=>{
 const canvas=createCanvasClient({origin,token:'x',fetchImpl:async()=>fixture([{id:2,name:'Geometry'}])});const server=createServer(canvas);const [a,b]=InMemoryTransport.createLinkedPair();const client=new Client({name:'test',version:'1'});await Promise.all([server.connect(a),client.connect(b)]);
 try{const {tools}=await client.listTools();assert.equal(tools.length,10);assert.ok(tools.every(t=>t.annotations.readOnlyHint===true&&t.annotations.destructiveHint===false));const result=await client.callTool({name:'list_courses',arguments:{}});assert.equal(JSON.parse(result.content[0].text).data[0].name,'Geometry');const invalid=await client.callTool({name:'list_assignments',arguments:{courseId:'evil'}});assert.equal(invalid.isError,true);}finally{await client.close();await server.close();}
});
