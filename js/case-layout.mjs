export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function sourceId(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'blog.naver.com') throw new Error('네이버 원문 주소를 확인하세요.');
  const id = /^\/lawsqare\/(\d+)$/.exec(url.pathname)?.[1] || (url.pathname === '/PostView.naver' && url.searchParams.get('blogId') === 'lawsqare' ? url.searchParams.get('logNo') : null);
  if (!/^\d{8,16}$/.test(id || '')) throw new Error('lawsqare 블로그 원문만 가져올 수 있습니다.');
  return id;
}

export function validatePost(post) {
  if (!post || typeof post !== 'object') throw new Error('글 형식이 올바르지 않습니다.');
  sourceId(post.sourceUrl);
  if (typeof post.title !== 'string' || !post.title.trim() || post.title.length > 160) throw new Error('글 제목을 확인하세요.');
  if (!Array.isArray(post.blocks) || !post.blocks.length || post.blocks.length > 2000) throw new Error('본문을 확인하세요.');
  for (const block of post.blocks) {
    if (!['paragraph','heading','image','link'].includes(block.type)) throw new Error('지원하지 않는 본문 항목입니다.');
    if (['paragraph','heading'].includes(block.type) && (typeof block.text !== 'string' || block.text.length > 100000)) throw new Error('본문 문구를 확인하세요.');
    if (block.type === 'image' && typeof block.url !== 'string') throw new Error('이미지 주소를 확인하세요.');
    if (block.type === 'link' && (!/^https:\/\//.test(block.url || '') || typeof block.text !== 'string')) throw new Error('원문 링크를 확인하세요.');
  }
}

export function renderCase(post) {
  validatePost(post);
  const e = escapeHtml, id = sourceId(post.sourceUrl);
  const blocks = post.blocks.filter(b => b.type !== 'paragraph' || b.text.trim());
  const sections = []; let group = { title:'법률 쟁점 살펴보기', blocks:[] };
  for (const block of blocks) {
    const isHeading = block.type === 'heading' || (block.type === 'paragraph' && block.text.length < 75 && /^(?:\d+\s*[.)]|결\s*론$|해외 송금 시 유의해야 할 점$)/.test(block.text));
    if (isHeading) { if (group.blocks.length) sections.push(group); group = {title:block.text,blocks:[]}; }
    else group.blocks.push(block);
  }
  if (group.blocks.length) sections.push(group);
  const content = sections.map((section,i) => '<section class="case-chapter '+(i%2 ? 'case-chapter--blue' : '')+'">'
    +'<div class="case-chapter-head"><span class="case-number">'+String(i+1).padStart(2,'0')+'</span><h3>'+e(section.title)+'</h3></div>'
    +'<div class="case-copy">'+section.blocks.map(block => {
      if (block.type === 'image') {
        if (!/^(?:\/img\/|\/imports\/media\/|https:\/\/globallaw\.co\.kr\/img\/)/.test(block.url)) throw new Error('이미지 파일을 사이트 저장소로 먼저 옮겨 주세요.');
        return '<figure class="case-figure"><img src="'+e(block.url)+'" alt="'+e(block.alt || '')+'" loading="lazy"></figure>';
      }
      if (block.type === 'link') return '<p><a href="'+e(block.url)+'" target="_blank" rel="noopener noreferrer">'+e(block.text)+'</a></p>';
      return '<p>'+e(block.text).replace(/\n/g,'<br>')+'</p>';
    }).join('')+'</div></section>').join('');
  return '<div class="case-detail" data-naver-source="'+id+'">'
    +'<header class="case-hero"><div class="case-wordmark"><span class="case-brand-symbol">G</span> GLOBAL LAW OFFICE</div>'
    +'<span class="case-category">'+e(post.cat || '법률정보')+'</span><h2>'+e(post.title)+'</h2>'
    +'<div class="case-hero-line"></div><p class="case-hero-caption">글로벌 법률사무소의 법률 이야기</p>'
    +'<p class="case-date">원문 게시일 '+e(post.publishedAt || '원문 참조')+'</p>'
    +'<div class="case-orbit" aria-hidden="true"><span>§</span></div></header>'
    +'<div class="case-intro"><span>LEGAL INSIGHT</span><h3>복잡한 법률 이야기,<br>차근차근 살펴봅니다.</h3><p>원문의 법률 정보와 사례를 분야별로 정리했습니다.</p></div>'
    +content+'<footer class="case-source"><span>GLOBAL LAW OFFICE</span><h3>글로벌 법률사무소</h3><p>이 글은 네이버 블로그의 원문을 옮긴 자료입니다.<br>법령·판례 설명은 원문 게시일을 기준으로 읽어 주세요.</p>'
    +'<a href="https://blog.naver.com/lawsqare/'+id+'" target="_blank" rel="noopener noreferrer">네이버 블로그 원문 보기 ↗</a></footer></div>';
}
