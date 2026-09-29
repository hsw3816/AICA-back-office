package egovframework.backoffice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestBuilders.formLogin;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.authenticated;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrlPattern;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

/**
 * 로그인 → 카테고리 등록 → 게시물 등록·미리보기·게시 → 공개 API 조회·조회수 집계 흐름을 실제 컨텍스트로 검증한다.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:backoffice-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "backoffice.upload-dir=${java.io.tmpdir}/backoffice-test-uploads",
        "backoffice.initial-admin.password=test-pass-1234"
})
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class BackofficeWebTest {

    @Autowired MockMvc mvc;

    private MockHttpSession login() throws Exception {
        MvcResult result = mvc.perform(formLogin("/login").user("loginId", "admin").password("password", "test-pass-1234"))
                .andExpect(authenticated())
                .andExpect(redirectedUrl("/admin"))
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    @Test
    @Order(1)
    void loginPageIsPublicAndAdminPagesRequireLogin() throws Exception {
        mvc.perform(get("/login")).andExpect(status().isOk());
        mvc.perform(get("/admin/posts")).andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrlPattern("**/login"));
        mvc.perform(get("/api/public/categories")).andExpect(status().isOk());
    }

    @Test
    @Order(2)
    void initialSuperAdminCanLoginAndSeeDashboard() throws Exception {
        MockHttpSession session = login();
        mvc.perform(get("/admin").session(session)).andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("누적 방문수")));
        mvc.perform(get("/admin/users").session(session)).andExpect(status().isOk());
    }

    @Test
    @Order(3)
    void categoryPostPreviewPublishAndPublicApiFlow() throws Exception {
        MockHttpSession session = login();

        // 카테고리 등록
        mvc.perform(post("/admin/categories").session(session).with(csrf())
                        .param("name", "공지사항").param("slug", "notice").param("sortOrder", "1").param("active", "true"))
                .andExpect(status().is3xxRedirection());
        String categories = mvc.perform(get("/admin/categories").session(session)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(categories).contains("공지사항").contains("notice");
        String categoryId = mvc.perform(get("/api/public/categories")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").value("notice"))
                .andReturn().getResponse().getContentAsString().replaceAll(".*\"id\":(\\d+).*", "$1");

        // 게시물 등록 (임시저장) — 스크립트가 포함된 인라인 HTML 은 정화되어야 한다
        String blocks = """
            [{"type":"heading","level":2,"html":"첫 <b>글</b><script>alert(1)</script>"},
             {"type":"paragraph","align":"center","html":"<span style=\\"color: #dc2626; position: absolute;\\">빨간</span> 글자"},
             {"type":"list","style":"number","items":["하나","<i>둘</i>"]},
             {"type":"image","url":"javascript:alert(1)","alt":"x","caption":"","width":"full"},
             {"type":"divider"}]
            """;
        MvcResult created = mvc.perform(post("/admin/posts").session(session).with(csrf())
                        .param("title", "테스트 게시물").param("categoryId", categoryId).param("status", "DRAFT")
                        .param("thumbnailMode", "AUTO").param("blocksJson", blocks))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrlPattern("/admin/posts/*/edit"))
                .andReturn();
        String postId = created.getResponse().getRedirectedUrl().replaceAll("\\D", "");

        // 미리보기: 허용 서식 유지, script·위험 스타일·javascript: 이미지 제거
        String preview = mvc.perform(get("/admin/posts/" + postId + "/preview").session(session))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(preview).contains("첫 <b>글</b>")
                .contains("color: #dc2626")
                .doesNotContain("<script>")
                .doesNotContain("position: absolute")
                .doesNotContain("javascript:alert")
                .contains("<ol>").contains("<i>둘</i>")
                .contains("저장된 내용 미리보기");

        // 임시저장 상태는 공개 API 에 노출되지 않음
        mvc.perform(get("/api/public/posts")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        mvc.perform(get("/api/public/posts/" + postId)).andExpect(status().isNotFound());

        // 게시 → 공개 API 노출, 조회수 집계
        mvc.perform(post("/admin/posts/" + postId + "/status").session(session).with(csrf()).param("status", "PUBLISHED"))
                .andExpect(status().is3xxRedirection());
        mvc.perform(get("/api/public/posts")).andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].title").value("테스트 게시물"));
        mvc.perform(post("/api/public/track/posts/" + postId + "/view").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visitorKey\":\"v1\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(true));
        mvc.perform(post("/api/public/track/visit").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visitorKey\":\"v1\",\"path\":\"/\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/public/posts/" + postId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.viewCount").value(1))
                .andExpect(jsonPath("$.blocks[0].type").value("heading"));

        // 통계 화면
        String stats = mvc.perform(get("/admin/stats").session(session)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(stats).contains("테스트 게시물");

        // 게시물이 연결된 카테고리는 삭제 불가
        mvc.perform(post("/admin/categories/" + categoryId + "/delete").session(session).with(csrf()))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", "/admin/categories"));
        assertThat(mvc.perform(get("/api/public/categories")).andReturn().getResponse().getContentAsString())
                .contains("notice");

        // 휴지통으로 이동(soft) → 목록·공개 API 에서 제외, 휴지통에는 표시
        mvc.perform(post("/admin/posts/" + postId + "/delete").session(session).with(csrf()))
                .andExpect(status().is3xxRedirection());
        mvc.perform(get("/api/public/posts")).andExpect(jsonPath("$.total").value(0));
        mvc.perform(get("/admin/posts/trash").session(session))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("복원")));

        // 복원 → 글 관리로 돌아오고 공개 API 에 다시 노출
        mvc.perform(post("/admin/posts/" + postId + "/restore").session(session).with(csrf()))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", "/admin/posts"));
        mvc.perform(get("/api/public/posts")).andExpect(jsonPath("$.total").value(1));

        // 다시 휴지통 → 완전 삭제 → 어디에서도 조회 불가
        mvc.perform(post("/admin/posts/" + postId + "/delete").session(session).with(csrf()))
                .andExpect(status().is3xxRedirection());
        mvc.perform(post("/admin/posts/" + postId + "/purge").session(session).with(csrf()))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", "/admin/posts/trash"));
        mvc.perform(get("/admin/posts/" + postId + "/edit").session(session)).andExpect(status().isNotFound());
        mvc.perform(get("/api/public/posts")).andExpect(jsonPath("$.total").value(0));
    }

    @Test
    @Order(4)
    void imageUploadRejectsNonImagesAndAcceptsPng() throws Exception {
        MockHttpSession session = login();
        var fake = new MockMultipartFile("file", "evil.png", "image/png", "not an image".getBytes());
        mvc.perform(MockMvcRequestBuilders.multipart("/admin/images").file(fake).session(session).with(csrf()))
                .andExpect(status().isBadRequest());

        byte[] png = java.util.Base64.getDecoder().decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");
        var real = new MockMultipartFile("file", "dot.png", "image/png", png);
        mvc.perform(MockMvcRequestBuilders.multipart("/admin/images").file(real).session(session).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(org.hamcrest.Matchers.startsWith("/uploads/")));
    }

    @Test
    @Order(5)
    void superAdminManagesAccountsAndLastSuperAdminIsProtected() throws Exception {
        MockHttpSession session = login();
        mvc.perform(post("/admin/users").session(session).with(csrf())
                        .param("loginId", "editor1").param("name", "편집자").param("role", "ADMIN")
                        .param("active", "true").param("password", "editor-pass-1"))
                .andExpect(status().is3xxRedirection());

        // 자기 자신(마지막 SUPER_ADMIN) 강등 시도 → 오류 메시지와 함께 폼 재표시
        String body = mvc.perform(post("/admin/users/1").session(session).with(csrf())
                        .param("loginId", "admin").param("name", "최초 관리자").param("role", "ADMIN").param("active", "true"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).contains("마지막 최상위 관리자");

        // 일반 관리자는 계정 관리 화면에 접근할 수 없다
        MvcResult editorLogin = mvc.perform(formLogin("/login").user("loginId", "editor1").password("password", "editor-pass-1"))
                .andExpect(authenticated()).andReturn();
        MockHttpSession editor = (MockHttpSession) editorLogin.getRequest().getSession(false);
        mvc.perform(get("/admin/users").session(editor)).andExpect(status().isForbidden());
        mvc.perform(get("/admin/posts").session(editor)).andExpect(status().isOk());

        // SUPPORT 는 게시물 등록·수정만 가능: 삭제·상태 변경·카테고리 변경·통계는 403
        mvc.perform(post("/admin/users").session(session).with(csrf())
                        .param("loginId", "support1").param("name", "서포터").param("role", "SUPPORT")
                        .param("active", "true").param("password", "support-pass-1"))
                .andExpect(status().is3xxRedirection());
        MockHttpSession support = (MockHttpSession) mvc.perform(
                        formLogin("/login").user("loginId", "support1").password("password", "support-pass-1"))
                .andExpect(authenticated()).andReturn().getRequest().getSession(false);
        mvc.perform(get("/admin").session(support)).andExpect(redirectedUrl("/admin/posts"));
        MvcResult created = mvc.perform(post("/admin/posts").session(support).with(csrf())
                        .param("title", "서포터 글").param("status", "PENDING").param("thumbnailMode", "AUTO")
                        .param("blocksJson", "[{\"type\":\"paragraph\",\"align\":\"left\",\"html\":\"질문\"}]"))
                .andExpect(status().is3xxRedirection()).andReturn();
        String supportPostId = created.getResponse().getRedirectedUrl().replaceAll("\\D", "");
        mvc.perform(post("/admin/posts/" + supportPostId).session(support).with(csrf())
                        .param("title", "서포터 글 수정").param("status", "PENDING").param("thumbnailMode", "AUTO")
                        .param("blocksJson", "[{\"type\":\"paragraph\",\"align\":\"left\",\"html\":\"수정\"}]"))
                .andExpect(status().is3xxRedirection());
        mvc.perform(post("/admin/posts/" + supportPostId + "/delete").session(support).with(csrf()))
                .andExpect(status().isForbidden());
        mvc.perform(post("/admin/posts/" + supportPostId + "/status").session(support).with(csrf()).param("status", "PUBLISHED"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/admin/categories").session(support).with(csrf()).param("name", "x"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/admin/stats").session(support)).andExpect(status().isForbidden());
        String list = mvc.perform(get("/admin/posts").session(support)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(list).contains("서포터 글 수정").contains("답변대기");
    }
}
