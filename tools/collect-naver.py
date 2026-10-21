"""Collect the owner's public Naver blog into a resumable Korean import bundle."""
import concurrent.futures as cf, html, json, pathlib, re, sys, time, urllib.parse, urllib.request, os
if os.environ.get('NAVER_IMPORT_PYTHON_PATH'):sys.path.insert(0,os.environ['NAVER_IMPORT_PYTHON_PATH'])
from bs4 import BeautifulSoup
ROOT=pathlib.Path(__file__).resolve().parents[1]; OUT=ROOT/'imports'; OUT.mkdir(exist_ok=True)
HEADERS={'User-Agent':'Mozilla/5.0','Referer':'https://blog.naver.com/lawsqare'}
def get(url):
 for attempt in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers=HEADERS),timeout=25) as r:return r.read().decode('utf-8')
  except Exception:
   if attempt==2:raise
   time.sleep(2+attempt*3)
def listing(page):
 text=get('https://blog.naver.com/PostTitleListAsync.naver?'+urllib.parse.urlencode({'blogId':'lawsqare','viewdate':'','currentPage':page,'categoryNo':0,'parentCategoryNo':0,'countPerPage':30}))
 # Naver's pagingHtml uses JavaScript escapes which are not valid JSON.
 data=json.loads(text.split(',"pagingHtml":')[0]+'}')
 return data['postList']
def article(item):
 ident=str(item['logNo']); url='https://blog.naver.com/lawsqare/'+ident
 dest=OUT/'posts'/(ident+'.json')
 if dest.exists():
  cached=json.loads(dest.read_text(encoding='utf-8'))
  if cached.get('formatVersion')==3:return cached
 soup=BeautifulSoup(get('https://blog.naver.com/PostView.naver?blogId=lawsqare&logNo='+ident),'html.parser')
 root=soup.select_one('.se-main-container') or soup.select_one('#post-view'+ident)
 if not root:raise ValueError('Missing body '+ident)
 category=soup.select_one('#post_1 a[href*="categoryNo="]')
 date=soup.select_one('.se_publishDate,.date')
 title=soup.select_one('.se-title-text,.htitle')
 title=title.get_text(' ',strip=True) if title else html.unescape(urllib.parse.unquote_plus(item['title']))
 blocks=[]
 for el in root.find_all(['p','img','table','h1','h2','h3','h4','li','iframe','video']):
  ancestors=[]; parent=el.parent
  while parent is not None and parent is not root:
   ancestors.append(parent.name); parent=parent.parent
  if el.name not in ['img','iframe','video'] and any(tag in ['p','table','li'] for tag in ancestors):continue
  tag=el.name
  if tag in ['img','video']:
   src=el.get('data-gif-url') or el.get('data-lazy-src') or el.get('data-src') or el.get('src','')
   if src.startswith('//'):src='https:'+src
   if src.startswith('https://'):blocks.append({'type':'image','url':src,'alt':el.get('alt','')})
  elif tag=='iframe':
   src=el.get('src','')
   if src.startswith('https://'):blocks.append({'type':'link','text':'원문 영상','url':src})
  else:
   text=el.get_text(' ',strip=True).replace('\u200b','').strip()
   if not text:continue
   if tag=='table':blocks.append({'type':'paragraph','text':text})
   else:blocks.append({'type':'heading' if tag.startswith('h') else 'paragraph','text':text})
 if not blocks:
  text=root.get_text('\n',strip=True)
  if text:blocks=[{'type':'paragraph','text':text}]
 if not blocks:raise ValueError('Empty body '+ident)
 data={'formatVersion':3,'sourceUrl':url,'sourceId':ident,'title':title,'cat':re.sub(r'\s+',' ',category.get_text(' ',strip=True)) if category else '법률정보','publishedAt':date.get_text(' ',strip=True) if date else item.get('addDate',''),'lang':'ko','blocks':blocks}
 dest.parent.mkdir(exist_ok=True);dest.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
 return data
if __name__=='__main__':
 manifest={}
 with cf.ThreadPoolExecutor(max_workers=3) as pool:
  for rows in pool.map(listing,range(1,43)):
   for row in rows:manifest[str(row['logNo'])]=row
 (OUT/'naver-manifest.json').write_text(json.dumps(list(manifest.values()),ensure_ascii=False,indent=2),encoding='utf-8')
 print('Unique source articles:',len(manifest),flush=True)
 errors=[];posts=[]
 with cf.ThreadPoolExecutor(max_workers=3) as pool:
  futures={pool.submit(article,item):item for item in manifest.values()}
  for future in cf.as_completed(futures):
   item=futures[future]
   try:posts.append(future.result())
   except Exception as e:errors.append({'sourceId':item['logNo'],'error':str(e)})
   if (len(posts)+len(errors))%25==0:print('Collected',len(posts),'errors',len(errors),flush=True)
 posts.sort(key=lambda p:int(p['sourceId']))
 bundle={'version':1,'blogId':'lawsqare','lang':'ko','posts':posts,'errors':errors}
 (OUT/'naver-lawsqare-import.json').write_text(json.dumps(bundle,ensure_ascii=False,indent=2),encoding='utf-8')
 print('DONE',len(posts),'errors',len(errors),flush=True)
