---
name: Design Feedback — No Visual Decisions Without Asking
description: User objects strongly to unilateral visual design decisions that change how the song sheet looks
type: feedback
originSessionId: 54b90a35-fba5-4161-ad21-b3ce5f06d041
---
Do NOT make visual design decisions that change how content looks without asking first.

**Why:** The original PDF layout was deliberately designed by the song arranger. Structure markers (######, ******, @@@@@@), bracket boxes, and spacing all carry meaning. Changing their visual representation (e.g. converting ### to a horizontal line, changing font colors, adding decorative elements) misrepresents the original intent.

**How to apply:** If a fix requires changing how something looks, describe the options and ask which to use. Code-level fixes (parser bugs, positioning, missing elements) are fine to implement directly. Visual representation changes need approval.

Specific rejection: Converting SEP_RE markers (###, ***) to horizontal `<hr>` lines — rejected. They must render as text exactly as they appear in the source.
