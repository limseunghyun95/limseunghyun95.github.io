import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const day = value => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))
const shift = (date,n) => new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10)
function collectionStart(previous,today){
 const start=previous.startDate||'2026-11-04'
 const last=Object.keys(previous.days||{}).sort().at(-1)||start
 const requested=[start,[last,shift(today,-6)].sort()[0]].sort().at(-1)
 return {from:[requested,shift(today,-179)].sort().at(-1),incomplete:requested<shift(today,-179)||previous.incomplete===true}
}
export function mergeVisits(previous, rows, today) {
 const startDate=previous.startDate||'2026-11-04',{from,incomplete}=collectionStart(previous,today)
 const days={...(previous.days||{})}
 for(let date=from;date<=today;date=shift(date,1))days[date]=0
 for(const row of rows){
  const date=day(row.dimensions.datetimeHour),value=row.sum.visits
  if(!Number.isFinite(value)||value<0)throw new Error('Invalid visit count')
  if(date>=from&&date<=today)days[date]=(days[date]||0)+value
 }
 for(const n of Object.values(days))if(!Number.isFinite(n)||n<0)throw new Error('Invalid saved visit count')
 return {version:1,startDate,incomplete,todayDate:today,today:days[today]||0,total:Object.values(days).reduce((a,b)=>a+b,0),days}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const token=process.env.CLOUDFLARE_ANALYTICS_TOKEN
 if(!token)throw new Error('Missing CLOUDFLARE_ANALYTICS_TOKEN; no data changed')
 const config=JSON.parse(await readFile('stats-config.json','utf8')),output='site-stats/visitors.json'
 let previous={startDate:config.startDate,days:{}}
 try{previous=JSON.parse(await readFile(output,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const today=day(new Date()),{from}=collectionStart(previous,today)
 const query=`query SiteVisits($account: string!, $site: string!, $since: Time!, $until: Time!) { viewer { accounts(filter:{accountTag:$account}) { rumPageloadEventsAdaptiveGroups(limit:1000,filter:{siteTag:$site,datetime_geq:$since,datetime_lt:$until},orderBy:[datetimeHour_ASC]) { dimensions { datetimeHour } sum { visits } } } } }`
 const rows=[]
 for(let first=from;first<=today;first=shift(first,7)){
  const next=shift(first,7)
  const response=await fetch('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query,variables:{account:config.accountId,site:config.siteTag,since:new Date(first+'T00:00:00+09:00').toISOString(),until:next>today?new Date().toISOString():new Date(next+'T00:00:00+09:00').toISOString()}})})
  if(!response.ok)throw new Error(`Analytics HTTP ${response.status}; prior snapshot retained`)
  const result=await response.json()
  if(result.errors?.length)throw new Error(`Analytics query failed: ${result.errors.map(e=>e.message).join('; ')}`)
  const batch=result.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups
  if(!Array.isArray(batch)||batch.length>=1000)throw new Error('Incomplete analytics response; prior snapshot retained')
  rows.push(...batch)
 }
 const snapshot={...mergeVisits(previous,rows,today),updatedAt:new Date().toISOString()}
 await mkdir('site-stats',{recursive:true});await writeFile(output,JSON.stringify(snapshot,null,2)+'\n')
 console.log(`Updated visit snapshot for ${today}; credentials were not written`)
}
