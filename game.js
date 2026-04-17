(() => {
const hubScreen=document.getElementById('hubScreen');
const gameScreen=document.getElementById('gameScreen');
const startHeistBtn=document.getElementById('startHeistBtn');
const resetProgressBtn=document.getElementById('resetProgressBtn');
const backToHubBtn=document.getElementById('backToHubBtn');
const totalBankedEl=document.getElementById('totalBanked');
const bestHeistEl=document.getElementById('bestHeist');
const heistsPlayedEl=document.getElementById('heistsPlayed');
const paintingsStolenEl=document.getElementById('paintingsStolen');
const currentHaulEl=document.getElementById('currentHaul');
const strikeCountEl=document.getElementById('strikeCount');
const paintingsLeftEl=document.getElementById('paintingsLeft');
const questionModal=document.getElementById('questionModal');
const questionText=document.getElementById('questionText');
const answerInput=document.getElementById('answerInput');
const submitAnswerBtn=document.getElementById('submitAnswerBtn');
const cancelAnswerBtn=document.getElementById('cancelAnswerBtn');
const summaryModal=document.getElementById('summaryModal');
const summaryTitle=document.getElementById('summaryTitle');
const summaryText=document.getElementById('summaryText');
const summaryContinueBtn=document.getElementById('summaryContinueBtn');
const messageBanner=document.getElementById('messageBanner');
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
const interactBtn=document.getElementById('interactBtn');
const joystickButtons=[...document.querySelectorAll('.joystick button')];
const STORAGE_KEY='nanaHeistSave_v2';
const ROOM={x:80,y:70,w:800,h:500};
const DOOR={x:430,y:540,w:100,h:30};
const state={save:loadSave(),screen:'hub',keys:{up:false,down:false,left:false,right:false},run:null,activePainting:null,currentTheme:null,player:{x:480,y:520,w:18,h:18,speed:2.4,controlLocked:false},guard:{x:900,y:320,w:18,h:18,active:false}};
const themes=[{floor:'#1a2431',wall:'#53627a',trim:'#8ea0bb',frame:'#fff',title:'Blue Velvet Gallery'},{floor:'#2a1a22',wall:'#775465',trim:'#c79aad',frame:'#fff',title:'Crimson Vault Museum'},{floor:'#15261c',wall:'#5a7a65',trim:'#9cc8ad',frame:'#fff',title:'Emerald Wing Collection'}];

function loadSave(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)return JSON.parse(raw)}catch(e){}return{totalBanked:0,bestHeist:0,heistsPlayed:0,paintingsStolen:0,usedQuestionIds:[]}}
function saveProgress(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state.save));renderHubStats()}
function resetProgress(){state.save={totalBanked:0,bestHeist:0,heistsPlayed:0,paintingsStolen:0,usedQuestionIds:[]};saveProgress();showBanner('Progress reset.')}
function formatMoney(pence){return '£'+(pence/100).toFixed(2)}
function normalizeText(str){return String(str).toLowerCase().trim().replace(/[’']/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
function levenshtein(a,b){const m=a.length,n=b.length,dp=Array.from({length:m+1},()=>Array(n+1).fill(0));for(let i=0;i<=m;i++)dp[i][0]=i;for(let j=0;j<=n;j++)dp[0][j]=j;for(let i=1;i<=m;i++){for(let j=1;j<=n;j++){const cost=a[i-1]===b[j-1]?0:1;dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+cost)}}return dp[m][n]}
function closeEnough(a,b){if(a.length<5||b.length<5)return false;const distance=levenshtein(a,b);return distance<=1||distance/Math.max(a.length,b.length)<=0.15}
function isAnswerCorrect(input,question){const cleanedInput=normalizeText(input);if(!cleanedInput)return false;const answers=question.answers.map(normalizeText);if(question.matchType==='contains'){for(const ans of answers){if(cleanedInput.includes(ans))return true;if(closeEnough(cleanedInput,ans))return true}return false}for(const ans of answers){if(cleanedInput===ans)return true;if(closeEnough(cleanedInput,ans))return true}return false}
function renderHubStats(){totalBankedEl.textContent=formatMoney(state.save.totalBanked);bestHeistEl.textContent=formatMoney(state.save.bestHeist);heistsPlayedEl.textContent=String(state.save.heistsPlayed);paintingsStolenEl.textContent=String(state.save.paintingsStolen)}
function showScreen(name){state.screen=name;hubScreen.classList.toggle('active',name==='hub');gameScreen.classList.toggle('active',name==='game')}
function showBanner(text){messageBanner.textContent=text;messageBanner.classList.add('show');clearTimeout(showBanner._timer);showBanner._timer=setTimeout(()=>{messageBanner.classList.remove('show');messageBanner.textContent=''},3500)}
function shuffle(arr){return[...arr].sort(()=>Math.random()-.5)}
function selectQuestions(count){let available=window.QUESTION_BANK.filter(q=>!state.save.usedQuestionIds.includes(q.id));if(available.length<count){state.save.usedQuestionIds=[];available=[...window.QUESTION_BANK]}return shuffle(available).slice(0,count)}
function createPaintings(questions){const frames=[];for(let i=0;i<4;i++)frames.push({x:150+i*160,y:95,w:60,h:14});for(let i=0;i<4;i++)frames.push({x:150+i*160,y:490,w:60,h:14});frames.push({x:95,y:170,w:14,h:60});frames.push({x:851,y:170,w:14,h:60});return frames.map((f,i)=>({...f,question:questions[i],status:'available',id:'painting-'+i}))}
function startHeist(){const chosenQuestions=selectQuestions(10);state.currentTheme=themes[Math.floor(Math.random()*themes.length)];state.run={haul:0,strikes:0,paintings:createPaintings(chosenQuestions),ended:false,escaped:false};state.player={x:480,y:520,w:18,h:18,speed:2.4,controlLocked:false};state.guard={x:900,y:320,w:18,h:18,active:false};updateRunStats();showScreen('game');showBanner('Heist started: '+state.currentTheme.title)}
function updateRunStats(){if(!state.run)return;currentHaulEl.textContent=formatMoney(state.run.haul);strikeCountEl.textContent=`${state.run.strikes} / 3`;paintingsLeftEl.textContent=String(state.run.paintings.filter(p=>p.status==='available').length)}
function rectsOverlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function tryMove(dx,dy){const p=state.player;const minX=ROOM.x+20,maxX=ROOM.x+ROOM.w-20-p.w,minY=ROOM.y+20,maxY=ROOM.y+ROOM.h-20-p.h;p.x=Math.max(minX,Math.min(maxX,p.x+dx));p.y=Math.max(minY,Math.min(maxY,p.y+dy))}
function getNearbyPainting(){if(!state.run)return null;const p=state.player;const probe={x:p.x-18,y:p.y-18,w:p.w+36,h:p.h+36};return state.run.paintings.find(painting=>painting.status==='available'&&rectsOverlap(probe,painting))||null}
function maybeEscape(){if(!state.run||state.run.ended)return;if(rectsOverlap(state.player,DOOR)&&state.run.haul>0){endHeist(true)}else if(rectsOverlap(state.player,DOOR)){showBanner('You need some stolen art before escaping.')}}
function interact(){if(!state.run||state.run.ended||state.player.controlLocked)return;if(rectsOverlap(state.player,DOOR)){maybeEscape();return}const painting=getNearbyPainting();if(!painting){showBanner('Nothing to interact with here.');return}state.activePainting=painting;questionText.textContent=painting.question.question+' ('+formatMoney(painting.question.value)+')';answerInput.value='';questionModal.classList.remove('hidden');answerInput.focus()}
function submitAnswer(){if(!state.activePainting)return;const painting=state.activePainting;const q=painting.question;const input=answerInput.value;questionModal.classList.add('hidden');if(isAnswerCorrect(input,q)){painting.status='stolen';state.run.haul+=Number(q.value);state.save.paintingsStolen+=1;state.save.usedQuestionIds.push(q.id);updateRunStats();showBanner(`Stolen! +${formatMoney(q.value)}`);maybeAutoFinish()}else{painting.status='failed';state.run.strikes+=1;updateRunStats();flashWrong();showBanner('Wrong answer. Security alert increased.');if(state.run.strikes>=3){triggerGuardChase()}else{maybeAutoFinish()}}state.activePainting=null}
function flashWrong(){const old=canvas.style.boxShadow;canvas.style.boxShadow='0 0 0 3px #b24141 inset';setTimeout(()=>canvas.style.boxShadow=old,250)}
function maybeAutoFinish(){const anyAvailable=state.run.paintings.some(p=>p.status==='available');if(!anyAvailable)showBanner('All paintings attempted. Head for the exit to bank your haul.')}
function triggerGuardChase(){state.player.controlLocked=true;state.guard.active=true;showBanner('Security! Run for it... too late.')}
function endHeist(escaped){if(!state.run||state.run.ended)return;state.run.ended=true;state.run.escaped=escaped;state.save.heistsPlayed+=1;if(escaped){state.save.totalBanked+=state.run.haul;if(state.run.haul>state.save.bestHeist)state.save.bestHeist=state.run.haul;summaryTitle.textContent='Heist complete';summaryText.textContent=`You escaped with ${formatMoney(state.run.haul)}. It has been added to your total banked cash.`}else{summaryTitle.textContent='Caught by security';summaryText.textContent=`You were chased out and lost this run's haul of ${formatMoney(state.run.haul)}.`}saveProgress();summaryModal.classList.remove('hidden')}
function returnToHub(){summaryModal.classList.add('hidden');showScreen('hub');state.run=null;renderHubStats()}
function update(){if(state.screen==='game'&&state.run&&!state.run.ended&&!questionModal.classList.contains('hidden')){}else if(state.screen==='game'&&state.run&&!state.run.ended){if(!state.player.controlLocked){let dx=0,dy=0;if(state.keys.left)dx-=state.player.speed;if(state.keys.right)dx+=state.player.speed;if(state.keys.up)dy-=state.player.speed;if(state.keys.down)dy+=state.player.speed;if(dx!==0||dy!==0)tryMove(dx,dy)}else if(state.guard.active){if(state.player.x>470)state.player.x-=2.4;if(state.player.y<520)state.player.y+=2.2;if(state.guard.x>state.player.x+30)state.guard.x-=2;if(state.guard.y<state.player.y+8)state.guard.y+=1.6;if(state.guard.y>state.player.y+8)state.guard.y-=1.6;if(rectsOverlap(state.player,DOOR))endHeist(false)}}}
function drawRoom(){ctx.clearRect(0,0,canvas.width,canvas.height);const theme=state.currentTheme||themes[0];ctx.fillStyle='#0f1115';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle=theme.wall;ctx.fillRect(ROOM.x,ROOM.y,ROOM.w,ROOM.h);ctx.fillStyle=theme.floor;ctx.fillRect(ROOM.x+18,ROOM.y+18,ROOM.w-36,ROOM.h-36);ctx.fillStyle='#f4efe6';ctx.font='20px Arial';ctx.fillText(theme.title,ROOM.x+20,42);ctx.fillStyle='#7b5a3a';ctx.fillRect(DOOR.x,DOOR.y,DOOR.w,DOOR.h);if(state.run){for(const p of state.run.paintings){if(p.status==='stolen')continue;ctx.fillStyle=p.status==='failed'?'#994444':theme.frame;ctx.fillRect(p.x,p.y,p.w,p.h);if(p.status==='failed'){ctx.strokeStyle='#2f0e0e';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+p.w,p.y+p.h);ctx.stroke()}}}const nearby=getNearbyPainting();if(nearby&&!state.player.controlLocked&&questionModal.classList.contains('hidden')){ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(state.player.x-10,state.player.y-28,92,20);ctx.fillStyle='#f7e7b0';ctx.font='12px Arial';ctx.fillText('Press E / Interact',state.player.x-4,state.player.y-14)}else if(rectsOverlap(state.player,DOOR)&&!state.player.controlLocked){ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(state.player.x-10,state.player.y-28,86,20);ctx.fillStyle='#f7e7b0';ctx.font='12px Arial';ctx.fillText('Exit & bank',state.player.x-2,state.player.y-14)}ctx.fillStyle='#f3d082';ctx.fillRect(state.player.x,state.player.y,state.player.w,state.player.h);ctx.fillStyle='#222';ctx.fillRect(state.player.x+4,state.player.y+4,3,3);ctx.fillRect(state.player.x+11,state.player.y+4,3,3);if(state.guard.active){ctx.fillStyle='#78a0ff';ctx.fillRect(state.guard.x,state.guard.y,state.guard.w,state.guard.h);ctx.fillStyle='#111';ctx.fillRect(state.guard.x+4,state.guard.y+4,3,3);ctx.fillRect(state.guard.x+11,state.guard.y+4,3,3)}}
function loop(){update();drawRoom();requestAnimationFrame(loop)}
document.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(k==='arrowup'||k==='w')state.keys.up=true;if(k==='arrowdown'||k==='s')state.keys.down=true;if(k==='arrowleft'||k==='a')state.keys.left=true;if(k==='arrowright'||k==='d')state.keys.right=true;if((k==='e'||k===' ')&&questionModal.classList.contains('hidden')&&state.screen==='game'){e.preventDefault();interact()}if(k==='enter'&&!questionModal.classList.contains('hidden'))submitAnswer()});
document.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k==='arrowup'||k==='w')state.keys.up=false;if(k==='arrowdown'||k==='s')state.keys.down=false;if(k==='arrowleft'||k==='a')state.keys.left=false;if(k==='arrowright'||k==='d')state.keys.right=false});
joystickButtons.forEach(btn=>{const dir=btn.dataset.dir;const map={up:'up',down:'down',left:'left',right:'right'};const press=val=>state.keys[map[dir]]=val;btn.addEventListener('touchstart',e=>{e.preventDefault();press(true)},{passive:false});btn.addEventListener('touchend',e=>{e.preventDefault();press(false)},{passive:false});btn.addEventListener('mousedown',()=>press(true));btn.addEventListener('mouseup',()=>press(false));btn.addEventListener('mouseleave',()=>press(false))});
interactBtn.addEventListener('click',interact);
startHeistBtn.addEventListener('click',startHeist);
resetProgressBtn.addEventListener('click',resetProgress);
backToHubBtn.addEventListener('click',()=>showScreen('hub'));
submitAnswerBtn.addEventListener('click',submitAnswer);
cancelAnswerBtn.addEventListener('click',()=>{questionModal.classList.add('hidden');state.activePainting=null});
summaryContinueBtn.addEventListener('click',returnToHub);
renderHubStats();showScreen('hub');loop();
})();
