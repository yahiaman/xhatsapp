import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';

export function validAdminToken(candidate, expected) {
  if (typeof candidate !== 'string' || !candidate || !expected) return false;
  const actual = Buffer.from(candidate, 'utf8');
  const wanted = Buffer.from(expected, 'utf8');
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export function adminAuth(expectedToken) {
  return (request, response, next) => {
    const authorization = request.header('Authorization') || '';
    const candidate = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';
    if (!validAdminToken(candidate, expectedToken)) {
      response.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }
    next();
  };
}

export async function readGroupInventory(path) {
  const payload = JSON.parse(await readFile(path, 'utf8'));
  const rawGroups = Array.isArray(payload)
    ? payload
    : payload?.groups || payload?.data || payload?.items || [];
  if (!Array.isArray(rawGroups)) throw new Error('invalid_group_inventory');

  return rawGroups.map((group) => ({
    id: String(group?.id || group?.groupId || group?.chatId || '').trim(),
    name: String(group?.subject || group?.name || '(sans nom)').trim(),
  })).filter((group) => group.id);
}

export function parsePolicy(body) {
  const keys = [
    'enabled',
    'isTest',
    'isAdmin',
    'isMonitored',
    'allowAutoReply',
    'allowBroadcast',
    'allowRecap',
  ];
  const policy = {};
  for (const key of keys) {
    if (typeof body?.[key] !== 'boolean') return null;
    policy[key] = body[key];
  }
  if ((policy.allowAutoReply || policy.allowBroadcast || policy.allowRecap) && body?.confirm !== true) {
    return { confirmationRequired: true };
  }
  return policy;
}

export function parseAgency(body) {
  const name = String(body?.name || '').trim();
  if (!name || name.length > 150) return null;
  return { name };
}

export function parseKeyword(body) {
  const category = String(body?.category || '').trim().toLowerCase();
  const term = String(body?.term || '').trim();
  if (!['donation', 'advertising'].includes(category)) return null;
  if (!term || term.length > 150) return null;
  return { category, term };
}

export function parseModeratorInput(body) {
  const phone = String(body?.phone || '').trim();
  const label = body?.label ? String(body.label).trim().slice(0, 150) : null;
  const digitsOnly = phone.replace(/\D/g, '');
  if (!digitsOnly || digitsOnly.length < 8 || digitsOnly.length > 20) return null;
  return { phone, label };
}

export function parseTemplateInput(body) {
  const content = String(body?.content || '').trim();
  if (!content || content.length > 4000) return null;
  return { content };
}

export const adminHtml = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Xhatsapp — Administration</title>
  <style>
    :root{color-scheme:light;font-family:system-ui,sans-serif;background:#f4f7f6;color:#18322b}
    body{margin:0}.wrap{max-width:1100px;margin:auto;padding:24px}h1{margin-bottom:4px}
    .muted{color:#5a6d67}.card{background:white;border:1px solid #dbe4e1;border-radius:14px;padding:18px;margin:18px 0;box-shadow:0 4px 18px #16382a10}
    input[type=password],input[type=text],input[type=time],textarea{width:100%;box-sizing:border-box;padding:8px;border:1px solid #aebdb8;border-radius:8px}textarea{min-height:76px;resize:vertical}
    button{background:#176c51;color:white;border:0;border-radius:8px;padding:10px 14px;cursor:pointer;margin:4px}button.secondary{background:#52645f}button.danger{background:#b3261e}
    table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #e3ebe8;vertical-align:middle}th{font-size:.82rem;color:#50645e}
    td.name{min-width:180px}.status{padding:10px;border-radius:8px;background:#eef4f2}.error{background:#ffe9e6;color:#8a2118}.ok{background:#e6f6ec;color:#175c31}
    @media(max-width:800px){table,thead,tbody,tr,th,td{display:block}thead{display:none}tr{border-bottom:2px solid #dbe4e1;padding:10px 0}td{border:0;padding:5px 0}td:before{content:attr(data-label);display:inline-block;min-width:145px;font-weight:650}}
  </style>
</head>
<body><main class="wrap">
  <h1>Administration Xhatsapp</h1><p class="muted">Xhatsapp 0.6.0 — modération stricte, diffusion, horaires et récapitulatifs</p>
  <section class="card" id="login"><label for="token">Jeton administrateur Xhatsapp</label><br><input id="token" type="password" autocomplete="current-password"><button id="connect">Connexion</button></section>
  <section class="card" id="panel" hidden><button id="sync">Actualiser l'inventaire</button><button class="secondary" id="logout">Déconnexion</button><p id="status" class="status">Chargement…</p>
  <h2>Gestion des groupes</h2><div style="overflow:auto"><table><thead><tr><th>Groupe</th><th>Référence</th><th>Actif</th><th>Test</th><th>Surveillance</th><th>Admin</th><th>Réponse auto</th><th>Diffusion</th><th>Récapitulatif</th><th></th></tr></thead><tbody id="groups"></tbody></table></div>
  
  <h2>Dictionnaires de modération</h2>
  <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
    <button id="tab-btn-agencies" type="button">🏢 Agences interdites</button>
    <button id="tab-btn-donations" type="button" class="secondary">💰 Dons & Cagnottes</button>
    <button id="tab-btn-ads" type="button" class="secondary">📢 Pubs & Placements</button>
    <button id="tab-btn-mods" type="button" class="secondary">🛡️ Modérateurs & Exemptés</button>
  </div>

  <div id="panel-agencies">
    <p class="muted"><strong>Suppression automatique :</strong> toute citation d'une agence de cette liste dans un groupe surveillé est immédiatement supprimée pour tous, avec rappel de neutralité dans le groupe et alerte d'information dans Groupe_admin.</p>
    <div style="display:flex;gap:8px;max-width:550px;margin-bottom:12px">
      <input id="new-agency" type="text" placeholder="Nom de l'agence à interdire (ex: Agence Exemple)">
      <button id="add-agency">Ajouter</button>
    </div>
    <input id="search-agency" type="text" placeholder="Filtrer la liste des agences..." style="max-width:320px;margin-bottom:10px">
    <div style="max-height:300px;overflow:auto;border:1px solid #dbe4e1;border-radius:8px">
      <table><thead><tr><th>Nom de l'agence</th><th>Ajoutée le</th><th>Action</th></tr></thead><tbody id="agencies"></tbody></table>
    </div>
  </div>

  <div id="panel-donations" hidden>
    <p class="muted"><strong>Validation humaine requise :</strong> termes, plateformes ou cagnottes suspects. Les messages ne sont <em>pas</em> supprimés automatiquement : une alerte avec confirmation (SUPPRIMER / IGNORER) est envoyée dans Groupe_admin.</p>
    <div style="display:flex;gap:8px;max-width:550px;margin-bottom:12px">
      <input id="new-donation-term" type="text" placeholder="Mot-clé ou plateforme (ex: leetchi.com, cotizup, cagnotte-hajj...)">
      <button id="add-donation-term">Ajouter</button>
    </div>
    <input id="search-donation" type="text" placeholder="Filtrer les mots-clés de dons..." style="max-width:320px;margin-bottom:10px">
    <div style="max-height:300px;overflow:auto;border:1px solid #dbe4e1;border-radius:8px">
      <table><thead><tr><th>Terme / Mot-clé</th><th>Ajouté le</th><th>Action</th></tr></thead><tbody id="donations"></tbody></table>
    </div>
  </div>

  <div id="panel-ads" hidden>
    <p class="muted"><strong>Validation humaine requise :</strong> marques commerciales, influenceurs ou codes promos suspects. Les messages ne sont <em>pas</em> supprimés automatiquement : une alerte avec confirmation (SUPPRIMER / IGNORER) est envoyée dans Groupe_admin.</p>
    <div style="display:flex;gap:8px;max-width:550px;margin-bottom:12px">
      <input id="new-ad-term" type="text" placeholder="Marque, code promo ou mot-clé (ex: promo-voyage, montre-hajj...)">
      <button id="add-ad-term">Ajouter</button>
    </div>
    <input id="search-ad" type="text" placeholder="Filtrer les mots-clés de pub..." style="max-width:320px;margin-bottom:10px">
    <div style="max-height:300px;overflow:auto;border:1px solid #dbe4e1;border-radius:8px">
      <table><thead><tr><th>Terme / Mot-clé</th><th>Ajouté le</th><th>Action</th></tr></thead><tbody id="ads"></tbody></table>
    </div>
  </div>

  <div id="panel-mods" hidden>
    <p class="muted"><strong>Exclusion du contrôle doublons :</strong> les numéros listés ici (modérateurs, bénévoles, comptes de secours) ne seront jamais exclus ni bloqués s'ils rejoignent plusieurs groupes, et ne figureront pas dans le rapport des doublons.</p>
    <div style="display:flex;gap:8px;max-width:650px;margin-bottom:12px;flex-wrap:wrap">
      <input id="new-mod-phone" type="text" placeholder="Numéro de téléphone (ex: +33 6 12 34 56 78 ou 06...)" style="flex:2;min-width:200px">
      <input id="new-mod-label" type="text" placeholder="Nom ou rôle (ex: Yahia - Coordinateur)" style="flex:2;min-width:180px">
      <button id="add-mod" style="flex:1">Ajouter</button>
    </div>
    <input id="search-mod" type="text" placeholder="Filtrer les modérateurs..." style="max-width:320px;margin-bottom:10px">
    <div style="max-height:300px;overflow:auto;border:1px solid #dbe4e1;border-radius:8px">
      <table><thead><tr><th>Numéro</th><th>Nom / Rôle</th><th>Ajouté le</th><th>Action</th></tr></thead><tbody id="mods"></tbody></table>
    </div>
  </div>

  <h2>Messages automatiques de la communauté</h2>
  <p class="muted">Messages personnalisés envoyés automatiquement en message privé (DM) sur WhatsApp aux pèlerins.</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-bottom:18px">
    <div style="background:#f8faf9;border:1px solid #dbe4e1;border-radius:10px;padding:14px">
      <label for="template-onboarding"><strong>📥 Message de bienvenue (Onboarding DM)</strong><br><span class="muted" style="font-size:0.85rem">Envoyé en privé dès qu'un nouveau pèlerin est accepté dans un groupe surveillé :</span></label>
      <textarea id="template-onboarding" style="min-height:160px;margin:8px 0;font-size:0.88rem"></textarea>
      <button id="save-onboarding">Enregistrer le message de bienvenue</button>
    </div>
    <div style="background:#f8faf9;border:1px solid #dbe4e1;border-radius:10px;padding:14px">
      <label for="template-refusal"><strong>🚫 Message de refus de doublon (DM privé)</strong><br><span class="muted" style="font-size:0.85rem">Variables : <code>{newGroupName}</code> (groupe demandé) et <code>{existingGroupName}</code> (groupe existant) :</span></label>
      <textarea id="template-refusal" style="min-height:160px;margin:8px 0;font-size:0.88rem"></textarea>
      <button id="save-refusal">Enregistrer le message de refus</button>
    </div>
  </div>

  <h2>Récapitulatif quotidien</h2><p class="muted">Génération locale à 20 h 10. Le brouillon consolidé doit être validé dans Groupe_admin avec GO RECAP &lt;CODE&gt;.</p><label for="recap-signature">Signature ajoutée en fin de récapitulatif</label><textarea id="recap-signature" maxlength="600" placeholder="Signature à définir ultérieurement"></textarea><button id="save-recap">Enregistrer la signature</button>
  <h2>Ouverture et fermeture automatiques</h2><p class="muted">Jours : 1=lundi … 7=dimanche. À la fermeture, le message est envoyé avant le verrouillage. À l’ouverture, le groupe est déverrouillé avant le message.</p><div style="overflow:auto"><table><thead><tr><th>Groupe</th><th>Activé</th><th>Jours</th><th>Ouverture</th><th>Fermeture</th><th>Message d’ouverture</th><th>Message de clôture</th><th></th></tr></thead><tbody id="schedules"></tbody></table></div></section>
</main><script>
const fields=['enabled','isTest','isMonitored','isAdmin','allowAutoReply','allowBroadcast','allowRecap'];
const labels={enabled:'Actif',isTest:'Test',isMonitored:'Surveillance',isAdmin:'Admin',allowAutoReply:'Réponse auto',allowBroadcast:'Diffusion',allowRecap:'Récapitulatif'};
const tokenInput=document.getElementById('token'), login=document.getElementById('login'), panel=document.getElementById('panel'), statusBox=document.getElementById('status'), tbody=document.getElementById('groups'), scheduleBody=document.getElementById('schedules');
const tabAgenciesBtn=document.getElementById('tab-btn-agencies'), tabDonationsBtn=document.getElementById('tab-btn-donations'), tabAdsBtn=document.getElementById('tab-btn-ads'), tabModsBtn=document.getElementById('tab-btn-mods');
const panelAgencies=document.getElementById('panel-agencies'), panelDonations=document.getElementById('panel-donations'), panelAds=document.getElementById('panel-ads'), panelMods=document.getElementById('panel-mods');
const agencyBody=document.getElementById('agencies'), agencyInput=document.getElementById('new-agency'), agencySearch=document.getElementById('search-agency');
const donationBody=document.getElementById('donations'), donationInput=document.getElementById('new-donation-term'), donationSearch=document.getElementById('search-donation');
const adBody=document.getElementById('ads'), adInput=document.getElementById('new-ad-term'), adSearch=document.getElementById('search-ad');
const modBody=document.getElementById('mods'), modPhoneInput=document.getElementById('new-mod-phone'), modLabelInput=document.getElementById('new-mod-label'), modSearch=document.getElementById('search-mod');
let token=sessionStorage.getItem('xhatsapp_admin_token')||'';
let allAgencies=[], allKeywords=[], allModerators=[];

const errLabels={'agency_already_exists':'Cette agence existe déjà dans le dictionnaire.','agency_add_failed':'Échec de l’enregistrement de l’agence.','keyword_already_exists':'Ce mot-clé existe déjà dans cette catégorie.','keyword_add_failed':'Échec de l’enregistrement du mot-clé.','invalid_agency':'Nom d’agence invalide.','invalid_keyword':'Mot-clé invalide.','invalid_moderator_phone':'Numéro de téléphone invalide (au moins 8 chiffres requis).'};
function headers(){return {'Authorization':'Bearer '+token,'Content-Type':'application/json'};}
function status(text,error=false){statusBox.textContent=text;statusBox.className='status '+(error?'error':'ok');}
async function api(path,options={}){const response=await fetch(path,{...options,headers:{...headers(),...(options.headers||{})}});if(response.status===401){logout();throw new Error('Jeton refusé');}const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(errLabels[data.error]||data.error||('HTTP '+response.status));return data;}

function selectTab(tab){
  tabAgenciesBtn.className=tab==='agencies'?'':'secondary';
  tabDonationsBtn.className=tab==='donations'?'':'secondary';
  tabAdsBtn.className=tab==='ads'?'':'secondary';
  tabModsBtn.className=tab==='mods'?'':'secondary';
  panelAgencies.hidden=tab!=='agencies';
  panelDonations.hidden=tab!=='donations';
  panelAds.hidden=tab!=='ads';
  panelMods.hidden=tab!=='mods';
}
tabAgenciesBtn.onclick=()=>selectTab('agencies');
tabDonationsBtn.onclick=()=>selectTab('donations');
tabAdsBtn.onclick=()=>selectTab('ads');
tabModsBtn.onclick=()=>selectTab('mods');

function checkbox(group,key){const cell=document.createElement('td');cell.dataset.label=labels[key];const input=document.createElement('input');input.type='checkbox';input.checked=group[key];input.dataset.key=key;cell.appendChild(input);return cell;}
function render(groups){tbody.replaceChildren();for(const group of groups){const row=document.createElement('tr');row.dataset.id=group.id;const name=document.createElement('td');name.className='name';name.dataset.label='Groupe';name.textContent=group.name;row.appendChild(name);const ref=document.createElement('td');ref.dataset.label='Référence';ref.textContent=group.reference;row.appendChild(ref);for(const key of fields)row.appendChild(checkbox(group,key));const action=document.createElement('td');const save=document.createElement('button');save.textContent='Enregistrer';save.onclick=()=>saveRow(row);action.appendChild(save);row.appendChild(action);tbody.appendChild(row);}}
function scheduleInput(value,type='text'){const input=document.createElement('input');input.type=type;input.value=value;return input;}
function renderSchedules(items){scheduleBody.replaceChildren();for(const item of items){const row=document.createElement('tr');row.dataset.id=item.groupId;const name=document.createElement('td');name.dataset.label='Groupe';name.textContent=item.groupName+' ('+item.groupReference+')';row.appendChild(name);const enabled=document.createElement('td');enabled.dataset.label='Activé';const enabledInput=document.createElement('input');enabledInput.type='checkbox';enabledInput.checked=item.enabled;enabledInput.dataset.schedule='enabled';enabled.appendChild(enabledInput);row.appendChild(enabled);const days=document.createElement('td');days.dataset.label='Jours';const daysInput=scheduleInput(item.weekdays.join(','));daysInput.dataset.schedule='weekdays';days.appendChild(daysInput);row.appendChild(days);for(const [key,label] of [['openTime','Ouverture'],['closeTime','Fermeture']]){const cell=document.createElement('td');cell.dataset.label=label;const input=scheduleInput(item[key],'time');input.dataset.schedule=key;cell.appendChild(input);row.appendChild(cell);}for(const [key,label] of [['openMessage','Message ouverture'],['closeMessage','Message clôture']]){const cell=document.createElement('td');cell.dataset.label=label;const area=document.createElement('textarea');area.value=item[key];area.dataset.schedule=key;cell.appendChild(area);row.appendChild(cell);}const action=document.createElement('td');const save=document.createElement('button');save.textContent='Enregistrer';save.onclick=()=>saveSchedule(row);const check=document.createElement('button');check.className='secondary';check.textContent='Vérifier droits';check.onclick=()=>checkRights(row);action.append(save,check);row.appendChild(action);scheduleBody.appendChild(row);}}

function renderAgencies(items){
  agencyBody.replaceChildren();
  const filter=agencySearch.value.trim().toLowerCase();
  const filtered=items.filter(a=>a.name.toLowerCase().includes(filter));
  for(const agency of filtered){
    const row=document.createElement('tr');
    const name=document.createElement('td');name.textContent=agency.name;
    const date=document.createElement('td');date.textContent=agency.created_at?new Date(agency.created_at).toLocaleDateString('fr-FR'):'-';
    const action=document.createElement('td');
    const delBtn=document.createElement('button');delBtn.className='danger';delBtn.textContent='Supprimer';
    delBtn.onclick=async()=>{
      if(!confirm('Supprimer l’agence « '+agency.name+' » du dictionnaire ?'))return;
      try{await api('/admin/api/agencies/'+encodeURIComponent(agency.id),{method:'DELETE'});status('Agence '+agency.name+' supprimée');await loadAgencies();}catch(err){status(err.message,true);}
    };
    action.appendChild(delBtn);row.append(name,date,action);agencyBody.appendChild(row);
  }
}

function renderKeywords(category, targetTbody, searchInput){
  targetTbody.replaceChildren();
  const filter=searchInput.value.trim().toLowerCase();
  const filtered=allKeywords.filter(k=>k.category===category&&k.term.toLowerCase().includes(filter));
  for(const item of filtered){
    const row=document.createElement('tr');
    const term=document.createElement('td');term.textContent=item.term;
    const date=document.createElement('td');date.textContent=item.created_at?new Date(item.created_at).toLocaleDateString('fr-FR'):'-';
    const action=document.createElement('td');
    const delBtn=document.createElement('button');delBtn.className='danger';delBtn.textContent='Supprimer';
    delBtn.onclick=async()=>{
      if(!confirm('Supprimer le mot-clé « '+item.term+' » ?'))return;
      try{await api('/admin/api/keywords/'+encodeURIComponent(item.id),{method:'DELETE'});status('Mot-clé « '+item.term+' » supprimé');await loadKeywords();}catch(err){status(err.message,true);}
    };
    action.appendChild(delBtn);row.append(term,date,action);targetTbody.appendChild(row);
  }
}

function renderModerators(items){
  modBody.replaceChildren();
  const filter=modSearch.value.trim().toLowerCase();
  const filtered=items.filter(m=>(m.phone||'').toLowerCase().includes(filter)||(m.label||'').toLowerCase().includes(filter));
  for(const mod of filtered){
    const row=document.createElement('tr');
    const phone=document.createElement('td');phone.textContent=mod.phone;
    const label=document.createElement('td');label.textContent=mod.label||'-';
    const date=document.createElement('td');date.textContent=mod.created_at?new Date(mod.created_at).toLocaleDateString('fr-FR'):'-';
    const action=document.createElement('td');
    const delBtn=document.createElement('button');delBtn.className='danger';delBtn.textContent='Supprimer';
    delBtn.onclick=async()=>{
      if(!confirm('Retirer le numéro « '+(mod.label?mod.label+' ('+mod.phone+')':mod.phone)+' » de la liste des modérateurs exemptés ?'))return;
      try{await api('/admin/api/moderators/'+encodeURIComponent(mod.id),{method:'DELETE'});status('Modérateur '+mod.phone+' supprimé');await loadModerators();}catch(err){status(err.message,true);}
    };
    action.appendChild(delBtn);row.append(phone,label,date,action);modBody.appendChild(row);
  }
}

async function loadAgencies(){try{const data=await api('/admin/api/agencies');allAgencies=data.agencies||[];renderAgencies(allAgencies);}catch(err){console.error(err);}}
async function loadKeywords(){
  try{
    const data=await api('/admin/api/keywords');
    allKeywords=data.keywords||[];
    renderKeywords('donation', donationBody, donationSearch);
    renderKeywords('advertising', adBody, adSearch);
  }catch(err){console.error(err);}
}
async function loadModerators(){
  try{
    const data=await api('/admin/api/moderators');
    allModerators=data.moderators||[];
    renderModerators(allModerators);
  }catch(err){console.error(err);}
}

async function loadTemplates(){
  try{
    const data=await api('/admin/api/templates');
    if(data.templates){
      for(const t of data.templates){
        if(t.id==='onboarding_dm') document.getElementById('template-onboarding').value=t.content;
        if(t.id==='duplicate_refusal_dm') document.getElementById('template-refusal').value=t.content;
      }
    }
  }catch(err){console.error(err);}
}

async function load(){
  const [groups,schedules,recap]=await Promise.all([api('/admin/api/groups'),api('/admin/api/schedules'),api('/admin/api/recap-settings')]);
  render(groups.groups);
  renderSchedules(schedules.schedules);
  document.getElementById('recap-signature').value=recap.settings.signature||'';
  await Promise.all([loadAgencies(), loadKeywords(), loadModerators(), loadTemplates()]);
  status(groups.groups.length+' groupe(s), '+allAgencies.length+' agence(s), '+allKeywords.length+' mot(s)-clé(s), '+allModerators.length+' modérateur(s) chargé(s)');
}

async function saveRow(row){const body={};for(const input of row.querySelectorAll('input[data-key]'))body[input.dataset.key]=input.checked;if(body.allowAutoReply||body.allowBroadcast||body.allowRecap){if(!confirm('Confirmer les autorisations automatiques sélectionnées pour ce groupe ?'))return;body.confirm=true;}try{await api('/admin/api/groups/'+encodeURIComponent(row.dataset.id),{method:'PUT',body:JSON.stringify(body)});status('Configuration enregistrée');await load();}catch(error){status(error.message,true);}}
async function saveSchedule(row){const get=(key)=>row.querySelector('[data-schedule="'+key+'"]');const body={enabled:get('enabled').checked,timezone:'Europe/Paris',weekdays:get('weekdays').value.split(',').map(value=>Number(value.trim())),openTime:get('openTime').value,closeTime:get('closeTime').value,openMessage:get('openMessage').value,closeMessage:get('closeMessage').value};if(body.enabled){if(!confirm('Activer ces horaires et autoriser Xhatsapp à verrouiller/déverrouiller ce groupe ? Selon l’heure actuelle, la première action peut démarrer dans les 30 secondes.'))return;body.confirm=true;}try{await api('/admin/api/schedules/'+encodeURIComponent(row.dataset.id),{method:'PUT',body:JSON.stringify(body)});status('Horaires enregistrés');await load();}catch(error){status(error.message,true);}}
async function checkRights(row){if(!confirm('Vérifier les droits administrateur OpenWA sans changer l’état du groupe ?'))return;try{await api('/admin/api/schedules/'+encodeURIComponent(row.dataset.id)+'/check',{method:'POST',body:JSON.stringify({confirm:true})});status('Droits administrateur vérifiés');}catch(error){status(error.message,true);}}

agencySearch.oninput=()=>renderAgencies(allAgencies);
donationSearch.oninput=()=>renderKeywords('donation', donationBody, donationSearch);
adSearch.oninput=()=>renderKeywords('advertising', adBody, adSearch);
modSearch.oninput=()=>renderModerators(allModerators);

document.getElementById('add-agency').onclick=async()=>{
  const name=agencyInput.value.trim();if(!name)return;
  try{await api('/admin/api/agencies',{method:'POST',body:JSON.stringify({name})});agencyInput.value='';status('Agence « '+name+' » ajoutée');await loadAgencies();}catch(err){status(err.message,true);}
};

document.getElementById('add-donation-term').onclick=async()=>{
  const term=donationInput.value.trim();if(!term)return;
  try{await api('/admin/api/keywords',{method:'POST',body:JSON.stringify({category:'donation',term})});donationInput.value='';status('Mot-clé de don « '+term+' » ajouté');await loadKeywords();}catch(err){status(err.message,true);}
};

document.getElementById('add-ad-term').onclick=async()=>{
  const term=adInput.value.trim();if(!term)return;
  try{await api('/admin/api/keywords',{method:'POST',body:JSON.stringify({category:'advertising',term})});adInput.value='';status('Mot-clé pub/placement « '+term+' » ajouté');await loadKeywords();}catch(err){status(err.message,true);}
};

document.getElementById('add-mod').onclick=async()=>{
  const phone=modPhoneInput.value.trim();
  const label=modLabelInput.value.trim();
  if(!phone)return;
  try{
    await api('/admin/api/moderators',{method:'POST',body:JSON.stringify({phone,label})});
    modPhoneInput.value='';
    modLabelInput.value='';
    status('Modérateur « '+(label?label+' ('+phone+')':phone)+' » ajouté');
    await loadModerators();
  }catch(err){status(err.message,true);}
};

document.getElementById('save-onboarding').onclick=async()=>{
  const content=document.getElementById('template-onboarding').value.trim();
  if(!content){status('Le message de bienvenue ne peut pas être vide',true);return;}
  try{await api('/admin/api/templates/onboarding_dm',{method:'PUT',body:JSON.stringify({content})});status('Message de bienvenue enregistré');}catch(err){status(err.message,true);}
};

document.getElementById('save-refusal').onclick=async()=>{
  const content=document.getElementById('template-refusal').value.trim();
  if(!content){status('Le message de refus ne peut pas être vide',true);return;}
  try{await api('/admin/api/templates/duplicate_refusal_dm',{method:'PUT',body:JSON.stringify({content})});status('Message de refus enregistré');}catch(err){status(err.message,true);}
};

async function connect(){token=tokenInput.value.trim();sessionStorage.setItem('xhatsapp_admin_token',token);login.hidden=true;panel.hidden=false;try{await load();}catch(error){status(error.message,true);}}
function logout(){token='';sessionStorage.removeItem('xhatsapp_admin_token');tokenInput.value='';login.hidden=false;panel.hidden=true;}
document.getElementById('connect').onclick=connect;document.getElementById('logout').onclick=logout;document.getElementById('sync').onclick=async()=>{try{const data=await api('/admin/api/groups/sync',{method:'POST',body:'{}'});status(data.imported+' groupe(s) synchronisé(s)');await load();}catch(error){status(error.message,true);}};
document.getElementById('save-recap').onclick=async()=>{const signature=document.getElementById('recap-signature').value;if(signature.length>600){status('Signature trop longue',true);return;}try{await api('/admin/api/recap-settings',{method:'PUT',body:JSON.stringify({signature})});status('Signature du récapitulatif enregistrée');}catch(error){status(error.message,true);}};
if(token){login.hidden=true;panel.hidden=false;load().catch(error=>status(error.message,true));}
</script></body></html>`;
