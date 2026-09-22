package egovframework.backoffice.post;

import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class Post {
    private Long id;
    private Long categoryId;
    private String title;
    private String summary;
    private String thumbnailUrl;
    /** AUTO: 본문 첫 이미지 사용 / MANUAL: 직접 지정 */
    private String thumbnailMode;
    private PostStatus status;
    private String blocksJson;
    private Long authorId;
    private long viewCount;
    private LocalDateTime publishedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;

    // 조인 컬럼
    private String categoryName;
    private String categorySlug;
    private String authorName;
}
