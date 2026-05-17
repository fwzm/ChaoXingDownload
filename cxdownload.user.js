// ==UserScript==
// @name         ChaoXing Course Downloader
// @namespace    https://github.com/fwzm/ChaoXingDownload
// @version      2.1.4
// @description  Download course resources from ChaoXing (mooc2-ans) - PPT/PDF/DOC/Video
// @author       fwzm
// @match        *://*.chaoxing.com/*
// @match        *://*.edu.cn/*
// @match        *://*.xueyinonline.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @license      GPL-3.0
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    // ====== ANTI-DUP: nuclear cleanup v2.1.4 (CSS hide + JS remove) ======
    // Problem confirmed: KCDL/other scripts create toolbars that JS DOM queries cannot find.
    // Possible reasons: Shadow DOM, late loading after our cleanup, position:sticky, etc.
    //
    // NEW STRATEGY (dual approach):
    //   A. CSS injection: Hide ALL fixed/sticky elements near page top, show only ours
    //   B. JS removal: Multiple detection methods as backup
    //   C. elementFromPoint: Physically detect what's visible at viewport top

    var _isDuplicateRun = false;
    var OUR_BAR_ID = '__cxdl_bar_unique_v214';
    var OUR_FLOAT_ID = '__cxdl_float_unique_v214';

    // Layer 1: Global flag
    if (unsafeWindow.__cxdl_v214) { _isDuplicateRun = true; }
    unsafeWindow.__cxdl_v214 = true;
    unsafeWindow.__cxdl_v213 = true; unsafeWindow.__cxdl_v212 = true; unsafeWindow.__cxdl_v211 = true;
    unsafeWindow.__cxdl_v210 = true; unsafeWindow._cxdl_v209 = true; unsafeWindow._cxdl_v208 = true;

    // Layer 2: DOM marker
    try { document.documentElement.setAttribute('data-cxdl-active', 'v2.1.4'); } catch(e) {}

    // ====== STRATEGY A: CSS Nuclear Hiding ======
    // This hides ANY fixed/sticky element in the top 80px of the viewport,
    // then explicitly shows only OUR toolbar via ID-specific override.
    // This works even for Shadow DOM elements (if they inherit styles from light DOM).
    GM_addStyle([
        /* Hide ALL fixed/sticky bars at the top of the page */
        '[data-cxdl-nuke] { display: none !important; visibility: hidden !important; pointer-events: none !important; height: 0 !important; overflow: hidden !important; }',
        /* Our own bar - always visible */
        '#' + OUR_BAR_ID + ' { display: flex !important; visibility: visible !important; pointer-events: auto !important; height: auto !important; }',
        '#' + OUR_FLOAT_ID + ' { display: block !important; visibility: visible !important; pointer-events: auto !important; }'
    ].join(''));

    // ====== STRATEGY B: JS Multi-Method Removal ======
    function nukeForeignToolbars() {
        var removed = 0;
        try {
            var ourId = OUR_BAR_ID;

            // B1: getComputedStyle scan — find fixed/sticky elements at top
            var els = document.body ? document.body.getElementsByTagName('*') : [];
            for (var i = 0; i < els.length; i++) {
                try {
                    var el = els[i];
                    if (el.id === ourId || el.id === OUR_FLOAT_ID) continue;
                    if (el.className === 'cxdl-toast') continue;

                    var cs = window.getComputedStyle(el);
                    var pos = cs.position;
                    if (pos !== 'fixed' && pos !== 'sticky') continue;

                    var r = el.getBoundingClientRect();
                    if (r.top > 70 || r.top < -10) continue;
                    if (r.width < 150 || r.height < 15 || r.height > 100) continue;

                    var cls = (el.className || '').toString();
                    var txt = (el.textContent || '').trim();

                    console.log('[CXDL-SCAN] pos=' + pos + ' top=' + Math.round(r.top) +
                        ' id=' + (el.id || '-') +
                        ' cls=' + cls.substring(0,40) +
                        ' txt=' + txt.substring(0,50) +
                        ' bg=' + (cs.backgroundColor||'-').substring(0,20));

                    // Mark for removal via attribute (CSS will hide it)
                    var shouldRemove = false;

                    // Text-based detection
                    if (/\[KCDL\]|Resource DL|No IDs.*Materials|Scan.*Select DL/i.test(txt)) shouldRemove = true;
                    // Class-based
                    if (/kcdl|kc-dl|kcbar|kcbanner/i.test(cls)) shouldRemove = true;
                    // Blue-ish background bar with download-like buttons
                    if (/(#0d39|#1565|#1976|rgb\(13,\s*57|rgb\(21,\s*101|rgb\(25,\s*118)/i.test(cs.backgroundColor || '')
                        && /Scan|DL|PPT|PDF|All DL/.test(txt)
                        && r.width > 300 && r.height < 80) shouldRemove = true;
                    // Any fixed bar that looks like a download toolbar AND isn't ours
                    if (/Scan|Select\s+DL|All\s+DL|^No IDs/.test(txt) && r.width > 400 && r.height < 60) shouldRemove = true;

                    if (shouldRemove) {
                        console.log('[CXDL] NUKING:', cls.substring(0,30), '|', txt.substring(0,45));
                        el.setAttribute('data-cxdl-nuke', '');
                        // Also try actual removal
                        try { el.remove(); removed++; } catch(ex) {}
                    }
                } catch(e2) {}
            }

            // B2: TreeWalker text search
            if (document.body) {
                var tw = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null, false);
                var nd;
                while ((nd = tw.nextNode())) {
                    try {
                        var t = (nd.textContent || '').trim();
                        if (t.length < 5 || t.length > 300) continue;
                        if (nd.id === ourId) continue;
                        if (t.indexOf('[KCDL]') >= 0 || (t.indexOf('[CXDL]') >= 0 && t.indexOf('Resource') >= 0)) {
                            var nr = nd.getBoundingClientRect();
                            if (nr.width > 100 && nr.height > 15 && nr.height < 120) {
                                console.log('[CXDL] NUKING(text):', (nd.className||'').substring(0,30));
                                nd.setAttribute('data-cxdl-nuke', '');
                                try { nd.remove(); removed++; } catch(ex3) {}
                            }
                        }
                    } catch(e4) {}
                }
            }

            // B3: Selector-based
            ['#_cxdl_bar', '#_cxdl_bar2', '#_kcdl_bar',
             '.kcdl-bar', '.kcdl-float', '.kcdl-panel', '.kcdl-wrap',
             '[id*="kcdl"]', '[class*="kcdl"]'].forEach(function(s) {
                try {
                    document.querySelectorAll(s).forEach(function(x) {
                        if (x.id !== ourId && x.id !== OUR_FLOAT_ID) {
                            console.log('[CXDL] NUKING(sel):', s);
                            x.setAttribute('data-cxdl-nuke', '');
                            try { x.remove(); removed++; } catch(ex5) {}
                        }
                    });
                } catch(e6) {}
            });

            // B4: iframe penetration — try to clean inside same-origin iframes
            try {
                document.querySelectorAll('iframe').forEach(function(fr) {
                    try {
                        var doc = fr.contentDocument || fr.contentWindow.document;
                        if (!doc) return;
                        doc.querySelectorAll('*').forEach(function(fe) {
                            var fcs = window.getComputedStyle(fe);
                            if (fcs.position === 'fixed' && fe.getBoundingClientRect().top < 60) {
                                var ft = (fe.textContent || '').trim();
                                if (/\[KCDL\]|\[CXDL\]|Resource DL/.test(ft)) {
                                    console.log('[CXDL] NUKING(iframe):', (fe.className||'').substring(0,30));
                                    fe.remove(); removed++;
                                }
                            }
                        });
                    } catch(ife) {} // cross-origin iframes will throw, ignore
                });
            } catch(e7) {}

        } catch(err) {
            console.error('[CXDL] nukeForeignToolbars error:', err);
        }
        if (removed > 0) console.log('[CXDL] Total nuked:', removed);
    }

    // Run immediately + delayed + periodic
    nukeForeignToolbars();
    setTimeout(nukeForeignToolbars, 500);
    setTimeout(nukeForeignToolbars, 1500);
    setTimeout(nukeForeignToolbars, 3000);
    setTimeout(nukeForeignToolbars, 5000);
    setTimeout(nukeForeignToolbars, 8000);

    // ====== STRATEGY C: elementFromPoint — detect what's physically visible at top ======
    function checkTopArea() {
        try {
            // Check points across the top area of the viewport
            for (var px = 10; px <= Math.min(window.innerWidth - 10, 800); px += 200) {
                for (var py = 5; py <= 50; py += 15) {
                    var hit = document.elementFromPoint(px, py);
                    if (!hit) continue;
                    if (hit.id === OUR_BAR_ID || hit.id === OUR_FLOAT_ID) continue;
                    // Walk up to find the positioned container
                    var walkUp = hit;
                    while (walkUp && walkUp !== document.body) {
                        var wcs = window.getComputedStyle(walkUp);
                        if (wcs.position === 'fixed' || wcs.position === 'sticky') {
                            var wtxt = (walkUp.textContent || '').trim().substring(0,60);
                            var wcls = (walkUp.className || '').toString().substring(0,40);
                            console.log('[CXDL-POINT] ('+px+','+py+') hit fixed:', wcls, '|', wtxt);
                            // If this looks like a foreign toolbar, nuke it
                            if ((/\[KCDL\]|Resource DL|No IDs.*Materials/.test(wtxt) ||
                                 /kcdl/i.test(wcls)) &&
                                walkUp.id !== OUR_BAR_ID) {
                                console.log('[CXDL] POINT-NUKE:', wcls);
                                walkUp.setAttribute('data-cxdl-nuke', '');
                                try { walkUp.remove(); } catch(e8) {}
                            }
                            break;
                        }
                        walkUp = walkUp.parentElement;
                    }
                }
            }
        } catch(ep) {}
    }
    setTimeout(checkTopArea, 2000);
    setTimeout(checkTopArea, 6000);

    console.log('[CXDL] v2.1.4 starting' + (_isDuplicateRun ? ' [dup]' : ''), location.href);

    // ====== DOWNLOAD MODE (user choice) ======
    // 'gm' = GM_download (Tampermonkey native download - filename from headers, no blob URL needed)
    // 'browser' = GM_xmlhttpRequest blob URL (may lose filename from headers)
    var _dlMode = 'gm'; // default to GM
    try {
        var saved = localStorage.getItem('cxdl_dlMode');
        if (saved === 'browser') _dlMode = 'browser';
    } catch(e){}

    // ====== CSS ======
    GM_addStyle([
        '.cxdl-bar{position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#1565c0;color:#fff;padding:7px 14px;display:flex;align-items:center;gap:6px;font-size:12px;box-shadow:0 3px 12px rgba(0,0,0,0.25);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;flex-wrap:wrap}',
        '.cxdl-bar>span.title{font-weight:bold;font-size:13px;margin-right:6px;white-space:nowrap}',
        '.cxdl-bar>span.status{color:rgba(255,255,255,0.8);margin-left:auto;margin-right:8px;font-size:11px;white-space:nowrap}',
        '.cxdl-btn{padding:4px 10px;border:1px solid rgba(255,255,255,0.45);border-radius:14px;background:transparent;color:#fff;font-size:11px;cursor:pointer;white-space:nowrap;line-height:1.5;font-family:inherit}',
        '.cxdl-btn:hover{background:rgba(255,255,255,0.18)}',
        '.cxdl-btn.pri{background:rgba(56,142,60,0.85);border-color:transparent}','.cxdl-btn.pri:hover{background:rgba(56,142,60,1)}',
        '.cxdl-btn.warn{background:rgba(230,81,0,0.85);border-color:transparent}','.cxdl-btn.warn:hover{background:rgba(230,81,0,1)}',
        '.cxdl-btn.info{background:rgba(66,133,244,0.85);border-color:transparent}','.cxdl-btn.info:hover{background:rgba(66,133,244,1)}',
        '.cxdl-btn.mode-btn{background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.5);font-size:10px;padding:3px 8px}',
        '.cxdl-btn.mode-btn.active{background:#ff9800;border-color:#ff9800;color:#fff}',
        '.cxdl-float{position:fixed;bottom:16px;right:16px;z-index:2147483646;width:38px;height:38px;border-radius:50%;background:#e65100;color:#fff;font-size:15px;border:none;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,0.3);font-family:inherit}',
        '.cxdl-float:hover{background:#d84315}',
        '.cxdl-toast{position:fixed;top:48px;right:14px;background:#fff;padding:9px 14px;border-radius:8px;font-size:12px;color:#222;border:1px solid #ddd;box-shadow:0 4px 20px rgba(0,0,0,0.12);max-width:420px;z-index:2147483647;font-family:inherit}',
        '.cxdl-modal-bg{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.45);z-index:2147483647;display:flex;justify-content:center;align-items:center;font-family:inherit}',
        '.cxdl-modal{background:#fff;border-radius:12px;padding:18px;max-width:640px;max-height:78vh;display:flex;flex-direction:column;min-width:360px;width:94%;box-shadow:0 10px 50px rgba(0,0,0,0.25)}',
        '.cxdl-modal-hd{font-size:14px;font-weight:bold;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center}',
        '.cxdl-modal-bd{overflow-y:auto;flex:1;margin-bottom:12px}',
        '.cxdl-modal-row{display:flex;align-items:center;padding:6px 5px;border-bottom:1px solid #f7f7f7;gap:6px}',
        '.cxdl-modal-row:hover{background:#fafafa}',
        '.cxdl-modal-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#333;cursor:pointer}',
        '.cxdl-modal-tag{font-size:10px;color:#888;background:#f0f0f0;padding:2px 6px;border-radius:3px;flex-shrink:0;text-transform:uppercase;font-weight:600}',
        '.cxdl-modal-actions{display:flex;justify-content:flex-end;gap:6px;padding-top:4px;flex-wrap:wrap}',
        '.cxdl-modal-actions button{padding:6px 14px;border:none;border-radius:6px;color:#fff;font-size:12px;cursor:pointer;font-family:inherit}',
        '.cxdl-injbtn-wrap{float:right!important;display:inline-block!important;margin-left:8px;vertical-align:middle;clear:none}',
        '.cxdl-injbtn{display:inline-block!important;padding:1px 10px;background:#1976d2;color:#fff!important;border:none;border-radius:10px;font-size:11px;cursor:pointer;line-height:1.7;font-family:inherit;white-space:nowrap}',
        '.cxdl-injbtn:hover{background:#1565c0}'
    ].join(''));

    // ====== UTILS ======
    function cleanName(n) { return (n||'').replace(/[\/\\?%*:|"<>\x00-\x1f]/g,'_').trim().substring(0,120); }
    function delay(ms) { return new Promise(function(r){setTimeout(r,ms);}); }
    function isTargetPage() { return /\/mycourse\/stu|coursedata|studentstudy/.test(location.href); }

    var _toastTmr = null;
    function toast(msg,dur,isErr,isOk){
        var el = document.querySelector('.cxdl-toast');
        if(!el){el=document.createElement('div');el.className='cxdl-toast';document.body.appendChild(el);}
        clearTimeout(_toastTmr);
        el.innerHTML=(isOk?'[OK] ':(isErr?'[ERR] ':''))+msg;
        el.style.opacity=1;
        if(dur>0)_toastTmr=setTimeout(function(){el.style.opacity=0;},dur);
    }
    function setStatus(msg){
        var el=document.getElementById('_cxdl_st2');
        if(el)el.textContent=msg;
    }

    // ====== Extract page context ======
    function getPageParams(){
        var p={};
        try{
            var u=new URL(location.href);
            p.courseid=u.searchParams.get('courseid')||u.searchParams.get('courseId')||'';
            p.clazzid=u.searchParams.get('clazzid')||u.searchParams.get('classId')||'';
            p.cpid=u.searchParams.get('cpid')||'';
        }catch(e){}
        return p;
    }
    unsafeWindow._cxdl_ids=[];
    var _pageParams=getPageParams();

    // ====== Get filename near a container element ======
    function guessFilename(container){
        var el=container;
        for(var up=0;up<5;up++){
            if(!el)break;
            var txt=(el.textContent||'').trim();
            var m=txt.match(/(.+?)\.(pptx?|docx?|xlsx?|pdf|mp4|avi|wmv)\b/i);
            if(m&&m[1].length<120)return m[0];
            el=el.parentElement;
        }
        var parent=container.parentElement;
        if(parent){
            var sib=parent.previousElementSibling;
            if(sib){
                var stxt=(sib.textContent||'').trim();
                var sm=stxt.match(/(.+?)\.(pptx?|docx?|xlsx?|pdf|mp4)/i);
                if(sm)return sm[0];
            }
        }
        return null;
    }

    // ====== Parse Content-Disposition header for filename ======
    function parseCDHeader(cd){
        if(!cd)return null;
        // RFC 5987 encoded: filename*=UTF-8''%XX%XX...
        var m=cd.match(/filename\*=(?:UTF-8''|)([^;]+)/i);
        if(m){
            var v=decodeURIComponent(m[1].replace(/^UTF-8''/i,'')).replace(/["']/g,'');
            if(v)return cleanName(v);
        }
        // Fallback: filename="..."
        m=cd.match(/filename=["']?([^;"']+)/i);
        if(m)return cleanName(m[1]);
        return null;
    }

    // ====== API helper ======
    function gmGet(url,extraHeaders){
        return new Promise(function(resolve){
            console.log('[CXDL] GET',url);
            var hdrs={
                'Referer':location.href,
                'Origin':location.origin,
                'Accept':'application/json,text/plain,*/*',
                'X-Requested-With':'XMLHttpRequest'
            };
            if(extraHeaders){
                Object.keys(extraHeaders).forEach(function(k){hdrs[k]=extraHeaders[k];});
            }
            GM_xmlhttpRequest({
                method:'GET', url:url,
                headers:hdrs,
                anonymous:false,
                onload:function(resp){
                    console.log('[CXDL] RESP '+resp.status,url.substring(0,80));
                    if(resp.status>=200&&resp.status<300){
                        try{resolve({status:resp.status,data:JSON.parse(resp.responseText),raw:resp.responseText,cd:resp.responseHeaders&&resp.responseHeaders.match(/content-disposition:\s*([^\r\n]+)/i)?resp.responseHeaders.match(/content-disposition:\s*([^\r\n]+)/i)[1]:null});}catch(e){resolve({status:resp.status,data:null,raw:resp.responseText,cd:null});}
                    }else{
                        resolve({status:resp.status,data:null,raw:'',cd:null});
                    }
                },
                onerror:function(){resolve({status:-1});},
                ontimeout:function(){resolve({status:-2});}
            });
        });
    }

    // ====== fetchMeta v2: multi-strategy resource resolution ======
    async function fetchMeta(objectid, hintName){
        // Force HTTPS to avoid Mixed Content warnings on secure pages
        var proto='https:';
        // Only use http: if the page is genuinely NOT secure
        try { if (location.protocol && location.protocol !== 'https:') proto=location.protocol; } catch(e){}
        var r={oid:objectid,fname:hintName||('r_'+objectid),url:null,type:'?'};

        var ext=(r.fname.split('.').pop()||'').toLowerCase();
        if(/^pdf$/.test(ext))r.type='PDF';
        else if(/^pptx?$/.test(ext))r.type='PPT';
        else if(/^docx?$/.test(ext))r.type='DOC';
        else if(/^xlsx?$/.test(ext))r.type='XLS';
        else if(/^(mp4|flv|avi|wmv|mp3)$/.test(ext))r.type='VIDEO';

        var hosts=['mooc1.chaoxing.com','mooc1-api.chaoxing.com','ananas.chaoxing.com'];
        if(/xueyinonline/.test(location.host))hosts=['mooc1.xueyinonline.com'];

        // ---- STRATEGY 1: Standard status API ----
        for(var h=0;h<hosts.length;h++){
            var apiUrl=proto+'//'+hosts[h]+'/ananas/status/'+objectid+'?flag=normal';
            if(_pageParams.cpid)apiUrl+='&_cp='+_pageParams.cpid;
            if(_pageParams.courseid)apiUrl+='&courseid='+_pageParams.courseid;
            var resp=await gmGet(apiUrl);
            if(resp.data && resp.data.filename){
                r.fname=cleanName(resp.data.filename);
                var rex=(r.fname.split('.').pop()||'').toLowerCase();
                if(/^pdf$/.test(rex))r.type='PDF';else if(/^pptx?$/.test(rex))r.type='PPT';else if(/^docx?$/.test(rex))r.type='DOC';else if(/^xlsx?$/.test(rex))r.type='XLS';else if(/^(mp4|flv|avi|wmv|mp3)$/.test(rex))r.type='VIDEO';
                var dlUrl=null;
                if(resp.data.download){
                    dlUrl=resp.data.download;
                    if(dlUrl.indexOf('http')!==0)dlUrl=proto+'//'+dlUrl;
                    if(/\.pptx?([\?#&]|$)/i.test(dlUrl))r.type='PPT';
                    else if(/\.docx?([\?#&]|$)/i.test(dlUrl))r.type='DOC';
                    else if(/\.xlsx?([\?#&]|$)/i.test(dlUrl))r.type='XLS';
                    else if(/\.pdf([\?#&]|$)/i.test(dlUrl))r.type='PDF';
                }else if(r.type==='PDF'&&resp.data.pdf){
                    dlUrl=resp.data.pdf;
                }else if(resp.data.http){
                    dlUrl=resp.data.http;
                }
                if(dlUrl){r.url=dlUrl;return r;}
            }
        }

        // ---- STRATEGY 2: Alternative endpoints ----
        var altPatterns=[
            proto+'//'+hosts[0]+'/ananas/retreive/'+objectid,
            proto+'//'+hosts[0]+'/ananas/portal/fullscreen/'+objectid,
            proto+'//'+hosts[0]+'/ananas/pcDirectDownload?oid='+objectid+'&flag=1'
        ];
        for(var ap=0;ap<altPatterns.length;ap++){
            var ar=await gmGet(altPatterns[ap]);
            if(ar.status===200&&ar.raw&&ar.raw.length>50){
                var um=ar.raw.match(/https?:\/\/[^"'\s]+\.(pptx?|docx?|pdf|xlsx?)[^"'\s]*/i);
                if(um){
                    r.url=um[0];
                    var ue=/\.(pptx?|docx?|pdf|xlsx?)([\?#]|$)/i.exec(um[0]);
                    if(ue){if(/ppt/i.test(ue[1]))r.type='PPT';else if(/doc/i.test(ue[1]))r.type='DOC';else if(/xls/i.test(ue[1]))r.type='XLS';else r.type='PDF';}
                    return r;
                }
                if(altPatterns[ap].indexOf('/retreive/')!==-1 && ar.raw.indexOf('<')===0){
                    r.url=altPatterns[ap];
                    r.err='fallback_url';
                    return r;
                }
            }
        }

        // ---- STRATEGY 3: Construct direct retreive URL as last resort ----
        var fnameEnc=r.fname.replace(/[^\w\u4e00-\u9fff.-]/g,'_');
        var directUrl=proto+'//'+hosts[0]+'/ananas/retreive/'+objectid+'/'+fnameEnc;
        r.url=directUrl;
        r.err='fallback_url';
        console.log('[CXDL] Fallback URL for',objectid);
        return r;
    }

    // ====== collectIds ======
    function collectIds(){
        var ids=[];
        document.querySelectorAll('.ans-attach-ct,.ans-cc').forEach(function(c){
            c.querySelectorAll('iframe').forEach(function(f){
                var o=f.getAttribute('objectid');
                if(o&&o.length>=8){
                    var fn=guessFilename(c)||guessFilename(f)||null;
                    ids.push({id:o,name:fn,container:c,iframe:f});
                }
            });
        });
        document.querySelectorAll('[objectid]').forEach(function(el){
            var o=el.getAttribute('objectid');
            if(o&&o.length>=8){
                var existing=false;
                for(var i=0;i<ids.length;i++){if(ids[i].id===o){existing=true;break;}}
                if(!existing){
                    var fn=guessFilename(el)||null;
                    ids.push({id:o,name:fn,container:el,iframe:el});
                }
            }
        });
        document.querySelectorAll('[data-objectid]').forEach(function(el){
            var o=el.getAttribute('data-objectid');
            if(o&&o.length>=8){
                var ex=false;
                for(var i=0;i<ids.length;i++){if(ids[i].id===o){ex=true;break;}}
                if(!ex)ids.push({id:o,name:guessFilename(el)});
            }
        });
        document.querySelectorAll('[onclick]').forEach(function(el){
            var oc=el.getAttribute('onclick')||'';
            var m=oc.match(/objectid['"]?\s*[:=]\s*["']?([a-fA-F0-9]{10,})/i);
            if(m){
                var oid=m[1],ex=false;
                for(var i=0;i<ids.length;i++){if(ids[i].id===oid){ex=true;break;}}
                if(!ex)ids.push({id:oid,name:guessFilename(el)});
            }
        });
        document.querySelectorAll('a[href]').forEach(function(el){
            var h=el.getAttribute('href')||'';
            var m=h.match(/objectid['"]?\s*[:=/]\s*["']?([a-fA-F0-9]{10,})/i)||h.match(/\/ananas\/status\/([a-fA-F0-9]{10,})/i);
            if(m){
                var mid=m[m.length>2?2:1],ex=false;
                for(var i=0;i<ids.length;i++){if(ids[i].id===mid){ex=true;break;}}
                if(!ex)ids.push({id:mid,name:(el.textContent||'').trim().substring(0,100)||null});
            }
        });
        return ids;
    }

    // ====== UNIFIED DOWNLOAD: respects user's mode choice ======
    // GM_download: uses Tampermonkey's native download, filename from Content-Disposition or fallback
    // Browser blob: GM_xmlhttpRequest with blob, then blob URL trigger

    var _gmDownloadAvailable = typeof GM_download === 'function';

    function dlFile(url,fname,showProg){
        if(!url){toast('No URL for: '+fname,4000,true);return;}
        // Force HTTPS on download URLs to avoid Mixed Content
        if (url && url.indexOf('http://') === 0) {
            url = 'https:' + url.substring(5);
            console.log('[CXDL] Upgraded URL to HTTPS');
        }

        if(_dlMode==='gm' && _gmDownloadAvailable){
            // Use GM_download (Tampermonkey native download)
            if(showProg)toast('<b>'+fname+'</b> (GM mode)',0);
            GM_download({
                url:url,
                name:fname,
                headers:{'Referer':location.href,'Origin':location.origin},
                onload:function(){toast(fname+' OK',3000,false,true);},
                onerror:function(d){toast('GM ERR: '+(d&&d.error||'failed'),4000,true);},
                ontimeout:function(){toast('GM TIMEOUT: '+fname,4000,true);}
            });
        }else{
            // Use GM_xmlhttpRequest blob -> blob URL trigger
            if(showProg)toast('<b>'+fname+'</b><progress value="0" max="100" style="width:200px;vertical-align:middle">',0);
            GM_xmlhttpRequest({
                method:'GET', url:url, responseType:'blob', timeout:90000,
                headers:{'Referer':location.href,'Origin':location.origin,'Accept':'*/*'},
                onprogress:function(e){
                    if(showProg&&e.total){var p=document.querySelector('.cxdl-toast progress');if(p)p.value=Math.round(e.loaded/e.total*100);}
                },
                onload:function(resp){
                    if(resp.status!==200||!resp.response||resp.response.size<512){
                        toast('ERR '+resp.status+' ('+fname+')',4000,true);
                        return;
                    }
                    // Try to get real filename from blob/CD header
                    var realName=fname;
                    if(resp.finalUrl){
                        // Try to get from finalUrl query param (some servers redirect with filename)
                        var fu=new URL(resp.finalUrl);
                        var fnParam=fu.searchParams.get('filename')||fu.searchParams.get('file')||fu.searchParams.get('attname')||'';
                        if(fnParam)realName=cleanName(decodeURIComponent(fnParam));
                    }
                    // Fallback: use URL segment as hint
                    if(realName===fname||!realName){
                        var segs=resp.finalUrl||url;
                        var sm=segs.match(/\/([^\/]+\.(pptx?|docx?|pdf|xlsx?|mp4))[^\/]*$/i);
                        if(sm)realName=cleanName(sm[1]);
                    }
                    doTrigger(URL.createObjectURL(resp.response),realName);
                    toast((realName!==fname?'['+fname+'] ':'')+realName+' OK',3000,false,true);
                },
                onerror:function(){toast('NET ERR ('+fname+')',4000,true);},
                ontimeout:function(){toast('TIMEOUT ('+fname+')',4000,true);}
            });
        }
    }

    function doTrigger(blobUrl,fname){
        var a=document.createElement('a');
        a.style.display='none';a.href=blobUrl;a.download=fname;
        document.body.appendChild(a);a.click();document.body.removeChild(a);
        setTimeout(function(){URL.revokeObjectURL(blobUrl);},5000);
    }

    // ====== TOGGLE DOWNLOAD MODE ======
    var _modeBtnEl = null;
    function toggleDlMode(){
        _dlMode = _dlMode==='gm' ? 'browser' : 'gm';
        try{localStorage.setItem('cxdl_dlMode',_dlMode);}catch(e){}
        if(_modeBtnEl){
            _modeBtnEl.textContent = _dlMode==='gm' ? '[GM]' : '[BRW]';
            _modeBtnEl.className = 'cxdl-btn mode-btn' + (_dlMode==='browser'?' active':'');
            _modeBtnEl.title = _dlMode==='gm' ? 'Current: GM Download (Tampermonkey native)' : 'Current: Browser Download (GM_xmlhttpRequest + blob)';
        }
        toast('Download mode: ' + (_dlMode==='gm'?'GM (Tampermonkey native)':'Browser (blob URL)'),3000);
    }

    // ====== MODAL ======
    async function showModal(filterType){
        var rawIds=collectIds();
        if(rawIds.length===0){toast('No resource IDs found. Go to Materials tab.',4000,true);return;}

        setStatus('Fetching ('+rawIds.length+')...');
        toast('Fetching info...',0);

        var metas=[];
        var okCnt=0, failCnt=0;
        for(var i=0;i<rawIds.length;i++){
            var entry=rawIds[i];
            var m=await fetchMeta(entry.id,entry.name);
            if(m.url&&(!m.err||m.err==='fallback_url')){
                metas.push(m);
                okCnt++;
            }else{
                failCnt++;
            }
            setStatus('Fetching...'+Math.round((i+1)/rawIds.length*100)+'% ('+okCnt+' ok, '+failCnt+' fail)');
            await delay(120);
        }
        toast('');
        if(metas.length===0){toast('All API requests failed. Try clicking individual DL buttons.',8000,true);return;}

        var list=metas;
        if(filterType){
            list=metas.filter(function(mm){return mm.type===filterType;});
            if(list.length===0){toast('No '+filterType+' files found.',3000);return;}
        }

        var bg=document.createElement('div');bg.className='cxdl-modal-bg';
        bg.onclick=function(e){if(e.target===bg)bg.remove();};
        var box=document.createElement('div');box.className='cxdl-modal';

        var hd=document.createElement('div');hd.className='cxdl-modal-hd';
        hd.innerHTML='<span>Select Resources ('+list.length+')</span>'
            +'<span style="font-size:20px;cursor:pointer;color:#999;font-weight:normal" onclick="this.parentElement.parentElement.parentElement.remove()">x</span>';

        var bd=document.createElement('div');bd.className='cxdl-modal-bd';var ul=document.createElement('div');

        list.forEach(function(m,idx){
            var row=document.createElement('div');row.className='cxdl-modal-row';
            var cb=document.createElement('input');cb.type='checkbox';cb.checked=!filterType;cb.dataset.idx=idx;
            var nm=document.createElement('span');nm.className='cxdl-modal-name';nm.textContent=m.fname;nm.title=m.fname;
            var tg=document.createElement('span');tg.className='cxdl-modal-tag';tg.textContent=m.type+(m.err?' [FB]':'');
            row.appendChild(cb);row.appendChild(nm);row.appendChild(tg);
            row.onclick=function(e){if(e.target.tagName!=='INPUT')cb.checked=!cb.checked;};
            ul.appendChild(row);
        });bd.appendChild(ul);

        var act=document.createElement('div');act.className='cxdl-modal-actions';

        var bA=document.createElement('button');bA.style.background='#607d8b';bA.textContent='Toggle All';
        bA.onclick=function(){var cbs=ul.querySelectorAll('input[type=checkbox]');var allOn=Array.from(cbs).every(function(c){return c.checked;});cbs.forEach(function(c){c.checked=!allOn;});};

        var bC=document.createElement('button');bC.style.background='#9e9e9e';bC.textContent='Cancel';bC.onclick=function(){bg.remove();};

        var bO=document.createElement('button');bO.style.background='#1976d2';bO.textContent='Download Selected ('+list.length+')';
        bO.onclick=function(){
            var sel=[];ul.querySelectorAll('input:checked').forEach(function(cb){var ix=parseInt(cb.dataset.idx);if(!isNaN(ix)&&list[ix])sel.push(list[ix]);});
            bg.remove();if(sel.length===0){alert('Select at least one item.');return;}
            batchDl(sel);
        };
        act.appendChild(bA);act.appendChild(bC);act.appendChild(bO);
        box.appendChild(hd);box.appendChild(bd);box.appendChild(act);bg.appendChild(box);document.body.appendChild(bg);
    }

    async function batchDl(resources){
        toast('Downloading '+resources.length+' files...',0);
        var ok=0;
        for(var i=0;i<resources.length;i++){
            var res=resources[i];
            if(res.err==='fallback_url'){
                window.open(res.url,'_blank');
                toast(res.fname+' opened in tab',2500);
                ok++;
            }else{
                dlFile(res.url,res.fname,false);
                ok++;
            }
            if((i+1)%3===0||i===resources.length-1)toast((i+1)+'/'+resources.length,300);
            await delay(600);
        }
        setTimeout(function(){toast('Done: '+ok+'/'+resources.length+' downloads triggered.',5000,false,true);},800);
    }

    async function dlAll(){
        var rawIds=collectIds();if(rawIds.length===0)return;
        toast('Fetching all...',0);var all=[];
        for(var i=0;i<rawIds.length;i++){
            var m=await fetchMeta(rawIds[i].id,rawIds[i].name);
            if(m.url&&(!m.err||m.err==='fallback_url'))all.push(m);
            setStatus(Math.round((i+1)/rawIds.length*100)+'%');await delay(120);
        }
        if(all.length===0){toast('Cannot get links. Try later.',4000,true);return;}batchDl(all);
    }

    // ====== INLINE BUTTONS ======
    function injectBtns(){
        var containers=document.querySelectorAll('.ans-attach-ct,.ans-cc');
        if(containers.length>0){
            for(var ci=0;ci<containers.length;ci++){
                var cont=containers[ci];
                if(cont.querySelector('.cxdl-injbtn'))continue;
                var parentRow=cont.closest('li,tr,div[class*=item],div[class*=file],div[class*=row]');
                if(!parentRow||parentRow.querySelector('.cxdl-injbtn'))continue;

                var iframes=cont.querySelectorAll('iframe[objectid]');var firstId=null;
                for(var ii=0;ii<iframes.length;ii++){
                    var oid=iframes[ii].getAttribute('objectid');if(oid&&oid.length>=8){firstId=oid;break;}
                }
                if(!firstId)continue;

                var wrap=document.createElement('span');wrap.className='cxdl-injbtn-wrap';
                var btn=document.createElement('button');btn.className='cxdl-injbtn';btn.textContent='DL';
                var fHintName=guessFilename(cont);
                (function(id,b,hint){
                    b.onclick=function(ev){
                        ev.stopPropagation();ev.preventDefault();
                        b.textContent='...';b.style.background='#999';
                        (async function(){
                            var m=await fetchMeta(id,hint);
                            if(!m.url){b.textContent='FAIL';b.style.background='#f44336';toast('Fail:'+m.fname,3500,true);}
                            else if(m.err==='fallback_url'){
                                b.textContent='TAB';b.style.background='#ff9800';
                                window.open(m.url,'_blank');
                                setTimeout(function(){b.textContent='DL';b.style.background='#1976d2';},5000);
                            }
                            else{b.textContent='OK';b.style.background='#4caf50';dlFile(m.url,m.fname,true);setTimeout(function(){b.textContent='DL';b.style.background='#1976d2';},4000);}
                        })();
                    };
                })(firstId,btn,fHintName);
                wrap.appendChild(btn);
                parentRow.appendChild(wrap);
            }
        }else{
            document.querySelectorAll('li,tr,div[class*=file]').forEach(function(row){
                if(row.querySelector('.cxdl-injbtn'))return;
                var txt=(row.textContent||'').trim();
                if(/\.(pptx?|docx?|xlsx?|pdf|mp4)$/i.test(txt)){
                    var lIds=collectIds();if(lIds.length>0){
                        var wrap=document.createElement('span');wrap.className='cxdl-injbtn-wrap';
                        var btn=document.createElement('button');btn.className='cxdl-injbtn';btn.textContent='DL';
                        btn.onclick=function(ev){ev.stopPropagation();var i2=collectIds();if(i2.length>0)(async function(){
                            btn.textContent='...';var m=await fetchMeta(i2[0].id,i2[0].name);
                            if(!m.url){btn.textContent='X';btn.style.background='#f44336';}
                            else if(m.err==='fallback_url'){
                                btn.textContent='TAB';window.open(m.url,'_blank');
                                setTimeout(function(){btn.textContent='DL';btn.style.background='#1976d2';},5000);
                            }
                            else{btn.textContent='OK';btn.style.background='#4caf50';dlFile(m.url,m.fname,true);setTimeout(function(){btn.textContent='DL';btn.style.background='#1976d2';},4000);}
                        })();};
                        wrap.appendChild(btn);row.appendChild(wrap);
                    }
                }
            });
        }
    }

    // ====== BUILD TOOLBAR (singleton) ======
    var _barInstance = null;  // track our single toolbar instance
    function buildBar(){
        if (_isDuplicateRun) {
            _barInstance = document.getElementById(OUR_BAR_ID);
            if (_barInstance) { setTimeout(doScan, 500); return; }
        }
        _barInstance = document.getElementById(OUR_BAR_ID);
        if (_barInstance) { setTimeout(doScan, 500); return; }

        // Clean up any remaining old toolbars (including foreign scripts)
        nukeForeignToolbars();
        try { document.querySelectorAll('.cxdl-bar').forEach(function(el){el.remove();}); } catch(e){}

        var bar=document.createElement('div');
        bar.id=OUR_BAR_ID;
        bar.className='cxdl-bar';
        bar.setAttribute('data-cxdl-version', '2.1.4');
        bar.innerHTML='<span class="title">[CXDL]</span><span id="_cxdl_st2" class="status">Loading...</span>';

        function mkBtn(label,cls,hnd){
            var b=document.createElement('button');b.className='cxdl-btn'+(cls?' '+cls:'');b.textContent=label;b.addEventListener('click',hnd);return b;
        }
        bar.appendChild(mkBtn('Scan','',doScan));
        bar.appendChild(mkBtn('Select DL','pri',function(){showModal(null);}));
        bar.appendChild(mkBtn('PPT','warn',function(){showModal('PPT');}));
        bar.appendChild(mkBtn('PDF','info',function(){showModal('PDF');}));
        bar.appendChild(mkBtn('DOC','',function(){showModal('DOC');}));
        bar.appendChild(mkBtn('All DL','pri',dlAll));

        _modeBtnEl=document.createElement('button');
        _modeBtnEl.className='cxdl-btn mode-btn'+(_dlMode==='browser'?' active':'');
        _modeBtnEl.textContent=_dlMode==='gm'?'[GM]':'[BRW]';
        _modeBtnEl.title=_dlMode==='gm'?'GM Download (Tampermonkey native) - click to switch':'Browser Download (blob URL) - click to switch';
        _modeBtnEl.addEventListener('click',toggleDlMode);
        bar.appendChild(_modeBtnEl);

        if(document.body){
            if(document.body.firstChild)document.body.insertBefore(bar,document.body.firstChild);
            else document.body.appendChild(bar);
        }else{
            document.addEventListener('DOMContentLoaded',function(){document.body.appendChild(bar);});
        }
        _barInstance = bar;

        // Float button (singleton check by unique ID)
        if(!document.getElementById(OUR_FLOAT_ID)){
            var fb=document.createElement('button');
            fb.id=OUR_FLOAT_ID;
            fb.className='cxdl-float';fb.textContent='v2';fb.title='Toggle';
            fb.addEventListener('click',function(){
                var b=document.getElementById(OUR_BAR_ID);
                if(b)b.style.display=b.style.display==='none'?'block':'none';
                else doScan();
            });
            document.body.appendChild(fb);
        }
        setStatus('Waiting...');
        setTimeout(doScan,2500);
    }

    // ====== MutationObserver + Interval Cleanup ======
    var _obs = null;
    try { _obs = new MutationObserver(killDupes); } catch(e) {}
    function killDupes() {
        try {
            nukeForeignToolbars(); // always clean foreign first
            var bars = document.querySelectorAll('.cxdl-bar');
            if (bars.length > 1) {
                var kept = null;
                for (var bi = 0; bi < bars.length; bi++) {
                    if (bars[bi].id === OUR_BAR_ID) { kept = bars[bi]; break; }
                }
                if (!kept) kept = bars[bars.length - 1];
                for (var bj = 0; bj < bars.length; bj++) {
                    if (bars[bj] !== kept) bars[bj].remove();
                }
            }
            var floats = document.querySelectorAll('.cxdl-float');
            if (floats.length > 1) {
                var fkept = null;
                for (var fi = 0; fi < floats.length; fi++) {
                    if (floats[fi].id === OUR_FLOAT_ID) { fkept = floats[fi]; break; }
                }
                if (!fkept) fkept = floats[floats.length - 1];
                for (var fj = 0; fj < floats.length; fj++) {
                    if (floats[fj] !== fkept) floats[fj].remove();
                }
            }
        } catch(e){}
    }

    // Periodic cleanup every 2 seconds
    setInterval(function() { killDupes(); nukeForeignToolbars(); }, 2000);

    function doScan(){
        killDupes();
        var ids=collectIds();unsafeWindow._cxdl_ids=ids.map(function(x){return x.id;});injectBtns();
        setStatus(ids.length?(ids.length+' resources | click buttons to DL'):'No IDs - go to Materials tab & click Scan');
        console.log('[CXDL] v2.1.4 scan:',ids.length);
    }

    // ====== ENTRY ======
    if(isTargetPage()){
        buildBar();
        try{_obs.observe(document.body,{childList:true,subtree:true});}catch(e){}
    }
    console.log('[CXDL] v2.1.4 loaded | GM_download available:',_gmDownloadAvailable,'| mode:',_dlMode);
})();
