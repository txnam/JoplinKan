# Kế hoạch plugin Kanban cho Joplin

Ngày lập: 2026-04-26

## Quy ước tài liệu

Từ thời điểm này, mọi tài liệu của dự án cần được viết bằng tiếng Việt có dấu đầy đủ, trừ các tên API, tên file, mã nguồn, lệnh terminal, khóa cấu hình hoặc nội dung bắt buộc phải giữ nguyên theo ngữ cảnh kỹ thuật.

## Mục tiêu

Tạo plugin Joplin cho phép người dùng tạo và chỉnh sửa bảng Kanban trực tiếp từ một note Markdown. Bảng Kanban là một cách nhìn và thao tác khác trên cùng dữ liệu `.md`: cột, thẻ công việc, thứ tự ưu tiên, màu sắc, ký hiệu và thao tác kéo thả đều được ghi ngược về body Markdown của note.

## Căn cứ kỹ thuật

- Joplin plugin nên scaffold bằng `yo joplin`, mặc định dùng TypeScript và build ra `dist/`.
- Joplin có `joplin.views.editors` để tạo alternative note editor, phù hợp với use case hiển thị/chỉnh sửa note bằng giao diện đồ họa và save/load dữ liệu vào note.
- Joplin có `joplin.data` để đọc/ghi note khi cần, và `joplin.commands`/menu để tạo lệnh `Create Kanban Board`.
- Đã tồn tại plugin YesYouKan của Joplin. Plugin đó dùng ý tưởng note Kanban với H1 là cột, H2 là card, và block `kanban-settings` ở cuối note. Kế hoạch này ưu tiên format Markdown dễ đọc trên mobile/ngoài plugin, nhưng sẽ không sao chép code của plugin đó.

Tài liệu tham khảo:

- https://joplinapp.org/help/api/get_started/plugins/
- https://joplinapp.org/api/references/plugin_api/classes/joplinviewseditors.html
- https://joplinapp.org/api/references/plugin_api/classes/joplindata.html
- https://joplinapp.org/api/references/plugin_api/classes/joplincommands.html
- https://joplinapp.org/plugins/plugin/org.joplinapp.plugins.YesYouKan/

## Phạm vi MVP

1. Tạo plugin Joplin có thể build và nạp ở Development Mode.
2. Thêm lệnh `Create Kanban Board` trong menu Tools để tạo note Kanban mẫu ở folder hiện tại.
3. Tự động kích hoạt Kanban editor khi note có metadata nhận diện Kanban.
4. Render note thành bảng Kanban gồm nhiều cột và card.
5. Cho phép thao tác với cột:
   - Thêm cột.
   - Đổi tên cột.
   - Chọn màu cột.
   - Có thể dùng ký hiệu Unicode trực tiếp trong tên cột nếu người dùng muốn.
   - Xóa cột nếu người dùng xác nhận.
6. Cho phép thao tác với card/task:
   - Thêm card text.
   - Sửa card text.
   - Chọn màu card/task.
   - Xóa card.
   - Kéo thả card giữa các cột.
   - Kéo thả card trong cùng cột để sắp xếp ưu tiên.
7. Cung cấp một bộ ký tự Unicode cơ bản để người mới có thể đưa thẳng vào text của cột/card khi cần, không cần tự tìm biểu tượng.
8. Mọi thay đổi trong UI được serialize và save lại vào Markdown body của note.
9. Nếu note bị sửa bằng Markdown editor, Kanban editor parse lại và cập nhật giao diện.

Ngoài phạm vi MVP:

- Board gom card từ nhiều note khác nhau.
- Sync conflict resolver riêng ngoài cơ chế của Joplin.
- Automation/WIP limit/filter/tag/date/assignee.
- Kanban trên mobile nếu môi trường Joplin mobile không hỗ trợ đầy đủ editor plugin như desktop.

## Định dạng Markdown đề xuất

Chọn format để con người đọc được và chỉnh sửa được khi plugin không chạy:

````markdown
# This week [[#94a3b8]]

- Prepare and send out client invoices [[#bfdbfe]]

- Research market trends [[#d9f99d]]

- Customer reported performance issue [[#fecdd3]]

# In progress [[#2563eb]]

- Organize team-building event [[#e9d5ff]]

- Review data pipelines for AI model training [[#fef3c7]]

```kanban-settings
version: 1
plugin: joplinkan
defaultColumnColor: "#64748b"
defaultCardColor: "#ffffff"
```
````

Quy ước:

- H1 (`#`) đại diện cho cột.
- List item cấp đầu tiên (`- Task`) đại diện cho card/task.
- Nội dung chính của card nằm ngay trên một dòng list item. Nếu người dùng muốn ghi chú thêm như `🔥 high priority`, họ tự viết vào text của card.
- Parser vẫn đọc được format H2 cũ để tránh mất dữ liệu thử nghiệm, nhưng serializer mới sẽ ghi lại card thành list item.
- Thứ tự H1/list item trong file là thứ tự hiển thị và độ ưu tiên.
- Code fence `kanban-settings` ở cuối note đánh dấu đây là Kanban board và lưu cấu hình tối thiểu.
- Màu sắc được lưu bằng marker ngắn ở cuối heading/list item, ví dụ `[[#2563eb]]` hoặc `[[red]]`, để tránh HTML comment và tránh cú pháp Markdown dễ bị editor escape.
- Nếu người dùng xóa marker màu bằng Markdown editor, plugin vẫn parse được nội dung, nhưng sẽ dùng màu mặc định khi lưu.
- Nếu tiêu đề cột/card có ký tự Markdown đặc biệt, parser/serializer cần giữ nội dung ổn định và tránh làm vỡ cấu trúc.

Lý do dùng H1 + list item:

- Bảng Markdown khó chỉnh sửa khi card có nội dung dài/nhiều dòng.
- Kéo thả và serialize lại bảng dễ gây diff lớn.
- H1/list item thân thiện hơn với Joplin mobile và các Markdown viewer thông thường.
- Card dạng list item giúp Markdown gọn hơn H2, đúng với mục tiêu bảng Kanban là quản lý danh sách nhanh.

## Màu sắc

MVP hỗ trợ màu cho cả cột và card/task:

- Cột có màu nhấn ở header hoặc viền trái.
- Card/task có màu nền hoặc màu nhãn nhỏ.
- Người dùng có thể chọn từ bảng màu có sẵn và nhập mã màu hex nếu cần.
- Màu được lưu trong metadata Markdown, ví dụ `color=#2563eb`.
- Nếu màu không hợp lệ, plugin dùng màu mặc định và không ghi đè note cho đến khi người dùng lưu thay đổi hợp lệ.

Bảng màu mặc định đề xuất:

- Xám: `#64748b`
- Xanh dương: `#2563eb`
- Xanh lá: `#16a34a`
- Vàng: `#ca8a04`
- Đỏ: `#dc2626`
- Tím: `#9333ea`
- Hồng: `#db2777`
- Cam: `#ea580c`
- Trắng: `#ffffff`

## Bộ ký tự Unicode cơ bản

Plugin cần có một bảng chọn ký hiệu cơ bản cho người mới dùng ngay. Bộ ký hiệu ban đầu:

Trạng thái:

- 📥 Backlog / inbox
- 🚧 Đang làm
- ⏳ Chờ xử lý
- 🔎 Cần xem xét
- ✅ Hoàn tất
- ❌ Hủy

Mức ưu tiên:

- 🔥 Gấp
- ⭐ Quan trọng
- ⬆ Ưu tiên cao
- ➖ Bình thường
- ⬇ Ưu tiên thấp

Loại công việc:

- 🐞 Bug
- ✨ Tính năng
- 🧩 Kỹ thuật
- 📚 Tài liệu
- 🧪 Kiểm thử
- 💬 Trao đổi
- 📦 Đóng gói/phát hành

Nguyên tắc:

- Cho phép người dùng dùng ký hiệu bằng cách nhập trực tiếp vào text cột/card.
- Có thể bổ sung bảng chọn ký hiệu sau, nhưng không hiển thị selector trên mọi card để tránh làm rối bảng Kanban.
- Không phụ thuộc vào icon font bên ngoài để dữ liệu Markdown vẫn portable.
- Nếu môi trường không render emoji đẹp, nội dung Markdown vẫn đọc được vì biểu tượng chỉ là phụ trợ.

## Kiến trúc đề xuất

```text
src/
  index.ts
  commands/
    createKanbanBoard.ts
  editor/
    registerKanbanEditor.ts
    editorHtml.ts
  markdown/
    parseBoard.ts
    serializeBoard.ts
    types.ts
  webview/
    app.ts
    styles.css
  test/
    markdownParser.test.ts
```

Thành phần chính:

- `index.ts`: register plugin, commands, menu và editor view.
- `createKanbanBoard.ts`: tạo note Kanban mẫu với cột, màu và ký hiệu mặc định.
- `registerKanbanEditor.ts`: dùng `joplin.views.editors.register` với `onActivationCheck`, `onUpdate`, `onMessage`.
- `markdown/`: parser/serializer thuần TypeScript, có test riêng, không phụ thuộc Joplin API.
- `webview/`: UI Kanban gọn, tập trung vào danh sách card dạng text. Webview gửi message lên plugin khi người dùng thao tác.
- Bộ chọn màu được render bằng swatch nhỏ, hạn chế chiếm diện tích bảng.
- Save flow: webview action -> plugin nhận message -> cập nhật model -> serialize Markdown -> `joplin.views.editors.saveNote`.

## UI/UX MVP

- Board chiếm toàn bộ editor area, không phải panel phụ.
- Toolbar gọn ở trên cùng: tạo cột và cung cấp bộ biểu tượng Unicode để copy nhanh khi soạn nội dung.
- Mỗi cột có title editable, màu nhấn, ký hiệu Unicode, nút thêm card và menu xóa cột.
- Card hiển thị như một khối text màu, ưu tiên đọc nhanh và kéo thả nhanh.
- Card không hiển thị textarea/selector thường trực. Sửa card bằng thao tác rõ ràng, nội dung card là một dòng text chính.
- Bộ chọn màu dùng swatch nhỏ và không chiếm nhiều diện tích.
- Ký hiệu Unicode nếu cần sẽ nằm trong text của card/cột, không phải avatar hoặc hình ảnh riêng.
- Drag/drop:
  - Kéo card trong cột để đổi ưu tiên.
  - Kéo card sang cột khác để đổi trạng thái.
- Trạng thái lỗi:
  - Note không parse được: hiển thị thông báo lỗi và đề nghị mở Markdown editor.
  - Save lỗi: thông báo toast/dialog và không làm mất state hiện tại.

Thư viện UI/drag-drop sẽ chốt lúc implement sau khi scaffold. Ứng viên:

- `@dnd-kit/core` và `@dnd-kit/sortable`: nhẹ, hiện đại, phù hợp React.
- Nếu scaffold không dùng React, có thể dùng DOM + SortableJS để giảm complexity.

## Luồng dữ liệu

1. Người dùng chọn `Tools > Create Kanban Board`.
2. Plugin tạo note mới với Markdown mẫu, cột mặc định, màu mặc định, ký hiệu mặc định và block `kanban-settings`.
3. Plugin gọi `showEditorPlugin` để hiện Kanban editor cho note mới.
4. Khi editor active:
   - `onActivationCheck` đọc selected note và chỉ return `true` nếu có `kanban-settings`.
   - `onUpdate` lấy body selected note, parse thành `Board`.
   - Plugin post model sang webview.
5. Khi người dùng thao tác:
   - Webview gửi action/model mới về plugin.
   - Plugin validate model, màu sắc và ký hiệu.
   - Plugin serialize về Markdown.
   - Plugin save note body.

## Parser/serializer

Model:

```ts
type Board = {
  version: 1;
  columns: Column[];
  settings: BoardSettings;
};

type Column = {
  id: string;
  title: string;
  color: string;
  icon: string;
  cards: Card[];
};

type Card = {
  id: string;
  title: string;
  body: string;
  color: string;
  icon: string;
};
```

ID và metadata:

- MVP lưu màu bằng marker ngắn cạnh heading/list item:

```markdown
# Backlog [[#64748b]]

- Viết đặc tả [[#fef3c7]]
```

- Nếu người dùng xóa comment bằng Markdown editor, parser sinh lại ID mới và dùng màu/ký hiệu mặc định mà không làm mất nội dung.
- Metadata nên có parser riêng, không parse bằng regex rời rạc ở nhiều nơi.

Quy tắc an toàn:

- Parser không được xóa nội dung ngoài vùng Kanban nếu có.
- Serializer chỉ ghi lại note Kanban theo model đã parse.
- Parser giữ lại format H2 cũ để không làm mất dữ liệu cũ, nhưng serializer mới ghi card thành list item.
- Không tự động overwrite note đang lỗi parse; chỉ save khi model hợp lệ.

## Kiểm thử

Unit tests:

- Parse board có nhiều cột/card.
- Parse list item thành card/task.
- Parse continuation của list item, list lồng và code fence mà không làm mất dữ liệu.
- Parse format H2 cũ và serialize lại thành list item.
- Parse và serialize marker màu `[[#hex]]`.
- Validate màu hex hợp lệ/không hợp lệ.
- Serialize rồi parse lại cho kết quả tương đương.
- Đổi thứ tự card/cột không làm mất body.
- Missing/invalid `kanban-settings`.
- Metadata bị xóa thủ công vẫn không làm mất nội dung.

Manual tests trong Joplin Development Mode:

- Tạo board mới từ menu Tools.
- Sửa cột/card và kiểm tra Markdown body cập nhật.
- Chọn màu cột/card và kiểm tra metadata Markdown.
- Nhập ký hiệu Unicode trực tiếp trong text cột/card và kiểm tra Markdown vẫn đọc được.
- Kéo thả card trong cùng cột và giữa cột.
- Chuyển qua Markdown editor, sửa text, quay lại Kanban editor.
- Restart Joplin development profile và mở lại note.
- Kiểm tra note vẫn đọc được trên viewer Markdown bình thường.

## Các mốc thực hiện

### Milestone 1: Scaffold và nền tảng

- Tạo project bằng generator Joplin.
- Cấu hình TypeScript/build/lint/test.
- Register command/menu có log tối thiểu.
- Xác nhận plugin load được trong Joplin Development Mode.

### Milestone 2: Markdown model

- Định nghĩa type `Board`, `Column`, `Card`.
- Implement parser/serializer.
- Implement parser/serializer cho metadata màu và ký hiệu.
- Viết unit tests cho parser/serializer.

### Milestone 3: Editor integration

- Register alternative editor.
- Activation bằng `kanban-settings`.
- Load selected note vào webview.
- Save Markdown bằng `saveNote`.

### Milestone 4: UI Kanban

- Render board/cột/card.
- Thêm/sửa/xóa cột và card.
- Thêm bộ chọn màu cho cột/card.
- Thêm bộ chọn ký hiệu Unicode cho cột/card.
- Kéo thả sắp xếp card.
- Xử lý empty state và error state.

### Milestone 5: Đóng gói và polish

- Hoàn thiện manifest, icon, README.
- Thêm hướng dẫn development/install bằng tiếng Việt có dấu.
- Chạy build, test, manual test.
- Tạo file `.jpl` nếu cần phát hành thử nghiệm.

## Rủi ro và cách giảm thiểu

- Xung đột với editor plugin khác: `onActivationCheck` chỉ active khi note có `kanban-settings`.
- Mất nội dung Markdown khi serialize: tách parser/serializer thành module có test round-trip trước khi làm UI.
- Metadata màu làm Markdown khó đọc: dùng marker ngắn `[[#xxxxxx]]`, không dùng HTML comment vì có thể bị editor xóa.
- Ký tự Unicode render khác nhau giữa hệ điều hành: coi ký hiệu là phụ trợ, không dùng làm dữ liệu bắt buộc.
- Drag/drop gây save quá nhiều: debounce save hoặc chỉ save khi drop kết thúc.
- Người dùng sửa Markdown làm sai cấu trúc: hiển thị lỗi parse rõ ràng, không tự động overwrite note lỗi.
- Mobile support không đồng nhất: format Markdown H1/list item giúp note vẫn đọc được khi plugin không chạy.

## Quyết định cần phê duyệt

1. Chấp nhận format H1/list item + `kanban-settings` code fence cho MVP.
2. Chấp nhận chỉ lưu màu bằng marker Markdown cạnh heading, không lưu ID/icon trong Markdown.
3. Chấp nhận hướng alternative editor (`joplin.views.editors`) thay vì panel bên cạnh.
4. Plugin sẽ quản lý Kanban trong một note duy nhất, chưa gom task từ nhiều note.
5. MVP tập trung desktop Joplin Development Mode trước; mobile là khả năng tương thích đọc Markdown, không phải UI kéo thả đầy đủ.
6. Tên plugin tạm thời: `JoplinKan`. Có thể đổi trước khi scaffold nếu muốn tên phát hành khác.
