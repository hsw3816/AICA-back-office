package egovframework.backoffice.media;

import egovframework.backoffice.account.CurrentAdmin;
import egovframework.backoffice.common.BusinessException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.multipart.MultipartFile;

/** 이미지 업로드(에디터·대표 이미지에서 fetch 로 호출)와 최근 업로드 목록(에디터 보관함 선택용 JSON). */
@Controller
@RequestMapping("/admin/images")
public class ImageController {

    private final ImageStorageService storage;

    public ImageController(ImageStorageService storage) {
        this.storage = storage;
    }

    /** multipart 업로드 → {"id":..,"url":"/uploads/..","name":".."} */
    @PostMapping
    @ResponseBody
    public Map<String, Object> upload(@RequestParam("file") MultipartFile file,
                                      @AuthenticationPrincipal CurrentAdmin me) {
        ImageFile saved = storage.store(file, me.getId());
        return Map.of("id", saved.getId(), "url", saved.getUrl(), "name", saved.getOriginalName(),
                "size", saved.getSizeBytes());
    }

    @GetMapping("/recent")
    @ResponseBody
    public List<Map<String, Object>> recent() {
        return storage.recent(30).stream()
                .<Map<String, Object>>map(i -> Map.of("id", i.getId(), "url", i.getUrl(), "name", i.getOriginalName()))
                .toList();
    }

    @ExceptionHandler(BusinessException.class)
    @ResponseBody
    public ResponseEntity<Map<String, String>> handleBusiness(BusinessException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
    }
}
