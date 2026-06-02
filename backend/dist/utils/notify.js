"use strict";
// 把变量安全地填入通知模板。
//
// 模板通常是一段 JSON 文本（发往 Telegram 等），可能带 Markdown。
// 直接做字符串替换会有两类问题，导致 Webhook 返回 400：
//   1) 值里含 " 换行 \ 等 → 破坏 JSON 结构（"can't parse JSON"）
//   2) 值里含 _ * ` [ 等 → 破坏 Telegram Markdown 实体（"can't parse entities"）
// 所以替换前要先对「值」做转义（模板自身的格式不动）。
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyTemplate = applyTemplate;
// Telegram 旧版 Markdown 的特殊字符
function escapeMarkdownLegacy(s) {
    return s.replace(/([_*`\[])/g, "\\$1");
}
// Telegram MarkdownV2 需要转义的全部字符
function escapeMarkdownV2(s) {
    return s.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}
// 把值安全放进 JSON 字符串字面量里
function escapeJsonString(s) {
    let out = "";
    for (const ch of s) {
        const code = ch.charCodeAt(0);
        if (ch === "\\")
            out += "\\\\";
        else if (ch === '"')
            out += '\\"';
        else if (ch === "\n")
            out += "\\n";
        else if (ch === "\r")
            out += "\\r";
        else if (ch === "\t")
            out += "\\t";
        else if (code < 0x20)
            out += "\\u" + code.toString(16).padStart(4, "0");
        else
            out += ch;
    }
    return out;
}
function applyTemplate(template, vars, opts = {}) {
    const json = opts.json !== false;
    const mdV2 = /"parse_mode"\s*:\s*"markdownv2"/i.test(template);
    const mdLegacy = !mdV2 && /"parse_mode"\s*:\s*"markdown"/i.test(template);
    let body = template;
    for (const [k, v] of Object.entries(vars)) {
        let val = v == null ? "" : String(v);
        if (mdV2)
            val = escapeMarkdownV2(val);
        else if (mdLegacy)
            val = escapeMarkdownLegacy(val);
        if (json)
            val = escapeJsonString(val);
        body = body.replace(new RegExp(`\\{${k}\\}`, "g"), val);
    }
    return body;
}
