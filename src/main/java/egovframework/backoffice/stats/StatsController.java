package egovframework.backoffice.stats;

import egovframework.backoffice.auth.CurrentAdmin;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class StatsController {

    private final StatsService statsService;

    public StatsController(StatsService statsService) {
        this.statsService = statsService;
    }

    /** 대시보드(로그인 후 첫 화면) */
    @GetMapping("/admin")
    public String dashboard(@AuthenticationPrincipal CurrentAdmin me, Model model) {
        if (me != null && !me.getRole().canManageContent()) {
            return "redirect:/admin/posts";
        }
        model.addAttribute("menu", "dashboard");
        model.addAttribute("stats", statsService.summary(7));
        return "dashboard/index";
    }

    /** 방문자·조회수 통계 */
    @GetMapping("/admin/stats")
    public String stats(@RequestParam(defaultValue = "14") int days, Model model) {
        int range = days == 7 || days == 14 || days == 30 ? days : 14;
        model.addAttribute("menu", "stats");
        model.addAttribute("range", range);
        model.addAttribute("stats", statsService.summary(range));
        return "stats/index";
    }
}
