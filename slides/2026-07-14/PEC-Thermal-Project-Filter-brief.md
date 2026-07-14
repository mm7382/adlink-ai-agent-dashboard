# Project Filter 主管簡報素材整理

用途：將本文件交給 Gemini，請它製作 3-5 頁主管簡報。  
建議檔名：`Project_Filter_TES_EV_Pilot_主管說明.pptx`

---

## 給 Gemini 的建議指令

請根據以下素材製作一份 3-5 頁 PowerPoint 簡報，對象是散熱/工程主管。  
簡報目的不是介紹程式功能，而是說明為什麼 Project Filter 值得被核准為 TES / EV 熱測報告 pilot 工具。

簡報語氣：

- 專業、主管導向、決策導向。
- 不要像功能清單，也不要像開發紀錄。
- 重點放在工程痛點、目前驗證成果、剩餘風險與主管需要支持的決策。
- 每頁用一句清楚結論當標題。
- 使用繁體中文。

視覺風格：

- 白底、乾淨、工程簡報風格。
- 避免花俏插圖與過多裝飾。
- 可以使用重點數字、流程圖、簡單表格。
- 若有截圖，請把它當作「目前 GUI 已成形」的證據，不要讓截圖成為整頁唯一重點。

建議核心結論：

> 建議將 Project Filter 作為 TES / EV 熱測報告 pilot 工具，先把熱測報告變成可搜尋、可比對、可追溯的工程資料，再評估跨 BU 或跨文件類型擴展。

---

## 一句話摘要

Project Filter 是一個本機化散熱報告管理與判讀輔助工具，已能把散落在公司資料夾中的 Word/PDF 熱測報告，轉成可搜尋、可篩選、可比對、可追溯的本機資料庫與 GUI 工作台。

---

## 主管簡報應傳達的主軸

### 現在的問題

熱測報告不是沒有資料，而是資料散在不同位置與格式中：

- Word / PDF 報告分散在公司 share。
- 同一產品、不同 stage、不同專案的熱測資料不容易橫向比較。
- CPU/GPU、環溫、測試風流、高溫零件、spec、量測值與 margin 需要人工翻表格。
- 若某份報告沒有擷取到溫度資料，很難快速判斷是 parser 問題，還是來源報告本身沒有填量測值。
- 工程師很難快速找到可重用報告與相似 thermal case。

### Project Filter 的定位

Project Filter 不是泛用文件管理系統。  
它的短期定位應該是：

> 服務散熱工程師的熱測報告搜尋、篩選、判讀與原始證據回查。

目前最適合的 pilot 範圍：

- TES / EV 熱測報告。
- 路徑限定在 `Thermal Simulation & Test`。
- 路徑或檔名需包含 `thermal`。
- 先把這個範圍做穩，再討論跨 BU 或跨文件類型擴展。

---

## 目前已實現內容

### 1. 本機 GUI 工作台

目前工具提供本機瀏覽器 GUI：

- 固定開在 `http://127.0.0.1:8888`
- 使用 `Start_Project_Filter_GUI.bat` 啟動
- 使用本機 SQLite：`db/project_filter.sqlite3`
- 不需要外部網路服務
- GUI 可完成來源設定、來源測試、掃描、下載、匯入、篩選與結果回查

GUI 目前已包含：

- 報告篩選
- BU 來源與下載
- 來源資料夾設定
- 來源盤點清單
- 已匯入報告列表
- 溫度資料狀態篩選
- 高溫零件類別篩選
- 原始結果 / 擷取數據比對
- 開啟來源資料夾

### 2. 公司來源資料夾盤點

已支援從 GUI 設定 BU 與來源資料夾：

- BU：`PEC_TES_EV`
- 來源路徑：`\\adlink-fs1\PEC\TES\EV`

目前工作流：

1. 在 GUI 新增 BU 來源。
2. 測試來源路徑是否可讀。
3. 掃描來源資料夾並建立 inventory。
4. 只保留符合 thermal report 條件的檔案。
5. 顯示被排除檔案與排除原因。
6. 勾選要下載的報告。
7. 將報告複製到本機 `incoming_reports`。
8. 匯入 Project Filter DB。

### 3. 低衝擊路徑測試

在掃描公司 share 前，GUI 先做低衝擊路徑測試：

- exists：true
- is_dir：true
- can_list：true
- sample_count：5

意義：

- 不會一開始就對公司 share 做遞迴掃描與 hash。
- 可先確認 VPN / 內網 / 權限 / 路徑字串是否正確。
- 對主管來說，這是降低工具導入風險的重要設計。

### 4. 來源掃描進度、停止、排除清單

已實作：

- 掃描進度百分比。
- 當前掃描路徑顯示。
- 停止掃描按鈕。
- 被排除清單 dialog。
- 排除原因 CSV：`inventory/report_source_exclusions.csv`

掃描驗證結果：

- candidates：505
- matched：81
- filtered out：424
- new：0
- changed：0
- missing：0
- errors：0
- inventory total：81
- pending：0
- downloaded：81

排除規則：

- 不在 `Thermal Simulation & Test` 底下。
- 在 `Thermal Simulation & Test` 底下，但路徑或檔名不包含 `thermal`。

### 5. 選擇性下載

目前設計不是強制整批下載，而是保留人工選擇權：

- 來源清單可篩選。
- 來源清單可勾選。
- 可開啟 `查看來源清單並選擇下載` dialog。
- 按鈕：`下載已勾選報告`
- 後端支援 selected-only download。

目前 production pending 為 0，因此正式 GUI 無新檔可下載。  
但已用 local fixture 驗證 selected-only 行為：

- `alpha.pdf`：已下載
- `beta.docx`：pending
- 僅選 `beta.docx` 後，結果只複製 `beta.docx`
- `alpha.pdf` 沒有被重新複製

### 6. 熱測報告資料擷取

目前可從 Word/PDF 熱測報告擷取：

- CPU model
- GPU model
- CPU/GPU power clues
- test temperature
- spec temperature
- margin
- ambient / chamber temperature
- chamber airflow
- stress tool summary
- active / passive / mixed / unknown cooling classification
- hot components：
  - M.2 SSD
  - VRAM
  - PCH
  - DDR
  - VR
  - LAN
  - CPU / GPU 相關重要溫度列

### 7. 高溫零件優先規則

目前不是列出所有量測零件，而是以 thermal review 重要性做優先：

保留規則：

- spec < 100 C 的 component。
- CPU / GPU / VRAM / DDR / PCH 等重要零件。

排除規則：

- `Inlet air-*`
- `Outlet air-*`
- ambient rows
- `Ta=xxC` test condition
- watt / GHz / RPM / duty 等非 component metric
- 高 spec 且不重要的 power-side rows
- CPU/GPU 周邊 power-side parts 不應因名稱含 CPU/GPU 就被當成 CPU/GPU important row

### 8. 溫度資料展開 / 收合

GUI 預設只顯示前 8 筆高優先溫度列：

- 超過 8 筆時顯示 `展開完整數據 (N)`
- 展開後可顯示完整表格
- 再按一次可收合

驗證結果：

- 19 份 report cards 有可展開溫度表
- 某份報告可從 8 rows 展開到 46 rows
- 預覽排序依風險優先，最小 margin 優先

### 9. 原始結果 / 擷取數據比對

已新增：

- API：`GET /api/result-review?report_id=...`
- GUI dialog：`原始結果 / 擷取數據比對`
- report card button：`比對原始結果`

左側顯示：

- DOCX result tables
- PDF text parsed rows
- PDF OCR parsed rows
- 若找不到來源列，顯示原因

右側顯示：

- Project Filter structured extraction
- rank
- component
- category
- spec
- measured temperature
- margin
- source type

價值：

- 若來源表格是空白，使用者能直接看到。
- 若 OCR 或 parser 有擷取資料，使用者能看到結構化結果。
- 若 parser 支援不足，來源列與擷取列可放在同一個 dialog 比對。

### 10. 原始來源資料夾回查

每份 imported report 目前可回到原始來源路徑：

- report card 顯示 `原始來源`
- report card 有 `開啟來源資料夾`
- 後端只接受 `report_id`
- 系統從 DB 查可信來源路徑，不讓 GUI 傳任意 path

驗證結果：

- 30 / 30 imported reports 都有 `source_origin_folder`
- `open-source-folder` API 對 report id `402` 回傳 `ok: true`
- GUI 點擊後狀態顯示已開啟來源資料夾

---

## 關鍵驗證數字

建議在簡報中用一頁呈現這些數字：

| 指標 | 數字 | 意義 |
|---|---:|---|
| 已匯入報告 | 30 | 真實資料已可進入 Project Filter |
| 來源 inventory | 81 | 公司 share 中符合條件的 thermal report source |
| active sources | 81 | 目前來源有效 |
| downloaded sources | 81 | 來源已下載到本機 |
| pending sources | 0 | 目前正式資料沒有新 pending |
| reports matched back to source origin | 30 | 匯入報告都可追溯回原始來源 |
| reports with temperature data | 29 / 30 | 大多數報告可取得溫度資料 |
| total extracted hot component rows | 427 | 可供篩選與比較的高溫零件資料 |
| OCR recovered rows | 17 | 本機 OCR 補回 PDF 表格資料 |
| filtered out files | 424 | 工具能排除不符合 thermal report 條件的檔案 |

---

## 溫度資料品質

目前 30 份報告的溫度資料狀態：

- extracted：27
- ocr_extracted：2
- source_no_measured_values：1

OCR 補回案例：

- `Bayer NGCT SCP`
  - OCR recovered 11 temperature rows
- `GE OEC 3D BOX PC`
  - OCR recovered 6 temperature rows

唯一 problem report：

- `ADi-SA6X-RZ-E8K_Thermal Test Report_20251231`
- 狀態：`source_no_measured_values`
- 原因：
  - DOCX 有 result table
  - 但 measured fields 是空白或 `Non`
  - 沒有 matching PDF 可補讀

這個案例對主管簡報很重要，因為它證明系統不是單純說「沒資料」，而是能說明缺值原因。

---

## 本機與資安設計

Project Filter 的資料處理是 local-only：

- 使用本機 Python GUI
- 使用本機 SQLite
- 不需要外部 cloud service
- OCR plugin 安裝在 project local folder
- 公司 report source paths 與本機報告資料不應進 git

已確認 `.gitignore` 包含：

- `db/`
- `inventory/`
- `incoming_reports/`
- `config/report_sources.json`
- `static/assets/`
- `plugins/python/`

意義：

- 避免敏感報告、來源路徑、產品圖片、OCR plugin 被誤 commit。
- 導入時較容易向主管說明資料仍留在本機。

---

## 目前剩餘風險與主管需要決定的事

### 1. 空白 spec row 要不要保留

現況：

- 部分 hot component rows 的 spec 是空白。
- 多數是 CPU / DDR 這類重要 rows。
- 因為 spec 空白，所以 margin 也空白。

決策：

- 重要 component 即使 spec 空白也保留？
- 還是預設隱藏，只在展開或標記 incomplete 時顯示？

### 2. choke / MOS / PL 類 power-side row 顯示策略

現況：

- 部分低 spec power-side rows 被保留。
- 例如 `PL4 choke`, `PL6 choke`, `DDR choke`
- 原因是使用者規則要求列出 spec < 100 C 的零件，以及 CPU/GPU/VRAM/DDR 重要項目。

決策：

- choke / PL / MOS 類元件低於 100 C 是否仍列入主管 review？
- 還是只在搜尋或展開完整資料時顯示？

### 3. 正式 visible selected-download test 尚未完成

現況：

- Production pending = 0
- 沒有真實新檔可在正式 GUI 中完成 selected-download test
- 後端 selected-only 已用 local fixture 驗證

決策：

- 下一次 production 出現 pending 時，是否把「真實 GUI 勾選下載驗證」列為 pilot 驗收項目？

---

## 建議簡報架構：5 頁版

### Slide 1：建議先把 Project Filter 定為 TES / EV 熱測報告 pilot

主訊息：

> Project Filter 已經不是單次 parser，而是能把散落在公司資料夾的熱測報告轉成可搜尋、可比對、可追溯的本機資料庫。

建議畫面：

- 左側大標題與一句話結論。
- 右側放「這次要主管決定」：
  - 先鎖定 TES / EV 熱測報告。
  - 定版來源盤點、選擇性下載、溫度資料判讀、原始證據回查流程。
  - 通過後再評估跨 BU 或文件類型擴展。

一句話結論：

> 先把熱測報告變成工程可用資料，再談更大的自動化。

### Slide 2：真正痛點是報告沒有變成可管理的工程資料

主訊息：

> 熱測報告不是沒有資料，而是資料散在 Word、PDF、公司 share 與人工記憶中。

可放三個痛點：

1. 找資料慢
   - 同一產品、不同 stage、不同 BU 的報告散在資料夾中。
   - 人工搜尋很難保證完整。

2. 比較成本高
   - CPU/GPU、環溫、測試風流、高溫零件要手動從表格整理。
   - 很難快速橫向比較。

3. 缺值難判斷
   - 沒擷取到資料時，難判斷是來源報告沒填，還是 parser 不支援。

底部可放定位：

> Project Filter 的定位：先服務散熱工程師的報告搜尋與判讀，不擴張成泛用文件管理系統。

### Slide 3：目前版本已能跑完一條可操作流程

主訊息：

> 散熱工程師不用離開 GUI，就能完成來源設定、盤點、下載、匯入與回查。

可放流程：

1. 測試來源路徑
2. 掃描來源並建立 inventory
3. 篩選與勾選來源報告
4. 下載 selected reports
5. 匯入 Project Filter DB
6. 篩選高溫零件與溫度資料
7. 比對原始結果與開啟來源資料夾

可放 GUI 截圖：

- 截圖重點：來源資料夾設定、來源盤點清單、已匯入報告在同一頁。
- 不要讓截圖過小；若放截圖，旁邊只放 2-3 個重點 callout。

三個 callout：

- 安全地接公司 share：先測路徑，再掃描與 hash。
- 保留人工選擇權：來源清單可篩選、可勾選、selected-only download。
- 結果能回到原始證據：比對原始結果列、開啟來源資料夾。

### Slide 4：驗證結果支持繼續做成正式流程

主訊息：

> 核心工作流已能用真實資料跑通，剩下主要是規則調校與正式新檔驗證。

建議放四個大數字：

- 30：已匯入熱測報告
- 81：有效來源清單
- 29 / 30：有可用溫度資料
- 427：已擷取高溫零件列

下面放表格：

| 驗證項目 | 目前狀態 | 主管應理解的意義 |
|---|---|---|
| 來源盤點 | 81 筆都在 Thermal Simulation & Test 且路徑/檔名含 thermal | 來源已能收斂，不是全公司 share 亂掃 |
| OCR 補回 | Bayer 與 GE OEC 兩份 PDF 補回 17 列溫度資料 | 缺表格文字時仍有本機補救路徑 |
| 缺值解釋 | 只剩 1 份來源量測欄位空白或 Non | 能區分來源報告品質問題與 parser 問題 |

### Slide 5：下一步不是加功能，而是把規則與責任收斂

主訊息：

> 建議用小範圍 pilot 讓工具進入可維護狀態，再決定是否擴展。

建議表格：

| 主管決策 | 工程動作 | 完成判準 |
|---|---|---|
| 鎖定 pilot 範圍 | 先以 TES / EV 熱測報告為正式範圍，不急著跨 BU | 新增報告能被盤點、勾選下載、匯入、篩選 |
| 定義顯示規則 | 決定空白 spec、choke / MOS / PL、CPU/GPU 周邊件怎麼呈現 | 主管 review 看到的是高價值項目，不是雜訊清單 |
| 補正式新檔驗證 | 等 production pending 出現時做一次可見 GUI 勾選下載驗證 | 證明選擇性下載在真實資料上成立 |
| 建立品質狀態 | 保留已擷取、OCR 補回、來源未填、需檢查格式等狀態 | 後續維護知道該修 parser 還是補來源報告 |

建議決議：

> 核准 Project Filter 進入 TES / EV pilot 定版，下一次 review 以規則品質與正式新檔驗證結果回報。

---

## 若只做 3 頁簡報

如果主管時間很短，可以縮成 3 頁：

1. 為什麼需要 Project Filter
   - 痛點 + 建議 pilot 範圍

2. 目前已驗證到哪裡
   - GUI 工作流 + 30 / 81 / 29 / 427 數字

3. 需要主管決定什麼
   - pilot 範圍、顯示規則、正式新檔驗證

---

## 建議不要放太多的內容

避免讓主管簡報變成開發紀錄：

- 不要列太多 API 名稱。
- 不要詳細解釋 `pdfplumber`、`rapidocr-onnxruntime`、SQLite schema。
- 不要放太多錯誤修正紀錄。
- 不要把整頁塞滿 GUI 按鈕截圖。
- 不要強調「AI 做了什麼」，重點是工具對工程流程的價值。

---

## 可用來源資料

這份素材整理自目前專案檔案與驗證紀錄：

- `README.md`
- `logs/codex_validation_20260713_project_filter_expectations.md`
- `logs/codex_change_log_20260710_local_ocr_plugin.md`
- `logs/codex_change_log_20260710_hot_component_priority_filter.md`
- `logs/codex_change_log_20260710_scan_progress_stop_exclusions.md`
- `logs/codex_change_log_20260710_temperature_expand_collapse.md`
- `logs/codex_change_log_20260711_result_review_dialog.md`
- `logs/codex_change_log_20260711_source_folder_open.md`

---

## 備註給 Gemini

如果要加入截圖，請優先使用目前 Project Filter GUI 第一屏，截圖重點應包含：

- 左側 report filters
- 來源資料夾設定
- 來源盤點清單
- 已匯入報告區塊
- `30 / 30`
- 來源 total / downloaded / pending 數字

截圖只是證據，請不要讓截圖取代簡報敘事。
