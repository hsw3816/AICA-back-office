package egovframework.backoffice.category;

import egovframework.backoffice.common.BusinessException;
import egovframework.backoffice.common.NotFoundException;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class CategoryService {

    private final CategoryMapper mapper;

    public CategoryService(CategoryMapper mapper) {
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<Category> findAll() {
        return mapper.findAll();
    }

    @Transactional(readOnly = true)
    public List<Category> findActive() {
        return mapper.findActive();
    }

    @Transactional(readOnly = true)
    public Category get(Long id) {
        Category c = mapper.findById(id);
        if (c == null) {
            throw new NotFoundException("카테고리를 찾을 수 없습니다.");
        }
        return c;
    }

    public Category create(CategoryForm form) {
        Category c = new Category();
        apply(c, form);
        if (form.getSortOrder() == 0) {
            c.setSortOrder(mapper.findAll().size() + 1);
        }
        mapper.insert(c);
        return c;
    }

    public void update(Long id, CategoryForm form) {
        Category c = get(id);
        apply(c, form);
        mapper.update(c);
    }

    public void delete(Long id) {
        Category c = get(id);
        if (mapper.countPosts(id) > 0) {
            throw new BusinessException("게시물이 " + mapper.countPosts(id)
                    + "건 연결된 카테고리는 삭제할 수 없습니다. 먼저 게시물의 카테고리를 변경하거나 비활성화하세요.");
        }
        mapper.delete(c.getId());
    }

    /** 위/아래 이동: 인접 카테고리와 정렬값 교환 */
    public void move(Long id, boolean up) {
        List<Category> all = mapper.findAll();
        for (int i = 0; i < all.size(); i++) {
            if (all.get(i).getId().equals(id)) {
                int j = up ? i - 1 : i + 1;
                if (j < 0 || j >= all.size()) {
                    return;
                }
                Category a = all.get(i);
                Category b = all.get(j);
                // 정렬값이 같으면 인덱스 기준으로 재부여
                int orderA = a.getSortOrder() == b.getSortOrder() ? j + 1 : b.getSortOrder();
                int orderB = a.getSortOrder() == b.getSortOrder() ? i + 1 : a.getSortOrder();
                mapper.updateSortOrder(a.getId(), orderA);
                mapper.updateSortOrder(b.getId(), orderB);
                return;
            }
        }
    }

    private void apply(Category c, CategoryForm form) {
        String slug = form.getSlug() == null || form.getSlug().isBlank() ? slugify(form.getName()) : form.getSlug();
        Category dup = mapper.findBySlug(slug);
        if (dup != null && !dup.getId().equals(c.getId())) {
            throw new BusinessException("이미 사용 중인 슬러그입니다: " + slug);
        }
        c.setName(form.getName().trim());
        c.setSlug(slug);
        c.setDescription(form.getDescription());
        c.setSortOrder(form.getSortOrder());
        c.setActive(form.isActive());
    }

    static String slugify(String name) {
        String s = Normalizer.normalize(name, Normalizer.Form.NFC).toLowerCase(Locale.ROOT).trim();
        s = s.replaceAll("[^a-z0-9가-힣]+", "-").replaceAll("^-+|-+$", "");
        return s.isEmpty() ? "category-" + System.currentTimeMillis() : s;
    }
}
