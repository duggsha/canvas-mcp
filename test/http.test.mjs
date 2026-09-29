import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../src/server.mjs';
import {WebStandardStreamableHTTPServerTransport} from '../src/transport.mjs';

test('stateless HTTP initialization, listing and calls survive server cleanup',async()=>{
 async function request(method,params){
  const server=createServer({list_courses:async()=>({data:[{id:42,name:'Synthetic class'}],checkedAt:'2026-09-29T00:00:00Z'})});
  const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  await server.connect(transport);
  const response=await transport.handleRequest(new Request('https://connector.example/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-03-26'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));
  await server.close();return {status:response.status,body:await response.json()};
 }
 const init=await request('initialize',{protocolVersion:'2025-03-26',clientInfo:{name:'test',version:'1'},capabilities:{}});assert.equal(init.status,200);assert.equal(init.body.result.serverInfo.name,'dugg-canvas');
 const listing=await request('tools/list',{});assert.equal(listing.body.result.tools.length,10);
 const result=await request('tools/call',{name:'list_courses',arguments:{}});assert.match(result.body.result.content[0].text,/Synthetic class/);
});
