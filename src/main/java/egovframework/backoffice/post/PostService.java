package egovframework.backoffice.post;

import egovframework.backoffice.common.NotFoundException;
import egovframework.backoffice.common.PageResult;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PostService {

    /** 게시물당 보관하는 저장 이력 수(발행 이력은 별도로 모두 보관) */
    public static final int VERSION_KEEP = 20;

    private final PostMapper mapper;
    private final PostVersionMapper versions;
    private final BlockContent blocks;

    public PostService(PostMapper mapper, PostVersionMapper versions, BlockContent blocks) {
        this.mapper = mapper;
        this.versions = versions;
        this.blocks = blocks;
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
        recordVersion(post, post.getStatus() == PostStatus.PUBLISHED ? PostVersion.PUBLISH : PostVersion.MANUAL_DRAFT, authorId);
        return post;
    }

    public void update(Long id, PostForm form, Long adminId) {
        Post post = get(id);
        apply(post, form);
        if (post.getStatus() == PostStatus.PUBLISHED && post.getPublishedAt() == null) {
            post.setPublishedAt(LocalDateTime.now());
        }
        mapper.update(post);
        recordVersion(post, post.getStatus() == PostStatus.PUBLISHED ? PostVersion.PUBLISH : PostVersion.MANUAL_DRAFT, adminId);
    }

    /* ---------- 버전 이력 ---------- */

    private void recordVersion(Post post, String reason, Long adminId) {
        versions.insert(PostVersion.of(post, reason, adminId));
        versions.prune(post.getId(), VERSION_KEEP);
    }

    @Transactional(readOnly = true)
    public List<PostVersion> versionsOf(Long postId) {
        get(postId);
        return versions.findByPost(postId, 100);
    }

    @Transactional(readOnly = true)
    public PostVersion version(Long postId, Long versionId) {
        get(postId);
        PostVersion v = versions.findById(postId, versionId);
        if (v == null) {
            throw new NotFoundException("버전을 찾을 수 없습니다.");
        }
        return v;
    }

    /**
     * 선택한 버전으로 되돌린다. 현재 내용을 먼저 '복원 전 백업'으로 남기고,
     * 제목·요약·카테고리·본문·대표이미지를 스냅샷 값으로 교체한다. 공개 상태(status)는 바꾸지 않는다.
     */
    public void restoreVersion(Long postId, Long versionId, Long adminId) {
        Post post = get(postId);
        PostVersion v = version(postId, versionId);
        recordVersion(post, PostVersion.RESTORE_BACKUP, adminId);

        PostForm form = new PostForm();
        form.setTitle(v.getTitle());
        form.setSummary(v.getSummary());
        form.setCategoryId(v.getCategoryId());
        form.setThumbnailMode(v.getThumbnailMode());
        form.setThumbnailUrl(v.getThumbnailUrl());
        form.setStatus(post.getStatus());
        form.setBlocksJson(v.getBlocksJson());
        apply(post, form);
        mapper.update(post);
        recordVersion(post, PostVersion.RESTORE, adminId);
    }

    public void changeStatus(Long id, PostStatus status) {
        get(id);
        mapper.updateStatus(id, status);
    }

    /** 휴지통으로 이동(soft delete). 목록·프론트에서 제외되며 휴지통에서 복원할 수 있다. */
    public void delete(Long id) {
        get(id);
        mapper.softDelete(id);
    }

    @Transactional(readOnly = true)
    public PageResult<Post> searchTrash(PostSearch search) {
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

    /** 휴지통에서 복원 → 글 관리 목록으로 돌아간다(상태는 삭제 전 그대로). */
    public void restore(Long id) {
        getDeleted(id);
        mapper.restore(id);
    }

    /** 완전 삭제 — 휴지통에 있는 글만 가능하며 되돌릴 수 없다. */
    public void purge(Long id) {
        getDeleted(id);
        versions.deleteByPost(id);
        mapper.deleteViewLogs(id);
        mapper.hardDelete(id);
    }

    /** 폼 입력을 정화해 게시물에 반영한다. 저장 전에 미리보기에서도 같은 규칙을 사용한다. */
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

    @Transactional(readOnly = true)
    public List<Map<String, Object>> blocksOfJson(String json) {
        return blocks.parse(json);
    }

    /** 미리보기 렌더용: 저장된 JSON 을 블록 목록으로 */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> blocksOf(Post post) {
        return blocks.parse(post.getBlocksJson());
    }
}
