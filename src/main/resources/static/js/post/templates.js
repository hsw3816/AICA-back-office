/*
 * 글쓰기 화면 — 템플릿 패널 (우측): 목록 카드 · 불러오기/뒤에 추가 · 이름 변경 · 삭제 · 현재 글을 템플릿으로 저장
 * 서버: template/PostTemplateController (/admin/templates JSON)
 */
(function (global) {
  'use strict';
  var P = global.PostEditorPage = global.PostEditorPage || {};
  P.modules = P.modules || [];
  P.modules.push(function (ctx, cfg) {
    var form = ctx.form, titleEl = ctx.titleEl, editor = ctx.editor, markDirty = ctx.markDirty, esc = ctx.esc;
    var templatesUrl = cfg.templatesUrl;
    var tplPanel = document.getElementById('templatePanel');
    var tplList = document.getElementById('templateList');
    var tplCount = document.getElementById('templateCount');
    function tplHeaders() { var h = csrfHeaders(); h['Content-Type'] = 'application/json'; return h; }
    function tplFetch(url, opts) {
      return fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {})).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) throw new Error(body.message || ('요청 실패 (' + r.status + ')'));
          return body;
        });
      });
    }
    function openTemplates() { tplPanel.hidden = false; document.body.classList.add('ed-side-open'); loadTemplates(); }
    function closeTemplates() { tplPanel.hidden = true; document.body.classList.remove('ed-side-open'); }
    document.getElementById('btnTemplate').addEventListener('click', function () { if (tplPanel.hidden) openTemplates(); else closeTemplates(); });
    document.getElementById('templateClose').addEventListener('click', closeTemplates);
    function loadTemplates() {
      tplList.innerHTML = '<div class="ed-side-empty">불러오는 중…</div>';
      tplFetch(templatesUrl).then(function (list) {
        tplCount.textContent = '총 ' + list.length + '개';
        tplList.innerHTML = '';
        if (!list.length) { tplList.innerHTML = '<div class="ed-side-empty">저장된 템플릿이 없습니다.<br>글을 구성한 뒤 아래 버튼으로 저장해 보세요.</div>'; return; }
        list.forEach(function (t) {
          var card = document.createElement('div'); card.className = 'tpl-card';
          card.innerHTML =
            (t.thumbnailUrl ? '<img class="tpl-thumb" src="' + esc(t.thumbnailUrl) + '" alt="">' : '<div class="tpl-thumb tpl-thumb-empty">' + esc((t.name || '?').charAt(0)) + '</div>') +
            '<div class="tpl-body">' +
            '  <div class="tpl-cat">' + esc(t.categoryName || '템플릿') + '</div>' +
            '  <div class="tpl-name">' + esc(t.name) + '</div>' +
            '  <div class="tpl-prev">' + esc(t.preview || (t.titleHint || '')) + '</div>' +
            '  <div class="tpl-meta">블록 ' + t.blockCount + ' · ' + esc(t.updatedAt || '') + (t.creatorName ? ' · ' + esc(t.creatorName) : '') + '</div>' +
            '  <div class="tpl-actions">' +
            '    <button type="button" class="be-btn pri" data-act="use">불러오기</button>' +
            '    <button type="button" class="be-btn" data-act="append">뒤에 추가</button>' +
            '    <button type="button" class="be-btn" data-act="rename" title="이름 바꾸기">이름</button>' +
            '    <button type="button" class="be-btn danger" data-act="del">삭제</button>' +
            '  </div>' +
            '</div>';
          card.addEventListener('click', function (e) {
            var act = e.target.getAttribute && e.target.getAttribute('data-act'); if (!act) return;
            if (act === 'use') applyTemplate(t, false);
            else if (act === 'append') applyTemplate(t, true);
            else if (act === 'rename') renameTemplate(t);
            else if (act === 'del') deleteTemplate(t);
          });
          tplList.appendChild(card);
        });
      }).catch(function (e) { tplList.innerHTML = '<div class="ed-side-empty">' + esc(e.message) + '</div>'; });
    }
    function applyTemplate(t, append) {
      tplFetch(templatesUrl + '/' + t.id).then(function (full) {
        var hasContent = titleEl.value.trim() || !editor.isEmpty();
        if (!append && hasContent && !window.confirm('현재 작성 중인 제목·본문을 "' + full.name + '" 템플릿 내용으로 바꿀까요?\n(뒤에 이어 붙이려면 취소 후 "뒤에 추가"를 누르세요)')) return;
        if (append) {
          editor.appendBlocks(full.blocks || []);
        } else {
          editor.setBlocks(full.blocks || []);
          if (full.titleHint && !titleEl.value.trim()) titleEl.value = full.titleHint;
          if (full.categoryId) form.querySelector('[name="categoryId"]').value = full.categoryId;
        }
        markDirty();
        notify('템플릿 "' + full.name + '"' + (append ? '을(를) 뒤에 추가했습니다.' : '을(를) 불러왔습니다.'));
        closeTemplates();
      }).catch(function (e) { notify(e.message, true); });
    }
    function askName(title, initial, onOk) {
      var overlay = document.createElement('div'); overlay.className = 'be-picker be-dlg';
      overlay.innerHTML = '<div class="box"><div class="head"><b>' + esc(title) + '</b><button type="button" class="be-btn" data-x>닫기</button></div>' +
        '<div class="be-dlg-body"><label class="be-dlg-lbl">템플릿 이름</label><input type="text" class="be-inp" maxlength="100" style="width:100%" placeholder="예: 공지사항 기본형 · 행사 후기 · FAQ 답변">' +
        '<div class="be-dlg-err"></div></div>' +
        '<div class="be-dlg-foot"><button type="button" class="be-btn" data-x>취소</button><button type="button" class="be-btn pri" data-ok>저장</button></div></div>';
      document.body.appendChild(overlay);
      var inp = overlay.querySelector('input'); inp.value = initial || '';
      function close() { overlay.remove(); }
      function ok() { var v = inp.value.trim(); if (!v) { overlay.querySelector('.be-dlg-err').textContent = '이름을 입력하세요.'; inp.focus(); return; } close(); onOk(v); }
      overlay.querySelectorAll('[data-x]').forEach(function (b) { b.addEventListener('click', close); });
      overlay.querySelector('[data-ok]').addEventListener('click', ok);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); ok(); } if (e.key === 'Escape') close(); });
      overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
      setTimeout(function () { inp.focus(); inp.select(); }, 0);
    }
    document.getElementById('templateSave').addEventListener('click', function () {
      if (editor.isEmpty()) { notify('본문이 비어 있습니다. 블록을 작성한 뒤 저장하세요.', true); return; }
      askName('현재 글을 템플릿으로 저장', titleEl.value.trim(), function (name) {
        tplFetch(templatesUrl, { method: 'POST', headers: tplHeaders(), body: JSON.stringify({
          name: name, titleHint: titleEl.value.trim(), categoryId: form.querySelector('[name="categoryId"]').value || null,
          blocksJson: JSON.stringify(editor.getBlocks())
        }) }).then(function () { notify('템플릿 "' + name + '"을(를) 저장했습니다.'); loadTemplates(); })
          .catch(function (e) { notify(e.message, true); });
      });
    });
    function renameTemplate(t) {
      tplFetch(templatesUrl + '/' + t.id).then(function (full) {
        askName('템플릿 이름 바꾸기', full.name, function (name) {
          tplFetch(templatesUrl + '/' + t.id, { method: 'PUT', headers: tplHeaders(), body: JSON.stringify({
            name: name, titleHint: full.titleHint, categoryId: full.categoryId, blocksJson: JSON.stringify(full.blocks || [])
          }) }).then(function () { loadTemplates(); }).catch(function (e) { notify(e.message, true); });
        });
      }).catch(function (e) { notify(e.message, true); });
    }
    function deleteTemplate(t) {
      if (!window.confirm('템플릿 "' + t.name + '"을(를) 삭제할까요? 되돌릴 수 없습니다.')) return;
      tplFetch(templatesUrl + '/' + t.id, { method: 'DELETE', headers: csrfHeaders() })
        .then(function () { notify('템플릿을 삭제했습니다.'); loadTemplates(); }).catch(function (e) { notify(e.message, true); });
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !tplPanel.hidden) closeTemplates(); });

  });
})(window);
