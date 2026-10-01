package egovframework.backoffice.template;

import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

/** 글쓰기 템플릿 (블록 구성 저장본). */
@Getter
@Setter
public class PostTemplate {
    private Long id;
    private String name;
    private String titleHint;
    private Long categoryId;
    private String blocksJson;
    private Long createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // 조인 컬럼
    private String creatorName;
    private String categoryName;
}
