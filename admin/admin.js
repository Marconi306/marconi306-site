const state = { token: sessionStorage.getItem('m306_admin_token') || '', bookings: [], visibleBookings: [] };
const $ = selector => document.querySelector(selector);
const loginView = $('#login-view');
const adminView = $('#admin-view');
const list = $('#booking-list');
const dialog = $('#details-dialog');

function euro(cents) { return (Number(cents || 0) / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }); }
function parseDate(iso) { return iso ? new Date(`${iso}T12:00:00`) : null; }
function isoToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; }
function date(iso) { return iso ? new Intl.DateTimeFormat('it-IT', { day:'2-digit', month:'short', year:'numeric' }).format(parseDate(iso)) : '—'; }
function dateTime(value) { return value ? new Intl.DateTimeFormat('it-IT', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value.replace(' ', 'T') + 'Z')) : '—'; }
function code(booking) { return booking.id.split('-').slice(0, 2).join('-').toUpperCase(); }
function escapeHtml(value='') { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function statusLabel(status) { return ({CONFIRMED:'Confermata',HOLD:'In attesa',CANCELLED:'Annullata'})[status] || status; }
function guestName(b) { return `${b.first_name || ''} ${b.last_name || ''}`.trim(); }
function plural(value, singular, pluralWord) { return `${value} ${value === 1 ? singular : pluralWord}`; }
function csvCell(value) { const text=String(value ?? ''); return `"${text.replaceAll('"','""')}"`; }

async function api(path, options={}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type':'application/json', ...(state.token ? { Authorization:`Bearer ${state.token}` } : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== '/api/admin/login') logout();
  if (!response.ok) throw new Error(data.error || 'Operazione non riuscita.');
  return data;
}

function showAdmin() { loginView.hidden = true; adminView.hidden = false; setTodayLabel(); loadBookings(); }
function logout() { state.token=''; sessionStorage.removeItem('m306_admin_token'); adminView.hidden=true; loginView.hidden=false; }
function notify(message) { const el=$('#notice'); el.textContent=message; el.hidden=false; setTimeout(()=>el.hidden=true,6000); }
function setTodayLabel(){ $('#today-label').textContent=new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date()); }

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const error=$('#login-error'); error.textContent='';
  const button=event.submitter; button.disabled=true;
  try { const data=await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:$('#password').value})}); state.token=data.token; sessionStorage.setItem('m306_admin_token',data.token); $('#password').value=''; showAdmin(); }
  catch(err){ error.textContent=err.message; }
  finally{ button.disabled=false; }
});

async function loadBookings() {
  $('#loading').hidden=false; $('#empty').hidden=true; list.innerHTML='';
  try {
    const data=await api('/api/admin/bookings?status=ALL');
    state.bookings=data.bookings || [];
    renderDashboard(data.stats || {});
    applyFilters();
  } catch(err){ notify(err.message); }
  finally{ $('#loading').hidden=true; }
}

function renderDashboard(serverStats) {
  const today=isoToday();
  const confirmed=state.bookings.filter(b=>b.status==='CONFIRMED');
  const holds=state.bookings.filter(b=>b.status==='HOLD').length;
  const cancelled=state.bookings.filter(b=>b.status==='CANCELLED').length;
  const checkins=confirmed.filter(b=>b.start_date===today);
  const checkouts=confirmed.filter(b=>b.end_date===today);
  const stays=confirmed.filter(b=>b.start_date<today && b.end_date>today);
  const upcoming=confirmed.filter(b=>b.start_date>=today).sort((a,b)=>a.start_date.localeCompare(b.start_date));
  const next=upcoming[0];
  const daysToNext=next ? Math.max(0,Math.round((parseDate(next.start_date)-parseDate(today))/86400000)) : null;

  $('#today-checkins').textContent=checkins.length;
  $('#today-checkouts').textContent=checkouts.length;
  $('#today-stays').textContent=stays.length;
  $('#today-checkins-names').textContent=checkins.length?checkins.map(guestName).join(', '):'Nessuno';
  $('#today-checkouts-names').textContent=checkouts.length?checkouts.map(guestName).join(', '):'Nessuno';
  $('#today-stays-names').textContent=stays.length?stays.map(guestName).join(', '):'Nessuno';
  $('#next-arrival-days').textContent=daysToNext===null?'—':daysToNext===0?'Oggi':daysToNext===1?'Domani':`${daysToNext} gg`;
  $('#next-arrival-name').textContent=next?`${guestName(next)} · ${date(next.start_date)}`:'Nessuna prenotazione futura';

  const now=new Date(); const year=now.getFullYear(); const month=now.getMonth();
  const monthStart=`${year}-${String(month+1).padStart(2,'0')}-01`;
  const nextMonth=new Date(year,month+1,1); const nextMonthIso=`${nextMonth.getFullYear()}-${String(nextMonth.getMonth()+1).padStart(2,'0')}-01`;
  const daysInMonth=new Date(year,month+1,0).getDate();
  const monthBookings=confirmed.filter(b=>b.start_date>=monthStart && b.start_date<nextMonthIso);
  const monthRevenue=monthBookings.reduce((sum,b)=>sum+Number(b.amount_cents||0),0);
  const occupiedDates=new Set();
  for(const b of confirmed){
    let cursor=parseDate(b.start_date); const end=parseDate(b.end_date);
    while(cursor<end){
      if(cursor.getFullYear()===year && cursor.getMonth()===month) occupiedDates.add(`${cursor.getFullYear()}-${cursor.getMonth()+1}-${cursor.getDate()}`);
      cursor.setDate(cursor.getDate()+1);
    }
  }
  const occupancy=Math.round((occupiedDates.size/daysInMonth)*100);
  $('#stat-month-revenue').textContent=euro(monthRevenue);
  $('#stat-occupancy').textContent=`${occupancy}%`;
  $('#stat-occupied-nights').textContent=plural(occupiedDates.size,'notte occupata','notti occupate');
  $('#stat-upcoming').textContent=upcoming.length;
  $('#stat-revenue').textContent=euro(serverStats.revenue_cents || confirmed.reduce((s,b)=>s+Number(b.amount_cents||0),0));
  $('#stat-total-confirmed').textContent=plural(confirmed.length,'prenotazione confermata','prenotazioni confermate');
  $('#stat-hold-cancelled').textContent=`${holds} in attesa · ${cancelled} annullate`;
}

function applyFilters(){
  const query=$('#search').value.trim().toLowerCase();
  const status=$('#status-filter').value;
  const period=$('#period-filter').value;
  const today=isoToday();
  state.visibleBookings=state.bookings.filter(b=>{
    const haystack=`${guestName(b)} ${b.email} ${b.phone} ${b.id}`.toLowerCase();
    if(query && !haystack.includes(query)) return false;
    if(status!=='ALL' && b.status!==status) return false;
    if(period==='UPCOMING' && b.end_date<today) return false;
    if(period==='CURRENT' && !(b.start_date<=today && b.end_date>today)) return false;
    if(period==='PAST' && b.end_date>=today) return false;
    return true;
  }).sort((a,b)=>{
    if(period==='PAST') return b.start_date.localeCompare(a.start_date);
    const aPast=a.end_date<today, bPast=b.end_date<today;
    if(aPast!==bPast) return aPast?1:-1;
    return a.start_date.localeCompare(b.start_date);
  });
  renderBookings();
}

function renderBookings() {
  list.innerHTML=''; $('#empty').hidden=state.visibleBookings.length>0;
  $('#visible-count').textContent=plural(state.visibleBookings.length,'prenotazione','prenotazioni');
  const today=isoToday();
  for(const b of state.visibleBookings){
    const article=document.createElement('article');
    article.className=`booking-card ${b.end_date<today?'past-card':''}`;
    const periodText=b.status==='CONFIRMED' && b.start_date<=today && b.end_date>today?'In soggiorno':b.start_date===today?'Arrivo oggi':b.end_date===today?'Partenza oggi':'';
    article.innerHTML=`
      <div>
        <div class="guest-line"><span class="status ${b.status}">${statusLabel(b.status)}</span>${periodText?`<span class="period-pill">${periodText}</span>`:''}</div>
        <h3>${escapeHtml(guestName(b))}</h3><p class="code">${escapeHtml(code(b))}</p>
      </div>
      <div><strong>${date(b.start_date)} → ${date(b.end_date)}</strong><p>${plural(b.nights,'notte','notti')} · ${plural(b.guests,'ospite','ospiti')}</p></div>
      <div class="booking-contact"><div class="amount">${euro(b.amount_cents)}</div><p class="contact">${escapeHtml(b.email)}</p></div>
      <button class="secondary" data-id="${escapeHtml(b.id)}">Apri</button>`;
    article.querySelector('button').addEventListener('click',()=>openDetails(b.id)); list.append(article);
  }
}

function detail(label,value,html=false){return `<div class="detail"><span>${label}</span><strong>${html?value:escapeHtml(value ?? '—')}</strong></div>`;}
function openDetails(id){
  const b=state.bookings.find(item=>item.id===id); if(!b)return;
  const cleanPhone=String(b.phone||'').replace(/[^+\d]/g,'');
  $('#dialog-title').textContent=`${code(b)} · ${guestName(b)}`;
  $('#dialog-content').innerHTML=`<span class="status ${b.status}">${statusLabel(b.status)}</span><div class="detail-grid">
    ${detail('Ospite',guestName(b))}${detail('Soggiorno',`${date(b.start_date)} → ${date(b.end_date)}`)}
    ${detail('Email',`<a href="mailto:${escapeHtml(b.email)}">${escapeHtml(b.email)}</a>`,true)}
    ${detail('Telefono',`<a href="tel:${escapeHtml(cleanPhone)}">${escapeHtml(b.phone)}</a>`,true)}
    ${detail('Notti / ospiti',`${b.nights} / ${b.guests}`)}${detail('Totale',euro(b.amount_cents))}
    ${detail('Creata',dateTime(b.created_at))}${detail('Confermata',dateTime(b.confirmed_at))}
    ${detail('Ordine PayPal',b.paypal_order_id)}${detail('Capture PayPal',b.paypal_capture_id)}
  </div>${b.notes?`<h3>Note</h3><div class="notes">${escapeHtml(b.notes)}</div>`:''}`;
  const actions=$('#dialog-actions'); actions.innerHTML='';
  if(cleanPhone) actions.append(makeLink('Scrivi su WhatsApp',`https://wa.me/${cleanPhone.replace('+','')}?text=${encodeURIComponent(`Ciao ${b.first_name}, ti contatto in merito alla prenotazione ${code(b)} presso Marconi306.`)}`,'whatsapp'));
  if(b.status==='CONFIRMED') actions.append(makeButton('Reinvia email','secondary',()=>resendEmails(b.id)));
  if(b.status!=='CANCELLED') actions.append(makeButton('Annulla e libera date','danger',()=>cancelBooking(b)));
  dialog.showModal();
}
function makeButton(text,className,handler){const button=document.createElement('button');button.textContent=text;button.className=className;button.addEventListener('click',handler);return button;}
function makeLink(text,href,className){const link=document.createElement('a');link.textContent=text;link.href=href;link.target='_blank';link.rel='noopener';link.className=className;return link;}
async function cancelBooking(b){
  const warning=b.paypal_capture_id?'Questa operazione libera le date ma NON esegue il rimborso PayPal. Confermi?':'Confermi l’annullamento e la liberazione delle date?';
  if(!confirm(warning))return;
  try{const result=await api('/api/admin/cancel',{method:'POST',body:JSON.stringify({id:b.id})});dialog.close();notify(result.message);await loadBookings();}
  catch(err){alert(err.message);}
}
async function resendEmails(id){
  if(!confirm('Reinviare la conferma all’ospite e la notifica all’host?'))return;
  try{const result=await api('/api/admin/resend',{method:'POST',body:JSON.stringify({id})});notify(`Email inviate: ${result.sent}. Errori: ${result.failed}.`);dialog.close();}
  catch(err){alert(err.message);}
}
function exportCsv(){
  if(!state.visibleBookings.length){notify('Non ci sono prenotazioni da esportare.');return;}
  const rows=[['Codice','Stato','Nome','Cognome','Email','Telefono','Check-in','Check-out','Notti','Ospiti','Totale EUR','Note','ID ordine PayPal','ID acquisizione PayPal']];
  for(const b of state.visibleBookings) rows.push([code(b),statusLabel(b.status),b.first_name,b.last_name,b.email,b.phone,b.start_date,b.end_date,b.nights,b.guests,(Number(b.amount_cents||0)/100).toFixed(2),b.notes||'',b.paypal_order_id||'',b.paypal_capture_id||'']);
  const csv='\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`marconi306-prenotazioni-${isoToday()}.csv`;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
}

$('#close-dialog').addEventListener('click',()=>dialog.close());
$('#logout').addEventListener('click',logout);
$('#refresh').addEventListener('click',loadBookings);
$('#status-filter').addEventListener('change',applyFilters);
$('#period-filter').addEventListener('change',applyFilters);
$('#export-csv').addEventListener('click',exportCsv);
let timer; $('#search').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(applyFilters,250);});
if(state.token) showAdmin();
