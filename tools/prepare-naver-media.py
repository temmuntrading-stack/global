"""Package public original images for authenticated import when server hotlinks fail."""
import base64, concurrent.futures, hashlib, json, pathlib, time, urllib.request, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / 'imports' / 'media-cache'
CACHE.mkdir(exist_ok=True)
HEADERS = {'User-Agent': 'Mozilla/5.0', 'Referer': 'https://blog.naver.com/lawsqare'}

def image_type(data):
    if data.startswith(b'\x89PNG\r\n\x1a\n'): return 'image/png'
    if data.startswith(b'\xff\xd8\xff'): return 'image/jpeg'
    if data[:6] in (b'GIF87a', b'GIF89a'): return 'image/gif'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP': return 'image/webp'
    raise ValueError('Not a supported image')

def collect(url):
    path = CACHE / hashlib.sha256(url.encode()).hexdigest()
    for attempt in range(3):
        try:
            if path.exists(): data = path.read_bytes()
            else:
                request_url = urllib.parse.quote(url.replace('\u00a2er=', '&center='), safe=':/?=&%+-._~')
                with urllib.request.urlopen(urllib.request.Request(request_url, headers=HEADERS), timeout=25) as response:
                    data = response.read(8 * 1024 * 1024 + 1)
            if len(data) > 8 * 1024 * 1024: raise ValueError('Image exceeds 8MB')
            mime = image_type(data)
            path.write_bytes(data)
            return url, {'path': str(path.relative_to(ROOT)), 'type': mime}
        except Exception:
            if attempt == 2: raise
            time.sleep(attempt + 1)

if __name__ == '__main__':
    bundle = json.loads((ROOT / 'imports/naver-lawsqare-import.json').read_text(encoding='utf-8'))
    urls = sorted({b['url'] for p in bundle['posts'] for b in p['blocks'] if b['type'] == 'image'})
    images, errors = {}, []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        pending = {pool.submit(collect, url): url for url in urls}
        for future in concurrent.futures.as_completed(pending):
            try:
                url, image = future.result(); images[url] = image
            except Exception as error: errors.append({'url': pending[future], 'error': str(error)})
            if (len(images) + len(errors)) % 100 == 0: print('IMAGES', len(images), 'errors', len(errors), flush=True)
    (ROOT / 'imports/naver-media.json').write_text(json.dumps({'images': images, 'errors': errors}, ensure_ascii=False), encoding='utf-8')
    print('DONE', len(images), 'errors', len(errors), flush=True)
    completed_path = ROOT / 'imports/imported-ids.json'
    completed = set(json.loads(completed_path.read_text(encoding='utf-8'))) if completed_path.exists() else set()
    posts = [p for p in bundle['posts'] if 'naver-' + str(p['sourceId']) not in completed]
    parts = ROOT / 'imports/media-parts'; parts.mkdir(exist_ok=True)
    chunk_posts, chunk_images, size, index = [], {}, 0, 1
    unavailable = []
    def save_part():
        global index
        if not chunk_posts: return
        payload = {'version': 1, 'blogId': 'lawsqare', 'lang': 'ko', 'totalPosts': len(posts), 'posts': chunk_posts, 'images': chunk_images}
        (parts / ('naver-media-%02d.json' % index)).write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
        index += 1
    for original in posts:
        post = dict(original); post['blocks'] = []
        added = {}
        for block in original['blocks']:
            if block['type'] == 'image':
                image = images.get(block['url'])
                if not image:
                    unavailable.append({'post': original['sourceUrl'], 'image': block['url']})
                    post['blocks'].append({'type': 'link', 'url': original['sourceUrl'], 'text': '이 이미지의 네이버 원문 보기'})
                    continue
                if block['url'] not in chunk_images and block['url'] not in added:
                    content = (ROOT / image['path']).read_bytes()
                    added[block['url']] = 'data:' + image['type'] + ';base64,' + base64.b64encode(content).decode()
            post['blocks'].append(block)
        extra = sum(len(v) for v in added.values()) + len(json.dumps(post, ensure_ascii=False).encode('utf-8'))
        if chunk_posts and size + extra > 30 * 1024 * 1024:
            save_part(); chunk_posts, chunk_images, size = [], {}, 0
            for block in post['blocks']:
                if block['type'] == 'image' and block['url'] not in added:
                    image = images[block['url']]; content = (ROOT / image['path']).read_bytes()
                    added[block['url']] = 'data:' + image['type'] + ';base64,' + base64.b64encode(content).decode()
            extra = sum(len(v) for v in added.values()) + len(json.dumps(post, ensure_ascii=False).encode('utf-8'))
        chunk_posts.append(post); chunk_images.update(added); size += extra
    save_part()
    (ROOT / 'imports/unavailable-images.json').write_text(json.dumps(unavailable, ensure_ascii=False, indent=2), encoding='utf-8')
    print('PACKAGED', len(posts), 'posts in', index - 1, 'parts; unavailable images', len(unavailable), flush=True)
