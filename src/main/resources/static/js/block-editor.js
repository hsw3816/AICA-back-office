/*
 * AICA 블록 에디터 v2 (외부 의존성 없음)
 *
 * - 상단 도구 모음 하나가 현재 선택한 블록에 적용된다 (블록별 툴바 없음).
 * - 블록 배열(JSON)을 hidden input 에 기록한다. 서버 BlockContent.java / 프론트 front/blocks.html 과 같은 형식.
 *   heading{level,html} paragraph{align,html} image{url,alt,caption,width} quote{html}
 *   list{style,items[]} divider{} table{rows[][]} code{lang,code}
 *
 * 사용:
 *   var ed = BlockEditor.mount(container, { input, toolbar, uploadUrl, recentUrl, onChange });
 *   ed.sync(); ed.getBlocks(); ed.setBlocks(arr); ed.isEmpty();
 *   BlockEditor.upload(file, url) -> Promise<{url,name}>
 */
(function (global) {
  'use strict';

  var FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];
  var COLORS = ['#111827', '#6b7280', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777'];
  var BG_COLORS = ['transparent', '#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#e9d5ff', '#fed7aa', '#e5e7eb'];
  var TEXT_TYPES = { paragraph: 1, heading: 1, quote: 1, list: 1, table: 1 };

  /* ---------- 유틸 ---------- */
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'on') Object.keys(attrs.on).forEach(function (ev) { e.addEventListener(ev, attrs.on[ev]); });
      else if (k === 'style') e.style.cssText = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function csrf() { return (typeof global.csrfHeaders === 'function') ? global.csrfHeaders() : {}; }
  function toast(msg, err) { if (typeof global.notify === 'function') global.notify(msg, err); else console.log(msg); }
  function saveRange() { var s = window.getSelection(); return s && s.rangeCount ? s.getRangeAt(0).cloneRange() : null; }
  function restoreRange(r) { if (!r) return; var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }

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

  /* ---------- 인라인 HTML 정리 ---------- */
  var INLINE_OK = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, S: 1, STRIKE: 1, BR: 1, SPAN: 1, A: 1, SUB: 1, SUP: 1, MARK: 1 };
  var STYLE_OK = { 'color': 1, 'background-color': 1, 'font-size': 1, 'font-weight': 1, 'font-style': 1, 'text-decoration': 1, 'text-decoration-line': 1 };
  var REL_SIZE = { 'x-small': '12px', 'small': '14px', 'medium': '16px', 'large': '18px', 'x-large': '24px', 'xx-large': '32px', 'xxx-large': '48px', '-webkit-xxx-large': '48px' };
  function normalizeSize(v) { v = (v || '').trim(); if (/^\d+(\.\d+)?(px|rem|em)$/.test(v)) return v; return REL_SIZE[v] || ''; }
  function cleanInline(root) {
    var out = document.createElement('div');
    function unwrapInto(target, node) { Array.prototype.slice.call(node.childNodes).forEach(function (c) { walk(c, target); }); }
    function walk(n, target) {
      if (n.nodeType === 3) { target.appendChild(document.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== 1) return;
      var tag = n.tagName;
      if (tag === 'DIV' || tag === 'P' || tag === 'LI') {
        if (target.childNodes.length) target.appendChild(document.createElement('br'));
        unwrapInto(target, n); return;
      }
      if (tag === 'FONT') {
        var sp = document.createElement('span');
        if (n.getAttribute('color')) sp.style.color = n.getAttribute('color');
        if (n.style && n.style.fontSize) sp.style.fontSize = n.style.fontSize;
        if (n.style && n.style.backgroundColor) sp.style.backgroundColor = n.style.backgroundColor;
        unwrapInto(sp, n);
        if (sp.style.cssText) target.appendChild(sp); else unwrapInto(target, sp);
        return;
      }
      if (!INLINE_OK[tag]) { unwrapInto(target, n); return; }
      var c = document.createElement(tag === 'STRONG' ? 'b' : tag === 'EM' ? 'i' : tag === 'STRIKE' ? 's' : tag.toLowerCase());
      if (tag === 'A') { c.setAttribute('href', n.getAttribute('href') || '#'); c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener noreferrer'); }
      if (tag === 'SPAN' || tag === 'A') {
        var kept = [];
        for (var i = 0; i < n.style.length; i++) {
          var prop = n.style[i];
          if (STYLE_OK[prop]) {
            var v = n.style.getPropertyValue(prop);
            if (prop === 'font-size') v = normalizeSize(v);
            if (prop === 'background-color' && (v === 'transparent' || v === 'rgba(0, 0, 0, 0)')) v = '';
            if (v) kept.push(prop + ': ' + v);
          }
        }
        if (kept.length) c.setAttribute('style', kept.join('; ') + ';');
        else if (tag === 'SPAN') { unwrapInto(target, n); return; }
      }
      unwrapInto(c, n);
      target.appendChild(c);
    }
    Array.prototype.slice.call(root.childNodes).forEach(function (c) { walk(c, out); });
    while (out.lastChild && out.lastChild.nodeType === 1 && out.lastChild.tagName === 'BR') out.removeChild(out.lastChild);
    return out.innerHTML.replace(/&nbsp;/g, ' ').trim();
  }

  /* ---------- 에디터 ---------- */
  function Editor(container, opts) {
    var self = this;
    this.container = container;
    this.opts = opts || {};
    this.input = opts.input;
    this.list = el('div', { 'class': 'be-list' });
    container.classList.add('be');
    container.appendChild(this.list);
    container.appendChild(el('div', { 'class': 'be-add', on: { click: function () { self.addBlock('paragraph', null); } } }, [
      el('span', { text: '+ 여기를 눌러 문단 추가 · 상단 도구로 이미지·표·인용 등 삽입' })
    ]));

    var initial = [];
    try { initial = JSON.parse(this.input && this.input.value ? this.input.value : '[]'); } catch (e) { initial = []; }
    this.setBlocks(initial, true);
    if (opts.toolbar) this.buildToolbar(opts.toolbar);

    document.addEventListener('selectionchange', function () { self.updateToolbarState(); });

    // 클립보드에 이미지가 있으면 어디서든 붙여넣기로 삽입
    container.addEventListener('paste', function (e) {
      var files = imageFiles(e.clipboardData);
      if (files.length) { e.preventDefault(); e.stopPropagation(); self.insertImages(files); }
    }, true);
    // 본문 어디에나 이미지 파일을 끌어다 놓으면 그 위치에 삽입
    container.addEventListener('dragover', function (e) {
      if (!hasFiles(e.dataTransfer)) return;
      e.preventDefault();
      container.classList.add('be-dropping');
      self.dropTarget = self.blockAtY(e.clientY);
      Array.prototype.forEach.call(self.list.children, function (c) { c.classList.toggle('drop-after', c === self.dropTarget); });
    });
    container.addEventListener('dragleave', function (e) {
      if (e.target === container) { container.classList.remove('be-dropping'); }
    });
    container.addEventListener('drop', function (e) {
      container.classList.remove('be-dropping');
      Array.prototype.forEach.call(self.list.children, function (c) { c.classList.remove('drop-after'); });
      var files = imageFiles(e.dataTransfer);
      if (!files.length) return;
      e.preventDefault(); e.stopPropagation();
      self.insertImages(files, self.dropTarget || null);
    }, true);
  }

  function hasFiles(dt) { return dt && dt.types && Array.prototype.indexOf.call(dt.types, 'Files') >= 0; }
  function imageFiles(dt) {
    var out = [];
    if (!dt) return out;
    var files = dt.files && dt.files.length ? dt.files : null;
    if (!files && dt.items) {
      files = [];
      for (var i = 0; i < dt.items.length; i++) { var f = dt.items[i].kind === 'file' ? dt.items[i].getAsFile() : null; if (f) files.push(f); }
    }
    if (!files) return out;
    for (var j = 0; j < files.length; j++) { if (files[j] && /^image\//.test(files[j].type)) out.push(files[j]); }
    return out;
  }

  /* ----- 상태 ----- */
  Editor.prototype.setBlocks = function (blocks, silent) {
    var self = this;
    this.list.innerHTML = '';
    if (!Array.isArray(blocks) || !blocks.length) blocks = [{ type: 'paragraph', align: 'left', html: '' }];
    blocks.forEach(function (b) { self.list.appendChild(self.renderBlock(b)); });
    this.sync(silent);
  };
  Editor.prototype.isEmpty = function () {
    return this.getBlocks().length === 0;
  };
  Editor.prototype.changed = function () {
    this.sync();
    if (typeof this.opts.onChange === 'function') this.opts.onChange();
  };
  Editor.prototype.sync = function (silent) {
    if (this.input) this.input.value = JSON.stringify(this.getBlocks());
    if (!silent && typeof this.opts.onChange === 'function') this.opts.onChange();
  };

  /* ----- 블록 조작 ----- */
  Editor.prototype.newBlock = function (type) {
    switch (type) {
      case 'heading': return { type: 'heading', level: 2, html: '' };
      case 'image': return { type: 'image', url: '', alt: '', caption: '', width: 'full' };
      case 'quote': return { type: 'quote', html: '' };
      case 'list': return { type: 'list', style: 'bullet', items: [''] };
      case 'divider': return { type: 'divider' };
      case 'table': return { type: 'table', rows: [['', ''], ['', '']] };
      case 'code': return { type: 'code', lang: '', code: '' };
      default: return { type: 'paragraph', align: 'left', html: '' };
    }
  };
  Editor.prototype.focused = function () { return this.list.querySelector('.be-block.focus'); };
  Editor.prototype.addBlock = function (type, afterEl) {
    if (afterEl === undefined) afterEl = this.focused();
    var node = this.renderBlock(this.newBlock(type));
    // 비어 있는 문단에서 다른 블록을 삽입하면 그 문단을 대체
    if (afterEl && afterEl._block && afterEl._block.type === 'paragraph' && type !== 'paragraph') {
      var t = afterEl.querySelector('.be-text');
      if (t && !t.textContent.trim()) { this.list.replaceChild(node, afterEl); this.focusBlock(node); this.changed(); return node; }
    }
    if (afterEl && afterEl.parentNode === this.list) this.list.insertBefore(node, afterEl.nextSibling);
    else this.list.appendChild(node);
    this.focusBlock(node);
    this.changed();
    return node;
  };
  /** 드롭 위치 계산: 마우스 Y 기준으로 바로 위에 있는 블록 (없으면 null = 맨 앞) */
  Editor.prototype.blockAtY = function (y) {
    var target = null;
    Array.prototype.forEach.call(this.list.children, function (c) {
      var r = c.getBoundingClientRect();
      if (r.top + r.height / 2 <= y) target = c;
    });
    return target;
  };

  /** 이미지 파일들을 업로드하며 순서대로 삽입한다. afterEl: 기준 블록 / undefined: 포커스 블록 뒤 / null: 맨 앞 */
  Editor.prototype.insertImages = function (files, afterEl) {
    var self = this;
    var atStart = afterEl === null;
    if (afterEl === undefined) afterEl = this.focused();
    var anchor = afterEl || null;
    Array.prototype.forEach.call(files, function (file) {
      if (file.size > 10 * 1024 * 1024) { toast(file.name + ' : 10MB 를 넘어 건너뜁니다.', true); return; }
      var b = self.newBlock('image');
      b.uploading = true; b.fileName = file.name;
      var node = self.renderBlock(b);
      var anchorText = anchor && anchor._block && anchor._block.type === 'paragraph' ? anchor.querySelector('.be-text') : null;
      if (anchorText && !anchorText.textContent.trim()) {
        self.list.replaceChild(node, anchor);            // 빈 문단 자리에 넣기
      } else if (anchor && anchor.parentNode === self.list) {
        self.list.insertBefore(node, anchor.nextSibling); // 기준 블록 뒤
      } else if (atStart && self.list.firstChild) {
        self.list.insertBefore(node, self.list.firstChild); // 맨 앞
      } else {
        self.list.appendChild(node);                       // 맨 끝
      }
      anchor = node;
      upload(file, self.opts.uploadUrl).then(function (res) {
        b.url = res.url; b.uploading = false; if (!b.alt) b.alt = res.name || '';
        var fresh = self.renderBlock(b);
        if (node.parentNode) self.list.replaceChild(fresh, node);
        self.setFocus(fresh);
        self.changed();
      }).catch(function (e) {
        toast((file.name || '이미지') + ' 업로드 실패: ' + e.message, true);
        if (node.parentNode) node.remove();
        if (!self.list.children.length) self.list.appendChild(self.renderBlock(self.newBlock('paragraph')));
      });
    });
    // 이미지 뒤에 이어 쓸 문단이 없으면 하나 추가
    if (anchor && anchor.nextElementSibling === null) {
      var p = self.renderBlock(self.newBlock('paragraph'));
      self.list.appendChild(p);
    }
    this.changed();
  };

  Editor.prototype.focusBlock = function (node) {
    var t = node.querySelector('.be-text');
    if (t) {
      t.focus();
      var range = document.createRange(); range.selectNodeContents(t); range.collapse(false);
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    } else {
      var i = node.querySelector('textarea,input');
      if (i) i.focus();
    }
    this.setFocus(node);
  };
  Editor.prototype.setFocus = function (node) {
    Array.prototype.forEach.call(this.list.children, function (c) { c.classList.remove('focus'); });
    if (node) node.classList.add('focus');
    this.updateToolbarState();
  };
  Editor.prototype.removeBlock = function (node) {
    var prev = node.previousElementSibling || node.nextElementSibling;
    node.remove();
    if (!this.list.children.length) this.list.appendChild(this.renderBlock(this.newBlock('paragraph')));
    this.focusBlock(prev || this.list.firstElementChild);
    this.changed();
  };
  Editor.prototype.move = function (node, dir) {
    if (dir < 0 && node.previousElementSibling) this.list.insertBefore(node, node.previousElementSibling);
    if (dir > 0 && node.nextElementSibling) this.list.insertBefore(node.nextElementSibling, node);
    this.changed();
  };
  /** 현재 블록을 다른 텍스트 계열 타입으로 전환 (본문 ↔ 제목 ↔ 인용) */
  Editor.prototype.convert = function (type, level) {
    var node = this.focused();
    if (!node) return;
    var b = node._block;
    if (!(b.type in TEXT_TYPES) || b.type === 'list' || b.type === 'table') return;
    var html = cleanInline(node.querySelector('.be-text'));
    var nb = this.newBlock(type);
    nb.html = html;
    if (type === 'heading') nb.level = level || 2;
    if (type === 'paragraph') nb.align = b.align || 'left';
    var fresh = this.renderBlock(nb);
    this.list.replaceChild(fresh, node);
    this.focusBlock(fresh);
    this.changed();
  };

  /* ----- 블록 렌더 ----- */
  Editor.prototype.renderBlock = function (b) {
    var self = this;
    var node = el('div', { 'class': 'be-block be-' + b.type, 'data-type': b.type });
    node._block = b;
    var handle = el('div', { 'class': 'be-handle' }, [
      el('span', { 'class': 'be-grip', title: '드래그하여 순서 변경', draggable: 'true', html: '⋮⋮' }),
      el('button', { type: 'button', text: '↑', title: '위로', on: { click: function () { self.move(node, -1); } } }),
      el('button', { type: 'button', text: '↓', title: '아래로', on: { click: function () { self.move(node, 1); } } }),
      el('button', { type: 'button', 'class': 'del', text: '✕', title: '블록 삭제', on: { click: function () { self.removeBlock(node); } } })
    ]);
    node.appendChild(handle);
    this.enableDrag(node, handle.firstChild);
    node.addEventListener('mousedown', function () { self.setFocus(node); });
    node.addEventListener('focusin', function () { self.setFocus(node); });

    switch (b.type) {
      case 'paragraph': case 'heading': case 'quote': this.renderText(node, b); break;
      case 'list': this.renderList(node, b); break;
      case 'image': this.renderImage(node, b); break;
      case 'table': this.renderTable(node, b); break;
      case 'code': this.renderCode(node, b); break;
      default: node.appendChild(el('hr'));
    }
    return node;
  };

  Editor.prototype.bindText = function (node, text, opts) {
    var self = this;
    text.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !opts.multiline) {
        e.preventDefault();
        self.addBlock('paragraph', node);
      } else if (e.key === 'Backspace' && !text.textContent && !text.querySelector('img') && self.list.children.length > 1) {
        e.preventDefault(); self.removeBlock(node);
      }
    });
    text.addEventListener('input', function () { self.changed(); });
    text.addEventListener('paste', function (e) {
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, t);
    });
  };

  Editor.prototype.renderText = function (node, b) {
    var text = el('div', {
      'class': 'be-text', contenteditable: 'true', spellcheck: 'false',
      'data-placeholder': b.type === 'heading' ? '제목' : b.type === 'quote' ? '인용문' : '내용을 입력하세요',
      html: b.html || ''
    });
    if (b.type === 'heading') node.setAttribute('data-level', b.level || 2);
    if (b.type === 'paragraph') text.style.textAlign = b.align || 'left';
    node.appendChild(text);
    this.bindText(node, text, {});
  };

  Editor.prototype.renderList = function (node, b) {
    var self = this;
    var text = el('div', { 'class': 'be-text', contenteditable: 'true', spellcheck: 'false' });
    var listEl = el(b.style === 'number' ? 'ol' : 'ul');
    (b.items && b.items.length ? b.items : ['']).forEach(function (it) { listEl.appendChild(el('li', { html: it || '' })); });
    text.appendChild(listEl);
    node.appendChild(text);
    text.addEventListener('input', function () {
      if (!text.querySelector('ul,ol')) {
        var nl = el(b.style === 'number' ? 'ol' : 'ul'); nl.appendChild(el('li', { text: text.textContent }));
        text.innerHTML = ''; text.appendChild(nl);
      }
      self.changed();
    });
    text.addEventListener('paste', function (e) {
      e.preventDefault();
      document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
    });
    text.addEventListener('keydown', function (e) {
      // 빈 항목에서 Enter → 목록 종료 후 새 문단
      if (e.key === 'Enter' && !e.shiftKey) {
        var sel = window.getSelection(); var li = sel && sel.anchorNode ? (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentNode) : null;
        while (li && li.tagName !== 'LI') li = li.parentNode;
        if (li && !li.textContent.trim() && li.parentNode.children.length > 1) { e.preventDefault(); li.remove(); self.addBlock('paragraph', node); }
      }
    });
  };
  Editor.prototype.setListStyle = function (style) {
    var node = this.focused();
    if (!node) return;
    var b = node._block;
    if (b.type !== 'list') {
      // 텍스트 블록을 목록으로 전환
      if (!(b.type in TEXT_TYPES) || b.type === 'table') { this.addBlock('list'); this.focused()._block.style = style; this.refreshList(this.focused()); return; }
      var html = cleanInline(node.querySelector('.be-text'));
      var nb = this.newBlock('list'); nb.style = style; nb.items = html ? html.split(/<br\s*\/?>/) : [''];
      var fresh = this.renderBlock(nb); this.list.replaceChild(fresh, node); this.focusBlock(fresh); this.changed(); return;
    }
    b.style = style;
    this.refreshList(node);
  };
  Editor.prototype.refreshList = function (node) {
    var b = node._block, text = node.querySelector('.be-text');
    var newList = el(b.style === 'number' ? 'ol' : 'ul');
    var cur = text.querySelector('ul,ol');
    while (cur && cur.firstChild) newList.appendChild(cur.firstChild);
    text.innerHTML = ''; text.appendChild(newList);
    this.changed();
  };

  Editor.prototype.renderImage = function (node, b) {
    var self = this;
    node.setAttribute('data-width', b.width || 'full');
    var body = el('div', { 'class': 'be-image-body' });
    node.appendChild(body);
    function draw() {
      body.innerHTML = '';
      if (b.uploading) {
        body.appendChild(el('div', { 'class': 'be-drop uploading' }, [
          el('div', { 'class': 'be-spin' }),
          el('div', { 'class': 'be-drop-title', text: '업로드 중…' }),
          el('div', { 'class': 'be-drop-sub', text: b.fileName || '' })
        ]));
        return;
      }
      if (!b.url) {
        var fileInput = el('input', { type: 'file', accept: 'image/*', multiple: 'multiple', hidden: 'hidden' });
        var urlInput = el('input', { type: 'text', 'class': 'be-inp', placeholder: '또는 이미지 URL (https://...)', style: 'width:240px' });
        var drop = el('div', { 'class': 'be-drop', on: { click: function (e) { if (e.target === drop || e.target.classList.contains('be-drop-title') || e.target.classList.contains('be-drop-sub')) fileInput.click(); } } }, [
          el('div', { 'class': 'be-drop-title', text: '여기를 클릭해 이미지를 선택하거나, 파일을 끌어다 놓으세요' }),
          el('div', { 'class': 'be-drop-sub', text: 'Ctrl+V 로 클립보드 이미지 붙여넣기도 됩니다 · JPG · PNG · GIF · WEBP, 10MB 이하' }),
          el('div', { 'class': 'row' }, [
            el('button', { type: 'button', 'class': 'be-btn pri', text: '파일 선택', on: { click: function () { fileInput.click(); } } }),
            el('button', { type: 'button', 'class': 'be-btn', text: '보관함', on: { click: function () { self.openPicker(function (url) { b.url = url; draw(); self.changed(); }); } } }),
            urlInput,
            el('button', { type: 'button', 'class': 'be-btn', text: '적용', on: { click: function () {
              var v = urlInput.value.trim();
              if (!/^(https?:\/\/|\/uploads\/)/.test(v)) { toast('http(s):// 로 시작하는 주소를 입력하세요.', true); return; }
              b.url = v; draw(); self.changed();
            } } })
          ]),
          fileInput
        ]);
        function doUpload(files) {
          if (!files.length) return;
          // 첫 파일은 이 블록에, 나머지는 뒤에 이어서
          var first = files[0], rest = Array.prototype.slice.call(files, 1);
          b.uploading = true; b.fileName = first.name; draw();
          upload(first, self.opts.uploadUrl).then(function (res) { b.url = res.url; b.uploading = false; if (!b.alt) b.alt = res.name || ''; draw(); self.changed(); if (rest.length) self.insertImages(rest, node); })
            .catch(function (e) { b.uploading = false; toast(e.message, true); draw(); });
        }
        fileInput.addEventListener('change', function () { doUpload(fileInput.files); fileInput.value = ''; });
        drop.addEventListener('dragover', function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.add('over'); });
        drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
        drop.addEventListener('drop', function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); doUpload(imageFiles(e.dataTransfer)); });
        body.appendChild(drop);
        return;
      }
      var img = el('img', { src: b.url, alt: b.alt || '' });
      var alt = el('input', { type: 'text', 'class': 'be-inp', placeholder: '대체 텍스트', value: b.alt || '', on: { input: function () { b.alt = alt.value; self.changed(); } } });
      var cap = el('input', { type: 'text', 'class': 'be-inp', placeholder: '캡션 (선택)', value: b.caption || '', on: { input: function () { b.caption = cap.value; self.changed(); } } });
      var width = el('select', { 'class': 'be-inp', title: '표시 너비', on: { change: function () { b.width = width.value; node.setAttribute('data-width', b.width); self.changed(); } } });
      [['full', '전체 너비'], ['medium', '중간'], ['small', '작게']].forEach(function (o) {
        var op = el('option', { value: o[0], text: o[1] }); if ((b.width || 'full') === o[0]) op.selected = true; width.appendChild(op);
      });
      var change = el('button', { type: 'button', 'class': 'be-btn', text: '이미지 변경', on: { click: function () { b.url = ''; draw(); self.changed(); } } });
      body.appendChild(img);
      body.appendChild(el('div', { 'class': 'be-meta' }, [alt, cap, width, change]));
    }
    draw();
  };

  Editor.prototype.renderTable = function (node, b) {
    var self = this;
    var wrap = el('div', { 'class': 'be-table-wrap' });
    var table = el('table', { 'class': 'be-text', contenteditable: 'false' });
    function build() {
      table.innerHTML = '';
      b.rows.forEach(function (row, ri) {
        var tr = el('tr');
        row.forEach(function (cell, ci) {
          var td = el(ri === 0 ? 'th' : 'td', { contenteditable: 'true', html: cell || '', 'data-r': ri, 'data-c': ci });
          td.addEventListener('input', function () { b.rows[ri][ci] = cleanInline(td); self.changed(); });
          td.addEventListener('focus', function () { self.setFocus(node); });
          td.addEventListener('paste', function (e) { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); });
          tr.appendChild(td);
        });
        table.appendChild(tr);
      });
    }
    build();
    var ctl = el('div', { 'class': 'be-table-ctl' }, [
      el('button', { type: 'button', 'class': 'be-btn', text: '+ 행', on: { click: function () { b.rows.push(b.rows[0].map(function () { return ''; })); build(); self.changed(); } } }),
      el('button', { type: 'button', 'class': 'be-btn', text: '− 행', on: { click: function () { if (b.rows.length > 1) { b.rows.pop(); build(); self.changed(); } } } }),
      el('button', { type: 'button', 'class': 'be-btn', text: '+ 열', on: { click: function () { if (b.rows[0].length < 12) { b.rows.forEach(function (r) { r.push(''); }); build(); self.changed(); } } } }),
      el('button', { type: 'button', 'class': 'be-btn', text: '− 열', on: { click: function () { if (b.rows[0].length > 1) { b.rows.forEach(function (r) { r.pop(); }); build(); self.changed(); } } } }),
      el('span', { 'class': 'be-hint', text: '첫 행은 머리글' })
    ]);
    wrap.appendChild(table);
    wrap.appendChild(ctl);
    node.appendChild(wrap);
  };

  Editor.prototype.renderCode = function (node, b) {
    var self = this;
    var lang = el('input', { type: 'text', 'class': 'be-inp be-lang', placeholder: '언어 (java, js, sql…)', value: b.lang || '', on: { input: function () { b.lang = lang.value; self.changed(); } } });
    var ta = el('textarea', { 'class': 'be-codearea', spellcheck: 'false', placeholder: '코드를 입력하세요', on: {
      input: function () { b.code = ta.value; ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 4) + 'px'; self.changed(); },
      keydown: function (e) { if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); } }
    } });
    ta.value = b.code || '';
    node.appendChild(el('div', { 'class': 'be-code-head' }, [lang]));
    node.appendChild(ta);
    setTimeout(function () { ta.style.height = (ta.scrollHeight + 4) + 'px'; }, 0);
  };

  Editor.prototype.openPicker = function (onPick) {
    var self = this;
    var grid = el('div', { 'class': 'grid' }, [el('div', { 'class': 'be-empty', text: '불러오는 중…' })]);
    var overlay = el('div', { 'class': 'be-picker' }, [
      el('div', { 'class': 'box' }, [
        el('div', { 'class': 'head' }, [el('b', { text: '이미지 보관함 (최근 30개)' }), el('button', { type: 'button', 'class': 'be-btn', text: '닫기', on: { click: function () { overlay.remove(); } } })]),
        grid
      ])
    ]);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    fetch(self.opts.recentUrl, { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (items) {
      grid.innerHTML = '';
      if (!items.length) { grid.appendChild(el('div', { 'class': 'be-empty', text: '업로드된 이미지가 없습니다.' })); return; }
      items.forEach(function (it) { grid.appendChild(el('img', { src: it.url, title: it.name, on: { click: function () { onPick(it.url); overlay.remove(); } } })); });
    }).catch(function () { grid.innerHTML = '<div class="be-empty">목록을 불러오지 못했습니다.</div>'; });
  };

  Editor.prototype.enableDrag = function (node, handle) {
    var self = this;
    handle.addEventListener('dragstart', function (e) { self.dragging = node; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'block'); });
    node.addEventListener('dragover', function (e) { if (!self.dragging || self.dragging === node) return; e.preventDefault(); node.classList.add('dragover'); });
    node.addEventListener('dragleave', function () { node.classList.remove('dragover'); });
    node.addEventListener('drop', function (e) { node.classList.remove('dragover'); if (!self.dragging || self.dragging === node) return; e.preventDefault(); self.list.insertBefore(self.dragging, node); self.dragging = null; self.changed(); });
    handle.addEventListener('dragend', function () { self.dragging = null; Array.prototype.forEach.call(self.list.children, function (c) { c.classList.remove('dragover'); }); });
  };

  /* ----- 상단 도구 모음 ----- */
  Editor.prototype.exec = function (cmd, value) {
    var node = this.focused();
    if (!node) { toast('먼저 서식을 적용할 문단을 선택하세요.'); return; }
    var editable = document.activeElement && document.activeElement.isContentEditable ? document.activeElement : node.querySelector('[contenteditable="true"]');
    if (!editable) return;
    if (this.savedRange) restoreRange(this.savedRange);
    editable.focus();
    document.execCommand('styleWithCSS', false, true);
    document.execCommand(cmd, false, value || null);
    this.savedRange = saveRange();
    this.changed();
  };
  Editor.prototype.setFontSize = function (px) {
    var node = this.focused(); if (!node) return;
    var editable = node.querySelector('[contenteditable="true"]');
    if (this.savedRange) restoreRange(this.savedRange);
    editable.focus();
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('fontSize', false, '7');
    Array.prototype.forEach.call(node.querySelectorAll('span,font'), function (s) {
      var fs = s.style ? s.style.fontSize : '';
      if (fs === 'xxx-large' || fs === '-webkit-xxx-large' || s.getAttribute('size') === '7') { s.removeAttribute('size'); s.style.fontSize = px; }
    });
    this.savedRange = saveRange();
    this.changed();
  };
  Editor.prototype.setAlign = function (align) {
    var node = this.focused(); if (!node) return;
    var b = node._block;
    if (b.type === 'paragraph') { b.align = align; node.querySelector('.be-text').style.textAlign = align; this.changed(); }
    else if (b.type === 'heading' || b.type === 'quote') { node.querySelector('.be-text').style.textAlign = align; }
    this.updateToolbarState();
  };

  Editor.prototype.buildToolbar = function (bar) {
    var self = this;
    bar.classList.add('be-toolbar');
    function btn(label, title, onClick, extra) {
      var b = el('button', { type: 'button', 'class': 'tb' + (extra && extra.cls ? ' ' + extra.cls : ''), title: title, html: label,
        on: { mousedown: function (e) { e.preventDefault(); self.savedRange = saveRange(); }, click: onClick } });
      if (extra && extra.cmd) b.setAttribute('data-cmd', extra.cmd);
      if (extra && extra.align) b.setAttribute('data-align', extra.align);
      return b;
    }
    function sep() { return el('span', { 'class': 'sep' }); }
    function dropdown(labelEl, buildMenu, cls) {
      var d = el('details', { 'class': 'dd' + (cls ? ' ' + cls : '') });
      var s = el('summary', {}, [labelEl]);
      s.addEventListener('mousedown', function () { self.savedRange = saveRange(); });
      var menu = el('div', { 'class': 'dd-menu' });
      buildMenu(menu, function () { d.removeAttribute('open'); });
      d.appendChild(s); d.appendChild(menu);
      return d;
    }
    // 공용: 열린 드롭다운 닫기
    document.addEventListener('click', function (e) {
      Array.prototype.forEach.call(bar.querySelectorAll('details.dd[open]'), function (d) { if (!d.contains(e.target)) d.removeAttribute('open'); });
    });

    // 1) 이미지: 버튼 클릭 → 곧바로 파일 선택(여러 장), 캐럿 → 보관함 / URL
    var tbFile = el('input', { type: 'file', accept: 'image/*', multiple: 'multiple', hidden: 'hidden' });
    tbFile.addEventListener('change', function () { if (tbFile.files.length) self.insertImages(tbFile.files); tbFile.value = ''; });
    bar.appendChild(tbFile);
    var imgGroup = el('span', { 'class': 'tb-group' });
    imgGroup.appendChild(btn('<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span class="lbl">사진</span>', '이미지 업로드 (여러 장 선택 가능 · 본문에 붙여넣기/드래그도 됩니다)', function () { tbFile.click(); }, { cls: 'img' }));
    imgGroup.appendChild(dropdown(el('span', { html: '<i class="car"></i>' }), function (m, close) {
      m.appendChild(el('a', { text: '내 컴퓨터에서 업로드', on: { click: function () { close(); tbFile.click(); } } }));
      m.appendChild(el('a', { text: '보관함(최근 업로드)에서 선택', on: { click: function () { close(); self.openPicker(function (url) { var b = self.newBlock('image'); b.url = url; var n = self.renderBlock(b); var f = self.focused(); if (f && f.parentNode === self.list) self.list.insertBefore(n, f.nextSibling); else self.list.appendChild(n); self.setFocus(n); self.changed(); }); } } }));
      m.appendChild(el('a', { text: '이미지 주소(URL)로 넣기', on: { click: function () { close(); var url = window.prompt('이미지 주소 (https://...)', 'https://'); if (!url) return; if (!/^(https?:\/\/|\/uploads\/)/.test(url.trim())) { toast('http(s):// 로 시작하는 주소를 입력하세요.', true); return; } var b = self.newBlock('image'); b.url = url.trim(); var n = self.renderBlock(b); var f = self.focused(); if (f && f.parentNode === self.list) self.list.insertBefore(n, f.nextSibling); else self.list.appendChild(n); self.setFocus(n); self.changed(); } } }));
      m.appendChild(el('a', { text: '빈 이미지 칸 추가(나중에 채우기)', on: { click: function () { close(); self.addBlock('image'); } } }));
    }, 'ins caret-only'));
    bar.appendChild(imgGroup);

    // 2) 문단 모양: 본문 / 제목1~3 / 인용
    var styleLabel = el('span', { 'class': 'lbl', text: '본문' });
    this.styleLabel = styleLabel;
    bar.appendChild(dropdown(el('span', {}, [styleLabel, el('i', { 'class': 'car' })]), function (m, close) {
      [['paragraph', 0, '본문'], ['heading', 1, '제목 1'], ['heading', 2, '제목 2'], ['heading', 3, '제목 3'], ['quote', 0, '인용구']].forEach(function (o) {
        m.appendChild(el('a', { text: o[2], 'class': 'st-' + o[0] + o[1], on: { click: function () { close(); self.convert(o[0], o[1]); } } }));
      });
    }, 'style'));

    // 3) 글자 크기 (글꼴은 고정)
    var sizeLabel = el('span', { 'class': 'lbl', text: '크기' });
    bar.appendChild(dropdown(el('span', {}, [sizeLabel, el('i', { 'class': 'car' })]), function (m, close) {
      FONT_SIZES.forEach(function (s) { m.appendChild(el('a', { text: s.replace('px', '') + ' px', style: 'font-size:' + Math.min(parseInt(s, 10), 20) + 'px', on: { click: function () { close(); self.setFontSize(s); } } })); });
    }, 'size'));
    bar.appendChild(sep());

    // 4) 기본 서식
    bar.appendChild(btn('<b>B</b>', '굵게 (Ctrl+B)', function () { self.exec('bold'); }, { cmd: 'bold' }));
    bar.appendChild(btn('<i>I</i>', '기울임 (Ctrl+I)', function () { self.exec('italic'); }, { cmd: 'italic' }));
    bar.appendChild(btn('<u>U</u>', '밑줄 (Ctrl+U)', function () { self.exec('underline'); }, { cmd: 'underline' }));
    bar.appendChild(btn('<s>T</s>', '취소선', function () { self.exec('strikeThrough'); }, { cmd: 'strikeThrough' }));
    // 글자색
    bar.appendChild(dropdown(el('span', { html: '<span class="ic-color">T<i id="beColorBar"></i></span><i class="car"></i>' }), function (m) {
      var pal = el('div', { 'class': 'pal' });
      COLORS.forEach(function (c) { pal.appendChild(el('span', { 'class': 'sw', style: 'background:' + c, title: c, on: { mousedown: function (e) { e.preventDefault(); }, click: function () { self.exec('foreColor', c); document.getElementById('beColorBar').style.background = c; } } })); });
      var pick = el('input', { type: 'color', value: '#111827', on: { input: function () { self.exec('foreColor', pick.value); } } });
      pal.appendChild(pick);
      m.appendChild(el('div', { 'class': 'pal-title', text: '글자색' })); m.appendChild(pal);
    }, 'color'));
    // 배경색
    bar.appendChild(dropdown(el('span', { html: '<span class="ic-bg">T</span><i class="car"></i>' }), function (m) {
      var pal = el('div', { 'class': 'pal' });
      BG_COLORS.forEach(function (c) { pal.appendChild(el('span', { 'class': 'sw' + (c === 'transparent' ? ' none' : ''), style: 'background:' + c, title: c === 'transparent' ? '배경 없음' : c, on: { mousedown: function (e) { e.preventDefault(); }, click: function () { self.exec('hiliteColor', c === 'transparent' ? 'transparent' : c); } } })); });
      m.appendChild(el('div', { 'class': 'pal-title', text: '글자 배경' })); m.appendChild(pal);
    }, 'color'));
    bar.appendChild(sep());

    // 5) 정렬
    [['left', '<svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h12M3 18h18"/></svg>', '왼쪽 정렬'],
     ['center', '<svg viewBox="0 0 24 24"><path d="M3 6h18M6 12h12M3 18h18"/></svg>', '가운데 정렬'],
     ['right', '<svg viewBox="0 0 24 24"><path d="M3 6h18M9 12h12M3 18h18"/></svg>', '오른쪽 정렬']].forEach(function (a) {
      bar.appendChild(btn(a[1], a[2], function () { self.setAlign(a[0]); }, { align: a[0] }));
    });
    bar.appendChild(sep());

    // 6) 콘텐츠 삽입: 인용 · 표 · 링크 · 목록 · 구분선 · 코드
    bar.appendChild(btn('<span class="q">66</span>', '인용구', function () { var f = self.focused(); if (f && f._block.type !== 'quote' && (f._block.type in TEXT_TYPES) && f._block.type !== 'list' && f._block.type !== 'table') self.convert('quote'); else self.addBlock('quote'); }));
    bar.appendChild(btn('<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/></svg>', '표 삽입', function () { self.addBlock('table'); }));
    bar.appendChild(btn('<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/></svg>', '링크', function () {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed) { toast('링크를 걸 텍스트를 먼저 선택하세요.', true); return; }
      var url = window.prompt('링크 주소 (https://...)', 'https://');
      if (url) self.exec('createLink', url);
    }));
    bar.appendChild(dropdown(el('span', { html: '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg><i class="car"></i>' }), function (m, close) {
      m.appendChild(el('a', { text: '• 글머리 기호 목록', on: { click: function () { close(); self.setListStyle('bullet'); } } }));
      m.appendChild(el('a', { text: '1. 번호 목록', on: { click: function () { close(); self.setListStyle('number'); } } }));
    }));
    bar.appendChild(btn('<span class="dash">—</span>', '구분선', function () { self.addBlock('divider'); self.addBlock('paragraph'); }));
    bar.appendChild(dropdown(el('span', { html: '<span class="more">···</span>' }), function (m, close) {
      m.appendChild(el('a', { text: '코드 블록', on: { click: function () { close(); self.addBlock('code'); } } }));
      m.appendChild(el('a', { text: '서식 지우기', on: { click: function () { close(); self.exec('removeFormat'); self.exec('unlink'); } } }));
      m.appendChild(el('a', { text: '현재 블록 삭제', on: { click: function () { close(); var f = self.focused(); if (f) self.removeBlock(f); } } }));
    }, 'more'));
    this.toolbar = bar;
  };

  Editor.prototype.updateToolbarState = function () {
    if (!this.toolbar) return;
    var focused = this.focused();
    var b = focused ? focused._block : null;
    Array.prototype.forEach.call(this.toolbar.querySelectorAll('[data-cmd]'), function (btn) {
      var on = false; try { on = document.queryCommandState(btn.getAttribute('data-cmd')); } catch (e) { on = false; }
      btn.classList.toggle('on', !!on);
    });
    var align = b && b.type === 'paragraph' ? (b.align || 'left') : (focused && focused.querySelector('.be-text') ? (focused.querySelector('.be-text').style.textAlign || 'left') : '');
    Array.prototype.forEach.call(this.toolbar.querySelectorAll('[data-align]'), function (btn) { btn.classList.toggle('on', btn.getAttribute('data-align') === align); });
    if (this.styleLabel) {
      this.styleLabel.textContent = !b ? '본문' : b.type === 'heading' ? '제목 ' + (b.level || 2) : b.type === 'quote' ? '인용구' : b.type === 'list' ? '목록' : b.type === 'table' ? '표' : b.type === 'code' ? '코드' : b.type === 'image' ? '이미지' : '본문';
    }
  };

  /* ----- 직렬화 ----- */
  Editor.prototype.getBlocks = function () {
    var out = [];
    Array.prototype.forEach.call(this.list.children, function (node) {
      var b = node._block, text = node.querySelector('.be-text');
      switch (b.type) {
        case 'paragraph': out.push({ type: 'paragraph', align: b.align || 'left', html: cleanInline(text) }); break;
        case 'heading': out.push({ type: 'heading', level: b.level || 2, html: cleanInline(text) }); break;
        case 'quote': out.push({ type: 'quote', html: cleanInline(text) }); break;
        case 'list': {
          var items = [];
          Array.prototype.forEach.call(text.querySelectorAll('li'), function (li) { var h = cleanInline(li); if (h) items.push(h); });
          out.push({ type: 'list', style: b.style || 'bullet', items: items }); break;
        }
        case 'image': if (b.url) out.push({ type: 'image', url: b.url, alt: b.alt || '', caption: b.caption || '', width: b.width || 'full' }); break;
        case 'table': {
          var rows = b.rows.map(function (r) { return r.map(function (c) { return c || ''; }); });
          var hasContent = rows.some(function (r) { return r.some(function (c) { return c.replace(/<br\s*\/?>/g, '').trim(); }); });
          if (hasContent) out.push({ type: 'table', rows: rows }); break;
        }
        case 'code': if ((b.code || '').trim()) out.push({ type: 'code', lang: b.lang || '', code: b.code }); break;
        case 'divider': out.push({ type: 'divider' }); break;
      }
    });
    return out.filter(function (b) {
      if (b.type === 'image' || b.type === 'divider' || b.type === 'table' || b.type === 'code') return true;
      if (b.type === 'list') return b.items.length > 0;
      return b.html.replace(/<br\s*\/?>/g, '').trim().length > 0;
    });
  };

  global.BlockEditor = {
    mount: function (container, opts) { return new Editor(container, opts); },
    upload: upload,
    cleanInline: cleanInline
  };
})(window);
