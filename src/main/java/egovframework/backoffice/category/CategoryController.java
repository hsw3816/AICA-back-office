package egovframework.backoffice.category;

import egovframework.backoffice.common.BusinessException;
import jakarta.validation.Valid;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

/** 카테고리 관리: 목록 화면 안에서 등록·수정·순서 변경·삭제. */
@Controller
@RequestMapping("/admin/categories")
public class CategoryController {

    private final CategoryService service;

    public CategoryController(CategoryService service) {
        this.service = service;
    }

    @ModelAttribute("menu")
    public String menu() {
        return "categories";
    }

    @GetMapping
    public String list(@RequestParam(required = false) Long edit, Model model) {
        model.addAttribute("categories", service.findAll());
        if (!model.containsAttribute("form")) {
            model.addAttribute("form", edit == null ? new CategoryForm() : CategoryForm.from(service.get(edit)));
        }
        return "category/list";
    }

    @PostMapping
    public String save(@Valid @ModelAttribute("form") CategoryForm form, BindingResult binding,
                       Model model, RedirectAttributes redirect) {
        if (!binding.hasErrors()) {
            try {
                if (form.getId() == null) {
                    service.create(form);
                    redirect.addFlashAttribute("toast", "카테고리를 등록했습니다.");
                } else {
                    service.update(form.getId(), form);
                    redirect.addFlashAttribute("toast", "카테고리를 수정했습니다.");
                }
                return "redirect:/admin/categories";
            } catch (BusinessException e) {
                binding.reject("business", e.getMessage());
            }
        }
        model.addAttribute("categories", service.findAll());
        return "category/list";
    }

    @PostMapping("/{id}/move")
    public String move(@PathVariable Long id, @RequestParam String direction) {
        service.move(id, "up".equals(direction));
        return "redirect:/admin/categories";
    }

    @PostMapping("/{id}/delete")
    public String delete(@PathVariable Long id, RedirectAttributes redirect) {
        try {
            service.delete(id);
            redirect.addFlashAttribute("toast", "카테고리를 삭제했습니다.");
        } catch (BusinessException e) {
            redirect.addFlashAttribute("toastError", e.getMessage());
        }
        return "redirect:/admin/categories";
    }
}
