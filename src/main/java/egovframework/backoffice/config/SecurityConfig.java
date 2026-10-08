package egovframework.backoffice.config;

import egovframework.backoffice.account.AdminRole;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;

/**
 * 세션 기반 관리자 인증.
 * - /login, 정적 자원, 업로드 이미지, 프론트용 공개 API(/api/public/**)는 인증 없이 접근
 * - /admin/users/** (관리자 관리)는 SUPER_ADMIN 전용
 * - 그 외 모든 화면은 로그인 필요
 */
@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/login", "/css/**", "/js/**", "/img/**", "/favicon.ico", "/error").permitAll()
                .requestMatchers("/uploads/**", "/api/public/**").permitAll()
                .requestMatchers("/h2-console/**").permitAll()
                .requestMatchers("/admin/users/**").hasRole(AdminRole.SUPER_ADMIN.name())
                // SUPPORT 는 게시물 등록·수정만: 삭제·휴지통·상태 변경·통계는 관리자 이상
                .requestMatchers("/admin/posts/trash", "/admin/posts/*/delete", "/admin/posts/*/restore",
                        "/admin/posts/*/purge", "/admin/posts/*/status", "/admin/stats/**").hasAnyRole(
                        AdminRole.SUPER_ADMIN.name(), AdminRole.ADMIN.name())
                // 운영진 공지: 보기·닫기는 전원, 작성·수정·내리기·삭제는 최고관리자
                .requestMatchers("/admin/notices/*/dismiss").authenticated()
                .requestMatchers(HttpMethod.POST, "/admin/notices/**").hasRole(AdminRole.SUPER_ADMIN.name())
                // 템플릿 관리: 보기·불러오기는 전원, 생성·수정·삭제는 관리자 이상
                .requestMatchers(HttpMethod.POST, "/admin/templates/**").hasAnyRole(
                        AdminRole.SUPER_ADMIN.name(), AdminRole.ADMIN.name())
                .requestMatchers(HttpMethod.PUT, "/admin/templates/**").hasAnyRole(
                        AdminRole.SUPER_ADMIN.name(), AdminRole.ADMIN.name())
                .requestMatchers(HttpMethod.DELETE, "/admin/templates/**").hasAnyRole(
                        AdminRole.SUPER_ADMIN.name(), AdminRole.ADMIN.name())
                // 미디어 관리: 업로드·보기는 전원, 분류 이동·이름 변경·삭제는 관리자 이상
                .requestMatchers("/admin/media/*/move", "/admin/media/*/rename", "/admin/media/*/delete").hasAnyRole(
                        AdminRole.SUPER_ADMIN.name(), AdminRole.ADMIN.name())
                .anyRequest().authenticated())
            .formLogin(form -> form
                .loginPage("/login")
                .loginProcessingUrl("/login")
                .usernameParameter("loginId")
                .passwordParameter("password")
                .defaultSuccessUrl("/admin", false)
                .failureUrl("/login?error")
                .permitAll())
            .logout(logout -> logout
                .logoutRequestMatcher(new AntPathRequestMatcher("/logout", "POST"))
                .logoutSuccessUrl("/login?logout")
                .invalidateHttpSession(true)
                .deleteCookies("JSESSIONID"))
            .sessionManagement(session -> session.sessionFixation().migrateSession())
            .csrf(csrf -> csrf.ignoringRequestMatchers("/api/public/**", "/h2-console/**"))
            .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()));
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
