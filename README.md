# AICA Backoffice

블로그형 CMS **백오피스 1차 초안**입니다. 프론트 오피스와 같은 콘텐츠 구조(카테고리 → 게시물 → 블록)를 관리자가 어렵지 않게 운영할 수 있도록, 디자인보다 사용성과 기능을 우선해 구성했습니다.

Java 17 / Spring Boot 3.4.5 / Spring Security 6.4.5 / Thymeleaf / MyBatis 3.5.16 / Flyway / H2(파일 DB, 개발용).
0단계 기술 검증(RTE 4.3.0 프로필 포함)은 [docs/STAGE0_VERIFICATION.md](docs/STAGE0_VERIFICATION.md)에 그대로 남겨 두었습니다.

## 주요 기능

| 메뉴 | 기능 |
| --- | --- |
| 현황 요약 | 오늘·7일 방문자, 게시물 조회수, 게시물 수, 일별 추이, 조회수 상위 게시물 |
| 게시물 관리 | 목록(상태·카테고리·키워드 필터, 페이징) / 제목 클릭 시 미리보기 / 등록·수정·삭제 / 게시·숨김 |
| 게시물 작성 | **블록 기반 에디터**(텍스트·제목·이미지·목록·인용·구분선), 굵기·기울임·밑줄·취소선·글자 크기·색상·링크, 블록 순서 변경(▲▼·드래그), 이미지 업로드·보관함 선택, 대표 이미지(자동/직접 지정), 요약 자동 생성 |
| 미리보기 | 저장 전·저장 후 모두 프론트 게시물 화면과 같은 템플릿(`front/post.html` + `front/blocks.html`)으로 렌더링 |
| 카테고리 관리 | 등록·수정·표시/숨김·순서 변경·삭제(게시물이 연결되어 있으면 차단), 슬러그 자동 생성 |
| FAQ 관리 | 메뉴·화면 틀만 준비 (기능 후속 구현) |
| 이미지 업로드 | 에디터·대표 이미지에서 업로드 (JPG/PNG/GIF/WEBP, 10MB, 시그니처 검사), 에디터 내 보관함 선택 |
| 방문자·조회수 | 7/14/30일 고유 방문자·페이지뷰·게시물 조회 추이, 게시물별 누적 조회수 |
| 관리자 계정 | SUPER_ADMIN 전용: 관리자 등록·역할(SUPER_ADMIN / ADMIN / SUPPORT=게시물 등록·수정만)·활성 상태·비밀번호 재설정, 마지막 최상위 관리자 보호 |
| 비밀번호 변경 | 본인 비밀번호 변경 후 재로그인 |

프론트 오피스용 공개 API(인증 없음)도 포함되어 있습니다: `GET /api/public/categories`, `GET /api/public/posts?category=&page=&size=`, `GET /api/public/posts/{id}`, `POST /api/public/track/visit`, `POST /api/public/track/posts/{id}/view`.

## 시작하기 (Windows PowerShell)

JDK 17과 `JAVA_HOME`만 준비하면 됩니다. Maven은 Wrapper가 내려받고, DB는 실행 폴더의 `data/`에 H2 파일로 자동 생성됩니다.

```powershell
Set-Location aica-backoffice-main

# 빌드 + 테스트 (기본 검증 + 업무 기능 통합 테스트)
.\mvnw.cmd -B -ntp clean verify

# 실행 (DB 는 data/ 폴더에 자동 생성, 초기 데이터 없음)
& "$env:JAVA_HOME\bin\java.exe" -jar .\target\backoffice-0.1.0-SNAPSHOT.jar
```

- 접속: <http://127.0.0.1:8080/> → 로그인 화면
- 최초 관리자: `admin` / `admin1234!` (환경변수 `BACKOFFICE_INITIAL_ADMIN_PASSWORD` 로 변경 가능, 첫 로그인 후 비밀번호 변경 권장)
- H2 콘솔(local 전용): <http://127.0.0.1:8080/h2-console> (JDBC URL `jdbc:h2:file:./data/backoffice`, 사용자 `sa`, 비밀번호 없음)
- DB 를 초기화하려면 서버를 종료하고 `data` 폴더를 삭제한 뒤 다시 실행합니다.

IDE에서 실행할 때는 Lombok 애노테이션 처리(annotation processing)를 켜 주세요.

## 문서

- [1차 초안 구성·화면·결정 사항·확인 필요 항목](docs/BACKOFFICE_DRAFT.md) ← 세진님 컨펌용
- [초기 개발 제안서](read.md)
- [0단계 기술 검증 결과](docs/STAGE0_VERIFICATION.md)
- [동료가 전달한 원본 설계 문서](docs/reference/README.md) / [비교](docs/reference/README_COMPARISON.md)

`target`, `data`(H2 파일·업로드 이미지), `.tools`, `.cache`, `.env`는 저장소에서 제외합니다.
