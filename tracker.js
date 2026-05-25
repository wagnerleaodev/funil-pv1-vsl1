/**
 * ============================================================
 *  TRACKER UNIVERSAL DO FUNIL — tracker.js  v5.3
 * ============================================================
 *
 *  NOVIDADES v4.1 — PageSpeed-safe (sem impacto no FCP/LCP):
 *    ✓ Geo fetch adiado para APÓS o evento load da página
 *      → API de geolocalização não compete com recursos críticos
 *    ✓ Script carregado com defer → zero bloqueio de renderização
 *    ✓ Timer de geo ajustado para iniciar junto ao fetch
 *    ✓ Compatibilidade total com v4.0
 *
 *  NOVIDADES v4.0 — Anti-Bot & Anti-Refresh Dedup:
 *    ✓ Detecção de bots/automação (webdriver, headless Chrome,
 *      PhantomJS, plugins ausentes) → is_test=true automático
 *    ✓ Visitas: refresh NÃO conta como nova visita
 *      → sessionStorage impede incremento duplicado
 *    ✓ Evento de entrada: não re-dispara em F5 / atualização
 *      → quiz_page_view enviado apenas 1× por sessão de aba
 *    ✓ bot_score enviado no metadata de todos os eventos
 *    ✓ Compatibilidade total com v3.2
 *
 *  NOVIDADES v3.2:
 *    ✓ localStorage com namespace por funil_id — 20 quizzes
 *      diferentes no mesmo browser não interferem entre si
 *    ✓ Suporte nativo a multi-domínio / multi-subdomínio
 *    ✓ Sessão propagada via URL (ft_sid) cross-domain
 *
 * ============================================================
 *  COMO USAR EM CADA PÁGINA — cole antes de </body>
 * ============================================================
 *
 *  IMPORTANTE: use sempre defer na tag <script> do tracker.
 *  O atributo defer garante que o script não bloqueie a
 *  renderização da página (PageSpeed / Core Web Vitals).
 *
 *  --- QUIZ / VSL (mesma página) ---
 *  <script>
 *    window.FUNIL_CONFIG = {
 *      url:           'https://wwlnvltegzlteuttmash.supabase.co',
 *      key:           'sb_publishable_lz8gLzFh86ll2xlVJcSe0Q_zTnWBTiH',
 *      funil_id:      'italiano-v1',
 *      funil_nome:    'Funil Italiano V1',
 *      pagina:        'quiz_vsl',
 *      eventoEntrada: 'quiz_page_view'
 *    };
 *  </script>
 *  <script src="https://www.wellnessexpertpro.com/dar-method/tracker.js?v=4.1" defer></script>
 *
 *  --- UPSELL 1 (página HTML sua) ---
 *  <script>
 *    window.FUNIL_CONFIG = {
 *      url:            'https://wwlnvltegzlteuttmash.supabase.co',
 *      key:            'sb_publishable_lz8gLzFh86ll2xlVJcSe0Q_zTnWBTiH',
 *      funil_id:       'italiano-v1',
 *      funil_nome:     'Funil Italiano V1',
 *      pagina:         'upsell_1',
 *      eventoEntrada:  'upsell_1_view',
 *      eventoAbandono: 'upsell_1_abandon'
 *    };
 *  </script>
 *  <script src="https://www.wellnessexpertpro.com/dar-method/tracker.js?v=4.1" defer></script>
 *
 *  OPCIONAL — adicione no <head> para reduzir latência DNS:
 *  <link rel="preconnect" href="https://api.country.is">
 *  <link rel="dns-prefetch" href="https://api.country.is">
 *
 * ============================================================
 *  EVENTOS MANUAIS
 * ============================================================
 *
 *  Quiz:
 *    FT.track('quiz_start')
 *    FT.track('question_view',   { pergunta_index: 1, pergunta_id: 'q1' })
 *    FT.track('question_answer', { pergunta_index: 1, opcao_index: 0, opcao_texto: 'texto' })
 *    FT.track('quiz_complete')
 *    FT.track('quiz_abandon',    { pergunta_index: currentQ })
 *
 *  VSL — nos callbacks do Vturb:
 *    FT.track('vsl_25pct')
 *    FT.track('vsl_50pct')
 *    FT.track('vsl_75pct')
 *    FT.track('vsl_fim')
 *
 *  CTA / Botão de compra:
 *    FT.track('cta_click', { destino: 'perfectpay', produto: 'principal' })
 *
 *  Upsells (em páginas HTML suas):
 *    FT.track('upsell_1_aceito',   { valor: 47, plataforma: 'perfectpay' })
 *    FT.track('upsell_1_recusado')
 *
 *  Modo teste: acesse com ?ft_test=1 na URL — automático.
 *
 *  Redirecionar mantendo sessão:
 *    window.location.href = FT.url('https://checkout.centerpag.com/pay/PPU...')
 *
 * ============================================================
 */

(function () {
  'use strict';

  var CONFIG = window.FUNIL_CONFIG;
  if (!CONFIG || !CONFIG.url || !CONFIG.key) {
    console.warn('[FT] Configure window.FUNIL_CONFIG antes de carregar o tracker.');
    return;
  }

  // Namespace por funil_id: evita que 20 quizzes diferentes no mesmo
  // browser compartilhem UTMs, contagem de visitas ou país detectado.
  var _ns              = (CONFIG.funil_id || 'ft').replace(/[^a-z0-9_-]/gi,'_');
  var SESSION_KEY      = 'ft_sid';               // sessionStorage — único por aba
  var VISIT_KEY        = 'ft_v_'   + _ns;        // localStorage — por funil
  var VISIT_CNT_KEY    = 'ft_vc_'  + _ns;        // sessionStorage — dedup refresh
  var ENTRY_FIRED_KEY  = 'ft_ef_'  + _ns;        // sessionStorage — dedup entry event
  var UTM_KEY          = 'ft_utm_' + _ns;        // localStorage — por funil
  var FUNIL_KEY        = 'ft_fid_' + _ns;        // localStorage — por funil
  var GEO_KEY          = 'ft_geo_' + _ns;        // sessionStorage — por funil

  // ── Session ID ──
  var params     = new URLSearchParams(window.location.search);
  var sidFromUrl = params.get('ft_sid');
  var sessionId  = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = sidFromUrl
      ? sidFromUrl
      : 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  // ════════════════════════════════════════════════════════════
  //  BOT DETECTION — calcula score de automação/headless
  //  ≥ 50 pts → marca como is_test=true (filtrado no dashboard)
  // ════════════════════════════════════════════════════════════
  var botScore = 0;

  // Selenium / Puppeteer / Playwright — sinal mais forte
  try { if (navigator.webdriver) botScore += 60; } catch(e) {}

  // PhantomJS
  try {
    if (typeof window.callPhantom !== 'undefined' ||
        typeof window._phantom    !== 'undefined') botScore += 60;
  } catch(e) {}

  // Headless Chrome: Chrome UA mas sem window.chrome
  try {
    var ua = navigator.userAgent || '';
    var isChromeLike = /Chrome/i.test(ua);
    if (isChromeLike && typeof window.chrome === 'undefined') botScore += 25;
  } catch(e) {}

  // Nenhum plugin instalado + Chrome UA → headless padrão
  try {
    if (navigator.plugins && navigator.plugins.length === 0 && isChromeLike) botScore += 20;
  } catch(e) {}

  // Nenhum idioma configurado — browsers reais sempre têm ≥1
  try {
    if (!navigator.languages || navigator.languages.length === 0) botScore += 15;
  } catch(e) {}

  // Tela com dimensões impossíveis (screen 0×0 ou depth 0)
  try {
    if (screen.width === 0 || screen.height === 0 || screen.colorDepth === 0) botScore += 25;
  } catch(e) {}

  // Dimensões padrão de headless Chrome (800×600 — raro em usuário real)
  try {
    if (screen.width === 800 && screen.height === 600) botScore += 10;
  } catch(e) {}

  var isBot = botScore >= 50;

  // ── Visitas — NÃO incrementa em refresh ──
  // sessionStorage é preservado em F5 mas limpo quando a aba fecha.
  // Assim: nova aba/visita → incrementa; refresh → lê o valor existente.
  var visitAlreadyCounted = sessionStorage.getItem(VISIT_CNT_KEY) === '1';
  var visitas;
  if (!visitAlreadyCounted) {
    visitas = parseInt(localStorage.getItem(VISIT_KEY) || '0', 10) + 1;
    try { localStorage.setItem(VISIT_KEY, String(visitas)); } catch(e) {}
    try { sessionStorage.setItem(VISIT_CNT_KEY, '1'); } catch(e) {}
  } else {
    // Refresh: lê sem incrementar
    visitas = parseInt(localStorage.getItem(VISIT_KEY) || '1', 10);
  }
  var isRetorno = visitas > 1;

  // ── Evento de entrada já foi disparado nesta sessão/aba? ──
  // Evita que quiz_page_view seja enviado duas vezes no F5.
  var entryAlreadyFired = sessionStorage.getItem(ENTRY_FIRED_KEY) === '1';

  // ── UTMs ──
  var utms = {}, utmFields = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'], hasUtm = false;
  utmFields.forEach(function(k){ var v=params.get(k); if(v){ utms[k]=v; hasUtm=true; } });
  if (hasUtm) try { localStorage.setItem(UTM_KEY, JSON.stringify(utms)); } catch(e) {}
  else try { utms = JSON.parse(localStorage.getItem(UTM_KEY)||'{}'); } catch(e) {}

  // ── Funil ID ──
  var funilId = params.get('ft_funil') || CONFIG.funil_id || localStorage.getItem(FUNIL_KEY) || 'principal';
  try { localStorage.setItem(FUNIL_KEY, funilId); } catch(e) {}

  // ── Device ──
  var isMobile    = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  var dispositivo = isMobile ? 'mobile' : 'desktop';
  var pageStart   = Date.now();

  // ── Modo teste (automático via ?ft_test=1, config ou detecção de bot) ──
  var isTest = params.get('ft_test') === '1' || CONFIG.is_test === true || isBot;
  if (params.get('ft_test') === '1' || isBot) {
    try { sessionStorage.setItem('ft_is_test_sess','1'); } catch(e) {}
    try { localStorage.removeItem('ft_is_test'); } catch(e) {}
  } else if (sessionStorage.getItem('ft_is_test_sess') === '1') {
    isTest = true;
  }

  // ── Idioma e fuso ──
  var idiomasBrowser = navigator.language || null;
  var fusoHorario = null;
  try { fusoHorario = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch(e) {}

  // ── Conexão ──
  var connectionType = null;
  try { var c=navigator.connection||navigator.mozConnection||navigator.webkitConnection; if(c) connectionType=c.effectiveType||c.type||null; } catch(e) {}

  // ── Tempo de carregamento ──
  var pageLoadMs = null;
  try {
    var pt = window.performance && window.performance.timing;
    if (pt && pt.navigationStart > 0) {
      if (pt.loadEventEnd > 0) {
        var ms = pt.loadEventEnd - pt.navigationStart;
        if (ms > 0 && ms < 60000) pageLoadMs = ms;
      } else {
        window.addEventListener('load', function(){
          try {
            var ms2 = performance.timing.loadEventEnd - performance.timing.navigationStart;
            if (ms2 > 0 && ms2 < 60000) pageLoadMs = ms2;
          } catch(e) {}
        });
      }
    }
  } catch(e) {}

  // ── Scroll depth ──
  var scrollMax = 0;
  var _scrollTimer = null;
  window.addEventListener('scroll', function(){
    if (_scrollTimer) clearTimeout(_scrollTimer);
    _scrollTimer = setTimeout(function(){
      _scrollTimer = null;
      try {
        var s = window.scrollY||window.pageYOffset||0;
        var h = Math.max(document.body.scrollHeight,document.documentElement.scrollHeight,document.body.offsetHeight,document.documentElement.offsetHeight) - window.innerHeight;
        if (h > 0) { var p=Math.min(Math.round(s/h*100),100); if(p>scrollMax) scrollMax=p; }
      } catch(e) {}
    }, 200);
  }, { passive:true });

  // ══════════════════════════════════════════════════
  //  GEOLOCALIZAÇÃO — aguarda ANTES do primeiro evento
  // ══════════════════════════════════════════════════
  var geo = { pais: null };
  var geoReady = false;
  var geoQueue = [];
  var geoTimer = null; // iniciado dentro de _startGeoFetch

  function resolveGeo(pais) {
    if (geoReady) return;
    geoReady = true;
    clearTimeout(geoTimer);
    if (pais) {
      geo.pais = pais;
      try { sessionStorage.setItem(GEO_KEY, JSON.stringify(geo)); } catch(e) {}
      if (window.FUNIL_DEBUG) console.log('[FT] País:', pais);
    }
    geoQueue.forEach(function(fn){ try{ fn(); }catch(e){} });
    geoQueue = [];
  }

  function onGeoReady(fn) {
    if (geoReady) fn(); else geoQueue.push(fn);
  }

  // Tenta cache primeiro — sem custo de rede, executa imediatamente
  try {
    var cached = JSON.parse(sessionStorage.getItem(GEO_KEY)||'null');
    if (cached && cached.pais) { geo = cached; resolveGeo(cached.pais); }
  } catch(e) {}

  if (!geoReady) {
    // ── _startGeoFetch é disparado APÓS o evento load da página.
    //    Isso garante que as conexões externas (api.country.is, ipapi.co)
    //    não competem com FCP/LCP/TBT — PageSpeed não as vê no caminho
    //    crítico de renderização.
    //    Se a página já carregou (ex: SPA ou navegação interna),
    //    executa imediatamente.
    var _startGeoFetch = function() {
      // Timer de 5s começa aqui — margem para mobile em conexão lenta
      geoTimer = setTimeout(function(){ resolveGeo(null); }, 5000);

      // Mapa completo de códigos ISO → nomes
      var ISO_CODES = {
        'IT':'Italy','BR':'Brazil','US':'United States','DE':'Germany',
        'ES':'Spain','FR':'France','PT':'Portugal','AR':'Argentina',
        'MX':'Mexico','CO':'Colombia','GB':'United Kingdom','NL':'Netherlands',
        'CH':'Switzerland','AT':'Austria','CA':'Canada','AU':'Australia',
        'JP':'Japan','KR':'South Korea','PL':'Poland','BE':'Belgium',
        'SE':'Sweden','NO':'Norway','DK':'Denmark','FI':'Finland',
        'RO':'Romania','HU':'Hungary','CZ':'Czech Republic','GR':'Greece',
        'TR':'Turkey','RU':'Russia','UA':'Ukraine','CN':'China','IN':'India',
        'ID':'Indonesia','PH':'Philippines','TW':'Taiwan','TH':'Thailand',
        'VN':'Vietnam','MY':'Malaysia','SG':'Singapore','NZ':'New Zealand',
        'ZA':'South Africa','NG':'Nigeria','EG':'Egypt','MA':'Morocco',
        'KE':'Kenya','GH':'Ghana','AO':'Angola','ET':'Ethiopia',
        'CL':'Chile','PE':'Peru','VE':'Venezuela','EC':'Ecuador',
        'BO':'Bolivia','PY':'Paraguay','UY':'Uruguay','CR':'Costa Rica',
        'PA':'Panama','DO':'Dominican Republic','CU':'Cuba','GT':'Guatemala',
        'HN':'Honduras','SV':'El Salvador','NI':'Nicaragua','PR':'Puerto Rico',
        'IE':'Ireland','IL':'Israel','SA':'Saudi Arabia','AE':'United Arab Emirates',
        'QA':'Qatar','KW':'Kuwait','LB':'Lebanon','JO':'Jordan','IQ':'Iraq',
        'IR':'Iran','PK':'Pakistan','BD':'Bangladesh','LK':'Sri Lanka',
        'SK':'Slovakia','SI':'Slovenia','HR':'Croatia','RS':'Serbia',
        'BG':'Bulgaria','AL':'Albania','MK':'North Macedonia','BA':'Bosnia',
        'LT':'Lithuania','LV':'Latvia','EE':'Estonia','BY':'Belarus',
        'MD':'Moldova','IS':'Iceland','LU':'Luxembourg','MT':'Malta',
        'CY':'Cyprus','BH':'Bahrain','OM':'Oman','YE':'Yemen',
        'JM':'Jamaica','TT':'Trinidad and Tobago'
      };

      // Tentativa 1: /cdn-cgi/trace (Cloudflare — mesma origem, edge local, iOS-safe)
      fetch('/cdn-cgi/trace', { cache: 'no-store' })
        .then(function(r){ return r.ok ? r.text() : Promise.reject(); })
        .then(function(t){
          var m = t.match(/loc=([A-Z]{2})/);
          if (m && m[1] && m[1] !== 'XX') { resolveGeo(ISO_CODES[m[1]] || m[1]); }
          else throw 0;
        })
        .catch(function(){
          // Tentativa 2: api.country.is (CORS livre)
          fetch('https://api.country.is/', { cache: 'no-store' })
            .then(function(r){ return r.ok ? r.json() : Promise.reject(); })
            .then(function(d){
              if (d && d.country) { resolveGeo(ISO_CODES[d.country] || d.country); }
              else throw 0;
            })
            .catch(function(){
              // Tentativa 3: ipapi.co (CORS livre, sem key)
              fetch('https://ipapi.co/json/', { cache: 'no-store' })
                .then(function(r){ return r.ok ? r.json() : Promise.reject(); })
                .then(function(d){
                  if (d && (d.country_name || d.country)) {
                    resolveGeo(d.country_name || ISO_CODES[d.country] || d.country);
                  } else throw 0;
                })
                .catch(function(){
                  // Tentativa 4: fuso horário como aproximação (sem rede)
                  try {
                var tz = (fusoHorario||'').toLowerCase();
                var tzMap = {
                  'rome':'Italy','milan':'Italy','catania':'Italy','palermo':'Italy',
                  'berlin':'Germany','frankfurt':'Germany','hamburg':'Germany','munich':'Germany',
                  'madrid':'Spain','barcelona':'Spain','canary':'Spain',
                  'paris':'France','lyon':'France',
                  'sao_paulo':'Brazil','manaus':'Brazil','recife':'Brazil',
                  'fortaleza':'Brazil','belem':'Brazil','cuiaba':'Brazil',
                  'porto_velho':'Brazil','boa_vista':'Brazil','maceio':'Brazil',
                  'new_york':'United States','los_angeles':'United States',
                  'chicago':'United States','denver':'United States',
                  'phoenix':'United States','anchorage':'United States',
                  'honolulu':'United States','detroit':'United States',
                  'bogota':'Colombia','buenos_aires':'Argentina',
                  'mexico_city':'Mexico','monterrey':'Mexico',
                  'lisbon':'Portugal','azores':'Portugal',
                  'london':'United Kingdom','edinburgh':'United Kingdom',
                  'zurich':'Switzerland','geneva':'Switzerland',
                  'vienna':'Austria','amsterdam':'Netherlands',
                  'sydney':'Australia','melbourne':'Australia',
                  'brisbane':'Australia','perth':'Australia',
                  'tokyo':'Japan','osaka':'Japan','sapporo':'Japan',
                  'seoul':'South Korea','busan':'South Korea',
                  'warsaw':'Poland','krakow':'Poland',
                  'brussels':'Belgium','antwerp':'Belgium',
                  'stockholm':'Sweden','gothenburg':'Sweden',
                  'oslo':'Norway','bergen':'Norway',
                  'copenhagen':'Denmark','aarhus':'Denmark',
                  'helsinki':'Finland','turku':'Finland',
                  'bucharest':'Romania','cluj':'Romania',
                  'budapest':'Hungary','prague':'Czech Republic',
                  'athens':'Greece','thessaloniki':'Greece',
                  'ankara':'Turkey','istanbul':'Turkey',
                  'moscow':'Russia','st_petersburg':'Russia','novosibirsk':'Russia',
                  'lima':'Peru','santiago':'Chile','caracas':'Venezuela',
                  'quito':'Ecuador',
                  'cairo':'Egypt','johannesburg':'South Africa',
                  'nairobi':'Kenya','lagos':'Nigeria','casablanca':'Morocco',
                  'dubai':'United Arab Emirates','riyadh':'Saudi Arabia',
                  'karachi':'Pakistan','mumbai':'India','kolkata':'India',
                  'new_delhi':'India','chennai':'India','bangalore':'India',
                  'jakarta':'Indonesia','singapore':'Singapore',
                  'bangkok':'Thailand','ho_chi_minh':'Vietnam','hanoi':'Vietnam',
                  'manila':'Philippines','taipei':'Taiwan',
                  'shanghai':'China','beijing':'China','hong_kong':'China',
                  'auckland':'New Zealand','christchurch':'New Zealand'
                };
                var found = null;
                var tzLow = tz.replace(/\//g,'_').replace(/-/g,'_');
                Object.keys(tzMap).forEach(function(k){
                  if(tzLow.indexOf(k)>=0) found=tzMap[k];
                });
                resolveGeo(found);
              } catch(e){ resolveGeo(null); }
                });
            });
        });
    };

    // Aguarda load para não impactar PageSpeed/Core Web Vitals.
    // { once: true } remove o listener automaticamente após disparar.
    if (document.readyState === 'complete') {
      _startGeoFetch();
    } else {
      window.addEventListener('load', _startGeoFetch, { once: true });
    }
  }

  // ══════════════════════════════════════════════════
  //  ENVIO DE EVENTOS
  // ══════════════════════════════════════════════════
  function buildPayload(evento, extra) {
    extra = extra || {};
    var p = {
      session_id:      sessionId,
      evento:          evento,
      pagina:          CONFIG.pagina || window.location.pathname,
      funil_id:        funilId,
      funil_nome:      CONFIG.funil_nome || null,
      dispositivo:     dispositivo,
      is_mobile:       isMobile,
      is_test:         isTest,
      is_retorno:      isRetorno,
      visitas_total:   visitas,
      pais:            geo.pais,
      idioma_browser:  idiomasBrowser,
      fuso_horario:    fusoHorario,
      connection_type: connectionType,
      page_load_ms:    pageLoadMs,
      scroll_max_pct:  scrollMax,
      utm_source:      utms.utm_source   || null,
      utm_medium:      utms.utm_medium   || null,
      utm_campaign:    utms.utm_campaign || null,
      utm_content:     utms.utm_content  || null,
      utm_term:        utms.utm_term     || null,
      tempo_na_pagina: Math.round((Date.now()-pageStart)/1000),
      metadata:        { bot_score: botScore }
    };
    var diretos = ['pergunta_index','pergunta_id','opcao_texto','opcao_index','tempo_pergunta'];
    diretos.forEach(function(k){ if(extra[k]!==undefined) p[k]=extra[k]; });
    Object.keys(extra).forEach(function(k){ if(diretos.indexOf(k)===-1) p.metadata[k]=extra[k]; });

    // ─── Meta CAPI integration ───────────────────────────────
    // Worker precisa de: fb_pixel_id (array OU string), fb_event_ids
    // (map MetaEventName → event_id pra dedup com pixel browser),
    // fbp/fbc cookies (match quality), event_source_url (URL real).
    if (CONFIG.fb_pixel_id) p.metadata.fb_pixel_id = CONFIG.fb_pixel_id;
    if (window._fbEventIds) p.metadata.fb_event_ids = window._fbEventIds;
    try {
      var _fbpM = document.cookie.match(/(?:^|; )_fbp=([^;]+)/);
      var _fbcM = document.cookie.match(/(?:^|; )_fbc=([^;]+)/);
      if (_fbpM) p.metadata.fbp = decodeURIComponent(_fbpM[1]);
      if (_fbcM) p.metadata.fbc = decodeURIComponent(_fbcM[1]);
    } catch(e) {}
    p.metadata.event_source_url = window.location.href;

    return p;
  }

  var ENDPOINT = CONFIG.url + '/rest/v1/eventos';
  var HEADERS  = {
    'Content-Type': 'application/json',
    'apikey':        CONFIG.key,
    'Authorization': 'Bearer ' + CONFIG.key,
    'Prefer':        'return=minimal'
  };

  function sendNow(body, keepalive) {
    return fetch(ENDPOINT, { method:'POST', headers:HEADERS, body:body, keepalive:!!keepalive })
      .catch(function(){
        setTimeout(function(){
          fetch(ENDPOINT, { method:'POST', headers:HEADERS, body:body }).catch(function(){});
        }, 3000);
      });
  }

  function track(evento, extra) {
    var payload = buildPayload(evento, extra);
    if (window.FUNIL_DEBUG) console.log('[FT]', evento, payload);
    sendNow(JSON.stringify(payload), false);
  }

  // ── Abandono — iOS Safari precisa de visibilitychange ──
  var abandonoFired = false;
  function fireAbandono() {
    if (abandonoFired || !CONFIG.eventoAbandono) return;
    abandonoFired = true;
    var payload = buildPayload(CONFIG.eventoAbandono, {
      tempo_total:    Math.round((Date.now()-pageStart)/1000),
      scroll_max_pct: scrollMax
    });
    sendNow(JSON.stringify(payload), true); // keepalive: true para pagehide
  }

  window.addEventListener('pagehide', fireAbandono);
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'hidden') fireAbandono();
  });

  // ── URL com sessão + funil ──
  function buildUrl(base) {
    var sep = base.indexOf('?') >= 0 ? '&' : '?';
    return base + sep + 'ft_sid=' + encodeURIComponent(sessionId) + '&ft_funil=' + encodeURIComponent(funilId);
  }

  // ── API pública ──
  window.FT = {
    track:     track,
    url:       buildUrl,
    sessionId: sessionId,
    funilId:   funilId,
    isRetorno: isRetorno,
    isTest:    isTest,
    isBot:     isBot,
    botScore:  botScore
  };

  // ════════════════════════════════════════════════════════════
  //  ENTRY EVENT — dispara assim que geo resolver
  //
  //  v4.5: REMOVIDA a regra "30s sem interação = bot". Estava
  //  filtrando ~7% dos usuários reais (idosos lendo a página com
  //  calma, navegadores in-app de Facebook/Instagram/TikTok no
  //  Android, etc.). Bots reais não executam JS → não chegam aqui.
  //  Filtragem de bot continua via bot_score (>= 50).
  //
  //  Se refresh → entryAlreadyFired=true → bloco ignorado.
  // ════════════════════════════════════════════════════════════
  if (!entryAlreadyFired) {
    var _interactAt    = null;
    var _INTERACT_EVS  = ['mousedown','touchstart','scroll','keydown'];

    function _fireEntry() {
      if (entryAlreadyFired) return;
      entryAlreadyFired = true;
      try { sessionStorage.setItem(ENTRY_FIRED_KEY, '1'); } catch(e) {}
      onGeoReady(function(){
        track(CONFIG.eventoEntrada || 'page_view', {
          referrer:         document.referrer || null,
          is_retorno:       isRetorno,
          time_to_interact: _interactAt ? Math.round((_interactAt - pageStart) / 1000) : null
        });
      });
    }

    // Captura timestamp da PRIMEIRA interação só para a métrica
    // time_to_interact — NÃO bloqueia o disparo do evento de entrada.
    function _onFirstInteract() {
      if (_interactAt) return;
      _interactAt = Date.now();
      _INTERACT_EVS.forEach(function(ev){
        document.removeEventListener(ev, _onFirstInteract, true);
      });
    }
    _INTERACT_EVS.forEach(function(ev){
      document.addEventListener(ev, _onFirstInteract, { passive:true, capture:true });
    });

    // Dispara imediatamente: todo lead que carregou a página é contado.
    _fireEntry();
  }

})();
