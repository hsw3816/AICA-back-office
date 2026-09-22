package egovframework.backoffice.post;

import lombok.Getter;
import lombok.Setter;

/** 게시물 목록 검색 조건 (쿼리 파라미터 바인딩). */
@Getter
@Setter
public class PostSearch {
    private String keyword;
    private Long categoryId;
    private PostStatus status;
    private int page = 1;
    private int size = 20;

    public int getOffset() {
        return (Math.max(page, 1) - 1) * size;
    }

    public boolean isFiltered() {
        return (keyword != null && !keyword.isBlank()) || categoryId != null || status != null;
    }
}
