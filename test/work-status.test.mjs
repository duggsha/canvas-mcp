import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasClient } from '../src/core.mjs';
import { workStatus } from '../src/work-status.mjs';
const origin='https://school.instructure.com';
const base={id:1,name:'Psychology reading check',points_possible:10,due_at:'2026-01-01T00:00:00Z',submission_types:['online_upload']};
const read=(submission,rest={})=>workStatus({...base,...rest,submission},origin,'2',Date.parse('2026-09-29T00:00:00Z'));
test('a graded zero remains visible independently of the course average and missing flag',()=>{
 const result=read({score:0,grade:'0',workflow_state:'graded',missing:true,excused:false});
 assert.equal(result.score,0);assert.equal(result.points_possible,10);
 assert.deepEqual(result.attention,['marked_missing_by_canvas','zero_score']);
 assert.deepEqual(read({score:0,workflow_state:'submitted',missing:false}).attention,['zero_score']);
 assert.equal(read({score:0,workflow_state:'submitted',missing:false}).missing,false);
});
test('ungraded, excused, extra-credit and paper evidence is not relabeled as missed or perfect',()=>{
 assert.equal(read({score:null}).score,null);
 assert.equal(read(undefined).missing,null);
 assert.deepEqual(read({score:0,missing:true,excused:true}).attention,[]);
 assert.deepEqual(read({score:0},{points_possible:0}).attention,[]);
 assert.deepEqual(read({workflow_state:'unsubmitted'},{submission_types:['on_paper']}).attention,['submission_needs_verification']);
 assert.deepEqual(read({workflow_state:'unsubmitted'}).attention,['past_due_unsubmitted']);
});
test('status audit exposes graded zero on a later page; no page invents 100% or complete coverage',async()=>{
 let calls=0;
 const client=createCanvasClient({origin,token:'secret',fetchImpl:async url=>{
  calls++;assert.equal(url.searchParams.get('include[]'),'submission');
  assert.equal(url.searchParams.has('bucket'),false);
  const page=Number(url.searchParams.get('page'));
  const row=page===1?{...base,submission:{score:10,grade:'10',missing:false}}:{...base,id:2,submission:{score:0,grade:'0',missing:true,workflow_state:'graded'}};
  return new Response(JSON.stringify([row]),{headers:page===1?{link:'<https://school.instructure.com/api/v1/courses/2/assignments?page=2>; rel="next"'}:{}});
 }});
 const first=await client.get_course_work_status({courseId:'2'});
 assert.equal(first.nextPage,2);assert.equal(first.courseGrade.value,null);assert.equal(first.coverage.scope,'this_page');
 const last=await client.get_course_work_status({courseId:'2',page:first.nextPage});
 assert.equal(last.nextPage,null);assert.equal(last.data[0].score,0);assert.ok(last.data[0].attention.includes('zero_score'));assert.equal(calls,2);
 await assert.rejects(client.get_course_work_status({courseId:'../../users'}));assert.equal(calls,2);
});
test('overview preserves 0/10 and directs the assistant to a full audit',async()=>{
 const client=createCanvasClient({origin,token:'x',fetchImpl:async url=>new Response(JSON.stringify(url.pathname==='/api/v1/courses'?[{id:2,name:'Psychology'}]:[{...base,submission:{score:0,grade:'0',missing:true}}]))});
 const r=await client.get_study_overview();
 assert.equal(r.data[0].assignments.overdue.data[0].submission.score,0);
 assert.match(r.guidance,/get_course_work_status/);
});
