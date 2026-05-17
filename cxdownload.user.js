// ==UserScript==
// @name         超星学习通课程资源直链下载
// @namespace    https://github.com/fwzm/ChaoXingDownload
// @version      2.0.0
// @description  超星学习通课程资源直链下载（支持新版mooc2-ans页面）
// @author       fwzm (Original by ColdThunder11, inspired by RytterMohn/chaoxingDownload)
// @match        *://*.chaoxing.com/*
// @match        *://*.edu.cn/*
// @match        *://*.xueyinonline.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @license      GPL-3.0
// @supportURL   https://github.com/fwzm/ChaoXingDownload/issues
// @connect      ananas.chaoxing.com
// @connect      mooc1.chaoxing.com
// @connect      mooc1-api.chaoxing.com
// @connect      mooc2-ans.chaoxing.com
// @connect      xueyinonline.com
// ==/UserScript==

(function() {
    'use strict';

    // ===== 防重复加载 =====
    if (unsafeWindow._cxdl_v2) { console.log('[CXDL] v2 already loaded'); return; }
    unsafeWindow._cxdl_v2 = true;

    // 如果旧版残留，清理
    var oldBar = document.getElementById('_cxdl_tb');
    if (oldBar) oldBar.remove();
    var oldFb = document.getElementById('_cxdl_fb');
    if (oldFb) oldFb.remove();

    console.log('[CXDL] v2.0.0 starting', location.href);

    // ===== 样式 =====
    GM_addStyle([
        '.cxdl-bar{position:fixed;top:0;left:0;right:0;z-index:2147483647;background:linear-gradient(135deg,#1565c0,#0d47a1);color:#fff;padding:8px 16px;display:flex;align-items:center;gap:8px;font-size:13px;box-shadow:0 2px 12px rgba(0,0,0,0.25)}',
        '.cxdl-bar-title{font-weight:bold;font-size:14px}',
        '.cxdl-bar-status{color:rgba(255,255,255,0.8);margin-left:auto;margin-right:4px;font-size:12px}',
        '.cxdl-btn{padding:5px 12px;border:1px solid rgba(255,255,255,0.4);border-radius:14px;background:transparent;color:#fff;font-size:12px;cursor:pointer;white-space:nowrap}',
        '.cxdl-btn:hover{background:rgba(255,255,255,0.15)}',
        '.cxdl-btn--ok{background:rgba(76,175,80,0.85);border-color:transparent}',
        '.cxdl-btn--ok:hover{background:rgba(76,175,80,1)}',
        '.cxdl-float{position:fixed;bottom:20px;right:20px;z-index:2147483646;width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#ff6f00,#e65100);color:#fff;font-size:18px;border:none;box-shadow:0 3px 10px rgba(0,0,0,0.3);cursor:pointer}',
        '.cxdl-toast{position:fixed;top:55px;right:16px;background:#fff;padding:10px 16px;border-radius:8px;font-size:13px;color:#333;border:1px solid #e0e0e0;box-shadow:0 4px 20px rgba(0,0,0,0.12);max-width:420px;z-index:2147483647;transition:opacity .2s}',
        '.cxdl-modal-bg{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:2147483647;display:flex;justify-content:center;align-items:center}',
        '.cxdl-modal{background:#fff;border-radius:12px;padding:20px;max-width:640px;max-height:75vh;display:flex;flex-direction:column;min-width:400px;width:92%;box-shadow:0 8px 40px rgba(0,0,0,0.2)}',
        '.cxdl-m-title{font-size:16px;font-weight:bold;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center}',
        '.cxdl-m-body{overflow-y:auto;flex:1;margin-bottom:14px}',
        '.cxdl-m-row{display:flex;align-items:center;padding:7px 6px;border-bottom:1px solid #f5f5f5;gap:8px}',
        '.cxdl-m-row:hover{background:#f9f9f9}',
        '.cxdl-m-cb{flex-shrink:0}',
        '.cxdl-m-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:#333;cursor:pointer}',
        '.cxdl-m-tag{font-size:11px;color:#888;background:#f0f0f0;padding:2px 7px;border-radius:3px;flex-shrink:0}',
        '.cxdl-m-actions{display:flex;justify-content:flex-end;gap:8px}',
        '.cxdl-m-actbtn{padding:6px 16px;border:none;border-radius:6px;color:#fff;font-size:13px;cursor:pointer}',
        '.cxdl-inj-btn{display:inline-flex;padding:3px 10px;margin-left:6px;background:#2196f3;color:#fff;border:none;border-radius:12px;font-size:11px;cursor:pointer;vertical-align:middle}',
        '.cxdl-inj-btn:hover{background:#1976d2}'
    ].join(''));

    // ===== 工具函数 =====
    function cleanName(n) {
        return (n||'').replace(/[\/\\?%*:|"<>\x00-\x1f]/g,'_').trim().substring(0,120);
    }

    function delay(ms) { return new Promise(function(r){setTimeout(r,ms);}); }

    function isStuPage() {
        return /\/mycourse\/stu|coursedata|studentstudy/.test(location.href);
    }

    // ===== Toast =====
    var _toastTimer=null;
    function toast(msg,dur,err,ok){
        var el=document.querySelector('.cxdl-toast');
        if(!el){el=document.createElement('div');el.className='cxdl-toast';document.body.appendChild(el);}
        clearTimeout(_toastTimer);
        el.innerHTML=(ok?'&#10003; ':(err?'&#10007; ':''))+msg;
        el.style.opacity=1;
        if(dur>0)_toastTimer=setTimeout(function(){el.style.opacity=0;},dur);
    }

    // ===== 状态栏文字更新 =====
    function setStatus(msg){
        var el=document.getElementById('_cxdl_st');
        if(el)el.textContent=msg;
    }

    // ===== 全局状态 =====
    unsafeWindow._cxdl_resources=[];

    // ========== 核心：GM_xmlhttpRequest 封装 ==========
    function gmFetch(url){
        return new Promise(function(resolve){
            GM_xmlhttpRequest({
                method:'GET',url:url,
                onload:function(resp){
                    try{resolve(JSON.parse(resp.responseText));}catch(e){resolve(null);}
                },
                onerror:function(){resolve(null);},
                ontimeout:function(){resolve(null);}
            });
        });
    }

    // ========== 核心：从 ananas status API 获取下载信息 ==========
    async function fetchMeta(objectid){
        var proto=location.protocol;
        var isXy=/xueyinonline/.test(location.host);
        var domain=isXy?'xueyinonline':'chaoxing';
        var url=proto+'//mooc1.'+domain+'.com/ananas/status/'+objectid+'?flag=normal';
        var j=await gmFetch(url);
        if(!j)return{err:'no_response',fname:'r_'+objectid,url:null,type:'?'};

        var fname=j.filename||('r_'+objectid);
        var res={objectid:objectid,fname:cleanName(fname),url:null,type:'?',raw:j};

        if(j.pdf){res.type='PDF';res.url=j.pdf;}
        else if(j.http&&(/mp4/i.test(j.http)||(j.mimetype||'').indexOf('video')!==-1)){res.type='VIDEO';res.url=j.http;}
        else if(j.download){
            res.url=j.download.indexOf('http')===0?j.download:proto+'//'+j.download;
            var ext=fname.split('.').pop()||'';
            if(/^pptx?$/i.test(ext))res.type='PPT';
            else if(/^docx?$/i.test(ext))res.type='DOC';
            else if(/^xlsx?$/i.test(ext))res.type='XLS';
            else if(/^pdf$/i.test(ext))res.type='PDF';
            else res.type='FILE';
        }else if(j.http){res.type='OTHER';res.url=j.http;}

        if(!res.url)res.err='no_url';
        return res;
    }

    // ========== 核心：收集 objectid ==========
    function collectObjectIds(){
        var ids=new Set();

        // 方法1: ans-attach-ct / ans-cc 容器内的 iframe[objectid] （新版 stu 页面主要方式）
        var containers=document.querySelectorAll('.ans-attach-ct,.ans-cc');
        for(var ci=0;ci<containers.length;ci++){
            var iframes=containers[ci].querySelectorAll('iframe');
            for(var ii=0;ii<iframes.length;ii++){
                var oid=iframes[ii].getAttribute('objectid');
                if(oid&&oid.length>=8)ids.add(oid);
            }
        }

        // 方法2: 直接查找所有带 objectid 属性的元素
        document.querySelectorAll('[objectid]').forEach(function(el){
            var oid=el.getAttribute('objectid');
            if(oid&&oid.length>=8)ids.add(oid);
        });

        // 方法3: data-objectid 属性
        document.querySelectorAll('[data-objectid]').forEach(function(el){
            var oid=el.getAttribute('data-objectid');
            if(oid&&oid.length>=8)ids.add(oid);
        });

        // 方法4: onclick 中提取 objectid
        document.querySelectorAll('[onclick]').forEach(function(el){
            var oc=el.getAttribute('onclick')||'';
            var m=oc.match(/objectid['":\s]*['":\s]*['"]?([a-fA-F0-9]{10,})/i);
            if(m)ids.add(m[1]);
        });

        // 方法5: 所有 iframe 的 objectid
        document.querySelectorAll('iframe').forEach(function(el){
            var oid=el.getAttribute('objectid');
            if(oid&&oid.length>=8)ids.add(oid);
        });

        // 方法6: 链接 href 中提取
        document.querySelectorAll('a[href]').forEach(function(el){
            var href=el.getAttribute('href')||'';
            var m=href.match(/objectid['":\s]*['":\s]*['"]?([a-fA-F0-9]{10,})/i)
              ||href.match(/\/ananas\/status\/([a-fA-F0-9]{10,})/i);
            if(m)ids.add(m[1]);
        });

        return Array.from(ids);
    }

    // ========== 下载函数 ==========
    function downloadFile(url,fname,showProgress){
        if(showProgress)toast('<b>'+fname+'</b><progress value=0 max=100 style="width:200px;vertical-align:middle">',0);

        // 先尝试 XHR
        var x=new XMLHttpRequest();
        x.open('GET',url,true);
        x.responseType='blob';
        if(showProgress)x.onprogress=function(e){if(e.total){var b=document.querySelector('.cxdl-toast progress');if(b)b.value=Math.round(e.loaded/e.total*100);}};
        x.onload=function(){
            if(this.status===200){
                var f=fname;
                if(this.response.type==='application/pdf'&&f.toLowerCase().indexOf('.pdf')===-1)f=f.replace(/\.[^.]+$/,'')+'.pdf';
                triggerDownload(URL.createObjectURL(this.response),f);
                toast(f+' OK',3000,false,true);
            }else{
                downloadGM(url,fname,showProgress);
            }
        };
        x.onerror=function(){downloadGM(url,fname,showProgress);};
        x.send();
    }

    function downloadGM(url,fname,showProg){
        if(showProg)toast('<b>'+fname+'</b><progress value=0 max=100 style="width:200px">',0);
        GM_xmlhttpRequest({
            method:'GET',url:url,responseType:'blob',
            onprogress:function(e){if(showProg&&e.total){var b=document.querySelector('.cxdl-toast progress');if(b)b.value=Math.round(e.loaded/e.total*100);}},
            onload:function(resp){
                if(resp.status!==200){toast('ERR '+resp.status,4000,true);return;}
                var f=fname;
                if(resp.response.type==='application/pdf'&&f.toLowerCase().indexOf('.pdf')===-1)f=f.replace(/\.[^.]+$/,'')+'.pdf';
                triggerDownload(URL.createObjectURL(resp.response),f);
                toast(f+' OK',3000,false,true);
            },
            onerror:function(){toast('NET ERR',4000,true);}
        });
    }

    function triggerDownload(blobUrl,fname){
        var a=document.createElement('a');
        a.style.display='none';a.href=blobUrl;a.download=fname;
        document.body.appendChild(a);a.click();
        document.body.removeChild(a);
        setTimeout(function(){URL.revokeObjectURL(blobUrl);},5000);
    }

    // ========== 弹出资源选择框 ==========
    async function showResourceModal(preFilterType){
        var ids=collectObjectIds();
        if(ids.length===0){toast('未找到任何资源ID，请确认页面已加载完资料列表',4000,true);return;}

        setStatus('获取资源信息('+ids.length+')...');
        toast('正在获取'+ids.length+'个资源的下载信息...',0);

        var metas=[];
        for(var i=0;i<ids.length;i++){
            var m=await fetchMeta(ids[i]);
            m.elementId=ids[i];
            if(!m.err&&m.url)metas.push(m);
            await delay(80);
        }
        toast('');

        if(metas.length===0){toast('无法获取任何下载链接（可能未登录或资源不可用）',5000,true);return;}

        // 过滤
        var showList=metas;
        if(preFilterType){
            showList=metas.filter(function(m){return m.type===preFilterType;});
            if(showList.length===0){toast('没有找到'+preFilterType+'类型的文件',3000);return;}
        }

        // 创建弹窗
        var bg=document.createElement('div');
        bg.className='cxdl-modal-bg';
        bg.onclick=function(e){if(e.target===bg)bg.remove();};

        var box=document.createElement('div');
        box.className='cxdl-modal';

        var title=document.createElement('div');
        title.className='cxdl-m-title';
        title.innerHTML='<span>选择要下载的资源 ('+showList.length+' 个)</span>'
            +'<span style="font-size:20px;cursor:pointer;font-weight:normal;color:#999" onclick="this.closest(\'.cxdl-modal-bg\').remove()">&times;</span>';

        var body=document.createElement('div');
        body.className='cxdl-m-body';

        var list=document.createElement('div');

        showList.forEach(function(m,idx){
            var row=document.createElement('div');
            row.className='cxdl-m-row';

            var cb=document.createElement('input');
            cb.type='checkbox';cb.checked=!preFilterType;cb.className='cxdl-m-cb';
            cb.dataset.idx=idx;

            var nameEl=document.createElement('span');
            nameEl.className='cxdl-m-name';nameEl.textContent=m.fname;nameEl.title=m.fname;

            var tag=document.createElement('span');
            tag.className='cxdl-m-tag';tag.textContent=m.type;

            row.appendChild(cb);row.appendChild(nameEl);row.appendChild(tag);
            row.onclick=function(e){if(e.target.tagName!=='INPUT')cb.checked=!cb.checked;};
            list.appendChild(row);
        });

        body.appendChild(list);

        var actions=document.createElement('div');
        actions.className='cxdl-m-actions';

        var selAllBtn=document.createElement('button');
        selAllBtn.className='cxdl-m-actbtn';selAllBtn.style.background='#78909c';
        selAllBtn.textContent='全选/反选';
        selAllBtn.onclick=function(){
            var cbs=list.querySelectorAll('input[type=checkbox]');
            var allChecked=Array.from(cbs).every(function(c){return c.checked;});
            cbs.forEach(function(c){c.checked=!allChecked;});
        };

        var cancelBtn=document.createElement('button');
        cancelBtn.className='cxdl-m-actbtn';cancelBtn.style.background='#9e9e9e';
        cancelBtn.textContent='取消';
        cancelBtn.onclick=function(){bg.remove();};

        var okBtn=document.createElement('button');
        okBtn.className='cxdl-m-actbtn';okBtn.style.background='#1976d2';
        okBtn.textContent='下载所选 ('+showList.length+')';
        okBtn.onclick=function(){
            var selected=[];
            list.querySelectorAll('input:checked').forEach(function(cb){
                var idx=parseInt(cb.dataset.idx);
                if(!isNaN(idx)&&showList[idx])selected.push(showList[idx]);
            });
            bg.remove();
            if(selected.length===0){alert('请至少选择一个资源');return;}
            doBatchDownload(selected);
        };

        actions.appendChild(selAllBtn);
        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);

        box.appendChild(title);box.appendChild(body);box.appendChild(actions);
        bg.appendChild(box);
        document.body.appendChild(bg);
    }

    // ========== 批量下载 ==========
    async function doBatchDownload(resources){
        toast('开始下载 '+resources.length+' 个文件...',0);
        for(var i=0;i<resources.length;i++){
            downloadFile(resources[i].url,resources[i].fname,false);
            if((i+1)%3===0||i===resources.length-1)toast((i+1)+'/'+resources.length,300);
            await delay(500);
        }
        setTimeout(function(){toast('完成: 已触发 '+resources.length+' 个文件下载',5000,false,true);},800);
    }

    async function downloadAllPdf(){
        var ids=collectObjectIds();
        if(ids.length===0){toast('未找到资源ID',4000,true);return;}
        toast('查找PDF...',0);
        var pdfs=[];
        for(var i=0;i<ids.length;i++){
            var m=await fetchMeta(ids[i]);
            if((m.type==='PDF'||m.fname.toLowerCase().indexOf('.pdf')!==-1)&&!m.err&&m.url)pdfs.push(m);
            await delay(100);
        }
        if(pdfs.length===0){toast('没有PDF文件',3000);return;}
        toast('下载 '+pdfs.length+' 个PDF...',0);
        for(var j=0;j<pdfs.length;j++){downloadFile(pdfs[j].url,pdfs[j].fname,false);await delay(350);}
        setTimeout(function(){toast('完成: '+pdfs.length+' PDF',5000,false,true);},600);
    }

    // ========== 注入内联下载按钮到每个资源 ==========
    async function injectInlineButtons(){
        var ids=collectObjectIds();
        if(ids.length===0)return;

        var containers=document.querySelectorAll('.ans-attach-ct,.ans-cc');
        if(containers.length===0){
            // 尝试在包含文件名的行上注入
            var fileRows=document.querySelectorAll('li, tr[class*=file], div[class*=file], [class*=item]');
            fileRows.forEach(function(row){
                if(row.querySelector('.cxdl-inj-btn'))return;
                var txt=(row.textContent||'').trim();
                if(/\.(pptx?|docx?|xlsx?|pdf|mp4)$/i.test(txt)){
                    var btn=document.createElement('button');
                    btn.className='cxdl-inj-btn';btn.innerHTML='\u21E9 \u4E0B\u8F7D';
                    btn.onclick=function(ev){
                        ev.stopPropagation();
                        var ids2=collectObjectIds();
                        if(ids2.length>0)(async function(){
                            var m=await fetchMeta(ids2[0]);btn.innerHTML='\u83B7\u53D6...';
                            if(m.err||!m.url){btn.innerHTML='\u5931\u8D25';btn.style.background='#f44336';}
                            else{downloadFile(m.url,m.fname,true);btn.innerHTML='OK';btn.style.background='#4caf50';}
                        })();
                    };
                    row.style.position='relative';
                    row.appendChild(btn);
                }
            });
            return;
        }

        for(var ci=0;ci<containers.length;ci++){
            if(containers[ci].querySelector('.cxdl-inj-btn'))continue;
            var iframes=containers[ci].querySelectorAll('iframe[objectid]');
            for(var ii=0;ii<iframes.length;ii++){
                var oid=iframes[ii].getAttribute('objectid');
                if(!oid||oid.length<8)continue;
                var btn=document.createElement('button');
                btn.className='cxdl-inj-btn';btn.innerHTML='\u21E9 \u4E0B\u8F7D';
                (function(id){
                    btn.onclick=function(ev){
                        ev.stopPropagation();ev.preventDefault();
                        btn.innerHTML='\u83B7\u53D6...';btn.style.background='#999';
                        (async function(){
                            var m=await fetchMeta(id);
                            if(m.err||!m.url){btn.innerHTML='\u5931\u8D25';btn.style.background='#f44336';toast('\u65E0\u6CD5\u4E0B\u8F7D: '+m.fname,3000,true);}
                            else{
                                btn.innerHTML='OK';btn.style.background='#4caf50';
                                downloadFile(m.url,m.fname,true);
                                setTimeout(function(){btn.innerHTML='\u21E9 \u518D\u4E0B';btn.style.background='#2196f3';},4000);
                            }
                        })();
                    };
                })(oid);
                // 插入按钮
                if(containers[ci].lastChild){containers[ci].appendChild(document.createTextNode(' '));containers[ci].appendChild(btn);}
                else containers[ci].appendChild(btn);
            }
        }
    }

    // ========== 初始化工具栏 ==========
    function initUI(){
        // 检查是否已有工具栏（双重保险）
        if(document.getElementById('_cxdl_bar_v2'))return;

        var bar=document.createElement('div');
        bar.id='_cxdl_bar_v2';
        bar.className='cxdl-bar';

        var titleSpan=document.createElement('span');
        titleSpan.className='cxdl-bar-title';
        titleSpan.innerHTML='\uD83D\uDCE5 \u8D44\u6E90\u4E0B\u8F7D v2';

        var st=document.createElement('span');
        st.id='_cxdl_st';
        st.className='cxdl-bar-status';
        st.textContent='\u51C6\u5907...';

        function mkBtn(text,isOk,handler){
            var b=document.createElement('button');
            b.className='cxdl-btn'+(isOk?' cxdl-btn--ok':'');
            b.innerHTML=text;
            b.addEventListener('click',handler);
            return b;
        }

        bar.appendChild(titleSpan);
        bar.appendChild(st);
        bar.appendChild(mkBtn('\uD83D\uDD0D \u626B\u63CF',false,onScan));
        bar.appendChild(mkBtn('\uD83DuDCC1 \u9009\u62E9\u4E0B\u8F7D',true,function(){showResourceModal(null);}));
        bar.appendChild(mkBtn('\uD83D\uDCC4 \Д╩┘PDF',true,function(){showResourceModal('PDF');}));
        bar.appendChild(mkBtn('\uD83D\uDCE5 \u5168\u90E8PDF',true,downloadAllPdf));

        // 插入DOM
        if(document.body){
            if(document.body.firstChild)document.body.insertBefore(bar,document.body.firstChild);
            else document.body.appendChild(bar);
        }else{
            document.addEventListener('DOMContentLoaded',function(){document.body.appendChild(bar);});
        }

        // 浮动按钮
        var fb=document.createElement('button');
        fb.className='cxdl-float';fb.innerHTML='\uD83DuDCE5';fb.title='\u8D44\u6E90\u4E0B\u8F7D';
        fb.addEventListener('click',function(){
            var b=document.getElementById('_cxdl_bar_v2');
            if(b)b.style.display=b.style.display==='none'?'flex':'none';
            else onScan();
        });
        document.body.appendChild(fb);

        // 自动扫描
        setStatus('等待页面加载...');
        setTimeout(onScan,2000);
    }

    // ========== 扫描操作 ==========
    function onScan(){
        var ids=collectObjectIds();
        unsafeWindow._cxdl_resources=ids;

        injectInlineButtons();

        if(ids.length===0){
            setStatus('未找到资源 (确认已在「资料」标签页)');
        }else{
            setStatus('找到 '+ids.length+' 个资源，可点击按钮下载');
        }

        console.log('[CXDL] scan done, found:',ids.length,'ids:',ids);
    }

    // ========== 入口 ==========
    if(isStuPage()){
        initUI();
    }

    console.log('[CXDL] v2.0.0 loaded');
})();
