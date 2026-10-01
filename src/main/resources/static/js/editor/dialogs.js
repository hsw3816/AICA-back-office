/*
 * AICA 블록 에디터 — dialogs: 이미지 보관함 선택창, 링크 넣기/수정 대화상자
 */
(function (BE, global) {
  'use strict';
  var el = BE.el, csrf = BE.csrf, toast = BE.toast, saveRange = BE.saveRange, restoreRange = BE.restoreRange,
      escapeHtml = BE.escapeHtml, fontName = BE.fontName, cleanInline = BE.cleanInline, upload = BE.upload,
      prepareImage = BE.prepareImage, validUrl = BE.validUrl, hasFiles = BE.hasFiles, imageFiles = BE.imageFiles, caretAt = BE.caretAt,
      FONT_SIZES = BE.FONT_SIZES, COLORS = BE.COLORS, BG_COLORS = BE.BG_COLORS, TEXT_TYPES = BE.TEXT_TYPES, FONTS = BE.FONTS, FONT_OK = BE.FONT_OK;
  var Editor = BE.Editor, anchorOfSelection = BE.anchorOfSelection;

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


  Editor.prototype.openLinkDialog = function (existing) {
    var self = this;
    var node = this.focused();
    if (!node || !node.querySelector('.be-text')) { toast('링크를 넣을 문단을 먼저 선택하세요.', true); return; }
    var text = node.querySelector('.be-text');
    if (this.savedRange) restoreRange(this.savedRange);
    var a = existing || anchorOfSelection(text);
    var range = saveRange();
    var selectedText = a ? a.textContent : (range ? range.toString() : '');
    var urlInp = el('input', { type: 'url', 'class': 'be-inp', placeholder: 'https://', value: a ? (a.getAttribute('href') || '') : '', maxlength: '1000', style: 'width:100%' });
    var txtInp = el('input', { type: 'text', 'class': 'be-inp', placeholder: '비우면 주소가 그대로 표시됩니다', value: selectedText, maxlength: '300', style: 'width:100%' });
    var newTab = el('input', { type: 'checkbox' }); newTab.checked = a ? a.getAttribute('target') === '_blank' : true;
    var err = el('div', { 'class': 'be-dlg-err' });
    var overlay = el('div', { 'class': 'be-picker be-dlg' });
    function close() { overlay.remove(); document.removeEventListener('keydown', onKey); text.focus(); if (range) restoreRange(range); }
    function apply() {
      var url = urlInp.value.trim();
      if (/^www\./i.test(url)) url = 'https://' + url;
      if (!validUrl(url)) { err.textContent = '올바른 http 또는 https 주소를 입력하세요.'; urlInp.focus(); return; }
      var label = txtInp.value.trim() || url;
      overlay.remove(); document.removeEventListener('keydown', onKey);
      text.focus();
      if (a && a.parentNode) {
        a.setAttribute('href', url); a.textContent = label;
        if (newTab.checked) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); } else { a.removeAttribute('target'); a.removeAttribute('rel'); }
      } else {
        if (range) restoreRange(range);
        var html = '<a href="' + escapeHtml(url).replace(/"/g, '&quot;') + '"' + (newTab.checked ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + escapeHtml(label) + '</a>';
        document.execCommand('insertHTML', false, html);
      }
      self.savedRange = saveRange();
      self.changed();
    }
    function unlink() {
      overlay.remove(); document.removeEventListener('keydown', onKey);
      if (a && a.parentNode) { var parent = a.parentNode; while (a.firstChild) parent.insertBefore(a.firstChild, a); parent.removeChild(a); self.changed(); }
      text.focus();
    }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } if (e.key === 'Enter' && (e.target === urlInp || e.target === txtInp)) { e.preventDefault(); apply(); } }
    var foot = [el('button', { type: 'button', 'class': 'be-btn', text: '취소', on: { click: close } }), el('button', { type: 'button', 'class': 'be-btn pri', text: a ? '수정' : '링크 적용', on: { click: apply } })];
    if (a) foot.unshift(el('button', { type: 'button', 'class': 'be-btn danger', text: '링크 제거', on: { click: unlink } }));
    overlay.appendChild(el('div', { 'class': 'box' }, [
      el('div', { 'class': 'head' }, [el('b', { text: a ? '링크 수정' : '링크 넣기' }), el('button', { type: 'button', 'class': 'be-btn', text: '닫기', on: { click: close } })]),
      el('div', { 'class': 'be-dlg-body' }, [
        el('label', { 'class': 'be-dlg-lbl', text: '연결 주소' }), urlInp,
        el('label', { 'class': 'be-dlg-lbl', text: '표시할 문구' }), txtInp,
        el('label', { 'class': 'be-dlg-chk' }, [newTab, el('span', { text: ' 새 탭에서 열기' })]),
        err
      ]),
      el('div', { 'class': 'be-dlg-foot' }, foot)
    ]));
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    setTimeout(function () { urlInp.focus(); urlInp.select(); }, 0);
  };
})(window.BlockEditor = window.BlockEditor || {}, window);
