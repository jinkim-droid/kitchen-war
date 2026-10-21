// 언어 (영어·한국어) — 사내 기준 localization:csv-system-language
// - 문구는 strings.js(localization/strings.csv 에서 만든 키 표)에서 키로 꺼낸다: t('menu.shop'), t('chal.tries', { n: 2, total: 3 })
// - 언어 고르기: 설정의 선택(자동·한국어·English) → 자동이면 기기 언어(navigator.languages) → 맞는 게 없으면 영어
// - 선택은 저장본과 따로 둔다(게임 데이터가 읽히기 전, 문구를 정할 때 필요해서). 바꾸면 화면을 다시 불러 모든 문구를 새 언어로
const LANG_KEY = 'kitchen-war-lang';
const SUPPORTED_LOCALES = ['en', 'ko'];
const LOCALE_ALIASES = { kr: 'ko' };
const BASE_LANGUAGE_TARGETS = { en: 'en', ko: 'ko' };

function readSystemLanguageTags() {
  const list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language];
  return list.filter(Boolean);
}
// 정확히 같은 태그 → 별칭 → 기본 언어(ko-KR → ko) → 영어. 대소문자·밑줄은 가리지 않는다
function resolveSupportedLocale(tags) {
  for (const raw of tags || []) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().replace(/_/g, '-').toLowerCase();
    if (!tag) continue;
    const exact = SUPPORTED_LOCALES.find((l) => l.toLowerCase() === tag);
    if (exact) return exact;
    if (LOCALE_ALIASES[tag]) return LOCALE_ALIASES[tag];
    const base = tag.split('-')[0];
    if (LOCALE_ALIASES[base]) return LOCALE_ALIASES[base];
    if (BASE_LANGUAGE_TARGETS[base]) return BASE_LANGUAGE_TARGETS[base];
  }
  return 'en';
}
function langPref() {
  try { const v = localStorage.getItem(LANG_KEY); return SUPPORTED_LOCALES.includes(v) ? v : 'auto'; } catch (e) { return 'auto'; }
}
const LANG = langPref() === 'auto' ? resolveSupportedLocale(readSystemLanguageTags()) : langPref();
document.documentElement.lang = LANG;

function formatLocalizedString(template, values = {}) {
  return template
    .replaceAll("\\n", "\n")
    .replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (placeholder, key) =>
      Object.hasOwn(values, key) ? String(values[key]) : placeholder,
    );
}
function t(key, values) {
  const sel = STRINGS[LANG] || STRINGS.en;
  return formatLocalizedString(sel[key] ?? STRINGS.en[key] ?? key, values);
}
// 설정에서 언어를 바꾼다 ('auto' | 'en' | 'ko') — 저장 후 다시 불러 모든 문구를 새 언어로
function setLangPref(v) {
  try { if (v === 'auto') localStorage.removeItem(LANG_KEY); else localStorage.setItem(LANG_KEY, v); } catch (e) { /* 저장 안 되면 이번만 */ }
  if (typeof save === 'function') save();
  location.reload();
}
// HTML 고정 문구: data-i18n="키"(글자), data-i18n-html="키"(태그 포함), data-i18n-aria="키"(화면 읽기용 이름)
function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.title = t('game.doc_title');
  // CSS가 그리는 글자(한국어가 아닐 때 글자 그림 대신): 미션 '완료!' 도장, 스킨 '장착 중' 배지
  const rs = document.documentElement.style;
  rs.setProperty('--t-done', JSON.stringify(t('stamp.done')));
  rs.setProperty('--t-equipped', JSON.stringify(t('skin.equipped')));
}

// 시작할 때 HTML 고정 문구를 채우고, 설정 창 언어 버튼을 연결한다 (스크립트는 body 끝에서 읽혀 화면 요소가 이미 있다)
applyI18n();
document.querySelectorAll('.langsel [data-lang]').forEach((b) => {
  b.classList.toggle('on', b.dataset.lang === langPref());
  b.onclick = () => { if (b.dataset.lang !== langPref()) setLangPref(b.dataset.lang); };
});
