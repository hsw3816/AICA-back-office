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

    /** 휴지통으로 이동. 목록·프론트에서 제외되며 휴지통에서 복원할 수 있다. */
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

    /** 복원 → 삭제 전 상태 그대로 글 관리 목록으로 돌아간다. */
    public void restore(Long id) {
        getDeleted(id);
        mapper.restore(id);
    }

    /** 완전 삭제 — 휴지통에 있는 글만 가능하며 되돌릴 수 없다. 이력·조회 로그를 먼저 지운다(FK). */
    public void purge(Long id) {
        getDeleted(id);
        versions.deleteByPost(id);
        mapper.deleteViewLogs(id);
        mapper.hardDelete(id);
    }
}
