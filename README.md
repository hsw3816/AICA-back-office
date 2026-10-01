# AICA Backoffice

블로그형 CMS **백오피스**입니다 (관리자 UI는 블로그 관리자 화면 형태, 글쓰기는 전용 화면). 프론트 오피스와 같은 콘텐츠 구조(카테고리 → 게시물 → 블록)를 관리자가 어렵지 않게 운영할 수 있도록, 디자인보다 사용성과 기능을 우선해 구성했습니다.

Java 17 / Spring Boot 3.4.5 / Spring Security 6.4.5 / Thymeleaf / MyBatis 3.5.16 / Flyway / H2(파일 DB, 개발용).
DB 스키마는 Flyway `V1`(기본) · `V2`(버전 이력) · `V3`(템플릿)으로 관리합니다. 0단계 기술 검증 기록은 [docs/STAGE0_VERIFICATION.md](docs/STAGE0_VERIFICATION.md)에 남아 있습니다(검증 코드는 정리됨).

## 주요 기능

| 메뉴 | 기능 |
| --- | --- |
| 관리자 홈 | 오늘·어제·누적 방문수, 최근 30일 일별 방문 그래프, 최근 7일 인기글·게시물 현황 (SUPPORT 는 글 관리로 이동) |
| 글 관리 | 목록(상태·카테고리·키워드 필터, 페이징) / 제목 클릭 시 미리보기 / 수정 · 게시 · 숨김 · 휴지통 이동 |
| 휴지통 | 삭제한 글 목록 / 복원(삭제 전 상태 그대로) / 완전 삭제(이력·조회 로그까지 제거) — ADMIN 이상 |
| 글쓰기 | **블록 에디터**(제목·문단·이미지·인용·목록·표·코드·구분선), 서식(굵게·기울임·밑줄·취소선·크기·색·배경·정렬), **글꼴 7종**, 링크 대화상자(http/https 검증), 웹·워드 서식 유지 붙여넣기 → 블록 분할, `/` 블록 메뉴, 마크다운 단축(`# `, `> `, `- `, `1. `, `---`, ```` ``` ````), 키보드 블록 이동·복제, 이미지 업로드(붙여넣기·드래그, 큰 사진 자동 축소)·보관함·정렬·링크, 브라우저 자동 백업·복구, 콘텐츠 속성 패널(공개 상태·카테고리·대표 이미지·요약) |
| 버전 이력 | 임시저장·발행마다 스냅샷(발행 이력은 모두, 그 외 최근 20개), 내용 보기, 편집기에 불러오기, 복원(복원 전 백업 자동 기록) |
| 템플릿 | 현재 글 구성을 템플릿으로 저장, 불러오기(교체) · 뒤에 추가 · 이름 변경 · 삭제 (최대 100개) |
| 미리보기 | 저장 전·후 모두 프론트 게시물 화면과 같은 템플릿(`front/post.html` + `front/blocks.html`)으로 렌더링 |
| 카테고리 관리 | 등록·수정·표시/숨김·순서 변경·삭제(게시물이 연결되어 있으면 차단), 슬러그 자동 생성 — 변경은 ADMIN 이상 |
| FAQ 관리 | 메뉴·화면 틀만 준비 (기능 후속 구현), 게시물 상태 `답변대기` 사용 |
| 이미지 업로드 | 에디터·대표 이미지에서 업로드 (JPG/PNG/GIF/WEBP, 10MB, 시그니처 검사), 1.5MB 초과·2000px 초과 사진은 브라우저에서 먼저 축소 |
| 방문 통계 | 7/14/30일 고유 방문자·페이지뷰·게시물 조회 추이, 게시물별 누적 조회수 — ADMIN 이상 |
| 관리자 계정 | SUPER_ADMIN 전용: 관리자 등록·역할(SUPER_ADMIN / ADMIN / SUPPORT=게시물 등록·수정만)·활성 상태·비밀번호 재설정, 마지막 최상위 관리자 보호 |
| 비밀번호 변경 | 본인 비밀번호 변경 후 재로그인, 임시 비밀번호 상태면 상단에 안내 |

좌측 프로필 카드의 "AICA 홈페이지 이동" 버튼은 `application.yml`의 `backoffice.front-base-url`(현재 `https://www.aica-gj.kr/main.php`)을 엽니다.

프론트 오피스용 공개 API(인증 없음)도 포함되어 있습니다: `GET /api/public/categories`, `GET /api/public/posts?category=&page=&size=`, `GET /api/public/posts/{id}`, `POST /api/public/track/visit`, `POST /api/public/track/posts/{id}/view`.

## 시작하기 (Windows PowerShell)

JDK 17과 `JAVA_HOME`만 준비하면 됩니다. Maven은 Wrapper가 내려받고, DB는 실행 폴더의 `data/`에 H2 파일로 자동 생성됩니다.

```powershell
Set-Location aica-backoffice-main

# 빌드 + 테스트 (기본 검증 + 업무 기능 통합 테스트)
.\mvnw.cmd -B -ntp clean verify

# 실행 (DB 는 data/ 폴더에 자동 생성, 초기 데이터 없음)
# 개발 중에는 아래 한 줄로 바로 실행
.\mvnw.cmd -B -ntp spring-boot:run
# 또는 빌드된 JAR 실행
& "$env:JAVA_HOME\bin\java.exe" -jar .\target\backoffice-0.1.0-SNAPSHOT.jar
```

- 접속: <http://127.0.0.1:8080/> → 로그인 화면
- 최초 관리자: `admin` / `admin1234!` (환경변수 `BACKOFFICE_INITIAL_ADMIN_PASSWORD` 로 변경 가능, 첫 로그인 후 비밀번호 변경 권장)
- H2 콘솔(local 전용): <http://127.0.0.1:8080/h2-console> (JDBC URL `jdbc:h2:file:./data/backoffice`, 사용자 `sa`, 비밀번호 없음)
- DB 를 초기화하려면 서버를 종료하고 `data` 폴더를 삭제한 뒤 다시 실행합니다.

IDE에서 실행할 때는 Lombok 애노테이션 처리(annotation processing)를 켜 주세요.

## 프로젝트 구조 (기능별)

Java 패키지 · 매퍼 XML · 템플릿 · 정적 자원이 같은 기능 이름을 공유합니다. 기능 하나를 고칠 때 아래 한 줄의 폴더들만 열면 됩니다.

| 기능 | Java (`egovframework.backoffice.*`) | 매퍼 XML | 템플릿 | JS / CSS |
| --- | --- | --- | --- | --- |
| 인증·계정 | `account/` (로그인, 세션 사용자, 관리자 계정, 비밀번호, 최초 관리자) | `mapper/account/` | `templates/account/` | — |
| 게시물 관리 | `post/` (목록·등록·수정·상태 `PostController`, 휴지통 `PostTrashController`, 미리보기 `PostPreviewController`) | `mapper/post/` | `templates/post/` | `css/admin.css` |
| 버전 이력 | `post/version/` | `mapper/post/PostVersionMapper.xml` | (글쓰기 화면 안) | `js/post/history.js` |
| 글쓰기(블록 에디터) | `editor/BlockContent` (블록 JSON 정화 규칙) | — | `templates/post/editor.html` + `editor/_*.html` | `js/editor/*.js`(라이브러리), `js/post/*.js`(페이지), `css/editor.css`, `css/blocks.css` |
| 템플릿 | `template/` | `mapper/template/` | `templates/post/editor/_template-panel.html` | `js/post/templates.js` |
| 이미지 | `media/` | `mapper/media/` | — | `js/editor/core.js`(축소·업로드) |
| 카테고리 | `category/` | `mapper/category/` | `templates/category/` | — |
| 통계 | `stats/` | `mapper/stats/` | `templates/dashboard/`, `templates/stats/` | `css/dashboard.css` |
| 공개 API | `publicapi/` | — | — | — |
| FAQ(자리표시) | `faq/` | — | `templates/faq/` | — |
| 공통 | `common/`(예외·공통 모델), `config/`(보안·속성·정적 자원) | — | `templates/layout/`, `error.html` | `js/admin.js`, `css/admin.css`, `css/front.css` |

- 블록 에디터 JS는 `js/editor/core → blocks → render → input → dialogs → toolbar → index` 순서로 로드해야 합니다(`editor.html` 참고).
- 글쓰기 페이지 설정값은 `editor.html`의 `<div id="editorConfig" data-*>`로 전달되고 `js/post/editor-page.js`의 `PostEditorPage.init()`이 읽습니다.
- Flyway 마이그레이션(`db/migration/V1~V3`)은 체크섬이 기록되므로 이름·내용을 바꾸지 않습니다.

## 문서

- [1차 초안 구성·화면·결정 사항·확인 필요 항목](docs/BACKOFFICE_DRAFT.md) ← 세진님 컨펌용
- [초기 개발 제안서](read.md)
- [현재 파일 구조와 동작 방식 보고서](docs/AICA_백오피스_현재구조_동작보고서.pdf) · [기능별 파일 재분배 기획서](docs/AICA_백오피스_기능별_파일재분배_기획서.pdf)
- [0단계 기술 검증 결과](docs/STAGE0_VERIFICATION.md) (검증 코드는 정리 단계에서 제거, 기록만 보존)
- [동료가 전달한 원본 설계 문서](docs/reference/README.md) / [비교](docs/reference/README_COMPARISON.md)

`target`, `data`(H2 파일·업로드 이미지), `.tools`, `.cache`, `.env`는 저장소에서 제외합니다.
