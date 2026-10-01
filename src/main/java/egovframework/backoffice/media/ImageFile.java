package egovframework.backoffice.media;

import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ImageFile {
    private Long id;
    private String storedName;
    private String originalName;
    private String contentType;
    private long sizeBytes;
    private String url;
    private Long uploadedBy;
    private LocalDateTime createdAt;
}
