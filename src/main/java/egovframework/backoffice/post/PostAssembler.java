package egovframework.backoffice.post;

import egovframework.backoffice.category.CategoryService;
import egovframework.backoffice.editor.BlockContent;
import egovframework.backoffice.editor.PostLayout;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/** 폼 입력 → 게시물 반영 규칙(정화·요약 자동 생성·대표 이미지). 저장·미리보기·버전 복원이 함께 쓴다. */
@Component
public class PostAssembler {

    private final BlockContent blocks;
    private final CategoryService categories;

    public PostAssembler(BlockContent blocks, CategoryService categories) {
        this.blocks = blocks;
        this.categories = categories;
    }

    public Post apply(Post post, PostForm form) {
        List<Map<String, Object>> parsed = blocks.sanitize(blocks.parse(form.getBlocksJson()));
        post.setTitle(form.getTitle().trim());
        post.setCategoryId(form.getCategoryId());
        // 세부 카테고리는 선택한 카테고리의 하위일 때만 저장(카테고리를 바꾸면 자동으로 비워진다)
        post.setSubCategoryId(categories.validSubCategory(form.getCategoryId(), form.getSubCategoryId()));
        post.setStatus(form.getStatus());
        post.setBlocksJson(blocks.serialize(parsed));
        post.setLayoutJson(PostLayout.normalize(form.getLayoutJson()));

        String summary = form.getSummary() == null ? "" : form.getSummary().trim();
        post.setSummary(summary.isEmpty() ? blocks.plainText(parsed, 160) : summary);

        boolean manual = "MANUAL".equals(form.getThumbnailMode())
                && form.getThumbnailUrl() != null && !form.getThumbnailUrl().isBlank();
        post.setThumbnailMode(manual ? "MANUAL" : "AUTO");
        post.setThumbnailUrl(manual ? form.getThumbnailUrl().trim() : blocks.firstImageUrl(parsed));
        return post;
    }

    /** 저장된 레이아웃 JSON → 레이아웃 객체(없으면 기본값) */
    public PostLayout layoutOf(String layoutJson) {
        return PostLayout.parse(layoutJson);
    }

    /**
     * 목차(사이드바 toc 위젯용): 본문의 제목 블록을 순서대로 {index, level, text}. index 는 blocks.html 이 제목에 붙이는 id(h-{index})와 같다.
     */
    public List<Map<String, Object>> toc(List<Map<String, Object>> parsed) {
        List<Map<String, Object>> out = new java.util.ArrayList<>();
        for (int i = 0; i < parsed.size(); i++) {
            Map<String, Object> b = parsed.get(i);
            if (!"heading".equals(b.get("type"))) {
                continue;
            }
            String text = org.jsoup.Jsoup.parse(String.valueOf(b.getOrDefault("html", ""))).text().trim();
            if (text.isEmpty()) {
                continue;
            }
            Object lv = b.get("level");
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("index", i);
            m.put("level", lv instanceof Number num ? num.intValue() : 2);
            m.put("text", text.length() > 60 ? text.substring(0, 60) + "…" : text);
            out.add(m);
        }
        return out;
    }

    /** 저장된 JSON → 블록 목록 (미리보기·이력 응답용) */
    public List<Map<String, Object>> blocksOf(String blocksJson) {
        return blocks.parse(blocksJson);
    }
}
