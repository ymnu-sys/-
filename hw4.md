# 作業 4：UML 設計

專題：高科大智慧失物招領平台（課堂展示原型）

本文件的類別、屬性與方法名稱與網站程式（`js/` 資料夾）一致。原型以 JavaScript 模組實作，類別圖中的方法對應模組匯出的函式，括號內註明所在檔案。

## 一、UML 類別圖

```mermaid
classDiagram
    direction LR

    class User {
        +String id
        +String username
        +String role
        +String name
    }
    class Student {
        +String studentId 校外人士可為空
        +String affiliation nkust或external
    }
    class Admin
    User <|-- Student
    User <|-- Admin

    class Category {
        +String id
        +String name
        +String icon
    }

    class Item {
        +String id
        +String name
        +String category
        +String color
        +String campus
        +String location
        +String foundDate
        +String publicDesc
        +String photo
        +String finderId
        +Boolean hidden
        +String createdAt
        +toPublicItem(raw) Item «items.js»
        +searchPublicItems(filters) Item[] «items.js»
        +validateItemForm(data) Result «items.js»
        +createItem(data, user) Result «items.js»
        +derivePublicStatus(item, claims) String «items.js»
        +setItemHidden(itemId, hidden, actor) «items.js»
    }

    class ItemSecret {
        +String itemId
        +String marks
        +String contents
        +String other
        +getItemSecret(itemId, actor) ItemSecret «items.js»
    }

    class ClaimStatus {
        <<enumeration>>
        PENDING 待審核
        NEED_INFO 需要補充資料
        APPROVED 審核通過
        REJECTED 審核未通過
        COMPLETED 已完成領取
    }

    class Claim {
        +String id
        +String itemId
        +String claimantId
        +String applicantName
        +String studentId 校外人士可為空
        +String affiliation nkust或external
        +String contact
        +String description
        +String extraInfo
        +ClaimStatus status
        +String adminNote
        +Supplement[] supplements
        +StatusLog[] history
        +String createdAt
        +String updatedAt
        +checkClaimEligibility(itemId, user) Result «claims.js»
        +validateClaimForm(data) Result «claims.js»
        +createClaim(itemId, data, user) Result «claims.js»
        +transition(claimId, action, actor, payload) Claim «claims.js»
        +supplement(claimId, user, text) Claim «claims.js»
    }

    class StatusLog {
        +ClaimStatus from
        +ClaimStatus to
        +String actorId
        +String note
        +String at
    }

    class Supplement {
        +String text
        +String at
    }

    class Notification {
        +String id
        +String userId
        +String type
        +String claimId
        +String itemId
        +String title
        +String body
        +Boolean read
        +String createdAt
        +createNotification(data) Notification «notifications.js»
        +listForUser(userId) Notification[] «notifications.js»
        +unreadCount(userId) Number «notifications.js»
        +markRead(id, userId) Boolean «notifications.js»
    }

    Category "1" -- "0..*" Item : 分類
    Student "1" -- "0..*" Item : 刊登（finderId）
    Item "1" *-- "1" ItemSecret : 非公開驗證資訊
    Item "1" -- "0..*" Claim : 被認領
    Student "1" -- "0..*" Claim : 提出（claimantId）
    Claim "1" *-- "1..*" StatusLog : 歷程
    Claim "1" *-- "0..*" Supplement : 補充資料
    Claim --> ClaimStatus
    Admin "1" -- "0..*" StatusLog : 審核（actorId）
    User "1" -- "0..*" Notification : 接收
    Claim "1" -- "0..*" Notification : 觸發
```

設計重點：

- `Item` 與 `ItemSecret` 分開存放（`lf_items`、`lf_secrets`）。公開頁面只能透過 `toPublicItem()` 取得白名單欄位，`getItemSecret()` 要求 `actor.role === "admin"`。
- `Claim.status` 只能透過 `transition()`（管理員）與 `supplement()`（申請人，只限 NEED_INFO → PENDING）改變，每次都新增一筆 `StatusLog`。

### 認領狀態圖（補充）

```mermaid
stateDiagram-v2
    [*] --> PENDING: 認領者送出 createClaim
    PENDING --> NEED_INFO: 管理員 request_info（需說明）
    NEED_INFO --> PENDING: 申請人 supplement
    PENDING --> APPROVED: 管理員 approve
    PENDING --> REJECTED: 管理員 reject（需理由）
    APPROVED --> COMPLETED: 管理員 complete（需現場核對）
    APPROVED --> REJECTED: 現場核對不符
    REJECTED --> [*]
    COMPLETED --> [*]
```

## 二、循序圖

### UC-01 搜尋拾獲物品

```mermaid
sequenceDiagram
    actor U as 使用者（訪客）
    participant P as items.html<br/>pages/items.js
    participant I as items.js
    participant S as storage.js
    participant LS as localStorage

    U->>P: 輸入關鍵字、選擇類別與校區
    P->>I: searchPublicItems({keyword, category, campus})
    I->>S: load("lf_items")
    S->>LS: getItem("lf_items")
    LS-->>S: 物品 JSON
    S-->>I: 物品陣列
    I->>I: toPublicItem() 白名單過濾、排除 hidden
    I->>I: 只比對公開欄位（不讀 lf_secrets）
    I-->>P: 符合的公開物品（新到舊）
    P->>I: statusMap()
    I-->>P: 各物品公開狀態
    alt 有結果
        P-->>U: 顯示物品卡片與筆數
    else 沒有結果
        P-->>U: 顯示「找不到符合條件的物品」
    end
    U->>P: 點選卡片
    P-->>U: 開啟 item.html?id=…（只顯示公開資訊）
```

### UC-02 刊登拾獲物品

```mermaid
sequenceDiagram
    actor F as 拾獲者（學生或校外人士）
    participant P as post.html<br/>pages/post.js
    participant A as auth.js
    participant IMG as image.js
    participant I as items.js
    participant S as storage.js

    F->>P: 開啟刊登頁
    P->>A: requireLogin()
    alt 未登入
        A-->>P: NOT_LOGGED_IN
        P-->>F: 導向 login.html?return=post.html
    else 已登入
        A-->>P: user
        P-->>F: 顯示公開資訊區與僅管理員可見區
    end
    F->>P: 選擇類別
    opt 證件、錢包、3C 產品
        P-->>F: 顯示敏感照片警告並停用上傳
    end
    F->>P: 選擇照片（選填）
    P->>IMG: compressImage(file)
    IMG-->>P: 壓縮後的 data URL
    F->>P: 填寫欄位並送出
    P->>I: validateItemForm(data)
    alt 驗證失敗（必填、字數、個資、未填驗證特徵）
        I-->>P: errors
        P-->>F: 欄位下方顯示錯誤
    else 驗證成功
        P->>I: createItem(data, user)
        I->>S: save("lf_items", 公開資料)
        I->>S: save("lf_secrets", 驗證特徵)
        I-->>P: 公開物品
        P-->>F: 顯示成功並開啟物品詳情
    end
```

### UC-03 提交及審核認領申請

```mermaid
sequenceDiagram
    actor C as 認領者（學生或校外人士）
    participant CP as claim.html / my.html
    participant CL as claims.js
    participant N as notifications.js
    participant S as storage.js
    participant AP as admin.html
    actor AD as 管理員

    C->>CP: 點「我要認領」
    CP->>CL: checkClaimEligibility(itemId, user)
    CL-->>CP: ok（非自己的物品、未領回、未重複）
    CP-->>C: 顯示表單（只含公開資訊、無選擇題）
    C->>CP: 自行描述特徵並送出
    CP->>CL: createClaim(itemId, data, user)
    CL->>CL: validateClaimForm(data)
    CL->>S: save("lf_claims", status = PENDING)
    CL->>N: createNotification(SUBMITTED)
    CL-->>CP: claim
    CP-->>C: 「認領申請已送出，等待管理員審核」

    AD->>AP: 開啟審核後台
    AP->>CL: listAllClaims(admin)
    CL-->>AP: 待審核申請
    AD->>AP: 選擇申請
    AP->>AP: getItemSecret(itemId, admin)
    AP-->>AD: 並排顯示申請描述與非公開驗證特徵
    alt 資料不足
        AD->>AP: 要求補充資料（填說明）
        AP->>CL: transition(id, "request_info", admin, {note})
        CL->>N: createNotification(NEED_INFO)
        C->>CP: 在我的專區補充資料
        CP->>CL: supplement(id, user, text)
        CL-->>CP: status = PENDING
    else 描述不符
        AD->>AP: 拒絕（填理由）
        AP->>CL: transition(id, "reject", admin, {note})
        CL->>N: createNotification(REJECTED)
    else 描述相符
        AD->>AP: 核准
        AP->>CL: transition(id, "approve", admin)
        CL->>N: createNotification(APPROVED，請至現場)
        C->>AD: 攜帶學生證或身分證件到服務台
        AD->>AD: 現場核對身分與物品
        AD->>AP: 勾選現場核對，確認完成領取
        AP->>CL: transition(id, "complete", admin, {onsiteVerified: true})
        CL->>S: status = COMPLETED，其他進行中申請改為 REJECTED
        CL->>N: createNotification(COMPLETED)
    end
```

## 三、活動圖

> Mermaid 沒有原生活動圖語法，以下用 flowchart 表示：圓角為開始／結束，方框為活動，菱形為判斷，子框為泳道。

### UC-01 搜尋拾獲物品

```mermaid
flowchart TD
    subgraph 使用者
        A0([開始]) --> A1[開啟首頁或失物列表]
        A1 --> A2[輸入關鍵字／選擇類別／選擇校區]
        A5[瀏覽物品卡片]
        A6{找到自己的物品?}
        A7[點選卡片查看公開詳情]
        A8([結束])
    end
    subgraph 系統
        B1[讀取公開物品並排除已下架]
        B2[只比對公開欄位]
        B3{有符合結果?}
        B4[顯示卡片與筆數]
        B5[顯示查無結果與建議]
    end
    A2 --> B1 --> B2 --> B3
    B3 -- 是 --> B4 --> A5 --> A6
    B3 -- 否 --> B5 --> A2
    A6 -- 是 --> A7 --> A8
    A6 -- 否 --> A2
```

### UC-02 刊登拾獲物品

```mermaid
flowchart TD
    subgraph 拾獲者
        A0([開始]) --> A1[點選刊登拾獲物品]
        A3[填寫公開資訊]
        A4{上傳照片?}
        A5[選擇外觀照片]
        A6[填寫非公開驗證特徵]
        A7[送出]
        A9([結束])
    end
    subgraph 系統
        B0{已登入?}
        B1[導向登入頁]
        B2{敏感類別?}
        B3[顯示警告並要求勾選確認]
        B4[壓縮照片並移除 EXIF]
        B5{驗證通過?<br/>必填、字數、無個資、至少一項特徵}
        B6[顯示欄位錯誤]
        B7[公開資訊存入 lf_items<br/>驗證特徵存入 lf_secrets]
        B8[顯示成功並開啟詳情頁]
    end
    A1 --> B0
    B0 -- 否 --> B1 --> A1
    B0 -- 是 --> A3 --> A4
    A4 -- 是 --> B2
    B2 -- 是 --> B3 --> A5
    B2 -- 否 --> A5
    A5 --> B4 --> A6
    A4 -- 否 --> A6
    A6 --> A7 --> B5
    B5 -- 否 --> B6 --> A3
    B5 -- 是 --> B7 --> B8 --> A9
```

### UC-03 提交及審核認領申請

```mermaid
flowchart TD
    subgraph 認領者
        C0([開始]) --> C1[在物品詳情點我要認領]
        C3[自行描述特徵並送出]
        C6[補充資料]
        C8[攜帶學生證或身分證件到現場]
        C9([結束])
    end
    subgraph 系統
        S1{符合認領資格?}
        S1x[說明無法申請原因]
        S2{必填完成?}
        S3[建立申請 狀態=待審核<br/>通知已送出]
        S4[通知要求補充 狀態=需要補充資料]
        S5[通知未通過 狀態=審核未通過]
        S6[通知至現場 狀態=審核通過]
        S7[狀態=已完成領取 物品=已領回<br/>其他申請自動結案並通知]
    end
    subgraph 管理員
        M1[比對申請描述與非公開驗證特徵]
        M2{判斷結果}
        M3{現場核對身分與物品相符?}
    end
    C1 --> S1
    S1 -- 否 --> S1x --> C9
    S1 -- 是 --> C3 --> S2
    S2 -- 否 --> C3
    S2 -- 是 --> S3 --> M1 --> M2
    M2 -- 資料不足 --> S4 --> C6 --> M1
    M2 -- 不符 --> S5 --> C9
    M2 -- 相符 --> S6 --> C8 --> M3
    M3 -- 是 --> S7 --> C9
    M3 -- 否 --> S5
```

## 四、需求、使用案例、圖表與程式對照

| 功能需求 | 使用案例 | 循序圖／活動圖 | 主要程式 | 自動測試 |
|---|---|---|---|---|
| FR-01 首頁 | UC-01 | UC-01 | `index.html`、`pages/home.js` | `items.test.js` 最新物品 |
| FR-02 失物列表 | UC-01 | UC-01 | `items.html`、`listPublicItems` | `items.test.js` 下架 |
| FR-03 搜尋 | UC-01 | UC-01 | `searchPublicItems` | `items.test.js` 隱藏特徵搜尋 |
| FR-04 分類 | UC-01、UC-02 | UC-01、UC-02 | `CATEGORIES` | `items.test.js` 類別篩選 |
| FR-05 物品詳情 | UC-05 | UC-01 | `item.html`、`toPublicItem`、`derivePublicStatus` | `items.test.js` 白名單、公開狀態 |
| FR-06 刊登 | UC-02 | UC-02 | `post.html`、`validateItemForm`、`createItem`、`image.js` | `items.test.js` 刊登驗證 |
| FR-07 認領申請 | UC-03 | UC-03 | `claim.html`、`createClaim` | `claims.test.js` 資格與驗證 |
| FR-08 管理員審核 | UC-04、UC-09 | UC-03 | `admin.html`、`transition`、`getItemSecret` | `claims.test.js` 權限與轉換 |
| FR-09 認領狀態 | UC-04、UC-06、UC-08 | UC-03、狀態圖 | `CLAIM_STATUS`、`ACTIONS`、`supplement` | `claims.test.js` 狀態機 |
| FR-10 通知 | UC-07 | UC-03 | `my.html`、`notifications.js` | `notifications.test.js` |
