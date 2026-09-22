package egovframework.backoffice.category;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CategoryForm {
    private Long id;

    @NotBlank(message = "카테고리 이름을 입력하세요.")
    @Size(max = 50, message = "카테고리 이름은 50자 이내입니다.")
    private String name;

    /** 프론트 URL 에 사용하는 식별 문자열. 비우면 이름에서 생성. */
    @Size(max = 50)
    @Pattern(regexp = "^[a-z0-9가-힣-]*$", message = "슬러그는 소문자 영문·숫자·한글·하이픈만 사용할 수 있습니다.")
    private String slug;

    @Size(max = 200)
    private String description;

    private int sortOrder;
    private boolean active = true;

    public static CategoryForm from(Category c) {
        CategoryForm f = new CategoryForm();
        f.setId(c.getId());
        f.setName(c.getName());
        f.setSlug(c.getSlug());
        f.setDescription(c.getDescription());
        f.setSortOrder(c.getSortOrder());
        f.setActive(c.isActive());
        return f;
    }
}
