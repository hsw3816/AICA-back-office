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

    private final PostMapper mapper;
    private final BlockContent blocks;

    public PostService(PostMapper mapper, BlockContent blocks) {
        this.mapper = mapper;
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
        return post;
    }

    public void update(Long id, PostForm form) {
        Post post = get(id);
        apply(post, form);
        if (post.getStatus() == PostStatus.PUBLISHED && post.getPublishedAt() == null) {
            post.setPublishedAt(LocalDateTime.now());
        }
        mapper.update(post);
    }

    public void changeStatus(Long id, PostStatus status) {
        get(id);
        mapper.updateStatus(id, status);
    }

    public void delete(Long id) {
        get(id);
        mapper.softDelete(id);
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

    /** 미리보기 렌더용: 저장된 JSON 을 블록 목록으로 */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> blocksOf(Post post) {
        return blocks.parse(post.getBlocksJson());
    }
}
