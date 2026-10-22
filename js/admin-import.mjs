import { renderCase, validatePost, sourceId } from './case-layout.mjs';

window.openBlogImport = function(){
  if(document.getElementById('blog-import-dialog'))return;
  const dialog=document.createElement('dialog');dialog.id='blog-import-dialog';dialog.className='blog-import-dialog';
  dialog.innerHTML='<form method="dialog"><button class="ax-btn" id="import-close">닫기</button></form><h2>네이버 글 일괄 가져오기</h2><p>한국어 글로 등록하고 원문 카테고리와 게시일을 유지합니다. 이미지는 사이트 저장소로 옮기고, 같은 원문은 중복 등록하지 않습니다.</p><label class="import-file">이전 자료 선택 <input id="import-file" type="file" accept=".json,application/json"></label><p id="import-summary" role="status"></p><progress id="import-progress" max="1" value="0"></progress><p id="import-status" role="status" aria-live="polite"></p><div class="import-actions"><button class="ax-btn pri" id="import-run" disabled>일괄 등록 시작</button><button class="ax-btn" id="import-stop" disabled>현재 글 처리 후 중지</button><button class="ax-btn" id="import-retry" hidden>실패 자료 내려받기</button></div><details><summary>상세페이지 디자인 미리보기</summary><iframe id="import-preview" title="상세페이지 미리보기" sandbox></iframe></details>';
  document.body.appendChild(dialog);dialog.showModal();
  let posts=[],failed=[],running=false,stop=false,sourceImages={},files=[],totalPosts=0;
  dialog.querySelector('#import-file').multiple=true;
  const $=id=>dialog.querySelector('#'+id),status=$('import-status');
  dialog.addEventListener('close',()=>{if(!running)dialog.remove();});
  dialog.addEventListener('cancel',e=>{if(running)e.preventDefault();});
  $('import-file').addEventListener('change',async e=>{
    try{
      files=Array.from(e.target.files);const file=files[0];if(!file)return;if(files.some(f=>f.size>40*1024*1024))throw Error('각각 40MB 이하의 JSON 파일을 선택하세요.');
      const data=JSON.parse(await file.text());posts=Array.isArray(data)?data:data.posts;sourceImages=data.images||{};
      if(!Array.isArray(posts)||!posts.length)throw Error('등록할 글이 없습니다.');
      posts.forEach(validatePost);
      totalPosts=files.length>1?Number(data.totalPosts)||posts.length:posts.length;
      $('import-summary').textContent=totalPosts.toLocaleString()+'개 글 · 자료 '+files.length+'개 · 한국어 · 원문 카테고리별 분류';
      const sample={...posts[0],blocks:posts[0].blocks.filter(b=>b.type!=='image')};
      $('import-preview').srcdoc='<link rel="stylesheet" href="'+location.origin+'/css/case-detail.css"><style>body{margin:0;font-family:sans-serif}</style>'+renderCase(sample);
      $('import-run').disabled=false;status.textContent='준비되었습니다. 이미지 이전에 시간이 걸릴 수 있습니다.';
    }catch(e){posts=[];$('import-run').disabled=true;status.textContent=e.message;}
  });
  $('import-stop').addEventListener('click',()=>{stop=true;status.textContent='진행 중인 글을 마무리한 뒤 멈춥니다. 같은 파일로 다시 시작하면 완료한 글은 건너뜁니다.';});
  $('import-run').addEventListener('click',async()=>{
    if(running||!posts.length)return;running=true;stop=false;failed=[];
    const stats={created:0,updated:0,skipped:0,error:0};let cursor=0,done=0,lastFailure='';
    status.textContent='원본 이미지와 글을 등록하고 있습니다.';
    $('import-run').disabled=true;$('import-stop').disabled=false;$('import-close').disabled=true;$('import-file').disabled=true;$('import-retry').hidden=true;
    $('import-progress').max=totalPosts;
    const auth={}; // HttpOnly session cookie is sent by the same-origin fetch.
    const requestImport=async payload=>{
      const body=JSON.stringify({...auth,...payload});
      for(let attempt=0;attempt<5;attempt++){
        let response;
        try{response=await fetch('/api/blog-import',{method:'POST',headers:{'content-type':'application/json'},body});}
        catch(e){if(attempt===4)throw Error('네트워크 연결 오류: '+e.message);status.textContent='연결 복구를 기다린 뒤 재시도합니다. '+(attempt+1)+'/5';await new Promise(r=>setTimeout(r,3000*2**attempt));continue;}
        const data=await response.json().catch(()=>({}));
        if(response.ok)return data;
        if((response.status===429||response.status>=500)&&attempt<4){status.textContent='HTTP '+response.status+' · 서버 응답을 기다린 뒤 재시도합니다. '+(attempt+1)+'/5';await new Promise(r=>setTimeout(r,3000*2**attempt));continue;}
        if([401,403,404,405,503].includes(response.status))stop=true;
        throw Error((data.error||'서버 응답을 확인하세요.')+' (HTTP '+response.status+')');
      }
    };
    const imageCache=new Map();
    let existingSources=new Set();
    try{const existing=await requestImport({action:'existing'});existingSources=new Set(existing.sourceUrls||[]);}
    catch(e){stop=true;lastFailure=e.message;status.textContent=e.message;}
    const progress=()=>{
      done++;$('import-progress').value=done;
      $('import-summary').textContent=done+' / '+totalPosts+' · 신규 '+stats.created+' · 갱신 '+stats.updated+' · 중복 '+stats.skipped+' · 실패 '+stats.error;
    };
    const worker=async()=>{
      while(!stop&&cursor<posts.length){const post=posts[cursor++];
        try{
          if(existingSources.has('https://blog.naver.com/lawsqare/'+sourceId(post.sourceUrl))){stats.skipped++;progress();continue;}
          const copy={...post,blocks:post.blocks.map(b=>({...b}))};
          const images=[...new Set(copy.blocks.filter(b=>b.type==='image').map(b=>b.url))];
          const missing=images.filter(url=>!imageCache.has(url));
          const imageBatchSize=missing.some(url=>sourceImages[url])?1:3;
          for(let i=0;i<missing.length;i+=imageBatchSize){
            const migrated=await requestImport({action:'images',images:missing.slice(i,i+imageBatchSize).map(original=>sourceImages[original]?{original,dataUrl:sourceImages[original]}:original)});
            if(!Array.isArray(migrated.images))throw Error('이미지 이전 결과를 확인하지 못했습니다.');
            for(const image of migrated.images){if(image.error||!image.url)throw Error(image.error||'이미지 이전 실패');imageCache.set(image.original,image.url);}
          }
          for(const block of copy.blocks)if(block.type==='image')block.url=imageCache.get(block.url);
          const data=await requestImport({posts:[copy]});
          const result=data.results?.[0];if(!result||result.status==='error')throw Error(result?.error||'저장 결과를 확인하지 못했습니다.');
          stats[result.status]++;
        }catch(e){stats.error++;failed.push(post);lastFailure=e.message;status.textContent=e.message;}
        progress();
      }
    };
    let batchIndex=-1;
    try{
      for(let i=0;i<files.length&&!stop;i++){
        batchIndex=i;
        const next=JSON.parse(await files[i].text());posts=Array.isArray(next)?next:next.posts;sourceImages=next.images||{};
        posts.forEach(validatePost);cursor=0;
        await Promise.all([worker(),worker(),worker()]);
      }
    }catch(e){stop=true;lastFailure=e.message;status.textContent=e.message;}
    running=false;$('import-run').disabled=false;$('import-stop').disabled=true;$('import-close').disabled=false;$('import-file').disabled=false;
    if(stop&&batchIndex>=0&&cursor<posts.length)failed.push(...posts.slice(cursor));
    if(stop)for(let i=batchIndex+1;i<files.length;i++){const next=JSON.parse(await files[i].text());failed.push(...(Array.isArray(next)?next:next.posts));}
    $('import-retry').hidden=!failed.length;
    status.textContent=stop?'중지되었습니다. '+lastFailure+' 같은 자료 파일로 다시 시작하면 완료한 글은 건너뜁니다.':failed.length?'등록이 끝났습니다. '+lastFailure+' 실패한 글은 원본 자료를 다시 선택해 재시도할 수 있습니다.':'전체 등록이 완료되었습니다. 관리자 목록을 새로고침해 확인하세요.';
  });
  $('import-retry').addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,blogId:'lawsqare',lang:'ko',posts:failed},null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='naver-import-retry.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
};
