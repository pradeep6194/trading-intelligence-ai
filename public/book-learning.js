(()=>{"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let session=null,answers=[];
async function request(path,body){const r=await fetch("/api/book-learning/"+path,{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw Error(d.error||"Learning request failed");return d;}
function render(d){
 session=d;const c=d.chapter,p=d.progress;
 $("bookCourseTitle").textContent=d.curriculum.title+" · "+d.curriculum.author;
 $("bookProgress").textContent=p.completed+" / 16 chapters completed · "+p.learned+" theory assessments passed";
 $("bookProgressBar").style.width=(p.completed/16*100)+"%";
 $("bookChapterTitle").textContent="Chapter "+c.chapter+": "+c.title;
 $("bookPart").textContent=c.part;
 $("bookObjective").textContent=c.lesson.objective;
 $("bookConcepts").innerHTML=c.lesson.keyConcepts.map(x=>"<span class='book-chip'>"+esc(x)+"</span>").join("");
 $("bookNotes").innerHTML=c.lesson.studyNotes.map(x=>"<li>"+esc(x)+"</li>").join("");
 $("bookQuiz").innerHTML=c.assessment.map((q,i)=>"<fieldset class='book-question'><legend>"+(i+1)+". "+esc(q.question)+"</legend>"+q.options.map((o,j)=>"<label><input type='radio' name='bookq"+i+"' value='"+j+"'> "+esc(o)+"</label>").join("")+"</fieldset>").join("");
 $("bookTask").textContent=c.practicalTask;
 $("bookEvidence").value="";
 $("bookTaskForm").hidden=p.status!=="learned";
 $("bookQuizForm").hidden=p.status==="learned"||p.status==="completed";
 $("bookTaskStatus").textContent=p.status==="completed"?"Chapter completed. Next chapter unlocked.":p.status==="learned"?"Theory passed. Complete the practical task to unlock the next chapter.":p.status==="in_progress"?"Assessment needs another attempt. Review and retry.":"Complete the short assessment, then document the practical task.";
 $("bookResult").textContent=d.lastAttempt?"Last attempt: Chapter "+d.lastAttempt.chapter+" · "+d.lastAttempt.score+"/"+d.lastAttempt.total+" · "+(d.lastAttempt.passed?"Passed":"Not passed"):"";
 $("bookChapterSelect").value=String(c.chapter);
}
async function load(){try{render(await request("status"));}catch(e){$("bookResult").textContent=e.message;}}
$("bookQuizForm").addEventListener("submit",async e=>{e.preventDefault();try{const a=session.chapter.assessment.map((_,i)=>{const v=document.querySelector('input[name="bookq'+i+'"]:checked');if(!v)throw Error("Please answer every question.");return Number(v.value);});const r=await request("assessment",{answers:a});$("bookResult").textContent="Score "+r.score+"/"+r.total+" · "+(r.passed?"Passed":"Not passed")+". "+r.message;render(r.session);}catch(e){$("bookResult").textContent=e.message;}});
$("bookTaskForm").addEventListener("submit",async e=>{e.preventDefault();try{const r=await request("task",{evidence:$("bookEvidence").value});render(r.session);$("bookResult").textContent="Chapter "+r.completedChapter+" completed. "+(r.courseCompleted?"All chapters completed.":"Chapter "+r.nextChapter+" unlocked.");}catch(e){$("bookResult").textContent=e.message;}});
$("bookLoadChapter").addEventListener("click",async()=>{try{render(await request("jump",{chapter:Number($("bookChapterSelect").value)}));}catch(e){$("bookResult").textContent=e.message;}});
$("bookRetry").addEventListener("click",load);
load();
})();