package egovframework.backoffice.account;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminUserForm {
    private Long id;

    @NotBlank(message = "로그인 ID를 입력하세요.")
    @Size(min = 3, max = 50, message = "로그인 ID는 3~50자입니다.")
    @Pattern(regexp = "^[a-zA-Z0-9._-]+$", message = "로그인 ID는 영문·숫자·._- 만 사용할 수 있습니다.")
    private String loginId;

    @NotBlank(message = "이름을 입력하세요.")
    @Size(max = 50)
    private String name;

    @NotNull(message = "역할을 선택하세요.")
    private AdminRole role = AdminRole.ADMIN;

    private boolean active = true;

    /** 신규 등록 시 필수, 수정 시 비우면 유지 */
    private String password;

    public static AdminUserForm from(AdminUser user) {
        AdminUserForm f = new AdminUserForm();
        f.setId(user.getId());
        f.setLoginId(user.getLoginId());
        f.setName(user.getName());
        f.setRole(user.getRole());
        f.setActive(user.isActive());
        return f;
    }
}
