import test from "node:test";
import assert from "node:assert/strict";
import { createBookLearningState, getBookLearningSession, submitBookAssessment, submitBookTaskEvidence } from "./book-learning-engine.js";

test("new course starts at chapter one and exposes a lesson and quiz",()=>{
 const s=getBookLearningSession();
 assert.equal(s.chapter.chapter,1);assert.ok(s.chapter.lesson.studyNotes.length);assert.equal(s.chapter.assessment.length,2);
});
test("passing assessment marks learned but not completed until task evidence",()=>{
 const result=submitBookAssessment({},[0,1]);
 assert.equal(result.passed,true);assert.equal(result.state.chapters[1].status,"learned");
 assert.throws(()=>submitBookTaskEvidence(result.state,"too short"),/20 characters/);
 const done=submitBookTaskEvidence(result.state,"I documented the lifecycle from historical data validation to risk controls and monitoring.");
 assert.equal(done.state.chapters[1].status,"completed");assert.equal(done.nextChapter,2);
});
test("failed assessment cannot complete a chapter",()=>{
 const result=submitBookAssessment({},[1,0]);
 assert.equal(result.passed,false);assert.throws(()=>submitBookTaskEvidence(result.state,"This is sufficiently long evidence for the task."),/assessment/);
});
test("all 16 chapters have a two-question assessment and practical task",()=>{
 for(let n=1;n<=16;n++){const session=getBookLearningSession({...createBookLearningState(),currentChapter:n});assert.equal(session.chapter.assessment.length,2);assert.ok(session.chapter.practicalTask.length>20);}
});
