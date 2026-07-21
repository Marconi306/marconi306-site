const state = { token: sessionStorage.getItem('m306_admin_token') || '', bookings: [] };
const $ = selector => document.querySelector(selector);
const loginView = $('#login-view');
const adminView = $('#admin-view');
const list = $('#booking-list');
const dialog = $('#details-dialog');

function euro(cents) { return (Number(cents || 0) / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }); }
function date(iso) { return iso ? new Intl.DateTimeFormat('it-IT', { day:'2-digit', month:'short', year:'numeric' }).format(new Date(`${iso}T12:00:00Z`)) : '—'; }
function dateTime(value) { return value ? new Intl.DateTimeFormat('it-IT', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value.replace(' ', 'T') + 'Z')) : '—'; }
function code(booking) { return booking.id.split('-').slice(0, 2).join('-').toUpperCase(); }
function escapeHtml(value='') { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function statusLabel(status) { return ({CONFIRMED:'Confermata',HOLD:'In attesa',CANCELLED:'Annullata'})[status] || status; }

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

function showAdmin() { loginView.hidden = true; adminView.hidden = false; loadBookings(); }
function logout() { state.token=''; sessionStorage.removeItem('m306_admin_token'); adminView.hidden=true; loginView.hidden=false; }
function notify(message) { const el=$('#notice'); el.textContent=message; el.hidden=false; setTimeout(()=>el.hidden=true,6000); }

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const error=$('#login-error'); error.textContent='';
  const button=event.submitter; button.disabled=true;
  try { const data=await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:$('#password').value})}); state.token=data.token; sessionStorage.setItem('m306_admin_token',data.token); $('#password').value=''; showAdmin(); }
  catch(err){ error.textContent=err.message; }
  finally{ button.disabled=false; }
});

async function loadBookings() {
  $('#loading').hidden=false; $('#empty').hidden=true; list.innerHTML='';
  const params=new URLSearchParams({status:$('#status-filter').value,search:$('#search').value.trim()});
  try {
    const data=await api(`/api/admin/bookings?${params}`); state.bookings=data.bookings;
    $('#stat-confirmed').textContent=data.stats.confirmed || 0; $('#stat-holds').textContent=data.stats.holds || 0; $('#stat-cancelled').textContent=data.stats.cancelled || 0; $('#stat-revenue').textContent=euro(data.stats.revenue_cents);
    renderBookings();
  } catch(err){ notify(err.message); }
  finally{ $('#loading').hidden=true; }
}

function renderBookings() {
  list.innerHTML=''; $('#empty').hidden=state.bookings.length>0;
  for(const b of state.bookings){
    const article=document.createElement('article'); article.className='booking-card';
    article.innerHTML=`<div><span class="status ${b.status}">${statusLabel(b.status)}</span><h3>${escapeHtml(b.first_name)} ${escapeHtml(b.last_name)}</h3><p class="code">${escapeHtml(code(b))}</p></div><div><strong>${date(b.start_date)} → ${date(b.end_date)}</strong><p>${b.nights} ${b.nights===1?'notte':'notti'} · ${b.guests} ${b.guests===1?'ospite':'ospiti'}</p></div><div><div class="amount">${euro(b.amount_cents)}</div><p>${escapeHtml(b.email)}</p></div><button class="secondary" data-id="${escapeHtml(b.id)}">Dettagli</button>`;
    article.querySelector('button').addEventListener('click',()=>openDetails(b.id)); list.append(article);
  }
}

function detail(label,value,html=false){return `<div class="detail"><span>${label}</span><strong>${html?value:escapeHtml(value ?? '—')}</strong></div>`;}
function openDetails(id){
  const b=state.bookings.find(item=>item.id===id); if(!b)return;
  $('#dialog-title').textContent=code(b);
  $('#dialog-content').innerHTML=`<span class="status ${b.status}">${statusLabel(b.status)}</span><div class="detail-grid">${detail('Ospite',`${b.first_name} ${b.last_name}`)}${detail('Soggiorno',`${date(b.start_date)} → ${date(b.end_date)}`)}${detail('Email',`<a href="mailto:${escapeHtml(b.email)}">${escapeHtml(b.email)}</a>`,true)}${detail('Telefono',`<a href="tel:${escapeHtml(b.phone)}">${escapeHtml(b.phone)}</a>`,true)}${detail('Notti / ospiti',`${b.nights} / ${b.guests}`)}${detail('Totale',euro(b.amount_cents))}${detail('Creata',dateTime(b.created_at))}${detail('Confermata',dateTime(b.confirmed_at))}${detail('Ordine PayPal',b.paypal_order_id)}${detail('Capture PayPal',b.paypal_capture_id)}</div>${b.notes?`<h3>Note</h3><div class="notes">${escapeHtml(b.notes)}</div>`:''}`;
  const actions=$('#dialog-actions'); actions.innerHTML='';
  if(b.status==='CONFIRMED') actions.append(makeButton('Reinvia email','secondary',()=>resendEmails(b.id)));
  if(b.status!=='CANCELLED') actions.append(makeButton('Annulla e libera date','danger',()=>cancelBooking(b)));
  dialog.showModal();
}
function makeButton(text,className,handler){const button=document.createElement('button');button.textContent=text;button.className=className;button.addEventListener('click',handler);return button;}
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

$('#close-dialog').addEventListener('click',()=>dialog.close()); $('#logout').addEventListener('click',logout); $('#refresh').addEventListener('click',loadBookings); $('#status-filter').addEventListener('change',loadBookings);
let timer; $('#search').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(loadBookings,350);});
if(state.token) showAdmin();
