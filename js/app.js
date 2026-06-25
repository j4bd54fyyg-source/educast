
// ── CESTA LEVELOV (gamifikacia) ──
var lwChosenLvlNum = 1;
function renderLevelPath(){
  var path = document.getElementById('lw-level-path');
  if(!path) return;
  var hasPlus = hasAccess('v');
  // Zatial 2 levely: L1 (free), L2 (PLUS kvizy)
  var levels = [
    {num:1, name:'Level 1', sub:'Základná výzva · zadarmo', lvCode:'r'},
    {num:2, name:'Level 2', sub:'Pokročilá výzva', lvCode:'v'}
  ];
  // Zisti ci je L1 dokonceny (z progressu)
  var html = '';
  levels.forEach(function(L, idx){
    var unlocked = (L.num===1) || hasPlus;
    var state = unlocked ? 'active' : 'locked';
    // konektor nad kartou (okrem prvej)
    if(idx>0){
      html += '<div class="level-connector'+(hasPlus?' lit':'')+'"></div>';
    }
    var iconBadge, title, sub, cta, cardCls, onclick;
    if(unlocked){
      cardCls='active-lvl'; 
      iconBadge='<div class="level-icon-badge lib-active">'+L.num+'</div>';
      title='<div class="level-title2 lt-active">'+L.name+'</div>';
      sub='<div class="level-sub2 ls-active">'+L.sub+'</div>';
      cta='<div class="level-cta lc-start">HRAŤ →</div>';
      onclick='lwPlayLevel('+L.num+",'"+L.lvCode+"')";
    } else {
      cardCls='locked-lvl';
      iconBadge='<div class="level-icon-badge lib-locked">🔒</div>';
      title='<div class="level-title2 lt-locked">'+L.name+'</div>';
      sub='<div class="level-sub2 ls-locked">Odomkni s EDUCAST PLUS</div>';
      cta='<div class="level-cta lc-locked">🔒 PREMIUM</div>';
      onclick='lcOpen('+L.num+')';
    }
    html += '<div class="level-node"><div class="level-card2 '+cardCls+'" onclick="'+onclick+'">'
      + iconBadge
      + '<div class="level-info2">'+title+sub+'</div>'
      + cta
      + '</div></div>';
  });
  path.innerHTML = html;
}
function lwPlayLevel(num, lvCode){
  lwChosenLvlNum = num;
  lwLv = lvCode; lv = lvCode;
  // Spusti kviz cez existujucu logiku
  lwStart();
}
function lcOpen(num){
  var ov = document.getElementById('level-choice-overlay');
  if(ov) ov.style.display = 'flex';
}
function lcClose(){
  var ov = document.getElementById('level-choice-overlay');
  if(ov) ov.style.display = 'none';
}
function lcGoLevel1(){
  lcClose();
  lwPlayLevel(1,'r');
}
function lcGoPaywall(){
  lcClose();
  showPaywall();
}

// ── VYBER STUPNA SKOLY ──
function selectStage(stage){
  if(stage === 'ss'){
    showPage('page-landing');
    updateAuthUI();
    // Rovno na predmety - preskoc vyber urovne. Ak ma PLUS, nastav PLUS, inak FREE.
    setTimeout(function(){
      if(typeof lwChooseLevel==='function'){ lwChooseLevel(hasAccess('v') ? 'v' : 'r'); }
    }, 20);
  } else {
    var nazov = stage === 'zs' ? 'Základná škola' : 'Vysoká škola';
    alert(nazov + ' — obsah pripravujeme. Čoskoro bude dostupný! Zatiaľ si vyskúšaj Strednú školu.');
  }
}
function goToStageSelect(){
  showPage('page-stage-select');
  updateAuthUI();
}


// ── GLOBAL LOADER ──
var _loaderTimer = null;
var _loaderPct = 0;
function showLoader(){
  var bar = document.getElementById('global-loader');
  var fill = document.getElementById('global-loader-bar');
  var pct = document.getElementById('global-loader-pct');
  if(!bar || !fill || !pct) return;
  if(_loaderTimer){ clearInterval(_loaderTimer); }
  _loaderPct = 0;
  bar.classList.add('show');
  
  fill.style.width = '0%';
  pct.textContent = '0 %';
  // Plynuly nabeh do ~90% (spomaluje sa cim blizsie k 90)
  _loaderTimer = setInterval(function(){
    if(_loaderPct < 90){
      var step = (90 - _loaderPct) * 0.08;
      if(step < 0.4) step = 0.4;
      _loaderPct += step;
      if(_loaderPct > 90) _loaderPct = 90;
      fill.style.width = _loaderPct + '%';
      pct.textContent = Math.round(_loaderPct) + ' %';
    }
  }, 120);
}
function setLoader(p){
  var fill = document.getElementById('global-loader-bar');
  var pct = document.getElementById('global-loader-pct');
  if(!fill || !pct) return;
  if(_loaderTimer){ clearInterval(_loaderTimer); _loaderTimer = null; }
  _loaderPct = Math.max(0, Math.min(100, p));
  fill.style.width = _loaderPct + '%';
  pct.textContent = Math.round(_loaderPct) + ' %';
}
function hideLoader(){
  var bar = document.getElementById('global-loader');
  var fill = document.getElementById('global-loader-bar');
  var pct = document.getElementById('global-loader-pct');
  if(!bar || !fill || !pct) return;
  if(_loaderTimer){ clearInterval(_loaderTimer); _loaderTimer = null; }
  fill.style.width = '100%';
  pct.textContent = '100 %';
  setTimeout(function(){
    bar.classList.remove('show');
    pct.classList.remove('show');
    setTimeout(function(){ fill.style.width = '0%'; }, 250);
  }, 280);
}

// ── Globalny fetch wrapper: loader pri kazdom sietovom volani ──
(function(){
  if(window._fetchWrapped) return;
  window._fetchWrapped = true;
  var _origFetch = window.fetch.bind(window);
  var _activeRequests = 0;
  window.fetch = function(){
    _activeRequests++;
    if(_activeRequests === 1 && typeof showLoader === 'function'){ showLoader(); }
    var done = function(){
      _activeRequests--;
      if(_activeRequests <= 0){
        _activeRequests = 0;
        if(typeof hideLoader === 'function'){ hideLoader(); }
      }
    };
    return _origFetch.apply(null, arguments).then(function(r){ done(); return r; }, function(e){ done(); throw e; });
  };
})();

// ═══════════════════════════════════════════════════════════
// AUTH SYSTÉM — Fáza 1
// Email + kód + device fingerprint (localStorage lock)
//
// ADMIN: Kódy spravuješ v objekte VALID_CODES nižšie.
// Formát: 'KOD': { email: 'email@email.sk', tier: 'p' }
// Kódy generuj napr. na: https://www.uuidgenerator.net/ Formát: EDU-P-2025-XXXX
// Každý kód = jeden platiteľ.
// ═══════════════════════════════════════════════════════════

// ── KÓDOVÁ TABUĽKA (aktualizuj po každej platbe) ──
// Tier: 'p' = EDUCAST PLUS (plný prístup k VÝZVA + MASTER)
var VALID_CODES = {
  // ADMIN prístup
  'EDU-ADMIN-2025': { email: 'dvdtrlk@proton.me', tier: 'p' },
  // Platitelia — pridávaj po každej platbe:
  'EDU-P-2025-DEMO1': { email: 'demo1@educast.sk', tier: 'p' },
  'EDU-P-2025-DEMO2': { email: 'demo2@educast.sk', tier: 'p' },
  // 'EDU-P-2025-XXXX': { email: 'student@email.sk', tier: 'p' },
};

// ── KONŠTANTY ──
var AUTH_KEY = 'educast_auth_v1';   // localStorage kľúč
var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jdXNpcGN5YXBzdXZyYm54dGt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzk3NjgsImV4cCI6MjA5NTgxNTc2OH0.XFveqebjISScFY9-8MCbNFtx0uj6iMz62V6F5JhMk_I';
var AUTH_MAX_DAYS = 35;              // počet dní do expirácie (trochu viac ako mesiac)

// ── AUTH STATE ──
var authState = { loggedIn: false, email: '', tier: 'r' };

// Načítaj uložený auth pri štarte
function authLoad() {
  try {
    var raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return;
    var data = JSON.parse(raw);
    // Skontroluj expiráciu
    if (!data.expires || Date.now() > data.expires) {
      localStorage.removeItem(AUTH_KEY);
      return;
    }
    // Skontroluj device fingerprint
    var fp = getFingerprint();
    if (data.fingerprint !== fp) {
      // Iné zariadenie — nevytváraj prístup automaticky
      return;
    }
    authState = { loggedIn: true, email: data.email, tier: data.tier };
  } catch(e) {
    localStorage.removeItem(AUTH_KEY);
  }
}

// Jednoduchý device fingerprint — kombinácia stabilných vlastností prehliadača
function getFingerprint() {
  var nav = window.navigator;
  var screen = window.screen;
  var parts = [
    nav.language || '',
    nav.platform || '',
    nav.userAgent ? nav.userAgent.substring(0, 60) : '',
    screen.width + 'x' + screen.height,
    screen.colorDepth || '',
    new Date().getTimezoneOffset()
  ];
  // Jednoduchý hash
  var str = parts.join('|');
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'fp_' + Math.abs(hash).toString(36);
}

// Ulož auth do localStorage
function authSave(email, tier) {
  var data = {
    email: email,
    tier: tier,
    fingerprint: getFingerprint(),
    expires: Date.now() + (AUTH_MAX_DAYS * 24 * 60 * 60 * 1000),
    savedAt: new Date().toISOString()
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(data));
  authState = { loggedIn: true, email: email, tier: tier };
  // Refresh po prihlaseni - cisty stav appky
  setTimeout(function(){ window.location.href = '/'; }, 400);
}

// Odhlásiť
function authLogout() {
  localStorage.removeItem(AUTH_KEY);
  authState = { loggedIn: false, email: '', tier: 'r' };
  window.location.href = '/';
}

// Hlavná funkcia overenia kódu
function authSubmit() {
  var emailInput = el('auth-email-input').value.trim().toLowerCase();
  var codeInput = el('auth-code-input').value.trim().toUpperCase();
  var errEl = el('auth-error');
  var successEl = el('auth-success-msg');
  var btn = el('auth-submit-btn');

  // Reset
  errEl.className = 'auth-error';
  successEl.className = 'auth-success';
  elSet('auth-email-input','className','auth-input');
  elSet('auth-code-input','className','auth-input');

  // Validácia vstupu
  if (!emailInput || !emailInput.includes('@')) {
    showAuthError('Zadaj platnú emailovú adresu.');
    elSet('auth-email-input','className','auth-input error');
    return;
  }
  if (!codeInput || codeInput.length < 6) {
    showAuthError('Zadaj prístupový kód z emailu.');
    elSet('auth-code-input','className','auth-input error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Overujem...';

  // Najprv skontroluj lokálne VALID_CODES (HeroHero + admin kódy)
  var localRecord = VALID_CODES[codeInput];
  if (localRecord) {
    if (localRecord.email.toLowerCase() !== emailInput) {
      showAuthError('Email sa nezhoduje s kódom. Použi email z platby.');
      elSet('auth-email-input','className','auth-input error');
      var ei = el('auth-email-input'); if(ei){ei.value='';ei.focus();}
      btn.disabled = false;
      btn.textContent = 'Odomknúť prístup →';
      return;
    }
    authSave(emailInput, localRecord.tier);
    btn.disabled = false;
    btn.textContent = 'Odomknúť prístup →';
    successEl.textContent = '✅ Prístup odomknutý! Vitaj, ' + emailInput;
    successEl.className = 'auth-success show';
    setTimeout(function() { updateAuthUI(); lwUpdateNav(); renderPortal(); closeAuth(); }, 1500);
    return;
  }

  // Ak nie je v lokálnych kódoch, skontroluj Supabase (Stripe kódy)
  fetch('https://mcusipcyapsuvrbnxtkw.supabase.co/rest/v1/access_codes?code=eq.' + encodeURIComponent(codeInput) + '&select=email,tier,valid_until', {
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jdXNpcGN5YXBzdXZyYm54dGt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzk3NjgsImV4cCI6MjA5NTgxNTc2OH0.XFveqebjISScFY9-8MCbNFtx0uj6iMz62V6F5JhMk_I',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jdXNpcGN5YXBzdXZyYm54dGt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzk3NjgsImV4cCI6MjA5NTgxNTc2OH0.XFveqebjISScFY9-8MCbNFtx0uj6iMz62V6F5JhMk_I'
    }
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    btn.disabled = false;
    btn.textContent = 'Odomknúť prístup →';

    if (!data || data.length === 0) {
      showAuthError('Neplatný kód. Skontroluj email od Educast.');
      elSet('auth-code-input','className','auth-input error');
      var ci = el('auth-code-input'); if(ci){ci.value='';ci.focus();}
      return;
    }

    var record = data[0];

    if (record.email.toLowerCase() !== emailInput) {
      showAuthError('Email sa nezhoduje s kódom. Použi email zo Stripe platby.');
      elSet('auth-email-input','className','auth-input error');
      var ei = el('auth-email-input'); if(ei){ei.value='';ei.focus();}
      return;
    }

    if (record.valid_until && Date.now() > new Date(record.valid_until).getTime()) {
      showAuthError('Kód expiroval. Obnov predplatné.');
      return;
    }

    authSave(emailInput, record.tier);
    successEl.textContent = '✅ Prístup odomknutý! Vitaj, ' + emailInput;
    successEl.className = 'auth-success show';
    setTimeout(function() { updateAuthUI(); lwUpdateNav(); renderPortal(); closeAuth(); }, 1500);
  })
  .catch(function() {
    btn.disabled = false;
    btn.textContent = 'Odomknúť prístup →';
    showAuthError('Chyba pripojenia. Skús znova.');
  });
}

function showAuthError(msg) {
  var errDiv = document.getElementById('auth-error');
  if(!errDiv) return;
  errDiv.textContent = '⚠️ ' + msg;
  errDiv.className = 'auth-error show';
}

// Otvor auth modal
function openAuth() {
  updateAuthModalState();
  // Reset chybovej správy pri otvorení
  var errEl = el('auth-error');
  if(errEl) errEl.className = 'auth-error';
  var ci = el('auth-code-input'); if(ci) ci.className = 'auth-input';
  var ei = el('auth-email-input'); if(ei) ei.className = 'auth-input';
  el('auth-overlay').classList.add('show');
  // Focus na email ak nie je prihlásený
  if(!authState.loggedIn){ setTimeout(function(){ var e=el('auth-email-input'); if(e) e.focus(); },100); }
}

function closeAuth() {
  el('auth-overlay').classList.remove('show');
}

function switchTab(tab) {
  elStyle('tab-login-content','display', tab === 'login' ? 'block' : 'none');
  elStyle('tab-buy-content','display', tab === 'buy' ? 'block' : 'none');
  elSet('tab-login','className','auth-tab' + (tab === 'login' ? ' active' : ''));
  elSet('tab-buy','className','auth-tab' + (tab === 'buy' ? ' active' : ''));
}

// Aktualizuj stav auth modalu podľa toho či je prihlásený
function updateAuthModalState() {
  var loggedIn = authState.loggedIn;
  elStyle('auth-logged-in','display', loggedIn ? 'block' : 'none');
  elStyle('auth-form-section','display', loggedIn ? 'none' : 'block');
  if (loggedIn) {
    elSet('auth-email-display','textContent', authState.email);
    var tierEl = el('auth-tier-display');
    if (authState.tier === 'm') {
      tierEl.textContent = '🎓 EDUCAST PLUS';
      
    } else if (authState.tier === 'v') {
      tierEl.textContent = '🎓 EDUCAST PLUS';
      tierEl.className = 'auth-tier-badge atb-v';
    }
  }
}

// Aktualizuj UI portálu podľa auth stavu
// Pomocná funkcia — bezpečný getElementById (nevyhodí chybu ak element neexistuje)
function el(id) { return document.getElementById(id); }
function elSet(id, prop, val) { var e = el(id); if (e) e[prop] = val; }
function elStyle(id, prop, val) { var e = el(id); if (e) e.style[prop] = val; }

function updateAuthUI() {
  // Elementy existujú iba na portal page — bezpečne ignorujeme ak chýbajú
  if (authState.loggedIn) {
    elSet('portal-auth-btn', 'textContent', '👤 ' + authState.email.split('@')[0]);
    var _pab = el('portal-auth-btn'); if(_pab) _pab.setAttribute('onclick','showProfile()');
    elSet('lk-v', 'textContent', '');
    elSet('lk-m', 'textContent', '');
    elSet('op-v', 'textContent', '0%');
    elSet('op-m', 'textContent', '0%');
  } else {
    elSet('portal-auth-btn', 'textContent', '🔑 Prihlásiť sa');
    var _pab2 = el('portal-auth-btn'); if(_pab2) _pab2.setAttribute('onclick','openAuth()');
    elSet('lk-v', 'textContent', '🔒');
    elSet('lk-m', 'textContent', '🔒');
    elSet('op-v', 'textContent', '🔒');
    elSet('op-m', 'textContent', '🔒');
  }
}

// Skontroluj či má užívateľ prístup k danej úrovni
function hasAccess(level) {
  if (level === 'r') return true;
  if (!authState.loggedIn) return false;
  if (level === 'v') return authState.tier === 'v' || authState.tier === 'm' || authState.tier === 'p';
  if (level === 'm') return authState.tier === 'm' || authState.tier === 'p';
  return false;
}

// ═══════════════════════════════════════════
// STAV
// ═══════════════════════════════════════════
var TS=15;
var roc=1,lv='r',md='t',sub=null,cur=0,scr=0,ans=false,answers=[];
var matAnswers={}; // {questionIndex: chosenOptionIndex or text}
var tT=null,tTot=null,tck=false,ax=null,tot=0;

var pg={};
function pgGet(r,l,id){return pg[r+'_'+l+'_'+id]||0;}
function pgSet(r,l,id,v){pg[r+'_'+l+'_'+id]=v;}

// ── HISTÓRIA KVÍZOV ──
var quizHistory = []; // pole záznamov { id, roc, lv, name, icon, pct, scr, total, mode, time, date, answers[] }
// answers[i] = { q, opts, correct(index), chosen(index), isCorrect, exp }

function saveToHistory(record){
  quizHistory.unshift(record);
  if(quizHistory.length > 50) quizHistory.pop();
  gSave('quizHistoryArr', quizHistory); // ulož do localStorage
}

function renderHistory(){
  var list = el('hist-list');
  var cnt = el('hist-count');
  if(!list) return;
  if(quizHistory.length === 0){
    list.innerHTML = '<div class="hist-empty">Zatiaľ žiadne dokončené kvízy. Vyskúšaj prvý kvíz!</div>';
    if(cnt) cnt.textContent = '';
    return;
  }
  if(cnt) cnt.textContent = quizHistory.length + ' záznamov';
  var L = ['A','B','C','D'];
  list.innerHTML = quizHistory.map(function(r, idx){
    var pctClass = r.pct >= 80 ? 'good' : r.pct >= 50 ? 'ok' : 'bad';
    var wrongs = r.total - r.scr;
    var lvBadge = r.lv==='r'?'🆓':r.lv==='v'?'⭐':'👑';
    var modeIcon = r.mode==='s'?'⚔️':'📋';
    return '<div class="hist-item" onclick="showDetail('+idx+')">'+
      '<div class="hist-left">'+
        '<div class="hist-icon">'+r.icon+'</div>'+
        '<div class="hist-info">'+
          '<div class="hist-name">'+r.name+' '+modeIcon+'</div>'+
          '<div class="hist-meta">'+r.roc+'. ročník · '+lvBadge+' '+r.lv.toUpperCase()+' · '+r.date+'</div>'+
        '</div>'+
      '</div>'+
      '<div class="hist-score">'+
        '<div class="hist-pct '+pctClass+'">'+r.pct+'%</div>'+
        '<div class="hist-wrongs">'+r.scr+'/'+r.total+(wrongs>0?' · '+wrongs+'❌':'')+'</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

function showDetail(idx){
  var r = quizHistory[idx];
  if(!r) return;
  showPage('page-detail');
  var pctClass = r.pct >= 80 ? 'good' : r.pct >= 50 ? 'ok' : 'bad';
  var modeIcon = r.mode==='s'?'⚔️ Súťaž':'📋 Test';
  elSet('detail-title', 'textContent', r.icon+' '+r.name+' · '+r.roc+'. ročník');
  elSet('detail-summary', 'innerHTML',
    '<div class="ds-card"><div class="ds-val '+pctClass+'">'+r.pct+'%</div><div class="ds-lbl">Výsledok</div></div>'+
    '<div class="ds-card"><div class="ds-val" style="color:#2ecc71">'+r.scr+'</div><div class="ds-lbl">Správnych</div></div>'+
    '<div class="ds-card"><div class="ds-val" style="color:#e74c3c">'+( r.total-r.scr)+'</div><div class="ds-lbl">Nesprávnych</div></div>'
  );
  var L = ['A','B','C','D'];
  var html = r.answers.map(function(a, i){
    var isOk = a.isCorrect;
    return '<div class="dq-item">'+
      '<div class="dq-header">'+
        '<span class="dq-num '+( isOk?'correct':'wrong')+'">'+( isOk?'✓':'✗')+' '+(i+1)+'</span>'+
        '<div class="dq-q">'+a.q+'</div>'+
      '</div>'+
      '<div class="dq-opts">'+
        a.opts.map(function(opt, oi){
          var cls = '';
          if(oi === a.correct) cls = 'correct-opt';
          else if(oi === a.chosen && !isOk) cls = 'wrong-opt';
          return '<div class="dq-opt '+cls+'">'+
            '<span class="dq-ltr">'+L[oi]+'</span>'+opt+
          '</div>';
        }).join('')+
      '</div>'+
      '<div class="dq-exp">💡 '+a.exp+'</div>'+
    '</div>';
  }).join('');
  elSet('detail-questions', 'innerHTML', html);
  window.scrollTo(0,0);
}

var C={
  r:{bg:'bgr',stb:'sbr',tb:'tbr',pf:'pfr2',qn:'qnr',o:'or',l:'lrr',nx:'nxr',sc:'sbr2',cc:'ccr',sv:'svr',rb:'rr',mbs:'mbsr',mbt:'mbtr',tt:'ttr',pb:'pr',pd:'pr d',pc:'pr c',cd:'cdr'},
  v:{bg:'bgv',stb:'sbv',tb:'tbv',pf:'pfv2',qn:'qnv',o:'ov',l:'lrv',nx:'nxv',sc:'sbv2',cc:'ccv',sv:'svv',rb:'rv',mbs:'mbsv',mbt:'mbsr',tt:'ttv',pb:'pv',pd:'pv d',pc:'pv c',cd:'cdv'},
  m:{bg:'bgm',stb:'sbm',tb:'tbm',pf:'pfm2',qn:'qnm',o:'om',l:'lrm',nx:'nxm',sc:'sbm2',cc:'ccm',sv:'svm',rb:'rm',mbs:'mbsm',mbt:'mbtm',tt:'ttm',pb:'pm2',pd:'pm2 d',pc:'pm2 c',cd:'cdm'},
};

var SUBS=[
  {id:'slj',icon:'📝',name:'Slovenský jazyk'},
  {id:'lit',icon:'📚',name:'Literatúra'},
  {id:'mat',icon:'🔢',name:'Matematika'},
  {id:'dej',icon:'🌍',name:'Dejepis'},
  {id:'bio',icon:'🔬',name:'Biológia'},
  {id:'che',icon:'⚗️',name:'Chémia'},
  {id:'fyz',icon:'⚡',name:'Fyzika'},
  {id:'ang',icon:'🇬🇧',name:'Anglický jazyk'},
];

var META={
  1:{r:{slj:'Lexikológia, sloh',lit:'Literárne pojmy',mat:'Číselné obory',dej:'Pravek, starovek',bio:'Bunka, ekosystém',che:'Atóm, prvky',fyz:'Pohyb, sily, energia',ang:'Základná gramatika'},
     v:{slj:'Morfológia, syntax',lit:'Renesancia, barok',mat:'Funkcie, logaritmy',dej:'Stredovek',bio:'Bunková biológia',che:'Väzby, reakcie',fyz:'Elektrina, vlnenie',ang:'Stredná gramatika'},
     m:{slj:'Diskurz, epistemológia',lit:'Literárna teória',mat:'Pokročilá analýza',dej:'Filozofia dejín',bio:'Filozofia biológie',che:'Fyzikálna chémia',fyz:'Kvantová fyzika',ang:'C1/C2'}},
  2:{r:{slj:'Syntax, morfológia',lit:'Renesancia, barok',mat:'Logaritmy, funkcie',dej:'Stredovek, novovek',bio:'Bunková biológia',che:'Reakcie, rovnováha',fyz:'Elektrina, vlnenie',ang:'Gramatika 2R'},
     v:{slj:'Syntax — hlbšie',lit:'Renesancia — hlbšia',mat:'Logaritmy, štatistika',dej:'Stredovek — hlbšia',bio:'Bunková biológia — hlbšie',che:'Väzby, kinetika',fyz:'Elektrina, magnetizmus',ang:'Pokročilá gramatika'},
     m:{slj:'Diskurz a pragmatika',lit:'Literárna teória',mat:'Pokročilá analýza',dej:'20. stor. — hlbšia',bio:'Evolúcia, ekológia',che:'Fyzikálna chémia',fyz:'Kvantová fyzika',ang:'C1/C2'}},
  3:{r:{slj:'Štylistika, rétorika',lit:'Romantizmus, realizmus',mat:'Kombinatorika',dej:'20. storočie',bio:'Genetika, evolúcia',che:'Organická chémia',fyz:'Optika, vlnenie',ang:'Gramatika 3R'},
     v:{slj:'Štylistika — hlbšie',lit:'Romantizmus — hlbšia',mat:'Kombinatorika — hlbšie',dej:'20. stor. — hlbšia',bio:'Genetika — hlbšie',che:'Organika — hlbšie',fyz:'Optika — hlbšie',ang:'Pokročilá gramatika'},
     m:{slj:'Diskurz a rétorika',lit:'Literárna teória',mat:'Analýza a teória',dej:'Filozofia dejín',bio:'Filozofia biológie',che:'Fyzikálna chémia',fyz:'Kvantová fyzika',ang:'C1/C2'}},
  4:{r:{slj:'Komplexná jazykoveda',lit:'Moderná literatúra',mat:'Maturitná matematika',dej:'20. stor. — maturita',bio:'Maturitná biológia',che:'Maturitná chémia',fyz:'Maturitná fyzika',ang:'Maturitná angličtina'},
     v:{slj:'Komplexná štylistika',lit:'Moderná lit. — hlbšia',mat:'Maturitná mat. — hlbšie',dej:'Maturitná analýza',bio:'Maturitná bio. — hlbšia',che:'Maturitná che. — hlbšia',fyz:'Maturitná fyz. — hlbšia',ang:'Maturitná AJ B2+'},
     m:{slj:'Epistemológia jazyka',lit:'Pokročilá teória',mat:'Pokročilá matematika',dej:'Filozofia dejín',bio:'Filozofia biológie',che:'Fyzikálna + filozofia chémie',fyz:'Kvantová fyzika, frontiera',ang:'C1/C2 — najvyššia'}},
};

// ═══════════════════════════════════════════
// DATABÁZA KVÍZOV
// ═══════════════════════════════════════════
var DB={};
function addQ(r,l,id,qs){DB[r+'_'+l+'_'+id]=qs;}

addQ(1,'r','slj',[
  {q:'Čo skúma lexikológia?',a:1,opts:['Výslovnosť a hlásky','Slová a slovnú zásobu','Stavbu viet','Pravopis'],exp:'Lexikológia je náuka o slove a slovnej zásobe jazyka.'},
  {q:'Synonymá sú slová:',a:3,opts:['Rovnakého záznamu','Rovnakého zvuku','Protikladného obsahu','Podobného alebo'],exp:'Synonymá majú podobný alebo rovnaký význam, ale iné znenie.'},
  {q:'Frazeologizmus je:',a:0,opts:['Ustálené spojenie','Zastarané slovo','Odborný výraz','Novotvar'],exp:'Frazeologizmus je ustálené slovné spojenie s preneseným významom.'},
  {q:'Neologizmy sú slová:',a:2,opts:['Zastarané','Nárečové','Nové pre nové javy','Prevzaté z cudzích jazykov'],exp:'Neologizmy sú novovznikajúce slová — domáce aj cudzie.'},
  {q:'Koľko základných slohových postupov poznáme?',a:3,opts:['Tri','Päť','Šesť','Štyri'],exp:'4 slohové postupy: informačný, opisný, rozprávací a výkladový.'},
  {q:'Konspekt slúži ako:',a:1,opts:['Zoznam literatúry','Zhustený záznam','Osnova v bodoch','Denník'],exp:'Konspekt zachytáva hlavné myšlienky a štruktúru textu.'},
  {q:'Homonymá majú:',a:2,opts:['Podobný obsah','Opačný obsah','Rovnaké znenie, iný význam','Rovnaký pôvod'],exp:'Homonymá znejú rovnako, ale majú odlišný význam.'},
  {q:'Základná funkcia jazyka je:',a:0,opts:['Komunikatívna','Estetická','Informatívna','Poetická'],exp:'Základná funkcia jazyka je komunikatívna — slúži na dorozumievanie.'},
]);
addQ(1,'r','lit',[
  {q:'Tri literárne druhy sú:',a:2,opts:['Román, báseň, komédia','Tragédia, komédia, epos','Epika, lyrika, dráma','Próza, poézia, divadlo'],exp:'Tri základné literárne druhy sú epika, lyrika a dráma.'},
  {q:'Metafora je:',a:0,opts:['Prenesené','Priame porovnanie','Opakovanie hlások','Zosobnenie'],exp:'Metafora je prenesené pomenovanie — napr. more sĺz.'},
  {q:'Rým je zhoda:',a:3,opts:['Rytmu na začiatku','Metrickej schémy','Slov s opačným významom','Hlások na konci veršov'],exp:'Rým je zvuková zhoda hlások na konci veršov.'},
  {q:'Epika zachytáva:',a:1,opts:['City a dojmy','Príbehy a udalosti s dejom','Lyrické obrazy','Dialógy'],exp:'Epika zachytáva príbehy a udalosti — román, poviedka, novela.'},
  {q:'Prirovnanie používa slovo:',a:2,opts:['Teda','Hoci','Ako alebo sťa','Snad'],exp:'Prirovnanie porovnáva dve veci pomocou ako, sťa.'},
  {q:'Bájka je žáner kde:',a:1,opts:['Postavy sú bohovia','Zvieratá konajú ako ľudia','Príbeh je vo vesmíre','Hrdinovia sú historické osoby'],exp:'Bájka: zvieratá konajú ako ľudia. Má morálne ponaučenie.'},
  {q:'Lyrika vyjadruje:',a:0,opts:['City a subjektívne nálady','Dialógy medzi postavami','Historické udalosti','Hrdinské činy'],exp:'Lyrika vyjadruje city, nálady a subjektívne dojmy.'},
  {q:'Personifikácia pripisuje:',a:1,opts:['Zvieratám ľudské chyby','Neživým veciam ľudské vlastnosti','Ľuďom zvláštne schopnosti','Veciam zvieracie vlastnosti'],exp:'Personifikácia pripisuje ľudské vlastnosti neživým veciam.'},
]);
addQ(1,'r','mat',[
  {q:'Prirodzené čísla začínajú od:',a:3,opts:['Záporných hodnôt','Nuly','Zlomkových','Čísla 1 a stúpajú'],exp:'Prirodzené čísla: 1, 2, 3, 4...'},
  {q:'Výsledok 2³ je:',a:1,opts:['Šesť','Osem','Štyri','Deväť'],exp:'2³ = 2×2×2 = 8.'},
  {q:'Pravý uhol meria:',a:2,opts:['45°','180°','90°','60°'],exp:'Pravý uhol má presne 90°.'},
  {q:'Obvod štvorca so stranou a:',a:0,opts:['4a','a²','2a','3a'],exp:'Obvod štvorca = 4×a.'},
  {q:'Zlomok a/b vyjadruje:',a:3,opts:['Súčet','Rozdiel','Súčin','Podiel'],exp:'Zlomok a/b = podiel čísla a a čísla b.'},
  {q:'Celé čísla zahŕňajú:',a:2,opts:['Iba kladné','Iba záporné a nulu','Kladné, záporné aj nulu','Iba desatinné'],exp:'Celé čísla: prirodzené, záporné a nula.'},
  {q:'Rovnica obsahuje:',a:1,opts:['Súčin premenných','Rovnosť výrazov s neznámou','Iba čísla','Nerovnosť'],exp:'Rovnica: rovnosť dvoch výrazov, hľadáme hodnotu neznámej.'},
  {q:'Pri priamej úmere:',a:0,opts:['Y rastie spolu s x','Y klesá','Y je odmocnina','Y je rovnaké'],exp:'Priamková úmera: y=ax. Keď x rastie, y rastie proporcionálne.'},
]);
addQ(1,'r','dej',[
  {q:'Starovek začína vznikom:',a:0,opts:['Písma (cca 3200 pred Kr.)','Prvých nástrojov','Kresťanstva','Rímskej ríše'],exp:'Starovek začína vznikom písma — okolo roku 3200 pred Kristom.'},
  {q:'Prvá civilizácia vznikla v:',a:2,opts:['Egypte','Číne','Mezopotámii','Grécku'],exp:'Prvá civilizácia vznikla v Mezopotámii — Sumeri.'},
  {q:'Atény sú kolískou:',a:3,opts:['Monarchie','Oligarchie','Teokracie','Demokracie'],exp:'Atény sú považované za kolísku demokracie.'},
  {q:'Pyramídy slúžili ako:',a:1,opts:['Sídla faraóna','Hrobky faraónov','Vojenské opevnenia','Chrámy'],exp:'Egyptské pyramídy boli hrobky faraónov.'},
  {q:'Alexander Veľký bol:',a:0,opts:['Macedónsky kráľ a dobyvateľ','Rímsky cisár','Grécky filozof','Egyptský faraón'],exp:'Alexander Veľký: macedónsky kráľ, jeden z najväčších dobyvateľov.'},
  {q:'Hammurapiho zákonník je:',a:3,opts:['Grécka filozofia','Egyptská kniha','Rímsky kódex','Jeden z'],exp:'Hammurapiho zákonník — jeden z najstarších zákonníkov sveta.'},
  {q:'Faraón bol:',a:2,opts:['Grécky filozof','Babylonský veliteľ','Vládca Egypta','Rímsky senátor'],exp:'Faraón bol panovník starého Egypta — považovaný za boha na zemi.'},
  {q:'Západ Rímskej ríše padol v roku:',a:1,opts:['0 n.l.','476 n.l.','325 n.l.','1000 n.l.'],exp:'Západ Rímskej ríše padol roku 476 — koniec staroveku.'},
]);
addQ(1,'r','bio',[
  {q:'Bunka sa skladá z:',a:1,opts:['Iba jadra','Membrány,','Iba bielkovín','Minerálov'],exp:'Každá bunka má bunkovú membránu, cytoplazmu a DNA.'},
  {q:'Fotosyntéza premieňa:',a:3,opts:['Kyslík na dusík','Glukózu na svetlo','Minerály','Svetlo, CO₂ a vodu'],exp:'Fotosyntéza: svetlo + CO₂ + voda → glukóza + kyslík.'},
  {q:'DNA v bunke je:',a:0,opts:['Nositeľka','Druh cukru','Typ membrány','Enzým'],exp:'DNA nesie genetickú informáciu.'},
  {q:'Ekosystém tvorí:',a:2,opts:['Iba rastliny','Iba živočíchy','Organizmy a','Iba pôda'],exp:'Ekosystém: živé organizmy + neživé prostredie.'},
  {q:'Srdce v tele:',a:1,opts:['Čistí krv','Pumpuje krv do celého tela','Produkuje hormóny','Reguluje teplotu'],exp:'Srdce pumpuje krv cez celé telo.'},
  {q:'Vírus sa od baktérie líši:',a:0,opts:['Chýbajúcou bunkovou stavbou','Väčšou veľkosťou','Odolnosťou','Rýchlosťou množenia'],exp:'Vírusy nemajú bunkovú stavbu.'},
  {q:'Sacharidy sú:',a:3,opts:['Stavebné látky svalov','Nositele DNA','Katalyzátory','Hlavný zdroj energie (cukry)'],exp:'Sacharidy sú hlavným zdrojom energie.'},
  {q:'Pri fotosyntéze okrem glukózy vzniká:',a:2,opts:['CO₂','Dusík','Kyslík','Vodík'],exp:'Pri fotosyntéze vzniká glukóza a kyslík.'},
]);
addQ(1,'r','che',[
  {q:'Atóm sa skladá z:',a:2,opts:['Molekúl','Iba elektrónov','Protónov,','Kvarkov'],exp:'Atóm: jadro (protóny + neutróny) + elektrónový obal.'},
  {q:'Chemický vzorec vody:',a:0,opts:['H₂O','NaCl','CO₂','O₂'],exp:'Voda je H₂O — 2 atómy vodíka a 1 atóm kyslíka.'},
  {q:'Kyselina má pH:',a:1,opts:['Väčšie ako 7','Menšie ako 7','Presne 7','Rovnaké pre všetky'],exp:'Kyselina odovzdáva H⁺, pH < 7.'},
  {q:'Chemická reakcia vytvára:',a:3,opts:['Tú istú látku','Zmes bez zmeny','Rovnaké atómy','Nové látky s'],exp:'Chemická reakcia mení reaktanty na produkty.'},
  {q:'Protónové číslo určuje:',a:2,opts:['Hmotnosť','Skupenstvo','O aký prvok ide','Počet elektrónov'],exp:'Protónové číslo = počet protónov v jadre.'},
  {q:'Periodická tabuľka zoraďuje:',a:1,opts:['Zlúčeniny','Prvky podľa','Reakcie','Kovy a nekovy'],exp:'Periodická tabuľka zoraďuje prvky podľa rastúceho protónového čísla.'},
  {q:'Symbol Au pochádza z latinčiny:',a:0,opts:['Aurum — zlato','Argentum — striebro','Auris — ucho','Aurora'],exp:'Au = aurum (latinsky zlato). Z = 79.'},
  {q:'Prvok — všetky atómy majú:',a:3,opts:['Rovnaké skupenstvo','Rovnaký počet neutrónov','Rovnakú hmotnosť','Rovnaký počet protónov'],exp:'Prvok: všetky atómy majú rovnaké protónové číslo.'},
]);
addQ(1,'r','fyz',[
  {q:'Rýchlosť sa meria v:',a:3,opts:['Newtonoch','Jouloch','Pascaloch','m/s'],exp:'Rýchlosť v = s/t. Jednotka: m/s.'},
  {q:'Prvý Newtonov zákon:',a:2,opts:['F = ma','Každá akcia má reakciu','Teleso bez sily zotrvá v pokoji','Energia sa zachováva'],exp:'Zákon zotrvačnosti: bez sily teleso zotrvá v pokoji.'},
  {q:'Gravitácia je:',a:0,opts:['Príťažlivá sila','Elektrická sila','Magnetická sila','Sila trenia'],exp:'Gravitácia je príťažlivá sila medzi telesami s hmotnosťou.'},
  {q:'Vzorec F = m × a vyjadruje:',a:1,opts:['Zákon zachovania energie','Druhý Newtonov zákon','Ohmov zákon','Archimédov zákon'],exp:'F = m × a je druhý Newtonov zákon.'},
  {q:'Energia je schopnosť:',a:3,opts:['Merať teplotu','Prenášať náboj','Odolávať silám','Vykonať prácu'],exp:'Energia je schopnosť telesa vykonať prácu.'},
  {q:'Tlak sa definuje ako:',a:0,opts:['F/S (sila/plocha)','F×S','m/V','E/t'],exp:'Tlak p = F/S. Jednotka: Pascal.'},
  {q:'Základná jednotka teploty v SI:',a:1,opts:['°C','Kelvin (K)','°F','Joule'],exp:'V sústave SI je základnou jednotkou teploty Kelvin.'},
  {q:'Jednotka sily je:',a:2,opts:['Watt','Joule','Newton (N)','Pascal'],exp:'Jednotka sily je Newton. 1 N = 1 kg·m/s².'},
]);
addQ(1,'r','ang',[
  {q:'Preložte: Volám sa Jana.',a:1,opts:['I have name Jana.','My name is Jana.','Me name Jana is.','I called Jana am.'],exp:'My name is Jana. = Volám sa Jana.'},
  {q:'She ___ a teacher.',a:2,opts:['Am','Are','Is','Be'],exp:'She is a teacher. Pre he/she/it používame is.'},
  {q:'I go to school every day.',en:'I go to school every day.',a:3,opts:['Idem teraz.','Chodil som.','Pôjdem zajtra.','Chodím každý deň.'],exp:'Present Simple: opakujúci sa zvyk.'},
  {q:'Preložte: Môžeš mi pomôcť?',a:0,opts:['Can you help me, please?','You help me?','Help me please?','Can you help?'],exp:'Can you help me, please? = Môžeš mi pomôcť, prosím?'},
  {q:'She ___ like coffee. Záporný tvar.',a:2,opts:['Not like','Do not like','Does not like','Is not liking'],exp:'She does not like. Pre tretiu osobu: does + not + základný tvar.'},
  {q:'Yesterday I ___ to the cinema.',a:3,opts:['Go','Gone','Going','Went'],exp:'Went je minulý čas od go.'},
  {q:'She has two brothers.',en:'She has two brothers.',a:1,opts:['Mala dvoch bratov.','Má dvoch bratov.','Bude mať.','Mal dvoch.'],exp:'She has two brothers. = Má dvoch bratov.'},
  {q:'Doplň správne. I ___ a student.',a:0,opts:['Am','Is','Are','Be'],exp:'I am a student. Po I vždy am.'},
]);

// VÝZVA 1R
addQ(1,'v','slj',[
  {q:'Denotatívny a konotatívny význam:',a:0,opts:['Denotatívny je vecný, konotatívny citový','Oba sú rovnako objektívne','Konotatívny je vždy neutrálny','Denotatívny je subjektívny'],exp:'Denotatívny: slovníkový vecný. Konotatívny: citový alebo hodnotový odtienok.'},
  {q:'Polysémia je jav kde jedno slovo:',a:1,opts:['Má rovnaké znenie ako iné','Má viac súvisiacich významov','Má protikladný obsah','Má rovnaký pôvod'],exp:'Polysémia: viacvýznamovosť — hlava = časť tela, hlava štátu.'},
  {q:'Univerbizácia je:',a:2,opts:['Tvorenie zloženín','Rozkladanie slova','Skracovanie','Tvorenie skratiek'],exp:'Univerbizácia: minerálna voda → minerálka.'},
  {q:'Výkladový slohový postup dominuje v:',a:3,opts:['Denníku','Opise','Reportáži','Odbornom'],exp:'Výkladový postup: skúma príčiny a dôsledky.'},
  {q:'Individuálny štýl autora závisí od:',a:0,opts:['Osobnosti a skúseností autora','Predpísaných pravidiel','Striktnej normy','Hovorového registra'],exp:'Individuálny štýl: osobitý výber jazykových prostriedkov.'},
  {q:'Europizmy sú frazeologizmy:',a:1,opts:['Z bežnej ľudovej reči','Z antickej mytológie a kultúry','Zo slovenského folklóru','Z odbornej sféry'],exp:'Europizmy: Achillova päta, Pyrrhovo víťazstvo.'},
  {q:'Konspekt sa od osnovy líši:',a:2,opts:['Konspekt je kratší','Sú totožné','Konspekt zachováva štruktúru,','Osnova zachováva štruktúru'],exp:'Konspekt: podrobnejší, zachováva štruktúru. Osnova: stručná, len v bodoch.'},
  {q:'Interferencia jazyka je:',a:3,opts:['Zámerné preberanie cudzích slov','Historická zmena jazyka','Kodifikácia pravidiel','Prenos vzorov z jedného jazyka do'],exp:'Interferencia: prenos jazykových vzorov.'},
]);
addQ(1,'v','mat',[
  {q:'Funkcia priradí každému x:',a:2,opts:['Vždy kladnú hodnotu','Niekoľko hodnôt y','Práve jednu hodnotu y','Iba celé číslo'],exp:'Funkcia: každému x práve jedna y.'},
  {q:'Prvočíslo je deliteľné:',a:3,opts:['Dvomi a tromi','Tromi rôznymi číslami','Každým číslom','Iba jedničkou a sebou samým'],exp:'Prvočíslo: deliteľné iba 1 a sebou samým. 2, 3, 5, 7, 11...'},
  {q:'Kvadratická funkcia y=ax² má tvar:',a:0,opts:['Paraboly s vrcholom','Priamky','Hyperboly','Kružnice'],exp:'Kvadratická funkcia: parabola. a určuje smer otvorenia.'},
  {q:'Pytagorova veta platí v:',a:1,opts:['Každom trojuholníku','Pravouhlom (a²+b²=c²)','Rovnoramennom','Rovnostrannom'],exp:'Pytagorova veta: a² + b² = c², kde c je prepona.'},
  {q:'Sinus uhla je pomer:',a:2,opts:['Priľahlej odvesny k prepone','Odvesien navzájom','Protiľahlej odvesny k prepone','Prepony k odvesne'],exp:'sin α = protiľahlá odvesna / prepona.'},
  {q:'Aritmetická postupnosť — n-tý člen:',a:3,opts:['a₁ × q^(n-1)','a₁ / (n-1)','a₁ - (n-1)d','a₁ + (n-1)d'],exp:'Aritmetická: aₙ = a₁ + (n-1)d.'},
  {q:'Absolútna hodnota |x| je:',a:1,opts:['Druhá mocnina','Vzdialenosť čísla od nuly','Záporná časť','Celá časť'],exp:'|x|: vzdialenosť od nuly. Vždy nezáporná: |−5|=5.'},
  {q:'Dôkaz sporom predpokladá:',a:0,opts:['Opak tvrdenia a hľadá spor','Grafické znázornenie','Priame overenie','Špeciálny prípad'],exp:'Reductio ad absurdum: predpokladáme ¬P → odvodíme spor → P je pravdivé.'},
]);
addQ(1,'v','fyz',[
  {q:'Elektrický prúd je:',a:2,opts:['Pohyb protónov','Tepelné kmitanie atómov','Usporiadaný pohyb voľných','Pohyb fotónov'],exp:'Elektrický prúd: usporiadaný pohyb voľných elektrónov vplyvom napätia.'},
  {q:'Ohmov zákon I=U/R platí pre:',a:0,opts:['Ohmikovské materiály','Absolútne vždy','Iba striedavý prúd','R je vždy konštantné'],exp:'Ohmikovský vodič: R=konšt. Graf I(U): priamka.'},
  {q:'Difrakcia je jav kde:',a:3,opts:['Svetlo sa odráža','Svetlo sa rozkladá','Svetlo sa láme','Vlna sa ohýba za prekážkou'],exp:'Difrakcia: vlna obchádza prekážku. Youngov pokus.'},
  {q:'Rezonancia nastáva keď:',a:1,opts:['Vlny sa tlmia','Vzbudzovacia = vlastná','Sústava prestane kmitať','Frekvencia klesá'],exp:'Rezonancia: f_vzbudz = f_vlastná → rastúca amplitúda.'},
  {q:'Elektromagnetická indukcia vzniká:',a:2,opts:['Statickým poľom','Zahrievaním vodiča','Zmenou magnetického toku v obvode','Pohybom náboja vo vákuu'],exp:'Faradayov zákon: zmena magnetického toku → indukovaná EMF.'},
  {q:'Fotoelektrický jav závisí od:',a:0,opts:['Frekvencie fotónu (E=hf)','Intenzity svetla','Teploty kovu','Vzdialenosti'],exp:'Einstein (1905): E=hf. Pod prahovou frekvenciou žiadne elektróny.'},
  {q:'Laser produkuje:',a:3,opts:['Bežné svetlo','Tepelné žiarenie','Biele a rozptýlené','Koherentné a'],exp:'Laser: stimulovaná emisia → koherentné, monochromatické svetlo.'},
  {q:'Obloha je modrá lebo:',a:1,opts:['Atmosféra absorbuje červenú','Kratšie vlny sa viac rozptyľujú','Kyslík fluoreskuje','Voda odráža modré'],exp:'Rayleighov rozptyl: I∝1/λ⁴. Modrá ~5,5× viac ako červená.'},
]);

// MASTER 1R
addQ(1,'m','slj',[
  {q:'Wittgenstein: hranice jazyka sú:',a:2,opts:['Iba gramatické normy','Nezávislé od myslenia','Hranicami nášho sveta','Vždy kultúrne podmienené'],exp:'Wittgenstein (Tractatus): "Hranice môjho jazyka sú hranice môjho sveta."'},
  {q:'Framing v médiách určuje:',a:0,opts:['Ako ľudia interpretujú udalosti','Iba frekvenciu správ','Iba rozsah spravodajstva','Gramatiku titulkov'],exp:'Lakoff: konceptuálne rámce predurčujú interpretáciu.'},
  {q:'Kodifikácia jazyka odráža:',a:3,opts:['Iba vedecké výskumy','Iba historický vývoj','Iba gramatické pravidlá','Mocenské a kultúrne záujmy doby'],exp:'Kodifikácia nie je neutrálna — odráža mocenské záujmy.'},
  {q:'Konštrukcionizmus tvrdí, že realita:',a:1,opts:['Existuje nezávisle od jazyka','Je konštruovaná jazykom a diskurzom','Je vždy objektívne poznateľná','Je iba súčtom faktov'],exp:'Berger & Luckmann: sociálna realita je konštruovaná.'},
  {q:'Heteroglosia (Bachtin):',a:2,opts:['Jazyk je homogénny','Je iba gramatický systém','Jazyk je plný rôznych','Je neutrálny nástroj'],exp:'Bachtin: každé slovo je "poloplné" hlasov iných.'},
  {q:'Akademické písanie je inštitucionálny diskurz lebo:',a:3,opts:['Používa dlhé vety','Je dostupné každému','Nemá pravidlá','Určuje kto má hlas a čo je veda'],exp:'Foucault: vedecký diskurz = produkcia "pravdy" inštitúciami.'},
  {q:'Sapir-Whorfova hypotéza — slabá verzia:',a:0,opts:['Jazyk ovplyvňuje niektoré','Jazyk úplne určuje myslenie','Jazyk nemá vplyv na kogníciu','Myslenie je nezávislé'],exp:'Slabá verzia potvrdená: Boroditsky — farby, priestorová orientácia.'},
  {q:'Performatívna výpoveď (Austin):',a:1,opts:['Iba opisná funkcia','Vykonáva čin samotným','Iba gramatická funkcia','Iba rétorický efekt'],exp:'Austin: "Sľubujem" nie opisuje sľub — je to sám sľub.'},
]);
addQ(1,'m','fyz',[
  {q:'Many-worlds interpretácia (Everett 1957):',a:0,opts:['Pri meraní sa vesmír','Vlnová funkcia kolabuje','Meranie nemá žiadny efekt','Pozorovateľ volí výsledok'],exp:'Everett: žiadny kolaps. Kodaňská: kolaps vlnovej funkcie.'},
  {q:'Temná hmota tvorí asi:',a:2,opts:['Päť percent vesmíru','Dve percentá','Dvadsaťsedem percent vesmíru','Šesťdesiatosem percent'],exp:'27% temná hmota. 68% temná energia. 5% bežná hmota.'},
  {q:'Princíp najmenšej akcie S=∫Ldt:',a:3,opts:['Iba klasická mechanika','Iba kvantová mechanika','Iba špeciálna relativita','Klasika, relativita aj'],exp:'L=T-V. Feynman: v QM sčítame všetky trajektórie.'},
  {q:'QED predikuje anomálny magnetický moment na:',a:1,opts:['Dve desatinné miesta','Dvanásť desatinných miest','Päť desatinných miest','Osem desatinných miest'],exp:'QED (Feynman, Nobel 1965): najpresnejšia predpoveď fyziky.'},
  {q:'Reťazcová teória je kontroverzná lebo:',a:0,opts:['Nemá testovateľné predpovede','Protirečí si vo výpočtoch','Odporuje špeciálnej relativite','Ignoruje kvantovú mechaniku'],exp:'Smolin: stagnácia fyziky. 10⁵⁰⁰ riešení (landscape). Empiricky prázdna.'},
  {q:'Entropia a šipka času:',a:2,opts:['Sú synonymné pojmy','Oba sú iba ľudské koncepty','Entropia rastie','Entropia klesá s časom'],exp:'Boltzmann: S=k ln W. Penrose: nízka entropia VT → šipka.'},
  {q:'CP porušenie je záhadné lebo:',a:3,opts:['Nebolo nikdy pozorované','Je iba v teoretickej fyzike','Je príliš silné','Je príliš slabé na vysvetlenie'],exp:'Cronin & Fitch (1964). LHCb: B-mezóny. Sakharovove podmienky.'},
  {q:'LIGO detekuje gravitačné vlny cez:',a:1,opts:['Rádioteleskop vo vesmíre','Michelsonov interferometer','Chemické senzory v pôde','Tepelné detektory'],exp:'LIGO (2015): GW150914. Citlivosť 10⁻²¹m. Nobel 2017.'},
]);



// ── 1R VÝZVA — chýbajúce predmety ──
addQ(1,'v','lit',[
  {q:'Sonet je lyrická básnická forma s:',a:0,opts:['14 veršmi (2 kvartetá + 2 tercetá)','8 veršmi v dvoch strofách','16 veršmi v štyroch strofách','12 veršmi s refrénom'],exp:'Sonet: 14 veršov. Petrarcovský: 4+4+3+3. Shakespearovský: 4+4+4+2 (záverečný distichon).'},
  {q:'Katarzia v tragédii podľa Aristotela je:',a:1,opts:['Trest pre hrdinu','Emocionálne očistenie','Morálne ponaučenie','Víťazstvo dobra nad zlom'],exp:'Aristotelova Poetika: tragédia cez eleos (súcit) a phobos (strach) spôsobuje katharsis — očistenie emócií.'},
  {q:'Rozprávač v prvej osobe je:',a:2,opts:['Vševedúci rozprávač mimo príbehu','Rozprávač komentujúci z budúcnosti','Postava priamo zapojená do deja (ich-forma)','Neprítomný rozprávač'],exp:'Ich-forma (1. osoba): "Ja" rozprávač je súčasťou deja. Er-forma (3. osoba): vševediaci alebo obmedzený.'},
  {q:'Epos je rozsiahla epická báseň o:',a:3,opts:['Lyrickej nálade prírody','Milostnom cítení hrdinu','Každodennom živote prostých ľudí','Hrdinských činoch s nadprirodzenými'],exp:'Epos: hrdinská epika — Ilias, Odysea, Aeneis. Múza, in medias res, rozsiahle prirovnania, epiteton ornans.'},
  {q:'Dráma sa od eposu líši:',a:1,opts:['Väčším rozsahom textu','Prednostným použitím','Absenciou konfliktu','Lyrickými prvkami'],exp:'Dráma: určená na inscenáciu. Dialóg, monológ, scénické poznámky. Aristotelova jednota miesta, času a deja.'},
  {q:'Symbol v literatúre je:',a:0,opts:['Obraz s prenesením,','Priame pomenovanie veci','Zámerné zveličenie','Opakovanie hlások'],exp:'Symbol: konkrétny obraz nesie abstraktný zmysel. Biela veľryba = zlo/nepoznateľno. Otvorený, na rozdiel od alegórie.'},
  {q:'Novela sa od poviedky odlišuje:',a:2,opts:['Kratším rozsahom','Absenciou zápletky','Ostrejšou pointou a','Väčším počtom postáv'],exp:'Novela (Boccaccio): jeden príbeh, ostrá pointa, zvrat (Falkentheorie — Heyse). Poviedka: voľnejšia stavba.'},
  {q:'Lyrický subjekt je:',a:3,opts:['Vždy totožný s autorom básne','Historická postava v básni','Fiktívny rozprávač prózy','Básnické ja'],exp:'Lyrický subjekt ≠ autor. Je to básnická maska, hlas básne. Autor môže písať o pocitoch postáv, nie svojich.'},
]);

addQ(1,'v','dej',[
  {q:'Stredovek sa datuje od:',a:0,opts:['Pádu Západorímskej ríše (476) po pád','Narodenia Krista po Karola Veľkého','Karolíngskej ríše po reformáciu','Pádu Ríma po Kolumba (1492)'],exp:'Stredovek: 476 (pád ZRR) – 1453 (pád Konštantínopolu) alebo 1492 (objavenie Ameriky).'},
  {q:'Feudálna hierarchia pozostávala z:',a:1,opts:['Kráľ – cirkev – mešťania – roľníci','Kráľ – šľachta – rytieri – poddaní (a cirkev)','Cisár – kráľ – baron – rytier – slobodník','Pápež – cisár – kráľ – ľud'],exp:'Feudalizmus: kráľ udeľuje léna šľachte za vojenskú službu → šľachta rytierom → rytieri poddaným.'},
  {q:'Križiacke výpravy (1095–1291) mali za cieľ:',a:2,opts:['Obchodné cesty do Ázie','Šírenie islamu do Európy','Dobytie Svätej zeme z rúk moslimov','Zjednotenie Európy pod pápežom'],exp:'1. výprava 1096: pápež Urban II. Dobytie Jeruzalema 1099. Celkovo 7 výprav. Obchodný vedľajší efekt.'},
  {q:'Čierna smrť (1347–1351) v Európe:',a:3,opts:['Postihla len mestá','Nemala dlhodobé dôsledky','Spôsobila hlavne hladomor','Zahubila 1/3 až 1/2'],exp:'Mor (Yersinia pestis): z Ázie cez Krym. ~25 mil. mŕtvych v Európe. Sociálne, ekonomické a náboženské dôsledky.'},
  {q:'Magna Carta (1215) je dôležitá lebo:',a:1,opts:['Zrušila feudalizmus','Obmedzila moc kráľa zákonom','Zjednotila Anglicko a Škótsko','Umožnila vznik parlamentu priamo'],exp:'Magna Carta: kráľ Ján podpísal pod tlakom šľachty. "Habeas corpus" — základ ochrany pred svojvôľou.'},
  {q:'Karolis Magnus (Karol Veľký) bol korunovaný za cisára v roku:',a:0,opts:['800 n.l. pápežom Levom III. v Ríme','768 n.l. franckými šľachticmi','814 n.l. pred smrťou','776 n.l. vo Viedni'],exp:'Karol Veľký: 800 n.l. korunovaný pápežom v Ríme. Karolínska renesancia, jednotná ríša, šírenie kresťanstva.'},
  {q:'Schizma (1054) rozdelila kresťanstvo na:',a:2,opts:['Katolíkov a protestantov','Ortodoxných a protestantov','Rímskokatolícku a pravoslávnu cirkev','Katolicizmus a anglikanizmus'],exp:'Veľká schizma 1054: Rím (pápež) vs. Konštantínopol (patriarcha). Filioque, jurisdikcia, liturgický jazyk.'},
  {q:'Renesancia sa líši od stredoveku tým, že:',a:3,opts:['Odmieta vzdelanie','Vracia sa k náboženstvu','Ignoruje antiku','Kladie človeka do centra'],exp:'Renesancia: anthropocentrizmus vs. stredoveký teocentrizmus. Návrat k antickej filozofii, umeniu, literatúre.'},
]);

addQ(1,'v','bio',[
  {q:'Prokaryotické bunky sa od eukaryotických líšia:',a:0,opts:['Absenciou membrány','Väčšou veľkosťou','Prítomnosťou mitochondrií','Schopnosťou fotosyntézy'],exp:'Prokaryoty (baktérie, archea): bez jadra, bez membránových organel. Eukaryoty: jadro, mitochondrie, ER.'},
  {q:'Bunková membrána je tvorená:',a:1,opts:['Iba bielkovinami','Fosfolipidovou dvojvrstvou s','Iba sacharidmi','Cholesterolom a bielkovinami'],exp:'Fluidná mozaiková štruktúra (Singer, Nicolson 1972): fosfolipidová dvojvrstva + integrálne a periférne proteíny.'},
  {q:'Ribocom je miestom:',a:2,opts:['Syntézy DNA','Skladovania energie','Syntézy bielkovín (translácia)','Rozkladu lipidov'],exp:'Ribozómy: malá (30S/40S) + veľká (50S/60S) podjednotka. mRNA čítaná v smere 5&#39;→3&#39;, tvorba peptidovej väzby.'},
  {q:'Nervová bunka (neurón) sa skladá z:',a:3,opts:['Jadra a bunkovej membrány','Axónu a dendritov iba','Mitochondrií a ribozómov','Tela bunky, dendritov'],exp:'Neurón: soma (telo), dendrity (príjem), axón (prenos). Myelínová pošva urýchľuje vedenie vzruchu.'},
  {q:'Potravový reťazec začína vždy:',a:1,opts:['Konzumentmi','Producentmi','Rozkladačmi','Všežravcami'],exp:'Producenti (fotoautotrofy) fixujú slnečnú energiu. → Primárni konzumenti → Sekundárni → Terciárni → Rozkladači.'},
  {q:'Hormóny sú chemické posly, ktoré:',a:0,opts:['Sú vylučované žľazami s vnútornou','Prenášajú nervové vzruchy','Katalyzujú chemické reakcie v bunkách','Tvoria stavbu bunkovej steny'],exp:'Hormóny: endokrinné žľazy (štítna, nadobličky, pankreas). Krv ich transportuje k cieľovým bunkám.'},
  {q:'Mutácia je:',a:2,opts:['Vždy škodlivá zmena DNA','Zámerná zmena DNA pri evolúcii','Zmena v poradí nukleotidov DNA','Zmena proteínovej štruktúry bez zmeny DNA'],exp:'Mutácie: bodové (substitúcia), inzercie, delécie. Väčšina neutrálna, niektoré škodlivé, zriedka prospešné.'},
  {q:'Čo je evolučná adaptácia?',a:3,opts:['Zámerná zmena správania jedinca','Učenie sa nových schopností','Fyzická tréningom získaná vlastnosť','Dedičná vlastnosť zvyšujúca prežitie a'],exp:'Adaptácia: vzniká prirodzeným výberom počas generácií. Lamarckova "získaná vlastnosť" sa nededí.'},
]);

addQ(1,'v','che',[
  {q:'Izotopy sú atómy toho istého prvku s:',a:0,opts:['Rovnaký počet protónov, rôzny počet neutrónov','Rôznym počtom protónov','Rovnakými chemickými vlastnosťami — vždy identické','Rôznym počtom elektrónov'],exp:'Izotopy: rovnaké Z (protóny), rôzne N (neutróny) → rôzna hmotnostné číslo A. ¹²C a ¹⁴C — izotopy uhlíka.'},
  {q:'Elektrónegativita určuje:',a:1,opts:['Počet valenčných elektrónov','Schopnosť atómu priťahovať','Počet oxidačných stavov prvku','Reaktivitu kovu'],exp:'Elektrónegativita (Pauling): F najvyššia (4,0), Cs najnižšia. Rozdiel > 1,7 → iónová väzba, < 1,7 → kovalentná.'},
  {q:'Chelatácia v komplexných zlúčeninách znamená:',a:2,opts:['Zrážanie iónov z roztoku','Oxidácia centrálneho atómu','Polydentátny ligand tvorí viac','Náhrada jedného ligantu iným'],exp:'Chelát: ligand s viacerými donorovými atómami (EDTA má 6). Tvorí stabilné krúžky s centrálnym kovom.'},
  {q:'Ako sa zmení rýchlosť reakcie pri zvýšení teploty o 10°C?',a:3,opts:['Zostane rovnaká','Klesne na polovicu','Zvýši sa o 10%','Približne sa'],exp:'Van&#39;t Hoffovo pravidlo: každých 10°C zdvojnásobí rýchlosť reakcie (Q₁₀ = 2). Enzýmy: optimálna teplota ~37°C.'},
  {q:'Titrimetria (titrácia) je metóda na:',a:1,opts:['Meranie hmotnosti látok','Stanovenie koncentrácie pomocou','Meranie teploty pri reakcii','Izoláciu čistých látok'],exp:'Titrácia: pridávame titrант (známa konc.) k analytu až do ekvivalenčného bodu. Indikátor zmení farbu.'},
  {q:'Čo je destilačná frakcionácia?',a:0,opts:['Separácia zmesi kvapalín s rôznymi bodmi','Kryštalizácia zo zmesi','Filtrácia tuhých látok','Extrakcia organickými rozpúšťadlami'],exp:'Frakcionácia: kolóna s platničkami. Ropné spracovanie: benzín (~70°C), petrolej (~150°C), motorová nafta (~250°C).'},
  {q:'Halogény (skupina VIIA) sú reaktívne lebo:',a:2,opts:['Majú plný valenčný orbitál','Sú to kovy','Majú 7 valenčných elektrónov','Sú stabilné plyny'],exp:'Halogény: 7 val. elektrónov → silné oxidačné činidlá. F₂ > Cl₂ > Br₂ > I₂ (klesajúca reaktivita).'},
  {q:'Nukleofil je častica, ktorá:',a:3,opts:['Prijíma elektrónový pár','Je vždy záporný ión','Reaguje iba s kyselinami','Donuje elektrónový pár'],exp:'Nukleofil: donuje e⁻ pár, napáda elektrofil. OH⁻, CN⁻, NH₃, H₂O. Elektrofil: prijíma e⁻ pár, napr. H⁺, BF₃.'},
]);

addQ(1,'v','ang',[
  {q:'Choose the correct form: "Neither of the students ___ ready."',a:0,opts:['was','were','are','have been'],exp:'Neither/Either + of + plural noun → singular verb (formally). "Neither of the students was ready."'},
  {q:'Preložte: Keby som bol bohatší, kúpil by som auto.',a:1,opts:['"If I am richer, I buy a car."','"If I were richer, I would buy a car."','"If I was rich, I will buy a car."','"If I would be rich, I bought a car."'],exp:'2nd conditional: If + past simple (were), would + infinitive. Nereálna/hypotetická podmienka v prítomnosti.'},
  {q:'"I haven&#39;t seen him ___ last Monday."',a:2,opts:['for','during','since','from'],exp:'Since + konkrétny bod v čase (last Monday, 2020, January). For + časové obdobie (for 3 days, for a week).'},
  {q:'The phrasal verb "look up to" means:',a:3,opts:['to search in a dictionary','to look at something high','to visit someone','to admire and respect someone'],exp:'Look up to = obdivovať, rešpektovať. Look up = vyhľadať (v slovníku). Look down on = pohŕdať.'},
  {q:'"The documents need ___." Which is correct?',a:1,opts:['"to sign"','"signing" or "to be signed"','"signed"','"to be signing"'],exp:'Need + gerund (active meaning): "The documents need signing" = Some needs signing them. Need + to be + PP: passive.'},
  {q:'Which word is a false friend (falošný priateľ)?',a:0,opts:['"eventually" ≠ eventuálne','actually','probably','recently'],exp:'Eventually = nakoniec (eventually it worked). Nie "eventuálne" (= possibly). False friends: embarrassed ≠ embarazovaný.'},
  {q:'"She is used to ___ early every morning."',a:2,opts:['wake','woke','waking','have woken'],exp:'Be used to + gerund: zvyknutý na niečo (prítomnosť). Used to + infinitive: zvykol robiť (minulosť).'},
  {q:'The word "ubiquitous" means:',a:3,opts:['rare and unusual','large and powerful','fast and efficient','present everywhere'],exp:'Ubiquitous: všadeprítomný. "Smartphones are ubiquitous in modern society." Synonymá: omnipresent, pervasive.'},
]);

// ── 1R MASTER — chýbajúce predmety ──
addQ(1,'m','lit',[
  {q:'Dekkonštrukcia (Derrida) tvrdí, že texty:',a:0,opts:['Nesú v sebe vlastné protirečenia a','Majú jeden jasný a správny výklad','Sú úplne určené zámerom autora','Nemožno analyzovať bez kontextu'],exp:'Derrida: différance — zmysel je vždy odkladaný a rozlišovaný. Logocentrizmus sa rozpadá. Texty sú nestabilné.'},
  {q:'Mimézis v Aristotelovi znamená:',a:1,opts:['Kopírovanie reality fotograficky','Napodobenie reality umením','Odmietnutie reality v umení','Alegorizácia skutočnosti'],exp:'Aristoteles: mimézis = umelecké napodobenie. Nie kópia, ale selektívna rekonštrukcia reality s cieľom katharsis.'},
  {q:'Čo je polyfónia v Bachtinových románoch?',a:2,opts:['Striedanie lyriky a epiky','Viaceré rozprávačské hlasy','Súčasné rovnocenné hlasy postáv','Štruktúra románu v kapitolách'],exp:'Bachtin: polyfónny román (Dostojevskij) — postavy majú vlastný hlas, nie sú len nástrojom autora.'},
  {q:'Pojem "willing suspension of disbelief" (Coleridge):',a:3,opts:['Odmietnutie fantastickej literatúry','Kritické čítanie bez emócií','Analýza literárnych konvencií','Čitateľovo dočasné prijatie fiktívneho'],exp:'Coleridge: čitateľ vedome "suspenduje" nedôveru aby si mohol vychutnať fikciu. Základ literárnej recepcie.'},
  {q:'Čo odlišuje tragédiu od drámy (v širšom zmysle)?',a:1,opts:['Tragédia je dlhšia','Tragédia zobrazuje pád','Tragédia sa hrá len v antike','Tragédia nemá katharsis'],exp:'Tragédia: hamartia (chyba hrdinu) + hybris (pýcha) → peripetia (zvrat) → katastrofa + katharsis. Komédia: šťastný koniec.'},
  {q:'Implikovaný čitateľ (Iser) je:',a:0,opts:['Ideálny čitateľ','Skutočný čitateľ knihy','Historický čitateľ doby','Kritik literárneho textu'],exp:'Iser: text obsahuje "miesta neurčitosti" ktoré čitateľ dopĺňa. Implikovaný čitateľ = rola zabudovaná do textu.'},
  {q:'Romantická irónia (Schlegel) je:',a:2,opts:['Sarkazmus a výsmech','Dramatická irónia v tragédii','Vedomie autora o fiktívnosti','Neschopnosť dosiahnuť ideál'],exp:'Friedrich Schlegel: romantická ironia — autor vstupuje do textu, ruší ilúziu, komentuje vlastné písanie.'},
  {q:'Čo je ekfráza?',a:3,opts:['Lyrický opis prírody','Dramatický monológ','Epické prirovnanie','Verbálny opis'],exp:'Ekfráza: Keatsova óda na grécku urnu, Audenov Musée des Beaux Arts. Text opisuje obraz/sochu.'},
]);

addQ(1,'m','mat',[
  {q:'Cantorova teória množín ukázala, že:',a:0,opts:['Existujú rôzne veľkosti nekonečna (|ℕ| < |ℝ|)','Všetky nekonečná sú rovnako veľké','Nekonečno neexistuje v matematike','Reálne čísla sú spočítateľné'],exp:'Cantor: |ℕ| = ℵ₀ (spočítateľné). |ℝ| = 2^ℵ₀ > ℵ₀. Diagonálny argument: ℝ je nespočítateľné.'},
  {q:'Číslo π je:',a:1,opts:['Racionálne číslo','Transcendentné číslo','Algebraické iracionálne','Komplexné číslo'],exp:'π je transcendentné (Lindemann 1882): nie je koreňom polynómu. √2 je algebraické iracionálne (koreň x²-2=0).'},
  {q:'Eulerova identita e^(iπ) + 1 = 0 spája:',a:2,opts:['Dve matematické konštanty','Štyri základné operácie','Päť najdôležitejších čísel','Komplexné čísla a geometriu'],exp:'Eulerova identita: e (základ prír. log.), i (imaginárna jednotka), π, 1, 0. Richard Feynman: "najkrajší vzorec".'},
  {q:'Neúplné indukčné dokazovanie je:',a:3,opts:['Platný dôkaz pre konečné množiny','Vždy správna metóda','Štatistická metóda','Fallacia'],exp:'Indukcia (logická, nie mat.): z pozorovania prípadov → všeobecný záver. Problém indukcie (Hume): nie je logicky záväzná.'},
  {q:'Axioma výberu (ZF+C) je kontroverzná lebo:',a:1,opts:['Je zrejmá a triviálna','Umožňuje paradoxné','Je nepravdivá','Protirečí iným axiómam'],exp:'Banach-Tarski: pomocou AV možno "rozložiť" guľu na 5 kusov a poskladať dve gule rovnakej veľkosti. Matematicky správne.'},
  {q:'Teória grafov — mostový problém v Königsbergu (Euler):',a:0,opts:['Euler dokázal, že trasu cez všetky','Euler našiel riešenie trasou','Problém zostal nevyriešený','Riešenie závisí od počtu mostov'],exp:'Euler 1736: Königsberg má 4 vrcholy s nepárnym stupňom → Eulerova cesta neexistuje. Základ teórie grafov.'},
  {q:'Čo je Dirichletov princíp (princíp holubníka)?',a:2,opts:['Diferenciálna rovnica fyziky','Teória čísel o prvočíslach','Ak n+1 predmetov dáme do n','Pravdepodobnostná nerovnosť'],exp:'Holubníkový princíp: 13 ľudí → aspoň 2 majú narodeniny v rovnakom mesiaci. Jednoduché, mocné.'},
  {q:'Noneuklidovská geometria (Lobačevskij, Riemann) ukázala:',a:3,opts:['Euklidova geometria je nesprávna','Rovnobežky sa vždy pretínajú','Trojuholník má vždy 180°','Euklidove axiómy nie sú jediné možné'],exp:'Lobačevskij (hyperbolická), Riemann (sférická): viac ako jedna rovnobežka / žiadna. Einstein: zakrivený priestoro-čas.'},
]);

addQ(1,'m','dej',[
  {q:'Historiografia sa líši od histórie tým, že:',a:0,opts:['Skúma ako sa história píše a interpretuje','Je to populárna história pre laikov','Zahŕňa len staroveké dejiny','Je to ústna tradícia'],exp:'Historiografia: Hayden White — história je naratív, nie len fakty. Herodotus vs. Thukydides: rôzne prístupy.'},
  {q:'Annales škola (Braudel) revolučne zmenila históriu tým, že:',a:1,opts:['Odmietla ekonomickú históriu','Zaviedla dlhé trvanie (longue durée)','Sústredila sa výlučne na politické dejiny','Odmietla archívny výskum'],exp:'Braudel: longue durée — geografia, klíma, štruktúry. Stredné trvanie — konjunktúry. Krátke — udalosti (éphémère).'},
  {q:'Kolonializmus sa od imperializmu odlišuje:',a:2,opts:['Sú to totožné pojmy','Imperializmus je miernejší','Kolonializmus zahŕňa fyzické osídlenie a správu;','Imperializmus predchádza kolonializmu vždy'],exp:'Kolonializmus: fyzická kontrola a osídlenie. Imperializmus (Lenin): ekonomická dominancia aj bez priamej správy.'},
  {q:'Marxistická historiografia interpretuje dejiny cez:',a:3,opts:['Náboženské konflikty','Veľké osobnosti a ich rozhodnutia','Geografické a klimatické podmienky','Triedny boj a ekonomické základne'],exp:'Marx: základňa (výrobné sily, vzťahy) určuje nadstavbu (právo, politika, kultúra). Dejiny = boj tried.'},
  {q:'Orálna história sa venuje:',a:1,opts:['Antickým ústnym eposom','Skúsenostiam marginalizovaných skupín','Výlučne dejinám rozhlasu','Folklóru a rozprávkam'],exp:'Oral history: rozhovory s pamätníkmi. Alessandro Portelli. Hlasy žien, robotníkov, menšín — mimo archívov.'},
  {q:'Konceptualizácia času v histórii — chronológia vs. periodizácia:',a:0,opts:['Chronológia = poriadok udalostí, periodizácia = delenie do','Sú totožné pojmy','Periodizácia je objektívna, chronológia subjektívna','Chronológia je dôležitejšia'],exp:'Periodizácia (stredovek, novovek) je interpretačná konštrukcia — kto, kde a ako delí dejiny, odráža hodnoty.'},
  {q:'Sociálne dejiny vs. dejiny "zhora":',a:2,opts:['Sú totožné','Sociálne dejiny sú menej vedecké','Sociálne dejiny skúmajú','Dejiny "zhora" sú modernejšie'],exp:'E.P. Thompson: "The Making of the English Working Class" — základ dejín zdola. Bloch, Febvre: Annales.'},
  {q:'Pamäť vs. história (Nora — lieux de mémoire):',a:3,opts:['Pamäť a história sú to isté','História je spoľahlivejšia ako pamäť vždy','Pamäť je len subjektívna a nemá miesto v histórii','Lieux de mémoire'],exp:'Pierre Nora: kde pamäť zmizne, tam vznikajú "lieux de mémoire". Pamäť je živá, história je rekonštrukcia.'},
]);

addQ(1,'m','bio',[
  {q:'Proteomika sa líši od genomiky tým, že:',a:0,opts:['Skúma proteíny bunky (funkčný','Je staršia vedná disciplína','Skúma RNA namiesto DNA','Je menej komplexná'],exp:'Genóm: statický. Proteóm: dynamický — závisí od bunky, tkaniva, podmienok. Jeden genóm → tisíce proteínov.'},
  {q:'Sieťová biológia (systems biology) skúma:',a:1,opts:['Nervovú sústavu výhradne','Komplexné interakcie génov,','Iba metabolické dráhy','Evolúciu na molekulárnej úrovni'],exp:'Systems biology: emergentné vlastnosti systému (nie suma súčastí). Interaktóm, regulačné siete, feedback looops.'},
  {q:'Horizontálny prenos génov je:',a:2,opts:['Dedičnosť z rodiča na potomka','Mutácia v zárodočnej línii','Prenos génov medzi nesúvisiacimi','Sexuálna rekombinácia'],exp:'HGT: baktérie si vymieňajú plazmidy (rezistencia na antibiotiká). Evolučný "skrat" — nie len vertikálna dedičnosť.'},
  {q:'Alosterická regulácia enzýmu znamená:',a:3,opts:['Zmenu pH prostredia','Kovalentnú modifikáciu aktívneho miesta','Zvýšenie koncentrácie substrátu','Väzbu regulačnej molekuly na alosterické'],exp:'Alostéria: regulátor sa neviaže na aktívne miesto. Zmení tvar → aktivácia alebo inhibícia. Kľúč v regulácii metabolizmu.'},
  {q:'Exosómy a extracelulárne vezikuly sú dôležité lebo:',a:1,opts:['Sú odpady bunky','Prenášajú signálne molekuly (RNA, proteíny)','Sú súčasťou imunitného systému výhradne','Katalyzujú extracelulárne reakcie'],exp:'Exosómy (30-150 nm): nesú miRNA, mRNA, proteíny. Bunka-bunka komunikácia. Biomarkery rakoviny, terapeutický potenciál.'},
  {q:'Quorum sensing u baktérií je:',a:0,opts:['Mechanizmus, ktorým baktérie vnímajú hustotu','Schopnosť pohybu k živinám','Tvorba spór pri nepriaznivých podmienkach','Odolnosť voči antibiotikám'],exp:'Quorum sensing: N-acyl homoserinové laktóny (signálne mol.). Pri dostatočnej hustote → biofilm, virulencia, bioluminiscencia.'},
  {q:'Mitoptóza (mitochondriálna apoptóza) prebieha cez:',a:2,opts:['Telomerázu a p53','Kaspázy priamo bez mitochondrií','Uvoľnenie cytochrómu c z','TNF receptor a kaspázu-8'],exp:'Intrinsická dráha: DNA poškodenie → p53 → Bax/Bak → cytochróm c → apoptóm → kaspáza-9 → kaspáza-3 → apoptóza.'},
  {q:'Čo je fénotypová plasticita?',a:3,opts:['Mutácia produkujúca rôzne fenotypy','Epigenetická zmena DNA','Evolučná adaptácia za desiatky generácií','Schopnosť jedného genotypu produkovať rôzne'],exp:'Fenotypová plasticita: ten istý genotýp → rôzne fenotypy. Rastlina v tieni vs. slnku. Norma reakcie.'},
]);

addQ(1,'m','che',[
  {q:'Kvantová chémia — Schrödingerova rovnica pre atóm vodíka:',a:0,opts:['Dáva presné orbitály a','Nedá sa riešiť analyticky','Ignoruje spin elektrónu','Platí len pre väčšie atómy'],exp:'Vodík (1 elektrón): analyticky riešiteľný. Polyélektróny (He+): perturbačné metódy, variačný princíp, DFT.'},
  {q:'Marcus teória opisuje:',a:1,opts:['Kinetiku enzymatických reakcií','Rýchlosť prenosu elektrónov medzi molekulami','Termodynamiku fázových prechodov','Mechanizmus radikálových reakcií'],exp:'Marcus (Nobel 1992): rýchlosť ET závisí od reorganizačnej energie λ a hnacou silou ΔG°. Fotosyntéza, korózia, batérie.'},
  {q:'Dendrimer je:',a:2,opts:['Prírodný polysacharid','Lineárny polymer','Vysoko rozvetvená','Cyklický peptid'],exp:'Dendrimer: stromy-podobná štruktúra, každá "generácia" (G) pridáva vetvy. Monodisperzný. Drug delivery, katalýza.'},
  {q:'Hückelova MO teória predpovedá aromaticitu cez:',a:3,opts:['Počet σ väzieb v kruhu','Elektrónegativity atómov','Teplotné vlastnosti zlúčeniny','Počet π elektrónov'],exp:'Benzén (6e, n=1): aromatický. Cyklobutadién (4e, n=1): antiaromatický — extrémne nestabilný.'},
  {q:'Elektrochemický článok — Nernstova rovnica:',a:1,opts:['E = E° + (RT/nF)ln Q','E = E° - (RT/nF)ln Q','E = E° × ln Q','E = E° / (nF)'],exp:'Nernst: E = E° - (RT/nF)ln Q. Pri 25°C: E = E° - (0,0592/n)log Q. Základ batérií, korózie, biosenzory.'},
  {q:'Mechanizmus SN2 reakcie:',a:0,opts:['Backside attack','Frontside attack — retencia konfigurácie','Prebieha cez karbokationt','Je možný len pri primárnych alkylhalogenidoch s objemným nukleofilom'],exp:'SN2: jednosupňový. Nukleofil → zadná strana → Waldenova inverzia. Rýchlosť = k[RX][Nu]. Primárne > sekundárne.'},
  {q:'Sol-gel materiály vs. klasické keramiky:',a:2,opts:['Sol-gel je rovnaký proces ako tradičná keramika','Sol-gel je len teoretický','Sol-gel','Sol-gel produkuje menej čisté materiály'],exp:'Sol-gel: hydrolýza alkoxidov pri RT → gél → xerogél (sušenie) alebo aerogél (superkrit. sušenie). TiO₂ fotokatalýza.'},
  {q:'Čo sú metalocénové katalyzátory (Ziegler-Natta 2. generácia)?',a:3,opts:['Biologické enzýmy na polymerizáciu','Heterogénne katalyzátory na povrchoch','Organické radikálové iniciátory','Sandwich komplexné zlúčeniny kovu'],exp:'Metalocény (Kaminsky): Cp₂ZrCl₂/MAO. Lepšia kontrola ako klasický Z-N. Syndiotaktický, izotaktický, ataktický PP.'},
]);

addQ(1,'m','ang',[
  {q:'In linguistics, "code-switching" refers to:',a:0,opts:['Alternating between two or more languages','Using formal vs. informal register','Translating texts between languages','Learning a second language as an adult'],exp:'Code-switching: bilinguals alternate languages mid-conversation. Social function: solidarity, expertise, identity.'},
  {q:'The Sapir-Whorf hypothesis (strong version) claims:',a:1,opts:['Language reflects thought but does not influence it','Language determines thought','Language and thought are completely independent','All languages describe reality identically'],exp:'Strong Whorfian: Hopi has no tense = Hopi cannot conceive time linearly. Mostly rejected. Weak version (influence) = supported.'},
  {q:'Which rhetorical device is used: "The pen is mightier than the sword"?',a:2,opts:['Simile','Onomatopoeia','Metonymy/metaphor','Hyperbole'],exp:'Metafora: pero (písanie/myšlienka) vs. meč (sila/vojna). Bulwer-Lytton 1839. Metonymia: pero = písaná slovo.'},
  {q:'Pragmatics studies language:',a:3,opts:['Sounds and phonemes','Grammar and syntax rules','Word meanings in isolation','In context'],exp:'Pragmatika: speech acts (Austin, Searle), implicature (Grice), deixis ("here", "now"). Meaning beyond literal words.'},
  {q:'"It&#39;s high time you ___ your homework."',a:1,opts:['do','did','have done','will do'],exp:'"It&#39;s high time" + past simple (subjunctive): "It&#39;s high time you did your homework." Expresses urgency/overdueness.'},
  {q:'The term "bildungsroman" describes:',a:0,opts:['A novel following a character&#39;s','A novel set during a war','A detective novel','A novel written in epistolary form'],exp:'Bildungsroman (German: formation novel): Great Expectations, Jane Eyre, The Catcher in the Rye. Coming-of-age.'},
  {q:'"The results, ___ were unexpected, changed our approach."',a:2,opts:['that','which they','which','who'],exp:'Non-defining relative clause with "which" (not "that"). Commas indicate non-essential, additional information.'},
  {q:'Choose the most sophisticated paraphrase of "He was very angry":',a:3,opts:['"He was super angry"','"He felt a lot of anger"','"His anger was very strong"','"He was seething with rage"'],exp:'Seething with rage, consumed by fury, incandescent with anger — vivid, precise vocabulary for academic/literary writing.'},
]);

// ═══════════════════════════════════════════
// 2. ROČNÍK — EDUCAST free
// ═══════════════════════════════════════════
addQ(2,'r','slj',[
  {q:'Čo je syntax?',a:1,opts:['Náuka o slovnej zásobe','Náuka o stavbe viet','Náuka o hláskach','Náuka o pravopise'],exp:'Syntax skúma stavbu viet a vzťahy medzi vetnými členmi.'},
  {q:'Vetný člen "podmet" odpovedá na otázku:',a:0,opts:['Kto? Čo?','Koho? Čoho?','Kde? Kam?','Ako? Akým spôsobom?'],exp:'Podmet = kto alebo čo vykonáva dej. Kto? Čo?'},
  {q:'Prísudok vyjadruje:',a:2,opts:['Osobu alebo vec','Vlastnosť podmetu','Činnosť alebo stav podmetu','Okolnosť deja'],exp:'Prísudok hovorí čo podmet robí alebo v akom stave je.'},
  {q:'Súvetie je veta ktorá obsahuje:',a:3,opts:['Jeden vetný základ','Iba podmet','Iba prísudok','Dva alebo viac'],exp:'Súvetie = spojenie dvoch alebo viacerých jednoduchých viet.'},
  {q:'Priraďovacie súvetie spája vety:',a:1,opts:['Nadradenú a podradenú','Rovnocenné','Iba pomocou "ktorý"','Vždy pomocou čiarky'],exp:'Priraďovacie súvetie: obe vety sú rovnocenné. Napr. Prišiel a sadol si.'},
  {q:'Podraďovacie súvetie obsahuje:',a:0,opts:['Hlavnú a vedľajšiu vetu','Dve hlavné vety','Tri rovnocenné vety','Vety bez spojky'],exp:'Podraďovacie súvetie: jedna veta je závislá (vedľajšia) od hlavnej.'},
  {q:'Morfológia skúma:',a:2,opts:['Stavbu viet','Zvukovú stránku jazyka','Tvaroslovie — ohýbanie slov','Slovnú zásobu'],exp:'Morfológia = tvaroslovie. Skúma gramatické tvary slov — časovanie, skloňovanie.'},
  {q:'Slovný druh "prídavné meno" odpovedá na otázku:',a:3,opts:['Kto? Čo?','Kde? Kedy?','Ako?','Aký? Ktorý? Čí?'],exp:'Prídavné meno: aký? ktorý? čí? Vyjadruje vlastnosť podstatného mena.'},
]);

addQ(2,'r','lit',[
  {q:'Renesancia vznikla v:',a:2,opts:['Nemecku','Francúzsku','Taliansku','Španielsku'],exp:'Renesancia vznikla v Taliansku v 14. storočí — Florencie, Rím.'},
  {q:'Humanizmus kladie do centra:',a:0,opts:['Človeka a jeho hodnotu','Boha a cirkev','Prírodu a zvieratá','Štát a politiku'],exp:'Humanizmus: človek je mierou všetkých vecí. Záujem o pozemský život.'},
  {q:'Dante Alighieri napísal:',a:1,opts:['Hamlet','Božskú komédiu','Don Quijota','Romea a Júliu'],exp:'Dante: Božská komédia — cesta peklom, očistcom a rajom.'},
  {q:'William Shakespeare bol:',a:3,opts:['Francúzsky básnik','Španielsky romanopisec','Taliansky maliar','Anglický dramatik a básnik'],exp:'Shakespeare (1564–1616): najväčší anglický dramatik. Hamlet, Othello, Romeo a Júlia.'},
  {q:'Barok je charakteristický:',a:2,opts:['Jednoduchosťou a čistotou','Optimizmom a svetlom','Pátosom, dramatickosťou, kontrastom','Humorom a iróniou'],exp:'Barok: veľkoleposť, dramatické kontrasty, náboženská tematika, patos.'},
  {q:'Sonet je básnická forma s:',a:0,opts:['14 veršmi (4+4+3+3)','8 veršmi','16 veršmi','Ľubovoľným počtom veršov'],exp:'Sonet: 14 veršov — dve kvartetá (4+4) a dve tercetá (3+3).'},
  {q:'Miguel de Cervantes napísal:',a:1,opts:['Fausta','Don Quijota de la Mancha','Božskú komédiu','Hamleta'],exp:'Cervantes: Don Quijote — prvý moderný európsky román, paródia na rytierskych hrdinov.'},
  {q:'Klasicizmus sa inšpiroval:',a:3,opts:['Stredovekými rytiermi','Biblickými príbehmi','Ľudovou slovesnosťou','Antickým Gréckom a Rímom'],exp:'Klasicizmus: vzor v antike, rozum nad citom, pevné pravidlá a formy.'},
]);

addQ(2,'r','mat',[
  {q:'Logaritmus log₂(8) sa rovná:',a:2,opts:['2','4','3','1'],exp:'log₂(8) = 3 pretože 2³ = 8.'},
  {q:'Kvadratická rovnica má tvar:',a:0,opts:['ax² + bx + c = 0','ax + b = 0','ax³ = 0','a/x = b'],exp:'Kvadratická rovnica: ax² + bx + c = 0, kde a ≠ 0.'},
  {q:'Diskriminant D = b² - 4ac. Ak D > 0:',a:1,opts:['Rovnica nemá riešenie','Rovnica má dve rôzne reálne korene','Rovnica má jeden koreň','Rovnica má komplexné korene'],exp:'D > 0: dva rôzne reálne korene. D = 0: jeden koreň. D < 0: žiadne reálne korene.'},
  {q:'Aritmetický priemer čísel 4, 8, 12 je:',a:3,opts:['6','10','7','8'],exp:'(4+8+12)/3 = 24/3 = 8.'},
  {q:'Pravdepodobnosť hodu šestky na kocke:',a:2,opts:['1/3','1/4','1/6','1/2'],exp:'Kocka má 6 strán, len jedna je šestka. P = 1/6.'},
  {q:'Obsah kruhu so polomerom r:',a:0,opts:['πr²','2πr','πr','2r²'],exp:'Obsah kruhu = πr². Obvod kruhu = 2πr.'},
  {q:'Funkcia y = kx + q je:',a:1,opts:['Kvadratická','Lineárna','Exponenciálna','Logaritmická'],exp:'y = kx + q je lineárna funkcia. Graf je priamka so smernicou k.'},
  {q:'Geometrická postupnosť: každý člen je:',a:3,opts:['O d väčší ako predchádzajúci','O d menší','Rovnaký','Predchádzajúci násobený'],exp:'Geometrická postupnosť: aₙ = a₁ · q^(n-1). Kvocient q.'},
]);

addQ(2,'r','dej',[
  {q:'Stredovek trvá približne:',a:2,opts:['500 pred Kr. – 500 n.l.','1000 – 1500 n.l.','476 – 1492 n.l.','800 – 1800 n.l.'],exp:'Stredovek: pád Ríma (476) – objavenie Ameriky (1492).'},
  {q:'Feudalizmus je systém kde:',a:0,opts:['Pôda patrí šľachte, roľníci','Všetci sú si rovní','Obchodníci vládnu mestám','Cirkev vlastní všetko'],exp:'Feudalizmus: hierarchia — kráľ, šľachta, nevoľníci. Výmena pôdy za vojenskú službu.'},
  {q:'Veľká Morava vznikla v:',a:1,opts:['7. storočí','9. storočí (okolo 833)','11. storočí','5. storočí'],exp:'Veľká Morava vznikla okolo roku 833 zjednotením Moravského a Nitrianskeho kniežatstva.'},
  {q:'Cyril a Metod prišli na Veľkú Moravu v roku:',a:3,opts:['800','900','700','863'],exp:'Cyril a Metod prišli na Veľkú Moravu v roku 863 na pozvanie Rastislava.'},
  {q:'Hlaholika bola:',a:2,opts:['Latinské písmo','Grécke písmo','Písmo ktoré','Ruské písmo'],exp:'Hlaholika: prvé slovanské písmo, vytvoril ju Konštantín (Cyril) okolo roku 862.'},
  {q:'Križiacke výpravy mali za cieľ:',a:0,opts:['Dobytie Svätej zeme (Jeruzalema)','Šírenie islamu','Obchodné cesty do Ázie','Kolonizáciu Afriky'],exp:'Križiacke výpravy (1096–1291): dobytie Svätej zeme od moslimov.'},
  {q:'Čierna smrť (mor) v 14. storočí zabila približne:',a:1,opts:['10% Európanov','Tretinu až polovicu Európy','5% populácie','Celú populáciu miest'],exp:'Čierna smrť (1347–1351): zahynula tretina až polovica európskej populácie.'},
  {q:'Magna Carta (1215) obmedzila moc:',a:3,opts:['Cirkvi','Miest','Šľachty','Anglického kráľa'],exp:'Magna Carta: anglická šľachta prinútila kráľa Jána Bezzemka podpísať listinu práv.'},
]);

addQ(2,'r','bio',[
  {q:'Mitóza je delenie bunky pri ktorom:',a:0,opts:['Vznikajú dve identické','Vznikajú pohlavné bunky','Bunka zaniká','Vznikajú štyri bunky'],exp:'Mitóza: z jednej bunky vzniknú dve geneticky totožné bunky. Rast a regenerácia.'},
  {q:'Meioza prebieha pri:',a:2,opts:['Raste organizmu','Hojení rán','Tvorbe pohlavných buniek','Delení krvných buniek'],exp:'Meioza: redukčné delenie → gamety (spermie, vajíčka) s polovičným počtom chromozómov.'},
  {q:'Bunková stena rastlín je tvorená z:',a:1,opts:['Chitozánu','Celulózy','Keratínu','Kolagénu'],exp:'Bunková stena rastlín: celulóza. Húb: chitín. Živočíchy bunkovú stenu nemajú.'},
  {q:'Chloroplasty sú organely zodpovedné za:',a:3,opts:['Dýchanie','Syntézu bielkovín','Trávenie','Fotosyntézu'],exp:'Chloroplasty: obsahujú chlorofyl, vykonávajú fotosyntézu.'},
  {q:'Homeostáza je:',a:0,opts:['Udržiavanie','Rast organizmu','Pohyb buniek','Tvorba energie'],exp:'Homeostáza: regulácia teploty, pH, obsahu vody, glukózy v krvi.'},
  {q:'Potravový reťazec vždy začína:',a:1,opts:['Živočíchom','Producentom (rastlinou)','Rozkladačom','Konzumentom'],exp:'Potravový reťazec: producent → konzument I → konzument II → rozkladač.'},
  {q:'Krv prenáša kyslík pomocou:',a:2,opts:['Krvných doštičiek','Bielych krviniek','Hemoglobínu v','Krvnej plazmy'],exp:'Hemoglobín v červených krviniek viaže O₂ a transportuje ho do tkanív.'},
  {q:'Nervová sústava pozostáva z:',a:3,opts:['Iba mozgu','Mozgu a srdca','Miechy a svalov','Centrálnej a'],exp:'CNS: mozog + miecha. PNS: nervy vedúce k orgánom a svalom.'},
]);

addQ(2,'r','che',[
  {q:'Chemická väzba vzniká:',a:0,opts:['Zdieľaním alebo','Zdieľaním protónov','Pohybom jadra','Žiarením atómu'],exp:'Kovalentná väzba: zdieľanie elektrónov. Iónová väzba: prenos elektrónov.'},
  {q:'NaCl je:',a:2,opts:['Kovalentná zlúčenina','Kov','Iónová zlúčenina (soľ)','Organická látka'],exp:'NaCl (kuchynská soľ): iónová zlúčenina. Na⁺ a Cl⁻ sú spojené iónovou väzbou.'},
  {q:'Oxidácia je:',a:1,opts:['Zisk elektrónov','Strata elektrónov','Zisk protónov','Strata neutrónov'],exp:'Oxidácia = strata elektrónov. Redukcia = zisk elektrónov. OIL RIG.'},
  {q:'Chemická rovnováha nastáva keď:',a:3,opts:['Reakcia skončí','Vznikne zrazenina','Teplota klesne','Rýchlosť priamej ='],exp:'Chemická rovnováha: rýchlosť priamej = rýchlosť spätnej reakcie. Dynamická rovnováha.'},
  {q:'Organická chémia skúma zlúčeniny:',a:0,opts:['Obsahujúce uhlík','Iba prírodné látky','Iba syntetické látky','Kovy a ich zliatiny'],exp:'Organická chémia: zlúčeniny uhlíka (okrem CO, CO₂, uhličitanov).'},
  {q:'Alkány sú uhľovodíky s:',a:2,opts:['Trojnásobnými väzbami','Dvojnásobnými väzbami','Iba jednoduchými väzbami (nasýtené)','Aromatickým jadrom'],exp:'Alkány: CₙH₂ₙ₊₂. Nasýtené uhľovodíky, iba jednoduché C-C väzby. Metán, etán.'},
  {q:'pH 7 znamená roztok je:',a:1,opts:['Kyslý','Neutrálny','Zásaditý','Silne kyslý'],exp:'pH 7 = neutrálny (destilovaná voda). pH < 7 = kyslý. pH > 7 = zásaditý.'},
  {q:'Katalyzátor v reakcii:',a:3,opts:['Zvyšuje teplotu','Mení produkty','Znižuje výťažok','Zrýchľuje reakciu'],exp:'Katalyzátor: zrýchli reakciu, znižuje aktivačnú energiu, sám sa nespotrebuje.'},
]);

addQ(2,'r','fyz',[
  {q:'Ohmov zákon hovorí že U = :',a:0,opts:['R · I','R / I','I / R','R + I'],exp:'Ohmov zákon: U = R · I. Napätie = odpor × prúd.'},
  {q:'Elektrický výkon sa počíta ako:',a:2,opts:['P = U + I','P = U - I','P = U · I','P = U / I'],exp:'Elektrický výkon P = U · I = I²R = U²/R. Jednotka: Watt.'},
  {q:'Magnetické pole vzniká okolo:',a:1,opts:['Statického náboja','Pohybujúceho sa','Každého telesa','Neutrálnych atómov'],exp:'Magnetické pole: pohybujúci sa náboj (prúd) vytvára magnetické pole.'},
  {q:'Vlnová dĺžka a frekvencia sú:',a:3,opts:['Priamo úmerné','Rovnaké','Nesúvisiace','Nepriamo úmerné (λ = v/f)'],exp:'λ = v/f. Dlhšia vlna = nižšia frekvencia. c = λf pre svetlo.'},
  {q:'Zvuk sa nešíri:',a:0,opts:['Vo vákuu','Vo vzduchu','Vo vode','V kove'],exp:'Zvuk je mechanické vlnenie — potrebuje hmotné prostredie. Vo vákuu sa nešíri.'},
  {q:'Jednotka elektrického odporu je:',a:1,opts:['Ampér','Ohm (Ω)','Volt','Watt'],exp:'Odpor sa meria v Ohmoch (Ω). Pomenovaný po Georgovi Simonovi Ohmovi.'},
  {q:'Polodivá a polomer kružnice v pohybe: dostredivá sila smeruje:',a:2,opts:['Von od stredu','Pozdĺž kružnice','K stredu kružnice','Zvisle nadol'],exp:'Dostredivá sila smeruje vždy k stredu kružnice. Drží teleso na kruhová dráhe.'},
  {q:'Skupenské teplo je energia potrebná na:',a:3,opts:['Zvýšenie teploty','Zníženie teploty','Ohrev o 1°C','Zmenu skupenstva'],exp:'Skupenské teplo: energia na zmenu tuhé↔kvapalné alebo kvapalné↔plynné.'},
]);

addQ(2,'r','ang',[
  {q:'She has been studying for two hours.',en:'She has been studying for two hours.',a:0,opts:['Učí sa už dve hodiny (a stále)','Učila sa dve hodiny (skončila)','Bude sa učiť dve hodiny','Učila by sa'],exp:'Present Perfect Continuous: dej začal v minulosti a stále trvá.'},
  {q:'Doplň: If I ___ rich, I would travel the world.',a:1,opts:['Am','Were','Will be','Had been'],exp:'2. kondicionál (nereálna podmienka): If I were... I would... Gramatický tvar "were" pre všetky osoby.'},
  {q:'Preložte: Správa bola odoslaná včera.',a:2,opts:['The message sent yesterday.','Yesterday message was send.','The message was sent yesterday.','The message is sent yesterday.'],exp:'Pasívum minulý čas: was/were + 3. tvar slovesa (past participle).'},
  {q:'"Despite" sa používa:',a:3,opts:['Na vyjadrenie príčiny','Na vyjadrenie podmienky','Na vyjadrenie výsledku','Na vyjadrenie kontrastu (napriek)'],exp:'Despite + podstatné meno/gerundium: Despite the rain, we went out.'},
  {q:'Modal verb "must" vyjadruje:',a:0,opts:['Povinnosť','Schopnosť','Povolenie','Ponuku'],exp:'Must: povinnosť (You must wear a seatbelt.) alebo záver (She must be tired.)'},
  {q:'Preložte: Čím viac cvičím, tým lepší som.',a:1,opts:['More I practice, better I am.','The more I practice, the better I am.','More practice, more better.','I practice more, I am better.'],exp:'"The more... the more/better..." — porovnávacia štruktúra.'},
  {q:'Reported speech: He said: "I am tired." →',a:2,opts:['He said that he is tired.','He told I was tired.','He said that he was tired.','He said he are tired.'],exp:'Reported speech: priamy → nepriamy. "am" → "was". Časový posun.'},
  {q:'Slovo "Nevertheless" znamená:',a:3,opts:['Preto','Navyše','Napríklad','Napriek'],exp:'Nevertheless = napriek tomu, predsa len. Formal connector of contrast.'},
]);


// ═══════════════════════════════════════════
// 2. ROČNÍK — EDUCAST PLUS (VÝZVA + MASTER)
// ═══════════════════════════════════════════

// ── 2R VÝZVA ──
addQ(2,'v','slj',[
  {q:'Ktorý vetný člen je vždy základom vety?',a:2,opts:['Predmet','Príslovkové určenie','Podmet a prísudok','Prívlastok'],exp:'Podmet a prísudok tvoria základovú skladobnú dvojicu — jadro každej vety.'},
  {q:'Čo je syntaktická homonymia?',a:0,opts:['Jav kde jedna veta pripúšťa viac','Veta s rovnakými slovami','Opakovanie syntaktickej štruktúry','Veta bez podmetu'],exp:'Syntaktická homonymia: "Videl muža ďalekohľadom" — môže byť videl ďalekohľadom, alebo muž mal ďalekohľad.'},
  {q:'Anakolút je štylistická figúra kde:',a:1,opts:['Opakujú sa hlásky','Veta nedodržiava gramatickú','Vetné členy sa presúvajú','Veta je neúplná'],exp:'Anakolút: zámerné porušenie gramatickej stavby vety pre expresívny efekt.'},
  {q:'Aké sú základné funkčné štýly slovenčiny?',a:3,opts:['Tri — hovorový, umelecký, vedecký','Štyri — hovorový, publicistický, odborný, administratívny','Päť — plus básnický a rečnícky','6: hovorový, umelecký, odborný, publicistický, adm., rečnícky'],exp:'6 funkčných štýlov: hovorový, umelecký, odborný, publicistický, administratívny, rečnícky.'},
  {q:'Epiteton ornans je:',a:2,opts:['Záporná charakteristika','Prirovnanie s ako','Ozdobný prívlastok','Opakujúci sa refrén'],exp:'Epiteton ornans: ustálený ozdobný prívlastok — napr. bledá luna, šumné lesy.'},
  {q:'Vo vete "Prišiel unavený" je "unavený":',a:0,opts:['Doplnok','Prívlastok','Príslovkové určenie spôsobu','Menná časť prísudku'],exp:'Doplnok: vetný člen vyjadrujúci vlastnosť podmetu alebo predmetu súčasne s dejom.'},
  {q:'Čo charakterizuje publicistický štýl?',a:1,opts:['Maximálna odbornosť a presnosť','Informatívnosť a apelová funkcia,','Subjektívnosť a obraznosť','Strohosť bez expresivity'],exp:'Publicistický štýl: informuje a pôsobí na čitateľa, je aktuálny, používa expresívne prostriedky.'},
  {q:'Hyperbola je:',a:3,opts:['Zámerné zoslabenie výpovede','Prirovnanie na základe podobnosti','Protirečenie v jednom spojení','Zámerné zveličenie pre expresívny efekt'],exp:'Hyperbola: zveličenie — "Sto ráz som ti hovoril." Opak: litotes (zmenšenie).'},
]);

addQ(2,'v','lit',[
  {q:'Renesancia vznikla v:',a:1,opts:['Francúzsku 15. storočia','Taliansku 14.–15. storočia','Anglicku 16. storočia','Španielsku 15. storočia'],exp:'Renesancia: Taliansko 14.–15. stor. Dante, Petrarca, Boccaccio. Návrat k antike.'},
  {q:'Humanizmus hlása:',a:0,opts:['Dôstojnosť a hodnotu človeka v centre záujmu','Podriadenosť človeka Bohu','Návrat k prírode a jednoduchosti','Rozum ako jediný zdroj poznania'],exp:'Humanizmus: anthropos = človek v centre. Návrat k antickým hodnotám, vzdelanie, krása.'},
  {q:'Shakespearova tragédia je charakteristická:',a:2,opts:['Šťastným koncom a morálnym ponaučením','Komedie omylů a zámena totožnosti','Vnútorným konfliktom hrdinu a osudovou chybou','Historickým dejom bez osobného konfliktu'],exp:'Shakespearova tragédia: hrdina má vnútornú chybu (hamartia) — Hamlet nerozhodnosť, Othello žiarlivosť.'},
  {q:'Slovenská renesančná literatúra sa písala prevažne:',a:3,opts:['Po slovensky','Po česky','Po nemecky','Po latinsky a po česky'],exp:'Slovenská renesančná lit.: latinčina (náboženstvo, veda) a čeština (Biblia Kralická).'},
  {q:'Petrarcizmus v poézii znamená:',a:1,opts:['Epická poézia o hrdinoch','Sonety o neopätovanej láske,','Satirické básne o spoločnosti','Mystická náboženská lyrika'],exp:'Petrarca: sonet ako forma, Laura ako idealizovaný objekt lásky. Vplyv na celú európsku lyriku.'},
  {q:'Don Quijote Cervantesa patrí k:',a:0,opts:['Renesančnému románu,','Barokovej mystike','Klasicistickej satire','Osvietenskej filozofii'],exp:'Cervantes: Don Quijote (1605) — renesančný román, paródia na rytierske romány, prvý moderný román.'},
  {q:'Barok sa vyznačuje:',a:2,opts:['Racionálnou jasnosťou a jednoduchosťou','Návratom k antike a harmonii','Kontrastmi, pompéznosťou, témou vanitas','Dôrazom na ľudovú slovesnosť'],exp:'Barok: vanitas vanitatum (márnosť), smrť, kontrast svetla a tmy, pompéznosť. Reakcia na reformáciu.'},
  {q:'Ezopské bájky majú funkciu:',a:3,opts:['Pobavenie detí','Historické zaznamenanie udalostí','Náboženská výchova','Morálne ponaučenie cez príbeh'],exp:'Ezopské bájky: alegorické príbehy so zvieratami, vždy s morálnym ponaučením (muthos).'},
]);

addQ(2,'v','mat',[
  {q:'Logaritmus log_a(x) je definovaný pre:',a:1,opts:['Všetky reálne x','x > 0 a a > 0, a ≠ 1','Všetky celé x','x ≥ 0 a a > 0'],exp:'log_a(x): x > 0 (argument), a > 0 a a ≠ 1 (základ). log_a(x) = y ↔ a^y = x.'},
  {q:'Súčin log(a) + log(b) = ?',a:0,opts:['log(a·b)','log(a+b)','log(a/b)','log(a^b)'],exp:'Pravidlo logaritmu: log(a) + log(b) = log(a·b). Analogicky: log(a) - log(b) = log(a/b).'},
  {q:'Geometrická postupnosť má n-tý člen:',a:2,opts:['a₁ + (n-1)d','a₁ · (n-1)q','a₁ · q^(n-1)','a₁ / q^(n-1)'],exp:'Geometrická: aₙ = a₁ · q^(n-1). q = kvocient (konštantný podiel susedných členov).'},
  {q:'Kombinačné číslo C(n,k) vyjadruje:',a:3,opts:['Počet permutácií n prvkov','Počet variácií k z n','Počet usporiadaných k-tíc z n','Počet neusporiadaných k-prvkových'],exp:'C(n,k) = n! / (k!(n-k)!) = "n nad k". Počet spôsobov výberu k prvkov z n bez ohľadu na poradie.'},
  {q:'Sinus súčtu sin(α+β) =',a:1,opts:['sin α · sin β + cos α · cos β','sin α · cos β + cos α · sin β','cos α · cos β - sin α · sin β','sin α · cos β - cos α · sin β'],exp:'sin(α+β) = sin α cos β + cos α sin β. Dôležitý vzorec pre goniometrické výpočty.'},
  {q:'Kvadratická rovnica ax²+bx+c=0 má diskriminant D=',a:0,opts:['b²-4ac','b²+4ac','2b-4ac','b-4ac'],exp:'D = b²-4ac. D>0: dve reálne korene. D=0: jeden koreň. D<0: žiadny reálny koreň.'},
  {q:'Objem rotačného valca je:',a:2,opts:['2πr(r+v)','πr²','πr²v','(4/3)πr³'],exp:'Valec: V = πr²v (r = polomer základne, v = výška). Plášť = 2πrv. Povrch = 2πr(r+v).'},
  {q:'Pravdepodobnosť javu A je P(A) = 0,3. P(Ā) =',a:3,opts:['0,3','0,6','0,4','0,7'],exp:'P(Ā) = 1 - P(A) = 1 - 0,3 = 0,7. Pravdepodobnosť doplnkového javu.'},
]);

addQ(2,'v','dej',[
  {q:'Feudalizmus je systém kde:',a:0,opts:['Pôda patrí šľachte, roľníci','Obchod riadi štát','Cirkev vlastní všetku pôdu','Moc patrí mestám'],exp:'Feudalizmus: hierarchia — kráľ → šľachta → rytieri → poddaní. Základ: pôda za vojenskú službu.'},
  {q:'Magna Carta (1215) obmedzila moc:',a:1,opts:['Francúzskeho kráľa','Anglického kráľa Jána','Rímskeho cisára','Pápeža'],exp:'Magna Carta: anglická šľachta donútila kráľa Jána podpísať listinu obmedzujúcu kráľovskú moc.'},
  {q:'Husitské hnutie vzniklo ako reakcia na:',a:2,opts:['Turecké vpády do Európy','Mongolské výboje','Upálenie Jána Husa (1415)','Čiernu smrť'],exp:'Husiti: reformné hnutie po upálení Jána Husa na Kostnickskom koncile 1415.'},
  {q:'Osmanská ríša ohrozovala Európu najmä v:',a:3,opts:['10.–11. storočí','12.–13. storočí','13.–14. storočí','15.–17. storočí'],exp:'Osmani: dobytie Konštantínopolu 1453, Moháč 1526, obliehanie Viedne 1529 a 1683.'},
  {q:'Renesančný humanizmus sa šíril vďaka:',a:1,opts:['Križiackym výpravám','Gutenbergovmu kníhtlači (1450)','Objaveniu Ameriky','Reformácii Luthera'],exp:'Gutenberg ~1450: kníhtlač umožnila masové šírenie humanistických myšlienok a Biblie.'},
  {q:'Martin Luther inicioval reformáciu v roku:',a:0,opts:['1517 — 95 téz vo Wittenbergu','1521 — Wormský snem','1555 — Augsburský mier','1534 — anglická reformácia'],exp:'Luther 1517: 95 téz proti odpustkom. Augsburský mier 1555: "cuius regio, eius religio".'},
  {q:'Tridsaťročná vojna (1618–1648) sa skončila:',a:2,opts:['Víťazstvom Habsburgovcov','Rozpadom Svätej ríše rímskej','Vestfálskym mierom','Utrechtským mierom'],exp:'Vestfálsky mier 1648: koniec náboženskej vojny, základ moderného systému suverénnych štátov.'},
  {q:'Na území Slovenska v stredoveku dominoval:',a:3,opts:['Byzantský vplyv','Poľský vplyv','Moravský štát','Uhorský štát'],exp:'Uhorsko od 10. stor.: Štefan I. (1000) — korunovácia, christianizácia. Slovenské územie = Horné Uhorsko.'},
]);

addQ(2,'v','bio',[
  {q:'Mitóza je delenie bunky kde:',a:0,opts:['Vznikajú dve geneticky totožné dcérske bunky','Vznikajú štyri haploidné bunky','Dochádza k redukcii chromozómov','Bunka sa pripravuje na oplodnenie'],exp:'Mitóza: somatické delenie. Z jednej diploidnej bunky (2n) vzniknú dve diploidné (2n) dcérske bunky.'},
  {q:'Meióza sa odlišuje od mitózy tým, že:',a:1,opts:['Prebieha rýchlejšie','Znižuje počet chromozómov na','Prebieha iba v nervových bunkách','Vytvára len jednu dcérsku bunku'],exp:'Meióza: redukčné delenie. Z jednej 2n bunky vzniknú štyri n (haploidné) bunky — gamety.'},
  {q:'DNA replikácia prebieha:',a:2,opts:['V cytoplazme pred mitózou','V jadre počas G2 fázy','V jadre počas S fázy','Na ribozómoch'],exp:'S fáza (Synthesis): replikácia DNA v jadre. Semikonzervatívna — každá dcérska molekula má 1 starý + 1 nový reťazec.'},
  {q:'Transpirácio u rastlín slúži na:',a:3,opts:['Výrobu cukrov','Príjem CO₂','Tvorbu kyslíka','Pohyb vody a'],exp:'Transpirácia: výpar vody prieduchmi. Vytvára ťahové sily, ktoré ženú vodu a minerály cez xylém nahor.'},
  {q:'Enzýmy sú:',a:1,opts:['Lipidy slúžiace ako energia','Biologické katalyzátory znižujúce','Stavebné bielkoviny bunkovej membrány','Nosiče kyslíka v krvi'],exp:'Enzýmy: bielkovinové katalyzátory. Znižujú aktivačnú energiu reakcie, sú substrátovo špecifické.'},
  {q:'Aeróbne dýchanie prebieha v:',a:0,opts:['Mitochondriách','Chloroplastoch','Ribozómoch','Bunkovej membráne'],exp:'Mitochondrie: glykolýza (cytoplazma) → acetyl-CoA → Krebsov cyklus → oxidatívna fosforylácia → ~36 ATP.'},
  {q:'Imunitná odpoveď B-lymfocytov produkuje:',a:2,opts:['Cytotoxické T-bunky','Interferóny','Protilátky (imunoglobulíny)','Fagocyty'],exp:'B-lymfocyty: humorálna imunita. Produkujú protilátky špecifické pre antigén. T-bunky: bunková imunita.'},
  {q:'Vitamín D je dôležitý pre:',a:3,opts:['Zrážanlivosť krvi','Tvorbu červených krviniek','Antioxidačnú ochranu','Vstrebávanie vápnika a'],exp:'Vitamín D: reguluje vstrebávanie Ca²⁺ a fosforu. Nedostatok → rachitis u detí, osteoporóza u dospelých.'},
]);

addQ(2,'v','che',[
  {q:'Kovalentná väzba vzniká:',a:0,opts:['Zdieľaním elektrónového páru medzi','Prenosom elektrónu z kovu na nekov','Silami medzi iónmi','Van der Waalsovými silami'],exp:'Kovalentná väzba: spoločný elektrónový pár. Nepolárna (H₂) alebo polárna (HCl) podľa elektronegativity.'},
  {q:'Oxidačné číslo kyslíka v zlúčeninách je zvyčajne:',a:1,opts:['+2','-2','0','-1'],exp:'Kyslík: OČ = -2 (výnimky: O₂ = 0, H₂O₂ = -1, OF₂ = +2). Fluór je elektronegatívnejší.'},
  {q:'Molárna hmotnosť NaCl je:',a:2,opts:['23 g/mol','35,5 g/mol','58,5 g/mol','74 g/mol'],exp:'M(NaCl) = M(Na) + M(Cl) = 23 + 35,5 = 58,5 g/mol.'},
  {q:'Avogadrova konštanta N_A =',a:3,opts:['6,022 × 10²²','6,022 × 10²¹','6,022 × 10²⁵','6,022 × 10²³'],exp:'N_A = 6,022 × 10²³ mol⁻¹. Jeden mól látky obsahuje 6,022 × 10²³ častíc (atómov, molekúl, iónov).'},
  {q:'Disociácia silnej kyseliny HCl v roztoku:',a:1,opts:['Prebieha čiastočne','Prebieha úplne: HCl → H⁺ + Cl⁻','Neprebieha','Prebieha len pri zahriatí'],exp:'Silné kyseliny (HCl, HNO₃, H₂SO₄): úplná disociácia. Slabé (CH₃COOH): čiastočná.'},
  {q:'Redoxná reakcia zahŕňa:',a:0,opts:['Súčasný prenos','Iba tvorbu zrazeniny','Iba zmenu pH','Iba tepelné zmeny'],exp:'Redox: oxidácia (strata e⁻) + redukcia (zisk e⁻) prebiehajú súčasne. Oxidant prijíma, reduktant dáva e⁻.'},
  {q:'Alkány sú uhľovodíky so vzorcom:',a:2,opts:['CₙH₂ₙ','CₙH₂ₙ₋₂','CₙH₂ₙ₊₂','CₙHₙ'],exp:'Alkány: CₙH₂ₙ₊₂. Nasýtené, len jednoduché väzby. Metán CH₄, etán C₂H₆, propán C₃H₈.'},
  {q:'pH = 3 znamená, že roztok je:',a:3,opts:['Neutrálny','Zásaditý','Slabo kyslý','Výrazne kyslý'],exp:'pH: 0–6 = kyslé, 7 = neutrálne, 8–14 = zásadité. pH 3: [H⁺] = 10⁻³ mol/l — výrazne kyslé.'},
]);

addQ(2,'v','fyz',[
  {q:'Kirchhoffov prvý zákon (uzlový) hovorí:',a:0,opts:['Súčet prúdov prichádzajúcich','Súčet napätí v slučke = 0','Odpor rastie s teplotou','Výkon = napätie × prúd'],exp:'1. Kirchhoffov zákon: ΣI_vstup = ΣI_výstup. Zákon zachovania náboja v uzle.'},
  {q:'Elektromagnetické vlny sa šíria vo vákuu rýchlosťou:',a:1,opts:['3 × 10⁸ km/s','3 × 10⁸ m/s','3 × 10⁶ m/s','3 × 10¹⁰ m/s'],exp:'c = 3 × 10⁸ m/s (rýchlosť svetla vo vákuu). Všetky EM vlny (viditeľné svetlo, RTG, rádio) majú rovnakú rýchlosť.'},
  {q:'Snellov zákon lomu hovorí:',a:2,opts:['Uhol dopadu = uhol odrazu','Svetlo sa láme vždy od kolmice','n₁·sin α₁ = n₂·sin α₂','Svetlo sa láme iba pri prechode do hustejšieho prostredia'],exp:'Snellov zákon: n₁ sin α₁ = n₂ sin α₂. Pri prechode do opticky hustejšieho prostredia sa lúč láme k norme.'},
  {q:'Indukovaná elektromotorická sila závisí od:',a:3,opts:['Odporu vodiča','Teploty vodiča','Dĺžky vodiča','Rýchlosti zmeny'],exp:'Faradayov zákon: EMF = -dΦ/dt. Čím rýchlejšie sa mení magnetický tok, tým väčšia EMF.'},
  {q:'Vlnová dĺžka a frekvencia sú viazané vzťahom:',a:1,opts:['λ = f/v','λ = v/f','λ = v·f','λ = f²/v'],exp:'c = λ·f → λ = c/f. Dlhá vlnová dĺžka = nízka frekvencia (rádio). Krátka vlnová dĺžka = vysoká frekvencia (RTG).'},
  {q:'Sila na nabitú časticú v magnetickom poli (Lorentzova):',a:0,opts:['F = qvB·sinα','F = qvB·cosα','F = q²vB','F = qv/B'],exp:'Lorentzova sila: F = qvB sinα. Maximálna keď v ⊥ B. Smer: pravidlo pravej ruky.'},
  {q:'Jadrová štiepna reakcia uvoľňuje energiu podľa:',a:2,opts:['Hookoveho zákona','Boltzmannovej rovnice','Einsteinovho E = mc²','Planckoveho kvantového vzťahu'],exp:'E = mc²: hmotnostný defekt Δm sa premení na energiu. Základ jadrovej energetiky.'},
  {q:'Polovodič typu N vzniká dotovaním:',a:3,opts:['Atómami s 3 valenčnými elektrónmi','Atómami kovov','Atómami s 2 valenčnými elektrónmi','Atómami s 5 valenčnými elektrónmi'],exp:'N-typ: donor má 5 val. elektrónov (P, As) → prebytočný elektrón → vodivosť elektronmi.'},
]);

addQ(2,'v','ang',[
  {q:'She has been working here ___ 2020.',a:0,opts:['since','for','from','during'],exp:'Since + bod v čase (since 2020). For + časové obdobie (for 3 years).'},
  {q:'If I ___ rich, I would travel the world.',a:1,opts:['am','were','will be','would be'],exp:'2nd conditional: If + past simple, would + infinitive. Nereálna podmienka v prítomnosti/budúcnosti.'},
  {q:'The report must ___ by Friday.',a:2,opts:['submit','submits','be submitted','have submitted'],exp:'Modálne sloveso + be + past participle = pasívum. Must be submitted = musí byť odovzdaná.'},
  {q:'Preložte: Čím viac cvičí, tým je silnejší.',a:3,opts:['More he exercises, stronger he gets.','The more exercises, the stronger.','He exercises more and gets stronger.','The more he exercises, the stronger he gets.'],exp:'The more... the more/stronger: porovnávacia konštrukcia s the + komparatív.'},
  {q:'Despite ___ tired, she finished the race.',a:1,opts:['she was','being','to be','been'],exp:'Despite/In spite of + gerundium (being). Despite the fact that + full clause.'},
  {q:'He suggested ___ to the cinema.',a:0,opts:['going','to go','go','went'],exp:'Suggest + gerundium (going). Porovnaj: recommend going, avoid going, enjoy going.'},
  {q:'The passive of "They are building a new bridge":',a:2,opts:['A new bridge has been built.','A new bridge was being built.','A new bridge is being built.','A new bridge will be built.'],exp:'Present continuous passive: is/are + being + past participle. Building → is being built.'},
  {q:'Phrasal verb "give up" means:',a:3,opts:['to offer something','to give a present','to surrender something','to stop doing something'],exp:'Give up = prestať robiť niečo. Give in = vzdať sa. Give away = rozdať zadarmo.'},
]);

// ── 2R MASTER ──
addQ(2,'m','slj',[
  {q:'Diskurzívna analýza skúma:',a:0,opts:['Jazyk ako spoločenskú prax a moc v texte','Iba gramatickú štruktúru viet','Historický vývoj slovnej zásoby','Výslovnostné normy'],exp:'Diskurzívna analýza (Foucault, Fairclough): text ako miesto ideológie a moci — kto hovorí, čo, komu a prečo.'},
  {q:'Čo je koherencia textu?',a:1,opts:['Viditeľné gramatické spojenie viet (zámená, spojky)','Logická a sémantická súdržnosť textu','Správne pravopisné pravidlá','Počet odsekov v texte'],exp:'Koherencia: sémantická súdržnosť (logika, téma). Kohézia: gramatické prostriedky spojenia (zámená, konektory).'},
  {q:'Intertextualita znamená:',a:2,opts:['Písanie na internete','Preklad textu do iného jazyka','Odkazovanie textu na iné texty','Rozdelenie textu na kapitoly'],exp:'Kristeva: každý text je tkaný z iných textov. Alúzie, citáty, paródie, remaky — všetko je intertextuálne.'},
  {q:'Autorský zámer vs. čitateľská interpretácia — teória',a:3,opts:['Chomského generatívna gramatika','Saussurova štrukturálna lingvistika','Wittgensteinova filozofia jazyka','Bartesova smrť autora — text patrí čitateľovi'],exp:'Barthes (1967): "Smrť autora" — autorský zámer nie je privilégovaný. Zmysel tvorí čitateľ pri recepcii.'},
  {q:'Jazyk ako systém znakov definoval:',a:0,opts:['Ferdinand de Saussure — signifiant/signifié','Noam Chomsky — hĺbková štruktúra','Ludwig Wittgenstein — jazykové hry','Roman Jakobson — komunikačné funkcie'],exp:'Saussure: znak = signifiant (označujúce/zvuk) + signifié (označované/pojem). Jazyk ako systém rozdielov.'},
  {q:'Kognitívna metafora (Lakoff, Johnson) tvrdí:',a:1,opts:['Metafory sú iba ozdoby reči','Metafory štruktúrujú naše','Metafory patria iba do poézie','Metafory sú vždy zámerné'],exp:'Lakoff & Johnson (1980): "Metaphors We Live By" — ARGUMENT IS WAR, TIME IS MONEY. Metafory sú kognitívne, nie len rétorické.'},
  {q:'Slovenský pravopis kodifikuje:',a:2,opts:['Ministerstvo školstva SR','Jazyková rada Slovenského rozhlasu','Jazykovedný ústav Ľ. Štúra SAV','Slovenská akadémia vied ako celok'],exp:'JÚĽŠ SAV: kodifikačná príručka (Pravidlá slovenského pravopisu). Norma je záväzná pre verejný život.'},
  {q:'Rétorika Aristotela rozlišuje tri druhy presviedčania:',a:3,opts:['Logos, pathos, ethos — ale všetky sú rovnocenné','Iba logos (rozumové argumenty) je legitímny','Pathos je najdôležitejší','Ethos (dôveryhodnosť), logos (argument), pathos (emócie)'],exp:'Aristotelova rétorika: ethos (charakter rečníka) + logos (logické argumenty) + pathos (emócie publika).'},
]);

addQ(2,'m','lit',[
  {q:'Magický realizmus je charakteristický:',a:0,opts:['Prelínaním každodennej reality s magickými prvkami','Výlučne fantastickými svetmi bez reálneho základu','Vedecko-fantastickými témami','Historickými dokumentárnymi naratívmi'],exp:'Magický realizmus (García Márquez, Kafka): magické prvky prezentované ako normálna súčasť reality.'},
  {q:'Brechtov epický divadlo využíva Verfremdungseffekt:',a:1,opts:['Na maximálne pohrúženie diváka do deja','Na narušenie ilúzie a kritické myslenie','Na tragický katarzis','Na zábavné komedie bez posolstva'],exp:'Brecht: odcudzovací efekt — divák si musí byť vedomý, že sleduje divadlo, aby kriticky myslel.'},
  {q:'Existencializmus v literatúre (Sartre, Camus) hlása:',a:2,opts:['Predurčenosť osudu človeka','Primát kolektívu nad jednotlivcom','Existencia predchádza esenciu','Návrat k náboženstvu ako riešenie úzkosti'],exp:'Sartre: "existence précède essence" — nie sme stvorení pre nejaký účel, zmysel si vytvárame činom.'},
  {q:'Stream of consciousness (prúd vedomia) je technika kde:',a:3,opts:['Rozprávač komentuje udalosti zvonka','Používa sa striedanie viacerých rozprávačov','Príbeh je chronologicky lineárny','Zachytáva sa tok myšlienok postavy bez filtrovania'],exp:'Joyce, Woolf: vnútorný monológ bez logickej štruktúry — asociácie, fragmenty, nevedomé myšlienky.'},
  {q:'Intertextualita v Umberta Eca "Meno ruže":',a:1,opts:['Román nemá žiadne literárne odkazy','Citácie stredovekých textov a detektívky vytvoria','Román je priamou paródiou Sherlocka Holmesa','Eco odmietol intertextualitu'],exp:'Eco: medieválne záhadné vraždy + Aristotelova poetika + detektívka. Intertextuálna hra pre vzdelaného čitateľa.'},
  {q:'Lyrizovaná próza na Slovensku (40. roky) je spojená s:',a:0,opts:['Francisci Fraňom Kráľom, Dobroslava Chrobák,','Jánom Kollárom a Pavlom Jozefom Šafárikom','Svetozárom Hurbanom Vajanským','Jozefom Gregor Tajovským'],exp:'Naturizmus (lyriz. próza): Dobroslav Chrobák (Drak sa vracia), Margita Figuli (Tri gaštanové kone), František Švantner.'},
  {q:'Tragická katarzia podľa Aristotela znamená:',a:2,opts:['Smrť hrdinu ako trest za hriechy','Víťazstvo dobra nad zlom','Očistenie (katharsis) emócií súcitu','Ponaučenie z chýb hrdinu'],exp:'Aristoteles (Poetika): tragédia cez súcit (eleos) a strach (phobos) spôsobuje katharsis — emocionálne očistenie.'},
  {q:'Postmodernizmus v literatúre je charakteristický:',a:3,opts:['Lineárnym naratívom a jasným posolstvom','Socialistickým realizmom','Návratom k antickým formám','Metafikciou, iróniou, odmietnutím veľkých'],exp:'Postmoderna: Lyotard — nedôvera voči metanaratívom. Metafikcia, pastiche, irónia, pluralita pravdy.'},
]);

addQ(2,'m','mat',[
  {q:'Goniometrická rovnica cos x = 0,5 má riešenie:',a:0,opts:['x = π/3 + 2kπ','x = π/4 + 2kπ','x = π/6 + 2kπ','x = π/2 + 2kπ'],exp:'cos(π/3) = 0,5. Všeobecné riešenie: x = ±π/3 + 2kπ, k ∈ ℤ.'},
  {q:'Derivácia funkcie f(x) = x³ je:',a:1,opts:['x²','3x²','3x³','x³/3'],exp:"f'(x) = 3x². Pravidlo: (xⁿ)' = n·xⁿ⁻¹."},
  {q:'Integrál ∫2x dx =',a:2,opts:['2x²','x','x² + C','2x + C'],exp:'∫2x dx = x² + C. Pravidlo: ∫xⁿ dx = xⁿ⁺¹/(n+1) + C.'},
  {q:'Limita lim(x→∞) (1/x) =',a:3,opts:['∞','1','neurčitá','0'],exp:'Keď x → ∞, 1/x → 0. Funkcia sa asymptoticky blíži k nule ale nikdy ju nedosiahne.'},
  {q:'Binomická veta: (a+b)² =',a:1,opts:['a²+b²','a²+2ab+b²','a²-2ab+b²','2a+2b'],exp:'(a+b)² = a² + 2ab + b². Binomické koeficienty: 1,2,1. (a+b)³ = a³+3a²b+3ab²+b³.'},
  {q:'Komplexné číslo i je definované ako:',a:0,opts:['i = √(-1)','i = √1','i = -1','i = 1/√2'],exp:'i = √(-1), i² = -1. Komplexné číslo: z = a + bi, kde a,b ∈ ℝ.'},
  {q:'Matica A je regulárna ak:',a:2,opts:['Má rovnaký počet riadkov a stĺpcov','Všetky prvky sú kladné','det(A) ≠ 0 — existuje inverzná matica','Je symetrická'],exp:'Regulárna matica: det ≠ 0 → existuje A⁻¹. Singulárna: det = 0 → nemá inverznú maticu.'},
  {q:'Vektorový súčin a × b je:',a:3,opts:['Skalárna veličina (číslo)','Vždy nulový vektor','Rovnobežný s oboma vektormi','Vektor kolmý na obidva vektory'],exp:'Vektorový súčin: vektor ⊥ na a aj b. |a×b| = |a||b|sinα. Skalárny súčin a·b je číslo.'},
]);

addQ(2,'m','dej',[
  {q:'Geopolitické dôsledky Vestfálskeho mieru (1648):',a:0,opts:['Položil základy systému suverénnych národných štátov','Zjednotil Európu pod habsburskou nadvládou','Rozdelil Európu na náboženské zóny natrvalo','Ukončil existenciu Svätej ríše rímskej'],exp:'Vestfálsky mier: princíp suverenity štátov, nemiešania do vnútorných záležitostí — základ moderného medzinárodného práva.'},
  {q:'Osvietenstvo 18. storočia propagovalo:',a:1,opts:['Návrat k stredovekej zbožnosti','Rozum, pokrok, kritiku náboženstva a','Romantický kult prírody a citu','Merkantilizmus a koloniálnu expanziu'],exp:'Osvietenstvo: Voltaire, Rousseau, Montesquieu — rozum, sloboda, rovnosť, kritika cirkvi a absolútnej monarchie.'},
  {q:'Francúzska revolúcia (1789) priniesla heslo:',a:2,opts:['Boh, kráľ, vlasť','Mier, chlieb, pôda','Liberté, égalité, fraternité','Viera, nádej, láska'],exp:'Liberté (sloboda), Égalité (rovnosť), Fraternité (bratstvo) — heslo Francúzskej revolúcie.'},
  {q:'Priemyselná revolúcia začala v:',a:3,opts:['Francúzsku koncom 18. storočia','Nemecku začiatkom 19. storočia','USA v 19. storočí','Anglicku v 2. polovici 18. storočia'],exp:'Anglicko: parný stroj (Watt 1769), textilné továrne, uhoľné bane. Priemyselná revolúcia = prechod od manufaktúry k strojovej výrobe.'},
  {q:'Viedenský kongres (1814–1815) mal za cieľ:',a:1,opts:['Rozšíriť napoleonské výboje','Obnoviť konzervatívny poriadok po','Demokratizovať Európu','Vytvoriť jednotnú európsku federáciu'],exp:'Viedenský kongres: Metternich, legitimizmus, rovnováha síl. Svätá aliancia — konzervativizmus contra revolúciám.'},
  {q:'Národné obrodenie na Slovensku je spojené s:',a:0,opts:['Bernolákom (prvá kodifikácia) a Štúrom','Kollárom a Šafárikom — ale bez kodifikácie','Iba s náboženskými hnutiami','Iba s politickým bojom bez jazykovej otázky'],exp:'Bernolák 1787: prvá kodifikácia (záp. slovenčina). Štúr 1843: druhá kodifikácia (stredoslov.) — základ dnešnej slovenčiny.'},
  {q:'Revolúcia 1848–1849 na Slovensku znamenala:',a:2,opts:['Úplnú nezávislosť Slovenska','Víťazstvo slovenského národného hnutia','Slovenské žiadosti (Slovenské národné','Vznik Rakúsko-Uhorska'],exp:'Slovenské žiadosti 1848: autonómia, slovenčina v školách. Potlačené. Rakúsko-Uhorsko vzniklo 1867 — nové pomaďarčovanie.'},
  {q:'Zánik Rakúsko-Uhorska (1918) umožnil:',a:3,opts:['Vznik samostatného Uhorska','Vznik Sovietskeho zväzu','Obnovenie Poľského kráľovstva','Vznik Československa (28. október 1918)'],exp:'Koniec 1. sv. vojny + rozpad R-U → 28.10.1918 Czechoslovakia. Masaryk, Štefánik, Beneš.'},
]);

addQ(2,'m','bio',[
  {q:'Mendelove zákony dedičnosti — zákon segregácie hovorí:',a:0,opts:['Alely sa od seba oddelia pri tvorbe gamét','Vlastnosti sa miešajú a nemôžu sa oddeliť','Dominantná alela vždy potlačí recesívnu','Gény sa dedia vždy spoločne'],exp:'2. Mendelov zákon: pri meióze sa homologické alely oddelia → každá gameta dostane len jednu alelu z páru.'},
  {q:'Hardy-Weinbergova rovnováha platí keď:',a:1,opts:['V populácii prebieha prirodzený výber','Nie je mutácia, migrácia, selekcia,','Populácia je malá','Dochádza k intenzívnemu kríženiu'],exp:'H-W: alel. frekvencie stabilné ak: veľká populácia, náhodné párenie, bez mutácie/migrácie/selekcie/driftu.'},
  {q:'Onkogény a tumor supresorové gény:',a:2,opts:['Sú totožné gény s rovnakou funkciou','Onkogény zastavujú delenie, supresorové ho spúšťajú','Onkogény spúšťajú nekontrolované delenie, supresorové ho','Oba spôsobujú apoptózu'],exp:'Onkogény (mutované proto-onkogény): spúšťajú delenie. Tumor supresorové (napr. p53): brzdia delenie. Mutácia → rakovina.'},
  {q:'Nervový impulz sa prenáša cez synapsiu:',a:3,opts:['Priamo elektrickým prúdom vždy','Iba spätnou väzbou','Priamo iónmi cez kanáliky','Neurotransmitermi (chemicky) alebo'],exp:'Chemická synapsia: akčný potenciál → uvoľnenie neurotransmiterov → väzba na receptory postsynaptickej membrány.'},
  {q:'Homeostáza je:',a:1,opts:['Rovnováha ekosystémov v prírode','Udržiavanie stáleho vnútorného prostredia','Adaptácia na zmenu prostredia','Rovnováha medzi predátorom a korisťou'],exp:'Homeostáza: regulácia telesnej teploty, pH, glukózy, osmotického tlaku. Negatívna spätná väzba.'},
  {q:'Endosymbiotická teória vysvetľuje:',a:0,opts:['Vznik mitochondrií a','Vznik vírusov z baktérií','Vznik eukaryotov z vírusov','Vznik bunkovej steny'],exp:'Lynn Margulis: mitochondrie (α-proteobaktérie) a chloroplasty (cyanobaktérie) boli pohltenné a stali sa organelami.'},
  {q:'CRISPR-Cas9 je technológia na:',a:2,opts:['Sekvenovanie DNA','Klonovanie organizmov','Editáciu génov','Výrobu proteínov v baktériách'],exp:'CRISPR-Cas9: molekulárne nožnice. Cas9 strihá DNA na presnom mieste podľa RNA sprievodcu. Nobel 2020.'},
  {q:'Apoptóza je:',a:3,opts:['Nekontrolované odumieranie buniek pri zranení','Delenie buniek pri raste','Fúzia buniek pri oplodnení','Programovaná bunková smrť — kontrolovaný proces'],exp:'Apoptóza: programovaná smrť. Bunka sa rozloží na vezikuly, fagocytuje sa. Nevyvoláva zápal. Kaspázy.'},
]);

addQ(2,'m','che',[
  {q:'Kvantové čísla elektrónu — hlavné kvantové číslo n určuje:',a:0,opts:['Energetickú hladinu a veľkosť','Tvar orbitálu','Orientáciu orbitálu v priestore','Spin elektrónu'],exp:'n = 1,2,3... — energetická hladina (vrstva). l = tvar (s,p,d,f). mₗ = orientácia. mₛ = spin.'},
  {q:'Hybridizácia sp³ uhlíka je charakteristická pre:',a:1,opts:['Etén (dvojná väzba)','Metán — tetraédrické usporiadanie','Etín (trojná väzba)','Benzén (aromatický)'],exp:'sp³: 4 hybridné orbitály → tetraéder. Metán CH₄, uhol 109,5°. sp²: etén, 120°. sp: etín, 180°.'},
  {q:'Aktivačná energia reakcie sa dá znížiť:',a:2,opts:['Zvýšením teploty','Zvýšením tlaku','Katalyzátorom','Zvýšením koncentrácie reaktantov'],exp:'Katalyzátor: znižuje aktivačnú energiu poskytnutím alternatívnej reakčnej cesty. Sám sa nespotrebuje.'},
  {q:'Chemická rovnováha sa posunie doprava pri:',a:3,opts:['Zvýšení koncentrácie produktov','Znížení teploty (ak je reakcia exotermická)','Pridaní katalyzátora','Zvýšení koncentrácie reaktantov (Le Chatelier)'],exp:'Le Chatelier: zvýšenie [reaktantov] → rovnováha sa posúva doprava k produktom.'},
  {q:'Elektrónová konfigurácia Fe (26) je:',a:1,opts:['[Ar] 3d⁸','[Ar] 3d⁶ 4s²','[Ar] 4s² 4p⁶','[Ar] 3d¹⁰ 4s²'],exp:'Fe: [Ar] 3d⁶ 4s². Prechodné kovy: plnia 3d pred 4s pri ionizácii → Fe²⁺: [Ar] 3d⁶, Fe³⁺: [Ar] 3d⁵.'},
  {q:'Sacharóza (repný cukor) je:',a:0,opts:['Disacharid glukózy a fruktózy','Monosacharid','Polysacharid','Disacharid dvoch molekúl glukózy'],exp:'Sacharóza: C₁₂H₂₂O₁₁. Glukóza + fruktóza. Hydrolýzou vznikne invertný cukor (med).'},
  {q:'Peptidová väzba spája:',a:2,opts:['Nukleotidy v DNA','Lipidy v membráne','Aminokyseliny v proteíne (—CO—NH—)','Monosacharidy v polysacharide'],exp:'Peptidová väzba: —C(=O)—NH— medzi karboxylovou skupinou jednej a aminoskupinou druhej aminokyseliny.'},
  {q:'pH pufrovaného roztoku závisí od:',a:3,opts:['Iba od koncentrácie kyseliny','Iba od koncentrácie bázy','Od teploty roztoku','Pomeru koncentrácií kyseliny a'],exp:'Henderson-Hasselbalch: pH = pKa + log([A⁻]/[HA]). Puffer odoláva zmenám pH.'},
]);

addQ(2,'m','fyz',[
  {q:'Špeciálna teória relativity (Einstein 1905) tvrdí:',a:0,opts:['Rýchlosť svetla je konštantná pre všetkých','Rýchlosť svetla závisí od rýchlosti zdroja','Hmotnosť je absolútna a nezávislá od rýchlosti','Priestor je absolútny a nemenný'],exp:'STR: c = konšt. Dôsledky: dilatácia času, kontrakcia dĺžky, E=mc². Galileiho transformácie nahradené Lorentzovými.'},
  {q:'Heisenbergov princíp neurčitosti hovorí:',a:1,opts:['Elektróny nemajú presné polohy','Δx·Δp ≥ ℏ/2','Kvantové stavy sú vždy neurčité','Meranie nemení systém'],exp:'Heisenberg (1927): Δx·Δp ≥ ℏ/2. Čím presnejšie vieme polohu, tým menej vieme hybnosť. Nie je to chyba merania.'},
  {q:'Planckov zákon žiarenia tela hovorí, že energia fotónu:',a:2,opts:['E = hf²','E = mc²','E = hf','E = ½mv²'],exp:'Planck (1900): E = hf. Energia sa emituje po kvantách. Riešenie katastrofy ultrafialového žiarenia.'},
  {q:'Tunelový jav v kvantovej fyzike znamená:',a:3,opts:['Pohyb elektrónov v tuneloch','Prechod svetla cez nepriehľadné materiály','Reflexia vĺn v rezonátoroch','Prechod častice cez energetickú bariéru aj bez'],exp:'Tunelovanie: vlnová funkcia preniká cez bariéru. Základ: skenovací tunelový mikroskop, alfa-rozpad, tunelové diódy.'},
  {q:'Boseho-Einsteinov kondenzát nastáva pri:',a:1,opts:['Vysokých teplotách a tlakoch','Extrémne nízkych teplotách','Jadrovej štiepnej reakcii','Fotoionizácii plynov'],exp:'BEC (1995, Cornell, Wieman): pri T → 0 bosóny sa správajú ako jedna kvantová entita. Nový stav hmoty.'},
  {q:'Čierna diera je objekt kde:',a:0,opts:['Úniková rýchlosť','Hmotnosť je nulová','Žiarenie je maximálne','Čas stojí úplne'],exp:'Schwarzschild polomer: r_s = 2GM/c². Vnútri horizontu udalostí úniková rýchlosť > c → nič neujde.'},
  {q:'Štandardný model fyziky popisuje:',a:2,opts:['Iba gravitáciu a elektromagnetizmus','Iba atómové jadrá','Fundamentálne častice a tri zo štyroch základných síl','Všetky štyri základné sily vrátane gravitácie'],exp:'Štandardný model: kvarky, leptóny, bozóny. Silná, slabá, elektromagnetická sila. Gravitácia nie je zahrnutá.'},
  {q:'Hawkingovo žiarenie predpovedá, že čierne diery:',a:3,opts:['Rastú donekonečna','Sú úplne čierne bez akéhokoľvek žiarenia','Explodujú okamžite','Pomaly vyžarujú a evaporujú'],exp:'Hawking (1974): kvantové fluktuácie pri horizonte → virtuálne páry → jedna častica unikne. Čierna diera stráca hmotu.'},
]);

addQ(2,'m','ang',[
  {q:'Identify the error: "He insisted on to go alone."',a:0,opts:['"to go" should be "going"','No error','Insist should be insisted','Alone is incorrect'],exp:'Insist on + gerund: "He insisted on going alone." Verbs after prepositions always take -ing form.'},
  {q:'Which is grammatically correct?',a:1,opts:['"I wish I can help you."','"I wish I could help you."','"I wish I will help you."','"I wish I am helping you."'],exp:'Wish + past simple (unreal present): "I wish I could." Wish + past perfect (unreal past): "I wish I had known."'},
  {q:'"The book, ___ was written in 1984, is a classic."',a:2,opts:['that','which it','which','who'],exp:'Non-defining relative clause: "which" (not "that"). Commas = non-defining = adds info, not essential.'},
  {q:'Preložte: Keby som bol vedel, nebol by som prišiel.',a:3,opts:['"If I knew, I would not come."','"If I had known, I will not come."','"If I know, I would not have come."','"If I had known, I would not have come."'],exp:'3rd conditional: If + past perfect, would have + past participle. Nereálna podmienka v minulosti.'},
  {q:'"No sooner ___ than it started raining."',a:1,opts:['we left','had we left','we had left','did we leave'],exp:'No sooner + inversion (had we left). No sooner...than / Hardly...when = inverted past perfect.'},
  {q:'The word "sophisticated" most closely means:',a:0,opts:['complex and refined','simple and basic','old-fashioned','aggressive'],exp:'Sophisticated: komplexný, rafinovaný, svetaznalý. "A sophisticated argument" = premyslený, nie jednoduchý.'},
  {q:'"She had her car ___ yesterday."',a:2,opts:['repair','repaired it','repaired','repairing'],exp:'Causative have: have + object + past participle. "She had her car repaired" = dala si opraviť auto (iným).'},
  {q:'Which word has a negative prefix?',a:3,opts:['disagree (dis- = opposite)','unhappy (un- = not)','impossible (im- = not)','All of the above are negative'],exp:'Negative prefixes: un- (unhappy), dis- (disagree), im-/in-/ir-/il- (impossible/incorrect/irregular/illegal).'},
]);

// ═══════════════════════════════════════════
// 3. ROČNÍK — EDUCAST free
// ═══════════════════════════════════════════
addQ(3,'r','slj',[
  {q:'Štylistika skúma:',a:1,opts:['Stavbu viet','Výber a','Hláskoslovie','Tvorenie slov'],exp:'Štylistika: náuka o štýle — výber vhodných jazykových prostriedkov pre daný komunikačný zámer.'},
  {q:'Funkčné štýly sú:',a:2,opts:['Iba umelecký a hovorový','Iba publicistický a vedecký','Hovorový, umelecký, vedecký,','Iba písomné štýly'],exp:'6 funkčných štýlov: hovorový, umelecký, vedecký, publicistický, administratívny, rečnícky.'},
  {q:'Rétorika je umenie:',a:0,opts:['Presvedčivého verejného prejavu','Písania románov','Skladania básní','Tvorenia nových slov'],exp:'Rétorika: umenie verejného prejavu. Antika: Cicero, Démostenés.'},
  {q:'Epifora je opakovanie:',a:3,opts:['Na začiatku veršov','Uprostred veršov','Slov v celej básni','Na konci veršov alebo viet'],exp:'Epifora: opakovanie na konci. Anafora: opakovanie na začiatku.'},
  {q:'Slovenský spisovný jazyk bol kodifikovaný Štúrom v roku:',a:1,opts:['1800','1843','1918','1780'],exp:'Ľudovít Štúr kodifikoval slovenčinu v roku 1843 na základe stredoslovenského nárečia.'},
  {q:'Publicistický štýl je typický pre:',a:2,opts:['Vedecké práce','Rozprávky','Noviny, časopisy, správy','Súkromné listy'],exp:'Publicistický štýl: médiá, noviny, správy. Cieľ: informovať, presvedčiť, zaujať.'},
  {q:'Metonymia je:',a:0,opts:['Prenos pomenovania na základe','Prenos na základe podobnosti','Prirovnanie','Opakovanie hlások'],exp:'Metonymia: prenos na základe vecnej (nie podobnostnej) súvislosti. Prečítal som Hviezdoslava (= jeho diela).'},
  {q:'Čo je elipsa v jazykovede?',a:3,opts:['Dlhá veta','Opakovanie slov','Zdvojenie vety','Vynechanie'],exp:'Elipsa: vynechanie časti vety. "Ja pôjdem domov, ty (pôjdeš) do školy."'},
]);

addQ(3,'r','lit',[
  {q:'Romantizmus vznikol ako reakcia na:',a:0,opts:['Chladný rozum klasicizmu','Renesančný humanizmus','Baroko','Stredovekú scholastiku'],exp:'Romantizmus (koniec 18. – 19. stor.): protest proti osvietenskému racionalizmu, dôraz na cit a individualitu.'},
  {q:'Romantický hrdina je typicky:',a:2,opts:['Šťastný a spokojný','Priemerný a tichý','Výnimočný, osamelý,','Poslušný a zbožný'],exp:'Romantický hrdina: výnimočná individualita, osamelý rebel, konflikt so spoločnosťou.'},
  {q:'Ján Kollár je autorom diela:',a:1,opts:['Mor ho!','Slávy dcera','Detvan','Žalár jazmínový'],exp:'Ján Kollár: Slávy dcera (1824) — sonetový veniec, idea slovanskej vzájomnosti.'},
  {q:'Realizmus zobrazuje skutočnosť:',a:3,opts:['Idealizovane','Symbolicky','Fantasticky','Objektívne a'],exp:'Realizmus (19. stor.): verné zobrazenie skutočnosti vrátane jej negatívnych stránok.'},
  {q:'Pavol Országh Hviezdoslav je:',a:0,opts:['Najvýznamnejší slovenský','Barokový básnik','Renesančný dramatik','Surrealistický prozaik'],exp:'Hviezdoslav: vrcholný predstaviteľ slovenského literárneho realizmu.'},
  {q:'Martin Kukučín napísal:',a:2,opts:['Mor ho!','Slávy dcera','Dom v stráni','Detvan'],exp:'Martin Kukučín: Dom v stráni — realistický román zo slovenského prostredia.'},
  {q:'Novela sa od románu líši:',a:1,opts:['Väčším počtom postáv','Menším rozsahom a','Absenciou dialógov','Poetickým jazykom'],exp:'Novela: kratšia próza, menej postáv, jedna dejová línia, pointovaný záver.'},
  {q:'Symbolizmus pracuje s:',a:3,opts:['Priamym opisom','Vedeckými faktmi','Historickými udalosťami','Symbolmi a náznakmi'],exp:'Symbolizmus: symboly vyjadrujú pocity a idey nepriamo. Baudelaire, Verlaine.'},
]);

addQ(3,'r','mat',[
  {q:'Kombinatorika — počet permutácií n prvkov je:',a:0,opts:['n!','n² ','2ⁿ','n/2'],exp:'Permutácie: n! = n×(n-1)×...×2×1. Počet usporiadaní n rôznych prvkov.'},
  {q:'Počet kombinácií C(n,k) vyberám k z n bez opakovania:',a:2,opts:['n!','n×k','n!/(k!(n-k)!)','nᵏ'],exp:'C(n,k) = n! / (k! · (n-k)!). Nezáleží na poradí.'},
  {q:'Sinus (sin) 30° =',a:1,opts:['√3/2','1/2','1','0'],exp:'sin 30° = 1/2. sin 60° = √3/2. sin 90° = 1.'},
  {q:'Kosínusová veta: c² =',a:3,opts:['a² + b²','a + b + c','a² - b²','a² + b² - 2ab·cos(γ)'],exp:'Kosínusová veta: c² = a² + b² - 2ab·cos(γ). Zovšeobecnenie Pytagora.'},
  {q:'Pravdepodobnosť P(A) je vždy:',a:0,opts:['Medzi 0 a 1 vrátane','Väčšia ako 1','Záporná','Presne 0.5'],exp:'P(A) ∈ ⟨0,1⟩. P = 0: nemožná udalosť. P = 1: istá udalosť.'},
  {q:'Geometrický priemer dvoch čísel a a b je:',a:2,opts:['(a+b)/2','a·b','√(a·b)','(a-b)/2'],exp:'Geometrický priemer: √(a·b). Používa sa napr. pri priemernom raste.'},
  {q:'Exponenciálna funkcia y = aˣ (a>1) je:',a:1,opts:['Klesajúca','Rastúca a vždy kladná','Konštantná','Záporná pre x<0'],exp:'y = aˣ pre a>1: rastúca, vždy kladná (y>0). Prechádza bodom (0,1).'},
  {q:'Derivácia funkcie vyjadruje:',a:3,opts:['Plochu pod grafom','Hodnotu funkcie','Nuly funkcie','Okamžitú rýchlosť'],exp:'Derivácia - okamžitá rýchlosť zmeny. Smernica dotyčnice.'},
]);

addQ(3,'r','dej',[
  {q:'Francúzska revolúcia začala v roku:',a:1,opts:['1776','1789','1815','1848'],exp:'Francúzska revolúcia: 1789 – 1799. Heslo: Liberté, Égalité, Fraternité.'},
  {q:'Priemyselná revolúcia začala v:',a:2,opts:['Francúzsku','USA','Anglicku','Nemecku'],exp:'Priemyselná revolúcia: Anglicko, 2. polovica 18. stor. Parný stroj, textilný priemysel.'},
  {q:'Napoleon Bonaparte bol porazený pri:',a:0,opts:['Waterloo (1815)','Austerlitz','Trafalgar','Moskve'],exp:'Napoleon definitívne porazený pri Waterloo (1815). Potom vyhnanstvo na Sv. Helenu.'},
  {q:'Rakúsko-Uhorsko vzniklo v roku:',a:3,opts:['1848','1815','1900','1867'],exp:'Rakúsko-Uhorsko: 1867 — Ausgleich (vyrovnanie) medzi Rakúskom a Uhorskom.'},
  {q:'Prvá svetová vojna trvala:',a:1,opts:['1900–1910','1914–1918','1939–1945','1912–1916'],exp:'1. svetová vojna: 1914–1918. Záminka: atentát na Františka Ferdinanda v Sarajeve.'},
  {q:'Slovenský štát (1939–1945) bol:',a:2,opts:['Demokratická republika','Komunistický štát','Klerofašistický štát pod vplyvom','Samostatná demokratická monarchia'],exp:'Slovenský štát 1939–1945: Tiso, klerofašizmus, závislosť od Hitlerovho Nemecka.'},
  {q:'Slovenské národné povstanie bolo v roku:',a:0,opts:['1944','1938','1948','1968'],exp:'SNP: august 1944. Ozbrojenú povstanie proti nacistickej okupácii a Tisovmu režimu.'},
  {q:'Február 1948 v Československu znamenal:',a:3,opts:['Oslobodenie od nacizmu','Vznik Česko-Slovenska','Vstup do NATO','Komunistický prevrat'],exp:'Február 1948: KSČ prevzala moc. Začiatok komunistickej diktatúry v ČSR.'},
]);

addQ(3,'r','bio',[
  {q:'Genetika skúma:',a:0,opts:['Dedičnosť a','Správanie živočíchov','Stavbu bunky','Fotosyntézu'],exp:'Genetika: náuka o dedičnosti (prenos znakov z rodičov na potomkov) a premenlivosti.'},
  {q:'DNA sa skladá zo:',a:2,opts:['Aminokyselín','Mastných kyselín','Nukleotidov','Glukózy'],exp:'DNA: polynukleotidový reťazec. Nukleotid = fosfát + deoxyribóza + báza (A,T,G,C).'},
  {q:'Mendel skúmal dedičnosť na:',a:1,opts:['Ovociach mušiach','Hrachu (Pisum sativum)','Kukurici','Myšiach'],exp:'Gregor Mendel: experimenty s hrachom v kláštore v Brne. Objavil zákony dedičnosti.'},
  {q:'Dominantný znak sa prejaví:',a:3,opts:['Iba u homozygotov','Nikdy','Iba u samičiek','Aj pri jednej kópii'],exp:'Dominantný alel: prejaví sa aj pri genotype Aa. Recesívny: iba pri aa.'},
  {q:'Evolúcia podľa Darwina je poháňaná:',a:0,opts:['Prírodným výberom','Božou vôľou','Mutáciami bez výberu','Lamarckizmom'],exp:'Darwin (1859): prírodný výber — prežijú jedinci najlepšie prispôsobení prostrediu.'},
  {q:'Ekológia skúma:',a:2,opts:['Stavbu bunky','Dedičnosť','Vzťahy medzi','Fyziológiu rastlín'],exp:'Ekológia: vzťahy organizmov navzájom a s neživým prostredím.'},
  {q:'Potravová pyramída — na vrchole sú:',a:1,opts:['Producenti','Vrcholoví predátori','Rozkladači','Bylinožravce'],exp:'Vrchol potravovej pyramídy: vrcholoví predátori (vlk, orol, žralok). Najmenej energie.'},
  {q:'Fotosyntéza prebieha v:',a:3,opts:['Mitochondriách','Ribozómoch','Bunkovom jadre','Chloroplastoch'],exp:'Fotosyntéza: chloroplasty. Dýchanie: mitochondrie. Syntéza bielkovín: ribozómy.'},
]);

addQ(3,'r','che',[
  {q:'Alkoholy obsahujú skupinu:',a:0,opts:['-OH (hydroxylová)','–COOH (karboxylová)','–NH₂ (aminová)','–CHO (aldehydová)'],exp:'Alkoholy: obsahujú -OH skupinu. Etanol C₂H₅OH, metanol CH₃OH.'},
  {q:'Karboxylové kyseliny obsahujú skupinu:',a:2,opts:['-OH','–NH₂','–COOH','–CHO'],exp:'Karboxylové kyseliny: –COOH. Octová kyselina CH₃COOH, mravčia HCOOH.'},
  {q:'Esterifikácia je reakcia:',a:1,opts:['Kyseliny s kovom','Alkoholu s kyselinou','Zásady s kyselinou','Oxidácia alkoholu'],exp:'Esterifikácia: alkohol + kyselina → ester + voda. Estery: vôňa ovocia, tuky.'},
  {q:'Benzén C₆H₆ je:',a:3,opts:['Alkán','Alkohol','Ketón','Aromatický uhľovodík s cyklickým systémom'],exp:'Benzén: aromatický uhľovodík. Kekuléova štruktúra: striedanie jednoduchých a dvojitých väzieb.'},
  {q:'Bielkoviny sú polyméry:',a:0,opts:['Aminokyselín','Cukrov','Nukleotidov','Mastných kyselín'],exp:'Bielkoviny (proteíny): polyméry aminokyselín spojené peptidovou väzbou.'},
  {q:'pH žalúdočnej kyseliny je približne:',a:2,opts:['7','11','2','9'],exp:'Žalúdočná kyselina (HCl): pH 1–3. Silná kyselina potrebná na trávenie.'},
  {q:'Saponifikácia je:',a:1,opts:['Výroba alkoholu','Zmydelnenie tukov','Oxidácia uhľovodíkov','Syntéza plastov'],exp:'Saponifikácia: tuk + NaOH → mydlo + glycerol. Mydlo = sodná soľ mastnej kyseliny.'},
  {q:'Polimér vzniká:',a:3,opts:['Oxidáciou monomérov','Redukciou','Neutralizáciou','Polymerizáciou'],exp:'Polimér: dlhý reťazec monomérov. Polyetylén, nylon, škrob, DNA.'},
]);

addQ(3,'r','fyz',[
  {q:'Optika skúma:',a:0,opts:['Vlastnosti a šírenie svetla','Zvukové vlny','Elektrický prúd','Atómové jadrá'],exp:'Optika: šírenie svetla, odraz, lom, difrakcia, interferencia.'},
  {q:'Zákon odrazu: uhol dopadu =',a:2,opts:['Uhol lomu','Nula','Uhol odrazu','90°'],exp:'Zákon odrazu: uhol dopadu = uhol odrazu. Oba sa merajú od kolmice k povrchu.'},
  {q:'Svetlo sa vo vode láme:',a:1,opts:['Rovnako ako vo vzduchu','Smerom ku kolmici (spomalí sa)','Od kolmice','Vráti sa späť'],exp:'Lom svetla: z riedkeho do hustého prostredia → smerom ku kolmici. Index lomu.'},
  {q:'Konvexná šošovka (spojka):',a:3,opts:['Rozptyľuje svetlo','Nemení smer lúčov','Absorbuje svetlo','Zbieha rovnobežné'],exp:'Konvexná (spojná) šošovka: zbiera lúče do ohniska. Používa sa pri ďalekozrakosti.'},
  {q:'Dopplerov jav: ak sa zdroj zvuku približuje, frekvencia:',a:0,opts:['Rastie (vyšší tón)','Klesá','Zostáva rovnaká','Závisí len od hlasitosti'],exp:'Dopplerov jav: aproximácia zdroja → vyššia frekvencia. Vzdiaľovanie → nižšia frekvencia.'},
  {q:'Radioaktivita je:',a:2,opts:['Svetelné žiarenie','Zvukové vlnenie','Samovoľný rozpad','Elektrický jav'],exp:'Radioaktivita: α, β, γ žiarenie. Objavila Marie Curie.'},
  {q:'Špeciálna teória relativity tvrdí že:',a:1,opts:['Čas je absolútny','Rýchlosť svetla je','Energia sa neuchováva','Hmotnosť je konštantná'],exp:'Einstein 1905: c = konšt. Dôsledky: spomalenie času, skrátenie dĺžok, E=mc².'},
  {q:'Energia fotónu závisí od:',a:3,opts:['Intenzity svetla','Rýchlosti svetla','Amplitúdy vlny','Frekvencie (E = hf)'],exp:'E = hf. h = Planckova konštanta. Vyššia frekvencia = energetickejší fotón.'},
]);

addQ(3,'r','ang',[
  {q:'Vyber správny tvar: By the time she arrived, he ___ already left.',a:0,opts:['Had already left','Already left','Has already left','Already leaves'],exp:'Past Perfect: dej, ktorý sa skončil PRED iným minulým dejom. Had + past participle.'},
  {q:'Preložte: Nemal by si to robiť.',a:2,opts:['You must not do this.','You should do this.','You should not do this.','You do not have to do this.'],exp:'Should not = nemal by si. Must not = nesmieš (silnejší zákaz).'},
  {q:'"Provided that" znamená:',a:1,opts:['Napriek tomu','Za predpokladu, že','Preto','Hoci'],exp:'"Provided that" = za predpokladu, že (podmienka). = "as long as".'},
  {q:'Gerundium sa používa po:',a:3,opts:['Modálnych slovesách','Väčšine prídavných mien','Predložkách "to"','Niektorých slovesách'],exp:'Gerundium (-ing): po enjoy, avoid, finish, mind, consider, deny.'},
  {q:'I wish I ___ speak French.',a:0,opts:['Could','Can','Will','Am'],exp:'"I wish + could/would/past": nereálne želanie. I wish I could speak French = Keby som len vedel.'},
  {q:'Preložte: Čím skôr odídeme, tým lepšie.',a:2,opts:['Earlier we leave, better it is.','The sooner leave, the better.','The sooner we leave, the better.','Sooner we leave, better.'],exp:'"The sooner... the better": porovnávacia štruktúra s the+komparatív.'},
  {q:'Slovo "albeit" znamená:',a:1,opts:['Preto','Hoci, aj keď (formálne)','Navyše','Teda'],exp:'"Albeit" = hoci, aj keď. Formálne/literárne. Albeit slowly, he improved.'},
  {q:'Inversion (inverzia) sa používa:',a:3,opts:['V každej vete','Iba v otázkach','Iba v minulom čase','Po negatívnych'],exp:'Inversion: Never have I seen... Hardly had she left... — literárny/formálny štýl.'},
]);


// ═══════════════════════════════════════════
// 3. ROČNÍK — EDUCAST PLUS (VÝZVA + MASTER)
// ═══════════════════════════════════════════

// ── 3R VÝZVA ──
addQ(3,'v','slj',[
  {q:'Čo je elipsa v syntaxi?',a:0,opts:['Vynechanie vetného člena zrozumiteľného','Opakujúce sa slovo na začiatku viet','Obrátené poradie vetných členov','Zámerné prerušenie vety'],exp:'Elipsa: vynechanie vetného člena, ktorý je zrejmý z kontextu. "Ja idem domov a ty?" — vynechané "ideš domov".'},
  {q:'Anafora ako štylistická figúra je:',a:1,opts:['Zámerné odmlčanie sa vo vete','Opakovanie slova/skupiny slov na','Opakovanie na konci viet','Inverzia vetných členov'],exp:'Anafora: "Kto za pravdu horí, kto za pravdu stojí..." Opak anafor = epifora (opakovanie na konci).'},
  {q:'Rétorika skúma:',a:2,opts:['Gramatiku hovorených prejavov','Históriu slovenského jazyka','Umenie presvedčivého a účinného','Dialekty a nárečia'],exp:'Rétorika: náuka o verejnom prejave. Aristotelove tri piliere: ethos, logos, pathos.'},
  {q:'Slohový útvar fejeton je charakteristický:',a:3,opts:['Objektívnosťou a faktickosťou','Strohosťou a stručnosťou','Vedeckou argumentáciou','Subjektívnosťou, iróniou a hravosťou'],exp:'Fejeton: publicistický útvar. Subjektívny, ironický, hravý pohľad na aktuálne témy. Autor sa nestráca za faktami.'},
  {q:'Čo je paronymia?',a:0,opts:['Zvuková podobnosť slov s rôznym významom','Slová rovnakého zvuku a rôzneho významu','Slová rovnakého významu','Slová opačného významu'],exp:'Paronymá: zvukovo podobné slová, ľahko zameniteľné. objav (discovery) vs. objev (tour). Zdroj jazykových chýb.'},
  {q:'Administratívny štýl sa vyznačuje:',a:1,opts:['Obraznosťou a subjektívnosťou','Ustálenými formuláciami, presnosťou,','Hovorovosťou a expresivitou','Odbornou terminológiou s vysvetleniami'],exp:'Admin. štýl: úradné dokumenty, zmluvy, zákony. Presnosť, jednoznačnosť, neosobnosť, ustálené formulácie.'},
  {q:'Syllogizmus je:',a:2,opts:['Básnická figúra opakovania','Druh metafory','Logický úsudok z dvoch premís','Ironická výpoveď'],exp:'Syllogizmus: "Všetci ľudia sú smrteľní. Sokrates je človek. → Sokrates je smrteľný." Deduktívne uvažovanie.'},
  {q:'Čo odlišuje memoáre od denníka?',a:3,opts:['Memoáre sú kratšie','Denník opisuje len šťastné udalosti','Memoáre sú vymyslené','Memoáre sú retrospektívne, denník je'],exp:'Denník: každodenný záznam prítomnosti. Memoáre: retrospektívne spomienky s nadhľadom a hodnotením.'},
]);

addQ(3,'v','lit',[
  {q:'Romantizmus ako literárny smer kladie dôraz na:',a:0,opts:['Cit, individualitu, prírodu, vzdor','Rozum, poriadok, mravné pravidlá','Sociálnu kritiku a realizmus','Náboženskú mystiku a vanitas'],exp:'Romantizmus: subjekt, emócie, príroda ako zrkadlo duše, rebel, titánizmus, exotika, história.'},
  {q:'Byronský hrdina je charakteristický:',a:1,opts:['Pokorou a oddanosťou spoločnosti','Vzburou, tajomnosťou, vnútorným','Hrdinstvom v boji za vlasť','Veselosťou a optimizmom'],exp:'Byronský hrdina (Lord Byron): rebel, tajomný, smutný, nesmierliteľný s konvenciami. Childe Harold, Don Juan.'},
  {q:'Ján Kollár — Slávy dcera patrí k:',a:2,opts:['Baroku','Klasicizmu','Romantizmu','Realizmu'],exp:'Kollár (1824): Slávy dcera — sonetový veniec, myšlienka slovanskej vzájomnosti. Romantizmus.'},
  {q:'Realizmus v literatúre sa sústredí na:',a:3,opts:['Subjektívne city a prírodu','Idealizované hrdinstvo','Náboženskú tematiku','Objektívne zobrazenie'],exp:'Realizmus: verné zobrazenie spoločnosti, typický hrdina v typickom prostredí (Balzac, Tolstoj, Turgenev).'},
  {q:'Janko Kráľ je romantický básnik, ktorý:',a:1,opts:['Písal realistické romány','Splýval so slovenskou prírodou,','Kodifikoval slovenský jazyk','Písal historické drámy'],exp:'Kráľ: najromantickejší zo štúrovcov. Buričstvo, demonizmus, splývanie s prírodou. Básne: Skamenelý, Zverbovaný.'},
  {q:'Naturalizmus sa odlišuje od realizmu:',a:0,opts:['Biologickým determinizmom','Pozornosťou na city a vnútorný svet','Väčším optimizmom','Historickou tematikou'],exp:'Naturalizmus (Zola): vedecký prístup. Dedičnosť + sociálne prostredie = determinizmus. Série Rougon-Macquart.'},
  {q:'Slovenský realizmus je spojený s:',a:2,opts:['Jánom Hollým a Jánom Kollárom','Ľudovítom Štúrom a Jánkom Kráľom','Svetozárom Hurbanom Vajanským,','Ivanom Kraskom a Vladimírom Royom'],exp:'Slovenský realizmus: Vajanský, Kukučín (Rysavá jalovica, Dom v stráni), Timrava (Ťapákovci), Záborský.'},
  {q:'Impresionizmus v literatúre zachytáva:',a:3,opts:['Sociálne konflikty','Historické udalosti','Vedecké poznatky','Okamžité dojmy,'],exp:'Literárny impresionizmus: zachytenie momentálneho dojmu, atmosféry, nálady. Fragmentárnosť, zmyslovosť.'},
]);

addQ(3,'v','mat',[
  {q:'Derivácia zložené funkcie f(g(x)) =',a:0,opts:["f'(g(x)) · g'(x)","f'(g(x)) + g'(x)","f'(x) · g'(x)","f(g'(x))"],exp:"Reťazové pravidlo: (f∘g)'(x) = f'(g(x)) · g'(x). Napr. (sin(x²))' = cos(x²) · 2x."},
  {q:'Integrál ∫sin(x)dx =',a:1,opts:['cos(x) + C','-cos(x) + C','sin(x) + C','-sin(x) + C'],exp:'∫sin(x)dx = -cos(x) + C. Kontrola: (-cos(x))′ = sin(x) ✓'},
  {q:'Konvergencia radu — alternujúci rad Σ(-1)ⁿ/n:',a:2,opts:['Diverguje','Konverguje absolútne','Konverguje podmienečne','Je neurčitý'],exp:'Leibnizovo kritérium: alternujúci rad konverguje ak |aₙ| klesá k 0. Σ(-1)ⁿ/n konverguje podmienečne (Σ1/n diverguje).'},
  {q:'Poissonova distribúcia popisuje:',a:3,opts:['Normálne rozloženie spojitej veličiny','Binomické pokusy s dvoma výsledkami','Rovnomerné rozloženie','Počet udalostí v časovom intervale pri'],exp:'Poisson: P(X=k) = λᵏe⁻λ/k!. Vhodná pre zriedkavé udalosti: počet chýb, príchody zákazníkov.'},
  {q:'Taylorov rad funkcie eˣ okolo x=0 je:',a:1,opts:['1 + x + x³/6 + ...','1 + x + x²/2! + x³/3! + ...','x + x²/2 + x³/3 + ...','1 - x + x²/2! - x³/3! + ...'],exp:'eˣ = Σxⁿ/n! = 1 + x + x²/2! + x³/3! + ... Konverguje pre všetky x ∈ ℝ.'},
  {q:'Stredná hodnota funkcie f na [a,b] je:',a:0,opts:['(1/(b-a))·∫ₐᵇf(x)dx','∫ₐᵇf(x)dx','f((a+b)/2)','(f(a)+f(b))/2'],exp:'Stredná hodnota: f̄ = (1/(b-a))·∫ₐᵇf(x)dx. Priemer hodnôt funkcie na intervale.'},
  {q:'Polárne súradnice bodu (r, φ) a kartézske sú viazané:',a:2,opts:['x = r/cos φ, y = r/sin φ','x = r + cos φ, y = r + sin φ','x = r·cos φ, y = r·sin φ','x = cos φ/r, y = sin φ/r'],exp:'x = r·cos φ, y = r·sin φ. Polárne súradnice: vzdialenosť r od počiatku a uhol φ od kladnej osi x.'},
  {q:'Fibonacciho postupnosť je definovaná ako:',a:3,opts:['aₙ = n²','aₙ = 2ⁿ','aₙ = aₙ₋₁ + n','aₙ = aₙ₋₁ +'],exp:'Fibonacci: 1,1,2,3,5,8,13,21... Každý člen je súčet dvoch predchádzajúcich. Zlatý rez φ = (1+√5)/2.'},
]);

addQ(3,'v','dej',[
  {q:'Prvá svetová vojna (1914–1918) začala:',a:0,opts:['Atentátom na Františka Ferdinanda','Napadnutím Poľska Nemeckom','Revolúciou v Rusku','Vypovedaním vojny Francúzska Nemecku'],exp:'28. júna 1914: Gavrilo Princip zastrelil následníka rakúskeho trónu v Sarajeve. Reťazová reakcia aliancií.'},
  {q:'Ruská revolúcia 1917 — boľševici prevzali moc:',a:1,opts:['Vo februári 1917 zvrhnutím cara','V októbri 1917 útokom na Zimný palác','V januári 1919 v Moskve','V marci 1918 po Brест-Litovskej mieri'],exp:'Február 1917: zvrhnutie cara. Október 1917: Leninovi boľševici prevzali moc od dočasnej vlády.'},
  {q:'Versailleská mierová zmluva (1919) uložila Nemecku:',a:2,opts:['Minimálne reparácie a zachovanie armády','Rozdelenie na dva štáty','Vojnovú vinu, reparácie, strata území a','Povinnosť vstúpiť do Spoločnosti národov'],exp:'Versailles: § 231 = "War Guilt Clause". Reparácie, strata Alsaska-Lotrinska, Poľského koridoru, armáda na 100 000.'},
  {q:'Vznik Československa (28.10.1918) bol výsledkom:',a:3,opts:['Vojenskej porážky Rakúska Ruskom','Revolúcie v Prahe','Rozhodnutia Viedne','Diplomatickej aktivity Masaryka,'],exp:'Masaryk: zahraničný odboj, Pittsburghská dohoda, Washington. Štefánik: légii. Beneš: diplomacia. 28.10.1918.'},
  {q:'Hospodárska kríza 1929 ("Veľká depresia") spustila:',a:1,opts:['Prvú svetovú vojnu','Krach na newyorskej','Ruskú revolúciu','Vznik nacizmu priamo'],exp:'Čierny štvrtok 24.10.1929: krach burzy na Wall Street. Domino efekt: bankroty, nezamestnanosť, politická nestabilita.'},
  {q:'Nástup Hitlera k moci (1933) bol legálny lebo:',a:0,opts:['NSDAP vyhrala voľby a Hindenburg vymenoval','Hitler uskutočnil úspešný puč','Weimarska republika ho zvolila priamo','Armáda mu odovzdala moc'],exp:'Hitler 30.1.1933: Hindenburg ho vymenoval za kancelára. Legálne, ale rýchlo nastolil diktatúru (Umožňovací zákon).'},
  {q:'Mníchovská dohoda (1938) dovolila:',a:2,opts:['Nemecku napadnúť Poľsko','Taliansku obsadiť Etiópiu','Nemecku anektovať Sudety bez súhlasu ČSR','ZSSR obsadiť pobaltské štáty'],exp:'Mníchov 29.9.1938: Chamberlain, Daladier, Mussolini, Hitler. Appeasement — "Mier na naše časy". ČSR nebola prizvaná.'},
  {q:'Slovenský štát (1939–1945) bol:',a:3,opts:['Demokratická republika','Súčasť Nemeckej ríše','Nezávislý neutrálny štát','Klerofašistický satelitný'],exp:'Slovenský štát: Tiso prezidentom, HSĽS. Deportácie Židov, spolupráca s nacistami, SNP 1944.'},
]);

addQ(3,'v','bio',[
  {q:'Fotosyntéza — svetelná fáza prebieha:',a:0,opts:['Na tylakoidných','V stróme chloroplastov','V mitochondriách','V cytoplazme'],exp:'Svetelná fáza: tylakoidy — fotosystémy I a II, elektrónový transport, syntéza ATP a NADPH, uvoľnenie O₂.'},
  {q:'Calvinov cyklus (tmavá fáza) fixuje:',a:1,opts:['O₂ na glukózu','CO₂ na glukózu','H₂O na kyslík','N₂ na aminokyseliny'],exp:'Calvinov cyklus: stróma chloroplastov. RuBisCO fixuje CO₂. 3 CO₂ → 1 G3P (triosafosfát) → glukóza.'},
  {q:'Genetický kód je degenerovaný, čo znamená:',a:2,opts:['Kód sa mení pri mutáciách','Každý kodón kóduje viac aminokyselín','Jedna aminokyselina môže byť kódovaná','Kód je rôzny v rôznych organizmoch'],exp:'Degenerácia: 64 kodónov, 20 aminokyselín → viac kodónov pre jednu aminokyselinu (synonymné kodóny).'},
  {q:'Nervová sústava cicavcov — sympatikus:',a:3,opts:['Spomaľuje srdce a stimuluje trávenie','Kontroluje reflexy miechy','Je zodpovedný za vedomé pohyby','Aktivuje "fight or flight"'],exp:'Sympatikus: adrenalín, stres. Parasympatikus: "rest and digest" — spomaľuje srdce, stimuluje trávenie.'},
  {q:'Evolucia podľa Darwina prebieha cez:',a:1,opts:['Zámerné prispôsobovanie sa organizmov','Prirodzený výber','Dedičnosť získaných vlastností (Lamarck)','Náhodné mutácie bez selekcie'],exp:'Darwin: variabilita + dedičnosť + prírodný výber = evolúcia. Prežijú tí najprispôsobenejší.'},
  {q:'Ekologická nika organizmu je:',a:0,opts:['Rola organizmu v ekosystéme vrátane','Fyzické miesto kde organizmus žije','Potravný reťazec organizmu','Územie na ktoré si organizmus nárokuje'],exp:'Ekologická nika: multidimenzionálna — čo jedia, kto ich je, kde žijú, kedy sú aktívni. Fundamentálna vs. realizovaná.'},
  {q:'Placentárne cicavce sa odlišujú od vačkovcov:',a:2,opts:['Teplokrvnosťou','Schopnosťou laktácie','Plne vyvinutým plodom','Väčšou veľkosťou mozgu'],exp:'Placentárne: placenta vyživuje plod počas dlhej gravidity. Vačkovce: krátka gravidita, vývoj v vačku.'},
  {q:'Proteíny dostávajú svoju 3D štruktúru vďaka:',a:3,opts:['Iba kovalentným väzbám','Iba vodíkovým väzbám','Iba hydrofóbnym interakciám','Kombinácie nekovalentných'],exp:'Proteínová štruktúra: vodíkové väzby (α-helix, β-skladaný list), hydrofóbny efekt, van der Waals, S-S mostíky.'},
]);

addQ(3,'v','che',[
  {q:'Aromatické zlúčeniny majú spoločné:',a:0,opts:['Kruhový systém so striedavými','Len jednoduché väzby v kruhu','Vždy šesťčlenný kruh','Reaktivitu s kyslíkom'],exp:'Hückelovo pravidlo: 4n+2 π elektrónov (n=0,1,2...). Benzén: 6 π elektrónov (n=1). Stabilný, ochotný na SE reakice.'},
  {q:'Aldehyd vs. ketón — rozdiel:',a:1,opts:['Aldehyd má dve karbonylové skupiny','Aldehyd má —CHO na konci reťazca, ketón','Ketón reaguje s Fehlingovým roztokom','Aldehyd je vždy plyn'],exp:'Aldehyd: R—CHO (na konci). Ketón: R—CO—R (uprostred). Aldehydy redukujú Fehlingov/Tollensov roztok.'},
  {q:'Esterifikácia je reakcia:',a:2,opts:['Kyseliny s bázou za vzniku soli','Alkénu s kyselinou','Karboxylovej kyseliny s alkoholom','Alkánu s halogénom'],exp:'RCOOH + R&#39;OH ⇌ RCOOR&#39; + H₂O. Kyselina octová + etanol → etylacetát + voda. Reverzibilná, katalýza H⁺.'},
  {q:'Saponifikácia (zmydľovanie) je:',a:3,opts:['Výroba kyselín z aldehydov','Hydrolýza amidov','Oxidácia alkoholov','Alkalická hydrolýza esterov'],exp:'Saponifikácia: tuk (triacylglycerol) + NaOH → mydlo (karboxylát sodný) + glycerol. Základ výroby mydla.'},
  {q:'Polycyklické aromatické uhľovodíky (napr. naftalén):',a:1,opts:['Sú vždy kvapaliny','Sú kondenzované','Nie sú aromatické','Sú len prírodné látky'],exp:'PAH: naftalén (2 kruhy), antracén (3), pyrén (4). Vznikajú pri neúplnom spaľovaní. Benzo[a]pyrén = karcinogén.'},
  {q:'Amfoterné látky môžu reagovať ako:',a:0,opts:['Kyselina aj báza (napr.','Iba oxidačné činidlo','Iba redukčné činidlo','Ani kyselina ani báza'],exp:'Amfotérne: H₂O (H₃O⁺ alebo OH⁻), Al(OH)₃, aminokyseliny (—NH₃⁺ alebo —COO⁻). Reagujú podľa prostredia.'},
  {q:'Nukleové kyseliny DNA a RNA sa líšia:',a:2,opts:['Len veľkosťou molekuly','Len tým, kde sa nachádzajú v bunke','Cukrom (deoxiribóza vs. ribóza), bázou','Len počtom reťazcov'],exp:'DNA: deoxiribóza, bázA/T/G/C, dvojvláknová. RNA: ribóza, bázA/U/G/C, jednoreťazcová (väčšinou).'},
  {q:'Koloidy sa od pravých roztokov odlišujú:',a:3,opts:['Chemickým zložením','Farbou','Skupenstvom','Veľkosťou'],exp:'Koloid: častice 1–1000 nm. Tyndallov jav: rozptyl svetla. Pravý roztok: < 1 nm. Suspenzia: > 1000 nm.'},
]);

addQ(3,'v','fyz',[
  {q:'Stojatá vlna vzniká:',a:0,opts:['Superpozíciou dvoch vĺn rovnakej frekvencie','Odrazom vlny od absolútne tuhého telesa iba','Interferenciou vĺn rôznych frekvencií','Difrakciou vlny za úzkou štrbinou'],exp:'Stojaté vlny: superpozícia vlny a jej odrazu. Uzly (nulová amplitúda) a kmitne (maximálna amplitúda).'},
  {q:'Dopplerov jav pre zvuk: zdrojpribližuje sa pozorovateľovi,frekvencia vnímaná je:',a:1,opts:['Rovnaká ako emitovaná','Vyššia ako emitovaná','Nižšia ako emitovaná','Nulová'],exp:'Doppler: zdroj sa približuje → vlnové dĺžky sa skracujú → f vyššia. Vzďaľuje sa → f nižšia. Platí pre zvuk aj svetlo.'},
  {q:'Absolútna nula teploty je:',a:2,opts:['0°C','−100 K','−273,15°C = 0 K','−300°C'],exp:'0 K = −273,15°C. Teoreticky najnižšia možná teplota — ustáva tepelný pohyb. Nedosiahnuteľná v praxi.'},
  {q:'Fotoefekt — energia vyrazeného elektrónu závisí od:',a:3,opts:['Intenzity (jasu) svetla','Plochy ožarovaného kovu','Času osvetľovania','Frekvencie svetla — nie od intenzity'],exp:'Einstein (Nobel 1921): Ek = hf − Φ. Energia závisí od f, nie od intenzity. Intenzita určuje počet elektrónov.'},
  {q:'Supravodivosť nastáva:',a:1,opts:['Pri vysokých teplotách vo všetkých kovoch','Pri veľmi nízkych teplotách','Iba v organických materiáloch','Pri vysokom tlaku bez teplotnej závislosti'],exp:'Supravodivosť: pod kritickou teplotou Tc → R = 0. BCS teória: Cooperove páry elektrónov. Meissnerov efekt.'},
  {q:'Vlnovo-korpuskulárny dualizmus hovorí:',a:0,opts:['Svetlo aj hmota majú vlastnosti','Svetlo je výlučne vlna','Hmota je výlučne korpuskulárna','Dualizmus platí len pre fotóny'],exp:'De Broglie (1924): λ = h/p. Elektrón má vlnové vlastnosti (difrakcia). Einstein: fotón má korpuskulárne (fotoefekt).'},
  {q:'Entropy a druhý termodynamický zákon:',a:2,opts:['Entropia izolovaného systému môže klesať','Entropia je konštantná v adiabatických procesoch','Entropia izolovaného systému vždy rastie alebo zostáva','Entropia závisí len od teploty'],exp:'2. zákon: ΔS ≥ 0 (izolovaný systém). Teplo prúdi od teplejšieho k chladnejšiemu — entropia rastie.'},
  {q:'Röntgenové žiarenie sa líši od viditeľného svetla:',a:3,opts:['Rýchlosťou šírenia','Tým, že nie je elektromagnetické','Tým, že je mechanická vlna','Výrazne kratšou vlnovou dĺžkou'],exp:'RTG: λ = 0,01–10 nm. Viditeľné: 380–700 nm. Oba sú EM vlny, líšia sa len frekvenciou/energiou.'},
]);

addQ(3,'v','ang',[
  {q:'"I ___ to the gym every day when I was younger."',a:0,opts:['used to go','was used to go','use to go','would go to'],exp:'Used to + infinitive: minulá opakujúca sa činnosť (teraz sa nedeje). "Would" tiež možné pre akcie, nie stavy.'},
  {q:'Choose the correct sentence:',a:1,opts:['"Its important to study."','"It&#39;s important to study."','"Its&#39; important to study."','"It is&#39; important to study."'],exp:"It's = It is (kontrakcia). Its = privlastňovacie zámeno (the dog and its bone). Bežná chyba."},
  {q:'"She speaks French ___ than her brother."',a:2,opts:['more fluent','fluenter','more fluently','most fluently'],exp:'Príslovka fluently → komparatív: more fluently. Nie "more fluent" (to by bolo prídavné meno).'},
  {q:'Preložte: Hovorí sa, že je bohatý.',a:3,opts:['"They say that he is rich."','"It says that he is rich."','"People says he is rich."','"He is said to be rich."'],exp:'"He is said to be rich" = pasívna reporting konštrukcia. It is said that + clause je tiež správne.'},
  {q:'"By the time she arrived, we ___ for two hours."',a:1,opts:['waited','had been waiting','were waiting','have been waiting'],exp:'Past perfect continuous: dej prebiehajúci PRED ďalším minulým dejom. Had been waiting = čakali sme (2 hod.) pred jej príchodom.'},
  {q:'The prefix "mis-" in "misunderstand" means:',a:0,opts:['wrongly','not','again','before'],exp:'Mis-: zle, nesprávne. Misunderstand (nesprávne pochopiť), mislead, misspell. Re- = znova, pre- = pred.'},
  {q:'Which sentence uses the subjunctive correctly?',a:2,opts:['"I suggest that he comes early."','"She demanded that he will leave."','"It is essential that she be on time."','"He recommended that they went."'],exp:'Subjunctive: suggest/demand/recommend/essential that + base form (bez -s, bez to). "that she be" = subjunctive.'},
  {q:'"The ___ you practice, the ___ you become."',a:3,opts:['much/good','more/better it','most/best','more/better'],exp:'"The more... the better": the + komparatív, the + komparatív. Paralelná štruktúra — obe časti musia byť komparatív.'},
]);

// ── 3R MASTER ──
addQ(3,'m','slj',[
  {q:'Jazyk ako sociálna prax — kto ho najdôslednejšie skúmal?',a:0,opts:['Pierre Bourdieu — jazykový kapitál a sociálne pole','Ferdinand de Saussure — len štruktúru','Noam Chomsky — generatívnu gramatiku','Roman Jakobson — komunikačné funkcie'],exp:'Bourdieu: jazyk = sociálny kapitál. Kto hovorí, ako hovorí a s akým prízvukom → sociálna stratifikácia.'},
  {q:'Kritická analýza diskurzu (Fairclough) skúma:',a:1,opts:['Len gramatické chyby v médiách','Ako jazyk reprodukuje a mení','Historický vývoj jazyka','Dialektológiu a nárečia'],exp:'CDA: texty nie sú neutrálne — ideológia, moc, nerovnosť sú zabudované v jazyku. Mediálny diskurz, politická rétorika.'},
  {q:'Postkoloniálna kritika jazyka (Fanon, Said) tvrdí:',a:2,opts:['Kolonizovaný jazyk je primitívny','Koloniálny jazyk je neutrálny nástroj','Jazyk kolonizátora nesie v sebe mocenské štruktúry a','Všetky jazyky sú rovnocenné bez historického kontextu'],exp:'Fanon: "Peau noire, masques blancs" — hovorenie jazyka koloniálneho pána = prijatie jeho sveta. Said: orientalizmus v jazyku.'},
  {q:'Čo je metalingvistika?',a:3,opts:['Matematická lingvistika','Počítačová lingvistika','Dialektológia','Jazyk hovorí o jazyku samom'],exp:'Metalingvistika: používanie jazyka na opis jazyka. Slovníky, gramatiky, jazykové príručky sú metalingvistické texty.'},
  {q:'Pragmatika jazyka (Grice) — maximy konverzácie:',a:0,opts:['Kvantita, kvalita,','Iba pravdivosť a presnosť','Iba zdvorilosť a takt','Len gramatická správnosť'],exp:'Grice (1975): kooperatívny princíp. 4 maximy: kvantita (toľko, koľko treba), kvalita (pravda), relevantsnosť, spôsob (jasnosť).'},
  {q:'Semiotika (Peirce) rozlišuje znaky na:',a:1,opts:['Aktívne a pasívne','Ikona (podobnosť), index','Verbálne a neverbálne','Primárne a sekundárne'],exp:'Peirce: ikona (foto = podoba), index (dym = oheň), symbol (slovo "pes" = konvencia). Saussure: signifiant/signifié.'},
  {q:'Naratológia (Genette) rozlišuje medzi:',a:2,opts:['Autorom a čitateľom','Témou a motívom','Histoiré (príbeh),','Lyrikou a epikou'],exp:'Genette: histoire = čo sa stalo. Récit = ako je to podané (poradie, frekvencie). Narration = kto a kedy rozprával.'},
  {q:'Jazyk a myslenie — Vygotského pohľad:',a:3,opts:['Myslenie predchádza jazyk vždy','Jazyk a myslenie sú úplne nezávislé','Jazyk je len nástrojom na vyjadrenie hotových myšlienok','Jazyk formuje myslenie — zóna najbližšieho vývoja'],exp:'Vygotsky: jazyk je nástroj myslenia. ZBV: dieťa sa rozvíja cez jazyk a sociálnu interakciu. Opak Piageta.'},
]);

addQ(3,'m','lit',[
  {q:'Absurdná dráma (Beckett, Ionesco) charakterizuje:',a:0,opts:['Zobrazenie zmysluprázdnosti existencie,','Realistické zachytenie spoločnosti','Romantické hrdinstvo a vzdor','Historické drámy s jasným posolstvom'],exp:'Absurdizmus: Čakanie na Godota — nikto nepríde, nič sa nestane, ale čakáme. Jazyk sa rozpadá, komunikácia zlyháva.'},
  {q:'Postkoloniálna literatúra (Achebe, Rushdie) reaguje na:',a:1,opts:['Industrializáciu a urbanizáciu','Koloniálnu skúsenosť','Svetové vojny a ich následky','Technologickú revolúciu 20. stor.'],exp:'Achebe: "Things Fall Apart" — africký pohľad. Rushdie: "Midnight&#39;s Children" — hybridita, magický realizmus. Odpoveď na Conrada.'},
  {q:'Slovenská medzivojnová lyrika — Ivan Krasko:',a:2,opts:['Patrí k romantizmu','Písal realistickú prózu','Je predstaviteľom symbolizmu a moderny, témy','Patril k DAV-u (marxistická literatúra)'],exp:'Krasko: Nox et solitudo, Verše. Symbolizmus, dekadencia, existenciálne témy — vina, smrť, láska, vlasť.'},
  {q:'Proust — "Na stráži zašlého času" je známy:',a:3,opts:['Krátkou dĺžkou a úspornosťou','Realistickým opisom Paríža','Politickou angažovanosťou','Prúdom vedomia, nelineárnym'],exp:'Proust: 7 zväzkov, 1,5 milióna slov. Madeleine = involuntárna pamäť. Čas, pamäť, umelenie, vysoká spoločnosť.'},
  {q:'Existenciálna literatúra Camusa — "Cudzinec" (L&#39;Étranger):',a:1,opts:['Hrdina je plný empatie a pochopenia','Mersault je ľahostajný k životu, smrti','Román propaguje angažovanosť','Camus opisuje hrdinský vzdor'],exp:'Mersault: zabije Araba, pretože mu svietilo slnko. Ľahostajnosť k morálke = absurdný hrdina. "Absurdný mýtus o Sizyfovi".'},
  {q:'Slovenská próza 60. rokov (Johanides, Jaroš) je označovaná:',a:0,opts:['Ako "nová vlna"','Ako socialistický realizmus','Ako lyrizovaná próza','Ako naturalizmus'],exp:'60. roky: Johanides (Súkromie), Jaroš, Ballek — odpútanie od schematizmu, existencializmus, formálne experimenty.'},
  {q:'Alegória sa odlišuje od symbolu:',a:2,opts:['Alegória je kratšia','Symbol je vždy vizuálny','Alegória má systematický,','Sú to totožné figúry'],exp:'Alegória: konzistentné priradenie (Orwell: prasatá = komunistická strana). Symbol: otvorený, mnohoznačný (biela veľryba).'},
  {q:'Dramaturgická funkcia konfliktu v dráme:',a:3,opts:['Len spomaliť dej','Len charakterizovať postavy','Len vytvoriť napätie','Hnacia sila deja,'],exp:'Konflikt: bez neho niet drámy. Vonkajší (Hamlet vs. Claudius) + vnútorný (Hamlet vs. sám seba) = komplexná dráma.'},
]);

addQ(3,'m','mat',[
  {q:'Fourierova analýza rozkladá periodicku funkciu na:',a:0,opts:['Súčet sínusov a cosínusov rôznych','Súčet polynómov','Súčin exponenciálnych funkcií','Integrál všetkých možných funkcií'],exp:'Fourierov rad: f(x) = a₀/2 + Σ(aₙcos(nx) + bₙsin(nx)). Základ spracovanie signálov, MP3, JPEG.'},
  {q:'Gödelove vety o neúplnosti hovoria:',a:1,opts:['Každý matematický systém je úplný','V každom dostatočne silnom formálnom systéme','Matematika je len konvencia','Axiomatické systémy sú vždy protirečivé'],exp:'Gödel (1931): 1. veta — existujú nedokázateľné pravdy. 2. veta — systém nemôže dokázať vlastnú konzistenciu.'},
  {q:'Topológia skúma vlastnosti invariantné pri:',a:2,opts:['Rotáciách a translácii','Algebraických operáciách','Spojitých deformáciách','Metrických transformáciách'],exp:'Topológia: káva šálka ≅ donut (obe majú 1 dieru). Euler-Poincarého charakteristika: χ = V - E + F.'},
  {q:'P vs. NP problém je jeden z Millennium Problems. P znamená:',a:3,opts:['Polynomiálny čas pre overenie riešenia','Problémy riešiteľné len paralelnými počítačmi','Problémy s pravdepodobnostným riešením','Problémy riešiteľné v polynomiálnom čase'],exp:'P: efektívne riešiteľné (napr. triedenie). NP: efektívne overiteľné. P=NP? — 1 milión dolárov, nevyriešené.'},
  {q:'Riemannova hypotéza tvrdí, že netriviálne nuly ζ(s) ležia na:',a:1,opts:['Reálnej osi','Priamke Re(s) = 1/2','Imaginárnej osi','Kružnici |s| = 1'],exp:'Riemann (1859): všetky netriviálne nuly ζ-funkcie majú Re(s) = 1/2. Nevyriešená, súvisí s rozdelením prvočísel.'},
  {q:'Monte Carlo metódy sú:',a:0,opts:['Algoritmy používajúce náhodné vzorkovanie na','Deterministické optimalizačné algoritmy','Metódy kryptografie','Topologické výpočtové metódy'],exp:'Monte Carlo: odhad π hodením náhodných bodov do štvorca, výpočet integrálov, simulácie v kvantovej fyzike.'},
  {q:'Kategoriálna teória (Eilenberg, MacLane) abstrahuje:',a:2,opts:['Číselné operácie','Geometrické transformácie','Štruktúry a morfizmy naprieč','Pravdepodobnostné priestory'],exp:'Teória kategórií: objekty + morfizmy. Unifikuje algebru, topológiu, logiku. Základ funkcionálneho programovania.'},
  {q:'Chaos theory — Lorenzov atraktor demonštruje:',a:3,opts:['Stabilitu deterministických systémov','Periodické správanie dynamických systémov','Linearitu fyzikálnych systémov','Citlivú závislosť na počiatočných podmienkach'],exp:'Lorenz (1963): malá zmena počiatočných podmienok → dramaticky odlišné výsledky. Deterministický chaos.'},
]);

addQ(3,'m','dej',[
  {q:'Holokaust — systematické vyvražďovanie Židov prebehlo:',a:0,opts:['V koncentračných a vyhladzovacích táboroch','Iba na území Poľska','Iba počas záverečnej fázy vojny','Len v rámci vojenských operácií na fronte'],exp:'Holokaust: Wannsee 1942 — "konečné riešenie". Auschwitz, Treblinka, Sobibor. ~6 mil. Židov, ~5 mil. ďalších.'},
  {q:'Studená vojna (1947–1991) bola charakteristická:',a:1,opts:['Priamymi vojenskými stretmi medzi USA a ZSSR','Ideologickým, ekonomickým a politickým súperením bez','Vojenskou spoluprácou Východu a Západu','Ekonomickou integráciou kapitalizmu a komunizmu'],exp:'Studená vojna: železná opona, preteky v zbrojení, kozmické preteky, proxy vojny (Kórea, Vietnam, Angola).'},
  {q:'Marshallův plán (1948) pomáhal:',a:2,opts:['Rozvojovým krajinám Afriky','Porazeným krajinám osi','Obnove Západnej Európy po 2.','Výhradne Nemecku'],exp:'Marshall Plan: 13 mld. USD pre ZE. Ekonomická obnova, ale aj geopolitický zámer — stabilizácia proti komunizmu.'},
  {q:'Kubánska kríza (1962) bola vyriešená:',a:3,opts:['Vojenskou intervenciou USA','Sovietskou kapituláciou','Ekonomickými sankciami','Diplomatickým kompromisom'],exp:'Najnebezpečnejší moment studenej vojny. Tajná dohoda: ZSSR stiahne rakety z Kuby, USA nezaútočí a stiahne rakety z Turecka.'},
  {q:'Dekolonizácia po 2. sv. vojne postihla predovšetkým:',a:1,opts:['Latinskú Ameriku','Afriku a Áziu','Európu a Severnú Ameriku','Oceániu'],exp:'1945–1975: Britské, Francúzske, Holandské, Belgické impériá sa rozpadli. India 1947, Alžírsko 1962, Angola 1975.'},
  {q:'Normalizácia v ČSSR (1969–1989) nastala po:',a:0,opts:['Potlačení Pražskej jari inváziou vojsk','Revolúcii pracujúcich','Ekonomickej kríze','Voľbách, v ktorých komunisti prehrali'],exp:'Pražská jar 1968: Dubček — "socializmus s ľudskou tvárou". 21. august 1968: invázia. Husák: normalizácia = retrogres.'},
  {q:'Nežná revolúcia (november 1989) v ČSSR sa začala:',a:2,opts:['Generálnym štrajkom robotníkov','Vojenským prevratom','Študentskou demonštráciou 17.','Vyhlásením nezávislosti Slovenska'],exp:'17.11.1989: zásah polície na Národní třídě. Sametová revolúcia. Havel prezidentom. Koniec komunizmu.'},
  {q:'Rozpad ZSSR (1991) bol priamym dôsledkom:',a:3,opts:['Vojenskej porážky v Afganistane','Hospodárskej krízy bez politických reforiem','Tlaku USA na vojenskú kapituláciu','Glasnosti a perestrojky, národných hnutí a'],exp:'Gorbačov: glasnosť (otvorenosť) + perestrojka (prestavba). Baltské štáty, Ukrajina... Puč 19.8.1991. 25.12.1991: ZSSR zanikol.'},
]);

addQ(3,'m','bio',[
  {q:'Prionové ochorenia (CJD, BSE) spôsobujú:',a:0,opts:['Proteíny s abnormálnou konformáciou (prióny)','Vírusy s neobvyklou replikáciou','Baktérie produkujúce neurotoxíny','Autoimunitné reakcie voči nervovému tkanivú'],exp:'Prusiner (Nobel 1997): prión = misfolded PrPˢᶜ premieňa normálny PrPᶜ. Infekcia bez nukleovej kyseliny.'},
  {q:'Telomeráza a starnutie buniek:',a:1,opts:['Telomeráza urýchľuje starnutie','Telomeráza predlžuje teloméry →','Telomeráza nehrá rolu v starnutí','Telomeráza skracuje teloméry'],exp:'Teloméry sa skracujú s každým delením → Hayflickova hranica → starnutie. Telomeráza aktívna v zárodočných bunkách a rakovine.'},
  {q:'RNA interferencia (RNAi) je mechanizmus:',a:2,opts:['Transkripcie génov','Replikácie DNA','Umlčania génov pomocou','Translácie proteínov'],exp:'RNAi: Fire & Mello (Nobel 2006). siRNA sa viaže na mRNA → degradácia. Základ génovej regulácie a terapie.'},
  {q:'Mikrobiom človeka obsahuje:',a:3,opts:['Iba škodlivé mikroorganizmy','Menej buniek ako samotné telo','Výhradne baktérie','~3,8×10¹³ mikroorganizmov,'],exp:'Mikrobiom: 1:1 pomer s ľudskými bunkami. Gut-brain axis. Dysbioza → zápalové choroby, obezita, depresia.'},
  {q:'Zárodočné vrstvy — mezoderm dáva vznik:',a:1,opts:['Nervovej sústave a pokožke','Svalom, kostre, srdcu, obličkám','Tráviaceho traktu a pečeni','Iba krvným bunkám'],exp:'Ektoderm: koža, NS. Mezoderm: svaly, kosti, srdce, obličky, krv. Entoderm: tráviaci trakt, pľúca, pečeň.'},
  {q:'Optogenetika umožňuje:',a:0,opts:['Kontrolovať aktivitu konkrétnych','Sekvenovať genóm pomocou lasera','Editovať gény pomocou svetla','Zobraziť proteíny fluorescenciou'],exp:'Optogenetika: channelrhodopsin vložený do neurónov → svetlo aktivuje/inhibuje konkrétne bunky. Neurovedecká revolúcia.'},
  {q:'Regulačné T-bunky (Tregs) sú dôležité pre:',a:2,opts:['Produkciu protilátok','Priamu lýzu patogénov','Potlačenie autoimunitných reakcií','Aktiváciu zápalových procesov'],exp:'Tregs: exprimujú FoxP3. Potláčajú autoreaktívne T-bunky. Ich dysfunkcia → autoimunitné ochorenia (MS, T1D).'},
  {q:'Xenotransplantácia (prenos orgánov medzi druhmi) čelí:',a:3,opts:['Iba etickým problémom','Iba problémom veľkosti orgánov','Iba právnym problémom','Hyperakútnej rejekcii,'],exp:'CRISPR knockout génov pre ľudskú rejekciu v prasacích orgánoch (PERV, α-gal epitop). FDA schválila 2022.'},
]);

addQ(3,'m','che',[
  {q:'Chirálne molekuly sú také, ktoré:',a:0,opts:['Nie sú superpozonovateľné so','Majú symetrickú štruktúru','Reagujú iba s kyselinami','Majú iba jednoduché väzby'],exp:'Chiralita: uhlík s 4 rôznymi substituenmi = stereogénny centrum. R/S konfigurácia. Enantiomery majú rovnakú chemickú reaktivitu, rôzne otáčajú polarizované svetlo.'},
  {q:'Supramolekulárna chémia (Lehn) skúma:',a:1,opts:['Vnútromolekulárne kovalentné väzby','Interakcie medzi molekulami','Jadrovú chémiu','Kvantovochemické výpočty'],exp:'Lehn (Nobel 1987): nekovalentné interakcie — H-väzby, π-π, van der Waals. Kryptandy, krunne étere. Základ nanotechnológie.'},
  {q:'Ziegler-Nattov katalyzátor sa používa pri:',a:2,opts:['Výrobe kyseliny sírovej','Syntéze amoniaku (Haber-Bosch)','Polymerizácii alkénov na','Oxidácii organických zlúčenín'],exp:'Ziegler-Natta (Nobel 1963): TiCl₄/AlEt₃. Stereoregulárny izotaktický polypropylén — základ plastového priemyslu.'},
  {q:'Greenova funkcia v kvantovej chémii popisuje:',a:3,opts:['Rozpustnosť látok','Termodynamiku reakcií','Spektroskopické vlastnosti','Šírenie'],exp:'Greenova funkcia: propagátor — ako sa systém vyvíja od počiatočného stavu. DFT+G: výpočty silne korelovaných systémov.'},
  {q:'Sol-gel proces sa využíva na prípravu:',a:1,opts:['Polymérov z uhľovodíkov','Nanomateriálov, skiel a','Biologicky aktívnych látok','Explozív'],exp:'Sol-gel: hydrolýza a kondenzácia alkoxidov (napr. TEOS) → koloidná suspenzia (sol) → gél → nanoporézne materiály.'},
  {q:'Elektroanalytická metóda cyklická voltampérometria meria:',a:0,opts:['Prúd pri meniacom sa napätí','Hmotu po fotodegradácii','Absorpciu UV-Vis žiarenia','Nukleárnu magnetickú rezonanciu'],exp:'CV: prúd I vs. napätie E (scan). Redoxné potenciály, kinetika prenosu elektrónov, mechanizmy elektród. reakcií.'},
  {q:'Metaloproteíny ako hemoglobín a cytochróm c využívajú kov ako:',a:2,opts:['Stavebný materiál proteínu','Zdroj energie','Funkčné centrum','Štrukturálny stabilizátor'],exp:'Hemoglobín: Fe²⁺ v heme. Cytochróm c: Fe²⁺/³⁺ prenosnič elektrónov. Nitrogenáza: Mo-Fe klaster fixuje N₂.'},
  {q:'Asymetrická katalýza (Noyori, Sharpless) umožňuje:',a:3,opts:['Rýchlejšiu syntézu bez selektivity','Iba termoradikálové reakcie','Syntézu racemických zmesí','Syntézu enantiomérne čistých látok'],exp:'Sharpless epoxidácia, Noyori hydrogenácia (Nobel 2001): chirálny katalyzátor → jeden enantiomér lieku (L-DOPA, ibuprofen).'},
]);

addQ(3,'m','fyz',[
  {q:'Teória superstringov predpokladá, že fundamentálne objekty sú:',a:0,opts:['Jednorozmerné struny vibrujúce v 10–11 dimenziách','Bodové častice bez rozmeru','Kvantové bodové polia v 4D priestoro-čase','Trojdimenzionálne membrány v 4D priestore'],exp:'Superstring: Calabi-Yau varietY. 5 konzistentných verzií → M-teória (11D). Gravitón ako vibračný mód struny.'},
  {q:'Holografický princíp (t&#39;Hooft, Susskind) tvrdí:',a:1,opts:['Vesmír je hologram viditeľný z jedného miesta','Fyzika v objeme je ekvivalentná fyzike na jeho','Informácia sa môže stratiť v čiernej diere','Gravitácia je len efekt geometrie priestoru'],exp:'AdS/CFT (Maldacena 1997): gravitácia v Anti-de Sitter priestore = konformná teória poľa na hranici. Dualita.'},
  {q:'Kvantová previazanosť (entanglement) znamená:',a:2,opts:['Dve čatice sú fyzicky spojené','Čatice sa pohybujú rovnakou rýchlosťou','Meranie jednej čatice okamžite určí stav druhej bez','Čatice si vymieňajú informáciu rýchlosťou svetla'],exp:'Einstein: "spooky action at a distance". Bell (1964): nerovnosti. Aspect (1982): entanglement reálny. Základ kvantovej kryptografie.'},
  {q:'Casimirová sila je dôkazom:',a:3,opts:['Gravitačného lákania kovových dosiek','Elektrostatického odpudzovania vo vákuu','Magnetickej indukcie pri pohybe dosiek','Kvantových fluktuácií vákua — nulová bodová energia'],exp:'Casimir (1948): dve paralelné kovové dosky vo vákuu sa priťahujú. Kvantové fluktuácie tlačia zvonka viac ako zvnútra.'},
  {q:'Inflačná kozmológia (Guth, 1981) vysvetľuje:',a:1,opts:['Vznik tmavej hmoty','Exponenciálne rozšírenie vesmíru','Vznik galaxií z čiernych dier','Spomaľovanie expanzie vesmíru'],exp:'Inflácia: riešenie problému horizontu a plochosti. 10⁻³⁶ až 10⁻³² s: vesmír sa zväčšil o 10²⁶. Predpovedá B-módy CMB.'},
  {q:'Neutrínové oscilácie dokazujú, že neutríná:',a:0,opts:['Musia mať nenulovú kľudovú hmotnosť','Cestujú rýchlejšie ako svetlo','Sú vlastnými stavmi hmotnosti a príchutí súčasne','Neinteragujú s hmotou'],exp:'SuperKamiokande (Nobel 2015): atmosférické neutríná oscilujú → majú hmotnosť. ŠM predpovedal m=0 — treba ho upraviť.'},
  {q:'Gravitačné vlny detekovane LIGO (2015) boli generované:',a:2,opts:['Supernovou v susednej galaxii','Pulzarom s extrémne rýchlou rotáciou','Splynutím dvoch čiernych dier (masy ~36 a ~29 M☉)','Bigbangom — primitívne gravitačné vlny'],exp:'GW150914: merger BH 36+29 M☉ → 62 M☉ + 3M☉ energia ako GW. 1,3 miliardy sv. rokov. Citlivosť: 10⁻²¹ m.'},
  {q:'Kvantová chromodynamika (QCD) popisuje:',a:3,opts:['Elektromagnetickú interakciu','Slabú jadrovú silu','Gravitáciu v kvantovej forme','Silnú jadrovú silu'],exp:'QCD: kvarky nesú "farby" (R,G,B). Gluóny prenášajú silnú silu. Confinement: kvarky nikdy samy — iba v hadrónoch.'},
]);

addQ(3,'m','ang',[
  {q:'"___ he studied hard, he failed the exam." (contrast)',a:0,opts:['Although','Because','Therefore','However'],exp:'Although/Even though/Despite the fact that: kontrast. Because: príčina. Therefore/Thus: dôsledok.'},
  {q:'The word "ephemeral" means:',a:1,opts:['permanent and lasting','short-lived, lasting only a','large and impressive','complicated and difficult'],exp:'Ephemeral: krátko trvajúci. "Ephemeral beauty of cherry blossoms." Synonymá: fleeting, transient, transitory.'},
  {q:'"Had I known about the problem, I ___ it sooner."',a:2,opts:['would fix','will have fixed','would have fixed','had fixed'],exp:'3rd conditional s inverziou: Had I known (= If I had known)... I would have fixed it. Formálny register.'},
  {q:'Choose the most precise word: The scientist made a ___ observation.',a:3,opts:['good','nice','important','seminal'],exp:'Seminal: prelomový, zakladateľský (seminal work = dielo, ktoré zmenilo odbor). Register odborného písania.'},
  {q:'"The more ___ his argument, the more ___ his opponents became."',a:1,opts:['persuasive / frustrated it','persuasive / frustrated','persuasively / frustrated','persuasion / frustrating'],exp:'The more + adjective... the more + adjective. Persuasive (adj, opisuje argument), frustrated (adj, opisuje opponents).'},
  {q:'Identify the dangling modifier: "Walking down the street, the trees were beautiful."',a:0,opts:['"Walking down the street"','No error, trees can walk','The sentence is passive','Beautiful is wrong'],exp:'Dangling modifier: "Walking" sa vzťahuje na subjekt vety = stromy. Správne: "Walking down the street, I found the trees beautiful."'},
  {q:'Which is an example of litotes?',a:2,opts:['"She is the brightest star in the sky."','"He ran so fast the wind was left behind."','"That was not a bad performance."','"The silence was deafening."'],exp:'Litotes: dvojité záporne alebo podhodnotenie na vyjadrenie opaku. "Not bad" = good. Irónické zmenšenie.'},
  {q:'In academic writing, hedging language includes:',a:3,opts:['Definitive statements: "This proves..."','Emotional appeals: "We must stop this!"','Personal opinions: "I think..."','Tentative language'],exp:'Hedging: "may, might, could, appears to, suggests, it is possible that" — vedecká opatrnosť, uznanie limitov.'},
]);

// ═══════════════════════════════════════════
// 4. ROČNÍK — EDUCAST free
// ═══════════════════════════════════════════
addQ(4,'r','slj',[
  {q:'Jazykoveda sa delí na:',a:0,opts:['Fonetiku, morfológiu,','Iba gramatiku a slovník','Iba literatúru a jazyk','Rétorika a štylistiku'],exp:'Jazykoveda: fonetika, fonológia, morfológia, syntax, lexikológia, štylistika.'},
  {q:'Čo skúma fonetika?',a:2,opts:['Stavbu viet','Slovnú zásobu','Zvukovú','Tvorbu slov'],exp:'Fonetika: hlásky, ich tvorenie a akustické vlastnosti. Fonológia: funkcia hlások.'},
  {q:'Interpunkcia v slovenčine — čiarka sa píše:',a:1,opts:['Vždy pred "a"','Pred "ale", "no",','Nikdy pred "že"','Vždy za podmetom'],exp:'Čiarka: pred priraďovacou odporovacou/vylučovacou spojkou, pred vedľajšou vetou.'},
  {q:'Kondenzácia textu znamená:',a:3,opts:['Rozšírenie textu','Preklad textu','Citovanie textu','Skrátenie a'],exp:'Kondenzácia: zhusťovanie textu. Výsledok: výťah, konspekt, anotácia.'},
  {q:'Jazyk je systém pretože:',a:0,opts:['Prvky sú','Je naučený','Má gramatiku','Je písomný'],exp:'Jazyk ako systém: fonémy, morfémy, slová a vety sú v systematických vzťahoch.'},
  {q:'Anotácia je:',a:2,opts:['Dlhý komentár k textu','Prepis textu','Stručná charakteristika','Zoznam použitej literatúry'],exp:'Anotácia: krátka charakteristika obsahu a zamerania textu. Na zadných stranách kníh.'},
  {q:'Pasívum v slovenčine sa tvorí pomocou:',a:1,opts:['Slovesa "mať"','Zvratného "sa" alebo trpného','Iba trpného príčastia','Slovesa "byť" + neurčitok'],exp:'Pasívum: zvratné ("Kniha sa číta.") alebo opisné ("Kniha bola prečítaná.").'},
  {q:'Maturitná skúška zo slovenčiny overuje:',a:3,opts:['Iba gramatické vedomosti','Iba literárne znalosti','Iba ústny prejav','Písomné aj ústne'],exp:'Maturita SJL: písomná (sloh) + ústna (jazykoveda + literatúra).'},
]);

addQ(4,'r','lit',[
  {q:'Moderná slovenská literatúra 20. storočia — DAV bola:',a:0,opts:['Ľavicová avantgardná skupina','Surrealistická skupina','Naturistická skupina','Katolícka básnická skupina'],exp:'DAV (1924–1937): ľavicová avantgardná skupina. Novomeský, Clementis, Poničan.'},
  {q:'Laco Novomeský je predstaviteľ:',a:2,opts:['Romantizmu','Realizmu','Poetizmu a','Baroka'],exp:'Novomeský: poézia, poetizmus, neskôr ľúbostná a reflexívna lyrika (Vila Tereza).'},
  {q:'Dominik Tatarka napísal:',a:1,opts:['Živý bič','Démon súhlasu (kritika totality)','Mor ho!','Detvan'],exp:'Tatarka: Démon súhlasu — kritika komunistického konformizmu a zbabelosti.'},
  {q:'Ladislav Mňačko je autorom:',a:3,opts:['Živého biča','Srdce plné radosti','Detektívok pre deti','Ako chutí moc'],exp:'Mňačko: Ako chutí moc — kritika komunistickej moci, reportážny román.'},
  {q:'Generácia 1956 v literatúre reagovala na:',a:0,opts:['Uvoľnenie po Stalinovej','Prvú svetovú vojnu','Vznik Československa','Druhú svetovú vojnu'],exp:'Generácia 1956: odmietnutie schematizmu, príklon k existencializmu a autentickosti.'},
  {q:'Milan Rúfus je:',a:2,opts:['Prozaik','Dramatik','Básnik','Publicista'],exp:'Milan Rúfus: najvýznamnejší slovenský básnik 2. pol. 20. stor. Témy: detstvo, smrť, Boh.'},
  {q:'Postmodernizmus sa vyznačuje:',a:1,opts:['Jednoduchosťou a jednoznačnosťou','Iróniou, intertextualitou, hrou s','Socialistickým realizmom','Striktnou chronológiou'],exp:'Postmodernizmus: irónia, paródia, intertextualita, spochybnenie veľkých príbehov.'},
  {q:'Dráma sa od prózy odlišuje:',a:3,opts:['Kratším rozsahom','Absenciou postáv','Prítomnosťou rozprávača','Tým, že je určená na'],exp:'Dráma: určená na divadelné uvedenie. Hlavná forma: dialóg, monológ, repliky.'},
]);

addQ(4,'r','mat',[
  {q:'Integrál ∫f(x)dx vyjadruje:',a:0,opts:['Plochu pod grafom','Deriváciu funkcie','Maximum funkcie','Rovnicu funkcie'],exp:'Integrál: neurčitý = primitívna funkcia. Určitý = plocha pod grafom medzi a a b.'},
  {q:'Limita lim(x→∞) 1/x =',a:2,opts:['1','Nekonečno','0','Neurčitá'],exp:'Ako x → ∞, 1/x → 0. Funkcia sa blíži k nule, ale nikdy ju nedosiahne.'},
  {q:'Matica je:',a:1,opts:['Rovnica','Obdĺžniková','Druh grafu','Množina čísel'],exp:'Matica: obdĺžniková tabuľka čísel usporiadaných v riadkoch a stĺpcoch.'},
  {q:'Binomická veta rozvíja výraz:',a:3,opts:['a+b','a·b','a-b','(a+b)ⁿ'],exp:'Binomická veta: (a+b)ⁿ = Σ C(n,k)·aⁿ⁻ᵏ·bᵏ. Pascalov trojuholník.'},
  {q:'Komplexné číslo má tvar:',a:0,opts:['a + bi (kde i² = -1)','a² + b²','√(a+b)','a/b'],exp:'Komplexné číslo: z = a + bi. Reálna časť a, imaginárna časť b. i = √(-1).'},
  {q:'Štandardná odchýlka meria:',a:2,opts:['Priemernú hodnotu','Najväčšiu hodnotu','Rozptyl dát okolo priemeru','Počet hodnôt'],exp:'Štandardná odchýlka σ: miera variability. Malá σ = dáta blízko priemeru.'},
  {q:'Maturitná matematika — vektor AB má súradnice:',a:1,opts:['A-B','B-A','A+B','A·B'],exp:'Vektor AB = B - A. Smer od A do B. Súradnice: (Bx-Ax, By-Ay).'},
  {q:'Goniometrická funkcia tan(α) =',a:3,opts:['cos/sin','1/sin','1/cos','sin/cos'],exp:'tan α = sin α / cos α. Kotangens: cot α = cos/sin.'},
]);

addQ(4,'r','dej',[
  {q:'Studená vojna bola konflikt medzi:',a:0,opts:['USA a ZSSR','USA a Čínou','ZSSR a Čínou','Európou a USA'],exp:'Studená vojna (1947–1991): ideologický konflikt kapitalizmu (USA) vs komunizmu (ZSSR).'},
  {q:'Pražská jar 1968 bola:',a:2,opts:['Ekonomická reforma','Vojenský prevrat','Pokus o demokratizáciu','Vznik Česko-Slovenska'],exp:'Pražská jar: Dubčekovo "socializmus s ľudskou tvárou". Potlačená inváziou 21.8.1968.'},
  {q:'Berlínsky múr padol v roku:',a:1,opts:['1989','1989 (9. novembra)','1991','1985'],exp:'Berlínsky múr padol 9. novembra 1989. Symbol konca studenej vojny.'},
  {q:'Nežná revolúcia v ČSSR prebehla:',a:3,opts:['1968','1980','1985','1989'],exp:'Nežná revolúcia: november 1989. Koniec komunizmu v Česko-Slovensku bez násilia.'},
  {q:'Slovenská republika vznikla:',a:0,opts:['1. januára 1993','1. januára 1991','17. novembra 1989','1. mája 2004'],exp:'Vznik SR: 1. január 1993 — rozdelenie Česko-Slovenska (Zamatový rozvod).'},
  {q:'Slovensko vstúpilo do EÚ v roku:',a:2,opts:['2000','2002','2004','2007'],exp:'Slovensko vstúpilo do EÚ 1. mája 2004 spolu s 9 ďalšími krajinami.'},
  {q:'Holokaust bol:',a:1,opts:['Vojna na Balkáne','Systematické','Prírodná katastrofa','Kolaps ekonomiky'],exp:'Holokaust: nacistická genocída Židov a iných skupín. 6 miliónov Židov zavraždených.'},
  {q:'OSN (Organizácia spojených národov) vznikla v roku:',a:3,opts:['1939','1938','1948','1945'],exp:'OSN: 1945, San Francisco. Nástupca Spoločnosti národov. Cieľ: mier a bezpečnosť.'},
]);

addQ(4,'r','bio',[
  {q:'Ľudský genóm obsahuje približne:',a:0,opts:['20 000–25 000 génov','1 000 génov','1 milión génov','100 génov'],exp:'Ľudský genóm: ~20 000–25 000 génov, ~3 miliardy párov báz.'},
  {q:'Imunitný systém rozlišuje:',a:2,opts:['Len vírusy','Len baktérie','Vlastné a cudzie látky','Iba škodlivé chemikálie'],exp:'Imunitný systém: nešpecifická (vrodená) a špecifická (adaptívna) imunita. Antigény → protilátky.'},
  {q:'Hormon inzulín produkuje:',a:1,opts:['Štítna žľaza','Pankreas','Nadobličky','Hypofýza'],exp:'Inzulín: pankreas. Reguluje hladinu glukózy v krvi. Deficit → diabetes.'},
  {q:'Nervový impulz sa prenáša:',a:3,opts:['Chemicky cez krvný obeh','Len elektricky','Len chemicky','Elektricky cez axón,'],exp:'Nervový impulz: elektrický signál (akčný potenciál) + chemický prenos (neurotransmitery) v synapsii.'},
  {q:'Fotosyntéza a dýchanie sú:',a:0,opts:['Vzájomne opačné procesy (CO₂↔O₂)','Totožné procesy','Nesúvisiace procesy','Oba produkujú CO₂'],exp:'Fotosyntéza: CO₂+H₂O→glukóza+O₂. Dýchanie: glukóza+O₂→CO₂+H₂O+ATP.'},
  {q:'Kmeňové bunky sú schopné:',a:2,opts:['Iba deliť sa','Iba produkovať energiu','Diferencovať sa na rôzne','Len produkovať protilátky'],exp:'Kmeňové bunky: nediferencované, schopné stať sa rôznymi typmi buniek. Potenciál v medicíne.'},
  {q:'Maturitná biológia — ktorý orgán filtruje krv?',a:1,opts:['Pečeň','Obličky','Srdce','Pľúca'],exp:'Obličky: filtrácia krvi, tvorba moča, regulácia tlaku a pH. Pečeň: metabolizmus.'},
  {q:'Biotechnológia využíva:',a:3,opts:['Iba chémiu','Iba fyziku','Iba genetiku','Živé organizmy na výrobu produktov (inzulín, vakcíny, bioplasty)'],exp:'Biotechnológia: GMO, fermentácia, rekombinantná DNA. Inzulín z baktérií.'},
]);

addQ(4,'r','che',[
  {q:'Elektrolýza je proces kde:',a:0,opts:['Elektrický prúd vyvoláva chemickú','Chemická reakcia vyvoláva prúd','Taví sa kov','Zráža sa soľ'],exp:'Elektrolýza: elektrická energia → chemická reakcia. Výroba hliníka, chloru, NaOH.'},
  {q:'Galvanický článok mení:',a:2,opts:['Teplo na elektrinu','Svetlo na elektrinu','Chemickú energiu na elektrickú','Mechanickú energiu na elektrinu'],exp:'Galvanický článok (batéria): chemická energia → elektrická energia. Oxidácia + redukcia.'},
  {q:'Nukleové kyseliny (DNA, RNA) sú tvorené:',a:1,opts:['Aminokyselinami','Nukleotidmi','Mastnými kyselinami','Monosacharidmi'],exp:'DNA a RNA: polyméry nukleotidov. Nukleotid = fosfát + cukor + báza.'},
  {q:'Reakcia kyseliny so zásadou sa nazýva:',a:3,opts:['Oxidácia','Hydrolýza','Polymerizácia','Neutralizácia'],exp:'Neutralizácia: kyselina + zásada → soľ + voda. HCl + NaOH → NaCl + H₂O.'},
  {q:'Molárna hmotnosť CO₂ je:',a:0,opts:['44 g/mol','28 g/mol','32 g/mol','40 g/mol'],exp:'CO₂: C=12, O=16. M = 12 + 2×16 = 44 g/mol.'},
  {q:'Termoplasty sa od reaktoplastov líšia:',a:2,opts:['Lepšou pevnosťou','Vyššou teplotou tavenia','Možnosťou opakovaného','Nižšou cenou'],exp:'Termoplasty: PET, PVC — opakované tavenie. Reaktoplasty: nevratne stuhnú (epoxid).'},
  {q:'Chelatoterapia využíva:',a:1,opts:['Rádioaktívne prvky','Chelátové komplexy na','Alkoholy ako liečivá','Kyslíkové zásahy'],exp:'Chelátové komplexy: viažu ťažké kovy (olovo, ortuť) → vylúčenie z tela.'},
  {q:'Maturitná chémia: Avogadrova konštanta NA ≈',a:3,opts:['6,02 × 10⁶','6,02 × 10¹²','6,02 × 10¹⁸','6,02 × 10²³'],exp:'NA = 6,022 × 10²³ mol⁻¹. Počet častíc v 1 móle látky.'},
]);

addQ(4,'r','fyz',[
  {q:'Hmotnostný defekt jadra je:',a:0,opts:['Rozdiel hmotnosti jadra a','Hmotnosť elektrónu','Energia fotónu','Pohybová energia jadra'],exp:'Hmotnostný defekt: Δm = Zmp + Nmn - mjadr. Vysvetľuje jadrovú väzbovú energiu (E=Δmc²).'},
  {q:'Rádioaktívny rozpad α emituje:',a:2,opts:['Elektrón','Fotón','Jadro hélia (2 protóny + 2 neutróny)','Pozitrón'],exp:'α rozpad: emisia jadra He-4 (α článku). β⁻: elektrón. γ: fotón vysokej energie.'},
  {q:'Fotoelektrický jav — práh frekvencie závisí od:',a:1,opts:['Intenzity svetla','Výstupnej práce materiálu','Teploty kovu','Vlnovej dĺžky × intenzity'],exp:'Prahová frekvencia: f₀ = W/h. W = výstupná práca. Pod prahom žiadne elektróny nevyletia.'},
  {q:'De Broglieho vlnová dĺžka λ = h/p znamená:',a:3,opts:['Svetlo je vlnenie','Hmotnosť je energia','Rýchlosť svetla je konštantná','Každá častica má vlnové vlastnosti'],exp:'De Broglie (1924): λ = h/p. Korpuskulárno-vlnový dualizmus hmoty.'},
  {q:'Supravodivosť nastáva pri:',a:0,opts:['Veľmi nízkych teplotách','Vysokých teplotách','Silnom magnetickom poli','Vysokom napätí'],exp:'Supravodivosť: pod kritickou teplotou Tc → R = 0. Meissnerov jav.'},
  {q:'Laser pracuje na princípe:',a:2,opts:['Spontánnej emisie','Absorpcie fotónov','Stimulovanej emisie žiarenia','Tepelného žiarenia'],exp:'LASER: Light Amplification by Stimulated Emission of Radiation. Koherentné monochromatické svetlo.'},
  {q:'Energia E = mc² vyjadruje:',a:1,opts:['Kinetickú energiu','Ekvivalenciu','Gravitačnú energiu','Tepelnú energiu'],exp:'Einstein: E = mc². Malé množstvo hmotnosti = obrovská energia. Základ jadrovej energie.'},
  {q:'Kozmické rýchlosti: prvá kozmická rýchlosť (orbitálna) je ≈',a:3,opts:['11,2 km/s','3 km/s','300 000 km/s','7,9 km/s'],exp:'1. kozmická rýchlosť: 7,9 km/s (obeh okolo Zeme). 2.: 11,2 km/s (únik z gravitácie Zeme).'},
]);

addQ(4,'r','ang',[
  {q:'Preložte: Keby som bol vedel, nebol by som prišiel.',a:0,opts:['If I had known, I would not have come.','If I knew, I would not come.','If I have known, I would not come.','If I know, I will not come.'],exp:'3. kondicionál: If + past perfect → would have + past participle. Nereálna minulá podmienka.'},
  {q:'"Notwithstanding" znamená:',a:2,opts:['Preto','Okrem toho','Napriek','Následne'],exp:'"Notwithstanding" = napriek tomu, bez ohľadu na (formálne/právnické).'},
  {q:'Preložte (pasívum): Zákon bol schválený parlamentom.',a:1,opts:['Parliament approved the law.','The law was approved by parliament.','The law is approved.','Parliament has the law approved.'],exp:'Pasívum: The law was approved by parliament. Agent (by parliament) je voliteľný.'},
  {q:'Cleft sentence "It was John who broke the window" zdôrazňuje:',a:3,opts:['Okno','Čin','Čas','Meno John (kto to urobil)'],exp:'Cleft sentence: zdôrazňuje konkrétnu časť vety. It was... who/that/which.'},
  {q:'Subjunctive mood v "I suggest that he leave immediately" vyjadruje:',a:0,opts:['Návrh/žiadosť','Prítomný čas','Minulý čas','Podmieňovací spôsob'],exp:'Subjunctive: po suggest, recommend, insist, demand + that + základný tvar. (He leave, nie leaves.)'},
  {q:'Preložte: Ľutujem, že som to neurobil.',a:2,opts:['I regret to not do it.','I regret I did not do this.','I regret not having done it.','I regret to not having done it.'],exp:'"Regret + not having done": gerundium dokonané. Ľutovanie minulého činu.'},
  {q:'"Lest" sa používa:',a:1,opts:['Na vyjadrenie podmienky','Aby sa niečo nestalo (aby nie)','Na vyjadrenie príčiny','Na vyjadrenie výsledku'],exp:'"Lest" = aby nie, zo strachu, že (archaické/formálne). Speak quietly lest you wake him.'},
  {q:'Maturitná angličtina B2 — discourse marker "Having said that":',a:3,opts:['Vyjadruje podmienku','Uvádza príklad','Zhŕňa záver','Vyjadruje kontrast'],exp:'"Having said that" = to však povedané, napriek tomu. Formálny kontrast v diskurze.'},
]);


// ═══════════════════════════════════════════
// 4. ROČNÍK — EDUCAST PLUS (VÝZVA + MASTER)
// ═══════════════════════════════════════════

// ── 4R VÝZVA ──
addQ(4,'v','slj',[
  {q:'Jazyková kultúra zahŕňa:',a:0,opts:['Pestovanie jazykovej','Len pravopis a gramatiku','Len literárny jazyk','Len hovorený prejav'],exp:'Jazyková kultúra: správnosť (norma), kultivovanosť (štýl), efektívnosť (komunikačný zámer). Kodifikácia vs. prax.'},
  {q:'Maturitný slohový útvar — úvaha sa líši od eseje:',a:1,opts:['Úvaha je kratšia vždy','Esej je osobnejšia, voľnejšia;','Sú totožné útvary','Úvaha má vždy záver, esej nie'],exp:'Esej: osobný, experimentálny, subjektívny. Úvaha: systematická argumentácia, logická výstavba, tézové tvrdenia.'},
  {q:'Interpretácia umeleckého textu sa skladá z:',a:2,opts:['Len preprávania obsahu','Len biografického kontextu autora','Analýzy formy a obsahu, kontextualizácie,','Len zoznamu literárnych prostriedkov'],exp:'Interpretácia: čo text hovorí (téma, motívy) + ako (forma, jazyk, štýl) + prečo (kontext, funkcia, hodnota).'},
  {q:'Slovenský jazyk patrí do jazykovej rodiny:',a:3,opts:['Germánskej','Románskej','Baltskej','Slovanskej'],exp:'Indoeurópske jazyky → slovanská vetva → západná slovančina → slovenčina. Najbližší: čeština a poľština.'},
  {q:'Čo je jazyková interferencia v bilingvizme?',a:1,opts:['Zámerné striedanie jazykov','Neúmyselný prenos prvkov','Pozitívny transfer znalostí','Vytvorenie nového jazyka'],exp:'Interferencia: sl. "som doma" → angl. "I am at home" (nie "I am home"). Fonetická, gramatická, lexikálna.'},
  {q:'Slohová analýza textu zahŕňa určenie:',a:0,opts:['Štýl, slohový postup,','Len gramatických chýb','Len témy a myšlienky','Len autorského zámeru'],exp:'Kompletná slohová analýza: funkčný štýl + slohový útvar + postup + jazykové prostriedky + kompozícia.'},
  {q:'Produktívne tvorenie slov v slovenčine zahŕňa:',a:2,opts:['Len preberanie cudzích slov','Len skladanie slov','Odvodzovanie (prefixácia,','Len univerbizáciu'],exp:'Slovotvorba: derivácia (pracovník), kompozícia (veľkomesto), skratky (SAV), univerbizácia (minerálka).'},
  {q:'Maturitná slohová práca — kritériá hodnotenia:',a:3,opts:['Len pravopis a gramatika','Len téma a obsah','Len rozsah a forma','Obsah, kompozícia, jazykové'],exp:'Maturita SLJ: obsah (30%), kompozícia (20%), jazykové prostriedky (30%), pravopis (20%). Minimálny rozsah 1,5 strany.'},
]);

addQ(4,'v','lit',[
  {q:'Slovenská literatúra 20. storočia — Dominik Tatarka je reprezentantom:',a:0,opts:['Existenciálnej a protikomunistickej','Socialistického realizmu','Naturizmu','Maturitnej lektúry pre základné školy'],exp:'Tatarka: Démon súhlasu (1956) — existencialistická kritika konformizmu. Farský republika. Zakázaný po 1968.'},
  {q:'Moderná slovenská poézia — Miroslav Válek:',a:1,opts:['Patrí k naturizmu','Je predstaviteľ civilizmu a','Písal výhradne epickú poéziu','Patril k DAV-u'],exp:'Válek: Dotyky (1959) — civilizmus, láska, smrť, každodennosť. Jeden z najvýznamnejších slovenských básnikov 20. stor.'},
  {q:'Ján Johanides — Súkromie (1963) patrí k:',a:2,opts:['Socialistickému realizmu','Lyrizovanej próze','Existenciálnej próze 60.','Naturizmu'],exp:'Johanides: 60. roky = slovenská "nová vlna". Súkromie: existenciálna odcudzenosť, absurdita, moderná technika.'},
  {q:'Maturitná lektúra — Smrť krásnych sŕn (Mináč):',a:3,opts:['Je to román o láske','Je zbierka poézie','Je divadelná hra','Je zbierka poviedok o'],exp:'Vladimír Mináč: Smrť krásnych sŕn (1959) — poviedky o SNP. Hrdinstvo vs. zbabelosť, ľudskosť vo vojne.'},
  {q:'Literatúra faktu sa odlišuje od dokumentárnej literatúry:',a:1,opts:['Sú totožné pojmy','Literatúra faktu využíva literárne','Dokumentárna je umeleckejšia','Literatúra faktu je vždy beletria'],exp:'Literatúra faktu: Kapote "In Cold Blood" — reálne udalosti spracované literárne. Hranica fikcia/realita.'},
  {q:'Postmodernistická slovenská literatúra (po 1989):',a:0,opts:['Ballek, Vilikovský, Mitana','Tatarka, Mináč, Válek — existencializmus','Figuli, Švantner — naturizmus','Krasko, Jesenský — moderna'],exp:'Pavel Vilikovský: Večne je zelený... — irónia, intertextualita. Peter Pišťanek: Rivers of Babylon — postmoderná satira.'},
  {q:'Epická šírka románu vs. úspornosť novely — kľúčový rozdiel:',a:2,opts:['Román je vždy dlhší ako novela','Novela má vždy šťastný koniec','Román rozvíja viac dejových línií,','Sú to totožné žánre'],exp:'Román: rozvetvený, mnoho postáv. Novela (Heyse): Falkentheorie — jeden ústredný motív, ostrá pointa, zvrat.'},
  {q:'Analýza literárneho textu na maturite zahŕňa:',a:3,opts:['Len prepísanie obsahu','Len určenie žánru','Len citáty z textu','Tému, kompozíciu,'],exp:'Maturita LIT: kontext (autor, obdobie) + rozbor (téma, žáner, kompozícia, postavy, jazyk) + vlastný postoj.'},
]);

addQ(4,'v','mat',[
  {q:'Maturitná matematika — riešenie kvadratickej nerovnice x²-5x+6>0:',a:0,opts:['x < 2 alebo x > 3','2 < x < 3','x ≤ 2 alebo x ≥ 3','x > 6'],exp:'x²-5x+6=(x-2)(x-3)>0. Parabola otvorená nahor → kladná mimo koreňov: x<2 alebo x>3.'},
  {q:'Goniometrické funkcie — hodnota sin(150°):',a:1,opts:['−1/2','1/2','√3/2','−√3/2'],exp:'sin(150°) = sin(180°-30°) = sin(30°) = 1/2. Referenčný uhol 30°, 2. kvadrant → sinus kladný.'},
  {q:'Logaritmická rovnica log₂(x)+log₂(x-2)=3:',a:2,opts:['x = 4','x = 2','x = 4 (overenie: log₂4+log₂2=2+1=3 ✓)','x = 8'],exp:'log₂(x(x-2))=3 → x(x-2)=8 → x²-2x-8=0 → (x-4)(x+2)=0 → x=4 (x=-2 nevyhovuje, log záporného čísla neexistuje).'},
  {q:'Kombinatorika — koľko 4-ciferných čísel možno zostaviť z číslic 1,2,3,4,5 bez opakovania?',a:3,opts:['20','60','100','120'],exp:'Permutácie 5 prvkov na 4 miestach: P(5,4) = 5!/(5-4)! = 5×4×3×2 = 120.'},
  {q:'Analytická geometria — vzdialenosť bodu P(3,4) od počiatku:',a:1,opts:['3,5','5','7','12'],exp:'d = √(3²+4²) = √(9+16) = √25 = 5. Pytagorova veta v súradnicovom systéme.'},
  {q:'Integrálny počet — obsah plochy ohraničenej f(x)=x² a osou x na [0,3]:',a:0,opts:['9','6','3','27'],exp:'∫₀³ x² dx = [x³/3]₀³ = 27/3 - 0 = 9.'},
  {q:'Postupnosť aₙ = 2n+1 má súčet prvých 10 členov:',a:2,opts:['55','100','120','110'],exp:'Aritmetická postupnosť: a₁=3, a₁₀=21, d=2. Sₙ = n(a₁+aₙ)/2 = 10(3+21)/2 = 10×12 = 120.'},
  {q:'Pravdepodobnosť — z 52 kariet vyberieme 1. P(srdce):',a:3,opts:['1/52','1/4','4/13','13/52 = 1/4'],exp:'13 srdcí z 52 kariet: P = 13/52 = 1/4. Klasická pravdepodobnosť: priaznivé/všetky možnosti.'},
]);

addQ(4,'v','dej',[
  {q:'Slovenské národné povstanie (SNP) 1944:',a:0,opts:['Vypuklo 29. augusta 1944','Bolo čisto vojenskou akciou bez ľudovej účasti','Bolo úspešné a zvrhlo Tisov režim','Začalo sa v Bratislave'],exp:'SNP 29.8.1944: Banská Bystrica centrum. Vojaci, partizáni, civilisti. Potlačené októbrom 1944. Symbol odboja.'},
  {q:'Februárový prevrat 1948 v ČSR znamenal:',a:1,opts:['Demokratické voľby KSČ','Komunistický prevrat','Mierový prechod k socializmu bez obetí','Vojenskú intervenciu ZSSR'],exp:'Február 1948: Gottwald, KSČ prevzala moc. Beneš abdikoval. Začiatok komunistickej diktatúry (1948-1989).'},
  {q:'Pražská jar 1968 — hlavná myšlienka:',a:2,opts:['Návrat ku kapitalizmu','Nezávislosť od ZSSR vojenskou cestou','Socializmus s ľudskou tvárou','Zjednotenie s Rakúskom'],exp:'Dubček: "socializmus s ľudskou tvárou" — sloboda tlače, rehabilitácie, federalizácia. Potlačené 21.8.1968.'},
  {q:'Federalizácia ČSSR (1969) vytvorila:',a:3,opts:['Samostatné Slovensko','Tri republiky','Konfederáciu','Česko-Slovenskú'],exp:'1.1.1969: ČSFR = ČSR + SSR. Jediný výsledok Pražskej jari, ktorý Husák zachoval. Základ rozdelenia 1993.'},
  {q:'Nežná revolúcia na Slovensku (1989):',a:1,opts:['Začala sa v Bratislave 17.11.1989','Verejnosť proti násiliu (VPN)','Bola potlačená vojensky','Mečiar bol jej hlavným lídrom'],exp:'VPN (Ján Budaj, Fedor Gál): 25.11.1989 — Námestie SNP, 100 000 ľudí. Komunisti odovzdali moc.'},
  {q:'Rozdelenie Česko-Slovenska (1.1.1993) bolo:',a:0,opts:['Mierové rozdelenie','Výsledok referenda občanov','Vynútené medzinárodnými tlakmi','Spôsobené vojnovým konfliktom'],exp:'Zamatový rozvod: Mečiar + Klaus. Bez referenda. 1.1.1993 — vznik SR a ČR. Jediné mierové rozdelenie štátu 20. stor.'},
  {q:'Vstup SR do NATO a EÚ:',a:2,opts:['1999 a 2002','2002 a 2004','2004 (obe)','2004 NATO a 2007 EÚ'],exp:'SR: NATO 29.3.2004, EÚ 1.5.2004. Pod vládou Dzurindu po odmietnutí Mečiara v 1997 (referendový škandál).'},
  {q:'Najdlhšie pôsobiaci slovenský prezident po roku 1993:',a:3,opts:['Michal Kováč','Rudolf Schuster','Ivan Gašparovič','Ivan Gašparovič'],exp:'Kováč: 1993-1998. Schuster: 1999-2004. Gašparovič: 2004-2014 (10 rokov). Kiska: 2014-2019. Čaputová: 2019-2024.'},
]);

addQ(4,'v','bio',[
  {q:'Maturitná biológia — ľudský mozog: frontálny lalok riadi:',a:0,opts:['Pohyb,','Zrak','Sluch','Rovnováhu'],exp:'Frontálny lalok: motorická kôra (pohyb), Brocovo centrum (reč), prefrontálna kôra (rozhodovanie, osobnosť).'},
  {q:'Krvné skupiny AB0 systém — skupina AB je:',a:1,opts:['Univerzálny darca','Univerzálny príjemca','Môže darovať len AB','Nemôže prijať krv od skupiny 0'],exp:'AB: žiadne protilátky anti-A ani anti-B → môže prijať od všetkých (univerzálny príjemca). 0: univerzálny darca.'},
  {q:'Fotoreceptory oka — čípky vs. tyčinky:',a:2,opts:['Tyčinky pre farby, čípky pre tmu','Oba typy vnímajú rovnako','Čípky (farby, ostrý zrak, fovea);','Čípky sú len v periférii sietnice'],exp:'Čípky: 3 typy (červená, zelená, modrá), fovea centralis. Tyčinky: rodopsín, nočné videnie, periféria.'},
  {q:'Maturitná biológia — ľudský reprodukčný systém: ovulácia nastáva:',a:3,opts:['Na začiatku menštruačného cyklu','Počas menštruácie','Na konci cyklu','Okolo 14. dňa 28-dňového cyklu'],exp:'LH surge: folikulostimulačný hormón → zreje folikul → LH vlna → ovulácia 14. deň → žlté teliesko → progesterón.'},
  {q:'Imunitný systém — vakcíny fungujú na princípe:',a:1,opts:['Priameho zabíjania patogénov','Imunologickej pamäte','Blokovania vstupu patogénov','Zvýšenia teploty tela'],exp:'Vakcína: oslabený/inaktivovaný patogén alebo antigén. Primárna odpoveď → pamäťové bunky → rýchlejšia sekundárna odpoveď.'},
  {q:'Ekosystém — biogeochemické cykly: cyklus dusíka zahŕňa:',a:0,opts:['Fixáciu N₂ (baktérie),','Len fotosyntézu a dýchanie','Len rozklad organickej hmoty','Len absorpciu rastlinami'],exp:'N-cyklus: fixácia (Rhizobium) → NH₄⁺ → nitrifikácia (NO₃⁻) → absorpcia rastlinami → rozklad → denitrifikácia (N₂).'},
  {q:'Genetické choroby — Downov syndróm (trizómia 21) vzniká:',a:2,opts:['Bodovou mutáciou génu','Deléciou časti chromozómu','Nedisjunkciou chromozómov','Rekombináciou génov'],exp:'Trizómia 21: nedisjunkcia v meióze I alebo II → gameta s 2 kópiami chr. 21 → po oplodnení: 47 chromozómov.'},
  {q:'Biotechnológie — PCR (polymerázová reťazová reakcia) sa používa na:',a:3,opts:['Syntézu proteínov in vitro','Sekvenovanie génov priamo','Klonovanie organizmov','Amplifikáciu (množenie)'],exp:'PCR (Mullis, Nobel 1993): denaturácia → hybridizácia primerov → elongácia. Exponenciálne množenie. COVID testy, DNA profily.'},
]);

addQ(4,'v','che',[
  {q:'Maturitná chémia — organická chémia: benzén podlieha prednostne:',a:0,opts:['Elektrofilnej aromatickej','Nukleofilnej substitúcii','Adičným reakciám','Eliminačným reakciám'],exp:'Aromaticita: π elektróny stabilizujú kruh → odolnosť voči adícii. SE: nitrácia (HNO₃/H₂SO₄), sulfonácia, halogénácia.'},
  {q:'Biochémia — katabolizmus glukózy: ATP bilancia aeróbneho dýchania:',a:1,opts:['2 ATP celkovo','~36-38 ATP','20 ATP','10 ATP'],exp:'Glykolýza: 2 ATP. Pyruvát dekarboxyl.: 0. Krebsov cyklus: 2 ATP. OXFOS: ~32-34 ATP. Celkovo ~36-38 ATP.'},
  {q:'Analytická chémia na maturite — infračervená spektroskopia (IR) detekuje:',a:2,opts:['Hmotnosť molekúl','Elektrónovú štruktúru','Funkčné skupiny podľa','Farbu zlúčenín'],exp:'IR: každá väzba absorbuje charakteristickú frekvenciu. OH: ~3300 cm⁻¹. C=O: ~1700 cm⁻¹. NH: ~3300 cm⁻¹.'},
  {q:'Plasty — polyetylén tereftalát (PET):',a:3,opts:['Je prírodný polymér','Je kondenzačný polymér bez esterových skupín','Je len pre obalový materiál','Je kondenzačný polyester z kyseliny tereftalovej a'],exp:'PET: -[O-CH₂CH₂-O-CO-C₆H₄-CO]ₙ-. Fľaše, vlákna (polyester). Recyklovateľný. Výroba: esterifikácia + polykondenzácia.'},
  {q:'Chémia životného prostredia — kyslé dažde vznikajú z:',a:1,opts:['CO₂ výhradne','SO₂ a NOₓ reagujúcich s','Ozonového opálenia','Metánu zo spaľovania'],exp:'SO₂ + H₂O → H₂SO₃ → H₂SO₄. NO₂ + H₂O → HNO₃. Zdroj: spaľovanie fosílnych palív. pH < 5,6.'},
  {q:'Redoxná titrácia — manganometria používa:',a:0,opts:['KMnO₄ ako silné oxidačné činidlo','KMnO₄ ako reduktant','NaOH ako titrant','EDTA ako komplexotvornú látku'],exp:'Manganometria: KMnO₄ (fialový) → Mn²⁺ (bezfarebný). Bod ekvivalencie: prvý prebytok KMnO₄ sfarbí roztok ružovo.'},
  {q:'Jadrová chémia — rádioaktívny rozpad α emituje:',a:2,opts:['Elektrón','Fotón','Hélium-4 jadro (²He⁴)','Neutrón'],exp:'α-rozpad: ²He⁴ jadro (2p+2n). Hmotnostné číslo -4, protónové číslo -2. Krátky dosah, nebezpečný pri požití.'},
  {q:'Zelená chémia (12 princípov Anastas) sa zameriava na:',a:3,opts:['Len recykláciu odpadov','Len obnoviteľné zdroje energie','Len elimináciu toxických látok','Prevenciu odpadu, atómovú'],exp:'Anastas (1998): prevenciu odpadu, katalýzu namiesto stechiometrie, obnoviteľné suroviny, zníženie derivatizácie.'},
]);

addQ(4,'v','fyz',[
  {q:'Maturitná fyzika — elektrický obvod: pri sériovom zapojení odporov:',a:0,opts:['Celkový odpor je súčet odporov, prúd je rovnaký vo','Napätie je rovnaké na všetkých, prúd sa delí','Celkový odpor je menší ako najmenší odpor','Výkon sa delí rovnomerne'],exp:'Séria: R_cel = R₁+R₂+... Prúd rovnaký. Napätie sa delí. Paralel: 1/R_cel = Σ1/Rᵢ. Napätie rovnaké.'},
  {q:'Pohyb vo fyzike — voľný pád z výšky h:',a:1,opts:['t = h/g','t = √(2h/g)','t = √(h/g)','t = 2h/g'],exp:'h = ½gt² → t = √(2h/g). g ≈ 9,81 m/s². Rýchlosť pri dopade: v = gt = √(2gh).'},
  {q:'Vlnenie — princíp Huyghensa vysvetľuje:',a:2,opts:['Absorpciu svetla v tenkých vrstvách','Polarizáciu svetla','Difrakciu a lom','Fotoelektrický jav'],exp:'Huyghens: každý bod vlnoplochy → sférické elementárne vlny → obálka = nová vlnoplocha. Difrakcia, lom, odraz.'},
  {q:'Termodinamika — Carnotov cyklus má účinnosť:',a:3,opts:['100% pri dostatočne veľkom výkone','Závisí len od pracovnej látky','Závisí od rýchlosti cyklu','η = 1 - T₂/T₁'],exp:'Carnot: η = 1 - T_studený/T_horúci (v Kelvinoch). Maximálna teoretická účinnosť tepelného stroja. Druhý zákon.'},
  {q:'Jadrová fyzika — polčas rozpadu T₁/₂:',a:1,opts:['Čas za ktorý sa rozpadne celý vzorka','Čas za ktorý sa rozpadne polovica','Závisí od teploty a tlaku','Je rovnaký pre všetky izotopy'],exp:'T₁/₂: konštantný pre daný izotop, nezávisí od podmienok. ¹⁴C: 5730 rokov. ²³⁵U: 703 mil. rokov. Radiodatovanie.'},
  {q:'Optika — šošovková rovnica: 1/f = 1/a + 1/b kde:',a:0,opts:['f = ohnisková vzdialenosť, a = vzd.','f = vlnová dĺžka, a = amplitúda','f = frekvencia, a a b = hrúbky šošovky','a a b sú indexy lomu'],exp:'Šošovková rovnica: 1/f = 1/a + 1/b. Lupa: f > 0 (spojka). Okuliare: f < 0 (rozptylka). Lekársky diopter = 1/f [m⁻¹].'},
  {q:'Elektromagnetizmus — Maxwellove rovnice popisujú:',a:2,opts:['Len statické elektrické polia','Len magnetické polia','Úplnú teóriu elektromagnetizmu','Len elektromagnetické vlny'],exp:'Maxwell (1865): 4 rovnice. Gauss (E a B), Faraday, Ampère-Maxwell. Predpovedal EM vlny rýchlosťou c.'},
  {q:'Fyzika tuhého telesa — moment hybnosti L pri absencii vonkajšieho momentu:',a:3,opts:['Vždy nulový','Rastie lineárne s časom','Klesá exponenciálne','Je zachovaný'],exp:'Zákon zachovania L: ak τ_ext = 0, L = konšt. Baletka stiahne ruky → menší I → väčšia ω. Gyrosk. efekt.'},
]);

addQ(4,'v','ang',[
  {q:'"By 2030, renewable energy ___ 50% of global electricity." (prediction)',a:0,opts:['will have provided','will provide','is providing','provides'],exp:'Will + infinitive: predpoveď/prísľub. Will have + past participle (future perfect): do 2030 sa to stane pred 2030.'},
  {q:'Academic writing — which is the most appropriate thesis statement?',a:1,opts:['"In this essay I will write about climate change."','"Transition to renewables offers environmental and economic benefits."','"Climate change is very bad and we should stop it."','"Many people think climate change is important."'],exp:'Silná téza: špecifická, argumentovateľná, naznačuje štruktúru. Slabá téza: príliš všeobecná alebo faktická.'},
  {q:'"She came across as very ___ during the interview." (pozitívne)',a:2,opts:['arrogant','indifferent','articulate','verbose'],exp:'Articulate = schopný jasne a presvedčivo vyjadriť myšlienky. Arrogant = arogantný. Verbose = príliš mnohohovorniý.'},
  {q:'Maturitná angličtina — formal letter of complaint structure:',a:3,opts:['Dear Friend, casual tone, emoji','Start with small talk, then complaint','No greeting needed','Dear Sir/Madam, formal tone, clear'],exp:'Formal letter: Dear Sir/Madam (neznáma os.) → Yours faithfully. Dear Mr. Smith → Yours sincerely. Jasný cieľ.'},
  {q:'"The proposal ___ by the board before it can proceed."',a:1,opts:['must approve','must be approved','must have approved','should approve'],exp:'Pasívum s modálnym slovesom: must + be + past participle. "The proposal must be approved" = musí byť schválený.'},
  {q:'Register — which sentence is appropriate for a formal report?',a:0,opts:['"The findings suggest that further research is warranted."','"So basically, we found out more research is needed."','"Looks like we need to do more research, tbh."','"More research needs to happen ASAP."'],exp:'Formálny register: pasívum, odborná slovná zásoba (warranted = oprávnený/potrebný), bez skratiek a hovorovosti.'},
  {q:'Which sentence uses a mixed conditional?',a:1,opts:['If she studies hard, she will pass the exam.','If he had saved money, he would be rich now.','If they had arrived earlier, they would have caught the train.','If it rains tomorrow, we will stay inside.'],exp:'Mixed conditional: If + past perfect (minulá podmienka) → would + infinitive (prítomný výsledok). He would be rich now = prítomnosť.'},
  {q:'The word "paradigm shift" (Kuhn) in academic English means:',a:3,opts:['A small improvement in methodology','A change in research topic','A return to traditional methods','A fundamental change in the underlying'],exp:'Kuhn (1962): paradigm shift = vedecká revolúcia. Od geocentrizmu k heliocentrizmu. Od newtonovskej k relativistickej fyzike.'},
]);

// ── 4R MASTER ──
addQ(4,'m','slj',[
  {q:'Filozofia jazyka — lingvistický obrat (linguistic turn) v 20. stor. znamenal:',a:0,opts:['Jazyk sa stal ústrednou kategóriou filozofie','Filozofia prešla k matematickej logike výhradne','Odmietnutie jazyka ako predmetu skúmania','Návrat k aristotelskej rétorike'],exp:'Lingvistický obrat (Wittgenstein, Heidegger, Saussure): filozofia od vedomia k jazyku. Bytie a jazyk sú neoddeliteľné.'},
  {q:'Kritická lingvistika skúma ako jazyk:',a:1,opts:['Funguje gramaticky','Reprodukuje a legitimizuje','Vyvíjal sa historicky','Ovplyvňuje gramatické chyby'],exp:'CL (Fowler, Kress): jazyk nie je neutrálny nástroj. Pasívum skrýva pôvodcov. Nominácie (immigrant vs. refugee).'},
  {q:'Teória jazykových hier (Wittgenstein, Filozofické skúmania):',a:2,opts:['Každé slovo má pevný a jasný zmysel','Jazyk opisuje objektívnu realitu','Zmysel slov závisí od ich použitia v konkrétnej','Všetky jazykové hry majú rovnaké pravidlá'],exp:'Neskorý Wittgenstein: "meaning is use". Jazyk = rodina hier s rôznymi pravidlami. Odmietnutie ideálneho jazyka.'},
  {q:'Etnolingvistika skúma vzťah:',a:3,opts:['Etník a ich hudobných tradícií','Biologického pôvodu jazyka','Len mŕtvych jazykov','Jazyka, kultúry a identity'],exp:'Etnolingvistika (Whorf, Boas): jazyk = mapa kultúry. Rôzne jazyky → rôzna kategorizácia sveta (farby, čas, príbuzenstvo).'},
  {q:'Sémanticha zmena slova — ameliorácia vs. pejorizácia:',a:1,opts:['Sú to totožné javy','Ameliorácia','Oba javy sú len fonologické','Ameliorácia je moderná, pejorizácia stredoveká'],exp:'Villain: lat. villanus (roľník) → záporná postava. Nicely: nice → pôvodne "hlúpy". Sémantická zmena je historická.'},
  {q:'Argumentačná teória — petitio principii (chyba v kruhu) je:',a:0,opts:['Keď záver je zahrnutý v premisách','Keď argument útočí na osobu','Keď sa generalizuje z prípadov','Keď sa sláma uchopí namiesto pravého argumentu'],exp:'Petitio principii: "Boh existuje, lebo Biblia to hovorí, a Biblia je pravdivá, lebo ju napísal Boh." Kruhový dôkaz.'},
  {q:'Pragmatická presupozícia vs. implikácia (Grice):',a:2,opts:['Sú totožné pojmy','Presupozícia je silnejšia','Presupozícia','Implikácia je zabudovaná, presupozícia vyvedená'],exp:'Presupozícia: "Prestal si fajčiť?" — predpokladá že si fajčil. Implikácia: "Niektorí študenti prišli" → nie všetci.'},
  {q:'Slovenský literárny jazyk — kodifikácia Ľ. Štúra 1843:',a:3,opts:['Vychádzala zo záp. slovenčiny (Bernolák)','Vychádzala z latinčiny','Vychádzala z bibličtiny','Vychádzala zo stredoslovenských nárečí'],exp:'Štúr: Náuka reči slovenskiej (1846). Stredoslov. nárečia = základ. Hodža, Hurban. Neskôr upravená Hattalom (1851).'},
]);

addQ(4,'m','lit',[
  {q:'Slovenská literatúra 21. stor. — Michal Hvorecký je predstaviteľom:',a:0,opts:['Postmodernej prózy s dystopickými','Naturizmu','Socialistického realizmu','Historickej romantickej prózy'],exp:'Hvorecký: Tlmočník (2002) — postmoderna, globalizácia, identita. Lovci a zberači: dystopia. Slovenská "nová próza".'},
  {q:'Transmédiálna literatúra a digitálna fikcia:',a:1,opts:['Sú len marginálne javy bez literárnej hodnoty','Rozširujú naratív naprieč médiami','Odmietajú tradičné naratívne štruktúry úplne','Sú totožné s e-knihami'],exp:'Transmedia storytelling (Jenkins): Marvel Universe. Hypertext fiction: nelineárna, čitateľ volí cestu. Afternoon, a story.'},
  {q:'Eco — otvorené dielo (Opera aperta):',a:2,opts:['Dielo bez jasnej štruktúry','Dielo dokončené náhodou','Dielo, ktoré zámerně ponúka','Dielo bez autora'],exp:'Eco (1962): otvorené dielo = text generuje viacero čítaní zámerně. Vs. uzavreté dielo s jednou správnou interpretáciou.'},
  {q:'Naratológia — fokalizácia (Genette) rozlišuje:',a:3,opts:['Autora a rozprávača','Fabulu a sujet','Priamy a nepriamy reč','Kto hovorí (rozprávač) a'],exp:'Genette: rozprávač ≠ fokalizátor. Interná fokalizácia (cez postavu), externá (kamera), nulová (vševediaci).'},
  {q:'Slovenské medzivojnové divadlo — E. B. Lukáč a DAV:',a:1,opts:['Boli jednou skupinou','DAV: marxistickí intelektuáli','Obidvaja písali naturistickú prózu','Obidvaja boli zakázaní za 1. ČSR'],exp:'DAV (1924-1937): ľavicová avantgarda. Lukáč: Spoveď (lyrika), kresťanský existencializmus. Rôzne poetiky.'},
  {q:'Laco Novomeský — jeho poézia je charakteristická:',a:0,opts:['Civilizmom, ľudovosťou a','Romantickým vzdorom','Symbolizmom a dekadenciou','Naturalistickou prózou'],exp:'Novomeský: DAV, komunista, rehabilitovaný 1963. Nedeľa (1927) — jednoduchosť, ľudovosť, sociálna téma. Väznený 1951-1956.'},
  {q:'Adaptácia literárneho diela — čo sa pri nej mení?',a:2,opts:['Nič — adaptácia je presná kópia','Len jazyk a prostredie','Médium, perspektíva, naratívne','Vždy celý príbeh a postavy'],exp:'Adaptácia: Hutcheon — reinterpretácia v novom médiu. Film vs. román: vizuálna vs. slovná narácia. Vernosť vs. tvorivosť.'},
  {q:'Čo je close reading (dôkladné čítanie)?',a:3,opts:['Rýchle čítanie pre porozumenie textu','Čítanie s porozumením pre maturantov','Historicko-biografická analýza','Pomalé, detailné skúmanie textu'],exp:'New Criticism (Richards, Empson, Brooks): text sám osebe, bez biografického kontextu. Ambiguity, irony, paradox.'},
]);

addQ(4,'m','mat',[
  {q:'Riemannov integrál vs. Lebesgueov integrál:',a:0,opts:['Lebesgue integruje širšiu triedu funkcií','Sú totožné','Riemann je modernejší','Lebesgue platí len pre spojité funkcie'],exp:'Riemann: delí os x. Lebesgue: delí os y (meria množiny). Integruje viac funkcií, základ modernej analýzy.'},
  {q:'Abstraktná algebra — čo je Abelova skupina?',a:1,opts:['Skupina s asociativitou a identitou iba','Komutatívna skupina','Každá konečná skupina','Skupina s delením'],exp:'Abelova (komutatívna) skupina: uzavretosť, asociativita, identita, inverz + komutativita. (ℤ,+): abelova. (GL(n),×): nie.'},
  {q:'Teória čísel — Fermatov malý teorém hovorí:',a:2,opts:['aⁿ ≡ a (mod n) pre každé n','a^(p-1) ≡ 0 (mod p) pre prvočíslo p','a^(p-1) ≡ 1 (mod p) ak p je prvočíslo a','aᵖ ≡ 1 (mod p) vždy'],exp:'Fermat: a^(p-1) ≡ 1 (mod p). Základ RSA šifrovania. Dôkaz: Euler. Používa sa v kryptografii.'},
  {q:'Dynamické programovanie rieši problémy:',a:3,opts:['Len triedenia','Len grafové problémy','Len lineárne rovnice','Rozkladom na'],exp:'DP: Bellmanův princíp optimality. Fibonacciiho: bez DP O(2ⁿ), s DP O(n). Knapsack, edit distance, LCS.'},
  {q:'Chaos a fraktály — Mandelbrotova množina je:',a:1,opts:['Jednoducho definovaná konečná množina','Nekonečne komplexná hranica z jednoduchého','Náhodne generovaný fraktál','Deterministická množina bez vzorca'],exp:'Mandelbrot: zₙ₊₁ = zₙ² + c. Bod c patrí do množiny ak |zₙ| ≤ 2 pre všetky n. Sebapodoba, nekonečná komplexnosť.'},
  {q:'Kódovacia teória (Shannon) — informačná entropia H:',a:0,opts:['H = -Σ pᵢ log₂ pᵢ — meria neistotu/informačný obsah','H = Σ pᵢ log₂ pᵢ','H závisí len od počtu symbolov','H je vždy nulová pre deterministické zdroje'],exp:'Shannon (1948): H = -Σ pᵢ log₂ pᵢ. Rovnomerné rozdelenie → max. entropia. Základ kompresie, kryptografie, komunikácie.'},
  {q:'Numerické metódy — Newtonova metóda hľadá:',a:2,opts:['Maximum funkcie','Integrál funkcie','Koreň rovnice f(x)=0','Deriváciu funkcie numericky'],exp:'Newton-Raphson: xₙ₊₁ = xₙ - f(xₙ)/f&#39;(xₙ). Rýchla konvergencia (kvadratická) blízko koreňa. Divergencia ďaleko.'},
  {q:'Teória hier — Nashova rovnováha nastáva keď:',a:3,opts:['Obaja hráči maximalizujú spoločný zisk','Jeden hráč vyhráva maximálne','Hráči spolupracujú','Žiadny hráč si nemôže zlepšiť výsledok'],exp:'Nash (1950, Nobel 1994): každý hráč hrá najlepšiu odpoveď na stratégie ostatných. Väzňova dilema: obaja defektujú.'},
]);

addQ(4,'m','dej',[
  {q:'Pojem "totalitarizmus" (Arendtová, Friedrichovej) opisuje:',a:0,opts:['Systém s ideológiou, terorom, monopolom','Každú diktatúru bez výnimky','Len nacistické Nemecko','Demokratické systémy s silnou vládou'],exp:'Arendt "Origins of Totalitarianism" (1951): ideológia + teror = nová forma vlády. Odlišná od tyranie či autoritarizmu.'},
  {q:'Mnohostranná diplomacia po 1945 — OSN vznikla:',a:1,opts:['V roku 1919 ako nástupca Spoločnosti národov','V San Franciscu 1945 na základe Charty OSN','V Jalte 1945 ako dohoda Veľkej trojky','V Paríži 1946 po mierových konferenciách'],exp:'OSN: San Francisco, 26.6.1945. Charta podpísaná 51 štátmi. Bezpečnostná rada: USA, ZSSR, UK, Francúzsko, Čína (právo veta).'},
  {q:'Dekolonizácia — Alžírska vojna nezávislosti (1954-1962):',a:2,opts:['Bola mierová a rýchla','Alžírsko sa osamostatnilo bez obetí','Bola brutálna','Bol to model dekolonizácie pre iné krajiny'],exp:'FLN vs. Francúzsko. 1,5 milióna mŕtvych. De Gaulle uznali nezávislosť (Éviansk. dohody). Fanon: "Zakliate zeme".'},
  {q:'Globalizácia — "Washington Consensus" (1989) presadzoval:',a:3,opts:['Sociálnu politiku a redistribúciu','Regionálnu ekonomickú integráciu','Protekcionizmus a štátne podniky','Liberalizáciu, privatizáciu, fiškálnu'],exp:'Williamson: 10 politík pre rozvojové krajiny. MMF, Svetová banka. Kritika: zvyšovanie nerovností v 90. rokoch.'},
  {q:'Pamäť a trauma v 20. storočí — post-pamäť (Hirsch):',a:1,opts:['Je identická s priamou pamäťou','Je pamäť druhej generácie','Týka sa len historikov','Je len umelecký koncept bez reálneho základu'],exp:'Marianne Hirsch: post-memory — deti preživších holokaustu nesú traumy rodičov ako svoje vlastné.'},
  {q:'Vznik Európskej únie — Maastrichtská zmluva (1992):',a:0,opts:['Vytvorila EÚ z EHS','Vytvorila NATO','Rozšírila EÚ na východ','Bola len obchodnou zmluvou'],exp:'Maastricht 1992: EÚ s 3 piliermi (spoločenstvo, SZBP, JHA). Kritériá konvergencie pre euro. Ratifikácia v referende.'},
  {q:'Historiografia holokaustu — funkcionalizmus vs. intencionalizmus:',a:2,opts:['Sú totožné teórie','Intencionalizmus popiera holokaust','Intencionalizmus','Funkcionalizmus pripisuje vinu výhradne SS'],exp:'Intentionalism (Dawidowicz): cielená politika od 1933. Functionalism (Broszat, Mommsen): evolúcia, chaotická byrokracia.'},
  {q:'Stredná Európa po 1989 — Višegradská skupina (V4):',a:3,opts:['Vznikla počas komunizmu','Je vojenská aliancia mimo NATO','Súperí s EÚ','ČR, SR, Poľsko, Maďarsko'],exp:'V4: Bratislava 1991 — Havel, Wałęsa, Antall. Koordinácia pre vstup do NATO (1999) a EÚ (2004).'},
]);

addQ(4,'m','bio',[
  {q:'Synthetická evolučná teória (Moderná syntéza) kombinuje:',a:0,opts:['Darwinov prírodný výber + Mendelovu','Len Darwinov výber','Len genetiku bez prírodného výberu','Lamarckizmus s genetikou'],exp:'Moderná syntéza (Dobzhansky, Mayr, Simpson): dedičnosť (Mendel) + variabilita (mutácie) + výber (Darwin) + drift.'},
  {q:'Evo-devo (evolučná vývojová biológia) skúma:',a:1,opts:['Len embryológiu cicavcov','Ako zmeny v génoch','Len fosílne záznamy','Len molekulárnu fylogenézu'],exp:'Evo-devo: Hox gény určujú telesný plán. Malé zmeny v regulačných génoch → veľká morfologická diverzita.'},
  {q:'Mikrobiálna ekológia — metagenomika umožňuje:',a:2,opts:['Klonovanie mikróbov','Kultiváciu nekultivovateľných baktérií','Sekvenovanie celého mikrobiomu bez kultivácie','Identifikáciu mikróbov len morfológiou'],exp:'Metagenomika: DNA priamo z prostredia. Odhalila obrovskú diverzitu (> 99% baktérií nekultivovateľných). Human microbiome project.'},
  {q:'Syntetická biológia sa zameriava na:',a:3,opts:['Len génové inžinierstvo rastlín','Len výrobu liečiv baktériami','Len bioinformatiku','Dizajn a konštrukciu nových'],exp:'SynBio: Craig Venter (prvá syntetická bunka 2010). BioBricks. iGEM. Metabolic engineering. Etické otázky biosafety.'},
  {q:'Neuroplasticita mozgu znamená:',a:1,opts:['Mozog je po dospelosti nemenný','Mozog sa mení funkčne aj štrukturálne','Len poškodený mozog sa regeneruje','Plasticita sa týka len hippocampu'],exp:'Neuroplasticita: Hebb (1949) — "neurons that fire together, wire together". LTP. Rehabilitácia po mozgových príhodách.'},
  {q:'Bioetika — princíp autonómie (Beauchamp, Childress) v medicíne:',a:0,opts:['Pacient má právo rozhodovať o svojej','Lekár vždy rozhoduje o liečbe','Autonómia platí len pre dospelých','Je najmenej dôležitý z princípov'],exp:'4 princípy bioetiky: autonómia, beneficencia (dobro), non-maleficencia (neublížiť), spravodlivosť. Autonómia = základ.'},
  {q:'Epigenetika — metylácia DNA:',a:2,opts:['Mení sekvenciu DNA','Aktivuje vždy génovú expresiu','Pridáva metylové skupiny na','Je trvalá a nevratná'],exp:'DNA metylácia (5-metylcytozín): epigenetická značka. Promótory → transkripčný útlm. Reverzibilná. Dedená somaticky.'},
  {q:'Biodiverzita — IUCN červený zoznam kategorizuje:',a:3,opts:['Len vyhynuté druhy','Len ohrozené cicavce','Len morské organizmy','Druhy podľa rizika'],exp:'IUCN: Least Concern → Near Threatened → Vulnerable → Endangered → Critically Endangered → Extinct in Wild → Extinct.'},
]);

addQ(4,'m','che',[
  {q:'Supramolekulárna samoorganizácia (self-assembly) v nanochémii:',a:0,opts:['Spontánne usporiadanie molekúl','Kovalentná syntéza nanotrubok','Chemická reakcia pri vysokých teplotách','Len biologické systémy'],exp:'Self-assembly: lipozómy, DNA origami, metal-organic frameworks (MOF), supramolekulárne kryštály. Bottom-up prístup.'},
  {q:'Katalýza prenosovými kovmi — oxidačno-redukčná katalýza:',a:1,opts:['Prechodné kovy nemôžu katalyzovať','Prechodné kovy menia oxidačné stavy a','Katalýza je len heterogénna','Len enzymatická katalýza je efektívna'],exp:'Pd: Heck, Suzuki, Negishi (Nobel 2010). Ru: Grubbs (metatéza, Nobel 2005). Homogénna katalýza v org. syntéze.'},
  {q:'Hmotnostná spektrometria (MS) poskytuje:',a:2,opts:['Absorpčné spektrum molekuly','Vibračné frekvencie väzieb','Hmotnosť molekuly a fragmentačný','Jadrovú magnetickú rezonanciu'],exp:'MS: ionizácia → urýchlenie → separácia podľa m/z → detektor. ESI-MS pre proteíny. MALDI-TOF pre DNA/proteíny.'},
  {q:'Kvantová chémia DFT (Density Functional Theory):',a:3,opts:['Je ménej presná ako Hartree-Fock vždy','Nedá sa aplikovať na veľké molekuly','Je len aproximatívna teória bez základov','Nahradila vlnovú funkciu elektrónovej hustotou'],exp:'DFT: Hohenberg-Kohn teorémy, Kohn-Sham rovnice. B3LYP, PBE funkcionály. Zlatý štandard bioanorg. a materiálovej chémie.'},
  {q:'Kombinatoriálna chémia a high-throughput screening:',a:1,opts:['Syntetizuje jeden produkt s maximálnou čistotou','Paralelne syntetizuje tisíce zlúčenín a testuje','Nahradila klasickú syntézu úplne','Je len bioinformatická metóda'],exp:'HTS: robotizovaná syntéza + biologické testy. Farmaceutický priemysel: z 10 000 látok → 1 liek za ~15 rokov.'},
  {q:'Elektrochémia — palivový článok (fuel cell) premieňa:',a:0,opts:['Chemickú energiu priamo na elektrickú','Teplo na elektrinu ako termočlánok','Svetlo na elektrinu ako fotovoltaika','Mechanickú energiu na elektrinu'],exp:'Palivový článok: anóda H₂ → 2H⁺ + 2e⁻. Katóda: O₂ + 4H⁺ + 4e⁻ → 2H₂O. Účinnosť ~60% (vs. spaľovací motor ~25%).'},
  {q:'Astrochémia — medziplanetárne médium obsahuje:',a:2,opts:['Len atómy vodíka','Len inerntné plyny','Viac ako 200 molekúl','Len anorganické molekuly'],exp:'Medzihviezdne médium: H₂, CO, H₂O, NH₃, HCN, glykolaldehyd (cukor), glycín (aminokyselina). Panspermia hypotéza.'},
  {q:'Elektrochemické skladanie energie — lítium-iónové batérie:',a:3,opts:['Používajú metalické lítium ako katódu','Sú nenabíjateľné primárne články','Sú menej efektívne ako olovené akumulátory','Intercalate Li⁺ do LiCoO₂/grafit — Nobel 2019'],exp:'Li-ion: katóda LiCoO₂ alebo LiFePO₄, anóda grafít. Li⁺ intercaluje pri nabíjaní. Hustota energie > Pb článkov.'},
]);

addQ(4,'m','fyz',[
  {q:'Kvantová teória poľa (QFT) — virtuálne čatice sú:',a:0,opts:['Matematické propagátory v Feynmanových diagramoch','Skutočné čatice cestujúce rýchlejšie ako svetlo','Hypotetické nemerapované objekty','Len matematická fikcia bez fyzikálneho zmyslu'],exp:'Virtuálne čatice: off-shell (porušujú E-p reláciu). Fotóny sprostredkúvajú EM silu. Feynmanove diagramy = perturbačný rozvoj.'},
  {q:'Kvantová gravitácia — hlavné prístupy sú:',a:1,opts:['Len reťazcová teória','Reťazcová teória a Loop Quantum Gravity','Len LQG','Štandardný model zahŕňa gravitáciu'],exp:'String theory: extra dimenzie, gravitón ako vibračný mód. LQG: priestor je diskrétny (spin siete). Obe predpovedajú Planckovu dĺžku ~10⁻³⁵ m.'},
  {q:'Entropia čiernej diery (Bekenstein-Hawking):',a:2,opts:['Je nulová — čierna diera nemá vnútorné stavy','Závisí od hmotnosti lineárne','Je úmerná ploche horizontu udalostí (nie objemu)','Závisí od teploty okolia'],exp:'S_BH = A/(4l_P²). Bekenstein (1973), Hawking (1974). Entropia ∝ plocha, nie objem → holografický princíp.'},
  {q:'Kozmologická konštanta Λ (temná energia):',a:3,opts:['Einstein ju odstránil ako chybu','Je nulová podľa moderných meraní','Spôsobuje spomaľovanie expanzie','Spôsobuje zrýchlenú expanziu vesmíru'],exp:'Supernovy Ia (1998): vesmír sa zrýchľuje. Λ ≈ 68% energetickej hustoty. Temná energia: neznáma fyzika.'},
  {q:'Kvantový výpočet — Shorový algoritmus:',a:1,opts:['Hľadá prvočíselné faktory lineárne ako klasický počítač','Faktorizuje čísla exponenciálne rýchlejšie ako klasické algoritmy','Je len teoretický bez praktickej implementácie','Pracuje rovnako rýchlo ako klasický počítač'],exp:'Shor (1994): faktorizácia v O(log³N) vs. klasické O(exp). 2048-bit RSA: klasicky milióny rokov, kvantovo hodiny.'},
  {q:'Supravodivé qubity — problém dekoherencie:',a:0,opts:['Interakcia s prostredím ruší kvantové superpozie','Dekoherencia nie je problém pri dostatočne nízkych teplotách','Dekoherencia platí len pre fotonické qubity','Dekoherencia sa dá úplne eliminovať chladením'],exp:'Dekoherencia: qubit stráca superpozíciu interakciou s prostredím (t_2 ~ mikrosekundy). Quantum error correction potrebuje ~1000 fyzických qubitov na 1 logický.'},
  {q:'Fyzika kondenzovanej hmoty — topologické izolátory:',a:2,opts:['Sú izolátory vo všetkých smeroch','Sú supravodiče pri nízkych teplotách','Sú izolátory v objeme ale vodia na povrchu','Sú klasické polovodiče'],exp:'Topologické izolátory (Kane, Mele 2005): Z₂ topologická invarianta. Povrchové stavy chránené symetriou — bez rozptylu na nečistotách.'},
  {q:'Fyzika plazmy — jadrová fúzia v tokamaku:',a:3,opts:['Už funguje komerčne v niekoľkých krajinách','Funguje rovnako ako jadrové štiepenie','Nepotrebuje vysoké teploty','Vyžaduje teploty >100 miliónov K'],exp:'Fúzia: D + T → ⁴He + n + 17,6 MeV. Tokamak: magnetické pole drží plazmu. ITER (Francúzsko): Q>1 cieľ. Komercia ~2050?'},
]);

addQ(4,'m','ang',[
  {q:'Critical thinking in academic English — which is a logical fallacy?',a:0,opts:['Ad hominem','Providing statistical evidence','Using expert testimony','Presenting counter-arguments'],exp:'Ad hominem: "You can&#39;t trust his climate data — he drives an SUV." Attacks person, not argument. Tu quoque, strawman, slippery slope.'},
  {q:'Academic register — hedging in a scientific paper:',a:1,opts:['Expresses certainty: "This proves that..."','Expresses tentativeness','Is considered a weakness in academic writing','Is only used in humanities'],exp:'Hedging: epistemic modality (may, might, could, appears, suggests). Scientific humility, acknowledging limitations, avoiding overstatement.'},
  {q:'Literary criticism — New Historicism (Greenblatt) argues:',a:2,opts:['Literature should be analysed independently of historical context','Historical context is irrelevant for literary meaning','Literary texts are embedded in and produce historical discourse','Literature only reflects economic forces (Marxism)'],exp:'Greenblatt: literature is a "social energy" exchanged between text and non-literary discourses of power. Foucauldian influence.'},
  {q:'The word "jejune" means:',a:3,opts:['lively and energetic','ancient and venerable','extremely formal','naive, simplistic, or'],exp:'Jejune: povrchný, naivný, nenasýtený (lat. jejunus). "A jejune argument" = slabý, nevyzretý argument. C1/C2 slovná zásoba.'},
  {q:'Discourse analysis — Halliday&#39;s systemic functional linguistics sees language as:',a:1,opts:['A formal rule system independent of meaning','Simultaneously ideational (representing reality),','Only a communication tool','A reflection of cognitive structures'],exp:'Halliday: 3 metafunkcie — ideational (obsah), interpersonal (vzťahy), textual (koherencia). SFL základ kritickej analýzy diskurzu.'},
  {q:'"Notwithstanding the aforementioned limitations, the results ___ indicative of a trend."',a:0,opts:['remain','remains','remaining','have remain'],exp:'Subject-verb agreement: "results" (plural) → "remain" (plural verb). "Notwithstanding" = napriek. Formálny akademický register.'},
  {q:'Which correctly uses a non-finite clause?',a:2,opts:['Although having arrived late, but she completed the task.','Having been arrive late, she missed the presentation.','Having arrived late, she missed the introduction.','She having arrived late missed the introduction.'],exp:'Perfect participle clause: Having + past participle = action before main verb. Subject of both clauses must be the same.'},
  {q:'The concept of "intersectionality" (Kimberlé Crenshaw) in social discourse:',a:3,opts:['Refers to road intersection metaphors in urban planning','Describes overlapping academic disciplines','Analyses how different power systems operate separately','Analyses how race, gender, class and other identities overlap'],exp:'Crenshaw (1989): Black women experience compounded discrimination — neither "Black" nor "women" categories capture fully. Critical Race Theory.'},
]);

// Demo otázky pre všetky chýbajúce kombinácie
function makeDemoQs(sName,meta){
  return [
    {q:sName+': '+meta+' — 1',a:0,opts:['Správna odpoveď A','Možnosť B','Možnosť C','Možnosť D'],exp:'Demo otázka. Plná verzia obsahuje reálne otázky zo stredoškolskej látky.'},
    {q:sName+': '+meta+' — 2',a:1,opts:['Možnosť A','Správna odpoveď B','Možnosť C','Možnosť D'],exp:'Demo otázka. Plná verzia obsahuje reálne otázky zo stredoškolskej látky.'},
    {q:sName+': '+meta+' — 3',a:2,opts:['Možnosť A','Možnosť B','Správna odpoveď C','Možnosť D'],exp:'Demo otázka. Plná verzia obsahuje reálne otázky zo stredoškolskej látky.'},
    {q:sName+': '+meta+' — 4',a:3,opts:['Možnosť A','Možnosť B','Možnosť C','Správna odpoveď D'],exp:'Demo otázka. Plná verzia obsahuje reálne otázky zo stredoškolskej látky.'},
    {q:sName+': '+meta+' — 5',a:0,opts:['Správna odpoveď A','Možnosť B','Možnosť C','Možnosť D'],exp:'Demo otázka. Plná verzia obsahuje reálne otázky zo stredoškolskej látky.'},
    {q:sName+': '+meta+' — 6',a:1,opts:['Možnosť A','Správna odpoveď B','Možnosť C','Možnosť D'],exp:'Demo otázka. Plná verzia obsahuje reálne otázky zo stredoškolskej látky.'},
    {q:sName+': '+meta+' — 7',a:2,opts:['Možnosť A','Možnosť B','Správna odpoveď C','Možnosť D'],exp:'Demo otázka. Plná verzia obsahuje reálne otázky zo stredoškolskej látky.'},
    {q:sName+': '+meta+' — 8',a:3,opts:['Možnosť A','Možnosť B','Možnosť C','Správna odpoveď D'],exp:'Demo otázka. Plná verzia obsahuje reálne otázky zo stredoškolskej látky.'},
  ];
}
[1,2,3,4].forEach(function(r){
  ['r','v','m'].forEach(function(l){
    SUBS.forEach(function(s){
      var k=r+'_'+l+'_'+s.id;
      if(!DB[k]){
        var meta=(META[r]&&META[r][l]&&META[r][l][s.id])?META[r][l][s.id]:s.name;
        DB[k]=makeDemoQs(s.name,meta);
      }
    });
  });
});

// ═══════════════════════════════════════════
// PAGE NAVIGATION
// ═══════════════════════════════════════════
function showPage(id){
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  var target = el(id);
  if(target) target.classList.add('active');
  window.scrollTo(0,0);
}

var _profileCodeShown = false;
var _profileCodeVal = '';

function showProfile(){
  if(!authState.loggedIn){ openAuth(); return; }
  showPage('page-profile');
  var loading = el('profile-loading');
  var content = el('profile-content');
  if(loading) loading.style.display='block';
  if(content) content.style.display='none';
  _profileCodeShown = false;
  fetch('https://mcusipcyapsuvrbnxtkw.supabase.co/rest/v1/access_codes?email=eq.' + encodeURIComponent(authState.email) + '&select=code,email,tier,valid_until&order=valid_until.desc&limit=1', {
    headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON }
  })
  .then(function(r){ return r.json(); })
  .then(function(rows){ fillProfile((rows && rows.length) ? rows[0] : null); })
  .catch(function(e){ console.error('Profile load error:', e); fillProfile(null); });
}

function fillProfile(rec){
  var loading = el('profile-loading');
  var content = el('profile-content');
  if(loading) loading.style.display='none';
  if(content) content.style.display='block';
  elSet('profile-email','textContent', authState.email);
  var title = el('profile-status-title');
  var sub = el('profile-status-sub');
  var card = el('profile-status-card');
  if(rec && (rec.tier==='p' || rec.tier==='v' || rec.tier==='m')){
    _profileCodeVal = rec.code || '';
    if(title) title.textContent = '🎓 EDUCAST PLUS · aktívne';
    if(rec.valid_until){
      var d = new Date(rec.valid_until);
      var datum = d.toLocaleDateString('sk-SK', {day:'numeric', month:'long', year:'numeric'});
      var expired = Date.now() > d.getTime();
      if(sub) sub.textContent = expired ? ('Vypršalo ' + datum) : ('Platné do ' + datum + ' · obnovuje sa automaticky');
    } else { if(sub) sub.textContent = 'Aktívny prístup'; }
  } else {
    _profileCodeVal = '';
    if(title) title.textContent = '📘 EDUCAST free';
    if(sub) sub.textContent = 'Zatiaľ nemáš aktívne PLUS predplatné';
    if(card){ card.style.background='#1a1a1a'; card.style.borderColor='#2a2a2a'; }
  }
  _profileCodeShown = false;
  var codeEl = el('profile-code');
  var tgl = el('profile-code-toggle');
  if(_profileCodeVal){
    if(codeEl) codeEl.textContent = '••••••••••';
    if(tgl){ tgl.textContent='👁 Zobraziť'; tgl.style.display='inline-block'; }
  } else {
    if(codeEl) codeEl.textContent = '—';
    if(tgl) tgl.style.display='none';
  }
  if(typeof loadPaymentHistory==='function') loadPaymentHistory();
}

function toggleProfileCode(){
  _profileCodeShown = !_profileCodeShown;
  var codeEl = el('profile-code');
  var tgl = el('profile-code-toggle');
  if(_profileCodeShown){
    if(codeEl) codeEl.textContent = _profileCodeVal;
    if(tgl) tgl.textContent = '🙈 Skryť';
  } else {
    if(codeEl) codeEl.textContent = '••••••••••';
    if(tgl) tgl.textContent = '👁 Zobraziť';
  }
}

function cancelSubscription(){
  if(!authState.loggedIn || !_profileCodeVal){ return; }
  if(!confirm('Naozaj chceš zrušiť predplatné? Prístup ti zostane do konca zaplateného obdobia, potom sa už neobnoví.')) return;
  var btn = el('profile-cancel-btn');
  if(btn){ btn.disabled = true; btn.textContent = 'Ruším…'; }
  fetch('https://mcusipcyapsuvrbnxtkw.supabase.co/functions/v1/cancel-subscription', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+SUPABASE_ANON },
    body: JSON.stringify({ email: authState.email, code: _profileCodeVal })
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(res.ok){
      // Znova nacitaj stav - prepne tlacidlo na "Obnovit", upravi texty
      loadPaymentHistory();
    } else {
      alert('Zrušenie zlyhalo: ' + (res.error || 'neznáma chyba'));
      if(btn){ btn.disabled = false; btn.textContent = 'Zrušiť predplatné'; }
    }
  })
  .catch(function(e){
    alert('Chyba spojenia: ' + e);
    if(btn){ btn.disabled = false; btn.textContent = 'Zrušiť predplatné'; }
  });
}

function resumeSubscription(){
  if(!authState.loggedIn || !_profileCodeVal){ return; }
  var btn = el('profile-cancel-btn');
  if(btn){ btn.disabled = true; btn.textContent = 'Obnovujem…'; }
  fetch('https://mcusipcyapsuvrbnxtkw.supabase.co/functions/v1/resume-subscription', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+SUPABASE_ANON },
    body: JSON.stringify({ email: authState.email, code: _profileCodeVal })
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(res.ok){
      // Znova nacitaj stav - prepise nadpis, podnadpis aj tlacidlo
      loadPaymentHistory();
    } else {
      alert('Obnovenie zlyhalo: ' + (res.error || 'neznáma chyba'));
      if(btn){ btn.disabled = false; btn.textContent = 'Obnoviť predplatné'; }
    }
  })
  .catch(function(e){
    alert('Chyba spojenia: ' + e);
    if(btn){ btn.disabled = false; btn.textContent = 'Obnoviť predplatné'; }
  });
}

function loadPaymentHistory(){
  var wrap = el('profile-history-list');
  if(!wrap) return;
  if(!authState.loggedIn || !_profileCodeVal){ wrap.innerHTML = ''; return; }
  wrap.innerHTML = '<div style="font-size:11px;color:#666;padding:8px 0">Načítavam…</div>';
  fetch('https://mcusipcyapsuvrbnxtkw.supabase.co/functions/v1/payment-history', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+SUPABASE_ANON },
    body: JSON.stringify({ email: authState.email, code: _profileCodeVal })
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    // Stav predplatneho - jednoduchy, bez protirecenia
    if(res.ok){
      var sub2 = el('profile-status-sub');
      var title2 = el('profile-status-title');
      var cbtn = el('profile-cancel-btn');
      var endDate = null;
      if(res.current_period_end){ endDate = new Date(res.current_period_end * 1000); }
      else if(res.valid_until){ endDate = new Date(res.valid_until); }
      var datum2 = endDate ? endDate.toLocaleDateString('sk-SK', {day:'numeric', month:'long', year:'numeric'}) : 'konca obdobia';
      if(res.cancel_at_period_end){
        // ZRUSENE
        if(title2) title2.textContent = '🎓 EDUCAST PLUS · zrušené';
        if(sub2) sub2.textContent = 'Predplatné je zrušené · prístup platí do ' + datum2;
        if(cbtn){
          cbtn.disabled = false;
          cbtn.textContent = 'Obnoviť predplatné';
          cbtn.onclick = resumeSubscription;
          cbtn.style.cssText = 'width:100%;background:transparent;border:0.5px solid #185FA5;color:#378ADD;font-size:12px;font-weight:500;padding:11px;border-radius:10px;cursor:pointer;font-family:inherit;transition:all 0.12s';
          cbtn.onmouseover = function(){ this.style.borderColor='#378ADD'; };
          cbtn.onmouseout = function(){ this.style.borderColor='#185FA5'; };
        }
      } else {
        // AKTIVNE
        if(title2) title2.textContent = '🎓 EDUCAST PLUS · aktívne';
        if(sub2) sub2.textContent = 'Platné do ' + datum2 + ' · obnovuje sa automaticky';
        if(cbtn){
          cbtn.disabled = false;
          cbtn.textContent = 'Zrušiť predplatné';
          cbtn.onclick = cancelSubscription;
          cbtn.style.cssText = 'width:100%;background:transparent;border:0.5px solid #5a2a2a;color:#c97070;font-size:12px;font-weight:500;padding:11px;border-radius:10px;cursor:pointer;font-family:inherit;transition:all 0.12s';
          cbtn.onmouseover = function(){ this.style.borderColor='#e74c3c'; this.style.color='#e74c3c'; };
          cbtn.onmouseout = function(){ this.style.borderColor='#5a2a2a'; this.style.color='#c97070'; };
        }
      }
    }
    if(!res.ok || !res.invoices || !res.invoices.length){
      wrap.innerHTML = '<div style="font-size:11px;color:#666;padding:8px 0">Zatiaľ žiadne platby.</div>';
      return;
    }
    var html = res.invoices.map(function(inv){
      var d = new Date(inv.date * 1000);
      var datum = d.toLocaleDateString('sk-SK', {day:'numeric', month:'long', year:'numeric'});
      var suma = (inv.amount/100).toFixed(2).replace('.', ',') + ' ' + (inv.currency==='eur'?'€':inv.currency.toUpperCase());
      var stav = inv.status==='paid' ? '<span style="color:#2ecc71">✓ Zaplatené</span>' : ('<span style="color:#888">'+inv.status+'</span>');
      var odkaz = inv.pdf ? ('<a href="'+inv.pdf+'" target="_blank" style="color:#378ADD;text-decoration:none;font-size:11px">PDF ↗</a>') : '';
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:11px 14px;background:#1a1a1a">'
        + '<div><div style="font-size:12px;color:#e8e8e8">'+datum+'</div><div style="font-size:10px;margin-top:2px">'+stav+'</div></div>'
        + '<div style="display:flex;align-items:center;gap:12px"><span style="font-size:13px;font-weight:600;color:#e8e8e8">'+suma+'</span>'+odkaz+'</div>'
        + '</div>';
    }).join('');
    wrap.innerHTML = html;
  })
  .catch(function(e){
    wrap.innerHTML = '<div style="font-size:11px;color:#c97070;padding:8px 0">Históriu sa nepodarilo načítať.</div>';
  });
}
function goToLanding(){
  clearInterval(tT);clearInterval(tTot);tck=false;
  showPage('page-landing');
  lwSubj=null;lwRoc=null;lwMatPred=null;lwMatRok=null;lwChosenLevel=null;
  var ls=document.getElementById('lv-select-screen');
  var ws=document.getElementById('lv-wizard-screen');
  var s1=document.getElementById('lw-step1');
  var s2=document.getElementById('lw-step2');
  var mw=document.getElementById('lw-mat-wiz');
  var sb=document.getElementById('lw-start-btn');
  if(ls)ls.style.display='block';
  if(ws)ws.style.display='none';
  if(s1)s1.style.display='block';
  if(s2)s2.style.display='none';
  if(mw)mw.style.display='none';
  if(sb)sb.className='wiz-start-btn';
  window.scrollTo({top:0,behavior:'smooth'});
}
function toggleFaq(el){el.parentElement.classList.toggle('open');}

// Klik na predmet na landing page — otvorí portál a spustí kvíz
function goToPortalSub(id){
  showPage('page-portal');
  updateAuthUI();
  renderPortal();
  // Krátke oneskorenie aby sa portál renderol pred spustením kvízu
  setTimeout(function(){ launchQuiz(id); }, 100);
}

// ═══════════════════════════════════════════
// PORTAL
// ═══════════════════════════════════════════
function setRoc(r){
  roc=r;
  [1,2,3,4].forEach(function(x){elSet('rt-'+x,'className','rtab'+(x===r?' active':''));});
  renderPortal();
}

function setLv(l){
  if(!hasAccess(l)){showPaywall();return;}
  lv=l;
  ['r','v','m'].forEach(function(x){elSet('lt-'+x,'className','ltab ltab-'+x+(x===l?' active':''));});
  var desc={'r':'🆓 Zadarmo · Základné pojmy a definície','v':'⭐ EDUCAST PLUS · Hlbšia analýza a vzťahy medzi pojmami','m':'👑 EDUCAST PLUS · Pokročilé témy, maturitná úroveň'};
  var bar=el('lv-desc-bar');if(bar)bar.textContent=desc[l]||'';
  renderPortal();
}

function setMode(m){
  md=m;
  elSet('ms','className','mode-btn'+(m==='s'?' sel-s':''));
  elSet('mt','className','mode-btn'+(m==='t'?' sel-t':''));
}


// ════════════════════════════════════════
// WIZARD A — Predmet → Ročník → Štart
// ════════════════════════════════════════
var wizSubj = null;
var wizRoc = null;
var wizLv = 'r';
var wizMd = 't';

var WIZ_SUBS = [
  {id:'slj', icon:'📝', name:'Slovenský jazyk'},
  {id:'lit', icon:'📚', name:'Literatúra'},
  {id:'mat', icon:'🔢', name:'Matematika'},
  {id:'dej', icon:'🌍', name:'Dejepis'},
  {id:'bio', icon:'🔬', name:'Biológia'},
  {id:'che', icon:'⚗️', name:'Chémia'},
  {id:'fyz', icon:'⚡', name:'Fyzika'},
  {id:'ang', icon:'🇬🇧', name:'Angličtina'},
  {id:'maturita', icon:'🎓', name:'Maturitné testy', special:true}
];

function renderWizard(){
  // Synchnizuj wiz s globalnym stavom
  wizLv = lv;
  wizMd = md;
  renderWizSubjects();
  wizUpdateSteps(1);
  wizUpdateSettings();
}

function renderWizSubjects(){
  var grid = el('wiz-subj-grid');
  if(!grid) return;
  grid.innerHTML = WIZ_SUBS.map(function(s){
    var sel = wizSubj === s.id;
    var locked = s.special && !hasAccess('v');
    var isV = wizLv === 'v';
    var onclick = s.special
      ? (locked ? 'showPaywall()' : 'wizSelectMaturita()')
      : 'wizSelectSubj(\'' +s.id+ '\')';
    return '<div class="wiz-subj-card'+(isV?' v-mode':'')+(sel?' sel':'')+'" onclick="'+onclick+'" style="'+(s.special?'position:relative':'')+'">'
      +(locked?'<div style="position:absolute;top:4px;right:6px;font-size:10px">🔒</div>':'')
      +(s.special && !locked?'<div style="position:absolute;top:4px;right:6px;font-size:9px;color:#7F77DD;background:#1a1528;padding:1px 5px;border-radius:8px">E+</div>':'')
      +'<div class="wiz-subj-icon">'+s.icon+'</div>'
      +'<div class="wiz-subj-name" style="'+(s.special?'color:#CECBF6':'')+'">'+('maturita'===s.id?'Maturitné testy':s.id.toUpperCase())+'</div>'
      +'</div>';
  }).join('');
}

function wizSelectMaturita(){
  if(!hasAccess('v')){ showPaywall(); return; }
  // Scrolluj na maturitnu sekciu
  var ms = el('mat-section');
  if(ms){
    if(!matOpen){ toggleMatSection(); }
    setTimeout(function(){ ms.scrollIntoView({behavior:'smooth'}); }, 100);
  }
}

function wizSelectSubj(id){
  wizSubj = id;
  wizRoc = null;
  // Zobraz krok 2
  elStyle('wiz-step1','display','none');
  elStyle('wiz-step2','display','block');
  var lbl = el('wiz-subj-label');
  var sub = WIZ_SUBS.filter(function(s){return s.id===id;})[0];
  if(lbl && sub) lbl.textContent = sub.icon+' '+sub.name;
  // Reset roc buttons
  ['1','2','3','4'].forEach(function(r){
    var btn = el('wr-'+r);
    if(btn) btn.className = 'wiz-roc-btn';
  });
  // Skry start
  var sb = el('wiz-start-btn');
  if(sb) sb.className = 'wiz-start-btn';
  wizUpdateSteps(2);
}

function wizSetRoc(r){
  wizRoc = r;
  // Highlight vybratý ročník
  ['1','2','3','4'].forEach(function(n){
    var btn = el('wr-'+n);
    if(btn) btn.className = 'wiz-roc-btn'+(parseInt(n)===r?' sel':'');
  });
  // Zobraz start button
  var sb = el('wiz-start-btn');
  if(sb) sb.className = 'wiz-start-btn visible';
  wizUpdateSteps(3);
}

function wizBack(){
  wizSubj = null;
  wizRoc = null;
  elStyle('wiz-step1','display','block');
  elStyle('wiz-step2','display','none');
  var sb = el('wiz-start-btn');
  if(sb) sb.className = 'wiz-start-btn';
  wizUpdateSteps(1);
}

function wizSetLv(l){
  if(l !== 'r' && !hasAccess(l)){showPaywall();return;}
  wizLv = l; lv = l;
  wizUpdateSettings();
  renderWizSubjects();
}

function wizSetMode(m){
  wizMd = m;
  md = m;
  ['t','s'].forEach(function(x){
    var btn = el('wmd-'+x);
    if(btn) btn.className = 'wiz-tog-btn'+(x===m?' active':'');
  });
}

function wizUpdateSettings(){
  ['r','v'].forEach(function(x){
    var btn = el('wlv-'+x);
    if(!btn) return;
    btn.className = x===wizLv ? (x==='v'?'wiz-tog-btn active-v':'wiz-tog-btn active') : 'wiz-tog-btn';
  });
  ['t','s'].forEach(function(x){
    var btn = el('wmd-'+x);
    if(!btn) return;
    if(x===wizMd) btn.className = x==='t'?'wiz-tog-btn active-t':'wiz-tog-btn active-s';
    else btn.className = 'wiz-tog-btn';
  });
  var vBtn = el('wlv-v');
  if(vBtn) vBtn.textContent = hasAccess('v') ? '🎓 EDUCAST PLUS' : '🔒 EDUCAST PLUS';
}

function wizUpdateSteps(active){
  [1,2,3].forEach(function(i){
    var s = el('wiz-s'+i);
    if(!s) return;
    s.className = 'wiz-step'+(i===active?' active':i<active?' done':'');
  });
}

function wizStart(){
  if(!wizSubj || !wizRoc) return;
  // Nastav globálny stav
  roc = wizRoc;
  lv = wizLv;
  md = wizMd;
  // Spusti kvíz
  launchQuiz(wizSubj);
}

function renderPortal(){
  if(typeof updateAuthUI==='function') updateAuthUI();
  var lvNames={r:'EDUCAST free',v:'VÝZVA',m:'MASTER'};
  elSet('subj-title','textContent','Predmety — '+roc+'. ročník · '+lvNames[lv]);
  var meta=META[roc][lv];
  var grid=el('sg');
  if(!grid)return;
  grid.innerHTML='';
  SUBS.forEach(function(s){
    var pct=pgGet(roc,lv,s.id);
    var isLocked=!hasAccess(lv);
    var isDemo=hasAccess(lv)&&lv!=='r';
    var isRealData=DB[roc+'_'+lv+'_'+s.id]&&DB[roc+'_'+lv+'_'+s.id][0]&&DB[roc+'_'+lv+'_'+s.id][0].q.indexOf('—')===-1;
    var badge='';
    if(isLocked){
      badge='<span class="sub-lock-badge">🔒 Vyžaduje predplatné</span>';
    } else if(isDemo&&!isRealData){
      badge='<span class="sub-demo-badge">🧪 Demo ukážka</span>';
    } else {
      badge='<span class="sub-tag st'+lv+'">'+(lv==='r'?'🆓 EDUCAST free':lv==='v'?'⭐ VÝZVA':'👑 MASTER')+'</span>';
    }
    var card=document.createElement('div');
    card.className='sub-card sc-'+lv+(isLocked?' locked':'');
    // Počítadlo: koľko otázok bolo zodpovedaných správne (z histórie)
    var qs=DB[roc+'_'+lv+'_'+s.id]||[];
    var totalQ=qs.length;
    var correctCount=Math.round(pct/100*totalQ);
    var scoreLabel='';
    if(pct>0 && totalQ>0){
      scoreLabel='<div class="sub-score-badge">'+(pct>=80?'✓ ':'')+correctCount+'/'+totalQ+'</div>';
    }
    card.innerHTML='<div class="sub-icon">'+s.icon+'</div>'
      +'<div class="sub-name sn'+lv+'">'+s.name+'</div>'
      +'<div class="sub-meta sm'+lv+'">'+meta[s.id]+'</div>'
      +badge+scoreLabel
      +'<div class="prog-bar pb'+lv+'"><div class="pfs pf'+lv+'" style="width:'+pct+'%"></div></div>'
      +'<div class="sub-pct">'+(pct>0?pct+'% dokončené':'Nezačaté')+'</div>';
    card.addEventListener('click',function(){
      if(isLocked){showPaywall();}
      else{launchQuiz(s.id);}
    });
    grid.appendChild(card);
  });
}



function showPaywall(){var m=el('modal');if(m)m.classList.add('show');}
function hidePaywall(){var m=el('modal');if(m)m.classList.remove('show');}

function startCheckout(plan){
  var emailInput=el('buy-email-input');
  var email = emailInput && emailInput.value ? emailInput.value.trim() : '';
  if(!email){
    email = prompt('Zadaj e-mail pre platbu a doručenie prístupového kódu:');
    if(!email) return;
    email = email.trim();
  }
  if(email.indexOf('@')<0 || email.indexOf('.')<0){ alert('Zadaj platný e-mail.'); return; }
  var btn = el('buy-submit-btn');
  if(btn){ btn.disabled=true; btn.textContent='Presmerúvam na platbu…'; }
  fetch('https://mcusipcyapsuvrbnxtkw.supabase.co/functions/v1/create-checkout',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:email})
  })
  .then(function(r){return r.json();})
  .then(function(d){
    if(d && d.url){ window.location.href = d.url; }
    else { alert('Platbu sa nepodarilo spustiť. Skús znova.'); if(btn){btn.disabled=false;btn.textContent='Zaplatiť kartou →';} }
  })
  .catch(function(e){ console.error('Checkout error:',e); alert('Chyba pripojenia k platobnej bráne. Skús znova.'); if(btn){btn.disabled=false;btn.textContent='Zaplatiť kartou →';} });
}
function closeModal(e){if(e.target===el('modal'))hidePaywall();}

// ═══════════════════════════════════════════
// QUIZ ENGINE
// ═══════════════════════════════════════════

// ── ULOŽENIE STAVU KVÍZU ──
function saveQuizState(){
  if(!sub) return;
  // Ukladanie je PLUS funkcia - FREE pouzivatel dostane paywall
  if(!hasAccess('v')){ showPaywall(); return; }
  var key = sub.isMat
    ? ('edu_mat_save_'+sub.matPred+'_'+sub.matRok)
    : (window._saveKey||('edu_save_'+sub.id));
  var state = sub.isMat
    ? {cur:cur, matAnswers:matAnswers, timeLeft:window._matTime, matPred:sub.matPred, matRok:sub.matRok, savedAt:new Date().toLocaleString('sk-SK')}
    : {cur:cur, scr:scr, answers:answers, tot:tot, savedAt:new Date().toLocaleString('sk-SK')};
  try{
    localStorage.setItem(key, JSON.stringify(state));
    var btn=el('btn-save-quiz');
    if(btn){btn.textContent='✓ Uložené';setTimeout(function(){if(btn)btn.textContent='Uložiť';},1500);}
  }catch(e){}
}

function launchQuiz(id){
  var qs=DB[roc+'_'+lv+'_'+id];
  if(!qs||qs.length===0){return;}
  var sData=SUBS.filter(function(s){return s.id===id;})[0];
  sub={id:id,icon:sData.icon,name:sData.name,qs:qs};
  // Skontroluj uložený stav
  var saveKey='edu_save_'+roc+'_'+lv+'_'+md+'_'+id;
  var saved=null;
  try{var raw=localStorage.getItem(saveKey);if(raw)saved=JSON.parse(raw);}catch(e){}
  if(saved&&saved.cur>0&&confirm('Máš uložený kvíz z '+saved.savedAt+' (otázka '+(saved.cur+1)+'/'+qs.length+'). Pokračovať?')){
    cur=saved.cur;scr=saved.scr;ans=false;tot=saved.tot||0;answers=saved.answers||[];
  } else {
    cur=0;scr=0;ans=false;tot=0;answers=[];
    try{localStorage.removeItem(saveKey);}catch(e){}
  }
  window._saveKey=saveKey;
  clearInterval(tT);clearInterval(tTot);
  showPage('page-quiz');
  elStyle('qs','display','flex');
  elStyle('ss','display','none');
  applyS();
  var c=C[lv];
  elSet('mb','className','mbadge '+(md==='s'?c.mbs:c.mbt));
  elSet('mb','textContent',md==='s'?'⚔️ Súťaž':'📋 Test');
  elSet('cd','className','cd '+c.cd);
  elSet('tt','className','ttim '+c.tt);
  elSet('ci','textContent',roc+'. roč · '+lv.toUpperCase()+' · '+(md==='s'?'⚔️':'📋'));
  if(md==='s'){elStyle('tw','display','block');elStyle('tt','display','none');}
  else{
    elStyle('tw','display','none');
    var tt=el('tt');
    if(tt){tt.style.display='block';}
    if(sub.isMat){
      // 90-minútový odpočet pre maturitné testy
      var matSec=window._matTime||5400;
      var fmtMat=function(s){var m=Math.floor(s/60);var sec=s%60;return'⏱ '+m+':'+(sec<10?'0':'')+sec;};
      if(tt)tt.textContent=fmtMat(matSec);
      tTot=setInterval(function(){
        matSec--;
        if(tt)tt.textContent=fmtMat(matSec);
        if(matSec<=300&&tt)tt.style.color='#e74c3c';
        if(matSec<=0){clearInterval(tTot);showScore();}
      },1000);
    } else {
      if(tt)tt.textContent='⏱ 0:00';
      tTot=setInterval(function(){tot++;if(tt)tt.textContent='⏱ '+fmt(tot);},1000);
    }
  }
  rPips();showQ();
}

function applyS(){
  var c=C[lv];
  elSet('stage','className','stage '+c.bg+' '+c.stb);
  elSet('tb','className','tbar '+c.tb);
  elSet('pbar','className','pfill2 '+c.pf);
  elSet('qn','className','qnum '+c.qn);
  elSet('nb','className','nxt '+c.nx);
  elSet('ss','className','screen sscr '+c.bg);
}

function rPips(){
  var c=C[lv];
  if(sub && sub.isMat){
    var matBar=el('mat-pips-bar');if(matBar)matBar.style.display='block';
    elSet('pips','innerHTML',sub.qs.map(function(_,i){
      var answered = matAnswers[i]!==undefined && matAnswers[i]!=='';
      var cls = i===cur ? 'pip-mat-num-cur' : (answered ? 'pip-mat-num-done' : 'pip-mat-num-empty');
      return '<div class="'+cls+'" onclick="matGoto('+i+')">'+(i+1)+'</div>';
    }).join(''));
    elSet('pips-regular','innerHTML','');
  } else {
    var matBar2=el('mat-pips-bar');if(matBar2)matBar2.style.display='none';
    elSet('pips-regular','innerHTML',sub.qs.map(function(_,i){return '<div class="pip '+(i<cur?c.pd:i===cur?c.pc:c.pb)+'"></div>';}).join(''));
    elSet('pips','innerHTML','');
  }
}


// ── AUDIO PREHRÁVAČ PRE LISTENING SEKCIU ──
function showAudioPlayer(src, sectionLabel) {
  var wrap = el('audio-player-wrap');
  if (!wrap) return;
  if (!src) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  wrap.innerHTML = '<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:10px 14px;margin-bottom:10px;">'
    + '<div style="font-size:10px;color:#1D9E75;margin-bottom:6px;letter-spacing:0.05em">🎧 ' + (sectionLabel||'LISTENING') + '</div>'
    + '<audio id="mat-audio" controls style="width:100%;height:36px;accent-color:#1D9E75;" src="' + src + '">'
    + '</audio>'
    + '<div style="font-size:9px;color:#666;margin-top:4px">Nahrávku si vypočujte pred zodpovedaním otázok. Každú sekciu môžete počuť dvakrát.</div>'
    + '</div>';
}

function showQ(){
  ans=false;tck=false;clearInterval(tT);
  var q=sub.qs[cur];
  var L=['A','B','C','D','E'];
  var c=C[lv];
  elSet('qn','textContent',sub.icon+' '+sub.name+' · Otázka '+(cur+1)+' / '+sub.qs.length);
  elSet('qt','textContent',q.q);
  elStyle('pbar','width',(cur/sub.qs.length*100)+'%');
  elSet('fb','className','fbar');
  elSet('fb','textContent','');
  // Zobraziť/skryť Ukončiť kvíz
  var saveBtn=el('btn-save-quiz');
  if(saveBtn){saveBtn.style.display='inline-block';saveBtn.textContent=hasAccess('v')?'Uložiť':'🔒 Uložiť';}
  // Maturitný test — navigácia
  if(sub && sub.isMat){
    var isLast=cur+1>=sub.qs.length;
    // Nav wrap pod odpoveďami
    var navWrap=el('mat-nav-wrap');if(navWrap)navWrap.style.display='flex';
    // Skry male Dalej (#nb) v maturite - pouziva sa len nb2 dole
    var nbEl=el('nb');if(nbEl)nbEl.style.display='none';
    // Ďalej — skryť na poslednej
    var nb2El=el('nb2');
    if(nb2El)nb2El.style.display=isLast?'none':'inline-block';
    // Späť
    var prev2Btn=el('mat-prev-btn2');
    if(prev2Btn)prev2Btn.style.display=cur>0?'inline-block':'none';
    // Dokončiť test — vždy viditeľné
    var finishBtn=el('nb-finish');
    if(finishBtn)finishBtn.style.display='inline-block';
    elStyle('ci','display','none');
  } else {
    var navWrap2=el('mat-nav-wrap');if(navWrap2)navWrap2.style.display='none';
    var finishBtn2=el('nb-finish');
    if(finishBtn2)finishBtn2.style.display='none';
    var matBar3=el('mat-pips-bar');if(matBar3)matBar3.style.display='none';
  }
  // Kontextový panel — na desktope vždy rozbalený
  var ctxWrap=el('ctx-wrap');
  if(q.ctx && q.ctxText){
    elSet('ctx-title','textContent','📖 '+q.ctx);
    elSet('ctx-text','textContent',q.ctxText);
    var panel=el('ctx-panel');
    if(panel){panel.classList.remove('collapsed');}
    var ctxBtn=el('ctx-btn');
    if(ctxBtn){
      if(window.innerWidth>=600){ctxBtn.style.display='none';}
      else{ctxBtn.style.display='';ctxBtn.textContent='Zbaliť ▲';}
    }
    if(ctxWrap)ctxWrap.style.display='block';
  } else {
    if(ctxWrap)ctxWrap.style.display='none';
  }
  // Audio prehrávač pre listening
  if(q.audio){
    showAudioPlayer(q.audio, q.audioSection);
  } else {
    var awrap=el('audio-player-wrap');
    if(awrap)awrap.style.display='none';
  }
  var ea=el('ea');
  if(ea){var _h='';if(q.img){_h+='<div style="text-align:center;margin:10px 0"><img src="'+q.img+'" alt="obrazok" style="max-width:min(100%,360px);max-height:42vh;background:#fff;border-radius:8px;padding:8px"></div>';}if(q.en&&q.en.trim()){_h+='<div class="qen">'+q.en+'</div>';}ea.innerHTML=_h;}
  // Render odpovede
  var shortWrap=el('short-wrap');
  var ogEl=el('og');
  if(q.type==='short'){
    if(ogEl)ogEl.style.display='none';
    if(shortWrap)shortWrap.style.display='block';
    var sinp=el('short-input');
    var sBtn=el('short-btn');
    if(sub&&sub.isMat){
      if(sinp){sinp.value=matAnswers[cur]||'';setTimeout(function(){sinp.focus();},100);}
      if(sBtn)sBtn.style.display='none';
    } else {
      if(sinp){sinp.value='';setTimeout(function(){sinp.focus();},100);}
      if(sBtn)sBtn.style.display='';
    }
    window._shuffleMap=null;window._shuffleCorrect=undefined;
  } else {
    if(shortWrap)shortWrap.style.display='none';
    if(ogEl)ogEl.style.display='';
    var idxs=[];for(var ii=0;ii<q.opts.length;ii++){idxs.push(ii);}
    if(!sub.isMat){
      for(var si=idxs.length-1;si>0;si--){var sj=Math.floor(Math.random()*(si+1));var st=idxs[si];idxs[si]=idxs[sj];idxs[sj]=st;}
    }
    var shuffledOpts=idxs.map(function(i){return q.opts[i];});
    var newCorrect=idxs.indexOf(q.a);
    window._shuffleMap=idxs;
    window._shuffleCorrect=newCorrect;
    elSet('og','innerHTML',shuffledOpts.map(function(o,i){return '<button class="opt '+c.o+'" id="o'+i+'" onclick="matPick('+i+')"><span class="ltr '+c.l+'">'+L[i]+'</span>'+o+'</button>';}).join(''));
    // Obnov predchádzajúcu odpoveď pre maturitný test
    if(sub && sub.isMat && matAnswers[cur]!==undefined){
      var prev=matAnswers[cur];
      var prevBtn=el('o'+prev);
      if(prevBtn)prevBtn.classList.add('mat-selected');
    }
  }
  // Obnov krátku odpoveď
  if(q.type==='short' && sub && sub.isMat && matAnswers[cur]!==undefined){
    var sinp2=el('short-input');
    if(sinp2)sinp2.value=matAnswers[cur];
  }
  rPips();
  if(md==='s'&&q.type!=='short'){var cdEl=el('cd');if(cdEl){cdEl.className='cd '+c.cd+' waiting';cdEl.textContent=TS;}startCD();}
  if(typeof spLoadForCurrent==='function')spLoadForCurrent();
}

function startCD(){
  clearInterval(tT);tck=true;var t=TS;
  var c=C[lv];var cdEl=el('cd');
  if(cdEl){cdEl.className='cd '+c.cd;cdEl.textContent=t;}
  tT=setInterval(function(){
    if(!tck){clearInterval(tT);return;}
    t--;if(cdEl)cdEl.textContent=t;
    elStyle('pbar','width',((cur+(TS-t)/TS)/sub.qs.length*100)+'%');
    if(t<=3){if(cdEl)cdEl.className='cd urgent';tick(true);}else{if(cdEl)cdEl.className='cd '+c.cd;}
    if(t<=0){clearInterval(tT);tck=false;timeUp();}
  },1000);
}

function timeUp(){
  if(ans)return;ans=true;
  var q=sub.qs[cur];
  document.querySelectorAll('.opt').forEach(function(b){b.disabled=true;});
  var sc2=window._shuffleCorrect!==undefined?window._shuffleCorrect:q.a;
  var sm2=window._shuffleMap||[0,1,2,3];
  if(sub.isMat){
    elSet('fb','className','fbar');elSet('fb','textContent','');
  } else {
    var oq=el('o'+sc2);if(oq)oq.classList.add('missed');
    elSet('fb','className','fbar bad');
    elSet('fb','textContent','Čas vypršal! '+q.exp);
  }
  if(!sub||!sub.isMat){elStyle('nb','display','block');}
  answers.push({q:q.q,opts:sm2.map(function(x){return q.opts[x];}),correct:sc2,chosen:-1,isCorrect:false,exp:q.exp});
}

// ── Maturitný výber odpovede (bez okamžitého hodnotenia) ──
function matPrev(){
  if(!sub || !sub.isMat || cur===0) return;
  // Ulož krátku odpoveď
  var sinp=el('short-input');
  if(sinp && sub.qs[cur] && sub.qs[cur].type==='short'){
    matAnswers[cur]=sinp.value.trim();
  }
  cur--;
  showQ();
}

function matPick(i){
  if(!sub || !sub.isMat) return pick(i);
  // Zruš predchádzajúce zvýraznenie
  document.querySelectorAll('.opt').forEach(function(b){b.classList.remove('mat-selected');});
  var btn=el('o'+i);if(btn)btn.classList.add('mat-selected');
  matAnswers[cur]=i;
  rPips();
}

function matGoto(i){
  if(!sub || !sub.isMat) return;
  // Ulož krátku odpoveď ak je otvorená
  var sinp=el('short-input');
  if(sinp && !sinp.disabled && sub.qs[cur] && sub.qs[cur].type==='short'){
    matAnswers[cur]=sinp.value.trim();
  }
  cur=i;
  showQ();
}

function matFinish(){
  // Spočítaj nezodpovedané
  var total=sub.qs.length;
  var answered=0;
  for(var i=0;i<total;i++){
    if(matAnswers[i]!==undefined && matAnswers[i]!=='') answered++;
  }
  var unanswered=total-answered;
  var msg = unanswered>0
    ? 'Máš '+unanswered+' nezodpovedaných otázok z '+total+'. Chceš napriek tomu vyhodnotiť test?'
    : 'Všetky otázky sú zodpovedané. Chceš vyhodnotiť test?';
  if(confirm(msg)){
    matEvaluate();
  }
}

function matEvaluate(){
  // Vypočítaj výsledok
  scr=0;answers=[];
  for(var i=0;i<sub.qs.length;i++){
    var q=sub.qs[i];
    var chosen=matAnswers[i];
    if(q.type==='short'){
      var correct=Array.isArray(q.a)?q.a:[q.a];
      var userAns=chosen||'';
      var isOk=correct.some(function(c){return userAns.toLowerCase()===String(c).toLowerCase();});
      if(isOk)scr++;
      answers.push({q:q.q,type:'short',correct:correct[0],chosen:userAns,isCorrect:isOk,exp:q.exp});
    } else {
      var sc=q.a;
      var isOk2=(chosen===sc);
      if(isOk2)scr++;
      answers.push({q:q.q,opts:q.opts,correct:sc,chosen:chosen!=null?chosen:-1,isCorrect:isOk2,exp:q.exp});
    }
  }
  showScore();
}

var _ctxFontSize=13;
function ctxFontChange(d){
  _ctxFontSize=Math.min(20,Math.max(10,_ctxFontSize+d));
  var ct=document.getElementById('ctx-text');
  if(ct)ct.style.fontSize=_ctxFontSize+'px';
}

function pickShort(){
  if(ans)return;ans=true;tck=false;clearInterval(tT);
  var q=sub.qs[cur];
  var sinp=el('short-input');
  var userAns=sinp?sinp.value.trim():'';
  if(sinp)sinp.disabled=true;
  var btn=sinp?sinp.nextElementSibling:null;if(btn)btn.disabled=true;
  var correct=Array.isArray(q.a)?q.a:[q.a];
  var isOk=correct.some(function(c){return userAns.toLowerCase()===String(c).toLowerCase();});
  var fb=el('fb');
  if(sub.isMat){
    // Maturitný test — žiadny feedback
    if(isOk)scr++;
    if(fb){fb.className='fbar';fb.textContent='';}
  } else {
    if(isOk){scr++;if(fb){fb.className='fbar ok';fb.textContent='Správne! '+q.exp;}}
    else{if(fb){fb.className='fbar bad';fb.textContent='Nesprávne. Správna odpoveď: '+correct[0]+'. '+q.exp;}}
  }
  answers.push({q:q.q,type:'short',correct:correct[0],chosen:userAns,isCorrect:isOk,exp:q.exp});
  elStyle('pbar','width',((cur+1)/sub.qs.length*100)+'%');
  if(!sub||!sub.isMat){elStyle('nb','display','block');}
}

function pick(i){
  if(ans)return;ans=true;tck=false;clearInterval(tT);
  var q=sub.qs[cur];
  var sc=window._shuffleCorrect!==undefined?window._shuffleCorrect:q.a;
  var sm=window._shuffleMap||[0,1,2,3];
  document.querySelectorAll('.opt').forEach(function(b){b.disabled=true;});
  var fb=el('fb');
  if(sub.isMat){
    // Maturitný test — žiadny feedback, len pokračuj
    if(i===sc){scr++;}
    if(fb){fb.className='fbar';fb.textContent='';}
  } else {
    if(i===sc){scr++;var oi=el('o'+i);if(oi)oi.classList.add('correct');if(fb){fb.className='fbar ok';fb.textContent='Správne! '+q.exp;}}
    else{var ow=el('o'+i);if(ow)ow.classList.add('wrong');var oq=el('o'+sc);if(oq)oq.classList.add('missed');if(fb){fb.className='fbar bad';fb.textContent='Nesprávne. '+q.exp;}}
  }
  answers.push({q:q.q,opts:sm.map(function(x){return q.opts[x];}),correct:sc,chosen:i,isCorrect:i===sc,exp:q.exp,type:q.type||'mc'});
  elStyle('pbar','width',((cur+1)/sub.qs.length*100)+'%');
  if(!sub.isMat){
    elStyle('nb','display','block');
  }
}

function adv(){
  if(sub && sub.isMat){
    // Ulož krátku odpoveď ak je otvorená
    var sinp=el('short-input');
    if(sinp && sub.qs[cur] && sub.qs[cur].type==='short'){
      matAnswers[cur]=sinp.value.trim();
    }
    if(cur+1>=sub.qs.length){
      matFinish();
    } else {
      cur++;showQ();
    }
    return;
  }
  cur++;if(cur>=sub.qs.length){showScore();return;}
  var sinp2=el('short-input');if(sinp2){sinp2.disabled=false;sinp2.value='';var btn=sinp2.nextElementSibling;if(btn)btn.disabled=false;}
  showQ();
}

function launchConfetti(){
  var container = el('confetti-box');
  if(!container) return;
  container.innerHTML = '';
  var colors = ['#2ecc71','#1D9E75','#f39c12','#e74c3c','#0F6E56','#9FE1CB','#fff'];
  for(var i=0;i<40;i++){
    var div = document.createElement('div');
    div.className = 'confetto';
    div.style.left = Math.random()*100+'%';
    div.style.background = colors[Math.floor(Math.random()*colors.length)];
    div.style.width = (6+Math.random()*6)+'px';
    div.style.height = (6+Math.random()*6)+'px';
    div.style.borderRadius = Math.random()>0.5?'50%':'2px';
    div.style.animationDuration = (0.8+Math.random()*1.2)+'s';
    div.style.animationDelay = (Math.random()*0.5)+'s';
    container.appendChild(div);
  }
  setTimeout(function(){if(container)container.innerHTML='';}, 2500);
}


// ════════════════════════════════════════
// GAMIFIKÁCIA — XP, Streak, Spaced Rep.
// ════════════════════════════════════════

// --- Perzistencia cez localStorage ---
function gSave(key, val){ try{ localStorage.setItem('edu_'+key, JSON.stringify(val)); }catch(e){} }
function gLoad(key, def){ try{ var v=localStorage.getItem('edu_'+key); return v!==null?JSON.parse(v):def; }catch(e){ return def; } }

// --- XP systém ---




// --- Spaced Repetition ---
var lastPlayed = gLoad('lastPlayed', {}); // {roc_lv_id: dateStr}

function markPlayed(roc, lv, id){
  lastPlayed[roc+'_'+lv+'_'+id] = new Date().toISOString().slice(0,10);
  gSave('lastPlayed', lastPlayed);
}

function daysSince(dateStr){
  if(!dateStr) return 999;
  var parts=dateStr.split('-');
  var d=new Date(parts[0],parts[1]-1,parts[2]);
  return Math.floor((Date.now()-d.getTime())/(1000*60*60*24));
}





function renderReminders(){
  var sec = el('reminders-section');
  if(!sec) return;
  var reminders = [];
  // Nájdi predmety kde uplynulo >7 dní od posledného kvízu
  var SUBS_IDS = ['slj','lit','mat','dej','bio','che','fyz','ang'];
  var subNames = {slj:'Slovenský jazyk',lit:'Literatúra',mat:'Matematika',
    dej:'Dejepis',bio:'Biológia',che:'Chémia',fyz:'Fyzika',ang:'Angličtina'};
  var subIcons = {slj:'📝',lit:'📚',mat:'🔢',dej:'🌍',bio:'🔬',che:'⚗️',fyz:'⚡',ang:'🇬🇧'};
  SUBS_IDS.forEach(function(id){
    var key = roc+'_'+lv+'_'+id;
    var days = daysSince(lastPlayed[key]);
    var pct = pgGet(roc,lv,id);
    if(days>=7 && pct>0 && pct<100){
      reminders.push({id:id, days:days, pct:pct, name:subNames[id], icon:subIcons[id]});
    }
  });
  if(reminders.length===0){ sec.innerHTML=''; return; }
  // Zobraziť max 2
  reminders.sort(function(a,b){return b.days-a.days;});
  sec.innerHTML = reminders.slice(0,2).map(function(r){
    var onclick = 'launchQuiz(\'' + r.id + '\')';
    return '<div class="reminder-card" onclick="' + onclick + '">'
      + '<span style="font-size:18px">' + r.icon + '</span>'
      + '<div><div style="font-weight:500;font-size:11px;color:#e8e8e8">' + r.name + '</div>'
      + '<div style="font-size:10px;color:#c89a50">Nezopakoval si ' + r.days + ' dni - ' + r.pct + '% naposledy</div></div>'
      + '<span style="margin-left:auto;font-size:10px;color:#c89a50">Zopakovati &rarr;</span>'
      + '</div>';
  }).join('');
}

// --- Precvič chyby ---
function retryWrong(){
  // Vezmi posledný kvíz z histórie a filtruj len chyby
  if(!quizHistory.length) return;
  var last = quizHistory[0];
  var wrongAnswers = last.answers.filter(function(a){ return !a.isCorrect; });
  if(!wrongAnswers.length) return;
  // Zostav fake kvíz zo zlých otázok
  var wrongQs = wrongAnswers.map(function(a){
    // Rekonštrukcia pôvodnej otázky z DB
    var origQs = DB[last.roc+'_'+last.lv+'_'+last.id] || [];
    var origQ = origQs.filter(function(q){ return q.q===a.q; })[0];
    return origQ || {q:a.q, opts:a.opts, a:a.correct, exp:a.exp};
  });
  var sData = SUBS.filter(function(s){ return s.id===last.id; })[0];
  sub = {id:last.id, icon:sData?sData.icon:'🔁', name:(sData?sData.name:last.name)+' · Chyby', qs:wrongQs};
  cur=0;scr=0;ans=false;tot=0;answers=[];
  clearInterval(tT);clearInterval(tTot);
  showPage('page-quiz');
  elStyle('qs','display','flex');
  elStyle('ss','display','none');
  applyS();
  var cv=C[lv];
  elSet('mb','className','mbadge '+(md==='s'?cv.mbs:cv.mbt));
  elSet('mb','textContent',md==='s'?'⚔️ Súťaž':'📋 Test');
  elSet('ci','textContent',last.roc+'. roč · '+last.lv.toUpperCase()+' · Chyby 🔁');
  if(md==='s'){elStyle('tw','display','block');elStyle('tt','display','none');}
  else{
    elStyle('tw','display','none');
    var tt=el('tt');
    if(tt){tt.style.display='block';}
    // 90-minútový odpočet pre maturitné testy
    var matSec=90*60;
    var fmtMat=function(s){var m=Math.floor(s/60);var sec=s%60;return'⏱ '+m+':'+(sec<10?'0':'')+sec;};
    if(tt){tt.textContent=fmtMat(matSec);tt.style.color='';}
    tTot=setInterval(function(){
      matSec--;
      if(tt)tt.textContent=fmtMat(matSec);
      if(matSec<=300&&tt)tt.style.color='#e74c3c';
      if(matSec<=0){clearInterval(tTot);showScore();}
    },1000);
  }
  rPips();showQ();
}

function showScore(){
  clearInterval(tT);clearInterval(tTot);tck=false;
  // Vymaž uložený stav po dokončení
  if(window._saveKey){try{localStorage.removeItem(window._saveKey);}catch(e){}window._saveKey=null;}
  var stageEl=document.querySelector('.stage');if(stageEl)stageEl.classList.remove('mat-mode');
  // Ulož do histórie
  var now = new Date();
  var dateStr = now.getDate()+'.'+(now.getMonth()+1)+'.'+now.getFullYear()+' '+now.getHours()+':'+String(now.getMinutes()).padStart(2,'0');
  var pctNow = Math.round(scr/sub.qs.length*100);
  saveToHistory({
    id: sub.id, roc: roc, lv: lv,
    name: sub.name, icon: sub.icon,
    pct: pctNow, scr: scr, total: sub.qs.length,
    mode: md, time: tot, date: dateStr,
    answers: answers.slice()
  });
  elStyle('qs','display','none');
  elStyle('ss','display','flex');
  var c=C[lv];
  var pct=Math.round(scr/sub.qs.length*100);
  pgSet(roc,lv,sub.id,pct);
  elSet('sp','className','sbig '+c.sc);
  elSet('sp','textContent',pct+'%');
  elSet('scb','className','mbadge '+(md==='s'?c.mbs:c.mbt));
  elSet('scb','textContent',md==='s'?'⚔️ Súťaž':'📋 Test');
  elSet('sc','innerHTML','<div class="'+c.cc+'"><div class="scvl '+c.sv+'">'+scr+'</div><div class="slb">správnych</div></div><div class="'+c.cc+'"><div class="scvl '+c.sv+'">'+(sub.qs.length-scr)+'</div><div class="slb">nesprávnych</div></div>');
  elSet('si','textContent',md==='s'?('⚔️ Súťaž · '+roc+'. ročník · '+sub.name):('📋 Test · Čas: '+fmt(tot)+' · '+sub.name));
  var msgs=[[100,'Perfektný výsledok! 🏆'],[80,'Výborný výkon!'],[50,'Dobre, ešte precvičiť.'],[0,'Zopakuj si látku.']];
  if(pct>=80) setTimeout(launchConfetti, 200);
  elSet('sm','textContent',msgs.filter(function(m){return pct>=m[0];})[0][1]);
  elSet('rb','className','rbtn '+c.rb);
  rPips();
  // Gamifikácia
    markPlayed(roc, lv, sub.id);
  // Tlačidlo "Precvič chyby"
  var wrongCount = answers.filter(function(a){return !a.isCorrect;}).length;
  var rwBtn = el('retry-wrong-btn');
  var wcSpan = el('wrong-count');
  if(rwBtn){
    if(wrongCount>0){
      rwBtn.style.display='block';
      if(wcSpan) wcSpan.textContent=wrongCount;
    } else {
      rwBtn.style.display='none';
    }
  }
  var plusBanner=el('score-plus-banner');
  if(plusBanner){
    if(pct===100 && lv==='r' && !hasAccess('v')){
      plusBanner.style.display='block';
    } else {
      plusBanner.style.display='none';
    }
  }
}

function retry(){if(sub&&sub.isMat){launchMatTest(sub.matPredmet,sub.matRok);}else if(sub){launchQuiz(sub.id);}}

function toggleCtx(){
  var panel=el('ctx-panel');
  var btn=el('ctx-btn');
  if(!panel)return;
  var collapsed=panel.classList.toggle('collapsed');
  if(btn)btn.textContent=collapsed?'Rozbaliť ▼':'Zbaliť ▲';
}

function shareResult(){
  var pct=Math.round(scr/sub.qs.length*100);
  var emoji=pct>=80?'🏆':pct>=50?'👍':'💪';
  var lvName=lv==='r'?'EDUCAST free':lv==='v'?'VÝZVA':'MASTER';
  var text=emoji+' '+sub.name+' · '+roc+'. ročník · '+lvName+'\n'
    +'Výsledok: '+pct+'% ('+scr+'/'+sub.qs.length+' správnych)\n'
    +'Precvič si to na educast.sk';
  if(navigator.clipboard){
    navigator.clipboard.writeText(text).then(function(){
      var btn=el('share-btn');
      if(btn){btn.textContent='✓ Skopírované!';setTimeout(function(){btn.textContent='📤 Zdieľať výsledok';},2000);}
    });
  } else {
    prompt('Skopíruj výsledok:',text);
  }
}

function goToPortal(){
  clearInterval(tT);clearInterval(tTot);tck=false;
  // Reset maturitného stavu
  if(window._saveKey){try{localStorage.removeItem(window._saveKey);}catch(e){}}
  sub=null;matAnswers={};
  var stageEl=document.querySelector('.stage');if(stageEl)stageEl.classList.remove('mat-mode');
  var navWrap3=el('mat-nav-wrap');if(navWrap3)navWrap3.style.display='none';
  var finishBtn3=el('nb-finish');if(finishBtn3)finishBtn3.style.display='none';
  var matBar4=el('mat-pips-bar');if(matBar4)matBar4.style.display='none';
  elSet('pips','innerHTML','');elSet('pips-regular','innerHTML','');
  document.querySelectorAll('.ctb').forEach(function(b){b.style.display='';});
  var saveBtn2=el('btn-save-quiz');if(saveBtn2)saveBtn2.style.display='none';
  showPage('page-portal');
  updateAuthUI();renderPortal();renderHistory();renderReminders();
  var hh=el('hhero-wrap');if(hh)hh.style.display=hasAccess('v')?'none':'flex';
  setTimeout(function(){ renderWizard(); }, 10);
}

// ── MATURITNA DATABAZA ──
var MAT_DB={};
var matPg={};
function matPgGet(p,r){return matPg[p+'_'+r]||0;}
function matPgSet(p,r,v){matPg[p+'_'+r]=v;try{localStorage.setItem('edu_matpg',JSON.stringify(matPg));}catch(e){}}
function addMat(pred,rok,qs){if(!MAT_DB[pred])MAT_DB[pred]={};MAT_DB[pred][rok]=qs;}

// SJL 2010 sa načítava z externého JSON súboru
fetch('data/sjl_2010.json')
  .then(function(r){return r.json();})
  .then(function(qs){addMat('sjl',2010,qs);})
  .catch(function(e){console.error('Chyba načítania SJL 2010:',e);});

// Placeholder roky - pridávajú sa postupne
// addMat('sjl', 2011, [...]);  // pridaj po nahraní PDF
// addMat('sjl', 2012, [...]);
fetch('data/ang_b1_2010.json')
  .then(function(r){return r.json();})
  .then(function(qs){addMat('ang-b1',2010,qs);})
  .catch(function(e){console.error('Chyba načítania ANG B1 2010:',e);});
fetch('data/ang_b2_2010.json')
  .then(function(r){return r.json();})
  .then(function(qs){addMat('ang-b2',2010,qs);})
  .catch(function(e){console.error('Chyba ANG B2:',e);});
fetch('data/nem_b1_2010.json')
  .then(function(r){return r.json();})
  .then(function(qs){addMat('nem-b1',2010,qs);})
  .catch(function(e){console.error('Chyba NEM B1:',e);});
fetch('data/nem_b2_2010.json')
  .then(function(r){return r.json();})
  .then(function(qs){addMat('nem-b2',2010,qs);})
  .catch(function(e){console.error('Chyba NEM B2:',e);});
fetch('data/spj_b1_2010.json')
  .then(function(r){return r.json();})
  .then(function(qs){addMat('spj-b1',2010,qs);})
  .catch(function(e){console.error('Chyba SPJ B1:',e);});
fetch('data/spj_b2_2010.json')
  .then(function(r){return r.json();})
  .then(function(qs){addMat('spj-b2',2010,qs);})
  .catch(function(e){console.error('Chyba SPJ B2:',e);});
fetch('data/ruj_b1_2010.json')
  .then(function(r){return r.json();})
  .then(function(qs){addMat('ruj-b1',2010,qs);})
  .catch(function(e){console.error('Chyba RUJ B1:',e);});
fetch('data/ruj_b2_2010.json')
  .then(function(r){return r.json();})
  .then(function(qs){addMat('ruj-b2',2010,qs);})
  .catch(function(e){console.error('Chyba RUJ B2:',e);});
fetch('data/frj_b1_2010.json')
  .then(function(r){return r.json();})
  .then(function(qs){addMat('frj-b1',2010,qs);})
  .catch(function(e){console.error('Chyba FRJ B1:',e);});
fetch('data/frj_b2_2010.json')
  .then(function(r){return r.json();})
  .then(function(qs){addMat('frj-b2',2010,qs);})
  .catch(function(e){console.error('Chyba FRJ B2:',e);});
fetch('data/taj_b1_2010.json')
  .then(function(r){return r.json();})
  .then(function(qs){addMat('taj-b1',2010,qs);})
  .catch(function(e){console.error('Chyba TAJ B1:',e);});
fetch('data/taj_b2_2010.json')
  .then(function(r){return r.json();})
  .then(function(qs){addMat('taj-b2',2010,qs);})
  .catch(function(e){console.error('Chyba TAJ B2:',e);});
// addMat('ruj-b2', 2010, [...]);
// addMat('frj-b1', 2010, [...]);
// addMat('frj-b2', 2010, [...]);
// addMat('taj-b1', 2010, [...]);
// addMat('taj-b2', 2010, [...]);
fetch('data/mjl_2010.json')
  .then(function(r){return r.json();})
  .then(function(qs){addMat('mjl',2010,qs);})
  .catch(function(e){console.error('Chyba načítania MJL 2010:',e);});
fetch('data/ujl_2010.json')
  .then(function(r){return r.json();})
  .then(function(qs){addMat('ujl',2010,qs);})
  .catch(function(e){console.error('Chyba načítania UJL 2010:',e);});
fetch('data/mat_2010.json')
  .then(function(r){return r.json();})
  .then(function(qs){addMat('mat',2010,qs);})
  .catch(function(e){console.error('Chyba nacitania MAT 2010:',e);});

// ── MATURITNE TESTY UI ──
var matPredmet='sjl',matOpen=false;
function toggleHistSection(){
  var list = el('hist-list');
  var ch = el('hist-chevron');
  if(!list) return;
  var open = list.style.display === 'none';
  list.style.display = open ? 'block' : 'none';
  if(ch) ch.className = 'mat-chevron' + (open ? ' open' : '');
}

function toggleMatSection(){
  matOpen=!matOpen;
  var ct=el('mat-content'),ch=el('mat-chevron');
  if(ct)ct.style.display=matOpen?'block':'none';
  if(ch)ch.className='mat-chevron'+(matOpen?' open':'');
  if(matOpen)renderMatSection();
}
function renderMatSection(){
  var tabs=el('mat-tabs');
  if(!tabs)return;
  var preds=Object.keys(MAT_DB);
  tabs.innerHTML=preds.map(function(p){
    var nm={sjl:'SJL',mjl:'MJL',ujl:'UJL','ang-b1':'ANG B1','ang-b2':'ANG B2','nem-b1':'NEM B1','nem-b2':'NEM B2','spj-b1':'ŠPJ B1','spj-b2':'ŠPJ B2','ruj-b1':'RUJ B1','ruj-b2':'RUJ B2','frj-b1':'FRJ B1','frj-b2':'FRJ B2','taj-b1':'TAJ B1','taj-b2':'TAJ B2',mat:'MAT',bio:'BIO',che:'CHE',fyz:'FYZ',ang:'ANG',dej:'DEJ'};
    var oc='setMatPredmet(\'' +p+ '\')';
    return '<div class="mat-tab'+(p===matPredmet?' active':'')+'" onclick="'+oc+'">'+(nm[p]||p.toUpperCase())+'</div>';
  }).join('');
  renderMatGrid();
}
function setMatPredmet(p){
  matPredmet=p;
  var preds=Object.keys(MAT_DB);
  document.querySelectorAll('.mat-tab').forEach(function(t,i){t.classList.toggle('active',preds[i]===p);});
  renderMatGrid();
}
function renderMatGrid(){
  var grid=el('mat-grid');
  if(!grid||!MAT_DB[matPredmet])return;
  var roky=Object.keys(MAT_DB[matPredmet]).sort(function(a,b){return b-a;});
  var locked=!hasAccess('v');
  grid.innerHTML=roky.map(function(rok){
    var pct=matPgGet(matPredmet,rok),done=pct===100;
    if(locked){
      return '<div class="mat-card locked" style="opacity:0.55;cursor:default" onclick="showPaywall()">'
        +'<div class="mat-lock-overlay">🔒</div>'
        +'<div class="mat-year">Maturita '+rok+'</div>'
        +'<div class="mat-label">'+matPredmet.toUpperCase()+' · Externá časť</div>'
        +'<div style="font-size:10px;color:#7F77DD;margin-top:6px">Odomknúť EDUCAST PLUS →</div>'
        +'</div>';
    }
    var oc='launchMatTest(\'' +matPredmet+ '\',' +rok+ ')';
    return '<div class="mat-card'+(done?' completed':'')+'" onclick="'+oc+'">'
      +(pct>0?'<div class="mat-score">'+(done?'✓ ':'')+pct+'%</div>':'')
      +'<div class="mat-year">Maturita '+rok+'</div>'
      +'<div class="mat-label">'+matPredmet.toUpperCase()+' · Externá časť · '+MAT_DB[matPredmet][rok].length+' otázok</div>'
      +'<div class="mat-prog"><div class="mat-prog-fill" style="width:'+pct+'%"></div></div>'
      +'</div>';
  }).join('');
}
function launchMatTest(predmet,rok){document.querySelectorAll(".ctb").forEach(function(b){if(b.textContent.indexOf("Predmety")>-1)b.style.display="none";});
  var qs=MAT_DB[predmet][rok];
  if(!qs||!qs.length)return;
  sub={id:'mat_'+predmet+'_'+rok,icon:'📝',name:'Maturita '+rok+' · '+predmet.toUpperCase(),qs:qs,isMat:true,matPredmet:predmet,matRok:rok};
  // Skontroluj uložený mat stav
  var _matSaveKey = 'edu_mat_save_'+sub.matPred+'_'+sub.matRok;
  var _matSaved = null;
  try{ var _raw=localStorage.getItem(_matSaveKey); if(_raw) _matSaved=JSON.parse(_raw); }catch(e){}
  if(_matSaved && _matSaved.cur>0 && confirm('Máš uložený test z '+_matSaved.savedAt+' (otázka '+(_matSaved.cur+1)+'/'+sub.qs.length+'). Pokračovať?')){
    cur=_matSaved.cur; matAnswers=_matSaved.matAnswers||{};
    window._matTime=_matSaved.timeLeft||90*60;
  } else {
    var matDur=(sub.duration||90)*60;
    window._matTime=matDur;
    cur=0;scr=0;ans=false;tot=0;answers=[];matAnswers={};
    try{ localStorage.removeItem(_matSaveKey); }catch(e){}
  }
  window._saveKey=_matSaveKey;
  var stageEl=document.querySelector('.stage');if(stageEl)stageEl.classList.add('mat-mode');
  clearInterval(tT);clearInterval(tTot);
  window._shuffleMap=null;window._shuffleCorrect=undefined;
  showPage('page-quiz');
  elStyle('qs','display','flex');elStyle('ss','display','none');
  document.querySelector('.stage').className='stage bgv';
  elSet('mb','className','mbadge '+(md==='s'?'mbsv':'mbtv'));
  elSet('mb','textContent',md==='s'?'⚔️ Súťaž':'📋 Test');
  elSet('ci','textContent','Maturita '+rok+' · '+predmet.toUpperCase());
  if(md==='s'){elStyle('tw','display','block');elStyle('tt','display','none');}
  else{
    elStyle('tw','display','none');
    var tt=el('tt');
    if(tt){tt.style.display='block';}
    var matSec3=90*60;
    var fmtMat3=function(s){var m=Math.floor(s/60);var sec=s%60;return'⏱ '+m+':'+(sec<10?'0':'')+sec;};
    if(tt){tt.textContent=fmtMat3(matSec3);tt.style.color='';}
    tTot=setInterval(function(){
      matSec3--;
      if(tt)tt.textContent=fmtMat3(matSec3);
      if(matSec3<=300&&tt)tt.style.color='#e74c3c';
      if(matSec3<=0){clearInterval(tTot);showScore();}
    },1000);
  }
  rPips();showQ();
}

function getCtx(){if(!ax)ax=new(window.AudioContext||window.webkitAudioContext)();return ax;}
function tick(u){try{var c=getCtx();var o=c.createOscillator();var g=c.createGain();o.connect(g);g.connect(c.destination);o.type='square';o.frequency.value=u?660:440;g.gain.setValueAtTime(0,c.currentTime);g.gain.linearRampToValueAtTime(u?0.15:0.08,c.currentTime+0.01);g.gain.linearRampToValueAtTime(0,c.currentTime+0.07);o.start(c.currentTime);o.stop(c.currentTime+0.1);}catch(e){}}
function fmt(s){var m=Math.floor(s/60);var x=s%60;return m+':'+(x<10?'0':'')+x;}

// ═══════════════════════════════════════════
// INIT — bezpečné spustenie po načítaní DOM
// ═══════════════════════════════════════════

// ════════════════════════════════════════
// LANDING WIZARD (úvodná strana)
// ════════════════════════════════════════
var lwSubj = null;
var lwRoc = null;
var lwLv = 'r';
var lwMd = 't';


// ── LEVEL CHOOSE ──
var lwChosenLevel = null;


// ════════════════════════════════════════
// HISTÓRIA KROKOV — univerzálne späť
// ════════════════════════════════════════
var navStack = [];

function navPush(state){
  navStack.push(state);
}

function navBack(){
  if(navStack.length === 0) return;
  var prev = navStack.pop();
  // Vykonaj akciu podľa stavu
  switch(prev){
    case 'level-select':
      lwGoBackToLevelSelect();
      break;
    case 'subj-select':
      // Vráť na výber predmetu
      lwSubj=null; lwRoc=null;
      var s1=document.getElementById('lw-step1');
      var s2=document.getElementById('lw-step2');
      var mw=document.getElementById('lw-mat-wiz');
      var sb=document.getElementById('lw-start-btn');
      if(s1)s1.style.display='block';
      if(s2)s2.style.display='none';
      if(mw)mw.style.display='none';
      if(sb)sb.className='wiz-start-btn';
      renderLandingWizard();
      lwUpdateSteps(1);
      break;
    case 'rok-select':
      // Vráť na výber ročníka
      lwRoc=null;
      var sb2=document.getElementById('lw-start-btn');
      if(sb2)sb2.className='wiz-start-btn';
      lwUpdateSteps(2);
      // Zruš highlight ročníkov
      ['1','2','3','4'].forEach(function(r){
        var b=document.getElementById('lr-'+r);
        if(b)b.className='wiz-roc-btn';
      });
      break;
    case 'mat-subj':
      lwMatRok=null;
      var rw=document.getElementById('lw-mat-rok-wrap');
      if(rw)rw.style.display='none';
      document.querySelectorAll('.mat-wiz-pred').forEach(function(el){el.className='mat-wiz-pred';});
      var sb3=document.getElementById('lw-start-btn');
      if(sb3)sb3.className='wiz-start-btn';
      lwUpdateSteps(2);
      break;
    case 'portal':
      goToLanding();
      break;
  }
}

function lwChooseLevel(l){
  if(l === 'v' && !hasAccess('v')){ openAuth(); return; }
  navStack = []; navPush('level-select');
  lwChosenLevel = l; lwLv = l; lv = l;
  var ls = document.getElementById('lv-select-screen');
  var ws = document.getElementById('lv-wizard-screen');
  if(ls) ls.style.display = 'none';
  if(ws) ws.style.display = 'block';
  var bar = document.getElementById('lw-level-bar');
  if(bar) bar.className = 'wiz-level-bar ' + (l === 'v' ? 'plus' : 'free');
  var promo = document.getElementById('lw-plus-promo');
  if(promo) promo.style.display = 'none';
  lwUpdateSettings();
  renderLandingWizard();
}

function lwGoBackToLevelSelect(){
  lwChosenLevel = null;
  lwSubj = null; lwRoc = null; lwMatPred = null; lwMatRok = null;
  // Obnov prepínač Test/Súťaž
  var modeToggle = document.querySelector('#lmd-t');
  if(modeToggle && modeToggle.parentElement) modeToggle.parentElement.style.display = '';
  var ls = document.getElementById('lv-select-screen');
  var ws = document.getElementById('lv-wizard-screen');
  if(ls) ls.style.display = 'block';
  if(ws) ws.style.display = 'none';
  var sb = document.getElementById('lw-start-btn');
  if(sb) sb.className = 'wiz-start-btn';
  lwUpdateSteps(1);
}

function renderLandingWizard(){
  var grid = document.getElementById('lw-subj-grid');
  if(!grid) return;
  var WS = [
    {id:'slj',icon:'📝',name:'Slov. jazyk'},
    {id:'lit',icon:'📚',name:'Literatúra'},
    {id:'mat',icon:'🔢',name:'Matematika'},
    {id:'dej',icon:'🌍',name:'Dejepis'},
    {id:'bio',icon:'🔬',name:'Biológia'},
    {id:'che',icon:'⚗️',name:'Chémia'},
    {id:'fyz',icon:'⚡',name:'Fyzika'},
    {id:'ang',icon:'🇬🇧',name:'Angličtina'},
    {id:'maturita',icon:'🎓',name:'Maturitné testy',special:true}
  ];
  grid.innerHTML = WS.map(function(s){
    var sel = lwSubj === s.id;
    var locked = s.special && !hasAccess('v');
    var isV = lwLv === 'v';
    var cardClass = 'wiz-subj-card'+(isV?' v-mode':'')+(sel?' sel':'')+(locked?' locked-card':'')+(s.special?' mat-special-card':'');
    var onclick = s.special
      ? (locked ? 'showPaywall()' : 'lwSelectMaturita()')
      : 'lwSelectSubj(\'' +s.id+ '\')';
    return '<div class="'+cardClass+'" onclick="'+onclick+'" style="'+(s.special?'position:relative':'')+'">'
      +(locked?'<div style="position:absolute;top:4px;right:6px;font-size:10px">🔒</div>':'')
      +(s.special && !locked?'<div style="position:absolute;top:4px;right:6px;font-size:9px;color:#7F77DD;background:#1a1528;padding:1px 5px;border-radius:8px">EDUCAST PLUS</div>':'')
      +'<div class="wiz-subj-icon">'+s.icon+'</div>'
      +'<div class="wiz-subj-name" style="'+(s.special?'color:#CECBF6 font-size:9px':'')+'">'+s.name+'</div>'
      +'</div>';
  }).join('');
  // Aktualizuj navbar
  lwUpdateNav();
  lwUpdateSettings();
}

function lwUpdateNav(){
  var btn = document.getElementById('nav-auth-btn');
  var lbl = document.getElementById('nav-auth-label');
  if(authState.loggedIn){
    if(btn){
      btn.textContent = '🚪 Odhlásiť sa';
      btn.onclick = authLogout;
      btn.style.cssText = 'font-size:11px;font-weight:600;padding:6px 14px;border-radius:20px;border:none;background:transparent;color:#e74c3c;cursor:pointer;font-family:inherit;transition:all 0.12s';
      btn.onmouseover = function(){ this.style.background='#e74c3c'; this.style.color='#fff'; };
      btn.onmouseout = function(){ this.style.background='transparent'; this.style.color='#e74c3c'; };
    }
    if(lbl){
      lbl.textContent = '👤 ' + authState.email.split('@')[0];
      lbl.style.cursor = 'pointer';
      lbl.onclick = showProfile;
      lbl.title = 'Môj profil';
    }
  } else {
    if(btn){
      btn.textContent = '🔑 Prihlásiť sa';
      btn.onclick = openAuth;
      btn.style.cssText = 'font-size:11px;font-weight:500;padding:6px 14px;border-radius:20px;border:0.5px solid #2a2a2a;background:#1a1a1a;color:#e8e8e8;cursor:pointer;font-family:inherit;transition:border-color 0.12s ease';
      btn.onmouseover = function(){ this.style.borderColor='#378ADD'; };
      btn.onmouseout = function(){ this.style.borderColor='#2a2a2a'; };
    }
    if(lbl){ lbl.textContent = ''; lbl.onclick = null; lbl.style.cursor = 'default'; }
  }
}

function lwUpdateSettings(){
  ['r','v'].forEach(function(x){
    var b = document.getElementById('llv-'+x);
    if(!b) return;
    if(x===lwLv){
      b.className = x==='v' ? 'wiz-tog-btn active-v' : 'wiz-tog-btn active';
    } else {
      b.className = 'wiz-tog-btn';
    }
  });
  ['t','s'].forEach(function(x){
    var b = document.getElementById('lmd-'+x);
    if(!b) return;
    if(x===lwMd) b.className = x==='t'?'wiz-tog-btn active-t':'wiz-tog-btn active-s';
    else b.className = 'wiz-tog-btn';
  });
  var vBtn = document.getElementById('llv-v');
  if(vBtn) vBtn.textContent = hasAccess('v') ? '🎓 EDUCAST PLUS' : '🔒 EDUCAST PLUS';
}

function lwSetLv(l){
  if(l !== 'r' && !hasAccess(l)){ openAuth(); return; }
  lwChooseLevel(l);
}

function lwUpdateGridStyle(){
  var grid = document.getElementById('lw-subj-grid');
  if(!grid) return;
  if(lwLv === 'v'){
    grid.parentNode.className = (grid.parentNode.className||'').replace('v-grid','').trim();
    grid.parentNode.className += ' v-grid';
  } else {
    if(grid.parentNode) grid.parentNode.className = (grid.parentNode.className||'').replace('v-grid','').trim();
  }
}

function lwSetMode(m){
  lwMd = m; md = m;
  lwUpdateSettings();
}

function lwSelectSubj(id){
  navPush('subj-select');
  lwSubj = id; lwRoc = null;
  document.getElementById('lw-step1').style.display = 'none';
  document.getElementById('lw-step2').style.display = 'block';
  var lvlStep0 = document.getElementById('lw-step-level');
  if(lvlStep0) lvlStep0.style.display = 'none';
  var lbl = document.getElementById('lw-subj-label');
  var icons = {slj:'📝',lit:'📚',mat:'🔢',dej:'🌍',bio:'🔬',che:'⚗️',fyz:'⚡',ang:'🇬🇧'};
  if(lbl) lbl.textContent = (icons[id]||'') + ' ' + id.toUpperCase();
  ['1','2','3','4'].forEach(function(r){
    var b = document.getElementById('lr-'+r);
    if(b) b.className = 'wiz-roc-btn';
  });
  var sb = document.getElementById('lw-start-btn');
  if(sb) sb.className = 'wiz-start-btn';
  lwUpdateSteps(2);
}

function lwSetRoc(r){
  if(lwRoc === null) navPush('rok-select');
  lwRoc = r;
  ['1','2','3','4'].forEach(function(n){
    var b = document.getElementById('lr-'+n);
    if(b) b.className = 'wiz-roc-btn'+(parseInt(n)===r?' sel':'');
  });
  // Namiesto priameho startu zobraz cestu levelov
  var sb = document.getElementById('lw-start-btn');
  if(sb) sb.className = 'wiz-start-btn';
  var lvlStep = document.getElementById('lw-step-level');
  if(lvlStep){ lvlStep.style.display = 'block'; }
  renderLevelPath();
  lwUpdateSteps(3);
}

function lwSelectMaturita(){
  // Zobraz wizard aj pre FREE - obsah bude zamknutý
  // Zobraz maturitny wizard priamo na landing
  document.getElementById('lw-step1').style.display = 'none';
  document.getElementById('lw-step2').style.display = 'none';
  // Skryj prepínač Test/Súťaž — v maturite nemá zmysel
  var modeToggle = document.querySelector('#lmd-t');
  if(modeToggle && modeToggle.parentElement) modeToggle.parentElement.style.display = 'none';
  var mw = document.getElementById('lw-mat-wiz');
  if(mw){ mw.style.display = 'block'; }
  else {
    // Vytvor maturitny wizard dynamicky
    var wrap = document.getElementById('lw-step1').parentNode;
    var div = document.createElement('div');
    div.id = 'lw-mat-wiz';
    div.innerHTML = lwMatWizHTML();
    wrap.insertBefore(div, document.getElementById('lw-start-btn'));
  }
  // Neresetuj ak sú už nastavené (návrat z testu)
  if(!lwMatPred) lwMatRok = null;
  lwUpdateSteps(2);
  renderLwMatWiz();
}

var lwMatPred = null;
var lwMatRok = null;
var MAT_CATS = [
  {
    id: 'lit',
    label: 'Vyučovacie jazyky a literatúra',
    preds: [
      {id:'sjl',  icon:'📝', name:'SJL'},
      {id:'mjl',  icon:'🇭🇺', name:'MJL'},
      {id:'ujl',  icon:'🇺🇦', name:'UJL'},
    ]
  },
  {
    id: 'cj',
    label: 'Cudzie jazyky',
    preds: [
      {id:'ang-b1', icon:'🇬🇧', name:'ANG B1'},
      {id:'ang-b2', icon:'🇬🇧', name:'ANG B2'},
      {id:'nem-b1', icon:'🇩🇪', name:'NEM B1'},
      {id:'nem-b2', icon:'🇩🇪', name:'NEM B2'},
      {id:'spj-b1', icon:'🇪🇸', name:'ŠPJ B1'},
      {id:'spj-b2', icon:'🇪🇸', name:'ŠPJ B2'},
      {id:'ruj-b1', icon:'🇷🇺', name:'RUJ B1'},
      {id:'ruj-b2', icon:'🇷🇺', name:'RUJ B2'},
      {id:'frj-b1', icon:'🇫🇷', name:'FRJ B1'},
      {id:'frj-b2', icon:'🇫🇷', name:'FRJ B2'},
      {id:'taj-b1', icon:'🇮🇹', name:'TAJ B1'},
      {id:'taj-b2', icon:'🇮🇹', name:'TAJ B2'}
    ]
  },
  {
    id: 'mat',
    label: 'Matematika',
    preds: [
      {id:'mat', icon:'🔢', name:'MAT'}
    ]
  }
];
var MAT_PREDS = MAT_CATS.reduce(function(acc, cat){ return acc.concat(cat.preds); }, []);
var MAT_ROKY = [2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026];

function lwMatWizHTML(){
  return '<button style="font-size:12px;font-weight:600;color:#378ADD;background:#0A2238;border:0.5px solid #378ADD55;border-radius:20px;cursor:pointer;padding:6px 14px;font-family:inherit;margin-bottom:10px;transition:all 0.15s" onmouseover="this.style.background=\'#0C3257\'" onmouseout="this.style.background=\'#0A2238\'" onclick="navBack()">← Späť na predmety</button>'
    +'<div id="lw-mat-pred-grid"></div>'
    +'<div id="lw-mat-rok-wrap" style="display:none">'
    +'<p style="font-size:11px;color:#AFA9EC;margin:0 0 8px">Vyber rok:</p>'
    +'<div class="mat-rok-grid" id="lw-mat-rok-grid"></div>'
    +'</div>';
}

function renderLwMatWiz(){
  var pg = document.getElementById('lw-mat-pred-grid');
  if(!pg) return;
  var free = !hasAccess('v');
  pg.innerHTML = MAT_CATS.map(function(cat){
    var predsHTML = cat.preds.map(function(p){
      var sel = lwMatPred === p.id;
      var hasData = MAT_DB[p.id] && Object.keys(MAT_DB[p.id]).length > 0;
      var onclick = free ? 'showPaywall()' : 'lwMatSelPred(\'' +p.id+ '\')';
      return '<div class="mat-wiz-pred'+(sel?' sel':'')+(free?' locked-card':'')+'" onclick="'+onclick+'" style="position:relative">'
        +(free?'<div style="position:absolute;top:4px;right:6px;font-size:10px">🔒</div>':'')
        +'<div class="mat-wiz-pred-icon">'+p.icon+'</div>'
        +'<div class="mat-wiz-pred-name">'+p.name+'</div>'
        +(hasData?'<div style="font-size:9px;color:#1D9E75;margin-top:2px">'+Object.keys(MAT_DB[p.id]).length+' testov</div>':'<div style="font-size:9px;color:#555;margin-top:2px">čoskoro</div>')
        +'</div>';
    }).join('');
    return '<p style="font-size:10px;font-weight:600;color:#888;letter-spacing:0.08em;text-transform:uppercase;margin:10px 0 6px">'+cat.label+'</p>'
      +'<div class="mat-wiz-grid">'+predsHTML+'</div>';
  }).join('');
  // Ak FREE - zobraz aj roky ale zamknuté
  if(free){
    var rw = document.getElementById('lw-mat-rok-wrap');
    if(rw){
      rw.style.display = 'block';
      var rg = document.getElementById('lw-mat-rok-grid');
      if(rg) rg.innerHTML = MAT_ROKY.map(function(r){
        return '<div class="mat-rok-btn locked" onclick="showPaywall()">'+r+'</div>';
      }).join('');
    }
    // Zobraz paywall banner
    var pg2 = document.getElementById('lw-mat-pred-grid');
    if(pg2 && !document.getElementById('mat-paywall-hint')){
      var hint = document.createElement('div');
      hint.id = 'mat-paywall-hint';
      hint.style.cssText = 'grid-column:1/-1;text-align:center;padding:10px;background:#1a1528;border:0.5px solid #534AB7;border-radius:8px;cursor:pointer';
      hint.innerHTML = '<div style="font-size:12px;color:#CECBF6;font-weight:500">🔒 Maturitné testy sú pre EDUCAST PLUS</div><div style="font-size:10px;color:#7F77DD;margin-top:3px">Klikni pre získanie prístupu →</div>';
      hint.onclick = function(){ showPaywall(); };
      pg2.parentNode.insertBefore(hint, pg2.nextSibling);
    }
  }
}

function lwMatSelPred(id){
  navPush('mat-subj');
  lwMatPred = id; lwMatRok = null;
  // Highlight
  document.querySelectorAll('.mat-wiz-pred').forEach(function(el,i){
    el.className = 'mat-wiz-pred'+(MAT_PREDS[i].id===id?' sel':'');
  });
  // Zobraz roky
  var rw = document.getElementById('lw-mat-rok-wrap');
  if(rw) rw.style.display = 'block';
  setTimeout(function(){ if(rw) rw.scrollIntoView({behavior:'smooth', block:'start'}); }, 50);
  var rg = document.getElementById('lw-mat-rok-grid');
  if(!rg) return;
  rg.innerHTML = MAT_ROKY.map(function(r){
    var exists = MAT_DB[id] && MAT_DB[id][r];
    return '<div class="mat-rok-btn'+(exists?'':' locked')+'" onclick="'+(exists?'lwMatSelRok('+r+')':'')+'">'+r+'</div>';
  }).join('');
  // Skry start button
  var sb = document.getElementById('lw-start-btn');
  if(sb) sb.className = 'wiz-start-btn';
  lwUpdateSteps(2);
}

function lwMatSelRok(rok){
  lwMatRok = rok;
  // Highlight
  document.querySelectorAll('.mat-rok-btn').forEach(function(b,i){
    if(!b.classList.contains('locked'))
      b.className = 'mat-rok-btn'+(MAT_ROKY[i]===rok?' sel':'');
  });
  // Zobraz start
  var sb = document.getElementById('lw-start-btn');
  if(sb) sb.className = 'wiz-start-btn visible';
  lwUpdateSteps(3);
}

function lwMatBack(){
  lwMatPred = null; lwMatRok = null;
  var rw = document.getElementById('lw-mat-rok-wrap');
  if(rw) rw.style.display = 'none';
  document.querySelectorAll('.mat-wiz-pred').forEach(function(el){ el.className = 'mat-wiz-pred'; });
  var sb = document.getElementById('lw-start-btn');
  if(sb) sb.className = 'wiz-start-btn';
  lwUpdateSteps(2);
}

function lwBack(){
  lwSubj = null; lwRoc = null; lwMatPred = null; lwMatRok = null;
  // Obnov prepínač Test/Súťaž
  var modeToggle = document.querySelector('#lmd-t');
  if(modeToggle && modeToggle.parentElement) modeToggle.parentElement.style.display = '';
  document.getElementById('lw-step1').style.display = 'block';
  document.getElementById('lw-step2').style.display = 'none';
  var mw = document.getElementById('lw-mat-wiz');
  if(mw) mw.style.display = 'none';
  var sb = document.getElementById('lw-start-btn');
  if(sb) sb.className = 'wiz-start-btn';
  renderLandingWizard();
  lwUpdateSteps(1);
}

function lwUpdateSteps(active){
  [1,2,3].forEach(function(i){
    var s = document.getElementById('lw-s'+i);
    if(!s) return;
    s.className = 'wiz-step'+(i===active?' active':i<active?' done':'');
  });
}

function lwStart(){
  if(lwMatPred && lwMatRok){
    lv = 'v'; md = lwMd;
    showPage('page-portal');
    renderPortal(); renderHistory(); renderReminders();
    var ms = document.getElementById('mat-section');
    if(ms) ms.style.display = 'block';
    setTimeout(function(){ renderWizard(); launchMatTest(lwMatPred, lwMatRok); }, 50);
    return;
  }
  if(!lwSubj || !lwRoc) return;
  roc = lwRoc; lv = lwLv; md = lwMd;
  showPage('page-portal');
  renderPortal(); renderHistory(); renderReminders();
  var ms = document.getElementById('mat-section');
  if(ms) ms.style.display = hasAccess('v') ? 'block' : 'none';
  setTimeout(function(){ renderWizard(); launchQuiz(lwSubj); }, 50);
}

function showLandingInfo(){
  // Otvor auth modal alebo info
  openAuth();
}

document.addEventListener('DOMContentLoaded', function() {
  authLoad();
  updateAuthUI();
  lwUpdateNav();
  lastPlayed = gLoad('lastPlayed', {});
  quizHistory = gLoad('quizHistoryArr', []);
  // Renderuj len level select screen pri štarte
  setTimeout(function(){
    var ls = document.getElementById('lv-select-screen');
    var ws = document.getElementById('lv-wizard-screen');
    if(ls) ls.style.display = 'block';
    if(ws) ws.style.display = 'none';
    // Aktualizuj navbar auth
    if(typeof lwUpdateNav === 'function') lwUpdateNav();
    // Ak je prihlásenỳ, nastav level
    if(hasAccess('v')){ lwChosenLevel='v'; lwLv='v'; lv='v'; }
  }, 50);
});

// ── DIGITÁLNY POMOCNÝ PAPIER (per-otázka, text + kreslenie) ──
var matNotes = {}; // {qIndex: {text:'', draw:'dataURL'}}
var _spOpen = false;
var _spMode = 'text'; // 'text' | 'draw'
var _spDrawing = false, _spCtx = null, _spLastX = 0, _spLastY = 0;

function spInjectUI(){
  if(document.getElementById('sp-fab')) return;
  var css = document.createElement('style');
  css.textContent =
    '#sp-fab{position:fixed;right:14px;bottom:64px;z-index:900;background:linear-gradient(135deg,#534AB7,#7F77DD);color:#fff;border:none;border-radius:24px;padding:10px 16px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.4);display:none}'
  + '#sp-fab:hover{opacity:0.92}'
  + '#sp-panel{position:fixed;right:14px;bottom:108px;z-index:901;width:min(380px,92vw);background:#161616;border:1px solid #2a2a2a;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,0.6);display:none;flex-direction:column;overflow:hidden}'
  + '#sp-panel.open{display:flex}'
  + '.sp-head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #2a2a2a}'
  + '.sp-title{font-size:11px;color:#CECBF6;font-weight:600;letter-spacing:0.04em}'
  + '.sp-tabs{display:flex;gap:4px}'
  + '.sp-tab{font-size:10px;padding:4px 10px;border-radius:14px;border:1px solid #2a2a2a;background:transparent;color:#888;cursor:pointer;font-family:inherit}'
  + '.sp-tab.active{background:#1a1528;border-color:#534AB7;color:#CECBF6}'
  + '.sp-close{background:transparent;border:none;color:#888;font-size:16px;cursor:pointer;line-height:1;padding:0 4px}'
  + '.sp-body{padding:10px}'
  + '#sp-text{width:100%;height:180px;background:#0f0f0f;border:1px solid #2a2a2a;border-radius:8px;color:#e8e8e8;font-family:ui-monospace,Menlo,monospace;font-size:13px;padding:10px;resize:vertical;outline:none;box-sizing:border-box}'
  + '#sp-text:focus{border-color:#534AB7}'
  + '#sp-canvas-wrap{position:relative}'
  + '#sp-canvas{width:100%;height:200px;background:#fff;border-radius:8px;border:1px solid #2a2a2a;touch-action:none;cursor:crosshair;display:block}'
  + '.sp-canvas-tools{display:flex;gap:6px;margin-top:6px}'
  + '.sp-btn{font-size:10px;padding:5px 10px;border-radius:6px;border:1px solid #2a2a2a;background:#1a1a1a;color:#aaa;cursor:pointer;font-family:inherit}'
  + '.sp-btn:hover{border-color:#534AB7;color:#CECBF6}'
  + '@media(max-width:600px){#sp-fab{bottom:58px;padding:8px 13px}#sp-panel{bottom:100px;width:94vw;right:3vw}#sp-text{height:140px}#sp-canvas{height:160px}}';
  document.head.appendChild(css);

  var fab = document.createElement('button');
  fab.id = 'sp-fab';
  fab.textContent = '📝 Papier';
  fab.onclick = spToggle;
  document.body.appendChild(fab);

  var panel = document.createElement('div');
  panel.id = 'sp-panel';
  panel.innerHTML =
    '<div class="sp-head">'
  +   '<span class="sp-title">📝 POMOCNÝ PAPIER</span>'
  +   '<div class="sp-tabs">'
  +     '<button class="sp-tab active" id="sp-tab-text" onclick="spSetMode(\'text\')">Text</button>'
  +     '<button class="sp-tab" id="sp-tab-draw" onclick="spSetMode(\'draw\')">Kreslenie</button>'
  +   '</div>'
  +   '<button class="sp-close" onclick="spToggle()">✕</button>'
  + '</div>'
  + '<div class="sp-body">'
  +   '<textarea id="sp-text" placeholder="Sem si píš výpočty…" oninput="spSaveText()"></textarea>'
  +   '<div id="sp-canvas-wrap" style="display:none">'
  +     '<canvas id="sp-canvas"></canvas>'
  +     '<div class="sp-canvas-tools">'
  +       '<button class="sp-btn" onclick="spClearCanvas()">🗑 Vymazať</button>'
  +     '</div>'
  +   '</div>'
  + '</div>';
  document.body.appendChild(panel);

  var cv = document.getElementById('sp-canvas');
  cv.addEventListener('mousedown', spDown);
  cv.addEventListener('mousemove', spMove);
  window.addEventListener('mouseup', spUp);
  cv.addEventListener('touchstart', spDown, {passive:false});
  cv.addEventListener('touchmove', spMove, {passive:false});
  cv.addEventListener('touchend', spUp);
}

function spToggle(){
  _spOpen = !_spOpen;
  var p = document.getElementById('sp-panel');
  if(p) p.classList.toggle('open', _spOpen);
  if(_spOpen && _spMode==='draw') spInitCanvas();
}

function spSetMode(m){
  _spMode = m;
  document.getElementById('sp-tab-text').classList.toggle('active', m==='text');
  document.getElementById('sp-tab-draw').classList.toggle('active', m==='draw');
  document.getElementById('sp-text').style.display = m==='text'?'block':'none';
  document.getElementById('sp-canvas-wrap').style.display = m==='draw'?'block':'none';
  if(m==='draw') spInitCanvas();
}

function spInitCanvas(){
  var cv = document.getElementById('sp-canvas');
  if(!cv) return;
  // Match internal resolution to display size once
  if(cv.width !== cv.offsetWidth){
    cv.width = cv.offsetWidth; cv.height = cv.offsetHeight;
  }
  _spCtx = cv.getContext('2d');
  _spCtx.lineWidth = 2; _spCtx.lineCap = 'round'; _spCtx.strokeStyle = '#111';
  // Restore saved drawing for current question
  var n = matNotes[cur];
  if(n && n.draw){
    var img = new Image();
    img.onload = function(){ _spCtx.clearRect(0,0,cv.width,cv.height); _spCtx.drawImage(img,0,0,cv.width,cv.height); };
    img.src = n.draw;
  } else {
    _spCtx.clearRect(0,0,cv.width,cv.height);
  }
}

function spPos(e){
  var cv = document.getElementById('sp-canvas');
  var r = cv.getBoundingClientRect();
  var cx = (e.touches?e.touches[0].clientX:e.clientX) - r.left;
  var cy = (e.touches?e.touches[0].clientY:e.clientY) - r.top;
  return [cx*(cv.width/r.width), cy*(cv.height/r.height)];
}
function spDown(e){ e.preventDefault(); if(!_spCtx) spInitCanvas(); _spDrawing=true; var p=spPos(e); _spLastX=p[0]; _spLastY=p[1]; }
function spMove(e){ if(!_spDrawing) return; e.preventDefault(); var p=spPos(e); _spCtx.beginPath(); _spCtx.moveTo(_spLastX,_spLastY); _spCtx.lineTo(p[0],p[1]); _spCtx.stroke(); _spLastX=p[0]; _spLastY=p[1]; }
function spUp(){ if(!_spDrawing) return; _spDrawing=false; spSaveDraw(); }

function spClearCanvas(){
  var cv = document.getElementById('sp-canvas');
  if(_spCtx) _spCtx.clearRect(0,0,cv.width,cv.height);
  if(!matNotes[cur]) matNotes[cur]={};
  matNotes[cur].draw = '';
}
function spSaveText(){
  if(!matNotes[cur]) matNotes[cur]={};
  matNotes[cur].text = document.getElementById('sp-text').value;
}
function spSaveDraw(){
  var cv = document.getElementById('sp-canvas');
  if(!matNotes[cur]) matNotes[cur]={};
  try{ matNotes[cur].draw = cv.toDataURL('image/png'); }catch(e){}
}

// Volané z showQ – načíta poznámky pre aktuálnu otázku
function spLoadForCurrent(){
  spInjectUI();
  var fab = document.getElementById('sp-fab');
  if(fab) fab.style.display = (sub && sub.isMat) ? 'block' : 'none';
  var ta = document.getElementById('sp-text');
  var n = matNotes[cur] || {};
  if(ta) ta.value = n.text || '';
  if(_spOpen && _spMode==='draw') spInitCanvas();
}

