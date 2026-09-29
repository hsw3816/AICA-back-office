package egovframework.backoffice.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** application.yml 의 backoffice.* 설정. */
@Getter
@Setter
@ConfigurationProperties(prefix = "backoffice")
public class BackofficeProperties {
    /** 상단·사이드바에 표시할 서비스 이름 */
    private String siteName = "AICA 관리자 페이지";
    /** 사이드바 서비스 이름 아래 표시할 환경 라벨 (local / dev / prod) */
    private String environmentLabel = "local";
    /** 업로드 이미지 저장 디렉터리 */
    private String uploadDir = "./data/uploads";
    /** 프론트 오피스 주소 (미리보기 화면에서 "실제 화면 열기" 링크에 사용) */
    private String frontBaseUrl = "https://www.aica-gj.kr/main.php";
    private InitialAdmin initialAdmin = new InitialAdmin();

    @Getter
    @Setter
    public static class InitialAdmin {
        private String loginId = "admin";
        private String name = "최초 관리자";
        private String password;
    }
}
