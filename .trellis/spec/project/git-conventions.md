# Git Conventions

> Standards for Git command interaction and log parsing.

## 1. Author Search

### Convention: Name-only Matching

当搜索作者（Author）时，必须仅匹配姓名（Name）部分，忽略邮箱（Email）部分。

**Why**: Git 默认的 `--author` 会匹配 `Name <email>` 完整字符串。如果用户搜索数字（如 `1`），可能会匹配到邮箱中的数字，导致非预期的搜索结果。

**Implementation**:
在构造 Git 命令时，使用正则表达式并将匹配范围限制在 `<` 之前。

```typescript
// Correct
const pattern = `${escapeRegex(userInput)}.*<`;
args.push("--author", pattern, "-i");
```

### Convention: Regex Escaping

任何将用户输入嵌入到 Git 正则表达式参数（如 `--author`, `--grep`）中的操作，都必须先进行转义。

**Implementation**:
使用 `src/git/utils/regex.ts` 中的 `escapeRegex` 函数。

```typescript
import { escapeRegex } from "../utils/regex";

const escapedQuery = escapeRegex(filters.query);
args.push("--grep", escapedQuery, "-i");
```

## 2. Search Logic

### Convention: Consistent AND Logic

所有的搜索过滤条件（Query, Author, Date From, Date To）在逻辑上必须保持 **且 (AND)** 的关系。这必须在后端（单轨模式）和前端（图形模式）的高亮逻辑中保持一致。

**Checklist**:
- [ ] 后端是否使用了 `--all-match`（如果存在多个 grep/author 条件）？
- [ ] 前端高亮逻辑是否使用了 `&&` 连接所有非空过滤字段？
- [ ] 前端高亮是否包含了日期范围校验？

## 3. Log Parsing

### Convention: Unit Separator Delimiter

在解析 `git log` 输出时，使用 `\x1F` (Unit Separator) 作为字段分隔符，以防止作者名或提交消息中包含的分隔符（如 `|`）导致解析失败。

---

## Design Decision: Strict Name Search

**Context**: 用户反馈输入数字 `1` 搜作者时，会匹配到邮箱中带 `1` 的提交。
**Decision**: 统一改为“仅匹配姓名”，并限制正则表达式在 `<` 之前匹配。
**Consequences**: 搜索结果更加符合用户直观预期。
