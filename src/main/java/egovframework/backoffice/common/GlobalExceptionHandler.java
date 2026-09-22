package egovframework.backoffice.common;

import org.springframework.http.HttpStatus;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/** 화면 요청의 공통 오류 처리. (REST 컨트롤러는 각자 @ExceptionHandler 로 JSON 응답) */
@ControllerAdvice(annotations = org.springframework.stereotype.Controller.class)
public class GlobalExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public String notFound(NotFoundException e, Model model) {
        model.addAttribute("status", 404);
        model.addAttribute("message", e.getMessage());
        return "error";
    }

    @ExceptionHandler(BusinessException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public String business(BusinessException e, Model model) {
        model.addAttribute("status", 400);
        model.addAttribute("message", e.getMessage());
        return "error";
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public String tooLarge(Model model) {
        model.addAttribute("status", 400);
        model.addAttribute("message", "업로드 용량 제한(10MB)을 초과했습니다.");
        return "error";
    }
}
