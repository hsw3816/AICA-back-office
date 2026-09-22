package egovframework.backoffice.image;

import egovframework.backoffice.common.BusinessException;
import egovframework.backoffice.config.BackofficeProperties;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 이미지 파일 저장. 1차 초안은 로컬 디스크(backoffice.upload-dir)에 yyyy/MM 폴더로 저장하고
 * /uploads/** 로 서비스한다. 운영에서 오브젝트 스토리지(S3 등)로 바꿀 때 이 클래스만 교체한다.
 */
@Service
public class ImageStorageService {

    private static final Map<String, String> ALLOWED = Map.of(
            "image/jpeg", "jpg",
            "image/png", "png",
            "image/gif", "gif",
            "image/webp", "webp");
    private static final long MAX_SIZE = 10L * 1024 * 1024;

    private final ImageMapper mapper;
    private final Path root;

    public ImageStorageService(ImageMapper mapper, BackofficeProperties properties) {
        this.mapper = mapper;
        this.root = Paths.get(properties.getUploadDir()).toAbsolutePath().normalize();
    }

    @Transactional
    public ImageFile store(MultipartFile file, Long uploaderId) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("업로드할 이미지를 선택하세요.");
        }
        if (file.getSize() > MAX_SIZE) {
            throw new BusinessException("이미지는 10MB 이하만 업로드할 수 있습니다.");
        }
        String contentType = detectContentType(file);
        String ext = ALLOWED.get(contentType);
        if (ext == null) {
            throw new BusinessException("JPG, PNG, GIF, WEBP 이미지만 업로드할 수 있습니다.");
        }
        String folder = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM"));
        String storedName = UUID.randomUUID().toString().replace("-", "") + "." + ext;
        Path dir = root.resolve(folder);
        try {
            Files.createDirectories(dir);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, dir.resolve(storedName), StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new IllegalStateException("이미지 저장에 실패했습니다.", e);
        }
        ImageFile image = new ImageFile();
        image.setStoredName(folder + "/" + storedName);
        image.setOriginalName(safeName(file.getOriginalFilename()));
        image.setContentType(contentType);
        image.setSizeBytes(file.getSize());
        image.setUrl("/uploads/" + folder + "/" + storedName);
        image.setUploadedBy(uploaderId);
        mapper.insert(image);
        return image;
    }

    public List<ImageFile> recent(int limit) {
        return mapper.findRecent(limit);
    }

    /** 파일 시그니처(매직 넘버)로 실제 이미지 형식을 판별한다. */
    private static String detectContentType(MultipartFile file) {
        try (InputStream in = file.getInputStream()) {
            byte[] head = in.readNBytes(12);
            if (head.length >= 3 && (head[0] & 0xFF) == 0xFF && (head[1] & 0xFF) == 0xD8) {
                return "image/jpeg";
            }
            if (head.length >= 8 && (head[0] & 0xFF) == 0x89 && head[1] == 'P' && head[2] == 'N' && head[3] == 'G') {
                return "image/png";
            }
            if (head.length >= 6 && head[0] == 'G' && head[1] == 'I' && head[2] == 'F') {
                return "image/gif";
            }
            if (head.length >= 12 && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                    && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P') {
                return "image/webp";
            }
        } catch (IOException e) {
            throw new IllegalStateException("이미지를 읽을 수 없습니다.", e);
        }
        return "unknown";
    }

    private static String safeName(String name) {
        if (name == null || name.isBlank()) {
            return "image";
        }
        String base = Paths.get(name).getFileName().toString();
        return base.length() > 255 ? base.substring(base.length() - 255) : base;
    }
}
