
async function refreshVisitorStats(){
 const status=document.querySelector('.stats-updated');if(!status)return;
 try{
  const r=await fetch('https://limseunghyun95.github.io/site-stats/visitors.json',{cache:'no-store'});
  if(!r.ok)throw new Error('unavailable');const d=await r.json();
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const format=n=>Number.isFinite(n)&&n>=0?Math.round(n).toLocaleString('ko-KR'):'—';
  document.querySelectorAll('[data-visitor="today"]').forEach(e=>e.textContent=d.todayDate===today?format(d.today):'—');
  document.querySelectorAll('[data-visitor="total"]').forEach(e=>e.textContent=format(d.total));
  status.textContent=d.updatedAt?'최근 집계 '+new Date(d.updatedAt).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'}):'집계 준비 중';
  status.title='Cloudflare 방문 기준 · 누적 고유 인원 수와는 다를 수 있습니다.';
  if(d.incomplete)status.textContent+=' · 일부 기간 누락';
  if(d.updatedAt&&Date.now()-Date.parse(d.updatedAt)>7200000)status.textContent+=' · 갱신 지연';
 }catch{status.textContent='방문 통계 연결 중';}
}
document.addEventListener('nav',refreshVisitorStats);
