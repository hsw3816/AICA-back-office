package egovframework.backoffice.media;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface ImageMapper {
    int insert(ImageFile image);

    ImageFile findById(@Param("id") Long id);

    List<ImageFile> findRecent(@Param("limit") int limit);

    int delete(@Param("id") Long id);
}
