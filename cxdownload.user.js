// ==UserScript==
// @name         学习通课程资源下载器
// @name:en      ChaoXing Course Downloader
// @namespace    https://github.com/fwzm/ChaoXingDownload
// @version      2.1.9
// @description  下载学习通课程资源文件，支持 PPT/PDF/DOC/视频等资料
// @description:en Download course resources from ChaoXing (mooc2-ans) - PPT/PDF/DOC/Video
// @author       fwzm
// @match        *://*.chaoxing.com/*
// @match        *://*.edu.cn/*
// @match        *://*.xueyinonline.com/*
// @updateURL    https://raw.githubusercontent.com/fwzm/ChaoXingDownload/master/cxdownload.user.js
// @downloadURL  https://raw.githubusercontent.com/fwzm/ChaoXingDownload/master/cxdownload.user.js
// @supportURL   https://github.com/fwzm/ChaoXingDownload/issues
// @run-at       document-start
// @grant        GM_addStyle
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @license      GPL-3.0
// @connect      chaoxing.com
// @connect      *.chaoxing.com
// @connect      xueyinonline.com
// @connect      *.xueyinonline.com
// @connect      edu.cn
// @connect      *.edu.cn
// @connect      ananas.chaoxing.com
// @connect      mooc1.chaoxing.com
// @connect      mooc1-api.chaoxing.com
// @connect      mooc2-ans.chaoxing.com
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
    var IS_TOP_WINDOW = true;
    try { IS_TOP_WINDOW = window.self === window.top; } catch(e) { IS_TOP_WINDOW = false; }
    var OUR_BAR_ID = '__cxdl_bar_unique_v219';
    var OUR_FLOAT_ID = '__cxdl_float_unique_v219';
    var CXDL_MSG_TYPE = 'CXDL_RESOURCE_IDS_V219';
    var _frameKey = 'cxdl_' + Date.now() + '_' + Math.random().toString(16).slice(2);
    var _apiIds = [];
    var _frameIds = {};

    // Layer 1: Global flag
    if (unsafeWindow.__cxdl_v214) { _isDuplicateRun = true; }
    unsafeWindow.__cxdl_v219 = true;
    unsafeWindow.__cxdl_v218 = true;
    unsafeWindow.__cxdl_v217 = true;
    unsafeWindow.__cxdl_v216 = true;
    unsafeWindow.__cxdl_v215 = true;
    unsafeWindow.__cxdl_v214 = true;
    unsafeWindow.__cxdl_v213 = true; unsafeWindow.__cxdl_v212 = true; unsafeWindow.__cxdl_v211 = true;
    unsafeWindow.__cxdl_v210 = true; unsafeWindow._cxdl_v209 = true; unsafeWindow._cxdl_v208 = true;

    // Layer 2: DOM marker
    try { document.documentElement.setAttribute('data-cxdl-active', 'v2.1.9'); } catch(e) {}

    // ====== STRATEGY A: CSS Nuclear Hiding ======
    // This hides ANY fixed/sticky element in the top 80px of the viewport,
    // then explicitly shows only OUR toolbar via ID-specific override.
    // This works even for Shadow DOM elements (if they inherit styles from light DOM).
    GM_addStyle([
        /* Hide ALL fixed/sticky bars at the top of the page */
        '[data-cxdl-nuke] { display: none !important; visibility: hidden !important; pointer-events: none !important; height: 0 !important; overflow: hidden !important; }',
        '#_cxdl_bar,#_cxdl_bar2,#_cxdl_bar_v2,#_cxdl_tb,#__cxdl_bar_unique_v210,#__cxdl_bar_unique_v211,#__cxdl_bar_unique_v212,#__cxdl_bar_unique_v213,#__cxdl_bar_unique_v214,#__cxdl_bar_unique_v215,#__cxdl_bar_unique_v216,#__cxdl_bar_unique_v217,#__cxdl_bar_unique_v218{display:none!important;visibility:hidden!important;pointer-events:none!important;height:0!important;overflow:hidden!important}',
        '#_cxdl_fb,#_cxdl_float,#__cxdl_float_unique_v210,#__cxdl_float_unique_v211,#__cxdl_float_unique_v212,#__cxdl_float_unique_v213,#__cxdl_float_unique_v214,#__cxdl_float_unique_v215,#__cxdl_float_unique_v216,#__cxdl_float_unique_v217,#__cxdl_float_unique_v218{display:none!important;visibility:hidden!important;pointer-events:none!important}',
        '.kcdl-bar,.kcdl-float,.kcdl-panel,.kcdl-wrap,[id*="kcdl"],[class*="kcdl"]{display:none!important;visibility:hidden!important;pointer-events:none!important}',
        /* Our own bar - always visible */
        '#' + OUR_BAR_ID + ' { display: flex !important; visibility: visible !important; pointer-events: auto !important; height: auto !important; }',
        '#' + OUR_FLOAT_ID + ' { display: block !important; visibility: visible !important; pointer-events: auto !important; }'
    ].join(''));

    // ====== STRATEGY B: JS Multi-Method Removal ======
    function nukeForeignToolbars() {
        if (!IS_TOP_WINDOW) return;
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
            ['#_cxdl_bar', '#_cxdl_bar2', '#_cxdl_tb', '#_cxdl_fb', '#_cxdl_float', '#_kcdl_bar',
             '#__cxdl_bar_unique_v210', '#__cxdl_bar_unique_v211', '#__cxdl_bar_unique_v212',
             '#__cxdl_bar_unique_v213', '#__cxdl_bar_unique_v214', '#__cxdl_bar_unique_v215',
             '#__cxdl_bar_unique_v216', '#__cxdl_bar_unique_v217', '#__cxdl_bar_unique_v218',
             '#__cxdl_float_unique_v210', '#__cxdl_float_unique_v211', '#__cxdl_float_unique_v212',
             '#__cxdl_float_unique_v213', '#__cxdl_float_unique_v214', '#__cxdl_float_unique_v215',
             '#__cxdl_float_unique_v216', '#__cxdl_float_unique_v217', '#__cxdl_float_unique_v218',
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
        if (!IS_TOP_WINDOW) return;
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

    console.log('[CXDL] v2.1.9 starting' + (_isDuplicateRun ? ' [dup]' : ''), location.href, '| target:', isTargetPage(), '| top:', IS_TOP_WINDOW);

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
        '.cxdl-panel{position:fixed;right:16px;bottom:62px;z-index:2147483647;width:260px;background:#fff;color:#222;border:1px solid #ddd;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,0.22);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:10px}',
        '.cxdl-panel-hd{display:flex;align-items:center;justify-content:space-between;font-size:13px;font-weight:bold;margin-bottom:8px}',
        '.cxdl-panel-close{border:none;background:transparent;color:#777;font-size:18px;line-height:1;cursor:pointer;padding:0 2px}',
        '.cxdl-panel-status{font-size:12px;color:#555;margin-bottom:10px;line-height:1.5}',
        '.cxdl-panel-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
        '.cxdl-panel-actions button{border:none;border-radius:6px;background:#1976d2;color:#fff;font-size:12px;line-height:1.4;padding:6px 8px;cursor:pointer;font-family:inherit}',
        '.cxdl-panel-actions button:hover{background:#1565c0}',
        '.cxdl-panel-actions button.warn{background:#e65100}',
        '.cxdl-panel-actions button.gray{background:#607d8b}',
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
    function withBody(cb) {
        if (document.body) cb();
        else document.addEventListener('DOMContentLoaded', function(){ if (document.body) cb(); }, { once:true });
    }

    var _toastTmr = null;
    function toast(msg,dur,isErr,isOk){
        var el = document.querySelector('.cxdl-toast');
        if(!el){el=document.createElement('div');el.className='cxdl-toast';document.body.appendChild(el);}
        clearTimeout(_toastTmr);
        el.innerHTML=(isOk?'完成：':(isErr?'错误：':''))+msg;
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

    function isValidObjectId(id) {
        return !!(id && /^[a-fA-F0-9]{8,}$/.test(String(id).trim()));
    }

    function inferType(name) {
        var ext=(name||'').split('.').pop().toLowerCase();
        if(/^pdf$/.test(ext))return 'PDF';
        if(/^pptx?$/.test(ext))return 'PPT';
        if(/^docx?$/.test(ext))return 'DOC';
        if(/^xlsx?$/.test(ext))return 'XLS';
        if(/^(mp4|flv|avi|wmv|mp3)$/.test(ext))return 'VIDEO';
        if(/^(zip|rar|7z)$/.test(ext))return 'ARCHIVE';
        return '?';
    }

    function addIdEntry(list, entry) {
        if (!entry) return;
        var id = String(entry.id || entry.objectid || entry.objectId || entry.oid || '').trim();
        var m = id.match(/[a-fA-F0-9]{8,}/);
        if (!m) return;
        id = m[0];
        if (!isValidObjectId(id)) return;
        var name = entry.name || entry.filename || entry.fileName || entry.title || null;
        if (name) name = cleanName(String(name));
        for (var i=0;i<list.length;i++) {
            if (list[i].id === id) {
                if (!list[i].name && name) list[i].name = name;
                return;
            }
        }
        list.push({ id:id, name:name || null });
    }

    function mergeIds() {
        var out = [];
        for (var a=0;a<arguments.length;a++) {
            var arr = arguments[a] || [];
            for (var i=0;i<arr.length;i++) addIdEntry(out, arr[i]);
        }
        return out;
    }

    function postFrameIds(reason) {
        if (IS_TOP_WINDOW) return;
        try {
            var ids = collectLocalIds(document);
            window.top.postMessage({
                type: CXDL_MSG_TYPE,
                frameKey: _frameKey,
                href: location.href,
                reason: reason || 'scan',
                ids: ids.map(function(x){ return { id:x.id, name:x.name || null }; })
            }, '*');
        } catch(e) {}
    }

    function installFrameListener() {
        if (!IS_TOP_WINDOW) return;
        window.addEventListener('message', function(ev) {
            var data = ev && ev.data;
            if (!data || data.type !== CXDL_MSG_TYPE || !data.frameKey) return;
            var cleaned = [];
            (data.ids || []).forEach(function(x){ addIdEntry(cleaned, x); });
            _frameIds[data.frameKey] = cleaned;
            if (cleaned.length) {
                var total = collectIds().length;
                setStatus(total + ' 个资源 | 已合并框架资源');
                console.log('[CXDL] frame ids:', cleaned.length, data.href || '');
            }
        });
    }

    function addApiIds(entries, source) {
        var before = _apiIds.length;
        (entries || []).forEach(function(x){ addIdEntry(_apiIds, x); });
        if (_apiIds.length > before) {
            console.log('[CXDL] API cache +', (_apiIds.length - before), source || '');
            if (IS_TOP_WINDOW) {
                var total = collectIds().length;
                setStatus(total + ' 个资源 | 接口缓存已更新');
            } else {
                postFrameIds('api-cache');
            }
        }
    }

    function pickName(obj, fallback) {
        if (!obj || typeof obj !== 'object') return fallback || null;
        var keys = ['filename','fileName','name','title','attname','attName','showName','displayName','resourceName','objectName','documentName'];
        for (var i=0;i<keys.length;i++) {
            var v = obj[keys[i]];
            if (typeof v === 'string' && v.length > 0) return v;
        }
        return fallback || null;
    }

    function pickObjectId(obj) {
        if (!obj || typeof obj !== 'object') return null;
        var keys = ['objectid','objectId','object_id','objectIdStr','objectIdString','oid','fileId'];
        for (var i=0;i<keys.length;i++) {
            var v = obj[keys[i]];
            if (isValidObjectId(v)) return String(v);
        }
        return null;
    }

    function extractIdsFromString(str, out, hintName) {
        if (!str || typeof str !== 'string') return;
        var name = hintName;
        if (!name) {
            var nm = str.match(/([^\/"'<>?&=]+\.(pptx?|docx?|xlsx?|pdf|mp4|flv|avi|wmv|mp3|zip|rar|7z))\b/i);
            if (nm) name = nm[1];
        }
        var patterns = [
            /(?:objectid|objectId|object_id|oid)["'=:\s%]+([a-fA-F0-9]{8,})/g,
            /\/ananas\/(?:status|retreive|retrieve|portal\/fullscreen)\/([a-fA-F0-9]{8,})/g,
            /[?&](?:objectid|objectId|object_id|oid)=([a-fA-F0-9]{8,})/g
        ];
        patterns.forEach(function(re) {
            var m;
            while ((m = re.exec(str))) addIdEntry(out, { id:m[1], name:name });
        });
    }

    function extractIdsFromJson(root) {
        var found = [];
        var stack = [{ value:root, name:null }];
        var seen = 0;
        while (stack.length && seen < 6000) {
            seen++;
            var item = stack.pop();
            var val = item.value;
            if (typeof val === 'string') {
                extractIdsFromString(val, found, item.name);
                continue;
            }
            if (!val || typeof val !== 'object') continue;
            var name = pickName(val, item.name);
            var oid = pickObjectId(val);
            if (oid) addIdEntry(found, { id:oid, name:name });
            if (Array.isArray(val)) {
                for (var ai=0;ai<val.length;ai++) stack.push({ value:val[ai], name:name });
            } else {
                Object.keys(val).forEach(function(k) {
                    stack.push({ value:val[k], name:name });
                });
            }
        }
        return found;
    }

    function harvestApiText(text, source) {
        if (!text || typeof text !== 'string') return;
        if (!/(objectid|objectId|object_id|oid|ananas\/(?:status|retreive|retrieve|portal\/fullscreen))/i.test(text)) return;
        var found = [];
        try {
            var json = JSON.parse(text);
            found = extractIdsFromJson(json);
        } catch(e) {
            extractIdsFromString(text, found, null);
        }
        if (found.length) addApiIds(found, source);
    }

    function installApiInterceptors() {
        try {
            if (unsafeWindow.__cxdl_api_hook_v219) return;
            unsafeWindow.__cxdl_api_hook_v219 = true;

            var nativeFetch = unsafeWindow.fetch;
            if (typeof nativeFetch === 'function') {
                unsafeWindow.fetch = function() {
                    var args = arguments;
                    var reqUrl = '';
                    try { reqUrl = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || ''; } catch(e) {}
                    var p = nativeFetch.apply(this, args);
                    try {
                        p.then(function(resp) {
                            try {
                                var src = (resp && resp.url) || reqUrl || '';
                                if (!/chaoxing|xueyinonline|ananas|coursedata|resource|file/i.test(src)) return;
                                resp.clone().text().then(function(txt){ harvestApiText(txt, src); }).catch(function(){});
                            } catch(e2) {}
                        }).catch(function(){});
                    } catch(e3) {}
                    return p;
                };
            }

            var NativeXHR = unsafeWindow.XMLHttpRequest;
            if (typeof NativeXHR === 'function') {
                unsafeWindow.XMLHttpRequest = function() {
                    var xhr = new NativeXHR();
                    var reqUrl = '';
                    var open = xhr.open;
                    xhr.open = function(method, url) {
                        reqUrl = String(url || '');
                        return open.apply(xhr, arguments);
                    };
                    try {
                        xhr.addEventListener('load', function() {
                            try {
                                if (!/chaoxing|xueyinonline|ananas|coursedata|resource|file/i.test(reqUrl)) return;
                                if (typeof xhr.responseText === 'string') harvestApiText(xhr.responseText, reqUrl);
                            } catch(e4) {}
                        });
                    } catch(e5) {}
                    return xhr;
                };
            }
        } catch(err) {
            console.warn('[CXDL] API hook failed:', err);
        }
    }

    // ====== Get filename near a container element ======
    function guessFilename(container){
        var el=container;
        for(var up=0;up<5;up++){
            if(!el)break;
            var txt=(el.textContent||'').trim();
            var m=txt.match(/(.+?)\.(pptx?|docx?|xlsx?|pdf|mp4|flv|avi|wmv|mp3|zip|rar|7z)\b/i);
            if(m&&m[1].length<120)return m[0];
            el=el.parentElement;
        }
        var parent=container.parentElement;
        if(parent){
            var sib=parent.previousElementSibling;
            if(sib){
                var stxt=(sib.textContent||'').trim();
                var sm=stxt.match(/(.+?)\.(pptx?|docx?|xlsx?|pdf|mp4|flv|avi|wmv|mp3|zip|rar|7z)/i);
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
        var r={oid:objectid,fname:hintName||('资源_'+objectid),url:null,type:'?'};

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
    function collectLocalIds(doc){
        doc = doc || document;
        var ids=[];
        doc.querySelectorAll('.ans-attach-ct,.ans-cc').forEach(function(c){
            c.querySelectorAll('iframe').forEach(function(f){
                var o=f.getAttribute('objectid');
                if(o&&o.length>=8){
                    var fn=guessFilename(c)||guessFilename(f)||null;
                    ids.push({id:o,name:fn,container:c,iframe:f});
                }
            });
        });
        doc.querySelectorAll('[objectid]').forEach(function(el){
            var o=el.getAttribute('objectid');
            if(o&&o.length>=8){
                addIdEntry(ids, {id:o, name:guessFilename(el)||null});
            }
        });
        doc.querySelectorAll('[data-objectid]').forEach(function(el){
            var o=el.getAttribute('data-objectid');
            if(o&&o.length>=8) addIdEntry(ids, {id:o, name:guessFilename(el)});
        });
        doc.querySelectorAll('[onclick]').forEach(function(el){
            var oc=el.getAttribute('onclick')||'';
            var m=oc.match(/objectid['"]?\s*[:=]\s*["']?([a-fA-F0-9]{10,})/i);
            if(m){
                addIdEntry(ids, {id:m[1], name:guessFilename(el)});
            }
        });
        doc.querySelectorAll('a[href]').forEach(function(el){
            var h=el.getAttribute('href')||'';
            var m=h.match(/objectid['"]?\s*[:=/]\s*["']?([a-fA-F0-9]{10,})/i)||h.match(/\/ananas\/status\/([a-fA-F0-9]{10,})/i);
            if(m){
                var mid=m[m.length>2?2:1];
                addIdEntry(ids, {id:mid, name:(el.textContent||'').trim().substring(0,100)||null});
            }
        });
        return ids;
    }

    function collectSameOriginFrameIds(){
        var ids = [];
        if (!IS_TOP_WINDOW) return ids;
        try {
            document.querySelectorAll('iframe').forEach(function(fr) {
                try {
                    var doc = fr.contentDocument || (fr.contentWindow && fr.contentWindow.document);
                    if (!doc) return;
                    collectLocalIds(doc).forEach(function(x){ addIdEntry(ids, x); });
                } catch(e) {}
            });
        } catch(e2) {}
        return ids;
    }

    function collectIds(){
        var frameCache = [];
        Object.keys(_frameIds).forEach(function(k) {
            (_frameIds[k] || []).forEach(function(x){ addIdEntry(frameCache, x); });
        });
        return mergeIds(collectLocalIds(document), collectSameOriginFrameIds(), _apiIds, frameCache);
    }

    // ====== UNIFIED DOWNLOAD: respects user's mode choice ======
    // GM_download: uses Tampermonkey's native download, filename from Content-Disposition or fallback
    // Browser blob: GM_xmlhttpRequest with blob, then blob URL trigger

    var _gmDownloadAvailable = typeof GM_download === 'function';

    function dlFile(url,fname,showProg){
        if(!url){toast('没有下载链接：'+fname,4000,true);return;}
        // Force HTTPS on download URLs to avoid Mixed Content
        if (url && url.indexOf('http://') === 0) {
            url = 'https:' + url.substring(5);
            console.log('[CXDL] Upgraded URL to HTTPS');
        }

        if(_dlMode==='gm' && _gmDownloadAvailable){
            // Use GM_download (Tampermonkey native download)
            if(showProg)toast('<b>'+fname+'</b>（油猴下载）',0);
            GM_download({
                url:url,
                name:fname,
                headers:{'Referer':location.href,'Origin':location.origin},
                onload:function(){toast(fname+' 下载完成',3000,false,true);},
                onerror:function(d){toast('油猴下载失败：'+(d&&d.error||'未知错误'),4000,true);},
                ontimeout:function(){toast('油猴下载超时：'+fname,4000,true);}
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
                        toast('下载失败 '+resp.status+'（'+fname+'）',4000,true);
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
                    toast((realName!==fname?'['+fname+'] ':'')+realName+' 下载完成',3000,false,true);
                },
                onerror:function(){toast('网络错误（'+fname+'）',4000,true);},
                ontimeout:function(){toast('下载超时（'+fname+'）',4000,true);}
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
    function modeLabel() {
        return _dlMode === 'gm' ? '油猴下载' : '浏览器下载';
    }
    function modeButtonText() {
        return _dlMode === 'gm' ? '模式：油猴' : '模式：浏览器';
    }
    function updateModeButton() {
        var title = _dlMode==='gm' ? '当前：油猴原生下载，点击切换为浏览器下载' : '当前：浏览器下载，点击切换为油猴原生下载';
        if(_modeBtnEl){
            _modeBtnEl.textContent = modeButtonText();
            _modeBtnEl.className = 'cxdl-btn mode-btn' + (_dlMode==='browser'?' active':'');
            _modeBtnEl.title = title;
        }
        try {
            document.querySelectorAll('[data-cxdl-mode-btn]').forEach(function(btn){
                btn.textContent = modeButtonText();
                btn.title = title;
                if (btn.classList.contains('cxdl-btn')) {
                    btn.className = 'cxdl-btn mode-btn' + (_dlMode==='browser'?' active':'');
                }
            });
        } catch(e) {}
    }
    function toggleDlMode(){
        _dlMode = _dlMode==='gm' ? 'browser' : 'gm';
        try{localStorage.setItem('cxdl_dlMode',_dlMode);}catch(e){}
        updateModeButton();
        toast('下载模式：' + modeLabel(),3000);
    }

    // ====== MODAL ======
    async function showModal(filterType){
        var rawIds=collectIds();
        if(rawIds.length===0){toast('未找到资源 ID。请进入「资料」页后点「扫描」或「缓存扫描」。',5000,true);return;}

        setStatus('正在获取 '+rawIds.length+' 个资源...');
        toast('正在获取资源信息...',0);

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
            setStatus('获取中 '+Math.round((i+1)/rawIds.length*100)+'%（成功 '+okCnt+'，失败 '+failCnt+'）');
            await delay(120);
        }
        toast('');
        if(metas.length===0){toast('没有获取到下载链接，请刷新后重试，或尝试资源旁边的「下载」按钮。',8000,true);return;}

        var list=metas;
        if(filterType){
            list=metas.filter(function(mm){return mm.type===filterType;});
            if(list.length===0){toast('没有找到 '+filterType+' 文件。',3000);return;}
        }

        var bg=document.createElement('div');bg.className='cxdl-modal-bg';
        bg.onclick=function(e){if(e.target===bg)bg.remove();};
        var box=document.createElement('div');box.className='cxdl-modal';

        var hd=document.createElement('div');hd.className='cxdl-modal-hd';
        hd.innerHTML='<span>选择要下载的资源（'+list.length+' 个）</span>'
            +'<span style="font-size:20px;cursor:pointer;color:#999;font-weight:normal" onclick="this.parentElement.parentElement.parentElement.remove()">×</span>';

        var bd=document.createElement('div');bd.className='cxdl-modal-bd';var ul=document.createElement('div');

        list.forEach(function(m,idx){
            var row=document.createElement('div');row.className='cxdl-modal-row';
            var cb=document.createElement('input');cb.type='checkbox';cb.checked=!filterType;cb.dataset.idx=idx;
            var nm=document.createElement('span');nm.className='cxdl-modal-name';nm.textContent=m.fname;nm.title=m.fname;
            var tg=document.createElement('span');tg.className='cxdl-modal-tag';tg.textContent=m.type+(m.err?' 备用':'');
            row.appendChild(cb);row.appendChild(nm);row.appendChild(tg);
            row.onclick=function(e){if(e.target.tagName!=='INPUT')cb.checked=!cb.checked;};
            ul.appendChild(row);
        });bd.appendChild(ul);

        var act=document.createElement('div');act.className='cxdl-modal-actions';

        var bA=document.createElement('button');bA.style.background='#607d8b';bA.textContent='全选/反选';
        bA.onclick=function(){var cbs=ul.querySelectorAll('input[type=checkbox]');var allOn=Array.from(cbs).every(function(c){return c.checked;});cbs.forEach(function(c){c.checked=!allOn;});};

        var bC=document.createElement('button');bC.style.background='#9e9e9e';bC.textContent='取消';bC.onclick=function(){bg.remove();};

        var bO=document.createElement('button');bO.style.background='#1976d2';bO.textContent='下载所选（'+list.length+'）';
        bO.onclick=function(){
            var sel=[];ul.querySelectorAll('input:checked').forEach(function(cb){var ix=parseInt(cb.dataset.idx);if(!isNaN(ix)&&list[ix])sel.push(list[ix]);});
            bg.remove();if(sel.length===0){alert('请至少选择一个资源。');return;}
            batchDl(sel);
        };
        act.appendChild(bA);act.appendChild(bC);act.appendChild(bO);
        box.appendChild(hd);box.appendChild(bd);box.appendChild(act);bg.appendChild(box);document.body.appendChild(bg);
    }

    async function batchDl(resources){
        toast('开始下载 '+resources.length+' 个文件...',0);
        var ok=0;
        for(var i=0;i<resources.length;i++){
            var res=resources[i];
            if(res.err==='fallback_url'){
                window.open(res.url,'_blank');
                toast(res.fname+' 已在新标签页打开',2500);
                ok++;
            }else{
                dlFile(res.url,res.fname,false);
                ok++;
            }
            if((i+1)%3===0||i===resources.length-1)toast((i+1)+'/'+resources.length,300);
            await delay(600);
        }
        setTimeout(function(){toast('完成：已触发 '+ok+'/'+resources.length+' 个下载',5000,false,true);},800);
    }

    async function dlAll(){
        var rawIds=collectIds();if(rawIds.length===0){toast('未找到资源，请先进入「资料」页。',4000,true);return;}
        toast('正在获取全部资源...',0);var all=[];
        for(var i=0;i<rawIds.length;i++){
            var m=await fetchMeta(rawIds[i].id,rawIds[i].name);
            if(m.url&&(!m.err||m.err==='fallback_url'))all.push(m);
            setStatus(Math.round((i+1)/rawIds.length*100)+'%');await delay(120);
        }
        if(all.length===0){toast('无法获取下载链接，请稍后重试。',4000,true);return;}batchDl(all);
    }

    function scanPageCaches(){
        var found = [];
        try {
            document.querySelectorAll('script').forEach(function(s) {
                harvestApiText(s.textContent || '', 'inline-script');
            });
        } catch(e) {}
        try {
            for (var i=0;i<localStorage.length;i++) {
                var k = localStorage.key(i);
                if (!k || !/chaoxing|resource|course|file|attach|cxdl/i.test(k)) continue;
                harvestApiText(localStorage.getItem(k) || '', 'localStorage:' + k);
            }
        } catch(e2) {}
        found = collectIds();
        setStatus(found.length ? (found.length + ' 个资源 | 缓存扫描完成') : '未找到资源，请切到「资料」页');
        return found;
    }

    function updatePanelStatus(panel) {
        if (!panel) return;
        var ids = collectIds();
        var localCount = collectLocalIds(document).length;
        var apiCount = _apiIds.length;
        var frameCount = 0;
        Object.keys(_frameIds).forEach(function(k){ frameCount += (_frameIds[k] || []).length; });
        var st = panel.querySelector('.cxdl-panel-status');
        if (st) st.innerHTML = '<b>' + ids.length + '</b> 个资源<br>页面 ' + localCount + ' / 接口 ' + apiCount + ' / 框架 ' + frameCount;
    }

    var HELP_SEEN_KEY = 'cxdl_help_seen_v219';
    var PANEL_ID = '__cxdl_panel_v219';

    function showHelpModal(force) {
        if (!IS_TOP_WINDOW) return;
        try {
            if (!force && localStorage.getItem(HELP_SEEN_KEY) === '1') return;
            if (!force) localStorage.setItem(HELP_SEEN_KEY, '1');
        } catch(e) {}

        withBody(function(){
            var old = document.getElementById('__cxdl_help_v219');
            if (old) old.remove();

            var bg=document.createElement('div');
            bg.id='__cxdl_help_v219';
            bg.className='cxdl-modal-bg';
            bg.onclick=function(e){if(e.target===bg)bg.remove();};

            var box=document.createElement('div');
            box.className='cxdl-modal';

            var hd=document.createElement('div');
            hd.className='cxdl-modal-hd';
            hd.innerHTML='<span>学习通下载器使用说明</span><span style="font-size:20px;cursor:pointer;color:#999;font-weight:normal" onclick="this.parentElement.parentElement.parentElement.remove()">×</span>';

            var bd=document.createElement('div');
            bd.className='cxdl-modal-bd';
            bd.innerHTML=[
                '<div style="font-size:13px;line-height:1.8;color:#333">',
                '<p style="margin:0 0 8px">进入课程的「资料」页后，顶部蓝色工具栏会自动扫描资源。</p>',
                '<p style="margin:0 0 8px">如果显示未找到资源，先点「扫描」，仍没有就点右下角「下载」→「缓存扫描」。</p>',
                '<p style="margin:0 0 8px">点「资源列表」可以打开文件清单，勾选后点「下载所选」。文件名会尽量保留学习通原始名称。</p>',
                '<p style="margin:0 0 8px">「全部下载」会批量触发当前页面已识别资源；「PDF」只显示 PDF 文件。</p>',
                '<p style="margin:0">默认使用「油猴下载」。如果下载异常，可切换到「浏览器下载」再试。</p>',
                '</div>'
            ].join('');

            var act=document.createElement('div');
            act.className='cxdl-modal-actions';
            var ok=document.createElement('button');
            ok.style.background='#1976d2';
            ok.textContent='知道了';
            ok.onclick=function(){bg.remove();};
            act.appendChild(ok);

            box.appendChild(hd);box.appendChild(bd);box.appendChild(act);bg.appendChild(box);document.body.appendChild(bg);
        });
    }

    function closeFloatPanel() {
        var old = document.getElementById(PANEL_ID);
        if (old) old.remove();
    }

    function toggleFloatPanel() {
        var old = document.getElementById(PANEL_ID);
        if (old) { old.remove(); return; }
        var panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.className = 'cxdl-panel';
        panel.innerHTML = '<div class="cxdl-panel-hd"><span>学习通下载</span><button class="cxdl-panel-close" type="button">×</button></div>'
            + '<div class="cxdl-panel-status">正在扫描...</div>'
            + '<div class="cxdl-panel-actions"></div>';
        panel.querySelector('.cxdl-panel-close').onclick = closeFloatPanel;
        var acts = panel.querySelector('.cxdl-panel-actions');
        function pbtn(text, cls, handler) {
            var b = document.createElement('button');
            b.type = 'button';
            b.textContent = text;
            if (cls) b.className = cls;
            b.onclick = function(ev) {
                ev.preventDefault();
                ev.stopPropagation();
                handler();
                setTimeout(function(){ updatePanelStatus(panel); }, 80);
            };
            acts.appendChild(b);
            return b;
        }
        pbtn('扫描', 'gray', doScan);
        pbtn('资源列表', '', function(){ showModal(null); });
        pbtn('PDF', '', function(){ showModal('PDF'); });
        pbtn('全部下载', 'warn', dlAll);
        pbtn('缓存扫描', 'gray', function(){
            scanPageCaches();
            toast('缓存扫描完成', 2200, false, true);
        });
        pbtn('使用说明', 'gray', function(){ showHelpModal(true); });
        var panelModeBtn = pbtn(modeButtonText(), 'gray', toggleDlMode);
        panelModeBtn.setAttribute('data-cxdl-mode-btn', '1');
        panelModeBtn.title = _dlMode==='gm' ? '当前：油猴原生下载，点击切换为浏览器下载' : '当前：浏览器下载，点击切换为油猴原生下载';
        document.body.appendChild(panel);
        scanPageCaches();
        updatePanelStatus(panel);
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
                var btn=document.createElement('button');btn.className='cxdl-injbtn';btn.textContent='下载';
                var fHintName=guessFilename(cont);
                (function(id,b,hint){
                    b.onclick=function(ev){
                        ev.stopPropagation();ev.preventDefault();
                        b.textContent='获取中';b.style.background='#999';
                        (async function(){
                            var m=await fetchMeta(id,hint);
                            if(!m.url){b.textContent='失败';b.style.background='#f44336';toast('无法下载：'+m.fname,3500,true);}
                            else if(m.err==='fallback_url'){
                                b.textContent='打开';b.style.background='#ff9800';
                                window.open(m.url,'_blank');
                                setTimeout(function(){b.textContent='下载';b.style.background='#1976d2';},5000);
                            }
                            else{b.textContent='完成';b.style.background='#4caf50';dlFile(m.url,m.fname,true);setTimeout(function(){b.textContent='下载';b.style.background='#1976d2';},4000);}
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
                        var btn=document.createElement('button');btn.className='cxdl-injbtn';btn.textContent='下载';
                        btn.onclick=function(ev){ev.stopPropagation();var i2=collectIds();if(i2.length>0)(async function(){
                            btn.textContent='获取中';var m=await fetchMeta(i2[0].id,i2[0].name);
                            if(!m.url){btn.textContent='失败';btn.style.background='#f44336';}
                            else if(m.err==='fallback_url'){
                                btn.textContent='打开';window.open(m.url,'_blank');
                                setTimeout(function(){btn.textContent='下载';btn.style.background='#1976d2';},5000);
                            }
                            else{btn.textContent='完成';btn.style.background='#4caf50';dlFile(m.url,m.fname,true);setTimeout(function(){btn.textContent='下载';btn.style.background='#1976d2';},4000);}
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
        try {
            if (unsafeWindow.__cxdl_ui_lock_v219) {
                setTimeout(doScan, 600);
                return;
            }
            unsafeWindow.__cxdl_ui_lock_v219 = true;
        } catch(e) {}
        if (_isDuplicateRun) {
            _barInstance = document.getElementById(OUR_BAR_ID);
            if (_barInstance) { setTimeout(doScan, 500); return; }
        }
        _barInstance = document.getElementById(OUR_BAR_ID);
        if (_barInstance) { setTimeout(doScan, 500); return; }

        // Clean up any remaining old toolbars (including foreign scripts)
        nukeForeignToolbars();
        try { document.querySelectorAll('.cxdl-bar:not(#' + OUR_BAR_ID + '),#_cxdl_bar_v2,#_cxdl_bar,#_cxdl_bar2').forEach(function(el){el.remove();}); } catch(e){}

        var bar=document.createElement('div');
        bar.id=OUR_BAR_ID;
        bar.className='cxdl-bar';
        bar.setAttribute('data-cxdl-version', '2.1.9');
        bar.innerHTML='<span class="title">[学习通下载]</span><span id="_cxdl_st2" class="status">加载中...</span>';

        function mkBtn(label,cls,hnd){
            var b=document.createElement('button');b.className='cxdl-btn'+(cls?' '+cls:'');b.textContent=label;b.addEventListener('click',hnd);return b;
        }
        bar.appendChild(mkBtn('扫描','',doScan));
        bar.appendChild(mkBtn('资源列表','pri',function(){showModal(null);}));
        bar.appendChild(mkBtn('PPT','warn',function(){showModal('PPT');}));
        bar.appendChild(mkBtn('PDF','info',function(){showModal('PDF');}));
        bar.appendChild(mkBtn('DOC','',function(){showModal('DOC');}));
        bar.appendChild(mkBtn('全部下载','pri',dlAll));

        _modeBtnEl=document.createElement('button');
        _modeBtnEl.setAttribute('data-cxdl-mode-btn', '1');
        _modeBtnEl.className='cxdl-btn mode-btn'+(_dlMode==='browser'?' active':'');
        _modeBtnEl.addEventListener('click',toggleDlMode);
        updateModeButton();
        bar.appendChild(_modeBtnEl);

        withBody(function(){
            if(document.body.firstChild)document.body.insertBefore(bar,document.body.firstChild);
            else document.body.appendChild(bar);
        });
        _barInstance = bar;

        // CRITICAL: Force our bar to be visible (override any nuke CSS or other scripts)
        bar.style.cssText += ';display:flex!important;visibility:visible!important;position:fixed!important;top:0!important;left:0!important;z-index:2147483647!important;';
        console.log('[CXDL] Bar created and forced visible:', bar.id, 'size:', bar.getBoundingClientRect().width + 'x' + bar.getBoundingClientRect().height);

        // ====== innerHTML GUARD: protect against KCDL/other scripts overwriting our bar ======
        var _barTitleText = '[学习通下载]'; // what our title span should show
        function guardBarHTML() {
            try {
                var b = document.getElementById(OUR_BAR_ID);
                if (!b) return;
                // Check if title was hijacked (shows [KCDL] or other non-CXDL text)
                var titleSpan = b.querySelector('.title');
                if (titleSpan && titleSpan.textContent.indexOf('[学习通下载]') !== 0) {
                    console.log('[CXDL-GUARD] Title hijacked! Was:', titleSpan.textContent, '- restoring');
                    titleSpan.textContent = _barTitleText;
                }
                // Ensure all expected buttons exist
                if (!b.querySelector('.mode-btn')) {
                    // Re-add mode button if missing
                    var mb = document.createElement('button');
                    mb.setAttribute('data-cxdl-mode-btn', '1');
                    mb.className='cxdl-btn mode-btn'+(_dlMode==='browser'?' active':'');
                    mb.addEventListener('click',toggleDlMode);
                    b.appendChild(mb);
                    _modeBtnEl = mb;
                    updateModeButton();
                    console.log('[CXDL-GUARD] Restored mode button');
                }
            } catch(gerr) {}
        }
        // Guard immediately and periodically
        setTimeout(guardBarHTML, 1000);
        setInterval(guardBarHTML, 3000);

        // Float button (singleton check by unique ID)
        withBody(function(){
            if(!document.getElementById(OUR_FLOAT_ID)){
                var fb=document.createElement('button');
                fb.id=OUR_FLOAT_ID;
                fb.className='cxdl-float';fb.textContent='下载';fb.title='打开学习通下载面板';
                fb.addEventListener('click',function(){
                    toggleFloatPanel();
                });
                document.body.appendChild(fb);
            }
        });
        setStatus('等待页面加载...');
        setTimeout(doScan,2500);
    }

    // ====== MutationObserver + Interval Cleanup ======
    var _obs = null;
    try { _obs = new MutationObserver(killDupes); } catch(e) {}
    function killDupes() {
        try {
            nukeForeignToolbars(); // always clean foreign first
            document.querySelectorAll('#__cxdl_bar_unique_v210,#__cxdl_bar_unique_v211,#__cxdl_bar_unique_v212,#__cxdl_bar_unique_v213,#__cxdl_bar_unique_v214,#__cxdl_bar_unique_v215,#__cxdl_bar_unique_v216,#__cxdl_bar_unique_v217,#__cxdl_bar_unique_v218,#_cxdl_bar_v2,#_cxdl_bar,#_cxdl_bar2').forEach(function(el){
                if (el.id !== OUR_BAR_ID) el.remove();
            });
            document.querySelectorAll('#__cxdl_float_unique_v210,#__cxdl_float_unique_v211,#__cxdl_float_unique_v212,#__cxdl_float_unique_v213,#__cxdl_float_unique_v214,#__cxdl_float_unique_v215,#__cxdl_float_unique_v216,#__cxdl_float_unique_v217,#__cxdl_float_unique_v218,#_cxdl_fb,#_cxdl_float').forEach(function(el){
                if (el.id !== OUR_FLOAT_ID) el.remove();
            });
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
        setStatus(ids.length?(ids.length+' 个资源 | 可点「资源列表」下载'):'未找到资源，请进入「资料」页后点「扫描」');
        console.log('[CXDL] v2.1.9 scan:',ids.length);
    }

    // ====== ENTRY ======
    installApiInterceptors();
    installFrameListener();
    if (!IS_TOP_WINDOW) {
        if (isTargetPage()) {
            setTimeout(function(){ postFrameIds('frame-start'); }, 300);
            setTimeout(function(){ postFrameIds('frame-delay'); }, 1500);
            try {
                var frameObs = new MutationObserver(function(){ postFrameIds('frame-dom'); });
                if (document.body) frameObs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['objectid','data-objectid']});
                else document.addEventListener('DOMContentLoaded',function(){ frameObs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['objectid','data-objectid']}); });
            } catch(e) {}
        }
        console.log('[CXDL] v2.1.9 iframe worker loaded', location.href);
        return;
    }
    if(isTargetPage()){
        buildBar();
        withBody(function(){
            try{_obs.observe(document.body,{childList:true,subtree:true});}catch(e){}
        });
        setTimeout(function(){ showHelpModal(false); }, 1400);
    }
    console.log('[CXDL] v2.1.9 loaded | GM_download available:',_gmDownloadAvailable,'| mode:',_dlMode);
})();
