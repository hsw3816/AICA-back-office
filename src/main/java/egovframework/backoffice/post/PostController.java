package egovframework.backoffice.post;

import egovframework.backoffice.auth.CurrentAdmin;
import egovframework.backoffice.category.CategoryService;
import egovframework.backoffice.config.BackofficeProperties;
import jakarta.validation.Valid;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

/** 게시물 목록·등록·수정·삭제·상태 변경·미리보기. */
@Controller
@RequestMapping("/admin/posts")
public class PostController {

    private final PostService postService;
    private final CategoryService categoryService;
    private final BackofficeProperties properties;

    public PostController(PostService postService, CategoryService categoryService, BackofficeProperties properties) {
        this.postService = postService;
        this.categoryService = categoryService;
        this.properties = properties;
    }

    @ModelAttribute("menu")
    public String menu() {
        return "posts";
    }

    @GetMapping
    public String list(@ModelAttribute("search") PostSearch search, Model model) {
        if (search.getSize() < 1 || search.getSize() > 100) {
            search.setSize(20);
        }
        model.addAttribute("result", postService.search(search));
        model.addAttribute("categories", categoryService.findAll());
        model.addAttribute("statuses", PostStatus.values());
        return "post/list";
    }

    /** 휴지통 — 삭제된 글 목록 */
    @GetMapping("/trash")
    public String trash(@ModelAttribute("search") PostSearch search, Model model) {
        if (search.getSize() < 1 || search.getSize() > 100) {
            search.setSize(20);
        }
        model.addAttribute("menu", "trash");
        model.addAttribute("result", postService.searchTrash(search));
        return "post/trash";
    }

    @PostMapping("/{id}/restore")
    public String restore(@PathVariable Long id, RedirectAttributes redirect) {
        postService.restore(id);
        redirect.addFlashAttribute("toast", "게시물을 복원했습니다. 글 관리에서 확인할 수 있습니다.");
        return "redirect:/admin/posts";
    }

    @PostMapping("/{id}/purge")
    public String purge(@PathVariable Long id, RedirectAttributes redirect) {
        postService.purge(id);
        redirect.addFlashAttribute("toast", "게시물을 완전히 삭제했습니다.");
        return "redirect:/admin/posts/trash";
    }

    @GetMapping("/new")
    public String createForm(Model model) {
        model.addAttribute("form", new PostForm());
        addFormOptions(model);
        return "post/editor";
    }

    @PostMapping
    public String create(@Valid @ModelAttribute("form") PostForm form, BindingResult binding,
                         @AuthenticationPrincipal CurrentAdmin me, Model model, RedirectAttributes redirect) {
        if (binding.hasErrors()) {
            addFormOptions(model);
            return "post/editor";
        }
        try {
            Post saved = postService.create(form, me.getId());
            redirect.addFlashAttribute("toast", "게시물을 등록했습니다.");
            return "redirect:/admin/posts/" + saved.getId() + "/edit";
        } catch (IllegalArgumentException e) {
            binding.reject("blocks", e.getMessage());
            addFormOptions(model);
            return "post/editor";
        }
    }

    @GetMapping("/{id}/edit")
    public String editForm(@PathVariable Long id, Model model) {
        Post post = postService.get(id);
        model.addAttribute("post", post);
        model.addAttribute("form", PostForm.from(post));
        addFormOptions(model);
        return "post/editor";
    }

    @PostMapping("/{id}")
    public String update(@PathVariable Long id, @Valid @ModelAttribute("form") PostForm form,
                         BindingResult binding, @AuthenticationPrincipal CurrentAdmin me,
                         Model model, RedirectAttributes redirect) {
        form.setId(id);
        if (binding.hasErrors()) {
            model.addAttribute("post", postService.get(id));
            addFormOptions(model);
            return "post/editor";
        }
        try {
            postService.update(id, form, me.getId());
            redirect.addFlashAttribute("toast", "게시물을 저장했습니다.");
            return "redirect:/admin/posts/" + id + "/edit";
        } catch (IllegalArgumentException e) {
            binding.reject("blocks", e.getMessage());
            model.addAttribute("post", postService.get(id));
            addFormOptions(model);
            return "post/editor";
        }
    }

    @PostMapping("/{id}/status")
    public String changeStatus(@PathVariable Long id, @RequestParam PostStatus status,
                               @RequestParam(required = false) String back, RedirectAttributes redirect) {
        postService.changeStatus(id, status);
        redirect.addFlashAttribute("toast", "게시물 상태를 '" + status.getLabel() + "'(으)로 변경했습니다.");
        return "redirect:" + (back != null && back.startsWith("/admin/") ? back : "/admin/posts");
    }

    /** 휴지통으로 이동 (soft delete) */
    @PostMapping("/{id}/delete")
    public String delete(@PathVariable Long id, RedirectAttributes redirect) {
        postService.delete(id);
        redirect.addFlashAttribute("toast", "게시물을 휴지통으로 이동했습니다.");
        return "redirect:/admin/posts";
    }

    /* ---------- 버전 이력 (편집기에서 fetch) ---------- */

    @GetMapping("/{id}/versions")
    @ResponseBody
    public List<Map<String, Object>> versions(@PathVariable Long id) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (PostVersion v : postService.versionsOf(id)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", v.getId());
            m.put("reason", v.getReason());
            m.put("reasonLabel", v.getReasonLabel());
            m.put("title", v.getTitle());
            m.put("status", v.getStatus() == null ? null : v.getStatus().name());
            m.put("statusLabel", v.getStatus() == null ? "" : v.getStatus().getLabel());
            m.put("creatorName", v.getCreatorName());
            m.put("createdAt", v.getCreatedAt() == null ? null : v.getCreatedAt().format(VERSION_TIME));
            out.add(m);
        }
        return out;
    }

    @GetMapping("/{id}/versions/{versionId}")
    @ResponseBody
    public Map<String, Object> version(@PathVariable Long id, @PathVariable Long versionId) {
        PostVersion v = postService.version(id, versionId);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", v.getId());
        m.put("reason", v.getReason());
        m.put("reasonLabel", v.getReasonLabel());
        m.put("title", v.getTitle());
        m.put("summary", v.getSummary());
        m.put("categoryId", v.getCategoryId());
        m.put("categoryName", v.getCategoryName());
        m.put("thumbnailUrl", v.getThumbnailUrl());
        m.put("thumbnailMode", v.getThumbnailMode());
        m.put("status", v.getStatus() == null ? null : v.getStatus().name());
        m.put("statusLabel", v.getStatus() == null ? "" : v.getStatus().getLabel());
        m.put("creatorName", v.getCreatorName());
        m.put("createdAt", v.getCreatedAt() == null ? null : v.getCreatedAt().format(VERSION_TIME));
        m.put("blocks", postService.blocksOfJson(v.getBlocksJson()));
        return m;
    }

    @PostMapping("/{id}/versions/{versionId}/restore")
    public String restoreVersion(@PathVariable Long id, @PathVariable Long versionId,
                                 @AuthenticationPrincipal CurrentAdmin me, RedirectAttributes redirect) {
        postService.restoreVersion(id, versionId, me.getId());
        redirect.addFlashAttribute("toast", "선택한 버전으로 복원했습니다. 복원 전 내용은 이력에 '복원 전 백업'으로 남아 있습니다.");
        return "redirect:/admin/posts/" + id + "/edit";
    }

    private static final java.time.format.DateTimeFormatter VERSION_TIME =
            java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /** 저장된 게시물 미리보기 — 프론트와 같은 템플릿(front/post)으로 렌더링 */
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

    private void addFormOptions(Model model) {
        model.addAttribute("categories", categoryService.findActive());
        model.addAttribute("statuses", PostStatus.values());
    }
}
