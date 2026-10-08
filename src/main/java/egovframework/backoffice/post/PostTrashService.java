package egovframework.backoffice.post;

import egovframework.backoffice.common.NotFoundException;
import egovframework.backoffice.common.PageResult;
import egovframework.backoffice.post.version.PostVersionService;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 휴지통: 이동(soft delete) · 목록 · 복원 · 완전 삭제. */
@Service
@Transactional
public class PostTrashService {

    private final PostMapper mapper;
    private final PostService posts;
    private final PostVersionService versions;

    public PostTrashService(PostMapper mapper, PostService posts, PostVersionService versions) {
        this.mapper = mapper;
        this.posts = posts;
        this.versions = versions;
    }

    /**
     * 휴지통으로 이동. 이동 직전 상태를 status_before_trash 에 남기고 상태를 미게시(HIDDEN)로 바꾼다 —
     * 게시중이던 글은 그 즉시 공개가 중단되고, 복원해도 미게시로 돌아와 실수로 다시 공개되는 일을 막는다.
     */
    public void moveToTrash(Long id) {
        posts.get(id);
        mapper.softDelete(id);
    }

    @Transactional(readOnly = true)
    public PageResult<Post> search(PostSearch search) {
        List<Post> items = mapper.findTrash(search);
        long total = mapper.countTrash(search);
        return new PageResult<>(items, search.getPage(), search.getSize(), total);
    }

    @Transactional(readOnly = true)
    public Post getDeleted(Long id) {
        Post post = mapper.findDeletedById(id);
        if (post == null) {
            throw new NotFoundException("휴지통에서 게시물을 찾을 수 없습니다.");
        }
        return post;
    }

    /** 복원 → 미게시(HIDDEN) 상태로 글 관리 목록으로 돌아간다. 게시하려면 상태를 다시 바꿔야 한다. */
    public Post restore(Long id) {
        Post before = getDeleted(id);
        mapper.restore(id);
        return before;
    }

    /** 완전 삭제 — 휴지통에 있는 글만 가능하며 되돌릴 수 없다. 이력·조회 로그를 먼저 지운다(FK). */
    public void purge(Long id) {
        getDeleted(id);
        versions.deleteByPost(id);
        mapper.deleteViewLogs(id);
        mapper.hardDelete(id);
    }
}
