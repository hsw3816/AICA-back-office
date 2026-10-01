package egovframework.backoffice.post;

import egovframework.backoffice.account.CurrentAdmin;
import egovframework.backoffice.category.CategoryService;
import egovframework.backoffice.config.BackofficeProperties;
import java.time.LocalDateTime;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;

/** 미리보기 — 프론트와 같은 템플릿(front/post)으로 저장본 또는 작성 중 내용을 렌더링한다. */
@Controller
@RequestMapping("/admin/posts")
public class PostPreviewController {

    private final PostService postService;
    private final CategoryService categoryService;
    private final BackofficeProperties properties;

    public PostPreviewController(PostService postService, CategoryService categoryService, BackofficeProperties properties) {
        this.postService = postService;
        this.categoryService = categoryService;
        this.properties = properties;
    }

    /** 저장된 게시물 미리보기 */
    @GetMapping("/{id}/preview")
    public String preview(@PathVariable Long id, Model model) {
        Post post = postService.get(id);
        model.addAttribute("post", post);
        model.addAttribute("blocks", postService.blocksOf(post));
        model.addAttribute("previewMode", "saved");
        model.addAttribute("frontBaseUrl", properties.getFrontBaseUrl());
        return "front/post";
    }

    /** 저장 전 미리보기 — 편집 중인 폼 내용을 그대로 렌더링 (새 탭) */
    @PostMapping("/preview")
    public String previewDraft(@ModelAttribute("form") PostForm form, @AuthenticationPrincipal CurrentAdmin me,
                               Model model) {
        Post post = new Post();
        post.setId(form.getId());
        post.setAuthorName(me.getName());
        post.setPublishedAt(LocalDateTime.now());
        if (form.getTitle() == null || form.getTitle().isBlank()) {
            form.setTitle("(제목 없음)");
        }
        postService.apply(post, form);
        if (form.getCategoryId() != null) {
            post.setCategoryName(categoryService.get(form.getCategoryId()).getName());
        }
        model.addAttribute("post", post);
        model.addAttribute("blocks", postService.blocksOf(post));
        model.addAttribute("previewMode", "draft");
        model.addAttribute("frontBaseUrl", properties.getFrontBaseUrl());
        return "front/post";
    }
}
