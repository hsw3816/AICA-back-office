/*
 * AICA 블록 에디터 (외부 의존성 없음)
 *
 * 블록 배열(JSON)을 편집해 hidden input 에 기록한다. 형식은 서버 BlockContent.java, 프론트 렌더 front/blocks.html 과 동일.
 *   heading   { level, html }        paragraph { align, html }
 *   image     { url, alt, caption, width }
 *   quote     { html }               list { style, items[] }      divider {}
 *
 * 인라인 서식: 굵게·기울임·밑줄·취소선·글자 크기·색상·링크. 글꼴(font-family)은 제공하지 않는다(프론트 고정).
 */
(function (global) {
  'use strict';

  var TYPES = [
    { type: 'paragraph', label: '텍스트', icon: '¶' },
    { type: 'heading', label: '제목', icon: 'H' },
    { type: 'image', label: '이미지', icon: '▣' },
    { type: 'list', label: '목록', icon: '≡' },
    { type: 'quote', label: '인용', icon: '❝' },
    { type: 'divider', label: '구분선', icon: '—' }
  ];
  var LABEL = {};
  TYPES.forEach(function (t) { LABEL[t.type] = t.label; });
  var FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];
  var COLORS = ['#111827', '#6b7280', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777'];

  /* ---------- CSS (에디터 전용) ---------- */
  var CSS = '\
.be{border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;padding:10px 10px 6px}\
.be-block{position:relative;background:#fff;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:8px;padding:10px 12px 10px 44px}\
.be-block.focus{border-color:#2f7cf6;box-shadow:0 0 0 2px rgba(47,124,246,.12)}\
.be-block.dragover{border-top:3px solid #2f7cf6}\
.be-handle{position:absolute;left:8px;top:8px;display:flex;flex-direction:column;gap:2px;align-items:center}\
.be-handle .be-type{font-size:10px;color:#9ca3af;font-weight:600;cursor:grab;user-select:none;width:26px;text-align:center}\
.be-handle button{width:22px;height:20px;border:0;background:transparent;color:#9ca3af;cursor:pointer;border-radius:4px;font-size:11px;line-height:1;padding:0}\
.be-handle button:hover{background:#f3f4f6;color:#374151}\
.be-handle button.del:hover{color:#dc2626}\
.be-tools{display:none;flex-wrap:wrap;gap:4px;align-items:center;margin:-2px 0 8px;padding-bottom:8px;border-bottom:1px dashed #e5e7eb}\
.be-block.focus .be-tools{display:flex}\
.be-tools button,.be-tools select{height:26px;min-width:26px;border:1px solid #e5e7eb;background:#fff;border-radius:4px;font-size:12px;cursor:pointer;padding:0 6px;color:#374151}\
.be-tools button:hover{background:#f3f4f6}\
.be-tools button.on{background:#e0ecff;border-color:#93c5fd;color:#1d4ed8}\
.be-tools .sep{width:1px;height:18px;background:#e5e7eb;margin:0 3px}\
.be-tools .sw{width:16px;height:16px;border-radius:50%;border:1px solid rgba(0,0,0,.15);cursor:pointer;display:inline-block;vertical-align:middle}\
.be-tools input[type=color]{width:26px;height:26px;padding:0;border:1px solid #e5e7eb;border-radius:4px;background:#fff;cursor:pointer}\
.be-text{outline:none;min-height:24px;line-height:1.7;font-size:15px;color:#1f2937;word-break:break-word}\
.be-text:empty:before{content:attr(data-placeholder);color:#9ca3af}\
.be-text h1,.be-text h2,.be-text h3{margin:0}\
.be-heading .be-text{font-weight:700;font-size:22px;line-height:1.4}\
.be-heading[data-level="1"] .be-text{font-size:28px}\
.be-heading[data-level="3"] .be-text{font-size:18px}\
.be-quote .be-text{border-left:3px solid #2eaa5e;padding-left:12px;color:#374151;font-style:italic}\
.be-list .be-text ul,.be-list .be-text ol{margin:0;padding-left:22px}\
.be-image .be-drop{border:2px dashed #d1d5db;border-radius:8px;padding:22px;text-align:center;color:#6b7280;font-size:12px;background:#fafafa}\
.be-image .be-drop.over{border-color:#2f7cf6;background:#eff6ff}\
.be-image .be-drop .row{display:flex;gap:6px;justify-content:center;align-items:center;flex-wrap:wrap;margin-top:10px}\
.be-image img{display:block;max-width:100%;border-radius:6px;margin:0 auto}\
.be-image[data-width=medium] img{max-width:70%}\
.be-image[data-width=small] img{max-width:45%}\
.be-image .be-meta{display:grid;grid-template-columns:1fr 1fr 110px;gap:6px;margin-top:8px}\
.be-image .be-meta input,.be-image .be-meta select{height:28px;border:1px solid #e5e7eb;border-radius:4px;padding:0 8px;font-size:12px}\
.be-divider hr{border:0;border-top:1px solid #d1d5db;margin:6px 0}\
.be-btn{height:26px;border:1px solid #d1d5db;background:#fff;border-radius:4px;font-size:12px;padding:0 10px;cursor:pointer;color:#374151}\
.be-btn:hover{background:#f3f4f6}\
.be-btn.pri{background:#2f7cf6;border-color:#2f7cf6;color:#fff}\
.be-add{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:6px 2px 4px;color:#6b7280;font-size:12px}\
.be-add button{height:28px;border:1px dashed #cbd5e1;background:#fff;border-radius:6px;font-size:12px;padding:0 10px;cursor:pointer;color:#374151}\
.be-add button:hover{border-color:#2f7cf6;color:#2f7cf6}\
.be-add .lbl{margin-right:4px}\
.be-picker{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:100}\
.be-picker .box{background:#fff;border-radius:10px;width:720px;max-width:94vw;max-height:80vh;overflow:auto;padding:16px}\
.be-picker .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:12px}\
.be-picker .grid img{width:100%;height:84px;object-fit:cover;border-radius:6px;border:2px solid transparent;cursor:pointer;background:#f3f4f6}\
.be-picker .grid img:hover{border-color:#2f7cf6}\
.be-empty{color:#9ca3af;font-size:12px;text-align:center;padding:14px 0}\
';

  function injectCss() {
    if (document.getElementById('be-style')) return;
    var s = document.createElement('style');
    s.id = 'be-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------- 유틸 ---------- */
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'on') Object.keys(attrs.on).forEach(function (ev) { e.addEventListener(ev, attrs.on[ev]); });
      else if (k === 'style') e.style.cssText = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function csrf() {
    return (typeof global.csrfHeaders === 'function') ? global.csrfHeaders() : {};
  }
  function toast(msg, err) {
    if (typeof global.notify === 'function') global.notify(msg, err); else console.log(msg);
  }

  /** 이미지 업로드 → Promise<{id,url,name}> */
  function upload(file, url) {
    var fd = new FormData();
    fd.append('file', file);
    return fetch(url, { method: 'POST', body: fd, headers: csrf(), credentials: 'same-origin' })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) throw new Error(body.message || ('업로드 실패 (' + r.status + ')'));
          return body;
        });
      });
  }

  /**
   * contenteditable 결과 HTML 정리:
   *  - <font color/size> → <span style>, execCommand 가 남긴 xxx-large 등 상대 크기 → px
   *  - <div>/<p> → 줄바꿈, 허용 외 태그는 텍스트만 남김 (서버에서 다시 정화)
   */
  var INLINE_OK = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, S: 1, STRIKE: 1, BR: 1, SPAN: 1, A: 1, SUB: 1, SUP: 1, MARK: 1 };
  var STYLE_OK = { 'color': 1, 'background-color': 1, 'font-size': 1, 'font-weight': 1, 'font-style': 1, 'text-decoration': 1, 'text-decoration-line': 1 };
  function cleanInline(root) {
    var out = document.createElement('div');
    function walk(node, target) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) { target.appendChild(document.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1) return;
        var tag = n.tagName;
        if (tag === 'DIV' || tag === 'P') {
          if (target.childNodes.length) target.appendChild(document.createElement('br'));
          walk(n, target);
          return;
        }
        if (tag === 'FONT') {
          var sp = document.createElement('span');
          if (n.getAttribute('color')) sp.style.color = n.getAttribute('color');
          if (n.style && n.style.fontSize) sp.style.fontSize = n.style.fontSize;
          walk(n, sp);
          target.appendChild(sp.style.cssText ? sp : unwrap(sp));
          return;
        }
        if (!INLINE_OK[tag]) { walk(n, target); return; }
        var c = document.createElement(tag === 'STRONG' ? 'b' : tag === 'EM' ? 'i' : tag === 'STRIKE' ? 's' : tag.toLowerCase());
        if (tag === 'A') { c.setAttribute('href', n.getAttribute('href') || '#'); c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener noreferrer'); }
        if (tag === 'SPAN' || tag === 'A') {
          var kept = [];
          for (var i = 0; i < n.style.length; i++) {
            var prop = n.style[i];
            if (STYLE_OK[prop]) {
              var v = n.style.getPropertyValue(prop);
              if (prop === 'font-size') v = normalizeSize(v);
              if (v) kept.push(prop + ': ' + v);
            }
          }
          if (kept.length) c.setAttribute('style', kept.join('; ') + ';');
          else if (tag === 'SPAN') { walk(n, target); return; }
        }
        walk(n, c);
        target.appendChild(c);
      });
    }
    function unwrap(sp) { var f = document.createDocumentFragment(); while (sp.firstChild) f.appendChild(sp.firstChild); return f; }
    walk(root, out);
    // 끝의 <br> 제거
    while (out.lastChild && out.lastChild.nodeType === 1 && out.lastChild.tagName === 'BR') out.removeChild(out.lastChild);
    return out.innerHTML.replace(/&nbsp;/g, ' ').trim();
  }
  var REL_SIZE = { 'x-small': '12px', 'small': '14px', 'medium': '16px', 'large': '18px', 'x-large': '24px', 'xx-large': '32px', 'xxx-large': '48px', '-webkit-xxx-large': '48px' };
  function normalizeSize(v) {
    v = (v || '').trim();
    if (/^\d+(\.\d+)?(px|rem|em)$/.test(v)) return v;
    return REL_SIZE[v] || '';
  }

  /* ---------- 에디터 ---------- */
  function Editor(container, opts) {
    injectCss();
    this.container = container;
    this.opts = opts || {};
    this.input = opts.input;
    this.blocks = [];
    this.pendingSize = null;
    container.classList.add('be');
    this.list = el('div', { 'class': 'be-list' });
    container.appendChild(this.list);
    container.appendChild(this.buildAddBar(null));
    var initial = [];
    try { initial = JSON.parse(this.input && this.input.value ? this.input.value : '[]'); } catch (e) { initial = []; }
    if (!Array.isArray(initial) || !initial.length) initial = [{ type: 'paragraph', align: 'left', html: '' }];
    var self = this;
    initial.forEach(function (b) { self.list.appendChild(self.renderBlock(b)); });
    this.sync();
    document.addEventListener('selectionchange', function () { self.updateToolbarState(); });
  }

  Editor.prototype.buildAddBar = function (afterEl) {
    var self = this;
    var bar = el('div', { 'class': 'be-add' }, [el('span', { 'class': 'lbl', text: '+ 블록 추가' })]);
    TYPES.forEach(function (t) {
      bar.appendChild(el('button', { type: 'button', text: t.icon + ' ' + t.label, on: { click: function () { self.addBlock(t.type, afterEl); } } }));
    });
    return bar;
  };

  Editor.prototype.newBlock = function (type) {
    switch (type) {
      case 'heading': return { type: 'heading', level: 2, html: '' };
      case 'image': return { type: 'image', url: '', alt: '', caption: '', width: 'full' };
      case 'quote': return { type: 'quote', html: '' };
      case 'list': return { type: 'list', style: 'bullet', items: [''] };
      case 'divider': return { type: 'divider' };
      default: return { type: 'paragraph', align: 'left', html: '' };
    }
  };

  Editor.prototype.addBlock = function (type, afterEl) {
    var node = this.renderBlock(this.newBlock(type));
    if (afterEl && afterEl.parentNode === this.list) this.list.insertBefore(node, afterEl.nextSibling);
    else this.list.appendChild(node);
    this.focusBlock(node);
    this.sync();
    return node;
  };

  Editor.prototype.focusBlock = function (node) {
    var t = node.querySelector('.be-text');
    if (t) {
      t.focus();
      var range = document.createRange();
      range.selectNodeContents(t);
      range.collapse(false);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    this.setFocus(node);
  };

  Editor.prototype.setFocus = function (node) {
    Array.prototype.forEach.call(this.list.children, function (c) { c.classList.remove('focus'); });
    if (node) node.classList.add('focus');
  };

  Editor.prototype.removeBlock = function (node) {
    var prev = node.previousElementSibling;
    node.remove();
    if (!this.list.children.length) this.list.appendChild(this.renderBlock(this.newBlock('paragraph')));
    if (prev) this.focusBlock(prev);
    this.sync();
  };

  Editor.prototype.move = function (node, dir) {
    if (dir < 0 && node.previousElementSibling) this.list.insertBefore(node, node.previousElementSibling);
    if (dir > 0 && node.nextElementSibling) this.list.insertBefore(node.nextElementSibling, node);
    this.sync();
  };

  /** 블록 DOM 생성 */
  Editor.prototype.renderBlock = function (b) {
    var self = this;
    var node = el('div', { 'class': 'be-block be-' + b.type, 'data-type': b.type, draggable: 'false' });
    node._block = b;

    // 좌측 핸들
    var handle = el('div', { 'class': 'be-handle' }, [
      el('span', { 'class': 'be-type', text: LABEL[b.type] || b.type, title: '드래그하여 순서 변경', draggable: 'true' }),
      el('button', { type: 'button', text: '▲', title: '위로', on: { click: function () { self.move(node, -1); } } }),
      el('button', { type: 'button', text: '▼', title: '아래로', on: { click: function () { self.move(node, 1); } } }),
      el('button', { type: 'button', 'class': 'del', text: '✕', title: '삭제', on: { click: function () { self.removeBlock(node); } } })
    ]);
    node.appendChild(handle);
    this.enableDrag(node, handle.firstChild);

    node.addEventListener('mousedown', function () { self.setFocus(node); });
    node.addEventListener('focusin', function () { self.setFocus(node); });

    switch (b.type) {
      case 'paragraph':
      case 'heading':
      case 'quote':
        this.renderText(node, b);
        break;
      case 'list':
        this.renderList(node, b);
        break;
      case 'image':
        this.renderImage(node, b);
        break;
      default:
        node.appendChild(el('hr'));
    }
    return node;
  };

  /* ----- 텍스트 계열 ----- */
  Editor.prototype.renderText = function (node, b) {
    var self = this;
    var tools = el('div', { 'class': 'be-tools' });
    var text = el('div', {
      'class': 'be-text', contenteditable: 'true', spellcheck: 'false',
      'data-placeholder': b.type === 'heading' ? '제목' : b.type === 'quote' ? '인용문' : '내용을 입력하세요 (Enter: 새 블록, Shift+Enter: 줄바꿈)',
      html: b.html || ''
    });
    if (b.type === 'heading') node.setAttribute('data-level', b.level || 2);
    if (b.type === 'paragraph') text.style.textAlign = b.align || 'left';

    this.buildInlineTools(tools, node, text, b);
    node.appendChild(tools);
    node.appendChild(text);

    text.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        self.addBlock('paragraph', node);
      } else if (e.key === 'Backspace' && !text.textContent && !text.querySelector('img')) {
        if (self.list.children.length > 1) { e.preventDefault(); self.removeBlock(node); }
      }
    });
    text.addEventListener('input', function () { self.sync(); });
    text.addEventListener('paste', function (e) {
      // 서식 붙여넣기 → 순수 텍스트만 (외부 스타일 유입 방지)
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, t);
    });
  };

  Editor.prototype.buildInlineTools = function (tools, node, text, b) {
    var self = this;
    function cmd(name, value) {
      text.focus();
      document.execCommand('styleWithCSS', false, true);
      document.execCommand(name, false, value || null);
      self.sync();
    }
    function tb(label, title, onClick, cls) {
      return el('button', { type: 'button', text: label, title: title, 'class': cls || '', on: { mousedown: function (e) { e.preventDefault(); }, click: onClick } });
    }

    if (b.type === 'heading') {
      var lv = el('select', { title: '제목 단계', on: { change: function () { b.level = parseInt(lv.value, 10); node.setAttribute('data-level', b.level); self.sync(); } } });
      [1, 2, 3].forEach(function (n) { var o = el('option', { value: n, text: 'H' + n }); if ((b.level || 2) === n) o.selected = true; lv.appendChild(o); });
      tools.appendChild(lv);
      tools.appendChild(el('span', { 'class': 'sep' }));
    }
    if (b.type === 'paragraph') {
      [['left', '≡', '왼쪽 정렬'], ['center', '☰', '가운데 정렬'], ['right', '≡', '오른쪽 정렬']].forEach(function (a) {
        var btn = tb(a[1], a[2], function () { b.align = a[0]; text.style.textAlign = a[0]; self.sync(); self.updateToolbarState(); });
        btn.setAttribute('data-align', a[0]);
        tools.appendChild(btn);
      });
      tools.appendChild(el('span', { 'class': 'sep' }));
    }

    var bd = tb('B', '굵게 (Ctrl+B)', function () { cmd('bold'); }); bd.style.fontWeight = '700'; bd.setAttribute('data-cmd', 'bold'); tools.appendChild(bd);
    var it = tb('I', '기울임 (Ctrl+I)', function () { cmd('italic'); }); it.style.fontStyle = 'italic'; it.setAttribute('data-cmd', 'italic'); tools.appendChild(it);
    var un = tb('U', '밑줄 (Ctrl+U)', function () { cmd('underline'); }); un.style.textDecoration = 'underline'; un.setAttribute('data-cmd', 'underline'); tools.appendChild(un);
    var st = tb('S', '취소선', function () { cmd('strikeThrough'); }); st.style.textDecoration = 'line-through'; st.setAttribute('data-cmd', 'strikeThrough'); tools.appendChild(st);
    tools.appendChild(el('span', { 'class': 'sep' }));

    // 글자 크기
    var size = el('select', { title: '글자 크기', on: {
      mousedown: function () { self.savedRange = saveRange(); },
      change: function () {
        if (!size.value) return;
        restoreRange(self.savedRange);
        text.focus();
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('fontSize', false, '7');
        // 7 단계(xxx-large)로 표시된 span 을 원하는 px 로 치환
        Array.prototype.forEach.call(text.querySelectorAll('span,font'), function (s) {
          var fs = s.style ? s.style.fontSize : '';
          if (fs === 'xxx-large' || fs === '-webkit-xxx-large' || s.getAttribute('size') === '7') {
            s.removeAttribute('size');
            s.style.fontSize = size.value;
          }
        });
        size.value = '';
        self.sync();
      } } });
    size.appendChild(el('option', { value: '', text: '크기' }));
    FONT_SIZES.forEach(function (s) { size.appendChild(el('option', { value: s, text: s.replace('px', '') })); });
    tools.appendChild(size);

    // 색상
    COLORS.forEach(function (c) {
      tools.appendChild(el('span', { 'class': 'sw', style: 'background:' + c, title: c, on: {
        mousedown: function (e) { e.preventDefault(); },
        click: function () { cmd('foreColor', c); }
      } }));
    });
    var picker = el('input', { type: 'color', title: '직접 선택', value: '#111827', on: {
      mousedown: function () { self.savedRange = saveRange(); },
      input: function () { restoreRange(self.savedRange); cmd('foreColor', picker.value); self.savedRange = saveRange(); }
    } });
    tools.appendChild(picker);
    tools.appendChild(el('span', { 'class': 'sep' }));

    tools.appendChild(tb('🔗', '링크', function () {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed) { toast('링크를 걸 텍스트를 먼저 선택하세요.', true); return; }
      var url = window.prompt('링크 주소 (https://...)', 'https://');
      if (url) cmd('createLink', url);
    }));
    tools.appendChild(tb('Tx', '서식 지우기', function () { cmd('removeFormat'); cmd('unlink'); }));
  };

  function saveRange() {
    var sel = window.getSelection();
    return sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  }
  function restoreRange(r) {
    if (!r) return;
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }

  Editor.prototype.updateToolbarState = function () {
    var focused = this.list.querySelector('.be-block.focus');
    if (!focused) return;
    var tools = focused.querySelector('.be-tools');
    if (!tools) return;
    Array.prototype.forEach.call(tools.querySelectorAll('[data-cmd]'), function (btn) {
      var on = false;
      try { on = document.queryCommandState(btn.getAttribute('data-cmd')); } catch (e) { on = false; }
      btn.classList.toggle('on', !!on);
    });
    var b = focused._block;
    Array.prototype.forEach.call(tools.querySelectorAll('[data-align]'), function (btn) {
      btn.classList.toggle('on', btn.getAttribute('data-align') === (b.align || 'left'));
    });
  };

  /* ----- 목록 ----- */
  Editor.prototype.renderList = function (node, b) {
    var self = this;
    var tools = el('div', { 'class': 'be-tools' });
    var listTag = b.style === 'number' ? 'ol' : 'ul';
    var text = el('div', { 'class': 'be-text', contenteditable: 'true', spellcheck: 'false' });
    var listEl = el(listTag);
    (b.items && b.items.length ? b.items : ['']).forEach(function (item) { listEl.appendChild(el('li', { html: item || '' })); });
    text.appendChild(listEl);

    var styleSel = el('select', { title: '목록 형식', on: { change: function () {
      b.style = styleSel.value;
      var newList = el(b.style === 'number' ? 'ol' : 'ul');
      var cur = text.querySelector('ul,ol');
      while (cur && cur.firstChild) newList.appendChild(cur.firstChild);
      text.innerHTML = '';
      text.appendChild(newList);
      self.sync();
    } } });
    [['bullet', '• 글머리 기호'], ['number', '1. 번호']].forEach(function (o) {
      var op = el('option', { value: o[0], text: o[1] }); if ((b.style || 'bullet') === o[0]) op.selected = true; styleSel.appendChild(op);
    });
    tools.appendChild(styleSel);
    tools.appendChild(el('span', { 'class': 'sep' }));
    this.buildInlineTools(tools, node, text, { type: 'list' });
    node.appendChild(tools);
    node.appendChild(text);

    text.addEventListener('input', function () {
      // 목록이 사라지면 복구
      if (!text.querySelector('ul,ol')) {
        var nl = el(b.style === 'number' ? 'ol' : 'ul');
        nl.appendChild(el('li', { text: text.textContent }));
        text.innerHTML = '';
        text.appendChild(nl);
      }
      self.sync();
    });
    text.addEventListener('paste', function (e) {
      e.preventDefault();
      document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
    });
  };

  /* ----- 이미지 ----- */
  Editor.prototype.renderImage = function (node, b) {
    var self = this;
    node.setAttribute('data-width', b.width || 'full');
    var body = el('div', { 'class': 'be-image-body' });
    node.appendChild(body);

    function draw() {
      body.innerHTML = '';
      if (!b.url) {
        var fileInput = el('input', { type: 'file', accept: 'image/*', hidden: 'hidden' });
        var urlInput = el('input', { type: 'text', placeholder: '또는 이미지 URL (https://...)', style: 'height:28px;border:1px solid #e5e7eb;border-radius:4px;padding:0 8px;font-size:12px;width:260px' });
        var drop = el('div', { 'class': 'be-drop' }, [
          el('div', { text: '이미지를 여기에 끌어다 놓거나 업로드하세요 (JPG·PNG·GIF·WEBP, 10MB 이하)' }),
          el('div', { 'class': 'row' }, [
            el('button', { type: 'button', 'class': 'be-btn pri', text: '파일 업로드', on: { click: function () { fileInput.click(); } } }),
            el('button', { type: 'button', 'class': 'be-btn', text: '보관함에서 선택', on: { click: function () { self.openPicker(function (url) { b.url = url; draw(); self.sync(); }); } } }),
            urlInput,
            el('button', { type: 'button', 'class': 'be-btn', text: '적용', on: { click: function () {
              var v = urlInput.value.trim();
              if (!/^(https?:\/\/|\/uploads\/)/.test(v)) { toast('http(s):// 로 시작하는 주소를 입력하세요.', true); return; }
              b.url = v; draw(); self.sync();
            } } })
          ]),
          fileInput
        ]);
        function doUpload(file) {
          drop.firstChild.textContent = '업로드 중…';
          upload(file, self.opts.uploadUrl).then(function (res) { b.url = res.url; if (!b.alt) b.alt = res.name || ''; draw(); self.sync(); })
            .catch(function (e) { toast(e.message, true); draw(); });
        }
        fileInput.addEventListener('change', function () { if (fileInput.files[0]) doUpload(fileInput.files[0]); });
        drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
        drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
        drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) doUpload(e.dataTransfer.files[0]); });
        body.appendChild(drop);
        return;
      }
      var img = el('img', { src: b.url, alt: b.alt || '' });
      var alt = el('input', { type: 'text', placeholder: '대체 텍스트(alt)', value: b.alt || '', on: { input: function () { b.alt = alt.value; self.sync(); } } });
      var cap = el('input', { type: 'text', placeholder: '캡션 (선택)', value: b.caption || '', on: { input: function () { b.caption = cap.value; self.sync(); } } });
      var width = el('select', { title: '표시 너비', on: { change: function () { b.width = width.value; node.setAttribute('data-width', b.width); self.sync(); } } });
      [['full', '전체 너비'], ['medium', '중간'], ['small', '작게']].forEach(function (o) {
        var op = el('option', { value: o[0], text: o[1] }); if ((b.width || 'full') === o[0]) op.selected = true; width.appendChild(op);
      });
      var change = el('button', { type: 'button', 'class': 'be-btn', text: '이미지 변경', style: 'margin-top:8px', on: { click: function () { b.url = ''; draw(); self.sync(); } } });
      body.appendChild(img);
      body.appendChild(el('div', { 'class': 'be-meta' }, [alt, cap, width]));
      body.appendChild(change);
    }
    draw();
  };

  /** 최근 업로드 이미지 선택 모달 */
  Editor.prototype.openPicker = function (onPick) {
    var self = this;
    var grid = el('div', { 'class': 'grid' }, [el('div', { 'class': 'be-empty', text: '불러오는 중…' })]);
    var overlay = el('div', { 'class': 'be-picker' }, [
      el('div', { 'class': 'box' }, [
        el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, [
          el('b', { text: '이미지 보관함 (최근 30개)' }),
          el('button', { type: 'button', 'class': 'be-btn', text: '닫기', on: { click: function () { overlay.remove(); } } })
        ]),
        grid
      ])
    ]);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    fetch(self.opts.recentUrl, { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (items) {
      grid.innerHTML = '';
      if (!items.length) { grid.appendChild(el('div', { 'class': 'be-empty', text: '업로드된 이미지가 없습니다.' })); return; }
      items.forEach(function (it) {
        grid.appendChild(el('img', { src: it.url, title: it.name, on: { click: function () { onPick(it.url); overlay.remove(); } } }));
      });
    }).catch(function () { grid.innerHTML = '<div class="be-empty">목록을 불러오지 못했습니다.</div>'; });
  };

  /* ----- 드래그 정렬 ----- */
  Editor.prototype.enableDrag = function (node, handle) {
    var self = this;
    handle.addEventListener('dragstart', function (e) {
      self.dragging = node;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'block');
    });
    node.addEventListener('dragover', function (e) {
      if (!self.dragging || self.dragging === node) return;
      e.preventDefault();
      node.classList.add('dragover');
    });
    node.addEventListener('dragleave', function () { node.classList.remove('dragover'); });
    node.addEventListener('drop', function (e) {
      node.classList.remove('dragover');
      if (!self.dragging || self.dragging === node) return;
      e.preventDefault();
      self.list.insertBefore(self.dragging, node);
      self.dragging = null;
      self.sync();
    });
    handle.addEventListener('dragend', function () {
      self.dragging = null;
      Array.prototype.forEach.call(self.list.children, function (c) { c.classList.remove('dragover'); });
    });
  };

  /* ----- 직렬화 ----- */
  Editor.prototype.getBlocks = function () {
    var out = [];
    Array.prototype.forEach.call(this.list.children, function (node) {
      var b = node._block;
      var text = node.querySelector('.be-text');
      switch (b.type) {
        case 'paragraph':
          out.push({ type: 'paragraph', align: b.align || 'left', html: cleanInline(text) });
          break;
        case 'heading':
          out.push({ type: 'heading', level: b.level || 2, html: cleanInline(text) });
          break;
        case 'quote':
          out.push({ type: 'quote', html: cleanInline(text) });
          break;
        case 'list': {
          var items = [];
          Array.prototype.forEach.call(text.querySelectorAll('li'), function (li) { var h = cleanInline(li); if (h) items.push(h); });
          out.push({ type: 'list', style: b.style || 'bullet', items: items });
          break;
        }
        case 'image':
          if (b.url) out.push({ type: 'image', url: b.url, alt: b.alt || '', caption: b.caption || '', width: b.width || 'full' });
          break;
        case 'divider':
          out.push({ type: 'divider' });
          break;
      }
    });
    // 내용 없는 텍스트 블록 제거 (단, 전부 비어 있으면 빈 배열)
    return out.filter(function (b) {
      if (b.type === 'image' || b.type === 'divider') return true;
      if (b.type === 'list') return b.items.length > 0;
      return b.html.replace(/<br\s*\/?>/g, '').trim().length > 0;
    });
  };

  Editor.prototype.sync = function () {
    if (this.input) this.input.value = JSON.stringify(this.getBlocks());
  };

  global.BlockEditor = {
    mount: function (container, opts) { return new Editor(container, opts); },
    upload: upload,
    cleanInline: cleanInline
  };
})(window);
