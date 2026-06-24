-- 자유게시판 + 블로그 + 사이트설정 D1 스키마
-- 적용: wrangler d1 execute global-board --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS posts (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  title TEXT NOT NULL,
  body  TEXT NOT NULL,
  ts    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id       TEXT PRIMARY KEY,
  post_id  TEXT NOT NULL,
  name     TEXT NOT NULL,
  body     TEXT NOT NULL,
  official INTEGER NOT NULL DEFAULT 0,
  ts       INTEGER NOT NULL
);

-- 블로그(법률 칼럼/소식) — 관리자만 작성, 누구나 열람
CREATE TABLE IF NOT EXISTS blog (
  id    TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  cat   TEXT,
  body  TEXT NOT NULL,
  ts    INTEGER NOT NULL
);

-- 사이트 정보(전화/주소/영업시간 등) — key/value
CREATE TABLE IF NOT EXISTS settings (
  k TEXT PRIMARY KEY,
  v TEXT
);

CREATE INDEX IF NOT EXISTS idx_posts_ts ON posts(ts);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_ts ON blog(ts);

-- 기본 사이트 정보(원하면 수정)
INSERT OR IGNORE INTO settings (k,v) VALUES
  ('phone','02 2277 2442'),
  ('email','lawsqare@naver.com'),
  ('address','서울특별시 중구 을지로 254, 3층 301호'),
  ('hours','평일 09:00 – 18:00'),
  ('kakao',''),
  ('blogUrl','https://blog.naver.com/lawsqare');
