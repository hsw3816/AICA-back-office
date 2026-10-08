package egovframework.backoffice.post;

import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class Post {
    private Long id;
    private Long categoryId;
    /** 세부 카테고리(후기 → 생활·수업… / 기수별 → 3~5기·6기·7기). 없으면 NULL */
    private Long subCategoryId;
    private String title;
    private String summary;
    private String thumbnailUrl;
    /** AUTO: 본문 첫 이미지 사용 / MANUAL: 직접 지정 */
    private String thumbnailMode;
    private PostStatus status;
    private String blocksJson;
    /** 화면 레이아웃 설정 JSON(PostLayout). NULL 이면 기본 레이아웃 */
    private String layoutJson;
    private Long authorId;
    private long viewCount;
    private LocalDateTime publishedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;
    /** 휴지통 이동 직전 상태(휴지통 목록 '삭제 전 게시중' 표시용). 복원해도 자동으로 되돌리지 않는다 */
    private PostStatus statusBeforeTrash;

    // 조인 컬럼
    private String categoryName;
    private String categorySlug;
    private String subCategoryName;
    private String subCategorySlug;

    /** 목록 표시용: "후기 › 생활" */
    public String getCategoryPath() {
        if (categoryName == null) {
            return null;
        }
        return subCategoryName == null ? categoryName : categoryName + " › " + subCategoryName;
    }
    private String authorName;
}
