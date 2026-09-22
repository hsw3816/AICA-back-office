package egovframework.backoffice.category;

import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class Category {
    private Long id;
    private String name;
    private String slug;
    private String description;
    private int sortOrder;
    private boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    /** 목록 조회 시 함께 계산되는 게시물 수 (삭제 제외) */
    private long postCount;
}
