package egovframework.backoffice.adminuser;

import egovframework.backoffice.common.BusinessException;
import egovframework.backoffice.common.NotFoundException;
import java.util.List;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class AdminUserService {

    private final AdminUserMapper mapper;
    private final PasswordEncoder passwordEncoder;

    public AdminUserService(AdminUserMapper mapper, PasswordEncoder passwordEncoder) {
        this.mapper = mapper;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<AdminUser> findAll() {
        return mapper.findAll();
    }

    @Transactional(readOnly = true)
    public AdminUser get(Long id) {
        AdminUser user = mapper.findById(id);
        if (user == null) {
            throw new NotFoundException("관리자를 찾을 수 없습니다.");
        }
        return user;
    }

    public AdminUser create(AdminUserForm form) {
        if (mapper.findByLoginId(form.getLoginId()) != null) {
            throw new BusinessException("이미 사용 중인 로그인 ID입니다.");
        }
        if (form.getPassword() == null || form.getPassword().length() < 8) {
            throw new BusinessException("초기 비밀번호는 8자 이상이어야 합니다.");
        }
        AdminUser user = new AdminUser();
        user.setLoginId(form.getLoginId());
        user.setName(form.getName());
        user.setRole(form.getRole());
        user.setActive(form.isActive());
        user.setMustChangePw(true);
        user.setPasswordHash(passwordEncoder.encode(form.getPassword()));
        mapper.insert(user);
        return user;
    }

    public void update(Long id, AdminUserForm form, Long actorId) {
        AdminUser user = get(id);
        boolean demotingOrDeactivating = user.getRole() == AdminRole.SUPER_ADMIN
                && (form.getRole() != AdminRole.SUPER_ADMIN || !form.isActive());
        if (demotingOrDeactivating && mapper.countActiveByRole(AdminRole.SUPER_ADMIN) <= 1) {
            throw new BusinessException("마지막 최상위 관리자는 비활성화하거나 역할을 변경할 수 없습니다.");
        }
        if (id.equals(actorId) && (form.getRole() != user.getRole() || !form.isActive())) {
            throw new BusinessException("자기 자신의 역할·활성 상태는 변경할 수 없습니다.");
        }
        user.setName(form.getName());
        user.setRole(form.getRole());
        user.setActive(form.isActive());
        mapper.updateProfile(user);

        if (form.getPassword() != null && !form.getPassword().isBlank()) {
            if (form.getPassword().length() < 8) {
                throw new BusinessException("비밀번호는 8자 이상이어야 합니다.");
            }
            mapper.updatePassword(id, passwordEncoder.encode(form.getPassword()), true);
        }
    }

    /** 본인 비밀번호 변경 */
    public void changeOwnPassword(Long id, String currentPassword, String newPassword) {
        AdminUser user = get(id);
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new BusinessException("현재 비밀번호가 일치하지 않습니다.");
        }
        if (newPassword == null || newPassword.length() < 8) {
            throw new BusinessException("새 비밀번호는 8자 이상이어야 합니다.");
        }
        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new BusinessException("현재 비밀번호와 다른 비밀번호를 입력하세요.");
        }
        mapper.updatePassword(id, passwordEncoder.encode(newPassword), false);
    }

    /** 최초 기동 시 관리자 계정이 하나도 없으면 최상위 관리자를 생성한다. */
    public boolean createInitialSuperAdminIfEmpty(String loginId, String name, String rawPassword) {
        if (mapper.count() > 0) {
            return false;
        }
        AdminUser user = new AdminUser();
        user.setLoginId(loginId);
        user.setName(name);
        user.setRole(AdminRole.SUPER_ADMIN);
        user.setActive(true);
        user.setMustChangePw(true);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        mapper.insert(user);
        return true;
    }
}
