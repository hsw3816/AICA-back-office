package egovframework.backoffice.template;

import egovframework.backoffice.auth.CurrentAdmin;
import egovframework.backoffice.common.BusinessException;
import egovframework.backoffice.common.NotFoundException;
import egovframework.backoffice.post.BlockContent;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 글쓰기 템플릿 — 편집기가 fetch(JSON)로 저장·조회·삭제한다. */
@RestController
@RequestMapping("/admin/templates")
public class PostTemplateController {

    private static final int MAX_TEMPLATES = 100;
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final PostTemplateMapper mapper;
    private final BlockContent blocks;

    public PostTemplateController(PostTemplateMapper mapper, BlockContent blocks) {
        this.mapper = mapper;
        this.blocks = blocks;
    }

    /** 요청 본문: { name, titleHint, categoryId, blocksJson } */
    public record TemplateRequest(String name, String titleHint, Long categoryId, String blocksJson) { }

    @GetMapping
    public List<Map<String, Object>> list() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (PostTemplate t : mapper.findAll(MAX_TEMPLATES)) {
            List<Map<String, Object>> parsed = blocks.parse(t.getBlocksJson());
            Map<String, Object> m = summary(t);
            m.put("blockCount", parsed.size());
            m.put("preview", blocks.plainText(parsed, 90));
            m.put("thumbnailUrl", blocks.firstImageUrl(parsed));
            out.add(m);
        }
        return out;
    }

    @GetMapping("/{id}")
    public Map<String, Object> get(@PathVariable Long id) {
        PostTemplate t = find(id);
        Map<String, Object> m = summary(t);
        m.put("blocks", blocks.parse(t.getBlocksJson()));
        return m;
    }

    @PostMapping
    @Transactional
    public Map<String, Object> create(@RequestBody TemplateRequest req, @AuthenticationPrincipal CurrentAdmin me) {
        if (mapper.count() >= MAX_TEMPLATES) {
            throw new BusinessException("템플릿은 최대 " + MAX_TEMPLATES + "개까지 저장할 수 있습니다. 사용하지 않는 템플릿을 삭제해 주세요.");
        }
        PostTemplate t = new PostTemplate();
        apply(t, req);
        t.setCreatedBy(me.getId());
        mapper.insert(t);
        return summary(find(t.getId()));
    }

    @PutMapping("/{id}")
    @Transactional
    public Map<String, Object> update(@PathVariable Long id, @RequestBody TemplateRequest req) {
        PostTemplate t = find(id);
        apply(t, req);
        mapper.update(t);
        return summary(find(id));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public Map<String, Object> delete(@PathVariable Long id) {
        find(id);
        mapper.delete(id);
        return Map.of("ok", true);
    }

    private void apply(PostTemplate t, TemplateRequest req) {
        String name = req.name() == null ? "" : req.name().trim();
        if (name.isEmpty()) {
            throw new BusinessException("템플릿 이름을 입력하세요.");
        }
        if (name.length() > 100) {
            throw new BusinessException("템플릿 이름은 100자 이내입니다.");
        }
        List<Map<String, Object>> parsed = blocks.sanitize(blocks.parse(req.blocksJson()));
        if (parsed.isEmpty()) {
            throw new BusinessException("저장할 본문이 비어 있습니다. 블록을 하나 이상 작성한 뒤 템플릿으로 저장하세요.");
        }
        t.setName(name);
        String hint = req.titleHint() == null ? "" : req.titleHint().trim();
        t.setTitleHint(hint.length() > 200 ? hint.substring(0, 200) : hint);
        t.setCategoryId(req.categoryId());
        t.setBlocksJson(blocks.serialize(parsed));
    }

    private PostTemplate find(Long id) {
        PostTemplate t = mapper.findById(id);
        if (t == null) {
            throw new NotFoundException("템플릿을 찾을 수 없습니다.");
        }
        return t;
    }

    private static Map<String, Object> summary(PostTemplate t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.getId());
        m.put("name", t.getName());
        m.put("titleHint", t.getTitleHint());
        m.put("categoryId", t.getCategoryId());
        m.put("categoryName", t.getCategoryName());
        m.put("creatorName", t.getCreatorName());
        m.put("createdAt", t.getCreatedAt() == null ? null : t.getCreatedAt().format(TIME));
        m.put("updatedAt", t.getUpdatedAt() == null ? null : t.getUpdatedAt().format(TIME));
        return m;
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Map<String, String>> business(BusinessException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<Map<String, String>> notFound(NotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
    }
}
