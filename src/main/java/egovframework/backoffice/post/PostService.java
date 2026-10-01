package egovframework.backoffice.post;

import egovframework.backoffice.common.NotFoundException;
import egovframework.backoffice.common.PageResult;
import egovframework.backoffice.post.version.PostVersion;
import egovframework.backoffice.post.version.PostVersionService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 게시물 조회·등록·수정·상태 변경. 휴지통은 {@link PostTrashService}, 버전 이력은 {@link PostVersionService}. */
@Service
@Transactional
public class PostService {

    private final PostMapper mapper;
    private final PostVersionService versions;
    private final PostAssembler assembler;

    public PostService(PostMapper mapper, PostVersionService versions, PostAssembler assembler) {
        this.mapper = mapper;
        this.versions = versions;
        this.assembler = assembler;
    }

    @Transactional(readOnly = true)
    public PageResult<Post> search(PostSearch search) {
        List<Post> items = mapper.search(search);
        long total = mapper.countSearch(search);
        return new PageResult<>(items, search.getPage(), search.getSize(), total);
    }

    @Transactional(readOnly = true)
    public Post get(Long id) {
        Post post = mapper.findById(id);
        if (post == null) {
            throw new NotFoundException("게시물을 찾을 수 없습니다.");
        }
        return post;
    }

    @Transactional(readOnly = true)
    public Post getPublished(Long id) {
        Post post = mapper.findPublishedById(id);
        if (post == null) {
            throw new NotFoundException("게시물을 찾을 수 없습니다.");
        }
        return post;
    }

    public Post create(PostForm form, Long authorId) {
        Post post = new Post();
        post.setAuthorId(authorId);
        apply(post, form);
        if (post.getStatus() == PostStatus.PUBLISHED) {
            post.setPublishedAt(LocalDateTime.now());
        }
        mapper.insert(post);
        versions.record(post, reasonFor(post), authorId);
        return post;
    }

    public void update(Long id, PostForm form, Long adminId) {
        Post post = get(id);
        apply(post, form);
        if (post.getStatus() == PostStatus.PUBLISHED && post.getPublishedAt() == null) {
            post.setPublishedAt(LocalDateTime.now());
        }
        mapper.update(post);
        versions.record(post, reasonFor(post), adminId);
    }

    public void changeStatus(Long id, PostStatus status) {
        get(id);
        mapper.updateStatus(id, status);
    }

    /** 저장 시 남길 이력 사유: 발행이면 PUBLISH, 그 외는 MANUAL_DRAFT */
    private static String reasonFor(Post post) {
        return post.getStatus() == PostStatus.PUBLISHED ? PostVersion.PUBLISH : PostVersion.MANUAL_DRAFT;
    }

    /** 폼 입력을 정화해 게시물에 반영한다 (규칙은 {@link PostAssembler}). */
    public Post apply(Post post, PostForm form) {
        return assembler.apply(post, form);
    }

    /** 미리보기 렌더용: 저장된 JSON 을 블록 목록으로 */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> blocksOf(Post post) {
        return assembler.blocksOf(post.getBlocksJson());
    }
}
