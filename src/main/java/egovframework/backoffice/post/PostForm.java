package egovframework.backoffice.post;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PostForm {
    private Long id;

    @NotBlank(message = "제목을 입력하세요.")
    @Size(max = 200, message = "제목은 200자 이내입니다.")
    private String title;

    private Long categoryId;
    private Long subCategoryId;

    @Size(max = 500, message = "요약은 500자 이내입니다.")
    private String summary;

    /** AUTO / MANUAL */
    @NotBlank
    private String thumbnailMode = "AUTO";

    private String thumbnailUrl;

    @NotNull
    private PostStatus status = PostStatus.DRAFT;

    /** 블록 에디터가 hidden input 으로 전송하는 JSON 배열 */
    @NotBlank(message = "본문을 입력하세요.")
    private String blocksJson = "[]";

    /** 레이아웃 패널이 hidden input 으로 전송하는 JSON(PostLayout) — 비우면 기본 레이아웃 */
    private String layoutJson;

    public static PostForm from(Post p) {
        PostForm f = new PostForm();
        f.setId(p.getId());
        f.setTitle(p.getTitle());
        f.setCategoryId(p.getCategoryId());
        f.setSubCategoryId(p.getSubCategoryId());
        f.setSummary(p.getSummary());
        f.setThumbnailMode(p.getThumbnailMode());
        f.setThumbnailUrl(p.getThumbnailUrl());
        f.setStatus(p.getStatus());
        f.setBlocksJson(p.getBlocksJson());
        f.setLayoutJson(p.getLayoutJson());
        return f;
    }
}
