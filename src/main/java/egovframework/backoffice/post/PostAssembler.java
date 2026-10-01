package egovframework.backoffice.post;

import egovframework.backoffice.editor.BlockContent;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/** 폼 입력 → 게시물 반영 규칙(정화·요약 자동 생성·대표 이미지). 저장·미리보기·버전 복원이 함께 쓴다. */
@Component
public class PostAssembler {

    private final BlockContent blocks;

    public PostAssembler(BlockContent blocks) {
        this.blocks = blocks;
    }

    public Post apply(Post post, PostForm form) {
        List<Map<String, Object>> parsed = blocks.sanitize(blocks.parse(form.getBlocksJson()));
        post.setTitle(form.getTitle().trim());
        post.setCategoryId(form.getCategoryId());
        post.setStatus(form.getStatus());
        post.setBlocksJson(blocks.serialize(parsed));

        String summary = form.getSummary() == null ? "" : form.getSummary().trim();
        post.setSummary(summary.isEmpty() ? blocks.plainText(parsed, 160) : summary);

        boolean manual = "MANUAL".equals(form.getThumbnailMode())
                && form.getThumbnailUrl() != null && !form.getThumbnailUrl().isBlank();
        post.setThumbnailMode(manual ? "MANUAL" : "AUTO");
        post.setThumbnailUrl(manual ? form.getThumbnailUrl().trim() : blocks.firstImageUrl(parsed));
        return post;
    }

    /** 저장된 JSON → 블록 목록 (미리보기·이력 응답용) */
    public List<Map<String, Object>> blocksOf(String blocksJson) {
        return blocks.parse(blocksJson);
    }
}
